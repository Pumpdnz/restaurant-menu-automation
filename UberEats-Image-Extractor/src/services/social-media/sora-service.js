/**
 * Sora Service - OpenAI Sora 2 Video Generation API Wrapper
 *
 * Handles all interactions with the OpenAI Sora 2 API including:
 * - Creating video generation jobs
 * - Checking video generation status
 * - Downloading completed videos and thumbnails
 * - Error handling and retry logic
 */

const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

class SoraService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Create a new video generation job with Sora 2
   *
   * @param {Object} params - Video generation parameters
   * @param {string} params.model - 'sora-2' or 'sora-2-pro'
   * @param {string} params.prompt - Text prompt describing the video
   * @param {Buffer|string} [params.inputReference] - Optional image reference (Mode 1 & 3)
   * @param {string} params.size - Video size (e.g., '1280x720', '1920x1080')
   * @param {number} params.seconds - Video duration (4, 8, or 12 seconds)
   * @returns {Promise<Object>} - Sora video job details
   */
  async createVideo({ model, prompt, inputReference, size, seconds }) {
    try {
      const params = {
        model,
        prompt,
        size,
        seconds: String(seconds)  // Sora API requires string: '4', '8', or '12'
      };

      // Add input reference if provided (for Mode 1 & 3)
      // Convert Buffer to File-like object using OpenAI's toFile helper
      if (inputReference) {
        params.input_reference = await toFile(inputReference, 'input-image.jpg', {
          type: 'image/jpeg'
        });
      }

      console.log('[SoraService] Creating video with params:', {
        model,
        prompt: prompt.substring(0, 50) + '...',
        size,
        seconds,
        hasInputReference: !!inputReference
      });

      const video = await this.client.videos.create(params);

      console.log('[SoraService] Video created:', {
        id: video.id,
        status: video.status,
        progress: video.progress
      });

      return {
        id: video.id,
        status: video.status,
        model: video.model,
        progress: video.progress || 0
      };

    } catch (error) {
      console.error('[SoraService] Error creating video:', {
        error: error.message,
        code: error.code,
        type: error.type,
        fullPrompt: prompt  // Log full prompt for debugging moderation issues
      });

      // Handle specific error types
      if (error.code === 'content_policy') {
        throw new Error(`Content policy violation: ${error.message}`);
      }

      if (error.code === 'rate_limit_error') {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      }

      throw new Error(`Sora API error: ${error.message}`);
    }
  }

  /**
   * Check the status of a video generation job
   *
   * @param {string} videoId - Sora video ID
   * @returns {Promise<Object>} - Video status details
   */
  async checkStatus(videoId) {
    try {
      console.log('[SoraService] Checking status for video:', videoId);

      const video = await this.client.videos.retrieve(videoId);

      console.log('[SoraService] Video status:', {
        id: video.id,
        status: video.status,
        progress: video.progress
      });

      return {
        id: video.id,
        status: video.status,
        progress: video.progress || 0,
        error: video.error || null
      };

    } catch (error) {
      console.error('[SoraService] Error checking status:', error.message);
      throw new Error(`Failed to check video status: ${error.message}`);
    }
  }

  /**
   * Download the completed video content
   *
   * @param {string} videoId - Sora video ID
   * @returns {Promise<Buffer>} - Video file buffer
   */
  async downloadVideo(videoId) {
    try {
      console.log('[SoraService] Downloading video:', videoId);

      const content = await this.client.videos.downloadContent(videoId);
      const arrayBuffer = await content.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('[SoraService] Video downloaded:', {
        id: videoId,
        size: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`
      });

      return buffer;

    } catch (error) {
      console.error('[SoraService] Error downloading video:', error.message);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Download the video thumbnail
   *
   * @param {string} videoId - Sora video ID
   * @returns {Promise<Buffer>} - Thumbnail image buffer (WebP format)
   */
  async downloadThumbnail(videoId) {
    try {
      console.log('[SoraService] Downloading thumbnail:', videoId);

      const content = await this.client.videos.downloadContent(videoId, {
        variant: 'thumbnail'
      });
      const arrayBuffer = await content.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('[SoraService] Thumbnail downloaded:', {
        id: videoId,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      return buffer;

    } catch (error) {
      console.error('[SoraService] Error downloading thumbnail:', error.message);
      throw new Error(`Failed to download thumbnail: ${error.message}`);
    }
  }

  /**
   * Download the video spritesheet (multiple frames in a grid)
   *
   * @param {string} videoId - Sora video ID
   * @returns {Promise<Buffer>} - Spritesheet image buffer (JPEG format)
   */
  async downloadSpritesheet(videoId) {
    try {
      console.log('[SoraService] Downloading spritesheet:', videoId);

      const content = await this.client.videos.downloadContent(videoId, {
        variant: 'spritesheet'
      });
      const arrayBuffer = await content.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('[SoraService] Spritesheet downloaded:', {
        id: videoId,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      return buffer;

    } catch (error) {
      console.error('[SoraService] Error downloading spritesheet:', error.message);
      throw new Error(`Failed to download spritesheet: ${error.message}`);
    }
  }

  /**
   * Delete a video from OpenAI's storage
   *
   * @param {string} videoId - Sora video ID
   * @returns {Promise<void>}
   */
  async deleteVideo(videoId) {
    try {
      console.log('[SoraService] Deleting video:', videoId);

      await this.client.videos.del(videoId);

      console.log('[SoraService] Video deleted:', videoId);

    } catch (error) {
      console.error('[SoraService] Error deleting video:', error.message);
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  /**
   * Create a video with automatic polling until completion
   *
   * @param {Object} params - Video generation parameters (same as createVideo)
   * @returns {Promise<Object>} - Completed video details
   */
  async createAndPoll(params) {
    try {
      console.log('[SoraService] Creating video with automatic polling...');

      const video = await this.client.videos.createAndPoll(params);

      console.log('[SoraService] Video ready:', {
        id: video.id,
        status: video.status
      });

      return {
        id: video.id,
        status: video.status,
        model: video.model
      };

    } catch (error) {
      console.error('[SoraService] Error in createAndPoll:', error.message);
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }
}

module.exports = SoraService;
