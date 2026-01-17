# Investigation Task 4: Firecrawl Extraction Schemas Analysis

## Overview
This document details the Firecrawl extraction schemas used in the UberEats Image Extractor system, focusing on tag-related fields and existing text processing.

## File References
- **Primary File**: `UberEats-Image-Extractor/src/services/firecrawl-service.js`
- **Tag Constants**: `UberEats-Image-Extractor/src/lib/item-tags-constants.ts`
- **CSV Generator**: `UberEats-Image-Extractor/src/utils/csv-generator.js`

---

## Extraction Schemas Identified

### 1. DEFAULT_SCHEMA (Lines 36-84)

```javascript
const DEFAULT_SCHEMA = {
  type: 'object',
  properties: {
    menuName: {
      type: 'string',
      description: 'Menu section or category name'
    },
    categoryName: {
      type: 'string',
      description: 'Category (e.g., "Appetizers")'
    },
    dishName: {
      type: 'string',
      description: 'Item name'
    },
    dishPrice: {
      type: 'number',
      description: 'Numerical price'
    },
    dishDescription: {
      type: 'string',
      description: 'Full description'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any tags or attributes for this dish (e.g., "Spicy", "Vegetarian", "Gluten-Free")'
    },
    imageURL: {
      type: 'string',
      description: 'Highest resolution image URL'
    }
  },
  required: ['dishName', 'dishPrice', 'categoryName']
};
```

### 2. CATEGORY_DETECTION_SCHEMA (Lines 87-114)

Used for identifying menu categories before detailed extraction.
- Does NOT include tags field
- Only names, positions, and selectors

### 3. OPTION_SETS_SCHEMA (Lines 314-371)

For extracting customization options from menu items.
- Does NOT include tags field

---

## Dynamic Category Schema Generator

### `generateCategorySchema()` (Lines 264-311)

```javascript
function generateCategorySchema(categoryName, includeImages = true) {
  return {
    type: 'object',
    properties: {
      categoryName: { type: 'string' },
      menuItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dishName: { type: 'string' },
            dishPrice: { type: 'number' },
            dishDescription: {
              type: 'string',
              description: 'Full description. DO NOT include tags related to "most liked" or "Plus small"'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Any tags or attributes. DO NOT include tags related to "Thumb up outline" or percentages. DO NOT include "most liked" or "Plus small"'
            },
            imageURL: { /* conditional */ }
          },
          required: ['dishName', 'dishPrice']
        }
      }
    }
  };
}
```

**Note**: Schema explicitly excludes platform-specific UI tags but doesn't request specific dietary tags.

---

## Extraction Prompts

### DEFAULT_PROMPT (Lines 21-33)
```
Extract all menu items with their category, name, price, description, and image URLs
```

### Platform-Specific Category Prompts
- `UBEREATS_CATEGORY_PROMPT` (Lines 117-129)
- `DOORDASH_CATEGORY_PROMPT` (Lines 132-144)
- `GENERIC_CATEGORY_PROMPT` (Lines 147-163)
- OrderMeal, Mobi2Go, NextOrder, DeliverEasy, FoodHub (Lines 165-256)

**None of these prompts explicitly request dietary tag extraction.**

---

## Tag-Related Data Currently Extracted

### What IS Being Extracted
- Schema includes `tags` field as optional array of strings
- Firecrawl attempts to extract visible tags from page
- Tags are passed through to CSV generator

### What IS NOT Being Done
1. **No automatic tag detection logic** in code
2. **No abbreviation stripping** (e.g., "(GF)" → "Gluten Free")
3. **No dietary keyword detection** in descriptions
4. **No tag normalization** against preset tags
5. **No validation** of extracted tags

---

## Preset Tag Constants

**File**: `UberEats-Image-Extractor/src/lib/item-tags-constants.ts`

### Available Preset Tags (Lines 198-239)

**Dietary Tags**:
- Vegan, Vegetarian, Gluten free, Dairy free, Halal, Nut free, Spicy

**Popular Tags**:
- Popular, Most Liked, Favourite, Must Try, Recommended, Trending, Highly Rated, Specialty

**New Tags**:
- New, Limited Time, Limited Time Only, Seasonal, While Stock Lasts, Today Only

**Deal Tags**:
- Deal, Promo, Promotion, Special, Buy 1 Get 1, 2 for 1, Combo, Free Item, Free Gift, Discount

### Helper Functions (Lines 287-319)

```typescript
getTagStyle(tag)      // Get styling for tags
isPresetTag(tag)      // Check if tag is preset (O(1) lookup)
getTagCategory(tag)   // Get category of preset tag
normalizeTag(tag)     // Normalize for comparison
tagExists(tags, tag)  // Check if tag exists (case-insensitive)
```

---

## CSV Export Processing

**File**: `UberEats-Image-Extractor/src/utils/csv-generator.js`

**How Tags Are Handled (Lines 98-120)**:
```javascript
const tagsString = customItem.tags && Array.isArray(customItem.tags)
  ? customItem.tags.join(', ')
  : '';
```

**No processing** - tags are simply joined as comma-separated string.

---

## Existing Text Processing

### Image Extraction Helpers (`image-extraction-helpers.js`)

**`normalizeDishName()` (Lines 111-117)**:
```javascript
function normalizeDishName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- Only removes special characters and normalizes whitespace
- **NO tag detection or extraction logic**

---

## Missing Implementation Gap

### Critical Findings

1. **Tags ARE extracted by Firecrawl** but no downstream processing
2. **No automatic detection** for dietary indicators
3. **No abbreviation parsing** (e.g., "(GF)" → "Gluten Free")
4. **No validation** against preset constants
5. **No case normalization**
6. **Prompts exclude** unwanted tags but don't request specific ones

---

## Recommendations for Schema Changes

### Option 1: Enhanced Extraction Prompts
Modify prompts to explicitly request dietary tag detection:
```
For each item, also identify dietary attributes like:
- Vegetarian (V), Vegan (Ve), Gluten-Free (GF), Dairy-Free (DF), etc.
- Look for these in the item name, description, or visible badges
```

### Option 2: Post-Processing (RECOMMENDED)
Keep schemas as-is, add processing layer:
- Parse extracted tags for standardization
- Scan names/descriptions for keywords
- Apply abbreviation mappings
- Validate against preset tags

### Option 3: Hybrid Approach
- Enhance prompts slightly for better extraction
- Still apply post-processing for normalization

---

## Key Files for Implementation

| File | Purpose |
|------|---------|
| firecrawl-service.js | Schema definitions |
| server.js:400-600 | Backend Firecrawl integration |
| item-tags-constants.ts | Preset tag definitions |
| csv-generator.js | CSV export logic |
| **NEW**: tag-detection-service.js | Tag detection utilities |

---

## Summary

| Aspect | Finding |
|--------|---------|
| Schema Support | Tags field exists in all schemas |
| Current Extraction | Firecrawl extracts visible tags |
| Processing | None - pure passthrough |
| Normalization | None |
| Abbreviation Handling | Not implemented |
| Keyword Detection | Not implemented |
| Preset Tags | Defined but not used for validation |
| Recommendation | Post-processing layer for tag detection |
