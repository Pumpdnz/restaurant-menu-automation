# Investigation Plan: Automatic Tag Detection and Application

## Overview

This investigation aims to understand the complete flow of menu extraction, processing, and saving to identify the optimal integration points for automatic tag detection and application. The feature will automatically analyze menu items during extraction processing and apply appropriate tags based on category names, item names, and descriptions.

### Feature Requirements

The automatic item tag application will involve three key phases:

1. **Menu Item Analysis** - Detect tag-worthy terms in categories, names, and descriptions
2. **Menu Item Name Modification** - Strip abbreviated tags like "(GF)", "(V)" from names
3. **Item Tag Application** - Add the appropriate tags to menu items before saving

### Tag Detection Rules

| Detection Term | Applied Tag | Notes |
|----------------|-------------|-------|
| vegetarian (in category) | Vegetarian | Exclude "non vegetarian" |
| vegetarian, vegan, gluten free, dairy free, nut free, halal | Same as term | Case-insensitive, hyphen support |
| spicy, hot | Spicy | Consolidated |
| combo, deal | Deal | Consolidated |
| popular, signature, recommended, specialty, must try | Popular | Consolidated |
| new | New | - |

### Name Cleanup Rules

| Abbreviation | Replaced By Tag | Example |
|--------------|-----------------|---------|
| (GF) | Gluten Free | "Taco (GF)" → "Taco" + tag |
| (NF) | Nut Free | "Burger (NF)" → "Burger" + tag |
| (V) | Vegetarian | "Salad (V)" → "Salad" + tag |
| (Ve) | Vegan | "Bowl (Ve)" → "Bowl" + tag |
| (DF) | Dairy Free | "Pizza (DF)" → "Pizza" + tag |

---

## Known Information

### From Initial Investigation

1. **Two Extraction Flows Exist:**
   - **Standard Extraction** (`POST /api/batch-extract-categories`) - Category-based extraction
   - **Premium Extraction** (`POST /api/extract-menu-premium`) - 7-phase full menu extraction

2. **Premium Extraction Phases:**
   - Phase 1: Extract Categories
   - Phase 2: Extract Menu Items (concurrent)
   - Phase 3: Clean URLs
   - Phase 4: Extract Option Sets
   - Phase 5: Deduplicate Option Sets
   - Phase 6: Validate Images
   - Phase 7: Save to Database

3. **Key Files Identified:**
   - `server.js` - Extraction endpoints (lines 1489 and 1977)
   - `premium-extraction-service.js` - 7-phase orchestration
   - `database-service.js` - `createMenuItems()` at line 427
   - `firecrawl-service.js` - Extraction schemas and prompts

4. **Data Transformation Occurs:**
   - Premium: Lines 601-635 in `premium-extraction-service.js`
   - Items mapped to database schema before `saveExtractionResults()`
   - `createMenuItems()` handles final mapping and bulk insert

5. **Tags Field Exists:**
   - Menu items support a `tags` array field
   - Currently manually added via EditableMenuItem UI

---

## Instructions

Execute this investigation using the **Task tool** to spin up **4 parallel subagents**. Each subagent should:

1. **Only investigate** - DO NOT modify any code
2. Create an investigation document in `planning/database-plans/item-tags-enhancements/automatic-detection-and-application/` as its deliverable
3. Report findings with file paths and line numbers

**After all subagents complete:**
1. Read all 4 investigation documents
2. Synthesize findings into a coherent summary
3. Identify the optimal integration point(s) for the tag detection feature
4. Provide recommendations for implementation approach

---

## subagent_1_instructions

### Context
We need to understand the **Standard Extraction** flow to identify where tag detection logic should be integrated for category-based extractions.

### Instructions
1. Read `server.js` and find the `/api/batch-extract-categories` endpoint (around line 1489)
2. Trace the complete flow from request to database save
3. Identify:
   - How extraction data is structured after Firecrawl returns
   - Where/how data is transformed before saving
   - The function that saves menu items to the database
   - If there's any existing tag or dietary info processing
4. Look for any shared processing functions between standard and premium extraction
5. Document the data structure at each transformation step

### Deliverable
Create `INVESTIGATION_TASK_1_STANDARD_EXTRACTION.md` with:
- Complete flow diagram from endpoint to database
- Data structure at each step
- Transformation functions identified with file:line references
- Current tag handling (if any)
- Recommended integration point for tag detection

### Report
Include specific file paths and line numbers for all findings.

---

## subagent_2_instructions

### Context
We need to understand the **Premium Extraction** flow, specifically Phase 7 (Save to Database) where items are transformed before saving.

### Instructions
1. Read `premium-extraction-service.js` thoroughly
2. Focus on:
   - Phase 2: How items are structured after category extraction (lines ~469-524)
   - Phase 7: Data transformation before saving (lines ~601-635)
   - How `extractionData` is structured for `saveExtractionResults()`
3. Identify the exact point where `menuItems` array is finalized
4. Look for any existing tag/dietary processing
5. Document the item object structure at each phase

### Deliverable
Create `INVESTIGATION_TASK_2_PREMIUM_EXTRACTION.md` with:
- Phase-by-phase data structure evolution
- Exact transformation code for Phase 7 (copy relevant snippets)
- Point where tags could be injected into items
- Any existing preprocessing of menu item fields
- Recommended integration point(s)

### Report
Include specific file paths and line numbers for all findings.

---

## subagent_3_instructions

### Context
We need to understand the **database-service.js** `createMenuItems()` function and how items are persisted.

### Instructions
1. Read `database-service.js` focusing on `createMenuItems()` (line ~427)
2. Understand:
   - Input parameters and expected structure
   - How fields are mapped from extraction data to database schema
   - If/how `tags` field is handled
   - The Supabase insert operation
3. Check `saveExtractionResults()` (line ~1026) for context on how it's called
4. Look at the `menu_items` table schema (search for migrations or type definitions)
5. Identify if any data transformation happens in this function

### Deliverable
Create `INVESTIGATION_TASK_3_DATABASE_SERVICE.md` with:
- `createMenuItems()` function signature and logic
- Field mapping from extraction → database
- Current `tags` field handling
- Database schema for menu_items (if found)
- Whether this function or the caller is better for tag injection

### Report
Include specific file paths and line numbers for all findings.

---

## subagent_4_instructions

### Context
We need to understand the **Firecrawl extraction schemas** to see what data is available at extraction time and if tags are already being extracted.

### Instructions
1. Read `firecrawl-service.js` for extraction schemas
2. Look for:
   - `DEFAULT_SCHEMA`, `UBEREATS_SCHEMA`, `DOORDASH_SCHEMA`
   - What fields are extracted (name, description, price, dietary info, etc.)
   - If there are any tag-related fields in the schema
   - The extraction prompts used
3. Check if any dietary/tag information is extracted but not used
4. Look for any existing regex or text processing for menu items

### Deliverable
Create `INVESTIGATION_TASK_4_EXTRACTION_SCHEMAS.md` with:
- Full extraction schema definitions
- Fields currently extracted that relate to tags/dietary
- Extraction prompts that might capture tag-relevant info
- Any existing text processing or normalization
- Recommendations for schema changes if needed

### Report
Include specific file paths and line numbers for all findings.

---

## Expected Outputs

After investigation completion, the following files should exist:
1. `INVESTIGATION_TASK_1_STANDARD_EXTRACTION.md`
2. `INVESTIGATION_TASK_2_PREMIUM_EXTRACTION.md`
3. `INVESTIGATION_TASK_3_DATABASE_SERVICE.md`
4. `INVESTIGATION_TASK_4_EXTRACTION_SCHEMAS.md`

These will inform the implementation plan for automatic tag detection and application.

---

## Integration Point Hypothesis

Based on initial investigation, the likely best integration point is:

**Option A: Create a new utility function `processMenuItemTags(items, categories)`**
- Called after extraction, before database save
- Works for both standard and premium flows
- Input: raw extracted items array + categories
- Output: items with tags added and names cleaned

**Option B: Integrate into `createMenuItems()` in database-service.js**
- Centralizes all item processing
- Single point of change
- May mix concerns (persistence vs business logic)

The investigation should validate which approach is optimal.
