# Playwright Script Execution Architecture Discussion

**Date**: 2025-12-09
**Status**: Discussion/Planning
**Related**: [PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md](./PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md)

## Executive Summary

Playwright scripts that work locally are timing out when executed via the Netlify → Railway architecture. This document analyzes the timeout chain and proposes architectural solutions.

---

## 1. Timeout Analysis

### Current Timeout Chain

```
Frontend (Netlify) → Proxy/Redirect → Railway API → child_process.exec → Playwright Script
    |                    |                |              |                    |
    |                    |                |              |                    └── Element timeout: 30s
    |                    |                |              └── Script timeout: 180s (3 min)
    |                    |                └── Express request: no explicit limit
    |                    └── Proxy timeout: ~26-30 seconds ❌ BOTTLENECK
    └── Browser HTTP request: browser default
```

### Platform-Specific Limits

| Layer | Timeout | Configurable? | Source |
|-------|---------|---------------|--------|
| **Netlify Proxy** | ~26-30 seconds | No (free tier) | [Netlify Forums](https://answers.netlify.com/t/504-gateway-timeout/15028) |
| **Railway HTTP** | 5 minutes (default) | Yes, up to 15 min | [Railway Help](https://station.railway.com/questions/set-timeout-on-railway-server-baf3b542) |
| **Node.js server** | 300s (5 min) | Yes, `server.requestTimeout` | Node.js docs |
| **child_process.exec** | 180s (configured) | Yes | `registration-routes.js` |
| **Playwright element** | 30s (default) | Yes, per-action | Playwright docs |

### The Critical Problem

**Netlify's proxy timeout of ~26-30 seconds cannot be increased on the free tier.** This means ANY request that takes longer than 30 seconds will return a 504 Gateway Timeout to the user, even if the script continues running on Railway.

---

## 2. Railway Container Behavior

### Cold Start Considerations

Railway containers may experience cold starts when:
1. Container scales to zero after inactivity (depends on plan)
2. New deployment triggers container restart
3. Health check failure triggers restart

**Impact on Playwright**:
- Cold start adds 5-15 seconds to first request
- Playwright browser initialization adds 3-10 seconds
- Combined with page load time, can easily exceed 30s

### Current Configuration (railway.json)

```json
{
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

The `healthcheckTimeout: 300` is for container health, not HTTP request timeout.

---

## 3. Playwright Selector Behavior in Headless Mode

### Why Selectors May Fail in Headless

1. **Cloudflare/Bot Protection**: Many sites detect headless browsers via:
   - Missing `navigator.webdriver` property override
   - JavaScript fingerprinting
   - TLS fingerprinting
   - Known headless browser user agents

2. **Different Rendering**: React apps may hydrate differently:
   - No GPU acceleration → slower rendering
   - Different viewport handling
   - Missing fonts/images (404s can block rendering)

3. **Network Timing**:
   - Railway's data center location affects latency
   - Different DNS resolution paths

### Current Browser Config Analysis

```javascript
// browser-config.cjs
const baseConfig = {
  headless,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
};

// In production, adds:
baseConfig.args.push('--single-process');
```

**Missing configurations that could help**:
- `--disable-blink-features=AutomationControlled`
- Custom user agent
- `viewport` explicitly set
- `--window-size` argument

### Script Flow Issue

```javascript
// Current (add-item-tags.js:116-120)
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('input[type="email"]', email);  // ← Fails here - no wait!
```

The script doesn't wait for the element to be visible/ready after `domcontentloaded`.

---

## 4. Architectural Options

### Option A: Fix Within Current Architecture

**Approach**: Add explicit waits, increase timeouts, optimize browser config

**Changes Required**:
1. Add `waitForSelector` before every `fill`/`click`
2. Increase individual action timeouts
3. Add bot-detection bypass to browser config
4. Add retry logic for flaky operations

**Pros**:
- Minimal code changes
- No infrastructure changes

**Cons**:
- Still limited by Netlify's 30s proxy timeout
- User sees 504 even if script succeeds
- Not scalable for longer operations

**Verdict**: ⚠️ May not fully solve the problem due to Netlify timeout

---

### Option B: Async Job Queue Pattern

**Approach**: Return job ID immediately, poll for completion

```
POST /api/registration/add-item-tags
  → Create job in database
  → Return { jobId: "abc123", status: "pending" }
  → Background worker executes script
  → Client polls GET /api/jobs/abc123 for status
```

**Implementation**:
```javascript
// Route handler
router.post('/add-item-tags', async (req, res) => {
  const jobId = await createJob('add-item-tags', req.body);
  res.json({ jobId, status: 'pending' });

  // Execute in background (don't await)
  executeJobAsync(jobId);
});

// Polling endpoint
router.get('/jobs/:id', async (req, res) => {
  const job = await getJob(req.params.id);
  res.json(job); // { status: 'pending|running|completed|failed', result: {...} }
});
```

**Pros**:
- Bypasses proxy timeout completely
- User gets immediate feedback
- Can show progress updates
- Scalable for any duration

**Cons**:
- Requires database table for jobs
- Frontend needs polling logic
- More complex error handling
- Need to handle abandoned jobs

**Verdict**: ✅ Recommended for medium-term solution

---

### Option C: WebSocket Progress Streaming

**Approach**: Use WebSocket to stream real-time progress

```
1. POST /api/registration/start → Returns { sessionId }
2. Client connects to WebSocket with sessionId
3. Server streams progress: { step: 1, message: "Logging in..." }
4. Final message: { complete: true, result: {...} }
```

**Pros**:
- Real-time feedback to user
- No polling overhead
- Better UX for long operations

**Cons**:
- WebSocket complexity
- Netlify WebSocket proxying has its own limits
- More infrastructure to manage
- Connection drops need handling

**Verdict**: 🔶 Good for UX but more complex

---

### Option D: Direct Railway API Access

**Approach**: Frontend calls Railway directly, bypassing Netlify proxy

```javascript
// Frontend
const RAILWAY_API = 'https://restaurant-menu-automation-production.up.railway.app';
fetch(`${RAILWAY_API}/api/registration/add-item-tags`, { ... })
```

**Changes Required**:
1. Update CORS on Railway to allow Netlify origin
2. Update frontend to use Railway URL for long-running endpoints
3. Keep Netlify proxy for quick endpoints

**Pros**:
- No Netlify timeout limit
- Simple to implement
- Uses Railway's 5-minute default timeout

**Cons**:
- CORS complexity
- Exposes Railway URL
- Still has 5-minute limit
- Split API access pattern

**Verdict**: 🔶 Quick fix but architectural compromise

---

### Option E: Separate Worker Service

**Approach**: Dedicated Railway service for Playwright scripts

```
Netlify Frontend
      │
      ▼
Railway API Service (Express)
      │
      ▼ (Message Queue: Redis/BullMQ)
      │
Railway Worker Service (Playwright)
      │
      ▼
Database (Job Results)
```

**Pros**:
- Proper separation of concerns
- Workers can scale independently
- No timeout issues
- Production-grade pattern

**Cons**:
- Additional Railway service cost
- Redis/queue infrastructure
- More deployment complexity

**Verdict**: ✅ Best for production scale, but highest effort

---

## 5. Recommended Approach

### Immediate Fix (Do Now)

1. **Add explicit waits to all scripts**:
   ```javascript
   await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
   await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 60000 });
   await page.fill('input[type="email"]', email);
   ```

2. **Update browser config for bot detection bypass**:
   ```javascript
   args: [
     '--no-sandbox',
     '--disable-setuid-sandbox',
     '--disable-dev-shm-usage',
     '--disable-gpu',
     '--disable-blink-features=AutomationControlled',
   ],
   ```

3. **Test locally with production settings**:
   ```bash
   NODE_ENV=production HEADLESS=true node scripts/restaurant-registration/add-item-tags.js \
     --email="test@example.com" --password="Test123!" --name="Test Restaurant"
   ```

### Short-Term Solution (This Week)

**Implement Option D: Direct Railway Access for long-running endpoints**

1. Update Railway CORS to allow Netlify origin
2. Create a config for which endpoints use direct Railway URL
3. Update frontend API service to route long-running requests directly

### Medium-Term Solution (This Month)

**Implement Option B: Async Job Queue**

1. Add `jobs` table to Supabase
2. Create job management endpoints
3. Update frontend to use polling pattern
4. Add job cleanup/expiration logic

---

## 6. Testing Plan

### Test 1: Reproduce Locally

```bash
# Test with production settings
cd /Users/giannimunro/Desktop/cursor-projects/automation
NODE_ENV=production HEADLESS=true node scripts/restaurant-registration/add-item-tags.js \
  --email="test@example.com" \
  --password="Test123!" \
  --name="Test Restaurant"
```

### Test 2: Debug Page Loading

Add to script before filling:
```javascript
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('Page URL:', page.url());
console.log('Page title:', await page.title());
const content = await page.content();
console.log('Has email input:', content.includes('input') && content.includes('email'));
console.log('First 500 chars:', content.substring(0, 500));
```

### Test 3: Check for Bot Detection

Look for these indicators in page content:
- Title: "Just a moment" (Cloudflare)
- Body contains "checking your browser"
- 403/401 status
- Captcha elements

---

## 7. Files to Modify

### Scripts (Add Explicit Waits)
- `scripts/restaurant-registration/add-item-tags.js`
- `scripts/restaurant-registration/add-option-sets.js`
- `scripts/restaurant-registration/import-csv-menu.js`
- `scripts/restaurant-registration/upload-menu-images.js`
- `scripts/restaurant-registration/register-restaurant-production.js`
- `scripts/restaurant-registration/login-and-register-restaurant.js`

### Browser Config
- `scripts/lib/browser-config.cjs` - Add bot detection bypass

### Routes (For Async Pattern)
- `UberEats-Image-Extractor/src/routes/registration-routes.js`

### Frontend (For Direct Access or Polling)
- `UberEats-Image-Extractor/src/services/api.js`

---

## 8. Decision Required

Please choose the approach you'd like to implement:

1. **Quick Fix Only**: Add explicit waits + test → May still timeout due to Netlify
2. **Quick Fix + Direct Railway**: Bypass Netlify for long endpoints → Works but architectural compromise
3. **Quick Fix + Async Queue**: Full solution → More work but scalable
4. **All Three**: Layered approach → Most robust

**Recommendation**: Start with Quick Fix (#1), test, and if still failing, implement Direct Railway (#2) as interim while building Async Queue (#3).
