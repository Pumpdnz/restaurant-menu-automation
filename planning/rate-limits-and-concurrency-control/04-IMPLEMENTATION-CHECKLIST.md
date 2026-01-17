# Implementation Checklist

## Pre-Implementation

- [ ] Read all planning documents
- [ ] Understand current state and problems
- [ ] Backup current codebase (git commit current state)
- [ ] Create feature branch: `git checkout -b feature/rate-limiting-concurrency-fix`

---

## Step 1: Environment Configuration

- [ ] Open `UberEats-Image-Extractor/.env`
- [ ] Add `FIRECRAWL_CONCURRENCY_LIMIT=2`
- [ ] Add `FIRECRAWL_RATE_LIMIT=10`
- [ ] Add `FIRECRAWL_RATE_WINDOW=60000`
- [ ] Save file

---

## Step 2: Rate Limiter Service

- [ ] Create file: `src/services/rate-limiter-service.js`
- [ ] Implement `RateLimiterService` class
  - [ ] Constructor with env variable loading
  - [ ] `requestTimestamps` array
  - [ ] `acquireSlot(identifier)` method
  - [ ] `getCurrentUsage()` method
  - [ ] `sleep(ms)` utility
  - [ ] `reset()` method
- [ ] Export singleton instance
- [ ] Test basic functionality (optional unit test)

---

## Step 3: Fix Phase 2 Concurrency Pattern

**File:** `src/services/premium-extraction-service.js`

- [ ] Locate Phase 2 code (lines ~464-501)
- [ ] Read concurrency limit from env: `parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2`
- [ ] Replace batch loop with queue-based processing
- [ ] Create `processingQueue` from categories array
- [ ] Create `activePromises` Map
- [ ] Implement while loop: `while (processingQueue.length > 0 || activePromises.size > 0)`
- [ ] Fill slots up to concurrency limit
- [ ] Use `Promise.race(activePromises.values())`
- [ ] Handle promise completion (delete from Map, collect results)
- [ ] Update progress logging
- [ ] Verify no syntax errors

---

## Step 4: Apply Rate Limiting - Premium Extraction Service

**File:** `src/services/premium-extraction-service.js`

### Phase 1 - Category Extraction

- [ ] Add import: `const rateLimiter = require('./rate-limiter-service');`
- [ ] Locate `extractCategories` method (line ~42)
- [ ] Find axios.post call (line ~66)
- [ ] Add **before** axios.post: `await rateLimiter.acquireSlot(\`categories-\${orgId}\`);`
- [ ] Verify indentation and syntax

### Phase 2 - Category Items Extraction

- [ ] Locate `extractCategoryItems` method (line ~106)
- [ ] Find axios.post call (line ~166)
- [ ] Add **before** axios.post: `await rateLimiter.acquireSlot(\`category-items-\${categoryName}-\${orgId}\`);`
- [ ] Verify indentation and syntax

---

## Step 5: Apply Rate Limiting - Option Sets Service

**File:** `src/services/option-sets-extraction-service.js`

### Update Method Signature

- [ ] Add import: `const rateLimiter = require('./rate-limiter-service');`
- [ ] Locate `batchExtract` method (line ~253)
- [ ] Change signature: `async batchExtract(items, orgId, concurrencyLimit = null)`
- [ ] Add limit resolution: `const limit = concurrencyLimit || parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;`
- [ ] Update usage of `concurrencyLimit` to `limit` in the method

### Apply Rate Limiting

- [ ] Locate `extractFromCleanUrl` method (line ~150)
- [ ] Find axios.post call (line ~186)
- [ ] Add **before** axios.post: `await rateLimiter.acquireSlot(\`option-sets-\${itemName}-\${orgId}\`);`
- [ ] Verify indentation and syntax

### Update Call Site

**File:** `src/services/premium-extraction-service.js`

- [ ] Locate Phase 4 code (line ~517)
- [ ] Update call: Remove hardcoded `2` parameter
- [ ] New call: `await optionSetsService.batchExtract(itemsWithCleanUrls, orgId);`
- [ ] Update comment to reflect env configuration

---

## Step 6: Apply Rate Limiting - Server Batch Extraction

**File:** `server.js`

- [ ] Add import: `const rateLimiter = require('./src/services/rate-limiter-service');`
- [ ] Locate batch extraction code (line ~207)
- [ ] Update: `const concurrencyLimit = parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;`
- [ ] Find all Firecrawl API calls in batch processing
- [ ] Add rate limiting before each call:
  - [ ] Before category scraping
  - [ ] Before any other Firecrawl calls
- [ ] Verify all changes

---

## Step 7: Code Review

- [ ] Read through all changes
- [ ] Check for syntax errors
- [ ] Verify all imports are correct
- [ ] Confirm all rate limiter calls use meaningful identifiers
- [ ] Check that env variables are read correctly
- [ ] Verify Promise.race pattern is correct

---

## Step 8: Unit Testing

### Test Rate Limiter

- [ ] Create `test-rate-limiter.js` (see implementation plan)
- [ ] Run: `node test-rate-limiter.js`
- [ ] Verify 10 requests go through immediately
- [ ] Verify 11th request waits
- [ ] Check logs show rate limiting
- [ ] Delete test file or move to tests folder

### Test Small Extraction

- [ ] Start server: `cd UberEats-Image-Extractor && npm start`
- [ ] Verify server starts without errors
- [ ] Check logs show timeout configuration
- [ ] Extract small menu (5-10 items) with option sets
- [ ] Monitor logs for:
  - [ ] Rate limiter activity
  - [ ] No 402 errors
  - [ ] No 429 errors
  - [ ] Phase 2 completion
  - [ ] Phase 4 completion
- [ ] Verify extraction succeeds

---

## Step 9: Integration Testing

### Test Large Extraction

- [ ] Extract large menu (50+ items) with option sets
- [ ] Monitor throughout entire extraction
- [ ] Check logs for:
  - [ ] Rate limiter enforcing limits
  - [ ] "waiting Xs" messages when at limit
  - [ ] No 402 errors
  - [ ] No 429 errors
  - [ ] Phase 2 faster than before (if timed)
- [ ] Verify extraction completes successfully
- [ ] Check database for saved data

### Test Edge Cases

- [ ] Test with menu having 0 items
- [ ] Test with menu having 1 category
- [ ] Test with menu having 10+ categories
- [ ] Test with unavailable items (404s)
- [ ] Verify all handle gracefully

### Test Concurrent Extractions

- [ ] Start extraction 1
- [ ] Immediately start extraction 2
- [ ] Verify both proceed
- [ ] Check logs show shared rate limiting
- [ ] Verify both complete without errors

---

## Step 10: Performance Validation

- [ ] Time Phase 2 before and after (if possible)
- [ ] Verify Phase 2 is faster or same speed (not slower)
- [ ] Calculate Phase 4 time for 60 items:
  - Expected: ~6 minutes minimum (10 req/min limit)
  - [ ] Verify actual time is close to expected
- [ ] Check that no unnecessary delays occur

---

## Step 11: Log Analysis

Review logs and verify:

- [ ] Rate limiter logs show current usage (e.g., "8/10 requests")
- [ ] Rate limiter logs show wait times when at limit
- [ ] Phase 2 logs show continuous processing (not batches)
- [ ] Phase 4 logs show rate limiting in action
- [ ] No error stack traces
- [ ] No unexpected warnings

---

## Step 12: Documentation

- [ ] Update `CLAUDE.md` with Firecrawl configuration section
- [ ] Add .env variables documentation
- [ ] Add upgrade instructions
- [ ] Document rate limiter service
- [ ] Add troubleshooting section

---

## Step 13: Git Commit

- [ ] Review all changes: `git status`
- [ ] Review diff: `git diff`
- [ ] Stage changes: `git add .`
- [ ] Commit with message:
  ```
  Add rate limiting and fix concurrency control for Firecrawl API

  - Implement token bucket rate limiter with sliding window
  - Fix Phase 2 concurrency pattern (Promise.race instead of Promise.all)
  - Make all Firecrawl limits configurable via .env
  - Apply rate limiting to all Firecrawl API calls
  - Add comprehensive logging for visibility

  Resolves 402/429 rate limit errors in Phase 4 option sets extraction
  Improves Phase 2 performance by ~40% with proper slot management
  ```
- [ ] Push to feature branch: `git push origin feature/rate-limiting-concurrency-fix`

---

## Step 14: Deployment

- [ ] Merge to main branch (or deployment branch)
- [ ] Deploy to production server
- [ ] Restart server
- [ ] Verify server starts successfully
- [ ] Monitor first production extraction
- [ ] Check logs for any issues

---

## Step 15: Monitoring

**First Week:**
- [ ] Monitor all extractions for errors
- [ ] Check for any 402/429 errors (should be ZERO)
- [ ] Verify rate limiting working correctly
- [ ] Gather feedback from users (if any)

**First Month:**
- [ ] Review extraction performance
- [ ] Check if any adjustments needed
- [ ] Document any lessons learned

---

## Rollback (If Needed)

If critical issues occur:

- [ ] Revert git commit: `git revert HEAD`
- [ ] Or checkout previous commit: `git checkout <previous-commit-hash>`
- [ ] Restart server
- [ ] Verify system back to working state
- [ ] Investigate issues
- [ ] Fix and redeploy

---

## Completion Criteria

All of the following must be true:

- [x] All code changes implemented
- [x] All tests passing
- [x] No 402/429 errors in testing
- [x] Phase 2 performance same or better
- [x] Rate limiter logs visible
- [x] Documentation updated
- [x] Code committed to git
- [x] Deployed to production
- [x] First production extraction successful

---

## Notes & Issues

Use this section to track any issues or notes during implementation:

```
Example:
- 2025-01-10: Found typo in rate-limiter-service.js line 45, fixed
- 2025-01-10: Phase 2 test showed 35% improvement (better than expected!)
- 2025-01-11: Production extraction completed successfully, zero errors
```

---

## Sign-off

**Implemented by:** _________________
**Date:** _________________
**Tested by:** _________________
**Date:** _________________
**Approved by:** _________________
**Date:** _________________
