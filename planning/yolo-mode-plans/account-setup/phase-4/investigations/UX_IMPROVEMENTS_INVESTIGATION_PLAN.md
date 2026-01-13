# Investigation Plan: Registration Batches & Lead Scrapes UX Improvements

**Date:** 2026-01-11
**Purpose:** Investigate current system state and plan UX improvements for better user navigation and decision-making

---

## Known Information

### Current BatchProgressCard.tsx State
- **Location:** `UberEats-Image-Extractor/src/components/registration-batch/BatchProgressCard.tsx`
- **Displays:** Batch name, status badge, progress bar, step indicators (1-6), action buttons
- **Data type:** `RegistrationBatchJob` from `useRegistrationBatch.ts`
- **Missing:** Restaurant preview (no way to see which restaurants are in a batch without clicking into details)

### Current ScrapeJobProgressCard.tsx State
- **Location:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`
- **Displays:** Job name, status, platform, city, cuisine, leads_limit
- **Missing:** `page_offset` field (exists in `LeadScrapeJob` type at line 19 but not displayed)
- Line 199 shows: `City: {job.city} | Cuisine: {job.cuisine} | Leads Limit: {job.leads_limit}`

### Current LeadScrapes.tsx State
- **Location:** `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx`
- **Has:** Two tabs - "Scrape Jobs" and "Pending Leads"
- **Missing:** "Reports" tab with visualizations

### Database Schema

**lead_scrape_jobs table:**
| Column | Type | Notes |
|--------|------|-------|
| page_offset | integer | Starting page (1-indexed) |
| leads_limit | integer | Number of leads to extract |
| city | text | City name |
| cuisine | text | Cuisine type |

**Page calculation logic:**
- Each UberEats page contains 21 restaurants
- If `page_offset = 1` and `leads_limit = 63`, actual pages scraped are 1, 2, 3
- Formula: `pages_scraped = range(page_offset, page_offset + ceil(leads_limit / 21))`

**registration_batch_jobs → registration_jobs → restaurants relationship:**
- `registration_jobs.batch_job_id` → `registration_batch_jobs.id`
- `registration_jobs.restaurant_id` → `restaurants.id`
- Restaurants table contains: `name`, `city`, `cuisine` fields

---

## Instructions

Execute the following investigation tasks using parallel subagents:

1. **Launch 4 subagents in parallel** using the Task tool with `subagent_type: "Explore"`
2. Each subagent should **only investigate** (no code changes) and create their investigation document
3. After all subagents complete, **read all investigation documents** and synthesize findings
4. **Report findings to the user** with implementation recommendations

---

## subagent_1_instructions

### Context
We need to add a restaurant preview component to BatchProgressCard.tsx showing the first 3-5 restaurants with their name, city, and cuisines.

### Instructions
1. Read and analyze `UberEats-Image-Extractor/src/components/registration-batch/BatchProgressCard.tsx`
2. Read and analyze `UberEats-Image-Extractor/src/hooks/useRegistrationBatch.ts` - focus on:
   - How batch data is fetched
   - What restaurant data is available in the current response
   - The `RegistrationBatchJob` type structure
3. Read and analyze `UberEats-Image-Extractor/src/pages/RegistrationBatches.tsx` to understand:
   - How batches are fetched and passed to cards
   - What API endpoints are used
4. Search for existing restaurant fetch patterns in the codebase
5. Investigate the backend route that serves batch data to determine if restaurant info can be included

### Deliverable
Create `planning/yolo-mode-plans/account-setup/phase-3/investigations/INVESTIGATION_TASK_1_BATCH_RESTAURANT_PREVIEW.md` containing:
- Current data flow from API → hook → component
- Whether restaurant data is currently included in batch fetch
- Recommended approach (include in existing query vs separate fetch)
- Code snippets showing where modifications are needed
- Any performance considerations

### Report
Summarize whether we need backend changes or just frontend changes to show restaurant previews.

---

## subagent_2_instructions

### Context
We need to add page_offset display to ScrapeJobProgressCard.tsx and calculate/display the actual pages scraped.

### Instructions
1. Read and analyze `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`
2. Read and analyze `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts` - focus on:
   - The `LeadScrapeJob` type structure
   - What fields are available
3. Verify the `page_offset` field exists in the data
4. Read `UberEats-Image-Extractor/src/pages/LeadScrapeDetail.tsx` to see how page_offset is currently displayed there
5. Determine the calculation logic for actual pages scraped

### Deliverable
Create `planning/yolo-mode-plans/account-setup/phase-3/investigations/INVESTIGATION_TASK_2_PAGE_OFFSET_DISPLAY.md` containing:
- Current display implementation in ScrapeJobProgressCard
- How LeadScrapeDetail.tsx displays page_offset
- Recommended display format for the card
- Code snippets showing exact insertion points
- Calculation formula for pages scraped display

### Report
Confirm this is a simple frontend-only change and provide the exact code changes needed.

---

## subagent_3_instructions

### Context
We need to add a Reports tab to LeadScrapes.tsx with visualizations showing pages scraped per city per cuisine.

### Instructions
1. Read and analyze `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx` - focus on:
   - Current tab structure
   - How data is fetched for each tab
   - Filter patterns used
2. Read `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts` to understand available queries
3. Search for existing chart/visualization components in the codebase (e.g., recharts, chart.js)
4. Analyze the database schema for lead_scrape_jobs to determine:
   - Whether we need a new `pages_scraped` column
   - Or if we can calculate at query time
5. Search for existing reports/analytics patterns in the codebase

### Deliverable
Create `planning/yolo-mode-plans/account-setup/phase-3/investigations/INVESTIGATION_TASK_3_REPORTS_TAB_DATA.md` containing:
- Current tab implementation pattern
- Existing visualization libraries/components found
- Database approach recommendation:
  - Option A: Add `pages_scraped` array column (pros/cons)
  - Option B: Calculate at query time with SQL (sample query)
  - Option C: Calculate in frontend (pros/cons)
- Data aggregation query needed
- API endpoint design recommendations

### Report
Recommend the best approach for storing/calculating pages scraped data and the aggregation strategy.

---

## subagent_4_instructions

### Context
Design the UI for the Reports tab including the visualization approach for showing scrape coverage.

### Instructions
1. Search for existing visualization components in the project:
   - Look for recharts, chart.js, or similar
   - Check `package.json` for charting dependencies
2. Read existing dashboard/analytics pages for design patterns
3. Analyze what visualizations would best show:
   - Pages scraped per city (heatmap? bar chart?)
   - Pages scraped per cuisine per city (grid? matrix?)
   - Gaps/opportunities (what hasn't been scraped)
4. Review shadcn/ui components available in the project
5. Consider the user flow: viewing reports → deciding next scrape parameters

### Deliverable
Create `planning/yolo-mode-plans/account-setup/phase-3/investigations/INVESTIGATION_TASK_4_REPORTS_TAB_UI.md` containing:
- Available charting/visualization libraries
- Recommended visualization types for the data
- UI layout mockup (text-based)
- Component structure recommendation
- User interaction flow (filtering, drilling down)
- How reports should inform the "New Lead Scrape" form (pre-filling next page to scrape)

### Report
Recommend the visualization approach and component architecture for the Reports tab.

---

## Synthesis

After all subagents complete, the orchestrator should:

1. Read all 4 investigation documents
2. Identify dependencies between the features
3. Prioritize implementation order
4. Create a consolidated implementation plan with:
   - Backend changes needed (if any)
   - Frontend changes needed
   - Database migrations needed (if any)
   - Estimated complexity for each feature
5. Report findings to user with clear next steps
