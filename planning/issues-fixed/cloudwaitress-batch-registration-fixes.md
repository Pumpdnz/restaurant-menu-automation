# CloudWaitress Batch Registration Fixes

**Date:** 2024-12-30
**Issue:** Batch YOLO mode registration failing with CloudWaitress account creation errors

---

## Issues Fixed

### 1. `supabase.raw is not a function` Error

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js:297`

**Problem:** The error handler used `supabase.raw('retry_count + 1')` which doesn't exist in the Supabase JS client (that's a Knex/raw SQL pattern).

**Fix:** Replaced with JavaScript increment:
```javascript
// Before
retry_count: supabase.raw('retry_count + 1')

// After
retry_count: (account.retry_count || 0) + 1
```

---

### 2. Organization Header Spelling Mismatch

**File:** `UberEats-Image-Extractor/middleware/organization-middleware.js:11-12`

**Problem:** The batch service sent `X-Organisation-ID` (British spelling) but the middleware only checked for `x-organization-id` (American spelling). This caused the organization ID to not be passed through for internal API calls.

**Fix:** Updated middleware to accept both spellings:
```javascript
const orgId = req.headers['x-organization-id'] || req.headers['X-Organization-ID'] ||
              req.headers['x-organisation-id'] || req.headers['X-Organisation-ID'];
```

---

### 3. CloudWaitress Rate Limiting (Server-Level)

**Files:**
- `UberEats-Image-Extractor/.env.example` (added config)
- `UberEats-Image-Extractor/src/services/registration-batch-service.js` (implementation)

**Problem:** CloudWaitress API has rate limits for account creation. When batch registration processed multiple restaurants in parallel, all CloudWaitress API calls happened simultaneously, triggering rate limiting.

**Solution:** Implemented a **server-level rate limiter queue** that:
1. All `cloudwaitressAccount` sub-steps go through a global queue
2. Only one account creation executes at a time
3. Enforces minimum delay between executions
4. All other registration steps (codeGeneration, restaurantRegistration, etc.) still run in parallel

**Configuration:**
```bash
CLOUDWAITRESS_RATE_LIMIT_MS=60000  # 60 seconds between account creations (default)
CLOUDWAITRESS_RATE_LIMIT_MS=0      # Disable rate limiting
```

---

## Architecture

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Registration Batch Processing                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Restaurant A ─┬─► cloudwaitressAccount ──┐                        │
│                ├─► codeGeneration ────────┼─► (parallel)           │
│                └─► createOnboardingUser ──┘                        │
│                                                                     │
│  Restaurant B ─┬─► cloudwaitressAccount ──┐                        │
│                ├─► codeGeneration ────────┼─► (parallel)           │
│                └─► createOnboardingUser ──┘                        │
│                                                                     │
│  Restaurant C ─┬─► cloudwaitressAccount ──┐                        │
│                ├─► codeGeneration ────────┼─► (parallel)           │
│                └─► createOnboardingUser ──┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CloudWaitress Rate Limiter Queue (Global)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  cloudwaitressAccount(A) ──► [60s delay] ──►                       │
│  cloudwaitressAccount(B) ──► [60s delay] ──►                       │
│  cloudwaitressAccount(C) ──► API                                   │
│                                                                     │
│  (FIFO queue, one at a time, with rate limit delays)               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **`CloudWaitressRateLimiter` class** (lines 36-92)
   - Global singleton queue for account creations
   - Tracks last execution time
   - Calculates required delay before next execution
   - Processes queue FIFO

2. **`executeSubStep` function** (lines 1886-1906)
   - Detects `cloudwaitressAccount` sub-step
   - Routes through rate limiter queue
   - All other sub-steps execute directly

3. **`executeSubStepInternal` function** (lines 1913+)
   - Contains the actual retry logic
   - Called by rate limiter or directly

### Rate Limiting Scope

| Scenario | Rate Limited? |
|----------|---------------|
| Single batch with multiple restaurants | Yes |
| Multiple batches running simultaneously | Yes |
| Multiple users running batches | Yes |
| Single-restaurant YOLO mode | Yes (if enabled) |
| Direct API calls to /register-account | No (not routed through queue) |

---

## Current Limitations

### 1. In-Memory Queue
The rate limiter uses an in-memory queue, meaning:
- Queue is lost on server restart
- Only works for single-instance deployments
- Jobs in queue when server restarts will fail

### 2. Direct API Calls Not Rate Limited
Calls made directly to `/api/registration/register-account` (not through batch processing) bypass the rate limiter.

---

## Future Improvements

### 1. Persistent Queue (Redis/Database)
For multi-instance deployments or queue persistence:
```javascript
// Redis-based rate limiter
const Redis = require('ioredis');
const redis = new Redis();

class DistributedCloudWaitressRateLimiter {
  async enqueue(operation, jobInfo) {
    const lockKey = 'cloudwaitress:lock';
    const lastExecKey = 'cloudwaitress:lastExecution';

    // Acquire distributed lock
    // Check last execution time from Redis
    // Execute with proper delay
    // Release lock
  }
}
```

### 2. Rate Limit Direct API Calls
Move rate limiting to `cloudwaitress-api-service.js`:
```javascript
class CloudWaitressAPIService {
  static rateLimiter = new CloudWaitressRateLimiter();

  async registerUser(email, phone, password) {
    return CloudWaitressAPIService.rateLimiter.enqueue(
      () => this._registerUserInternal(email, phone, password),
      email
    );
  }
}
```

### 3. Exponential Backoff on 429
Add retry with backoff when API returns rate limit errors:
```javascript
if (error.status === 429) {
  const retryAfter = error.headers['retry-after'] || 60;
  await delay(retryAfter * 1000);
  return this.registerUser(email, phone, password);
}
```

### 4. Per-Organization Rate Limits
If different organizations have different CloudWaitress API limits:
```javascript
const orgRateLimits = await getOrgSettings(orgId);
const rateLimit = orgRateLimits.cloudwaitress_rate_limit_ms || CLOUDWAITRESS_RATE_LIMIT_MS;
```

---

## Testing

After making these changes:
1. Restart the server
2. Set `CLOUDWAITRESS_RATE_LIMIT_MS=60000` in `.env`
3. Run a batch registration with 3+ restaurants
4. Observe logs showing queue behavior

Expected log output:
```
[Registration Batch Service] Starting Yolo Mode for 3 selected restaurants
[CloudWaitress Queue] Added to queue: Restaurant A (queue length: 1)
[CloudWaitress Queue] Executing: Restaurant A (remaining in queue: 0)
[CloudWaitress Queue] Added to queue: Restaurant B (queue length: 1)
[CloudWaitress Queue] Added to queue: Restaurant C (queue length: 2)
[Registration Batch Service] Sub-step cloudwaitressAccount completed successfully
[CloudWaitress Queue] Rate limit: waiting 60000ms before Restaurant B
[CloudWaitress Queue] Executing: Restaurant B (remaining in queue: 1)
...
```

Note: Other sub-steps (codeGeneration, createOnboardingUser, etc.) will complete in parallel while account creations are queued.
