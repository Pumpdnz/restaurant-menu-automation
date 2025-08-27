/**
 * Menu Scraper - Server
 * 
 * Express server that provides API endpoints for scraping UberEats and DoorDash 
 * restaurant pages using the Firecrawl API.
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const archiver = require('archiver');
const sharp = require('sharp');
const { 
  DEFAULT_SCHEMA,
  UBEREATS_SCHEMA,
  DOORDASH_SCHEMA,
  CATEGORY_DETECTION_SCHEMA,
  UBEREATS_CATEGORY_PROMPT,
  DOORDASH_CATEGORY_PROMPT,
  GENERIC_CATEGORY_PROMPT,
  ORDERMEAL_CATEGORY_PROMPT,
  MOBI2GO_CATEGORY_PROMPT,
  NEXTORDER_CATEGORY_PROMPT,
  DELIVEREASY_CATEGORY_PROMPT,
  FOODHUB_CATEGORY_PROMPT,
  MENU_ITEMS_URL_SCHEMA,
  OPTION_SETS_SCHEMA,
  UBEREATS_MENU_ITEMS_URL_PROMPT,
  UBEREATS_OPTION_SETS_PROMPT
} = require('./src/services/firecrawl-service');

// Import database service
const db = require('./src/services/database-service');

// Import platform detector
const { detectPlatform, extractRestaurantName, getExtractionConfig } = require('./src/utils/platform-detector');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3007;

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';

// Environment variables
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';

// Default extraction prompt for restaurant menu data
const DEFAULT_PROMPT = `I need you to extract the complete structured menu data from this restaurant's food delivery platform. They may have multiple menus so please navigate thoroughly through the entire site to view all menus. Scroll from top to bottom to ensure all menu items load. Click on the menu selector dropdown and open all available menus to extract all variants of the menu items across all menus. Ensure all menu items and their details are visible before extraction. Do not include any frequently asked questions. Do not include the thumbs up ratings in the tags array data.`;

// Job management for async operations
const crypto = require('crypto');

// In-memory job store (in production, use Redis or database)
const jobStore = new Map();

// Generate unique job ID
function generateJobId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `batch_${timestamp}_${random}`;
}

// Get job status
function getJobStatus(jobId) {
  const job = jobStore.get(jobId);
  if (!job) {
    return null;
  }
  
  return {
    jobId: job.jobId,
    state: job.state, // 'running', 'completed', 'failed'
    totalCategories: job.totalCategories,
    completedCategories: job.completedCategories,
    failedCategories: job.failedCategories,
    currentCategory: job.currentCategory,
    startTime: job.startTime,
    endTime: job.endTime,
    error: job.error
  };
}

// Get job results
function getJobResults(jobId) {
  const job = jobStore.get(jobId);
  if (!job || job.state !== 'completed') {
    return null;
  }
  
  return {
    jobId: job.jobId,
    state: job.state,
    data: job.data,
    categories: job.categories,
    stats: job.stats
  };
}

// Clean up old jobs (run periodically)
function cleanupOldJobs() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [jobId, job] of jobStore.entries()) {
    if (job.endTime && job.endTime < oneHourAgo) {
      jobStore.delete(jobId);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldJobs, 30 * 60 * 1000);

// Start background extraction process
async function startBackgroundExtraction(jobId, url, categories, restaurantName = null, options = {}) {
  // Initialize job state
  const job = {
    jobId: jobId,
    state: 'running',
    url: url,
    totalCategories: categories.length,
    completedCategories: 0,
    failedCategories: 0,
    currentCategory: null,
    startTime: Date.now(),
    options: {
      includeImages: options.includeImages !== false,
      generateCSV: options.generateCSV !== false,
      ...options
    },
    endTime: null,
    data: null,
    categories: {
      successful: [],
      failed: []
    },
    error: null
  };
  
  jobStore.set(jobId, job);
  
  // Initialize database job if available
  let dbJob = null;
  let restaurant = null;
  let platform = null;
  
  try {
    // Detect platform type using the new detector
    const platformInfo = detectPlatform(url);
    const platformName = platformInfo.name;
    
    // Try to extract restaurant name from URL if not provided
    if (!restaurantName) {
      restaurantName = extractRestaurantName(url, platformInfo);
    }
    
    // Save to database if available
    if (db.isDatabaseAvailable() && restaurantName) {
      try {
        // Get the existing extraction job that was already created
        dbJob = await db.getExtractionJob(jobId);
        
        if (dbJob) {
          restaurant = { id: dbJob.restaurant_id };
          
          // Update job status to running
          await db.updateExtractionJob(jobId, {
            status: 'running',
            started_at: new Date().toISOString(),
            progress: { 
              totalCategories: categories.length,
              completedCategories: 0
            }
          });
        }
      } catch (dbError) {
        console.log(`[Database] Note: ${dbError.message}`);
        // Continue without database tracking if there's an issue
      }
    }
    
    // Process each category
    const categoryResults = [];
    const failedCategories = [];
    
    // Process categories with concurrency limit of 2
    const concurrencyLimit = 2;
    const processingQueue = [...categories];
    const activePromises = new Map();
    
    // Helper function to process a single category
    const processCategory = async (category) => {
      const categoryId = `${category.name}_${Date.now()}`;
      
      try {
        console.log(`[Job ${jobId}] Starting extraction for category: ${category.name}`);
        
        // Create category-specific schema (same as existing code)
        const categorySchema = {
          "type": "object",
          "properties": {
            "categoryName": {
              "type": "string", 
              "description": `The name of this specific menu category: "${category.name}"`
            },
            "menuItems": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "dishName": { "type": "string", "description": "The name of the dish as displayed on the menu" },
                  "dishPrice": { "type": "number", "description": "The price of the dish as a numerical value" },
                  "dishDescription": { "type": "string", "description": "Full description of the dish including ingredients and preparation style. DO NOT include tags related to 'most liked' or 'Plus small'" },
                  "imageURL": { "type": "string", "description": "URL to the highest resolution image of the dish available" },
                  "tags": { "type": "array", "items": { "type": "string" }, "description": "Any tags or attributes for this dish. DO NOT include tags related to 'Thumb up outline' or percentages. DO NOT include tags related to 'most liked' or 'Plus small'" }
                },
                "required": ["dishName", "dishPrice"]
              }
            }
          },
          "required": ["categoryName", "menuItems"]
        };
        
        // Create category-specific prompt
        const categoryPrompt = `Focus ONLY on extracting menu items from the category "${category.name}" on this ${platformName} page.
        
1. Navigate to the section for category "${category.name}" ${category.position ? `(approximately at position ${category.position} from the top)` : ''}
2. ${category.selector ? `Look for elements matching the selector "${category.selector}"` : 'Locate the category header or section'}
3. Extract ONLY the menu items within this specific category
4. For each item, get the name, price, description, and image URL (if available)
5. If an item has image, click to open its details to get the high-resolution image
6. DO NOT include items from other categories
7. Ensure the categoryName field exactly matches "${category.name}"`;
        
        // Debug logging for per-category extraction
        console.log(`[Job ${jobId}] DEBUG - Category "${category.name}" Extraction Schema:`, JSON.stringify(categorySchema, null, 2).substring(0, 500) + '...');
        console.log(`[Job ${jobId}] DEBUG - Category "${category.name}" Extraction Prompt:`, categoryPrompt.substring(0, 300) + '...');
        
        // Prepare v2 category-specific payload
        const categoryPayload = {
          url: url,
          formats: [{
            type: 'json',
            schema: categorySchema,
            prompt: categoryPrompt
          }],
          onlyMainContent: true,
          waitFor: 2000,
          blockAds: true,
          timeout: 180000,
          maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'),
          skipTlsVerification: true,
          removeBase64Images: true
        };
        
        const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
        
        // Make request to Firecrawl API
        const axiosInstance = axios.create({
          timeout: 240000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
          }
        });
        
        const categoryResponse = await axiosInstance.post(apiEndpoint, categoryPayload);
        
        // Parse v2 response
        const parsedCategoryResponse = categoryResponse.data;
        
        if (!parsedCategoryResponse.success) {
          throw new Error(`API returned error: ${parsedCategoryResponse.error || 'Unknown error'}`);
        }
        
        // Extract category result
        let categoryResult = null;
        if (parsedCategoryResponse.data && parsedCategoryResponse.data.json) {
          categoryResult = parsedCategoryResponse.data.json;
        }
        
        if (categoryResult && categoryResult.menuItems && Array.isArray(categoryResult.menuItems)) {
          console.log(`[Job ${jobId}] Successfully extracted ${categoryResult.menuItems.length} items for category "${category.name}"`);
          categoryResults.push(categoryResult);
          job.completedCategories++;
          job.categories.successful.push(category.name);
        } else {
          console.warn(`[Job ${jobId}] No menu items found for category "${category.name}"`);
          failedCategories.push({ name: category.name, error: 'No menu items found' });
          job.failedCategories++;
          job.categories.failed.push({ name: category.name, error: 'No menu items found' });
        }
        
      } catch (categoryError) {
        console.error(`[Job ${jobId}] Error extracting category "${category.name}":`, categoryError.message);
        failedCategories.push({ name: category.name, error: categoryError.message });
        job.failedCategories++;
        job.categories.failed.push({ name: category.name, error: categoryError.message });
      } finally {
        // Always update job state after processing
        jobStore.set(jobId, job);
      }
      
      return categoryId;
    };
    
    // Process categories with concurrency control
    while (processingQueue.length > 0 || activePromises.size > 0) {
      // Start new processes up to the concurrency limit
      while (processingQueue.length > 0 && activePromises.size < concurrencyLimit) {
        const category = processingQueue.shift();
        const promise = processCategory(category);
        const categoryId = `${category.name}_${Date.now()}`;
        activePromises.set(categoryId, promise);
        
        // Remove from active promises when done
        promise.then(() => {
          activePromises.delete(categoryId);
        }).catch(() => {
          activePromises.delete(categoryId);
        });
      }
      
      // Wait for at least one to complete if we're at the limit
      if (activePromises.size > 0) {
        await Promise.race(activePromises.values());
      }
      
      // Update current category for status tracking
      if (processingQueue.length > 0) {
        job.currentCategory = `Processing ${activePromises.size} categories concurrently`;
      } else {
        job.currentCategory = 'Finishing remaining categories';
      }
      jobStore.set(jobId, job);
    }
    
    // Aggregate results
    const menuItems = categoryResults.flatMap(result => 
      result.menuItems.map(item => ({
        ...item,
        categoryName: result.categoryName
      }))
    );
    
    console.log(`[Job ${jobId}] Successfully extracted a total of ${menuItems.length} menu items across ${categoryResults.length} categories`);
    
    // Save extraction results to database
    if (db.isDatabaseAvailable() && dbJob) {
      try {
        const extractionData = {
          menuItems: menuItems,
          categories: categories.map((cat, idx) => ({
            ...cat,
            itemCount: categoryResults.find(r => r.categoryName === cat.name)?.menuItems?.length || 0
          }))
        };
        
        const dbResult = await db.saveExtractionResults(jobId, extractionData);
        if (dbResult) {
          console.log(`[Job ${jobId}] Results saved to database - Menu ID: ${dbResult.menu.id}`);
          // Store menu ID for later reference
          job.menuId = dbResult.menu.id;
        }
      } catch (dbError) {
        console.error(`[Job ${jobId}] Failed to save to database:`, dbError.message);
        // Continue even if database save fails
      }
    }
    
    // Update job with final results
    job.state = 'completed';
    job.endTime = Date.now();
    job.data = { menuItems: menuItems };
    job.stats = {
      totalItems: menuItems.length,
      successfulCategories: categoryResults.length,
      failedCategories: failedCategories.length,
      processingTime: job.endTime - job.startTime
    };
    // Include menu ID if available
    if (job.menuId) {
      job.stats.menuId = job.menuId;
    }
    
    jobStore.set(jobId, job);
    
  } catch (error) {
    console.error(`[Job ${jobId}] Fatal error during extraction:`, error.message);
    
    // Update database job if available
    if (db.isDatabaseAvailable() && dbJob) {
      await db.updateExtractionJob(jobId, {
        status: 'failed',
        error: error.message,
        completed_at: new Date().toISOString()
      });
    }
    
    // Update job with error
    job.state = 'failed';
    job.endTime = Date.now();
    job.error = error.message;
    
    jobStore.set(jobId, job);
  }
}

// Configure middleware
app.use(cors({
  origin: ['http://localhost:3007', 'http://localhost:5007', '*'],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

/**
 * Helper function to validate restaurant URLs
 */
function validateRestaurantUrl(url, res) {
  if (!url) {
    res.status(400).json({ 
      success: false, 
      error: 'URL is required' 
    });
    return false;
  }
  
  // Validate URL format
  try {
    new URL(url);
    return true;
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid URL format'
    });
    return false;
  }
}

// Legacy endpoints removed during cleanup:
// - POST /api/extract - Single-scrape method (deprecated)
// - GET /api/extract-status/:id - Status checking for v1 extract (deprecated)
// - GET /api/extract-results/:id - Results retrieval for v1 extract (deprecated)
// - POST /api/scrape - Direct scraping endpoint (deprecated)
// Only batch extraction method is now used


/**
 * API endpoint to generate CSV
 */
app.post('/api/generate-csv', (req, res) => {
  const { data, options } = req.body;
  
  if (!data || !data.menuItems) {
    return res.status(400).json({
      success: false,
      error: 'Valid menu data is required'
    });
  }
  
  console.log(`Generating CSV for ${data.menuItems.length} menu items`);
  
  try {
    // CSV Headers
    const headers = [
      'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
      'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
      'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
      'displayName', 'printName', 'tags', 'imageURL'
    ];
    
    // Default dish type
    const DEFAULT_DISH_TYPE = 'standard';
    
    // Extract options
    const comboItems = options?.comboItems || [];
    const fieldEdits = options?.fieldEdits || {};
    
    // Generate rows
    const rows = [];
    
    // Process each menu item
    data.menuItems.forEach(item => {
      // Apply any custom field edits if they exist
      const customItem = {
        ...item,
        ...(fieldEdits[item.dishName] || {})
      };
      
      // Use consistent menu name for all items
      const menuName = 'Menu'; // Always use 'Menu' consistently
      
      // Determine if this item is a combo
      const isDishTypeCombo = comboItems.includes(customItem.dishName);
      const dishType = isDishTypeCombo ? 'combo' : DEFAULT_DISH_TYPE;
      
      // Format tags as a comma-separated string
      const tagsString = customItem.tags && Array.isArray(customItem.tags) 
        ? customItem.tags.join(', ')
        : '';
      
      // Use the appropriate image URL based on available fields
      let imageURL = customItem.imageURL || '';
      if (!imageURL && customItem.fullSizeImageURL) {
        imageURL = customItem.fullSizeImageURL;
      } else if (!imageURL && customItem.thumbnailURL) {
        imageURL = customItem.thumbnailURL;
      }
      
      // Build the CSV row with all required fields
      rows.push([
        '', // menuID - leave blank
        escapeCSVField(menuName), // menuName
        '', // menuDisplayName - leave blank
        '', // menuDescription - leave blank
        '', // categoryID - leave blank
        escapeCSVField(customItem.categoryName || 'Uncategorized'), // categoryName
        '', // categoryDisplayName - leave blank
        '', // categoryDescription - leave blank
        '', // dishID - leave blank
        escapeCSVField(customItem.dishName || ''), // dishName
        formatPrice(customItem.dishPrice || 0), // dishPrice
        dishType, // dishType - standard or combo
        escapeCSVField(customItem.dishDescription || ''), // dishDescription
        '', // displayName - leave blank
        '', // printName - leave blank
        escapeCSVField(tagsString), // tags
        escapeCSVField(imageURL) // imageURL - include the image URL in CSV
      ]);
    });
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    // Generate restaurant name for filename suggestion
    let restaurantName = 'restaurant';
    if (data.restaurantInfo && data.restaurantInfo.name) {
      restaurantName = data.restaurantInfo.name;
    } else if (data.menuItems && data.menuItems.length > 0 && data.menuItems[0].menuName) {
      restaurantName = data.menuItems[0].menuName;
    }
    
    // Format filename
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `${formatFilename(restaurantName)}_menu_${date}.csv`;
    
    // Return the CSV data and metadata
    return res.json({
      success: true,
      csvData: csvContent,
      filename: filename,
      stats: {
        rowCount: rows.length,
        columnCount: headers.length
      }
    });
  } catch (error) {
    console.error('CSV generation error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: `CSV generation failed: ${error.message}`
    });
  }
});

/**
 * Enhanced API endpoint to generate CLEAN CSV with automatic phrase removal
 * This endpoint generates both versions: with and without imageURL column
 */
app.post('/api/generate-clean-csv', (req, res) => {
  const { data, options } = req.body;
  
  if (!data || !data.menuItems) {
    return res.status(400).json({
      success: false,
      error: 'Valid menu data is required'
    });
  }
  
  console.log(`Generating clean CSV for ${data.menuItems.length} menu items`);
  
  // Phrases to remove from all fields
  const UNWANTED_PHRASES = [
    'Plus small',
    'Thumb up outline',
    'No. 1 most liked',
    'No. 2 most liked',
    'No. 3 most liked'
  ];
  
  // Regex patterns to remove
  const REGEX_PATTERNS = [
    /\d+%/g,        // Percentages like "93%"
    /\(\d+\)/g      // Counts in parentheses like "(30)"
  ];
  
  /**
   * Clean a field value by removing unwanted phrases while preserving legitimate content
   */
  function cleanField(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    let cleaned = value;
    
    // Remove each unwanted phrase
    UNWANTED_PHRASES.forEach(phrase => {
      cleaned = cleaned.replace(new RegExp(phrase, 'g'), '');
    });
    
    // Remove regex patterns
    REGEX_PATTERNS.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Clean up multiple semicolons, commas, and extra spaces
    if (cleaned.includes(';') || UNWANTED_PHRASES.some(phrase => value.includes(phrase))) {
      cleaned = cleaned.replace(/;\s*;/g, ';');     // Remove duplicate semicolons
      cleaned = cleaned.replace(/,\s*,/g, ',');     // Remove duplicate commas
      cleaned = cleaned.replace(/\s+/g, ' ');       // Normalize spaces
      cleaned = cleaned.replace(/^\s*[;,]\s*/, ''); // Remove leading punctuation
      cleaned = cleaned.replace(/\s*[;,]\s*$/, ''); // Remove trailing punctuation
    }
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Return empty string if we removed everything
    return cleaned || '';
  }
  
  try {
    // CSV Headers
    const headers = [
      'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
      'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
      'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
      'displayName', 'printName', 'tags', 'imageURL'
    ];
    
    // Headers without imageURL
    const headersNoImages = headers.slice(0, -1);
    
    // Default dish type
    const DEFAULT_DISH_TYPE = 'standard';
    
    // Extract options
    const comboItems = options?.comboItems || [];
    const fieldEdits = options?.fieldEdits || {};
    
    // Generate rows with cleaning applied
    const rows = [];
    
    // Process each menu item
    data.menuItems.forEach(item => {
      // Apply any custom field edits if they exist
      const customItem = {
        ...item,
        ...(fieldEdits[item.dishName] || {})
      };
      
      // Use consistent menu name for all items
      const menuName = 'Menu'; // Always use 'Menu' consistently
      
      // Determine if this item is a combo
      const isDishTypeCombo = comboItems.includes(customItem.dishName);
      const dishType = isDishTypeCombo ? 'combo' : DEFAULT_DISH_TYPE;
      
      // Clean and format tags
      let tagsString = '';
      if (customItem.tags) {
        if (Array.isArray(customItem.tags)) {
          tagsString = customItem.tags.join(', ');
        } else {
          tagsString = String(customItem.tags);
        }
        // Apply cleaning to tags
        tagsString = cleanField(tagsString);
      }
      
      // Clean dish description
      const cleanedDescription = cleanField(customItem.dishDescription || '');
      
      // Clean dish name (in case it has unwanted phrases)
      const cleanedDishName = cleanField(customItem.dishName || '');
      
      // Clean category name
      const cleanedCategoryName = cleanField(customItem.categoryName || 'Uncategorized');
      
      // Use the appropriate image URL based on available fields
      let imageURL = customItem.imageURL || '';
      if (!imageURL && customItem.fullSizeImageURL) {
        imageURL = customItem.fullSizeImageURL;
      } else if (!imageURL && customItem.thumbnailURL) {
        imageURL = customItem.thumbnailURL;
      }
      
      // Build the CSV row with all required fields
      rows.push([
        '', // menuID - leave blank
        escapeCSVField(menuName), // menuName
        '', // menuDisplayName - leave blank
        '', // menuDescription - leave blank
        '', // categoryID - leave blank
        escapeCSVField(cleanedCategoryName), // categoryName (cleaned)
        '', // categoryDisplayName - leave blank
        '', // categoryDescription - leave blank
        '', // dishID - leave blank
        escapeCSVField(cleanedDishName), // dishName (cleaned)
        formatPrice(customItem.dishPrice || 0), // dishPrice
        dishType, // dishType - standard or combo
        escapeCSVField(cleanedDescription), // dishDescription (cleaned)
        '', // displayName - leave blank
        '', // printName - leave blank
        escapeCSVField(tagsString), // tags (cleaned)
        escapeCSVField(imageURL) // imageURL
      ]);
    });
    
    // Build CSV content WITH images
    let csvContentWithImages = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContentWithImages += row.join(',') + '\n';
    });
    
    // Build CSV content WITHOUT images (remove last column)
    let csvContentNoImages = headersNoImages.join(',') + '\n';
    rows.forEach(row => {
      const rowWithoutImage = row.slice(0, -1); // Remove last element (imageURL)
      csvContentNoImages += rowWithoutImage.join(',') + '\n';
    });
    
    // Generate restaurant name for filename suggestion
    let restaurantName = 'restaurant';
    if (data.restaurantInfo && data.restaurantInfo.name) {
      restaurantName = data.restaurantInfo.name;
    } else if (data.menuItems && data.menuItems.length > 0 && data.menuItems[0].menuName) {
      restaurantName = data.menuItems[0].menuName;
    }
    
    // Format filename
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const formattedName = formatFilename(restaurantName);
    const filenameWithImages = `${formattedName}_menu_${date}.csv`;
    const filenameNoImages = `${formattedName}_menu_${date}_no_images.csv`;
    
    // Count cleaned items for reporting
    let cleanedFieldsCount = 0;
    data.menuItems.forEach(item => {
      if (item.dishDescription && item.dishDescription !== cleanField(item.dishDescription)) cleanedFieldsCount++;
      if (item.dishName && item.dishName !== cleanField(item.dishName)) cleanedFieldsCount++;
      if (item.tags && item.tags !== cleanField(item.tags)) cleanedFieldsCount++;
    });
    
    // Return both CSV versions and metadata
    return res.json({
      success: true,
      csvDataWithImages: csvContentWithImages,
      csvDataNoImages: csvContentNoImages,
      filenameWithImages: filenameWithImages,
      filenameNoImages: filenameNoImages,
      stats: {
        rowCount: rows.length,
        columnCount: headers.length,
        cleanedFields: cleanedFieldsCount,
        removedPhrases: UNWANTED_PHRASES
      }
    });
  } catch (error) {
    console.error('Clean CSV generation error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: `Clean CSV generation failed: ${error.message}`
    });
  }
});

/**
 * Helper function: Format price consistently
 */
function formatPrice(price) {
  // Handle various price formats
  if (typeof price === 'string') {
    // Remove currency symbols and whitespace
    price = price.replace(/[$€£¥\s]/g, '');
    
    // Parse to float
    price = parseFloat(price);
  }
  
  // Handle NaN or invalid values
  if (isNaN(price)) {
    return '0.00';
  }
  
  // Format with 2 decimal places
  return price.toFixed(2);
}

/**
 * Helper function: Escape a field for CSV
 */
function escapeCSVField(field) {
  if (field === undefined || field === null) {
    return '';
  }
  
  const stringField = String(field);
  
  // If the field contains commas, quotes, or newlines, enclose it in quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    // Double up any quotes within the field
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * Helper function: Format a filename to be filesystem-safe
 */
function formatFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

/**
 * API endpoint for scanning restaurant menu categories
 * This is the first phase of the two-phase extraction process
 */
app.post('/api/scan-categories', async (req, res) => {
  const { url } = req.body;
  
  // Validate URL
  if (!validateRestaurantUrl(url, res)) {
    return;
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Starting menu category scan for URL: ${url}`);
  
  try {
    // Detect platform type
    const platformInfo = detectPlatform(url);
    
    // Use platform-specific prompts
    let categoryPrompt;
    
    if (platformInfo.name === 'UberEats') {
      console.log('Using UberEats-specific category detection prompt');
      console.log('UBEREATS_CATEGORY_PROMPT exists:', !!UBEREATS_CATEGORY_PROMPT);
      console.log('UBEREATS_CATEGORY_PROMPT first 100 chars:', UBEREATS_CATEGORY_PROMPT?.substring(0, 100));
      categoryPrompt = UBEREATS_CATEGORY_PROMPT;
    } else if (platformInfo.name === 'DoorDash') {
      console.log('Using DoorDash-specific category detection prompt');
      categoryPrompt = DOORDASH_CATEGORY_PROMPT;
    } else if (platformInfo.name === 'OrderMeal') {
      console.log('Using OrderMeal-specific category detection prompt');
      categoryPrompt = ORDERMEAL_CATEGORY_PROMPT;
    } else if (platformInfo.name === 'Mobi2Go') {
      console.log('Using Mobi2Go-specific category detection prompt');
      categoryPrompt = MOBI2GO_CATEGORY_PROMPT;
    } else if (platformInfo.name === 'NextOrder') {
      console.log('Using NextOrder-specific category detection prompt');
      categoryPrompt = NEXTORDER_CATEGORY_PROMPT;
    } else if (platformInfo.name === 'DeliverEasy') {
      console.log('Using DeliverEasy-specific category detection prompt');
      categoryPrompt = DELIVEREASY_CATEGORY_PROMPT;
    } else if (platformInfo.name === 'FoodHub') {
      console.log('Using FoodHub-specific category detection prompt');
      categoryPrompt = FOODHUB_CATEGORY_PROMPT;
    } else {
      // Use generic prompt as default for unknown platforms
      console.log(`Using generic category detection prompt for platform: ${platformInfo.name}`);
      categoryPrompt = GENERIC_CATEGORY_PROMPT;
    }
    
    // Prepare v2 request payload for category detection
    const payload = {
      url: url,
      formats: [{
        type: 'json',
        schema: CATEGORY_DETECTION_SCHEMA,
        prompt: categoryPrompt
      }],
      onlyMainContent: true,
      waitFor: 2000, // Wait 2 seconds for page to load properly
      blockAds: true, // Block ads and cookie popups
      timeout: 90000, // 1.5 minute timeout (category scan should be faster than full extraction)
      maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'),
      skipTlsVerification: true,
      removeBase64Images: true
    };
    
    const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
    
    console.log('Category scan payload:', JSON.stringify(payload, null, 2));
    
    // Create axios instance
    const axiosInstance = axios.create({
      timeout: 120000, // 2 minute timeout 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      }
    });
    
    // Make request to Firecrawl API
    console.log('Making category scan request to:', apiEndpoint);
    console.log('[Agent Workflow] DEBUG - Category Detection Prompt:', categoryPrompt.substring(0, 200) + '...');
    console.log('[Agent Workflow] DEBUG - Category Detection Schema:', JSON.stringify(CATEGORY_DETECTION_SCHEMA, null, 2));
    
    const response = await axiosInstance.post(apiEndpoint, payload);
    
    // Log response summary
    console.log('Category scan response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    
    // Debug log for response structure if needed
    if (process.env.DEBUG_MODE === 'true') {
      console.log('\n🔍 DEBUG - Firecrawl v2 Response Analysis:');
      console.log('Response status:', response.status);
      console.log('Response data keys:', response.data ? Object.keys(response.data) : 'null');
      
      // Log sample of response for debugging
      const responseStr = JSON.stringify(response.data, null, 2);
      console.log('Response preview (first 1000 chars):', responseStr.substring(0, 1000));
    }
    
    // Parse v2 response
    const parsedResponse = response.data;
    
    // Check if response is valid
    if (!parsedResponse || typeof parsedResponse !== 'object') {
      throw new Error(`Invalid response from Firecrawl API`);
    }
    
    // Check for API error
    if (parsedResponse.success === false && parsedResponse.error) {
      throw new Error(`Firecrawl API error: ${parsedResponse.error}`);
    }
    
    // Extract categories from response - v2 structure
    let categories = [];
    
    // Firecrawl v2 returns JSON extraction in data.json
    if (parsedResponse.data && parsedResponse.data.json && parsedResponse.data.json.categories) {
      categories = parsedResponse.data.json.categories;
      console.log(`✅ Found ${categories.length} categories in Firecrawl response`);
    }
    // Fallback: check direct json field (some v2 responses)
    else if (parsedResponse.json && parsedResponse.json.categories) {
      categories = parsedResponse.json.categories;
      console.log(`✅ Found ${categories.length} categories in Firecrawl response (direct json)`);
    }
    else {
      // Try to search deeper in the response for categories
      console.log('Searching for categories in response structure...');
      
      const findCategories = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return null;
        
        if (obj.categories && Array.isArray(obj.categories)) {
          console.log(`Found categories at path: ${path}`);
          return obj.categories;
        }
        
        for (const key in obj) {
          const newPath = path ? `${path}.${key}` : key;
          const result = findCategories(obj[key], newPath);
          if (result) return result;
        }
        
        return null;
      };
      
      const foundCategories = findCategories(parsedResponse.data);
      if (foundCategories) {
        categories = foundCategories;
      }
    }
    
    // Validate categories
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      console.warn('No categories found in the response, the menu might not have distinct categories');
      categories = [{ name: "All Items", position: 1 }]; // Default fallback
    }
    
    console.log(`Successfully identified ${categories.length} menu categories`);
    console.log('Categories:', JSON.stringify(categories, null, 2));
    
    // Return the extracted categories
    return res.json({
      success: true,
      data: { 
        categories: categories,
        platformType: platformInfo.name.toLowerCase()
      }
    });
  } catch (error) {
    console.error('Category scan error:', error.message);
    
    // Log detailed error information if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      success: false,
      error: `Category scan failed: ${error.message}`
    });
  }
});

/**
 * API endpoint for extracting images for a specific category
 * Uses focused prompts to match images to existing menu items
 */
app.post('/api/extract-images-for-category', async (req, res) => {
  const { url, categoryName, menuItems, platform = 'ubereats' } = req.body;
  
  if (!url || !categoryName || !menuItems || !Array.isArray(menuItems)) {
    return res.status(400).json({
      success: false,
      error: 'URL, category name, and menu items are required'
    });
  }
  
  console.log(`Image extraction request for category "${categoryName}" with ${menuItems.length} items`);
  
  // Check for API key
  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY environment variable is not set');
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  try {
    // Import the helper functions
    const { generateImageFocusedPrompt, generateImageOnlySchema } = require('./src/utils/image-extraction-helpers.js');
    
    // Generate specialized prompt and schema
    const imagePrompt = generateImageFocusedPrompt(menuItems, categoryName, platform);
    const imageSchema = generateImageOnlySchema();
    
    // Configure Firecrawl v2 for image extraction
    const firecrawlConfig = {
      url: url,
      formats: [{
        type: 'json',
        schema: imageSchema,
        prompt: imagePrompt
      }],
      onlyMainContent: true,
      waitFor: 2000,
      blockAds: true,
      timeout: 120000,
      maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'),
      skipTlsVerification: true,
      removeBase64Images: true
    };
    
    const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
    
    // Try to validate the schema is correct JSON
    try {
      JSON.stringify(imageSchema);
    } catch (schemaError) {
      console.error('Invalid schema:', schemaError);
      throw new Error('Invalid schema format');
    }
    
    console.log('Calling Firecrawl with image-focused configuration...');
    console.log('API key present:', FIRECRAWL_API_KEY ? `Yes (${FIRECRAWL_API_KEY.substring(0, 5)}...)` : 'No');
    console.log('Firecrawl request payload:', JSON.stringify(firecrawlConfig, null, 2));
    console.log('Making request to:', apiEndpoint);
    
    const response = await axios.post(
      apiEndpoint,
      firecrawlConfig,
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000
      }
    );
    
    // Log the response for debugging
    console.log('Firecrawl response received');
    
    // Parse v2 response
    const parsedResponse = response.data;
    
    if (!parsedResponse.success) {
      console.error('Firecrawl extraction failed:', parsedResponse);
      throw new Error(parsedResponse.error || 'Failed to extract images from Firecrawl');
    }
    
    // Extract and validate the results
    let extractedItems = [];
    
    // Check different possible response structures
    if (parsedResponse.data && parsedResponse.data.json) {
      // Standard v1/v2 response structure
      const data = parsedResponse.data.json;
      if (data.menuItems && Array.isArray(data.menuItems)) {
        extractedItems = data.menuItems;
      } else if (Array.isArray(data)) {
        extractedItems = data;
      }
    } else if (parsedResponse.data) {
      // Fallback for direct data
      const data = parsedResponse.data;
      if (data.menuItems && Array.isArray(data.menuItems)) {
        extractedItems = data.menuItems;
      } else if (Array.isArray(data)) {
        extractedItems = data;
      }
    }
    
    console.log(`Extracted ${extractedItems.length} items with images`);
    
    return res.json({
      success: true,
      data: {
        menuItems: extractedItems,
        categoryName: categoryName
      }
    });
  } catch (error) {
    console.error('Image extraction error:', error.message);
    
    // Log more details if it's an axios error
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      
      // Log the request that was sent for debugging
      if (error.config) {
        console.error('Request URL:', error.config.url);
        console.error('Request method:', error.config.method);
        console.error('Request data:', error.config.data);
      }
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract images'
    });
  }
});

/**
 * API endpoint for batch extracting menu items by category
 * This is the second phase of the two-phase extraction process
 */
app.post('/api/batch-extract-categories', async (req, res) => {
  const { url, categories, async = false, restaurantName } = req.body;
  
  // Validate URL
  if (!validateRestaurantUrl(url, res)) {
    return;
  }
  
  // Validate categories
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one category is required'
    });
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Starting batch category extraction for URL: ${url}`);
  console.log(`Extracting ${categories.length} categories: ${categories.map(c => c.name).join(', ')}`);
  console.log(`Mode: ${async ? 'asynchronous' : 'synchronous'}`);
  
  // Asynchronous mode - return job ID immediately
  if (async) {
    const jobId = generateJobId();
    
    // Start extraction in background
    startBackgroundExtraction(jobId, url, categories, restaurantName);
    
    // Calculate estimated time (30 seconds per category)
    const estimatedSeconds = categories.length * 30;
    
    // Return job information immediately
    return res.json({
      success: true,
      jobId: jobId,
      message: 'Batch extraction started',
      estimatedTime: estimatedSeconds,
      statusUrl: `/api/batch-extract-status/${jobId}`,
      resultsUrl: `/api/batch-extract-results/${jobId}`
    });
  }
  
  // Original synchronous mode - keep existing implementation
  try {
    // Detect platform type
    const platformInfo = detectPlatform(url);
    const platformName = platformInfo.name;
    
    // Process each category (for now we'll process them sequentially)
    // In future this could be parallelized for better performance
    const categoryResults = [];
    const failedCategories = [];
    
    for (const category of categories) {
      try {
        console.log(`Extracting category: ${category.name}`);
        
        // Create category-specific schema
        const categorySchema = {
          "type": "object",
          "properties": {
            "categoryName": {
              "type": "string", 
              "description": `The name of this specific menu category: "${category.name}"`
            },
            "menuItems": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "dishName": {
                    "type": "string",
                    "description": "The name of the dish as displayed on the menu"
                  },
                  "dishPrice": {
                    "type": "number",
                    "description": "The price of the dish as a numerical value"
                  },
                  "dishDescription": {
                    "type": "string",
                    "description": "Full description of the dish including ingredients and preparation style"
                  },
                  "imageURL": {
                    "type": "string",
                    "description": "URL to the highest resolution image of the dish available"
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Any tags or attributes for this dish"
                  }
                },
                "required": ["dishName", "dishPrice"]
              }
            }
          },
          "required": ["categoryName", "menuItems"]
        };
        
        // Create category-specific prompt
        const categoryPrompt = `Focus ONLY on extracting menu items from the category "${category.name}" on this ${platformName} page.
        
1. Navigate to the section for category "${category.name}" ${category.position ? `(approximately at position ${category.position} from the top)` : ''}
2. ${category.selector ? `Look for elements matching the selector "${category.selector}"` : 'Locate the category header or section'}
3. Extract ONLY the menu items within this specific category
4. For each item, get the name, price, description, and image URL (if available)
5. If an item has image, click to open its details to get the high-resolution image
6. DO NOT include items from other categories
7. Ensure the categoryName field exactly matches "${category.name}"`;
        
        // Debug logging for per-category extraction
        console.log(`[Job ${jobId}] DEBUG - Category "${category.name}" Extraction Schema:`, JSON.stringify(categorySchema, null, 2).substring(0, 500) + '...');
        console.log(`[Job ${jobId}] DEBUG - Category "${category.name}" Extraction Prompt:`, categoryPrompt.substring(0, 300) + '...');
        
        // Prepare v2 category-specific payload
        const categoryPayload = {
          url: url,
          formats: [{
            type: 'json',
            schema: categorySchema,
            prompt: categoryPrompt
          }],
          onlyMainContent: true,
          waitFor: 2000,
          blockAds: true,
          timeout: 180000, // 3 minute timeout per category
          maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'),
          skipTlsVerification: true,
          removeBase64Images: true
        };
        
        const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
        
        console.log(`Category extraction payload for "${category.name}":`, JSON.stringify(categoryPayload, null, 2));
        
        // Create axios instance
        const axiosInstance = axios.create({
          timeout: 240000, // 4 minute timeout (longer than the scrape timeout)
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
          }
        });
        
        // Make request to Firecrawl API
        const categoryResponse = await axiosInstance.post(apiEndpoint, categoryPayload);
        
        // Log response summary
        console.log(`Category "${category.name}" extraction response status:`, categoryResponse.status);
        
        // Parse v2 response
        const parsedCategoryResponse = categoryResponse.data;
        
        if (!parsedCategoryResponse.success) {
          throw new Error(`API returned error: ${parsedCategoryResponse.error || 'Unknown error'}`);
        }
        
        // Extract category result from response
        let categoryResult = null;
        
        // Check standard json location
        if (parsedCategoryResponse.data && parsedCategoryResponse.data.json) {
          console.log(`Found category "${category.name}" data in data.json`);
          categoryResult = parsedCategoryResponse.data.json;
        }
        // Look in other potential locations
        else {
          console.log(`Searching for category "${category.name}" data in response...`);
          
          // Try to search deeper in the response
          const findCategoryResult = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Check if this object has categoryName matching our target
            if (obj.categoryName === category.name && obj.menuItems && Array.isArray(obj.menuItems)) {
              console.log(`Found category "${category.name}" result at path: ${path}`);
              return obj;
            }
            
            // Also check for just menuItems if categoryName doesn't match
            if (obj.menuItems && Array.isArray(obj.menuItems) && obj.menuItems.length > 0) {
              console.log(`Found menuItems array at path: ${path}`);
              return { categoryName: category.name, menuItems: obj.menuItems };
            }
            
            // Recursively check all properties
            for (const key in obj) {
              const newPath = path ? `${path}.${key}` : key;
              const result = findCategoryResult(obj[key], newPath);
              if (result) return result;
            }
            
            return null;
          };
          
          categoryResult = findCategoryResult(parsedCategoryResponse.data);
        }
        
        // Check if we found valid results
        if (!categoryResult || !categoryResult.menuItems || !Array.isArray(categoryResult.menuItems)) {
          console.warn(`No menu items found for category "${category.name}"`);
          
          // Add to failed categories but don't completely fail the request
          failedCategories.push({
            name: category.name,
            error: 'No menu items found for this category'
          });
          
          // Skip this category and continue with others
          continue;
        }
        
        // Ensure the category name is correctly set
        if (!categoryResult.categoryName) {
          categoryResult.categoryName = category.name;
        }
        
        console.log(`Successfully extracted ${categoryResult.menuItems.length} items for category "${category.name}"`);
        
        // Add to successful results
        categoryResults.push(categoryResult);
      } catch (categoryError) {
        console.error(`Error extracting category "${category.name}":`, categoryError.message);
        
        // Add to failed categories
        failedCategories.push({
          name: category.name,
          error: categoryError.message
        });
        
        // Continue with other categories
        continue;
      }
    }
    
    // Check if we have any successful results
    if (categoryResults.length === 0) {
      throw new Error('Failed to extract any menu categories');
    }
    
    // Aggregate all category results
    const menuItems = categoryResults.flatMap(result => 
      result.menuItems.map(item => ({
        ...item,
        categoryName: result.categoryName
      }))
    );
    
    console.log(`Successfully extracted a total of ${menuItems.length} menu items across ${categoryResults.length} categories`);
    
    // Return the aggregated results
    return res.json({
      success: true,
      data: {
        menuItems: menuItems
      },
      categories: {
        successful: categoryResults.map(result => result.categoryName),
        failed: failedCategories
      }
    });
  } catch (error) {
    console.error('Batch category extraction error:', error.message);
    
    // Log detailed error information if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      success: false,
      error: `Batch category extraction failed: ${error.message}`
    });
  }
});

/**
 * API endpoint for checking batch extraction job status
 */
app.get('/api/batch-extract-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required'
    });
  }
  
  console.log(`Checking status for job: ${jobId}`);
  
  const status = getJobStatus(jobId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  // Calculate progress percentage
  const progressPercentage = status.totalCategories > 0 
    ? Math.round((status.completedCategories + status.failedCategories) / status.totalCategories * 100)
    : 0;
  
  // Calculate elapsed time
  const elapsedTime = status.endTime 
    ? status.endTime - status.startTime
    : Date.now() - status.startTime;
  
  return res.json({
    success: true,
    jobId: status.jobId,
    status: status.state,
    progress: {
      percentage: progressPercentage,
      totalCategories: status.totalCategories,
      completedCategories: status.completedCategories,
      failedCategories: status.failedCategories,
      currentCategory: status.currentCategory
    },
    timing: {
      startTime: new Date(status.startTime).toISOString(),
      elapsedSeconds: Math.floor(elapsedTime / 1000),
      estimatedRemainingSeconds: status.state === 'running' 
        ? Math.floor((status.totalCategories - status.completedCategories - status.failedCategories) * 30)
        : 0
    },
    error: status.error
  });
});

/**
 * API endpoint for retrieving batch extraction job results
 */
app.get('/api/batch-extract-results/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required'
    });
  }
  
  console.log(`Retrieving results for job: ${jobId}`);
  
  // First check in-memory store
  const results = getJobResults(jobId);
  
  if (results) {
    // Found in memory, return it
    return res.json({
      success: true,
      data: results.data,
      categories: results.categories,
      stats: results.stats
    });
  }
  
  // Not in memory, try database
  if (db.isDatabaseAvailable()) {
    try {
      const job = await db.getExtractionJob(jobId);
      
      if (job && job.status === 'completed' && job.restaurant_id) {
        // Get the menu created by this extraction job
        const menus = await db.getRestaurantMenus(job.restaurant_id);
        const menu = menus.find(m => m.extraction_job_id === job.id);
        
        if (menu) {
          // Get full menu with items
          const menuData = await db.getMenuWithItems(menu.id);
          
          if (menuData && menuData.menu_data) {
            // Transform database format to match expected format
            const transformedData = {};
            
            // Group menu items by category
            if (menuData.menu_data.menuItems) {
              menuData.menu_data.menuItems.forEach(item => {
                const categoryName = item.categoryName || 'Uncategorized';
                if (!transformedData[categoryName]) {
                  transformedData[categoryName] = [];
                }
                transformedData[categoryName].push(item);
              });
            }
            
            return res.json({
              success: true,
              data: transformedData,
              categories: menuData.menu_data.categories || [],
              stats: {
                totalItems: menuData.menu_data.menuItems ? menuData.menu_data.menuItems.length : 0
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from database:', error);
    }
  }
  
  // Not found anywhere
  const status = getJobStatus(jobId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  if (status.state === 'running') {
    return res.status(202).json({
      success: false,
      error: 'Job is still running',
      status: status.state,
      progress: {
        percentage: Math.round((status.completedCategories + status.failedCategories) / status.totalCategories * 100)
      }
    });
  }
  
  if (status.state === 'failed') {
    return res.status(500).json({
      success: false,
      error: 'Job failed',
      details: status.error
    });
  }
  
  return res.status(404).json({
    success: false,
    error: 'Results not found'
  });
});

/**
 * API endpoint for scanning restaurant menu item URLs
 * This is the first phase of the option sets extraction process
 */
app.post('/api/scan-menu-items', async (req, res) => {
  const { url } = req.body;
  
  // Validate URL
  if (!validateRestaurantUrl(url, res)) {
    return;
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Starting menu items URL scan for URL: ${url}`);
  
  try {
    // Detect platform (option sets extraction is primarily for UberEats)
    const platformInfo = detectPlatform(url);
    
    if (platformInfo.name !== 'UberEats') {
      return res.status(400).json({
        success: false,
        error: 'Option sets extraction is currently only supported for UberEats URLs'
      });
    }
    
    // Prepare v2 request payload for menu items URL detection
    const payload = {
      url: url,
      formats: [{
        type: 'json',
        schema: MENU_ITEMS_URL_SCHEMA,
        prompt: UBEREATS_MENU_ITEMS_URL_PROMPT
      }],
      onlyMainContent: true,
      waitFor: 2000, // Wait 2 seconds for page to load properly
      blockAds: true, // Block ads and cookie popups
      timeout: 120000, // 2 minute timeout
      maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'),
      skipTlsVerification: true,
      removeBase64Images: true
    };
    
    const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
    
    console.log('Menu items URL scan payload:', JSON.stringify(payload, null, 2));
    
    // Create axios instance
    const axiosInstance = axios.create({
      timeout: 180000, // 3 minute timeout 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      }
    });
    
    // Make request to Firecrawl API
    console.log('Making menu items URL scan request to:', apiEndpoint);
    
    const response = await axiosInstance.post(apiEndpoint, payload);
    
    // Log response summary
    console.log('Menu items URL scan response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    
    // Parse v2 response
    const parsedResponse = response.data;
    
    // Check if response is successful
    if (!parsedResponse.success) {
      throw new Error(`API returned error: ${parsedResponse.error || 'Unknown error'}`);
    }
    
    // Extract menu item URLs from response
    let menuItemUrls = [];
    
    // Check for URLs in standard json location
    if (parsedResponse.data && parsedResponse.data.json && parsedResponse.data.json.menuItemUrls) {
      console.log('Found menu item URLs in data.json.menuItemUrls');
      menuItemUrls = parsedResponse.data.json.menuItemUrls;
    }
    // Look in other potential locations
    else if (parsedResponse.data && parsedResponse.data.menuItemUrls) {
      console.log('Found menu item URLs in data.menuItemUrls');
      menuItemUrls = parsedResponse.data.menuItemUrls;
    }
    else {
      // Try to search deeper in the response for menu item URLs
      console.log('Searching for menu item URLs in response structure...');
      
      const findMenuItemUrls = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return null;
        
        if (obj.menuItemUrls && Array.isArray(obj.menuItemUrls)) {
          console.log(`Found menu item URLs at path: ${path}`);
          return obj.menuItemUrls;
        }
        
        for (const key in obj) {
          const newPath = path ? `${path}.${key}` : key;
          const result = findMenuItemUrls(obj[key], newPath);
          if (result) return result;
        }
        
        return null;
      };
      
      const foundUrls = findMenuItemUrls(parsedResponse.data);
      if (foundUrls) {
        menuItemUrls = foundUrls;
      }
    }
    
    // Validate menu item URLs
    if (!menuItemUrls || !Array.isArray(menuItemUrls) || menuItemUrls.length === 0) {
      console.warn('No menu item URLs found in the response');
      menuItemUrls = []; // Return empty array instead of failing
    }
    
    console.log(`Successfully identified ${menuItemUrls.length} menu item URLs`);
    
    // Return the extracted menu item URLs
    return res.json({
      success: true,
      data: { 
        menuItemUrls: menuItemUrls
      }
    });
  } catch (error) {
    console.error('Menu items URL scan error:', error.message);
    
    // Log detailed error information if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      success: false,
      error: `Menu items URL scan failed: ${error.message}`
    });
  }
});

/**
 * API endpoint for batch extracting option sets from menu item URLs
 * This is the second phase of the option sets extraction process
 */
app.post('/api/batch-extract-option-sets', async (req, res) => {
  const { menuItemUrls } = req.body;
  
  // Validate menu item URLs
  if (!menuItemUrls || !Array.isArray(menuItemUrls) || menuItemUrls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one menu item URL is required'
    });
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Starting batch option sets extraction for ${menuItemUrls.length} menu items`);
  
  try {
    // Process each menu item URL (for now we'll process them sequentially)
    // In future this could be parallelized for better performance
    const optionSetsResults = [];
    const failedUrls = [];
    
    for (const menuItemData of menuItemUrls) {
      try {
        const itemUrl = menuItemData.itemUrl || menuItemData.url;
        const itemName = menuItemData.itemName || menuItemData.name || 'Unknown Item';
        
        if (!itemUrl) {
          console.warn(`Skipping menu item with missing URL: ${itemName}`);
          continue;
        }
        
        console.log(`Extracting option sets for: ${itemName} (${itemUrl})`);
        
        // Prepare v2 option sets extraction payload
        const optionSetsPayload = {
          url: itemUrl,
          formats: [{
            type: 'json',
            schema: OPTION_SETS_SCHEMA,
            prompt: UBEREATS_OPTION_SETS_PROMPT
          }],
          onlyMainContent: true,
          waitFor: 2000,
          blockAds: true,
          timeout: 90000, // 1.5 minute timeout per item
          maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'),
          skipTlsVerification: true,
          removeBase64Images: true
        };
        
        const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
        
        console.log(`Option sets extraction payload for "${itemName}":`, JSON.stringify(optionSetsPayload, null, 2));
        
        // Create axios instance
        const axiosInstance = axios.create({
          timeout: 120000, // 2 minute timeout
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
          }
        });
        
        // Make request to Firecrawl API
        const itemResponse = await axiosInstance.post(apiEndpoint, optionSetsPayload);
        
        // Log response summary
        console.log(`Option sets extraction for "${itemName}" response status:`, itemResponse.status);
        
        // Parse v2 response
        const parsedItemResponse = itemResponse.data;
        
        if (!parsedItemResponse.success) {
          throw new Error(`API returned error: ${parsedItemResponse.error || 'Unknown error'}`);
        }
        
        // Extract option sets from response
        let itemOptionSets = null;
        
        // Check standard json location
        if (parsedItemResponse.data && parsedItemResponse.data.json) {
          console.log(`Found option sets data for "${itemName}" in data.json`);
          itemOptionSets = parsedItemResponse.data.json;
        }
        // Look in other potential locations
        else {
          console.log(`Searching for option sets data for "${itemName}" in response...`);
          
          // Try to search deeper in the response
          const findOptionSetsResult = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Check if this object has optionSets
            if (obj.optionSets && Array.isArray(obj.optionSets)) {
              console.log(`Found option sets for "${itemName}" at path: ${path}`);
              return obj;
            }
            
            // Recursively check all properties
            for (const key in obj) {
              const newPath = path ? `${path}.${key}` : key;
              const result = findOptionSetsResult(obj[key], newPath);
              if (result) return result;
            }
            
            return null;
          };
          
          itemOptionSets = findOptionSetsResult(parsedItemResponse.data);
        }
        
        // Check if we found valid results
        if (!itemOptionSets || !itemOptionSets.optionSets || !Array.isArray(itemOptionSets.optionSets)) {
          console.warn(`No option sets found for item "${itemName}"`);
          
          // Add empty option sets result so we still track this item
          optionSetsResults.push({
            menuItemName: itemName,
            itemUrl: itemUrl,
            optionSets: []
          });
          
          // Skip this item and continue with others
          continue;
        }
        
        // Ensure the menu item name is correctly set
        if (!itemOptionSets.menuItemName) {
          itemOptionSets.menuItemName = itemName;
        }
        
        // Add item URL for reference
        itemOptionSets.itemUrl = itemUrl;
        
        console.log(`Successfully extracted ${itemOptionSets.optionSets.length} option sets for "${itemName}"`);
        
        // Add to successful results
        optionSetsResults.push(itemOptionSets);
      } catch (itemError) {
        console.error(`Error extracting option sets for item:`, itemError.message);
        
        // Add to failed URLs
        failedUrls.push({
          url: menuItemData.itemUrl || menuItemData.url,
          name: menuItemData.itemName || menuItemData.name,
          error: itemError.message
        });
        
        // Continue with other items
        continue;
      }
    }
    
    console.log(`Successfully extracted option sets from ${optionSetsResults.length} menu items`);
    if (failedUrls.length > 0) {
      console.log(`Failed to extract option sets from ${failedUrls.length} menu items`);
    }
    
    // Return the aggregated results
    return res.json({
      success: true,
      data: {
        optionSets: optionSetsResults
      },
      stats: {
        successful: optionSetsResults.length,
        failed: failedUrls.length,
        total: menuItemUrls.length
      },
      failedUrls: failedUrls
    });
  } catch (error) {
    console.error('Batch option sets extraction error:', error.message);
    
    // Log detailed error information if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      success: false,
      error: `Batch option sets extraction failed: ${error.message}`
    });
  }
});

/**
 * API endpoint to get server status
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
    firecrawl: {
      apiVersion: 'v2',
      apiUrl: FIRECRAWL_API_URL,
      cacheMaxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800')
    }
  });
});

/**
 * API endpoint to download all images from extracted menu data
 */
app.post('/api/download-images', async (req, res) => {
  const { data, options } = req.body;
  
  if (!data || !data.menuItems) {
    return res.status(400).json({
      success: false,
      error: 'Valid menu data is required'
    });
  }
  
  const {
    outputPath = './downloads',
    groupByCategory = true,
    skipPlaceholders = true
  } = options || {};
  
  // Resolve the output path to ensure it's handled correctly
  const resolvedOutputPath = path.resolve(outputPath);
  
  console.log(`Starting batch download of ${data.menuItems.length} images`);
  console.log(`Output path: ${outputPath}`);
  console.log(`Resolved output path: ${resolvedOutputPath}`);
  
  try {
    const fs = require('fs').promises;
    const fsSync = require('fs');
    const https = require('https');
    const http = require('http');
    
    // Create output directory
    await fs.mkdir(resolvedOutputPath, { recursive: true });
    
    // Track statistics
    const stats = {
      total: data.menuItems.length,
      downloaded: 0,
      failed: 0,
      noImage: 0
    };
    
    // Download results
    const downloadResults = [];
    
    // Helper function to download a single image
    const downloadImage = (url, filepath) => {
      return new Promise((resolve, reject) => {
        const file = fsSync.createWriteStream(filepath);
        const protocol = url.startsWith('https') ? https : http;
        
        const request = protocol.get(url, (response) => {
          if (response.statusCode !== 200) {
            fsSync.unlinkSync(filepath);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            resolve(filepath);
          });
        });
        
        request.on('error', (err) => {
          if (fsSync.existsSync(filepath)) {
            fsSync.unlinkSync(filepath);
          }
          reject(err);
        });
        
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Download timeout'));
        });
      });
    };
    
    // Helper function to sanitize names
    const sanitizeName = (name) => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);
    };
    
    // Group items by category if requested
    const itemGroups = {};
    if (groupByCategory) {
      data.menuItems.forEach(item => {
        const category = item.categoryName || 'Uncategorized';
        if (!itemGroups[category]) {
          itemGroups[category] = [];
        }
        itemGroups[category].push(item);
      });
    } else {
      itemGroups['all'] = data.menuItems;
    }
    
    // Process each group
    for (const [groupName, items] of Object.entries(itemGroups)) {
      // Create subdirectory for category
      const groupDir = groupByCategory 
        ? path.join(resolvedOutputPath, sanitizeName(groupName))
        : resolvedOutputPath;
      
      await fs.mkdir(groupDir, { recursive: true });
      
      // Download each item's image
      for (const [index, item] of items.entries()) {
        const result = {
          dishName: item.dishName,
          categoryName: item.categoryName,
          originalUrl: item.imageURL,
          localPath: null,
          status: 'pending'
        };
        
        // Skip if no image or placeholder
        if (!item.imageURL || 
            (skipPlaceholders && item.imageURL.includes('placeholder'))) {
          result.status = 'no_image';
          stats.noImage++;
          downloadResults.push(result);
          continue;
        }
        
        try {
          // Generate safe filename
          const filename = `${sanitizeName(item.dishName || `item_${index}`)}.jpg`;
          const filepath = path.join(groupDir, filename);
          
          // Download image
          await downloadImage(item.imageURL, filepath);
          
          result.localPath = path.relative(resolvedOutputPath, filepath);
          result.status = 'success';
          stats.downloaded++;
          
        } catch (error) {
          console.error(`Failed to download ${item.dishName}:`, error.message);
          result.status = 'failed';
          result.error = error.message;
          stats.failed++;
        }
        
        downloadResults.push(result);
      }
    }
    
    // Create mapping file
    const mappingData = {
      restaurant: data.restaurantInfo?.name || 'Unknown Restaurant',
      downloadDate: new Date().toISOString(),
      stats: stats,
      items: downloadResults
    };
    
    const mappingPath = path.join(resolvedOutputPath, 'image-mapping.json');
    await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
    
    // Return success response
    return res.json({
      success: true,
      stats: stats,
      downloadPath: resolvedOutputPath,
      mappingFile: mappingPath
    });
    
  } catch (error) {
    console.error('Batch download error:', error);
    return res.status(500).json({
      success: false,
      error: `Batch download failed: ${error.message}`
    });
  }
});

/**
 * POST /api/menus/merge/validate
 * Validate that selected menus can be merged
 */
app.post('/api/menus/merge/validate', async (req, res) => {
  try {
    const { menuIds, userId } = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menuMergeService = require('./src/services/menu-merge-service');
    const validation = await menuMergeService.validateMergeRequest(menuIds, userId);
    
    return res.json(validation);
  } catch (error) {
    console.error('[API] Error validating merge:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate merge request'
    });
  }
});

/**
 * POST /api/menus/merge/compare
 * Compare menus and find duplicates
 */
app.post('/api/menus/merge/compare', async (req, res) => {
  try {
    const { menuIds, mergeMode = 'full' } = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menuMergeService = require('./src/services/menu-merge-service');
    const comparison = await menuMergeService.compareMenus(menuIds, mergeMode);
    
    return res.json(comparison);
  } catch (error) {
    console.error('[API] Error comparing menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to compare menus'
    });
  }
});

/**
 * POST /api/menus/merge/preview
 * Preview merged menu based on decisions
 */
app.post('/api/menus/merge/preview', async (req, res) => {
  try {
    const { menuIds, decisions, includeUnique, mergeMode = 'full' } = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menuMergeService = require('./src/services/menu-merge-service');
    const preview = await menuMergeService.previewMerge(menuIds, decisions, includeUnique, mergeMode);
    
    return res.json(preview);
  } catch (error) {
    console.error('[API] Error previewing merge:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to preview merge'
    });
  }
});

/**
 * POST /api/menus/merge/execute
 * Execute merge and create new menu
 */
app.post('/api/menus/merge/execute', async (req, res) => {
  try {
    const { menuIds, decisions, includeUnique, mergeMode = 'full', menuName, performedBy } = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menuMergeService = require('./src/services/menu-merge-service');
    const result = await menuMergeService.executeMerge(menuIds, decisions, includeUnique, mergeMode, menuName, performedBy);
    
    return res.json(result);
  } catch (error) {
    console.error('[API] Error executing merge:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute merge'
    });
  }
});

/**
 * POST /api/menus/:id/download-images
 * Download images for a menu from database
 */
app.post('/api/menus/:id/download-images', async (req, res) => {
  try {
    const { id } = req.params;
    const { options } = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get the full menu with items from database
    const menu = await db.getMenuWithItems(id);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Transform database format to the expected format for image download
    const menuItems = [];
    const restaurantInfo = {
      name: menu.restaurants?.name || 'Unknown Restaurant'
    };
    
    if (menu.categories) {
      menu.categories.forEach(category => {
        if (category.menu_items) {
          category.menu_items.forEach(item => {
            // Get the primary image URL if available
            let imageURL = '';
            if (item.item_images && item.item_images.length > 0) {
              const primaryImage = item.item_images.find(img => img.type === 'primary');
              imageURL = primaryImage ? primaryImage.url : item.item_images[0].url;
            }
            
            // Only add items with images
            if (imageURL) {
              menuItems.push({
                dishName: item.name,
                categoryName: category.name,
                imageURL: imageURL,
                dishPrice: item.price,
                dishDescription: item.description || ''
              });
            }
          });
        }
      });
    }
    
    // Check if there are any images to download
    if (menuItems.length === 0) {
      return res.json({
        success: true,
        message: 'No images found for this menu',
        stats: {
          total: 0,
          downloaded: 0,
          failed: 0,
          noImage: menu.categories?.reduce((acc, cat) => 
            acc + (cat.menu_items?.length || 0), 0) || 0
        }
      });
    }
    
    // Prepare data for image download
    const downloadData = {
      menuItems: menuItems,
      restaurantInfo: restaurantInfo
    };
    
    // Set default options
    const downloadOptions = {
      outputPath: options?.outputPath || `./downloads/extracted-images/${formatFilename(restaurantInfo.name)}-menu-${menu.id}`,
      groupByCategory: options?.groupByCategory !== false,
      skipPlaceholders: options?.skipPlaceholders !== false
    };
    
    // Log the download request
    console.log(`[Database] Downloading ${menuItems.length} images for menu ${menu.id} (${restaurantInfo.name})`);
    
    // Reuse the existing download logic
    const { data, options: opts } = { data: downloadData, options: downloadOptions };
    const {
      outputPath = './downloads',
      groupByCategory = true,
      skipPlaceholders = true
    } = opts;
    
    // Resolve the output path
    const resolvedOutputPath = path.resolve(outputPath);
    
    try {
      const fs = require('fs').promises;
      const fsSync = require('fs');
      const https = require('https');
      const http = require('http');
      
      // Create output directory
      await fs.mkdir(resolvedOutputPath, { recursive: true });
      
      // Track statistics
      const stats = {
        total: data.menuItems.length,
        downloaded: 0,
        failed: 0,
        noImage: 0
      };
      
      // Download results
      const downloadResults = [];
      
      // Helper function to download a single image
      const downloadImage = (url, filepath) => {
        return new Promise((resolve, reject) => {
          const file = fsSync.createWriteStream(filepath);
          const protocol = url.startsWith('https') ? https : http;
          
          const request = protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
              fsSync.unlinkSync(filepath);
              reject(new Error(`HTTP ${response.statusCode}`));
              return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
              file.close();
              resolve(filepath);
            });
          });
          
          request.on('error', (err) => {
            if (fsSync.existsSync(filepath)) {
              fsSync.unlinkSync(filepath);
            }
            reject(err);
          });
          
          request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
          });
        });
      };
      
      // Helper function to sanitize names
      const sanitizeName = (name) => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .substring(0, 50);
      };
      
      // Group items by category if requested
      const itemGroups = {};
      if (groupByCategory) {
        data.menuItems.forEach(item => {
          const category = item.categoryName || 'Uncategorized';
          if (!itemGroups[category]) {
            itemGroups[category] = [];
          }
          itemGroups[category].push(item);
        });
      } else {
        itemGroups['all'] = data.menuItems;
      }
      
      // Process each group
      for (const [groupName, items] of Object.entries(itemGroups)) {
        // Create subdirectory for category
        const groupDir = groupByCategory 
          ? path.join(resolvedOutputPath, sanitizeName(groupName))
          : resolvedOutputPath;
        
        await fs.mkdir(groupDir, { recursive: true });
        
        // Download each item's image
        for (const [index, item] of items.entries()) {
          const result = {
            dishName: item.dishName,
            categoryName: item.categoryName,
            originalUrl: item.imageURL,
            localPath: null,
            status: 'pending'
          };
          
          // Skip if no image or placeholder
          if (!item.imageURL || 
              (skipPlaceholders && item.imageURL.includes('placeholder'))) {
            result.status = 'no_image';
            stats.noImage++;
            downloadResults.push(result);
            continue;
          }
          
          try {
            // Generate safe filename
            const filename = `${sanitizeName(item.dishName || `item_${index}`)}.jpg`;
            const filepath = path.join(groupDir, filename);
            
            // Download image
            await downloadImage(item.imageURL, filepath);
            
            result.localPath = path.relative(resolvedOutputPath, filepath);
            result.status = 'success';
            stats.downloaded++;
            
          } catch (error) {
            console.error(`Failed to download ${item.dishName}:`, error.message);
            result.status = 'failed';
            result.error = error.message;
            stats.failed++;
          }
          
          downloadResults.push(result);
        }
      }
      
      // Create mapping file with menu metadata
      const mappingData = {
        menuId: menu.id,
        menuVersion: menu.version,
        restaurant: data.restaurantInfo.name,
        platform: menu.platforms?.name,
        downloadDate: new Date().toISOString(),
        stats: stats,
        items: downloadResults
      };
      
      const mappingPath = path.join(resolvedOutputPath, 'image-mapping.json');
      await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
      
      // Return success response
      return res.json({
        success: true,
        menuId: menu.id,
        stats: stats,
        downloadPath: resolvedOutputPath,
        mappingFile: mappingPath
      });
      
    } catch (error) {
      console.error('[Database] Image download error:', error);
      return res.status(500).json({
        success: false,
        error: `Image download failed: ${error.message}`
      });
    }
  } catch (error) {
    console.error('[API] Error downloading menu images:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to download menu images'
    });
  }
});

/**
 * POST /api/menus/:id/download-images-zip
 * Download all menu images as a ZIP file for browser download
 */
app.get('/api/menus/:id/download-images-zip', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Helper function to sanitize names for filenames
    const sanitizeName = (name) => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);
    };
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get menu with items
    const menu = await db.getMenuWithItems(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Transform to the expected format
    const transformedData = {
      menuItems: menu.categories.flatMap(category => 
        category.menu_items.map(item => ({
          categoryName: category.name,
          dishName: item.name,
          dishDescription: item.description,
          dishPrice: item.price,
          imageURL: item.item_images?.[0]?.url || null,
          tags: item.tags
        }))
      ),
      restaurantInfo: {
        name: menu.restaurants?.name || 'Unknown Restaurant'
      }
    };
    
    // Filter items with images
    const itemsWithImages = transformedData.menuItems.filter(item => item.imageURL);
    
    if (itemsWithImages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No images found in this menu'
      });
    }
    
    // Set response headers for ZIP download
    const filename = `${sanitizeName(transformedData.restaurantInfo.name)}_images_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Track download progress
    let downloadedCount = 0;
    let failedCount = 0;
    
    // Group items by category
    const categories = {};
    itemsWithImages.forEach(item => {
      if (!categories[item.categoryName]) {
        categories[item.categoryName] = [];
      }
      categories[item.categoryName].push(item);
    });
    
    // Track downloaded items for mapping
    const imageMappingItems = [];
    
    // Download and add images to ZIP
    for (const [categoryName, items] of Object.entries(categories)) {
      const safeCategoryName = sanitizeName(categoryName);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const filename = `${sanitizeName(item.dishName || `item_${i + 1}`)}.jpg`;
        const filepath = `${safeCategoryName}/${filename}`;
        
        let status = 'failed';
        let error = null;
        
        try {
          // Download image
          const response = await axios.get(item.imageURL, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          // Add to archive
          archive.append(Buffer.from(response.data), { name: filepath });
          downloadedCount++;
          status = 'success';
          
        } catch (err) {
          console.error(`Failed to download image for ${item.dishName}:`, err.message);
          failedCount++;
          error = err.message;
        }
        
        // Add to mapping regardless of success/failure
        imageMappingItems.push({
          dishName: item.dishName,
          categoryName: item.categoryName,
          originalUrl: item.imageURL,
          localPath: status === 'success' ? filepath : null,
          status: status,
          ...(error && { error: error })
        });
      }
    }
    
    // Create image-mapping.json in the expected format
    const imageMapping = {
      restaurant: transformedData.restaurantInfo.name,
      downloadDate: new Date().toISOString(),
      stats: {
        total: itemsWithImages.length,
        downloaded: downloadedCount,
        failed: failedCount,
        noImage: 0
      },
      items: imageMappingItems
    };
    
    archive.append(JSON.stringify(imageMapping, null, 2), { name: 'image-mapping.json' });
    
    // Finalize the archive
    await archive.finalize();
    
  } catch (error) {
    console.error('[API] Error creating image ZIP:', error);
    
    // Only send error if headers haven't been sent
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create image ZIP'
      });
    }
  }
});

/**
 * Database-aware API endpoints
 */

/**
 * GET /api/restaurants
 * List all restaurants in the database
 */
app.get('/api/restaurants', async (req, res) => {
  try {
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurants = await db.getAllRestaurants();
    
    return res.json({
      success: true,
      count: restaurants.length,
      restaurants: restaurants
    });
  } catch (error) {
    console.error('[API] Error listing restaurants:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list restaurants'
    });
  }
});

/**
 * GET /api/restaurants/:id/menus
 * Get all menus for a specific restaurant
 */
app.get('/api/restaurants/:id/menus', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Verify restaurant exists
    const restaurant = await db.getRestaurantById(id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found'
      });
    }
    
    // Get all menus for the restaurant
    const menus = await db.getRestaurantMenus(id);
    
    return res.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug
      },
      count: menus.length,
      menus: menus
    });
  } catch (error) {
    console.error('[API] Error getting restaurant menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get restaurant menus'
    });
  }
});

/**
 * GET /api/menus/:id
 * Get full menu with all items and categories
 */
app.get('/api/menus/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menu = await db.getMenuWithItems(id);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Calculate statistics
    const stats = {
      totalCategories: menu.categories ? menu.categories.length : 0,
      totalItems: 0,
      totalImages: 0
    };
    
    if (menu.categories) {
      menu.categories.forEach(category => {
        if (category.menu_items) {
          stats.totalItems += category.menu_items.length;
          category.menu_items.forEach(item => {
            if (item.item_images) {
              stats.totalImages += item.item_images.length;
            }
          });
        }
      });
    }
    
    return res.json({
      success: true,
      menu: menu,
      stats: stats
    });
  } catch (error) {
    console.error('[API] Error getting menu:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get menu'
    });
  }
});

/**
 * POST /api/menus/:id/export
 * Export menu to CSV format
 */
app.post('/api/menus/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { options, includeImages } = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get the full menu with items
    const menu = await db.getMenuWithItems(id);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Transform database format to the expected format for CSV generation
    const menuItems = [];
    
    if (menu.categories) {
      menu.categories.forEach(category => {
        if (category.menu_items) {
          category.menu_items.forEach(item => {
            // Get the primary image URL if available and if images are requested
            let imageURL = '';
            if (includeImages !== false && item.item_images && item.item_images.length > 0) {
              const primaryImage = item.item_images.find(img => img.type === 'primary');
              imageURL = primaryImage ? primaryImage.url : item.item_images[0].url;
            }
            
            menuItems.push({
              menuName: 'Menu', // Use 'Menu' consistently, not restaurant name
              categoryName: category.name,
              dishName: item.name,
              dishPrice: item.price,
              dishDescription: item.description || '',
              tags: item.tags || [],
              imageURL: imageURL,
              // Additional fields from database
              currency: item.currency || 'NZD',
              isAvailable: item.is_available
            });
          });
        }
      });
    }
    
    // Define cleaning function for this route
    const UNWANTED_PHRASES = [
      'Plus small',
      'plus small',
      'No. 1 most liked',
      'No. 2 most liked', 
      'No. 3 most liked',
      'most liked',
      'thumbs up',
      '👍'
    ];
    
    const REGEX_PATTERNS = [
      /\d+%\s*thumbs?\s*up/gi,
      /^\d+%$/gm,
      /No\.\s*\d+\s*most\s*liked/gi,
      /Plus\s*small/gi
    ];
    
    function cleanField(value) {
      if (!value || typeof value !== 'string') {
        return value || '';
      }
      
      let cleaned = value;
      
      // Remove regex patterns first (handles variations)
      REGEX_PATTERNS.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
      
      // Remove each unwanted phrase
      UNWANTED_PHRASES.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        cleaned = cleaned.replace(regex, '');
      });
      
      // Clean up whitespace and newlines
      cleaned = cleaned.replace(/\n+/g, ' '); // Replace newlines with space
      cleaned = cleaned.replace(/\s+/g, ' '); // Collapse multiple spaces
      cleaned = cleaned.trim();
      
      // If the field is now empty or just whitespace, return empty string
      if (!cleaned || cleaned.match(/^\s*$/)) {
        return '';
      }
      
      return cleaned;
    }
    
    // Generate CSV using existing logic
    // Build headers conditionally based on includeImages
    const baseHeaders = [
      'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
      'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
      'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
      'displayName', 'printName', 'tags'
    ];
    
    // Only add imageURL column if images are included
    const headers = includeImages !== false 
      ? [...baseHeaders, 'imageURL']
      : baseHeaders;
    
    const DEFAULT_DISH_TYPE = 'standard';
    const comboItems = options?.comboItems || [];
    const fieldEdits = options?.fieldEdits || {};
    
    const rows = [];
    
    menuItems.forEach(item => {
      const customItem = {
        ...item,
        ...(fieldEdits[item.dishName] || fieldEdits[item.name] || {})
      };
      
      const menuName = 'Menu'; // Always use 'Menu' consistently
      const isDishTypeCombo = comboItems.includes(customItem.dishName || customItem.name);
      const dishType = isDishTypeCombo ? 'combo' : DEFAULT_DISH_TYPE;
      
      // Clean tags before converting to string
      let tagsString = '';
      if (customItem.tags && Array.isArray(customItem.tags)) {
        // Filter out unwanted tags
        const cleanedTags = customItem.tags.filter(tag => {
          const tagLower = tag.toLowerCase();
          return !tagLower.includes('thumb') && 
                 !tagLower.includes('most liked') &&
                 !tagLower.includes('plus small') &&
                 !tagLower.match(/^\d+%$/); // Remove percentage tags
        });
        tagsString = cleanedTags.join(', ');
      }
      
      // Apply cleaning to description and name fields as well
      // Handle both field names (dishDescription/description, dishName/name from database)
      const cleanedDescription = cleanField(customItem.dishDescription || customItem.description || '');
      const cleanedDishName = cleanField(customItem.dishName || customItem.name || '');
      const cleanedCategoryName = cleanField(customItem.categoryName || customItem.category_name || 'Uncategorized');
      
      const rowData = [
        '', // menuID
        escapeCSVField(menuName),
        '', // menuDisplayName
        '', // menuDescription
        '', // categoryID
        escapeCSVField(cleanedCategoryName),
        '', // categoryDisplayName
        '', // categoryDescription
        '', // dishID
        escapeCSVField(cleanedDishName),
        formatPrice(customItem.dishPrice || customItem.price || 0),
        dishType,
        escapeCSVField(cleanedDescription),
        '', // displayName
        '', // printName
        escapeCSVField(tagsString)
      ];
      
      // Only add imageURL if images are included
      if (includeImages !== false) {
        rowData.push(escapeCSVField(customItem.imageURL || ''));
      }
      
      rows.push(rowData);
    });
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    // Generate filename
    const restaurantName = menu.restaurants?.name || 'restaurant';
    const date = new Date().toISOString().split('T')[0];
    const imageSuffix = includeImages === false ? '_no_images' : '';
    const filename = `${formatFilename(restaurantName)}_menu_${date}${imageSuffix}.csv`;
    
    return res.json({
      success: true,
      csvData: csvContent,
      filename: filename,
      stats: {
        rowCount: rows.length,
        columnCount: headers.length
      },
      menuInfo: {
        id: menu.id,
        version: menu.version,
        restaurantName: menu.restaurants?.name,
        platformName: menu.platforms?.name
      }
    });
  } catch (error) {
    console.error('[API] Error exporting menu:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export menu'
    });
  }
});

/**
 * Extraction Management API endpoints
 */

/**
 * GET /api/menus/:id/csv
 * Direct CSV download endpoint for a menu
 */
app.get('/api/menus/:id/csv', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'full' } = req.query;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get the full menu with items
    const menu = await db.getMenuWithItems(id);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Transform database format to CSV format
    const menuItems = [];
    
    if (menu.categories) {
      menu.categories.forEach(category => {
        if (category.menu_items) {
          category.menu_items.forEach(item => {
            // Get the primary image URL if available
            let imageURL = '';
            if (item.item_images && item.item_images.length > 0) {
              const primaryImage = item.item_images.find(img => img.type === 'primary');
              imageURL = primaryImage ? primaryImage.url : item.item_images[0].url;
            }
            
            // Skip image URL for no_images or clean format
            if (format === 'no_images' || format === 'clean') {
              imageURL = '';
            }
            
            menuItems.push({
              menuName: menu.restaurants?.name || 'Menu',
              categoryName: category.name,
              dishName: item.name,
              dishPrice: item.price,
              dishDescription: item.description || '',
              tags: item.tags || [],
              imageURL: imageURL
            });
          });
        }
      });
    }
    
    // Generate CSV - use appropriate format structure
    const headers = (format === 'no_images' || format === 'clean')
      ? ['menuID', 'menuName', 'menuDisplayName', 'menuDescription',
         'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
         'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
         'displayName', 'printName', 'tags'] // 16 columns without imageURL
      : ['menuID', 'menuName', 'menuDisplayName', 'menuDescription',
         'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
         'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
         'displayName', 'printName', 'tags', 'imageURL']; // 17 columns with imageURL
    
    const rows = [];
    menuItems.forEach(item => {
      // Build the full row structure
      const row = [
        '', // menuID - leave blank
        escapeCSVField('Menu'), // menuName - use 'Menu' consistently
        '', // menuDisplayName - leave blank
        '', // menuDescription - leave blank
        '', // categoryID - leave blank
        escapeCSVField(item.categoryName),
        '', // categoryDisplayName - leave blank
        '', // categoryDescription - leave blank
        '', // dishID - leave blank
        escapeCSVField(item.dishName),
        formatPrice(item.dishPrice || 0),
        'standard', // dishType
        escapeCSVField(item.dishDescription),
        '', // displayName - leave blank
        '', // printName - leave blank
        escapeCSVField(Array.isArray(item.tags) ? item.tags.join(', ') : '')
      ];
      
      // Add imageURL only if not no_images or clean format
      if (format !== 'no_images' && format !== 'clean') {
        row.push(escapeCSVField(item.imageURL));
      }
      
      rows.push(row);
    });
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    // Generate filename
    const restaurantName = menu.restaurants?.name || 'restaurant';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${formatFilename(restaurantName)}_menu_${format}_${date}.csv`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send CSV content
    return res.send(csvContent);
  } catch (error) {
    console.error('[API] Error generating CSV:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate CSV'
    });
  }
});

/**
 * POST /api/extractions/start
 * Start a new extraction with database tracking
 */
app.post('/api/extractions/start', async (req, res) => {
  try {
    const { url, platform, options = {}, extractionType = 'batch', restaurantId } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    
    let restaurantData;
    let platformName = platform || 'Unknown';
    
    // Check if a specific restaurant ID was provided (manual selection mode)
    if (restaurantId) {
      console.log(`[Extraction] Using manually selected restaurant: ${restaurantId}`);
      
      // Use the provided restaurant ID
      const existingRestaurant = await db.getRestaurantById(restaurantId);
      if (!existingRestaurant) {
        return res.status(400).json({
          success: false,
          error: 'Selected restaurant not found'
        });
      }
      
      // Auto-detect platform from URL if not provided
      if (url.includes('ubereats.com')) {
        platformName = 'ubereats';
      } else if (url.includes('doordash.com')) {
        platformName = 'doordash';
      }
      
      // Get platform
      const platformData = await db.getPlatformByName(platformName);
      if (!platformData) {
        return res.status(400).json({
          success: false,
          error: `Platform ${platformName} not found`
        });
      }
      
      restaurantData = {
        restaurant: existingRestaurant,
        platform: platformData
      };
      
      console.log(`[Extraction] Using restaurant: ${existingRestaurant.name} (${existingRestaurant.id})`);
    } else {
      // Auto-detect mode: Use platform detector for all platforms
      const platformInfo = detectPlatform(url);
      
      // Get the platform name (lowercase for database)
      if (platformInfo && platformInfo.name) {
        platformName = platformInfo.name.toLowerCase();
      }
      
      // Extract restaurant name using platform-specific logic
      let restaurantName = req.body.restaurantName;
      if (!restaurantName) {
        restaurantName = extractRestaurantName(url, platformInfo);
        if (!restaurantName) {
          restaurantName = 'Unknown Restaurant';
        } else {
          // Capitalize first letter of each word
          restaurantName = restaurantName.split(/[\s-_]+/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      }
      
      console.log(`[Extraction] Auto-detected restaurant: ${restaurantName}`);
      
      // Create or update restaurant in database
      restaurantData = await db.upsertRestaurant({
        name: restaurantName,
        url: url,
        platformName: platformName
      });
    }
    
    if (!restaurantData) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create restaurant in database'
      });
    }
    
    // Generate job ID
    const jobId = generateJobId();
    
    // Get restaurant name for the extraction process
    const restaurantName = restaurantData.restaurant.name;
    
    // Create extraction job in database with options
    const dbJob = await db.createExtractionJob({
      jobId: jobId,
      restaurantId: restaurantData.restaurant.id,
      platformId: restaurantData.platform.id,
      url: url,
      jobType: extractionType === 'batch' ? 'full_menu' : 'categories_only',
      config: { 
        extractionType,
        includeImages: options.includeImages !== false, // Default to true
        generateCSV: options.generateCSV !== false, // Default to true
        ...options
      }
    });
    
    if (!dbJob) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create extraction job in database'
      });
    }
    
    // Start the extraction based on type
    if (extractionType === 'batch') {
      // First scan for categories
      try {
        // Detect platform for proper prompt selection
        const platformInfo = detectPlatform(url);
        let categoryPrompt;
        
        // Use platform-specific category detection prompts
        if (platformInfo.name === 'UberEats') {
          console.log(`[Job ${jobId}] Using UberEats-specific category detection`);
          categoryPrompt = UBEREATS_CATEGORY_PROMPT;
        } else if (platformInfo.name === 'DoorDash') {
          console.log(`[Job ${jobId}] Using DoorDash-specific category detection`);
          categoryPrompt = DOORDASH_CATEGORY_PROMPT;
        } else if (platformInfo.name === 'OrderMeal') {
          console.log(`[Job ${jobId}] Using OrderMeal-specific category detection`);
          categoryPrompt = ORDERMEAL_CATEGORY_PROMPT;
        } else if (platformInfo.name === 'Mobi2Go') {
          console.log(`[Job ${jobId}] Using Mobi2Go-specific category detection`);
          categoryPrompt = MOBI2GO_CATEGORY_PROMPT;
        } else if (platformInfo.name === 'NextOrder') {
          console.log(`[Job ${jobId}] Using NextOrder-specific category detection`);
          categoryPrompt = NEXTORDER_CATEGORY_PROMPT;
        } else if (platformInfo.name === 'DeliverEasy') {
          console.log(`[Job ${jobId}] Using DeliverEasy-specific category detection`);
          categoryPrompt = DELIVEREASY_CATEGORY_PROMPT;
        } else if (platformInfo.name === 'FoodHub') {
          console.log(`[Job ${jobId}] Using FoodHub-specific category detection`);
          categoryPrompt = FOODHUB_CATEGORY_PROMPT;
        } else {
          console.log(`[Job ${jobId}] Using generic category detection for platform: ${platformInfo.name}`);
          // Use generic prompt for unknown platforms
          categoryPrompt = GENERIC_CATEGORY_PROMPT;
        }
        
        const scanPayload = {
          url: url,
          formats: [{
            type: 'json',
            schema: CATEGORY_DETECTION_SCHEMA,
            prompt: categoryPrompt
          }],
          onlyMainContent: true,
          waitFor: 2000,
          timeout: 90000,
          maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800')
        };
        
        console.log(`[Job ${jobId}] Scanning for categories...`);
        console.log(`[Job ${jobId}] DEBUG - Category Detection Prompt:`, categoryPrompt.substring(0, 200) + '...');
        console.log(`[Job ${jobId}] DEBUG - Category Detection Schema:`, JSON.stringify(CATEGORY_DETECTION_SCHEMA, null, 2));
        const scanResponse = await axios.post(`${FIRECRAWL_API_URL}/v2/scrape`, scanPayload, {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 95000
        });
        
        // Extract categories from the response - check multiple possible locations
        let categories = [];
        
        // Check different possible response structures
        if (scanResponse.data?.data?.formats?.json?.categories) {
          categories = scanResponse.data.data.formats.json.categories;
        } else if (scanResponse.data?.data?.json?.categories) {
          categories = scanResponse.data.data.json.categories;
        } else if (scanResponse.data?.data?.categories) {
          categories = scanResponse.data.data.categories;
        } else {
          // Log the structure to debug
          console.log(`[Job ${jobId}] Response structure:`, JSON.stringify(scanResponse.data?.data, null, 2).slice(0, 500));
        }
        
        console.log(`[Job ${jobId}] Found ${categories.length} categories:`, categories.map(c => c.name));
        
        // Start background extraction with the found categories
        startBackgroundExtraction(jobId, url, categories, restaurantName, options);
      } catch (scanError) {
        console.error(`[Job ${jobId}] Category scan failed:`, scanError.message);
        // Fallback to empty categories if scan fails
        startBackgroundExtraction(jobId, url, [], restaurantName, options);
      }
      
      return res.json({
        success: true,
        jobId: jobId,
        message: 'Extraction started',
        restaurantId: restaurantData.restaurant.id,
        trackingUrl: `/api/extractions/${jobId}`,
        options: {
          includeImages: options.includeImages !== false,
          generateCSV: options.generateCSV !== false
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Only batch extraction is currently supported'
      });
    }
  } catch (error) {
    console.error('[API] Error starting extraction:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start extraction'
    });
  }
});

/**
 * GET /api/extractions/:jobId
 * Get extraction job details from database
 */
app.get('/api/extractions/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      // Fall back to in-memory store
      const status = getJobStatus(jobId);
      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      return res.json({
        success: true,
        job: status
      });
    }
    
    // Get from database
    const job = await db.getExtractionJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Extraction job not found'
      });
    }
    
    // Get associated menu if job is completed
    let menuData = null;
    let totalItems = 0;
    
    if (job.status === 'completed') {
      // Get the menu created by this extraction job (regardless of current restaurant)
      const menu = await db.getMenuByExtractionJobId(job.id);
      
      if (menu) {
        // Get full menu with items to count them
        menuData = await db.getMenuWithItems(menu.id);
        if (menuData && menuData.categories) {
          menuData.categories.forEach(category => {
            if (category.menu_items) {
              totalItems += category.menu_items.length;
            }
          });
        }
      }
    }
    
    // Also check in-memory for real-time status
    const memoryStatus = getJobStatus(jobId);
    
    // Format the response to match what the frontend expects
    const formattedJob = {
      jobId: job.job_id,
      state: job.status,
      url: job.url,
      // Use the menu's current restaurant if it was moved, otherwise use original
      restaurant: menuData?.restaurants?.name || (job.restaurants ? job.restaurants.name : 'Unknown Restaurant'),
      platform: job.platforms ? job.platforms.name : 'Unknown',
      totalItems: totalItems,
      totalCategories: job.progress?.totalCategories || 0,
      completedCategories: job.progress?.completedCategories || 0,
      startTime: new Date(job.created_at).getTime(),
      endTime: job.completed_at ? new Date(job.completed_at).getTime() : null,
      error: job.error,
      menuId: menuData ? menuData.id : null,
      // Include original database fields for reference
      database: {
        id: job.id,
        restaurant_id: job.restaurant_id,
        platform_id: job.platform_id,
        created_at: job.created_at,
        completed_at: job.completed_at
      }
    };
    
    return res.json({
      success: true,
      job: formattedJob,
      liveStatus: memoryStatus
    });
  } catch (error) {
    console.error('[API] Error getting extraction job:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get extraction job'
    });
  }
});

/**
 * POST /api/extractions/:jobId/retry
 * Retry a failed extraction
 */
app.post('/api/extractions/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get the original job
    const originalJob = await db.getExtractionJob(jobId);
    
    if (!originalJob) {
      return res.status(404).json({
        success: false,
        error: 'Original extraction job not found'
      });
    }
    
    if (originalJob.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Can only retry failed jobs'
      });
    }
    
    // Create new job with same config
    const newJobId = generateJobId();
    
    const newJob = await db.createExtractionJob({
      jobId: newJobId,
      restaurantId: originalJob.restaurant_id,
      platformId: originalJob.platform_id,
      url: originalJob.url,
      jobType: originalJob.job_type,
      config: {
        ...originalJob.config,
        retriedFrom: jobId
      }
    });
    
    if (!newJob) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create retry job'
      });
    }
    
    // Start the extraction
    startBackgroundExtraction(
      newJobId, 
      originalJob.url, 
      [], 
      originalJob.restaurants?.name
    );
    
    return res.json({
      success: true,
      newJobId: newJobId,
      message: 'Extraction retry started',
      trackingUrl: `/api/extractions/${newJobId}`
    });
  } catch (error) {
    console.error('[API] Error retrying extraction:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry extraction'
    });
  }
});

/**
 * DELETE /api/extractions/:jobId
 * Hard delete an extraction and all associated data
 */
app.delete('/api/extractions/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Perform hard deletion in database
    const deleted = await db.deleteExtraction(jobId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found or deletion failed'
      });
    }
    
    // Remove from memory store if exists
    if (jobStore.has(jobId)) {
      jobStore.delete(jobId);
    }
    
    return res.json({
      success: true,
      message: 'Extraction and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error cancelling extraction:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel extraction'
    });
  }
});

/**
 * Menu Management API endpoints
 */

/**
 * POST /api/menus/:id/activate
 * Set a menu as the active version
 */
app.post('/api/menus/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menu = await db.activateMenu(id);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found or activation failed'
      });
    }
    
    return res.json({
      success: true,
      message: 'Menu activated successfully',
      menu: {
        id: menu.id,
        version: menu.version,
        is_active: menu.is_active
      }
    });
  } catch (error) {
    console.error('[API] Error activating menu:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to activate menu'
    });
  }
});

/**
 * POST /api/menus/:id/compare
 * Compare two menu versions
 */
app.post('/api/menus/:id/compare', async (req, res) => {
  try {
    const { id } = req.params;
    const { compareWithId } = req.body;
    
    if (!compareWithId) {
      return res.status(400).json({
        success: false,
        error: 'compareWithId is required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const comparison = await db.compareMenus(id, compareWithId);
    
    if (!comparison) {
      return res.status(404).json({
        success: false,
        error: 'One or both menus not found'
      });
    }
    
    return res.json({
      success: true,
      comparison: comparison
    });
  } catch (error) {
    console.error('[API] Error comparing menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to compare menus'
    });
  }
});

/**
 * DELETE /api/menus/:id
 * Soft delete a menu
 */
app.delete('/api/menus/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const deleted = await db.deleteMenu(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found or deletion failed'
      });
    }
    
    return res.json({
      success: true,
      message: 'Menu deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting menu:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete menu'
    });
  }
});

/**
 * Search and Filter API endpoints
 */

/**
 * GET /api/menus
 * Get all menus with optional restaurant filter
 */
app.get('/api/menus', async (req, res) => {
  try {
    const { restaurant } = req.query;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // If restaurant filter is provided, get menus for that restaurant
    if (restaurant) {
      const menus = await db.getRestaurantMenus(restaurant);
      const restaurantData = await db.getRestaurantById(restaurant);
      
      // Add restaurant data to each menu since getRestaurantMenus doesn't include it
      const menusWithRestaurant = menus.map(menu => ({
        ...menu,
        restaurants: restaurantData
      }));
      
      return res.json({
        success: true,
        restaurant: restaurantData,
        count: menusWithRestaurant.length,
        menus: menusWithRestaurant
      });
    }
    
    // Otherwise, get all menus with restaurant data
    const allMenus = await db.getAllMenus();
    
    return res.json({
      success: true,
      count: allMenus.length,
      menus: allMenus
    });
  } catch (error) {
    console.error('[API] Error fetching menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch menus'
    });
  }
});

/**
 * PATCH /api/menus/:id/status
 * Toggle menu active/inactive status
 */
app.patch('/api/menus/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean value'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const menu = await db.toggleMenuStatus(id, isActive);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found or status update failed'
      });
    }
    
    console.log(`[API] Menu ${id} status changed to ${isActive ? 'active' : 'inactive'}`);
    
    return res.json({
      success: true,
      menu: menu,
      message: `Menu ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('[API] Error updating menu status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update menu status'
    });
  }
});

/**
 * PATCH /api/menus/bulk-reassign
 * Bulk reassign menus to a different restaurant
 */
app.patch('/api/menus/bulk-reassign', async (req, res) => {
  try {
    const { menuIds, restaurantId } = req.body;
    
    // Validate input
    if (!menuIds || !Array.isArray(menuIds) || menuIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Menu IDs must be provided as a non-empty array'
      });
    }
    
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Target restaurant ID is required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Perform the reassignment
    const result = await db.reassignMenusToRestaurant(menuIds, restaurantId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    console.log(`[API] Successfully reassigned ${result.updatedCount} menus to restaurant ${result.restaurant.name}`);
    
    return res.json(result);
  } catch (error) {
    console.error('[API] Error reassigning menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reassign menus'
    });
  }
});

/**
 * GET /api/search/menus
 * Search menus by item name or description
 */
app.get('/api/search/menus', async (req, res) => {
  try {
    const { q, restaurantId } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const results = await db.searchMenus(q, restaurantId);
    
    return res.json({
      success: true,
      query: q,
      count: results.length,
      results: results
    });
  } catch (error) {
    console.error('[API] Error searching menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to search menus'
    });
  }
});

/**
 * GET /api/search/items
 * Alias for /api/search/menus - searches items across menus
 */
app.get('/api/search/items', async (req, res) => {
  // Reuse the menu search endpoint logic
  req.url = '/api/search/menus';
  return app.handle(req, res);
});

/**
 * GET /api/extractions
 * List all extraction jobs with optional filters
 */
app.get('/api/extractions', async (req, res) => {
  try {
    const { status, restaurantId, limit } = req.query;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const filters = {};
    if (status) filters.status = status;
    if (restaurantId) filters.restaurantId = restaurantId;
    if (limit) filters.limit = parseInt(limit);
    
    const jobs = await db.getExtractionJobs(filters);
    
    return res.json({
      success: true,
      count: jobs.length,
      jobs: jobs
    });
  } catch (error) {
    console.error('[API] Error listing extraction jobs:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list extraction jobs'
    });
  }
});

/**
 * Restaurant Management API endpoints
 */

/**
 * GET /api/restaurants/:id
 * Get a specific restaurant by ID
 */
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurant = await db.getRestaurantById(id);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found'
      });
    }
    
    return res.json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('[API] Error getting restaurant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get restaurant'
    });
  }
});

/**
 * POST /api/restaurants
 * Create a new restaurant
 */
app.post('/api/restaurants', async (req, res) => {
  try {
    const restaurantData = req.body;
    
    if (!restaurantData.name) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant name is required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurant = await db.createRestaurant(restaurantData);
    
    if (!restaurant) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create restaurant'
      });
    }
    
    return res.status(201).json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('[API] Error creating restaurant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create restaurant'
    });
  }
});

/**
 * PATCH /api/restaurants/:id
 * Update a restaurant
 */
app.patch('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurant = await db.updateRestaurant(id, updates);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found or update failed'
      });
    }
    
    return res.json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('[API] Error updating restaurant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update restaurant'
    });
  }
});

/**
 * PATCH /api/restaurants/:id/workflow
 * Update restaurant workflow fields
 */
app.patch('/api/restaurants/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const workflowData = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurant = await db.updateRestaurantWorkflow(id, workflowData);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found or update failed'
      });
    }
    
    return res.json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('[API] Error updating restaurant workflow:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update restaurant workflow'
    });
  }
});

/**
 * DELETE /api/restaurants/:id
 * Hard delete a restaurant and all associated data
 */
app.delete('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const deleted = await db.deleteRestaurant(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found or deletion failed'
      });
    }
    
    return res.json({
      success: true,
      message: 'Restaurant and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting restaurant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete restaurant'
    });
  }
});

/**
 * GET /api/restaurants/:id/details
 * Get complete restaurant details including all workflow fields
 */
app.get('/api/restaurants/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurant = await db.getRestaurantDetails(id);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found'
      });
    }
    
    return res.json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('[API] Error getting restaurant details:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get restaurant details'
    });
  }
});

/**
 * PATCH /api/restaurants/:id/workflow
 * Update restaurant workflow fields
 */
app.patch('/api/restaurants/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const workflowData = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurant = await db.updateRestaurantWorkflow(id, workflowData);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found or update failed'
      });
    }
    
    return res.json({
      success: true,
      restaurant: restaurant
    });
  } catch (error) {
    console.error('[API] Error updating restaurant workflow:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update restaurant workflow'
    });
  }
});

/**
 * POST /api/google-business-search
 * Search for business information using Firecrawl with platform URL discovery and JSON schema extraction
 */
app.post('/api/google-business-search', async (req, res) => {
  try {
    const { restaurantName, city, restaurantId } = req.body;
    
    if (!restaurantName || !city) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant name and city are required'
      });
    }
    
    console.log(`[Google Business Search] Searching for: ${restaurantName} in ${city}`);
    
    // Step 1: Search for all platform URLs
    const platformQueries = [
      `"${restaurantName}" "${city}" New Zealand site:ubereats.com`,
      `"${restaurantName}" "${city}" New Zealand site:doordash.com`,
      `"${restaurantName}" "${city}" New Zealand site:facebook.com`,
      `"${restaurantName}" "${city}" New Zealand site:instagram.com`,
      `"${restaurantName}" "${city}" New Zealand site:meandyou.co.nz`,
      `"${restaurantName}" "${city}" New Zealand site:mobi2go.com`,
      `"${restaurantName}" "${city}" New Zealand site:delivereasy.co.nz`,
      `"${restaurantName}" "${city}" New Zealand site:nextorder.co.nz`,
      `"${restaurantName}" "${city}" New Zealand site:foodhub.co.nz`,
      `"${restaurantName}" "${city}" New Zealand site:ordermeal.co.nz`,
      `"${restaurantName}" "${city}" New Zealand website contact hours` // General search for restaurant website
    ];

    const foundUrls = {
      websiteUrl: null,
      ubereatsUrl: null,
      doordashUrl: null,
      facebookUrl: null,
      instagramUrl: null,
      meandyouUrl: null,
      mobi2goUrl: null,
      delivereasyUrl: null,
      nextorderUrl: null,
      foodhubUrl: null,
      ordermealUrl: null
    };

    console.log('[Google Business Search] Searching for platform URLs...');
    
    // Combine into a single search query to avoid rate limits
    const combinedQuery = `"${restaurantName}" "${city}" New Zealand (website OR ubereats OR doordash OR delivereasy OR facebook OR instagram OR menu OR order online)`;
    
    try {
      const searchResponse = await axios.post(
        `${FIRECRAWL_API_URL}/v2/search`,
        {
          query: combinedQuery,
          limit: 10,
          lang: 'en',
          country: 'nz',
          sources: [{ type: 'web' }]
          // Removed scrapeOptions to avoid timeout and large responses
        },
        {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Debug log the response structure
      console.log('[Google Business Search] Search response structure:', Object.keys(searchResponse.data || {}));
      
      // Check for web results in the correct path
      const results = searchResponse.data?.data?.web || searchResponse.data?.data || [];
      
      if (results && Array.isArray(results)) {
        console.log(`[Google Business Search] Found ${results.length} search results`);
        
        // Categorize URLs from search results
        for (const result of results) {
          const url = result.url.toLowerCase();
          
          if (url.includes('ubereats.com') && !foundUrls.ubereatsUrl) {
            foundUrls.ubereatsUrl = result.url;
          } else if (url.includes('doordash.com') && !foundUrls.doordashUrl) {
            foundUrls.doordashUrl = result.url;
          } else if (url.includes('facebook.com') && !foundUrls.facebookUrl) {
            foundUrls.facebookUrl = result.url;
          } else if (url.includes('instagram.com') && !foundUrls.instagramUrl) {
            foundUrls.instagramUrl = result.url;
          } else if (url.includes('meandyou.co.nz') && !foundUrls.meandyouUrl) {
            foundUrls.meandyouUrl = result.url;
          } else if (url.includes('mobi2go.com') && !foundUrls.mobi2goUrl) {
            foundUrls.mobi2goUrl = result.url;
          } else if (url.includes('delivereasy.co.nz') && !foundUrls.delivereasyUrl) {
            foundUrls.delivereasyUrl = result.url;
          } else if (url.includes('nextorder.co.nz') && !foundUrls.nextorderUrl) {
            foundUrls.nextorderUrl = result.url;
          } else if (url.includes('foodhub.co.nz') && !foundUrls.foodhubUrl) {
            foundUrls.foodhubUrl = result.url;
          } else if (url.includes('ordermeal.co.nz') && !foundUrls.ordermealUrl) {
            foundUrls.ordermealUrl = result.url;
          } else if (!foundUrls.websiteUrl && 
                    !url.includes('ubereats') && 
                    !url.includes('doordash') && 
                    !url.includes('facebook') && 
                    !url.includes('instagram') &&
                    !url.includes('google') &&
                    !url.includes('yelp') &&
                    !url.includes('tripadvisor') &&
                    !url.includes('menulog') &&
                    !url.includes('zomato')) {
            // Likely the restaurant's own website
            foundUrls.websiteUrl = result.url;
          }
          
        }
      }
    } catch (err) {
      console.log('[Google Business Search] Search error:', err.message);
      if (err.response?.status === 429) {
        console.log('[Google Business Search] Rate limit hit, waiting before retry...');
        // Wait 2 seconds and try a simpler search
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const simpleSearch = await axios.post(
            `${FIRECRAWL_API_URL}/v2/search`,
            {
              query: `"${restaurantName}" "${city}" New Zealand`,
              limit: 10,
              lang: 'en',
              country: 'nz',
              sources: [{ type: 'web' }]
            },
            {
              headers: {
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          const retryResults = simpleSearch.data?.data?.web || simpleSearch.data?.data || [];
          if (retryResults && Array.isArray(retryResults)) {
            const results = retryResults;
            for (const result of results) {
              const url = result.url.toLowerCase();
              if (!foundUrls.websiteUrl && !url.includes('google') && !url.includes('yelp')) {
                foundUrls.websiteUrl = result.url;
                break;
              }
            }
          }
        } catch (retryErr) {
          console.log('[Google Business Search] Retry also failed:', retryErr.message);
        }
      }
    }
    
    console.log('[Google Business Search] Found URLs:', foundUrls);

    // Step 2: Add platform-specific searches for missing URLs
    if (!foundUrls.doordashUrl) {
      // Try specific DoorDash search
      try {
        const doordashSearch = await axios.post(
          `${FIRECRAWL_API_URL}/v2/search`,
          {
            query: `"${restaurantName}" "${city}" site:doordash.com`,
            limit: 3,
            lang: 'en',
            country: 'nz',
            sources: [{ type: 'web' }]
          },
          {
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const doordashResults = doordashSearch.data?.data?.web || doordashSearch.data?.data || [];
        for (const result of doordashResults) {
          if (result.url.includes('doordash.com/store/')) {
            foundUrls.doordashUrl = result.url.split('?')[0]; // Remove tracking params
            console.log('[Google Business Search] Found DoorDash URL from specific search:', foundUrls.doordashUrl);
            break;
          }
        }
      } catch (err) {
        console.log('[Google Business Search] DoorDash search failed:', err.message);
      }
    }
    
    console.log('[Google Business Search] Found URLs:', foundUrls);

    // Step 3: Use platform-specific extraction based on URL type
    // Helper function to clean social media URLs
    const cleanSocialMediaUrl = (url) => {
      if (!url) return null;
      // Remove query parameters from Instagram URLs (like ?hl=en)
      if (url.includes('instagram.com') && url.includes('?')) {
        return url.split('?')[0];
      }
      // Remove query parameters from Facebook URLs (like ?locale=en_US)
      if (url.includes('facebook.com') && url.includes('?')) {
        return url.split('?')[0];
      }
      return url;
    };

    let extractedData = {
      restaurantName: restaurantName,
      openingHours: [],
      address: null,
      phone: null,
      websiteUrl: foundUrls.websiteUrl,
      ubereatsUrl: foundUrls.ubereatsUrl,
      doordashUrl: foundUrls.doordashUrl,
      facebookUrl: cleanSocialMediaUrl(foundUrls.facebookUrl),
      instagramUrl: cleanSocialMediaUrl(foundUrls.instagramUrl),
      meandyouUrl: foundUrls.meandyouUrl,
      mobi2goUrl: foundUrls.mobi2goUrl,
      delivereasyUrl: foundUrls.delivereasyUrl,
      nextorderUrl: foundUrls.nextorderUrl,
      foodhubUrl: foundUrls.foodhubUrl,
      ordermealUrl: foundUrls.ordermealUrl,
      imageUrls: [],
      cuisine: [],
      extractionNotes: []
    };

    // Helper function to get platform-specific extraction config
    const getExtractionConfig = (url) => {
      const urlLower = url.toLowerCase();
      
      if (urlLower.includes('ubereats.com')) {
        return {
          prompt: `Extract restaurant business information from this UberEats page. Look for:
            1. Physical address (street address, not just area)
            2. Phone number if available
            3. Opening hours for each day - look for both lunch and dinner times if they exist separately
            Important: Some restaurants have split hours (lunch and dinner). Extract both time periods for each day if present.`,
          schema: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              phone: { type: 'string' },
              openingHours: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'string', description: 'Day of the week (Monday, Tuesday, etc.)' },
                    open: { type: 'string', description: 'Opening time' },
                    close: { type: 'string', description: 'Closing time' },
                    period: { type: 'string', description: 'Optional: Lunch or Dinner if split hours' }
                  }
                }
              }
            }
          },
          waitFor: 3000
        };
      } else {
        // Default for restaurant websites
        return {
          prompt: `Extract restaurant information for ${restaurantName}. Look for business hours, phone numbers, and physical address. For opening hours, handle day ranges like "Monday-Saturday" by listing each day separately.`,
          schema: {
            type: 'object',
            properties: {
              restaurantName: { type: 'string' },
              address: { type: 'string' },
              phone: { type: 'string' },
              openingHours: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'string' },
                    open: { type: 'string' },
                    close: { type: 'string' },
                    closed: { type: 'boolean' }
                  }
                }
              }
            }
          },
          waitFor: 2000
        };
      }
    };

    // Create priority list of URLs to try - ONLY website and UberEats
    // Website gets all info (phone, address, hours)
    // UberEats only for fallback (address and hours only, no phone)
    const urlsToTry = [];
    
    // First priority: website for all info
    if (foundUrls.websiteUrl) {
      urlsToTry.push({ url: foundUrls.websiteUrl, extractPhone: true, extractAddress: true, extractHours: true });
    }
    
    // Second priority: UberEats for address and hours only (no phone)
    if (foundUrls.ubereatsUrl) {
      urlsToTry.push({ url: foundUrls.ubereatsUrl, extractPhone: false, extractAddress: true, extractHours: true });
    }
    
    // Never extract from DoorDash or other platforms - they're unreliable

    // Define what we're looking for
    const extractionGoals = {
      address: !extractedData.address,
      phone: !extractedData.phone,
      openingHours: extractedData.openingHours.length === 0
    };
    
    // Try each URL based on what data we still need
    for (const urlConfig of urlsToTry) {
      const urlToScrape = urlConfig.url;
      
      // Check if we already have all the data we need
      if (!extractionGoals.address && !extractionGoals.phone && !extractionGoals.openingHours) {
        console.log('[Google Business Search] All required data found, skipping remaining URLs');
        break;
      }
      
      // Skip this URL if we already have what it can provide
      if (!urlConfig.extractPhone || !extractionGoals.phone) {
        if (!urlConfig.extractAddress || !extractionGoals.address) {
          if (!urlConfig.extractHours || !extractionGoals.openingHours) {
            console.log('[Google Business Search] Skipping', urlToScrape, '- already have data it can provide');
            continue;
          }
        }
      }
      
      // Clean the URL - remove query parameters for delivery platforms
      let cleanUrl = urlToScrape;
      if (urlToScrape.includes('ubereats.com')) {
        cleanUrl = urlToScrape.split('?')[0];
      }
      
      console.log('[Google Business Search] Scraping detailed info from:', cleanUrl);
      
      try {
        const extractionConfig = getExtractionConfig(cleanUrl);
        
        // Use platform-specific extraction
        const scrapeResponse = await axios.post(
          `${FIRECRAWL_API_URL}/v2/scrape`,
          {
            url: cleanUrl,
            formats: [{
              type: 'json',
              prompt: extractionConfig.prompt,
              schema: extractionConfig.schema
            }],
            onlyMainContent: true,
            waitFor: extractionConfig.waitFor
          },
          {
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (scrapeResponse.data?.data?.json) {
          const jsonData = scrapeResponse.data.data.json;
          console.log('[Google Business Search] JSON extraction result:', jsonData);
          
          // Check if we got valid data (not 'null' strings or empty data)
          const hasValidData = (
            (jsonData.address && jsonData.address !== 'null' && jsonData.address !== '') ||
            (jsonData.phone && jsonData.phone !== 'null' && jsonData.phone !== '') ||
            (jsonData.openingHours && jsonData.openingHours.length > 0)
          );
          
          if (!hasValidData) {
            console.log('[Google Business Search] No valid data found from:', urlToScrape, '- trying next URL');
            continue; // Try next URL
          }
          
          // Process opening hours - handle split hours and expand day ranges
          if (jsonData.openingHours && Array.isArray(jsonData.openingHours)) {
            const expandedHours = [];
            const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            
            for (const hours of jsonData.openingHours) {
              // Skip invalid entries
              if (!hours.day || hours.day.toLowerCase().includes('menu') || hours.day.toLowerCase().includes('dinner menu')) {
                continue;
              }
              
              // Handle "Every day" or "Daily"
              const dayStr = hours.day.toLowerCase();
              if (dayStr.includes('every day') || dayStr === 'daily' || dayStr === 'everyday' || dayStr === 'every day') {
                console.log('[Google Business Search] Expanding "Every day" hours:', hours);
                // Expand to all days
                for (const day of allDays) {
                  expandedHours.push({
                    day: day,
                    hours: {
                      open: hours.open || '',
                      close: hours.close || '',
                      period: hours.period || ''
                    }
                  });
                }
              } else if (hours.day && hours.day.includes('-')) {
                // Handle day ranges like "Monday-Saturday"
                const [startDay, endDay] = hours.day.split('-').map(d => d.trim());
                const startIdx = allDays.findIndex(d => d.toLowerCase().startsWith(startDay.toLowerCase().substring(0, 3)));
                const endIdx = allDays.findIndex(d => d.toLowerCase().startsWith(endDay.toLowerCase().substring(0, 3)));
                
                if (startIdx !== -1 && endIdx !== -1) {
                  for (let i = startIdx; i <= endIdx; i++) {
                    expandedHours.push({
                      day: allDays[i],
                      hours: {
                        open: hours.open || '',
                        close: hours.close || '',
                        period: hours.period || ''
                      }
                    });
                  }
                }
              } else if (allDays.includes(hours.day)) {
                // Single day - only if it's a valid day name
                expandedHours.push({
                  day: hours.day,
                  hours: {
                    open: hours.open || '',
                    close: hours.close || '',
                    period: hours.period || ''
                  }
                });
              }
            }
            
            extractedData.openingHours = expandedHours;
          }
          
          // Process phone number with cleaning - only if this source should provide phone
          if (urlConfig.extractPhone && jsonData.phone && jsonData.phone !== 'N/A' && jsonData.phone !== 'null') {
            const cleanAndValidateNZPhone = (phoneStr) => {
              let cleaned = phoneStr.replace(/[^\d+]/g, '');
              if (cleaned.length < 9 || cleaned.length > 15) return null;
              
              const validPatterns = [
                /^\+64[2-9]\d{7,9}$/,
                /^0[3-9]\d{7}$/,
                /^02[0-9]\d{7,8}$/,
                /^0800\d{6,7}$/,
                /^0508\d{6}$/
              ];
              
              const isValid = validPatterns.some(pattern => pattern.test(cleaned));
              if (!isValid) return null;
              
              if (!cleaned.startsWith('+64') && cleaned.startsWith('0')) {
                cleaned = '+64' + cleaned.substring(1);
              }
              
              return cleaned;
            };
            
            const cleanedPhone = cleanAndValidateNZPhone(jsonData.phone);
            if (cleanedPhone) {
              extractedData.phone = cleanedPhone;
            }
          }
          
          // Process address (check it's not 'null' string) - only if this source should provide address
          if (urlConfig.extractAddress && jsonData.address && jsonData.address !== 'null' && jsonData.address !== '' && jsonData.address !== 'N/A') {
            // Don't accept numbers-only addresses (like "35341547" from DoorDash)
            if (!/^\d+$/.test(jsonData.address)) {
              extractedData.address = jsonData.address;
              extractionGoals.address = false;
            }
          }
          
          // Update extraction goals
          if (extractedData.openingHours.length > 0) {
            extractionGoals.openingHours = false;
          }
          if (extractedData.phone) {
            extractionGoals.phone = false;
          }
          
          // Continue to next URL if we still need data and this source didn't have everything
          const stillNeedData = extractionGoals.address || extractionGoals.phone || extractionGoals.openingHours;
          if (!stillNeedData) {
            console.log('[Google Business Search] All required data extracted successfully');
            break;
          } else {
            console.log('[Google Business Search] Still missing:', Object.keys(extractionGoals).filter(k => extractionGoals[k]));
            // Continue to next URL
          }
        }
      } catch (scrapeError) {
        console.error('[Google Business Search] Scrape error for', urlToScrape, ':', scrapeError.message);
        // Continue to next URL
      }
    }
    
    // Add note if we tried multiple URLs
    if (urlsToTry.length > 1 && extractedData.openingHours.length === 0 && !extractedData.address && !extractedData.phone) {
      extractedData.extractionNotes.push('Tried multiple sources but could not extract business details');
    }

    // Format opening hours with 24-hour format and handle complex schedules
    const formattedHours = [];
    
    // Group hours by day to handle multiple slots (lunch/dinner)
    const hoursByDay = {};
    extractedData.openingHours.forEach(hours => {
      if (!hours.day || !hours.hours?.open || !hours.hours?.close) return;
      
      const day = hours.day;
      if (!hoursByDay[day]) {
        hoursByDay[day] = [];
      }
      
      // Convert to 24-hour format
      const open24 = convertTo24Hour(hours.hours.open);
      const close24 = convertTo24Hour(hours.hours.close);
      
      if (!open24 || !close24) return;
      
      hoursByDay[day].push({
        open: open24,
        close: close24,
        period: hours.hours.period || ''
      });
    });
    
    // Process each day's hours
    Object.entries(hoursByDay).forEach(([day, slots]) => {
      slots.forEach(slot => {
        const openTime = parseTime(slot.open);
        const closeTime = parseTime(slot.close);
        
        // Check for midnight crossing
        if (closeTime < openTime && closeTime !== 0) {
          // Split into two entries for midnight crossing
          formattedHours.push({
            day: day,
            hours: { 
              open: slot.open, 
              close: "23:59",
              ...(slot.period && { period: slot.period })
            }
          });
          
          const nextDay = getNextDay(day);
          formattedHours.push({
            day: nextDay,
            hours: { 
              open: "00:00", 
              close: slot.close,
              ...(slot.period && { period: slot.period })
            }
          });
        } else {
          // Normal hours (no midnight crossing)
          formattedHours.push({
            day: day,
            hours: { 
              open: slot.open, 
              close: slot.close,
              ...(slot.period && { period: slot.period })
            }
          });
        }
      });
    });

    // Add extraction notes
    if (formattedHours.length === 0) {
      extractedData.extractionNotes.push('Opening hours not found');
    }
    if (!extractedData.address) {
      extractedData.extractionNotes.push('Address not found');
    }
    if (!extractedData.phone) {
      extractedData.extractionNotes.push('Phone number not found');
    }

    // Helper function to clean platform URLs
    const cleanPlatformUrl = (url, platform) => {
      if (!url) return null;
      
      // Remove tracking parameters from UberEats URLs
      if (platform === 'ubereats' && url.includes('?')) {
        return url.split('?')[0];
      }
      
      // Remove tracking parameters from DoorDash URLs  
      if (platform === 'doordash' && url.includes('?')) {
        return url.split('?')[0];
      }
      
      return url;
    };
    
    // Clean the extracted URLs
    if (extractedData.ubereatsUrl) {
      extractedData.ubereatsUrl = cleanPlatformUrl(extractedData.ubereatsUrl, 'ubereats');
    }
    if (extractedData.doordashUrl) {
      extractedData.doordashUrl = cleanPlatformUrl(extractedData.doordashUrl, 'doordash');
    }
    
    // Update restaurant if ID provided
    if (restaurantId && db.isDatabaseAvailable()) {
      const updateData = {};
      
      if (extractedData.address) updateData.address = extractedData.address;
      if (extractedData.phone) updateData.phone = extractedData.phone;
      if (extractedData.websiteUrl) updateData.website_url = extractedData.websiteUrl;
      if (extractedData.ubereatsUrl) updateData.ubereats_url = extractedData.ubereatsUrl;
      if (extractedData.doordashUrl) updateData.doordash_url = extractedData.doordashUrl;
      if (extractedData.instagramUrl) updateData.instagram_url = extractedData.instagramUrl;
      if (extractedData.facebookUrl) updateData.facebook_url = extractedData.facebookUrl;
      if (extractedData.meandyouUrl) updateData.meandyou_url = extractedData.meandyouUrl;
      if (extractedData.mobi2goUrl) updateData.mobi2go_url = extractedData.mobi2goUrl;
      if (extractedData.delivereasyUrl) updateData.delivereasy_url = extractedData.delivereasyUrl;
      if (extractedData.nextorderUrl) updateData.nextorder_url = extractedData.nextorderUrl;
      if (extractedData.foodhubUrl) updateData.foodhub_url = extractedData.foodhubUrl;
      if (extractedData.ordermealUrl) updateData.ordermeal_url = extractedData.ordermealUrl;
      if (formattedHours.length > 0) updateData.opening_hours = formattedHours;
      
      // Log extracted data for debugging
      console.log('[Google Business Search] Extracted data:', {
        address: extractedData.address || 'Not found',
        phone: extractedData.phone || 'Not found',
        website: extractedData.websiteUrl || 'Not found',
        ubereats: extractedData.ubereatsUrl || 'Not found',
        doordash: extractedData.doordashUrl || 'Not found',
        instagram: extractedData.instagramUrl || 'Not found',
        facebook: extractedData.facebookUrl || 'Not found',
        meandyou: extractedData.meandyouUrl || 'Not found',
        mobi2go: extractedData.mobi2goUrl || 'Not found',
        delivereasy: extractedData.delivereasyUrl || 'Not found',
        nextorder: extractedData.nextorderUrl || 'Not found',
        foodhub: extractedData.foodhubUrl || 'Not found',
        ordermeal: extractedData.ordermealUrl || 'Not found',
        hoursCount: formattedHours.length,
        platformsFound: Object.entries(foundUrls).filter(([k, v]) => v).map(([k]) => k)
      });
      
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log(`[Google Business Search] Updated restaurant ${restaurantId} with extracted data`);
    }

    console.log('[Google Business Search] Final extraction result:', {
      name: extractedData.restaurantName,
      hoursFound: formattedHours.length,
      address: extractedData.address,
      phone: extractedData.phone,
      platformUrls: Object.entries(foundUrls).filter(([k, v]) => v).map(([k]) => k),
      notes: extractedData.extractionNotes
    });

    return res.json({
      success: true,
      data: {
        ...extractedData,
        openingHours: formattedHours
      }
    });
    
  } catch (error) {
    console.error('[Google Business Search] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to search for business information'
    });
  }
});

// Helper function to convert time to 24-hour format
function convertTo24Hour(timeStr) {
  if (!timeStr) return '';
  
  // Handle special cases for closing times
  const lowerStr = timeStr.toLowerCase().trim();
  if (lowerStr === 'late' || lowerStr === 'late night') {
    return '23:00';
  }
  if (lowerStr === 'midnight') {
    return '00:00';
  }
  
  // Already in 24-hour format
  if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Handle times without minutes (e.g., "11am", "5 PM")
  const simpleMatch = timeStr.match(/^(\d{1,2})\s*(AM|PM|am|pm)$/i);
  if (simpleMatch) {
    let hours = parseInt(simpleMatch[1]);
    const period = simpleMatch[2];
    
    if (period && period.toLowerCase() === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period && period.toLowerCase() === 'am' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:00`;
  }
  
  // Parse 12-hour format with minutes (e.g., "5:00 pm", "11:30 AM", "10:00pm")
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
  if (!match) return timeStr;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3];
  
  if (period && period.toLowerCase() === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period && period.toLowerCase() === 'am' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper function to parse time strings to minutes for comparison
function parseTime(timeStr) {
  const time24 = convertTo24Hour(timeStr);
  if (!time24) return 0;
  
  const [hours, minutes] = time24.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to get next day
function getNextDay(day) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const index = days.indexOf(day);
  return days[(index + 1) % 7];
}

/**
 * POST /api/website-extraction/logo
 * Extract logo and brand colors from restaurant website
 */
app.post('/api/website-extraction/logo', async (req, res) => {
  try {
    const { restaurantId, websiteUrl, additionalImages = [] } = req.body;
    
    if (!restaurantId || !websiteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID and website URL are required'
      });
    }
    
    console.log('[API] Starting logo extraction for:', websiteUrl);
    
    // Import the logo extraction service
    const logoService = require('./src/services/logo-extraction-service');
    
    // Extract logo and colors
    const result = await logoService.extractLogoAndColors(websiteUrl);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to extract logo'
      });
    }
    
    // Process additional images if provided
    let savedImages = [];
    if (additionalImages.length > 0) {
      console.log('[API] Processing additional images for storage...');
      
      savedImages = await Promise.all(additionalImages.map(async (imageData) => {
        try {
          const imageBuffer = await logoService.downloadImageToBuffer(imageData.url, websiteUrl);
          const metadata = await sharp(imageBuffer).metadata();
          
          // Convert to base64 for storage
          const base64 = `data:image/${metadata.format};base64,${imageBuffer.toString('base64')}`;
          
          return {
            url: imageData.url,
            base64: base64,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            description: imageData.description || '',
            confidence: imageData.confidence || 0,
            location: imageData.location || '',
            savedAt: new Date().toISOString()
          };
        } catch (error) {
          console.error('[API] Failed to process additional image:', imageData.url, error.message);
          return null;
        }
      }));
      
      // Filter out failed images
      savedImages = savedImages.filter(img => img !== null);
      console.log('[API] Successfully processed', savedImages.length, 'additional images');
    }
    
    // Update restaurant in database if extraction successful
    if (db.isDatabaseAvailable()) {
      const updateData = {
        logo_url: result.logoVersions?.original,
        logo_nobg_url: result.logoVersions?.nobg,
        logo_standard_url: result.logoVersions?.standard,
        logo_thermal_url: result.logoVersions?.thermal,
        logo_thermal_alt_url: result.logoVersions?.thermal_alt,
        logo_thermal_contrast_url: result.logoVersions?.thermal_contrast,
        logo_thermal_adaptive_url: result.logoVersions?.thermal_adaptive,
        logo_favicon_url: result.logoVersions?.favicon,
        primary_color: result.colors?.primaryColor,
        secondary_color: result.colors?.secondaryColor,
        tertiary_color: result.colors?.tertiaryColor,
        accent_color: result.colors?.accentColor,
        background_color: result.colors?.backgroundColor,
        theme: result.colors?.theme,
        brand_colors: result.colors?.brandColors || []
      };
      
      // Add saved images if any
      if (savedImages.length > 0) {
        updateData.saved_images = savedImages;
      }
      
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log('[API] Updated restaurant with logo, colors, and', savedImages.length, 'additional images');
    }
    
    return res.json({
      success: true,
      data: {
        logoVersions: result.logoVersions,
        colors: result.colors,
        savedImages: savedImages.length,
        extractedAt: result.extractedAt
      }
    });
    
  } catch (error) {
    console.error('[API] Logo extraction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract logo and colors'
    });
  }
});

/**
 * POST /api/website-extraction/logo-candidates
 * Extract multiple logo candidates for user selection
 */
app.post('/api/website-extraction/logo-candidates', async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    
    if (!websiteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Website URL is required'
      });
    }
    
    console.log('[API] Finding logo candidates for:', websiteUrl);
    
    // Import logo service locally
    const logoService = require('./src/services/logo-extraction-service');
    
    // Get logo candidates
    const candidates = await logoService.extractLogoCandidatesWithFirecrawl(websiteUrl);
    
    if (!candidates || candidates.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No logo candidates found on website'
      });
    }
    
    // Process and validate each candidate
    const processedCandidates = await Promise.all(candidates.map(async (candidate, index) => {
      try {
        // Test if the URL is actually accessible
        const imageBuffer = await logoService.downloadImageToBuffer(candidate.url, websiteUrl);
        
        // For small images or favicons, create a preview
        if (candidate.confidence < 50 || candidate.format === 'ico' || !candidate.url.startsWith('http')) {
          const previewBuffer = await sharp(imageBuffer)
            .resize(100, 100, {
              fit: 'contain',
              background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toBuffer();
          
          candidate.preview = `data:image/png;base64,${previewBuffer.toString('base64')}`;
        }
        
        // Mark as valid since download succeeded
        candidate.valid = true;
        return candidate;
      } catch (error) {
        console.log(`[API] Could not create preview for candidate ${index}:`, error.message);
        // Mark as invalid - the URL doesn't work
        candidate.valid = false;
        return candidate;
      }
    }));
    
    // Filter out invalid candidates (404s, etc)
    const validCandidates = processedCandidates.filter(c => c.valid);
    
    // Remove the 'valid' flag before sending to frontend
    validCandidates.forEach(c => delete c.valid);
    
    if (validCandidates.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid logo images found on website (all URLs returned 404)'
      });
    }
    
    return res.json({
      success: true,
      data: {
        websiteUrl,
        candidates: validCandidates,
        extractedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[API] Logo candidates extraction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract logo candidates'
    });
  }
});

/**
 * POST /api/website-extraction/process-selected-logo
 * Process a selected logo candidate into all required formats
 */
app.post('/api/website-extraction/process-selected-logo', async (req, res) => {
  try {
    const { logoUrl, websiteUrl, restaurantId, additionalImages = [] } = req.body;
    
    if (!logoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Logo URL is required'
      });
    }
    
    console.log('[API] Processing selected logo:', logoUrl);
    console.log('[API] Additional images to save:', additionalImages.length);
    
    // Import logo service locally
    const logoService = require('./src/services/logo-extraction-service');
    
    // Download and process the selected logo
    // Use websiteUrl if provided, otherwise use the logo URL's origin as referrer
    const referrerUrl = websiteUrl || new URL(logoUrl).origin;
    const logoBuffer = await logoService.downloadImageToBuffer(logoUrl, referrerUrl);
    const colors = await logoService.extractColorsFromLogo(logoBuffer);
    const logoVersions = await logoService.processLogoVersions(logoBuffer);
    
    // Process additional images if provided
    let savedImages = [];
    if (additionalImages.length > 0) {
      console.log('[API] Processing additional images for storage...');
      
      savedImages = await Promise.all(additionalImages.map(async (imageData) => {
        try {
          const imageBuffer = await logoService.downloadImageToBuffer(imageData.url, referrerUrl);
          const metadata = await sharp(imageBuffer).metadata();
          
          // Convert to base64 for storage
          const base64 = `data:image/${metadata.format};base64,${imageBuffer.toString('base64')}`;
          
          return {
            url: imageData.url,
            base64: base64,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            description: imageData.description || '',
            confidence: imageData.confidence || 0,
            location: imageData.location || '',
            savedAt: new Date().toISOString()
          };
        } catch (error) {
          console.error('[API] Failed to process additional image:', imageData.url, error.message);
          return null;
        }
      }));
      
      // Filter out failed images
      savedImages = savedImages.filter(img => img !== null);
      console.log('[API] Successfully processed', savedImages.length, 'additional images');
    }
    
    // Update restaurant if ID provided
    if (restaurantId && db.isDatabaseAvailable()) {
      const updateData = {
        logo_url: logoVersions?.original,
        logo_nobg_url: logoVersions?.nobg,
        logo_standard_url: logoVersions?.standard,
        logo_thermal_url: logoVersions?.thermal,
        logo_thermal_alt_url: logoVersions?.thermal_alt,
        logo_thermal_contrast_url: logoVersions?.thermal_contrast,
        logo_thermal_adaptive_url: logoVersions?.thermal_adaptive,
        logo_favicon_url: logoVersions?.favicon,
        primary_color: colors?.primaryColor,
        secondary_color: colors?.secondaryColor,
        tertiary_color: colors?.tertiaryColor,
        accent_color: colors?.accentColor,
        background_color: colors?.backgroundColor,
        theme: colors?.theme,
        brand_colors: colors?.brandColors || []
      };
      
      // Add saved images if any
      if (savedImages.length > 0) {
        updateData.saved_images = savedImages;
      }
      
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log('[API] Updated restaurant with selected logo, colors, and', savedImages.length, 'additional images');
    }
    
    return res.json({
      success: true,
      data: {
        logoVersions,
        colors,
        savedImages: savedImages.length,
        processedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[API] Logo processing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process selected logo'
    });
  }
});

/**
 * POST /api/menus/:id/duplicate
 * Duplicate a menu
 */
app.post('/api/menus/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const newMenu = await db.duplicateMenu(id);
    
    if (!newMenu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found or duplication failed'
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Menu duplicated successfully',
      menu: newMenu
    });
  } catch (error) {
    console.error('[API] Error duplicating menu:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to duplicate menu'
    });
  }
});

/**
 * Item Management API endpoints
 */

/**
 * PATCH /api/menu-items/:id
 * Update a single menu item
 */
app.patch('/api/menu-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const item = await db.updateMenuItem(id, updates);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found or update failed'
      });
    }
    
    return res.json({
      success: true,
      item: item
    });
  } catch (error) {
    console.error('[API] Error updating menu item:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update menu item'
    });
  }
});

/**
 * POST /api/menu-items/bulk-update
 * Bulk update menu items
 */
app.post('/api/menu-items/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const results = await db.bulkUpdateMenuItems(updates);
    
    return res.json({
      success: true,
      updated: results.length,
      items: results
    });
  } catch (error) {
    console.error('[API] Error bulk updating menu items:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk update menu items'
    });
  }
});

/**
 * POST /api/categories/:id/items
 * Add an item to a category
 */
app.post('/api/categories/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const itemData = req.body;
    
    if (!itemData.name || !itemData.price) {
      return res.status(400).json({
        success: false,
        error: 'Item name and price are required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const item = await db.addItemToCategory(id, itemData);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or item creation failed'
      });
    }
    
    return res.status(201).json({
      success: true,
      item: item
    });
  } catch (error) {
    console.error('[API] Error adding item to category:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add item to category'
    });
  }
});

/**
 * Analytics API endpoints
 */

/**
 * GET /api/menus/compare
 * Compare menus with query parameters
 */
app.get('/api/menus/compare', async (req, res) => {
  try {
    const { menu1, menu2 } = req.query;
    
    if (!menu1 || !menu2) {
      return res.status(400).json({
        success: false,
        error: 'Both menu1 and menu2 parameters are required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const comparison = await db.compareMenus(menu1, menu2);
    
    if (!comparison) {
      return res.status(404).json({
        success: false,
        error: 'One or both menus not found'
      });
    }
    
    return res.json({
      success: true,
      comparison: comparison
    });
  } catch (error) {
    console.error('[API] Error comparing menus:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to compare menus'
    });
  }
});

/**
 * GET /api/restaurants/:id/price-history
 * Get price history for a restaurant
 */
app.get('/api/restaurants/:id/price-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, startDate, endDate } = req.query;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    let history = await db.getPriceHistory(id, itemId);
    
    // Filter by date if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date('1970-01-01');
      const end = endDate ? new Date(endDate) : new Date();
      
      history = history.filter(h => {
        const detected = new Date(h.detected_at);
        return detected >= start && detected <= end;
      });
    }
    
    return res.json({
      success: true,
      restaurantId: id,
      count: history.length,
      history: history
    });
  } catch (error) {
    console.error('[API] Error getting price history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get price history'
    });
  }
});

/**
 * GET /api/analytics/extraction-stats
 * Get extraction statistics
 */
app.get('/api/analytics/extraction-stats', async (req, res) => {
  try {
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const stats = await db.getExtractionStats();
    
    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Failed to calculate statistics'
      });
    }
    
    return res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('[API] Error getting extraction stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get extraction statistics'
    });
  }
});

/**
 * Export API endpoints
 */

/**
 * POST /api/exports/csv
 * Generate CSV export from database
 */
app.post('/api/exports/csv', async (req, res) => {
  try {
    const { menuId, format = 'full' } = req.body;
    
    if (!menuId) {
      return res.status(400).json({
        success: false,
        error: 'menuId is required'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get the menu with items
    const menu = await db.getMenuWithItems(menuId);
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Transform to CSV format based on format type
    const menuItems = [];
    
    if (menu.categories) {
      menu.categories.forEach(category => {
        if (category.menu_items) {
          category.menu_items.forEach(item => {
            let imageURL = '';
            if (item.item_images && item.item_images.length > 0) {
              const primaryImage = item.item_images.find(img => img.type === 'primary');
              imageURL = primaryImage ? primaryImage.url : item.item_images[0].url;
            }
            
            const menuItem = {
              menuName: menu.restaurants?.name || 'Menu',
              categoryName: category.name,
              dishName: item.name,
              dishPrice: item.price,
              dishDescription: item.description || '',
              tags: item.tags || [],
              imageURL: imageURL
            };
            
            // Apply format-specific transformations
            if (format === 'clean') {
              // Remove images for clean format
              menuItem.imageURL = '';
            } else if (format === 'changes') {
              // Only include items with recent price changes
              // This would need price history data
            }
            
            menuItems.push(menuItem);
          });
        }
      });
    }
    
    // Generate CSV
    const headers = format === 'clean' 
      ? ['menuName', 'categoryName', 'dishName', 'dishPrice', 'dishDescription', 'tags']
      : ['menuID', 'menuName', 'menuDisplayName', 'menuDescription',
         'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
         'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
         'displayName', 'printName', 'tags', 'imageURL'];
    
    const rows = [];
    menuItems.forEach(item => {
      if (format === 'clean') {
        rows.push([
          escapeCSVField(item.menuName),
          escapeCSVField(item.categoryName),
          escapeCSVField(item.dishName),
          formatPrice(item.dishPrice),
          escapeCSVField(item.dishDescription),
          escapeCSVField(Array.isArray(item.tags) ? item.tags.join(', ') : '')
        ]);
      } else {
        rows.push([
          '', // menuID
          escapeCSVField(item.menuName),
          '', // menuDisplayName
          '', // menuDescription
          '', // categoryID
          escapeCSVField(item.categoryName),
          '', // categoryDisplayName
          '', // categoryDescription
          '', // dishID
          escapeCSVField(item.dishName),
          formatPrice(item.dishPrice),
          'standard', // dishType
          escapeCSVField(item.dishDescription),
          '', // displayName
          '', // printName
          escapeCSVField(Array.isArray(item.tags) ? item.tags.join(', ') : ''),
          escapeCSVField(item.imageURL)
        ]);
      }
    });
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    const restaurantName = menu.restaurants?.name || 'restaurant';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${formatFilename(restaurantName)}_menu_${format}_${date}.csv`;
    
    // TODO: Track export in database
    
    return res.json({
      success: true,
      csvData: csvContent,
      filename: filename,
      format: format,
      stats: {
        rowCount: rows.length,
        columnCount: headers.length
      }
    });
  } catch (error) {
    console.error('[API] Error exporting CSV:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export CSV'
    });
  }
});

/**
 * POST /api/exports/pdf
 * Generate PDF export (placeholder)
 */
app.post('/api/exports/pdf', async (req, res) => {
  try {
    const { menuId, template = 'default' } = req.body;
    
    if (!menuId) {
      return res.status(400).json({
        success: false,
        error: 'menuId is required'
      });
    }
    
    // TODO: Implement PDF generation
    // This would require a PDF library like pdfkit or puppeteer
    
    return res.status(501).json({
      success: false,
      error: 'PDF export not yet implemented'
    });
  } catch (error) {
    console.error('[API] Error exporting PDF:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export PDF'
    });
  }
});

/**
 * GET /api/exports/history
 * Get export history (placeholder)
 */
app.get('/api/exports/history', async (req, res) => {
  try {
    const { restaurantId, limit = 50 } = req.query;
    
    // TODO: Implement export history tracking
    // This would require a new exports table in the database
    
    return res.json({
      success: true,
      message: 'Export history tracking not yet implemented',
      exports: []
    });
  } catch (error) {
    console.error('[API] Error getting export history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get export history'
    });
  }
});

/**
 * Serve static files and handle SPA routes
 */
// Serve the main HTML file for client-side routing (SPA)
app.get('*', (req, res) => {
  // Skip for API requests (although by this point, they should have been handled)
  if (req.path.startsWith('/api')) {
    return res.status(404).send('API endpoint not found');
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

/**
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`\n[Server] UberEats Image Extractor API`);
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Firecrawl API Version: v2`);
  console.log(`[Server] Cache Max Age: ${process.env.FIRECRAWL_CACHE_MAX_AGE || 172800} seconds`);
  
  // Initialize database connection
  const dbInitialized = db.initializeDatabase();
  if (dbInitialized) {
    console.log(`[Server] Database: Connected to Supabase`);
  } else {
    console.log(`[Server] Database: Not configured (running in memory-only mode)`);
  }
  console.log('\n[Server] Available endpoints:');
  console.log('\n  === Extraction Endpoints ===');
  console.log(`  POST   /api/scan-categories           - Scan for menu categories`);
  console.log(`  POST   /api/batch-extract-categories  - Extract full menu data`);
  console.log(`  GET    /api/batch-extract-status/:id  - Check extraction status`);
  console.log(`  GET    /api/batch-extract-results/:id - Get extraction results`);
  console.log(`  POST   /api/extract-images-for-category - Extract category images`);
  console.log(`  POST   /api/generate-csv              - Generate CSV from data`);
  console.log(`  POST   /api/generate-clean-csv        - Generate clean CSV`);
  console.log(`  POST   /api/download-images           - Download menu images`);
  
  if (dbInitialized) {
    console.log('\n  === Restaurant Management ===');
    console.log(`  GET    /api/restaurants               - List all restaurants`);
    console.log(`  GET    /api/restaurants/:id           - Get restaurant details`);
    console.log(`  POST   /api/restaurants               - Create new restaurant`);
    console.log(`  PATCH  /api/restaurants/:id           - Update restaurant`);
    console.log(`  GET    /api/restaurants/:id/menus     - Get restaurant menus`);
    console.log(`  GET    /api/restaurants/:id/price-history - Get price history`);
    
    console.log('\n  === Extraction Management ===');
    console.log(`  POST   /api/extractions/start         - Start new extraction`);
    console.log(`  GET    /api/extractions               - List extraction jobs`);
    console.log(`  GET    /api/extractions/:jobId        - Get extraction details`);
    console.log(`  POST   /api/extractions/:jobId/retry  - Retry failed extraction`);
    console.log(`  DELETE /api/extractions/:jobId        - Cancel extraction`);
    
    console.log('\n  === Menu Management ===');
    console.log(`  GET    /api/menus/:id                 - Get full menu with items`);
    console.log(`  GET    /api/menus/:id/csv             - Direct CSV download`);
    console.log(`  GET    /api/menus/compare             - Compare menus (query params)`);
    console.log(`  POST   /api/menus/:id/activate        - Activate menu version`);
    console.log(`  POST   /api/menus/:id/compare         - Compare menu versions`);
    console.log(`  POST   /api/menus/:id/duplicate       - Duplicate menu`);
    console.log(`  POST   /api/menus/:id/export          - Export menu to CSV`);
    console.log(`  POST   /api/menus/:id/download-images - Download menu images from DB`);
    console.log(`  DELETE /api/menus/:id                 - Delete menu`);
    
    console.log('\n  === Item Management ===');
    console.log(`  PATCH  /api/menu-items/:id            - Update menu item`);
    console.log(`  POST   /api/menu-items/bulk-update    - Bulk update items`);
    console.log(`  POST   /api/categories/:id/items      - Add item to category`);
    
    console.log('\n  === Search & Analytics ===');
    console.log(`  GET    /api/search/menus              - Search menu items`);
    console.log(`  GET    /api/search/items              - Search items (alias)`);
    console.log(`  GET    /api/analytics/extraction-stats - Get extraction statistics`);
    
    console.log('\n  === Export ===');
    console.log(`  POST   /api/exports/csv               - Export menu to CSV`);
    console.log(`  POST   /api/exports/pdf               - Export menu to PDF`);
    console.log(`  GET    /api/exports/history           - Get export history`);
  }
  
  console.log('\n  === System Endpoints ===');
  console.log(`  GET    /api/status                    - Server status`);
  
  // Show Firecrawl API key status
  if (!FIRECRAWL_API_KEY) {
    console.warn('\n⚠️  WARNING: FIRECRAWL_API_KEY environment variable is not set');
    console.warn('   Set this variable to enable Firecrawl API integration');
    console.warn('   Example: export FIRECRAWL_API_KEY=your-api-key-here');
  } else {
    console.log(`\n✅ Firecrawl API configured and ready`);
  }
});