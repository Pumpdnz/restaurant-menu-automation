# Issue 2: Lead Display Logic Fix - Implementation Plan

## Document Purpose

This document provides a detailed implementation plan for fixing Issue 2 (LeadPreview.tsx displaying wrong leads) and Issue 2b (loading states not handled) from the Batch 2 fixes.

**Date**: 2025-12-07
**Status**: READY FOR IMPLEMENTATION

---

## Problem Summary

### Current Behavior
The `getJobStep()` function in `lead-scrape-service.js` uses step status to determine which leads to query:
- For `completed` steps: `gte('current_step', stepNumber + 1)` - returns ALL leads at ALL future steps
- For other steps: `eq('current_step', stepNumber)` - only returns leads AT this step

### Why This Is Wrong

1. **Completed steps show wrong leads**: A completed step 2 shows leads at steps 3, 4, AND 5 instead of just showing what passed through step 2

2. **Action_required steps miss "passed" leads**: Step 1 with 13 processed + 8 passed only shows the 13 processed leads

3. **Doesn't handle late arrivals**: When a "completed" step receives new leads later (user comes back to process remaining leads), the query logic doesn't account for this

4. **Pending steps not accessible**: Step 5 with 8 leads ready from step 4 shows "Pending" and isn't clickable

---

## Solution Overview

### Core Principle
**Query based on lead position in pipeline, not step status.** Compute display status in the frontend based on the lead's `current_step` relative to the step being viewed.

### Key Changes

1. **Backend**: Change `getJobStep()` query to `current_step >= stepNumber` (status-agnostic)
2. **Backend**: Update step status to `action_required` when new leads arrive at a `completed` step
3. **Frontend**: Compute display status based on lead position vs viewed step
4. **Frontend**: Add loading state indicators and optimistic updates

---

## File Changes

### 1. lead-scrape-service.js

**Location**: `UberEats-Image-Extractor/src/services/lead-scrape-service.js`

#### Change 1: Update `getJobStep()` query logic (lines 619-640)

**Current Code:**
```javascript
// Get leads for this step
let leadsQuery = client
  .from('leads')
  .select('*')
  .eq('lead_scrape_job_id', jobId);

if (step.status === 'completed') {
  // For completed steps, show leads that have moved past this step
  leadsQuery = leadsQuery.gte('current_step', stepNumber + 1);
} else if (step.status === 'failed') {
  // For failed steps, show all leads at this step (including failed ones)
  leadsQuery = leadsQuery.eq('current_step', stepNumber);
} else {
  // For in_progress, action_required, or pending steps, show leads at this step
  leadsQuery = leadsQuery.eq('current_step', stepNumber);
}
```

**New Code:**
```javascript
// Get leads for this step - query is STATUS-AGNOSTIC
// Always get leads at this step OR beyond (to show both current and passed)
// Frontend will compute display status based on lead.current_step vs stepNumber
let leadsQuery = client
  .from('leads')
  .select('*')
  .eq('lead_scrape_job_id', jobId)
  .gte('current_step', stepNumber);

// Note: Display status computed in frontend:
// - lead.current_step > stepNumber → display as "passed"
// - lead.current_step === stepNumber → display actual step_progression_status
```

#### Change 2: Update `passLeadsToNextStep()` to transition completed→action_required (around line 860)

**Current Code:**
```javascript
// Update next step - set to action_required if it was pending
await client
  .from('lead_scrape_job_steps')
  .update({
    leads_received: (nextStep?.leads_received || 0) + passedCount,
    status: nextStep?.status === 'pending' ? 'action_required' : nextStep?.status,
    updated_at: new Date().toISOString()
  })
  .eq('job_id', step.job_id)
  .eq('step_number', nextStepNumber);
```

**New Code:**
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

### 2. LeadPreview.tsx

**Location**: `UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx`

#### Change 1: Add display status computation helper (after line 58)

**Add new helper function:**
```typescript
// Compute display status based on lead position relative to viewed step
const getDisplayStatus = (lead: Lead, viewingStepNumber: number): string => {
  if (lead.current_step > viewingStepNumber) {
    return 'passed';  // Lead has moved beyond this step
  }
  return lead.step_progression_status;  // Actual status at this step
};
```

#### Change 2: Update status colors to include computed "passed" (line 43-49)

**Current Code:**
```typescript
const statusColors: Record<string, string> = {
  available: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  processed: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};
```

**No change needed** - "passed" is already defined.

#### Change 3: Update status badge to use computed status (around line 336-341)

**Current Code:**
```typescript
<Badge
  variant="outline"
  className={cn('text-xs capitalize shrink-0', statusColors[lead.step_progression_status])}
>
  {lead.step_progression_status}
</Badge>
```

**New Code:**
```typescript
{(() => {
  const displayStatus = getDisplayStatus(lead, step.step_number);
  return (
    <Badge
      variant="outline"
      className={cn('text-xs capitalize shrink-0', statusColors[displayStatus])}
    >
      {displayStatus}
    </Badge>
  );
})()}
```

#### Change 4: Update row backgrounds to use computed status (around line 282-285)

**Current Code:**
```typescript
className={cn(
  'flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors',
  rowBackgrounds[lead.step_progression_status]
)}
```

**New Code:**
```typescript
className={cn(
  'flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors',
  rowBackgrounds[getDisplayStatus(lead, step.step_number)]
)}
```

#### Change 5: Update status counts to use computed status (line 155-161)

**Current Code:**
```typescript
const statusCounts = leads.reduce(
  (acc, lead) => {
    acc[lead.step_progression_status] = (acc[lead.step_progression_status] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);
```

**New Code:**
```typescript
const statusCounts = leads.reduce(
  (acc, lead) => {
    const displayStatus = getDisplayStatus(lead, step.step_number);
    acc[displayStatus] = (acc[displayStatus] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);
```

#### Change 6: Update selectable leads filter (line 104-106 and 149-151)

**Current Code:**
```typescript
const selectableLeads = leads.filter(
  (l) => l.step_progression_status !== 'passed' && l.step_progression_status !== 'processing'
);
```

**New Code:**
```typescript
const selectableLeads = leads.filter((l) => {
  const displayStatus = getDisplayStatus(l, step.step_number);
  return displayStatus !== 'passed' && displayStatus !== 'processing';
});
```

#### Change 7: Update checkbox disabled logic (around line 291-294)

**Current Code:**
```typescript
disabled={
  lead.step_progression_status === 'passed' ||
  lead.step_progression_status === 'processing'
}
```

**New Code:**
```typescript
disabled={(() => {
  const displayStatus = getDisplayStatus(lead, step.step_number);
  return displayStatus === 'passed' || displayStatus === 'processing';
})()}
```

---

### 3. ScrapeJobStepDetailModal.tsx

**Location**: `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx`

#### Change 1: Add display status computation helper (after line 99)

**Add new helper function:**
```typescript
// Compute display status based on lead position relative to viewed step
const getDisplayStatus = (lead: Lead, viewingStepNumber: number): string => {
  if (lead.current_step > viewingStepNumber) {
    return 'passed';  // Lead has moved beyond this step
  }
  return lead.step_progression_status;  // Actual status at this step
};
```

#### Change 2: Update status counts computation (line 352-360)

**Current Code:**
```typescript
const statusCounts = useMemo(() => {
  return leads.reduce(
    (acc, lead) => {
      acc[lead.step_progression_status] = (acc[lead.step_progression_status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}, [leads]);
```

**New Code:**
```typescript
const statusCounts = useMemo(() => {
  if (!step) return {};
  return leads.reduce(
    (acc, lead) => {
      const displayStatus = getDisplayStatus(lead, step.step_number);
      acc[displayStatus] = (acc[displayStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}, [leads, step]);
```

#### Change 3: Update selectable leads filter (line 262-264)

**Current Code:**
```typescript
const selectableLeads = filteredLeads.filter(
  (l) => l.step_progression_status !== 'passed' && l.step_progression_status !== 'processing'
);
```

**New Code:**
```typescript
const selectableLeads = filteredLeads.filter((l) => {
  if (!step) return false;
  const displayStatus = getDisplayStatus(l, step.step_number);
  return displayStatus !== 'passed' && displayStatus !== 'processing';
});
```

#### Change 4: Update row background class (around line 587-591)

**Current Code:**
```typescript
className={cn(
  'cursor-pointer',
  rowBackgrounds[lead.step_progression_status],
  selectedLeadIds.has(lead.id) && 'bg-blue-50',
  expandedLeadIds.has(lead.id) && 'border-b-0'
)}
```

**New Code:**
```typescript
className={cn(
  'cursor-pointer',
  step && rowBackgrounds[getDisplayStatus(lead, step.step_number)],
  selectedLeadIds.has(lead.id) && 'bg-blue-50',
  expandedLeadIds.has(lead.id) && 'border-b-0'
)}
```

#### Change 5: Update status badge display (around line 661-670)

**Current Code:**
```typescript
<Badge
  variant="outline"
  className={cn(
    'text-xs capitalize',
    statusColors[lead.step_progression_status]
  )}
>
  {lead.step_progression_status}
</Badge>
```

**New Code:**
```typescript
{(() => {
  const displayStatus = step ? getDisplayStatus(lead, step.step_number) : lead.step_progression_status;
  return (
    <Badge
      variant="outline"
      className={cn('text-xs capitalize', statusColors[displayStatus])}
    >
      {displayStatus}
    </Badge>
  );
})()}
```

#### Change 6: Update checkbox disabled state (around line 612-615)

**Current Code:**
```typescript
disabled={
  lead.step_progression_status === 'passed' ||
  lead.step_progression_status === 'processing'
}
```

**New Code:**
```typescript
disabled={(() => {
  if (!step) return true;
  const displayStatus = getDisplayStatus(lead, step.step_number);
  return displayStatus === 'passed' || displayStatus === 'processing';
})()}
```

---

### 4. ScrapeJobStepList.tsx

**Location**: `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepList.tsx`

#### Change 1: Update LeadsWrapper condition to include pending steps with leads_received (line 127)

**Current Code:**
```typescript
if (step.leads_received > 0 || step.leads_processed > 0) {
```

**No change needed** - This already handles the case correctly. The pending step will be clickable if `leads_received > 0`.

---

## Issue 2b: Loading States

### Changes for Real-Time Feedback

#### 1. Add processing indicator to status counts in LeadPreview.tsx (around line 179-195)

**Add after existing status badges:**
```typescript
{statusCounts.processing && (
  <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
    <Loader2 className="h-3 w-3 animate-spin" />
    {statusCounts.processing} processing
  </Badge>
)}
```

#### 2. Add optimistic update to usePassLeadsToNextStep in useLeadScrape.ts

**Current Code (around line 360-381):**
```typescript
export function usePassLeadsToNextStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, leadIds }: { stepId: string; leadIds: string[] }) => {
      const response = await api.post(`/lead-scrape-jobs/steps/${stepId}/pass-leads`, {
        lead_ids: leadIds,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      toast.success('Leads passed to next step');
    },
    // ...
  });
}
```

**New Code:**
```typescript
export function usePassLeadsToNextStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, leadIds }: { stepId: string; leadIds: string[] }) => {
      const response = await api.post(`/lead-scrape-jobs/steps/${stepId}/pass-leads`, {
        lead_ids: leadIds,
      });
      return response.data;
    },
    onMutate: async ({ stepId, leadIds }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['step-leads'] });

      // Snapshot previous value (for rollback on error)
      const previousData = queryClient.getQueriesData({ queryKey: ['step-leads'] });

      // Optimistically update leads to show as "processing"
      // (They'll actually be "available" at next step, but we show processing during transition)
      queryClient.setQueriesData({ queryKey: ['step-leads'] }, (old: any) => {
        if (!old?.leads) return old;
        return {
          ...old,
          leads: old.leads.map((lead: Lead) =>
            leadIds.includes(lead.id)
              ? { ...lead, step_progression_status: 'processing' }
              : lead
          )
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error('Failed to pass leads', {
        description: err.response?.data?.error || err.message,
      });
    },
    onSuccess: () => {
      // Invalidate all relevant queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      queryClient.invalidateQueries({ queryKey: ['step-leads'] });
      toast.success('Leads passed to next step');
    },
  });
}
```

#### 3. Reduce refetch interval during active processing

**In useStepLeads (around line 574-584):**

```typescript
export function useStepLeads(jobId: string, stepNumber: number, options?: { enabled?: boolean }) {
  return useQuery<{ success: boolean; step: LeadScrapeJobStep; leads: Lead[] }>({
    queryKey: ['step-leads', jobId, stepNumber],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}/steps/${stepNumber}`);
      return response.data;
    },
    enabled: !!jobId && stepNumber > 0 && (options?.enabled !== false),
    refetchInterval: (query) => {
      // Faster polling if there are leads being processed
      const hasProcessingLeads = query.state.data?.leads?.some(
        (l: Lead) => l.step_progression_status === 'processing'
      );
      return hasProcessingLeads ? 3000 : 10000; // 3s during processing, 10s otherwise
    },
  });
}
```

---

## Testing Scenarios

### Scenario 1: Basic Lead Display Across Steps

**Setup:**
- 21 leads at step 1
- 8 passed through all steps (at step 5, status: 'passed')
- 13 remain at step 1 (status: 'processed')

**Expected Results:**

| Step | View Should Show |
|------|-----------------|
| Step 1 | 21 leads: 13 "processed" + 8 "passed" |
| Step 2 | 8 leads: all "passed" |
| Step 3 | 8 leads: all "passed" |
| Step 4 | 8 leads: all "passed" |
| Step 5 | 8 leads: all "passed" (actual status) |

### Scenario 2: Late Arrival at Completed Step

**Setup:**
- Same as Scenario 1
- User passes 5 more leads from step 1 to step 2

**Expected Results:**

| Step | View Should Show |
|------|-----------------|
| Step 1 | 16 leads: 8 "processed" + 8 "passed" |
| Step 2 | 13 leads: 5 "available" + 8 "passed" |
| Step 2 Status | Should change from "completed" to "action_required" |

### Scenario 3: Mixed States at Single Step

**Setup:**
- Step 2 has:
  - 3 leads with status "available" (just arrived)
  - 2 leads with status "processing" (being extracted)
  - 4 leads with status "processed" (ready to pass)
  - 6 leads that passed to step 3 (current_step: 3)

**Expected Results:**
- Step 2 shows 15 leads total
- Status counts: 3 available, 2 processing, 4 processed, 6 passed
- Only available, processed, and failed leads are selectable
- Processing leads show spinner indicator

### Scenario 4: Pending Step with Available Leads

**Setup:**
- Step 4 has 8 processed leads
- Step 5 status is "pending"
- User passes 8 leads from step 4 to step 5

**Expected Results:**
- Step 5 status changes to "action_required"
- Step 5 shows 8 leads with "available" status
- Step 5 is clickable in ScrapeJobStepList

### Scenario 5: Loading State During Pass

**Setup:**
- User selects 3 leads at step 2
- User clicks "Pass to Next"

**Expected Results:**
1. Immediately: Selected leads show "processing" status (optimistic update)
2. 0-3 seconds: Status changes to reflect actual backend state
3. Step 3 count updates to show new leads received

---

## Implementation Order

1. **Backend Changes First**
   - Update `getJobStep()` query logic
   - Update `passLeadsToNextStep()` step status transition

2. **Frontend Display Logic**
   - Add `getDisplayStatus()` helper to LeadPreview.tsx
   - Add `getDisplayStatus()` helper to ScrapeJobStepDetailModal.tsx
   - Update all status references to use computed status

3. **Loading State Improvements**
   - Add optimistic updates to usePassLeadsToNextStep
   - Add dynamic refetch interval to useStepLeads
   - Add processing count badge to headers

4. **Testing**
   - Test each scenario above
   - Verify step status transitions work correctly
   - Verify loading states provide immediate feedback

---

## Rollback Plan

If issues arise after deployment:

1. **Backend**: Revert `getJobStep()` to status-based query
2. **Backend**: Remove completed→action_required transition
3. **Frontend**: Remove `getDisplayStatus()` helper, use raw status

All changes are isolated and can be reverted independently.

---

## Summary

| Component | Change | Risk Level |
|-----------|--------|------------|
| lead-scrape-service.js | Query logic + step status | Medium |
| LeadPreview.tsx | Display status computation | Low |
| ScrapeJobStepDetailModal.tsx | Display status computation | Low |
| useLeadScrape.ts | Optimistic updates + polling | Medium |

**Total Files Modified**: 4
**Estimated Implementation Time**: 1-2 hours
**Testing Time**: 30 minutes
