# Text Color Configuration and Logo Colorization Implementation Plan

**Date:** December 14, 2025
**Status:** ✅ COMPLETED (December 18, 2025)
**Prerequisites:** Nav Bar Logo Resizing and No-Gradient Implementation (completed December 14, 2025)

---

## Overview

This document outlines the implementation plan for two features:

1. **Feature 1: Configurable Text Colors** - Allow independent configuration of Nav Bar Text Color and Box & Popup Text Color ✅
2. **Feature 2: Logo Colorization** - Ability to tint/colorize logos to match brand colors at script execution time ✅

---

## Implementation Summary

### What Was Built

#### Feature 1: Text Color Configuration ✅
- Added compact color picker UI with popover controls for Nav Text and Box Text
- Colors auto-update when theme changes (dark → white, light → secondary)
- Supports: White, Black, Primary, Secondary, and Custom hex colors

#### Feature 2: Logo Colorization ✅
- **Enhanced from original plan**: Implemented dual-color mapping instead of single color
- Separate controls for Nav Logo and Header Logo
- Each logo has Dark pixel → color and Light pixel → color mappings
- Uses luminance threshold (0.5) to classify pixels
- Preserves transparency and anti-aliasing

---

## Feature 1: Configurable Text Colors

### Implementation Details

**Files Modified:**
| File | Changes |
|------|---------|
| `RestaurantDetail.jsx` | Added state variables (lines 335-338), compact color picker UI (lines 6388-6367), theme change auto-update (lines 1707-1720) |
| `registration-routes.js` | Added textColorConfig processing (lines 1659-1668) |
| `edit-website-settings-light.js` | Added --nav-text-color and --box-text-color argument handling |
| `edit-website-settings-dark.js` | Added --nav-text-color and --box-text-color argument handling |

**UI Design:**
- Compact 2-column grid layout with Popover-based color pickers
- Color swatch preview in trigger button
- Native color picker + hex input + preset buttons in popover

---

## Feature 2: Logo Colorization

### Final Implementation (Different from Original Plan)

**Original Plan:** Single color tint for entire logo
**Final Implementation:** Dual-color mapping with separate dark/light pixel targeting

### Why the Change?
During testing, we discovered logos often have both dark elements (text/shapes) and light elements (glows/highlights). A single color tint couldn't handle both properly. The dual-color approach allows:
- Converting black text to white while keeping white glow effects
- Or converting black to a brand color while removing/changing the glow

### Implementation Details

**State Variables (RestaurantDetail.jsx lines 340-348):**
```javascript
// Logo colorization state (separate for nav and header, with dark/light pixel targeting)
const [navLogoDarkTint, setNavLogoDarkTint] = useState('none');
const [navLogoDarkCustomColor, setNavLogoDarkCustomColor] = useState('');
const [navLogoLightTint, setNavLogoLightTint] = useState('none');
const [navLogoLightCustomColor, setNavLogoLightCustomColor] = useState('');
const [headerLogoDarkTint, setHeaderLogoDarkTint] = useState('none');
const [headerLogoDarkCustomColor, setHeaderLogoDarkCustomColor] = useState('');
const [headerLogoLightTint, setHeaderLogoLightTint] = useState('none');
const [headerLogoLightCustomColor, setHeaderLogoLightCustomColor] = useState('');
```

**API Payload (RestaurantDetail.jsx lines 1178-1185):**
```javascript
navLogoTintConfig: (navLogoDarkTint !== 'none' || navLogoLightTint !== 'none') ? {
  darkColor: navLogoDarkTint === 'none' ? null : (navLogoDarkTint === 'custom' ? navLogoDarkCustomColor : navLogoDarkTint),
  lightColor: navLogoLightTint === 'none' ? null : (navLogoLightTint === 'custom' ? navLogoLightCustomColor : navLogoLightTint)
} : null,
headerLogoTintConfig: (headerLogoDarkTint !== 'none' || headerLogoLightTint !== 'none') ? {
  darkColor: headerLogoDarkTint === 'none' ? null : (headerLogoDarkTint === 'custom' ? headerLogoDarkCustomColor : headerLogoDarkTint),
  lightColor: headerLogoLightTint === 'none' ? null : (headerLogoLightTint === 'custom' ? headerLogoLightCustomColor : headerLogoLightTint)
} : null
```

**Colorization Algorithm (registration-routes.js lines 1995-2069):**
```javascript
async function colorizeLogoToColor(imageBuffer, darkColor, lightColor) {
  // Uses luminance threshold (0.5) to classify pixels
  // Dark pixels (luminance < 0.5) → darkColor if set
  // Light pixels (luminance >= 0.5) → lightColor if set
  // Preserves original if color is null
  // Preserves transparency (alpha channel)
}
```

**Files Modified:**
| File | Changes |
|------|---------|
| `RestaurantDetail.jsx` | State variables (340-348), UI with dual color pickers (6369-6631), API call (1178-1185) |
| `registration-routes.js` | resolveColor helper (1446-1455), dual-color processing for nav (1491-1495) and header (1614-1618), colorizeLogoToColor function (1995-2069) |

---

## Testing Checklist

### Feature 1: Text Color Configuration ✅
- [x] State variables work correctly
- [x] UI shows compact color pickers with popovers
- [x] Custom color input appears in popover
- [x] API call includes textColorConfig
- [x] Backend resolves color values correctly
- [x] Scripts receive correct color arguments
- [x] Nav Bar Text color applies correctly
- [x] Box & Popup Text color applies correctly
- [x] Theme change auto-updates colors

### Feature 2: Logo Colorization ✅
- [x] State variables work correctly (8 total for dark/light x nav/header)
- [x] UI shows dual color pickers for each logo
- [x] Custom color input works
- [x] Colorization function preserves transparency
- [x] Colorization function correctly classifies dark/light pixels
- [x] Dark pixels map to darkColor when set
- [x] Light pixels map to lightColor when set
- [x] Preserves original when color is 'none'
- [x] Works with both base64 and HTTP URL logos
- [x] No quality loss (compressionLevel: 0)

---

## Configuration Constants

**Logo Sizes (registration-routes.js):**
```javascript
// Nav Bar Logo
const NAV_LOGO_MAX_WIDTH = 150;   // Line 1483
const NAV_LOGO_MAX_HEIGHT = 80;   // Line 1484

// Header Logo
const HEADER_LOGO_MAX_WIDTH = 200;  // Line 1606
const HEADER_LOGO_MAX_HEIGHT = 200; // Line 1607
```

---

## Notes

- Text color configuration affects the `edit-website-settings-*.js` scripts
- Logo colorization happens in `registration-routes.js` before the logo is passed to scripts
- Both features are additive and don't require database migrations
- The dual-color algorithm uses luminance threshold of 0.5 to classify pixels
- PNG compression level 0 ensures no quality loss during colorization

---

## Related Documentation

- [Nav Bar Logo Resizing and No-Gradient Plan](./NAV-LOGO-RESIZING-AND-NO-GRADIENT-IMPLEMENTATION-PLAN.md)
- [Header and Items Settings Plan](./HEADER-AND-ITEMS-SETTINGS-IMPLEMENTATION-PLAN.md)
- Logo Extraction Service: `UberEats-Image-Extractor/src/services/logo-extraction-service.js`
