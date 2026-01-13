# Synthesis and Recommendations: Auth Middleware Network Timeout Errors

**Date:** 2026-01-03
**Status:** Investigation Complete - Ready for Implementation
**Priority:** P1 - Critical

---

## Summary of Findings

### Root Cause Confirmed

The intermittent 401 errors are caused by **transient network timeouts** during `supabase.auth.getUser()` calls in the auth middleware. These are NOT JWT expiration issues.

**Error Types:**
- `AuthRetryableFetchError` - Supabase marks these as retryable
- `ECONNRESET` - Connection reset by peer
- `UND_ERR_CONNECT_TIMEOUT` - HTTP client timeout

### Current State

| Component | Issue | Severity |
|-----------|-------|----------|
| Auth Middleware | Zero retry logic | CRITICAL |
| Supabase Clients | No retry configuration | HIGH |
| Frontend API | No 401 recovery | MEDIUM |

### Key Discovery

The codebase already has a proven retry pattern in `database-error-handler.js` that can be directly applied to auth middleware with minor adaptations.

---

## Recommended Implementation Plan

### Phase 1: Auth Middleware Retry (Critical - Do First)

**Files to Modify:**
1. `middleware/auth.js` - Lines 60 and 71-78
2. `middleware/superAdmin.js` - Lines 28, 40, 99, 107
3. `middleware/feature-flags.js` - Lines 106-118

**Changes:**

1. **Extend `isTransientError()` in `database-error-handler.js`:**

```javascript
// Add to existing function
if (error.name === 'AuthRetryableFetchError') return true;
if (errorStr.includes('UND_ERR_CONNECT_TIMEOUT')) return true;
if (errorStr.includes('ConnectTimeoutError')) return true;
```

2. **Import and use in auth.js:**

```javascript
const { executeWithRetry, isTransientError } = require('../src/services/database-error-handler');

// Replace line 60:
const result = await executeWithRetry(
  () => supabase.auth.getUser(token),
  'JWT verification'
);
const user = result?.user;

// Replace lines 71-78:
const profile = await executeWithRetry(
  () => supabase.from('profiles').select('*, organisation:organisations(*)').eq('id', user.id).single(),
  `Profile fetch for ${user.id}`
);
```

3. **Update error responses for transient failures:**

```javascript
catch (error) {
  if (isTransientError(error)) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      retryable: true
    });
  }
  return res.status(401).json({
    error: 'Invalid token',
    retryable: false
  });
}
```

### Phase 2: Frontend Improvements (Secondary)

**File:** `src/services/api.js`

Add response interceptor to handle 503 errors with automatic retry:

```javascript
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 503 && error.response?.data?.retryable) {
      await new Promise(r => setTimeout(r, 1000));
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Phase 3: Optional Client-Level Retry

If additional resilience is needed, add `fetch-retry` to Supabase clients:

```bash
npm install fetch-retry
```

```javascript
const fetchRetry = require('fetch-retry')(fetch, {
  retries: 2,
  retryDelay: attempt => 500 * Math.pow(2, attempt)
});

const supabase = createClient(url, key, {
  global: { fetch: fetchRetry }
});
```

---

## Expected Outcome

After implementing Phase 1:
- 99% of transient network errors will be silently recovered
- Users will not see random 401 errors
- Only permanent auth failures (expired/invalid tokens) will return 401
- Logging will show retry attempts for debugging

---

## Files Created

1. [INVESTIGATION_TASK_1_AUTH_MIDDLEWARE.md](./INVESTIGATION_TASK_1_AUTH_MIDDLEWARE.md) - Auth middleware deep dive
2. [INVESTIGATION_TASK_2_SUPABASE_CLIENT.md](./INVESTIGATION_TASK_2_SUPABASE_CLIENT.md) - Supabase client configuration
3. [INVESTIGATION_TASK_3_FRONTEND_ERROR_HANDLING.md](./INVESTIGATION_TASK_3_FRONTEND_ERROR_HANDLING.md) - Frontend error handling
4. [INVESTIGATION_TASK_4_RETRY_PATTERNS.md](./INVESTIGATION_TASK_4_RETRY_PATTERNS.md) - Existing retry patterns analysis

---

## Next Steps

1. **Create implementation branch** for auth middleware retry fix
2. **Apply changes to `auth.js`** first (most impacted)
3. **Test with network simulation** (throttle/disconnect)
4. **Apply to `superAdmin.js` and `feature-flags.js`**
5. **Monitor logs** for retry patterns in production

---

**Investigation Complete**
