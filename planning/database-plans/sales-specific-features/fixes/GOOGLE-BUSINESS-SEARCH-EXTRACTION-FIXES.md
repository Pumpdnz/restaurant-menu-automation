# Google Business Search Extraction Fixes

**Date:** 2025-12-04
**File:** `UberEats-Image-Extractor/server.js`
**Endpoints Affected:**
- `POST /api/google-business-search`
- Platform-specific extraction (dynamic extraction endpoint)

---

## Issue 1: Address Being Overwritten by Less Specific Data

### Problem
When extracting business information, the system would:
1. First scrape UberEats and get a specific address (e.g., `28/96 Oxford Terrace Christchurch Central City, Christchurch 8011, New Zealand`)
2. Then scrape the website for phone/hours
3. **Bug:** The website's less specific address (e.g., `Addington, Christchurch`) would overwrite the UberEats address

### Root Cause
The address processing logic at line ~5881 did not check if we already had a valid address from a higher-priority source before overwriting.

### Fix Applied
Added `extractionGoals.address &&` to the condition so that once an address is found from UberEats (first priority), it won't be overwritten by subsequent sources.

**Before:**
```javascript
if (urlConfig.extractAddress && jsonData.address && jsonData.address !== 'null' ...) {
```

**After:**
```javascript
if (urlConfig.extractAddress && extractionGoals.address && jsonData.address && jsonData.address !== 'null' ...) {
```

### Data Priority (Current Behavior)
| Field | Priority 1 | Priority 2 | Notes |
|-------|-----------|-----------|-------|
| Address | UberEats | Website | UberEats has more specific addresses |
| Hours | Website | UberEats | Website hours are more accurate |
| Phone | Website | - | UberEats rarely has phone numbers |

---

## Issue 2: Firecrawl Hallucinating Lunch/Dinner Splits

### Problem
The extraction prompts were overly suggestive about split hours, causing Firecrawl to return incorrect data:

1. **False splits:** Restaurant has continuous hours `11am - 9pm` but Firecrawl returns:
   ```javascript
   { day: 'Saturday', open: '11:00 AM', close: '3:00 PM', period: 'Lunch' }
   { day: 'Saturday', open: '5:00 PM', close: '10:00 PM', period: 'Dinner' }
   ```

2. **Overlapping splits:** No break exists but Firecrawl creates adjacent periods:
   ```javascript
   { day: 'Saturday', open: '11:00 AM', close: '5:00 PM', period: 'Lunch' }
   { day: 'Saturday', open: '5:00 PM', close: '10:00 PM', period: 'Dinner' }
   ```

### Root Cause
The prompts explicitly instructed Firecrawl to "look for both lunch and dinner times" which caused the AI to hallucinate splits that don't exist.

### Fix Applied
Updated prompts and schema descriptions to be more neutral while still supporting legitimate split hours.

#### Location 1: `getExtractionConfig()` function (UberEats) - Lines ~5642-5660

**Prompt - Before:**
```
3. Opening hours for each day - look for both lunch and dinner times if they exist separately
Important: Some restaurants have split hours (lunch and dinner). Extract both time periods for each day if present.
```

**Prompt - After:**
```
3. Opening hours for each day exactly as shown on the page
Important: Extract hours exactly as displayed. Some restaurants have split hours (lunch and dinner). If the page shows continuous hours (e.g., "11am - 9pm"), return a single entry per day. Only create separate entries if there is an explicit gap/break shown on the page (e.g., "11am-2pm" then "5pm-9pm").
```

**Schema `period` field - Before:**
```javascript
period: { type: 'string', description: 'Optional: Lunch or Dinner if split hours' }
```

**Schema `period` field - After:**
```javascript
period: { type: 'string', description: 'Optional: Lunch or Dinner. Only use if there are multiple hours entires for this day' }
```

#### Location 2: Dynamic extraction endpoint - Lines ~6313-6346

**Schema `period` field - Updated to match Location 1**

**Prompt requestedInfo - Before:**
```javascript
'opening hours for each day - look for both lunch and dinner times if they exist separately'
```

**Prompt requestedInfo - After:**
```javascript
'opening hours for each day - check if lunch and dinner times exist separately'
```

**Platform-specific instructions - Before:**
```
Important: Some restaurants have split hours (lunch and dinner). Extract both time periods for each day if present. For day ranges like "Monday-Saturday", list each day separately.
```

**Platform-specific instructions - After:**
```
Important: Extract hours exactly as displayed. Some restaurants have split hours (lunch and dinner). Only extract multiple time periods for each day if there is a break between the times. For day ranges like "Monday-Saturday", list each day separately.
```

---

## Summary of Changes

1. **Address preservation:** UberEats address is now preserved and not overwritten by website
2. **Hours accuracy:** Prompts now emphasize extracting hours "exactly as displayed" rather than looking for splits
3. **Schema clarity:** Period field description clarified to only use when multiple entries exist
4. **Balanced approach:** Still supports legitimate split hours while discouraging hallucination

---

## Testing Notes

To verify the fixes work correctly:

1. **Address test:** Search for a restaurant that has both UberEats and website. Confirm the final address comes from UberEats (more specific).

2. **Hours test:** Search for a restaurant with continuous hours (e.g., `11am - 9pm`). Confirm Firecrawl returns a single entry per day, not split lunch/dinner.

3. **Split hours test:** Search for a restaurant that legitimately has split hours (e.g., closed between lunch and dinner). Confirm both periods are correctly extracted.
