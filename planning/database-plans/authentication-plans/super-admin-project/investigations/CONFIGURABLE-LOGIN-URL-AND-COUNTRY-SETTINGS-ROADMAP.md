# Configurable LOGIN_URL and Country Settings Implementation Roadmap

## Overview

This document outlines the implementation plan for making CloudWaitress admin portal URLs and country-specific settings configurable per organization. This enables support for CloudWaitress resellers with whitelabeled admin portals and international clients.

**Date:** 2025-12-09
**Status:** Planning
**Priority:** High

---

## Problem Statement

### Current Limitations

1. **Hardcoded Admin Portal URLs**: All Playwright automation scripts have `admin.pumpd.co.nz` hardcoded:
   - `LOGIN_URL = "https://admin.pumpd.co.nz/login"`
   - `REGISTRATION_URL = "https://admin.pumpd.co.nz/register"`
   - `await page.waitForURL('**/admin.pumpd.co.nz/**', ...)`

2. **Hardcoded Country Settings**: Scripts use NZ-specific values:
   - Locale: "New Zealand"
   - Timezone: "Auckland"
   - Currency: "NZD"
   - Phone prefix: "+64"
   - GST rate: 15%

3. **Hardcoded Search Queries**: Server-side Firecrawl searches include "New Zealand" in queries

### Impact

- Cannot support CloudWaitress resellers with their own whitelabeled admin portals
- Cannot serve Australian or other international clients without code changes
- Every new reseller requires manual script modifications

---

## Affected Files

### Scripts with Hardcoded Admin URLs (Primary - Need Modification)

| File | LOGIN_URL | waitForURL | Notes |
|------|-----------|------------|-------|
| `scripts/restaurant-registration/login-and-register-restaurant.js` | ✓ | ✓ | Also has country settings |
| `scripts/restaurant-registration/register-restaurant-production.js` | ✓ | ✓ | Also has country settings |
| `scripts/setup-stripe-payments.js` | ✓ | ✓ | Currency NZD |
| `scripts/setup-stripe-payments-no-link.js` | ✓ | ✓ | Currency NZD |
| `scripts/setup-system-settings.js` | ✓ | ✓ | Phone prefix +64, GST 15% |
| `scripts/setup-system-settings-user.js` | ✓ | ✓ | Phone prefix +64, GST 15% |
| `scripts/create-api-key.js` | ✓ | ✓ | |
| `scripts/create-api-key-user.js` | ✓ | ✓ | |
| `scripts/edit-website-settings-light.js` | ✓ | ✓ | |
| `scripts/edit-website-settings-dark.js` | ✓ | ✓ | |
| `scripts/finalise-onboarding.js` | ✓ | ✓ | |
| `scripts/finalise-onboarding-user.js` | ✓ | ✓ | |

### Scripts with Country-Specific Settings

| File | Locale | Timezone | Currency | Phone | GST |
|------|--------|----------|----------|-------|-----|
| `scripts/restaurant-registration/login-and-register-restaurant.js` | ✓ | ✓ | ✓ | | |
| `scripts/restaurant-registration/register-restaurant-production.js` | ✓ | ✓ | ✓ | | |
| `scripts/setup-stripe-payments.js` | | | ✓ | | |
| `scripts/setup-stripe-payments-no-link.js` | | | ✓ | | |
| `scripts/setup-system-settings.js` | | | | ✓ | ✓ |
| `scripts/setup-system-settings-user.js` | | | | ✓ | ✓ |

### Server Files with Hardcoded Country

| File | Location | Usage |
|------|----------|-------|
| `UberEats-Image-Extractor/server.js` | Lines 5145-5155, 5175, 5267, 5870-5900+ | "New Zealand" in Firecrawl search queries |

### Files That Do NOT Need Modification

These access `manage.pumpd.co.nz` (our own application, not CloudWaitress):
- Scripts under `/scripts/menu-import/`
- Any script accessing the Pumpd menu management system

---

## Proposed Solution

### Phase 1: Database Schema Updates

#### 1.1 Extend CloudWaitress Settings

Update the `organisations.settings.cloudwaitress` JSONB structure:

```json
{
  "cloudwaitress": {
    "integrator_id": "CWI_xxxx-xxxx-xxxx-xxxx",
    "secret": "CWS_xxxx-xxxx-xxxx-xxxx",
    "api_url": "https://api.cloudwaitress.com",
    "admin_url": "https://admin.pumpd.co.nz",
    "country": "NZ",
    "updated_at": "2025-01-08T00:00:00.000Z"
  }
}
```

**New fields:**
- `admin_url`: The whitelabeled CloudWaitress admin portal URL (e.g., `https://admin.pumpd.co.nz`, `https://admin.customreseller.com`)
- `country`: ISO country code (e.g., `NZ`, `AU`, `US`)

#### 1.2 Add System-Wide Country Setting

Add to `organisations.settings`:

```json
{
  "country": "NZ",
  "cloudwaitress": { ... }
}
```

This top-level `country` affects:
- Search queries (Firecrawl)
- Default locale/timezone/currency suggestions
- Phone number formatting

---

### Phase 2: Country Configuration Mapping

Create a centralized country configuration file:

**File:** `scripts/lib/country-config.js`

```javascript
const COUNTRY_CONFIG = {
  NZ: {
    name: 'New Zealand',
    locale: 'New Zealand',
    timezone: 'Pacific/Auckland',
    timezoneDisplay: 'Auckland',
    currency: 'NZD',
    phonePrefix: '+64',
    gstRate: 15,
    searchCountry: 'New Zealand',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'delivereasy.co.nz',
      'meandyou.co.nz',
      'mobi2go.com',
      'nextorder.co.nz',
      'foodhub.co.nz',
      'ordermeal.co.nz'
    ]
  },
  AU: {
    name: 'Australia',
    locale: 'Australia',
    timezone: 'Australia/Sydney',
    timezoneDisplay: 'Sydney',
    currency: 'AUD',
    phonePrefix: '+61',
    gstRate: 10,
    searchCountry: 'Australia',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'menulog.com.au',
      'deliveroo.com.au'
    ]
  },
  US: {
    name: 'United States',
    locale: 'United States',
    timezone: 'America/New_York',
    timezoneDisplay: 'New York',
    currency: 'USD',
    phonePrefix: '+1',
    gstRate: 0, // No national GST in US
    searchCountry: 'United States',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'grubhub.com',
      'postmates.com'
    ]
  }
};

module.exports = { COUNTRY_CONFIG };
```

---

### Phase 3: Backend Service Updates

#### 3.1 Update OrganizationSettingsService

**File:** `UberEats-Image-Extractor/src/services/organization-settings-service.js`

Add methods:

```javascript
/**
 * Get full CloudWaitress configuration including admin URL and country
 */
static async getFullCloudWaitressConfig(organisationId) {
  // Returns: { integratorId, secret, apiUrl, adminUrl, country }
}

/**
 * Update CloudWaitress configuration with admin URL and country
 */
static async updateFullCloudWaitressConfig(organisationId, config) {
  // Accepts: { integratorId, secret, apiUrl, adminUrl, country }
}

/**
 * Get organization country setting
 */
static async getOrganizationCountry(organisationId) {
  // Returns country code or defaults to 'NZ'
}

/**
 * Update organization country setting
 */
static async updateOrganizationCountry(organisationId, country) {
  // Validates country code against COUNTRY_CONFIG
}
```

#### 3.2 Update API Endpoints

**File:** `UberEats-Image-Extractor/src/routes/organization-settings-routes.js`

Add endpoints:
- `GET /api/organization/settings/cloudwaitress/full` - Get full config including admin_url
- `PUT /api/organization/settings/cloudwaitress/full` - Update full config
- `GET /api/organization/settings/country` - Get organization country
- `PUT /api/organization/settings/country` - Update organization country

#### 3.3 Update Registration Routes

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

When spawning scripts, fetch organization settings and pass as arguments:

```javascript
// Fetch organization settings
const cwConfig = await OrganizationSettingsService.getFullCloudWaitressConfig(organisationId);
const countryConfig = await OrganizationSettingsService.getOrganizationCountry(organisationId);

// Build script arguments
const args = [
  scriptPath,
  `--admin-url=${cwConfig.adminUrl || 'https://admin.pumpd.co.nz'}`,
  `--country=${countryConfig || 'NZ'}`,
  // ... other args
];
```

---

### Phase 4: Script Modifications

#### 4.1 Common Pattern for All Scripts

Each script should:

1. **Accept new arguments:**
   ```javascript
   const adminUrl = getArg('admin-url') || process.env.CLOUDWAITRESS_ADMIN_URL || 'https://admin.pumpd.co.nz';
   const country = getArg('country') || process.env.DEFAULT_COUNTRY || 'NZ';
   ```

2. **Import country config:**
   ```javascript
   const { COUNTRY_CONFIG } = require('./lib/country-config');
   const countrySettings = COUNTRY_CONFIG[country] || COUNTRY_CONFIG['NZ'];
   ```

3. **Use dynamic URLs:**
   ```javascript
   const LOGIN_URL = `${adminUrl}/login`;
   const REGISTRATION_URL = `${adminUrl}/register`;
   ```

4. **Use dynamic URL patterns:**
   ```javascript
   // Extract hostname for wait patterns
   const adminHostname = new URL(adminUrl).hostname;
   await page.waitForURL(`**/${adminHostname}/**`, { timeout: 15000 });
   ```

5. **Use country-specific values:**
   ```javascript
   await page.keyboard.type(countrySettings.locale);      // "New Zealand" or "Australia"
   await page.keyboard.type(countrySettings.timezoneDisplay);  // "Auckland" or "Sydney"
   await page.keyboard.type(countrySettings.currency);    // "NZD" or "AUD"
   ```

#### 4.2 Script-by-Script Changes

**login-and-register-restaurant.js:**
```javascript
// Before:
await page.keyboard.type('New Zealand');
await page.keyboard.type('Auckland');
await page.keyboard.type('NZD');

// After:
await page.keyboard.type(countrySettings.locale);
await page.keyboard.type(countrySettings.timezoneDisplay);
await page.keyboard.type(countrySettings.currency);
```

**setup-system-settings-user.js:**
```javascript
// Before:
newPhone = '+64' + cleanPhone.substring(1);
await page.fill(taxRateInputSelector, '15');

// After:
newPhone = countrySettings.phonePrefix + cleanPhone.substring(1);
await page.fill(taxRateInputSelector, String(countrySettings.gstRate));
```

**setup-stripe-payments.js:**
```javascript
// Before:
await page.keyboard.type('NZD');

// After:
await page.keyboard.type(countrySettings.currency);
```

---

### Phase 5: Server-Side Search Updates

#### 5.1 Update Firecrawl Search Queries

**File:** `UberEats-Image-Extractor/server.js`

Modify search query construction to use organization country:

```javascript
// Get organization country from request context
const orgCountry = req.user?.organisationCountry || 'NZ';
const { COUNTRY_CONFIG } = require('./src/scripts/lib/country-config');
const countrySettings = COUNTRY_CONFIG[orgCountry] || COUNTRY_CONFIG['NZ'];

// Build search queries
const searchQueries = [
  `"${restaurantName}" "${city}" ${countrySettings.searchCountry} site:ubereats.com`,
  `"${restaurantName}" "${city}" ${countrySettings.searchCountry} site:doordash.com`,
  // ... dynamically build platform-specific queries
];
```

---

### Phase 6: Frontend Updates

#### 6.1 Settings Page

**File:** `UberEats-Image-Extractor/src/pages/Settings.tsx`

Add CloudWaitress Admin URL and Country fields:

```tsx
<div className="space-y-2">
  <Label htmlFor="admin-url">Admin Portal URL</Label>
  <Input
    id="admin-url"
    placeholder="https://admin.pumpd.co.nz"
    value={cloudwaitressConfig.adminUrl}
    onChange={(e) => setCloudwaitressConfig({
      ...cloudwaitressConfig,
      adminUrl: e.target.value
    })}
  />
  <p className="text-xs text-gray-500">
    Your CloudWaitress whitelabel admin portal URL
  </p>
</div>

<div className="space-y-2">
  <Label htmlFor="country">Country</Label>
  <Select
    value={cloudwaitressConfig.country}
    onValueChange={(value) => setCloudwaitressConfig({
      ...cloudwaitressConfig,
      country: value
    })}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select country" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="NZ">New Zealand</SelectItem>
      <SelectItem value="AU">Australia</SelectItem>
      <SelectItem value="US">United States</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### 6.2 Super Admin Organization Edit Modal

**File:** `UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`

Add fields in the Integrations tab:
- Admin Portal URL input
- Country dropdown

---

## Implementation Phases Summary

| Phase | Description | Estimated Effort |
|-------|-------------|------------------|
| 1 | Database schema updates | 1 hour |
| 2 | Country configuration mapping | 1 hour |
| 3 | Backend service updates | 2 hours |
| 4 | Script modifications (12+ scripts) | 4-6 hours |
| 5 | Server-side search updates | 2 hours |
| 6 | Frontend updates | 2 hours |
| **Total** | | **12-14 hours** |

---

## Testing Plan

### Unit Tests

1. `OrganizationSettingsService.getFullCloudWaitressConfig()` returns correct defaults
2. `OrganizationSettingsService.updateFullCloudWaitressConfig()` validates and saves
3. Country config returns correct values for each supported country

### Integration Tests

1. Scripts accept and use custom admin URL
2. Scripts use correct country-specific values
3. Firecrawl searches use organization country

### Manual Testing

1. Register restaurant with custom admin URL
2. Register restaurant for Australian organization
3. Configure payment settings for AU organization
4. Verify search results use correct country

---

## Rollout Plan

### Stage 1: Backend Infrastructure
1. Deploy database schema changes
2. Deploy country configuration
3. Deploy service updates
4. Deploy API endpoints

### Stage 2: Script Updates
1. Update and test each script individually
2. Maintain backward compatibility (default to NZ if no country specified)

### Stage 3: Frontend
1. Deploy Settings page updates
2. Deploy Super Admin updates

### Stage 4: Migration
1. Existing organizations default to NZ
2. New organizations must select country on creation

---

## Security Considerations

1. **URL Validation**: Validate admin URLs to prevent SSRF attacks
   - Must be HTTPS
   - Must be a valid CloudWaitress domain or whitelisted reseller domain

2. **Country Code Validation**: Only accept known country codes from `COUNTRY_CONFIG`

3. **Admin Access**: Only admin/super_admin can modify these settings

---

## Backward Compatibility

- All new fields default to current NZ values
- Scripts work without new arguments (use environment variables or defaults)
- Existing organizations continue to work unchanged

---

## Open Questions

1. Should we maintain a whitelist of valid CloudWaitress admin URLs?
2. Do we need to support multiple currencies per organization?
3. Should country selection be available at restaurant level (for multi-country organizations)?
4. What's the process for adding new countries to the configuration?

---

## Appendix: Environment Variables

New environment variables for defaults:

```env
# Default CloudWaitress admin URL
CLOUDWAITRESS_ADMIN_URL=https://admin.pumpd.co.nz

# Default country code
DEFAULT_COUNTRY=NZ
```

---

## File References

### Scripts to Modify
- `/scripts/restaurant-registration/login-and-register-restaurant.js`
- `/scripts/restaurant-registration/register-restaurant-production.js`
- `/scripts/setup-stripe-payments.js`
- `/scripts/setup-stripe-payments-no-link.js`
- `/scripts/setup-system-settings.js`
- `/scripts/setup-system-settings-user.js`
- `/scripts/create-api-key.js`
- `/scripts/create-api-key-user.js`
- `/scripts/edit-website-settings-light.js`
- `/scripts/edit-website-settings-dark.js`
- `/scripts/finalise-onboarding.js`
- `/scripts/finalise-onboarding-user.js`

### Backend Files
- `/UberEats-Image-Extractor/src/services/organization-settings-service.js`
- `/UberEats-Image-Extractor/src/routes/organization-settings-routes.js`
- `/UberEats-Image-Extractor/src/routes/registration-routes.js`
- `/UberEats-Image-Extractor/server.js`

### Frontend Files
- `/UberEats-Image-Extractor/src/pages/Settings.tsx`
- `/UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`