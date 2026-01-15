# Investigation: Task Dialog and Navigation

## Overview
Dashboard needs a "New Task" quick action that opens the existing task creation dialog, plus updated navigation targets.

## New Task Dialog Component

**Component Name:** `CreateTaskModal`
**Location:** `src/components/tasks/CreateTaskModal.tsx`

### Props Interface
```typescript
interface CreateTaskModalProps {
  open: boolean;              // Controls visibility
  onClose: () => void;        // Callback to close modal
  onSuccess: () => void;      // Callback after successful creation
  restaurantId?: string;      // Optional pre-selected restaurant
  duplicateFromTaskId?: string; // For duplication mode
  followUpFromTaskId?: string; // For follow-up mode
}
```

## Current Implementation in Tasks.tsx

### State Management (lines 128-135)
```jsx
const [modals, setModals] = useState({
  create: false,      // Controls CreateTaskModal visibility
  edit: null,         // For editing existing tasks
  detail: null,       // For viewing task details
  duplicate: null,    // For duplicating tasks
  followUp: null,     // For creating follow-up tasks
  startSequence: false // For starting sequences
});
```

### Trigger Button (lines 912-918)
```jsx
<Button
  onClick={() => setModals({ ...modals, create: true })}
  className="bg-gradient-to-r from-brand-blue to-brand-green"
>
  <Plus className="h-4 w-4 mr-2" />
  New Task
</Button>
```

### Modal Rendering (lines 1658-1664)
```jsx
{modals.create && (
  <CreateTaskModal
    open={modals.create}
    onClose={() => setModals({ ...modals, create: false })}
    onSuccess={fetchTasks}
  />
)}
```

## Dialog Technical Details
- Uses Radix UI Dialog primitive (`@radix-ui/react-dialog`)
- Component: `DialogPrimitive.Root`
- Managed via state in parent component
- Supports scrollable content
- Built-in close button (X) in top-right corner

## Alternative Dialog Usage

Same `CreateTaskModal` used in:
- `Sequences.tsx` - with `createTaskModalOpen` state
- `RegistrationBatchDetail.tsx` - for creating tasks related to batches

## Dashboard Integration Steps

### 1. Import Required Components
```tsx
import { useState } from 'react';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
```

### 2. Add State
```tsx
const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
```

### 3. Add Quick Action Button
```tsx
<Button
  onClick={() => setCreateTaskModalOpen(true)}
  className="bg-gradient-to-r from-brand-blue to-brand-green"
>
  <Plus className="h-4 w-4 mr-2" />
  New Task
</Button>
```

### 4. Render Modal
```tsx
{createTaskModalOpen && (
  <CreateTaskModal
    open={createTaskModalOpen}
    onClose={() => setCreateTaskModalOpen(false)}
    onSuccess={() => {
      setCreateTaskModalOpen(false);
      // Optionally refresh dashboard data
    }}
  />
)}
```

## Routing Status

### Current Routes (from App.tsx)
- `/tasks` - Tasks page (feature protected under `tasksAndSequences`)
- `/restaurants/:id` - Restaurant detail/edit page
- **NO** `/restaurants/new` route exists

### Route Recommendations
For "Add Restaurant" quick action, options:
1. Navigate to `/restaurants` with create modal auto-opened (query param)
2. Create inline modal similar to CreateTaskModal
3. Add new route `/restaurants/new` if full-page form needed

## Standard Modal Pattern

The modal follows this pattern used throughout the app:
1. State tracks modal visibility
2. Button/trigger sets state to true
3. Modal renders conditionally
4. onClose callback sets state to false
5. onSuccess triggers data refresh and closes modal

## Feature Flag Considerations

For Dashboard quick actions:
```tsx
const { isFeatureEnabled } = useAuth();

// Only show "New Task" if tasks feature enabled
{isFeatureEnabled('tasksAndSequences') && (
  <Button onClick={() => setCreateTaskModalOpen(true)}>
    New Task
  </Button>
)}
```
