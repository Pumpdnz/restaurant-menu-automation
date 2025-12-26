/**
 * Lead Scrape Firecrawl Service
 * Handles Firecrawl extractions for the lead scraping pipeline
 */

const axios = require('axios');
const { getSupabaseClient } = require('./database-service');
const rateLimiter = require('./rate-limiter-service');
const { cleanInstagramUrl, cleanFacebookUrl, cleanReviewCount, cleanWebsiteUrl } = require('./lead-url-validation-service');
const { UsageTrackingService } = require('./usage-tracking-service');
const { downloadImageToBuffer } = require('./logo-extraction-service');

// Environment configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const FIRECRAWL_CONCURRENCY_LIMIT = parseInt(process.env.FIRECRAWL_CONCURRENCY_LIMIT) || 5;

// UberEats pagination - typically returns ~21 items per page
const UBEREATS_ITEMS_PER_PAGE = 21;

// ============================================================================
// LEAD EXCLUSION FILTER - Non-ICP Fast Food Chains
// ============================================================================

/**
 * List of excluded chain name patterns (case-insensitive regex)
 * These are fast food chains that are not our ICP (Ideal Customer Profile)
 */
const EXCLUDED_CHAIN_PATTERNS = [
  // McDonald's variations
  /mcdonalds?/i,
  /mc\s*donald'?s?/i,
  // Other major chains
  /burger\s*king/i,
  /taco\s*bell/i,
  /\bkfc\b/i,
  /kentucky\s*fried\s*chicken/i,
  /\bsubway\b/i,
  /bowl['']?d\b/i,
  /pita\s*pit/i,
  /burger\s*fuel/i,
  /carl'?s?\s*jr\.?/i,
  /carl'?s?\s*junior/i,
  /nando'?s/i,
  /buns\s*(n|and)\s*rolls/i,
  /mexicali\s*fresh/i,
  /zambrero/i,
  /sal'?s\s*(authentic|pizza)/i,
  /domino'?s/i,
  /lone\s*star/i,
  /pizza\s*hut/i,
  /hell'?s?\s*pizza/i,
  /\bhell\s+[a-z]+\b/i, // "Hell {Location}" pattern
  /pizza\s*club/i,
  /chicking/i,
  /wendy'?s/i,
  /better\s*burger/i,
  /st\.?\s*pierre'?s?/i,
  /saint\s*pierre/i,
  /\bre\s*burger/i,
  // Additional chains (added 2025-12-08)
  /\bcoffee\s*club\b/i,
  /popeyes?/i,
  /dunkin'?\s*(donuts)?/i,
  /shake\s*out/i,
  /downlow\s*burgers?/i,
  /denny'?s/i,
  /egg'?d\b/i,
  /\bhoyts\b/i,
  /wahlburgers?/i,
  /krispy\s*kreme/i,
  /night\s*'?n'?\s*day/i,
  /\bsuperette\b/i,
  /mrbeast\s*burger/i,
  /mr\s*beast\s*burger/i,
  /tank\s*juice/i,
  /jesters?\s*pies?/i,
  /joe'?s\s*garage/i,
  /country\s*fried\s*chicken/i,
  /la\s*porchetta/i,
  /\bbp2go\b/i,
  /\bbp\s*2\s*go\b/i,
  // Additional chains (added 2025-12-22)
  /\bcalimero\b/i,
  /\blj['']?s\b/i,
  /texas\s*chicken/i,
  /burger\s*wisconsin/i,
];

/**
 * Check if a restaurant name matches any excluded chain pattern
 * @param {string} restaurantName - Name to check
 * @returns {boolean} - True if excluded, false if allowed
 */
function isExcludedChain(restaurantName) {
  if (!restaurantName) return false;
  return EXCLUDED_CHAIN_PATTERNS.some(pattern => pattern.test(restaurantName));
}

/**
 * Clean address by removing trailing ", {region} {postcode}" pattern
 * Handles: ", APAC 1234", ", NI 1045", ", SI 9016", ", Canterbury 8014", ", Wellington 6161"
 * @param {string} address - Raw address from UberEats extraction
 * @returns {string|null} Cleaned address
 */
function cleanAddress(address) {
  if (!address) return null;
  // Remove trailing ", {region/code} {postcode}" - matches comma, word(s), and 4-digit postcode
  return address.replace(/,\s*[A-Za-z]+\s+\d{4}\s*$/i, '').trim() || null;
}

/**
 * Check for global duplicates across all leads in the database by store_link (UberEats URL)
 * Filters by organisation_id to allow duplicate leads across different organisations
 * @param {Array} restaurants - Array of restaurant objects with store_link
 * @param {string} orgId - Organisation ID to check duplicates within
 * @returns {Promise<{unique: Array, duplicateCount: number}>} - Unique restaurants and count of duplicates found
 */
async function filterGlobalDuplicates(restaurants, orgId) {
  if (!restaurants || restaurants.length === 0) {
    return { unique: [], duplicateCount: 0 };
  }

  if (!orgId) {
    console.warn('[LeadScrapeFirecrawl] filterGlobalDuplicates called without orgId, skipping duplicate check');
    return { unique: restaurants, duplicateCount: 0 };
  }

  const client = getSupabaseClient();
  const storeLinks = restaurants.map(r => r.store_link).filter(Boolean);

  if (storeLinks.length === 0) {
    return { unique: restaurants, duplicateCount: 0 };
  }

  try {
    // Query existing leads with matching store_links within the same organisation
    const { data: existingLeads, error } = await client
      .from('leads')
      .select('store_link')
      .eq('organisation_id', orgId)
      .in('store_link', storeLinks);

    if (error) {
      console.error('[LeadScrapeFirecrawl] Error checking global duplicates:', error);
      // On error, return all restaurants (fail open)
      return { unique: restaurants, duplicateCount: 0 };
    }

    // Create a Set of existing store_links for O(1) lookup
    const existingStoreLinks = new Set(existingLeads?.map(l => l.store_link) || []);

    // Filter out restaurants that already exist in the database
    const unique = restaurants.filter(r => !existingStoreLinks.has(r.store_link));
    const duplicateCount = restaurants.length - unique.length;

    return { unique, duplicateCount };
  } catch (error) {
    console.error('[LeadScrapeFirecrawl] Error in filterGlobalDuplicates:', error);
    // On error, return all restaurants (fail open)
    return { unique: restaurants, duplicateCount: 0 };
  }
}

/**
 * Calculate how many pages need to be scraped based on leads limit
 * @param {number} leadsLimit - Target number of leads
 * @param {number} itemsPerPage - Items returned per page (default: 21)
 * @returns {number} - Number of pages to scrape
 */
function calculatePagesNeeded(leadsLimit, itemsPerPage = UBEREATS_ITEMS_PER_PAGE) {
  return Math.ceil(leadsLimit / itemsPerPage);
}

/**
 * Generate array of page numbers to scrape
 * @param {number} startPage - Starting page offset
 * @param {number} pagesNeeded - Number of pages to scrape
 * @returns {number[]} - Array of page numbers
 */
function generatePageNumbers(startPage, pagesNeeded) {
  return Array.from({ length: pagesNeeded }, (_, i) => startPage + i);
}

// ============================================================================
// STEP 1: CATEGORY PAGE SCAN - Extract restaurant names and URLs
// ============================================================================

const STEP_1_SCHEMA = {
  type: "object",
  properties: {
    restaurants: {
      type: "array",
      description: "List of all restaurant listings on the page",
      items: {
        type: "object",
        properties: {
          restaurant_name: {
            type: "string",
            description: "The name of the restaurant as displayed"
          },
          store_link: {
            type: "string",
            description: "The full URL to the restaurant's UberEats store page"
          }
        },
        required: ["restaurant_name", "store_link"]
      }
    }
  },
  required: ["restaurants"]
};

const STEP_1_PROMPT = `Extract all restaurant listings from this UberEats category page. For each restaurant:

1. Find the restaurant name (the main title/heading of each listing)
2. Find the store URL (the link to the restaurant's individual page)

Extract all restaurants on the page, including those that are not currently available for ordering.
Do NOT include promotional banners, ads, or non-restaurant content.
Each restaurant should have a unique name and URL.

Format the store_link as a complete URL starting with https://www.ubereats.com`;

// ============================================================================
// STEP 2: STORE PAGE ENRICHMENT - Extract details from store pages
// ============================================================================

const STEP_2_SCHEMA = {
  type: "object",
  properties: {
    restaurant_name: {
      type: "string",
      description: "The restaurant name as displayed on the store page"
    },
    number_of_reviews: {
      type: "string",
      description: "The review count, may include '+' (e.g., '500+', '3,000+')"
    },
    average_review_rating: {
      type: "number",
      description: "The average rating out of 5.0 (e.g., 4.7)"
    },
    address: {
      type: "string",
      description: "Full street address of the restaurant"
    },
    cuisine: {
      type: "array",
      description: "Array of cuisine type tags",
      items: { type: "string" }
    },
    price_rating: {
      type: "integer",
      description: "Price rating (1-4 dollar signs)"
    }
  },
  required: ["restaurant_name"]
};

const STEP_2_PROMPT = `Extract the following information from this UberEats restaurant store page:

1. Restaurant name - The main name displayed on the page
2. Number of reviews - The review count (may include "+" like "500+")
3. Average rating - The star rating out of 5.0
4. Address - The full street address of the restaurant
5. Cuisine types - Categories/tags describing the food type
6. Price rating - The dollar signs indicating price level (1-4)

Look for these in the restaurant header section at the top of the page.
The address is usually shown near the restaurant name.
Cuisine types are often displayed as tags or badges.

IMPORTANT: Extract ONLY the data that is visible on the page.
If a value is not visible, leave it empty rather than guessing.`;

// ============================================================================
// STEP 3: GOOGLE BUSINESS LOOKUP - Phone, website, hours, social media
// ============================================================================

const STEP_3_SCHEMA = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      description: "Business phone number in local format"
    },
    website_url: {
      type: "string",
      description: "Official business website URL (NOT delivery platforms like UberEats, DoorDash)"
    },
    openingHours: {
      type: "array",
      description: "Opening hours for each day of the week",
      items: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day of the week (Monday, Tuesday, etc.)" },
          open: { type: "string", description: "Opening time" },
          close: { type: "string", description: "Closing time" },
          period: { type: "string", description: "Optional: Lunch or Dinner. Only use if there are multiple hours entries for this day" }
        }
      }
    },
    google_address: {
      type: "string",
      description: "Business address from Google Business Profile"
    },
    google_rating: {
      type: "number",
      description: "Google rating out of 5"
    },
    google_reviews_count: {
      type: "integer",
      description: "Number of Google reviews as an integer (e.g., 281, not '281 reviews')"
    },
    instagram_url: {
      type: "string",
      description: "Instagram profile URL from the Knowledge Panel social links (e.g., https://www.instagram.com/restaurantname/). Must be a profile URL, NOT reels or posts."
    },
    facebook_url: {
      type: "string",
      description: "Facebook page URL from the Knowledge Panel social links (e.g., https://www.facebook.com/restaurantname/). Must be a page URL, NOT groups, videos, or posts."
    }
  }
};

const STEP_3_PROMPT = `Extract business information from this Google search results page. Focus on the Knowledge Panel / Business Profile on the right side.

Extract the following information:

1. PHONE NUMBER - Business phone in local format (with area code, e.g., +64 or 0X for NZ, +61 for AU)

2. WEBSITE URL - The official business website ONLY.
   - EXCLUDE delivery platform links (UberEats, DoorDash, DeliverEasy, MenuLog)
   - EXCLUDE social media links

3. OPENING HOURS - Extract hours for each day exactly as shown on the page.
   IMPORTANT: Extract hours exactly as displayed. Some restaurants have split hours (lunch and dinner).
   - If the page shows continuous hours (e.g., "11am - 9pm"), return a single entry per day.
   - Only create separate entries if there is an explicit gap/break shown on the page (e.g., "11am-2pm" then "5pm-9pm").
   - Use the "period" field ONLY when there are multiple time slots for the same day (e.g., "Lunch", "Dinner").
   - If a day shows "Closed", do not include an entry for that day.

4. GOOGLE ADDRESS - The full business address shown

5. GOOGLE RATING - The star rating out of 5.0

6. GOOGLE REVIEWS COUNT - The number of reviews as an integer ONLY
   - Example: If shown as "281 Google reviews", return 281
   - Example: If shown as "(500+ reviews)", return 500

7. INSTAGRAM URL - Look for Instagram link in the Knowledge Panel's social media section
   - ONLY extract profile URLs like https://www.instagram.com/username/
   - REJECT URLs containing /reel/, /p/, /stories/, /reels/, /tv/

8. FACEBOOK URL - Look for Facebook link in the Knowledge Panel's social media section
   - ONLY extract page URLs like https://www.facebook.com/pagename/
   - REJECT URLs containing /videos/, /groups/, /posts/, /events/, /photos/

IMPORTANT: Only extract data visible on the page. Do not guess or fabricate values.`;

// ============================================================================
// STEP 4: ORDERING PLATFORM DISCOVERY - Find online ordering URLs from website
// ============================================================================

const STEP_4_SCHEMA = {
  type: "object",
  properties: {
    ordering_links: {
      type: "array",
      description: "All ordering-related links found on the website",
      items: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL of the ordering link" },
          text: { type: "string", description: "The visible text on the link/button" },
          location: { type: "string", description: "Where on the page: header, footer, hero, body, navigation" }
        }
      }
    }
  }
};

const STEP_4_PROMPT = `Analyze this restaurant website and find all online ordering links.

Look for:
1. BUTTONS or LINKS with text like: "Order Online", "Order Now", "Start Order", "Order Pickup", "Order Delivery", "Place Order", "Order Here", "Order Food", "Online Ordering"
2. Links to NZ ordering platforms like: Bite, Book N Order, Bopple, Bustle, Foodhub, Gloriafood, Mobi2Go, Me&U, NextOrder, Ordermeal, Resdiary, Sipo CloudPOS, Tabin, Tuckerfox
3. Navigation menu items related to ordering
4. Hero section buttons for ordering
5. Footer links to ordering pages

For each ordering link found, extract:
- The full URL (href attribute)
- The visible text on the link/button
- Where it appears on the page: header, navigation, hero, body, or footer

IMPORTANT:
- EXCLUDE links to UberEats, DoorDash, Grubhub, Menulog, DeliverEasy (these are delivery aggregators we already track)
- EXCLUDE social media links (Instagram, Facebook, Twitter)
- EXCLUDE "View Menu" or "See Menu" links that just show a PDF or static menu (no ordering capability)
- EXCLUDE links that go to the same website's menu page without ordering functionality
- Focus on links that lead to actual online ordering functionality where customers can place orders

Return an empty array [] if no ordering links are found.`;

// Known ordering platform domains for identification (NZ-focused)
const KNOWN_ORDERING_PLATFORMS = {
  // Bite
  'bite.co.nz': 'Bite',
  'getbite.co.nz': 'Bite',
  // Book N Order
  'booknorder.co.nz': 'Book N Order',
  'booknorder.com': 'Book N Order',
  // Bopple
  'bopple.com': 'Bopple',
  'bopple.app': 'Bopple',
  // Bustle
  'heybustle.com': 'Bustle',
  'venues.heybustle.com': 'Bustle',
  // Foodhub
  'foodhub.co.nz': 'Foodhub',
  'foodhub.com': 'Foodhub',
  // GloriaFood
  'gloriafood.com': 'Gloriafood',
  'order.online': 'Gloriafood',
  'gloria.food': 'Gloriafood',
  // Mobi2Go
  'mobi2go.com': 'Mobi2Go',
  'mobi2go.co.nz': 'Mobi2Go',
  // Me&U
  'meandu.com': 'Me&U',
  'mryum.com': 'Me&U',
  // NextOrder
  'nextorder.co.nz': 'NextOrder',
  'nextorder.com.au': 'NextOrder',
  // Ordermeal
  'ordermeal.co.nz': 'Ordermeal',
  'ordermeal.com': 'Ordermeal',
  // Resdiary
  'resdiary.com': 'Resdiary',
  'rfrr.co': 'Resdiary',
  // Sipo CloudPOS
  'sipo.co.nz': 'Sipo CloudPOS',
  'sipocloudpos.com': 'Sipo CloudPOS',
  // Tabin
  'tabin.co.nz': 'Tabin',
  'tabin.com': 'Tabin',
  // Tuckerfox
  'tuckerfox.co.nz': 'Tuckerfox',
  'tuckerfox.com': 'Tuckerfox'
};

// Domains to exclude (delivery aggregators we already track)
const EXCLUDED_ORDERING_DOMAINS = [
  'ubereats.com',
  'doordash.com',
  'grubhub.com',
  'menulog.co.nz',
  'menulog.com.au',
  'deliveroo.com',
  'delivereasy.co.nz',
  'postmates.com',
  'seamless.com',
  'eat24.com',
  'caviar.com',
  'foodpanda.com'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Make a Firecrawl API request with retry logic
 * Updated for Firecrawl v2 API format
 * @param {string} url - URL to scrape
 * @param {string} prompt - Extraction prompt
 * @param {object} schema - JSON schema for extraction
 * @param {object} options - Request options
 * @param {object} trackingInfo - Usage tracking info {organisationId, jobId, stepNumber, leadId}
 */
async function firecrawlRequest(url, prompt, schema, options = {}, trackingInfo = null) {
  const {
    timeout = 120000,
    waitFor = 4000,
    maxRetries = 3,
    retryDelay = 5000,
    includeMetadata = false  // When true, returns { json, metadata } instead of just json
  } = options;

  // Firecrawl v2 API format - json extraction goes in formats array as an object
  const payload = {
    url,
    formats: [
      {
        type: 'json',
        prompt,
        schema
      }
    ],
    waitFor,
    onlyMainContent: options.onlyMainContent !== false,
    removeBase64Images: true,
    maxAge: 0  // Disable caching to ensure fresh metadata with high-res og:image
  };

  const axiosInstance = axios.create({
    timeout: timeout + 30000, // Extra buffer for network
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
    }
  });

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Acquire rate limiter slot
      await rateLimiter.acquireSlot('lead-scrape');

      const response = await axiosInstance.post(
        `${FIRECRAWL_API_URL}/v2/scrape`,
        payload
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Firecrawl request failed');
      }

      // Track successful API call if tracking info provided
      if (trackingInfo?.organisationId) {
        UsageTrackingService.trackLeadScrapeApiCall(trackingInfo.organisationId, {
          job_id: trackingInfo.jobId,
          step_number: trackingInfo.stepNumber,
          lead_id: trackingInfo.leadId,
          url: url
        }).catch(err => console.error('[UsageTracking] Failed to track Firecrawl API call:', err));
      }

      // v2 API returns json data in data.json
      const jsonData = response.data.data?.json || response.data.data || {};

      // Return with metadata if requested
      if (includeMetadata) {
        return {
          json: jsonData,
          metadata: response.data.data?.metadata || {}
        };
      }

      return jsonData;
    } catch (error) {
      lastError = error;
      console.error(`[LeadScrapeFirecrawl] Attempt ${attempt + 1} failed:`, error.message);

      // Log response data for debugging
      if (error.response?.data) {
        console.error(`[LeadScrapeFirecrawl] Error details:`, JSON.stringify(error.response.data, null, 2));
      }

      // Check if retryable
      const isRetryable = error.message.includes('TIMEOUT') ||
                          error.message.includes('rate') ||
                          error.code === 'ECONNRESET' ||
                          error.response?.status >= 500;

      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw lastError;
}

/**
 * Build UberEats category URL
 */
function buildCategoryUrl(country, cityCode, regionCode, cuisine, pageOffset = 1) {
  return `https://www.ubereats.com/${country}/category/${cityCode}-${regionCode}/${cuisine.toLowerCase()}?page=${pageOffset}`;
}

/**
 * Build Google search URL
 */
function buildGoogleSearchUrl(restaurantName, address) {
  const query = `${restaurantName} ${address || ''}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Build social media search URL
 */
function buildSocialSearchUrl(restaurantName, city) {
  const query = `${restaurantName} ${city || ''} instagram OR facebook`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// ============================================================================
// STEP PROCESSING FUNCTIONS
// ============================================================================

/**
 * Process Step 1: Category Page Scan
 * Extracts restaurant names and store URLs from UberEats category pages
 * Supports parallel scraping for UberEats when leads_limit > 21
 */
async function processStep1(jobId, job) {
  const client = getSupabaseClient();
  console.log(`[LeadScrapeFirecrawl] Starting Step 1 for job ${jobId}`);

  try {
    // Update step 1 status to in_progress
    await client
      .from('lead_scrape_job_steps')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 1);

    let allRestaurants = [];

    // Check if parallel scraping should be used (UberEats only with leads_limit > UBEREATS_ITEMS_PER_PAGE)
    const isUberEats = job.platform?.toLowerCase() === 'ubereats';
    const shouldUseParallelScraping = isUberEats && job.leads_limit > UBEREATS_ITEMS_PER_PAGE;

    if (shouldUseParallelScraping) {
      // PARALLEL SCRAPING: Multiple pages for UberEats
      const pagesNeeded = calculatePagesNeeded(job.leads_limit);
      const pageNumbers = generatePageNumbers(job.page_offset, pagesNeeded);

      console.log(`[LeadScrapeFirecrawl] UberEats parallel scrape - Leads limit: ${job.leads_limit}, Pages to scrape: ${pagesNeeded} (pages ${pageNumbers.join(', ')})`);

      // Build URLs for all pages
      const urls = pageNumbers.map(pageNum => ({
        pageNum,
        url: buildCategoryUrl(
          job.country,
          job.city_code,
          job.region_code,
          job.cuisine,
          pageNum
        )
      }));

      // Execute parallel requests (respecting concurrency limit)
      for (let i = 0; i < urls.length; i += FIRECRAWL_CONCURRENCY_LIMIT) {
        const batch = urls.slice(i, i + FIRECRAWL_CONCURRENCY_LIMIT);

        console.log(`[LeadScrapeFirecrawl] Scraping batch: pages ${batch.map(u => u.pageNum).join(', ')}`);

        const batchResults = await Promise.allSettled(
          batch.map(async ({ pageNum, url }) => {
            console.log(`[LeadScrapeFirecrawl] Extracting page ${pageNum}: ${url}`);

            const result = await firecrawlRequest(url, STEP_1_PROMPT, STEP_1_SCHEMA, {
              timeout: 120000,
              waitFor: 5000,
              onlyMainContent: false
            }, {
              organisationId: job.organisation_id,
              jobId: jobId,
              stepNumber: 1
            });

            return {
              pageNum,
              restaurants: result.restaurants || []
            };
          })
        );

        // Collect successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            console.log(`[LeadScrapeFirecrawl] Page ${result.value.pageNum}: Found ${result.value.restaurants.length} restaurants`);
            allRestaurants = allRestaurants.concat(result.value.restaurants);
          } else {
            console.error(`[LeadScrapeFirecrawl] Page scrape failed:`, result.reason);
          }
        }
      }

      console.log(`[LeadScrapeFirecrawl] Total restaurants from ${pagesNeeded} pages: ${allRestaurants.length}`);

    } else {
      // SINGLE PAGE SCRAPING: Default behavior for non-UberEats or small limits
      const url = buildCategoryUrl(
        job.country,
        job.city_code,
        job.region_code,
        job.cuisine,
        job.page_offset
      );

      console.log(`[LeadScrapeFirecrawl] Single page scrape: ${url}`);

      const result = await firecrawlRequest(url, STEP_1_PROMPT, STEP_1_SCHEMA, {
        timeout: 120000,
        waitFor: 5000,
        onlyMainContent: false
      }, {
        organisationId: job.organisation_id,
        jobId: jobId,
        stepNumber: 1
      });

      allRestaurants = result.restaurants || [];
      console.log(`[LeadScrapeFirecrawl] Found ${allRestaurants.length} restaurants`);
    }

    const restaurants = allRestaurants;

    // Validate and clean data
    const validRestaurants = restaurants
      .filter(r => r.restaurant_name && r.store_link)
      .filter(r => r.store_link.includes('ubereats.com') && r.store_link.includes('/store/'))
      .map(r => ({
        restaurant_name: r.restaurant_name.trim(),
        store_link: r.store_link.trim()
      }));

    // Filter out excluded chains (non-ICP fast food)
    const icpRestaurants = validRestaurants.filter(r => {
      const excluded = isExcludedChain(r.restaurant_name);
      if (excluded) {
        console.log(`[LeadScrapeFirecrawl] Excluding chain: ${r.restaurant_name}`);
      }
      return !excluded;
    });

    const excludedCount = validRestaurants.length - icpRestaurants.length;
    if (excludedCount > 0) {
      console.log(`[LeadScrapeFirecrawl] Excluded ${excludedCount} non-ICP chains`);
    }

    // Deduplicate by store_link (within this job)
    const uniqueRestaurants = [...new Map(
      icpRestaurants.map(r => [r.store_link, r])
    ).values()];

    // Deduplicate globally against all existing leads in the same organisation
    const { unique: globallyUniqueRestaurants, duplicateCount: globalDuplicateCount } =
      await filterGlobalDuplicates(uniqueRestaurants, job.organisation_id);

    if (globalDuplicateCount > 0) {
      console.log(`[LeadScrapeFirecrawl] Excluded ${globalDuplicateCount} global duplicates (already exist in leads table)`);
    }

    // Apply leads_limit
    const limitedRestaurants = globallyUniqueRestaurants.slice(0, job.leads_limit);

    console.log(`[LeadScrapeFirecrawl] Creating ${limitedRestaurants.length} leads (limit: ${job.leads_limit}, excluded chains: ${excludedCount}, global duplicates: ${globalDuplicateCount})`);

    // Create lead records - keep at step 1 with 'processed' status
    // User must manually select and pass leads to step 2
    const leadsToCreate = limitedRestaurants.map(r => ({
      lead_scrape_job_id: jobId,
      organisation_id: job.organisation_id,
      restaurant_name: r.restaurant_name,
      store_link: r.store_link,
      platform: job.platform,
      country: job.country,
      city: job.city,
      current_step: 1, // Stay at step 1 - user will pass to step 2
      step_progression_status: 'processed' // Ready to be passed
    }));

    const { data: createdLeads, error: leadsError } = await client
      .from('leads')
      .insert(leadsToCreate)
      .select();

    if (leadsError) throw leadsError;

    // Update step 1 as action_required - user must select leads to pass
    await client
      .from('lead_scrape_job_steps')
      .update({
        status: 'action_required',
        leads_received: restaurants.length,
        leads_processed: createdLeads.length,
        leads_passed: 0, // No leads passed yet - user must select
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 1);

    // Update job stats - stay at step 1 until user passes leads
    await client
      .from('lead_scrape_jobs')
      .update({
        leads_extracted: createdLeads.length,
        current_step: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    return {
      success: true,
      leads_created: createdLeads.length,
      raw_count: restaurants.length,
      excluded_count: excludedCount,
      global_duplicate_count: globalDuplicateCount,
      leads: createdLeads
    };
  } catch (error) {
    console.error(`[LeadScrapeFirecrawl] Step 1 error:`, error);

    // Update step as failed
    await client
      .from('lead_scrape_job_steps')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 1);

    throw error;
  }
}

/**
 * Process Step 2: Store Page Enrichment
 * Batch extracts details from individual store pages
 */
async function processStep2(jobId, leadIds = null) {
  const client = getSupabaseClient();
  console.log(`[LeadScrapeFirecrawl] Starting Step 2 for job ${jobId}`);

  try {
    // Get job for organisation_id (needed for usage tracking)
    const { data: job } = await client
      .from('lead_scrape_jobs')
      .select('organisation_id')
      .eq('id', jobId)
      .single();
    const organisationId = job?.organisation_id;

    // Update step 2 status to in_progress
    await client
      .from('lead_scrape_job_steps')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 2);

    // Get leads to process
    let query = client
      .from('leads')
      .select('*')
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 2)
      .eq('step_progression_status', 'available');

    if (leadIds && leadIds.length > 0) {
      query = query.in('id', leadIds);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      console.log(`[LeadScrapeFirecrawl] No leads to process for Step 2`);
      return { success: true, processed: 0, failed: 0 };
    }

    console.log(`[LeadScrapeFirecrawl] Processing ${leads.length} leads in Step 2`);

    let processed = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < leads.length; i += FIRECRAWL_CONCURRENCY_LIMIT) {
      const batch = leads.slice(i, i + FIRECRAWL_CONCURRENCY_LIMIT);

      const batchResults = await Promise.allSettled(
        batch.map(async (lead) => {
          try {
            // Mark as processing
            await client
              .from('leads')
              .update({ step_progression_status: 'processing' })
              .eq('id', lead.id);

            const response = await firecrawlRequest(
              lead.store_link,
              STEP_2_PROMPT,
              STEP_2_SCHEMA,
              { timeout: 120000, waitFor: 3000, includeMetadata: true },
              { organisationId, jobId, stepNumber: 2, leadId: lead.id }
            );

            // Extract json and metadata from response
            const result = response.json;
            const metadata = response.metadata;

            // Get og:image from metadata (high-res version)
            let ogImageBase64 = null;
            const ogImageUrl = metadata.ogImage || metadata['og:image'];
            if (ogImageUrl) {
              try {
                console.log('[LeadScrapeFirecrawl] Downloading og:image from metadata:', ogImageUrl);
                const ogImageBuffer = await downloadImageToBuffer(ogImageUrl, lead.store_link);
                ogImageBase64 = `data:image/jpeg;base64,${ogImageBuffer.toString('base64')}`;
                console.log('[LeadScrapeFirecrawl] OG Image converted to base64');
              } catch (ogError) {
                console.error('[LeadScrapeFirecrawl] Failed to convert og:image:', ogError.message);
              }
            }

            // Update lead with extracted data
            await client
              .from('leads')
              .update({
                ubereats_number_of_reviews: result.number_of_reviews || null,
                ubereats_average_review_rating: result.average_review_rating || null,
                ubereats_address: cleanAddress(result.address),
                ubereats_cuisine: result.cuisine || [],
                ubereats_price_rating: result.price_rating || null,
                ubereats_og_image: ogImageBase64,
                step_progression_status: 'processed',
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);

            return { success: true, lead_id: lead.id };
          } catch (error) {
            // Mark as failed
            await client
              .from('leads')
              .update({
                step_progression_status: 'failed',
                validation_errors: [error.message],
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);

            return { success: false, lead_id: lead.id, error: error.message };
          }
        })
      );

      // Count results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          processed++;
        } else {
          failed++;
        }
      });

      // Rate limiting delay between batches
      if (i + FIRECRAWL_CONCURRENCY_LIMIT < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Count actual unique processed leads at this step (prevents double-counting on retry)
    const { count: totalProcessed } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 2)
      .in('step_progression_status', ['processed', 'passed', 'failed']);

    // Count actual failed leads at this step
    const { count: totalFailed } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 2)
      .eq('step_progression_status', 'failed');

    // Update step stats with actual counts - DON'T update leads_passed here, that's only done in passLeadsToNextStep
    await client
      .from('lead_scrape_job_steps')
      .update({
        leads_processed: totalProcessed || 0,
        leads_failed: totalFailed || 0,
        status: failed === leads.length ? 'failed' : 'action_required',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 2);

    return { success: true, processed, failed };
  } catch (error) {
    console.error(`[LeadScrapeFirecrawl] Step 2 error:`, error);
    throw error;
  }
}

/**
 * Process Step 3: Google Business Lookup
 */
async function processStep3(jobId, leadIds = null) {
  const client = getSupabaseClient();
  console.log(`[LeadScrapeFirecrawl] Starting Step 3 for job ${jobId}`);

  try {
    // Get job for organisation_id (needed for usage tracking)
    const { data: job } = await client
      .from('lead_scrape_jobs')
      .select('organisation_id')
      .eq('id', jobId)
      .single();
    const organisationId = job?.organisation_id;

    // Get leads to process
    let query = client
      .from('leads')
      .select('*')
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 3)
      .eq('step_progression_status', 'available');

    if (leadIds && leadIds.length > 0) {
      query = query.in('id', leadIds);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return { success: true, processed: 0, failed: 0 };
    }

    console.log(`[LeadScrapeFirecrawl] Processing ${leads.length} leads in Step 3`);

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < leads.length; i += FIRECRAWL_CONCURRENCY_LIMIT) {
      const batch = leads.slice(i, i + FIRECRAWL_CONCURRENCY_LIMIT);

      const batchResults = await Promise.allSettled(
        batch.map(async (lead) => {
          try {
            await client
              .from('leads')
              .update({ step_progression_status: 'processing' })
              .eq('id', lead.id);

            const searchUrl = buildGoogleSearchUrl(
              lead.restaurant_name,
              lead.ubereats_address || lead.city
            );

            const result = await firecrawlRequest(
              searchUrl,
              STEP_3_PROMPT,
              STEP_3_SCHEMA,
              { timeout: 60000, waitFor: 3000 },
              { organisationId, jobId, stepNumber: 3, leadId: lead.id }
            );

            // Clean and validate extracted data
            const cleanedInstagram = cleanInstagramUrl(result.instagram_url);
            const cleanedFacebook = cleanFacebookUrl(result.facebook_url);
            const cleanedWebsite = cleanWebsiteUrl(result.website_url);
            const cleanedReviewCount = cleanReviewCount(result.google_reviews_count);

            // Build update object - only include social URLs if Step 3 found them
            // (Step 4 will still run and can fill in missing social URLs)
            const updateData = {
              phone: result.phone || null,
              website_url: cleanedWebsite,
              opening_hours: result.openingHours || [], // Store array format directly
              google_address: result.google_address || null,
              google_average_review_rating: result.google_rating || null,
              google_number_of_reviews: cleanedReviewCount,
              step_progression_status: 'processed',
              updated_at: new Date().toISOString()
            };

            // Only update social URLs from Step 3 if they were found and are valid
            // This allows Step 4 to still search if Step 3 didn't find them
            if (cleanedInstagram) {
              updateData.instagram_url = cleanedInstagram;
            }
            if (cleanedFacebook) {
              updateData.facebook_url = cleanedFacebook;
            }

            await client
              .from('leads')
              .update(updateData)
              .eq('id', lead.id);

            console.log(`[LeadScrapeFirecrawl] Step 3 processed lead ${lead.id}: website=${!!cleanedWebsite}, instagram=${!!cleanedInstagram}, facebook=${!!cleanedFacebook}, reviews=${cleanedReviewCount}`);

            return { success: true, lead_id: lead.id };
          } catch (error) {
            await client
              .from('leads')
              .update({
                step_progression_status: 'failed',
                validation_errors: [error.message],
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);

            return { success: false, lead_id: lead.id, error: error.message };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          processed++;
        } else {
          failed++;
        }
      });

      if (i + FIRECRAWL_CONCURRENCY_LIMIT < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Count actual unique processed leads at this step (prevents double-counting on retry)
    const { count: totalProcessed } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 3)
      .in('step_progression_status', ['processed', 'passed', 'failed']);

    // Count actual failed leads at this step
    const { count: totalFailed } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 3)
      .eq('step_progression_status', 'failed');

    // Update step stats with actual counts - DON'T update leads_passed here, that's only done in passLeadsToNextStep
    await client
      .from('lead_scrape_job_steps')
      .update({
        leads_processed: totalProcessed || 0,
        leads_failed: totalFailed || 0,
        status: failed === leads.length ? 'failed' : 'action_required',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 3);

    return { success: true, processed, failed };
  } catch (error) {
    console.error(`[LeadScrapeFirecrawl] Step 3 error:`, error);
    throw error;
  }
}

/**
 * Identify the ordering platform from a URL
 * @param {string} url - The ordering URL to identify
 * @returns {string} Platform name or 'Custom (website)' if unknown
 */
function identifyOrderingPlatform(url) {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  // Check against known platforms
  for (const [domain, platformName] of Object.entries(KNOWN_ORDERING_PLATFORMS)) {
    if (urlLower.includes(domain)) {
      return platformName;
    }
  }

  // If not a known platform but is a valid URL, it's likely custom website ordering
  return 'Custom (website)';
}

/**
 * Check if a URL is from an excluded delivery aggregator
 * @param {string} url - The URL to check
 * @returns {boolean} True if URL should be excluded
 */
function isExcludedOrderingDomain(url) {
  if (!url) return false;

  const urlLower = url.toLowerCase();
  return EXCLUDED_ORDERING_DOMAINS.some(domain => urlLower.includes(domain));
}

/**
 * Select the best ordering link from extracted links
 * Priority: header/navigation > hero > body > footer
 * Also filters out excluded domains
 * @param {Array} links - Array of ordering link objects
 * @returns {Object|null} Best ordering link or null
 */
function selectBestOrderingLink(links) {
  if (!links || !Array.isArray(links) || links.length === 0) return null;

  // Filter out excluded domains (UberEats, DoorDash, etc.)
  const validLinks = links.filter(link => link.url && !isExcludedOrderingDomain(link.url));

  if (validLinks.length === 0) return null;

  // Priority order for link locations
  const priorityOrder = ['header', 'navigation', 'hero', 'body', 'footer'];

  // Sort by location priority
  validLinks.sort((a, b) => {
    const aLocation = (a.location || '').toLowerCase();
    const bLocation = (b.location || '').toLowerCase();
    const aIdx = priorityOrder.findIndex(p => aLocation.includes(p));
    const bIdx = priorityOrder.findIndex(p => bLocation.includes(p));
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return validLinks[0];
}

/**
 * Process Step 4: Ordering Platform Discovery
 * Scrapes restaurant websites to find online ordering links/platforms
 */
async function processStep4(jobId, leadIds = null) {
  const client = getSupabaseClient();
  console.log(`[LeadScrapeFirecrawl] Starting Step 4 (Ordering Platform Discovery) for job ${jobId}`);

  try {
    // Get job for organisation_id (needed for usage tracking)
    const { data: job } = await client
      .from('lead_scrape_jobs')
      .select('organisation_id')
      .eq('id', jobId)
      .single();
    const organisationId = job?.organisation_id;

    let query = client
      .from('leads')
      .select('*')
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 4)
      .eq('step_progression_status', 'available');

    if (leadIds && leadIds.length > 0) {
      query = query.in('id', leadIds);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return { success: true, processed: 0, failed: 0 };
    }

    console.log(`[LeadScrapeFirecrawl] Processing ${leads.length} leads in Step 4`);

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < leads.length; i += FIRECRAWL_CONCURRENCY_LIMIT) {
      const batch = leads.slice(i, i + FIRECRAWL_CONCURRENCY_LIMIT);

      const batchResults = await Promise.allSettled(
        batch.map(async (lead) => {
          try {
            await client
              .from('leads')
              .update({ step_progression_status: 'processing' })
              .eq('id', lead.id);

            let orderingPlatformUrl = null;
            let orderingPlatformName = null;
            let orderingSource = 'not_found';

            // Only attempt to find ordering URL if we have a website
            if (lead.website_url) {
              try {
                // Scrape the restaurant's website for ordering links
                const result = await firecrawlRequest(
                  lead.website_url,
                  STEP_4_PROMPT,
                  STEP_4_SCHEMA,
                  { timeout: 60000, waitFor: 3000 },
                  { organisationId, jobId, stepNumber: 4, leadId: lead.id }
                );

                // Select the best ordering link from results
                const bestLink = selectBestOrderingLink(result.ordering_links);

                if (bestLink && bestLink.url) {
                  orderingPlatformUrl = bestLink.url;
                  orderingPlatformName = identifyOrderingPlatform(bestLink.url);
                  orderingSource = 'website';

                  console.log(`[LeadScrapeFirecrawl] Step 4 found ordering link for lead ${lead.id}: ${orderingPlatformName} - ${orderingPlatformUrl}`);
                } else {
                  console.log(`[LeadScrapeFirecrawl] Step 4 no ordering links found for lead ${lead.id} on website ${lead.website_url}`);
                }
              } catch (e) {
                // Website scrape failed - log but don't fail the lead
                console.log(`[LeadScrapeFirecrawl] Step 4 website scrape failed for lead ${lead.id}: ${e.message}`);
              }
            } else {
              console.log(`[LeadScrapeFirecrawl] Step 4 skipping lead ${lead.id} - no website_url`);
            }

            // Update lead with ordering platform info
            await client
              .from('leads')
              .update({
                ordering_platform_url: orderingPlatformUrl,
                ordering_platform_name: orderingPlatformName,
                ordering_source: orderingSource,
                step_progression_status: 'processed',
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);

            console.log(`[LeadScrapeFirecrawl] Step 4 processed lead ${lead.id}: platform=${orderingPlatformName || 'None'}, source=${orderingSource}`);

            return { success: true, lead_id: lead.id };
          } catch (error) {
            await client
              .from('leads')
              .update({
                step_progression_status: 'failed',
                validation_errors: [error.message],
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);

            return { success: false, lead_id: lead.id, error: error.message };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          processed++;
        } else {
          failed++;
        }
      });

      if (i + FIRECRAWL_CONCURRENCY_LIMIT < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Count actual unique processed leads at this step (prevents double-counting on retry)
    const { count: totalProcessed } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 4)
      .in('step_progression_status', ['processed', 'passed', 'failed']);

    // Count actual failed leads at this step
    const { count: totalFailed } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_scrape_job_id', jobId)
      .eq('current_step', 4)
      .eq('step_progression_status', 'failed');

    // Update step stats with actual counts - DON'T update leads_passed here, that's only done in passLeadsToNextStep
    await client
      .from('lead_scrape_job_steps')
      .update({
        leads_processed: totalProcessed || 0,
        leads_failed: totalFailed || 0,
        status: failed === leads.length ? 'failed' : 'action_required',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', 4);

    return { success: true, processed, failed };
  } catch (error) {
    console.error(`[LeadScrapeFirecrawl] Step 4 error:`, error);
    throw error;
  }
}

// ============================================================================
// VALIDATION & DEDUPLICATION
// ============================================================================

const VALIDATION_RULES = {
  step_1: {
    required: ['restaurant_name', 'store_link'],
    validators: {
      store_link: (val) => val && val.includes('ubereats.com') && val.includes('/store/')
    }
  },
  step_2: {
    required: [],
    validators: {
      ubereats_average_review_rating: (val) => !val || (val >= 0 && val <= 5),
      ubereats_cuisine: (val) => !val || Array.isArray(val)
    }
  },
  step_3: {
    required: [],
    validators: {
      phone: (val) => !val || /^(\+64|0|\+61)[0-9\s\-]{8,15}$/.test(val.replace(/\s/g, '')),
      website_url: (val) => !val || val.startsWith('http')
    }
  },
  step_4: {
    required: [],
    validators: {
      instagram_url: (val) => !val || val.includes('instagram.com'),
      facebook_url: (val) => !val || val.includes('facebook.com')
    }
  }
};

/**
 * Validate a lead for a specific step
 */
function validateLeadForStep(lead, stepNumber) {
  const rules = VALIDATION_RULES[`step_${stepNumber}`];
  if (!rules) return { is_valid: true, validation_errors: [] };

  const errors = [];

  // Check required fields
  for (const field of rules.required) {
    if (!lead[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Run validators
  for (const [field, validator] of Object.entries(rules.validators)) {
    if (!validator(lead[field])) {
      errors.push(`Invalid value for field: ${field}`);
    }
  }

  return {
    is_valid: errors.length === 0,
    validation_errors: errors
  };
}

/**
 * Check for duplicate leads
 */
async function checkForDuplicates(lead, jobId, orgId) {
  const client = getSupabaseClient();

  try {
    // Check within same job by store_link
    if (lead.store_link) {
      const { data: jobDupes } = await client
        .from('leads')
        .select('id')
        .eq('lead_scrape_job_id', jobId)
        .eq('store_link', lead.store_link)
        .neq('id', lead.id);

      if (jobDupes?.length > 0) {
        return {
          is_duplicate: true,
          duplicate_of_lead_id: jobDupes[0].id,
          duplicate_of_restaurant_id: null
        };
      }
    }

    // Check against existing restaurants by name + city
    const { data: restaurants } = await client
      .from('restaurants')
      .select('id, name')
      .eq('organisation_id', orgId)
      .ilike('name', `%${lead.restaurant_name}%`)
      .eq('city', lead.city);

    if (restaurants?.length > 0) {
      // Simple name similarity check
      const match = restaurants.find(r => {
        const similarity = calculateSimilarity(
          r.name.toLowerCase(),
          lead.restaurant_name.toLowerCase()
        );
        return similarity > 0.85;
      });

      if (match) {
        return {
          is_duplicate: true,
          duplicate_of_lead_id: null,
          duplicate_of_restaurant_id: match.id
        };
      }
    }

    return { is_duplicate: false };
  } catch (error) {
    console.error('[LeadScrapeFirecrawl] Duplicate check error:', error);
    return { is_duplicate: false };
  }
}

/**
 * Simple string similarity calculation (Jaccard-like)
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

module.exports = {
  // Step processing
  processStep1,
  processStep2,
  processStep3,
  processStep4,

  // Validation
  validateLeadForStep,
  checkForDuplicates,

  // Helpers
  buildCategoryUrl,
  buildGoogleSearchUrl,
  buildSocialSearchUrl,
  firecrawlRequest,

  // Schemas (exported for testing/customization)
  STEP_1_SCHEMA,
  STEP_2_SCHEMA,
  STEP_3_SCHEMA,
  STEP_4_SCHEMA
};
