# UberEats Header Image (OG Image) Extraction - Implementation Status

**Date:** 2025-12-26
**Status:** IMPLEMENTED - Working with known limitations

## Summary

We implemented high-resolution header image extraction from UberEats store pages by parsing the `ogImage` field from Firecrawl's response metadata, rather than relying on LLM-based JSON extraction which consistently returned low-resolution thumbnails.

**Key Discovery:** The Firecrawl metadata contains the correct high-resolution og:image URL. The LLM extraction returns low-res thumbnails from the `src` attribute, but metadata parsing returns the high-res version.

**Current Limitation:** Results are somewhat inconsistent - some stores return high-res images, others return lower resolution. This may be due to Firecrawl caching or variations in how UberEats serves images. Adding `maxAge: 0` to disable caching improved consistency but did not fully resolve the issue.

---

## Implementation Complete

### 1. Database Migration (COMPLETED)
- Added `ubereats_og_image` TEXT column to `leads` table
- Migration applied successfully

### 2. Server.js - Platform Details Extraction (COMPLETED)

**Location:** `/api/platform-details-extraction` endpoint

**Changes:**
- **Platform Capabilities:** UberEats includes `og_image`:
  ```javascript
  'ubereats': ['address', 'hours', 'og_image']
  ```
- **Metadata Extraction:** Extract og:image from response metadata instead of LLM extraction:
  ```javascript
  if (extractFields.includes('og_image') && platform === 'ubereats') {
    const ogImageUrl = metadata.ogImage || metadata['og:image'];
    if (ogImageUrl && ogImageUrl !== 'null' && ogImageUrl !== '') {
      extractedData.og_image = ogImageUrl;
    }
  }
  ```
- **Validation:** Added `og_image` to `hasValidData` check
- **Address Cleaning:** Removes trailing ", {region} {postcode}" patterns
- **Base64 Conversion:** Downloads and converts og:image URL to base64
- **Database Save:** Saves to `ubereats_og_image` field

**Debug Logging (to be removed):**
- Full Firecrawl response data logging
- Metadata ogImage logging

### 3. Lead Scraping Service (COMPLETED)

**Location:** `lead-scrape-firecrawl-service.js`

**Changes to `firecrawlRequest` function:**
- Added `includeMetadata` option to return `{ json, metadata }` instead of just json:
  ```javascript
  const {
    // ... other options
    includeMetadata = false
  } = options;

  // In return statement:
  if (includeMetadata) {
    return {
      json: jsonData,
      metadata: response.data.data?.metadata || {}
    };
  }
  return jsonData;
  ```
- Added `maxAge: 0` to disable Firecrawl caching for fresher metadata

**Changes to `processStep2` function:**
- Uses `includeMetadata: true` option
- Extracts og:image from metadata:
  ```javascript
  const response = await firecrawlRequest(
    lead.store_link,
    STEP_2_PROMPT,
    STEP_2_SCHEMA,
    { timeout: 120000, waitFor: 5000, includeMetadata: true },
    { organisationId, jobId, stepNumber: 2, leadId: lead.id }
  );

  const result = response.json;
  const metadata = response.metadata;

  const ogImageUrl = metadata.ogImage || metadata['og:image'];
  if (ogImageUrl) {
    const ogImageBuffer = await downloadImageToBuffer(ogImageUrl, lead.store_link);
    ogImageBase64 = `data:image/jpeg;base64,${ogImageBuffer.toString('base64')}`;
  }
  ```

**Other retained changes:**
- Import `downloadImageToBuffer` from `./logo-extraction-service`
- `cleanAddress()` function for address cleaning
- `ubereats_og_image: ogImageBase64` in leads record update

### 4. Lead Scrape Service - convertLeadsToRestaurants (COMPLETED)

**Location:** `lead-scrape-service.js`

- Added `ubereats_og_image: lead.ubereats_og_image` to restaurant insert

### 5. RestaurantDetail.jsx (COMPLETED)

- Updated `PLATFORM_CAPABILITIES.ubereats` to include `og_image`
- Updated field labels: `og_image: 'OG Image'`
- Updated `startDetailsExtraction` success message to include OG image
- Updated Business Details Extraction Dialog description for UberEats

---

## Technical Details

### Why LLM Extraction Failed

The UberEats page structure has:
```html
<img srcset="url1 550w,url2 2880w" src="url1">
```

Issues encountered:
1. Firecrawl's LLM defaults to the `src` attribute (550w thumbnail)
2. LLM cannot reliably parse srcset attribute
3. Various prompt engineering attempts failed (renamed schema fields, specific srcset instructions)
4. HTML format + manual parsing didn't help due to lazy loading

### The Solution

Firecrawl's metadata extraction parses meta tags correctly:
```json
{
  "metadata": {
    "ogImage": "https://...high-res.jpeg",
    "og:image": "https://...high-res.jpeg"
  }
}
```

We bypass LLM extraction entirely and read directly from metadata.

---

## Known Issues

1. **Inconsistent Resolution:** Some stores still return lower resolution images. This appears to be related to:
   - Firecrawl caching (mitigated with `maxAge: 0`)
   - Variations in how UberEats serves og:image for different stores
   - Possible CDN caching on UberEats side

2. **Debug Logging:** Full response logging still in server.js - should be removed or reduced for production

---

## Files Modified

| File | Changes |
|------|---------|
| `server.js` | Platform details extraction with metadata parsing, address cleaning, og_image validation |
| `lead-scrape-firecrawl-service.js` | `firecrawlRequest` with `includeMetadata` option, `processStep2` metadata extraction, `maxAge: 0` |
| `lead-scrape-service.js` | `convertLeadsToRestaurants` includes `ubereats_og_image` |
| `RestaurantDetail.jsx` | UI updates for og_image extraction option |

---

## Reference Files

- **Raw JSON Example:** `planning/database-plans/extraction-plans/ubereats-header-extraction/raw-json-example.json`
  - Shows Firecrawl response structure with metadata containing high-res ogImage

---

## Future Improvements

1. Remove or reduce debug logging in server.js
2. Investigate why some stores return lower resolution images
3. Consider fallback strategies if metadata doesn't contain high-res URL
4. Add image dimension validation to verify high-res was obtained
5. Add og image preview to step 2 lead scrape detail modal onwards