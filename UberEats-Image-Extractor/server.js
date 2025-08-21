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
const { 
  DEFAULT_SCHEMA, 
  CATEGORY_DETECTION_SCHEMA,
  UBEREATS_CATEGORY_PROMPT,
  DOORDASH_CATEGORY_PROMPT,
  MENU_ITEMS_URL_SCHEMA,
  OPTION_SETS_SCHEMA,
  UBEREATS_MENU_ITEMS_URL_PROMPT,
  UBEREATS_OPTION_SETS_PROMPT
} = require('./src/services/firecrawl-service');

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
async function startBackgroundExtraction(jobId, url, categories) {
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
    endTime: null,
    data: null,
    categories: {
      successful: [],
      failed: []
    },
    error: null
  };
  
  jobStore.set(jobId, job);
  
  try {
    // Detect platform type
    const isUberEats = url.includes('ubereats.com');
    const isDoorDash = url.includes('doordash.com');
    
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
        const categoryPrompt = `Focus ONLY on extracting menu items from the category "${category.name}" on this ${isUberEats ? 'UberEats' : isDoorDash ? 'DoorDash' : ''} page.
        
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
    
    jobStore.set(jobId, job);
    
  } catch (error) {
    console.error(`[Job ${jobId}] Fatal error during extraction:`, error.message);
    
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
  
  const isUberEats = url.includes('ubereats.com');
  const isDoorDash = url.includes('doordash.com');
  
  if (!isUberEats && !isDoorDash) {
    res.status(400).json({
      success: false,
      error: 'URL must be from UberEats or DoorDash'
    });
    return false;
  }
  
  return true;
}

// REMOVED: Extract endpoints have been deprecated in favor of scrape with v2 JSON extraction
// The following endpoints were removed:
// - POST /api/extract - Used v1 extract API which is being replaced by v2 scrape with JSON format
// - GET /api/extract-status/:id - Status checking for v1 extract
// - GET /api/extract-results/:id - Results retrieval for v1 extract
// These have been replaced by the improved /api/scrape endpoint with v2 JSON extraction

/* REMOVED - Extract endpoint deprecated
app.post('/api/extract', async (req, res) => {
  const { url, prompt, schema } = req.body;
  
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
  
  console.log(`Starting complete extraction for URL: ${url}`);
  console.log(`Using Firecrawl API URL: ${FIRECRAWL_API_URL}`);
  console.log(`API Key present: ${FIRECRAWL_API_KEY ? 'Yes (length: ' + FIRECRAWL_API_KEY.length + ')' : 'No'}`);
  
  try {
    // Prepare request payload for Firecrawl API according to documentation
    const payload = {
      urls: [url],
      prompt: prompt || DEFAULT_PROMPT,
      schema: schema || DEFAULT_SCHEMA,
      enableWebSearch: false,  // Disable web search to prevent unnecessary URL scraping
      includeSubdomains: false, // Don't scrape subdomains
      agent: {
        model: "FIRE-1",
      },
      // Add scrape options for better navigation
      scrapeOptions: {
        formats: ["json"],
        onlyMainContent: true, 
        jsonOptions: {
          schema: schema || DEFAULT_SCHEMA,
        }
      }
    };
    
    // Log request details (without API key)
    console.log('Firecrawl API request payload:', JSON.stringify(payload, null, 2));
    
    // Make request to Firecrawl API
    console.log('Making request to:', `${FIRECRAWL_API_URL}/v1/extract`);
    console.log('With authorization header:', `Bearer ${FIRECRAWL_API_KEY.substring(0, 5)}...`);
    
    // Create a custom axios instance with longer timeout for extract completion
    const axiosInstance = axios.create({
      timeout: 300000, // 5 minute timeout for the complete extraction process
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    // Step 1: Initiate the extraction
    const initiateResponse = await axiosInstance.post(`${FIRECRAWL_API_URL}/v1/extract`, payload);
    
    console.log('Full Firecrawl API response:', JSON.stringify(initiateResponse.data, null, 2));
    
    if (!initiateResponse.data || !initiateResponse.data.id) {
      console.log('Unexpected response format:', initiateResponse.data);
      throw new Error('Invalid response from Firecrawl API: Missing extraction ID');
    }
    
    const extractionId = initiateResponse.data.id;
    console.log('Extraction initiated successfully, ID:', extractionId);
    
    // Step 2: Poll for extraction completion
    const maxAttempts = 120; // Maximum 120 polling attempts (10 minutes with 5-second interval)
    const pollingInterval = 20000; // 20 seconds between polling attempts
    let attempt = 0;
    let extractionCompleted = false;
    let extractionData = null;
    
    while (!extractionCompleted && attempt < maxAttempts) {
      attempt++;
      console.log(`Polling for extraction results (attempt ${attempt}/${maxAttempts})...`);
      
      try {
        // Get the current extraction status
        const statusResponse = await axiosInstance.get(`${FIRECRAWL_API_URL}/v1/extract/${extractionId}`);
        
        // Log the full response for debugging
        console.log(`Extraction status response (${attempt}):`, JSON.stringify(statusResponse.data, null, 2));
        
        if (!statusResponse.data) {
          throw new Error('Invalid extraction status response');
        }
        
        console.log(`Current extraction status: ${statusResponse.data.status}`);
        
        if (statusResponse.data.status === 'completed') {
          console.log('Extraction completed successfully!');
          extractionCompleted = true;
          
          // Check both possible data locations
          if (statusResponse.data.data) {
            extractionData = statusResponse.data.data;
            console.log('Found data in statusResponse.data.data');
          } else if (statusResponse.data.output) {
            extractionData = statusResponse.data.output;
            console.log('Found data in statusResponse.data.output');
          } else {
            console.log('No data found in the expected locations, searching deeper in the response...');
            
            // Try to find data in other possible locations
            const responseString = JSON.stringify(statusResponse.data);
            if (responseString.includes('menuItems')) {
              console.log('Found menuItems in the response, but not in the expected location');
              
              // Try to extract the relevant sections
              Object.keys(statusResponse.data).forEach(key => {
                const value = statusResponse.data[key];
                if (value && typeof value === 'object') {
                  if (value.menuItems) {
                    console.log(`Found menuItems in statusResponse.data.${key}`);
                    extractionData = value;
                  }
                }
              });
            }
            
            if (!extractionData) {
              console.error('Could not find menuItems in any part of the response');
              throw new Error('Extraction completed but menuItems not found in response');
            }
          }
          
          break;
        } else if (statusResponse.data.status === 'failed') {
          throw new Error(`Extraction failed: ${statusResponse.data.error || 'Unknown error'}`);
        } else {
          // Still processing, wait before polling again
          console.log(`Waiting ${pollingInterval/1000} seconds before next poll...`);
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
      } catch (pollingError) {
        console.error(`Error polling extraction status (attempt ${attempt}):`, pollingError.message);
        
        if (attempt >= maxAttempts) {
          throw pollingError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }
    
    if (!extractionCompleted) {
      throw new Error(`Extraction timed out after ${maxAttempts} polling attempts`);
    }
    
    if (!extractionData) {
      throw new Error('Extraction completed but no data was returned');
    }
    
    // Log the extracted data for debugging
    console.log('Extraction data summary:');
    if (extractionData.menuItems) {
      console.log(`Found ${extractionData.menuItems.length} menu items`);
    } else {
      console.log('No menuItems found in the extracted data');
      console.log('Available keys:', Object.keys(extractionData));
    }
    
    // Add some final validation before sending to the client
    if (!extractionData.menuItems || !Array.isArray(extractionData.menuItems)) {
      console.error('Invalid data structure: menuItems is not an array or is missing');
      console.log('Data received:', JSON.stringify(extractionData, null, 2));
      
      // Try to transform the data if possible
      if (typeof extractionData === 'object') {
        // Look through all properties to find any array that might contain menu items
        for (const key in extractionData) {
          if (Array.isArray(extractionData[key]) && extractionData[key].length > 0) {
            // Check if this array contains objects with dishName, menuName, etc.
            const potentialMenuItems = extractionData[key];
            if (potentialMenuItems[0] && 
                (potentialMenuItems[0].dishName || potentialMenuItems[0].menuName || 
                 potentialMenuItems[0].imageURL || potentialMenuItems[0].fullSizeImageURL)) {
              console.log(`Found potential menu items in property "${key}"`);
              // Transform the structure to match expected format
              extractionData = {
                menuItems: potentialMenuItems
              };
              break;
            }
          }
        }
      }
      
      // Final check after transformation attempts
      if (!extractionData.menuItems || !Array.isArray(extractionData.menuItems)) {
        throw new Error('Could not find valid menu items in the extraction result');
      }
    }
    
    console.log(`Successfully extracted ${extractionData.menuItems.length} menu items, sending to client`);
    
    // Return the completed and validated extraction data to the client
    return res.json({
      success: true,
      data: extractionData
    });
  } catch (error) {
    console.error('Extraction error:', error.message);
    
    // Log detailed error information if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
      console.error('Error response headers:', error.response.headers);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      success: false,
      error: `Extraction failed: ${error.message}`
    });
  }
});
*/

/* REMOVED - Extract status endpoint deprecated
app.get('/api/extract-status/:id', async (req, res) => {
  const extractionId = req.params.id;
  
  if (!extractionId) {
    return res.status(400).json({
      success: false,
      error: 'Extraction ID is required'
    });
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Checking extraction status for ID: ${extractionId}`);
  
  try {
    // Query Firecrawl API for extraction status
    const response = await axios.get(`${FIRECRAWL_API_URL}/v1/extract/${extractionId}`, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      timeout: 15000
    });
    
    // Process status response
    if (response.data) {
      return res.json({
        success: true,
        status: response.data.status,
        progress: response.data.progress || 0,
        error: response.data.error || null
      });
    } else {
      throw new Error('Invalid response from Firecrawl API');
    }
  } catch (error) {
    console.error('Status check error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: `Status check failed: ${error.message}`
    });
  }
});
*/

/* REMOVED - Extract results endpoint deprecated  
app.get('/api/extract-results/:id', async (req, res) => {
  const extractionId = req.params.id;
  
  if (!extractionId) {
    return res.status(400).json({
      success: false,
      error: 'Extraction ID is required'
    });
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Getting extraction results for ID: ${extractionId}`);
  
  try {
    // Query Firecrawl API for extraction results
    const response = await axios.get(`${FIRECRAWL_API_URL}/v1/extract/${extractionId}`, {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      timeout: 30000
    });
    
    // Ensure extraction is complete
    if (response.data.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Extraction is not completed (status: ${response.data.status})`
      });
    }
    
    // Process results - Looking for data in the correct location of the response
    if (response.data && response.data.data) {
      // Return the structured output data
      return res.json({
        success: true,
        data: response.data.data
      });
    } else {
      throw new Error('No data found in extraction results');
    }
  } catch (error) {
    console.error('Results retrieval error:', error.message);
    
    // If there's a response object in the error, log its data for better debugging
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    return res.status(500).json({
      success: false,
      error: `Results retrieval failed: ${error.message}`
    });
  }
});
*/

/**
 * API endpoint for direct scraping using Firecrawl's /v1/scrape endpoint
 * Uses the FIRE-1 agent and JSON format for better menu extraction
 */
app.post('/api/scrape', async (req, res) => {
  const { url, prompt, schema } = req.body;
  
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
  
  console.log(`Starting direct scrape with FIRE-1 for URL: ${url}`);
  
  try {
    // Detect if this is UberEats or DoorDash URL
    const isUberEats = url.includes('ubereats.com');
    const isDoorDash = url.includes('doordash.com');
    
    // Use platform-specific prompts if available
    let extractionPrompt;
    let extractionSchema;
    
    if (isUberEats) {
      console.log('Using UberEats-specific prompt and schema');
      extractionPrompt = prompt || require('./src/services/firecrawl-service').UBEREATS_PROMPT;
      extractionSchema = schema || require('./src/services/firecrawl-service').DEFAULT_SCHEMA;
    } else if (isDoorDash) {
      console.log('Using DoorDash-specific prompt and schema');
      extractionPrompt = prompt || require('./src/services/firecrawl-service').DOORDASH_PROMPT;
      extractionSchema = schema || require('./src/services/firecrawl-service').DOORDASH_SCHEMA;
    } else {
      extractionPrompt = prompt || DEFAULT_PROMPT;
      extractionSchema = schema || DEFAULT_SCHEMA;
    }
    
    // Prepare v2 request payload
    const payload = {
      url: url,
      formats: [{
        type: 'json',
        schema: extractionSchema,
        prompt: extractionPrompt
      }],
      onlyMainContent: true,
      waitFor: 2000, // Wait 2 seconds for page to load properly
      blockAds: true, // Block ads and cookie popups
      timeout: 300000, // 5 minute timeout
      maxAge: parseInt(process.env.FIRECRAWL_CACHE_MAX_AGE || '172800'), // 2 days cache by default
      skipTlsVerification: true,
      removeBase64Images: true
    };
    
    const apiEndpoint = `${FIRECRAWL_API_URL}/v2/scrape`;
    
    // Log request details (without API key)
    console.log('Firecrawl direct scrape request payload:', JSON.stringify(payload, null, 2));
    
    // Create axios instance with longer timeout for scraping
    const axiosInstance = axios.create({
      timeout: 300000, // 5 minute timeout for comprehensive extraction
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      }
    });
    
    // Make single request to Firecrawl Scrape API
    console.log('Making direct scrape request to:', apiEndpoint);
    console.log('API key length:', FIRECRAWL_API_KEY?.length || 0);
    console.log('Auth header:', `Bearer ${FIRECRAWL_API_KEY.substring(0, 5)}...`);
    
    const scrapeResponse = await axiosInstance.post(apiEndpoint, payload);
    
    // Log response summary for debugging
    console.log('Direct scrape response status:', scrapeResponse.status);
    console.log('Response data structure:', Object.keys(scrapeResponse.data));
    
    // Parse v2 response
    const parsedResponse = scrapeResponse.data;
    
    // Check if response is successful
    if (!parsedResponse.success) {
      throw new Error(`API returned error: ${parsedResponse.error || 'Unknown error'}`);
    }
    
    // In v2, JSON extracted data is in data.json
    let extractionData = null;
    
    if (parsedResponse.data && parsedResponse.data.json) {
      console.log('Found structured data in data.json');
      extractionData = parsedResponse.data.json;
      
      // If the extractionData already has the expected structure, use it directly
      if (extractionData.menuItems && Array.isArray(extractionData.menuItems)) {
        console.log(`Found ${extractionData.menuItems.length} menu items directly in json response`);
      } 
      // If the response doesn't have menuItems but has the correct structure otherwise, wrap it
      else if (!extractionData.menuItems && typeof extractionData === 'object') {
        console.log('Response has correct structure but missing menuItems wrapper, adding it');
        extractionData = { menuItems: [extractionData] };
      }
    } 
    // Fallback for other potential response structures
    else if (parsedResponse.data) {
      console.log('Searching for menu data in response structure...');
      
      // Try to find menuItems in the response
      const findMenuItems = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return null;
        
        // Check if this object has menuItems
        if (obj.menuItems && Array.isArray(obj.menuItems)) {
          console.log(`Found menuItems at path: ${path}`);
          return obj;
        }
        
        // Check if this object resembles a menu item collection
        if (Array.isArray(obj) && obj.length > 0) {
          const sampleItem = obj[0];
          if (sampleItem && typeof sampleItem === 'object' && 
              (sampleItem.dishName || sampleItem.name || sampleItem.title || 
               sampleItem.categoryName || sampleItem.price || sampleItem.dishPrice)) {
            console.log(`Found array of menu-like items at path: ${path}`);
            return { menuItems: obj };
          }
        }
        
        // Recursively check all child properties
        for (const key in obj) {
          const newPath = path ? `${path}.${key}` : key;
          const result = findMenuItems(obj[key], newPath);
          if (result) return result;
        }
        
        return null;
      };
      
      const foundData = findMenuItems(parsedResponse.data);
      if (foundData) {
        extractionData = foundData;
      }
    }
    
    // Final validation
    if (!extractionData) {
      console.error('Could not find valid data in the scrape response:', 
                   JSON.stringify(parsedResponse.data).substring(0, 1000) + '...');
      throw new Error('Direct scrape completed but no valid data structure was found');
    }
    
    if (!extractionData.menuItems || !Array.isArray(extractionData.menuItems)) {
      console.error('Invalid data structure: menuItems is not an array or is missing');
      
      // Try to adapt the data structure if possible
      if (typeof extractionData === 'object') {
        // Look for any array or object that might contain menu items
        for (const key in extractionData) {
          if (Array.isArray(extractionData[key]) && extractionData[key].length > 0) {
            // Check if array contains objects with dish properties
            const potentialItems = extractionData[key];
            if (potentialItems[0] && typeof potentialItems[0] === 'object' &&
                (potentialItems[0].dishName || potentialItems[0].name || 
                 potentialItems[0].title || potentialItems[0].price ||
                 potentialItems[0].imageURL || potentialItems[0].image)) {
              console.log(`Found potential menu items in property "${key}"`);
              // Transform to expected format
              extractionData = {
                menuItems: potentialItems.map(item => {
                  // Normalize field names if needed
                  return {
                    dishName: item.dishName || item.name || item.title || '',
                    dishPrice: parseFloat(item.dishPrice || item.price || 0),
                    dishDescription: item.dishDescription || item.description || '',
                    categoryName: item.categoryName || item.category || 'Uncategorized',
                    menuName: item.menuName || item.menu || 'Menu',
                    imageURL: item.imageURL || item.image || item.img || '',
                    tags: item.tags || []
                  };
                })
              };
              break;
            }
          }
        }
      }
    }
    
    // Final check after transformation attempts
    if (!extractionData.menuItems || !Array.isArray(extractionData.menuItems)) {
      throw new Error('Could not find or format valid menu items in the scrape result');
    }
    
    // Post-process menu items to ensure consistent format
    extractionData.menuItems = extractionData.menuItems.map(item => {
      // Ensure all required fields exist with proper types
      return {
        dishName: item.dishName || item.name || item.title || '',
        dishPrice: typeof item.dishPrice === 'number' ? item.dishPrice : 
                  typeof item.price === 'number' ? item.price : 
                  parseFloat(item.dishPrice || item.price || 0) || 0,
        dishDescription: item.dishDescription || item.description || '',
        categoryName: item.categoryName || item.category || 'Uncategorized',
        menuName: item.menuName || item.menu || 'Menu',
        imageURL: item.imageURL || item.image || item.img || '',
        tags: Array.isArray(item.tags) ? item.tags : []
      };
    });
    
    console.log(`Successfully scraped ${extractionData.menuItems.length} menu items, sending to client`);
    
    // Return the data to the client
    return res.json({
      success: true,
      data: extractionData
    });
  } catch (error) {
    console.error('Direct scrape error:', error.message);
    
    // Log detailed error information if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      success: false,
      error: `Direct scrape failed: ${error.message}`
    });
  }
});

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
      const menuName = customItem.menuName || 'Menu';
      
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
      const menuName = customItem.menuName || 'Menu';
      
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
    // Detect if this is UberEats or DoorDash URL
    const isUberEats = url.includes('ubereats.com');
    const isDoorDash = url.includes('doordash.com');
    
    // Use platform-specific prompts
    let categoryPrompt;
    
    if (isUberEats) {
      console.log('Using UberEats-specific category detection prompt');
      categoryPrompt = UBEREATS_CATEGORY_PROMPT;
    } else if (isDoorDash) {
      console.log('Using DoorDash-specific category detection prompt');
      categoryPrompt = DOORDASH_CATEGORY_PROMPT;
    } else {
      // Use UberEats prompt as default for unknown platforms
      categoryPrompt = UBEREATS_CATEGORY_PROMPT;
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
    
    const response = await axiosInstance.post(apiEndpoint, payload);
    
    // Log response summary
    console.log('Category scan response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    
    // Debug log for response
    if (process.env.DEBUG_MODE === 'true') {
      console.log('Raw v2 response structure:');
      console.log('- response.data keys:', Object.keys(response.data));
      if (response.data.data) {
        console.log('- response.data.data keys:', Object.keys(response.data.data));
        if (response.data.data.json) {
          console.log('- Found json data:', JSON.stringify(response.data.data.json, null, 2).substring(0, 500));
        }
        if (response.data.data.categories) {
          console.log('- Found categories directly:', JSON.stringify(response.data.data.categories, null, 2).substring(0, 500));
        }
      }
    }
    
    // Parse v2 response
    const parsedResponse = response.data;
    
    // Check if response is successful
    if (!parsedResponse.success) {
      throw new Error(`API returned error: ${parsedResponse.error || 'Unknown error'}`);
    }
    
    // Extract categories from response
    let categories = [];
    
    // In v2, JSON extracted data is in data.json
    if (parsedResponse.data && parsedResponse.data.json && parsedResponse.data.json.categories) {
      console.log('Found categories in data.json.categories');
      categories = parsedResponse.data.json.categories;
      console.log('Categories found:', JSON.stringify(categories, null, 2));
    }
    // Fallback to direct categories location
    else if (parsedResponse.data && parsedResponse.data.categories) {
      console.log('Found categories in data.categories');
      categories = parsedResponse.data.categories;
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
        platformType: isUberEats ? 'ubereats' : isDoorDash ? 'doordash' : 'unknown'
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
  const { url, categories, async = false } = req.body;
  
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
    startBackgroundExtraction(jobId, url, categories);
    
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
    const isUberEats = url.includes('ubereats.com');
    const isDoorDash = url.includes('doordash.com');
    
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
        const categoryPrompt = `Focus ONLY on extracting menu items from the category "${category.name}" on this ${isUberEats ? 'UberEats' : isDoorDash ? 'DoorDash' : ''} page.
        
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
app.get('/api/batch-extract-results/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required'
    });
  }
  
  console.log(`Retrieving results for job: ${jobId}`);
  
  const results = getJobResults(jobId);
  
  if (!results) {
    // Check if job exists but isn't complete
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
  }
  
  // Return the complete results
  return res.json({
    success: true,
    data: results.data,
    categories: results.categories,
    stats: results.stats
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
    // Detect if this is UberEats (option sets extraction is primarily for UberEats)
    const isUberEats = url.includes('ubereats.com');
    
    if (!isUberEats) {
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
 * Handle 404s for API routes
 */
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
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
  console.log('\n[Server] Available endpoints:');
  console.log(`  POST   /api/scrape                    - Direct page scraping`);
  console.log(`  POST   /api/scan-categories           - Scan for menu categories`);
  console.log(`  POST   /api/batch-extract-categories  - Extract full menu data`);
  console.log(`  GET    /api/batch-extract-status/:id  - Check extraction status`);
  console.log(`  GET    /api/batch-extract-results/:id - Get extraction results`);
  console.log(`  POST   /api/extract-images-for-category - Extract category images`);
  console.log(`  POST   /api/generate-csv              - Generate CSV from data`);
  console.log(`  POST   /api/generate-clean-csv        - Generate clean CSV`);
  console.log(`  GET    /api/status                    - Server status`);
  console.log(`  POST   /api/download-images           - Download menu images`);
  
  // Show Firecrawl API key status
  if (!FIRECRAWL_API_KEY) {
    console.warn('\n⚠️  WARNING: FIRECRAWL_API_KEY environment variable is not set');
    console.warn('   Set this variable to enable Firecrawl API integration');
    console.warn('   Example: export FIRECRAWL_API_KEY=your-api-key-here');
  } else {
    console.log(`\n✅ Firecrawl API configured and ready`);
  }
});