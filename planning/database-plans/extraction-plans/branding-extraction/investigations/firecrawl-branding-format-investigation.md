# Firecrawl Branding Format Investigation Summary

**Date:** December 4, 2025
**Author:** Claude Code
**Status:** Complete

## Executive Summary

This investigation analyzes the current logo extraction system and evaluates the new Firecrawl branding format for integration. The new format provides significantly more accurate and comprehensive branding data including colors, typography, logos, favicons, and metadata in a single API call.

---

## Current System Architecture

### Files Analyzed

| File | Lines | Purpose |
|------|-------|---------|
| `logo-extraction-service.js` | 1-946 | Core logo extraction and processing service |
| `server.js` | 6673-7029 | API endpoints for logo extraction |
| `RestaurantDetail.jsx` | 3294-3794 | Frontend branding tab UI |

### Current Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT LOGO EXTRACTION FLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. User clicks "Extract Logo" button                                │
│           ↓                                                          │
│  2. POST /api/website-extraction/logo-candidates                     │
│           ↓                                                          │
│  3. extractLogoCandidatesWithFirecrawl() called                      │
│     - Uses Firecrawl /v2/scrape with format: "json"                  │
│     - Custom prompt to find logo candidates                          │
│     - Returns up to 15 candidates                                    │
│           ↓                                                          │
│  4. User selects primary logo + additional images                    │
│           ↓                                                          │
│  5. POST /api/website-extraction/process-selected-logo               │
│           ↓                                                          │
│  6. downloadImageToBuffer() - Download selected logo                 │
│           ↓                                                          │
│  7. extractColorsFromLogo() - Uses node-vibrant                      │
│     - getPalette() for Vibrant, DarkVibrant, Muted, etc.             │
│     - Generates: primaryColor, secondaryColor, tertiaryColor,        │
│       accentColor, backgroundColor, theme                            │
│           ↓                                                          │
│  8. processLogoVersions() - Uses sharp + Remove.bg API               │
│     - original, standard (500x500), nobg, thermal variants, favicon  │
│           ↓                                                          │
│  9. Save to database                                                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Database Schema (Branding-Related Columns)

| Column | Type | Description |
|--------|------|-------------|
| `theme` | text | "light" or "dark" |
| `primary_color` | text | Hex color code |
| `secondary_color` | text | Hex color code |
| `tertiary_color` | text | Hex color code |
| `accent_color` | text | Hex color code |
| `background_color` | text | Hex color code |
| `brand_colors` | jsonb | Array of brand colors with metadata |
| `logo_url` | text | Original logo (base64 data URL) |
| `logo_nobg_url` | text | Logo with background removed |
| `logo_standard_url` | text | 500x500 standardized logo |
| `logo_thermal_url` | text | Thermal printer version (inverted) |
| `logo_thermal_alt_url` | text | Thermal for dark logos |
| `logo_thermal_contrast_url` | text | High contrast thermal |
| `logo_thermal_adaptive_url` | text | Adaptive grayscale thermal |
| `logo_favicon_url` | text | 32x32 favicon |
| `saved_images` | jsonb | Additional saved images |

### Current Color Extraction Logic

The `extractColorsFromLogo()` function uses `node-vibrant` to:
1. Convert image to PNG buffer
2. Extract palette using `Vibrant.from(buffer).getPalette()`
3. Map swatches to our color fields:
   - `Vibrant` → `primaryColor`
   - `DarkVibrant` or `Muted` → `secondaryColor`
   - `Muted`, `DarkMuted`, or `LightVibrant` → `tertiaryColor`
   - `LightVibrant` → `accentColor`
   - `LightMuted` or neutral → `backgroundColor`
4. Determine theme based on dominant color brightness

---

## New Firecrawl Branding Format Analysis

### Sample Response Structure

```json
{
  "branding": {
    "colorScheme": "light",
    "colors": {
      "primary": "#F3BE25",
      "accent": "#F5D370",
      "background": "#FAFAFA",
      "textPrimary": "#000000",
      "link": "#0000EE"
    },
    "fonts": [...],
    "typography": {...},
    "spacing": {...},
    "components": {
      "buttonSecondary": {
        "background": "#F5D370"
      }
    },
    "images": {
      "logo": "https://...",
      "favicon": "https://...",
      "ogImage": "https://..."
    },
    "__llm_logo_reasoning": {
      "confidence": 0.98,
      "reasoning": "..."
    }
  },
  "metadata": {
    "ogDescription": "...",
    "ogTitle": "...",
    "og:image": "..."
  }
}
```

### Key Improvements Over Current System

| Aspect | Current System | Firecrawl Branding |
|--------|----------------|-------------------|
| **Logo Detection** | Prompt-based guessing, 15 candidates | AI-reasoned selection with 98% confidence |
| **Color Accuracy** | Derived from logo pixels | Extracted from actual CSS/design system |
| **Theme Detection** | Brightness calculation | Direct `colorScheme` value |
| **Favicon** | Generated from logo (32x32) | Direct extraction from site |
| **OG Images** | Not captured | Logo, favicon, and ogImage URLs |
| **Metadata** | Not captured | Title, description, site name |
| **API Calls** | 2 calls (candidates + process) | 1 call |

### Color Mapping Comparison

| Our Field | Current Source | Firecrawl Source |
|-----------|---------------|------------------|
| `theme` | Calculated from brightness | `branding.colorScheme` |
| `primary_color` | Vibrant swatch | `branding.colors.primary` |
| `secondary_color` | DarkVibrant/Muted | `branding.colors.accent` |
| `tertiary_color` | Various swatches | `branding.colors.textPrimary` |
| `accent_color` | LightVibrant | `branding.components.buttonSecondary.background` |
| `background_color` | LightMuted/neutral | `branding.colors.background` |

---

## Frontend Analysis

### Current Branding Tab Components

Located in `RestaurantDetail.jsx` lines 3294-3694:

1. **Theme Selector** - Dropdown for light/dark
2. **Color Pickers** - 6 color inputs (primary, secondary, tertiary, accent, background + display)
3. **Logo Management Actions**:
   - "Extract Logo" button (requires `website_url`)
   - "Process Logo" button (manual URL or reprocess)
4. **Main Logos Grid** (4 columns):
   - Logo URL, Logo (No Background), Logo (Standard), Logo (Favicon)
5. **Thermal Logos Grid** (4 columns):
   - Thermal (Inverted), Thermal Alt, Thermal High Contrast, Thermal Adaptive

### Available Platform URLs for Extraction Source

From `RestaurantDetail.jsx` lines 3697-3791:

| Platform | Field Name | Firecrawl Compatible |
|----------|------------|---------------------|
| UberEats | `ubereats_url` | Yes |
| DoorDash | `doordash_url` | Yes |
| Website | `website_url` | Yes |
| Instagram | `instagram_url` | **No** (blocked) |
| Facebook | `facebook_url` | **No** (blocked) |
| OrderMeal | `ordermeal_url` | Yes |
| Me&U | `meandyou_url` | Yes |
| Mobi2go | `mobi2go_url` | Yes |
| Delivereasy | `delivereasy_url` | Yes |
| NextOrder | `nextorder_url` | Yes |
| Foodhub | `foodhub_url` | Yes |

---

## New Database Columns Required

Based on requirements, the following columns need to be added:

| Column Name | Type | Purpose |
|-------------|------|---------|
| `website_og_image` | text | OG image from website |
| `website_og_description` | text | OG description from website |
| `website_og_title` | text | OG title from website |
| `ubereats_og_image` | text | OG image from UberEats (future) |
| `doordash_og_image` | text | OG image from DoorDash (future) |
| `facebook_cover_image` | text | Cover image from Facebook (future) |

---

## API Endpoint Changes Required

### New Endpoint: `/api/website-extraction/branding`

```javascript
POST /api/website-extraction/branding
{
  "restaurantId": "uuid",
  "sourceUrl": "https://example.com"
}

Response:
{
  "success": true,
  "data": {
    "logoVersions": {...},      // Processed logo formats
    "colors": {...},            // Mapped from Firecrawl
    "theme": "light|dark",
    "metadata": {
      "ogImage": "...",
      "ogTitle": "...",
      "ogDescription": "..."
    },
    "favicon": "..."            // Direct from Firecrawl
  }
}
```

### Firecrawl API Call Format

```javascript
const response = await axios.post(
  `${FIRECRAWL_API_URL}/v2/scrape`,
  {
    url: sourceUrl,
    formats: ['branding'],  // NEW FORMAT
    waitFor: 3000
  },
  {
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);
```

---

## Feature Flag Configuration

### Environment Variable

```bash
# Add to .env file
USE_FIRECRAWL_BRANDING_FORMAT=TRUE
```

### Implementation Logic

```javascript
const USE_BRANDING_FORMAT = process.env.USE_FIRECRAWL_BRANDING_FORMAT?.toLowerCase() === 'true';

// Frontend can check this via an API or config endpoint
```

---

## Processing Changes

### What Stays the Same

1. **Logo processing with Sharp** - Still process logo into all formats:
   - original, standard, nobg, thermal variants
2. **Remove.bg integration** - Still use for background removal
3. **Additional image saving** - Keep functionality for saved_images
4. **Manual "Process Logo" button** - Keep for manual URL processing

### What Changes

1. **Favicon generation** - Skip if Firecrawl provides one
2. **Color extraction** - Use Firecrawl colors instead of Vibrant.js
3. **Theme detection** - Use Firecrawl `colorScheme` directly
4. **Logo selection** - No candidate selection needed; Firecrawl provides best logo

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Firecrawl API changes | Low | High | Keep legacy method as fallback |
| Missing branding data | Medium | Medium | Fallback to Vibrant.js extraction |
| Performance regression | Low | Low | Single API call vs. 2 currently |
| Color mapping errors | Medium | Low | Validate hex format before save |

---

## Recommendations

1. **Implement feature flag** - Allow toggle between old and new methods
2. **Keep legacy code** - Don't remove existing extraction for fallback
3. **Add new columns incrementally** - Start with og_image fields
4. **UI enhancement** - Add Header Images section below logos
5. **Source URL selector** - Allow extraction from any platform URL
6. **Default to website_url** - Pre-select if available

---

## Next Steps

1. Create implementation roadmap (separate document)
2. Create database migration for new columns
3. Implement new API endpoint
4. Update frontend with feature-flagged UI
5. Test with multiple restaurant websites
6. Deploy and monitor