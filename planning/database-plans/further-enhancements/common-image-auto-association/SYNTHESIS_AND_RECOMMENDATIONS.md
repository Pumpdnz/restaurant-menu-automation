# Synthesis: Automatic Common Image Association

## Investigation Summary

Four parallel investigations were completed to understand how to implement automatic common image association for menu items missing images during extraction processing.

| Task | Focus Area | Key Finding |
|------|------------|-------------|
| Task 1 | Extraction Flow | Integration point: After line 1120 in `saveExtractionResults()` |
| Task 2 | Common Images Library | Use `getSuggestedImages()` with 0.70 confidence threshold |
| Task 3 | Image Storage | UCarecdn.com URLs are valid; use `cdn_metadata` for source tracking |
| Task 4 | Integration Approach | Create `common-images-service.js` following tag-detection pattern |

---

## Optimal Integration Approach

### Architecture Decision

**Create a new JavaScript service: `common-images-service.js`**

This follows the established pattern of `tag-detection-service.js` and provides:
- Clean separation of concerns
- Backend compatibility (CommonJS)
- Reusable matching logic
- Easy testing and maintenance

### Integration Point

**Location:** `database-service.js`, lines 1120-1121

**Position in Flow:**
```
1. saveExtractionResults() called
2. Categories created
3. Menu items processed with tags
4. Menu items inserted to database → itemRecords returned
5. ItemImageMap built from extracted images
   ↓
   *** INSERT COMMON IMAGE ASSOCIATION HERE ***
   ↓
6. createItemImages() called with final itemImageMap
7. Job marked complete
```

---

## Recommended Implementation

### Step 1: Create common-images-service.js

**File:** `/src/services/common-images-service.js`

```javascript
/**
 * Common Images Service
 *
 * Provides automatic association of common product images (beverages, etc.)
 * to menu items that are missing images during extraction.
 */

// Copy common images data from TS constants
const COMMON_IMAGES = [
  {
    id: 'coke-can',
    name: 'Coke Can',
    aliases: ['coke', 'coca cola', 'coca-cola'],
    matchKeywords: ['coke can', 'coca cola can', 'coke 330ml'],
    imageUrl: 'https://ucarecdn.com/...',
    confidence: 0.95
  },
  // ... all 23 images
];

/**
 * Get suggested images for a menu item name
 */
function getSuggestedImages(itemName, minConfidence = 0.7) {
  const normalized = itemName.toLowerCase().trim();
  const results = [];

  for (const image of COMMON_IMAGES) {
    let confidence = 0;
    const baseConfidence = image.confidence || 0.9;

    // Exact name or alias match
    if (image.name.toLowerCase() === normalized ||
        image.aliases.some(a => a.toLowerCase() === normalized)) {
      confidence = baseConfidence;
    }
    // Keyword match
    else if (image.matchKeywords.some(kw => normalized.includes(kw.toLowerCase()))) {
      confidence = baseConfidence * 0.85;
    }
    // Name contains match
    else if (normalized.includes(image.name.toLowerCase())) {
      confidence = baseConfidence * 0.75;
    }
    // Partial keyword match
    else {
      for (const kw of image.matchKeywords) {
        const words = kw.toLowerCase().split(' ');
        if (words.some(w => w.length > 3 && normalized.includes(w))) {
          confidence = Math.max(confidence, baseConfidence * 0.6);
        }
      }
    }

    if (confidence >= minConfidence) {
      results.push({ image, confidence });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Process menu items and associate common images where applicable
 */
function processCommonImageAssociations(itemRecords, processedMenuItems, existingImageMap) {
  const associations = {};
  let matchCount = 0;
  let skipCount = 0;

  itemRecords.forEach((item, index) => {
    // Skip if already has an image
    if (existingImageMap[item.id]) {
      skipCount++;
      return;
    }

    const originalItem = processedMenuItems[index];
    if (!originalItem) return;

    const suggestions = getSuggestedImages(originalItem.name, 0.7);
    if (suggestions.length > 0) {
      const best = suggestions[0];
      associations[item.id] = {
        url: best.image.imageUrl,
        metadata: {
          source: 'common-images',
          imageId: best.image.id,
          imageName: best.image.name,
          confidence: best.confidence,
          matchedItemName: originalItem.name,
          associatedAt: new Date().toISOString()
        }
      };
      matchCount++;
    }
  });

  console.log(`[Common Images] Processed ${itemRecords.length} items: ${matchCount} matched, ${skipCount} already had images`);

  return associations;
}

module.exports = {
  getSuggestedImages,
  processCommonImageAssociations,
  COMMON_IMAGES
};
```

### Step 2: Modify database-service.js

**Location:** After line 1120 (after itemImageMap is built)

```javascript
const { processCommonImageAssociations } = require('./common-images-service');

// ... existing code ...

// After building itemImageMap from extracted images (line 1120)

// Auto-associate common images for items without images
const commonImageAssociations = processCommonImageAssociations(
  itemRecords,
  processedMenuItems,
  itemImageMap
);

// Add common image associations to itemImageMap
for (const [itemId, association] of Object.entries(commonImageAssociations)) {
  itemImageMap[itemId] = association.url;
}

// Continue with existing createItemImages call (line 1123)
```

### Step 3: Track Source Metadata (Optional Enhancement)

To track which images were auto-associated, modify `createItemImages()` to accept metadata:

```javascript
// In createItemImages, add cdn_metadata for common images
if (association.metadata) {
  imageData.push({
    menu_item_id: itemId,
    url: association.url,
    type: 'primary',
    organisation_id: orgId,
    cdn_metadata: association.metadata  // Track source
  });
}
```

---

## Key Recommendations

### 1. Confidence Threshold: 0.70

- Balanced between precision and recall
- Catches "Coke", "Diet Coke", "Sprite Zero" variations
- Avoids false positives on generic terms

### 2. UCarecdn.com URLs

- Already validated by existing `isValidImageUrl()` function
- No changes needed to URL validation

### 3. Source Tracking

Use `cdn_metadata` JSONB column to store:
```json
{
  "source": "common-images",
  "imageId": "coke-can",
  "confidence": 0.95,
  "associatedAt": "2025-01-07T..."
}
```

This enables:
- Querying auto-associated vs extracted images
- Audit trail for associations
- Confidence-based filtering in UI

### 4. Future Expansion

The common images library currently has 23 beverages. Consider adding:
- Sides (fries, wedges, onion rings)
- Condiments (sauces, dressings)
- Desserts (ice cream, brownies)
- Hot drinks (tea varieties)

---

## Implementation Checklist

- [ ] Create `common-images-service.js` with image data and matching functions
- [ ] Add import to `database-service.js`
- [ ] Insert common image processing after line 1120
- [ ] Add associations to itemImageMap before createItemImages call
- [ ] (Optional) Modify createItemImages to accept metadata
- [ ] Test with sample extractions
- [ ] Monitor match rates and adjust confidence threshold if needed

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Items without images | ~15-20% | ~5-10% |
| Manual image assignment needed | High | Reduced for common items |
| Extraction completion speed | Same | Same (minimal overhead) |

---

## File References

| File | Purpose |
|------|---------|
| [INVESTIGATION_TASK_1_EXTRACTION_IMAGE_FLOW.md](./INVESTIGATION_TASK_1_EXTRACTION_IMAGE_FLOW.md) | Extraction flow details |
| [INVESTIGATION_TASK_2_COMMON_IMAGES_LIBRARY.md](./INVESTIGATION_TASK_2_COMMON_IMAGES_LIBRARY.md) | Library analysis |
| [INVESTIGATION_TASK_3_IMAGE_STORAGE.md](./INVESTIGATION_TASK_3_IMAGE_STORAGE.md) | Storage schema |
| [INVESTIGATION_TASK_4_INTEGRATION_APPROACH.md](./INVESTIGATION_TASK_4_INTEGRATION_APPROACH.md) | TS/JS interop |

---

## Conclusion

The investigation confirms that automatic common image association is feasible and straightforward to implement. The optimal approach is:

1. **Create** `common-images-service.js` following the tag-detection pattern
2. **Integrate** after line 1120 in `saveExtractionResults()`
3. **Use** `getSuggestedImages()` with 0.70 confidence threshold
4. **Track** associations via `cdn_metadata` for auditability

This will reduce the number of menu items without images by automatically matching common beverages and other products from the existing library.
