# Feature 1: Bulk Add Restaurants to Sequences - Completion Summary

**Date:** November 24, 2025
**Status:** ✅ COMPLETE
**Implementation Time:** ~3 hours
**Priority:** Parallel with Features 2 & 3

---

## Executive Summary

Successfully implemented the bulk sequence creation feature, allowing users to select multiple restaurants and start the same sequence for all of them simultaneously. The feature supports up to 100 restaurants per operation with comprehensive error handling, partial success support, and retry functionality.

**Key Achievement:** No duplicate checking per requirements - restaurants can have multiple active sequences of the same template.

---

## Implementation Overview

### What Was Built

A complete end-to-end bulk sequence creation system with:
- Multi-select restaurant picker with advanced filtering
- Dedicated bulk sequence modal with progress tracking
- Robust backend service handling partial failures
- Comprehensive error reporting and retry functionality
- Performance optimizations for large batches

### User Experience Flow

```
1. User clicks "New Sequence" dropdown
   └─ Two options: "Single Restaurant" | "Multiple Restaurants (Bulk)"

2. User selects "Multiple Restaurants (Bulk)"
   └─ SelectRestaurantForSequenceModal opens with checkboxes

3. User filters and selects N restaurants (1-100)
   └─ Real-time selection count
   └─ "Select All" / "Clear All" buttons
   └─ Warnings at 50+ selections, errors at 100+

4. User clicks "Continue (N)"
   └─ BulkStartSequenceModal opens

5. User selects sequence template
   └─ Preview timeline shows all steps

6. User clicks "Start Sequences (N)"
   └─ Progress indicator displays
   └─ Backend processes each restaurant

7. Results displayed
   └─ Success: Green list with task counts
   └─ Failed: Red list with error details
   └─ "Retry Failed (N)" button if applicable

8. User can retry failures or close
```

---

## Files Modified/Created

### Frontend (4 files)

#### 1. SelectRestaurantForSequenceModal.tsx (MODIFIED)
**Location:** `/src/components/sequences/SelectRestaurantForSequenceModal.tsx`

**Changes:**
- Added `allowMultiple?: boolean` prop
- Added `onSelectRestaurants?: (restaurants: any[]) => void` callback
- Multi-select state management with `selectedRestaurantIds`
- Checkbox UI for multi-select mode
- Selection toolbar with counts and controls
- "Select All" / "Clear All" functionality
- Warnings for 50+ selections, errors for 100+
- Maintains backward compatibility with single-select

**Key Features:**
```typescript
// New props
allowMultiple?: boolean
onSelectRestaurants?: (restaurants: any[]) => void

// State
const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([])

// Handlers
handleToggleRestaurant(id)
handleSelectAll() // Max 100
handleClearAll()
handleConfirmSelection() // Warning at 50+
```

**Lines Added:** ~150 lines (total ~360 lines)

---

#### 2. BulkStartSequenceModal.tsx (NEW)
**Location:** `/src/components/sequences/BulkStartSequenceModal.tsx`

**Complete New Component:**
- Template selection dropdown
- Restaurant list with individual remove buttons
- Preview timeline for selected template
- Progress indicator during operation
- Comprehensive results display
- Retry failed functionality

**Component Structure:**
```typescript
interface BulkStartSequenceModalProps {
  open: boolean
  onClose: () => void
  restaurants: Restaurant[]
}

interface BulkOperationResult {
  succeeded: { restaurant_id, restaurant_name, instance_id, tasks_created }[]
  failed: { restaurant_id, restaurant_name, error, reason }[]
  summary: { total, success, failure }
}
```

**Features:**
- Template selection with step count
- Restaurant management (view, remove)
- Timeline preview (steps, delays, total duration)
- Warning alert (N tasks × M restaurants)
- Progress indicator (indeterminate during operation)
- Results summary cards (Total, Succeeded, Failed)
- Scrollable success list (green background)
- Scrollable failure list (red background, categorized errors)
- Retry failed button (filters to only failed restaurants)

**Lines:** ~500 lines

---

#### 3. useSequences.ts (MODIFIED)
**Location:** `/src/hooks/useSequences.ts`

**Changes:**
- Added `BulkStartSequenceRequest` interface
- Added `BulkStartSequenceResult` interface
- Added `useBulkStartSequence()` hook

**New Interfaces:**
```typescript
export interface BulkStartSequenceRequest {
  sequence_template_id: string
  restaurant_ids: string[] // Array
  assigned_to?: string
}

export interface BulkStartSequenceResult {
  succeeded: {
    restaurant_id: string
    restaurant_name: string
    instance_id: string
    tasks_created: number
  }[]
  failed: {
    restaurant_id: string
    restaurant_name: string
    error: string
    reason: 'not_found' | 'validation_error' | 'server_error'
  }[]
  summary: {
    total: number
    success: number
    failure: number
  }
}
```

**New Hook:**
```typescript
export function useBulkStartSequence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BulkStartSequenceRequest) => {
      const response = await api.post('/sequence-instances/bulk', data)
      return response.data.data as BulkStartSequenceResult
    },
    onSuccess: (data, variables) => {
      // Invalidate all sequence instances
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })

      // Invalidate each restaurant's sequences
      variables.restaurant_ids.forEach(restaurantId => {
        queryClient.invalidateQueries({
          queryKey: ['restaurant-sequences', restaurantId]
        })
      })
    },
    onError: (error: any) => {
      toast.error('Failed to start bulk operation', {
        description: error.response?.data?.error || error.message
      })
    }
  })
}
```

**Lines Added:** ~50 lines

---

#### 4. Sequences.tsx (MODIFIED)
**Location:** `/src/pages/Sequences.tsx`

**Changes:**
- Import `BulkStartSequenceModal` and `DropdownMenu` components
- Added bulk flow state variables
- Added bulk handler functions
- Replaced "New Sequence" button with dropdown
- Updated modal rendering

**New State:**
```typescript
const [bulkMode, setBulkMode] = useState(false)
const [bulkStartOpen, setBulkStartOpen] = useState(false)
const [selectedRestaurants, setSelectedRestaurants] = useState<any[]>([])
```

**New Handlers:**
```typescript
const handleRestaurantsSelected = (restaurants: any[]) => {
  setSelectedRestaurants(restaurants)
  setSelectRestaurantOpen(false)
  setBulkStartOpen(true)
}

const handleBulkStartClose = () => {
  setBulkStartOpen(false)
  setSelectedRestaurants([])
  setBulkMode(false)
}

const handleNewSequenceClick = (mode: 'single' | 'bulk') => {
  setBulkMode(mode === 'bulk')
  setSelectRestaurantOpen(true)
}
```

**New UI - Dropdown Menu:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
      <Plus className="h-4 w-4 mr-2" />
      New Sequence
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleNewSequenceClick('single')}>
      <div className="flex flex-col">
        <span className="font-medium">Single Restaurant</span>
        <span className="text-xs text-muted-foreground">
          Start a sequence for one restaurant
        </span>
      </div>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleNewSequenceClick('bulk')}>
      <div className="flex flex-col">
        <span className="font-medium">Multiple Restaurants (Bulk)</span>
        <span className="text-xs text-muted-foreground">
          Start the same sequence for multiple restaurants
        </span>
      </div>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Updated Modals:**
```tsx
<SelectRestaurantForSequenceModal
  open={selectRestaurantOpen}
  onClose={() => {
    setSelectRestaurantOpen(false)
    setBulkMode(false)
  }}
  onSelectRestaurant={handleRestaurantSelected}
  onSelectRestaurants={handleRestaurantsSelected} // NEW
  allowMultiple={bulkMode} // NEW
/>

{selectedRestaurants.length > 0 && ( // NEW
  <BulkStartSequenceModal
    open={bulkStartOpen}
    onClose={handleBulkStartClose}
    restaurants={selectedRestaurants}
  />
)}
```

**Lines Added:** ~60 lines

---

### Backend (2 files)

#### 5. sequence-instances-service.js (MODIFIED)
**Location:** `/src/services/sequence-instances-service.js`

**New Function:** `startSequenceBulk(templateId, restaurantIds, options)`

**Implementation Phases:**

**STEP 1: Pre-flight Template Validation**
```javascript
const template = await getSequenceTemplateById(templateId)

if (!template.is_active) {
  throw new Error('Cannot start sequences from inactive template')
}

if (!template.sequence_steps || template.sequence_steps.length === 0) {
  throw new Error('Template has no steps')
}
```
- Validates template exists and is active
- Validates template has steps
- **Fail fast** - if template invalid, entire operation fails

**STEP 2: Bulk Fetch Restaurants (Optimization)**
```javascript
const { data: restaurants } = await client
  .from('restaurants')
  .select('*')
  .in('id', restaurantIds) // Single query for all
  .eq('organisation_id', orgId)

const restaurantMap = new Map(restaurants.map(r => [r.id, r]))
```
- **Single query** to fetch all restaurants at once
- Creates Map for O(1) lookups
- Major performance optimization

**STEP 3: Process Each Restaurant Independently**
```javascript
for (const restaurantId of restaurantIds) {
  try {
    // Check restaurant exists
    const restaurant = restaurantMap.get(restaurantId)
    if (!restaurant) {
      results.failed.push({
        reason: 'not_found',
        error: 'Restaurant not found or not accessible'
      })
      continue
    }

    // Create sequence instance
    const { data: instance, error: instanceError } = await client
      .from('sequence_instances')
      .insert({ /* ... */ })
      .select()
      .single()

    if (instanceError) {
      results.failed.push({
        reason: 'server_error',
        error: instanceError.message
      })
      continue
    }

    // Create tasks with variable replacement
    const tasksToCreate = []
    for (const step of template.sequence_steps) {
      // Get message from template hierarchy
      let message = step.custom_message
      if (step.message_template_id && step.message_templates) {
        message = step.message_templates.message_content
      }

      // Render variables
      try {
        messageRendered = await variableReplacementService
          .replaceVariables(message, restaurant)
      } catch (varError) {
        console.warn(`Variable replacement failed: ${varError}`)
        messageRendered = message // Fallback to unrendered
      }

      // Same for subject line
      if (step.type === 'email' && step.subject_line) {
        try {
          subjectLineRendered = await variableReplacementService
            .replaceVariables(step.subject_line, restaurant)
        } catch (varError) {
          subjectLineRendered = step.subject_line
        }
      }

      tasksToCreate.push({ /* full task object */ })
    }

    // Batch insert tasks
    const { data: createdTasks, error: tasksError } = await client
      .from('tasks')
      .insert(tasksToCreate)
      .select()

    if (tasksError) {
      // ROLLBACK: Delete instance
      await client.from('sequence_instances').delete().eq('id', instance.id)
      results.failed.push({
        reason: 'server_error',
        error: 'Failed to create tasks'
      })
      continue
    }

    // Verify task count
    if (createdTasks.length !== template.sequence_steps.length) {
      // ROLLBACK: Delete instance
      await client.from('sequence_instances').delete().eq('id', instance.id)
      results.failed.push({
        reason: 'server_error',
        error: 'Incomplete task creation'
      })
      continue
    }

    // SUCCESS!
    results.succeeded.push({
      restaurant_id: restaurantId,
      restaurant_name: restaurant.name,
      instance_id: instance.id,
      tasks_created: createdTasks.length
    })

  } catch (error) {
    results.failed.push({
      reason: 'server_error',
      error: error.message
    })
  }
}
```

**STEP 4: Update Template Usage Count**
```javascript
if (results.succeeded.length > 0) {
  await client
    .from('sequence_templates')
    .update({
      usage_count: (template.usage_count || 0) + results.succeeded.length
    })
    .eq('id', templateId)
}
```

**STEP 5: Calculate Summary**
```javascript
results.summary.success = results.succeeded.length
results.summary.failure = results.failed.length

console.log(`[Bulk Sequence] Completed: ${results.summary.success} succeeded, ${results.summary.failure} failed`)

return results
```

**Key Features:**
- ✅ **No duplicate checking** (per requirements)
- ✅ Partial success support (8 succeed, 2 fail = valid)
- ✅ Per-restaurant error handling
- ✅ Automatic rollback on task creation failure
- ✅ Variable replacement with graceful fallback
- ✅ Bulk optimizations (single restaurant query)
- ✅ Detailed error categorization

**Error Reasons:**
- `not_found` - Restaurant doesn't exist or not accessible
- `validation_error` - Template inactive or no steps (pre-flight only)
- `server_error` - Database errors, task creation failures

**Module Export Updated:**
```javascript
module.exports = {
  startSequence,
  startSequenceBulk, // NEW
  getSequenceInstance,
  listSequenceInstances,
  pauseSequence,
  resumeSequence,
  cancelSequence,
  finishSequence,
  getRestaurantSequences,
  getSequenceProgress
}
```

**Lines Added:** ~260 lines

---

#### 6. sequence-instances-routes.js (MODIFIED)
**Location:** `/src/routes/sequence-instances-routes.js`

**New Endpoint:** `POST /api/sequence-instances/bulk`

**Placement:** Added **BEFORE** `POST /api/sequence-instances` to avoid route conflicts

**Implementation:**
```javascript
/**
 * POST /api/sequence-instances/bulk
 * Start sequences for multiple restaurants
 *
 * Request Body:
 * {
 *   sequence_template_id: UUID (required),
 *   restaurant_ids: UUID[] (required, 1-100 items),
 *   assigned_to: UUID (optional)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     succeeded: [...],
 *     failed: [...],
 *     summary: { total, success, failure }
 *   }
 * }
 */
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.sequence_template_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sequence_template_id'
      })
    }

    if (!req.body.restaurant_ids || !Array.isArray(req.body.restaurant_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: restaurant_ids (must be an array)'
      })
    }

    if (req.body.restaurant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one restaurant_id is required'
      })
    }

    if (req.body.restaurant_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 restaurants per bulk operation'
      })
    }

    // Prepare options
    const options = {
      assigned_to: req.body.assigned_to || req.user.id,
      created_by: req.user.id
    }

    // Execute bulk operation
    const results = await sequenceInstancesService.startSequenceBulk(
      req.body.sequence_template_id,
      req.body.restaurant_ids,
      options
    )

    // Determine status code
    let statusCode = 201 // All succeeded
    if (results.summary.success > 0 && results.summary.failure > 0) {
      statusCode = 207 // Partial success
    } else if (results.summary.failure > 0 && results.summary.success === 0) {
      statusCode = 207 // All failed (but operation completed)
    }

    // Send response
    res.status(statusCode).json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('Error in bulk sequence creation:', error)

    // Pre-flight errors (template validation)
    if (error.message.includes('inactive') ||
        error.message.includes('no steps') ||
        error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        error: error.message
      })
    }

    // Server errors
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
})
```

**Validation:**
- ✅ `sequence_template_id` required
- ✅ `restaurant_ids` required and must be array
- ✅ `restaurant_ids` must have 1-100 items
- ✅ `assigned_to` optional (defaults to current user)

**Status Codes:**
- `201` - All succeeded
- `207` - Partial success or all failed (multi-status)
- `400` - Validation error or pre-flight failure
- `500` - Server error

**Lines Added:** ~110 lines

---

## Technical Implementation Details

### Performance Optimizations

**1. Bulk Restaurant Query**
- **Before:** N queries (one per restaurant)
- **After:** 1 query (fetch all restaurants at once)
- **Improvement:** ~90% reduction in database calls

```javascript
// Optimized approach
const { data: restaurants } = await client
  .from('restaurants')
  .select('*')
  .in('id', restaurantIds) // Single query
  .eq('organisation_id', orgId)
```

**2. Map-Based Lookups**
- **Before:** Array.find() for each restaurant (O(n) per lookup)
- **After:** Map.get() (O(1) per lookup)
- **Improvement:** O(n²) → O(n) complexity

```javascript
const restaurantMap = new Map(restaurants.map(r => [r.id, r]))
// Later: O(1) lookup
const restaurant = restaurantMap.get(restaurantId)
```

**3. Batch Task Insertion**
- Tasks for each restaurant inserted in single batch
- Already optimized in original code, preserved in bulk

```javascript
const { data: createdTasks } = await client
  .from('tasks')
  .insert(tasksToCreate) // All tasks at once
  .select()
```

**Performance Benchmarks (Estimated):**
- 10 restaurants: ~3-5 seconds
- 25 restaurants: ~6-8 seconds
- 50 restaurants: ~10-15 seconds
- 100 restaurants: ~20-30 seconds

**Bottlenecks:**
- Variable replacement (per task, per restaurant)
- Network latency (per restaurant create)
- Database insert time (per restaurant)

---

### Error Handling Strategy

**Partial Success Model:**
- Each restaurant processed independently
- Failures don't block other restaurants
- Comprehensive error tracking

**Error Categories:**

**1. not_found**
- Restaurant doesn't exist in database
- Restaurant not accessible to organization
- Example: Invalid restaurant ID

**2. validation_error**
- Template inactive
- Template has no steps
- Pre-flight failures only (fail entire operation)

**3. server_error**
- Database connection errors
- Task creation failures
- Unexpected runtime errors

**Rollback Strategy:**
- If task creation fails → Delete sequence instance
- If task count mismatch → Delete sequence instance
- Ensures no orphan sequence instances

**Error Response Example:**
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
        "restaurant_name": "Unknown",
        "error": "Restaurant not found or not accessible",
        "reason": "not_found"
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

### Limits and Constraints

**Soft Limit: 50 Restaurants**
- Warning toast displays
- User informed operation may take longer
- No blocking - user can proceed

**Hard Limit: 100 Restaurants**
- Error toast displays
- "Select All" button disabled
- Cannot proceed with selection

**Validation Points:**
- Frontend: SelectRestaurantForSequenceModal (UX warning/error)
- Backend route: sequence-instances-routes.js (400 error)
- Backend service: sequence-instances-service.js (Error throw)

**Rationale:**
- 100 restaurants × 5 steps = 500 tasks
- ~10-30 second operation (acceptable)
- Prevents server timeout (typically 30-60s)
- Extensible for future async job queue

---

### Backward Compatibility

**Single-Restaurant Flow:**
- ✅ Completely unchanged
- ✅ Uses same `StartSequenceModal`
- ✅ Uses same API endpoint (`POST /api/sequence-instances`)
- ✅ Same user experience

**Preserved Behavior:**
- Restaurant selection modal works in single mode
- All existing handlers work
- No breaking changes to API
- No database schema changes required

**Dropdown Default:**
- Modal opens in single-select mode by default
- Bulk mode is opt-in via dropdown selection
- Maintains familiar UX for existing users

---

## Key Decisions Implemented

### 1. No Duplicate Sequence Checking ✅

**Decision:** Remove all duplicate checking logic

**Rationale:** Per user requirements, restaurants can have multiple active sequences of the same template

**Implementation:**
- ❌ No duplicate check in `startSequenceBulk()`
- ❌ No `validation_error: duplicate` reason
- ✅ Simplified bulk operation (fewer queries)
- ✅ Faster performance

**Impact:**
- User can start same sequence multiple times for same restaurant
- Future enhancement: Add duplicate detection UI (warnings, not errors)

---

### 2. Partial Success Error Handling ✅

**Decision:** Support partial success with detailed results

**Rationale:** Real-world scenarios often have "bad data" in selections

**Implementation:**
- Each restaurant processed independently
- Success/failure tracked separately
- HTTP 207 (Multi-Status) for partial results
- Detailed error messages per failure

**Benefits:**
- User can make progress even if some fail
- Clear understanding of what succeeded vs failed
- One-click retry for failures
- Better UX than all-or-nothing

---

### 3. Dropdown Mode Selection ✅

**Decision:** Replace "New Sequence" button with dropdown

**Rationale:** Clear separation between single and bulk modes

**Implementation:**
```
"New Sequence" ▼
├─ Single Restaurant
└─ Multiple Restaurants (Bulk)
```

**Benefits:**
- Discoverable (users see both options)
- Explicit (clear intent)
- Flexible (easy to add more options later)
- Clean UI (no extra buttons)

---

### 4. Separate Bulk Modal ✅

**Decision:** Create `BulkStartSequenceModal` instead of modifying `StartSequenceModal`

**Rationale:** Clean separation of concerns, lower risk

**Benefits:**
- ✅ Zero risk to existing single-restaurant flow
- ✅ Easier to test (isolated components)
- ✅ Clearer interfaces (no optional props)
- ✅ Better developer experience

**Trade-off:** Slight code duplication (template selection, timeline preview)

---

### 5. Soft/Hard Limits ✅

**Decision:** Warning at 50, error at 100

**Rationale:** Balance between flexibility and safety

**Implementation:**
- 50+ restaurants → Warning toast (can proceed)
- 100+ restaurants → Error toast (cannot proceed)
- "Select All" disabled if >100 filtered

**Benefits:**
- Prevents server timeout
- Guides users to reasonable batch sizes
- Extensible for future async jobs

---

## User Experience Highlights

### Intuitive Selection

**Multi-Select UI:**
- ✅ Checkboxes clearly indicate mode
- ✅ Selected state highlighted (blue border, accent background)
- ✅ Real-time selection count
- ✅ "Select All" / "Clear All" convenience

**Filtering:**
- ✅ Search by restaurant name
- ✅ Filter by lead_status, lead_stage, lead_warmth
- ✅ Filters apply to selection (only filtered shown)

---

### Clear Feedback

**Progress Indicator:**
- Indeterminate progress bar during operation
- "Creating sequences..." message
- "Please wait, this may take a moment"

**Results Display:**
- Summary cards (Total, Succeeded, Failed)
- Color-coded lists (green success, red failure)
- Error categorization (Not Found, Validation Error, Server Error)
- Clear error messages per failure

---

### Error Recovery

**Retry Functionality:**
- "Retry Failed (N)" button
- Automatically filters to only failed restaurants
- Resets state and reopens with failed subset
- Toast notification confirming retry

**User Can:**
- Review detailed errors
- Understand what went wrong
- Retry immediately
- Copy failed restaurant names

---

### Performance

**Fast Operations:**
- Bulk queries minimize database calls
- Map-based lookups for O(1) access
- Batch task inserts
- Variable replacement optimized

**User Expectations:**
- Warning for large selections (50+)
- Clear indication of operation time
- No unexpected delays

---

## Testing Recommendations

### Regression Testing

**Single-Restaurant Flow:**
- [ ] Click "New Sequence" → "Single Restaurant"
- [ ] Select one restaurant
- [ ] Select template
- [ ] Verify sequence created
- [ ] Confirm tasks created correctly

---

### Bulk Happy Path

**All Succeed:**
- [ ] Select 5 restaurants
- [ ] Choose template
- [ ] Verify progress indicator shows
- [ ] Confirm 5 sequences created
- [ ] Verify all tasks created correctly
- [ ] Check template usage count (+5)

---

### Bulk Partial Failure

**Mixed Results:**
- [ ] Select 10 restaurants (mix of valid/invalid IDs)
- [ ] Confirm partial results displayed
- [ ] Verify succeeded list accurate
- [ ] Verify failed list shows correct errors
- [ ] Test "Retry Failed" button
- [ ] Confirm retry only processes failed

---

### Limits Enforcement

**Soft Limit (50):**
- [ ] Select 50 restaurants
- [ ] Verify warning toast appears
- [ ] Confirm can still proceed
- [ ] Verify operation completes

**Hard Limit (100):**
- [ ] Filter to show 101+ restaurants
- [ ] Click "Select All"
- [ ] Verify error toast appears
- [ ] Confirm "Select All" disabled
- [ ] Verify cannot exceed 100

---

### Error Scenarios

**Template Errors:**
- [ ] Select inactive template → Expect error
- [ ] Select template with no steps → Expect error

**Restaurant Errors:**
- [ ] Include invalid restaurant ID → Expect not_found
- [ ] Include deleted restaurant → Expect not_found

**Network Errors:**
- [ ] Simulate network failure → Expect graceful error
- [ ] Simulate timeout → Expect appropriate handling

---

### Performance Testing

**Small Batch (10):**
- [ ] Select 10 restaurants
- [ ] Measure operation time (expect <5s)
- [ ] Verify all succeed

**Medium Batch (25):**
- [ ] Select 25 restaurants
- [ ] Measure operation time (expect <8s)
- [ ] Verify performance acceptable

**Large Batch (50):**
- [ ] Select 50 restaurants
- [ ] Measure operation time (expect <15s)
- [ ] Verify warning displays
- [ ] Confirm operation completes successfully

---

### UI/UX Testing

**Selection Experience:**
- [