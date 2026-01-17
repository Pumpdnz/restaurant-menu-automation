# Firecrawl Branding Format Implementation Roadmap

**Date:** December 4, 2025
**Status:** Ready for Implementation
**Related:** [Investigation Summary](./investigations/firecrawl-branding-format-investigation.md)

---

## Overview

This roadmap outlines the implementation steps to integrate Firecrawl's new branding format into the restaurant branding extraction system. The implementation maintains backward compatibility through feature flagging while adding new capabilities.

---

## Phase 1: Database Schema Updates

### Migration: Add New Columns to Restaurants Table

**File:** Create new migration via Supabase MCP

```sql
-- Migration: add_branding_og_columns
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS website_og_image TEXT,
ADD COLUMN IF NOT EXISTS website_og_description TEXT,
ADD COLUMN IF NOT EXISTS website_og_title TEXT,
ADD COLUMN IF NOT EXISTS ubereats_og_image TEXT,
ADD COLUMN IF NOT EXISTS doordash_og_image TEXT,
ADD COLUMN IF NOT EXISTS facebook_cover_image TEXT;

COMMENT ON COLUMN restaurants.website_og_image IS 'Open Graph image URL from restaurant website';
COMMENT ON COLUMN restaurants.website_og_description IS 'Open Graph description from restaurant website';
COMMENT ON COLUMN restaurants.website_og_title IS 'Open Graph title from restaurant website';
COMMENT ON COLUMN restaurants.ubereats_og_image IS 'Open Graph image from UberEats listing (future use)';
COMMENT ON COLUMN restaurants.doordash_og_image IS 'Open Graph image from DoorDash listing (future use)';
COMMENT ON COLUMN restaurants.facebook_cover_image IS 'Cover image from Facebook page (future use)';
```

### Validation

- [ ] Verify columns added successfully
- [ ] Test nullable behavior
- [ ] Update TypeScript types if applicable

---

## Phase 2: Environment Configuration

### Add Feature Flag

**File:** `UberEats-Image-Extractor/.env`

```bash
# Firecrawl Branding Format Feature Flag
# Set to TRUE to use new branding format, FALSE for legacy logo extraction
USE_FIRECRAWL_BRANDING_FORMAT=TRUE
```

### Config Endpoint (Optional)

Add endpoint to expose config to frontend:

**File:** `UberEats-Image-Extractor/server.js`

```javascript
app.get('/api/config/features', (req, res) => {
  res.json({
    useFirecrawlBrandingFormat: process.env.USE_FIRECRAWL_BRANDING_FORMAT?.toLowerCase() === 'true'
  });
});
```

---

## Phase 3: Backend Service Updates

### 3.1 Create New Branding Extraction Function

**File:** `UberEats-Image-Extractor/src/services/logo-extraction-service.js`

Add new function after existing `extractLogoCandidatesWithFirecrawl`:

```javascript
/**
 * Extract branding information using Firecrawl's branding format
 * @param {string} sourceUrl - The URL to extract branding from
 * @returns {Object} Branding data including logo, colors, and metadata
 */
async function extractBrandingWithFirecrawl(sourceUrl) {
  try {
    console.log('[Branding Extraction] Starting extraction from:', sourceUrl);

    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      {
        url: sourceUrl,
        formats: ['branding'],
        waitFor: 3000
      },
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data?.data?.branding) {
      console.log('[Branding Extraction] No branding data returned');
      return null;
    }

    const branding = response.data.data.branding;
    const metadata = response.data.data.metadata || {};

    // Map Firecrawl colors to our schema
    const colors = {
      primaryColor: branding.colors?.primary || null,
      secondaryColor: branding.colors?.accent || null,
      tertiaryColor: branding.colors?.textPrimary || null,
      accentColor: branding.components?.buttonSecondary?.background || null,
      backgroundColor: branding.colors?.background || null,
      theme: branding.colorScheme || 'light'
    };

    // Extract images
    const images = {
      logoUrl: branding.images?.logo || null,
      faviconUrl: branding.images?.favicon || null,
      ogImageUrl: branding.images?.ogImage || metadata['og:image'] || metadata.ogImage || null
    };

    // Extract metadata
    const extractedMetadata = {
      ogTitle: metadata['og:title'] || metadata.ogTitle || metadata.title || null,
      ogDescription: metadata['og:description'] || metadata.ogDescription || metadata.description || null,
      ogSiteName: metadata['og:site_name'] || metadata.ogSiteName || null
    };

    // Get LLM reasoning for confidence
    const confidence = branding.__llm_logo_reasoning?.confidence || 0;

    console.log('[Branding Extraction] Extracted successfully:', {
      hasLogo: !!images.logoUrl,
      hasFavicon: !!images.faviconUrl,
      hasOgImage: !!images.ogImageUrl,
      theme: colors.theme,
      confidence
    });

    return {
      success: true,
      colors,
      images,
      metadata: extractedMetadata,
      confidence,
      rawBranding: branding,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[Branding Extraction] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 3.2 Modify Logo Processing for Favicon Skip

**File:** `UberEats-Image-Extractor/src/services/logo-extraction-service.js`

Update `processLogoVersions` function signature:

```javascript
/**
 * Process logo into different versions
 * @param {Buffer} logoBuffer - The logo image buffer
 * @param {Object} options - Processing options
 * @param {boolean} options.skipFavicon - Skip favicon generation if already have one
 */
async function processLogoVersions(logoBuffer, options = {}) {
  const versions = {};
  const { skipFavicon = false } = options;

  // ... existing processing code ...

  // 5. Favicon (32x32) - only if not skipping
  if (!skipFavicon) {
    const faviconBuffer = await sharp(logoBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();
    versions.favicon = `data:image/png;base64,${faviconBuffer.toString('base64')}`;
  }

  return versions;
}
```

### 3.3 Export New Function

**File:** `UberEats-Image-Extractor/src/services/logo-extraction-service.js`

Update exports:

```javascript
module.exports = {
  extractLogoAndColors,
  extractLogoCandidatesWithFirecrawl,
  extractBrandingWithFirecrawl,  // NEW
  extractLogoUrlWithFirecrawl,
  extractLogoUrlWithPuppeteer,
  downloadImageToBuffer,
  extractColorsFromLogo,
  processLogoVersions
};
```

---

## Phase 4: API Endpoint Implementation

### 4.1 Add New Branding Endpoint

**File:** `UberEats-Image-Extractor/server.js`

Add after existing logo extraction endpoints (around line 7029):

```javascript
/**
 * POST /api/website-extraction/branding
 * Extract full branding using Firecrawl's branding format
 */
app.post('/api/website-extraction/branding', async (req, res) => {
  try {
    const { restaurantId, sourceUrl } = req.body;

    if (!restaurantId || !sourceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID and source URL are required'
      });
    }

    console.log('[API] Starting branding extraction for:', sourceUrl);

    const logoService = require('./src/services/logo-extraction-service');

    // Step 1: Extract branding from Firecrawl
    const brandingResult = await logoService.extractBrandingWithFirecrawl(sourceUrl);

    if (!brandingResult?.success) {
      return res.status(400).json({
        success: false,
        error: brandingResult?.error || 'Failed to extract branding'
      });
    }

    // Step 2: Download and process logo if found
    let logoVersions = {};
    if (brandingResult.images?.logoUrl) {
      try {
        const logoBuffer = await logoService.downloadImageToBuffer(
          brandingResult.images.logoUrl,
          sourceUrl
        );

        // Process logo, skip favicon if Firecrawl provided one
        const skipFavicon = !!brandingResult.images?.faviconUrl;
        logoVersions = await logoService.processLogoVersions(logoBuffer, { skipFavicon });

        console.log('[API] Logo processed into', Object.keys(logoVersions).length, 'versions');
      } catch (logoError) {
        console.error('[API] Failed to process logo:', logoError.message);
        // Continue without logo - colors and metadata still valuable
      }
    }

    // Step 3: Prepare database update
    if (db.isDatabaseAvailable()) {
      const updateData = {
        // Colors from Firecrawl (use these instead of Vibrant.js extraction)
        primary_color: brandingResult.colors?.primaryColor,
        secondary_color: brandingResult.colors?.secondaryColor,
        tertiary_color: brandingResult.colors?.tertiaryColor,
        accent_color: brandingResult.colors?.accentColor,
        background_color: brandingResult.colors?.backgroundColor,
        theme: brandingResult.colors?.theme,

        // Logo versions
        logo_url: logoVersions?.original,
        logo_nobg_url: logoVersions?.nobg,
        logo_standard_url: logoVersions?.standard,
        logo_thermal_url: logoVersions?.thermal,
        logo_thermal_alt_url: logoVersions?.thermal_alt,
        logo_thermal_contrast_url: logoVersions?.thermal_contrast,
        logo_thermal_adaptive_url: logoVersions?.thermal_adaptive,

        // Favicon: prefer Firecrawl's, fallback to processed
        logo_favicon_url: brandingResult.images?.faviconUrl || logoVersions?.favicon,

        // New OG fields
        website_og_image: brandingResult.images?.ogImageUrl,
        website_og_title: brandingResult.metadata?.ogTitle,
        website_og_description: brandingResult.metadata?.ogDescription
      };

      // Remove null/undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log('[API] Updated restaurant with branding data');
    }

    return res.json({
      success: true,
      data: {
        logoVersions,
        colors: brandingResult.colors,
        metadata: brandingResult.metadata,
        images: {
          logo: brandingResult.images?.logoUrl,
          favicon: brandingResult.images?.faviconUrl,
          ogImage: brandingResult.images?.ogImageUrl
        },
        confidence: brandingResult.confidence,
        extractedAt: brandingResult.extractedAt
      }
    });

  } catch (error) {
    console.error('[API] Branding extraction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract branding'
    });
  }
});
```

---

## Phase 5: Frontend Implementation

### 5.1 Add State Variables

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

Add new state variables near other branding-related state:

```javascript
// Branding extraction state
const [extractingBranding, setExtractingBranding] = useState(false);
const [brandingSourceUrl, setBrandingSourceUrl] = useState('');
const [useFirecrawlBranding, setUseFirecrawlBranding] = useState(false);

// Fetch feature flag on mount
useEffect(() => {
  const fetchConfig = async () => {
    try {
      const response = await api.get('/config/features');
      setUseFirecrawlBranding(response.data.useFirecrawlBrandingFormat || false);
    } catch (err) {
      console.log('Feature config not available, using defaults');
    }
  };
  fetchConfig();
}, []);

// Set default branding source URL when restaurant loads
useEffect(() => {
  if (restaurant?.website_url) {
    setBrandingSourceUrl(restaurant.website_url);
  }
}, [restaurant?.website_url]);
```

### 5.2 Add URL Source Options Builder

```javascript
// Get available URLs for branding extraction (exclude blocked platforms)
const getAvailableBrandingUrls = () => {
  const urls = [];
  if (restaurant?.website_url) urls.push({ label: 'Website', value: restaurant.website_url });
  if (restaurant?.ubereats_url) urls.push({ label: 'UberEats', value: restaurant.ubereats_url });
  if (restaurant?.doordash_url) urls.push({ label: 'DoorDash', value: restaurant.doordash_url });
  if (restaurant?.ordermeal_url) urls.push({ label: 'OrderMeal', value: restaurant.ordermeal_url });
  if (restaurant?.meandyou_url) urls.push({ label: 'Me&U', value: restaurant.meandyou_url });
  if (restaurant?.mobi2go_url) urls.push({ label: 'Mobi2go', value: restaurant.mobi2go_url });
  if (restaurant?.delivereasy_url) urls.push({ label: 'Delivereasy', value: restaurant.delivereasy_url });
  if (restaurant?.nextorder_url) urls.push({ label: 'NextOrder', value: restaurant.nextorder_url });
  if (restaurant?.foodhub_url) urls.push({ label: 'Foodhub', value: restaurant.foodhub_url });
  // Note: Instagram and Facebook excluded - blocked by Firecrawl
  return urls;
};
```

### 5.3 Add Branding Extraction Handler

```javascript
const handleExtractBranding = async () => {
  if (!brandingSourceUrl) {
    setError('Please select or enter a URL for branding extraction');
    return;
  }

  setExtractingBranding(true);
  setError(null);

  try {
    const response = await api.post('/website-extraction/branding', {
      restaurantId: id,
      sourceUrl: brandingSourceUrl
    });

    if (response.data.success) {
      const data = response.data.data;

      // Update local state
      const updates = {};

      // Logo versions
      if (data.logoVersions?.original) updates.logo_url = data.logoVersions.original;
      if (data.logoVersions?.nobg) updates.logo_nobg_url = data.logoVersions.nobg;
      if (data.logoVersions?.standard) updates.logo_standard_url = data.logoVersions.standard;
      if (data.logoVersions?.thermal) updates.logo_thermal_url = data.logoVersions.thermal;
      if (data.logoVersions?.thermal_alt) updates.logo_thermal_alt_url = data.logoVersions.thermal_alt;
      if (data.logoVersions?.thermal_contrast) updates.logo_thermal_contrast_url = data.logoVersions.thermal_contrast;
      if (data.logoVersions?.thermal_adaptive) updates.logo_thermal_adaptive_url = data.logoVersions.thermal_adaptive;
      if (data.images?.favicon || data.logoVersions?.favicon) {
        updates.logo_favicon_url = data.images?.favicon || data.logoVersions?.favicon;
      }

      // Colors
      if (data.colors?.primaryColor) updates.primary_color = data.colors.primaryColor;
      if (data.colors?.secondaryColor) updates.secondary_color = data.colors.secondaryColor;
      if (data.colors?.tertiaryColor) updates.tertiary_color = data.colors.tertiaryColor;
      if (data.colors?.accentColor) updates.accent_color = data.colors.accentColor;
      if (data.colors?.backgroundColor) updates.background_color = data.colors.backgroundColor;
      if (data.colors?.theme) updates.theme = data.colors.theme;

      // New OG fields
      if (data.images?.ogImage) updates.website_og_image = data.images.ogImage;
      if (data.metadata?.ogTitle) updates.website_og_title = data.metadata.ogTitle;
      if (data.metadata?.ogDescription) updates.website_og_description = data.metadata.ogDescription;

      setRestaurant(prev => ({ ...prev, ...updates }));
      setEditedData(prev => ({ ...prev, ...updates }));

      setSuccess(`Branding extracted successfully (${Math.round(data.confidence * 100)}% confidence)`);

      // Refresh data
      setTimeout(() => fetchRestaurantDetails(), 1000);
    } else {
      setError(response.data.error || 'Failed to extract branding');
    }
  } catch (err) {
    console.error('Branding extraction error:', err);
    setError(err.response?.data?.error || 'Failed to extract branding');
  } finally {
    setExtractingBranding(false);
  }
};
```

### 5.4 Update Logo Management Actions UI

Replace the current Logo Management Actions section (around line 3471-3508):

```jsx
{/* Logo Management Actions */}
<div className="flex items-center justify-between mb-4">
  <Label className="text-base font-semibold">Logo Management</Label>
  {!isNewRestaurant && (
    <div className="flex gap-2 items-center">
      {/* Branding Extraction - New Method (feature flagged) */}
      {useFirecrawlBranding && (
        <>
          <div className="flex gap-2 items-center">
            <Select
              value={brandingSourceUrl}
              onValueChange={setBrandingSourceUrl}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select source URL" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableBrandingUrls().map((url) => (
                  <SelectItem key={url.value} value={url.value}>
                    {url.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={brandingSourceUrl}
              onChange={(e) => setBrandingSourceUrl(e.target.value)}
              placeholder="Or enter custom URL..."
              className="w-[250px]"
            />
          </div>
          <Button
            onClick={handleExtractBranding}
            variant="default"
            size="sm"
            disabled={extractingBranding || !brandingSourceUrl}
            title="Extract branding from selected URL"
          >
            {extractingBranding ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Palette className="h-3 w-3 mr-1" />
                Extract Branding
              </>
            )}
          </Button>
        </>
      )}

      {/* Legacy Extract Logo Button (when feature flag is off) */}
      {!useFirecrawlBranding && restaurant?.website_url && (
        <Button
          onClick={handleExtractLogo}
          variant="outline"
          size="sm"
          disabled={extractingLogo}
          title="Extract logo from website"
        >
          {extractingLogo ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Palette className="h-3 w-3 mr-1" />
              Extract Logo
            </>
          )}
        </Button>
      )}

      <Button
        onClick={() => setProcessLogoDialogOpen(true)}
        variant="outline"
        size="sm"
        title="Process logo manually or reprocess existing"
      >
        <Settings className="h-3 w-3 mr-1" />
        Process Logo
      </Button>
    </div>
  )}
</div>
```

### 5.5 Add Header Images Section

Add after the Thermal Logos Grid (after line 3691):

```jsx
{/* Header Images Grid - OG Images */}
{(restaurant?.website_og_image || restaurant?.ubereats_og_image ||
  restaurant?.doordash_og_image || restaurant?.facebook_cover_image) && (
  <div className="mt-6 pt-6 border-t">
    <Label className="text-base font-semibold mb-4 block">Header Images</Label>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {restaurant?.website_og_image && (
        <div>
          <Label className="text-sm text-muted-foreground">Website OG Image</Label>
          <div className="mt-2">
            <img
              src={restaurant.website_og_image}
              alt="Website OG Image"
              className="w-full h-32 object-cover rounded border"
            />
          </div>
        </div>
      )}
      {restaurant?.ubereats_og_image && (
        <div>
          <Label className="text-sm text-muted-foreground">UberEats Image</Label>
          <div className="mt-2">
            <img
              src={restaurant.ubereats_og_image}
              alt="UberEats Image"
              className="w-full h-32 object-cover rounded border"
            />
          </div>
        </div>
      )}
      {restaurant?.doordash_og_image && (
        <div>
          <Label className="text-sm text-muted-foreground">DoorDash Image</Label>
          <div className="mt-2">
            <img
              src={restaurant.doordash_og_image}
              alt="DoorDash Image"
              className="w-full h-32 object-cover rounded border"
            />
          </div>
        </div>
      )}
      {restaurant?.facebook_cover_image && (
        <div>
          <Label className="text-sm text-muted-foreground">Facebook Cover</Label>
          <div className="mt-2">
            <img
              src={restaurant.facebook_cover_image}
              alt="Facebook Cover"
              className="w-full h-32 object-cover rounded border"
            />
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

### 5.6 Add Header Tags Section

Add after Header Images section:

```jsx
{/* Header Tags - Title and Description */}
{(restaurant?.website_og_title || restaurant?.website_og_description) && (
  <div className="mt-6 pt-6 border-t">
    <Label className="text-base font-semibold mb-4 block">Header Tags</Label>
    <div className="space-y-4">
      {restaurant?.website_og_title && (
        <div>
          <Label className="text-sm text-muted-foreground">OG Title</Label>
          <p className="mt-1 text-sm font-medium">{restaurant.website_og_title}</p>
        </div>
      )}
      {restaurant?.website_og_description && (
        <div>
          <Label className="text-sm text-muted-foreground">OG Description</Label>
          <p className="mt-1 text-sm text-muted-foreground">{restaurant.website_og_description}</p>
        </div>
      )}
    </div>
  </div>
)}
```

---

## Phase 6: Testing Checklist

### Unit Tests
- [ ] `extractBrandingWithFirecrawl` returns correct structure
- [ ] Color mapping matches expected schema
- [ ] `processLogoVersions` respects `skipFavicon` option
- [ ] Null handling for missing branding fields

### Integration Tests
- [ ] API endpoint returns 200 with valid data
- [ ] Database updates correctly
- [ ] Feature flag toggles behavior correctly
- [ ] Legacy extraction still works when flag is off

### E2E Tests
- [ ] Extract branding from test restaurant website
- [ ] Verify all logo versions generated
- [ ] Verify colors populated correctly
- [ ] Verify OG images and metadata saved
- [ ] UI displays all new sections

### Test Websites
| Website | Expected Outcome |
|---------|------------------|
| https://www.empirechicken.nz | Full branding with logo, colors |
| A Wix site | Framework hints detected |
| A simple restaurant site | Basic colors and logo |
| A site without logo | Fallback behavior |

---

## Phase 7: Deployment

### Environment Setup
1. Add `USE_FIRECRAWL_BRANDING_FORMAT=TRUE` to production .env
2. Run database migration for new columns
3. Deploy backend changes
4. Deploy frontend changes

### Rollback Plan
1. Set `USE_FIRECRAWL_BRANDING_FORMAT=FALSE`
2. Legacy extraction will resume
3. No data migration needed

---

## Summary

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 1. Database Schema | Low | None |
| 2. Environment Config | Low | None |
| 3. Backend Service | Medium | Phase 1 |
| 4. API Endpoint | Medium | Phase 3 |
| 5. Frontend UI | Medium | Phase 2, 4 |
| 6. Testing | Medium | Phase 1-5 |
| 7. Deployment | Low | Phase 1-6 |

### Files to Modify

| File | Changes |
|------|---------|
| `logo-extraction-service.js` | Add `extractBrandingWithFirecrawl`, update `processLogoVersions` |
| `server.js` | Add `/api/website-extraction/branding`, add `/api/config/features` |
| `RestaurantDetail.jsx` | New state, handlers, UI sections |
| `.env` | Add `USE_FIRECRAWL_BRANDING_FORMAT` |
| Database | Add 6 new columns |
