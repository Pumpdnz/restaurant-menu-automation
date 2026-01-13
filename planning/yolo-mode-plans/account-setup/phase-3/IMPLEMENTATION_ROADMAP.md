# Phase 3 Implementation Roadmap: Step 6 Error Handling & Resume Functionality

**Date:** 2024-12-29
**Updated:** 2024-12-30
**Status:** ALL PHASES COMPLETE - Ready for Testing
**Based on:** 4 parallel investigation tasks

---

## Implementation Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Phase A: Critical Database Error Handling | **COMPLETE** | 2024-12-30 |
| Phase B: Resume Functionality | **COMPLETE** | 2024-12-30 |
| Phase C: Frontend Sub-step Editing | **COMPLETE** | 2024-12-30 |
| Phase D: Context Variable Persistence | **COMPLETE** | 2024-12-30 |

### All Phases Complete
- **Phase A:** Database retry logic added to all critical functions
- **Phase B:** Resume functionality implemented with phase detection
- **Phase C:** Frontend sub-step editing with dependency validation
- **Phase D:** Context persistence at phase boundaries with stored context preference

---

## Executive Summary

This roadmap addresses systemic error handling issues in the batch registration Step 6 (YOLO Mode Execution). When the server loses connectivity mid-processing, jobs get stuck in unrecoverable states. The solution involves:

1. **Adding retry logic** to all database operations (matching usage-tracking-service pattern) - **DONE**
2. **Implementing resume functionality** to continue from last completed phase - **DONE**
3. **Adding frontend editing** for manual sub-step status management - **DONE**
4. **Persisting context variables** to enable full recovery - **PENDING**

---

## Current State: Critical Issues Identified

| Issue | Severity | Impact |
|-------|----------|--------|
| `updatePhaseProgress()` has NO error handling | CRITICAL | Silent data loss, sub_step_progress never persisted |
| `incrementBatchProgress()` silently fails | HIGH | Batch counters become incorrect |
| `updateStepStatus()` throws without retry | HIGH | Job state corruption on transient errors |
| `updateJobStatus()` throws without retry | HIGH | Job stuck in wrong status |
| No resume functionality | HIGH | Users can't recover from mid-execution failures |
| Context variables not persisted | MEDIUM | Resume loses codeGenerationFilePaths, menuImportSucceeded |
| No frontend sub-step editing | MEDIUM | Users can't manually mark steps complete |

---

## Implementation Phases

### Phase A: Critical Database Error Handling (P1) - COMPLETE
**Estimated Effort:** 2-3 hours
**Files Changed:** 2
**Status:** COMPLETE (2024-12-30)

**Files Created/Modified:**
- `src/services/database-error-handler.js` (NEW)
- `src/services/registration-batch-service.js` (lines 695-724, 734-765, 765-791, 2138-2156)

Fix the immediate risk of data loss and job corruption.

#### Task A1: Create Shared Database Error Handler
**File:** `src/services/database-error-handler.js` (NEW)

```javascript
/**
 * Shared database error handling utilities
 * Extracted from usage-tracking-service.js pattern
 */

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

/**
 * Check if an error is transient/retryable
 */
function isTransientError(error) {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  // Cloudflare 5xx errors (returned as HTML)
  if (errorStr.includes('520:') || errorStr.includes('502:') ||
      errorStr.includes('503:') || errorStr.includes('504:') ||
      errorStr.includes('cloudflare') || errorStr.includes('<!DOCTYPE html>')) {
    return true;
  }

  // Network/connection errors
  if (errorStr.includes('ECONNRESET') || errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED')) {
    return true;
  }

  // HTTP 5xx status codes
  if (error.status >= 500 || error.code >= 500) {
    return true;
  }

  return false;
}

/**
 * Format error message for logging (clean up verbose Cloudflare HTML)
 */
function formatErrorMessage(error) {
  if (!error) return 'Unknown error';

  const errorStr = typeof error === 'string' ? error :
    (error.message || JSON.stringify(error));

  // Cloudflare HTML error page - extract the key info
  if (errorStr.includes('<!DOCTYPE html>')) {
    const titleMatch = errorStr.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      return `Cloudflare: ${titleMatch[1].split('|')[1]?.trim() || titleMatch[1]}`;
    }
    return 'Cloudflare connection error (HTML response received)';
  }

  // Supabase/PostgreSQL errors
  if (error.code && error.message) {
    return `${error.code}: ${error.message}`;
  }

  // Truncate very long messages
  if (errorStr.length > 200) {
    return errorStr.substring(0, 200) + '...';
  }

  return errorStr;
}

/**
 * Execute a database operation with retry logic
 * @param {Function} operation - Async function returning { data, error }
 * @param {string} operationName - Name for logging
 * @param {number} retryCount - Current retry attempt (internal)
 * @returns {Promise<any>} The data from successful operation
 */
async function executeWithRetry(operation, operationName, retryCount = 0) {
  try {
    const { data, error } = await operation();

    if (error) {
      if (isTransientError(error) && retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount);
        console.warn(`[${operationName}] Transient error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}): ${formatErrorMessage(error)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry(operation, operationName, retryCount + 1);
      }

      console.error(`[${operationName}] Database operation failed:`, formatErrorMessage(error));
      throw error;
    }

    return data;
  } catch (error) {
    if (isTransientError(error) && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.warn(`[${operationName}] Transient error in catch, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}): ${formatErrorMessage(error)}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(operation, operationName, retryCount + 1);
    }

    console.error(`[${operationName}] Failed after ${retryCount} retries:`, formatErrorMessage(error));
    throw error;
  }
}

module.exports = {
  isTransientError,
  formatErrorMessage,
  executeWithRetry,
  MAX_RETRIES,
  BASE_DELAY
};
```

#### Task A2: Update updatePhaseProgress() with Error Handling
**File:** `src/services/registration-batch-service.js`
**Location:** Lines 2095-2109

**Before:**
```javascript
async function updatePhaseProgress(jobId, stepNumber, phaseName, status, phaseProgress) {
  phaseProgress.current_phase = phaseName;
  phaseProgress.phases[phaseName].status = status;

  const client = getSupabaseClient();
  await client  // NO ERROR HANDLING!
    .from('registration_job_steps')
    .update({...})
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);
}
```

**After:**
```javascript
async function updatePhaseProgress(jobId, stepNumber, phaseName, status, phaseProgress) {
  const { executeWithRetry } = require('./database-error-handler');

  phaseProgress.current_phase = phaseName;
  phaseProgress.phases[phaseName].status = status;

  const client = getSupabaseClient();

  await executeWithRetry(
    () => client
      .from('registration_job_steps')
      .update({
        sub_step_progress: phaseProgress,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', stepNumber),
    `updatePhaseProgress(${jobId}, phase ${phaseName})`
  );
}
```

#### Task A3: Update incrementBatchProgress() with Error Handling
**File:** `src/services/registration-batch-service.js`
**Location:** Lines 753-771

**After:**
```javascript
async function incrementBatchProgress(batchId, type) {
  const { executeWithRetry } = require('./database-error-handler');
  const client = getSupabaseClient();
  const column = type === 'completed' ? 'completed_restaurants' : 'failed_restaurants';

  // Read with retry
  const batch = await executeWithRetry(
    () => client
      .from('registration_batch_jobs')
      .select(column)
      .eq('id', batchId)
      .single(),
    `incrementBatchProgress.read(${batchId})`
  );

  // Update with retry
  await executeWithRetry(
    () => client
      .from('registration_batch_jobs')
      .update({
        [column]: (batch?.[column] || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId),
    `incrementBatchProgress.update(${batchId})`
  );
}
```

#### Task A4: Update updateStepStatus() with Retry Logic
**File:** `src/services/registration-batch-service.js`
**Location:** Lines 683-710

Add `executeWithRetry` wrapper around the database operation.

#### Task A5: Update updateJobStatus() with Retry Logic
**File:** `src/services/registration-batch-service.js`
**Location:** Lines 719-748

Add `executeWithRetry` wrapper around the database operation.

---

### Phase B: Resume Functionality (P2) - COMPLETE
**Estimated Effort:** 4-6 hours
**Files Changed:** 3
**Status:** COMPLETE (2024-12-30)

**Files Created/Modified:**
- `src/services/registration-batch-service.js` (lines 2194-2450) - Added `detectLastCompletePhase()`, `reconstructContext()`, `resumeYoloModeForJob()`, phase-specific resume functions
- `src/routes/registration-batch-routes.js` (lines 545-613) - Added `POST /jobs/:jobId/resume-step-6` endpoint
- `src/hooks/useRegistrationBatch.ts` (lines 448-475) - Added `useResumeStep6()` hook

Enable recovery from mid-execution failures.

#### Task B1: Add Phase Detection Helper
**File:** `src/services/registration-batch-service.js`

```javascript
/**
 * Detect the last fully completed phase from sub_step_progress
 * @param {object} phaseProgress - The sub_step_progress object
 * @returns {string|null} Last completed phase name or null
 */
function detectLastCompletePhase(phaseProgress) {
  if (!phaseProgress?.phases) return null;

  // Check phases in reverse order (phase4 → phase1)
  for (const phase of ['phase4', 'phase3', 'phase2', 'phase1']) {
    if (phaseProgress.phases[phase]?.status === 'completed') {
      return phase;
    }
  }
  return null;
}

/**
 * Reconstruct context from completed sub-steps
 * @param {object} phaseProgress - The sub_step_progress object
 * @returns {object} Reconstructed context
 */
function reconstructContext(phaseProgress) {
  const context = {
    codeGenerationFilePaths: null,
    onboardingUserCreated: false,
    menuImportSucceeded: false,
    authContext: null
  };

  const phase1 = phaseProgress?.phases?.phase1?.sub_steps || {};
  const phase2 = phaseProgress?.phases?.phase2?.sub_steps || {};

  // Check codeGeneration result
  if (phase1.codeGeneration?.status === 'completed') {
    context.codeGenerationFilePaths = phase1.codeGeneration?.filePaths || true;
  }

  // Check onboarding user creation
  if (phase1.createOnboardingUser?.status === 'completed') {
    context.onboardingUserCreated = true;
  }

  // Check menu import
  if (phase2.menuImport?.status === 'completed') {
    context.menuImportSucceeded = true;
  }

  return context;
}
```

#### Task B2: Implement resumeStep6ForJob()
**File:** `src/services/registration-batch-service.js`

```javascript
/**
 * Resume Step 6 execution from last completed phase
 * @param {object} job - Registration job with steps and execution_config
 * @param {string} batchId - Batch ID
 * @param {object} authContext - Auth context for API calls
 */
async function resumeYoloModeForJob(job, batchId, authContext = null) {
  const client = getSupabaseClient();

  // Get Step 6 record with existing progress
  const step6 = job.steps?.find(s => s.step_number === 6);
  const existingProgress = step6?.sub_step_progress;

  if (!existingProgress) {
    // No existing progress - start from scratch
    return executeYoloModeForJob(job, batchId, authContext);
  }

  const config = job.execution_config || {};
  const phaseProgress = existingProgress; // Use existing progress

  // Reconstruct context from completed steps
  const context = reconstructContext(phaseProgress);
  context.authContext = authContext;

  // Detect resume point
  const lastCompletePhase = detectLastCompletePhase(phaseProgress);

  console.log(`[Registration Batch Service] Resuming job ${job.id} from ${lastCompletePhase || 'beginning'}`);

  await updateStepStatus(job.id, 6, 'in_progress');
  await updateJobStatus(job.id, 'in_progress', null, 6);

  try {
    // Resume from appropriate phase
    switch (lastCompletePhase) {
      case 'phase1':
        await executePhase2(job, config, phaseProgress, context);
        await executePhase3(job, config, phaseProgress, context);
        await executePhase4(job, config, phaseProgress, context);
        break;
      case 'phase2':
        await executePhase3(job, config, phaseProgress, context);
        await executePhase4(job, config, phaseProgress, context);
        break;
      case 'phase3':
        await executePhase4(job, config, phaseProgress, context);
        break;
      case 'phase4':
        // Already complete - just mark as done
        break;
      default:
        // Start from beginning
        await executePhase1(job, config, phaseProgress, context);
        await executePhase2(job, config, phaseProgress, context);
        await executePhase3(job, config, phaseProgress, context);
        await executePhase4(job, config, phaseProgress, context);
    }

    // Mark complete
    await updateStepStatus(job.id, 6, 'completed', { sub_step_progress: phaseProgress });
    await updateJobStatus(job.id, 'completed');
    await incrementBatchProgress(batchId, 'completed');

  } catch (error) {
    // Handle failure with proper state reset
    console.error(`[Registration Batch Service] Resume failed for job ${job.id}:`, error);
    await updateStepStatus(job.id, 6, 'failed', {
      sub_step_progress: phaseProgress,
      error_message: error.message
    });
    await updateJobStatus(job.id, 'failed', error.message, 6);
    throw error;
  }
}
```

#### Task B3: Add Resume API Endpoint
**File:** `src/routes/registration-batch-routes.js`

```javascript
// POST /api/registration-batches/jobs/:jobId/resume-step-6
router.post('/jobs/:jobId/resume-step-6', async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.user?.organisation_id;
    const authContext = { token: req.headers.authorization, organisationId: orgId };

    // Validate job exists and is resumable
    const client = getSupabaseClient();
    const { data: job, error } = await client
      .from('registration_jobs')
      .select(`
        *,
        steps:registration_job_steps(*),
        restaurant:restaurants(*)
      `)
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (error || !job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const step6 = job.steps?.find(s => s.step_number === 6);
    if (!step6?.sub_step_progress) {
      return res.status(400).json({
        success: false,
        message: 'No Step 6 progress to resume from'
      });
    }

    // Execute resume in background
    setImmediate(async () => {
      try {
        await resumeYoloModeForJob(job, job.batch_job_id, authContext);
      } catch (err) {
        console.error(`[Resume] Failed for job ${jobId}:`, err);
      }
    });

    res.json({
      success: true,
      message: 'Resume initiated',
      resuming_from: detectLastCompletePhase(step6.sub_step_progress)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

#### Task B4: Add Frontend Resume Button
**File:** `src/hooks/useRegistrationBatch.ts`

```typescript
export function useResumeStep6() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post(`/registration-batches/jobs/${jobId}/resume-step-6`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Step 6 resume initiated');
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to resume');
    },
  });
}
```

---

### Phase C: Frontend Sub-step Editing (P3) - COMPLETE
**Estimated Effort:** 6-8 hours
**Files Changed:** 5
**Status:** COMPLETE (2024-12-30)

**Files Created/Modified:**
- `src/services/registration-batch-service.js` (lines 2452-2785) - Added `SUB_STEP_DEPENDENCIES`, `SUB_STEP_PHASES`, `updateSubStepStatus()`, `resetSubStep()`, `getSubStepValidation()` with dependency validation
- `src/routes/registration-batch-routes.js` (lines 615-717) - Added 3 API endpoints for sub-step editing
- `src/hooks/useRegistrationBatch.ts` (lines 477-576) - Added `useUpdateSubStepStatus()`, `useResetSubStep()`, `useSubStepValidation()` hooks
- `src/components/registration-batch/SubStepEditor.tsx` (NEW) - Dropdown menu component for editing sub-step status
- `src/pages/RegistrationBatchDetail.tsx` - Integrated SubStepEditor component into sub-step display

Allow users to manually mark sub-steps as complete/failed/skipped.

#### Task C1: Add Sub-step Update API Endpoints
**File:** `src/routes/registration-batch-routes.js`

- `PATCH /jobs/:jobId/steps/6/sub-steps/:subStepKey` - Update single sub-step
- `PATCH /jobs/:jobId/steps/6/sub-steps` - Bulk update
- `POST /jobs/:jobId/steps/6/sub-steps/:subStepKey/reset` - Reset to pending
- `GET /jobs/:jobId/steps/6/sub-steps/:subStepKey/validation` - Get dependency info

#### Task C2: Add Backend Validation Logic
**File:** `src/services/registration-batch-service.js`

```javascript
const SUB_STEP_DEPENDENCIES = {
  cloudwaitressAccount: [],
  codeGeneration: [],
  createOnboardingUser: [],
  uploadImages: [],
  restaurantRegistration: ['cloudwaitressAccount'],
  websiteConfig: ['codeGeneration', 'restaurantRegistration'],
  servicesConfig: ['restaurantRegistration'],
  paymentConfig: ['restaurantRegistration'],
  menuImport: ['restaurantRegistration'],
  syncOnboardingUser: ['createOnboardingUser', 'restaurantRegistration'],
  optionSets: ['menuImport'],
  itemTags: ['menuImport']
};

function validateSubStepTransition(phaseProgress, subStepKey, newStatus) {
  const warnings = [];
  const errors = [];

  if (newStatus === 'completed') {
    const deps = SUB_STEP_DEPENDENCIES[subStepKey] || [];
    for (const dep of deps) {
      const depStatus = getSubStepStatus(phaseProgress, dep);
      if (!['completed', 'skipped'].includes(depStatus)) {
        errors.push(`Cannot mark ${subStepKey} as completed: ${dep} is ${depStatus}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

#### Task C3: Add Frontend Editing UI
**File:** `src/components/registration-batch/SubStepEditor.tsx` (NEW)

Context menu component with:
- Mark as Completed
- Mark as Failed
- Mark as Skipped
- Reset to Pending
- Dependency visualization

#### Task C4: Integrate into RegistrationBatchDetail
**File:** `src/pages/RegistrationBatchDetail.tsx`

Add click handlers to sub-step badges to open editor.

---

### Phase D: Context Variable Persistence (P3) - COMPLETE
**Estimated Effort:** 1-2 hours
**Files Changed:** 1
**Status:** COMPLETE (2024-12-30)

**Files Modified:**
- `src/services/registration-batch-service.js` - Updated `updatePhaseProgress()` to store context, updated all phase completion calls to pass context, updated `reconstructContext()` to prefer stored context

Store context variables in sub_step_progress for full resume capability.

#### Pre-requisite: Code Injection Database Migration (COMPLETE)

A parallel implementation has migrated code injection storage from filesystem to database. This changes the context structure:

**Database Changes Applied:**
```sql
ALTER TABLE pumpd_restaurants ADD COLUMN head_injection TEXT NULL;
ALTER TABLE pumpd_restaurants ADD COLUMN body_injection TEXT NULL;
ALTER TABLE pumpd_restaurants ADD COLUMN code_injection_config JSONB NULL;
ALTER TABLE pumpd_restaurants ADD COLUMN code_injection_generated_at TIMESTAMP WITH TIME ZONE NULL;
```

**Context Variable Changes (Already Implemented):**
```javascript
// OLD context structure:
context = {
  codeGenerationFilePaths: { headInjection: "/path/...", bodyInjection: "/path/..." },
  onboardingUserCreated: false,
  menuImportSucceeded: false
}

// NEW context structure (already in registration-batch-service.js):
context = {
  codeInjectionId: null,              // NEW: UUID reference to pumpd_restaurants.id
  codeInjectionGeneratedAt: null,     // NEW: Generation timestamp
  codeGenerationFilePaths: null,      // LEGACY: kept for backward compatibility
  onboardingUserCreated: false,
  menuImportSucceeded: false
}
```

**reconstructContext() Already Updated (lines 2225-2248):**
- Checks for `codeInjectionId` first (database storage)
- Falls back to `codeGenerationFilePaths` (legacy file paths)
- Both sources work seamlessly for resume

#### Task D1: Persist Context in Phase Completion
**File:** `src/services/registration-batch-service.js`

Update `updatePhaseProgress()` signature to accept context and store it:

```javascript
async function updatePhaseProgress(jobId, stepNumber, phaseName, status, phaseProgress, context = null) {
  phaseProgress.current_phase = phaseName;
  phaseProgress.phases[phaseName].status = status;

  // Store context variables for resume capability
  if (context && status === 'completed') {
    phaseProgress.context = {
      // NEW: Database-persisted code injection (primary)
      codeInjectionId: context.codeInjectionId,
      codeInjectionGeneratedAt: context.codeInjectionGeneratedAt,
      // LEGACY: File paths (fallback during migration)
      codeGenerationFilePaths: context.codeGenerationFilePaths,
      // Other context variables
      onboardingUserCreated: context.onboardingUserCreated,
      menuImportSucceeded: context.menuImportSucceeded
    };
  }

  // ... rest of function (executeWithRetry already implemented)
}
```

#### Task D2: Update Phase Completion Calls
**File:** `src/services/registration-batch-service.js`

Pass context to `updatePhaseProgress()` at phase boundaries:

```javascript
// After Phase 1 completes:
await updatePhaseProgress(job.id, 6, 'phase1', 'completed', phaseProgress, context);

// After Phase 2 completes:
await updatePhaseProgress(job.id, 6, 'phase2', 'completed', phaseProgress, context);

// etc.
```

#### Task D3: Update reconstructContext() to Read from phaseProgress.context
**File:** `src/services/registration-batch-service.js`

Enhance `reconstructContext()` to prefer stored context over inference:

```javascript
function reconstructContext(phaseProgress) {
  // If context was explicitly stored, use it directly
  if (phaseProgress.context) {
    return {
      codeInjectionId: phaseProgress.context.codeInjectionId || null,
      codeInjectionGeneratedAt: phaseProgress.context.codeInjectionGeneratedAt || null,
      codeGenerationFilePaths: phaseProgress.context.codeGenerationFilePaths || null,
      onboardingUserCreated: phaseProgress.context.onboardingUserCreated || false,
      menuImportSucceeded: phaseProgress.context.menuImportSucceeded || false,
      authContext: null
    };
  }

  // Fallback: Infer context from sub-step statuses (existing logic)
  // ... existing inference code ...
}
```

#### Why This Matters for Resume

| Scenario | Without Phase D | With Phase D |
|----------|-----------------|--------------|
| Resume after Phase 1 | Must query DB for codeInjectionId | Reads directly from phaseProgress.context |
| Resume after Phase 2 | Must infer menuImportSucceeded | Reads directly from phaseProgress.context |
| Multiple resume attempts | Inference may fail if sub-step data incomplete | Stored context always available |

#### Backward Compatibility

- `reconstructContext()` first checks `phaseProgress.context` (new)
- Falls back to inference from sub-step statuses (existing behavior)
- Both `codeInjectionId` (new) and `codeGenerationFilePaths` (legacy) supported

---

## Implementation Order & Dependencies

```
Phase A (P1 - Critical)
├── A1: Create database-error-handler.js
├── A2: Fix updatePhaseProgress() ──────────┐
├── A3: Fix incrementBatchProgress() ───────┤ No dependencies
├── A4: Fix updateStepStatus() ─────────────┤
└── A5: Fix updateJobStatus() ──────────────┘

Phase B (P2 - Resume)
├── B1: Add phase detection helpers ────────┐
├── B2: Implement resumeYoloModeForJob() ───┤ Depends on Phase A
├── B3: Add resume API endpoint ────────────┤
└── B4: Add frontend resume button ─────────┘

Phase C (P3 - Frontend Editing)
├── C1: Add sub-step update endpoints ──────┐
├── C2: Add validation logic ───────────────┤ Can run parallel to B
├── C3: Create SubStepEditor component ─────┤
└── C4: Integrate into detail page ─────────┘

Phase D (P3 - Context Persistence)
└── D1: Persist context in phaseProgress ───── Depends on A2
```

---

## Testing Checklist

### Phase A Tests (Implementation Complete - Ready for Testing)
- [ ] Simulate Cloudflare 520 error during updatePhaseProgress()
- [ ] Verify retry with exponential backoff (1s, 2s, 4s)
- [ ] Confirm job state consistency after transient failure
- [ ] Test incrementBatchProgress() counter accuracy

### Phase B Tests (Implementation Complete - Ready for Testing)
- [ ] Resume from Phase 1 complete → starts at Phase 2
- [ ] Resume from Phase 2 complete → starts at Phase 3
- [ ] Resume with reconstructed context → websiteConfig uses codeGenerationFilePaths
- [ ] Resume endpoint returns correct resuming_from phase

### Phase C Tests (Implementation Complete - Ready for Testing)
- [ ] Mark sub-step as completed (with valid dependencies)
- [ ] Attempt to mark sub-step complete with failed dependency → error
- [ ] Reset sub-step to pending → cascades to dependents
- [ ] Context menu appears on failed/non-processing job badges

### Phase D Tests (Implementation Complete - Ready for Testing)
- [ ] Context persisted in phaseProgress.context after Phase 1 completion
- [ ] Context includes codeInjectionId (new) and codeGenerationFilePaths (legacy)
- [ ] Resume job reads context from phaseProgress.context first
- [ ] Falls back to sub-step inference if phaseProgress.context missing
- [ ] codeInjectionId available after resume → websiteConfig uses DB content
- [ ] menuImportSucceeded correctly restored → Phase 3/4 conditionals work

---

## Rollback Plan

If issues arise during implementation:

1. **Phase A rollback:** Remove `executeWithRetry` wrapper, revert to original functions
2. **Phase B rollback:** Remove resume endpoint, keep error handling improvements
3. **Phase C rollback:** Remove editing endpoints, keep read-only UI
4. **Phase D rollback:** Remove context persistence, use reconstructContext() fallback

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Jobs stuck in "processing" after connectivity loss | Common | Zero |
| Manual database fixes required | Frequent | Rare |
| User-recoverable failures | 0% | 95%+ |
| Silent data loss incidents | Unknown | Zero (logged) |

---

## Next Steps

1. ~~**Implement Phase A** - Critical database fixes~~ **DONE**
2. ~~**Implement Phase B** - Resume functionality~~ **DONE**
3. ~~**Implement Phase C** - Frontend sub-step editing~~ **DONE**
4. ~~**Code injection DB migration** - Pre-requisite for Phase D~~ **DONE** (parallel session)
5. ~~**Complete Phase D** - Persist context in phaseProgress at phase boundaries~~ **DONE**
   - ~~Task D1: Update `updatePhaseProgress()` to accept and store context~~
   - ~~Task D2: Pass context to phase completion calls~~
   - ~~Task D3: Update `reconstructContext()` to prefer stored context~~

## All Implementation Complete - Ready for Testing

6. **Test in staging** - Simulate connectivity failures, verify resume with stored context
7. **User acceptance testing** - Verify recovery flow with resume and editing capabilities
