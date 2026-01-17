# Google Search vs Lead Scraping - Technical Comparison

This document compares the extraction methods, validation logic, and architecture between the **Google Business Search** feature (used in RestaurantDetail) and the **Lead Scraping** service (5-step pipeline for discovering new restaurants).

---

## Executive Summary

| Aspect | Google Search | Lead Scraping |
|--------|---------------|---------------|
| **Purpose** | Enrich existing restaurant data | Discover and qualify new restaurant leads |
| **Data Sources** | UberEats, Website, Google (via Firecrawl) | UberEats, Google, Website (via Firecrawl) |
| **User Flow** | Single action with confirmation dialogs | 5-step pipeline with manual progression |
| **Phone Extraction** | Website only (UberEats excluded) | Google Business (NZ/AU patterns) |
| **Hours Processing** | Day range expansion + midnight crossing | Stored as-is from AI extraction |
| **URL Validation** | Shared `lead-url-validation-service.js` | Same + additional chain exclusion |
| **Rate Limiting** | Basic retry on 429 | Sliding window token bucket (10 req/min) |

---

## 1. Architecture Comparison

### Google Search Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Single Endpoint System                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  POST /api/google-business-search                                    │
│    ├── urlsOnly=true    → Phase 1: URL Discovery                    │
│    ├── previewOnly=true → Phase 2: Content Extraction               │
│    └── (default)        → Legacy: Auto-save mode                    │
│                                                                      │
│  POST /api/google-business-search/save                               │
│    └── Saves user-selected fields to database                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Files:
- server.js (lines 5160-6252)
- RestaurantDetail.jsx (lines 104-130, 1693-1962)
- lead-url-validation-service.js
```

### Lead Scraping Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      5-Step Pipeline System                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: Category Page Scan (UberEats)                              │
│    └── Extracts restaurant names + store URLs                        │
│                                                                      │
│  Step 2: Store Page Enrichment (UberEats)                           │
│    └── Reviews, ratings, address, cuisine, price                     │
│                                                                      │
│  Step 3: Google Business Lookup                                      │
│    └── Phone, website, hours, socials, Google rating                 │
│                                                                      │
│  Step 4: Ordering Platform Discovery                                 │
│    └── Identifies online ordering platforms on website               │
│                                                                      │
│  Step 5: Contact Enrichment                                          │
│    └── Owner/manager contact details                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Files:
- lead-scrape-service.js (orchestration)
- lead-scrape-firecrawl-service.js (extraction)
- lead-url-validation-service.js (validation)
- lead-scrape-routes.js (API endpoints)
- leads-routes.js (lead management)
```

---

## 2. URL Discovery Comparison

### Google Search URL Discovery

**Method:** Single combined Firecrawl search query

```javascript
// Location: server.js line 5237
const combinedQuery = `${restaurantName} ${city} ${searchCountry} (website OR ubereats OR doordash OR delivereasy OR facebook OR instagram OR menu OR order online)`;
```

**Platforms Searched:**
- UberEats
- DoorDash
- Facebook
- Instagram
- Website (restaurant's own)
- MeAndU, Mobi2Go, DeliverEasy, NextOrder, FoodHub, OrderMeal

**URL Categorization:** (server.js lines 5268-5316)
- First match wins per platform
- Excludes aggregator sites from website detection:
  - google, yelp, tripadvisor, menulog, zomato, grabone
  - firsttable, tiktok, youtube, myguide, neatplaces
  - wanderlog, stuff.co.nz, bookme, reddit, thespinoff

### Lead Scraping URL Discovery

**Method:** Structured UberEats category page scraping

```javascript
// Location: lead-scrape-service.js line 54-56
`https://www.ubereats.com/${country}/category/${cityCode}-${regionCode}/${cuisine}?page=${pageOffset}`
```

**Platforms Searched:**
- **Step 1**: UberEats only (category pages)
- **Step 3**: Google Business Profile (for phone, hours, socials)
- **Step 4**: Restaurant website (for ordering platforms)

**Chain Exclusion:** (lead-scrape-firecrawl-service.js lines 28-92)
- 80+ excluded fast food chain patterns:
  - McDonald's, Burger King, KFC, Subway, Taco Bell
  - Nando's, Domino's, Pizza Hut, Wendy's
  - Coffee Club, Dunkin', Shake Shout, Hell Pizza, etc.

**Key Difference:** Lead scraping has chain exclusion; Google Search does not.

---

## 3. Phone Number Extraction Comparison

### Google Search Phone Extraction

**Source:** Website only (UberEats explicitly excluded)

```javascript
// Location: server.js line 5521
{ url: foundUrls.ubereatsUrl, extractPhone: false, extractAddress: true, extractHours: true }

// Location: server.js line 5526
{ url: foundUrls.websiteUrl, extractPhone: true, extractAddress: true, extractHours: true }
```

**Validation Pattern:** (server.js lines 5679-5698)
```javascript
const validPatterns = [
  /^\+64[2-9]\d{7,9}$/,    // +64 mobile/landline
  /^0[3-9]\d{7}$/,         // 0X landline
  /^02[0-9]\d{7,8}$/,      // 02X mobile
  /^0800\d{6,7}$/,         // 0800 numbers
  /^0508\d{6}$/            // 0508 numbers
];
```

**Formatting:** Normalizes to E.164 format (+64...)

### Lead Scraping Phone Extraction

**Source:** Google Business Profile (Step 3)

**Schema:** (lead-scrape-firecrawl-service.js lines 210-255)
```javascript
phone: {
  type: "string",
  description: "Business phone number in local format"
}
```

**Prompt:** (line 257-290)
```
PHONE NUMBER - Business phone in local format (with area code, e.g., +64 or 0X for NZ, +61 for AU)
```

**Validation Pattern:** (line 1521)
```javascript
phone: (val) => !val || /^(\+64|0|\+61)[0-9\s\-]{8,15}$/.test(val.replace(/\s/g, ''))
```

**Formatting:** Stored as extracted (spaces/hyphens preserved)

### Comparison Table: Phone Extraction

| Aspect | Google Search | Lead Scraping |
|--------|---------------|---------------|
| Source | Website only | Google Business |
| NZ Support | ✅ Comprehensive | ✅ Basic |
| AU Support | ❌ No | ✅ Yes (+61) |
| 0800/0508 | ✅ Yes | ❌ Not explicitly |
| E.164 Formatting | ✅ Auto-converts | ❌ No |
| Preserves Format | ❌ Normalizes | ✅ Yes |

**Recommendation:** Google Search has better NZ validation but lacks AU support. Consider adding AU patterns to Google Search.

---

## 4. Address Extraction Comparison

### Google Search Address Extraction

**Sources:** UberEats (priority) → Website (fallback)

**Schema:** (server.js lines 5485-5510)
```javascript
address: { type: 'string' }
```

**Validation:** (server.js lines 5709-5714)
```javascript
// Reject numbers-only addresses (like DoorDash IDs)
if (!/^\d+$/.test(jsonData.address)) {
  extractedData.address = jsonData.address;
}
```

**Multi-Source:** Yes - stores by source in `extractedBySource`

### Lead Scraping Address Extraction

**Sources:** UberEats (Step 2) + Google (Step 3)

**Schemas:**
```javascript
// Step 2 - UberEats
address: { type: "string", description: "Full street address of the restaurant" }

// Step 3 - Google
google_address: { type: "string", description: "Business address from Google Business Profile" }
```

**Storage:** Separate fields: `ubereats_address` and `google_address`

**Fallback Chain:** (line 1253)
```javascript
ubereats_address || google_address
```

### Comparison Table: Address Extraction

| Aspect | Google Search | Lead Scraping |
|--------|---------------|---------------|
| Sources | UberEats, Website | UberEats, Google |
| Multi-Source Storage | ✅ extractedBySource | ✅ Separate columns |
| Validation | Rejects numbers-only | None |
| Normalization | None | None |
| User Selection | ✅ Dialog | ❌ Auto fallback |

---

## 5. Opening Hours Extraction Comparison

### Google Search Hours Extraction

**Schema:** (server.js lines 5469-5480)
```javascript
openingHours: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      day: { type: 'string' },
      open: { type: 'string' },
      close: { type: 'string' },
      closed: { type: 'boolean' }
    }
  }
}
```

**Post-Processing:**

1. **Day Range Expansion:** (lines 5643-5660)
   - "Monday-Saturday" → Expands to 6 separate entries

2. **"Every Day" Handling:** (lines 5628-5642)
   - "Every day" / "Daily" → Expands to all 7 days

3. **Midnight Crossing:** (lines 5809-5841)
   - If close < open: Split into two entries
   - Day 1: 11:00 → 23:59
   - Day 2: 00:00 → 02:00

4. **24-Hour Conversion:** Uses `convertTo24Hour()` function

### Lead Scraping Hours Extraction

**Schema:** (lead-scrape-firecrawl-service.js lines 221-232)
```javascript
openingHours: {
  type: "array",
  items: {
    type: "object",
    properties: {
      day: { type: "string" },
      open: { type: "string" },
      close: { type: "string" },
      period: { type: "string" }  // Optional: Lunch or Dinner
    }
  }
}
```

**Prompt:** (lines 267-290)
```
OPENING HOURS - Extract hours for each day exactly as shown.
- If the page shows continuous hours, return single entry per day.
- Only create separate entries if there is an explicit gap/break shown.
- Use "period" field ONLY for multiple time slots (Lunch, Dinner).
- If a day shows "Closed", do not include an entry for that day.
```

**Post-Processing:** None - stored as-is from AI extraction

### Comparison Table: Opening Hours

| Aspect | Google Search | Lead Scraping |
|--------|---------------|---------------|
| Day Range Expansion | ✅ Yes | ❌ No |
| "Every Day" Handling | ✅ Yes | ❌ No |
| Midnight Crossing | ✅ Split into 2 entries | ❌ No |
| 24-Hour Conversion | ✅ Yes | ❌ No |
| Split Hours (Lunch/Dinner) | ✅ Yes | ✅ Yes (period field) |
| Closed Day Handling | ✅ Omits entry | ✅ Omits entry |
| Time Format Normalization | ✅ HH:MM | ❌ As extracted |

**Recommendation:** Google Search has significantly better hours processing. Consider porting this logic to lead scraping for consistency.

---

## 6. URL Validation Comparison

### Shared Service

Both systems use `lead-url-validation-service.js`:

**Instagram Validation:** (`cleanInstagramUrl`)
- Rejects: /reel/, /p/, /stories/, /reels/, /tv/, /explore/
- Returns: Clean profile URL only

**Facebook Validation:** (`cleanFacebookUrl`)
- Rejects: /videos/, /groups/, /posts/, /events/, /photos/, /watch/
- Handles: /p/ profile format, profile.php?id= format

**Website Validation:** (`cleanWebsiteUrl`)
- Rejects delivery platforms: ubereats, doordash, delivereasy, menulog, grubhub, postmates, skip, deliveroo, foodora

### Additional Lead Scraping Validators

**Step-Specific Validators:** (lead-scrape-firecrawl-service.js lines 1504-1567)

| Step | Field | Validation |
|------|-------|------------|
| 1 | store_link | Must include 'ubereats.com' and '/store/' |
| 2 | ubereats_average_review_rating | 0-5 range |
| 2 | ubereats_cuisine | Must be array |
| 3 | phone | NZ/AU phone regex |
| 3 | website_url | Must start with 'http' |
| 4 | instagram_url | Must include 'instagram.com' |
| 4 | facebook_url | Must include 'facebook.com' |
| 5 | contact_email | Valid email regex |

### Excluded Chains (Lead Scraping Only)

Lead scraping has 80+ excluded fast food chain patterns that Google Search lacks.

---

## 7. Error Handling Comparison

### Google Search Error Handling

**Rate Limiting:** (server.js lines 5318-5370)
```javascript
if (err.response?.status === 429) {
  // Wait 2 seconds and retry with simpler query
  await new Promise(resolve => setTimeout(resolve, 2000));
  // Single retry attempt
}
```

**Error Propagation:**
- Single try/catch block
- Returns 500 status on failure
- No automatic retry for non-429 errors

### Lead Scraping Error Handling

**Rate Limiting:** (`rate-limiter-service.js`)
- Sliding window token bucket algorithm
- Default: 10 requests per 60 seconds
- Configurable via env variables
- Tracks request timestamps in window
- Auto-waits when at capacity

**Retry Logic:** (lead-scrape-firecrawl-service.js lines 490-537)
```javascript
const maxRetries = options.maxRetries || 3;
const retryDelay = options.retryDelay || 5000;

// Exponential backoff: retryDelay * (attempt + 1)
// Retry on: TIMEOUT, 429, ECONNRESET, 5xx errors
```

**Per-Lead Error Handling:**
- Each lead tracked independently
- Failed leads can be retried
- Validation errors stored in JSONB array
- Batch processing continues despite individual failures

### Comparison Table: Error Handling

| Aspect | Google Search | Lead Scraping |
|--------|---------------|---------------|
| Rate Limiting | Basic (wait + single retry) | Advanced (sliding window) |
| Max Retries | 1 (for 429 only) | 3 (configurable) |
| Backoff Strategy | Fixed 2s | Exponential |
| 5xx Handling | ❌ No retry | ✅ Retry |
| Timeout Handling | ❌ No retry | ✅ Retry |
| Partial Failure | ❌ All-or-nothing | ✅ Per-lead tracking |

**Recommendation:** Google Search should adopt lead scraping's error handling patterns, especially the retry logic and rate limiter service.

---

## 8. API Integration Comparison

### Google Search Firecrawl Usage

**Endpoints Used:**
- POST `/v2/search` - URL discovery
- POST `/v2/scrape` - Content extraction

**Request Format:**
```javascript
{
  url: string,
  formats: [{
    type: 'json',
    prompt: string,
    schema: object
  }],
  onlyMainContent: true,
  waitFor: number
}
```

### Lead Scraping Firecrawl Usage

**Endpoints Used:**
- POST `/v2/scrape` - All steps

**Request Format:**
```javascript
{
  url: string,
  formats: [{
    type: 'json',
    prompt: string,
    schema: object
  }],
  waitFor: 4000,
  onlyMainContent: true,
  removeBase64Images: true
}
```

**Additional Features:**
- Concurrency limiting (5 parallel max)
- Usage tracking per request
- Centralized `firecrawlRequest()` helper function

---

## 9. Feature Comparison Matrix

| Feature | Google Search | Lead Scraping |
|---------|---------------|---------------|
| **Purpose** | Enrich existing restaurant | Discover new leads |
| **User Confirmation** | ✅ 2 dialogs | ❌ Auto-process per step |
| **Multi-Source Selection** | ✅ Per-field | ❌ Fixed fallback chain |
| **Preview Mode** | ✅ Yes | ❌ No |
| **Batch Processing** | ❌ Single restaurant | ✅ Multiple leads |
| **Chain Exclusion** | ❌ No | ✅ 80+ patterns |
| **Review Count** | ❌ Not extracted | ✅ `cleanReviewCount()` |
| **Contact Info** | ❌ Not extracted | ✅ Step 5 |
| **Ordering Platforms** | ❌ Not extracted | ✅ Step 4 |
| **Usage Tracking** | ✅ Per search | ✅ Per API call |
| **Feature Flags** | ✅ googleSearchExtraction | ✅ leadScraping.* |

---

## 10. Recommendations for Consolidation

### High Priority

1. **Adopt Lead Scraping's Rate Limiter**
   - Google Search should use `rate-limiter-service.js`
   - More robust than current 429 handling

2. **Port Opening Hours Processing to Lead Scraping**
   - Day range expansion
   - Midnight crossing handling
   - 24-hour format normalization

3. **Add AU Phone Support to Google Search**
   - Add `+61` pattern support
   - Match lead scraping's flexibility

### Medium Priority

4. **Consider Chain Exclusion for Google Search**
   - May not be needed (existing restaurants are qualified)
   - But could prevent enriching with wrong data

5. **Add Review Count to Google Search**
   - Lead scraping has `cleanReviewCount()`
   - Could be useful for existing restaurants

6. **Standardize Phone Storage Format**
   - Decide: E.164 (Google Search) vs Original format (Lead Scraping)
   - Recommend: E.164 for consistency

### Low Priority

7. **Consolidate Extraction Service**
   - Create shared extraction helpers
   - Reduce code duplication

8. **Add Ordering Platform Detection to Google Search**
   - Lead scraping Step 4 has comprehensive detection
   - Could enrich existing restaurant data

---

## 11. Code Locations Reference

### Google Search Files

| File | Lines | Content |
|------|-------|---------|
| `server.js` | 5160-6061 | Main search endpoint |
| `server.js` | 6063-6252 | Save endpoint |
| `RestaurantDetail.jsx` | 104-130 | State variables |
| `RestaurantDetail.jsx` | 1693-1962 | Handler functions |
| `lead-url-validation-service.js` | All | Shared validation |

### Lead Scraping Files

| File | Lines | Content |
|------|-------|---------|
| `lead-scrape-service.js` | All | Business logic orchestration |
| `lead-scrape-firecrawl-service.js` | 118-152 | Step 1 schema |
| `lead-scrape-firecrawl-service.js` | 158-204 | Step 2 schema |
| `lead-scrape-firecrawl-service.js` | 210-290 | Step 3 schema |
| `lead-scrape-firecrawl-service.js` | 296-335 | Step 4 schema |
| `lead-scrape-firecrawl-service.js` | 404-443 | Step 5 schema |
| `lead-scrape-firecrawl-service.js` | 458-541 | Firecrawl request helper |
| `lead-scrape-firecrawl-service.js` | 1504-1567 | Validation rules |
| `lead-scrape-firecrawl-service.js` | 28-92 | Excluded chains |
| `rate-limiter-service.js` | All | Rate limiting |
| `lead-url-validation-service.js` | All | URL validation |
| `lead-scrape-routes.js` | All | API routes |
| `leads-routes.js` | All | Lead management routes |

---

## 12. Database Tables Comparison

### Google Search Tables

| Table | Purpose |
|-------|---------|
| `restaurant_workflows` | Stores enriched restaurant data |

### Lead Scraping Tables

| Table | Purpose |
|-------|---------|
| `lead_scrape_jobs` | Job configuration and status |
| `lead_scrape_job_steps` | Step progress tracking |
| `leads` | Extracted lead data |
| `ubereats_cuisines` | Cuisine reference data |
| `city_codes` | City/region mapping |

---

*Document generated: 2025-12-13*
*Based on codebase analysis by parallel investigation agents*
