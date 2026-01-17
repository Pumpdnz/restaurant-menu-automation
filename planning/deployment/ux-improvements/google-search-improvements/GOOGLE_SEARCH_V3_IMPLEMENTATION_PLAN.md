# Google Search v3.0 - Implementation Plan

## Overview

This document outlines the implementation plan for Google Search v3.0, which introduces a new multi-stage extraction flow with **Google Business Profile as the primary data source** and UberEats as a fallback.

### Key Changes from v2.1

| Change | v2.1 | v3.0 |
|--------|------|------|
| Primary Data Source | UberEats + Website | **Google Business Profile** |
| Website Extraction | Included | **Removed** |
| Social Links Source | Google Search results | **Google Knowledge Panel** |
| UberEats Role | Primary for hours/address | **Fallback only** |
| OG Image Extraction | Not included | **New feature** |
| Source Links | Not shown | **Clickable links in dialog** |

---

## New Multi-Stage Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 1: URL Discovery                             │
│                                                                              │
│  Input: Restaurant name + City                                               │
│  Action: Firecrawl search for platform URLs                                  │
│  Output: Platform URLs (UberEats, DoorDash, etc.)                           │
│                                                                              │
│  User Action: Confirm/edit website URL before proceeding                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: Google Business Profile Extraction               │
│                                                                              │
│  Input: Restaurant name + City (+ Address if available)                     │
│  Action: Scrape Google search results for Knowledge Panel                   │
│  Extracts:                                                                  │
│    - Phone number (primary source)                                          │
│    - Address (primary source)                                               │
│    - Opening hours (primary source)                                         │
│    - Instagram URL (from social links)                                      │
│    - Facebook URL (from social links)                                       │
│                                                                              │
│  NOT Extracted: Google rating, review count (not needed)                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              STAGE 3: UberEats Fallback Extraction (Conditional)             │
│                                                                              │
│  Triggered IF: Address OR Opening Hours missing from Stage 2                │
│                                                                              │
│  Input: UberEats store URL (from Stage 1)                                   │
│  Action: Scrape UberEats store page                                         │
│  Extracts:                                                                  │
│    - Address (fallback)                                                     │
│    - Opening hours (fallback)                                               │
│    - OG Image URL (NEW - for thumbnail/branding)                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STAGE 4: User Selection Dialog                         │
│                                                                              │
│  Display:                                                                    │
│    - Current data (existing values)                                         │
│    - Extracted data with source labels                                      │
│    - Clickable source links [↗] for verification                           │
│                                                                              │
│  User Actions:                                                               │
│    - Toggle each field on/off                                               │
│    - Select source for multi-source fields (e.g., hours from Google vs UE) │
│    - Click source links to verify data                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STAGE 5: Save & Process                             │
│                                                                              │
│  Processing:                                                                 │
│    - Opening hours: Apply midnight crossing detection                       │
│    - Opening hours: Expand day ranges (Mon-Fri → 5 entries)                │
│    - Opening hours: Convert to 24-hour format                               │
│    - Phone: Normalize to E.164 format (+64...)                             │
│    - OG Image: Convert URL to base64 (if selected)                         │
│                                                                              │
│  Save: Selected fields to restaurants table                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 2: Google Business Profile Extraction (NEW)

### Why Google Business Profile?

The lead scraping service has proven that Google Business Profile is the most reliable source for:

1. **Phone Numbers** - Google has verified business phone numbers
2. **Opening Hours** - Businesses actively maintain their Google hours
3. **Address** - Verified business addresses with consistent formatting
4. **Social Links** - Knowledge Panel shows official social profiles

### Implementation Details

#### Google Search URL Builder

```javascript
// From lead-scrape-firecrawl-service.js line 553-556
function buildGoogleSearchUrl(restaurantName, address) {
  const query = `${restaurantName} ${address || ''}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
```

**Enhancement for v3.0:**
```javascript
function buildGoogleBusinessSearchUrl(restaurantName, city, country = 'New Zealand') {
  // Include country for better results
  const query = `${restaurantName} ${city} ${country}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
```

#### Extraction Schema (Adapted from Lead Scraping)

```javascript
const GOOGLE_BUSINESS_SCHEMA = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      description: "Business phone number in local format (e.g., +64 9 123 4567 or 09 123 4567)"
    },
    address: {
      type: "string",
      description: "Full business address from Google Business Profile"
    },
    openingHours: {
      type: "array",
      description: "Opening hours for each day of the week",
      items: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day of the week (Monday, Tuesday, etc.)" },
          open: { type: "string", description: "Opening time" },
          close: { type: "string", description: "Closing time" },
          period: { type: "string", description: "Optional: Lunch or Dinner for split hours" }
        }
      }
    },
    instagram_url: {
      type: "string",
      description: "Instagram profile URL from Knowledge Panel social links"
    },
    facebook_url: {
      type: "string",
      description: "Facebook page URL from Knowledge Panel social links"
    }
  }
};
```

**Note:** We deliberately exclude `google_rating` and `google_reviews_count` as they're not needed.

#### Extraction Prompt

```javascript
const GOOGLE_BUSINESS_PROMPT = `Extract business information from this Google search results page.
Focus on the Knowledge Panel / Business Profile on the right side of the page.

Extract the following information:

1. PHONE NUMBER
   - Business phone in local format
   - Include area code (e.g., +64 or 0X for NZ, +61 for AU)
   - Return null if not visible

2. ADDRESS
   - Full business address as shown in the Knowledge Panel
   - Include street, suburb, city, postcode if available
   - Return null if not visible

3. OPENING HOURS
   - Extract hours for each day exactly as shown
   - If continuous hours (e.g., "11am - 9pm"), return single entry per day
   - If split hours shown (e.g., "11am-2pm" then "5pm-9pm"), create separate entries with period field
   - Use "period" field ONLY for split hours (e.g., "Lunch", "Dinner")
   - Do NOT include days marked as "Closed"
   - Return empty array if hours not visible

4. INSTAGRAM URL
   - Look for Instagram link in Knowledge Panel social media section
   - ONLY extract profile URLs like https://www.instagram.com/username/
   - REJECT URLs containing /reel/, /p/, /stories/, /reels/, /tv/
   - Return null if not found

5. FACEBOOK URL
   - Look for Facebook link in Knowledge Panel social media section
   - ONLY extract page URLs like https://www.facebook.com/pagename/
   - REJECT URLs containing /videos/, /groups/, /posts/, /events/, /photos/
   - Return null if not found

IMPORTANT: Only extract data visible on the page. Return null for missing fields.`;
```

---

## Stage 3: UberEats Fallback Extraction

### Trigger Conditions

```javascript
const needsUberEatsFallback = (
  (!extractedData.address || extractedData.address === '') ||
  (!extractedData.openingHours || extractedData.openingHours.length === 0)
);

if (needsUberEatsFallback && platformUrls.ubereatsUrl) {
  // Proceed to Stage 3
}
```

### UberEats Extraction Schema

```javascript
const UBEREATS_FALLBACK_SCHEMA = {
  type: "object",
  properties: {
    address: {
      type: "string",
      description: "Full street address of the restaurant"
    },
    openingHours: {
      type: "array",
      description: "Opening hours for each day",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          open: { type: "string" },
          close: { type: "string" }
        }
      }
    },
    ogImage: {
      type: "string",
      description: "The og:image meta tag URL (restaurant hero image)"
    }
  }
};
```

### UberEats Extraction Prompt

```javascript
const UBEREATS_FALLBACK_PROMPT = `Extract restaurant information from this UberEats store page.

1. ADDRESS
   - Full street address of the restaurant
   - Usually shown near the restaurant name or in the info section
   - Include full address with street number, street name, suburb, city

2. OPENING HOURS
   - Hours for each day the restaurant is open
   - Extract exactly as displayed
   - Skip days marked as closed

3. OG IMAGE
   - Find the og:image meta tag in the page head
   - This is the main restaurant hero/banner image
   - Return the full URL

IMPORTANT: Only extract data visible on the page.`;
```

### OG Image Processing

The OG image will be processed in Stage 5:

```javascript
async function processOgImageToBase64(ogImageUrl) {
  if (!ogImageUrl) return null;

  try {
    // Fetch image
    const response = await axios.get(ogImageUrl, { responseType: 'arraybuffer' });

    // Convert to base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mimeType = response.headers['content-type'] || 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[OG Image] Failed to convert to base64:', error.message);
    return null;
  }
}
```

---

## Stage 4: User Selection Dialog

### Data Structure for Dialog

```javascript
// Response structure from backend
{
  success: true,
  previewMode: true,
  data: {
    // Platform URLs (from Stage 1)
    platformUrls: {
      websiteUrl: "https://example-restaurant.co.nz",
      ubereatsUrl: "https://www.ubereats.com/store/example/abc123",
      doordashUrl: "https://www.doordash.com/store/example/12345",
      instagramUrl: "https://www.instagram.com/examplerestaurant/",
      facebookUrl: "https://www.facebook.com/ExampleRestaurant/"
    },

    // Multi-source extracted data with source URLs
    extractedBySource: {
      google: {
        sourceUrl: "https://www.google.com/search?q=Example+Restaurant+Auckland",
        address: "123 Queen Street, Auckland CBD, Auckland 1010",
        phone: "+6493001234",
        openingHours: [
          { day: "Monday", hours: { open: "11:00", close: "21:00" } },
          // ...
        ],
        instagramUrl: "https://www.instagram.com/examplerestaurant/",
        facebookUrl: "https://www.facebook.com/ExampleRestaurant/"
      },
      ubereats: {
        sourceUrl: "https://www.ubereats.com/store/example/abc123",
        address: "123 Queen St, Auckland",  // May differ slightly
        openingHours: [
          { day: "Monday", hours: { open: "11:00", close: "21:00" } },
          // ...
        ],
        ogImage: "https://tb-static.uber.com/prod/image-proc/..."
      }
    },

    // Metadata
    sourcesScraped: ["google", "ubereats"],
    googleSearchUrl: "https://www.google.com/search?q=...",
    extractionNotes: []
  }
}
```

### Dialog UI Requirements

#### Section 1: Address
```
┌─────────────────────────────────────────────────────────────────────┐
│ Address                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ Current: 123 Queen St, Auckland                                      │
│                                                                      │
│ ○ Keep current                                                       │
│ ● Google [↗]: 123 Queen Street, Auckland CBD, Auckland 1010         │
│ ○ UberEats [↗]: 123 Queen St, Auckland                              │
│                                                                      │
│ [↗] = Opens source URL in new tab                                   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Section 2: Phone
```
┌─────────────────────────────────────────────────────────────────────┐
│ Phone                                                                │
├─────────────────────────────────────────────────────────────────────┤
│ Current: (none)                                                      │
│                                                                      │
│ ○ Keep current                                                       │
│ ● Google [↗]: +64 9 300 1234                                        │
│                                                                      │
│ Note: Phone only available from Google Business Profile             │
└─────────────────────────────────────────────────────────────────────┘
```

#### Section 3: Opening Hours
```
┌─────────────────────────────────────────────────────────────────────┐
│ Opening Hours                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Current: Mon-Fri 11:00-21:00, Sat-Sun 10:00-22:00                   │
│                                                                      │
│ ○ Keep current                                                       │
│ ● Google [↗]:                                                        │
│   Monday: 11:00 - 21:00                                              │
│   Tuesday: 11:00 - 21:00                                             │
│   ...                                                                │
│ ○ UberEats [↗]:                                                      │
│   Monday: 11:00 AM - 9:00 PM                                         │
│   Tuesday: 11:00 AM - 9:00 PM                                        │
│   ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

#### Section 4: Social Links
```
┌─────────────────────────────────────────────────────────────────────┐
│ Social Links                                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Instagram                                                            │
│ Current: (none)                                                      │
│ ☑ Google [↗]: instagram.com/examplerestaurant                       │
│                                                                      │
│ Facebook                                                             │
│ Current: facebook.com/OldPage                                        │
│ ☐ Google [↗]: facebook.com/ExampleRestaurant                        │
└─────────────────────────────────────────────────────────────────────┘
```

#### Section 5: Platform URLs
```
┌─────────────────────────────────────────────────────────────────────┐
│ Platform URLs                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ ☑ UberEats: ubereats.com/store/example/abc123 [↗]                   │
│ ☑ DoorDash: doordash.com/store/example/12345 [↗]                    │
│ ☐ Website: example-restaurant.co.nz [↗] (has existing)              │
└─────────────────────────────────────────────────────────────────────┘
```

#### Section 6: OG Image (if extracted)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Restaurant Image                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ☑ Save UberEats banner image                                        │
│                                                                      │
│ [Preview of OG image thumbnail]                                      │
│                                                                      │
│ This will be saved as: ubereats_og_image                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage 5: Save & Process

### Opening Hours Processing

The existing opening hours processing from v2.1 will be applied:

```javascript
// 1. Day Range Expansion
"Monday-Friday" → 5 separate entries

// 2. "Every Day" Handling
"Daily" / "Every day" → 7 separate entries

// 3. 24-Hour Conversion
"9:30 PM" → "21:30"
"11am" → "11:00"

// 4. Midnight Crossing Detection
// If close < open (e.g., 11:00 - 02:00):
// Split into two entries:
{ day: "Friday", hours: { open: "11:00", close: "23:59" } }
{ day: "Saturday", hours: { open: "00:00", close: "02:00" } }
```

### Phone Number Processing

```javascript
// E.164 Normalization
"09 123 4567" → "+6491234567"
"(09) 123-4567" → "+6491234567"
"+64 9 123 4567" → "+6491234567"

// Validation (keep existing patterns)
const validPatterns = [
  /^\+64[2-9]\d{7,9}$/,    // +64 mobile/landline
  /^0[3-9]\d{7}$/,         // 0X landline
  /^02[0-9]\d{7,8}$/,      // 02X mobile
  /^0800\d{6,7}$/,         // 0800 numbers
  /^0508\d{6}$/            // 0508 numbers
];
```

### OG Image Processing

```javascript
// Only process if user selected to save
if (selections.ubereats_og_image?.save && extractedData.ogImage) {
  const base64Image = await processOgImageToBase64(extractedData.ogImage);
  if (base64Image) {
    updateData.ubereats_og_image = base64Image;
  }
}
```

---

## API Changes

### Modified: POST /api/google-business-search

**New Parameters:**
```javascript
{
  restaurantName: string,
  city: string,
  restaurantId: string,

  // Stage control
  urlsOnly: boolean,        // Stage 1 only
  extractFromGoogle: boolean, // Stage 2 (new)
  extractFromUberEats: boolean, // Stage 3 (conditional)

  // Confirmed URLs from user
  confirmedUrls: {
    websiteUrl: string,
    ubereatsUrl: string,
    // ...
  },

  // Preview mode
  previewOnly: boolean
}
```

**New Response Fields:**
```javascript
{
  success: true,
  previewMode: true,
  data: {
    platformUrls: { ... },
    extractedBySource: {
      google: {
        sourceUrl: string,  // NEW: URL for verification link
        address: string,
        phone: string,
        openingHours: array,
        instagramUrl: string,
        facebookUrl: string
      },
      ubereats: {
        sourceUrl: string,  // NEW: URL for verification link
        address: string,
        openingHours: array,
        ogImage: string     // NEW: OG image URL
      }
    },
    sourcesScraped: array,
    extractionNotes: array
  }
}
```

### Modified: POST /api/google-business-search/save

**New Selection Options:**
```javascript
{
  restaurantId: string,
  selections: {
    // Multi-source fields
    address: { save: boolean, source: "google" | "ubereats" | "keep" },
    phone: { save: boolean, source: "google" | "keep" },
    opening_hours: { save: boolean, source: "google" | "ubereats" | "keep" },

    // Single-source fields
    instagram_url: { save: boolean },
    facebook_url: { save: boolean },
    ubereats_url: { save: boolean },
    doordash_url: { save: boolean },
    // ... other platform URLs

    // New field
    ubereats_og_image: { save: boolean }
  },
  extractedBySource: { ... },
  platformUrls: { ... }
}
```

---

## Database Changes

### No Migration Required

The `ubereats_og_image` column already exists in the `restaurants` table:

```sql
-- Already exists in restaurants table (line 94 of schema)
ubereats_og_image text,
doordash_og_image text,  -- Also exists (line 95)
website_og_image text,   -- Also exists (line 91)
```

**Note:** The table is `restaurants`, not `restaurant_workflows`. All OG image columns are already in place.

---

## Implementation Checklist

### Backend Changes ✅ COMPLETE

- [x] Add `buildGoogleBusinessSearchUrl()` function
- [x] Add `GOOGLE_BUSINESS_SCHEMA` and `GOOGLE_BUSINESS_PROMPT`
- [x] Add `UBEREATS_FALLBACK_SCHEMA` and `UBEREATS_FALLBACK_PROMPT`
- [x] Modify `/api/google-business-search` endpoint for new flow
- [x] Add OG image extraction to UberEats scraping
- [x] Add `processOgImageToBase64()` function
- [x] Add `sourceUrl` to `extractedBySource` response
- [x] Modify `/api/google-business-search/save` to update `restaurants` table
- [x] Website extraction kept as legacy fallback (only used when Google + UberEats fail)
- [x] ~~Database migration for `ubereats_og_image` column~~ (already exists)

### Frontend Changes ✅ COMPLETE

- [x] Update `handleGoogleSearch()` for new 5-stage flow
- [x] Update `handleConfirmGoogleSearchUrls()` to trigger Stage 2
- [x] Add conditional Stage 3 trigger logic
- [x] Update data selection dialog with source links
- [x] Add OG image preview and selection
- [x] Add "Open source" link buttons [↗] using ExternalLink icon
- [x] Update `googleSearchSelections` state for new fields
- [x] Add OG image to selection state
- [x] Update smart defaults to prefer Google as primary source

### Testing ✅ COMPLETE

- [x] Test Stage 2: Google Business Profile extraction
- [x] Test Stage 3: UberEats fallback trigger conditions
- [x] Test OG image extraction and base64 conversion
- [x] Test source links open correctly
- [x] Test opening hours processing (midnight crossing, day ranges)
- [x] Test phone number validation (NZ formats)
- [x] Test dialog displays sources correctly
- [x] Test save endpoint with new fields

### Next Steps - UI/UX Improvements

- [ ] Improve visual design of data selection dialog
- [ ] Better visual distinction between source options
- [ ] Enhanced OG image preview styling
- [ ] Mobile responsiveness refinements
- [ ] Loading state animations

---

## Migration Notes

### Breaking Changes

1. **Website extraction removed** - Users should use "Get Info" feature separately
2. **Phone no longer from website** - Only Google Business Profile

### Non-Breaking Changes

1. New OG image field is optional
2. Existing restaurants unaffected
3. Stage 3 only triggers when needed (conditional)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | Previous | Two-phase flow, multi-source selection |
| 3.0 | 2025-12-13 | **IMPLEMENTED** - Google Business Profile primary, UberEats fallback, OG image extraction, clickable source links for verification |
| 3.0.1 | 2025-12-14 | **OPTIMIZATION** - (1) Removed redundant `ogImage` from UberEats JSON schema/prompt since `metadata.ogImage` is used for better quality; (2) Skip Firecrawl search when `confirmedUrls` provided - eliminates wasted API call on second request |

---

## Related Files

| File | Changes |
|------|---------|
| `server.js` | New extraction logic, modified endpoints |
| `RestaurantDetail.jsx` | New dialog, updated handlers |
| `lead-scrape-firecrawl-service.js` | Reference for Google extraction (copy patterns) |
| `lead-url-validation-service.js` | Shared validation (no changes) |

---

## Appendix: Lead Scraping Reference Code

### Google Search URL Builder (line 553-556)
```javascript
function buildGoogleSearchUrl(restaurantName, address) {
  const query = `${restaurantName} ${address || ''}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
```

### Step 3 Schema (lines 210-255)
```javascript
const STEP_3_SCHEMA = {
  type: "object",
  properties: {
    phone: { type: "string", description: "Business phone number in local format" },
    website_url: { type: "string", description: "Official business website URL" },
    openingHours: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          open: { type: "string" },
          close: { type: "string" },
          period: { type: "string" }
        }
      }
    },
    google_address: { type: "string" },
    instagram_url: { type: "string" },
    facebook_url: { type: "string" }
  }
};
```

### Step 3 Prompt (lines 257-290)
```
Extract business information from this Google search results page.
Focus on the Knowledge Panel / Business Profile on the right side.

1. PHONE NUMBER - Business phone in local format
2. WEBSITE URL - Official business website ONLY (exclude delivery platforms)
3. OPENING HOURS - Extract hours exactly as shown, use period for split hours
4. GOOGLE ADDRESS - Full business address
5. INSTAGRAM URL - Profile URLs only, reject reels/posts
6. FACEBOOK URL - Page URLs only, reject videos/groups
```
