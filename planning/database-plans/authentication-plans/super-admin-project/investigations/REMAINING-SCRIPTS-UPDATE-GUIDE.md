# Remaining Scripts Update Guide

## Overview

This guide documents the remaining scripts that need to be updated to accept organization-specific configurable settings. The pattern has been established in previously updated scripts and routes.

## Reference Files

### Already Updated Scripts (Use as Templates)

| Script | Path | Configurable Settings |
|--------|------|----------------------|
| login-and-register-restaurant.js | `scripts/restaurant-registration/login-and-register-restaurant.js` | adminUrl, country, timezone |
| add-item-tags.js | `scripts/restaurant-registration/add-item-tags.js` | adminUrl |
| add-option-sets.js | `scripts/restaurant-registration/add-option-sets.js` | adminUrl (via payload) |
| import-csv-menu.js | `scripts/restaurant-registration/import-csv-menu.js` | adminUrl |
| edit-website-settings-dark.js | `scripts/edit-website-settings-dark.js` | adminUrl |
| edit-website-settings-light.js | `scripts/edit-website-settings-light.js` | adminUrl |

### Country Configuration Library

**Path:** `scripts/lib/country-config.js` (ES modules) and `scripts/lib/country-config.cjs` (CommonJS)

**Available Functions:**
- `getCountryConfig(countryCode)` - Returns full config for a country
- `getAdminHostname(adminUrl)` - Extracts hostname from admin URL
- `buildLoginUrl(adminUrl)` - Builds login URL from admin URL
- `getTimezonesForCountry(countryCode)` - Returns available timezones

**Country Config Structure:**
```javascript
{
  code: 'NZ',
  name: 'New Zealand',
  currency: 'NZD',
  currencySymbol: '$',
  locale: 'en-NZ',
  timezone: 'Pacific/Auckland',
  phonePrefix: '+64',
  phoneRegex: /^(\+64|0)[2-9]\d{7,9}$/,
  gstRate: 0.15,
  gstName: 'GST'
}
```

### Already Updated Routes in registration-routes.js

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

| Route | Line Range | Pattern Used |
|-------|------------|--------------|
| `/register-restaurant` | ~590-603 | Full pattern with adminUrl, country, timezone |
| `/configure-website` | ~1317-1350 | adminUrl only |
| `/add-item-tags` | ~1981-2007 | adminUrl only |
| `/add-option-sets` | ~2237-2269 | adminUrl in JSON payload |
| `/upload-csv-menu` | ~876-895 | adminUrl only |

---

## Scripts Requiring Updates

### 1. setup-services-settings.js

**Path:** `scripts/setup-services-settings.js`

**Required Settings:** adminUrl

**Script Changes:**
1. Add to argument parsing section:
```javascript
const { getAdminHostname, buildLoginUrl } = require('./lib/country-config.cjs');

const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';
const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
const LOGIN_URL = buildLoginUrl(adminUrl);
const ADMIN_HOSTNAME = getAdminHostname(adminUrl);
```

2. Update any hardcoded `admin.pumpd.co.nz` references to use `ADMIN_HOSTNAME`

**Route Changes (registration-routes.js ~1854-1872):**

Find the `/configure-services` route and add before command building:
```javascript
// Get organization-specific script configuration (admin URL)
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[Services Config] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  adminHostname: scriptConfig.adminHostname
});
```

Add to command array:
```javascript
`--admin-url="${scriptConfig.adminUrl}"`
```

---

### 2. setup-stripe-payments-no-link.js

**Path:** `scripts/setup-stripe-payments-no-link.js`

**Required Settings:** adminUrl, countryConfig.currency

**Script Changes:**
1. Add imports and argument parsing:
```javascript
const { getCountryConfig, getAdminHostname, buildLoginUrl } = require('./lib/country-config.cjs');

const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';
const DEFAULT_COUNTRY = 'NZ';

const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
const country = getArg('country') || DEFAULT_COUNTRY;
const countryConfig = getCountryConfig(country);

const LOGIN_URL = buildLoginUrl(adminUrl);
const ADMIN_HOSTNAME = getAdminHostname(adminUrl);
```

2. Replace hardcoded currency references with `countryConfig.currency`

**Route Changes (registration-routes.js ~1705-1719):**

Find the `/configure-payment` route and add before command building:
```javascript
// Get organization-specific script configuration
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[Payment Config] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  country: scriptConfig.country
});
```

Add to command array:
```javascript
`--admin-url="${scriptConfig.adminUrl}"`,
`--country="${scriptConfig.country}"`
```

---

### 3. setup-stripe-payments.js

**Path:** `scripts/setup-stripe-payments.js`

**Required Settings:** adminUrl, countryConfig.currency

**Script Changes:** Same as setup-stripe-payments-no-link.js above

**Route Changes:** Same route `/configure-payment` handles both scripts based on `includeConnectLink` parameter

---

### 4. setup-system-settings-user.js

**Path:** `scripts/setup-system-settings-user.js`

**Required Settings:** adminUrl, phonePrefix, phoneRegex, gstRate, gstName

**Script Changes:**
1. Add imports and argument parsing:
```javascript
const { getCountryConfig, getAdminHostname, buildLoginUrl } = require('./lib/country-config.cjs');

const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';
const DEFAULT_COUNTRY = 'NZ';

const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
const country = getArg('country') || DEFAULT_COUNTRY;
const countryConfig = getCountryConfig(country);

const LOGIN_URL = buildLoginUrl(adminUrl);
const ADMIN_HOSTNAME = getAdminHostname(adminUrl);
```

2. Replace hardcoded values:
   - Phone prefix validation: use `countryConfig.phonePrefix` and `countryConfig.phoneRegex`
   - GST rate: use `countryConfig.gstRate` (e.g., 0.15 for 15%)
   - GST name: use `countryConfig.gstName` (e.g., "GST" for NZ, "GST" for AU)

**Route Changes (registration-routes.js ~2841-2854):**

Find the `/setup-system-settings` route and add before command building:
```javascript
// Get organization-specific script configuration
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[System Settings] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  country: scriptConfig.country
});
```

Add to args array:
```javascript
`--admin-url="${scriptConfig.adminUrl}"`,
`--country="${scriptConfig.country}"`
```

---

### 5. create-api-key-user.js

**Path:** `scripts/create-api-key-user.js`

**Required Settings:** adminUrl

**Script Changes:**
1. Add to argument parsing section:
```javascript
const { getAdminHostname, buildLoginUrl } = require('./lib/country-config.cjs');

const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';
const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
const LOGIN_URL = buildLoginUrl(adminUrl);
const ADMIN_HOSTNAME = getAdminHostname(adminUrl);
```

2. Update any hardcoded `admin.pumpd.co.nz` references

**Route Changes (registration-routes.js ~3086-3094):**

Find the `/create-api-key` route and add before command building:
```javascript
// Get organization-specific script configuration (admin URL)
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[API Key] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  adminHostname: scriptConfig.adminHostname
});
```

Add to command array:
```javascript
`--admin-url="${scriptConfig.adminUrl}"`
```

---

### 6. finalise-onboarding-user.js

**Path:** `scripts/finalise-onboarding-user.js`

**Required Settings:** adminUrl

**Script Changes:**
1. Add to argument parsing section:
```javascript
const { getAdminHostname, buildLoginUrl } = require('./lib/country-config.cjs');

const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';
const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
const LOGIN_URL = buildLoginUrl(adminUrl);
const ADMIN_HOSTNAME = getAdminHostname(adminUrl);
```

2. Update any hardcoded `admin.pumpd.co.nz` references

**Route Changes (registration-routes.js ~3327-3339):**

Find the `/configure-uber-integration` route and add before command building:
```javascript
// Get organization-specific script configuration (admin URL)
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[Uber Integration] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  adminHostname: scriptConfig.adminHostname
});
```

Add to command array:
```javascript
`--admin-url="${scriptConfig.adminUrl}"`
```

---

## Implementation Checklist

### For Each Script:

- [ ] Add country-config import (use `.cjs` for CommonJS scripts)
- [ ] Add command-line argument parsing for `--admin-url` and `--country` (where needed)
- [ ] Add default values that fall back to NZ/pumpd.co.nz
- [ ] Build LOGIN_URL and ADMIN_HOSTNAME from adminUrl
- [ ] Replace all hardcoded admin portal URLs
- [ ] Replace hardcoded country-specific values (currency, phone, GST)
- [ ] Update documentation/comments at top of file

### For Each Route:

- [ ] Add `scriptConfig` fetch using `OrganizationSettingsService.getScriptConfig(organisationId)`
- [ ] Add console.log for debugging
- [ ] Add `--admin-url` (and `--country` where needed) to command

---

## Example: Complete Script Update Pattern

Reference `scripts/edit-website-settings-dark.js` lines 90-110 for the complete pattern:

```javascript
// ============================================================================
// CONFIGURABLE ADMIN URL SUPPORT
// ============================================================================
const { getAdminHostname, buildLoginUrl } = require('./lib/country-config.cjs');

// Default admin URL (NZ)
const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';

// Get admin URL from command line or use default
const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');

// Build derived values
const LOGIN_URL = buildLoginUrl(adminUrl);
const ADMIN_HOSTNAME = getAdminHostname(adminUrl);

console.log('Admin URL Configuration:');
console.log('  Admin URL:', adminUrl);
console.log('  Login URL:', LOGIN_URL);
console.log('  Admin Hostname:', ADMIN_HOSTNAME);
```

---

## Example: Complete Route Update Pattern

Reference `/add-item-tags` route in `registration-routes.js` lines 1981-2007:

```javascript
console.log('[Item Tags] Account found:', finalAccount.email);

// Get organization-specific script configuration (admin URL)
const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
console.log('[Item Tags] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  adminHostname: scriptConfig.adminHostname
});

// Execute add-item-tags.js script
const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/add-item-tags.js');

// Build command with proper escaping
const command = [
  'node',
  scriptPath,
  `--email="${finalAccount.email}"`,
  `--password="${finalAccount.user_password_hint}"`,
  `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
  `--admin-url="${scriptConfig.adminUrl}"`
].join(' ');
```

---

## Testing

After updating each script and route:

1. Test with default (no admin-url argument) - should use pumpd.co.nz
2. Test with explicit `--admin-url="https://admin.ozorders.com.au"` - should use Australian portal
3. Verify all portal navigations use the correct hostname
4. Verify country-specific values (currency, GST) are applied correctly

---

## Related Documentation

- `planning/database-plans/authentication-plans/super-admin-project/investigations/CONFIGURABLE-LOGIN-URL-AND-COUNTRY-SETTINGS-ROADMAP.md`
- `planning/database-plans/authentication-plans/super-admin-project/investigations/CONFIGURABLE-SETTINGS-IMPLEMENTATION-PROGRESS.md`
- `planning/database-plans/authentication-plans/super-admin-project/investigations/ADD-TIMEZONE-CONFIGURATION-PLAN.md`
