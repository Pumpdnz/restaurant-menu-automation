# Session 1: Single Restaurant YOLO Mode Fixes

**Date:** 2026-01-02
**Focus:** Fixing single-restaurant YOLO mode execution and implementing resume functionality

---

## Issues Fixed

### 1. Database Schema Issues

#### 1.1 Nullable `batch_job_id` for Single-Restaurant Mode
**Problem:** Single-restaurant YOLO mode execution failed because `registration_jobs.batch_job_id` had a NOT NULL constraint, but single-restaurant executions don't belong to a batch.

**Fix:** Applied migration to make `batch_job_id` nullable:
```sql
ALTER TABLE public.registration_jobs
ALTER COLUMN batch_job_id DROP NOT NULL;
```

**File:** Database migration applied via Supabase MCP

---

#### 1.2 Wrong Column Name for Step Records
**Problem:** Code was using `registration_job_id` instead of `job_id` when inserting/querying `registration_job_steps` table.

**Fix:** Updated column references in `registration-batch-service.js`:
- Line 3261: `.eq('job_id', jobId)`
- Line 3290: `job_id: jobId`

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

---

#### 1.3 Missing Step Record on Job Reuse
**Problem:** When reusing an existing job, the code tried to reset Step 6 but didn't create it if missing (from a previous failed attempt).

**Fix:** Added logic to check if step exists and create it if missing:
```javascript
const { data: existingStep } = await client
  .from('registration_job_steps')
  .select('id')
  .eq('job_id', jobId)
  .eq('step_number', 6)
  .maybeSingle();

if (existingStep) {
  // Reset existing step
} else {
  // Create new step record
}
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (lines 3251-3285)

---

### 2. Resume Functionality Implementation

#### 2.1 Resume Endpoint for Single-Restaurant Mode
**Problem:** No way to resume a failed single-restaurant YOLO mode execution.

**Fix:** Added new endpoint `POST /api/registration/resume-single-restaurant/:restaurantId` that:
- Finds the most recent single-restaurant job (where `batch_job_id` is null)
- Validates there's progress to resume from
- Calls `resumeYoloModeForJob()` in the background
- Returns immediately with job ID and resume point

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 4643-4729)

---

#### 2.2 Frontend Resume Hook
**Problem:** Frontend couldn't detect or trigger resume for failed executions.

**Fix:** Updated `useYoloModeExecution` hook:
- `checkAndResumeExecution()` now detects both `failed` and `stalled` executions
- Added `resumeExecution()` function to call the resume endpoint
- Added `canResume` computed state
- Treats stalled executions as resumable

**File:** `UberEats-Image-Extractor/src/hooks/useYoloModeExecution.ts`

---

#### 2.3 Resume Button in Dialog
**Problem:** No UI to trigger resume.

**Fix:** Added Resume button in `YoloModeDialog` that appears when:
- Execution status is `failed`
- There's existing progress (`canResume` is true)

**File:** `UberEats-Image-Extractor/src/components/registration/YoloModeDialog.tsx` (lines 727-736)

---

### 3. Stalled Job Detection

#### 3.1 Detecting Stuck Jobs
**Problem:** Jobs that crashed mid-execution remained in `in_progress` state forever, with no way to resume them.

**Fix:** Added stalled detection in `getSingleRestaurantYoloProgress()`:
- Checks if job has been `in_progress` for more than 5 minutes without activity
- Scans sub-step `completed_at` and `started_at` timestamps
- Returns `status: 'stalled'` instead of `in_progress` for stuck jobs

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (lines 3635-3669)

---

### 4. Authentication Token Fix

#### 4.1 Duplicate Bearer Prefix
**Problem:** Auth token was being prefixed with `Bearer ` twice, causing authentication failures. The token from `req.headers.authorization` already includes `Bearer `, and the code was adding it again.

**Fix:** Added check to prevent double prefix:
```javascript
const token = context.authContext.token;
headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (lines 1935-1937)

---

### 5. Single-Restaurant Mode Compatibility

#### 5.1 Null Batch ID Handling
**Problem:** `incrementBatchProgress()` was called with `null` batch ID for single-restaurant mode, causing UUID parse errors.

**Fix:** Added early return for null batch ID:
```javascript
async function incrementBatchProgress(batchId, type) {
  if (!batchId) {
    return; // Skip for single-restaurant mode
  }
  // ...
}
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (lines 772-775)

---

#### 5.2 Invalid Column Name in Error Handling
**Problem:** Code tried to write to `last_failure` column which doesn't exist in `registration_job_steps` table.

**Fix:** Changed `last_failure` to `error_details` (the actual JSONB column):
- Line 1828: `error_details: { ... }`
- Line 2398: `error_details: { ... }`

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

---

### 6. Performance Optimization

#### 6.1 Reduced Polling Frequency
**Problem:** Frontend was polling for progress every 2 seconds, causing unnecessary load.

**Fix:** Increased polling interval from 2 seconds to 5 seconds:
```javascript
const POLL_INTERVAL = 5000; // 5 seconds
```

**File:** `UberEats-Image-Extractor/src/hooks/useYoloModeExecution.ts` (line 44)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/registration-batch-service.js` | Null checks, column fixes, stalled detection, token fix |
| `src/routes/registration-routes.js` | Added resume endpoint |
| `src/hooks/useYoloModeExecution.ts` | Resume functionality, stalled detection, polling interval |
| `src/components/registration/YoloModeDialog.tsx` | Resume button UI |

---

## Database Migrations Applied

1. `allow_null_batch_job_id_for_single_restaurant` - Made `batch_job_id` nullable

---

## Testing Notes

To test resume functionality:
1. Start a single-restaurant YOLO mode execution
2. Stop the server mid-execution (simulating crash)
3. Restart server
4. Open the YOLO Mode dialog for the same restaurant
5. Should see progress view with "Resume" button
6. Click Resume to continue from last completed phase

---

## Known Considerations

- Stalled detection threshold is 5 minutes - jobs inactive for less time will still appear as "in progress"
- Resume uses the current user's auth token, not the original executor's token
- Single-restaurant jobs have `batch_job_id = null` to distinguish from batch jobs
