# Investigation Plan: Automatic Common Image Association

## Overview

This investigation aims to understand how to implement automatic image association for menu items that are missing images during extraction processing. The feature will match menu item names against a library of common product images (beverages like Coke, Sprite, Fanta, L&P, Red Bull, water, etc.) and automatically associate matching images.

### Feature Requirements

1. **Detect items without images** - Identify menu items that have no imageURL after extraction
2. **Match against common images** - Use the common-images-constants.ts library to find matching images
3. **Auto-associate with confidence threshold** - Only apply images that meet a minimum confidence score
4. **Integrate into extraction flow** - Process during saveExtractionResults(), similar to tag detection

### Expected Behavior

| Menu Item Name | Match Result | Confidence | Action |
|----------------|--------------|------------|--------|
| "Coke Can" | coke-can | 0.95 | Associate image |
| "Coca Cola" | coke-can | 0.90 | Associate image |
| "Sprite" | sprite-can | 0.95 | Associate image |
| "L&P" | lp-can | 0.85 | Associate image |
| "Mystery Drink" | No match | - | Skip |
| "Burger" (has image) | - | - | Skip (already has image) |

---

## Known Information

### From Initial Investigation

1. **Common Images Library Exists:**
   - File: `UberEats-Image-Extractor/src/lib/common-images-constants.ts`
   - Contains 23+ beverage images with UCare CDN URLs
   - Each image has: id, name, category, imageUrl, aliases, matchKeywords, confidence
   - Categories: beverage, side (empty), condiment (empty)

2. **Existing Matching Functions:**
   - `getSuggestedImages(itemName, minConfidence)` - Returns matching images with confidence scores
   - `searchCommonImages(query, limit)` - Search by query string
   - Uses hierarchical matching: exact match → alias match → keyword match → partial match

3. **Image Storage:**
   - Images stored in `item_images` table via `createItemImages(itemImageMap, orgId)`
   - itemImageMap format: `{ itemId: imageUrl }` or `{ itemId: [{ url, type }] }`
   - Validates URLs with `isValidImageUrl()` before insert

4. **Tag Detection Integration Point:**
   - Tag detection added in `saveExtractionResults()` after line 1060
   - Processes items before `createMenuItems()` call
   - Same pattern could be used for image association

5. **Current Image Flow:**
   - Extraction provides `imageURL` or `dishImageURL` on items
   - `saveExtractionResults()` builds `itemImageMap` from extracted URLs
   - `createItemImages()` inserts into `item_images` table

---

## Instructions

Execute this investigation using the **Task tool** to spin up **4 parallel subagents**. Each subagent should:

1. **Only investigate** - DO NOT modify any code
2. Create an investigation document in `planning/database-plans/common-image-auto-association/` as its deliverable
3. Report findings with file paths and line numbers

**After all subagents complete:**
1. Read all 4 investigation documents
2. Synthesize findings into a coherent summary
3. Identify the optimal integration approach
4. Provide recommendations for implementation

---

## subagent_1_instructions

### Context
We need to understand the **extraction flow and image handling** to identify where common image association should be integrated.

### Instructions
1. Read `UberEats-Image-Extractor/src/services/database-service.js`
2. Focus on `saveExtractionResults()` function (around line 1026)
3. Trace how images flow from extraction data to `item_images` table:
   - How `itemImageMap` is built (around line 1100-1110)
   - How `createItemImages()` is called
   - What happens to items WITHOUT images
4. Identify the exact point where we could inject common image matching for items missing images
5. Check if items without images are even passed to `createItemImages()`

### Deliverable
Create `INVESTIGATION_TASK_1_EXTRACTION_IMAGE_FLOW.md` with:
- Complete image flow from extraction to database
- How itemImageMap is constructed
- What happens to items without images
- Recommended integration point for common image association
- Code snippets showing current flow

### Report
Include specific file paths and line numbers for all findings.

---

## subagent_2_instructions

### Context
We need to understand the **common-images-constants.ts library** and how its matching functions work.

### Instructions
1. Read `UberEats-Image-Extractor/src/lib/common-images-constants.ts` completely
2. Analyze:
   - The CommonImage interface structure
   - How `getSuggestedImages()` works and its confidence scoring
   - How `searchCommonImages()` differs from `getSuggestedImages()`
   - The confidence values on each image
3. Test mentally with examples: "Coke", "Coca Cola", "Diet Coke", "Sprite Zero"
4. Identify if this is TypeScript and whether we need a JS wrapper for use in database-service.js

### Deliverable
Create `INVESTIGATION_TASK_2_COMMON_IMAGES_LIBRARY.md` with:
- Full interface definitions
- How matching/scoring works
- Which function to use for auto-association
- Recommended confidence threshold
- Whether we need JS wrapper or can use directly
- List of all available common images

### Report
Include specific file paths and line numbers for all findings.

---

## subagent_3_instructions

### Context
We need to understand the **item_images table schema** and how images are associated with menu items.

### Instructions
1. Read `createItemImages()` in database-service.js (around line 537)
2. Check:
   - What columns exist in `item_images` table
   - How `isValidImageUrl()` works
   - Whether common image URLs (ucarecdn.com) would pass validation
   - If there's a way to mark images as "auto-associated" vs "extracted"
3. Look for any existing image-related utilities or validation
4. Check if there's a way to add metadata to indicate source of image

### Deliverable
Create `INVESTIGATION_TASK_3_IMAGE_STORAGE.md` with:
- item_images table schema (inferred from code)
- Validation rules for image URLs
- Whether ucarecdn.com URLs will be accepted
- Recommendations for tracking auto-associated images
- Any limitations or considerations

### Report
Include specific file paths and line numbers for all findings.

---

## subagent_4_instructions

### Context
We need to understand **how to integrate TypeScript utilities from a JS file** and design the integration approach.

### Instructions
1. Check how other TypeScript files are used in the project
2. Look for existing patterns of JS files importing from TS files
3. Review the tag-detection-service.js for patterns we can follow
4. Consider:
   - Should we create a JS wrapper for common-images-constants.ts?
   - Or convert getSuggestedImages to a JS service?
   - How to handle the TypeScript types in JS context
5. Draft a proposed implementation approach

### Deliverable
Create `INVESTIGATION_TASK_4_INTEGRATION_APPROACH.md` with:
- How TS/JS interop works in this project
- Recommended approach for using common-images-constants
- Proposed new file structure (if needed)
- Draft implementation outline
- Integration pattern following tag-detection-service.js

### Report
Include specific file paths and line numbers for all findings.

---

## Expected Outputs

After investigation completion, the following files should exist:
1. `INVESTIGATION_TASK_1_EXTRACTION_IMAGE_FLOW.md`
2. `INVESTIGATION_TASK_2_COMMON_IMAGES_LIBRARY.md`
3. `INVESTIGATION_TASK_3_IMAGE_STORAGE.md`
4. `INVESTIGATION_TASK_4_INTEGRATION_APPROACH.md`

These will inform the implementation plan for automatic common image association.

---

## Integration Point Hypothesis

Based on initial investigation, the likely best integration approach is:

**Create a new service `common-image-association-service.js`**
- Called in `saveExtractionResults()` after tag detection, before image map creation
- Input: processedMenuItems array
- For each item WITHOUT an image:
  - Call matching function with item name
  - If confidence >= threshold (e.g., 0.7), add imageURL to item
- Output: items with common images added where applicable

**Alternative: Modify itemImageMap creation**
- After building itemImageMap from extracted images
- For items not in map, attempt common image match
- Add matched URLs to itemImageMap

The investigation should validate which approach is optimal.
