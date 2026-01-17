# Task Modal Consolidation Investigation

## Overview

This document details the investigation into consolidating `EditTaskModal.tsx` and `TaskDetailModal.tsx` into a single unified modal component with enhanced functionality.

**Goal**: Create a unified `TaskDetailModal` that displays task details by default but can switch to edit mode, with delete, cancel, and edit buttons.

---

## Current State Analysis

### 1. EditTaskModal.tsx (395 lines)

**Location**: `UberEats-Image-Extractor/src/components/tasks/EditTaskModal.tsx`

**Props Interface**:
```typescript
interface EditTaskModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Features**:
- Fetches task data via `api.get(`/tasks/${taskId}`)`
- Full form-based editing of all task fields
- Delete functionality with confirmation dialog
- Update functionality
- QualificationForm integration for `demo_meeting` type tasks
- Tracks qualification data changes for partial updates

**Form Fields**:
| Field | Component | Always Shown |
|-------|-----------|--------------|
| name | Input | Yes |
| description | Textarea | Yes |
| status | Select (pending/active/completed/cancelled) | Yes |
| type | Select | Yes |
| priority | Select | Yes |
| due_date | DateTimePicker | Yes |
| subject_line | Input | Only for email type |
| message | Textarea | Only for email/social_message/text |
| QualificationForm | Complex form | Only for demo_meeting |

**Buttons**:
- Delete Task (destructive, left side)
- Cancel (outline)
- Update Task (primary)

---

### 2. TaskDetailModal.tsx (617 lines)

**Location**: `UberEats-Image-Extractor/src/components/tasks/TaskDetailModal.tsx`

**Props Interface**:
```typescript
interface TaskDetailModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
}
```

**Features**:
- Read-only display of task details
- Rich display with icons, badges, and formatting
- Copy-to-clipboard for messages and subject lines
- Navigation to restaurant detail page
- Comprehensive contact information display
- Demo meeting qualification data display (when type is `demo_meeting`)
- Timestamps display (created_at, completed_at, cancelled_at)

**Display Sections**:
1. **Header**: Status icon + Task name
2. **Status & Metadata Grid**: Status, Type, Priority, Due Date
3. **Description**: Conditional display
4. **Restaurant Info**: Link to restaurant, city
5. **Contact Information Card**: Contact name, phones, emails, social links
6. **Demo Meeting Qualification** (for demo_meeting type):
   - Meeting Link (prominent)
   - Contact & Business Context
   - Delivery Setup
   - UberEats Metrics
   - Marketing & Website
   - Sales Context (TagLists)
   - Additional Details
7. **Task Template**: If created from template
8. **Email Subject**: With copy button (for email type)
9. **Message Preview**: With copy button (rendered message)
10. **Message Template**: If from template
11. **Message Template Raw**: Shows template with variables
12. **Assigned To**: User info
13. **Created By**: User info
14. **Timestamps**: Created, Completed, Cancelled

**Buttons**:
- Close (single button)

---

## Usage Analysis

### Files Using EditTaskModal

| Location | State Variable | Trigger |
|----------|---------------|---------|
| `pages/Tasks.tsx:65` | `modals.edit` | Edit button in table row |
| `pages/RestaurantDetail.jsx:87` | `editTaskId` | Edit button in RestaurantTasksList callback |
| `components/sequences/SequenceProgressCard.tsx:27` | `editTaskId` | Task edit action in sequence |

### Files Using TaskDetailModal

| Location | State Variable | Trigger |
|----------|---------------|---------|
| `pages/Tasks.tsx:66` | `modals.detail` | Clicking task name |
| `components/tasks/RestaurantTasksList.tsx:36` | `detailModalOpen` + `selectedTaskId` | Clicking task name |
| `components/sequences/SequenceProgressCard.tsx:25` | `selectedTaskId` | Task click in sequence |

### Current Interaction Patterns

**Tasks.tsx (Main Tasks Page)**:
- Click task name → Opens `TaskDetailModal` (view mode)
- Click Edit icon → Opens `EditTaskModal` (edit mode)
- These are separate modals with separate state

**RestaurantTasksList.tsx**:
- Click task name → Opens `TaskDetailModal` (view mode)
- Edit action delegated to parent via `onEditTask` prop
- Does NOT directly use EditTaskModal

**SequenceProgressCard.tsx**:
- Click task → Opens `TaskDetailModal`
- Edit task action → Opens `EditTaskModal`
- Both modals independently managed

---

## Task Type Field Mapping

### All Task Types
| Field | Display Component | Edit Component | Required |
|-------|------------------|----------------|----------|
| name | Text | Input | Yes |
| description | Text (pre-wrap) | Textarea | No |
| status | Badge | Select | Yes |
| type | Icon + Text | Select | Yes |
| priority | Badge | Select | Yes |
| due_date | Calendar icon + date | DateTimePicker | No |

### Communication Types (email, social_message, text)
| Field | Display Component | Edit Component | Required |
|-------|------------------|----------------|----------|
| message | Pre-wrap text with Copy | Textarea with variable hints | No |
| message_rendered | Blue box with Copy | N/A (auto-generated) | N/A |
| message_template | FileText icon + name | N/A (reference only) | N/A |

### Email Type Only
| Field | Display Component | Edit Component | Required |
|-------|------------------|----------------|----------|
| subject_line | Blue box with Copy | Input with variable hints | No |
| subject_line_rendered | Blue box with Copy | N/A (auto-generated) | N/A |

### Demo Meeting Type
Uses `QualificationForm` component for editing and various display components for viewing:

| Field | Display Component | Edit Component |
|-------|------------------|----------------|
| contact_role | InfoField | Select (CONTACT_ROLES) |
| number_of_venues | InfoField | Input (number) |
| point_of_sale | InfoField | Input with datalist |
| online_ordering_platform | InfoField | Input with datalist |
| online_ordering_handles_delivery | BooleanField | Select (Yes/No/Unknown) |
| self_delivery | BooleanField | Select (Yes/No/Unknown) |
| weekly_uber_sales_volume | InfoField (formatCurrency) | Input (number) |
| uber_aov | InfoField (formatCurrency) | Input (number) |
| uber_markup | InfoField (formatPercentage) | Input (number) |
| uber_profitability | InfoField (formatPercentage) | Input (number) |
| uber_profitability_description | InfoField | Textarea |
| current_marketing_description | InfoField | Textarea |
| website_type | InfoField (formatWebsiteType) | Select (WEBSITE_TYPES) |
| painpoints | TagList | TagInput |
| core_selling_points | TagList | TagInput |
| features_to_highlight | TagList | TagInput |
| possible_objections | TagList | TagInput |
| details | Pre-wrap text | Textarea |
| meeting_link | Link (clickable) | Input |

---

## Existing Components for Reuse

### Display Components (from `components/demo-meeting/`)
- `InfoField` - Label + value display with optional formatter
- `BooleanField` - Yes/No/Unknown with icons
- `TagList` - Expandable tag list display
- `TagCount` - Compact tag count

### Edit Components
- `QualificationForm` - Complete demo meeting form (already exists)
- `TagInput` - Multi-select with custom values
- All shadcn/ui components (Input, Textarea, Select, DateTimePicker)

### Utility Functions
- `formatCurrency()`
- `formatPercentage()`
- `formatWebsiteType()`

---

## Proposed Unified Modal Architecture

### New Props Interface
```typescript
interface UnifiedTaskDetailModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onSuccess?: () => void;  // Called after successful update/delete
  initialMode?: 'view' | 'edit';  // Default: 'view'
}
```

### State Management
```typescript
const [mode, setMode] = useState<'view' | 'edit'>(initialMode || 'view');
const [task, setTask] = useState<Task | null>(null);
const [formData, setFormData] = useState<FormData>({});
const [hasChanges, setHasChanges] = useState(false);
```

### Mode Behavior

**View Mode (Default)**:
- Display all existing TaskDetailModal content
- Status/Priority badges are interactive (inline dropdowns)
- Due date is editable inline
- Footer has: Delete, Cancel, Edit buttons

**Edit Mode**:
- Shows all available fields for the task type
- Even empty/null fields are shown (unlike view mode which hides nulls)
- Footer has: Delete, Cancel (back to view), Save Changes buttons

### Inline Editing in View Mode
The following fields should be editable even in view mode (matching existing patterns in Tasks.tsx):
- Status (dropdown)
- Priority (dropdown)
- Due Date (DateTimePicker)

### Field Visibility Matrix

| Field | View Mode (if set) | View Mode (if null) | Edit Mode |
|-------|-------------------|---------------------|-----------|
| name | Yes | Yes (empty) | Yes |
| description | Yes | Hidden | Yes |
| status | Yes (inline edit) | Yes | Yes |
| type | Yes | Yes | Yes |
| priority | Yes (inline edit) | Yes | Yes |
| due_date | Yes (inline edit) | Show "-" | Yes |
| message | Yes + Copy | Hidden | Yes* |
| subject_line | Yes + Copy | Hidden | Yes* |
| qualification fields | Yes (grouped) | Hidden | Yes* |

*Only shown for applicable task types

---

## Implementation Plan

### Phase 1: Create Unified Component
1. Create new `TaskDetailModal.tsx` (replacing existing)
2. Keep existing display logic from current TaskDetailModal
3. Add mode state and toggle
4. Add inline editing for status, priority, due_date
5. Add Delete, Cancel, Edit buttons to footer

### Phase 2: Implement Edit Mode
1. Add form state management (similar to EditTaskModal)
2. Show all available fields based on task type
3. Include QualificationForm for demo_meeting type
4. Implement Save Changes functionality
5. Track changes for partial updates

### Phase 3: Update All References
Files requiring updates:

| File | Change Required |
|------|-----------------|
| `pages/Tasks.tsx` | Remove EditTaskModal import, update modal state management |
| `pages/RestaurantDetail.jsx` | Remove EditTaskModal import, update edit handling |
| `components/tasks/RestaurantTasksList.tsx` | Update props (add onSuccess) |
| `components/sequences/SequenceProgressCard.tsx` | Remove EditTaskModal, consolidate state |

### Phase 4: Delete EditTaskModal
- Remove `components/tasks/EditTaskModal.tsx` after all references updated

---

## UI/UX Considerations

### View Mode Footer Layout
```
[Delete Task]                    [Cancel] [Edit]
(destructive, left)              (outline) (primary)
```

### Edit Mode Footer Layout
```
[Delete Task]                    [Cancel] [Save Changes]
(destructive, left)              (outline) (primary)
```

### Transitions
- View → Edit: Smooth transition, keep scroll position
- Edit → View: If changes exist, confirm discard dialog
- Edit → Save: Show loading state, then return to view mode

### Inline Edit Components in View Mode

**Status Badge (clickable)**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="p-0 h-auto">
      {getStatusBadge(task.status)}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {statusOptions.map(status => (
      <DropdownMenuItem onClick={() => updateStatus(status.value)}>
        {status.icon} {status.label}
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

**Priority Badge (clickable)**:
Similar pattern to status with priority options.

**Due Date (inline picker)**:
```tsx
<DateTimePicker
  value={task.due_date ? new Date(task.due_date) : null}
  onChange={(date) => handleDueDateChange(date)}
  placeholder="Set due date"
/>
```

---

## Constants and Types Reference

### Task Types
```typescript
type TaskType =
  | 'internal_activity'
  | 'email'
  | 'call'
  | 'social_message'
  | 'text'
  | 'demo_meeting';
```

### Task Status
```typescript
type TaskStatus = 'pending' | 'active' | 'completed' | 'cancelled';
```

### Task Priority
```typescript
type TaskPriority = 'low' | 'medium' | 'high';
```

### Communication Types (require message field)
```typescript
const COMMUNICATION_TYPES = ['email', 'social_message', 'text'];
```

---

## Dependencies

### Direct Dependencies
- `@/components/ui/*` - All shadcn/ui components
- `@/components/demo-meeting/*` - InfoField, BooleanField, TagList, QualificationForm, TagInput
- `@/hooks/use-toast` - Toast notifications
- `@/services/api` - API client
- `@/lib/utils` - cn utility
- `react-router-dom` - useNavigate for restaurant links
- `lucide-react` - Icons

### API Endpoints Used
- `GET /api/tasks/:id` - Fetch task details
- `PATCH /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/complete` - Complete task
- `PATCH /api/tasks/:id/cancel` - Cancel task
- `DELETE /api/tasks/:id` - Delete task

---

## Risk Assessment

### Low Risk
- Consolidating display logic (no functionality change)
- Adding inline edit capabilities (existing pattern)
- Footer button changes (UI only)

### Medium Risk
- Edit mode form state management (must handle all edge cases)
- Qualification data partial updates (complex logic to preserve)
- Ensuring all references are updated correctly

### Mitigation
- Test thoroughly in all usage contexts (Tasks, RestaurantDetail, SequenceProgressCard, RestaurantTasksList)
- Preserve existing EditTaskModal until fully tested
- Add unit tests for form state management

---

## Files Summary

### Files to Modify
1. `UberEats-Image-Extractor/src/components/tasks/TaskDetailModal.tsx` - Major rewrite
2. `UberEats-Image-Extractor/src/pages/Tasks.tsx` - Update imports and modal usage
3. `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` - Update imports and modal usage
4. `UberEats-Image-Extractor/src/components/tasks/RestaurantTasksList.tsx` - Update props interface
5. `UberEats-Image-Extractor/src/components/sequences/SequenceProgressCard.tsx` - Consolidate modals

### Files to Delete
1. `UberEats-Image-Extractor/src/components/tasks/EditTaskModal.tsx` - After consolidation

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Create Unified Component | Medium |
| Phase 2: Implement Edit Mode | High |
| Phase 3: Update All References | Medium |
| Phase 4: Delete EditTaskModal | Low |
| Testing & Bug Fixes | Medium |

**Total**: High complexity refactoring task

---

## Next Steps

1. Review this investigation document
2. Confirm the proposed approach
3. Begin implementation starting with Phase 1
4. Test each phase thoroughly before proceeding
