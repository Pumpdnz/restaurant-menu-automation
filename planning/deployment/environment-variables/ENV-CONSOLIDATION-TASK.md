# Environment File Consolidation Task

## Objective
Update all Playwright scripts to load environment variables from a single `.env` file located at:
```
/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/.env
```

## Current State

### Existing .env Files
1. **`UberEats-Image-Extractor/.env`** - Main comprehensive .env file (85 lines) containing all API keys, Supabase config, admin credentials, etc.
2. **`scripts/restaurant-registration/.env`** - Small .env file (17 lines) with basic Playwright config

### Current Script Loading Behavior

| Script Type | Current Loading Method | Files |
|-------------|----------------------|-------|
| CommonJS (restaurant-registration/) | `require('dotenv').config({ path: path.join(__dirname, '.env') })` | Loads from `scripts/restaurant-registration/.env` |
| CommonJS (scripts/) | `require('dotenv').config()` | Loads from CWD |
| ESM (scripts/*.js) | `dotenv.config()` | Loads from CWD - **inconsistent** |

## Scripts to Update

### CommonJS Scripts in `scripts/restaurant-registration/`
These need the path updated to point to UberEats-Image-Extractor/.env:

1. `register-restaurant-production.js` - Line ~49: `require('dotenv').config();`
2. `login-and-register-restaurant.js` - Line ~39: `require('dotenv').config();`
3. `import-csv-menu.js` - Line ~34: `require('dotenv').config();`
4. `add-option-sets.js` - Line ~48: `require('dotenv').config({ path: path.join(__dirname, '.env') });`
5. `add-item-tags.js` - Line ~33: `require('dotenv').config({ path: path.join(__dirname, '.env') });`
6. `upload-menu-images.js` - Line ~29: `require('dotenv').config();`

**Change FROM:**
```javascript
require('dotenv').config();
// OR
require('dotenv').config({ path: path.join(__dirname, '.env') });
```

**Change TO:**
```javascript
require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') });
```

### ESM Scripts in `scripts/`
These need explicit path configuration:

1. `edit-website-settings-dark.js` - Line ~49: `dotenv.config();`
2. `edit-website-settings-light.js` - Line ~56: `dotenv.config();`
3. `setup-services-settings.js` - Line ~41: `dotenv.config();`
4. `setup-stripe-payments.js` - Line ~41: `dotenv.config();`
5. `setup-stripe-payments-no-link.js` - Line ~41: `dotenv.config();`
6. `setup-system-settings-user.js` - Line ~45: `dotenv.config();`
7. `create-api-key-user.js` - Line ~43: `dotenv.config();`
8. `create-onboarding-user.js` - No dotenv import currently
9. `finalise-onboarding.js` - Line ~47: `dotenv.config();`
10. `ordering-page-customization.js` - No dotenv import currently

**Change FROM:**
```javascript
dotenv.config();
```

**Change TO:**
```javascript
dotenv.config({ path: path.join(__dirname, '../UberEats-Image-Extractor/.env') });
```

**For scripts without dotenv (create-onboarding-user.js, ordering-page-customization.js):**
Add import and config:
```javascript
import dotenv from 'dotenv';
// ... after __dirname definition
dotenv.config({ path: path.join(__dirname, '../UberEats-Image-Extractor/.env') });
```

## Path Reference Guide

From `scripts/restaurant-registration/` to `.env`:
```
../../UberEats-Image-Extractor/.env
```

From `scripts/` to `.env`:
```
../UberEats-Image-Extractor/.env
```

## Environment Variables Used by Scripts

The scripts primarily use these env vars:
- `ADMIN_PASSWORD` / `PUMPD_ADMIN_PASSWORD` - For bypassing email verification
- `MANAGE_EMAIL` / `MANAGE_PASSWORD` - For super admin scripts
- `DEBUG_MODE` - Enable debug logging
- `HEADLESS` - Control browser visibility
- `ENABLE_SCREENSHOTS` - Enable screenshot capture
- `NODE_ENV` - Production detection

All these are already defined in `UberEats-Image-Extractor/.env`.

## Verification Steps After Changes

1. Run a CommonJS script from restaurant-registration:
```bash
cd scripts/restaurant-registration
node register-restaurant-production.js --help
# Should not error on missing env vars
```

2. Run an ESM script:
```bash
cd scripts
node edit-website-settings-dark.js --help
# Should not error on missing env vars
```

3. Check that env vars are loaded:
```bash
# Add temporary console.log to a script:
console.log('ADMIN_PASSWORD loaded:', !!process.env.ADMIN_PASSWORD);
```

## Optional: Delete Old .env File

After confirming all scripts work, optionally delete:
```
scripts/restaurant-registration/.env
```

Or keep it as a backup/reference.

## Notes

- The `UberEats-Image-Extractor/.env` file contains sensitive API keys - ensure it's in `.gitignore`
- For Railway deployment, env vars will be set in the Railway dashboard, so the `.env` file is only for local development
- The path resolution uses `__dirname` which works correctly in both CommonJS and ESM (with the ESM polyfill already in place)
