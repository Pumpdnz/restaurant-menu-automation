# Investigation Plan: Auth Middleware Network Timeout Errors

**Date:** 2026-01-03
**Status:** Ready for Parallel Investigation
**Priority:** P1 - Critical (affects multiple features across the application)

---

## Purpose of Investigation

The application is experiencing intermittent authentication failures across multiple features. Despite the error logs mentioning "Token verification failed", analysis reveals these are **network connectivity issues**, not JWT expiration issues.

**Key Evidence:**
- Error type: `AuthRetryableFetchError` (Supabase marks these as retryable)
- Underlying causes: `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`
- The `supabase.auth.getUser(token)` call in `authMiddleware` makes a network request to Supabase
- When Supabase is temporarily unreachable, ALL authenticated API requests fail

**Affected Features:**
- Menu item bulk updates (`POST /api/menu-items/bulk-update`)
- Sequence polling on RestaurantDetail page (`GET /api/sequence-instances/...`)
- Any feature using `authMiddleware`

---

## Known Information

### Current Auth Middleware Implementation

**File:** `UberEats-Image-Extractor/middleware/auth.js`

The middleware calls `supabase.auth.getUser(token)` on every request:
```javascript
// Line 60
const { data: { user }, error } = await supabase.auth.getUser(token);

if (error || !user) {
  console.error('Token verification failed:', error);
  return res.status(401).json({
    error: 'Invalid token',
    message: 'Token is invalid or expired'
  });
}
```

**Problem:** No retry logic for transient network errors. Even retryable errors (`AuthRetryableFetchError`) cause immediate 401 responses.

### Error Types Observed

| Error | Cause | Retryable? |
|-------|-------|------------|
| `AuthRetryableFetchError` | Network failure during auth | YES |
| `ECONNRESET` | Connection reset by peer | YES |
| `UND_ERR_CONNECT_TIMEOUT` | 10s timeout to Supabase | YES |
| `ConnectTimeoutError` | Connection timeout | YES |

### Existing Retry Pattern

The codebase already has retry logic in `database-error-handler.js`:
```javascript
const { executeWithRetry, isTransientError } = require('./database-error-handler');
```

This pattern should be applied to auth middleware network calls.

---

## Instructions for Next Session

Execute the following investigation tasks **in parallel** using the Task tool with multiple subagents. Each subagent should:
1. Investigate their assigned area thoroughly
2. Create an investigation document in this folder
3. NOT make any code changes
4. Report findings with specific recommendations

### Execution Steps

1. **Read this document first** to understand the context
2. **Spawn 4 subagents in parallel** using the Task tool:
   - Subagent 1: Auth Middleware Analysis
   - Subagent 2: Supabase Client Configuration
   - Subagent 3: Frontend Error Handling
   - Subagent 4: Existing Retry Patterns
3. **Wait for all subagents to complete** their investigations
4. **Read all investigation documents** created by subagents
5. **Synthesize findings** and report to user with implementation recommendations

---

## Subagent 1: Auth Middleware Deep Dive

### Context
The auth middleware at `middleware/auth.js` is the central point of failure. Every authenticated request passes through it, and any network hiccup causes a 401 error.

### Instructions
1. Read the full `middleware/auth.js` file
2. Identify ALL network calls that could fail (getUser, profile fetch, etc.)
3. Check if there are multiple auth middleware files in the codebase
4. Look for any existing error handling or retry logic
5. Analyze the error propagation - how errors reach the frontend
6. Check if `AuthRetryableFetchError` is being handled anywhere

### Deliverable
Create `INVESTIGATION_TASK_1_AUTH_MIDDLEWARE.md` with:
- Current implementation analysis
- All network call points that need retry logic
- Specific code locations and line numbers
- Recommended changes with code examples

---

## Subagent 2: Supabase Client Configuration

### Context
The Supabase client is configured in multiple places. Connection pooling, timeouts, and retry settings may be configurable at the client level.

### Instructions
1. Search for all Supabase client creation points (`createClient`)
2. Check `database-service.js` for Supabase configuration
3. Analyze client options being passed (auth, timeout, retry settings)
4. Research Supabase JS client retry options (may need web search)
5. Check if connection pooling or keep-alive is configured
6. Look for any global fetch/axios interceptors

### Deliverable
Create `INVESTIGATION_TASK_2_SUPABASE_CLIENT.md` with:
- All Supabase client creation locations
- Current configuration options
- Available retry/timeout options from Supabase SDK
- Recommended client-level configuration changes

---

## Subagent 3: Frontend Error Handling

### Context
When auth fails, the frontend receives 401 errors. The user experience during transient network issues needs investigation.

### Instructions
1. Search for API error handling in React components
2. Check for axios/fetch interceptors in the frontend
3. Look for global error handling or error boundaries
4. Analyze how 401 errors are currently handled
5. Check if there's any client-side retry logic
6. Look at the API client configuration (likely in `lib/api.ts` or similar)

### Deliverable
Create `INVESTIGATION_TASK_3_FRONTEND_ERROR_HANDLING.md` with:
- Current frontend error handling patterns
- How 401 errors are processed
- Whether retry logic exists client-side
- Recommendations for improved UX during transient failures

---

## Subagent 4: Existing Retry Patterns Analysis

### Context
The codebase already has `database-error-handler.js` with retry logic. This pattern should inform the auth middleware fix.

### Instructions
1. Read `src/services/database-error-handler.js` thoroughly
2. Understand the `executeWithRetry` and `isTransientError` functions
3. Check how this is used in `registration-batch-service.js`
4. Look for other retry patterns in the codebase
5. Analyze if this pattern can be directly applied to auth middleware
6. Check for `AuthRetryableFetchError` handling anywhere

### Deliverable
Create `INVESTIGATION_TASK_4_RETRY_PATTERNS.md` with:
- Analysis of existing retry patterns
- How `isTransientError` identifies retryable errors
- Whether auth errors can use the same pattern
- Code examples for applying retry to auth middleware

---

## Expected Outcomes

After all investigations complete, we should have:

1. **Clear understanding** of all network call points in auth flow
2. **Supabase SDK options** for built-in retry/timeout configuration
3. **Frontend resilience** analysis and recommendations
4. **Reusable retry pattern** that can be applied to auth middleware

### Likely Solution Path

Based on initial analysis, the fix will likely involve:

1. **Auth Middleware Retry Logic:**
```javascript
async function authMiddleware(req, res, next) {
  // ... service key check ...

  const token = authHeader.substring(7);

  // Add retry logic for transient errors
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error) {
        // Check if error is retryable
        if (isAuthRetryableError(error) && attempts < maxAttempts - 1) {
          attempts++;
          await delay(1000 * Math.pow(2, attempts - 1)); // Exponential backoff
          continue;
        }
        throw error;
      }

      // Success - continue with user
      break;
    } catch (err) {
      if (isAuthRetryableError(err) && attempts < maxAttempts - 1) {
        attempts++;
        await delay(1000 * Math.pow(2, attempts - 1));
        continue;
      }
      throw err;
    }
  }
}

function isAuthRetryableError(error) {
  if (!error) return false;
  // AuthRetryableFetchError from Supabase
  if (error.name === 'AuthRetryableFetchError') return true;
  if (error.__isAuthError && error.status === 0) return true;
  // Network errors
  const errorStr = error.message || '';
  return errorStr.includes('ECONNRESET') ||
         errorStr.includes('ETIMEDOUT') ||
         errorStr.includes('fetch failed');
}
```

2. **Supabase Client Configuration** with longer timeouts or built-in retry

3. **Frontend Retry** for 401 errors that may be transient

---

*Plan created: 2026-01-03*
