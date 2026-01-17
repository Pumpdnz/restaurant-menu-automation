# Task Sequence System - Service Layer

**Version:** 1.0
**Last Updated:** 2025-01-17

---

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [sequence-templates-service.js](#sequence-templates-servicejs)
4. [sequence-instances-service.js](#sequence-instances-servicejs)
5. [sequence-progression-service.js](#sequence-progression-servicejs)
6. [tasks-service.js Modifications](#tasks-servicejs-modifications)
7. [Error Handling](#error-handling)
8. [Transaction Management](#transaction-management)
9. [Testing Guidelines](#testing-guidelines)

---

## Overview

The service layer implements the business logic for the task sequence system. It sits between the API routes and the database, handling:

- Data validation and transformation
- Business rule enforcement
- Transaction management
- Error handling and logging

### New Services

1. **sequence-templates-service.js** - Template CRUD and step management
2. **sequence-instances-service.js** - Instance lifecycle management
3. **sequence-progression-service.js** - Automatic task progression logic

### Modified Services

4. **tasks-service.js** - Enhanced with sequence hooks

---

## Service Architecture

### Dependency Graph

```
API Routes
    ↓
sequence-templates-service.js
    ↓
database-service.js (Supabase)

API Routes
    ↓
sequence-instances-service.js
    ├→ database-service.js
    ├→ tasks-service.js
    └→ variable-replacement-service.js

tasks-service.js (completeTask)
    ↓
sequence-progression-service.js
    ├→ database-service.js
    └→ tasks-service.js (minimal, to avoid circular dependency)
```

### Service Responsibilities

| Service | Primary Responsibility | Lines of Code (Est.) |
|---------|------------------------|----------------------|
| sequence-templates-service.js | Template CRUD, step management | ~400 |
| sequence-instances-service.js | Start/pause/cancel sequences | ~500 |
| sequence-progression-service.js | Auto-activate next tasks | ~300 |
| tasks-service.js (modifications) | Sequence completion hooks | +50 |

---

## sequence-templates-service.js

**File Path:** `UberEats-Image-Extractor/src/services/sequence-templates-service.js`

### Purpose

Manage sequence template lifecycle including creating, reading, updating, and deleting templates and their steps.

### Dependencies

```javascript
const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
```

### Function Specifications

#### listSequenceTemplates(filters)

**Purpose:** Retrieve all sequence templates for current organization

**Parameters:**
```javascript
filters = {
  is_active: boolean,        // Optional: filter by active status
  tags: string[],            // Optional: filter by tags
  search: string             // Optional: search in name/description
}
```

**Returns:** `Promise<Array<SequenceTemplate>>`

**Implementation:**
```javascript
async function listSequenceTemplates(filters = {}) {
  let query = getSupabaseClient()
    .from('sequence_templates')
    .select(`
      *,
      sequence_steps (
        id, step_order, name, type, delay_value, delay_unit
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing sequence templates:', error);
    throw error;
  }

  // Sort steps by step_order for each template
  return data.map(template => ({
    ...template,
    sequence_steps: template.sequence_steps.sort((a, b) => a.step_order - b.step_order)
  }));
}
```

---

#### getSequenceTemplateById(id)

**Purpose:** Get a single template with all steps

**Parameters:**
- `id` (UUID): Template ID

**Returns:** `Promise<SequenceTemplate>`

**Implementation:**
```javascript
async function getSequenceTemplateById(id) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_templates')
    .select(`
      *,
      sequence_steps (
        *,
        task_templates (id, name, type),
        message_templates (id, name, type)
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Sequence template not found');
    }
    console.error('Error getting sequence template:', error);
    throw error;
  }

  // Sort steps by step_order
  data.sequence_steps = data.sequence_steps.sort((a, b) => a.step_order - b.step_order);

  return data;
}
```

---

#### createSequenceTemplate(templateData, steps)

**Purpose:** Create a new sequence template with steps in a transaction

**Parameters:**
```javascript
templateData = {
  name: string,              // Required: 3-100 chars
  description: string,       // Optional: max 1000 chars
  tags: string[],           // Optional: array of tags
  created_by: uuid          // Optional: creator user ID
}

steps = [
  {
    step_order: number,      // Required: 1, 2, 3, etc.
    name: string,            // Required: step name
    description: string,     // Optional
    task_template_id: uuid,  // Optional: reference to task template
    type: string,            // Required: task type
    priority: string,        // Optional: defaults to 'medium'
    message_template_id: uuid, // Optional
    custom_message: string,  // Optional
    delay_value: number,     // Required: delay amount
    delay_unit: string       // Required: 'minutes'|'hours'|'days'
  }
]
```

**Returns:** `Promise<SequenceTemplate>`

**Validation:**
- Name: 3-100 characters
- Steps: At least 1 step, max 50 steps
- Step orders: Must be sequential (1, 2, 3...) with no gaps
- First step: Typically has delay_value = 0
- Delay values: >= 0

**Implementation:**
```javascript
async function createSequenceTemplate(templateData, steps) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Validation
  if (!templateData.name || templateData.name.length < 3) {
    throw new Error('Template name must be at least 3 characters');
  }

  if (!steps || steps.length === 0) {
    throw new Error('Template must have at least one step');
  }

  if (steps.length > 50) {
    throw new Error('Template cannot have more than 50 steps');
  }

  // Validate step orders are sequential
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  for (let i = 0; i < sortedSteps.length; i++) {
    if (sortedSteps[i].step_order !== i + 1) {
      throw new Error(`Step orders must be sequential. Expected ${i + 1}, got ${sortedSteps[i].step_order}`);
    }
  }

  try {
    // Start transaction by creating template first
    const { data: template, error: templateError } = await client
      .from('sequence_templates')
      .insert({
        ...templateData,
        organisation_id: orgId
      })
      .select()
      .single();

    if (templateError) {
      console.error('Error creating template:', templateError);
      throw templateError;
    }

    // Insert all steps
    const stepsToInsert = steps.map(step => ({
      ...step,
      sequence_template_id: template.id
    }));

    const { data: createdSteps, error: stepsError } = await client
      .from('sequence_steps')
      .insert(stepsToInsert)
      .select();

    if (stepsError) {
      // Rollback: delete the template
      await client.from('sequence_templates').delete().eq('id', template.id);
      console.error('Error creating steps:', stepsError);
      throw stepsError;
    }

    // Return template with steps
    return {
      ...template,
      sequence_steps: createdSteps.sort((a, b) => a.step_order - b.step_order)
    };
  } catch (error) {
    console.error('Error in createSequenceTemplate:', error);
    throw error;
  }
}
```

---

#### updateSequenceTemplate(id, updates)

**Purpose:** Update template metadata (not steps)

**Parameters:**
```javascript
id = uuid
updates = {
  name: string,
  description: string,
  tags: string[],
  is_active: boolean
}
```

**Returns:** `Promise<SequenceTemplate>`

**Implementation:**
```javascript
async function updateSequenceTemplate(id, updates) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_templates')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error updating sequence template:', error);
    throw error;
  }

  return data;
}
```

**Note:** Updating a template does NOT affect existing active sequences (snapshot approach).

---

#### deleteSequenceTemplate(id)

**Purpose:** Delete a template (with safety checks)

**Parameters:**
- `id` (UUID): Template ID

**Returns:** `Promise<void>`

**Safety Checks:**
1. Check for active sequence instances
2. Warn if completed instances exist

**Implementation:**
```javascript
async function deleteSequenceTemplate(id) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Check for active instances
  const { count: activeCount, error: countError } = await client
    .from('sequence_instances')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_template_id', id)
    .eq('status', 'active');

  if (countError) {
    console.error('Error checking active instances:', countError);
    throw countError;
  }

  if (activeCount > 0) {
    throw new Error(
      `Cannot delete template. ${activeCount} active sequence(s) are using this template. ` +
      `Please cancel or complete them first, or deactivate the template instead.`
    );
  }

  // Proceed with deletion (cascade will handle steps and completed instances)
  const { error } = await client
    .from('sequence_templates')
    .delete()
    .eq('id', id)
    .eq('organisation_id', orgId);

  if (error) {
    console.error('Error deleting sequence template:', error);
    throw error;
  }
}
```

---

#### updateStep(stepId, updates)

**Purpose:** Update a single step

**Parameters:**
```javascript
stepId = uuid
updates = {
  name: string,
  description: string,
  type: string,
  priority: string,
  task_template_id: uuid,
  message_template_id: uuid,
  custom_message: string,
  delay_value: number,
  delay_unit: string
}
```

**Returns:** `Promise<SequenceStep>`

**Implementation:**
```javascript
async function updateStep(stepId, updates) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_steps')
    .update(updates)
    .eq('id', stepId)
    .select()
    .single();

  if (error) {
    console.error('Error updating sequence step:', error);
    throw error;
  }

  return data;
}
```

---

#### deleteStep(stepId)

**Purpose:** Delete a step and reorder remaining steps

**Parameters:**
- `stepId` (UUID): Step ID

**Returns:** `Promise<void>`

**Implementation:**
```javascript
async function deleteStep(stepId) {
  const client = getSupabaseClient();

  // Get the step to find its order and template
  const { data: step, error: fetchError } = await client
    .from('sequence_steps')
    .select('sequence_template_id, step_order')
    .eq('id', stepId)
    .single();

  if (fetchError) {
    console.error('Error fetching step:', fetchError);
    throw fetchError;
  }

  // Delete the step
  const { error: deleteError } = await client
    .from('sequence_steps')
    .delete()
    .eq('id', stepId);

  if (deleteError) {
    console.error('Error deleting step:', deleteError);
    throw deleteError;
  }

  // Reorder remaining steps
  const { data: remainingSteps, error: selectError } = await client
    .from('sequence_steps')
    .select('id, step_order')
    .eq('sequence_template_id', step.sequence_template_id)
    .gt('step_order', step.step_order)
    .order('step_order');

  if (selectError) {
    console.error('Error fetching remaining steps:', selectError);
    throw selectError;
  }

  // Update step orders
  for (const remainingStep of remainingSteps) {
    await client
      .from('sequence_steps')
      .update({ step_order: remainingStep.step_order - 1 })
      .eq('id', remainingStep.id);
  }
}
```

---

#### reorderSteps(templateId, newOrder)

**Purpose:** Reorder steps within a template

**Parameters:**
```javascript
templateId = uuid
newOrder = [
  { id: uuid, step_order: number },
  { id: uuid, step_order: number },
  ...
]
```

**Returns:** `Promise<Array<SequenceStep>>`

**Implementation:**
```javascript
async function reorderSteps(templateId, newOrder) {
  const client = getSupabaseClient();

  // Validate that all steps belong to this template
  const { data: existingSteps, error: fetchError } = await client
    .from('sequence_steps')
    .select('id')
    .eq('sequence_template_id', templateId);

  if (fetchError) {
    console.error('Error fetching steps:', fetchError);
    throw fetchError;
  }

  const existingStepIds = new Set(existingSteps.map(s => s.id));
  const newOrderIds = new Set(newOrder.map(s => s.id));

  if (existingStepIds.size !== newOrderIds.size) {
    throw new Error('Step count mismatch');
  }

  // Update each step's order
  const updatePromises = newOrder.map(({ id, step_order }) =>
    client
      .from('sequence_steps')
      .update({ step_order })
      .eq('id', id)
  );

  await Promise.all(updatePromises);

  // Return updated steps
  return getSequenceTemplateById(templateId).then(t => t.sequence_steps);
}
```

---

#### duplicateSequenceTemplate(id, newName)

**Purpose:** Create a copy of an existing template

**Parameters:**
- `id` (UUID): Template ID to duplicate
- `newName` (string): Optional new name (defaults to "Copy of {original name}")

**Returns:** `Promise<SequenceTemplate>`

**Implementation:**
```javascript
async function duplicateSequenceTemplate(id, newName) {
  const original = await getSequenceTemplateById(id);

  const duplicateData = {
    name: newName || `Copy of ${original.name}`,
    description: original.description,
    tags: original.tags,
    created_by: original.created_by,
    is_active: true // New template starts active
  };

  const steps = original.sequence_steps.map(step => ({
    step_order: step.step_order,
    name: step.name,
    description: step.description,
    task_template_id: step.task_template_id,
    type: step.type,
    priority: step.priority,
    message_template_id: step.message_template_id,
    custom_message: step.custom_message,
    delay_value: step.delay_value,
    delay_unit: step.delay_unit
  }));

  return createSequenceTemplate(duplicateData, steps);
}
```

---

#### toggleActive(id, isActive)

**Purpose:** Activate or deactivate a template

**Parameters:**
- `id` (UUID): Template ID
- `isActive` (boolean): New active status

**Returns:** `Promise<SequenceTemplate>`

**Implementation:**
```javascript
async function toggleActive(id, isActive) {
  return updateSequenceTemplate(id, { is_active: isActive });
}
```

---

### Module Exports

```javascript
module.exports = {
  listSequenceTemplates,
  getSequenceTemplateById,
  createSequenceTemplate,
  updateSequenceTemplate,
  deleteSequenceTemplate,
  updateStep,
  deleteStep,
  reorderSteps,
  duplicateSequenceTemplate,
  toggleActive
};
```

---

## sequence-instances-service.js

**File Path:** `UberEats-Image-Extractor/src/services/sequence-instances-service.js`

### Purpose

Manage sequence instance lifecycle: starting, pausing, resuming, and cancelling sequences.

### Dependencies

```javascript
const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
const { createTask } = require('./tasks-service');
const variableReplacementService = require('./variable-replacement-service');
const { getSequenceTemplateById } = require('./sequence-templates-service');
```

### Function Specifications

#### startSequence(templateId, restaurantId, options)

**Purpose:** Start a new sequence for a restaurant (creates instance + all tasks)

**Parameters:**
```javascript
templateId = uuid
restaurantId = uuid
options = {
  assigned_to: uuid,      // Optional: defaults to current user
  created_by: uuid        // Optional: current user
}
```

**Returns:** `Promise<SequenceInstance>`

**Process:**
1. Fetch template with steps
2. Fetch restaurant data (for variable replacement)
3. Create sequence instance
4. Create all tasks (first active, others pending)
5. Update template usage_count

**Implementation:**
```javascript
async function startSequence(templateId, restaurantId, options = {}) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  try {
    // 1. Fetch template with steps
    const template = await getSequenceTemplateById(templateId);

    if (!template.is_active) {
      throw new Error('Cannot start sequence from inactive template');
    }

    if (!template.sequence_steps || template.sequence_steps.length === 0) {
      throw new Error('Template has no steps');
    }

    // 2. Check for duplicate active sequence
    const { count: existingCount } = await client
      .from('sequence_instances')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_template_id', templateId)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'active');

    if (existingCount > 0) {
      throw new Error('An active sequence already exists for this restaurant using this template');
    }

    // 3. Fetch restaurant data
    const { data: restaurant, error: restaurantError } = await client
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError) {
      console.error('Error fetching restaurant:', restaurantError);
      throw new Error('Restaurant not found');
    }

    // 4. Create sequence instance
    const instanceName = `${template.name} - ${restaurant.name} - ${new Date().toISOString().split('T')[0]}`;

    const { data: instance, error: instanceError } = await client
      .from('sequence_instances')
      .insert({
        sequence_template_id: templateId,
        restaurant_id: restaurantId,
        organisation_id: orgId,
        name: instanceName,
        status: 'active',
        current_step_order: 1,
        total_steps: template.sequence_steps.length,
        assigned_to: options.assigned_to || options.created_by,
        created_by: options.created_by
      })
      .select()
      .single();

    if (instanceError) {
      console.error('Error creating sequence instance:', instanceError);
      throw instanceError;
    }

    // 5. Create all tasks
    const tasksToCreate = [];
    const now = new Date();

    for (const step of template.sequence_steps) {
      let message = step.custom_message;

      // Get message from template if referenced
      if (step.message_template_id && step.message_templates) {
        message = step.message_templates.message_content;
      } else if (step.task_template_id && step.task_templates && !message) {
        // Use task template's default message if no custom message
        message = step.task_templates.default_message;
      }

      // Render message with variables
      let messageRendered = null;
      if (message) {
        messageRendered = await variableReplacementService.replaceVariables(message, restaurant);
      }

      // Calculate due_date for first step
      let dueDate = null;
      let status = 'pending';

      if (step.step_order === 1) {
        status = 'active';
        // Calculate due date based on first step delay
        dueDate = calculateDueDate(now, step.delay_value, step.delay_unit);
      }

      const taskData = {
        organisation_id: orgId,
        restaurant_id: restaurantId,
        sequence_instance_id: instance.id,
        sequence_step_order: step.step_order,
        task_template_id: step.task_template_id,
        message_template_id: step.message_template_id,
        assigned_to: options.assigned_to || options.created_by,
        created_by: options.created_by,
        name: step.name,
        description: step.description,
        status: status,
        type: step.type,
        priority: step.priority,
        message: message,
        message_rendered: messageRendered,
        due_date: dueDate
      };

      tasksToCreate.push(taskData);
    }

    // Batch insert tasks
    const { data: createdTasks, error: tasksError } = await client
      .from('tasks')
      .insert(tasksToCreate)
      .select();

    if (tasksError) {
      // Rollback: delete instance
      await client.from('sequence_instances').delete().eq('id', instance.id);
      console.error('Error creating tasks:', tasksError);
      throw tasksError;
    }

    // 6. Update template usage_count
    await client
      .from('sequence_templates')
      .update({ usage_count: (template.usage_count || 0) + 1 })
      .eq('id', templateId);

    // Return instance with created tasks
    return {
      ...instance,
      tasks: createdTasks,
      tasks_created: createdTasks.length
    };
  } catch (error) {
    console.error('Error in startSequence:', error);
    throw error;
  }
}

// Helper function to calculate due date
function calculateDueDate(fromDate, delayValue, delayUnit) {
  const date = new Date(fromDate);

  switch(delayUnit) {
    case 'minutes':
      date.setMinutes(date.getMinutes() + delayValue);
      break;
    case 'hours':
      date.setHours(date.getHours() + delayValue);
      break;
    case 'days':
      date.setDate(date.getDate() + delayValue);
      break;
    default:
      throw new Error(`Invalid delay_unit: ${delayUnit}`);
  }

  return date.toISOString();
}
```

---

#### getSequenceInstance(id)

**Purpose:** Get sequence instance with progress details

**Parameters:**
- `id` (UUID): Instance ID

**Returns:** `Promise<SequenceInstance>`

**Implementation:**
```javascript
async function getSequenceInstance(id) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_instances')
    .select(`
      *,
      sequence_templates (id, name),
      restaurants (id, name),
      tasks (
        id, name, status, due_date, sequence_step_order,
        completed_at, created_at
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Sequence instance not found');
    }
    console.error('Error getting sequence instance:', error);
    throw error;
  }

  // Sort tasks by step_order
  if (data.tasks) {
    data.tasks = data.tasks.sort((a, b) => a.sequence_step_order - b.sequence_step_order);
  }

  // Calculate progress
  const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
  data.progress = {
    completed: completedTasks,
    total: data.total_steps,
    percentage: Math.round((completedTasks / data.total_steps) * 100)
  };

  return data;
}
```

---

#### listSequenceInstances(filters)

**Purpose:** List sequence instances with filtering

**Parameters:**
```javascript
filters = {
  restaurant_id: uuid,
  status: string,
  assigned_to: uuid
}
```

**Returns:** `Promise<Array<SequenceInstance>>`

**Implementation:**
```javascript
async function listSequenceInstances(filters = {}) {
  let query = getSupabaseClient()
    .from('sequence_instances')
    .select(`
      *,
      sequence_templates (id, name),
      restaurants (id, name),
      tasks (id, status)
    `)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.restaurant_id) {
    query = query.eq('restaurant_id', filters.restaurant_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing sequence instances:', error);
    throw error;
  }

  // Add progress to each instance
  return data.map(instance => {
    const completedTasks = instance.tasks.filter(t => t.status === 'completed').length;
    return {
      ...instance,
      progress: {
        completed: completedTasks,
        total: instance.total_steps,
        percentage: Math.round((completedTasks / instance.total_steps) * 100)
      }
    };
  });
}
```

---

#### pauseSequence(instanceId)

**Purpose:** Pause an active sequence

**Parameters:**
- `instanceId` (UUID): Instance ID

**Returns:** `Promise<SequenceInstance>`

**Implementation:**
```javascript
async function pauseSequence(instanceId) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_instances')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString()
    })
    .eq('id', instanceId)
    .eq('organisation_id', getCurrentOrganizationId())
    .eq('status', 'active') // Only pause if currently active
    .select()
    .single();

  if (error) {
    console.error('Error pausing sequence:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Sequence not found or not active');
  }

  return data;
}
```

---

#### resumeSequence(instanceId)

**Purpose:** Resume a paused sequence

**Parameters:**
- `instanceId` (UUID): Instance ID

**Returns:** `Promise<SequenceInstance>`

**Implementation:**
```javascript
async function resumeSequence(instanceId) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_instances')
    .update({
      status: 'active',
      paused_at: null
    })
    .eq('id', instanceId)
    .eq('organisation_id', getCurrentOrganizationId())
    .eq('status', 'paused') // Only resume if currently paused
    .select()
    .single();

  if (error) {
    console.error('Error resuming sequence:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Sequence not found or not paused');
  }

  return data;
}
```

---

#### cancelSequence(instanceId)

**Purpose:** Cancel a sequence and delete pending tasks

**Parameters:**
- `instanceId` (UUID): Instance ID

**Returns:** `Promise<SequenceInstance>`

**Process:**
1. Update instance status to 'cancelled'
2. Delete all pending tasks
3. Leave active, completed, and cancelled tasks

**Implementation:**
```javascript
async function cancelSequence(instanceId) {
  const client = getSupabaseClient();

  try {
    // Update instance status
    const { data: instance, error: updateError } = await client
      .from('sequence_instances')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .eq('organisation_id', getCurrentOrganizationId())
      .in('status', ['active', 'paused']) // Only cancel if active or paused
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling sequence:', updateError);
      throw updateError;
    }

    if (!instance) {
      throw new Error('Sequence not found or already completed/cancelled');
    }

    // Delete pending tasks
    const { error: deleteError } = await client
      .from('tasks')
      .delete()
      .eq('sequence_instance_id', instanceId)
      .eq('status', 'pending');

    if (deleteError) {
      console.error('Error deleting pending tasks:', deleteError);
      // Don't throw - instance is already cancelled
    }

    return instance;
  } catch (error) {
    console.error('Error in cancelSequence:', error);
    throw error;
  }
}
```

---

#### getRestaurantSequences(restaurantId)

**Purpose:** Get all sequences for a restaurant

**Parameters:**
- `restaurantId` (UUID): Restaurant ID

**Returns:** `Promise<Array<SequenceInstance>>`

**Implementation:**
```javascript
async function getRestaurantSequences(restaurantId) {
  return listSequenceInstances({ restaurant_id: restaurantId });
}
```

---

### Module Exports

```javascript
module.exports = {
  startSequence,
  getSequenceInstance,
  listSequenceInstances,
  pauseSequence,
  resumeSequence,
  cancelSequence,
  getRestaurantSequences
};
```

---

## sequence-progression-service.js

**File Path:** `UberEats-Image-Extractor/src/services/sequence-progression-service.js`

### Purpose

Handle automatic task progression when tasks are completed, deleted, or skipped.

### Dependencies

```javascript
const { getSupabaseClient } = require('./database-service');
```

### Function Specifications

#### activateNextTask(sequenceInstanceId, completedTaskId)

**Purpose:** Activate the next task in sequence after one completes

**Parameters:**
- `sequenceInstanceId` (UUID): Instance ID
- `completedTaskId` (UUID): ID of task that was just completed

**Returns:** `Promise<Task|null>` - Returns next task or null if sequence complete

**Process:**
1. Fetch sequence instance
2. Check if instance is active
3. Find next pending task
4. Fetch corresponding sequence step
5. Calculate due date
6. Update next task (status = 'active', due_date set)
7. Update sequence instance current_step
8. If no next task, mark sequence as completed

**Implementation:**
```javascript
async function activateNextTask(sequenceInstanceId, completedTaskId) {
  const client = getSupabaseClient();

  try {
    // 1. Fetch sequence instance
    const { data: instance, error: instanceError } = await client
      .from('sequence_instances')
      .select('*')
      .eq('id', sequenceInstanceId)
      .single();

    if (instanceError) {
      console.error('Error fetching sequence instance:', instanceError);
      return null;
    }

    // 2. Check if instance is active
    if (instance.status !== 'active') {
      console.log('Sequence is not active (paused or cancelled), skipping progression');
      return null;
    }

    // 3. Get completed task to find its step order
    const { data: completedTask, error: taskError } = await client
      .from('tasks')
      .select('sequence_step_order')
      .eq('id', completedTaskId)
      .single();

    if (taskError) {
      console.error('Error fetching completed task:', taskError);
      return null;
    }

    // 4. Find next pending task
    const { data: nextTask, error: nextTaskError } = await client
      .from('tasks')
      .select('*')
      .eq('sequence_instance_id', sequenceInstanceId)
      .eq('status', 'pending')
      .gt('sequence_step_order', completedTask.sequence_step_order)
      .order('sequence_step_order', { ascending: true })
      .limit(1)
      .single();

    if (nextTaskError) {
      if (nextTaskError.code === 'PGRST116') {
        // No next task found - sequence complete
        await client
          .from('sequence_instances')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', sequenceInstanceId);

        console.log('Sequence completed - no more tasks');
        return null;
      }
      console.error('Error finding next task:', nextTaskError);
      return null;
    }

    // 5. Fetch corresponding sequence step to get delay
    const { data: step, error: stepError } = await client
      .from('sequence_steps')
      .select('delay_value, delay_unit')
      .eq('sequence_template_id', instance.sequence_template_id)
      .eq('step_order', nextTask.sequence_step_order)
      .single();

    if (stepError) {
      console.error('Error fetching sequence step:', stepError);
      return null;
    }

    // 6. Calculate due date from NOW (completion time)
    const dueDate = calculateDueDate(new Date(), step.delay_value, step.delay_unit);

    // 7. Update next task (activate it)
    const { data: activatedTask, error: updateError } = await client
      .from('tasks')
      .update({
        status: 'active',
        due_date: dueDate
      })
      .eq('id', nextTask.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error activating next task:', updateError);
      return null;
    }

    // 8. Update sequence instance current_step
    await client
      .from('sequence_instances')
      .update({ current_step_order: nextTask.sequence_step_order })
      .eq('id', sequenceInstanceId);

    console.log(`Activated next task in sequence: ${activatedTask.name} (step ${nextTask.sequence_step_order})`);
    return activatedTask;
  } catch (error) {
    console.error('Error in activateNextTask:', error);
    return null;
  }
}

// Helper function
function calculateDueDate(fromDate, delayValue, delayUnit) {
  const date = new Date(fromDate);

  switch(delayUnit) {
    case 'minutes':
      date.setMinutes(date.getMinutes() + delayValue);
      break;
    case 'hours':
      date.setHours(date.getHours() + delayValue);
      break;
    case 'days':
      date.setDate(date.getDate() + delayValue);
      break;
    default:
      console.error(`Invalid delay_unit: ${delayUnit}`);
      return fromDate;
  }

  return date.toISOString();
}
```

---

#### handleTaskDeletion(sequenceInstanceId, deletedTaskId)

**Purpose:** Handle deletion of a task within a sequence

**Parameters:**
- `sequenceInstanceId` (UUID): Instance ID
- `deletedTaskId` (UUID): ID of task being deleted

**Returns:** `Promise<void>`

**Process:**
1. Check if deleted task was active
2. If active, activate next pending task immediately
3. Delete the task

**Implementation:**
```javascript
async function handleTaskDeletion(sequenceInstanceId, deletedTaskId) {
  const client = getSupabaseClient();

  try {
    // Fetch task to check status
    const { data: task, error: fetchError } = await client
      .from('tasks')
      .select('status, sequence_step_order')
      .eq('id', deletedTaskId)
      .single();

    if (fetchError) {
      console.error('Error fetching task for deletion:', fetchError);
      throw fetchError;
    }

    // If task is active, activate next task before deleting
    if (task.status === 'active') {
      console.log('Deleting active task, activating next task in sequence');

      // Find next pending task
      const { data: nextTask, error: nextError } = await client
        .from('tasks')
        .select('*')
        .eq('sequence_instance_id', sequenceInstanceId)
        .eq('status', 'pending')
        .gt('sequence_step_order', task.sequence_step_order)
        .order('sequence_step_order', { ascending: true })
        .limit(1)
        .single();

      if (!nextError && nextTask) {
        // Activate immediately (no delay)
        await client
          .from('tasks')
          .update({
            status: 'active',
            due_date: new Date().toISOString()
          })
          .eq('id', nextTask.id);

        await client
          .from('sequence_instances')
          .update({ current_step_order: nextTask.sequence_step_order })
          .eq('id', sequenceInstanceId);
      } else {
        // No next task - mark sequence complete
        await client
          .from('sequence_instances')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', sequenceInstanceId);
      }
    }

    // Delete the task
    const { error: deleteError } = await client
      .from('tasks')
      .delete()
      .eq('id', deletedTaskId);

    if (deleteError) {
      console.error('Error deleting task:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    console.error('Error in handleTaskDeletion:', error);
    throw error;
  }
}
```

---

#### handleTaskSkip(taskId)

**Purpose:** Skip a task (mark as cancelled) and activate next

**Parameters:**
- `taskId` (UUID): Task ID to skip

**Returns:** `Promise<Task>` - Next activated task

**Implementation:**
```javascript
async function handleTaskSkip(taskId) {
  const client = getSupabaseClient();

  try {
    // Get task info
    const { data: task } = await client
      .from('tasks')
      .select('sequence_instance_id, status')
      .eq('id', taskId)
      .single();

    if (!task || !task.sequence_instance_id) {
      throw new Error('Task is not part of a sequence');
    }

    if (task.status !== 'active' && task.status !== 'pending') {
      throw new Error('Can only skip active or pending tasks');
    }

    // Mark task as cancelled
    await client
      .from('tasks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // If task was active, activate next
    if (task.status === 'active') {
      return await activateNextTask(task.sequence_instance_id, taskId);
    }

    return null;
  } catch (error) {
    console.error('Error in handleTaskSkip:', error);
    throw error;
  }
}
```

---

### Module Exports

```javascript
module.exports = {
  activateNextTask,
  handleTaskDeletion,
  handleTaskSkip
};
```

---

## tasks-service.js Modifications

**File Path:** `UberEats-Image-Extractor/src/services/tasks-service.js`

### Required Changes

#### 1. Add Import

```javascript
// Add at top of file
const sequenceProgressionService = require('./sequence-progression-service');
```

#### 2. Modify completeTask Function

**Existing Code (around line 234):**
```javascript
async function completeTask(id) {
  return updateTask(id, {
    status: 'completed',
    completed_at: new Date().toISOString()
  });
}
```

**New Code:**
```javascript
async function completeTask(id) {
  const client = getSupabaseClient();

  // Update task status
  const { data: task, error } = await client
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error completing task:', error);
    throw error;
  }

  // ✅ SEQUENCE PROGRESSION HOOK
  if (task.sequence_instance_id) {
    try {
      await sequenceProgressionService.activateNextTask(
        task.sequence_instance_id,
        task.id
      );
    } catch (err) {
      // Log error but don't fail task completion
      console.error('Error activating next task in sequence:', err);
    }
  }

  return task;
}
```

#### 3. Modify deleteTask Function

**Existing Code (around line 258):**
```javascript
async function deleteTask(id) {
  const { error } = await getSupabaseClient()
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}
```

**New Code:**
```javascript
async function deleteTask(id) {
  const client = getSupabaseClient();

  // Fetch task first to check for sequence
  const { data: task } = await client
    .from('tasks')
    .select('sequence_instance_id')
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  // ✅ SEQUENCE DELETION HOOK
  if (task && task.sequence_instance_id) {
    try {
      await sequenceProgressionService.handleTaskDeletion(
        task.sequence_instance_id,
        id
      );
      return; // handleTaskDeletion already deletes the task
    } catch (err) {
      console.error('Error handling sequence task deletion:', err);
      throw err;
    }
  }

  // Regular task deletion (not part of sequence)
  const { error } = await client
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}
```

#### 4. Modify cancelTask Function

**Existing Code (around line 246):**
```javascript
async function cancelTask(id) {
  return updateTask(id, {
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  });
}
```

**New Code:**
```javascript
async function cancelTask(id) {
  const client = getSupabaseClient();

  // Get task info first
  const { data: task } = await client
    .from('tasks')
    .select('sequence_instance_id, status')
    .eq('id', id)
    .single();

  // Update task status
  const { data: cancelledTask, error } = await client
    .from('tasks')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error cancelling task:', error);
    throw error;
  }

  // ✅ SEQUENCE PROGRESSION HOOK (if task was active)
  if (task && task.sequence_instance_id && task.status === 'active') {
    try {
      await sequenceProgressionService.activateNextTask(
        task.sequence_instance_id,
        id
      );
    } catch (err) {
      console.error('Error activating next task in sequence:', err);
    }
  }

  return cancelledTask;
}
```

---

## Error Handling

### Error Types

| Error Type | HTTP Status | Example |
|------------|-------------|---------|
| `ValidationError` | 400 | Invalid step_order values |
| `NotFoundError` | 404 | Template or instance not found |
| `ConflictError` | 409 | Duplicate active sequence |
| `PermissionError` | 403 | Cannot delete template with active instances |
| `DatabaseError` | 500 | Supabase query failed |

### Standard Error Response

```javascript
function handleServiceError(error, context) {
  console.error(`Error in ${context}:`, error);

  if (error.message.includes('not found')) {
    const err = new Error(error.message);
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (error.message.includes('already exists')) {
    const err = new Error(error.message);
    err.code = 'CONFLICT';
    err.status = 409;
    throw err;
  }

  if (error.message.includes('cannot delete') || error.message.includes('Cannot delete')) {
    const err = new Error(error.message);
    err.code = 'PERMISSION_DENIED';
    err.status = 403;
    throw err;
  }

  // Default to 500
  const err = new Error(error.message || 'Internal server error');
  err.code = 'INTERNAL_ERROR';
  err.status = 500;
  throw err;
}
```

---

## Transaction Management

### Critical Transactions

**1. Creating Sequence Template**
- Insert template
- Insert all steps
- Rollback if steps fail

**2. Starting Sequence**
- Insert instance
- Insert all tasks
- Rollback if tasks fail
- Update template usage_count

**3. Activating Next Task**
- Update completed task
- Find and update next task
- Update instance current_step
- All must succeed or rollback

### Transaction Implementation

Since Supabase doesn't support explicit transactions in JS client, use:

1. **Optimistic approach**: Create main record first, then children
2. **Rollback on error**: Delete parent if children fail
3. **Database functions**: For complex multi-step operations

Example using database function:
```sql
CREATE OR REPLACE FUNCTION activate_next_task_atomic(
  p_instance_id UUID,
  p_completed_task_id UUID
)
RETURNS tasks
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_task tasks;
BEGIN
  -- Implementation with proper transaction handling
  -- This runs atomically in database
END;
$$;
```

---

## Testing Guidelines

### Unit Tests

Test each function in isolation:

```javascript
describe('sequence-templates-service', () => {
  describe('createSequenceTemplate', () => {
    it('should create template with steps', async () => {
      // Test implementation
    });

    it('should validate step orders are sequential', async () => {
      // Test implementation
    });

    it('should rollback if step creation fails', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

Test service interactions:

```javascript
describe('Sequence workflow integration', () => {
  it('should complete full sequence lifecycle', async () => {
    // 1. Create template
    // 2. Start sequence
    // 3. Complete tasks one by one
    // 4. Verify progression
    // 5. Verify completion
  });
});
```

### Test Data

Use factories for consistent test data:

```javascript
const testTemplateData = {
  name: 'Test Sequence',
  description: 'Test description',
  tags: ['test', 'demo'],
  created_by: testUserId
};

const testSteps = [
  {
    step_order: 1,
    name: 'Step 1',
    type: 'email',
    priority: 'high',
    delay_value: 0,
    delay_unit: 'days'
  },
  {
    step_order: 2,
    name: 'Step 2',
    type: 'call',
    priority: 'medium',
    delay_value: 3,
    delay_unit: 'days'
  }
];
```

---

**End of Service Layer Document**

For API endpoint specifications, see [api-specification.md](api-specification.md).
