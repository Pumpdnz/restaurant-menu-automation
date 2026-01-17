# Phase 4 Expansion Investigation Summary

**Date**: 2025-12-07
**Status**: ✅ COMPLETE - Phase 4 Plan Updated
**Author**: Claude

> **Note**: Based on user confirmation, the Phase 4 implementation plan has been updated with all expanded features. See [SUPER-ADMIN-PHASE-4-IMPLEMENTATION.md](../SUPER-ADMIN-PHASE-4-IMPLEMENTATION.md) for the complete updated plan.

## Executive Summary

This document summarizes the investigation into expanding Phase 4 of the Super Admin Dashboard project to include feature flagging, usage tracking, and billing for new features that have been implemented since the original plan was created.

### Current Phase 4 Scope
The existing Phase 4 plan focuses on:
- Feature flags for extraction features (standard/premium extraction, logo extraction, CSV downloads, etc.)
- Usage tracking for extraction operations
- Statistics dashboard with billing calculations
- Stripe Billing Meter integration

### Required Expansion
Five new feature areas need to be added to Phase 4:

| Feature Area | Feature Flagging | Usage Tracking | Billing |
|-------------|-----------------|----------------|---------|
| Tasks & Sequences | Yes | No | No |
| Social Media | Yes | Yes | Yes |
| Lead Scraping | Yes | Yes | Yes |
| Branding Extraction | Yes | Yes | Yes |
| Registration Features | Yes | Yes | No (future) |

---

## 1. Tasks & Sequences

### Requirements Summary
- **Feature Flag Only** - No usage tracking or billing required
- When disabled for an organization:
  - Hide Tasks and Sequences pages from navigation sidebar
  - Hide sales-related columns on Restaurants page
  - Hide Tasks and Sequences tab on RestaurantDetail page
  - Hide Sales information card on RestaurantDetail Overview tab

### Files Identified

#### Navigation/Sidebar
- `/src/components/ui/sidebar.tsx` - Shadcn sidebar component
- Navigation items need conditional rendering based on feature flags

#### Tasks Pages
- `/src/pages/Tasks.tsx` - Main tasks page with filters, multi-select, templates
- `/src/components/tasks/CreateTaskModal.tsx`
- `/src/components/tasks/TaskDetailModal.tsx`
- `/src/components/tasks/RestaurantTasksList.tsx`
- `/src/components/tasks/TaskTypeQuickView.tsx`

#### Sequences Pages
- `/src/pages/Sequences.tsx` - Main sequences page (instances, templates, message templates)
- `/src/components/sequences/SequenceProgressCard.tsx`
- `/src/components/sequences/StartSequenceModal.tsx`
- `/src/components/sequences/BulkStartSequenceModal.tsx`

#### Restaurants Page Columns to Hide
In `/src/pages/Restaurants.jsx`, the following columns are sales-specific:
- Lead Type (lines 968-970)
- Lead Category (lines 971-973)
- Lead Status (lines 974-976)
- Warmth (lines 977-979)
- Stage (lines 980-982)
- Tasks (lines 983-997)
- ICP Rating (lines 998-1000)
- Last Contact (lines 1004-1006)

#### RestaurantDetail Components
- `/src/pages/RestaurantDetail.jsx`:
  - Tasks and Sequences Tab
  - Sales Information Card on Overview tab

### Suggested Feature Flag Structure
```json
{
  "tasksAndSequences": {
    "enabled": true
  }
}
```

### Implementation Approach
1. Add client-side feature flag check hook (e.g., `useFeatureFlag('tasksAndSequences')`)
2. Conditionally render navigation items
3. Filter columns in Restaurants page based on flag
4. Conditionally render tabs in RestaurantDetail

---

## 2. Social Media

### Requirements Summary
- **Feature Flag** - Enable/disable entire social media feature
- **Usage Tracking** - Track video and image generations separately
- **Billing** - Bill per video generation and per image generation

### Files Identified

#### Main Dashboard
- `/src/pages/SocialMediaDashboard.tsx` - Main dashboard with 5 tabs

#### Video Generation
- `/src/pages/social-media/VideosTab.tsx`
- `/src/components/social-media/VideoPromptInput.tsx`
- `/src/components/social-media/VideoConfigForm.tsx`
- `/src/components/social-media/VideoJobStatus.tsx`
- `/src/components/social-media/ModelSelector.tsx`

#### Image Generation
- `/src/pages/social-media/ImagesTab.tsx`
- `/src/components/social-media/ImageModelSelector.tsx`
- `/src/components/social-media/ImageConfigForm.tsx`
- `/src/components/social-media/ReferenceImageSelector.tsx`

#### Backend Routes
- `/src/routes/social-media-routes.js`

### Suggested Feature Flag Structure
```json
{
  "socialMedia": {
    "enabled": true,
    "videoGeneration": { "enabled": true, "ratePerItem": 0.50 },
    "imageGeneration": { "enabled": true, "ratePerItem": 0.10 }
  }
}
```

### New Usage Event Types
```typescript
enum SocialMediaEventType {
  VIDEO_GENERATION = 'video_generation',
  IMAGE_GENERATION = 'image_generation'
}
```

### Implementation Points
1. Feature flag middleware on `/api/social-media/*` routes
2. Track each video generation job
3. Track each image generation job
4. Add to statistics dashboard

---

## 3. Lead Scraping

### Requirements Summary
- **Feature Flag** - Enable/disable lead scraping
- **Usage Tracking** - Track at multiple granularity levels:
  1. Per scrape job executed
  2. Per enrichment scrape per lead at each step
  3. Per lead converted to restaurant
- **Billing** - Bill for each tracked item separately

### Files Identified

#### Frontend Pages
- `/src/pages/LeadScrapes.tsx` - Main lead scrapes page
- `/src/pages/LeadScrapeDetail.tsx` - Individual scrape job detail
- `/src/hooks/useLeadScrape.ts` - React hooks for lead scraping

#### Backend Routes
- `/src/routes/leads-routes.js` - Lead CRUD operations
- `/src/routes/lead-scrape-routes.js` - Scrape job operations
- `/src/routes/city-codes-routes.js` - City code lookups

#### Backend Services
- `/src/services/lead-scrape-service.js` - Business logic for jobs/leads
- `/src/services/lead-scrape-firecrawl-service.js` - Firecrawl integration

### Current 5-Step Extraction Process
From `lead-scrape-service.js`:
1. **Category Page Scan** - Extract restaurant names/URLs from listing
2. **Store Page Enrichment** - Batch scrape individual stores
3. **Google Business Lookup** - Find phone/website/hours
4. **Social Media Discovery** - Find social profiles
5. **Contact Enrichment** - Find contact person info

### Suggested Feature Flag Structure
```json
{
  "leadScraping": {
    "enabled": true,
    "scrapeJobs": { "enabled": true, "ratePerItem": 1.00 },
    "stepEnrichment": { "enabled": true, "ratePerItem": 0.05 },
    "leadConversion": { "enabled": true, "ratePerItem": 0.25 }
  }
}
```

### New Usage Event Types
```typescript
enum LeadScrapingEventType {
  SCRAPE_JOB_EXECUTED = 'scrape_job_executed',
  LEAD_STEP_ENRICHED = 'lead_step_enriched',
  LEAD_CONVERTED_TO_RESTAURANT = 'lead_converted_to_restaurant'
}
```

### Implementation Points
1. Feature flag middleware on `/api/lead-scrape-jobs/*` routes
2. Track when `createLeadScrapeJob()` is called
3. Track every Firecrawl API call in `processStep1()` through `processStep5()`
4. Track when `convertLeadsToRestaurants()` is called
5. Include metadata: job_id, step_number, lead_id
6. Add to statistics dashboard with breakdown by step

---

## 4. Branding Extraction (Firecrawl Branding Format)

### Requirements Summary
- **Feature Flag** - Enable/disable new Firecrawl branding extraction
- **Usage Tracking** - Track usage of new branding format scraping
- **Billing** - Bill per branding extraction
- **Note**: Keep existing env variable (`USE_FIRECRAWL_BRANDING_FORMAT`) in place alongside feature flag

### Files Identified

#### RestaurantDetail Gathering Info Tab
- `/src/pages/RestaurantDetail.jsx`:
  - `useFirecrawlBranding` state (lines 131-349 for branding states)
  - `brandingSourceUrl` state
  - `extractingBranding` state
  - Logo processing modes: 'extract', 'manual', 'reprocess', 'replace'

#### Backend Services
- `/src/services/logo-extraction-service.js` - Logo extraction with Firecrawl
  - `extractLogoCandidatesWithFirecrawl()` function
  - Uses Firecrawl's JSON extraction with branding-specific prompt/schema
- `/src/services/firecrawl-service.js` - General Firecrawl integration

#### Environment Configuration
- Feature toggle fetched from `/config/features` endpoint
- Current env variable likely: `USE_FIRECRAWL_BRANDING_FORMAT`

### Suggested Feature Flag Structure
```json
{
  "brandingExtraction": {
    "enabled": true,
    "firecrawlBranding": { "enabled": true, "ratePerItem": 0.20 }
  }
}
```

### New Usage Event Types
```typescript
enum BrandingEventType {
  FIRECRAWL_BRANDING_EXTRACTION = 'firecrawl_branding_extraction'
}
```

### Implementation Points
1. Feature flag check before calling `extractLogoCandidatesWithFirecrawl()`
2. Track each Firecrawl branding format API call
3. Keep env variable as fallback/override mechanism
4. Add to statistics dashboard

---

## 5. Registration Features

### Requirements Summary
- **Feature Flag** - Enable/disable entire Registration tab and individual steps
- **Usage Tracking** - Track each registration step execution
- **Billing** - Not required now, but prepare structure for future
- **Future**: Organization-based configuration for pumpd_dashboard_url and cloudwaitress-api-service variables

### Files Identified

#### RestaurantDetail Registration Tab
- `/src/pages/RestaurantDetail.jsx` - Registration tab implementation

#### Backend Routes
- `/src/routes/registration-routes.js` - Registration API endpoints
- `/src/services/onboarding-service.js` - Registration automation logic

### Registration Steps Identified
From RestaurantDetail.jsx states:

| Step | State Variables | Description |
|------|-----------------|-------------|
| 1. User Account Registration | `registering`, `registrationEmail`, `registrationPassword` | Register user on Pumpd dashboard |
| 2. Restaurant Registration | `registrationStatus` | Register restaurant entity |
| 3. Menu Uploading | `csvFile`, `isUploading`, `uploadStatus` | Upload _no_images.csv |
| 4. Item Tag Uploading | `isAddingTags`, `tagsStatus` | Add tags to menu items |
| 5. Option Set Uploading | `selectedMenuForOptionSets`, `isAddingOptionSets`, `optionSetsStatus` | Add option sets/modifiers |
| 6. Code Injection Generation | `isGenerating`, `codeGenerated`, `customizationMode` | Generate head/body injections |
| 7. Website Settings | Various configuration states | Configure website customization |
| 8. Stripe Payments | `isConfiguringPayments`, `paymentStatus`, `includeConnectLink` | Setup Stripe gateway |
| 9. Services Configuration | `isConfiguringServices`, `servicesStatus` | Configure restaurant services |
| 10. Onboarding User Management | `isCreatingOnboardingUser`, `onboardingUserEmail/Name/Password` | Create onboarding users |
| 11. Finalising Setup Steps | `isSettingUpSystemSettings`, `isCreatingApiKey`, `isConfiguringUberIntegration` | Complete setup |

### Suggested Feature Flag Structure
```json
{
  "registration": {
    "enabled": true,
    "userAccountRegistration": { "enabled": true },
    "restaurantRegistration": { "enabled": true },
    "menuUploading": { "enabled": true },
    "itemTagUploading": { "enabled": true },
    "optionSetUploading": { "enabled": true },
    "codeInjection": { "enabled": true },
    "websiteSettings": { "enabled": true },
    "stripePayments": { "enabled": true },
    "servicesConfiguration": { "enabled": true },
    "onboardingUserManagement": { "enabled": true },
    "finalisingSetup": { "enabled": true }
  }
}
```

### New Usage Event Types
```typescript
enum RegistrationEventType {
  USER_ACCOUNT_REGISTERED = 'user_account_registered',
  RESTAURANT_REGISTERED = 'restaurant_registered',
  MENU_UPLOADED = 'menu_uploaded',
  ITEM_TAGS_ADDED = 'item_tags_added',
  OPTION_SETS_ADDED = 'option_sets_added',
  CODE_INJECTION_GENERATED = 'code_injection_generated',
  WEBSITE_SETTINGS_CONFIGURED = 'website_settings_configured',
  STRIPE_PAYMENTS_CONFIGURED = 'stripe_payments_configured',
  SERVICES_CONFIGURED = 'services_configured',
  ONBOARDING_USER_CREATED = 'onboarding_user_created',
  SETUP_FINALIZED = 'setup_finalized'
}
```

### Implementation Points
1. Feature flag check before rendering Registration tab
2. Feature flag check before each step button/action
3. Track each step execution (for future billing)
4. Add to statistics dashboard (informational only for now)
5. Prepare database schema for org-specific configuration URLs

---

## Database Schema Changes Required

### Updated Feature Flags Structure
The current `feature_flags` JSONB column on `organisations` table needs to accommodate:

```json
{
  // Existing extraction features
  "standardExtraction": { "enabled": true, "ratePerItem": 0.10 },
  "premiumExtraction": { "enabled": true, "ratePerItem": 0.25 },
  "logoExtraction": { "enabled": true, "ratePerItem": 0.15 },
  "logoProcessing": { "enabled": true, "ratePerItem": 0.20 },
  "googleSearchExtraction": { "enabled": true, "ratePerItem": 0.05 },
  "platformDetailsExtraction": { "enabled": true, "ratePerItem": 0.05 },
  "csvDownload": { "enabled": true, "ratePerItem": 0.01 },
  "csvWithImagesDownload": { "enabled": true, "ratePerItem": 0.02 },
  "imageUploadToCDN": { "enabled": true, "ratePerItem": 0.001 },
  "imageZipDownload": { "enabled": true, "ratePerItem": 0.05 },

  // NEW: Tasks & Sequences (no billing)
  "tasksAndSequences": { "enabled": true },

  // NEW: Social Media
  "socialMedia": {
    "enabled": true,
    "videoGeneration": { "enabled": true, "ratePerItem": 0.50 },
    "imageGeneration": { "enabled": true, "ratePerItem": 0.10 }
  },

  // NEW: Lead Scraping
  "leadScraping": {
    "enabled": true,
    "scrapeJobs": { "enabled": true, "ratePerItem": 1.00 },
    "stepEnrichment": { "enabled": true, "ratePerItem": 0.05 },
    "leadConversion": { "enabled": true, "ratePerItem": 0.25 }
  },

  // NEW: Branding Extraction
  "brandingExtraction": {
    "enabled": true,
    "firecrawlBranding": { "enabled": true, "ratePerItem": 0.20 }
  },

  // NEW: Registration (no billing, usage tracking for monitoring)
  "registration": {
    "enabled": true,
    "userAccountRegistration": { "enabled": true },
    "restaurantRegistration": { "enabled": true },
    "menuUploading": { "enabled": true },
    "itemTagUploading": { "enabled": true },
    "optionSetUploading": { "enabled": true },
    "codeInjection": { "enabled": true },
    "websiteSettings": { "enabled": true },
    "stripePayments": { "enabled": true },
    "servicesConfiguration": { "enabled": true },
    "onboardingUserManagement": { "enabled": true },
    "finalisingSetup": { "enabled": true }
  }
}
```

### New Usage Event Types to Add
```sql
-- Update the get_usage_statistics function to include new event types:

-- Social Media
'video_generation'
'image_generation'

-- Lead Scraping
'scrape_job_executed'
'lead_step_enriched'
'lead_converted_to_restaurant'

-- Branding
'firecrawl_branding_extraction'

-- Registration (tracking only)
'user_account_registered'
'restaurant_registered'
'menu_uploaded'
'item_tags_added'
'option_sets_added'
'code_injection_generated'
'website_settings_configured'
'stripe_payments_configured'
'services_configured'
'onboarding_user_created'
'setup_finalized'
```

---

## Frontend Implementation Strategy

### Feature Flag Context/Hook
Create a reusable feature flag hook:

```typescript
// /src/hooks/useFeatureFlags.ts
export function useFeatureFlag(featurePath: string): boolean {
  // Fetch feature flags from organization context
  // Parse featurePath like 'tasksAndSequences' or 'socialMedia.videoGeneration'
  // Return enabled status
}

export function useFeatureConfig(featurePath: string): FeatureConfig | null {
  // Return full feature config including ratePerItem
}
```

### Navigation Sidebar Updates
```tsx
// Conditional rendering in sidebar
{featureFlags.tasksAndSequences?.enabled && (
  <>
    <SidebarMenuItem href="/tasks" icon={CheckSquare}>Tasks</SidebarMenuItem>
    <SidebarMenuItem href="/sequences" icon={ListTree}>Sequences</SidebarMenuItem>
  </>
)}

{featureFlags.socialMedia?.enabled && (
  <SidebarMenuItem href="/social-media" icon={Share2}>Social Media</SidebarMenuItem>
)}

{featureFlags.leadScraping?.enabled && (
  <SidebarMenuItem href="/lead-scrapes" icon={Search}>Lead Scraping</SidebarMenuItem>
)}
```

### Restaurants Page Column Filtering
```tsx
// Dynamic column definition based on feature flags
const columns = useMemo(() => {
  const baseColumns = [/* always visible columns */];

  if (featureFlags.tasksAndSequences?.enabled) {
    baseColumns.push(
      leadTypeColumn,
      leadCategoryColumn,
      leadStatusColumn,
      warmthColumn,
      stageColumn,
      tasksColumn,
      icpRatingColumn,
      lastContactColumn
    );
  }

  return baseColumns;
}, [featureFlags]);
```

---

## Summary of Changes Required

### Phase 4 Plan Updates

1. **Expand Feature Flag Middleware**
   - Add middleware for social media routes
   - Add middleware for lead scraping routes
   - Add middleware for registration routes
   - Add middleware for branding extraction endpoints

2. **Expand Usage Event Types**
   - Add 3 social media event types
   - Add 3 lead scraping event types
   - Add 1 branding event type
   - Add 11 registration event types (tracking only)

3. **Update Statistics Dashboard**
   - Add new sections for each feature area
   - Add billing calculations for billable features
   - Add filters for new event types

4. **Add Frontend Feature Flag Integration**
   - Create feature flag context/hook
   - Update navigation sidebar
   - Update Restaurants page columns
   - Update RestaurantDetail tabs/cards

5. **Update Database Schema**
   - Expand feature_flags JSONB structure
   - Update get_usage_statistics function
   - Add new usage event type handling

---

## Questions for User

Before proceeding with Phase 4 plan updates, please confirm:

1. **Billing Rates**: Are the suggested rates per item appropriate, or do you have specific rates in mind?

2. **Lead Scraping Granularity**: Should we track at the individual Firecrawl API call level (most granular) or at the step completion level?

3. **Registration Billing**: You mentioned no billing for now - should we still add rate structure for future enablement, or omit entirely?

4. **Organization-Specific Config**: For registration features, should we add the database schema for org-specific URLs (pumpd_dashboard_url, etc.) in Phase 4, or defer to a later phase?

5. **Priority Order**: If time-constrained, which feature areas should be prioritized?
   - Tasks & Sequences (simplest - no tracking)
   - Social Media
   - Lead Scraping
   - Branding Extraction
   - Registration Features

---

## Next Steps

~~After user approval:~~
~~1. Update SUPER-ADMIN-PHASE-4-IMPLEMENTATION.md with expanded scope~~
~~2. Add new code sections for each feature area~~
~~3. Update database migration scripts~~
~~4. Update statistics function~~
~~5. Add frontend feature flag integration code~~

**All steps completed. The Phase 4 implementation plan now includes:**
- Tasks 7-13 added covering all new feature areas
- Updated event types enum with 18 new event types
- Updated feature flag middleware with 15 new exports
- Updated database migrations for new feature flags
- Updated statistics function for new metrics
- Updated testing checklist with 40+ new test cases
- Updated success criteria with 26 total criteria

**User Decisions Incorporated:**
- Billing rates: Using suggested rates (configurable at org level)
- Lead scraping: Tracking at Firecrawl API call level (most granular)
- Registration: Rate structure added for future billing (currently $0.00)
- Org-specific config: Deferred to later phase
- Social media: Feature flag only (no tracking/billing for now)
