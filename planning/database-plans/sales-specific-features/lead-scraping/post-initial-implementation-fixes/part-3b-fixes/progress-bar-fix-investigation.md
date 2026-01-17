# Investigation: Progress Bar Always Shows 0%

## Status: FIXED

**Fixed on:** 2025-12-08

## Issue Summary

The "Extraction Progress" section on the LeadScrapeDetail page and ScrapeJobProgressCard component always displayed 0% complete, even when steps had been completed and leads had been passed.

## Root Cause

**Job-level fields (`leads_extracted`, `leads_passed`, `leads_failed`) were NEVER updated in the backend.**

The `calculateProgress` function used job-level fields:

```javascript
// OLD - BROKEN
function calculateProgress(job: any): number {
  if (job.leads_limit === 0) return 0;
  const totalLeads = job.leads_extracted > 0 ? job.leads_extracted : job.leads_limit;
  return Math.round((job.leads_passed / totalLeads) * 100);
}
```

But in `lead-scrape-service.js`, only **step-level** fields were updated:

| Event | Step-Level Update | Job-Level Update |
|-------|------------------|------------------|
| Leads extracted (step 1) | `step.leads_processed` ✅ | `job.leads_extracted` ❌ |
| Leads passed to next step | `step.leads_passed` ✅ | `job.leads_passed` ❌ |
| Leads failed | `step.leads_failed` ✅ | `job.leads_failed` ❌ |

## Solution Implemented

Frontend calculation from step data (no backend changes required).

### Files Modified

1. **[LeadScrapeDetail.tsx](../../../../../../UberEats-Image-Extractor/src/pages/LeadScrapeDetail.tsx)**
2. **[ScrapeJobProgressCard.tsx](../../../../../../UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx)**

### Implementation

Added two helper functions to both files:

```typescript
// Calculate aggregate stats from step data (job-level fields are not updated by backend)
function calculateJobStats(job: any): { leads_extracted: number; leads_passed: number; leads_failed: number } {
  const steps = job.steps || [];

  // leads_extracted = Step 1's leads_processed (initial extraction count)
  const step1 = steps.find((s: any) => s.step_number === 1);
  const leads_extracted = step1?.leads_processed || 0;

  // leads_passed = Step 1's leads_passed (leads that passed initial quality checks)
  const leads_passed = step1?.leads_passed || 0;

  // leads_failed = Sum of leads_failed across all steps
  const leads_failed = steps.reduce((sum: number, s: any) => sum + (s.leads_failed || 0), 0);

  return { leads_extracted, leads_passed, leads_failed };
}

// Calculate progress percentage from step data
function calculateProgress(job: any): number {
  if (!job.steps || job.steps.length === 0) return 0;
  if (job.total_steps === 0) return 0;

  // Use step completion as the primary progress indicator
  const completedSteps = job.steps.filter((s: any) => s.status === 'completed').length;
  return Math.round((completedSteps / job.total_steps) * 100);
}
```

### UI Updates

Updated JSX to use `stats` instead of `job.leads_*`:

```tsx
const stats = calculateJobStats(job);
const progress = calculateProgress(job);

// Progress text
{stats.leads_passed} of {stats.leads_extracted > 0 ? stats.leads_extracted : job.leads_limit} leads passed

// Stats cards
{stats.leads_extracted}  // Extracted
{stats.leads_passed}     // Passed
{stats.leads_failed}     // Failed
```

## Testing Results

- [x] Draft job shows 0% progress
- [x] Job with Step 1 completed shows accurate extraction count
- [x] Progress increases as steps complete (20% per step for 5-step jobs)
- [x] Passed count shows step1.leads_passed correctly
- [x] Failed leads count aggregates correctly across steps
- [x] Stats cards display correct values
- [x] ScrapeJobProgressCard on main page works correctly

## Notes

- The fix uses step-based progress (completed_steps / total_steps) rather than lead-based progress
- "Passed" shows leads that passed Step 1 quality checks, not leads that completed the entire pipeline
- If backend consistency is needed later (for reports, exports), job-level fields can be updated in `passLeadsToNextStep()`
