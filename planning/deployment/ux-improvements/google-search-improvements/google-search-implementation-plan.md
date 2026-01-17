# Google Search Feature Improvement Plan

**Date:** December 12, 2025
**Status:** Ready for Implementation
**Related:** [Investigation Document](./google-search-investigation.md)
**Pattern Reference:** [Branding Selection Fix](../branding-and-logo-processing-improvements/branding-selection-fix-documentation.md)

---

## Overview

Implement user selection with **multi-source support** for the Google Search feature. Users will be able to:
- See data extracted from **each source** (UberEats, Website, etc.) separately
- Choose which source to use for each field (e.g., hours from UberEats, phone from Website)
- Decide whether to save or skip each field independently

This is more complex than the branding fix because multiple sources can provide the same data type.

---

## New Data Structure: Multi-Source Response

The key change is restructuring the API response to return data from **all sources** separately, allowing the user to pick which source to use for each field.

### Response Structure

```javascript
{
  success: true,
  previewMode: true,
  data: {
    // Platform URLs (single source each - from search results)
    platformUrls: {
      websiteUrl: "https://example.com",
      ubereatsUrl: "https://ubereats.com/store/...",
      doordashUrl: "https://doordash.com/store/...",
      instagramUrl: "https://instagram.com/restaurant",
      facebookUrl: "https://facebook.com/restaurant",
      meandyouUrl: null,
      mobi2goUrl: null,
      delivereasyUrl: null,
      nextorderUrl: null,
      foodhubUrl: null,
      ordermealUrl: null
    },

    // Multi-source extracted data
    extractedBySource: {
      ubereats: {
        address: "123 Main St, Auckland",
        phone: null,  // UberEats rarely has phone
        openingHours: [{ day: "Monday", hours: { open: "11:00", close: "21:00" }}]
      },
      website: {
        address: "123 Main Street, Auckland CBD",
        phone: "+64 9 123 4567",
        openingHours: [{ day: "Monday", hours: { open: "11:00", close: "21:30" }}]
      },
      doordash: {
        address: "123 Main St",
        phone: null,
        openingHours: []
      }
    },

    // Extraction metadata
    sourcesScraped: ["ubereats", "website"],
    extractionNotes: ["Hours differ between UberEats and website"]
  }
}
```

---

## Implementation Phases

### Phase 1: Improve URL Validation in Backend

**File:** `UberEats-Image-Extractor/server.js`

**Goal:** Use the better validation from lead-url-validation-service

#### 1.1 Import Validation Service

At the top of server.js (near other imports):
```javascript
const {
  cleanInstagramUrl,
  cleanFacebookUrl,
  cleanWebsiteUrl
} = require('./src/services/lead-url-validation-service');
```

#### 1.2 Apply Validation to Found URLs

**Location:** After URL categorization (around line 5346)

```javascript
// Validate and clean URLs using lead-url-validation-service
if (foundUrls.instagramUrl) {
  const cleaned = cleanInstagramUrl(foundUrls.instagramUrl);
  foundUrls.instagramUrl = cleaned; // null if invalid (reel, post, story)
}
if (foundUrls.facebookUrl) {
  const cleaned = cleanFacebookUrl(foundUrls.facebookUrl);
  foundUrls.facebookUrl = cleaned; // null if invalid (video, event, group)
}
if (foundUrls.websiteUrl) {
  const cleaned = cleanWebsiteUrl(foundUrls.websiteUrl);
  foundUrls.websiteUrl = cleaned; // null if delivery platform
}
```

---

### Phase 2: Restructure Backend to Collect All Sources

**File:** `UberEats-Image-Extractor/server.js`

**Goal:** Instead of "first found wins", collect data from ALL available sources

#### 2.1 Add previewOnly Parameter

```javascript
const {
  restaurantName,
  city,
  restaurantId,
  previewOnly = false  // NEW
} = req.body;
```

#### 2.2 Change Extraction Loop to Collect All Sources

**Current behavior (lines ~5507-5515):**
```javascript
// CURRENT: Stops when all data found
if (!extractionGoals.address && !extractionGoals.phone && !extractionGoals.openingHours) {
  console.log('[Google Business Search] All required data found, skipping remaining URLs');
  break;
}
```

**New behavior:**
```javascript
// NEW: Always extract from all available sources in preview mode
// Store results by source for user selection
const extractedBySource = {};

for (const urlConfig of urlsToTry) {
  const sourceName = getSourceName(urlConfig.url); // 'ubereats', 'website', 'doordash'

  // In preview mode, always try all sources
  // In non-preview mode, use existing "first found" logic
  if (!previewOnly) {
    if (!extractionGoals.address && !extractionGoals.phone && !extractionGoals.openingHours) {
      break;
    }
  }

  // ... extraction logic ...

  // Store results by source
  extractedBySource[sourceName] = {
    address: validatedAddress,
    phone: validatedPhone,
    openingHours: processedHours
  };
}
```

#### 2.3 Helper Function to Identify Source

```javascript
const getSourceName = (url) => {
  if (url.includes('ubereats.com')) return 'ubereats';
  if (url.includes('doordash.com')) return 'doordash';
  if (url.includes('menulog.')) return 'menulog';
  return 'website';
};
```

#### 2.4 Return Multi-Source Response in Preview Mode

```javascript
if (previewOnly) {
  console.log('[API] Preview mode - returning multi-source data');
  return res.json({
    success: true,
    previewMode: true,
    data: {
      platformUrls: {
        websiteUrl: foundUrls.websiteUrl,
        ubereatsUrl: foundUrls.ubereatsUrl,
        doordashUrl: foundUrls.doordashUrl,
        instagramUrl: foundUrls.instagramUrl,
        facebookUrl: foundUrls.facebookUrl,
        meandyouUrl: foundUrls.meandyouUrl,
        mobi2goUrl: foundUrls.mobi2goUrl,
        delivereasyUrl: foundUrls.delivereasyUrl,
        nextorderUrl: foundUrls.nextorderUrl,
        foodhubUrl: foundUrls.foodhubUrl,
        ordermealUrl: foundUrls.ordermealUrl
      },
      extractedBySource,
      sourcesScraped: Object.keys(extractedBySource),
      extractionNotes: notes
    }
  });
}
```

---

### Phase 3: Create Save Endpoint with Source Selection

**File:** `UberEats-Image-Extractor/server.js`

**Location:** After the google-business-search endpoint

#### 3.1 New Endpoint: POST /api/google-business-search/save

The save endpoint now accepts **which source** to use for each field:

```javascript
/**
 * POST /api/google-business-search/save
 * Save Google search data with per-field source selection
 *
 * Request body:
 * {
 *   restaurantId: "uuid",
 *   selections: {
 *     address: { save: true, source: "ubereats" },
 *     phone: { save: true, source: "website" },
 *     opening_hours: { save: true, source: "ubereats" },
 *     website_url: { save: true },
 *     instagram_url: { save: false },  // User chose not to save
 *     facebook_url: { save: true }
 *   },
 *   extractedBySource: { ... },  // Multi-source data from preview
 *   platformUrls: { ... }        // Platform URLs from preview
 * }
 */
app.post('/api/google-business-search/save', authMiddleware, async (req, res) => {
  try {
    const {
      restaurantId,
      selections,
      extractedBySource,
      platformUrls
    } = req.body;

    if (!restaurantId || !selections) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID and selections are required'
      });
    }

    console.log('[API] Saving Google search data for restaurant:', restaurantId);
    console.log('[API] Selections:', JSON.stringify(selections, null, 2));

    if (!db.isDatabaseAvailable()) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const updateData = {};

    // Process multi-source fields (address, phone, opening_hours)
    // These require looking up the value from the selected source
    if (selections.address?.save && selections.address?.source && extractedBySource) {
      const sourceData = extractedBySource[selections.address.source];
      if (sourceData?.address) {
        updateData.address = sourceData.address;
      }
    }

    if (selections.phone?.save && selections.phone?.source && extractedBySource) {
      const sourceData = extractedBySource[selections.phone.source];
      if (sourceData?.phone) {
        updateData.phone = sourceData.phone;
      }
    }

    if (selections.opening_hours?.save && selections.opening_hours?.source && extractedBySource) {
      const sourceData = extractedBySource[selections.opening_hours.source];
      if (sourceData?.openingHours?.length > 0) {
        updateData.opening_hours = sourceData.openingHours;
      }
    }

    // Process single-source fields (platform URLs)
    // These come directly from platformUrls
    const urlFields = [
      { key: 'website_url', dataKey: 'websiteUrl' },
      { key: 'ubereats_url', dataKey: 'ubereatsUrl' },
      { key: 'doordash_url', dataKey: 'doordashUrl' },
      { key: 'instagram_url', dataKey: 'instagramUrl' },
      { key: 'facebook_url', dataKey: 'facebookUrl' },
      { key: 'meandyou_url', dataKey: 'meandyouUrl' },
      { key: 'mobi2go_url', dataKey: 'mobi2goUrl' },
      { key: 'delivereasy_url', dataKey: 'delivereasyUrl' },
      { key: 'nextorder_url', dataKey: 'nextorderUrl' },
      { key: 'foodhub_url', dataKey: 'foodhubUrl' },
      { key: 'ordermeal_url', dataKey: 'ordermealUrl' }
    ];

    for (const { key, dataKey } of urlFields) {
      if (selections[key]?.save && platformUrls?.[dataKey]) {
        updateData[key] = platformUrls[dataKey];
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log('[API] Saved Google search data:', Object.keys(updateData));

      return res.json({
        success: true,
        fieldsUpdated: Object.keys(updateData)
      });
    } else {
      console.log('[API] No fields selected for update');
      return res.json({
        success: true,
        fieldsUpdated: []
      });
    }

  } catch (error) {
    console.error('[API] Google search save error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save search data'
    });
  }
});
```

---

### Phase 4: Add Frontend State Variables

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

**Location:** Near existing Google search state (around line 104)

```javascript
// Google search confirmation dialog states
const [googleSearchConfirmDialogOpen, setGoogleSearchConfirmDialogOpen] = useState(false);
const [pendingGoogleSearchData, setPendingGoogleSearchData] = useState(null);

// Multi-source selection state
// For multi-source fields: { save: boolean, source: string | null }
// For single-source fields: { save: boolean }
const [googleSearchSelections, setGoogleSearchSelections] = useState({
  // Multi-source fields (can come from UberEats, Website, etc.)
  address: { save: true, source: null },
  phone: { save: true, source: null },
  opening_hours: { save: true, source: null },
  // Single-source fields (platform URLs)
  website_url: { save: true },
  ubereats_url: { save: true },
  doordash_url: { save: true },
  instagram_url: { save: true },
  facebook_url: { save: true },
  meandyou_url: { save: true },
  mobi2go_url: { save: true },
  delivereasy_url: { save: true },
  nextorder_url: { save: true },
  foodhub_url: { save: true },
  ordermeal_url: { save: true }
});
```

---

### Phase 5: Modify handleGoogleSearch Function

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

**Location:** Lines 1659-1718

#### 5.1 Add Helper Functions

```javascript
// Check if restaurant has existing Google search-related values
const hasExistingGoogleSearchValues = () => {
  if (!restaurant) return false;
  return !!(
    restaurant.address ||
    restaurant.phone ||
    restaurant.website_url ||
    restaurant.ubereats_url ||
    restaurant.doordash_url ||
    restaurant.instagram_url ||
    restaurant.facebook_url ||
    restaurant.meandyou_url ||
    restaurant.mobi2go_url ||
    restaurant.delivereasy_url ||
    restaurant.nextorder_url ||
    restaurant.foodhub_url ||
    restaurant.ordermeal_url ||
    (restaurant.opening_hours && restaurant.opening_hours.length > 0)
  );
};

// Set smart defaults for multi-source selection
// - Uncheck fields that already have values
// - Auto-select the "best" source (UberEats for hours, Website for phone)
const setGoogleSearchSmartDefaults = (extractedBySource, platformUrls) => {
  const sources = Object.keys(extractedBySource || {});

  // Helper to find first source that has a value for a field
  const findSourceWithValue = (field) => {
    for (const source of sources) {
      const data = extractedBySource[source];
      if (field === 'openingHours' && data?.openingHours?.length > 0) return source;
      if (data?.[field]) return source;
    }
    return null;
  };

  // Smart source selection:
  // - Address: prefer UberEats, fallback to website
  // - Phone: prefer website (UberEats rarely has phone)
  // - Hours: prefer UberEats (most accurate)
  const preferredSources = {
    address: ['ubereats', 'website', 'doordash'],
    phone: ['website', 'ubereats'],
    openingHours: ['ubereats', 'website']
  };

  const selectBestSource = (field) => {
    for (const preferredSource of preferredSources[field] || []) {
      const data = extractedBySource?.[preferredSource];
      if (field === 'openingHours' && data?.openingHours?.length > 0) return preferredSource;
      if (data?.[field]) return preferredSource;
    }
    return findSourceWithValue(field);
  };

  setGoogleSearchSelections({
    // Multi-source fields
    address: {
      save: !restaurant?.address && !!findSourceWithValue('address'),
      source: selectBestSource('address')
    },
    phone: {
      save: !restaurant?.phone && !!findSourceWithValue('phone'),
      source: selectBestSource('phone')
    },
    opening_hours: {
      save: !(restaurant?.opening_hours?.length > 0) && !!findSourceWithValue('openingHours'),
      source: selectBestSource('openingHours')
    },
    // Single-source fields (platform URLs)
    website_url: { save: !restaurant?.website_url && !!platformUrls?.websiteUrl },
    ubereats_url: { save: !restaurant?.ubereats_url && !!platformUrls?.ubereatsUrl },
    doordash_url: { save: !restaurant?.doordash_url && !!platformUrls?.doordashUrl },
    instagram_url: { save: !restaurant?.instagram_url && !!platformUrls?.instagramUrl },
    facebook_url: { save: !restaurant?.facebook_url && !!platformUrls?.facebookUrl },
    meandyou_url: { save: !restaurant?.meandyou_url && !!platformUrls?.meandyouUrl },
    mobi2go_url: { save: !restaurant?.mobi2go_url && !!platformUrls?.mobi2goUrl },
    delivereasy_url: { save: !restaurant?.delivereasy_url && !!platformUrls?.delivereasyUrl },
    nextorder_url: { save: !restaurant?.nextorder_url && !!platformUrls?.nextorderUrl },
    foodhub_url: { save: !restaurant?.foodhub_url && !!platformUrls?.foodhubUrl },
    ordermeal_url: { save: !restaurant?.ordermeal_url && !!platformUrls?.ordermealUrl }
  });
};
```

#### 5.2 Update handleGoogleSearch

```javascript
const handleGoogleSearch = async () => {
  if (!restaurant?.name) {
    setError('Restaurant name is required for search');
    return;
  }

  const city = restaurant?.city || (() => {
    if (restaurant?.address) {
      const cityMatch = restaurant.address.match(/([A-Za-z\s]+),?\s*(?:New Zealand)?$/);
      return cityMatch ? cityMatch[1].trim() : 'New Zealand';
    }
    return 'New Zealand';
  })();

  setSearchingGoogle(true);
  setError(null);
  setSuccess(null);

  try {
    // Step 1: Search in preview mode - get data from ALL sources
    const response = await api.post('/google-business-search', {
      restaurantName: restaurant.name,
      city: city,
      restaurantId: id,
      previewOnly: true  // Return multi-source data without saving
    });

    if (response.data.success) {
      const data = response.data.data;

      // Check if there are existing values OR multiple sources to choose from
      const hasMultipleSources = data.sourcesScraped?.length > 1;

      if (hasExistingGoogleSearchValues() || hasMultipleSources) {
        // Store data and show confirmation dialog with source selection
        setPendingGoogleSearchData(data);
        setGoogleSearchSmartDefaults(data.extractedBySource, data.platformUrls);
        setGoogleSearchConfirmDialogOpen(true);
      } else {
        // No existing values and single source - apply everything directly
        await applyGoogleSearchUpdates(data, true);
      }
    } else {
      setError(response.data.error || 'Failed to search for business information');
    }
  } catch (err) {
    console.error('Google search error:', err);
    setError(err.response?.data?.error || 'Failed to search for business information');
  } finally {
    setSearchingGoogle(false);
  }
};
```

#### 5.3 Add Apply and Confirm Functions

```javascript
// Apply Google search updates with multi-source selection
const applyGoogleSearchUpdates = async (data, selectAll = false) => {
  try {
    let selections;

    if (selectAll) {
      // Auto-select all available data using best sources
      const sources = Object.keys(data.extractedBySource || {});
      selections = {
        address: { save: true, source: sources[0] },
        phone: { save: true, source: sources.find(s => data.extractedBySource[s]?.phone) || sources[0] },
        opening_hours: { save: true, source: sources[0] },
        website_url: { save: !!data.platformUrls?.websiteUrl },
        ubereats_url: { save: !!data.platformUrls?.ubereatsUrl },
        doordash_url: { save: !!data.platformUrls?.doordashUrl },
        instagram_url: { save: !!data.platformUrls?.instagramUrl },
        facebook_url: { save: !!data.platformUrls?.facebookUrl },
        meandyou_url: { save: !!data.platformUrls?.meandyouUrl },
        mobi2go_url: { save: !!data.platformUrls?.mobi2goUrl },
        delivereasy_url: { save: !!data.platformUrls?.delivereasyUrl },
        nextorder_url: { save: !!data.platformUrls?.nextorderUrl },
        foodhub_url: { save: !!data.platformUrls?.foodhubUrl },
        ordermeal_url: { save: !!data.platformUrls?.ordermealUrl }
      };
    } else {
      selections = googleSearchSelections;
    }

    const response = await api.post('/google-business-search/save', {
      restaurantId: id,
      selections,
      extractedBySource: data.extractedBySource,
      platformUrls: data.platformUrls
    });

    if (response.data.success) {
      const fieldsUpdated = response.data.fieldsUpdated?.length || 0;
      setSuccess(`Business information updated - ${fieldsUpdated} fields`);
      setTimeout(() => fetchRestaurantDetails(), 1000);
    } else {
      setError(response.data.error || 'Failed to save business information');
    }
  } catch (err) {
    console.error('Google search save error:', err);
    setError(err.response?.data?.error || 'Failed to save business information');
  }
};

// Handle confirmation dialog submit
const handleConfirmGoogleSearchUpdate = async () => {
  if (!pendingGoogleSearchData) return;

  setGoogleSearchConfirmDialogOpen(false);
  setSearchingGoogle(true);

  try {
    await applyGoogleSearchUpdates(pendingGoogleSearchData, false);
  } finally {
    setSearchingGoogle(false);
    setPendingGoogleSearchData(null);
  }
};
```

---

### Phase 6: Create Multi-Source Confirmation Dialog

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

**Location:** After other dialogs (follow branding dialog pattern)

The key UI difference: **Multi-source fields use radio buttons** to select which source to use, while single-source fields use checkboxes.

```jsx
{/* Google Search Confirmation Dialog - Multi-Source Selection */}
<Dialog open={googleSearchConfirmDialogOpen} onOpenChange={setGoogleSearchConfirmDialogOpen}>
  <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Review Extracted Business Information</DialogTitle>
      <DialogDescription>
        Select which data to save. For fields with multiple sources, choose your preferred source.
      </DialogDescription>
    </DialogHeader>

    {pendingGoogleSearchData && (
      <div className="space-y-6">
        {/* Multi-Source Fields Section */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">Business Details (Multiple Sources Available)</h4>

          {/* Address - Multi-source */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={googleSearchSelections.address.save}
                onChange={(e) => setGoogleSearchSelections(prev => ({
                  ...prev,
                  address: { ...prev.address, save: e.target.checked }
                }))}
                disabled={!Object.values(pendingGoogleSearchData.extractedBySource || {}).some(s => s.address)}
              />
              <span className="font-medium">Address</span>
              {restaurant?.address && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  Current: {restaurant.address}
                </span>
              )}
            </div>

            {googleSearchSelections.address.save && (
              <div className="ml-6 space-y-1">
                {Object.entries(pendingGoogleSearchData.extractedBySource || {}).map(([source, data]) => (
                  data.address && (
                    <label key={source} className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-gray-50">
                      <input
                        type="radio"
                        name="address_source"
                        checked={googleSearchSelections.address.source === source}
                        onChange={() => setGoogleSearchSelections(prev => ({
                          ...prev,
                          address: { ...prev.address, source }
                        }))}
                      />
                      <span className="text-sm font-medium capitalize">{source}:</span>
                      <span className="text-sm text-gray-600 truncate">{data.address}</span>
                    </label>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Phone - Multi-source */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={googleSearchSelections.phone.save}
                onChange={(e) => setGoogleSearchSelections(prev => ({
                  ...prev,
                  phone: { ...prev.phone, save: e.target.checked }
                }))}
                disabled={!Object.values(pendingGoogleSearchData.extractedBySource || {}).some(s => s.phone)}
              />
              <span className="font-medium">Phone</span>
              {restaurant?.phone && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  Current: {restaurant.phone}
                </span>
              )}
            </div>

            {googleSearchSelections.phone.save && (
              <div className="ml-6 space-y-1">
                {Object.entries(pendingGoogleSearchData.extractedBySource || {}).map(([source, data]) => (
                  data.phone && (
                    <label key={source} className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-gray-50">
                      <input
                        type="radio"
                        name="phone_source"
                        checked={googleSearchSelections.phone.source === source}
                        onChange={() => setGoogleSearchSelections(prev => ({
                          ...prev,
                          phone: { ...prev.phone, source }
                        }))}
                      />
                      <span className="text-sm font-medium capitalize">{source}:</span>
                      <span className="text-sm text-gray-600">{data.phone}</span>
                    </label>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Opening Hours - Multi-source with preview */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={googleSearchSelections.opening_hours.save}
                onChange={(e) => setGoogleSearchSelections(prev => ({
                  ...prev,
                  opening_hours: { ...prev.opening_hours, save: e.target.checked }
                }))}
                disabled={!Object.values(pendingGoogleSearchData.extractedBySource || {}).some(s => s.openingHours?.length)}
              />
              <span className="font-medium">Opening Hours</span>
              {restaurant?.opening_hours?.length > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  Has existing hours
                </span>
              )}
            </div>

            {googleSearchSelections.opening_hours.save && (
              <div className="ml-6 space-y-2">
                {Object.entries(pendingGoogleSearchData.extractedBySource || {}).map(([source, data]) => (
                  data.openingHours?.length > 0 && (
                    <div key={source} className="border rounded p-2">
                      <label className="flex items-center space-x-2 mb-2">
                        <input
                          type="radio"
                          name="hours_source"
                          checked={googleSearchSelections.opening_hours.source === source}
                          onChange={() => setGoogleSearchSelections(prev => ({
                            ...prev,
                            opening_hours: { ...prev.opening_hours, source }
                          }))}
                        />
                        <span className="text-sm font-medium capitalize">{source}</span>
                        <span className="text-xs text-gray-500">({data.openingHours.length} days)</span>
                      </label>
                      {/* Preview first 3 days */}
                      <div className="ml-6 text-xs text-gray-500 space-y-0.5">
                        {data.openingHours.slice(0, 3).map((h, i) => (
                          <div key={i}>{h.day}: {h.hours?.open} - {h.hours?.close}</div>
                        ))}
                        {data.openingHours.length > 3 && (
                          <div className="text-gray-400">...and {data.openingHours.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Platform URLs Section (Single Source - Checkboxes) */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Platform URLs</h4>
            <div className="space-x-2">
              <Button variant="ghost" size="sm" onClick={() => {
                const urlKeys = ['website_url', 'ubereats_url', 'doordash_url', 'meandyou_url', 'mobi2go_url', 'delivereasy_url', 'nextorder_url', 'foodhub_url', 'ordermeal_url'];
                setGoogleSearchSelections(prev => {
                  const updated = { ...prev };
                  urlKeys.forEach(k => { updated[k] = { save: true }; });
                  return updated;
                });
              }}>Select All</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const urlKeys = ['website_url', 'ubereats_url', 'doordash_url', 'meandyou_url', 'mobi2go_url', 'delivereasy_url', 'nextorder_url', 'foodhub_url', 'ordermeal_url'];
                setGoogleSearchSelections(prev => {
                  const updated = { ...prev };
                  urlKeys.forEach(k => { updated[k] = { save: false }; });
                  return updated;
                });
              }}>Deselect All</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              { key: 'website_url', label: 'Website', dataKey: 'websiteUrl' },
              { key: 'ubereats_url', label: 'UberEats', dataKey: 'ubereatsUrl' },
              { key: 'doordash_url', label: 'DoorDash', dataKey: 'doordashUrl' },
              { key: 'meandyou_url', label: 'Me&U', dataKey: 'meandyouUrl' },
              { key: 'mobi2go_url', label: 'Mobi2go', dataKey: 'mobi2goUrl' },
              { key: 'delivereasy_url', label: 'Delivereasy', dataKey: 'delivereasyUrl' },
              { key: 'nextorder_url', label: 'NextOrder', dataKey: 'nextorderUrl' },
              { key: 'foodhub_url', label: 'FoodHub', dataKey: 'foodhubUrl' },
              { key: 'ordermeal_url', label: 'OrderMeal', dataKey: 'ordermealUrl' }
            ].map(({ key, label, dataKey }) => {
              const newUrl = pendingGoogleSearchData.platformUrls?.[dataKey];
              const currentUrl = restaurant?.[key];
              if (!newUrl && !currentUrl) return null; // Hide if neither exists

              return (
                <label key={key} className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={googleSearchSelections[key]?.save}
                      onChange={(e) => setGoogleSearchSelections(prev => ({
                        ...prev,
                        [key]: { save: e.target.checked }
                      }))}
                      disabled={!newUrl}
                    />
                    <span className={`text-sm font-medium ${!newUrl ? 'text-muted-foreground' : ''}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs max-w-[400px]">
                    {currentUrl && (
                      <span className="text-amber-600 truncate" title={currentUrl}>
                        Current: {new URL(currentUrl).hostname}
                      </span>
                    )}
                    {currentUrl && newUrl && <span className="text-gray-400">→</span>}
                    {newUrl ? (
                      <span className="text-blue-600 truncate" title={newUrl}>
                        {new URL(newUrl).hostname}
                      </span>
                    ) : (
                      <span className="text-gray-400">not found</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Social Media Section */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Social Media</h4>
            <div className="space-x-2">
              <Button variant="ghost" size="sm" onClick={() => {
                setGoogleSearchSelections(prev => ({
                  ...prev,
                  instagram_url: { save: true },
                  facebook_url: { save: true }
                }));
              }}>Select All</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setGoogleSearchSelections(prev => ({
                  ...prev,
                  instagram_url: { save: false },
                  facebook_url: { save: false }
                }));
              }}>Deselect All</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              { key: 'instagram_url', label: 'Instagram', dataKey: 'instagramUrl' },
              { key: 'facebook_url', label: 'Facebook', dataKey: 'facebookUrl' }
            ].map(({ key, label, dataKey }) => {
              const newUrl = pendingGoogleSearchData.platformUrls?.[dataKey];
              const currentUrl = restaurant?.[key];

              return (
                <label key={key} className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={googleSearchSelections[key]?.save}
                      onChange={(e) => setGoogleSearchSelections(prev => ({
                        ...prev,
                        [key]: { save: e.target.checked }
                      }))}
                      disabled={!newUrl}
                    />
                    <span className={`text-sm font-medium ${!newUrl ? 'text-muted-foreground' : ''}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs max-w-[350px]">
                    {currentUrl && (
                      <span className="text-amber-600 truncate" title={currentUrl}>
                        Current: {currentUrl.split('/').pop() || currentUrl}
                      </span>
                    )}
                    {currentUrl && newUrl && <span className="text-gray-400">→</span>}
                    {newUrl ? (
                      <span className="text-blue-600 truncate" title={newUrl}>
                        {newUrl.split('/').filter(Boolean).pop()}
                      </span>
                    ) : (
                      <span className="text-gray-400">not found</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Extraction Notes */}
        {pendingGoogleSearchData.extractionNotes?.length > 0 && (
          <div className="border-t pt-4 bg-gray-50 rounded p-3">
            <p className="text-sm font-medium mb-1">Extraction Notes:</p>
            <ul className="text-xs text-muted-foreground list-disc ml-4">
              {pendingGoogleSearchData.extractionNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources summary */}
        <div className="text-xs text-muted-foreground">
          Data extracted from: {pendingGoogleSearchData.sourcesScraped?.join(', ') || 'unknown sources'}
        </div>
      </div>
    )}

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => {
          setGoogleSearchConfirmDialogOpen(false);
          setPendingGoogleSearchData(null);
        }}
      >
        Cancel
      </Button>
      <Button
        onClick={handleConfirmGoogleSearchUpdate}
        disabled={searchingGoogle}
      >
        {searchingGoogle ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Applying...
          </>
        ) : (
          'Apply Selected Updates'
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Implementation Order

1. **Phase 1:** Import and apply better URL validation (quick win, improves data quality immediately)
2. **Phase 2:** Restructure backend to collect data from ALL sources (not "first found wins")
3. **Phase 3:** Create /save endpoint with per-field source selection
4. **Phase 4:** Add frontend state variables for multi-source selection
5. **Phase 5:** Update handleGoogleSearch with two-step flow and smart source defaults
6. **Phase 6:** Create multi-source confirmation dialog with radio buttons for source selection
7. **Test:** End-to-end testing with restaurants that have existing data and multiple sources

---

## Files to Modify

| File | Changes |
|------|---------|
| `server.js` (line ~5157) | Import lead-url-validation-service |
| `server.js` (line ~5346) | Apply URL validation after categorization |
| `server.js` (line ~5500) | Restructure extraction loop to collect all sources |
| `server.js` (after endpoint) | Create `/google-business-search/save` endpoint |
| `RestaurantDetail.jsx` (line ~104) | Add multi-source selection state |
| `RestaurantDetail.jsx` (line ~1659) | Modify handleGoogleSearch for preview mode |
| `RestaurantDetail.jsx` (dialogs) | Add multi-source confirmation dialog |

---

## Testing Checklist

### URL Validation
- [ ] Instagram URLs - rejects reels/posts/stories, accepts profiles
- [ ] Facebook URLs - rejects videos/events/groups, accepts pages
- [ ] Website URLs - filters out delivery platform hostnames

### Multi-Source Data Collection
- [ ] UberEats data extracted when available
- [ ] Website data extracted when available
- [ ] DoorDash data extracted when available
- [ ] All sources returned in `extractedBySource` object

### Preview Mode
- [ ] `previewOnly: true` returns data without database update
- [ ] Response includes `platformUrls` and `extractedBySource`
- [ ] Response includes `sourcesScraped` array

### Confirmation Dialog
- [ ] Shows when existing values present
- [ ] Shows when multiple sources available (even if no existing values)
- [ ] Skipped when single source and no existing values
- [ ] Multi-source fields show radio buttons for source selection
- [ ] Single-source fields show checkboxes
- [ ] Smart defaults select best source per field
- [ ] Smart defaults uncheck fields that have existing values
- [ ] Opening hours preview shows first 3 days per source
- [ ] Current values shown with amber highlight

### Source Selection
- [ ] Can select different source for address vs phone vs hours
- [ ] Radio buttons switch source correctly
- [ ] Unchecking field hides source options
- [ ] Platform URLs use simple checkboxes (single source)

### Save Endpoint
- [ ] Accepts `selections` object with `{ save, source }` per field
- [ ] Looks up value from correct source in `extractedBySource`
- [ ] Only saves fields where `save: true`
- [ ] Returns list of fields updated

### UX
- [ ] Select All / Deselect All work per section
- [ ] Cancel closes dialog without saving
- [ ] Success message shows count of fields updated
- [ ] Loading state during save operation
