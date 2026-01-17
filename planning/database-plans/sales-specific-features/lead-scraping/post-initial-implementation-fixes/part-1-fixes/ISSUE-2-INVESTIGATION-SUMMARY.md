# Issue 2: Lead Selection Not Working When Passing Between Steps

## Investigation Summary

**Date**: 2025-12-06
**Status**: FIXES IMPLEMENTED

---

## Problem Statement

Two related issues were identified:

### Issue 2A: Selection Not Working When Passing Leads
When the user selects specific leads in Step 1 to pass to Step 2, ALL leads are passed instead of only the selected ones.

### Issue 2B: Design Gap - No Auto-Processing After Pass
The intended design was that passing leads to the next step should automatically trigger processing for those leads. Currently, the user must:
1. Pass leads to next step (selection broken)
2. Go to the next step and select which leads to process separately

---

## Root Cause Analysis

### Root Cause 1: Auto-Pass in processStep1

**Location**: `lead-scrape-firecrawl-service.js` lines 409-419

```javascript
// Create lead records
const leadsToCreate = limitedRestaurants.map(r => ({
  lead_scrape_job_id: jobId,
  restaurant_name: r.restaurant_name,
  store_link: r.store_link,
  platform: job.platform,
  country: job.country,
  city: job.city,
  current_step: 2,  // <-- ALL LEADS GO DIRECTLY TO STEP 2
  step_progression_status: 'available'
}));
```

**Problem**: When Step 1 completes, ALL leads are created with `current_step: 2`. They bypass the manual pass step entirely. This means:
- Users never have the opportunity to select which leads to pass
- All leads are automatically "passed" to step 2

### Root Cause 2: Mismatched Filter in passLeadsToNextStep

**Location**: `lead-scrape-service.js` lines 811-822

```javascript
const { data: updatedLeads, error: leadsError } = await client
  .from('leads')
  .update({
    current_step: isLastStep ? step.step_number : nextStepNumber,
    step_progression_status: isLastStep ? 'passed' : 'available',
    updated_at: new Date().toISOString()
  })
  .in('id', leadIds)
  .eq('lead_scrape_job_id', step.job_id)
  .eq('current_step', step.step_number)  // <-- FILTERS FOR current_step = 1
  .select();
```

**Problem**: The function filters for leads where `current_step = step.step_number`. When called from Step 1:
- `step.step_number = 1`
- But ALL leads have `current_step = 2` (due to Root Cause 1)
- The UPDATE matches 0 rows
- `passed_count` is always 0

### Root Cause 3: No Integration Between Pass and Process

**Location**: `lead-scrape-routes.js` and `lead-scrape-service.js`

**Problem**: The `passLeadsToNextStep` function only updates lead positions. There is no code that:
- Triggers processing for the leads after they're passed
- Integrates the two actions into a single workflow

---

## Current Flow vs Desired Flow

### Current Flow (Broken)

```
Step 1 Extraction
      │
      ▼
processStep1() creates leads at current_step: 2
      │
      ▼
User views Step 1 (sees leads at step 2 due to gte query)
      │
      ▼
User selects leads, clicks "Pass to Next"
      │
      ▼
passLeadsToNextStep() filters for current_step = 1
      │
      ▼
0 rows match → passed_count = 0
      │
      ▼
User goes to Step 2, sees ALL leads
      │
      ▼
User must manually select + process
```

### Desired Flow

```
Step 1 Extraction
      │
      ▼
processStep1() creates leads at current_step: 1, status: 'processed'
      │
      ▼
User views Step 1, sees leads ready to pass
      │
      ▼
User selects specific leads, clicks "Pass to Next"
      │
      ▼
passLeadsToNextStep():
  - Updates selected leads to current_step: 2
  - Sets status to 'processing'
  - AUTO-TRIGGERS processStep2 for those leads
      │
      ▼
Step 2 processes only the selected leads
      │
      ▼
Remaining leads stay at Step 1 for later decision
```

---

## Code Flow Trace

### getJobStep - How Leads Are Displayed

**Location**: `lead-scrape-service.js` lines 619-640

```javascript
if (step.status === 'completed') {
  // For completed steps: current_step >= stepNumber + 1
  leadsQuery = leadsQuery.gte('current_step', stepNumber + 1);
} else {
  // For other statuses: current_step = stepNumber
  leadsQuery = leadsQuery.eq('current_step', stepNumber);
}
```

When Step 1 is `completed`:
- Query: `gte('current_step', 2)` returns ALL leads (they're all at step 2)
- This is why leads appear in Step 1 view even though they're at step 2

When Step 2 is `action_required`:
- Query: `eq('current_step', 2)` returns ALL leads
- This is why all leads appear in Step 2 view

### processStep2 - Why Processing Selection Works

**Location**: `lead-scrape-firecrawl-service.js` lines 513-525

```javascript
let query = client
  .from('leads')
  .select('*')
  .eq('lead_scrape_job_id', jobId)
  .eq('current_step', 2)            // Correctly filters for step 2
  .eq('step_progression_status', 'available');

if (leadIds && leadIds.length > 0) {
  query = query.in('id', leadIds);   // Then filters by selection
}
```

Processing works because:
1. It queries leads at `current_step: 2` (correct!)
2. It filters by `step_progression_status: 'available'`
3. It then narrows by provided `leadIds` if specified
4. All these conditions match correctly

---

## Detailed Fix Requirements

### Fix 1: Keep Leads at Step 1 After Extraction

**File**: `lead-scrape-firecrawl-service.js`

Change `processStep1` to create leads at `current_step: 1` with status `'processed'`:

```javascript
// BEFORE (line 417)
current_step: 2,
step_progression_status: 'available'

// AFTER
current_step: 1,
step_progression_status: 'processed'
```

Also update step 1 status to `action_required` instead of `completed`:
```javascript
// BEFORE (around line 428)
status: 'completed',

// AFTER
status: 'action_required',
```

### Fix 2: Update passLeadsToNextStep Filter

**File**: `lead-scrape-service.js`

The function should look for leads with `step_progression_status: 'processed'` at the current step:

```javascript
// BEFORE (line 821)
.eq('current_step', step.step_number)

// Need to verify the filter matches actual lead state
// Leads should be at current step with status 'processed'
.eq('current_step', step.step_number)
.in('step_progression_status', ['processed', 'available'])  // Accept both statuses
```

### Fix 3: Integrate Pass + Auto-Process

**File**: `lead-scrape-service.js` or `lead-scrape-routes.js`

After successfully passing leads, automatically trigger processing:

```javascript
// In passLeadsToNextStep, after updating leads:
// 1. Update leads to status 'processing' (not 'available')
// 2. Return the lead IDs that were passed
// 3. In the route handler, trigger processing for those leads

// OR create a new combined function:
async function passAndProcessLeads(stepId, leadIds, orgId) {
  // 1. Pass leads to next step
  const passResult = await passLeadsToNextStep(stepId, leadIds, orgId);

  // 2. Get job info for processing
  const step = await getStepById(stepId);
  const nextStepNumber = step.step_number + 1;

  // 3. Trigger processing for the passed leads
  const processResult = await processStepN(step.job_id, leadIds, nextStepNumber);

  return { passResult, processResult };
}
```

---

## Testing Scenarios

### Scenario 1: Verify Selection Works for Passing

1. Create new job with 20 leads extracted in Step 1
2. View Step 1, verify 20 leads shown
3. Select 5 specific leads
4. Click "Pass to Next"
5. **Expected**: Only 5 leads move to Step 2
6. View Step 1, verify 15 leads remain
7. View Step 2, verify only 5 leads present

### Scenario 2: Verify Auto-Process After Pass

1. After passing 5 leads to Step 2 (from Scenario 1)
2. **Expected**: Step 2 processing starts automatically
3. Verify leads have `step_progression_status: 'processing'` then `'processed'`
4. Verify enrichment fields are populated

### Scenario 3: Verify Non-Selected Leads Stay

1. From Scenario 1, verify 15 leads remain at Step 1
2. User can later select more leads to pass
3. Or delete leads they don't want

---

## Files to Modify

| File | Changes Required |
|------|-----------------|
| `lead-scrape-firecrawl-service.js` | Fix `processStep1` to keep leads at step 1 |
| `lead-scrape-service.js` | Fix `passLeadsToNextStep` filter and add auto-process |
| `lead-scrape-routes.js` | Possibly add combined pass+process endpoint |

---

## Risk Assessment

### Low Risk
- Changes are isolated to lead scraping module
- No impact on existing restaurant data

### Medium Risk
- Existing jobs with leads already at step 2 may have inconsistent state
- May need migration or cleanup of test data

### Mitigation
- Test thoroughly with new jobs first
- Consider migration script for existing jobs if needed
- Add logging to trace lead progression

---

## Recommended Implementation Order

1. **Fix processStep1** - Keep leads at step 1 after extraction
2. **Fix passLeadsToNextStep filter** - Match leads correctly
3. **Add auto-process integration** - Trigger processing after pass
4. **Test end-to-end** - Verify complete flow works
5. **Consider migration** - Handle any existing inconsistent data

---

## FIXES APPLIED (2025-12-06)

### Fix 1: processStep1 Updated
**File**: `lead-scrape-firecrawl-service.js` (lines 409-457)

Changes made:
- Leads now created at `current_step: 1` (was: 2)
- Leads created with `step_progression_status: 'processed'` (was: 'available')
- Step 1 status set to `action_required` after extraction (was: 'completed')
- Job `current_step` stays at 1 until user passes leads (was: auto-advanced to 2)
- Removed auto-update of step 2 `leads_received` (now done when passing)

### Fix 2: passLeadsToNextStep Updated
**File**: `lead-scrape-service.js` (lines 768-913)

Changes made:
- Filter now accepts leads with status `processed`, `available`, OR `failed`
- Returns `job_id`, `passed_lead_ids`, `next_step_number` for auto-processing
- Updates next step's `leads_received` count
- Sets next step status to `action_required` if it was `pending`
- Updates job's `current_step` when leads are passed
- Auto-marks current step as `completed` when all leads have been passed
- Added `auto_process` parameter (default: true)

### Fix 3: Auto-Process Integration Added
**File**: `lead-scrape-routes.js` (lines 343-415)

Changes made:
- Pass-leads endpoint now accepts `auto_process` option (default: true)
- After successfully passing leads, auto-triggers processing for next step
- Processing runs in background using `setImmediate`
- Supports auto-processing for steps 2, 3, 4, and 5

### New Flow After Fixes

```
Step 1 Extraction (automatic)
      │
      ▼
Leads created at current_step: 1, status: 'processed'
Step 1 status: 'action_required'
      │
      ▼
User views Step 1, sees leads ready to pass
      │
      ▼
User selects specific leads (e.g., 5 of 20)
      │
      ▼
User clicks "Pass to Next Step"
      │
      ▼
passLeadsToNextStep():
  - Updates 5 selected leads: current_step: 2, status: 'available'
  - Updates Step 1: leads_passed += 5
  - Updates Step 2: leads_received += 5, status: 'action_required'
  - Updates Job: current_step: 2
      │
      ▼
Auto-triggers processStep2() for the 5 passed leads
      │
      ▼
Step 2 enriches the 5 leads with UberEats data
      │
      ▼
Remaining 15 leads stay at Step 1 for later decision
```

### Important Notes

1. **Existing Jobs**: Jobs created before this fix will have leads at `current_step: 2`. These will need manual handling or can be tested with new jobs.

2. **Frontend Updates May Be Needed**: The frontend may need updates to:
   - Show the correct status badge for Step 1 (`action_required` instead of `completed`)
   - Handle the new response format from pass-leads endpoint

3. **Testing Required**: Create a new job and verify:
   - Step 1 shows leads at step 1 with `processed` status
   - Selection works when passing leads
   - Only selected leads move to step 2
   - Step 2 processing auto-triggers
