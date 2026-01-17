# Sales Features Enhancements - Investigation Plan

**Version:** 1.0
**Date:** 2025-01-21
**Status:** Investigation Phase
**Estimated Timeline:** 5-7 days

---

## Table of Contents
1. [Overview](#overview)
2. [Enhancement Areas](#enhancement-areas)
3. [Feature 1: Email Task Enhancements](#feature-1-email-task-enhancements)
4. [Feature 2: RestaurantDetail Page Enhancements](#feature-2-restaurantdetail-page-enhancements)
5. [Feature 3: Restaurants Page Enhancements](#feature-3-restaurants-page-enhancements)
6. [Feature 4: Sequence Builder Updates](#feature-4-sequence-builder-updates)
7. [Implementation Order](#implementation-order)
8. [Dependencies & Risks](#dependencies--risks)

---

## Overview

This document outlines the investigation and planning for four major enhancement areas to the sales-specific features. These enhancements build upon the completed demo booking feature and extend functionality across email tasks, restaurant details, task management, and sequence automation.

### Goals
- 🎯 Enhance email task functionality with subject lines and extended variable replacement
- 🎯 Improve restaurant detail view with qualification data and integrated task management
- 🎯 Add task visibility and quick actions to restaurants list
- 🎯 Extend sequence builder to support demo_meeting tasks and email subjects

---

## Enhancement Areas

### Priority Classification
1. **P0 (Critical)**: Email subject line support
2. **P1 (High)**: Variable replacement for qualification data
3. **P1 (High)**: RestaurantDetail qualification display
4. **P2 (Medium)**: Restaurant page task column
5. **P2 (Medium)**: RestaurantDetail task management
6. **P3 (Low)**: Sequence builder updates

---

## Feature 1: Email Task Enhancements

### 1.1 Extended Variable Replacement

#### Current State Investigation
**File:** `/src/services/variable-replacement-service.js`

**Current Variables (46 total):**
- ✅ Restaurant info: `{restaurant_name}`, `{restaurant_email}`, `{restaurant_phone}`, `{restaurant_address}`, `{restaurant_website}`, `{city}`, `{cuisine}`
- ✅ Contact info: `{contact_name}`, `{first_name}`, `{contact_email}`, `{contact_phone}`
- ✅ Business info: `{organisation_name}`, `{opening_hours_text}`
- ✅ Sales info: `{lead_stage}`, `{lead_warmth}`, `{lead_status}`, `{icp_rating}`
- ✅ Demo store: `{demo_store_url}`, `{demo_store_built}`
- ✅ Pumpd URLs: `{subdomain}`, `{ordering_url}`, `{admin_url}`
- ✅ Platform URLs: `{ubereats_url}`, `{doordash_url}`, `{instagram_url}`, `{facebook_url}`
- ✅ Date variables: `{today}`, `{current_date}`, `{current_year}`

**Missing Qualification Variables (17 new):**

##### Simple Field Variables
1. `{contact_role}` - Contact's role (Owner, Manager, etc.)
2. `{number_of_venues}` - Number of venues (e.g., "3")
3. `{point_of_sale}` - POS system (e.g., "Lightspeed")
4. `{online_ordering_platform}` - Ordering platform (e.g., "Ordermeal")
5. `{meeting_link}` - Demo meeting link URL
6. `{website_type}` - Website type (formatted: "Custom Domain" or "Platform Subdomain")

##### Boolean Field Variables
7. `{online_ordering_handles_delivery}` - Format as "Yes"/"No"/"Unknown"
8. `{self_delivery}` - Format as "Yes"/"No"/"Unknown"

##### Numeric Field Variables
9. `{weekly_uber_sales_volume}` - Format as number with commas: "150 orders"
10. `{uber_aov}` - Format as currency: "$45.00"
11. `{uber_markup}` - Format as percentage: "30.0%"
12. `{uber_profitability}` - Format as percentage: "15.0%" or "-5.0%"

##### Text Field Variables
13. `{uber_profitability_description}` - Free text description
14. `{current_marketing_description}` - Free text description
15. `{qualification_details}` - Free text additional notes

##### JSONB Array Variables (Comma-Separated Lists)
16. `{painpoints}` - Array of TagItems
17. `{core_selling_points}` - Array of TagItems
18. `{features_to_highlight}` - Array of TagItems
19. `{possible_objections}` - Array of TagItems

**Array Formatting Strategy:**
- **Format:** Comma-separated list (sales reps will edit before sending)
- **Example:** `"High commission fees, Limited data access, Poor control over customer experience"`
- **Rationale:** Simple format that's easy to edit; sales reps customize message copy before sending

##### Computed Variables
20. `{last_contacted_day}` - Natural date format for conversational context
  - **Format examples:**
    - "Today"
    - "Yesterday"
    - "on Monday" (this week)
    - "last Tuesday" (last week)
    - "two weeks ago"
    - "in March" (earlier this year)
    - "last year"
    - "Never" (if no contact recorded)
  - **Usage in templates:** "From our conversation {last_contacted_day}, it sounds like..."
  - **Implementation:** Calculate relative to current date using task.last_contacted_at or restaurant.last_contacted_at

#### Implementation Tasks

**Database:**
- [ ] No database changes needed (data already exists)

**Backend:**
- [ ] Update `/src/services/variable-replacement-service.js`
  - Add qualification field mappings to `VARIABLE_MAPPINGS`
  - Add formatting functions:
    - `formatNumber()` - For weekly_uber_sales_volume (e.g., "150 orders")
    - `formatCurrency()` - For uber_aov
    - `formatPercentage()` - For uber_markup, uber_profitability
    - `formatBoolean()` - For yes/no/unknown fields
    - `formatArray()` - Comma-separated list for JSONB arrays
    - `formatRelativeDate()` - For last_contacted_day (natural language)
- [ ] Update `getAvailableVariables()` to include new qualification category
- [ ] Add tests for new variable replacements

**Frontend:**
- [ ] Update message template modals to show new variables in help text
- [ ] Update task creation/edit modals to show available variables

**Testing:**
- [ ] Test variable replacement with all field types
- [ ] Test with null/undefined values
- [ ] Test with empty arrays (should return empty string)
- [ ] Test comma-separated array formatting
- [ ] Test `{last_contacted_day}` with various date ranges
- [ ] Test `{weekly_uber_sales_volume}` formats as "150 orders" not "$150.00"

---

### 1.2 Subject Line Support

#### Current State Investigation

**Tables Without subject_line:**
- ❌ `tasks` table
- ❌ `task_templates` table
- ❌ `message_templates` table
- ❌ `sequence_steps` table (needs investigation)

**UI Components Without subject_line:**
- ❌ `CreateTaskModal.tsx`
- ❌ `EditTaskModal.tsx`
- ❌ `TaskDetailModal.tsx`
- ❌ `TaskTypeQuickView.tsx`
- ❌ `CreateTaskTemplateModal.tsx`
- ❌ Message template modals
- ❌ `SequenceStepBuilder.tsx`

#### Implementation Tasks

**Database Migrations:**
```sql
-- Migration 1: Add subject_line to tasks table
ALTER TABLE public.tasks
  ADD COLUMN subject_line TEXT NULL;

COMMENT ON COLUMN public.tasks.subject_line IS
  'Email subject line (only applicable for email type tasks)';

-- Migration 2: Add subject_line to task_templates table
ALTER TABLE public.task_templates
  ADD COLUMN subject_line TEXT NULL;

COMMENT ON COLUMN public.task_templates.subject_line IS
  'Default email subject line for email type templates';

-- Migration 3: Add subject_line to message_templates table
ALTER TABLE public.message_templates
  ADD COLUMN subject_line TEXT NULL;

COMMENT ON COLUMN public.message_templates.subject_line IS
  'Email subject line (supports variable replacement)';
```

**Migration Files to Create:**
- [ ] `20250122_add_subject_line_to_tasks.sql`
- [ ] `20250122_add_subject_line_to_task_templates.sql`
- [ ] `20250122_add_subject_line_to_message_templates.sql`

**Backend Services:**
- [ ] Update `tasks-service.js`
  - Include `subject_line` in SELECT queries
  - Include `subject_line` in CREATE/UPDATE operations
  - Apply variable replacement to `subject_line` when rendering
- [ ] Update `task-templates-service.js`
  - Include `subject_line` in operations
- [ ] Update `message-templates-service.js`
  - Include `subject_line` in operations
- [ ] Update `sequence-instances-service.js`
  - Apply variable replacement to subject lines in sequence steps

**Frontend Components:**

**Task Modals:**
- [ ] `CreateTaskModal.tsx`
  - Add subject line input (conditional on type === 'email')
  - Position: Below message template selector, above message input
  - Placeholder: "Enter email subject... (supports variables like {restaurant_name})"
- [ ] `EditTaskModal.tsx`
  - Add subject line input for email tasks
  - Include in field change tracking
- [ ] `TaskDetailModal.tsx`
  - Display subject line if present (email tasks only)
  - Show rendered subject line (with variables replaced)

**Task Type Quick View:**
- [ ] `TaskTypeQuickView.tsx`
  - Add subject line display for email tasks
  - Position: Between task type header and message preview
  - Include copy-to-clipboard button
  - Show both template subject (if applicable) and rendered subject
  ```tsx
  {/* Email Subject Line */}
  {task.type === 'email' && task.subject_line && (
    <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
      <div className="text-xs font-medium text-blue-900 mb-2">
        Email Subject
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-blue-900 flex-1">
          {task.subject_line_rendered || task.subject_line}
        </div>
        <CopyButton text={task.subject_line_rendered || task.subject_line} field="Subject" />
      </div>
    </div>
  )}
  ```

**Task Template Modals:**
- [ ] `CreateTaskTemplateModal.tsx`
  - Add subject line input for email type templates
  - Position: After message template selector
  - Show only when type === 'email'

**Message Template Modals:**
- [ ] Update create/edit message template modals
  - Add subject line field
  - Show variable helper text
  - Include in validation

**Testing:**
- [ ] Create email task with subject line
- [ ] Edit email task subject line
- [ ] Duplicate email task (preserve subject)
- [ ] Create email template with subject
- [ ] Variable replacement in subjects
- [ ] Quick view copy-to-clipboard
- [ ] Sequence step email subjects

---

## Feature 2: RestaurantDetail Page Enhancements

### 2.1 Sales Info Tab - Qualification Data Section

#### Current State Investigation

**File:** `/src/pages/RestaurantDetail.jsx`

**Current Tabs (in order):**
1. Overview
2. Contact & Lead
3. **Sales Info** ⬅️ Need to enhance this
4. Branding
5. Configuration
6. Platforms & Social
7. Workflow
8. **Sequences** ⬅️ Will move to position 4 and rename
9. Registration

**Sales Info Tab Current Content:**
- Lead stage, warmth, status
- ICP rating
- Last contacted date
- Notes

**Sales Info Tab Needed Content:**
- Current content (unchanged)
- **NEW:** Qualification Data Section (18 fields)

#### Implementation Tasks

**Backend:**
- [ ] No new endpoints needed (use existing qualification-service.js)
- [ ] Ensure `getRestaurantQualification()` is exported and working

**Frontend:**

**Display Mode (Read-only):**
- [ ] Add "Qualification Data" section below lead information
- [ ] Organize into same 6 sections as QualificationForm:
  1. Contact & Business Context
  2. Delivery & Platform
  3. UberEats Metrics
  4. Marketing & Website
  5. Sales Context (painpoints, selling points, features, objections)
  6. Meeting Details
- [ ] Use helper components:
  - `InfoField` for simple fields
  - `BooleanField` for Yes/No/Unknown
  - `TagList` for arrays
- [ ] Show empty state: "No qualification data recorded yet"

**Edit Mode:**
- [ ] Add QualificationForm component to edit mode
- [ ] Track original vs modified qualification data
- [ ] Include qualification updates in save operation
- [ ] Only send changed qualification fields to backend
- [ ] Use existing `updateChangedFields()` from qualification-service

**UI Layout:**
```tsx
{/* In Sales Info Tab */}
<div className="space-y-6">
  {/* Existing Lead Information Section */}
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Lead Information</h3>
    {/* Current lead fields... */}
  </div>

  {/* NEW: Qualification Data Section */}
  <div className="space-y-4 border-t pt-6">
    <h3 className="text-lg font-semibold">Demo Qualification Data</h3>
    {isEditing ? (
      <QualificationForm
        data={editedData.qualificationData}
        onChange={handleQualificationChange}
      />
    ) : (
      <QualificationDataDisplay data={restaurant} />
    )}
  </div>
</div>
```

**Component to Create:**
- [ ] `QualificationDataDisplay.tsx` - Read-only display component
  - Reuses InfoField, BooleanField, TagList components
  - Same section organization as QualificationForm
  - Handles empty/null values gracefully

**Testing:**
- [ ] View qualification data (populated)
- [ ] View qualification data (empty)
- [ ] Edit qualification data
- [ ] Save only changed fields
- [ ] Verify restaurant record updates

---

### 2.2 Tab Restructuring - Tasks and Sequences

#### Current Structure
Position 7: Workflow
Position 8: Sequences
Position 9: Registration

#### New Structure
Position 4: **Tasks and Sequences** (renamed from Sequences, moved from 8→4)
Position 5: Branding (moved from 4→5)
Position 6: Configuration (moved from 5→6)
Position 7: Platforms & Social (moved from 6→7)
Position 8: Workflow (moved from 7→8)
Position 9: Registration (unchanged)

#### Implementation Tasks

**Tab Reordering:**
- [ ] Update TabsList order in RestaurantDetail.jsx
- [ ] Update tab value from `"sequences"` to `"tasks-sequences"`
- [ ] Ensure routing still works (if using URL params)

**Sequences Content (Current):**
- ✅ Sequence progress cards
- ✅ Start new sequence button
- ✅ Sequence instance management

**Tasks Content (NEW):**
- [ ] Task list table (filtered to current restaurant)
- [ ] Task type filters
- [ ] Task status filters
- [ ] Task priority filters
- [ ] **NO restaurant filter** (already filtered)
- [ ] Create Task button (opens CreateTaskModal with restaurantId)
- [ ] All task actions: Edit, Duplicate, Delete, Follow-up
- [ ] TaskTypeQuickView integration

**Combined Layout:**
```tsx
<TabsContent value="tasks-sequences">
  <div className="space-y-6">
    {/* Tasks Section */}
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

    {/* Sequences Section (existing content) */}
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sequences</h3>
      {/* Existing sequence content */}
    </div>
  </div>
</TabsContent>
```

**Component to Create:**
- [ ] `RestaurantTasksList.tsx` - Filtered task list component
  - Props: `restaurantId`
  - Reuses TasksTable component from Tasks page
  - Hides restaurant filter
  - Shows type, status, priority filters
  - Includes pagination

**Testing:**
- [ ] Tab appears in correct position
- [ ] Tasks load for current restaurant only
- [ ] Filters work correctly
- [ ] Create task pre-fills restaurant
- [ ] Task actions work (edit, duplicate, etc.)
- [ ] Sequences section still works

---

## Feature 3: Restaurants Page Enhancements

### 3.1 New Tasks Column

#### Current State Investigation

**File:** `/src/pages/Restaurants.jsx` (needs investigation)

**Current Columns:**
- Restaurant name
- Status
- Lead stage
- ICP rating
- Contact info
- Actions

**New Column Needed:**
- **Tasks** - Shows oldest active task with color coding and quick view

#### Implementation Tasks

**Backend:**
- [ ] Update restaurant list query to include oldest active task
- [ ] Add LEFT JOIN or subquery:
```sql
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
    AND status != 'completed'
    AND status != 'cancelled'
  ORDER BY due_date ASC NULLS LAST, created_at ASC
  LIMIT 1
) t ON true
```
- [ ] Consider performance impact (add index on tasks.restaurant_id + status + due_date)

**Frontend Components:**

**Task Cell Display:**
```tsx
function TaskCell({ task, restaurantName }) {
  if (!task) {
    return <span className="text-muted-foreground text-sm">No active tasks</span>;
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

  return (
    <div className="flex items-center gap-2">
      <TaskTypeQuickView task={task}>
        <Button variant="ghost" size="sm" className={cn("p-0 h-auto font-normal", getTaskColor())}>
          {task.name}
        </Button>
      </TaskTypeQuickView>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigateToTasks(restaurantName)}
        title="View all tasks for this restaurant"
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}
```

**Navigation Function:**
```typescript
function navigateToTasks(restaurantName: string) {
  // Clear all filters and set restaurant search
  navigate('/tasks', {
    state: {
      clearFilters: true,
      searchQuery: restaurantName
    }
  });
}
```

**Implementation Steps:**
- [ ] Update restaurant service to include task in query
- [ ] Add TaskCell component
- [ ] Import TaskTypeQuickView from tasks components
- [ ] Add column to restaurant table
- [ ] Implement navigation with filter clearing
- [ ] Add database index for performance

**Testing:**
- [ ] Task colors (red/blue/grey) display correctly
- [ ] Quick view popover shows task details
- [ ] Link button navigates to tasks page
- [ ] Tasks page filters clear correctly
- [ ] Restaurant search populates correctly
- [ ] No task case handles gracefully
- [ ] Performance with large restaurant lists

---

## Feature 4: Sequence Builder Updates

### 4.1 Add demo_meeting Task Type

#### Current State Investigation

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Current Task Types (Line 22):**
```typescript
type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call';
```

**Missing:**
- ❌ `demo_meeting`

#### Implementation Tasks

**TypeScript Interface:**
- [ ] Update `StepFormData` type definition
```typescript
type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call' | 'demo_meeting';
```

**UI Updates:**
- [ ] Add demo_meeting to type selector dropdown
- [ ] Conditionally render QualificationForm when type === 'demo_meeting'
- [ ] Handle qualification data in step submission

**Backend:**
- [ ] Verify sequence_steps table supports qualification metadata
- [ ] Update sequence execution to handle demo_meeting type
- [ ] Ensure qualification data syncs to restaurant when task created from sequence

**Testing:**
- [ ] Create sequence with demo_meeting step
- [ ] Execute sequence creates demo task correctly
- [ ] Qualification data preserved
- [ ] Restaurant record updates

---

### 4.2 Add Subject Line Support

#### Implementation Tasks

**Database:**
- [ ] Investigate `sequence_steps` table structure
- [ ] Add `subject_line` column if not present
```sql
ALTER TABLE public.sequence_steps
  ADD COLUMN subject_line TEXT NULL;
```

**UI Updates:**
- [ ] Add subject line input to SequenceStepBuilder
- [ ] Show only when step.type === 'email'
- [ ] Position below message template selector

**Backend:**
- [ ] Include subject_line in sequence step CRUD operations
- [ ] Apply variable replacement when executing sequence steps

**Testing:**
- [ ] Create sequence step with subject line
- [ ] Execute sequence creates task with subject
- [ ] Variables replaced correctly

---

## Implementation Order

### Phase 1: Email Enhancements (Days 1-2)
**Priority: P0**
1. Create subject_line migrations (3 tables)
2. Apply migrations to production
3. Update backend services (tasks, templates, messages)
4. Update CreateTaskModal, EditTaskModal
5. Update TaskTypeQuickView
6. Update template modals
7. Test end-to-end

### Phase 2: Variable Replacement (Day 2-3)
**Priority: P1**
1. Update variable-replacement-service.js
2. Add all qualification field mappings
3. Add formatting functions
4. Update getAvailableVariables()
5. Test with all variable types
6. Update documentation

### Phase 3: RestaurantDetail - Qualification Display (Day 3-4)
**Priority: P1**
1. Create QualificationDataDisplay component
2. Add to Sales Info tab (read mode)
3. Add QualificationForm to edit mode
4. Implement field change tracking
5. Update save operation
6. Test editing flow

### Phase 4: RestaurantDetail - Tasks Tab (Day 4-5)
**Priority: P2**
1. Reorder tabs
2. Rename tab to "Tasks and Sequences"
3. Create RestaurantTasksList component
4. Integrate with existing task modals
5. Test all task operations

### Phase 5: Restaurants Page - Task Column (Day 5-6)
**Priority: P2**
1. Update restaurant service query
2. Add database index
3. Create TaskCell component
4. Add column to table
5. Implement navigation
6. Test performance and functionality

### Phase 6: Sequence Builder (Day 6-7)
**Priority: P3**
1. Add demo_meeting type support
2. Add subject_line field support
3. Test sequence execution
4. Verify qualification sync

---

## Dependencies & Risks

### Dependencies
- ✅ Demo booking feature complete (qualification columns exist)
- ✅ QualificationForm component available
- ✅ qualification-service.js available
- ✅ Helper components (InfoField, BooleanField, TagList) available
- ✅ TaskTypeQuickView component available
- ✅ variable-replacement-service.js exists

### Technical Risks

**Risk 1: Performance on Restaurants Page**
- **Issue:** JOIN to get oldest task may slow down restaurant list
- **Mitigation:** Add composite index on tasks table
- **Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant_active
ON tasks(restaurant_id, status, due_date)
WHERE status NOT IN ('completed', 'cancelled');
```

**Risk 2: Variable Replacement Complexity**
- **Issue:** Array formatting in emails may look bad
- **Mitigation:** Test multiple formatting options, get user feedback

**Risk 3: Tab Reordering Impact**
- **Issue:** Users may be used to current tab order
- **Mitigation:** Minor UX change, document in changelog

**Risk 4: Sequence Builder Complexity**
- **Issue:** Adding QualificationForm to sequence builder may be overwhelming
- **Mitigation:** Make fields collapsible/optional

### Data Migration Risks

**Risk: subject_line Migration**
- **Issue:** Adding nullable column is safe
- **Rollback:** Column can be dropped if needed
- **Impact:** Low risk, backward compatible

### Testing Requirements

**Critical Paths:**
1. ✅ Email with subject line + variables
2. ✅ Qualification data edit in RestaurantDetail
3. ✅ Task creation from RestaurantDetail
4. ✅ Task quick view from Restaurants page
5. ✅ Sequence with demo_meeting + subject

**Performance Testing:**
- [ ] Restaurants page load time with 500+ restaurants
- [ ] Variable replacement with all fields populated
- [ ] Qualification form load/save time

**User Acceptance Testing:**
- [ ] Sales team workflow with new task column
- [ ] Email creation with subject lines
- [ ] Qualification data editing
- [ ] Sequence creation with new features

---

## Next Steps

1. **Review & Approval:** Get stakeholder feedback on this plan
2. **Prioritization:** Confirm priority of each feature
3. **Resource Allocation:** Assign development time
4. **Detailed Design:** Create detailed specs for each feature
5. **Implementation:** Begin Phase 1 (Email Enhancements)

---

**Document Prepared By:** Claude (AI Assistant)
**Last Updated:** 2025-01-21
**Version:** 1.0
**Status:** Ready for Review
