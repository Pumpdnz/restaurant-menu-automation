# Investigation 3: RestaurantDetail Tasks Integration

**Status:** ✅ Complete
**Date:** November 22, 2025
**Time Spent:** 1 hour
**File Investigated:** `/src/pages/RestaurantDetail.jsx` (3900+ lines)

---

## Summary

RestaurantDetail is a **large, tab-based detail page** with 9 tabs currently. Uses shadcn/ui Tabs component with controlled `activeTab` state. Edit mode uses a separate `editedData` state object and compares changes before saving (only sends modified fields). The **Sequences tab** (position 8) contains sequence management, and the **Sales Info tab** (position 3) contains lead information. Both tabs need enhancement as per Feature 2 requirements.

---

## 1. Current Tab Structure

### Tab Order (Lines 2539-2549)
```jsx
<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>              {/* Position 1 */}
  <TabsTrigger value="contact">Contact & Lead</TabsTrigger>          {/* Position 2 */}
  <TabsTrigger value="sales">Sales Info</TabsTrigger>                {/* Position 3 */}
  <TabsTrigger value="branding">Branding</TabsTrigger>               {/* Position 4 */}
  <TabsTrigger value="configuration">Configuration</TabsTrigger>     {/* Position 5 */}
  <TabsTrigger value="platforms">Platforms & Social</TabsTrigger>    {/* Position 6 */}
  <TabsTrigger value="workflow">Workflow</TabsTrigger>               {/* Position 7 */}
  <TabsTrigger value="sequences">Sequences</TabsTrigger>             {/* Position 8 */}
  <TabsTrigger value="registration">Pumpd Registration</TabsTrigger> {/* Position 9 */}
</TabsList>
```

### Tabs Component
- **Framework:** shadcn/ui Tabs (imported line 54)
- **State:** `activeTab` state (line 84) - Controlled component
- **Default:** `'overview'` (line 84)
- **Structure:** `<Tabs>` → `<TabsList>` → `<TabsTrigger>` + `<TabsContent>`

### Tab State Management
```javascript
// Line 84
const [activeTab, setActiveTab] = useState('overview');
```

**No URL routing** - Tab state not synced to URL params

---

## 2. Sales Info Tab Structure

### Current Content (Lines 2796-2802)
```jsx
<TabsContent value="sales" className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Sales Information</CardTitle>
      <CardDescription>
        Lead tracking, categorization, and sales pipeline management
      </CardDescription>
    </CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Lead fields... */}
    </CardContent>
  </Card>
</TabsContent>
```

### Fields Currently Displayed
**Layout:** 2-column grid (`grid-cols-1 md:grid-cols-2`)

**Fields (in order):**
1. Lead Type (Select: inbound/outbound)
2. Lead Category (Select: paid_ads/organic_content/warm_outreach/cold_outreach)
3. Lead Warmth (Select: frozen/cold/warm/hot)
4. Lead Stage (Select: 9 options)
5. Lead Status (Select: active/inactive/ghosted/reengaging/closed)
6. ICP Rating (Select: 0-10)
7. Demo Store Built (Select: yes/no)
8. Demo Store URL (Input)
9. Last Contacted (DateTimePicker)
10. Assigned Sales Rep (Select - fetches users)
11. Notes (Textarea - full width)

### What's Missing
❌ **No Qualification Data section** (18 fields needed)
- Currently qualification fields are NOT displayed in Sales Info tab
- Need to add new section below existing lead information
- Must show both read-only and edit modes

---

## 3. Sequences Tab Structure

### Current Content (Lines 3795-3806)
```jsx
<TabsContent value="sequences" className="space-y-4">
  <div className="flex justify-between items-center mb-4">
    <div>
      <h2 className="text-xl font-semibold">Active Sequences</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Automated task sequences for this restaurant
      </p>
    </div>
    <Button onClick={() => setStartSequenceModalOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      Start Sequence
    </Button>
  </div>

  {/* Loading State */}
  {sequencesLoading && (
    <div className="flex justify-center items-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )}

  {/* Sequence Progress Cards */}
  {restaurantSequences && restaurantSequences.length > 0 ? (
    <div className="grid grid-cols-1 gap-4">
      {restaurantSequences.map(sequence => (
        <SequenceProgressCard key={sequence.id} sequence={sequence} />
      ))}
    </div>
  ) : (
    <p className="text-muted-foreground text-center py-8">
      No active sequences
    </p>
  )}
</TabsContent>
```

### Components Used
- **SequenceProgressCard** (imported line 70) - Displays individual sequence
- **StartSequenceModal** (imported line 71) - Modal to start new sequence
- **useRestaurantSequences** (imported line 72) - React Query hook for data

### Sequences Hook
```javascript
// Line 128
const { data: restaurantSequences, isLoading: sequencesLoading } = useRestaurantSequences(id);
```

**Data Flow:**
1. Hook fetches sequences for current restaurant ID
2. Returns array of sequence instances
3. Each rendered in SequenceProgressCard
4. Loading state during fetch

### Modal State
```javascript
// Line 125
const [startSequenceModalOpen, setStartSequenceModalOpen] = useState(false);
```

### What's Missing
❌ **No Tasks section** - Need to add task list above or below sequences
- Task list table (filtered to current restaurant)
- Create Task button
- Task filters (type, status, priority)
- Task actions (edit, duplicate, delete)

---

## 4. Edit Mode Handling

### Edit State (Lines 82-83)
```javascript
const [isEditing, setIsEditing] = useState(false);
const [editedData, setEditedData] = useState({});
```

### Edit vs View Pattern
**Throughout all tabs:**
```jsx
{isEditing ? (
  <Input
    value={editedData.field_name || ''}
    onChange={(e) => handleFieldChange('field_name', e.target.value)}
  />
) : (
  <div className="text-sm">{restaurant.field_name || '-'}</div>
)}
```

### Field Change Handler (Lines 1264-1269)
```javascript
const handleFieldChange = (field, value) => {
  setEditedData(prev => ({
    ...prev,
    [field]: value
  }));
};
```

**Simple shallow merge** - Updates single field at a time

### Save Handler (Lines 1081-1150+)
```javascript
const handleSave = async () => {
  setSaving(true);
  setError(null);
  setSuccess(null);

  try {
    let dataToSave = {};

    if (isNewRestaurant) {
      // For new restaurants, send all data
      dataToSave = { ...editedData };
    } else {
      // For updates, only send changed fields
      Object.keys(editedData).forEach(key => {
        // Compare with original restaurant data
        const originalValue = restaurant[key];
        const editedValue = editedData[key];

        // Check if value has changed
        // Uses JSON.stringify for deep comparison
        if (JSON.stringify(originalValue) !== JSON.stringify(editedValue)) {
          dataToSave[key] = editedValue;
        }
      });
    }

    // Make API call
    const url = isNewRestaurant ? '/restaurants' : `/restaurants/${id}`;
    const method = isNewRestaurant ? 'post' : 'patch';

    const response = await api[method](url, dataToSave);

    // Update local state
    if (response.data.restaurant) {
      setRestaurant(response.data.restaurant);
      setEditedData(response.data.restaurant);
    }

    setIsEditing(false);
    setSuccess('Changes saved successfully');
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to save changes');
  } finally {
    setSaving(false);
  }
};
```

**Key Points:**
- ✅ Only sends changed fields (not full object)
- ✅ Uses JSON.stringify for deep comparison (arrays, objects)
- ✅ Updates local state optimistically after save
- ✅ Separate handling for new vs existing restaurants

### Edit/Cancel Buttons
**Pattern used throughout:**
```jsx
{isEditing ? (
  <div className="flex gap-2">
    <Button onClick={handleSave} disabled={saving}>
      <Save className="h-4 w-4 mr-2" />
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
    <Button variant="outline" onClick={handleCancel}>
      <X className="h-4 w-4 mr-2" />
      Cancel
    </Button>
  </div>
) : (
  <Button onClick={() => setIsEditing(true)}>
    <Edit className="h-4 w-4 mr-2" />
    Edit
  </Button>
)}
```

---

## 5. Qualification Data Display Strategy

### Requirements
**Feature 2.1:** Add Qualification Data section to Sales Info tab

**18 fields to display:**
1. contact_role
2. number_of_venues
3. point_of_sale
4. online_ordering_platform
5. online_ordering_handles_delivery
6. self_delivery
7. weekly_uber_sales_volume
8. uber_aov
9. uber_markup
10. uber_profitability
11. uber_profitability_description
12. current_marketing_description
13. painpoints (JSONB array)
14. core_selling_points (JSONB array)
15. features_to_highlight (JSONB array)
16. possible_objections (JSONB array)
17. meeting_link
18. qualification_details

### Recommended Implementation

**Option 1: Reuse QualificationForm Component** (Best for Edit Mode)
```jsx
{/* In Sales Info Tab, after existing fields */}
<div className="col-span-2 border-t pt-6 mt-6">
  <h3 className="text-lg font-semibold mb-4">Demo Qualification Data</h3>

  {isEditing ? (
    <QualificationForm
      data={editedData}
      onChange={(field, value) => handleFieldChange(field, value)}
    />
  ) : (
    <QualificationDataDisplay data={restaurant} />
  )}
</div>
```

**Option 2: Create QualificationDataDisplay Component** (For Read Mode)
```jsx
// /components/demo-meeting/QualificationDataDisplay.tsx
export function QualificationDataDisplay({ data }) {
  return (
    <div className="space-y-6">
      {/* Section 1: Contact & Business Context */}
      <div>
        <h4 className="font-medium mb-3">Contact & Business Context</h4>
        <div className="grid grid-cols-2 gap-4">
          <InfoField label="Contact Role" value={data.contact_role} />
          <InfoField label="Number of Venues" value={data.number_of_venues} />
          <InfoField label="Point of Sale" value={data.point_of_sale} />
        </div>
      </div>

      {/* Section 2-6... */}
    </div>
  );
}
```

### Integration with Save Handler
**No changes needed!** The existing save handler already:
- ✅ Compares all fields (including qualification fields)
- ✅ Only sends changed fields
- ✅ Uses deep comparison for objects/arrays
- ✅ Works with any field in `editedData`

**Just need to:**
1. Ensure qualification fields are in `editedData` when editing
2. Update `editedData` via `handleFieldChange` when values change

---

## 6. Tab Reordering Requirements

### Current Order
1. Overview
2. Contact & Lead
3. **Sales Info** ← Will add qualification data here
4. Branding
5. Configuration
6. Platforms & Social
7. Workflow
8. **Sequences** ← Will rename and add tasks
9. Registration

### New Order (Per Feature 2.2)
1. Overview
2. Contact & Lead
3. Sales Info
4. **Tasks and Sequences** ← MOVED from 8, RENAMED, ENHANCED
5. Branding ← Moved from 4
6. Configuration ← Moved from 5
7. Platforms & Social ← Moved from 6
8. Workflow ← Moved from 7
9. Registration ← Unchanged

### Implementation
```jsx
<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="contact">Contact & Lead</TabsTrigger>
  <TabsTrigger value="sales">Sales Info</TabsTrigger>
  <TabsTrigger value="tasks-sequences">Tasks and Sequences</TabsTrigger> {/* MOVED */}
  <TabsTrigger value="branding">Branding</TabsTrigger>
  <TabsTrigger value="configuration">Configuration</TabsTrigger>
  <TabsTrigger value="platforms">Platforms & Social</TabsTrigger>
  <TabsTrigger value="workflow">Workflow</TabsTrigger>
  <TabsTrigger value="registration">Pumpd Registration</TabsTrigger>
</TabsList>

{/* Update TabsContent value */}
<TabsContent value="tasks-sequences" className="space-y-6">
  {/* Tasks Section - NEW */}
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">Tasks</h3>
      <Button onClick={handleCreateTask}>
        <Plus className="h-4 w-4 mr-2" />
        New Task
      </Button>
    </div>
    <RestaurantTasksList restaurantId={id} />
  </div>

  {/* Divider */}
  <div className="border-t" />

  {/* Sequences Section - EXISTING */}
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">Sequences</h3>
      <Button onClick={() => setStartSequenceModalOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Start Sequence
      </Button>
    </div>
    {/* Existing sequence content */}
  </div>
</TabsContent>
```

---

## 7. RestaurantTasksList Component

### Requirements
**Component to create:** `/components/tasks/RestaurantTasksList.tsx`

**Props:**
```typescript
interface RestaurantTasksListProps {
  restaurantId: string;
}
```

**Functionality:**
- Fetch tasks for specific restaurant
- Display in table format (reuse Tasks page table)
- Filter by type, status, priority
- **NO restaurant filter** (already filtered by prop)
- Pagination
- Task actions: Edit, Duplicate, Delete, Complete

### Recommended Implementation Strategy

**Option 1: Reuse Existing Tasks Page Logic**
```tsx
import { TasksTable } from '../pages/Tasks';

export function RestaurantTasksList({ restaurantId }) {
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({
    status: ['active'],
    type: [],
    priority: []
  });

  useEffect(() => {
    fetchTasks();
  }, [restaurantId]);

  const fetchTasks = async () => {
    const response = await api.get(`/tasks?restaurant_id=${restaurantId}`);
    setTasks(response.data.tasks || []);
  };

  // Client-side filtering (same as Tasks page)
  const filteredTasks = applyFilters(tasks, filters);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <TaskFilters filters={filters} onUpdate={setFilters} hideRestaurantFilter />

      {/* Table */}
      <TasksTable tasks={filteredTasks} onUpdate={fetchTasks} />
    </div>
  );
}
```

**Option 2: Extract Reusable Components**
Create smaller reusable components from Tasks page:
- `TaskFilters` - Filter UI
- `TasksTable` - Table display
- `TaskRow` - Single task row

**Recommended:** Option 2 - Better code reuse

---

## 8. State Management Additions

### New States Needed
```javascript
// Task modal states
const [taskModalOpen, setTaskModalOpen] = useState(false);
const [editTaskId, setEditTaskId] = useState(null);

// Refresh trigger for tasks
const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
```

### New Handlers Needed
```javascript
const handleCreateTask = () => {
  setTaskModalOpen(true);
  setEditTaskId(null);
};

const handleTaskUpdate = () => {
  // Increment refresh key to trigger re-fetch in RestaurantTasksList
  setTasksRefreshKey(prev => prev + 1);
};
```

---

## 9. Data Flow Diagrams

### Qualification Data Display
```
Component Mount
  ↓
fetchRestaurantDetails()
  ↓
GET /restaurants/:id/details
  ↓
restaurant state updated (includes qualification fields)
  ↓
editedData initialized from restaurant
  ↓
Sales Info Tab Render
  ↓
isEditing ? QualificationForm : QualificationDataDisplay
  ↓
Display qualification fields
```

### Qualification Data Edit
```
User clicks Edit
  ↓
setIsEditing(true)
  ↓
QualificationForm renders
  ↓
User changes field
  ↓
handleFieldChange(field, value)
  ↓
editedData updated
  ↓
User clicks Save
  ↓
handleSave() compares editedData vs restaurant
  ↓
PATCH /restaurants/:id with only changed fields
  ↓
restaurant state updated
  ↓
setIsEditing(false)
```

### Tasks Display
```
Tab switch to "tasks-sequences"
  ↓
RestaurantTasksList component mounts
  ↓
GET /tasks?restaurant_id={id}
  ↓
tasks state updated
  ↓
Client-side filtering applied
  ↓
TasksTable renders filtered tasks
  ↓
User clicks Edit Task
  ↓
EditTaskModal opens
  ↓
User saves changes
  ↓
onUpdate callback fires
  ↓
Tasks re-fetched
  ↓
Table updates
```

---

## 10. Components to Create/Modify

### New Components
1. **QualificationDataDisplay.tsx** - Read-only qualification display
   - Location: `/components/demo-meeting/`
   - Reuses: InfoField, BooleanField, TagList
   - Sections: 6 sections matching QualificationForm

2. **RestaurantTasksList.tsx** - Task list for restaurant detail
   - Location: `/components/tasks/`
   - Props: `restaurantId`
   - Functionality: Filtered task list

### Components to Modify
1. **QualificationForm.tsx** (if needed)
   - May need to accept external onChange handler
   - Currently uses internal state
   - Check if it can work with parent-controlled state

---

## 11. Gotchas & Edge Cases

⚠️ **Large file (3900+ lines)** - May be slow to load/edit, consider refactoring tabs into separate components

⚠️ **isNewRestaurant logic** - Special handling for new restaurant creation (line 200)
- Sets isEditing=true by default
- Saves all fields (not just changed)

⚠️ **Deep comparison** - Uses JSON.stringify (line 1100) for comparing arrays/objects
- Works for qualification arrays
- May have issues with undefined vs null

⚠️ **No URL routing for tabs** - activeTab not in URL params
- User can't bookmark specific tab
- Tab state lost on refresh

⚠️ **Sequences hook** - Uses React Query (useRestaurantSequences)
- Tasks should use similar pattern for consistency
- Or use simple useState + useEffect

⚠️ **EditedData initialization** - Set from restaurant on load (line 317)
- Qualification fields must be present in restaurant object
- Check backend returns all qualification fields

⚠️ **Save only sends changed fields** - Good for performance
- But means qualification fields with null → undefined won't update
- Use explicit null checks if needed

⚠️ **Grid layout in Sales Info** - 2-column grid
- Qualification section should span full width (`col-span-2`)
- Or use separate section below

---

## 12. Recommended Implementation Order

### Phase 1: Qualification Display (2-3 hours)
1. Create QualificationDataDisplay component
2. Add to Sales Info tab (read mode)
3. Test with existing data

### Phase 2: Qualification Edit (2 hours)
1. Update QualificationForm to accept onChange prop
2. Add QualificationForm to Sales Info tab (edit mode)
3. Test field change tracking
4. Test save operation
5. Verify only changed fields sent

### Phase 3: Tab Reordering (30 minutes)
1. Reorder TabsTrigger components
2. Rename "sequences" → "tasks-sequences"
3. Update TabsContent value
4. Test tab navigation

### Phase 4: Tasks Integration (3-4 hours)
1. Extract TaskFilters component from Tasks page
2. Extract TasksTable component from Tasks page
3. Create RestaurantTasksList component
4. Add to tasks-sequences tab
5. Wire up Create Task button
6. Test all task operations
7. Test refresh after updates

### Phase 5: Polish & Testing (1 hour)
1. Test edit mode with qualification + tasks
2. Test tab switching doesn't lose state
3. Test save with mix of fields
4. Verify performance

**Total Estimated Time:** 8-10 hours

---

## 13. Testing Scenarios

**Test 1: Qualification Display**
- Navigate to Sales Info tab
- Verify qualification section appears
- Check all 18 fields display correctly
- Check empty states handle gracefully

**Test 2: Qualification Edit**
- Click Edit button
- Modify qualification fields
- Click Save
- Verify only changed fields sent to backend
- Verify data persists

**Test 3: Tab Reordering**
- Navigate to each tab in order
- Verify new position 4 is "Tasks and Sequences"
- Verify other tabs shifted correctly
- Check no broken content

**Test 4: Tasks List**
- Navigate to Tasks and Sequences tab
- Verify tasks load for current restaurant only
- Filter by type/status/priority
- Create new task (should pre-fill restaurant)
- Edit existing task
- Delete task

**Test 5: Sequences (Existing)**
- Verify sequences still work after tab rename
- Start new sequence
- Check sequence progress cards

**Test 6: Edit Mode Integration**
- Click Edit with qualification data populated
- Modify qualification field + normal field
- Click Save
- Verify both updates persist
- Click Cancel
- Verify changes reverted

---

**Investigation Complete:** ✅
**Findings Documented:** ✅
**Ready for Implementation:** After all investigations complete
