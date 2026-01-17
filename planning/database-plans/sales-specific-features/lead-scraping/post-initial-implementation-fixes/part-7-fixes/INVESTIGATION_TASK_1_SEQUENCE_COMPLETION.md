# Investigation Task 1: Sequence Completion Handling

**Date**: 2025-12-20
**Status**: COMPLETED

---

## How Sequence Completion is Detected

### Immediate Success Detection
- The `BulkStartSequenceModal` uses `useBulkStartSequence()` hook which returns a mutation
- Upon successful completion, the mutation returns `BulkOperationResult` containing:
  - `succeeded[]` - list of successfully started sequences with instance IDs
  - `failed[]` - list of failed sequences with error details
  - `summary` - total count and success/failure counts

### State Management Flow
```
handleStart()
→ bulkStartMutation.mutateAsync()
→ setOperationResult(result)
→ setOperationComplete(true)
→ Display results in modal UI
```

### Completion Indicators
- `operationComplete` state flag (line 105)
- `operationResult` contains full operation details (line 104)
- Modal transitions to "results" view showing success/failure breakdown

---

## Current onClose/onSuccess Patterns

### BulkStartSequenceModal (lines 200-202)
- Only has `onClose` callback - simple closure function
- No `onSuccess` callback provided
- Modal handles its own result state internally
- Parent just calls `setBulkStartOpen(false)` on close

### StartSequenceModal (lines 32-34)
- Also only has `onClose` callback
- Calls `onClose()` immediately after successful mutation (line 100)
- Success/failure handled via toast notifications only

### useBulkStartSequence Hook (lines 606-636)
- Has `onSuccess` handler that invalidates React Query caches
- Does NOT allow custom callbacks to be passed
- Success toast handled in component, not in hook
- Invalidates: `sequence-instances`, `tasks`, and `restaurant-sequences`

### PendingLeadsTable Usage (lines 888-895)
- Opens BulkStartSequenceModal after successful conversion
- Passes `convertedRestaurants` array as restaurants
- Closes modal on `onClose()` but has no post-sequence action
- No extraction triggering currently implemented

---

## Recommended Approach for Triggering Extractions After Sequence Completion

### Option 1: Extend BulkStartSequenceModal Props (RECOMMENDED)
```typescript
interface BulkStartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: BulkOperationResult) => void;
  restaurants: Restaurant[];
}

// In handleStart (after setOperationComplete(true)):
if (onSuccess) {
  onSuccess(result);
}
```

### Option 2: Return Result via Callback
```typescript
interface BulkStartSequenceModalProps {
  open: boolean;
  onClose: (result?: BulkOperationResult) => void;
  restaurants: Restaurant[];
}

// In handleClose (line 201):
const handleClose = () => {
  if (operationComplete && operationResult) {
    onClose(operationResult);
  } else {
    onClose();
  }
};
```

### Option 3: Extract to Parent State (Current Pattern)
Since BulkStartSequenceModal already returns data via the mutation, you could:
- Have parent component create the mutation
- Pass mutation state down to modal
- Handle success in parent after modal closes

---

## Code Snippets Showing Relevant Callback Patterns

### Pattern 1: useStartSequence Success Handling
```typescript
// From useStartSequence hook (lines 582-604)
return useMutation({
  mutationFn: async (data: StartSequenceRequest) => {
    const response = await api.post('/sequence-instances', data);
    return response.data.data;
  },
  onSuccess: (data, variables) => {
    queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
    queryClient.invalidateQueries({ queryKey: ['restaurant-sequences', variables.restaurant_id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    toast.success('Sequence started successfully', {
      description: `Created ${data.tasks_created} tasks`,
    });
  },
});
```

### Pattern 2: useBulkStartSequence Success Handling
```typescript
// From useBulkStartSequence hook (lines 606-636)
return useMutation({
  mutationFn: async (data: BulkStartSequenceRequest) => {
    const response = await api.post('/sequence-instances/bulk', data);
    return response.data.data as BulkStartSequenceResult;
  },
  onSuccess: (data, variables) => {
    queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    variables.restaurant_ids.forEach(restaurantId => {
      queryClient.invalidateQueries({
        queryKey: ['restaurant-sequences', restaurantId]
      });
    });
  },
});
```

### Pattern 3: PendingLeadsTable Conversion + Sequence Flow
```typescript
// Current implementation (lines 358-429)
const handleConvertSelected = async () => {
  // ... conversion logic ...

  // Capture converted restaurants
  const successfulConversions = results
    .filter(r => r.success && r.restaurantId)
    .map(r => ({
      id: r.restaurantId!,
      name: r.restaurantName,
      lead_stage: 'uncontacted',
      lead_warmth: 'frozen',
      lead_status: 'inactive'
    }));
  setConvertedRestaurants(successfulConversions);

  // Open sequence modal
  setIsSequenceModalOpen(true);

  // MISSING: No onSuccess callback to trigger extractions
};
```

---

## Key Findings

1. **Completion is Synchronous**: The modal receives the full result immediately upon mutation completion
2. **No Current Post-Action Pattern**: BulkStartSequenceModal only has `onClose`, no success callback
3. **Cache Invalidation Exists**: The hook invalidates necessary queries automatically
4. **Extraction API Available**: `/lead-scrape-jobs/{jobId}/extract/{stepNumber}` endpoint exists
5. **Parent Control Needed**: Parent component (PendingLeadsTable) should handle post-sequence extraction logic

---

## Implementation Steps

To chain extractions after sequence completion:

1. Add `onSuccess` prop to `BulkStartSequenceModalProps`
2. Call `onSuccess(result)` after `setOperationComplete(true)` in `handleStart`
3. In PendingLeadsTable, create `handleSequenceSuccess` callback that:
   - Extracts successfully started sequence data
   - Triggers appropriate extraction for each restaurant
   - Closes modal after starting extractions

This maintains separation of concerns and allows the modal to remain reusable while enabling post-sequence actions in parent components.
