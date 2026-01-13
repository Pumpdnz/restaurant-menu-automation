# Investigation Task 1: Auth Middleware Deep Dive Analysis

**Date:** 2026-01-03
**Investigator:** Claude Code
**Status:** Complete
**Priority:** P1 - Critical

## Executive Summary

The auth middleware implementation has **NO retry logic** for transient network errors. Every authenticated API request passes through `authMiddleware`, and any network hiccup causes immediate 401 errors. There are **5 critical network call points** that lack resilience across 3 middleware files.

---

## Part 1: Current Implementation Analysis

### File Structure

The application has **4 middleware files** in `/UberEats-Image-Extractor/middleware/`:

1. **auth.js** - Main authentication middleware
2. **superAdmin.js** - Super admin role verification
3. **feature-flags.js** - Feature flag enforcement
4. **organization-middleware.js** - Organization context setup

---

## Part 2: All Network Call Points That Need Retry Logic

### Point 1: Token Verification - `supabase.auth.getUser()`

**File:** `UberEats-Image-Extractor/middleware/auth.js`
**Line:** 60
**Current Code:**
```javascript
const { data: { user }, error } = await supabase.auth.getUser(token);

if (error || !user) {
  console.error('Token verification failed:', error);
  return res.status(401).json({
    error: 'Invalid token',
    message: 'Token is invalid or expired'
  });
}
```

**Risk Assessment:**
- **Frequency:** Every authenticated request passes through this
- **Failure Type:** `AuthRetryableFetchError`, `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`
- **Error Propagation:** Returns 401 to frontend - user sees auth failure
- **Impact:** HIGH - Blocks entire API access on transient network issues

---

### Point 2: Profile Fetch from Database

**File:** `UberEats-Image-Extractor/middleware/auth.js`
**Lines:** 71-78
**Current Code:**
```javascript
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select(`
    *,
    organisation:organisations(*)
  `)
  .eq('id', user.id)
  .single();

if (profileError || !profile) {
  console.error('Profile fetch failed:', profileError);
  return res.status(403).json({
    error: 'Profile not found',
    message: 'User profile does not exist'
  });
}
```

**Risk Assessment:**
- **Frequency:** Every authenticated request
- **Failure Type:** Same network errors as getUser()
- **Error Propagation:** Returns 403 - indistinguishable from permission denial
- **Impact:** HIGH - Even if token is valid, network hiccup causes 403

---

### Point 3: Super Admin Middleware - Token Verification

**File:** `UberEats-Image-Extractor/middleware/superAdmin.js`
**Lines:** 28, 99

**Risk Assessment:**
- **Frequency:** All super admin endpoints
- **Impact:** HIGH - Blocks super admin functionality

---

### Point 4: Super Admin Profile Fetch

**File:** `UberEats-Image-Extractor/middleware/superAdmin.js`
**Lines:** 40, 107

**Risk Assessment:**
- **Frequency:** Super admin requests
- **Impact:** MEDIUM-HIGH - Super admin functions fail

---

### Point 5: Feature Flags Organization Fetch

**File:** `UberEats-Image-Extractor/middleware/feature-flags.js`
**Lines:** 106-118

**Risk Assessment:**
- **Frequency:** Feature flag checking on guarded endpoints
- **Error Propagation:** Returns 403 - looks like permission denial
- **Impact:** MEDIUM-HIGH - Features become unavailable

---

## Part 3: Summary Table

| Middleware | Function | Call Type | Line(s) | Retry? |
|-----------|----------|-----------|--------|--------|
| auth.js | authMiddleware | getUser | 60 | NO |
| auth.js | authMiddleware | profiles.select | 71-78 | NO |
| superAdmin.js | superAdminMiddleware | getUser | 28 | NO |
| superAdmin.js | superAdminMiddleware | profiles.select | 40 | NO |
| superAdmin.js | checkSuperAdmin | getUser | 99 | NO |
| superAdmin.js | checkSuperAdmin | profiles.select | 107 | NO |
| feature-flags.js | checkFeatureFlag | organisations.select | 106-118 | NO |

---

## Part 4: AuthRetryableFetchError Handling

### Current State: NOT HANDLED ANYWHERE

- `AuthRetryableFetchError` is not caught or handled in the codebase
- Zero instances of error name checking (`error.name === 'AuthRetryableFetchError'`)
- Supabase SDK marks these errors as retryable, but we ignore that signal

---

## Part 5: Recommended Changes

### Create Auth-Specific Retry Wrapper

```javascript
// middleware/auth-retry.js
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

function isAuthRetryableError(error) {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  // AuthRetryableFetchError from Supabase SDK
  if (error.name === 'AuthRetryableFetchError') return true;
  if (error.__isAuthError && error.status === 0) return true;

  // Network errors
  return errorStr.includes('ECONNRESET') ||
         errorStr.includes('ETIMEDOUT') ||
         errorStr.includes('UND_ERR_CONNECT_TIMEOUT') ||
         errorStr.includes('fetch failed');
}

async function executeAuthWithRetry(operation, operationName) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await operation();

      if (result && typeof result === 'object' && 'error' in result) {
        if (result.error) {
          lastError = result.error;

          if (isAuthRetryableError(result.error) && attempt < MAX_RETRIES - 1) {
            const delay = BASE_DELAY * Math.pow(2, attempt);
            console.warn(`[Auth Retry] ${operationName} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw result.error;
        }
        return result.data;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (isAuthRetryableError(error) && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`[Auth Retry] ${operationName} threw error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

module.exports = { executeAuthWithRetry, isAuthRetryableError };
```

---

## Conclusion

The auth middleware has **zero resilience** to network timeouts. This is the root cause of intermittent 401 errors. The fix requires wrapping all Supabase calls in retry logic that distinguishes transient errors from permanent auth failures.

---

**Report Generated:** 2026-01-03
**Next Steps:** Implement retry logic using existing patterns from database-error-handler.js
