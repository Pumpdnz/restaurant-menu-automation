# Tasks Filters Implementation Documentation

**Created:** November 19, 2025
**Status:** ✅ Complete
**Files Modified:**
- `UberEats-Image-Extractor/src/pages/Tasks.tsx`
- `UberEats-Image-Extractor/src/services/tasks-service.js`

---

## Overview

The Tasks page now features comprehensive filtering capabilities with two independent, collapsible filter sections:
1. **Task Filters** - Filter tasks by task-specific properties
2. **Restaurant Filters** - Filter tasks based on their associated restaurant's properties

All filters support multi-select (except specific single-value fields like ICP rating and demo store built), allowing users to view tasks matching any of the selected criteria.

---

## Architecture

### Filter Strategy
- **Client-Side Filtering**: All filtering happens in the browser for instant results
- **Data Loading**: All tasks are fetched once on page load via `/api/tasks`
- **Real-Time Updates**: Filters apply immediately as users make selections
- **OR Logic**: Multi-select filters use OR logic (tasks matching ANY selected value are included)

### State Management

```typescript
// Task Filters
const [filters, setFilters] = useState({
  search: '',                    // Full-text search
  status: [] as string[],        // Multi-select: pending, active, completed, cancelled
  type: [] as string[],          // Multi-select: internal_activity, email, call, social_message, text
  priority: [] as string[]       // Multi-select: low, medium, high
});

// Restaurant Filters
const [restaurantFilters, setRestaurantFilters] = useState({
  lead_type: [] as string[],     // Multi-select: inbound, outbound
  lead_category: [] as string[], // Multi-select: paid_ads, organic_content, warm_outreach, cold_outreach
  lead_warmth: [] as string[],   // Multi-select: frozen, cold, warm, hot
  lead_stage: [...] as string[], // Multi-select with defaults (excludes closed_won, closed_lost)
  lead_status: [] as string[],   // Multi-select: active, inactive, ghosted, reengaging, closed
  demo_store_built: 'all',       // Single-select: all, true, false
  icp_rating_min: ''             // Minimum rating: '', '5', '6', '7', '8', '9', '10'
});

// Due Date Filters
const [dueDateFilter, setDueDateFilter] = useState({
  types: [],                     // Multi-select: overdue, today, week, month, no_date
  customDates: undefined         // Date range picker for custom dates
});
```

---

## Filter Sections

### 1. Task Filters Section

#### Search
- **Type**: Full-text search input
- **Searches across:**
  - Task name
  - Task description
  - Restaurant name
  - Restaurant contact name
  - Restaurant contact email
- **Implementation**: Case-insensitive substring matching

#### Status (Multi-Select)
- **Options:**
  - Pending
  - Active
  - Completed
  - Cancelled
- **Behavior**: Shows tasks with ANY of the selected statuses

#### Type (Multi-Select)
- **Options:**
  - Internal Activity
  - Email
  - Call
  - Social Message
  - Text
- **Behavior**: Shows tasks with ANY of the selected types

#### Priority (Multi-Select)
- **Options:**
  - Low
  - Medium
  - High
- **Behavior**: Shows tasks with ANY of the selected priorities

#### Due Date (Multi-Select + Custom)
- **Standard Options (Multi-Select):**
  - **Overdue**: Tasks past due (excludes completed/cancelled)
  - **Today**: Tasks due today (NZ timezone)
  - **This Week**: Tasks due in next 7 days
  - **This Month**: Tasks due in next 30 days
  - **No Due Date**: Tasks without a due date

- **Custom Date Range:**
  - Separate button next to multi-select
  - Opens calendar picker for date range selection
  - Highlights in blue when active
  - Shows selected range as removable badge

- **Behavior**: Tasks matching ANY selected option OR within custom range are shown
- **Timezone**: All date comparisons use NZ timezone (Pacific/Auckland)

---

### 2. Restaurant Filters Section

**Important**: Restaurant filters only apply to tasks that have an associated restaurant. Tasks without restaurants are always included regardless of restaurant filter settings.

#### Lead Type (Multi-Select)
- **Options:**
  - Inbound
  - Outbound
- **Behavior**: Shows tasks where restaurant has ANY of the selected lead types

#### Lead Category (Multi-Select)
- **Options:**
  - Paid Ads
  - Organic Content
  - Warm Outreach
  - Cold Outreach
- **Behavior**: Shows tasks where restaurant has ANY of the selected categories

#### Lead Warmth (Multi-Select)
- **Options:**
  - Frozen
  - Cold
  - Warm
  - Hot
- **Behavior**: Shows tasks where restaurant has ANY of the selected warmth levels

#### Lead Stage (Multi-Select with Defaults)
- **Options:**
  - Uncontacted
  - Reached Out
  - In Talks
  - Demo Booked
  - Rebook Demo
  - Contract Sent
  - Closed Won
  - Closed Lost
  - Reengaging

- **Default Selection** (on page load and after "Clear All"):
  - ✅ Uncontacted
  - ✅ Reached Out
  - ✅ In Talks
  - ✅ Demo Booked
  - ✅ Rebook Demo
  - ✅ Contract Sent
  - ✅ Reengaging
  - ❌ Closed Won (excluded by default)
  - ❌ Closed Lost (excluded by default)

- **Rationale**: Automatically filters out closed deals to focus on active leads

#### Lead Status (Multi-Select)
- **Options:**
  - Active
  - Inactive
  - Ghosted
  - Reengaging
  - Closed
- **Behavior**: Shows tasks where restaurant has ANY of the selected statuses

#### Demo Store Built (Single-Select)
- **Options:**
  - All
  - Built
  - Not Built
- **Behavior**: Filters tasks by restaurant's demo store status

#### Min ICP Rating (Single-Select)
- **Options:**
  - Any rating
  - 5+ Stars
  - 6+ Stars
  - 7+ Stars
  - 8+ Stars
  - 9+ Stars
  - 10 Stars
- **Behavior**: Shows tasks where restaurant has rating >= selected minimum

---

## UI/UX Features

### Independent Collapsible Sections
- Both filter sections open by default on page load
- Click section header to toggle visibility
- Chevron icon indicates collapsed/expanded state
- Sections collapse/expand independently

### Visual Indicators
- **Active Filter Badge**: Shows count of active filters in header
- **Clear All Button**: Appears when any filters are active
- **Custom Date Highlight**: Custom date button turns blue when active
- **Task Count Display**: Shows filtered count vs. total (e.g., "5 filtered tasks of 14 total")

### Filter Grid Layout
- **Task Filters**: 4-column grid (responsive)
  - Search, Status, Type, Priority span 1 column each
  - Due Date spans 2 columns (to accommodate multi-select + custom button)
- **Restaurant Filters**: 4-column grid (responsive)
  - All filters span 1 column each

---

## Backend Changes

### API Endpoint: `GET /api/tasks`

#### Updated Response Fields
Added restaurant sales-specific fields to the API response:

```javascript
restaurants (
  id, name, contact_name, contact_email, contact_phone,
  phone, email, instagram_url, facebook_url,
  city, cuisine, subdomain, organisation_name, demo_store_url,
  lead_type, lead_category, lead_warmth, lead_stage, lead_status,
  demo_store_built, icp_rating
)
```

#### Modified Functions
1. **`listTasks()`** - Added restaurant filter fields to SELECT
2. **`getTaskById()`** - Added restaurant filter fields to SELECT
3. **`createTask()`** - Added restaurant filter fields to SELECT

**File**: `UberEats-Image-Extractor/src/services/tasks-service.js`

---

## Filtering Logic

### Filter Application Order
1. **Search** (task & restaurant fields)
2. **Task Status** (multi-select OR)
3. **Task Type** (multi-select OR)
4. **Task Priority** (multi-select OR)
5. **Due Date** (multi-select OR + custom range OR)
6. **Restaurant Lead Type** (multi-select OR)
7. **Restaurant Lead Category** (multi-select OR)
8. **Restaurant Lead Warmth** (multi-select OR)
9. **Restaurant Lead Stage** (multi-select OR)
10. **Restaurant Lead Status** (multi-select OR)
11. **Restaurant Demo Store** (single value)
12. **Restaurant ICP Rating** (minimum threshold)

### Special Cases

#### Tasks Without Restaurants
Restaurant filters use inclusive logic:
```javascript
!t.restaurants || (t.restaurants.field && filters.includes(t.restaurants.field))
```
This ensures tasks without restaurants are always included, regardless of restaurant filter settings.

#### Due Date Multi-Select Logic
Uses a `Set` to collect tasks matching any date filter:
```javascript
const matchingTasks = new Set<any>();
dueDateFilter.types.forEach(filterType => {
  // Get matches for this filter type
  matches.forEach(task => matchingTasks.add(task));
});
// Custom date range also adds to the set
filtered = Array.from(matchingTasks);
```

#### Lead Stage Default Filtering
The `hasActiveFilters()` function detects when lead_stage differs from defaults:
```javascript
restaurantFilters.lead_stage.length < 7  // Default is 7 stages
```

---

## Usage Examples

### Example 1: View All Urgent Tasks
**Goal**: See overdue tasks and tasks due today

**Filters:**
- Due Date: Select "Overdue" + "Today"

**Result**: All tasks that are either overdue OR due today

---

### Example 2: Sales Call Tasks for Hot Leads
**Goal**: Find active call tasks for hot leads that aren't closed

**Filters:**
- Task Type: "Call"
- Task Status: "Active"
- Restaurant Lead Warmth: "Hot"
- Restaurant Lead Stage: (Use defaults, which exclude closed won/lost)

**Result**: Active call tasks for hot leads still in the sales pipeline

---

### Example 3: Follow-up Tasks for Demos This Week
**Goal**: Find tasks related to demo bookings in the next 7 days

**Filters:**
- Due Date: "This Week"
- Restaurant Lead Stage: "Demo Booked"

**Result**: All tasks due this week for restaurants in "demo booked" stage

---

### Example 4: Search for Specific Restaurant Tasks
**Goal**: Find all tasks related to "Burger Baron"

**Filters:**
- Search: "Burger Baron"

**Result**: All tasks where "Burger Baron" appears in:
- Task name/description
- Restaurant name
- Contact name/email

---

## Clear Filters Behavior

Clicking "Clear All" resets filters to:

**Task Filters:**
- Search: Empty
- Status: None selected
- Type: None selected
- Priority: None selected
- Due Date: None selected
- Custom Date Range: Cleared

**Restaurant Filters:**
- Lead Type: None selected
- Lead Category: None selected
- Lead Warmth: None selected
- **Lead Stage: Default selection** (excludes closed_won, closed_lost)
- Lead Status: None selected
- Demo Store Built: All
- ICP Rating: Any rating

**Note**: Lead Stage reverts to defaults, NOT empty selection.

---

## Performance Considerations

### Client-Side Filtering Benefits
- **Instant Results**: No network latency
- **Smooth UX**: Filters apply immediately as user types/selects
- **Reduced Server Load**: One API call on page load

### Potential Limitations
- **Dataset Size**: Works well for hundreds of tasks; may slow with thousands
- **Memory Usage**: All tasks kept in memory
- **Initial Load**: Slightly slower first load (fetches all data)

### Future Optimization Options
If dataset grows significantly:
1. Server-side filtering for initial load
2. Pagination
3. Virtual scrolling for table
4. Debounced search input

---

## Code References

### Main Implementation
- **Filter State**: [Tasks.tsx:70-96](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx#L70-L96)
- **Filter Logic**: [Tasks.tsx:155-297](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx#L155-L297)
- **Task Filters UI**: [Tasks.tsx:433-630](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx#L433-L630)
- **Restaurant Filters UI**: [Tasks.tsx:632-764](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx#L632-L764)

### Backend Changes
- **List Tasks**: [tasks-service.js:16-35](../../../UberEats-Image-Extractor/src/services/tasks-service.js#L16-L35)
- **Get Task By ID**: [tasks-service.js:74-96](../../../UberEats-Image-Extractor/src/services/tasks-service.js#L74-L96)
- **Create Task**: [tasks-service.js:175-194](../../../UberEats-Image-Extractor/src/services/tasks-service.js#L175-L194)

---

## Testing Checklist

### Functionality Tests
- [x] All multi-select filters work independently
- [x] Multiple values can be selected per filter
- [x] Search filters across all specified fields
- [x] Due date filters respect NZ timezone
- [x] Custom date range picker works correctly
- [x] Restaurant filters include tasks without restaurants
- [x] Lead stage defaults are applied on load
- [x] Clear All resets to correct defaults
- [x] Filter sections collapse/expand independently

### UI Tests
- [x] Filter sections open by default
- [x] Active filter count displays correctly
- [x] Custom date badge appears/disappears
- [x] Chevron icons rotate correctly
- [x] Responsive layout works on mobile
- [x] Multi-select dropdowns display selected items
- [x] Task count updates as filters change

### Edge Cases
- [x] Tasks without restaurants show correctly
- [x] Tasks without due dates filter correctly
- [x] Overdue tasks exclude completed/cancelled
- [x] Empty filter selections show all tasks
- [x] Combining task + restaurant filters works
- [x] Multiple due date selections combine with OR logic

---

## Migration Notes

### Breaking Changes
None - This is a new feature addition

### Database Schema
No schema changes required. Uses existing fields:
- `restaurants.lead_type`
- `restaurants.lead_category`
- `restaurants.lead_warmth`
- `restaurants.lead_stage`
- `restaurants.lead_status`
- `restaurants.demo_store_built`
- `restaurants.icp_rating`

### Dependencies
- Requires `MultiSelect` component (already exists)
- Requires `DateTimePicker` component (already exists)
- Requires `date-fns` for date formatting (already installed)

---

## Future Enhancements

### Potential Features
1. **Save Filter Presets**: Allow users to save commonly used filter combinations
2. **URL State Sync**: Persist filters in URL params (like Restaurants page)
3. **Filter Analytics**: Track which filters are used most
4. **Smart Defaults**: Learn user's preferred filters over time
5. **Export Filtered Tasks**: Download filtered task list as CSV
6. **Bulk Actions**: Perform actions on all filtered tasks

### Performance Improvements
1. **Lazy Loading**: Load tasks in batches for large datasets
2. **Virtual Scrolling**: Render only visible table rows
3. **Search Debouncing**: Delay search filtering until user stops typing
4. **Filter Memoization**: Cache filter results for repeated queries

---

## Troubleshooting

### Issue: Filters not working
**Solution**: Ensure server is restarted to include new restaurant fields in API response

### Issue: Custom date range not clearing
**Solution**: Click the X button on the date badge, or use "Clear All"

### Issue: Tasks without restaurants not showing
**Solution**: Check restaurant filter logic includes `!t.restaurants ||` condition

### Issue: Lead stage filter showing all tasks
**Solution**: Verify default lead_stage array is properly initialized

### Issue: Timezone issues with due dates
**Solution**: Verify NZ timezone functions are being used for date comparisons

---

## Related Documentation
- [Restaurant Filters Implementation](../../../planning/database-plans/sales-specific-features/)
- [Task Management System](../task-system/)
- [Sales Pipeline Architecture](../sales-specific-features/)

---

**Document Version**: 1.0
**Last Updated**: November 19, 2025
**Maintained By**: Development Team
