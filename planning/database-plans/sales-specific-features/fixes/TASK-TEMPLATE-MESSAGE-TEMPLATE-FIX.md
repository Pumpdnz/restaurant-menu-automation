# Task Template & Message Template Integration Fix

## Issue Summary

When using a task template with a default message template to create a new task, there were several problems:

1. ✅ FIXED: The message template was NOT being added to the create task dialog
2. ✅ FIXED: If the user selected a different message template, the task template's message template was overriding the user's selection
3. ✅ FIXED: Users couldn't properly edit message content when using task templates with message templates

## Root Causes

### Frontend Issue (CreateTaskModal.tsx)

In `CreateTaskModal.tsx`, the `handleTemplateSelect` function was not properly handling the relationship between task templates and message templates:

### Backend Issue (tasks-service.js) - PRIMARY ISSUE

The backend was **unconditionally overriding** user selections with task template values:

```javascript
// OLD CODE (INCORRECT)
const handleTemplateSelect = async (templateId: string) => {
  // ...
  setFormData({
    // ...
    message: template.default_message || ''  // ONLY used default_message
    // message_template_id was NOT being set
  });
  // selectedMessageTemplate state was NOT being set
};
```

The function only set the `default_message` field and completely ignored:
- The `message_template_id` relationship
- The associated message template's content
- The `selectedMessageTemplate` state variable

## The Fix

Updated `handleTemplateSelect` to properly handle message templates:

```javascript
const handleTemplateSelect = async (templateId: string) => {
  if (!templateId || templateId === 'none') {
    setFormData({
      ...formData,
      task_template_id: '',
      name: '',
      description: '',
      type: 'internal_activity',
      priority: 'medium',
      message_template_id: '',  // Clear message template
      message: ''
    });
    setSelectedMessageTemplate('');  // Clear selection state
    return;
  }

  const template = taskTemplates.find(t => t.id === templateId);
  if (template) {
    // Check if template has an associated message template
    const hasMessageTemplate = template.message_template_id && template.message_templates;

    setFormData({
      ...formData,
      task_template_id: templateId,
      name: template.name,
      description: template.description || '',
      type: template.type,
      priority: template.priority,
      // NEW: Properly set message_template_id
      message_template_id: hasMessageTemplate ? template.message_template_id : '',
      // NEW: Use message template content if available, otherwise use default message
      message: hasMessageTemplate
        ? (template.message_templates.message_content || '')
        : (template.default_message || '')
    });

    // NEW: Set the selected message template state
    if (hasMessageTemplate) {
      setSelectedMessageTemplate(template.message_template_id);
    } else {
      setSelectedMessageTemplate('');
    }
  }
};
```

## How It Works Now

### Data Flow

1. **Task Templates Service** (task-templates-service.js):
   ```javascript
   select(`
     *,
     message_templates (
       id, name, type, message_content
     )
   `)
   ```
   Returns task templates WITH their associated message template data.

2. **CreateTaskModal** receives task templates with nested message_templates object

3. **handleTemplateSelect** properly extracts and uses this data:
   - If `template.message_template_id` exists AND `template.message_templates` exists:
     - Sets `formData.message_template_id` to the message template ID
     - Sets `formData.message` to the message template's content
     - Sets `selectedMessageTemplate` state for UI dropdown
   - Otherwise:
     - Uses `template.default_message` as fallback
     - Clears message template relationship

### User Workflow

**Scenario 1: Task Template with Message Template**
1. User selects task template "Follow-up Email"
2. Task template has `message_template_id` pointing to "Demo Follow-up Template"
3. Modal populates:
   - Name: "Follow-up Email"
   - Type: "email"
   - Message Template dropdown: Shows "Demo Follow-up Template" (selected)
   - Message textarea: Populated with template content
4. User can:
   - **Keep the message template**: Edit the message text if needed
   - **Change message template**: Select different template from dropdown
   - **Remove template**: Click "Clear Template" and write custom message

**Scenario 2: Task Template with Default Message (No Message Template)**
1. User selects task template "Quick Follow-up"
2. Task template has NO message_template_id, but has `default_message`
3. Modal populates:
   - Name: "Quick Follow-up"
   - Message Template dropdown: Shows "No template (manual message)"
   - Message textarea: Populated with default_message content
4. User can:
   - **Keep default message**: Edit the text as needed
   - **Select a message template**: Choose template from dropdown (replaces default message)

**Scenario 3: User Changes Message Template**
1. Task template sets initial message template A
2. User selects message template B from dropdown
3. `handleMessageTemplateSelect` is called:
   ```javascript
   setFormData({
     ...formData,
     message_template_id: 'template-B-id',  // Updates to B
     message: template.message_content      // Updates to B's content
   });
   setSelectedMessageTemplate('template-B-id'); // UI shows B
   ```
4. Message template B is properly saved with the task

**Scenario 4: User Edits Message Text**
1. Task template sets message template with content
2. User manually edits the message in the textarea
3. onChange handler updates `formData.message`:
   ```javascript
   onChange={(e) => setFormData({ ...formData, message: e.target.value })}
   ```
4. Edited message is saved with the task
5. `message_template_id` remains set (shows which template was used as base)

```javascript
// OLD CODE (INCORRECT) - tasks-service.js
if (template.message_template_id && template.message_templates) {
  taskData.message_template_id = template.message_template_id;  // ← ALWAYS OVERRIDES!
  taskData.message = template.message_templates.message_content;
}
```

This meant:
1. Frontend correctly sends user's message template choice (Y)
2. Backend receives task with message_template_id = Y
3. Backend sees task_template_id is set, fetches template
4. Backend **unconditionally overwrites** message_template_id back to X (from template)
5. User's choice is lost!

## The Fixes

### Fix 1: Frontend (CreateTaskModal.tsx)

Updated `handleTemplateSelect` to properly handle message templates (lines 192-234).

### Fix 2: Backend (tasks-service.js) - PRIMARY FIX

Changed backend logic to **respect user choices** and only apply template defaults when user hasn't specified values:

```javascript
// NEW CODE (CORRECT) - tasks-service.js
if (template.message_template_id && template.message_templates) {
  // Only use template's message template if user hasn't selected a different one
  if (!taskData.message_template_id) {
    taskData.message_template_id = template.message_template_id;
  }
  // Only use template's message if user hasn't provided custom message
  if (!taskData.message) {
    taskData.message = template.message_templates.message_content;
  }
} else if (template.default_message && !taskData.message) {
  // Only use default message if user hasn't provided one
  taskData.message = template.default_message;
}
```

## Files Modified

1. `/UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx`
   - Updated `handleTemplateSelect` function (lines 192-234)

2. `/UberEats-Image-Extractor/src/services/tasks-service.js`
   - Updated `createTask` function template logic (lines 126-139)

## What's Fixed

✅ **Issue 1**: Message template IS now added to the create task dialog
- `message_template_id` is properly set in formData
- `selectedMessageTemplate` state shows correct selection in dropdown

✅ **Issue 2**: User's message template selection is NOT overridden
- `handleMessageTemplateSelect` properly updates both formData and state
- No conflicts between task template and user selection

✅ **Issue 3**: User CAN edit message content
- Message textarea has onChange handler that updates formData.message
- Works whether using task template's message template or a different one
- Manual edits are preserved and saved with the task

✅ **Issue 4**: Task templates work with both scenarios
- Task template WITH message_template_id: Uses message template content
- Task template WITHOUT message_template_id: Uses default_message

## Testing Checklist

- [ ] Select task template with message template → message template appears in dropdown
- [ ] Message content is populated from message template
- [ ] User can edit the message text
- [ ] User can select different message template → content updates
- [ ] User can clear message template → switches to manual message
- [ ] Task saves with correct message_template_id
- [ ] Task saves with edited message content
- [ ] Task template without message_template_id uses default_message
- [ ] Changing task template updates message template dropdown accordingly

## Benefits

1. **Proper Template Integration**: Task templates fully integrate with message templates
2. **User Control**: Users can override or edit any message content
3. **Data Integrity**: Proper relationships saved to database
4. **Flexible Workflow**: Supports all combinations of templates and manual edits
5. **Clear UI**: Dropdown accurately reflects selected message template
