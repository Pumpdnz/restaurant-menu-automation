# Super Admin Dashboard - Phase 4: Usage Statistics & Feature Flag Implementation

## Overview
Phase 4 implements comprehensive usage tracking, statistics dashboard with billing calculations, export functionality, and feature flag enforcement across **all platform features**. This phase covers:

1. **Original Extraction Features** - Menu extraction, logo extraction, CSV downloads, image operations
2. **Tasks & Sequences** - Feature flagging only (no tracking/billing)
3. **Social Media** - Feature flagging only (tracking/billing deferred to future phase)
4. **Lead Scraping** - Feature flagging + per-Firecrawl-API-call tracking + billing
5. **Branding Extraction** - Feature flagging + tracking + billing (Firecrawl branding format)
6. **Registration Features** - Feature flagging + tracking + rate structure for future billing

## Timeline
**Duration**: 4-5 Days (32-40 hours) - *Extended from original 2.5 days*
**Prerequisites**: Phases 1-3 completed
**Deliverable**: Full usage statistics dashboard with tracking, filtering, export capabilities, feature flag enforcement across all platform features, and UI integration for conditional feature visibility

## Architecture Overview

### Usage Tracking Flow
```
User Action → Feature Flag Check → API Endpoint → Track Usage Event → Store in DB → Display in Dashboard
                     ↓                    ↓                              ↓
                 403 if disabled    Stripe Meter Record           Billing Calculation → Export Reports
```

### Event Types to Track
```typescript
enum UsageEventType {
  // ============================================
  // ORIGINAL EXTRACTION EVENTS
  // ============================================

  // Extraction Events
  STANDARD_EXTRACTION = 'standard_extraction',
  PREMIUM_EXTRACTION = 'premium_extraction',

  // Logo Events
  LOGO_EXTRACTION = 'logo_extraction',
  LOGO_PROCESSING = 'logo_processing',

  // Search Events
  GOOGLE_SEARCH = 'google_search',
  PLATFORM_DETAILS = 'platform_details',

  // Export Events
  CSV_DOWNLOAD = 'csv_download',
  CSV_WITH_IMAGES_DOWNLOAD = 'csv_with_images_download',

  // Image Events
  IMAGE_UPLOAD_JOB = 'image_upload_job',
  IMAGE_CDN_UPLOAD = 'image_cdn_upload',
  IMAGE_ZIP_DOWNLOAD = 'image_zip_download',
  IMAGE_DOWNLOAD = 'image_download',

  // Restaurant/Menu Events
  RESTAURANT_CREATED = 'restaurant_created',
  MENU_CREATED = 'menu_created',
  MENU_ITEM_EXTRACTED = 'menu_item_extracted',

  // ============================================
  // NEW: LEAD SCRAPING EVENTS (billable)
  // ============================================
  LEAD_SCRAPE_JOB_CREATED = 'lead_scrape_job_created',
  LEAD_SCRAPE_API_CALL = 'lead_scrape_api_call',  // Per Firecrawl API call
  LEAD_CONVERTED_TO_RESTAURANT = 'lead_converted_to_restaurant',

  // ============================================
  // NEW: BRANDING EXTRACTION EVENTS (billable)
  // ============================================
  FIRECRAWL_BRANDING_EXTRACTION = 'firecrawl_branding_extraction',

  // ============================================
  // NEW: REGISTRATION EVENTS (tracking + future billing)
  // ============================================
  REGISTRATION_USER_ACCOUNT = 'registration_user_account',
  REGISTRATION_RESTAURANT = 'registration_restaurant',
  REGISTRATION_MENU_UPLOAD = 'registration_menu_upload',
  REGISTRATION_ITEM_TAGS = 'registration_item_tags',
  REGISTRATION_OPTION_SETS = 'registration_option_sets',
  REGISTRATION_CODE_INJECTION = 'registration_code_injection',
  REGISTRATION_WEBSITE_SETTINGS = 'registration_website_settings',
  REGISTRATION_STRIPE_PAYMENTS = 'registration_stripe_payments',
  REGISTRATION_SERVICES_CONFIG = 'registration_services_config',
  REGISTRATION_ONBOARDING_USER = 'registration_onboarding_user',
  REGISTRATION_FINALIZE_SETUP = 'registration_finalize_setup',

  // ============================================
  // NEW: SOCIAL MEDIA EVENTS (deferred - placeholder)
  // Tracking/billing to be added in future phase
  // ============================================
  // SOCIAL_VIDEO_GENERATION = 'social_video_generation',
  // SOCIAL_IMAGE_GENERATION = 'social_image_generation',
}
```

## Task Breakdown

### Task 1: Feature Flag Middleware Implementation (3 hours)

#### 1.1 Create Feature Flag Middleware
**File**: `/src/middleware/feature-flags.js`
```javascript
const checkFeatureFlag = (featureName) => {
  return async (req, res, next) => {
    try {
      const { supabase } = req;
      const organisationId = req.user?.organisationId;
      
      if (!organisationId) {
        return res.status(403).json({
          error: 'Organization not found',
          message: 'User must belong to an organization'
        });
      }

      // Get organization with feature flags
      const { data: org, error } = await supabase
        .from('organisations')
        .select('feature_flags, name')
        .eq('id', organisationId)
        .single();

      if (error || !org) {
        return res.status(403).json({
          error: 'Organization not found',
          message: 'Could not verify organization settings'
        });
      }

      // Check if feature is enabled
      const featureConfig = org.feature_flags?.[featureName];
      
      if (!featureConfig?.enabled) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `${featureName} is not enabled for ${org.name}`,
          feature: featureName,
          upgrade_required: true,
          contact_support: 'Please contact your administrator to enable this feature'
        });
      }

      // Add feature config to request for potential rate/limit checking
      req.featureConfig = featureConfig;
      next();
    } catch (error) {
      console.error('Feature flag check error:', error);
      res.status(500).json({
        error: 'Failed to verify feature access',
        message: error.message
      });
    }
  };
};

// Export individual feature checks for clarity
module.exports = {
  checkFeatureFlag,

  // Original extraction features
  requireStandardExtraction: checkFeatureFlag('standardExtraction'),
  requirePremiumExtraction: checkFeatureFlag('premiumExtraction'),
  requireLogoExtraction: checkFeatureFlag('logoExtraction'),
  requireGoogleSearch: checkFeatureFlag('googleSearch'),
  requirePlatformDetails: checkFeatureFlag('platformDetails'),
  requireCsvExport: checkFeatureFlag('csvExport'),
  requireImageDownload: checkFeatureFlag('imageDownload'),
  requireBulkOperations: checkFeatureFlag('bulkOperations'),

  // NEW: Tasks & Sequences (UI-only, no API blocking needed)
  requireTasksAndSequences: checkFeatureFlag('tasksAndSequences'),

  // NEW: Social Media (entire feature)
  requireSocialMedia: checkFeatureFlag('socialMedia'),

  // NEW: Lead Scraping
  requireLeadScraping: checkFeatureFlag('leadScraping'),

  // NEW: Branding Extraction
  requireBrandingExtraction: checkFeatureFlag('brandingExtraction'),

  // NEW: Registration Features (parent and individual steps)
  requireRegistration: checkFeatureFlag('registration'),
  requireRegistrationUserAccount: checkFeatureFlag('registration.userAccountRegistration'),
  requireRegistrationRestaurant: checkFeatureFlag('registration.restaurantRegistration'),
  requireRegistrationMenuUpload: checkFeatureFlag('registration.menuUploading'),
  requireRegistrationItemTags: checkFeatureFlag('registration.itemTagUploading'),
  requireRegistrationOptionSets: checkFeatureFlag('registration.optionSetUploading'),
  requireRegistrationCodeInjection: checkFeatureFlag('registration.codeInjection'),
  requireRegistrationWebsiteSettings: checkFeatureFlag('registration.websiteSettings'),
  requireRegistrationStripePayments: checkFeatureFlag('registration.stripePayments'),
  requireRegistrationServicesConfig: checkFeatureFlag('registration.servicesConfiguration'),
  requireRegistrationOnboardingUser: checkFeatureFlag('registration.onboardingUserManagement'),
  requireRegistrationFinalizeSetup: checkFeatureFlag('registration.finalisingSetup')
};
```

#### 1.2 Apply Feature Flags to Endpoints
**File**: `/server.js` (modifications to include feature flags)
```javascript
const {
  requireStandardExtraction,
  requirePremiumExtraction,
  requireLogoExtraction,
  requireGoogleSearch,
  requireCsvExport,
  requireImageDownload
} = require('./src/middleware/feature-flags');

// Standard extraction endpoints
app.post('/api/batch-extract-categories', 
  authMiddleware, 
  requireStandardExtraction,
  async (req, res) => {
    // Existing code...
    // After successful extraction, track usage
    if (result.success) {
      await UsageTrackingService.trackEvent(
        req.user.organisationId,
        'standard_extraction',
        1,
        { restaurant_id: result.restaurantId }
      );
    }
  }
);

// Premium extraction endpoints  
app.post('/api/extract-menu-premium',
  authMiddleware,
  requirePremiumExtraction,
  async (req, res) => {
    // Existing code...
    if (result.success) {
      await UsageTrackingService.trackEvent(
        req.user.organisationId,
        'premium_extraction',
        1,
        { restaurant_id: result.restaurantId }
      );
    }
  }
);

// Logo extraction
app.post('/api/website-extraction/logo',
  authMiddleware,
  requireLogoExtraction,
  async (req, res) => {
    // Existing code...
    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'logo_extraction',
      1,
      { restaurant_id: req.body.restaurantId }
    );
  }
);

// CSV Export
app.get('/api/menus/:id/csv',
  authMiddleware,
  requireCsvExport,
  async (req, res) => {
    // Existing code...
    await UsageTrackingService.trackCSVDownload(
      req.user.organisationId,
      false,
      { menu_id: req.params.id }
    );
  }
);

// Google Business Search
app.post('/api/google-business-search',
  authMiddleware,
  requireGoogleSearch,
  async (req, res) => {
    // Existing code...
    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'google_search',
      1,
      { query: req.body.query }
    );
  }
);
```

### Task 2: Enhanced Backend Usage Tracking with Stripe Integration (4 hours)

#### 2.1 Create Enhanced Usage Tracking Service
**File**: `/src/services/usage-tracking-service.js`
```javascript
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class UsageTrackingService {
  /**
   * Track a usage event and record to Stripe Billing Meter
   * @param {string} organisationId - Organization ID
   * @param {string} eventType - Type of event
   * @param {number} quantity - Quantity (default 1)
   * @param {object} metadata - Additional metadata
   */
  static async trackEvent(organisationId, eventType, quantity = 1, metadata = {}) {
    try {
      // First record in our database
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

      if (error) throw error;

      // Then record to Stripe Billing Meter (if configured)
      if (process.env.STRIPE_BILLING_METER_ID) {
        await this.recordToStripeMeter(organisationId, eventType, quantity);
      }

      console.log(`Tracked ${eventType} for org ${organisationId}: ${quantity} units`);
      return data;
    } catch (error) {
      console.error('Failed to track usage event:', error);
      // Don't throw - we don't want tracking failures to break functionality
      return null;
    }
  }

  /**
   * Record usage to Stripe Billing Meter
   */
  static async recordToStripeMeter(organisationId, eventType, quantity) {
    try {
      // Get organization's Stripe customer ID
      const { data: org } = await supabase
        .from('organisations')
        .select('stripe_customer_id')
        .eq('id', organisationId)
        .single();

      if (!org?.stripe_customer_id) {
        console.log('No Stripe customer ID for org:', organisationId);
        return;
      }

      // Record usage to Stripe Billing Meter
      await stripe.billing.meterEvents.create({
        event_name: process.env.STRIPE_BILLING_METER_EVENT_NAME || 'api_requests',
        payload: {
          stripe_customer_id: org.stripe_customer_id,
          value: quantity
        },
        identifier: `${organisationId}_${eventType}_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000)
      });

      console.log(`Recorded to Stripe meter: ${eventType} for customer ${org.stripe_customer_id}`);
    } catch (error) {
      console.error('Failed to record to Stripe meter:', error);
      // Don't throw - Stripe recording failure shouldn't break the app
    }
  }

  /**
   * Track extraction with items
   */
  static async trackExtraction(organisationId, extractionType, itemCount, metadata = {}) {
    const eventType = extractionType === 'premium' 
      ? 'premium_extraction' 
      : 'standard_extraction';
    
    // Track the extraction itself
    await this.trackEvent(organisationId, eventType, 1, metadata);
    
    // Track the items extracted
    if (itemCount > 0) {
      await this.trackEvent(
        organisationId, 
        'menu_item_extracted', 
        itemCount, 
        { ...metadata, extraction_type: extractionType }
      );
    }
  }

  /**
   * Track CSV download
   */
  static async trackCSVDownload(organisationId, withImages, metadata = {}) {
    const eventType = withImages 
      ? 'csv_with_images_download' 
      : 'csv_download';
    
    await this.trackEvent(organisationId, eventType, 1, metadata);
  }

  /**
   * Track image operations
   */
  static async trackImageOperation(organisationId, operation, imageCount = 1, metadata = {}) {
    const eventTypeMap = {
      'upload': 'image_cdn_upload',
      'download': 'image_download',
      'zip': 'image_zip_download',
      'upload_job': 'image_upload_job'
    };
    
    const eventType = eventTypeMap[operation];
    if (eventType) {
      await this.trackEvent(organisationId, eventType, imageCount, metadata);
    }
  }

  /**
   * Get usage statistics for an organization
   */
  static async getUsageStats(organisationId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .rpc('get_usage_statistics', {
          p_org_id: organisationId,
          p_start_date: startDate,
          p_end_date: endDate
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }
}

module.exports = { UsageTrackingService };
```

#### 2.2 Update Existing Endpoints with Tracking
**File**: `/server.js` (modifications to existing endpoints)
```javascript
const { UsageTrackingService } = require('./src/services/usage-tracking-service');

// Example: Update scrape batch endpoint
app.post('/api/scrape/batch', authMiddleware, async (req, res) => {
  try {
    const { urls, extractionType = 'standard' } = req.body;
    const organisationId = req.user.organisationId;
    
    // ... existing extraction logic ...
    
    // Track the extraction
    if (result.success) {
      await UsageTrackingService.trackExtraction(
        organisationId,
        extractionType,
        result.items?.length || 0,
        {
          restaurant_id: result.restaurantId,
          url: urls[0]
        }
      );
    }
    
    res.json(result);
  } catch (error) {
    // ... error handling ...
  }
});

// Example: Update CSV export endpoint
app.get('/api/export/csv/:menuId', authMiddleware, async (req, res) => {
  try {
    const { menuId } = req.params;
    const { includeImages } = req.query;
    const organisationId = req.user.organisationId;
    
    // ... existing export logic ...
    
    // Track the download
    await UsageTrackingService.trackCSVDownload(
      organisationId,
      includeImages === 'true',
      { menu_id: menuId }
    );
    
    res.send(csvData);
  } catch (error) {
    // ... error handling ...
  }
});

// Example: Update logo extraction endpoint
app.post('/api/extract/logo', authMiddleware, async (req, res) => {
  try {
    const { restaurantId, source } = req.body;
    const organisationId = req.user.organisationId;
    
    // ... existing logo extraction logic ...
    
    // Track logo extraction
    await UsageTrackingService.trackEvent(
      organisationId,
      'logo_extraction',
      1,
      { restaurant_id: restaurantId, source }
    );
    
    // If processing was done
    if (result.processed) {
      await UsageTrackingService.trackEvent(
        organisationId,
        'logo_processing',
        1,
        { restaurant_id: restaurantId }
      );
    }
    
    res.json(result);
  } catch (error) {
    // ... error handling ...
  }
});

// Add tracking to all other endpoints...
```

### Task 3: Database Functions for Statistics (2 hours)

#### 3.1 Create Comprehensive Statistics Function
**File**: Database migration
```sql
-- Migration: create_usage_statistics_function
CREATE OR REPLACE FUNCTION get_usage_statistics(
  p_org_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  -- Core Metrics
  total_credits_used NUMERIC,
  total_extractions BIGINT,
  
  -- Restaurant & Menu Metrics
  total_restaurants_created BIGINT,
  total_menu_extractions BIGINT,
  total_menu_items_extracted BIGINT,
  
  -- Standard Extraction Metrics
  total_standard_extractions BIGINT,
  total_standard_menu_items BIGINT,
  
  -- Premium Extraction Metrics
  total_premium_extractions BIGINT,
  total_premium_menu_items BIGINT,
  
  -- Logo Metrics
  total_logos_extracted BIGINT,
  total_logos_processed BIGINT,
  
  -- Search & Platform Metrics
  total_google_search_extractions BIGINT,
  total_platform_details_extractions BIGINT,
  
  -- CSV Export Metrics
  total_csv_downloads BIGINT,
  total_csv_without_images BIGINT,
  total_csv_with_images BIGINT,
  
  -- Image Metrics
  total_image_upload_jobs BIGINT,
  total_images_uploaded_to_cdn BIGINT,
  total_image_zip_downloads BIGINT,
  total_images_downloaded BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH event_counts AS (
    SELECT 
      event_type,
      SUM(quantity) as total_quantity
    FROM usage_events
    WHERE 
      (p_org_id IS NULL OR organisation_id = p_org_id)
      AND created_at >= p_start_date
      AND created_at <= p_end_date
    GROUP BY event_type
  ),
  metrics AS (
    SELECT
      -- Calculate total credits (sum of quantity * rate for each event type)
      COALESCE(
        (SELECT SUM(ec.total_quantity * 
          CASE ec.event_type
            WHEN 'standard_extraction' THEN 0.10
            WHEN 'premium_extraction' THEN 0.25
            WHEN 'logo_extraction' THEN 0.15
            WHEN 'logo_processing' THEN 0.20
            WHEN 'google_search' THEN 0.05
            WHEN 'platform_details' THEN 0.05
            WHEN 'csv_download' THEN 0.01
            WHEN 'csv_with_images_download' THEN 0.02
            WHEN 'image_cdn_upload' THEN 0.001
            WHEN 'image_zip_download' THEN 0.05
            ELSE 0
          END
        ) FROM event_counts ec), 0
      )::NUMERIC as total_credits_used,
      
      -- Total extractions (standard + premium)
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'standard_extraction'), 0) +
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'premium_extraction'), 0) as total_extractions,
      
      -- Individual metrics
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'restaurant_created'), 0) as total_restaurants_created,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'menu_created'), 0) as total_menu_extractions,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'menu_item_extracted'), 0) as total_menu_items_extracted,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'standard_extraction'), 0) as total_standard_extractions,
      COALESCE((SELECT SUM(quantity) FROM usage_events 
        WHERE event_type = 'menu_item_extracted' 
        AND metadata->>'extraction_type' = 'standard'
        AND (p_org_id IS NULL OR organisation_id = p_org_id)
        AND created_at >= p_start_date AND created_at <= p_end_date), 0) as total_standard_menu_items,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'premium_extraction'), 0) as total_premium_extractions,
      COALESCE((SELECT SUM(quantity) FROM usage_events 
        WHERE event_type = 'menu_item_extracted' 
        AND metadata->>'extraction_type' = 'premium'
        AND (p_org_id IS NULL OR organisation_id = p_org_id)
        AND created_at >= p_start_date AND created_at <= p_end_date), 0) as total_premium_menu_items,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'logo_extraction'), 0) as total_logos_extracted,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'logo_processing'), 0) as total_logos_processed,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'google_search'), 0) as total_google_search_extractions,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'platform_details'), 0) as total_platform_details_extractions,
      
      -- CSV metrics
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_download'), 0) +
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_with_images_download'), 0) as total_csv_downloads,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_download'), 0) as total_csv_without_images,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_with_images_download'), 0) as total_csv_with_images,
      
      -- Image metrics
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_upload_job'), 0) as total_image_upload_jobs,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_cdn_upload'), 0) as total_images_uploaded_to_cdn,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_zip_download'), 0) as total_image_zip_downloads,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_download'), 0) as total_images_downloaded
  )
  SELECT * FROM metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_usage_statistics TO authenticated;
```

#### 3.2 Create Organization Usage Summary Function
```sql
-- Migration: create_org_usage_summary_function
CREATE OR REPLACE FUNCTION get_organization_usage_summary(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  organisation_id UUID,
  organisation_name TEXT,
  total_credits NUMERIC,
  total_events BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as organisation_id,
    o.name as organisation_name,
    COALESCE(SUM(
      ue.quantity * 
      CASE ue.event_type
        WHEN 'standard_extraction' THEN 0.10
        WHEN 'premium_extraction' THEN 0.25
        WHEN 'logo_extraction' THEN 0.15
        WHEN 'logo_processing' THEN 0.20
        WHEN 'google_search' THEN 0.05
        WHEN 'platform_details' THEN 0.05
        WHEN 'csv_download' THEN 0.01
        WHEN 'csv_with_images_download' THEN 0.02
        WHEN 'image_cdn_upload' THEN 0.001
        WHEN 'image_zip_download' THEN 0.05
        ELSE 0
      END
    ), 0)::NUMERIC as total_credits,
    COUNT(ue.id) as total_events,
    MAX(ue.created_at) as last_activity
  FROM organisations o
  LEFT JOIN usage_events ue ON ue.organisation_id = o.id
    AND ue.created_at >= p_start_date
    AND ue.created_at <= p_end_date
  WHERE o.status = 'active'
  GROUP BY o.id, o.name
  ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 4: Frontend Usage Statistics Components (4 hours)

#### 4.1 Usage Statistics Main Component
**File**: `/src/components/super-admin/SuperAdminUsage.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Calendar, Download, Filter, RefreshCw } from 'lucide-react';
import { DatePickerWithRange } from '../ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { UsageStatsGrid } from './UsageStatsGrid';
import { UsageExporter } from './UsageExporter';
import { format } from 'date-fns';

interface UsageStats {
  total_credits_used: number;
  total_extractions: number;
  total_restaurants_created: number;
  total_menu_extractions: number;
  total_menu_items_extracted: number;
  total_standard_extractions: number;
  total_standard_menu_items: number;
  total_premium_extractions: number;
  total_premium_menu_items: number;
  total_logos_extracted: number;
  total_logos_processed: number;
  total_google_search_extractions: number;
  total_platform_details_extractions: number;
  total_csv_downloads: number;
  total_csv_without_images: number;
  total_csv_with_images: number;
  total_image_upload_jobs: number;
  total_images_uploaded_to_cdn: number;
  total_image_zip_downloads: number;
  total_images_downloaded: number;
}

interface Organization {
  id: string;
  name: string;
}

export function SuperAdminUsage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadUsageStats();
  }, [selectedOrg, dateRange]);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadUsageStats = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_usage_statistics', {
        p_org_id: selectedOrg === 'all' ? null : selectedOrg,
        p_start_date: dateRange.from.toISOString(),
        p_end_date: dateRange.to.toISOString()
      });

      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!stats) return;

    const exporter = new UsageExporter();
    const filename = `usage-stats-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}`;
    
    if (format === 'csv') {
      exporter.exportToCSV(stats, filename);
    } else {
      exporter.exportToJSON(stats, filename);
    }
  };

  const presetRanges = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 }
  ];

  const handlePresetRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    
    if (days === 0) {
      from.setHours(0, 0, 0, 0);
    } else if (days === 1) {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
    } else {
      from.setDate(from.getDate() - days);
    }
    
    setDateRange({ from, to });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Statistics</h2>
          <p className="text-gray-500">
            Track usage and calculate billing across organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadUsageStats()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={!stats}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={!stats}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Organization Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Organization</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <DatePickerWithRange
                from={dateRange.from}
                to={dateRange.to}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
              />
            </div>

            {/* Preset Ranges */}
            <div>
              <label className="text-sm font-medium mb-2 block">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {presetRanges.map(preset => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetRange(preset.days)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : stats ? (
        <UsageStatsGrid stats={stats} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No usage data available for the selected period
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### 4.2 Usage Statistics Grid Component
**File**: `/src/components/super-admin/UsageStatsGrid.tsx`
```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  FileText, 
  Download, 
  Image, 
  Search, 
  Package, 
  CreditCard,
  TrendingUp,
  Menu
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  cost?: number;
  category: string;
}

function StatCard({ title, value, icon, subtitle, cost, category }: StatCardProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const getCategoryColor = (cat: string) => {
    const colors = {
      'credits': 'bg-purple-50 text-purple-600',
      'extraction': 'bg-blue-50 text-blue-600',
      'restaurant': 'bg-green-50 text-green-600',
      'logo': 'bg-yellow-50 text-yellow-600',
      'search': 'bg-pink-50 text-pink-600',
      'export': 'bg-indigo-50 text-indigo-600',
      'image': 'bg-orange-50 text-orange-600'
    };
    return colors[cat] || 'bg-gray-50 text-gray-600';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{formatNumber(value)}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {cost !== undefined && (
            <p className="text-sm font-medium text-green-600">
              {formatCurrency(cost)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UsageStatsGridProps {
  stats: any; // Use the UsageStats interface from parent
}

export function UsageStatsGrid({ stats }: UsageStatsGridProps) {
  // Calculate costs based on default rates (these would come from org settings in production)
  const costs = {
    standard_extraction: stats.total_standard_extractions * 0.10,
    premium_extraction: stats.total_premium_extractions * 0.25,
    logo_extraction: stats.total_logos_extracted * 0.15,
    logo_processing: stats.total_logos_processed * 0.20,
    google_search: stats.total_google_search_extractions * 0.05,
    platform_details: stats.total_platform_details_extractions * 0.05,
    csv_download: stats.total_csv_without_images * 0.01,
    csv_with_images: stats.total_csv_with_images * 0.02,
    image_upload: stats.total_images_uploaded_to_cdn * 0.001,
    image_zip: stats.total_image_zip_downloads * 0.05
  };

  const statCards = [
    // Core Metrics
    {
      title: 'Total Credits Used',
      value: stats.total_credits_used,
      icon: <CreditCard className="h-4 w-4" />,
      category: 'credits',
      cost: stats.total_credits_used
    },
    {
      title: 'Total Extractions',
      value: stats.total_extractions,
      icon: <TrendingUp className="h-4 w-4" />,
      subtitle: `${stats.total_standard_extractions} standard, ${stats.total_premium_extractions} premium`,
      category: 'extraction'
    },

    // Restaurant & Menu Metrics
    {
      title: 'Restaurants Created',
      value: stats.total_restaurants_created,
      icon: <Package className="h-4 w-4" />,
      category: 'restaurant'
    },
    {
      title: 'Menu Extractions',
      value: stats.total_menu_extractions,
      icon: <Menu className="h-4 w-4" />,
      subtitle: `${stats.total_menu_items_extracted} total items`,
      category: 'extraction'
    },

    // Standard Extraction
    {
      title: 'Standard Extractions',
      value: stats.total_standard_extractions,
      icon: <FileText className="h-4 w-4" />,
      subtitle: `${stats.total_standard_menu_items} items`,
      cost: costs.standard_extraction,
      category: 'extraction'
    },

    // Premium Extraction
    {
      title: 'Premium Extractions',
      value: stats.total_premium_extractions,
      icon: <FileText className="h-4 w-4" />,
      subtitle: `${stats.total_premium_menu_items} items`,
      cost: costs.premium_extraction,
      category: 'extraction'
    },

    // Logo Metrics
    {
      title: 'Logos Extracted',
      value: stats.total_logos_extracted,
      icon: <Image className="h-4 w-4" />,
      cost: costs.logo_extraction,
      category: 'logo'
    },
    {
      title: 'Logos Processed',
      value: stats.total_logos_processed,
      icon: <Image className="h-4 w-4" />,
      cost: costs.logo_processing,
      category: 'logo'
    },

    // Search Metrics
    {
      title: 'Google Searches',
      value: stats.total_google_search_extractions,
      icon: <Search className="h-4 w-4" />,
      cost: costs.google_search,
      category: 'search'
    },
    {
      title: 'Platform Details',
      value: stats.total_platform_details_extractions,
      icon: <Search className="h-4 w-4" />,
      cost: costs.platform_details,
      category: 'search'
    },

    // CSV Metrics
    {
      title: 'Total CSV Downloads',
      value: stats.total_csv_downloads,
      icon: <Download className="h-4 w-4" />,
      subtitle: `${stats.total_csv_without_images} plain, ${stats.total_csv_with_images} with images`,
      category: 'export'
    },

    // Image Metrics
    {
      title: 'Image Upload Jobs',
      value: stats.total_image_upload_jobs,
      icon: <Image className="h-4 w-4" />,
      subtitle: `${stats.total_images_uploaded_to_cdn} images uploaded`,
      category: 'image'
    },
    {
      title: 'Image ZIP Downloads',
      value: stats.total_image_zip_downloads,
      icon: <Download className="h-4 w-4" />,
      cost: costs.image_zip,
      category: 'image'
    },
    {
      title: 'Individual Image Downloads',
      value: stats.total_images_downloaded,
      icon: <Image className="h-4 w-4" />,
      category: 'image'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {statCards.map((card, index) => (
        <StatCard key={index} {...card} />
      ))}
    </div>
  );
}
```

#### 4.3 Usage Export Utility
**File**: `/src/components/super-admin/UsageExporter.ts`
```typescript
export class UsageExporter {
  /**
   * Export usage statistics to CSV
   */
  exportToCSV(stats: any, filename: string) {
    const headers = [
      'Metric',
      'Value',
      'Rate',
      'Cost'
    ];

    const rows = [
      ['Total Credits Used', stats.total_credits_used, '-', stats.total_credits_used],
      ['Total Extractions', stats.total_extractions, '-', '-'],
      ['Restaurants Created', stats.total_restaurants_created, '-', '-'],
      ['Menu Extractions', stats.total_menu_extractions, '-', '-'],
      ['Menu Items Extracted', stats.total_menu_items_extracted, '-', '-'],
      ['Standard Extractions', stats.total_standard_extractions, '$0.10', stats.total_standard_extractions * 0.10],
      ['Standard Menu Items', stats.total_standard_menu_items, '-', '-'],
      ['Premium Extractions', stats.total_premium_extractions, '$0.25', stats.total_premium_extractions * 0.25],
      ['Premium Menu Items', stats.total_premium_menu_items, '-', '-'],
      ['Logos Extracted', stats.total_logos_extracted, '$0.15', stats.total_logos_extracted * 0.15],
      ['Logos Processed', stats.total_logos_processed, '$0.20', stats.total_logos_processed * 0.20],
      ['Google Search Extractions', stats.total_google_search_extractions, '$0.05', stats.total_google_search_extractions * 0.05],
      ['Platform Details Extractions', stats.total_platform_details_extractions, '$0.05', stats.total_platform_details_extractions * 0.05],
      ['CSV Downloads (Total)', stats.total_csv_downloads, '-', '-'],
      ['CSV Downloads (Without Images)', stats.total_csv_without_images, '$0.01', stats.total_csv_without_images * 0.01],
      ['CSV Downloads (With Images)', stats.total_csv_with_images, '$0.02', stats.total_csv_with_images * 0.02],
      ['Image Upload Jobs', stats.total_image_upload_jobs, '-', '-'],
      ['Images Uploaded to CDN', stats.total_images_uploaded_to_cdn, '$0.001', stats.total_images_uploaded_to_cdn * 0.001],
      ['Image ZIP Downloads', stats.total_image_zip_downloads, '$0.05', stats.total_image_zip_downloads * 0.05],
      ['Individual Image Downloads', stats.total_images_downloaded, '-', '-']
    ];

    // Calculate total cost
    const totalCost = rows.reduce((sum, row) => {
      const cost = row[3];
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);

    // Add total row
    rows.push(['', '', '', '']);
    rows.push(['TOTAL COST', '', '', totalCost]);

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' ? `"${cell}"` : cell
      ).join(','))
    ].join('\n');

    // Download
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  }

  /**
   * Export usage statistics to JSON
   */
  exportToJSON(stats: any, filename: string) {
    const exportData = {
      ...stats,
      billing_summary: {
        standard_extraction_cost: stats.total_standard_extractions * 0.10,
        premium_extraction_cost: stats.total_premium_extractions * 0.25,
        logo_extraction_cost: stats.total_logos_extracted * 0.15,
        logo_processing_cost: stats.total_logos_processed * 0.20,
        google_search_cost: stats.total_google_search_extractions * 0.05,
        platform_details_cost: stats.total_platform_details_extractions * 0.05,
        csv_download_cost: stats.total_csv_without_images * 0.01,
        csv_with_images_cost: stats.total_csv_with_images * 0.02,
        image_upload_cost: stats.total_images_uploaded_to_cdn * 0.001,
        image_zip_cost: stats.total_image_zip_downloads * 0.05,
        total_cost: stats.total_credits_used
      },
      export_timestamp: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    this.downloadFile(jsonContent, `${filename}.json`, 'application/json');
  }

  /**
   * Helper to download a file
   */
  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
```

### Task 5: API Endpoints for Usage Statistics (2 hours)

#### 5.1 Super Admin Usage API Endpoints
**File**: `/server.js` (additions)
```javascript
// Usage Statistics Endpoints
app.get('/api/super-admin/usage/statistics', superAdminMiddleware, async (req, res) => {
  try {
    const { org_id, start_date, end_date } = req.query;
    
    const { data, error } = await supabase.rpc('get_usage_statistics', {
      p_org_id: org_id || null,
      p_start_date: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: end_date || new Date().toISOString()
    });

    if (error) throw error;
    res.json(data[0] || {});
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

app.get('/api/super-admin/usage/organization-summary', superAdminMiddleware, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const { data, error } = await supabase.rpc('get_organization_usage_summary', {
      p_start_date: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: end_date || new Date().toISOString()
    });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching organization summary:', error);
    res.status(500).json({ error: 'Failed to fetch organization summary' });
  }
});

// Manual usage event tracking (for testing)
app.post('/api/super-admin/usage/track', superAdminMiddleware, async (req, res) => {
  try {
    const { organisation_id, event_type, quantity, metadata } = req.body;
    
    const result = await UsageTrackingService.trackEvent(
      organisation_id,
      event_type,
      quantity,
      metadata
    );
    
    res.json({ success: true, event: result });
  } catch (error) {
    console.error('Error tracking usage event:', error);
    res.status(500).json({ error: 'Failed to track usage event' });
  }
});
```

### Task 6: Integration and Testing (3 hours)

#### 6.1 Update Existing Extraction Endpoints
Create a comprehensive list of all endpoints that need tracking:

**Endpoints to Update**:
1. `/api/scrape/batch` - Track standard/premium extractions
2. `/api/scrape/single` - Track single extractions
3. `/api/export/csv/:menuId` - Track CSV downloads
4. `/api/export/images/:menuId` - Track image downloads
5. `/api/images/upload-to-cdn` - Track CDN uploads
6. `/api/images/download-zip` - Track ZIP downloads
7. `/api/extract/logo` - Track logo extraction
8. `/api/process/logo` - Track logo processing
9. `/api/search/google` - Track Google searches
10. `/api/search/platform-details` - Track platform details
11. `/api/restaurants/create` - Track restaurant creation
12. `/api/menus/create` - Track menu creation

---

## NEW FEATURE SECTIONS

### Task 7: Tasks & Sequences Feature Flagging (3 hours)

#### 7.1 Overview
Tasks & Sequences is a UI-only feature flag - no usage tracking or billing required.
When disabled for an organization:
- Hide Tasks and Sequences pages from navigation sidebar
- Filter out sales-related columns on Restaurants page
- Hide Tasks/Sequences tab on RestaurantDetail page
- Hide Sales information card on RestaurantDetail Overview tab

#### 7.2 Feature Flag Hook
**File**: `/src/hooks/useFeatureFlags.ts`
```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface FeatureFlags {
  // Original features
  standardExtraction: { enabled: boolean; ratePerItem: number };
  premiumExtraction: { enabled: boolean; ratePerItem: number };
  logoExtraction: { enabled: boolean; ratePerItem: number };
  // ... other original features

  // NEW: Tasks & Sequences (no rate)
  tasksAndSequences: { enabled: boolean };

  // NEW: Social Media (no tracking for now)
  socialMedia: { enabled: boolean };

  // NEW: Lead Scraping
  leadScraping: {
    enabled: boolean;
    scrapeJobs: { enabled: boolean; ratePerItem: number };
    stepEnrichment: { enabled: boolean; ratePerItem: number };
    leadConversion: { enabled: boolean; ratePerItem: number };
  };

  // NEW: Branding Extraction
  brandingExtraction: {
    enabled: boolean;
    firecrawlBranding: { enabled: boolean; ratePerItem: number };
  };

  // NEW: Registration Features
  registration: {
    enabled: boolean;
    userAccountRegistration: { enabled: boolean; ratePerItem: number };
    restaurantRegistration: { enabled: boolean; ratePerItem: number };
    menuUploading: { enabled: boolean; ratePerItem: number };
    itemTagUploading: { enabled: boolean; ratePerItem: number };
    optionSetUploading: { enabled: boolean; ratePerItem: number };
    codeInjection: { enabled: boolean; ratePerItem: number };
    websiteSettings: { enabled: boolean; ratePerItem: number };
    stripePayments: { enabled: boolean; ratePerItem: number };
    servicesConfiguration: { enabled: boolean; ratePerItem: number };
    onboardingUserManagement: { enabled: boolean; ratePerItem: number };
    finalisingSetup: { enabled: boolean; ratePerItem: number };
  };
}

export function useFeatureFlags() {
  const { user, profile } = useAuth();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organisation_id) {
      loadFeatureFlags(profile.organisation_id);
    }
  }, [profile?.organisation_id]);

  const loadFeatureFlags = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('feature_flags')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      setFeatureFlags(data?.feature_flags || null);
    } catch (error) {
      console.error('Error loading feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if a feature is enabled
   * @param featurePath - Dot notation path like 'tasksAndSequences' or 'registration.menuUploading'
   */
  const isFeatureEnabled = (featurePath: string): boolean => {
    if (!featureFlags) return false;

    const parts = featurePath.split('.');
    let current: any = featureFlags;

    for (const part of parts) {
      if (current[part] === undefined) return false;
      current = current[part];
    }

    // Handle both { enabled: true } and direct boolean
    return typeof current === 'boolean' ? current : current?.enabled === true;
  };

  return { featureFlags, loading, isFeatureEnabled };
}
```

#### 7.3 Update Navigation Sidebar
**File**: `/src/components/layout/Sidebar.tsx` (or equivalent)
```typescript
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export function Sidebar() {
  const { isFeatureEnabled, loading } = useFeatureFlags();

  // Don't render until flags are loaded
  if (loading) return <SidebarSkeleton />;

  return (
    <nav>
      {/* Always visible items */}
      <SidebarItem href="/dashboard" icon={Home}>Dashboard</SidebarItem>
      <SidebarItem href="/restaurants" icon={Store}>Restaurants</SidebarItem>

      {/* Tasks & Sequences - conditionally rendered */}
      {isFeatureEnabled('tasksAndSequences') && (
        <>
          <SidebarItem href="/tasks" icon={CheckSquare}>Tasks</SidebarItem>
          <SidebarItem href="/sequences" icon={ListTree}>Sequences</SidebarItem>
        </>
      )}

      {/* Social Media - conditionally rendered */}
      {isFeatureEnabled('socialMedia') && (
        <SidebarItem href="/social-media" icon={Share2}>Social Media</SidebarItem>
      )}

      {/* Lead Scraping - conditionally rendered */}
      {isFeatureEnabled('leadScraping') && (
        <SidebarItem href="/lead-scrapes" icon={Search}>Lead Scraping</SidebarItem>
      )}

      {/* Settings always visible */}
      <SidebarItem href="/settings" icon={Settings}>Settings</SidebarItem>
    </nav>
  );
}
```

#### 7.4 Update Restaurants Page Column Filtering
**File**: `/src/pages/Restaurants.jsx` (modifications)
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';

export function Restaurants() {
  const { isFeatureEnabled } = useFeatureFlags();
  const showSalesColumns = isFeatureEnabled('tasksAndSequences');

  // Filter columns based on feature flag
  const columns = useMemo(() => {
    const baseColumns = [
      { key: 'name', header: 'Name', ... },
      { key: 'platform', header: 'Platform', ... },
      { key: 'location', header: 'Location', ... },
      { key: 'status', header: 'Status', ... },
      // ... other always-visible columns
    ];

    if (showSalesColumns) {
      baseColumns.push(
        { key: 'lead_type', header: 'Lead Type', ... },
        { key: 'lead_category', header: 'Lead Category', ... },
        { key: 'lead_status', header: 'Lead Status', ... },
        { key: 'warmth', header: 'Warmth', ... },
        { key: 'stage', header: 'Stage', ... },
        { key: 'tasks', header: 'Tasks', ... },
        { key: 'icp_rating', header: 'ICP Rating', ... },
        { key: 'last_contact', header: 'Last Contact', ... }
      );
    }

    return baseColumns;
  }, [showSalesColumns]);

  // Filter options based on feature flag
  const filterOptions = useMemo(() => {
    const baseFilters = ['search'];

    if (showSalesColumns) {
      baseFilters.push(
        'lead_type', 'lead_category', 'lead_status',
        'warmth', 'stage', 'icp_rating'
      );
    }

    return baseFilters;
  }, [showSalesColumns]);

  // ... rest of component
}
```

#### 7.5 Update RestaurantDetail Page
**File**: `/src/pages/RestaurantDetail.jsx` (modifications)
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';

export function RestaurantDetail() {
  const { isFeatureEnabled } = useFeatureFlags();
  const showTasksSequences = isFeatureEnabled('tasksAndSequences');
  const showRegistration = isFeatureEnabled('registration');

  return (
    <Tabs>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="menu">Menu</TabsTrigger>
        <TabsTrigger value="gathering-info">Gathering Info</TabsTrigger>

        {/* Conditionally show Tasks & Sequences tab */}
        {showTasksSequences && (
          <TabsTrigger value="tasks-sequences">Tasks & Sequences</TabsTrigger>
        )}

        {/* Conditionally show Registration tab */}
        {showRegistration && (
          <TabsTrigger value="registration">Registration</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview">
        {/* Only show Sales Info card if feature enabled */}
        {showTasksSequences && <SalesInfoCard restaurant={restaurant} />}
        <GeneralInfoCard restaurant={restaurant} />
        {/* ... other cards */}
      </TabsContent>

      {/* ... other tab contents */}
    </Tabs>
  );
}
```

---

### Task 8: Lead Scraping Feature Flagging & Usage Tracking (4 hours)

#### 8.1 Overview
Lead Scraping requires:
- Feature flag to enable/disable entire feature
- Usage tracking at Firecrawl API call level (most granular)
- Billing for: scrape jobs, per-API-call enrichment, lead conversions

#### 8.2 Apply Feature Flags to Lead Scraping Routes
**File**: `/src/routes/lead-scrape-routes.js` (modifications)
```javascript
const { requireLeadScraping } = require('../middleware/feature-flags');
const { UsageTrackingService } = require('../services/usage-tracking-service');

// All lead scrape routes require feature flag
router.use(requireLeadScraping);

// Create lead scrape job
router.post('/lead-scrape-jobs', async (req, res) => {
  try {
    const { supabase, user } = req;
    const result = await LeadScrapeService.createJob(req.body, user.organisationId);

    // Track job creation
    await UsageTrackingService.trackEvent(
      user.organisationId,
      'lead_scrape_job_created',
      1,
      {
        job_id: result.id,
        platform: req.body.platform,
        city_code: req.body.city_code
      }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert leads to restaurants
router.post('/leads/convert', async (req, res) => {
  try {
    const { supabase, user } = req;
    const { lead_ids } = req.body;

    const result = await LeadScrapeService.convertLeads(lead_ids, user.organisationId);

    // Track each conversion
    await UsageTrackingService.trackEvent(
      user.organisationId,
      'lead_converted_to_restaurant',
      result.converted_count,
      {
        lead_ids: lead_ids,
        restaurant_ids: result.restaurant_ids
      }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 8.3 Track Firecrawl API Calls in Lead Scraping Service
**File**: `/src/services/lead-scrape-firecrawl-service.js` (modifications)
```javascript
const { UsageTrackingService } = require('./usage-tracking-service');

class LeadScrapeFirecrawlService {
  /**
   * Wrapper for Firecrawl API calls that tracks usage
   */
  static async callFirecrawlWithTracking(organisationId, method, params, metadata = {}) {
    try {
      // Make the actual Firecrawl API call
      const result = await this.firecrawl[method](params);

      // Track the API call
      await UsageTrackingService.trackEvent(
        organisationId,
        'lead_scrape_api_call',
        1,
        {
          method: method,
          step_number: metadata.step_number,
          job_id: metadata.job_id,
          lead_id: metadata.lead_id,
          url: params.url || params.urls?.[0]
        }
      );

      return result;
    } catch (error) {
      console.error('Firecrawl API call failed:', error);
      throw error;
    }
  }

  /**
   * Process Step 1: Category Page Scan
   */
  static async processStep1(job, step, organisationId) {
    const results = [];

    for (const url of job.urls) {
      // Use tracked wrapper instead of direct call
      const data = await this.callFirecrawlWithTracking(
        organisationId,
        'scrape',
        { url, formats: ['markdown', 'json'] },
        { step_number: 1, job_id: job.id }
      );

      results.push(...this.parseRestaurantListings(data));
    }

    return results;
  }

  /**
   * Process Step 2: Store Page Enrichment
   */
  static async processStep2(leads, job, step, organisationId) {
    for (const lead of leads) {
      const data = await this.callFirecrawlWithTracking(
        organisationId,
        'scrape',
        { url: lead.store_url, formats: ['markdown', 'json'] },
        { step_number: 2, job_id: job.id, lead_id: lead.id }
      );

      await this.updateLeadWithStoreData(lead.id, data);
    }
  }

  /**
   * Process Step 3: Google Business Lookup
   */
  static async processStep3(leads, job, step, organisationId) {
    for (const lead of leads) {
      const data = await this.callFirecrawlWithTracking(
        organisationId,
        'search',
        { query: `${lead.name} ${lead.location} business hours phone` },
        { step_number: 3, job_id: job.id, lead_id: lead.id }
      );

      await this.updateLeadWithBusinessData(lead.id, data);
    }
  }

  /**
   * Process Step 4: Social Media Discovery
   */
  static async processStep4(leads, job, step, organisationId) {
    for (const lead of leads) {
      const data = await this.callFirecrawlWithTracking(
        organisationId,
        'search',
        { query: `${lead.name} ${lead.location} instagram facebook` },
        { step_number: 4, job_id: job.id, lead_id: lead.id }
      );

      await this.updateLeadWithSocialData(lead.id, data);
    }
  }

  /**
   * Process Step 5: Contact Enrichment
   */
  static async processStep5(leads, job, step, organisationId) {
    for (const lead of leads) {
      if (lead.website_url) {
        const data = await this.callFirecrawlWithTracking(
          organisationId,
          'scrape',
          { url: lead.website_url, formats: ['markdown', 'json'] },
          { step_number: 5, job_id: job.id, lead_id: lead.id }
        );

        await this.updateLeadWithContactData(lead.id, data);
      }
    }
  }
}

module.exports = { LeadScrapeFirecrawlService };
```

---

### Task 9: Branding Extraction Feature Flagging & Usage Tracking (2 hours)

#### 9.1 Overview
Branding Extraction (Firecrawl branding format) requires:
- Feature flag to enable/disable
- Keep existing env variable as override
- Usage tracking per branding extraction
- Billing per extraction

#### 9.2 Apply Feature Flag to Branding Extraction
**File**: `/src/services/logo-extraction-service.js` (modifications)
```javascript
const { UsageTrackingService } = require('./usage-tracking-service');

class LogoExtractionService {
  /**
   * Extract logo candidates using Firecrawl branding format
   */
  static async extractLogoCandidatesWithFirecrawl(url, organisationId, options = {}) {
    try {
      // Check if feature is enabled (env var OR feature flag)
      const envEnabled = process.env.USE_FIRECRAWL_BRANDING_FORMAT === 'true';
      const featureFlagEnabled = await this.checkFeatureFlag(organisationId, 'brandingExtraction.firecrawlBranding');

      if (!envEnabled && !featureFlagEnabled) {
        throw new Error('Firecrawl branding extraction is not enabled');
      }

      // Perform the extraction
      const result = await this.firecrawl.scrape({
        url,
        formats: ['branding', 'json'],
        // ... extraction config
      });

      // Track usage
      await UsageTrackingService.trackEvent(
        organisationId,
        'firecrawl_branding_extraction',
        1,
        {
          url: url,
          restaurant_id: options.restaurantId,
          candidates_found: result.candidates?.length || 0
        }
      );

      return result;
    } catch (error) {
      console.error('Branding extraction failed:', error);
      throw error;
    }
  }

  /**
   * Check if a feature flag is enabled for an organization
   */
  static async checkFeatureFlag(organisationId, featurePath) {
    const { data } = await supabase
      .from('organisations')
      .select('feature_flags')
      .eq('id', organisationId)
      .single();

    if (!data?.feature_flags) return false;

    const parts = featurePath.split('.');
    let current = data.feature_flags;

    for (const part of parts) {
      if (current[part] === undefined) return false;
      current = current[part];
    }

    return current?.enabled === true;
  }
}

module.exports = { LogoExtractionService };
```

---

### Task 10: Registration Features Flagging & Tracking (4 hours)

#### 10.1 Overview
Registration Features require:
- Feature flag for entire tab
- Feature flag for each individual step
- Usage tracking for each step (for monitoring, future billing)
- Rate structure added now for future billing enablement

#### 10.2 Apply Feature Flags to Registration Routes
**File**: `/src/routes/registration-routes.js` (modifications)
```javascript
const {
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
  requireRegistrationFinalizeSetup
} = require('../middleware/feature-flags');
const { UsageTrackingService } = require('../services/usage-tracking-service');

// All registration routes require base feature flag
router.use(requireRegistration);

// User Account Registration
router.post('/register-user', requireRegistrationUserAccount, async (req, res) => {
  try {
    const result = await RegistrationService.registerUser(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_user_account',
      1,
      { restaurant_id: req.body.restaurant_id, email: req.body.email }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restaurant Registration
router.post('/register-restaurant', requireRegistrationRestaurant, async (req, res) => {
  try {
    const result = await RegistrationService.registerRestaurant(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_restaurant',
      1,
      { restaurant_id: req.body.restaurant_id }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Menu Upload
router.post('/upload-menu', requireRegistrationMenuUpload, async (req, res) => {
  try {
    const result = await RegistrationService.uploadMenu(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_menu_upload',
      1,
      { restaurant_id: req.body.restaurant_id, item_count: result.item_count }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Item Tags
router.post('/add-item-tags', requireRegistrationItemTags, async (req, res) => {
  try {
    const result = await RegistrationService.addItemTags(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_item_tags',
      1,
      { restaurant_id: req.body.restaurant_id, tag_count: result.tag_count }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Option Sets
router.post('/add-option-sets', requireRegistrationOptionSets, async (req, res) => {
  try {
    const result = await RegistrationService.addOptionSets(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_option_sets',
      1,
      { restaurant_id: req.body.restaurant_id, option_set_count: result.option_set_count }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Code Injection
router.post('/generate-code-injection', requireRegistrationCodeInjection, async (req, res) => {
  try {
    const result = await RegistrationService.generateCodeInjection(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_code_injection',
      1,
      { restaurant_id: req.body.restaurant_id }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Website Settings
router.post('/configure-website', requireRegistrationWebsiteSettings, async (req, res) => {
  try {
    const result = await RegistrationService.configureWebsite(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_website_settings',
      1,
      { restaurant_id: req.body.restaurant_id }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe Payments
router.post('/configure-stripe', requireRegistrationStripePayments, async (req, res) => {
  try {
    const result = await RegistrationService.configureStripe(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_stripe_payments',
      1,
      { restaurant_id: req.body.restaurant_id }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Services Configuration
router.post('/configure-services', requireRegistrationServicesConfig, async (req, res) => {
  try {
    const result = await RegistrationService.configureServices(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_services_config',
      1,
      { restaurant_id: req.body.restaurant_id }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Onboarding User
router.post('/create-onboarding-user', requireRegistrationOnboardingUser, async (req, res) => {
  try {
    const result = await RegistrationService.createOnboardingUser(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_onboarding_user',
      1,
      { restaurant_id: req.body.restaurant_id, user_email: req.body.email }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Finalize Setup
router.post('/finalize-setup', requireRegistrationFinalizeSetup, async (req, res) => {
  try {
    const result = await RegistrationService.finalizeSetup(req.body);

    await UsageTrackingService.trackEvent(
      req.user.organisationId,
      'registration_finalize_setup',
      1,
      { restaurant_id: req.body.restaurant_id }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### 10.3 Update RestaurantDetail Registration Tab UI
**File**: `/src/pages/RestaurantDetail.jsx` (modifications to Registration tab)
```javascript
// Inside Registration tab content
{isFeatureEnabled('registration') && (
  <TabsContent value="registration">
    <div className="space-y-4">
      {/* User Account Registration */}
      {isFeatureEnabled('registration.userAccountRegistration') && (
        <UserAccountRegistrationStep restaurant={restaurant} />
      )}

      {/* Restaurant Registration */}
      {isFeatureEnabled('registration.restaurantRegistration') && (
        <RestaurantRegistrationStep restaurant={restaurant} />
      )}

      {/* Menu Upload */}
      {isFeatureEnabled('registration.menuUploading') && (
        <MenuUploadStep restaurant={restaurant} />
      )}

      {/* Item Tags */}
      {isFeatureEnabled('registration.itemTagUploading') && (
        <ItemTagsStep restaurant={restaurant} />
      )}

      {/* Option Sets */}
      {isFeatureEnabled('registration.optionSetUploading') && (
        <OptionSetsStep restaurant={restaurant} />
      )}

      {/* Code Injection */}
      {isFeatureEnabled('registration.codeInjection') && (
        <CodeInjectionStep restaurant={restaurant} />
      )}

      {/* Website Settings */}
      {isFeatureEnabled('registration.websiteSettings') && (
        <WebsiteSettingsStep restaurant={restaurant} />
      )}

      {/* Stripe Payments */}
      {isFeatureEnabled('registration.stripePayments') && (
        <StripePaymentsStep restaurant={restaurant} />
      )}

      {/* Services Configuration */}
      {isFeatureEnabled('registration.servicesConfiguration') && (
        <ServicesConfigStep restaurant={restaurant} />
      )}

      {/* Onboarding User Management */}
      {isFeatureEnabled('registration.onboardingUserManagement') && (
        <OnboardingUserStep restaurant={restaurant} />
      )}

      {/* Finalize Setup */}
      {isFeatureEnabled('registration.finalisingSetup') && (
        <FinalizeSetupStep restaurant={restaurant} />
      )}
    </div>
  </TabsContent>
)}
```

---

### Task 11: Social Media Feature Flagging (1 hour)

#### 11.1 Overview
Social Media feature flagging only - no usage tracking or billing for now.
The entire feature is hidden when disabled.

**Note**: Video and image generation tracking/billing will be added in a future phase.

#### 11.2 Apply Feature Flag to Social Media Routes
**File**: `/src/routes/social-media-routes.js` (modifications)
```javascript
const { requireSocialMedia } = require('../middleware/feature-flags');

// All social media routes require feature flag
router.use(requireSocialMedia);

// Existing routes remain unchanged for now
// Usage tracking to be added in future phase
```

#### 11.3 Update Navigation
Already handled in Task 7.3 Sidebar component.

---

### Task 12: Update Database Schema for New Feature Flags (2 hours)

#### 12.1 Migration: Update Default Feature Flags
```sql
-- Migration: update_default_feature_flags_extended

-- Update the default feature_flags JSONB structure
ALTER TABLE organisations
ALTER COLUMN feature_flags SET DEFAULT '{
  "standardExtraction": {"enabled": true, "ratePerItem": 0.10},
  "premiumExtraction": {"enabled": true, "ratePerItem": 0.25},
  "logoExtraction": {"enabled": true, "ratePerItem": 0.15},
  "logoProcessing": {"enabled": true, "ratePerItem": 0.20},
  "googleSearchExtraction": {"enabled": true, "ratePerItem": 0.05},
  "platformDetailsExtraction": {"enabled": true, "ratePerItem": 0.05},
  "csvDownload": {"enabled": true, "ratePerItem": 0.01},
  "csvWithImagesDownload": {"enabled": true, "ratePerItem": 0.02},
  "imageUploadToCDN": {"enabled": true, "ratePerItem": 0.001},
  "imageZipDownload": {"enabled": true, "ratePerItem": 0.05},

  "tasksAndSequences": {"enabled": true},

  "socialMedia": {"enabled": true},

  "leadScraping": {
    "enabled": true,
    "scrapeJobs": {"enabled": true, "ratePerItem": 1.00},
    "stepEnrichment": {"enabled": true, "ratePerItem": 0.05},
    "leadConversion": {"enabled": true, "ratePerItem": 0.25}
  },

  "brandingExtraction": {
    "enabled": true,
    "firecrawlBranding": {"enabled": true, "ratePerItem": 0.20}
  },

  "registration": {
    "enabled": true,
    "userAccountRegistration": {"enabled": true, "ratePerItem": 0.00},
    "restaurantRegistration": {"enabled": true, "ratePerItem": 0.00},
    "menuUploading": {"enabled": true, "ratePerItem": 0.00},
    "itemTagUploading": {"enabled": true, "ratePerItem": 0.00},
    "optionSetUploading": {"enabled": true, "ratePerItem": 0.00},
    "codeInjection": {"enabled": true, "ratePerItem": 0.00},
    "websiteSettings": {"enabled": true, "ratePerItem": 0.00},
    "stripePayments": {"enabled": true, "ratePerItem": 0.00},
    "servicesConfiguration": {"enabled": true, "ratePerItem": 0.00},
    "onboardingUserManagement": {"enabled": true, "ratePerItem": 0.00},
    "finalisingSetup": {"enabled": true, "ratePerItem": 0.00}
  }
}'::jsonb;

-- Update existing organizations with new feature flags (merge with existing)
UPDATE organisations
SET feature_flags = feature_flags || '{
  "tasksAndSequences": {"enabled": true},
  "socialMedia": {"enabled": true},
  "leadScraping": {
    "enabled": true,
    "scrapeJobs": {"enabled": true, "ratePerItem": 1.00},
    "stepEnrichment": {"enabled": true, "ratePerItem": 0.05},
    "leadConversion": {"enabled": true, "ratePerItem": 0.25}
  },
  "brandingExtraction": {
    "enabled": true,
    "firecrawlBranding": {"enabled": true, "ratePerItem": 0.20}
  },
  "registration": {
    "enabled": true,
    "userAccountRegistration": {"enabled": true, "ratePerItem": 0.00},
    "restaurantRegistration": {"enabled": true, "ratePerItem": 0.00},
    "menuUploading": {"enabled": true, "ratePerItem": 0.00},
    "itemTagUploading": {"enabled": true, "ratePerItem": 0.00},
    "optionSetUploading": {"enabled": true, "ratePerItem": 0.00},
    "codeInjection": {"enabled": true, "ratePerItem": 0.00},
    "websiteSettings": {"enabled": true, "ratePerItem": 0.00},
    "stripePayments": {"enabled": true, "ratePerItem": 0.00},
    "servicesConfiguration": {"enabled": true, "ratePerItem": 0.00},
    "onboardingUserManagement": {"enabled": true, "ratePerItem": 0.00},
    "finalisingSetup": {"enabled": true, "ratePerItem": 0.00}
  }
}'::jsonb
WHERE feature_flags IS NOT NULL;
```

---

### Task 13: Update Statistics Dashboard for New Event Types (3 hours)

#### 13.1 Update get_usage_statistics Function
```sql
-- Migration: update_usage_statistics_function_extended

CREATE OR REPLACE FUNCTION get_usage_statistics(
  p_org_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  -- Original Metrics
  total_credits_used NUMERIC,
  total_extractions BIGINT,
  total_restaurants_created BIGINT,
  total_menu_extractions BIGINT,
  total_menu_items_extracted BIGINT,
  total_standard_extractions BIGINT,
  total_standard_menu_items BIGINT,
  total_premium_extractions BIGINT,
  total_premium_menu_items BIGINT,
  total_logos_extracted BIGINT,
  total_logos_processed BIGINT,
  total_google_search_extractions BIGINT,
  total_platform_details_extractions BIGINT,
  total_csv_downloads BIGINT,
  total_csv_without_images BIGINT,
  total_csv_with_images BIGINT,
  total_image_upload_jobs BIGINT,
  total_images_uploaded_to_cdn BIGINT,
  total_image_zip_downloads BIGINT,
  total_images_downloaded BIGINT,

  -- NEW: Lead Scraping Metrics
  total_lead_scrape_jobs BIGINT,
  total_lead_scrape_api_calls BIGINT,
  total_leads_converted BIGINT,

  -- NEW: Branding Extraction Metrics
  total_branding_extractions BIGINT,

  -- NEW: Registration Metrics (tracking only)
  total_user_accounts_registered BIGINT,
  total_restaurants_registered BIGINT,
  total_menus_uploaded BIGINT,
  total_item_tags_added BIGINT,
  total_option_sets_added BIGINT,
  total_code_injections_generated BIGINT,
  total_website_settings_configured BIGINT,
  total_stripe_payments_configured BIGINT,
  total_services_configured BIGINT,
  total_onboarding_users_created BIGINT,
  total_setups_finalized BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH event_counts AS (
    SELECT
      event_type,
      SUM(quantity) as total_quantity
    FROM usage_events
    WHERE
      (p_org_id IS NULL OR organisation_id = p_org_id)
      AND created_at >= p_start_date
      AND created_at <= p_end_date
    GROUP BY event_type
  )
  SELECT
    -- Calculate total credits (including new event types)
    COALESCE(
      (SELECT SUM(ec.total_quantity *
        CASE ec.event_type
          -- Original rates
          WHEN 'standard_extraction' THEN 0.10
          WHEN 'premium_extraction' THEN 0.25
          WHEN 'logo_extraction' THEN 0.15
          WHEN 'logo_processing' THEN 0.20
          WHEN 'google_search' THEN 0.05
          WHEN 'platform_details' THEN 0.05
          WHEN 'csv_download' THEN 0.01
          WHEN 'csv_with_images_download' THEN 0.02
          WHEN 'image_cdn_upload' THEN 0.001
          WHEN 'image_zip_download' THEN 0.05
          -- NEW: Lead Scraping rates
          WHEN 'lead_scrape_job_created' THEN 1.00
          WHEN 'lead_scrape_api_call' THEN 0.05
          WHEN 'lead_converted_to_restaurant' THEN 0.25
          -- NEW: Branding rate
          WHEN 'firecrawl_branding_extraction' THEN 0.20
          -- Registration rates (0 for now)
          ELSE 0
        END
      ) FROM event_counts ec), 0
    )::NUMERIC as total_credits_used,

    -- Original metrics (unchanged)
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'standard_extraction'), 0) +
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'premium_extraction'), 0) as total_extractions,

    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'restaurant_created'), 0)::BIGINT as total_restaurants_created,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'menu_created'), 0)::BIGINT as total_menu_extractions,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'menu_item_extracted'), 0)::BIGINT as total_menu_items_extracted,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'standard_extraction'), 0)::BIGINT as total_standard_extractions,
    0::BIGINT as total_standard_menu_items,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'premium_extraction'), 0)::BIGINT as total_premium_extractions,
    0::BIGINT as total_premium_menu_items,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'logo_extraction'), 0)::BIGINT as total_logos_extracted,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'logo_processing'), 0)::BIGINT as total_logos_processed,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'google_search'), 0)::BIGINT as total_google_search_extractions,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'platform_details'), 0)::BIGINT as total_platform_details_extractions,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_download'), 0) +
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_with_images_download'), 0) as total_csv_downloads,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_download'), 0)::BIGINT as total_csv_without_images,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_with_images_download'), 0)::BIGINT as total_csv_with_images,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_upload_job'), 0)::BIGINT as total_image_upload_jobs,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_cdn_upload'), 0)::BIGINT as total_images_uploaded_to_cdn,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_zip_download'), 0)::BIGINT as total_image_zip_downloads,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_download'), 0)::BIGINT as total_images_downloaded,

    -- NEW: Lead Scraping metrics
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'lead_scrape_job_created'), 0)::BIGINT as total_lead_scrape_jobs,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'lead_scrape_api_call'), 0)::BIGINT as total_lead_scrape_api_calls,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'lead_converted_to_restaurant'), 0)::BIGINT as total_leads_converted,

    -- NEW: Branding metrics
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'firecrawl_branding_extraction'), 0)::BIGINT as total_branding_extractions,

    -- NEW: Registration metrics
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_user_account'), 0)::BIGINT as total_user_accounts_registered,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_restaurant'), 0)::BIGINT as total_restaurants_registered,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_menu_upload'), 0)::BIGINT as total_menus_uploaded,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_item_tags'), 0)::BIGINT as total_item_tags_added,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_option_sets'), 0)::BIGINT as total_option_sets_added,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_code_injection'), 0)::BIGINT as total_code_injections_generated,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_website_settings'), 0)::BIGINT as total_website_settings_configured,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_stripe_payments'), 0)::BIGINT as total_stripe_payments_configured,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_services_config'), 0)::BIGINT as total_services_configured,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_onboarding_user'), 0)::BIGINT as total_onboarding_users_created,
    COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'registration_finalize_setup'), 0)::BIGINT as total_setups_finalized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 13.2 Update UsageStatsGrid Component
Add new sections to the statistics grid for the new metrics.

**File**: `/src/components/super-admin/UsageStatsGrid.tsx` (additions)
```typescript
// Add new stat cards for the expanded features

// Lead Scraping Section
{
  title: 'Lead Scrape Jobs',
  value: stats.total_lead_scrape_jobs,
  icon: <Search className="h-4 w-4" />,
  cost: stats.total_lead_scrape_jobs * 1.00,
  category: 'lead-scraping'
},
{
  title: 'Lead API Calls',
  value: stats.total_lead_scrape_api_calls,
  icon: <Zap className="h-4 w-4" />,
  cost: stats.total_lead_scrape_api_calls * 0.05,
  category: 'lead-scraping'
},
{
  title: 'Leads Converted',
  value: stats.total_leads_converted,
  icon: <ArrowRight className="h-4 w-4" />,
  cost: stats.total_leads_converted * 0.25,
  category: 'lead-scraping'
},

// Branding Section
{
  title: 'Branding Extractions',
  value: stats.total_branding_extractions,
  icon: <Palette className="h-4 w-4" />,
  cost: stats.total_branding_extractions * 0.20,
  category: 'branding'
},

// Registration Section (informational, no cost shown)
{
  title: 'User Accounts Registered',
  value: stats.total_user_accounts_registered,
  icon: <UserPlus className="h-4 w-4" />,
  category: 'registration'
},
{
  title: 'Restaurants Registered',
  value: stats.total_restaurants_registered,
  icon: <Store className="h-4 w-4" />,
  category: 'registration'
},
{
  title: 'Menus Uploaded',
  value: stats.total_menus_uploaded,
  icon: <FileText className="h-4 w-4" />,
  category: 'registration'
},
{
  title: 'Setups Finalized',
  value: stats.total_setups_finalized,
  icon: <CheckCircle className="h-4 w-4" />,
  category: 'registration'
}
```

---

## END OF NEW FEATURE SECTIONS

#### 5.2 Testing Checklist

**Original Tracking Tests**:
- [ ] Standard extraction creates usage event
- [ ] Premium extraction creates usage event
- [ ] Menu items are tracked separately
- [ ] Logo extraction/processing tracked
- [ ] CSV downloads tracked (with/without images)
- [ ] Image operations tracked
- [ ] Search operations tracked

**NEW: Tasks & Sequences Feature Flag Tests**:
- [ ] Tasks page hidden when flag disabled
- [ ] Sequences page hidden when flag disabled
- [ ] Sales columns hidden on Restaurants page when flag disabled
- [ ] Tasks/Sequences tab hidden on RestaurantDetail when flag disabled
- [ ] Sales info card hidden on RestaurantDetail Overview when flag disabled
- [ ] Direct URL access returns appropriate error when flag disabled

**NEW: Lead Scraping Tests**:
- [ ] Lead scraping pages hidden when flag disabled
- [ ] Scrape job creation tracks usage event
- [ ] Each Firecrawl API call tracks individual usage event
- [ ] Lead conversion tracks usage event
- [ ] Metadata includes job_id, step_number, lead_id correctly

**NEW: Branding Extraction Tests**:
- [ ] Branding extraction respects feature flag
- [ ] Branding extraction respects env variable override
- [ ] Branding extraction tracks usage event
- [ ] Metadata includes restaurant_id and candidates_found

**NEW: Registration Feature Flag Tests**:
- [ ] Registration tab hidden when parent flag disabled
- [ ] Individual registration steps hidden when specific flags disabled
- [ ] Each registration step tracks usage event
- [ ] Metadata includes restaurant_id correctly

**NEW: Social Media Tests**:
- [ ] Social media page hidden when flag disabled
- [ ] Routes return 403 when flag disabled

**Statistics Tests**:
- [ ] Statistics load for all organizations
- [ ] Statistics filter by organization
- [ ] Date range filtering works
- [ ] All metrics calculate correctly (including new event types)
- [ ] Credits calculation is accurate (including lead scraping, branding)
- [ ] Export to CSV includes all data (including new metrics)
- [ ] Export to JSON includes billing summary (including new metrics)
- [ ] Lead scraping metrics display correctly
- [ ] Branding metrics display correctly
- [ ] Registration metrics display correctly (informational)

**UI Tests**:
- [ ] Date range picker works
- [ ] Organization filter works
- [ ] Preset date ranges work
- [ ] Statistics cards display correctly (all categories)
- [ ] Loading states display
- [ ] Export buttons work
- [ ] Refresh button updates data
- [ ] Feature flag hook loads correctly
- [ ] Navigation items show/hide based on flags
- [ ] Restaurant columns filter based on flags

**Performance Tests**:
- [ ] Statistics load in <2 seconds
- [ ] Export handles large datasets
- [ ] Database queries are optimized
- [ ] No N+1 query issues
- [ ] Feature flag loading doesn't cause UI flash

## Migration Rollout Plan

### Step 1: Deploy Database Changes
```bash
# Run migrations in order
1. Update organizations table (feature flags, billing rates)
2. Create usage_events table
3. Create statistics functions
4. Apply RLS policies
```

### Step 2: Deploy Backend Changes
```bash
1. Deploy usage tracking service
2. Update all extraction endpoints
3. Deploy new API endpoints
4. Test tracking with manual events
```

### Step 3: Deploy Frontend Changes
```bash
1. Deploy usage statistics components
2. Update SuperAdminUsage component
3. Test with real data
4. Verify exports work
```

## Monitoring & Maintenance

### Usage Event Monitoring
```sql
-- Check recent events
SELECT event_type, COUNT(*), SUM(quantity) 
FROM usage_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type;

-- Check for missing events
SELECT 
  (SELECT COUNT(*) FROM extraction_jobs WHERE created_at > NOW() - INTERVAL '1 day') as extractions,
  (SELECT COUNT(*) FROM usage_events WHERE event_type LIKE '%extraction%' AND created_at > NOW() - INTERVAL '1 day') as tracked_extractions;
```

### Performance Monitoring
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM get_usage_statistics(
  NULL,
  NOW() - INTERVAL '30 days',
  NOW()
);
```

## Common Issues & Solutions

### Issue 1: Events Not Being Tracked
**Solution**: Check that tracking service is being called in endpoints:
```javascript
// Verify in endpoint
console.log('Tracking event:', eventType, quantity);
await UsageTrackingService.trackEvent(...);
```

### Issue 2: Statistics Not Calculating
**Solution**: Check database function permissions:
```sql
GRANT EXECUTE ON FUNCTION get_usage_statistics TO authenticated;
GRANT SELECT ON usage_events TO authenticated;
```

### Issue 3: Export Failing
**Solution**: Check browser console for errors, ensure data is loaded:
```typescript
if (!stats) {
  console.error('No stats to export');
  return;
}
```

## Success Criteria

Phase 4 is complete when:

### Original Criteria
1. ✅ Feature flag middleware enforces access to all protected endpoints
2. ✅ All extraction endpoints track usage events
3. ✅ Usage events record to Stripe Billing Meters
4. ✅ Usage statistics display for all 20+ metrics

### NEW: Extended Criteria
5. ✅ Tasks & Sequences feature flag hides/shows UI elements correctly
6. ✅ Restaurants page sales columns filtered based on feature flag
7. ✅ RestaurantDetail tabs/cards filtered based on feature flag
8. ✅ Social Media feature flag hides/shows page and blocks routes
9. ✅ Lead Scraping feature flag enforces access
10. ✅ Lead scraping tracks usage at Firecrawl API call level
11. ✅ Lead scraping tracks job creation and lead conversion
12. ✅ Branding Extraction feature flag works alongside env variable
13. ✅ Branding extraction tracks usage events
14. ✅ Registration parent feature flag controls tab visibility
15. ✅ Registration step feature flags control individual step visibility
16. ✅ Registration steps track usage events for future billing
17. ✅ Statistics dashboard displays all new metrics (30+ total)
18. ✅ Feature flags support organization-level rate configuration
19. ✅ Frontend useFeatureFlags hook works for all feature paths
20. ✅ All new tests pass
21. ✅ Date range filtering works
22. ✅ Organization filtering works
23. ✅ Export to CSV/JSON works
24. ✅ Billing calculations are accurate
25. ✅ Performance is acceptable (<2s load time)
26. ✅ Feature flags return proper 403 errors when disabled

## Next Steps (Phase 5)
- Polish UI with loading states
- Add error handling
- Implement confirmation dialogs
- Performance optimization
- End-to-end testing

---
