# Investigation: LeadScrapes UI Patterns

## Overview

Analysis of the LeadScrapes page structure and components to inform the design of the new Registration Batches page.

---

## Page Structure: LeadScrapes.tsx

### Overall Architecture
- **Layout**: Two-tab interface with URL parameter state management
- **Tab 1**: "Scrape Jobs" - Lists all extraction jobs with progress cards
- **Tab 2**: "Pending Leads" - Shows leads ready for conversion

### Key State Management
```typescript
- activeTab: Managed via URL params (useSearchParams)
- jobFilters: search, status, platform filters
- pendingFilters: search, platform, city, cuisine filters
- createJobOpen: Modal state for creating new jobs
- Data fetched via: useLeadScrapeJobs, usePendingLeads
```

### Refetch Strategy
- Jobs refetch every 30 seconds
- Pending leads use on-demand refresh
- Dynamic intervals based on processing state (3s when active)

---

## Jobs Tab Architecture

### Filter System
**Components:**
- Search input (text-based)
- MultiSelect dropdowns for status, platform
- Reset filters button

**Status Options:** draft, pending, in_progress, completed, cancelled, failed
**Platform Options:** ubereats, doordash

### Job Listing
- Jobs array mapped to ScrapeJobProgressCard
- Each card handles its own actions
- Parent refetch callback passed down

### Empty State
- Icon, message, and CTA button
- Differentiates "no filters match" vs "create first"

---

## ScrapeJobProgressCard Component

### Structure
```
CardHeader
  ├─ Title (with status badge)
  ├─ Description (timing, step progress)
  └─ Platform link

CardContent
  ├─ Progress Bar (animated)
  └─ ScrapeJobStepList (collapsible)

CardFooter
  └─ Action buttons (refresh, view, start/cancel/delete)
```

### Key Features
- **Compact/Expanded modes**: `compact` prop controls step display
- **Status-based actions**: Different buttons for different statuses
- **Progress calculation**: completedSteps / totalSteps
- **Stats aggregation**: From step data

### Step Indicator
Colored dots in CardHeader for at-a-glance status

---

## Step Handling Patterns

### Automatic Steps
```
- step_type: 'automatic'
- Color: Blue (bg-blue-50)
- Description: "Auto"
- Behavior: Runs automatically
- User interaction: View/inspect only
```

### Action Required Steps
```
- step_type: 'action_required'
- Color: Orange (bg-orange-50)
- Description: "Manual"
- Behavior: Pauses for user review
- User interaction: Review, pass, reject
```

### Status Lifecycle

**Automatic Steps:**
pending → in_progress → completed OR failed

**Action Required Steps:**
pending → action_required (shows "X ready to review") → requires manual action

### Status Icons
```
in_progress: Spinner (blue)
action_required: Orange circle with "!"
pending: Clock (gray)
completed: Green checkmark
failed: Red alert
```

---

## ScrapeJobStepList Component

### Structure
```
Collapsible wrapper
  ├─ Header (expand/collapse)
  │  ├─ Title with completion ratio
  │  └─ Status indicator dots
  │
  └─ CollapsibleContent
      └─ Table of steps
          ├─ Status icon
          ├─ Step name & description
          ├─ Type badge
          ├─ Leads display
          ├─ Time info
          └─ Actions
```

### Key Behaviors
- Current step highlight: bg-blue-50/50
- Action required highlight: bg-orange-50/50
- Row click opens step detail modal

### Step Actions Based on Status
```
pending + current → "Start" button
action_required → "Review" button
completed + has leads → "View" button
in_progress → "Processing..." text
```

---

## Pending Leads Tab: PendingLeadsTable

### Structure
```
Search & Bulk Actions Bar
  ├─ Search input
  ├─ Expand/Collapse all
  └─ Bulk actions (when selected)

Table
  ├─ Selection column (checkbox)
  ├─ Expand column
  ├─ Data columns
  └─ Actions column

Expanded Row
  └─ 3-column grid with contact/business info
```

### Bulk Operations
```
Convert to Restaurants
  ├─ Shows progress dialog
  ├─ Captures converted restaurants
  └─ Triggers sequence enrollment

Delete
  └─ With confirmation

Expand/Collapse All
```

### Extraction Options Dialog
After sequence enrollment:
```
Menu Extraction (UberEats)
  ├─ Extract Menu Items
  ├─ Validate & Download Images
  └─ Extract Option Sets

Branding Extraction (Website)
  └─ Extract Logo, Colors & Favicon
```

---

## Reusable Components

### High-Reusability
1. **ScrapeJobProgressCard** - Progress bars, status badges, actions
2. **ScrapeJobStepList** - Step progression display
3. **AnimatedProgressBar** - Generic progress visualization
4. **Status Badge System** - Consistent colors

### Need New Versions
1. **Filters Card** - Different filter options for registration
2. **Action Buttons Row** - Different actions for registration
3. **Detail Modal** - Different fields for registration
4. **Table Structure** - Same pattern, different data

---

## Proposed Registration Batches Page Structure

```
RegistrationBatches.tsx
├── Tabs: "Batches" | "In-Progress" | "Completed"
│
├── Tab 1: Batches List
│   ├── Filters (org, stage, warmth, status)
│   └── BatchProgressCard[]
│
├── Tab 2: In-Progress Batches
│   ├── Live progress tracking
│   └── Action triggers for manual steps
│
└── Tab 3: Completed Batches
    ├── Summary statistics
    └── Review/export options

BatchProgressCard.tsx
├── Header (batch name, status, progress)
├── Progress bar
├── RegistrationStepList
└── Footer (actions)

RegistrationStepList.tsx
├── Collapsible table of registration steps
├── Step types: automatic, action_required
└── Status-based actions
```

---

## Data Flow Patterns

### Query Hooks
```typescript
useLeadScrapeJobs(filters) → refetch every 30s
useLeadScrapeJob(jobId) → refetch every 10s
usePendingLeads(filters) → on-demand refresh
useStepLeads(jobId, stepNumber) → dynamic 3-10s
```

### Mutation Hooks
```typescript
useStartLeadScrapeJob()
useCancelLeadScrapeJob()
useDeleteLeadScrapeJob()
useTriggerExtraction()
usePassLeadsToNextStep()
useConvertLeadsToRestaurants()
```

### Dynamic Refetch
```typescript
refetchInterval: (query) => {
  const hasProcessing = query.state.data?.leads?.some(
    l => l.step_progression_status === 'processing'
  );
  return hasProcessing ? 3000 : 10000;
}
```

---

## Key Implementation Insights

### Query Invalidation
- On mutation success, invalidate related queries
- Multiple query keys for different scopes

### Progress Calculation
```
Math.round((completedSteps / totalSteps) * 100)
```

### Optimistic Updates
Used for lead status changes to reduce perceived latency

### Disabled States
- While mutations pending
- Based on current status
- Based on selection state
