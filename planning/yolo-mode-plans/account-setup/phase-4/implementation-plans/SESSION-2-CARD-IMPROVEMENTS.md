# Implementation Plan: Session 2 - Card UX Improvements

**Date:** 2026-01-12
**Status:** Ready for Implementation
**Estimated Time:** 1-2 hours

---

## Overview

This plan covers four improvements across two components:

| Component | Improvement | Complexity |
|-----------|-------------|------------|
| ScrapeJobProgressCard | Add "Leads Extracted" count | Low |
| ScrapeJobProgressCard | Add lead status totals (Unprocessed/Processed/Pending/Converted) | Medium |
| BatchProgressCard | Make restaurant names clickable | Low |
| BatchProgressCard | Make "+N more" expandable/collapsible | Low |

---

## Part 1: ScrapeJobProgressCard Improvements

### 1.1 Add "Leads Extracted" Count

**Current State:**
```
City: Wellington | Cuisine: pollo | Leads Limit: 21 | Page Offset: 1
```

**Target State:**
```
City: Wellington | Cuisine: pollo | Leads Limit: 21 | Page Offset: 1 | Leads Extracted: 12
```

**Implementation:**

The `calculateJobStats` function at line 53 of `ScrapeJobProgressCard.tsx` already calculates `leads_extracted` from Step 1's `leads_processed`. This data is available but not displayed.

**File:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`

**Change (line 199):**
```tsx
// Current
City: {job.city} | Cuisine: {job.cuisine} | Leads Limit: {job.leads_limit} | Page Offset: {job.page_offset || 1}

// Updated
City: {job.city} | Cuisine: {job.cuisine} | Leads Limit: {job.leads_limit} | Page Offset: {job.page_offset || 1} | Extracted: {stats.leads_extracted}
```

**Note:** The `stats` variable is already calculated at line 118 using `calculateJobStats(job)`.

**Effort:** ~5 minutes

---

### 1.2 Add Lead Status Totals

**Target State:**
```
City: Wellington | Cuisine: pollo | Leads Limit: 21 | Page Offset: 1 | Extracted: 12
Unprocessed: 4 | Processed: 8 | Pending: 4 | Converted: 4
```

**Status Definitions:**

| Status | Definition | SQL Condition |
|--------|------------|---------------|
| **Extracted** | Total leads saved after dedup/exclusion | `COUNT(*)` |
| **Unprocessed** | Leads that failed/stuck at any step | `current_step < 4 OR (current_step = 4 AND step_progression_status != 'passed')` |
| **Processed** | Leads that passed step 4 (completed pipeline) | `current_step = 4 AND step_progression_status = 'passed'` |
| **Pending** | Passed step 4 but not converted | `current_step = 4 AND step_progression_status = 'passed' AND converted_to_restaurant_id IS NULL` |
| **Converted** | Converted to restaurants | `converted_to_restaurant_id IS NOT NULL` |

**Relationship:** `Processed = Pending + Converted`

**Implementation Steps:**

#### Step 1: Backend - Add lead stats to job response

**File:** `UberEats-Image-Extractor/src/services/lead-scrape-service.js`

**Add new function after `getLeadScrapeJob` (~line 214):**

```javascript
/**
 * Get lead statistics for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Lead stats
 */
async function getLeadStatsForJob(jobId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('leads')
    .select('current_step, step_progression_status, converted_to_restaurant_id')
    .eq('lead_scrape_job_id', jobId);

  if (error) throw error;

  const leads = data || [];

  const stats = {
    total_extracted: leads.length,
    unprocessed: 0,
    processed: 0,
    pending: 0,
    converted: 0,
  };

  for (const lead of leads) {
    const isPassed = lead.current_step === 4 && lead.step_progression_status === 'passed';
    const isConverted = lead.converted_to_restaurant_id !== null;

    if (isConverted) {
      stats.converted++;
      stats.processed++;
    } else if (isPassed) {
      stats.pending++;
      stats.processed++;
    } else {
      stats.unprocessed++;
    }
  }

  return stats;
}
```

**Modify `getLeadScrapeJob` to include stats:**

```javascript
async function getLeadScrapeJob(jobId, orgId) {
  // ... existing code ...

  // Add lead stats
  const leadStats = await getLeadStatsForJob(jobId);

  return {
    ...job,
    lead_stats: leadStats
  };
}
```

**Export the function:**
```javascript
module.exports = {
  // ... existing exports ...
  getLeadStatsForJob,
};
```

#### Step 2: Frontend - Update type definition

**File:** `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

**Add to `LeadScrapeJob` interface (~line 35):**

```typescript
export interface LeadScrapeJob {
  // ... existing fields ...

  // Lead statistics (populated by backend)
  lead_stats?: {
    total_extracted: number;
    unprocessed: number;
    processed: number;
    pending: number;
    converted: number;
  };
}
```

#### Step 3: Frontend - Display stats in card

**File:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobProgressCard.tsx`

**Replace the job details div (line 197-200) with:**

```tsx
{/* Job details - row 1 */}
<div className="text-sm text-muted-foreground">
  City: {job.city} | Cuisine: {job.cuisine} | Leads Limit: {job.leads_limit} | Page Offset: {job.page_offset || 1} | Extracted: {job.lead_stats?.total_extracted ?? stats.leads_extracted}
</div>

{/* Job details - row 2: Lead status totals */}
{job.lead_stats && (
  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
    <span className="text-yellow-600">Unprocessed: {job.lead_stats.unprocessed}</span>
    <span className="text-blue-600">Processed: {job.lead_stats.processed}</span>
    <span className="text-orange-600">Pending: {job.lead_stats.pending}</span>
    <span className="text-green-600">Converted: {job.lead_stats.converted}</span>
  </div>
)}
```

**Effort:** ~30 minutes

---

## Part 2: BatchProgressCard Improvements

### 2.1 Make Restaurant Names Clickable

**Current State:**
Restaurant names are displayed but not interactive.

**Target State:**
Clicking a restaurant name opens its detail page in a new tab.

**Implementation:**

**File:** `UberEats-Image-Extractor/src/components/registration-batch/BatchProgressCard.tsx`

**Current code (lines 187-199):**
```tsx
{batch.jobs.slice(0, 4).map((job) => (
  <div
    key={job.id}
    className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-md"
    title={job.restaurant?.city ? `${job.restaurant.name} - ${job.restaurant.city}` : job.restaurant?.name}
  >
    <Store className="h-3 w-3 text-muted-foreground" />
    <span className="truncate max-w-[120px]">{job.restaurant?.name || 'Unknown'}</span>
    {job.restaurant?.city && (
      <span className="text-muted-foreground">({job.restaurant.city})</span>
    )}
  </div>
))}
```

**Updated code:**
```tsx
{batch.jobs.slice(0, 4).map((job) => (
  <a
    key={job.id}
    href={`/restaurants/${job.restaurant_id}`}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
    title={job.restaurant?.city ? `${job.restaurant.name} - ${job.restaurant.city} (Click to open)` : job.restaurant?.name}
  >
    <Store className="h-3 w-3 text-muted-foreground" />
    <span className="truncate max-w-[120px] hover:underline">{job.restaurant?.name || 'Unknown'}</span>
    {job.restaurant?.city && (
      <span className="text-muted-foreground">({job.restaurant.city})</span>
    )}
  </a>
))}
```

**Key changes:**
1. Changed `<div>` to `<a>` with `href` and `target="_blank"`
2. Added `onClick={(e) => e.stopPropagation()}` to prevent card click handler from firing
3. Added hover styles for visual feedback
4. Updated title tooltip to indicate clickability

**Also update in `RegistrationBatches.tsx` (lines 142-153)** with the same changes.

**Effort:** ~10 minutes

---

### 2.2 Make "+N more" Expandable/Collapsible

**Current State:**
Shows first 4 restaurants with static "+N more" text.

**Target State:**
- "+N more" is clickable and expands to show all restaurants
- When expanded, shows a "Show less" button to collapse

**Implementation:**

**File:** `UberEats-Image-Extractor/src/components/registration-batch/BatchProgressCard.tsx`

**Add state for expansion (inside component, after line 119):**
```tsx
const [isRestaurantListExpanded, setIsRestaurantListExpanded] = useState(false);
```

**Replace the restaurant preview section (lines 185-216):**

```tsx
{/* Restaurant preview */}
{batch.jobs && batch.jobs.length > 0 && (
  <div className="mt-2 flex flex-wrap gap-1.5">
    {batch.jobs.slice(0, isRestaurantListExpanded ? undefined : 4).map((job) => (
      <a
        key={job.id}
        href={`/restaurants/${job.restaurant_id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
        title={job.restaurant?.city ? `${job.restaurant.name} - ${job.restaurant.city} (Click to open)` : job.restaurant?.name}
      >
        <Store className="h-3 w-3 text-muted-foreground" />
        <span className="truncate max-w-[120px] hover:underline">{job.restaurant?.name || 'Unknown'}</span>
        {job.restaurant?.city && (
          <span className="text-muted-foreground">({job.restaurant.city})</span>
        )}
      </a>
    ))}

    {/* Expand/Collapse button */}
    {batch.jobs.length > 4 && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsRestaurantListExpanded(!isRestaurantListExpanded);
        }}
        className="flex items-center text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 hover:bg-muted/50 rounded-md transition-colors"
      >
        {isRestaurantListExpanded ? (
          <>Show less</>
        ) : (
          <>+{batch.jobs.length - 4} more</>
        )}
      </button>
    )}
  </div>
)}
```

**Key changes:**
1. Added `isRestaurantListExpanded` state
2. Changed slice to show all items when expanded: `slice(0, isRestaurantListExpanded ? undefined : 4)`
3. Made "+N more" a button that toggles expansion
4. Added "Show less" text when expanded
5. Added hover styles for visual feedback

**Also update in `RegistrationBatches.tsx`** with the same pattern.

**Effort:** ~15 minutes

---

## Summary: Files to Modify

| File | Changes |
|------|---------|
| `src/services/lead-scrape-service.js` | Add `getLeadStatsForJob()`, modify `getLeadScrapeJob()` |
| `src/hooks/useLeadScrape.ts` | Add `lead_stats` to `LeadScrapeJob` interface |
| `src/components/leads/ScrapeJobProgressCard.tsx` | Display leads extracted + status totals |
| `src/components/registration-batch/BatchProgressCard.tsx` | Clickable restaurants + expandable list |
| `src/pages/RegistrationBatches.tsx` | Clickable restaurants + expandable list (inline component) |

---

## Implementation Order

1. **ScrapeJobProgressCard - Leads Extracted** (5 min)
   - Frontend-only, uses existing data

2. **ScrapeJobProgressCard - Lead Status Totals** (30 min)
   - Backend: Add `getLeadStatsForJob()` function
   - Backend: Modify `getLeadScrapeJob()` to include stats
   - Frontend: Add type definition
   - Frontend: Display stats in card

3. **BatchProgressCard - Clickable Restaurants** (10 min)
   - Change `<div>` to `<a>` with proper href
   - Apply to both component and inline version

4. **BatchProgressCard - Expandable List** (15 min)
   - Add state management
   - Update slice logic
   - Add expand/collapse button
   - Apply to both component and inline version

---

## Testing Checklist

### ScrapeJobProgressCard
- [ ] "Leads Extracted" displays correct count
- [ ] Status totals (Unprocessed/Processed/Pending/Converted) display correctly
- [ ] Totals match: `Extracted = Unprocessed + Processed`
- [ ] Totals match: `Processed = Pending + Converted`
- [ ] Colors are visually distinct for each status

### BatchProgressCard
- [ ] Restaurant names are clickable
- [ ] Clicking opens RestaurantDetail in new tab
- [ ] Card click still navigates to batch detail (not hijacked)
- [ ] "+N more" expands to show all restaurants
- [ ] "Show less" collapses back to 4 restaurants
- [ ] Both full and compact card views work correctly

---

## Visual Mockups

### ScrapeJobProgressCard (After)
```
┌──────────────────────────────────────────────────────────────┐
│ Wellington Pollo Scrape - Page 1        [in progress]        │
│ Created 2 days ago • Step 4 of 4                             │
│ Platform: UberEats                                           │
│                                                              │
│ City: Wellington | Cuisine: pollo | Leads Limit: 21          │
│ Page Offset: 1 | Extracted: 12                               │
│                                                              │
│ Unprocessed: 4 | Processed: 8 | Pending: 4 | Converted: 4    │
│   (yellow)      (blue)        (orange)     (green)           │
│                                                              │
│ [Progress Bar ████████████████████████████████████████] 100% │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

### BatchProgressCard (After - Collapsed)
```
┌──────────────────────────────────────────────────────────────┐
│ Wellington Chicken Batch                 [in progress]       │
│ 0 completed, 0 failed of 2 restaurants                       │
│                                                              │
│ [🏪 Devil Burger↗] [🏪 Soul Shack↗] [+3 more]               │
│      (clickable)       (clickable)    (expandable)           │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

### BatchProgressCard (After - Expanded)
```
┌──────────────────────────────────────────────────────────────┐
│ Wellington Chicken Batch                 [in progress]       │
│ 0 completed, 0 failed of 5 restaurants                       │
│                                                              │
│ [🏪 Devil Burger↗] [🏪 Soul Shack↗] [🏪 Beach Pizza↗]       │
│ [🏪 Burger Fuel↗] [🏪 Wendy's↗] [Show less]                 │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Alternative Approaches Considered

### Lead Stats Calculation

**Option A: Calculate in Backend (Recommended)**
- Pros: Single source of truth, consistent across clients
- Cons: Extra DB query per job fetch

**Option B: Calculate in Frontend**
- Pros: No backend changes
- Cons: Would need to fetch all leads separately, inconsistent calculations

**Option C: Store pre-computed stats**
- Pros: Fast reads
- Cons: Requires triggers/background jobs to keep stats updated

**Decision:** Option A chosen for accuracy and simplicity.

### Expandable List

**Option A: State in Component (Recommended)**
- Pros: Simple, isolated state per card
- Cons: State resets on re-render

**Option B: URL-based expansion**
- Pros: Shareable state
- Cons: Overkill for this use case

**Decision:** Option A chosen for simplicity.
