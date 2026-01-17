# Investigation Plan: Dashboard Update V2

## Overview

This investigation prepares for a Ralph Loop implementation to update the Dashboard page with new report and navigation components. The current Dashboard has basic placeholder components that need to be replaced with functional, feature-flagged components.

## Known Information

### Current Dashboard State (from initial exploration)
- **Location:** `/UberEats-Image-Extractor/src/pages/Dashboard.jsx`
- **Current Components:**
  - 4 stats cards (Active Restaurants, Total Menus, Extractions, Success Rate) - not displaying real data
  - Recent Restaurants list - works intermittently
  - Recent Extractions list - works intermittently
  - Quick Actions (New Extraction, Manage Restaurants, View Analytics)
  - Lead Scraping reports with `CityBreakdownTab` component - not properly tabbed or feature-flagged

### Feature Flag System
- **Location:** `/UberEats-Image-Extractor/src/context/AuthContext.tsx`
- Feature flags stored in `organisations.feature_flags` column as JSONB
- Access via `isFeatureEnabled(path)` method from AuthContext
- Currently NOT used on Dashboard - needs implementation

### Existing Components Available
- `TaskDetailModal.tsx` and `CreateTaskModal.tsx` - task dialogs ready to import
- `CityBreakdownTab.tsx` - city breakdown reports
- `BatchProgressCard.tsx` - batch registration progress
- UI components: Card, Table, Tabs, Badge, Dialog from shadcn/ui

### Target Changes Summary
1. **Remove:** 4 stats cards (Active Restaurants, Total Menus, Extractions, Success Rate)
2. **Fix:** Lead Scraping reports - add tabs, remove nested card, add feature flag
3. **Add:** Recent Pending Leads preview (step 4, status "passed")
4. **Add:** Recent Batch Registration Jobs preview
5. **Add:** Paginated Tasks Due Today list
6. **Add:** Recently Created Restaurants preview with city filter
7. **Modify:** Quick actions - move to top, replace buttons
8. **Fix:** Recent Restaurants and Recent Extractions to work properly

## Testing & Validation Requirements

- **Testing Method:** Combined - Browser verification (Claude in Chrome at localhost:5007) + Build verification
- **Browser Verification Steps:**
  1. Navigate to http://localhost:5007
  2. Verify each component renders correctly
  3. Test interactive elements (tabs, buttons, navigation)
  4. Verify feature flag behavior (components hidden when flag disabled)
- **Build Verification:** TypeScript compilation and lint must pass

## Success Criteria

- [x] Build passes (no TypeScript/lint errors)
- [ ] Stats cards removed from Dashboard
- [ ] Lead Scraping reports properly tabbed with feature flag
- [ ] Pending Leads preview shows 5 most recent leads at step 4 with status "passed"
- [ ] Batch Registration Jobs preview shows most recent job
- [ ] Tasks Due Today list is paginated and works
- [ ] Recently Created Restaurants preview with city filter works
- [ ] Quick Actions moved to top with correct buttons
- [ ] Recent Restaurants preview works consistently
- [ ] Recent Extractions preview works consistently
- [ ] No console errors
- [ ] Feature flags hide components completely when disabled

## Feature Categories

### Functional Features (Core Behavior)
1. Fix Lead Scraping reports tabs and feature flag
2. Pending Leads preview data query
3. Batch Registration Jobs preview data query
4. Tasks Due Today paginated list
5. Recently Created Restaurants with city filter
6. Fix Recent Restaurants data query
7. Fix Recent Extractions data query

### UI Features (Layout/Components)
1. Remove stats cards
2. Move Quick Actions to top
3. Update Quick Action buttons
4. Tab interface for Lead Scraping reports
5. Preview table components for new data

### Integration Features
1. Feature flag wrapping for lead-scraping components
2. Feature flag wrapping for tasks components
3. Feature flag wrapping for registration batches
4. Import and wire up CreateTaskModal on Dashboard

---

## Instructions for Investigation Session

You are executing the investigation phase for a Dashboard Update Ralph Loop. Your goal is to gather detailed implementation context by running parallel subagent investigations.

### Step 1: Spawn Parallel Investigation Subagents

Use the Task tool to spawn **6 general-purpose subagents in parallel**. Each subagent will investigate ONE specific area and create a deliverable markdown document.

**CRITICAL:** Use `subagent_type="general-purpose"` for ALL subagents. Do NOT use "Explore" or "Plan" as they cannot create file deliverables.

Spawn all 6 subagents in a SINGLE message with multiple Task tool calls:

---

## subagent_1_instructions: Dashboard Structure & Current Implementation

**Context:** We need to understand the exact current Dashboard structure to plan modifications.

**Instructions:**
1. Read the full Dashboard.jsx file at `/UberEats-Image-Extractor/src/pages/Dashboard.jsx`
2. Document the complete component structure (imports, state, JSX layout)
3. Identify where each current component is rendered
4. Note the styling patterns and grid layouts used
5. Document any existing API calls or data fetching

**Deliverable:** Create `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_DASHBOARD_STRUCTURE.md` with:
- Complete component hierarchy
- Current imports list
- State management approach
- Grid layout structure
- API integration points

**Report:** Summarize key structural findings for implementation planning.

---

## subagent_2_instructions: Data Queries & API Patterns

**Context:** Several new preview components need data. We need to understand existing query patterns and design new queries.

**Instructions:**
1. Examine existing data fetching in Dashboard.jsx
2. Find how restaurants are queried (for "recently created" component)
3. Find how extractions are queried (for "recent extractions" component)
4. Search for lead scrape queries (for "pending leads" - step 4, status "passed")
5. Search for registration batch queries (for "recent batch jobs")
6. Search for task queries (for "tasks due today")
7. Document React Query patterns used in the codebase

**Deliverable:** Create `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_DATA_QUERIES.md` with:
- Existing query patterns
- Required new queries with SQL/API details
- React Query hook patterns to follow

**Report:** List the specific queries needed for each new component.

---

## subagent_3_instructions: Feature Flag Implementation

**Context:** Multiple components need feature flag wrapping. We need exact implementation patterns.

**Instructions:**
1. Read AuthContext.tsx for feature flag system
2. Search for existing feature flag usage in components (search for `isFeatureEnabled`, `featureFlags`)
3. Document the exact pattern for checking feature flags
4. Identify the feature flag keys needed:
   - Lead scraping flag key
   - Tasks and sequences flag key
   - Registration batches flag key
5. Find where feature flags are defined/configured

**Deliverable:** Create `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_FEATURE_FLAGS.md` with:
- Feature flag hook/context usage pattern
- Code examples of existing feature flag checks
- List of required flag keys with their paths
- Implementation template for Dashboard

**Report:** Provide copy-paste ready code for feature flag integration.

---

## subagent_4_instructions: Task Dialog Component Integration

**Context:** The "New Task" button needs to open the existing CreateTaskModal dialog.

**Instructions:**
1. Read CreateTaskModal.tsx at `/UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx`
2. Document the required props and state management
3. Find how it's currently used elsewhere in the codebase
4. Identify any dependencies (contexts, providers)
5. Determine how to wire it up without a restaurant context (Dashboard level)

**Deliverable:** Create `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_TASK_DIALOG.md` with:
- Component props interface
- Required imports
- Usage example code
- State management needed
- Any caveats for Dashboard-level usage

**Report:** Provide implementation steps for adding task dialog to Dashboard.

---

## subagent_5_instructions: UI Patterns & Reports Components

**Context:** Need to understand tabbing patterns and how to fix the Lead Scraping reports.

**Instructions:**
1. Read the CityBreakdownTab component
2. Search for Tab component usage patterns in the codebase
3. Find how heatmap and table components are structured
4. Document the correct pattern for tabbed sections (not nested in cards)
5. Find examples of proper card usage in other pages

**Deliverable:** Create `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_UI_PATTERNS.md` with:
- Tab component usage examples
- Correct pattern for tabbed reports (not nested in card)
- Card usage patterns from other pages
- Code template for fixing Lead Scraping reports section

**Report:** Provide the correct JSX structure for tabbed reports.

---

## subagent_6_instructions: Preview Table Components

**Context:** Multiple new preview components need consistent table layouts.

**Instructions:**
1. Search for existing preview/recent list components in the codebase
2. Find table patterns used for restaurant lists, extraction lists
3. Document pagination patterns (if any exist for preview tables)
4. Find city filter implementations elsewhere
5. Look at how "View All" links are implemented

**Deliverable:** Create `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_PREVIEW_COMPONENTS.md` with:
- Existing preview list patterns
- Table component usage for lists
- Pagination implementation (or pattern to create)
- Filter component patterns
- View All navigation patterns

**Report:** Provide templates for new preview components.

---

### Step 2: Wait for Subagent Completion

Wait for all 6 subagents to complete their investigations.

### Step 3: Compile Findings

Once all subagents complete:
1. Read all 6 investigation documents from `planning/ralph-loops/dashboard-update-v2/`
2. Compile a summary of key findings
3. Identify any blockers or gaps in information
4. Report findings to the user

### Step 4: Proceed to Ralph Loop Setup

After reporting findings, run `/plan-ralph-loop` to generate the Ralph Loop configuration files from the investigation findings.

---

## Expected Investigation Deliverables

| File | Purpose |
|------|---------|
| `INVESTIGATION_DASHBOARD_STRUCTURE.md` | Current Dashboard component analysis |
| `INVESTIGATION_DATA_QUERIES.md` | Data fetching patterns and required queries |
| `INVESTIGATION_FEATURE_FLAGS.md` | Feature flag implementation patterns |
| `INVESTIGATION_TASK_DIALOG.md` | Task dialog integration details |
| `INVESTIGATION_UI_PATTERNS.md` | Tab and card UI patterns |
| `INVESTIGATION_PREVIEW_COMPONENTS.md` | Preview table component patterns |
