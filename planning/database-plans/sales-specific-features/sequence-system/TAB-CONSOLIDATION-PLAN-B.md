# Tab Consolidation Implementation Plan - Plan B (Dual Consolidation)

**Date:** November 25, 2025
**Status:** Ready for Implementation
**Estimated Total Time:** 6-8 hours
**Priority:** HIGH
**Type:** UI/UX Enhancement - Navigation Consolidation

---

## Executive Summary

This plan implements a dual consolidation approach to reduce navigation clutter and improve content organization by adding template tabs to existing pages:

**Phase 1: Sequences Page Enhancement**
- Add "Message Templates" as third tab
- Update dropdown button with message template option
- Estimated Time: 2-3 hours

**Phase 2: Tasks Page Enhancement**
- Add "Task Templates" as second tab
- Update header button with task template option
- Estimated Time: 4-5 hours

**Future Consideration (Phase 3):**
- Optionally add "Message Templates" as third tab to Tasks page
- To be evaluated after Phase 1 & 2 completion

---

## Table of Contents

1. [Goals and Objectives](#goals-and-objectives)
2. [Current State](#current-state)
3. [Target State](#target-state)
4. [Phase 1: Sequences + Message Templates](#phase-1-sequences--message-templates)
5. [Phase 2: Tasks + Task Templates](#phase-2-tasks--task-templates)
6. [Phase 3: Future Consideration](#phase-3-future-consideration)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)
9. [Success Metrics](#success-metrics)

---

## Goals and Objectives

### Primary Goals

1. **Reduce Navigation Clutter:** Remove 2 standalone pages from sidebar (Message Templates, Task Templates)
2. **Improve Discoverability:** Place templates closer to where they're used
3. **Maintain Consistency:** Follow proven Sequences page tab pattern
4. **Zero Functionality Loss:** Preserve all existing features and workflows

### Success Criteria

- ✅ Message Templates accessible from Sequences page
- ✅ Task Templates accessible from Tasks page
- ✅ All existing CRUD operations functional
- ✅ Redirects work for old URLs
- ✅ No regression in existing features
- ✅ Navigation has 2 fewer items

### Non-Goals

- **Not consolidating** all templates into one page (too much scope)
- **Not adding** Message Templates to Tasks page in this plan (future consideration)
- **Not changing** any backend APIs or database schema

---

## Current State

### Navigation Structure

**Current Sidebar (6 items):**
```
Dashboard
Restaurants
Tasks
Task Templates          ← TO BE MOVED
Sequences
Message Templates       ← TO BE MOVED
Extractions
Menus
Social Media
Analytics
History
Settings
```

### Current Routes

```tsx
<Route path="tasks" element={<Tasks />} />
<Route path="task-templates" element={<TaskTemplates />} />
<Route path="sequences" element={<Sequences />} />
<Route path="sequence-templates" element={<Navigate to="/sequences?tab=templates" replace />} />
<Route path="message-templates" element={<MessageTemplates />} />
```

### Existing Pages

| Page | Route | Lines | Tabs | Status |
|------|-------|-------|------|--------|
| Tasks | `/tasks` | 1,403 | None | Single page |
| Task Templates | `/task-templates` | 382 | None | Single page |
| Sequences | `/sequences` | 585 | 2 (Instances, Templates) | Tab-based ✅ |
| Message Templates | `/message-templates` | 365 | None | Single page |

---

## Target State

### Updated Navigation

**Target Sidebar (4 main work items):**
```
Dashboard
Restaurants
Tasks                   ← NOW WITH 2 TABS
Sequences               ← NOW WITH 3 TABS
Extractions
Menus
Social Media
Analytics
History
Settings
```

### Updated Routes

```tsx
<Route path="tasks" element={<Tasks />} />
<Route path="task-templates" element={<Navigate to="/tasks?tab=templates" replace />} />
<Route path="sequences" element={<Sequences />} />
<Route path="sequence-templates" element={<Navigate to="/sequences?tab=templates" replace />} />
<Route path="message-templates" element={<Navigate to="/sequences?tab=message-templates" replace />} />
```

### Target Pages

| Page | Route | Tabs | Tab 1 | Tab 2 | Tab 3 |
|------|-------|------|-------|-------|-------|
| Tasks | `/tasks` | 2 | Tasks | Task Templates | - |
| Sequences | `/sequences` | 3 | Instances | Sequence Templates | Message Templates |

---

## Phase 1: Sequences + Message Templates

**Priority:** 1 (Do First)
**Estimated Time:** 2-3 hours
**Complexity:** LOW
**Risk:** LOW

### Why Phase 1 First?

1. **Lower Risk:** Sequences page already has tabs
2. **Proven Pattern:** Similar to recent Sequence Templates integration
3. **Quick Win:** Builds confidence for Phase 2
4. **Message Templates Context:** Used heavily in sequences (step messages)

### 1.1 Current Sequences Page State

**File:** `/src/pages/Sequences.tsx` (585 lines)

**Existing Tabs:**
- Tab 1: Instances (sequence instances with filters)
- Tab 2: Templates (sequence templates)

**Existing Dropdown Button:**
```tsx
"New Sequence" ▼
├─ Single Restaurant
├─ Multiple Restaurants (Bulk)
└─ New Sequence Template ✅ (just added)
```

**Existing State:**
```tsx
// Templates tab state
const [templateSearchTerm, setTemplateSearchTerm] = useState('');
const [filterActive, setFilterActive] = useState<string>('true');
const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
const [selectedTemplate, setSelectedTemplate] = useState<SequenceTemplate | null>(null);
```

### 1.2 Implementation Steps

#### Step 1.1: Add Message Templates State (15 minutes)

**Location:** Top of Sequences.tsx, after existing state

**Add state variables:**
```tsx
// Message Templates tab state
const [messageTemplateSearchTerm, setMessageTemplateSearchTerm] = useState('');
const [messageTemplateFilterType, setMessageTemplateFilterType] = useState<string>('all');
const [messageTemplateFilterActive, setMessageTemplateFilterActive] = useState<string>('all');
const [createMessageTemplateModalOpen, setCreateMessageTemplateModalOpen] = useState(false);
const [editMessageTemplateModalOpen, setEditMessageTemplateModalOpen] = useState(false);
const [duplicateMessageTemplateModalOpen, setDuplicateMessageTemplateModalOpen] = useState(false);
const [selectedMessageTemplate, setSelectedMessageTemplate] = useState<any | null>(null);
```

**Add data fetching:**
```tsx
// Fetch message templates
const messageTemplateFilters = useMemo(() => ({
  type: messageTemplateFilterType === 'all' ? undefined : messageTemplateFilterType,
  is_active: messageTemplateFilterActive === 'all' ? undefined : messageTemplateFilterActive === 'true',
}), [messageTemplateFilterType, messageTemplateFilterActive]);

const { data: messageTemplatesData, isLoading: messageTemplatesLoading } = useQuery({
  queryKey: ['message-templates', messageTemplateFilters],
  queryFn: async () => {
    const params: any = {};
    if (messageTemplateFilters.type) params.type = messageTemplateFilters.type;
    if (messageTemplateFilters.is_active !== undefined) params.is_active = messageTemplateFilters.is_active;

    const response = await api.get('/message-templates', { params });
    return response.data;
  }
});

const messageTemplates = messageTemplatesData?.templates || [];
```

#### Step 1.2: Add Third Tab (30 minutes)

**Location:** Sequences.tsx TabsList section (currently lines 315-318)

**Update TabsList:**
```tsx
<TabsList size="full">
  <TabsTrigger size="full" variant="blue" value="instances">Instances</TabsTrigger>
  <TabsTrigger size="full" variant="blue" value="templates">Sequence Templates</TabsTrigger>
  <TabsTrigger size="full" variant="blue" value="message-templates">Message Templates</TabsTrigger>
</TabsList>
```

#### Step 1.3: Add Message Templates Tab Content (1 hour)

**Location:** After Templates TabsContent (after line 520)

**Add new TabsContent:**
```tsx
{/* MESSAGE TEMPLATES TAB */}
<TabsContent value="message-templates" className="space-y-6">
  {/* Header with Create Button */}
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm text-muted-foreground">
        Create and manage reusable message templates for tasks and sequences
      </p>
    </div>
    <Button onClick={() => setCreateMessageTemplateModalOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      New Message Template
    </Button>
  </div>

  {/* Filters */}
  <div className="bg-card border rounded-lg p-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Filters</h3>
      </div>
      {(messageTemplateFilterType !== 'all' || messageTemplateFilterActive !== 'all') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMessageTemplateFilterType('all');
            setMessageTemplateFilterActive('all');
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Clear All
        </Button>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Type Filter */}
      <div>
        <label className="text-sm font-medium mb-1 block">Type</label>
        <Select
          value={messageTemplateFilterType}
          onValueChange={setMessageTemplateFilterType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="social_message">Social Message</SelectItem>
            <SelectItem value="text">Text</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Status Filter */}
      <div>
        <label className="text-sm font-medium mb-1 block">Status</label>
        <Select
          value={messageTemplateFilterActive}
          onValueChange={setMessageTemplateFilterActive}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>

  {/* Templates Table */}
  <div className="rounded-lg border bg-card overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Variables</TableHead>
          <TableHead>Usage Count</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messageTemplatesLoading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
            </TableCell>
          </TableRow>
        ) : messageTemplates.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              No message templates found. Create your first template to get started.
            </TableCell>
          </TableRow>
        ) : (
          messageTemplates.map((template: any) => (
            <TableRow key={template.id}>
              <TableCell>
                <div
                  className="font-medium cursor-pointer hover:text-brand-blue"
                  onClick={() => {
                    setSelectedMessageTemplate(template);
                    setEditMessageTemplateModalOpen(true);
                  }}
                >
                  {template.name}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {template.type === 'email' && <Mail className="h-4 w-4" />}
                  {template.type === 'social_message' && <MessageSquare className="h-4 w-4" />}
                  {template.type === 'text' && <MessageSquare className="h-4 w-4" />}
                  <Badge variant="outline" className={cn('capitalize',
                    template.type === 'email' && 'bg-blue-100 text-blue-800 border-blue-200',
                    template.type === 'social_message' && 'bg-purple-100 text-purple-800 border-purple-200',
                    template.type === 'text' && 'bg-green-100 text-green-800 border-green-200'
                  )}>
                    {template.type.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground max-w-xs truncate">
                  {template.description || '-'}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {template.available_variables && template.available_variables.length > 0 ? (
                    template.available_variables.slice(0, 3).map((variable: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {'{' + variable + '}'}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                  {template.available_variables && template.available_variables.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{template.available_variables.length - 3} more
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {template.usage_count || 0}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={template.is_active ? "default" : "secondary"}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedMessageTemplate(template);
                      setEditMessageTemplateModalOpen(true);
                    }}
                    title="Edit template"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedMessageTemplate(template);
                      setDuplicateMessageTemplateModalOpen(true);
                    }}
                    title="Duplicate template"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteMessageTemplate(template.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
</TabsContent>
```

#### Step 1.4: Add Message Template Handlers (20 minutes)

**Location:** After existing handlers in Sequences.tsx

**Add handlers:**
```tsx
// Message Template handlers
const handleDeleteMessageTemplate = async (templateId: string) => {
  if (!confirm('Are you sure you want to delete this message template?')) {
    return;
  }

  try {
    await api.delete(`/message-templates/${templateId}`);
    toast({
      title: "Success",
      description: "Message template deleted successfully"
    });
    // Refetch message templates
    queryClient.invalidateQueries({ queryKey: ['message-templates'] });
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.response?.data?.error || 'Failed to delete template',
      variant: "destructive"
    });
  }
};
```

#### Step 1.5: Add Message Template Modals (15 minutes)

**Location:** After existing modals in Sequences.tsx (after line 583)

**Add modals:**
```tsx
{/* Message Template Modals */}
<CreateMessageTemplateModal
  open={createMessageTemplateModalOpen}
  onClose={() => setCreateMessageTemplateModalOpen(false)}
  onSuccess={() => {
    setCreateMessageTemplateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['message-templates'] });
  }}
/>

{selectedMessageTemplate && (
  <CreateMessageTemplateModal
    open={editMessageTemplateModalOpen}
    templateId={selectedMessageTemplate.id}
    onClose={() => {
      setEditMessageTemplateModalOpen(false);
      setSelectedMessageTemplate(null);
    }}
    onSuccess={() => {
      setEditMessageTemplateModalOpen(false);
      setSelectedMessageTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    }}
  />
)}

{selectedMessageTemplate && (
  <CreateMessageTemplateModal
    open={duplicateMessageTemplateModalOpen}
    duplicateFromId={selectedMessageTemplate.id}
    onClose={() => {
      setDuplicateMessageTemplateModalOpen(false);
      setSelectedMessageTemplate(null);
    }}
    onSuccess={() => {
      setDuplicateMessageTemplateModalOpen(false);
      setSelectedMessageTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    }}
  />
)}
```

#### Step 1.6: Add Required Imports (10 minutes)

**Location:** Top of Sequences.tsx

**Add imports:**
```tsx
import { Mail, MessageSquare, Edit, Copy, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { CreateMessageTemplateModal } from '../components/message-templates/CreateMessageTemplateModal';
import { useToast } from '../hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
```

#### Step 1.7: Update Navigation and Routes (15 minutes)

**File 1: NavigationItems.jsx**

Remove message-templates link:
```jsx
const navigationItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/restaurants', label: 'Restaurants', icon: Store },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/task-templates', label: 'Task Templates', icon: ClipboardList },
  { href: '/sequences', label: 'Sequences', icon: Workflow },
  // REMOVED: { href: '/message-templates', label: 'Message Templates', icon: FileText },
  { href: '/extractions', label: 'Extractions', icon: Download },
  // ... rest
];
```

**File 2: App.tsx**

Add redirect:
```tsx
<Route path="message-templates" element={<Navigate to="/sequences?tab=message-templates" replace />} />
```

### 1.8 Testing Checklist - Phase 1

**Tab Functionality:**
- [ ] Three tabs visible (Instances, Sequence Templates, Message Templates)
- [ ] Can switch between all three tabs
- [ ] URL updates to `?tab=message-templates` when clicking third tab
- [ ] Deep link `/sequences?tab=message-templates` works
- [ ] Browser back/forward navigation works

**Message Templates Tab:**
- [ ] Templates load correctly
- [ ] Type filter works (All, Email, Social Message, Text)
- [ ] Status filter works (All, Active, Inactive)
- [ ] Clear All button appears when filters active
- [ ] Clear All button resets filters
- [ ] Create new template works
- [ ] Edit template works (click name or edit button)
- [ ] Duplicate template works
- [ ] Delete template works with confirmation
- [ ] Table columns display correctly
- [ ] Variables display (first 3 + count)
- [ ] Usage count displays
- [ ] Active/Inactive badge displays

**Existing Functionality (Regression Testing):**
- [ ] Instances tab still works
- [ ] Sequence Templates tab still works
- [ ] New Sequence dropdown works
- [ ] All sequence CRUD operations work
- [ ] Bulk sequence creation works
- [ ] Finish sequence workflows work

**Navigation & Redirects:**
- [ ] Message Templates removed from sidebar
- [ ] `/message-templates` redirects to `/sequences?tab=message-templates`
- [ ] Old bookmarks work

---

## Phase 2: Tasks + Task Templates

**Priority:** 2 (Do Second)
**Estimated Time:** 4-5 hours
**Complexity:** MEDIUM-HIGH
**Risk:** MEDIUM

### Why Phase 2 Second?

1. **More Complex:** Tasks page is larger (1,403 lines) with no existing tabs
2. **Filter Complexity:** Tasks page has 12 different filter types across 2 tiers
3. **Higher Risk:** Adding tabs to non-tab page requires more structural changes
4. **Learn from Phase 1:** Apply lessons learned from message templates integration

### 2.1 Current Tasks Page State

**File:** `/src/pages/Tasks.tsx` (1,403 lines)

**Current Structure:**
- Single page (no tabs)
- Complex two-tier filter system
- Task Filters (collapsible)
- Restaurant Filters (collapsible)
- Table with inline editing
- 4 different modal types

**Current Header Button:**
```tsx
<Button onClick={() => setModals({ ...modals, create: true })}>
  <Plus className="h-4 w-4 mr-2" />
  New Task
</Button>
```

### 2.2 Implementation Steps

#### Step 2.1: Add Tabs Structure (1 hour)

**Location:** Wrap existing content with Tabs component

**Add tab state:**
```tsx
// Tab state (add at top with other state)
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'tasks';

const handleTabChange = (value: string) => {
  setSearchParams({ tab: value });
};
```

**Wrap existing content:**
```tsx
{/* Existing header stays */}
<div className="flex justify-between items-center">
  {/* ... existing header content ... */}
</div>

{/* NEW: Add Tabs wrapper */}
<Tabs value={activeTab} onValueChange={handleTabChange}>
  <TabsList size="full">
    <TabsTrigger size="full" variant="blue" value="tasks">Tasks</TabsTrigger>
    <TabsTrigger size="full" variant="blue" value="templates">Task Templates</TabsTrigger>
  </TabsList>

  {/* TASKS TAB */}
  <TabsContent value="tasks" className="space-y-6">
    {/* Move ALL existing task content here (filters, table, etc.) */}
    {/* Lines 826-1401 move inside this TabsContent */}
  </TabsContent>

  {/* TEMPLATES TAB */}
  <TabsContent value="templates" className="space-y-6">
    {/* Task Templates content will go here */}
  </TabsContent>
</Tabs>
```

#### Step 2.2: Add Task Templates State (20 minutes)

**Location:** Top of Tasks.tsx, after existing state

**Add state variables:**
```tsx
// Task Templates tab state
const [taskTemplateFilterType, setTaskTemplateFilterType] = useState<string>('all');
const [taskTemplateFilterActive, setTaskTemplateFilterActive] = useState<string>('all');
const [taskTemplateModals, setTaskTemplateModals] = useState({
  create: false,
  edit: null as string | null,
  duplicate: null as string | null
});
```

**Add data fetching:**
```tsx
// Fetch task templates
const taskTemplateFilters = useMemo(() => ({
  type: taskTemplateFilterType === 'all' ? undefined : taskTemplateFilterType,
  is_active: taskTemplateFilterActive === 'all' ? undefined : taskTemplateFilterActive === 'true',
}), [taskTemplateFilterType, taskTemplateFilterActive]);

const { data: taskTemplatesData, isLoading: taskTemplatesLoading, refetch: refetchTaskTemplates } = useQuery({
  queryKey: ['task-templates', taskTemplateFilters],
  queryFn: async () => {
    const params: any = {};
    if (taskTemplateFilters.type) params.type = taskTemplateFilters.type;
    if (taskTemplateFilters.is_active !== undefined) params.is_active = taskTemplateFilters.is_active;

    const response = await api.get('/task-templates', { params });
    return response.data;
  }
});

const taskTemplates = taskTemplatesData?.templates || [];
```

#### Step 2.3: Add Task Templates Tab Content (2 hours)

**Location:** Inside second TabsContent

**Add template tab content:**
```tsx
<TabsContent value="templates" className="space-y-6">
  {/* Header with Create Button */}
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm text-muted-foreground">
        Create and manage reusable task templates with default messages and priorities
      </p>
    </div>
    <Button onClick={() => setTaskTemplateModals({ ...taskTemplateModals, create: true })}>
      <Plus className="h-4 w-4 mr-2" />
      New Task Template
    </Button>
  </div>

  {/* Filters */}
  <div className="bg-card border rounded-lg p-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Filters</h3>
      </div>
      {(taskTemplateFilterType !== 'all' || taskTemplateFilterActive !== 'all') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTaskTemplateFilterType('all');
            setTaskTemplateFilterActive('all');
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Clear All
        </Button>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Type Filter */}
      <div>
        <label className="text-sm font-medium mb-1 block">Type</label>
        <Select
          value={taskTemplateFilterType}
          onValueChange={setTaskTemplateFilterType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="internal_activity">Internal Activity</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="social_message">Social Message</SelectItem>
            <SelectItem value="text">Text</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Status Filter */}
      <div>
        <label className="text-sm font-medium mb-1 block">Status</label>
        <Select
          value={taskTemplateFilterActive}
          onValueChange={setTaskTemplateFilterActive}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>

  {/* Templates Table */}
  <div className="rounded-lg border bg-card overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Message Template</TableHead>
          <TableHead>Usage Count</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {taskTemplatesLoading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading templates...</p>
            </TableCell>
          </TableRow>
        ) : taskTemplates.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              No task templates found. Create your first template to get started.
            </TableCell>
          </TableRow>
        ) : (
          taskTemplates.map((template: any) => (
            <TableRow key={template.id}>
              <TableCell>
                <div
                  className="font-medium cursor-pointer hover:text-brand-blue"
                  onClick={() => setTaskTemplateModals({ ...taskTemplateModals, edit: template.id })}
                >
                  {template.name}
                </div>
                {template.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {template.type === 'email' && <Mail className="h-4 w-4" />}
                  {template.type === 'call' && <Phone className="h-4 w-4" />}
                  {template.type === 'social_message' && <MessageSquare className="h-4 w-4" />}
                  {template.type === 'text' && <MessageSquare className="h-4 w-4" />}
                  {template.type === 'internal_activity' && <ClipboardList className="h-4 w-4" />}
                  <Badge variant="outline" className={cn('capitalize',
                    template.type === 'email' && 'bg-blue-100 text-blue-800 border-blue-200',
                    template.type === 'call' && 'bg-green-100 text-green-800 border-green-200',
                    template.type === 'social_message' && 'bg-purple-100 text-purple-800 border-purple-200',
                    template.type === 'text' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    template.type === 'internal_activity' && 'bg-gray-100 text-gray-800 border-gray-200'
                  )}>
                    {template.type.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('capitalize',
                  template.priority === 'low' && 'bg-gray-100 text-gray-800 border-gray-200',
                  template.priority === 'medium' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                  template.priority === 'high' && 'bg-red-100 text-red-800 border-red-200'
                )}>
                  {template.priority}
                </Badge>
              </TableCell>
              <TableCell>
                {template.message_templates ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{template.message_templates.name}</span>
                  </div>
                ) : template.default_message ? (
                  <span className="text-sm text-muted-foreground">Custom message</span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {template.usage_count || 0}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={template.is_active ? "default" : "secondary"}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTaskTemplateModals({ ...taskTemplateModals, edit: template.id })}
                    title="Edit template"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTaskTemplateModals({ ...taskTemplateModals, duplicate: template.id })}
                    title="Duplicate template"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTaskTemplate(template.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
</TabsContent>
```

#### Step 2.4: Add Task Template Handlers (20 minutes)

**Location:** After existing handlers in Tasks.tsx

**Add handlers:**
```tsx
// Task Template handlers
const handleDeleteTaskTemplate = async (templateId: string) => {
  if (!confirm('Are you sure you want to delete this task template?')) {
    return;
  }

  try {
    await api.delete(`/task-templates/${templateId}`);
    toast({
      title: "Success",
      description: "Task template deleted successfully"
    });
    refetchTaskTemplates();
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.response?.data?.error || 'Failed to delete template',
      variant: "destructive"
    });
  }
};
```

#### Step 2.5: Update Header Button (30 minutes)

**Location:** Replace existing "New Task" button

**Replace button with dropdown:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
      <Plus className="h-4 w-4 mr-2" />
      {activeTab === 'tasks' ? 'New Task' : 'New Task Template'}
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setModals({ ...modals, create: true })}>
      <div className="flex flex-col">
        <span className="font-medium">New Task</span>
        <span className="text-xs text-muted-foreground">
          Create a single task
        </span>
      </div>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setTaskTemplateModals({ ...taskTemplateModals, create: true })}>
      <div className="flex flex-col">
        <span className="font-medium">New Task Template</span>
        <span className="text-xs text-muted-foreground">
          Create a reusable task template
        </span>
      </div>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### Step 2.6: Add Task Template Modals (15 minutes)

**Location:** After existing modals in Tasks.tsx (after line 1400)

**Add modals:**
```tsx
{/* Task Template Modals */}
{taskTemplateModals.create && (
  <CreateTaskTemplateModal
    open={taskTemplateModals.create}
    onClose={() => setTaskTemplateModals({ ...taskTemplateModals, create: false })}
    onSuccess={() => {
      setTaskTemplateModals({ ...taskTemplateModals, create: false });
      refetchTaskTemplates();
    }}
  />
)}

{taskTemplateModals.edit && (
  <CreateTaskTemplateModal
    open={!!taskTemplateModals.edit}
    templateId={taskTemplateModals.edit}
    onClose={() => setTaskTemplateModals({ ...taskTemplateModals, edit: null })}
    onSuccess={() => {
      setTaskTemplateModals({ ...taskTemplateModals, edit: null });
      refetchTaskTemplates();
    }}
  />
)}

{taskTemplateModals.duplicate && (
  <CreateTaskTemplateModal
    open={!!taskTemplateModals.duplicate}
    duplicateFromId={taskTemplateModals.duplicate}
    onClose={() => setTaskTemplateModals({ ...taskTemplateModals, duplicate: null })}
    onSuccess={() => {
      setTaskTemplateModals({ ...taskTemplateModals, duplicate: null });
      refetchTaskTemplates();
    }}
  />
)}
```

#### Step 2.7: Add Required Imports (10 minutes)

**Location:** Top of Tasks.tsx

**Add imports:**
```tsx
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { CreateTaskTemplateModal } from '../components/task-templates/CreateTaskTemplateModal';
import { useToast } from '../hooks/use-toast';
import { CheckCircle } from 'lucide-react';
```

#### Step 2.8: Update Navigation and Routes (15 minutes)

**File 1: NavigationItems.jsx**

Remove task-templates link:
```jsx
const navigationItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/restaurants', label: 'Restaurants', icon: Store },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  // REMOVED: { href: '/task-templates', label: 'Task Templates', icon: ClipboardList },
  { href: '/sequences', label: 'Sequences', icon: Workflow },
  { href: '/extractions', label: 'Extractions', icon: Download },
  // ... rest
];
```

**File 2: App.tsx**

Add redirect:
```tsx
<Route path="task-templates" element={<Navigate to="/tasks?tab=templates" replace />} />
```

### 2.9 Testing Checklist - Phase 2

**Tab Functionality:**
- [ ] Two tabs visible (Tasks, Task Templates)
- [ ] Can switch between tabs
- [ ] URL updates to `?tab=templates` when clicking second tab
- [ ] Deep link `/tasks?tab=templates` works
- [ ] Browser back/forward navigation works
- [ ] Default tab is "Tasks"

**Tasks Tab (Regression Testing):**
- [ ] All 12 filters still work
- [ ] Task Filters collapsible section works
- [ ] Restaurant Filters collapsible section works
- [ ] Due date custom range picker works
- [ ] Table sorting works (Due Date, Type, Priority)
- [ ] Inline status editing works
- [ ] Inline priority editing works
- [ ] Inline due date editing works
- [ ] Quick complete dropdown works
- [ ] Complete & Set Follow-up works
- [ ] Complete & Start Sequence works
- [ ] Edit task works
- [ ] Duplicate task works
- [ ] Create task modal works
- [ ] Task detail modal works

**Task Templates Tab:**
- [ ] Templates load correctly
- [ ] Type filter works (All, Internal Activity, Email, Call, Social Message, Text)
- [ ] Status filter works (All, Active, Inactive)
- [ ] Clear All button appears when filters active
- [ ] Clear All button resets filters
- [ ] Create new template works
- [ ] Edit template works (click name or edit button)
- [ ] Duplicate template works
- [ ] Delete template works with confirmation
- [ ] Table columns display correctly
- [ ] Priority badges color-coded correctly
- [ ] Message template relationship displays
- [ ] Usage count displays
- [ ] Active/Inactive badge displays

**Header Dropdown:**
- [ ] Dropdown button shows "New Task" on Tasks tab
- [ ] Dropdown button shows "New Task Template" on Templates tab
- [ ] "New Task" option opens CreateTaskModal
- [ ] "New Task Template" option opens CreateTaskTemplateModal
- [ ] Both modals work correctly

**Navigation & Redirects:**
- [ ] Task Templates removed from sidebar
- [ ] `/task-templates` redirects to `/tasks?tab=templates`
- [ ] Old bookmarks work

---

## Phase 3: Future Consideration

**Status:** DEFERRED
**Evaluation Date:** After Phase 1 & 2 completion

### Proposal: Add Message Templates to Tasks Page

**Would Result In:**
- Tasks page with 3 tabs: Tasks, Task Templates, Message Templates
- Sequences page with 3 tabs: Instances, Sequence Templates, Message Templates
- Message Templates accessible from both pages

**Pros:**
- Task Templates and Message Templates together (tightly coupled)
- Message Templates accessible where tasks are created
- Complete task workflow in one place

**Cons:**
- Message Templates duplicated in navigation (confusing)
- Sequences page already has Message Templates
- Increases Tasks page complexity
- May confuse users about "source of truth"

**Decision Criteria:**

Evaluate after Phase 1 & 2 based on:
1. **User Feedback:** Do users struggle to find Message Templates on Sequences page?
2. **Usage Patterns:** Are Message Templates used more from Tasks or Sequences?
3. **Complexity Impact:** Did Phase 2 make Tasks page too complex?
4. **Team Capacity:** Do we have time for additional refactoring?

**If Proceeding:**
- Follow same pattern as Phase 1
- Add third tab to Tasks page
- Keep on Sequences page (don't remove)
- Add clear indication both places link to same templates

---

## Testing Strategy

### Unit Testing

**Not Required (Manual Testing Only)**
- These are UI changes only
- No business logic changes
- No API changes
- Manual testing sufficient

### Manual Testing

**Phase 1 Testing (2-3 hours + dev time):**
- Test during development (incremental)
- Full regression test at end
- Use checklist from Section 1.8

**Phase 2 Testing (4-5 hours + dev time):**
- Test during development (incremental)
- Full regression test at end
- Extra focus on Tasks page complexity
- Use checklist from Section 2.9

### User Acceptance Testing

**Not Required for Initial Release**
- Internal team testing sufficient
- Monitor usage after release
- Gather feedback for Phase 3 decision

---

## Rollback Plan

### If Issues Found in Phase 1

**Quick Rollback:**
1. Revert Sequences.tsx changes
2. Revert NavigationItems.jsx changes
3. Revert App.tsx redirect
4. Deploy immediately

**Data Impact:** NONE (no backend changes)

### If Issues Found in Phase 2

**Quick Rollback:**
1. Revert Tasks.tsx changes
2. Revert NavigationItems.jsx changes
3. Revert App.tsx redirect
4. Deploy immediately

**Data Impact:** NONE (no backend changes)

### Partial Rollback

**If Phase 1 works but Phase 2 fails:**
- Keep Phase 1 changes
- Rollback Phase 2 only
- Task Templates link stays in sidebar temporarily

---

## Success Metrics

### Quantitative Metrics

**Navigation Efficiency:**
- Sidebar items reduced from 6 to 4 work pages
- 33% reduction in navigation clutter

**Template Discoverability:**
- Measure template usage before/after
- Track time to create templates
- Monitor template searches

**Performance:**
- Page load time (should not increase)
- Tab switch time (< 100ms)
- Filter application time (unchanged)

### Qualitative Metrics

**User Feedback:**
- Survey team after 1 week
- Gather feedback on discoverability
- Identify any confusion points

**Support Tickets:**
- Monitor for navigation confusion
- Track template-related questions
- Identify training needs

### Success Criteria

✅ **Phase 1 Success:**
- Message Templates accessible from Sequences
- No regression in existing features
- Redirect works for old URL
- Positive user feedback

✅ **Phase 2 Success:**
- Task Templates accessible from Tasks
- All task functionality preserved
- Redirect works for old URL
- No performance degradation

---

## Timeline

### Week 1: Phase 1

**Monday-Tuesday:**
- Implement Phase 1 (2-3 hours)
- Test thoroughly
- Deploy to staging

**Wednesday:**
- Internal testing
- Gather feedback
- Fix any issues

**Thursday:**
- Deploy to production
- Monitor usage
- Document learnings

**Friday:**
- Review metrics
- Plan Phase 2 adjustments

### Week 2: Phase 2

**Monday-Wednesday:**
- Implement Phase 2 (4-5 hours)
- Test thoroughly
- Deploy to staging

**Thursday:**
- Internal testing
- Gather feedback
- Fix any issues

**Friday:**
- Deploy to production
- Monitor usage
- Document completion

### Week 3: Phase 3 Evaluation

**Monday-Wednesday:**
- Gather user feedback
- Analyze usage patterns
- Review metrics

**Thursday-Friday:**
- Decide on Phase 3
- Document decision
- Update roadmap

---

## File Changes Summary

### Phase 1 Changes

**Modified Files:**
1. `/src/pages/Sequences.tsx` (~650 lines)
2. `/src/components/navigation/NavigationItems.jsx` (remove 1 line)
3. `/src/App.tsx` (add 1 redirect)

**New Files:** NONE

### Phase 2 Changes

**Modified Files:**
1. `/src/pages/Tasks.tsx` (~1,800 lines estimated)
2. `/src/components/navigation/NavigationItems.jsx` (remove 1 line)
3. `/src/App.tsx` (add 1 redirect)

**New Files:** NONE

### Total Changes

**Modified Files:** 4 unique files
**New Files:** 0
**Deleted Files:** 0 (TaskTemplates.tsx and MessageTemplates.tsx can be deleted after testing)

---

## Dependencies

### Component Dependencies

**Phase 1 Requires:**
- CreateMessageTemplateModal (already exists)
- useToast hook (already exists)
- Table components (already exists)

**Phase 2 Requires:**
- CreateTaskTemplateModal (already exists)
- useToast hook (already exists)
- All existing task components (already exists)

### No External Dependencies

- No new npm packages
- No API changes
- No database migrations
- No backend changes

---

## Risk Assessment

### Phase 1 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| State conflicts between tabs | LOW | MEDIUM | Careful state separation |
| Modal conflicts | LOW | LOW | Unique modal states per tab |
| Performance issues | VERY LOW | LOW | Tabs render only active content |
| User confusion | LOW | MEDIUM | Clear tab labels, redirects |

**Overall Risk: LOW**

### Phase 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Filter state conflicts | MEDIUM | HIGH | Tab-aware filter management |
| Complex code structure | MEDIUM | MEDIUM | Clear code organization |
| Performance with large file | LOW | MEDIUM | Consider component extraction if needed |
| User workflow disruption | MEDIUM | MEDIUM | Preserve all existing functionality |
| Testing complexity | MEDIUM | HIGH | Comprehensive test checklist |

**Overall Risk: MEDIUM**

---

## Appendix A: Code Snippets

### Tab Structure Pattern

```tsx
<Tabs value={activeTab} onValueChange={handleTabChange}>
  <TabsList size="full">
    <TabsTrigger size="full" variant="blue" value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger size="full" variant="blue" value="tab2">Tab 2</TabsTrigger>
  </TabsList>

  <TabsContent value="tab1" className="space-y-6">
    {/* Tab 1 content */}
  </TabsContent>

  <TabsContent value="tab2" className="space-y-6">
    {/* Tab 2 content */}
  </TabsContent>
</Tabs>
```

### Dropdown Button Pattern

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
      <Plus className="h-4 w-4 mr-2" />
      Button Text
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handler}>
      <div className="flex flex-col">
        <span className="font-medium">Option Title</span>
        <span className="text-xs text-muted-foreground">
          Description
        </span>
      </div>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Appendix B: Testing Scripts

### Quick Tab Navigation Test

```
1. Open /sequences
2. Click "Message Templates" tab
3. Verify URL shows ?tab=message-templates
4. Refresh page
5. Verify still on Message Templates tab
6. Click browser back
7. Verify on previous tab
```

### Filter Persistence Test

```
1. Open /tasks
2. Apply filters
3. Switch to Templates tab
4. Switch back to Tasks tab
5. Verify filters still applied
```

---

**End of Implementation Plan**
