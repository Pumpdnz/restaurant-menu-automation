# Session Summary: Part 7 Fixes - Additional Enhancements

**Date**: 2026-01-02
**Status**: COMPLETED

---

## Session Overview

This session addressed two main issues:
1. Enabling menu/branding extractions without requiring sequence enrollment
2. Fixing sporadic "socket hang up" errors during batch branding extractions

---

## Issue 1: Extractions Without Sequence Enrollment

### Problem
The extraction options dialog was only accessible after enrolling converted leads into sequences. Users who wanted to skip sequence enrollment had no path to trigger menu and branding extractions.

### Solution
Added a **"Start Extractions"** button directly to the conversion results dialog, providing an alternative path that bypasses sequence enrollment.

### Changes Made

**File:** `src/components/leads/PendingLeadsTable.tsx`

Added new button to DialogFooter (lines 1260-1272):
```tsx
{conversionSummary.successful > 0 &&
  convertedRestaurants.some(r => r.ubereats_url || r.website_url) && (
  <Button
    variant="outline"
    onClick={() => {
      setExtractionOptions(new Set(['menu', 'images', 'optionSets', 'branding']));
      setShowExtractionOptions(true);
      setIsConversionDialogOpen(false);
    }}
  >
    Start Extractions
  </Button>
)}
```

### New User Flow

```
Convert Leads → Conversion Results Dialog
                      ↓
         ┌───────────┴───────────┐
         ↓                       ↓
   "Start Sequence"        "Start Extractions"
         ↓                       ↓
   Sequence Modal         Extraction Options Dialog
         ↓                       ↓
   onSuccess callback     Direct extraction trigger
         ↓
   Extraction Options Dialog
```

Users now have two independent paths after conversion.

---

## Issue 2: Socket Hang Up Errors

### Problem
Sporadic "socket hang up" errors (HTTP 400) occurred when triggering branding extractions for multiple restaurants, either from:
- The conversion dialog's "Start Extractions" button
- The registration batch Step 1 execution

### Root Cause Analysis

1. **No rate limiting on Firecrawl calls** - `extractBrandingWithFirecrawl()` made direct axios calls without using the existing `RateLimiterService`

2. **No request timeouts** - Axios calls had no timeout configuration, causing hung connections to block indefinitely

3. **No request staggering** - Frontend fired all branding extraction requests simultaneously, overwhelming the connection pool

### Solution

#### 1. Backend: Rate Limiting & Timeouts

**File:** `src/services/logo-extraction-service.js`

Added imports and configuration:
```javascript
const rateLimiter = require('./rate-limiter-service');

const FIRECRAWL_TIMEOUT = 60000; // 60 seconds
const IMAGE_DOWNLOAD_TIMEOUT = 30000; // 30 seconds
```

Updated `extractBrandingWithFirecrawl()`:
```javascript
async function extractBrandingWithFirecrawl(sourceUrl) {
  // Acquire rate limiter slot before making the request
  await rateLimiter.acquireSlot(`branding-${sourceUrl}`);

  const response = await axios.post(
    `${FIRECRAWL_API_URL}/v2/scrape`,
    { url: sourceUrl, formats: ['branding'], waitFor: 3000 },
    {
      headers: { ... },
      timeout: FIRECRAWL_TIMEOUT  // Added timeout
    }
  );
  // ...
}
```

Updated `downloadImageToBuffer()`:
```javascript
const response = await axios.get(fullUrl, {
  responseType: 'arraybuffer',
  timeout: IMAGE_DOWNLOAD_TIMEOUT,  // Added timeout
  headers: { ... }
});
```

#### 2. Frontend: Request Staggering

**File:** `src/components/leads/PendingLeadsTable.tsx`

Changed branding extraction loop to stagger requests:
```typescript
for (let i = 0; i < restaurantsWithWebsite.length; i++) {
  const restaurant = restaurantsWithWebsite[i];

  // Stagger requests by 500ms each
  setTimeout(() => {
    api.post('/website-extraction/branding', { ... })
      .catch((error) => {
        console.error(`Branding extraction failed for ${restaurant.name}:`, error);
      });
  }, i * 500);
}
```

### Rate Limiter Configuration

The rate limiter reads from environment variables:
- `FIRECRAWL_RATE_LIMIT` - requests per window (default: 10, user has: 500)
- `FIRECRAWL_RATE_WINDOW` - window in ms (default: 60000 = 1 minute)

With the user's 500/minute plan, the rate limiter won't be the bottleneck. The key fix is the **timeout configuration** and **request staggering** to prevent connection pool exhaustion.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/leads/PendingLeadsTable.tsx` | Added "Start Extractions" button, added request staggering |
| `src/services/logo-extraction-service.js` | Added rate limiter, added timeouts to Firecrawl and image download calls |

---

## Testing Checklist

- [ ] Convert leads and use "Start Extractions" button (bypass sequence)
- [ ] Convert leads and use "Start Sequence" → extraction options still appear after
- [ ] Batch of 5+ restaurants - no socket hang up errors
- [ ] Batch of 10+ restaurants - rate limiter logs show proper throttling
- [ ] Individual branding extraction still works from restaurant detail page
- [ ] Registration batch Step 1 triggers extractions without errors

---

## Related Documentation

- `IMPLEMENTATION_PLAN.md` - Original auto-extraction implementation (completed 2025-12-20)
- `INVESTIGATION_TASK_2_PREMIUM_EXTRACTION.md` - Premium extraction async job system
- `INVESTIGATION_TASK_3_BRANDING_EXTRACTION.md` - Branding extraction architecture
