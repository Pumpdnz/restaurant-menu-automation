# Sales-Specific Features Implementation Plan

**Version:** 2.0
**Date:** November 21, 2025
**Status:** ✅ Phases 1-6 COMPLETE

---

## 🎯 Current Status Update

**All planned phases (1-6) have been successfully completed:**
- ✅ Phase 1: Database Schema Changes - COMPLETE
- ✅ Phase 2: Backend API Implementation - COMPLETE
- ✅ Phase 3: Frontend - Restaurants Page Filtering - COMPLETE (with multi-select)
- ✅ Phase 4: Frontend - Task Management System - COMPLETE
- ✅ Phase 5: Message Template System - COMPLETE
- ✅ Phase 6: Variable Replacement Engine - COMPLETE (46+ variables)

**Additional completions beyond original plan:**
- ✅ Task Templates UI (complete page with management)
- ✅ Multi-select filters (upgraded from single-select)
- ✅ Demo Booking Feature (18 qualification fields, bi-directional sync)
- ✅ All critical bug fixes

**Next Phase:** See [ENHANCEMENTS-INVESTIGATION-PLAN.md](ENHANCEMENTS-INVESTIGATION-PLAN.md) and [PROJECT-STATUS.md](PROJECT-STATUS.md)

---

## Table of Contents
1. [Overview](#overview)
2. [Phase 1: Database Schema Changes](#phase-1-database-schema-changes)
3. [Phase 2: Backend API Implementation](#phase-2-backend-api-implementation)
4. [Phase 3: Frontend - Restaurants Page Filtering](#phase-3-frontend---restaurants-page-filtering)
5. [Phase 4: Frontend - Task Management System](#phase-4-frontend---task-management-system)
6. [Phase 5: Message Template System](#phase-5-message-template-system)
7. [Phase 6: Variable Replacement Engine](#phase-6-variable-replacement-engine)
8. [Testing Strategy](#testing-strategy)
9. [Future Extensibility](#future-extensibility)

---

## Overview

### Objectives
This implementation plan outlines the development of sales-specific features to enable the sales team to:
- Filter and organize restaurant leads by various criteria
- Track lead engagement and progression through sales stages
- Manage tasks and communications with leads
- Automate message creation using templates with variable replacement
- Prepare the foundation for future sequence automation

### Key Features
1. **Sales-Specific Restaurant Filtering** - 11 new columns for lead categorization and tracking
2. **Task Management System** - Create, assign, and track sales tasks
3. **Message Templates** - Reusable message templates with variable replacement
4. **Demo Store Tracking** - Track which leads have demo stores built
5. **Lead Warmth & Engagement** - Track lead temperature and engagement touchpoints

### Technology Stack
- **Database:** PostgreSQL (Supabase)
- **Backend:** Node.js/Express.js (Port 3007)
- **Frontend:** React 19.1.0 + TypeScript
- **UI Components:** shadcn/ui (Radix UI)
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **State Management:** React hooks + Context API
- **Data Fetching:** Axios + @tanstack/react-query

---

## Phase 1: Database Schema Changes

### 1.1 Add Sales Columns to Restaurants Table

**Migration File:** `add_sales_specific_columns_to_restaurants.sql`

```sql
-- Migration: Add sales-specific columns to restaurants table
-- Date: 2025-01-16
-- Description: Adds lead tracking, categorization, and sales pipeline columns

BEGIN;

-- Add sales categorization columns
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS lead_type TEXT CHECK (lead_type IN ('inbound', 'outbound')),
  ADD COLUMN IF NOT EXISTS lead_category TEXT CHECK (lead_category IN ('paid_ads', 'organic_content', 'warm_outreach', 'cold_outreach')),
  ADD COLUMN IF NOT EXISTS lead_engagement_source TEXT CHECK (
    lead_engagement_source IN (
      'pending',
      'meta_ad_form',
      'landing_page_demo_booking',
      'website_demo_booking',
      'website_live_chat',
      'inbound_social_media_message',
      'inbound_email',
      'inbound_call',
      'cold_social_media_message',
      'cold_email',
      'cold_call',
      'inbound_referral',
      'outbound_referral'
    )
  ),
  ADD COLUMN IF NOT EXISTS lead_warmth TEXT CHECK (lead_warmth IN ('frozen', 'cold', 'warm', 'hot')),
  ADD COLUMN IF NOT EXISTS lead_stage TEXT CHECK (
    lead_stage IN (
      'uncontacted',
      'reached_out',
      'in_talks',
      'demo_booked',
      'rebook_demo',
      'contract_sent',
      'closed_won',
      'closed_lost',
      'reengaging'
    )
  ),
  ADD COLUMN IF NOT EXISTS lead_status TEXT CHECK (lead_status IN ('active', 'inactive', 'ghosted', 'reengaging', 'closed')),
  ADD COLUMN IF NOT EXISTS icp_rating INTEGER CHECK (icp_rating >= 0 AND icp_rating <= 10),
  ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_store_built BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_store_url TEXT,
  ADD COLUMN IF NOT EXISTS assigned_sales_rep UUID REFERENCES auth.users(id);

-- Add indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_restaurants_lead_type ON public.restaurants(lead_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_lead_category ON public.restaurants(lead_category);
CREATE INDEX IF NOT EXISTS idx_restaurants_lead_warmth ON public.restaurants(lead_warmth);
CREATE INDEX IF NOT EXISTS idx_restaurants_lead_stage ON public.restaurants(lead_stage);
CREATE INDEX IF NOT EXISTS idx_restaurants_lead_status ON public.restaurants(lead_status);
CREATE INDEX IF NOT EXISTS idx_restaurants_icp_rating ON public.restaurants(icp_rating);
CREATE INDEX IF NOT EXISTS idx_restaurants_last_contacted ON public.restaurants(last_contacted);
CREATE INDEX IF NOT EXISTS idx_restaurants_demo_store_built ON public.restaurants(demo_store_built);
CREATE INDEX IF NOT EXISTS idx_restaurants_assigned_sales_rep ON public.restaurants(assigned_sales_rep);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_restaurants_lead_status_stage
  ON public.restaurants(lead_status, lead_stage);

CREATE INDEX IF NOT EXISTS idx_restaurants_lead_warmth_stage
  ON public.restaurants(lead_warmth, lead_stage);

COMMIT;
```

**Column Descriptions:**

| Column | Type | Purpose | Example Values |
|--------|------|---------|----------------|
| `lead_type` | TEXT | Origin of lead | inbound, outbound |
| `lead_category` | TEXT | Marketing channel | paid_ads, organic_content, warm_outreach, cold_outreach |
| `lead_engagement_source` | TEXT | Initial touchpoint | meta_ad_form, website_live_chat, cold_email |
| `lead_warmth` | TEXT | Lead temperature | frozen, cold, warm, hot |
| `lead_stage` | TEXT | Sales pipeline stage | uncontacted, in_talks, demo_booked, closed_won |
| `lead_status` | TEXT | Current activity status | active, inactive, ghosted, closed |
| `icp_rating` | INTEGER | Ideal customer fit (0-10) | 7 |
| `last_contacted` | TIMESTAMPTZ | Last outreach timestamp | 2025-01-15 14:30:00 |
| `demo_store_built` | BOOLEAN | Has demo store | TRUE/FALSE |
| `demo_store_url` | TEXT | Demo store URL | https://demo-restaurant.pumpd.co.nz |
| `assigned_sales_rep` | UUID | Assigned user ID | FK to auth.users |

### 1.2 Create Tasks Table

**Migration File:** `create_tasks_table.sql`

```sql
-- Migration: Create tasks table for sales task management
-- Date: 2025-01-16
-- Description: Creates tasks table with support for task templates and message templates

BEGIN;

CREATE TABLE IF NOT EXISTS public.tasks (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Foreign keys
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  message_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  type TEXT NOT NULL CHECK (type IN ('internal_activity', 'social_message', 'text', 'email', 'call')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Task content (for communication tasks)
  message TEXT,
  message_rendered TEXT, -- Rendered message after variable replacement

  -- Scheduling
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_organisation ON public.tasks(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant ON public.tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);

-- Composite indexes for filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority
  ON public.tasks(status, priority);

CREATE INDEX IF NOT EXISTS idx_tasks_restaurant_status
  ON public.tasks(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status
  ON public.tasks(assigned_to, status);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see tasks from their organization
CREATE POLICY tasks_org_policy ON public.tasks
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### 1.3 Create Task Templates Table

**Migration File:** `create_task_templates_table.sql`

```sql
-- Migration: Create task_templates table
-- Date: 2025-01-16
-- Description: Creates reusable task templates for organizations

BEGIN;

CREATE TABLE IF NOT EXISTS public.task_templates (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Foreign keys
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  message_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('internal_activity', 'social_message', 'text', 'email', 'call')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Default message (can be overridden by message_template)
  default_message TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_templates_organisation ON public.task_templates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_type ON public.task_templates(type);
CREATE INDEX IF NOT EXISTS idx_task_templates_is_active ON public.task_templates(is_active);

-- Enable Row Level Security
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY task_templates_org_policy ON public.task_templates
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### 1.4 Create Message Templates Table

**Migration File:** `create_message_templates_table.sql`

```sql
-- Migration: Create message_templates table
-- Date: 2025-01-16
-- Description: Creates reusable message templates with variable support

BEGIN;

CREATE TABLE IF NOT EXISTS public.message_templates (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Foreign keys
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('social_message', 'text', 'email')),

  -- Message content with variables
  message_content TEXT NOT NULL,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,

  -- Available variables (JSON array of variable names)
  available_variables JSONB DEFAULT '[]'::jsonb,

  -- Preview data (for testing variable replacement)
  preview_data JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_organisation ON public.message_templates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON public.message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON public.message_templates(is_active);

-- Enable Row Level Security
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY message_templates_org_policy ON public.message_templates
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### 1.5 Database Migration Checklist ✅ COMPLETE

- [x] ✅ Create migration: `add_sales_specific_columns_to_restaurants.sql`
- [x] ✅ Create migration: `create_tasks_table.sql`
- [x] ✅ Create migration: `create_task_templates_table.sql`
- [x] ✅ Create migration: `create_message_templates_table.sql`
- [x] ✅ Test migrations in development environment
- [x] ✅ Verify indexes are created correctly
- [x] ✅ Verify RLS policies work as expected
- [x] ✅ Backup production database before applying
- [x] ✅ Apply migrations to production
- [x] ✅ Verify data integrity post-migration

---

## Phase 2: Backend API Implementation

### 2.1 API Endpoints Architecture

**File Structure:**
```
/UberEats-Image-Extractor/
├── server.js (add route imports)
└── src/
    ├── routes/
    │   ├── tasks-routes.js (NEW)
    │   ├── task-templates-routes.js (NEW)
    │   └── message-templates-routes.js (NEW)
    ├── services/
    │   ├── tasks-service.js (NEW)
    │   ├── task-templates-service.js (NEW)
    │   ├── message-templates-service.js (NEW)
    │   └── variable-replacement-service.js (NEW)
    └── middleware/
        └── auth.js (existing)
```

### 2.2 Tasks API Endpoints

**File:** `/src/routes/tasks-routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const tasksService = require('../services/tasks-service');

/**
 * GET /api/tasks
 * List all tasks with filtering and sorting
 * Query params:
 *   - status: pending|active|completed|cancelled
 *   - type: internal_activity|social_message|text|email|call
 *   - priority: low|medium|high
 *   - restaurant_id: UUID
 *   - assigned_to: UUID
 *   - due_before: ISO date
 *   - due_after: ISO date
 *   - sort_by: created_at|due_date|priority
 *   - sort_order: asc|desc
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      priority: req.query.priority,
      restaurant_id: req.query.restaurant_id,
      assigned_to: req.query.assigned_to,
      due_before: req.query.due_before,
      due_after: req.query.due_after
    };

    const sort = {
      by: req.query.sort_by || 'created_at',
      order: req.query.sort_order || 'desc'
    };

    const tasks = await tasksService.listTasks(filters, sort);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/:id
 * Get single task with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks
 * Create new task
 * Body:
 *   - name: string (required)
 *   - description: string
 *   - restaurant_id: UUID
 *   - task_template_id: UUID
 *   - type: enum (required)
 *   - priority: enum
 *   - message: string
 *   - due_date: ISO date
 *   - assigned_to: UUID
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      created_by: req.user.id,
      organisation_id: req.organizationId
    };

    const task = await tasksService.createTask(taskData);
    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update task
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.updateTask(req.params.id, req.body);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tasks/:id/complete
 * Mark task as completed
 */
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.completeTask(req.params.id);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tasks/:id/cancel
 * Cancel task
 */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.cancelTask(req.params.id);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await tasksService.deleteTask(req.params.id);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### 2.3 Tasks Service Layer

**File:** `/src/services/tasks-service.js`

```javascript
const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
const variableReplacementService = require('./variable-replacement-service');

/**
 * List tasks with filtering and sorting
 */
async function listTasks(filters = {}, sort = {}) {
  let query = getSupabaseClient()
    .from('tasks')
    .select(`
      *,
      restaurants (
        id, name, contact_name, contact_email, contact_phone, city, cuisine
      ),
      task_templates (
        id, name
      ),
      message_templates (
        id, name
      ),
      assigned_to:profiles!tasks_assigned_to_fkey (
        id, full_name, email
      ),
      created_by:profiles!tasks_created_by_fkey (
        id, full_name, email
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId());

  // Apply filters
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.restaurant_id) query = query.eq('restaurant_id', filters.restaurant_id);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  if (filters.due_before) query = query.lte('due_date', filters.due_before);
  if (filters.due_after) query = query.gte('due_date', filters.due_after);

  // Apply sorting
  const sortBy = sort.by || 'created_at';
  const sortOrder = sort.order === 'asc' ? { ascending: true } : { ascending: false };
  query = query.order(sortBy, sortOrder);

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get task by ID
 */
async function getTaskById(id) {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(`
      *,
      restaurants (
        id, name, contact_name, contact_email, contact_phone,
        city, cuisine, subdomain, organisation_name
      ),
      task_templates (
        id, name, description
      ),
      message_templates (
        id, name, message_content
      ),
      assigned_to:profiles!tasks_assigned_to_fkey (
        id, full_name, email
      ),
      created_by:profiles!tasks_created_by_fkey (
        id, full_name, email
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create task
 */
async function createTask(taskData) {
  const client = getSupabaseClient();

  // If task is created from template, fetch template data
  if (taskData.task_template_id) {
    const { data: template } = await client
      .from('task_templates')
      .select('*, message_templates(*)')
      .eq('id', taskData.task_template_id)
      .single();

    if (template) {
      // Merge template defaults with provided data
      taskData.name = taskData.name || template.name;
      taskData.description = taskData.description || template.description;
      taskData.type = taskData.type || template.type;
      taskData.priority = taskData.priority || template.priority;

      // If template has message template, use it
      if (template.message_template_id && template.message_templates) {
        taskData.message_template_id = template.message_template_id;
        taskData.message = template.message_templates.message_content;
      } else if (template.default_message) {
        taskData.message = template.default_message;
      }

      // Increment template usage count
      await client
        .from('task_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', template.id);
    }
  }

  // If task has a restaurant and message, perform variable replacement
  if (taskData.restaurant_id && taskData.message) {
    const { data: restaurant } = await client
      .from('restaurants')
      .select('*')
      .eq('id', taskData.restaurant_id)
      .single();

    if (restaurant) {
      taskData.message_rendered = await variableReplacementService.replaceVariables(
        taskData.message,
        restaurant
      );
    }
  }

  // Create task
  const { data, error } = await client
    .from('tasks')
    .insert(taskData)
    .select(`
      *,
      restaurants (id, name),
      task_templates (id, name),
      message_templates (id, name)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update task
 */
async function updateTask(id, updates) {
  // If message is being updated and task has restaurant, re-render
  if (updates.message) {
    const task = await getTaskById(id);
    if (task && task.restaurant_id) {
      updates.message_rendered = await variableReplacementService.replaceVariables(
        updates.message,
        task.restaurants
      );
    }
  }

  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Complete task
 */
async function completeTask(id) {
  return updateTask(id, {
    status: 'completed',
    completed_at: new Date().toISOString()
  });
}

/**
 * Cancel task
 */
async function cancelTask(id) {
  return updateTask(id, {
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  });
}

/**
 * Delete task
 */
async function deleteTask(id) {
  const { error } = await getSupabaseClient()
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) throw error;
}

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  completeTask,
  cancelTask,
  deleteTask
};
```

### 2.4 Message Templates API & Service

**File:** `/src/routes/message-templates-routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const messageTemplatesService = require('../services/message-templates-service');

// List all message templates
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, is_active } = req.query;
    const templates = await messageTemplatesService.listTemplates({ type, is_active });
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single template
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await messageTemplatesService.getTemplateById(req.params.id);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create template
router.post('/', authMiddleware, async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      created_by: req.user.id,
      organisation_id: req.organizationId
    };
    const template = await messageTemplatesService.createTemplate(templateData);
    res.status(201).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update template
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await messageTemplatesService.updateTemplate(req.params.id, req.body);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete template
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await messageTemplatesService.deleteTemplate(req.params.id);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preview template with sample data
router.post('/:id/preview', authMiddleware, async (req, res) => {
  try {
    const preview = await messageTemplatesService.previewTemplate(
      req.params.id,
      req.body.restaurant_id
    );
    res.json({ success: true, preview });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

**File:** `/src/services/message-templates-service.js`

```javascript
const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
const variableReplacementService = require('./variable-replacement-service');

async function listTemplates(filters = {}) {
  let query = getSupabaseClient()
    .from('message_templates')
    .select('*')
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getTemplateById(id) {
  const { data, error } = await getSupabaseClient()
    .from('message_templates')
    .select('*')
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) throw error;
  return data;
}

async function createTemplate(templateData) {
  // Extract variables from message content
  const variables = variableReplacementService.extractVariables(templateData.message_content);
  templateData.available_variables = variables;

  const { data, error } = await getSupabaseClient()
    .from('message_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateTemplate(id, updates) {
  // Re-extract variables if message content changed
  if (updates.message_content) {
    updates.available_variables = variableReplacementService.extractVariables(
      updates.message_content
    );
  }

  const { data, error } = await getSupabaseClient()
    .from('message_templates')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteTemplate(id) {
  const { error } = await getSupabaseClient()
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) throw error;
}

async function previewTemplate(templateId, restaurantId) {
  const template = await getTemplateById(templateId);

  if (restaurantId) {
    const { data: restaurant } = await getSupabaseClient()
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurant) {
      const rendered = await variableReplacementService.replaceVariables(
        template.message_content,
        restaurant
      );
      return { original: template.message_content, rendered };
    }
  }

  return { original: template.message_content, rendered: null };
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate
};
```

### 2.5 Restaurant Endpoints Updates

**Add to `server.js` or create `/src/routes/restaurants-routes.js`:**

```javascript
/**
 * PATCH /api/restaurants/:id/sales-info
 * Update sales-specific fields for a restaurant
 */
router.patch('/:id/sales-info', authMiddleware, async (req, res) => {
  try {
    const allowedFields = [
      'lead_type',
      'lead_category',
      'lead_engagement_source',
      'lead_warmth',
      'lead_stage',
      'lead_status',
      'icp_rating',
      'last_contacted',
      'demo_store_built',
      'demo_store_url',
      'assigned_sales_rep'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const { data, error } = await getSupabaseClient()
      .from('restaurants')
      .update(updates)
      .eq('id', req.params.id)
      .eq('organisation_id', getCurrentOrganizationId())
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, restaurant: data });
  } catch (error) {
    console.error('Error updating restaurant sales info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/restaurants with sales filtering
 * Add query params:
 *   - lead_type, lead_category, lead_warmth, lead_stage, lead_status
 *   - icp_rating_min, icp_rating_max
 *   - demo_store_built (true/false)
 *   - assigned_sales_rep
 */
```

### 2.6 Backend Implementation Checklist ✅ COMPLETE

- [x] ✅ Create `tasks-routes.js` with all CRUD endpoints
- [x] ✅ Create `tasks-service.js` with business logic
- [x] ✅ Create `task-templates-routes.js` and service
- [x] ✅ Create `message-templates-routes.js` and service
- [x] ✅ Create `variable-replacement-service.js`
- [x] ✅ Update `server.js` to import and mount new routes
- [x] ✅ Add sales filtering to restaurants endpoints
- [x] ✅ Write unit tests for services
- [x] ✅ Write integration tests for API endpoints
- [x] ✅ Test RLS policies with different user roles
- [x] ✅ Add API documentation (Swagger/OpenAPI)

---

## Phase 3: Frontend - Restaurants Page Filtering

### 3.1 Enhanced Restaurants Page Component

**File:** `/src/pages/Restaurants.jsx` (Major Update)

**New Features:**
1. Multi-filter controls (dropdowns for each sales field)
2. Filter persistence in URL params
3. Clear filters button
4. Filter badge indicators
5. Improved table columns for sales data
6. Quick filter presets (e.g., "Hot Leads", "Demo Booked")

**Component Structure:**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  Eye, FileText, Store, Phone, Mail, User,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

export default function Restaurants() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters (initialize from URL params)
  const [filters, setFilters] = useState({
    lead_type: searchParams.get('lead_type') || 'all',
    lead_category: searchParams.get('lead_category') || 'all',
    lead_warmth: searchParams.get('lead_warmth') || 'all',
    lead_stage: searchParams.get('lead_stage') || 'all',
    lead_status: searchParams.get('lead_status') || 'all',
    demo_store_built: searchParams.get('demo_store_built') || 'all',
    icp_rating_min: searchParams.get('icp_rating_min') || '',
    search: searchParams.get('search') || ''
  });

  // Sorting
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  // Fetch data when filters change
  useEffect(() => {
    fetchRestaurants();
    updateUrlParams();
  }, [filters, sortField, sortDirection]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/restaurants/list');
      let data = response.data.restaurants || [];

      // Apply filters
      data = applyFilters(data);

      // Apply sorting
      data = applySort(data);

      setRestaurants(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
      setError('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data) => {
    return data.filter(restaurant => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          restaurant.name?.toLowerCase().includes(searchLower) ||
          restaurant.contact_name?.toLowerCase().includes(searchLower) ||
          restaurant.contact_email?.toLowerCase().includes(searchLower) ||
          restaurant.city?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Sales filters
      if (filters.lead_type !== 'all' && restaurant.lead_type !== filters.lead_type) return false;
      if (filters.lead_category !== 'all' && restaurant.lead_category !== filters.lead_category) return false;
      if (filters.lead_warmth !== 'all' && restaurant.lead_warmth !== filters.lead_warmth) return false;
      if (filters.lead_stage !== 'all' && restaurant.lead_stage !== filters.lead_stage) return false;
      if (filters.lead_status !== 'all' && restaurant.lead_status !== filters.lead_status) return false;

      if (filters.demo_store_built !== 'all') {
        const demoBuilt = filters.demo_store_built === 'true';
        if (restaurant.demo_store_built !== demoBuilt) return false;
      }

      if (filters.icp_rating_min && restaurant.icp_rating < parseInt(filters.icp_rating_min)) {
        return false;
      }

      return true;
    });
  };

  const applySort = (data) => {
    return [...data].sort((a, b) => {
      let valueA, valueB;

      switch (sortField) {
        case 'created_at':
        case 'last_contacted':
          valueA = a[sortField] ? new Date(a[sortField]) : new Date(0);
          valueB = b[sortField] ? new Date(b[sortField]) : new Date(0);
          break;
        case 'icp_rating':
          valueA = a[sortField] || 0;
          valueB = b[sortField] || 0;
          break;
        case 'name':
          valueA = a[sortField]?.toLowerCase() || '';
          valueB = b[sortField]?.toLowerCase() || '';
          break;
        default:
          valueA = a[sortField] || '';
          valueB = b[sortField] || '';
      }

      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
  };

  const updateUrlParams = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      lead_type: 'all',
      lead_category: 'all',
      lead_warmth: 'all',
      lead_stage: 'all',
      lead_status: 'all',
      demo_store_built: 'all',
      icp_rating_min: '',
      search: ''
    });
  };

  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) =>
      value !== 'all' && value !== ''
    );
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  const getWarmthBadge = (warmth) => {
    const colors = {
      frozen: 'bg-blue-100 text-blue-800 border-blue-200',
      cold: 'bg-gray-100 text-gray-800 border-gray-200',
      warm: 'bg-orange-100 text-orange-800 border-orange-200',
      hot: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[warmth])}>
        {warmth}
      </Badge>
    );
  };

  const getStageBadge = (stage) => {
    const colors = {
      uncontacted: 'bg-gray-100 text-gray-800',
      reached_out: 'bg-blue-100 text-blue-800',
      in_talks: 'bg-purple-100 text-purple-800',
      demo_booked: 'bg-green-100 text-green-800',
      rebook_demo: 'bg-yellow-100 text-yellow-800',
      contract_sent: 'bg-indigo-100 text-indigo-800',
      closed_won: 'bg-green-100 text-green-800',
      closed_lost: 'bg-red-100 text-red-800',
      reengaging: 'bg-orange-100 text-orange-800'
    };
    return (
      <Badge variant="outline" className={colors[stage]}>
        {stage?.replace(/_/g, ' ')}
      </Badge>
    );
  };

  // ... rest of the component (table rendering, etc.)

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Restaurants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {restaurants.length} {hasActiveFilters() ? 'filtered ' : ''}restaurants
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button
            onClick={() => navigate('/restaurants/new')}
            className="bg-gradient-to-r from-brand-blue to-brand-green"
          >
            Add Restaurant
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Filters</h3>
          </div>
          {hasActiveFilters() && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="text-sm font-medium mb-1 block">Search</label>
            <Input
              placeholder="Name, contact, city..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>

          {/* Lead Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">Lead Type</label>
            <Select value={filters.lead_type} onValueChange={(v) => updateFilter('lead_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lead Warmth */}
          <div>
            <label className="text-sm font-medium mb-1 block">Lead Warmth</label>
            <Select value={filters.lead_warmth} onValueChange={(v) => updateFilter('lead_warmth', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warmth</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lead Stage */}
          <div>
            <label className="text-sm font-medium mb-1 block">Lead Stage</label>
            <Select value={filters.lead_stage} onValueChange={(v) => updateFilter('lead_stage', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="uncontacted">Uncontacted</SelectItem>
                <SelectItem value="reached_out">Reached Out</SelectItem>
                <SelectItem value="in_talks">In Talks</SelectItem>
                <SelectItem value="demo_booked">Demo Booked</SelectItem>
                <SelectItem value="rebook_demo">Rebook Demo</SelectItem>
                <SelectItem value="contract_sent">Contract Sent</SelectItem>
                <SelectItem value="closed_won">Closed Won</SelectItem>
                <SelectItem value="closed_lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional filters... */}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                Name {getSortIcon('name')}
              </TableHead>
              <TableHead>Lead Contact</TableHead>
              <TableHead>Warmth</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>ICP Rating</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('last_contacted')}
              >
                Last Contact {getSortIcon('last_contacted')}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.map((restaurant) => (
              <TableRow key={restaurant.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{restaurant.name}</div>
                    {restaurant.city && (
                      <div className="text-xs text-muted-foreground">{restaurant.city}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {restaurant.contact_name && (
                    <div className="text-sm">{restaurant.contact_name}</div>
                  )}
                  {restaurant.contact_email && (
                    <div className="text-xs text-muted-foreground">{restaurant.contact_email}</div>
                  )}
                </TableCell>
                <TableCell>
                  {restaurant.lead_warmth ? getWarmthBadge(restaurant.lead_warmth) : '-'}
                </TableCell>
                <TableCell>
                  {restaurant.lead_stage ? getStageBadge(restaurant.lead_stage) : '-'}
                </TableCell>
                <TableCell>
                  {restaurant.icp_rating ? (
                    <Badge variant="outline">{restaurant.icp_rating}/10</Badge>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {restaurant.last_contacted
                    ? new Date(restaurant.last_contacted).toLocaleDateString()
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {/* Action buttons */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### 3.2 Restaurant Detail Page Enhancement

Add a "Sales Info" tab to the restaurant detail page with editable fields for all sales-specific columns.

**File:** `/src/pages/RestaurantDetail.jsx`

Add sales info editing section with form controls for:
- Lead type, category, source
- Warmth, stage, status
- ICP rating (slider 0-10)
- Last contacted date
- Demo store built toggle
- Assigned sales rep selector

### 3.3 Frontend Phase 3 Checklist ✅ COMPLETE

- [x] ✅ Update `Restaurants.jsx` with filter UI (UPGRADED to multi-select)
- [x] ✅ Add URL param persistence for filters
- [x] ✅ Add sorting for new columns
- [x] ✅ Create badge components for warmth/stage
- [x] ✅ Add quick filter presets
- [x] ✅ Update `RestaurantDetail.jsx` with sales info tab
- [x] ✅ Create sales info edit form
- [x] ✅ Add ICP rating slider component
- [x] ✅ Test filtering with various combinations
- [x] ✅ Test performance with large datasets

---

## Phase 4: Frontend - Task Management System

### 4.1 New Tasks Page

**File:** `/src/pages/Tasks.tsx` (NEW)

**Features:**
- Filterable task list (by status, type, priority, restaurant, assigned user)
- Sortable columns (due date, priority, created date)
- Inline task completion
- Quick actions (complete, cancel, edit)
- Create task button with modal
- Task detail view

**Component Structure:**

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  CheckCircle2, Circle, XCircle, Calendar,
  Flag, User, MessageSquare, Phone, Mail,
  Plus, Edit, Trash2, Filter
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { EditTaskModal } from '../components/tasks/EditTaskModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    priority: 'all',
    assigned_to: 'all'
  });

  const [modals, setModals] = useState({
    create: false,
    edit: null,
    detail: null
  });

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== 'all') params[key] = value;
      });

      const response = await api.get('/tasks', { params });
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCancelTask = async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/cancel`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'active':
        return <Circle className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'social_message':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return (
      <Badge variant="outline" className={colors[priority]}>
        {priority}
      </Badge>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} tasks
          </p>
        </div>
        <Button
          onClick={() => setModals({ ...modals, create: true })}
          className="bg-gradient-to-r from-brand-blue to-brand-green"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <Select
              value={filters.type}
              onValueChange={(v) => setFilters({ ...filters, type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="internal_activity">Internal Activity</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="social_message">Social Message</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Priority</label>
            <Select
              value={filters.priority}
              onValueChange={(v) => setFilters({ ...filters, priority: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className={task.status === 'completed' ? 'opacity-60' : ''}>
                <TableCell>
                  {getStatusIcon(task.status)}
                </TableCell>
                <TableCell>
                  <div
                    className="font-medium cursor-pointer hover:text-brand-blue"
                    onClick={() => setModals({ ...modals, detail: task.id })}
                  >
                    {task.name}
                  </div>
                  {task.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {task.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {task.restaurants ? (
                    <div
                      className="text-sm cursor-pointer hover:text-brand-blue"
                      onClick={() => navigate(`/restaurants/${task.restaurant_id}`)}
                    >
                      {task.restaurants.name}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {getTypeIcon(task.type)}
                    <span className="text-sm capitalize">
                      {task.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {getPriorityBadge(task.priority)}
                </TableCell>
                <TableCell>
                  {task.due_date ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4" />
                      {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {task.assigned_to ? (
                    <div className="text-sm">{task.assigned_to.full_name}</div>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {task.status === 'pending' && (
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      {modals.create && (
        <CreateTaskModal
          open={modals.create}
          onClose={() => setModals({ ...modals, create: false })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.edit && (
        <EditTaskModal
          open={!!modals.edit}
          taskId={modals.edit}
          onClose={() => setModals({ ...modals, edit: null })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.detail && (
        <TaskDetailModal
          open={!!modals.detail}
          taskId={modals.detail}
          onClose={() => setModals({ ...modals, detail: null })}
        />
      )}
    </div>
  );
}
```

### 4.2 Create Task Modal Component

**File:** `/src/components/tasks/CreateTaskModal.tsx` (NEW)

```tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId?: string;
}

export function CreateTaskModal({ open, onClose, onSuccess, restaurantId }: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskTemplates, setTaskTemplates] = useState([]);
  const [restaurants, setRestaurants] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'internal_activity',
    priority: 'medium',
    restaurant_id: restaurantId || '',
    task_template_id: '',
    message: '',
    due_date: ''
  });

  useEffect(() => {
    if (open) {
      fetchTaskTemplates();
      if (!restaurantId) {
        fetchRestaurants();
      }
    }
  }, [open]);

  const fetchTaskTemplates = async () => {
    try {
      const response = await api.get('/task-templates');
      setTaskTemplates(response.data.templates);
    } catch (error) {
      console.error('Failed to fetch task templates:', error);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants/list');
      setRestaurants(response.data.restaurants);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) {
      setFormData({
        ...formData,
        task_template_id: '',
        name: '',
        description: '',
        type: 'internal_activity',
        priority: 'medium',
        message: ''
      });
      return;
    }

    const template = taskTemplates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        task_template_id: templateId,
        name: template.name,
        description: template.description || '',
        type: template.type,
        priority: template.priority,
        message: template.default_message || ''
      });
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.type) {
      setError('Please fill in required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/tasks', formData);
      if (response.data.success) {
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'internal_activity',
      priority: 'medium',
      restaurant_id: restaurantId || '',
      task_template_id: '',
      message: '',
      due_date: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a task for sales activities and follow-ups
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Task Template Selector */}
          <div className="space-y-2">
            <Label>Use Template (Optional)</Label>
            <Select
              value={formData.task_template_id}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No template</SelectItem>
                {taskTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Restaurant Selector (if not pre-selected) */}
          {!restaurantId && (
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Select
                value={formData.restaurant_id}
                onValueChange={(v) => setFormData({ ...formData, restaurant_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant..." />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(restaurant => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Task Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Follow up on demo booking"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={3}
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_activity">Internal Activity</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="social_message">Social Message</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

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
              <p className="text-xs text-muted-foreground">
                Available variables: {'{restaurant_name}'}, {'{contact_name}'}, {'{city}'}, {'{cuisine}'}, {'{demo_store_url}'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.3 Message Templates Page

**File:** `/src/pages/MessageTemplates.tsx` (NEW)

Similar structure to Tasks page with:
- List of message templates
- Create/Edit/Delete functionality
- Preview with variable replacement
- Type filtering (email, social_message, text)

### 4.4 Frontend Phase 4 Checklist ✅ COMPLETE

- [x] ✅ Create `Tasks.tsx` page component
- [x] ✅ Create `CreateTaskModal.tsx` component
- [x] ✅ Create `EditTaskModal.tsx` component
- [x] ✅ Create `TaskDetailModal.tsx` component
- [x] ✅ Create `MessageTemplates.tsx` page
- [x] ✅ Create `CreateMessageTemplateModal.tsx` component
- [x] ✅ Add routes to `App.tsx`
- [x] ✅ Add navigation links in sidebar
- [x] ✅ Test task creation from templates
- [x] ✅ Test variable replacement preview
- [x] ✅ Test task filtering and sorting
- [x] ✅ **BONUS:** Create `TaskTemplates.tsx` page (not in original plan)

---

## Phase 5: Message Template System

### 5.1 Variable Replacement Service

**File:** `/src/services/variable-replacement-service.js`

```javascript
/**
 * Extract variables from message template
 * Returns array of variable names found in template
 */
function extractVariables(messageContent) {
  if (!messageContent) return [];

  const regex = /{([a-zA-Z_][a-zA-Z0-9_]*)}/g;
  const matches = messageContent.matchAll(regex);
  const variables = new Set();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Available variable mappings from restaurant data
 */
const VARIABLE_MAPPINGS = {
  // Restaurant basic info
  restaurant_name: 'name',
  restaurant_email: 'email',
  restaurant_phone: 'phone',
  restaurant_address: 'address',
  restaurant_website: 'website',
  city: 'city',

  // Lead contact info
  contact_name: 'contact_name',
  contact_email: 'contact_email',
  contact_phone: 'contact_phone',

  // Business info
  organisation_name: 'organisation_name',
  cuisine: (restaurant) => {
    if (Array.isArray(restaurant.cuisine)) {
      return restaurant.cuisine.join(', ');
    }
    return restaurant.cuisine || '';
  },

  // Opening hours
  opening_hours_text: 'opening_hours_text',

  // Sales info
  lead_stage: (restaurant) => {
    return restaurant.lead_stage?.replace(/_/g, ' ') || '';
  },
  icp_rating: 'icp_rating',

  // Demo store
  demo_store_url: 'demo_store_url',
  demo_store_built: (restaurant) => {
    return restaurant.demo_store_built ? 'Yes' : 'No';
  },

  // Pumpd URLs
  subdomain: 'subdomain',
  ordering_url: (restaurant) => {
    return restaurant.subdomain
      ? `https://${restaurant.subdomain}.pumpd.co.nz`
      : '';
  },
  admin_url: 'https://admin.pumpd.co.nz',

  // Platform URLs
  ubereats_url: 'ubereats_url',
  doordash_url: 'doordash_url',
  instagram_url: 'instagram_url',
  facebook_url: 'facebook_url'
};

/**
 * Get value from restaurant data using mapping
 */
function getVariableValue(variableName, restaurant) {
  const mapping = VARIABLE_MAPPINGS[variableName];

  if (!mapping) {
    return `{${variableName}}`;  // Return unchanged if mapping not found
  }

  if (typeof mapping === 'function') {
    return mapping(restaurant) || '';
  }

  return restaurant[mapping] || '';
}

/**
 * Replace variables in message with restaurant data
 */
async function replaceVariables(messageContent, restaurant) {
  if (!messageContent || !restaurant) return messageContent;

  let result = messageContent;
  const variables = extractVariables(messageContent);

  for (const variable of variables) {
    const value = getVariableValue(variable, restaurant);
    const regex = new RegExp(`{${variable}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Get list of all available variables with descriptions
 */
function getAvailableVariables() {
  return [
    { name: 'restaurant_name', description: 'Restaurant name', example: 'Bella Pizza' },
    { name: 'contact_name', description: 'Lead contact name', example: 'John Smith' },
    { name: 'contact_email', description: 'Lead contact email', example: 'john@example.com' },
    { name: 'contact_phone', description: 'Lead contact phone', example: '021 123 4567' },
    { name: 'city', description: 'Restaurant city', example: 'Auckland' },
    { name: 'cuisine', description: 'Cuisine type(s)', example: 'Italian, Pizza' },
    { name: 'organisation_name', description: 'Organisation name', example: 'Bella Group Ltd' },
    { name: 'demo_store_url', description: 'Demo store URL', example: 'https://demo-bella.pumpd.co.nz' },
    { name: 'ordering_url', description: 'Pumpd ordering URL', example: 'https://bella-pizza.pumpd.co.nz' },
    { name: 'subdomain', description: 'Pumpd subdomain', example: 'bella-pizza' },
    { name: 'opening_hours_text', description: 'Opening hours text', example: 'Mon-Fri 11am-9pm' },
    { name: 'lead_stage', description: 'Current lead stage', example: 'demo booked' },
    { name: 'icp_rating', description: 'ICP fit rating (0-10)', example: '8' },
    { name: 'admin_url', description: 'Pumpd admin portal', example: 'https://admin.pumpd.co.nz' }
  ];
}

module.exports = {
  extractVariables,
  replaceVariables,
  getVariableValue,
  getAvailableVariables,
  VARIABLE_MAPPINGS
};
```

### 5.2 Message Template Editor Component

**File:** `/src/components/message-templates/TemplateEditor.tsx`

Features:
- Rich text editor with variable insertion
- Variable picker dropdown
- Live preview with sample data
- Variable validation
- Available variables help panel

### 5.3 Phase 5 Checklist ✅ COMPLETE

- [x] ✅ Create `variable-replacement-service.js`
- [x] ✅ Add comprehensive variable mappings (46+ variables)
- [x] ✅ Create template editor component
- [x] ✅ Add variable picker UI
- [x] ✅ Implement live preview
- [x] ✅ Add variable documentation
- [x] ✅ Test all variable types
- [x] ✅ Test edge cases (null values, arrays, etc.)

---

## Phase 6: Variable Replacement Engine

### 6.1 Advanced Variable Features

**Enhanced Variable Types:**

1. **Conditional Variables**
   - `{if:demo_store_built}Your demo store: {demo_store_url}{/if}`
   - `{if_not:demo_store_built}Would you like a demo store?{/if_not}`

2. **Formatted Variables**
   - `{contact_name:uppercase}` → JOHN SMITH
   - `{contact_name:titlecase}` → John Smith
   - `{icp_rating:formatted}` → ★★★★★★★★☆☆

3. **Date Variables**
   - `{today}` → Current date
   - `{next_week}` → Date 7 days from now
   - Custom format: `{today:DD/MM/YYYY}`

4. **Fallback Values**
   - `{contact_name|there}` → Uses "there" if contact_name is empty
   - `{demo_store_url|Contact us for your demo}`

### 6.2 Future Extensibility for Sequences

The current architecture supports future sequence implementation:

**Database Extensions:**
- Tasks already support `task_template_id` for template-based creation
- Easy to add `sequence_id` foreign key to tasks table
- Task templates can be grouped into sequences

**Service Layer Extensions:**
```javascript
// Future: sequences-service.js
async function createSequence(sequenceData) {
  // Create sequence record
  // Create task templates for each phase
  // Set up phase delays and dependencies
}

async function startSequence(restaurantId, sequenceId) {
  // Create all tasks from sequence template
  // Set due dates based on phase delays
  // Apply variable replacement to all messages
}
```

**Frontend Extensions:**
- Sequences page (similar to Tasks/Templates)
- Sequence builder with drag-drop phases
- Visual timeline view
- Sequence progress tracking

### 6.3 Phase 6 Checklist

**Core Variable Replacement:** ✅ COMPLETE
- [x] ✅ Basic variable replacement working (46+ variables)
- [x] ✅ Variable extraction and mapping
- [x] ✅ Support for restaurant, contact, sales, and platform variables
- [x] ✅ Cuisine array handling

**Advanced Features:** ⏸️ Future Enhancement
- [ ] ⏸️ Implement advanced variable features (conditional logic)
- [ ] ⏸️ Add conditional logic support
- [ ] ⏸️ Add variable formatters (uppercase, titlecase, etc.)
- [ ] ⏸️ Add date variables (next_week, etc.)
- [ ] ⏸️ Add fallback value support
- [ ] ⏸️ Document advanced variable syntax
- [ ] ⏸️ Prepare database for sequence extensions
- [ ] ⏸️ Create sequence service skeleton

---

## Testing Strategy

### Unit Tests

**Backend:**
- [ ] Variable replacement service tests
- [ ] Task service CRUD operations
- [ ] Message template service tests
- [ ] Filter logic tests

**Frontend:**
- [ ] Filter state management tests
- [ ] Sorting logic tests
- [ ] Modal component tests
- [ ] Variable replacement preview tests

### Integration Tests

- [ ] Complete task creation flow
- [ ] Task template usage flow
- [ ] Message template with variables
- [ ] Restaurant filtering with multiple criteria
- [ ] RLS policy enforcement

### E2E Tests

- [ ] Create restaurant → Create task → Complete task
- [ ] Create message template → Create task from template
- [ ] Filter restaurants by sales criteria
- [ ] Assign tasks to users

### Performance Tests

- [ ] Restaurant list with 1000+ records
- [ ] Complex filter combinations
- [ ] Concurrent task creation
- [ ] Variable replacement with large datasets

---

## Future Extensibility

### Phase 7: Sequence Automation (Future)

**Database Tables:**
- `sequences` - Sequence instances
- `sequence_templates` - Reusable sequence templates
- `sequence_phases` - Phases within sequences
- `sequence_tasks` - Tasks within sequence phases

**Features:**
- Multi-phase task sequences
- Automatic task scheduling with delays
- Conditional branching based on lead responses
- Sequence analytics and performance tracking

### Phase 8: Communication Integration (Future)

**Features:**
- Email integration (SendGrid/AWS SES)
- SMS integration (Twilio)
- Social media posting automation
- WhatsApp Business integration

### Phase 9: Analytics & Reporting (Future)

**Features:**
- Sales pipeline analytics
- Lead conversion tracking
- Task completion rates
- Response time metrics
- ICP quality analysis

---

## Migration Execution Order

1. **Development Environment:**
   ```bash
   # Apply migrations in order
   psql -f add_sales_specific_columns_to_restaurants.sql
   psql -f create_message_templates_table.sql
   psql -f create_task_templates_table.sql
   psql -f create_tasks_table.sql
   ```

2. **Verify migrations:**
   ```sql
   -- Check new columns
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'restaurants'
   AND column_name LIKE 'lead_%';

   -- Check new tables
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('tasks', 'task_templates', 'message_templates');
   ```

3. **Production Deployment:**
   - Schedule maintenance window
   - Backup database
   - Apply migrations
   - Verify data integrity
   - Deploy backend code
   - Deploy frontend code
   - Monitor for errors

---

## Rollback Plan

If issues are encountered:

1. **Database Rollback:**
   ```sql
   -- Remove new columns
   ALTER TABLE restaurants
     DROP COLUMN IF EXISTS lead_type,
     DROP COLUMN IF EXISTS lead_category,
     -- etc...

   -- Drop new tables
   DROP TABLE IF EXISTS tasks CASCADE;
   DROP TABLE IF EXISTS task_templates CASCADE;
   DROP TABLE IF EXISTS message_templates CASCADE;
   ```

2. **Code Rollback:**
   - Revert to previous backend deployment
   - Revert to previous frontend deployment
   - Remove new routes from routing config

---

## Success Criteria

### Phase 1-2 (Database + Backend)
- [ ] All migrations applied successfully
- [ ] All API endpoints return correct data
- [ ] RLS policies enforce organization isolation
- [ ] API documentation complete

### Phase 3 (Restaurants Filtering)
- [ ] Filtering works for all sales fields
- [ ] Filters persist in URL
- [ ] Performance acceptable with 1000+ restaurants
- [ ] Sort works on all columns

### Phase 4 (Task Management)
- [ ] Can create tasks manually
- [ ] Can create tasks from templates
- [ ] Task filtering and sorting works
- [ ] Can complete/cancel tasks
- [ ] Task list updates in real-time

### Phase 5-6 (Message Templates + Variables)
- [ ] Can create message templates
- [ ] Variable replacement works correctly
- [ ] Preview shows correct output
- [ ] All variable types supported
- [ ] Handles edge cases gracefully

---

## Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| Phase 1 | Database migrations | 1-2 days |
| Phase 2 | Backend API | 3-4 days |
| Phase 3 | Restaurants filtering | 2-3 days |
| Phase 4 | Task management UI | 4-5 days |
| Phase 5 | Message templates | 2-3 days |
| Phase 6 | Variable replacement | 2-3 days |
| Testing | All phases | 3-4 days |
| **TOTAL** | | **17-24 days** |

---

## Dependencies & Prerequisites ✅ COMPLETE

- [x] ✅ Supabase project access
- [x] ✅ Development environment set up
- [x] ✅ Database backup strategy
- [x] ✅ Testing environment provisioned
- [x] ✅ Code review process defined
- [x] ✅ Deployment pipeline ready

---

## Notes & Assumptions

1. **Organization Context:** All features assume multi-tenant architecture with organization-level data isolation
2. **Permissions:** Current implementation uses basic role checks (super_admin, admin, user). May need more granular permissions in future.
3. **Soft Deletes:** Consider implementing soft deletes for tasks and templates instead of hard deletes
4. **Audit Trail:** Consider adding audit logging for sales field changes
5. **Notifications:** Future phase could add email/Slack notifications for task due dates
6. **Mobile:** UI is responsive but may benefit from dedicated mobile optimizations

---

## References

- Database Schema: [database-schemas/restaurants.sql](database-schemas/restaurants.sql)
- Current Restaurants Page: [UberEats-Image-Extractor/src/pages/Restaurants.jsx](../../UberEats-Image-Extractor/src/pages/Restaurants.jsx)
- Sequence Planning: [sequence-planning.md](sequence-planning.md)
- shadcn/ui Docs: https://ui.shadcn.com
- React Router v7: https://reactrouter.com
- Supabase Docs: https://supabase.com/docs

---

## ✅ Implementation Status

**All Phases (1-6) Successfully Completed on November 21, 2025**

This implementation plan has been fully executed with the following outcomes:
- ✅ All database migrations applied
- ✅ All backend services implemented
- ✅ All frontend pages and components built
- ✅ Variable replacement system working with 46+ variables
- ✅ Multi-select filters (upgraded from original single-select plan)
- ✅ Task Templates UI (bonus feature)
- ✅ Demo Booking Feature (18 qualification fields, bi-directional sync)
- ✅ All critical bugs fixed

**Next Steps:**
👉 See [PROJECT-STATUS.md](PROJECT-STATUS.md) for current status and next phase
👉 See [ENHANCEMENTS-INVESTIGATION-PLAN.md](ENHANCEMENTS-INVESTIGATION-PLAN.md) for enhancement features

---

**End of Implementation Plan**
**Last Updated:** November 21, 2025
**Version:** 2.0
**Status:** ✅ COMPLETE
