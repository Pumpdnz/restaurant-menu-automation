/**
 * Image Generation Service - Standalone AI Image Generation
 *
 * Orchestrates standalone image generation with 3 modes:
 * - uploaded: Direct image upload
 * - text-to-image: Generate from text using Gemini
 * - reference-images: Use 1+ images from any source (menu, AI, uploaded, logos)
 *
 * Supports multi-image composition using Gemini's blending capabilities
 * with unified image source handling.
 */

const GeminiImageService = require('./gemini-image-service');
const SocialStorageService = require('./social-storage-service');
const ImageFetcherService = require('./image-fetcher-service');
const db = require('../database-service');
const sharp = require('sharp');
const axios = require('axios');

class ImageGenerationService {
  constructor() {
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.imageFetcher = new ImageFetcherService();
  }

  /**
   * Main entry point for image generation
   *
   * @param {Object} request - Generation request
   * @param {string} request.mode - Generation mode (uploaded, text-to-image, reference-images)
   * @param {string} [request.prompt] - Text prompt (required for text-to-image, reference-images)
   * @param {Array<Object>} [request.referenceSources] - Image sources [{ id, sourceType }] (reference-images mode)
   * @param {Buffer} [request.uploadedImageBuffer] - Direct upload buffer (uploaded mode)
   * @param {string} request.organisationId - Organization ID
   * @param {string} [request.restaurantId] - Restaurant ID
   * @param {string} [request.menuId] - Menu ID
   * @param {string} [request.menuItemId] - Menu item ID
   * @param {string} request.userId - User ID
   * @param {Object} request.imageConfig - Image configuration
   * @param {string} request.imageConfig.aspectRatio - Aspect ratio (16:9, 9:16, 1:1, etc.)
   * @returns {Promise<Object>} - Created job object
   */
  async generateImage(request) {
    console.log('[ImageGenerationService] Starting image generation:', {
      mode: request.mode,
      hasPrompt: !!request.prompt,
      referenceCount: request.referenceSources?.length || 0
    });

    // Validate request
    this.validateRequest(request);

    // Create initial job record (status: queued)
    const job = await this.createJob(request);

    try {
      let imageBuffer;
      let imageMetadata;

      // Handle mode-specific generation
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

        case 'reference-images':
          const refResult = await this.handleReferenceImages(
            request.referenceSources,
            request.prompt,
            request.imageConfig
          );
          imageBuffer = refResult.buffer;
          imageMetadata = refResult.metadata;
          break;
      }

      // Update job to in_progress
      await this.updateJob(job.id, { status: 'in_progress', progress: 50 });

      // Upload to Supabase Storage
      const imageUrl = await this.storageService.uploadGeneratedImage(imageBuffer, job.id);
      const thumbnailUrl = await this.createAndUploadThumbnail(imageBuffer, job.id);

      // Update job with final data
      await this.updateJob(job.id, {
        status: 'completed',
        progress: 100,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        width: imageMetadata.width,
        height: imageMetadata.height,
        file_size: imageBuffer.length,
        completed_at: new Date().toISOString()
      });

      console.log('[ImageGenerationService] Image generation completed:', {
        jobId: job.id,
        imageUrl,
        size: `${imageMetadata.width}x${imageMetadata.height}`
      });

      return {
        id: job.id,
        status: 'completed',
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl
      };

    } catch (error) {
      console.error('[ImageGenerationService] Generation failed:', error);

      // Update job with error
      await this.updateJob(job.id, {
        status: 'failed',
        error_message: error.message,
        retry_count: (job.retry_count || 0) + 1
      });

      throw error;
    }
  }

  /**
   * Validate generation request
   */
  validateRequest(request) {
    const { mode, prompt, referenceSources, uploadedImageBuffer, imageConfig } = request;

    if (!mode || !['uploaded', 'text-to-image', 'reference-images'].includes(mode)) {
      throw new Error('Invalid mode. Must be one of: uploaded, text-to-image, reference-images');
    }

    if (!imageConfig || !imageConfig.aspectRatio) {
      throw new Error('imageConfig with aspectRatio is required');
    }

    // Mode-specific validation
    switch (mode) {
      case 'uploaded':
        if (!uploadedImageBuffer) {
          throw new Error('uploadedImageBuffer is required for uploaded mode');
        }
        break;

      case 'text-to-image':
        if (!prompt) {
          throw new Error('prompt is required for text-to-image mode');
        }
        break;

      case 'reference-images':
        if (!referenceSources || !Array.isArray(referenceSources) || referenceSources.length === 0) {
          throw new Error('referenceSources array is required for reference-images mode');
        }

        // Validate source structure using ImageFetcherService
        try {
          this.imageFetcher.validateSources(referenceSources);
        } catch (error) {
          throw new Error(`Invalid referenceSources: ${error.message}`);
        }

        if (!prompt) {
          throw new Error('prompt is required for reference-images mode');
        }
        break;
    }
  }

  /**
   * Handle text-to-image generation
   */
  async handleTextToImage(prompt, imageConfig) {
    console.log('[ImageGenerationService] Generating image from text...');

    const result = await this.geminiService.generateImage(prompt, {
      aspectRatio: imageConfig.aspectRatio
    });

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

  /**
   * Handle unified reference-images mode (multi-image composition)
   * Uses 1 or more images from ANY source (menu, AI, uploaded, logos)
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
    const referenceImages = await this.imageFetcher.fetchMultipleImages(referenceSources);

    console.log('[ImageGenerationService] All reference images fetched:', {
      count: referenceImages.length
    });

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

  /**
   * Process uploaded image
   */
  async processUploadedImage(imageBuffer, jobId) {
    console.log('[ImageGenerationService] Processing uploaded image...');

    // Validate image
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image: unable to read dimensions');
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    };
  }

  /**
   * Generate image using Gemini with multiple reference images
   * This leverages Gemini's multi-image composition capability
   */
  async generateWithMultipleReferences(referenceImages, prompt, aspectRatio) {
    console.log('[ImageGenerationService] Using multi-image composition with Gemini');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    try {
      // Prepare content parts: reference images + text prompt
      const parts = [];

      // Add all reference images as inline data
      for (const refImage of referenceImages) {
        const base64Data = refImage.buffer.toString('base64');
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data
          }
        });
      }

      // Add enhanced prompt with composition instructions (aspect ratio in config)
      const enhancedPrompt = this.buildCompositionPrompt(prompt, aspectRatio, referenceImages.length);
      parts.push({
        text: enhancedPrompt
      });

      // Generate composed image with proper aspect ratio configuration
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: parts
          }
        ],
        generationConfig: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });
      const response = await result.response;

      // Extract generated image
      const imagePart = response.candidates[0]?.content.parts.find(
        part => part.inlineData
      );

      if (!imagePart) {
        throw new Error('No image generated in multi-image composition');
      }

      const imageData = imagePart.inlineData;
      const buffer = Buffer.from(imageData.data, 'base64');

      console.log('[ImageGenerationService] Multi-image composition successful:', {
        inputImages: referenceImages.length,
        outputSize: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      return {
        buffer,
        mimeType: imageData.mimeType
      };

    } catch (error) {
      console.error('[ImageGenerationService] Multi-image composition error:', error);
      throw new Error(`Gemini multi-image composition failed: ${error.message}`);
    }
  }

  /**
   * Build enhanced prompt for multi-image composition
   * (Aspect ratio is now handled via API config, not prompt text)
   */
  buildCompositionPrompt(userPrompt, aspectRatio, imageCount) {
    const parts = [userPrompt];

    // Add composition instructions
    if (imageCount === 1) {
      parts.push('Use the provided image as inspiration and reference.');
    } else {
      parts.push(`Blend elements from all ${imageCount} reference images to create a cohesive composition.`);
    }

    // Add quality hints
    parts.push('High quality, professional photography style.');

    return parts.join(' ');
  }

  // NOTE: fetchMenuItemImage() and fetchGeneratedImage() methods removed
  // All image fetching now handled by ImageFetcherService

  /**
   * Create and upload thumbnail
   */
  async createAndUploadThumbnail(imageBuffer, jobId) {
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    return await this.storageService.uploadImageThumbnail(thumbnailBuffer, jobId);
  }

  /**
   * Create job record in database
   */
  async createJob(request) {
    const {
      mode,
      prompt,
      referenceSources,
      organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId,
      imageConfig,
      geminiConfig
    } = request;

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
        reference_image_sources: referenceSources || null, // NEW - full source metadata
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

  /**
   * Update job record
   */
  async updateJob(jobId, updates) {
    const { error } = await this.storageService.supabase
      .from('social_media_images')
      .update(updates)
      .eq('id', jobId);

    if (error) {
      console.error('[ImageGenerationService] Failed to update job:', error);
      throw new Error(`Failed to update job: ${error.message}`);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    const { data: job, error } = await this.storageService.supabase
      .from('social_media_images')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return job;
  }

  /**
   * List images with filters
   */
  async listImages(filters = {}) {
    const {
      organisationId,
      restaurantId,
      status,
      mode,
      limit = 50,
      offset = 0
    } = filters;

    let query = this.storageService.supabase
      .from('social_media_images')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (organisationId) {
      query = query.eq('organisation_id', organisationId);
    }

    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (mode) {
      query = query.eq('mode', mode);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: images, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list images: ${error.message}`);
    }

    return {
      images: images || [],
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    };
  }

  /**
   * Delete image and associated storage
   */
  async deleteImage(jobId) {
    // Get job to find storage paths
    const job = await this.getJobStatus(jobId);

    // Delete from database
    const { error } = await this.storageService.supabase
      .from('social_media_images')
      .delete()
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }

    // Delete from storage (best effort, don't fail if missing)
    try {
      if (job.image_url) {
        await this.storageService.deleteImageAsset(jobId, 'image');
      }
      if (job.thumbnail_url) {
        await this.storageService.deleteImageAsset(jobId, 'thumbnail');
      }
    } catch (err) {
      console.warn('[ImageGenerationService] Failed to delete storage assets:', err.message);
    }

    return { success: true };
  }
}

module.exports = ImageGenerationService;
