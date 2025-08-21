// services/ubereats-service.js - Service for interacting with the extraction API
/**
 * Service for UberEats data extraction
 * Updated to use Express API endpoints instead of direct Firecrawl calls
 */

import { UberEatsImageExtractor } from '../utils/ubereats-extractor';

/**
 * Process an UberEats URL to extract menu items, images, and categories
 * @param {string} url - UberEats restaurant URL
 * @returns {Promise<Object>} - Extraction results
 */
export async function processUberEatsUrl(url) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  try {
    console.log(`Processing UberEats URL: ${url}`);
    
    // Use the Express server API endpoint with relative URL (webpack proxy will handle routing)
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('API response received');
    
    // Check if the API returned successfully with data
    if (!result.success || !result.data || !result.data.rawHtml) {
      throw new Error('Failed to retrieve HTML content from API');
    }
    
    const html = result.data.rawHtml;
    
    // Process the HTML
    const extractor = new UberEatsImageExtractor();
    const data = extractor.processHtml(html);
    
    return {
      success: true,
      data: data,
      screenshot: result.data.screenshot || null
    };
  } catch (error) {
    console.error('Error processing UberEats URL:', error);
    
    // Try using direct scraping endpoint as a fallback
    try {
      console.log('Attempting fallback to direct scraping endpoint');
      
      // Use relative URL for the fallback API as well
      const fallbackResponse = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      
      if (!fallbackResponse.ok) {
        throw new Error(`Fallback API request failed with status: ${fallbackResponse.status}`);
      }
      
      const fallbackResult = await fallbackResponse.json();
      
      if (!fallbackResult.success || !fallbackResult.data || !fallbackResult.data.rawHtml) {
        throw new Error('Failed to retrieve HTML content from fallback API');
      }
      
      const fallbackHtml = fallbackResult.data.rawHtml;
      
      // Process the fallback HTML
      const extractor = new UberEatsImageExtractor();
      const fallbackData = extractor.processHtml(fallbackHtml);
      
      return {
        success: true,
        data: fallbackData,
        screenshot: null,
        usingFallback: true
      };
    } catch (fallbackError) {
      console.error('Fallback scraping also failed:', fallbackError);
      
      return {
        success: false,
        error: `Primary extraction failed: ${error.message}. Fallback also failed: ${fallbackError.message}`
      };
    }
  }
}