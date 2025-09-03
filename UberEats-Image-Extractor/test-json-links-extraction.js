#!/usr/bin/env node

/**
 * Test Script 2: JSON Extraction for Menu Item Links
 * 
 * Tests using JSON extraction with schema to get menu item data AND their individual page links
 * This would allow single-pass extraction of basic data + links for detailed extraction
 * 
 * Usage: node test-json-links-extraction.js <URL> <CATEGORY_NAME>
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Get arguments
const url = process.argv[2];
const categoryName = process.argv[3] || 'Todays Special';  // Default to small category

if (!url) {
  console.error('Usage: node test-json-links-extraction.js <URL> [CATEGORY_NAME]');
  console.error('Example: node test-json-links-extraction.js https://www.ubereats.com/nz/store/romans-kitchen/... "Todays Special"');
  process.exit(1);
}

// Configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY not found in .env file');
  process.exit(1);
}

async function testJsonLinksExtraction() {
  console.log('Test Script 2: JSON Extraction for Menu Item Links');
  console.log('==================================================');
  console.log('URL:', url);
  console.log('Category:', categoryName);
  console.log('');
  console.log('This test extracts menu item data WITH their individual page URLs');
  console.log('');

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create schema that includes itemUrl field
    const schemaWithLinks = {
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
                "description": "The name of the dish as displayed on the menu" 
              },
              "dishPrice": { 
                "type": "number", 
                "description": "The price of the dish as a numerical value" 
              },
              "dishDescription": { 
                "type": "string", 
                "description": "Full description of the dish including ingredients" 
              },
              "itemUrl": {
                "type": "string",
                "description": "The URL link to this specific menu item's detail page. This should be the href attribute of the clickable menu item element."
              },
              "hasImage": {
                "type": "boolean",
                "description": "True if this menu item displays an image on the current page"
              }
            },
            "required": ["dishName", "dishPrice", "itemUrl"]
          }
        }
      },
      "required": ["categoryName", "menuItems"]
    };
    
    // Create prompt that emphasizes link extraction
    const promptWithLinks = `Extract menu items from the category "${categoryName}" on this UberEats page.
    
IMPORTANT: For each menu item, you MUST extract:
1. The dish name
2. The price 
3. The description if available
4. The LINK URL to the item's detail page - this is critical!
5. Whether the item has an image displayed

To find the item URL:
- Each menu item is clickable and leads to its detail page
- Look for the href attribute on the menu item element
- The URL typically follows pattern: /store/.../item/...
- This might be a relative URL starting with / or a full URL

Focus ONLY on the "${categoryName}" category section.
Ensure you extract the itemUrl for every single menu item - this is the most important field.`;

    // Prepare payload
    const payload = {
      url: url,
      formats: [{
        type: 'json',
        schema: schemaWithLinks,
        prompt: promptWithLinks
      }],
      onlyMainContent: true,
      waitFor: 3000,
      blockAds: true,
      timeout: 180000,
      skipTlsVerification: true,
      removeBase64Images: true,
      // Include tags that helped in previous tests
      includeTags: ['main', 'article', 'section', 'div', 'a', 'h1', 'h2', 'h3', 'span', 'button'],
      excludeTags: ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript']
    };
    
    console.log('Sending JSON extraction request to Firecrawl...');
    console.log('Schema includes: dishName, dishPrice, dishDescription, itemUrl, hasImage');
    console.log('Using includeTags/excludeTags for better extraction');
    console.log('');
    
    const startTime = Date.now();
    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 240000
      }
    );
    const elapsed = Date.now() - startTime;
    
    console.log(`Response received in ${elapsed}ms`);
    console.log('Response status:', response.data.success ? 'SUCCESS' : 'FAILED');
    
    // Save full response
    const outputFile = path.join(OUTPUT_DIR, `json-links-extraction-${categoryName.replace(/\s+/g, '-')}-${timestamp}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
    console.log(`Full response saved to: ${outputFile}`);
    console.log('');
    
    // Analyze the results
    if (response.data.success && response.data.data && response.data.data.json) {
      const result = response.data.data.json;
      
      console.log('=== Extraction Results ===');
      console.log(`Category: ${result.categoryName}`);
      console.log(`Items found: ${result.menuItems ? result.menuItems.length : 0}`);
      console.log('');
      
      if (result.menuItems && result.menuItems.length > 0) {
        // Check URL extraction success
        const itemsWithUrls = result.menuItems.filter(item => item.itemUrl);
        const itemsWithImages = result.menuItems.filter(item => item.hasImage);
        
        console.log(`Items with URLs: ${itemsWithUrls.length}/${result.menuItems.length}`);
        console.log(`Items with images: ${itemsWithImages.length}/${result.menuItems.length}`);
        console.log('');
        
        // Display all items with their URLs
        console.log('Menu Items Extracted:');
        result.menuItems.forEach((item, idx) => {
          console.log(`\n${idx + 1}. ${item.dishName} - $${item.dishPrice}`);
          if (item.dishDescription) {
            console.log(`   Description: ${item.dishDescription.substring(0, 60)}...`);
          }
          console.log(`   Has Image: ${item.hasImage ? 'Yes' : 'No'}`);
          
          if (item.itemUrl) {
            console.log(`   Item URL: ${item.itemUrl}`);
            
            // Check if it's a relative or absolute URL
            if (item.itemUrl.startsWith('/')) {
              const fullUrl = `https://www.ubereats.com${item.itemUrl}`;
              console.log(`   Full URL: ${fullUrl}`);
            }
            
            // Try to extract item ID
            const itemIdMatch = item.itemUrl.match(/\/item\/([^\/\?\#]+)/);
            if (itemIdMatch) {
              console.log(`   Item ID: ${itemIdMatch[1]}`);
            }
          } else {
            console.log(`   ⚠️  NO URL EXTRACTED`);
          }
        });
        
        // Create summary
        console.log('\n=== URL Extraction Summary ===');
        if (itemsWithUrls.length === result.menuItems.length) {
          console.log('✓ SUCCESS: All items have URLs extracted!');
          
          // Check for uniqueness
          const urls = result.menuItems.map(item => item.itemUrl).filter(Boolean);
          const uniqueUrls = [...new Set(urls)];
          if (uniqueUrls.length === urls.length) {
            console.log('✓ All URLs are unique');
          } else {
            console.log(`⚠️  Some duplicate URLs detected: ${urls.length} total, ${uniqueUrls.length} unique`);
          }
        } else if (itemsWithUrls.length > 0) {
          console.log(`⚠️  PARTIAL: Only ${itemsWithUrls.length}/${result.menuItems.length} items have URLs`);
          console.log('Items missing URLs:');
          result.menuItems.filter(item => !item.itemUrl).forEach(item => {
            console.log(`  - ${item.dishName}`);
          });
        } else {
          console.log('✗ FAILED: No URLs were extracted');
        }
        
        // Save clean results
        const cleanResults = {
          category: result.categoryName,
          totalItems: result.menuItems.length,
          itemsWithUrls: itemsWithUrls.length,
          itemsWithImages: itemsWithImages.length,
          items: result.menuItems.map(item => ({
            name: item.dishName,
            price: item.dishPrice,
            hasImage: item.hasImage,
            url: item.itemUrl,
            fullUrl: item.itemUrl && item.itemUrl.startsWith('/') 
              ? `https://www.ubereats.com${item.itemUrl}` 
              : item.itemUrl
          }))
        };
        
        const cleanFile = path.join(OUTPUT_DIR, `json-links-clean-${categoryName.replace(/\s+/g, '-')}-${timestamp}.json`);
        await fs.writeFile(cleanFile, JSON.stringify(cleanResults, null, 2));
        console.log(`\nClean results saved to: ${cleanFile}`);
        
      } else {
        console.log('No menu items found in the response');
      }
    } else {
      console.log('Failed to extract data or no JSON in response');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // Save error response
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const errorFile = path.join(OUTPUT_DIR, `json-links-extraction-error-${timestamp}.json`);
      await fs.writeFile(errorFile, JSON.stringify({
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      }, null, 2));
      console.log(`Error details saved to: ${errorFile}`);
    }
  }
}

// Run the test
testJsonLinksExtraction().catch(console.error);