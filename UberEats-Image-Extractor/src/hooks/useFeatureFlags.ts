import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Feature flag structure - can be a simple boolean or an object with enabled status and metadata
 */
interface FeatureFlagValue {
  enabled: boolean;
  ratePerItem?: number;
  [key: string]: any;
}

interface FeatureFlags {
  [key: string]: boolean | FeatureFlagValue | FeatureFlags;
}

interface UseFeatureFlagsReturn {
  featureFlags: FeatureFlags | null;
  isFeatureEnabled: (path: string) => boolean;
  getFeatureFlag: <T = FeatureFlagValue>(path: string) => T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to access and check feature flags for the current user's organisation
 *
 * @example
 * ```tsx
 * const { isFeatureEnabled, loading } = useFeatureFlags();
 *
 * // Simple check
 * if (isFeatureEnabled('csvDownload')) { ... }
 *
 * // Nested check with dot notation
 * if (isFeatureEnabled('brandingExtraction.firecrawlBranding')) { ... }
 *
 * // Check sub-feature within leadScraping
 * if (isFeatureEnabled('leadScraping.scrapeJobs')) { ... }
 * ```
 */
export function useFeatureFlags(): UseFeatureFlagsReturn {
  const { user } = useAuth();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeatureFlags = useCallback(async () => {
    if (!user?.organisationId) {
      setFeatureFlags(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('organisations')
        .select('feature_flags')
        .eq('id', user.organisationId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setFeatureFlags(data?.feature_flags || {});
    } catch (err: any) {
      console.error('Error loading feature flags:', err);
      setError(err.message || 'Failed to load feature flags');
      setFeatureFlags({});
    } finally {
      setLoading(false);
    }
  }, [user?.organisationId]);

  // Load feature flags when user's organisation changes
  useEffect(() => {
    loadFeatureFlags();
  }, [loadFeatureFlags]);

  /**
   * Check if a feature is enabled using dot notation path
   * Handles both direct boolean values and { enabled: boolean } objects
   *
   * @param path - Dot-separated path to the feature (e.g., 'csvDownload' or 'brandingExtraction.firecrawlBranding')
   * @returns boolean - Whether the feature is enabled
   */
  const isFeatureEnabled = useCallback((path: string): boolean => {
    if (!featureFlags) return false;

    const parts = path.split('.');
    let current: any = featureFlags;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return false;
      }
      current = current[part];
    }

    // Handle different value types
    if (typeof current === 'boolean') {
      return current;
    }

    if (typeof current === 'object' && current !== null) {
      // Check for { enabled: boolean } pattern
      if ('enabled' in current) {
        return current.enabled === true;
      }
      // If it's an object without 'enabled', consider it enabled if it exists
      return true;
    }

    return false;
  }, [featureFlags]);

  /**
   * Get the full feature flag value for a path
   * Useful when you need access to metadata like ratePerItem
   *
   * @param path - Dot-separated path to the feature
   * @returns The feature flag value or null if not found
   */
  const getFeatureFlag = useCallback(<T = FeatureFlagValue>(path: string): T | null => {
    if (!featureFlags) return null;

    const parts = path.split('.');
    let current: any = featureFlags;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return null;
      }
      current = current[part];
    }

    return current as T;
  }, [featureFlags]);

  return useMemo(() => ({
    featureFlags,
    isFeatureEnabled,
    getFeatureFlag,
    loading,
    error,
    refetch: loadFeatureFlags,
  }), [featureFlags, isFeatureEnabled, getFeatureFlag, loading, error, loadFeatureFlags]);
}

/**
 * Feature flag paths for reference - matches backend middleware paths
 */
export const FEATURE_FLAG_PATHS = {
  // Extraction features
  STANDARD_EXTRACTION: 'standardExtraction',
  PREMIUM_EXTRACTION: 'premiumExtraction',

  // CSV features
  CSV_DOWNLOAD: 'csvDownload',
  CSV_WITH_IMAGES_DOWNLOAD: 'csvWithImagesDownload',

  // Image features
  IMAGE_UPLOAD_TO_CDN: 'imageUploadToCDN',
  IMAGE_ZIP_DOWNLOAD: 'imageZipDownload',

  // Logo features
  LOGO_EXTRACTION: 'logoExtraction',
  LOGO_PROCESSING: 'logoProcessing',

  // Branding features
  BRANDING_EXTRACTION: 'brandingExtraction',
  FIRECRAWL_BRANDING: 'brandingExtraction.firecrawlBranding',

  // Search features
  GOOGLE_SEARCH_EXTRACTION: 'googleSearchExtraction',
  PLATFORM_DETAILS_EXTRACTION: 'platformDetailsExtraction',

  // Lead scraping features
  LEAD_SCRAPING: 'leadScraping',
  LEAD_SCRAPING_JOBS: 'leadScraping.scrapeJobs',
  LEAD_SCRAPING_CONVERSION: 'leadScraping.leadConversion',
  LEAD_SCRAPING_ENRICHMENT: 'leadScraping.stepEnrichment',

  // Other features
  SOCIAL_MEDIA: 'socialMedia',
  TASKS_AND_SEQUENCES: 'tasksAndSequences',
  ANALYTICS: 'analytics',
  REGISTRATION_BATCHES: 'registrationBatches',

  // Registration features
  REGISTRATION: 'registration',
  REGISTRATION_USER_ACCOUNT: 'registration.userAccountRegistration',
  REGISTRATION_RESTAURANT: 'registration.restaurantRegistration',
  REGISTRATION_MENU_UPLOADING: 'registration.menuUploading',
  REGISTRATION_ITEM_TAGS: 'registration.itemTagUploading',
  REGISTRATION_OPTION_SETS: 'registration.optionSetUploading',
  REGISTRATION_SERVICES: 'registration.servicesConfiguration',
  REGISTRATION_STRIPE: 'registration.stripePayments',
  REGISTRATION_WEBSITE_SETTINGS: 'registration.websiteSettings',
  REGISTRATION_CODE_INJECTION: 'registration.codeInjection',
  REGISTRATION_FINALISING: 'registration.finalisingSetup',
  REGISTRATION_ONBOARDING_SYNC: 'registration.onboardingSync',
  REGISTRATION_ONBOARDING_USER_MGMT: 'registration.onboardingUserManagement',

  // Contact Details Extraction features
  CONTACT_DETAILS_EXTRACTION: 'contactDetailsExtraction',
  COMPANIES_OFFICE: 'contactDetailsExtraction.companiesOffice',
  EMAIL_PHONE_EXTRACTION: 'contactDetailsExtraction.emailPhoneExtraction',
} as const;

export type FeatureFlagPath = typeof FEATURE_FLAG_PATHS[keyof typeof FEATURE_FLAG_PATHS];
