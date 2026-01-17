# Investigation Synthesis: Automatic Tag Detection and Application

## Executive Summary

This document synthesizes findings from 4 parallel investigations into the menu extraction system to identify the optimal integration point for automatic tag detection and application.

**Recommendation**: Create a dedicated `tag-detection-service.js` utility called within `saveExtractionResults()` in `database-service.js`, which handles BOTH standard and premium extraction flows in a single location.

---

## Investigation Summary

### Task 1: Standard Extraction Flow
- **Endpoint**: `POST /api/batch-extract-categories` (server.js:1489)
- **Flow**: Category extraction → Aggregation → Database save
- **Tags arrive from**: Firecrawl schema (as-is, no processing)
- **Integration point**: Before `createMenuItems()` call

### Task 2: Premium Extraction Flow
- **Endpoint**: `POST /api/extract-menu-premium` (premium-extraction-service.js)
- **Flow**: 7 phases → Phase 7 transforms → Database save
- **Tags field**: Exists but never populated
- **Integration point**: Line 600, before `menuItemsForSaving`

### Task 3: Database Service
- **Function**: `createMenuItems()` (database-service.js:427)
- **Tags handling**: `tags: item.tags || []` (pure passthrough)
- **Dietary info**: `dietary_info: item.dietaryInfo || {}` (empty)
- **Integration point**: Before function call OR inside function

### Task 4: Extraction Schemas
- **Tags field**: Defined in schemas, Firecrawl extracts visible tags
- **Processing**: None - tags pass through unchanged
- **Preset tags**: Defined in `item-tags-constants.ts` but not used
- **Normalization**: Not implemented

---

## Key Finding: Convergence Point

**Both extraction flows converge at `saveExtractionResults()` in database-service.js (line 1026)**

```
Standard Extraction (server.js:327)
         │
         ├─── startBackgroundExtraction()
         │              │
         └──────────────┼──────────────────┐
                        │                  │
Premium Extraction      │                  │
(premium-extraction-service.js)            │
         │              │                  │
         └──────────────┼──────────────────┤
                        │                  │
                        ▼                  │
              saveExtractionResults()  ◄───┘
              (database-service.js:1026)
                        │
                        ▼
                  createMenuItems()
                  (database-service.js:427)
```

This convergence means **one integration point covers both flows**.

---

## Optimal Integration Point

### Recommended: Inside `saveExtractionResults()` before `createMenuItems()` call

**Location**: `database-service.js`, after line 1059 (menuItems extraction), before line 1095 (createMenuItems call)

**Why This Location**:
1. **Single point of change** - covers both standard and premium extraction
2. **All data available** - items have categoryName, descriptions, existing tags
3. **Categories available** - can detect vegetarian categories
4. **Before persistence** - clean separation from database layer
5. **Easy to test** - utility function can be unit tested independently

---

## Implementation Architecture

### New File: `src/services/tag-detection-service.js`

```javascript
// Tag detection rules
const ABBREVIATION_MAP = {
  '(V)': 'Vegetarian',
  '(Ve)': 'Vegan',
  '(GF)': 'Gluten Free',
  '(DF)': 'Dairy Free',
  '(NF)': 'Nut Free',
  '(H)': 'Halal'
};

const KEYWORD_TAG_MAP = {
  'vegetarian': 'Vegetarian',
  'vegan': 'Vegan',
  'gluten free': 'Gluten Free',
  'gluten-free': 'Gluten Free',
  'dairy free': 'Dairy Free',
  'dairy-free': 'Dairy Free',
  'nut free': 'Nut Free',
  'nut-free': 'Nut Free',
  'halal': 'Halal',
  'spicy': 'Spicy',
  'hot': 'Spicy'
};

const CONSOLIDATED_TAGS = {
  'combo': 'Deal',
  'deal': 'Deal',
  'popular': 'Popular',
  'signature': 'Popular',
  'recommended': 'Popular',
  'specialty': 'Popular',
  'must try': 'Popular',
  'new': 'New'
};

/**
 * Process menu items to detect and apply tags
 * @param {Array} items - Menu items from extraction
 * @param {Array} categories - Category names
 * @returns {Array} - Items with tags detected and names cleaned
 */
function processMenuItemTags(items, categories = []) {
  const vegetarianCategories = detectVegetarianCategories(categories);

  return items.map(item => {
    const detectedTags = new Set(item.tags || []);
    let cleanedName = item.dishName || item.name || '';

    // 1. Detect from category name
    if (vegetarianCategories.has(item.categoryName)) {
      detectedTags.add('Vegetarian');
    }

    // 2. Strip abbreviations from name and add tags
    for (const [abbrev, tag] of Object.entries(ABBREVIATION_MAP)) {
      if (cleanedName.includes(abbrev)) {
        cleanedName = cleanedName.replace(abbrev, '').trim();
        detectedTags.add(tag);
      }
    }

    // 3. Detect keywords in name and description
    const searchText = `${cleanedName} ${item.dishDescription || ''}`.toLowerCase();
    for (const [keyword, tag] of Object.entries(KEYWORD_TAG_MAP)) {
      if (searchText.includes(keyword)) {
        detectedTags.add(tag);
      }
    }

    // 4. Apply consolidated tags
    for (const [keyword, tag] of Object.entries(CONSOLIDATED_TAGS)) {
      if (searchText.includes(keyword)) {
        detectedTags.add(tag);
      }
    }

    return {
      ...item,
      tags: Array.from(detectedTags),
      dishName: cleanedName,
      name: cleanedName
    };
  });
}

/**
 * Detect categories that indicate vegetarian items
 */
function detectVegetarianCategories(categories) {
  const vegetarianKeywords = ['vegetarian', 'veg', 'plant-based', 'meatless'];
  const nonVegetarianKeywords = ['non vegetarian', 'non-vegetarian', 'non veg'];

  const vegetarianCategories = new Set();

  for (const category of categories) {
    const lowerCategory = category.toLowerCase();

    // Skip if explicitly non-vegetarian
    if (nonVegetarianKeywords.some(kw => lowerCategory.includes(kw))) {
      continue;
    }

    // Add if vegetarian keyword found
    if (vegetarianKeywords.some(kw => lowerCategory.includes(kw))) {
      vegetarianCategories.add(category);
    }
  }

  return vegetarianCategories;
}

module.exports = {
  processMenuItemTags,
  detectVegetarianCategories,
  ABBREVIATION_MAP,
  KEYWORD_TAG_MAP,
  CONSOLIDATED_TAGS
};
```

### Integration in `database-service.js`

```javascript
// At top of file
const { processMenuItemTags } = require('./tag-detection-service');

// In saveExtractionResults(), after line 1059
async function saveExtractionResults(jobId, extractionData) {
  // ... existing code ...

  const menuItems = extractionData.menuItems;
  const categories = extractionData.categories?.map(c => c.name) || [];

  // NEW: Process tags before saving
  const processedItems = processMenuItemTags(menuItems, categories);

  // ... rest of function uses processedItems instead of menuItems ...
  const itemRecords = await createMenuItems(menu.id, categoryMap, processedItems, job.organisation_id);
}
```

---

## Tag Detection Rules Summary

### 1. Category-Based Detection
| Category Contains | Applied Tag | Exclusion |
|-------------------|-------------|-----------|
| "vegetarian", "veg" | Vegetarian | "non vegetarian", "non-veg" |

### 2. Abbreviation Stripping (from item name)
| Abbreviation | Applied Tag | Name Cleanup |
|--------------|-------------|--------------|
| (V) | Vegetarian | Removed |
| (Ve) | Vegan | Removed |
| (GF) | Gluten Free | Removed |
| (DF) | Dairy Free | Removed |
| (NF) | Nut Free | Removed |
| (H) | Halal | Removed |

### 3. Keyword Detection (name + description)
| Keyword(s) | Applied Tag |
|------------|-------------|
| vegetarian | Vegetarian |
| vegan | Vegan |
| gluten free, gluten-free | Gluten Free |
| dairy free, dairy-free | Dairy Free |
| nut free, nut-free | Nut Free |
| halal | Halal |
| spicy, hot | Spicy |

### 4. Consolidated Tags
| Keyword(s) | Applied Tag |
|------------|-------------|
| combo, deal | Deal |
| popular, signature, recommended, specialty, must try | Popular |
| new | New |

---

## Files to Modify

| File | Change |
|------|--------|
| **NEW** `src/services/tag-detection-service.js` | Create tag detection utility |
| `src/services/database-service.js` | Import and call `processMenuItemTags()` |

---

## Benefits of This Approach

1. **Minimal code changes** - Only 2 files affected
2. **Single integration point** - Covers both extraction flows
3. **Testable** - Utility function can be unit tested
4. **Configurable** - Easy to add/modify tag rules
5. **Non-breaking** - Enhances existing data, doesn't change flow
6. **Maintainable** - Clear separation of concerns

---

## Alternative Considered: Premium Flow + Standard Flow Separately

**Rejected because**:
- Requires changes in 2 different locations
- Duplicated logic or shared import complexity
- Risk of divergent behavior between flows
- More maintenance overhead

---

## Next Steps

1. Create `tag-detection-service.js` with detection functions
2. Add unit tests for tag detection logic
3. Integrate into `saveExtractionResults()`
4. Test with sample extractions from both flows
5. Validate CSV export includes new tags
6. Monitor for edge cases in production

---

## Estimated Implementation Effort

| Task | Effort |
|------|--------|
| Create tag-detection-service.js | 1-2 hours |
| Write unit tests | 1 hour |
| Integrate into database-service.js | 30 min |
| End-to-end testing | 1 hour |
| **Total** | ~4 hours |
