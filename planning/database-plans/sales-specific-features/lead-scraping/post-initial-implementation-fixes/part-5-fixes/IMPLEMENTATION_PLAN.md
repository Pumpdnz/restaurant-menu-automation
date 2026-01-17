# Implementation Plan: Remove Step 5 (Contact Enrichment)

**Date**: 2025-12-15
**Status**: ✅ COMPLETE

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Backend Changes | ✅ Complete | Step 5 removed from services |
| Phase 2: API Route Updates | ✅ Complete | Validation and switch statements updated |
| Phase 3: Database Migration | ✅ Complete | Migration applied successfully |
| Phase 4: Frontend Updates | ✅ Complete | Fallback values updated |
| Testing: Lead Conversion | ✅ FIXED | Schema mismatch resolved, new field mappings added |
| Testing: Usage Tracking | ✅ FIXED | Fixed result.results -> result.converted |
| Testing: Opening Hours | ✅ FIXED | Added format conversion for 12h to 24h |

### Lead Conversion Fixes (2025-12-15)

**Fix 1: Schema Mismatch**
The original error (`country column not found`) was caused by a schema mismatch.
- Removed non-existent columns from insert (`region`, `country`, `source`, `google_maps_url`)
- Added proper field mappings (cuisine, URLs, opening hours, etc.)
- Added sales pipeline defaults (lead_type, lead_warmth, icp_rating, etc.)
- Added `address_source` parameter for user to choose which address to use
- See `INVESTIGATION_LEAD_CONVERSION_ERROR.md` for full details

**Fix 2: Usage Tracking Error**
Fixed `Cannot read properties of undefined (reading 'filter')` error in leads-routes.js
- Changed `result.results.filter(r => r.success)` to `result.converted`
- The function returns `{ converted, failed, summary }` not `{ results }`

**Fix 3: Opening Hours Format Conversion**
Lead format uses 12-hour time with periods, restaurant format uses 24-hour nested structure.
- Added `convertTo24Hour()` function to convert "5:00 PM" → "17:00"
- Added `convertOpeningHoursFormat()` function to restructure format
- Merges multiple periods per day (takes earliest open, latest close)
- Orders days correctly (Monday through Sunday)

---

## Summary

This plan removes Step 5 (Contact Enrichment) from the lead scraping pipeline. Step 4 (Ordering Platform Discovery) becomes the final step. Contact enrichment functionality will be moved outside the lead scraping feature.

---

## Files Requiring Modification

### Backend Services
| File | Lines | Change |
|------|-------|--------|
| `lead-scrape-service.js` | 38-42 | Remove Step 5 from UBEREATS_STEPS array |
| `lead-scrape-service.js` | 1002 | Remove step 5 from processor mapping |
| `lead-scrape-firecrawl-service.js` | 401-443 | Remove STEP_5_SCHEMA and STEP_5_PROMPT |
| `lead-scrape-firecrawl-service.js` | 1332-1498 | Remove processStep5() function |
| `lead-scrape-firecrawl-service.js` | 1649 | Remove processStep5 from exports |

### API Routes
| File | Lines | Change |
|------|-------|--------|
| `lead-scrape-routes.js` | 477 | Change `stepNumber > 5` to `stepNumber > 4` |
| `lead-scrape-routes.js` | 569 | Change `stepNumber > 5` to `stepNumber > 4` |
| `lead-scrape-routes.js` | 638 | Change `step_number > 5` to `step_number > 4` |
| `lead-scrape-routes.js` | 526-542 | Remove case 5 from switch statement |
| `lead-scrape-routes.js` | 593-609 | Remove case 5 from switch statement |
| `lead-scrape-routes.js` | 399-415 | Remove case 5 from pass-leads switch |

### Frontend Components
| File | Lines | Change |
|------|-------|--------|
| `ScrapeJobProgressCard.tsx` | 178 | Change fallback from 5 to 4 |
| `LeadScrapeDetail.tsx` | 340 | Change fallback from 5 to 4 |

---

## Phase 1: Backend Changes

### 1.1 Update Step Definitions
**File:** `UberEats-Image-Extractor/src/services/lead-scrape-service.js`

Remove Step 5 from UBEREATS_STEPS array (lines 38-42):
```javascript
// REMOVE:
{
  step_number: 5,
  step_name: 'Contact Enrichment',
  step_description: 'Find contact person information',
  step_type: 'action_required'
}
```

### 1.2 Update Retry Processor Mapping
**File:** `UberEats-Image-Extractor/src/services/lead-scrape-service.js`

Remove step 5 from processor mapping (line 1002):
```javascript
// CHANGE FROM:
const processFn = {
  2: firecrawlService.processStep2,
  3: firecrawlService.processStep3,
  4: firecrawlService.processStep4,
  5: firecrawlService.processStep5,
}[step.step_number];

// CHANGE TO:
const processFn = {
  2: firecrawlService.processStep2,
  3: firecrawlService.processStep3,
  4: firecrawlService.processStep4,
}[step.step_number];
```

### 1.3 Remove Step 5 Processing Logic
**File:** `UberEats-Image-Extractor/src/services/lead-scrape-firecrawl-service.js`

1. Remove STEP_5_SCHEMA (lines 401-420)
2. Remove STEP_5_PROMPT (lines 421-443)
3. Remove processStep5() function (lines 1332-1498)
4. Remove processStep5 from exports (line 1649)

---

## Phase 2: API Route Updates

### 2.1 Update Step Validation
**File:** `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js`

Update all step number validations from `> 5` to `> 4`:

**Line 477** (async extraction):
```javascript
if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 4)
```

**Line 569** (sync extraction):
```javascript
if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 4)
```

**Line 638** (validate-leads):
```javascript
if (!step_number || step_number < 1 || step_number > 4)
```

### 2.2 Remove Step 5 from Switch Statements

**Lines 526-542** (async extraction switch):
```javascript
// REMOVE case 5
```

**Lines 593-609** (sync extraction switch):
```javascript
// REMOVE case 5
```

**Lines 399-415** (pass-leads switch):
```javascript
// REMOVE case 5
```

---

## Phase 3: Database Migration

### 3.1 Migration Script
Create migration file: `remove_step_5_contact_enrichment.sql`

```sql
-- Migration: Remove Step 5 (Contact Enrichment) from lead scraping pipeline

-- 1. Update total_steps for all jobs with 5 steps
UPDATE lead_scrape_jobs
SET total_steps = 4
WHERE total_steps = 5;

-- 2. Move Step 5 leads to Step 4 as passed (ready for conversion)
UPDATE leads
SET current_step = 4,
    step_progression_status = 'passed'
WHERE current_step = 5;

-- 3. Delete all Step 5 records from job steps
DELETE FROM lead_scrape_job_steps
WHERE step_number = 5;
```

### 3.2 Pre-Migration Validation Query
```sql
SELECT
  'Jobs with total_steps=5' as metric, COUNT(*) as count
FROM lead_scrape_jobs WHERE total_steps = 5
UNION ALL
SELECT 'Leads at step=5', COUNT(*)
FROM leads WHERE current_step = 5
UNION ALL
SELECT 'Step 5 records', COUNT(*)
FROM lead_scrape_job_steps WHERE step_number = 5;
```

---

## Phase 4: Frontend Updates

### 4.1 Update Progress Display Fallbacks
**File:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`

**Line 178:**
```typescript
// CHANGE FROM:
${job.total_steps || 5}

// CHANGE TO:
${job.total_steps || 4}
```

**File:** `UberEats-Image-Extractor/src/pages/LeadScrapeDetail.tsx`

**Line 340:**
```typescript
// CHANGE FROM:
${job.total_steps || 5}

// CHANGE TO:
${job.total_steps || 4}
```

---

## Deployment Order

1. **Deploy backend changes** (Phase 1 + Phase 2)
   - Code handles 4-step workflow
   - Old jobs with 5 steps continue to work (step count check uses database value)

2. **Run database migration** (Phase 3)
   - Update all jobs to 4 steps
   - Migrate Step 5 leads to Step 4
   - Delete Step 5 records

3. **Deploy frontend changes** (Phase 4)
   - Update fallback values

---

## Testing Checklist

### Backend Tests
- [ ] New job created with `total_steps = 4`
- [ ] Job creates only 4 step records (not 5)
- [ ] Step 4 leads marked as "passed" become pending for conversion
- [ ] Extract endpoint rejects stepNumber > 4
- [ ] Retry failed leads works for steps 1-4

### Database Tests
- [ ] No jobs remain with `total_steps = 5`
- [ ] No leads remain at `current_step = 5`
- [ ] No step records remain with `step_number = 5`

### Frontend Tests
- [ ] Progress shows "Step X of 4"
- [ ] Step list shows 4 steps (not 5)
- [ ] Contact fields remain visible and editable
- [ ] Leads can be converted to restaurants

### End-to-End Tests
- [ ] Create new lead scrape job - completes at Step 4
- [ ] Pass leads through all 4 steps
- [ ] Convert pending leads to restaurants
- [ ] Verify contact fields can be manually populated

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Leads stuck at Step 5 | Low | Medium | Migration moves to Step 4 |
| Jobs in progress fail | Low | Low | Code checks database total_steps |
| Contact data loss | None | N/A | Contact fields remain, just unpopulated |
| Frontend display issues | Low | Low | Only fallback values affected |

---

## Rollback Plan

If issues occur:

1. **Backend rollback**: Redeploy previous version (Step 5 code restored)
2. **Database rollback** (if needed):
   ```sql
   -- Restore Step 5 for jobs (requires tracking which were changed)
   -- Note: Step 5 records cannot be restored after deletion
   -- Recommendation: Take backup before migration
   ```
3. **Frontend rollback**: Redeploy previous version

**Recommendation**: Take database backup before running migration.

---

## Notes

- Contact fields (`contact_name`, `contact_email`, `contact_phone`, `contact_role`) remain in the leads table
- Contact fields can be populated manually via LeadDetailModal
- Future: Contact enrichment will be implemented as a separate feature outside lead scraping
