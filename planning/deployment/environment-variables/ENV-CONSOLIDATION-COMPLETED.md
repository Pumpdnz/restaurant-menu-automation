# Environment Consolidation - Session Summary

**Date:** 2025-12-08
**Status:** Completed

## Objective

Update all 16 Playwright scripts to load environment variables from a single centralized `.env` file located at:
```
/automation/UberEats-Image-Extractor/.env
```

## Changes Made

### 1. Environment Variable Loading Updates

#### CommonJS Scripts (6 files in `scripts/restaurant-registration/`)

Updated the dotenv configuration path in all CommonJS scripts:

| File | Change |
|------|--------|
| `register-restaurant-production.js` | `require('dotenv').config()` → `require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') })` |
| `login-and-register-restaurant.js` | Same pattern |
| `import-csv-menu.js` | Same pattern |
| `add-option-sets.js` | `path.join(__dirname, '.env')` → `path.join(__dirname, '../../UberEats-Image-Extractor/.env')` |
| `add-item-tags.js` | Same pattern |
| `upload-menu-images.js` | `require('dotenv').config()` → `require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') })` |

#### ESM Scripts (10 files in `scripts/`)

Updated the dotenv configuration path in all ESM scripts:

| File | Change |
|------|--------|
| `edit-website-settings-dark.js` | `dotenv.config()` → `dotenv.config({ path: path.join(__dirname, '../UberEats-Image-Extractor/.env') })` |
| `edit-website-settings-light.js` | Same pattern |
| `setup-services-settings.js` | Same pattern |
| `setup-stripe-payments.js` | Same pattern |
| `setup-stripe-payments-no-link.js` | Same pattern |
| `setup-system-settings-user.js` | Same pattern |
| `create-api-key-user.js` | Same pattern |
| `finalise-onboarding.js` | Same pattern |
| `create-onboarding-user.js` | Added `import dotenv from 'dotenv'` + `dotenv.config({ path: ... })` |
| `ordering-page-customization.js` | Added `import dotenv from 'dotenv'` + `dotenv.config({ path: ... })` |

### 2. Module Compatibility Fix

**Problem:** The `scripts/package.json` contains `"type": "module"`, which caused Node.js to treat `scripts/lib/browser-config.js` as an ESM module. This broke the CommonJS scripts in `scripts/restaurant-registration/` that use `require()`.

**Solution:**
- Renamed `scripts/lib/browser-config.js` → `scripts/lib/browser-config.cjs`
- Updated all 6 CommonJS scripts to use the `.cjs` extension:
  ```javascript
  // Before
  } = require('../lib/browser-config');

  // After
  } = require('../lib/browser-config.cjs');
  ```

### 3. File Structure

```
scripts/
├── lib/
│   ├── browser-config.cjs    # CommonJS version (for restaurant-registration scripts)
│   └── browser-config.mjs    # ESM version (for scripts/*.js)
├── restaurant-registration/
│   ├── register-restaurant-production.js  # Uses browser-config.cjs
│   ├── login-and-register-restaurant.js   # Uses browser-config.cjs
│   ├── import-csv-menu.js                 # Uses browser-config.cjs
│   ├── add-option-sets.js                 # Uses browser-config.cjs
│   ├── add-item-tags.js                   # Uses browser-config.cjs
│   └── upload-menu-images.js              # Uses browser-config.cjs
├── edit-website-settings-dark.js          # Uses browser-config.mjs
├── edit-website-settings-light.js         # Uses browser-config.mjs
├── setup-services-settings.js             # Uses browser-config.mjs
├── setup-stripe-payments.js               # Uses browser-config.mjs
├── setup-stripe-payments-no-link.js       # Uses browser-config.mjs
├── setup-system-settings-user.js          # Uses browser-config.mjs
├── create-api-key-user.js                 # Uses browser-config.mjs
├── create-onboarding-user.js              # Uses browser-config.mjs
├── finalise-onboarding.js                 # Uses browser-config.mjs
└── ordering-page-customization.js         # Uses browser-config.mjs
```

## Path Reference Guide

| Script Location | Path to .env |
|-----------------|--------------|
| `scripts/restaurant-registration/*.js` | `../../UberEats-Image-Extractor/.env` |
| `scripts/*.js` | `../UberEats-Image-Extractor/.env` |

## Testing Results

All 16 scripts were tested and load successfully:

### CommonJS Scripts (6/6 Passed)
- `register-restaurant-production.js` - Shows usage error (expected)
- `login-and-register-restaurant.js` - Shows usage error (expected)
- `import-csv-menu.js` - Shows usage error (expected)
- `add-option-sets.js` - Shows usage error (expected)
- `add-item-tags.js` - Shows usage error (expected)
- `upload-menu-images.js` - Shows usage error (expected)

### ESM Scripts (10/10 Passed)
- `edit-website-settings-dark.js` - Shows usage error (expected)
- `edit-website-settings-light.js` - Shows usage error (expected)
- `setup-services-settings.js` - Shows usage error (expected)
- `setup-stripe-payments.js` - Shows usage error (expected)
- `setup-stripe-payments-no-link.js` - Shows usage error (expected)
- `setup-system-settings-user.js` - Shows usage error (expected)
- `create-api-key-user.js` - Shows usage error (expected)
- `create-onboarding-user.js` - Shows usage error (expected)
- `finalise-onboarding.js` - Shows usage error (expected)
- `ordering-page-customization.js` - Runs with defaults (expected)

## Environment Variables Used

The scripts primarily use these env vars from `UberEats-Image-Extractor/.env`:

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` / `PUMPD_ADMIN_PASSWORD` | For bypassing email verification |
| `MANAGE_EMAIL` / `MANAGE_PASSWORD` | For super admin scripts |
| `DEBUG_MODE` | Enable debug logging |
| `HEADLESS` | Control browser visibility |
| `ENABLE_SCREENSHOTS` | Enable screenshot capture |
| `NODE_ENV` | Production detection |

## Optional Cleanup

The old `.env` file at `scripts/restaurant-registration/.env` can now be deleted since all scripts load from the centralized location:

```bash
rm scripts/restaurant-registration/.env
```

## Verification Commands

```bash
# Test a CommonJS script
cd scripts/restaurant-registration
node register-restaurant-production.js --help

# Test an ESM script
cd scripts
node edit-website-settings-dark.js --help

# Verify env vars are loaded (add temporarily to any script)
console.log('ADMIN_PASSWORD loaded:', !!process.env.ADMIN_PASSWORD);
```

## Notes

- The `UberEats-Image-Extractor/.env` file contains sensitive API keys - ensure it's in `.gitignore`
- For Railway deployment, env vars will be set in the Railway dashboard, so the `.env` file is only for local development
- The path resolution uses `__dirname` which works correctly in both CommonJS and ESM (with the ESM polyfill already in place)
