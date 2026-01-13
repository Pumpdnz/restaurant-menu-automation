# Investigation Task 3: Frontend Error Handling

**Date:** 2026-01-03
**Investigator:** Claude Code
**Status:** Complete

## Executive Summary

The frontend has **NO centralized 401 error handling**. When auth fails due to network timeouts, the error propagates to individual components. There is no automatic token refresh or retry mechanism for transient auth failures.

---

## Part 1: API Client Configuration

**File:** `src/services/api.js`

- Uses axios instances (`api` and `railwayApi`)
- **Request Interceptor:** Adds Bearer token from Supabase session
- **NO Response Interceptor:** 401 errors are NOT caught globally
- Each component handles errors individually

**Critical Gap:** No centralized 401 handling or retry logic.

---

## Part 2: How 401 Errors Are Currently Handled

### No Centralized Handler

- 401 errors pass directly to component `onError` callbacks
- Example from hooks:

```javascript
onError: (error: any) => {
  toast.error('Failed to create job', {
    description: error.response?.data?.error || error.message,
  });
}
```

### No Token Refresh on 401

- If backend returns 401, frontend shows error
- No attempt to refresh token and retry

---

## Part 3: React Query Configuration

**File:** `src/App.tsx` (lines 48-57)

```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,  // Only retries ONCE
      refetchOnWindowFocus: false,
    },
  },
});
```

**Issues:**
- `retry: 1` applies to all errors equally
- No distinction between network timeouts and auth failures
- No exponential backoff

---

## Part 4: Summary of Gaps

| Issue | Severity | Impact |
|-------|----------|--------|
| No response interceptor for 401 errors | CRITICAL | Token timeouts cause hard failures |
| No token refresh retry logic | CRITICAL | Transient auth failures not retried |
| React Query retry doesn't distinguish error types | HIGH | 401s treated same as network errors |
| Decentralized error handling | HIGH | Inconsistent UX |

---

## Part 5: Recommendations

### Recommendation 1: Add Axios Response Interceptor

```javascript
// src/services/api.js
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Try to refresh session
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (data?.session) {
        // Update token and retry
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
        return api(originalRequest);
      }

      // Refresh failed - redirect to login
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
```

### Recommendation 2: Smart React Query Retry

```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 401s (handled by interceptor)
        if (error?.response?.status === 401) return false;
        // Retry 5xx and network errors up to 3 times
        if (error?.response?.status >= 500) return failureCount < 3;
        if (!error?.response) return failureCount < 3; // Network error
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### Recommendation 3: User-Friendly Error States

```javascript
// Show "Reconnecting..." during retries
// Show "Connection lost. Try again?" after max retries
// Only redirect to login on confirmed auth failure
```

---

## Part 6: Priority

**Backend fix is more impactful:** Fixing the auth middleware retry logic (Task 1) will prevent most 401 errors from reaching the frontend. Frontend improvements are secondary but still recommended for resilience.

---

**Report Generated:** 2026-01-03
