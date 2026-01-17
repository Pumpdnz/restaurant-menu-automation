# Implementation: Display Completed At Date for Completed Tasks

**Status: IMPLEMENTED** (2025-12-01)

## Objective

Show the `completed_at` timestamp for completed tasks instead of "Done" text or due date picker across all task displays.

---

## Files to Modify

| Priority | File | Function | Change |
|----------|------|----------|--------|
| 1 | `src/components/sequences/SequenceTaskList.tsx` | `getDueDateOrDelayInput` (line 332-335) | Replace "Done" with formatted date |
| 2 | `src/pages/Tasks.tsx` | `getDueDateInput` (line 795-809) | Add completed task handling |
| 3 | `src/components/tasks/RestaurantTasksList.tsx` | `getDueDateInput` (line 383-398) | Add completed task handling |
| 4 | `src/components/sequences/SequenceDetailModal.tsx` | `formatDueDate` (line 132-133) | Replace "Done" with formatted date |

---

## Implementation

### Step 1: SequenceTaskList.tsx

**Location**: Line 332-335

**Before**:
```tsx
if (task.status === 'completed') {
  return <span className="text-xs text-green-600">Done</span>;
}
```

**After**:
```tsx
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
        : 'Completed'}
    </div>
  );
}
```

**Import needed**: `CheckCircle2` from lucide-react (already imported)

---

### Step 2: Tasks.tsx

**Location**: Line 795-809

**Before**:
```tsx
const getDueDateInput = (dueDate: string | null, taskId: string, taskStatus: string) => {
  const isOverdue = dueDate &&
    new Date(dueDate) < new Date() &&
    taskStatus !== 'completed' &&
    taskStatus !== 'cancelled';

  return (
    <DateTimePicker ... />
  );
};
```

**After**:
```tsx
const getDueDateInput = (task: any) => {
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
          : 'Completed'}
      </div>
    );
  }

  // Show cancelled indicator
  if (task.status === 'cancelled') {
    return <span className="text-xs text-gray-500">Cancelled</span>;
  }

  // Original due date picker for active/pending tasks
  const isOverdue = task.due_date &&
    new Date(task.due_date) < new Date();

  return (
    <DateTimePicker
      value={task.due_date ? new Date(task.due_date) : null}
      onChange={(date) => handleUpdateDueDate(task.id, date ? date.toISOString() : null)}
      placeholder="Set due date"
      className={cn("h-8 text-xs", isOverdue && "text-red-600")}
    />
  );
};
```

**Update call site** (line ~1360):
```tsx
// Before
{getDueDateInput(task.due_date, task.id, task.status)}

// After
{getDueDateInput(task)}
```

---

### Step 3: RestaurantTasksList.tsx

**Location**: Line 383-398

Same pattern as Tasks.tsx - update function signature to accept full task object.

---

### Step 4: SequenceDetailModal.tsx

**Location**: Line 132-133

**Before**:
```tsx
const formatDueDate = (dueDate: string | null, status: string) => {
  if (status === 'completed') return 'Done';
  // ...
};
```

**After**:
```tsx
const formatDueDate = (dueDate: string | null, status: string, completedAt: string | null) => {
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
  // ...
};
```

**Update call sites** to pass `task.completed_at` as third argument.

---

## Date Format

Using NZ locale for consistency:
```
25 Nov, 09:45
```

---

## Testing Checklist

- [x] SequenceTaskList: Completed tasks show date instead of "Done"
- [x] Tasks page: Completed tasks show date, active show picker
- [x] RestaurantTasksList: Same behavior as Tasks page
- [x] SequenceDetailModal: Completed tasks show date
- [x] Sequences page: Inherits from SequenceTaskList
- [x] RestaurantDetail Tasks tab: Inherits from RestaurantTasksList
- [x] RestaurantDetail Sequences tab: Inherits from SequenceTaskList

---

## Notes

- No API changes needed - `completed_at` already returned
- No database changes needed
- All 4 changes are independent and can be done in any order
- Priority 1 (SequenceTaskList) has highest impact as it's used in multiple places
