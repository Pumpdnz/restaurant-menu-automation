# Lead Scraping Fixes Part 3 - Investigation Summary Plan

## Document Purpose

This document outlines the investigation findings and implementation plan for Batch 3 issues focused on data enrichment quality, URL validation/cleaning, and opening hours formatting. It also covers the addition of ordering platform discovery functionality.

**Date**: 2025-12-07
**Last Updated**: 2025-12-07
**Status**: ALL PHASES COMPLETE

---

## Progress Summary

| Phase | Description | Status | Date Completed |
|-------|-------------|--------|----------------|
| Phase 1 | Enhance Step 3 for Social Media | ✅ COMPLETE | 2025-12-07 |
| Phase 2a | Website Navigation for Ordering URLs | ✅ COMPLETE | 2025-12-07 |
| Phase 2b | Google Search Fallback | ⏭️ SKIPPED | - |
| Phase 3 | Frontend Updates & Step Naming | ✅ COMPLETE | 2025-12-07 |

### Phase 1 Results
Step 3 now successfully extracts social media URLs (Instagram/Facebook) directly from Google Business Profile Knowledge Panel. This means:
- **Step 4 can be repurposed** for Ordering Platform Discovery
- Social URL extraction from Step 3 is working with proper URL cleaning/validation
- URL validation service (`lead-url-validation-service.js`) is implemented and working

### Phase 2a Results
Step 4 has been successfully refactored for Ordering Platform Discovery:
- **Backend implementation complete** - `processStep4()` now scrapes restaurant websites for ordering links
- **Platform identification working** - Recognizes NZ platforms: Bite, Book N Order, Bopple, Bustle, Foodhub, Gloriafood, Mobi2Go, Me&U, NextOrder, Ordermeal, Resdiary, Sipo CloudPOS, Tabin, Tuckerfox
- **Database columns added** - `ordering_platform_url`, `ordering_platform_name`, `ordering_source`
- **Excluded domains filter working** - UberEats, DoorDash, Menulog, DeliverEasy correctly filtered out
- **Phase 2b (Google Search Fallback) SKIPPED** - Website navigation approach is sufficient

### Phase 3 Results
Frontend updates completed:
- **Step 4 renamed** - Changed from "Social Media Discovery" to "Ordering Platform Discovery" in `lead-scrape-service.js`
- **Lead interface updated** - Added `ordering_platform_url`, `ordering_platform_name`, `ordering_source` fields to `useLeadScrape.ts`
- **ScrapeJobStepDetailModal.tsx updated** - Displays ordering platform name and URL in expanded lead details
- **LeadDetailModal.tsx updated** - View mode shows ordering platform section with platform name, source, and URL; Edit mode allows editing platform name and URL

---

## Current System Analysis

### Step 3: Google Business Lookup

**File**: `lead-scrape-firecrawl-service.js` (lines 109-165)

Current schema and prompt extract:
- `phone` - Business phone number
- `website_url` - Official business website URL
- `opening_hours` - Object with day keys (monday-sunday)
- `opening_hours_text` - Raw opening hours text (to be removed)
- `google_address` - Address from Google Business Profile
- `google_rating` - Google rating out of 5
- `google_reviews` - Number of Google reviews (needs cleaning)

**Issues Identified**:
1. No social media URL extraction in Step 3
2. `opening_hours_text` is non-essential and inconsistent
3. `google_reviews` returns inconsistent format ("281 Google reviews", "355 reviews")
4. No midnight crossing handling for opening hours

### Step 4: Social Media Discovery

**File**: `lead-scrape-firecrawl-service.js` (lines 169-193)

Current schema extracts:
- `instagram_url` - Instagram profile URL
- `facebook_url` - Facebook page URL

**Issues Identified**:
1. No URL validation/cleaning before storing
2. Accepts reel URLs, video URLs, group URLs, post URLs
3. No query parameter stripping

---

## Issues to Fix

### Issue 1: Instagram URL Cleaning

**Problem**: Instagram URLs returned with query parameters
- Example: `https://www.instagram.com/amoreitalianoristorante/?hl=en`
- Should be: `https://www.instagram.com/amoreitalianoristorante/`

**Solution**: Add URL cleaning function to strip query parameters

```javascript
function cleanInstagramUrl(url) {
  if (!url || !url.includes('instagram.com')) return url;
  try {
    const urlObj = new URL(url);
    // Keep only the pathname, strip all query params
    return `https://www.instagram.com${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
}
```

### Issue 2: Instagram Reel URL Rejection

**Problem**: Instagram reel URLs are not profile URLs
- Example: `https://www.instagram.com/reel/DQGNcelkpF3/`

**Solution**: Validate URL is a profile, not a reel/post/story

```javascript
function isValidInstagramProfileUrl(url) {
  if (!url || !url.includes('instagram.com')) return false;
  // Invalid patterns: /reel/, /p/, /stories/, /reels/, /tv/
  const invalidPatterns = ['/reel/', '/p/', '/stories/', '/reels/', '/tv/'];
  return !invalidPatterns.some(pattern => url.includes(pattern));
}
```

### Issue 3: Facebook URL Validation

**Problem**: Facebook URLs for videos, groups, and posts are not profile pages
- Videos: `https://www.facebook.com/iloveponsonbynz/videos/...`
- Groups: `https://www.facebook.com/groups/...`
- Posts: `https://www.facebook.com/groups/.../posts/...`

**Solution**: Validate URL is a page, not videos/groups/posts

```javascript
function isValidFacebookPageUrl(url) {
  if (!url || !url.includes('facebook.com')) return false;
  // Invalid patterns
  const invalidPatterns = ['/videos/', '/groups/', '/posts/', '/events/', '/photos/'];
  return !invalidPatterns.some(pattern => url.includes(pattern));
}

function cleanFacebookUrl(url) {
  if (!url || !url.includes('facebook.com')) return url;
  try {
    const urlObj = new URL(url);
    // Extract just the page name from pathname
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length >= 1 && !['videos', 'groups', 'posts', 'events', 'photos'].includes(pathParts[0])) {
      return `https://www.facebook.com/${pathParts[0]}/`;
    }
    return null; // Invalid URL
  } catch (e) {
    return null;
  }
}
```

### Issue 4: Remove Opening Hours Text

**Problem**: `opening_hours_text` stores inconsistent values like "Open, Closes 6pm"

**Solution**: Remove from schema and prompt in Step 3
- Remove `opening_hours_text` from STEP_3_SCHEMA
- Remove reference from STEP_3_PROMPT
- Stop storing `opening_hours_text` in database update

### Issue 5: Opening Hours JSON Format

**Problem**: Opening hours don't handle midnight crossing or split hours (lunch/dinner) correctly
- Current: `{"friday": "11:30 AM–2:45 AM"}` (object with day keys, string values)
- Should use array format matching `/google-business-search` endpoint

**Solution**: Use array-based schema matching existing pattern in server.js

```javascript
const OPENING_HOURS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      day: { type: "string", description: "Day of the week (Monday, Tuesday, etc.)" },
      open: { type: "string", description: "Opening time" },
      close: { type: "string", description: "Closing time" },
      period: { type: "string", description: "Optional: Lunch or Dinner. Only use if there are multiple hours entries for this day" }
    }
  }
};
```

**Example Output**:
```javascript
// Single hours per day
[
  { day: "Monday", open: "11:00 AM", close: "9:30 PM" },
  { day: "Tuesday", open: "11:00 AM", close: "9:30 PM" },
  // ... etc
]

// Split hours (lunch/dinner)
[
  { day: "Friday", open: "11:30 AM", close: "2:30 PM", period: "Lunch" },
  { day: "Friday", open: "5:00 PM", close: "10:00 PM", period: "Dinner" },
]

// Midnight crossing (store as displayed, handle in backend)
[
  { day: "Friday", open: "5:00 PM", close: "2:00 AM" },
]
```

**Backend Processing**: Store as extracted, convert on registration

The extraction should capture hours exactly as displayed. Backend processing when converting leads to restaurants can normalize the format as needed for the Pumpd registration system.

### Issue 6: Google Reviews Number Cleaning

**Problem**: Inconsistent format for review counts
- Examples: "281 Google reviews", "355 reviews", "(500+ reviews)"

**Solution**: Clean to extract just the number

```javascript
function cleanReviewCount(reviewStr) {
  if (!reviewStr) return null;

  // Remove commas, extract numbers
  const match = reviewStr.replace(/,/g, '').match(/(\d+)\+?/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}
```

---

## Phase 1: Enhance Step 3 for Social Media

### Objective
Add Instagram and Facebook URL extraction to Step 3's Google Business Profile search, potentially eliminating the need for a separate Step 4 or changing Step 4's focus.

### Updated STEP_3_SCHEMA

```javascript
const STEP_3_SCHEMA = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      description: "Business phone number in local format"
    },
    website_url: {
      type: "string",
      description: "Official business website URL (NOT delivery platforms like UberEats, DoorDash)"
    },
    openingHours: {
      type: "array",
      description: "Opening hours for each day of the week",
      items: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day of the week (Monday, Tuesday, etc.)" },
          open: { type: "string", description: "Opening time" },
          close: { type: "string", description: "Closing time" },
          period: { type: "string", description: "Optional: Lunch or Dinner. Only use if there are multiple hours entries for this day" }
        }
      }
    },
    google_address: {
      type: "string",
      description: "Business address from Google Business Profile"
    },
    google_rating: {
      type: "number",
      description: "Google rating out of 5"
    },
    google_reviews_count: {
      type: "integer",
      description: "Number of Google reviews as an integer (e.g., 281, not '281 reviews')"
    },
    instagram_url: {
      type: "string",
      description: "Instagram profile URL from the Knowledge Panel social links (e.g., https://www.instagram.com/restaurantname/). Must be a profile URL, NOT reels or posts."
    },
    facebook_url: {
      type: "string",
      description: "Facebook page URL from the Knowledge Panel social links (e.g., https://www.facebook.com/restaurantname/). Must be a page URL, NOT groups, videos, or posts."
    }
  }
};
```

### Updated STEP_3_PROMPT

```javascript
const STEP_3_PROMPT = `Extract business information from this Google search results page. Focus on the Knowledge Panel / Business Profile on the right side.

Extract the following information:

1. PHONE NUMBER - Business phone in local format (with area code)

2. WEBSITE URL - The official business website ONLY.
   - EXCLUDE delivery platform links (UberEats, DoorDash, DeliverEasy, MenuLog)
   - EXCLUDE social media links

3. OPENING HOURS - Extract hours for each day exactly as shown on the page.
   IMPORTANT: Extract hours exactly as displayed. Some restaurants have split hours (lunch and dinner).
   - If the page shows continuous hours (e.g., "11am - 9pm"), return a single entry per day.
   - Only create separate entries if there is an explicit gap/break shown on the page (e.g., "11am-2pm" then "5pm-9pm").
   - Use the "period" field ONLY when there are multiple time slots for the same day (e.g., "Lunch", "Dinner").
   - If a day shows "Closed", do not include an entry for that day.

4. GOOGLE ADDRESS - The full business address shown

5. GOOGLE RATING - The star rating out of 5.0

6. GOOGLE REVIEWS COUNT - The number of reviews as an integer ONLY
   - Example: If shown as "281 Google reviews", return 281
   - Example: If shown as "(500+ reviews)", return 500

7. INSTAGRAM URL - Look for Instagram link in the Knowledge Panel's social media section
   - ONLY extract profile URLs like https://www.instagram.com/username/
   - REJECT URLs containing /reel/, /p/, /stories/, /reels/, /tv/

8. FACEBOOK URL - Look for Facebook link in the Knowledge Panel's social media section
   - ONLY extract page URLs like https://www.facebook.com/pagename/
   - REJECT URLs containing /videos/, /groups/, /posts/, /events/, /photos/

IMPORTANT: Only extract data visible on the page. Do not guess or fabricate values.`;
```

### Backend Processing Updates

**File**: `lead-scrape-firecrawl-service.js` - `processStep3()`

Add post-extraction cleaning:

```javascript
// After Firecrawl extraction in processStep3
const result = await firecrawlRequest(...);

// Import validation service
const { cleanInstagramUrl, cleanFacebookUrl, cleanReviewCount } = require('./lead-url-validation-service');

// Clean and validate extracted data
const cleanedResult = {
  phone: result.phone || null,
  website_url: result.website_url || null,
  opening_hours: result.openingHours || [], // Store array format directly
  google_address: result.google_address || null,
  google_average_review_rating: result.google_rating || null,
  google_number_of_reviews: cleanReviewCount(result.google_reviews_count),
  instagram_url: cleanInstagramUrl(result.instagram_url),
  facebook_url: cleanFacebookUrl(result.facebook_url)
};

// Update lead with cleaned data
await client
  .from('leads')
  .update({
    phone: cleanedResult.phone,
    website_url: cleanedResult.website_url,
    opening_hours: cleanedResult.opening_hours,
    google_address: cleanedResult.google_address,
    google_average_review_rating: cleanedResult.google_average_review_rating,
    google_number_of_reviews: cleanedResult.google_number_of_reviews,
    instagram_url: cleanedResult.instagram_url,
    facebook_url: cleanedResult.facebook_url,
    step_progression_status: 'processed',
    updated_at: new Date().toISOString()
  })
  .eq('id', lead.id);
```

**Note**: The `opening_hours` column in the database should store the array format directly. The conversion to the Pumpd registration format (handling midnight crossings, etc.) should happen during lead-to-restaurant conversion, not during extraction.

---

## Phase 2: Ordering Platform Discovery

> **Decision (2025-12-07)**: Phase 1 was successful - Step 3 now extracts social URLs from Google Knowledge Panel.
> Step 4 will be **repurposed for Ordering Platform Discovery**.

### Implementation Strategy

Phase 2 is split into two sub-phases to ensure a stable, iterative approach:

| Sub-Phase | Focus | Dependency |
|-----------|-------|------------|
| **Phase 2a** | Website Navigation - scrape restaurant website for ordering links | None |
| **Phase 2b** | Google Search Fallback - search when website has no ordering link | Phase 2a stable |

---

## Phase 2a: Website Navigation Approach

### Objective
Navigate to the restaurant's website (extracted in Step 3) and find "Order Online" / "Order Now" type buttons/links to discover their online ordering platform.

### Prerequisites
- Lead must have `website_url` populated from Step 3
- Leads without `website_url` will be skipped (marked as processed with no ordering URL)

### Extraction Strategy

**Step 1: Scrape Website for Ordering Links**

Use Firecrawl to scrape the restaurant's website and look for:
1. Links/buttons with ordering-related text
2. Links to known ordering platforms
3. Embedded ordering widgets

**Target Text Patterns** (case-insensitive):
```javascript
const ORDERING_LINK_PATTERNS = [
  'order online',
  'order now',
  'order pickup',
  'order delivery',
  'online ordering',
  'start order',
  'place order',
  'order here',
  'order food',
  'menu & order',
  'order for pickup',
  'order for delivery'
];
```

**Known Ordering Platform Domains**:
```javascript
const KNOWN_ORDERING_PLATFORMS = {
  // Third-party platforms (exclude delivery-only like UberEats, DoorDash)
  'gloriafood.com': 'GloriaFood',
  'order.online': 'GloriaFood',
  'chownow.com': 'ChowNow',
  'toasttab.com': 'Toast',
  'square.site': 'Square Online',
  'squareup.com': 'Square Online',
  'olo.com': 'Olo',
  'popmenu.com': 'Popmenu',
  'menufy.com': 'Menufy',
  'slice.com': 'Slice',
  'bento.box': 'BentoBox',
  'getbento.com': 'BentoBox',
  'order.app': 'Order.app',
  // NZ-specific
  'flipdish.com': 'Flipdish',
  'mobi2go.com': 'Mobi2Go',
  'delivereasy.co.nz': 'DeliverEasy',  // Has own ordering
  'menulog.co.nz': 'Menulog',
  // If URL contains these, it's likely direct website ordering
  '/order': 'Own Website',
  '/menu': 'Own Website (potential)',
  'order.': 'Own Website'
};
```

### Schema for Phase 2a

```javascript
const STEP_4_SCHEMA = {
  type: "object",
  properties: {
    ordering_links: {
      type: "array",
      description: "All ordering-related links found on the website",
      items: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL of the ordering link" },
          text: { type: "string", description: "The link/button text" },
          location: { type: "string", description: "Where on the page: header, footer, hero, body" }
        }
      }
    }
  }
};
```

### Prompt for Phase 2a

```javascript
const STEP_4_PROMPT = `Analyze this restaurant website and find all online ordering links.

Look for:
1. BUTTONS or LINKS with text like: "Order Online", "Order Now", "Start Order", "Order Pickup", "Order Delivery", "Place Order"
2. Links to ordering platforms like: GloriaFood, ChowNow, Toast, Square, Olo, Popmenu
3. Any navigation items related to ordering

For each ordering link found, extract:
- The full URL (href)
- The visible text on the link/button
- Where it appears: header, footer, hero section, or body

IMPORTANT:
- EXCLUDE links to UberEats, DoorDash, Grubhub (these are delivery aggregators, not ordering platforms)
- EXCLUDE social media links
- EXCLUDE "View Menu" links that just show a PDF menu (no ordering capability)
- Focus on links that lead to actual online ordering functionality

Return an empty array if no ordering links are found.`;
```

### Backend Processing Logic

```javascript
async function processStep4Website(jobId, leadIds = null) {
  // 1. Get leads at Step 4 with website_url populated
  const leads = await getLeadsForStep4(jobId, leadIds);

  for (const lead of leads) {
    // Skip if no website URL
    if (!lead.website_url) {
      await markLeadProcessed(lead.id, {
        ordering_platform_url: null,
        ordering_platform_name: null,
        step_progression_status: 'processed'
      });
      continue;
    }

    // Scrape website for ordering links
    const result = await firecrawlRequest(
      lead.website_url,
      STEP_4_PROMPT,
      STEP_4_SCHEMA
    );

    // Process found links
    const bestOrderingLink = selectBestOrderingLink(result.ordering_links);

    await updateLead(lead.id, {
      ordering_platform_url: bestOrderingLink?.url || null,
      ordering_platform_name: identifyPlatform(bestOrderingLink?.url),
      step_progression_status: 'processed'
    });
  }
}

function selectBestOrderingLink(links) {
  if (!links || links.length === 0) return null;

  // Priority: header > hero > body > footer
  const priorityOrder = ['header', 'hero', 'body', 'footer'];

  // Sort by location priority
  links.sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.location) || 99;
    const bIdx = priorityOrder.indexOf(b.location) || 99;
    return aIdx - bIdx;
  });

  // Return first valid link
  return links[0];
}

function identifyPlatform(url) {
  if (!url) return null;

  for (const [domain, name] of Object.entries(KNOWN_ORDERING_PLATFORMS)) {
    if (url.includes(domain)) return name;
  }

  return 'Own Website';
}
```

### Database Changes for Step 4

Add new columns to `leads` table:
```sql
-- Add ordering platform columns (if not already present)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS ordering_platform_url TEXT,
ADD COLUMN IF NOT EXISTS ordering_platform_name TEXT;
```

### Success Criteria for Phase 2a

- [ ] Website scraping successfully extracts ordering links from test restaurants
- [ ] Platform identification correctly identifies known platforms
- [ ] Links to UberEats/DoorDash are correctly filtered out
- [ ] Leads without website_url are handled gracefully
- [ ] At least 30% of restaurants with websites have ordering links detected

### Iteration Plan for Phase 2a

1. **Iteration 1**: Basic implementation with simple text pattern matching
2. **Iteration 2**: Improve prompt based on initial results, add more patterns
3. **Iteration 3**: Handle edge cases (popups, JavaScript-rendered links)
4. **Iteration 4**: Fine-tune platform identification

---

## Phase 2b: Google Search Fallback

> **Note**: Only implement after Phase 2a is stable and we have data on success rate.

### Objective
For leads where Phase 2a found no ordering link (or no website exists), use Google Search as a fallback to find ordering platform URLs.

### When to Use Fallback
- Lead has no `website_url` from Step 3
- Lead has `website_url` but Phase 2a found no ordering links
- Website scraping failed/timed out

### Search Strategy

**Search Query Format**:
```javascript
function buildOrderingSearchUrl(restaurantName, city) {
  const query = encodeURIComponent(
    `"${restaurantName}" ${city} "order online" OR "online ordering"`
  );
  return `https://www.google.com/search?q=${query}`;
}
```

### Schema for Phase 2b

```javascript
const STEP_4_FALLBACK_SCHEMA = {
  type: "object",
  properties: {
    ordering_results: {
      type: "array",
      description: "Ordering platform links found in search results",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          platform: { type: "string" }
        }
      }
    }
  }
};
```

### Prompt for Phase 2b

```javascript
const STEP_4_FALLBACK_PROMPT = `Extract online ordering platform links from these Google search results.

Look for:
1. Links to ordering platforms: GloriaFood, ChowNow, Toast, Square Online, Olo, Popmenu
2. Direct links to the restaurant's online ordering page
3. Search results mentioning "order online", "online ordering"

EXCLUDE:
- UberEats links
- DoorDash links
- Grubhub links
- Review sites (Yelp, TripAdvisor)
- Social media

Return the most relevant ordering platform links found.`;
```

### Success Criteria for Phase 2b

- [ ] Fallback triggers only when Phase 2a fails
- [ ] Google search correctly identifies ordering platforms
- [ ] Delivery aggregators (UberEats, DoorDash) are filtered out
- [ ] Combined success rate (2a + 2b) reaches >50%

---

## Combined Phase 2 Schema

**Final schema for repurposed Step 4**:

```javascript
const ORDERING_PLATFORM_SCHEMA = {
  type: "object",
  properties: {
    ordering_platform_url: {
      type: "string",
      description: "Direct URL to the restaurant's online ordering page"
    },
    ordering_platform_name: {
      type: "string",
      description: "Name of the ordering platform (e.g., 'GloriaFood', 'ChowNow', 'Own Website')"
    },
    ordering_source: {
      type: "string",
      enum: ["website", "google_search", "not_found"],
      description: "How the ordering URL was discovered"
    }
  }
};
```

---

## New Utility Module: URL Validation Service

**File to create**: `lead-url-validation-service.js`

```javascript
/**
 * Lead URL Validation and Cleaning Service
 * Handles validation and cleaning of social media and platform URLs
 */

// Instagram URL validation and cleaning
function cleanInstagramUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('instagram.com')) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Reject invalid patterns (reels, posts, stories, etc.)
    const invalidPatterns = ['/reel/', '/p/', '/stories/', '/reels/', '/tv/', '/explore/'];
    if (invalidPatterns.some(p => pathname.includes(p))) {
      console.log(`[URL Validation] Rejected Instagram URL (invalid pattern): ${url}`);
      return null;
    }

    // Extract username from pathname
    const pathParts = pathname.split('/').filter(p => p);
    if (pathParts.length === 0) return null;

    const username = pathParts[0];
    // Validate username format (alphanumeric, dots, underscores)
    if (!/^[a-zA-Z0-9._]+$/.test(username)) return null;

    // Return cleaned URL without query params
    return `https://www.instagram.com/${username}/`;
  } catch (e) {
    console.error(`[URL Validation] Error cleaning Instagram URL: ${e.message}`);
    return null;
  }
}

// Facebook URL validation and cleaning
function cleanFacebookUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('facebook.com')) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Reject invalid patterns (videos, groups, posts, etc.)
    const invalidPatterns = ['/videos/', '/groups/', '/posts/', '/events/', '/photos/', '/watch/', '/gaming/'];
    if (invalidPatterns.some(p => pathname.includes(p))) {
      console.log(`[URL Validation] Rejected Facebook URL (invalid pattern): ${url}`);
      return null;
    }

    // Extract page name from pathname
    const pathParts = pathname.split('/').filter(p => p);
    if (pathParts.length === 0) return null;

    const pageName = pathParts[0];
    // Skip system pages
    const systemPages = ['login', 'help', 'marketplace', 'watch', 'gaming', 'pages', 'profile.php'];
    if (systemPages.includes(pageName.toLowerCase())) return null;

    // Return cleaned URL without query params
    return `https://www.facebook.com/${pageName}/`;
  } catch (e) {
    console.error(`[URL Validation] Error cleaning Facebook URL: ${e.message}`);
    return null;
  }
}

// Review count cleaning - extract integer from various formats
function cleanReviewCount(reviewStr) {
  if (!reviewStr) return null;
  if (typeof reviewStr === 'number') return reviewStr;

  // Remove commas and extract number
  // Handles: "281 Google reviews", "(500+ reviews)", "3,521 reviews"
  const cleaned = String(reviewStr).replace(/,/g, '');
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

module.exports = {
  cleanInstagramUrl,
  cleanFacebookUrl,
  cleanReviewCount
};
```

**Note**: Opening hours are stored directly in the array format from extraction. No normalization is needed during extraction - the schema ensures proper structure. Time format conversion (to 24-hour) and midnight crossing handling should occur during lead-to-restaurant conversion when preparing data for the Pumpd registration system.

---

## Implementation Phases

### Phase 1: Data Cleaning & Validation + Enhanced Step 3 ✅ COMPLETE
1. ✅ Create `lead-url-validation-service.js` with all cleaning/validation functions
2. ✅ Update `processStep3()` to clean google_reviews
3. ✅ Update STEP_3_SCHEMA to include social media URLs
4. ✅ Update STEP_3_PROMPT to extract social links from Knowledge Panel
5. ✅ Add opening hours array format
6. ✅ Update database processing to use new formats

**Files Modified**:
- `lead-scrape-firecrawl-service.js` (STEP_3_SCHEMA, STEP_3_PROMPT, processStep3)
- Created: `lead-url-validation-service.js`

**Result**: Step 3 now successfully extracts social URLs from Google Knowledge Panel

---

### Phase 2a: Website Navigation for Ordering URLs ✅ COMPLETE

**Objective**: Repurpose Step 4 to scrape restaurant websites for ordering platform links

**Tasks**:
1. [x] Update STEP_4_SCHEMA for ordering link extraction
2. [x] Update STEP_4_PROMPT to find ordering buttons/links on websites
3. [x] Implement `processStep4()` with website scraping logic
4. [x] Add platform identification logic (NZ platforms: Bite, Bopple, Bustle, etc.)
5. [x] Add database columns: `ordering_platform_url`, `ordering_platform_name`, `ordering_source`
6. [x] Handle leads without website_url gracefully
7. [x] Test with sample restaurants
8. [x] Add helper functions: `identifyOrderingPlatform()`, `selectBestOrderingLink()`, `isExcludedOrderingDomain()`

**Files Modified**:
- `lead-scrape-firecrawl-service.js` (STEP_4_SCHEMA, STEP_4_PROMPT, processStep4, helper functions)
- Database migration: `add_ordering_platform_columns_to_leads`

**Result**: Step 4 now scrapes restaurant websites for ordering platform links

---

### Phase 2b: Google Search Fallback ⏭️ SKIPPED

**Reason**: Phase 2a website navigation approach is sufficient for ordering platform discovery. Google search fallback adds complexity without significant benefit since most restaurants with online ordering have it on their website.

---

### Phase 3: Frontend Updates & Step Naming 🔄 IN PROGRESS

**Objective**: Update frontend to display ordering platform fields and rename Step 4

**Tasks**:
1. [ ] Update Step 4 naming from "Social Media Discovery" to "Ordering Platform Discovery"
2. [ ] Update `ScrapeJobStepDetailModal.tsx` to display ordering platform fields
3. [ ] Update `LeadDetailModal.tsx` to display ordering platform fields
4. [ ] Update any step configuration/constants that reference Step 4 name

**Files to Modify**:
- `ScrapeJobStepDetailModal.tsx` - Add ordering platform URL, name, source display
- `LeadDetailModal.tsx` - Add ordering platform fields to lead details
- Step configuration files (if any) - Update Step 4 name

**Success Metric**: Ordering platform data visible in UI for processed leads

---

## Testing Plan

### Test Cases for URL Cleaning

| Input | Expected Output | Test Status |
|-------|-----------------|-------------|
| `https://www.instagram.com/restaurant/?hl=en` | `https://www.instagram.com/restaurant/` | |
| `https://www.instagram.com/reel/ABC123/` | `null` | |
| `https://www.instagram.com/p/ABC123/` | `null` | |
| `https://www.instagram.com/stories/restaurant/` | `null` | |
| `https://www.facebook.com/restaurant/` | `https://www.facebook.com/restaurant/` | |
| `https://www.facebook.com/restaurant/videos/123` | `null` | |
| `https://www.facebook.com/groups/123/posts/456` | `null` | |
| `281 Google reviews` | `281` | |
| `(500+ reviews)` | `500` | |
| `3,521 reviews` | `3521` | |

### Test Cases for Opening Hours (Array Format)

| Scenario | Expected Extraction |
|----------|---------------------|
| Single hours per day | `[{day: "Monday", open: "11:30 AM", close: "9:30 PM"}, ...]` |
| Day closed | No entry for that day in array |
| Split hours (lunch/dinner) | `[{day: "Friday", open: "11:30 AM", close: "2:30 PM", period: "Lunch"}, {day: "Friday", open: "5:00 PM", close: "10:00 PM", period: "Dinner"}]` |
| Midnight crossing | `[{day: "Friday", open: "5:00 PM", close: "2:00 AM"}]` (stored as displayed) |

---

## Database Considerations

### Column Changes Needed

1. **`opening_hours`** - Change from object with day keys to array format
   - Current: `{"monday": "11:30 AM - 9:30 PM", "tuesday": "Closed", ...}`
   - New: `[{day: "Monday", open: "11:30 AM", close: "9:30 PM"}, ...]`
   - JSONB column can store either format, no schema migration needed
   - Existing data will work but new extractions will use array format

2. **`google_number_of_reviews`** - Ensure stored as integer, not text
   - May need migration to clean existing data

3. **`opening_hours_text`** - Can remain but stop populating
   - No database migration needed

---

## Success Criteria

### Phase 1 Success ✅ COMPLETE
- [x] All Instagram URLs are cleaned (query params removed)
- [x] Reel/post/story Instagram URLs are rejected
- [x] Video/group/post Facebook URLs are rejected
- [x] Google review counts stored as integers
- [x] Opening hours stored in array format: `[{day, open, close, period?}, ...]`
- [x] Split hours (lunch/dinner) correctly captured with period field
- [x] `opening_hours_text` no longer populated
- [x] Social URLs (Instagram/Facebook) extracted from Step 3 Google Knowledge Panel

### Phase 2a Success (Website Navigation) ✅ COMPLETE
- [x] `processStep4()` refactored to scrape restaurant websites for ordering links
- [x] Ordering links correctly extracted from website headers, footers, hero sections
- [x] Platform identification correctly identifies NZ platforms: Bite, Bopple, Bustle, Gloriafood, Mobi2Go, etc.
- [x] UberEats/DoorDash/Menulog/DeliverEasy links are correctly filtered out
- [x] Leads without `website_url` handled gracefully (marked processed with null ordering URL)
- [x] Helper functions implemented: `identifyOrderingPlatform()`, `selectBestOrderingLink()`, `isExcludedOrderingDomain()`

### Phase 2b Success (Google Search Fallback) ⏭️ SKIPPED
- N/A - Phase 2a website navigation is sufficient

### Phase 3 Success (Frontend Updates)
- [x] Step 4 renamed from "Social Media Discovery" to "Ordering Platform Discovery"
- [x] `ScrapeJobStepDetailModal.tsx` displays ordering platform fields
- [x] `LeadDetailModal.tsx` displays ordering platform fields (URL, name, source)
- [x] Ordering platform data visible for processed Step 4 leads

### Overall Success
- [x] Ordering platform URL extracted from restaurant websites
- [x] Platform name correctly identified
- [x] `ordering_source` field correctly indicates discovery method (website/google_search/not_found)
