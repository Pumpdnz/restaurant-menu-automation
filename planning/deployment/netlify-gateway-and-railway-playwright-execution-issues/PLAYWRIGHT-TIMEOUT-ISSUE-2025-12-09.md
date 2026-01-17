# Playwright Script Timeout Issue (2025-12-09)

**Status**: IN PROGRESS - Needs debugging

## Problem Summary

Playwright scripts that run successfully locally are failing when executed on Railway via the Netlify frontend. The error shows a timeout waiting for the login form to render.

## Error Details

### Frontend Error
```
Request URL: https://pumpd-menu-builder.netlify.app/api/registration/add-item-tags
Request Method: POST
Status Code: 504 Gateway Timeout
```

### Railway Logs
```
[Item Tags] Executing item tags configuration script...
[Browser] Launching in headless mode
[Browser] Production mode - optimized for containers
🔐 STEP 1: Login to admin portal
❌ Error during item tags configuration: page.fill: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')
```

## Root Cause Analysis

### Timeout Chain
1. **Netlify proxy timeout**: ~26-30 seconds (cannot be changed on free tier)
2. **Railway request timeout**: 28 seconds (shown in logs as `totalDuration: 28000`)
3. **Script timeout**: 180 seconds (3 minutes) configured in `registration-routes.js:1974`
4. **Playwright element timeout**: 30 seconds default for `page.fill()`

### Why the Script Fails
The script navigates to `https://admin.pumpd.co.nz/login` and immediately tries to fill `input[type="email"]`. The login form isn't rendering within the 30-second timeout.

Possible causes:
1. **Cloudflare/bot protection** - Blocking headless browsers
2. **Slow page render** - React app taking longer to hydrate in headless mode
3. **Network latency** - Railway's data center may have different routing
4. **Missing wait** - Script doesn't explicitly wait for login form before filling

## Current Script Flow (add-item-tags.js)

```javascript
// Line 116 - Navigate to login
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Line 120 - Immediately try to fill (THIS IS WHERE IT FAILS)
await page.fill('input[type="email"]', email);  // 30s default timeout
```

The script doesn't wait for the login form to render after DOM content loads.

## Potential Fixes

### Fix 1: Increase Timeouts (Quick)

**Netlify**: Cannot increase proxy timeout on free tier. Would need to:
- Upgrade to Pro plan, OR
- Change architecture to async/polling

**Railway**: Add environment variable or update `railway.json`:
```json
{
  "build": {},
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

### Fix 2: Add Explicit Waits (Recommended)

Update all Playwright scripts to wait for elements before interacting:

```javascript
// Before
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('input[type="email"]', email);

// After
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input[type="email"]', { timeout: 60000 });
await page.fill('input[type="email"]', email);
```

### Fix 3: Change Architecture (Long-term)

The HTTP request/response model doesn't work well for long-running Playwright scripts.

Options:
1. **Async/Polling**: Return job ID immediately, poll for status
2. **WebSocket**: Stream progress updates to frontend
3. **Queue-based**: Use a job queue (Bull, BullMQ) with separate worker

## Files That Need Updates

### Scripts with Login Flow
All scripts in `scripts/restaurant-registration/` that login:
- `add-item-tags.js`
- `add-option-sets.js`
- `import-csv-menu.js`
- `upload-menu-images.js`
- `register-restaurant-production.js`
- `login-and-register-restaurant.js`

### Route Files
- `UberEats-Image-Extractor/src/routes/registration-routes.js` - All POST endpoints that execute Playwright scripts

## Testing Steps

### Test 1: Reproduce Locally in Production Mode
```bash
NODE_ENV=production HEADLESS=true node scripts/restaurant-registration/add-item-tags.js \
  --email="test@example.com" \
  --password="Test123!" \
  --name="Test Restaurant"
```

### Test 2: Check if Page Loads
Add debugging to script:
```javascript
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('Page URL:', page.url());
console.log('Page title:', await page.title());
const html = await page.content();
console.log('Page HTML (first 500 chars):', html.substring(0, 500));
```

### Test 3: Check for Cloudflare Challenge
Look for Cloudflare challenge page indicators:
- Title contains "Just a moment"
- Page has `cf-browser-verification` element
- 403 status code

## Current Configuration

### Dockerfile
```dockerfile
FROM mcr.microsoft.com/playwright:v1.54.0-jammy
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV HEADLESS=true
```

### Browser Config (browser-config.cjs)
```javascript
const headless = IS_PRODUCTION || FORCE_HEADLESS;  // true on Railway
baseConfig.args = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--single-process'  // Added in production
];
```

## Next Steps

1. **First**: Try adding explicit `waitForSelector` before `fill` calls
2. **Second**: Test locally with production settings to reproduce
3. **Third**: Add page content logging to see what's actually loading
4. **Fourth**: Consider architectural changes if timeouts persist

## Related Files

- `scripts/restaurant-registration/add-item-tags.js` - Failing script
- `scripts/lib/browser-config.cjs` - Browser launch configuration
- `UberEats-Image-Extractor/src/routes/registration-routes.js` - API routes
- `Dockerfile` - Container configuration
- `planning/deployment/ENVIRONMENT-CONFIGURATION-GUIDE.md` - Env var docs
