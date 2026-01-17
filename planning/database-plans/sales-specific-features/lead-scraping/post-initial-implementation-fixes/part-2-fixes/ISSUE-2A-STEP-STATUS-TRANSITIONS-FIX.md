# Issue 2a: Step Status Transitions Fix

## Document Purpose

This document summarizes the fix for step status transitions when leads are passed between steps.

**Date**: 2025-12-07
**Status**: IMPLEMENTED

---

## Problem Summary

When leads were passed from a step, the step status was not correctly transitioning to reflect that the user had completed their review/selection for that step.

### Previous Behavior
- Step remained as `action_required` until ALL processed/available leads were passed
- This didn't account for the user's deliberate decision to pass only qualifying leads
- Users had no way to indicate they had finished reviewing a step without passing every lead

### Expected Behavior
- When a user passes leads, they've made a deliberate qualification decision
- The step should be marked as `completed` after any pass action
- If more leads arrive later from the previous step, the step should transition back to `action_required`

---

## Solution

### Step Status Transition Logic

**When leads are passed FROM a step (source step):**
- Step immediately transitions to `completed`
- This indicates the user has finished their review/selection for the current batch
- Leads that weren't passed are considered "filtered out" based on qualification criteria

**When leads arrive AT a step (destination step):**
- If step was `pending` or `completed` → transitions to `action_required`
- This allows the cycle to continue when new leads arrive

### Complete Workflow Cycle

```
1. Step receives leads from previous step
   └─→ Status: action_required

2. User reviews leads and passes qualifying ones
   └─→ Status: completed (user has made their selection)

3. Later, more leads arrive from previous step
   └─→ Status: action_required (new leads need review)

4. User reviews new leads and passes qualifying ones
   └─→ Status: completed
```

---

## Implementation

### File Changed

**`lead-scrape-service.js`** - `passLeadsToNextStep()` function

### Code Changes

#### Change 1: Mark source step as completed after passing (lines 885-898)

**Previous Logic:**
```javascript
// Check if all leads have been passed from current step
const { count: remainingCount } = await client
  .from('leads')
  .select('id', { count: 'exact', head: true })
  .eq('lead_scrape_job_id', step.job_id)
  .eq('current_step', step.step_number)
  .in('step_progression_status', ['processed', 'available']);

// If no leads remaining, mark current step as completed
if (remainingCount === 0) {
  await client
    .from('lead_scrape_job_steps')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', stepId);
}
```

**New Logic:**
```javascript
// Mark current step as completed after passing leads
// When a user passes leads, they've made a deliberate decision about which leads qualify.
// The step is considered "completed" because the user has finished their review/selection.
// If more leads arrive later from the previous step, the step will transition back to
// 'action_required' (handled in the next step update logic above).
if (passedCount > 0) {
  await client
    .from('lead_scrape_job_steps')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', stepId);
}
```

#### Change 2: Destination step transitions (already implemented in Issue 2)

```javascript
// Update next step - transition to action_required if pending OR completed
// Completed steps need to become action_required when new leads arrive
const shouldBecomeActionRequired =
  nextStep?.status === 'pending' || nextStep?.status === 'completed';

await client
  .from('lead_scrape_job_steps')
  .update({
    leads_received: (nextStep?.leads_received || 0) + passedCount,
    status: shouldBecomeActionRequired ? 'action_required' : nextStep?.status,
    updated_at: new Date().toISOString()
  })
  .eq('job_id', step.job_id)
  .eq('step_number', nextStepNumber);
```

---

## Example Scenarios

### Scenario 1: Initial Processing
1. Step 1 extracts 21 leads
2. User reviews step 1 and passes 8 leads to step 2
3. **Step 1 → `completed`** (user made their selection)
4. **Step 2 → `action_required`** (new leads arrived)

### Scenario 2: Partial Pass with Return
1. Step 2 has 15 leads (received from step 1)
2. User reviews and passes 5 qualifying leads to step 3
3. **Step 2 → `completed`** (10 leads filtered out, user done reviewing)
4. Later, user passes 3 more leads from step 1 to step 2
5. **Step 2 → `action_required`** (new leads need review)
6. User reviews 3 new leads and passes 2
7. **Step 2 → `completed`** again

### Scenario 3: Multi-step Pipeline
1. User processes step 1, passes 8 leads → **Step 1: completed**
2. User processes step 2, passes 5 leads → **Step 2: completed**, **Step 3: action_required**
3. User goes back to step 1, passes 5 more leads → **Step 1: completed**, **Step 2: action_required**
4. User processes step 2's new leads, passes 3 → **Step 2: completed**, **Step 3: action_required**

---

## Testing Checklist

- [ ] Passing leads from a step marks that step as `completed`
- [ ] Passing leads to a `pending` step changes it to `action_required`
- [ ] Passing leads to a `completed` step changes it to `action_required`
- [ ] Step status badge in UI updates correctly after passing
- [ ] Step list shows correct status for all steps
- [ ] Multiple rounds of passing/receiving work correctly

---

## Related Fixes

- **Issue 2**: Lead display logic fix (computed display status based on lead position)
- **Issue 2b**: Loading states and optimistic updates
- **Issue 3**: Expandable rows in ScrapeJobStepDetailModal

---

## Summary

| Trigger | Source Step | Destination Step |
|---------|-------------|------------------|
| Leads passed | → `completed` | → `action_required` (if was pending/completed) |
| No leads passed | No change | No change |
