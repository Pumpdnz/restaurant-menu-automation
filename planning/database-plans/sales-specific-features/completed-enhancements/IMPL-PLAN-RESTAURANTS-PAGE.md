# Implementation Plan: Restaurants Page Task Column

**Feature:** Feature 3 - Restaurants Page Task Column
**Priority:** P2 (Medium)
**Estimated Time:** 3-4 hours
**Dependencies:** TaskTypeQuickView component (already exists)

---

## Overview

Add a "Tasks" column to the Restaurants table showing the oldest active task per restaurant with:
- Color-coded due dates (red=overdue, blue=today, gray=future)
- Quick view popover on click
- Navigation link to filtered Tasks page

---

## Table of Contents

1. [Phase 1: Database & Backend (1 hour)](#phase-1-database--backend)
2. [Phase 2: Frontend Components (1.5 hours)](#phase-2-frontend-components)
3. [Phase 3: Integration & Testing (1 hour)](#phase-3-integration--testing)
4. [Testing Scenarios](#testing-scenarios)
5. [Performance Notes](#performance-notes)
6. [Rollback Plan](#rollback-plan)

---

## Phase 1: Database & Backend

**Time:** 1 hour

### Step 1.1: Create Database Index (15 minutes)

**File:** `supabase/migrations/YYYYMMDD_add_tasks_restaurant_index.sql`

```sql
-- Index for efficiently finding oldest active task per restaurant
-- Partial index only on non-completed/non-cancelled tasks
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant_active
ON tasks(restaurant_id, due_date ASC NULLS LAST, created_at ASC)
WHERE status NOT IN ('completed', 'cancelled');

COMMENT ON INDEX idx_tasks_restaurant_active IS
  'Optimized index for finding oldest active task per restaurant. Used in restaurant list view.';
```

**Test migration:**
```bash
# In automation directory
cd /Users/giannimunro/Desktop/cursor-projects/automation
supabase db reset --local
```

**Verify index created:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tasks'
AND indexname = 'idx_tasks_restaurant_active';
```

### Step 1.2: Update Backend Restaurant List Query (45 minutes)

**File:** `/src/routes/restaurants-routes.js` or equivalent service

**Current query (assumed):**
```javascript
// GET /restaurants/list
const { data: restaurants, error } = await supabase
  .from('restaurants')
  .select('*')
  .eq('organisation_id', organisationId)
  .order('created_at', { ascending: false });
```

**New query with task JOIN:**
```javascript
// GET /restaurants/list
const { data: restaurants, error } = await supabase
  .from('restaurants')
  .select(`
    *,
    oldest_task:tasks!left(
      id,
      name,
      type,
      status,
      priority,
      due_date,
      created_at
    )
  `)
  .eq('organisation_id', organisationId)
  .eq('tasks.status', 'active')  // Only active tasks
  .order('tasks.due_date', { ascending: true, nullsFirst: false })
  .order('tasks.created_at', { ascending: true })
  .limit(1, { foreignTable: 'tasks' })  // Only oldest task
  .order('created_at', { ascending: false });
```

**IMPORTANT:** Supabase syntax for LATERAL JOIN with LIMIT:

The above query may not work perfectly due to Supabase limitations. Use raw SQL instead:

```javascript
// GET /restaurants/list - Using raw SQL
const { data: restaurants, error } = await supabase.rpc('get_restaurants_with_tasks', {
  org_id: organisationId
});
```

**Create RPC function:**

**File:** `supabase/migrations/YYYYMMDD_create_get_restaurants_with_tasks_function.sql`

```sql
CREATE OR REPLACE FUNCTION get_restaurants_with_tasks(org_id UUID)
RETURNS TABLE (
  -- All restaurant columns (explicit list recommended)
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  -- ... all other restaurant columns
  lead_type TEXT,
  lead_category TEXT,
  lead_warmth TEXT,
  lead_stage TEXT,
  lead_status TEXT,
  icp_rating INTEGER,
  demo_store_built BOOLEAN,
  demo_store_url TEXT,
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  -- Task columns (prefixed with oldest_task_)
  oldest_task_id UUID,
  oldest_task_name TEXT,
  oldest_task_type TEXT,
  oldest_task_status TEXT,
  oldest_task_priority TEXT,
  oldest_task_due_date TIMESTAMPTZ,
  oldest_task_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.*,
    t.id AS oldest_task_id,
    t.name AS oldest_task_name,
    t.type AS oldest_task_type,
    t.status AS oldest_task_status,
    t.priority AS oldest_task_priority,
    t.due_date AS oldest_task_due_date,
    t.created_at AS oldest_task_created_at
  FROM restaurants r
  LEFT JOIN LATERAL (
    SELECT *
    FROM tasks
    WHERE tasks.restaurant_id = r.id
      AND tasks.status NOT IN ('completed', 'cancelled')
    ORDER BY
      tasks.due_date ASC NULLS LAST,
      tasks.created_at ASC
    LIMIT 1
  ) t ON TRUE
  WHERE r.organisation_id = org_id
  ORDER BY r.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_restaurants_with_tasks TO authenticated;

COMMENT ON FUNCTION get_restaurants_with_tasks IS
  'Returns all restaurants with their oldest active task (if any)';
```

**Alternative: Keep it simple with client-side JOIN:**

If the above is too complex, fetch tasks separately:

```javascript
// 1. Fetch restaurants
const { data: restaurants } = await supabase
  .from('restaurants')
  .select('*')
  .eq('organisation_id', organisationId);

// 2. Fetch all active tasks for these restaurants
const restaurantIds = restaurants.map(r => r.id);
const { data: allTasks } = await supabase
  .from('tasks')
  .select('*')
  .in('restaurant_id', restaurantIds)
  .not('status', 'in', '(completed,cancelled)')
  .order('due_date', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: true });

// 3. Attach oldest task to each restaurant
const tasksMap = {};
allTasks.forEach(task => {
  if (!tasksMap[task.restaurant_id]) {
    tasksMap[task.restaurant_id] = task;
  }
});

const restaurantsWithTasks = restaurants.map(r => ({
  ...r,
  oldest_task: tasksMap[r.id] || null
}));

return restaurantsWithTasks;
```

**Recommended:** Use client-side JOIN for simplicity unless performance is an issue.

---

## Phase 2: Frontend Components

**Time:** 1.5 hours

### Step 2.1: Create TaskCell Component (1 hour)

**File:** `/src/components/restaurants/TaskCell.tsx`

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TaskTypeQuickView } from '../tasks/TaskTypeQuickView';

interface TaskCellProps {
  task: {
    id: string;
    name: string;
    type: string;
    status: string;
    priority: string;
    due_date: string | null;
  } | null;
  restaurantName: string;
  restaurantId: string;
}

export function TaskCell({ task, restaurantName, restaurantId }: TaskCellProps) {
  const navigate = useNavigate();

  const handleNavigateToTasks = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/tasks', {
      state: {
        clearFilters: true,
        searchQuery: restaurantName
      }
    });
  };

  if (!task) {
    return (
      <span className="text-xs text-muted-foreground">No active tasks</span>
    );
  }

  const getTaskColor = () => {
    if (!task.due_date) return 'text-gray-500';

    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Overdue
    if (dueDate < today) return 'text-red-600 font-semibold';

    // Due today
    if (dueDate.toDateString() === today.toDateString()) {
      return 'text-blue-600 font-semibold';
    }

    // Future
    return 'text-gray-600';
  };

  return (
    <div className="flex items-center gap-2">
      <TaskTypeQuickView task={task}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "p-0 h-auto font-normal text-left truncate max-w-[140px] hover:underline",
            getTaskColor()
          )}
        >
          {task.name}
        </Button>
      </TaskTypeQuickView>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleNavigateToTasks}
        title="View all tasks for this restaurant"
        className="h-6 w-6 p-0 hover:bg-muted"
      >
        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
      </Button>
    </div>
  );
}
```

### Step 2.2: Update Restaurants Table (30 minutes)

**File:** `/src/pages/Restaurants.jsx`

**1. Import TaskCell:**
```jsx
import { TaskCell } from '../components/restaurants/TaskCell';
```

**2. Add column to table header (after Stage column, before ICP Rating):**

**Location:** Line ~876 (after Stage TableHead)

```jsx
{/* After Stage column */}
<TableHead className="min-w-[180px]">Tasks</TableHead>

{/* Existing ICP Rating column */}
<TableHead
  className="min-w-[100px] cursor-pointer hover:bg-muted/50"
  onClick={() => handleSort('icp_rating')}
>
  ICP Rating
  {getSortIcon('icp_rating')}
</TableHead>
```

**3. Add column to table body (matching position):**

**Location:** Line ~964 (after Stage cell, before ICP Rating cell)

```jsx
{/* After Stage cell */}
<TableCell>
  <TaskCell
    task={restaurant.oldest_task}
    restaurantName={restaurant.name}
    restaurantId={restaurant.id}
  />
</TableCell>

{/* Existing ICP Rating cell */}
<TableCell>
  {getIcpRatingBadge(restaurant.icp_rating, restaurant.id)}
</TableCell>
```

**4. Update colSpan in empty state:**

**Location:** Line ~905

```jsx
// OLD
<TableCell colSpan={12} className="text-center text-muted-foreground py-8">

// NEW (13 columns now)
<TableCell colSpan={13} className="text-center text-muted-foreground py-8">
```

---

## Phase 3: Integration & Testing

**Time:** 1 hour

### Step 3.1: Update Tasks Page for Navigation State (30 minutes)

**File:** `/src/pages/Tasks.tsx`

**Add useLocation import:**
```tsx
import { useNavigate, useLocation } from 'react-router-dom';
```

**Add state handling useEffect (after existing useEffects, around line 163):**
```tsx
const location = useLocation();

// Handle navigation state from Restaurants page
useEffect(() => {
  if (location.state) {
    const { clearFilters: shouldClear, searchQuery } = location.state as {
      clearFilters?: boolean;
      searchQuery?: string;
    };

    if (shouldClear) {
      // Clear all filters
      setFilters({
        search: searchQuery || '',
        status: [],
        type: [],
        priority: []
      });
      setDueDateFilter({
        types: [],
        customDates: undefined
      });
      setRestaurantFilters({
        lead_type: [],
        lead_category: [],
        lead_warmth: [],
        lead_stage: [],
        lead_status: [],
        demo_store_built: 'all',
        icp_rating_min: ''
      });
    } else if (searchQuery) {
      // Just update search, keep other filters
      setFilters(prev => ({ ...prev, search: searchQuery }));
    }

    // Clear navigation state to prevent reapplication
    navigate(location.pathname, { replace: true, state: null });
  }
}, [location.state]);
```

**Optional: Add searchInputRef for auto-focus:**
```tsx
const searchInputRef = useRef<HTMLInputElement>(null);

// Auto-focus search input when navigated from Restaurants page
useEffect(() => {
  if (location.state?.searchQuery && searchInputRef.current) {
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }
}, [location.state]);

// Update search Input component (line ~750):
<Input
  ref={searchInputRef}
  placeholder="Task, restaurant, contact..."
  value={filters.search}
  onChange={(e) => updateFilter('search', e.target.value)}
/>
```

### Step 3.2: Test End-to-End (30 minutes)

**Test 1: Task Column Display**
1. Navigate to Restaurants page
2. Verify Tasks column appears between Stage and ICP Rating
3. Check restaurants with tasks show task name
4. Check restaurants without tasks show "No active tasks"
5. Verify color coding (red for overdue, blue for today, gray for future)

**Test 2: Quick View**
1. Click on task name
2. Verify TaskTypeQuickView popover opens
3. Check all task details display correctly
4. Test closing popover

**Test 3: Navigation**
1. Click external link icon next to task
2. Verify navigates to Tasks page
3. Check all filters cleared
4. Check search populated with restaurant name
5. Verify tasks for that restaurant shown

**Test 4: Performance**
1. Load Restaurants page with 100+ restaurants
2. Measure load time
3. Check network request size
4. Verify no lag during scrolling

**Test 5: Task Updates**
1. Open task from Restaurants page quick view
2. Update task status to completed
3. Return to Restaurants page
4. Refresh page
5. Verify task no longer appears (next active task shown if exists)

---

## Testing Scenarios

### Scenario 1: Restaurant with No Tasks
**Setup:** Restaurant with 0 tasks
**Expected:** Cell shows "No active tasks" in muted text

### Scenario 2: Restaurant with Overdue Task
**Setup:** Restaurant with task due_date < today, status = active
**Expected:** Task name in red with "font-semibold" class

### Scenario 3: Restaurant with Task Due Today
**Setup:** Restaurant with task due_date = today, status = active
**Expected:** Task name in blue with "font-semibold" class

### Scenario 4: Restaurant with Future Task
**Setup:** Restaurant with task due_date > today, status = active
**Expected:** Task name in gray, normal weight

### Scenario 5: Restaurant with Task No Due Date
**Setup:** Restaurant with task where due_date = null, status = active
**Expected:** Task name in gray, normal weight

### Scenario 6: Multiple Active Tasks
**Setup:** Restaurant with 3 active tasks (different due dates)
**Expected:** Shows only the oldest task (earliest due_date, or earliest created_at if no due_dates)

### Scenario 7: Quick View Interaction
**Setup:** Click task name
**Expected:**
- Popover opens
- Task details display
- Message/qualification data shown (if applicable)
- Copy buttons work
- Clicking outside closes popover

### Scenario 8: Navigation to Tasks Page
**Setup:** Click external link icon
**Expected:**
- Navigate to /tasks
- All filters cleared
- Search field populated with restaurant name
- Only tasks for that restaurant visible
- Search input focused

### Scenario 9: Task Name Truncation
**Setup:** Task with very long name (>40 chars)
**Expected:**
- Text truncates with ellipsis
- Max width enforced (140px)
- Full name visible in quick view

### Scenario 10: Performance with Large Dataset
**Setup:** 500 restaurants, 50% with tasks
**Expected:**
- Page loads in <3 seconds
- No UI lag during scroll
- Network payload <1MB

---

## Performance Notes

### Database Query Performance

**Index Usage:**
The partial index `idx_tasks_restaurant_active` will be used for:
- Filtering non-completed/non-cancelled tasks
- Sorting by due_date and created_at
- Per-restaurant lookups

**Expected query time:**
- 100 restaurants: ~50-100ms
- 500 restaurants: ~200-300ms
- 1000 restaurants: ~400-600ms

**Index size:** ~5-10% of tasks table size (partial index)

### Network Performance

**Additional data per restaurant:**
- ~7 fields × 50 bytes = 350 bytes per task
- For 100 restaurants with 50% having tasks: ~17KB additional data
- Acceptable overhead

**Optimization if needed:**
- Implement pagination on Restaurants page
- Lazy load task data (fetch on hover)
- Use React Query for caching

### Client-Side Performance

**Rendering:**
- TaskCell is lightweight (pure function)
- TaskTypeQuickView lazy-loads on open
- No performance impact

**Memory:**
- 100 restaurants × 350 bytes = 35KB
- Negligible memory usage

---

## Rollback Plan

### If Phase 1 Fails (Database/Backend)

**Rollback database:**
```sql
DROP INDEX IF EXISTS idx_tasks_restaurant_active;
DROP FUNCTION IF EXISTS get_restaurants_with_tasks(UUID);
```

**Revert backend query:**
- Remove task JOIN/RPC call
- Restore original restaurants list query

### If Phase 2 Fails (Frontend)

**Revert Restaurants.jsx:**
1. Remove TaskCell import
2. Remove Tasks column from header
3. Remove Tasks cell from body
4. Restore colSpan to 12

**Delete TaskCell component:**
```bash
rm /path/to/TaskCell.tsx
```

### If Phase 3 Fails (Integration)

**Revert Tasks.tsx:**
1. Remove useLocation state handling
2. Remove searchInputRef (if added)

**No data loss** - all changes are code-only

---

## Success Criteria

✅ Index created successfully
✅ Backend query returns oldest active task per restaurant
✅ Tasks column displays between Stage and ICP Rating
✅ Color coding works (red/blue/gray based on due date)
✅ Quick view popover opens and displays task details
✅ Navigation to Tasks page clears filters and searches restaurant
✅ No tasks case shows "No active tasks"
✅ Performance acceptable (<3s load for 500 restaurants)
✅ No console errors
✅ All tests pass

---

## Dependencies

**Required components (verify exist):**
- [ ] TaskTypeQuickView component (`/src/components/tasks/TaskTypeQuickView.tsx`)
- [ ] MultiSelect component (`/src/components/ui/multi-select.tsx`)
- [ ] ExternalLink icon from lucide-react
- [ ] Tasks page with filter state management

**Backend endpoints:**
- [ ] `GET /restaurants/list` - Modify to include tasks
- [ ] `GET /tasks?restaurant_id=X` - For Tasks page filtering (already exists)

---

## Estimated Timeline

| Phase | Task | Time | Complexity |
|-------|------|------|------------|
| 1.1 | Create database index | 15 min | Low |
| 1.2 | Update backend query | 45 min | Medium |
| 2.1 | Create TaskCell component | 1 hour | Low |
| 2.2 | Update Restaurants table | 30 min | Low |
| 3.1 | Update Tasks page navigation | 30 min | Low |
| 3.2 | End-to-end testing | 30 min | - |
| **Total** | | **3-4 hours** | **Low-Medium** |

---

**Risk Level:** Low
**Parallel Development:** Yes (independent of Features 2 and 4)
**Breaking Changes:** None
**Database Migrations:** 1 (index creation - safe)
