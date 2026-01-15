# Investigation Plan: Dashboard Update for Ralph Loop

## Overview

This investigation gathers all information required to create a Ralph Loop prompt for updating the Dashboard page (`/UberEats-Image-Extractor/src/pages/Dashboard.jsx`) with new report and navigation components.

The goal is to replace the current basic dashboard components with:
1. Lead Scraping reports (heatmap + city breakdown table in tabs)
2. Recent Pending leads preview
3. Recent Batch Registration jobs preview
4. Paginated tasks due today list
5. Recently created restaurants preview with city filter
6. Updated quick action buttons

All wrapped in appropriate feature flags.

## Known Information

**Project Location:** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/`

**Key Files Identified:**
- Dashboard: `src/pages/Dashboard.jsx`
- Lead Scrapes Page: `src/pages/LeadScrapes.tsx`
- Reports Components: `src/components/reports/` (ReportsTabContent, CityBreakdownTab, etc.)
- Pending Leads: `src/components/leads/PendingLeadsTable.tsx`
- Registration Batches: `src/pages/RegistrationBatches.tsx`
- Tasks Page: `src/pages/Tasks.tsx`
- Restaurants: `src/pages/Restaurants.jsx`
- Feature Flags: `src/components/FeatureProtectedRoute.tsx`

**Dev Server:** `localhost:5007`

**Tech Stack:** React (mix of JSX and TSX files)

---

## Instructions for Executing Investigation

Execute the following investigation by spinning up **6 parallel subagents** using the Task tool. Each subagent should:

1. **Only investigate** - do NOT modify any code
2. Create a deliverable markdown file in `.claude/data/ralph-loop-investigations/`
3. Report findings back

After all subagents complete, read all investigation files and compile a summary report for the user.

**Launch all 6 subagents in parallel using a single message with multiple Task tool calls.**

---

## subagent_1_instructions

### Task: Investigate Current Dashboard Structure

**Context:** The current Dashboard at `src/pages/Dashboard.jsx` contains basic components that need to be replaced. We need to understand its structure, imports, and existing patterns.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/pages/Dashboard.jsx` completely
2. Document:
   - All imports used
   - Component structure and layout
   - Any existing hooks or data fetching
   - UI library components used (shadcn/ui, etc.)
   - Current quick action buttons and their navigation targets
   - Any existing feature flag usage
3. Identify which parts to keep vs remove

**Deliverable:** Create `INVESTIGATION_DASHBOARD_STRUCTURE.md` in `.claude/data/ralph-loop-investigations/`

**Report:** Summary of current dashboard architecture and what needs to change

---

## subagent_2_instructions

### Task: Investigate Lead Scraping Reports Components

**Context:** The Lead Scrapes page has report components (heatmap, city breakdown table) that need to be duplicated/reused on the Dashboard.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx`
2. Read all files in `UberEats-Image-Extractor/src/components/reports/`
3. Document:
   - How the tabbed reports section is implemented
   - Props required for ReportsTabContent, CityBreakdownTab, heatmap components
   - Data hooks/queries used for report data
   - Any dependencies or context providers required
4. Determine if components can be imported directly or need abstraction

**Deliverable:** Create `INVESTIGATION_REPORTS_COMPONENTS.md` in `.claude/data/ralph-loop-investigations/`

**Report:** How to integrate the reports components into Dashboard

---

## subagent_3_instructions

### Task: Investigate Feature Flag Implementation

**Context:** Dashboard components need to be wrapped in feature flags (lead-scraping, tasks-sequences, registration-batches).

**Instructions:**
1. Read `UberEats-Image-Extractor/src/components/FeatureProtectedRoute.tsx`
2. Search for feature flag usage patterns across the codebase (grep for "useFeature", "FeatureFlag", "feature_flags")
3. Document:
   - How feature flags are defined and checked
   - The exact flag names for lead scraping, tasks, registration batches
   - Pattern for conditionally rendering components based on flags
   - Any context providers needed
4. Find examples of feature-gated UI sections (not routes)

**Deliverable:** Create `INVESTIGATION_FEATURE_FLAGS.md` in `.claude/data/ralph-loop-investigations/`

**Report:** How to wrap Dashboard sections in feature flags

---

## subagent_4_instructions

### Task: Investigate Data Queries and Hooks

**Context:** Dashboard needs to fetch: pending leads (step 4, status "passed"), recent registration batches, tasks due today, recently created restaurants.

**Instructions:**
1. Search for existing Supabase queries/hooks for:
   - Leads filtering (look in PendingLeadsTable, LeadScrapes)
   - Registration batches (look in RegistrationBatches.tsx)
   - Tasks with due dates (look in Tasks.tsx)
   - Restaurants with recent filter (look in Restaurants.jsx)
2. Check for any existing hooks in `src/hooks/` directory
3. Document:
   - Query patterns used (useQuery, direct Supabase calls, etc.)
   - Table names and column structures
   - Any existing "preview" or "recent" query variants
4. Note any queries that need to be created vs reused

**Deliverable:** Create `INVESTIGATION_DATA_QUERIES.md` in `.claude/data/ralph-loop-investigations/`

**Report:** Available queries and what needs to be created

---

## subagent_5_instructions

### Task: Investigate Tasks Dialog and Navigation

**Context:** Dashboard needs a "New Task" quick action that opens the existing new task dialog, plus updated navigation.

**Instructions:**
1. Read `UberEats-Image-Extractor/src/pages/Tasks.tsx` to find the new task dialog
2. Search for task creation dialog/modal components
3. Document:
   - How the new task dialog is triggered
   - Component name and location
   - Props required to open/control the dialog
   - Any state management needed
4. Check routing in `App.tsx` for /restaurants/new route

**Deliverable:** Create `INVESTIGATION_TASK_DIALOG.md` in `.claude/data/ralph-loop-investigations/`

**Report:** How to wire up new task dialog on Dashboard

---

## subagent_6_instructions

### Task: Investigate UI Component Library and Patterns

**Context:** Need to understand the UI patterns for consistent Dashboard implementation.

**Instructions:**
1. Check `package.json` for UI libraries
2. Look at `src/components/ui/` directory structure
3. Examine existing preview/list components for patterns:
   - Recent extractions list (in current Dashboard)
   - Any card/preview components
   - Table components with filtering
   - Tab components
4. Document:
   - UI library used (shadcn/ui, etc.)
   - Common component patterns
   - Card, Table, Tabs component imports
   - Filter/combobox patterns

**Deliverable:** Create `INVESTIGATION_UI_PATTERNS.md` in `.claude/data/ralph-loop-investigations/`

**Report:** UI components and patterns to use for Dashboard

---

## Post-Investigation Steps

After all subagents complete:

1. Read all 6 investigation files
2. Compile findings into a comprehensive summary
3. Report to user with:
   - Key architectural decisions
   - Any blockers or missing pieces
   - Recommended approach for Ralph Loop prompt
4. Draft the final Ralph Loop prompt based on findings
