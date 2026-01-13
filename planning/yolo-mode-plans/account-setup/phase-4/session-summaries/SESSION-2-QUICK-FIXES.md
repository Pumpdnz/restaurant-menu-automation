# Session 2: Card UX Improvements

**Date:** 2026-01-12
**Duration:** ~45 minutes
**Status:** Complete

---

## Overview

Implemented UX improvements for ScrapeJobProgressCard and BatchProgressCard to provide better visibility into lead processing status and restaurant information.

---

## Features Implemented

### Feature 1: Lead Stats Display in ScrapeJobProgressCard

**Purpose:** Show users the actual number of leads extracted and their processing status at a glance.

**Files Modified:**

| File | Changes |
|------|---------|
| `src/services/lead-scrape-service.js` | Added `getLeadStatsForJob()` and `getLeadStatsForJobs()` functions |
| `src/services/lead-scrape-service.js` | Modified `getLeadScrapeJob()` to include lead_stats |
| `src/services/lead-scrape-service.js` | Modified `listLeadScrapeJobs()` to include lead_stats for all jobs |
| `src/hooks/useLeadScrape.ts` | Added `lead_stats` type to `LeadScrapeJob` interface |
| `src/components/leads/ScrapeJobProgressCard.tsx` | Display "Extracted" count and status totals row |

**Backend Functions Added:**

```javascript
// Single job stats
async function getLeadStatsForJob(jobId) {
  // Returns: { total_extracted, unprocessed, processed, pending, converted }
}

// Batch stats (efficient single query for list view)
async function getLeadStatsForJobs(jobIds) {
  // Returns: { [jobId]: stats, ... }
}
```

**Type Addition:**
```typescript
lead_stats?: {
  total_extracted: number;
  unprocessed: number;
  processed: number;
  pending: number;
  converted: number;
};
```

**Status Definitions:**

| Status | Definition |
|--------|------------|
| **Extracted** | Total leads saved after dedup/exclusion |
| **Unprocessed** | Leads that failed/stuck before completing pipeline |
| **Processed** | Leads that passed step 4 (Pending + Converted) |
| **Pending** | Passed step 4 but awaiting conversion to restaurant |
| **Converted** | Successfully converted to restaurants |

**Visual Result (Card):**
```
City: Wellington | Cuisine: pollo | Leads Limit: 21 | Page Offset: 1 | Extracted: 12
Unprocessed: 4 | Processed: 8 | Pending: 4 | Converted: 4
```

---

### Feature 2: Lead Stats in LeadScrapeDetail Page

**Purpose:** Show comprehensive lead statistics on the job detail page's Extraction Progress card.

**File Modified:**
- `src/pages/LeadScrapeDetail.tsx`

**Changes:**
- Added second stats row showing conversion status
- Grid layout: 3 columns (Extracted/Passed/Failed) + 4 columns (Unprocessed/Processed/Pending/Converted)

**Visual Result:**
```
┌────────────────────────────────────────────────┐
│ Extraction Progress                            │
├────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │    12    │  │    10    │  │    0     │     │
│  │Extracted │  │  Passed  │  │  Failed  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │   4    │ │   8    │ │   4    │ │   4    │  │
│  │Unproc. │ │Process.│ │Pending │ │Convert.│  │
│  └────────┘ └────────┘ └────────┘ └────────┘  │
└────────────────────────────────────────────────┘
```

---

### Feature 3: Clickable Restaurants in BatchProgressCard

**Purpose:** Allow users to quickly navigate to restaurant detail pages from the batch card.

**Files Modified:**

| File | Changes |
|------|---------|
| `src/components/registration-batch/BatchProgressCard.tsx` | Changed `<div>` to `<a>` with href and target="_blank" |
| `src/pages/RegistrationBatches.tsx` | Same changes to inline BatchProgressCard |

**Key Implementation Details:**
- Restaurant names link to `/restaurants/{restaurant_id}`
- Opens in new tab (`target="_blank"`)
- `e.stopPropagation()` prevents card click interference
- Hover effects show underline and color change

---

### Feature 4: Expandable Restaurant List in BatchProgressCard

**Purpose:** Allow users to see all restaurants in a batch without navigating to details.

**Files Modified:**

| File | Changes |
|------|---------|
| `src/components/registration-batch/BatchProgressCard.tsx` | Added `useState` for expansion, updated slice logic |
| `src/pages/RegistrationBatches.tsx` | Same changes to inline BatchProgressCard |

**Key Implementation Details:**
- Initially shows first 4 restaurants
- "+N more" button expands to show all
- "Show less" collapses back to 4
- State managed per-card with `useState`

**Visual Result:**
```
Collapsed:
[🏪 Devil Burger] [🏪 Soul Shack] [🏪 Beach Pizza] [🏪 Burger Fuel] [+3 more]

Expanded:
[🏪 Devil Burger] [🏪 Soul Shack] [🏪 Beach Pizza] [🏪 Burger Fuel]
[🏪 Wendy's] [🏪 KFC] [🏪 McDonald's] [Show less]
```

---

## Technical Notes

### Efficient Batch Stats Query

To avoid N+1 query problem when listing jobs, implemented `getLeadStatsForJobs()` that:
1. Fetches all leads for all job IDs in a single query
2. Aggregates stats in memory
3. Returns a map of jobId → stats

```javascript
const { data } = await client
  .from('leads')
  .select('lead_scrape_job_id, current_step, step_progression_status, converted_to_restaurant_id')
  .in('lead_scrape_job_id', jobIds);
```

### Duplicate Component Pattern

`RegistrationBatches.tsx` contains an inline `BatchProgressCard` function that duplicates the component in the components directory. Both needed to be updated for the expandable/clickable features.

**Recommendation:** Consider refactoring to use a single shared component.

---

## Files Changed Summary

| File | Type | Description |
|------|------|-------------|
| `src/services/lead-scrape-service.js` | Backend | Added stats functions, modified list/get to include stats |
| `src/hooks/useLeadScrape.ts` | Types | Added lead_stats interface |
| `src/components/leads/ScrapeJobProgressCard.tsx` | Frontend | Display extracted count + status totals |
| `src/pages/LeadScrapeDetail.tsx` | Frontend | Added conversion status grid to progress card |
| `src/components/registration-batch/BatchProgressCard.tsx` | Frontend | Clickable restaurants + expandable list |
| `src/pages/RegistrationBatches.tsx` | Frontend | Same updates to inline component |

---

## Testing Checklist

### ScrapeJobProgressCard (List View)
- [x] "Extracted: N" displays correctly
- [x] Status totals row appears with colored text
- [x] Stats update when navigating between pages

### LeadScrapeDetail Page
- [x] Extraction Progress card shows both stat rows
- [x] Colors match status meanings
- [x] Stats refresh on page reload

### BatchProgressCard
- [x] Restaurant names are clickable
- [x] Links open in new tab
- [x] Card click still navigates to batch detail
- [x] "+N more" expands the list
- [x] "Show less" collapses the list
- [x] Works in both component and inline versions

---

## Summary

| Feature | Complexity | Status |
|---------|------------|--------|
| Lead stats in ScrapeJobProgressCard | Medium | Complete |
| Lead stats in LeadScrapeDetail | Low | Complete |
| Clickable restaurants | Low | Complete |
| Expandable restaurant list | Low | Complete |

**Total Implementation Time:** ~45 minutes
