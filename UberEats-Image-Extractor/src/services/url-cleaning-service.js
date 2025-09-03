/**
 * URL Cleaning Service for UberEats Menu Items
 * 
 * Converts modal URLs (with quickView parameter) to direct item page URLs
 * Based on the successful testing documented in extraction_debug_log.md
 */

class UrlCleaningService {
  /**
   * Clean a single modal URL to get the direct item page URL
   * @param {string} modalUrl - The modal URL containing modctx parameter
   * @returns {object} Object containing cleanUrl and metadata
   */
  cleanModalUrl(modalUrl) {
    try {
      // Parse the URL
      const url = new URL(modalUrl);
      
      // Extract the modctx parameter
      const modctx = url.searchParams.get('modctx');
      
      if (!modctx) {
        throw new Error('No modctx parameter found in URL');
      }
      
      // Double decode (it's encoded twice)
      let decoded = decodeURIComponent(modctx);  // First decode
      decoded = decodeURIComponent(decoded);      // Second decode
      
      // Parse the JSON
      const modctxData = JSON.parse(decoded);
      
      // Extract the UUIDs
      const sectionUuid = modctxData.sectionUuid;
      const subsectionUuid = modctxData.subsectionUuid;
      const itemUuid = modctxData.itemUuid;
      
      if (!sectionUuid || !subsectionUuid || !itemUuid) {
        throw new Error('Missing required UUIDs in modctx data');
      }
      
      // Get the base URL (everything before the query parameters)
      const baseUrl = url.origin + url.pathname;
      
      // Build the clean URL
      const cleanUrl = `${baseUrl}/${sectionUuid}/${subsectionUuid}/${itemUuid}`;
      
      return {
        success: true,
        cleanUrl,
        metadata: {
          sectionUuid,
          subsectionUuid,
          itemUuid,
          originalUrl: modalUrl
        }
      };
      
    } catch (error) {
      console.error('Error cleaning modal URL:', error.message);
      return {
        success: false,
        error: error.message,
        originalUrl: modalUrl
      };
    }
  }
  
  /**
   * Process multiple modal URLs in batch
   * @param {Array} items - Array of items with modalUrl property
   * @param {string} orgId - Organization ID for logging
   * @returns {Array} Array of items with cleanUrl added
   */
  cleanBatchUrls(items, orgId) {
    console.log(`[${orgId}] Starting URL cleaning for ${items.length} items`);
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const item of items) {
      if (!item.modalUrl) {
        console.log(`[${orgId}] Skipping item "${item.name}" - no modal URL`);
        results.push({
          ...item,
          cleanUrl: null,
          urlCleaningError: 'No modal URL provided'
        });
        failureCount++;
        continue;
      }
      
      const cleanResult = this.cleanModalUrl(item.modalUrl);
      
      if (cleanResult.success) {
        results.push({
          ...item,
          cleanUrl: cleanResult.cleanUrl,
          urlMetadata: cleanResult.metadata
        });
        successCount++;
        console.log(`[${orgId}] ✓ Cleaned URL for "${item.dishName || item.name || 'Unknown Item'}"`);
      } else {
        results.push({
          ...item,
          cleanUrl: null,
          urlCleaningError: cleanResult.error
        });
        failureCount++;
        console.log(`[${orgId}] ✗ Failed to clean URL for "${item.dishName || item.name || 'Unknown Item'}": ${cleanResult.error}`);
      }
    }
    
    console.log(`[${orgId}] URL cleaning complete: ${successCount} success, ${failureCount} failed`);
    
    return {
      items: results,
      stats: {
        total: items.length,
        success: successCount,
        failed: failureCount
      }
    };
  }
  
  /**
   * Validate if a URL is already clean (direct item page)
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is already clean
   */
  isCleanUrl(url) {
    try {
      const urlObj = new URL(url);
      // Clean URLs have the pattern: /store/{storeId}/item/{sectionId}/{subsectionId}/{itemId}
      // and don't have quickView parameter
      const hasQuickView = urlObj.searchParams.has('quickView');
      const hasModctx = urlObj.searchParams.has('modctx');
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      
      // Check if it matches the clean URL pattern
      const isCleanPattern = pathParts.length >= 6 && 
                            pathParts[0] === 'store' && 
                            pathParts[2] === 'item';
      
      return isCleanPattern && !hasQuickView && !hasModctx;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Extract store ID from URL
   * @param {string} url - Store or item URL
   * @returns {string|null} Store ID or null if not found
   */
  extractStoreId(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      
      // Find the index of 'store' in the path
      const storeIndex = pathParts.indexOf('store');
      if (storeIndex !== -1 && pathParts.length > storeIndex + 1) {
        return pathParts[storeIndex + 1];
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting store ID:', error.message);
      return null;
    }
  }
}

module.exports = new UrlCleaningService();