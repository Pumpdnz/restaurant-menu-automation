# Image Reference Mode Unification - Implementation Plan

**Created:** 2025-10-10
**Status:** Draft
**Priority:** High

---

## Executive Summary

This plan outlines the complete refactoring of image reference modes in the social media content generation system. Currently, the system has two separate modes (`image-reference` and `remix`) that cannot work together and don't support logo images. This refactoring will merge them into a single unified "Reference Images" mode that supports selecting from 4 distinct image sources:

1. **Menu Images** (from `item_images` table)
2. **AI Generated Images** (from `social_media_images` where mode != 'uploaded')
3. **Uploaded Images** (from `social_media_images` where mode = 'uploaded')
4. **Restaurant Logos** (from `restaurants` table)

---

## Database Schema Analysis

### Current Structure

**restaurants table:**
- `id` (uuid, PK)
- `logo_url` (text) - URL to logo image
- `organisation_id` (uuid)
- 68 rows currently

**item_images table:**
- `id` (uuid, PK)
- `menu_item_id` (uuid, FK)
- `url` (text) - Original URL
- `cdn_url` (text) - CDN URL (preferred)
- `organisation_id` (uuid)
- 1,913 rows currently

**social_media_images table:**
- `id` (uuid, PK)
- `mode` (varchar) - Check constraint: 'uploaded', 'text-to-image', 'image-reference', 'remix'
- `reference_image_ids` (uuid[]) - Array of UUIDs (currently single-source)
- `image_url` (text)
- `organisation_id` (uuid)
- 17 rows currently

**social_media_videos table:**
- `id` (uuid, PK)
- `source_image_id` (uuid) - Single source image
- `source_image_url` (text)
- `organisation_id` (uuid)
- 16 rows currently

### Required Database Changes

#### 1. Add Source Type Tracking to `social_media_images`

```sql
-- Migration: add_reference_image_sources_to_social_media_images
ALTER TABLE social_media_images
ADD COLUMN reference_image_sources jsonb DEFAULT NULL;

-- Comment explaining the structure
COMMENT ON COLUMN social_media_images.reference_image_sources IS
'Array of source metadata objects: [{ id: uuid, sourceType: "menu" | "ai" | "uploaded" | "logo" }]';

-- Example data structure:
-- [
--   { "id": "uuid-1", "sourceType": "menu" },
--   { "id": "uuid-2", "sourceType": "logo" },
--   { "id": "uuid-3", "sourceType": "ai" }
-- ]
```

**Rationale:**
- JSONB allows flexible structure for source metadata
- Preserves existing `reference_image_ids` array for backwards compatibility
- Enables querying and filtering by source type
- Can be extended in future (e.g., add order, weights, etc.)

#### 2. Add Source Type Tracking to `social_media_videos`

```sql
-- Migration: add_source_image_metadata_to_social_media_videos
ALTER TABLE social_media_videos
ADD COLUMN source_image_type text DEFAULT NULL;

-- Add check constraint
ALTER TABLE social_media_videos
ADD CONSTRAINT source_image_type_check
CHECK (source_image_type IS NULL OR source_image_type IN ('menu', 'ai', 'uploaded', 'logo'));

-- Comment
COMMENT ON COLUMN social_media_videos.source_image_type IS
'Type of source image: menu (item_images), ai (social_media_images AI-generated), uploaded (social_media_images uploaded), logo (restaurants)';
```

**Rationale:**
- Videos only support single image input (Mode 1), so simple text field suffices
- Check constraint ensures data integrity
- Nullable for backwards compatibility with existing records

#### 3. Update Mode Constraint on `social_media_images`

```sql
-- Migration: update_social_media_images_mode_constraint
-- Drop old constraint
ALTER TABLE social_media_images
DROP CONSTRAINT IF EXISTS social_media_images_mode_check;

-- Add new constraint with consolidated mode
ALTER TABLE social_media_images
ADD CONSTRAINT social_media_images_mode_check
CHECK (mode IN ('uploaded', 'text-to-image', 'reference-images'));

-- Update existing 'image-reference' and 'remix' records to 'reference-images'
UPDATE social_media_images
SET mode = 'reference-images'
WHERE mode IN ('image-reference', 'remix');
```

**Rationale:**
- Merges `image-reference` and `remix` into single `reference-images` mode
- Backwards compatible - migrates existing data
- Simplifies future logic

---

## Service Layer Changes

### 1. Create Unified Image Fetcher Service

**File:** `src/services/social-media/image-fetcher-service.js`

```javascript
/**
 * Unified Image Fetcher Service
 *
 * Centralized service for fetching images from all sources:
 * - Menu images (item_images table)
 * - AI-generated images (social_media_images table, mode != 'uploaded')
 * - Uploaded images (social_media_images table, mode = 'uploaded')
 * - Restaurant logos (restaurants table)
 */

class ImageFetcherService {
  constructor() {
    this.storageService = new SocialStorageService();
  }

  /**
   * Fetch image from any source with automatic source type detection
   *
   * @param {string} imageId - UUID of the image
   * @param {string} sourceType - 'menu' | 'ai' | 'uploaded' | 'logo'
   * @returns {Promise<Object>} { id, url, buffer, sourceType, metadata }
   */
  async fetchImage(imageId, sourceType) {
    switch (sourceType) {
      case 'menu':
        return await this.fetchMenuImage(imageId);

      case 'ai':
      case 'uploaded':
        return await this.fetchSocialMediaImage(imageId, sourceType);

      case 'logo':
        return await this.fetchLogoImage(imageId);

      default:
        throw new Error(`Invalid source type: ${sourceType}`);
    }
  }

  /**
   * Fetch multiple images with mixed sources
   *
   * @param {Array<Object>} sources - [{ id, sourceType }, ...]
   * @returns {Promise<Array<Object>>} Array of image objects
   */
  async fetchMultipleImages(sources) {
    return await Promise.all(
      sources.map(src => this.fetchImage(src.id, src.sourceType))
    );
  }

  /**
   * Fetch menu item image from item_images table
   */
  async fetchMenuImage(imageId) {
    const { data: image, error } = await this.storageService.supabase
      .from('item_images')
      .select('id, url, cdn_url, width, height, menu_item_id')
      .eq('id', imageId)
      .single();

    if (error || !image) {
      throw new Error(`Menu image not found: ${imageId}`);
    }

    // Download image
    const imageUrl = image.cdn_url || image.url;
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

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

  /**
   * Fetch AI-generated or uploaded image from social_media_images table
   */
  async fetchSocialMediaImage(imageId, sourceType) {
    const { data: image, error } = await this.storageService.supabase
      .from('social_media_images')
      .select('id, image_url, mode, width, height, prompt')
      .eq('id', imageId)
      .single();

    if (error || !image) {
      throw new Error(`Social media image not found: ${imageId}`);
    }

    // Validate mode matches source type
    if (sourceType === 'ai' && image.mode === 'uploaded') {
      throw new Error(`Image ${imageId} is uploaded, not AI-generated`);
    }
    if (sourceType === 'uploaded' && image.mode !== 'uploaded') {
      throw new Error(`Image ${imageId} is AI-generated, not uploaded`);
    }

    // Download image
    const response = await axios.get(image.image_url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    return {
      id: image.id,
      url: image.image_url,
      buffer: Buffer.from(response.data),
      sourceType,
      metadata: {
        mode: image.mode,
        prompt: image.prompt,
        width: image.width,
        height: image.height
      }
    };
  }

  /**
   * Fetch restaurant logo from restaurants table
   *
   * NOTE: The imageId here is actually the restaurant ID
   */
  async fetchLogoImage(restaurantId) {
    const { data: restaurant, error } = await this.storageService.supabase
      .from('restaurants')
      .select('id, name, logo_url, brand_colors')
      .eq('id', restaurantId)
      .single();

    if (error || !restaurant) {
      throw new Error(`Restaurant not found: ${restaurantId}`);
    }

    if (!restaurant.logo_url) {
      throw new Error(`Restaurant ${restaurantId} has no logo`);
    }

    // Download logo
    const response = await axios.get(restaurant.logo_url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

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
}

module.exports = ImageFetcherService;
```

### 2. Update Image Generation Service

**File:** `src/services/social-media/image-generation-service.js`

**Changes Required:**

```javascript
// Replace fetchMenuItemImage() and fetchGeneratedImage() methods
// with unified fetching using ImageFetcherService

const ImageFetcherService = require('./image-fetcher-service');

class ImageGenerationService {
  constructor() {
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.imageFetcher = new ImageFetcherService(); // NEW
  }

  /**
   * Handle unified reference-images mode (replaces both image-reference and remix)
   *
   * @param {Array<Object>} referenceSources - [{ id, sourceType }, ...]
   * @param {string} prompt - Generation prompt
   * @param {Object} imageConfig - Image configuration
   */
  async handleReferenceImages(referenceSources, prompt, imageConfig) {
    console.log('[ImageGenerationService] Generating with reference images:', {
      count: referenceSources.length,
      sources: referenceSources.map(s => s.sourceType)
    });

    // Fetch all reference images using unified fetcher
    const referenceImages = await this.imageFetcher.fetchMultipleImages(
      referenceSources
    );

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

  // Update validateRequest to handle new mode
  validateRequest(request) {
    const { mode, prompt, referenceSources, uploadedImageBuffer, imageConfig } = request;

    if (!mode || !['uploaded', 'text-to-image', 'reference-images'].includes(mode)) {
      throw new Error('Invalid mode. Must be: uploaded, text-to-image, or reference-images');
    }

    // ... existing validation ...

    if (mode === 'reference-images') {
      if (!referenceSources || referenceSources.length === 0) {
        throw new Error('referenceSources is required for reference-images mode');
      }

      // Validate source structure
      for (const src of referenceSources) {
        if (!src.id || !src.sourceType) {
          throw new Error('Each reference source must have id and sourceType');
        }
        if (!['menu', 'ai', 'uploaded', 'logo'].includes(src.sourceType)) {
          throw new Error(`Invalid sourceType: ${src.sourceType}`);
        }
      }

      if (!prompt) {
        throw new Error('prompt is required for reference-images mode');
      }
    }
  }

  // Update generateImage to route to new handler
  async generateImage(request) {
    // ... existing code ...

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

      case 'reference-images': // NEW - unified mode
        const refResult = await this.handleReferenceImages(
          request.referenceSources,
          request.prompt,
          request.imageConfig
        );
        imageBuffer = refResult.buffer;
        imageMetadata = refResult.metadata;
        break;
    }

    // ... rest of existing code ...
  }

  // Update createJob to store new data structure
  async createJob(request) {
    const { mode, prompt, referenceSources, /* ... */ } = request;

    const { data: job, error } = await this.storageService.supabase
      .from('social_media_images')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        menu_id: menuId,
        menu_item_id: menuItemId,
        mode,
        prompt,
        reference_image_ids: referenceSources?.map(s => s.id) || null, // Backwards compat
        reference_image_sources: referenceSources || null, // NEW
        gemini_model: 'gemini-2.5-flash-image',
        status: 'queued',
        progress: 0,
        image_config: imageConfig,
        gemini_config: geminiConfig || null,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return job;
  }
}
```

### 3. Update Video Generation Service

**File:** `src/services/social-media/video-generation-service.js`

**Changes Required:**

```javascript
const ImageFetcherService = require('./image-fetcher-service');

class VideoGenerationService {
  constructor() {
    this.soraService = new SoraService();
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.imageFetcher = new ImageFetcherService(); // NEW
  }

  /**
   * Mode 1: Handle database image input with source type
   *
   * @param {Object} inputSource - { imageId, sourceType }
   */
  async handleMode1(inputSource, jobId, videoConfig) {
    try {
      console.log('[VideoGenerationService] Mode 1: Fetching image...', {
        imageId: inputSource.imageId,
        sourceType: inputSource.sourceType
      });

      if (!inputSource || !inputSource.imageId || !inputSource.sourceType) {
        throw new Error('Image ID and source type required for Mode 1');
      }

      // Fetch image using unified fetcher
      const image = await this.imageFetcher.fetchImage(
        inputSource.imageId,
        inputSource.sourceType
      );

      console.log('[VideoGenerationService] Image fetched:', {
        id: image.id,
        url: image.url,
        sourceType: image.sourceType
      });

      // Update job with source metadata
      await this.storageService.updateJob(jobId, {
        source_image_id: inputSource.imageId,
        source_image_url: image.url,
        source_image_type: inputSource.sourceType // NEW
      });

      // Resize to video dimensions
      const [targetWidth, targetHeight] = videoConfig.size.split('x').map(Number);
      const resizedBuffer = await this.resizeImageForVideo(
        image.buffer,
        targetWidth,
        targetHeight
      );

      return resizedBuffer;

    } catch (error) {
      console.error('[VideoGenerationService] Error in handleMode1:', error);
      throw new Error(`Failed to fetch image: ${error.message}`);
    }
  }
}
```

---

## API Layer Changes

### 1. Update Image Generation Endpoint

**File:** `src/routes/social-media-routes.js`

```javascript
/**
 * POST /api/social-media/images/generate
 *
 * Request Body (NEW):
 * {
 *   mode: 'uploaded' | 'text-to-image' | 'reference-images',
 *   prompt?: string (required for text-to-image, reference-images),
 *   referenceSources?: [
 *     { id: uuid, sourceType: 'menu' | 'ai' | 'uploaded' | 'logo' }
 *   ] (required for reference-images),
 *   restaurantId?: uuid,
 *   menuId?: uuid,
 *   menuItemId?: uuid,
 *   imageConfig: {
 *     aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4'
 *   }
 * }
 */
router.post('/images/generate', authMiddleware, async (req, res) => {
  try {
    const {
      mode,
      prompt,
      referenceSources, // NEW - replaces referenceImageIds and remixImageIds
      restaurantId,
      menuId,
      menuItemId,
      imageConfig,
      geminiConfig
    } = req.body;

    // Validation
    if (!mode) {
      return res.status(400).json({
        success: false,
        error: 'mode is required'
      });
    }

    if (!imageConfig || !imageConfig.aspectRatio) {
      return res.status(400).json({
        success: false,
        error: 'imageConfig with aspectRatio is required'
      });
    }

    // Mode-specific validation
    if (mode === 'text-to-image') {
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'prompt is required for text-to-image mode'
        });
      }
    }

    if (mode === 'reference-images') {
      if (!referenceSources || !Array.isArray(referenceSources) || referenceSources.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'referenceSources array is required for reference-images mode'
        });
      }

      // Validate each source
      for (const src of referenceSources) {
        if (!src.id || !src.sourceType) {
          return res.status(400).json({
            success: false,
            error: 'Each reference source must have id and sourceType'
          });
        }

        if (!['menu', 'ai', 'uploaded', 'logo'].includes(src.sourceType)) {
          return res.status(400).json({
            success: false,
            error: `Invalid sourceType: ${src.sourceType}. Must be: menu, ai, uploaded, or logo`
          });
        }
      }

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'prompt is required for reference-images mode'
        });
      }
    }

    // Generate image
    const imageService = new ImageGenerationService();
    const result = await imageService.generateImage({
      mode,
      prompt,
      referenceSources,
      organisationId: req.user.organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId: req.user.id,
      imageConfig,
      geminiConfig
    });

    return res.json({
      success: true,
      job: result
    });

  } catch (error) {
    console.error('[API] Error generating image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate image'
    });
  }
});
```

### 2. Update Video Generation Endpoint

**File:** `src/routes/social-media-routes.js`

```javascript
/**
 * POST /api/social-media/videos/generate
 *
 * Request Body (UPDATED):
 * {
 *   mode: 'image-to-video' | 'text-to-video' | 'generated-image-to-video',
 *   prompt: string (required),
 *   imagePrompt?: string (required for generated-image-to-video),
 *   inputSource?: {
 *     imageId: uuid,
 *     sourceType: 'menu' | 'ai' | 'uploaded' | 'logo'  // NEW
 *   } (required for image-to-video),
 *   restaurantId?: uuid,
 *   menuId?: uuid,
 *   menuItemId?: uuid,
 *   soraModel: 'sora-2' | 'sora-2-pro',
 *   videoConfig: {
 *     size: '1280x720' | '1920x1080' | '720x1280' | '1080x1920',
 *     seconds: 4 | 8 | 12
 *   }
 * }
 */
router.post('/videos/generate', authMiddleware, async (req, res) => {
  try {
    const {
      mode,
      prompt,
      imagePrompt,
      inputSource, // Updated to include sourceType
      /* ... rest of params ... */
    } = req.body;

    // Existing validation...

    // Mode-specific validation
    if (mode === 'image-to-video') {
      if (!inputSource || !inputSource.imageId) {
        return res.status(400).json({
          success: false,
          error: 'inputSource with imageId is required for image-to-video mode'
        });
      }

      // NEW: Validate source type
      if (!inputSource.sourceType) {
        return res.status(400).json({
          success: false,
          error: 'inputSource.sourceType is required (menu, ai, uploaded, or logo)'
        });
      }

      if (!['menu', 'ai', 'uploaded', 'logo'].includes(inputSource.sourceType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid sourceType: ${inputSource.sourceType}`
        });
      }
    }

    // Generate video
    const videoService = new VideoGenerationService();
    const result = await videoService.generateVideo({
      mode,
      prompt,
      imagePrompt,
      inputSource, // Now includes sourceType
      organisationId: req.user.organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId: req.user.id,
      soraModel,
      videoConfig
    });

    return res.json({
      success: true,
      job: result
    });

  } catch (error) {
    console.error('[API] Error generating video:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate video'
    });
  }
});
```

---

## Frontend UI Changes

### 1. Update Image Mode Selector

**File:** `src/components/social-media/ImageModeSelector.tsx`

```typescript
// Update mode type
type ImageMode = 'uploaded' | 'text-to-image' | 'reference-images';

// Update options array
const modeOptions = [
  {
    value: 'uploaded' as ImageMode,
    label: 'Upload Image',
    icon: Upload,
    description: 'Upload an existing image file',
  },
  {
    value: 'text-to-image' as ImageMode,
    label: 'Text to Image',
    icon: Type,
    description: 'Generate a new image from text description',
  },
  {
    value: 'reference-images' as ImageMode, // UPDATED
    label: 'Reference Images',
    icon: Sparkles, // AI sparkle icon
    description: 'Blend multiple images together or use a single image as a reference',
  },
];
```

### 2. Create New Unified Reference Images Selector

**File:** `src/components/social-media/UnifiedReferenceImageSelector.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, Image, Sparkles, Upload, Building2 } from 'lucide-react';
import api from '@/services/api';

interface ImageSource {
  id: string;
  sourceType: 'menu' | 'ai' | 'uploaded' | 'logo';
}

interface UnifiedReferenceImageSelectorProps {
  value: ImageSource[];
  onChange: (sources: ImageSource[]) => void;
  min?: number;
  max?: number;
}

export function UnifiedReferenceImageSelector({
  value,
  onChange,
  min = 1,
  max = 10
}: UnifiedReferenceImageSelectorProps) {
  // State for each image source type
  const [menuImages, setMenuImages] = useState<any[]>([]);
  const [aiImages, setAiImages] = useState<any[]>([]);
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [logos, setLogos] = useState<any[]>([]);

  // Loading states
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingUploaded, setLoadingUploaded] = useState(false);
  const [loadingLogos, setLoadingLogos] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<any[]>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState<'menu' | 'ai' | 'uploaded' | 'logos'>('menu');

  useEffect(() => {
    fetchRestaurants();
    fetchAllImages();
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants');
      if (response.data.success) {
        setRestaurants(response.data.restaurants);
      }
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchAllImages = async () => {
    await Promise.all([
      fetchMenuImages(),
      fetchAIImages(),
      fetchUploadedImages(),
      fetchLogos()
    ]);
  };

  const fetchMenuImages = async () => {
    setLoadingMenu(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (selectedRestaurant !== 'all') {
        params.append('restaurantId', selectedRestaurant);
      }

      const response = await api.get(`/menus/images?${params}`);
      if (response.data.success) {
        setMenuImages(response.data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch menu images:', error);
    } finally {
      setLoadingMenu(false);
    }
  };

  const fetchAIImages = async () => {
    setLoadingAI(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        status: 'completed'
      });

      if (selectedRestaurant !== 'all') {
        params.append('restaurantId', selectedRestaurant);
      }

      const response = await api.get(`/social-media/images?${params}`);
      if (response.data.success) {
        // Filter to only AI-generated (exclude uploaded)
        const aiOnly = (response.data.images || []).filter(
          (img: any) => img.mode !== 'uploaded'
        );
        setAiImages(aiOnly);
      }
    } catch (error) {
      console.error('Failed to fetch AI images:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const fetchUploadedImages = async () => {
    setLoadingUploaded(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        status: 'completed',
        mode: 'uploaded' // Filter to uploaded only
      });

      if (selectedRestaurant !== 'all') {
        params.append('restaurantId', selectedRestaurant);
      }

      const response = await api.get(`/social-media/images?${params}`);
      if (response.data.success) {
        setUploadedImages(response.data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch uploaded images:', error);
    } finally {
      setLoadingUploaded(false);
    }
  };

  const fetchLogos = async () => {
    setLoadingLogos(true);
    try {
      const response = await api.get('/restaurants/logos');
      if (response.data.success) {
        let logoList = response.data.logos || [];

        // Filter by restaurant if selected
        if (selectedRestaurant !== 'all') {
          logoList = logoList.filter((logo: any) => logo.id === selectedRestaurant);
        }

        setLogos(logoList);
      }
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setLoadingLogos(false);
    }
  };

  const toggleImage = (id: string, sourceType: 'menu' | 'ai' | 'uploaded' | 'logo') => {
    const existingIndex = value.findIndex(src => src.id === id);

    if (existingIndex !== -1) {
      // Deselect
      onChange(value.filter(src => src.id !== id));
    } else {
      // Select (if not at max)
      if (value.length < max) {
        onChange([...value, { id, sourceType }]);
      }
    }
  };

  const isSelected = (id: string) => {
    return value.some(src => src.id === id);
  };

  const getSelectionOrder = (id: string) => {
    const index = value.findIndex(src => src.id === id);
    return index !== -1 ? index + 1 : null;
  };

  const selectionCount = value.length;
  const canSelectMore = selectionCount < max;
  const hasMinimum = selectionCount >= min;

  const renderImageGrid = (
    images: any[],
    sourceType: 'menu' | 'ai' | 'uploaded' | 'logo',
    loading: boolean,
    getImageUrl: (img: any) => string,
    getImageName: (img: any) => string
  ) => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (images.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>No images found. Try adjusting your filters.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[400px] overflow-y-auto p-1">
        {images.map((image) => {
          const selected = isSelected(image.id);
          const order = getSelectionOrder(image.id);
          const imageUrl = getImageUrl(image);

          return (
            <Card
              key={image.id}
              className={`relative cursor-pointer transition-all overflow-hidden ${
                selected
                  ? 'ring-2 ring-primary ring-offset-2'
                  : canSelectMore
                  ? 'hover:ring-2 hover:ring-primary/50'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => canSelectMore || selected ? toggleImage(image.id, sourceType) : null}
            >
              <div className="aspect-square relative">
                <img
                  src={imageUrl}
                  alt={getImageName(image)}
                  className="w-full h-full object-cover"
                />

                {selected && order && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-primary text-xs font-bold rounded-full flex items-center justify-center border-2 border-primary">
                        {order}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2 bg-white">
                <p className="text-xs truncate text-gray-700">
                  {getImageName(image)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Selection counter */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Select Reference Images</Label>
        <div className="text-sm">
          <span className={`font-medium ${hasMinimum ? 'text-green-600' : 'text-red-600'}`}>
            {selectionCount}
          </span>
          <span className="text-gray-500"> / {max} selected</span>
          {!hasMinimum && (
            <span className="text-xs text-red-600 ml-2">(min: {min})</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />

        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All restaurants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Restaurants</SelectItem>
            {restaurants.map((restaurant) => (
              <SelectItem key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabbed interface for image sources */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="menu" className="flex items-center gap-1">
            <Image className="w-4 h-4" />
            Menu ({menuImages.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            AI ({aiImages.length})
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="flex items-center gap-1">
            <Upload className="w-4 h-4" />
            Uploaded ({uploadedImages.length})
          </TabsTrigger>
          <TabsTrigger value="logos" className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Logos ({logos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-4">
          {renderImageGrid(
            menuImages,
            'menu',
            loadingMenu,
            (img) => img.cdn_url || img.url,
            (img) => img.menu_item_name || 'Menu item'
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          {renderImageGrid(
            aiImages,
            'ai',
            loadingAI,
            (img) => img.image_url,
            (img) => (img.prompt || 'AI image').substring(0, 30)
          )}
        </TabsContent>

        <TabsContent value="uploaded" className="mt-4">
          {renderImageGrid(
            uploadedImages,
            'uploaded',
            loadingUploaded,
            (img) => img.image_url,
            (img) => `Uploaded ${new Date(img.created_at).toLocaleDateString()}`
          )}
        </TabsContent>

        <TabsContent value="logos" className="mt-4">
          {renderImageGrid(
            logos,
            'logo',
            loadingLogos,
            (logo) => logo.logo_url,
            (logo) => logo.name
          )}
        </TabsContent>
      </Tabs>

      {/* Helper text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          ✨ Select 1 or more images from any source. Gemini will generate a new image
          inspired by your selections, blending elements together.
        </p>
        <p className="text-gray-500">
          Click images to select/deselect. Selection order matters!
        </p>
      </div>
    </div>
  );
}
```

### 3. Update ImagesTab to Use New Component

**File:** `src/pages/social-media/ImagesTab.tsx`

```typescript
import { UnifiedReferenceImageSelector } from '@/components/social-media/UnifiedReferenceImageSelector';

// Update state
const [referenceSources, setReferenceSources] = useState<ImageSource[]>([]);

// Remove old states
// const [referenceImageIds, setReferenceImageIds] = useState<string[]>([]);
// const [remixImageIds, setRemixImageIds] = useState<string[]>([]);

// Update validation in handleGenerate
if (mode === 'reference-images') {
  if (referenceSources.length === 0) {
    toast.error('Validation error', {
      description: 'Please select at least 1 reference image',
    });
    return;
  }
  if (!prompt.trim()) {
    toast.error('Validation error', {
      description: 'Please enter a prompt',
    });
    return;
  }
}

// Update request data
if (mode === 'reference-images') {
  requestData.prompt = prompt;
  requestData.referenceSources = referenceSources;
}

// Replace old selectors with new unified one
{mode === 'reference-images' && (
  <Card className="p-6">
    <UnifiedReferenceImageSelector
      value={referenceSources}
      onChange={setReferenceSources}
      min={1}
      max={10}
    />
  </Card>
)}
```

### 4. Update VideosTab for Video Generation

**File:** `src/pages/social-media/VideosTab.tsx`

```typescript
// Similar changes - update inputSource to include sourceType
const [inputSource, setInputSource] = useState<{
  imageId: string;
  sourceType: 'menu' | 'ai' | 'uploaded' | 'logo';
} | null>(null);

// When selecting image, track source type
// Use UnifiedReferenceImageSelector in single-selection mode
```

---

## Migration Strategy

### Phase 1: Database Migrations (1 hour)

1. Run SQL migrations in order:
   - `add_reference_image_sources_to_social_media_images.sql`
   - `add_source_image_metadata_to_social_media_videos.sql`
   - `update_social_media_images_mode_constraint.sql`

2. Verify migrations:
   ```sql
   -- Check new columns exist
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'social_media_images'
     AND column_name IN ('reference_image_sources');

   -- Check mode constraint updated
   SELECT mode, COUNT(*)
   FROM social_media_images
   GROUP BY mode;
   ```

### Phase 2: Backend Services (4-6 hours)

1. Create `ImageFetcherService` (2 hours)
2. Update `ImageGenerationService` (1-2 hours)
3. Update `VideoGenerationService` (1 hour)
4. Update API routes (1 hour)
5. Test backend with Postman/cURL (1 hour)

### Phase 3: Frontend Components (4-6 hours)

1. Update `ImageModeSelector` (0.5 hours)
2. Create `UnifiedReferenceImageSelector` (3-4 hours)
3. Update `ImagesTab` (1 hour)
4. Update `VideosTab` (0.5 hours)
5. Test UI end-to-end (1 hour)

### Phase 4: Testing & Polish (2-3 hours)

1. End-to-end testing with all combinations
2. Fix any edge cases
3. Update documentation

**Total Estimated Time:** 11-16 hours

---

## Testing Checklist

### Backend Testing

- [ ] Can fetch menu image (item_images)
- [ ] Can fetch AI image (social_media_images, mode != 'uploaded')
- [ ] Can fetch uploaded image (social_media_images, mode = 'uploaded')
- [ ] Can fetch logo (restaurants)
- [ ] Can handle mixed sources (e.g., 2 menu + 1 logo + 1 AI)
- [ ] Invalid source type returns error
- [ ] Missing image ID returns error
- [ ] Logo without logo_url returns error

### Frontend Testing

- [ ] All 4 tabs load images correctly
- [ ] Restaurant filter works across all tabs
- [ ] Search filter works
- [ ] Can select images from multiple tabs
- [ ] Selection order is preserved
- [ ] Selection counter updates correctly
- [ ] Min/max validation works
- [ ] Image generation with references succeeds
- [ ] Video generation with all source types succeeds

### Edge Cases

- [ ] Logo image is base64 vs URL
- [ ] Very large selections (e.g., 10 images)
- [ ] Single image selection
- [ ] Mixed portrait/landscape images
- [ ] Restaurant with no logo
- [ ] Empty tabs (no images available)

---

## Backwards Compatibility

### Database

- ✅ New columns are **nullable**, won't break existing records
- ✅ `reference_image_ids` preserved for backwards compatibility
- ✅ Mode migration updates existing records automatically

### API

- ⚠️ **Breaking change**: `referenceImageIds` and `remixImageIds` replaced with `referenceSources`
- ✅ Old API contracts can be supported with adapter if needed:

```javascript
// Legacy adapter (if needed)
if (req.body.referenceImageIds) {
  req.body.referenceSources = req.body.referenceImageIds.map(id => ({
    id,
    sourceType: 'menu' // Assume menu for legacy requests
  }));
}
```

### Frontend

- ⚠️ Component replaced entirely - no backwards compatibility needed
- ✅ Old modes (`image-reference`, `remix`) auto-migrated to `reference-images`

---

## Success Metrics

1. **Functionality**: All 4 image sources can be selected and used together
2. **Reliability**: No errors when mixing source types
3. **UX**: Clear separation of image categories
4. **Performance**: Image loading time < 2 seconds per tab
5. **Data Integrity**: Source metadata correctly stored and retrieved

---

## Rollback Plan

If critical issues arise:

1. **Database**:
   ```sql
   -- Rollback migrations in reverse order
   ALTER TABLE social_media_images DROP COLUMN reference_image_sources;
   ALTER TABLE social_media_videos DROP COLUMN source_image_type;
   -- Restore old mode constraint
   ```

2. **Backend**: Revert to previous commit, redeploy

3. **Frontend**: Revert UI components to previous version

---

## Future Enhancements

1. **Weighted References**: Allow users to specify weight/importance of each reference
2. **Style Transfer**: Apply style from one image to composition of others
3. **Smart Cropping**: Auto-detect and crop focal points before composition
4. **Batch Generation**: Generate multiple variations from same reference set
5. **Reference Presets**: Save common reference combinations

---

**Document Status:** Ready for Review
**Next Step:** Get approval, then begin Phase 1 migrations
