# Investigation: Feature Flags, Organization Settings & Usage Tracking

## Feature Flags Storage & Structure

**Storage Location:** `organisations.feature_flags` JSONB column in Supabase

**Structure Examples:**
```javascript
// Simple boolean
{ googleSearchExtraction: true }

// Object with metadata
{ googleSearchExtraction: { enabled: true, ratePerItem: 0.05 } }

// Nested features
{
  registration: {
    enabled: true,
    userAccountRegistration: { enabled: true },
    menuUploading: { enabled: true }
  }
}
```

## Backend Feature Flag Middleware

**Location:** `/UberEats-Image-Extractor/middleware/feature-flags.js`

**Key Functions:**
- `checkFeatureFlag(featureName)` - Creates blocking middleware (returns 403 if disabled)
- `checkFeatureFlagOptional(featureName)` - Non-blocking check
- Supports dot notation: `'registration.menuUploading'`

**Pre-built Exports:**
```javascript
requireGoogleSearch, requireBrandingExtraction, requireLeadScraping,
requireRegistration, requireRegistrationMenuUpload, // ...etc
```

**Usage Pattern:**
```javascript
app.post('/api/endpoint', authMiddleware, requireGoogleSearch, async (req, res) => {
  // Handler
});
```

## Frontend Feature Flag Hook

**Location:** `/UberEats-Image-Extractor/src/hooks/useFeatureFlags.ts`

**Usage:**
```javascript
const { isFeatureEnabled } = useFeatureFlags();
if (isFeatureEnabled('contactExtraction')) { /* show UI */ }
```

**Route Protection:** `<FeatureProtectedRoute featurePath="featureName">`

## Organization Settings Service

**Location:** `/UberEats-Image-Extractor/src/services/organization-settings-service.js`

**Key Methods:**
- `getOrganizationCountry(orgId)` → Country code (default: 'NZ')
- `getSearchCountry(orgId)` → Human-readable ('New Zealand')
- `getScriptConfig(orgId)` → Full config object

## Usage Tracking Service

**Location:** `/UberEats-Image-Extractor/src/services/usage-tracking-service.js`

**Event Types:**
```javascript
UsageEventType.GOOGLE_SEARCH: 0.05,
UsageEventType.LEAD_SCRAPE_API_CALL: 0.05,
UsageEventType.FIRECRAWL_BRANDING_EXTRACTION: 0.20,
```

**Tracking Pattern:**
```javascript
UsageTrackingService.trackEvent(orgId, UsageEventType.GOOGLE_SEARCH, 1, {
  restaurant_name: name,
  city: city
}).catch(err => console.error(err)); // Non-blocking
```

## Recommendations for Contact Extraction

**New Feature Flag:**
```javascript
contactDetailsExtraction: { enabled: true, ratePerItem: 0.10 }
```

**New Middleware:**
```javascript
const requireContactDetailsExtraction = checkFeatureFlag('contactDetailsExtraction');
```

**New Usage Event Types:**
```javascript
CONTACT_DETAILS_EXTRACTION: 0.10,
COMPANIES_OFFICE_LOOKUP: 0.15,
EMAIL_PHONE_EXTRACTION: 0.05
```
