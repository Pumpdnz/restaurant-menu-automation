# Prime Prompt: Session 4 - Resume Logic Fix

## Project Context

Continuing work on **Step 6 Error Handling & Resume Functionality** for the Pumpd restaurant batch registration system.

## Previous Session Summary (Session 3)

### Issues Fixed:
1. **Code Injection UPSERT** - Changed SELECT+UPDATE to UPSERT so `pumpd_restaurants` records are created during Phase 1 code generation
2. **Menu Import Silent Failure** - Added `process.exit(1)` on script failure + endpoint failure detection
3. **Resume Button Missing** - Added `useResumeStep6` hook and Resume button to `RegistrationBatchDetail.tsx`
4. **sub_step_progress Cleared on Failure** - Fixed error handling to preserve `sub_step_progress` on Step 6 instead of moving it to Step 5's `error_details`

### Files Modified:
- `UberEats-Image-Extractor/src/routes/registration-routes.js` - Code injection UPSERT, menu import failure detection
- `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx` - Resume button UI
- `UberEats-Image-Extractor/src/hooks/useRegistrationBatch.ts` - Added 'action_required' to status type
- `UberEats-Image-Extractor/src/services/registration-batch-service.js` - Preserve sub_step_progress on failure
- `scripts/restaurant-registration/import-csv-menu.js` - Added process.exit(1) on failure

---

## Current Issue: Resume Starts from Phase 2 Instead of Retrying Failed Sub-steps

### Problem
When clicking the Resume button, the system executes from the **beginning of Phase 2** instead of only retrying the **failed sub-steps** within the current phase.

### Expected Behavior
Resume should:
1. Detect which phase failed (e.g., Phase 3)
2. Detect which sub-steps within that phase failed (e.g., `optionSets`)
3. Only retry the failed sub-steps, not re-run completed ones

### Actual Behavior
Resume detects `lastCompletePhase` (e.g., 'phase2') and starts executing from the **next phase**, but it re-runs ALL sub-steps in that phase instead of just the failed ones.

### Key Code to Investigate

**`registration-batch-service.js`:**
- `detectLastCompletePhase()` - Detects which phase was last completed (lines ~2316-2323)
- `reconstructContext()` - Rebuilds context from phase progress (lines ~2338-2390)
- `resumeYoloModeForJob()` - Main resume entry point (lines ~2392-2486)
- `executePhase3Resume()` - Phase 3 resume execution (lines ~2565-2575)

**Current Phase 3 Resume Logic (lines 2565-2575):**
```javascript
async function executePhase3Resume(job, config, phaseProgress, context, menu) {
  await updatePhaseProgress(job.id, 6, 'phase3', 'in_progress', phaseProgress);

  if (menu.addOptionSets && context.menuImportSucceeded) {
    await executeSubStep('optionSets', job, config, phaseProgress, context);  // <-- Always runs!
  } else {
    const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Option sets disabled';
    updateSubStepInProgress(phaseProgress, 'optionSets', 'skipped', { reason });
  }

  await updatePhaseProgress(job.id, 6, 'phase3', 'completed', phaseProgress, context);
}
```

**Problem:** This always calls `executeSubStep('optionSets', ...)` without checking if optionSets was already completed.

### Required Fix

The resume logic should check the existing sub-step status before re-executing:

```javascript
async function executePhase3Resume(job, config, phaseProgress, context, menu) {
  await updatePhaseProgress(job.id, 6, 'phase3', 'in_progress', phaseProgress);

  // Only retry if not already completed
  const optionSetsStatus = phaseProgress.phases?.phase3?.sub_steps?.optionSets?.status;

  if (menu.addOptionSets && context.menuImportSucceeded && optionSetsStatus !== 'completed') {
    await executeSubStep('optionSets', job, config, phaseProgress, context);
  } else if (optionSetsStatus === 'completed') {
    console.log('[Resume] optionSets already completed, skipping');
  } else {
    const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Option sets disabled';
    updateSubStepInProgress(phaseProgress, 'optionSets', 'skipped', { reason });
  }

  await updatePhaseProgress(job.id, 6, 'phase3', 'completed', phaseProgress, context);
}
```

### Same Pattern Needed For:
- `executePhase2Resume()` - All 6 sub-steps need status checks
- `executePhase4Resume()` - `itemTags` needs status check

---

## Test Case: "Buzz" Restaurant

**Job ID:** `fb805482-f79e-4581-98fa-00002335e24c`
**Restaurant:** Buzz
**Status:** action_required at Step 6

**Failed State:**
- Phase 1: completed
- Phase 2: completed (menuImport, paymentConfig, websiteConfig all completed - some with retries)
- Phase 3: in_progress with `optionSets` failed after 3 attempts
- Phase 4: pending

**Expected Resume Behavior:**
1. Skip Phase 1 (completed)
2. Skip Phase 2 (completed)
3. Resume Phase 3 - retry `optionSets` only
4. Continue to Phase 4 if Phase 3 succeeds

---

## Documentation

- Session 3 Summary: `planning/yolo-mode-plans/account-setup/phase-3/post-implementation-session-summaries/SESSION_3_CODE_INJECTION_UPSERT_FIX.md`
- Investigation Summary: `planning/yolo-mode-plans/account-setup/phase-3/investigations/post-implementation-issues/menu-import-silent-failure/INVESTIGATION_SUMMARY.md`
- Implementation Roadmap: `planning/yolo-mode-plans/account-setup/phase-3/IMPLEMENTATION_ROADMAP.md`

---

## Next Steps

1. Update `executePhase2Resume()` to check sub-step status before re-executing
2. Update `executePhase3Resume()` to check sub-step status before re-executing
3. Update `executePhase4Resume()` to check sub-step status before re-executing
4. Test resume from different failure points to verify behavior
5. Update session summary documentation

---

*Created: 2026-01-03*
