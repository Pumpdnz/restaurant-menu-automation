# Complete with Follow-up Task Implementation Plan

## Overview
Add functionality to mark a task as complete and immediately create a follow-up task with prefilled data from the completed task.

## User Experience Flow

1. User hovers/clicks on the "Mark as Complete" button for an Active task
2. A dropdown menu appears with two options:
   - **Mark as Complete** (existing behavior)
   - **Complete & Set Follow-up** (new behavior)
3. If user selects "Complete & Set Follow-up":
   - Current task is marked as completed
   - CreateTaskModal opens with prefilled data from the completed task
   - User can modify the follow-up task before creating it
   - Due date is cleared (user can set a new one)

## Implementation Details

### 1. Tasks.tsx Changes

#### Import DropdownMenu Components
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
```

#### Update Modal State
```tsx
const [modals, setModals] = useState({
  create: false,
  edit: null,
  detail: null,
  duplicate: null,
  followUp: null  // Add this
});
```

#### Replace Complete Button with Dropdown
Replace the single complete button with a button group/dropdown:

```tsx
{task.status === 'active' && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        size="sm"
        variant="ghost"
        className="text-green-600 hover:text-green-700 flex items-center gap-1"
      >
        <CheckCircle2 className="h-4 w-4" />
        <ChevronDown className="h-3 w-3" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Mark as Complete
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleCompleteWithFollowUp(task.id)}>
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Complete & Set Follow-up
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

#### Add Handler for Complete with Follow-up
```tsx
const handleCompleteWithFollowUp = async (taskId: string) => {
  try {
    // First, complete the current task
    await api.patch(`/tasks/${taskId}/complete`);

    // Then open the follow-up task modal
    setModals({ ...modals, followUp: taskId });
  } catch (error) {
    console.error('Failed to complete task:', error);
  }
};
```

#### Add Follow-up Modal Handler
```tsx
{modals.followUp && (
  <CreateTaskModal
    open={!!modals.followUp}
    followUpFromTaskId={modals.followUp}
    onClose={() => {
      setModals({ ...modals, followUp: null });
      fetchTasks(); // Refresh to show the completed task
    }}
    onSuccess={fetchTasks}
  />
)}
```

### 2. CreateTaskModal.tsx Changes

#### Update Interface
```tsx
interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId?: string;
  duplicateFromTaskId?: string;
  followUpFromTaskId?: string;  // Add this
}
```

#### Update Props Destructuring
```tsx
export function CreateTaskModal({
  open,
  onClose,
  onSuccess,
  restaurantId,
  duplicateFromTaskId,
  followUpFromTaskId  // Add this
}: CreateTaskModalProps) {
```

#### Add Follow-up Mode Detection
```tsx
const isDuplicateMode = !!duplicateFromTaskId;
const isFollowUpMode = !!followUpFromTaskId;
```

#### Update useEffect
```tsx
useEffect(() => {
  if (open) {
    fetchTaskTemplates();
    fetchMessageTemplates();
    if (!restaurantId) {
      fetchRestaurants();
    }
    if (isDuplicateMode && duplicateFromTaskId) {
      fetchTaskForDuplication();
    } else if (isFollowUpMode && followUpFromTaskId) {
      fetchTaskForFollowUp();
    }
  }
}, [open, duplicateFromTaskId, followUpFromTaskId]);
```

#### Add Fetch Task for Follow-up Function
```tsx
const fetchTaskForFollowUp = async () => {
  if (!followUpFromTaskId) return;

  try {
    const response = await api.get(`/tasks/${followUpFromTaskId}`);
    const task = response.data.task;

    // Similar to duplicate, but clear the due_date for follow-up
    setFormData({
      name: task.name || '',
      description: task.description || '',
      type: task.type || 'internal_activity',
      priority: task.priority || 'medium',
      restaurant_id: task.restaurant_id || restaurantId || '',
      task_template_id: task.task_template_id || '',
      message_template_id: task.message_template_id || '',
      message: task.message || '',
      due_date: ''  // Clear due date for follow-up task
    });

    // Set selected message template if present
    if (task.message_template_id) {
      setSelectedMessageTemplate(task.message_template_id);
    }
  } catch (error) {
    console.error('Failed to fetch task for follow-up:', error);
  }
};
```

#### Update Dialog Title and Description
```tsx
<DialogHeader>
  <DialogTitle>
    {isDuplicateMode
      ? 'Duplicate Task'
      : isFollowUpMode
      ? 'Create Follow-up Task'
      : 'Create New Task'}
  </DialogTitle>
  <DialogDescription>
    {isDuplicateMode
      ? 'Duplicate task'
      : isFollowUpMode
      ? 'Create a follow-up task'
      : 'Create a task'}{' '}
    for sales activities and follow-ups
  </DialogDescription>
</DialogHeader>
```

#### Update Button Text
```tsx
<Button onClick={handleCreate} disabled={loading}>
  {loading
    ? 'Creating...'
    : isDuplicateMode
    ? 'Create Duplicate'
    : isFollowUpMode
    ? 'Create Follow-up'
    : 'Create Task'}
</Button>
```

## Key Design Decisions

1. **Dropdown Menu vs Button Group**: Use DropdownMenu for cleaner UI and better mobile experience
2. **Complete First, Then Create**: Mark the original task as complete before opening the follow-up dialog
3. **Clear Due Date**: Follow-up tasks should have an empty due date by default (user sets new one)
4. **Preserve Context**: Keep all other task details (name, description, type, priority, restaurant, templates, message)
5. **Visual Indicator**: ChevronDown icon shows there are multiple options
6. **Only for Active Tasks**: Feature only available for tasks with 'active' status

## Benefits

- **Improved Workflow**: Seamless transition from completing to creating follow-up
- **Context Preservation**: All relevant information carries over to follow-up task
- **Flexibility**: User can modify follow-up details before creating
- **Clear Intent**: Separate option makes it clear this creates a new task
- **Consistent UX**: Follows same pattern as duplicate feature

## Files to Modify

1. `/UberEats-Image-Extractor/src/pages/Tasks.tsx`
   - Import DropdownMenu components
   - Replace complete button with dropdown
   - Add followUp modal state
   - Add handleCompleteWithFollowUp function
   - Add followUp modal handler

2. `/UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx`
   - Add followUpFromTaskId prop
   - Add isFollowUpMode detection
   - Add fetchTaskForFollowUp function
   - Update title/description/button text

## Testing Checklist

- [ ] Dropdown appears when clicking complete button for active tasks
- [ ] "Mark as Complete" option works as before
- [ ] "Complete & Set Follow-up" marks task as complete
- [ ] Follow-up modal opens with prefilled data
- [ ] Due date is cleared in follow-up task
- [ ] All other fields are populated correctly
- [ ] User can modify follow-up task before creating
- [ ] Creating follow-up refreshes task list
- [ ] Both completed task and new follow-up appear in list
- [ ] Feature only appears for active tasks
