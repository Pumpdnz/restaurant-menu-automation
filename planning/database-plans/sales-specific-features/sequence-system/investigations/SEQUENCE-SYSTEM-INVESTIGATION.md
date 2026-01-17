# Task Sequence System - Investigation Summary

**Date:** 2025-01-17
**Status:** Investigation & Planning
**Current State:** Phases 1-5 Complete

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Sequence Requirements](#sequence-requirements)
4. [Architecture Considerations](#architecture-considerations)
5. [Database Schema Analysis](#database-schema-analysis)
6. [Service Layer Analysis](#service-layer-analysis)
7. [Critical Design Decisions](#critical-design-decisions)
8. [Integration Points](#integration-points)
9. [Potential Challenges](#potential-challenges)
10. [Questions for Discussion](#questions-for-discussion)

---

## Executive Summary

### What We're Building
A **task sequence system** that allows users to create predefined workflows of multiple tasks that execute in order with configurable delays between each step. This will dramatically reduce the manual overhead of creating repetitive task workflows for common sales processes.

### Key Requirements
1. **Batch Task Creation**: Create multiple tasks at once from a sequence template
2. **Sequential Activation**: Only the first task starts as 'active', others remain 'pending'
3. **Automatic Progression**: When a task is completed, the next task in sequence becomes active
4. **Configurable Delays**: Each step has a delay (in hours/days) that determines the due date of the next task
5. **Reusability**: Sequences should be templates that can be applied to different restaurants

### Current State
- ✅ **Phase 1-5 Complete**: Database schema, backend API, frontend UI for tasks, task templates, and message templates
- ✅ **Foundation Ready**: The 'pending' status and nullable due_date were designed with sequences in mind
- ✅ **Variable Replacement**: Fully functional for personalizing messages
- ⚠️ **Missing**: Sequence templates, sequence instances, step definitions, progression logic

---

## Current System Analysis

### Existing Tables

#### 1. `tasks` Table
**Purpose:** Stores individual task records

**Key Fields for Sequences:**
```sql
- id (UUID)
- organisation_id (UUID) ✓
- restaurant_id (UUID) ✓ Will link all tasks in a sequence to same restaurant
- task_template_id (UUID) ✓ Already supported
- status ('pending' | 'active' | 'completed' | 'cancelled') ✓ Perfect for sequences!
- due_date (TIMESTAMPTZ, nullable) ✓ Null for pending tasks
- metadata (JSONB) ✓ Could store sequence context
- created_at, updated_at, completed_at ✓
```

**Observations:**
- ✅ The `pending` status exists and has a comment in code: *"'pending' is reserved for tasks with dependencies that need to be resolved first"*
- ✅ This was **intentionally designed** for sequence support
- ✅ `due_date` is nullable - perfect for pending tasks
- ✅ `metadata` JSONB field available for storing sequence-specific data
- ❌ **No foreign key to link tasks together as part of a sequence instance**
- ❌ **No way to determine task order within a sequence**

#### 2. `task_templates` Table
**Purpose:** Reusable task templates for quick task creation

**Key Fields:**
```sql
- id (UUID)
- organisation_id (UUID)
- message_template_id (UUID, nullable)
- name, description, type, priority
- default_message (TEXT)
- is_active (BOOLEAN)
- usage_count (INTEGER)
- metadata (JSONB)
```

**Observations:**
- ✅ Task templates work well individually
- ✅ Already integrated with tasks service
- ❌ **No concept of grouping templates into sequences**
- ❌ **No delay/timing information stored**
- ❌ **No ordering information**

#### 3. `message_templates` Table
**Purpose:** Reusable message templates with variable replacement

**Key Fields:**
```sql
- id (UUID)
- organisation_id (UUID)
- name, description, type
- message_content (TEXT)
- available_variables (JSONB)
- is_active (BOOLEAN)
```

**Observations:**
- ✅ Fully functional and integrated
- ✅ Variable replacement working perfectly
- ✅ Can be referenced by task templates
- ✅ Will work seamlessly with sequences

#### 4. `restaurants` Table
**Purpose:** Restaurant/lead records with sales tracking

**Key Fields for Sequences:**
```sql
- id (UUID)
- organisation_id (UUID)
- lead_stage, lead_warmth, lead_status
- assigned_sales_rep (UUID)
```

**Observations:**
- ✅ Sequences will be applied to a restaurant
- ✅ Lead stage might influence which sequence to use
- ✅ All tasks in a sequence share the same restaurant_id

---

## Sequence Requirements

### User Story
> "As a sales rep, I want to create a 'Demo Follow-up' sequence that automatically creates 5 follow-up tasks over 2 weeks, so I don't have to manually create and schedule each follow-up task."

### Functional Requirements

#### FR-1: Sequence Templates (Reusable Definitions)
- **Must have:**
  - Name and description
  - Organization association
  - Active/inactive status
  - List of steps (tasks) in order
  - Each step defines:
    - Task template to use (or custom task configuration)
    - Delay from previous step (in hours or days)
    - Position/order in sequence

#### FR-2: Sequence Instances (Applied Sequences)
- **Must have:**
  - Reference to the sequence template used
  - Restaurant association
  - Status (active, paused, completed, cancelled)
  - Created timestamp
  - Started timestamp
  - Completed timestamp
  - Current step tracking

#### FR-3: Task Creation from Sequence
- **Must have:**
  - Create all tasks at once when sequence is started
  - First task: status = 'active', due_date = calculated
  - Subsequent tasks: status = 'pending', due_date = null
  - All tasks linked to same sequence instance
  - All tasks linked to same restaurant
  - Preserve order information

#### FR-4: Automatic Task Progression
- **Must have:**
  - When task marked as 'completed':
    - If task is part of a sequence
    - Find the next task in sequence
    - Update next task: status = 'active'
    - Calculate and set next task's due_date based on delay
    - If no next task, mark sequence as 'completed'

#### FR-5: Sequence Management
- **Must have:**
  - Create sequence templates
  - Edit sequence templates (steps, delays, order)
  - Activate/deactivate templates
  - View active sequences for a restaurant
  - Pause/resume sequence instance
  - Cancel sequence instance
  - View sequence progress

### Non-Functional Requirements

#### NFR-1: Performance
- Creating a sequence with 10 tasks should complete in < 2 seconds
- Completing a task and activating the next should be near-instantaneous

#### NFR-2: Data Integrity
- If a sequence instance is deleted, associated tasks should remain (soft delete sequence linkage)
- If a task is manually deleted, sequence should handle gracefully
- Cascading deletes must be carefully designed

#### NFR-3: Flexibility
- Users should be able to:
  - Skip tasks in a sequence
  - Add ad-hoc tasks to a sequence
  - Modify task delays mid-sequence
  - Complete tasks out of order (with warnings)

---

## Architecture Considerations

### Approach 1: Two-Table Model (Recommended)
**Tables:** `sequence_templates`, `sequence_steps`

```
sequence_templates (Template Definition)
├── id
├── organisation_id
├── name
├── description
├── is_active
├── created_by
└── metadata

sequence_steps (Step Definitions)
├── id
├── sequence_template_id (FK)
├── task_template_id (FK, nullable)
├── step_order (INTEGER)
├── delay_value (INTEGER)
├── delay_unit ('hours' | 'days')
├── name (override template name)
├── description (override)
└── metadata
```

**Linking to Tasks:**
Add to `tasks` table:
```sql
- sequence_instance_id (UUID, FK, nullable)
- sequence_step_order (INTEGER, nullable)
```

**Pros:**
- ✅ Clear separation of template vs instance
- ✅ Steps are defined once in template
- ✅ Simple to create multiple instances from same template
- ✅ Easy to track which tasks belong to which instance

**Cons:**
- ❌ Requires tracking instance state separately
- ❌ More complex queries to get sequence progress

---

### Approach 2: Three-Table Model (More Complex)
**Tables:** `sequence_templates`, `sequence_instances`, `sequence_steps`

```
sequence_templates (Template Definition)
├── id
├── organisation_id
├── name, description
└── is_active

sequence_instances (Active Sequences)
├── id
├── sequence_template_id (FK)
├── restaurant_id (FK)
├── organisation_id (FK)
├── status ('active' | 'paused' | 'completed' | 'cancelled')
├── current_step (INTEGER)
├── started_at
├── completed_at
└── metadata

sequence_steps (Step Definitions)
├── id
├── sequence_template_id (FK)
├── task_template_id (FK, nullable)
├── step_order (INTEGER)
├── delay_value, delay_unit
└── custom_config (JSONB)
```

**Linking to Tasks:**
Add to `tasks` table:
```sql
- sequence_instance_id (UUID, FK, nullable)
```

**Pros:**
- ✅ Explicit instance tracking with status
- ✅ Can track current step easily
- ✅ Better for analytics and reporting
- ✅ Easier to pause/resume sequences

**Cons:**
- ❌ More tables to manage
- ❌ More complex setup
- ❌ Additional overhead for simple use cases

---

### Approach 3: Metadata-Based (Not Recommended)
Store sequence information in task `metadata` JSONB field

**Pros:**
- ✅ No schema changes to tasks table
- ✅ Very flexible

**Cons:**
- ❌ Hard to query and filter
- ❌ No referential integrity
- ❌ Difficult to enforce order
- ❌ Performance issues at scale
- ❌ Not recommended for production use

---

## Database Schema Analysis

### Recommended Schema: Approach 2 (Three-Table Model)

#### New Table: `sequence_templates`
```sql
CREATE TABLE public.sequence_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Template info
  name TEXT NOT NULL,
  description TEXT,

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  tags TEXT[], -- For categorization: 'onboarding', 'follow-up', 'demo'
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT sequence_templates_name_check CHECK (length(name) >= 3)
);

-- Indexes
CREATE INDEX idx_sequence_templates_org ON sequence_templates(organisation_id);
CREATE INDEX idx_sequence_templates_active ON sequence_templates(is_active);
CREATE INDEX idx_sequence_templates_tags ON sequence_templates USING gin(tags);

-- RLS
ALTER TABLE sequence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY sequence_templates_org_policy ON sequence_templates
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_sequence_templates_updated_at
  BEFORE UPDATE ON sequence_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### New Table: `sequence_steps`
```sql
CREATE TABLE public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_template_id UUID NOT NULL REFERENCES sequence_templates(id) ON DELETE CASCADE,

  -- Step configuration
  step_order INTEGER NOT NULL, -- 1, 2, 3, etc.
  name TEXT NOT NULL,
  description TEXT,

  -- Task configuration (can reference template or be custom)
  task_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('internal_activity', 'social_message', 'text', 'email', 'call')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Message configuration
  message_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  custom_message TEXT, -- Override template message

  -- Timing
  delay_value INTEGER NOT NULL DEFAULT 0, -- 0 for first step
  delay_unit TEXT NOT NULL DEFAULT 'days' CHECK (delay_unit IN ('minutes', 'hours', 'days')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT sequence_steps_order_positive CHECK (step_order > 0),
  CONSTRAINT sequence_steps_delay_positive CHECK (delay_value >= 0),
  CONSTRAINT sequence_steps_unique_order UNIQUE (sequence_template_id, step_order)
);

-- Indexes
CREATE INDEX idx_sequence_steps_template ON sequence_steps(sequence_template_id);
CREATE INDEX idx_sequence_steps_order ON sequence_steps(sequence_template_id, step_order);

-- RLS
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY sequence_steps_org_policy ON sequence_steps
  FOR ALL
  USING (
    sequence_template_id IN (
      SELECT id FROM sequence_templates
      WHERE organisation_id IN (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Trigger
CREATE TRIGGER update_sequence_steps_updated_at
  BEFORE UPDATE ON sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### New Table: `sequence_instances`
```sql
CREATE TABLE public.sequence_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_template_id UUID NOT NULL REFERENCES sequence_templates(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Instance info
  name TEXT NOT NULL, -- Copy of template name at creation

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'completed', 'cancelled')
  ),
  current_step_order INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL,

  -- Assignments
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sequence_instances_template ON sequence_instances(sequence_template_id);
CREATE INDEX idx_sequence_instances_restaurant ON sequence_instances(restaurant_id);
CREATE INDEX idx_sequence_instances_org ON sequence_instances(organisation_id);
CREATE INDEX idx_sequence_instances_status ON sequence_instances(status);
CREATE INDEX idx_sequence_instances_assigned ON sequence_instances(assigned_to);

-- Composite indexes
CREATE INDEX idx_sequence_instances_restaurant_status
  ON sequence_instances(restaurant_id, status);

-- RLS
ALTER TABLE sequence_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY sequence_instances_org_policy ON sequence_instances
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_sequence_instances_updated_at
  BEFORE UPDATE ON sequence_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Modifications to `tasks` Table
```sql
-- Add sequence tracking columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sequence_instance_id UUID
    REFERENCES sequence_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_step_order INTEGER;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tasks_sequence_instance
  ON tasks(sequence_instance_id);

CREATE INDEX IF NOT EXISTS idx_tasks_sequence_order
  ON tasks(sequence_instance_id, sequence_step_order);

-- Add constraint to ensure step_order is positive
ALTER TABLE tasks
  ADD CONSTRAINT tasks_sequence_step_order_check
  CHECK (sequence_step_order IS NULL OR sequence_step_order > 0);
```

---

## Service Layer Analysis

### Current Services

#### `tasks-service.js` - Key Findings
**Line 169:**
```javascript
// Set default status to 'active' for manually created tasks
// 'pending' is reserved for tasks with dependencies that need to be resolved first
if (!taskData.status) {
  taskData.status = 'active';
}
```

**Observation:** This comment confirms sequences were planned! 🎯

**Modifications Needed:**
1. ✅ Keep existing `createTask()` for single tasks
2. ➕ Add `createTasksFromSequence(sequenceInstanceId)` function
3. ➕ Modify `completeTask()` to check for sequence and activate next task
4. ➕ Add sequence progression logic

#### `task-templates-service.js` - Key Findings
**Observations:**
- ✅ Well-structured template management
- ✅ Usage tracking already implemented
- ✅ Duplicate template function exists
- ➕ Can be used as building blocks for sequence steps

**Modifications Needed:**
- ✅ Minimal - may reference from sequence steps
- ➕ Consider adding "is_sequence_step" flag to templates

### New Services Needed

#### 1. `sequence-templates-service.js`
**Purpose:** Manage sequence template CRUD operations

**Key Functions:**
```javascript
- listSequenceTemplates(filters)
- getSequenceTemplateById(id)
- createSequenceTemplate(templateData, steps)
- updateSequenceTemplate(id, updates)
- deleteSequenceTemplate(id)
- duplicateSequenceTemplate(id, newName)
- getSequenceTemplateWithSteps(id)
- reorderSteps(templateId, newOrder)
```

#### 2. `sequence-instances-service.js`
**Purpose:** Manage active sequence instances

**Key Functions:**
```javascript
- startSequence(templateId, restaurantId, assignedTo)
- getSequenceInstance(id)
- listSequenceInstances(filters) // By restaurant, status, etc.
- pauseSequence(instanceId)
- resumeSequence(instanceId)
- cancelSequence(instanceId)
- getSequenceProgress(instanceId)
```

#### 3. `sequence-progression-service.js` (Helper)
**Purpose:** Handle automatic task progression logic

**Key Functions:**
```javascript
- activateNextTask(sequenceInstanceId, completedTaskId)
- calculateNextTaskDueDate(completedTask, nextStep)
- updateSequenceStatus(instanceId)
- handleTaskCompletion(taskId) // Hook into task completion
- handleTaskSkip(taskId)
```

---

## Critical Design Decisions

### Decision 1: When to Create Tasks?
**Options:**

**A) Create All Tasks Upfront (Recommended)**
- ✅ Simple to implement
- ✅ Users can see full sequence in task list
- ✅ Can edit pending tasks if needed
- ✅ Clearer visibility into upcoming work
- ❌ More database records created immediately
- ❌ If sequence template changes, existing tasks don't update

**B) Create Tasks On-Demand**
- ✅ Fewer records in database initially
- ✅ Can reflect template updates dynamically
- ❌ More complex to implement
- ❌ Users can't see future tasks
- ❌ Risk of tasks not being created if system fails

**Recommendation:** **Option A** - Create all tasks upfront for simplicity and visibility.

---

### Decision 2: What Happens When a Task is Deleted?
**Options:**

**A) Block Deletion (Strict)**
- ✅ Maintains sequence integrity
- ❌ Inflexible

**B) Allow Deletion, Skip to Next (Flexible)**
- ✅ Flexible for users
- ✅ Handles edge cases
- ❌ Requires logic to find next task
- Recommended: Mark sequence as "modified" for tracking

**C) Cancel Entire Sequence**
- ✅ Prevents broken sequences
- ❌ Too strict

**Recommendation:** **Option B** with tracking and warnings.

---

### Decision 3: Can Tasks Be Completed Out of Order?
**Options:**

**A) Strictly Enforce Order**
- Only active task can be completed
- Prevents completing future tasks

**B) Allow with Warning**
- Allow completing any task
- Show warning if skipping steps
- Auto-activate next task when out-of-order task completed

**Recommendation:** **Option B** - Allow flexibility but warn users.

---

### Decision 4: Delay Calculation
**Options:**

**A) Delay from Sequence Start**
- Step 1: Start + 0 days
- Step 2: Start + 3 days
- Step 3: Start + 7 days

**B) Delay from Previous Completion (Recommended)**
- Step 1: Now
- Step 2: Step 1 completion + 3 days
- Step 3: Step 2 completion + 4 days

**Recommendation:** **Option B** - More flexible and handles variable completion times.

---

### Decision 5: Sequence Instance Naming
**Options:**

**A) Copy Template Name**
```
"Demo Follow-up Sequence"
```

**B) Add Context**
```
"Demo Follow-up Sequence - Bella Pizza - 2025-01-17"
```

**Recommendation:** **Option B** for clarity in lists.

---

## Integration Points

### Frontend Components Needed

#### 1. Sequence Template Builder
**Location:** `/src/pages/SequenceTemplates.tsx`

**Features:**
- List of sequence templates
- Create/Edit sequence modal
- Drag-and-drop step ordering
- Step configuration (task template selection, delays)
- Preview sequence timeline
- Duplicate/Archive templates

#### 2. Sequence Instance Manager
**Location:** `/src/pages/Sequences.tsx` or integrated into Restaurants page

**Features:**
- View active sequences for a restaurant
- Start new sequence
- View progress (X of Y tasks completed)
- Pause/Resume/Cancel sequence
- Visual timeline/progress indicator

#### 3. Restaurant Detail Enhancement
**Location:** `/src/pages/RestaurantDetail.jsx`

**Features:**
- "Start Sequence" button
- List of active sequences for this restaurant
- Quick view of sequence progress

#### 4. Task List Enhancement
**Location:** `/src/pages/Tasks.tsx`

**Features:**
- Filter tasks by sequence
- Show sequence badge on tasks
- Show task position in sequence (e.g., "Step 2 of 5")
- Link to sequence instance

---

### API Endpoints Needed

#### Sequence Templates
```javascript
GET    /api/sequence-templates              // List all
GET    /api/sequence-templates/:id          // Get one with steps
POST   /api/sequence-templates              // Create
PATCH  /api/sequence-templates/:id          // Update
DELETE /api/sequence-templates/:id          // Delete
POST   /api/sequence-templates/:id/duplicate // Duplicate

// Steps management
POST   /api/sequence-templates/:id/steps    // Add step
PATCH  /api/sequence-steps/:id              // Update step
DELETE /api/sequence-steps/:id              // Delete step
POST   /api/sequence-templates/:id/reorder  // Reorder steps
```

#### Sequence Instances
```javascript
GET    /api/sequence-instances              // List (with filters)
GET    /api/sequence-instances/:id          // Get one
POST   /api/sequence-instances              // Start sequence
PATCH  /api/sequence-instances/:id/pause    // Pause
PATCH  /api/sequence-instances/:id/resume   // Resume
PATCH  /api/sequence-instances/:id/cancel   // Cancel
GET    /api/sequence-instances/:id/progress // Get progress
```

#### Restaurant Sequences
```javascript
GET    /api/restaurants/:id/sequences       // Get all sequences for restaurant
POST   /api/restaurants/:id/sequences/start // Start a sequence
```

---

## Potential Challenges

### Challenge 1: Task Completion Hook
**Problem:** Need to intercept task completion to activate next task

**Solutions:**
1. **Database Trigger** (Complex but robust)
   - Create PostgreSQL trigger on tasks table
   - Call function to activate next task
   - ❌ Complex to debug
   - ❌ Logic in database instead of application

2. **Service Layer Hook** (Recommended)
   - Modify `completeTask()` function
   - Check if task has `sequence_instance_id`
   - Call sequence progression service
   - ✅ Easier to debug
   - ✅ Logic in application layer

**Recommendation:** Service layer hook

---

### Challenge 2: Race Conditions
**Problem:** What if two tasks in a sequence are completed simultaneously?

**Solutions:**
1. Database transactions
2. Optimistic locking
3. Status checks before activation

**Recommendation:** Use transactions in `activateNextTask()`

---

### Challenge 3: Editing Active Sequences
**Problem:** What if user edits template while instances are active?

**Solutions:**
1. **Snapshot Approach** (Recommended)
   - Sequence instances are snapshots
   - Template changes don't affect active instances
   - ✅ Prevents breaking active sequences

2. **Live Update**
   - Template changes update active instances
   - ❌ Could break in-progress sequences

**Recommendation:** Snapshot approach

---

### Challenge 4: Performance with Many Tasks
**Problem:** A sequence with 20 steps creates 20 task records immediately

**Solutions:**
1. Batch insert optimization
2. Database indexes on sequence columns
3. Pagination in task lists
4. Filter tasks by status in UI

**Recommendation:** All of the above

---

### Challenge 5: Abandoned Sequences
**Problem:** Sequences that are never completed

**Solutions:**
1. Auto-cancel after X days of inactivity
2. "Stale sequence" detection
3. Reporting on incomplete sequences

**Recommendation:** Implement stale sequence cleanup job (future enhancement)

---

## Questions for Discussion

### Database Schema Questions

1. **Step Configuration Flexibility**
   - Should steps allow fully custom task configuration, or must they reference a task template?
   - **Recommendation:** Allow both - reference template OR custom config in metadata

2. **Delay Granularity**
   - Do we need minute-level delays, or are hours/days sufficient?
   - **Recommendation:** Support minutes, hours, days for maximum flexibility

3. **First Task Timing**
   - Should the first task always be active immediately, or allow a start delay?
   - **Recommendation:** Allow optional start delay (default 0)

4. **Metadata vs. Explicit Columns**
   - What extra data might need to be stored in metadata fields?
   - Possible: webhook_on_complete, custom_fields, integration_data

---

### Business Logic Questions

1. **Task Deletion in Sequence**
   - Hard prevent, soft prevent with warning, or allow freely?
   - **Recommendation:** Allow with warning + mark sequence as "modified"

2. **Sequence Cancellation**
   - Should cancelled sequences delete their tasks, or leave them as orphans?
   - **Recommendation:** Leave tasks but mark them clearly as "from cancelled sequence"

3. **Out-of-Order Completion**
   - Allow or prevent?
   - **Recommendation:** Allow with warning

4. **Skipping Tasks**
   - Should there be an explicit "Skip" action?
   - **Recommendation:** Yes - different from delete or cancel

5. **Paused Sequences**
   - When resumed, should delays recalculate from pause point or completion point?
   - **Recommendation:** From resume point (more predictable)

---

### User Experience Questions

1. **Default Assignment**
   - Should all tasks in sequence inherit restaurant's assigned_sales_rep?
   - **Recommendation:** Yes, but allow per-step overrides

2. **Notifications**
   - Email/Slack when sequence starts? When task becomes active?
   - **Recommendation:** Future enhancement - Phase 2

3. **Sequence Templates Categories**
   - How to organize templates? (Tags, folders, categories)
   - **Recommendation:** Use tags array on template

4. **Visual Representation**
   - Timeline view? Kanban? List?
   - **Recommendation:** Start with list, enhance with timeline in future

---

### Technical Questions

1. **Transaction Strategy**
   - Where do we need database transactions?
   - **Recommendation:**
     - Starting sequence (create instance + tasks)
     - Completing task (update task + activate next)

2. **Bulk Operations**
   - How to handle "Start same sequence for 50 restaurants"?
   - **Recommendation:** Queue-based background job (future enhancement)

3. **Testing Strategy**
   - How to test sequence progression without waiting for delays?
   - **Recommendation:** Test mode with instant delays

4. **Migration Strategy**
   - Can we migrate existing tasks into sequences retroactively?
   - **Recommendation:** No - too complex. Sequences are forward-only.

---

## Implementation Complexity Estimate

### Database (1-2 days)
- Create 3 new tables
- Add 2 columns to tasks table
- Create indexes
- Write RLS policies
- Write migration scripts

### Backend Services (3-4 days)
- sequence-templates-service.js
- sequence-instances-service.js
- sequence-progression-service.js
- Update tasks-service.js completion hook
- Write API routes
- Write tests

### Frontend (4-5 days)
- SequenceTemplates page + modals
- Sequence instance UI
- Restaurant detail integration
- Task list enhancements
- Progress indicators

### Testing & Polish (2-3 days)
- Unit tests
- Integration tests
- E2E tests
- Bug fixes
- Documentation

**Total Estimate: 10-14 days**

---

## Recommended Next Steps

1. **Review & Discuss** this investigation document
2. **Answer critical questions** above
3. **Validate architecture choice** (recommend Approach 2 - Three-Table Model)
4. **Create detailed implementation plan** with specific tasks
5. **Design mockups** for sequence builder UI
6. **Write database migration scripts**
7. **Begin implementation** (Database → Backend → Frontend)

---

## Appendix: Example Sequence Template

### "Demo Follow-up Sequence"

**Purpose:** Follow up with leads after demo booking

**Steps:**

| Step | Delay | Type | Name | Message Template |
|------|-------|------|------|------------------|
| 1 | 0 days | email | Send demo confirmation | "Demo Confirmation Email" |
| 2 | 1 day | internal_activity | Prepare demo materials | - |
| 3 | 1 day | call | Reminder call day before | - |
| 4 | 1 day | internal_activity | Conduct demo | - |
| 5 | 1 day | email | Follow-up email | "Post-Demo Follow-up" |
| 6 | 3 days | call | Check-in call | - |
| 7 | 7 days | email | Contract proposal | "Contract Email Template" |

**Total Duration:** ~14 days
**Total Tasks:** 7

**Workflow:**
1. Sales rep books demo → Starts sequence
2. Step 1 activates immediately
3. As each task is completed, next task activates with calculated due date
4. Sequence completes when all 7 tasks done

---

**End of Investigation Summary**
