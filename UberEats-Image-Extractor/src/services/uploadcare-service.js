/**
 * UploadCare CDN Service
 * Handles image uploads to UploadCare CDN with batch processing and progress tracking
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

class UploadCareService {
  constructor(apiKey, secretKey = null) {
    this.publicKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = 'https://upload.uploadcare.com';
    this.apiUrl = 'https://api.uploadcare.com';
    
    // Rate limiting configuration
    this.maxConcurrency = 5; // Maximum parallel uploads
    this.requestDelay = 200; // Delay between requests in ms
    this.maxRetries = 3; // Maximum retry attempts
    this.retryDelay = 1000; // Initial retry delay in ms
    
    // Track active uploads
    this.activeUploads = new Set();
    this.uploadQueue = [];
  }

  /**
   * Sanitize filename for CDN storage
   */
  sanitizeFilename(originalUrl, itemName, categoryName) {
    // Extract filename from URL or generate from item name
    let filename = 'image.jpg';
    
    try {
      const urlPath = new URL(originalUrl).pathname;
      const urlFilename = path.basename(urlPath);
      
      if (urlFilename && urlFilename.length > 0) {
        filename = urlFilename;
      } else if (itemName) {
        // Generate filename from item name
        filename = `${itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
      }
    } catch (error) {
      // If URL parsing fails, use item name
      if (itemName) {
        filename = `${itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
      }
    }
    
    // Add category prefix if available
    if (categoryName) {
      const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      filename = `${categorySlug}-${filename}`;
    }
    
    // Ensure filename is not too long
    if (filename.length > 100) {
      const ext = path.extname(filename);
      filename = filename.substring(0, 96) + ext;
    }
    
    return filename;
  }

  /**
   * Generate authentication headers if secret key is available
   */
  generateAuthHeaders() {
    const headers = {};
    
    if (this.secretKey) {
      headers['Authorization'] = `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`;
    }
    
    return headers;
  }

  /**
   * Upload a single image from URL to UploadCare
   */
  async uploadImageFromUrl(imageUrl, filename = null, metadata = {}) {
    const startTime = Date.now();
    
    try {
      // Prepare the upload request
      const formData = new URLSearchParams();
      formData.append('pub_key', this.publicKey);
      formData.append('source_url', imageUrl);
      formData.append('store', '1'); // Store permanently
      
      if (filename) {
        formData.append('filename', filename);
      }
      
      // Add metadata if provided
      if (metadata && Object.keys(metadata).length > 0) {
        formData.append('metadata', JSON.stringify(metadata));
      }
      
      console.log(`[UploadCare] Uploading image from URL: ${imageUrl.substring(0, 50)}...`);
      
      // Make the upload request
      const response = await axios.post(
        `${this.baseUrl}/from_url/`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...this.generateAuthHeaders()
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      // Check upload status
      if (response.data.token) {
        // Poll for upload completion
        const fileInfo = await this.waitForUploadCompletion(response.data.token);
        
        const duration = Date.now() - startTime;
        console.log(`[UploadCare] Successfully uploaded in ${duration}ms: ${fileInfo.uuid}`);
        
        return {
          success: true,
          cdnId: fileInfo.uuid,
          cdnUrl: `https://ucarecdn.com/${fileInfo.uuid}/`,
          filename: fileInfo.original_filename || filename,
          size: fileInfo.size,
          mimeType: fileInfo.mime_type,
          uploadDuration: duration,
          metadata: fileInfo.metadata || metadata
        };
      } else if (response.data.uuid) {
        // Direct success response
        const duration = Date.now() - startTime;
        
        return {
          success: true,
          cdnId: response.data.uuid,
          cdnUrl: `https://ucarecdn.com/${response.data.uuid}/`,
          filename: response.data.original_filename || filename,
          size: response.data.size,
          mimeType: response.data.mime_type,
          uploadDuration: duration,
          metadata: response.data.metadata || metadata
        };
      } else {
        throw new Error('Unexpected response from UploadCare');
      }
    } catch (error) {
      console.error(`[UploadCare] Upload failed for ${imageUrl}:`, error.message);
      
      return {
        success: false,
        error: error.message,
        imageUrl: imageUrl,
        uploadDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Wait for async upload to complete
   */
  async waitForUploadCompletion(token, maxWaitTime = 60000) {
    const pollInterval = 1000; // Poll every second
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/from_url/status/`,
          {
            params: { token },
            headers: this.generateAuthHeaders()
          }
        );
        
        if (response.data.status === 'success' && response.data.file_id) {
          return {
            uuid: response.data.file_id,
            original_filename: response.data.original_filename,
            size: response.data.size,
            mime_type: response.data.mime_type,
            metadata: response.data.metadata
          };
        } else if (response.data.status === 'error') {
          throw new Error(response.data.error || 'Upload failed');
        }
        
        // Still processing, wait before next poll
        await this.sleep(pollInterval);
      } catch (error) {
        throw new Error(`Failed to check upload status: ${error.message}`);
      }
    }
    
    throw new Error('Upload timeout - took too long to complete');
  }

  /**
   * Upload image with retry logic
   */
  async uploadImageWithRetry(imageUrl, filename, metadata, maxRetries = null) {
    const retries = maxRetries || this.maxRetries;
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.uploadImageFromUrl(imageUrl, filename, metadata);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error;
        
        // Don't retry if it's a permanent error
        if (result.error && (
          result.error.includes('404') ||
          result.error.includes('403') ||
          result.error.includes('Invalid')
        )) {
          break;
        }
        
        // Exponential backoff before retry
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`[UploadCare] Retrying upload (attempt ${attempt}/${retries}) after ${delay}ms...`);
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = error.message;
        
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }
    
    return {
      success: false,
      error: lastError || 'Upload failed after all retries',
      imageUrl: imageUrl
    };
  }

  /**
   * Upload batch of images with progress tracking
   */
  async uploadBatch(images, progressCallback = null, batchId = null) {
    const results = {
      successful: [],
      failed: [],
      totalImages: images.length,
      startedAt: new Date(),
      completedAt: null
    };
    
    console.log(`[UploadCare] Starting batch upload of ${images.length} images`);
    
    // Process images in chunks to respect concurrency limit
    const chunks = this.chunkArray(images, this.maxConcurrency);
    let processedCount = 0;
    
    for (const chunk of chunks) {
      const uploadPromises = chunk.map(async (image) => {
        // Add delay between requests to avoid rate limiting
        await this.sleep(this.requestDelay * Math.random());
        
        const filename = this.sanitizeFilename(
          image.url,
          image.itemName,
          image.categoryName
        );
        
        const metadata = {
          menuItemId: image.menuItemId,
          itemName: image.itemName,
          categoryName: image.categoryName,
          restaurantName: image.restaurantName,
          batchId: batchId
        };
        
        const result = await this.uploadImageWithRetry(image.url, filename, metadata);
        
        processedCount++;
        
        // Report progress
        if (progressCallback) {
          progressCallback({
            batchId: batchId,
            progress: {
              current: processedCount,
              total: images.length,
              percentage: Math.round((processedCount / images.length) * 100),
              successful: results.successful.length + (result.success ? 1 : 0),
              failed: results.failed.length + (result.success ? 0 : 1)
            }
          });
        }
        
        return { ...result, originalImage: image };
      });
      
      // Wait for chunk to complete
      const chunkResults = await Promise.allSettled(uploadPromises);
      
      // Process results
      chunkResults.forEach((promiseResult) => {
        if (promiseResult.status === 'fulfilled') {
          const result = promiseResult.value;
          if (result.success) {
            results.successful.push(result);
          } else {
            results.failed.push(result);
          }
        } else {
          results.failed.push({
            success: false,
            error: promiseResult.reason,
            originalImage: chunk[0] // Approximate, as we lost track
          });
        }
      });
      
      // Add delay between chunks
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.sleep(500);
      }
    }
    
    results.completedAt = new Date();
    const duration = results.completedAt - results.startedAt;
    
    console.log(`[UploadCare] Batch upload completed in ${duration}ms`);
    console.log(`[UploadCare] Successful: ${results.successful.length}, Failed: ${results.failed.length}`);
    
    return results;
  }

  /**
   * Delete image from CDN
   */
  async deleteImage(cdnId) {
    if (!this.secretKey) {
      throw new Error('Secret key required for delete operations');
    }
    
    try {
      const response = await axios.delete(
        `${this.apiUrl}/files/${cdnId}/`,
        {
          headers: {
            'Authorization': `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`,
            'Accept': 'application/vnd.uploadcare-v0.5+json'
          }
        }
      );
      
      return {
        success: true,
        message: 'Image deleted successfully'
      };
    } catch (error) {
      console.error(`[UploadCare] Failed to delete image ${cdnId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file info from CDN
   */
  async getFileInfo(cdnId) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/files/${cdnId}/`,
        {
          headers: {
            'Authorization': `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`,
            'Accept': 'application/vnd.uploadcare-v0.5+json'
          }
        }
      );
      
      return {
        success: true,
        file: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch delete images from CDN
   */
  async batchDelete(cdnIds) {
    const results = {
      successful: [],
      failed: []
    };
    
    for (const cdnId of cdnIds) {
      const result = await this.deleteImage(cdnId);
      if (result.success) {
        results.successful.push(cdnId);
      } else {
        results.failed.push({ cdnId, error: result.error });
      }
    }
    
    return results;
  }

  /**
   * Helper function to chunk array
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Helper function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check CDN quota/limits (if API provides this)
   */
  async checkQuota() {
    if (!this.secretKey) {
      return {
        success: false,
        error: 'Secret key required for quota check'
      };
    }
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/project/`,
        {
          headers: {
            'Authorization': `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`,
            'Accept': 'application/vnd.uploadcare-v0.5+json'
          }
        }
      );
      
      return {
        success: true,
        project: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = UploadCareService;