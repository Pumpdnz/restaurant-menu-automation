/**
 * Usage Tracking Service
 *
 * Tracks billable usage events for organizations. Events are stored in the
 * usage_events table and can be used for invoicing and statistics.
 *
 * STRIPE INTEGRATION (Future):
 * When ready to integrate Stripe Billing Meters, add the following:
 * 1. Import stripe: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 * 2. Uncomment the recordToStripeMeter method
 * 3. Add STRIPE_BILLING_METER_ID to environment variables
 * 4. Ensure organisations have stripe_customer_id populated
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client with service role key for backend operations
const supabaseUrl = process.env.SUPABASE_URL || 'https://qgabsyggzlkcstjzugdh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Event type constants for consistency
 */
const UsageEventType = {
  // Original Extraction Events
  STANDARD_EXTRACTION: 'standard_extraction',
  PREMIUM_EXTRACTION: 'premium_extraction',
  LOGO_EXTRACTION: 'logo_extraction',
  LOGO_PROCESSING: 'logo_processing',
  GOOGLE_SEARCH: 'google_search',
  PLATFORM_DETAILS: 'platform_details',
  CSV_DOWNLOAD: 'csv_download',
  CSV_WITH_IMAGES_DOWNLOAD: 'csv_with_images_download',
  IMAGE_UPLOAD_JOB: 'image_upload_job',
  IMAGE_CDN_UPLOAD: 'image_cdn_upload',
  IMAGE_ZIP_DOWNLOAD: 'image_zip_download',
  IMAGE_DOWNLOAD: 'image_download',
  RESTAURANT_CREATED: 'restaurant_created',
  MENU_CREATED: 'menu_created',
  MENU_ITEM_EXTRACTED: 'menu_item_extracted',

  // Lead Scraping Events
  LEAD_SCRAPE_JOB_CREATED: 'lead_scrape_job_created',
  LEAD_SCRAPE_API_CALL: 'lead_scrape_api_call',
  LEAD_CONVERTED_TO_RESTAURANT: 'lead_converted_to_restaurant',

  // Branding Extraction Events
  FIRECRAWL_BRANDING_EXTRACTION: 'firecrawl_branding_extraction',

  // Contact Details Extraction Events
  COMPANIES_OFFICE_SEARCH: 'companies_office_search',
  COMPANIES_OFFICE_DETAIL: 'companies_office_detail',
  EMAIL_PHONE_EXTRACTION: 'email_phone_extraction',

  // Registration Events (tracking for future billing)
  REGISTRATION_USER_ACCOUNT: 'registration_user_account',
  REGISTRATION_RESTAURANT: 'registration_restaurant',
  REGISTRATION_MENU_UPLOAD: 'registration_menu_upload',
  REGISTRATION_ITEM_TAGS: 'registration_item_tags',
  REGISTRATION_OPTION_SETS: 'registration_option_sets',
  REGISTRATION_CODE_INJECTION: 'registration_code_injection',
  REGISTRATION_WEBSITE_SETTINGS: 'registration_website_settings',
  REGISTRATION_STRIPE_PAYMENTS: 'registration_stripe_payments',
  REGISTRATION_SERVICES_CONFIG: 'registration_services_config',
  REGISTRATION_ONBOARDING_USER: 'registration_onboarding_user',
  REGISTRATION_FINALIZE_SETUP: 'registration_finalize_setup',
  REGISTRATION_ONBOARDING_SYNC: 'registration_onboarding_sync'
};

/**
 * Default billing rates per event type (in dollars)
 * These can be overridden at the organization level via feature_flags
 */
const DEFAULT_BILLING_RATES = {
  [UsageEventType.STANDARD_EXTRACTION]: 0.10,
  [UsageEventType.PREMIUM_EXTRACTION]: 0.25,
  [UsageEventType.LOGO_EXTRACTION]: 0.15,
  [UsageEventType.LOGO_PROCESSING]: 0.20,
  [UsageEventType.GOOGLE_SEARCH]: 0.05,
  [UsageEventType.PLATFORM_DETAILS]: 0.05,
  [UsageEventType.CSV_DOWNLOAD]: 0.01,
  [UsageEventType.CSV_WITH_IMAGES_DOWNLOAD]: 0.02,
  [UsageEventType.IMAGE_CDN_UPLOAD]: 0.001,
  [UsageEventType.IMAGE_ZIP_DOWNLOAD]: 0.05,
  [UsageEventType.LEAD_SCRAPE_JOB_CREATED]: 1.00,
  [UsageEventType.LEAD_SCRAPE_API_CALL]: 0.05,
  [UsageEventType.LEAD_CONVERTED_TO_RESTAURANT]: 0.25,
  [UsageEventType.FIRECRAWL_BRANDING_EXTRACTION]: 0.20,
  // Contact Details Extraction
  [UsageEventType.COMPANIES_OFFICE_SEARCH]: 0.10,
  [UsageEventType.COMPANIES_OFFICE_DETAIL]: 0.05,
  [UsageEventType.EMAIL_PHONE_EXTRACTION]: 0.05,
  // Registration events - no charge for now
  [UsageEventType.REGISTRATION_USER_ACCOUNT]: 0.00,
  [UsageEventType.REGISTRATION_RESTAURANT]: 0.00,
  [UsageEventType.REGISTRATION_MENU_UPLOAD]: 0.00,
  [UsageEventType.REGISTRATION_ITEM_TAGS]: 0.00,
  [UsageEventType.REGISTRATION_OPTION_SETS]: 0.00,
  [UsageEventType.REGISTRATION_CODE_INJECTION]: 0.00,
  [UsageEventType.REGISTRATION_WEBSITE_SETTINGS]: 0.00,
  [UsageEventType.REGISTRATION_STRIPE_PAYMENTS]: 0.00,
  [UsageEventType.REGISTRATION_SERVICES_CONFIG]: 0.00,
  [UsageEventType.REGISTRATION_ONBOARDING_USER]: 0.00,
  [UsageEventType.REGISTRATION_FINALIZE_SETUP]: 0.00,
  [UsageEventType.REGISTRATION_ONBOARDING_SYNC]: 0.00
};

class UsageTrackingService {
  /**
   * Track a usage event
   * @param {string} organisationId - Organization UUID
   * @param {string} eventType - Type of event (use UsageEventType constants)
   * @param {number} quantity - Quantity (default 1)
   * @param {object} metadata - Additional metadata to store
   * @returns {Promise<object|null>} The created event or null on error
   */
  static async trackEvent(organisationId, eventType, quantity = 1, metadata = {}) {
    try {
      if (!organisationId) {
        console.warn('[UsageTracking] No organisation ID provided, skipping tracking');
        return null;
      }

      // Insert into database
      const { data, error } = await supabase
        .from('usage_events')
        .insert({
          organisation_id: organisationId,
          event_type: eventType,
          quantity: quantity,
          metadata: metadata
        })
        .select()
        .single();

      if (error) {
        console.error('[UsageTracking] Database insert failed:', error);
        throw error;
      }

      console.log(`[UsageTracking] Tracked ${eventType} for org ${organisationId}: ${quantity} units`);

      /*
       * STRIPE INTEGRATION (Future):
       * Uncomment the following when ready to integrate Stripe Billing Meters:
       *
       * if (process.env.STRIPE_BILLING_METER_ID) {
       *   await this.recordToStripeMeter(organisationId, eventType, quantity);
       * }
       */

      return data;
    } catch (error) {
      console.error('[UsageTracking] Failed to track usage event:', error);
      // Don't throw - we don't want tracking failures to break functionality
      return null;
    }
  }

  /*
   * STRIPE INTEGRATION (Future):
   * Uncomment this method when ready to integrate Stripe Billing Meters:
   *
   * static async recordToStripeMeter(organisationId, eventType, quantity) {
   *   try {
   *     // Get organization's Stripe customer ID
   *     const { data: org } = await supabase
   *       .from('organisations')
   *       .select('stripe_customer_id')
   *       .eq('id', organisationId)
   *       .single();
   *
   *     if (!org?.stripe_customer_id) {
   *       console.log('[UsageTracking] No Stripe customer ID for org:', organisationId);
   *       return;
   *     }
   *
   *     // Record usage to Stripe Billing Meter
   *     const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   *     await stripe.billing.meterEvents.create({
   *       event_name: process.env.STRIPE_BILLING_METER_EVENT_NAME || 'api_requests',
   *       payload: {
   *         stripe_customer_id: org.stripe_customer_id,
   *         value: quantity
   *       },
   *       identifier: `${organisationId}_${eventType}_${Date.now()}`,
   *       timestamp: Math.floor(Date.now() / 1000)
   *     });
   *
   *     console.log(`[UsageTracking] Recorded to Stripe meter: ${eventType} for customer ${org.stripe_customer_id}`);
   *   } catch (error) {
   *     console.error('[UsageTracking] Failed to record to Stripe meter:', error);
   *     // Don't throw - Stripe recording failure shouldn't break the app
   *   }
   * }
   */

  /**
   * Track a menu extraction with item count
   * @param {string} organisationId - Organization UUID
   * @param {string} extractionType - 'standard' or 'premium'
   * @param {number} itemCount - Number of menu items extracted
   * @param {object} metadata - Additional metadata
   */
  static async trackExtraction(organisationId, extractionType, itemCount, metadata = {}) {
    const eventType = extractionType === 'premium'
      ? UsageEventType.PREMIUM_EXTRACTION
      : UsageEventType.STANDARD_EXTRACTION;

    // Track the extraction itself
    await this.trackEvent(organisationId, eventType, 1, metadata);

    // Track the items extracted
    if (itemCount > 0) {
      await this.trackEvent(
        organisationId,
        UsageEventType.MENU_ITEM_EXTRACTED,
        itemCount,
        { ...metadata, extraction_type: extractionType }
      );
    }
  }

  /**
   * Track a CSV download
   * @param {string} organisationId - Organization UUID
   * @param {boolean} withImages - Whether the CSV includes images
   * @param {object} metadata - Additional metadata
   */
  static async trackCSVDownload(organisationId, withImages, metadata = {}) {
    const eventType = withImages
      ? UsageEventType.CSV_WITH_IMAGES_DOWNLOAD
      : UsageEventType.CSV_DOWNLOAD;

    await this.trackEvent(organisationId, eventType, 1, metadata);
  }

  /**
   * Track an image operation
   * @param {string} organisationId - Organization UUID
   * @param {string} operation - 'upload', 'download', 'zip', or 'upload_job'
   * @param {number} imageCount - Number of images (default 1)
   * @param {object} metadata - Additional metadata
   */
  static async trackImageOperation(organisationId, operation, imageCount = 1, metadata = {}) {
    const eventTypeMap = {
      'upload': UsageEventType.IMAGE_CDN_UPLOAD,
      'download': UsageEventType.IMAGE_DOWNLOAD,
      'zip': UsageEventType.IMAGE_ZIP_DOWNLOAD,
      'upload_job': UsageEventType.IMAGE_UPLOAD_JOB
    };

    const eventType = eventTypeMap[operation];
    if (eventType) {
      await this.trackEvent(organisationId, eventType, imageCount, metadata);
    }
  }

  /**
   * Track a logo extraction
   * @param {string} organisationId - Organization UUID
   * @param {boolean} wasProcessed - Whether logo processing was performed
   * @param {object} metadata - Additional metadata
   */
  static async trackLogoExtraction(organisationId, wasProcessed, metadata = {}) {
    await this.trackEvent(organisationId, UsageEventType.LOGO_EXTRACTION, 1, metadata);

    if (wasProcessed) {
      await this.trackEvent(organisationId, UsageEventType.LOGO_PROCESSING, 1, metadata);
    }
  }

  /**
   * Track a lead scraping API call
   * @param {string} organisationId - Organization UUID
   * @param {object} metadata - Must include job_id, step_number, and optionally lead_id
   */
  static async trackLeadScrapeApiCall(organisationId, metadata = {}) {
    await this.trackEvent(organisationId, UsageEventType.LEAD_SCRAPE_API_CALL, 1, metadata);
  }

  /**
   * Track lead scrape job creation
   * @param {string} organisationId - Organization UUID
   * @param {object} metadata - Should include job_id, platform, city_code
   */
  static async trackLeadScrapeJobCreated(organisationId, metadata = {}) {
    await this.trackEvent(organisationId, UsageEventType.LEAD_SCRAPE_JOB_CREATED, 1, metadata);
  }

  /**
   * Track leads converted to restaurants
   * @param {string} organisationId - Organization UUID
   * @param {number} count - Number of leads converted
   * @param {object} metadata - Should include lead_ids, restaurant_ids
   */
  static async trackLeadsConverted(organisationId, count, metadata = {}) {
    await this.trackEvent(organisationId, UsageEventType.LEAD_CONVERTED_TO_RESTAURANT, count, metadata);
  }

  /**
   * Track branding extraction
   * @param {string} organisationId - Organization UUID
   * @param {object} metadata - Should include url, restaurant_id
   */
  static async trackBrandingExtraction(organisationId, metadata = {}) {
    await this.trackEvent(organisationId, UsageEventType.FIRECRAWL_BRANDING_EXTRACTION, 1, metadata);
  }

  /**
   * Track contact details extraction
   * @param {string} organisationId - Organization UUID
   * @param {string} extractionType - 'companies_office_search', 'companies_office_detail', or 'email_phone'
   * @param {object} metadata - Should include restaurant_id, and optionally company_number, source_url
   */
  static async trackContactExtraction(organisationId, extractionType, metadata = {}) {
    const eventTypeMap = {
      'companies_office_search': UsageEventType.COMPANIES_OFFICE_SEARCH,
      'companies_office_detail': UsageEventType.COMPANIES_OFFICE_DETAIL,
      'email_phone': UsageEventType.EMAIL_PHONE_EXTRACTION
    };

    const eventType = eventTypeMap[extractionType];
    if (eventType) {
      await this.trackEvent(organisationId, eventType, 1, metadata);
    } else {
      console.warn(`[UsageTracking] Unknown contact extraction type: ${extractionType}`);
    }
  }

  /**
   * Track a registration step
   * @param {string} organisationId - Organization UUID
   * @param {string} step - Registration step name (e.g., 'menu_upload', 'user_account')
   * @param {object} metadata - Should include restaurant_id
   */
  static async trackRegistrationStep(organisationId, step, metadata = {}) {
    const stepMap = {
      'user_account': UsageEventType.REGISTRATION_USER_ACCOUNT,
      'restaurant': UsageEventType.REGISTRATION_RESTAURANT,
      'menu_upload': UsageEventType.REGISTRATION_MENU_UPLOAD,
      'item_tags': UsageEventType.REGISTRATION_ITEM_TAGS,
      'option_sets': UsageEventType.REGISTRATION_OPTION_SETS,
      'code_injection': UsageEventType.REGISTRATION_CODE_INJECTION,
      'website_settings': UsageEventType.REGISTRATION_WEBSITE_SETTINGS,
      'stripe_payments': UsageEventType.REGISTRATION_STRIPE_PAYMENTS,
      'services_config': UsageEventType.REGISTRATION_SERVICES_CONFIG,
      'onboarding_user': UsageEventType.REGISTRATION_ONBOARDING_USER,
      'finalize_setup': UsageEventType.REGISTRATION_FINALIZE_SETUP
    };

    const eventType = stepMap[step];
    if (eventType) {
      await this.trackEvent(organisationId, eventType, 1, metadata);
    } else {
      console.warn(`[UsageTracking] Unknown registration step: ${step}`);
    }
  }

  /**
   * Get usage statistics for an organization
   * @param {string} organisationId - Organization UUID (null for all orgs - super admin only)
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<object>} Usage statistics
   */
  static async getUsageStats(organisationId, startDate, endDate) {
    try {
      let query = supabase
        .from('usage_events')
        .select('event_type, quantity')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (organisationId) {
        query = query.eq('organisation_id', organisationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate by event type
      const stats = {};
      let totalCredits = 0;

      for (const event of data || []) {
        if (!stats[event.event_type]) {
          stats[event.event_type] = 0;
        }
        stats[event.event_type] += event.quantity;

        // Calculate credits
        const rate = DEFAULT_BILLING_RATES[event.event_type] || 0;
        totalCredits += event.quantity * rate;
      }

      return {
        events: stats,
        total_credits: Math.round(totalCredits * 100) / 100, // Round to 2 decimal places
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      };
    } catch (error) {
      console.error('[UsageTracking] Failed to get usage stats:', error);
      throw error;
    }
  }

  /**
   * Get detailed usage events for export/invoicing
   * @param {string} organisationId - Organization UUID
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<array>} Array of usage events
   */
  static async getUsageEvents(organisationId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('usage_events')
        .select('*')
        .eq('organisation_id', organisationId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[UsageTracking] Failed to get usage events:', error);
      throw error;
    }
  }
}

module.exports = {
  UsageTrackingService,
  UsageEventType,
  DEFAULT_BILLING_RATES
};
