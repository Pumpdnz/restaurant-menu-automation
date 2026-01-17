# Investigation: Updating Restaurant last_contacted on Task Completion

**Status: IMPLEMENTED** (2025-11-28)

## Overview

This investigation examines the best approach to automatically update a restaurant's `last_contacted` timestamp whenever a task associated with that restaurant is marked as completed.

## Current State

### Database Schema

**tasks table** (relevant columns):
- `id` (uuid) - Primary key
- `restaurant_id` (uuid, nullable) - Foreign key to restaurants
- `status` (text) - Values: 'pending', 'active', 'completed', 'cancelled'
- `completed_at` (timestamp) - Set when task is completed
- `type` (text) - Task types: 'internal_activity', 'email', 'call', 'social_message', 'text', 'demo_meeting'

**restaurants table** (relevant columns):
- `id` (uuid) - Primary key
- `last_contacted` (timestamp with time zone, nullable) - Currently manually managed
- `updated_at` (timestamp) - Auto-updated via trigger

### Existing Trigger Pattern

The database already has a well-established trigger pattern for auto-updating timestamps:

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
```

There are 26 existing triggers in the database using this pattern across tables including:
- `tasks` - update_tasks_updated_at (BEFORE UPDATE)
- `restaurants` - update_restaurants_updated_at (BEFORE UPDATE)
- `social_media_images` - sm_images_completed_at (demonstrates conditional trigger logic)

### Current Task Completion Flow

All task completions go through a **single centralized function**:

**File**: `src/services/tasks-service.js:351-385`

```javascript
async function completeTask(id) {
  const client = getSupabaseClient();

  // Update task status
  const { data: task, error } = await client
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  // ... sequence progression hook ...

  return task;
}
```

### UI Components That Complete Tasks

All of these call `api.patch('/tasks/:id/complete')` which routes to `tasksService.completeTask()`:

| Component | File | Completion Methods |
|-----------|------|-------------------|
| Tasks.tsx | pages/Tasks.tsx:461,471,488,528 | handleCompleteTask, handleCompleteWithFollowUp, handleCompleteWithStartSequence, handleStatusChange |
| TaskTypeQuickView.tsx | components/tasks/TaskTypeQuickView.tsx:81,107,133 | handleCompleteTask, handleCompleteWithFollowUp, handleCompleteWithStartSequence |
| RestaurantTasksList.tsx | components/tasks/RestaurantTasksList.tsx:162,200,218,249 | handleStatusChange, handleCompleteTask, handleCompleteAndFollowUp, handleCompleteAndStartSequence |
| SequenceTaskList.tsx | components/sequences/SequenceTaskList.tsx:98,123,143,175 | handleStatusChange, handleCompleteTask, handleCompleteAndFollowUp, handleCompleteAndStartSequence |

### Current last_contacted Usage

The `last_contacted` field is currently:
1. **Used in variable replacement** - `last_contacted_day` variable in templates (src/services/variable-replacement-service.js:296)
2. **Displayed in RestaurantDetail** and Restaurants pages
3. **Manually updated** - No automatic update mechanism exists
4. **Sample data shows inconsistency** - Some completed tasks have restaurants with `null` last_contacted

---

## Analysis: Database Trigger vs Application-Level Update

### Option 1: Database Trigger (Recommended)

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION update_restaurant_last_contacted_on_task_complete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only trigger when status changes TO 'completed'
    IF NEW.status = 'completed'
       AND (OLD.status IS DISTINCT FROM 'completed')
       AND NEW.restaurant_id IS NOT NULL THEN

        UPDATE restaurants
        SET last_contacted = CURRENT_TIMESTAMP
        WHERE id = NEW.restaurant_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE TRIGGER update_last_contacted_on_task_complete
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_restaurant_last_contacted_on_task_complete();
```

**Advantages**:
1. **Guaranteed consistency** - Cannot be bypassed regardless of how task is completed
2. **Single source of truth** - Logic lives in one place
3. **Works for all entry points** - API, direct DB updates, migrations, admin tools
4. **No code changes required** - Existing codebase works without modification
5. **Follows existing patterns** - Database already uses triggers for similar functionality
6. **Atomic operations** - Update happens in same transaction as task completion
7. **Future-proof** - New completion methods automatically work

**Disadvantages**:
1. **Hidden logic** - Developers might not realize the side effect exists
2. **Testing complexity** - Requires database for integration tests
3. **Migration required** - Needs database migration to deploy

### Option 2: Application-Level Update

**Implementation**: Modify `completeTask()` in tasks-service.js

```javascript
async function completeTask(id) {
  const client = getSupabaseClient();

  // Update task status
  const { data: task, error } = await client
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error completing task:', error);
    throw error;
  }

  // Update restaurant last_contacted
  if (task.restaurant_id) {
    await client
      .from('restaurants')
      .update({ last_contacted: new Date().toISOString() })
      .eq('id', task.restaurant_id);
  }

  // ... sequence progression hook ...

  return task;
}
```

**Advantages**:
1. **Explicit logic** - Clear in code what happens
2. **Easier to test** - Can mock database calls
3. **No migration needed** - Pure code change

**Disadvantages**:
1. **Bypass risk** - Direct DB updates won't trigger update
2. **Code duplication risk** - If new completion paths are added
3. **Non-atomic** - Two separate database calls
4. **Already has hook pattern** - Would add another side effect to an already complex function

---

## Recommendation: Database Trigger

**Rationale**:

1. **Centralization is already established** - The codebase already centralizes task completion through `tasksService.completeTask()`, but the database trigger provides an additional safety net.

2. **Existing pattern** - The database already uses triggers for automatic timestamp updates (`update_updated_at_column`), so this follows established conventions.

3. **Critical business logic** - The `last_contacted` field is used in sales workflows and messaging templates. Missing updates could cause incorrect data in customer communications.

4. **Future-proofing** - If bulk operations, admin tools, or direct database operations are added later, they automatically benefit.

5. **Sequence tasks consideration** - Sequence tasks also complete through the same flow, and they represent customer contact events that should update `last_contacted`.

---

## Implementation Considerations

### Task Types to Include

**Decision**: Exclude `internal_activity` tasks as they don't represent actual customer contact.

| Task Type | Updates last_contacted? | Rationale |
|-----------|------------------------|-----------|
| `email` | Yes | Direct customer contact |
| `call` | Yes | Direct customer contact |
| `text` | Yes | Direct customer contact |
| `social_message` | Yes | Direct customer contact |
| `demo_meeting` | Yes | Direct customer contact |
| `internal_activity` | **No** | Internal tasks, not customer contact |

### Edge Cases

1. **Tasks without restaurant_id** - Trigger handles this with NULL check
2. **Re-completing already completed tasks** - Trigger only fires when status CHANGES to completed
3. **Bulk operations** - Trigger fires for each row individually (acceptable overhead)
4. **Cancelled tasks** - Should NOT update last_contacted (trigger only fires for 'completed')

### Backfill Consideration

Existing completed tasks with `last_contacted = NULL` could be backfilled:

```sql
-- One-time backfill: Set last_contacted to most recent completed task date
UPDATE restaurants r
SET last_contacted = (
    SELECT MAX(t.completed_at)
    FROM tasks t
    WHERE t.restaurant_id = r.id
    AND t.status = 'completed'
)
WHERE r.last_contacted IS NULL
AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.restaurant_id = r.id
    AND t.status = 'completed'
);
```

---

## Migration (IMPLEMENTED)

### Migration: add_task_completion_last_contacted_trigger

```sql
-- Create trigger function to update restaurant.last_contacted when a task is completed
-- Excludes internal_activity tasks as they don't represent customer contact

CREATE OR REPLACE FUNCTION update_restaurant_last_contacted_on_task_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Only trigger when:
    -- 1. Status changes TO 'completed'
    -- 2. Task has an associated restaurant
    -- 3. Task type is NOT 'internal_activity' (those don't represent customer contact)
    IF NEW.status = 'completed'
       AND (OLD.status IS NULL OR OLD.status <> 'completed')
       AND NEW.restaurant_id IS NOT NULL
       AND NEW.type <> 'internal_activity' THEN

        UPDATE restaurants
        SET last_contacted = COALESCE(NEW.completed_at, CURRENT_TIMESTAMP)
        WHERE id = NEW.restaurant_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- Create the trigger (AFTER UPDATE to not interfere with task update)
CREATE TRIGGER update_last_contacted_on_task_complete
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_restaurant_last_contacted_on_task_complete();

-- Add comment for documentation
COMMENT ON FUNCTION update_restaurant_last_contacted_on_task_complete() IS
'Automatically updates restaurant.last_contacted when a task is marked as completed.
Excludes internal_activity tasks as they do not represent customer contact.
Task types that trigger update: email, call, text, social_message, demo_meeting.';
```

### Optional: Backfill Historical Data (Not Yet Applied)

```sql
-- Migration: backfill_restaurant_last_contacted

-- Backfill existing completed tasks (excluding internal_activity)
UPDATE restaurants r
SET last_contacted = sub.last_task_completion
FROM (
    SELECT
        restaurant_id,
        MAX(completed_at) as last_task_completion
    FROM tasks
    WHERE status = 'completed'
    AND restaurant_id IS NOT NULL
    AND type <> 'internal_activity'
    GROUP BY restaurant_id
) sub
WHERE r.id = sub.restaurant_id
AND (r.last_contacted IS NULL OR r.last_contacted < sub.last_task_completion);
```

---

## Testing Strategy

### Database-Level Tests

1. **Basic completion**: Complete a task, verify restaurant.last_contacted is updated
2. **No restaurant**: Complete task with null restaurant_id, verify no error
3. **Already completed**: Update an already-completed task, verify no duplicate update
4. **Status change to cancelled**: Verify last_contacted is NOT updated
5. **Concurrent updates**: Multiple tasks for same restaurant completing simultaneously

### Application-Level Tests

1. **API endpoint test**: POST to /tasks/:id/complete, verify restaurant.last_contacted changed
2. **Sequence task completion**: Complete sequence task, verify restaurant updated
3. **Variable replacement**: Verify {{last_contacted_day}} reflects updated value

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Trigger fails silently | Low | Medium | Use AFTER trigger, log errors |
| Performance impact | Low | Low | Single indexed UPDATE per completion |
| Unexpected updates | Low | Low | Clear documentation, COMMENT on function |
| Breaking existing logic | Very Low | Low | Trigger is additive, doesn't change existing behavior |

---

## Summary

**Implementation**: Database trigger that fires AFTER UPDATE on the tasks table when status changes to 'completed', updating the associated restaurant's last_contacted timestamp.

**Behavior**:
- Triggers on: `email`, `call`, `text`, `social_message`, `demo_meeting` task completions
- Does NOT trigger on: `internal_activity` completions
- Uses task's `completed_at` timestamp for accuracy
- Only fires when status **changes** to completed (not on re-saves)

**Key Benefits**:
- Guaranteed consistency across all completion paths
- Follows existing database patterns
- No application code changes required
- Future-proof for new features

**Completed**:
- [x] Investigation and analysis
- [x] Migration created and applied
- [x] Trigger function with internal_activity exclusion
- [ ] Optional: Backfill historical data
