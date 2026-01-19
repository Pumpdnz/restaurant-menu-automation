/**
 * Feature Flag Middleware
 *
 * Provides middleware functions to check if features are enabled for an organization.
 * Feature flags are stored in the organisations.feature_flags JSONB column.
 *
 * Usage:
 *   const { requireStandardExtraction, checkFeatureFlag } = require('./middleware/feature-flags');
 *
 *   // Use pre-built middleware
 *   app.post('/api/extract', authMiddleware, requireStandardExtraction, handler);
 *
 *   // Or use dynamic check
 *   app.post('/api/custom', authMiddleware, checkFeatureFlag('customFeature'), handler);
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { executeWithRetry, isTransientError } = require('../src/services/database-error-handler');

// Create Supabase client for feature flag lookups
const supabaseUrl = process.env.SUPABASE_URL || 'https://qgabsyggzlkcstjzugdh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey = supabaseServiceKey || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Get a nested value from an object using dot notation
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot notation path (e.g., 'registration.menuUploading')
 * @returns {any} The value at the path, or undefined if not found
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Check if a feature is enabled from feature config
 * Handles both { enabled: true } objects and direct boolean values
 * @param {any} featureConfig - The feature configuration
 * @returns {boolean} Whether the feature is enabled
 */
function isFeatureEnabled(featureConfig) {
  if (featureConfig === undefined || featureConfig === null) {
    return false;
  }

  if (typeof featureConfig === 'boolean') {
    return featureConfig;
  }

  if (typeof featureConfig === 'object') {
    return featureConfig.enabled === true;
  }

  return false;
}

/**
 * Create a middleware function that checks if a feature is enabled
 * @param {string} featureName - The feature name or path (supports dot notation)
 * @returns {Function} Express middleware function
 */
const checkFeatureFlag = (featureName) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated (authMiddleware should run first)
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'Authentication required before feature flag check'
        });
      }

      const organisationId = req.user.organisationId;

      if (!organisationId) {
        return res.status(403).json({
          error: 'Organization not found',
          message: 'User must belong to an organization'
        });
      }

      // Try to use cached organisation from authMiddleware first
      let featureFlags = req.user.organisation?.feature_flags;
      let orgName = req.user.organisation?.name || 'Unknown';

      // If not available, fetch from database (with retry for transient errors)
      if (!featureFlags) {
        let org;
        try {
          org = await executeWithRetry(
            () => supabase
              .from('organisations')
              .select('feature_flags, name')
              .eq('id', organisationId)
              .single(),
            `Feature flags fetch for org ${organisationId}`
          );
        } catch (fetchError) {
          if (isTransientError(fetchError)) {
            console.error(`[Feature Flags] Service temporarily unavailable for org ${organisationId}:`, fetchError.message);
            return res.status(503).json({
              error: 'Service temporarily unavailable',
              message: 'Could not verify feature flags. Please try again.',
              retryable: true
            });
          }
          console.error(`[Feature Flags] Failed to fetch org ${organisationId}:`, fetchError);
          return res.status(403).json({
            error: 'Organization not found',
            message: 'Could not verify organization settings'
          });
        }

        if (!org) {
          return res.status(403).json({
            error: 'Organization not found',
            message: 'Could not verify organization settings'
          });
        }

        featureFlags = org.feature_flags;
        orgName = org.name;
      }

      // Check if feature is enabled
      const featureConfig = getNestedValue(featureFlags, featureName);
      const enabled = isFeatureEnabled(featureConfig);

      if (!enabled) {
        console.log(`[Feature Flags] Feature '${featureName}' disabled for org '${orgName}' (${organisationId})`);
        return res.status(403).json({
          error: 'Feature not available',
          message: `${featureName} is not enabled for ${orgName}`,
          feature: featureName,
          upgrade_required: true,
          contact_support: 'Please contact your administrator to enable this feature'
        });
      }

      // Attach feature config to request for potential rate/limit checking
      req.featureConfig = featureConfig;
      req.featureFlags = featureFlags;

      next();
    } catch (error) {
      console.error('[Feature Flags] Middleware error:', error);
      res.status(500).json({
        error: 'Failed to verify feature access',
        message: error.message
      });
    }
  };
};

/**
 * Helper middleware that checks feature flag but doesn't block if missing
 * Useful for gradual rollout - attaches flag status to req without blocking
 * @param {string} featureName - The feature name or path
 * @returns {Function} Express middleware function
 */
const checkFeatureFlagOptional = (featureName) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.organisationId) {
        req.featureEnabled = false;
        return next();
      }

      let featureFlags = req.user.organisation?.feature_flags;

      if (!featureFlags) {
        try {
          const org = await executeWithRetry(
            () => supabase
              .from('organisations')
              .select('feature_flags')
              .eq('id', req.user.organisationId)
              .single(),
            'Optional feature flags fetch'
          );
          featureFlags = org?.feature_flags;
        } catch (error) {
          // For optional check, just continue with no flags on error
          featureFlags = null;
        }
      }

      const featureConfig = getNestedValue(featureFlags, featureName);
      req.featureEnabled = isFeatureEnabled(featureConfig);
      req.featureConfig = featureConfig;
      req.featureFlags = featureFlags;

      next();
    } catch (error) {
      console.error('[Feature Flags] Optional check error:', error);
      req.featureEnabled = false;
      next();
    }
  };
};

/**
 * Get all feature flags for current user's organization
 * Useful for frontend to know what features to show
 */
const getFeatureFlags = async (req, res) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Authentication required'
      });
    }

    let featureFlags = req.user.organisation?.feature_flags;

    if (!featureFlags) {
      try {
        const org = await executeWithRetry(
          () => supabase
            .from('organisations')
            .select('feature_flags')
            .eq('id', req.user.organisationId)
            .single(),
          'Get feature flags for user'
        );
        featureFlags = org?.feature_flags || {};
      } catch (error) {
        if (isTransientError(error)) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Could not fetch feature flags. Please try again.',
            retryable: true
          });
        }
        return res.status(500).json({
          error: 'Failed to fetch feature flags',
          message: error.message
        });
      }
    }

    res.json({ feature_flags: featureFlags });
  } catch (error) {
    console.error('[Feature Flags] Get flags error:', error);
    res.status(500).json({
      error: 'Failed to get feature flags',
      message: error.message
    });
  }
};

// ============================================
// ORIGINAL EXTRACTION FEATURE FLAGS
// ============================================

const requireStandardExtraction = checkFeatureFlag('standardExtraction');
const requirePremiumExtraction = checkFeatureFlag('premiumExtraction');
const requireLogoExtraction = checkFeatureFlag('logoExtraction');
const requireLogoProcessing = checkFeatureFlag('logoProcessing');
const requireGoogleSearch = checkFeatureFlag('googleSearchExtraction');
const requirePlatformDetails = checkFeatureFlag('platformDetailsExtraction');
const requireCsvExport = checkFeatureFlag('csvDownload');
const requireCsvWithImagesExport = checkFeatureFlag('csvWithImagesDownload');
const requireImageDownload = checkFeatureFlag('imageZipDownload');
const requireImageUpload = checkFeatureFlag('imageUploadToCDN');
const requireBulkOperations = checkFeatureFlag('bulkOperations');

// ============================================
// NEW: TASKS & SEQUENCES (UI-only, no API blocking needed)
// ============================================

const requireTasksAndSequences = checkFeatureFlag('tasksAndSequences');

// ============================================
// NEW: SOCIAL MEDIA (entire feature)
// ============================================

const requireSocialMedia = checkFeatureFlag('socialMedia');

// ============================================
// NEW: LEAD SCRAPING
// ============================================

const requireLeadScraping = checkFeatureFlag('leadScraping');
const requireLeadScrapingJobs = checkFeatureFlag('leadScraping.scrapeJobs');
const requireLeadScrapingConversion = checkFeatureFlag('leadScraping.leadConversion');
const requireLeadScrapingEnrichment = checkFeatureFlag('leadScraping.stepEnrichment');

// ============================================
// NEW: BRANDING EXTRACTION
// ============================================

const requireBrandingExtraction = checkFeatureFlag('brandingExtraction');
const requireFirecrawlBranding = checkFeatureFlag('brandingExtraction.firecrawlBranding');

// ============================================
// NEW: CONTACT DETAILS EXTRACTION
// ============================================

const requireContactDetailsExtraction = checkFeatureFlag('contactDetailsExtraction');
const requireCompaniesOfficeExtraction = checkFeatureFlag('contactDetailsExtraction.companiesOffice');
const requireEmailPhoneExtraction = checkFeatureFlag('contactDetailsExtraction.emailPhoneExtraction');

// ============================================
// NEW: REGISTRATION FEATURES (parent and individual steps)
// ============================================

const requireRegistration = checkFeatureFlag('registration');
const requireRegistrationUserAccount = checkFeatureFlag('registration.userAccountRegistration');
const requireRegistrationRestaurant = checkFeatureFlag('registration.restaurantRegistration');
const requireRegistrationMenuUpload = checkFeatureFlag('registration.menuUploading');
const requireRegistrationItemTags = checkFeatureFlag('registration.itemTagUploading');
const requireRegistrationOptionSets = checkFeatureFlag('registration.optionSetUploading');
const requireRegistrationCodeInjection = checkFeatureFlag('registration.codeInjection');
const requireRegistrationWebsiteSettings = checkFeatureFlag('registration.websiteSettings');
const requireRegistrationStripePayments = checkFeatureFlag('registration.stripePayments');
const requireRegistrationServicesConfig = checkFeatureFlag('registration.servicesConfiguration');
const requireRegistrationOnboardingUser = checkFeatureFlag('registration.onboardingUserManagement');
const requireRegistrationFinalizeSetup = checkFeatureFlag('registration.finalisingSetup');
const requireRegistrationOnboardingSync = checkFeatureFlag('registration.onboardingSync');

module.exports = {
  // Core utilities
  checkFeatureFlag,
  checkFeatureFlagOptional,
  getFeatureFlags,
  getNestedValue,
  isFeatureEnabled,

  // Original extraction features
  requireStandardExtraction,
  requirePremiumExtraction,
  requireLogoExtraction,
  requireLogoProcessing,
  requireGoogleSearch,
  requirePlatformDetails,
  requireCsvExport,
  requireCsvWithImagesExport,
  requireImageDownload,
  requireImageUpload,
  requireBulkOperations,

  // NEW: Tasks & Sequences (UI-only, no API blocking needed)
  requireTasksAndSequences,

  // NEW: Social Media (entire feature)
  requireSocialMedia,

  // NEW: Lead Scraping (parent and sub-features)
  requireLeadScraping,
  requireLeadScrapingJobs,
  requireLeadScrapingConversion,
  requireLeadScrapingEnrichment,

  // NEW: Branding Extraction
  requireBrandingExtraction,
  requireFirecrawlBranding,

  // NEW: Contact Details Extraction
  requireContactDetailsExtraction,
  requireCompaniesOfficeExtraction,
  requireEmailPhoneExtraction,

  // NEW: Registration Features (parent and individual steps)
  requireRegistration,
  requireRegistrationUserAccount,
  requireRegistrationRestaurant,
  requireRegistrationMenuUpload,
  requireRegistrationItemTags,
  requireRegistrationOptionSets,
  requireRegistrationCodeInjection,
  requireRegistrationWebsiteSettings,
  requireRegistrationStripePayments,
  requireRegistrationServicesConfig,
  requireRegistrationOnboardingUser,
  requireRegistrationFinalizeSetup,
  requireRegistrationOnboardingSync
};
