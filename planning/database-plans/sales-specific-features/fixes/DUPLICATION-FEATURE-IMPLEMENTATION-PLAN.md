# Duplication Feature Implementation Plan

## Overview
Add duplication functionality to Tasks, Task Templates, and Message Templates. When duplicating, the create/edit modal opens with prefilled data from the original item, allowing users to modify before saving as a new item.

## Architecture Analysis

### Current Modal Patterns

**Task Templates & Message Templates:**
- Use single modal for both create and edit
- Edit mode detected via `templateId` prop
- Fetches data when `templateId` is provided

**Tasks:**
- Separate `CreateTaskModal` and `EditTaskModal` components
- EditTaskModal handles updates
- CreateTaskModal handles new items

## Implementation Strategy

### 1. Task Templates

#### Files to Modify
- `/UberEats-Image-Extractor/src/pages/TaskTemplates.tsx`
- `/UberEats-Image-Extractor/src/components/task-templates/CreateTaskTemplateModal.tsx`

#### TaskTemplates.tsx Changes

**Add Import:**
```tsx
import { Copy } from 'lucide-react';
```

**Update Modal State:**
```tsx
const [modals, setModals] = useState({
  create: false,
  edit: null,
  duplicate: null  // Add this
});
```

**Add Duplicate Button (in table actions, line ~319):**
```tsx
<Button
  size="sm"
  variant="ghost"
  onClick={() => setModals({ ...modals, duplicate: template.id })}
  title="Duplicate template"
>
  <Copy className="h-4 w-4" />
</Button>
```

**Add Duplicate Modal Handler (after edit modal, line ~353):**
```tsx
{modals.duplicate && (
  <CreateTaskTemplateModal
    open={!!modals.duplicate}
    duplicateFromId={modals.duplicate}
    onClose={() => setModals({ ...modals, duplicate: null })}
    onSuccess={fetchTemplates}
  />
)}
```

#### CreateTaskTemplateModal.tsx Changes

**Update Interface:**
```tsx
interface CreateTaskTemplateModalProps {
  open: boolean;
  templateId?: string | null;
  duplicateFromId?: string | null;  // Add this
  onClose: () => void;
  onSuccess: () => void;
}
```

**Update Props Destructuring:**
```tsx
export function CreateTaskTemplateModal({
  open,
  templateId,
  duplicateFromId,  // Add this
  onClose,
  onSuccess
}: CreateTaskTemplateModalProps) {
```

**Update Edit Mode Detection:**
```tsx
const isEditMode = !!templateId;
const isDuplicateMode = !!duplicateFromId;
```

**Update useEffect (line ~57):**
```tsx
useEffect(() => {
  if (open) {
    fetchMessageTemplates();
    if (isEditMode && templateId) {
      fetchTemplate();
    } else if (isDuplicateMode && duplicateFromId) {
      fetchTemplate(duplicateFromId, true);  // Pass isDuplicate flag
    }
  }
}, [open, templateId, duplicateFromId]);
```

**Update fetchTemplate Function:**
```tsx
const fetchTemplate = async (id?: string, isDuplicate = false) => {
  const fetchId = id || templateId;
  if (!fetchId) return;

  setFetching(true);
  try {
    const response = await api.get(`/task-templates/${fetchId}`);
    const template = response.data.template;

    setFormData({
      name: template.name || '',
      description: template.description || '',
      type: template.type || 'internal_activity',
      priority: template.priority || 'medium',
      message_template_id: template.message_template_id || '',
      default_message: template.default_message || '',
      is_active: template.is_active !== undefined ? template.is_active : true
    });
  } catch (err: any) {
    console.error('Failed to fetch template:', err);
    setError('Failed to load template details');
  } finally {
    setFetching(false);
  }
};
```

**Update Dialog Title (line ~207):**
```tsx
<DialogTitle>
  {isEditMode ? 'Edit' : isDuplicateMode ? 'Duplicate' : 'Create'} Task Template
</DialogTitle>
<DialogDescription>
  {isEditMode ? 'Update' : isDuplicateMode ? 'Duplicate' : 'Create a'} reusable task template for your sales workflow
</DialogDescription>
```

**Update Save Button Text (line ~391):**
```tsx
<Button onClick={handleSave} disabled={loading}>
  {loading
    ? (isEditMode ? 'Updating...' : 'Creating...')
    : (isEditMode ? 'Update Template' : isDuplicateMode ? 'Create Duplicate' : 'Create Template')}
</Button>
```

---

### 2. Message Templates

#### Files to Modify
- `/UberEats-Image-Extractor/src/pages/MessageTemplates.tsx`
- `/UberEats-Image-Extractor/src/components/message-templates/CreateMessageTemplateModal.tsx`

#### MessageTemplates.tsx Changes

**Add Import:**
```tsx
import { Copy } from 'lucide-react';
```

**Update Modal State:**
```tsx
const [modals, setModals] = useState({
  create: false,
  edit: null,
  duplicate: null  // Add this
});
```

**Add Duplicate Button (in table actions, line ~301):**
```tsx
<Button
  size="sm"
  variant="ghost"
  onClick={() => setModals({ ...modals, duplicate: template.id })}
  title="Duplicate template"
>
  <Copy className="h-4 w-4" />
</Button>
```

**Add Duplicate Modal Handler (after edit modal, line ~336):**
```tsx
{modals.duplicate && (
  <CreateMessageTemplateModal
    open={!!modals.duplicate}
    duplicateFromId={modals.duplicate}
    onClose={() => setModals({ ...modals, duplicate: null })}
    onSuccess={fetchTemplates}
  />
)}
```

#### CreateMessageTemplateModal.tsx Changes

**Update Interface:**
```tsx
interface CreateMessageTemplateModalProps {
  open: boolean;
  templateId?: string | null;
  duplicateFromId?: string | null;  // Add this
  onClose: () => void;
  onSuccess: () => void;
}
```

**Update Props Destructuring:**
```tsx
export function CreateMessageTemplateModal({
  open,
  templateId,
  duplicateFromId,  // Add this
  onClose,
  onSuccess
}: CreateMessageTemplateModalProps) {
```

**Update Edit Mode Detection:**
```tsx
const isEditMode = !!templateId;
const isDuplicateMode = !!duplicateFromId;
```

**Update useEffect (line ~60):**
```tsx
useEffect(() => {
  if (open) {
    if (isEditMode && templateId) {
      fetchTemplate();
    } else if (isDuplicateMode && duplicateFromId) {
      fetchTemplate(duplicateFromId);
    }
    fetchRestaurants();
  }
}, [open, templateId, duplicateFromId]);
```

**Update fetchTemplate Function:**
```tsx
const fetchTemplate = async (id?: string) => {
  const fetchId = id || templateId;
  if (!fetchId) return;

  setFetching(true);
  try {
    const response = await api.get(`/message-templates/${fetchId}`);
    const template = response.data.template;

    setFormData({
      name: template.name || '',
      description: template.description || '',
      type: template.type || 'social_message',
      message_content: template.message_content || '',
      is_active: template.is_active !== undefined ? template.is_active : true
    });
  } catch (err: any) {
    console.error('Failed to fetch template:', err);
    setError('Failed to load template details');
  } finally {
    setFetching(false);
  }
};
```

**Update Dialog Title (line ~261):**
```tsx
<DialogTitle>
  {isEditMode ? 'Edit' : isDuplicateMode ? 'Duplicate' : 'Create'} Message Template
</DialogTitle>
<DialogDescription>
  {isEditMode ? 'Update' : isDuplicateMode ? 'Duplicate' : 'Create a'} reusable message template with variable support
</DialogDescription>
```

**Update Save Button Text (line ~417):**
```tsx
<Button onClick={handleSave} disabled={loading}>
  {loading
    ? (isEditMode ? 'Updating...' : 'Creating...')
    : (isEditMode ? 'Update Template' : isDuplicateMode ? 'Create Duplicate' : 'Create Template')}
</Button>
```

---

### 3. Tasks

#### Files to Modify
- `/UberEats-Image-Extractor/src/pages/Tasks.tsx`
- `/UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx`

#### Tasks.tsx Changes

**Add Import:**
```tsx
import { Copy } from 'lucide-react';
```

**Update Modal State:**
```tsx
const [modals, setModals] = useState({
  create: false,
  edit: null,
  detail: null,
  duplicate: null  // Add this
});
```

**Add Duplicate Button (in table actions, line ~515):**
```tsx
<Button
  size="sm"
  variant="ghost"
  onClick={() => setModals({ ...modals, duplicate: task.id })}
  title="Duplicate task"
>
  <Copy className="h-4 w-4" />
</Button>
```

**Add Duplicate Modal Handler (after detail modal, line ~553):**
```tsx
{modals.duplicate && (
  <CreateTaskModal
    open={!!modals.duplicate}
    duplicateFromTaskId={modals.duplicate}
    onClose={() => setModals({ ...modals, duplicate: null })}
    onSuccess={fetchTasks}
  />
)}
```

#### CreateTaskModal.tsx Changes

**Update Interface:**
```tsx
interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId?: string;
  duplicateFromTaskId?: string;  // Add this
}
```

**Update Props Destructuring:**
```tsx
export function CreateTaskModal({
  open,
  onClose,
  onSuccess,
  restaurantId,
  duplicateFromTaskId  // Add this
}: CreateTaskModalProps) {
```

**Add Duplicate Mode Detection:**
```tsx
const isDuplicateMode = !!duplicateFromTaskId;
```

**Update useEffect (line ~53):**
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
    }
  }
}, [open, duplicateFromTaskId]);
```

**Add fetchTaskForDuplication Function:**
```tsx
const fetchTaskForDuplication = async () => {
  if (!duplicateFromTaskId) return;

  try {
    const response = await api.get(`/tasks/${duplicateFromTaskId}`);
    const task = response.data.task;

    // Convert UTC date from server to local datetime-local format if exists
    let dueDateLocal = '';
    if (task.due_date) {
      const utcDate = new Date(task.due_date);
      const year = utcDate.getFullYear();
      const month = String(utcDate.getMonth() + 1).padStart(2, '0');
      const day = String(utcDate.getDate()).padStart(2, '0');
      const hours = String(utcDate.getHours()).padStart(2, '0');
      const minutes = String(utcDate.getMinutes()).padStart(2, '0');
      dueDateLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    setFormData({
      name: task.name || '',
      description: task.description || '',
      type: task.type || 'internal_activity',
      priority: task.priority || 'medium',
      restaurant_id: task.restaurant_id || restaurantId || '',
      task_template_id: task.task_template_id || '',
      message_template_id: task.message_template_id || '',
      message: task.message || '',
      due_date: dueDateLocal  // Populate with converted date
    });

    // Set selected message template if present
    if (task.message_template_id) {
      setSelectedMessageTemplate(task.message_template_id);
    }
  } catch (error) {
    console.error('Failed to fetch task for duplication:', error);
  }
};
```

**Update Dialog Title (line ~211):**
```tsx
<DialogTitle>{isDuplicateMode ? 'Duplicate Task' : 'Create New Task'}</DialogTitle>
<DialogDescription>
  {isDuplicateMode ? 'Duplicate task' : 'Create a task'} for sales activities and follow-ups
</DialogDescription>
```

**Update Create Button Text (line ~398):**
```tsx
<Button onClick={handleCreate} disabled={loading}>
  {loading ? 'Creating...' : isDuplicateMode ? 'Create Duplicate' : 'Create Task'}
</Button>
```

---

## Implementation Order

1. **Message Templates** (Simplest - single modal, no date handling)
2. **Task Templates** (Moderate - single modal, message template relationship)
3. **Tasks** (Most complex - separate modals, date conversion, multiple relationships)

## Testing Checklist

### For Each Feature:
- [ ] Duplicate button appears in table
- [ ] Clicking duplicate opens modal with prefilled data
- [ ] All fields are correctly populated
- [ ] User can edit fields before saving
- [ ] Save creates NEW item (not update existing)
- [ ] New item appears in list after save
- [ ] Toast notification shows success
- [ ] Modal closes after successful save

### Task-Specific:
- [ ] Due date timezone conversion works correctly
- [ ] Restaurant relationship is maintained
- [ ] Task template relationship is maintained
- [ ] Message template relationship is maintained
- [ ] Message content is copied

### Template-Specific:
- [ ] Active status is maintained
- [ ] Relationships (message templates) are maintained
- [ ] Usage count is NOT copied (starts at 0 for new template)

## Technical Notes

### Date Handling (Tasks Only)
When duplicating tasks with due_date:
1. Fetch from API (UTC ISO string)
2. Convert to local datetime-local format for input
3. User can modify
4. On save, convert back to UTC ISO string

### Field Reset Strategy
**Do NOT reset:**
- name
- description
- type
- priority
- relationships (restaurant, templates)
- message content
- is_active status

**Optional reset for tasks:**
- due_date (keep as-is, user can modify)
- status (always created as 'active')

### Icon Usage
- Use `Copy` icon from lucide-react
- Consistent sizing: `h-4 w-4`
- Placed between Edit and Delete buttons

## API Endpoints Used

All features use existing endpoints:
- **GET** `/tasks/{id}` - Fetch task for duplication
- **GET** `/task-templates/{id}` - Fetch task template for duplication
- **GET** `/message-templates/{id}` - Fetch message template for duplication
- **POST** `/tasks` - Create duplicated task
- **POST** `/task-templates` - Create duplicated template
- **POST** `/message-templates` - Create duplicated template

No new API endpoints required.

## User Experience Flow

1. User views list (Tasks, Task Templates, or Message Templates)
2. User clicks Copy icon on desired item
3. Modal opens with title "Duplicate [Type]"
4. All form fields are prefilled with original data
5. User modifies any fields as needed
6. User clicks "Create Duplicate" button
7. New item is created
8. Success toast appears
9. Modal closes
10. List refreshes showing new item

## Benefits

- **Fast workflow**: Copy existing items and make small modifications
- **Consistency**: Reuse proven configurations
- **Flexibility**: Full edit capabilities before saving
- **Safety**: Creates new item, doesn't modify original
- **Clarity**: Clear UI indicators (icon, button text, modal title)
