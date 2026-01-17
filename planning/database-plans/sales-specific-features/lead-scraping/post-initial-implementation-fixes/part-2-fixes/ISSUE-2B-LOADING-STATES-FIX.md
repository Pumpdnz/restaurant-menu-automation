# Issue 2b: Loading States Fix

## Problem Statement

When leads are passed from one step to the next, there was no immediate visual feedback during the processing phase. Users had to wait up to 10 seconds (the default refetch interval) before seeing status updates.

### Symptoms
- No indication when leads are actively being processed
- Leads count in step list didn't update immediately after passing
- No "processing" status visible in LeadPreview or ScrapeJobStepDetailModal headers
- Users couldn't manually refresh to see current state

---

## Solution Implemented

### 1. Optimistic Updates for usePassLeadsToNextStep

**File**: `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

Added `onMutate` handler that immediately updates lead status to "processing" before server response:

```typescript
onMutate: async ({ leadIds, jobId, stepNumber }) => {
  // Cancel outgoing refetches to avoid overwriting optimistic update
  await queryClient.cancelQueries({ queryKey: ['step-leads'] });

  // Snapshot previous value for rollback
  const previousData = jobId && stepNumber
    ? queryClient.getQueryData(['step-leads', jobId, stepNumber])
    : null;

  // Optimistically update leads to show 'processing' status
  if (jobId && stepNumber) {
    queryClient.setQueryData(
      ['step-leads', jobId, stepNumber],
      (old: any) => ({
        ...old,
        leads: old.leads.map((lead: Lead) =>
          leadIds.includes(lead.id)
            ? { ...lead, step_progression_status: 'processing' }
            : lead
        ),
      })
    );
  }

  return { previousData, jobId, stepNumber };
},
```

Added `onError` handler for rollback on failure:

```typescript
onError: (error: any, _variables, context) => {
  if (context?.previousData && context.jobId && context.stepNumber) {
    queryClient.setQueryData(
      ['step-leads', context.jobId, context.stepNumber],
      context.previousData
    );
  }
  toast.error('Failed to pass leads', { ... });
},
```

### 2. Improved Query Invalidation

**File**: `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

Added comprehensive invalidation in `onSuccess` and `onSettled`:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
  queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
  queryClient.invalidateQueries({ queryKey: ['step-leads'] });
  toast.success('Leads passed to next step');
},
onSettled: () => {
  // Always refetch after mutation settles
  queryClient.invalidateQueries({ queryKey: ['step-leads'] });
},
```

### 3. Dynamic Refetch Interval

**File**: `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

Changed `useStepLeads` to use dynamic refetch interval - faster when processing:

```typescript
refetchInterval: (query) => {
  const hasProcessingLeads = query.state.data?.leads?.some(
    (l: Lead) => l.step_progression_status === 'processing'
  );
  return hasProcessingLeads ? 3000 : 10000; // 3s when processing, 10s otherwise
},
```

### 4. Processing Count in Headers

**Files**:
- `UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx`
- `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx`

Added processing count badge with animated spinner:

```tsx
{statusCounts.processing && (
  <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
    <Loader2 className="h-2.5 w-2.5 animate-spin" />
    {statusCounts.processing} processing
  </Badge>
)}
```

### 5. Manual Refresh Button

**File**: `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`

Added refresh button to CardFooter for immediate manual refresh:

```tsx
const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  try {
    if (onRefresh) await onRefresh();
  } finally {
    setTimeout(() => setIsRefreshing(false), 500);
  }
};

// In CardFooter:
<Button
  variant="outline"
  size="sm"
  onClick={handleRefresh}
  disabled={isRefreshing}
>
  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
  Refresh
</Button>
```

### 6. Updated Mutation Calls

**Files**:
- `UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx`
- `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx`

Updated `handlePassLeads` to pass required params for optimistic updates:

```typescript
await passLeadsMutation.mutateAsync({
  stepId: step.id,
  leadIds: Array.from(selectedLeadIds),
  jobId,                    // Added
  stepNumber: step.step_number,  // Added
});
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useLeadScrape.ts` | Added optimistic updates, improved invalidation, dynamic refetch interval |
| `src/components/leads/LeadPreview.tsx` | Added processing badge, pass jobId/stepNumber to mutation |
| `src/components/leads/ScrapeJobStepDetailModal.tsx` | Added processing badge, pass jobId/stepNumber to mutation |
| `src/components/leads/ScrapeJobProgressCard.tsx` | Added manual refresh button |

---

## Expected Behavior After Fix

### When User Clicks "Pass to Next Step":

1. **Immediately (0ms)**:
   - Selected leads change to "processing" status (optimistic update)
   - Processing count badge appears in header with spinner
   - Checkboxes on processing leads become disabled

2. **Server Response (~500-2000ms)**:
   - Query invalidation triggers refetch
   - Actual server state replaces optimistic state
   - Leads move to next step with "available" status

3. **During Processing**:
   - Refetch interval reduced to 3 seconds (from 10s)
   - Processing badge shows current count
   - Manual refresh available if needed

4. **On Error**:
   - Automatic rollback to previous state
   - Error toast displayed
   - Leads return to their prior status

---

## Testing Checklist

- [ ] Pass leads from Step 1 to Step 2 - verify immediate "processing" status
- [ ] Verify processing count badge appears with spinner
- [ ] Verify checkboxes disabled for processing leads
- [ ] Verify automatic refetch after 3 seconds during processing
- [ ] Verify manual refresh button works
- [ ] Verify rollback on network error
- [ ] Verify state updates correctly after processing completes

---

## Date Completed

2025-12-07
