# Configurable LOGIN_URL and Country Settings - Implementation Progress

**Date:** 2025-12-10 (Updated)
**Status:** Complete - Timezone configuration added
**Reference:** [CONFIGURABLE-LOGIN-URL-AND-COUNTRY-SETTINGS-ROADMAP.md](./CONFIGURABLE-LOGIN-URL-AND-COUNTRY-SETTINGS-ROADMAP.md)
**Timezone Plan:** [ADD-TIMEZONE-CONFIGURATION-PLAN.md](./ADD-TIMEZONE-CONFIGURATION-PLAN.md)

---

## Summary

This document tracks the implementation progress for making CloudWaitress admin portal URLs and country-specific settings configurable per organization.

---

## Completed Work

### Phase 1: Database Schema ✅

The Pumpd HQ organisation has been updated with the new settings structure:

```json
{
  "country": "NZ",
  "cloudwaitress": {
    "secret": "CWS_xxxx-xxxx-xxxx-xxxx",
    "api_url": "https://api.cloudwaitress.com",
    "country": "NZ",
    "admin_url": "https://admin.pumpd.co.nz",
    "integrator_id": "CWI_xxxx-xxxx-xxxx-xxxx"
  }
}
```

**New fields added:**
- `settings.country` - Top-level country for system-wide settings (Firecrawl searches)
- `settings.cloudwaitress.admin_url` - Whitelabel admin portal URL
- `settings.cloudwaitress.country` - CloudWaitress-specific country settings

---

### Phase 2: Country Configuration ✅

**File:** `/scripts/lib/country-config.js`

Created centralized country configuration with support for:
- **NZ** (New Zealand) - Default
- **AU** (Australia)
- **US** (United States)
- **GB** (United Kingdom)
- **CA** (Canada)

Each country config includes:
- `locale` - Display name for CloudWaitress locale selection
- `timezoneDisplay` - Timezone city name (e.g., "Auckland", "Sydney")
- `currency` - Currency code (NZD, AUD, USD, etc.)
- `phonePrefix` - Country phone prefix (+64, +61, etc.)
- `gstRate` - Tax rate percentage (15 for NZ, 10 for AU, etc.)
- `gstName` - Tax name (GST, VAT, Tax)
- `searchCountry` - Country name for Firecrawl search queries
- `deliveryPlatformDomains` - List of delivery platform domains for that country

**Helper functions exported:**
- `getCountryConfig(code)` - Get config for a country code
- `formatPhoneNumber(phone, country)` - Format phone with country prefix
- `getAdminHostname(url)` - Extract hostname for waitForURL patterns
- `buildLoginUrl(adminUrl)` - Build login URL from base
- `buildRegistrationUrl(adminUrl)` - Build registration URL from base

---

### Phase 3: Backend Services ✅

#### 3.1 Organization Settings Service
**File:** `/UberEats-Image-Extractor/src/services/organization-settings-service.js`

Updated to handle:
- `getCloudWaitressConfig()` - Returns adminUrl and country in response
- `updateCloudWaitressConfig()` - Accepts adminUrl and country parameters

#### 3.2 Organization Settings Routes
**File:** `/UberEats-Image-Extractor/src/routes/organization-settings-routes.js`

Updated PUT endpoint to accept and save:
- `adminUrl`
- `country`

#### 3.3 Registration Routes
**File:** `/UberEats-Image-Extractor/src/routes/registration-routes.js`

Updated to:
- Fetch organization's CloudWaitress config including adminUrl and country
- Pass `--admin-url` and `--country` arguments to spawned scripts

---

### Phase 4: Script Updates (Partial) ⚠️

#### 4.1 First Script Updated ✅
**File:** `/scripts/restaurant-registration/login-and-register-restaurant.js`

Changes made:
1. Added new CLI arguments:
   - `--admin-url=<url>` - Admin portal URL (defaults to `https://admin.pumpd.co.nz`)
   - `--country=<code>` - Country code (defaults to `NZ`)

2. Imported country config:
   ```javascript
   const { getCountryConfig, getAdminHostname, buildLoginUrl } = require('../lib/country-config');
   const countryConfig = getCountryConfig(country);
   ```

3. Dynamic URL construction:
   ```javascript
   const LOGIN_URL = buildLoginUrl(adminUrl);
   const adminHostname = getAdminHostname(adminUrl);
   ```

4. Dynamic waitForURL patterns:
   ```javascript
   await page.waitForURL(`**/${adminHostname}/**`, { timeout: 15000 });
   ```

5. Country-specific values:
   ```javascript
   // STEP 12: Set System Locale
   await page.keyboard.type(countryConfig.locale);  // "New Zealand" or "Australia"

   // STEP 13: Set Timezone
   await page.keyboard.type(countryConfig.timezoneDisplay);  // "Auckland" or "Sydney"

   // STEP 14: Set Currency
   await page.keyboard.type(countryConfig.currency);  // "NZD" or "AUD"
   ```

#### 4.2 Scripts NOT Yet Updated ❌

The following scripts still have hardcoded values and need updating:

| Script | LOGIN_URL | waitForURL | Country Values |
|--------|-----------|------------|----------------|
| `scripts/setup-stripe-payments.js` | Line 44 | Lines 103, 284 | Currency NZD |
| `scripts/setup-stripe-payments-no-link.js` | Line 44 | Lines 103, 284 | Currency NZD |
| `scripts/setup-system-settings.js` | Line 40 | Lines 112, 130 | Phone +64, GST 15% |
| `scripts/setup-system-settings-user.js` | Line 48 | Lines 193, 303 | Phone +64, GST 15% |
| `scripts/create-api-key.js` | ✓ | ✓ | - |
| `scripts/create-api-key-user.js` | ✓ | ✓ | - |
| `scripts/edit-website-settings-light.js` | ✓ | ✓ | - |
| `scripts/edit-website-settings-dark.js` | ✓ | ✓ | - |
| `scripts/finalise-onboarding.js` | ✓ | ✓ | - |
| `scripts/finalise-onboarding-user.js` | ✓ | ✓ | - |
| `scripts/restaurant-registration/register-restaurant-production.js` | ✓ | ✓ | Locale, Timezone, Currency |

---

### Phase 5: Firecrawl Search Updates (Partial) ⚠️

**File:** `/UberEats-Image-Extractor/server.js`

Work has begun on updating Firecrawl searches to use dynamic country settings, but **verification is required**.

#### Known Endpoints with Country in Search Queries

The following endpoints construct search queries with hardcoded "New Zealand":

1. **`/api/google-business-search`** (~Line 5145-5155)
   - Searches for restaurant business information
   - Current: `"${restaurantName}" "${city}" New Zealand`
   - Needs: Dynamic country from organization settings

2. **`/api/delivery-url-search`** (~Line 5267)
   - Searches for delivery platform URLs
   - Current: May include "New Zealand" in queries
   - Needs: Dynamic country

3. **`/api/extract-menu`** or similar endpoints (~Line 5870-5900+)
   - May construct search queries for menu sources
   - Needs verification

#### How to Find All Hardcoded Country References

Search commands to locate all instances:
```bash
# In server.js
grep -n "New Zealand" UberEats-Image-Extractor/server.js
grep -n "searchCountry" UberEats-Image-Extractor/server.js

# Check if country config is being imported/used
grep -n "country-config" UberEats-Image-Extractor/server.js
grep -n "getCountryConfig" UberEats-Image-Extractor/server.js
```

#### Implementation Pattern for Firecrawl Searches

When updating endpoints, follow this pattern:

```javascript
// 1. Get organization ID from authenticated user
const organisationId = req.user?.organisationId;

// 2. Fetch organization settings
const { data: org } = await supabase
  .from('organisations')
  .select('settings')
  .eq('id', organisationId)
  .single();

// 3. Get country from settings (fallback to NZ)
const countryCode = org?.settings?.country || org?.settings?.cloudwaitress?.country || 'NZ';

// 4. Get country config
const { getCountryConfig } = require('./scripts/lib/country-config');
const countryConfig = getCountryConfig(countryCode);

// 5. Use in search query
const searchQuery = `"${restaurantName}" "${city}" ${countryConfig.searchCountry}`;
```

---

### Phase 6: Frontend Updates ✅

#### 6.1 Settings Page
**File:** `/UberEats-Image-Extractor/src/pages/Settings.tsx`

Added to CloudWaitress configuration section:
- Admin Portal URL input field
- Country dropdown (NZ, AU, US, GB, CA)
- Timezone dropdown (dynamically populated based on country)
- State management for `newAdminUrl`, `newCountry`, `newTimezone`
- Updated `loadCloudWaitressConfig()` to pre-fill values and load timezones
- Updated `saveCloudWaitressConfig()` to include new fields

#### 6.2 Super Admin Organization Edit Modal
**File:** `/UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`

Added to Integrations tab:
- Admin Portal URL input field
- Country dropdown with same options
- Timezone dropdown (populated from TIMEZONE_OPTIONS constant)
- Proper state management through organization.settings.cloudwaitress

---

### Phase 7: Timezone Configuration ✅ (Added 2025-12-10)

**Reference:** [ADD-TIMEZONE-CONFIGURATION-PLAN.md](./ADD-TIMEZONE-CONFIGURATION-PLAN.md)

#### 7.1 Country Configuration Updates
**Files:** `/scripts/lib/country-config.js` and `/scripts/lib/country-config.cjs`

Added to each country config:
- `timezones` array with `{iana, display, city}` objects for each timezone
- Helper functions: `getTimezonesForCountry()`, `getTimezoneDisplayName()`, `isValidTimezoneForCountry()`

Timezone data:
- **NZ**: Auckland, Chatham
- **AU**: Sydney, Melbourne, Brisbane, Perth, Adelaide, Darwin, Hobart
- **US**: New York (ET), Chicago (CT), Denver (MT), Los Angeles (PT), Phoenix (MST), Anchorage (AKT), Honolulu (HST)
- **GB**: London
- **CA**: Toronto (ET), Winnipeg (CT), Edmonton (MT), Vancouver (PT), Halifax (AT), St. John's (NT)

#### 7.2 Backend Service Updates
**File:** `/UberEats-Image-Extractor/src/services/organization-settings-service.js`

- `updateCloudWaitressConfig()` now handles `timezone` field
- `getCloudWaitressConfigMasked()` returns `timezone`
- `getScriptConfig()` returns `timezone` and `timezoneDisplay`
- `getSettingsForDisplay()` includes `timezone`

#### 7.3 API Route Updates
**File:** `/UberEats-Image-Extractor/src/routes/organization-settings-routes.js`

- PUT `/cloudwaitress` accepts `timezone` parameter
- GET `/timezones` returns available timezones for org's country
- GET `/timezones/:countryCode` returns timezones for a specific country

#### 7.4 Registration Route Updates
**File:** `/UberEats-Image-Extractor/src/routes/registration-routes.js`

- Added `--timezone` argument to script command
- Passes `scriptConfig.timezoneDisplay` to scripts

#### 7.5 Script Updates
**File:** `/scripts/restaurant-registration/login-and-register-restaurant.js`

- Accepts `--timezone` argument (defaults to `countryConfig.timezoneDisplay`)
- Uses `timezone` variable in STEP 13 (Set Timezone)
- Logs timezone in configuration output and success message

---

## Next Steps

### Immediate (Next Session)

1. **Verify Firecrawl Search Updates**
   - Search server.js for all "New Zealand" references
   - Check if country config is properly imported
   - Verify all search endpoints use dynamic country
   - Document any additional endpoints that need updating

2. **Test First Script Locally**
   - Start the development server
   - Navigate to Settings page
   - Verify Admin URL and Country fields display correctly
   - Test saving configuration
   - Run `login-and-register-restaurant.js` with test parameters
   - Verify it uses the configured admin URL and country settings

### After Successful Testing

3. **Update Remaining Scripts**
   Apply the same pattern from `login-and-register-restaurant.js` to:
   - `setup-stripe-payments.js`
   - `setup-stripe-payments-no-link.js`
   - `setup-system-settings.js`
   - `setup-system-settings-user.js`
   - `create-api-key.js` / `create-api-key-user.js`
   - `edit-website-settings-light.js` / `edit-website-settings-dark.js`
   - `finalise-onboarding.js` / `finalise-onboarding-user.js`
   - `register-restaurant-production.js`

---

## File Reference Quick Links

### Configuration
- Country Config: [/scripts/lib/country-config.js](../../../../../scripts/lib/country-config.js)

### Backend
- Organization Settings Service: [/UberEats-Image-Extractor/src/services/organization-settings-service.js](../../../../../UberEats-Image-Extractor/src/services/organization-settings-service.js)
- Organization Settings Routes: [/UberEats-Image-Extractor/src/routes/organization-settings-routes.js](../../../../../UberEats-Image-Extractor/src/routes/organization-settings-routes.js)
- Registration Routes: [/UberEats-Image-Extractor/src/routes/registration-routes.js](../../../../../UberEats-Image-Extractor/src/routes/registration-routes.js)
- Server (Firecrawl): [/UberEats-Image-Extractor/server.js](../../../../../UberEats-Image-Extractor/server.js)

### Frontend
- Settings Page: [/UberEats-Image-Extractor/src/pages/Settings.tsx](../../../../../UberEats-Image-Extractor/src/pages/Settings.tsx)
- Organization Edit Modal: [/UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx](../../../../../UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx)

### Scripts (First Updated)
- Login & Register: [/scripts/restaurant-registration/login-and-register-restaurant.js](../../../../../scripts/restaurant-registration/login-and-register-restaurant.js)

### Scripts (Need Updating)
- Setup Stripe Payments: [/scripts/setup-stripe-payments.js](../../../../../scripts/setup-stripe-payments.js)
- Setup Stripe No Link: [/scripts/setup-stripe-payments-no-link.js](../../../../../scripts/setup-stripe-payments-no-link.js)
- Setup System Settings: [/scripts/setup-system-settings.js](../../../../../scripts/setup-system-settings.js)
- Setup System Settings User: [/scripts/setup-system-settings-user.js](../../../../../scripts/setup-system-settings-user.js)

---

## Testing Checklist

### Frontend Testing
- [ ] Settings page loads Admin URL and Country from API
- [ ] Can edit and save Admin URL
- [ ] Can edit and save Country selection
- [ ] Super Admin modal shows correct values
- [ ] Super Admin can edit and save values

### Script Testing
- [ ] `login-and-register-restaurant.js` accepts `--admin-url` argument
- [ ] `login-and-register-restaurant.js` accepts `--country` argument
- [ ] Script uses correct locale for selected country
- [ ] Script uses correct timezone for selected country
- [ ] Script uses correct currency for selected country
- [ ] waitForURL patterns work with custom admin URLs

### Firecrawl Testing
- [ ] Business search uses organization's country
- [ ] Delivery URL search uses organization's country
- [ ] All search results are relevant to configured country
