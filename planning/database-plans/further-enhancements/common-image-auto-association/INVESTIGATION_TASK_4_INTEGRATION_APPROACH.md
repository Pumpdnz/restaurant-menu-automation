# Investigation Task 4: Integration Approach Investigation

## Executive Summary

The project uses a hybrid TypeScript/JavaScript architecture where frontend components can directly import TS files, but backend Node.js services use CommonJS and cannot directly import TypeScript. The recommended approach is to create a JavaScript wrapper service (`common-images-service.js`) following the existing `tag-detection-service.js` pattern.

---

## 1. Current TS/JS Interop Architecture

### Frontend (React Components)
- JSX/TSX components can directly import from TS files without extension
- Example from `PresetTagsPopover.jsx`:
  ```javascript
  import { TAG_CATEGORIES, isPresetTag, getTagStyle } from '../../lib/item-tags-constants';
  ```
- Same pattern in `CommonImagesPopover.jsx`:
  ```javascript
  import { COMMON_IMAGE_CATEGORIES, searchCommonImages, getActiveCategories } from '../../lib/common-images-constants';
  ```

### Backend (Node.js Services)
- Backend services are purely JavaScript (CommonJS require/module.exports)
- Services use `require()` syntax exclusively
- Example from `database-service.js`:
  ```javascript
  const { processMenuItemTags, getTagStats } = require('./tag-detection-service');
  ```
- Services do NOT directly import TS files

### Configuration
- `tsconfig.json` enables critical interop settings:
  - `allowJs: true` - allows TS compiler to process JS files
  - `esModuleInterop: true` - enables mixing import/require styles
  - `moduleResolution: bundler` - uses Vite's modern resolution
- `vite.config.ts` handles module resolution for the frontend build

---

## 2. Problem with Direct Backend Usage

Backend Node.js services cannot directly import from TS files because:
1. The backend uses plain Node.js CommonJS (not Vite-compiled)
2. TypeScript files aren't compiled when running via Node directly
3. The server runs `node server.js` which doesn't have TS support
4. `tsconfig.json` is only for the Vite client build

---

## 3. Recommended Integration Approach

### OPTION A: Create a JS Wrapper Service ⭐ RECOMMENDED

**Location:** `/src/services/common-images-service.js`

**Advantages:**
- Follows existing tag-detection-service pattern
- Works for both frontend and backend
- Encapsulates all TS imports in one place
- Minimal code duplication
- Clear separation of concerns

**Structure:**
```javascript
/**
 * Common Images Service
 *
 * Provides auto-association of common product images to menu items.
 * Wraps the TypeScript common-images-constants library for backend use.
 */

// Import or re-implement the matching logic
const COMMON_IMAGES = [
  { id: 'coke-can', name: 'Coke Can', /* ... */ },
  // ... all 23 images
];

/**
 * Get suggested common images for a menu item name
 * @param {string} itemName - The menu item name
 * @param {number} minConfidence - Minimum confidence threshold (default 0.7)
 * @returns {Array<{image: object, confidence: number}>}
 */
function getSuggestedImages(itemName, minConfidence = 0.7) {
  // Matching logic here
}

/**
 * Process menu items and add common images to those missing images
 * @param {Array} items - Array of menu items
 * @returns {Object} - Map of itemId -> imageUrl for items that got common images
 */
function processCommonImageAssociations(items) {
  const associations = {};

  for (const item of items) {
    if (item.imageURL || item.dishImageURL) continue; // Skip if has image

    const suggestions = getSuggestedImages(item.name, 0.7);
    if (suggestions.length > 0) {
      associations[item.id] = {
        url: suggestions[0].image.imageUrl,
        imageId: suggestions[0].image.id,
        confidence: suggestions[0].confidence
      };
    }
  }

  return associations;
}

module.exports = {
  getSuggestedImages,
  processCommonImageAssociations,
  COMMON_IMAGES
};
```

---

## 4. Tag Detection Service Pattern (Reference)

**File:** `/src/services/tag-detection-service.js`

**Key Pattern Elements:**
- Lines 1-9: Module documentation and configuration section
- Lines 11-127: Configuration objects (constants at top)
- Lines 140-156: Main processing function (entry point)
- Line 368: Module exports using CommonJS
- Lines 369-385: Exported functions and configurations

**Pattern to Follow:**
1. Configuration constants at top
2. Main processing functions
3. Helper functions
4. Module exports at bottom

---

## 5. Proposed File Structure

```
/src
  /lib
    common-images-constants.ts        (unchanged - TS with interfaces & utilities)
    item-tags-constants.ts            (unchanged - TS)
  /services
    tag-detection-service.js          (existing - pure JS)
    common-images-service.js          (NEW - JS service for backend)
    database-service.js               (existing - will import new service)
  /routes
    menu-routes.js                    (existing - Express routes)
  /components/menu
    CommonImagesPopover.jsx           (unchanged - uses TS directly)
```

---

## 6. Draft Implementation Outline

### Step 1: Create common-images-service.js

Create the new service with:
- Copy of COMMON_IMAGES data from TS file
- `getSuggestedImages()` function (simplified from TS)
- `processCommonImageAssociations()` wrapper function
- Stats/logging utilities

### Step 2: Modify database-service.js

At the integration point (after line 1120):
```javascript
const { processCommonImageAssociations } = require('./common-images-service');

// After building itemImageMap from extracted images...
const commonImageAssociations = processCommonImageAssociations(
  itemRecords.map((item, index) => ({
    ...item,
    name: processedMenuItems[index]?.name || item.name
  }))
);

// Add common image associations to itemImageMap
for (const [itemId, association] of Object.entries(commonImageAssociations)) {
  if (!itemImageMap[itemId]) {
    itemImageMap[itemId] = association.url;
    // Optional: track metadata for later reference
  }
}
```

### Step 3: Add Logging/Stats

Log statistics about auto-associations:
```javascript
console.log(`[Common Images] Associated ${Object.keys(commonImageAssociations).length} items with common images`);
```

---

## 7. Alternative Approaches

### Option B: Keep TS for Frontend, Create JS Data File
- Convert the data to pure JS file
- Keep utility functions in TS for frontend
- More fragmentation but simpler

### Option C: Add ts-node for Runtime Compilation
- Add `ts-node` or `tsx` package
- Configure server.js to use TS loader
- More complex configuration

**Why Option A is Best:**
- Mirrors existing tag-detection-service pattern
- Minimal configuration changes
- Clear module boundaries
- Consistent with codebase conventions

---

## 8. File References

- **Tag Detection Service (Pattern Reference):** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/services/tag-detection-service.js`
- **Common Images Constants (TS Source):** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/lib/common-images-constants.ts`
- **Database Service (Integration Target):** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/services/database-service.js`
- **Frontend Component (TS Direct Import):** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/components/menu/CommonImagesPopover.jsx`
