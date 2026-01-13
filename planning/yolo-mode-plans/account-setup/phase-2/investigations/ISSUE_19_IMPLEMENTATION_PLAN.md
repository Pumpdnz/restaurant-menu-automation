# Issue 19: Sequence Enrollment Integration - Implementation Plan

## Overview

This implementation plan integrates sequence management functionality into the Registration Batch Detail page, enabling users to:
1. View and manage sequences directly in the batch view
2. Perform full task management (status, priority, due date, completion actions)
3. Select multiple restaurants for bulk sequence operations
4. Recreate sequences to regenerate tasks with updated restaurant data

**Status:** ✅ 100% Complete
**Estimated Complexity:** Medium-High (4-6 hours)
**Dependencies:** None (all patterns exist in codebase)

---

## Implementation Progress (Updated: 2024-12-28)

### ✅ Completed

| Phase | Item | Status |
|-------|------|--------|
| Phase 1 | `recreateSequence()` service function | ✅ Complete |
| Phase 1 | `recreateSequenceBulk()` service function | ✅ Complete |
| Phase 1 | `getSequencesByRestaurantIds()` service function | ✅ Complete |
| Phase 1 | 3 new API routes added | ✅ Complete |
| Phase 2 | `useRegistrationBatchSequences` hook | ✅ Complete |
| Phase 2 | `useRecreateSequence` hook | ✅ Complete |
| Phase 2 | `useRecreateSequenceBulk` hook | ✅ Complete |
| Phase 3 | Selection state with checkboxes | ✅ Complete |
| Phase 3 | Batch actions bar (Start/Recreate) | ✅ Complete |
| Phase 3 | SequenceProgressCard integration | ✅ Complete |
| Phase 3 | Recreate confirmation dialog | ✅ Complete |
| Phase 3 | Single/Bulk Start Sequence modals | ✅ Complete |
| Extra | Recreate button in SequenceProgressCard | ✅ Complete |
| Extra | Recreate sequence in RestaurantDetail.jsx | ✅ Complete |
| Bug Fix | "Finish & Set Follow-up" on sequence opens CreateTaskModal | ✅ Fixed |
| Bug Fix | "Complete & Set Follow-up" on task opens CreateTaskModal | ✅ Fixed |
| Extra | Hide registration progress for completed restaurants | ✅ Complete |

---

## Investigation Summary

### Task 1: Sequence UI Components
- **SequenceProgressCard** requires 10 callback props for full functionality
- **SequenceTaskList** handles all task operations with TaskTypeQuickView integration
- Components are self-contained and can be imported directly
- RestaurantDetail.jsx (lines 5176-5194) provides the integration pattern

### Task 2: Data Fetching
- **Recommended: Option C (Batch Fetch)** - New endpoint to fetch sequences for multiple restaurants
- Avoids N+1 problem (2 API calls vs 11+ for 10 restaurants)
- No changes to existing `getRegistrationBatchJob()` needed
- New hook: `useRegistrationBatchSequences(restaurantIds)`

### Task 3: Task Management
- All task operations work through existing API endpoints
- Components can be reused as-is with callback wiring
- State refresh via `onRefresh` callback pattern
- API endpoints: `PATCH /tasks/:id`, `PATCH /tasks/:id/complete`, `PATCH /tasks/:id/cancel`

### Task 4: Recreate Sequences Backend
- Stores `sequence_template_id` in each instance (available for recreation)
- Delete flow removes instance + all tasks
- New endpoints: `POST /sequence-instances/:id/recreate`, `POST /sequence-instances/bulk-recreate`
- Reuses existing `startSequence()` and `deleteSequenceInstance()` logic

### Task 5: Batch Selection UX
- **Recommended: Set-based selection** with floating action bar above table
- Pattern from YoloConfigBatchView (checkboxes, All/None buttons)
- Action bar shows: "Start Sequences" (no sequences) + "Recreate Sequences" (has sequences)
- Existing BulkStartSequenceModal can be reused

---

## Implementation Steps

### Phase 1: Backend - Recreate Sequences Feature

#### Step 1.1: Add Recreate Service Functions
**File:** `UberEats-Image-Extractor/src/services/sequence-instances-service.js`

```javascript
/**
 * Recreate a sequence - deletes existing and starts fresh from same template
 * @param {string} instanceId - Existing sequence instance ID
 * @returns {Promise<object>} New sequence instance
 */
async function recreateSequence(instanceId) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // 1. Get existing instance to retrieve template_id and restaurant_id
  const { data: existingInstance, error: fetchError } = await client
    .from('sequence_instances')
    .select('id, sequence_template_id, restaurant_id, status')
    .eq('id', instanceId)
    .eq('organisation_id', orgId)
    .single();

  if (fetchError || !existingInstance) {
    throw new Error('Sequence instance not found');
  }

  const { sequence_template_id, restaurant_id } = existingInstance;

  // 2. Delete existing instance and tasks
  // Delete tasks first
  await client
    .from('tasks')
    .delete()
    .eq('sequence_instance_id', instanceId);

  // Delete instance
  await client
    .from('sequence_instances')
    .delete()
    .eq('id', instanceId);

  // 3. Start new sequence from same template (uses fresh restaurant data)
  const newInstance = await startSequence(sequence_template_id, restaurant_id);

  return {
    ...newInstance,
    recreated_from: instanceId
  };
}

/**
 * Bulk recreate sequences for multiple instances
 * @param {string[]} instanceIds - Array of instance IDs to recreate
 * @returns {Promise<object>} Bulk operation results
 */
async function recreateSequenceBulk(instanceIds) {
  if (!instanceIds || instanceIds.length === 0) {
    throw new Error('At least one instance_id is required');
  }

  if (instanceIds.length > 100) {
    throw new Error('Maximum 100 instances per bulk operation');
  }

  const results = {
    succeeded: [],
    failed: [],
    summary: { total: instanceIds.length, success: 0, failure: 0 }
  };

  for (const instanceId of instanceIds) {
    try {
      const newInstance = await recreateSequence(instanceId);
      results.succeeded.push({
        original_instance_id: instanceId,
        new_instance_id: newInstance.id,
        restaurant_id: newInstance.restaurant_id,
        tasks_created: newInstance.tasks_created
      });
    } catch (error) {
      results.failed.push({
        instance_id: instanceId,
        error: error.message
      });
    }
  }

  results.summary.success = results.succeeded.length;
  results.summary.failure = results.failed.length;

  return results;
}

// Add to module.exports
module.exports = {
  // ... existing exports
  recreateSequence,
  recreateSequenceBulk,
};
```

#### Step 1.2: Add Batch Fetch Service Function
**File:** `UberEats-Image-Extractor/src/services/sequence-instances-service.js`

```javascript
/**
 * Get sequences for multiple restaurants in one query
 * @param {string[]} restaurantIds - Array of restaurant IDs
 * @returns {Promise<Record<string, SequenceInstance[]>>} Map of restaurant_id to sequences
 */
async function getSequencesByRestaurantIds(restaurantIds) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  if (!restaurantIds || restaurantIds.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from('sequence_instances')
    .select(`
      *,
      sequence_templates (id, name),
      restaurants (id, name),
      tasks (
        id, name, description, type, status, priority,
        due_date, sequence_step_order, completed_at,
        message, message_rendered, subject_line, subject_line_rendered,
        restaurants (
          id, name, contact_name, contact_email, contact_phone,
          email, phone, instagram_url, facebook_url
        )
      )
    `)
    .eq('organisation_id', orgId)
    .in('restaurant_id', restaurantIds)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sequences by restaurant IDs:', error);
    throw error;
  }

  // Group by restaurant_id
  const grouped = {};
  for (const instance of data || []) {
    const rid = instance.restaurant_id;
    if (!grouped[rid]) {
      grouped[rid] = [];
    }

    // Calculate progress
    const tasks = instance.tasks || [];
    const completed = tasks.filter(t => t.status === 'completed').length;
    instance.progress = {
      completed,
      total: tasks.length,
      percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
    };

    grouped[rid].push(instance);
  }

  return grouped;
}

// Add to module.exports
module.exports = {
  // ... existing exports
  getSequencesByRestaurantIds,
};
```

#### Step 1.3: Add API Routes
**File:** `UberEats-Image-Extractor/src/routes/sequence-instances-routes.js`

```javascript
// Add these routes

// Recreate single sequence
router.post('/:id/recreate', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sequenceInstancesService.recreateSequence(id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error recreating sequence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk recreate sequences
router.post('/bulk-recreate', async (req, res) => {
  try {
    const { instance_ids } = req.body;
    const result = await sequenceInstancesService.recreateSequenceBulk(instance_ids);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error bulk recreating sequences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sequences for multiple restaurants
router.get('/batch/restaurants', async (req, res) => {
  try {
    const { restaurant_ids } = req.query;
    const ids = restaurant_ids ? restaurant_ids.split(',') : [];
    const result = await sequenceInstancesService.getSequencesByRestaurantIds(ids);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching batch sequences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### Phase 2: Frontend - React Query Hooks

#### Step 2.1: Add Sequence Hooks
**File:** `UberEats-Image-Extractor/src/hooks/useSequences.ts`

Add these new hooks at the end of the file:

```typescript
// Batch fetch sequences for multiple restaurants
export function useRegistrationBatchSequences(
  restaurantIds: string[],
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false && restaurantIds.length > 0;

  return useQuery<{ success: boolean; data: Record<string, SequenceInstance[]> }>({
    queryKey: ['registration-batch-sequences', restaurantIds.sort().join(',')],
    queryFn: async () => {
      const response = await api.get(
        `/sequence-instances/batch/restaurants?restaurant_ids=${restaurantIds.join(',')}`
      );
      return response.data;
    },
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
}

// Recreate single sequence
export function useRecreateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await api.post(`/sequence-instances/${instanceId}/recreate`);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['registration-batch-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sequence recreated successfully', {
        description: `Created ${data.tasks_created} tasks with updated data`,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to recreate sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

// Bulk recreate sequences
export interface BulkRecreateResult {
  succeeded: {
    original_instance_id: string;
    new_instance_id: string;
    restaurant_id: string;
    tasks_created: number;
  }[];
  failed: {
    instance_id: string;
    error: string;
  }[];
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}

export function useRecreateSequenceBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceIds: string[]) => {
      const response = await api.post('/sequence-instances/bulk-recreate', {
        instance_ids: instanceIds,
      });
      return response.data.data as BulkRecreateResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['registration-batch-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      if (data.summary.failure === 0) {
        toast.success('All sequences recreated successfully!');
      } else if (data.summary.success === 0) {
        toast.error('All sequences failed to recreate');
      } else {
        toast.warning(`${data.summary.success} recreated, ${data.summary.failure} failed`);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to recreate sequences', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}
```

---

### Phase 3: Frontend - RegistrationBatchDetail Integration

#### Step 3.1: Add Imports
**File:** `UberEats-Image-Extractor/src/pages/RegistrationBatchDetail.tsx`

```typescript
// Add these imports at the top
import { Checkbox } from '../components/ui/checkbox';
import { SequenceProgressCard } from '../components/sequences/SequenceProgressCard';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import { BulkStartSequenceModal } from '../components/sequences/BulkStartSequenceModal';
import {
  useRegistrationBatchSequences,
  usePauseSequence,
  useResumeSequence,
  useCancelSequence,
  useFinishSequence,
  useDeleteSequenceInstance,
  useRecreateSequenceBulk,
  SequenceInstance,
} from '../hooks/useSequences';
```

#### Step 3.2: Add State and Hooks in Main Component

```typescript
// Inside RegistrationBatchDetail component, add:

// Selection state
const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

// Modal states
const [startSequenceModalOpen, setStartSequenceModalOpen] = useState(false);
const [bulkStartSequenceModalOpen, setBulkStartSequenceModalOpen] = useState(false);
const [recreateConfirmOpen, setRecreateConfirmOpen] = useState(false);

// For single restaurant sequence start
const [selectedRestaurantForSequence, setSelectedRestaurantForSequence] = useState<{
  id: string;
  name: string;
} | null>(null);

// Fetch sequences for all restaurants in batch
const restaurantIds = useMemo(() => jobs.map(j => j.restaurant_id), [jobs]);
const { data: sequencesData, refetch: refetchSequences } = useRegistrationBatchSequences(
  restaurantIds,
  { enabled: batch?.status === 'completed' || jobs.some(j => j.status === 'completed') }
);

// Sequence mutations
const pauseSequenceMutation = usePauseSequence();
const resumeSequenceMutation = useResumeSequence();
const cancelSequenceMutation = useCancelSequence();
const finishSequenceMutation = useFinishSequence();
const deleteSequenceMutation = useDeleteSequenceInstance();
const recreateSequencesMutation = useRecreateSequenceBulk();

// Helper: get sequences for a restaurant
const getSequencesForRestaurant = useCallback((restaurantId: string): SequenceInstance[] => {
  return sequencesData?.data?.[restaurantId] || [];
}, [sequencesData]);

// Selection helpers
const selectedJobs = useMemo(() =>
  jobs.filter(j => selectedJobIds.has(j.id)),
  [jobs, selectedJobIds]
);

const selectedWithSequences = useMemo(() =>
  selectedJobs.filter(j => getSequencesForRestaurant(j.restaurant_id).length > 0),
  [selectedJobs, getSequencesForRestaurant]
);

const selectedWithoutSequences = useMemo(() =>
  selectedJobs.filter(j => getSequencesForRestaurant(j.restaurant_id).length === 0),
  [selectedJobs, getSequencesForRestaurant]
);

const allSelected = jobs.length > 0 && jobs.every(j => selectedJobIds.has(j.id));

// Selection handlers
const toggleSelection = useCallback((jobId: string) => {
  setSelectedJobIds(prev => {
    const next = new Set(prev);
    if (next.has(jobId)) {
      next.delete(jobId);
    } else {
      next.add(jobId);
    }
    return next;
  });
}, []);

const toggleSelectAll = useCallback(() => {
  if (allSelected) {
    setSelectedJobIds(new Set());
  } else {
    setSelectedJobIds(new Set(jobs.map(j => j.id)));
  }
}, [allSelected, jobs]);

// Sequence handlers
const handlePauseSequence = useCallback(async (instanceId: string) => {
  await pauseSequenceMutation.mutateAsync(instanceId);
  refetchSequences();
}, [pauseSequenceMutation, refetchSequences]);

const handleResumeSequence = useCallback(async (instanceId: string) => {
  await resumeSequenceMutation.mutateAsync(instanceId);
  refetchSequences();
}, [resumeSequenceMutation, refetchSequences]);

const handleCancelSequence = useCallback(async (instanceId: string) => {
  if (window.confirm('Are you sure you want to cancel this sequence?')) {
    await cancelSequenceMutation.mutateAsync(instanceId);
    refetchSequences();
  }
}, [cancelSequenceMutation, refetchSequences]);

const handleFinishSequence = useCallback(async (
  instanceId: string,
  option: 'finish-only' | 'finish-followup' | 'finish-start-new'
) => {
  await finishSequenceMutation.mutateAsync(instanceId);
  refetchSequences();

  if (option === 'finish-start-new') {
    // Find the restaurant and open start modal
    const instance = Object.values(sequencesData?.data || {})
      .flat()
      .find(s => s.id === instanceId);
    if (instance?.restaurants) {
      setSelectedRestaurantForSequence(instance.restaurants);
      setStartSequenceModalOpen(true);
    }
  }
}, [finishSequenceMutation, refetchSequences, sequencesData]);

const handleDeleteSequence = useCallback(async (instanceId: string) => {
  if (window.confirm('Are you sure you want to delete this sequence?')) {
    await deleteSequenceMutation.mutateAsync(instanceId);
    refetchSequences();
  }
}, [deleteSequenceMutation, refetchSequences]);

// Bulk recreate handler
const handleBulkRecreate = useCallback(async () => {
  const instanceIds = selectedWithSequences.flatMap(j =>
    getSequencesForRestaurant(j.restaurant_id).map(s => s.id)
  );

  await recreateSequencesMutation.mutateAsync(instanceIds);
  setRecreateConfirmOpen(false);
  setSelectedJobIds(new Set());
  refetchSequences();
}, [selectedWithSequences, getSequencesForRestaurant, recreateSequencesMutation, refetchSequences]);
```

#### Step 3.3: Add Batch Actions Bar (above Restaurant Table Card)

```tsx
{/* Batch Actions Bar - show when items selected */}
{selectedJobIds.size > 0 && (
  <div className="flex items-center justify-between gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">
        {selectedJobIds.size} restaurant{selectedJobIds.size !== 1 ? 's' : ''} selected
      </span>
      {selectedWithoutSequences.length > 0 && (
        <Badge variant="outline" className="text-xs">
          {selectedWithoutSequences.length} without sequences
        </Badge>
      )}
      {selectedWithSequences.length > 0 && (
        <Badge variant="outline" className="text-xs">
          {selectedWithSequences.length} with sequences
        </Badge>
      )}
    </div>

    <div className="flex items-center gap-2">
      {selectedWithoutSequences.length > 0 && (
        <Button
          size="sm"
          onClick={() => setBulkStartSequenceModalOpen(true)}
        >
          <Play className="h-4 w-4 mr-2" />
          Start Sequences ({selectedWithoutSequences.length})
        </Button>
      )}

      {selectedWithSequences.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRecreateConfirmOpen(true)}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Recreate ({selectedWithSequences.length})
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => setSelectedJobIds(new Set())}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  </div>
)}
```

#### Step 3.4: Update Table Header (add checkbox column)

```tsx
<TableHeader>
  <TableRow>
    {/* Selection checkbox */}
    <TableHead className="w-10">
      <Checkbox
        checked={allSelected}
        onCheckedChange={toggleSelectAll}
      />
    </TableHead>
    <TableHead className="w-8">
      {/* Expand/collapse button */}
    </TableHead>
    {/* ... rest of headers */}
  </TableRow>
</TableHeader>
```

#### Step 3.5: Update RestaurantRow Props and Add Checkbox

```tsx
// Update RestaurantRow function signature
function RestaurantRow({
  job,
  isExpanded,
  onToggle,
  onRetry,
  isSelected,
  onToggleSelection,
  sequences,
  onPauseSequence,
  onResumeSequence,
  onCancelSequence,
  onFinishSequence,
  onDeleteSequence,
  onStartSequence,
  onRefreshSequences,
}: {
  job: RegistrationJob;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  isSelected: boolean;
  onToggleSelection: () => void;
  sequences: SequenceInstance[];
  onPauseSequence: (id: string) => void;
  onResumeSequence: (id: string) => void;
  onCancelSequence: (id: string) => void;
  onFinishSequence: (id: string, option: 'finish-only' | 'finish-followup' | 'finish-start-new') => void;
  onDeleteSequence: (id: string) => void;
  onStartSequence: (restaurant: { id: string; name: string }) => void;
  onRefreshSequences: () => void;
})

// Add checkbox cell at start of row
<TableCell onClick={(e) => e.stopPropagation()}>
  <Checkbox
    checked={isSelected}
    onCheckedChange={onToggleSelection}
  />
</TableCell>
```

#### Step 3.6: Add Sequences Section to Expanded Content

Inside the RestaurantRow expanded content (after the Yolo Mode Sub-Steps section):

```tsx
{/* Sequences Section - show for completed restaurants */}
{job.status === 'completed' && (
  <div className="mt-4 pt-4 border-t">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium">Sequences</p>
      {sequences.length === 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStartSequence({
            id: job.restaurant_id,
            name: job.restaurant?.name || job.restaurant_name || 'Restaurant'
          })}
        >
          <Play className="h-4 w-4 mr-2" />
          Start Sequence
        </Button>
      )}
    </div>

    {sequences.length > 0 ? (
      <div className="space-y-4">
        {sequences.map((sequence) => (
          <SequenceProgressCard
            key={sequence.id}
            instance={sequence}
            compact={false}
            hideRestaurantLink={true}
            onPause={() => onPauseSequence(sequence.id)}
            onResume={() => onResumeSequence(sequence.id)}
            onCancel={() => onCancelSequence(sequence.id)}
            onFinish={(_, option) => onFinishSequence(sequence.id, option)}
            onDelete={() => onDeleteSequence(sequence.id)}
            onRefresh={onRefreshSequences}
            onStartSequence={onStartSequence}
          />
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">
        No active sequences. Start a sequence to automate follow-up tasks.
      </p>
    )}
  </div>
)}
```

#### Step 3.7: Add Modals at End of Component

```tsx
{/* Start Sequence Modal (single) */}
{selectedRestaurantForSequence && (
  <StartSequenceModal
    open={startSequenceModalOpen}
    onClose={() => {
      setStartSequenceModalOpen(false);
      setSelectedRestaurantForSequence(null);
    }}
    restaurant={selectedRestaurantForSequence}
  />
)}

{/* Bulk Start Sequence Modal */}
<BulkStartSequenceModal
  open={bulkStartSequenceModalOpen}
  onClose={() => setBulkStartSequenceModalOpen(false)}
  onSuccess={() => {
    refetchSequences();
    setSelectedJobIds(new Set());
  }}
  restaurants={selectedWithoutSequences.map(j => ({
    id: j.restaurant_id,
    name: j.restaurant?.name || j.restaurant_name || 'Restaurant'
  }))}
/>

{/* Recreate Confirmation Dialog */}
<Dialog open={recreateConfirmOpen} onOpenChange={setRecreateConfirmOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Recreate Sequences</DialogTitle>
      <DialogDescription>
        This will delete and recreate {selectedWithSequences.length} sequence(s)
        with updated restaurant data. All existing tasks will be replaced.
      </DialogDescription>
    </DialogHeader>

    <div className="max-h-[200px] overflow-y-auto border rounded-md p-3">
      {selectedWithSequences.map(job => (
        <div key={job.id} className="text-sm py-2 border-b last:border-0">
          {job.restaurant?.name || job.restaurant_name}
        </div>
      ))}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setRecreateConfirmOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={handleBulkRecreate}
        disabled={recreateSequencesMutation.isPending}
      >
        {recreateSequencesMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Recreating...
          </>
        ) : (
          'Confirm Recreate'
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Files Summary

### Backend Files to Modify

| File | Changes |
|------|---------|
| `src/services/sequence-instances-service.js` | Add `recreateSequence()`, `recreateSequenceBulk()`, `getSequencesByRestaurantIds()` |
| `src/routes/sequence-instances-routes.js` | Add 3 new endpoints |

### Frontend Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useSequences.ts` | Add `useRegistrationBatchSequences()`, `useRecreateSequence()`, `useRecreateSequenceBulk()` |
| `src/pages/RegistrationBatchDetail.tsx` | Major updates: selection state, sequence integration, modals |

### No New Files Needed
All components already exist and can be imported directly.

---

## Testing Checklist

- [x] Single sequence start from RestaurantRow
- [x] Bulk sequence start for selected restaurants
- [x] Sequence pause/resume/cancel/finish/delete actions
- [x] Task management within SequenceProgressCard
- [x] Bulk recreate sequences
- [x] Selection state persistence during expand/collapse
- [x] Data refresh after all mutations
- [x] Error handling for failed operations
- [x] Single recreate sequence button in SequenceProgressCard
- [x] Recreate sequence from RestaurantDetail.jsx
- [x] "Finish & Set Follow-up" on sequence opens CreateTaskModal
- [x] "Complete & Set Follow-up" on task opens CreateTaskModal
- [x] Hide registration progress for completed restaurants (only show sequences)

---

## Implementation Order

1. **Backend first** - Add service functions and routes ✅
2. **Hooks second** - Add React Query mutations ✅
3. **UI last** - Update RegistrationBatchDetail ✅

This order allows testing each layer before building on top of it.

---

## Additional Features Implemented (Beyond Original Plan)

### 1. Single Sequence Recreate
- Added `onRecreate` prop to SequenceProgressCard component
- Added "Recreate" button visible on active/paused sequences
- Confirmation dialog before recreating

### 2. RestaurantDetail.jsx Integration
- Added `useRecreateSequence` hook import
- Added `handleRecreateSequence` handler
- Wired up `onRecreate` to SequenceProgressCard

### 3. Follow-up Task Creation ✅ Fixed
- Added CreateTaskModal import to RegistrationBatchDetail
- Added `followUpTaskModalOpen` and `followUpRestaurantId` state
- **Sequence Finish:** Pass `restaurantId` through `onFinishSequence` callback chain
- **Task Complete:** Added `onFollowUpTask` callback prop through the component chain:
  - `RegistrationBatchDetail` → `RestaurantRow` → `SequenceProgressCard` → `SequenceTaskList`
- CreateTaskModal now opens correctly for both "Finish & Set Follow-up" (sequence) and "Complete & Set Follow-up" (task)

### 4. Hide Registration Progress for Completed Restaurants
- Registration 6-step progress grid hidden when `job.status === 'completed'`
- Yolo Mode Sub-Steps badges hidden when job is completed
- Only Sequences section displays for completed restaurants
- Cleaner UI focused on post-registration workflow

---

## Files Modified

| File | Changes Made |
|------|--------------|
| `src/services/sequence-instances-service.js` | Added 3 new functions + exports |
| `src/routes/sequence-instances-routes.js` | Added 3 new endpoints |
| `src/hooks/useSequences.ts` | Added 3 new hooks + types |
| `src/pages/RegistrationBatchDetail.tsx` | Full integration with selection, sequences, modals, follow-up callbacks, hide progress for completed |
| `src/pages/RestaurantDetail.jsx` | Added recreate functionality |
| `src/components/sequences/SequenceProgressCard.tsx` | Added `onRecreate` prop and button |

---

## Bug Fixes Applied (2024-12-28)

### Bug 1: "Finish & Set Follow-up" not opening CreateTaskModal

**Problem:** When selecting "Finish & Set Follow-up" from sequence dropdown, modal didn't open.

**Root Cause:** `handleFinishSequence` tried to look up `restaurant_id` from `sequencesData` which had a different structure.

**Fix Applied:**
1. Updated `onFinishSequence` prop type to accept `restaurantId` as third parameter
2. Updated `RestaurantRow` to pass `job.restaurant_id` in the callback
3. Updated `handleFinishSequence` to use the passed `restaurantId` directly

### Bug 2: "Complete & Set Follow-up" on task not opening CreateTaskModal

**Problem:** When selecting "Complete & Set Follow-up" on a task within a sequence, modal didn't open.

**Root Cause:** `onFollowUpTask` callback was not being passed through the component chain.

**Fix Applied:**
1. Added `onFollowUpTask` prop to `RestaurantRow` component
2. Passed `onFollowUpTask={() => onFollowUpTask(job.restaurant_id)}` to `SequenceProgressCard`
3. Created `handleFollowUpTask` callback in main component
4. The callback sets `followUpRestaurantId` and opens `CreateTaskModal`
