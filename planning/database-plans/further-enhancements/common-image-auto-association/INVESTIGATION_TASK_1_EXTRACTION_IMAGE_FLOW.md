# Investigation Task 1: Extraction Flow and Image Handling

## Executive Summary

This investigation traces how images flow from extraction data to the `item_images` database table, identifying the optimal integration point for automatic common image association.

---

## 1. Complete Image Flow from Extraction to Database

**File Location:** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/services/database-service.js`

### Flow Steps:

1. **Extraction Data Received** (Line 1027)
   - `saveExtractionResults(jobId, extractionData)` is called with jobId and extraction data

2. **Menu Items Processing** (Lines 1059-1106)
   - Menu items extracted from `extractionData.menuItems` array
   - Items are processed through `processMenuItemTags()` to detect tags (Line 1065)
   - Creates an array called `processedMenuItems` with tags applied

3. **Menu Items Created in Database** (Line 1106)
   - `createMenuItems(menu.id, categoryMap, processedMenuItems, job.organisation_id)` is called
   - This inserts menu items into the `menu_items` table
   - Returns `itemRecords` array with created items including their database IDs

4. **ItemImageMap Construction** (Lines 1110-1120)
   - **Critical section for integration point**
   - Maps between newly created item IDs and image URLs
   - Iterates through `itemRecords` by index

5. **Create Item Images** (Line 1123)
   - `createItemImages(itemImageMap, job.organisation_id)` is called
   - Only items that were added to `itemImageMap` get images inserted

---

## 2. How itemImageMap is Constructed

**Lines 1108-1120 Detail:**

```javascript
itemRecords.forEach((item, index) => {
  const originalItem = processedMenuItems[index];
  if (originalItem && (originalItem.imageURL || originalItem.dishImageURL)) {
    const imageUrl = originalItem.imageURL || originalItem.dishImageURL;
    itemImageMap[item.id] = imageUrl;
  } else {
    // Items without images are logged but NOT added to itemImageMap
    console.log(`[Database] Mapping: Item[${index}] "${item.name}" (id: ${item.id}) -> NO IMAGE`);
  }
});
```

**Key Points:**
- **Purpose:** Create a mapping of menu item IDs to their image URLs
- **Data Structure:** `{ [itemId]: imageUrl }`
- **Construction Method:** Iterates through created `itemRecords` array, matching by index
- **Acceptance Criteria:** Original item must have either `imageURL` or `dishImageURL` property
- **Rejection:** Items without these properties are NOT added to map

---

## 3. What Happens to Items WITHOUT Images

**Lines 1076-1096 (Debug Analysis) and 1117-1119 (Mapping):**

**Current Behavior:**
1. Items without images are tracked in `itemsWithoutImages` array (Line 1076)
2. They are logged to console as debug output (Lines 1094-1096)
3. They are skipped during itemImageMap construction (Line 1117-1118)
4. **Critically:** Items without images are NOT passed to `createItemImages()`
5. As a result, items without images have no row in the `item_images` table

**Debug Output Shows:**
- Count of items with images vs. without (Lines 1090-1096)
- Sample items from each category logged

---

## 4. Recommended Integration Point for Common Image Association

### OPTIMAL LOCATION: Between lines 1120 and 1121

**After itemImageMap is built but before createItemImages is called**

### Why This Location:

1. **All necessary data is available:**
   - `itemRecords` - Created items with database IDs
   - `processedMenuItems` - Original items with names and descriptions
   - `itemImageMap` - Built but not yet finalized

2. **Can modify itemImageMap before database insert:**
   - Iterate through items that weren't added to itemImageMap
   - Match against common images
   - Add matches to itemImageMap with confidence scoring

3. **Follows existing pattern:**
   - Tag detection happens BEFORE database inserts (Line 1065)
   - Image mapping happens AFTER item creation but BEFORE image insert
   - New logic would fit naturally between lines 1120-1121

### Integration Logic:

```
FOR EACH itemRecord in itemRecords:
  IF itemRecord.id NOT IN itemImageMap:
    GET originalItem from processedMenuItems at same index
    CALL matching function with originalItem.name
    IF confidence >= threshold (e.g., 0.7):
      ADD itemRecord.id -> matchedImageUrl TO itemImageMap
```

---

## 5. Items Without Images - Are They Passed to createItemImages()?

**Answer: NO - Only items in itemImageMap are processed**

**Details from createItemImages() function (Lines 537-594):**

- **Input:** `itemImageMap` (key-value pairs of itemId -> imageUrl)
- **Processing (Line 547):** `for (const [itemId, images] of Object.entries(itemImageMap))`
- **Only items that exist as keys in itemImageMap are processed**
- **Items without extracted images never enter this function**

---

## 6. Complete Code Flow Visualization

```
1. saveExtractionResults(jobId, extractionData) [Line 1027]
   ↓
2. Extract categories → createCategories() [Line 1051]
   ↓
3. Extract menu items from extractionData.menuItems [Line 1060]
   ↓
4. processMenuItemTags(menuItems, categoryNames) [Line 1065]
   → Returns processedMenuItems with tags
   ↓
5. createMenuItems(menu.id, categoryMap, processedMenuItems, orgId) [Line 1106]
   → Returns itemRecords with database IDs
   ↓
6. **CURRENT IMAGE MAPPING** [Lines 1110-1120]
   itemRecords.forEach((item, index) => {
     originalItem = processedMenuItems[index]
     IF originalItem has imageURL/dishImageURL:
       itemImageMap[item.id] = imageUrl
   })

   **← INTEGRATION POINT FOR COMMON IMAGES (Lines 1120-1121) ←**

   ↓
7. createItemImages(itemImageMap, orgId) [Line 1123]
   → Inserts into item_images table
   ↓
8. updateExtractionJob status to 'completed' [Line 1126]
```

---

## 7. File References with Line Numbers

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| saveExtractionResults | database-service.js | 1027-1160 | Main extraction save function |
| Image analysis/debugging | database-service.js | 1072-1104 | Tracks items with/without images |
| ItemImageMap construction | database-service.js | 1108-1120 | Maps items to extracted images |
| createItemImages | database-service.js | 537-594 | Inserts images into database |
| createMenuItems | database-service.js | 428-480 | Creates menu items in database |
| Common Images Library | common-images-constants.ts | 1-417 | Beverage images with matching |
| Tag Detection | tag-detection-service.js | 1-200+ | Similar integration pattern |

---

## 8. Key Observations for Implementation

1. **Index-based Matching:** The current system relies on index ordering being preserved. The same approach would work for common images.

2. **Items Without Images Are Identifiable:** The code already debugs items without images (Lines 1076-1096), making it easy to target these items for common image matching.

3. **Clean Integration Point:** The location between itemImageMap building and database insert (after line 1120) is the cleanest integration point with minimal risk.

4. **Existing Library Ready:** The common-images-constants.ts already has `getSuggestedImages()` function that can be called directly.

5. **Validation:** The `isValidImageUrl()` function (Lines 490-535) already validates that UCare CDN URLs are acceptable.
