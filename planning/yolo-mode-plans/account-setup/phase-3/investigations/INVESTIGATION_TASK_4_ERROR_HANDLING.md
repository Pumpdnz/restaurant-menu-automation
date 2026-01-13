# Investigation Task 4: Error Handling & Retry Logic Improvement Analysis

**Date:** 2024-12-29
**Status:** Investigation Complete
**Focus:** Apply usage tracking retry pattern to registration batch operations

---

## Executive Summary

The registration batch service has significant gaps in database error handling compared to the improved patterns recently added to the usage tracking service. Step 6 database operations lack retry logic for transient failures (Cloudflare/Supabase connectivity issues), which can leave jobs in inconsistent states.

---

## 1. Current Error Handling Comparison

### Usage Tracking Service (IMPROVED PATTERN)

**File:** `usage-tracking-service.js`

```javascript
// isTransientError() - Lines 122-147
- Identifies: Cloudflare 5xx, ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED
- Checks HTTP 5xx status codes
- Distinguishes transient from permanent errors

// formatErrorMessage() - Lines 154-180
- Extracts clean messages from Cloudflare HTML responses
- Truncates long messages to 200 characters

// trackEvent() with retry - Lines 191-251
- MAX_RETRIES = 3
- BASE_DELAY = 1000ms
- Exponential backoff: 1s, 2s, 4s
- Returns null on final failure (non-blocking)
```

### Registration Batch Service (CURRENT - NO RETRY)

```javascript
// updateStepStatus() - Lines 683-710
- Single attempt only
- Throws error immediately on failure
- No transient error detection

// updateJobStatus() - Lines 719-748
- Single attempt only
- No retry logic

// updatePhaseProgress() - Lines 2095-2109
- Single attempt only
- NO ERROR CHECKING (missing error handling)

// incrementBatchProgress() - Lines 753-771
- NO ERROR CHECKING on the update operation
- Silent failure point
```

---

## 2. Database Write Operations in Step 6

### All Write Points That Can Fail

| Function | Location | Risk Level | Error Handling |
|----------|----------|------------|----------------|
| `updateStepStatus()` | L683-710 | HIGH | Throws on failure |
| `updateJobStatus()` | L719-748 | HIGH | Throws on failure |
| `updatePhaseProgress()` | L2095-2109 | CRITICAL | **No error handling** |
| `incrementBatchProgress()` | L753-771 | MEDIUM | **No error checking** |

### Connectivity Failure Scenarios

**Scenario 1: Failure During updatePhaseProgress() (Line 1578)**
- Phase 1 starts but database write fails
- Sub-step progress is lost
- Job appears stuck without phase status

**Scenario 2: Failure During Phase Transition (Line 1641)**
- Phase 1 completes all sub-steps successfully
- Final phase completion write fails
- Phase 2 may not start (unclear state)

**Scenario 3: Failure During Completion (Line 1735-1740)**
- All sub-steps execute successfully
- Step 6 completion write fails
- Job appears to be still in_progress
- Batch counters incorrect

**Scenario 4: Failure During Error Handler (Line 1751-1767)**
- Error occurs, handler tries to update Step 5 & 6
- Update fails due to connectivity
- Job stuck in inconsistent state

---

## 3. Current executeSubStep() Error Handling

**Location:** Lines 1784-1836

```javascript
async function executeSubStep(subStepName, job, config, phaseProgress, context = {}) {
  const MAX_SUB_STEP_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_SUB_STEP_RETRIES; attempt++) {
    try {
      const result = await executeYoloModeSubStep(subStepName, job, config, context);
      updateSubStepInProgress(phaseProgress, subStepName, 'completed', {...});
      return result;
    } catch (error) {
      if (attempt < MAX_SUB_STEP_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
```

**PROBLEM:** The retry logic retries **API calls** (executeYoloModeSubStep), but does NOT retry **database writes** that happen in the error handler.

---

## 4. Critical Issues Found

### Issue 1: updatePhaseProgress() Has No Error Handling

```javascript
async function updatePhaseProgress(jobId, stepNumber, phaseName, status, phaseProgress) {
  const client = getSupabaseClient();
  await client  // NO ERROR HANDLING
    .from('registration_job_steps')
    .update({...})
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);
}
```

If the write fails silently, sub_step_progress is never persisted.

### Issue 2: incrementBatchProgress() Has No Error Checking

```javascript
async function incrementBatchProgress(batchId, type) {
  await client
    .from('registration_batch_jobs')
    .update({
      [column]: (batch?.[column] || 0) + 1
    })
    .eq('id', batchId);
    // Missing: if (error) throw error;
}
```

This is a silent failure point that can corrupt batch progress counters.

---

## 5. Transient Errors to Retry

### Should Be Retried
- **520:** Unknown Error (Cloudflare)
- **502:** Bad Gateway
- **503:** Service Unavailable
- **504:** Gateway Timeout
- **ECONNRESET:** Connection reset
- **ETIMEDOUT:** Connection timed out
- **ENOTFOUND:** DNS resolution failed
- **ECONNREFUSED:** Connection refused

### Should NOT Be Retried
- 4xx client errors
- Database constraint violations
- Invalid configuration errors

---

## 6. Proposed Implementation Strategy

### Option C: Hybrid (Recommended)

```
- Critical updates (job_status, step_status): Blocking with retries
- Progress updates (sub_step_progress): Queue for async persistence
- Batch counters: Eventual consistency with queue
```

### Shared Error Handling Utility

Create `/src/services/database-error-handler.js`:

```javascript
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

function isTransientError(error) {
  if (!error) return false;
  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  if (errorStr.includes('520:') || errorStr.includes('502:') ||
      errorStr.includes('503:') || errorStr.includes('504:') ||
      errorStr.includes('cloudflare') || errorStr.includes('<!DOCTYPE html>')) {
    return true;
  }
  if (errorStr.includes('ECONNRESET') || errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED')) {
    return true;
  }
  if (error.status >= 500 || error.code >= 500) {
    return true;
  }
  return false;
}

async function executeWithRetry(operation, operationName, retryCount = 0) {
  try {
    const { data, error } = await operation();

    if (error) {
      if (isTransientError(error) && retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount);
        console.warn(`[${operationName}] Transient error, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry(operation, operationName, retryCount + 1);
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (isTransientError(error) && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(operation, operationName, retryCount + 1);
    }
    throw error;
  }
}

module.exports = { isTransientError, executeWithRetry };
```

---

## 7. Priority Implementation Checklist

### Priority 1: Fix Critical Gaps (High Risk)
- [ ] Add retry logic to `updateJobStatus()`
- [ ] Add retry logic to `updateStepStatus()`
- [ ] Add error handling to `incrementBatchProgress()`
- [ ] Add error handling to `updatePhaseProgress()`

### Priority 2: Improve Observability
- [ ] Add transient error detection (import isTransientError)
- [ ] Add formatted error logging (formatErrorMessage pattern)
- [ ] Add retry attempt tracking for debugging

### Priority 3: Handle Failed DB Writes Gracefully
- [ ] Decide blocking vs queuing strategy
- [ ] Implement resume capability for failed jobs
- [ ] Add exponential backoff (1s, 2s, 4s)

---

## 8. Code Locations for Refactoring

| Function | Lines | Issue | Priority |
|----------|-------|-------|----------|
| `updateStepStatus()` | 683-710 | No retry logic | P1 |
| `updateJobStatus()` | 719-748 | No retry logic | P1 |
| `updatePhaseProgress()` | 2095-2109 | No error handling | P1 |
| `incrementBatchProgress()` | 753-771 | No error checking | P1 |
| `executeYoloModeForJob()` | 1554-1771 | Throws on DB failures | P2 |
| `executeSubStep()` | 1784-1836 | Retries API not DB | P2 |

---

## 9. Risk Analysis

### Without Changes (Current State)
- **Risk Level:** HIGH
- **Impact:** Job corruption on transient database failures
- **Recovery:** Manual database intervention required

### With Priority 1 Changes
- **Risk Level:** MEDIUM
- **Impact:** Jobs recover automatically from transient failures
- **Recovery:** Automatic with exponential backoff

### With All Changes
- **Risk Level:** LOW
- **Impact:** Jobs can resume from last known progress
- **Recovery:** Automatic + manual capability

---

## 10. Conclusion

The registration batch service needs the same error handling improvements applied to the usage tracking service. Immediate action required:

1. Add retry logic to all database update functions
2. Fix silent failure in `incrementBatchProgress()`
3. Apply exponential backoff pattern from usage tracking service
4. Create shared database error handler utility to avoid code duplication
