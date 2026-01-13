# Investigation: Step Orchestration Patterns

## Overview

Analysis of how the lead scrape system handles mixed automatic and action_required steps, and how to apply this to the registration workflow.

---

## Current Step Orchestration Architecture

### Step Definition (Database-Driven)
Steps defined in `UBEREATS_STEPS` array (lead-scrape-service.js, lines 12-37):
```javascript
{
  step_number: 1,
  step_name: 'Category Page Scan',
  step_description: 'Scan main categories...',
  step_type: 'automatic'
}
```

Stored in `lead_scrape_job_steps` table with status tracking.

### Step Statuses
- `pending` - Not yet started
- `action_required` - Waiting for user input
- `in_progress` - Currently processing
- `completed` - Finished successfully
- `failed` - Error occurred
- `retrying` - Attempting recovery

---

## Automatic vs Action_Required Handling

### Automatic Steps (Step 1 - Category Page Scan)
Backend automatically triggers via `setImmediate()`:

```javascript
// From lead-scrape-routes.js line 151-160
setImmediate(async () => {
  const step1Result = await leadScrapeFirecrawlService.processStep1(job.id, job);
});
```

- No user intervention needed
- Execution happens in background after response sent
- Frontend polls for status updates

### Action_Required Steps (Steps 2-4)
Backend marks step as `action_required` (firecrawl-service line 695):
- Waits for user to manually select/pass leads
- User clicks button → triggers next step
- Step transitions to `in_progress` when user initiates action

---

## Step Progression Triggers

### Automatic Progression
- Step 1: Auto-triggers after job creation via `setImmediate()`
- After completion, step status becomes `action_required` (waits for user)

### Manual Progression
User calls `POST /api/lead-scrape-job-steps/:stepId/pass-leads`:
1. Updates leads' `current_step` and `step_progression_status`
2. Next step's `leads_received` incremented
3. Next step transitions to `action_required` if pending
4. Auto-trigger processes next step if `autoProcess=true`

---

## How UI Knows When to Show Action Buttons

`ScrapeJobProgressCard.tsx` monitors:
- `step.step_type` - automatic or manual
- `step.status` - current state
- `step.leads_received` vs `step.leads_processed` - progress

Dynamic refetch in `useLeadScrape.ts` (3s when processing, 10s otherwise)

---

## Parallel vs Sequential Execution

### Within Phase (Parallel)
Step 1 can scrape multiple pages in parallel (batches of 5):
```javascript
// Uses Promise.allSettled() for batch processing
const results = await Promise.allSettled(batch.map(url => scrape(url)));
```

### Between Steps (Sequential)
- Steps must complete in order (1 → 2 → 3 → 4)
- Cannot skip steps
- Can retry previous steps if needed

---

## Action_Required Step Resume Flow

1. User navigates to step detail page
2. Sees leads with status `available`
3. Selects leads to pass
4. Clicks "Pass Leads" button
5. Calls `passLeadsToNextStep()`:
   - Updates selected leads: `current_step = nextStepNumber`
   - Updates next step: `leads_received += count`, `status = 'action_required'`
   - Updates current step: `leads_passed += count`, `status = 'completed'`
6. Auto-triggers next step if `autoProcess=true`

---

## Key Implementation Patterns

### Job State Machine
```
draft → pending → in_progress → (step progression) → completed/failed/cancelled
```

### Step Processing Pattern
```javascript
// From lead-scrape-routes.js line 393-418
if (result.auto_process && result.passed_lead_ids.length > 0) {
  setImmediate(async () => {
    switch (result.next_step_number) {
      case 2: processResult = await service.processStep2(...); break;
      case 3: processResult = await service.processStep3(...); break;
      // etc
    }
  });
}
```

---

## Proposed Registration Workflow Steps

Based on the orchestration patterns, here's the proposed step structure:

### Step 1: Menu & Branding Extraction (Automatic)
- `step_type: 'automatic'`
- Triggers premium menu extraction and branding extraction
- Already happens during conversion - just track status
- Waits for both extractions to complete

### Step 2: Contact Details Search (Automatic → Action Required)
- `step_type: 'automatic'` for search execution
- Runs companies office search for each restaurant
- Persists candidates to `companies_office_search_candidates` table
- Transitions to `action_required` when candidates ready

### Step 3: Company Selection (Action Required)
- `step_type: 'action_required'`
- User reviews search results
- User selects correct company for each restaurant
- New batch UI for bulk selection

### Step 4: Company Details Extraction (Automatic)
- `step_type: 'automatic'`
- Extracts full details for selected companies
- Auto-saves to restaurant records

### Step 5: Yolo Mode Configuration (Action Required)
- `step_type: 'action_required'`
- User configures yolo mode settings per restaurant
- Could offer "apply to all" for common settings

### Steps 6+: Yolo Mode Execution (Automatic)
- `step_type: 'automatic'`
- Executes yolo mode steps sequentially
- 12 sub-steps within this orchestration step

---

## Sub-Step Handling for Yolo Mode

### Option 1: Single Step with Sub-Progress (Recommended)
```javascript
registration_job_steps:
  step_number: 6
  step_name: 'Pumpd Account Setup'
  status: 'in_progress'
  metadata: {
    current_sub_step: 5,
    total_sub_steps: 12,
    sub_step_statuses: {
      account: 'completed',
      codeGeneration: 'completed',
      restaurantRegistration: 'in_progress',
      // ...
    }
  }
```

- Single orchestration step for all yolo mode execution
- Sub-step progress tracked in metadata JSONB
- UI shows nested progress

### Option 2: Expand to Individual Steps
```javascript
// Each yolo mode phase is its own step
step_6: Account Registration
step_7: Code Generation
step_8: Restaurant Registration
// ... etc
```

- More granular tracking
- More database records
- Better for retry at specific sub-step

**Recommendation:** Option 1 for simplicity - single step with sub-progress in metadata.

---

## Retry Logic

From firecrawl-service.js (lines 405-495):
```javascript
let lastError;
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await executeStep();
  } catch (error) {
    lastError = error;
    const isRetryable = error.includes('TIMEOUT') || error.includes('rate');
    if (!isRetryable) throw error;
    await sleep(retryDelay * (attempt + 1)); // Exponential backoff
  }
}
throw lastError;
```

---

## Summary: Patterns to Reuse

1. **Database-driven step definitions** with flexible step types
2. **`setImmediate()` for async execution** (non-blocking background)
3. **`action_required` status** for user intervention points
4. **Automatic step progression** after user actions
5. **Frontend polling** (10-30s intervals) for real-time updates
6. **Parallel execution within phases** (Promise.allSettled)
7. **Sequential execution between phases**
8. **Retry logic with exponential backoff**

This architecture is production-ready and directly applicable to the registration workflow.
