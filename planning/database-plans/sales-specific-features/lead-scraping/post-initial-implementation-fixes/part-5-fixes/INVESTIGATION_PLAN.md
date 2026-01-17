# Investigation Plan: Remove Step 5 (Contact Enrichment) from Lead Scraping

## Overview

This investigation focuses on removing Step 5 (Contact Enrichment) from the UberEats lead scraping pipeline. The contact information extraction functionality is being moved outside of the leads extraction feature, requiring leads to flow directly from Step 4 (Ordering Platform Discovery) to conversion.

**Date**: 2025-12-15
**Status**: INVESTIGATION PENDING

---

## Known Information

### Current System State

1. **Step Definitions** (`lead-scrape-service.js` lines 12-43):
   - 5 steps defined in `UBEREATS_STEPS` array
   - Step 5: "Contact Enrichment" - finds contact person information
   - Step type: `action_required`

2. **Step 5 Processing** (`lead-scrape-firecrawl-service.js` lines 399-498):
   - `STEP_5_SCHEMA` and `STEP_5_PROMPT` defined
   - `processStep5()` function extracts: `contact_name`, `contact_email`, `contact_phone`, `contact_role`
   - Scrapes website and Facebook for contact details

3. **Job Creation Logic**:
   - `total_steps` is set from `stepDefinitions.length` (currently 5)
   - Steps are created when job starts via `startLeadScrapeJob()`

4. **Lead Progression**:
   - `passLeadsToNextStep()` checks `step.step_number >= total_steps` to determine last step
   - Last step leads get status `passed` (ready for conversion)
   - `getPendingLeads()` uses `current_step >= maxSteps` to find convertible leads

5. **Frontend Types** (`useLeadScrape.ts` lines 89-92):
   - Lead interface includes: `contact_name`, `contact_email`, `contact_phone`, `contact_role`
   - These fields should remain for display but won't be populated by Step 5

### Goal

- Remove Step 5 entirely from the pipeline
- Step 4 becomes the final step
- Leads passed from Step 4 should become "pending" (ready for conversion)
- Existing data integrity must be maintained

---

## Instructions for Next Session

Execute the following investigation by spinning up **5 parallel subagents** using the Task tool. Each subagent should:
1. Investigate only (DO NOT modify any code)
2. Create their investigation document in `planning/database-plans/sales-specific-features/lead-scraping/post-initial-implementation-fixes/part-5-fixes/`
3. Report findings with specific file paths and line numbers

After all subagents complete, read all investigation documents and compile a comprehensive summary for the user.

### Task Tool Invocation Template

```
Use the Task tool with subagent_type="Explore" for each of the 5 investigations below.
Launch ALL 5 subagents IN PARALLEL in a single message.
```

---

## subagent_1_instructions

### Task: Backend Service Layer Investigation

**Context**: The lead scraping backend has two main service files that handle step definitions, processing, and lead progression. We need to identify all locations where Step 5 is referenced or where step count assumptions exist.

**Instructions**:
1. Read `UberEats-Image-Extractor/src/services/lead-scrape-service.js`
2. Read `UberEats-Image-Extractor/src/services/lead-scrape-firecrawl-service.js`
3. Document all locations where:
   - Step 5 is explicitly referenced (by number or name)
   - `total_steps` or step count is used
   - Step number comparisons occur (e.g., `step_number >= total_steps`)
   - `UBEREATS_STEPS` array is defined or used
   - Retry/processor mappings include Step 5

**Deliverable**: `INVESTIGATION_TASK_1_BACKEND_SERVICES.md`

**Report Format**:
```markdown
## Backend Service Layer Findings

### Step 5 References
- [File:Line] Description of reference

### Step Count Logic
- [File:Line] How total_steps is determined
- [File:Line] How last step is identified

### Required Changes
- List of specific changes needed with file:line references
```

---

## subagent_2_instructions

### Task: Database Schema and Migration Investigation

**Context**: Existing jobs and leads in the database have `total_steps = 5` and some leads may be at `current_step = 5`. We need to understand the database impact and migration requirements.

**Instructions**:
1. Read database schema files in `planning/database-plans/sales-specific-features/lead-scraping/database-schemas/`
2. Search for migrations related to lead scraping in `UberEats-Image-Extractor/supabase/migrations/`
3. Examine the leads and lead_scrape_jobs table structures
4. Document:
   - Schema for `lead_scrape_jobs` (especially `total_steps`, `current_step`)
   - Schema for `lead_scrape_job_steps` (especially `step_number`)
   - Schema for `leads` (especially `current_step`, `step_progression_status`)
   - What happens to existing jobs with `total_steps = 5`
   - What happens to leads at `current_step = 5`

**Deliverable**: `INVESTIGATION_TASK_2_DATABASE.md`

**Report Format**:
```markdown
## Database Investigation Findings

### Relevant Tables
- Table name: columns affected

### Existing Data Impact
- Jobs with total_steps = 5: [query to count]
- Leads at current_step = 5: [impact analysis]
- Step records for step_number = 5: [impact analysis]

### Migration Strategy
- Option A: [description]
- Option B: [description]
- Recommended approach with rationale
```

---

## subagent_3_instructions

### Task: API Routes Investigation

**Context**: The lead scraping API routes handle step processing, extraction triggers, and lead progression. We need to identify all endpoints that reference Step 5 or make assumptions about step count.

**Instructions**:
1. Read `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js`
2. Read `UberEats-Image-Extractor/src/routes/leads-routes.js` (if exists)
3. Search for any route handlers that:
   - Trigger step-specific extraction (e.g., `/extract/5`)
   - Validate step numbers
   - Process Step 5 specifically
4. Document the route structure and any hardcoded step assumptions

**Deliverable**: `INVESTIGATION_TASK_3_API_ROUTES.md`

**Report Format**:
```markdown
## API Routes Investigation Findings

### Step Processing Routes
- [Route] [Method] - Description, step assumptions

### Extraction Endpoints
- How step number is validated
- Any hardcoded step limits

### Required Changes
- List of route changes needed
```

---

## subagent_4_instructions

### Task: Frontend Components Investigation

**Context**: Frontend components display steps, calculate progress, and handle lead progression UI. We need to identify all components that reference Step 5 or make assumptions about having 5 steps.

**Instructions**:
1. Read these key files:
   - `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`
   - `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepList.tsx`
   - `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx`
   - `UberEats-Image-Extractor/src/components/leads/LeadDetailModal.tsx`
   - `UberEats-Image-Extractor/src/components/leads/PendingLeadsTable.tsx`
   - `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx`
   - `UberEats-Image-Extractor/src/pages/LeadScrapeDetail.tsx`
2. Search for:
   - Hardcoded references to "5" steps or "Contact Enrichment"
   - Progress calculations based on total_steps
   - Step name/description displays
   - Any UI that specifically shows Step 5 data (contact fields)
3. Document display of contact fields (should remain visible even if not populated by Step 5)

**Deliverable**: `INVESTIGATION_TASK_4_FRONTEND.md`

**Report Format**:
```markdown
## Frontend Components Investigation Findings

### Progress Display
- [Component:Line] How progress is calculated
- [Component:Line] How total steps is used

### Step 5 References
- [Component:Line] Any hardcoded Step 5 references

### Contact Fields Display
- [Component:Line] Where contact fields are shown
- Impact: Should remain visible (populated via other means later)

### Required Changes
- List of frontend changes needed
```

---

## subagent_5_instructions

### Task: Lead Conversion Flow Investigation

**Context**: When leads complete all steps, they become "pending" and can be converted to restaurants. We need to ensure the conversion flow works correctly when Step 4 becomes the final step.

**Instructions**:
1. Read lead conversion logic in:
   - `UberEats-Image-Extractor/src/services/lead-scrape-service.js` (function: `convertLeadsToRestaurants`, `getPendingLeads`)
   - `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js` or `leads-routes.js`
2. Trace the full flow:
   - How leads are marked as "passed" from last step
   - How `getPendingLeads()` identifies convertible leads
   - What data is transferred when converting lead to restaurant
3. Document:
   - Current logic for identifying "pending" leads
   - What happens if `total_steps` changes from 5 to 4
   - Whether conversion includes contact fields (and if so, how they'll be populated now)

**Deliverable**: `INVESTIGATION_TASK_5_CONVERSION_FLOW.md`

**Report Format**:
```markdown
## Lead Conversion Flow Investigation Findings

### Pending Lead Identification
- [File:Line] Query/logic used to find pending leads
- Current criteria: [explain]
- With Step 4 as final: [impact]

### Conversion Process
- [File:Line] How lead data maps to restaurant
- Contact fields: [how they're handled]

### Edge Cases
- Leads at Step 5 when change deploys: [handling strategy]
- Jobs in progress with 5 steps: [handling strategy]

### Required Changes
- List of conversion logic changes needed
```

---

## Post-Investigation Steps

After all 5 subagents complete their investigations:

1. **Read all deliverable files**:
   - `INVESTIGATION_TASK_1_BACKEND_SERVICES.md`
   - `INVESTIGATION_TASK_2_DATABASE.md`
   - `INVESTIGATION_TASK_3_API_ROUTES.md`
   - `INVESTIGATION_TASK_4_FRONTEND.md`
   - `INVESTIGATION_TASK_5_CONVERSION_FLOW.md`

2. **Compile Summary Report** for the user including:
   - Complete list of files requiring modification
   - Database migration requirements
   - Backward compatibility considerations
   - Recommended implementation order
   - Risk assessment

3. **Create Implementation Plan** (`IMPLEMENTATION_PLAN.md`) with:
   - Phase 1: Backend changes
   - Phase 2: Database migration
   - Phase 3: Frontend updates
   - Phase 4: Testing checklist
