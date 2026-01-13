# Session 3: Code Injection & Menu Import Fixes

**Date:** 2026-01-03
**Focus:** Fixing code injection storage and menu import silent failures

---

## Issue Identified

**Problem:** Code injection content (head_injection, body_injection) was not being stored in the `pumpd_restaurants` table during Phase 1 code generation.

**Root Cause:** The code at lines 1548-1589 in `registration-routes.js` used a SELECT + UPDATE pattern that only updated existing records. If no `pumpd_restaurants` record existed (which is the case in Phase 1, before restaurant registration in Phase 2), the storage was silently skipped.

**Original Code (broken):**
```javascript
// Get or create pumpd_restaurant record
const { data: pumpdRestaurant, error: pumpdError } = await supabase
  .from('pumpd_restaurants')
  .select('id')
  .eq('restaurant_id', restaurantId)
  .eq('organisation_id', organisationId)
  .single();

if (pumpdRestaurant) {
  // UPDATE existing record
} else {
  console.log('[Code Generation] No pumpd_restaurant record found - skipping database storage');
}
```

---

## Fix Applied

**Solution:** Changed from SELECT + UPDATE to UPSERT pattern, matching the approach used by restaurant registration.

**File Modified:** `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 1548-1583)

**New Code:**
```javascript
// Store code injection content in database for production persistence
// Uses UPSERT to create record if it doesn't exist (Phase 1 runs before restaurant registration in Phase 2)
let codeInjectionId = null;
if (headContent && bodyContent) {
  try {
    const { data: pumpdRestaurant, error: upsertError } = await supabase
      .from('pumpd_restaurants')
      .upsert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        head_injection: headContent,
        body_injection: bodyContent,
        code_injection_config: {
          ...configContent,
          generatedBy: req.user?.id || null,
          generationMethod: 'manual',
          noGradient: noGradient || false
        },
        code_injection_generated_at: new Date().toISOString()
      }, {
        onConflict: 'organisation_id,restaurant_id'
      })
      .select('id')
      .single();

    if (upsertError) {
      console.error('[Code Generation] Failed to store in database:', upsertError);
    } else {
      codeInjectionId = pumpdRestaurant.id;
      console.log('[Code Generation] ✓ Stored in database:', codeInjectionId);
    }
  } catch (dbError) {
    console.error('[Code Generation] Database storage error:', dbError);
    // Don't fail - file-based approach still works
  }
}
```

---

## Why This Works

1. **Unique Constraint Exists:** `pumpd_restaurants_organisation_id_restaurant_id_key` on `(organisation_id, restaurant_id)`

2. **Compatible with Restaurant Registration:** The restaurant registration endpoint (lines 512-527) also uses UPSERT with `onConflict: 'organisation_id,restaurant_id'`, so:
   - Phase 1: Creates minimal record with code injection content
   - Phase 2: Updates the same record with registration details (pumpd_account_id, pumpd_subdomain, etc.)

3. **No Breaking Changes:** Both operations target the same unique constraint, so they cooperate safely.

---

## Verification

- Confirmed unique constraint exists via SQL query
- Confirmed restaurant registration uses same UPSERT pattern
- Code injection content now stored in database regardless of whether pumpd_restaurants record exists

---

## Files Modified

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Changed SELECT+UPDATE to UPSERT for code injection storage (lines 1548-1583) |

---

## Issue 2: Menu Import Silent Failure

**Problem:** Menu import was marked as "completed" with `menuImportSucceeded: true` even when the actual CSV upload to CloudWaitress failed. This caused Phase 3 (optionSets) to run on a non-existent menu.

**Root Cause:** The Playwright script printed "✅ CSV IMPORT PROCESS COMPLETED!" regardless of actual outcome, and the endpoint pattern-matched for "✅" to determine success.

---

## Fix 1: Script Exit Code (User Implemented)

**File:** `scripts/restaurant-registration/import-csv-menu.js`

```javascript
} catch (error) {
  console.error('  ❌ File upload failed:', error.message);
  await takeScreenshot(page, 'error-file-upload');

  // EXIT WITH ERROR CODE
  console.error('\n❌ CSV IMPORT FAILED - File upload error');
  console.error('Error details:', error.message);
  process.exit(1);
}
```

**Effect:** Script now exits with error code 1 on failure, causing `execAsync` to throw an error.

---

## Fix 2: Endpoint Failure Detection

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 1081-1094)

**Added explicit failure pattern check BEFORE success pattern check:**

```javascript
// Check for explicit failure indicators FIRST (before success patterns)
const failed = (stdout.includes('❌') && stdout.includes('FAILED')) ||
               stdout.includes('CSV IMPORT FAILED') ||
               stdout.includes('File upload failed') ||
               stderr.includes('FAILED');

if (failed) {
  console.error('[Direct Import] Script reported failure');
  return res.status(500).json({
    success: false,
    error: 'Menu import failed - file upload error',
    details: stdout.substring(stdout.lastIndexOf('❌'))
  });
}
```

**Effect:** Endpoint now catches failure patterns and returns HTTP 500, which axios treats as an error.

---

## Error Propagation Chain (Now Correct)

1. Script `process.exit(1)` → execAsync throws error
2. Endpoint catch block → returns HTTP 500 with `success: false`
3. axios.post receives 500 → throws error
4. executeSubStepInternal catches → retries (3x) or marks 'failed'
5. Promise.allSettled → `status: 'rejected'`
6. menuImportResult.status !== 'fulfilled' → `context.menuImportSucceeded` stays `false`
7. Phase 3 skips optionSets with reason "Menu import failed or skipped"

---

## Files Modified

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Code injection UPSERT (lines 1548-1583), Menu import failure detection (lines 1081-1094) |
| `scripts/restaurant-registration/import-csv-menu.js` | Added process.exit(1) on file upload failure (user implemented) |

---

## Issue 3: Missing Resume Button in Batch Registration UI

**Problem:** When Step 6 fails mid-execution, the job shows `action_required` status but there's no Resume button in the UI. Users could only see "Start Selected" which restarts from scratch instead of resuming from the last completed phase.

**Root Cause:** The `useResumeStep6` hook existed but was never imported or used in `RegistrationBatchDetail.tsx`.

---

## Fix: Add Resume Button to Batch Registration UI

**File:** `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx`

**Changes:**
1. Added `useResumeStep6` to imports from `useRegistrationBatch`
2. Added `resumeStep6Mutation = useResumeStep6()` hook
3. Added `onResumeStep6` prop to `RestaurantRow` component
4. Added Resume button (Play icon) that shows when:
   - `step6Data?.sub_step_progress` exists (has partial progress)
   - `job.status` is `'action_required'` or `'failed'`

**Button Logic:**
```tsx
{/* Resume button - shows when Step 6 has partial progress */}
{step6Data?.sub_step_progress && ['action_required', 'failed'].includes(job.status) && (
  <Button
    variant="ghost"
    size="sm"
    onClick={onResumeStep6}
    title="Resume from last completed phase"
  >
    <Play className="h-4 w-4" />
  </Button>
)}
```

**Behavior:**
- Resume button (▶️) appears when job has Step 6 progress and is in action_required/failed state
- Retry button (🔄) only appears when failed AND no Step 6 progress exists
- Clicking Resume calls `POST /api/registration-batches/jobs/:jobId/resume-step-6`
- Resumes from last completed phase (phase1 → phase2 → phase3 → phase4)

---

## Files Modified (Updated)

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Code injection UPSERT (lines 1548-1583), Menu import failure detection (lines 1081-1094) |
| `scripts/restaurant-registration/import-csv-menu.js` | Added process.exit(1) on file upload failure (user implemented) |
| `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx` | Added Resume button with useResumeStep6 hook |

---

## Issue 4: Step 6 sub_step_progress Cleared on Failure

**Problem:** When Step 6 failed, the error handling was clearing `sub_step_progress` from Step 6 and storing it in Step 5's `error_details` instead. This broke the Resume button detection since it checks Step 6's `sub_step_progress`.

**Root Cause:** Lines 1877-1894 in `registration-batch-service.js` were:
1. Resetting Step 6 to 'pending' with `sub_step_progress: null`
2. Storing the progress in Step 5's `error_details`
3. Moving job back to `current_step: 5`

**Original Code (buggy):**
```javascript
// Reset Step 6 to pending (will be re-run when user submits again)
await updateStepStatus(job.id, 6, 'pending', {
  error_message: null,
  sub_step_progress: null  // <-- BUG: Clears the progress!
});

// Set Step 5 back to action_required with the error message
await updateStepStatus(job.id, 5, 'action_required', {
  error_message: `Previous execution failed: ${error.message}`,
  error_details: {
    ...
    sub_step_progress: phaseProgress  // Progress moved here instead
  }
});
```

---

## Fix: Preserve sub_step_progress on Step 6

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (lines 1871-1889)

**New Code:**
```javascript
// Preserve sub_step_progress on Step 6 for resume functionality
await updateStepStatus(job.id, 6, 'failed', {
  error_message: error.message,
  sub_step_progress: phaseProgress,  // <-- Preserved!
  error_details: {
    timestamp: new Date().toISOString(),
    error: error.message
  }
});

// Set job status to action_required with current_step at 6 for resume
await updateJobStatus(job.id, 'action_required', `Step 6 failed: ${error.message}`, 6);
```

**Changes:**
- Step 6 now keeps `sub_step_progress` (not cleared)
- Step 6 status set to `'failed'` (not `'pending'`)
- Job stays at `current_step: 6` (not reset to 5)
- Resume button can now detect partial progress

---

## Files Modified (Final)

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Code injection UPSERT, Menu import failure detection |
| `scripts/restaurant-registration/import-csv-menu.js` | Added process.exit(1) on file upload failure |
| `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx` | Added Resume button with useResumeStep6 hook |
| `UberEats-Image-Extractor/src/hooks/useRegistrationBatch.ts` | Added 'action_required' to RegistrationJob.status type |
| `UberEats-Image-Extractor/src/services/registration-batch-service.js` | Preserve sub_step_progress on Step 6 failure |

---

*Session completed: 2026-01-03*
