/**
 * Unified Image Fetcher Service
 *
 * Centralized service for fetching images from all sources:
 * - Menu images (item_images table)
 * - AI-generated images (social_media_images table, mode != 'uploaded')
 * - Uploaded images (social_media_images table, mode = 'uploaded')
 * - Restaurant logos (restaurants table)
 *
 * This service abstracts away the complexity of fetching from different
 * tables and provides a unified interface for the generation services.
 */

const SocialStorageService = require('./social-storage-service');
const axios = require('axios');

class ImageFetcherService {
  constructor() {
    this.storageService = new SocialStorageService();
  }

  /**
   * Fetch image from any source with explicit source type
   *
   * @param {string} imageId - UUID of the image (or restaurant ID for logos)
   * @param {string} sourceType - 'menu' | 'ai' | 'uploaded' | 'logo'
   * @returns {Promise<Object>} { id, url, buffer, sourceType, metadata }
   */
  async fetchImage(imageId, sourceType) {
    console.log('[ImageFetcherService] Fetching image:', {
      imageId,
      sourceType
    });

    // Validate source type
    if (!['menu', 'ai', 'uploaded', 'logo'].includes(sourceType)) {
      throw new Error(`Invalid source type: ${sourceType}. Must be: menu, ai, uploaded, or logo`);
    }

    switch (sourceType) {
      case 'menu':
        return await this.fetchMenuImage(imageId);

      case 'ai':
      case 'uploaded':
        return await this.fetchSocialMediaImage(imageId, sourceType);

      case 'logo':
        return await this.fetchLogoImage(imageId);

      default:
        throw new Error(`Unhandled source type: ${sourceType}`);
    }
  }

  /**
   * Fetch multiple images with mixed sources
   *
   * @param {Array<Object>} sources - [{ id, sourceType }, ...]
   * @returns {Promise<Array<Object>>} Array of image objects with buffers
   */
  async fetchMultipleImages(sources) {
    console.log('[ImageFetcherService] Fetching multiple images:', {
      count: sources.length,
      sources: sources.map(s => `${s.sourceType}:${s.id.substring(0, 8)}...`)
    });

    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error('sources must be a non-empty array');
    }

    // Validate all sources have required fields
    for (const src of sources) {
      if (!src.id || !src.sourceType) {
        throw new Error('Each source must have id and sourceType properties');
      }
    }

    // Fetch all images in parallel
    const results = await Promise.all(
      sources.map(src => this.fetchImage(src.id, src.sourceType))
    );

    console.log('[ImageFetcherService] Successfully fetched all images:', {
      count: results.length
    });

    return results;
  }

  /**
   * Fetch menu item image from item_images table
   *
   * @param {string} imageId - UUID from item_images table
   * @returns {Promise<Object>} Image object with buffer
   */
  async fetchMenuImage(imageId) {
    try {
      console.log('[ImageFetcherService] Fetching menu image:', imageId);

      const { data: image, error } = await this.storageService.supabase
        .from('item_images')
        .select('id, url, cdn_url, width, height, menu_item_id')
        .eq('id', imageId)
        .single();

      if (error || !image) {
        throw new Error(`Menu image not found: ${imageId}`);
      }

      // Prefer CDN URL over original URL
      const imageUrl = image.cdn_url || image.url;

      if (!imageUrl) {
        throw new Error(`Menu image ${imageId} has no URL`);
      }

      console.log('[ImageFetcherService] Downloading menu image from:', imageUrl);

      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);

      console.log('[ImageFetcherService] Menu image downloaded:', {
        id: image.id,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      return {
        id: image.id,
        url: imageUrl,
        buffer,
        sourceType: 'menu',
        metadata: {
          menuItemId: image.menu_item_id,
          width: image.width,
          height: image.height
        }
      };

    } catch (error) {
      console.error('[ImageFetcherService] Error fetching menu image:', error);
      throw new Error(`Failed to fetch menu image: ${error.message}`);
    }
  }

  /**
   * Fetch AI-generated or uploaded image from social_media_images table
   *
   * @param {string} imageId - UUID from social_media_images table
   * @param {string} sourceType - 'ai' or 'uploaded'
   * @returns {Promise<Object>} Image object with buffer
   */
  async fetchSocialMediaImage(imageId, sourceType) {
    try {
      console.log('[ImageFetcherService] Fetching social media image:', {
        imageId,
        sourceType
      });

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
        throw new Error(
          `Image ${imageId} is uploaded, not AI-generated. Use sourceType: 'uploaded' instead.`
        );
      }

      if (sourceType === 'uploaded' && image.mode !== 'uploaded') {
        throw new Error(
          `Image ${imageId} is AI-generated (mode: ${image.mode}), not uploaded. Use sourceType: 'ai' instead.`
        );
      }

      if (!image.image_url) {
        throw new Error(`Social media image ${imageId} has no URL`);
      }

      console.log('[ImageFetcherService] Downloading social media image from:', image.image_url);

      // Download image
      const response = await axios.get(image.image_url, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);

      console.log('[ImageFetcherService] Social media image downloaded:', {
        id: image.id,
        mode: image.mode,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      return {
        id: image.id,
        url: image.image_url,
        buffer,
        sourceType,
        metadata: {
          mode: image.mode,
          prompt: image.prompt,
          width: image.width,
          height: image.height
        }
      };

    } catch (error) {
      console.error('[ImageFetcherService] Error fetching social media image:', error);
      throw new Error(`Failed to fetch social media image: ${error.message}`);
    }
  }

  /**
   * Fetch restaurant logo from restaurants table
   *
   * NOTE: The imageId parameter is actually the restaurant ID,
   * since logos are stored directly on restaurant records.
   *
   * @param {string} restaurantId - UUID from restaurants table
   * @returns {Promise<Object>} Image object with buffer
   */
  async fetchLogoImage(restaurantId) {
    try {
      console.log('[ImageFetcherService] Fetching restaurant logo:', restaurantId);

      const { data: restaurant, error } = await this.storageService.supabase
        .from('restaurants')
        .select('id, name, logo_url, brand_colors')
        .eq('id', restaurantId)
        .single();

      if (error || !restaurant) {
        throw new Error(`Restaurant not found: ${restaurantId}`);
      }

      if (!restaurant.logo_url) {
        throw new Error(`Restaurant ${restaurantId} (${restaurant.name}) has no logo`);
      }

      console.log('[ImageFetcherService] Downloading logo from:', restaurant.logo_url);

      // Download logo
      const response = await axios.get(restaurant.logo_url, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);

      console.log('[ImageFetcherService] Logo downloaded:', {
        id: restaurant.id,
        name: restaurant.name,
        size: `${(buffer.length / 1024).toFixed(2)} KB`
      });

      return {
        id: restaurant.id,
        url: restaurant.logo_url,
        buffer,
        sourceType: 'logo',
        metadata: {
          restaurantName: restaurant.name,
          brandColors: restaurant.brand_colors
        }
      };

    } catch (error) {
      console.error('[ImageFetcherService] Error fetching logo:', error);
      throw new Error(`Failed to fetch logo: ${error.message}`);
    }
  }

  /**
   * Validate source object structure
   *
   * @param {Object} source - Source object to validate
   * @throws {Error} If source is invalid
   */
  validateSource(source) {
    if (!source || typeof source !== 'object') {
      throw new Error('Source must be an object');
    }

    if (!source.id || typeof source.id !== 'string') {
      throw new Error('Source must have a valid id (string)');
    }

    if (!source.sourceType || typeof source.sourceType !== 'string') {
      throw new Error('Source must have a valid sourceType (string)');
    }

    if (!['menu', 'ai', 'uploaded', 'logo'].includes(source.sourceType)) {
      throw new Error(
        `Invalid sourceType: ${source.sourceType}. Must be: menu, ai, uploaded, or logo`
      );
    }
  }

  /**
   * Validate array of sources
   *
   * @param {Array<Object>} sources - Array of source objects
   * @throws {Error} If any source is invalid
   */
  validateSources(sources) {
    if (!Array.isArray(sources)) {
      throw new Error('Sources must be an array');
    }

    if (sources.length === 0) {
      throw new Error('Sources array cannot be empty');
    }

    sources.forEach((source, index) => {
      try {
        this.validateSource(source);
      } catch (error) {
        throw new Error(`Invalid source at index ${index}: ${error.message}`);
      }
    });
  }
}

module.exports = ImageFetcherService;
