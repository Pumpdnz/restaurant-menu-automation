# Investigation Task 3: Image Storage Investigation

## Executive Summary

The `item_images` table includes multiple columns for tracking image URLs, CDN uploads, and metadata. **UCarecdn.com URLs (used by the common images library) will be accepted without validation issues.** However, the current schema lacks a dedicated column to track whether an image was auto-associated vs extracted.

---

## 1. item_images Table Schema

### Core Columns (Populated on Initial Insert)

**File:** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/services/database-service.js`

| Column | Type | Required | Notes | Line Reference |
|--------|------|----------|-------|-----------------|
| `id` | UUID/Serial | Yes | Primary key | Implied |
| `menu_item_id` | UUID | Yes | Foreign key to menu_items | Line 553 |
| `url` | TEXT | Yes | The image URL | Line 554 |
| `type` | TEXT | No | Image type, defaults to 'primary' | Lines 555, 567 |
| `organisation_id` | UUID | Yes | RLS organization context | Lines 556, 568 |

### CDN Upload Tracking Columns (Populated After Upload)

| Column | Type | Initial Value | Populated By | Line Reference |
|--------|------|---------------|----|-----------------|
| `cdn_uploaded` | BOOLEAN | null/false | `updateImageCDNInfo()` | Line 3042 |
| `cdn_id` | TEXT | null | CDN response data | Line 3043 |
| `cdn_url` | TEXT | null | CDN response data | Line 3044 |
| `cdn_filename` | TEXT | null | CDN response data | Line 3045 |
| `cdn_metadata` | JSONB | null | CDN response data | Line 3046 |
| `upload_status` | TEXT | null | 'success' or 'failed' | Lines 3047, 3073 |
| `upload_error` | TEXT | null | Error message on failure | Line 3074 |
| `uploaded_at` | TIMESTAMP | null | ISO timestamp of upload | Line 3048 |

---

## 2. Image URL Validation Rules

### `isValidImageUrl()` Function

**Location:** Lines 490-535

### Valid Image Patterns (Line 501-508)

```javascript
const validImagePatterns = [
  /tb-static\.uber\.com.*image/i,           // UberEats images
  /img\.cdn4dd\.com/i,                       // DoorDash images
  /cloudinary\.com/i,                        // Cloudinary
  /ucarecdn\.com/i,                          // UploadCare ← COMMON IMAGES LIBRARY USES THIS
  /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i, // Direct image file extensions
  /image-proc/i,                             // Generic image processing URLs
];
```

### Invalid URL Patterns (Will be rejected)
- UberEats store pages: `/ubereats\.com\/.*\/store\//i`
- DoorDash store pages: `/doordash\.com\/store\//i`
- UberEats modal URLs: `/\?mod=quickView/i`

### Fallback Behavior
If a URL is valid but doesn't match any patterns, it's logged as a warning but **ALLOWED** (line 533-534).

---

## 3. UCarecdn.com URL Support

### Will UCarecdn.com URLs Pass Validation?

**YES - CONFIRMED** ✓

The validation function explicitly includes the pattern `/ucarecdn\.com/i` on line 505.

**Test Examples:**
- `https://ucarecdn.com/abc123/image.jpg` - ✓ PASS
- `https://someimage.ucarecdn.com/abc123.png` - ✓ PASS

**Relevance:** All images from common-images-constants.ts use UCarecdn.com URLs and will be valid for insertion.

---

## 4. Recommendations for Tracking Auto-Associated Images

### Current Limitation

The current schema does NOT have a dedicated column to distinguish between:
- Images extracted from delivery platforms
- Images auto-associated from common image library
- Images manually provided by user

### Recommended Solutions

**Option A: Use `type` Column Strategically** ⭐ LEAST INVASIVE
- Least invasive, no schema changes
- Store values like:
  - `'primary'` - Main image for item
  - `'auto-associated'` - From common images library
  - `'extracted'` - From platform extraction
- **Limitation:** Loses current semantic meaning of "primary"

**Option B: Initialize cdn_metadata with Source Info** ⭐ RECOMMENDED
- Store source in the `cdn_metadata` JSONB column at insertion time
- Example: `cdn_metadata: { source: 'common-images', confidence: 0.95, imageId: 'coke-can' }`
- **Advantage:** Doesn't conflict with `type` column semantics
- **Limitation:** Requires modifying `createItemImages()` function

**Option C: Add New Column (Schema Migration)**
- Add column: `image_source` or `association_type`
- Values: 'extracted', 'auto-associated', 'manual'
- **Advantage:** Most explicit and queryable
- **Disadvantage:** Requires database migration

### Pattern Precedent in Codebase

The codebase already uses source tracking on the `option_sets` table:
- **Location:** Line 824 of database-service.js
- **Field:** `extraction_source`
- **Values:** 'ubereats', 'doordash', 'menulog', 'manual', 'import'

This establishes a pattern that could be replicated for images.

---

## 5. Image Insertion Flow

### `createItemImages()` Function (Lines 537-594)

**Input Formats:**
```javascript
// Format 1: Simple map of itemId -> URL string
itemImageMap = {
  "item-123": "https://ucarecdn.com/image.jpg"
}

// Format 2: Map of itemId -> Array of image objects
itemImageMap = {
  "item-123": [
    { url: "https://ucarecdn.com/image.jpg", type: "primary" }
  ]
}
```

**Data Structure Inserted (lines 552-557):**
```javascript
imageData.push({
  menu_item_id: itemId,
  url: url,
  type: img.type || 'primary',
  organisation_id: orgId
});
```

**Important:** Only 4 columns are set during initial insert. All CDN-related columns remain `null` until later processing.

---

## 6. Limitations and Considerations

1. **No Source Tracking Without Modification**
   - Cannot currently distinguish auto-associated from extracted images
   - Would need metadata approach or schema change

2. **Timestamp Information**
   - Auto-associated images won't have `created_at` field
   - `uploaded_at` only set after CDN processing

3. **Type Column Semantics**
   - Currently 'primary' is semantic (main image)
   - Using 'auto-associated' changes meaning
   - May break existing UI/code expecting 'primary'

4. **Batch Operations**
   - For large menu extractions, should batch common image matching
   - Prevents N+1 queries if not implemented carefully

---

## 7. File References

- **Database Service:** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/services/database-service.js`
  - `isValidImageUrl()`: Lines 490-535
  - `createItemImages()`: Lines 537-594
  - `updateImageCDNInfo()`: Lines 3034-3060
  - `saveExtractionResults()` image handling: Lines 1112-1114, 1122-1123

- **Related Constants:** `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/lib/common-images-constants.ts`
