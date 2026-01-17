# Lead Scraping Fixes Part 1 - Overview

## Document Purpose

This document outlines the three issues discovered during testing of the lead scraping feature (phases 1-9 completed) and provides the investigation scope for each. Each issue should be investigated and fixed independently in parallel.

## Current State

- **Phases Completed**: 1-9
- **Status**: Testing phase
- **Date**: 2025-12-06

---

## Issue 1: Step 2 Shows "Automatic" Instead of "Manual"

### Problem Description
Step 2 still displays as "automatic" on the frontend, but the logic was modified to require manual action between steps 1 and 2.

### Affected Components
- `lead-scrape-service.js` - `UBEREATS_STEPS` constant (lines 11-43)
- `ScrapeJobStepList.tsx` - Step type badge display
- Database: `lead_scrape_job_steps` table - `step_type` column

### Root Cause Analysis
The `UBEREATS_STEPS` array in `lead-scrape-service.js` (line 19-23) still defines Step 2 as:
```javascript
{
  step_number: 2,
  step_name: 'Store Page Enrichment',
  step_description: 'Batch scrape individual store pages for details',
  step_type: 'automatic'  // <-- Should be 'action_required'
}
```

### Investigation Scope
1. Update `UBEREATS_STEPS` to set step 2 `step_type` to `'action_required'`
2. Check if existing jobs in the database have step 2 with `step_type = 'automatic'` that need migration
3. Verify the UI correctly displays the step type badge from the database value

### Files to Modify
- `UberEats-Image-Extractor/src/services/lead-scrape-service.js`
- Potentially: Database migration to update existing step records

---

## Issue 2: Lead Selection Not Working When Passing Between Steps 1 and 2

### Problem Description
Selecting specific leads to pass between step 1 and step 2 is not working - it passes ALL leads instead of only the selected ones. However, selecting leads for processing in step 2 works correctly (18 of 20 selected leads were processed successfully).

### Affected Components
- API endpoint: `POST /lead-scrape-jobs/steps/:stepId/pass-leads`
- `lead-scrape-service.js` - `passLeadsToNextStep()` function (lines 775-869)
- `lead-scrape-routes.js` - Route handler for pass-leads endpoint
- Frontend: `ScrapeJobStepDetailModal.tsx` and `LeadPreview.tsx` - Selection state management

### Root Cause Analysis (Suspected)
The `passLeadsToNextStep` function appears correct - it filters by the provided `leadIds`:
```javascript
// Line 812-822 in lead-scrape-service.js
const { data: updatedLeads, error: leadsError } = await client
  .from('leads')
  .update({ ... })
  .in('id', leadIds)  // <-- Filters by provided IDs
  .eq('lead_scrape_job_id', step.job_id)
  .eq('current_step', step.step_number)
  .select();
```

Possible causes:
1. The API route handler may not be passing the `leadIds` correctly to the service
2. There may be automatic step progression logic that runs after step 1 completes, passing all leads regardless of selection
3. The frontend may not be sending the correct selection state

### Investigation Scope
1. Read `lead-scrape-routes.js` to verify the pass-leads endpoint correctly extracts `lead_ids` from request body
2. Check if there's automatic progression logic that triggers when step 1 completes
3. Verify the frontend correctly sends the selected lead IDs in the API request
4. Add logging to trace the lead IDs through the entire flow

### Files to Review/Modify
- `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js`
- `UberEats-Image-Extractor/src/services/lead-scrape-service.js` - Look for automatic progression logic
- `UberEats-Image-Extractor/src/services/lead-scrape-firecrawl-service.js` - Check if step completion triggers auto-pass

---

## Issue 3: Step 2 Enriched Fields Not Displaying in UI

### Problem Description
After successful Step 2 enrichment (confirmed in database), the enriched fields are not displaying in the UI components:
- `ScrapeJobStepDetailModal.tsx`
- `LeadPreview.tsx`
- `LeadDetailModal.tsx`

### Step 2 Enriched Fields (Database Column Names)
| Database Column | Type | Description |
|-----------------|------|-------------|
| `ubereats_number_of_reviews` | text | Review count (e.g., "500+") |
| `ubereats_average_review_rating` | numeric(3,1) | Rating out of 5.0 |
| `ubereats_address` | text | Full street address |
| `ubereats_cuisine` | text[] | Array of cuisine types |
| `ubereats_price_rating` | int4 | Price rating (1-4) |

### Display Requirements
| Component | Fields to Display |
|-----------|-------------------|
| `ScrapeJobStepDetailModal.tsx` | reviews, rating, cuisine, price_rating (NOT address) |
| `LeadPreview.tsx` | reviews, rating, cuisine, price_rating (NOT address) |
| `LeadDetailModal.tsx` | ALL fields including address |

### Root Cause Analysis
**Field name mismatch between database and TypeScript interface:**

The `Lead` interface in `useLeadScrape.ts` (lines 58-95) uses:
```typescript
number_of_reviews: number | null;      // Database: ubereats_number_of_reviews
average_review_rating: number | null;   // Database: ubereats_average_review_rating
address: string | null;                 // Database: ubereats_address
cuisine: string[];                      // Database: ubereats_cuisine
price_range: string | null;             // Database: ubereats_price_rating
```

The UI components reference the TypeScript interface field names, but the database stores them with `ubereats_` prefix. Either:
1. The API layer needs to map database fields to the expected interface names, OR
2. The TypeScript interface and UI components need to use the actual database field names

### Investigation Scope
1. Check how leads are fetched from the API (`/leads/:id` and step leads endpoints)
2. Determine if the API already maps the fields or returns raw database column names
3. Update either the API response mapping OR the TypeScript interface and UI components
4. Test that all three components correctly display the enriched data

### Files to Review/Modify
- `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts` - `Lead` interface definition
- `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx` - Field references
- `UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx` - Field references
- `UberEats-Image-Extractor/src/components/leads/LeadDetailModal.tsx` - Field references
- `UberEats-Image-Extractor/src/services/lead-scrape-service.js` - `getJobStep()` and `getLead()` functions
- `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js` - Response formatting

### Current UI Component References (Need Verification)
**ScrapeJobStepDetailModal.tsx (lines 509-520):**
```tsx
{lead.average_review_rating ? (
  <div className="flex items-center gap-1 text-sm">
    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
    {lead.average_review_rating.toFixed(1)}
    {lead.number_of_reviews && (
      <span className="text-xs text-muted-foreground">
        ({lead.number_of_reviews})
      </span>
    )}
  </div>
) : (
  <span className="text-muted-foreground text-xs">-</span>
)}
```

**LeadPreview.tsx (lines 319-324):**
```tsx
{lead.average_review_rating && (
  <span className="flex items-center gap-0.5">
    <Star className="h-3 w-3 text-yellow-500" />
    {lead.average_review_rating.toFixed(1)}
    {lead.number_of_reviews && ` (${lead.number_of_reviews})`}
  </span>
)}
```

---

## Fix Prioritization

| Issue | Priority | Complexity | Dependencies |
|-------|----------|------------|--------------|
| Issue 3: Field Display | High | Medium | None |
| Issue 2: Selection Logic | High | Medium | May depend on Issue 1 |
| Issue 1: Step Type | Medium | Low | None |

### Recommended Fix Order
1. **Issue 3** (Field Display) - Most straightforward, no dependencies
2. **Issue 1** (Step Type) - Quick fix, may affect Issue 2
3. **Issue 2** (Selection Logic) - May be partially resolved by Issue 1

---

## Testing Checklist

### Issue 1 Verification
- [ ] Step 2 displays "Action Required" badge in ScrapeJobStepList
- [ ] New jobs create step 2 with `step_type = 'action_required'`
- [ ] Existing jobs updated (if migration applied)

### Issue 2 Verification
- [ ] Create new job and run step 1
- [ ] Select subset of leads (e.g., 5 of 20)
- [ ] Pass selected leads to step 2
- [ ] Verify only selected 5 leads are at step 2
- [ ] Verify remaining 15 leads still at step 1

### Issue 3 Verification
- [ ] After step 2 enrichment, open ScrapeJobStepDetailModal
- [ ] Verify reviews, rating, cuisine, price_rating display
- [ ] Hover over leads column to open LeadPreview
- [ ] Verify reviews, rating, cuisine, price_rating display
- [ ] Click lead to open LeadDetailModal
- [ ] Verify ALL fields including address display
