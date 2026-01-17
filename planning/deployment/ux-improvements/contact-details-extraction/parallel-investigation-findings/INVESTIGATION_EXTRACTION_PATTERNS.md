# Investigation: Google Search v3.0.1 Extraction Patterns

## Multi-Phase Flow Overview

```
Phase 1 (urlsOnly: true)    → Search for URLs, return for confirmation
Phase 2 (previewOnly: true) → Extract content, return multi-source data
Phase 3 (/save endpoint)    → Save user-selected fields
```

## Phase 1: URL Discovery

**Request:**
```javascript
POST /api/google-business-search
{ restaurantName, city, restaurantId, urlsOnly: true }
```

**Response:**
```javascript
{ success: true, urlsOnly: true, data: { platformUrls: { websiteUrl, ubereatsUrl, ... } } }
```

## Phase 2: Content Extraction

**Request:**
```javascript
POST /api/google-business-search
{ restaurantName, city, restaurantId, previewOnly: true, confirmedUrls: {...} }
```

**Response:**
```javascript
{
  success: true,
  previewMode: true,
  data: {
    platformUrls: {...},
    extractedBySource: {
      google: { address, phone, openingHours, sourceUrl },
      ubereats: { address, phone: null, openingHours, ogImage, sourceUrl }
    },
    sourcesScraped: ["google", "ubereats"],
    extractionNotes: []
  }
}
```

## Phase 3: Save with Selection

**Request:**
```javascript
POST /api/google-business-search/save
{
  restaurantId,
  selections: {
    address: { save: true, source: "ubereats" },    // Multi-source field
    phone: { save: true, source: "google" },        // Multi-source field
    opening_hours: { save: true, source: "ubereats" },
    website_url: { save: true },                    // Single-source field
    ubereats_og_image: { save: true }
  },
  extractedBySource: {...},
  platformUrls: {...}
}
```

## Frontend State Management

```javascript
// Phase 1 states
const [googleSearchUrlDialogOpen, setGoogleSearchUrlDialogOpen] = useState(false);
const [pendingGoogleSearchUrls, setPendingGoogleSearchUrls] = useState(null);
const [editableWebsiteUrl, setEditableWebsiteUrl] = useState('');

// Phase 2 states
const [googleSearchConfirmDialogOpen, setGoogleSearchConfirmDialogOpen] = useState(false);
const [pendingGoogleSearchData, setPendingGoogleSearchData] = useState(null);

// Selection state
const [googleSearchSelections, setGoogleSearchSelections] = useState({
  address: { save: true, source: null },
  phone: { save: true, source: null },
  opening_hours: { save: true, source: null },
  // Single-source fields
  website_url: { save: true },
  ubereats_url: { save: true }
});
```

## Smart Defaults Logic

```javascript
const setGoogleSearchSmartDefaults = (extractedBySource, platformUrls) => {
  // 1. Uncheck fields with existing values
  // 2. Auto-select best source per field:
  //    - Address: UberEats → Website → DoorDash
  //    - Phone: Google only
  //    - Hours: UberEats → Website
};
```

## Handler Functions

- `handleGoogleSearch()` - Phase 1: Search for URLs
- `handleConfirmGoogleSearchUrls()` - Phase 2: Extract from confirmed URLs
- `handleConfirmGoogleSearchUpdate()` - Phase 3: Save selected data
- `applyGoogleSearchUpdates()` - Helper to call save endpoint
- `setGoogleSearchSmartDefaults()` - Set intelligent defaults

## Key Patterns for Contact Extraction

1. **Multi-phase flow** with user confirmation at each step
2. **Multi-source data** stored in `extractedBySource` object
3. **Selection state** tracks `{ save: boolean, source: string }` per field
4. **Smart defaults** based on data reliability
5. **sourceUrl** included for verification links
