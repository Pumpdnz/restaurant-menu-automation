# Demo Booking Feature - Project Requirements Document

**Version:** 1.1
**Date:** 2025-01-19
**Status:** Requirements Approved

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Business Requirements](#business-requirements)
4. [Technical Requirements](#technical-requirements)
5. [Database Schema Changes](#database-schema-changes)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [User Experience Flow](#user-experience-flow)
9. [Data Validation & Constraints](#data-validation--constraints)
10. [Integration Points](#integration-points)
11. [Testing Requirements](#testing-requirements)
12. [Success Criteria](#success-criteria)

---

## Executive Summary

### Purpose
Enhance the sales task management system to better support the demo booking process by capturing detailed qualification information discovered during the initial demo booking stage. This information will assist sales reps with follow-ups, deal closing, and ensure smooth handover to Customer Success when deals are closed-won.

### Scope
- Add 18 new qualification columns to the `restaurants` table
- Create a new "Demo Meeting" task type
- Implement a specialized form interface for demo meeting qualification
- Update task display components to show qualification information
- Maintain full backward compatibility with existing task types

### Key Benefits
1. **Improved Lead Qualification**: Capture detailed business context during demo booking
2. **Better Follow-up**: Sales reps have all necessary context for personalized follow-ups
3. **Smoother Handoff**: CS team receives comprehensive qualification data
4. **Data-Driven Insights**: Track common painpoints, objections, and selling points
5. **Streamlined Workflow**: Single interface to create demo tasks and update qualification data

---

## Current System Analysis

### Existing Task Types
The system currently supports 5 task types:
1. **internal_activity** - Shows all contact information in quick view and detail modal
2. **email** - Shows email addresses and rendered message preview
3. **call** - Shows phone numbers and contact name
4. **social_message** - Shows social media links and message preview
5. **text** - Shows phone numbers and message preview

### Current Task Creation Flow
1. User opens CreateTaskModal
2. Selects task type (optional template selection)
3. Fills in task-specific fields (name, description, type, priority, due date)
4. For communication tasks: optional message template + message content
5. Task is created with `metadata` JSONB field for additional data
6. Restaurant record is NOT updated (tasks are separate entities)

### Current Restaurant Table Structure
The `restaurants` table includes:
- **Core Fields**: name, address, contact info, website, logo
- **Sales Fields**: lead_type, lead_category, lead_engagement_source, lead_warmth, lead_stage, lead_status, icp_rating, last_contacted, demo_store_built, demo_store_url, assigned_sales_rep
- **Platform URLs**: ubereats_url, doordash_url, instagram_url, facebook_url
- **Business Info**: opening_hours, cuisine, organisation_name
- **Onboarding**: onboarding_status, user_email, subdomain

### Key Components
1. **CreateTaskModal** ([src/components/tasks/CreateTaskModal.tsx](../../UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx))
   - Handles task creation with dynamic fields based on type
   - Supports task templates and message templates
   - Includes duplicate and follow-up modes

2. **TaskTypeQuickView** ([src/components/tasks/TaskTypeQuickView.tsx](../../UberEats-Image-Extractor/src/components/tasks/TaskTypeQuickView.tsx))
   - Popover component showing type-specific information
   - Different views for each task type
   - Includes copy-to-clipboard functionality

3. **TaskDetailModal** ([src/components/tasks/TaskDetailModal.tsx](../../UberEats-Image-Extractor/src/components/tasks/TaskDetailModal.tsx))
   - Full task details in modal dialog
   - Shows contact information for internal_activity type
   - Displays message preview for communication tasks

4. **Tasks Page** ([src/pages/Tasks.tsx](../../UberEats-Image-Extractor/src/pages/Tasks.tsx))
   - Table view with filtering and sorting
   - Inline status updates
   - Due date management
   - Restaurant filters integrated

---

## Business Requirements

### Primary Objectives
1. **Capture Qualification Data**: Record detailed business information during demo booking
2. **Update Restaurant Records**: Automatically update restaurant record with qualification data when demo meeting task is created AND edited (bi-directional sync)
3. **Support Sales Process**: Provide easy access to qualification data for follow-ups and deal progression
4. **Enable Customization**: Support both pre-configured options and custom text inputs
5. **Flexible Data Capture**: No required fields for maximum flexibility in different demo scenarios

### User Stories

#### US1: Create Demo Meeting Task
**As a** sales rep
**I want to** create a Demo Meeting task with qualification fields
**So that** I can record all relevant business context discovered during the demo booking process

**Acceptance Criteria:**
- [ ] "Demo Meeting" appears as a new task type option
- [ ] When selected, form displays all 18 qualification fields
- [ ] Fields support both dropdown selection and custom text input where applicable
- [ ] Meeting link field is prominently displayed
- [ ] Form validates required fields before submission
- [ ] Task creation updates both tasks table AND restaurants table

#### US2: View Demo Meeting Details in Table
**As a** sales rep
**I want to** see key demo meeting information in the tasks table
**So that** I can quickly access contact details and meeting links

**Acceptance Criteria:**
- [ ] Type column click shows full contact information (like internal_activity)
- [ ] Meeting link is displayed and clickable in quick view
- [ ] All qualification data is accessible via quick view
- [ ] Copy-to-clipboard works for contact fields and meeting link

#### US3: View Full Demo Meeting Details
**As a** sales rep
**I want to** view all qualification fields in the task detail modal
**So that** I can review all information before a demo or follow-up

**Acceptance Criteria:**
- [ ] Detail modal shows all 18 qualification fields
- [ ] Fields are organized into logical sections
- [ ] Empty fields are handled gracefully (show "-" or hide)
- [ ] Meeting link is prominent and clickable
- [ ] JSON array fields (painpoints, etc.) display as formatted lists

#### US4: Pre-fill Demo Meeting from Restaurant Data
**As a** sales rep
**I want to** existing restaurant data pre-filled in the demo meeting form
**So that** I don't have to re-enter information I already know

**Acceptance Criteria:**
- [ ] If restaurant already has qualification data, pre-fill fields
- [ ] User can modify pre-filled values
- [ ] Form indicates which fields were auto-filled vs manually entered

---

## Technical Requirements

### New Database Columns

All columns to be added to the `public.restaurants` table:

```sql
-- Contact & Business Context
contact_role TEXT                           -- Role/title of contact person
number_of_venues INTEGER                   -- Number of restaurant locations
point_of_sale TEXT                         -- POS system name
online_ordering_platform TEXT              -- Current online ordering platform
online_ordering_handles_delivery BOOLEAN   -- Whether platform handles delivery
self_delivery BOOLEAN                      -- Whether they do self-delivery

-- UberEats Metrics
weekly_uber_sales_volume NUMERIC(10, 2)   -- Weekly sales on UberEats
uber_aov NUMERIC(10, 2)                   -- Average order value ($)
uber_markup NUMERIC(5, 2)                 -- Menu markup percentage (%)
uber_profitability NUMERIC(5, 2)          -- Profitability percentage (%)
uber_profitability_description TEXT       -- Detailed profitability context

-- Marketing & Website
current_marketing_description TEXT         -- Current marketing efforts
website_type TEXT                         -- 'platform_subdomain' OR 'custom_domain'

-- Sales Context (JSON Arrays with Custom Support)
painpoints JSONB                          -- Array of {type: 'predefined'|'custom', value: string}
core_selling_points JSONB                 -- Array of {type: 'predefined'|'custom', value: string}
features_to_highlight JSONB              -- Array of {type: 'predefined'|'custom', value: string}
possible_objections JSONB                -- Array of {type: 'predefined'|'custom', value: string}

-- Meeting Details
details TEXT                             -- Additional context/notes
meeting_link TEXT                        -- Calendar invite or video call link
```

### Pre-configured Options

**Painpoints:**
- High third-party commission fees
- Commission eating into margins
- Converting Uber customers to Direct Ordering
- Poor control over customer experience
- Limited customer data access
- Difficult to leverage customer data with current platform
- Lack of direct customer relationship
- Unable to run own promotions

**Core Selling Points:**
- Get more customers to order directly
- Get more regular customers
- Setup custom SMS messages based on activity data
- Improve margins on delivery by cutting delivery commissions to 5%
- Improve customer ordering experience
- Increase repeat ordering frequency
- Improve Google Business Profile Reviews
- Custom branding
- Built-in loyalty program
- Integrated marketing tools
- Customer insights & analytics

**Features to Highlight:**
- 5% commission on delivery orders
- 2% commission on pickup orders
- Custom Branding
- Beautiful online ordering platform
- Improved SEO with custom domain
- Welcome flow promotions
- Automated review requests
- Converting first-time customers to regulars with SMS Promotions
- Increasing repeat ordering with a loyalty program and customer-activity based SMS messages
- Real-time notifications
- Easy Menu management
- Unbeatable support
- Order management dashboard
- Order Aggregation
- Email marketing tools built in
- SMS marketing tools built in

**Possible Objections:**
- Has strong relationship with Online Ordering / POS provider
- Current Online Ordering is integrated with POS
- Price for delivery for customers
- No commission fee on current delivery platform
- UberEats and DoorDash receipt printing
- Concerned about customer adoption
- Worried about technical complexity
- Unsure about marketing capabilities
- Budget constraints
- Concerned about onboarding time
- Current contract obligations
- Happy with current setup

---

## Database Schema Changes

### Migration: `add_demo_qualification_columns_to_restaurants.sql`

```sql
-- Migration: Add demo booking qualification columns to restaurants table
-- Date: 2025-01-19
-- Description: Adds fields to capture qualification data during demo booking

BEGIN;

-- Contact & Business Context
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_role TEXT,
  ADD COLUMN IF NOT EXISTS number_of_venues INTEGER CHECK (number_of_venues > 0),
  ADD COLUMN IF NOT EXISTS point_of_sale TEXT,
  ADD COLUMN IF NOT EXISTS online_ordering_platform TEXT,
  ADD COLUMN IF NOT EXISTS online_ordering_handles_delivery BOOLEAN,
  ADD COLUMN IF NOT EXISTS self_delivery BOOLEAN;

-- UberEats Metrics
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS weekly_uber_sales_volume NUMERIC(10, 2) CHECK (weekly_uber_sales_volume >= 0),
  ADD COLUMN IF NOT EXISTS uber_aov NUMERIC(10, 2) CHECK (uber_aov >= 0),
  ADD COLUMN IF NOT EXISTS uber_markup NUMERIC(5, 2) CHECK (uber_markup >= 0 AND uber_markup <= 100),
  ADD COLUMN IF NOT EXISTS uber_profitability NUMERIC(5, 2) CHECK (uber_profitability >= -100 AND uber_profitability <= 100),
  ADD COLUMN IF NOT EXISTS uber_profitability_description TEXT;

-- Marketing & Website
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS current_marketing_description TEXT,
  ADD COLUMN IF NOT EXISTS website_type TEXT CHECK (website_type IN ('platform_subdomain', 'custom_domain'));

-- Sales Context (JSON Arrays)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS painpoints JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS core_selling_points JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features_to_highlight JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS possible_objections JSONB DEFAULT '[]'::jsonb;

-- Meeting Details
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_contact_role
  ON public.restaurants(contact_role);

CREATE INDEX IF NOT EXISTS idx_restaurants_number_of_venues
  ON public.restaurants(number_of_venues);

CREATE INDEX IF NOT EXISTS idx_restaurants_website_type
  ON public.restaurants(website_type);

-- GIN indexes for JSON arrays (for searching within arrays)
CREATE INDEX IF NOT EXISTS idx_restaurants_painpoints
  ON public.restaurants USING GIN (painpoints);

CREATE INDEX IF NOT EXISTS idx_restaurants_core_selling_points
  ON public.restaurants USING GIN (core_selling_points);

CREATE INDEX IF NOT EXISTS idx_restaurants_features_to_highlight
  ON public.restaurants USING GIN (features_to_highlight);

CREATE INDEX IF NOT EXISTS idx_restaurants_possible_objections
  ON public.restaurants USING GIN (possible_objections);

COMMIT;
```

### Task Type Enhancement

The `tasks` table already supports the required fields via the `metadata` JSONB column. No schema changes needed for tasks table itself. However, we need to:

1. Add "demo_meeting" to the task type enum check constraint
2. Store demo qualification data in task metadata for reference

```sql
-- Migration: Add demo_meeting task type
-- Date: 2025-01-19

BEGIN;

-- Drop existing constraint
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Add new constraint with demo_meeting
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check CHECK (
    type IN (
      'internal_activity',
      'social_message',
      'text',
      'email',
      'call',
      'demo_meeting'
    )
  );

COMMIT;
```

---

## Backend Implementation

### API Endpoints

No new endpoints required. Existing endpoints will be enhanced:

#### 1. POST `/api/tasks` - Enhanced for Demo Meeting
**Request Body:**
```typescript
{
  name: string;
  description?: string;
  type: 'demo_meeting';
  priority: 'low' | 'medium' | 'high';
  restaurant_id: string; // REQUIRED for demo_meeting
  due_date?: string;

  // Demo qualification fields
  qualification_data: {
    contact_role?: string;
    number_of_venues?: number;
    point_of_sale?: string;
    online_ordering_platform?: string;
    online_ordering_handles_delivery?: boolean;
    self_delivery?: boolean;
    weekly_uber_sales_volume?: number;
    uber_aov?: number;
    uber_markup?: number;
    uber_profitability?: number;
    uber_profitability_description?: string;
    current_marketing_description?: string;
    website_type?: 'platform_subdomain' | 'custom_domain';
    painpoints?: Array<{type: 'predefined'|'custom', value: string}>;
    core_selling_points?: Array<{type: 'predefined'|'custom', value: string}>;
    features_to_highlight?: Array<{type: 'predefined'|'custom', value: string}>;
    possible_objections?: Array<{type: 'predefined'|'custom', value: string}>;
    details?: string;
    meeting_link?: string;
  };
}
```

**Response:**
```typescript
{
  success: true;
  task: { /* task object */ };
  restaurant_updated: true;
}
```

### Service Layer Changes

**File:** `/src/services/tasks-service.js`

Add logic to handle demo_meeting type:

```javascript
async function createTask(taskData) {
  const client = getSupabaseClient();

  // ... existing template logic ...

  // NEW: Handle demo_meeting type
  if (taskData.type === 'demo_meeting' && taskData.qualification_data) {
    if (!taskData.restaurant_id) {
      throw new Error('restaurant_id is required for demo_meeting tasks');
    }

    // Update restaurant with qualification data
    const { error: updateError } = await client
      .from('restaurants')
      .update({
        contact_role: taskData.qualification_data.contact_role,
        number_of_venues: taskData.qualification_data.number_of_venues,
        point_of_sale: taskData.qualification_data.point_of_sale,
        online_ordering_platform: taskData.qualification_data.online_ordering_platform,
        online_ordering_handles_delivery: taskData.qualification_data.online_ordering_handles_delivery,
        self_delivery: taskData.qualification_data.self_delivery,
        weekly_uber_sales_volume: taskData.qualification_data.weekly_uber_sales_volume,
        uber_aov: taskData.qualification_data.uber_aov,
        uber_markup: taskData.qualification_data.uber_markup,
        uber_profitability: taskData.qualification_data.uber_profitability,
        uber_profitability_description: taskData.qualification_data.uber_profitability_description,
        current_marketing_description: taskData.qualification_data.current_marketing_description,
        website_type: taskData.qualification_data.website_type,
        painpoints: taskData.qualification_data.painpoints || [],
        core_selling_points: taskData.qualification_data.core_selling_points || [],
        features_to_highlight: taskData.qualification_data.features_to_highlight || [],
        possible_objections: taskData.qualification_data.possible_objections || [],
        details: taskData.qualification_data.details,
        meeting_link: taskData.qualification_data.meeting_link,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskData.restaurant_id)
      .eq('organisation_id', getCurrentOrganizationId());

    if (updateError) {
      console.error('Failed to update restaurant with qualification data:', updateError);
      throw new Error('Failed to update restaurant record');
    }

    // Store qualification data in task metadata for reference
    taskData.metadata = {
      ...(taskData.metadata || {}),
      qualification_data: taskData.qualification_data
    };
  }

  // ... existing task creation logic ...
}
```

---

## Frontend Implementation

### 1. Update CreateTaskModal Component

**File:** `/src/components/tasks/CreateTaskModal.tsx`

Add demo_meeting type and qualification fields:

```typescript
// Add to type options
<SelectItem value="demo_meeting">Demo Meeting</SelectItem>

// Add demo meeting form section (conditionally rendered)
{formData.type === 'demo_meeting' && (
  <div className="space-y-4 border-t pt-4">
    <div className="text-sm font-semibold">Demo Qualification</div>

    {/* Contact & Business Context */}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Contact Role</Label>
        <Input
          placeholder="e.g., Owner, Manager"
          value={qualificationData.contact_role}
          onChange={(e) => updateQualification('contact_role', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Number of Venues</Label>
        <Input
          type="number"
          min="1"
          placeholder="e.g., 1, 3, 5"
          value={qualificationData.number_of_venues}
          onChange={(e) => updateQualification('number_of_venues', parseInt(e.target.value))}
        />
      </div>
    </div>

    {/* ... Additional fields following same pattern ... */}

    {/* JSON Array Fields with Multi-select + Custom */}
    <div className="space-y-2">
      <Label>Painpoints</Label>
      <TagInput
        options={PREDEFINED_PAINPOINTS}
        selected={qualificationData.painpoints}
        onChange={(v) => updateQualification('painpoints', v)}
        allowCustom={true}
        placeholder="Select or add painpoints..."
      />
    </div>

    {/* Meeting Link */}
    <div className="space-y-2">
      <Label>Meeting Link *</Label>
      <Input
        type="url"
        placeholder="https://calendly.com/..."
        value={qualificationData.meeting_link}
        onChange={(e) => updateQualification('meeting_link', e.target.value)}
      />
    </div>
  </div>
)}
```

### 2. Create TagInput Component

**New File:** `/src/components/ui/tag-input.tsx`

Multi-select with custom value support:

```typescript
interface TagInputProps {
  options: string[];
  selected: Array<{type: 'predefined'|'custom', value: string}>;
  onChange: (selected: Array<{type: 'predefined'|'custom', value: string}>) => void;
  allowCustom?: boolean;
  placeholder?: string;
}

export function TagInput({ options, selected, onChange, allowCustom, placeholder }: TagInputProps) {
  // Implementation with:
  // - Dropdown for predefined options
  // - Input for custom values
  // - Tag badges with remove buttons
  // - Visual distinction between predefined and custom tags
}
```

### 3. Update TaskTypeQuickView Component

**File:** `/src/components/tasks/TaskTypeQuickView.tsx`

Add demo_meeting view:

```typescript
const renderDemoMeetingView = () => (
  <div className="space-y-3">
    <div className="text-sm font-semibold">Demo Meeting</div>

    {/* Meeting Link - Prominent Display */}
    {task.restaurants?.meeting_link && (
      <div className="bg-brand-blue/10 border border-brand-blue/30 p-3 rounded-md">
        <div className="text-xs font-medium text-brand-blue mb-2">Meeting Link</div>
        <a
          href={task.restaurants.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-blue hover:underline flex items-center gap-1"
        >
          Join Meeting
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    )}

    {/* Contact Information */}
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground mb-2">Contact Information</div>
      <ContactField icon={User} label="Contact Name" value={task.restaurants?.contact_name} field="Contact Name" />
      <ContactField icon={User} label="Contact Role" value={task.restaurants?.contact_role} field="Contact Role" />
      <ContactField icon={Phone} label="Contact Phone" value={task.restaurants?.contact_phone} field="Contact Phone" />
      <ContactField icon={Mail} label="Contact Email" value={task.restaurants?.contact_email} field="Contact Email" />
    </div>

    {/* Business Context - Collapsible or Summary */}
    {hasBusinessContext(task) && (
      <details className="border rounded-md p-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Business Context
        </summary>
        <div className="mt-2 space-y-2 text-xs">
          {task.restaurants?.number_of_venues && (
            <div><span className="font-medium">Venues:</span> {task.restaurants.number_of_venues}</div>
          )}
          {task.restaurants?.point_of_sale && (
            <div><span className="font-medium">POS:</span> {task.restaurants.point_of_sale}</div>
          )}
          {/* ... other context fields ... */}
        </div>
      </details>
    )}
  </div>
);
```

### 4. Update TaskDetailModal Component

**File:** `/src/components/tasks/TaskDetailModal.tsx`

Add comprehensive demo meeting detail view:

```typescript
{/* Demo Meeting Qualification Section */}
{task.type === 'demo_meeting' && task.restaurants && (
  <div className="space-y-4 border-t pt-4">
    <div className="text-sm font-semibold">Demo Qualification</div>

    {/* Meeting Link */}
    {task.restaurants.meeting_link && (
      <div className="bg-brand-blue/10 border border-brand-blue/30 p-4 rounded-lg">
        <div className="text-xs font-medium text-brand-blue mb-2">Meeting Link</div>
        <a
          href={task.restaurants.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-medium text-brand-blue hover:underline flex items-center gap-2"
        >
          {task.restaurants.meeting_link}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    )}

    {/* Contact & Business Context */}
    <div className="grid grid-cols-2 gap-4">
      <InfoField label="Contact Role" value={task.restaurants.contact_role} />
      <InfoField label="Number of Venues" value={task.restaurants.number_of_venues} />
      <InfoField label="Point of Sale" value={task.restaurants.point_of_sale} />
      <InfoField label="Online Ordering Platform" value={task.restaurants.online_ordering_platform} />
    </div>

    {/* Boolean Fields */}
    <div className="grid grid-cols-2 gap-4">
      <BooleanField label="Platform Handles Delivery" value={task.restaurants.online_ordering_handles_delivery} />
      <BooleanField label="Self Delivery" value={task.restaurants.self_delivery} />
    </div>

    {/* UberEats Metrics */}
    <div className="grid grid-cols-2 gap-4">
      <InfoField label="Weekly UberEats Sales" value={formatCurrency(task.restaurants.weekly_uber_sales_volume)} />
      <InfoField label="UberEats AOV" value={formatCurrency(task.restaurants.uber_aov)} />
      <InfoField label="UberEats Markup" value={formatPercentage(task.restaurants.uber_markup)} />
      <InfoField label="UberEats Profitability" value={formatPercentage(task.restaurants.uber_profitability)} />
    </div>

    {task.restaurants.uber_profitability_description && (
      <InfoField label="Profitability Details" value={task.restaurants.uber_profitability_description} />
    )}

    {/* Marketing & Website */}
    <InfoField label="Current Marketing" value={task.restaurants.current_marketing_description} />
    <InfoField label="Website Type" value={formatWebsiteType(task.restaurants.website_type)} />

    {/* JSON Array Fields */}
    <TagList label="Painpoints" items={task.restaurants.painpoints} />
    <TagList label="Core Selling Points" items={task.restaurants.core_selling_points} />
    <TagList label="Features to Highlight" items={task.restaurants.features_to_highlight} />
    <TagList label="Possible Objections" items={task.restaurants.possible_objections} />

    {/* Additional Details */}
    {task.restaurants.details && (
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">Additional Details</div>
        <p className="text-sm whitespace-pre-wrap">{task.restaurants.details}</p>
      </div>
    )}
  </div>
)}
```

### 5. Create Helper Components

**New Files:**

1. `/src/components/demo-meeting/InfoField.tsx` - Labeled field display
2. `/src/components/demo-meeting/BooleanField.tsx` - Yes/No/Unknown display
3. `/src/components/demo-meeting/TagList.tsx` - Display JSON array as tags

---

## User Experience Flow

### Creating a Demo Meeting Task

1. **User clicks "New Task"**
   - CreateTaskModal opens

2. **User selects "Demo Meeting" from Type dropdown**
   - Modal expands to show qualification fields
   - Restaurant selector becomes required (show warning if not selected)

3. **User fills in qualification data**
   - Some fields have dropdowns with common values
   - JSON array fields have tag input with predefined + custom options
   - Meeting link is required and validated as URL
   - Form shows validation errors inline

4. **User clicks "Create Task"**
   - Frontend validates all required fields
   - POST request sent to `/api/tasks` with qualification_data
   - Backend creates task AND updates restaurant record
   - Success toast shows "Demo meeting created and restaurant updated"
   - Modal closes and task list refreshes

### Viewing Demo Meeting Information

**In Tasks Table:**
1. User sees "Demo Meeting" in Type column
2. Clicks on type → TaskTypeQuickView popover appears
3. Sees:
   - Prominent meeting link (Join Meeting button)
   - Full contact information with copy buttons
   - Collapsed business context section (optional expansion)

**In Task Detail Modal:**
1. User clicks task name → TaskDetailModal opens
2. Sees complete qualification information:
   - All fields organized into sections
   - Meeting link prominently displayed
   - Contact info, business metrics, sales context
   - JSON arrays displayed as colored tags
   - Empty fields hidden (clean presentation)

### Pre-filling Existing Data

1. User selects restaurant with existing qualification data
2. CreateTaskModal pre-fills all matching fields
3. Fields are editable (user can update values)
4. Updated values overwrite restaurant record on task creation

---

## Data Validation & Constraints

### Required Fields
For demo_meeting tasks:
- `restaurant_id` - MUST be selected
- `meeting_link` - MUST be valid URL
- `name` - Task name (inherited from base task requirements)

### Optional Fields
All qualification fields are optional to allow flexibility in data capture

### Validation Rules

**Number Fields:**
- `number_of_venues`: Integer > 0
- `weekly_uber_sales_volume`: Decimal >= 0
- `uber_aov`: Decimal >= 0
- `uber_markup`: Decimal 0-100
- `uber_profitability`: Decimal -100 to 100

**Boolean Fields:**
- `online_ordering_handles_delivery`: true | false | null
- `self_delivery`: true | false | null

**Enum Fields:**
- `website_type`: 'platform_subdomain' | 'custom_domain' | null

**URL Fields:**
- `meeting_link`: Valid URL format

**JSON Arrays:**
- Must be valid JSON arrays
- Each item: `{type: 'predefined'|'custom', value: string}`
- Empty arrays default to `[]`

### Frontend Validation

```typescript
const validateDemoMeeting = (data: QualificationData): ValidationResult => {
  const errors: string[] = [];

  if (!data.meeting_link) {
    errors.push('Meeting link is required');
  } else if (!isValidUrl(data.meeting_link)) {
    errors.push('Meeting link must be a valid URL');
  }

  if (data.number_of_venues && data.number_of_venues < 1) {
    errors.push('Number of venues must be at least 1');
  }

  if (data.uber_markup && (data.uber_markup < 0 || data.uber_markup > 100)) {
    errors.push('UberEats markup must be between 0-100%');
  }

  if (data.uber_profitability && (data.uber_profitability < -100 || data.uber_profitability > 100)) {
    errors.push('UberEats profitability must be between -100 and 100%');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
```

---

## Integration Points

### 1. Restaurant Detail Page
- **Location**: `/src/pages/RestaurantDetail.jsx`
- **Enhancement**: Add "Demo Qualification" tab showing all qualification fields
- **Purpose**: View/edit qualification data from restaurant record directly

### 2. Task Templates
- **Enhancement**: Allow creating task templates for demo meetings
- **Pre-fill**: Template can specify default values for qualification fields
- **Use Case**: Standardize demo meeting creation across team

### 3. Sequence System (Future)
- **Integration**: Demo meeting tasks can be part of automated sequences
- **Trigger**: Auto-create follow-up tasks after demo meeting completion
- **Context**: Qualification data flows through sequence for personalization

### 4. Variable Replacement (Existing)
- **Enhancement**: Add qualification fields as available variables
- **Use Case**: Personalize follow-up messages with demo context
- **Examples**:
  - `{contact_role}` → "Owner"
  - `{number_of_venues}` → "3"
  - `{painpoints}` → List of painpoints

---

## Testing Requirements

### Unit Tests

**Backend:**
- [ ] Task creation with demo_meeting type updates restaurant record
- [ ] Validation rejects invalid qualification data
- [ ] Restaurant update fails gracefully if task creation succeeds
- [ ] Correct handling of null/undefined values
- [ ] JSON array fields serialize/deserialize correctly

**Frontend:**
- [ ] Form validation catches all required field violations
- [ ] Tag input component handles predefined + custom values
- [ ] Meeting link validation works for various URL formats
- [ ] Pre-filling works when restaurant has existing data
- [ ] Form reset clears all qualification fields

### Integration Tests
- [ ] Complete flow: create demo meeting → verify restaurant updated
- [ ] Demo meeting with template → verify correct field population
- [ ] Duplicate demo meeting → verify qualification data copied
- [ ] Edit demo meeting → verify restaurant NOT updated on edit
- [ ] Delete demo meeting → verify restaurant data NOT deleted

### E2E Tests
- [ ] Sales rep creates first demo meeting for new restaurant
- [ ] Sales rep updates demo meeting qualification data
- [ ] Sales rep views demo meeting in table quick view
- [ ] Sales rep views demo meeting in detail modal
- [ ] Sales rep creates follow-up task from demo meeting

### Performance Tests
- [ ] Loading demo meeting form with 100+ restaurants
- [ ] Rendering tasks table with 50+ demo meetings
- [ ] Quick view performance with large qualification data

---

## Success Criteria

### Functional Requirements Met
- [ ] Demo Meeting task type appears in create task modal
- [ ] All 18 qualification fields display correctly
- [ ] Task creation updates restaurant record atomically
- [ ] Quick view shows contact info + meeting link
- [ ] Detail modal shows all qualification data
- [ ] Pre-filling works for existing qualification data

### User Experience Goals
- [ ] Form is intuitive and easy to complete
- [ ] Validation errors are clear and actionable
- [ ] Meeting link is prominently displayed
- [ ] Contact information is easily accessible with copy buttons
- [ ] Qualification data loads quickly in all views

### Data Quality
- [ ] 90%+ of demo meetings have meeting_link populated
- [ ] 70%+ of demo meetings have at least 5 qualification fields filled
- [ ] No data loss when creating/updating demo meetings
- [ ] JSON arrays are well-formed and queryable

### Technical Quality
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Database migrations run cleanly
- [ ] Performance within acceptable limits (<2s load time)
- [ ] Backward compatibility maintained with existing tasks

---

## Decisions Made

1. **Edit Behavior**: YES - Editing a demo meeting task updates the restaurant record with changed fields only
   - **Decision**: Update restaurant on both create AND edit
   - **Implementation**: Track which fields changed and only update those on restaurant record
   - **Rationale**: Keeps restaurant data up-to-date as qualification evolves, prevents overwriting unchanged fields

2. **Required Fields**: NO required fields (not even meeting_link)
   - **Decision**: All qualification fields are optional
   - **Rationale**: Maximum flexibility for different demo scenarios, some demos may not have meeting link yet
   - **Validation**: Only standard task fields required (name, type, restaurant_id)

3. **Meeting Link Validation**: NO validation required
   - **Decision**: Accept any text format (URL, phone number, location, notes)
   - **Rationale**: Users may add placeholder text initially, validation adds unnecessary friction
   - **Implementation**: Plain text input field with no format validation

4. **Pre-configured Options**: Pumpd-specific value propositions updated
   - **Decision**: Use customer-provided lists focused on Pumpd's actual offerings
   - **Lists**: 8 painpoints, 11 selling points, 15 features, 12 objections
   - **Implementation**: Store as constants, allow custom values alongside predefined

5. **JSON Array Display**: Show first 5 items, then expand
   - **Implementation**: Display first 5 tags, "+ X more" button to expand
   - **Rationale**: Keeps UI clean while allowing comprehensive data entry

6. **Historical Data**: Store in task metadata for reference
   - **Implementation**: Task metadata contains snapshot of qualification data at creation/update
   - **Rationale**: Restaurant record is source of truth, task metadata provides history

7. **Duplicate Detection**: Optional future enhancement
   - **Decision**: Not implementing in v1.0
   - **Future**: Could show warning if multiple demo meetings exist for same restaurant

---

## Next Steps

1. **Review & Approval**: Stakeholder review of requirements document
2. **UI/UX Review**: Design review of form layout and field organization
3. **Technical Review**: Engineering review of database schema and implementation approach
4. **Create Implementation Plan**: Break down into specific tasks with estimates
5. **Database Migration**: Create and test migration in development environment
6. **Backend Implementation**: Implement service layer changes
7. **Frontend Implementation**: Build components and integrate with backend
8. **Testing**: Execute full test plan
9. **Documentation**: Update user documentation and training materials
10. **Deployment**: Staged rollout with monitoring

---

**Document prepared by:** Claude (AI Assistant)
**Review status:** Awaiting stakeholder review
**Last updated:** 2025-01-19
