# Sales Features - Problem Analysis and Solutions

**Date:** 2025-01-17
**Status:** Analysis Complete
**Implementation Status:** Phases 1-5 Completed with Issues

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Problem 1: {cuisine} Variable Not Replacing in Preview](#problem-1-cuisine-variable-not-replacing-in-preview)
3. [Problem 2: No Task Template Management UI](#problem-2-no-task-template-management-ui)
4. [Problem 3: No Message Template Integration in Task Creation](#problem-3-no-message-template-integration-in-task-creation)
5. [Problem 4: Single-Select Filters Limit Restaurant Filtering](#problem-4-single-select-filters-limit-restaurant-filtering)
6. [Problem 5: Task Status Quick-Change Issues](#problem-5-task-status-quick-change-issues)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Current Status
The sales-specific features implementation (Phases 1-5) is **70% complete** with five critical issues identified:

1. ✅ **Completed:**
   - Database migrations for sales columns, tasks, task_templates, and message_templates
   - Backend API for all three entities (tasks, task_templates, message_templates)
   - Variable replacement service with comprehensive mappings
   - Message Templates UI (create, edit, delete, preview)
   - Tasks UI (create, edit, complete, cancel)
   - Basic task creation from task templates
   - Restaurant filtering UI with single-select dropdowns

2. ❌ **Issues Identified:**
   - **Issue #1:** {cuisine} variable replacement fails in message template preview
   - **Issue #2:** No frontend UI for managing task templates
   - **Issue #3:** Task creation modal lacks message template selector for communication tasks
   - **Issue #4:** Single-select filters limit restaurant filtering capabilities
   - **Issue #5:** Task status quick-change functionality is incorrectly implemented

### Impact Assessment

| Issue | Severity | Impact | Affected Features |
|-------|----------|--------|-------------------|
| #1 - Cuisine Variable | Medium | Users cannot preview cuisine data in message templates | Message template preview |
| #2 - Task Templates UI | High | Cannot create/manage task templates through UI | Task automation workflow |
| #3 - Message Template Selector | High | Cannot easily apply message templates when creating tasks | Task creation efficiency |
| #4 - Single-Select Filters | Medium | Cannot filter by multiple lead stages/warmth levels simultaneously | Restaurant filtering |
| #5 - Task Status Quick-Change | Medium | Wrong tasks show quick-complete button; status icon not interactive | Task management UX |

---

## Problem 1: {cuisine} Variable Not Replacing in Preview

### Description
When previewing a message template that contains the `{cuisine}` variable, the variable is not being replaced with actual cuisine data from the selected restaurant.

### Root Cause Analysis

**Location:** [CreateMessageTemplateModal.tsx:136-161](../../../UberEats-Image-Extractor/src/components/message-templates/CreateMessageTemplateModal.tsx#L136-L161)

#### The Issue
The frontend preview function in `CreateMessageTemplateModal.tsx` has a **hardcoded variable mapping** that does NOT include proper logic for the `cuisine` variable:

```typescript
// Current implementation (INCORRECT)
const variableMap: { [key: string]: any } = {
  restaurant_name: previewRestaurant.name,
  contact_name: previewRestaurant.contact_name,
  first_name: previewRestaurant.contact_name
    ? previewRestaurant.contact_name.trim().split(/\s+/)[0]
    : '',
  contact_email: previewRestaurant.contact_email,
  city: previewRestaurant.city,
  cuisine: Array.isArray(previewRestaurant.cuisine)  // ❌ PROBLEM HERE
    ? previewRestaurant.cuisine.join(', ')
    : previewRestaurant.cuisine,
  // ... other mappings
};
```

#### Why It Fails
1. **Data Type Mismatch:** The `cuisine` field in the database can be:
   - A string: `"Italian"`
   - An array: `["Italian", "Pizza"]`
   - A JSONB array from Supabase: Might come as a string representation
   - NULL or undefined

2. **Missing Null Check:** The current code doesn't handle `null` or `undefined` cuisine values
3. **No String Fallback:** If cuisine comes as a string but contains array-like data (e.g., `"[\"Italian\"]"`), it won't be parsed correctly

#### Backend Reference (CORRECT Implementation)
The backend variable replacement service **correctly** handles this in [variable-replacement-service.js:51-56](../../../UberEats-Image-Extractor/src/services/variable-replacement-service.js#L51-L56):

```javascript
cuisine: (restaurant) => {
  if (Array.isArray(restaurant.cuisine)) {
    return restaurant.cuisine.join(', ');
  }
  return restaurant.cuisine || '';  // ✅ Proper null handling
},
```

### Solution

**Fix the frontend preview variable mapping to match the backend implementation:**

```typescript
// CORRECTED implementation
const variableMap: { [key: string]: any } = {
  restaurant_name: previewRestaurant.name || '',
  contact_name: previewRestaurant.contact_name || '',
  first_name: previewRestaurant.contact_name
    ? previewRestaurant.contact_name.trim().split(/\s+/)[0]
    : '',
  contact_email: previewRestaurant.contact_email || '',
  city: previewRestaurant.city || '',
  cuisine: (() => {
    // Handle array cuisine
    if (Array.isArray(previewRestaurant.cuisine)) {
      return previewRestaurant.cuisine.join(', ');
    }
    // Handle string cuisine
    if (typeof previewRestaurant.cuisine === 'string') {
      return previewRestaurant.cuisine;
    }
    // Handle null/undefined
    return '';
  })(),
  demo_store_url: previewRestaurant.demo_store_url || '',
  organisation_name: previewRestaurant.organisation_name || '',
  subdomain: previewRestaurant.subdomain || '',
  phone: previewRestaurant.phone || '',
  email: previewRestaurant.email || '',
  address: previewRestaurant.address || ''
};
```

### Files to Modify
- [UberEats-Image-Extractor/src/components/message-templates/CreateMessageTemplateModal.tsx](../../../UberEats-Image-Extractor/src/components/message-templates/CreateMessageTemplateModal.tsx)

### Testing Requirements
1. Create a test restaurant with cuisine as an array: `["Italian", "Pizza"]`
2. Create a test restaurant with cuisine as a string: `"Italian"`
3. Create a test restaurant with null cuisine
4. Verify preview displays correctly for all three cases
5. Compare preview output with actual task message rendering

---

## Problem 2: No Task Template Management UI

### Description
While the backend API for task templates is fully implemented (routes, service, database), there is **no frontend interface** to create, edit, or manage task templates. Users can only use task templates through the task creation modal's dropdown, but cannot create new ones.

### Root Cause Analysis

#### Missing Components
1. **No TaskTemplates Page** - No page component exists for task template management
2. **No Route** - App.tsx does not include a route for `/task-templates`
3. **No Navigation Link** - Sidebar/navigation doesn't have a link to task templates
4. **No Create/Edit Modals** - No UI components for CRUD operations on task templates

#### Backend Status (100% Complete)
✅ Routes: [src/routes/task-templates-routes.js](../../../UberEats-Image-Extractor/src/routes/task-templates-routes.js)
✅ Service: [src/services/task-templates-service.js](../../../UberEats-Image-Extractor/src/services/task-templates-service.js)
✅ API Endpoints:
- `GET /api/task-templates` - List all templates
- `GET /api/task-templates/:id` - Get template by ID
- `POST /api/task-templates` - Create template
- `PATCH /api/task-templates/:id` - Update template
- `DELETE /api/task-templates/:id` - Delete template

### Solution

Create a complete task template management UI following the same pattern as Message Templates.

#### Required Components

**1. TaskTemplates Page** (`/src/pages/TaskTemplates.tsx`)
Similar structure to `MessageTemplates.tsx`:
- List view with table
- Filters (by type, active status)
- Create/Edit/Delete actions
- Display template details (name, type, priority, message template association)
- Usage statistics (how many tasks created from each template)

**2. Create/Edit Modal** (`/src/components/task-templates/CreateTaskTemplateModal.tsx`)
Form fields:
- Template Name (required)
- Description
- Type (dropdown: internal_activity, email, call, social_message, text)
- Priority (dropdown: low, medium, high)
- Message Template (dropdown: select from existing message templates) - **IMPORTANT**
- Default Message (textarea: only if no message template selected)
- Active status (checkbox)

**3. Task Template Detail Modal** (Optional) (`/src/components/task-templates/TaskTemplateDetailModal.tsx`)
Shows:
- Full template details
- Associated message template (if any)
- Usage statistics
- Recent tasks created from this template

#### UI/UX Specifications

**TaskTemplates Page Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Task Templates                           [+ New Template]   │
│ 12 templates                                                │
├─────────────────────────────────────────────────────────────┤
│ Filters: [Type: All ▼] [Status: All ▼]    [Clear All]     │
├─────────────────────────────────────────────────────────────┤
│ Name          │ Type     │ Priority │ Message Template │ ... │
│ Demo Follow-up│ Email    │ Medium   │ Demo Booking Msg │ ... │
│ Cold Outreach │ Social   │ High     │ Cold Intro Msg   │ ... │
└─────────────────────────────────────────────────────────────┘
```

**Create/Edit Modal:**
```
┌──────────────────────────────────────────────────┐
│ Create Task Template                       [×]   │
├──────────────────────────────────────────────────┤
│                                                  │
│ Template Name *                                  │
│ ┌──────────────────────────────────────────┐    │
│ │ Follow up on demo booking                │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Description                                      │
│ ┌──────────────────────────────────────────┐    │
│ │ Send follow-up message after demo        │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Type *              Priority                     │
│ [Email        ▼]    [Medium      ▼]             │
│                                                  │
│ Message Template (Optional)                      │
│ [Demo Booking Follow-up       ▼]                │
│                                                  │
│ Default Message (if no template selected)        │
│ ┌──────────────────────────────────────────┐    │
│ │ Hi {contact_name}, ...                   │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ ☑ Active                                         │
│                                                  │
│                      [Cancel] [Create Template] │
└──────────────────────────────────────────────────┘
```

### Files to Create

1. **Page Component:**
   - `/UberEats-Image-Extractor/src/pages/TaskTemplates.tsx`

2. **Modal Components:**
   - `/UberEats-Image-Extractor/src/components/task-templates/CreateTaskTemplateModal.tsx`
   - `/UberEats-Image-Extractor/src/components/task-templates/TaskTemplateDetailModal.tsx` (optional)

3. **Route Addition:**
   - Modify `/UberEats-Image-Extractor/src/App.tsx` to add route:
     ```tsx
     import TaskTemplates from './pages/TaskTemplates';
     // ...
     <Route path="/task-templates" element={<TaskTemplates />} />
     ```

4. **Navigation Update:**
   - Add link in sidebar navigation component

### Implementation Priority
**Priority: HIGH** - This is blocking the full workflow where users need to define reusable task templates

---

## Problem 3: No Message Template Integration in Task Creation

### Description
When creating a task of type `email`, `social_message`, or `text`, the CreateTaskModal only shows a plain message textarea. There is **no option to select an existing message template**, forcing users to manually type or copy-paste message content every time.

### Root Cause Analysis

#### Current Implementation
**Location:** [CreateTaskModal.tsx:296-310](../../../UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx#L296-L310)

The current modal shows message textarea for communication tasks:
```tsx
{/* Message (for communication tasks) */}
{['email', 'social_message', 'text'].includes(formData.type) && (
  <div className="space-y-2">
    <Label htmlFor="message">Message</Label>
    <Textarea
      id="message"
      value={formData.message}
      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
      placeholder="Use variables like {restaurant_name}, {contact_name}, etc."
      rows={5}
    />
    {/* ... variable hints ... */}
  </div>
)}
```

**What's Missing:**
1. No dropdown to select a message template
2. No filtering of message templates by task type
3. No preview of selected message template
4. No auto-population of message field when template is selected

#### Expected Workflow
When a user selects a task type that requires a message (email, social_message, text):
1. **Show Message Template Selector** - Dropdown of message templates filtered by type
2. **Auto-populate Message** - When template selected, populate the message field
3. **Allow Manual Override** - User can still edit the message after selecting a template
4. **Clear Template Link** - Button to clear template selection and start fresh

### Solution

Enhance the CreateTaskModal to include message template integration.

#### UI Enhancement

**Updated Modal Section:**
```
┌──────────────────────────────────────────────────┐
│ Message Template (Optional)                      │
│ [Demo Booking Follow-up       ▼] [Clear]        │
│                                                  │
│ Message                                          │
│ ┌──────────────────────────────────────────┐    │
│ │ Hi {contact_name},                       │    │
│ │                                          │    │
│ │ Thanks for booking a demo with Pumpd...  │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Available variables: {restaurant_name}, ...      │
└───────────────────���──────────────────────────────┘
```

#### Code Changes Required

**File:** [UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx](../../../UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx)

**Changes:**

1. **Add State for Message Templates:**
```tsx
const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
const [selectedMessageTemplate, setSelectedMessageTemplate] = useState<string>('');
```

2. **Fetch Message Templates:**
```tsx
const fetchMessageTemplates = async () => {
  try {
    const response = await api.get('/message-templates', {
      params: { is_active: true }
    });
    setMessageTemplates(response.data.templates || []);
  } catch (error) {
    console.error('Failed to fetch message templates:', error);
  }
};

useEffect(() => {
  if (open) {
    fetchTaskTemplates();
    fetchMessageTemplates(); // Add this
    if (!restaurantId) {
      fetchRestaurants();
    }
  }
}, [open]);
```

3. **Filter Templates by Task Type:**
```tsx
const getFilteredMessageTemplates = () => {
  return messageTemplates.filter(template => {
    if (formData.type === 'email') return template.type === 'email';
    if (formData.type === 'text') return template.type === 'text';
    if (formData.type === 'social_message') return template.type === 'social_message';
    return false;
  });
};
```

4. **Handle Template Selection:**
```tsx
const handleMessageTemplateSelect = async (templateId: string) => {
  if (!templateId || templateId === 'none') {
    setSelectedMessageTemplate('');
    setFormData({ ...formData, message_template_id: '', message: '' });
    return;
  }

  const template = messageTemplates.find(t => t.id === templateId);
  if (template) {
    setSelectedMessageTemplate(templateId);
    setFormData({
      ...formData,
      message_template_id: templateId,
      message: template.message_content
    });
  }
};
```

5. **Update Form Data Interface:**
```tsx
const [formData, setFormData] = useState({
  name: '',
  description: '',
  type: 'internal_activity',
  priority: 'medium',
  restaurant_id: restaurantId || '',
  task_template_id: '',
  message_template_id: '',  // ADD THIS
  message: '',
  due_date: ''
});
```

6. **Add Message Template Selector UI:**
```tsx
{/* Message (for communication tasks) */}
{['email', 'social_message', 'text'].includes(formData.type) && (
  <div className="space-y-4">
    {/* Message Template Selector */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Message Template (Optional)</Label>
        {selectedMessageTemplate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleMessageTemplateSelect('none')}
          >
            Clear Template
          </Button>
        )}
      </div>
      <Select
        value={selectedMessageTemplate}
        onValueChange={handleMessageTemplateSelect}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a message template..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No template (manual message)</SelectItem>
          {getFilteredMessageTemplates().map(template => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* Message Textarea */}
    <div className="space-y-2">
      <Label htmlFor="message">Message</Label>
      <Textarea
        id="message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        placeholder="Use variables like {restaurant_name}, {contact_name}, etc."
        rows={5}
      />
      <p className="text-xs text-muted-foreground">
        Available variables: {'{restaurant_name}'}, {'{contact_name}'},
        {'{first_name}'}, {'{city}'}, {'{cuisine}'}, {'{demo_store_url}'}
      </p>
    </div>
  </div>
)}
```

### Backend Support

The backend already supports this! The tasks service in [tasks-service.js:117-119](../../../UberEats-Image-Extractor/src/services/tasks-service.js#L117-L119) handles message_template_id:

```javascript
// If template has message template, use it
if (template.message_template_id && template.message_templates) {
  taskData.message_template_id = template.message_template_id;
  taskData.message = template.message_templates.message_content;
}
```

### Files to Modify
- [UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx](../../../UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx)

### Implementation Priority
**Priority: HIGH** - This significantly improves user efficiency when creating tasks

---

## Problem 4: Single-Select Filters Limit Restaurant Filtering

### Description
The Restaurants page filter system currently only allows users to select **one option per filter dropdown**. This severely limits the ability to view and analyze leads across multiple categories simultaneously. For example, users cannot view all restaurants that are both "demo_booked" AND "contract_sent" stages at the same time.

### Root Cause Analysis

**Location:** [Restaurants.jsx:64-73, 114-142, 722-808](../../../UberEats-Image-Extractor/src/pages/Restaurants.jsx)

#### Current Implementation

**1. Filter State (Lines 64-73):**
```jsx
const [filters, setFilters] = useState({
  search: searchParams.get('search') || '',
  lead_type: searchParams.get('lead_type') || 'all',        // ❌ Single value
  lead_category: searchParams.get('lead_category') || 'all', // ❌ Single value
  lead_warmth: searchParams.get('lead_warmth') || 'all',    // ❌ Single value
  lead_stage: searchParams.get('lead_stage') || 'all',      // ❌ Single value
  lead_status: searchParams.get('lead_status') || 'all',    // ❌ Single value
  demo_store_built: searchParams.get('demo_store_built') || 'all',
  icp_rating_min: searchParams.get('icp_rating_min') || ''
});
```

**2. Filter Logic (Lines 114-142):**
```jsx
// Simple equality checks - only works with single values
if (filters.lead_type !== 'all') {
  filtered = filtered.filter(r => r.lead_type === filters.lead_type);
}

if (filters.lead_category !== 'all') {
  filtered = filtered.filter(r => r.lead_category === filters.lead_category);
}

if (filters.lead_warmth !== 'all') {
  filtered = filtered.filter(r => r.lead_warmth === filters.lead_warmth);
}

if (filters.lead_stage !== 'all') {
  filtered = filtered.filter(r => r.lead_stage === filters.lead_stage);
}
```

**3. UI Components (Lines 722-808):**
Single-select dropdowns using `<Select>` component.

#### Use Cases That Don't Work

1. **View multiple lead stages:** Cannot see both "demo_booked" AND "contract_sent" leads together
2. **Multi-warmth analysis:** Cannot view all "warm" AND "hot" leads simultaneously
3. **Multiple lead sources:** Cannot filter by multiple lead categories at once
4. **Complex sales scenarios:** Cannot view all leads that are ("warm" OR "hot") AND ("demo_booked" OR "in_talks")

### Solution

Implement **multi-select filters** with checkbox-based dropdowns for all filter categories.

#### UI Enhancement

**Multi-Select Filter Pattern:**
```
┌────────────────────────────────────────┐
│ Lead Stage              [3 selected ▼] │
├────────────────────────────────────────┤
│ ☑ Demo Booked                          │
│ ☑ Contract Sent                        │
│ ☑ In Talks                             │
│ ☐ Uncontacted                          │
│ ☐ Reached Out                          │
│ ☐ Rebook Demo                          │
│ ☐ Closed Won                           │
│ ☐ Closed Lost                          │
│ ☐ Reengaging                           │
│                                        │
│ [Clear Selection] [Apply]              │
└────────────────────────────────────────┘
```

#### Implementation Changes

**File:** [UberEats-Image-Extractor/src/pages/Restaurants.jsx](../../../UberEats-Image-Extractor/src/pages/Restaurants.jsx)

**1. Create Multi-Select Component:**

Create new component: `/src/components/ui/multi-select.tsx`

```tsx
import React, { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Badge } from './badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './command';

interface MultiSelectProps {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {selected.slice(0, 2).map((value) => {
                const option = options.find((opt) => opt.value === value);
                return (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="mr-1"
                  >
                    {option?.label}
                  </Badge>
                );
              })}
              {selected.length > 2 && (
                <Badge variant="secondary">
                  +{selected.length - 2} more
                </Badge>
              )}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.includes(option.value)
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleClear}
              >
                <X className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**2. Update Filter State:**

```jsx
const [filters, setFilters] = useState({
  search: searchParams.get('search') || '',
  lead_type: searchParams.get('lead_type')?.split(',') || [],        // ✅ Array
  lead_category: searchParams.get('lead_category')?.split(',') || [], // ✅ Array
  lead_warmth: searchParams.get('lead_warmth')?.split(',') || [],    // ✅ Array
  lead_stage: searchParams.get('lead_stage')?.split(',') || [],      // ✅ Array
  lead_status: searchParams.get('lead_status')?.split(',') || [],    // ✅ Array
  demo_store_built: searchParams.get('demo_store_built') || 'all',
  icp_rating_min: searchParams.get('icp_rating_min') || ''
});
```

**3. Update Filter Logic:**

```jsx
// Multi-value filtering with .includes()
if (filters.lead_type && filters.lead_type.length > 0) {
  filtered = filtered.filter(r =>
    r.lead_type && filters.lead_type.includes(r.lead_type)
  );
}

if (filters.lead_category && filters.lead_category.length > 0) {
  filtered = filtered.filter(r =>
    r.lead_category && filters.lead_category.includes(r.lead_category)
  );
}

if (filters.lead_warmth && filters.lead_warmth.length > 0) {
  filtered = filtered.filter(r =>
    r.lead_warmth && filters.lead_warmth.includes(r.lead_warmth)
  );
}

if (filters.lead_stage && filters.lead_stage.length > 0) {
  filtered = filtered.filter(r =>
    r.lead_stage && filters.lead_stage.includes(r.lead_stage)
  );
}

if (filters.lead_status && filters.lead_status.length > 0) {
  filtered = filtered.filter(r =>
    r.lead_status && filters.lead_status.includes(r.lead_status)
  );
}
```

**4. Update URL Params:**

```jsx
const updateUrlParams = () => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      params.set(key, value.join(','));
    } else if (value && value !== 'all' && value !== '') {
      params.set(key, value);
    }
  });
  setSearchParams(params, { replace: true });
};
```

**5. Update hasActiveFilters:**

```jsx
const hasActiveFilters = () => {
  return Object.entries(filters).some(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== 'all' && value !== '';
  });
};

const getActiveFiltersCount = () => {
  return Object.entries(filters).filter(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== 'all' && value !== '';
  }).reduce((count, [key, value]) => {
    if (Array.isArray(value)) return count + value.length;
    return count + 1;
  }, 0);
};
```

**6. Update Filter UI:**

```jsx
import { MultiSelect } from '../components/ui/multi-select';

// In the filters section:
{/* Lead Type */}
<div>
  <label className="text-sm font-medium mb-1 block">Lead Type</label>
  <MultiSelect
    options={[
      { label: 'Inbound', value: 'inbound' },
      { label: 'Outbound', value: 'outbound' }
    ]}
    selected={filters.lead_type}
    onChange={(v) => updateFilter('lead_type', v)}
    placeholder="All Types"
  />
</div>

{/* Lead Stage */}
<div>
  <label className="text-sm font-medium mb-1 block">Lead Stage</label>
  <MultiSelect
    options={[
      { label: 'Uncontacted', value: 'uncontacted' },
      { label: 'Reached Out', value: 'reached_out' },
      { label: 'In Talks', value: 'in_talks' },
      { label: 'Demo Booked', value: 'demo_booked' },
      { label: 'Rebook Demo', value: 'rebook_demo' },
      { label: 'Contract Sent', value: 'contract_sent' },
      { label: 'Closed Won', value: 'closed_won' },
      { label: 'Closed Lost', value: 'closed_lost' },
      { label: 'Reengaging', value: 'reengaging' }
    ]}
    selected={filters.lead_stage}
    onChange={(v) => updateFilter('lead_stage', v)}
    placeholder="All Stages"
  />
</div>

{/* Lead Warmth */}
<div>
  <label className="text-sm font-medium mb-1 block">Lead Warmth</label>
  <MultiSelect
    options={[
      { label: 'Frozen', value: 'frozen' },
      { label: 'Cold', value: 'cold' },
      { label: 'Warm', value: 'warm' },
      { label: 'Hot', value: 'hot' }
    ]}
    selected={filters.lead_warmth}
    onChange={(v) => updateFilter('lead_warmth', v)}
    placeholder="All Warmth"
  />
</div>

{/* Similar for lead_category and lead_status */}
```

### Files to Create/Modify

**Create:**
- `/UberEats-Image-Extractor/src/components/ui/multi-select.tsx` - New multi-select component

**Modify:**
- `/UberEats-Image-Extractor/src/pages/Restaurants.jsx` - Update filter state, logic, and UI

### Benefits

1. **Flexible Filtering:** View multiple lead stages/warmth levels simultaneously
2. **Better Analytics:** Analyze leads across multiple dimensions
3. **Improved UX:** Visual badges show selected filters at a glance
4. **URL Persistence:** Multi-select values saved in URL for sharing
5. **Efficient Workflow:** Sales team can quickly segment leads

### Implementation Priority
**Priority: MEDIUM** - Enhances filtering capabilities but doesn't block core functionality

---

## Problem 5: Task Status Quick-Change Issues

### Description
The Tasks page has two critical usability issues with task status management:

1. **Quick complete button shows on wrong tasks:** The quick-complete button (CheckCircle icon) appears only for tasks with status "pending", but should appear for "active" tasks instead. The "pending" status is reserved for future sequence automation where tasks depend on other tasks.

2. **Status icon is not interactive:** The status icon in the leftmost column is purely visual and cannot be clicked to change the task status. Users must use the edit modal to change status, which is inefficient.

### Root Cause Analysis

**Location:** [Tasks.tsx:120-131, 301-302, 353-362](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx)

#### Current Implementation Issues

**Issue 1: Quick Complete Button Condition (Lines 353-362):**
```tsx
<TableCell className="text-right">
  <div className="flex items-center justify-end gap-2">
    {task.status === 'pending' && (  // ❌ WRONG: Should be 'active'
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleCompleteTask(task.id)}
        className="text-green-600 hover:text-green-700"
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>
    )}
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setModals({ ...modals, edit: task.id })}
    >
      <Edit className="h-4 w-4" />
    </Button>
  </div>
</TableCell>
```

**Issue 2: Non-Interactive Status Icon (Lines 301-302):**
```tsx
<TableCell>
  {getStatusIcon(task.status)}  // ❌ Just displays icon, not clickable
</TableCell>
```

**Backend Context (tasks-service.js:150-154):**
```javascript
// Set default status to 'active' for manually created tasks
// 'pending' is reserved for tasks with dependencies that need to be resolved first
if (!taskData.status) {
  taskData.status = 'active';
}
```

#### Why This Is Wrong

1. **Pending vs Active:**
   - **Pending:** Future use for sequence tasks with dependencies (not yet implemented)
   - **Active:** Current tasks that need to be worked on (default for manual tasks)
   - Quick complete button should show for **active** tasks, not pending

2. **Poor UX:**
   - Users must click Edit → Change status → Save just to mark a task complete
   - Status icon provides no interaction despite being a natural click target

### Solution

Make the status icon interactive with a dropdown menu, and fix the quick-complete button condition.

#### UI Enhancement

**Interactive Status Icon with Dropdown:**
```
┌─────────────────────────────────┐
│ ● Active                   [▼]  │  ← Click the icon
├─────────────────────────────────┤
│ ○ Pending                       │
│ ● Active                    ✓   │  ← Currently selected
│ ✓ Completed                     │
│ ✗ Cancelled                     │
└─────────────────────────────────┘
```

#### Implementation Changes

**File:** [UberEats-Image-Extractor/src/pages/Tasks.tsx](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx)

**1. Add Status Change Handler:**

```tsx
const handleStatusChange = async (taskId: string, newStatus: string) => {
  try {
    // Use the specific endpoint for complete/cancel, or general update for others
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
```

**2. Create Interactive Status Icon Component:**

```tsx
const getInteractiveStatusIcon = (task: any) => {
  const statusOptions = [
    {
      value: 'pending',
      label: 'Pending',
      icon: <Circle className="h-4 w-4 text-gray-400" />,
      description: 'Waiting on dependencies'
    },
    {
      value: 'active',
      label: 'Active',
      icon: <Circle className="h-4 w-4 text-blue-600" />,
      description: 'Currently working on'
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      description: 'Task finished'
    },
    {
      value: 'cancelled',
      label: 'Cancelled',
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      description: 'Task cancelled'
    }
  ];

  const currentStatus = statusOptions.find(s => s.value === task.status);

  return (
    <Select
      value={task.status}
      onValueChange={(v) => handleStatusChange(task.id, v)}
    >
      <SelectTrigger className="h-8 w-8 border-0 bg-transparent p-0 hover:bg-muted/50 rounded-full">
        {currentStatus?.icon || <Circle className="h-5 w-5 text-gray-400" />}
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <div className="flex items-center gap-2">
              {status.icon}
              <div>
                <div className="font-medium">{status.label}</div>
                <div className="text-xs text-muted-foreground">
                  {status.description}
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

**3. Update Table Row to Use Interactive Icon:**

```tsx
<TableRow key={task.id} className={task.status === 'completed' ? 'opacity-60' : ''}>
  <TableCell>
    {getInteractiveStatusIcon(task)}  {/* ✅ Now clickable */}
  </TableCell>
  {/* ... rest of the row ... */}
</TableRow>
```

**4. Fix Quick Complete Button Condition:**

```tsx
<TableCell className="text-right">
  <div className="flex items-center justify-end gap-2">
    {task.status === 'active' && (  // ✅ FIXED: Now shows for active tasks
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleCompleteTask(task.id)}
        className="text-green-600 hover:text-green-700"
        title="Mark as complete"
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>
    )}
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setModals({ ...modals, edit: task.id })}
      title="Edit task"
    >
      <Edit className="h-4 w-4" />
    </Button>
  </div>
</TableCell>
```

**5. Add Visual Feedback:**

```tsx
// Add a tooltip or badge to indicate active tasks can be quickly completed
{task.status === 'active' && (
  <Badge variant="outline" className="ml-2 text-xs">
    In Progress
  </Badge>
)}
```

### Alternative: Status Badge Instead of Icon

If dropdown on icon is too subtle, consider using a clickable badge:

```tsx
const getStatusBadge = (task: any) => {
  const statusConfig = {
    pending: { color: 'bg-gray-100 text-gray-800', label: 'Pending' },
    active: { color: 'bg-blue-100 text-blue-800', label: 'Active' },
    completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
    cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' }
  };

  const config = statusConfig[task.status] || statusConfig.pending;

  return (
    <Select
      value={task.status}
      onValueChange={(v) => handleStatusChange(task.id, v)}
    >
      <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
        <Badge
          variant="outline"
          className={cn('cursor-pointer hover:opacity-80', config.color)}
        >
          {config.label}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        {/* Same options as above */}
      </SelectContent>
    </Select>
  );
};
```

### Files to Modify
- [UberEats-Image-Extractor/src/pages/Tasks.tsx](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx)

### Benefits

1. **Faster Status Updates:** Single click to change status from any value to any other
2. **Better Visual Feedback:** Status is prominent and clearly interactive
3. **Correct Workflow:** Quick complete works for active tasks (the intended use case)
4. **Future-Proof:** Pending status remains available for sequence dependencies
5. **Reduced Clicks:** No need to open edit modal just to change status

### Testing Requirements

1. **Status Transitions:**
   - Verify all status transitions work (pending → active, active → completed, etc.)
   - Test that backend endpoints are called correctly
   - Verify task list refreshes after status change

2. **Quick Complete:**
   - Verify button only shows for active tasks
   - Test that clicking completes the task
   - Verify completed tasks show with reduced opacity

3. **Icon Dropdown:**
   - Test that dropdown opens on click
   - Verify correct icon displays for each status
   - Test keyboard navigation in dropdown

4. **Edge Cases:**
   - Test with tasks that have no status set
   - Test concurrent status changes
   - Verify optimistic updates work correctly

### Implementation Priority
**Priority: MEDIUM** - Improves UX significantly but existing edit modal provides workaround

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
**Goal:** Fix critical bugs that block current functionality

#### Task 1.1: Fix {cuisine} Variable Preview
- **Effort:** 1 hour
- **Files:** `CreateMessageTemplateModal.tsx`
- **Changes:** Update variable mapping function
- **Testing:** Create test cases for array/string/null cuisine values

#### Task 1.2: Add Message Template Selector to Task Creation
- **Effort:** 4 hours
- **Files:** `CreateTaskModal.tsx`
- **Changes:** Add template selector, filtering, auto-population
- **Testing:** Test template selection and message population

#### Task 1.3: Fix Task Status Quick-Change Issues
- **Effort:** 3 hours
- **Files:** `Tasks.tsx`
- **Changes:**
  - Change quick-complete button condition from `pending` to `active`
  - Add interactive status icon with dropdown
  - Add status change handler
- **Testing:** Test all status transitions, verify quick-complete works for active tasks

**Deliverables:**
- ✅ Cuisine variable works in all preview scenarios
- ✅ Users can select message templates when creating tasks
- ✅ Task status can be changed from grid view
- ✅ Quick-complete button shows on active tasks
- ✅ All tests pass

---

### Phase 2: Task Template Management UI (3-4 days)
**Goal:** Complete the task template management interface

#### Task 2.1: Create TaskTemplates Page Component
- **Effort:** 6 hours
- **File:** Create `src/pages/TaskTemplates.tsx`
- **Features:**
  - List view with table
  - Filters (type, active status)
  - Sort by name, created date, usage count
  - Delete confirmation
  - Usage statistics display

#### Task 2.2: Create Task Template Modals
- **Effort:** 6 hours
- **Files:**
  - Create `src/components/task-templates/CreateTaskTemplateModal.tsx`
  - Create `src/components/task-templates/TaskTemplateDetailModal.tsx`
- **Features:**
  - Full CRUD operations
  - Message template association
  - Default message fallback
  - Preview functionality

#### Task 2.3: Add Routing and Navigation
- **Effort:** 1 hour
- **Files:**
  - Modify `src/App.tsx`
  - Update navigation component
- **Changes:**
  - Add `/task-templates` route
  - Add navigation link in sidebar
  - Update breadcrumbs

#### Task 2.4: Integration Testing
- **Effort:** 3 hours
- **Activities:**
  - Test template CRUD operations
  - Test message template association
  - Test usage statistics
  - Test filter and sort
  - Test delete protection (when template is in use)

**Deliverables:**
- ✅ Complete task template management UI
- ✅ Users can create, edit, delete task templates
- ✅ Message template association works
- ✅ Usage statistics are accurate
- ✅ All integration tests pass

---

### Phase 2.5: Multi-Select Filters (2-3 days)
**Goal:** Enable multi-select filtering on Restaurants page

#### Task 2.5.1: Create Multi-Select Component
- **Effort:** 4 hours
- **File:** Create `src/components/ui/multi-select.tsx`
- **Features:**
  - Checkbox-based dropdown
  - Badge display for selected items
  - Clear all functionality
  - Search within options
  - Keyboard navigation

#### Task 2.5.2: Update Restaurants Page Filter State
- **Effort:** 3 hours
- **File:** Modify `src/pages/Restaurants.jsx`
- **Changes:**
  - Convert filter state from single values to arrays
  - Update filter logic to use `.includes()`
  - Update URL param handling for comma-separated values
  - Update `hasActiveFilters()` and `getActiveFiltersCount()`

#### Task 2.5.3: Update Filter UI
- **Effort:** 3 hours
- **File:** `src/pages/Restaurants.jsx`
- **Changes:**
  - Replace single-select dropdowns with MultiSelect component
  - Update all filter fields (lead_type, lead_category, lead_warmth, lead_stage, lead_status)
  - Add visual indicators for multi-selection
  - Test filter combinations

#### Task 2.5.4: Testing & Edge Cases
- **Effort:** 2 hours
- **Activities:**
  - Test multiple selections across different filters
  - Test URL persistence and sharing
  - Test filter clearing
  - Test performance with large datasets
  - Test edge cases (empty selections, all selected, etc.)

**Deliverables:**
- ✅ Multi-select component working
- ✅ All filters support multiple selections
- ✅ URL persistence works with multi-select
- ✅ Filter combinations work correctly
- ✅ Performance is acceptable

---

### Phase 3: Polish and Documentation (1 day)
**Goal:** Ensure quality and usability

#### Task 3.1: UI/UX Improvements
- **Effort:** 2 hours
- **Activities:**
  - Consistent styling across all modals
  - Loading states and error handling
  - Empty states with helpful messages
  - Tooltips and help text

#### Task 3.2: Error Handling
- **Effort:** 2 hours
- **Activities:**
  - Validation messages
  - API error handling
  - User-friendly error messages
  - Retry logic for failed requests

#### Task 3.3: Documentation
- **Effort:** 2 hours
- **Deliverables:**
  - Update user guide
  - Add tooltips for complex features
  - Create quick start guide
  - Document variable system

**Deliverables:**
- ✅ Polished, production-ready UI
- ✅ Comprehensive error handling
- ✅ User documentation complete

---

## Testing Strategy

### Unit Tests

#### Frontend Tests
```typescript
// CreateMessageTemplateModal.test.tsx
describe('CreateMessageTemplateModal - Variable Preview', () => {
  test('renders cuisine from array', () => {
    const restaurant = { cuisine: ['Italian', 'Pizza'] };
    expect(renderPreview(restaurant)).toContain('Italian, Pizza');
  });

  test('renders cuisine from string', () => {
    const restaurant = { cuisine: 'Italian' };
    expect(renderPreview(restaurant)).toContain('Italian');
  });

  test('handles null cuisine', () => {
    const restaurant = { cuisine: null };
    expect(renderPreview(restaurant)).not.toThrow();
  });
});

// CreateTaskModal.test.tsx
describe('CreateTaskModal - Message Template Integration', () => {
  test('filters message templates by task type', () => {
    const templates = [
      { type: 'email', name: 'Email Template' },
      { type: 'social_message', name: 'Social Template' }
    ];
    const filtered = filterTemplatesByType(templates, 'email');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Email Template');
  });

  test('populates message when template selected', async () => {
    const template = {
      id: '123',
      message_content: 'Hi {contact_name}'
    };
    await selectTemplate(template.id);
    expect(formData.message).toBe('Hi {contact_name}');
  });
});
```

### Integration Tests

#### Test Scenarios

**1. Full Task Creation Workflow**
```
Given: User is on Tasks page
When: User clicks "New Task"
And: Selects type "email"
And: Selects message template "Demo Follow-up"
And: Selects restaurant "Bella Pizza"
Then: Message field auto-populates with template content
And: Variables are highlighted
When: User clicks "Create Task"
Then: Task is created with message_template_id
And: message_rendered field contains replaced variables
And: Task appears in task list
```

**2. Task Template Management**
```
Given: User is on Task Templates page
When: User clicks "New Template"
And: Fills in template details
And: Selects message template "Cold Outreach"
And: Clicks "Create Template"
Then: Template is created
And: Message template association is saved
When: User creates task using this template
Then: Task inherits message template
And: Template usage_count increments
```

**3. Multi-Select Filtering**
```
Given: User is on Restaurants page
When: User opens "Lead Stage" filter
And: Selects "Demo Booked"
And: Selects "Contract Sent"
And: Selects "In Talks"
Then: Filter shows "3 selected"
When: Filter is applied
Then: Table shows only restaurants with those 3 stages
And: URL contains "lead_stage=demo_booked,contract_sent,in_talks"
When: User opens "Lead Warmth" filter
And: Selects "Warm" and "Hot"
Then: Table shows restaurants that match (Demo Booked OR Contract Sent OR In Talks) AND (Warm OR Hot)
```

**4. Task Status Quick Change**
```
Given: User is on Tasks page
And: Task has status "active"
When: User clicks on the status icon
Then: Dropdown shows all status options
When: User selects "Completed"
Then: Task status updates to completed
And: Task opacity reduces to 60%
And: Quick-complete button disappears
When: User clicks quick-complete button on active task
Then: Task status changes to completed directly
```

**3. Variable Replacement**
```
Given: Restaurant has cuisine = ['Italian', 'Pizza']
When: User creates message template with "{cuisine}"
And: Previews with that restaurant
Then: Preview shows "Italian, Pizza"
When: User creates task with this template
And: Task is rendered
Then: message_rendered shows "Italian, Pizza"
```

### Manual Testing Checklist

**Before Release:**
- [ ] Create message template with {cuisine} variable
- [ ] Test preview with restaurant having array cuisine
- [ ] Test preview with restaurant having string cuisine
- [ ] Test preview with restaurant having null cuisine
- [ ] Create task template with message template association
- [ ] Create task from task template
- [ ] Verify message template is applied
- [ ] Create task manually and select message template
- [ ] Verify template filtering by task type
- [ ] Edit task template and verify changes propagate
- [ ] Delete task template (should fail if used)
- [ ] Verify usage statistics are accurate
- [ ] Test all filters and sorting on task templates page

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Database migration issues | Low | High | All migrations already applied successfully |
| API breaking changes | Low | Medium | Backend API is stable and tested |
| Frontend state management bugs | Medium | Medium | Comprehensive testing, use React Query for caching |
| User confusion with new UI | Medium | Low | Clear tooltips, documentation, consistent patterns |
| Performance issues with large datasets | Low | Medium | Implement pagination, optimize queries |

---

## Success Criteria

### Phase 1 Success Metrics
- ✅ {cuisine} variable preview works in 100% of test cases
- ✅ Message template selector reduces task creation time by 50%
- ✅ Zero regression bugs in existing functionality

### Phase 2 Success Metrics
- ✅ Users can create task templates without backend API calls
- ✅ Task template usage count is accurate
- ✅ 100% feature parity with message templates page

### Phase 3 Success Metrics
- ✅ User satisfaction score > 8/10
- ✅ Zero critical bugs in production
- ✅ Documentation covers all new features

---

## Appendix

### Related Files

**Backend Services:**
- [variable-replacement-service.js](../../../UberEats-Image-Extractor/src/services/variable-replacement-service.js)
- [tasks-service.js](../../../UberEats-Image-Extractor/src/services/tasks-service.js)
- [task-templates-service.js](../../../UberEats-Image-Extractor/src/services/task-templates-service.js)
- [message-templates-service.js](../../../UberEats-Image-Extractor/src/services/message-templates-service.js)

**Backend Routes:**
- [tasks-routes.js](../../../UberEats-Image-Extractor/src/routes/tasks-routes.js)
- [task-templates-routes.js](../../../UberEats-Image-Extractor/src/routes/task-templates-routes.js)
- [message-templates-routes.js](../../../UberEats-Image-Extractor/src/routes/message-templates-routes.js)

**Frontend Pages:**
- [Tasks.tsx](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx)
- [MessageTemplates.tsx](../../../UberEats-Image-Extractor/src/pages/MessageTemplates.tsx)

**Frontend Components:**
- [CreateTaskModal.tsx](../../../UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx)
- [CreateMessageTemplateModal.tsx](../../../UberEats-Image-Extractor/src/components/message-templates/CreateMessageTemplateModal.tsx)

### Database Schema

**Task Templates Table:**
```sql
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  message_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('internal_activity', 'social_message', 'text', 'email', 'call')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  default_message TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Message Templates Table:**
```sql
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('social_message', 'text', 'email')),
  message_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  available_variables JSONB DEFAULT '[]'::jsonb,
  preview_data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

**End of Problem Analysis Document**
