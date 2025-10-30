/**
 * Gemini Image Service - Google Gemini 2.5 Flash Image API Wrapper
 *
 * Handles image generation using Google Gemini 2.5 Flash Image (Nano Banana) for Mode 3
 * - Generates images from text prompts
 * - Returns PNG images suitable for Sora video generation
 * - Handles error and retry logic
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiImageService {
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash-image'
    });
  }

  /**
   * Generate an image from a text prompt
   *
   * @param {string} prompt - Text description of the image to generate
   * @param {Object} [config] - Optional configuration
   * @param {string} [config.aspectRatio] - Aspect ratio (default: '16:9')
   * @returns {Promise<Object>} - Generated image data
   */
  async generateImage(prompt, config = {}) {
    const { aspectRatio = '16:9' } = config;

    try {
      console.log('[GeminiImageService] Generating image with prompt:', {
        prompt: prompt.substring(0, 50) + '...',
        aspectRatio
      });

      // Enhance prompt with quality hints (aspect ratio handled in config)
      const enhancedPrompt = this.enhancePrompt(prompt, aspectRatio);

      // Generate the image with proper aspect ratio configuration
      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: enhancedPrompt }]
          }
        ],
        generationConfig: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });

      const response = await result.response;

      // Extract image data from response
      const imagePart = response.candidates[0]?.content.parts.find(
        part => part.inlineData
      );

      if (!imagePart) {
        throw new Error('No image generated in response');
      }

      const imageData = imagePart.inlineData;
      const buffer = Buffer.from(imageData.data, 'base64');

      console.log('[GeminiImageService] Image generated:', {
        mimeType: imageData.mimeType,
        size: `${(buffer.length / 1024).toFixed(2)} KB`,
        aspectRatio
      });

      return {
        buffer,
        mimeType: imageData.mimeType,
        aspectRatio
      };

    } catch (error) {
      console.error('[GeminiImageService] Error generating image:', error.message);

      // Handle specific error types
      if (error.message.includes('INVALID_ARGUMENT')) {
        throw new Error(`Invalid prompt or parameters: ${error.message}`);
      }

      if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error(`API key invalid or missing: ${error.message}`);
      }

      if (error.message.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(`Quota exceeded: ${error.message}`);
      }

      if (error.message.includes('SAFETY')) {
        throw new Error(`Content policy violation: ${error.message}`);
      }

      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Enhance the user's prompt with quality modifiers
   * (Aspect ratio is now handled via API config, not prompt text)
   *
   * @param {string} userPrompt - Original user prompt
   * @param {string} aspectRatio - Desired aspect ratio (for food detection)
   * @returns {string} - Enhanced prompt
   */
  enhancePrompt(userPrompt, aspectRatio) {
    // Add professional photography hints
    const enhancements = [];

    // Add quality modifiers for better results
    enhancements.push('High quality, professional photography.');

    // For food imagery, add specific hints
    if (this.isFoodRelated(userPrompt)) {
      enhancements.push('Professional food photography style, appetizing presentation.');
    }

    return `${userPrompt}. ${enhancements.join(' ')}`;
  }

  /**
   * Check if the prompt is related to food
   *
   * @param {string} prompt - User prompt
   * @returns {boolean}
   */
  isFoodRelated(prompt) {
    const foodKeywords = [
      'burger', 'pizza', 'taco', 'food', 'dish', 'meal', 'plate',
      'restaurant', 'cafe', 'cuisine', 'recipe', 'chicken', 'beef',
      'pasta', 'salad', 'dessert', 'appetizer', 'entree', 'menu'
    ];

    const lowerPrompt = prompt.toLowerCase();
    return foodKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  /**
   * Validate that the generated image is valid PNG
   *
   * @param {Buffer} imageBuffer - Image buffer to validate
   * @returns {boolean}
   * @throws {Error} - If validation fails
   */
  validateImage(imageBuffer) {
    // Check minimum size
    if (imageBuffer.length < 1000) {
      throw new Error('Image too small, likely invalid');
    }

    // Check PNG header (89 50 4E 47 0D 0A 1A 0A)
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const header = imageBuffer.slice(0, 8);

    if (!header.equals(pngHeader)) {
      throw new Error('Invalid PNG file format');
    }

    console.log('[GeminiImageService] Image validation passed');
    return true;
  }

  /**
   * Generate image with automatic retry logic
   *
   * @param {string} prompt - Text description
   * @param {Object} [config] - Optional configuration
   * @param {number} [maxRetries] - Maximum number of retries (default: 3)
   * @returns {Promise<Object>} - Generated image data
   */
  async generateWithRetry(prompt, config = {}, maxRetries = 3) {
    const retryableErrors = ['RESOURCE_EXHAUSTED', 'INTERNAL'];

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.generateImage(prompt, config);
      } catch (error) {
        // Check if error is retryable
        const isRetryable = retryableErrors.some(
          code => error.message.includes(code)
        );

        if (!isRetryable || i === maxRetries - 1) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        console.log(`[GeminiImageService] Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

module.exports = GeminiImageService;
