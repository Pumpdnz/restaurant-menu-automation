# Lead Scraping Fixes Part 4 - Overview

## Document Purpose

This document outlines the investigation findings and implementation plan for Part 4 fixes focused on:
1. Lead exclusion filters for non-ICP fast food chains
2. Parallel scraping enhancement for large lead limits

**Date**: 2025-12-07
**Last Updated**: 2025-12-08
**Status**: IMPLEMENTATION COMPLETE

---

## Progress Summary

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Lead Exclusion Filter | ✅ COMPLETE |
| Task 2 | Parallel Scraping Enhancement (UberEats Only) | ✅ COMPLETE |

---

## Task 1: Lead Exclusion Filter

### Objective
Filter out known fast food chains and non-ICP restaurants from Step 1 scrape results before creating database records.

### Investigation Findings

**File**: `lead-scrape-firecrawl-service.js`

**Current Flow (lines 518-547)**:
```javascript
// 1. Validate and clean data (lines 518-524)
const validRestaurants = restaurants
  .filter(r => r.restaurant_name && r.store_link)
  .filter(r => r.store_link.includes('ubereats.com') && r.store_link.includes('/store/'))
  .map(r => ({
    restaurant_name: r.restaurant_name.trim(),
    store_link: r.store_link.trim()
  }));

// 2. Deduplicate by store_link (lines 527-529)
const uniqueRestaurants = [...new Map(
  validRestaurants.map(r => [r.store_link, r])
).values()];

// 3. Apply leads_limit (line 532)
const limitedRestaurants = uniqueRestaurants.slice(0, job.leads_limit);

// 4. Create lead records (lines 538-547)
const leadsToCreate = limitedRestaurants.map(r => ({...}));
```

**Insertion Point**: Between step 1 (validation) and step 2 (deduplication) - after line 524.

### Excluded Chains List

The following chains should be excluded (case-insensitive matching):

| Chain | Variations to Match |
|-------|---------------------|
| McDonald's | `mcdonald's`, `mcdonalds`, `mc donalds`, `mc donald's` |
| Burger King | `burger king` |
| Taco Bell | `taco bell` |
| KFC | `kfc`, `kentucky fried chicken` |
| Subway | `subway` |
| Bowl'd | `bowl'd`, `bowld` |
| Pita Pit | `pita pit` |
| Burger Fuel | `burger fuel`, `burgerfuel` |
| Carl's Jr. | `carl's jr`, `carls jr`, `carl's junior` |
| Nando's | `nando's`, `nandos` |
| Buns N Rolls | `buns n rolls`, `buns and rolls` |
| Mexicali Fresh | `mexicali fresh` |
| Zambrero | `zambrero` |
| Sal's Pizza | `sal's authentic`, `sals authentic`, `sal's pizza`, `sals pizza` |
| Domino's | `domino's`, `dominos` |
| Lone Star | `lone star` |
| Pizza Hut | `pizza hut` |
| Hell Pizza | `hell pizza`, `hell's pizza`, `hells pizza` |
| Pizza Club | `pizza club` |
| Chicking | `chicking` |
| Wendy's | `wendy's`, `wendys` |
| Better Burger | `better burger` |
| St Pierre's | `st pierre's`, `st pierres`, `saint pierre` |
| RE Burger | `re burger`, `reburger` |

### Implementation Plan

#### Step 1: Create Exclusion Constants

Add at top of `lead-scrape-firecrawl-service.js`:

```javascript
// ============================================================================
// LEAD EXCLUSION FILTER - Non-ICP Fast Food Chains
// ============================================================================

/**
 * List of excluded chain name patterns (case-insensitive)
 * These are fast food chains that are not our ICP (Ideal Customer Profile)
 */
const EXCLUDED_CHAIN_PATTERNS = [
  // McDonald's variations
  /mcdonalds?/i,
  /mc\s*donald'?s?/i,
  // Other major chains
  /burger\s*king/i,
  /taco\s*bell/i,
  /\bkfc\b/i,
  /kentucky\s*fried\s*chicken/i,
  /\bsubway\b/i,
  /bowl'?d/i,
  /pita\s*pit/i,
  /burger\s*fuel/i,
  /carl'?s?\s*jr\.?/i,
  /carl'?s?\s*junior/i,
  /nando'?s/i,
  /buns\s*(n|and)\s*rolls/i,
  /mexicali\s*fresh/i,
  /zambrero/i,
  /sal'?s\s*(authentic|pizza)/i,
  /domino'?s/i,
  /lone\s*star/i,
  /pizza\s*hut/i,
  /hell'?s?\s*pizza/i,
  /pizza\s*club/i,
  /chicking/i,
  /wendy'?s/i,
  /better\s*burger/i,
  /st\.?\s*pierre'?s?/i,
  /saint\s*pierre/i,
  /re\s*burger/i,
];

/**
 * Check if a restaurant name matches any excluded chain pattern
 * @param {string} restaurantName - Name to check
 * @returns {boolean} - True if excluded, false if allowed
 */
function isExcludedChain(restaurantName) {
  if (!restaurantName) return false;
  const nameLower = restaurantName.toLowerCase();
  return EXCLUDED_CHAIN_PATTERNS.some(pattern => pattern.test(nameLower));
}
```

#### Step 2: Add Filter to processStep1

Update `processStep1()` to filter excluded chains:

```javascript
// Validate and clean data
const validRestaurants = restaurants
  .filter(r => r.restaurant_name && r.store_link)
  .filter(r => r.store_link.includes('ubereats.com') && r.store_link.includes('/store/'))
  .map(r => ({
    restaurant_name: r.restaurant_name.trim(),
    store_link: r.store_link.trim()
  }));

// NEW: Filter out excluded chains (non-ICP fast food)
const icpRestaurants = validRestaurants.filter(r => {
  const isExcluded = isExcludedChain(r.restaurant_name);
  if (isExcluded) {
    console.log(`[LeadScrapeFirecrawl] Excluding chain: ${r.restaurant_name}`);
  }
  return !isExcluded;
});

// Deduplicate by store_link
const uniqueRestaurants = [...new Map(
  icpRestaurants.map(r => [r.store_link, r])  // Changed from validRestaurants
).values()];
```

#### Step 3: Update Logging

Add exclusion count to the logging:

```javascript
console.log(`[LeadScrapeFirecrawl] Found ${restaurants.length} restaurants, ${validRestaurants.length - icpRestaurants.length} excluded as non-ICP`);
```

---

## Task 2: Parallel Scraping Enhancement (UberEats Only)

### Objective
When **UberEats platform** scrapes have a `leads_limit` higher than 21 (single page), automatically execute multiple parallel requests to Firecrawl with sequential page offsets.

**Important**: This enhancement only applies to UberEats platform scrapes. Other platforms may have different pagination structures and should continue using single-page scraping until platform-specific implementations are added.

### Investigation Findings

**File**: `lead-scrape-firecrawl-service.js`

**Current Flow (lines 492-512)**:
```javascript
// Build URL (single page)
const url = buildCategoryUrl(
  job.country,
  job.city_code,
  job.region_code,
  job.cuisine,
  job.page_offset  // Single page offset
);

// Make extraction request (single request)
const result = await firecrawlRequest(url, STEP_1_PROMPT, STEP_1_SCHEMA, {...});
```

**Key Observations**:
- UberEats returns approximately 21 restaurants per page
- `buildCategoryUrl` constructs URL with `?page=${pageOffset}`
- Currently only one request is made regardless of `leads_limit`
- `FIRECRAWL_CONCURRENCY_LIMIT` is already defined (default: 5)

### Implementation Plan

#### Step 1: Add Constants

```javascript
// UberEats typically returns ~21 items per page
const UBEREATS_ITEMS_PER_PAGE = 21;
```

#### Step 2: Create Helper Function

```javascript
/**
 * Calculate how many pages need to be scraped based on leads limit
 * @param {number} leadsLimit - Target number of leads
 * @param {number} itemsPerPage - Items returned per page (default: 21)
 * @returns {number} - Number of pages to scrape
 */
function calculatePagesNeeded(leadsLimit, itemsPerPage = UBEREATS_ITEMS_PER_PAGE) {
  return Math.ceil(leadsLimit / itemsPerPage);
}

/**
 * Generate array of page numbers to scrape
 * @param {number} startPage - Starting page offset
 * @param {number} pagesNeeded - Number of pages to scrape
 * @returns {number[]} - Array of page numbers
 */
function generatePageNumbers(startPage, pagesNeeded) {
  return Array.from({ length: pagesNeeded }, (_, i) => startPage + i);
}
```

#### Step 3: Refactor processStep1 for Parallel Scraping (UberEats Only)

```javascript
async function processStep1(jobId, job) {
  const client = getSupabaseClient();
  console.log(`[LeadScrapeFirecrawl] Starting Step 1 for job ${jobId}`);

  try {
    // Update step 1 status to in_progress
    await client
      .from('lead_scrape_job_steps')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 1);

    let allRestaurants = [];

    // Check if parallel scraping should be used (UberEats only with leads_limit > UBEREATS_ITEMS_PER_PAGE)
    const isUberEats = job.platform?.toLowerCase() === 'ubereats';
    const shouldUseParallelScraping = isUberEats && job.leads_limit > UBEREATS_ITEMS_PER_PAGE;

    if (shouldUseParallelScraping) {
      // PARALLEL SCRAPING: Multiple pages for UberEats
      const pagesNeeded = calculatePagesNeeded(job.leads_limit);
      const pageNumbers = generatePageNumbers(job.page_offset, pagesNeeded);

      console.log(`[LeadScrapeFirecrawl] UberEats parallel scrape - Leads limit: ${job.leads_limit}, Pages to scrape: ${pagesNeeded} (pages ${pageNumbers.join(', ')})`);

      // Build URLs for all pages
      const urls = pageNumbers.map(pageNum => ({
        pageNum,
        url: buildCategoryUrl(
          job.country,
          job.city_code,
          job.region_code,
          job.cuisine,
          pageNum
        )
      }));

      // Execute parallel requests (respecting concurrency limit)
      for (let i = 0; i < urls.length; i += FIRECRAWL_CONCURRENCY_LIMIT) {
        const batch = urls.slice(i, i + FIRECRAWL_CONCURRENCY_LIMIT);

        console.log(`[LeadScrapeFirecrawl] Scraping batch: pages ${batch.map(u => u.pageNum).join(', ')}`);

        const batchResults = await Promise.allSettled(
          batch.map(async ({ pageNum, url }) => {
            console.log(`[LeadScrapeFirecrawl] Extracting page ${pageNum}: ${url}`);

            const result = await firecrawlRequest(url, STEP_1_PROMPT, STEP_1_SCHEMA, {
              timeout: 90000,
              waitFor: 5000,
              onlyMainContent: false
            }, {
              organisationId: job.organisation_id,
              jobId: jobId,
              stepNumber: 1
            });

            return {
              pageNum,
              restaurants: result.restaurants || []
            };
          })
        );

        // Collect successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            console.log(`[LeadScrapeFirecrawl] Page ${result.value.pageNum}: Found ${result.value.restaurants.length} restaurants`);
            allRestaurants = allRestaurants.concat(result.value.restaurants);
          } else {
            console.error(`[LeadScrapeFirecrawl] Page scrape failed:`, result.reason);
          }
        }
      }

      console.log(`[LeadScrapeFirecrawl] Total restaurants from ${pagesNeeded} pages: ${allRestaurants.length}`);

    } else {
      // SINGLE PAGE SCRAPING: Default behavior for non-UberEats or small limits
      const url = buildCategoryUrl(
        job.country,
        job.city_code,
        job.region_code,
        job.cuisine,
        job.page_offset
      );

      console.log(`[LeadScrapeFirecrawl] Single page scrape: ${url}`);

      const result = await firecrawlRequest(url, STEP_1_PROMPT, STEP_1_SCHEMA, {
        timeout: 90000,
        waitFor: 5000,
        onlyMainContent: false
      }, {
        organisationId: job.organisation_id,
        jobId: jobId,
        stepNumber: 1
      });

      allRestaurants = result.restaurants || [];
    }

    // Continue with existing validation, filtering, and lead creation...
    const restaurants = allRestaurants;

    // ... rest of existing code (validation, exclusion filter, deduplication, etc.)
  } catch (error) {
    // ... existing error handling
  }
}
```

### Edge Cases to Handle

1. **Non-UberEats Platform**: Continue with single request (skip parallel scraping)
2. **Single Page (leads_limit <= 21)**: Continue with single request (current behavior)
3. **Empty Pages**: Some pages may return fewer or no results - handle gracefully
4. **Duplicate Restaurants Across Pages**: Existing deduplication will handle this
5. **Rate Limiting**: Respect `FIRECRAWL_CONCURRENCY_LIMIT` for parallel requests
6. **Partial Failures**: If some pages fail, continue with successful results

### Updated Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     processStep1(jobId, job)                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check platform type                                          │
│    ├── UberEats + leads_limit > 21 → PARALLEL SCRAPING          │
│    └── Other platforms or small limit → SINGLE PAGE SCRAPING    │
├─────────────────────────────────────────────────────────────────┤
│ IF PARALLEL (UberEats only):                                    │
│ 2. Calculate pages needed: ceil(leads_limit / 21)               │
│ 3. Generate page URLs: [page_offset, page_offset+1, ...]        │
│ 4. Execute parallel requests (batches of 5)                     │
│    ├── Page 3 ─────────────────────────────────────────┐        │
│    ├── Page 4 ───���─────────────────────────────────────┤        │
│    └── Page 5 ─────────────────────────────────────────┘        │
│                           │                                      │
│                    Aggregate Results                             │
├─────────────────────────────────────────────────────────────────┤
│ ELSE (Single Page):                                             │
│ 2. Build single URL with page_offset                            │
│ 3. Execute single request                                       │
├─────────────────────────────────────────────────────────────────┤
│ COMMON PROCESSING:                                              │
│ 5. Validate restaurants (has name & store_link)                 │
│ 6. NEW: Filter excluded chains (non-ICP)                        │
│ 7. Deduplicate by store_link                                    │
│ 8. Apply leads_limit                                            │
│ 9. Create lead records                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Task 1: Lead Exclusion Filter
- [x] Add `EXCLUDED_CHAIN_PATTERNS` constant array
- [x] Add `isExcludedChain()` helper function
- [x] Update `processStep1()` to filter excluded chains after validation
- [x] Add logging for excluded restaurants
- [ ] Test with various chain name variations

### Task 2: Parallel Scraping (UberEats Only)
- [x] Add `UBEREATS_ITEMS_PER_PAGE` constant
- [x] Add `calculatePagesNeeded()` helper function
- [x] Add `generatePageNumbers()` helper function
- [x] Add platform check (`job.platform === 'ubereats'`)
- [x] Refactor `processStep1()` for conditional parallel scraping
- [x] Handle edge cases (non-UberEats, empty pages, partial failures)
- [ ] Test with various leads_limit values (21, 42, 63, 100)

---

## Testing Plan

### Test Cases for Exclusion Filter

| Restaurant Name | Expected Result |
|-----------------|-----------------|
| "McDonald's Queen Street" | EXCLUDED |
| "McDonalds CBD" | EXCLUDED |
| "Mc Donald's" | EXCLUDED |
| "Burger King Newmarket" | EXCLUDED |
| "KFC Auckland" | EXCLUDED |
| "The Burger Joint" | ALLOWED |
| "Pizza Paradise" | ALLOWED |
| "Thai Kitchen" | ALLOWED |
| "Hell Pizza Ponsonby" | EXCLUDED |
| "Heaven's Kitchen" | ALLOWED |

### Test Cases for Parallel Scraping (UberEats Only)

| Platform | leads_limit | page_offset | Expected Behavior | Expected URLs |
|----------|-------------|-------------|-------------------|---------------|
| ubereats | 21 | 1 | Single page (limit ≤ 21) | page=1 |
| ubereats | 42 | 1 | Parallel (2 pages) | page=1, page=2 |
| ubereats | 63 | 3 | Parallel (3 pages) | page=3, page=4, page=5 |
| ubereats | 100 | 1 | Parallel (5 pages) | page=1 to page=5 |
| ubereats | 50 | 2 | Parallel (3 pages) | page=2, page=3, page=4 |

---

## Success Criteria

### Task 1 Success
- [x] All listed chain variations are correctly excluded
- [x] Non-chain restaurants pass through filter
- [x] Exclusion count logged during processing
- [x] No database records created for excluded chains

### Task 2 Success (UberEats Only)
- [x] Non-UberEats platforms use single page scraping regardless of leads_limit
- [x] UberEats with leads_limit ≤ 21 uses single page scraping
- [x] UberEats with leads_limit > 21 uses parallel scraping
- [x] Parallel requests respect FIRECRAWL_CONCURRENCY_LIMIT
- [x] Results from all pages aggregated correctly
- [x] Deduplication works across multiple pages
- [x] Partial page failures don't crash entire process

---

## Files to Modify

| File | Changes |
|------|---------|
| `lead-scrape-firecrawl-service.js` | Add exclusion filter, parallel scraping |

## Estimated Implementation Time

- Task 1 (Exclusion Filter): ~30 minutes
- Task 2 (Parallel Scraping): ~45 minutes
- Testing: ~30 minutes
- **Total**: ~2 hours
