# Investigation Task 1: Standard Extraction Flow Analysis

## Overview
This document details the complete Standard Extraction flow (`/api/batch-extract-categories`) to identify where automatic tag detection logic should be integrated.

## File References
- **Primary Endpoint**: `UberEats-Image-Extractor/server.js:1489`
- **Background Extraction**: `UberEats-Image-Extractor/server.js:327`
- **Database Service**: `UberEats-Image-Extractor/src/services/database-service.js`
- **Firecrawl Service**: `UberEats-Image-Extractor/src/services/firecrawl-service.js`

---

## Complete Flow Diagram

```
CLIENT REQUEST
    │
    ▼
POST /api/batch-extract-categories (server.js:1489)
    │
    ├─ Request Validation
    │  ├─ URL validation (validateRestaurantUrl)
    │  ├─ Categories array validation
    │  └─ API key check
    │
    ▼
├─ SYNCHRONOUS MODE (async=false)
│  ├─ Platform Detection (detectPlatform)
│  └─ Sequential Category Processing (for loop)
│     │
│     └─ FOR EACH CATEGORY:
│        ├─ Generate Category-Specific Schema (generateCategorySchema:264)
│        ├─ Generate Category-Specific Prompt
│        ├─ Create Firecrawl Payload (v2/scrape endpoint)
│        ├─ Rate Limiter (rateLimiter.acquireSlot)
│        ├─ Firecrawl API Call (axios POST to /v2/scrape)
│        ├─ Parse Response (data.json structure)
│        ├─ Extract categoryResult with menuItems array
│        └─ Aggregate to categoryResults array
│
│  RESULT AGGREGATION (server.js:1771)
│  ├─ flatMap all menuItems across categories
│  └─ Add categoryName to each item
│
│  RESPONSE TO CLIENT (server.js:1781)
│  └─ Return { success, data: { menuItems }, categories: { successful, failed } }
│
├─ ASYNC MODE (async=true)
│  ├─ IMMEDIATE RESPONSE with jobId
│  │
│  └─ START BACKGROUND EXTRACTION (startBackgroundExtraction:327)
│     ├─ Initialize job state in jobStore
│     ├─ Create extraction job in database (db.createExtractionJob)
│     ├─ Process categories with concurrency control (limit: 2)
│     │
│     └─ CATEGORY PROCESSING (processCategory:404)
│        ├─ Generate category schema (generateCategorySchema:418)
│        ├─ Rate limiter control
│        ├─ Firecrawl API call
│        └─ Extract and validate results
│
│  SAVE TO DATABASE (saveExtractionResults:1026)
│  ├─ Get extraction job record
│  ├─ Create Menu (createMenu:336)
│  ├─ Create Categories (createCategories:395)
│  ├─ Create Menu Items (createMenuItems:427)
│  ├─ Create Item Images (createItemImages:536)
│  └─ Update extraction job status to 'completed'
```

---

## Data Structures at Each Transformation Step

### Step 1: Firecrawl Response Structure
**Location**: server.js:1653-1693 / server.js:513-541

```javascript
parsedCategoryResponse = {
  success: boolean,
  data: {
    json: {
      categoryName: string,
      menuItems: [
        {
          dishName: string,
          dishPrice: number,
          dishDescription: string,
          tags: string[],      // <-- TAG DATA ARRIVES HERE
          imageURL: string     // (conditional by platform)
        }
      ]
    }
  }
}
```

### Step 2: After Aggregation
**Location**: server.js:1771-1776

```javascript
menuItems = [
  {
    ...item,              // All fields from Firecrawl response
    categoryName: string  // Added during aggregation
  }
]
```

### Step 3: Database Transform (createMenuItems)
**Location**: database-service.js:438-465

```javascript
itemData = [
  {
    menu_id: uuid,
    category_id: uuid,
    name: item.dishName,
    description: cleanDescription,
    price: item.dishPrice,
    currency: 'NZD',
    tags: item.tags || [],           // <-- DIRECTLY MAPPED
    dietary_info: item.dietaryInfo || {},
    platform_item_id: item.platformItemId,
    is_available: true,
    metadata: item.metadata || {},
    organisation_id: uuid
  }
]
```

---

## Key Transformation Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `batch-extract-categories` endpoint | server.js:1489 | Main API entry point |
| `detectPlatform` | src/utils/platform-detector.js | Detect platform type |
| `generateCategorySchema` | firecrawl-service.js:264 | Create Firecrawl schema |
| `startBackgroundExtraction` | server.js:327 | Async processing handler |
| `saveExtractionResults` | database-service.js:1026 | Save to database |
| `createMenuItems` | database-service.js:427 | Create item records |

---

## Current Tag Handling

**Existing Tag Processing:**
1. Tags arrive from Firecrawl as an array (schema defines at firecrawl-service.js:278-282)
2. Tags are directly stored in `menu_items.tags` column as JSONB (database-service.js:458)
3. Tags are exported to CSV without any transformation (server.js:807-809)
4. **No validation, cleanup, or standardization occurs**
5. **No abbreviation stripping** (e.g., "(V)", "(GF)") is implemented
6. Firecrawl prompt explicitly excludes certain platform tags: "DO NOT include tags related to 'Thumb up outline' or percentages"

---

## Recommended Integration Point

### Primary: `createMenuItems` function (database-service.js:427)

This is optimal because:
1. All items have been aggregated with category information
2. Items are being prepared for database insertion
3. All raw data (dishName, description, tags) is available
4. Single transformation point before storage
5. Works for both sync and async extraction modes

### Flow with Tag Detection:

```
createMenuItems (database-service.js:427)
    │
    ▼
FOR EACH item:
    ├─ Extract category info
    ├─ Detect tags from item fields:
    │  ├─ Parse existing tags array
    │  ├─ Scan dishName for abbreviations: (V), (Ve), (GF), (DF), (NF)
    │  ├─ Scan dishDescription for dietary keywords
    │  └─ Standardize detected tags
    │
    ├─ Build itemData object with:
    │  ├─ name (cleaned), description, price
    │  ├─ tags: [...detected + standardized...]  // ENHANCED
    │  └─ [other fields]
    │
    └─ Insert into menu_items table
```

---

## Data Available for Tag Detection

At `createMenuItems()`:
- `item.dishName` - Item name (may contain abbreviations)
- `item.dishDescription` - Full description (may contain keywords)
- `item.tags` - Existing tags from Firecrawl
- `item.categoryName` - Category context (e.g., "Vegetarian Options")
- `categoryMap` - All category names available

---

## Summary

| Aspect | Finding |
|--------|---------|
| Current Tags Handling | Passthrough only - no processing |
| Data Flow | Firecrawl → Aggregation → Database |
| Integration Point | `createMenuItems()` in database-service.js |
| Alternative | Before `saveExtractionResults()` call |
| Dependencies | dishName, dishDescription, categoryName, existing tags |
