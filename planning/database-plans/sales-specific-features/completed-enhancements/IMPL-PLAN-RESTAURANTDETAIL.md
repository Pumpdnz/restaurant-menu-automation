# Implementation Plan: RestaurantDetail Enhancements

**Feature:** Feature 2 - RestaurantDetail Page Enhancements
**Priority:** P1 (High)
**Estimated Time:** 8-10 hours
**Dependencies:** QualificationForm component (already exists)

---

## Overview

This plan implements two major enhancements to the RestaurantDetail page:
1. **Qualification Data Display** in Sales Info tab (18 fields)
2. **Tasks and Sequences Tab** with task list integration

---

## Table of Contents

1. [Phase 1: Qualification Data Display (3 hours)](#phase-1-qualification-data-display)
2. [Phase 2: Tab Reordering (30 minutes)](#phase-2-tab-reordering)
3. [Phase 3: RestaurantTasksList Component (3-4 hours)](#phase-3-restauranttaskslist-component)
4. [Phase 4: Integration and Testing (1-2 hours)](#phase-4-integration-and-testing)
5. [Testing Scenarios](#testing-scenarios)
6. [Rollback Plan](#rollback-plan)

---

## Phase 1: Qualification Data Display

**Time:** 3 hours
**Files Modified:**
- `/src/components/demo-meeting/QualificationDataDisplay.tsx` (NEW)
- `/src/pages/RestaurantDetail.jsx` (MODIFY)

### Step 1.1: Create QualificationDataDisplay Component (1.5 hours)

**File:** `/src/components/demo-meeting/QualificationDataDisplay.tsx`

```tsx
import React from 'react';
import { InfoField } from './InfoField';
import { BooleanField } from './BooleanField';
import { TagList } from './TagList';

interface QualificationDataDisplayProps {
  data: any; // Restaurant object with qualification fields
}

export function QualificationDataDisplay({ data }: QualificationDataDisplayProps) {
  // Check if there's any qualification data
  const hasQualificationData =
    data.contact_role ||
    data.number_of_venues ||
    data.point_of_sale ||
    data.online_ordering_platform ||
    data.online_ordering_handles_delivery !== null ||
    data.self_delivery !== null ||
    data.weekly_uber_sales_volume !== null ||
    data.uber_aov !== null ||
    data.uber_markup !== null ||
    data.uber_profitability !== null ||
    data.uber_profitability_description ||
    data.current_marketing_description ||
    (data.painpoints && data.painpoints.length > 0) ||
    (data.core_selling_points && data.core_selling_points.length > 0) ||
    (data.features_to_highlight && data.features_to_highlight.length > 0) ||
    (data.possible_objections && data.possible_objections.length > 0) ||
    data.meeting_link ||
    data.qualification_details;

  if (!hasQualificationData) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No qualification data recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Contact & Business Context */}
      <div>
        <h4 className="font-medium mb-3">Contact & Business Context</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField label="Contact Role" value={data.contact_role} />
          <InfoField label="Number of Venues" value={data.number_of_venues} />
          <InfoField label="Point of Sale System" value={data.point_of_sale} />
          <InfoField label="Online Ordering Platform" value={data.online_ordering_platform} />
        </div>
      </div>

      {/* Section 2: Delivery & Platform */}
      <div>
        <h4 className="font-medium mb-3">Delivery & Platform</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BooleanField
            label="Online Ordering Handles Delivery"
            value={data.online_ordering_handles_delivery}
          />
          <BooleanField
            label="Self Delivery"
            value={data.self_delivery}
          />
        </div>
      </div>

      {/* Section 3: UberEats Metrics */}
      <div>
        <h4 className="font-medium mb-3">UberEats Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField
            label="Weekly Sales Volume"
            value={data.weekly_uber_sales_volume ? `${data.weekly_uber_sales_volume} orders` : null}
          />
          <InfoField
            label="Average Order Value"
            value={data.uber_aov ? `$${data.uber_aov.toFixed(2)}` : null}
          />
          <InfoField
            label="Markup %"
            value={data.uber_markup ? `${data.uber_markup}%` : null}
          />
          <InfoField
            label="Profitability %"
            value={data.uber_profitability ? `${data.uber_profitability}%` : null}
          />
        </div>
        {data.uber_profitability_description && (
          <div className="mt-3">
            <InfoField
              label="Profitability Notes"
              value={data.uber_profitability_description}
            />
          </div>
        )}
      </div>

      {/* Section 4: Marketing & Website */}
      <div>
        <h4 className="font-medium mb-3">Marketing & Website</h4>
        <InfoField
          label="Current Marketing Activities"
          value={data.current_marketing_description}
        />
      </div>

      {/* Section 5: Sales Context */}
      <div>
        <h4 className="font-medium mb-3">Sales Context</h4>
        <div className="space-y-3">
          {data.painpoints && data.painpoints.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Pain Points</div>
              <TagList tags={data.painpoints} />
            </div>
          )}
          {data.core_selling_points && data.core_selling_points.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Core Selling Points</div>
              <TagList tags={data.core_selling_points} />
            </div>
          )}
          {data.features_to_highlight && data.features_to_highlight.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Features to Highlight</div>
              <TagList tags={data.features_to_highlight} />
            </div>
          )}
          {data.possible_objections && data.possible_objections.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Possible Objections</div>
              <TagList tags={data.possible_objections} />
            </div>
          )}
        </div>
      </div>

      {/* Section 6: Meeting Details */}
      <div>
        <h4 className="font-medium mb-3">Meeting Details</h4>
        <div className="space-y-3">
          <InfoField label="Meeting Link" value={data.meeting_link} isUrl />
          <InfoField label="Additional Notes" value={data.qualification_details} />
        </div>
      </div>
    </div>
  );
}
```

**Helper Components Used:**
- `InfoField` - Already exists in `/src/components/demo-meeting/InfoField.tsx`
- `BooleanField` - Already exists in `/src/components/demo-meeting/BooleanField.tsx`
- `TagList` - Already exists in `/src/components/demo-meeting/TagList.tsx`

**Verify these exist:**
```bash
ls /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/components/demo-meeting/
```

If any are missing, create them based on the QualificationForm component patterns.

### Step 1.2: Update Sales Info Tab (1 hour)

**File:** `/src/pages/RestaurantDetail.jsx`

**Location:** Lines 2796-2900+ (Sales Info TabsContent)

**Changes:**

1. **Import QualificationForm and QualificationDataDisplay** (add to top of file):
```jsx
import { QualificationForm } from '../components/demo-meeting/QualificationForm';
import { QualificationDataDisplay } from '../components/demo-meeting/QualificationDataDisplay';
```

2. **Add Qualification Section to Sales Info Tab** (after line ~2895, before closing Card):

```jsx
{/* Existing Sales Info fields... */}

{/* NEW: Qualification Data Section */}
<div className="col-span-2 border-t pt-6 mt-6">
  <h3 className="text-lg font-semibold mb-4">Demo Qualification Data</h3>

  {isEditing ? (
    <QualificationForm
      data={editedData}
      onChange={handleFieldChange}
    />
  ) : (
    <QualificationDataDisplay data={restaurant} />
  )}
</div>
```

**Exact insertion point:**
- Find the closing `</CardContent>` tag of Sales Info tab
- Insert BEFORE that closing tag
- After the "Notes" textarea field

**Verify QualificationForm accepts onChange:**
Check `/src/components/demo-meeting/QualificationForm.tsx` - if it uses internal state, may need to modify to accept onChange prop.

### Step 1.3: Update handleFieldChange (if needed) (30 minutes)

**File:** `/src/pages/RestaurantDetail.jsx`
**Location:** Line 1264-1269

**Current implementation:**
```javascript
const handleFieldChange = (field, value) => {
  setEditedData(prev => ({
    ...prev,
    [field]: value
  }));
};
```

**This should work as-is** if QualificationForm calls `onChange(field, value)` for each field.

**Verify QualificationForm signature:**
If QualificationForm expects `onChange(qualificationData)` (whole object), update:

```javascript
const handleQualificationChange = (field, value) => {
  setEditedData(prev => ({
    ...prev,
    [field]: value
  }));
};
```

And pass it to QualificationForm:
```jsx
<QualificationForm
  data={editedData}
  onChange={handleQualificationChange}
/>
```

---

## Phase 2: Tab Reordering

**Time:** 30 minutes
**Files Modified:**
- `/src/pages/RestaurantDetail.jsx` (MODIFY)

### Step 2.1: Reorder TabsList (15 minutes)

**File:** `/src/pages/RestaurantDetail.jsx`
**Location:** Lines 2539-2549

**Current order:**
```jsx
<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="contact">Contact & Lead</TabsTrigger>
  <TabsTrigger value="sales">Sales Info</TabsTrigger>
  <TabsTrigger value="branding">Branding</TabsTrigger>
  <TabsTrigger value="configuration">Configuration</TabsTrigger>
  <TabsTrigger value="platforms">Platforms & Social</TabsTrigger>
  <TabsTrigger value="workflow">Workflow</TabsTrigger>
  <TabsTrigger value="sequences">Sequences</TabsTrigger>
  <TabsTrigger value="registration">Pumpd Registration</TabsTrigger>
</TabsList>
```

**New order:**
```jsx
<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="contact">Contact & Lead</TabsTrigger>
  <TabsTrigger value="sales">Sales Info</TabsTrigger>
  <TabsTrigger value="tasks-sequences">Tasks and Sequences</TabsTrigger>
  <TabsTrigger value="branding">Branding</TabsTrigger>
  <TabsTrigger value="configuration">Configuration</TabsTrigger>
  <TabsTrigger value="platforms">Platforms & Social</TabsTrigger>
  <TabsTrigger value="workflow">Workflow</TabsTrigger>
  <TabsTrigger value="registration">Pumpd Registration</TabsTrigger>
</TabsList>
```

**Changes:**
1. Rename `value="sequences"` → `value="tasks-sequences"`
2. Rename label `"Sequences"` → `"Tasks and Sequences"`
3. Move from position 8 → position 4

### Step 2.2: Update TabsContent Value (5 minutes)

**File:** `/src/pages/RestaurantDetail.jsx`
**Location:** Line 3795

**Change:**
```jsx
// OLD
<TabsContent value="sequences" className="space-y-4">

// NEW
<TabsContent value="tasks-sequences" className="space-y-6">
```

**Note:** Changed spacing from `space-y-4` to `space-y-6` for better separation between tasks and sequences sections.

### Step 2.3: Verify No Routing Dependencies (10 minutes)

**Check for:**
1. Any URL hash routing (e.g., `#sequences`)
2. Any navigate calls with tab value
3. Any defaultActiveTab logic

**Search for:**
```bash
grep -r "sequences" /path/to/RestaurantDetail.jsx
grep -r "activeTab" /path/to/RestaurantDetail.jsx
```

**Update if found** - replace `"sequences"` with `"tasks-sequences"`

---

## Phase 3: RestaurantTasksList Component

**Time:** 3-4 hours
**Files Modified:**
- `/src/components/tasks/RestaurantTasksList.tsx` (NEW)
- `/src/pages/RestaurantDetail.jsx` (MODIFY)

### Step 3.1: Create RestaurantTasksList Component (2 hours)

**File:** `/src/components/tasks/RestaurantTasksList.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MultiSelect } from '../ui/multi-select';
import { DateTimePicker } from '../ui/date-time-picker';
import { cn } from '../../lib/utils';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Mail,
  Phone,
  MessageSquare,
  ClipboardList,
  Edit,
  Copy,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { TaskTypeQuickView } from './TaskTypeQuickView';

interface RestaurantTasksListProps {
  restaurantId: string;
  onCreateTask?: () => void;
}

export function RestaurantTasksList({ restaurantId, onCreateTask }: RestaurantTasksListProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: ['active'] as string[],
    type: [] as string[],
    priority: [] as string[]
  });

  useEffect(() => {
    fetchTasks();
  }, [restaurantId]);

  useEffect(() => {
    applyFilters();
  }, [tasks, filters]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tasks?restaurant_id=${restaurantId}`);
      setTasks(response.data.tasks || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(t => filters.status.includes(t.status));
    }

    if (filters.type && filters.type.length > 0) {
      filtered = filtered.filter(t => filters.type.includes(t.type));
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(t => filters.priority.includes(t.priority));
    }

    setFilteredTasks(filtered);
  };

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      if (newStatus === 'completed') {
        await api.patch(`/tasks/${taskId}/complete`);
      } else if (newStatus === 'cancelled') {
        await api.patch(`/tasks/${taskId}/cancel`);
      } else {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      }
      await fetchTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleUpdateDueDate = async (taskId: string, dueDate: string | null) => {
    try {
      await api.patch(`/tasks/${taskId}`, { due_date: dueDate });
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, due_date: dueDate } : t
      ));
    } catch (error) {
      console.error('Failed to update due date:', error);
      fetchTasks();
    }
  };

  const getStatusIcon = (task: any) => {
    const statusOptions = [
      { value: 'pending', label: 'Pending', icon: <Circle className="h-4 w-4 stroke-gray-700"/> },
      { value: 'active', label: 'Active', icon: <Circle className="h-4 w-4 stroke-brand-blue"/> },
      { value: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4 stroke-brand-green"/> },
      { value: 'cancelled', label: 'Cancelled', icon: <XCircle className="h-4 w-4 stroke-brand-red"/> }
    ];

    const currentStatus = statusOptions.find(s => s.value === task.status);

    return (
      <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v)}>
        <SelectTrigger className="h-8 w-8 border-0 bg-transparent p-0 hover:bg-muted/50 rounded-full">
          {currentStatus?.icon || <Circle className="h-5 w-5 text-gray-400" />}
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              <div className="flex items-center gap-2">
                {status.icon}
                <span>{status.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'social_message':
      case 'text': return <MessageSquare className="h-4 w-4" />;
      default: return <ClipboardList className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800 border-gray-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[priority as keyof typeof colors])}>
        {priority}
      </Badge>
    );
  };

  const getDueDateInput = (dueDate: string | null, taskId: string, taskStatus: string) => {
    const isOverdue = dueDate &&
      new Date(dueDate) < new Date() &&
      taskStatus !== 'completed' &&
      taskStatus !== 'cancelled';

    return (
      <DateTimePicker
        value={dueDate ? new Date(dueDate) : null}
        onChange={(date) => handleUpdateDueDate(taskId, date ? date.toISOString() : null)}
        placeholder="Set due date"
        className={cn("h-8 text-xs", isOverdue && "text-red-600")}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <MultiSelect
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Active', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' }
            ]}
            selected={filters.status}
            onChange={(v) => updateFilter('status', v)}
            placeholder="Filter by status"
          />
        </div>
        <div className="flex-1">
          <MultiSelect
            options={[
              { label: 'Internal Activity', value: 'internal_activity' },
              { label: 'Email', value: 'email' },
              { label: 'Call', value: 'call' },
              { label: 'Social Message', value: 'social_message' },
              { label: 'Text', value: 'text' }
            ]}
            selected={filters.type}
            onChange={(v) => updateFilter('type', v)}
            placeholder="Filter by type"
          />
        </div>
        <div className="flex-1">
          <MultiSelect
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' }
            ]}
            selected={filters.priority}
            onChange={(v) => updateFilter('priority', v)}
            placeholder="Filter by priority"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No tasks found for this restaurant
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>{getStatusIcon(task)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{task.name}</div>
                    {task.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <TaskTypeQuickView task={task}>
                      <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                        {getTypeIcon(task.type)}
                        <span className="text-sm capitalize">
                          {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </TaskTypeQuickView>
                  </TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell>{getDueDateInput(task.due_date, task.id, task.status)}</TableCell>
                  <TableCell>
                    {task.assigned_to ? (
                      <div className="text-sm">{task.assigned_to.full_name || task.assigned_to.email}</div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### Step 3.2: Integrate Tasks into TabsContent (1 hour)

**File:** `/src/pages/RestaurantDetail.jsx`
**Location:** Line 3795+ (tasks-sequences TabsContent)

**Import RestaurantTasksList:**
```jsx
import { RestaurantTasksList } from '../components/tasks/RestaurantTasksList';
```

**Add state for task modals:**
```jsx
// Add near other modal states (around line 112-118)
const [taskModalOpen, setTaskModalOpen] = useState(false);
const [editTaskId, setEditTaskId] = useState(null);
```

**Replace existing Sequences TabsContent:**
```jsx
<TabsContent value="tasks-sequences" className="space-y-6">
  {/* Tasks Section - NEW */}
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold">Tasks</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Task management for this restaurant
        </p>
      </div>
      <Button onClick={() => setTaskModalOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Task
      </Button>
    </div>

    <RestaurantTasksList
      restaurantId={id}
      onCreateTask={() => setTaskModalOpen(true)}
    />
  </div>

  {/* Divider */}
  <div className="border-t" />

  {/* Sequences Section - EXISTING */}
  <div className="space-y-4">
    <div className="flex items-center justify-between">
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
      !sequencesLoading && (
        <p className="text-muted-foreground text-center py-8">
          No active sequences
        </p>
      )
    )}
  </div>
</TabsContent>
```

### Step 3.3: Add Task Modal Integration (1 hour)

**Import task modals:**
```jsx
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { EditTaskModal } from '../components/tasks/EditTaskModal';
```

**Add modal components at end of component:**
```jsx
{/* Task Modals */}
{taskModalOpen && (
  <CreateTaskModal
    open={taskModalOpen}
    onClose={() => setTaskModalOpen(false)}
    onSuccess={() => {
      setTaskModalOpen(false);
      // Trigger refresh in RestaurantTasksList
    }}
    prefilledRestaurantId={id}
  />
)}

{editTaskId && (
  <EditTaskModal
    open={!!editTaskId}
    taskId={editTaskId}
    onClose={() => setEditTaskId(null)}
    onSuccess={() => {
      setEditTaskId(null);
      // Trigger refresh
    }}
  />
)}
```

**Note:** Need to pass refresh callback to RestaurantTasksList or use React Query for auto-refresh.

---

## Phase 4: Integration and Testing

**Time:** 1-2 hours

### Step 4.1: Verify QualificationForm Integration (30 minutes)

**Test:**
1. Navigate to Sales Info tab
2. Click Edit
3. Modify a qualification field
4. Click Save
5. Verify only changed fields sent to backend
6. Refresh page, verify data persists

**Check:**
- QualificationForm accepts onChange prop
- handleFieldChange works with qualification fields
- Save handler includes qualification fields
- Backend accepts qualification fields

### Step 4.2: Verify Tab Ordering (15 minutes)

**Test:**
1. Navigate through all tabs in order
2. Verify "Tasks and Sequences" is at position 4
3. Verify other tabs shifted correctly
4. Check no broken content or layout issues

### Step 4.3: Verify Tasks Integration (45 minutes)

**Test:**
1. Navigate to Tasks and Sequences tab
2. Verify tasks load for current restaurant only
3. Test filters (status, type, priority)
4. Create new task (should pre-fill restaurant)
5. Edit existing task
6. Change task status
7. Update due date
8. Verify sequences section still works

### Step 4.4: End-to-End Test (30 minutes)

**Scenario: Complete Qualification Workflow**
1. Create new restaurant
2. Navigate to Sales Info tab
3. Click Edit
4. Fill in qualification data (all 18 fields)
5. Save
6. Navigate to Tasks and Sequences tab
7. Create demo_meeting task
8. Verify qualification data visible in task
9. Complete task
10. Verify data synced

---

## Testing Scenarios

### Test 1: Qualification Display - Empty State
- **Setup:** Restaurant with no qualification data
- **Steps:**
  1. Navigate to Sales Info tab
  2. Verify message "No qualification data recorded yet"
- **Expected:** Empty state displays, no errors

### Test 2: Qualification Display - Populated Data
- **Setup:** Restaurant with full qualification data
- **Steps:**
  1. Navigate to Sales Info tab
  2. Verify all 6 sections display
  3. Check field formatting (numbers, booleans, arrays)
- **Expected:** All data displays correctly

### Test 3: Qualification Edit
- **Setup:** Restaurant with partial qualification data
- **Steps:**
  1. Click Edit
  2. Add/modify qualification fields
  3. Click Save
  4. Check network request (only changed fields sent)
- **Expected:** Only modified fields in request body

### Test 4: Tab Reordering
- **Steps:**
  1. Load restaurant detail page
  2. Check tab order
  3. Click through each tab
- **Expected:** Tasks and Sequences at position 4, no content errors

### Test 5: Tasks List - Empty
- **Setup:** Restaurant with no tasks
- **Steps:**
  1. Navigate to Tasks and Sequences tab
  2. Verify empty state message
- **Expected:** "No tasks found for this restaurant"

### Test 6: Tasks List - Filtering
- **Setup:** Restaurant with 10 tasks (various types/statuses)
- **Steps:**
  1. Filter by status: Active
  2. Verify only active tasks shown
  3. Filter by type: Email
  4. Verify only email tasks shown
  5. Clear filters
- **Expected:** Filters work correctly, counts update

### Test 7: Task Creation from Restaurant Detail
- **Steps:**
  1. Click "New Task" in Tasks section
  2. Verify restaurant pre-selected
  3. Fill in task details
  4. Save
  5. Verify task appears in list
- **Expected:** Task created with correct restaurant_id

### Test 8: Sequences Still Work
- **Steps:**
  1. Navigate to Tasks and Sequences tab
  2. Scroll to Sequences section
  3. Verify sequence cards display
  4. Click "Start Sequence"
- **Expected:** Sequences section unchanged, functional

---

## Rollback Plan

### If Phase 1 Fails (Qualification Display)
**Rollback:**
1. Remove import of QualificationForm/QualificationDataDisplay
2. Remove qualification section from Sales Info tab
3. Restore original Sales Info tab content

**No database changes** - safe to rollback

### If Phase 2 Fails (Tab Reordering)
**Rollback:**
1. Restore original tab order
2. Change `tasks-sequences` back to `sequences`
3. Restore original TabsContent value

**No data loss** - UI only

### If Phase 3 Fails (Tasks Integration)
**Rollback:**
1. Remove RestaurantTasksList import
2. Remove tasks section from TabsContent
3. Keep sequences-only content
4. Remove task modal states/components

**No database changes** - safe to rollback

---

## Performance Considerations

### Qualification Data Loading
- Qualification fields already part of restaurant object
- No additional API calls needed
- **Impact:** Minimal

### Tasks List Loading
- New API call: `GET /tasks?restaurant_id={id}`
- Client-side filtering (like Tasks page)
- **Impact:** ~100-500ms for 10-50 tasks
- **Optimization:** Consider pagination if >100 tasks per restaurant

### Tab Switching
- No data reloading on tab switch
- Pure UI state change
- **Impact:** <10ms

---

## Dependencies Check

**Before starting, verify:**
- [ ] QualificationForm component exists and works
- [ ] InfoField, BooleanField, TagList components exist
- [ ] TaskTypeQuickView component exists
- [ ] CreateTaskModal, EditTaskModal exist and work
- [ ] Backend `/tasks?restaurant_id=X` endpoint works
- [ ] Backend accepts qualification fields in PATCH `/restaurants/:id`

---

## Success Criteria

✅ Qualification data displays in Sales Info tab (read mode)
✅ Qualification data editable in edit mode
✅ Only changed fields sent to backend
✅ Tab "Tasks and Sequences" at position 4
✅ Tasks load and filter correctly
✅ Task creation pre-fills restaurant
✅ Sequences section still functional
✅ No performance degradation
✅ No console errors
✅ All tests pass

---

**Estimated Total Time:** 8-10 hours
**Complexity:** Medium
**Risk Level:** Low (mostly UI changes, no migrations)
**Parallel Development:** Can implement while Feature 1 is in progress
