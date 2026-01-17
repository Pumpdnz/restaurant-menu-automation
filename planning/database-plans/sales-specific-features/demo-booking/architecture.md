# Demo Booking Feature - Architecture Document

**Version:** 1.0
**Date:** 2025-01-19
**Status:** Design Approved

---

## Table of Contents
1. [High-Level Overview](#high-level-overview)
2. [Directory Structure](#directory-structure)
3. [Data Flow](#data-flow)
4. [Service Layer Architecture](#service-layer-architecture)
5. [Component Architecture](#component-architecture)
6. [Database Architecture](#database-architecture)
7. [Integration Points](#integration-points)
8. [Error Handling](#error-handling)
9. [Performance Considerations](#performance-considerations)
10. [Security Considerations](#security-considerations)
11. [Testing Strategy](#testing-strategy)

---

## High-Level Overview

### System Architecture Layers

```
┌───────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Tasks Page   │  │ Create/Edit  │  │ TaskTypeQuickView/     │  │
│  │ (Table View) │──│ Task Modals  │──│ TaskDetailModal        │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
│         │                  │                      │                │
└─────────┼──────────────────┼──────────────────────┼────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                      API LAYER (Express.js)                       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Routes: /api/tasks                                          │ │
│  │  - GET    /tasks        → List tasks with restaurant data    │ │
│  │  - GET    /tasks/:id    → Get single task with details       │ │
│  │  - POST   /tasks        → Create task + update restaurant    │ │
│  │  - PATCH  /tasks/:id    → Update task + update restaurant    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER (Business Logic)                  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  tasks-service.js                                            │ │
│  │  - createTask()                                              │ │
│  │  - updateTask()                                              │ │
│  │  - handleDemoMeetingCreate()                                 │ │
│  │  - handleDemoMeetingUpdate()                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  qualification-service.js (NEW)                              │ │
│  │  - extractQualificationData()                                │ │
│  │  - updateRestaurantQualification()                           │ │
│  │  - trackFieldChanges()                                       │ │
│  │  - validateQualificationData()                               │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (Supabase/PostgreSQL)           │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │  restaurants             │  │  tasks                       │  │
│  │  + contact_role          │  │  - id                        │  │
│  │  + number_of_venues      │  │  - type (+ demo_meeting)     │  │
│  │  + point_of_sale         │  │  - restaurant_id             │  │
│  │  + ...14 more fields     │  │  - metadata (qual. data)     │  │
│  │  + meeting_link          │  │  - created_at                │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Interaction Pattern

1. **User Creates Demo Meeting Task**
   - User fills qualification form in CreateTaskModal
   - Form validates data client-side
   - POST to `/api/tasks` with qualification_data

2. **Backend Processing**
   - tasks-service.js receives request
   - qualification-service.js extracts and validates data
   - Database transaction: INSERT task + UPDATE restaurant
   - Returns task with updated restaurant data

3. **User Edits Demo Meeting Task**
   - EditTaskModal pre-fills with current values
   - User modifies some fields
   - Frontend tracks which fields changed
   - PATCH to `/api/tasks/:id` with only changed fields
   - Backend updates only modified restaurant fields

4. **User Views Demo Meeting**
   - TaskTypeQuickView shows contact info + meeting link
   - TaskDetailModal shows full qualification data
   - Data fetched from restaurant record (source of truth)

---

## Directory Structure

### Frontend Structure

```
/UberEats-Image-Extractor/src/
│
├── components/
│   ├── tasks/
│   │   ├── CreateTaskModal.tsx            # [MODIFY] Add demo_meeting handling
│   │   ├── EditTaskModal.tsx              # [MODIFY] Add qualification editing
│   │   ├── TaskTypeQuickView.tsx          # [MODIFY] Add demo meeting view
│   │   ├── TaskDetailModal.tsx            # [MODIFY] Add qualification display
│   │   └── ...
│   │
│   ├── demo-meeting/                       # [NEW] Demo meeting components
│   │   ├── QualificationForm.tsx          # Main qualification form section
│   │   ├── TagInput.tsx                   # Multi-select with custom values
│   │   ├── QualificationDisplay.tsx       # Quick view display component
│   │   ├── QualificationDetail.tsx        # Detail modal display component
│   │   ├── FieldChangeTracker.tsx         # Track field changes for edit
│   │   └── index.ts                       # Barrel export
│   │
│   └── ui/                                 # [EXISTING] shadcn/ui components
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── select.tsx
│       └── ...
│
├── pages/
│   └── Tasks.tsx                           # [EXISTING] Main tasks page
│
├── services/
│   ├── api.js                              # [EXISTING] Axios instance
│   └── tasks-service.js                    # [EXISTING] Client-side task service
│
├── hooks/
│   ├── use-toast.ts                        # [EXISTING] Toast notifications
│   └── use-qualification-form.ts           # [NEW] Form state management hook
│
└── lib/
    ├── utils.ts                            # [EXISTING] Utility functions
    └── validation.ts                       # [NEW] Qualification validation
```

### Backend Structure

```
/UberEats-Image-Extractor/
│
├── server.js                               # [MODIFY] Import new routes
│
└── src/
    ├── routes/
    │   └── tasks-routes.js                 # [MODIFY] Add demo_meeting handling
    │
    ├── services/
    │   ├── tasks-service.js                # [MODIFY] Add qualification logic
    │   ├── qualification-service.js        # [NEW] Qualification data handling
    │   └── database-service.js             # [EXISTING] Supabase client
    │
    └── middleware/
        └── auth.js                         # [EXISTING] Authentication
```

### Database Structure

```
/supabase/migrations/
├── YYYYMMDD_add_demo_qualification_columns.sql
└── YYYYMMDD_add_demo_meeting_task_type.sql
```

---

## Data Flow

### Create Demo Meeting Task Flow

```
┌─────────────┐
│   User      │
│ Fills Form  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CreateTaskModal                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. User selects type = "demo_meeting"                 │  │
│  │  2. QualificationForm appears                          │  │
│  │  3. User fills qualification fields                    │  │
│  │  4. Client-side validation (optional)                  │  │
│  │  5. handleCreate() called                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ POST /api/tasks
       │ {
       │   name: "Demo with Restaurant X",
       │   type: "demo_meeting",
       │   restaurant_id: "uuid",
       │   qualification_data: { ... }
       │ }
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Backend: tasks-routes.js                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  router.post('/', authMiddleware, async (req, res) => │  │
│  │    const taskData = {                                  │  │
│  │      ...req.body,                                      │  │
│  │      created_by: req.user.id,                          │  │
│  │      organisation_id: req.organizationId               │  │
│  │    };                                                   │  │
│  │    const task = await tasksService.createTask(taskData);│ │
│  │    res.status(201).json({ success: true, task });     │  │
│  │  });                                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  tasks-service.js: createTask()                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  if (taskData.type === 'demo_meeting') {               │  │
│  │    // Extract qualification data                       │  │
│  │    const qualData = taskData.qualification_data;       │  │
│  │                                                         │  │
│  │    // Update restaurant record                         │  │
│  │    await qualificationService.updateRestaurant(        │  │
│  │      taskData.restaurant_id,                           │  │
│  │      qualData                                          │  │
│  │    );                                                   │  │
│  │                                                         │  │
│  │    // Store in task metadata                           │  │
│  │    taskData.metadata = {                               │  │
│  │      qualification_data: qualData                      │  │
│  │    };                                                   │  │
│  │  }                                                      │  │
│  │                                                         │  │
│  │  // Create task record                                 │  │
│  │  const task = await client.from('tasks')               │  │
│  │    .insert(taskData).select().single();                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  qualification-service.js: updateRestaurant()                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  async function updateRestaurant(restaurantId, data) { │  │
│  │    const updates = {};                                 │  │
│  │                                                         │  │
│  │    // Map qualification data to restaurant columns     │  │
│  │    if (data.contact_role)                              │  │
│  │      updates.contact_role = data.contact_role;         │  │
│  │    if (data.number_of_venues)                          │  │
│  │      updates.number_of_venues = data.number_of_venues; │  │
│  │    // ... map all 18 fields ...                        │  │
│  │                                                         │  │
│  │    await client.from('restaurants')                    │  │
│  │      .update(updates)                                  │  │
│  │      .eq('id', restaurantId);                          │  │
│  │  }                                                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Database: Transaction                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  BEGIN;                                                 │  │
│  │                                                         │  │
│  │  -- Update restaurant with qualification data          │  │
│  │  UPDATE restaurants SET                                │  │
│  │    contact_role = 'Owner',                             │  │
│  │    number_of_venues = 3,                               │  │
│  │    painpoints = '[{...}]'::jsonb,                      │  │
│  │    ...                                                  │  │
│  │  WHERE id = 'restaurant-uuid';                         │  │
│  │                                                         │  │
│  │  -- Insert task record                                 │  │
│  │  INSERT INTO tasks (...)                               │  │
│  │  VALUES (...);                                          │  │
│  │                                                         │  │
│  │  COMMIT;                                                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ { success: true, task: {...} }
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Frontend: CreateTaskModal                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  - Show success toast                                  │  │
│  │  - Close modal                                         │  │
│  │  - Refresh task list                                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Edit Demo Meeting Task Flow (Field Change Tracking)

```
┌─────────────┐
│   User      │
│ Edits Task  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  EditTaskModal                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. Fetch task with current qualification data        │  │
│  │  2. Pre-fill form with existing values                │  │
│  │  3. FieldChangeTracker monitors changes               │  │
│  │  4. User modifies some fields                         │  │
│  │  5. handleUpdate() called with changed fields only    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ PATCH /api/tasks/:id
       │ {
       │   qualification_data_changes: {
       │     contact_role: "Manager",  // changed
       │     painpoints: [...]         // changed
       │     // other fields omitted (unchanged)
       │   }
       │ }
       ▼
┌──────────────────────────────────────────────────────────────┐
│  tasks-service.js: updateTask()                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  if (updates.qualification_data_changes) {             │  │
│  │    // Update only changed fields                       │  │
│  │    await qualificationService.updateChangedFields(     │  │
│  │      task.restaurant_id,                               │  │
│  │      updates.qualification_data_changes                │  │
│  │    );                                                   │  │
│  │                                                         │  │
│  │    // Update task metadata with full current state    │  │
│  │    updates.metadata = {                                │  │
│  │      ...task.metadata,                                 │  │
│  │      qualification_data: {                             │  │
│  │        ...task.metadata.qualification_data,            │  │
│  │        ...updates.qualification_data_changes           │  │
│  │      }                                                  │  │
│  │    };                                                   │  │
│  │  }                                                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Database: Update only changed fields                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  UPDATE restaurants SET                                │  │
│  │    contact_role = 'Manager',    -- changed             │  │
│  │    painpoints = '[...]'::jsonb  -- changed             │  │
│  │    -- other fields unchanged                           │  │
│  │  WHERE id = 'restaurant-uuid';                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Service Layer Architecture

### tasks-service.js Enhancement

```javascript
/**
 * Enhanced createTask function with demo_meeting support
 */
async function createTask(taskData) {
  const client = getSupabaseClient();

  // Handle demo_meeting type
  if (taskData.type === 'demo_meeting') {
    if (!taskData.restaurant_id) {
      throw new Error('restaurant_id is required for demo_meeting tasks');
    }

    if (taskData.qualification_data) {
      // Update restaurant with qualification data
      await qualificationService.updateRestaurantQualification(
        taskData.restaurant_id,
        taskData.qualification_data
      );

      // Store qualification data in task metadata
      taskData.metadata = {
        ...(taskData.metadata || {}),
        qualification_data: taskData.qualification_data,
        qualification_snapshot_at: new Date().toISOString()
      };
    }
  }

  // Standard task creation logic
  const { data, error } = await client
    .from('tasks')
    .insert(taskData)
    .select(`
      *,
      restaurants (
        id, name, contact_name, contact_email, contact_phone,
        city, cuisine, subdomain, organisation_name,
        contact_role, number_of_venues, meeting_link,
        painpoints, core_selling_points, features_to_highlight,
        possible_objections
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Enhanced updateTask function with field change tracking
 */
async function updateTask(id, updates) {
  const client = getSupabaseClient();

  // Get current task
  const task = await getTaskById(id);

  // Handle demo_meeting type updates
  if (task.type === 'demo_meeting' && updates.qualification_data_changes) {
    // Update only changed fields on restaurant
    await qualificationService.updateChangedFields(
      task.restaurant_id,
      updates.qualification_data_changes
    );

    // Update task metadata with merged qualification data
    const currentQualData = task.metadata?.qualification_data || {};
    updates.metadata = {
      ...(task.metadata || {}),
      qualification_data: {
        ...currentQualData,
        ...updates.qualification_data_changes
      },
      last_qualification_update: new Date().toISOString()
    };

    // Remove temporary field from updates
    delete updates.qualification_data_changes;
  }

  // Standard task update logic
  const { data, error } = await client
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### qualification-service.js (NEW)

```javascript
/**
 * Qualification Service
 * Handles all qualification data operations
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

/**
 * Field mapping: qualification data keys → restaurant column names
 */
const FIELD_MAPPING = {
  contact_role: 'contact_role',
  number_of_venues: 'number_of_venues',
  point_of_sale: 'point_of_sale',
  online_ordering_platform: 'online_ordering_platform',
  online_ordering_handles_delivery: 'online_ordering_handles_delivery',
  self_delivery: 'self_delivery',
  weekly_uber_sales_volume: 'weekly_uber_sales_volume',
  uber_aov: 'uber_aov',
  uber_markup: 'uber_markup',
  uber_profitability: 'uber_profitability',
  uber_profitability_description: 'uber_profitability_description',
  current_marketing_description: 'current_marketing_description',
  website_type: 'website_type',
  painpoints: 'painpoints',
  core_selling_points: 'core_selling_points',
  features_to_highlight: 'features_to_highlight',
  possible_objections: 'possible_objections',
  details: 'details',
  meeting_link: 'meeting_link'
};

/**
 * Update restaurant with all qualification data
 */
async function updateRestaurantQualification(restaurantId, qualificationData) {
  const client = getSupabaseClient();
  const updates = mapQualificationToRestaurant(qualificationData);

  if (Object.keys(updates).length === 0) {
    return; // Nothing to update
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await client
    .from('restaurants')
    .update(updates)
    .eq('id', restaurantId)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Failed to update restaurant qualification:', error);
    throw new Error('Failed to update restaurant record');
  }
}

/**
 * Update only changed fields on restaurant
 */
async function updateChangedFields(restaurantId, changedFields) {
  const client = getSupabaseClient();
  const updates = mapQualificationToRestaurant(changedFields);

  if (Object.keys(updates).length === 0) {
    return; // Nothing to update
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await client
    .from('restaurants')
    .update(updates)
    .eq('id', restaurantId)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Failed to update changed fields:', error);
    throw new Error('Failed to update restaurant record');
  }
}

/**
 * Map qualification data object to restaurant table columns
 */
function mapQualificationToRestaurant(qualificationData) {
  const updates = {};

  Object.keys(FIELD_MAPPING).forEach(key => {
    if (qualificationData[key] !== undefined) {
      const column = FIELD_MAPPING[key];
      updates[column] = qualificationData[key];
    }
  });

  return updates;
}

/**
 * Extract qualification data from restaurant record
 */
async function getRestaurantQualification(restaurantId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('restaurants')
    .select(Object.values(FIELD_MAPPING).join(', '))
    .eq('id', restaurantId)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  updateRestaurantQualification,
  updateChangedFields,
  mapQualificationToRestaurant,
  getRestaurantQualification,
  FIELD_MAPPING
};
```

---

## Component Architecture

### Frontend Component Hierarchy

```
CreateTaskModal
├── DialogHeader
├── Task Type Selector
├── Restaurant Selector
├── Basic Task Fields (name, description, priority, due date)
├── [Conditional] Message Section (for email/social_message/text)
└── [Conditional] QualificationForm (for demo_meeting) ← NEW
    ├── Contact & Business Context
    │   ├── Input (contact_role)
    │   ├── Input (number_of_venues)
    │   ├── Input (point_of_sale)
    │   └── Input (online_ordering_platform)
    ├── Delivery & Platform
    │   ├── Select (online_ordering_handles_delivery)
    │   └── Select (self_delivery)
    ├── UberEats Metrics
    │   ├── Input (weekly_uber_sales_volume)
    │   ├── Input (uber_aov)
    │   ├── Input (uber_markup)
    │   ├── Input (uber_profitability)
    │   └── Textarea (uber_profitability_description)
    ├── Marketing & Website
    │   ├── Textarea (current_marketing_description)
    │   └── Select (website_type)
    ├── Sales Context (JSON Arrays)
    │   ├── TagInput (painpoints) ← NEW COMPONENT
    │   ├── TagInput (core_selling_points)
    │   ├── TagInput (features_to_highlight)
    │   └── TagInput (possible_objections)
    ├── Additional Details
    │   ├── Textarea (details)
    │   └── Input (meeting_link)
    └── DialogFooter
```

### QualificationForm Component

```typescript
// /src/components/demo-meeting/QualificationForm.tsx

import React from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { TagInput } from './TagInput';
import { Label } from '../ui/label';
import {
  PREDEFINED_PAINPOINTS,
  PREDEFINED_SELLING_POINTS,
  PREDEFINED_FEATURES,
  PREDEFINED_OBJECTIONS
} from '@/lib/constants';

interface QualificationFormProps {
  data: QualificationData;
  onChange: (field: string, value: any) => void;
  restaurantId?: string;
}

export function QualificationForm({ data, onChange, restaurantId }: QualificationFormProps) {
  return (
    <div className="space-y-6 border-t pt-4">
      <div className="text-sm font-semibold">Demo Qualification</div>

      {/* Contact & Business Context */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground">Contact & Business</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Contact Role</Label>
            <Input
              placeholder="e.g., Owner, Manager"
              value={data.contact_role || ''}
              onChange={(e) => onChange('contact_role', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Number of Venues</Label>
            <Input
              type="number"
              min="1"
              placeholder="e.g., 1, 3, 5"
              value={data.number_of_venues || ''}
              onChange={(e) => onChange('number_of_venues', parseInt(e.target.value) || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Point of Sale</Label>
            <Input
              placeholder="e.g., Lightspeed, Square"
              value={data.point_of_sale || ''}
              onChange={(e) => onChange('point_of_sale', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Online Ordering Platform</Label>
            <Input
              placeholder="e.g., Mr Yum, Mobi2Go"
              value={data.online_ordering_platform || ''}
              onChange={(e) => onChange('online_ordering_platform', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Delivery & Platform */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground">Delivery Setup</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Platform Handles Delivery?</Label>
            <Select
              value={data.online_ordering_handles_delivery?.toString() || 'unknown'}
              onValueChange={(v) => onChange('online_ordering_handles_delivery', v === 'unknown' ? null : v === 'true')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Self Delivery?</Label>
            <Select
              value={data.self_delivery?.toString() || 'unknown'}
              onValueChange={(v) => onChange('self_delivery', v === 'unknown' ? null : v === 'true')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* UberEats Metrics */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground">UberEats Metrics</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Weekly Sales Volume ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 5000"
              value={data.weekly_uber_sales_volume || ''}
              onChange={(e) => onChange('weekly_uber_sales_volume', parseFloat(e.target.value) || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Average Order Value ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 45"
              value={data.uber_aov || ''}
              onChange={(e) => onChange('uber_aov', parseFloat(e.target.value) || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Menu Markup (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g., 30"
              value={data.uber_markup || ''}
              onChange={(e) => onChange('uber_markup', parseFloat(e.target.value) || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Profitability (%)</Label>
            <Input
              type="number"
              min="-100"
              max="100"
              step="0.1"
              placeholder="e.g., 15"
              value={data.uber_profitability || ''}
              onChange={(e) => onChange('uber_profitability', parseFloat(e.target.value) || null)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Profitability Context</Label>
          <Textarea
            placeholder="e.g., $70 order in store is $100 on Uber, keeps $25"
            rows={2}
            value={data.uber_profitability_description || ''}
            onChange={(e) => onChange('uber_profitability_description', e.target.value)}
          />
        </div>
      </div>

      {/* Marketing & Website */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground">Marketing & Website</div>
        <div className="space-y-2">
          <Label>Current Marketing Efforts</Label>
          <Textarea
            placeholder="Describe their current marketing activities..."
            rows={3}
            value={data.current_marketing_description || ''}
            onChange={(e) => onChange('current_marketing_description', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Website Type</Label>
          <Select
            value={data.website_type || 'unknown'}
            onValueChange={(v) => onChange('website_type', v === 'unknown' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="platform_subdomain">Platform Subdomain</SelectItem>
              <SelectItem value="custom_domain">Custom Domain</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sales Context (JSON Arrays) */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground">Sales Context</div>

        <div className="space-y-2">
          <Label>Painpoints</Label>
          <TagInput
            options={PREDEFINED_PAINPOINTS}
            selected={data.painpoints || []}
            onChange={(v) => onChange('painpoints', v)}
            allowCustom={true}
            placeholder="Select or add painpoints..."
          />
        </div>

        <div className="space-y-2">
          <Label>Core Selling Points</Label>
          <TagInput
            options={PREDEFINED_SELLING_POINTS}
            selected={data.core_selling_points || []}
            onChange={(v) => onChange('core_selling_points', v)}
            allowCustom={true}
            placeholder="Select or add selling points..."
          />
        </div>

        <div className="space-y-2">
          <Label>Features to Highlight</Label>
          <TagInput
            options={PREDEFINED_FEATURES}
            selected={data.features_to_highlight || []}
            onChange={(v) => onChange('features_to_highlight', v)}
            allowCustom={true}
            placeholder="Select or add features..."
          />
        </div>

        <div className="space-y-2">
          <Label>Possible Objections</Label>
          <TagInput
            options={PREDEFINED_OBJECTIONS}
            selected={data.possible_objections || []}
            onChange={(v) => onChange('possible_objections', v)}
            allowCustom={true}
            placeholder="Select or add objections..."
          />
        </div>
      </div>

      {/* Additional Details & Meeting Link */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground">Meeting Details</div>

        <div className="space-y-2">
          <Label>Additional Details</Label>
          <Textarea
            placeholder="Any additional notes or context..."
            rows={3}
            value={data.details || ''}
            onChange={(e) => onChange('details', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Meeting Link</Label>
          <Input
            type="text"
            placeholder="Calendly link, Zoom link, or meeting notes..."
            value={data.meeting_link || ''}
            onChange={(e) => onChange('meeting_link', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Can be a URL, phone number, location, or notes about the meeting
          </p>
        </div>
      </div>
    </div>
  );
}
```

### TagInput Component

```typescript
// /src/components/demo-meeting/TagInput.tsx

import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Check, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagItem {
  type: 'predefined' | 'custom';
  value: string;
}

interface TagInputProps {
  options: string[];
  selected: TagItem[];
  onChange: (selected: TagItem[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
}

export function TagInput({ options, selected, onChange, allowCustom, placeholder }: TagInputProps) {
  const [customValue, setCustomValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const isSelected = (value: string) => {
    return selected.some(item => item.value === value);
  };

  const toggleOption = (value: string) => {
    if (isSelected(value)) {
      onChange(selected.filter(item => item.value !== value));
    } else {
      onChange([...selected, { type: 'predefined', value }]);
    }
  };

  const addCustom = () => {
    if (customValue.trim() && !isSelected(customValue.trim())) {
      onChange([...selected, { type: 'custom', value: customValue.trim() }]);
      setCustomValue('');
    }
  };

  const removeTag = (value: string) => {
    onChange(selected.filter(item => item.value !== value));
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            {selected.length > 0 ? `${selected.length} selected` : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-2">
            {options.map((option) => (
              <div
                key={option}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted",
                  isSelected(option) && "bg-muted"
                )}
                onClick={() => toggleOption(option)}
              >
                <div className={cn(
                  "w-4 h-4 border rounded flex items-center justify-center",
                  isSelected(option) && "bg-brand-blue border-brand-blue"
                )}>
                  {isSelected(option) && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm">{option}</span>
              </div>
            ))}

            {allowCustom && (
              <div className="border-t mt-2 pt-2 px-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom value..."
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={addCustom}
                    disabled={!customValue.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
          {selected.map((item) => (
            <Badge
              key={item.value}
              variant={item.type === 'predefined' ? 'default' : 'secondary'}
              className="flex items-center gap-1"
            >
              {item.value}
              <button
                onClick={() => removeTag(item.value)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Database Architecture

### New Columns in restaurants Table

```sql
-- Contact & Business Context
contact_role TEXT
number_of_venues INTEGER CHECK (number_of_venues > 0)
point_of_sale TEXT
online_ordering_platform TEXT
online_ordering_handles_delivery BOOLEAN
self_delivery BOOLEAN

-- UberEats Metrics
weekly_uber_sales_volume NUMERIC(10, 2) CHECK (weekly_uber_sales_volume >= 0)
uber_aov NUMERIC(10, 2) CHECK (uber_aov >= 0)
uber_markup NUMERIC(5, 2) CHECK (uber_markup >= 0 AND uber_markup <= 100)
uber_profitability NUMERIC(5, 2) CHECK (uber_profitability >= -100 AND uber_profitability <= 100)
uber_profitability_description TEXT

-- Marketing & Website
current_marketing_description TEXT
website_type TEXT CHECK (website_type IN ('platform_subdomain', 'custom_domain'))

-- Sales Context (JSON Arrays)
painpoints JSONB DEFAULT '[]'::jsonb
core_selling_points JSONB DEFAULT '[]'::jsonb
features_to_highlight JSONB DEFAULT '[]'::jsonb
possible_objections JSONB DEFAULT '[]'::jsonb

-- Meeting Details
details TEXT
meeting_link TEXT
```

### Index Strategy

```sql
-- B-tree indexes for filtering
CREATE INDEX idx_restaurants_contact_role ON restaurants(contact_role);
CREATE INDEX idx_restaurants_number_of_venues ON restaurants(number_of_venues);
CREATE INDEX idx_restaurants_website_type ON restaurants(website_type);

-- GIN indexes for JSONB array searching
CREATE INDEX idx_restaurants_painpoints ON restaurants USING GIN (painpoints);
CREATE INDEX idx_restaurants_core_selling_points ON restaurants USING GIN (core_selling_points);
CREATE INDEX idx_restaurants_features_to_highlight ON restaurants USING GIN (features_to_highlight);
CREATE INDEX idx_restaurants_possible_objections ON restaurants USING GIN (possible_objections);
```

### Tasks Table Enhancement

```sql
-- Add demo_meeting to task type enum
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (
  type IN ('internal_activity', 'social_message', 'text', 'email', 'call', 'demo_meeting')
);
```

---

## Integration Points

### 1. Authentication System
- **Uses**: Existing auth middleware for all routes
- **Requirements**: User must be authenticated to create/edit demo meetings
- **Integration**: No changes needed

### 2. Organization Context
- **Uses**: `getCurrentOrganizationId()` for multi-tenant isolation
- **Requirements**: All qualification data scoped to organization
- **Integration**: No changes needed

### 3. Variable Replacement System
- **Enhancement**: Add qualification fields as variables
- **New Variables**:
  - `{contact_role}`
  - `{number_of_venues}`
  - `{painpoints}` (formatted as list)
  - `{meeting_link}`
  - etc.
- **Implementation**: Update `variable-replacement-service.js` VARIABLE_MAPPINGS

### 4. Task Templates
- **Enhancement**: Support demo_meeting in templates
- **Pre-fill**: Templates can specify default qualification values
- **Integration**: Existing template system handles this automatically

### 5. Sequence System (Future)
- **Compatibility**: Demo meeting tasks work in sequences
- **Context Passing**: Qualification data flows through sequence steps
- **Integration**: No additional work needed - uses existing metadata

---

## Error Handling

### Frontend Error Handling

```typescript
// CreateTaskModal error handling pattern
const handleCreate = async () => {
  try {
    setLoading(true);
    setError(null);

    // Client-side validation
    if (formData.type === 'demo_meeting' && !formData.restaurant_id) {
      setError('Restaurant is required for demo meetings');
      return;
    }

    // API call
    const response = await api.post('/tasks', {
      ...formData,
      qualification_data: qualificationData
    });

    if (response.data.success) {
      toast({ title: "Success", description: "Demo meeting created" });
      onSuccess();
      onClose();
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.error || 'Failed to create task';
    setError(errorMessage);
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};
```

### Backend Error Handling

```javascript
// tasks-routes.js error handling
router.post('/', authMiddleware, async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      created_by: req.user.id,
      organisation_id: req.organizationId
    };

    // Validation for demo_meeting
    if (taskData.type === 'demo_meeting' && !taskData.restaurant_id) {
      return res.status(400).json({
        success: false,
        error: 'restaurant_id is required for demo_meeting tasks'
      });
    }

    const task = await tasksService.createTask(taskData);
    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);

    // Specific error messages
    if (error.message.includes('restaurant')) {
      return res.status(400).json({
        success: false,
        error: 'Failed to update restaurant record'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create task'
    });
  }
});
```

### Database Error Handling

```javascript
// qualification-service.js error handling
async function updateRestaurantQualification(restaurantId, qualificationData) {
  const client = getSupabaseClient();

  try {
    const updates = mapQualificationToRestaurant(qualificationData);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .eq('organisation_id', getCurrentOrganizationId());

    if (error) {
      // Log detailed error for debugging
      console.error('Restaurant update error:', {
        restaurantId,
        updates,
        error
      });

      // Check for specific error types
      if (error.code === '23514') {
        throw new Error('Invalid data: Check constraint violation');
      }

      if (error.code === '23503') {
        throw new Error('Restaurant not found or access denied');
      }

      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('updateRestaurantQualification failed:', error);
    throw error;
  }
}
```

---

## Performance Considerations

### Frontend Optimization

1. **Form State Management**
   - Use `useState` for qualification data object
   - Debounce field changes if auto-saving
   - Memoize expensive validations

2. **Component Rendering**
   - Memoize TagInput options with `useMemo`
   - Use `React.memo` for static sections
   - Lazy load qualification form until needed

3. **Data Loading**
   - Pre-fetch restaurant data when modal opens
   - Cache pre-configured options in constants
   - Use optimistic updates for better UX

### Backend Optimization

1. **Database Queries**
   - Batch updates in single transaction
   - Use prepared statements for repeated queries
   - Index all frequently filtered columns

2. **Data Transfer**
   - Only send changed fields on edit
   - Gzip API responses
   - Use select() to limit returned fields

3. **Caching Strategy**
   - Cache pre-configured options in memory
   - Consider Redis for session data
   - Use Supabase realtime for live updates

---

## Security Considerations

### 1. Input Validation

**Frontend:**
- Sanitize all text inputs
- Validate numeric ranges
- Check URL formats (if validating meeting_link)
- Limit array lengths (max 20 items per JSON array)

**Backend:**
- Re-validate all inputs server-side
- Use parameterized queries (Supabase client handles this)
- Check data types match schema

### 2. Authorization

**Row-Level Security:**
```sql
-- Restaurants table RLS already exists
-- Ensure demo qualification columns follow same rules

-- Tasks table RLS already exists
-- Demo_meeting tasks inherit existing policies
```

**API Layer:**
- Verify user belongs to organization
- Check user has permission to modify restaurant
- Validate restaurant_id exists and belongs to org

### 3. Data Protection

**Sensitive Data:**
- Qualification data may contain business-sensitive information
- Ensure HTTPS for all API calls
- Log access to qualification data for audit

**SQL Injection:**
- Supabase client uses parameterized queries
- Never concatenate user input into queries
- Validate all IDs are valid UUIDs

### 4. JSONB Injection

**Risk:** Malicious JSON in array fields

**Mitigation:**
```javascript
// Validate JSON array structure
function validateTagArray(arr) {
  if (!Array.isArray(arr)) return false;

  return arr.every(item =>
    item &&
    typeof item === 'object' &&
    ['predefined', 'custom'].includes(item.type) &&
    typeof item.value === 'string' &&
    item.value.length <= 200 // Max value length
  );
}
```

---

## Testing Strategy

### Unit Tests

**Frontend:**
```typescript
// QualificationForm.test.tsx
describe('QualificationForm', () => {
  it('renders all qualification fields', () => {});
  it('calls onChange when field value changes', () => {});
  it('validates numeric inputs', () => {});
  it('handles JSON array fields correctly', () => {});
});

// TagInput.test.tsx
describe('TagInput', () => {
  it('displays pre-configured options', () => {});
  it('allows selecting multiple options', () => {});
  it('allows adding custom values', () => {});
  it('prevents duplicate values', () => {});
});
```

**Backend:**
```javascript
// qualification-service.test.js
describe('qualification-service', () => {
  it('maps qualification data to restaurant columns', () => {});
  it('updates restaurant with all fields', () => {});
  it('updates only changed fields', () => {});
  it('handles invalid data gracefully', () => {});
});
```

### Integration Tests

```typescript
describe('Demo Meeting End-to-End', () => {
  it('creates demo meeting and updates restaurant', async () => {
    const task = await createDemoMeetingTask({
      restaurant_id: testRestaurantId,
      qualification_data: mockQualificationData
    });

    expect(task.type).toBe('demo_meeting');

    const restaurant = await getRestaurant(testRestaurantId);
    expect(restaurant.contact_role).toBe(mockQualificationData.contact_role);
  });

  it('edits demo meeting and updates only changed fields', async () => {
    const updatedTask = await updateDemoMeetingTask(taskId, {
      qualification_data_changes: {
        contact_role: 'New Role'
      }
    });

    const restaurant = await getRestaurant(testRestaurantId);
    expect(restaurant.contact_role).toBe('New Role');
    expect(restaurant.number_of_venues).toBe(originalVenues); // Unchanged
  });
});
```

### E2E Tests (Playwright)

```typescript
test('Sales rep creates demo meeting with qualification data', async ({ page }) => {
  await page.goto('/tasks');
  await page.click('text=New Task');
  await page.selectOption('select[name="type"]', 'demo_meeting');
  await page.selectOption('select[name="restaurant_id"]', testRestaurantId);

  // Fill qualification fields
  await page.fill('input[name="contact_role"]', 'Owner');
  await page.fill('input[name="number_of_venues"]', '3');
  await page.fill('input[name="meeting_link"]', 'https://calendly.com/test');

  // Add tags
  await page.click('button:has-text("Painpoints")');
  await page.click('text=High third-party commission fees');

  await page.click('button:has-text("Create Task")');

  // Verify success
  await expect(page.locator('text=Demo meeting created')).toBeVisible();
});
```

---

**Document Prepared By:** Claude (AI Assistant)
**Last Updated:** 2025-01-19
**Version:** 1.0
**Status:** Design Approved - Ready for Implementation
