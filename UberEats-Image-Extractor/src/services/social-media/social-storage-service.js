/**
 * Social Storage Service - Database and Supabase Storage Operations
 *
 * Handles all database and storage operations for social media videos:
 * - CRUD operations on social_media_videos table
 * - Upload/download from Supabase Storage
 * - Fetch menu item images
 * - Storage cleanup operations
 */

const db = require('../database-service');

class SocialStorageService {
  constructor() {
    // Initialize database if not already initialized
    if (!db.supabase) {
      console.log('[SocialStorageService] Initializing database...');
      db.initializeDatabase();
    }

    this.supabase = db.supabase;

    if (!this.supabase) {
      throw new Error('Failed to initialize Supabase client. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    }
  }

  /**
   * Create a new video generation job record
   *
   * @param {Object} data - Job data
   * @returns {Promise<Object>} - Created job record
   */
  async createJob(data) {
    const {
      mode,
      prompt,
      imagePrompt,
      organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId,
      soraModel,
      videoConfig,
      geminiConfig,
      sourceImageId,
      sourceImageUrl,
      status = 'queued'
    } = data;

    try {
      console.log('[SocialStorageService] Creating job record:', {
        mode,
        organisationId,
        userId
      });

      const { data: job, error } = await this.supabase
        .from('social_media_videos')
        .insert({
          organisation_id: organisationId,
          restaurant_id: restaurantId,
          menu_id: menuId,
          menu_item_id: menuItemId,
          mode,
          prompt,
          image_prompt: imagePrompt,
          source_image_id: sourceImageId,
          source_image_url: sourceImageUrl,
          sora_model: soraModel,
          status,
          video_config: videoConfig,
          gemini_config: geminiConfig,
          created_by: userId
        })
        .select()
        .single();

      if (error) {
        console.error('[SocialStorageService] Error creating job:', error);
        throw new Error(`Failed to create job: ${error.message}`);
      }

      console.log('[SocialStorageService] Job created:', job.id);
      return job;

    } catch (error) {
      console.error('[SocialStorageService] Error in createJob:', error);
      throw error;
    }
  }

  /**
   * Update a video generation job
   *
   * @param {string} jobId - Job ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated job record
   */
  async updateJob(jobId, updates) {
    try {
      console.log('[SocialStorageService] Updating job:', {
        jobId,
        updates: Object.keys(updates)
      });

      const { data: job, error } = await this.supabase
        .from('social_media_videos')
        .update(updates)
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        console.error('[SocialStorageService] Error updating job:', error);
        throw new Error(`Failed to update job: ${error.message}`);
      }

      console.log('[SocialStorageService] Job updated:', jobId);
      return job;

    } catch (error) {
      console.error('[SocialStorageService] Error in updateJob:', error);
      throw error;
    }
  }

  /**
   * Get a video generation job by ID
   *
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Job record
   */
  async getJob(jobId) {
    try {
      console.log('[SocialStorageService] Fetching job:', jobId);

      const { data: job, error } = await this.supabase
        .from('social_media_videos')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('[SocialStorageService] Error fetching job:', error);
        throw new Error(`Failed to fetch job: ${error.message}`);
      }

      return job;

    } catch (error) {
      console.error('[SocialStorageService] Error in getJob:', error);
      throw error;
    }
  }

  /**
   * List video generation jobs with filtering
   *
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Array of job records
   */
  async listJobs(filters = {}) {
    try {
      const {
        organisationId,
        restaurantId,
        status,
        mode,
        limit = 50,
        offset = 0
      } = filters;

      console.log('[SocialStorageService] Listing jobs with filters:', filters);

      let query = this.supabase
        .from('social_media_videos')
        .select('*')
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

      const { data: jobs, error } = await query;

      if (error) {
        console.error('[SocialStorageService] Error listing jobs:', error);
        throw new Error(`Failed to list jobs: ${error.message}`);
      }

      console.log('[SocialStorageService] Found jobs:', jobs.length);
      return jobs;

    } catch (error) {
      console.error('[SocialStorageService] Error in listJobs:', error);
      throw error;
    }
  }

  /**
   * Delete a video generation job
   *
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async deleteJob(jobId) {
    try {
      console.log('[SocialStorageService] Deleting job:', jobId);

      const { error } = await this.supabase
        .from('social_media_videos')
        .delete()
        .eq('id', jobId);

      if (error) {
        console.error('[SocialStorageService] Error deleting job:', error);
        throw new Error(`Failed to delete job: ${error.message}`);
      }

      console.log('[SocialStorageService] Job deleted:', jobId);

    } catch (error) {
      console.error('[SocialStorageService] Error in deleteJob:', error);
      throw error;
    }
  }

  /**
   * Upload a video file to Supabase Storage
   *
   * @param {Buffer} buffer - Video file buffer
   * @param {string} jobId - Job ID
   * @param {string} [variant] - Optional variant ('final' for voice-over videos)
   * @returns {Promise<string>} - Public URL of uploaded video
   */
  async uploadVideo(buffer, jobId, variant = null) {
    try {
      const job = await this.getJob(jobId);
      const orgId = job.organisation_id;

      const filename = variant ? `${jobId}-${variant}.mp4` : `${jobId}.mp4`;
      const path = `${orgId}/videos/${filename}`;

      console.log('[SocialStorageService] Uploading video:', {
        jobId,
        path,
        size: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`
      });

      const { error } = await this.supabase.storage
        .from('social-media-videos')
        .upload(path, buffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[SocialStorageService] Error uploading video:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('social-media-videos')
        .getPublicUrl(path);

      console.log('[SocialStorageService] Video uploaded:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('[SocialStorageService] Error in uploadVideo:', error);
      throw error;
    }
  }

  /**
   * Upload a thumbnail image to Supabase Storage
   *
   * @param {Buffer} buffer - Thumbnail image buffer
   * @param {string} jobId - Job ID
   * @returns {Promise<string>} - Public URL of uploaded thumbnail
   */
  async uploadThumbnail(buffer, jobId) {
    try {
      const job = await this.getJob(jobId);
      const orgId = job.organisation_id;

      const path = `${orgId}/thumbnails/${jobId}.webp`;

      console.log('[SocialStorageService] Uploading thumbnail:', {
        jobId,
        path,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      const { error } = await this.supabase.storage
        .from('social-media-videos')
        .upload(path, buffer, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[SocialStorageService] Error uploading thumbnail:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('social-media-videos')
        .getPublicUrl(path);

      console.log('[SocialStorageService] Thumbnail uploaded:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('[SocialStorageService] Error in uploadThumbnail:', error);
      throw error;
    }
  }

  /**
   * Upload a generated image to Supabase Storage
   *
   * @param {Buffer} buffer - Image buffer
   * @param {string} jobId - Job ID
   * @returns {Promise<string>} - Public URL of uploaded image
   */
  async uploadGeneratedImage(buffer, jobId) {
    try {
      // Try to fetch from social_media_images table first (for standalone images)
      let { data: job, error: fetchError } = await this.supabase
        .from('social_media_images')
        .select('organisation_id')
        .eq('id', jobId)
        .single();

      // If not found, try social_media_videos table (for generated-image-to-video mode)
      if (fetchError) {
        const videoJob = await this.getJob(jobId);
        job = videoJob;
      }

      if (!job) {
        throw new Error('Job not found in either social_media_images or social_media_videos');
      }

      const orgId = job.organisation_id;
      const path = `${orgId}/generated-images/${jobId}.png`;

      console.log('[SocialStorageService] Uploading generated image:', {
        jobId,
        path,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      const { error } = await this.supabase.storage
        .from('social-media-videos')
        .upload(path, buffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[SocialStorageService] Error uploading generated image:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('social-media-videos')
        .getPublicUrl(path);

      console.log('[SocialStorageService] Generated image uploaded:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('[SocialStorageService] Error in uploadGeneratedImage:', error);
      throw error;
    }
  }

  /**
   * Get a menu item image from the database
   *
   * @param {string} imageId - Menu item image ID
   * @returns {Promise<Object>} - Image metadata
   */
  async getMenuItemImage(imageId) {
    try {
      console.log('[SocialStorageService] Fetching menu item image:', imageId);

      const { data: image, error } = await this.supabase
        .from('item_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (error) {
        console.error('[SocialStorageService] Error fetching image:', error);
        throw new Error(`Image not found: ${error.message}`);
      }

      console.log('[SocialStorageService] Image found:', {
        id: image.id,
        url: image.url || image.cdn_url
      });

      return {
        id: image.id,
        url: image.cdn_url || image.url,
        local_path: image.local_path,
        width: image.width,
        height: image.height
      };

    } catch (error) {
      console.error('[SocialStorageService] Error in getMenuItemImage:', error);
      throw error;
    }
  }

  /**
   * Get a social media image (uploaded or AI-generated) from the database
   *
   * @param {string} imageId - Social media image ID
   * @returns {Promise<Object>} - Image metadata
   */
  async getSocialMediaImage(imageId) {
    try {
      console.log('[SocialStorageService] Fetching social media image:', imageId);

      const { data: image, error } = await this.supabase
        .from('social_media_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (error) {
        console.error('[SocialStorageService] Error fetching social media image:', error);
        throw new Error(`Social media image not found: ${error.message}`);
      }

      console.log('[SocialStorageService] Social media image found:', {
        id: image.id,
        url: image.image_url
      });

      return {
        id: image.id,
        url: image.image_url,
        width: image.width,
        height: image.height,
        mode: image.mode
      };

    } catch (error) {
      console.error('[SocialStorageService] Error in getSocialMediaImage:', error);
      throw error;
    }
  }

  /**
   * Get an image from either menu items or social media images table
   * Tries social_media_images first, then falls back to item_images
   *
   * @param {string} imageId - Image ID
   * @param {string} [sourceType] - Optional source hint ('menu', 'ai', 'logo')
   * @returns {Promise<Object>} - Image metadata
   */
  async getImageFromAnySource(imageId, sourceType = null) {
    try {
      console.log('[SocialStorageService] Fetching image from any source:', { imageId, sourceType });

      // If source type is explicitly menu, go straight to menu images
      if (sourceType === 'menu') {
        return await this.getMenuItemImage(imageId);
      }

      // If source type is AI or unknown, try social media images first
      if (sourceType === 'ai' || !sourceType) {
        try {
          return await this.getSocialMediaImage(imageId);
        } catch (error) {
          // If not found in social media images and no explicit source type, try menu images
          if (!sourceType) {
            console.log('[SocialStorageService] Not found in social_media_images, trying item_images...');
            return await this.getMenuItemImage(imageId);
          }
          throw error;
        }
      }

      // For logo source type, the image ID is actually a restaurant ID
      if (sourceType === 'logo') {
        const { data: restaurant, error } = await this.supabase
          .from('restaurants')
          .select('id, name, logo_url')
          .eq('id', imageId)
          .single();

        if (error) {
          throw new Error(`Restaurant logo not found: ${error.message}`);
        }

        return {
          id: restaurant.id,
          url: restaurant.logo_url,
          name: restaurant.name
        };
      }

      throw new Error(`Invalid source type: ${sourceType}`);

    } catch (error) {
      console.error('[SocialStorageService] Error in getImageFromAnySource:', error);
      throw error;
    }
  }

  /**
   * Upload an image thumbnail to Supabase Storage
   *
   * @param {Buffer} buffer - Thumbnail image buffer
   * @param {string} jobId - Job ID
   * @returns {Promise<string>} - Public URL of uploaded thumbnail
   */
  async uploadImageThumbnail(buffer, jobId) {
    try {
      // For images, we need to fetch from social_media_images table
      const { data: job, error: fetchError } = await this.supabase
        .from('social_media_images')
        .select('organisation_id')
        .eq('id', jobId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch image job: ${fetchError.message}`);
      }

      const orgId = job.organisation_id;
      const path = `${orgId}/image-thumbnails/${jobId}.webp`;

      console.log('[SocialStorageService] Uploading image thumbnail:', {
        jobId,
        path,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      const { error } = await this.supabase.storage
        .from('social-media-videos')
        .upload(path, buffer, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[SocialStorageService] Error uploading image thumbnail:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('social-media-videos')
        .getPublicUrl(path);

      console.log('[SocialStorageService] Image thumbnail uploaded:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('[SocialStorageService] Error in uploadImageThumbnail:', error);
      throw error;
    }
  }

  /**
   * Delete a specific image asset
   *
   * @param {string} jobId - Job ID
   * @param {string} assetType - Asset type ('image' or 'thumbnail')
   * @returns {Promise<void>}
   */
  async deleteImageAsset(jobId, assetType) {
    try {
      console.log('[SocialStorageService] Deleting image asset:', { jobId, assetType });

      const { data: job, error: fetchError } = await this.supabase
        .from('social_media_images')
        .select('organisation_id')
        .eq('id', jobId)
        .single();

      if (fetchError) {
        console.warn('[SocialStorageService] Could not fetch job for deletion:', fetchError.message);
        return;
      }

      const orgId = job.organisation_id;
      let path;

      switch (assetType) {
        case 'image':
          path = `${orgId}/generated-images/${jobId}.png`;
          break;
        case 'thumbnail':
          path = `${orgId}/image-thumbnails/${jobId}.webp`;
          break;
        default:
          throw new Error(`Unknown asset type: ${assetType}`);
      }

      const { error } = await this.supabase.storage
        .from('social-media-videos')
        .remove([path]);

      if (error) {
        console.warn('[SocialStorageService] Asset may not exist:', error.message);
      }

      console.log('[SocialStorageService] Image asset deleted:', path);

    } catch (error) {
      console.error('[SocialStorageService] Error in deleteImageAsset:', error);
      throw error;
    }
  }

  /**
   * Delete all storage assets for a job
   *
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async deleteJobAssets(jobId) {
    try {
      console.log('[SocialStorageService] Deleting job assets:', jobId);

      const job = await this.getJob(jobId);
      const orgId = job.organisation_id;

      // Delete all possible files
      const filesToDelete = [
        `${orgId}/videos/${jobId}.mp4`,
        `${orgId}/videos/${jobId}-final.mp4`,
        `${orgId}/thumbnails/${jobId}.webp`,
        `${orgId}/generated-images/${jobId}.png`,
        `${orgId}/audio/${jobId}.mp3`
      ];

      console.log('[SocialStorageService] Deleting files:', filesToDelete);

      const { error } = await this.supabase.storage
        .from('social-media-videos')
        .remove(filesToDelete);

      if (error) {
        console.warn('[SocialStorageService] Some files may not exist:', error.message);
      }

      console.log('[SocialStorageService] Job assets deleted:', jobId);

    } catch (error) {
      console.error('[SocialStorageService] Error in deleteJobAssets:', error);
      throw error;
    }
  }
}

module.exports = SocialStorageService;
