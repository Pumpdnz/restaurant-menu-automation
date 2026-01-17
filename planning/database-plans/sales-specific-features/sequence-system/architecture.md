# Task Sequence System - Architecture

**Version:** 1.0
**Last Updated:** 2025-01-17

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Directory Structure](#directory-structure)
3. [Data Flow](#data-flow)
4. [Service Layer Architecture](#service-layer-architecture)
5. [Database Architecture](#database-architecture)
6. [API Layer Architecture](#api-layer-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Integration Points](#integration-points)
9. [Error Handling](#error-handling)
10. [Security Considerations](#security-considerations)
11. [Performance Considerations](#performance-considerations)
12. [Testing Strategy](#testing-strategy)

---

## High-Level Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ SequenceTemplates│  │    Sequences     │                 │
│  │      Page        │  │      Page        │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│  ┌────────┴─────────────────────┴─────────┐                 │
│  │      Restaurant Detail Enhancement      │                 │
│  └────────┬─────────────────────┬─────────┘                 │
│           │                     │                            │
│  ┌────────┴─────────────────────┴─────────┐                 │
│  │         Tasks Page Enhancement          │                 │
│  └──────────────────┬──────────────────────┘                 │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      │ REST API Calls
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                       API LAYER                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Sequence        │  │  Sequence        │                 │
│  │  Templates       │  │  Instances       │                 │
│  │  Routes          │  │  Routes          │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
            │ Service Calls        │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  sequence-       │  │  sequence-       │                 │
│  │  templates-      │  │  instances-      │                 │
│  │  service.js      │  │  service.js      │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│  ┌────────┴─────────────────────┴─────────┐                 │
│  │    sequence-progression-service.js      │                 │
│  │    (handles task activation logic)      │                 │
│  └────────┬─────────────────────┬─────────┘                 │
│           │                     │                            │
│  ┌────────┴─────────────────────┴─────────┐                 │
│  │      tasks-service.js (enhanced)        │                 │
│  │      - completeTask() hook              │                 │
│  │      - deleteTask() hook                │                 │
│  │      - cancelTask() hook                │                 │
│  └──────────────────┬──────────────────────┘                 │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      │ Database Queries
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                            │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  sequence_       │  │  sequence_       │                 │
│  │  templates       │  │  steps           │                 │
│  └──────────────────┘  └──────────────────┘                 │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  sequence_       │  │  tasks           │                 │
│  │  instances       │  │  (enhanced)      │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### New Files and Locations

```
automation/
├── planning/
│   └── database-plans/
│       └── sales-specific-features/
│           ├── SEQUENCE-SYSTEM-INVESTIGATION.md
│           └── sequence-system/
│               ├── README.md
│               ├── architecture.md (this file)
│               ├── database-schema.md
│               ├── service-layer.md
│               ├── api-specification.md
│               ├── ui-components.md
│               ├── implementation-roadmap.md
│               └── migrations/
│                   ├── 001_create_sequence_templates.sql
│                   ├── 002_create_sequence_steps.sql
│                   ├── 003_create_sequence_instances.sql
│                   └── 004_alter_tasks_add_sequence_columns.sql
│
└── UberEats-Image-Extractor/
    ├── src/
    │   ├── services/
    │   │   ├── tasks-service.js (MODIFY)
    │   │   ├── sequence-templates-service.js (NEW)
    │   │   ├── sequence-instances-service.js (NEW)
    │   │   └── sequence-progression-service.js (NEW)
    │   │
    │   ├── routes/
    │   │   ├── sequence-templates-routes.js (NEW)
    │   │   └── sequence-instances-routes.js (NEW)
    │   │
    │   ├── pages/
    │   │   ├── SequenceTemplates.tsx (NEW)
    │   │   ├── Sequences.tsx (NEW)
    │   │   ├── Restaurants.jsx (MODIFY)
    │   │   ├── RestaurantDetail.jsx (MODIFY)
    │   │   └── Tasks.tsx (MODIFY)
    │   │
    │   └── components/
    │       └── sequences/ (NEW)
    │           ├── CreateSequenceTemplateModal.tsx
    │           ├── EditSequenceTemplateModal.tsx
    │           ├── SequenceStepBuilder.tsx
    │           ├── StartSequenceModal.tsx
    │           └── SequenceProgressCard.tsx
    │
    └── server.js (MODIFY - mount new routes)
```

### Key File Descriptions

#### New Service Files

**`sequence-templates-service.js`**
- Purpose: Manage sequence template CRUD operations
- Key Functions: create, read, update, delete templates and steps
- Dependencies: database-service.js
- ~300-400 lines

**`sequence-instances-service.js`**
- Purpose: Manage active sequence instances
- Key Functions: start, pause, resume, cancel sequences
- Dependencies: database-service.js, tasks-service.js
- ~400-500 lines

**`sequence-progression-service.js`**
- Purpose: Handle automatic task progression logic
- Key Functions: activate next task, calculate due dates, handle skips
- Dependencies: database-service.js, tasks-service.js
- ~200-300 lines

#### Modified Service Files

**`tasks-service.js`** (existing)
- Location: Lines 234-239 (completeTask function)
- Modification: Add sequence progression hook
- New imports: sequence-progression-service.js
- Additional lines: ~20-30

#### New Route Files

**`sequence-templates-routes.js`**
- REST endpoints for template management
- ~200-250 lines

**`sequence-instances-routes.js`**
- REST endpoints for instance management
- ~250-300 lines

#### New Frontend Components

**`SequenceTemplates.tsx`**
- Main page for managing sequence templates
- ~400-500 lines

**`Sequences.tsx`**
- Main page for viewing/managing active sequences
- ~300-400 lines

**Sequence Components Directory**
- 5 reusable components for sequence UI
- Total: ~800-1000 lines combined

---

## Data Flow

### Flow 1: Creating a Sequence Template

```
User Action: Click "Create Sequence Template"
    │
    ▼
[CreateSequenceTemplateModal.tsx]
    │ User fills in template name, description, tags
    │ User adds steps using SequenceStepBuilder
    │
    ▼
POST /api/sequence-templates
    │ Body: { name, description, tags, steps: [...] }
    │
    ▼
[sequence-templates-routes.js]
    │ Validate request
    │ Extract user/org context
    │
    ▼
[sequence-templates-service.js]
    │ createSequenceTemplate(templateData, steps)
    │
    ├─▶ START TRANSACTION
    │
    ├─▶ INSERT INTO sequence_templates (...)
    │   │ Returns: template_id
    │   │
    │   ▼
    ├─▶ For each step:
    │   │ INSERT INTO sequence_steps (...)
    │   │ - sequence_template_id = template_id
    │   │ - step_order
    │   │ - delay_value, delay_unit
    │   │ - task_template_id (if selected)
    │   │ - custom fields
    │   │
    │   ▼
    ├─▶ COMMIT TRANSACTION
    │
    ▼
Response: { template_id, name, steps: [...] }
    │
    ▼
[Frontend] Refresh template list
```

---

### Flow 2: Starting a Sequence

```
User Action: Click "Start Sequence" for a restaurant
    │
    ▼
[StartSequenceModal.tsx]
    │ User selects sequence template
    │ Reviews steps and timeline preview
    │
    ▼
POST /api/sequence-instances
    │ Body: {
    │   sequence_template_id,
    │   restaurant_id,
    │   assigned_to (optional)
    │ }
    │
    ▼
[sequence-instances-routes.js]
    │ Validate request
    │ Check permissions
    │
    ▼
[sequence-instances-service.js]
    │ startSequence(templateId, restaurantId, assignedTo)
    │
    ├─▶ START TRANSACTION
    │
    ├─▶ Fetch sequence template with steps
    │   │ SELECT * FROM sequence_templates WHERE id = ?
    │   │ SELECT * FROM sequence_steps WHERE sequence_template_id = ? ORDER BY step_order
    │   │
    │   ▼
    ├─▶ Create sequence instance
    │   │ INSERT INTO sequence_instances (
    │   │   sequence_template_id,
    │   │   restaurant_id,
    │   │   organisation_id,
    │   │   name, -- "Template Name - Restaurant - Date"
    │   │   status: 'active',
    │   │   current_step_order: 1,
    │   │   total_steps,
    │   │   assigned_to,
    │   │   created_by,
    │   │   started_at: NOW()
    │   │ )
    │   │ Returns: instance_id
    │   │
    │   ▼
    ├─▶ Fetch restaurant data (for variable replacement)
    │   │ SELECT * FROM restaurants WHERE id = restaurant_id
    │   │
    │   ▼
    ├─▶ For each step (ordered by step_order):
    │   │
    │   ├─▶ Build task data:
    │   │   │ - name (from step or template)
    │   │   │ - description
    │   │   │ - type, priority
    │   │   │ - message (with variable replacement)
    │   │   │ - sequence_instance_id = instance_id
    │   │   │ - sequence_step_order = step.step_order
    │   │   │ - restaurant_id
    │   │   │ - organisation_id
    │   │   │ - assigned_to
    │   │   │
    │   │   ├─▶ IF step_order === 1:
    │   │   │   │ status = 'active'
    │   │   │   │ due_date = NOW() + first_step_delay
    │   │   │   │
    │   │   │   ▼
    │   │   └─▶ ELSE:
    │   │       │ status = 'pending'
    │   │       │ due_date = NULL
    │   │       │
    │   │       ▼
    │   ├─▶ INSERT INTO tasks (...)
    │   │
    │   ▼
    ├─▶ COMMIT TRANSACTION
    │
    ▼
Response: {
  instance_id,
  name,
  status: 'active',
  tasks_created: count
}
    │
    ▼
[Frontend] Navigate to sequence detail or restaurant page
```

---

### Flow 3: Completing a Task (Sequence Progression)

```
User Action: Mark task as "Completed"
    │
    ▼
PATCH /api/tasks/:id
    │ Body: { status: 'completed' }
    │
    ▼
[tasks-routes.js] (existing)
    │
    ▼
[tasks-service.js]
    │ completeTask(taskId)
    │
    ├─▶ UPDATE tasks SET
    │   │ status = 'completed',
    │   │ completed_at = NOW()
    │   │ WHERE id = taskId
    │   │
    │   ▼
    ├─▶ Fetch updated task
    │   │ SELECT * FROM tasks WHERE id = taskId
    │   │
    │   ▼
    ├─▶ IF task.sequence_instance_id IS NOT NULL:
    │   │
    │   │ ✅ SEQUENCE PROGRESSION HOOK ✅
    │   │
    │   ├─▶ [sequence-progression-service.js]
    │   │   │ activateNextTask(task.sequence_instance_id, taskId)
    │   │   │
    │   │   ├─▶ START TRANSACTION
    │   │   │
    │   │   ├─▶ Fetch sequence instance
    │   │   │   │ SELECT * FROM sequence_instances
    │   │   │   │ WHERE id = task.sequence_instance_id
    │   │   │   │
    │   │   │   ▼
    │   │   ├─▶ IF instance.status !== 'active':
    │   │   │   │ RETURN (sequence paused/cancelled)
    │   │   │   │
    │   │   │   ▼
    │   │   ├─▶ Find next pending task in sequence
    │   │   │   │ SELECT * FROM tasks
    │   │   │   │ WHERE sequence_instance_id = instance_id
    │   │   │   │ AND sequence_step_order > completed_task.sequence_step_order
    │   │   │   │ AND status = 'pending'
    │   │   │   │ ORDER BY sequence_step_order ASC
    │   │   │   │ LIMIT 1
    │   │   │   │
    │   │   │   ▼
    │   │   ├─▶ IF next_task found:
    │   │   │   │
    │   │   │   ├─▶ Fetch corresponding sequence step
    │   │   │   │   │ SELECT * FROM sequence_steps
    │   │   │   │   │ WHERE sequence_template_id = instance.sequence_template_id
    │   │   │   │   │ AND step_order = next_task.sequence_step_order
    │   │   │   │   │
    │   │   │   │   ▼
    │   │   │   ├─▶ Calculate due_date:
    │   │   │   │   │ due_date = NOW() + (step.delay_value * step.delay_unit)
    │   │   │   │   │ - 'minutes': add minutes
    │   │   │   │   │ - 'hours': add hours
    │   │   │   │   │ - 'days': add days
    │   │   │   │   │
    │   │   │   │   ▼
    │   │   │   ├─▶ UPDATE tasks SET
    │   │   │   │   │ status = 'active',
    │   │   │   │   │ due_date = calculated_due_date
    │   │   │   │   │ WHERE id = next_task.id
    │   │   │   │   │
    │   │   │   │   ▼
    │   │   │   └─▶ UPDATE sequence_instances SET
    │   │   │       │ current_step_order = next_task.sequence_step_order
    │   │   │       │ WHERE id = instance_id
    │   │   │       │
    │   │   │       ▼
    │   │   ├─▶ ELSE (no next task):
    │   │   │   │
    │   │   │   └─▶ UPDATE sequence_instances SET
    │   │   │       │ status = 'completed',
    │   │   │       │ completed_at = NOW()
    │   │   │       │ WHERE id = instance_id
    │   │   │       │
    │   │   │       ▼
    │   │   └─▶ COMMIT TRANSACTION
    │   │
    │   ▼
    └─▶ RETURN completed task
    │
    ▼
Response: { task object }
    │
    ▼
[Frontend] Refresh task list and sequence progress
```

---

### Flow 4: Deleting a Task (Sequence Handling)

```
User Action: Delete a task
    │
    ▼
DELETE /api/tasks/:id
    │
    ▼
[tasks-service.js]
    │ deleteTask(taskId)
    │
    ├─▶ Fetch task to check if it's part of a sequence
    │   │ SELECT * FROM tasks WHERE id = taskId
    │   │
    │   ▼
    ├─▶ IF task.sequence_instance_id IS NOT NULL:
    │   │
    │   │ ⚠️ SEQUENCE DELETION HOOK ⚠️
    │   │
    │   ├─▶ Fetch sequence instance
    │   │   │ SELECT * FROM sequence_instances WHERE id = task.sequence_instance_id
    │   │   │
    │   │   ▼
    │   ├─▶ IF task.status === 'active':
    │   │   │
    │   │   │ (User is deleting the current active task)
    │   │   │
    │   │   ├─▶ START TRANSACTION
    │   │   │
    │   │   ├─▶ DELETE FROM tasks WHERE id = taskId
    │   │   │   │
    │   │   │   ▼
    │   │   ├─▶ Find next pending task
    │   │   │   │ (same logic as activateNextTask)
    │   │   │   │
    │   │   │   ▼
    │   │   ├─▶ IF next_task found:
    │   │   │   │ Activate it immediately
    │   │   │   │ UPDATE tasks SET status = 'active', due_date = NOW()
    │   │   │   │
    │   │   │   ▼
    │   │   └─▶ ELSE:
    │   │       │ Mark sequence as completed
    │   │       │
    │   │       ▼
    │   │   └─▶ COMMIT TRANSACTION
    │   │
    │   ▼
    └─▶ ELSE (pending or completed task):
        │ Simply delete without affecting sequence flow
        │ DELETE FROM tasks WHERE id = taskId
        │
        ▼
Response: Success
    │
    ▼
[Frontend] Refresh task list
```

---

## Service Layer Architecture

### Service Responsibilities

#### 1. sequence-templates-service.js

**Responsibility:** Manage sequence template lifecycle

**Key Functions:**
```javascript
// CRUD Operations
- listSequenceTemplates(filters)
- getSequenceTemplateById(id)
- getSequenceTemplateWithSteps(id)
- createSequenceTemplate(templateData, steps)
- updateSequenceTemplate(id, updates)
- deleteSequenceTemplate(id)

// Step Management
- addStep(templateId, stepData)
- updateStep(stepId, updates)
- deleteStep(stepId)
- reorderSteps(templateId, newOrder)

// Utility
- duplicateSequenceTemplate(id, newName)
- toggleActive(id, isActive)
- getUsageStats(id)
```

**Dependencies:**
- database-service.js (Supabase client)
- Validates template data
- Ensures step_order integrity

**Transaction Requirements:**
- Creating template: Single transaction for template + steps
- Updating steps: Individual updates (no transaction needed)
- Reordering: Single transaction to update all step_order values
- Deleting template: Cascade delete handled by database

---

#### 2. sequence-instances-service.js

**Responsibility:** Manage active sequence instances

**Key Functions:**
```javascript
// Instance Management
- startSequence(templateId, restaurantId, options)
- getSequenceInstance(id)
- listSequenceInstances(filters)
- pauseSequence(instanceId)
- resumeSequence(instanceId)
- cancelSequence(instanceId)

// Progress Tracking
- getSequenceProgress(instanceId)
- getRestaurantSequences(restaurantId)

// Utilities
- canStartSequence(templateId, restaurantId) // Check if duplicate exists
```

**Dependencies:**
- database-service.js
- tasks-service.js (to create tasks)
- variable-replacement-service.js (for message rendering)

**Transaction Requirements:**
- Starting sequence: **CRITICAL** - Must be atomic
  - Create instance
  - Create all tasks
  - Rollback if any step fails
- Cancelling sequence: Transaction to update instance and delete pending tasks

**Business Rules:**
- Only one active instance of same template per restaurant
- All tasks assigned to sequence creator by default
- Instance name format: `{template.name} - {restaurant.name} - {date}`

---

#### 3. sequence-progression-service.js

**Responsibility:** Handle automatic task progression

**Key Functions:**
```javascript
// Core Progression
- activateNextTask(sequenceInstanceId, completedTaskId)
- calculateNextTaskDueDate(completedTask, sequenceStep)

// Sequence Status Management
- updateSequenceStatus(instanceId)
- checkIfSequenceComplete(instanceId)

// Edge Cases
- handleTaskDeletion(sequenceInstanceId, deletedTaskId)
- handleTaskSkip(taskId)
- handleOutOfOrderCompletion(taskId)
```

**Dependencies:**
- database-service.js
- tasks-service.js (minimal - mostly direct queries)

**Transaction Requirements:**
- **CRITICAL**: activateNextTask must be atomic
  - Update completed task
  - Update next task (status + due_date)
  - Update sequence instance current_step
  - Rollback if any step fails

**Business Rules:**
- Delays calculated from completion time (not original due date)
- Skipped tasks don't block progression
- Deleted active tasks trigger immediate next activation
- Out-of-order completions warn but allow

**Date Calculation Logic:**
```javascript
function calculateNextTaskDueDate(completedTask, sequenceStep) {
  const now = new Date();
  const { delay_value, delay_unit } = sequenceStep;

  switch(delay_unit) {
    case 'minutes':
      return new Date(now.getTime() + delay_value * 60 * 1000);
    case 'hours':
      return new Date(now.getTime() + delay_value * 60 * 60 * 1000);
    case 'days':
      return new Date(now.getTime() + delay_value * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Invalid delay_unit: ${delay_unit}`);
  }
}
```

---

#### 4. tasks-service.js (Modifications)

**Existing Function:** `completeTask(id)`

**New Logic:**
```javascript
async function completeTask(id) {
  const client = getSupabaseClient();

  // Start transaction
  const { data: task, error } = await client
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // ✅ NEW: Sequence progression hook
  if (task.sequence_instance_id) {
    await sequenceProgressionService.activateNextTask(
      task.sequence_instance_id,
      task.id
    );
  }

  return task;
}
```

**Existing Function:** `deleteTask(id)`

**New Logic:**
```javascript
async function deleteTask(id) {
  const client = getSupabaseClient();

  // Fetch task first to check for sequence
  const { data: task } = await client
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  // ✅ NEW: Sequence deletion hook
  if (task && task.sequence_instance_id) {
    await sequenceProgressionService.handleTaskDeletion(
      task.sequence_instance_id,
      task.id
    );
  } else {
    // Regular deletion
    await client.from('tasks').delete().eq('id', id);
  }
}
```

---

## Database Architecture

### Table Relationships

```
organisations (existing)
    ↓ 1:N
sequence_templates
    ↓ 1:N
sequence_steps
    ↑
    │ (references)
    │
task_templates (existing)

sequence_templates
    ↓ 1:N
sequence_instances
    ↓ 1:N
tasks (existing, enhanced)

restaurants (existing)
    ↓ 1:N
sequence_instances
```

### Index Strategy

**Critical Indexes (for performance):**

1. **`sequence_instances` table:**
   ```sql
   - idx_sequence_instances_restaurant_status (restaurant_id, status)
     → Fast filtering of active sequences per restaurant

   - idx_sequence_instances_template (sequence_template_id)
     → Fast lookup of instances by template
   ```

2. **`tasks` table (new):**
   ```sql
   - idx_tasks_sequence_instance (sequence_instance_id)
     → Fast lookup of all tasks in a sequence

   - idx_tasks_sequence_order (sequence_instance_id, sequence_step_order)
     → Fast ordered retrieval of sequence tasks
   ```

3. **`sequence_steps` table:**
   ```sql
   - idx_sequence_steps_order (sequence_template_id, step_order)
     → Fast ordered retrieval of template steps
   ```

### Row Level Security (RLS)

All new tables will have RLS policies matching existing pattern:

```sql
-- Example for sequence_templates
CREATE POLICY sequence_templates_org_policy ON sequence_templates
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
```

**Security Guarantees:**
- Users can only access sequences for their organization
- No cross-organization data leakage
- Cascading deletes respect RLS policies

---

## API Layer Architecture

### RESTful Design Principles

1. **Resource-Based URLs**
   - `/api/sequence-templates` (collection)
   - `/api/sequence-templates/:id` (single resource)

2. **Standard HTTP Methods**
   - GET: Retrieve
   - POST: Create
   - PATCH: Update
   - DELETE: Remove

3. **Nested Resources for Related Data**
   - `/api/sequence-templates/:id/steps` (steps within template)
   - `/api/restaurants/:id/sequences` (sequences for restaurant)

### Authentication & Authorization

**Middleware Stack:**
```javascript
[Request]
    ↓
[CORS middleware]
    ↓
[Authentication middleware]
    ↓ (verifies JWT token)
[Organization context middleware]
    ↓ (sets current org_id)
[Route handler]
    ↓ (validates permissions)
[Service layer]
```

**Authorization Rules:**
- User must be authenticated
- User must belong to an organization
- Resources must belong to user's organization
- RLS policies provide additional database-level security

### Error Response Format

```javascript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Step order must be unique within template",
    "details": {
      "field": "step_order",
      "value": 2,
      "constraint": "sequence_steps_unique_order"
    }
  }
}
```

---

## Frontend Architecture

### Component Hierarchy

```
App
├── Navigation
│   └── (Add "Sequences" link)
│
├── SequenceTemplates Page
│   ├── SequenceTemplatesTable
│   │   ├── SequenceTemplateRow (each template)
│   │   └── Actions (Edit, Duplicate, Delete)
│   │
│   ├── CreateSequenceTemplateModal
│   │   └── SequenceStepBuilder
│   │       ├── StepList (drag-drop ordering)
│   │       └── StepForm (add/edit step)
│   │
│   └── EditSequenceTemplateModal
│       └── SequenceStepBuilder
│
├── Sequences Page
│   ├── SequencesTable
│   │   ├── SequenceInstanceRow
│   │   └── SequenceProgressCard
│   │
│   └── Filters (by restaurant, status)
│
├── Restaurant Detail (Enhanced)
│   ├── (Existing sections)
│   ├── Active Sequences Section
│   │   ├── SequenceProgressCard (for each active sequence)
│   │   └── StartSequenceButton
│   │
│   └── StartSequenceModal
│       ├── TemplateSelector
│       └── PreviewTimeline
│
└── Tasks Page (Enhanced)
    └── TasksTable
        ├── Sequence Badge (if task is part of sequence)
        └── Step Position (e.g., "Step 2 of 5")
```

### State Management

**Using React Query (or similar):**

```javascript
// Queries
useSequenceTemplates(filters)
useSequenceTemplate(id)
useSequenceInstances(filters)
useSequenceInstance(id)
useRestaurantSequences(restaurantId)

// Mutations
useCreateSequenceTemplate()
useUpdateSequenceTemplate()
useStartSequence()
usePauseSequence()
useCancelSequence()
```

**Cache Invalidation:**
- Creating template → Invalidate template list
- Starting sequence → Invalidate restaurant sequences + sequence instances list
- Completing task → Invalidate sequence instance + tasks list

---

## Integration Points

### 1. Authentication System (Existing)

**Integration:** All API routes use existing auth middleware

**Location:** `UberEats-Image-Extractor/src/middleware/`

**How Sequences Integrate:**
```javascript
// Existing pattern:
router.get('/sequence-templates', authenticateUser, async (req, res) => {
  // req.user contains authenticated user info
  // req.organizationId set by middleware
});
```

### 2. Database Service (Existing)

**Integration:** Use existing Supabase client

**Location:** `UberEats-Image-Extractor/src/services/database-service.js`

**How Sequences Integrate:**
```javascript
const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

// In sequence services:
const client = getSupabaseClient();
const orgId = getCurrentOrganizationId();
```

### 3. Variable Replacement Service (Existing)

**Integration:** Reuse for sequence task messages

**Location:** `UberEats-Image-Extractor/src/services/variable-replacement-service.js`

**How Sequences Integrate:**
```javascript
const variableReplacementService = require('./variable-replacement-service');

// When creating tasks from sequence:
taskData.message_rendered = await variableReplacementService.replaceVariables(
  stepMessage,
  restaurant
);
```

### 4. Task Templates System (Existing)

**Integration:** Sequence steps can reference task templates

**Location:** `UberEats-Image-Extractor/src/services/task-templates-service.js`

**How Sequences Integrate:**
```javascript
// In sequence step configuration:
{
  task_template_id: 'uuid-of-existing-template',
  // OR
  custom_name: 'Custom task name',
  custom_type: 'email',
  ...
}
```

### 5. Message Templates System (Existing)

**Integration:** Sequence steps can reference message templates

**Location:** `UberEats-Image-Extractor/src/services/message-templates-service.js`

**How Sequences Integrate:**
```javascript
// In sequence step configuration:
{
  message_template_id: 'uuid-of-existing-template',
  // Message content pulled from template
}
```

### 6. UI Framework (shadcn/ui)

**Integration:** Use existing component library

**Components Used:**
- `<Table>` for lists
- `<Dialog>` for modals
- `<Select>` for dropdowns
- `<Badge>` for status indicators
- `<Button>` for actions
- `<Form>` for input validation

---

## Error Handling

### Service Layer Error Handling

**Pattern:**
```javascript
async function createSequenceTemplate(templateData, steps) {
  const client = getSupabaseClient();

  try {
    // Start transaction
    const { data, error } = await client.rpc('create_sequence_with_steps', {
      template: templateData,
      steps: steps
    });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create sequence template: ${error.message}`);
    }

    return data;
  } catch (err) {
    // Log and re-throw with context
    console.error('Service error in createSequenceTemplate:', err);
    throw err;
  }
}
```

### API Error Responses

**Standard Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_ERROR` | 409 | Resource already exists |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `SEQUENCE_IN_PROGRESS` | 409 | Cannot modify active sequence |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

**Example Response:**
```json
{
  "error": {
    "code": "DUPLICATE_ERROR",
    "message": "A sequence is already active for this restaurant using this template",
    "details": {
      "restaurant_id": "uuid",
      "template_id": "uuid",
      "existing_sequence_id": "uuid"
    }
  }
}
```

### Frontend Error Handling

**Pattern:**
```javascript
import { toast } from 'sonner';

try {
  await startSequenceMutation.mutateAsync({
    templateId,
    restaurantId
  });
  toast.success('Sequence started successfully');
} catch (error) {
  if (error.code === 'DUPLICATE_ERROR') {
    toast.error('A sequence is already running for this restaurant');
  } else {
    toast.error(error.message || 'Failed to start sequence');
  }
}
```

---

## Security Considerations

### 1. Row Level Security (RLS)

All sequence tables have RLS policies ensuring:
- Users only see sequences for their organization
- No cross-organization data access
- Database enforces security even if application has bugs

### 2. Input Validation

**At API Layer:**
```javascript
// Validate sequence template creation
const schema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500),
  tags: Joi.array().items(Joi.string()),
  steps: Joi.array().min(1).max(50).items(
    Joi.object({
      step_order: Joi.number().integer().min(1).required(),
      name: Joi.string().required(),
      delay_value: Joi.number().integer().min(0).required(),
      delay_unit: Joi.string().valid('minutes', 'hours', 'days').required(),
      // ...
    })
  )
});
```

### 3. SQL Injection Prevention

**Using Parameterized Queries:**
```javascript
// ✅ SAFE - Supabase handles parameterization
const { data } = await client
  .from('sequence_templates')
  .select('*')
  .eq('id', templateId);

// ❌ NEVER do this:
// const query = `SELECT * FROM sequence_templates WHERE id = '${templateId}'`;
```

### 4. Authorization Checks

**Before Sensitive Operations:**
```javascript
async function deleteSequenceTemplate(id) {
  // 1. Verify ownership through RLS
  const { data: template } = await client
    .from('sequence_templates')
    .select('*')
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (!template) {
    throw new Error('Template not found or access denied');
  }

  // 2. Check for active instances
  const { count } = await client
    .from('sequence_instances')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_template_id', id)
    .eq('status', 'active');

  if (count > 0) {
    throw new Error('Cannot delete template with active instances');
  }

  // 3. Proceed with deletion
  await client.from('sequence_templates').delete().eq('id', id);
}
```

---

## Performance Considerations

### 1. Database Query Optimization

**Use Indexes Effectively:**
```javascript
// ✅ GOOD - Uses idx_sequence_instances_restaurant_status
const { data } = await client
  .from('sequence_instances')
  .select('*')
  .eq('restaurant_id', restaurantId)
  .eq('status', 'active');

// ❌ BAD - Full table scan
const { data } = await client
  .from('sequence_instances')
  .select('*')
  .like('name', '%Pizza%'); // No index on name
```

### 2. Batch Operations

**Creating Tasks in Sequence:**
```javascript
// ✅ GOOD - Single batch insert
const tasksToCreate = steps.map(step => ({
  // ... task data
}));

const { data } = await client
  .from('tasks')
  .insert(tasksToCreate);

// ❌ BAD - Multiple individual inserts
for (const step of steps) {
  await client.from('tasks').insert({ ... });
}
```

### 3. Pagination

**For Large Lists:**
```javascript
async function listSequenceTemplates(page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, count } = await client
    .from('sequence_templates')
    .select('*', { count: 'exact' })
    .range(start, end)
    .order('created_at', { ascending: false });

  return {
    data,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize)
  };
}
```

### 4. Caching Strategy

**Frontend Caching:**
```javascript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Sequence templates rarely change
useSequenceTemplates({
  staleTime: 15 * 60 * 1000, // 15 minutes
});

// Active sequences change frequently
useRestaurantSequences(restaurantId, {
  staleTime: 30 * 1000, // 30 seconds
  refetchOnWindowFocus: true,
});
```

### 5. Transaction Efficiency

**Keep Transactions Short:**
```javascript
// ✅ GOOD - Minimal transaction scope
async function activateNextTask(sequenceInstanceId, completedTaskId) {
  // Fetch data OUTSIDE transaction
  const nextTask = await findNextPendingTask(sequenceInstanceId);
  const step = await getSequenceStep(nextTask.sequence_step_order);
  const dueDate = calculateNextTaskDueDate(completedTaskId, step);

  // Quick transaction
  return await client.rpc('activate_next_task_atomic', {
    next_task_id: nextTask.id,
    new_due_date: dueDate,
    instance_id: sequenceInstanceId
  });
}
```

---

## Testing Strategy

### Unit Tests

**Service Layer Testing:**
```javascript
describe('sequence-templates-service', () => {
  describe('createSequenceTemplate', () => {
    it('should create template with steps in transaction', async () => {
      const templateData = { name: 'Test Sequence', ... };
      const steps = [
        { step_order: 1, name: 'Step 1', ... },
        { step_order: 2, name: 'Step 2', ... }
      ];

      const result = await createSequenceTemplate(templateData, steps);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Sequence');

      // Verify steps were created
      const { data: createdSteps } = await client
        .from('sequence_steps')
        .select('*')
        .eq('sequence_template_id', result.id);

      expect(createdSteps).toHaveLength(2);
    });

    it('should rollback if step creation fails', async () => {
      // Test transaction rollback
    });
  });
});
```

### Integration Tests

**API Endpoint Testing:**
```javascript
describe('POST /api/sequence-templates', () => {
  it('should create template and return 201', async () => {
    const response = await request(app)
      .post('/api/sequence-templates')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'Demo Follow-up',
        steps: [...]
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });

  it('should return 400 for invalid data', async () => {
    const response = await request(app)
      .post('/api/sequence-templates')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'A', // Too short
        steps: []  // Empty
      });

    expect(response.status).toBe(400);
  });
});
```

### End-to-End Tests

**Complete Workflow Testing:**
```javascript
describe('Sequence Workflow', () => {
  it('should complete full sequence lifecycle', async () => {
    // 1. Create template
    const template = await createSequenceTemplate(...);

    // 2. Start sequence for restaurant
    const instance = await startSequence(template.id, restaurantId);

    // 3. Verify first task is active
    const tasks = await getSequenceTasks(instance.id);
    expect(tasks[0].status).toBe('active');
    expect(tasks[1].status).toBe('pending');

    // 4. Complete first task
    await completeTask(tasks[0].id);

    // 5. Verify second task activated
    const updatedTasks = await getSequenceTasks(instance.id);
    expect(updatedTasks[1].status).toBe('active');
    expect(updatedTasks[1].due_date).not.toBeNull();

    // 6. Complete all tasks
    for (const task of updatedTasks.slice(1)) {
      await completeTask(task.id);
    }

    // 7. Verify sequence completed
    const updatedInstance = await getSequenceInstance(instance.id);
    expect(updatedInstance.status).toBe('completed');
  });
});
```

---

**End of Architecture Document**

This architecture document provides a comprehensive blueprint for implementing the task sequence system. Refer to other documentation files for specific implementation details.
