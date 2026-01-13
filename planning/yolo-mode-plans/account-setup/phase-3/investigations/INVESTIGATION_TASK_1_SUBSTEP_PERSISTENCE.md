# Investigation Task 1: Sub-Step Progress Persistence Analysis

**Date:** 2024-12-29
**Status:** Investigation Complete
**Severity:** HIGH - Critical data persistence gaps identified

---

## Executive Summary

The `updateSubStepInProgress()` function maintains **in-memory progress tracking only**. Database writes occur at **phase transitions** via `updatePhaseProgress()`, not at individual sub-step level changes. This creates a **critical data persistence gap**: if the server crashes mid-phase, all sub-step status updates since the last phase boundary write are lost.

---

## 1. Function Architecture

### `updateSubStepInProgress()` - IN-MEMORY ONLY
**Location:** Lines 2114-2126

```javascript
function updateSubStepInProgress(phaseProgress, subStepName, status, data = {}) {
  // Find which phase contains this sub-step
  for (const [phaseName, phase] of Object.entries(phaseProgress.phases)) {
    if (phase.sub_steps && phase.sub_steps[subStepName]) {
      phase.sub_steps[subStepName] = {
        ...phase.sub_steps[subStepName],
        status,
        ...data
      };
      break;
    }
  }
}
```

**Key Characteristics:**
- Pure in-memory operation (synchronous, no async/await)
- Modifies the local `phaseProgress` object reference
- **NO direct database interaction**
- Returns nothing

### `updatePhaseProgress()` - DATABASE WRITE
**Location:** Lines 2095-2109

```javascript
async function updatePhaseProgress(jobId, stepNumber, phaseName, status, phaseProgress) {
  phaseProgress.current_phase = phaseName;
  phaseProgress.phases[phaseName].status = status;

  // Update in database
  const client = getSupabaseClient();
  await client
    .from('registration_job_steps')
    .update({
      sub_step_progress: phaseProgress,
      updated_at: new Date().toISOString()
    })
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);
}
```

**Key Characteristics:**
- Async function (awaits database write)
- Persists the **entire** `phaseProgress` object to database
- Updates phase status and current_phase marker
- **Called at phase boundaries only**

---

## 2. Database Write Point Summary

**Total Database Writes per Step 6 Execution: 9 writes minimum**

| Point | Location | Trigger |
|-------|----------|---------|
| 1 | Line 1578 | Phase 1 marked as in_progress |
| 2 | Line 1641 | Phase 1 completed with all sub-step updates |
| 3 | Line 1644 | Phase 2 marked as in_progress |
| 4 | Line 1708 | Phase 2 completed with all sub-step updates |
| 5 | Line 1711 | Phase 3 marked as in_progress |
| 6 | Line 1720 | Phase 3 completed |
| 7 | Line 1723 | Phase 4 marked as in_progress |
| 8 | Line 1732 | Phase 4 completed |
| 9 | Line 1735/1751 | Final status (success/failure) |

---

## 3. Data Loss Scenario: Server Crash During Phase 2

### Timeline
```
T1: Phase 2 in_progress write [DB persisted]
T2: restaurantRegistration executes and completes
T3: websiteConfig starts (parallel)
T4: servicesConfig starts (parallel)
T5: paymentConfig starts (parallel)
T6: menuImport executes and completes → updateSubStepInProgress() [ONLY IN-MEMORY]
T7: syncOnboardingUser starts (parallel)
T8: SERVER CRASHES
T9: [Database write at line 1708 never happens]
```

### What Gets Lost
- `menuImport` completion status
- `websiteConfig` final status
- `servicesConfig` final status
- `paymentConfig` final status
- `syncOnboardingUser` final status
- All `attempts`, `completed_at`, `started_at` timestamps

### Database State After Restart
```javascript
// Persisted from line 1644
{
  current_phase: "phase2",
  phases: {
    phase2: {
      status: "in_progress",  // Still marked as in_progress!
      sub_steps: {
        restaurantRegistration: { status: "pending" },  // Never updated!
        websiteConfig: { status: "pending" },
        menuImport: { status: "pending" },  // Actually completed but not persisted!
        // ... all show pending
      }
    }
  }
}
```

---

## 4. Race Condition Analysis: Parallel Sub-Steps

### Phase 1 Parallel Execution (Lines 1580-1624)

**Actual Risk Level: LOW** because:
- JavaScript is single-threaded (no true parallelism at JS layer)
- Individual `updateSubStepInProgress()` calls are atomic operations on the object
- `Promise.allSettled()` waits for all promises to settle before returning
- The `phaseProgress` object is shared reference and mutations are ordered

**However, there IS a logical race condition:**
- If sub-step handlers read `phaseProgress` to check other sub-steps, they might see inconsistent state
- Example: `createOnboardingUser` handler might read `codeGeneration` status before it's updated

---

## 5. Critical Findings & Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| No Sub-Step Level Persistence | HIGH | Sub-step progress is ONLY in-memory, entire phase progress lost on crash mid-phase |
| Phase Transition Write Lag | HIGH | Phase marked "in_progress" BEFORE execution; crash leaves phase frozen |
| No Atomicity Guarantee | MEDIUM | Multiple sequential DB writes on failure can leave inconsistent state |
| No Sub-Step Retry Persistence | MEDIUM | Retry attempt count may not be persisted if phase hasn't transitioned |
| Missing Idempotency | MEDIUM | Re-executing sub-steps may create duplicate records |

---

## 6. Context Variable Dependencies

**Problem:** Phase 2 depends on Phase 1 results via `context` object

```javascript
const context = {
  codeGenerationFilePaths: null,  // NOT PERSISTED
  onboardingUserCreated: false,   // NOT PERSISTED
  menuImportSucceeded: false,     // NOT PERSISTED
  authContext
};
```

**Data Loss Scenario:**
- Phase 1 completes with write to database (line 1641)
- `context.codeGenerationFilePaths` is populated
- Phase 2 starts
- Server crashes and restarts
- `context` is a fresh empty object
- `websiteConfig` will be skipped even if it should run

---

## 7. Summary Table: When Data Is Lost

| Event | Status Persisted? | Data Lost |
|-------|-------------------|-----------|
| Sub-step completes | NO | Sub-step status, timestamps, attempts |
| Phase transitions | YES | Nothing (write happens) |
| Phase start | YES | In-progress marker only |
| Server crash mid-phase | PARTIAL | All sub-steps since last write |
| Retry in sub-step | NO | Previous error context if no phase transition |
| Context data (file paths) | NO | Code generation results, user creation status |

---

## 8. Recommendations

1. **Add per-sub-step database writes** - Persist after each sub-step completes
2. **Store context variables in execution_config** - Allow resume with context data
3. **Add idempotency keys** - Prevent duplicate operations on retry
4. **Implement checkpoint saves** - Write progress more frequently within phases
5. **Add transaction support** - Wrap multiple updates in single transaction
