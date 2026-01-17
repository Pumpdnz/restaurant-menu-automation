# Auto-Convert Image URLs to Base64 on Save - Implementation Plan

**Date:** December 13, 2025
**Status:** Planning
**Prerequisites:** Header and Items Settings Implementation (completed December 13, 2025)

---

## Overview

This feature adds automatic detection and conversion of HTTP/HTTPS image URLs to base64 when users save restaurant data from the RestaurantDetail page in edit mode. This allows users to manually paste image URLs for cover images (UberEats, DoorDash, Facebook, Website OG) and have them automatically converted for use in scripts.

---

## Problem Statement

Currently, to get cover images for header backgrounds, users must:
1. Run a Firecrawl branding extraction (which may not always find the right images)
2. Or manually download images and convert to base64

This feature will allow users to:
1. Paste any image URL directly into the edit form
2. Have the URL automatically converted to base64 on save
3. Immediately have the image available for header background selection

---

## Target Image Fields

These fields should support automatic URL-to-base64 conversion:

| Field | Purpose | Currently Stores |
|-------|---------|------------------|
| `website_og_image` | Website OG/header image | URL or base64 |
| `ubereats_og_image` | UberEats cover image | URL or base64 |
| `doordash_og_image` | DoorDash cover image | URL or base64 |
| `facebook_cover_image` | Facebook cover photo | URL or base64 |

**Note:** Logo fields (`logo_url`, `logo_nobg_url`, etc.) already have special handling and should NOT be included in this auto-conversion since they go through the branding extraction pipeline.

---

## Implementation Options

### Option A: Frontend Conversion (Before Save)

**Approach:** Convert URLs to base64 in the browser before sending to the API

**Pros:**
- No backend changes needed
- Immediate visual feedback in preview
- Can show conversion progress/errors in UI

**Cons:**
- May have CORS issues with some image URLs
- Larger payload sent to server
- Browser memory constraints for large images
- User has to wait for conversion before save completes

### Option B: Backend Conversion (During Save) ✅ RECOMMENDED

**Approach:** Detect HTTP URLs in the PATCH endpoint and convert server-side

**Pros:**
- No CORS issues (server can fetch any URL)
- Cleaner frontend code
- Can use existing `logoService.downloadImageToBuffer()` pattern
- Consistent with existing branding extraction flow
- Can add size limits and validation server-side

**Cons:**
- Save operation takes longer
- Need to handle conversion failures gracefully

### Option C: Hybrid (Frontend Detection + Backend API)

**Approach:** Frontend detects URLs, calls dedicated conversion API, then saves

**Pros:**
- Clear separation of concerns
- Can show conversion progress
- Reusable conversion endpoint

**Cons:**
- More complex implementation
- Two network requests

---

## Recommended Implementation: Option B (Backend Conversion)

### Phase 1: Update PATCH /api/restaurants/:id/workflow Endpoint

**File:** `UberEats-Image-Extractor/server.js`
**Location:** Around line ~5018

#### 1.1 Add Image URL Detection and Conversion

```javascript
app.patch('/api/restaurants/:id/workflow', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let workflowData = { ...req.body };

    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    // Fields that should have URLs auto-converted to base64
    const imageUrlFields = [
      'website_og_image',
      'ubereats_og_image',
      'doordash_og_image',
      'facebook_cover_image'
    ];

    // Process each image field
    const conversionResults = {};
    for (const field of imageUrlFields) {
      if (workflowData[field] && isHttpUrl(workflowData[field])) {
        try {
          console.log(`[API] Converting ${field} URL to base64:`, workflowData[field]);
          const base64Image = await convertImageUrlToBase64(workflowData[field]);
          if (base64Image) {
            workflowData[field] = base64Image;
            conversionResults[field] = 'success';
            console.log(`[API] Successfully converted ${field} to base64`);
          } else {
            conversionResults[field] = 'failed';
            console.warn(`[API] Failed to convert ${field}, keeping original URL`);
          }
        } catch (error) {
          conversionResults[field] = 'failed';
          console.error(`[API] Error converting ${field}:`, error.message);
          // Keep the original URL if conversion fails
        }
      }
    }

    const restaurant = await db.updateRestaurantWorkflow(id, workflowData);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found or update failed'
      });
    }

    return res.json({
      success: true,
      restaurant: restaurant,
      imageConversions: conversionResults // Include conversion status in response
    });
  } catch (error) {
    console.error('[API] Error updating restaurant workflow:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update restaurant workflow'
    });
  }
});
```

#### 1.2 Add Helper Functions

```javascript
/**
 * Check if a string is an HTTP/HTTPS URL
 */
function isHttpUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Convert an image URL to base64
 * Uses the logo service for consistent image downloading
 */
async function convertImageUrlToBase64(imageUrl) {
  try {
    const logoService = require('./src/services/logo-extraction-service');

    // Download the image
    const imageBuffer = await logoService.downloadImageToBuffer(imageUrl);

    if (!imageBuffer) {
      return null;
    }

    // Detect image type from buffer or URL
    const imageType = detectImageType(imageUrl, imageBuffer);

    // Convert to base64
    const base64 = imageBuffer.toString('base64');
    return `data:image/${imageType};base64,${base64}`;
  } catch (error) {
    console.error('[API] Failed to convert image URL to base64:', error.message);
    return null;
  }
}

/**
 * Detect image type from URL extension or buffer magic bytes
 */
function detectImageType(url, buffer) {
  // Try to detect from URL extension first
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.png')) return 'png';
  if (urlLower.includes('.gif')) return 'gif';
  if (urlLower.includes('.webp')) return 'webp';
  if (urlLower.includes('.svg')) return 'svg+xml';

  // Check magic bytes
  if (buffer && buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'png';
    }
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'gif';
    }
    // WEBP: 52 49 46 46 ... 57 45 42 50
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return 'webp';
    }
  }

  // Default to JPEG
  return 'jpeg';
}
```

---

### Phase 2: Update Frontend to Show Conversion Status (Optional Enhancement)

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

#### 2.1 Update handleSave to Handle Conversion Results

```javascript
const handleSave = async () => {
  setSaving(true);
  setError(null);
  setSuccess(null);

  try {
    // ... existing code ...

    // Update existing restaurant with only changed fields
    response = await api.patch(`/restaurants/${id}/workflow`, dataToSave);

    // Check for image conversion results
    if (response.data.imageConversions) {
      const conversions = response.data.imageConversions;
      const converted = Object.keys(conversions).filter(k => conversions[k] === 'success');
      const failed = Object.keys(conversions).filter(k => conversions[k] === 'failed');

      if (converted.length > 0) {
        console.log('Images converted to base64:', converted);
      }
      if (failed.length > 0) {
        console.warn('Failed to convert some images:', failed);
        toast({
          title: "Partial Success",
          description: `Some image URLs could not be converted: ${failed.join(', ')}`,
          variant: "warning"
        });
      }
    }

    setRestaurant(response.data.restaurant);
    setIsEditing(false);
    setSuccess('Restaurant details updated successfully');

    // ... rest of existing code ...
  } catch (err) {
    // ... existing error handling ...
  }
};
```

#### 2.2 Add Visual Indicator for URL Fields (Optional)

Show a small indicator when a field contains a URL vs base64:

```jsx
{/* Website OG Image */}
<div className="space-y-2">
  <Label className="text-sm font-medium flex items-center gap-2">
    Website OG Image
    {editedData.website_og_image && !editedData.website_og_image.startsWith('data:') && (
      <Badge variant="outline" className="text-xs">URL - will convert on save</Badge>
    )}
  </Label>
  <Input
    value={editedData.website_og_image || ''}
    onChange={(e) => handleFieldChange('website_og_image', e.target.value)}
    placeholder="https://example.com/image.jpg or base64 data"
  />
  {/* Preview */}
  {editedData.website_og_image && (
    <img
      src={editedData.website_og_image}
      alt="OG Image preview"
      className="h-20 rounded border"
      onError={(e) => e.target.style.display = 'none'}
    />
  )}
</div>
```

---

## Testing Checklist

### Backend Conversion
- [ ] HTTP URL is detected correctly
- [ ] HTTPS URL is detected correctly
- [ ] Base64 data URLs are NOT re-converted
- [ ] Empty/null values are ignored
- [ ] JPEG images convert correctly
- [ ] PNG images convert correctly
- [ ] WebP images convert correctly
- [ ] Invalid URLs fail gracefully (keep original)
- [ ] CORS-protected URLs are handled
- [ ] Large images don't cause memory issues
- [ ] Conversion status is returned in response

### Frontend Integration
- [ ] Save still works for non-image fields
- [ ] Conversion results are logged
- [ ] Failed conversions show warning toast
- [ ] Saved restaurant has base64 images
- [ ] Header background selector shows converted images

### End-to-End
- [ ] Paste UberEats cover URL → Save → Image available for header
- [ ] Paste DoorDash cover URL → Save → Image available for header
- [ ] Paste Facebook cover URL → Save → Image available for header
- [ ] Paste website OG URL → Save → Image available for header
- [ ] Mixed URLs and base64 in single save → All handled correctly

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `UberEats-Image-Extractor/server.js` | Add URL detection and conversion in PATCH endpoint | 1 |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | (Optional) Add conversion status handling and UI indicators | 2 |

---

## Security Considerations

1. **URL Validation:** Only process http:// and https:// URLs
2. **Size Limits:** Consider adding max file size limit for downloaded images
3. **Timeout:** Add timeout for URL fetch to prevent hanging
4. **Rate Limiting:** Existing rate limiting should apply
5. **Malicious Content:** Trust logoService's existing validation

---

## Performance Considerations

1. **Async Processing:** Conversions happen sequentially; could parallelize if needed
2. **Caching:** No caching implemented (each save re-converts)
3. **Response Time:** Save operation will be slower when URLs are being converted
4. **Memory:** Large images buffered in memory during conversion

---

## Future Enhancements

1. **Progress Indicator:** Show conversion progress for multiple images
2. **Retry Logic:** Automatically retry failed conversions once
3. **Image Optimization:** Optionally resize/compress during conversion
4. **Batch Conversion:** Dedicated endpoint for bulk URL-to-base64 conversion
5. **CDN Upload:** Option to upload to CDN instead of storing base64

---

## Summary

This feature enables users to paste image URLs directly into the RestaurantDetail edit form. The backend automatically detects HTTP/HTTPS URLs in cover image fields and converts them to base64 during save. This eliminates the need to run branding extraction just to add a cover image for header backgrounds.

**Key Points:**
- Backend conversion avoids CORS issues
- Uses existing `logoService.downloadImageToBuffer()` pattern
- Graceful fallback: keeps original URL if conversion fails
- Optional UI enhancements for conversion status feedback
