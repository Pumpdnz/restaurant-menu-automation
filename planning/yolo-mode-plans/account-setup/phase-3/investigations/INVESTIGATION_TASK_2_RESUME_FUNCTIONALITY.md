# Investigation Task 2: Resume Functionality Requirements Analysis

**Date:** 2024-12-29
**Status:** Investigation Complete
**Focus:** Requirements for implementing Step 6 resume capability

---

## Executive Summary

Currently, if Step 6 fails mid-execution, users cannot resume from where they left off. The system moves the job back to Step 5 (which is already completed), blocking re-triggering of Step 6. The `execution_config` contains 100% of data needed to resume, but no resume mechanism exists.

---

## 1. Current Job State Machine

### Step Transitions
| Step | Name | Flow |
|------|------|------|
| 1 | Menu & Branding Extraction | pending → in_progress → completed/failed |
| 2 | Contact Details Search | pending → in_progress → action_required/completed/failed |
| 3 | Company Selection | action_required → completed/failed (user action) |
| 4 | Company Details Extraction | pending → in_progress → completed/failed |
| 5 | Yolo Mode Configuration | action_required → completed/failed (user action) |
| 6 | Pumpd Account Setup | pending → in_progress → completed/failed/action_required |

### Current Failure Handling (Lines 1744-1770)
When Step 6 fails:
1. Error handler resets Step 6 to 'pending' (line 1751)
2. Error handler resets Step 5 to 'action_required' (line 1757)
3. Job status set to 'action_required' with current_step = 5 (line 1767)
4. **Problem:** User sees Step 5 UI again, even though it was already completed

---

## 2. Database State Available for Resume

### What's Stored in `execution_config`
```javascript
{
  account: {
    registerNewUser: boolean,
    email: string,
    password: string
  },
  menu: {
    selectedMenuId: string,
    uploadImages: boolean,
    addOptionSets: boolean,
    addItemTags: boolean
  },
  onboarding: {
    createOnboardingUser: boolean,
    syncOnboardingRecord: boolean
  },
  steps_enabled: {
    cloudwaitressAccount: boolean,
    codeGeneration: boolean,
    // ... all 12 sub-steps
  }
}
```

**Resume Capability:** YES - execution_config contains 100% of data needed to resume.

### What's Stored in `sub_step_progress`
```javascript
{
  current_phase: "phase2",
  phases: {
    phase1: { status: "completed", sub_steps: {...} },
    phase2: { status: "in_progress", sub_steps: {...} },
    phase3: { status: "pending", sub_steps: {...} },
    phase4: { status: "pending", sub_steps: {...} }
  }
}
```

---

## 3. Blocking Dependencies in Step 6

### Dependency Graph

| Sub-step | Depends On | Blocking? | Phase |
|----------|-----------|-----------|-------|
| cloudwaitressAccount | - | YES | 1 |
| codeGeneration | - | NO | 1 |
| createOnboardingUser | - | NO | 1 |
| uploadImages | menu.selectedMenuId + config.uploadImages | NO | 1 |
| restaurantRegistration | Phase 1 complete | YES | 2 |
| websiteConfig | codeGeneration.success | NO | 2 |
| servicesConfig | restaurantRegistration | NO | 2 |
| paymentConfig | restaurantRegistration | NO | 2 |
| menuImport | menu.selectedMenuId | NO | 2 |
| syncOnboardingUser | createOnboardingUser.success + config | NO | 2 |
| optionSets | menuImport.success + config.addOptionSets | YES | 3 |
| itemTags | menuImport.success + config.addItemTags | YES | 4 |

---

## 4. What's Missing for Resume

### Context Variables NOT Persisted
```javascript
const context = {
  codeGenerationFilePaths: null,    // Lost on restart
  onboardingUserCreated: false,     // Lost on restart
  menuImportSucceeded: false,       // Lost on restart
  authContext
};
```

These are populated during Phase 1 and used in Phase 2+. If job restarts, context is empty.

### Missing Components
1. No checkpoint function to save intermediate state between phases
2. No "resume" endpoint - only retry from failed step exists
3. No logic to detect where to resume from

---

## 5. Proposed resumeStep6() Logic

```javascript
async function resumeStep6ForSelectedJobs(batchId, orgId, selectedJobIds, authContext) {
  // 1. Fetch jobs with their execution_config and current step 6 progress
  const jobs = await getRegistrationBatchJob(batchId, orgId);
  const resumeJobs = jobs.registration_jobs.filter(job =>
    selectedJobIds.includes(job.id) &&
    job.steps[5].sub_step_progress // Has partial progress
  );

  // 2. For each job, resume from last completed phase
  await Promise.allSettled(
    resumeJobs.map(job => resumeYoloModeForJob(job, batchId, authContext))
  );

  // 3. Update batch status
  const finalStatus = await calculateBatchFinalStatus(batchId);
  await updateBatchStatus(batchId, finalStatus, { completed_at: now });
}

async function resumeYoloModeForJob(job, batchId, authContext) {
  const config = job.execution_config || {};
  const phaseProgress = job.steps[5].sub_step_progress; // Load existing progress

  // Reconstruct context from completed sub-steps
  const context = reconstructContext(phaseProgress);

  // Determine where to resume from
  const lastCompletePhase = detectLastCompletePhase(phaseProgress);

  switch(lastCompletePhase) {
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
    default:
      // Start from Phase 1
      await executeAllPhases(job, config, phaseProgress, context);
  }

  await updateStepStatus(job.id, 6, 'completed', { sub_step_progress: phaseProgress });
  await updateJobStatus(job.id, 'completed');
}

function detectLastCompletePhase(phaseProgress) {
  for (const phase of ['phase4', 'phase3', 'phase2', 'phase1']) {
    if (phaseProgress.phases[phase].status === 'completed') {
      return phase;
    }
  }
  return null;
}
```

---

## 6. Database Schema Changes Needed

**No new tables needed.** Existing schema supports:
- `sub_step_progress` already stores complete phase/sub-step hierarchy
- `execution_config` already stores all configuration
- `error_message` and `last_failure` already track error state

**Required Additions:**
- Add `last_completed_phase: string` to sub_step_progress for quick detection
- Consider storing context variables in execution_config for resume capability
- Add `resumable: boolean` flag to prevent re-triggering failed attempts

---

## 7. UI/API Flow for Resume

### Current Flow (Broken)
```
Step 6 fails → Step 5 moves to action_required → User sees Step 5 UI
→ User submits Step 5 again (but it's already done) → Step 6 restarts from phase1
```

### Proposed Fix
```
Step 6 fails → Job status = action_required, current_step = 6
→ Show Step 6 UI with partial progress visible
→ Show "Resume Step 6" button that calls resumeStep6ForSelectedJobs()
→ Resume from last completed phase
```

---

## 8. Implementation Checklist

### Phase A: Enable Resume from Last Completed Phase
- [ ] Extract phase completion detection logic
- [ ] Build phase-specific execution functions
- [ ] Implement resumeYoloModeForJob() with phase detection
- [ ] Handle context reconstruction from execution_config

### Phase B: API Endpoint
- [ ] POST `/registration-batches/jobs/:jobId/resume-step-6` endpoint
- [ ] Return in-progress status immediately, process in background

### Phase C: Database & State
- [ ] Ensure last_failure stores which phase failed
- [ ] Add detectLastCompletePhase() helper
- [ ] Validate sub_step_progress structure on retrieval

### Phase D: UI Updates
- [ ] Show "Resume Step 6" button when Step 6 has partial progress
- [ ] Disable Step 5 form editing if Step 5 is marked completed
- [ ] Display current phase being resumed from
