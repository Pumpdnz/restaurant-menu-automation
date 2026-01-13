# Session 6: Manual Sub-step Status Editing - Phase Cascading

**Date:** 2026-01-06
**Focus:** Implementing phase status cascading when sub-steps are manually edited, enabling proper Resume functionality and status tracking

---

## Problem Statement

When a user manually changed a sub-step status via the SubStepEditor component, the **phase status was not updated**. This caused:
1. Phase showing wrong status (e.g., "in_progress" when all sub-steps completed)
2. Resume starting from wrong phase
3. Job/Step status not updating (Resume button wouldn't appear correctly)

---

## Changes Implemented

### Task 1: Added `calculatePhaseStatus()` Helper Function

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line ~2852)

```javascript
function calculatePhaseStatus(phaseProgress, phaseName) {
  const phase = phaseProgress.phases[phaseName];
  if (!phase?.sub_steps) return 'pending';

  const statuses = Object.values(phase.sub_steps).map(s => s.status);

  // If any sub-step is in_progress or retrying, phase is in_progress
  if (statuses.some(s => s === 'in_progress' || s === 'retrying')) {
    return 'in_progress';
  }

  // If all sub-steps are completed or skipped, phase is completed
  if (statuses.every(s => s === 'completed' || s === 'skipped')) {
    return 'completed';
  }

  // If any sub-step failed (and none in_progress), phase is failed
  if (statuses.some(s => s === 'failed')) {
    return 'failed';
  }

  // If all sub-steps are pending, phase is pending
  if (statuses.every(s => s === 'pending')) {
    return 'pending';
  }

  // Mixed state (some completed, some pending, none failed) = in_progress
  return 'in_progress';
}
```

---

### Task 2: Added `updateCurrentPhase()` Helper Function

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line ~2887)

```javascript
function updateCurrentPhase(phaseProgress) {
  const phaseOrder = ['phase1', 'phase2', 'phase3', 'phase4'];

  for (const phaseName of phaseOrder) {
    const status = phaseProgress.phases[phaseName]?.status;
    if (status !== 'completed' && status !== 'skipped') {
      phaseProgress.current_phase = phaseName;
      return;
    }
  }

  // All phases completed
  phaseProgress.current_phase = 'completed';
}
```

---

### Task 3: Added `getAllowedTransitions()` Helper Function

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line ~2909)

Returns an array of valid status transitions for a sub-step based on current status and dependency states.

---

### Task 4: Modified `updateSubStepStatus()` with Cascading Logic

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line ~2940)

Added after sub-step update:
1. **Phase status cascading** - Recalculates phase status using `calculatePhaseStatus()`
2. **current_phase update** - Updates `current_phase` using `updateCurrentPhase()`
3. **Job/Step status cascading** - Determines if job/step status needs updating:
   - All phases completed → Step 6 `completed`, Job `completed`
   - Any phase failed → Step 6 `failed`, Job `action_required`
   - Reopened completed step → Step 6 `in_progress`, Job `in_progress`

**New return fields:**
```javascript
{
  phase_status_changed: boolean,
  new_phase_status: string,
  step_status_changed: boolean,
  new_step_status: string
}
```

---

### Task 5: Modified `resetSubStep()` with Phase Recalculation

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line ~3063)

Added:
1. Track affected phases when resetting sub-steps
2. Recalculate each affected phase status
3. Update `current_phase`
4. Cascade to job status (`action_required` when resetting)

**New return fields:**
```javascript
{
  phase_changes: Array<{ phase, from, to }>,
  step_status_changed: boolean,
  new_step_status: string
}
```

---

### Task 6: Enhanced `getSubStepValidation()` Response

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line ~3196)

Added new response fields for frontend:
```javascript
{
  phase_status: string,           // Current phase status
  allowed_transitions: string[],  // Valid target statuses
  dependency_statuses: Array<{    // Dependency info for UI
    key: string,
    status: string,
    phase: string
  }>,
  cascade_warning: string | null, // Warning about dependent resets
  blocking_dependencies: Array    // Dependencies blocking completion
}
```

---

### Task 7: Updated `SubStepEditor.tsx` with Dependency Warnings

**File:** `UberEats-Image-Extractor/src/components/registration-batch/SubStepEditor.tsx`

Added:
1. Import and use `useSubStepValidation` hook
2. Show blocking dependencies warning (amber banner)
3. Disable "Mark as Completed" when dependencies not met
4. Show cascade warning before reset operations (orange banner)
5. Disable skipped option when dependencies not met

---

### Task 8: Improved `canEdit` Logic in `RegistrationBatchDetail.tsx`

**File:** `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx` (line ~288)

**Before:**
```javascript
const step6Failed = step6Data?.status === 'failed' || !!step6Data?.error_message;
const jobNotProcessing = job.status !== 'in_progress';
const canEdit = hasSubStepProgress && (step6Failed || (jobNotProcessing && job.current_step === 6));
```

**After:**
```javascript
const canEdit = hasSubStepProgress && (
  job.status !== 'in_progress' ||
  step6Data?.status === 'failed' ||
  !!step6Data?.error_message
);
```

This allows editing when:
1. Job is not actively processing (includes `action_required`, `failed`, `completed`, `pending`)
2. Step 6 specifically failed or has errors (even during processing)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/registration-batch-service.js` | Added `calculatePhaseStatus()`, `updateCurrentPhase()`, `getAllowedTransitions()`; modified `updateSubStepStatus()`, `resetSubStep()`, `getSubStepValidation()` with cascading logic |
| `src/components/registration-batch/SubStepEditor.tsx` | Added validation hook usage, dependency warnings, cascade warnings, disabled invalid transitions |
| `src/pages/RegistrationBatchDetail.tsx` | Simplified and improved `canEdit` logic |

---

## Cascading Logic Summary

### When Sub-step Status Changes

| Sub-step Change | Phase Effect | Step 6 Effect | Job Effect |
|----------------|--------------|---------------|------------|
| Any → `failed` | Phase → `failed` | Step → `failed` | Job → `action_required` |
| Any → `completed` (all now complete) | Phase → `completed` | If all phases complete → `completed` | If step complete → `completed` |
| Any → `pending` | Phase recalculates | Step → `in_progress` if was complete | Job → `in_progress` |
| Any → `skipped` | Phase recalculates | Recalculates | Recalculates |

### Phase Status Rules

| Sub-step State | Phase Status |
|----------------|--------------|
| Any `in_progress` or `retrying` | `in_progress` |
| All `completed` or `skipped` | `completed` |
| Any `failed` (no `in_progress`) | `failed` |
| All `pending` | `pending` |
| Mixed (some complete, some pending) | `in_progress` |

---

## Testing Checklist

- [ ] Mark Phase 2 sub-step as failed → Phase 2 becomes `failed`
- [ ] Mark all Phase 2 sub-steps as completed → Phase 2 becomes `completed`
- [ ] Reset a completed sub-step → Phase status recalculates
- [ ] Mark sub-step with failed dependencies as completed → Should fail with validation error
- [ ] All phases complete → Step 6 `completed`, Job `completed`
- [ ] Any phase failed → Step 6 `failed`, Job `action_required`
- [ ] Reopen completed step (mark sub-step failed) → Step 6 `failed`, Job `action_required`
- [ ] After manual edits, Resume button appears correctly
- [ ] Dependency warnings shown in SubStepEditor dropdown
- [ ] Cascade reset warning shown before reset operations

---

*Session completed: 2026-01-06*
