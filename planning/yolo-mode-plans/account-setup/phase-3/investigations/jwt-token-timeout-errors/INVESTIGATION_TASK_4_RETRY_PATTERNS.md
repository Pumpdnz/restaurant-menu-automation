# Investigation Task 4: Existing Retry Patterns Analysis

**Date:** 2026-01-03
**Investigator:** Claude Code
**Status:** Complete

## Executive Summary

The codebase has a proven retry pattern in `database-error-handler.js` with `executeWithRetry()` and `isTransientError()` functions. This pattern **CAN and SHOULD be applied** to auth middleware with minor adaptations.

---

## Part 1: Existing Pattern Overview

**File:** `src/services/database-error-handler.js`

### Key Functions

1. **`isTransientError(error)`** - Identifies retryable errors
2. **`executeWithRetry(operation, operationName, retryCount)`** - Wraps operations with retry logic

### Retry Characteristics

- Exponential backoff: `1000ms * Math.pow(2, retryCount)` → 1s, 2s, 4s
- Max 3 retries
- Handles both Supabase `{ data, error }` pattern AND thrown exceptions
- Detailed logging with operation names

---

## Part 2: `isTransientError()` Analysis

```javascript
function isTransientError(error) {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  // Cloudflare 5xx errors
  if (errorStr.includes('520:') || errorStr.includes('502:') ||
      errorStr.includes('503:') || errorStr.includes('504:') ||
      errorStr.includes('cloudflare') || errorStr.includes('<!DOCTYPE html>')) {
    return true;
  }

  // Network/connection errors
  if (errorStr.includes('ECONNRESET') || errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED')) {
    return true;
  }

  // HTTP 5xx status codes
  if (error.status >= 500 || error.code >= 500) {
    return true;
  }

  return false;
}
```

### Error Classification

| Error Group | Errors | Applies to Auth? |
|-------------|--------|-----------------|
| Cloudflare | 520, 502, 503, 504 | YES |
| Network | ECONNRESET, ETIMEDOUT, ENOTFOUND | YES |
| HTTP 5xx | status >= 500 | YES |

### Missing Auth-Specific Errors

These should be added for auth middleware:
- `AuthRetryableFetchError` - Supabase auth-specific
- `UND_ERR_CONNECT_TIMEOUT` - undici HTTP client
- `ConnectTimeoutError` - Connection timeout

---

## Part 3: How `executeWithRetry()` Works

```javascript
async function executeWithRetry(operation, operationName, retryCount = 0) {
  try {
    const result = await operation();

    // Handle Supabase { data, error } pattern
    if (result && typeof result === 'object' && 'error' in result) {
      if (result.error) {
        if (isTransientError(result.error) && retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retryCount);
          console.warn(`[${operationName}] Transient error, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry(operation, operationName, retryCount + 1);
        }
        throw result.error;
      }
      return result.data;
    }
    return result;
  } catch (error) {
    if (isTransientError(error) && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.warn(`[${operationName}] Retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(operation, operationName, retryCount + 1);
    }
    throw error;
  }
}
```

---

## Part 4: Usage Examples from Codebase

**File:** `registration-batch-service.js`

```javascript
const data = await executeWithRetry(
  () => client
    .from('registration_job_steps')
    .update(updates)
    .eq('job_id', jobId)
    .single(),
  `updateStepStatus(job=${jobId}, step=${stepNumber})`
);
```

**Pattern:** Wrap Supabase query in arrow function, provide operation name for logging.

---

## Part 5: Applying to Auth Middleware

### Recommended Implementation

```javascript
// middleware/auth.js
const { executeWithRetry } = require('../src/services/database-error-handler');

async function authMiddleware(req, res, next) {
  // ... token extraction ...

  try {
    // Wrap getUser in retry logic
    const result = await executeWithRetry(
      () => supabase.auth.getUser(token),
      `JWT verification`
    );

    const user = result?.user;
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Wrap profile fetch in retry logic
    const profile = await executeWithRetry(
      () => supabase
        .from('profiles')
        .select('*, organisation:organisations(*)')
        .eq('id', user.id)
        .single(),
      `Profile fetch for ${user.id}`
    );

    // ... continue middleware ...
  } catch (error) {
    if (isTransientError(error)) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
```

### Required Extension to `isTransientError()`

```javascript
function isTransientError(error) {
  // ... existing checks ...

  // Add auth-specific retryable errors
  if (error.name === 'AuthRetryableFetchError') {
    return true;
  }

  // undici HTTP client timeouts
  if (errorStr.includes('UND_ERR_CONNECT_TIMEOUT') ||
      errorStr.includes('ConnectTimeoutError')) {
    return true;
  }

  return false;
}
```

---

## Part 6: Retry Timing Recommendations

### Current (Database Operations)
- Base delay: 1000ms
- Sequence: 1s, 2s, 4s
- Total wait: 7 seconds

### Suggested for Auth (Faster)
- Base delay: 500ms
- Sequence: 500ms, 1s, 2s
- Total wait: 3.5 seconds

Auth should be faster for better UX.

---

## Part 7: Error Response Differentiation

### After Retries Exhausted

```javascript
catch (error) {
  if (isTransientError(error)) {
    // Network failure - service unavailable
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Authentication service temporarily unavailable'
    });
  }

  // Non-transient error - actual auth failure
  return res.status(401).json({
    error: 'Invalid token',
    message: 'Token is invalid or expired'
  });
}
```

This tells the frontend whether to retry or redirect to login.

---

## Conclusion

The existing `executeWithRetry` pattern is **directly applicable** to auth middleware. Required changes:

1. Extend `isTransientError()` with auth-specific errors
2. Wrap `supabase.auth.getUser()` in `executeWithRetry()`
3. Wrap profile fetch in `executeWithRetry()`
4. Return 503 for transient failures vs 401 for auth failures

---

**Report Generated:** 2026-01-03
