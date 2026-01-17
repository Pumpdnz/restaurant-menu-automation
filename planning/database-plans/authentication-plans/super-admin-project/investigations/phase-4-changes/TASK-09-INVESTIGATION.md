# TASK-09 Investigation Report

## Task Information
- **Task Name**: Branding Extraction Feature Flagging & Usage Tracking
- **Task ID**: TASK-09
- **Investigation Date**: December 8, 2025
- **Status**: PARTIAL

---

## Executive Summary

The branding extraction feature has usage tracking fully implemented and working correctly. However, **the feature flag middleware is not applied to the endpoint**, which is a critical gap. The feature flag classes exist and are exported but are not imported or used in the endpoint implementation.

---

## Findings

### 1. Feature Flag Middleware Status

#### What Exists (feature-flags.js - Lines 274-275)
```javascript
const requireBrandingExtraction = checkFeatureFlag('brandingExtraction');
const requireFirecrawlBranding = checkFeatureFlag('brandingExtraction.firecrawlBranding');
```

Both middlewares are:
- **Defined**: Lines 274-275 in `/middleware/feature-flags.js`
- **Exported**: Lines 325-326 in the module.exports
- **Functional**: Built on `checkFeatureFlag()` which validates organization feature flags from Supabase

#### What's Missing
- **NOT imported** in server.js
- **NOT applied** to the `/api/website-extraction/branding` endpoint

### 2. Branding Endpoint Implementation

**Location**: `/UberEats-Image-Extractor/server.js` (Lines 7043-7177)

#### Current Implementation
```javascript
app.post('/api/website-extraction/branding', async (req, res) => {
  // No feature flag middleware applied
  // ...
```

**Issue**: The endpoint is completely unprotected by feature flags. Any authenticated user can call it regardless of their organization's feature flag settings.

### 3. Usage Tracking Implementation

#### Status: FULLY IMPLEMENTED ✓

**Location**: server.js (Lines 7131-7150)

```javascript
// Track branding extraction usage
try {
  // Get organisation_id from restaurant
  const { data: restaurant } = await db.supabase
    .from('restaurants')
    .select('organisation_id')
    .eq('id', restaurantId)
    .single();

  if (restaurant?.organisation_id) {
    UsageTrackingService.trackBrandingExtraction(restaurant.organisation_id, {
      restaurant_id: restaurantId,
      url: sourceUrl,
      has_logo: !!brandingResult.images?.logoUrl,
      confidence: brandingResult.confidence
    }).catch(err => console.error('[UsageTracking] Failed to track branding extraction:', err));
  }
} catch (trackingError) {
  console.error('[UsageTracking] Error getting organisation for tracking:', trackingError);
}
```

#### Metadata Being Tracked
- **restaurant_id** ✓ - Restaurant UUID
- **url** ✓ - The source URL being extracted from
- **has_logo** - Boolean indicating if logo was found
- **confidence** - Confidence score from Firecrawl

#### Event Type
- **Constant Defined**: `UsageEventType.FIRECRAWL_BRANDING_EXTRACTION` (line 56 of usage-tracking-service.js)
- **Billing Rate**: $0.20 per extraction (line 90)
- **Service Method**: `UsageTrackingService.trackBrandingExtraction()` (lines 303-305)

#### Required Metadata vs Actual Metadata
| Required | Actual | Status |
|----------|--------|--------|
| url | url | ✓ Implemented |
| restaurant_id | restaurant_id | ✓ Implemented |
| candidates_found | - | ✗ Missing |

**Gap**: The `candidates_found` metadata field is not being tracked. This would be useful for understanding extraction quality.

### 4. Environment Variable Override

**Current Status**: NOT FOUND ✗

The USE_FIRECRAWL_BRANDING_FORMAT env variable mentioned in the requirements is not referenced anywhere in the codebase.

**Location Note**: Line 7045 mentions "Feature-flagged via USE_FIRECRAWL_BRANDING_FORMAT env variable" in a comment, but this is not actually implemented.

### 5. Feature Flag Service Setup

#### How Feature Flags Work
1. Feature flags stored in `organisations.feature_flags` JSONB column (Supabase)
2. `checkFeatureFlag()` creates middleware that:
   - Checks if user is authenticated
   - Gets organization ID from `req.user.organisationId`
   - Fetches feature flags from database or cache
   - Uses dot notation to support nested flags (e.g., 'brandingExtraction.firecrawlBranding')
   - Returns 403 if feature not enabled
3. Middleware attaches `req.featureConfig` and `req.featureFlags` to request

#### Expected Feature Flag Path
Based on implementation, the flag should be at:
- **Primary**: `organisations.feature_flags.brandingExtraction`
- **Secondary**: `organisations.feature_flags.brandingExtraction.firecrawlBranding`

---

## Code Snippets

### Feature Flag Middleware (Exists but Not Used)
**File**: `/UberEats-Image-Extractor/middleware/feature-flags.js`

Lines 274-275:
```javascript
const requireBrandingExtraction = checkFeatureFlag('brandingExtraction');
const requireFirecrawlBranding = checkFeatureFlag('brandingExtraction.firecrawlBranding');
```

Lines 325-326 (exports):
```javascript
  // NEW: Branding Extraction
  requireBrandingExtraction,
  requireFirecrawlBranding,
```

### How to Import (Currently Missing)
**File**: `/UberEats-Image-Extractor/server.js` Lines 52-59

Currently imports:
```javascript
const {
  requireTasksAndSequences,
  requireSocialMedia,
  requireLeadScraping,
  requireRegistration,
  getFeatureFlags
} = require('./middleware/feature-flags');
```

**Missing**: `requireBrandingExtraction` and/or `requireFirecrawlBranding` should be added to this import

### Endpoint (Currently Unprotected)
**File**: `/UberEats-Image-Extractor/server.js` Lines 7047-7177

```javascript
app.post('/api/website-extraction/branding', async (req, res) => {
  // ISSUE: No feature flag middleware!
  // Should be:
  // app.post('/api/website-extraction/branding', 
  //   authMiddleware, 
  //   requireFirecrawlBranding,  // MISSING
  //   async (req, res) => {
```

### Usage Tracking Service (Working Correctly)
**File**: `/UberEats-Image-Extractor/src/services/usage-tracking-service.js`

Lines 303-305:
```javascript
static async trackBrandingExtraction(organisationId, metadata = {}) {
  await this.trackEvent(organisationId, UsageEventType.FIRECRAWL_BRANDING_EXTRACTION, 1, metadata);
}
```

Line 56 (Event Type):
```javascript
FIRECRAWL_BRANDING_EXTRACTION: 'firecrawl_branding_extraction',
```

Line 90 (Billing Rate):
```javascript
[UsageEventType.FIRECRAWL_BRANDING_EXTRACTION]: 0.20,
```

---

## Missing Components

1. **Feature Flag Middleware Import**: Not imported in server.js
2. **Feature Flag Middleware Application**: Not applied to endpoint
3. **USE_FIRECRAWL_BRANDING_FORMAT Override**: Comment exists but not implemented
4. **candidates_found Metadata**: Not tracked in usage events
5. **Authentication Middleware**: Not applied to endpoint (should use authMiddleware)

---

## Implementation Checklist

### Critical (Blocking)
- [ ] Import `requireBrandingExtraction` and `requireFirecrawlBranding` from feature-flags.js
- [ ] Apply `requireFirecrawlBranding` middleware to `/api/website-extraction/branding` endpoint
- [ ] Apply `authMiddleware` to endpoint (required before feature flag check)

### Important (Nice to Have)
- [ ] Add `candidates_found` field to usage tracking metadata
- [ ] Implement `USE_FIRECRAWL_BRANDING_FORMAT` env variable override if needed
- [ ] Document the feature flag paths in Supabase setup guide

### Testing
- [ ] Verify feature flag blocks access when `brandingExtraction.firecrawlBranding` is disabled
- [ ] Verify endpoint accessible when `brandingExtraction.firecrawlBranding` is enabled
- [ ] Verify usage events are tracked correctly with all metadata

---

## Recommendations

### Priority 1: Apply Feature Flag Middleware
The endpoint needs immediate protection. Once the middleware is applied:
1. Only organizations with `brandingExtraction.firecrawlBranding` feature enabled can call the endpoint
2. Unauthorized requests will receive a 403 status with helpful error messages
3. Billing can be properly enforced per organization

### Priority 2: Enhance Usage Tracking Metadata
Add `candidates_found` to track extraction quality:
```javascript
UsageTrackingService.trackBrandingExtraction(restaurant.organisation_id, {
  restaurant_id: restaurantId,
  url: sourceUrl,
  has_logo: !!brandingResult.images?.logoUrl,
  candidates_found: brandingResult.rawBranding?.candidates?.length || 0,
  confidence: brandingResult.confidence
})
```

### Priority 3: Consider Environment Override
If organizations need to override feature flags without database changes during testing:
```javascript
const OVERRIDE_BRANDING = process.env.USE_FIRECRAWL_BRANDING_FORMAT === 'true';

app.post('/api/website-extraction/branding',
  authMiddleware,
  (req, res, next) => {
    if (OVERRIDE_BRANDING) {
      next();
    } else {
      requireFirecrawlBranding(req, res, next);
    }
  },
  // ... rest of endpoint
```

---

## Database Schema Notes

The feature flags are stored in the `organisations` table:
- **Table**: `organisations`
- **Column**: `feature_flags` (JSONB)
- **Example Structure**:
```json
{
  "brandingExtraction": {
    "enabled": true,
    "firecrawlBranding": {
      "enabled": true
    }
  }
}
```

The usage tracking writes to:
- **Table**: `usage_events`
- **Columns**: organisation_id, event_type, quantity, metadata, created_at

---

## Related Files

- `/UberEats-Image-Extractor/server.js` - Endpoint implementation
- `/UberEats-Image-Extractor/middleware/feature-flags.js` - Feature flag definitions
- `/UberEats-Image-Extractor/src/services/usage-tracking-service.js` - Usage tracking
- `/UberEats-Image-Extractor/src/services/logo-extraction-service.js` - Logo extraction service
- `/UberEats-Image-Extractor/src/services/database-service.js` - Database operations
- `SUPER-ADMIN-PHASE-4-IMPLEMENTATION.md` - Original task requirements

---

## Investigation Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Feature flag middleware exists | ✓ Complete | Defined and exported in feature-flags.js |
| Feature flag middleware imported | ✗ Missing | Not in server.js imports |
| Feature flag middleware applied | ✗ Missing | Not on endpoint |
| Usage tracking implemented | ✓ Complete | Fully working with metadata |
| Usage tracking metadata - url | ✓ Complete | Tracked |
| Usage tracking metadata - restaurant_id | ✓ Complete | Tracked |
| Usage tracking metadata - candidates_found | ✗ Missing | Not tracked |
| Environment override | ✗ Missing | Mentioned in comment but not implemented |
| Overall Task Status | **PARTIAL** | 40% complete - Need to apply middleware |

---

## Next Steps

1. **Immediate**: Apply feature flag middleware to endpoint
2. **Follow-up**: Add candidates_found metadata tracking
3. **Enhancement**: Implement environment variable override if needed
4. **Testing**: Verify feature flag access control works correctly
5. **Documentation**: Update database setup guide with feature flag structure

---

*Investigation completed: December 8, 2025*
*Investigator: Claude Code AI*
