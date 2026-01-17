## API Routes Investigation Findings

### Step Processing Routes

**File:** `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js`

#### 1. GET /api/lead-scrape-jobs/:jobId/steps/:stepNumber (Line 300-323)
- **Purpose:** Get a specific step with its leads
- **Step Assumptions:** No upper limit validation; accepts any stepNumber >= 1
- **Issue:** Line 303 only validates `stepNumber < 1`

#### 2. POST /api/lead-scrape-jobs/:jobId/extract/:stepNumber (Line 474-556)
- **Purpose:** Trigger Firecrawl extraction for a specific step
- **Step Assumptions:** HARDCODED to 1-5
- **Validation (Line 477):** `if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 5)`
- **Error Message:** "Invalid step number. Must be 1-5."
- **Switch Cases (Lines 526-542):**
  - Case 1: processStep1()
  - Case 2: processStep2()
  - Case 3: processStep3()
  - Case 4: processStep4()
  - Case 5: processStep5()

#### 3. POST /api/lead-scrape-jobs/:jobId/extract/:stepNumber/sync (Line 566-625)
- **Purpose:** Trigger Firecrawl extraction synchronously
- **Step Assumptions:** HARDCODED to 1-5 (identical to async version)
- **Validation (Line 569):** `if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 5)`

#### 4. POST /api/lead-scrape-job-steps/:stepId/pass-leads (Line 365-430)
- **Purpose:** Pass selected leads to the next step
- **Step Auto-Processing (Lines 399-415):**
  - Switch statement with cases for steps 2, 3, 4, 5
  - **Step 5 Specific (Line 410):** Calls `leadScrapeFirecrawlService.processStep5()`

#### 5. POST /api/lead-scrape-jobs/:jobId/validate-leads (Line 634-702)
- **Purpose:** Validate leads and check for duplicates
- **Validation (Line 638):** `if (!step_number || step_number < 1 || step_number > 5)`

### Extraction Endpoints

- Step validation uses hardcoded `stepNumber > 5` check
- Switch cases explicitly handle steps 1-5
- No dynamic step limit based on job's `total_steps`

### Required Changes

1. **lead-scrape-routes.js:477** - Change `stepNumber > 5` to `stepNumber > 4`
2. **lead-scrape-routes.js:569** - Change `stepNumber > 5` to `stepNumber > 4`
3. **lead-scrape-routes.js:638** - Change `step_number > 5` to `step_number > 4`
4. **lead-scrape-routes.js:526-542** - Remove case 5 from switch statement
5. **lead-scrape-routes.js:593-609** - Remove case 5 from switch statement
6. **lead-scrape-routes.js:399-415** - Remove case 5 from pass-leads switch
