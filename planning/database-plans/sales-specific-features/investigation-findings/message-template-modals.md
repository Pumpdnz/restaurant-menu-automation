# Investigation 6: Message Template Modals

**Status:** ✅ Complete
**Date:** November 22, 2025
**Time Spent:** 15 minutes
**File Investigated:** `/src/components/message-templates/CreateMessageTemplateModal.tsx` (434 lines)

---

## Summary

The message template modal is a **single component used for create/edit/duplicate**. It currently supports 3 types (social_message, email, text) and has variable extraction/preview. **NO subject_line field exists** - needs to be added conditionally for email type only. Modal already has good variable documentation and preview system that can be extended to show subject line.

---

## 1. Component Structure

### Component Props (Lines 27-33)
```typescript
interface CreateMessageTemplateModalProps {
  open: boolean;
  templateId?: string | null;           // For edit mode
  duplicateFromId?: string | null;      // For duplicate mode
  onClose: () => void;
  onSuccess: () => void;
}
```

### Modes (Lines 50-51)
```typescript
const isEditMode = !!templateId;
const isDuplicateMode = !!duplicateFromId;
```

**Single component handles:**
- ✅ Create mode (no IDs)
- ✅ Edit mode (templateId provided)
- ✅ Duplicate mode (duplicateFromId provided)

### Form State (Lines 53-59)
```typescript
const [formData, setFormData] = useState({
  name: '',
  description: '',
  type: 'social_message',      // Default type
  message_content: '',
  is_active: true

  // NO subject_line ❌
});
```

**Missing field:**
❌ `subject_line: ''`

---

## 2. Current Template Types

### Type Selector (Lines 305-320)
```jsx
<Select
  value={formData.type}
  onValueChange={(v) => setFormData({ ...formData, type: v })}
>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="social_message">Social Message</SelectItem>
    <SelectItem value="email">Email</SelectItem>
    <SelectItem value="text">Text</SelectItem>
  </SelectContent>
</Select>
```

**Supported types:**
- social_message (default)
- email
- text

**Note:** Only `email` type should show subject_line input

---

## 3. Variable System

### Variable Extraction (Lines 80-91)
```typescript
const extractVariablesFromText = (text: string): string[] => {
  if (!text) return [];
  const regex = /{([a-zA-Z_][a-zA-Z0-9_]*)}/g;
  const matches = text.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
};
```

**Pattern:** Matches `{variable_name}` format

**Auto-extraction:** useEffect watches `formData.message_content` (lines 74-78)

### Detected Variables Display (Lines 354-366)
```jsx
{extractedVariables.length > 0 && (
  <div className="space-y-2">
    <Label>Detected Variables</Label>
    <div className="flex flex-wrap gap-2">
      {extractedVariables.map((variable, idx) => (
        <Badge key={idx} variant="secondary">
          {'{' + variable + '}'}
        </Badge>
      ))}
    </div>
  </div>
)}
```

**Note:** This section should also detect variables from subject_line

### Available Variables List (Lines 235-249)
```typescript
const availableVariables = [
  { name: 'restaurant_name', description: 'Restaurant name' },
  { name: 'contact_name', description: 'Contact person name' },
  { name: 'first_name', description: 'Contact first name' },
  { name: 'contact_email', description: 'Contact email' },
  { name: 'contact_phone', description: 'Contact phone' },
  { name: 'city', description: 'Restaurant city' },
  { name: 'cuisine', description: 'Cuisine type(s)' },
  { name: 'organisation_name', description: 'Organisation name' },
  { name: 'demo_store_url', description: 'Demo store URL' },
  { name: 'subdomain', description: 'Pumpd subdomain' },
  { name: 'phone', description: 'Restaurant phone' },
  { name: 'email', description: 'Restaurant email' },
  { name: 'address', description: 'Restaurant address' }
];
```

**13 variables currently documented**

**Will need to add 17+ qualification variables** (from Feature 1):
- contact_role
- number_of_venues
- point_of_sale
- online_ordering_platform
- weekly_uber_sales_volume
- uber_aov
- uber_markup
- uber_profitability
- painpoints (formatted)
- core_selling_points (formatted)
- features_to_highlight (formatted)
- possible_objections (formatted)
- meeting_link
- last_contacted_day
- etc.

---

## 4. Preview System

### Preview Function (Lines 139-185)
```typescript
const renderPreview = () => {
  if (!showPreview || !previewRestaurant) return null;

  let preview = formData.message_content;

  // Simple variable replacement for preview
  const variableMap: { [key: string]: any } = {
    restaurant_name: previewRestaurant.name || '',
    contact_name: previewRestaurant.contact_name || '',
    // ... more variables
  };

  extractedVariables.forEach(variable => {
    const value = variable in variableMap ? variableMap[variable] : `{${variable}}`;
    preview = preview.replace(new RegExp(`{${variable}}`, 'g'), value !== '' ? value : '-');
  });

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
      <div className="text-sm font-medium mb-2">Preview:</div>
      <div className="text-sm whitespace-pre-wrap">{preview}</div>
    </div>
  );
};
```

**Preview Features:**
- ✅ Restaurant selector (lines 397-414)
- ✅ Variable replacement
- ✅ Toggle show/hide (lines 386-395)
- ✅ Handles array cuisine (lines 153-164)
- ✅ Shows placeholder for unknown variables

**Will need:**
❌ Preview for subject_line (if email type)

---

## 5. Where to Add subject_line

### Required Changes

#### 1. Add to Form State (Line 53-59)
```typescript
const [formData, setFormData] = useState({
  name: '',
  description: '',
  type: 'social_message',
  subject_line: '',        // NEW
  message_content: '',
  is_active: true
});
```

#### 2. Add to fetchTemplate (Lines 102-108)
```typescript
setFormData({
  name: template.name || '',
  description: template.description || '',
  type: template.type || 'social_message',
  subject_line: template.subject_line || '',  // NEW
  message_content: template.message_content || '',
  is_active: template.is_active !== undefined ? template.is_active : true
});
```

#### 3. Add to resetForm (Lines 222-233)
```typescript
const resetForm = () => {
  setFormData({
    name: '',
    description: '',
    type: 'social_message',
    subject_line: '',      // NEW
    message_content: '',
    is_active: true
  });
  // ...
};
```

#### 4. Add Subject Line Input (Insert after line 339, before Message Content)
```jsx
{/* Subject Line - Only for Email type */}
{formData.type === 'email' && (
  <div className="space-y-2">
    <Label htmlFor="subject_line">Email Subject Line</Label>
    <Input
      id="subject_line"
      value={formData.subject_line || ''}
      onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
      placeholder="e.g., Demo booking confirmation - {restaurant_name}"
      className="font-mono text-sm"
    />
    <p className="text-xs text-muted-foreground">
      Supports variables like {'{restaurant_name}'}, {'{contact_name}'}
    </p>
  </div>
)}
```

#### 5. Update Variable Extraction (Lines 74-78)
```typescript
useEffect(() => {
  // Extract variables from message content AND subject line
  const messageVars = extractVariablesFromText(formData.message_content);
  const subjectVars = extractVariablesFromText(formData.subject_line || '');

  // Combine and deduplicate
  const allVars = [...new Set([...messageVars, ...subjectVars])];
  setExtractedVariables(allVars);
}, [formData.message_content, formData.subject_line]);
```

#### 6. Update Preview to Show Subject (Lines 139-185)
```jsx
const renderPreview = () => {
  if (!showPreview || !previewRestaurant) return null;

  // Replace variables in subject line
  let previewSubject = formData.subject_line || '';
  let previewMessage = formData.message_content;

  const variableMap = { /* ... */ };

  extractedVariables.forEach(variable => {
    const value = variable in variableMap ? variableMap[variable] : `{${variable}}`;
    const displayValue = value !== '' ? value : '-';

    previewSubject = previewSubject.replace(new RegExp(`{${variable}}`, 'g'), displayValue);
    previewMessage = previewMessage.replace(new RegExp(`{${variable}}`, 'g'), displayValue);
  });

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
      <div className="text-sm font-medium">Preview:</div>

      {/* Subject Line Preview */}
      {formData.type === 'email' && formData.subject_line && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Subject:</div>
          <div className="text-sm font-semibold">{previewSubject}</div>
        </div>
      )}

      {/* Message Preview */}
      <div>
        {formData.type === 'email' && formData.subject_line && (
          <div className="text-xs font-medium text-muted-foreground mb-1">Message:</div>
        )}
        <div className="text-sm whitespace-pre-wrap">{previewMessage}</div>
      </div>
    </div>
  );
};
```

---

## 6. Visual Layout Mockup

### Current Layout
```
┌─ Modal ──────────────────────────┐
│ Template Name *                  │
│ Description                      │
│ Type * | Status                  │
│ Message Content *                │
│ Detected Variables (badges)      │
│ Available Variables (reference)  │
│ Preview (with restaurant select) │
│ [Cancel] [Create/Update]         │
└──────────────────────────────────┘
```

### New Layout (for Email type)
```
┌─ Modal ──────────────────────────┐
│ Template Name *                  │
│ Description                      │
│ Type * | Status                  │
│ ┌─ Email Subject Line ────────┐ │ ← NEW (conditional)
│ │ {restaurant_name} demo...   │ │
│ └─────────────────────────────┘ │
│ Message Content *                │
│ Detected Variables (from both)   │
│ Available Variables (reference)  │
│ ┌─ Preview ───────────────────┐ │
│ │ Subject: ABC Restaurant...  │ │ ← NEW (shows subject)
│ │ Message:                    │ │
│ │ Hi John, following up...    │ │
│ └─────────────────────────────┘ │
│ [Cancel] [Create/Update]         │
└──────────────────────────────────┘
```

---

## 7. Validation Updates

### Current Validation (Lines 188-191)
```typescript
if (!formData.name || !formData.type || !formData.message_content) {
  setError('Please fill in all required fields');
  return;
}
```

**Subject line is NOT required** - keep as optional

No validation changes needed.

---

## 8. API Integration

### Save Handler (Lines 187-220)
```typescript
const handleSave = async () => {
  // Validation...

  try {
    const response = isEditMode
      ? await api.patch(`/message-templates/${templateId}`, formData)
      : await api.post('/message-templates', formData);

    // Success handling...
  }
}
```

**No changes needed!** formData already includes subject_line after state update.

Backend will automatically handle the field if:
- ✅ Database column exists
- ✅ Service accepts field in request body

---

## 9. Existing Features to Preserve

### 1. Variable Extraction System (Lines 80-91)
✅ Keep existing regex pattern
✅ Extend to check both message_content and subject_line

### 2. Detected Variables Badges (Lines 354-366)
✅ Keep existing display
✅ Will automatically include subject line variables

### 3. Preview System (Lines 126-185)
✅ Keep existing toggle and restaurant selector
✅ Add subject line to preview rendering

### 4. Available Variables Reference (Lines 369-381)
✅ Keep existing documentation
✅ Will be updated by Feature 1 to add qualification variables

### 5. Loading States (Lines 251-261)
✅ Keep existing fetching spinner
✅ Keep existing loading button text

### 6. Error Handling (Lines 276-280)
✅ Keep existing error display
✅ Keep existing toast notifications

---

## 10. Implementation Checklist

### State Updates (15 min)
- [ ] Add subject_line to formData initial state
- [ ] Add subject_line to fetchTemplate
- [ ] Add subject_line to resetForm

### UI Updates (30 min)
- [ ] Add subject line input (conditional on type=email)
- [ ] Add placeholder and help text
- [ ] Position after Type/Status, before Message Content

### Variable System Updates (15 min)
- [ ] Update useEffect to extract from subject_line
- [ ] Combine variables from both fields
- [ ] Test detected variables display

### Preview Updates (30 min)
- [ ] Add subject preview section
- [ ] Format preview for email type
- [ ] Apply variable replacement to subject
- [ ] Style subject vs message distinction

### Testing (30 min)
- [ ] Test email template create with subject
- [ ] Test email template edit with subject
- [ ] Test duplicate preserves subject
- [ ] Test variable extraction from subject
- [ ] Test preview shows subject + message
- [ ] Test non-email types (subject hidden)
- [ ] Test save/load cycle
- [ ] Test empty subject (should be allowed)

**Total Estimated Time:** 2 hours

---

## 11. Edge Cases & Gotchas

⚠️ **Type change behavior** - If user changes from email to text/social, subject_line should be cleared
⚠️ **Subject line empty** - Empty subject is valid, don't require it
⚠️ **Variable extraction** - Must extract from BOTH subject and message
⚠️ **Preview rendering** - Need clear visual separation between subject and message
⚠️ **Duplicate mode** - Must copy subject_line when duplicating
⚠:️ **Edit mode** - Must load existing subject_line when editing
⚠️ **Available variables** - Will be updated in Feature 1, keep in sync

---

## 12. Recommended Implementation

### Approach
**Single PR with all changes** - All changes are in one component, keep together

### Order of Implementation
1. **State updates** (15 min) - Add field to all state management
2. **UI input** (30 min) - Add conditional input with styling
3. **Variable extraction** (15 min) - Update to include subject
4. **Preview** (30 min) - Add subject to preview rendering
5. **Testing** (30 min) - Test all modes and edge cases

### Testing Strategy
**Test matrix:**
| Mode | Type | Subject | Expected Result |
|------|------|---------|-----------------|
| Create | Email | With | Shows input, saves, previews |
| Create | Email | Empty | Shows input, saves without subject |
| Create | Text | N/A | Hides input, no subject saved |
| Edit | Email | Existing | Loads subject, editable |
| Edit | Email | Null | Shows empty input |
| Duplicate | Email | With | Copies subject to new template |
| Change Type | Email→Text | - | Subject clears (optional behavior) |

---

## 13. Comparison with Task Modals

**Note:** Task modals (CreateTaskModal, EditTaskModal) will also need subject_line added.

**Differences:**
- Message template modal: **Simple input** (no message template selector)
- Task modals: **Two fields** (message template selector + subject line input)
- Task modals: **Subject can come from template** OR manual entry

**Shared pattern:**
- Both conditional on type=email
- Both support variable replacement
- Both show in preview/quick view

---

**Investigation Complete:** ✅
**Findings Documented:** ✅
**Ready for Implementation:** After Feature 1 complete
