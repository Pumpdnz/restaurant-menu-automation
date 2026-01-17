# Branding & Logo Processing Selection Fix

**Date:** December 12, 2025
**Status:** Implemented

---

## Problem Summary

When users selected which logos and colors to update via checkboxes in the Process Logo and Extract Branding features, the system was still replacing all values regardless of user selection.

### Issues Identified

1. **Bug in `shouldUpdateColor` function** - The condition `colorsToUpdate.length === 0 || colorsToUpdate.includes(colorKey)` meant colors would update when the array was empty (backward compat mode), but an empty array actually means the user selected NO colors.

2. **Bug in `brand_colors` update** - The condition `colorsToUpdate.length === 0 || colorsToUpdate.length > 0` is always true (tautology), causing `brand_colors` to always update.

3. **Extract Branding had no selection support** - The `/api/website-extraction/branding` endpoint didn't accept selection parameters and always updated all extracted fields.

4. **Double extraction on confirmation** - Initial implementation called the extraction API twice (once for preview, once to save), wasting resources.

---

## Solutions Implemented

### 1. Fixed Color Selection Logic

**File:** `UberEats-Image-Extractor/server.js` (line ~6803)

```javascript
// BEFORE - Always updated colors when array was empty
const shouldUpdateColor = (colorKey) => colorsToUpdate.length === 0 || colorsToUpdate.includes(colorKey);

// AFTER - Only updates colors explicitly in the array
const shouldUpdateColor = (colorKey) => colorsToUpdate.includes(colorKey);
```

### 2. Fixed brand_colors Update Logic

**File:** `UberEats-Image-Extractor/server.js` (line ~6824)

```javascript
// BEFORE - Always true (tautology)
if (colorsToUpdate.length === 0 || colorsToUpdate.length > 0) {
  updateData.brand_colors = colors?.brandColors || [];
}

// AFTER - Only when user selected at least one color
if (colorsToUpdate.length > 0 && colors?.brandColors) {
  updateData.brand_colors = colors.brandColors;
}
```

### 3. Added Selection Support to Branding Endpoint

**File:** `UberEats-Image-Extractor/server.js` (lines ~6873-7075)

Added parameters:
- `previewOnly` - Returns extracted data without saving to database
- `versionsToUpdate` - Array of logo version keys to update
- `colorsToUpdate` - Array of color keys to update
- `headerFieldsToUpdate` - Array of OG field keys to update

### 4. Created Separate Save Endpoint

**File:** `UberEats-Image-Extractor/server.js` (lines ~7077-7221)

New endpoint: `POST /api/website-extraction/branding/save`

Accepts already-extracted branding data and saves only selected fields to database, avoiding re-extraction.

### 5. Added Confirmation Dialog for Branding Extraction

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

New state variables (lines ~140-165):
- `brandingConfirmDialogOpen`
- `pendingBrandingData`
- `brandingVersionsToUpdate`
- `brandingColorsToUpdate`
- `brandingHeaderFieldsToUpdate`

New functions (lines ~1770-1948):
- `hasExistingBrandingValues()` - Checks if restaurant has any branding data
- `setBrandingSmartDefaults()` - Sets checkbox defaults (unchecks existing values)
- `applyBrandingUpdates()` - Saves selected fields using the save endpoint
- `handleConfirmBrandingUpdate()` - Handles dialog confirmation

New dialog (lines ~7541-7831):
- Colors section with swatches and Select All/Deselect All
- Logo versions section with Select All/Deselect All
- Header fields section with Select All/Deselect All
- Current vs new value indicators

---

## Flow Diagrams

### Extract Branding Flow (After Fix)

```
User clicks "Extract Branding"
         │
         ▼
┌─────────────────────────────────┐
│ API: POST /branding             │
│ { previewOnly: true }           │
│                                 │
│ - Calls Firecrawl branding API  │
│ - Downloads & processes logo    │
│ - Returns extracted data        │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ hasExistingBrandingValues()?    │
└─────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   NO        YES
    │         │
    ▼         ▼
┌─────────┐  ┌─────────────────────────┐
│ Apply   │  │ Show Confirmation       │
│ all     │  │ Dialog                  │
│ fields  │  │                         │
│         │  │ - Smart defaults        │
│         │  │   (uncheck existing)    │
│         │  │ - Color swatches        │
│         │  │ - Select All/Deselect   │
└────┬────┘  └────────────┬────────────┘
     │                    │
     │                    ▼
     │       ┌─────────────────────────┐
     │       │ User selects fields     │
     │       │ and clicks "Apply"      │
     │       └────────────┬────────────┘
     │                    │
     ▼                    ▼
┌─────────────────────────────────┐
│ API: POST /branding/save        │
│ {                               │
│   brandingData: <extracted>,    │
│   versionsToUpdate: [...],      │
│   colorsToUpdate: [...],        │
│   headerFieldsToUpdate: [...]   │
│ }                               │
│                                 │
│ - Only saves selected fields    │
│ - No re-extraction              │
└─────────────────────────────────┘
         │
         ▼
    Update local state
    Show success message
```

### Process Logo Flow (Existing - Fixed)

```
User opens "Process Logo" dialog
         │
         ▼
┌─────────────────────────────────┐
│ Smart defaults set via useEffect│
│ (uncheck colors that exist)     │
└─────────────────────────────────┘
         │
         ▼
User selects mode (manual/replace/reprocess)
User checks/unchecks versions & colors
         │
         ▼
┌─────────────────────────────────┐
│ API: POST /process-selected-logo│
│ {                               │
│   logoUrl: <url>,               │
│   versionsToUpdate: [...],      │
│   colorsToUpdate: [...]         │
│ }                               │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Server-side filtering:          │
│                                 │
│ shouldUpdateVersion(key) =      │
│   versionsToUpdate.includes(key)│
│                                 │
│ shouldUpdateColor(key) =        │
│   colorsToUpdate.includes(key)  │
│                                 │
│ Only selected fields added      │
│ to updateData object            │
└─────────────────────────────────┘
         │
         ▼
    Database update with
    only selected fields
```

---

## Key Files Reference

### Server-Side

| File | Lines | Purpose |
|------|-------|---------|
| `UberEats-Image-Extractor/server.js` | ~6700-6866 | `/api/website-extraction/process-selected-logo` endpoint |
| `UberEats-Image-Extractor/server.js` | ~6873-7075 | `/api/website-extraction/branding` endpoint with previewOnly |
| `UberEats-Image-Extractor/server.js` | ~7077-7221 | `/api/website-extraction/branding/save` endpoint |

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | ~115-133 | `versionsToUpdate` and `colorsToUpdate` state |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | ~140-165 | Branding confirmation dialog state |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | ~367-392 | Smart defaults useEffect for Process Logo |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | ~1770-1948 | Branding extraction handlers |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | ~6935-7539 | Process Logo Dialog |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | ~7541-7831 | Branding Confirmation Dialog |

---

## Selection Logic Pattern

The pattern for selective updates is consistent across all endpoints:

```javascript
// Frontend: Convert checkbox state object to array of selected keys
const selectedFields = Object.keys(checkboxState).filter(key => checkboxState[key]);

// Server: Only update fields that are in the selection array
const shouldUpdate = (key) => selectionArray.includes(key);

if (shouldUpdate('field_name') && data.fieldValue) {
  updateData.field_name = data.fieldValue;
}
```

**Important:** An empty selection array means "update nothing", NOT "update everything".

---

## Applying This Pattern to Google Search Feature

The Google Search feature currently updates all fields it returns without user confirmation. To fix:

1. **Add preview mode** - Return extracted data without saving
2. **Check for existing values** - Use `hasExisting*Values()` pattern
3. **Show confirmation dialog** - Reuse the same dialog pattern with checkboxes
4. **Add save endpoint** - Accept already-fetched data with selection arrays
5. **Apply selection filtering** - Use `shouldUpdate(key)` pattern server-side

### Files to Reference

When implementing Google Search improvements, reference these patterns:

- **Dialog pattern:** `RestaurantDetail.jsx` lines ~7541-7831 (Branding Confirmation Dialog)
- **State management:** `RestaurantDetail.jsx` lines ~140-165 (branding state variables)
- **Smart defaults:** `RestaurantDetail.jsx` lines ~1794-1818 (`setBrandingSmartDefaults`)
- **Two-step flow:** `RestaurantDetail.jsx` lines ~1821-1860 (`handleExtractBranding`)
- **Save endpoint:** `server.js` lines ~7077-7221 (`/branding/save`)
- **Selection filtering:** `server.js` lines ~7111-7176 (shouldUpdate pattern)
