# Investigation Task 2: Supabase Client Configuration

**Date:** 2026-01-03
**Investigator:** Claude Code
**Status:** Complete

## Executive Summary

All Supabase clients are created **WITHOUT** retry/timeout configuration. The SDK supports custom fetch wrappers with retry logic via the `fetch-retry` package, but this is not implemented anywhere.

---

## Part 1: All Supabase Client Creation Points

| File | Line | Configuration | Has Retry? |
|------|------|--------------|------------|
| `middleware/auth.js` | 11 | `auth: { autoRefreshToken: false, persistSession: false }` | NO |
| `middleware/superAdmin.js` | 4 | No custom config | NO |
| `middleware/feature-flags.js` | 25 | `auth: { autoRefreshToken: false, persistSession: false }` | NO |
| `src/services/database-service.js` | 25 | No custom config | NO |
| `src/services/database-service.js` | 37 | User-authenticated client with headers | NO |
| `src/services/usage-tracking-service.js` | 22 | `auth: { autoRefreshToken: false, persistSession: false }` | NO |
| `src/services/onboarding-service.js` | 38 | `auth: { autoRefreshToken: false, persistSession: false }` | NO |

---

## Part 2: Current Configuration Issues

All Supabase clients are created WITHOUT:
- Custom fetch implementations with retry logic
- Timeout configuration
- Connection pooling or keep-alive settings
- Error handling for transient network failures

---

## Part 3: Available SDK Options

### Option 1: Custom Fetch with `fetch-retry` Package

```javascript
import fetchRetry from 'fetch-retry';

const fetchWithRetry = fetchRetry(fetch, {
  retries: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  retryOn: (attempt, error, response) => {
    // Retry on network errors
    if (error) return attempt < 3;
    // Retry on 5xx
    if (response && response.status >= 500) return attempt < 3;
    return false;
  }
});

const supabase = createClient(url, key, {
  global: {
    fetch: fetchWithRetry,
  }
});
```

### Option 2: Keep-Alive Headers

```javascript
const supabase = createClient(url, key, {
  global: {
    headers: {
      'Connection': 'keep-alive',
    }
  }
});
```

---

## Part 4: Root Cause Analysis

The `AuthRetryableFetchError` errors in `auth.js` line 60 occur because:

1. **No automatic retries**: Auth config disables retry logic
2. **No custom fetch wrapper**: Network timeouts fail immediately
3. **No connection pooling**: Direct connections can reset under load

---

## Part 5: Recommendations

### Recommendation 1: Middleware-Level Retry (Preferred)

Add retry logic at the middleware level (see Task 1 & Task 4) rather than client level because:
- More control over retry behavior per operation
- Can distinguish auth errors from database errors
- Easier to log and debug

### Recommendation 2: Client-Level Retry (Alternative)

If client-level retry is preferred:

```javascript
// Create shared fetch-retry wrapper
const fetchWithRetry = require('fetch-retry')(fetch, {
  retries: 3,
  retryDelay: (attempt) => 1000 * Math.pow(2, attempt),
  retryOn: (attempt, error, response) => {
    if (attempt >= 3) return false;
    if (error) return true; // Network error
    if (response && response.status >= 500) return true;
    return false;
  }
});

// Use in all client creation
const supabase = createClient(url, key, {
  global: { fetch: fetchWithRetry },
  auth: { autoRefreshToken: false, persistSession: false }
});
```

---

## Sources

- [Supabase Automatic Retries Documentation](https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js)
- [Supabase Timeouts Documentation](https://supabase.com/docs/guides/database/postgres/timeouts)
- [JavaScript Client Reference](https://supabase.com/docs/reference/javascript/v1/initializing)

---

**Report Generated:** 2026-01-03
