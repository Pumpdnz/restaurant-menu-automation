# Image URL Duplication Analysis

Generated: 2025-09-04
Status: **Issue Identified - Fix Available**

---

## Problem Statement

Multiple menu items are showing the same image URLs in premium extraction, resulting in:
- Duplicate images stored in database
- Wasted CDN storage and bandwidth
- Poor visual variety in menus

---

## Root Cause Analysis

### Current Image URL Flow

```
Phase 2 (Category Extraction) → Phase 4 (Option Sets) → Phase 7 (Database Save)
       ↓                            ↓                         ↓
   item.imageUrl              Preserves item          Uses item.imageUrl
  (category page)             + adds optionSetsData    (duplicate images)
   [DUPLICATES]                .imageUrl               
                              (detail page)
                              [UNIQUE IMAGES]
```

### The Problem

1. **Phase 2** extracts `imageUrl` from category pages
   - These are often placeholder/generic images
   - Same image used for multiple items in category
   - Lower quality thumbnails

2. **Phase 4** extracts better images from item detail pages
   - Stored in `optionSetsData.imageUrl`
   - Higher resolution, unique per item
   - But NOT used in Phase 7!

3. **Phase 7** uses wrong priority:
   ```javascript
   // Current (line 579) - uses duplicate images
   imageURL: item.imageUrl || item.imageURL || item.dishImageURL || null
   
   // Should be - prioritize unique images from detail pages
   imageURL: item.optionSetsData?.imageUrl || item.imageUrl || item.imageURL || null
   ```

---

## Evidence

From extraction logs:
```
[Database] WARNING: Duplicate image URLs detected:
  - https://tb-static.uber.com/... appears 3 times
  - https://tb-static.uber.com/... appears 6 times
  - null... appears 7 times
```

---

## Solution

### Quick Fix (Phase 7 Priority Change)

Update `premium-extraction-service.js` line 579:

```javascript
// BEFORE (uses category page images - duplicates)
imageURL: item.imageUrl || item.imageURL || item.dishImageURL || null

// AFTER (prioritizes detail page images - unique)
imageURL: item.optionSetsData?.imageUrl || item.imageUrl || item.imageURL || item.dishImageURL || null
```

### Benefits
- Use higher quality images from detail pages when available
- Fall back to category images only if detail extraction failed
- Reduces duplicate images significantly
- No changes needed to extraction phases

---

## Alternative Solutions

### Option 1: Image Deduplication Service
Similar to option sets, create hash-based deduplication:
- Hash image URLs
- Store unique images once
- Create junction table for menu_item_images
- **Pros**: Maximum efficiency
- **Cons**: Complex implementation

### Option 2: Skip Duplicate URLs
Track seen URLs during extraction:
- Maintain Set of processed URLs
- Skip uploading duplicates to CDN
- **Pros**: Simple to implement
- **Cons**: Some items might have no images

### Option 3: Fetch Better Images in Phase 2
Enhance Phase 2 to click into items:
- Extract high-res images immediately
- Skip image extraction in Phase 4
- **Pros**: Single source of truth
- **Cons**: Slower extraction, more complex

---

## Recommended Approach

1. **Immediate**: Apply the quick fix to use Phase 4 images
2. **Short-term**: Monitor reduction in duplicates
3. **Long-term**: Consider image deduplication service if still an issue

---

## Testing the Fix

After applying the fix, check:
```sql
-- Count duplicate image URLs
SELECT image_url, COUNT(*) as usage_count
FROM menu_items
WHERE image_url IS NOT NULL
  AND organisation_id = 'your-org-id'
GROUP BY image_url
HAVING COUNT(*) > 1
ORDER BY usage_count DESC;
```

Expected: Significant reduction in duplicate counts

---

## Impact Analysis

### Before Fix
- Category pages show 5-10 unique images
- 50+ items share those same images
- Low visual variety

### After Fix  
- Each item has its unique detail page image
- Fallback to category image if needed
- High visual variety

---

*Analysis Date: 2025-09-04*
*Fix Status: Ready to implement*