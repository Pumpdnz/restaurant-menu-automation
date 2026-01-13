# Step 6 Error Handling & Resume Functionality Investigation Plan

**Date:** 2024-12-29
**Status:** Ready for Investigation
**Focus:** Graceful error handling when server loses connectivity during Step 6 YOLO Mode execution

---

## Investigation Plan Overview

This investigation addresses systemic issues with error handling in the batch registration Step 6 (YOLO Mode Execution). The main problem occurs when the server loses internet connectivity mid-processing, leaving jobs in an unrecoverable state without manual database intervention.

### Core Issues to Investigate

1. **Sub-step progress persistence timing** - Is `sub_step_progress` only saved after each phase completes, or after each sub-step?
2. **Resume functionality gap** - No way for users to resume Step 6 after connectivity loss
3. **Frontend editing capabilities** - Need ability to manually mark sub-steps as complete/incomplete
4. **Step 5 blocking behavior** - Jobs stuck when Step 5 is "completed" but Step 6 failed mid-execution

---

## Known Information

### Current System Behavior (From User Description)

When a user passes restaurants from Step 5 to Step 6:

1. `registration_jobs.current_step` is set to `6`
2. `registration_jobs.execution_config` JSON is populated
3. Step 5 `registration_job_steps.status` changes from `action_required` to `completed`
4. Step 5 `registration_job_steps.result_data` set to `{"config_applied": true}`
5. Step 6 `registration_job_steps.sub_step_progress` set to `null` initially
6. Step 6 `registration_job_steps.started_at` is set
7. Step 6 `registration_job_steps.status` remains `pending` until execution starts

### Key Code Locations (From Initial Investigation)

| Component | File | Function/Lines | Purpose |
|-----------|------|----------------|---------|
| Phase progress save | registration-batch-service.js | `updatePhaseProgress()` L2095-2109 | Saves `sub_step_progress` to database |
| Sub-step update | registration-batch-service.js | `updateSubStepInProgress()` L2114-2126 | Updates in-memory object ONLY |
| Step 5 completion | registration-batch-service.js | `completeStep5()` L1311-1454 | Transitions to Step 6 |
| Step 6 execution | registration-batch-service.js | `executeYoloModeForJob()` L1554+ | Runs phased parallel execution |
| Phase initialization | registration-batch-service.js | `initializePhaseProgress()` L2047-2088 | Creates initial progress structure |

### Critical Finding from Code Analysis

The `updateSubStepInProgress()` function (L2114-2126) **only modifies the in-memory `phaseProgress` object** - it does NOT save to the database!

Database saves only happen in `updatePhaseProgress()` which is called:
- At start of each phase: `'in_progress'`
- At end of each phase: `'completed'`

**This confirms the user's hypothesis**: Progress is only persisted after each PHASE completes, not after each sub-step. If a sub-step fails mid-phase, the database has no record of which sub-steps completed.

---

## Instructions for Next Claude Session

Execute this investigation plan by launching **4 parallel subagents** using the Task tool. Each subagent should:

1. **ONLY INVESTIGATE** - Do not modify any code
2. Create a markdown deliverable in `planning/yolo-mode-plans/account-setup/phase-3/investigations/`
3. Report findings back when complete

### Execution Steps

1. Use the Task tool with `subagent_type: "Explore"` to launch all 4 investigations in parallel
2. Wait for all subagents to complete using AgentOutputTool
3. Read all 4 investigation deliverables
4. Synthesize findings into a consolidated report for the user
5. Recommend implementation priorities

---

## subagent_1_instructions

### Task: Sub-step Progress Persistence Analysis

**Context:**
The `updateSubStepInProgress()` function only updates an in-memory object. We need to understand exactly when database writes occur and what data is lost if a failure happens mid-phase.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/services/registration-batch-service.js`
2. Trace all calls to `updateSubStepInProgress()` and `updatePhaseProgress()`
3. Document the execution flow for a single sub-step (e.g., `menuImport`)
4. Identify all database write points during Step 6 execution
5. Analyze what happens if the server crashes after sub-step A completes but before sub-step B starts
6. Determine if race conditions exist when multiple sub-steps run in parallel

**Deliverable:** `INVESTIGATION_TASK_1_SUBSTEP_PERSISTENCE.md`

**Report:** Summary of when progress is persisted and gaps in persistence that cause data loss

---

## subagent_2_instructions

### Task: Resume Functionality Requirements Analysis

**Context:**
Currently, if Step 6 fails mid-execution, users cannot resume from where they left off. Step 5 is marked "completed" which blocks re-triggering Step 6.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/services/registration-batch-service.js` focusing on:
   - `completeStep5()` function
   - `processStep6ForSelectedJobs()` function
   - `executeYoloModeForJob()` function
2. Document the current job state machine (step transitions)
3. Identify what database state changes would need to be made to enable resume
4. Analyze how `execution_config` is used and if it contains enough data to resume
5. Identify blocking dependencies between sub-steps (e.g., `restaurantRegistration` must complete before `websiteConfig`)
6. Propose the logic for a `resumeStep6()` function

**Deliverable:** `INVESTIGATION_TASK_2_RESUME_FUNCTIONALITY.md`

**Report:** Requirements and logic for implementing resume capability

---

## subagent_3_instructions

### Task: Frontend Sub-step Editing Requirements

**Context:**
To mitigate data loss risk, users need the ability to manually mark sub-steps as complete or incomplete from the frontend.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx`
2. Read `UberEats-Image-Extractor/src/hooks/useRegistrationBatch.ts`
3. Read `UberEats-Image-Extractor/src/routes/registration-batch-routes.js`
4. Document the current UI for displaying Step 6 progress
5. Identify what API endpoints exist for modifying `sub_step_progress`
6. Analyze the `sub_step_progress` JSON structure used by the frontend
7. Propose required API endpoints for manual sub-step editing
8. Consider validation requirements (e.g., can't mark dependent step complete if prerequisite failed)

**Deliverable:** `INVESTIGATION_TASK_3_FRONTEND_EDITING.md`

**Report:** Required API endpoints and UI changes for manual sub-step editing

---

## subagent_4_instructions

### Task: Error Handling & Retry Logic Improvement Analysis

**Context:**
We recently fixed similar issues in the usage tracking service by adding retry logic for transient Cloudflare/Supabase errors. The same pattern should be applied to Step 6 database operations.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/services/usage-tracking-service.js` - specifically the new `isTransientError()` and retry logic
2. Read `UberEats-Image-Extractor/src/services/registration-batch-service.js` focusing on:
   - `updatePhaseProgress()` function
   - `updateStepStatus()` function
   - `updateJobStatus()` function
3. Identify all database write operations in Step 6 that could fail due to connectivity
4. Analyze the current error handling in `executeSubStep()` function (retry logic exists but may not handle DB failures)
5. Propose how to apply the usage tracking retry pattern to registration batch operations
6. Consider whether failed DB writes should block the overall process or be queued for retry

**Deliverable:** `INVESTIGATION_TASK_4_ERROR_HANDLING.md`

**Report:** Recommended error handling improvements and retry patterns

---

## Expected Outcomes

After all 4 investigations complete, we should have:

1. **Clear understanding** of when/where progress data is lost
2. **Resume function specification** with exact database state requirements
3. **API endpoint specifications** for frontend editing capability
4. **Error handling patterns** to apply across all database operations

This will enable creating a focused implementation plan for Phase 3 improvements.
