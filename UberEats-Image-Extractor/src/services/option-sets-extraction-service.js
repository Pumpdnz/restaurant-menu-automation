/**
 * Option Sets Extraction Service for UberEats Menu Items
 *
 * Extracts customization options (option sets) from clean item URLs
 * Based on the successful testing documented in extraction_debug_log.md
 */

const axios = require('axios');
const rateLimiter = require('./rate-limiter-service');

class OptionSetsExtractionService {
  constructor() {
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    this.firecrawlApiUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
  }
  
  /**
   * Build the JSON schema for option sets extraction
   * @returns {object} JSON schema for Firecrawl extraction
   */
  getExtractionSchema() {
    return {
      "type": "object",
      "properties": {
        "itemName": {
          "type": "string",
          "description": "The name of the menu item"
        },
        "price": {
          "type": "string",
          "description": "Base price with currency symbol (e.g., '$12.99')"
        },
        "priceValue": {
          "type": "number",
          "description": "Numeric price value in dollars"
        },
        "description": {
          "type": "string",
          "description": "Full item description"
        },
        "imageUrl": {
          "type": "string",
          "description": "URL of the main product image (high resolution if available)"
        },
        "hasImage": {
          "type": "boolean",
          "description": "True if there's an actual product image (not a placeholder)"
        },
        "optionSets": {
          "type": "array",
          "description": "List of customization option sets",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Name of the option set (e.g., 'Choose your size', 'Select toppings')"
              },
              "required": {
                "type": "boolean",
                "description": "Whether this option set is required"
              },
              "minSelections": {
                "type": "number",
                "description": "Minimum number of selections required"
              },
              "maxSelections": {
                "type": "number",
                "description": "Maximum number of selections allowed"
              },
              "options": {
                "type": "array",
                "description": "Individual options within this set",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string",
                      "description": "Name of the option"
                    },
                    "price": {
                      "type": "string",
                      "description": "Additional price (e.g., '+$2.00' or 'No extra cost')"
                    },
                    "priceValue": {
                      "type": "number",
                      "description": "Numeric price value in dollars (0 if no extra cost)"
                    },
                    "description": {
                      "type": "string",
                      "description": "Optional description of the option"
                    }
                  },
                  "required": ["name", "price", "priceValue"]
                }
              }
            },
            "required": ["name", "required", "minSelections", "maxSelections", "options"]
          }
        },
        "pageType": {
          "type": "string",
          "description": "What type of page is this (main menu, item detail, error page, etc)"
        }
      },
      "required": ["itemName", "price", "priceValue"]
    };
  }
  
  /**
   * Build the extraction prompt
   * @returns {string} Prompt for LLM extraction
   */
  getExtractionPrompt() {
    return `Extract complete menu item details from this item detail page.

For the main item, extract:
1. Item name (the main heading)
2. Base price (as string with $ symbol) and numeric value
3. Full description text
4. High-resolution image URL (look for the main product image, not thumbnails)
5. Whether there's an actual product image (not a placeholder)

For each customization section (option set), extract:
1. Section name (e.g., "Choose your size", "Select toppings", "Choose your steak")
2. Whether it's required or optional
3. Selection limits (min and max selections allowed)
4. For each option within the section:
   - Option name
   - Additional price (e.g., "+$2.00" or "No extra cost")
   - Numeric price value
   - Any description

Common option sets to look for:
- Steak selection (e.g., Scotch Fillet, Sirloin, Rump)
- Size choices
- Add-ons and extras
- Sauce selections
- Cooking preferences

Also identify what type of page this is (item detail, main menu, error page, etc).`;
  }
  
  /**
   * Extract option sets from a clean URL
   * @param {string} cleanUrl - Direct item page URL
   * @param {string} itemName - Name of the menu item
   * @param {string} orgId - Organization ID for logging
   * @returns {object} Extraction result with option sets
   */
  async extractFromCleanUrl(cleanUrl, itemName, orgId) {
    console.log(`[${orgId}] Extracting option sets for "${itemName}" from: ${cleanUrl}`);

    try {
      // Base payload configuration
      const payload = {
        url: cleanUrl,
        formats: [
          {
            type: 'json',
            schema: this.getExtractionSchema(),
            prompt: this.getExtractionPrompt()
          }
        ],
        onlyMainContent: true,
        waitFor: 3000,
        blockAds: true,
        timeout: 90000,  // Firecrawl timeout (increased by 50%)
        skipTlsVerification: true
      };

      // Conditionally add actions based on environment variable
      // Default: NO actions (as of Nov 2025, UberEats doesn't require popup dismissal)
      // Set ENABLE_ACTIONS_ON_OPTION_SETS_EXTRACTIONS=true to re-enable if UberEats changes
      const enableActions = process.env.ENABLE_ACTIONS_ON_OPTION_SETS_EXTRACTIONS === 'true';

      if (enableActions) {
        console.log(`[${orgId}] Actions enabled for option sets extraction`);
        payload.actions = [
          // Wait for page to load
          {
            type: 'wait',
            milliseconds: 2000
          },
          // Click the X button on the address popup if present
          {
            type: 'click',
            selector: 'button[aria-label="Close"]'
          },
          {
            type: 'wait',
            milliseconds: 2000
          }
        ];
      }

      // Wait for rate limiter approval
      await rateLimiter.acquireSlot(`option-sets-${itemName}-${orgId}`);

      const response = await axios.post(
        `${this.firecrawlApiUrl}/v2/scrape`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 135000  // Axios timeout (increased by 50%)
        }
      );
      
      if (response.data.success && response.data.data?.json) {
        const extractedData = response.data.data.json;
        
        // Check if this is an error page (404)
        if (extractedData.pageType === 'error' || !extractedData.itemName) {
          console.log(`[${orgId}] Item "${itemName}" appears to be unavailable (404)`);
          return {
            success: false,
            error: 'Item unavailable (404)',
            itemName,
            cleanUrl
          };
        }
        
        console.log(`[${orgId}] ✓ Successfully extracted "${extractedData.itemName}"`);
        console.log(`[${orgId}]   - Option sets: ${extractedData.optionSets?.length || 0}`);
        
        return {
          success: true,
          data: extractedData,
          cleanUrl
        };
      } else {
        throw new Error('Failed to extract data from Firecrawl response');
      }
      
    } catch (error) {
      console.error(`[${orgId}] Error extracting option sets for "${itemName}":`, error.message);
      
      // Check if it's a 404-like error
      if (error.response?.status === 404 || error.message.includes('404')) {
        return {
          success: false,
          error: 'Item unavailable (404)',
          itemName,
          cleanUrl
        };
      }
      
      return {
        success: false,
        error: error.message,
        itemName,
        cleanUrl
      };
    }
  }
  
  /**
   * Extract option sets from multiple clean URLs with concurrency control
   * @param {Array} items - Array of items with cleanUrl property
   * @param {string} orgId - Organization ID
   * @param {number} concurrencyLimit - Max concurrent requests (optional, reads from env)
   * @returns {object} Batch extraction results
   */
  async batchExtract(items, orgId, concurrencyLimit = null) {
    // Use env variable with fallback to parameter or default
    const limit = concurrencyLimit || parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;

    console.log(`[${orgId}] Starting batch option sets extraction for ${items.length} items`);
    console.log(`[${orgId}] Concurrency limit: ${limit}`);
    
    const results = [];
    const resultMap = new Map(); // To maintain order
    let successCount = 0;
    let unavailableCount = 0;
    let failureCount = 0;
    let processedCount = 0;
    
    // Initialize result map with original order
    items.forEach((item, index) => {
      resultMap.set(index, null);
    });
    
    // Process items with concurrency control
    const processingQueue = [...items.map((item, index) => ({ item, index }))];
    const activePromises = new Map();
    
    // Helper function to process a single item
    const processItem = async (itemData) => {
      const { item, index } = itemData;
      
      // Skip items without clean URLs
      if (!item.cleanUrl) {
        console.log(`[${orgId}] Skipping "${item.name || item.dishName}" - no clean URL`);
        return {
          index,
          result: {
            ...item,
            optionSetsExtracted: false,
            extractionError: 'No clean URL available'
          },
          status: 'failed'
        };
      }
      
      try {
        // Extract option sets
        const extractionResult = await this.extractFromCleanUrl(
          item.cleanUrl,
          item.name || item.dishName || 'Unknown Item',
          orgId
        );
        
        if (extractionResult.success) {
          return {
            index,
            result: {
              ...item,
              optionSetsExtracted: true,
              optionSetsData: extractionResult.data,
              hasOptionSets: (extractionResult.data.optionSets?.length || 0) > 0
            },
            status: 'success'
          };
        } else if (extractionResult.error === 'Item unavailable (404)') {
          return {
            index,
            result: {
              ...item,
              optionSetsExtracted: false,
              extractionError: extractionResult.error,
              isUnavailable: true
            },
            status: 'unavailable'
          };
        } else {
          return {
            index,
            result: {
              ...item,
              optionSetsExtracted: false,
              extractionError: extractionResult.error
            },
            status: 'failed'
          };
        }
      } catch (error) {
        console.error(`[${orgId}] Error processing item "${item.name || item.dishName}":`, error.message);
        return {
          index,
          result: {
            ...item,
            optionSetsExtracted: false,
            extractionError: error.message
          },
          status: 'failed'
        };
      }
    };
    
    // Process queue with concurrency control
    while (processingQueue.length > 0 || activePromises.size > 0) {
      // Start new processes up to the concurrency limit
      while (processingQueue.length > 0 && activePromises.size < limit) {
        const itemData = processingQueue.shift();
        const promise = processItem(itemData);
        const promiseId = `item_${itemData.index}`;
        activePromises.set(promiseId, promise);
        
        // Handle promise completion
        promise.then((result) => {
          activePromises.delete(promiseId);
          resultMap.set(result.index, result.result);
          processedCount++;
          
          // Update counts
          if (result.status === 'success') {
            successCount++;
          } else if (result.status === 'unavailable') {
            unavailableCount++;
          } else {
            failureCount++;
          }
          
          // Progress update
          if (processedCount % 5 === 0 || processedCount === items.length) {
            console.log(`[${orgId}] Progress: ${processedCount}/${items.length} items processed (${activePromises.size} active)`);
          }
        }).catch((error) => {
          activePromises.delete(promiseId);
          console.error(`[${orgId}] Unexpected error in promise:`, error);
          failureCount++;
          processedCount++;
        });
      }
      
      // Wait for at least one to complete if we have active promises
      if (activePromises.size > 0) {
        await Promise.race(activePromises.values());
      }
    }
    
    // Convert map to array maintaining original order
    for (let i = 0; i < items.length; i++) {
      results.push(resultMap.get(i));
    }
    
    console.log(`[${orgId}] Batch extraction complete:`);
    console.log(`[${orgId}]   - Success: ${successCount}`);
    console.log(`[${orgId}]   - Unavailable (404): ${unavailableCount}`);
    console.log(`[${orgId}]   - Failed: ${failureCount}`);
    
    return {
      items: results,
      stats: {
        total: items.length,
        success: successCount,
        unavailable: unavailableCount,
        failed: failureCount,
        extractionRate: ((successCount / items.length) * 100).toFixed(1) + '%'
      }
    };
  }
  
  /**
   * Transform extracted option sets to database format
   * @param {object} extractedData - Data from extraction
   * @param {string} menuItemId - Menu item UUID
   * @returns {Array} Array of option sets ready for database
   */
  transformForDatabase(extractedData, menuItemId) {
    if (!extractedData.optionSets || extractedData.optionSets.length === 0) {
      return [];
    }
    
    return extractedData.optionSets.map((optionSet, index) => ({
      menu_item_id: menuItemId,
      name: optionSet.name,
      display_order: index,
      required: optionSet.required || false,
      min_selections: optionSet.minSelections || 0,
      max_selections: optionSet.maxSelections || 1,
      items: optionSet.options.map((option, optIndex) => ({
        name: option.name,
        price: option.priceValue || 0,
        display_order: optIndex,
        description: option.description || null
      }))
    }));
  }
}

module.exports = new OptionSetsExtractionService();