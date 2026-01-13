# Session 5: Resume Sub-step Skipping & JWT Expiration Fixes

**Date:** 2026-01-03
**Focus:** Fixing resume functionality to skip completed sub-steps and resolving JWT expiration during long-running operations

---

## Issue 1: Resume Re-runs Completed Sub-steps

**Problem:** When clicking the Resume button, the system executed from the beginning of the next phase instead of only retrying failed sub-steps within the current phase.

**Test Case - "Buzz" Restaurant:**
- Job ID: `fb805482-f79e-4581-98fa-00002335e24c`
- Phase 1: completed
- Phase 2: in_progress (menuImport failed, but restaurantRegistration, websiteConfig, servicesConfig, paymentConfig, syncOnboardingUser all completed)
- Phase 3: pending
- Phase 4: pending

**Expected Behavior:** Resume should skip completed sub-steps and only retry `menuImport`.

**Actual Behavior:** Resume detected `lastCompletePhase` as 'phase1' and re-ran ALL Phase 2 sub-steps.

**Root Cause:** The phase resume functions (`executePhase2Resume`, `executePhase3Resume`, `executePhase4Resume`) did not check sub-step status before executing. They always ran all sub-steps regardless of completion state.

---

## Fix Applied: Sub-step Status Checks

### New Helper Function

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line 2486)

```javascript
/**
 * Helper to check if a sub-step should be skipped during resume
 */
function shouldSkipSubStepOnResume(phaseProgress, subStepKey) {
  const status = getSubStepStatus(phaseProgress, subStepKey);
  return status === 'completed' || status === 'skipped';
}
```

### Updated Phase Resume Functions

**executePhase1Resume()** (NEW - lines 2495-2591)
- Added for partial Phase 1 failures
- Checks status of: `cloudwaitressAccount`, `codeGeneration`, `createOnboardingUser`, `uploadImages`
- Updated default case in `resumeYoloModeForJob` to use this instead of `executeYoloModeForJob`

**executePhase2Resume()** (lines 2597-2692)
- Added status checks for all 6 sub-steps before execution
- Logs `[Resume] <subStep> already completed, skipping` when skipping
- Preserves context (e.g., `menuImportSucceeded`) when sub-step already completed

**executePhase3Resume()** (lines 2698-2712)
- Added status check for `optionSets` before execution

**executePhase4Resume()** (lines 2718-2732)
- Added status check for `itemTags` before execution

---

## Issue 2: JWT Expired During Long-Running Operations

**Problem:** After Phase 3 (optionSets) completed successfully, Phase 4 (itemTags) failed with "Token is invalid or expired". The `updateStepStatus` call also failed, preventing the Resume button from appearing.

**Server Logs:**
```
[Registration Batch Service] Sub-step itemTags failed: Token is invalid or expired
[Registration Batch Service] itemTags failed (attempt 3/3): itemTags failed: Token is invalid or expired
[updateStepStatus] Database operation failed: PGRST303: JWT expired
```

**Root Cause:** Two separate JWT expiration issues:
1. **Database operations** used `getSupabaseClient()` which returned `userSupabaseClient` (with user's JWT) when set
2. **API calls** used the user's JWT from `authContext.token` for Authorization header

Both tokens expired during the long optionSets operation (~10+ minutes).

---

## Fix Applied: Service-Level Authentication

### Fix 1: Database Operations - Service Client

**File:** `UberEats-Image-Extractor/src/services/database-service.js`

Added new function (lines 57-59):
```javascript
// Get the service-level Supabase client (bypasses RLS, never expires)
function getServiceSupabaseClient() {
  return supabase;
}
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

Updated import (line 14):
```javascript
const { getServiceSupabaseClient } = require('./database-service');
```

Replaced all `getSupabaseClient()` calls with `getServiceSupabaseClient()` throughout the file.

### Fix 2: API Calls - Service Key Authentication

**File:** `UberEats-Image-Extractor/middleware/auth.js`

Added service-to-service auth bypass (lines 18-45):
```javascript
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authMiddleware(req, res, next) {
  // Check for internal service-to-service call first
  const serviceKey = req.headers['x-service-key'];
  const orgIdHeader = req.headers['x-organisation-id'];

  if (serviceKey && serviceKey === INTERNAL_SERVICE_KEY && orgIdHeader) {
    // Internal service call - bypass JWT validation
    console.log('[Auth] Internal service call authenticated for org:', orgIdHeader);
    req.user = {
      id: 'internal-service',
      email: 'service@internal',
      role: 'super_admin',
      organisationId: orgIdHeader,
      organisation: { id: orgIdHeader },
      isServiceCall: true
    };
    req.orgFilter = () => ({ organisation_id: orgIdHeader });
    return next();
  }
  // ... rest of JWT validation
}
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

Updated API call headers (lines 2004-2017):
```javascript
// Build headers for internal service-to-service call
// Use service key instead of user JWT to avoid token expiration
const serviceKey = process.env.INTERNAL_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  'Content-Type': 'application/json',
  'X-Service-Key': serviceKey,
};

if (context.authContext?.organisationId) {
  headers['X-Organisation-ID'] = context.authContext.organisationId;
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/services/database-service.js` | Added `getServiceSupabaseClient()` function and export |
| `UberEats-Image-Extractor/src/services/registration-batch-service.js` | Added `shouldSkipSubStepOnResume()` helper, `executePhase1Resume()` function, updated all phase resume functions with status checks, switched to service client, switched to service key auth for API calls |
| `UberEats-Image-Extractor/middleware/auth.js` | Added `X-Service-Key` authentication bypass for internal service calls |

---

## Testing Results

**Test Case:** Resume "Buzz" restaurant after Phase 2 menuImport failure

**Before Fix:**
- Resume re-ran all Phase 2 sub-steps
- JWT expired during Phase 4, causing failure
- `updateStepStatus` failed, no Resume button appeared

**After Fix:**
- Resume skipped completed sub-steps (restaurantRegistration, websiteConfig, etc.)
- Only retried menuImport
- Service key auth prevented JWT expiration
- All phases completed successfully

---

## Expected Console Output on Resume

```
[Resume] restaurantRegistration already completed, skipping
[Resume] websiteConfig already completed, skipping
[Resume] servicesConfig already completed, skipping
[Resume] paymentConfig already completed, skipping
[Registration Batch Service] Using service key auth for org: 443129c4-...
[Registration Batch Service] Executing sub-step: menuImport...
[Resume] syncOnboardingUser already completed, skipping
[Auth] Internal service call authenticated for org: 443129c4-...
```

---

*Session completed: 2026-01-03*
