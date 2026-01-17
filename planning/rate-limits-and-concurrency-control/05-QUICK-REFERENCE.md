# Quick Reference Guide

## TL;DR

**Problem:** Getting 402/429 errors during option sets extraction (Phase 4)

**Root Cause:** No rate limiting + concurrency control doesn't prevent exceeding 10 req/min limit

**Solution:** Add rate limiter service + fix broken Phase 2 concurrency + make all limits configurable

**Files to Change:**
1. `.env` - Add 3 new variables
2. `src/services/rate-limiter-service.js` - NEW FILE
3. `src/services/premium-extraction-service.js` - Fix Phase 2 + add rate limiting
4. `src/services/option-sets-extraction-service.js` - Add rate limiting + env config
5. `server.js` - Add rate limiting + env config

---

## New Environment Variables

Add to `.env`:
```bash
FIRECRAWL_CONCURRENCY_LIMIT=2     # Max simultaneous requests
FIRECRAWL_RATE_LIMIT=10           # Max requests per minute
FIRECRAWL_RATE_WINDOW=60000       # Rate limit window (60 seconds)
```

---

## Rate Limiter Usage

```javascript
// Import
const rateLimiter = require('./rate-limiter-service');

// Before EVERY Firecrawl API call
await rateLimiter.acquireSlot('identifier-for-logging');

// Then make your API call
const response = await axios.post(...);
```

---

## Correct Concurrency Pattern (Promise.race)

```javascript
const processingQueue = [...items];
const activePromises = new Map();
const concurrencyLimit = parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;

while (processingQueue.length > 0 || activePromises.size > 0) {
  // Fill slots
  while (processingQueue.length > 0 && activePromises.size < concurrencyLimit) {
    const item = processingQueue.shift();
    const promise = processItem(item);
    activePromises.set(itemId, promise);

    promise.then(() => activePromises.delete(itemId))
           .catch(() => activePromises.delete(itemId));
  }

  // Wait for ANY to complete
  if (activePromises.size > 0) {
    await Promise.race(activePromises.values());
  }
}
```

---

## Files & Line Numbers

### .env
- Add 3 new variables (see above)

### rate-limiter-service.js (NEW FILE)
- Create at: `src/services/rate-limiter-service.js`
- ~80 lines total
- Implements sliding window token bucket

### premium-extraction-service.js
- **Line ~1:** Add import: `const rateLimiter = require('./rate-limiter-service');`
- **Line ~66:** Add rate limiting to category extraction
- **Line ~166:** Add rate limiting to item extraction
- **Line ~464-501:** Replace entire Phase 2 with Promise.race pattern
- **Line ~520:** Remove hardcoded `2` parameter

### option-sets-extraction-service.js
- **Line ~1:** Add import: `const rateLimiter = require('./rate-limiter-service');`
- **Line ~186:** Add rate limiting to option sets extraction
- **Line ~253:** Change signature to accept null, read from env

### server.js
- **Line ~1:** Add import: `const rateLimiter = require('./src/services/rate-limiter-service');`
- **Line ~207:** Read concurrency from env
- **Line ~300+:** Add rate limiting before Firecrawl calls

---

## Expected Behavior After Fix

### Logs Will Show:
```
[Rate Limiter] Request started: 1/10 in last 60s
[orgId] Extracting option sets for "Burger" from: https://...
[Rate Limiter] Request started: 2/10 in last 60s
[orgId] Extracting option sets for "Fries" from: https://...
...
[Rate Limiter] Request started: 10/10 in last 60s
[orgId] Extracting option sets for "Shake" from: https://...
[Rate Limiter] At limit (10/10), waiting 8s for "option-sets-Soda-orgId"
[Rate Limiter] Request started: 10/10 in last 60s
```

### Performance:
- **Phase 2:** Same or faster (Promise.race improvement)
- **Phase 4:** Predictable timing (~6 min for 60 items)
- **Errors:** ZERO 402/429 errors

---

## Testing Checklist

Quick test after implementation:

1. ✅ Server starts without errors
2. ✅ Extract small menu (10 items) - no errors
3. ✅ Extract large menu (60 items) - no 402/429 errors
4. ✅ Logs show rate limiting in action
5. ✅ Phase 2 completes successfully
6. ✅ Phase 4 completes successfully

---

## Common Issues & Solutions

### Issue: Rate limiter not working
- Check import path is correct
- Verify `acquireSlot()` called BEFORE axios.post
- Check .env variables loaded

### Issue: Still getting 402/429 errors
- Verify rate limiter applied to ALL Firecrawl calls
- Check FIRECRAWL_RATE_LIMIT is 10 (not higher)
- Ensure only one rate limiter instance (singleton)

### Issue: Phase 2 slower than before
- Verify using Promise.race (not Promise.all)
- Check concurrency limit from env
- Ensure activePromises Map being cleaned up

### Issue: Too slow
- Check if rate limit is too conservative
- Verify no unnecessary delays added
- Ensure concurrency limit is 2 (not 1)

---

## Upgrade Path (Future)

When Firecrawl plan upgrades to higher limits:

1. Update `.env`:
   ```bash
   FIRECRAWL_CONCURRENCY_LIMIT=5
   FIRECRAWL_RATE_LIMIT=30
   ```
2. Restart server
3. Test with extraction
4. Done! No code changes needed.

---

## Rollback Commands

If needed:
```bash
# Revert last commit
git revert HEAD

# Or checkout previous commit
git log --oneline
git checkout <previous-commit-hash>

# Restart server
npm start
```

---

## Key Metrics to Monitor

- **402 errors:** Should be ZERO
- **429 errors:** Should be ZERO
- **Phase 2 time:** Should be same or faster
- **Phase 4 time for 60 items:** ~6 minutes (acceptable)
- **Rate limiter logs:** Should show "at limit, waiting" messages

---

## Contact & Support

For issues or questions:
1. Check logs first
2. Review this planning folder
3. Check implementation plan for details
4. Test with small extraction first
