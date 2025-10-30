/**
 * Video Generation Service - Main Orchestrator
 *
 * Coordinates all services to handle video generation workflows:
 * - Mode 1: Database Image → Video
 * - Mode 2: Text → Video
 * - Mode 3: Generated Image → Video
 * - Manages async job lifecycle with polling
 * - Handles errors and retries
 */

const SoraService = require('./sora-service');
const GeminiImageService = require('./gemini-image-service');
const SocialStorageService = require('./social-storage-service');
const ImageFetcherService = require('./image-fetcher-service');
const axios = require('axios');
const sharp = require('sharp');

// Polling configuration
const POLL_INTERVAL = 10000;  // 10 seconds
const MAX_POLLS = 360;         // 1 hour timeout

class VideoGenerationService {
  constructor() {
    this.soraService = new SoraService();
    this.geminiService = new GeminiImageService();
    this.storageService = new SocialStorageService();
    this.imageFetcher = new ImageFetcherService();

    // Track active polling jobs
    this.activePolls = new Map();
  }

  /**
   * Resize an image to exact video dimensions required by Sora
   * Supports both landscape and portrait orientations
   *
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {number} targetWidth - Target width in pixels
   * @param {number} targetHeight - Target height in pixels
   * @returns {Promise<Buffer>} - Resized image buffer
   */
  async resizeImageForVideo(imageBuffer, targetWidth, targetHeight) {
    try {
      console.log('[VideoGenerationService] Resizing image for video:', {
        targetSize: `${targetWidth}x${targetHeight}`,
        orientation: targetHeight > targetWidth ? 'portrait' : 'landscape'
      });

      // Convert to JPEG for better compatibility with Sora and smaller file size
      const resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'cover',      // Crop to fill exact dimensions
          position: 'center' // Center crop to preserve main subject
        })
        .jpeg({
          quality: 90,       // High quality but compressed
          chromaSubsampling: '4:4:4'  // Best quality color sampling
        })
        .toBuffer();

      console.log('[VideoGenerationService] Image resized successfully:', {
        originalSize: `${(imageBuffer.length / 1024).toFixed(2)} KB`,
        resizedSize: `${(resizedBuffer.length / 1024).toFixed(2)} KB`,
        dimensions: `${targetWidth}x${targetHeight}`,
        format: 'JPEG'
      });

      return resizedBuffer;

    } catch (error) {
      console.error('[VideoGenerationService] Error resizing image:', error);
      throw new Error(`Image resize failed: ${error.message}`);
    }
  }

  /**
   * Generate a video - Main entry point
   *
   * @param {Object} request - Video generation request
   * @returns {Promise<Object>} - Job details
   */
  async generateVideo(request) {
    const {
      mode,
      prompt,
      imagePrompt,
      inputSource,
      organisationId,
      restaurantId,
      menuId,
      menuItemId,
      userId,
      soraModel = 'sora-2',
      videoConfig = { size: '1280x720', seconds: 8 }
    } = request;

    try {
      console.log('[VideoGenerationService] Starting video generation:', {
        mode,
        organisationId,
        userId
      });

      // 1. Create initial job record (status: queued)
      const job = await this.storageService.createJob({
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
        geminiConfig: mode === 'generated-image-to-video' ? { aspectRatio: '16:9' } : null,
        sourceImageId: inputSource?.imageId,
        status: 'queued'
      });

      // 2. Handle mode-specific input preparation
      let inputReference = null;

      switch (mode) {
        case 'image-to-video':
          inputReference = await this.handleMode1(inputSource, job.id, videoConfig);
          break;

        case 'text-to-video':
          // No input reference needed
          console.log('[VideoGenerationService] Mode 2: Text-only video generation');
          break;

        case 'generated-image-to-video':
          inputReference = await this.handleMode3(imagePrompt, job.id, videoConfig);
          break;

        default:
          throw new Error(`Invalid mode: ${mode}`);
      }

      // 3. Create Sora video generation job
      console.log('[VideoGenerationService] Creating Sora video job...');

      const soraJob = await this.soraService.createVideo({
        model: soraModel,
        prompt,
        inputReference,
        size: videoConfig.size,
        seconds: videoConfig.seconds
      });

      // 4. Update job with Sora video ID
      await this.storageService.updateJob(job.id, {
        sora_video_id: soraJob.id,
        status: soraJob.status,
        progress: soraJob.progress || 0
      });

      // 5. Start background polling
      this.pollJobCompletion(job.id, soraJob.id);

      console.log('[VideoGenerationService] Video generation started:', {
        jobId: job.id,
        soraVideoId: soraJob.id,
        status: soraJob.status
      });

      return {
        id: job.id,
        sora_video_id: soraJob.id,
        status: soraJob.status,
        progress: soraJob.progress || 0
      };

    } catch (error) {
      console.error('[VideoGenerationService] Error in generateVideo:', error);

      // Try to update job with error if it was created
      if (request.jobId) {
        await this.storageService.updateJob(request.jobId, {
          status: 'failed',
          error_message: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Mode 1: Handle database image input with explicit source type
   * Supports menu images, AI-generated images, uploaded images, and restaurant logos
   *
   * @param {Object} inputSource - Source configuration { imageId, sourceType }
   * @param {string} jobId - Job ID for error tracking
   * @param {Object} videoConfig - Video configuration with size
   * @returns {Promise<Buffer>} - Resized image buffer
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

      console.log('[VideoGenerationService] Image fetched:', {
        id: image.id,
        url: image.url,
        sourceType: image.sourceType
      });

      // Update job with source metadata
      await this.storageService.updateJob(jobId, {
        source_image_id: inputSource.imageId,
        source_image_url: image.url,
        source_image_type: inputSource.sourceType // NEW - track source type
      });

      // Parse target dimensions from videoConfig
      const [targetWidth, targetHeight] = videoConfig.size.split('x').map(Number);

      // Resize image to exact video dimensions
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

  /**
   * Mode 3: Handle generated image input
   *
   * @param {string} imagePrompt - Text prompt for image generation
   * @param {string} jobId - Job ID for tracking
   * @param {Object} videoConfig - Video configuration with size
   * @returns {Promise<Buffer>} - Generated and resized image buffer
   */
  async handleMode3(imagePrompt, jobId, videoConfig) {
    try {
      console.log('[VideoGenerationService] Mode 3: Generating image with Gemini...');

      if (!imagePrompt) {
        throw new Error('Image prompt required for Mode 3');
      }

      // Parse video dimensions and determine aspect ratio
      const [targetWidth, targetHeight] = videoConfig.size.split('x').map(Number);
      const isPortrait = targetHeight > targetWidth;
      const aspectRatio = isPortrait ? '9:16' : '16:9';

      console.log('[VideoGenerationService] Target video configuration:', {
        size: videoConfig.size,
        dimensions: `${targetWidth}x${targetHeight}`,
        aspectRatio,
        orientation: isPortrait ? 'portrait' : 'landscape'
      });

      // Generate image with Gemini using correct aspect ratio
      const image = await this.geminiService.generateImage(imagePrompt, {
        aspectRatio
      });

      // Validate image
      this.geminiService.validateImage(image.buffer);

      // Resize image to exact video dimensions required by Sora
      const resizedBuffer = await this.resizeImageForVideo(
        image.buffer,
        targetWidth,
        targetHeight
      );

      // Upload RESIZED image to storage
      const imageUrl = await this.storageService.uploadGeneratedImage(
        resizedBuffer,
        jobId
      );

      // Update job with generated image URL
      await this.storageService.updateJob(jobId, {
        generated_image_url: imageUrl
      });

      console.log('[VideoGenerationService] Image generated, resized, and uploaded:', imageUrl);

      return resizedBuffer;

    } catch (error) {
      console.error('[VideoGenerationService] Error in handleMode3:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Poll a Sora job until completion
   *
   * @param {string} jobId - Database job ID
   * @param {string} soraVideoId - Sora video ID
   */
  async pollJobCompletion(jobId, soraVideoId) {
    let polls = 0;

    // Mark as active
    this.activePolls.set(jobId, true);

    const poll = async () => {
      // Check if polling should stop
      if (!this.activePolls.get(jobId)) {
        console.log('[VideoGenerationService] Polling stopped for job:', jobId);
        return;
      }

      if (polls >= MAX_POLLS) {
        console.error('[VideoGenerationService] Polling timeout for job:', jobId);
        await this.storageService.updateJob(jobId, {
          status: 'failed',
          error_message: 'Timeout: Video generation took too long (1 hour)'
        });
        this.activePolls.delete(jobId);
        return;
      }

      polls++;

      try {
        // Check status from Sora API
        console.log(`[VideoGenerationService] Poll ${polls}/${MAX_POLLS} for job:`, jobId);

        const status = await this.soraService.checkStatus(soraVideoId);

        // Update progress in database
        await this.storageService.updateJob(jobId, {
          status: status.status,
          progress: status.progress || 0
        });

        if (status.status === 'completed') {
          console.log('[VideoGenerationService] Video completed, downloading assets...');

          // Download video and thumbnail
          const videoBuffer = await this.soraService.downloadVideo(soraVideoId);
          const thumbnailBuffer = await this.soraService.downloadThumbnail(soraVideoId);

          // Upload to Supabase Storage
          const videoUrl = await this.storageService.uploadVideo(videoBuffer, jobId);
          const thumbnailUrl = await this.storageService.uploadThumbnail(thumbnailBuffer, jobId);

          // Update job with URLs, status, and completion time
          await this.storageService.updateJob(jobId, {
            status: 'completed',
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            completed_at: new Date().toISOString()
          });

          console.log('[VideoGenerationService] Video generation completed:', {
            jobId,
            videoUrl,
            thumbnailUrl
          });

          // Stop polling
          this.activePolls.delete(jobId);
          return;

        } else if (status.status === 'failed') {
          // Log full error details for debugging
          console.error('[VideoGenerationService] Video generation failed:', {
            code: status.error?.code,
            message: status.error?.message,
            type: status.error?.type
          });

          // Create user-friendly error message
          let errorMessage = status.error?.message || 'Video generation failed';
          if (status.error?.code === 'moderation_blocked') {
            errorMessage = `Moderation blocked: ${status.error.message}. This may be due to the prompt content or the input image. Try rephrasing your prompt or using a different image.`;
          }

          await this.storageService.updateJob(jobId, {
            status: 'failed',
            error_message: errorMessage
          });

          // Stop polling
          this.activePolls.delete(jobId);
          return;

        } else {
          // Continue polling
          console.log(`[VideoGenerationService] Video ${status.status}, progress: ${status.progress}%`);
          setTimeout(poll, POLL_INTERVAL);
        }

      } catch (error) {
        console.error('[VideoGenerationService] Polling error:', error.message);

        // Retry on network errors
        if (polls < MAX_POLLS) {
          console.log('[VideoGenerationService] Retrying poll after error...');
          setTimeout(poll, POLL_INTERVAL);
        } else {
          await this.storageService.updateJob(jobId, {
            status: 'failed',
            error_message: `Polling failed: ${error.message}`
          });
          this.activePolls.delete(jobId);
        }
      }
    };

    // Start polling after initial delay
    setTimeout(poll, POLL_INTERVAL);
  }

  /**
   * Get the status of a video generation job
   *
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Job status
   */
  async getJobStatus(jobId) {
    try {
      console.log('[VideoGenerationService] Getting job status:', jobId);

      const job = await this.storageService.getJob(jobId);

      return {
        id: job.id,
        organisation_id: job.organisation_id,
        status: job.status,
        progress: job.progress,
        sora_video_id: job.sora_video_id,
        video_url: job.video_url,
        thumbnail_url: job.thumbnail_url,
        error_message: job.error_message,
        created_at: job.created_at,
        completed_at: job.completed_at
      };

    } catch (error) {
      console.error('[VideoGenerationService] Error getting job status:', error);
      throw error;
    }
  }

  /**
   * Refresh job status by checking Sora API
   *
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Updated job status
   */
  async refreshJobStatus(jobId) {
    try {
      console.log('[VideoGenerationService] Refreshing job status:', jobId);

      const job = await this.storageService.getJob(jobId);

      if (!job.sora_video_id) {
        throw new Error('No Sora video ID found for this job');
      }

      if (job.status === 'completed' || job.status === 'failed') {
        console.log('[VideoGenerationService] Job already in terminal state:', job.status);
        return job;
      }

      // Check current status from Sora
      const status = await this.soraService.checkStatus(job.sora_video_id);

      // Update job
      const updatedJob = await this.storageService.updateJob(jobId, {
        status: status.status,
        progress: status.progress || 0
      });

      return updatedJob;

    } catch (error) {
      console.error('[VideoGenerationService] Error refreshing job status:', error);
      throw error;
    }
  }

  /**
   * List video generation jobs
   *
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Array of jobs
   */
  async listVideos(filters) {
    try {
      console.log('[VideoGenerationService] Listing videos with filters:', filters);

      const jobs = await this.storageService.listJobs(filters);

      return {
        videos: jobs,
        total: jobs.length
      };

    } catch (error) {
      console.error('[VideoGenerationService] Error listing videos:', error);
      throw error;
    }
  }

  /**
   * Delete a video generation job and its assets
   *
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async deleteVideo(jobId) {
    try {
      console.log('[VideoGenerationService] Deleting video:', jobId);

      // Stop any active polling
      this.activePolls.delete(jobId);

      // Delete storage assets
      await this.storageService.deleteJobAssets(jobId);

      // Delete database record
      await this.storageService.deleteJob(jobId);

      console.log('[VideoGenerationService] Video deleted:', jobId);

    } catch (error) {
      console.error('[VideoGenerationService] Error deleting video:', error);
      throw error;
    }
  }

  /**
   * Stop polling for a specific job
   *
   * @param {string} jobId - Job ID
   */
  stopPolling(jobId) {
    console.log('[VideoGenerationService] Stopping polling for job:', jobId);
    this.activePolls.delete(jobId);
  }
}

module.exports = VideoGenerationService;
