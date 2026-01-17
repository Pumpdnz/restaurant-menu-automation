# Rate Limiting & Concurrency Control Implementation Plan

## Overview

This folder contains comprehensive planning and documentation for implementing rate limiting and fixing concurrency control issues in the Firecrawl API integration.

**Status:** 📝 Planning Complete - Ready for Implementation

**Created:** 2025-01-08

**Priority:** 🔴 CRITICAL - Resolves production 402/429 errors

---

## Problem Summary

During premium menu extraction (Phase 4 - Option Sets), the system exceeds Firecrawl's rate limit of 10 requests/minute, causing:
- 402 errors (Payment Required - soft warning)
- 429 errors (Rate Limit Exceeded - hard block)

Additionally, Phase 2 uses inefficient concurrency control, causing ~40% performance loss.

---

## Solution Summary

1. **Implement rate limiter service** - Token bucket with sliding window
2. **Fix Phase 2 concurrency** - Use Promise.race instead of Promise.all
3. **Make limits configurable** - Use .env variables
4. **Apply systematically** - Rate limit all Firecrawl API calls

---

## Document Guide

Read these documents in order:

### 1. `00-OVERVIEW.md` - Start Here
- High-level context
- Problem statement
- Solution overview
- Expected outcomes

**Read this first** to understand why this work is needed.

### 2. `01-CURRENT-STATE-ANALYSIS.md` - Understanding the Problem
- Detailed code analysis
- Concurrency patterns found (correct vs broken)
- Rate limiting status (none exists)
- All Firecrawl API call locations

**Read this second** to understand the current implementation.

### 3. `02-PROBLEMS-IDENTIFIED.md` - What's Wrong
- 4 problems identified and prioritized
- Evidence and examples
- Impact analysis
- Why each problem matters

**Read this third** to understand what needs to be fixed and why.

### 4. `03-IMPLEMENTATION-PLAN.md` - How to Fix It
- Step-by-step implementation guide
- Code snippets for every change
- Testing procedures
- Time estimates
- Rollback plan

**Read this fourth** when ready to implement. This is your implementation guide.

### 5. `04-IMPLEMENTATION-CHECKLIST.md` - Tracking Progress
- Detailed checklist for implementation
- Each step broken down
- Testing checklist
- Sign-off section
- Notes section for tracking issues

**Use this during implementation** to track your progress and ensure nothing is missed.

### 6. `05-QUICK-REFERENCE.md` - Quick Lookup
- TL;DR summary
- Code snippets
- Common issues & solutions
- Key metrics
- Quick testing checklist

**Use this during and after implementation** for quick reference.

---

## Quick Start

If you need to implement this right now:

1. **Read:** `00-OVERVIEW.md` (5 min)
2. **Skim:** `03-IMPLEMENTATION-PLAN.md` (10 min)
3. **Follow:** `04-IMPLEMENTATION-CHECKLIST.md` (3-4 hours)
4. **Reference:** `05-QUICK-REFERENCE.md` (as needed)

---

## File Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| `00-OVERVIEW.md` | Context & summary | Initial understanding |
| `01-CURRENT-STATE-ANALYSIS.md` | Code analysis | Understanding current state |
| `02-PROBLEMS-IDENTIFIED.md` | Problems & impact | Understanding what's wrong |
| `03-IMPLEMENTATION-PLAN.md` | Implementation steps | During implementation |
| `04-IMPLEMENTATION-CHECKLIST.md` | Progress tracking | During implementation |
| `05-QUICK-REFERENCE.md` | Quick lookup | During & after implementation |

---

## Implementation Timeline

**Estimated Total Time:** 3-5 hours

| Phase | Duration |
|-------|----------|
| Code changes | 2 hours |
| Testing | 1-2 hours |
| Documentation | 15 min |
| Deployment | 15 min |

---

## Key Changes Required

### Files to Create (1)
- `src/services/rate-limiter-service.js` - NEW

### Files to Modify (4)
- `.env` - Add 3 variables
- `src/services/premium-extraction-service.js` - Fix Phase 2 + add rate limiting
- `src/services/option-sets-extraction-service.js` - Add rate limiting
- `server.js` - Add rate limiting

### Environment Variables to Add (3)
```bash
FIRECRAWL_CONCURRENCY_LIMIT=2
FIRECRAWL_RATE_LIMIT=10
FIRECRAWL_RATE_WINDOW=60000
```

---

## Success Criteria

Implementation is complete when:

- ✅ All code changes implemented
- ✅ No 402/429 errors in testing
- ✅ Phase 2 performance same or better
- ✅ Rate limiter logs visible
- ✅ Large menu (60+ items) extracts successfully
- ✅ Documentation updated

---

## Dependencies

**Required:**
- Node.js environment with axios
- Access to .env file
- Firecrawl API key

**No New Packages Required:**
- Uses existing dependencies only

---

## Testing Strategy

1. **Unit Test:** Rate limiter basic functionality
2. **Integration Test:** Small menu extraction (10 items)
3. **Full Test:** Large menu extraction (60+ items)
4. **Stress Test:** Concurrent extractions
5. **Monitoring:** First production extraction

---

## Rollback Plan

If critical issues occur:
1. Revert git commit
2. Restart server
3. System returns to previous working state
4. Investigate and fix issues
5. Re-implement

**Note:** Changes are additive, making rollback straightforward.

---

## Support & Troubleshooting

### Common Issues
See `05-QUICK-REFERENCE.md` section "Common Issues & Solutions"

### Debug Steps
1. Check server logs for errors
2. Verify .env variables loaded
3. Check rate limiter import paths
4. Test with small extraction first

### Monitoring
After deployment, monitor:
- 402/429 error counts (should be 0)
- Phase 2 completion time
- Phase 4 completion time
- Rate limiter logs

---

## Future Improvements

**When Firecrawl plan upgrades:**
- Update `.env` variables
- Restart server
- No code changes needed

**Potential enhancements:**
- Metrics dashboard for API usage
- Alerting when approaching limits
- Automatic retry on transient errors

---

## Related Documentation

- Main project: `../../CLAUDE.md`
- Server timeout fix: Already implemented (360s keepAliveTimeout)
- Premium extraction: `../../UberEats-Image-Extractor/src/services/premium-extraction-service.js`

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-01-08 | Initial planning documents created | Claude |
| TBD | Implementation completed | TBD |
| TBD | Deployed to production | TBD |

---

## Notes

- This plan assumes no other concurrent work on these files
- Testing should be done in non-production first
- Full git commit recommended before starting
- Keep this folder updated with any lessons learned

---

## Questions?

If you have questions during implementation:
1. Re-read the relevant planning document
2. Check the implementation plan for details
3. Review code examples in the plan
4. Test changes incrementally
5. Check logs for specific errors

---

**Last Updated:** 2025-01-08
**Next Review:** After implementation completion
