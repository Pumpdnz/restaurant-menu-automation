# Lead Scraping Fixes Part 2 - Investigation Overview

## Document Purpose

This document investigates issues with lead display, counting, and column values across the lead scraping UI components discovered during testing.

**Date**: 2025-12-07
**Status**: ISSUES 1, 2, 2b, 3 FIXED

### Fix Documentation
- **Issue 1**: See section below "FIXES APPLIED - Issue 1"
- **Issue 2**: See [ISSUE-2-LEAD-DISPLAY-FIX.md](./ISSUE-2-LEAD-DISPLAY-FIX.md)
- **Issue 2b**: See [ISSUE-2B-LOADING-STATES-FIX.md](./ISSUE-2B-LOADING-STATES-FIX.md)
- **Issue 3**: See [ISSUE-3-EXPANDABLE-ROWS-FIX.md](./ISSUE-3-EXPANDABLE-ROWS-FIX.md)

---

## FIXES APPLIED - Issue 1: Leads Column Computation

### Root Cause Found
The `processStep` functions (2, 3, 4, 5) were incorrectly setting `leads_passed = processed` after processing completed. This caused the formula `leads_processed - leads_passed` to always equal 0 or be incorrect.

### Files Modified

#### 1. lead-scrape-firecrawl-service.js
- **processStep2** (lines 586-604): Removed incorrect `leads_passed: processed`, now increments `leads_processed` and `leads_failed`
- **processStep3** (lines 711-730): Same fix
- **processStep4** (lines 850-868): Same fix
- **processStep5** (lines 992-1013): Same fix, but sets `leads_passed` for last step since leads are "passed" by being fully processed

#### 2. ScrapeJobStepList.tsx - getLeadsDisplay()
- **action_required**: Now correctly shows `leads_processed - leads_passed` as "X ready to review" or "No leads ready"
- **pending**: Now shows "X ready for processing" if `leads_received > 0` AND is clickable (wrapped in LeadsWrapper)
- **completed**: Now shows "X passed" instead of "X / Y" to avoid stale `leads_received` values
- **in_progress**: Shows remaining leads being processed

### Expected Behavior After Fix

| Step Status | Display | Clickable |
|-------------|---------|-----------|
| pending (no leads) | "Pending" | No |
| pending (has leads) | "8 ready for processing" | Yes |
| action_required | "13 ready to review" | Yes |
| in_progress | "Processing... (5)" | Yes |
| completed | "8 passed" | Yes |
| failed | "3 failed" | Yes |

---

## Current Test State

| Step | Status | Leads at Step | Passed | Description |
|------|--------|---------------|--------|-------------|
| Step 1 | action_required | 13 processed, 8 passed | 8/21 | 13 ready to pass, 8 already passed to step 2 |
| Step 2 | completed | 0 at step 2 | 8/8 | All 8 processed and passed to step 3 |
| Step 3 | completed | 0 at step 3 | 8/8 | All 8 processed and passed to step 4 |
| Step 4 | action_required | 8 processed | 0/8 | 8 ready to pass to step 5 |
| Step 5 | pending | 0 at step 5 | 0 | Waiting for leads from step 4 |

---

## Issue 1: Leads Column Computation in ScrapeJobStepList.tsx

### Current Implementation

**File**: `ScrapeJobStepList.tsx` - `getLeadsDisplay()` function (lines 123-195)

```javascript
case 'action_required':
  return "{step.leads_processed - step.leads_passed} ready to review";

case 'completed':
  return "{step.leads_passed} / {step.leads_received}";

case 'pending':
  return "Pending"; // NOT clickable
```

### Current Bugs

| Step | Current Display | Expected Display | Issue |
|------|-----------------|------------------|-------|
| Step 1 | "13 ready to review" | "13 ready to review" | Correct |
| Step 2 | "16/8" | "8/8 (all passed)" | `leads_passed/leads_received` but leads_received=16 is cumulative from multiple batches |
| Step 3 | "2/8" | "8/8 (all passed)" | Same issue - stale/incorrect leads_received value |
| Step 4 | "0 ready to review" | "8 ready to review" | `leads_processed - leads_passed = 0` but there ARE 8 processed leads |
| Step 5 | "Pending" (not clickable) | "8 ready for processing" | Pending status ignores leads_received and isn't clickable |

### Root Cause Analysis

1. **Incorrect Formula for action_required**:
   - `leads_processed - leads_passed` assumes all processed leads are at current step
   - But processed leads might have different statuses (available, processed, passed)

2. **Stale `leads_received` values**:
   - `leads_received` is cumulative and incremented each time leads are passed
   - Should represent "total leads that ever entered this step"
   - Display should show "leads at step with processed status" / "total leads passed to this step"

3. **Pending steps not clickable**:
   - The `LeadsWrapper` is only rendered when `step.leads_received > 0 || step.leads_processed > 0`
   - For pending steps, this is false, so not wrapped and not clickable
   - Should check if there are leads available from previous step

### Proposed Fix

```javascript
// For action_required steps - calculate from actual lead data
case 'action_required':
  const readyCount = leads.filter(l =>
    l.step_progression_status === 'processed' ||
    l.step_progression_status === 'available'
  ).length;
  return `${readyCount} ready to review`;

// For completed steps - show passed/total that entered
case 'completed':
  return `${step.leads_passed} passed`;

// For pending steps - show if leads are waiting
case 'pending':
  if (step.leads_received > 0) {
    return `${step.leads_received} ready for processing`;
  }
  return "Pending";
```

---

## Issue 2: Lead Display Logic in LeadPreview.tsx and getJobStep

### Current Implementation

**File**: `lead-scrape-service.js` - `getJobStep()` function (lines 619-640)

```javascript
if (step.status === 'completed') {
  // Show leads that have moved past this step
  leadsQuery = leadsQuery.gte('current_step', stepNumber + 1);
} else {
  // Show leads at this step
  leadsQuery = leadsQuery.eq('current_step', stepNumber);
}
```

### Current Bugs

| Step | Current Display | Expected Display | Issue |
|------|-----------------|------------------|-------|
| Step 1 | 13 leads (processed status) | 13 processed + 8 passed | Missing passed leads |
| Step 2 | 8 leads (processed status) | 8 passed + 0 available | Shows "processed" but should be "passed" |
| Step 3 | 8 leads (processed status) | 8 passed | Same as above |
| Step 4 | 8 leads (processed status) | 8 processed | Correct |
| Step 5 | Not accessible (Pending) | 8 available (from step 4) | Should show leads ready for this step |

### Root Cause Analysis

1. **Completed steps show wrong leads**:
   - `gte('current_step', stepNumber + 1)` returns leads at ALL future steps
   - For Step 2 (completed), it returns leads at steps 3, 4, 5
   - Should only show leads that were at step 2 and moved to step 3

2. **Status not reflecting actual state**:
   - After processing, leads have `step_progression_status: 'processed'`
   - After passing, leads have `step_progression_status: 'available'` at next step
   - The UI shows "processed" for leads that should show "passed" (they left this step)

3. **Understanding what each step should show**:
   - **Action Required Step**: Show leads AT this step (any status)
   - **Completed Step**: Show leads that PASSED through this step (were at stepN, now at stepN+1)
   - **Pending Step**: Show leads AVAILABLE to enter (at previous step with passed/available status)

### Proposed Fix for getJobStep

```javascript
// Get leads for this step based on what user needs to see
if (step.status === 'completed') {
  // For completed steps: show leads that passed through this step
  // These are leads at the NEXT step that came from this step
  leadsQuery = leadsQuery
    .eq('current_step', stepNumber + 1)
    .in('step_progression_status', ['available', 'processing', 'processed', 'passed']);
} else if (step.status === 'pending') {
  // For pending steps: show leads that COULD enter this step
  // These are leads at the previous step with 'processed' or 'available' status
  if (stepNumber > 1) {
    leadsQuery = leadsQuery
      .eq('current_step', stepNumber)  // Leads already passed to this step
      .or(`current_step.eq.${stepNumber - 1},step_progression_status.eq.processed`);
  } else {
    leadsQuery = leadsQuery.eq('current_step', stepNumber);
  }
} else {
  // For action_required/in_progress: show leads at this step
  leadsQuery = leadsQuery.eq('current_step', stepNumber);
}
```

### Additional Fix: Include passed leads from current step

For `action_required` steps, the query should also include leads that were passed from this step so users can see the full picture:

```javascript
// For action_required: show leads at current step AND leads that passed
if (step.status === 'action_required') {
  // Get leads at this step OR leads that were at this step and moved to next
  const atStep = await client.from('leads').select('*')
    .eq('lead_scrape_job_id', jobId)
    .eq('current_step', stepNumber);

  const passedFromStep = await client.from('leads').select('*')
    .eq('lead_scrape_job_id', jobId)
    .eq('current_step', stepNumber + 1)
    .in('step_progression_status', ['available', 'processing', 'processed']);

  // Combine and mark the passed ones appropriately
}
```

---

## Issue 2b: Loading States Not Handled

### Current Behavior

When a lead is passed from Step 1 to Step 2:
1. Frontend calls `passLeadsToNextStep` mutation
2. Backend updates lead: `current_step: 2, step_progression_status: 'available'`
3. Backend triggers `processStep2()` in background
4. No immediate UI feedback during processing

### Expected Behavior

1. **Immediately after passing**:
   - Step 1 leads count decreases
   - Step 2 shows "1 processing..."
   - Lead appears in Step 2 with "processing" status

2. **During processing**:
   - Lead has `step_progression_status: 'processing'`
   - Spinner or loading indicator shown

3. **After processing completes**:
   - Lead status changes to "processed"
   - Step 2 leads count updates to show ready to review

### Proposed Fix

1. **Backend**: Update lead status to 'processing' before Firecrawl call:
```javascript
// In processStep2, before extraction
await client.from('leads').update({
  step_progression_status: 'processing'
}).eq('id', leadId);
```

2. **Frontend**: Add polling or WebSocket for real-time updates:
```javascript
// Poll for status changes every 5 seconds
useEffect(() => {
  if (step.status === 'in_progress') {
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }
}, [step.status]);
```

3. **UI**: Show processing indicator for leads with status "processing":
```javascript
// In LeadPreview and ScrapeJobStepDetailModal
{lead.step_progression_status === 'processing' && (
  <Loader2 className="h-3 w-3 animate-spin" />
)}
```

---

## Issue 3: Limited Column Values in ScrapeJobStepDetailModal.tsx

### Current Columns

| Column | Data Shown | Width |
|--------|-----------|-------|
| Checkbox | Selection | 10px |
| Restaurant | name + cuisine | flex |
| Location | city only | 32px |
| Rating | UberEats rating + reviews | 24px |
| Status | step_progression_status | 24px |
| Issues | validation_errors count | 20px |
| Actions | View + External link | 20px |

### Missing Data (Available on Lead)

| Field | Source | Should Show At Step |
|-------|--------|---------------------|
| `ubereats_address` | Step 2 | 2, 3, 4, 5 |
| `ubereats_price_rating` | Step 2 | 2, 3, 4, 5 |
| `phone` | Step 3 | 3, 4, 5 |
| `website_url` | Step 3 | 3, 4, 5 |
| `opening_hours_text` | Step 3 | 3, 4, 5 |
| `google_address` | Step 3 | 3, 4, 5 |
| `google_average_review_rating` | Step 3 | 3, 4, 5 |
| `instagram_url` | Step 4 | 4, 5 |
| `facebook_url` | Step 4 | 4, 5 |
| `contact_name` | Step 5 | 5 |
| `contact_email` | Step 5 | 5 |
| `contact_phone` | Step 5 | 5 |

### Proposed Solution: Expandable Row Accordion

Replace the static table rows with expandable accordion rows:

```jsx
// Each row expands to show full lead details
<TableRow>
  {/* Collapsed view - current columns */}
  <TableCell>...</TableCell>
</TableRow>
<TableRow className={cn('hidden', isExpanded && 'table-row')}>
  {/* Expanded view - all lead details */}
  <TableCell colSpan={7}>
    <LeadDetailsPanel lead={lead} />
  </TableCell>
</TableRow>
```

### LeadDetailsPanel Component Structure

```jsx
function LeadDetailsPanel({ lead }) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/20">
      {/* Section 1: Location & Business Info */}
      <div>
        <h4>Location</h4>
        <InfoField label="Address" value={lead.ubereats_address || lead.google_address} />
        <InfoField label="City" value={lead.city} />
        <InfoField label="Price" value={'$'.repeat(lead.ubereats_price_rating || 0)} />
      </div>

      {/* Section 2: Contact & Social */}
      <div>
        <h4>Contact</h4>
        <InfoField label="Phone" value={lead.phone} />
        <InfoField label="Website" value={lead.website_url} link />
        <InfoField label="Instagram" value={lead.instagram_url} link />
        <InfoField label="Facebook" value={lead.facebook_url} link />
      </div>

      {/* Section 3: Business Details */}
      <div>
        <h4>Business</h4>
        <InfoField label="Contact Person" value={lead.contact_name} />
        <InfoField label="Contact Email" value={lead.contact_email} />
        <InfoField label="Hours" value={lead.opening_hours_text} />
        <InfoField label="Google Rating" value={lead.google_average_review_rating} />
      </div>
    </div>
  );
}
```

---

## Files to Modify

| File | Changes Required |
|------|-----------------|
| `lead-scrape-service.js` | Fix `getJobStep()` lead filtering logic |
| `ScrapeJobStepList.tsx` | Fix `getLeadsDisplay()` computation, make pending steps clickable |
| `LeadPreview.tsx` | Add loading state indicators, fix status display |
| `ScrapeJobStepDetailModal.tsx` | Add expandable accordion rows with full lead details |
| `lead-scrape-firecrawl-service.js` | Update lead status to 'processing' before extraction |

---

## Implementation Priority

| Priority | Issue | Complexity | Impact |
|----------|-------|------------|--------|
| 1 | Issue 1: Leads column computation | Medium | High - affects user understanding |
| 2 | Issue 2: Lead display logic in getJobStep | High | High - affects data accuracy |
| 3 | Issue 2b: Loading states | Medium | Medium - affects UX |
| 4 | Issue 3: Expandable rows | High | Medium - nice to have |

---

## Testing Scenarios

### Scenario 1: Leads Column Accuracy
1. Create job with 20 leads
2. Process step 1 → Verify "20 ready to review"
3. Pass 10 leads → Verify Step 1 shows "10 ready to review", Step 2 shows "10 processing"
4. After processing → Step 2 shows "10 ready to review"
5. Pass all 10 → Step 2 shows "10/10 passed", Step 3 shows "10 ready"

### Scenario 2: Lead Preview Accuracy
1. Click on Step 1 leads → See all leads with correct statuses
2. Pass 5 leads to Step 2
3. View Step 1 → See 15 "processed" + 5 "passed"
4. View Step 2 → See 5 leads (processing/processed)

### Scenario 3: Loading States
1. Pass 1 lead from Step 1 to Step 2
2. Immediately see "1 processing" in Step 2
3. See lead with spinner in LeadPreview
4. After completion → Status changes to "processed"

### Scenario 4: Expandable Rows
1. Open Step 2 detail modal
2. Click on a lead row → Expands to show all details
3. Verify address, rating, cuisine visible
4. Click again → Collapses

---

## Appendix: Step Status Flow

```
Lead Created (Step 1)
  └── current_step: 1, status: 'processed'
      │
      ├── User passes to Step 2 ──────────────────────┐
      │   └── current_step: 2, status: 'available'    │
      │       │                                        │
      │       └── Processing starts                    │
      │           └── status: 'processing'             │
      │               │                                │
      │               └── Processing completes         │
      │                   └── status: 'processed'      │
      │                       │                        │
      │                       └── User passes to Step 3│
      │                           └── current_step: 3  │
      │                               status: 'available'
      │
      └── User does NOT pass
          └── Stays at current_step: 1, status: 'processed'
```

---

## Summary

The core issues stem from:

1. **Incorrect lead counting** based on stale step statistics instead of actual lead data
2. **Wrong lead filtering** in `getJobStep()` that doesn't match what users expect to see
3. **Missing loading states** during async processing
4. **Limited visibility** into lead details without opening the detail modal

All fixes should work together to provide:
- Accurate lead counts at each step
- Correct lead lists showing the right leads with right statuses
- Real-time feedback during processing
- Easy access to all lead information
