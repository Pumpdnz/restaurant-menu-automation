# Task Sequence System - Database Schema

**Version:** 1.0
**Last Updated:** 2025-01-17

---

## Table of Contents

1. [Overview](#overview)
2. [Table Definitions](#table-definitions)
3. [Relationships](#relationships)
4. [Indexes](#indexes)
5. [Constraints](#constraints)
6. [Row Level Security](#row-level-security)
7. [Migration Scripts](#migration-scripts)
8. [Rollback Scripts](#rollback-scripts)

---

## Overview

The sequence system adds **3 new tables** and modifies **1 existing table**:

### New Tables
1. **`sequence_templates`** - Reusable sequence definitions
2. **`sequence_steps`** - Steps within each template
3. **`sequence_instances`** - Active sequences applied to restaurants

### Modified Tables
4. **`tasks`** - Add sequence tracking columns

---

## Table Definitions

### 1. sequence_templates

**Purpose:** Store reusable sequence workflow definitions

```sql
CREATE TABLE public.sequence_templates (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Ownership
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Template information
  name TEXT NOT NULL CHECK (length(name) >= 3 AND length(name) <= 100),
  description TEXT CHECK (length(description) <= 1000),

  -- Categorization
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comments
COMMENT ON TABLE sequence_templates IS 'Reusable sequence workflow definitions';
COMMENT ON COLUMN sequence_templates.tags IS 'Array of tags for categorization (e.g., onboarding, follow-up, demo)';
COMMENT ON COLUMN sequence_templates.usage_count IS 'Number of times this template has been used to create sequences';
```

**Columns Explained:**

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | Auto-generated |
| `organisation_id` | UUID | Links to organization | NOT NULL, FK to organisations |
| `created_by` | UUID | User who created template | FK to auth.users, nullable |
| `name` | TEXT | Template name | 3-100 chars, required |
| `description` | TEXT | Template description | Max 1000 chars, optional |
| `tags` | TEXT[] | Category tags | Array, defaults to empty |
| `is_active` | BOOLEAN | Template is active | Defaults to true |
| `usage_count` | INTEGER | Number of times used | Auto-incremented |
| `metadata` | JSONB | Additional custom data | Optional |
| `created_at` | TIMESTAMPTZ | Creation timestamp | Auto-set |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | Auto-updated |

---

### 2. sequence_steps

**Purpose:** Define steps within each sequence template

```sql
CREATE TABLE public.sequence_steps (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parent reference
  sequence_template_id UUID NOT NULL REFERENCES sequence_templates(id) ON DELETE CASCADE,

  -- Step configuration
  step_order INTEGER NOT NULL CHECK (step_order > 0),
  name TEXT NOT NULL CHECK (length(name) >= 3 AND length(name) <= 100),
  description TEXT CHECK (length(description) <= 500),

  -- Task template reference (optional)
  task_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,

  -- Task configuration (required if no template)
  type TEXT NOT NULL CHECK (
    type IN ('internal_activity', 'social_message', 'text', 'email', 'call')
  ),
  priority TEXT DEFAULT 'medium' NOT NULL CHECK (
    priority IN ('low', 'medium', 'high')
  ),

  -- Message configuration
  message_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  custom_message TEXT,

  -- Timing configuration
  delay_value INTEGER DEFAULT 0 NOT NULL CHECK (delay_value >= 0),
  delay_unit TEXT DEFAULT 'days' NOT NULL CHECK (
    delay_unit IN ('minutes', 'hours', 'days')
  ),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Unique constraint: step_order must be unique within template
  CONSTRAINT sequence_steps_unique_order UNIQUE (sequence_template_id, step_order)
);

-- Comments
COMMENT ON TABLE sequence_steps IS 'Steps within sequence templates, defining task order and delays';
COMMENT ON COLUMN sequence_steps.step_order IS 'Order of this step in the sequence (1-indexed)';
COMMENT ON COLUMN sequence_steps.delay_value IS 'Number of time units to delay after previous step completes';
COMMENT ON COLUMN sequence_steps.delay_unit IS 'Unit for delay: minutes, hours, or days';
COMMENT ON COLUMN sequence_steps.task_template_id IS 'Optional reference to task template for defaults';
```

**Columns Explained:**

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | Auto-generated |
| `sequence_template_id` | UUID | Parent sequence template | NOT NULL, FK, CASCADE delete |
| `step_order` | INTEGER | Position in sequence (1, 2, 3...) | Must be > 0, unique per template |
| `name` | TEXT | Step name | 3-100 chars, required |
| `description` | TEXT | Step description | Max 500 chars, optional |
| `task_template_id` | UUID | Reference to task template | Optional, SET NULL on delete |
| `type` | TEXT | Task type | Required, limited values |
| `priority` | TEXT | Task priority | Defaults to 'medium' |
| `message_template_id` | UUID | Message template reference | Optional |
| `custom_message` | TEXT | Custom message override | Optional |
| `delay_value` | INTEGER | Delay amount | >= 0, defaults to 0 |
| `delay_unit` | TEXT | Delay unit | minutes/hours/days |
| `metadata` | JSONB | Additional custom data | Optional |
| `created_at` | TIMESTAMPTZ | Creation timestamp | Auto-set |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | Auto-updated |

**Design Notes:**
- First step typically has `delay_value = 0` (immediate activation)
- Subsequent steps have delays relative to previous step completion
- Can reference task template OR use custom configuration
- `step_order` must be unique and sequential within template

---

### 3. sequence_instances

**Purpose:** Track active sequences applied to restaurants

```sql
CREATE TABLE public.sequence_instances (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  sequence_template_id UUID NOT NULL REFERENCES sequence_templates(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Instance information (snapshot from template)
  name TEXT NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'active' NOT NULL CHECK (
    status IN ('active', 'paused', 'completed', 'cancelled')
  ),
  current_step_order INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL CHECK (total_steps > 0),

  -- Assignments
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT sequence_instances_status_completed_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT sequence_instances_status_cancelled_check CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
    (status != 'cancelled' AND cancelled_at IS NULL)
  ),
  CONSTRAINT sequence_instances_status_paused_check CHECK (
    (status = 'paused' AND paused_at IS NOT NULL) OR
    (status != 'paused' AND paused_at IS NULL)
  )
);

-- Comments
COMMENT ON TABLE sequence_instances IS 'Active sequences applied to restaurants';
COMMENT ON COLUMN sequence_instances.name IS 'Snapshot of template name at creation (format: "Template - Restaurant - Date")';
COMMENT ON COLUMN sequence_instances.current_step_order IS 'Current active step in sequence';
COMMENT ON COLUMN sequence_instances.total_steps IS 'Total number of steps (snapshot from template at creation)';
```

**Columns Explained:**

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | Auto-generated |
| `sequence_template_id` | UUID | Source template | NOT NULL, FK, CASCADE delete |
| `restaurant_id` | UUID | Target restaurant | NOT NULL, FK, CASCADE delete |
| `organisation_id` | UUID | Organization | NOT NULL, FK, CASCADE delete |
| `name` | TEXT | Instance name | Snapshot from template |
| `status` | TEXT | Current status | active/paused/completed/cancelled |
| `current_step_order` | INTEGER | Active step number | Updated as sequence progresses |
| `total_steps` | INTEGER | Total steps count | Snapshot at creation |
| `assigned_to` | UUID | Assigned user | Optional, defaults to creator |
| `created_by` | UUID | Creator user | Optional |
| `started_at` | TIMESTAMPTZ | When sequence started | Auto-set |
| `paused_at` | TIMESTAMPTZ | When paused | NULL unless paused |
| `completed_at` | TIMESTAMPTZ | When completed | NULL unless completed |
| `cancelled_at` | TIMESTAMPTZ | When cancelled | NULL unless cancelled |
| `metadata` | JSONB | Additional custom data | Optional |
| `created_at` | TIMESTAMPTZ | Creation timestamp | Auto-set |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | Auto-updated |

**Status Lifecycle:**
```
active → paused → active (resume)
active → completed (all tasks done)
active → cancelled (user cancels)
paused → cancelled (user cancels)
```

**Design Notes:**
- `name` is a snapshot to preserve original template name even if template renamed
- Typical format: `"{template.name} - {restaurant.name} - {YYYY-MM-DD}"`
- `total_steps` is snapshot to handle template modifications after instance creation
- Status constraints ensure appropriate timestamps are set

---

### 4. tasks (Modifications)

**Purpose:** Add sequence tracking to existing tasks table

```sql
-- Add new columns to existing tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sequence_instance_id UUID
    REFERENCES sequence_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_step_order INTEGER;

-- Add check constraint
ALTER TABLE tasks
  ADD CONSTRAINT tasks_sequence_step_order_check
  CHECK (sequence_step_order IS NULL OR sequence_step_order > 0);

-- Add constraint: if sequence_instance_id is set, sequence_step_order must be set
ALTER TABLE tasks
  ADD CONSTRAINT tasks_sequence_consistency_check
  CHECK (
    (sequence_instance_id IS NULL AND sequence_step_order IS NULL) OR
    (sequence_instance_id IS NOT NULL AND sequence_step_order IS NOT NULL)
  );

-- Update column comments
COMMENT ON COLUMN tasks.sequence_instance_id IS 'Links task to a sequence instance (NULL for standalone tasks)';
COMMENT ON COLUMN tasks.sequence_step_order IS 'Position of this task within its sequence (NULL for standalone tasks)';
```

**New Columns:**

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `sequence_instance_id` | UUID | Links to sequence instance | Optional, FK, SET NULL on delete |
| `sequence_step_order` | INTEGER | Step position in sequence | Optional, must be > 0 |

**Design Notes:**
- Both columns are NULL for standalone (non-sequence) tasks
- If task is part of a sequence, both columns must be populated
- `sequence_step_order` corresponds to the step's position (1, 2, 3...)
- Deleting sequence instance sets `sequence_instance_id` to NULL (tasks remain)

---

## Relationships

### Entity Relationship Diagram

```
┌──────────────────┐
│  organisations   │
│  (existing)      │
└────────┬─────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐
│ sequence_templates   │
│ - id                 │
│ - organisation_id ◄──┘
│ - name               │
│ - tags[]             │
└────────┬─────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐
│  sequence_steps      │
│  - id                │
│  - seq_template_id ◄─┘
│  - step_order        │
│  - delay_value/unit  │
│  - task_template_id ─┐
│  - msg_template_id ──┼─┐
└──────────────────────┘ │ │
                         │ │
         ┌───────────────┘ │
         │ (optional)      │
         ▼                 │
┌──────────────────┐      │
│ task_templates   │      │
│ (existing)       │      │
└──────────────────┘      │
                          │ (optional)
         ┌────────────────┘
         ▼
┌──────────────────┐
│ message_templates│
│ (existing)       │
└──────────────────┘

┌──────────────────┐
│  restaurants     │
│  (existing)      │
└────────┬─────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐
│ sequence_instances   │
│ - id                 │
│ - restaurant_id   ◄──┘
│ - seq_template_id ◄──┐
│ - status             │ │
│ - current_step       │ │
└────────┬─────────────┘ │
         │                │
         │ 1:N            │ (reference)
         ▼                │
┌──────────────────┐     │
│  tasks           │     │
│  (existing +     │     │
│   enhanced)      │     │
│ + seq_instance ◄─┘     │
│ + seq_step_order       │
└────────────────────────┘
```

### Relationship Summary

| Parent Table | Child Table | Relationship | ON DELETE |
|--------------|-------------|--------------|-----------|
| `organisations` | `sequence_templates` | 1:N | CASCADE |
| `sequence_templates` | `sequence_steps` | 1:N | CASCADE |
| `sequence_templates` | `sequence_instances` | 1:N | CASCADE |
| `task_templates` | `sequence_steps` | 1:N (optional) | SET NULL |
| `message_templates` | `sequence_steps` | 1:N (optional) | SET NULL |
| `restaurants` | `sequence_instances` | 1:N | CASCADE |
| `sequence_instances` | `tasks` | 1:N | SET NULL |
| `auth.users` | `sequence_templates` | 1:N (creator) | SET NULL |
| `auth.users` | `sequence_instances` | 1:N (creator/assigned) | SET NULL |

**Cascade Behavior:**
- Deleting an organization → Deletes all templates, instances, and tasks
- Deleting a template → Deletes all steps and instances (and their tasks)
- Deleting a restaurant → Deletes all instances (tasks remain but unlinked)
- Deleting an instance → Tasks remain but `sequence_instance_id` set to NULL
- Deleting a task template → Sequence steps remain but `task_template_id` set to NULL

---

## Indexes

### Performance-Critical Indexes

```sql
-- sequence_templates indexes
CREATE INDEX idx_sequence_templates_org
  ON sequence_templates(organisation_id);

CREATE INDEX idx_sequence_templates_active
  ON sequence_templates(is_active)
  WHERE is_active = TRUE;

CREATE INDEX idx_sequence_templates_tags
  ON sequence_templates USING GIN(tags);

-- sequence_steps indexes
CREATE INDEX idx_sequence_steps_template
  ON sequence_steps(sequence_template_id);

CREATE INDEX idx_sequence_steps_template_order
  ON sequence_steps(sequence_template_id, step_order);

CREATE INDEX idx_sequence_steps_task_template
  ON sequence_steps(task_template_id)
  WHERE task_template_id IS NOT NULL;

-- sequence_instances indexes
CREATE INDEX idx_sequence_instances_template
  ON sequence_instances(sequence_template_id);

CREATE INDEX idx_sequence_instances_restaurant
  ON sequence_instances(restaurant_id);

CREATE INDEX idx_sequence_instances_org
  ON sequence_instances(organisation_id);

CREATE INDEX idx_sequence_instances_status
  ON sequence_instances(status);

CREATE INDEX idx_sequence_instances_assigned
  ON sequence_instances(assigned_to)
  WHERE assigned_to IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_sequence_instances_restaurant_status
  ON sequence_instances(restaurant_id, status);

CREATE INDEX idx_sequence_instances_org_status
  ON sequence_instances(organisation_id, status);

-- tasks table new indexes
CREATE INDEX idx_tasks_sequence_instance
  ON tasks(sequence_instance_id)
  WHERE sequence_instance_id IS NOT NULL;

CREATE INDEX idx_tasks_sequence_instance_order
  ON tasks(sequence_instance_id, sequence_step_order)
  WHERE sequence_instance_id IS NOT NULL;

CREATE INDEX idx_tasks_sequence_status
  ON tasks(sequence_instance_id, status)
  WHERE sequence_instance_id IS NOT NULL;
```

### Index Usage Patterns

| Query Pattern | Index Used |
|---------------|------------|
| Get active sequences for restaurant | `idx_sequence_instances_restaurant_status` |
| Get all tasks in a sequence | `idx_tasks_sequence_instance` |
| Get next task in sequence | `idx_tasks_sequence_instance_order` |
| Get templates by tag | `idx_sequence_templates_tags` (GIN) |
| Get active templates | `idx_sequence_templates_active` (partial) |
| Get steps for template | `idx_sequence_steps_template_order` |

---

## Constraints

### Primary Key Constraints

All tables use UUID primary keys:
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

### Foreign Key Constraints

**sequence_templates:**
- `organisation_id` → `organisations(id)` ON DELETE CASCADE
- `created_by` → `auth.users(id)` ON DELETE SET NULL

**sequence_steps:**
- `sequence_template_id` → `sequence_templates(id)` ON DELETE CASCADE
- `task_template_id` → `task_templates(id)` ON DELETE SET NULL
- `message_template_id` → `message_templates(id)` ON DELETE SET NULL

**sequence_instances:**
- `sequence_template_id` → `sequence_templates(id)` ON DELETE CASCADE
- `restaurant_id` → `restaurants(id)` ON DELETE CASCADE
- `organisation_id` → `organisations(id)` ON DELETE CASCADE
- `assigned_to` → `auth.users(id)` ON DELETE SET NULL
- `created_by` → `auth.users(id)` ON DELETE SET NULL

**tasks (new):**
- `sequence_instance_id` → `sequence_instances(id)` ON DELETE SET NULL

### Check Constraints

**sequence_templates:**
```sql
CHECK (length(name) >= 3 AND length(name) <= 100)
CHECK (length(description) <= 1000)
```

**sequence_steps:**
```sql
CHECK (step_order > 0)
CHECK (length(name) >= 3 AND length(name) <= 100)
CHECK (length(description) <= 500)
CHECK (type IN ('internal_activity', 'social_message', 'text', 'email', 'call'))
CHECK (priority IN ('low', 'medium', 'high'))
CHECK (delay_value >= 0)
CHECK (delay_unit IN ('minutes', 'hours', 'days'))
```

**sequence_instances:**
```sql
CHECK (status IN ('active', 'paused', 'completed', 'cancelled'))
CHECK (total_steps > 0)
CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status != 'completed'))
CHECK ((status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status != 'cancelled'))
CHECK ((status = 'paused' AND paused_at IS NOT NULL) OR (status != 'paused'))
```

**tasks (new):**
```sql
CHECK (sequence_step_order IS NULL OR sequence_step_order > 0)
CHECK (
  (sequence_instance_id IS NULL AND sequence_step_order IS NULL) OR
  (sequence_instance_id IS NOT NULL AND sequence_step_order IS NOT NULL)
)
```

### Unique Constraints

```sql
-- Ensure step_order is unique within template
ALTER TABLE sequence_steps
  ADD CONSTRAINT sequence_steps_unique_order
  UNIQUE (sequence_template_id, step_order);
```

---

## Row Level Security

### Enable RLS on All Tables

```sql
ALTER TABLE sequence_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_instances ENABLE ROW LEVEL SECURITY;
```

### RLS Policies

#### sequence_templates Policies

```sql
-- Users can only access templates for their organization
CREATE POLICY sequence_templates_org_policy
  ON sequence_templates
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Allow insert for authenticated users in their org
CREATE POLICY sequence_templates_insert_policy
  ON sequence_templates
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );
```

#### sequence_steps Policies

```sql
-- Users can only access steps for templates in their organization
CREATE POLICY sequence_steps_org_policy
  ON sequence_steps
  FOR ALL
  USING (
    sequence_template_id IN (
      SELECT id
      FROM sequence_templates
      WHERE organisation_id IN (
        SELECT organisation_id
        FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Allow insert for templates in user's org
CREATE POLICY sequence_steps_insert_policy
  ON sequence_steps
  FOR INSERT
  WITH CHECK (
    sequence_template_id IN (
      SELECT id
      FROM sequence_templates
      WHERE organisation_id IN (
        SELECT organisation_id
        FROM profiles
        WHERE id = auth.uid()
      )
    )
  );
```

#### sequence_instances Policies

```sql
-- Users can only access instances for their organization
CREATE POLICY sequence_instances_org_policy
  ON sequence_instances
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Allow insert for user's org
CREATE POLICY sequence_instances_insert_policy
  ON sequence_instances
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id
      FROM profiles
      WHERE id = auth.uid()
    )
  );
```

---

## Migration Scripts

### Migration Order

Migrations must be applied in this exact order:

1. `001_create_sequence_templates.sql`
2. `002_create_sequence_steps.sql`
3. `003_create_sequence_instances.sql`
4. `004_alter_tasks_add_sequence_columns.sql`

### 001_create_sequence_templates.sql

```sql
-- Migration: Create sequence_templates table
-- Description: Stores reusable sequence workflow definitions
-- Dependencies: organisations table, auth.users table
-- Applied: [DATE]

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS public.sequence_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(name) >= 3 AND length(name) <= 100),
  description TEXT CHECK (length(description) <= 1000),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_sequence_templates_org ON sequence_templates(organisation_id);
CREATE INDEX idx_sequence_templates_active ON sequence_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sequence_templates_tags ON sequence_templates USING GIN(tags);

-- Enable RLS
ALTER TABLE sequence_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY sequence_templates_org_policy
  ON sequence_templates
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY sequence_templates_insert_policy
  ON sequence_templates
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_sequence_templates_updated_at
  BEFORE UPDATE ON sequence_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE sequence_templates IS 'Reusable sequence workflow definitions';
COMMENT ON COLUMN sequence_templates.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN sequence_templates.usage_count IS 'Number of times used';

COMMIT;
```

### 002_create_sequence_steps.sql

```sql
-- Migration: Create sequence_steps table
-- Description: Stores steps within sequence templates
-- Dependencies: sequence_templates, task_templates, message_templates
-- Applied: [DATE]

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_template_id UUID NOT NULL REFERENCES sequence_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order > 0),
  name TEXT NOT NULL CHECK (length(name) >= 3 AND length(name) <= 100),
  description TEXT CHECK (length(description) <= 500),
  task_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('internal_activity', 'social_message', 'text', 'email', 'call')),
  priority TEXT DEFAULT 'medium' NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  message_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  custom_message TEXT,
  delay_value INTEGER DEFAULT 0 NOT NULL CHECK (delay_value >= 0),
  delay_unit TEXT DEFAULT 'days' NOT NULL CHECK (delay_unit IN ('minutes', 'hours', 'days')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT sequence_steps_unique_order UNIQUE (sequence_template_id, step_order)
);

-- Create indexes
CREATE INDEX idx_sequence_steps_template ON sequence_steps(sequence_template_id);
CREATE INDEX idx_sequence_steps_template_order ON sequence_steps(sequence_template_id, step_order);
CREATE INDEX idx_sequence_steps_task_template ON sequence_steps(task_template_id) WHERE task_template_id IS NOT NULL;

-- Enable RLS
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY sequence_steps_org_policy
  ON sequence_steps
  FOR ALL
  USING (
    sequence_template_id IN (
      SELECT id FROM sequence_templates
      WHERE organisation_id IN (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY sequence_steps_insert_policy
  ON sequence_steps
  FOR INSERT
  WITH CHECK (
    sequence_template_id IN (
      SELECT id FROM sequence_templates
      WHERE organisation_id IN (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_sequence_steps_updated_at
  BEFORE UPDATE ON sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE sequence_steps IS 'Steps within sequence templates';
COMMENT ON COLUMN sequence_steps.step_order IS 'Order of step in sequence (1-indexed)';
COMMENT ON COLUMN sequence_steps.delay_value IS 'Number of time units to delay';
COMMENT ON COLUMN sequence_steps.delay_unit IS 'Unit: minutes, hours, or days';

COMMIT;
```

### 003_create_sequence_instances.sql

```sql
-- Migration: Create sequence_instances table
-- Description: Stores active sequences applied to restaurants
-- Dependencies: sequence_templates, restaurants, organisations
-- Applied: [DATE]

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS public.sequence_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_template_id UUID NOT NULL REFERENCES sequence_templates(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_step_order INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL CHECK (total_steps > 0),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT sequence_instances_completed_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR (status != 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT sequence_instances_cancelled_check CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status != 'cancelled' AND cancelled_at IS NULL)
  ),
  CONSTRAINT sequence_instances_paused_check CHECK (
    (status = 'paused' AND paused_at IS NOT NULL) OR (status != 'paused' AND paused_at IS NULL)
  )
);

-- Create indexes
CREATE INDEX idx_sequence_instances_template ON sequence_instances(sequence_template_id);
CREATE INDEX idx_sequence_instances_restaurant ON sequence_instances(restaurant_id);
CREATE INDEX idx_sequence_instances_org ON sequence_instances(organisation_id);
CREATE INDEX idx_sequence_instances_status ON sequence_instances(status);
CREATE INDEX idx_sequence_instances_assigned ON sequence_instances(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_sequence_instances_restaurant_status ON sequence_instances(restaurant_id, status);
CREATE INDEX idx_sequence_instances_org_status ON sequence_instances(organisation_id, status);

-- Enable RLS
ALTER TABLE sequence_instances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY sequence_instances_org_policy
  ON sequence_instances
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY sequence_instances_insert_policy
  ON sequence_instances
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_sequence_instances_updated_at
  BEFORE UPDATE ON sequence_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE sequence_instances IS 'Active sequences applied to restaurants';
COMMENT ON COLUMN sequence_instances.name IS 'Snapshot of template name at creation';
COMMENT ON COLUMN sequence_instances.current_step_order IS 'Current active step';
COMMENT ON COLUMN sequence_instances.total_steps IS 'Total steps (snapshot)';

COMMIT;
```

### 004_alter_tasks_add_sequence_columns.sql

```sql
-- Migration: Add sequence tracking to tasks table
-- Description: Adds columns to link tasks to sequence instances
-- Dependencies: sequence_instances table
-- Applied: [DATE]

BEGIN;

-- Add columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sequence_instance_id UUID
    REFERENCES sequence_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_step_order INTEGER;

-- Add constraints
ALTER TABLE tasks
  ADD CONSTRAINT tasks_sequence_step_order_check
  CHECK (sequence_step_order IS NULL OR sequence_step_order > 0);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_sequence_consistency_check
  CHECK (
    (sequence_instance_id IS NULL AND sequence_step_order IS NULL) OR
    (sequence_instance_id IS NOT NULL AND sequence_step_order IS NOT NULL)
  );

-- Create indexes
CREATE INDEX idx_tasks_sequence_instance
  ON tasks(sequence_instance_id)
  WHERE sequence_instance_id IS NOT NULL;

CREATE INDEX idx_tasks_sequence_instance_order
  ON tasks(sequence_instance_id, sequence_step_order)
  WHERE sequence_instance_id IS NOT NULL;

CREATE INDEX idx_tasks_sequence_status
  ON tasks(sequence_instance_id, status)
  WHERE sequence_instance_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN tasks.sequence_instance_id IS 'Links task to sequence instance (NULL for standalone tasks)';
COMMENT ON COLUMN tasks.sequence_step_order IS 'Position in sequence (NULL for standalone tasks)';

COMMIT;
```

---

## Rollback Scripts

### Rollback Order

Rollbacks must be applied in **reverse** order:

1. Rollback `004_alter_tasks_add_sequence_columns.sql`
2. Rollback `003_create_sequence_instances.sql`
3. Rollback `002_create_sequence_steps.sql`
4. Rollback `001_create_sequence_templates.sql`

### Rollback 004

```sql
BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS idx_tasks_sequence_instance;
DROP INDEX IF EXISTS idx_tasks_sequence_instance_order;
DROP INDEX IF EXISTS idx_tasks_sequence_status;

-- Drop constraints
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_sequence_step_order_check;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_sequence_consistency_check;

-- Drop columns
ALTER TABLE tasks DROP COLUMN IF EXISTS sequence_instance_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS sequence_step_order;

COMMIT;
```

### Rollback 003

```sql
BEGIN;

DROP TABLE IF EXISTS sequence_instances CASCADE;

COMMIT;
```

### Rollback 002

```sql
BEGIN;

DROP TABLE IF EXISTS sequence_steps CASCADE;

COMMIT;
```

### Rollback 001

```sql
BEGIN;

DROP TABLE IF EXISTS sequence_templates CASCADE;

COMMIT;
```

---

**End of Database Schema Document**

For implementation instructions, see [implementation-roadmap.md](implementation-roadmap.md).
