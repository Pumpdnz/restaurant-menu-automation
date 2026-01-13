# Investigation Plan: Async Yolo Mode Execution

## Overview

This investigation aims to plan the implementation of asynchronous Yolo Mode execution, allowing the process to continue in the background even after the user closes the dialog or navigates away from the RestaurantDetail page. The solution must be extensible for batch execution of multiple restaurants in the future.

## Current State

### Frontend
- **YoloModeDialog** (`src/components/registration/YoloModeDialog.tsx`) - Modal dialog that displays progress
- **useYoloModeExecution** hook (`src/hooks/useYoloModeExecution.ts`) - Client-side execution orchestration
- **YoloModeProgress** component (`src/components/registration/YoloModeProgress.tsx`) - Progress display with step status
- **RestaurantDetail.jsx** - Has a "Complete Setup" card in the Registration tab that opens the dialog

### Current Flow
1. User opens Yolo Mode dialog
2. Clicks "Execute"
3. Frontend orchestrates all API calls via `useYoloModeExecution` hook
4. Progress is shown in dialog
5. If user closes dialog or navigates away, execution stops (frontend-driven)

### Desired Flow
1. User opens Yolo Mode dialog, reviews settings
2. Clicks "Execute"
3. Dialog closes immediately
4. "Complete Setup" card on RestaurantDetail shows live progress
5. Execution continues server-side even if user navigates away
6. User can return to RestaurantDetail to see current status
7. Future: Batch mode can execute multiple restaurants with a single overview

## Known Information

### Existing Patterns in Codebase
1. **Lead Scrape Jobs** (`lead_scrape_jobs` table) - Database-backed job tracking with steps
2. **ScrapeJobProgressCard** - UI component for displaying job progress with polling
3. **useLeadScrape hook** - React Query-based polling for job status
4. **Backend endpoints** - `/api/lead-scrape/jobs/:id` returns job with steps

### Key Files to Investigate
- `src/hooks/useLeadScrape.ts` - Polling pattern
- `src/components/leads/ScrapeJobProgressCard.tsx` - Progress UI pattern
- `src/routes/lead-scrape-routes.js` - Backend job management
- `src/services/database-service.js` - Database access patterns
- `src/routes/registration-routes.js` - Existing registration endpoints

---

## Instructions

When executing this investigation, use the **Task tool** to spin up **4 parallel subagents** (Explore type) to investigate each task simultaneously. Each subagent should:

1. **Only investigate** - Do NOT modify any code
2. **Create a deliverable document** in `planning/yolo-mode-plans/account-setup/investigations/phase-2/`
3. **Focus on their specific investigation area**
4. **Report findings** that will inform the implementation plan

After all subagents complete, read all deliverable documents and compile a summary report for the user.

---

## subagent_1_instructions

### Task: Database Schema Investigation

**Context:**
We need to understand what database tables exist for tracking jobs and how to create a new `registration_jobs` table to track Yolo Mode execution status.

**Instructions:**
1. Search for existing Supabase migrations in `supabase/migrations/` related to jobs
2. Examine the `lead_scrape_jobs` and `lead_scrape_job_steps` table schemas
3. Look at `registration_logs` table structure
4. Identify what fields would be needed for a `registration_jobs` table
5. Consider how to store step-by-step progress (similar to lead scrape steps)
6. Investigate if there are any existing registration job tables

**Key Questions to Answer:**
- What is the schema for `lead_scrape_jobs` and `lead_scrape_job_steps`?
- What fields from these could be reused for registration jobs?
- What registration-specific fields would be needed?
- How should the steps be structured to match the current execution phases?

**Deliverable:**
Create `INVESTIGATION_TASK_1_DATABASE_SCHEMA.md` with:
- Current job-related table schemas
- Proposed `registration_jobs` table schema
- Proposed `registration_job_steps` table schema
- Migration considerations

---

## subagent_2_instructions

### Task: Backend Job Management Investigation

**Context:**
We need to understand how to implement server-side job execution that continues independently of frontend connections.

**Instructions:**
1. Examine `src/routes/lead-scrape-routes.js` for job start/status/polling patterns
2. Look at how lead scrape jobs execute steps asynchronously on the backend
3. Study `src/services/lead-scrape-service.js` for job execution patterns
4. Identify how the current registration endpoints work (`src/routes/registration-routes.js`)
5. Investigate error handling and retry logic in backend jobs
6. Look for any existing background job processing (Bull, etc.)

**Key Questions to Answer:**
- How does the lead scrape job execution work server-side?
- What triggers step progression?
- How are errors handled and logged?
- What would be needed to convert the current frontend orchestration to backend?
- Is there a job queue system in place?

**Deliverable:**
Create `INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md` with:
- Current backend job patterns
- Proposed registration job execution flow
- Error handling strategy
- Endpoint design for job creation, status, and cancellation

---

## subagent_3_instructions

### Task: Frontend Polling & State Investigation

**Context:**
We need to understand how to implement frontend polling for job status and display progress in the Complete Setup card.

**Instructions:**
1. Examine `src/hooks/useLeadScrape.ts` for polling patterns with React Query
2. Study `src/components/leads/ScrapeJobProgressCard.tsx` for progress UI patterns
3. Look at how RestaurantDetail.jsx currently handles the Yolo Mode state
4. Investigate how to persist execution state across page navigations
5. Study the current `useYoloModeExecution` hook to understand what state needs to be tracked
6. Look at how step status is displayed in ScrapeJobStepList

**Key Questions to Answer:**
- How does React Query polling work for lead scrape jobs?
- What refetch interval is used?
- How can we show progress in the Complete Setup card without opening the dialog?
- How to handle page navigation and return?
- How to reuse the existing YoloModeProgress component?

**Deliverable:**
Create `INVESTIGATION_TASK_3_FRONTEND_POLLING.md` with:
- Current polling patterns
- Proposed hook structure for registration job polling
- UI component modifications needed
- State management strategy for persistent progress

---

## subagent_4_instructions

### Task: Batch Execution Extensibility Investigation

**Context:**
The solution must be extensible for batch execution of multiple restaurants in the future.

**Instructions:**
1. Examine how lead scrape jobs handle multiple leads within a single job
2. Look for any batch processing patterns in the codebase
3. Study the restaurant list views and selection patterns
4. Investigate how a "batch registration job" might be structured
5. Consider UI patterns for batch progress display
6. Look at how the organisation-level job listing works

**Key Questions to Answer:**
- How would a batch registration job differ from single restaurant execution?
- What parent/child job relationships might be needed?
- How to display batch progress vs individual restaurant progress?
- What database schema additions would batch mode need?
- How to handle partial failures in a batch?

**Deliverable:**
Create `INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md` with:
- Proposed batch job structure
- Parent/child job relationships
- UI considerations for batch mode
- Database schema additions for batch support
- Failure handling strategies

---

## After Investigation

Once all subagent investigations are complete:

1. Read all four deliverable documents:
   - `INVESTIGATION_TASK_1_DATABASE_SCHEMA.md`
   - `INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md`
   - `INVESTIGATION_TASK_3_FRONTEND_POLLING.md`
   - `INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md`

2. Compile a comprehensive summary report that:
   - Synthesizes findings from all investigations
   - Identifies dependencies between components
   - Proposes an implementation order
   - Highlights any blockers or concerns discovered
   - Provides a high-level implementation timeline

3. Report findings to the user with:
   - Key architectural decisions needed
   - Recommended approach
   - Next steps for implementation
