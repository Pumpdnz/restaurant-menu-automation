## Backend Service Layer Findings

### Step 5 References

**lead-scrape-service.js**:
- **Line 38-42**: Step 5 definition in UBEREATS_STEPS array - "Contact Enrichment" step with `step_type: 'action_required'`
- **Line 1002**: `processStep5` referenced in retry processor mapping - maps step 5 to the firecrawl service function

**lead-scrape-firecrawl-service.js**:
- **Line 401-443**: STEP 5 schema and prompt definitions for contact enrichment extraction
- **Line 1332-1498**: `processStep5()` function - main processor for Step 5 (Contact Enrichment)
  - Line 1349: Queries leads at `current_step: 5` with `step_progression_status: 'available'`
  - Line 1459: Counts processed leads at step 5
  - Line 1468: Counts failed leads at step 5
  - Line 1478-1490: Updates step 5 stats, marks as completed if all processed
  - Line 1484: Sets `leads_passed = totalSuccessful` because Step 5 is the final step
  - Line 1486: Sets status to 'completed' (not 'action_required')
  - Line 1491: Updates step with `step_number: 5` filter

### Step Count Logic

**lead-scrape-service.js**:
- **Line 12-43**: UBEREATS_STEPS array with exactly 5 steps
- **Line 63-70**: `getStepDefinitions(platform)` returns UBEREATS_STEPS (length = 5)
- **Line 296**: In `createLeadScrapeJob()` - `total_steps: stepDefinitions.length` (calculates 5 at job creation)
- **Line 314**: Job created with `total_steps: stepDefinitions.length`
- **Line 800-801**: In `passLeadsToNextStep()`:
  - Line 800: `nextStepNumber = step.step_number + 1`
  - Line 801: **CRITICAL** - `isLastStep = step.step_number >= step.lead_scrape_jobs.total_steps`
- **Line 808-809**: Determines lead progression based on isLastStep flag
- **Line 841-873**: Conditionally updates next step only if NOT last step
- **Line 1043**: In `getPendingLeads()` - queries `total_steps` from jobs
- **Line 1056**: Calculates `maxSteps = Math.max(...jobs.map(j => j.total_steps))`
- **Line 1062**: Queries leads with `gte('current_step', maxSteps)` to find completed leads

### Retry/Processor Mappings

**lead-scrape-service.js:998-1003**:
```javascript
const processFn = {
  2: firecrawlService.processStep2,
  3: firecrawlService.processStep3,
  4: firecrawlService.processStep4,
  5: firecrawlService.processStep5,
}[step.step_number];
```

### Required Changes

1. **lead-scrape-service.js:38-42** - Remove Step 5 from UBEREATS_STEPS array
2. **lead-scrape-service.js:1002** - Remove step 5 from processor mapping
3. **lead-scrape-firecrawl-service.js:401-443** - Remove STEP_5_SCHEMA and STEP_5_PROMPT
4. **lead-scrape-firecrawl-service.js:1332-1498** - Remove entire processStep5() function
5. **lead-scrape-firecrawl-service.js:1649** - Remove processStep5 from exports
