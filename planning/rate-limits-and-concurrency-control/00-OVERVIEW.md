# Rate Limiting & Concurrency Control - Overview

## Context

This planning document addresses critical issues with Firecrawl API integration related to:
1. **402 errors** (Payment Required) - Premature rate limit warnings
2. **429 errors** (Rate Limit Exceeded) - Hard rate limit enforcement
3. **Inefficient concurrency control** - Blocking request slots unnecessarily

## Current Firecrawl API Limits

- **Rate Limit:** 10 requests per minute
- **Concurrent Requests:** 2 simultaneous requests maximum
- **Expected Response Time:** 6-10 seconds per request (varies)

## The Problem

During **Phase 4 (Option Sets Extraction)** of premium menu extraction:
- Processing 50-100+ menu items
- Each item requires 1 Firecrawl API call
- Fast responses (6s) with concurrency=2 → 20 requests/minute → **2x over rate limit**
- Results in 402 errors (soft warning) followed by 429 errors (hard block)

**Additionally:** Phase 2 (Category Extraction) uses broken concurrency pattern that waits for entire batches instead of releasing slots immediately.

## Solution Requirements

1. **Implement rate limiting** - Track and enforce 10 requests/minute limit
2. **Fix concurrency pattern** - Use Promise.race instead of Promise.all for immediate slot release
3. **Make limits configurable** - Use .env variables for easy upgrades
4. **Work in tandem** - Both rate limiting AND concurrency control must work together

## Scope

**In Scope:**
- Rate limiter service implementation
- Fix Phase 2 concurrency pattern
- Make all Firecrawl limits env-configurable
- Apply rate limiting to all Firecrawl API calls

**Out of Scope:**
- UploadCare service concurrency (different API, lower priority)
- Other non-Firecrawl API integrations

## Expected Outcomes

- ✅ Zero 402/429 errors
- ✅ 30-40% faster Phase 2 extraction (proper slot management)
- ✅ Easy future upgrades via .env changes
- ✅ Predictable, reliable extraction performance

## Files in This Plan

- `00-OVERVIEW.md` - This file
- `01-CURRENT-STATE-ANALYSIS.md` - Detailed code analysis
- `02-PROBLEMS-IDENTIFIED.md` - All issues documented
- `03-IMPLEMENTATION-PLAN.md` - Step-by-step implementation guide
- `04-IMPLEMENTATION-CHECKLIST.md` - Progress tracking

## Timeline

**Estimated Implementation:** 2-3 hours
**Testing Time:** 1-2 hours with real extractions
**Total:** 3-5 hours

## Related Issues

- Server timeout 408 errors - **RESOLVED** (increased server keepAliveTimeout to 360s)
- Premium extraction database saving - **RESOLVED**
- Option sets deduplication - **RESOLVED**
