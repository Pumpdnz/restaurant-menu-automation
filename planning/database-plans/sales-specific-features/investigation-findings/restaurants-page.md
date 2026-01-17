# Investigation 1: Restaurants Page Structure

**Status:** ✅ Complete
**Date:** November 22, 2025
**Time Spent:** 1.5 hours
**File Investigated:** `/src/pages/Restaurants.jsx` (1130 lines)

---

## Summary

The Restaurants page is a **fully client-side filtered and sorted table** using shadcn/ui Table component with React hooks for state management. It uses URL params for filter persistence and has inline editing capabilities for sales fields.

---

## 1. Current Page Structure

### State Management
- **Framework:** React hooks (useState, useEffect)
- **Router:** React Router v7 with useNavigate and useSearchParams
- **State Variables:**
  - `restaurants` - Full dataset from API
  - `filteredRestaurants` - Client-side filtered and sorted data
  - `filters` - Object with 8 filter fields (5 multi-select arrays)
  - `sortField` / `sortDirection` - Sorting state
  - `loading`, `error`, `deleteConfirm`, `showFilters`

### Data Fetching
- **Method:** Direct API call via `api.get('/restaurants/list')`
- **No dedicated service file** - Uses axios directly
- **Fetched Once:** On component mount (line 88-109)
- **Client-side operations:** All filtering and sorting done in browser

### Table Component
- **Component:** shadcn/ui `<Table>` with TableHeader, TableBody, TableRow, TableCell
- **Located:** Lines 859-1037
- **Features:**
  - Horizontal scrolling container (`overflow-x-auto`)
  - Minimum column widths defined (e.g., `min-w-[200px]`)
  - Sortable columns with click handlers
  - No pagination - renders all filtered results

### Current Columns (12 total)

| Position | Column | Sortable | Min Width | Interactive |
|----------|--------|----------|-----------|-------------|
| 1 | Name | ✅ Yes | 200px | Click to view details |
| 2 | Lead Contact | ❌ No | 180px | Display only |
| 3 | Lead Type | ❌ No | 110px | Inline dropdown edit |
| 4 | Lead Category | ❌ No | 130px | Inline dropdown edit |
| 5 | Lead Status | ❌ No | 110px | Inline dropdown edit |
| 6 | Warmth | ❌ No | 100px | Inline dropdown edit |
| 7 | Stage | ❌ No | 130px | Inline dropdown edit |
| 8 | ICP Rating | ✅ Yes | 100px | Inline dropdown edit |
| 9 | Demo Store | ❌ No | 100px | Inline dropdown edit |
| 10 | Last Contact | ✅ Yes | 120px | Inline date picker |
| 11 | Created | ✅ Yes | 100px | Display only |
| 12 | Actions | ❌ No | 120px | View/Menu/Delete buttons |

**Table is horizontally scrollable** - designed to fit many columns

---

## 2. Restaurant List Query

### Current API Call
```javascript
// Line 97-109
const fetchRestaurants = async () => {
  try {
    const response = await api.get('/restaurants/list');
    const data = response.data.restaurants || [];
    setRestaurants(data);
    // ...
  }
};
```

### Current SQL Query (Assumed Backend)
The endpoint `/restaurants/list` likely returns:
- All restaurant fields
- Possibly includes `restaurant_platforms` array (used on line 999)
- **No JOINs to tasks table currently**

### Typical Result Size
- Based on filters and stats (lines 1040-1099), appears designed for **100-500 restaurants**
- Client-side filtering suggests manageable dataset size
- No pagination indicates full dataset loaded

### Existing Filters
**Multi-select filters (arrays):**
1. `lead_type` - 2 options (inbound, outbound)
2. `lead_category` - 4 options (paid_ads, organic_content, warm_outreach, cold_outreach)
3. `lead_warmth` - 4 options (frozen, cold, warm, hot)
4. `lead_stage` - 9 options (defaults to 7 selected)
5. `lead_status` - 5 options (active, inactive, ghosted, reengaging, closed)

**Single-value filters:**
6. `search` - Text search across name, contact_name, contact_email, city, address
7. `demo_store_built` - Dropdown (all, true, false)
8. `icp_rating_min` - Dropdown (5+, 6+, 7+, 8+, 9+, 10)

**URL Persistence:** All filters saved to URL params (line 208-218)

---

## 3. Performance Considerations

### Current Performance Profile
- **Client-side filtering:** Fast for <1000 records, may lag beyond that
- **All data loaded upfront:** Single API call, no pagination
- **Re-filters on every change:** Lines 92-95 (useEffect watches filters/sort)
- **Horizontal scrolling:** Accommodates many columns without breaking layout

### Impact of Adding Task JOIN
**Scenario:** LEFT JOIN to get oldest active task per restaurant

**Query Change:**
```sql
-- Current (assumed)
SELECT * FROM restaurants WHERE organisation_id = ?

-- New
SELECT
  r.*,
  t.id as oldest_task_id,
  t.name as oldest_task_name,
  t.type as oldest_task_type,
  t.due_date as oldest_task_due_date,
  t.status as oldest_task_status,
  t.priority as oldest_task_priority
FROM restaurants r
LEFT JOIN LATERAL (
  SELECT * FROM tasks
  WHERE restaurant_id = r.id
    AND status NOT IN ('completed', 'cancelled')
  ORDER BY due_date ASC NULLS LAST, created_at ASC
  LIMIT 1
) t ON true
WHERE r.organisation_id = ?
```

**Performance Impact:**
- ✅ **Low impact if indexed properly** - LATERAL JOIN with LIMIT 1 is efficient
- ✅ **Returns same number of rows** - Still 1 row per restaurant
- ⚠️ **Requires index:** `idx_tasks_restaurant_active` on `(restaurant_id, status, due_date)`

**Recommended Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant_active
ON tasks(restaurant_id, status, due_date)
WHERE status NOT IN ('completed', 'cancelled');
```

---

## 4. Column Addition Strategy

### Recommended Position for Task Column
**Insert between positions 7 and 8** (after Stage, before ICP Rating)

**Reasoning:**
1. Stage and Task are related (both show current status)
2. Task provides actionable next step after seeing stage
3. ICP Rating, Demo Store, and Last Contact are more "meta" fields
4. Creates natural flow: Stage → Task → Rating

**New Column Order:**
1. Name
2. Lead Contact
3. Lead Type
4. Lead Category
5. Lead Status
6. Warmth
7. Stage
8. **Tasks** ← NEW
9. ICP Rating
10. Demo Store
11. Last Contact
12. Created
13. Actions

### Table Scrolling Behavior
- **Horizontal scroll:** `overflow-x-auto` on line 860
- **Min widths set:** All columns have `min-w-[XXXpx]`
- **Responsive:** Works on all screen sizes via scrolling

**Recommended min-width for Tasks column:** `min-w-[180px]`
- Accommodates task name (up to ~30 chars)
- Room for quick view button + navigation icon

---

## 5. Integration Points

### Inline Editing Pattern
Many columns use inline dropdown editing (lines 296-641):
- **Pattern:** Badge wraps a Select component
- **On change:** Calls `handleUpdateRestaurantField(restaurantId, field, value)`
- **Backend call:** PATCH `/restaurants/:id` with single field update
- **Optimistic update:** Local state updated immediately

**Task column will NOT use this pattern** - Tasks have their own modals

### Navigation Patterns
**View Restaurant:** `navigate(\`/restaurants/${restaurantId}\`)` (line 481)
**View Menus:** `navigate(\`/menus?restaurant=${restaurantId}\`)` (line 485)

**Recommended for Task column:**
```javascript
// Quick view: Opens TaskTypeQuickView popover
// Navigation: navigate('/tasks', { state: { searchQuery: restaurantName } })
```

---

## 6. Component Dependencies

### UI Components Used
- `@/components/ui/table` - Table, TableHeader, TableBody, TableRow, TableCell
- `@/components/ui/button` - Button component
- `@/components/ui/badge` - Badge for status indicators
- `@/components/ui/select` - Select, SelectContent, SelectItem, SelectTrigger, SelectValue
- `@/components/ui/multi-select` - MultiSelect for filter arrays
- `@/components/ui/date-time-picker` - DateTimePicker for last_contacted
- `@/components/ui/dialog` - Dialog for delete confirmation
- `@/components/ui/input` - Input for search

### Icons from lucide-react
- Eye, FileText, Store, Globe, Phone, Mail, Calendar, ExternalLink, Trash2, User
- ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Star

**Will need for Task column:**
- Import `TaskTypeQuickView` from `@/components/tasks/`
- Possibly `CheckCircle2` or `Clock` icon for task status

---

## 7. Findings Summary

### Strengths
✅ Well-structured component with clear separation of concerns
✅ URL param persistence for filters (great UX)
✅ Client-side filtering is fast and responsive
✅ Inline editing pattern works well for quick updates
✅ Horizontal scrolling accommodates many columns

### Challenges for Task Column
⚠️ Need to modify backend query to include task data
⚠️ Need database index for performance
⚠️ Need to import TaskTypeQuickView component
⚠️ Need to handle "no task" state gracefully

### Recommended Approach

**Backend Changes:**
1. Update `/restaurants/list` endpoint to include oldest active task
2. Use LEFT JOIN LATERAL for efficiency
3. Add database index: `idx_tasks_restaurant_active`

**Frontend Changes:**
1. Add Tasks column between Stage and ICP Rating
2. Create `TaskCell` component with:
   - Task name (colored by due date)
   - TaskTypeQuickView on click
   - Navigation icon to filter tasks by restaurant
3. Handle null task case with empty state

**No Changes Needed:**
- Filtering logic (client-side)
- Sorting logic (already works)
- URL persistence (already works)
- State management (already works)

---

## 8. Code Examples

### Recommended TaskCell Component Structure

```jsx
function TaskCell({ task, restaurantName, restaurantId }) {
  const navigate = useNavigate();

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

    if (dueDate < today) return 'text-red-600'; // Overdue
    if (dueDate.toDateString() === today.toDateString()) return 'text-blue-600'; // Due today
    return 'text-gray-500'; // Future
  };

  const handleNavigateToTasks = (e) => {
    e.stopPropagation();
    navigate('/tasks', {
      state: {
        clearFilters: true,
        searchQuery: restaurantName
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <TaskTypeQuickView taskId={task.id}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "p-0 h-auto font-normal text-left truncate max-w-[140px]",
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
        className="h-6 w-6 p-0"
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}
```

### Adding Column to Table

```jsx
{/* Insert after Stage column, before ICP Rating */}
<TableHead className="min-w-[180px]">Tasks</TableHead>

{/* In TableBody */}
<TableCell>
  <TaskCell
    task={restaurant.oldest_task}
    restaurantName={restaurant.name}
    restaurantId={restaurant.id}
  />
</TableCell>
```

---

## 9. Next Steps

**Before Implementation:**
1. ✅ Investigation 2: Understand Tasks page filter handling
2. ✅ Understand how to programmatically set filter state

**During Implementation:**
1. Update backend `/restaurants/list` endpoint
2. Add database migration for index
3. Create `TaskCell` component
4. Add column to Restaurants table
5. Test with various scenarios (no task, overdue, due today, future)
6. Test navigation to Tasks page with filter clearing

**Performance Testing:**
- Test query performance with 500+ restaurants
- Verify index is being used (EXPLAIN ANALYZE)
- Test client-side re-filtering performance

---

## 10. Gotchas & Edge Cases

⚠️ **restaurant.restaurant_platforms** is accessed on line 999/1002 - structure: array with objects containing `url` field
⚠️ **Default lead_stage filter** - Defaults to 7 out of 9 values (excludes closed_won, closed_lost) - This is intentional
⚠️ **Client-side filtering** - All 8 filters applied in sequence (lines 111-206)
⚠️ **Two "clear" buttons** - "Clear All" removes all filters, "Reset to Default" restores default lead_stage selection
⚠️ **Inline editing** - All badge components are interactive dropdowns, updates fire PATCH immediately
⚠️ **No loading state during update** - handleUpdateRestaurantField doesn't show loading spinner

---

**Investigation Complete:** ✅
**Findings Documented:** ✅
**Ready for Implementation:** After Investigation 2 complete
