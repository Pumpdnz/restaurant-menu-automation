# Usage Tracking Endpoints Reference

**Last Updated**: 2025-12-07
**Phase**: 4 (Stripe billing deferred)

This document lists all endpoints and services with usage tracking implemented, ready for future billing integration.

---

## Event Types & Billing Rates

| Event Type | Default Rate | Billable |
|------------|--------------|----------|
| `standard_extraction` | $0.10 | Yes |
| `premium_extraction` | $0.25 | Yes |
| `menu_item_extracted` | $0.00 | No (tracked for metrics) |
| `logo_extraction` | $0.15 | Yes |
| `logo_processing` | $0.20 | Yes |
| `google_search` | $0.05 | Yes |
| `platform_details` | $0.05 | Yes |
| `csv_download` | $0.01 | Yes |
| `csv_with_images_download` | $0.02 | Yes |
| `image_cdn_upload` | $0.001 | Yes |
| `image_zip_download` | $0.05 | Yes |
| `lead_scrape_job_created` | $1.00 | Yes |
| `lead_scrape_api_call` | $0.05 | Yes |
| `lead_converted_to_restaurant` | $0.25 | Yes |
| `firecrawl_branding_extraction` | $0.20 | Yes |
| `registration_*` | $0.00 | No (future) |

---

## Registration Routes

**File**: `src/routes/registration-routes.js`

| Endpoint | Event Type | Tracked On |
|----------|------------|------------|
| `POST /register-account` | `registration_user_account` | Success |
| `POST /register-restaurant` | `registration_restaurant` | Success |
| `POST /upload-csv-menu` | `registration_menu_upload` | Success |
| `POST /generate-code-injections` | `registration_code_injection` | Success |
| `POST /add-item-tags` | `registration_item_tags` | Success |
| `POST /add-option-sets` | `registration_option_sets` | Success |
| `POST /configure-website` | `registration_website_settings` | Success |
| `POST /configure-services` | `registration_services_config` | Success |
| `POST /create-onboarding-user` | `registration_onboarding_user` | Success |
| `POST /setup-system-settings` | `registration_finalize_setup` | Success |
| `POST /create-api-key` | `registration_finalize_setup` | Success |
| `POST /configure-uber-integration` | `registration_finalize_setup` | Success |

---

## Extraction Endpoints

### Premium Extraction
**File**: `src/services/premium-extraction-service.js`

| Method | Event Types | Notes |
|--------|-------------|-------|
| `extractPremiumMenu()` | `premium_extraction`, `menu_item_extracted` | Tracks extraction + item count |

### Branding Extraction
**File**: `server.js` (line ~7140)

| Endpoint | Event Type | Notes |
|----------|------------|-------|
| `POST /api/website-extraction/branding` | `firecrawl_branding_extraction` | Tracks Firecrawl branding format usage |

---

## Lead Scraping Routes

**File**: `src/routes/lead-scrape-routes.js`

| Endpoint | Event Type | Notes |
|----------|------------|-------|
| `POST /lead-scrape-jobs` | `lead_scrape_job_created` | Per job |
| `POST /leads/convert` | `lead_converted_to_restaurant` | Per lead converted |

**File**: `src/services/lead-scrape-firecrawl-service.js`

| Method | Event Type | Notes |
|--------|------------|-------|
| Firecrawl API calls | `lead_scrape_api_call` | Per API call in steps 1-5 |

---

## Tracking Service

**File**: `src/services/usage-tracking-service.js`

### Key Methods

```javascript
// Generic event tracking
UsageTrackingService.trackEvent(organisationId, eventType, quantity, metadata)

// Convenience methods
UsageTrackingService.trackExtraction(organisationId, type, itemCount, metadata)
UsageTrackingService.trackCSVDownload(organisationId, withImages, metadata)
UsageTrackingService.trackImageOperation(organisationId, operation, count, metadata)
UsageTrackingService.trackLogoExtraction(organisationId, wasProcessed, metadata)
UsageTrackingService.trackLeadScrapeApiCall(organisationId, metadata)
UsageTrackingService.trackLeadScrapeJobCreated(organisationId, metadata)
UsageTrackingService.trackLeadsConverted(organisationId, count, metadata)
UsageTrackingService.trackBrandingExtraction(organisationId, metadata)
UsageTrackingService.trackRegistrationStep(organisationId, step, metadata)
```

---

## Endpoints NOT Yet Tracked

The following may need tracking in future phases:

| Endpoint | Reason |
|----------|--------|
| `POST /api/batch-extract-categories` | No auth middleware, no restaurantId |
| `POST /api/extractions/start` | Standard extraction - needs review |
| Social media generation | Feature flagging only (no billing) |

---

## Database Table

Events are stored in `usage_events`:

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  event_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Stripe Integration (Deferred)

Stripe Billing Meter integration is scaffolded but commented out in `usage-tracking-service.js`. To enable:

1. Uncomment `recordToStripeMeter()` method
2. Add environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_BILLING_METER_ID`
   - `STRIPE_BILLING_METER_EVENT_NAME`
3. Ensure `organisations.stripe_customer_id` is populated
