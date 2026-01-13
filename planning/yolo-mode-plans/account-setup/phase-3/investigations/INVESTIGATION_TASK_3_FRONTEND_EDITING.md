# Investigation Task 3: Frontend Sub-step Editing Requirements

**Date:** 2024-12-29
**Status:** Investigation Complete
**Focus:** Manual sub-step editing capability for Step 6 YOLO Mode execution

---

## Executive Summary

Currently, the frontend provides **read-only visibility** into Step 6 sub-step progress through badges and progress indicators. There is **no capability to manually edit sub-step status** from the UI. This investigation identifies required API endpoints and UI changes.

---

## 1. Current UI for Displaying Step 6 Progress

### Location: RegistrationBatchDetail.tsx

**RestaurantRow Component** displays Step 6 progress in two places:

#### A. Inline Progress in Table (Lines 174-198)
- Mini progress bar with percentage completion
- Updates every 5 seconds (polling interval)
- Data source: `step6Data?.sub_step_progress`

#### B. Expanded Details Section (Lines 262-299)
- 12 sub-steps across 4 phases from `YOLO_MODE_SUB_STEPS` constant
- Status indicators:
  - Green checkmark = `completed`
  - Blue spinner = `in_progress`
  - Red alert icon = `failed`
  - Gray outline = `skipped`
  - Gray secondary = `pending`

### Data Flow
```
RegistrationBatchDetail.tsx
  ↓
useRegistrationBatch() hook (5s/10s polling)
  ↓
API GET /api/registration-batches/:id
  ↓
registration_job_steps.sub_step_progress (JSON)
  ↓
Helper: getSubStepStatus(subStepProgress, subStepKey)
  ↓
Rendered as Badge with status-based styling
```

---

## 2. Existing API Endpoints for Modifying sub_step_progress

### Current Modification Endpoints

**Found: PATCH /api/registration-batches/jobs/:jobId/restaurant**
- Updates restaurant data from Yolo Mode configuration tabs
- **Does NOT touch:** `sub_step_progress` field

### Missing: No endpoint for modifying sub_step_progress directly

After thorough search, there is **NO existing endpoint** to:
- Mark a sub-step as complete
- Mark a sub-step as failed
- Mark a sub-step as skipped
- Modify sub-step status from frontend

---

## 3. Sub-step Progress JSON Structure

### Structure in Database

**Table:** `registration_job_steps`
**Column:** `sub_step_progress` (type: `jsonb`)

```json
{
  "current_phase": "phase1",
  "phases": {
    "phase1": {
      "status": "in_progress",
      "sub_steps": {
        "cloudwaitressAccount": {
          "status": "completed",
          "timestamp": "2024-12-29T10:30:45Z"
        },
        "codeGeneration": { "status": "in_progress" },
        "createOnboardingUser": { "status": "pending" },
        "uploadImages": { "status": "skipped", "reason": "No menu" }
      }
    },
    "phase2": { "status": "pending", "sub_steps": {...} },
    "phase3": { "status": "pending", "sub_steps": {...} },
    "phase4": { "status": "pending", "sub_steps": {...} }
  }
}
```

### Possible Sub-step Statuses
- `pending` - Initial state, not yet started
- `in_progress` - Currently executing
- `completed` - Successfully finished
- `failed` - Execution failed
- `skipped` - Conditionally skipped
- `retrying` - Attempting retry

---

## 4. Proposed API Endpoints for Manual Sub-step Editing

### Endpoint 1: Update Single Sub-step Status

```
PATCH /api/registration-batches/jobs/:jobId/steps/6/sub-steps/:subStepKey
```

**Request Body:**
```json
{
  "status": "completed" | "failed" | "skipped" | "pending",
  "data": {
    "reason": "User manually marked as complete",
    "message": "User override"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sub-step status updated",
  "sub_step_progress": { /* updated structure */ },
  "validation_warnings": [
    "Marked as complete but prerequisite (menuImport) is pending"
  ]
}
```

### Endpoint 2: Bulk Update Sub-steps

```
PATCH /api/registration-batches/jobs/:jobId/steps/6/sub-steps
```

**Request Body:**
```json
{
  "updates": [
    { "subStepKey": "menuImport", "status": "completed" },
    { "subStepKey": "optionSets", "status": "pending" }
  ]
}
```

### Endpoint 3: Reset Sub-step

```
POST /api/registration-batches/jobs/:jobId/steps/6/sub-steps/:subStepKey/reset
```

### Endpoint 4: Get Sub-step Validation Context

```
GET /api/registration-batches/jobs/:jobId/steps/6/sub-steps/:subStepKey/validation
```

**Response:**
```json
{
  "subStepKey": "optionSets",
  "currentStatus": "pending",
  "dependencies": {
    "menuImport": {
      "status": "pending",
      "required": true,
      "errorMessage": "Cannot mark optionSets as complete because menuImport is pending"
    }
  },
  "canMarkAs": {
    "completed": false,
    "failed": false,
    "skipped": true,
    "pending": true
  }
}
```

---

## 5. Validation Requirements

### When marking as `completed`
- All prerequisites must already be `completed` or `skipped`
- Cannot mark `failed` sub-steps as `completed` (must reset first)
- Phase containing the sub-step must be `in_progress` or `pending`

### When marking as `skipped`
- No prerequisites validation needed
- Auto-skip dependent steps if they would become invalid

### When marking as `failed`
- Phase must be `in_progress`
- Dependent steps should be marked pending for retry

### When resetting to `pending`
- All dependent steps should cascade reset
- Phase status may need adjustment

---

## 6. UI Components Required

### Sub-step Context Menu
- Right-click on badge to access actions
- Mark as Completed (conditional on validation)
- Mark as Failed (with error message)
- Mark as Skipped (with reason)
- Reset to Pending

### Validation Warning Dialog
- Show when user tries invalid action
- List prerequisites with their status
- Allow force-override with explicit warning

### Dependency Visualization
- Tooltip on hover showing dependencies
- Visual indication of blocking dependencies

---

## 7. Frontend Hook Implementation

```typescript
export function useUpdateSubStepStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      subStepKey,
      status,
      data,
    }: {
      jobId: string;
      subStepKey: string;
      status: string;
      data?: Record<string, any>;
    }) => {
      const response = await api.patch(
        `/registration-batches/jobs/${jobId}/steps/6/sub-steps/${subStepKey}`,
        { status, data }
      );
      return response.data;
    },
    onSuccess: (response, { jobId }) => {
      toast.success('Sub-step status updated');
      queryClient.invalidateQueries({
        queryKey: ['registration-batch']
      });
    },
  });
}
```

---

## 8. Summary of Files That Need Changes

### Backend (~350 LOC)
- `registration-batch-service.js` - Add 4 functions
- `registration-batch-routes.js` - Add 4 endpoints

### Frontend (~750 LOC)
- `useRegistrationBatch.ts` - Add 4 hooks
- `RegistrationBatchDetail.tsx` - Integrate hooks
- New: `SubStepEditor.tsx` - Context menu component
- New: `SubStepValidationDialog.tsx` - Validation UI
