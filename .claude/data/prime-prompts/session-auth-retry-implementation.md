/prime planning/yolo-mode-plans/account-setup/phase-3/investigations/jwt-token-timeout-errors/

## Context: Auth Middleware Retry Logic Implementation

The application has intermittent authentication failures caused by network timeouts when the auth middleware calls `supabase.auth.getUser()`. The errors are `AuthRetryableFetchError` with `ECONNRESET` and `UND_ERR_CONNECT_TIMEOUT` - these are transient network issues, not JWT expiration. The auth middleware has no retry logic, so any network hiccup causes 401 errors.

### Previous Sessions Summary
- **Investigation Session**: Conducted parallel investigation with 4 subagents analyzing:
  - Auth middleware implementation (7 network call points with no retry)
  - Supabase client configuration (6 clients, none with retry config)
  - Frontend error handling (no 401 recovery mechanism)
  - Existing retry patterns (`executeWithRetry` in database-error-handler.js)
- **Planning Session**: Created complete implementation plan with exact code diffs for all 4 files

---

## Tasks for Implementation Session

### Task 1: Extend isTransientError() in database-error-handler.js
**Goal:** Add auth-specific error detection

**File to modify:**
- `UberEats-Image-Extractor/src/services/database-error-handler.js` - Add detection for `AuthRetryableFetchError`, `UND_ERR_CONNECT_TIMEOUT`, `error.__isAuthError`

**Changes (Lines 16-41):**
- Add `error.name === 'AuthRetryableFetchError'` check
- Add `error.__isAuthError && error.status === 0` check
- Add `UND_ERR_CONNECT_TIMEOUT`, `ConnectTimeoutError`, `fetch failed` to network errors

### Task 2: Update auth.js with retry logic
**Goal:** Wrap `getUser()` and profile fetch in `executeWithRetry()`

**File to modify:**
- `UberEats-Image-Extractor/middleware/auth.js`

**Changes:**
- Add import for `executeWithRetry`, `isTransientError`
- Wrap `supabase.auth.getUser(token)` at line 60 in retry
- Wrap profile fetch at lines 71-78 in retry
- Return 503 with `retryable: true` for transient errors after retries

### Task 3: Update superAdmin.js with retry logic
**Goal:** Add retry to both middleware functions

**File to modify:**
- `UberEats-Image-Extractor/middleware/superAdmin.js`

**Changes:**
- Add import for retry utilities
- Update `superAdminMiddleware` (lines 13-83)
- Update `checkSuperAdmin` (lines 89-126)

### Task 4: Update feature-flags.js with retry logic
**Goal:** Add retry to organisation fetches

**File to modify:**
- `UberEats-Image-Extractor/middleware/feature-flags.js`

**Changes:**
- Add import for retry utilities
- Update `checkFeatureFlag` (lines 105-122)
- Update `checkFeatureFlagOptional` (lines 170-178)
- Update `getFeatureFlags` (lines 209-224)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `planning/yolo-mode-plans/account-setup/phase-3/investigations/jwt-token-timeout-errors/IMPLEMENTATION_PLAN.md` | Complete implementation plan with exact code diffs |
| `UberEats-Image-Extractor/src/services/database-error-handler.js` | Existing retry pattern to extend |
| `UberEats-Image-Extractor/middleware/auth.js` | Main auth middleware (CRITICAL) |
| `UberEats-Image-Extractor/middleware/superAdmin.js` | Super admin middleware |
| `UberEats-Image-Extractor/middleware/feature-flags.js` | Feature flag middleware |

---

## Notes
- The implementation plan at `IMPLEMENTATION_PLAN.md` contains complete before/after code for each file
- The key insight is that `supabase.auth.getUser()` returns `{ data: { user }, error }` not `{ data, error }` - the code handles this
- Use 503 status with `retryable: true` for transient failures so frontend knows to retry
- Use 401 status for actual auth failures (invalid/expired tokens)
- The existing `executeWithRetry` uses exponential backoff: 1s, 2s, 4s (max 3 retries)
