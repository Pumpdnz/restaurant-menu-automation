# Investigation Task 3: Database Service Analysis

## Overview
This document details the `createMenuItems()` function in database-service.js and how menu items are persisted, focusing on the tags field handling.

## File Reference
**Primary File**: `UberEats-Image-Extractor/src/services/database-service.js`

---

## Function Location and Signature

**Lines 427-479**:
```javascript
async function createMenuItems(menuId, categoryMap, items, organisationId = null)
```

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| menuId | UUID | Menu to associate items with |
| categoryMap | Object | Maps category names to category IDs |
| items | Array | Menu item objects from extraction |
| organisationId | UUID (optional) | Organization ID for RLS |

---

## Data Transformation Logic

### Category Resolution (Lines 440-445)
```javascript
const categoryName = item.categoryName || item.category;
const categoryId = categoryMap[categoryName];

if (!categoryId) {
  console.warn(`[Database] No category found for item "${item.dishName}" with category "${categoryName}"`);
}
```

### Description Cleaning (Lines 448-449)
```javascript
const description = item.dishDescription || item.description;
const cleanDescription = (description && description !== 'null') ? description : null;
```

---

## Field Mapping: Extraction → Database

**Lines 451-464**:
```javascript
return {
  menu_id: menuId,
  category_id: categoryId,
  name: item.dishName || item.name,
  description: cleanDescription,
  price: item.dishPrice || item.price,
  currency: item.currency || 'NZD',
  tags: item.tags || [],              // <-- TAGS FIELD
  dietary_info: item.dietaryInfo || {},  // <-- DIETARY INFO FIELD
  platform_item_id: item.platformItemId,
  is_available: item.isAvailable !== false,
  metadata: item.metadata || {},
  organisation_id: orgId
};
```

---

## Current Tags Field Handling

**Key Finding**: Tags field is fully supported but receives data as-is:

```javascript
// Line 458
tags: item.tags || [],
```

**Current Behavior**:
- No transformation or detection logic applied
- Field is simply passed through to database
- Defaults to empty array if not provided
- No validation against preset tags
- No normalization or deduplication

---

## Supabase Insert Operation

**Lines 467-474**:
```javascript
const client = getSupabaseClient();
const { data, error } = await client
  .from('menu_items')
  .insert(itemData)
  .select();
```

Uses standard Supabase insert with `.select()` to return created records.

---

## How This Function Is Called

**In `saveExtractionResults()` (Line 1095)**:
```javascript
const itemRecords = await createMenuItems(
  menu.id,
  categoryMap,
  menuItems,
  job.organisation_id
);
```

**Calling Sequence (Lines 1026-1095)**:
1. Retrieves extraction job with organization context
2. Creates menu record
3. Creates categories and builds `categoryMap`
4. Calls `createMenuItems()` with extracted items
5. Creates item images using returned item records

---

## Database Schema (Inferred from Code)

**Confirmed `menu_items` Fields**:
| Column | Type | Notes |
|--------|------|-------|
| menu_id | UUID | FK to menus |
| category_id | UUID | FK to categories |
| name | string | From dishName/name |
| description | text | Cleaned description |
| price | numeric | From dishPrice/price |
| currency | string | Default 'NZD' |
| **tags** | JSONB | Array - currently empty |
| **dietary_info** | JSONB | Object - currently empty |
| platform_item_id | string | Platform-specific ID |
| is_available | boolean | Default true |
| metadata | JSONB | Additional data |
| organisation_id | UUID | For RLS |
| updated_at | timestamp | Auto-managed |

---

## Error Handling

**Lines 475-478**:
```javascript
catch (error) {
  console.error('[Database] Error creating menu items:', error);
  return [];
}
```

Returns empty array on failure - graceful degradation.

---

## Assessment: Integration Point for Tag Detection

### This Function is NOT Ideal Because:
1. **Input Validation**: By the time items reach `createMenuItems()`, all extraction and transformation should be complete
2. **Data Flow**: Tags should be computed during extraction processing, not at persistence time
3. **Separation of Concerns**: This function focuses on mapping and persisting data, not business logic

### Better Integration Point:
Tag detection logic should be integrated in the **calling function** (`saveExtractionResults()`) or in a **preprocessing step**, specifically:
- After extracting menuItems (line 1059)
- Before calling `createMenuItems()` (line 1095)

**OR**: Create a dedicated utility function called at that point

---

## Alternative: Centralized in `createMenuItems()`

If we WANT to centralize tag detection here:

**Pros**:
- Single point of change for ALL extraction flows
- Guaranteed tag processing for every item
- Standard and Premium extraction both covered

**Cons**:
- Mixes business logic with persistence layer
- Less efficient (processes every item at insert time)
- Harder to test tag detection in isolation

---

## Recommended Approach

**Create a separate utility function**:
```javascript
// New file: src/utils/tag-detection-service.js
function processMenuItemTags(items, categories) {
  return items.map(item => {
    const detectedTags = detectTags(item, categories);
    const cleanedName = stripAbbreviations(item.dishName || item.name);
    return {
      ...item,
      tags: detectedTags,
      dishName: cleanedName,
      name: cleanedName
    };
  });
}
```

**Call it in `saveExtractionResults()`**:
```javascript
// Line 1059 - after getting menuItems
const processedItems = processMenuItemTags(menuItems, categories);

// Line 1095 - use processedItems
const itemRecords = await createMenuItems(menu.id, categoryMap, processedItems, job.organisation_id);
```

---

## Summary

| Aspect | Finding |
|--------|---------|
| Function Purpose | Data mapping and persistence |
| Tags Field | Exists, receives data as-is, defaults to [] |
| Dietary Info Field | Exists, receives data as-is, defaults to {} |
| Current Processing | None - pure passthrough |
| Best Integration | Before `createMenuItems()` call in caller |
| Alternative | In `createMenuItems()` for centralization |
| Recommendation | Separate utility function for clean separation |
