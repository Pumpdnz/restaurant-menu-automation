# Investigation: Display Completed At Date for Completed Tasks

## Overview

This investigation examines how to modify the UI to display the `completed_at` timestamp for completed tasks instead of showing "Done" or the `due_date`. This affects multiple pages and components across the application.

## Current Behavior

### Problem Summary

| Location | Current Behavior | Desired Behavior |
|----------|-----------------|------------------|
| Tasks.tsx | Shows due date picker for all tasks | Show completed_at date for completed tasks |
| RestaurantTasksList.tsx | Shows due date picker for all tasks | Show completed_at date for completed tasks |
| SequenceTaskList.tsx | Shows "Done" for completed tasks | Show completed_at date |
| SequenceDetailModal.tsx | Shows "Done" for completed tasks | Show completed_at date |
| Sequences.tsx (via SequenceProgressCard) | Uses SequenceTaskList | Inherits fix from SequenceTaskList |
| RestaurantDetail.jsx Tasks tab | Uses RestaurantTasksList | Inherits fix from RestaurantTasksList |
| RestaurantDetail.jsx Sequences tab | Uses SequenceProgressCard | Inherits fix from SequenceTaskList |

---

## Current Implementation Details

### 1. Tasks.tsx - Main Tasks Page

**File**: `src/pages/Tasks.tsx`
**Lines**: 795-809

```tsx
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
```

**Issue**: Always shows DateTimePicker regardless of task status. For completed tasks, this shows the due_date which is misleading.

**Usage** (line 1360):
```tsx
<TableCell>
  {getDueDateInput(task.due_date, task.id, task.status)}
</TableCell>
```

---

### 2. RestaurantTasksList.tsx

**File**: `src/components/tasks/RestaurantTasksList.tsx`
**Lines**: 383-398

```tsx
const getDueDateInput = (dueDate: string | null, taskId: string, taskStatus: string) => {
  const isOverdue =
    dueDate &&
    new Date(dueDate) < new Date() &&
    taskStatus !== 'completed' &&
    taskStatus !== 'cancelled';

  return (
    <DateTimePicker
      value={dueDate ? new Date(dueDate) : null}
      onChange={(date) => handleUpdateDueDate(taskId, date ? date.toISOString() : null)}
      placeholder="Set due date"
      className={cn('h-8 text-xs', isOverdue && 'text-red-600')}
    />
  );
};
```

**Issue**: Same as Tasks.tsx - always shows DateTimePicker regardless of status.

**Usage** (line 544):
```tsx
<TableCell>{getDueDateInput(task.due_date, task.id, task.status)}</TableCell>
```

---

### 3. SequenceTaskList.tsx

**File**: `src/components/sequences/SequenceTaskList.tsx`
**Lines**: 332-379

```tsx
const getDueDateOrDelayInput = (task: Task) => {
  if (task.status === 'completed') {
    return <span className="text-xs text-green-600">Done</span>;
  }

  // Pending tasks show delay from template (read-only)
  if (task.status === 'pending') {
    // ... shows delay info ...
  }

  // Active and other tasks show due date picker
  // ...
};
```

**Issue**: Line 334 returns "Done" text instead of the actual completed_at timestamp.

**Usage** (line 437):
```tsx
<TableCell>{getDueDateOrDelayInput(task)}</TableCell>
```

**Task Interface** (lines 37-66): Already includes `completed_at`:
```tsx
interface Task {
  id: string;
  // ...
  completed_at: string | null;
  // ...
}
```

---

### 4. SequenceDetailModal.tsx

**File**: `src/components/sequences/SequenceDetailModal.tsx`
**Lines**: 132-149

```tsx
const formatDueDate = (dueDate: string | null, status: string) => {
  if (status === 'completed') return 'Done';
  if (!dueDate) return 'Not set';

  const due = new Date(dueDate);
  const now = new Date();
  // ... calculates relative date display ...
};
```

**Issue**: Line 133 returns "Done" instead of the completed_at timestamp.

**Usage**: Used to display task due dates in the modal's task list.

---

## Data Availability

### Task Data Structure

All components have access to `completed_at` through the task object:

```tsx
interface Task {
  id: string;
  name: string;
  status: string;           // 'pending' | 'active' | 'completed' | 'cancelled'
  due_date: string | null;
  completed_at: string | null;  // Available but not displayed
  // ...
}
```

### API Response

The `/tasks` API already returns `completed_at` in the response:

```json
{
  "id": "...",
  "status": "completed",
  "due_date": "2025-11-25T10:00:00Z",
  "completed_at": "2025-11-25T09:45:00Z"
}
```

---

## Proposed Solution

### Design Decision: What to Display

For completed tasks, display:
- **Primary**: The `completed_at` date/time
- **Format**: Human-readable date (e.g., "Nov 25, 2025 9:45 AM")
- **Style**: Green text to indicate completion
- **Read-only**: No date picker (task is already complete)

### Implementation Approach

#### Pattern 1: Conditional Display (Tasks.tsx, RestaurantTasksList.tsx)

```tsx
const getDueDateInput = (
  dueDate: string | null,
  taskId: string,
  taskStatus: string,
  completedAt: string | null  // Add this parameter
) => {
  // Show completed date for completed tasks
  if (taskStatus === 'completed' && completedAt) {
    return (
      <div className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {new Date(completedAt).toLocaleDateString('en-NZ', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    );
  }

  // Show cancelled indicator
  if (taskStatus === 'cancelled') {
    return <span className="text-xs text-gray-500">Cancelled</span>;
  }

  // Original due date picker for active/pending tasks
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
```

#### Pattern 2: Sequence Task List (SequenceTaskList.tsx)

```tsx
const getDueDateOrDelayInput = (task: Task) => {
  // Show completed date for completed tasks
  if (task.status === 'completed') {
    return (
      <div className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {task.completed_at
          ? new Date(task.completed_at).toLocaleDateString('en-NZ', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Completed'
        }
      </div>
    );
  }

  // ... rest of function unchanged ...
};
```

#### Pattern 3: Sequence Detail Modal (SequenceDetailModal.tsx)

```tsx
const formatDueDate = (
  dueDate: string | null,
  status: string,
  completedAt: string | null  // Add this parameter
) => {
  if (status === 'completed') {
    return completedAt
      ? new Date(completedAt).toLocaleDateString('en-NZ', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Completed';
  }

  if (!dueDate) return 'Not set';

  // ... rest of function unchanged ...
};
```

---

## Files to Modify

| File | Location | Change Required |
|------|----------|-----------------|
| `src/pages/Tasks.tsx` | Line 795-809, Line 1360 | Update `getDueDateInput` function signature and add completed_at display logic; Update call site to pass `completed_at` |
| `src/components/tasks/RestaurantTasksList.tsx` | Line 383-398, Line 544 | Update `getDueDateInput` function and call site |
| `src/components/sequences/SequenceTaskList.tsx` | Line 332-335 | Replace "Done" text with formatted `completed_at` date |
| `src/components/sequences/SequenceDetailModal.tsx` | Line 132-133 | Replace "Done" text with formatted `completed_at` date |

---

## Date Formatting Considerations

### Recommended Format

Use NZ locale for consistency:

```tsx
new Date(completedAt).toLocaleDateString('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',      // Optional: include for older dates
  hour: '2-digit',
  minute: '2-digit'
})
// Output: "25 Nov 2025, 09:45"
```

### Alternative: Relative Time

For recent completions, could use relative time:

```tsx
import { formatDistanceToNow } from 'date-fns';

// "2 hours ago" for recent, full date for older
const formatCompletedDate = (completedAt: string) => {
  const date = new Date(completedAt);
  const hoursDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60);

  if (hoursDiff < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};
```

### Recommendation

Use absolute date format for consistency. Relative time ("2 hours ago") can be confusing when reviewing historical data.

---

## Column Header Consideration

### Current Header

All locations currently use "Due Date" as the column header.

### Options

1. **Keep "Due Date"** - Simpler, but semantically incorrect for completed tasks
2. **Change to "Date"** - Generic, works for both due and completed dates
3. **Conditional Header** - Complex, not recommended for tables

### Recommendation

Change column header from "Due Date" to "Due / Completed" or simply "Date" to accurately reflect the dual purpose.

---

## Testing Checklist

After implementation, verify:

- [ ] Tasks.tsx: Completed tasks show completed_at date
- [ ] Tasks.tsx: Active tasks still show editable due date picker
- [ ] Tasks.tsx: Pending tasks show due date picker
- [ ] Tasks.tsx: Cancelled tasks show appropriate indicator
- [ ] RestaurantTasksList.tsx: Same behavior as Tasks.tsx
- [ ] SequenceTaskList.tsx: Completed tasks show completed_at instead of "Done"
- [ ] SequenceTaskList.tsx: Pending tasks still show delay info
- [ ] SequenceTaskList.tsx: Active tasks still show due date picker
- [ ] SequenceDetailModal.tsx: Completed tasks show completed_at date
- [ ] RestaurantDetail Tasks tab: Inherits correct behavior
- [ ] RestaurantDetail Sequences tab: Inherits correct behavior
- [ ] Sequences page: Inherits correct behavior via SequenceProgressCard

---

## Summary

### Changes Required

1. **4 files** need modification
2. **No API changes** - `completed_at` already available
3. **No database changes** - data already exists

### Implementation Priority

| Priority | Component | Reason |
|----------|-----------|--------|
| 1 | SequenceTaskList.tsx | Used by Sequences page AND RestaurantDetail sequences tab |
| 2 | Tasks.tsx | Main tasks management page |
| 3 | RestaurantTasksList.tsx | RestaurantDetail tasks tab |
| 4 | SequenceDetailModal.tsx | Detail view for sequences |

### Estimated Effort

- **Small** - Straightforward conditional rendering changes
- No architectural changes required
- No API modifications needed
- All data already available in frontend
