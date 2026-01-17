# Feature 1: Bulk Add Restaurants to Sequences - Investigation Report

**Date:** November 24, 2025
**Feature:** Bulk Add Restaurants to Sequences
**Investigator:** Claude Code
**Status:** 🔍 INVESTIGATION COMPLETE

---

## Executive Summary

This investigation examines the feasibility and implementation approach for allowing users to select multiple restaurants and start the same sequence for all of them simultaneously. The current implementation supports only single-restaurant sequence creation through a two-step modal flow.

**Key Finding:** The feature is **FULLY FEASIBLE** with a hybrid approach:
- Frontend: Modify existing `SelectRestaurantForSequenceModal` to support multi-select
- Backend: Create new bulk endpoint while preserving single-restaurant endpoint
- Estimated Complexity: **MEDIUM-HIGH**
- Estimated Risk: **MEDIUM**

---

## Table of Contents

1. [Current Implementation Analysis](#current-implementation-analysis)
2. [Technical Findings](#technical-findings)
3. [Architecture Decisions](#architecture-decisions)
4. [Implementation Approach](#implementation-approach)
5. [Risk Assessment](#risk-assessment)
6. [Questions & Answers](#questions--answers)
7. [Recommendations](#recommendations)

---

## Current Implementation Analysis

### Flow Overview

**Current User Flow (Single Restaurant):**
```
1. User clicks "New Sequence" button (Sequences page)
   ↓
2. SelectRestaurantForSequenceModal opens
   ↓
3. User clicks ONE restaurant row
   ↓
4. onSelectRestaurant(restaurant) callback fires
   ↓
5. Modal closes, StartSequenceModal opens with restaurant context
   ↓
6. User selects sequence template
   ↓
7. Single API call: POST /api/sequence-instances
   ↓
8. Backend creates 1 sequence instance + tasks
   ↓
9. Success toast, modals close
```

### Component Analysis

#### 1. SelectRestaurantForSequenceModal.tsx

**Location:** `/src/components/sequences/SelectRestaurantForSequenceModal.tsx`
**Lines:** 196 total

**Current Interface:**
```typescript
interface SelectRestaurantForSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void; // SINGLE restaurant
}
```

**Key Features:**
- ✅ Search by restaurant name
- ✅ Filters: lead_status, lead_stage, lead_warmth (all MultiSelect)
- ✅ Scrollable restaurant list
- ✅ Badge display for lead info
- ✅ Results count display

**Selection Mechanism:**
```tsx
// Line 154-181: Each restaurant row
<div
  onClick={() => onSelectRestaurant(restaurant)} // SINGLE click
  className="...cursor-pointer..."
>
  <div className="flex-1">
    <h4>{restaurant.name}</h4>
    {/* Badges */}
  </div>
  <Button size="sm">Select</Button>
</div>
```

**Assessment:**
- 🔴 **NO multi-select capability** - only click handler for single selection
- 🔴 **NO checkboxes** - would need to add
- 🔴 **NO selection state** - would need to track selected restaurant IDs
- ✅ **Filters already use MultiSelect** - good pattern to follow
- ✅ **Clean modal structure** - easy to extend

---

#### 2. StartSequenceModal.tsx

**Location:** `/src/components/sequences/StartSequenceModal.tsx`
**Lines:** 243 total

**Current Interface:**
```typescript
interface Restaurant {
  id: string;
  name: string;
}

interface StartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant; // SINGLE restaurant
}
```

**API Call (Lines 88-105):**
```typescript
const handleStart = async () => {
  await startSequenceMutation.mutateAsync({
    sequence_template_id: selectedTemplateId,
    restaurant_id: restaurant.id // SINGLE ID
  });

  toast.success('Sequence started successfully!');
  onClose();
};
```

**Assessment:**
- 🔴 **Accepts single restaurant object** - interface hardcoded
- 🔴 **Display shows single restaurant name** - "Start Sequence for {restaurant.name}"
- 🔴 **Single API call** - no bulk handling
- 🟡 **Could be extended** - but requires significant changes

**Critical Question:** Should we modify this modal or create a new one?

---

#### 3. Backend Service (sequence-instances-service.js)

**Location:** `/src/services/sequence-instances-service.js`
**Lines:** 574 total

**Current startSequence Function (Lines 17-171):**

```javascript
async function startSequence(templateId, restaurantId, options = {}) {
  // 1. Fetch template with steps
  const template = await getSequenceTemplateById(templateId);

  // 2. Check for duplicate active sequence (SINGLE restaurant check)
  const { count: existingCount } = await client
    .from('sequence_instances')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_template_id', templateId)
    .eq('restaurant_id', restaurantId) // SINGLE restaurant
    .eq('status', 'active');

  if (existingCount > 0) {
    throw new Error('An active sequence already exists...');
  }

  // 3. Fetch restaurant data (SINGLE restaurant)
  const { data: restaurant } = await client
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single();

  // 4. Create sequence instance (SINGLE instance)
  const { data: instance } = await client
    .from('sequence_instances')
    .insert({ /* single instance data */ })
    .select()
    .single();

  // 5. Create all tasks (for ONE restaurant)
  const tasksToCreate = [];
  for (const step of template.sequence_steps) {
    // Variable replacement for ONE restaurant
    messageRendered = await variableReplacementService
      .replaceVariables(message, restaurant);

    tasksToCreate.push({
      restaurant_id: restaurantId, // SINGLE restaurant
      sequence_instance_id: instance.id,
      // ... other task data
    });
  }

  // Batch insert tasks
  const { data: createdTasks } = await client
    .from('tasks')
    .insert(tasksToCreate)
    .select();

  // 6. Rollback on task creation failure
  if (tasksError) {
    await client.from('sequence_instances').delete().eq('id', instance.id);
    throw tasksError;
  }

  return {
    ...instance,
    tasks: createdTasks,
    tasks_created: createdTasks.length
  };
}
```

**Key Operations:**
1. ✅ **Template validation** - checks is_active, has steps
2. ✅ **Duplicate check** - prevents duplicate active sequences per restaurant
3. ✅ **Restaurant data fetch** - needed for variable replacement
4. ✅ **Instance creation** - single INSERT
5. ✅ **Task creation** - batch INSERT (all tasks at once)
6. ✅ **Variable replacement** - per restaurant (called once)
7. ✅ **Error handling** - rollback on task creation failure
8. ✅ **Usage counter** - increments template usage_count

**Assessment:**
- 🔴 **Designed for single restaurant** - all logic is single-restaurant
- 🔴 **No bulk support** - would need complete rewrite for arrays
- 🟢 **Good error handling** - rollback pattern is solid
- 🟢 **Clean structure** - well-organized, easy to understand

**Critical Observations:**
- Variable replacement happens **per restaurant** - this is expensive
- Task creation uses **batch INSERT** - already optimized
- Duplicate check is **per restaurant** - would need to handle partial failures
- Rollback is **simple** - only one instance to delete on failure

---

#### 4. Backend Route (sequence-instances-routes.js)

**Location:** `/src/routes/sequence-instances-routes.js`
**Lines:** 257 total

**Current POST Endpoint (Lines 68-107):**

```javascript
router.post('/', authMiddleware, async (req, res) => {
  // Validate required fields
  if (!req.body.sequence_template_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: sequence_template_id'
    });
  }

  if (!req.body.restaurant_id) { // SINGLE restaurant_id
    return res.status(400).json({
      success: false,
      error: 'Missing required field: restaurant_id'
    });
  }

  const options = {
    assigned_to: req.body.assigned_to || req.user.id,
    created_by: req.user.id
  };

  const instance = await sequenceInstancesService.startSequence(
    req.body.sequence_template_id,
    req.body.restaurant_id, // SINGLE restaurant_id
    options
  );

  res.status(201).json({ success: true, data: instance });
});
```

**Assessment:**
- 🔴 **Expects single restaurant_id** - validation would reject array
- 🔴 **Returns single instance** - response structure is singular
- 🟢 **Good error handling** - 409 for duplicates, 400 for validation

---

#### 5. React Query Hook (useSequences.ts)

**Location:** `/src/hooks/useSequences.ts`
**Lines:** 684 total

**Current useStartSequence Hook (Lines 556-578):**

```typescript
export interface StartSequenceRequest {
  sequence_template_id: string;
  restaurant_id: string; // SINGLE string
  assigned_to?: string;
}

export function useStartSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: StartSequenceRequest) => {
      const response = await api.post('/sequence-instances', data);
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({
        queryKey: ['restaurant-sequences', variables.restaurant_id]
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sequence started successfully', {
        description: `Created ${data.tasks_created} tasks`,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to start sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}
```

**Assessment:**
- 🔴 **Interface defines single restaurant_id** - TypeScript would error on array
- 🔴 **onSuccess invalidates single restaurant** - would need to handle multiple
- 🟢 **React Query mutation** - good pattern, easy to create parallel hook

---

## Technical Findings

### Database Constraints

**Sequence Instances Table:**
```sql
CREATE TABLE sequence_instances (
  id UUID PRIMARY KEY,
  sequence_template_id UUID REFERENCES sequence_templates(id),
  restaurant_id UUID REFERENCES restaurants(id), -- Single FK, not array
  organisation_id UUID,
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  -- ... other columns
);
```

**Key Constraint:**
```javascript
// From service: Lines 34-43
const { count: existingCount } = await client
  .from('sequence_instances')
  .eq('sequence_template_id', templateId)
  .eq('restaurant_id', restaurantId)
  .eq('status', 'active');

if (existingCount > 0) {
  throw new Error('An active sequence already exists for this restaurant using this template');
}
```

**Finding:** Database has **UNIQUE constraint** concept (enforced in code):
- One active sequence per (template, restaurant) pair
- Bulk creation must check ALL restaurants before starting ANY
- OR handle partial failures gracefully

---

### Variable Replacement Performance

**From variable-replacement-service.js:**
```javascript
async function replaceVariables(message, restaurant) {
  // Regex replacement with 65+ variables
  // Database queries may be involved for complex variables
  // Returns rendered string
}
```

**Performance Concerns:**
- Called **once per restaurant** for each task's message and subject
- If sequence has 5 steps and 10 restaurants:
  - 10 restaurants × 5 steps × 2 fields (message + subject) = **100 variable replacement calls**
- Each call may involve string regex operations
- **Recommendation:** This is acceptable for <50 restaurants, optimize if >50

---

### MultiSelect Component

**Location:** `/src/components/ui/multi-select.tsx`

**Interface:**
```typescript
interface MultiSelectProps {
  options: { label: string; value: string }[];
  selected: string[]; // Array of selected values
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}
```

**Features:**
- ✅ Checkbox-based selection (Check icon shows selected)
- ✅ Badge display for selected items (shows first 2, then "+X more")
- ✅ Search/filter capability
- ✅ Scrollable options list (max-h-64)
- ✅ handleSelect toggles selection (add/remove from array)

**Finding:** Perfect component for restaurant multi-select! Already used extensively in the app.

---

## Architecture Decisions

### Decision 1: Single vs Multiple Modals

**Options Considered:**

**Option A: Modify existing modals to handle both single and bulk**
```typescript
// StartSequenceModal accepts:
restaurant?: Restaurant;        // For single
restaurants?: Restaurant[];     // For bulk
```

**Pros:**
- Single component maintains both flows
- No code duplication
- User sees same familiar modal

**Cons:**
- Complex conditional logic throughout
- TypeScript interfaces become messy (optional props)
- Higher risk of breaking existing functionality
- Harder to test (2x test cases)
- Confusing for developers (which prop to use?)

**Option B: Create separate bulk-specific modals**
```typescript
// Keep StartSequenceModal (single)
// Create BulkStartSequenceModal (multiple)
```

**Pros:**
- Clean separation of concerns
- No risk to existing functionality
- Easier to test (isolated components)
- Clearer interfaces

**Cons:**
- Code duplication (UI structure similar)
- Two components to maintain
- User sees different modal for bulk

**Option C: Hybrid - Multi-select in SelectRestaurantForSequenceModal, handle in Sequences.tsx**
```typescript
// SelectRestaurantForSequenceModal supports multi-select
// Sequences.tsx decides: if 1 restaurant -> StartSequenceModal
//                        if multiple -> BulkStartSequenceModal
```

**Pros:**
- User sees familiar restaurant selection UI
- Clear separation: selection vs. execution
- StartSequenceModal unchanged (zero risk)
- Bulk logic isolated in new component

**Cons:**
- Slight increase in component count

**✅ DECISION: Option C (Hybrid Approach)**

**Rationale:**
- Lowest risk to existing functionality
- Best user experience (same selection UI, enhanced with checkboxes)
- Clear architectural separation
- Easiest to test and maintain

---

### Decision 2: Backend - Single Endpoint vs Separate Bulk Endpoint

**Options Considered:**

**Option A: Modify existing endpoint to accept array**
```javascript
// POST /api/sequence-instances
// Body: { restaurant_id: string | string[], ... }
```

**Pros:**
- Single endpoint for all cases
- No new routes

**Cons:**
- Complex validation (is it string or array?)
- Different response structures (object vs array)
- Confusing API contract
- Hard to document

**Option B: Create separate bulk endpoint**
```javascript
// Keep: POST /api/sequence-instances (single)
// New:  POST /api/sequence-instances/bulk (multiple)
```

**Pros:**
- Clear API contract (single vs bulk)
- Different response structures make sense
- Easier error handling per approach
- Better documentation
- Separate service methods (cleaner)

**Cons:**
- Two endpoints to maintain
- Some code duplication

**✅ DECISION: Option B (Separate Bulk Endpoint)**

**Rationale:**
- Clearer API design (follows REST principles)
- Better error handling for partial failures
- Easier to implement progressive enhancement (e.g., progress tracking)
- Can have different rate limiting rules
- Better matches user intent (bulk operation is conceptually different)

---

### Decision 3: Error Handling Strategy for Bulk Creation

**Scenario:** User selects 10 restaurants, but 2 have duplicate active sequences.

**Options Considered:**

**Option A: All-or-Nothing (Transaction)**
- Check ALL restaurants for duplicates first
- If ANY fail validation, reject entire operation
- No sequences created unless ALL can succeed

**Pros:**
- Consistent state (all succeed or all fail)
- Simpler to understand
- No partial failures

**Cons:**
- User frustration (1 bad restaurant blocks 9 good ones)
- Rigid workflow

**Option B: Partial Success (Best-Effort)**
- Attempt to create for each restaurant
- Track successes and failures
- Return detailed results: `{ succeeded: [], failed: [] }`
- Show comprehensive feedback to user

**Pros:**
- Better UX (some progress is better than none)
- User can retry just the failed ones
- More forgiving

**Cons:**
- Complex error handling
- State can be inconsistent mid-operation
- Need robust UI for showing partial results

**Option C: Validation First, Then All-or-Nothing**
- Step 1: Validate ALL restaurants (duplicates, existence, permissions)
- Step 2: If validation passes, create ALL sequences
- Step 3: If any creation fails mid-way, rollback ALL

**Pros:**
- Catches most errors upfront
- User gets clear validation feedback before committing
- Transactional guarantees
- Good UX (know problems before starting)

**Cons:**
- Two-phase operation (slower)
- Database queries doubled (validation + creation)
- Still possible for failures mid-creation (rare)

**✅ DECISION: Option B (Partial Success) with Pre-Flight Validation**

**Rationale:**
- Best UX: User can make progress even if some restaurants fail
- Realistic: Real-world scenarios often have "bad data" in selections
- Informative: Detailed error messages help user fix issues
- Retryable: User can immediately retry failed restaurants

**Implementation:**
```javascript
async function startSequenceBulk(templateId, restaurantIds, options) {
  const results = {
    succeeded: [],
    failed: [],
    summary: { total: 0, success: 0, failure: 0 }
  };

  // Pre-flight check: Template validity
  const template = await getSequenceTemplateById(templateId);
  if (!template.is_active) {
    throw new Error('Template is inactive'); // Fail fast
  }

  // Process each restaurant independently
  for (const restaurantId of restaurantIds) {
    try {
      const instance = await startSequence(templateId, restaurantId, options);
      results.succeeded.push({
        restaurant_id: restaurantId,
        instance_id: instance.id,
        tasks_created: instance.tasks_created
      });
    } catch (error) {
      results.failed.push({
        restaurant_id: restaurantId,
        error: error.message,
        reason: categorizeError(error) // e.g., 'duplicate', 'not_found'
      });
    }
  }

  results.summary = {
    total: restaurantIds.length,
    success: results.succeeded.length,
    failure: results.failed.length
  };

  return results;
}
```

---

### Decision 4: User Limit on Bulk Selection

**Question:** Should there be a maximum number of restaurants that can be selected?

**Considerations:**
- Variable replacement: 100 restaurants × 5 steps × 2 fields = 1000 operations
- Database inserts: 100 sequence instances + 500 tasks = 600 INSERT operations
- Request timeout: Most servers timeout at 30-60 seconds
- User experience: Waiting >30 seconds feels broken

**Performance Testing Assumptions:**
- Variable replacement: ~10ms per call
- Database INSERT: ~5ms per row
- Network overhead: ~100ms

**Rough Calculation (100 restaurants, 5-step sequence):**
```
Variable replacement: 1000 calls × 10ms = 10 seconds
Database inserts:     600 rows × 5ms = 3 seconds
Network overhead:     100ms
Total:                ~13 seconds
```

**✅ DECISION: Soft Limit of 50 Restaurants**

**Rationale:**
- 50 restaurants × 5 steps = reasonable ~7 second operation
- UI warning at 50+: "Large bulk operation may take longer"
- Hard limit at 100: "Please select 100 or fewer restaurants"
- Can increase limit later if performance allows

**Implementation:**
```typescript
// In SelectRestaurantForSequenceModal
const MAX_SELECTION = 100;
const WARN_THRESHOLD = 50;

const handleToggleAll = () => {
  if (filteredRestaurants.length > MAX_SELECTION) {
    toast.warning(`Cannot select more than ${MAX_SELECTION} restaurants`);
    return;
  }
  // ... select all logic
};

const handleConfirm = () => {
  if (selectedRestaurants.length > WARN_THRESHOLD) {
    toast.info('Large selection - this may take a moment...');
  }
  onSelectRestaurants(selectedRestaurants);
};
```

---

## Implementation Approach

### Phase 1: Frontend - SelectRestaurantForSequenceModal Enhancement

**Estimated Time:** 2-3 hours

**Changes Required:**

1. **Add Multi-Select State** (20 min)
```typescript
interface SelectRestaurantForSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void; // Keep for compatibility
  onSelectRestaurants?: (restaurants: any[]) => void; // NEW: Bulk callback
  allowMultiple?: boolean; // NEW: Enable multi-select mode
}

// Inside component:
const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);

const handleToggle = (restaurantId: string) => {
  if (selectedRestaurantIds.includes(restaurantId)) {
    setSelectedRestaurantIds(prev => prev.filter(id => id !== restaurantId));
  } else {
    setSelectedRestaurantIds(prev => [...prev, restaurantId]);
  }
};
```

2. **Update Restaurant Row UI** (30 min)
```tsx
{filteredRestaurants.map((restaurant) => (
  <div
    key={restaurant.id}
    className={cn(
      "flex items-center justify-between p-4 border rounded-lg transition-colors",
      allowMultiple && selectedRestaurantIds.includes(restaurant.id)
        ? "bg-accent border-primary"
        : "hover:bg-accent"
    )}
  >
    {/* Checkbox for multi-select */}
    {allowMultiple && (
      <Checkbox
        checked={selectedRestaurantIds.includes(restaurant.id)}
        onCheckedChange={() => handleToggle(restaurant.id)}
        onClick={(e) => e.stopPropagation()}
      />
    )}

    {/* Restaurant info */}
    <div
      className="flex-1"
      onClick={() => {
        if (allowMultiple) {
          handleToggle(restaurant.id);
        } else {
          onSelectRestaurant(restaurant); // Single-select mode
        }
      }}
    >
      {/* ... existing content ... */}
    </div>

    {/* Action button */}
    {allowMultiple ? (
      <Badge variant={selectedRestaurantIds.includes(restaurant.id) ? "default" : "outline"}>
        {selectedRestaurantIds.includes(restaurant.id) ? "Selected" : "Select"}
      </Badge>
    ) : (
      <Button size="sm" onClick={() => onSelectRestaurant(restaurant)}>
        Select
      </Button>
    )}
  </div>
))}
```

3. **Add Bulk Selection Controls** (40 min)
```tsx
{/* Selection toolbar (shown when allowMultiple) */}
{allowMultiple && (
  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        {selectedRestaurantIds.length} selected
      </span>
      {selectedRestaurantIds.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedRestaurantIds([])}
        >
          Clear All
        </Button>
      )}
    </div>

    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSelectAll}
        disabled={filteredRestaurants.length > MAX_SELECTION}
      >
        Select All ({filteredRestaurants.length})
      </Button>

      <Button
        size="sm"
        onClick={handleConfirmSelection}
        disabled={selectedRestaurantIds.length === 0}
      >
        Continue ({selectedRestaurantIds.length})
      </Button>
    </div>
  </div>
)}
```

4. **Add Warnings & Limits** (30 min)
```typescript
const MAX_SELECTION = 100;
const WARN_THRESHOLD = 50;

const handleSelectAll = () => {
  if (filteredRestaurants.length > MAX_SELECTION) {
    toast.error(`Cannot select more than ${MAX_SELECTION} restaurants at once`);
    return;
  }
  setSelectedRestaurantIds(filteredRestaurants.map(r => r.id));
};

const handleConfirmSelection = () => {
  const selected = restaurants?.filter(r =>
    selectedRestaurantIds.includes(r.id)
  ) || [];

  if (selected.length > WARN_THRESHOLD) {
    toast.info('Large selection - bulk operation may take a moment...');
  }

  onSelectRestaurants?.(selected);
  onClose();
};
```

**Testing Checklist:**
- [ ] Single-select mode still works (backward compatibility)
- [ ] Multi-select mode toggles restaurants on click
- [ ] Checkboxes reflect selection state
- [ ] "Select All" works and respects limit
- [ ] "Clear All" resets selection
- [ ] Selected count displays correctly
- [ ] Warning shows for 50+ selections
- [ ] Error shows for 100+ selections
- [ ] Modal closes after selection

---

### Phase 2: Frontend - BulkStartSequenceModal Component

**Estimated Time:** 3-4 hours

**New Component:** `/src/components/sequences/BulkStartSequenceModal.tsx`

**Interface:**
```typescript
interface BulkStartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  restaurants: Restaurant[]; // Array of restaurants
}

interface BulkOperationResult {
  succeeded: {
    restaurant_id: string;
    restaurant_name: string;
    instance_id: string;
    tasks_created: number;
  }[];
  failed: {
    restaurant_id: string;
    restaurant_name: string;
    error: string;
    reason: 'duplicate' | 'not_found' | 'validation_error' | 'server_error';
  }[];
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}
```

**Component Structure:**

1. **Header Section** (30 min)
```tsx
<DialogHeader>
  <DialogTitle>
    Start Sequence for {restaurants.length} Restaurant{restaurants.length !== 1 ? 's' : ''}
  </DialogTitle>
  <DialogDescription>
    Select a sequence template to create for all selected restaurants
  </DialogDescription>
</DialogHeader>
```

2. **Template Selection** (30 min)
```tsx
{/* Same as StartSequenceModal - reuse template selector */}
<div className="space-y-2">
  <Label>Select Sequence Template</Label>
  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
    <SelectTrigger>
      <SelectValue placeholder="Choose a template..." />
    </SelectTrigger>
    <SelectContent>
      {templates?.data?.map((template) => (
        <SelectItem key={template.id} value={template.id}>
          {template.name} ({template.sequence_steps?.length || 0} steps)
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

3. **Restaurant List Preview** (45 min)
```tsx
{/* Show selected restaurants in a scrollable list */}
<div className="space-y-2">
  <Label>Selected Restaurants ({restaurants.length})</Label>
  <ScrollArea className="h-[200px] border rounded-md p-3">
    <div className="space-y-2">
      {restaurants.map((restaurant) => (
        <div
          key={restaurant.id}
          className="flex items-center justify-between p-2 bg-accent/50 rounded"
        >
          <span className="font-medium">{restaurant.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveRestaurant(restaurant.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  </ScrollArea>
</div>
```

4. **Preview Timeline** (45 min)
```tsx
{/* Same as StartSequenceModal - show step timeline */}
{selectedTemplate && (
  <Card className="p-4">
    <div className="space-y-3">
      {selectedTemplate.sequence_steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-3 text-sm">
          {/* ... step preview ... */}
        </div>
      ))}
      <div className="pt-3 border-t text-sm text-muted-foreground">
        Total duration: {calculateTotalDuration(selectedTemplate.sequence_steps)}
      </div>
    </div>
  </Card>
)}
```

5. **Progress Tracking UI** (1 hour)
```tsx
{/* Show during bulk operation */}
{bulkMutation.isPending && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Creating sequences...</span>
      <span className="text-sm text-muted-foreground">
        {progress.completed} of {progress.total}
      </span>
    </div>
    <Progress value={(progress.completed / progress.total) * 100} />
    <div className="text-xs text-muted-foreground">
      {progress.current_restaurant_name}
    </div>
  </div>
)}
```

6. **Results Display** (1 hour)
```tsx
{/* Show after operation completes */}
{operationComplete && result && (
  <div className="space-y-4">
    {/* Summary */}
    <div className="grid grid-cols-3 gap-4">
      <Card className="p-4">
        <div className="text-2xl font-bold text-center">
          {result.summary.total}
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Total
        </div>
      </Card>
      <Card className="p-4 border-green-500">
        <div className="text-2xl font-bold text-center text-green-600">
          {result.summary.success}
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Succeeded
        </div>
      </Card>
      <Card className="p-4 border-red-500">
        <div className="text-2xl font-bold text-center text-red-600">
          {result.summary.failure}
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Failed
        </div>
      </Card>
    </div>

    {/* Success List */}
    {result.succeeded.length > 0 && (
      <div className="space-y-2">
        <Label className="text-green-600">✓ Successful ({result.succeeded.length})</Label>
        <ScrollArea className="h-[150px] border rounded-md p-3">
          {result.succeeded.map((item) => (
            <div key={item.restaurant_id} className="flex items-center justify-between py-2">
              <span className="text-sm">{item.restaurant_name}</span>
              <Badge variant="outline" className="text-green-600">
                {item.tasks_created} tasks
              </Badge>
            </div>
          ))}
        </ScrollArea>
      </div>
    )}

    {/* Failure List */}
    {result.failed.length > 0 && (
      <div className="space-y-2">
        <Label className="text-red-600">✗ Failed ({result.failed.length})</Label>
        <ScrollArea className="h-[150px] border rounded-md p-3">
          {result.failed.map((item) => (
            <div key={item.restaurant_id} className="space-y-1 py-2 border-b last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.restaurant_name}</span>
                <Badge variant="destructive">{item.reason}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.error}</p>
            </div>
          ))}
        </ScrollArea>
      </div>
    )}

    {/* Retry Failed */}
    {result.failed.length > 0 && (
      <Button
        variant="outline"
        onClick={handleRetryFailed}
        className="w-full"
      >
        Retry Failed ({result.failed.length})
      </Button>
    )}
  </div>
)}
```

7. **Bulk Operation Handler** (45 min)
```typescript
const bulkMutation = useBulkStartSequence();
const [progress, setProgress] = useState({ completed: 0, total: 0, current_restaurant_name: '' });
const [result, setResult] = useState<BulkOperationResult | null>(null);
const [operationComplete, setOperationComplete] = useState(false);

const handleStart = async () => {
  if (!selectedTemplateId) {
    toast.error('Please select a sequence template');
    return;
  }

  setProgress({ completed: 0, total: restaurants.length, current_restaurant_name: '' });
  setOperationComplete(false);

  try {
    const result = await bulkMutation.mutateAsync({
      sequence_template_id: selectedTemplateId,
      restaurant_ids: restaurants.map(r => r.id)
    });

    setResult(result);
    setOperationComplete(true);

    // Show summary toast
    if (result.summary.failure === 0) {
      toast.success(`All sequences started successfully!`, {
        description: `Created sequences for ${result.summary.success} restaurants`
      });
    } else if (result.summary.success === 0) {
      toast.error('All sequences failed to start', {
        description: 'See details below'
      });
    } else {
      toast.warning('Some sequences failed', {
        description: `${result.summary.success} succeeded, ${result.summary.failure} failed`
      });
    }
  } catch (error: any) {
    toast.error('Bulk operation failed', {
      description: error.message
    });
  }
};

const handleRetryFailed = () => {
  // Create new list of just failed restaurants
  const failedRestaurants = restaurants.filter(r =>
    result?.failed.some(f => f.restaurant_id === r.id)
  );

  // Reset and retry with failed subset
  setResult(null);
  setOperationComplete(false);
  // ... trigger new bulk operation with failedRestaurants
};
```

**Testing Checklist:**
- [ ] Modal displays correct restaurant count
- [ ] Restaurant list scrollable and removable
- [ ] Template selection works
- [ ] Preview timeline displays correctly
- [ ] Progress bar updates during operation
- [ ] Success/failure results display correctly
- [ ] Retry failed button works
- [ ] Summary stats are accurate
- [ ] Modal closes properly after completion

---

### Phase 3: Backend - Bulk Service & Endpoint

**Estimated Time:** 3-4 hours

**1. Create Bulk Service Method** (2 hours)

**File:** `/src/services/sequence-instances-service.js`

```javascript
/**
 * Start sequences for multiple restaurants (bulk operation)
 * @param {string} templateId - Sequence template ID
 * @param {string[]} restaurantIds - Array of restaurant IDs
 * @param {object} options - Additional options (assigned_to, created_by)
 * @returns {Promise<object>} Bulk operation results
 */
async function startSequenceBulk(templateId, restaurantIds, options = {}) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Validation
  if (!restaurantIds || restaurantIds.length === 0) {
    throw new Error('At least one restaurant_id is required');
  }

  if (restaurantIds.length > 100) {
    throw new Error('Maximum 100 restaurants per bulk operation');
  }

  // Initialize result tracking
  const results = {
    succeeded: [],
    failed: [],
    summary: {
      total: restaurantIds.length,
      success: 0,
      failure: 0
    }
  };

  try {
    // 1. Pre-flight check: Validate template (fail fast for all)
    const template = await getSequenceTemplateById(templateId);

    if (!template.is_active) {
      throw new Error('Cannot start sequences from inactive template');
    }

    if (!template.sequence_steps || template.sequence_steps.length === 0) {
      throw new Error('Template has no steps');
    }

    // 2. Fetch all restaurants in one query (optimization)
    const { data: restaurants, error: restaurantsError } = await client
      .from('restaurants')
      .select('*')
      .in('id', restaurantIds)
      .eq('organisation_id', orgId);

    if (restaurantsError) {
      console.error('Error fetching restaurants:', restaurantsError);
      throw new Error('Failed to fetch restaurants');
    }

    // Create map for quick lookups
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

    // 3. Check for existing active sequences (bulk query)
    const { data: existingSequences } = await client
      .from('sequence_instances')
      .select('restaurant_id')
      .eq('sequence_template_id', templateId)
      .in('restaurant_id', restaurantIds)
      .eq('status', 'active');

    const existingSet = new Set(existingSequences?.map(s => s.restaurant_id) || []);

    // 4. Process each restaurant
    for (const restaurantId of restaurantIds) {
      try {
        // Check if restaurant exists
        const restaurant = restaurantMap.get(restaurantId);
        if (!restaurant) {
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: 'Unknown',
            error: 'Restaurant not found',
            reason: 'not_found'
          });
          continue;
        }

        // Check for duplicate active sequence
        if (existingSet.has(restaurantId)) {
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: 'An active sequence already exists for this restaurant',
            reason: 'duplicate'
          });
          continue;
        }

        // Create sequence instance
        const instanceName = `${template.name} - ${restaurant.name} - ${new Date().toISOString().split('T')[0]}`;

        const { data: instance, error: instanceError } = await client
          .from('sequence_instances')
          .insert({
            sequence_template_id: templateId,
            restaurant_id: restaurantId,
            organisation_id: orgId,
            name: instanceName,
            status: 'active',
            current_step_order: 1,
            total_steps: template.sequence_steps.length,
            assigned_to: options.assigned_to || options.created_by,
            created_by: options.created_by
          })
          .select()
          .single();

        if (instanceError) {
          console.error(`Error creating instance for ${restaurant.name}:`, instanceError);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: instanceError.message || 'Failed to create sequence instance',
            reason: 'server_error'
          });
          continue;
        }

        // Create tasks
        const tasksToCreate = [];
        const now = new Date();

        for (const step of template.sequence_steps) {
          let message = step.custom_message;

          // Get message from template if referenced
          if (step.message_template_id && step.message_templates) {
            message = step.message_templates.message_content;
          } else if (step.task_template_id && step.task_templates && !message) {
            message = step.task_templates.default_message;
          }

          // Render message with variables
          let messageRendered = null;
          if (message) {
            messageRendered = await variableReplacementService.replaceVariables(message, restaurant);
          }

          // Render subject line with variables
          let subjectLineRendered = null;
          if (step.type === 'email' && step.subject_line) {
            subjectLineRendered = await variableReplacementService.replaceVariables(step.subject_line, restaurant);
          }

          // Calculate due_date for first step
          let dueDate = null;
          let status = 'pending';

          if (step.step_order === 1) {
            status = 'active';
            dueDate = calculateDueDate(now, step.delay_value, step.delay_unit);
          }

          tasksToCreate.push({
            organisation_id: orgId,
            restaurant_id: restaurantId,
            sequence_instance_id: instance.id,
            sequence_step_order: step.step_order,
            task_template_id: step.task_template_id,
            message_template_id: step.message_template_id,
            assigned_to: options.assigned_to || options.created_by,
            created_by: options.created_by,
            name: step.name,
            description: step.description,
            status: status,
            type: step.type,
            priority: step.priority,
            message: message,
            message_rendered: messageRendered,
            subject_line: step.subject_line || null,
            subject_line_rendered: subjectLineRendered,
            due_date: dueDate
          });
        }

        // Batch insert tasks
        const { data: createdTasks, error: tasksError } = await client
          .from('tasks')
          .insert(tasksToCreate)
          .select();

        if (tasksError) {
          // Rollback: delete instance
          await client.from('sequence_instances').delete().eq('id', instance.id);
          console.error(`Error creating tasks for ${restaurant.name}:`, tasksError);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: tasksError.message || 'Failed to create tasks',
            reason: 'server_error'
          });
          continue;
        }

        // Success!
        results.succeeded.push({
          restaurant_id: restaurantId,
          restaurant_name: restaurant.name,
          instance_id: instance.id,
          tasks_created: createdTasks.length
        });

      } catch (error) {
        console.error(`Error processing restaurant ${restaurantId}:`, error);
        const restaurant = restaurantMap.get(restaurantId);
        results.failed.push({
          restaurant_id: restaurantId,
          restaurant_name: restaurant?.name || 'Unknown',
          error: error.message || 'Unknown error',
          reason: 'server_error'
        });
      }
    }

    // 5. Update template usage_count (by success count)
    if (results.succeeded.length > 0) {
      await client
        .from('sequence_templates')
        .update({ usage_count: (template.usage_count || 0) + results.succeeded.length })
        .eq('id', templateId);
    }

    // 6. Calculate final summary
    results.summary.success = results.succeeded.length;
    results.summary.failure = results.failed.length;

    return results;

  } catch (error) {
    console.error('Error in startSequenceBulk:', error);
    throw error;
  }
}

module.exports = {
  startSequence,
  startSequenceBulk, // NEW export
  // ... other exports
};
```

**Key Features:**
- ✅ Pre-flight validation (template check)
- ✅ Bulk restaurant fetch (single query)
- ✅ Bulk duplicate check (single query)
- ✅ Per-restaurant error handling
- ✅ Automatic rollback on task creation failure
- ✅ Detailed success/failure tracking
- ✅ Usage count update

**Testing Checklist:**
- [ ] Validates template exists and is active
- [ ] Fetches all restaurants in one query
- [ ] Checks for duplicates in bulk
- [ ] Creates sequence instances correctly
- [ ] Creates tasks with variable replacement
- [ ] Rolls back on task creation failure
- [ ] Returns detailed results object
- [ ] Updates template usage count
- [ ] Handles partial failures gracefully

---

**2. Create Bulk API Endpoint** (1 hour)

**File:** `/src/routes/sequence-instances-routes.js`

```javascript
/**
 * POST /api/sequence-instances/bulk
 * Start sequences for multiple restaurants
 * Body:
 *   - sequence_template_id: UUID (required)
 *   - restaurant_ids: UUID[] (required, max 100)
 *   - assigned_to: UUID (optional)
 */
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.sequence_template_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sequence_template_id'
      });
    }

    if (!req.body.restaurant_ids || !Array.isArray(req.body.restaurant_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: restaurant_ids (must be an array)'
      });
    }

    if (req.body.restaurant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one restaurant_id is required'
      });
    }

    if (req.body.restaurant_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 restaurants per bulk operation'
      });
    }

    const options = {
      assigned_to: req.body.assigned_to || req.user.id,
      created_by: req.user.id
    };

    const results = await sequenceInstancesService.startSequenceBulk(
      req.body.sequence_template_id,
      req.body.restaurant_ids,
      options
    );

    // Determine appropriate status code
    let statusCode = 201; // Created
    if (results.summary.failure > 0 && results.summary.success === 0) {
      statusCode = 207; // Multi-Status (all failed)
    } else if (results.summary.failure > 0) {
      statusCode = 207; // Multi-Status (partial success)
    }

    res.status(statusCode).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error starting bulk sequences:', error);

    // Handle pre-flight errors (template not found, inactive, etc.)
    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Response Examples:**

**Success (All Succeeded):**
```json
{
  "success": true,
  "data": {
    "succeeded": [
      {
        "restaurant_id": "uuid-1",
        "restaurant_name": "Pizza Palace",
        "instance_id": "uuid-100",
        "tasks_created": 5
      },
      {
        "restaurant_id": "uuid-2",
        "restaurant_name": "Burger Barn",
        "instance_id": "uuid-101",
        "tasks_created": 5
      }
    ],
    "failed": [],
    "summary": {
      "total": 2,
      "success": 2,
      "failure": 0
    }
  }
}
```

**Partial Success:**
```json
{
  "success": true,
  "data": {
    "succeeded": [
      {
        "restaurant_id": "uuid-1",
        "restaurant_name": "Pizza Palace",
        "instance_id": "uuid-100",
        "tasks_created": 5
      }
    ],
    "failed": [
      {
        "restaurant_id": "uuid-2",
        "restaurant_name": "Burger Barn",
        "error": "An active sequence already exists for this restaurant",
        "reason": "duplicate"
      }
    ],
    "summary": {
      "total": 2,
      "success": 1,
      "failure": 1
    }
  }
}
```

---

**3. Create React Query Hook** (30 min)

**File:** `/src/hooks/useSequences.ts`

```typescript
// Add to existing interfaces
export interface BulkStartSequenceRequest {
  sequence_template_id: string;
  restaurant_ids: string[]; // Array of IDs
  assigned_to?: string;
}

export interface BulkStartSequenceResult {
  succeeded: {
    restaurant_id: string;
    restaurant_name: string;
    instance_id: string;
    tasks_created: number;
  }[];
  failed: {
    restaurant_id: string;
    restaurant_name: string;
    error: string;
    reason: 'duplicate' | 'not_found' | 'validation_error' | 'server_error';
  }[];
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}

// New hook
export function useBulkStartSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkStartSequenceRequest) => {
      const response = await api.post('/sequence-instances/bulk', data);
      return response.data.data as BulkStartSequenceResult;
    },
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // Invalidate each restaurant's sequences
      variables.restaurant_ids.forEach(restaurantId => {
        queryClient.invalidateQueries({
          queryKey: ['restaurant-sequences', restaurantId]
        });
      });

      // Success toast handled in component (with detailed results)
    },
    onError: (error: any) => {
      toast.error('Bulk operation failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}
```

**Testing Checklist:**
- [ ] Hook accepts bulk request interface
- [ ] Makes POST request to /bulk endpoint
- [ ] Returns typed BulkStartSequenceResult
- [ ] Invalidates all relevant queries on success
- [ ] Shows error toast on failure
- [ ] TypeScript types are correct

---

### Phase 4: Integration - Sequences.tsx Updates

**Estimated Time:** 1-2 hours

**Changes Required:**

1. **Update State Management** (20 min)
```typescript
// Add bulk flow state
const [bulkStartOpen, setBulkStartOpen] = useState(false);
const [selectedRestaurants, setSelectedRestaurants] = useState<any[]>([]);
const [bulkMode, setBulkMode] = useState(false);
```

2. **Update Restaurant Selection Handler** (30 min)
```typescript
const handleRestaurantSelected = (restaurant: any) => {
  // Single restaurant flow (existing)
  setSelectedRestaurant(restaurant);
  setSelectRestaurantOpen(false);
  setStartSequenceOpen(true);
};

const handleRestaurantsSelected = (restaurants: any[]) => {
  // NEW: Bulk restaurant flow
  setSelectedRestaurants(restaurants);
  setSelectRestaurantOpen(false);
  setBulkStartOpen(true);
};

const handleBulkStartClose = () => {
  setBulkStartOpen(false);
  setSelectedRestaurants([]);
};
```

3. **Add Mode Toggle** (15 min)
```typescript
// In "New Sequence" button area, add dropdown
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
      <Plus className="h-4 w-4 mr-2" />
      New Sequence
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => {
      setBulkMode(false);
      setSelectRestaurantOpen(true);
    }}>
      Single Restaurant
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => {
      setBulkMode(true);
      setSelectRestaurantOpen(true);
    }}>
      Multiple Restaurants (Bulk)
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

4. **Update Modal Calls** (20 min)
```tsx
{/* Restaurant Selection Modal */}
<SelectRestaurantForSequenceModal
  open={selectRestaurantOpen}
  onClose={() => {
    setSelectRestaurantOpen(false);
    setBulkMode(false);
  }}
  onSelectRestaurant={handleRestaurantSelected}
  onSelectRestaurants={handleRestaurantsSelected}
  allowMultiple={bulkMode} // Pass mode flag
/>

{/* Single Restaurant Flow (existing) */}
{selectedRestaurant && (
  <StartSequenceModal
    open={startSequenceOpen}
    onClose={handleStartSequenceClose}
    restaurant={selectedRestaurant}
  />
)}

{/* NEW: Bulk Restaurant Flow */}
{selectedRestaurants.length > 0 && (
  <BulkStartSequenceModal
    open={bulkStartOpen}
    onClose={handleBulkStartClose}
    restaurants={selectedRestaurants}
  />
)}
```

**Testing Checklist:**
- [ ] Single-restaurant flow unchanged
- [ ] Bulk mode toggle works
- [ ] SelectRestaurantForSequenceModal shows checkboxes in bulk mode
- [ ] BulkStartSequenceModal opens with selected restaurants
- [ ] Both modals close properly
- [ ] State resets correctly

---

### Phase 5: Testing & Polish

**Estimated Time:** 2-3 hours

**Test Scenarios:**

1. **Single Restaurant (Regression Testing)**
   - [ ] Existing flow works unchanged
   - [ ] No visual differences
   - [ ] Same behavior as before

2. **Bulk - Happy Path**
   - [ ] Select 5 restaurants
   - [ ] Choose template
   - [ ] All 5 sequences created successfully
   - [ ] Progress bar updates
   - [ ] Success summary shows correctly
   - [ ] Modals close

3. **Bulk - Partial Failure**
   - [ ] Select 10 restaurants (2 with existing active sequences)
   - [ ] 8 succeed, 2 fail
   - [ ] Results clearly show success/failure
   - [ ] Retry button appears
   - [ ] Retry creates only for failed restaurants

4. **Bulk - All Fail**
   - [ ] Select restaurants all with active sequences
   - [ ] All fail with "duplicate" reason
   - [ ] Clear error messaging
   - [ ] Modal allows retry or close

5. **Bulk - Limits**
   - [ ] Try to select 101 restaurants
   - [ ] Error message appears
   - [ ] Cannot proceed
   - [ ] Select 50 restaurants
   - [ ] Warning appears but allows

6. **Bulk - Performance**
   - [ ] Select 50 restaurants
   - [ ] Operation completes in <10 seconds
   - [ ] No timeout errors
   - [ ] UI remains responsive

7. **Edge Cases**
   - [ ] Empty selection (button disabled)
   - [ ] Restaurant removed from list
   - [ ] Template changed mid-operation
   - [ ] Network failure during bulk
   - [ ] Modal closed mid-operation

**Performance Testing:**
```bash
# Use backend logs to measure:
# - Total operation time for 10, 25, 50 restaurants
# - Variable replacement time per restaurant
# - Database insert time
# - Total API response time

# Expected benchmarks:
# 10 restaurants: <3 seconds
# 25 restaurants: <6 seconds
# 50 restaurants: <10 seconds
```

---

## Risk Assessment

### Technical Risks

#### 1. Performance Degradation (MEDIUM)

**Risk:** Bulk operations with 50+ restaurants take >30 seconds and timeout

**Likelihood:** Medium
**Impact:** High (operation fails, user frustration)

**Mitigation Strategies:**
1. **Implement request timeout extension:**
   ```javascript
   // In route handler
   req.setTimeout(120000); // 2 minutes for bulk operations
   ```

2. **Optimize database queries:**
   - Bulk fetch restaurants (single query) ✅ Already planned
   - Bulk check duplicates (single query) ✅ Already planned
   - Consider batch inserts for sequence instances (currently one-by-one)

3. **Add server-side progress tracking:**
   ```javascript
   // Store progress in Redis/cache
   await cache.set(`bulk-operation:${operationId}`, {
     completed: 10,
     total: 50,
     current: 'Restaurant Name'
   });

   // Frontend polls: GET /api/sequence-instances/bulk/:operationId/progress
   ```

4. **Soft/hard limits on selection:**
   - Soft limit: 50 (warning)
   - Hard limit: 100 (error)
   - Can increase later with performance improvements

**Contingency:** If performance is poor:
- Reduce hard limit to 25
- Implement async job queue (user gets email when done)

---

#### 2. Partial Failure Complexity (MEDIUM)

**Risk:** Users confused by partial success results, don't know what to do next

**Likelihood:** Medium
**Impact:** Medium (UX issue, support burden)

**Mitigation Strategies:**
1. **Clear, actionable UI:**
   - Visual summary (cards with counts)
   - Separate scrollable lists for success/failure
   - "Retry Failed" button prominently displayed

2. **Detailed error categorization:**
   ```typescript
   reason: 'duplicate' | 'not_found' | 'validation_error' | 'server_error'
   ```
   - Different icons/colors per reason
   - Helpful tooltips explaining each error type

3. **User guidance:**
   ```tsx
   {result.failed.some(f => f.reason === 'duplicate') && (
     <Alert>
       <AlertCircle className="h-4 w-4" />
       <AlertDescription>
         Some restaurants already have an active sequence for this template.
         You can cancel their existing sequences before retrying.
       </AlertDescription>
     </Alert>
   )}
   ```

4. **Copy-to-clipboard failed list:**
   ```tsx
   <Button onClick={() => {
     const failedNames = result.failed.map(f => f.restaurant_name).join('\n');
     navigator.clipboard.writeText(failedNames);
     toast.success('Failed restaurant names copied');
   }}>
     Copy Failed List
   </Button>
   ```

**Contingency:** If users struggle:
- Add "Export to CSV" for failed restaurants
- Add inline "View Restaurant" links to investigate issues

---

#### 3. Race Conditions with Concurrent Operations (LOW)

**Risk:** User starts bulk operation while another user is modifying same restaurants

**Likelihood:** Low
**Impact:** Low (isolated failures, auto-handled)

**Mitigation Strategies:**
1. **Database constraints handle duplicates:**
   - Duplicate check before insert ✅ Already planned
   - Error gracefully caught per restaurant

2. **Optimistic locking (if needed):**
   ```sql
   -- Add version column to sequence_instances
   ALTER TABLE sequence_instances ADD COLUMN version INTEGER DEFAULT 1;

   -- Update with version check
   UPDATE sequence_instances
   SET status = 'active', version = version + 1
   WHERE id = ? AND version = ?
   ```

3. **Retry logic:**
   - Transient failures automatically retried once
   - User can manually retry failed restaurants

**Contingency:** If race conditions are frequent:
- Implement row-level locking
- Add operation queue (serialize bulk operations)

---

### User Experience Risks

#### 4. Confusion Between Single and Bulk Modes (LOW)

**Risk:** Users don't understand when to use single vs bulk

**Likelihood:** Low
**Impact:** Low (minor UX friction)

**Mitigation Strategies:**
1. **Clear UI labels:**
   - "New Sequence" dropdown with clear options
   - "Single Restaurant" vs "Multiple Restaurants (Bulk)"

2. **Smart defaults:**
   - Default to single-select mode (existing behavior)
   - Bulk mode is opt-in

3. **Help text:**
   ```tsx
   <DialogDescription>
     {allowMultiple
       ? 'Select multiple restaurants to start the same sequence for all at once'
       : 'Choose a restaurant to start a new sequence'
     }
   </DialogDescription>
   ```

4. **Tooltips:**
   ```tsx
   <TooltipProvider>
     <Tooltip>
       <TooltipTrigger>
         <HelpCircle className="h-4 w-4 text-muted-foreground" />
       </TooltipTrigger>
       <TooltipContent>
         <p>Use bulk mode to start the same sequence for multiple restaurants</p>
       </TooltipContent>
     </Tooltip>
   </TooltipProvider>
   ```

**Contingency:** If users are confused:
- Add first-time user walkthrough
- Add "Bulk Mode" tutorial video

---

#### 5. Large Selection Overwhelming UI (LOW)

**Risk:** Selecting 50+ restaurants makes modal hard to use

**Likelihood:** Low
**Impact:** Low (UI crowding)

**Mitigation Strategies:**
1. **Virtualized lists:**
   - Use `react-window` or similar for large lists
   - Only render visible items

2. **Compact display:**
   - Show first 10 restaurants
   - "... and 40 more" summary
   - Expandable to see all

3. **Search/filter in restaurant list:**
   - Allow filtering selected restaurants
   - Quick remove buttons

**Contingency:** If UI is unwieldy:
- Limit bulk mode to 25 restaurants
- Show summary view instead of full list

---

### Data Integrity Risks

#### 6. Task Creation Failures Leave Orphan Instances (MEDIUM)

**Risk:** Sequence instance created but task creation fails, leaving incomplete sequence

**Likelihood:** Low
**Impact:** High (data inconsistency)

**Mitigation Strategies:**
1. **Rollback on task failure:**
   ```javascript
   if (tasksError) {
     await client.from('sequence_instances').delete().eq('id', instance.id);
     // ... log and track failure
   }
   ```
   ✅ **Already implemented in service**

2. **Verify task count:**
   ```javascript
   if (createdTasks.length !== template.sequence_steps.length) {
     // Rollback - incomplete task creation
     await client.from('sequence_instances').delete().eq('id', instance.id);
     throw new Error('Incomplete task creation');
   }
   ```

3. **Health check endpoint:**
   ```javascript
   // GET /api/sequence-instances/health
   // Returns sequences with mismatched task counts
   SELECT si.*, COUNT(t.id) as actual_tasks
   FROM sequence_instances si
   LEFT JOIN tasks t ON t.sequence_instance_id = si.id
   WHERE si.total_steps != COUNT(t.id)
   ```

4. **Background cleanup job:**
   - Runs daily
   - Finds sequences with wrong task count
   - Marks as 'error' status
   - Notifies admins

**Contingency:** If data inconsistency occurs:
- Manual cleanup script
- Database constraint to prevent orphans

---

## Questions & Answers

### Q1: Can StartSequenceModal handle an array of restaurants?

**Answer:** ❌ **No, not in current implementation.**

**Current Interface:**
```typescript
interface StartSequenceModalProps {
  restaurant: Restaurant; // SINGLE object
}
```

**Evidence:**
- Line 111: `Start Sequence for {restaurant.name}` - displays single name
- Line 95-98: `mutateAsync({ restaurant_id: restaurant.id })` - sends single ID
- No conditional logic for arrays

**Recommendation:** Create separate `BulkStartSequenceModal` component.

---

### Q2: Does backend support bulk sequence creation?

**Answer:** ❌ **No, backend is designed for single restaurant.**

**Current Implementation:**
- `startSequence(templateId, restaurantId, options)` - single restaurantId parameter
- All logic operates on single restaurant object
- No bulk endpoint exists

**Required Changes:**
1. New service method: `startSequenceBulk(templateId, restaurantIds, options)`
2. New API endpoint: `POST /api/sequence-instances/bulk`
3. New React Query hook: `useBulkStartSequence()`

---

### Q3: What happens if one restaurant fails while others succeed?

**Answer:** 🟡 **Currently N/A, but designed for partial success in bulk implementation.**

**Planned Behavior:**
- Each restaurant processed independently
- Failures caught and logged
- Operation continues for remaining restaurants
- Returns detailed results:
  ```json
  {
    "succeeded": [/* ... */],
    "failed": [/* ... */],
    "summary": { "total": 10, "success": 8, "failure": 2 }
  }
  ```

**User Experience:**
- Clear visual feedback showing 8 succeeded, 2 failed
- "Retry Failed" button to retry just the 2 failures
- Detailed error messages per failure

---

### Q4: Should there be a limit on how many restaurants can be selected at once?

**Answer:** ✅ **Yes, soft limit of 50, hard limit of 100.**

**Rationale:**
1. **Performance:** 50 restaurants × 5 steps = ~7 second operation (acceptable)
2. **Timeout:** 100 restaurants approaches server timeout limits
3. **UX:** Large selections become hard to manage in UI
4. **Error Handling:** More restaurants = more potential failures to communicate

**Implementation:**
```typescript
const MAX_SELECTION = 100; // Hard limit (error)
const WARN_THRESHOLD = 50; // Soft limit (warning)

if (selectedRestaurants.length > MAX_SELECTION) {
  toast.error(`Maximum ${MAX_SELECTION} restaurants per bulk operation`);
  return;
}

if (selectedRestaurants.length > WARN_THRESHOLD) {
  toast.info('Large selection - operation may take longer...');
}
```

**Future Enhancement:** If demand exists for >100:
- Implement async job queue
- Send email notification when complete
- Show progress page

---

### Q5: How to handle duplicate sequence prevention in bulk?

**Answer:** ✅ **Pre-flight bulk check, then per-restaurant validation.**

**Implementation:**

**Step 1: Bulk Duplicate Check (Optimization)**
```javascript
// Check for ALL duplicates in one query
const { data: existingSequences } = await client
  .from('sequence_instances')
  .select('restaurant_id')
  .eq('sequence_template_id', templateId)
  .in('restaurant_id', restaurantIds) // Bulk IN clause
  .eq('status', 'active');

const existingSet = new Set(existingSequences.map(s => s.restaurant_id));
```

**Step 2: Per-Restaurant Validation**
```javascript
for (const restaurantId of restaurantIds) {
  if (existingSet.has(restaurantId)) {
    results.failed.push({
      restaurant_id: restaurantId,
      error: 'Active sequence already exists',
      reason: 'duplicate'
    });
    continue; // Skip this restaurant, continue with others
  }

  // ... create sequence
}
```

**Benefits:**
- Single database query for all duplicates (fast)
- Clear error categorization
- User can see which restaurants were duplicates
- Can retry with different selection

---

### Q6: What about variable replacement performance?

**Answer:** 🟡 **Acceptable for <50 restaurants, may need optimization for >50.**

**Current Performance:**
- ~10ms per variable replacement call (estimated)
- Called 2× per task (message + subject)
- 50 restaurants × 5 steps × 2 = 500 calls = ~5 seconds

**Optimization Options (if needed):**

1. **Batch variable replacement:**
   ```javascript
   // Replace for all restaurants at once
   const renderedMessages = await variableReplacementService
     .replaceVariablesBulk(message, restaurants);
   ```

2. **Cache restaurant data:**
   ```javascript
   // Pre-fetch all restaurant data once
   const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
   // Reuse in variable replacement
   ```

3. **Parallel processing:**
   ```javascript
   // Use Promise.all for concurrent replacements
   const renderPromises = steps.map(step =>
     variableReplacementService.replaceVariables(step.message, restaurant)
   );
   const rendered = await Promise.all(renderPromises);
   ```

**Recommendation:** Start with current implementation (acceptable for 50), optimize if users regularly exceed 50.

---

### Q7: How to communicate progress to the user?

**Answer:** ✅ **Real-time progress bar + current restaurant name.**

**Implementation:**

**Option A: Client-Side Tracking (Simpler)**
```typescript
const [progress, setProgress] = useState({ completed: 0, total: 0 });

// In mutation callback (if streaming supported):
onProgress: (current, total) => {
  setProgress({ completed: current, total });
}
```

**Option B: Server-Sent Events (Better UX)**
```javascript
// Backend sends progress events
router.post('/bulk', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');

  for (const restaurantId of restaurantIds) {
    // ... create sequence
    res.write(`data: ${JSON.stringify({
      completed: index + 1,
      total: restaurantIds.length,
      current: restaurant.name
    })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true, results })}\n\n`);
  res.end();
});
```

**Option C: Polling (Most Compatible)**
```typescript
// Store operation in cache with ID
const operationId = uuid();
await cache.set(`bulk-op:${operationId}`, {
  status: 'in_progress',
  completed: 0,
  total: restaurantIds.length
});

// Frontend polls every 500ms
const interval = setInterval(async () => {
  const status = await fetch(`/api/bulk-operations/${operationId}/status`);
  setProgress(status.data);
  if (status.data.done) clearInterval(interval);
}, 500);
```

**✅ Recommended: Option A (Client-Side Tracking)**
- Simplest to implement
- Works with standard REST
- No server state management
- Good enough for <100 restaurants (<10 second operations)

**UI Design:**
```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium">Creating sequences...</span>
    <span className="text-sm text-muted-foreground">
      {progress.completed} of {progress.total}
    </span>
  </div>
  <Progress value={(progress.completed / progress.total) * 100} />
  <div className="text-xs text-muted-foreground">
    Currently processing: {progress.current_restaurant_name}
  </div>
</div>
```

---

## Recommendations

### Implementation Priority

**✅ RECOMMENDED APPROACH:**

1. **Phase 1:** Frontend - SelectRestaurantForSequenceModal Enhancement (2-3 hours)
   - Low risk (backward compatible)
   - Can be tested independently
   - Reusable for other bulk operations

2. **Phase 2:** Backend - Bulk Service & Endpoint (3-4 hours)
   - Separate endpoint (no risk to existing)
   - Thorough error handling
   - Can be tested with Postman/API tools

3. **Phase 3:** Frontend - BulkStartSequenceModal (3-4 hours)
   - Depends on Phases 1 & 2
   - Most complex UI
   - Comprehensive testing needed

4. **Phase 4:** Integration - Sequences.tsx Updates (1-2 hours)
   - Simple state management
   - Wire up all components

5. **Phase 5:** Testing & Polish (2-3 hours)
   - E2E testing
   - Performance validation
   - Edge case handling

**Total Estimated Time:** 11-16 hours

---

### Alternative Approach (If Time Constrained)

**MVP Implementation (6-8 hours):**

1. **Skip multi-select in SelectRestaurantForSequenceModal**
   - Keep single-select only
   - Add separate "Bulk Start" page/modal

2. **Simplified bulk UI:**
   - Text input: "Enter restaurant IDs (comma-separated)"
   - Template selector
   - Simple results list (no progress bar)

3. **Backend same as recommended**
   - Full bulk endpoint with error handling

4. **Basic testing:**
   - Happy path only
   - No retry functionality

**Pros:** Faster to implement
**Cons:** Worse UX, harder to use, limited polish

**✅ Recommendation:** Go with full implementation. Extra 4-8 hours yields much better UX.

---

### Monitoring & Observability

**Recommended Additions:**

1. **Logging:**
   ```javascript
   console.log(`[Bulk Sequence] Starting for ${restaurantIds.length} restaurants`);
   console.log(`[Bulk Sequence] Template: ${templateId}`);
   console.log(`[Bulk Sequence] Result: ${results.summary.success} succeeded, ${results.summary.failure} failed`);
   ```

2. **Metrics:**
   - Track bulk operation count
   - Track average restaurants per bulk operation
   - Track success/failure rates
   - Track average operation duration

3. **Alerts:**
   - Alert if bulk operation >30 seconds
   - Alert if >50% failure rate
   - Alert if server errors

4. **Audit Trail:**
   ```sql
   CREATE TABLE bulk_sequence_operations (
     id UUID PRIMARY KEY,
     created_by UUID,
     template_id UUID,
     restaurant_count INTEGER,
     success_count INTEGER,
     failure_count INTEGER,
     duration_ms INTEGER,
     created_at TIMESTAMP
   );
   ```

---

### Future Enhancements (Out of Scope)

1. **Async Job Queue:**
   - For 100+ restaurant operations
   - Email notification when complete
   - Background processing

2. **Scheduling:**
   - "Start sequences at specific time"
   - Useful for coordinated campaigns

3. **Templates for Bulk:**
   - "Save bulk selection as list"
   - "Reuse list for future sequences"

4. **Advanced Filtering:**
   - "Select all restaurants matching criteria"
   - Integration with saved filters

5. **Dry Run Mode:**
   - "Preview what will be created"
   - No actual creation until confirmed

---

## Investigation Summary

### Feasibility: ✅ FULLY FEASIBLE

**Key Findings:**
1. ✅ Current architecture supports bulk extension
2. ✅ No database schema changes required
3. ✅ Clean separation possible (no risk to existing functionality)
4. ✅ MultiSelect component already exists and works well
5. ✅ Error handling can be comprehensive
6. ✅ Performance acceptable for reasonable limits (50-100 restaurants)

### Complexity: MEDIUM-HIGH

**Breakdown:**
- Frontend (SelectRestaurantForSequenceModal): MEDIUM (2-3 hours)
- Frontend (BulkStartSequenceModal): MEDIUM-HIGH (3-4 hours)
- Backend (Service + Endpoint): MEDIUM (3-4 hours)
- Integration: LOW (1-2 hours)
- Testing: MEDIUM (2-3 hours)

**Total:** 11-16 hours

### Risk: MEDIUM

**Primary Risks:**
1. Performance (mitigated with limits)
2. Partial failure UX (mitigated with clear UI)
3. Data integrity (mitigated with rollback)

**Overall Risk Level:** ACCEPTABLE

---

## Next Steps

### Immediate Actions:

1. **Review Investigation with Stakeholders**
   - Confirm approach (hybrid with separate bulk modal)
   - Approve restaurant limits (50 soft, 100 hard)
   - Confirm error handling strategy (partial success)

2. **Create Implementation Plan Document**
   - Detailed step-by-step implementation guide
   - Code snippets and examples
   - Testing checklist
   - Timeline and milestones

3. **Set Up Development Environment**
   - Create feature branch: `feature/bulk-sequence-creation`
   - Set up testing data (50+ test restaurants)
   - Prepare monitoring/logging

4. **Begin Implementation**
   - Start with Phase 1 (SelectRestaurantForSequenceModal)
   - Validate approach with working prototype
   - Iterate based on findings

---

**Investigation Status:** ✅ **COMPLETE**
**Ready for Implementation:** ✅ **YES**
**Recommended Start Date:** Immediately after approval

**Date Completed:** November 24, 2025
**Prepared By:** Claude Code
**Document Version:** 1.0

---

**End of Investigation Report**
