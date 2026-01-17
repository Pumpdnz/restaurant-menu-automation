# Firecrawl Endpoints Investigation Guide

## Overview

This guide documents the investigation needed to ensure organization settings are being passed correctly to Firecrawl endpoints. The Playwright automation scripts have been updated to accept configurable settings, but we need to verify that the menu extraction and other Firecrawl-based endpoints are also using organization-specific configurations.

## Background

### Completed Work

All Playwright automation scripts have been updated to accept `--admin-url` and `--country` arguments:

| Script | Settings Added | Route Updated |
|--------|----------------|---------------|
| `scripts/restaurant-registration/login-and-register-restaurant.js` | `--admin-url`, `--country`, `--timezone` | `/register-restaurant` |
| `scripts/restaurant-registration/add-item-tags.js` | `--admin-url` | `/add-item-tags` |
| `scripts/restaurant-registration/add-option-sets.js` | `adminUrl` (via payload) | `/add-option-sets` |
| `scripts/restaurant-registration/import-csv-menu.js` | `--admin-url` | `/upload-csv-menu` |
| `scripts/edit-website-settings-dark.js` | `--admin-url` | `/configure-website` |
| `scripts/edit-website-settings-light.js` | `--admin-url` | `/configure-website` |
| `scripts/setup-system-settings-user.js` | `--admin-url`, `--country` | `/setup-system-settings` |
| `scripts/setup-services-settings.js` | `--admin-url` | `/configure-services` |
| `scripts/setup-stripe-payments-no-link.js` | `--admin-url`, `--country` | `/configure-payment` |
| `scripts/setup-stripe-payments.js` | `--admin-url`, `--country` | `/configure-payment` |
| `scripts/finalise-onboarding-user.js` | `--admin-url` | `/configure-uber-integration` |
| `scripts/create-api-key-user.js` | `--admin-url` | `/create-api-key` |

### Country Configuration Library

**Path:** `scripts/lib/country-config.js` (ES modules) and `scripts/lib/country-config.cjs` (CommonJS)

**Available Functions:**
- `getCountryConfig(countryCode)` - Returns full config for a country
- `getAdminHostname(adminUrl)` - Extracts hostname from admin URL
- `buildLoginUrl(adminUrl)` - Builds login URL from admin URL
- `getTimezonesForCountry(countryCode)` - Returns available timezones

---

## Investigation Required

### 1. Firecrawl Menu Extraction Endpoints

The menu extraction system uses Firecrawl to scrape menus from UberEats and DoorDash. We need to check if these endpoints need organization-specific settings.

**Files to investigate:**

1. **Server routes:**
   - `UberEats-Image-Extractor/server.js` - Main server file
   - Look for Firecrawl API calls and check if they use any organization-specific settings

2. **API service:**
   - `UberEats-Image-Extractor/src/services/api.js` - API service layer
   - Check for any hardcoded URLs or country-specific logic

3. **Menu extraction routes:**
   - Search for routes that handle menu extraction
   - Check if they access `organisationId` and use `OrganizationSettingsService`

**Questions to answer:**
- Do Firecrawl endpoints need country-specific settings (e.g., for currency formatting)?
- Are there any hardcoded NZ-specific values in the extraction logic?
- Does the extraction need to know the target admin portal URL?

### 2. Search for Hardcoded Values

Run these searches to find potentially hardcoded values:

```bash
# Search for hardcoded NZ-specific values
grep -rn "pumpd.co.nz" UberEats-Image-Extractor/src/
grep -rn "NZD" UberEats-Image-Extractor/src/
grep -rn "+64" UberEats-Image-Extractor/src/
grep -rn "GST" UberEats-Image-Extractor/src/

# Search for Firecrawl usage
grep -rn "firecrawl" UberEats-Image-Extractor/
grep -rn "FIRECRAWL" UberEats-Image-Extractor/
```

### 3. Organization Settings Service

**File:** `UberEats-Image-Extractor/src/services/organization-settings-service.js`

This service provides the `getScriptConfig()` function used by routes. Verify:
- It returns all necessary settings for Firecrawl operations
- The settings include any country-specific data needed for extraction

---

## Potential Areas Needing Updates

### Menu Extraction

If menu extraction needs organization settings, the pattern to follow is:

```javascript
// In the route handler
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[Menu Extract] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  country: scriptConfig.country
});

// Use scriptConfig values in extraction logic
```

### Currency Handling

If extracted menu prices need currency conversion or formatting:
- Check if `countryConfig.currency` is needed
- Check if `countryConfig.currencySymbol` is needed

### Image Downloading

If image URLs need country-specific handling:
- Check image download endpoints
- Verify no hardcoded paths or URLs

---

## Files Reference

### Key Files to Read

1. `UberEats-Image-Extractor/server.js` - Main server, routes definition
2. `UberEats-Image-Extractor/src/services/organization-settings-service.js` - Settings service
3. `UberEats-Image-Extractor/src/routes/registration-routes.js` - Registration routes (reference for pattern)

### Pattern Examples (Already Updated Routes)

Reference these routes for the correct pattern:

1. **Simple admin URL only:**
   - `/configure-services` (line ~1862-1880)
   - `/create-api-key` (line ~3114-3130)

2. **Admin URL + Country:**
   - `/configure-payment` (line ~1706-1729)
   - `/setup-system-settings` (line ~2841-2862)

3. **Full config with timezone:**
   - `/register-restaurant` (line ~590-603)

---

## Implementation Checklist

If updates are needed:

- [ ] Identify all Firecrawl-related endpoints
- [ ] Check each endpoint for hardcoded values
- [ ] Add `scriptConfig` fetch where needed
- [ ] Pass relevant settings to extraction logic
- [ ] Test with non-default organization settings

---

## Related Documentation

- `planning/database-plans/authentication-plans/super-admin-project/investigations/CONFIGURABLE-LOGIN-URL-AND-COUNTRY-SETTINGS-ROADMAP.md`
- `planning/database-plans/authentication-plans/super-admin-project/investigations/CONFIGURABLE-SETTINGS-IMPLEMENTATION-PROGRESS.md`
- `planning/database-plans/authentication-plans/super-admin-project/investigations/REMAINING-SCRIPTS-UPDATE-GUIDE.md`
