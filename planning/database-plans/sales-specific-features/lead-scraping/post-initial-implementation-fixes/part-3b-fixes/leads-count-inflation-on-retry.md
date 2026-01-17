# Investigation: Step Leads Count Inflation on Retry

**Status**: ✅ RESOLVED

## Problem Statement

**Reported Issue**: Retrying a lead for processing increments the `leads_received` field on `lead_scrape_job_steps` even though the lead was already counted.

**Actual Issue**: The `leads_processed` field was being double-counted on retry (not `leads_received`).

**Result**: This causes inflated totals in step statistics, making progress tracking inaccurate.

---

## Investigation Summary

### Files Analyzed

| File | Purpose |
|------|---------|
| [lead-scrape-service.js](../../../../../../UberEats-Image-Extractor/src/services/lead-scrape-service.js) | Core business logic |
| [lead-scrape-firecrawl-service.js](../../../../../../UberEats-Image-Extractor/src/services/lead-scrape-firecrawl-service.js) | Firecrawl processing |
| [lead-scrape-routes.js](../../../../../../UberEats-Image-Extractor/src/routes/lead-scrape-routes.js) | API route handlers |
| [useLeadScrape.ts](../../../../../../UberEats-Image-Extractor/src/hooks/useLeadScrape.ts) | Frontend React Query hooks |
| [ScrapeJobStepDetailModal.tsx](../../../../../../UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx) | Step detail UI |

---

## Root Cause Analysis

### Finding 1: `leads_processed` Double-Counting (CONFIRMED BUG)

**Location**: `lead-scrape-firecrawl-service.js` - processStep2/3/4/5 functions

Each processStep function has the same problematic pattern:

```javascript
// Lines 622-640 (processStep2), 768-786 (processStep3), 932-949 (processStep4)
const { data: currentStep } = await client
  .from('lead_scrape_job_steps')
  .select('leads_processed, leads_failed')
  .eq('job_id', jobId)
  .eq('step_number', X)
  .single();

await client
  .from('lead_scrape_job_steps')
  .update({
    leads_processed: (currentStep?.leads_processed || 0) + processed + failed,  // BUG: Accumulates!
    leads_failed: (currentStep?.leads_failed || 0) + failed,
    status: failed === leads.length ? 'failed' : 'action_required',
    updated_at: new Date().toISOString()
  })
  .eq('job_id', jobId)
  .eq('step_number', X);
```

**Why This is a Problem**:

1. First processing run: Lead processed → `leads_processed` = 1
2. Lead fails → `leads_failed` = 1
3. User retries → `retryFailedLeads()` decrements `leads_failed` to 0
4. `processStepX()` runs again → `leads_processed` = 1 + 1 = **2 (DOUBLE COUNTED!)**

### Finding 2: `leads_received` Analysis

**Locations where `leads_received` is updated**:

1. **processStep1** ([line 470](../../../../../../UberEats-Image-Extractor/src/services/lead-scrape-firecrawl-service.js#L470)):
   ```javascript
   leads_received: restaurants.length  // Set once during initial extraction
   ```

2. **passLeadsToNextStep** ([line 859](../../../../../../UberEats-Image-Extractor/src/services/lead-scrape-service.js#L859)):
   ```javascript
   leads_received: (nextStep?.leads_received || 0) + passedCount  // Increments NEXT step
   ```

**Conclusion**: `leads_received` is NOT incremented during retry operations. The user may be observing `leads_processed` inflation but attributing it to `leads_received`.

### Finding 3: Retry Flow Trace

```
User clicks "Retry"
    → retryMutation.mutateAsync({ stepId, leadIds })
    → POST /api/lead-scrape-job-steps/:stepId/retry
    → leadScrapeService.retryFailedLeads(stepId, leadIds, orgId)
        1. Get step with job info
        2. Get current status of leads
        3. Update leads: step_progression_status = 'available'
        4. Decrement leads_failed on step
        5. Fire-and-forget: processStepX(jobId, retriedLeadIds)
            → Re-processes leads
            → INCREMENTS leads_processed (BUG!)
    → Returns { retried_count, auto_processing: true }
```

---

## Impact Assessment

### UI Locations Affected

| Component | Display | Issue |
|-----------|---------|-------|
| ScrapeJobStepList.tsx:152 | `{step.leads_received - step.leads_processed}` (remaining) | Shows negative numbers |
| ScrapeJobStepList.tsx:159 | `step.leads_processed - step.leads_passed` (ready to review) | Inflated count |
| ScrapeJobStepDetailModal.tsx:795 | `Processed: {step.leads_processed}` | Inflated value |

### Severity

- **High**: Progress tracking is incorrect
- **Medium**: User confusion about actual lead counts
- **Low**: No data loss, just inflated counters

---

## Proposed Fix

### Option 1: Track Unique Processed Leads (Recommended)

Change the step update logic to count unique processed leads instead of accumulating:

```javascript
// In processStep2/3/4/5 after processing:

// Get count of leads that have been processed at this step
const { count: totalProcessed } = await client
  .from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('lead_scrape_job_id', jobId)
  .eq('current_step', stepNumber)
  .in('step_progression_status', ['processed', 'passed', 'failed']);

// Get count of failed leads at this step
const { count: totalFailed } = await client
  .from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('lead_scrape_job_id', jobId)
  .eq('current_step', stepNumber)
  .eq('step_progression_status', 'failed');

await client
  .from('lead_scrape_job_steps')
  .update({
    leads_processed: totalProcessed,  // Actual count, not accumulated
    leads_failed: totalFailed,        // Actual count, not accumulated
    status: failed === leads.length ? 'failed' : 'action_required',
    updated_at: new Date().toISOString()
  })
  .eq('job_id', jobId)
  .eq('step_number', stepNumber);
```

### Option 2: Prevent Re-counting on Retry

Mark leads as "retry_in_progress" during retry to distinguish from first-time processing:

```javascript
// In retryFailedLeads, mark leads differently:
await client
  .from('leads')
  .update({
    step_progression_status: 'retry_pending',  // New status
    validation_errors: [],
    updated_at: new Date().toISOString()
  })
  .in('id', leadIds);

// In processStepX, only increment counters for non-retry leads:
// (More complex, requires tracking which leads are retries)
```

**Recommendation**: Option 1 is cleaner and more accurate.

---

## Files to Modify

1. **lead-scrape-firecrawl-service.js**:
   - `processStep2()` - lines 622-640
   - `processStep3()` - lines 768-786
   - `processStep4()` - lines 932-949
   - `processStep5()` - similar pattern (if exists)

2. **No frontend changes needed** - UI already displays correct fields

---

## Testing Plan

1. Create a lead scrape job with a few leads
2. Process leads through Step 2 (note `leads_processed` count)
3. Force some leads to fail (can modify validation)
4. Retry the failed leads
5. Verify `leads_processed` does NOT double-count
6. Verify `leads_failed` correctly reflects actual failed leads
7. Pass leads to Step 3, repeat retry test

---

## Additional Note on `leads_received`

If the user is specifically seeing `leads_received` increment on retry, there may be an edge case not captured in this investigation. Possible scenarios:

1. User is clicking "Pass to Next" after retry (which would correctly increment next step's `leads_received`)
2. A race condition where the same lead is passed multiple times
3. Frontend optimistic update displaying stale/incorrect data

Recommend adding console logging to track when and where `leads_received` updates occur if issue persists.

---

## Resolution

**Implemented**: Option 1 - Track Unique Processed Leads

### Changes Made

| Function | Before | After |
|----------|--------|-------|
| `processStep2()` | Accumulated `leads_processed` | Query actual count from leads table |
| `processStep3()` | Accumulated `leads_processed` | Query actual count from leads table |
| `processStep4()` | Accumulated `leads_processed` | Query actual count from leads table |
| `processStep5()` | Accumulated `leads_processed` | Query actual count from leads table |

### Code Pattern Applied

```javascript
// Count actual unique processed leads at this step (prevents double-counting on retry)
const { count: totalProcessed } = await client
  .from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('lead_scrape_job_id', jobId)
  .eq('current_step', stepNumber)
  .in('step_progression_status', ['processed', 'passed', 'failed']);

// Count actual failed leads at this step
const { count: totalFailed } = await client
  .from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('lead_scrape_job_id', jobId)
  .eq('current_step', stepNumber)
  .eq('step_progression_status', 'failed');

// Update step stats with actual counts
await client
  .from('lead_scrape_job_steps')
  .update({
    leads_processed: totalProcessed || 0,
    leads_failed: totalFailed || 0,
    ...
  })
```

### Benefits

1. **Accurate counts**: Always reflects the true number of leads at each status
2. **Retry-safe**: Re-processing leads doesn't inflate counters
3. **Self-healing**: If counts get out of sync for any reason, next processing corrects them

**Date Fixed**: 2025-12-07
