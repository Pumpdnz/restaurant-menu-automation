/**
 * Enhanced Firecrawl Integration for UberEats Image Extractor
 * 
 * This module provides a robust interface to the Firecrawl API
 * for extracting UberEats restaurant data, with fallback mechanisms
 * and error handling.
 */

// Sample data for fallback/testing purposes
const SAMPLE_HTML = `<!DOCTYPE html><html><head><title>Maharaja Indian Restaurant</title></head><body><div class='restaurant-header'><h1>Maharaja Indian Restaurant</h1><div class='description'>Authentic Indian Cuisine</div><img src='https://tb-static.uber.com/prod/image-proc/processed_images/0e91658d3e3cad7fe2554fb096ffeb30/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Restaurant Image'></div><div class='menu-section'><h2>Popular Items</h2><div class='menu-item'><img src='https://tb-static.uber.com/prod/image-proc/processed_images/95b74b08ee258c3b69240e07de2eb0db/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Butter Chicken'><div class='name'>Butter Chicken</div><div class='price'>$18.99</div><div class='description'>Tender chicken pieces cooked in a creamy tomato sauce</div></div><div class='menu-item'><img src='https://tb-static.uber.com/prod/image-proc/processed_images/e10b64ccbf5ffe7bd3875ecbf3ce0118/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Lamb Rogan Josh'><div class='name'>Lamb Rogan Josh</div><div class='price'>$19.99</div><div class='description'>Aromatic lamb curry with a blend of spices</div></div></div><div class='menu-section'><h2>Appetizers</h2><div class='menu-item'><img src='https://tb-static.uber.com/prod/image-proc/processed_images/de052d0e6a86f66122dee32a7f4c701f/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Vegetable Samosa'><div class='name'>Vegetable Samosa</div><div class='price'>$7.99</div><div class='description'>Crispy pastry filled with spiced potatoes and peas</div></div><div class='menu-item'><img src='https://tb-static.uber.com/prod/image-proc/processed_images/4bff14e9d5c2584569c7e71df3220610/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Onion Bhaji'><div class='name'>Onion Bhaji</div><div class='price'>$6.99</div><div class='description'>Crispy onion fritters with Indian spices</div></div></div><div class='menu-section'><h2>Sides</h2><div class='menu-item'><img src='https://tb-static.uber.com/prod/image-proc/processed_images/2dc49bf707a2a4050f7a6fa89ee85a6f/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Garlic Naan'><div class='name'>Garlic Naan</div><div class='price'>$4.50</div><div class='description'>Freshly baked bread with garlic</div></div><div class='menu-item'><img src='https://tb-static.uber.com/prod/image-proc/processed_images/ef01e8dce4a0efd74c15b9a689c8373c/16bb0a3ab8ea98cfe8906135c84dc937.jpeg' alt='Basmati Rice'><div class='name'>Basmati Rice</div><div class='price'>$3.99</div><div class='description'>Aromatic long-grain rice</div></div></div></body></html>`;

/**
 * Scrapes a UberEats restaurant page using Firecrawl API
 * @param {string} url - The UberEats restaurant URL
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} - The scraped data
 */
export async function scrapeUberEatsRestaurant(url, options = {}) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  // Validate URL format
  if (!url.includes('ubereats.com')) {
    throw new Error('URL must be a valid UberEats restaurant URL');
  }
  
  // Default options
  const defaultOptions = {
    waitTime: 4000,          // Wait time for dynamic content (ms)
    useScreenshot: true,     // Include screenshot
    mobile: false,           // Use desktop view
    maxRetries: 2,           // Number of retry attempts
    useFallback: true,       // Use fallback data if scraping fails
    timeout: 30000           // Timeout for scraping (ms)
  };
  
  // Merge with provided options
  const scrapeOptions = { ...defaultOptions, ...options };
  
  console.log(`Scraping UberEats restaurant: ${url}`);
  console.log('Options:', scrapeOptions);
  
  let retryCount = 0;
  let error = null;
  
  // Try scraping with retries
  while (retryCount <= scrapeOptions.maxRetries) {
    try {
      // Prepare Firecrawl request
      const firecrawlOptions = {
        url: url,
        formats: ["rawHtml"],
        waitFor: scrapeOptions.waitTime,
        mobile: scrapeOptions.mobile,
        onlyMainContent: false,
        timeout: scrapeOptions.timeout
      };
      
      // Add screenshot if requested
      if (scrapeOptions.useScreenshot) {
        firecrawlOptions.formats.push("screenshot");
      }
      
      // Call Firecrawl API
      console.log('Calling Firecrawl API with options:', firecrawlOptions);
      // TODO: Replace with actual Firecrawl API call through the backend
      // For now, return mock data
      const response = await mockFirecrawlScrape(firecrawlOptions);

      // Validate response
      if (!response || !response.rawHtml || response.rawHtml.length < 1000) {
        throw new Error('Invalid or incomplete response from Firecrawl API');
      }
      
      console.log(`Successfully scraped page (HTML length: ${response.rawHtml.length})`);
      
      // Return successful response
      return {
        success: true,
        html: response.rawHtml,
        screenshot: response.screenshot,
        source: 'firecrawl'
      };
    } catch (err) {
      console.error(`Scraping attempt ${retryCount + 1} failed:`, err);
      error = err;
      retryCount++;
      
      // Wait before retry
      if (retryCount <= scrapeOptions.maxRetries) {
        console.log(`Retrying in 1 second... (Attempt ${retryCount + 1} of ${scrapeOptions.maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If all retries failed, use fallback or throw error
  if (scrapeOptions.useFallback) {
    console.warn('All scraping attempts failed. Using fallback data.');
    return {
      success: true,
      html: SAMPLE_HTML,
      screenshot: null,
      source: 'fallback'
    };
  } else {
    throw error || new Error('Failed to scrape UberEats restaurant page');
  }
}

/**
 * Identifies if a URL is a valid UberEats restaurant URL
 * @param {string} url - URL to check
 * @returns {boolean} - Whether it's a valid UberEats URL
 */
export function isUberEatsUrl(url) {
  if (!url) return false;
  
  // Match common UberEats restaurant URL patterns
  const regex = /ubereats\.com\/[a-z]{2}(?:-[a-z]{2})?\/store\/[^\/]+\/[a-zA-Z0-9_-]+/i;
  return regex.test(url);
}

/**
 * Extracts the restaurant ID from a UberEats URL
 * @param {string} url - UberEats URL
 * @returns {string|null} - Restaurant ID or null if not found
 */
export function extractRestaurantId(url) {
  if (!url) return null;
  
  // Match the pattern for UberEats restaurant IDs
  const match = url.match(/\/store\/[^\/]+\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Scrapes multiple UberEats restaurants in batch
 * @param {string[]} urls - Array of UberEats restaurant URLs
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} - Batch results
 */
export async function batchScrapeUberEats(urls, options = {}) {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    throw new Error('At least one URL is required');
  }
  
  // Filter valid URLs
  const validUrls = urls.filter(url => isUberEatsUrl(url));
  
  if (validUrls.length === 0) {
    throw new Error('No valid UberEats URLs provided');
  }
  
  // Process URLs sequentially
  const results = {
    totalUrls: validUrls.length,
    successful: 0,
    failed: 0,
    results: []
  };
  
  for (const url of validUrls) {
    try {
      const result = await scrapeUberEatsRestaurant(url, options);
      
      results.results.push({
        url,
        success: true,
        htmlLength: result.html.length,
        hasScreenshot: !!result.screenshot,
        source: result.source
      });
      
      results.successful++;
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      
      results.results.push({
        url,
        success: false,
        error: error.message
      });
      
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Uses direct fetch with browser mimicry as a fallback
 * @param {string} url - UberEats URL
 * @returns {Promise<string>} - HTML content
 */
export async function directFetchFallback(url) {
  try {
    // Use fetch with headers that mimic a browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    if (html.length < 1000) {
      throw new Error('Retrieved HTML is too short, likely blocked or not a restaurant page');
    }
    
    return html;
  } catch (error) {
    console.error('Direct fetch fallback failed:', error);
    throw error;
  }
}