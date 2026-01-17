# Current State Analysis

## Concurrency Control Patterns Found

### ✅ Pattern 1: Correct Promise.race Implementation

**Locations:**
- `server.js:380-409` - Batch extraction categories
- `option-sets-extraction-service.js:346-386` - Option sets extraction

**Code Pattern:**
```javascript
while (processingQueue.length > 0 || activePromises.size > 0) {
  // Fill slots up to concurrency limit
  while (processingQueue.length > 0 && activePromises.size < concurrencyLimit) {
    const item = processingQueue.shift();
    const promise = processItem(item);
    activePromises.set(itemId, promise);

    // Remove from active when complete
    promise.then(() => {
      activePromises.delete(itemId);
    }).catch(() => {
      activePromises.delete(itemId);
    });
  }

  // Wait for ANY to complete (releases slot immediately)
  if (activePromises.size > 0) {
    await Promise.race(activePromises.values());
  }
}
```

**Why This Works:**
- Starts new request as soon as ANY active request completes
- Optimal slot utilization
- If request times are [5s, 30s], new request starts after 5s (not 30s)

**Performance:** ✅ Optimal

---

### ❌ Pattern 2: Broken Promise.all Batching

**Locations:**
- `premium-extraction-service.js:464-501` - **Phase 2 category extraction**
- `uploadcare-service.js:266-311` - Image uploads (out of scope)

**Code Pattern:**
```javascript
// Process categories in batches
for (let i = 0; i < categories.length; i += concurrencyLimit) {
  const batch = categories.slice(i, i + concurrencyLimit);
  const batchPromises = batch.map(category => processCategory(category));

  // ❌ Waits for ALL in batch before starting next batch
  const batchResults = await Promise.all(batchPromises);

  // Process results...
}
```

**Why This Fails:**
- Waits for ALL requests in batch to complete before starting next batch
- Blocks available slots unnecessarily
- If batch has [5s, 30s] requests, waits 30s before starting next batch
- Next request could have started after 5s with Promise.race

**Performance Impact:**
- Example: 6 categories with times [5s, 25s, 6s, 20s, 7s, 22s]
- Current (Promise.all): 25s + 22s = **47 seconds total**
- Optimal (Promise.race): 5s + 6s + 7s + 20s + 22s + 25s / 2 slots ≈ **29 seconds total**
- **Performance loss: ~40%**

---

## Rate Limiting Status

### Current Implementation

**Status:** ❌ **NO RATE LIMITING EXISTS**

**Only Evidence Found:**
```javascript
// firecrawl-service.js:1063
console.log('Adding 2-second delay to avoid rate limits...');
await new Promise(resolve => setTimeout(resolve, 2000));
```

This is:
- A single 2-second static delay
- Only in one location
- Not systematic rate limiting
- Insufficient for 10 requests/minute limit

### Why Rate Limiting is Critical

**Math:**
```
Scenario: 60 items with 6-second responses, concurrency=2

Without rate limiting:
- 2 concurrent requests completing every 6 seconds
- 2 requests / 6 seconds = 20 requests/minute
- Firecrawl limit: 10 requests/minute
- Result: 2x OVER LIMIT → 402/429 errors

With rate limiting:
- Track requests in last 60 seconds
- Delay request if count >= 10
- Ensures ≤ 10 requests/minute
- Result: ZERO errors
```

---

## Hardcoded Values Requiring Configuration

### Current Hardcoded Values

| File | Line | Value | Description |
|------|------|-------|-------------|
| `premium-extraction-service.js` | 465 | `const concurrencyLimit = 2` | Phase 2 category extraction |
| `premium-extraction-service.js` | 520 | `2` | Passed to option sets service |
| `server.js` | 207 | `const concurrencyLimit = 2` | Batch extraction |
| `option-sets-extraction-service.js` | 253 | `concurrencyLimit = 2` | Function parameter default |

**Problem:** When Firecrawl plan is upgraded:
- Must manually change 4+ locations in code
- Risk of missing a location
- Requires code deployment for simple config change

**Solution:** Environment variables

---

## Firecrawl API Call Locations

All locations making Firecrawl API calls that need rate limiting:

### 1. Premium Extraction Service
**File:** `src/services/premium-extraction-service.js`

**Phase 1 - Category Extraction:**
- Line 66: `axios.post(${this.firecrawlApiUrl}/v2/scrape, ...)`
- Frequency: 1 call per extraction
- Timeout: 60,000ms (60s)

**Phase 2 - Category Items Extraction:**
- Line 166: `axios.post(${this.firecrawlApiUrl}/v2/scrape, ...)`
- Frequency: N calls (N = number of categories, typically 5-10)
- Timeout: 90,000ms (90s)
- **Uses BROKEN concurrency pattern** (Promise.all batching)

### 2. Option Sets Extraction Service
**File:** `src/services/option-sets-extraction-service.js`

**Phase 4 - Option Sets Extraction:**
- Line 186: `axios.post(${this.firecrawlApiUrl}/v2/scrape, ...)`
- Frequency: M calls (M = number of items, typically 50-100+)
- Timeout: 90,000ms (90s)
- **Uses CORRECT concurrency pattern** (Promise.race)
- **PRIMARY SOURCE OF 402/429 ERRORS** (high volume, no rate limiting)

### 3. Server Batch Extraction
**File:** `server.js`

**Batch Category Extraction:**
- Line ~300: Firecrawl API calls in batch processing
- Uses CORRECT concurrency pattern (Promise.race)
- Needs rate limiting added

---

## Current .env Configuration

```bash
# Existing Firecrawl Config
FIRECRAWL_API_KEY=fc-e50a849f87df45bd8d81b472586cff64
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_CACHE_MAX_AGE=172800

# ❌ MISSING - Need to add:
# FIRECRAWL_CONCURRENCY_LIMIT=2
# FIRECRAWL_RATE_LIMIT=10
# FIRECRAWL_RATE_WINDOW=60000
```

---

## Summary of Issues

1. **No rate limiting** - Primary cause of 402/429 errors
2. **Broken concurrency in Phase 2** - ~40% performance loss
3. **Hardcoded limits** - Difficult to upgrade plan
4. **No systematic tracking** - Can't monitor API usage

## What's Working

1. ✅ Phase 4 concurrency control (Promise.race pattern)
2. ✅ Server batch extraction concurrency (Promise.race pattern)
3. ✅ Option sets extraction logic (just needs rate limiting)
