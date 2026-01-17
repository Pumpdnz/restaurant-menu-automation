# Playwright Script Migration Plan for Cloud Deployment

This document provides comprehensive instructions for migrating Playwright scripts from local development to production-ready cloud deployment on Railway.

## Overview

All Playwright scripts need to be updated to:
1. Run in headless mode in production
2. Disable screenshots in production
3. Remove slowMo in production
4. Use relative file paths (no absolute paths)
5. Use the shared `browser-config.js` library

## Shared Configuration Library

A shared browser configuration library has already been created at:
```
scripts/lib/browser-config.js
```

This library provides:
- `getBrowserConfig()` - Returns browser launch config based on environment
- `createBrowser(chromium)` - Creates browser with proper config
- `takeScreenshot(page, name, directory)` - Conditional screenshots (disabled in production)
- Environment variables: `IS_PRODUCTION`, `FORCE_HEADLESS`, `DEBUG_MODE`

## Scripts Requiring Migration

### Priority 1: Production Scripts (Used by Registration Routes)

These scripts are actively called from `registration-routes.js` and MUST be migrated:

| Script | Location | Status |
|--------|----------|--------|
| `register-restaurant-production.js` | `scripts/restaurant-registration/` | Needs migration |
| `login-and-register-restaurant.js` | `scripts/restaurant-registration/` | Needs migration |
| `import-csv-menu.js` | `scripts/restaurant-registration/` | Needs migration |
| `add-option-sets.js` | `scripts/restaurant-registration/` | Needs migration |
| `add-item-tags.js` | `scripts/restaurant-registration/` | Needs migration |
| `upload-menu-images.js` | `scripts/restaurant-registration/` | Needs migration |
| `edit-website-settings-dark.js` | `scripts/` | Needs migration |
| `edit-website-settings-light.js` | `scripts/` | Needs migration |
| `setup-services-settings.js` | `scripts/` | Needs migration |
| `setup-stripe-payments.js` | `scripts/` | Needs migration |
| `setup-stripe-payments-no-link.js` | `scripts/` | Needs migration |
| `setup-system-settings.js` | `scripts/` | Needs migration |
| `setup-system-settings-user.js` | `scripts/` | Needs migration |
| `create-api-key.js` | `scripts/` | Needs migration |
| `create-api-key-user.js` | `scripts/` | Needs migration |
| `create-onboarding-user.js` | `scripts/` | Needs migration |
| `finalise-onboarding.js` | `scripts/` | Needs migration |
| `finalise-onboarding-user.js` | `scripts/` | Needs migration |
| `ordering-page-customization.js` | `scripts/` | Needs migration |

### Priority 2: Supporting Scripts

These scripts may be used for manual operations or debugging:

| Script | Location | Status |
|--------|----------|--------|
| `instagram-image-extractor.js` | `scripts/` | Needs migration |
| `restaurant-logo-extractor.js` | `scripts/` | Needs migration |
| `add-option-sets-no-menu-items.js` | `scripts/restaurant-registration/` | Needs migration |
| `navigate-to-website-settings.js` | `scripts/restaurant-registration/` | Needs migration |

### Priority 3: Base Navigation Scripts

These are utility scripts that may be used by other scripts:

| Script | Location |
|--------|----------|
| `navigate-to-integrations-settings.js` | `scripts/base-navigation-scripts/` |
| `navigate-to-manage-dashboard.js` | `scripts/base-navigation-scripts/` |
| `navigate-to-payments-settings.js` | `scripts/base-navigation-scripts/` |
| `navigate-to-services-settings.js` | `scripts/base-navigation-scripts/` |
| `navigate-to-super-admin.js` | `scripts/base-navigation-scripts/` |
| `navigate-to-system-settings.js` | `scripts/base-navigation-scripts/` |

### Skip These (Partial/Test Scripts)

Do NOT migrate scripts in:
- `scripts/partial-implementation-scripts/` (incomplete implementations)
- `scripts/backups/` (backup files)
- Any file starting with `test-` (test scripts)

---

## Migration Steps for Each Script

### Step 1: Create Backup

Before modifying any script, create a backup:
```bash
cp script-name.js script-name.js.backup-$(date +%Y%m%d)
```

### Step 2: Add Import for browser-config

At the top of each script, add:
```javascript
const {
  getBrowserConfig,
  createBrowser,
  takeScreenshot,
  IS_PRODUCTION
} = require('../lib/browser-config');
// OR for scripts in scripts/ directory:
const {
  getBrowserConfig,
  createBrowser,
  takeScreenshot,
  IS_PRODUCTION
} = require('./lib/browser-config');
```

### Step 3: Replace Browser Launch

**BEFORE:**
```javascript
const browser = await chromium.launch({
  headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  slowMo: 100
});
```

**AFTER:**
```javascript
const browser = await createBrowser(chromium);
```

Or if you need custom options:
```javascript
const browser = await chromium.launch(getBrowserConfig({
  // custom overrides here
}));
```

### Step 4: Replace Screenshot Functions

**BEFORE:**
```javascript
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot: ${screenshotPath}`);
};
```

**AFTER:**
```javascript
// Use the imported takeScreenshot from browser-config
// It will automatically skip screenshots in production

// Replace calls like:
await takeScreenshot(page, 'step-1-login');

// The function handles the directory automatically:
await takeScreenshot(page, 'step-1-login', path.join(__dirname, 'screenshots'));
```

Or remove the local `takeScreenshot` function entirely and use the imported one.

### Step 5: Fix Absolute Paths

Search for any absolute paths and replace with relative:

**BEFORE:**
```javascript
const userDataDir = '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile';
const outputPath = '/Users/giannimunro/Desktop/cursor-projects/automation/...';
```

**AFTER:**
```javascript
const path = require('path');
const userDataDir = process.env.CHROME_USER_DATA_DIR || path.join(__dirname, '..', 'chrome-profile');
const outputPath = path.join(__dirname, '..', 'output');
```

### Step 6: Remove or Conditionalize slowMo

If slowMo is used for debugging, it should only be active in development:

**BEFORE:**
```javascript
slowMo: 100
```

**AFTER:**
```javascript
// This is handled automatically by getBrowserConfig()
// slowMo is only added when NOT in production
```

---

## Known Absolute Path Issues

The following scripts have hardcoded absolute paths that MUST be fixed:

### instagram-image-extractor.js (lines 60, 84)
```javascript
// Line 60 - Chrome profile path
const userDataDir = '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile';
// Line 84 - Download path
'/Users/giannimunro/Desktop/cursor-projects',
```

### restaurant-logo-extractor.js (line 71)
```javascript
'/Users/giannimunro/Desktop/cursor-projects',
```

### upload-menu-images.js (lines 44-45)
```javascript
const imageMappingPath = getArg('imageMapping') || '/Users/giannimunro/Desktop/cursor-projects/automation/...';
const imagesDir = getArg('imagesDir') || '/Users/giannimunro/Desktop/cursor-projects/automation/...';
```

---

## Environment Variables

The following environment variables control script behavior:

| Variable | Values | Description |
|----------|--------|-------------|
| `NODE_ENV` | `development` / `production` | Environment mode |
| `HEADLESS` | `true` / `false` | Force headless mode |
| `DEBUG_MODE` | `true` / `false` | Enable debug logging |
| `ENABLE_SCREENSHOTS` | `true` / `false` | Enable screenshots in production |

In production (Railway), set:
```
NODE_ENV=production
HEADLESS=true
DEBUG_MODE=false
ENABLE_SCREENSHOTS=false
```

---

## Testing Migration

After migrating each script:

1. **Test locally in development mode:**
   ```bash
   node script-name.js
   ```
   Should run with visible browser and slowMo

2. **Test locally in production mode:**
   ```bash
   NODE_ENV=production HEADLESS=true node script-name.js
   ```
   Should run headless without slowMo

3. **Verify no screenshots are created in production mode:**
   ```bash
   NODE_ENV=production ENABLE_SCREENSHOTS=false node script-name.js
   # Check that no screenshots were saved
   ```

---

## Package.json Updates

Update `scripts/restaurant-registration/package.json` to include production scripts:

```json
{
  "scripts": {
    "start": "node register-restaurant-production.js",
    "register": "node register-restaurant-production.js",
    "import-menu": "node import-csv-menu.js",
    "add-options": "node add-option-sets.js",
    "upload-images": "node upload-menu-images.js"
  }
}
```

---

## Checklist

Use this checklist to track migration progress:

### Priority 1 Scripts
- [ ] `register-restaurant-production.js` - Backup created
- [ ] `register-restaurant-production.js` - browser-config imported
- [ ] `register-restaurant-production.js` - Browser launch updated
- [ ] `register-restaurant-production.js` - Screenshots updated
- [ ] `register-restaurant-production.js` - Absolute paths fixed
- [ ] `register-restaurant-production.js` - Tested locally

- [ ] `login-and-register-restaurant.js` - Backup created
- [ ] `login-and-register-restaurant.js` - browser-config imported
- [ ] `login-and-register-restaurant.js` - Browser launch updated
- [ ] `login-and-register-restaurant.js` - Screenshots updated
- [ ] `login-and-register-restaurant.js` - Absolute paths fixed
- [ ] `login-and-register-restaurant.js` - Tested locally

- [ ] `import-csv-menu.js` - Backup created
- [ ] `import-csv-menu.js` - browser-config imported
- [ ] `import-csv-menu.js` - Browser launch updated
- [ ] `import-csv-menu.js` - Screenshots updated
- [ ] `import-csv-menu.js` - Absolute paths fixed
- [ ] `import-csv-menu.js` - Tested locally

- [ ] `add-option-sets.js` - Backup created
- [ ] `add-option-sets.js` - browser-config imported
- [ ] `add-option-sets.js` - Browser launch updated
- [ ] `add-option-sets.js` - Screenshots updated
- [ ] `add-option-sets.js` - Absolute paths fixed
- [ ] `add-option-sets.js` - Tested locally

- [ ] `add-item-tags.js` - Backup created
- [ ] `add-item-tags.js` - browser-config imported
- [ ] `add-item-tags.js` - Browser launch updated
- [ ] `add-item-tags.js` - Screenshots updated
- [ ] `add-item-tags.js` - Absolute paths fixed
- [ ] `add-item-tags.js` - Tested locally

- [ ] `upload-menu-images.js` - Backup created
- [ ] `upload-menu-images.js` - browser-config imported
- [ ] `upload-menu-images.js` - Browser launch updated
- [ ] `upload-menu-images.js` - Screenshots updated
- [ ] `upload-menu-images.js` - Absolute paths fixed
- [ ] `upload-menu-images.js` - Tested locally

- [ ] `edit-website-settings-dark.js` - Migrated
- [ ] `edit-website-settings-light.js` - Migrated
- [ ] `setup-services-settings.js` - Migrated
- [ ] `setup-stripe-payments.js` - Migrated
- [ ] `setup-stripe-payments-no-link.js` - Migrated
- [ ] `setup-system-settings.js` - Migrated
- [ ] `setup-system-settings-user.js` - Migrated
- [ ] `create-api-key.js` - Migrated
- [ ] `create-api-key-user.js` - Migrated
- [ ] `create-onboarding-user.js` - Migrated
- [ ] `finalise-onboarding.js` - Migrated
- [ ] `finalise-onboarding-user.js` - Migrated
- [ ] `ordering-page-customization.js` - Migrated

### Priority 2 Scripts
- [ ] `instagram-image-extractor.js` - Migrated
- [ ] `restaurant-logo-extractor.js` - Migrated
- [ ] `add-option-sets-no-menu-items.js` - Migrated
- [ ] `navigate-to-website-settings.js` - Migrated

### Priority 3 Scripts (Base Navigation)
- [ ] `navigate-to-integrations-settings.js` - Migrated
- [ ] `navigate-to-manage-dashboard.js` - Migrated
- [ ] `navigate-to-payments-settings.js` - Migrated
- [ ] `navigate-to-services-settings.js` - Migrated
- [ ] `navigate-to-super-admin.js` - Migrated
- [ ] `navigate-to-system-settings.js` - Migrated

---

## Example: Full Migration

Here's a complete example of migrating `register-restaurant-production.js`:

### Before Migration (Current Code)
```javascript
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

// Screenshot utility
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `restaurant-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot: ${screenshotPath}`);
};

async function registerRestaurant(options) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100
  });

  // ... rest of script
}
```

### After Migration
```javascript
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

// Import shared browser configuration
const {
  createBrowser,
  takeScreenshot,
  IS_PRODUCTION
} = require('../lib/browser-config');

async function registerRestaurant(options) {
  // Use shared browser config (handles headless, slowMo, etc.)
  const browser = await createBrowser(chromium);

  // ... rest of script

  // Screenshots now automatically disabled in production
  await takeScreenshot(page, 'step-1-login', path.join(__dirname, 'screenshots'));
}
```

---

## Notes

1. **Docker Compatibility**: The `browser-config.js` adds `--disable-dev-shm-usage` which is critical for Docker containers
2. **Memory Optimization**: In production, `--single-process` is added to reduce memory usage
3. **No GPU**: Production config disables GPU since cloud environments don't have GPUs
4. **Backward Compatibility**: Scripts will still work locally with visible browsers when not in production mode
