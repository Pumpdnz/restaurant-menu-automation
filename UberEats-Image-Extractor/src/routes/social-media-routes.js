/**
 * Social Media Video Generation API Routes
 *
 * Provides REST API endpoints for AI-powered video generation using:
 * - OpenAI Sora 2: Video generation
 * - Google Gemini 2.5 Flash Image: AI image generation
 * - Supabase: Database and storage
 *
 * Endpoints:
 * - POST   /generate              Create new video generation job
 * - GET    /videos/:id/status     Get job status
 * - POST   /videos/:id/refresh    Manually refresh status from Sora API
 * - GET    /videos                List all videos (with filters)
 * - DELETE /videos/:id            Delete video and assets
 * - GET    /videos/:id            Get full job details
 */

const express = require('express');
const router = express.Router();
const VideoGenerationService = require('../services/social-media/video-generation-service');

/**
 * POST /api/social-media/generate
 *
 * Create a new video generation job
 *
 * Request Body:
 * {
 *   mode: 'image-to-video' | 'text-to-video' | 'generated-image-to-video',
 *   prompt: string (required),
 *   imagePrompt?: string (required for mode 3),
 *   inputSource?: { imageId: string, sourceType: 'menu' | 'ai' | 'uploaded' | 'logo' } (required for mode 1),
 *   restaurantId?: uuid,
 *   menuId?: uuid,
 *   menuItemId?: uuid,
 *   soraModel: 'sora-2' | 'sora-2-pro' (default: 'sora-2'),
 *   videoConfig: {
 *     size: '1280x720' | '1920x1080' | '720x1280' | '1080x1920',
 *     seconds: 4 | 8 | 12
 *   },
 *   geminiConfig?: { aspectRatio: '16:9' | '1:1' | '9:16' | '4:3' | '3:4' },
 *   voiceConfig?: { ... } // Phase 5
 * }
 *
 * Response: 201 Created
 * {
 *   success: true,
 *   job: { id, sora_video_id, status, mode, prompt, created_at }
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const {
      mode,
      prompt,
      imagePrompt,
      inputSource,
      restaurantId,
      menuId,
      menuItemId,
      soraModel = 'sora-2',
      videoConfig = { size: '1280x720', seconds: 8 },
      geminiConfig,
      voiceConfig
    } = req.body;

    // === VALIDATION ===

    // Check required fields
    if (!mode || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'mode and prompt are required'
      });
    }

    // Validate mode
    const validModes = ['image-to-video', 'text-to-video', 'generated-image-to-video'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
      });
    }

    // Mode-specific validation
    if (mode === 'image-to-video') {
      if (!inputSource || !inputSource.imageId) {
        return res.status(400).json({
          success: false,
          error: 'inputSource.imageId is required for image-to-video mode'
        });
      }

      // NEW: Validate source type is provided and valid
      if (!inputSource.sourceType) {
        return res.status(400).json({
          success: false,
          error: 'inputSource.sourceType is required (menu, ai, uploaded, or logo)'
        });
      }

      const validSourceTypes = ['menu', 'ai', 'uploaded', 'logo'];
      if (!validSourceTypes.includes(inputSource.sourceType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid sourceType: ${inputSource.sourceType}. Must be one of: ${validSourceTypes.join(', ')}`
        });
      }
    }

    if (mode === 'generated-image-to-video') {
      if (!imagePrompt) {
        return res.status(400).json({
          success: false,
          error: 'imagePrompt is required for generated-image-to-video mode'
        });
      }
    }

    // Validate soraModel
    if (!['sora-2', 'sora-2-pro'].includes(soraModel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid soraModel. Must be sora-2 or sora-2-pro'
      });
    }

    // Validate videoConfig.size
    const validSizes = ['1280x720', '1920x1080', '720x1280', '1080x1920'];
    if (!validSizes.includes(videoConfig.size)) {
      return res.status(400).json({
        success: false,
        error: `Invalid video size. Must be one of: ${validSizes.join(', ')}`
      });
    }

    // Validate videoConfig.seconds
    if (![4, 8, 12].includes(videoConfig.seconds)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Must be 4, 8, or 12 seconds'
      });
    }

    // === GENERATE VIDEO ===

    console.log('[Social Media API] Starting video generation:', {
      mode,
      soraModel,
      size: videoConfig.size,
      seconds: videoConfig.seconds,
      organisationId: req.user.organisationId,
      userId: req.user.id
    });

    const videoService = new VideoGenerationService();
    const job = await videoService.generateVideo({
      mode,
      prompt,
      imagePrompt,
      inputSource,
      organisationId: req.user.organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId: req.user.id,
      soraModel,
      videoConfig,
      geminiConfig,
      voiceConfig
    });

    console.log('[Social Media API] Video job created:', job.id);

    res.status(201).json({
      success: true,
      job: {
        id: job.id,
        sora_video_id: job.sora_video_id,
        status: job.status,
        mode: job.mode,
        prompt: job.prompt,
        created_at: job.created_at
      }
    });

  } catch (error) {
    console.error('[Social Media API] Generate video error:', error);

    // Check for specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('Content policy')) {
      return res.status(422).json({
        success: false,
        error: error.message,
        code: 'CONTENT_POLICY_VIOLATION'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social-media/videos/:id/status
 *
 * Get current status of a video generation job
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   status: {
 *     id, sora_video_id, status, progress, mode, prompt,
 *     sora_model, video_url, thumbnail_url, error_message,
 *     created_at, updated_at, completed_at
 *   }
 * }
 */
router.get('/videos/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Getting status for job:', id);

    const videoService = new VideoGenerationService();
    const status = await videoService.getJobStatus(id);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Video job not found'
      });
    }

    // Verify user has access (RLS should handle this, but double-check)
    if (status.organisation_id !== req.user.organisationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      status: {
        id: status.id,
        sora_video_id: status.sora_video_id,
        status: status.status,
        progress: status.progress,
        mode: status.mode,
        prompt: status.prompt,
        sora_model: status.sora_model,
        video_url: status.video_url,
        thumbnail_url: status.thumbnail_url,
        error_message: status.error_message,
        created_at: status.created_at,
        updated_at: status.updated_at,
        completed_at: status.completed_at
      }
    });

  } catch (error) {
    console.error('[Social Media API] Get status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social-media/videos/:id/refresh
 *
 * Manually refresh job status from Sora API
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   job: { id, status, progress, updated_at }
 * }
 */
router.post('/videos/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Refreshing status for job:', id);

    const videoService = new VideoGenerationService();
    const job = await videoService.refreshJobStatus(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Video job not found'
      });
    }

    // Verify user has access
    if (job.organisation_id !== req.user.organisationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!job.sora_video_id) {
      return res.status(400).json({
        success: false,
        error: 'No Sora video ID found for this job'
      });
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        updated_at: job.updated_at
      }
    });

  } catch (error) {
    console.error('[Social Media API] Refresh status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social-media/videos
 *
 * List all videos for user's organization with optional filtering
 *
 * Query Parameters:
 * - restaurantId?: uuid
 * - status?: 'queued' | 'in_progress' | 'completed' | 'failed'
 * - mode?: string
 * - limit?: number (default: 50, max: 100)
 * - offset?: number (default: 0)
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   videos: [...],
 *   pagination: { limit, offset, total }
 * }
 */
router.get('/videos', async (req, res) => {
  try {
    const {
      restaurantId,
      status,
      mode,
      limit = 50,
      offset = 0
    } = req.query;

    // Parse and validate limit/offset
    const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100
    const parsedOffset = parseInt(offset) || 0;

    console.log('[Social Media API] Listing videos:', {
      organisationId: req.user.organisationId,
      restaurantId,
      status,
      mode,
      limit: parsedLimit,
      offset: parsedOffset
    });

    const filters = {
      organisationId: req.user.organisationId,
      restaurantId,
      status,
      mode,
      limit: parsedLimit,
      offset: parsedOffset
    };

    const videoService = new VideoGenerationService();
    const result = await videoService.listVideos(filters);

    res.json({
      success: true,
      videos: result.videos,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: result.total
      }
    });

  } catch (error) {
    console.error('[Social Media API] List videos error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/social-media/videos/:id
 *
 * Delete video job and all associated assets (video, thumbnail, generated image)
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   message: 'Video deleted successfully'
 * }
 */
router.delete('/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Deleting video:', id);

    const videoService = new VideoGenerationService();

    // First check if job exists and user has access
    const job = await videoService.getJobStatus(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Video job not found'
      });
    }

    // Verify user has access
    const userOrgId = req.user.organisationId || req.user.organisation?.id;
    console.log('[Social Media API] Delete permission check:', {
      jobOrgId: job.organisation_id,
      userOrgId: userOrgId,
      match: job.organisation_id === userOrgId
    });

    if (job.organisation_id !== userOrgId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this video'
      });
    }

    // Delete the video
    await videoService.deleteVideo(id);

    console.log('[Social Media API] Video deleted:', id);

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });

  } catch (error) {
    console.error('[Social Media API] Delete video error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Video job not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social-media/videos/:id
 *
 * Get complete details of a video job
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   video: { ... full job object ... }
 * }
 */
router.get('/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Getting video details:', id);

    const videoService = new VideoGenerationService();
    const video = await videoService.getJobStatus(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video job not found'
      });
    }

    // Verify user has access
    if (video.organisation_id !== req.user.organisationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      video
    });

  } catch (error) {
    console.error('[Social Media API] Get video error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ==============================================
 * IMAGE GENERATION ENDPOINTS
 * ==============================================
 */

const ImageGenerationService = require('../services/social-media/image-generation-service');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/social-media/images/generate
 *
 * Generate a new AI image
 *
 * Request Body:
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
 *   },
 *   geminiConfig?: { ... }
 * }
 *
 * Response: 201 Created
 * {
 *   success: true,
 *   image: { id, status, image_url, thumbnail_url }
 * }
 */
router.post('/images/generate', async (req, res) => {
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

    // === VALIDATION ===

    // Check required fields
    if (!mode) {
      return res.status(400).json({
        success: false,
        error: 'mode is required'
      });
    }

    // Validate mode - UPDATED to only accept 3 modes
    const validModes = ['uploaded', 'text-to-image', 'reference-images'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
      });
    }

    // Mode-specific validation
    if (mode === 'text-to-image' && !prompt) {
      return res.status(400).json({
        success: false,
        error: 'prompt is required for text-to-image mode'
      });
    }

    if (mode === 'reference-images') {
      // NEW: Validate referenceSources array
      if (!referenceSources || !Array.isArray(referenceSources) || referenceSources.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'referenceSources array is required for reference-images mode (min: 1 image)'
        });
      }

      // Validate each source object
      const validSourceTypes = ['menu', 'ai', 'uploaded', 'logo'];
      for (let i = 0; i < referenceSources.length; i++) {
        const src = referenceSources[i];

        if (!src.id || !src.sourceType) {
          return res.status(400).json({
            success: false,
            error: `referenceSources[${i}] must have both 'id' and 'sourceType' properties`
          });
        }

        if (!validSourceTypes.includes(src.sourceType)) {
          return res.status(400).json({
            success: false,
            error: `referenceSources[${i}].sourceType must be one of: ${validSourceTypes.join(', ')}`
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

    // Validate imageConfig
    if (!imageConfig || !imageConfig.aspectRatio) {
      return res.status(400).json({
        success: false,
        error: 'imageConfig with aspectRatio is required'
      });
    }

    const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
    if (!validAspectRatios.includes(imageConfig.aspectRatio)) {
      return res.status(400).json({
        success: false,
        error: `Invalid aspectRatio. Must be one of: ${validAspectRatios.join(', ')}`
      });
    }

    // === GENERATE IMAGE ===

    console.log('[Social Media API] Starting image generation:', {
      mode,
      aspectRatio: imageConfig.aspectRatio,
      referenceSourcesCount: referenceSources?.length || 0,
      referenceSources: referenceSources?.map(s => s.sourceType) || [],
      organisationId: req.user.organisationId,
      userId: req.user.id
    });

    const imageService = new ImageGenerationService();
    const result = await imageService.generateImage({
      mode,
      prompt,
      referenceSources, // NEW - unified reference sources
      organisationId: req.user.organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId: req.user.id,
      imageConfig,
      geminiConfig
    });

    console.log('[Social Media API] Image generated:', result.id);

    res.status(201).json({
      success: true,
      image: result
    });

  } catch (error) {
    console.error('[Social Media API] Generate image error:', error);

    // Check for specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('Content policy') || error.message.includes('SAFETY')) {
      return res.status(422).json({
        success: false,
        error: error.message,
        code: 'CONTENT_POLICY_VIOLATION'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social-media/images/upload
 *
 * Direct image upload (mode: uploaded)
 *
 * Request: multipart/form-data
 * - image: File (required)
 * - restaurantId?: string
 * - menuId?: string
 * - menuItemId?: string
 * - aspectRatio: string (required)
 *
 * Response: 201 Created
 * {
 *   success: true,
 *   image: { id, status, image_url, thumbnail_url }
 * }
 */
router.post('/images/upload', upload.single('image'), async (req, res) => {
  try {
    const {
      restaurantId,
      menuId,
      menuItemId,
      aspectRatio
    } = req.body;

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'image file is required'
      });
    }

    // Validate aspectRatio
    if (!aspectRatio) {
      return res.status(400).json({
        success: false,
        error: 'aspectRatio is required'
      });
    }

    const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
    if (!validAspectRatios.includes(aspectRatio)) {
      return res.status(400).json({
        success: false,
        error: `Invalid aspectRatio. Must be one of: ${validAspectRatios.join(', ')}`
      });
    }

    console.log('[Social Media API] Uploading image:', {
      filename: req.file.originalname,
      size: req.file.size,
      aspectRatio,
      organisationId: req.user.organisationId
    });

    const imageService = new ImageGenerationService();
    const result = await imageService.generateImage({
      mode: 'uploaded',
      uploadedImageBuffer: req.file.buffer,
      organisationId: req.user.organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId: req.user.id,
      imageConfig: { aspectRatio }
    });

    res.status(201).json({
      success: true,
      image: result
    });

  } catch (error) {
    console.error('[Social Media API] Upload image error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social-media/images
 *
 * List all images for user's organization with optional filtering
 *
 * Query Parameters:
 * - restaurantId?: uuid
 * - status?: 'queued' | 'in_progress' | 'completed' | 'failed'
 * - mode?: string
 * - limit?: number (default: 50, max: 100)
 * - offset?: number (default: 0)
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   images: [...],
 *   pagination: { limit, offset, total }
 * }
 */
router.get('/images', async (req, res) => {
  try {
    const {
      restaurantId,
      status,
      mode,
      limit = 50,
      offset = 0
    } = req.query;

    // Parse and validate limit/offset
    const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100
    const parsedOffset = parseInt(offset) || 0;

    console.log('[Social Media API] Listing images:', {
      organisationId: req.user.organisationId,
      restaurantId,
      status,
      mode,
      limit: parsedLimit,
      offset: parsedOffset
    });

    const filters = {
      organisationId: req.user.organisationId,
      restaurantId,
      status,
      mode,
      limit: parsedLimit,
      offset: parsedOffset
    };

    const imageService = new ImageGenerationService();
    const result = await imageService.listImages(filters);

    res.json({
      success: true,
      images: result.images,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('[Social Media API] List images error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social-media/images/:id/status
 *
 * Get current status of an image generation job
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   status: { id, status, mode, prompt, image_url, thumbnail_url, ... }
 * }
 */
router.get('/images/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Getting status for image:', id);

    const imageService = new ImageGenerationService();
    const status = await imageService.getJobStatus(id);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Image job not found'
      });
    }

    // Verify user has access (RLS should handle this, but double-check)
    if (status.organisation_id !== req.user.organisationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('[Social Media API] Get image status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social-media/images/:id
 *
 * Get complete details of an image job
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   image: { ... full job object ... }
 * }
 */
router.get('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Getting image details:', id);

    const imageService = new ImageGenerationService();
    const image = await imageService.getJobStatus(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image job not found'
      });
    }

    // Verify user has access
    if (image.organisation_id !== req.user.organisationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      image
    });

  } catch (error) {
    console.error('[Social Media API] Get image error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social-media/images/:id/refresh
 *
 * Manually refresh image status (for consistency with video API)
 * Note: Images are generated synchronously, so this is mainly for future-proofing
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   image: { id, status, updated_at }
 * }
 */
router.post('/images/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Refreshing image status:', id);

    const imageService = new ImageGenerationService();
    const image = await imageService.getJobStatus(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image job not found'
      });
    }

    // Verify user has access
    if (image.organisation_id !== req.user.organisationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      image: {
        id: image.id,
        status: image.status,
        updated_at: image.updated_at
      }
    });

  } catch (error) {
    console.error('[Social Media API] Refresh image error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/social-media/images/:id
 *
 * Delete image job and all associated assets
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   message: 'Image deleted successfully'
 * }
 */
router.delete('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[Social Media API] Deleting image:', id);

    const imageService = new ImageGenerationService();

    // First check if job exists and user has access
    const job = await imageService.getJobStatus(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Image job not found'
      });
    }

    // Verify user has access
    const userOrgId = req.user.organisationId || req.user.organisation?.id;
    if (job.organisation_id !== userOrgId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this image'
      });
    }

    // Delete the image
    await imageService.deleteImage(id);

    console.log('[Social Media API] Image deleted:', id);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('[Social Media API] Delete image error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Image job not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
