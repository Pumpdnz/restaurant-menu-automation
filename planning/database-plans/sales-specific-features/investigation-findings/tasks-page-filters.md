# Investigation 2: Tasks Page Filter Implementation

**Status:** ✅ Complete
**Date:** November 22, 2025
**Time Spent:** 1 hour
**File Investigated:** `/src/pages/Tasks.tsx` (1266 lines)

---

## Summary

The Tasks page uses **client-side filtering** with **two separate filter groups** (Task filters + Restaurant filters). Filter state is stored in component state (NOT URL params). Restaurant search is performed via `filters.search` which searches task name, description, and related restaurant fields. **Navigation state is NOT currently used** - we'll need to add location.state handling for programmatic filter population.

---

## 1. Filter State Management

### State Structure
```typescript
// Task Filters (lines 75-80)
const [filters, setFilters] = useState({
  search: '',                    // Text search
  status: ['active'] as string[], // Multi-select (default: active)
  type: [] as string[],          // Multi-select
  priority: [] as string[]       // Multi-select
});

// Restaurant Filters (lines 83-91)
const [restaurantFilters, setRestaurantFilters] = useState({
  lead_type: [] as string[],
  lead_category: [] as string[],
  lead_warmth: [] as string[],
  lead_stage: ['uncontacted', 'reached_out', ...] as string[], // Default: 7 stages
  lead_status: [] as string[],
  demo_store_built: 'all',
  icp_rating_min: ''
});

// Due Date Filter (lines 93-99)
const [dueDateFilter, setDueDateFilter] = useState({
  types: ['overdue', 'today'],   // Multi-select (default: overdue + today)
  customDates: undefined         // Optional DateRange
});

// Sort (lines 104-110)
const [sortConfig, setSortConfig] = useState({
  column: null,                  // 'due_date' | 'type' | 'priority' | null
  direction: 'asc'               // 'asc' | 'desc'
});
```

### Filter Storage Location
- **Component state only** (lines 75-110)
- **NO URL params** - filters not persisted in URL
- **NO localStorage** - resets on page refresh
- **Separate from Restaurants page** - Restaurants page uses URL params, Tasks page doesn't

### Filter Application Method
```typescript
// Lines 182-355
const applyFiltersAndSort = () => {
  let filtered = [...tasks];

  // 1. Apply search filter (lines 186-195)
  // 2. Apply task filters: status, type, priority (lines 198-208)
  // 3. Apply due date filters (lines 211-281)
  // 4. Apply restaurant filters (lines 284-322)
  // 5. Apply sorting (lines 325-352)

  setFilteredTasks(filtered);
};
```

**Triggers:** useEffect watches `tasks, filters, restaurantFilters, dueDateFilter, sortConfig` (line 163-165)

### Filter Update Functions
```typescript
// Line 417-423
const updateFilter = (key: string, value: any) => {
  setFilters(prev => ({ ...prev, [key]: value }));
};

const updateRestaurantFilter = (key: string, value: any) => {
  setRestaurantFilters(prev => ({ ...prev, [key]: value }));
};
```

### Clear Filter Functions
```typescript
// Clear task filters to defaults (line 452-464)
const clearTaskFilters = () => {
  setFilters({
    search: '',
    status: ['active'],          // Default: active only
    type: [],
    priority: []
  });
  setDueDateFilter({
    types: ['overdue', 'today'], // Default: overdue + today
    customDates: undefined
  });
};

// Clear ALL task filters (line 466-478)
const clearAllTaskFilters = () => {
  // Same as above but status: [] and dueDateFilter.types: []
};

// Clear restaurant filters to defaults (line 480-490)
const clearRestaurantFilters = () => {
  setRestaurantFilters({
    lead_type: [],
    lead_category: [],
    lead_warmth: [],
    lead_stage: ['uncontacted', 'reached_out', ...], // Default: 7 stages
    lead_status: [],
    demo_store_built: 'all',
    icp_rating_min: ''
  });
};

// Clear ALL filters (line 504-507)
const clearFilters = () => {
  clearTaskFilters();
  clearRestaurantFilters();
};
```

**Key Insight:** There are two "clear" levels:
1. **Reset to Default** - Restores default values (active status, overdue+today dates, 7 lead stages)
2. **Clear All** - Removes all selections (empty arrays)

---

## 2. Restaurant Filtering

### How Restaurant Filter Works
**Lines 284-322:** Restaurant filters are applied ONLY to tasks that have associated restaurants

```typescript
// Example: Lead Type filter (lines 284-288)
if (restaurantFilters.lead_type && restaurantFilters.lead_type.length > 0) {
  filtered = filtered.filter(t =>
    !t.restaurants ||  // <-- Keep tasks WITHOUT restaurants
    (t.restaurants.lead_type && restaurantFilters.lead_type.includes(t.restaurants.lead_type))
  );
}
```

**Important Pattern:** `!t.restaurants ||` ensures tasks without a restaurant are ALWAYS included

### Restaurant Fields Filtered
1. `lead_type` (2 values)
2. `lead_category` (4 values)
3. `lead_warmth` (4 values)
4. `lead_stage` (9 values, default: 7 selected)
5. `lead_status` (5 values)
6. `demo_store_built` (all/true/false)
7. `icp_rating_min` (5+, 6+, 7+, 8+, 9+, 10)

### Component Used
**MultiSelect component** (same as Restaurants page) - Lines 943-1004

**Location:** `@/components/ui/multi-select`

**Props:**
```tsx
<MultiSelect
  options={[{ label: 'Inbound', value: 'inbound' }, ...]}
  selected={restaurantFilters.lead_type}
  onChange={(v) => updateRestaurantFilter('lead_type', v)}
  placeholder="All Types"
/>
```

---

## 3. Search Functionality

### Search Input
**Lines 748-755:**
```tsx
<Input
  placeholder="Task, restaurant, contact..."
  value={filters.search}
  onChange={(e) => updateFilter('search', e.target.value)}
/>
```

### Search Fields
**Lines 186-195:**
```typescript
if (filters.search) {
  const searchLower = filters.search.toLowerCase();
  filtered = filtered.filter(task =>
    task.name?.toLowerCase().includes(searchLower) ||
    task.description?.toLowerCase().includes(searchLower) ||
    task.restaurants?.name?.toLowerCase().includes(searchLower) ||
    task.restaurants?.contact_name?.toLowerCase().includes(searchLower) ||
    task.restaurants?.contact_email?.toLowerCase().includes(searchLower)
  );
}
```

**Searches:**
- Task name
- Task description
- Restaurant name
- Restaurant contact_name
- Restaurant contact_email

### Search Type
- **Client-side filtering** - No API call, searches loaded data
- **Case-insensitive** - Uses `toLowerCase()`
- **Partial matches** - Uses `includes()` not exact match

### Search Value Storage
- Stored in `filters.search` (string)
- Updated on every keystroke (onChange event)
- No debouncing currently

---

## 4. Navigation State Handling

### Current Implementation
**NO navigation state handling currently exists**

**Files checked:**
- ✅ `useNavigate` imported (line 2)
- ❌ `useLocation` NOT imported
- ❌ No `location.state` checks in useEffect
- ❌ No URL param reading (no useSearchParams)

### React Router Version
**React Router v7** - Imported from `react-router-dom` (line 2)

### How to Add Navigation State
**Required changes to handle programmatic filtering:**

```typescript
import { useNavigate, useLocation } from 'react-router-dom';

export default function Tasks() {
  const navigate = useNavigate();
  const location = useLocation();

  // Add useEffect to handle navigation state
  useEffect(() => {
    if (location.state) {
      const { clearFilters: shouldClear, searchQuery } = location.state;

      if (shouldClear) {
        // Clear all filters first
        clearAllTaskFilters();
        clearAllRestaurantFilters();
      }

      if (searchQuery) {
        // Set search filter to restaurant name
        setFilters(prev => ({ ...prev, search: searchQuery }));
      }

      // Clear the navigation state so it doesn't persist on refresh
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state]);

  // ... rest of component
}
```

### Navigation State Structure
**Recommended format from Restaurants page:**
```typescript
navigate('/tasks', {
  state: {
    clearFilters: true,        // Boolean - clear all filters
    searchQuery: 'Restaurant Name' // String - populate search
  }
});
```

### Focus Search Input (Optional Enhancement)
```typescript
const searchInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (location.state?.searchQuery && searchInputRef.current) {
    searchInputRef.current.focus();
  }
}, [location.state]);

// In JSX:
<Input
  ref={searchInputRef}
  placeholder="Task, restaurant, contact..."
  value={filters.search}
  onChange={(e) => updateFilter('search', e.target.value)}
/>
```

---

## 5. Existing Filter Defaults

### Task Filters Defaults
```typescript
search: ''           // Empty
status: ['active']   // Only active tasks
type: []             // All types
priority: []         // All priorities
dueDateFilter.types: ['overdue', 'today'] // Only overdue + today
```

**Rationale:** Show only actionable tasks by default (active, due soon)

### Restaurant Filters Defaults
```typescript
lead_type: []        // All
lead_category: []    // All
lead_warmth: []      // All
lead_stage: [7 out of 9 values] // Excludes: closed_won, closed_lost
lead_status: []      // All
demo_store_built: 'all'
icp_rating_min: ''
```

**Rationale:** Show tasks for active leads (not closed)

---

## 6. Clear vs Reset Behavior

### Two Clear Buttons
**Lines 727-742:**
```tsx
{(hasTaskFilters() || !isTaskFiltersAtDefault()) && (
  <div className="flex gap-2">
    {/* Button 1: Clear All - Removes all filters */}
    {hasTaskFilters() && (
      <Button variant="ghost" size="sm" onClick={clearAllTaskFilters}>
        <X className="h-4 w-4 mr-1" />
        Clear All
      </Button>
    )}

    {/* Button 2: Reset to Default - Restores defaults */}
    {!isTaskFiltersAtDefault() && (
      <Button variant="ghost" size="sm" onClick={clearTaskFilters}>
        <X className="h-4 w-4 mr-1" />
        Reset to Default
      </Button>
    )}
  </div>
)}
```

### When Each Button Appears
| Condition | "Clear All" | "Reset to Default" |
|-----------|-------------|-------------------|
| All filters empty | ❌ Hidden | ❌ Hidden |
| Filters at default | ❌ Hidden | ❌ Hidden |
| Filters differ from default | ✅ Show | ✅ Show |
| Filters empty (not default) | ❌ Hidden | ✅ Show |

### Example Scenarios
**Scenario 1:** User has status=[] (empty, not default)
- "Clear All" hidden (no filters)
- "Reset to Default" shown (not at default)

**Scenario 2:** User has status=['active', 'pending']
- "Clear All" shown (has filters)
- "Reset to Default" shown (not at default)

**Scenario 3:** User has status=['active'], dueDateFilter=['overdue', 'today']
- "Clear All" hidden (filters match default)
- "Reset to Default" hidden (already at default)

---

## 7. Filter Checking Functions

### hasTaskFilters()
**Lines 509-516:** Returns true if ANY task filter is set (including defaults)

### isTaskFiltersAtDefault()
**Lines 518-525:** Returns true if filters exactly match defaults

### hasRestaurantFilters()
**Lines 527-535:** Returns true if ANY restaurant filter is set

### isRestaurantFiltersAtDefault()
**Lines 537-545:** Returns true if restaurant filters match defaults

### hasActiveFilters()
**Lines 551-569:** Returns true if filters differ from defaults
- Used for header count: "X filtered tasks"
- Different from `hasTaskFilters()` which checks if any filter exists

---

## 8. Filter UI Layout

### Collapsible Sections
**Two separate filter panels:**

1. **Task Filters** (lines 716-907)
   - Collapsible with ChevronDown icon
   - State: `showTaskFilters` (default: true)
   - Clear buttons at top right

2. **Restaurant Filters** (lines 909-1059)
   - Collapsible with ChevronDown icon
   - State: `showRestaurantFilters` (default: true)
   - Clear buttons at top right

### Grid Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 4 columns on large screens */}
  {/* 2 columns on medium screens */}
  {/* 1 column on small screens */}
</div>
```

**Task Filters:** 4 inputs (Search, Status, Type, Priority) + 1 wide input (Due Date spanning 2 cols)

**Restaurant Filters:** 7 inputs (matching Restaurants page filters)

---

## 9. Data Flow Diagram

```
User Action (change filter)
  ↓
updateFilter() or updateRestaurantFilter()
  ↓
filters or restaurantFilters state updates
  ↓
useEffect [tasks, filters, restaurantFilters, dueDateFilter] (line 163)
  ↓
applyFiltersAndSort() (line 182)
  ↓
1. Clone tasks array
2. Apply search filter
3. Apply task filters (status, type, priority)
4. Apply due date filters
5. Apply restaurant filters
6. Apply sorting
  ↓
setFilteredTasks(filtered)
  ↓
UI re-renders with filtered data
```

---

## 10. Programmatic Filter Population Strategy

### Required Implementation

**Step 1: Import useLocation**
```typescript
import { useNavigate, useLocation } from 'react-router-dom';
```

**Step 2: Add useEffect to handle navigation state**
```typescript
useEffect(() => {
  if (location.state) {
    const { clearFilters: shouldClear, searchQuery } = location.state;

    if (shouldClear) {
      // Clear ALL filters (both task and restaurant)
      setFilters({
        search: searchQuery || '', // Populate search if provided
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

    // Clear navigation state
    navigate(location.pathname, { replace: true, state: null });
  }
}, [location.state]);
```

**Step 3: Optional - Focus search input**
```typescript
const searchInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (location.state?.searchQuery) {
    searchInputRef.current?.focus();
  }
}, [location.state]);
```

### Navigation from Restaurants Page
```typescript
// In Restaurants page TaskCell component
const handleNavigateToTasks = (e) => {
  e.stopPropagation();
  navigate('/tasks', {
    state: {
      clearFilters: true,
      searchQuery: restaurantName
    }
  });
};
```

---

## 11. Gotchas & Edge Cases

⚠️ **No URL params** - Filters don't persist in URL (unlike Restaurants page)
⚠️ **Tasks without restaurants** - Restaurant filters use `!t.restaurants ||` to include them
⚠️ **Default filters** - status=['active'] and dueDateFilter=['overdue','today'] are defaults, not "no filters"
⚠️ **Two clear buttons** - "Clear All" vs "Reset to Default" behavior is subtle
⚠️ **NZ Timezone handling** - Custom timezone functions for "today" filter (lines 121-157)
⚠️ **Client-side only** - All filtering done in browser, no backend filtering
⚠️ **Search debouncing** - NOT implemented, searches on every keystroke

### Restaurant Filters Edge Case
```typescript
// Line 286: !t.restaurants || ensures tasks without restaurants stay visible
filtered = filtered.filter(t =>
  !t.restaurants || // <-- This line is important!
  (t.restaurants.lead_type && restaurantFilters.lead_type.includes(t.restaurants.lead_type))
);
```

Without `!t.restaurants`, tasks without a restaurant would be filtered out when any restaurant filter is active.

---

## 12. Filter Persistence Comparison

| Feature | Restaurants Page | Tasks Page |
|---------|------------------|------------|
| URL Params | ✅ Yes | ❌ No |
| localStorage | ❌ No | ❌ No |
| Navigation State | ❌ No | ⚠️ Needs implementation |
| Default Filters | Yes (7 lead stages) | Yes (status + due date) |
| Collapsible UI | Yes (single panel) | Yes (two panels) |
| Clear Buttons | "Clear All" + "Reset" | "Clear All" + "Reset" |

---

## 13. Recommended Implementation for Feature 3

### Changes Needed
1. ✅ Import `useLocation` from react-router-dom
2. ✅ Add useEffect to handle `location.state`
3. ✅ Clear filters when `clearFilters: true`
4. ✅ Populate search when `searchQuery` provided
5. ✅ Clear navigation state after consuming it
6. ⚠️ Optional: Focus search input
7. ⚠️ Optional: Add URL param persistence (if desired)

### Code to Add
```typescript
import { useNavigate, useLocation } from 'react-router-dom';

export default function Tasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ... existing state ...

  // NEW: Handle navigation state
  useEffect(() => {
    if (location.state) {
      const { clearFilters: shouldClear, searchQuery } = location.state as {
        clearFilters?: boolean;
        searchQuery?: string;
      };

      if (shouldClear) {
        clearAllTaskFilters();
        clearAllRestaurantFilters();

        if (searchQuery) {
          setFilters(prev => ({ ...prev, search: searchQuery }));
        }
      }

      // Clear state to prevent reapplication on refresh
      navigate(location.pathname, { replace: true, state: null });

      // Focus search input
      if (searchQuery) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    }
  }, [location.state]);

  // ... rest of component ...

  // Update search input JSX:
  <Input
    ref={searchInputRef}
    placeholder="Task, restaurant, contact..."
    value={filters.search}
    onChange={(e) => updateFilter('search', e.target.value)}
  />
}
```

---

## 14. Testing Scenarios

**Test 1: Navigation from Restaurants page**
- Click task link in Restaurants table
- Expect: All filters cleared, search populated with restaurant name, search focused

**Test 2: Default filters**
- Load Tasks page fresh
- Expect: status=['active'], dueDateFilter=['overdue','today']

**Test 3: Clear All vs Reset**
- Set filters to non-default values
- Click "Clear All" → Expect: All arrays empty
- Click "Reset to Default" → Expect: Defaults restored

**Test 4: Restaurant filter with no restaurant**
- Create task without restaurant
- Apply restaurant filter
- Expect: Task without restaurant still visible

**Test 5: Search functionality**
- Search for restaurant name
- Expect: Tasks for that restaurant appear
- Search for contact name
- Expect: Tasks with matching restaurant contact appear

---

**Investigation Complete:** ✅
**Findings Documented:** ✅
**Ready for Implementation:** After all investigations complete
