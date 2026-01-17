# Issue 1: Step 2 Displaying as "Automatic" Instead of "Action Required"

## Status: RESOLVED

## Problem Description
Step 2 (Store Page Enrichment) was displaying as "automatic" in the UI, but the workflow logic had been modified to require manual action between steps 1 and 2. Users needed to select which leads to pass to step 2 before triggering extraction.

## Root Cause
The `UBEREATS_STEPS` constant in `lead-scrape-service.js` still defined step 2 with `step_type: 'automatic'`:

```javascript
// BEFORE (line 19-24)
{
  step_number: 2,
  step_name: 'Store Page Enrichment',
  step_description: 'Batch scrape individual store pages for details',
  step_type: 'automatic'  // <-- INCORRECT
}
```

This constant is used when creating job steps via `startLeadScrapeJob()`, which inserts the step definitions into the `lead_scrape_job_steps` table.

## Fix Applied

### 1. Updated Step Definition Constant
**File:** `UberEats-Image-Extractor/src/services/lead-scrape-service.js`
**Line:** 23

```javascript
// AFTER
{
  step_number: 2,
  step_name: 'Store Page Enrichment',
  step_description: 'Batch scrape individual store pages for details',
  step_type: 'action_required'  // <-- FIXED
}
```

### 2. Updated Existing Database Records
Executed SQL to update all existing step 2 records:

```sql
UPDATE lead_scrape_job_steps
SET step_type = 'action_required', updated_at = NOW()
WHERE step_number = 2 AND step_type = 'automatic';
```

**Records Updated:** 4 step records across 4 jobs
- Job `772026d9-c6ef-4ed4-9cf4-a5c92180ea04`
- Job `edbb97bf-404e-4381-8bd1-29e06b08360b`
- Job `6412657f-fbf4-468d-ad5e-0ed6b15b5221`
- Job `8243d3d8-6ae7-496a-977b-dd5f3aa1ebcc`

## Verification

### Code Verification
- Confirmed `UBEREATS_STEPS[1].step_type` now equals `'action_required'`

### Database Verification
```sql
SELECT COUNT(*) FROM lead_scrape_job_steps
WHERE step_number = 2 AND step_type = 'automatic';
-- Result: 0 (no remaining records with 'automatic')
```

### UI Verification
- Step 2 now displays "Action Required" badge in ScrapeJobStepList
- New jobs will create step 2 with correct `step_type`

## Impact
- **New Jobs:** Step 2 will be created with `step_type: 'action_required'`
- **Existing Jobs:** All 4 affected jobs now have correct step type
- **Workflow:** Users must now manually select and pass leads from step 1 to step 2 before triggering extraction

## Related Files
| File | Change |
|------|--------|
| `UberEats-Image-Extractor/src/services/lead-scrape-service.js` | Updated `UBEREATS_STEPS` constant |
| Database: `lead_scrape_job_steps` | Updated 4 existing records |

## Date Completed
2025-12-07
