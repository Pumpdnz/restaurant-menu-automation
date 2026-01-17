# Investigation: CreateTaskModal Integration for Dashboard

## Component Location
`/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx`

## Props Interface

```typescript
interface CreateTaskModalProps {
  open: boolean;                    // Controls dialog visibility
  onClose: () => void;              // Called when dialog closes
  onSuccess: () => void;            // Called after successful task creation
  restaurantId?: string;            // Optional - pre-select a restaurant
  duplicateFromTaskId?: string;     // Optional - duplicate existing task
  followUpFromTaskId?: string;      // Optional - create follow-up from existing task
}
```

## Required Imports

```typescript
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
```

## Dependencies

### External Hooks (used internally by CreateTaskModal)
- `useToast` from `../hooks/use-toast` - For success/error notifications
- No external context providers required

### Internal Dependencies (handled internally)
- `api` service for API calls (`/tasks`, `/task-templates`, `/message-templates`, `/restaurants/list`)
- UI components from `../components/ui/*` (Dialog, Button, Input, etc.)
- `QualificationForm` for demo_meeting task type
- `VariableSelector` for message template variables
- `DateTimePicker` for due date selection

## Dashboard-Level Usage (No Restaurant Context)

When `restaurantId` is NOT provided:
1. Component automatically fetches all restaurants via `GET /restaurants/list`
2. Shows a Restaurant selector dropdown in the form
3. Restaurant selection is optional - tasks can be created without a restaurant

This behavior is already implemented in the component (lines 68-70, 401-420):
```typescript
useEffect(() => {
  if (open) {
    fetchTaskTemplates();
    fetchMessageTemplates();
    if (!restaurantId) {
      fetchRestaurants();  // Fetches restaurant list for dropdown
    }
    // ...
  }
}, [open, ...]);
```

## Usage Examples from Codebase

### 1. Tasks.tsx - Basic Create Mode (No restaurantId)
```typescript
const [modals, setModals] = useState({
  create: false,
  // ...
});

// Trigger
<Button onClick={() => setModals({ ...modals, create: true })}>
  <Plus className="h-4 w-4 mr-2" />
  New Task
</Button>

// Modal
{modals.create && (
  <CreateTaskModal
    open={modals.create}
    onClose={() => setModals({ ...modals, create: false })}
    onSuccess={fetchTasks}
  />
)}
```

### 2. Restaurants.jsx - With Pre-selected Restaurant
```typescript
const [createTaskFor, setCreateTaskFor] = useState(null);

{createTaskFor && (
  <CreateTaskModal
    open={!!createTaskFor}
    onClose={() => setCreateTaskFor(null)}
    onSuccess={() => {
      setCreateTaskFor(null);
      fetchRestaurants();
    }}
    restaurantId={createTaskFor.id}
  />
)}
```

### 3. Duplicate Mode
```typescript
const [modals, setModals] = useState({ duplicate: null });

{modals.duplicate && (
  <CreateTaskModal
    open={!!modals.duplicate}
    duplicateFromTaskId={modals.duplicate}
    onClose={() => setModals({ ...modals, duplicate: null })}
    onSuccess={fetchTasks}
  />
)}
```

### 4. Follow-up Mode
```typescript
const [followUpTaskId, setFollowUpTaskId] = useState(null);

{followUpTaskId && (
  <CreateTaskModal
    open={!!followUpTaskId}
    followUpFromTaskId={followUpTaskId}
    onClose={() => setFollowUpTaskId(null)}
    onSuccess={fetchRestaurants}
  />
)}
```

## State Management Pattern

For Dashboard integration, use this minimal state pattern:

```typescript
// State
const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);

// Handler functions
const handleOpenCreateTask = () => setCreateTaskModalOpen(true);
const handleCloseCreateTask = () => setCreateTaskModalOpen(false);
const handleTaskCreated = () => {
  setCreateTaskModalOpen(false);
  // Optionally trigger a refresh of tasks data if displayed on dashboard
};
```

## Implementation Steps for Dashboard

### Step 1: Add Import
```typescript
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
```

### Step 2: Add State
```typescript
const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
```

### Step 3: Add Button in Quick Actions Section
```typescript
<button
  onClick={() => setCreateTaskModalOpen(true)}
  className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200"
>
  <ClipboardList className="mr-2 h-4 w-4" />
  New Task
</button>
```

### Step 4: Add Modal at End of Component
```typescript
<CreateTaskModal
  open={createTaskModalOpen}
  onClose={() => setCreateTaskModalOpen(false)}
  onSuccess={() => setCreateTaskModalOpen(false)}
/>
```

## Caveats for Dashboard-Level Usage

1. **No restaurant pre-selection**: The restaurant dropdown will be empty/optional, allowing general tasks not tied to a specific restaurant.

2. **No task refresh needed**: Dashboard currently doesn't display a tasks list, so `onSuccess` only needs to close the modal. If tasks are added to Dashboard later, add refresh logic.

3. **Icon import**: Add `ClipboardList` to the lucide-react imports (or use `Plus` for consistency with other pages).

4. **Toast provider**: Ensure `Toaster` component is in the app layout (already present in existing codebase).

## Form Fields in CreateTaskModal

| Field | Required | Description |
|-------|----------|-------------|
| Task Name | Yes | Free text |
| Description | No | Free text |
| Type | Yes | internal_activity, demo_meeting, email, call, social_message, text |
| Priority | No | low, medium, high (default: medium) |
| Due Date | No | DateTime picker |
| Restaurant | No | Dropdown (fetched if not pre-selected) |
| Task Template | No | Pre-fills name, description, type, priority |
| Message Template | No | For email/text/social_message types |
| Subject Line | No | For email type only |
| Message | No | For communication types |
| Qualification Data | No | For demo_meeting type only |

## API Endpoints Used by CreateTaskModal

- `GET /task-templates` - Fetch available task templates
- `GET /message-templates?is_active=true` - Fetch message templates
- `GET /restaurants/list` - Fetch restaurants (when no restaurantId prop)
- `GET /tasks/:id` - Fetch task for duplication/follow-up
- `POST /tasks` - Create the task
