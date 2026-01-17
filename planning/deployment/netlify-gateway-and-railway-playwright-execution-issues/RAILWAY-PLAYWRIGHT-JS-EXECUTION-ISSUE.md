# Railway Playwright JavaScript Execution Issue

**Date**: 2025-12-09
**Status**: ✅ RESOLVED
**Priority**: HIGH (was blocking hosted script execution)

## Problem Summary

Playwright scripts worked correctly in local development but failed on Railway. The React application on the target page (`admin.pumpd.co.nz/login`) did not hydrate/render when running in the Railway container, resulting in 0 form elements being found.

**Resolution**: The issue was caused by bot detection on the target site. Adding a realistic User-Agent, locale, and timezone to the browser context configuration resolved the problem.

**Note**: This was a separate issue from the Netlify gateway timeout, which still needs to be addressed.

## Evidence

### Local Development (WORKS)
```
📄 Page Title: Log på                    ← Correct login page title (Danish)
📋 Form Elements Found:
    - Email inputs: 1                    ← Form rendered correctly
    - Password inputs: 1
    - Total inputs: 2
    - Forms: 1
✓ All 10 item tags created successfully
```

### Railway Production (FAILS)
```
📄 Page Title: Admin Dashboard           ← Wrong title, page not rendering correctly
📋 Form Elements Found:
    - Email inputs: 0                    ← React never hydrated
    - Password inputs: 0
    - Total inputs: 0
    - Forms: 0
❌ Email input not found in DOM after 60s
```

### Key Observation
The page content on both environments shows only CSS (`.uploadcare--jcrop-handle...`), indicating the initial HTML loads but **React/JavaScript is not executing on Railway**.

## Root Cause

**Bot detection on the target site** was blocking headless browsers. The default Playwright/Chromium User-Agent contains identifiers that reveal it as an automated browser, causing the server to respond differently (showing "Admin Dashboard" instead of the login page "Log på").

The `--single-process` flag was also problematic for containerized environments but was not the primary cause.

## Solution

The fix required three changes to the browser context configuration:

1. **Custom User-Agent** - A realistic Chrome browser User-Agent string
2. **Locale** - Set to `en-NZ` to match expected user location
3. **Timezone** - Set to `Pacific/Auckland` for consistency

## Final Configuration

### Browser Launch Config (`browser-config.cjs` / `browser-config.mjs`)

```javascript
const baseConfig = {
  headless,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--no-zygote',
  ],
};
```

**Note**: `--single-process` was **removed** as it can cause JavaScript execution issues in containers.

### Browser Context Config

```javascript
function getContextConfig(options = {}) {
  return {
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
    ...options,
  };
}
```

## What Did NOT Work (For Reference)

| Attempt | Result |
|---------|--------|
| Removed `--single-process` flag alone | Still failed - 0 inputs found |
| Added `--disable-blink-features=AutomationControlled` alone | Still failed |
| Added `--disable-features=VizDisplayCompositor` | Still failed |
| Increased wait time to 10s after navigation | Still failed |
| Changed to `state: 'attached'` instead of `visible` | Still failed |
| Increased timeout to 60s | Still failed (just waited longer) |
| Added `--no-zygote` flag alone | Still failed |

## What DID Work

| Change | Purpose |
|--------|---------|
| Custom User-Agent in context | Bypass User-Agent based bot detection |
| `locale: 'en-NZ'` in context | Appear as legitimate NZ user |
| `timezoneId: 'Pacific/Auckland'` in context | Consistent with locale |
| Removed `--single-process` flag | Prevent JS execution issues in containers |

## Environment Differences

| Factor | Local | Railway |
|--------|-------|---------|
| NODE_ENV | development (forced headless) | production |
| Container | None (native macOS) | Docker (Ubuntu Jammy) |
| Playwright Image | Local install | `mcr.microsoft.com/playwright:v1.54.0-jammy` |
| Browser Config Log | `[Browser] Launching in headless mode` | `[Browser] Production mode - optimized for containers` |

## Remaining Issue: Netlify Gateway Timeout

This fix resolves the JavaScript execution issue on Railway. However, the **Netlify gateway timeout (~30 seconds)** is a separate architectural issue that still needs to be addressed.

See [PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md](./PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md) for proposed solutions including:
- Async job queue pattern
- Direct Railway API access
- WebSocket progress streaming

## Files Involved

- `scripts/lib/browser-config.cjs` - CommonJS browser configuration (updated)
- `scripts/lib/browser-config.mjs` - ESM browser configuration (updated)
- `scripts/restaurant-registration/add-option-sets.js` - Uses shared browser config
- `scripts/restaurant-registration/add-item-tags.js` - Uses shared browser config
- `Dockerfile` - Container configuration

## Related Documentation

- [PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md](./PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md) - Original timeout investigation
- [PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md](./PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md) - Future architecture options for timeout issue

## Commands for Testing

```bash
# Test locally with production settings
NODE_ENV=production HEADLESS=true node scripts/restaurant-registration/add-option-sets.js \
  --payload="/path/to/payload.json"

# Check Railway logs via dashboard or CLI
```

## Key Learnings

1. **Bot detection is common** - Many sites detect headless browsers via User-Agent strings
2. **Context config matters more than launch args** - User-Agent, locale, and timezone are set on the browser context, not launch args
3. **`--single-process` is problematic in containers** - Can prevent JavaScript from executing properly
4. **Test with production settings locally** - `NODE_ENV=production HEADLESS=true` helps catch issues before deployment
