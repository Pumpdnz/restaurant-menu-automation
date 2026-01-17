# Investigation Task 2: Premium Extraction Flow Analysis

## Overview
This document details the Premium Extraction flow (`/api/extract-menu-premium`) with focus on Phase 7 (Save to Database) and the data structure evolution through all phases.

## File Reference
**Primary File**: `UberEats-Image-Extractor/src/services/premium-extraction-service.js`

---

## Phase-by-Phase Data Structure Evolution

### Phase 1: Extract Categories (Lines 453-467)
**Input**: Store URL
**Output**: Array of category names

```javascript
// Lines 456-457
const categories = await this.extractCategories(storeUrl, orgId);
jobInfo.progress.categoriesExtracted = categories.length;
```

**Data Structure**:
```javascript
categories: string[] // ["Starters", "Mains", "Desserts", "Beverages"]
```

---

### Phase 2: Extract Menu Items (Lines 469-524)
**Input**: Store URL, Categories array
**Output**: Items with category assignment

**Key Code (Lines 481-524)**:
```javascript
const processCategory = async (category) => {
  try {
    const categoryItems = await this.extractCategoryItems(storeUrl, category, orgId);
    jobInfo.progress.itemsExtracted = allItems.length + categoryItems.length;
    jobInfo.progress.currentCategory = category;
    return { category, items: categoryItems, success: true };
  } catch (error) {
    return { category, items: [], success: false, error: error.message };
  }
};
```

**Item Structure After Phase 2 (Lines 202-205)**:
```javascript
return items.map(item => ({
  ...item,
  categoryName: categoryName  // Match standard extraction format
}));
```

**Complete Item Structure from Firecrawl (Lines 122-150)**:
```javascript
{
  dishName: string,
  dishPrice: number,
  dishDescription: string,
  modalUrl: string,
  imageUrl: string,
  categoryName: string  // Added by extractCategoryItems
}
```

---

### Phase 3: Clean URLs (Lines 528-532)
**Input**: Items with modal URLs
**Output**: Items with cleaned URLs

```javascript
jobInfo.progress.phase = 'cleaning_urls';
const cleaningResult = urlCleaningService.cleanBatchUrls(allItems, orgId);
const itemsWithCleanUrls = cleaningResult.items;
```

*No field additions - URL sanitization only*

---

### Phase 4: Extract Option Sets (Lines 534-548)
**Input**: Items with cleaned URLs
**Output**: Items with option sets data

```javascript
if (options.extractOptionSets) {
  jobInfo.progress.phase = 'extracting_option_sets';
  const optionSetsResult = await optionSetsService.batchExtract(
    itemsWithCleanUrls,
    orgId
  );
  itemsWithOptionSets = optionSetsResult.items;
}
```

**Item Enrichment**:
```javascript
item.optionSetsData = {
  optionSets: [...],
  imageUrl: string  // May have higher quality image from detail page
}
```

---

### Phase 5: Deduplicate Option Sets (Lines 550-568)
**Input**: Items with option sets
**Output**: Deduplicated option sets structure

```javascript
if (options.extractOptionSets && itemsWithOptionSets.some(item => item.optionSetsData?.optionSets)) {
  deduplicatedData = optionSetsDeduplicationService.deduplicateForDatabase(itemsWithOptionSets);
}
```

**Output Structure**:
```javascript
deduplicatedData = {
  masterOptionSets: [...],
  processedItems: [...],
  analysis: { stats: { sharedCount, uniqueCount, averageUsage } }
}
```

---

### Phase 6: Validate Images (Lines 570-576)
**Input**: Items with option sets
**Output**: Image validation results

```javascript
if (options.validateImages) {
  imageValidation = await imageValidationService.validateBatch(itemsWithOptionSets, orgId);
}
```

*No item modifications - validation tracking only*

---

### Phase 7: Save to Database (Lines 578-844)

#### 7.1 Critical Item Transformation (Lines 601-635)

**EXACT TRANSFORMATION CODE**:
```javascript
const menuItemsForSaving = itemsWithOptionSets.map(item => ({
  // Map imageUrl to imageURL (database expects uppercase)
  imageURL: item.imageUrl || item.imageURL || item.dishImageURL || null,

  // Map fields with fallbacks
  dishName: item.dishName || item.name,
  name: item.dishName || item.name,
  dishPrice: item.dishPrice || item.price,
  price: item.dishPrice || item.price,
  dishDescription: item.dishDescription || item.description,
  description: item.dishDescription || item.description,
  categoryName: item.categoryName,

  // Spread all other fields
  ...item,

  // Prioritize high-quality images, filter placeholders
  imageURL: (() => {
    const candidates = [
      item.optionSetsData?.imageUrl,
      item.imageUrl,
      item.imageURL,
      item.dishImageURL
    ];
    for (const url of candidates) {
      if (url && !url.includes('_static')) {
        return url;
      }
    }
    return null;
  })()
}));
```

#### 7.2 Extraction Data Structure (Lines 638-647)

```javascript
const extractionData = {
  menuItems: menuItemsForSaving,
  categories: categories.map((cat, idx) => ({
    name: cat,
    position: idx + 1,
    itemCount: menuItemsForSaving.filter(item =>
      item.categoryName === cat
    ).length
  }))
};
```

#### 7.3 Database Save Call (Lines 671-674)

```javascript
savedMenu = await databaseService.saveExtractionResults(
  jobId,
  extractionData
);
```

---

## Current Tag/Dietary Processing

**Search Results**:
- No existing tag detection logic in premium-extraction-service.js
- `tags` field in `createMenuItems()` defaults to empty array (line 458)
- `dietary_info` field defaults to empty object (line 459)

---

## Optimal Integration Points

### Option 1: After Phase 2 (Early Detection)
**Location**: Line 524 (after all items extracted)
**Pros**: Can detect tags early, clean abbreviations before processing
**Cons**: Would need to track tags through multiple phases

### Option 2: Before Phase 7 Transformation (RECOMMENDED)
**Location**: Line 600, just before `menuItemsForSaving`
**Pros**:
- Single point of tag detection
- Access to all enriched data
- Clean names available immediately
- Directly passed to database

### Option 3: In `createMenuItems()` Database Layer
**Location**: database-service.js:438-465
**Pros**: Single point for all extraction flows
**Cons**: Mixes business logic with persistence

---

## Recommended Integration

**BEST CHOICE: Option 2 - Before Phase 7 Transformation**

**Insert BEFORE line 601**:
```javascript
// Tag detection and name cleanup
const menuItemsWithTags = itemsWithOptionSets.map(item => {
  const detectedTags = detectMenuItemTags(item, categories);
  const cleanedName = cleanItemName(item.dishName || item.name);

  return {
    ...item,
    tags: detectedTags,
    dishName: cleanedName,
    name: cleanedName
  };
});

// Then use menuItemsWithTags instead of itemsWithOptionSets
const menuItemsForSaving = menuItemsWithTags.map(item => ({
  // ... existing transformation code
}));
```

---

## Data Available for Tag Detection in Phase 7

```javascript
{
  dishName: string,           // Item name (may contain abbreviations)
  dishDescription: string,    // Full description
  dishPrice: number,
  categoryName: string,       // Category from extraction
  optionSetsData: { ... }     // Option sets data
}

+ categories: string[]        // All category names available
```

---

## Summary

| Aspect | Finding |
|--------|---------|
| Current Tags Handling | Field exists but never populated (line 458) |
| Current Dietary Info | Field exists but never populated (line 459) |
| Optimal Integration | Phase 7, before menuItemsForSaving (line 600) |
| Data Available | dishName, dishDescription, categoryName, categories array |
| Field Mapping | All fields preserved through spread operator |
