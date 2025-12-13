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
  UBEREATS_OPTION_SETS_PROMPT,
  generateCategorySchema
} = require('./src/services/firecrawl-service');

// Import database service
const db = require('./src/services/database-service');

// Import UploadCare service for CDN uploads
const UploadCareService = require('./src/services/uploadcare-service');

// Import rate limiter for Firecrawl API
const rateLimiter = require('./src/services/rate-limiter-service');

// Import auth middleware
const { authMiddleware } = require('./middleware/auth');

// Import super admin middleware
const { superAdminMiddleware, checkSuperAdmin } = require('./middleware/superAdmin');

// Import feature flag middleware
const {
  requireTasksAndSequences,
  requireSocialMedia,
  requireLeadScraping,
  requireRegistration,
  requireFirecrawlBranding,
  getFeatureFlags,
  // Extraction feature flags
  requireStandardExtraction,
  requirePremiumExtraction,
  // CSV feature flags
  requireCsvExport,
  requireCsvWithImagesExport,
  // Search feature flags
  requireGoogleSearch,
  requirePlatformDetails,
  // Logo feature flags
  requireLogoExtraction,
  requireLogoProcessing
} = require('./middleware/feature-flags');

// Import usage tracking service
const { UsageTrackingService, UsageEventType } = require('./src/services/usage-tracking-service');

// Import platform detector
const { detectPlatform, extractRestaurantName, getExtractionConfig } = require('./src/utils/platform-detector');

// Import URL validation functions for Google Business Search
const {
  cleanInstagramUrl,
  cleanFacebookUrl,
  cleanWebsiteUrl
} = require('./src/services/lead-url-validation-service');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3007;

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';

// Environment variables
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const UPLOADCARE_PUBLIC_KEY = process.env.UPLOADCARE_PUBLIC_KEY || '';
const UPLOADCARE_SECRET_KEY = process.env.UPLOADCARE_SECRET_KEY || null;

// Initialize UploadCare service
const uploadcare = new UploadCareService(UPLOADCARE_PUBLIC_KEY, UPLOADCARE_SECRET_KEY);

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
async function startBackgroundExtraction(jobId, url, categories, restaurantName = null, options = {}, platformName = 'unknown') {
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
    // Detect platform type using the new detector (only for restaurant name extraction)
    const platformInfo = detectPlatform(url);
    // platformName is now passed as a parameter, so we don't need to detect it here

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

    // Process categories with configurable concurrency limit
    const concurrencyLimit = parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 2;
    const processingQueue = [...categories];
    const activePromises = new Map();

    // Helper function to process a single category
    const processCategory = async (category) => {
      const categoryId = `${category.name}_${Date.now()}`;
      
      try {
        console.log(`[Job ${jobId}] Starting extraction for category: ${category.name}`);

        // Determine if we should include images based on platform
        // Only include images for UberEats and DoorDash
        // Add images to extractions based on platforms by adding them here
        const includeImages = platformName.toLowerCase() === 'ubereats' ||
                            platformName.toLowerCase() === 'sipo' ||
                            platformName.toLowerCase() === 'doordash';

        // Generate category-specific schema using the helper function
        const categorySchema = generateCategorySchema(category.name, includeImages);

        if (!includeImages) {
          console.log(`[Job ${jobId}] Excluding imageURL from schema for ${platformName} platform`);
        }
        
        // For FoodHub, construct category-specific URL
        let extractionUrl = url;
        let categoryPrompt;

        if (platformName.toLowerCase() === 'foodhub') {
          // FoodHub has separate pages for each category
          // Convert category name to URL slug format
          const categorySlug = category.name.toLowerCase()
            .replace(/&/g, 'and')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

          // Construct the category-specific URL
          const baseUrl = new URL(url).origin;
          extractionUrl = `${baseUrl}/order-now/${categorySlug}`;

          console.log(`[Job ${jobId}] FoodHub category URL: ${extractionUrl}`);

          categoryPrompt = `Extract ALL menu items from this FoodHub category page.

1. This page shows ONLY items from the "${category.name}" category
2. Extract every menu item visible on this page
3. For each item, get:
   - The dish name (usually in a heading or prominent text)
   - The price (numerical value, may have $ symbol)
   - The description (detailed text about the dish)
4. Look for items displayed in cards, lists, or grid layouts
5. Ensure the categoryName field is set to "${category.name}"`;
        } else {
          // Standard extraction for other platforms
          categoryPrompt = `Focus ONLY on extracting menu items from the category "${category.name}" on this ${platformName} page.

1. Navigate to the section for category "${category.name}" ${category.position ? `(approximately at position ${category.position} from the top)` : ''}
2. ${category.selector ? `Look for elements matching the selector "${category.selector}"` : 'Locate the category header or section'}
3. Extract ONLY the menu items within this specific category
4. For each item, get the name, price, description, and image URL (if available)
5. If an item has image, click to open its details to get the high-resolution image
6. DO NOT include items from other categories
7. Ensure the categoryName field exactly matches "${category.name}"`;
        }

        // Prepare v2 category-specific payload
        const categoryPayload = {
          url: extractionUrl,
          formats: [{
            type: 'json',
            schema: categorySchema,
            prompt: categoryPrompt
          }],
          onlyMainContent: true,
          waitFor: 3000,  // Increased from 2000 to 3000ms
          blockAds: true,
          timeout: 270000,  // Firecrawl timeout (increased by 50%)
          // maxAge removed to force fresh scraping
          skipTlsVerification: true,
          removeBase64Images: true
        };

        const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;

        // COMPREHENSIVE DEBUG LOGGING - FULL SCHEMA AND PROMPT
        console.log(`[Job ${jobId}] ========== FIRECRAWL REQUEST FOR: ${category.name} ==========`);
        console.log(`[Job ${jobId}] FULL SCHEMA:`);
        console.log(JSON.stringify(categorySchema, null, 2));
        console.log(`[Job ${jobId}] FULL PROMPT:`);
        console.log(categoryPrompt);
        console.log(`[Job ${jobId}] REQUEST URL: ${apiEndpoint}`);
        console.log(`[Job ${jobId}] PAYLOAD SUMMARY: waitFor=${categoryPayload.waitFor}ms, timeout=${categoryPayload.timeout}ms, maxAge=${categoryPayload.maxAge}s`);

        // Make request to Firecrawl API
        const axiosInstance = axios.create({
          timeout: 360000,  // Axios timeout (increased by 50%)
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
          }
        });

        console.log(`[Job ${jobId}] Sending request to Firecrawl...`);

        // Wait for rate limiter approval
        await rateLimiter.acquireSlot(`batch-category-${category.name}`);

        const requestStartTime = Date.now();
        const categoryResponse = await axiosInstance.post(apiEndpoint, categoryPayload);
        const requestTime = Date.now() - requestStartTime;
        console.log(`[Job ${jobId}] Response received in ${requestTime}ms`);
        
        // Parse v2 response
        const parsedCategoryResponse = categoryResponse.data;
        
        // LOG FULL RESPONSE
        console.log(`[Job ${jobId}] ========== FIRECRAWL RESPONSE FOR: ${category.name} ==========`);
        console.log(`[Job ${jobId}] Response success: ${parsedCategoryResponse.success}`);
        if (parsedCategoryResponse.data?.json) {
          const items = parsedCategoryResponse.data.json.menuItems || [];
          console.log(`[Job ${jobId}] Items returned: ${items.length}`);
          
          // Log first 3 items as sample
          items.slice(0, 3).forEach((item, idx) => {
            console.log(`[Job ${jobId}] Sample Item ${idx + 1}:`);
            console.log(`  - Name: ${item.dishName}`);
            console.log(`  - Price: ${item.dishPrice}`);
            console.log(`  - Has Image: ${!!item.imageURL}`);
            if (item.imageURL) {
              console.log(`  - Image URL: ${item.imageURL.substring(0, 100)}...`);
            }
          });
          
          // Check for duplicate images in response
          const imageUrls = items.map(i => i.imageURL).filter(Boolean);
          const uniqueImages = new Set(imageUrls);
          if (imageUrls.length > 0 && uniqueImages.size < imageUrls.length) {
            console.log(`[Job ${jobId}] WARNING: Firecrawl returned duplicate images!`);
            console.log(`  - Total items with images: ${imageUrls.length}`);
            console.log(`  - Unique image URLs: ${uniqueImages.size}`);
          }
        }
        
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
    console.log(`[Job ${jobId}] Aggregating results from ${categoryResults.length} categories`);
    console.log(`[Job ${jobId}] Category results structure:`, categoryResults.map(r => ({
      categoryName: r.categoryName,
      hasMenuItems: !!r.menuItems,
      itemCount: r.menuItems?.length || 0
    })));
    
    const menuItems = categoryResults.flatMap(result => {
      if (!result.menuItems || !Array.isArray(result.menuItems)) {
        console.error(`[Job ${jobId}] WARNING: Category "${result.categoryName}" has no menuItems array`);
        return [];
      }
      return result.menuItems.map(item => ({
        ...item,
        categoryName: result.categoryName
      }));
    });
    
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
    console.error(`[Job ${jobId}] Full error stack:`, error.stack);
    console.error(`[Job ${jobId}] Error details:`, error);
    
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

// Configure CORS for development and production
const corsOptions = {
  origin: isDevelopment
    ? true  // Allow all origins in development
    : [
        // Production domains - update these after Railway/Netlify deployment
        process.env.FRONTEND_URL,           // e.g., https://your-app.netlify.app
        'https://pumpd-menu-builder.netlify.app',
        /\.netlify\.app$/,                   // Any Netlify preview deploys
        /\.railway\.app$/,                   // Railway domains
      ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID', 'X-Organisation-ID'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

// Add organization middleware for all API routes
const organizationMiddleware = require('./middleware/organization-middleware');
app.use('/api/*', organizationMiddleware);

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
      waitFor: 3000, // Wait 3 seconds for page to load properly
      blockAds: true, // Block ads and cookie popups
      timeout: 135000, // Firecrawl timeout (increased by 50%)
      // maxAge removed to force fresh scraping
      skipTlsVerification: true,
      removeBase64Images: true
    };
    
    const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
    
    console.log('Category scan payload:', JSON.stringify(payload, null, 2));
    
    // Create axios instance
    const axiosInstance = axios.create({
      timeout: 180000, // Axios timeout (increased by 50%)
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
      timeout: 180000,  // Firecrawl timeout (increased by 50%)
      // maxAge removed to force fresh scraping
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
        timeout: 270000  // Axios timeout (increased by 50%)
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
 * Protected by standardExtraction feature flag
 */
app.post('/api/batch-extract-categories', authMiddleware, requireStandardExtraction, async (req, res) => {
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
        
        // Prepare v2 category-specific payload
        const categoryPayload = {
          url: url,
          formats: [{
            type: 'json',
            schema: categorySchema,
            prompt: categoryPrompt
          }],
          onlyMainContent: true,
          waitFor: 3000,  // Increased from 2000 to 3000ms
          blockAds: true,
          timeout: 270000, // Firecrawl timeout (increased by 50%)
          // maxAge removed to force fresh scraping
          skipTlsVerification: true,
          removeBase64Images: true
        };

        const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;

        console.log(`Category extraction payload for "${category.name}":`, JSON.stringify(categoryPayload, null, 2));

        // Create axios instance
        const axiosInstance = axios.create({
          timeout: 360000, // Axios timeout (increased by 50%)
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
          }
        });

        // Make request to Firecrawl API
        console.log(`[Job ${jobId}] Sending request to Firecrawl...`);

        // Wait for rate limiter approval
        await rateLimiter.acquireSlot(`batch-category-item-${category.name}`);

        const requestStartTime = Date.now();
        const categoryResponse = await axiosInstance.post(apiEndpoint, categoryPayload);
        const requestTime = Date.now() - requestStartTime;
        console.log(`[Job ${jobId}] Response received in ${requestTime}ms`);
        
        // Log response summary
        console.log(`Category "${category.name}" extraction response status:`, categoryResponse.status);
        
        // Parse v2 response
        const parsedCategoryResponse = categoryResponse.data;
        
        // LOG FULL RESPONSE
        console.log(`[Job ${jobId}] ========== FIRECRAWL RESPONSE FOR: ${category.name} ==========`);
        console.log(`[Job ${jobId}] Response success: ${parsedCategoryResponse.success}`);
        if (parsedCategoryResponse.data?.json) {
          const items = parsedCategoryResponse.data.json.menuItems || [];
          console.log(`[Job ${jobId}] Items returned: ${items.length}`);
          
          // Log first 3 items as sample
          items.slice(0, 3).forEach((item, idx) => {
            console.log(`[Job ${jobId}] Sample Item ${idx + 1}:`);
            console.log(`  - Name: ${item.dishName}`);
            console.log(`  - Price: ${item.dishPrice}`);
            console.log(`  - Has Image: ${!!item.imageURL}`);
            if (item.imageURL) {
              console.log(`  - Image URL: ${item.imageURL.substring(0, 100)}...`);
            }
          });
          
          // Check for duplicate images in response
          const imageUrls = items.map(i => i.imageURL).filter(Boolean);
          const uniqueImages = new Set(imageUrls);
          if (imageUrls.length > 0 && uniqueImages.size < imageUrls.length) {
            console.log(`[Job ${jobId}] WARNING: Firecrawl returned duplicate images!`);
            console.log(`  - Total items with images: ${imageUrls.length}`);
            console.log(`  - Unique image URLs: ${uniqueImages.size}`);
          }
        }
        
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
 * Premium Menu Extraction Endpoint
 * Enhanced extraction with option sets and validated images
 * Protected by premiumExtraction feature flag
 */
app.post('/api/extract-menu-premium', authMiddleware, requirePremiumExtraction, async (req, res) => {
  const {
    storeUrl,
    restaurantId,  // NEW: Accept restaurant ID from frontend
    restaurantName,
    extractOptionSets = true,
    validateImages = true,
    async = false
  } = req.body;
  
  // Get organization ID from middleware (header-based, consistent with standard extraction)
  const orgId = req.organizationId;
  
  // Validate inputs
  if (!storeUrl) {
    return res.status(400).json({
      success: false,
      error: 'Store URL is required'
    });
  }
  
  // Organization ID should already be set by middleware
  if (!orgId) {
    return res.status(400).json({
      success: false,
      error: 'Organization context not found. Please ensure you are authenticated.'
    });
  }
  
  // Check if URL is from UberEats
  if (!storeUrl.includes('ubereats.com')) {
    return res.status(400).json({
      success: false,
      error: 'Premium extraction currently only supports UberEats URLs'
    });
  }
  
  try {
    const premiumExtractionService = require('./src/services/premium-extraction-service');

    const result = await premiumExtractionService.extractPremiumMenu(storeUrl, orgId, {
      restaurantId,  // NEW: Pass restaurant ID to service
      restaurantName,
      extractOptionSets,
      validateImages,
      async,
      saveToDatabase: true
    });
    
    if (async) {
      // Return job info for async processing
      return res.json({
        success: true,
        jobId: result.jobId,
        estimatedTime: result.estimatedTime,
        statusUrl: `/api/premium-extract-status/${result.jobId}`,
        resultsUrl: `/api/premium-extract-results/${result.jobId}`,
        message: result.message
      });
    } else {
      // Return results directly for sync processing
      return res.json(result);
    }
    
  } catch (error) {
    console.error('Premium extraction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Premium extraction failed'
    });
  }
});

/**
 * Get premium extraction job status
 */
app.get('/api/premium-extract-status/:jobId', authMiddleware, async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const premiumExtractionService = require('./src/services/premium-extraction-service');
    const status = await premiumExtractionService.getJobStatus(jobId);
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get premium extraction job results
 */
app.get('/api/premium-extract-results/:jobId', authMiddleware, async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const premiumExtractionService = require('./src/services/premium-extraction-service');
    const results = await premiumExtractionService.getJobResults(jobId);
    
    res.json(results);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
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
 * Health check endpoint for Railway deployment
 * Returns a simple healthy status for container orchestration
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
 * POST /api/menus/:id/upload-images
 * Upload menu images to UploadCare CDN
 */
app.post('/api/menus/:id/upload-images', async (req, res) => {
  try {
    const { id } = req.params;
    const { options = {} } = req.body;
    
    // Check if UploadCare is configured
    if (!UPLOADCARE_PUBLIC_KEY) {
      return res.status(503).json({
        success: false,
        error: 'UploadCare service not configured. Please set UPLOADCARE_PUBLIC_KEY in environment variables.'
      });
    }
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    // Get the menu to verify it exists
    const menu = await db.getMenuWithItems(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found'
      });
    }
    
    // Get images that need to be uploaded
    const imagesToUpload = await db.getMenuImagesForUpload(id);

    if (imagesToUpload.length === 0) {
      // Get actual CDN stats to show how many are already uploaded
      const cdnStats = await db.getMenuCDNStats(id);
      return res.json({
        success: true,
        message: cdnStats?.totalImages > 0
          ? 'All images are already uploaded to CDN.'
          : 'No images exist for this menu.',
        stats: {
          totalImages: cdnStats?.totalImages || 0,
          alreadyUploaded: cdnStats?.uploadedImages || 0
        }
      });
    }
    
    // Create upload batch record
    const batch = await db.createUploadBatch(id, imagesToUpload.length);
    
    if (!batch) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create upload batch'
      });
    }
    
    const restaurantName = menu.restaurants?.name || 'Unknown Restaurant';
    console.log(`[API] Starting CDN upload for menu ${id} (${restaurantName}): ${imagesToUpload.length} images`);
    
    // Decide whether to process synchronously or asynchronously based on batch size
    const SYNC_UPLOAD_LIMIT = 10; // Process synchronously if 10 or fewer images
    
    if (imagesToUpload.length <= SYNC_UPLOAD_LIMIT) {
      // Small batch - process synchronously
      try {
        const uploadResults = await processSyncUpload(batch.id, id, imagesToUpload, restaurantName);

        // Track CDN upload
        const organisationId = req.organizationId || menu.restaurants?.organisation_id;
        if (organisationId && uploadResults.successful.length > 0) {
          UsageTrackingService.trackImageOperation(organisationId, 'upload', uploadResults.successful.length, {
            menu_id: id,
            batch_id: batch.id,
            total_images: imagesToUpload.length,
            successful: uploadResults.successful.length,
            failed: uploadResults.failed.length
          }).catch(err => console.error('[UsageTracking] Failed to track CDN upload:', err));
        }

        return res.json({
          success: true,
          mode: 'synchronous',
          batchId: batch.id,
          message: `Upload completed for ${uploadResults.successful.length} images`,
          stats: {
            totalImages: imagesToUpload.length,
            successful: uploadResults.successful.length,
            failed: uploadResults.failed.length
          },
          results: uploadResults
        });
      } catch (error) {
        console.error(`[API] Sync upload failed for batch ${batch.id}:`, error);
        await db.updateUploadBatch(batch.id, {
          status: 'failed',
          failed_count: imagesToUpload.length,
          metadata: { error: error.message }
        });
        
        return res.status(500).json({
          success: false,
          error: 'Upload failed',
          details: error.message
        });
      }
    } else {
      // Large batch - process asynchronously
      // Start background processing
      processAsyncUpload(batch.id, id, imagesToUpload, restaurantName);
      
      return res.json({
        success: true,
        mode: 'asynchronous',
        batchId: batch.id,
        message: `Upload started for ${imagesToUpload.length} images. Track progress using the batch ID.`,
        totalImages: imagesToUpload.length,
        progressUrl: `/api/upload-batches/${batch.id}`
      });
    }
    
  } catch (error) {
    console.error('[API] Error in upload-images endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start image upload'
    });
  }
});

/**
 * Helper function to process synchronous upload
 */
async function processSyncUpload(batchId, menuId, images, restaurantName) {
  const results = {
    successful: [],
    failed: []
  };
  
  try {
    // Update batch status to processing
    await db.updateUploadBatch(batchId, {
      status: 'processing'
    });
    
    // Process each image
    for (const image of images) {
      try {
        const filename = uploadcare.sanitizeFilename(
          image.url,
          image.itemName,
          image.categoryName
        );
        
        const metadata = {
          menuItemId: image.menu_item_id,
          menuId: menuId,
          itemName: image.itemName,
          categoryName: image.categoryName,
          restaurantName: restaurantName,
          batchId: batchId
        };
        
        const uploadResult = await uploadcare.uploadImageWithRetry(
          image.url,
          filename,
          metadata
        );
        
        if (uploadResult.success) {
          // Update database with CDN info
          await db.updateImageCDNInfo(image.id, {
            cdnId: uploadResult.cdnId,
            cdnUrl: uploadResult.cdnUrl,
            filename: uploadResult.filename || filename,
            metadata: uploadResult.metadata
          });
          
          results.successful.push({
            imageId: image.id,
            itemName: image.itemName,
            cdnUrl: uploadResult.cdnUrl
          });
        } else {
          // Mark as failed
          await db.markImageUploadFailed(image.id, uploadResult.error);
          results.failed.push({
            imageId: image.id,
            itemName: image.itemName,
            error: uploadResult.error
          });
        }
      } catch (error) {
        console.error(`[API] Failed to upload image ${image.id}:`, error);
        await db.markImageUploadFailed(image.id, error.message);
        results.failed.push({
          imageId: image.id,
          itemName: image.itemName,
          error: error.message
        });
      }
    }
    
    // Update batch record
    await db.updateUploadBatch(batchId, {
      uploaded_count: results.successful.length,
      failed_count: results.failed.length,
      status: results.successful.length === 0 ? 'failed' : 'completed',
      metadata: {
        completedAt: new Date().toISOString()
      }
    });
    
    return results;
  } catch (error) {
    console.error(`[API] Error in sync upload processing:`, error);
    throw error;
  }
}

/**
 * Helper function to process asynchronous upload (background)
 */
async function processAsyncUpload(batchId, menuId, images, restaurantName) {
  try {
    console.log(`[API] Starting async upload for batch ${batchId}: ${images.length} images`);
    
    // Update batch status
    await db.updateUploadBatch(batchId, {
      status: 'processing'
    });
    
    // Use the uploadBatch method with progress callback
    const progressCallback = async (progress) => {
      // Update batch progress in database
      await db.updateUploadBatch(batchId, {
        uploaded_count: progress.progress.successful,
        failed_count: progress.progress.failed
      });
    };
    
    // Transform images for batch upload
    const uploadImages = images.map(img => ({
      ...img,
      restaurantName: restaurantName
    }));
    
    const results = await uploadcare.uploadBatch(uploadImages, progressCallback, batchId);
    
    // Process successful uploads
    for (const result of results.successful) {
      await db.updateImageCDNInfo(result.originalImage.id, {
        cdnId: result.cdnId,
        cdnUrl: result.cdnUrl,
        filename: result.filename,
        metadata: result.metadata
      });
    }
    
    // Process failed uploads
    for (const result of results.failed) {
      await db.markImageUploadFailed(result.originalImage.id, result.error);
    }
    
    // Final batch update
    await db.updateUploadBatch(batchId, {
      uploaded_count: results.successful.length,
      failed_count: results.failed.length,
      status: results.successful.length === 0 ? 'failed' : 'completed',
      metadata: {
        completedAt: new Date().toISOString(),
        duration: results.completedAt - results.startedAt
      }
    });
    
    console.log(`[API] Async upload completed for batch ${batchId}: ${results.successful.length} successful, ${results.failed.length} failed`);
    
  } catch (error) {
    console.error(`[API] Async upload failed for batch ${batchId}:`, error);
    await db.updateUploadBatch(batchId, {
      status: 'failed',
      metadata: { 
        error: error.message,
        failedAt: new Date().toISOString()
      }
    });
  }
}

/**
 * GET /api/upload-batches/:batchId
 * Get upload batch status and progress
 */
app.get('/api/upload-batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const batch = await db.getUploadBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Upload batch not found'
      });
    }
    
    const response = {
      success: true,
      batch: {
        id: batch.id,
        menuId: batch.menu_id,
        status: batch.status,
        progress: {
          total: batch.total_images,
          uploaded: batch.uploaded_count || 0,
          failed: batch.failed_count || 0,
          percentage: batch.total_images > 0 
            ? Math.round(((batch.uploaded_count || 0) / batch.total_images) * 100)
            : 0
        },
        startedAt: batch.started_at,
        completedAt: batch.completed_at,
        metadata: batch.metadata
      }
    };
    
    // Add restaurant name if available
    if (batch.menus?.restaurants?.name) {
      response.batch.restaurantName = batch.menus.restaurants.name;
    }
    
    return res.json(response);
    
  } catch (error) {
    console.error('[API] Error getting upload batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get upload batch status'
    });
  }
});

/**
 * POST /api/upload-batches/:batchId/retry
 * Retry failed uploads in a batch
 */
app.post('/api/upload-batches/:batchId/retry', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const batch = await db.getUploadBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Upload batch not found'
      });
    }
    
    // Get pending/failed images for this batch
    const pendingImages = await db.getPendingImagesForBatch(batchId);
    
    if (pendingImages.length === 0) {
      return res.json({
        success: true,
        message: 'No images to retry. All images have been successfully uploaded.',
        stats: {
          totalImages: batch.total_images,
          uploaded: batch.uploaded_count,
          toRetry: 0
        }
      });
    }
    
    // Reset batch status for retry
    await db.updateUploadBatch(batchId, {
      status: 'processing',
      metadata: {
        ...batch.metadata,
        retryStarted: new Date().toISOString()
      }
    });
    
    // Get restaurant name
    const menu = await db.getMenuWithItems(batch.menu_id);
    const restaurantName = menu?.restaurants?.name || 'Unknown Restaurant';
    
    // Process retry (always async for retries)
    processAsyncUpload(batchId, batch.menu_id, pendingImages, restaurantName);
    
    return res.json({
      success: true,
      batchId: batchId,
      message: `Retry started for ${pendingImages.length} images`,
      progressUrl: `/api/upload-batches/${batchId}`
    });
    
  } catch (error) {
    console.error('[API] Error retrying upload batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry upload batch'
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

    // Track image ZIP download
    const organisationId = req.organizationId || menu.restaurants?.organisation_id;
    if (organisationId) {
      UsageTrackingService.trackImageOperation(organisationId, 'zip', downloadedCount, {
        menu_id: id,
        total_images: itemsWithImages.length,
        downloaded: downloadedCount,
        failed: failedCount
      }).catch(err => console.error('[UsageTracking] Failed to track image ZIP download:', err));
    }

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
app.get('/api/restaurants', authMiddleware, async (req, res) => {
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
 * GET /api/restaurants/list
 * Get lightweight list of restaurants for table display
 * Only returns essential fields needed for the restaurants table
 */
app.get('/api/restaurants/list', authMiddleware, async (req, res) => {
  try {
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }
    
    const restaurants = await db.getAllRestaurantsList();
    
    return res.json({
      success: true,
      count: restaurants.length,
      restaurants: restaurants
    });
  } catch (error) {
    console.error('[API] Error listing restaurants (lightweight):', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list restaurants'
    });
  }
});

/**
 * GET /api/restaurants/switcher
 * Get minimal restaurant list for switcher dropdown
 * Only returns: id, name, address, city, onboarding_status
 */
app.get('/api/restaurants/switcher', authMiddleware, async (req, res) => {
  try {
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    const restaurants = await db.getRestaurantSwitcherList();

    return res.json(restaurants);
  } catch (error) {
    console.error('[API] Error getting restaurant switcher list:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get restaurant switcher list'
    });
  }
});

/**
 * GET /api/restaurants/:id/menus
 * Get all menus for a specific restaurant
 */
app.get('/api/restaurants/:id/menus', authMiddleware, async (req, res) => {
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
 * GET /api/restaurants/logos
 * Get all restaurant logos for the authenticated user's organization
 * Used by ReferenceImageSelector component for social media image generation
 *
 * Returns restaurants that have logo URLs
 */
app.get('/api/restaurants/logos', authMiddleware, async (req, res) => {
  try {
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    const organisationId = req.user?.organisationId || req.user?.organisation?.id;

    if (!organisationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    // Fetch restaurants with logos
    const { data: restaurants, error } = await db.supabase
      .from('restaurants')
      .select('id, name, logo_url, brand_colors')
      .eq('organisation_id', organisationId)
      .not('logo_url', 'is', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('[API] Error fetching restaurant logos:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch restaurant logos'
      });
    }

    // Format the response
    const formattedLogos = restaurants.map(restaurant => ({
      id: restaurant.id,
      name: restaurant.name,
      logo_url: restaurant.logo_url,
      brand_colors: restaurant.brand_colors,
      type: 'logo' // Identify this as a logo image
    }));

    return res.json({
      success: true,
      count: formattedLogos.length,
      logos: formattedLogos
    });
  } catch (error) {
    console.error('[API] Error in /api/restaurants/logos:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/menus/images
 * Get all menu item images for the authenticated user's organization
 * Used by ImageSelector component for social media video generation
 * IMPORTANT: This route must come BEFORE /api/menus/:id to avoid route conflicts
 *
 * Query params:
 * - restaurantId (optional): Filter images by restaurant
 */
app.get('/api/menus/images', authMiddleware, async (req, res) => {
  try {
    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    const organisationId = req.user?.organisationId || req.user?.organisation?.id;
    const { restaurantId } = req.query;

    if (!organisationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization ID not found'
      });
    }

    // Build query with optional restaurant filter
    let query = db.supabase
      .from('item_images')
      .select(`
        id,
        url,
        cdn_url,
        menu_item_id,
        menu_items!inner (
          name,
          id,
          menu_id,
          menus!inner (
            id,
            restaurant_id
          )
        )
      `)
      .eq('organisation_id', organisationId);

    // Add restaurant filter if provided
    if (restaurantId) {
      query = query.eq('menu_items.menus.restaurant_id', restaurantId);
    }

    const { data: images, error } = await query
      .order('created_at', { ascending: false })
      .limit(500); // Limit to prevent excessive data transfer

    if (error) {
      console.error('[API] Error fetching menu images:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch menu images'
      });
    }

    // Transform the data to match ImageSelector expectations
    const formattedImages = images.map(img => ({
      id: img.id,
      url: img.url,
      cdn_url: img.cdn_url,
      item_name: img.menu_items?.name || 'Unknown Item',
      menu_item_id: img.menu_item_id,
      restaurant_id: img.menu_items?.menus?.restaurant_id
    }));

    return res.json({
      success: true,
      count: formattedImages.length,
      images: formattedImages,
      restaurantId: restaurantId || null
    });
  } catch (error) {
    console.error('[API] Error in /api/menus/images:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
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
 * Protected by csvDownload feature flag
 */
app.get('/api/menus/:id/csv', authMiddleware, requireCsvExport, async (req, res) => {
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

    // Track CSV download (no images in this endpoint)
    const organisationId = req.organizationId || menu.restaurants?.organisation_id;
    if (organisationId) {
      UsageTrackingService.trackCSVDownload(organisationId, false, {
        menu_id: id,
        format: format,
        item_count: menuItems.length
      }).catch(err => console.error('[UsageTracking] Failed to track CSV download:', err));
    }

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
 * GET /api/menus/:id/csv-with-cdn
 * Generate CSV with CDN information for Pumpd platform integration
 * Includes columns: isCDNImage, imageCDNID, imageCDNFilename, imageExternalURL
 * Protected by csvWithImagesDownload feature flag
 */
app.get('/api/menus/:id/csv-with-cdn', authMiddleware, requireCsvWithImagesExport, async (req, res) => {
  try {
    const { id } = req.params;
    const { download = 'false' } = req.query; // Option to download as file or return JSON
    
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
    
    // Phrases to remove from all fields (same as generate-clean-csv)
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
      
      // Replace newlines with spaces to prevent CSV format breaking
      cleaned = cleaned.replace(/\r?\n/g, ' ');
      
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
    
    // CSV Headers including new CDN columns
    const headers = [
      'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
      'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
      'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
      'displayName', 'printName', 'tags',
      'isCDNImage', 'imageCDNID', 'imageCDNFilename', 'imageExternalURL'
    ];
    
    // Process menu items
    const rows = [];
    let totalItems = 0;
    let itemsWithCDN = 0;
    let itemsWithoutImages = 0;
    
    if (menu.categories) {
      menu.categories.forEach(category => {
        if (category.menu_items) {
          category.menu_items.forEach(item => {
            totalItems++;
            
            // Clean field values
            const cleanedCategoryName = cleanField(category.name || 'Uncategorized');
            const cleanedDishName = cleanField(item.name || '');
            const cleanedDescription = cleanField(item.description || '');
            
            // Process tags
            let tagsString = '';
            if (item.tags) {
              if (Array.isArray(item.tags)) {
                tagsString = item.tags.join(', ');
              } else {
                tagsString = String(item.tags);
              }
              tagsString = cleanField(tagsString);
            }
            
            // Check for CDN uploaded image
            let isCDNImage = 'FALSE';
            let imageCDNID = '';
            let imageCDNFilename = '';
            let imageExternalURL = ''; // Always blank for now - reserved for future external image support
            
            // Look for CDN uploaded images
            if (item.item_images && item.item_images.length > 0) {
              // Find primary image or first available
              const primaryImage = item.item_images.find(img => img.type === 'primary') || item.item_images[0];
              
              if (primaryImage && primaryImage.cdn_uploaded === true && primaryImage.cdn_id) {
                isCDNImage = 'TRUE';
                imageCDNID = primaryImage.cdn_id;
                imageCDNFilename = primaryImage.cdn_filename || '';
                itemsWithCDN++;
              }
            } else {
              itemsWithoutImages++;
            }
            
            // Build the CSV row with all fields including CDN information
            const row = [
              '', // menuID - leave blank
              escapeCSVField('Menu'), // menuName - always 'Menu' for consistency
              '', // menuDisplayName - leave blank
              '', // menuDescription - leave blank
              '', // categoryID - leave blank
              escapeCSVField(cleanedCategoryName), // categoryName (cleaned)
              '', // categoryDisplayName - leave blank
              '', // categoryDescription - leave blank
              '', // dishID - leave blank
              escapeCSVField(cleanedDishName), // dishName (cleaned)
              formatPrice(item.price || 0), // dishPrice
              'standard', // dishType - default to standard (TODO: add combo detection)
              escapeCSVField(cleanedDescription), // dishDescription (cleaned)
              '', // displayName - leave blank
              '', // printName - leave blank
              escapeCSVField(tagsString), // tags (cleaned)
              isCDNImage, // isCDNImage - TRUE or FALSE
              escapeCSVField(imageCDNID), // imageCDNID - CDN UUID if uploaded
              escapeCSVField(imageCDNFilename), // imageCDNFilename - CDN filename if uploaded
              escapeCSVField(imageExternalURL) // imageExternalURL - blank for now, future: external URL support
            ];
            
            rows.push(row);
          });
        }
      });
    }
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    // Generate filename
    const restaurantName = menu.restaurants?.name || 'restaurant';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${formatFilename(restaurantName)}_menu_cdn_${date}.csv`;
    
    // Stats for response
    const stats = {
      totalItems: totalItems,
      itemsWithCDN: itemsWithCDN,
      itemsWithoutCDN: totalItems - itemsWithCDN,
      itemsWithoutImages: itemsWithoutImages,
      cdnPercentage: totalItems > 0 ? Math.round((itemsWithCDN / totalItems) * 100) : 0
    };
    
    // Track CSV with images download
    const organisationId = req.organizationId || menu.restaurants?.organisation_id;
    if (organisationId) {
      UsageTrackingService.trackCSVDownload(organisationId, true, {
        menu_id: id,
        item_count: totalItems,
        items_with_cdn: itemsWithCDN
      }).catch(err => console.error('[UsageTracking] Failed to track CSV with images download:', err));
    }

    // Return based on download parameter
    if (download === 'true') {
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Send CSV content
      return res.send(csvContent);
    } else {
      // Return JSON response with CSV data
      return res.json({
        success: true,
        csvData: csvContent,
        filename: filename,
        stats: stats,
        message: `CSV generated with ${itemsWithCDN} CDN-uploaded items out of ${totalItems} total items`
      });
    }
  } catch (error) {
    console.error('[API] Error generating CSV with CDN data:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate CSV with CDN data'
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
    
    // Create extraction job in database with options - pass organization ID from request
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
    }, req.organizationId);
    
    if (!dbJob) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create extraction job in database'
      });
    }
    
    // For FoodHub, ensure the URL includes /order-now/ for proper extraction
    let extractionUrl = url;
    if (platformName.toLowerCase() === 'foodhub' && !url.includes('/order-now')) {
      // Remove trailing slash if present, then add /order-now/
      extractionUrl = url.replace(/\/$/, '') + '/order-now/';
      console.log(`[Extraction] FoodHub URL corrected: ${extractionUrl}`);
    }

    // Start the extraction based on type
    if (extractionType === 'batch') {
      // First scan for categories
      try {
        // Use the platform passed from frontend (which may be manually selected)
        // Normalize platform name for comparison
        const normalizedPlatform = platformName.toLowerCase();
        let categoryPrompt;

        // Use platform-specific category detection prompts
        if (normalizedPlatform === 'ubereats') {
          console.log(`[Job ${jobId}] Using UberEats-specific category detection`);
          categoryPrompt = UBEREATS_CATEGORY_PROMPT;
        } else if (normalizedPlatform === 'doordash') {
          console.log(`[Job ${jobId}] Using DoorDash-specific category detection`);
          categoryPrompt = DOORDASH_CATEGORY_PROMPT;
        } else if (normalizedPlatform === 'ordermeal') {
          console.log(`[Job ${jobId}] Using OrderMeal-specific category detection`);
          categoryPrompt = ORDERMEAL_CATEGORY_PROMPT;
        } else if (normalizedPlatform === 'mobi2go') {
          console.log(`[Job ${jobId}] Using Mobi2Go-specific category detection`);
          categoryPrompt = MOBI2GO_CATEGORY_PROMPT;
        } else if (normalizedPlatform === 'nextorder') {
          console.log(`[Job ${jobId}] Using NextOrder-specific category detection`);
          categoryPrompt = NEXTORDER_CATEGORY_PROMPT;
        } else if (normalizedPlatform === 'delivereasy') {
          console.log(`[Job ${jobId}] Using DeliverEasy-specific category detection`);
          categoryPrompt = DELIVEREASY_CATEGORY_PROMPT;
        } else if (normalizedPlatform === 'foodhub') {
          console.log(`[Job ${jobId}] Using FoodHub-specific category detection`);
          categoryPrompt = FOODHUB_CATEGORY_PROMPT;
        } else {
          console.log(`[Job ${jobId}] Using generic category detection for platform: ${normalizedPlatform}`);
          // Use generic prompt for unknown platforms
          categoryPrompt = GENERIC_CATEGORY_PROMPT;
        }
        
        const scanPayload = {
          url: extractionUrl,
          formats: [{
            type: 'json',
            schema: CATEGORY_DETECTION_SCHEMA,
            prompt: categoryPrompt
          }],
          onlyMainContent: true,
          waitFor: 3000,  // Increased from 2000 to 3000ms
          timeout: 135000,  // Firecrawl timeout (increased by 50%)
          maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800')
        };

        console.log(`[Job ${jobId}] Scanning for categories...`);
        console.log(`[Job ${jobId}] DEBUG - Category Detection Prompt:`, categoryPrompt.substring(0, 200) + '...');
        console.log(`[Job ${jobId}] DEBUG - Category Detection Schema:`, JSON.stringify(CATEGORY_DETECTION_SCHEMA, null, 2));

        // Wait for rate limiter approval
        await rateLimiter.acquireSlot(`category-scan-${jobId}`);

        const scanResponse = await axios.post(`${FIRECRAWL_API_URL}/v2/scrape`, scanPayload, {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 202500  // Axios timeout (increased by 50%)
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
        startBackgroundExtraction(jobId, extractionUrl, categories, restaurantName, options, platformName);
      } catch (scanError) {
        console.error(`[Job ${jobId}] Category scan failed:`, scanError.message);
        // Fallback to empty categories if scan fails
        startBackgroundExtraction(jobId, extractionUrl, [], restaurantName, options, platformName);
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
    }, req.organizationId);
    
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
app.get('/api/menus', authMiddleware, async (req, res) => {
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
app.get('/api/extractions', authMiddleware, async (req, res) => {
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
app.get('/api/restaurants/:id', authMiddleware, async (req, res) => {
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
app.post('/api/restaurants', authMiddleware, async (req, res) => {
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

    // Track restaurant creation
    const organisationId = req.user?.organisationId || req.organizationId;
    if (organisationId) {
      UsageTrackingService.trackEvent(organisationId, UsageEventType.RESTAURANT_CREATED, 1, {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name
      }).catch(err => console.error('[UsageTracking] Failed to track restaurant creation:', err));
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
app.patch('/api/restaurants/:id', authMiddleware, async (req, res) => {
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
app.patch('/api/restaurants/:id/workflow', authMiddleware, async (req, res) => {
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
app.delete('/api/restaurants/:id', authMiddleware, async (req, res) => {
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
app.get('/api/restaurants/:id/details', authMiddleware, async (req, res) => {
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
app.patch('/api/restaurants/:id/workflow', authMiddleware, async (req, res) => {
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
 * Protected by googleSearchExtraction feature flag
 */
app.post('/api/google-business-search', authMiddleware, requireGoogleSearch, async (req, res) => {
  try {
    const {
      restaurantName,
      city,
      restaurantId,
      previewOnly = false,
      urlsOnly = false,  // Phase 1: Only search for URLs, skip content extraction
      confirmedUrls = null  // Phase 2: Use these confirmed URLs for extraction instead of searching
    } = req.body;
    const organisationId = req.user?.organisationId;

    // Helper function to identify source from URL
    const getSourceName = (url) => {
      if (!url) return 'unknown';
      const urlLower = url.toLowerCase();
      if (urlLower.includes('ubereats.com')) return 'ubereats';
      if (urlLower.includes('doordash.com')) return 'doordash';
      if (urlLower.includes('menulog.')) return 'menulog';
      if (urlLower.includes('delivereasy')) return 'delivereasy';
      return 'website';
    };

    if (!restaurantName || !city) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant name and city are required'
      });
    }

    // Get organization-specific search country
    const { OrganizationSettingsService } = require('./src/services/organization-settings-service');
    const searchCountry = await OrganizationSettingsService.getSearchCountry(organisationId);
    const countryCode = (await OrganizationSettingsService.getOrganizationCountry(organisationId)).toLowerCase();

    console.log(`[Google Business Search] Searching for: ${restaurantName} in ${city} (${searchCountry})`);

    // Get country-specific delivery platforms
    const { getCountryConfig } = require('../scripts/lib/country-config.cjs');
    const countryConfig = getCountryConfig(countryCode.toUpperCase());

    // Step 1: Search for all platform URLs (using dynamic country)
    const platformQueries = [
      `${restaurantName} ${city} ${searchCountry} ubereats`,
      `${restaurantName} ${city} ${searchCountry} doordash`,
      `${restaurantName} ${city} ${searchCountry} facebook`,
      `${restaurantName} ${city} ${searchCountry} instagram`,
      `${restaurantName} ${city} ${searchCountry} meandu`,
      `${restaurantName} ${city} ${searchCountry} mobi2go`,
      `${restaurantName} ${city} ${searchCountry} delivereasy`,
      `${restaurantName} ${city} ${searchCountry} nextorder`,
      `${restaurantName} ${city} ${searchCountry} foodhub`,
      `${restaurantName} ${city} ${searchCountry} ordermeal`,
      `${restaurantName} ${city} ${searchCountry} website contact hours` // General search for restaurant website
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
    const combinedQuery = `${restaurantName} ${city} ${searchCountry} (website OR ubereats OR doordash OR delivereasy OR facebook OR instagram OR menu OR order online)`;
    
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
          
          if (url.includes('ubereats') && !foundUrls.ubereatsUrl) {
            foundUrls.ubereatsUrl = result.url;
          } else if (url.includes('doordash') && !foundUrls.doordashUrl) {
            foundUrls.doordashUrl = result.url;
          } else if (url.includes('facebook.com') && !foundUrls.facebookUrl) {
            foundUrls.facebookUrl = result.url;
          } else if (url.includes('instagram.com') && !foundUrls.instagramUrl) {
            foundUrls.instagramUrl = result.url;
          } else if (url.includes('meandu') && !foundUrls.meandyouUrl) {
            foundUrls.meandyouUrl = result.url;
          } else if (url.includes('mobi2go') && !foundUrls.mobi2goUrl) {
            foundUrls.mobi2goUrl = result.url;
          } else if (url.includes('delivereasy') && !foundUrls.delivereasyUrl) {
            foundUrls.delivereasyUrl = result.url;
          } else if (url.includes('nextorder') && !foundUrls.nextorderUrl) {
            foundUrls.nextorderUrl = result.url;
          } else if (url.includes('foodhub') && !foundUrls.foodhubUrl) {
            foundUrls.foodhubUrl = result.url;
          } else if (url.includes('ordermeal') && !foundUrls.ordermealUrl) {
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
                    !url.includes('zomato') &&
                    !url.includes('grabone') &&
                    !url.includes('firsttable') &&
                    !url.includes('tiktok') &&
                    !url.includes('youtube') &&
                    !url.includes('myguide') &&
                    !url.includes('neatplaces') &&
                    !url.includes('wanderlog') &&
                    !url.includes('stuff.co.nz') &&
                    !url.includes('bookme') &&
                    !url.includes('reddit') &&
                    !url.includes('thespinoff')) {
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
              query: `${restaurantName} ${city} ${searchCountry}`,
              limit: 10,
              lang: 'en',
              country: countryCode,
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
              if (!foundUrls.websiteUrl && 
                  !url.includes('google') && 
                  !url.includes('yelp') &&
                  !url.includes('grabone') &&
                  !url.includes('firsttable') &&
                  !url.includes('tiktok') &&
                  !url.includes('youtube') &&
                  !url.includes('myguide') &&
                  !url.includes('neatplaces') &&
                  !url.includes('wanderlog') &&
                  !url.includes('stuff.co.nz') &&
                  !url.includes('bookme') &&
                  !url.includes('reddit') &&
                  !url.includes('thespinoff')) {
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
            query: `${restaurantName} ${city} site:doordash.com`,
            limit: 3,
            lang: 'en',
            country: countryCode,
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
    
    console.log('[Google Business Search] Found URLs (before validation):', foundUrls);

    // Step 3: Validate and clean URLs using lead-url-validation-service
    // This properly filters out invalid social media URLs (reels, posts, stories, etc.)
    // and validates website URLs (filters out delivery platforms)
    if (foundUrls.instagramUrl) {
      const cleanedInstagram = cleanInstagramUrl(foundUrls.instagramUrl);
      if (!cleanedInstagram) {
        console.log(`[Google Business Search] Rejected Instagram URL (invalid pattern): ${foundUrls.instagramUrl}`);
      }
      foundUrls.instagramUrl = cleanedInstagram;
    }
    if (foundUrls.facebookUrl) {
      const cleanedFacebook = cleanFacebookUrl(foundUrls.facebookUrl);
      if (!cleanedFacebook) {
        console.log(`[Google Business Search] Rejected Facebook URL (invalid pattern): ${foundUrls.facebookUrl}`);
      }
      foundUrls.facebookUrl = cleanedFacebook;
    }
    if (foundUrls.websiteUrl) {
      const cleanedWebsite = cleanWebsiteUrl(foundUrls.websiteUrl);
      if (!cleanedWebsite) {
        console.log(`[Google Business Search] Rejected website URL (delivery platform): ${foundUrls.websiteUrl}`);
      }
      foundUrls.websiteUrl = cleanedWebsite;
    }

    console.log('[Google Business Search] Found URLs (after validation):', foundUrls);

    // URLS ONLY MODE (Phase 1): Return URLs without content extraction
    // This allows users to confirm the website URL is correct before extraction
    if (urlsOnly) {
      console.log('[Google Business Search] URLs only mode - returning platform URLs without extraction');

      // Track usage even in URLs-only mode
      if (organisationId) {
        UsageTrackingService.trackEvent(organisationId, UsageEventType.GOOGLE_SEARCH, 1, {
          restaurant_name: restaurantName,
          city: city,
          restaurant_id: restaurantId,
          platforms_found: Object.entries(foundUrls).filter(([k, v]) => v).map(([k]) => k).length,
          urls_only_mode: true
        }).catch(err => console.error('[UsageTracking] Failed to track Google search:', err));
      }

      return res.json({
        success: true,
        urlsOnly: true,
        data: {
          platformUrls: {
            websiteUrl: foundUrls.websiteUrl,
            ubereatsUrl: foundUrls.ubereatsUrl ? foundUrls.ubereatsUrl.split('?')[0] : null,
            doordashUrl: foundUrls.doordashUrl ? foundUrls.doordashUrl.split('?')[0] : null,
            instagramUrl: foundUrls.instagramUrl,
            facebookUrl: foundUrls.facebookUrl,
            meandyouUrl: foundUrls.meandyouUrl,
            mobi2goUrl: foundUrls.mobi2goUrl,
            delivereasyUrl: foundUrls.delivereasyUrl,
            nextorderUrl: foundUrls.nextorderUrl,
            foodhubUrl: foundUrls.foodhubUrl,
            ordermealUrl: foundUrls.ordermealUrl
          }
        }
      });
    }

    // If confirmedUrls provided (Phase 2), use those instead of searched URLs
    if (confirmedUrls) {
      console.log('[Google Business Search] Using confirmed URLs for extraction:', confirmedUrls);
      // Override found URLs with confirmed ones (user may have corrected the website URL)
      if (confirmedUrls.websiteUrl !== undefined) foundUrls.websiteUrl = confirmedUrls.websiteUrl;
      if (confirmedUrls.ubereatsUrl !== undefined) foundUrls.ubereatsUrl = confirmedUrls.ubereatsUrl;
      if (confirmedUrls.doordashUrl !== undefined) foundUrls.doordashUrl = confirmedUrls.doordashUrl;
      if (confirmedUrls.instagramUrl !== undefined) foundUrls.instagramUrl = confirmedUrls.instagramUrl;
      if (confirmedUrls.facebookUrl !== undefined) foundUrls.facebookUrl = confirmedUrls.facebookUrl;
    }

    // Step 4: Use platform-specific extraction based on URL type
    let extractedData = {
      restaurantName: restaurantName,
      openingHours: [],
      address: null,
      phone: null,
      websiteUrl: foundUrls.websiteUrl,
      ubereatsUrl: foundUrls.ubereatsUrl,
      doordashUrl: foundUrls.doordashUrl,
      facebookUrl: foundUrls.facebookUrl,
      instagramUrl: foundUrls.instagramUrl,
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
            3. Opening hours for each day exactly as shown on the page
            Important: Extract hours exactly as displayed. Some restaurants have split hours (lunch and dinner). If the page shows continuous hours (e.g., "11am - 9pm"), return a single entry per day. Only create separate entries if there is an explicit gap/break shown on the page (e.g., "11am-2pm" then "5pm-9pm").`,
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
                    period: { type: 'string', description: 'Optional: Lunch or Dinner. Only use if there are multiple hours entires for this day' }
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

    // Create priority list of URLs to try
    // UberEats is FIRST priority for address and hours (most reliable)
    // Website is used for phone number and as fallback for all info if UberEats not available
    const urlsToTry = [];

    // First priority: UberEats for address and hours (most reliable for these)
    if (foundUrls.ubereatsUrl) {
      urlsToTry.push({ url: foundUrls.ubereatsUrl, extractPhone: false, extractAddress: true, extractHours: true });
    }

    // Second priority: website for phone (and fallback for address/hours if not from UberEats)
    if (foundUrls.websiteUrl) {
      urlsToTry.push({ url: foundUrls.websiteUrl, extractPhone: true, extractAddress: true, extractHours: true });
    }

    // DoorDash excluded from automatic extraction - only used when user specifically requests it

    // Define what we're looking for
    const extractionGoals = {
      address: !extractedData.address,
      phone: !extractedData.phone,
      openingHours: extractedData.openingHours.length === 0
    };

    // Multi-source data collection for preview mode
    // Stores extracted data from each source separately for user selection
    const extractedBySource = {};

    // Try each URL based on what data we still need
    for (const urlConfig of urlsToTry) {
      const urlToScrape = urlConfig.url;
      const sourceName = getSourceName(urlToScrape);

      // In preview mode, always try all sources to give user choice
      // In non-preview mode, use existing "first found wins" logic
      if (!previewOnly) {
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
      } else {
        console.log(`[Google Business Search] Preview mode - extracting from ${sourceName}`);
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
          console.log('[Google Business Search] JSON extraction result from', sourceName, ':', jsonData);

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

          // Initialize source data object for multi-source collection
          const sourceData = {
            address: null,
            phone: null,
            openingHours: []
          };

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

            // Store in source data for multi-source collection
            sourceData.openingHours = expandedHours;

            // Also update extractedData for non-preview mode (existing behavior)
            if (!previewOnly && expandedHours.length > 0) {
              extractedData.openingHours = expandedHours;
            }
          }

          // Phone number cleaning function
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

          // Process phone number with cleaning
          if (jsonData.phone && jsonData.phone !== 'N/A' && jsonData.phone !== 'null') {
            const cleanedPhone = cleanAndValidateNZPhone(jsonData.phone);
            if (cleanedPhone) {
              // Store in source data for multi-source collection
              sourceData.phone = cleanedPhone;

              // Also update extractedData for non-preview mode (existing behavior)
              if (!previewOnly && urlConfig.extractPhone) {
                extractedData.phone = cleanedPhone;
              }
            }
          }

          // Process address (check it's not 'null' string)
          if (jsonData.address && jsonData.address !== 'null' && jsonData.address !== '' && jsonData.address !== 'N/A') {
            // Don't accept numbers-only addresses (like "35341547" from DoorDash)
            if (!/^\d+$/.test(jsonData.address)) {
              // Store in source data for multi-source collection
              sourceData.address = jsonData.address;

              // Also update extractedData for non-preview mode (existing behavior)
              if (!previewOnly && urlConfig.extractAddress && extractionGoals.address) {
                extractedData.address = jsonData.address;
                extractionGoals.address = false;
              }
            }
          }

          // Store this source's data in the multi-source collection
          if (sourceData.address || sourceData.phone || sourceData.openingHours.length > 0) {
            extractedBySource[sourceName] = sourceData;
            console.log(`[Google Business Search] Stored data from ${sourceName}:`, {
              hasAddress: !!sourceData.address,
              hasPhone: !!sourceData.phone,
              hoursCount: sourceData.openingHours.length
            });
          }

          // Update extraction goals (for non-preview mode)
          if (!previewOnly) {
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

    // PREVIEW MODE: Return multi-source data without saving to database
    // This allows the frontend to show a confirmation dialog with source selection
    if (previewOnly) {
      console.log('[Google Business Search] Preview mode - returning multi-source data');
      console.log('[Google Business Search] Sources scraped:', Object.keys(extractedBySource));

      // Track Google search usage even in preview mode
      if (organisationId) {
        UsageTrackingService.trackEvent(organisationId, UsageEventType.GOOGLE_SEARCH, 1, {
          restaurant_name: restaurantName,
          city: city,
          restaurant_id: restaurantId,
          platforms_found: Object.entries(foundUrls).filter(([k, v]) => v).map(([k]) => k).length,
          preview_mode: true
        }).catch(err => console.error('[UsageTracking] Failed to track Google search:', err));
      }

      return res.json({
        success: true,
        previewMode: true,
        data: {
          // Platform URLs (single source each - from search results)
          platformUrls: {
            websiteUrl: foundUrls.websiteUrl,
            ubereatsUrl: cleanPlatformUrl(foundUrls.ubereatsUrl, 'ubereats'),
            doordashUrl: cleanPlatformUrl(foundUrls.doordashUrl, 'doordash'),
            instagramUrl: foundUrls.instagramUrl,
            facebookUrl: foundUrls.facebookUrl,
            meandyouUrl: foundUrls.meandyouUrl,
            mobi2goUrl: foundUrls.mobi2goUrl,
            delivereasyUrl: foundUrls.delivereasyUrl,
            nextorderUrl: foundUrls.nextorderUrl,
            foodhubUrl: foundUrls.foodhubUrl,
            ordermealUrl: foundUrls.ordermealUrl
          },
          // Multi-source extracted data (address, phone, hours from each source)
          extractedBySource,
          // Metadata
          sourcesScraped: Object.keys(extractedBySource),
          extractionNotes: extractedData.extractionNotes
        }
      });
    }

    // Update restaurant if ID provided (non-preview mode)
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

    // Track Google search usage
    if (organisationId) {
      UsageTrackingService.trackEvent(organisationId, UsageEventType.GOOGLE_SEARCH, 1, {
        restaurant_name: restaurantName,
        city: city,
        restaurant_id: restaurantId,
        platforms_found: Object.entries(foundUrls).filter(([k, v]) => v).map(([k]) => k).length
      }).catch(err => console.error('[UsageTracking] Failed to track Google search:', err));
    }

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

/**
 * POST /api/google-business-search/save
 * Save Google search data with per-field source selection
 * Used after preview mode to apply user-selected fields
 *
 * Request body:
 * {
 *   restaurantId: "uuid",
 *   selections: {
 *     address: { save: true, source: "ubereats" },
 *     phone: { save: true, source: "website" },
 *     opening_hours: { save: true, source: "ubereats" },
 *     website_url: { save: true },
 *     instagram_url: { save: false },
 *     facebook_url: { save: true },
 *     // ... other platform URLs
 *   },
 *   extractedBySource: { ... },  // Multi-source data from preview
 *   platformUrls: { ... }        // Platform URLs from preview
 * }
 */
app.post('/api/google-business-search/save', authMiddleware, async (req, res) => {
  try {
    const {
      restaurantId,
      selections,
      extractedBySource,
      platformUrls
    } = req.body;

    if (!restaurantId || !selections) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID and selections are required'
      });
    }

    console.log('[API] Saving Google search data for restaurant:', restaurantId);
    console.log('[API] Selections:', JSON.stringify(selections, null, 2));

    if (!db.isDatabaseAvailable()) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const updateData = {};

    // Process multi-source fields (address, phone, opening_hours)
    // These require looking up the value from the selected source
    if (selections.address?.save && selections.address?.source && extractedBySource) {
      const sourceData = extractedBySource[selections.address.source];
      if (sourceData?.address) {
        updateData.address = sourceData.address;
        console.log(`[API] Using address from ${selections.address.source}: ${sourceData.address}`);
      }
    }

    if (selections.phone?.save && selections.phone?.source && extractedBySource) {
      const sourceData = extractedBySource[selections.phone.source];
      if (sourceData?.phone) {
        updateData.phone = sourceData.phone;
        console.log(`[API] Using phone from ${selections.phone.source}: ${sourceData.phone}`);
      }
    }

    if (selections.opening_hours?.save && selections.opening_hours?.source && extractedBySource) {
      const sourceData = extractedBySource[selections.opening_hours.source];
      if (sourceData?.openingHours?.length > 0) {
        // Process opening hours with 24-hour format and midnight crossing handling
        const formattedHours = [];
        const hoursByDay = {};

        sourceData.openingHours.forEach(hours => {
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

        // Process each day's hours with midnight crossing handling
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

        if (formattedHours.length > 0) {
          updateData.opening_hours = formattedHours;
          console.log(`[API] Using opening_hours from ${selections.opening_hours.source}: ${formattedHours.length} entries`);
        }
      }
    }

    // Process single-source fields (platform URLs)
    // These come directly from platformUrls
    const urlFields = [
      { key: 'website_url', dataKey: 'websiteUrl' },
      { key: 'ubereats_url', dataKey: 'ubereatsUrl' },
      { key: 'doordash_url', dataKey: 'doordashUrl' },
      { key: 'instagram_url', dataKey: 'instagramUrl' },
      { key: 'facebook_url', dataKey: 'facebookUrl' },
      { key: 'meandyou_url', dataKey: 'meandyouUrl' },
      { key: 'mobi2go_url', dataKey: 'mobi2goUrl' },
      { key: 'delivereasy_url', dataKey: 'delivereasyUrl' },
      { key: 'nextorder_url', dataKey: 'nextorderUrl' },
      { key: 'foodhub_url', dataKey: 'foodhubUrl' },
      { key: 'ordermeal_url', dataKey: 'ordermealUrl' }
    ];

    for (const { key, dataKey } of urlFields) {
      if (selections[key]?.save && platformUrls?.[dataKey]) {
        updateData[key] = platformUrls[dataKey];
        console.log(`[API] Saving ${key}: ${platformUrls[dataKey]}`);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log('[API] Saved Google search data:', Object.keys(updateData));

      return res.json({
        success: true,
        fieldsUpdated: Object.keys(updateData)
      });
    } else {
      console.log('[API] No fields selected for update');
      return res.json({
        success: true,
        fieldsUpdated: []
      });
    }

  } catch (error) {
    console.error('[API] Google search save error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save search data'
    });
  }
});

/**
 * POST /api/platform-url-search
 * Search for a specific platform URL for a restaurant
 */
app.post('/api/platform-url-search', authMiddleware, async (req, res) => {
  try {
    const { restaurantName, city, platform, restaurantId } = req.body;
    const organisationId = req.user?.organisationId;

    if (!restaurantName || !city || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant name, city, and platform are required'
      });
    }

    // Get organization-specific search country
    const { OrganizationSettingsService } = require('./src/services/organization-settings-service');
    const searchCountry = await OrganizationSettingsService.getSearchCountry(organisationId);
    const countryCode = (await OrganizationSettingsService.getOrganizationCountry(organisationId)).toLowerCase();

    console.log(`[Platform URL Search] Searching for ${platform} URL: ${restaurantName} in ${city} (${searchCountry})`);

    // Build platform-specific search query
    let searchQuery = '';
    switch(platform) {
      case 'ubereats':
        searchQuery = `${restaurantName} ${city} ${searchCountry} ubereats`;
        break;
      case 'doordash':
        searchQuery = `${restaurantName} ${city} ${searchCountry} doordash`;
        break;
      case 'facebook':
        searchQuery = `${restaurantName} ${city} ${searchCountry} facebook`;
        break;
      case 'instagram':
        searchQuery = `${restaurantName} ${city} ${searchCountry} instagram`;
        break;
      case 'website':
        searchQuery = `${restaurantName} ${city} ${searchCountry} website contact hours`;
        break;
      case 'meandyou':
        searchQuery = `${restaurantName} ${city} ${searchCountry} meandu.pp`;
        break;
      case 'mobi2go':
        searchQuery = `${restaurantName} ${city} ${searchCountry} mobi2go`;
        break;
      case 'delivereasy':
        searchQuery = `${restaurantName} ${city} ${searchCountry} delivereasy.co.nz`;
        break;
      case 'nextorder':
        searchQuery = `${restaurantName} ${city} ${searchCountry} nextorder`;
        break;
      case 'foodhub':
        searchQuery = `${restaurantName} ${city} ${searchCountry} foodhub`;
        break;
      case 'ordermeal':
        searchQuery = `${restaurantName} ${city} ${searchCountry} ordermeal`;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported platform: ${platform}`
        });
    }

    try {
      const searchResponse = await axios.post(
        `${FIRECRAWL_API_URL}/v2/search`,
        {
          query: searchQuery,
          limit: 5,
          lang: 'en',
          country: countryCode,
          sources: [{ type: 'web' }]
        },
        {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const results = searchResponse.data?.data?.web || searchResponse.data?.data || [];
      let foundUrl = null;
      
      if (results && Array.isArray(results)) {
        for (const result of results) {
          const url = result.url.toLowerCase();
          
          // Check if URL matches the platform
          if (platform === 'website') {
            // For website, exclude all known platforms and deal sites
            if (!url.includes('ubereats') && 
                !url.includes('doordash') && 
                !url.includes('facebook') && 
                !url.includes('instagram') &&
                !url.includes('google') &&
                !url.includes('yelp') &&
                !url.includes('tripadvisor') &&
                !url.includes('menulog') &&
                !url.includes('zomato') &&
                !url.includes('grabone') &&
                !url.includes('firsttable') &&
                !url.includes('tiktok') &&
                !url.includes('youtube') &&
                !url.includes('myguide') &&
                !url.includes('neatplaces') &&
                !url.includes('wanderlog') &&
                !url.includes('stuff.co.nz') &&
                !url.includes('bookme') &&
                !url.includes('reddit') &&
                !url.includes('thespinoff')) {
              foundUrl = result.url;
              break;
            }
          } else if (url.includes(platform === 'ubereats' ? 'ubereats.com' : 
                                platform === 'doordash' ? 'doordash.com' :
                                platform === 'facebook' ? 'facebook.com' :
                                platform === 'instagram' ? 'instagram.com' :
                                platform === 'meandyou' ? 'meandu.app' :
                                platform === 'mobi2go' ? 'mobi2go.com' :
                                platform === 'delivereasy' ? 'delivereasy.co.nz' :
                                platform === 'nextorder' ? 'nextorder.co.nz' :
                                platform === 'foodhub' ? 'foodhub.co.nz' :
                                platform === 'ordermeal' ? 'ordermeal.co.nz' : '')) {
            foundUrl = result.url;
            break;
          }
        }
      }
      
      // Update restaurant if ID provided and URL found
      if (restaurantId && foundUrl && db.isDatabaseAvailable()) {
        const updateData = {};
        const fieldMap = {
          'website': 'website_url',
          'ubereats': 'ubereats_url',
          'doordash': 'doordash_url',
          'instagram': 'instagram_url',
          'facebook': 'facebook_url',
          'meandyou': 'meandyou_url',
          'mobi2go': 'mobi2go_url',
          'delivereasy': 'delivereasy_url',
          'nextorder': 'nextorder_url',
          'foodhub': 'foodhub_url',
          'ordermeal': 'ordermeal_url'
        };
        
        if (fieldMap[platform]) {
          updateData[fieldMap[platform]] = foundUrl;
          await db.updateRestaurantWorkflow(restaurantId, updateData);
          console.log(`[Platform URL Search] Updated restaurant ${restaurantId} with ${platform} URL`);
        }
      }
      
      return res.json({
        success: true,
        platform: platform,
        url: foundUrl,
        message: foundUrl ? 'URL found successfully' : 'No URL found for this platform'
      });
      
    } catch (err) {
      console.error('[Platform URL Search] Search error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to search for platform URL'
      });
    }
  } catch (error) {
    console.error('[Platform URL Search] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to search for platform URL'
    });
  }
});

/**
 * POST /api/platform-details-extraction
 * Extract specific business details from a platform URL
 * Protected by platformDetailsExtraction feature flag
 */
app.post('/api/platform-details-extraction', authMiddleware, requirePlatformDetails, async (req, res) => {
  try {
    const { url, platform, extractFields, restaurantId, restaurantName } = req.body;
    
    if (!url || !platform || !extractFields || extractFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URL, platform, and extraction fields are required'
      });
    }
    
    // Validate platform capabilities
    const platformCapabilities = {
      'ubereats': ['address', 'hours'],
      'doordash': ['hours'], // DoorDash can only reliably extract hours
      'website': ['address', 'hours', 'phone'],
      'facebook': [],
      'instagram': [],
      'meandyou': ['address', 'hours', 'phone'],
      'mobi2go': ['address', 'hours', 'phone'],
      'delivereasy': ['address', 'hours', 'phone'],
      'nextorder': ['address', 'hours', 'phone'],
      'foodhub': ['address', 'hours', 'phone'],
      'ordermeal': ['address', 'hours', 'phone']
    };
    
    const allowedFields = platformCapabilities[platform] || [];
    const invalidFields = extractFields.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Platform ${platform} does not support extracting: ${invalidFields.join(', ')}`
      });
    }
    
    console.log(`[Platform Details Extraction] Extracting ${extractFields.join(', ')} from ${platform}: ${url}`);
    
    // Build extraction schema based on requested fields
    const schemaProperties = {};
    if (extractFields.includes('address')) {
      schemaProperties.address = { type: 'string' };
    }
    if (extractFields.includes('phone')) {
      schemaProperties.phone = { type: 'string' };
    }
    if (extractFields.includes('hours')) {
      schemaProperties.openingHours = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'string', description: 'Day of the week (Monday, Tuesday, etc.)' },
            open: { type: 'string', description: 'Opening time' },
            close: { type: 'string', description: 'Closing time' },
            period: { type: 'string', description: 'Optional: Lunch or Dinner. Only use if there are multiple hours entires for this day' }
          }
        }
      };
    }
    
    // Build extraction prompt with platform-specific instructions
    let prompt = `Extract the following information for ${restaurantName || 'this restaurant'}: `;
    const requestedInfo = [];
    
    if (extractFields.includes('address')) {
      requestedInfo.push('physical address (street address, not just area)');
    }
    if (extractFields.includes('phone')) {
      requestedInfo.push('phone number if available');
    }
    if (extractFields.includes('hours')) {
      requestedInfo.push('opening hours for each day - check if lunch and dinner times exist separately');
    }
    
    prompt += requestedInfo.join(', ') + '.';
    
    // Add platform-specific instructions
    if (extractFields.includes('hours')) {
      prompt += ' Important: Extract hours exactly as displayed. Some restaurants have split hours (lunch and dinner). Only extract multiple time periods for each day if there is a break between the times. For day ranges like "Monday-Saturday", list each day separately.';
    }
    
    // Configure platform-specific wait times
    // Removing click actions for now as they're causing Firecrawl errors
    let waitTime = 3000; // Default wait time
    
    if (platform === 'ubereats') {
      // UberEats: Allow time for dynamic content to load
      waitTime = 3000;
    } else if (platform === 'doordash') {
      // DoorDash: Extra time for dynamic content
      waitTime = 3500;
    } else if (platform === 'website') {
      // For restaurant websites, standard load time
      waitTime = 2000;
    } else {
      // For other platforms, standard wait time
      waitTime = 2500;
    }
    
    try {
      const scrapeResponse = await axios.post(
        `${FIRECRAWL_API_URL}/v2/scrape`,
        {
          url: url,
          formats: [{
            type: 'json',
            prompt: prompt,
            schema: {
              type: 'object',
              properties: schemaProperties
            }
          }],
          onlyMainContent: true,
          waitFor: waitTime
        },
        {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const extractedData = scrapeResponse.data?.data?.formats?.json || scrapeResponse.data?.data?.json || {};
      
      console.log('[Platform Details Extraction] Raw extracted data:', extractedData);
      
      // Check if we got valid data (not 'null' strings or empty data)
      const hasValidData = (
        (extractedData.address && extractedData.address !== 'null' && extractedData.address !== '') ||
        (extractedData.phone && extractedData.phone !== 'null' && extractedData.phone !== '') ||
        (extractedData.openingHours && extractedData.openingHours.length > 0)
      );
      
      if (!hasValidData) {
        console.log('[Platform Details Extraction] No valid data extracted from:', url);
        return res.json({
          success: false,
          error: 'No valid data could be extracted from this URL'
        });
      }
      
      // Format the response
      const result = {
        success: true,
        platform: platform,
        url: url,
        extracted: {}
      };
      
      // Process address (check it's not 'null' string or numbers-only)
      if (extractFields.includes('address') && extractedData.address && 
          extractedData.address !== 'null' && extractedData.address !== '' && 
          extractedData.address !== 'N/A' && !/^\d+$/.test(extractedData.address)) {
        result.extracted.address = extractedData.address;
      }
      
      // Process phone number with cleaning for NZ numbers
      if (extractFields.includes('phone') && extractedData.phone && 
          extractedData.phone !== 'N/A' && extractedData.phone !== 'null') {
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
        
        const cleanedPhone = cleanAndValidateNZPhone(extractedData.phone);
        if (cleanedPhone) {
          result.extracted.phone = cleanedPhone;
        }
      }
      
      // Process opening hours with expansion and split hours handling
      if (extractFields.includes('hours') && extractedData.openingHours && Array.isArray(extractedData.openingHours)) {
        const formattedHours = [];
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        // Group hours by day to handle multiple slots (lunch/dinner)
        const hoursByDay = {};
        
        for (const hours of extractedData.openingHours) {
          // Skip invalid entries
          if (!hours.day || hours.day.toLowerCase().includes('menu') || 
              hours.day.toLowerCase().includes('dinner menu') || !hours.open || !hours.close) {
            continue;
          }
          
          const dayStr = hours.day.toLowerCase();
          
          // Handle "Every day" or "Daily"
          if (dayStr.includes('every day') || dayStr === 'daily' || dayStr === 'everyday') {
            console.log('[Platform Details Extraction] Expanding "Every day" hours:', hours);
            // Expand to all days
            for (const day of allDays) {
              if (!hoursByDay[day]) {
                hoursByDay[day] = [];
              }
              hoursByDay[day].push({
                open: hours.open,
                close: hours.close,
                period: hours.period || ''
              });
            }
          } else if (hours.day && hours.day.includes('-')) {
            // Handle day ranges like "Monday-Saturday"
            const [startDay, endDay] = hours.day.split('-').map(d => d.trim());
            const startIdx = allDays.findIndex(d => d.toLowerCase().startsWith(startDay.toLowerCase().substring(0, 3)));
            const endIdx = allDays.findIndex(d => d.toLowerCase().startsWith(endDay.toLowerCase().substring(0, 3)));
            
            if (startIdx !== -1 && endIdx !== -1) {
              for (let i = startIdx; i <= endIdx; i++) {
                if (!hoursByDay[allDays[i]]) {
                  hoursByDay[allDays[i]] = [];
                }
                hoursByDay[allDays[i]].push({
                  open: hours.open,
                  close: hours.close,
                  period: hours.period || ''
                });
              }
            }
          } else if (allDays.some(d => d.toLowerCase() === hours.day.toLowerCase())) {
            // Single day - normalize to proper case
            const properDay = allDays.find(d => d.toLowerCase() === hours.day.toLowerCase());
            if (!hoursByDay[properDay]) {
              hoursByDay[properDay] = [];
            }
            hoursByDay[properDay].push({
              open: hours.open,
              close: hours.close,
              period: hours.period || ''
            });
          }
        }
        
        // Process each day's hours and handle midnight crossing
        Object.entries(hoursByDay).forEach(([day, slots]) => {
          slots.forEach(slot => {
            const open24 = convertTo24Hour(slot.open);
            const close24 = convertTo24Hour(slot.close);
            
            if (!open24 || !close24) return;
            
            const openTime = parseTime(open24);
            const closeTime = parseTime(close24);
            
            // Check for midnight crossing
            if (closeTime < openTime && closeTime !== 0) {
              // Split into two entries for midnight crossing
              formattedHours.push({
                day: day,
                hours: { 
                  open: open24, 
                  close: "23:59",
                  ...(slot.period && { period: slot.period })
                }
              });
              
              const nextDay = getNextDay(day);
              formattedHours.push({
                day: nextDay,
                hours: { 
                  open: "00:00", 
                  close: close24,
                  ...(slot.period && { period: slot.period })
                }
              });
            } else {
              // Normal hours (no midnight crossing)
              formattedHours.push({
                day: day,
                hours: { 
                  open: open24, 
                  close: close24,
                  ...(slot.period && { period: slot.period })
                }
              });
            }
          });
        });
        
        result.extracted.hours = formattedHours;
      }
      
      // Update restaurant if ID provided
      if (restaurantId && db.isDatabaseAvailable()) {
        const updateData = {};

        if (result.extracted.address) updateData.address = result.extracted.address;
        if (result.extracted.phone) updateData.phone = result.extracted.phone;
        if (result.extracted.hours && result.extracted.hours.length > 0) {
          updateData.opening_hours = result.extracted.hours;
        }

        if (Object.keys(updateData).length > 0) {
          await db.updateRestaurantWorkflow(restaurantId, updateData);
          console.log(`[Platform Details Extraction] Updated restaurant ${restaurantId} with extracted data`);
        }
      }

      // Track platform details extraction
      const organisationId = req.organizationId;
      if (organisationId) {
        UsageTrackingService.trackEvent(organisationId, UsageEventType.PLATFORM_DETAILS, 1, {
          platform: platform,
          url: url,
          restaurant_id: restaurantId,
          fields_extracted: Object.keys(result.extracted).length
        }).catch(err => console.error('[UsageTracking] Failed to track platform details extraction:', err));
      }

      return res.json(result);

    } catch (err) {
      console.error('[Platform Details Extraction] Extraction error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to extract details from platform URL'
      });
    }
  } catch (error) {
    console.error('[Platform Details Extraction] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract platform details'
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
 * Protected by logoExtraction feature flag
 */
app.post('/api/website-extraction/logo', authMiddleware, requireLogoExtraction, async (req, res) => {
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

    // Track logo extraction (with processing since this endpoint does both)
    const organisationId = req.organizationId;
    if (organisationId) {
      UsageTrackingService.trackLogoExtraction(organisationId, true, {
        restaurant_id: restaurantId,
        url: websiteUrl,
        has_logo: !!result.logoVersions?.original,
        additional_images: savedImages.length
      }).catch(err => console.error('[UsageTracking] Failed to track logo extraction:', err));
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
 * Protected by logoProcessing feature flag
 */
app.post('/api/website-extraction/process-selected-logo', authMiddleware, requireLogoProcessing, async (req, res) => {
  try {
    const { logoUrl, websiteUrl, restaurantId, additionalImages = [], versionsToUpdate = [], colorsToUpdate = [] } = req.body;

    if (!logoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Logo URL is required'
      });
    }

    console.log('[API] Processing selected logo:', logoUrl);
    console.log('[API] Versions to update:', versionsToUpdate);
    console.log('[API] Colors to update:', colorsToUpdate);
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
      // Map database column names to logoVersions keys
      const logoVersionMapping = {
        'logo_url': 'original',
        'logo_nobg_url': 'nobg',
        'logo_standard_url': 'standard',
        'logo_thermal_url': 'thermal',
        'logo_thermal_alt_url': 'thermal_alt',
        'logo_thermal_contrast_url': 'thermal_contrast',
        'logo_thermal_adaptive_url': 'thermal_adaptive',
        'logo_favicon_url': 'favicon'
      };

      // Build updateData - only include selected logo versions
      const updateData = {};

      // Add only selected logo versions
      if (versionsToUpdate.length > 0) {
        // Only update specific versions selected by user
        versionsToUpdate.forEach(versionKey => {
          if (logoVersionMapping[versionKey] && logoVersions?.[logoVersionMapping[versionKey]]) {
            updateData[versionKey] = logoVersions[logoVersionMapping[versionKey]];
          }
        });
      } else {
        // If no specific versions selected, update all (backward compatibility)
        updateData.logo_url = logoVersions?.original;
        updateData.logo_nobg_url = logoVersions?.nobg;
        updateData.logo_standard_url = logoVersions?.standard;
        updateData.logo_thermal_url = logoVersions?.thermal;
        updateData.logo_thermal_alt_url = logoVersions?.thermal_alt;
        updateData.logo_thermal_contrast_url = logoVersions?.thermal_contrast;
        updateData.logo_thermal_adaptive_url = logoVersions?.thermal_adaptive;
        updateData.logo_favicon_url = logoVersions?.favicon;
      }

      // Update colors based on selection - only update if explicitly selected
      const shouldUpdateColor = (colorKey) => colorsToUpdate.includes(colorKey);

      if (shouldUpdateColor('primary_color') && colors?.primaryColor) {
        updateData.primary_color = colors.primaryColor;
      }
      if (shouldUpdateColor('secondary_color') && colors?.secondaryColor) {
        updateData.secondary_color = colors.secondaryColor;
      }
      if (shouldUpdateColor('tertiary_color') && colors?.tertiaryColor) {
        updateData.tertiary_color = colors.tertiaryColor;
      }
      if (shouldUpdateColor('accent_color') && colors?.accentColor) {
        updateData.accent_color = colors.accentColor;
      }
      if (shouldUpdateColor('background_color') && colors?.backgroundColor) {
        updateData.background_color = colors.backgroundColor;
      }
      if (shouldUpdateColor('theme') && colors?.theme) {
        updateData.theme = colors.theme;
      }
      // Only include brand_colors array if user selected at least one color to update
      if (colorsToUpdate.length > 0 && colors?.brandColors) {
        updateData.brand_colors = colors.brandColors;
      }
      
      // Add saved images if any
      if (savedImages.length > 0) {
        updateData.saved_images = savedImages;
      }
      
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      const updatedVersionsCount = Object.keys(updateData).filter(key => key.startsWith('logo_')).length;
      console.log('[API] Updated restaurant:', updatedVersionsCount, 'logo versions, colors, and', savedImages.length, 'additional images');
    }

    // Track logo processing
    const organisationId = req.organizationId;
    if (organisationId) {
      UsageTrackingService.trackEvent(organisationId, UsageEventType.LOGO_PROCESSING, 1, {
        restaurant_id: restaurantId,
        logo_url: logoUrl,
        versions_updated: versionsToUpdate.length || 8,
        colors_updated: colorsToUpdate.length || 6
      }).catch(err => console.error('[UsageTracking] Failed to track logo processing:', err));
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
 * POST /api/website-extraction/branding
 * Extract full branding using Firecrawl's branding format
 * Feature-flagged via requireFirecrawlBranding middleware
 */
app.post('/api/website-extraction/branding', authMiddleware, requireFirecrawlBranding, async (req, res) => {
  try {
    const {
      restaurantId,
      sourceUrl,
      previewOnly = false,
      versionsToUpdate = [],
      colorsToUpdate = [],
      headerFieldsToUpdate = []
    } = req.body;

    if (!restaurantId || !sourceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID and source URL are required'
      });
    }

    console.log('[API] Starting branding extraction for:', sourceUrl);
    console.log('[API] Preview only:', previewOnly);

    const logoService = require('./src/services/logo-extraction-service');

    // Step 1: Extract branding from Firecrawl using new branding format
    const brandingResult = await logoService.extractBrandingWithFirecrawl(sourceUrl);

    if (!brandingResult?.success) {
      return res.status(400).json({
        success: false,
        error: brandingResult?.error || 'Failed to extract branding'
      });
    }

    // Step 2: Download and process logo if found
    let logoVersions = {};
    if (brandingResult.images?.logoUrl) {
      try {
        const logoBuffer = await logoService.downloadImageToBuffer(
          brandingResult.images.logoUrl,
          sourceUrl
        );

        // Always generate favicon from logo (don't skip)
        logoVersions = await logoService.processLogoVersions(logoBuffer, { skipFavicon: false });

        console.log('[API] Logo processed into', Object.keys(logoVersions).length, 'versions');
      } catch (logoError) {
        console.error('[API] Failed to process logo:', logoError.message);
        // Continue without logo - colors and metadata still valuable
      }
    }

    // Step 2b: If Firecrawl provided a separate favicon URL, download and convert to base64
    // This overrides the logo-generated favicon with the actual favicon
    if (brandingResult.images?.faviconUrl) {
      try {
        console.log('[API] Downloading favicon from Firecrawl URL:', brandingResult.images.faviconUrl);
        const faviconBuffer = await logoService.downloadImageToBuffer(
          brandingResult.images.faviconUrl,
          sourceUrl
        );

        // Convert favicon to base64 PNG (resize to 32x32 for consistency)
        const sharp = require('sharp');
        const resizedFavicon = await sharp(faviconBuffer)
          .resize(32, 32, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toBuffer();

        logoVersions.favicon = `data:image/png;base64,${resizedFavicon.toString('base64')}`;
        console.log('[API] Favicon converted to base64 from Firecrawl URL');
      } catch (faviconError) {
        console.error('[API] Failed to process Firecrawl favicon, using logo-generated one:', faviconError.message);
        // Keep the logo-generated favicon if Firecrawl favicon fails
      }
    }

    // If preview only, return extracted data without saving to database
    if (previewOnly) {
      console.log('[API] Preview mode - returning extracted data without saving');
      return res.json({
        success: true,
        previewMode: true,
        data: {
          logoVersions,
          colors: brandingResult.colors,
          metadata: brandingResult.metadata,
          images: {
            logo: brandingResult.images?.logoUrl,
            faviconUrl: brandingResult.images?.faviconUrl, // Original URL from Firecrawl
            faviconBase64: logoVersions?.favicon, // Converted base64 version
            ogImage: brandingResult.images?.ogImageUrl
          },
          confidence: brandingResult.confidence,
          logoReasoning: brandingResult.logoReasoning,
          extractedAt: brandingResult.extractedAt
        }
      });
    }

    // Step 3: Prepare database update with selection filtering
    if (db.isDatabaseAvailable()) {
      console.log('[API] Versions to update:', versionsToUpdate);
      console.log('[API] Colors to update:', colorsToUpdate);
      console.log('[API] Header fields to update:', headerFieldsToUpdate);

      // Helper functions to check if field should be updated
      const shouldUpdateVersion = (key) => versionsToUpdate.includes(key);
      const shouldUpdateColor = (key) => colorsToUpdate.includes(key);
      const shouldUpdateHeader = (key) => headerFieldsToUpdate.includes(key);

      const updateData = {};

      // Colors - only update if selected
      if (shouldUpdateColor('primary_color') && brandingResult.colors?.primaryColor) {
        updateData.primary_color = brandingResult.colors.primaryColor;
      }
      if (shouldUpdateColor('secondary_color') && brandingResult.colors?.secondaryColor) {
        updateData.secondary_color = brandingResult.colors.secondaryColor;
      }
      if (shouldUpdateColor('tertiary_color') && brandingResult.colors?.tertiaryColor) {
        updateData.tertiary_color = brandingResult.colors.tertiaryColor;
      }
      if (shouldUpdateColor('accent_color') && brandingResult.colors?.accentColor) {
        updateData.accent_color = brandingResult.colors.accentColor;
      }
      if (shouldUpdateColor('background_color') && brandingResult.colors?.backgroundColor) {
        updateData.background_color = brandingResult.colors.backgroundColor;
      }
      if (shouldUpdateColor('theme') && brandingResult.colors?.theme) {
        updateData.theme = brandingResult.colors.theme;
      }

      // Logo versions - only update if selected
      if (shouldUpdateVersion('logo_url') && logoVersions?.original) {
        updateData.logo_url = logoVersions.original;
      }
      if (shouldUpdateVersion('logo_nobg_url') && logoVersions?.nobg) {
        updateData.logo_nobg_url = logoVersions.nobg;
      }
      if (shouldUpdateVersion('logo_standard_url') && logoVersions?.standard) {
        updateData.logo_standard_url = logoVersions.standard;
      }
      if (shouldUpdateVersion('logo_thermal_url') && logoVersions?.thermal) {
        updateData.logo_thermal_url = logoVersions.thermal;
      }
      if (shouldUpdateVersion('logo_thermal_alt_url') && logoVersions?.thermal_alt) {
        updateData.logo_thermal_alt_url = logoVersions.thermal_alt;
      }
      if (shouldUpdateVersion('logo_thermal_contrast_url') && logoVersions?.thermal_contrast) {
        updateData.logo_thermal_contrast_url = logoVersions.thermal_contrast;
      }
      if (shouldUpdateVersion('logo_thermal_adaptive_url') && logoVersions?.thermal_adaptive) {
        updateData.logo_thermal_adaptive_url = logoVersions.thermal_adaptive;
      }
      if (shouldUpdateVersion('logo_favicon_url')) {
        // Prefer base64 favicon (from logoVersions) over raw URL
        // logoVersions.favicon is always base64 - either from logo processing or converted from Firecrawl URL
        const faviconValue = logoVersions?.favicon;
        if (faviconValue) {
          updateData.logo_favicon_url = faviconValue;
        }
      }

      // Header fields (OG data) - only update if selected
      if (shouldUpdateHeader('website_og_image') && brandingResult.images?.ogImageUrl) {
        updateData.website_og_image = brandingResult.images.ogImageUrl;
      }
      if (shouldUpdateHeader('website_og_title') && brandingResult.metadata?.ogTitle) {
        updateData.website_og_title = brandingResult.metadata.ogTitle;
      }
      if (shouldUpdateHeader('website_og_description') && brandingResult.metadata?.ogDescription) {
        updateData.website_og_description = brandingResult.metadata.ogDescription;
      }

      // Only update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        await db.updateRestaurantWorkflow(restaurantId, updateData);
        console.log('[API] Updated restaurant with branding data:', Object.keys(updateData).length, 'fields');

        // Track branding extraction usage
        try {
          const { data: restaurant } = await db.supabase
            .from('restaurants')
            .select('organisation_id')
            .eq('id', restaurantId)
            .single();

          if (restaurant?.organisation_id) {
            UsageTrackingService.trackBrandingExtraction(restaurant.organisation_id, {
              restaurant_id: restaurantId,
              url: sourceUrl,
              has_logo: !!brandingResult.images?.logoUrl,
              confidence: brandingResult.confidence,
              fields_updated: Object.keys(updateData).length
            }).catch(err => console.error('[UsageTracking] Failed to track branding extraction:', err));
          }
        } catch (trackingError) {
          console.error('[UsageTracking] Error getting organisation for tracking:', trackingError);
        }
      } else {
        console.log('[API] No fields selected for update');
      }
    }

    return res.json({
      success: true,
      data: {
        logoVersions,
        colors: brandingResult.colors,
        metadata: brandingResult.metadata,
        images: {
          logo: brandingResult.images?.logoUrl,
          faviconUrl: brandingResult.images?.faviconUrl, // Original URL from Firecrawl
          faviconBase64: logoVersions?.favicon, // Converted base64 version
          ogImage: brandingResult.images?.ogImageUrl
        },
        confidence: brandingResult.confidence,
        logoReasoning: brandingResult.logoReasoning,
        extractedAt: brandingResult.extractedAt
      }
    });

  } catch (error) {
    console.error('[API] Branding extraction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract branding'
    });
  }
});

/**
 * POST /api/website-extraction/branding/save
 * Save already-extracted branding data with selection filtering
 * This avoids re-extracting when user confirms selections
 */
app.post('/api/website-extraction/branding/save', authMiddleware, async (req, res) => {
  try {
    const {
      restaurantId,
      brandingData,
      versionsToUpdate = [],
      colorsToUpdate = [],
      headerFieldsToUpdate = []
    } = req.body;

    if (!restaurantId || !brandingData) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID and branding data are required'
      });
    }

    console.log('[API] Saving branding data for restaurant:', restaurantId);
    console.log('[API] Versions to update:', versionsToUpdate);
    console.log('[API] Colors to update:', colorsToUpdate);
    console.log('[API] Header fields to update:', headerFieldsToUpdate);

    if (!db.isDatabaseAvailable()) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Helper functions to check if field should be updated
    const shouldUpdateVersion = (key) => versionsToUpdate.includes(key);
    const shouldUpdateColor = (key) => colorsToUpdate.includes(key);
    const shouldUpdateHeader = (key) => headerFieldsToUpdate.includes(key);

    const updateData = {};

    // Colors - only update if selected
    if (shouldUpdateColor('primary_color') && brandingData.colors?.primaryColor) {
      updateData.primary_color = brandingData.colors.primaryColor;
    }
    if (shouldUpdateColor('secondary_color') && brandingData.colors?.secondaryColor) {
      updateData.secondary_color = brandingData.colors.secondaryColor;
    }
    if (shouldUpdateColor('tertiary_color') && brandingData.colors?.tertiaryColor) {
      updateData.tertiary_color = brandingData.colors.tertiaryColor;
    }
    if (shouldUpdateColor('accent_color') && brandingData.colors?.accentColor) {
      updateData.accent_color = brandingData.colors.accentColor;
    }
    if (shouldUpdateColor('background_color') && brandingData.colors?.backgroundColor) {
      updateData.background_color = brandingData.colors.backgroundColor;
    }
    if (shouldUpdateColor('theme') && brandingData.colors?.theme) {
      updateData.theme = brandingData.colors.theme;
    }

    // Logo versions - only update if selected
    if (shouldUpdateVersion('logo_url') && brandingData.logoVersions?.original) {
      updateData.logo_url = brandingData.logoVersions.original;
    }
    if (shouldUpdateVersion('logo_nobg_url') && brandingData.logoVersions?.nobg) {
      updateData.logo_nobg_url = brandingData.logoVersions.nobg;
    }
    if (shouldUpdateVersion('logo_standard_url') && brandingData.logoVersions?.standard) {
      updateData.logo_standard_url = brandingData.logoVersions.standard;
    }
    if (shouldUpdateVersion('logo_thermal_url') && brandingData.logoVersions?.thermal) {
      updateData.logo_thermal_url = brandingData.logoVersions.thermal;
    }
    if (shouldUpdateVersion('logo_thermal_alt_url') && brandingData.logoVersions?.thermal_alt) {
      updateData.logo_thermal_alt_url = brandingData.logoVersions.thermal_alt;
    }
    if (shouldUpdateVersion('logo_thermal_contrast_url') && brandingData.logoVersions?.thermal_contrast) {
      updateData.logo_thermal_contrast_url = brandingData.logoVersions.thermal_contrast;
    }
    if (shouldUpdateVersion('logo_thermal_adaptive_url') && brandingData.logoVersions?.thermal_adaptive) {
      updateData.logo_thermal_adaptive_url = brandingData.logoVersions.thermal_adaptive;
    }
    if (shouldUpdateVersion('logo_favicon_url')) {
      const faviconValue = brandingData.images?.favicon || brandingData.logoVersions?.favicon;
      if (faviconValue) {
        updateData.logo_favicon_url = faviconValue;
      }
    }

    // Header fields (OG data) - only update if selected
    if (shouldUpdateHeader('website_og_image') && brandingData.images?.ogImage) {
      updateData.website_og_image = brandingData.images.ogImage;
    }
    if (shouldUpdateHeader('website_og_title') && brandingData.metadata?.ogTitle) {
      updateData.website_og_title = brandingData.metadata.ogTitle;
    }
    if (shouldUpdateHeader('website_og_description') && brandingData.metadata?.ogDescription) {
      updateData.website_og_description = brandingData.metadata.ogDescription;
    }

    // Only update if there are fields to update
    if (Object.keys(updateData).length > 0) {
      await db.updateRestaurantWorkflow(restaurantId, updateData);
      console.log('[API] Saved branding data:', Object.keys(updateData).length, 'fields');

      // Track branding save usage
      try {
        const { data: restaurant } = await db.supabase
          .from('restaurants')
          .select('organisation_id')
          .eq('id', restaurantId)
          .single();

        if (restaurant?.organisation_id) {
          UsageTrackingService.trackBrandingExtraction(restaurant.organisation_id, {
            restaurant_id: restaurantId,
            fields_updated: Object.keys(updateData).length,
            save_only: true
          }).catch(err => console.error('[UsageTracking] Failed to track branding save:', err));
        }
      } catch (trackingError) {
        console.error('[UsageTracking] Error getting organisation for tracking:', trackingError);
      }

      return res.json({
        success: true,
        fieldsUpdated: Object.keys(updateData)
      });
    } else {
      console.log('[API] No fields selected for update');
      return res.json({
        success: true,
        fieldsUpdated: []
      });
    }

  } catch (error) {
    console.error('[API] Branding save error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save branding'
    });
  }
});

/**
 * GET /api/config/features
 * Returns feature flags for frontend
 */
app.get('/api/config/features', (req, res) => {
  res.json({
    useFirecrawlBrandingFormat: process.env.USE_FIRECRAWL_BRANDING_FORMAT?.toLowerCase() === 'true'
  });
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
app.patch('/api/menu-items/:id', authMiddleware, async (req, res) => {
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
app.post('/api/menu-items/bulk-update', authMiddleware, async (req, res) => {
  try {
    const { updates } = req.body;
    
    // Log the raw request to see what's being received
    console.log('[Server] Bulk update request received with', updates?.length, 'items');
    if (updates && updates.length > 0) {
      console.log('[Server] First update item:', JSON.stringify(updates[0], null, 2));
    }
    
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
app.get('/api/restaurants/:id/price-history', authMiddleware, async (req, res) => {
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
app.get('/api/analytics/extraction-stats', authMiddleware, async (req, res) => {
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
 * === FEATURE FLAGS API ===
 */
// Endpoint to get feature flags for the current user's organization
app.get('/api/feature-flags', authMiddleware, getFeatureFlags);

/**
 * === PUMPD REGISTRATION ROUTES ===
 */
// Import and use registration routes (with auth + feature flag middleware)
const registrationRoutes = require('./src/routes/registration-routes');
app.use('/api/registration', authMiddleware, requireRegistration, registrationRoutes);

/**
 * === SOCIAL MEDIA VIDEO GENERATION ROUTES ===
 */
// Import and use social media routes (with auth + feature flag middleware)
const socialMediaRoutes = require('./src/routes/social-media-routes');
app.use('/api/social-media', authMiddleware, requireSocialMedia, socialMediaRoutes);

/**
 * === SALES TASK MANAGEMENT ROUTES ===
 */
// Import and use task management routes (with auth + feature flag middleware)
const tasksRoutes = require('./src/routes/tasks-routes');
app.use('/api/tasks', authMiddleware, requireTasksAndSequences, tasksRoutes);

const taskTemplatesRoutes = require('./src/routes/task-templates-routes');
app.use('/api/task-templates', authMiddleware, requireTasksAndSequences, taskTemplatesRoutes);

const messageTemplatesRoutes = require('./src/routes/message-templates-routes');
app.use('/api/message-templates', authMiddleware, requireTasksAndSequences, messageTemplatesRoutes);

const sequenceTemplatesRoutes = require('./src/routes/sequence-templates-routes');
app.use('/api/sequence-templates', authMiddleware, requireTasksAndSequences, sequenceTemplatesRoutes);

const sequenceInstancesRoutes = require('./src/routes/sequence-instances-routes');
app.use('/api/sequence-instances', authMiddleware, requireTasksAndSequences, sequenceInstancesRoutes);

/**
 * === LEAD SCRAPING ROUTES ===
 */
// Import and use lead scraping routes (with auth + feature flag middleware)
const leadScrapeRoutes = require('./src/routes/lead-scrape-routes');
app.use('/api/lead-scrape-jobs', authMiddleware, requireLeadScraping, leadScrapeRoutes);

const leadsRoutes = require('./src/routes/leads-routes');
app.use('/api/leads', authMiddleware, requireLeadScraping, leadsRoutes);

const cityCodesRoutes = require('./src/routes/city-codes-routes');
app.use('/api/city-codes', authMiddleware, requireLeadScraping, cityCodesRoutes);

/**
 * === ORGANIZATION SETTINGS ROUTES ===
 */
// Import and use organization settings routes (admin only, no feature flag required)
const organizationSettingsRoutes = require('./src/routes/organization-settings-routes');
app.use('/api/organization/settings', authMiddleware, organizationSettingsRoutes);

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
 * ========================================
 * SUPER ADMIN API ROUTES
 * ========================================
 */

// Get all organizations with statistics
app.get('/api/super-admin/organizations', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    
    // Get organizations with member counts
    const { data: organizations, error } = await supabase
      .from('organisations')
      .select(`
        *,
        profiles!profiles_organisation_id_fkey(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format the response
    const formattedOrgs = organizations?.map(org => ({
      id: org.id,
      name: org.name,
      status: org.status || 'active',
      feature_flags: org.feature_flags || {},
      billing_rates: org.billing_rates || {},
      created_at: org.created_at,
      updated_at: org.updated_at,
      archived_at: org.archived_at,
      member_count: org.profiles?.[0]?.count || 0
    })) || [];

    res.json({
      success: true,
      organizations: formattedOrgs,
      total: formattedOrgs.length
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch organizations',
      details: error.message 
    });
  }
});

// Get system-wide statistics
app.get('/api/super-admin/stats', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    
    // Get various counts
    const [
      { count: totalOrgs },
      { count: activeOrgs },
      { count: archivedOrgs },
      { count: totalUsers },
      { count: totalAdmins },
      { count: totalSuperAdmins },
      { count: totalExtractions },
      { count: totalMenus },
      { count: totalRestaurants }
    ] = await Promise.all([
      supabase.from('organisations').select('*', { count: 'exact', head: true }),
      supabase.from('organisations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organisations').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'super_admin'),
      supabase.from('extraction_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('menus').select('*', { count: 'exact', head: true }),
      supabase.from('restaurants').select('*', { count: 'exact', head: true })
    ]);

    res.json({
      success: true,
      stats: {
        organizations: {
          total: totalOrgs || 0,
          active: activeOrgs || 0,
          archived: archivedOrgs || 0
        },
        users: {
          total: totalUsers || 0,
          admins: totalAdmins || 0,
          superAdmins: totalSuperAdmins || 0,
          regular: (totalUsers || 0) - (totalAdmins || 0) - (totalSuperAdmins || 0)
        },
        data: {
          extractions: totalExtractions || 0,
          menus: totalMenus || 0,
          restaurants: totalRestaurants || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  }
});

// Get all users across all organizations
app.get('/api/super-admin/users', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    
    // Get all users with their organization info
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organisation:organisations(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      users: users || [],
      total: users?.length || 0
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// Update user role
app.put('/api/super-admin/users/:userId/role', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    // Update user role
    const { data, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update user role',
      details: error.message 
    });
  }
});

// Create new organization
app.post('/api/super-admin/organizations', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { name, feature_flags, billing_rates, admin_email } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Organization name is required'
      });
    }

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name,
        status: 'active',
        feature_flags: feature_flags || {},
        billing_rates: billing_rates || {}
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // If admin email provided, update that user's organization
    if (admin_email) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          organisation_id: org.id,
          role: 'admin',
          updated_at: new Date().toISOString()
        })
        .eq('email', admin_email);

      if (updateError) {
        console.error('Failed to assign admin to organization:', updateError);
      }
    }

    res.json({
      success: true,
      organization: org
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create organization',
      details: error.message 
    });
  }
});

// Archive organization
app.post('/api/super-admin/organizations/:orgId/archive', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase, user } = req;
    const { orgId } = req.params;

    // Archive the organization
    const { data, error } = await supabase
      .from('organisations')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: user.id
      })
      .eq('id', orgId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      organization: data
    });
  } catch (error) {
    console.error('Error archiving organization:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to archive organization',
      details: error.message 
    });
  }
});

// Get single organization details
app.get('/api/super-admin/organizations/:orgId', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { orgId } = req.params;
    
    const { data, error } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', orgId)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      organization: data
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch organization',
      details: error.message 
    });
  }
});

// Update organization (edit features, rates, name)
app.put('/api/super-admin/organizations/:orgId', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { orgId } = req.params;
    const { name, feature_flags, billing_rates } = req.body;
    
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (feature_flags !== undefined) updateData.feature_flags = feature_flags;
    if (billing_rates !== undefined) updateData.billing_rates = billing_rates;
    
    const { data, error } = await supabase
      .from('organisations')
      .update(updateData)
      .eq('id', orgId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      organization: data
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update organization',
      details: error.message 
    });
  }
});

// Restore archived organization
app.post('/api/super-admin/organizations/:orgId/restore', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { orgId } = req.params;
    
    const { data, error } = await supabase
      .from('organisations')
      .update({
        status: 'active',
        archived_at: null,
        archived_by: null
      })
      .eq('id', orgId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      organization: data
    });
  } catch (error) {
    console.error('Error restoring organization:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to restore organization',
      details: error.message 
    });
  }
});

// Permanently delete organization (only if archived)
app.delete('/api/super-admin/organizations/:orgId', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { orgId } = req.params;
    
    // First check if organization is archived
    const { data: org, error: checkError } = await supabase
      .from('organisations')
      .select('status')
      .eq('id', orgId)
      .single();
    
    if (checkError) throw checkError;
    
    if (org.status !== 'archived') {
      return res.status(400).json({
        success: false,
        error: 'Organization must be archived before deletion'
      });
    }
    
    // Delete the organization (CASCADE will handle related data)
    const { error } = await supabase
      .from('organisations')
      .delete()
      .eq('id', orgId);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Organization permanently deleted'
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete organization',
      details: error.message 
    });
  }
});

// Reassign restaurant data to another organization
app.post('/api/super-admin/organizations/reassign-data', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { restaurantIds, targetOrgId } = req.body;
    
    if (!restaurantIds || !targetOrgId) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant IDs and target organization ID are required'
      });
    }
    
    const results = [];
    
    for (const restaurantId of restaurantIds) {
      const { error } = await supabase.rpc('reassign_restaurant_to_org', {
        p_restaurant_id: restaurantId,
        p_target_org_id: targetOrgId
      });
      
      if (error) {
        results.push({ restaurantId, success: false, error: error.message });
      } else {
        results.push({ restaurantId, success: true });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error reassigning data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reassign data',
      details: error.message 
    });
  }
});

// Duplicate restaurant data to another organization
app.post('/api/super-admin/organizations/duplicate-data', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { restaurantIds, targetOrgId } = req.body;
    
    if (!restaurantIds || !targetOrgId) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant IDs and target organization ID are required'
      });
    }
    
    const results = [];
    
    for (const restaurantId of restaurantIds) {
      const { data, error } = await supabase.rpc('duplicate_restaurant_to_org', {
        p_restaurant_id: restaurantId,
        p_target_org_id: targetOrgId
      });
      
      if (error) {
        results.push({ restaurantId, success: false, error: error.message });
      } else {
        results.push({ restaurantId, success: true, newRestaurantId: data });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error duplicating data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to duplicate data',
      details: error.message 
    });
  }
});

// ============================================
// USER MANAGEMENT API ENDPOINTS (Super Admin)
// ============================================

// Create new user (invitation-only flow)
app.post('/api/super-admin/users', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { email, role, organisation_id, sendInvite } = req.body;

    console.log('Creating user invitation:', { email, role, organisation_id });

    // First check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingProfile) {
      console.log('User already exists in profiles:', existingProfile);
      return res.status(400).json({
        success: false,
        error: 'User already exists',
        message: `A user with email ${email} already exists in the system`
      });
    }

    // Check if there's already a pending invitation for this email to this org
    const { data: existingInvite } = await supabase
      .from('organisation_invites')
      .select('id, email, expires_at')
      .eq('email', email)
      .eq('organisation_id', organisation_id)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      console.log('Active invitation already exists:', existingInvite);
      return res.status(400).json({
        success: false,
        error: 'Invitation already exists',
        message: `An active invitation for ${email} already exists for this organization`
      });
    }

    // Generate invitation token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create invitation record (matching the regular invitation flow)
    const { data: invitation, error: inviteError } = await supabase
      .from('organisation_invites')
      .insert({
        organisation_id,
        email,
        role,
        invited_by: req.user.id,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        // Note: Name will be set when user accepts the invitation and creates their profile
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      throw inviteError;
    }

    console.log('Created invitation:', { id: invitation.id, email: invitation.email });

    // Generate invitation URL
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5007'}/invite/${token}`;
    
    // Send invitation email if requested
    if (sendInvite !== false) { // Default to sending invite
      try {
        // Get organization name for the email
        const { data: org } = await supabase
          .from('organisations')
          .select('name')
          .eq('id', organisation_id)
          .single();

        // Send email via Edge Function
        const { error: emailError } = await supabase.functions.invoke('send-invitation', {
          body: {
            email,
            inviterName: 'Super Admin',
            organizationName: org?.name || 'Organization',
            role: role.charAt(0).toUpperCase() + role.slice(1),
            inviteUrl
          }
        });

        if (emailError) {
          console.error('Error sending invitation email:', emailError);
          // Don't fail the whole operation if email fails
        } else {
          console.log('Invitation email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    res.json({ 
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organisation_id: invitation.organisation_id,
        expires_at: invitation.expires_at
      },
      inviteUrl,
      message: `Invitation sent to ${email}. They will need to accept the invitation to create their account.`
    });
  } catch (error) {
    console.error('Error creating user invitation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create user invitation',
      message: error.message 
    });
  }
});

// Update user
app.put('/api/super-admin/users/:userId', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase, user } = req;
    const { userId } = req.params;
    const updates = req.body;

    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        action: 'updated',
        details: updates,
        performed_by: user.id
      });

    res.json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update user',
      message: error.message 
    });
  }
});

// Delete user
app.delete('/api/super-admin/users/:userId', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase, user } = req;
    const { userId } = req.params;

    // Check if user is last admin of organization
    const { data: userToDelete } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('id', userId)
      .single();

    if (userToDelete?.role === 'admin' || userToDelete?.role === 'super_admin') {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', userToDelete.organisation_id)
        .in('role', ['admin', 'super_admin'])
        .neq('id', userId);

      if (count === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Cannot delete the last admin of an organization' 
        });
      }
    }

    // Use the delete_user_safely function
    const { error } = await supabase.rpc('delete_user_safely', {
      p_user_id: userId,
      p_deleted_by: user.id
    });

    if (error) {
      // If function fails, try direct deletion
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
    }

    res.json({ 
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete user',
      message: error.message 
    });
  }
});

// Resend invitation to user
app.post('/api/super-admin/users/:userId/resend-invite', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { userId } = req.params;

    // Get user details
    const { data: user } = await supabase
      .from('profiles')
      .select('email, name, organisation_id, role')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Get organization name
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', user.organisation_id)
      .single();

    // Generate password reset link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email
    });

    if (error) throw error;

    // Send email via Edge Function (optional - can also return link)
    if (data?.properties?.action_link) {
      await supabase.functions.invoke('send-invitation', {
        body: {
          email: user.email,
          inviterName: 'Super Admin',
          organizationName: org?.name || 'Organization',
          role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
          inviteUrl: data.properties.action_link
        }
      });
    }

    res.json({ 
      success: true,
      message: 'Invitation sent successfully',
      link: data?.properties?.action_link 
    });
  } catch (error) {
    console.error('Error resending invite:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to resend invitation',
      message: error.message 
    });
  }
});

// Get single user details
app.get('/api/super-admin/users/:userId', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organisation:organisations(id, name)
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error.message
    });
  }
});

// ============================================
// SUPER ADMIN - USAGE STATISTICS ENDPOINTS
// ============================================

/**
 * Get usage statistics
 * Supports filtering by organization and date range
 */
app.get('/api/super-admin/usage/statistics', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { org_id, start_date, end_date } = req.query;

    // Default to last 30 days if no dates provided
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    // Call the database function
    const { data, error } = await supabase.rpc('get_usage_statistics', {
      p_org_id: org_id || null,
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) throw error;

    res.json({
      success: true,
      data: data?.[0] || data,
      filters: {
        organisation_id: org_id || 'all',
        start_date: startDate,
        end_date: endDate
      }
    });
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics',
      message: error.message
    });
  }
});

/**
 * Get organization usage summary
 * Returns usage summary for all active organizations
 */
app.get('/api/super-admin/usage/organization-summary', superAdminMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const { start_date, end_date } = req.query;

    // Default to last 30 days if no dates provided
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    // Call the database function
    const { data, error } = await supabase.rpc('get_organization_usage_summary', {
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      filters: {
        start_date: startDate,
        end_date: endDate
      },
      total_organizations: data?.length || 0
    });
  } catch (error) {
    console.error('Error fetching organization usage summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organization usage summary',
      message: error.message
    });
  }
});

/**
 * Manually track a usage event
 * For testing and administrative purposes
 */
app.post('/api/super-admin/usage/track', superAdminMiddleware, async (req, res) => {
  try {
    const { organisation_id, event_type, quantity = 1, metadata = {} } = req.body;

    // Validate required fields
    if (!organisation_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: organisation_id'
      });
    }

    if (!event_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: event_type'
      });
    }

    // Validate event_type is a known type
    const validEventTypes = Object.values(UsageEventType);
    if (!validEventTypes.includes(event_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event_type',
        valid_types: validEventTypes
      });
    }

    // Track the event
    const result = await UsageTrackingService.trackEvent(
      organisation_id,
      event_type,
      quantity,
      { ...metadata, manually_tracked: true, tracked_by: req.user?.id }
    );

    res.json({
      success: true,
      message: 'Usage event tracked successfully',
      data: result
    });
  } catch (error) {
    console.error('Error tracking usage event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track usage event',
      message: error.message
    });
  }
});

/**
 * Start the server
 */
const server = app.listen(PORT, () => {
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
  console.log(`  POST   /api/scan-menu-items           - Scan menu items`);
  console.log(`  POST   /api/batch-extract-option-sets - Extract option sets`);
  console.log(`  POST   /api/extract-menu-premium       - Premium menu extraction`);
  console.log(`  GET    /api/premium-extract-status/:id - Check premium extraction status`);
  console.log(`  GET    /api/premium-extract-results/:id - Get premium extraction results`);
  console.log(`  POST   /api/extract-images-for-category - Extract category images`);
  console.log(`  POST   /api/generate-csv              - Generate CSV from data`);
  console.log(`  POST   /api/generate-clean-csv        - Generate clean CSV`);
  console.log(`  POST   /api/download-images           - Download menu images`);
  
  if (dbInitialized) {
    console.log('\n  === Restaurant Management ===');
    console.log(`  GET    /api/restaurants               - List all restaurants`);
    console.log(`  GET    /api/restaurants/:id           - Get restaurant details`);
    console.log(`  GET    /api/restaurants/:id/details   - Get restaurant full details`);
    console.log(`  POST   /api/restaurants               - Create new restaurant`);
    console.log(`  PATCH  /api/restaurants/:id           - Update restaurant`);
    console.log(`  PATCH  /api/restaurants/:id/workflow  - Update restaurant workflow`);
    console.log(`  DELETE /api/restaurants/:id           - Delete restaurant`);
    console.log(`  GET    /api/restaurants/:id/menus     - Get restaurant menus`);
    console.log(`  GET    /api/restaurants/:id/price-history - Get price history`);
    console.log(`  POST   /api/google-business-search    - Google Business search`);
    console.log(`  POST   /api/platform-url-search       - Search for platform URL`);
    console.log(`  POST   /api/platform-details-extraction - Extract platform details`);
    
    console.log('\n  === Extraction Management ===');
    console.log(`  POST   /api/extractions/start         - Start new extraction`);
    console.log(`  GET    /api/extractions               - List extraction jobs`);
    console.log(`  GET    /api/extractions/:jobId        - Get extraction details`);
    console.log(`  POST   /api/extractions/:jobId/retry  - Retry failed extraction`);
    console.log(`  DELETE /api/extractions/:jobId        - Cancel extraction`);
    
    console.log('\n  === Menu Management ===');
    console.log(`  GET    /api/menus                     - List all menus`);
    console.log(`  GET    /api/menus/:id                 - Get full menu with items`);
    console.log(`  GET    /api/menus/:id/csv             - Direct CSV download`);
    console.log(`  GET    /api/menus/:id/csv-with-cdn    - CSV with CDN URLs`);
    console.log(`  GET    /api/menus/compare             - Compare menus (query params)`);
    console.log(`  POST   /api/menus/:id/activate        - Activate menu version`);
    console.log(`  POST   /api/menus/:id/compare         - Compare menu versions`);
    console.log(`  POST   /api/menus/:id/duplicate       - Duplicate menu`);
    console.log(`  POST   /api/menus/:id/export          - Export menu to CSV`);
    console.log(`  POST   /api/menus/:id/download-images - Download menu images from DB`);
    console.log(`  GET    /api/menus/:id/download-images-zip - Download images as ZIP`);
    console.log(`  POST   /api/menus/:id/upload-images   - Upload images to CDN`);
    console.log(`  PATCH  /api/menus/:id/status          - Update menu status`);
    console.log(`  PATCH  /api/menus/bulk-reassign       - Bulk reassign menus`);
    console.log(`  DELETE /api/menus/:id                 - Delete menu`);
    console.log(`  POST   /api/menus/merge/validate      - Validate menu merge`);
    console.log(`  POST   /api/menus/merge/compare       - Compare for merge`);
    console.log(`  POST   /api/menus/merge/preview       - Preview menu merge`);
    console.log(`  POST   /api/menus/merge/execute       - Execute menu merge`);
    
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
  
  console.log('\n  === Website Extraction ===');
  console.log(`  POST   /api/website-extraction/logo   - Extract logo from website`);
  console.log(`  POST   /api/website-extraction/logo-candidates - Get logo candidates`);
  console.log(`  POST   /api/website-extraction/process-selected-logo - Process selected logo`);
  
  console.log('\n  === Upload Management ===');
  console.log(`  GET    /api/upload-batches/:batchId   - Get upload batch status`);
  console.log(`  POST   /api/upload-batches/:batchId/retry - Retry failed uploads`);
  
  console.log('\n  === Pumpd Registration & Automation ===');
  console.log('  Registration:');
  console.log(`  GET    /api/registration/status/:restaurantId - Get registration status`);
  console.log(`  POST   /api/registration/register-account - Register new account only`);
  console.log(`  POST   /api/registration/register-restaurant - Register restaurant`);
  console.log(`  GET    /api/registration/logs/:restaurantId - Get registration logs`);
  
  console.log('  Menu Import:');
  console.log(`  POST   /api/registration/import-csv-menu - Import CSV menu to Pumpd`);
  console.log(`  POST   /api/registration/upload-menu-images - Upload menu item images`);
  
  console.log('  Website Customization:');
  console.log(`  POST   /api/registration/customize-ordering-page - Customize ordering page`);
  console.log(`  POST   /api/registration/configure-website - Configure website settings`);
  console.log(`  POST   /api/registration/generate-code-injections - Generate code injections`);
  console.log(`  POST   /api/registration/upload-restaurant-images - Upload restaurant images`);
  
  console.log('  Configuration:');
  console.log(`  POST   /api/registration/configure-payment - Configure Stripe payments`);
  console.log(`  POST   /api/registration/configure-services - Configure service settings`);
  
  console.log('  Onboarding Management:');
  console.log(`  POST   /api/registration/create-onboarding-user - Create onboarding user`);
  console.log(`  POST   /api/registration/update-onboarding-record - Update onboarding record`);
  
  console.log('\n  === Super Admin (Protected) ===');
  console.log('  Organizations:');
  console.log(`  GET    /api/super-admin/organizations - Get all organizations`);
  console.log(`  GET    /api/super-admin/organizations/:id - Get organization details`);
  console.log(`  POST   /api/super-admin/organizations - Create organization`);
  console.log(`  PUT    /api/super-admin/organizations/:id - Update organization`);
  console.log(`  POST   /api/super-admin/organizations/:id/archive - Archive organization`);
  console.log(`  POST   /api/super-admin/organizations/:id/restore - Restore organization`);
  console.log(`  DELETE /api/super-admin/organizations/:id - Delete organization (permanently)`);
  console.log(`  POST   /api/super-admin/organizations/reassign-data - Reassign restaurant data`);
  console.log(`  POST   /api/super-admin/organizations/duplicate-data - Duplicate restaurant data`);
  
  console.log('  Users:');
  console.log(`  GET    /api/super-admin/users         - Get all users`);
  console.log(`  GET    /api/super-admin/users/:id     - Get user details`);
  console.log(`  POST   /api/super-admin/users         - Create user`);
  console.log(`  PUT    /api/super-admin/users/:id     - Update user`);
  console.log(`  PUT    /api/super-admin/users/:id/role - Update user role`);
  console.log(`  DELETE /api/super-admin/users/:id     - Delete user`);
  console.log(`  POST   /api/super-admin/users/:id/resend-invite - Resend invitation`);
  
  console.log('  Statistics:');
  console.log(`  GET    /api/super-admin/stats         - Get system statistics`);

  console.log('  Usage Statistics:');
  console.log(`  GET    /api/super-admin/usage/statistics - Get usage statistics`);
  console.log(`  GET    /api/super-admin/usage/organization-summary - Get org usage summary`);
  console.log(`  POST   /api/super-admin/usage/track   - Manually track usage event`);

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

// Configure server timeouts to handle long-running Firecrawl requests
// Set to 9 minutes (540000ms) to exceed the longest axios timeout (360000ms)
server.keepAliveTimeout = 540000; // 9 minutes (increased by 50%)
server.headersTimeout = 545000; // Slightly longer than keepAliveTimeout to prevent race conditions

console.log(`[Server] Timeout Configuration:`);
console.log(`[Server]   - Keep-Alive Timeout: ${server.keepAliveTimeout / 1000}s`);
console.log(`[Server]   - Headers Timeout: ${server.headersTimeout / 1000}s`);