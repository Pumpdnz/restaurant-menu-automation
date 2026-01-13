# Session 6: Manual Sub-step Status Editing - Implementation Plan

**Date:** 2026-01-03
**Status:** Planning Complete - Ready for Implementation
**Focus:** Phase status cascading, improved frontend editing controls, and enabling manual workflow recovery

---

## Executive Summary

This session implements the ability for users to manually configure sub-step statuses within Step 6 (YOLO Mode) registration jobs. While the basic infrastructure exists, critical phase status cascading logic is missing, and frontend controls need refinement.

**Primary Use Cases:**
1. Recover from error handling failures or data loss
2. Allow manual script execution on RestaurantDetail page, then resume batch registration
3. Mark sub-steps as complete when done through alternative means

---

## Current State Analysis

### What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| `SUB_STEP_DEPENDENCIES` map | Complete | registration-batch-service.js:2743-2756 |
| `SUB_STEP_PHASES` map | Complete | registration-batch-service.js:2761-2774 |
| `updateSubStepStatus()` function | Partial | registration-batch-service.js:2854-2917 |
| `resetSubStep()` function | Complete | registration-batch-service.js:2927-2999 |
| `getSubStepValidation()` function | Complete | registration-batch-service.js:3008-3065 |
| PATCH `/jobs/:id/steps/6/sub-steps/:key` | Complete | registration-batch-routes.js:626-662 |
| POST `/jobs/:id/steps/6/sub-steps/:key/reset` | Complete | registration-batch-routes.js:670-690 |
| GET `/jobs/:id/steps/6/sub-steps/:key/validation` | Complete | registration-batch-routes.js:696-717 |
| `useUpdateSubStepStatus` hook | Complete | useRegistrationBatch.ts:480-522 |
| `useResetSubStep` hook | Complete | useRegistrationBatch.ts:524-562 |
| `useSubStepValidation` hook | Complete | useRegistrationBatch.ts:564-576 |
| `SubStepEditor` component | Complete | SubStepEditor.tsx |

### What's Missing

| Issue | Impact | Priority |
|-------|--------|----------|
| Phase status cascading when sub-steps change | Phase statuses become inconsistent | P1 - Critical |
| Job/Step status updates on phase changes | Job may not show Resume button correctly | P1 - Critical |
| `current_phase` tracking on manual edits | Resume may start from wrong phase | P2 - High |
| Bulk sub-step editing UI | User must click each sub-step individually | P3 - Nice to have |
| Dependency validation warnings in UI | User not warned about cascade effects | P2 - High |

---

## sub_step_progress JSON Structure

```json
{
  "current_phase": "phase2",
  "context": {
    "codeInjectionId": "uuid",
    "menuImportSucceeded": true,
    "onboardingUserCreated": false
  },
  "phases": {
    "phase1": {
      "status": "completed",
      "description": "Initial parallel operations",
      "sub_steps": {
        "cloudwaitressAccount": { "status": "completed" },
        "codeGeneration": { "status": "completed", "codeInjectionId": "..." },
        "createOnboardingUser": { "status": "skipped", "reason": "..." },
        "uploadImages": { "status": "completed" }
      }
    },
    "phase2": {
      "status": "in_progress",
      "description": "Configuration (parallel after phase1)",
      "sub_steps": {
        "restaurantRegistration": { "status": "completed" },
        "websiteConfig": { "status": "completed" },
        "servicesConfig": { "status": "completed" },
        "paymentConfig": { "status": "completed" },
        "menuImport": { "status": "failed", "error": "...", "attempts": 3 },
        "syncOnboardingUser": { "status": "skipped" }
      }
    },
    "phase3": {
      "status": "pending",
      "description": "Menu setup (after menuImport)",
      "sub_steps": {
        "optionSets": { "status": "pending" }
      }
    },
    "phase4": {
      "status": "pending",
      "description": "Finalization (after menuImport)",
      "sub_steps": {
        "itemTags": { "status": "pending" }
      }
    }
  }
}
```

---

## Implementation Plan

### Task 1: Add Phase Status Cascading Logic (P1)

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

Add a new helper function to recalculate phase status based on sub-step statuses:

```javascript
/**
 * Recalculate phase status based on sub-step statuses
 * @param {object} phaseProgress - The sub_step_progress object
 * @param {string} phaseName - Phase name to recalculate
 * @returns {string} New phase status
 */
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

**Modify `updateSubStepStatus()` to cascade phase status:**

After updating the sub-step, recalculate and update the phase status:

```javascript
// After line 2896 in updateSubStepStatus():
// Recalculate phase status
const newPhaseStatus = calculatePhaseStatus(phaseProgress, phaseName);
if (phaseProgress.phases[phaseName].status !== newPhaseStatus) {
  phaseProgress.phases[phaseName].status = newPhaseStatus;
  console.log(`[updateSubStepStatus] Phase ${phaseName} status cascaded to: ${newPhaseStatus}`);
}

// Update current_phase if needed
updateCurrentPhase(phaseProgress);
```

---

### Task 2: Add current_phase Tracking (P2)

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

Add helper to determine correct `current_phase`:

```javascript
/**
 * Update current_phase based on phase statuses
 * Sets current_phase to the first non-completed phase
 * @param {object} phaseProgress - The sub_step_progress object
 */
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

### Task 3: Update Job/Step Status on Phase Changes (P1)

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

When a sub-step status changes, we may need to update the job and step statuses:

```javascript
// Add to updateSubStepStatus() after phase cascading:

// Determine if job/step status needs updating
const allPhasesCompleted = ['phase1', 'phase2', 'phase3', 'phase4']
  .every(p => phaseProgress.phases[p].status === 'completed');

const anyPhaseFailed = ['phase1', 'phase2', 'phase3', 'phase4']
  .some(p => phaseProgress.phases[p].status === 'failed');

// Get current step status
const currentStepStatus = step6.status;

// Update step 6 status if needed
let newStepStatus = currentStepStatus;
if (allPhasesCompleted && currentStepStatus !== 'completed') {
  newStepStatus = 'completed';
} else if (anyPhaseFailed && currentStepStatus !== 'failed') {
  newStepStatus = 'failed';
} else if (!allPhasesCompleted && !anyPhaseFailed && currentStepStatus === 'completed') {
  // User reopened a completed step by marking something as failed/pending
  newStepStatus = 'in_progress';
}

if (newStepStatus !== currentStepStatus) {
  await updateStepStatus(jobId, 6, newStepStatus, {
    sub_step_progress: phaseProgress
  });

  // Also update job status
  const newJobStatus = newStepStatus === 'completed' ? 'completed' :
                       newStepStatus === 'failed' ? 'action_required' : 'in_progress';
  await updateJobStatus(jobId, newJobStatus, null, 6);
}
```

---

### Task 4: Add Cascade Reset for Phase Status (P2)

**Modify `resetSubStep()`** to also reset phase status when sub-steps are reset:

```javascript
// After resetting sub-steps (line 2980), recalculate affected phase statuses:
const affectedPhases = new Set(resetSubSteps.map(key => SUB_STEP_PHASES[key]));
for (const phaseName of affectedPhases) {
  const newStatus = calculatePhaseStatus(phaseProgress, phaseName);
  phaseProgress.phases[phaseName].status = newStatus;
}

// Update current_phase
updateCurrentPhase(phaseProgress);
```

---

### Task 5: Enhance Validation Response (P2)

**Modify `getSubStepValidation()`** to include more context for UI:

```javascript
// Add to return object:
return {
  success: true,
  sub_step: subStepKey,
  current_status: currentStatus,
  phase: phaseName,
  phase_status: phaseProgress.phases[phaseName].status,
  dependencies: deps,
  dependents: getDependentSubSteps(subStepKey),
  dependency_statuses: deps.map(dep => ({
    key: dep,
    status: getSubStepStatus(phaseProgress, dep)
  })),
  allowed_transitions: getAllowedTransitions(currentStatus, deps, phaseProgress),
  cascade_warning: getDependentSubSteps(subStepKey).length > 0
    ? `Resetting will also reset: ${getDependentSubSteps(subStepKey).join(', ')}`
    : null
};
```

Add helper for allowed transitions:

```javascript
function getAllowedTransitions(currentStatus, deps, phaseProgress) {
  const transitions = [];

  // Can always mark as failed
  if (currentStatus !== 'failed') transitions.push('failed');

  // Can always mark as pending
  if (currentStatus !== 'pending') transitions.push('pending');

  // Can mark as completed only if all deps are completed/skipped
  const depsOk = deps.every(dep => {
    const status = getSubStepStatus(phaseProgress, dep);
    return status === 'completed' || status === 'skipped';
  });
  if (depsOk && currentStatus !== 'completed') transitions.push('completed');

  // Can mark as skipped if deps are ok
  if (depsOk && currentStatus !== 'skipped') transitions.push('skipped');

  return transitions;
}
```

---

### Task 6: Frontend - Show Dependency Warnings (P2)

**File:** `UberEats-Image-Extractor/src/components/registration-batch/SubStepEditor.tsx`

Enhance the dropdown to show:
1. Which dependencies are blocking "completed" status
2. Warning about cascade reset when resetting

```typescript
// Add validation query
const validation = useSubStepValidation(jobId, subStepKey);

// In DropdownMenuContent, add dependency info:
{validation.data?.dependency_statuses?.some(d => d.status !== 'completed' && d.status !== 'skipped') && (
  <div className="px-2 py-1 text-xs text-amber-600 bg-amber-50 rounded mb-2">
    Blocked by: {validation.data.dependency_statuses
      .filter(d => d.status !== 'completed' && d.status !== 'skipped')
      .map(d => d.key)
      .join(', ')}
  </div>
)}

// Disable "Mark as Completed" if dependencies not met
<DropdownMenuItem
  onClick={() => handleMarkAs('completed')}
  disabled={
    status === 'completed' ||
    isLoading ||
    !validation.data?.allowed_transitions?.includes('completed')
  }
  className="text-green-600"
>
```

---

### Task 7: Frontend - Improve Edit Enablement Logic (P3)

**File:** `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx`

Current logic (line 289-291):
```typescript
const step6Failed = step6Data?.status === 'failed' || !!step6Data?.error_message;
const jobNotProcessing = job.status !== 'in_progress';
const canEdit = hasSubStepProgress && (step6Failed || (jobNotProcessing && job.current_step === 6));
```

Improve to allow editing in more cases:
```typescript
const canEdit = hasSubStepProgress && (
  // Always allow when job is not actively processing
  job.status !== 'in_progress' ||
  // Allow when Step 6 failed or has errors
  step6Data?.status === 'failed' ||
  !!step6Data?.error_message ||
  // Allow when job is action_required
  job.status === 'action_required'
);
```

---

### Task 8: Add Phase Status Indicators to UI (P3)

**File:** `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx`

Group sub-steps by phase and show phase status:

```tsx
{/* Show phases with their statuses */}
{['phase1', 'phase2', 'phase3', 'phase4'].map((phaseName) => {
  const phase = subStepProgress?.phases?.[phaseName];
  if (!phase) return null;

  const phaseSubSteps = YOLO_MODE_SUB_STEPS.filter(
    s => SUB_STEP_PHASES[s.key] === phaseName
  );

  return (
    <div key={phaseName} className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium capitalize">
          {phaseName.replace('phase', 'Phase ')}
        </span>
        <Badge variant={getPhaseVariant(phase.status)}>
          {phase.status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 ml-4">
        {phaseSubSteps.map((subStep) => (
          <SubStepEditor ... />
        ))}
      </div>
    </div>
  );
})}
```

---

## Cascading Logic Summary

### When Sub-step Status Changes

| Sub-step Change | Phase Effect | Step 6 Effect | Job Effect |
|----------------|--------------|---------------|------------|
| Any → `failed` | Phase → `failed` | Step → `failed` | Job → `action_required` |
| Any → `completed` (all now complete) | Phase → `completed` | If all phases complete → `completed` | If step complete → `completed` |
| Any → `pending` | Phase → `in_progress` or `pending` | Step → `in_progress` | Job → `in_progress` |
| Any → `skipped` | Recalculate | Recalculate | Recalculate |

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

### Phase Status Cascading
- [ ] Mark Phase 2 sub-step as failed → Phase 2 becomes `failed`
- [ ] Mark all Phase 2 sub-steps as completed → Phase 2 becomes `completed`
- [ ] Reset a completed sub-step → Phase status recalculates
- [ ] Mark sub-step with failed dependencies as completed → Should fail with validation error

### Job/Step Status Updates
- [ ] All phases complete → Step 6 `completed`, Job `completed`
- [ ] Any phase failed → Step 6 `failed`, Job `action_required`
- [ ] Reopen completed step (mark sub-step failed) → Step 6 `failed`, Job `action_required`

### Resume Functionality
- [ ] After manual edits, Resume button appears
- [ ] Resume starts from correct phase based on `current_phase`
- [ ] Resume skips manually completed sub-steps

### Frontend
- [ ] Dependency warnings shown for blocked transitions
- [ ] Cascade reset warning shown
- [ ] Editing enabled for failed/action_required jobs
- [ ] Phase status badges displayed correctly

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/registration-batch-service.js` | Add `calculatePhaseStatus()`, `updateCurrentPhase()`, `getAllowedTransitions()`; modify `updateSubStepStatus()`, `resetSubStep()`, `getSubStepValidation()` |
| `src/routes/registration-batch-routes.js` | No changes needed (endpoints already exist) |
| `src/hooks/useRegistrationBatch.ts` | No changes needed (hooks already exist) |
| `src/components/registration-batch/SubStepEditor.tsx` | Add validation query usage, dependency warnings, disable invalid transitions |
| `src/pages/RegistrationBatchDetail.tsx` | Improve `canEdit` logic, optionally add phase grouping |

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: Phase status cascading | 1 hour |
| Task 2: current_phase tracking | 30 mins |
| Task 3: Job/Step status updates | 1 hour |
| Task 4: Cascade reset for phase | 30 mins |
| Task 5: Enhanced validation response | 30 mins |
| Task 6: Frontend dependency warnings | 1 hour |
| Task 7: Improved edit enablement | 15 mins |
| Task 8: Phase status indicators | 45 mins |
| **Total** | **~5.5 hours** |

---

## Implementation Order

1. **Task 1** - Phase status cascading (critical foundation)
2. **Task 2** - current_phase tracking (needed for resume)
3. **Task 3** - Job/Step status updates (needed for Resume button)
4. **Task 4** - Cascade reset for phase
5. **Task 5** - Enhanced validation response (needed for Task 6)
6. **Task 6** - Frontend dependency warnings
7. **Task 7** - Improved edit enablement
8. **Task 8** - Phase status indicators (optional polish)

---

*Plan created: 2026-01-03*
