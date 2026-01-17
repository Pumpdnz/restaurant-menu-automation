# Google Business Search Feature - Technical Documentation

## Overview

The Google Business Search feature extracts business information for restaurants from various online sources. It discovers platform URLs (UberEats, DoorDash, social media, etc.) and extracts structured data (address, phone, opening hours) from those sources.

**Key Files:**
- Backend: `UberEats-Image-Extractor/server.js` (lines 5160-6252)
- Frontend: `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` (lines 104-130, 1693-1962)
- URL Validation: `UberEats-Image-Extractor/src/services/lead-url-validation-service.js`

---

## Architecture

### Two-Phase Extraction Flow

The system uses a two-phase approach to ensure data quality:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: URL Discovery                       │
│                                                                      │
│  User clicks "Google Search"                                         │
│           │                                                          │
│           ▼                                                          │
│  API: POST /google-business-search { urlsOnly: true }               │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Build search query with restaurant name + city + country  │    │
│  │ 2. Call Firecrawl Search API                                 │    │
│  │ 3. Categorize URLs by platform                               │    │
│  │ 4. Validate URLs (reject invalid social media patterns)      │    │
│  │ 5. Return platform URLs only (no content extraction)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│           │                                                          │
│           ▼                                                          │
│  Show URL Confirmation Dialog                                        │
│  - User can edit/correct website URL                                 │
│  - User confirms before extraction begins                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 2: Content Extraction                      │
│                                                                      │
│  User confirms URLs                                                  │
│           │                                                          │
│           ▼                                                          │
│  API: POST /google-business-search                                   │
│       { previewOnly: true, confirmedUrls: {...} }                   │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Use confirmed URLs (or search if not provided)            │    │
│  │ 2. Scrape content from UberEats, Website sources             │    │
│  │ 3. Extract address, phone, opening hours using AI            │    │
│  │ 4. Store data by source in extractedBySource object          │    │
│  │ 5. Return multi-source data for user selection               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ If existing values OR multiple sources:                      │    │
│  │   → Show Data Selection Dialog                               │    │
│  │   → User selects which fields to save and from which source  │    │
│  │ Else:                                                        │    │
│  │   → Auto-apply all extracted data                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 3: Save Data                           │
│                                                                      │
│  User confirms selection (or auto-apply)                             │
│           │                                                          │
│           ▼                                                          │
│  API: POST /google-business-search/save                              │
│       { restaurantId, selections, extractedBySource, platformUrls } │
│           │                                                          │
│           ▼                                                          │
│  Save selected fields to database                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. POST /api/google-business-search

**Purpose:** Search for platform URLs and/or extract business information.

**Authentication:** Required (authMiddleware)
**Feature Flag:** `googleSearchExtraction` (requireGoogleSearch middleware)

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `restaurantName` | string | Yes | - | Name of the restaurant to search for |
| `city` | string | Yes | - | City location for search |
| `restaurantId` | string | No | - | UUID of restaurant (for auto-save in non-preview mode) |
| `urlsOnly` | boolean | No | `false` | **Phase 1 mode**: Only search for URLs, skip content extraction |
| `previewOnly` | boolean | No | `false` | **Phase 2 mode**: Extract content but don't save, return multi-source data |
| `confirmedUrls` | object | No | `null` | User-confirmed URLs to use instead of searching |

#### Response Formats

**When `urlsOnly: true` (Phase 1):**
```javascript
{
  success: true,
  urlsOnly: true,
  data: {
    platformUrls: {
      websiteUrl: "https://example-restaurant.co.nz",
      ubereatsUrl: "https://www.ubereats.com/store/example-restaurant/abc123",
      doordashUrl: "https://www.doordash.com/store/example-restaurant-wellington-12345",
      instagramUrl: "https://www.instagram.com/examplerestaurant/",
      facebookUrl: "https://www.facebook.com/ExampleRestaurant/",
      meandyouUrl: null,
      mobi2goUrl: null,
      delivereasyUrl: null,
      nextorderUrl: null,
      foodhubUrl: null,
      ordermealUrl: null
    }
  }
}
```

**When `previewOnly: true` (Phase 2):**
```javascript
{
  success: true,
  previewMode: true,
  data: {
    platformUrls: {
      websiteUrl: "https://example-restaurant.co.nz",
      ubereatsUrl: "https://www.ubereats.com/store/example-restaurant/abc123",
      // ... other URLs
    },
    extractedBySource: {
      ubereats: {
        address: "123 Cuba Street, Wellington Central, Wellington 6011",
        phone: null,  // UberEats never has phone numbers
        openingHours: [
          { day: "Monday", hours: { open: "11:00", close: "21:00" } },
          { day: "Tuesday", hours: { open: "11:00", close: "21:00" } },
          // ... other days
        ]
      },
      website: {
        address: "123 Cuba St, Wellington",
        phone: "+6443851234",
        openingHours: [
          { day: "Monday", hours: { open: "11:00", close: "9:00PM" } },
          // ... may have different format
        ]
      }
    },
    sourcesScraped: ["ubereats", "website"],
    extractionNotes: []
  }
}
```

**When neither flag set (legacy mode - auto-save):**
```javascript
{
  success: true,
  data: {
    restaurantName: "Example Restaurant",
    address: "123 Cuba Street, Wellington Central, Wellington 6011",
    phone: "+6443851234",
    openingHours: [
      { day: "Monday", hours: { open: "11:00", close: "21:00" } },
      // ...
    ],
    websiteUrl: "https://example-restaurant.co.nz",
    ubereatsUrl: "https://www.ubereats.com/store/...",
    // ... other URLs
    extractionNotes: []
  }
}
```

---

### 2. POST /api/google-business-search/save

**Purpose:** Save selected fields from the preview data to the database.

**Authentication:** Required (authMiddleware)

#### Request Parameters

```javascript
{
  restaurantId: "uuid-of-restaurant",
  selections: {
    // Multi-source fields (require source selection)
    address: { save: true, source: "ubereats" },
    phone: { save: true, source: "website" },
    opening_hours: { save: true, source: "ubereats" },

    // Single-source fields (just save: boolean)
    website_url: { save: true },
    ubereats_url: { save: true },
    doordash_url: { save: false },  // User chose not to save
    instagram_url: { save: true },
    facebook_url: { save: true },
    meandyou_url: { save: true },
    mobi2go_url: { save: true },
    delivereasy_url: { save: true },
    nextorder_url: { save: true },
    foodhub_url: { save: true },
    ordermeal_url: { save: true }
  },
  extractedBySource: {
    // Multi-source data from preview response
  },
  platformUrls: {
    // Platform URLs from preview response
  }
}
```

#### Response

```javascript
{
  success: true,
  fieldsUpdated: ["address", "phone", "opening_hours", "website_url", "instagram_url"]
}
```

---

## Backend Implementation Details

### File: `server.js`

#### URL Discovery (Lines 5206-5371)

The system searches for URLs using Firecrawl's search API:

```javascript
// Combined search query to minimize API calls
const combinedQuery = `${restaurantName} ${city} ${searchCountry} (website OR ubereats OR doordash OR delivereasy OR facebook OR instagram OR menu OR order online)`;
```

**URL Categorization Logic:**
- URLs are categorized by checking if they contain platform-specific domains
- First match wins for each category (e.g., first UberEats URL found is used)
- Website URL excludes known aggregator sites (Yelp, TripAdvisor, Google, etc.)

**Excluded from Website Detection:**
- google, yelp, tripadvisor, menulog, zomato, grabone
- firsttable, tiktok, youtube, myguide, neatplaces
- wanderlog, stuff.co.nz, bookme, reddit, thespinoff

#### URL Validation (Lines 5411-5434)

URLs are validated using `lead-url-validation-service.js`:

**Instagram Validation:**
- Rejects: `/reel/`, `/p/`, `/stories/`, `/reels/`, `/tv/`, `/explore/`
- Accepts: Profile URLs only (e.g., `instagram.com/username/`)
- Strips query parameters

**Facebook Validation:**
- Rejects: `/videos/`, `/groups/`, `/posts/`, `/events/`, `/photos/`, `/watch/`
- Accepts: Page URLs and `/p/` profile URLs
- Strips query parameters

**Website Validation:**
- Rejects delivery platform domains (ubereats, doordash, delivereasy, menulog, etc.)

#### Content Extraction (Lines 5534-5817)

**Extraction Priority:**
1. UberEats (for address and hours - most reliable)
2. Website (for phone number and fallback data)

**Important Notes:**
- UberEats is configured with `extractPhone: false` because it never has phone numbers
- Website is the only source for phone numbers

**Extraction Schema (UberEats):**
```javascript
{
  prompt: "Extract restaurant business information...",
  schema: {
    type: 'object',
    properties: {
      address: { type: 'string' },
      phone: { type: 'string' },
      openingHours: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'string' },
            open: { type: 'string' },
            close: { type: 'string' },
            period: { type: 'string' }  // For split hours (lunch/dinner)
          }
        }
      }
    }
  }
}
```

#### Opening Hours Processing (Lines 5624-5687)

**Handles complex hour formats:**
- "Every day" / "Daily" → Expands to all 7 days
- "Monday-Saturday" → Expands day ranges
- Individual days with times

**Midnight Crossing Handling:**
If close time < open time (e.g., 11:00 - 02:00):
- Split into two entries:
  - Day 1: 11:00 - 23:59
  - Day 2: 00:00 - 02:00

#### Helper Functions

**`getSourceName(url)`** - Lines 5176-5185
Identifies the source from a URL:
- Returns: 'ubereats', 'doordash', 'menulog', 'delivereasy', or 'website'

**`convertTo24Hour(timeStr)`** - Defined elsewhere
Converts time strings like "9:30 PM" to "21:30"

**`parseTime(timeStr)`** - Defined elsewhere
Parses time string to minutes since midnight

**`getNextDay(day)`** - Defined elsewhere
Returns the next day of the week (for midnight crossing)

---

## Frontend Implementation Details

### File: `RestaurantDetail.jsx`

#### State Variables (Lines 104-135)

```javascript
// Loading state
const [searchingGoogle, setSearchingGoogle] = useState(false);

// Phase 1: URL confirmation dialog
const [googleSearchUrlDialogOpen, setGoogleSearchUrlDialogOpen] = useState(false);
const [pendingGoogleSearchUrls, setPendingGoogleSearchUrls] = useState(null);
const [editableWebsiteUrl, setEditableWebsiteUrl] = useState('');

// Phase 2: Data selection dialog
const [googleSearchConfirmDialogOpen, setGoogleSearchConfirmDialogOpen] = useState(false);
const [pendingGoogleSearchData, setPendingGoogleSearchData] = useState(null);

// Selection state
const [googleSearchSelections, setGoogleSearchSelections] = useState({
  // Multi-source fields
  address: { save: true, source: null },
  phone: { save: true, source: null },
  opening_hours: { save: true, source: null },
  // Single-source fields
  website_url: { save: true },
  ubereats_url: { save: true },
  // ... other platform URLs
});
```

#### Key Functions

**`hasExistingGoogleSearchValues()`** - Lines 1693-1712
Checks if restaurant already has any values that could be overwritten.
Used to determine whether to show confirmation dialog.

**`setGoogleSearchSmartDefaults(extractedBySource, platformUrls)`** - Lines 1714-1776
Sets intelligent default selections:
- **Unchecks fields** that already have values (prevents accidental overwrite)
- **Auto-selects best source** per field:
  - Address: UberEats → Website → DoorDash
  - Phone: Website only (UberEats never has phone)
  - Hours: UberEats → Website

**`applyGoogleSearchUpdates(data, selectAll)`** - Lines 1778-1826
Sends selected data to save endpoint.
- `selectAll=true`: Auto-select all available data (for first-time setup)
- `selectAll=false`: Use user's selections from dialog

**`handleGoogleSearch()`** - Lines 1843-1896
Phase 1 handler - Searches for URLs only:
1. Calls API with `urlsOnly: true`
2. Opens URL confirmation dialog
3. User can edit website URL before extraction

**`handleConfirmGoogleSearchUrls()`** - Lines 1899-1962
Phase 2 handler - Extracts content from confirmed URLs:
1. Closes URL dialog
2. Calls API with `confirmedUrls` and `previewOnly: true`
3. Shows data selection dialog or auto-applies

**`handleConfirmGoogleSearchUpdate()`** - Lines 1828-1841
Final handler - Saves selected data:
1. Closes data selection dialog
2. Calls `applyGoogleSearchUpdates` with user selections

---

## URL Validation Service

### File: `lead-url-validation-service.js`

#### `cleanInstagramUrl(url)`

**Valid Patterns:**
- `https://instagram.com/username`
- `https://www.instagram.com/username/`
- `https://instagram.com/username?hl=en` (query params stripped)

**Invalid Patterns (returns null):**
- `https://instagram.com/reel/ABC123`
- `https://instagram.com/p/ABC123`
- `https://instagram.com/stories/username`
- `https://instagram.com/reels/ABC123`
- `https://instagram.com/tv/ABC123`
- `https://instagram.com/explore/tags/food`

#### `cleanFacebookUrl(url)`

**Valid Patterns:**
- `https://facebook.com/PageName`
- `https://www.facebook.com/PageName/`
- `https://facebook.com/p/Business-Name-100064005101592/` (new format)
- `https://facebook.com/profile.php?id=123456`

**Invalid Patterns (returns null):**
- `https://facebook.com/videos/123456`
- `https://facebook.com/groups/groupname`
- `https://facebook.com/posts/123456`
- `https://facebook.com/events/123456`
- `https://facebook.com/photos/123456`
- `https://facebook.com/watch/123456`

#### `cleanWebsiteUrl(url)`

**Valid:** Any URL not on a delivery platform domain

**Invalid (returns null):**
- ubereats.com
- doordash.com
- delivereasy.co.nz
- menulog.co.nz / menulog.com.au
- grubhub.com
- postmates.com
- skip.com
- deliveroo.com
- foodora.com

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Google Search Button] ──onClick──▶ handleGoogleSearch()               │
│           │                                                              │
│           ▼                                                              │
│  setSearchingGoogle(true)                                                │
│           │                                                              │
│           ▼                                                              │
│  api.post('/google-business-search', { urlsOnly: true }) ────────────┐  │
│           │                                                          │  │
│           ▼                                                          │  │
│  setPendingGoogleSearchUrls(platformUrls)                            │  │
│  setEditableWebsiteUrl(websiteUrl)                                   │  │
│  setGoogleSearchUrlDialogOpen(true)                                  │  │
│           │                                                          │  │
│           ▼                                                          │  │
│  [URL Confirmation Dialog]                                           │  │
│   - Shows all found URLs                                             │  │
│   - Website URL is EDITABLE                                          │  │
│   - [Cancel] [Confirm & Extract]                                     │  │
│           │                                                          │  │
│           ▼                                                          │  │
│  handleConfirmGoogleSearchUrls() ◀──────────────────────────────────┘  │
│           │                                                              │
│           ▼                                                              │
│  api.post('/google-business-search', {                                  │
│    previewOnly: true,                                                    │
│    confirmedUrls: { websiteUrl: editableWebsiteUrl, ... }               │
│  }) ─────────────────────────────────────────────────────────────────┐  │
│           │                                                          │  │
│           ▼                                                          │  │
│  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │ hasExistingValues() OR hasMultipleSources()?                │    │  │
│  └─────────────────────────────────────────────────────────────┘    │  │
│           │                              │                           │  │
│          YES                            NO                           │  │
│           │                              │                           │  │
│           ▼                              ▼                           │  │
│  setPendingGoogleSearchData(data)   applyGoogleSearchUpdates(       │  │
│  setGoogleSearchSmartDefaults(...)    data, selectAll=true)         │  │
│  setGoogleSearchConfirmDialogOpen(true)      │                      │  │
│           │                                  │                       │  │
│           ▼                                  │                       │  │
│  [Data Selection Dialog]                     │                       │  │
│   - Multi-source fields with source dropdown │                       │  │
│   - Single-source fields with checkboxes     │                       │  │
│   - Shows current vs new values              │                       │  │
│   - [Cancel] [Apply Selected]                │                       │  │
│           │                                  │                       │  │
│           ▼                                  │                       │  │
│  handleConfirmGoogleSearchUpdate() ◀─────────┘                      │  │
│           │                                                          │  │
│           ▼                                                          │  │
│  api.post('/google-business-search/save', {                          │  │
│    restaurantId,                                                     │  │
│    selections: googleSearchSelections,                               │  │
│    extractedBySource,                                                │  │
│    platformUrls                                                      │  │
│  }) ◀────────────────────────────────────────────────────────────────┘  │
│           │                                                              │
│           ▼                                                              │
│  setSuccess("X fields updated")                                          │
│  fetchRestaurantDetails()  // Refresh UI                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

The restaurant data is stored in the `restaurants` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Restaurant name |
| `address` | TEXT | Physical address |
| `phone` | TEXT | Phone number (E.164 format: +64...) |
| `opening_hours` | JSONB | Array of day/hours objects |
| `website_url` | TEXT | Restaurant's own website |
| `ubereats_url` | TEXT | UberEats store URL |
| `doordash_url` | TEXT | DoorDash store URL |
| `instagram_url` | TEXT | Instagram profile URL |
| `facebook_url` | TEXT | Facebook page URL |
| `meandyou_url` | TEXT | MeAndU ordering URL |
| `mobi2go_url` | TEXT | Mobi2Go ordering URL |
| `delivereasy_url` | TEXT | Delivereasy store URL |
| `nextorder_url` | TEXT | NextOrder URL |
| `foodhub_url` | TEXT | FoodHub URL |
| `ordermeal_url` | TEXT | OrderMeal URL |

**Opening Hours Format:**
```json
[
  { "day": "Monday", "hours": { "open": "11:00", "close": "21:00" } },
  { "day": "Tuesday", "hours": { "open": "11:00", "close": "21:00" } },
  { "day": "Wednesday", "hours": { "open": "11:00", "close": "23:59" } },
  { "day": "Thursday", "hours": { "open": "00:00", "close": "02:00" } },  // Midnight crossing continuation
  // ...
]
```

---

## Source Priority Logic

### Multi-Source Fields

These fields can be extracted from multiple sources. The system uses priority-based selection:

| Field | Priority Order | Notes |
|-------|---------------|-------|
| Address | UberEats → Website → DoorDash | UberEats has most accurate formatted addresses |
| Phone | Website only | UberEats **never** has phone numbers |
| Opening Hours | UberEats → Website | UberEats hours are most accurate and consistent |

### Single-Source Fields

Platform URLs come from a single source (the search results) and don't need source selection:

- website_url
- ubereats_url
- doordash_url
- instagram_url
- facebook_url
- meandyou_url
- mobi2go_url
- delivereasy_url
- nextorder_url
- foodhub_url
- ordermeal_url

---

## Error Handling

### Backend Errors

| Error | HTTP Code | Cause |
|-------|-----------|-------|
| "Restaurant name and city are required" | 400 | Missing required parameters |
| "Database not available" | 500 | Supabase connection issue |
| "Failed to search for business information" | 500 | Firecrawl API error |
| Rate limit (429) | - | Triggers retry with simpler query |

### Frontend Error Handling

```javascript
try {
  // API calls
} catch (err) {
  setError(err.response?.data?.error || 'Failed to search for business information');
} finally {
  setSearchingGoogle(false);
}
```

---

## Usage Tracking

The system tracks Google Search usage via `UsageTrackingService`:

```javascript
UsageTrackingService.trackEvent(organisationId, UsageEventType.GOOGLE_SEARCH, 1, {
  restaurant_name: restaurantName,
  city: city,
  restaurant_id: restaurantId,
  platforms_found: Object.entries(foundUrls).filter(([k, v]) => v).map(([k]) => k).length,
  urls_only_mode: true,  // or preview_mode: true
});
```

---

## Extending the System

### Adding a New Platform

1. **Add to search queries** (server.js ~5211-5217):
   ```javascript
   `${restaurantName} ${city} ${searchCountry} newplatform`,
   ```

2. **Add to foundUrls object** (server.js ~5220-5232):
   ```javascript
   newplatformUrl: null,
   ```

3. **Add URL categorization** (server.js ~5268-5316):
   ```javascript
   } else if (url.includes('newplatform') && !foundUrls.newplatformUrl) {
     foundUrls.newplatformUrl = result.url;
   }
   ```

4. **Add to extractedData** (server.js ~5487-5507):
   ```javascript
   newplatformUrl: foundUrls.newplatformUrl,
   ```

5. **Add to save endpoint URL fields** (server.js ~6208-6220):
   ```javascript
   { key: 'newplatform_url', dataKey: 'newplatformUrl' },
   ```

6. **Add to frontend selections state** (RestaurantDetail.jsx ~118-130):
   ```javascript
   newplatform_url: { save: true },
   ```

7. **Update database schema** - Add `newplatform_url` column to `restaurants`

### Adding a New Multi-Source Field

1. **Extract in backend** - Add to extraction schema and processing logic
2. **Add to extractedBySource** - Store by source in the data structure
3. **Add to selections state** - With `{ save: boolean, source: string }`
4. **Add to smart defaults** - Define preferred sources
5. **Add to save endpoint** - Process with source lookup

### Modifying URL Validation

Edit `lead-url-validation-service.js`:
- Add patterns to `invalidPatterns` arrays
- Add domains to `deliveryPlatforms` array
- Export new validation functions

---

## Testing Checklist

- [ ] URL-only mode returns URLs without extraction
- [ ] Preview mode returns multi-source data
- [ ] URL validation rejects invalid social media URLs
- [ ] Website URL is editable in confirmation dialog
- [ ] Smart defaults uncheck fields with existing values
- [ ] Smart defaults select correct source for each field
- [ ] Save endpoint correctly applies selected fields
- [ ] Opening hours handle midnight crossing correctly
- [ ] Phone number formatting (E.164) works correctly
- [ ] Rate limit retry logic works
- [ ] Mobile responsiveness works on both dialogs
- [ ] Current vs new values display correctly for all fields

---

## Current Implementation Status

### Completed Features (v2.1)

| Feature | Status | Description |
|---------|--------|-------------|
| Two-phase extraction | ✅ Complete | URL discovery → User confirmation → Content extraction |
| URL confirmation dialog | ✅ Complete | Editable website URL, shows all found platforms |
| Data selection dialog | ✅ Complete | Multi-source selection with radio buttons |
| URL validation | ✅ Complete | Rejects invalid Instagram/Facebook patterns |
| Smart defaults | ✅ Complete | Auto-selects best source, unchecks existing values |
| Mobile responsiveness | ✅ Complete | Both dialogs work on mobile devices |
| Current vs new comparison | ✅ Complete | Shows existing values alongside new values |
| Opening hours display | ✅ Complete | Shows actual day/time entries from each source |

### Dialog Features

**URL Confirmation Dialog (Phase 1):**
- Editable website URL input
- Platform URLs show "Has existing" badge and current value
- Shows both "Current:" and "Found:" for comparison
- Mobile-responsive with stacked layout on small screens

**Data Selection Dialog (Phase 2):**
- Address: Shows current + source options with full addresses
- Phone: Shows current + website source (UberEats excluded)
- Opening Hours: Shows current hours + expandable list from each source
- Platform URLs: Shows "Current:" and "New:" for each URL
- All sections have Select All / Deselect All buttons

---

## Known Limitations

1. **UberEats never has phone numbers** - The system is configured to never use UberEats as a phone source
2. **Single search query** - To avoid rate limits, uses one combined query instead of per-platform queries
3. **First match wins** - For each platform, uses the first URL found
4. **Country-specific** - Currently optimized for New Zealand (NZ)
5. **No DoorDash extraction** - DoorDash is excluded from automatic content extraction (only URL discovery)
6. **No source links in dialogs** - Users cannot click through to verify source pages during selection

---

## Future Improvements

### Priority 1: Add Clickable Source Links

**Problem:** Users cannot verify the source of extracted information before selecting it.

**Proposed Solution:**
Add clickable links to source URLs at each step so users can verify data:

1. **URL Confirmation Dialog:**
   - Each platform URL should have a clickable external link icon (already implemented)
   - Add a "Verify" button that opens the URL in a new tab

2. **Data Selection Dialog:**
   - Add source URL link next to each source name in radio buttons
   - Example: `○ UberEats [↗]` where [↗] opens the UberEats page
   - For address/hours, show which specific URL the data came from

**Implementation Notes:**
- Store source URLs in `extractedBySource` alongside extracted data
- Modify backend to return `{ address: "...", phone: "...", openingHours: [...], sourceUrl: "..." }`
- Update dialog to render clickable links

### Priority 2: Compare with Lead Scraping Extraction Process

**Context:** The lead scraping system (`lead-url-validation-service.js`) has more sophisticated extraction logic that should be compared and potentially merged with Google Search extraction.

**Investigation Areas:**

| Area | Google Search | Lead Scraping | Action Needed |
|------|---------------|---------------|---------------|
| URL Validation | Uses `cleanInstagramUrl`, `cleanFacebookUrl`, `cleanWebsiteUrl` | Same service | ✅ Already shared |
| Phone Extraction | Basic pattern matching | ? | Compare approaches |
| Address Extraction | AI-based with Firecrawl | ? | Compare accuracy |
| Hours Extraction | AI-based JSON schema | ? | Compare formats |
| Review Count | Not implemented | `cleanReviewCount` function | Consider adding |
| Error Handling | Basic retry on 429 | ? | Compare robustness |

**Files to Compare:**
- `lead-url-validation-service.js` - URL validation (already shared)
- `lead-scraping-service.js` - Main scraping logic (if exists)
- Lead scraping API endpoints in server.js

**Questions to Answer:**
1. Does lead scraping extract the same fields (address, phone, hours)?
2. What extraction prompts/schemas does lead scraping use?
3. Are there validation steps in lead scraping that Google Search lacks?
4. Should we consolidate into a single extraction service?

### Priority 3: Additional Improvements

1. **Batch extraction for multiple restaurants**
   - Allow selecting multiple restaurants and running Google Search on all

2. **Extraction history/audit log**
   - Track what was extracted, from where, and when
   - Allow reverting to previous values

3. **Confidence scores**
   - Show how confident the AI is about each extracted field
   - Flag low-confidence extractions for manual review

4. **Duplicate detection**
   - Warn if the same URL is found for multiple restaurants
   - Detect if extracted address already exists for another restaurant

5. **Scheduled re-extraction**
   - Periodically re-check sources for updated information
   - Alert if business hours change

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | - | Initial implementation - auto-save without confirmation |
| 2.0 | - | Two-phase flow, multi-source selection, URL confirmation dialog |
| 2.1 | Current | Mobile responsiveness, current vs new value comparison, opening hours display |

---

## Related Documentation

- [Google Search Investigation](google-search-investigation.md) - Initial investigation findings
- [Google Search Implementation Plan](google-search-implementation-plan.md) - Original implementation plan
- Lead Scraping Documentation - TODO: Link when available
