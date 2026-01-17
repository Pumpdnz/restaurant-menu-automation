# Service Layer Architecture - UPDATED

**Last Updated:** 2025-10-10
**Status:** Phase 2 Implementation Complete - Unified Image Fetching

## Overview

The service layer now consists of **SIX main services** that handle video/image generation orchestration, unified image fetching, external API integration, and data persistence.

### Updated Architecture

```
VideoGenerationService          ImageGenerationService
         │                              │
         ├─── SoraService               ├─── GeminiImageService
         ├─── GeminiImageService        ├─── ImageFetcherService ✨ NEW
         ├─── ImageFetcherService ✨     └─── SocialStorageService
         └─── SocialStorageService
                    │
                    ▼
            ImageFetcherService ✨ NEW - Unified Image Fetching
                    │
                    ├─── Fetches from: item_images (menu)
                    ├─── Fetches from: social_media_images (AI + uploaded)
                    └─── Fetches from: restaurants (logos)
```

## Key Changes (Phase 2)

✅ **New Service**: `ImageFetcherService` - Unified image fetching from all sources
✅ **Updated**: `ImageGenerationService` - Now uses unified fetcher, merged modes
✅ **Updated**: `VideoGenerationService` - Now uses unified fetcher with source type tracking
✅ **Database**: Added `reference_image_sources` (jsonb) and `source_image_type` (text) columns

---

## 1. ImageFetcherService ✨ NEW

**Location**: `UberEats-Image-Extractor/src/services/social-media/image-fetcher-service.js`

### Purpose
Centralized service for fetching images from ALL sources:
- Menu images (item_images table)
- AI-generated images (social_media_images table, mode != 'uploaded')
- Uploaded images (social_media_images table, mode = 'uploaded')
- Restaurant logos (restaurants table)

**Replaces**: Scattered fetching logic previously duplicated across services

### Dependencies
```javascript
const SocialStorageService = require('./social-storage-service');
const axios = require('axios');
```

### Class Structure

```javascript
class ImageFetcherService {
  constructor() {
    this.storageService = new SocialStorageService();
  }

  // Main methods
  async fetchImage(imageId, sourceType)
  async fetchMultipleImages(sources)

  // Source-specific fetchers
  async fetchMenuImage(imageId)
  async fetchSocialMediaImage(imageId, sourceType)
  async fetchLogoImage(restaurantId)

  // Validation
  validateSource(source)
  validateSources(sources)
}
```

### Method: fetchImage(imageId, sourceType)

**Purpose**: Fetch single image from any source with explicit source type

**Parameters**:
```javascript
imageId: string      // UUID (or restaurant ID for logos)
sourceType: string   // 'menu' | 'ai' | 'uploaded' | 'logo'
```

**Returns**:
```javascript
{
  id: string,
  url: string,
  buffer: Buffer,
  sourceType: string,
  metadata: object
}
```

**Flow**:
```javascript
async fetchImage(imageId, sourceType) {
  // Validate source type
  if (!['menu', 'ai', 'uploaded', 'logo'].includes(sourceType)) {
    throw new Error(`Invalid source type: ${sourceType}`);
  }

  // Route to appropriate fetcher
  switch (sourceType) {
    case 'menu':
      return await this.fetchMenuImage(imageId);

    case 'ai':
    case 'uploaded':
      return await this.fetchSocialMediaImage(imageId, sourceType);

    case 'logo':
      return await this.fetchLogoImage(imageId);
  }
}
```

### Method: fetchMultipleImages(sources)

**Purpose**: Fetch multiple images from mixed sources in parallel

**Parameters**:
```javascript
sources: Array<{
  id: string,
  sourceType: 'menu' | 'ai' | 'uploaded' | 'logo'
}>
```

**Example**:
```javascript
const sources = [
  { id: 'menu-uuid-1', sourceType: 'menu' },
  { id: 'restaurant-uuid-2', sourceType: 'logo' },
  { id: 'ai-uuid-3', sourceType: 'ai' }
];

const images = await imageFetcher.fetchMultipleImages(sources);
// Returns array of 3 image objects with buffers
```

### Method: fetchMenuImage(imageId)

Fetches from `item_images` table, prefers CDN URL over original URL.

```javascript
async fetchMenuImage(imageId) {
  const { data: image } = await this.storageService.supabase
    .from('item_images')
    .select('id, url, cdn_url, width, height, menu_item_id')
    .eq('id', imageId)
    .single();

  const imageUrl = image.cdn_url || image.url;
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

  return {
    id: image.id,
    url: imageUrl,
    buffer: Buffer.from(response.data),
    sourceType: 'menu',
    metadata: {
      menuItemId: image.menu_item_id,
      width: image.width,
      height: image.height
    }
  };
}
```

### Method: fetchSocialMediaImage(imageId, sourceType)

Fetches from `social_media_images` table, validates mode matches source type.

```javascript
async fetchSocialMediaImage(imageId, sourceType) {
  const { data: image } = await this.storageService.supabase
    .from('social_media_images')
    .select('id, image_url, mode, width, height, prompt')
    .eq('id', imageId)
    .single();

  // Validate mode matches source type
  if (sourceType === 'ai' && image.mode === 'uploaded') {
    throw new Error('Image is uploaded, not AI-generated');
  }
  if (sourceType === 'uploaded' && image.mode !== 'uploaded') {
    throw new Error('Image is AI-generated, not uploaded');
  }

  const response = await axios.get(image.image_url, { responseType: 'arraybuffer' });

  return {
    id: image.id,
    url: image.image_url,
    buffer: Buffer.from(response.data),
    sourceType,
    metadata: { mode: image.mode, prompt: image.prompt }
  };
}
```

### Method: fetchLogoImage(restaurantId)

Fetches from `restaurants` table. Note: imageId parameter is actually the restaurant ID.

```javascript
async fetchLogoImage(restaurantId) {
  const { data: restaurant } = await this.storageService.supabase
    .from('restaurants')
    .select('id, name, logo_url, brand_colors')
    .eq('id', restaurantId)
    .single();

  if (!restaurant.logo_url) {
    throw new Error(`Restaurant ${restaurantId} has no logo`);
  }

  const response = await axios.get(restaurant.logo_url, { responseType: 'arraybuffer' });

  return {
    id: restaurant.id,
    url: restaurant.logo_url,
    buffer: Buffer.from(response.data),
    sourceType: 'logo',
    metadata: {
      restaurantName: restaurant.name,
      brandColors: restaurant.brand_colors
    }
  };
}
```

---

## 2. ImageGenerationService (UPDATED)

**Location**: `UberEats-Image-Extractor/src/services/social-media/image-generation-service.js`

### Changes from Original

✅ **Added**: `ImageFetcherService` dependency
✅ **Merged**: `image-reference` + `remix` modes → `reference-images`
✅ **Removed**: `fetchMenuItemImage()` and `fetchGeneratedImage()` methods
✅ **Added**: New `handleReferenceImages()` method with unified fetching
✅ **Updated**: Validation to support new `referenceSources` structure
✅ **Updated**: Database writes to store `reference_image_sources` (jsonb)

### Updated Dependencies
```javascript
const GeminiImageService = require('./gemini-image-service');
const SocialStorageService = require('./social-storage-service');
const ImageFetcherService = require('./image-fetcher-service');  // NEW
const sharp = require('sharp');
```

### Updated Class Structure

```javascript
class ImageGenerationService {
  constructor() {
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.imageFetcher = new ImageFetcherService();  // NEW
  }

  // Main method - UPDATED SIGNATURE
  async generateImage(request)  // Now accepts referenceSources instead of referenceImageIds/remixImageIds

  // Validation - UPDATED
  validateRequest(request)  // Now validates referenceSources structure

  // Mode handlers
  async handleTextToImage(prompt, imageConfig)
  async handleReferenceImages(referenceSources, prompt, imageConfig)  // NEW - Unified
  async processUploadedImage(imageBuffer, jobId)

  // Utilities
  async generateWithMultipleReferences(referenceImages, prompt, aspectRatio)
  buildCompositionPrompt(userPrompt, aspectRatio, imageCount)
  async createAndUploadThumbnail(imageBuffer, jobId)

  // Database
  async createJob(request)  // UPDATED - stores reference_image_sources
  async updateJob(jobId, updates)
  async getJobStatus(jobId)
  async listImages(filters)
  async deleteImage(jobId)
}
```

### Updated Method: generateImage(request)

**New Request Structure**:
```javascript
{
  mode: 'uploaded' | 'text-to-image' | 'reference-images',  // Merged modes
  prompt?: string,
  referenceSources?: [  // NEW - replaces referenceImageIds and remixImageIds
    { id: string, sourceType: 'menu' | 'ai' | 'uploaded' | 'logo' }
  ],
  uploadedImageBuffer?: Buffer,
  organisationId: string,
  restaurantId?: string,
  userId: string,
  imageConfig: { aspectRatio: string }
}
```

**Updated Flow**:
```javascript
async generateImage(request) {
  this.validateRequest(request);  // Validates referenceSources structure
  const job = await this.createJob(request);

  try {
    let imageBuffer, imageMetadata;

    switch (request.mode) {
      case 'uploaded':
        imageBuffer = request.uploadedImageBuffer;
        imageMetadata = await this.processUploadedImage(imageBuffer, job.id);
        break;

      case 'text-to-image':
        const textResult = await this.handleTextToImage(request.prompt, request.imageConfig);
        imageBuffer = textResult.buffer;
        imageMetadata = textResult.metadata;
        break;

      case 'reference-images':  // NEW - unified mode
        const refResult = await this.handleReferenceImages(
          request.referenceSources,  // NEW
          request.prompt,
          request.imageConfig
        );
        imageBuffer = refResult.buffer;
        imageMetadata = refResult.metadata;
        break;
    }

    // Upload and update job...
  }
}
```

### New Method: handleReferenceImages()

**Purpose**: Unified handler for all reference-based image generation (replaces separate image-reference and remix handlers)

```javascript
async handleReferenceImages(referenceSources, prompt, imageConfig) {
  console.log('[ImageGenerationService] Generating with reference images:', {
    count: referenceSources.length,
    sources: referenceSources.map(s => s.sourceType)
  });

  // Fetch all reference images using unified fetcher
  const referenceImages = await this.imageFetcher.fetchMultipleImages(referenceSources);

  // Use Gemini multi-image composition
  const result = await this.generateWithMultipleReferences(
    referenceImages,
    prompt,
    imageConfig.aspectRatio
  );

  const metadata = await sharp(result.buffer).metadata();

  return {
    buffer: result.buffer,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    }
  };
}
```

### Updated Method: createJob()

**Now stores source metadata**:
```javascript
async createJob(request) {
  const { mode, prompt, referenceSources, /* ... */ } = request;

  const { data: job } = await this.storageService.supabase
    .from('social_media_images')
    .insert({
      organisation_id: organisationId,
      mode,
      prompt,
      reference_image_ids: referenceSources?.map(s => s.id) || null,  // Backwards compat
      reference_image_sources: referenceSources || null,  // NEW - full metadata
      gemini_model: 'gemini-2.5-flash-image',
      status: 'queued',
      image_config: imageConfig,
      created_by: userId
    })
    .select()
    .single();

  return job;
}
```

---

## 3. VideoGenerationService (UPDATED)

**Location**: `UberEats-Image-Extractor/src/services/social-media/video-generation-service.js`

### Changes from Original

✅ **Added**: `ImageFetcherService` dependency
✅ **Updated**: `handleMode1()` to use unified fetcher with explicit source type
✅ **Updated**: Database writes to store `source_image_type` field
✅ **Added**: Source type validation in handleMode1

### Updated Dependencies
```javascript
const SoraService = require('./sora-service');
const GeminiImageService = require('./gemini-image-service');
const SocialStorageService = require('./social-storage-service');
const ImageFetcherService = require('./image-fetcher-service');  // NEW
const axios = require('axios');
const sharp = require('sharp');
```

### Updated Class Structure

```javascript
class VideoGenerationService {
  constructor() {
    this.soraService = new SoraService();
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.imageFetcher = new ImageFetcherService();  // NEW
    this.activePolls = new Map();
  }

  // Main methods
  async generateVideo(request)
  async pollJobCompletion(jobId, soraVideoId)

  // Mode handlers - UPDATED
  async handleMode1(inputSource, jobId, videoConfig)  // Now requires sourceType
  async handleMode3(imagePrompt, jobId, videoConfig)

  // Utilities
  async resizeImageForVideo(imageBuffer, targetWidth, targetHeight)
}
```

### Updated Method: handleMode1()

**New Input Source Structure**:
```javascript
inputSource: {
  imageId: string,
  sourceType: 'menu' | 'ai' | 'uploaded' | 'logo'  // NEW - required
}
```

**Updated Flow**:
```javascript
async handleMode1(inputSource, jobId, videoConfig) {
  console.log('[VideoGenerationService] Mode 1: Fetching image...', {
    imageId: inputSource.imageId,
    sourceType: inputSource.sourceType
  });

  // Validate required fields
  if (!inputSource || !inputSource.imageId || !inputSource.sourceType) {
    throw new Error('Image ID and source type required for Mode 1');
  }

  // Validate source type
  if (!['menu', 'ai', 'uploaded', 'logo'].includes(inputSource.sourceType)) {
    throw new Error(
      `Invalid sourceType: ${inputSource.sourceType}. Must be: menu, ai, uploaded, or logo`
    );
  }

  // Fetch image using unified fetcher
  const image = await this.imageFetcher.fetchImage(
    inputSource.imageId,
    inputSource.sourceType
  );

  // Update job with source metadata
  await this.storageService.updateJob(jobId, {
    source_image_id: inputSource.imageId,
    source_image_url: image.url,
    source_image_type: inputSource.sourceType  // NEW - track source type
  });

  // Resize to video dimensions
  const [targetWidth, targetHeight] = videoConfig.size.split('x').map(Number);
  const resizedBuffer = await this.resizeImageForVideo(
    image.buffer,
    targetWidth,
    targetHeight
  );

  return resizedBuffer;
}
```

---

## 4. SoraService (UNCHANGED)

See original documentation - no changes to this service.

---

## 5. GeminiImageService (UNCHANGED)

See original documentation - no changes to this service.

---

## 6. SocialStorageService (UNCHANGED)

See original documentation - no changes to this service.

---

## Migration Summary

### Database Changes
```sql
-- social_media_images table
ALTER TABLE social_media_images
ADD COLUMN reference_image_sources jsonb DEFAULT NULL;

-- social_media_videos table
ALTER TABLE social_media_videos
ADD COLUMN source_image_type text DEFAULT NULL
CHECK (source_image_type IS NULL OR source_image_type IN ('menu', 'ai', 'uploaded', 'logo'));

-- Mode consolidation
UPDATE social_media_images
SET mode = 'reference-images'
WHERE mode IN ('image-reference', 'remix');
```

### API Changes (Pending)
- `POST /api/social-media/images/generate`
  - **Old**: `referenceImageIds`, `remixImageIds`
  - **New**: `referenceSources: [{ id, sourceType }]`

- `POST /api/social-media/videos/generate`
  - **Old**: `inputSource: { imageId }`
  - **New**: `inputSource: { imageId, sourceType }`

### Benefits

✅ **Single Source of Truth**: All image fetching centralized
✅ **Type Safety**: Explicit source types prevent errors
✅ **Flexibility**: Mix any combination of image sources
✅ **Maintainability**: Changes to fetching logic in one place
✅ **Extensibility**: Easy to add new image sources in future

---

Last Updated: 2025-10-10
