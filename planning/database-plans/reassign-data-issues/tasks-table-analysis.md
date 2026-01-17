# Tasks Table Analysis for Reassignment and Duplication

## Table Structure

### Foreign Key Relationships
```sql
organisation_id → organisations (CASCADE DELETE)
restaurant_id → restaurants (CASCADE DELETE) [NULLABLE]
task_template_id → task_templates (SET NULL)
message_template_id → message_templates (SET NULL)
assigned_to → auth.users (SET NULL)
created_by → auth.users (SET NULL)
```

### Key Characteristics
- **Organisation-scoped**: Every task has `organisation_id`
- **Restaurant-association**: `restaurant_id` is NULLABLE (not all tasks are restaurant-specific)
- **User-assigned**: `assigned_to` and `created_by` reference users
- **Status lifecycle**: pending → active → completed/cancelled
- **Types**: internal_activity, social_message, text, email, call
- **Template-based**: Can be created from templates

## Reassignment Considerations

### Should tasks be reassigned? **YES**

**Rationale:**
- Tasks are operational data tied to restaurant activities
- Sales activities, follow-ups, and scheduled communications should follow the restaurant
- User assignments will remain valid (users exist independently of orgs)

### Implementation for Reassignment
```sql
UPDATE tasks
SET organisation_id = p_target_org_id,
    updated_at = NOW()
WHERE restaurant_id = p_restaurant_id;
```

### Considerations:
1. ✅ **User references remain valid** - Users are not org-specific in auth.users
2. ✅ **Template references remain valid** - Templates might be cross-org or NULL
3. ✅ **All task statuses reassigned** - Including completed/cancelled for history
4. ⚠️ **Only restaurant-specific tasks** - Tasks where `restaurant_id IS NOT NULL`

## Duplication Considerations

### Should tasks be duplicated? **CONDITIONAL**

**Arguments FOR duplication:**
- Template-based tasks might be standard operating procedures
- Recurring activities (social posts, follow-ups) might apply to new restaurant
- Pending/active tasks might represent ongoing work structure

**Arguments AGAINST duplication:**
- Completed/cancelled tasks are historical (don't duplicate)
- User assignments (`assigned_to`, `created_by`) might not be valid in new org
- Due dates are specific to original timeline
- Task history is restaurant-specific

### Recommended Approach: **Duplicate Pending Tasks Only**

Duplicate only tasks that are:
1. ✅ Status = 'pending' (not started, not completed)
2. ✅ Associated with the restaurant (`restaurant_id = p_restaurant_id`)
3. ✅ Reset user assignments to NULL (since users might not be in target org)
4. ✅ Clear due dates (or shift by time delta)
5. ✅ Clear completion/cancellation timestamps
6. ✅ Maintain template references

### Alternative Approach: **Skip Duplication**

Don't duplicate tasks at all:
- Tasks are operational, not structural
- New restaurant should start with clean slate
- Templates can be used to create new tasks as needed

## Recommendation

### For Reassignment
**Include tasks** - Straightforward update of `organisation_id`

### For Duplication
**Ask user for preference**, but suggest:
1. **Option A (Recommended)**: Duplicate only pending tasks
   - Reset assignments, clear dates, set to 'pending'
   - Preserve template references

2. **Option B (Conservative)**: Don't duplicate tasks
   - Let users create new tasks from templates
   - Clean slate for new restaurant

3. **Option C (Aggressive)**: Duplicate all tasks
   - Include completed for historical context
   - Might be confusing with user/date references

## User Questions to Resolve

1. **For duplication, should we duplicate tasks at all?**
   - If yes, which statuses? (pending only? all?)

2. **What should happen to user references?**
   - Set to NULL?
   - Keep original user IDs (might not be in target org)?

3. **What should happen to due dates?**
   - Clear them?
   - Shift by time delta?
   - Keep as-is?

4. **Should completed/cancelled tasks be duplicated?**
   - For historical context?
   - Or start fresh?

## Proposed Implementation

### Reassignment (Clear - Add Now)
```sql
-- PHASE X: Update tasks
UPDATE tasks
SET organisation_id = p_target_org_id,
    updated_at = NOW()
WHERE restaurant_id = p_restaurant_id;
GET DIAGNOSTICS v_task_count = ROW_COUNT;
```

### Duplication (Need User Input)

**Option A: Duplicate Pending Tasks Only**
```sql
-- PHASE X: Duplicate pending tasks only
INSERT INTO tasks (
  organisation_id,
  restaurant_id,
  task_template_id,
  message_template_id,
  assigned_to,
  created_by,
  name,
  description,
  status,
  type,
  priority,
  message,
  message_rendered,
  due_date,
  metadata,
  created_at,
  updated_at
)
SELECT
  p_target_org_id,
  v_new_restaurant_id,
  task_template_id,
  message_template_id,
  NULL, -- assigned_to (clear for new org)
  NULL, -- created_by (clear for new org)
  name,
  description,
  'pending', -- Always pending
  type,
  priority,
  message,
  NULL, -- message_rendered (clear, will regenerate)
  NULL, -- due_date (clear for new restaurant)
  metadata,
  NOW(),
  NOW()
FROM tasks
WHERE restaurant_id = p_restaurant_id
  AND status = 'pending'; -- Only pending tasks
```

**Option B: Don't Duplicate**
```sql
-- Skip tasks duplication entirely
-- Users will create new tasks as needed
```

## Impact Analysis

### Reassignment Impact
- **Low complexity** - Simple UPDATE
- **High value** - Preserves operational continuity
- **No data loss** - All tasks follow restaurant
- **Count**: Add to affected_counts

### Duplication Impact
- **Medium complexity** - Decision on what/how to duplicate
- **Medium value** - Depends on use case
- **User preference** - Different orgs might want different behavior
- **Count**: Add to duplicated_counts

## Recommendation Summary

1. ✅ **Reassignment**: Add tasks update (straightforward)
2. ⚠️ **Duplication**: Need user decision:
   - Suggest Option A (pending tasks only) with cleared assignments/dates
   - Or Option B (no duplication) for simplicity

Let me know your preference and I'll update both SQL files accordingly.
