/**
 * Premium Menu Extraction Service
 * 
 * Orchestrates the complete premium extraction process including:
 * - Category extraction
 * - Menu item extraction with modal URLs
 * - URL cleaning
 * - Option sets extraction
 * - Image validation
 * - Database persistence
 */

const urlCleaningService = require('./url-cleaning-service');
const optionSetsService = require('./option-sets-extraction-service');
const optionSetsDeduplicationService = require('./option-sets-deduplication-service');
const imageValidationService = require('./image-validation-service');
const databaseService = require('./database-service');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class PremiumExtractionService {
  constructor() {
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    this.firecrawlApiUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
    this.activeJobs = new Map();
  }
  
  /**
   * Generate a unique job ID
   * @returns {string} Job ID
   */
  generateJobId() {
    return `premium_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }
  
  /**
   * Extract categories from the store page
   * @param {string} storeUrl - UberEats store URL
   * @param {string} orgId - Organization ID
   * @returns {Array} Array of category names
   */
  async extractCategories(storeUrl, orgId) {
    console.log(`[${orgId}] Extracting categories from: ${storeUrl}`);
    
    const schema = {
      "type": "object",
      "properties": {
        "categories": {
          "type": "array",
          "description": "List of all menu categories",
          "items": {
            "type": "string",
            "description": "Category name"
          }
        }
      },
      "required": ["categories"]
    };
    
    const prompt = `Extract all menu category names from this UberEats restaurant page.
Look for section headers that group menu items.
Common categories include: Starters, Mains, Desserts, Beverages, etc.
Return ONLY the category names, nothing else.`;
    
    try {
      const response = await axios.post(
        `${this.firecrawlApiUrl}/v2/scrape`,
        {
          url: storeUrl,
          formats: [{
            type: 'json',
            schema: schema,
            prompt: prompt
          }],
          onlyMainContent: true,
          waitFor: 3000,
          timeout: 60000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success && response.data.data?.json?.categories) {
        console.log(`[${orgId}] Found ${response.data.data.json.categories.length} categories`);
        return response.data.data.json.categories;
      }
      
      throw new Error('Failed to extract categories');
    } catch (error) {
      console.error(`[${orgId}] Error extracting categories:`, error.message);
      throw error;
    }
  }
  
  /**
   * Extract menu items with modal URLs from a category
   * @param {string} storeUrl - UberEats store URL
   * @param {string} categoryName - Category to extract
   * @param {string} orgId - Organization ID
   * @returns {Array} Array of menu items with modal URLs
   */
  async extractCategoryItems(storeUrl, categoryName, orgId) {
    console.log(`[${orgId}] Extracting items from category: ${categoryName}`);
    
    const schema = {
      "type": "object",
      "properties": {
        "categoryName": {
          "type": "string",
          "description": `The name of this specific menu category: "${categoryName}"`
        },
        "menuItems": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "dishName": {
                "type": "string",
                "description": "The name of the dish"
              },
              "dishPrice": {
                "type": "number",
                "description": "The price as a numerical value"
              },
              "dishDescription": {
                "type": "string",
                "description": "Full description of the dish"
              },
              "modalUrl": {
                "type": "string",
                "description": "The quickView modal URL for this menu item (contains modctx parameter)"
              },
              "imageUrl": {
                "type": "string",
                "description": "The image URL if displayed on the category page"
              }
            },
            "required": ["dishName", "dishPrice", "modalUrl"]
          }
        }
      },
      "required": ["categoryName", "menuItems"]
    };
    
    const prompt = `Extract menu items from the category "${categoryName}" on this UberEats page.
    
IMPORTANT: For each menu item, you MUST extract:
1. The dish name
2. The price (numeric value)
3. The description if available
4. The MODAL URL - this is the quickView URL with modctx parameter
5. The image URL if visible

To find the modal URL:
- Each menu item is clickable and opens a modal/popup
- The URL contains "quickView" and "modctx" parameters
- This is critical for extracting option sets later

Focus ONLY on the "${categoryName}" category section.`;
    
    try {
      const response = await axios.post(
        `${this.firecrawlApiUrl}/v2/scrape`,
        {
          url: storeUrl,
          formats: [{
            type: 'json',
            schema: schema,
            prompt: prompt
          }],
          onlyMainContent: true,
          waitFor: 3000,
          timeout: 90000,
          includeTags: ['main', 'article', 'section', 'div', 'a', 'h1', 'h2', 'h3', 'span', 'button'],
          excludeTags: ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript']
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success && response.data.data?.json?.menuItems) {
        const items = response.data.data.json.menuItems;
        console.log(`[${orgId}] Extracted ${items.length} items from ${categoryName}`);
        return items.map(item => ({
          ...item,
          categoryName: categoryName  // Use categoryName to match standard extraction
        }));
      }
      
      console.warn(`[${orgId}] No items found in category ${categoryName}`);
      return [];
    } catch (error) {
      console.error(`[${orgId}] Error extracting items from ${categoryName}:`, error.message);
      return [];
    }
  }
  
  /**
   * Main extraction method
   * @param {string} storeUrl - UberEats store URL
   * @param {string} orgId - Organization ID
   * @param {object} options - Extraction options
   * @returns {object} Extraction results or job info
   */
  async extractPremiumMenu(storeUrl, orgId, options = {}) {
    const {
      restaurantId: providedRestaurantId = null,  // NEW: Accept restaurant ID from frontend
      extractOptionSets = true,
      validateImages = true,
      async = false,
      saveToDatabase = true
    } = options;
    
    const jobId = this.generateJobId();
    
    // Initialize database service if needed
    // This ensures we have a valid connection for background operations
    if (saveToDatabase) {
      if (!databaseService.isDatabaseAvailable()) {
        databaseService.initializeDatabase();
      }
      // Set organization context for all database operations
      databaseService.setCurrentOrganizationId(orgId);
    }
    
    // Extract or use provided restaurant name
    let restaurantName = options.restaurantName || 'Unknown Restaurant';
    
    // If no restaurant name provided, try to extract from URL
    if (!options.restaurantName) {
      try {
        const urlParts = storeUrl.split('/');
        const storeIndex = urlParts.indexOf('store');
        if (storeIndex !== -1 && urlParts[storeIndex + 1]) {
          restaurantName = urlParts[storeIndex + 1]
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      } catch (e) {
        console.error(`[${orgId}] Error parsing restaurant name:`, e);
      }
    }
    
    console.log(`[${orgId}] Using restaurant name: ${restaurantName}`);
    
    // Restaurant resolution logic - use provided ID or create/find by name
    let restaurantId = providedRestaurantId;  // Use provided ID if available
    let platformId = 1; // Default to UberEats

    if (saveToDatabase) {
      try {
        // Get platform ID for UberEats
        const platform = await databaseService.getPlatformByName('ubereats');
        if (platform) {
          platformId = platform.id;
        }

        // If restaurant ID provided, verify it exists
        if (restaurantId) {
          const existingRestaurant = await databaseService.getRestaurantById(restaurantId, orgId);
          if (!existingRestaurant) {
            throw new Error(`Restaurant with ID ${restaurantId} not found`);
          }
          console.log(`[${orgId}] Using existing restaurant with ID: ${restaurantId}`);

          // Update restaurant platform URL if needed
          await databaseService.updateRestaurantPlatformUrl({
            restaurantId,
            platformId,
            url: storeUrl
          }, orgId);

        } else {
          // Fall back to create/find by name (for standalone extractions)
          const restaurantResult = await databaseService.upsertRestaurant({
            name: restaurantName,
            url: storeUrl,
            platformName: 'ubereats'
          }, orgId);

          if (restaurantResult && restaurantResult.restaurant) {
            restaurantId = restaurantResult.restaurant.id;
            console.log(`[${orgId}] Restaurant created/found with ID: ${restaurantId}`);
          } else {
            throw new Error('Restaurant creation failed - no restaurant data returned');
          }
        }
      } catch (error) {
        console.error(`[${orgId}] Failed to resolve restaurant:`, error.message);
        
        // Fail early - don't continue the extraction without a restaurant ID
        // This avoids wasting resources on extraction that will fail to save
        const errorMessage = `Restaurant creation failed: ${error.message}. Extraction cannot proceed without a valid restaurant.`;
        
        // If this was an async job, update the database status
        if (async) {
          try {
            await databaseService.updateExtractionJob(jobId, {
              status: 'failed',
              error: errorMessage,
              completed_at: new Date().toISOString()
            });
          } catch (dbError) {
            console.error(`[${orgId}] Failed to update job status in database:`, dbError.message);
          }
        }
        
        // Return error response
        return {
          success: false,
          error: errorMessage,
          jobId: jobId
        };
      }
    }
    
    // Store job info
    const jobInfo = {
      jobId,
      storeUrl,
      orgId,
      options,
      status: 'initializing',
      startTime: Date.now(),
      progress: {
        phase: 'starting',
        categoriesExtracted: 0,
        itemsExtracted: 0,
        optionSetsExtracted: 0,
        currentCategory: null
      },
      results: null,
      error: null,
      restaurantId: restaurantId,
      restaurantName: restaurantName,
      menuId: null
    };
    
    this.activeJobs.set(jobId, jobInfo);
    
    // Create database job for persistence (like standard extraction does)
    if (saveToDatabase) {
      try {
        const dbJob = await databaseService.createExtractionJob({
          jobId,
          restaurantId: restaurantId,  // Use the actual restaurant ID
          platformId: platformId,
          url: storeUrl,
          jobType: 'premium_extraction',
          status: 'pending',
          progress: jobInfo.progress,
          extracted_data: {
            extractOptionSets: options.extractOptionSets,
            validateImages: options.validateImages
          }
        }, orgId);
        
        if (dbJob) {
          console.log(`[${orgId}] Created database job for premium extraction: ${jobId}`);
          jobInfo.dbJobId = dbJob.id;
        }
      } catch (error) {
        console.error(`[${orgId}] Failed to create database job:`, error.message);
        // Continue even if database save fails
      }
    }
    
    // If async, return job info immediately
    if (async) {
      // Start extraction in background
      this.runExtraction(jobId).catch(error => {
        console.error(`[${orgId}] Background extraction failed:`, error);
        jobInfo.status = 'failed';
        jobInfo.error = error.message;
      });
      
      return {
        success: true,
        jobId,
        estimatedTime: 180,
        message: 'Premium extraction started in background'
      };
    }
    
    // Otherwise run synchronously
    try {
      const result = await this.runExtraction(jobId);
      return result;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Run the actual extraction process
   * @param {string} jobId - Job ID
   * @returns {object} Extraction results
   */
  async runExtraction(jobId) {
    const jobInfo = this.activeJobs.get(jobId);
    if (!jobInfo) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const { storeUrl, orgId, options, restaurantId } = jobInfo;
    
    // Validate prerequisites before starting extraction
    if (options.saveToDatabase && !restaurantId) {
      const errorMessage = 'Cannot proceed with extraction: Restaurant ID is missing. Restaurant creation must succeed before extraction can begin.';
      console.error(`[${orgId}] ${errorMessage}`);
      
      // Update job status
      jobInfo.status = 'failed';
      jobInfo.error = errorMessage;
      
      // Update database if possible
      try {
        await databaseService.updateExtractionJob(jobId, {
          status: 'failed',
          error: errorMessage,
          completed_at: new Date().toISOString()
        });
      } catch (dbError) {
        console.error(`[${orgId}] Failed to update job status:`, dbError.message);
      }
      
      throw new Error(errorMessage);
    }
    
    try {
      jobInfo.status = 'running';
      
      // Phase 1: Extract categories
      jobInfo.progress.phase = 'extracting_categories';
      console.log(`[${orgId}] Phase 1: Extracting categories`);
      const categories = await this.extractCategories(storeUrl, orgId);
      jobInfo.progress.categoriesExtracted = categories.length;
      
      // Update database job progress
      try {
        await databaseService.updateExtractionJob(jobId, {
          status: 'running',
          progress: jobInfo.progress
        });
      } catch (dbError) {
        console.error(`[${orgId}] Failed to update job progress:`, dbError.message);
      }
      
      // Phase 2: Extract menu items with modal URLs
      jobInfo.progress.phase = 'extracting_items';
      console.log(`[${orgId}] Phase 2: Extracting menu items from ${categories.length} categories`);
      let allItems = [];
      
      // Process categories with concurrency control
      const concurrencyLimit = 2;
      const categoryResults = [];
      
      // Helper function to process a single category
      const processCategory = async (category) => {
        try {
          const categoryItems = await this.extractCategoryItems(storeUrl, category, orgId);
          jobInfo.progress.itemsExtracted = allItems.length + categoryItems.length;
          jobInfo.progress.currentCategory = category;
          return { category, items: categoryItems, success: true };
        } catch (error) {
          console.error(`[${orgId}] Error extracting category "${category}":`, error.message);
          return { category, items: [], success: false, error: error.message };
        }
      };
      
      // Process categories in batches
      for (let i = 0; i < categories.length; i += concurrencyLimit) {
        const batch = categories.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(category => processCategory(category));
        
        try {
          const batchResults = await Promise.all(batchPromises);
          categoryResults.push(...batchResults);
          
          // Collect successful items
          for (const result of batchResults) {
            if (result.success) {
              allItems = allItems.concat(result.items);
            }
          }
          
          console.log(`[${orgId}] Completed batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(categories.length/concurrencyLimit)}, total items: ${allItems.length}`);
        } catch (error) {
          console.error(`[${orgId}] Error processing batch:`, error);
        }
      }
      
      console.log(`[${orgId}] Total items extracted: ${allItems.length}`);
      
      // Phase 3: Clean URLs
      jobInfo.progress.phase = 'cleaning_urls';
      console.log(`[${orgId}] Phase 3: Cleaning modal URLs`);
      const cleaningResult = urlCleaningService.cleanBatchUrls(allItems, orgId);
      const itemsWithCleanUrls = cleaningResult.items;
      
      // Phase 4: Extract option sets (if enabled)
      let itemsWithOptionSets = itemsWithCleanUrls;
      if (options.extractOptionSets) {
        jobInfo.progress.phase = 'extracting_option_sets';
        console.log(`[${orgId}] Phase 4: Extracting option sets`);
        
        const optionSetsResult = await optionSetsService.batchExtract(
          itemsWithCleanUrls,
          orgId,
          2  // Concurrency limit of 2 for Firecrawl API
        );
        
        itemsWithOptionSets = optionSetsResult.items;
        jobInfo.progress.optionSetsExtracted = optionSetsResult.stats.success;
      }
      
      // Phase 5: Deduplicate option sets (if extracted)
      let deduplicationAnalysis = null;
      let deduplicatedData = null;
      if (options.extractOptionSets && itemsWithOptionSets.some(item => item.optionSetsData?.optionSets)) {
        jobInfo.progress.phase = 'deduplicating_option_sets';
        console.log(`[${orgId}] Phase 5: Deduplicating option sets`);
        
        deduplicatedData = optionSetsDeduplicationService.deduplicateForDatabase(itemsWithOptionSets);
        deduplicationAnalysis = deduplicatedData.analysis;
        
        console.log(`[${orgId}] Deduplication results:`);
        console.log(`[${orgId}]   - Shared option sets: ${deduplicationAnalysis.stats.sharedCount}`);
        console.log(`[${orgId}]   - Unique option sets: ${deduplicationAnalysis.stats.uniqueCount}`);
        console.log(`[${orgId}]   - Average usage: ${deduplicationAnalysis.stats.averageUsage.toFixed(1)}`);
        
        // Generate and log the report
        const report = optionSetsDeduplicationService.generateReport(deduplicationAnalysis);
        console.log(`[${orgId}]\n${report}`);
      }
      
      // Phase 6: Validate images (if enabled)
      let imageValidation = null;
      if (options.validateImages) {
        jobInfo.progress.phase = 'validating_images';
        console.log(`[${orgId}] Phase 6: Validating images`);
        imageValidation = await imageValidationService.validateBatch(itemsWithOptionSets, orgId);
      }
      
      // Phase 7: Save to database (if enabled)
      let savedMenu = null;
      if (options.saveToDatabase) {
        jobInfo.progress.phase = 'saving_to_database';
        console.log(`[${orgId}] Phase 7: Saving to database`);
        
        // Initialize database with service role for background operations
        // This avoids JWT expiration issues during long-running extractions
        if (!databaseService.isDatabaseAvailable()) {
          databaseService.initializeDatabase();
        }
        
        // Ensure organization context is set for database operations
        databaseService.setCurrentOrganizationId(orgId);
        
        
        // Update the job status to processing
        await databaseService.updateExtractionJob(jobId, {
          status: 'processing'
        });
        
        // Prepare extraction data in the format expected by saveExtractionResults
        // Map field names to match database expectations and standard extraction
        const menuItemsForSaving = itemsWithOptionSets.map(item => ({
          // Map imageUrl (lowercase) to imageURL (uppercase) - database expects imageURL
          // Premium extraction uses 'imageUrl' (lowercase) throughout phases 1-6
          imageURL: item.imageUrl || item.imageURL || item.dishImageURL || null,
          // Map dishName to name if needed
          dishName: item.dishName || item.name,
          name: item.dishName || item.name,
          // Keep price fields
          dishPrice: item.dishPrice || item.price,
          price: item.dishPrice || item.price,
          // Keep description
          dishDescription: item.dishDescription || item.description,
          description: item.dishDescription || item.description,
          // Category should already be set as categoryName from extraction
          categoryName: item.categoryName,
          // Keep all other fields
          ...item,
          // Prioritize high-quality images from option sets detail page, fallback to category page images
          // Filter out known placeholder images with _static in URL
          imageURL: (() => {
            const candidates = [
              item.optionSetsData?.imageUrl,
              item.imageUrl,
              item.imageURL,
              item.dishImageURL
            ];
            // Find first non-placeholder image
            for (const url of candidates) {
              if (url && !url.includes('_static')) {
                return url;
              }
            }
            return null; // No valid image found
          })()
        }));
        
        // Match the exact structure from standard extraction
        const extractionData = {
          menuItems: menuItemsForSaving,
          categories: categories.map((cat, idx) => ({
            name: cat,
            position: idx + 1,
            itemCount: menuItemsForSaving.filter(item => 
              item.categoryName === cat
            ).length
          }))
        };
        
        console.log(`[${orgId}] Saving extraction data with ${extractionData.categories.length} categories and ${extractionData.menuItems.length} items`);
        
        // Debug: Log category names and item category assignments
        console.log(`[${orgId}] Categories being saved:`, extractionData.categories.map(c => c.name));
        console.log(`[${orgId}] Sample item categories:`, extractionData.menuItems.slice(0, 3).map(item => ({
          name: item.name,
          category: item.categoryName || item.category
        })));
        
        // Debug: Check image URLs are preserved
        const itemsWithImages = extractionData.menuItems.filter(item => item.imageURL);
        console.log(`[${orgId}] Items with images: ${itemsWithImages.length}/${extractionData.menuItems.length}`);
        if (itemsWithImages.length > 0) {
          console.log(`[${orgId}] Sample item with image:`, {
            name: itemsWithImages[0].dishName || itemsWithImages[0].name,
            imageURL: itemsWithImages[0].imageURL?.substring(0, 100) + '...',
            category: itemsWithImages[0].categoryName || itemsWithImages[0].category
          });
        }
        
        // Use the existing saveExtractionResults function which handles the complete flow
        try {
          savedMenu = await databaseService.saveExtractionResults(
            jobId,
            extractionData
          );
          
          if (savedMenu && savedMenu.menu && savedMenu.menu.id) {
            console.log(`[${orgId}] Menu saved successfully with ID: ${savedMenu.menu.id}`);
            jobInfo.menuId = savedMenu.menu.id;
            
            // Now save option sets for each item
            // The savedMenu object contains { menu, categories, items }
            // We need the items array which has the saved menu items with their IDs
            const menuItems = savedMenu.items || [];
            
            // Count items that actually have option sets
            const itemsWithActualOptionSets = itemsWithOptionSets.filter(item => 
              item.optionSetsData?.optionSets && item.optionSetsData.optionSets.length > 0
            );
            
            console.log(`[${orgId}] Starting option sets save. Total items processed: ${itemsWithOptionSets.length}`);
            console.log(`[${orgId}] Items with actual option sets: ${itemsWithActualOptionSets.length}`);
            console.log(`[${orgId}] Total saved menu items found: ${menuItems.length}`);
            
            // Use deduplicated data if available, otherwise skip option sets
            if (deduplicatedData && deduplicatedData.masterOptionSets) {
              console.log(`[${orgId}] Using deduplicated option sets from Phase 5`);
              console.log(`[${orgId}] Master option sets to save: ${deduplicatedData.masterOptionSets.length}`);
              
              // Step 1: Save unique/master option sets (shared ones)
              let savedMasterSets = [];
              if (deduplicatedData.masterOptionSets.length > 0) {
                try {
                  savedMasterSets = await databaseService.bulkSaveUniqueOptionSets(
                    deduplicatedData.masterOptionSets, 
                    orgId
                  );
                  console.log(`[${orgId}] Saved ${savedMasterSets.length} unique option sets`);
                  
                  // Create a map from temporary ID to real database ID
                  const tempIdToRealId = new Map();
                  savedMasterSets.forEach(set => {
                    if (set.temporaryId) {
                      tempIdToRealId.set(set.temporaryId, set.id);
                    }
                  });
                  
                  // Step 2: Process each item and create junction table entries
                  const junctionEntries = [];
                  const menuItemsToUpdate = [];
                  
                  for (const processedItem of deduplicatedData.processedItems) {
                    // Find the saved menu item by matching name
                    const itemName = processedItem.dishName || processedItem.name;
                    const savedItem = menuItems.find(mi => mi.name === itemName);
                    
                    if (!savedItem) {
                      console.log(`[${orgId}] WARNING: Could not find saved menu item for "${itemName}"`);
                      continue;
                    }
                    
                    // Create junction entries for shared option sets
                    if (processedItem.optionSetReferences && processedItem.optionSetReferences.length > 0) {
                      for (const ref of processedItem.optionSetReferences) {
                        const realOptionSetId = tempIdToRealId.get(ref.masterSetId);
                        if (realOptionSetId) {
                          junctionEntries.push({
                            menu_item_id: savedItem.id,
                            option_set_id: realOptionSetId,
                            display_order: ref.displayOrder || 0
                          });
                        }
                      }
                      menuItemsToUpdate.push({ 
                        id: savedItem.id, 
                        name: itemName, 
                        count: processedItem.optionSetReferences.length 
                      });
                    }
                    
                    // Handle unique option sets (item-specific, not shared)
                    if (processedItem.uniqueOptionSets && processedItem.uniqueOptionSets.length > 0) {
                      console.log(`[${orgId}] Item "${itemName}" has ${processedItem.uniqueOptionSets.length} unique option sets`);
                      
                      // Save unique option sets (they also use the new structure without menu_item_id)
                      const savedUniqueSets = await databaseService.bulkSaveUniqueOptionSets(
                        processedItem.uniqueOptionSets,
                        orgId
                      );
                      
                      // Create junction entries for unique sets too
                      for (let i = 0; i < savedUniqueSets.length; i++) {
                        const uniqueSet = savedUniqueSets[i];
                        const originalSet = processedItem.uniqueOptionSets[i];
                        junctionEntries.push({
                          menu_item_id: savedItem.id,
                          option_set_id: uniqueSet.id,
                          display_order: originalSet.displayOrder || i
                        });
                      }
                      
                      menuItemsToUpdate.push({ 
                        id: savedItem.id, 
                        name: itemName, 
                        count: processedItem.uniqueOptionSets.length 
                      });
                    }
                  }
                  
                  // Step 3: Batch create all junction entries
                  if (junctionEntries.length > 0) {
                    console.log(`[${orgId}] Creating ${junctionEntries.length} junction table entries`);
                    const savedJunctions = await databaseService.bulkCreateJunctionEntries(junctionEntries, orgId);
                    console.log(`[${orgId}] Successfully created ${savedJunctions.length} menu item to option set links`);
                  }
                  
                  // Step 4: Update menu items to indicate they have option sets
                  for (const item of menuItemsToUpdate) {
                    await databaseService.updateMenuItemOptionSets(item.id, true, orgId);
                    console.log(`[${orgId}] Updated item "${item.name}" to indicate it has option sets`);
                  }
                  
                  console.log(`[${orgId}] Option sets deduplication and saving complete!`);
                  console.log(`[${orgId}] Stats: ${savedMasterSets.length} unique sets, ${junctionEntries.length} links created`);
                  
                } catch (error) {
                  console.error(`[${orgId}] Error saving deduplicated option sets:`, error.message);
                }
              }
            } else {
              console.log(`[${orgId}] No deduplicated option sets to save (deduplication may be disabled or no option sets found)`);
            }
          } else {
            console.error(`[${orgId}] Menu save did not return expected structure. savedMenu:`, savedMenu);
          }
        } catch (error) {
          console.error(`[${orgId}] Error saving extraction results:`, error);
        }
        
        jobInfo.progress.savedToDatabase = true;
      }
      
      // Compile results
      const results = {
        success: true,
        jobId,
        menuId: jobInfo.menuId || null,  // Include menuId for frontend to load the saved menu
        summary: {
          totalCategories: categories.length,
          totalItems: allItems.length,
          itemsWithCleanUrls: cleaningResult.stats.success,
          itemsWithOptionSets: options.extractOptionSets ? jobInfo.progress.optionSetsExtracted : 0,
          unavailableItems: itemsWithOptionSets.filter(i => i.isUnavailable).length,
          processingTime: Date.now() - jobInfo.startTime
        },
        categories,
        items: itemsWithOptionSets,
        imageValidation: imageValidation?.stats || null,
        optionSetsDeduplication: deduplicationAnalysis?.stats || null
      };
      
      // Update job info
      jobInfo.status = 'completed';
      jobInfo.progress.phase = 'completed';
      jobInfo.results = results;
      
      // Update database job status
      try {
        await databaseService.updateExtractionJob(jobId, {
          status: 'completed',
          progress: {
            ...jobInfo.progress,
            menuId: jobInfo.menuId,
            summary: results.summary
          },
          completed_at: new Date().toISOString()
        });
      } catch (dbError) {
        console.error(`[${orgId}] Failed to update database job status:`, dbError.message);
      }
      
      return results;
      
    } catch (error) {
      console.error(`[${orgId}] Premium extraction failed:`, error);
      jobInfo.status = 'failed';
      jobInfo.error = error.message;
      
      // Update database job status for failure
      try {
        await databaseService.updateExtractionJob(jobId, {
          status: 'failed',
          error: error.message,
          progress: jobInfo.progress,
          completed_at: new Date().toISOString()
        });
      } catch (dbError) {
        console.error(`[${orgId}] Failed to update database job status:`, dbError.message);
      }
      
      throw error;
    }
  }
  
  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {object} Job status and progress
   */
  async getJobStatus(jobId) {
    // First check in-memory jobs
    const jobInfo = this.activeJobs.get(jobId);
    
    if (jobInfo) {
      return {
        success: true,
        jobId,
        status: jobInfo.status,
        menuId: jobInfo.menuId || null,
        progress: jobInfo.progress,
        startTime: jobInfo.startTime,
        elapsedTime: Date.now() - jobInfo.startTime,
        error: jobInfo.error,
        url: jobInfo.storeUrl,
        restaurantName: jobInfo.restaurantName
      };
    }
    
    // If not in memory, check database
    try {
      const dbJob = await databaseService.getExtractionJob(jobId);
      
      if (dbJob) {
        // Return job info from database
        return {
          success: true,
          jobId: dbJob.job_id,
          status: dbJob.state || 'completed',
          menuId: dbJob.menu_id || null,
          progress: dbJob.progress || {},
          startTime: new Date(dbJob.created_at).getTime(),
          elapsedTime: Date.now() - new Date(dbJob.created_at).getTime(),
          error: dbJob.error_message || null,
          url: dbJob.url,
          restaurantName: dbJob.restaurants?.name || 'Restaurant'
        };
      }
    } catch (error) {
      console.error(`Failed to get job from database:`, error.message);
    }
    
    // Job not found anywhere
    return {
      success: false,
      error: 'Job not found'
    };
  }
  
  /**
   * Get job results
   * @param {string} jobId - Job ID
   * @returns {object} Job results if completed
   */
  async getJobResults(jobId) {
    // First check in-memory jobs
    const jobInfo = this.activeJobs.get(jobId);
    
    if (jobInfo) {
      if (jobInfo.status !== 'completed') {
        return {
          success: false,
          error: `Job is ${jobInfo.status}, not completed`
        };
      }
      
      return jobInfo.results;
    }
    
    // If not in memory, check database
    console.log(`[Premium] Checking database for job results: ${jobId}`);
    try {
      const dbJob = await databaseService.getExtractionJob(jobId);
      
      if (dbJob) {
        console.log(`[Premium] Found job in database with status: ${dbJob.status}`);
        // Check if job is completed (use 'status' not 'state')
        if (dbJob.status !== 'completed') {
          return {
            success: false,
            error: `Job is ${dbJob.status}, not completed`
          };
        }
        
        // Get the menu ID from the database
        const menuId = await databaseService.getMenuIdForJob(dbJob.id);
        console.log(`[Premium] Found menu ID: ${menuId}`);
        
        // Return results from database - reconstruct the results format
        return {
          success: true,
          jobId: dbJob.job_id,
          menuId: menuId,
          results: dbJob.result_data || dbJob.extracted_data || {},
          completedAt: dbJob.completed_at
        };
      }
    } catch (error) {
      console.error(`[Premium] Failed to get job results from database:`, error.message);
    }
    
    // Job not found anywhere
    return {
      success: false,
      error: 'Job not found'
    };
  }
  
  /**
   * Clean up old jobs
   * @param {number} maxAge - Maximum age in milliseconds (default 1 hour)
   */
  cleanupJobs(maxAge = 3600000) {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [jobId, jobInfo] of this.activeJobs.entries()) {
      if (now - jobInfo.startTime > maxAge) {
        this.activeJobs.delete(jobId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old jobs`);
    }
  }
}

module.exports = new PremiumExtractionService();