# Implementation Plan

## Overview

This plan addresses all identified issues in priority order:
1. Create rate limiter service
2. Fix Phase 2 concurrency pattern
3. Make all limits configurable via .env
4. Apply rate limiting to all Firecrawl calls
5. Add logging for visibility

## Implementation Steps

---

## Step 1: Add Environment Variables

**File:** `UberEats-Image-Extractor/.env`

**Action:** Add new configuration variables

```bash
# Add these lines to .env

# Firecrawl API Limits
FIRECRAWL_CONCURRENCY_LIMIT=2     # Max simultaneous requests
FIRECRAWL_RATE_LIMIT=10           # Max requests per minute
FIRECRAWL_RATE_WINDOW=60000       # Rate limit window in milliseconds (60 seconds)
```

**Notes:**
- These are current limits; can be increased when plan upgrades
- `RATE_WINDOW` is configurable for flexibility (default 60000ms = 1 minute)

**Time Estimate:** 2 minutes

---

## Step 2: Create Rate Limiter Service

**File:** `UberEats-Image-Extractor/src/services/rate-limiter-service.js` (NEW FILE)

**Action:** Create reusable rate limiting service

### Implementation Details

**Algorithm:** Token Bucket with Sliding Window
- Maintains array of request timestamps
- Checks count in last N milliseconds (sliding window)
- Delays request if limit would be exceeded
- Automatically cleans up old timestamps

### Code Structure

```javascript
class RateLimiterService {
  constructor() {
    // Load from env with defaults
    this.rateLimit = parseInt(process.env.FIRECRAWL_RATE_LIMIT) || 10;
    this.rateLimitWindow = parseInt(process.env.FIRECRAWL_RATE_WINDOW) || 60000;

    // Track request timestamps
    this.requestTimestamps = [];
  }

  /**
   * Wait if necessary to respect rate limit, then record request
   * @param {string} identifier - Optional identifier for logging
   */
  async acquireSlot(identifier = 'request') {
    // Clean up old timestamps outside window
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > windowStart);

    // Check if at limit
    if (this.requestTimestamps.length >= this.rateLimit) {
      // Calculate wait time
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + this.rateLimitWindow - now;

      if (waitTime > 0) {
        console.log(`[Rate Limiter] At limit (${this.requestTimestamps.length}/${this.rateLimit}), waiting ${Math.ceil(waitTime/1000)}s for "${identifier}"`);
        await this.sleep(waitTime);

        // Clean up again after waiting
        const newNow = Date.now();
        const newWindowStart = newNow - this.rateLimitWindow;
        this.requestTimestamps = this.requestTimestamps.filter(t => t > newWindowStart);
      }
    }

    // Record this request
    this.requestTimestamps.push(Date.now());

    // Log current usage
    console.log(`[Rate Limiter] Request started: ${this.requestTimestamps.length}/${this.rateLimit} in last ${this.rateLimitWindow/1000}s`);
  }

  /**
   * Get current rate limit usage
   */
  getCurrentUsage() {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    const activeRequests = this.requestTimestamps.filter(t => t > windowStart);

    return {
      current: activeRequests.length,
      limit: this.rateLimit,
      window: this.rateLimitWindow,
      percentage: (activeRequests.length / this.rateLimit) * 100
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.requestTimestamps = [];
  }
}

// Export singleton
module.exports = new RateLimiterService();
```

### Key Features
- ✅ Sliding window (more accurate than fixed windows)
- ✅ Automatic cleanup of old timestamps
- ✅ Detailed logging
- ✅ Configurable via .env
- ✅ Thread-safe for async operations
- ✅ Simple API: just call `await rateLimiter.acquireSlot(identifier)` before each request

**Time Estimate:** 30 minutes

---

## Step 3: Fix Phase 2 Concurrency Pattern

**File:** `UberEats-Image-Extractor/src/services/premium-extraction-service.js`

**Action:** Replace Promise.all batching with Promise.race pattern

**Lines to Change:** 464-501

### Current Code (BROKEN)
```javascript
// Process categories with concurrency control
const concurrencyLimit = 2;
const categoryResults = [];

// Helper function to process a single category
const processCategory = async (category) => {
  try {
    const categoryItems = await this.extractCategoryItems(storeUrl, category, orgId);
    jobInfo.progress.itemsExtracted = allItems.length + categoryItems.length;
    jobInfo.progress.currentCategory = category;
    return { category, items: categoryItems, success: true };
  } catch (error) {
    console.error(`[${orgId}] Error extracting category "${category}":`, error.message);
    return { category, items: [], success: false, error: error.message };
  }
};

// ❌ Process categories in batches
for (let i = 0; i < categories.length; i += concurrencyLimit) {
  const batch = categories.slice(i, i + concurrencyLimit);
  const batchPromises = batch.map(category => processCategory(category));

  try {
    const batchResults = await Promise.all(batchPromises); // ❌ Waits for all
    categoryResults.push(...batchResults);

    // Collect successful items
    for (const result of batchResults) {
      if (result.success) {
        allItems = allItems.concat(result.items);
      }
    }

    console.log(`[${orgId}] Completed batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(categories.length/concurrencyLimit)}, total items: ${allItems.length}`);
  } catch (error) {
    console.error(`[${orgId}] Error processing batch:`, error);
  }
}
```

### New Code (FIXED)
```javascript
// Process categories with concurrency control
const concurrencyLimit = parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;
const categoryResults = [];
const processingQueue = [...categories];
const activePromises = new Map();

// Helper function to process a single category
const processCategory = async (category) => {
  try {
    const categoryItems = await this.extractCategoryItems(storeUrl, category, orgId);
    jobInfo.progress.itemsExtracted = allItems.length + categoryItems.length;
    jobInfo.progress.currentCategory = category;
    return { category, items: categoryItems, success: true };
  } catch (error) {
    console.error(`[${orgId}] Error extracting category "${category}":`, error.message);
    return { category, items: [], success: false, error: error.message };
  }
};

// ✅ Process categories with Promise.race pattern
while (processingQueue.length > 0 || activePromises.size > 0) {
  // Start new processes up to the concurrency limit
  while (processingQueue.length > 0 && activePromises.size < concurrencyLimit) {
    const category = processingQueue.shift();
    const promise = processCategory(category);
    const categoryId = `${category}_${Date.now()}`;
    activePromises.set(categoryId, promise);

    // Handle promise completion
    promise.then((result) => {
      activePromises.delete(categoryId);
      categoryResults.push(result);

      // Collect successful items
      if (result.success) {
        allItems = allItems.concat(result.items);
      }

      // Progress update
      console.log(`[${orgId}] Category "${result.category}" complete: ${result.items?.length || 0} items (${categoryResults.length}/${categories.length} categories done)`);
    }).catch((error) => {
      activePromises.delete(categoryId);
      console.error(`[${orgId}] Unexpected error in category processing:`, error);
    });
  }

  // Wait for at least one to complete if we have active promises
  if (activePromises.size > 0) {
    await Promise.race(activePromises.values());
  }
}
```

### Changes Made
1. ✅ Use `processingQueue` instead of batch slicing
2. ✅ Use `activePromises` Map to track concurrent requests
3. ✅ Use `Promise.race` to wait for ANY to complete (not all)
4. ✅ Read concurrency limit from env variable
5. ✅ Improved logging with progress

**Time Estimate:** 30 minutes

---

## Step 4: Apply Rate Limiting to Premium Extraction Service

**File:** `UberEats-Image-Extractor/src/services/premium-extraction-service.js`

**Action:** Add rate limiter import and apply to both extraction methods

### Add Import (Top of File)
```javascript
const rateLimiter = require('./rate-limiter-service');
```

### Apply to Phase 1 - Category Extraction

**Location:** Line ~66 (inside `extractCategories` method)

**Before:**
```javascript
try {
  const response = await axios.post(
    `${this.firecrawlApiUrl}/v2/scrape`,
    {
      url: storeUrl,
      formats: [{ type: 'json', schema: schema, prompt: prompt }],
      // ... options
    },
    {
      headers: {
        'Authorization': `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
```

**After:**
```javascript
try {
  // Wait for rate limiter approval
  await rateLimiter.acquireSlot(`categories-${orgId}`);

  const response = await axios.post(
    `${this.firecrawlApiUrl}/v2/scrape`,
    {
      url: storeUrl,
      formats: [{ type: 'json', schema: schema, prompt: prompt }],
      // ... options
    },
    {
      headers: {
        'Authorization': `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
```

### Apply to Phase 2 - Category Items Extraction

**Location:** Line ~166 (inside `extractCategoryItems` method)

**Before:**
```javascript
try {
  const response = await axios.post(
    `${this.firecrawlApiUrl}/v2/scrape`,
    {
      url: storeUrl,
      formats: [{ type: 'json', schema: schema, prompt: prompt }],
      // ... options
    },
    {
      headers: {
        'Authorization': `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
```

**After:**
```javascript
try {
  // Wait for rate limiter approval
  await rateLimiter.acquireSlot(`category-items-${categoryName}-${orgId}`);

  const response = await axios.post(
    `${this.firecrawlApiUrl}/v2/scrape`,
    {
      url: storeUrl,
      formats: [{ type: 'json', schema: schema, prompt: prompt }],
      // ... options
    },
    {
      headers: {
        'Authorization': `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
```

**Time Estimate:** 15 minutes

---

## Step 5: Apply Rate Limiting to Option Sets Service

**File:** `UberEats-Image-Extractor/src/services/option-sets-extraction-service.js`

**Action:** Add rate limiter and make concurrency configurable

### Add Import (Top of File)
```javascript
const rateLimiter = require('./rate-limiter-service');
```

### Update batchExtract Method Signature

**Location:** Line 253

**Before:**
```javascript
async batchExtract(items, orgId, concurrencyLimit = 2) {
```

**After:**
```javascript
async batchExtract(items, orgId, concurrencyLimit = null) {
  // Use env variable with fallback to parameter or default
  const limit = concurrencyLimit || parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;
```

### Apply Rate Limiting

**Location:** Line ~186 (inside `extractFromCleanUrl` method)

**Before:**
```javascript
try {
  const payload = {
    url: cleanUrl,
    formats: [
      {
        type: 'json',
        schema: this.getExtractionSchema(),
        prompt: this.getExtractionPrompt()
      }
    ],
    // ... options
  };

  const response = await axios.post(
    `${this.firecrawlApiUrl}/v2/scrape`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000
    }
  );
```

**After:**
```javascript
try {
  // Wait for rate limiter approval
  await rateLimiter.acquireSlot(`option-sets-${itemName}-${orgId}`);

  const payload = {
    url: cleanUrl,
    formats: [
      {
        type: 'json',
        schema: this.getExtractionSchema(),
        prompt: this.getExtractionPrompt()
      }
    ],
    // ... options
  };

  const response = await axios.post(
    `${this.firecrawlApiUrl}/v2/scrape`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000
    }
  );
```

### Update Call to batchExtract

**Location:** `premium-extraction-service.js:517-521`

**Before:**
```javascript
const optionSetsResult = await optionSetsService.batchExtract(
  itemsWithCleanUrls,
  orgId,
  2  // Concurrency limit of 2 for Firecrawl API
);
```

**After:**
```javascript
// Concurrency limit now read from env in the service
const optionSetsResult = await optionSetsService.batchExtract(
  itemsWithCleanUrls,
  orgId
);
```

**Time Estimate:** 20 minutes

---

## Step 6: Update Server.js Batch Extraction

**File:** `UberEats-Image-Extractor/server.js`

**Action:** Add rate limiter and make concurrency configurable

### Add Import (Top of File with other requires)
```javascript
const rateLimiter = require('./src/services/rate-limiter-service');
```

### Update Concurrency Limit

**Location:** Line 207

**Before:**
```javascript
// Process categories with concurrency limit of 2
const concurrencyLimit = 2;
```

**After:**
```javascript
// Process categories with configurable concurrency limit
const concurrencyLimit = parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;
```

### Apply Rate Limiting

**Location:** Inside `processCategory` function (around line 212)

Find all Firecrawl API calls in server.js and add rate limiting before each call:

```javascript
// Before each axios.post to Firecrawl API
await rateLimiter.acquireSlot(`batch-category-${category.name}`);
```

**Time Estimate:** 20 minutes

---

## Step 7: Testing Plan

### Unit Testing

**Test 1: Rate Limiter Basic Functionality**
```javascript
// Create test file: test-rate-limiter.js
const rateLimiter = require('./src/services/rate-limiter-service');

async function testRateLimiter() {
  console.log('Testing rate limiter...');

  // Reset
  rateLimiter.reset();

  // Make 10 rapid requests (should all go through)
  console.log('Making 10 rapid requests...');
  const start = Date.now();

  for (let i = 1; i <= 10; i++) {
    await rateLimiter.acquireSlot(`test-${i}`);
    console.log(`Request ${i} completed`);
  }

  const elapsed10 = Date.now() - start;
  console.log(`10 requests took ${elapsed10}ms (should be ~instant)`);

  // 11th request should wait
  console.log('\nMaking 11th request (should wait)...');
  const start11 = Date.now();
  await rateLimiter.acquireSlot('test-11');
  const elapsed11 = Date.now() - start11;
  console.log(`11th request waited ${elapsed11}ms (should be >0)`);

  console.log('\nRate limiter test complete!');
}

testRateLimiter().catch(console.error);
```

**Test 2: Concurrency with Rate Limiting**
- Extract a small menu (5-10 items) with option sets
- Verify no 402/429 errors
- Check logs show rate limiting in action
- Confirm total time is reasonable

### Integration Testing

**Test 3: Full Premium Extraction**
- Extract a large menu (50+ items) with option sets
- Monitor for:
  - ✅ No 402/429 errors
  - ✅ Phase 2 faster than before (Promise.race working)
  - ✅ Phase 4 completes successfully
  - ✅ Rate limiter logs show enforcement
  - ✅ Never exceeds 10 requests/minute

**Test 4: Concurrent Extractions**
- Start 2 extractions simultaneously
- Verify both share the same rate limiter
- Confirm no errors

**Time Estimate:** 1-2 hours

---

## Step 8: Documentation Updates

### Update CLAUDE.md

Add section about configuration:

```markdown
## Firecrawl API Configuration

The system enforces Firecrawl API limits via environment variables:

### Rate Limiting
- `FIRECRAWL_RATE_LIMIT=10` - Maximum requests per minute (default: 10)
- `FIRECRAWL_RATE_WINDOW=60000` - Rate limit window in ms (default: 60000 = 1 minute)

### Concurrency
- `FIRECRAWL_CONCURRENCY_LIMIT=2` - Maximum simultaneous requests (default: 2)

### Upgrading Your Plan
When upgrading your Firecrawl plan:
1. Update the values in `.env`
2. Restart the server
3. No code changes required

Example for upgraded plan:
```bash
FIRECRAWL_CONCURRENCY_LIMIT=5
FIRECRAWL_RATE_LIMIT=30
```
```

**Time Estimate:** 15 minutes

---

## Total Implementation Time

| Step | Task | Estimate |
|------|------|----------|
| 1 | Add .env variables | 2 min |
| 2 | Create rate limiter service | 30 min |
| 3 | Fix Phase 2 concurrency | 30 min |
| 4 | Apply to premium extraction | 15 min |
| 5 | Apply to option sets | 20 min |
| 6 | Update server.js | 20 min |
| 7 | Testing | 1-2 hours |
| 8 | Documentation | 15 min |

**Total:** 3-4 hours (including testing)

---

## Deployment Checklist

- [ ] All code changes implemented
- [ ] Rate limiter service tested
- [ ] .env variables added
- [ ] Full extraction test passed
- [ ] No 402/429 errors observed
- [ ] Phase 2 performance improved
- [ ] Logs showing rate limiting
- [ ] Documentation updated
- [ ] Committed to git
- [ ] Server restarted

---

## Rollback Plan

If issues occur:

1. **Immediate:** Disable rate limiting by commenting out `acquireSlot` calls
2. **Quick fix:** Revert to previous git commit
3. **Investigation:** Check logs for specific errors

**Note:** The changes are additive (new service + modifications), so rollback is straightforward.
