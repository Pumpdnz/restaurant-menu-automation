# Tab Consolidation Investigation - Tasks, Sequences, Message & Task Templates

**Date:** November 25, 2025
**Purpose:** Investigate current page structures to plan tab consolidation similar to Sequences page refactoring
**Status:** Investigation Complete

---

## Executive Summary

This investigation examines the current standalone pages for Tasks, Message Templates, and Task Templates to plan their consolidation into tab-based layouts, following the successful pattern established in the Sequences page refactoring.

**Target Consolidations:**
1. **Sequences Page:** Add "Message Templates" as third tab ✅ (Quick fix completed)
2. **Tasks Page:** Add "Message Templates" and "Task Templates" as tabs
3. **Sequences Page (Extended):** Consider adding "Task Templates" as fourth tab (optional)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Sequences Page Pattern Reference](#sequences-page-pattern-reference)
3. [Tasks Page Analysis](#tasks-page-analysis)
4. [Message Templates Page Analysis](#message-templates-page-analysis)
5. [Task Templates Page Analysis](#task-templates-page-analysis)
6. [Navigation Structure](#navigation-structure)
7. [Proposed Consolidations](#proposed-consolidations)
8. [Implementation Complexity Assessment](#implementation-complexity-assessment)
9. [Detailed Implementation Plans](#detailed-implementation-plans)
10. [Risks and Considerations](#risks-and-considerations)

---

## Current State Analysis

### Existing Pages

| Page | Route | Purpose | Lines of Code |
|------|-------|---------|---------------|
| Tasks | `/tasks` | Manage all tasks with advanced filters | ~1,400 lines |
| Task Templates | `/task-templates` | Manage reusable task templates | ~380 lines |
| Sequences | `/sequences` | Manage sequence instances and templates | ~585 lines |
| Message Templates | `/message-templates` | Manage message templates for tasks | ~365 lines |

### Current Navigation Structure

**From NavigationItems.jsx (lines 32-45):**
```jsx
const navigationItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/restaurants', label: 'Restaurants', icon: Store },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/task-templates', label: 'Task Templates', icon: ClipboardList },
  { href: '/sequences', label: 'Sequences', icon: Workflow },
  { href: '/message-templates', label: 'Message Templates', icon: FileText },
  // ... other items
];
```

**Current Routes (App.tsx lines 160-165):**
```tsx
<Route path="tasks" element={<Tasks />} />
<Route path="task-templates" element={<TaskTemplates />} />
<Route path="sequences" element={<Sequences />} />
<Route path="sequence-templates" element={<Navigate to="/sequences?tab=templates" replace />} />
<Route path="message-templates" element={<MessageTemplates />} />
```

---

## Sequences Page Pattern Reference

### Completed Implementation

The Sequences page successfully demonstrates the tab consolidation pattern:

**Structure:**
- **Tab 1: Instances** - Active sequence instances with filters
- **Tab 2: Templates** - Sequence templates (migrated from separate page)
- **Dropdown Button:** "New Sequence" with options:
  - Single Restaurant
  - Multiple Restaurants (Bulk)
  - New Sequence Template ✅ (just added)

**Key Features:**
1. **Tab-based layout** using shadcn/ui Tabs component
2. **URL parameter sync** (`?tab=instances` or `?tab=templates`)
3. **Shared "New" button** with dropdown for different actions
4. **Filter preservation** per tab
5. **Redirect handling** for old route (`/sequence-templates` → `/sequences?tab=templates`)

**Code Pattern:**
```tsx
<Tabs value={activeTab} onValueChange={handleTabChange}>
  <TabsList size="full">
    <TabsTrigger size="full" variant="blue" value="instances">Instances</TabsTrigger>
    <TabsTrigger size="full" variant="blue" value="templates">Templates</TabsTrigger>
  </TabsList>

  <TabsContent value="instances">
    {/* Instances content with filters */}
  </TabsContent>

  <TabsContent value="templates">
    {/* Templates content migrated from separate page */}
  </TabsContent>
</Tabs>
```

**Dropdown Button Pattern:**
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
    <DropdownMenuItem onClick={() => handleAction('option1')}>
      <div className="flex flex-col">
        <span className="font-medium">Option Title</span>
        <span className="text-xs text-muted-foreground">
          Description of what this does
        </span>
      </div>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Tasks Page Analysis

### Current Structure

**File:** `/src/pages/Tasks.tsx` (1,403 lines)

**Purpose:** Comprehensive task management with advanced filtering

### Features

**1. Task Filters (Collapsible Section - Lines 826-1018)**
- Search (task, restaurant, contact)
- Status (MultiSelect: Pending, Active, Completed, Cancelled)
- Type (MultiSelect: Internal Activity, Email, Call, Social Message, Text)
- Priority (MultiSelect: Low, Medium, High)
- Due Date (MultiSelect: Overdue, Today, This Week, This Month, No Due Date + Custom Range)

**Default Filters:**
```tsx
status: ['active']
type: []
priority: []
dueDateFilter.types: ['overdue', 'today']
```

**2. Restaurant Filters (Collapsible Section - Lines 1020-1170)**
- Lead Type (Inbound, Outbound)
- Lead Category (Paid Ads, Organic Content, Warm Outreach, Cold Outreach)
- Lead Warmth (Frozen, Cold, Warm, Hot)
- Lead Stage (9 options, default: 7 stages)
- Lead Status (Active, Inactive, Ghosted, Reengaging, Closed)
- Demo Store Built (All, Built, Not Built)
- Min ICP Rating (5-10 stars)

**Default Filters:**
```tsx
lead_stage: ['uncontacted', 'reached_out', 'in_talks', 'demo_booked',
             'rebook_demo', 'contract_sent', 'reengaging']
demo_store_built: 'all'
icp_rating_min: ''
```

**3. Main Table (Lines 1180-1341)**
- Columns: Status, Task, Restaurant, Type, Priority, Due Date, Assigned To, Actions
- Sortable: Due Date, Type, Priority
- Interactive status icons (dropdown to change status)
- Inline priority editing (dropdown)
- Inline due date editing (DateTimePicker)
- TaskTypeQuickView component for type column
- Actions: Complete (with dropdown), Edit, Duplicate

**4. Modals:**
- CreateTaskModal (create new, duplicate, follow-up)
- EditTaskModal
- TaskDetailModal
- StartSequenceModal (for "Complete & Start Sequence")

**5. Current Header (Lines 809-824):**
```tsx
<div className="flex justify-between items-center">
  <div>
    <h1>Tasks</h1>
    <p>{count} filtered tasks of {total} total</p>
  </div>
  <Button onClick={() => setModals({ ...modals, create: true })}>
    <Plus className="h-4 w-4 mr-2" />
    New Task
  </Button>
</div>
```

### Key Observations

**Strengths:**
- Very comprehensive filter system (two-tier)
- Well-organized collapsible filter sections
- Advanced due date handling with custom ranges
- Restaurant filter integration
- Clear default filter states with reset/clear options

**Complexity:**
- Large file (~1,400 lines)
- Complex filter state management
- Multiple modal states
- Extensive filter logic (lines 233-405)

**Integration Opportunity:**
- Task Templates and Message Templates are closely related to tasks
- Both are used when creating tasks
- Natural fit for tab consolidation

---

## Message Templates Page Analysis

### Current Structure

**File:** `/src/pages/MessageTemplates.tsx` (365 lines)

**Purpose:** Manage reusable message templates for tasks (email, social_message, text)

### Features

**1. Filters (Lines 168-221)**
- Type (Select: All Types, Email, Social Message, Text)
- Status (Select: All, Active, Inactive)

**Simple filter state:**
```tsx
filters: {
  type: 'all',
  is_active: 'all'
}
```

**2. Table (Lines 230-335)**
- Columns: Name, Type, Description, Variables, Usage Count, Status, Actions
- Click name to edit
- Type badges with icons
- Variables display (first 3 + count)
- Actions: Edit, Duplicate, Delete

**3. Modals:**
- CreateMessageTemplateModal (create, edit, duplicate)

**4. Header:**
```tsx
<Button onClick={() => setModals({ ...modals, create: true })}>
  <Plus className="h-4 w-4 mr-2" />
  New Template
</Button>
```

### Key Observations

**Strengths:**
- Simple, focused functionality
- Clear table layout
- Easy to understand and navigate
- Minimal state management

**Integration Potential:**
- Very similar structure to Sequence Templates
- Would fit naturally as a tab on Tasks or Sequences page
- Small enough to integrate without major refactoring

---

## Task Templates Page Analysis

### Current Structure

**File:** `/src/pages/TaskTemplates.tsx` (382 lines)

**Purpose:** Manage reusable task templates with default messages and priorities

### Features

**1. Filters (Lines 186-241)**
- Type (Select: All Types, Internal Activity, Email, Call, Social Message, Text)
- Status (Select: All, Active, Inactive)

**Simple filter state:**
```tsx
filters: {
  type: 'all',
  is_active: 'all'
}
```

**2. Table (Lines 250-352)**
- Columns: Name, Type, Priority, Message Template, Usage Count, Status, Actions
- Name shows description below (if exists)
- Type badges with icons
- Priority badges (color-coded)
- Message Template indicator (linked template or "Custom message")
- Actions: Edit, Duplicate, Delete

**3. Modals:**
- CreateTaskTemplateModal (create, edit, duplicate)

**4. Header:**
```tsx
<Button onClick={() => setModals({ ...modals, create: true })}>
  <Plus className="h-4 w-4 mr-2" />
  New Template
</Button>
```

### Key Observations

**Strengths:**
- Simple, focused functionality
- Shows relationship to Message Templates
- Priority and type information visible
- Similar structure to Message Templates

**Integration Potential:**
- Natural companion to Tasks page
- Could also fit on Sequences page (used in sequence steps)
- Small enough to integrate easily
- Relationship with Message Templates suggests keeping them together

---

## Navigation Structure

### Current Sidebar Items (NavigationItems.jsx)

```
Dashboard
Restaurants
Tasks
Task Templates          ← Can be consolidated
Sequences
Message Templates      ← Can be consolidated
Extractions
Menus
Social Media
Analytics
History
Settings
[Super Admin]
```

### Current Route Structure (App.tsx)

**Active Routes:**
- `/tasks` → Tasks page
- `/task-templates` → TaskTemplates page
- `/sequences` → Sequences page (with tabs)
- `/message-templates` → MessageTemplates page

**Redirect:**
- `/sequence-templates` → `/sequences?tab=templates`

---

## Proposed Consolidations

### Option 1: Tasks-Centric Consolidation (RECOMMENDED)

**Tasks Page Tabs:**
1. **Tasks** - Current tasks view with all filters
2. **Task Templates** - Manage task templates
3. **Message Templates** - Manage message templates

**Rationale:**
- Tasks, Task Templates, and Message Templates are tightly coupled
- Task Templates reference Message Templates
- Both templates are used when creating tasks
- Natural workflow: Tasks → Templates → Message Templates

**Navigation Changes:**
- Remove: "Task Templates" link
- Remove: "Message Templates" link
- Keep: "Tasks" link
- Keep: "Sequences" link

**Routes:**
- `/tasks` → Tasks page with tabs
- `/task-templates` → Redirect to `/tasks?tab=task-templates`
- `/message-templates` → Redirect to `/tasks?tab=message-templates`
- `/sequences` → Keep as is

**Dropdown Button on Tasks Page:**
```
"New Task" ▼
├─ Single Task
├─ New Task Template
└─ New Message Template
```

**Benefits:**
- Reduces sidebar clutter (2 fewer items)
- Logical grouping of related functionality
- Clear workflow for creating tasks and templates
- Consistent with Sequences page pattern

**Drawbacks:**
- Tasks page becomes very large (~2,200 lines estimated)
- Complex filter state management across tabs
- May be overwhelming for users

---

### Option 2: Dual Consolidation

**Tasks Page Tabs:**
1. **Tasks** - Current tasks view
2. **Task Templates** - Manage task templates

**Sequences Page Tabs:**
1. **Instances** - Current instances view
2. **Templates** - Sequence templates
3. **Message Templates** - Manage message templates

**Rationale:**
- Message Templates are used in both Tasks and Sequences
- Sequences already have a template tab
- Keeps Tasks page more focused
- Message Templates live with other template types

**Navigation Changes:**
- Remove: "Task Templates" link
- Remove: "Message Templates" link
- Keep: "Tasks" link
- Keep: "Sequences" link

**Routes:**
- `/tasks` → Tasks page with 2 tabs
- `/sequences` → Sequences page with 3 tabs
- `/task-templates` → Redirect to `/tasks?tab=templates`
- `/message-templates` → Redirect to `/sequences?tab=message-templates`

**Benefits:**
- Splits complexity between two pages
- Message Templates accessible from Sequences (where they're heavily used)
- Smaller refactoring for each page

**Drawbacks:**
- Message Templates split from Task Templates (less intuitive)
- Users may not know where to find Message Templates
- Sequences page becomes more cluttered

---

### Option 3: Sequences-Centric Consolidation

**Sequences Page Tabs:**
1. **Instances** - Current instances view
2. **Sequence Templates** - Sequence templates
3. **Task Templates** - Manage task templates
4. **Message Templates** - Manage message templates

**Tasks Page:**
- Keep as single-page with current filters

**Rationale:**
- All template types live on Sequences page
- Tasks page stays focused on task management
- Templates are "configuration" rather than "operations"

**Navigation Changes:**
- Remove: "Task Templates" link
- Remove: "Message Templates" link
- Keep: "Tasks" link
- Keep: "Sequences" link

**Routes:**
- `/tasks` → Tasks page (no tabs)
- `/sequences` → Sequences page with 4 tabs
- `/task-templates` → Redirect to `/sequences?tab=task-templates`
- `/message-templates` → Redirect to `/sequences?tab=message-templates`

**Benefits:**
- All templates in one place
- Tasks page stays focused and clean
- Clear "templates" section in app

**Drawbacks:**
- Sequences page becomes very broad
- May confuse users (why are task templates on sequences page?)
- 4 tabs may be too many

---

## Implementation Complexity Assessment

### Tasks Page with 3 Tabs (Option 1)

**Complexity:** HIGH
**Estimated Time:** 6-8 hours
**Risk:** MEDIUM-HIGH

**Why Complex:**
1. Tasks page is already very large (1,400 lines)
2. Complex filter state management needs to be tab-aware
3. Multiple collapsible filter sections
4. Must preserve all existing functionality
5. Need to integrate two separate pages worth of content

**Steps Required:**
1. Add Tabs structure to Tasks page
2. Wrap current content in "Tasks" tab
3. Integrate Task Templates content into second tab
4. Integrate Message Templates content into third tab
5. Add dropdown button with 3 options
6. Update filter state management (tab-aware)
7. Update modals to work across tabs
8. Update navigation (remove 2 links)
9. Add redirect routes for old URLs
10. Test all filter combinations
11. Test all modal workflows

**File Changes:**
- Modify: `/src/pages/Tasks.tsx` (major refactor, ~2,200 lines estimated)
- Modify: `/src/components/navigation/NavigationItems.jsx` (remove 2 items)
- Modify: `/src/App.tsx` (add 2 redirects)
- No new files needed

---

### Sequences Page with Message Templates Tab (Option 2 - Sequences Part)

**Complexity:** LOW
**Estimated Time:** 2-3 hours
**Risk:** LOW

**Why Simpler:**
1. Sequences page already has tabs
2. Message Templates page is simple (365 lines)
3. Similar to Sequence Templates integration
4. Already have dropdown button pattern

**Steps Required:**
1. Add third tab to Sequences page
2. Copy Message Templates content into tab
3. Update tab state management
4. Add "New Message Template" to dropdown
5. Update navigation (remove 1 link)
6. Add redirect route
7. Test tab switching and modals

**File Changes:**
- Modify: `/src/pages/Sequences.tsx` (~650 lines estimated)
- Modify: `/src/components/navigation/NavigationItems.jsx` (remove 1 item)
- Modify: `/src/App.tsx` (add 1 redirect)

---

### Tasks Page with 2 Tabs (Option 2 - Tasks Part)

**Complexity:** MEDIUM
**Estimated Time:** 4-5 hours
**Risk:** MEDIUM

**Why Medium:**
1. Tasks page is large but focused
2. Task Templates is simple to integrate
3. Only one template type to add
4. Less state management complexity than 3 tabs

**Steps Required:**
1. Add Tabs structure to Tasks page
2. Wrap current content in "Tasks" tab
3. Integrate Task Templates content into second tab
4. Update dropdown button with 2 options
5. Update filter state management (tab-aware)
6. Update navigation (remove 1 link)
7. Add redirect route
8. Test workflows

**File Changes:**
- Modify: `/src/pages/Tasks.tsx` (~1,800 lines estimated)
- Modify: `/src/components/navigation/NavigationItems.jsx` (remove 1 item)
- Modify: `/src/App.tsx` (add 1 redirect)

---

## Detailed Implementation Plans

### PLAN A: Tasks with 3 Tabs (RECOMMENDED)

**Target:** `/tasks` with Tasks, Task Templates, Message Templates tabs

#### Phase 1: Preparation (1 hour)

**Step 1.1: Read and understand related components**
- CreateTaskTemplateModal
- CreateMessageTemplateModal
- Understand relationships between components

**Step 1.2: Plan state management**
- Determine which state is tab-specific vs shared
- Plan filter preservation strategy
- Design modal state management across tabs

#### Phase 2: Add Tab Structure (1.5 hours)

**Step 2.1: Add Tabs to Tasks page**
```tsx
<Tabs value={activeTab} onValueChange={handleTabChange}>
  <TabsList size="full">
    <TabsTrigger size="full" variant="blue" value="tasks">Tasks</TabsTrigger>
    <TabsTrigger size="full" variant="blue" value="task-templates">Task Templates</TabsTrigger>
    <TabsTrigger size="full" variant="blue" value="message-templates">Message Templates</TabsTrigger>
  </TabsList>

  <TabsContent value="tasks">
    {/* Current tasks content */}
  </TabsContent>

  <TabsContent value="task-templates">
    {/* Task templates content */}
  </TabsContent>

  <TabsContent value="message-templates">
    {/* Message templates content */}
  </TabsContent>
</Tabs>
```

**Step 2.2: Add URL parameter sync**
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'tasks';

const handleTabChange = (value: string) => {
  setSearchParams({ tab: value });
};
```

**Step 2.3: Preserve existing filters state**
- Keep all existing filter state variables
- Add tab-specific state for templates
- Ensure filter logic only applies to active tab

#### Phase 3: Integrate Task Templates Tab (1.5 hours)

**Step 3.1: Copy content from TaskTemplates.tsx**
- Import necessary components
- Add task template state variables
- Add task template filter state
- Copy table structure

**Step 3.2: Copy modals and handlers**
- Import CreateTaskTemplateModal
- Add modal state management
- Add CRUD handlers (delete, duplicate)

**Step 3.3: Test task templates functionality**
- Create, edit, duplicate, delete
- Filters working correctly
- Modal workflows functional

#### Phase 4: Integrate Message Templates Tab (1.5 hours)

**Step 4.1: Copy content from MessageTemplates.tsx**
- Import necessary components
- Add message template state variables
- Add message template filter state
- Copy table structure

**Step 4.2: Copy modals and handlers**
- Import CreateMessageTemplateModal
- Add modal state management
- Add CRUD handlers (delete, duplicate)

**Step 4.3: Test message templates functionality**
- Create, edit, duplicate, delete
- Filters working correctly
- Modal workflows functional

#### Phase 5: Update Header Button (1 hour)

**Step 5.1: Replace "New Task" button with dropdown**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
      <Plus className="h-4 w-4 mr-2" />
      {activeTab === 'tasks' ? 'New Task' :
       activeTab === 'task-templates' ? 'New Task Template' :
       'New Message Template'}
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleNewTask()}>
      <div className="flex flex-col">
        <span className="font-medium">New Task</span>
        <span className="text-xs text-muted-foreground">
          Create a single task
        </span>
      </div>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleNewTaskTemplate()}>
      <div className="flex flex-col">
        <span className="font-medium">New Task Template</span>
        <span className="text-xs text-muted-foreground">
          Create a reusable task template
        </span>
      </div>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleNewMessageTemplate()}>
      <div className="flex flex-col">
        <span className="font-medium">New Message Template</span>
        <span className="text-xs text-muted-foreground">
          Create a reusable message template
        </span>
      </div>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Step 5.2: Add handlers for each option**
```tsx
const handleNewTask = () => {
  setModals({ ...modals, create: true });
};

const handleNewTaskTemplate = () => {
  setTaskTemplateModals({ ...taskTemplateModals, create: true });
};

const handleNewMessageTemplate = () => {
  setMessageTemplateModals({ ...messageTemplateModals, create: true });
};
```

#### Phase 6: Update Navigation and Routes (30 minutes)

**Step 6.1: Update NavigationItems.jsx**
```jsx
const navigationItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/restaurants', label: 'Restaurants', icon: Store },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  // REMOVED: task-templates
  // REMOVED: message-templates
  { href: '/sequences', label: 'Sequences', icon: Workflow },
  // ... rest
];
```

**Step 6.2: Add redirects in App.tsx**
```tsx
<Route path="task-templates" element={<Navigate to="/tasks?tab=task-templates" replace />} />
<Route path="message-templates" element={<Navigate to="/tasks?tab=message-templates" replace />} />
```

#### Phase 7: Testing (1 hour)

**Step 7.1: Tab functionality**
- Switch between tabs
- URL updates correctly
- Deep linking works (`/tasks?tab=task-templates`)
- Browser back/forward navigation

**Step 7.2: Tasks tab**
- All filters working
- Task CRUD operations
- Modal workflows
- Quick actions (complete with dropdown, duplicate, edit)

**Step 7.3: Task Templates tab**
- Create, edit, duplicate, delete
- Filters working
- Modal workflows

**Step 7.4: Message Templates tab**
- Create, edit, duplicate, delete
- Filters working
- Modal workflows

**Step 7.5: Header dropdown**
- All three options work
- Opens correct modal
- Context awareness (current tab)

**Step 7.6: Redirects**
- `/task-templates` redirects correctly
- `/message-templates` redirects correctly
- Old bookmarks work

#### Phase 8: Polish and Documentation (30 minutes)

**Step 8.1: Code cleanup**
- Remove unused imports
- Clean up commented code
- Organize state variables
- Add comments for complex sections

**Step 8.2: Update documentation**
- Update any relevant docs
- Update investigation findings file
- Create completion summary

---

### PLAN B: Dual Consolidation (ALTERNATIVE)

**Target:** Tasks with 2 tabs + Sequences with 3 tabs

#### Part 1: Sequences with Message Templates (2-3 hours)

Follow similar steps to Plan A but simpler:
1. Add third tab to existing Sequences tabs
2. Copy Message Templates content
3. Update dropdown button
4. Test workflows

#### Part 2: Tasks with Task Templates (4-5 hours)

Follow similar steps to Plan A but only add one tab:
1. Add Tabs structure to Tasks
2. Integrate Task Templates
3. Update dropdown button
4. Test workflows

**Total Time:** 6-8 hours (similar to Plan A but split across two pages)

---

## Risks and Considerations

### Technical Risks

**1. State Management Complexity**
- **Risk:** Filter state conflicts between tabs
- **Mitigation:** Clear separation of state variables, tab-aware filtering
- **Impact:** MEDIUM

**2. File Size**
- **Risk:** Tasks page becomes too large (2,200+ lines)
- **Mitigation:** Consider extracting components if needed
- **Impact:** LOW (manageable)

**3. Performance**
- **Risk:** Rendering all tab content may slow down page
- **Mitigation:** Tabs render content only when active (TabsContent pattern)
- **Impact:** LOW

**4. Modal Conflicts**
- **Risk:** Multiple modals across tabs may conflict
- **Mitigation:** Careful modal state management, unique modal keys
- **Impact:** LOW-MEDIUM

### User Experience Risks

**1. Discoverability**
- **Risk:** Users may not find templates in tabs
- **Mitigation:** Clear tab labels, intuitive grouping
- **Impact:** LOW

**2. Workflow Disruption**
- **Risk:** Users accustomed to separate pages
- **Mitigation:** Redirects preserve old URLs, gradual rollout
- **Impact:** LOW-MEDIUM

**3. Navigation Complexity**
- **Risk:** Users may get confused with fewer sidebar items
- **Mitigation:** Logical grouping, clear tab names
- **Impact:** LOW

### Business Risks

**1. Adoption**
- **Risk:** Users resist change
- **Mitigation:** Follow successful Sequences page pattern, maintain functionality
- **Impact:** LOW

**2. Testing Coverage**
- **Risk:** Missing edge cases in tab interactions
- **Mitigation:** Comprehensive testing checklist, manual testing
- **Impact:** MEDIUM

---

## Recommendation

**Recommended Approach: PLAN A - Tasks with 3 Tabs**

### Rationale

1. **Logical Grouping:** Tasks, Task Templates, and Message Templates are tightly coupled in workflow
2. **Proven Pattern:** Follows successful Sequences page refactoring
3. **User Benefit:** All task-related functionality in one place
4. **Navigation Clarity:** Reduces sidebar clutter (2 fewer items)
5. **Consistency:** Maintains UI patterns established in Sequences page

### Implementation Priority

**Priority 1: Sequences - Add Message Templates Tab (COMPLETED ✅)**
- Quick fix completed
- Low risk, high value
- Further refining dropdown to open correct modal

**Priority 2: Tasks - Add Task Templates and Message Templates Tabs**
- Higher complexity but highest value
- Natural workflow grouping
- Significant sidebar cleanup

**Priority 3: Consider Sequences - Add Task Templates Tab (OPTIONAL)**
- Only if user feedback suggests value
- May create confusion about where to find templates
- Lower priority than other consolidations

### Success Metrics

1. **Reduced sidebar items:** From 6 to 4 main work pages (Restaurants, Tasks, Sequences, Extractions)
2. **User task completion time:** No increase (ideally decrease)
3. **Template usage:** Increase in template usage due to better discoverability
4. **Support tickets:** No increase in confusion-related tickets

---

## Next Steps

1. **Complete Priority 1:** ✅ DONE - Added "New Sequence Template" to dropdown
2. **Begin Priority 2 Investigation:** Read related components and plan state management
3. **Create detailed test plan:** Based on Phase 7 testing steps
4. **Schedule implementation:** Allocate 6-8 hour block for focused development
5. **Communicate changes:** Prepare user communication about navigation updates

---

## Appendix A: Component Dependencies

### Tasks Page Dependencies

**Current Imports:**
- CreateTaskModal
- EditTaskModal
- TaskDetailModal
- TaskTypeQuickView
- StartSequenceModal
- Table, Button, Badge, Select, MultiSelect, Input, Calendar, DateTimePicker

**Additional for Templates:**
- CreateTaskTemplateModal (from task-templates)
- CreateMessageTemplateModal (from message-templates)

### Sequences Page Dependencies

**Current Imports:**
- SequenceProgressCard
- SelectRestaurantForSequenceModal
- StartSequenceModal
- BulkStartSequenceModal
- CreateTaskModal
- CreateSequenceTemplateModal
- EditSequenceTemplateModal
- SequenceTemplateCard

**Additional for Message Templates:**
- CreateMessageTemplateModal (from message-templates)

---

## Appendix B: Filter Comparison

### Tasks Page Filters

**Complexity:** HIGH (10 filter types, 2 tiers)

| Filter | Type | Default | Options |
|--------|------|---------|---------|
| Search | Text | '' | Any text |
| Status | MultiSelect | ['active'] | 4 options |
| Type | MultiSelect | [] | 5 options |
| Priority | MultiSelect | [] | 3 options |
| Due Date | MultiSelect + Custom | ['overdue', 'today'] | 5 options + range |
| Lead Type | MultiSelect | [] | 2 options |
| Lead Category | MultiSelect | [] | 4 options |
| Lead Warmth | MultiSelect | [] | 4 options |
| Lead Stage | MultiSelect | [7 stages] | 9 options |
| Lead Status | MultiSelect | [] | 5 options |
| Demo Store | Select | 'all' | 3 options |
| ICP Rating | Select | '' | 7 options |

### Message Templates Page Filters

**Complexity:** LOW (2 filter types)

| Filter | Type | Default | Options |
|--------|------|---------|---------|
| Type | Select | 'all' | 4 options |
| Status | Select | 'all' | 3 options |

### Task Templates Page Filters

**Complexity:** LOW (2 filter types)

| Filter | Type | Default | Options |
|--------|------|---------|---------|
| Type | Select | 'all' | 6 options |
| Status | Select | 'all' | 3 options |

---

## Appendix C: Modal Inventory

### Tasks Page Modals

1. **CreateTaskModal** - Create, duplicate, follow-up task
2. **EditTaskModal** - Edit existing task
3. **TaskDetailModal** - View task details
4. **StartSequenceModal** - Start sequence from task

### Task Templates Page Modals

1. **CreateTaskTemplateModal** - Create, edit, duplicate template

### Message Templates Page Modals

1. **CreateMessageTemplateModal** - Create, edit, duplicate template

### Sequences Page Modals

1. **SelectRestaurantForSequenceModal** - Select restaurant for sequence
2. **StartSequenceModal** - Start sequence for single restaurant
3. **BulkStartSequenceModal** - Start sequence for multiple restaurants
4. **CreateTaskModal** - Create follow-up task from sequence
5. **CreateSequenceTemplateModal** - Create sequence template
6. **EditSequenceTemplateModal** - Edit sequence template

---

## Appendix D: URL Structure After Consolidation

### Proposed URLs (Plan A)

**Active Routes:**
- `/` → Dashboard
- `/restaurants` → Restaurants
- `/restaurants/:id` → Restaurant Detail
- `/tasks` → Tasks (default: tasks tab)
- `/tasks?tab=tasks` → Tasks tab
- `/tasks?tab=task-templates` → Task Templates tab
- `/tasks?tab=message-templates` → Message Templates tab
- `/sequences` → Sequences (default: instances tab)
- `/sequences?tab=instances` → Instances tab
- `/sequences?tab=templates` → Sequence Templates tab
- `/extractions` → Extractions
- `/menus` → Menus
- `/social-media` → Social Media Dashboard

**Redirect Routes:**
- `/task-templates` → `/tasks?tab=task-templates`
- `/message-templates` → `/tasks?tab=message-templates`
- `/sequence-templates` → `/sequences?tab=templates` (existing)

### Deep Linking Support

All tabs support direct deep linking:
- `example.com/tasks?tab=task-templates` - Opens Tasks page on Task Templates tab
- `example.com/sequences?tab=templates` - Opens Sequences page on Templates tab

---

**End of Investigation Document**
