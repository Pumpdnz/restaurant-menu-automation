#!/usr/bin/env node

/**
 * Test Script: Modal URL Direct Access
 * 
 * Tests if Firecrawl can access the quickView modal URLs directly
 * and extract high-resolution images from individual item pages
 * 
 * Usage: node test-modal-access.js
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

if (!FIRECRAWL_API_KEY) {
  console.error('Error: FIRECRAWL_API_KEY not found in .env file');
  process.exit(1);
}

// Test URLs from previous extraction - items likely to have option sets
const TEST_ITEMS = [
  {
    name: "Pepper Steak and Chips",
    category: "Steak",
    hasImage: true,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g?mod=quickView&modctx=%257B%2522storeUuid%2522%253A%252204edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6%2522%252C%2522sectionUuid%2522%253A%2522a99bcc3b-6024-4358-a844-a5e8bf910890%2522%252C%2522subsectionUuid%2522%253A%2522556a657a-a6d1-5286-9029-a1061fcf5e1c%2522%252C%2522itemUuid%2522%253A%252294cc2817-97e2-4b63-956d-7e13f9ed65dd%2522%252C%2522showSeeDetailsCTA%2522%253Atrue%257D&ps=1"
  },
  {
    name: "Steak and Chips with Mushroom Sauce",
    category: "Steak",
    hasImage: false,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g?mod=quickView&modctx=%257B%2522storeUuid%2522%253A%252204edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6%2522%252C%2522sectionUuid%2522%253A%2522a99bcc3b-6024-4358-a844-a5e8bf910890%2522%252C%2522subsectionUuid%2522%253A%25228744b49c-7221-4e3f-b022-d7abef48fec1%2522%252C%2522itemUuid%2522%253A%2522cd29bc39-e84f-4c27-b2cd-80e77729de5d%2522%252C%2522showSeeDetailsCTA%2522%253Atrue%257D&ps=1"
  },
  {
    name: "Steak and Chips with Cream Sauce",
    category: "Steak",
    hasImage: false,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g?mod=quickView&modctx=%257B%2522storeUuid%2522%253A%252204edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6%2522%252C%2522sectionUuid%2522%253A%2522a99bcc3b-6024-4358-a844-a5e8bf910890%2522%252C%2522subsectionUuid%2522%253A%25228744b49c-7221-4e3f-b022-d7abef48fec1%2522%252C%2522itemUuid%2522%253A%2522e3b0d43b-dcb6-4fda-a719-ab8e31eeb06f%2522%252C%2522showSeeDetailsCTA%2522%253Atrue%257D&ps=1"
  },
  {
    name: "Curly Fries",
    category: "Sides",
    hasImage: false,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g?mod=quickView&modctx=%257B%2522storeUuid%2522%253A%252204edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6%2522%252C%2522sectionUuid%2522%253A%2522a99bcc3b-6024-4358-a844-a5e8bf910890%2522%252C%2522subsectionUuid%2522%253A%25227ec2abe1-ea92-4378-a25b-022f8b0a65e4%2522%252C%2522itemUuid%2522%253A%25223f7ae0ab-bbd4-45ed-8ab2-8cc0cc390a79%2522%252C%2522showSeeDetailsCTA%2522%253Atrue%257D&ps=1"
  },
  {
    name: "Waffle Fries Loaded Macaroni and Cheese",
    category: "Macaroni and Cheese and Fries",
    hasImage: true,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g?mod=quickView&modctx=%257B%2522storeUuid%2522%253A%252204edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6%2522%252C%2522sectionUuid%2522%253A%2522a99bcc3b-6024-4358-a844-a5e8bf910890%2522%252C%2522subsectionUuid%2522%253A%2522ffdee9cd-f51d-4e75-8466-d4902ac82c2e%2522%252C%2522itemUuid%2522%253A%252259213ac2-1e8e-4585-bb93-daa49f21b685%2522%252C%2522showSeeDetailsCTA%2522%253Atrue%257D&ps=1"
  },
  {
    name: "Curly Fries Loaded Macaroni and Cheese",
    category: "Macaroni and Cheese and Fries",
    hasImage: false,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g?mod=quickView&modctx=%257B%2522storeUuid%2522%253A%252204edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6%2522%252C%2522sectionUuid%2522%253A%2522a99bcc3b-6024-4358-a844-a5e8bf910890%2522%252C%2522subsectionUuid%2522%253A%2522ffdee9cd-f51d-4e75-8466-d4902ac82c2e%2522%252C%2522itemUuid%2522%253A%2522a8ebda66-1663-428b-9744-b9299887581f%2522%252C%2522showSeeDetailsCTA%2522%253Atrue%257D&ps=1"
  }  
];

async function testModalAccess(item) {
  console.log(`\n=== Testing: ${item.name} ===`);
  console.log(`Category: ${item.category}`);
  console.log(`Expected to have image: ${item.hasImage ? 'Yes' : 'No'}`);
  console.log(`Expected to have option sets: ${item.hasOptionSets ? 'Yes' : 'No'}`);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  console.log('\nAccessing modal URL with click action to dismiss address popup...');
  
  // Enhanced schema for detailed extraction
  const modalSchema = {
    "type": "object",
    "properties": {
      "itemName": {
        "type": "string",
        "description": "The name of the menu item"
      },
      "price": {
        "type": "string",
        "description": "The base price of the item (e.g., '$12.99')"
      },
      "priceValue": {
        "type": "number",
        "description": "Numeric price value in dollars"
      },
      "description": {
        "type": "string",
        "description": "Full description of the item"
      },
      "imageUrl": {
        "type": "string",
        "description": "The high-resolution image URL for this item"
      },
      "hasImage": {
        "type": "boolean",
        "description": "Whether the item has an actual product image (not a placeholder)"
      },
      "optionSets": {
        "type": "array",
        "description": "Customization option sets for this item",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Name of the option set (e.g., 'Choose your size', 'Select toppings')"
            },
            "description": {
              "type": "string",
              "description": "Optional description of the option set"
            },
            "required": {
              "type": "boolean",
              "description": "Whether this option set must be selected"
            },
            "minSelections": {
              "type": "number",
              "description": "Minimum number of selections required (0 if optional)"
            },
            "maxSelections": {
              "type": "number",
              "description": "Maximum selections allowed (e.g., Choose 1, Choose up to 3)"
            },
            "options": {
              "type": "array",
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
      }
    },
    "required": ["itemName", "price", "priceValue"]
  };
  
  const modalPrompt = `Extract complete menu item details from this modal dialog.

For the main item, extract:
1. Item name (the main heading)
2. Base price (as string with $ symbol) and numeric value
3. Full description text
4. High-resolution image URL (look for the main product image, not thumbnails)
5. Whether there's an actual product image (not a placeholder)

For each customization section (option set), extract:
1. Section name (e.g., "Choose your size", "Select toppings")
2. Whether it's required or optional
3. Selection limits (min and max selections allowed)
4. For each option within the section:
   - Option name
   - Additional price (e.g., "+$2.00" or "No extra cost")
   - Numeric price value
   - Whether it's selected by default
   - Any description`;

  try {
    const modalPayload = {
      url: item.modalUrl,
      formats: [
        {
          type: 'json',
          schema: modalSchema,
          prompt: modalPrompt
        },
        'screenshot'  // Capture screenshot for debugging
      ],
      onlyMainContent: false,
      waitFor: 3000,
      blockAds: true,
      timeout: 60000,
      skipTlsVerification: true,
      actions: [
        // Wait for page to load
        {
          type: 'wait',
          milliseconds: 2000
        },
        // Take screenshot before clicking
        {
          type: 'screenshot'
        },
        // Click the X button on the address popup ONLY
        {
          type: 'click',
          selector: 'button[aria-label="Close"]'  // The X button on address popup
        },
        {
          type: 'wait',
          milliseconds: 2000
        },
        // Take screenshot after clicking to verify popup is gone
        {
          type: 'screenshot'
        }
      ]
    };
    
    console.log('Sending request to Firecrawl...');
    const startTime = Date.now();
    
    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      modalPayload,
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000
      }
    );
    const elapsed = Date.now() - startTime;
    
    console.log(`Response received in ${elapsed}ms`);
    console.log('Response status:', response.data.success ? 'SUCCESS' : 'FAILED');
    
    // Save response
    const outputFile = path.join(OUTPUT_DIR, `modal-access-${item.name.replace(/\s+/g, '-')}-${timestamp}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
    console.log(`Response saved to: ${outputFile}`);
    
    // Analyze results
    if (response.data.success && response.data.data) {
      const jsonData = response.data.data.json;
      
      if (jsonData) {
        console.log('\nExtracted Data:');
        console.log(`- Item Name: ${jsonData.itemName || 'Not found'}`);
        console.log(`- Price: ${jsonData.price || 'Not found'}`);
        console.log(`- Price Value: $${jsonData.priceValue || 0}`);
        console.log(`- Has Image: ${jsonData.hasImage ? 'Yes' : 'No'}`);
        console.log(`- Image URL: ${jsonData.imageUrl ? jsonData.imageUrl.substring(0, 80) + '...' : 'Not found'}`);
        console.log(`- Option Sets: ${jsonData.optionSets ? jsonData.optionSets.length : 0}`);
        
        if (jsonData.optionSets && jsonData.optionSets.length > 0) {
          console.log(`  Option Set Details:`);
          jsonData.optionSets.forEach(set => {
            console.log(`  - ${set.name}: ${set.options.length} options (${set.required ? 'Required' : 'Optional'})`);
          });
        }
      }
      
      // Display screenshot URLs (without saving to avoid API errors)
      if (response.data.data.screenshot) {
        console.log(`\nFinal screenshot URL: ${response.data.data.screenshot.substring(0, 80)}...`);
      }
      
      // Display action screenshot URLs (before and after clicking)
      if (response.data.data.actions && response.data.data.actions.screenshots) {
        const actionScreenshots = response.data.data.actions.screenshots;
        console.log(`\nAction screenshots captured: ${actionScreenshots.length}`);
        
        for (let i = 0; i < actionScreenshots.length; i++) {
          const screenshotData = actionScreenshots[i];
          const screenshotName = i === 0 ? 'before-click' : 'after-click';
          console.log(`  ${screenshotName}: ${screenshotData.substring(0, 80)}...`);
        }
      }
    }
    
    return {
      success: response.data.success,
      data: response.data.data?.json
    };
    
  } catch (error) {
    console.error(`Error accessing modal: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function testCleanUrl(item) {
  console.log('\nTest 2: Trying cleaned URL (without modal parameters)...');
  
  // Extract base URL and try different patterns
  const urlObj = new URL(item.modalUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  
  // Try to extract itemUuid from modctx parameter
  const modctx = urlObj.searchParams.get('modctx');
  let itemUuid = null;
  if (modctx) {
    try {
      const decoded = decodeURIComponent(modctx);
      const match = decoded.match(/"itemUuid"%3A%22([^%]+)%22/);
      if (match) {
        itemUuid = match[1];
      }
    } catch (e) {
      console.log('Could not decode modctx parameter');
    }
  }
  
  // Test different URL patterns
  const urlPatterns = [
    baseUrl,  // Just the base URL
    `${baseUrl}?item=${itemUuid}`,  // With item parameter
    `${baseUrl}/item/${itemUuid}`,  // As path segment
  ];
  
  console.log('Testing URL patterns:');
  urlPatterns.forEach((url, idx) => {
    console.log(`  ${idx + 1}. ${url}`);
  });
  
  // For brevity, just test the base URL
  const cleanUrl = baseUrl;
  console.log(`\nTesting clean URL: ${cleanUrl}`);
  
  // Similar extraction logic but for the clean URL
  // ... (abbreviated for space)
  
  return {
    success: false,
    cleanUrl: cleanUrl
  };
}

async function runTests() {
  console.log('Modal URL Direct Access Test');
  console.log('============================');
  console.log('Testing Firecrawl modal URL extraction with enhanced option sets schema');
  console.log('');
  
  const results = [];
  
  for (const item of TEST_ITEMS) {
    if (!item.modalUrl) continue;  // Skip items without URLs
    
    // Test modal access
    const modalResult = await testModalAccess(item);
    
    results.push({
      item: item.name,
      category: item.category,
      expectedImage: item.hasImage,
      expectedOptionSets: item.hasOptionSets,
      modalSuccess: modalResult.success,
      foundImage: !!modalResult.data?.imageUrl,
      hasImage: modalResult.data?.hasImage || false,
      optionSetsCount: modalResult.data?.optionSets?.length || 0
    });
    
    // Wait between tests
    if (TEST_ITEMS.indexOf(item) < TEST_ITEMS.length - 1) {
      console.log('\nWaiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log('Test Results:');
  results.forEach(r => {
    const imageStatus = r.hasImage ? '✓' : '✗';
    const optionSetsStatus = r.optionSetsCount > 0 ? '✓' : '✗';
    console.log(`  ${r.item}:`);
    console.log(`    - Modal accessed: ${r.modalSuccess ? 'Yes' : 'No'}`);
    console.log(`    - Has image: ${imageStatus} (expected: ${r.expectedImage ? 'Yes' : 'No'})`);
    console.log(`    - Option sets: ${r.optionSetsCount} found ${optionSetsStatus} (expected: ${r.expectedOptionSets ? 'Yes' : 'No'})`);
  });
  
  const successCount = results.filter(r => r.modalSuccess).length;
  const correctImageCount = results.filter(r => r.hasImage === r.expectedImage).length;
  const withOptionSets = results.filter(r => r.optionSetsCount > 0).length;
  
  console.log('\nOverall:');
  console.log(`- Successful extractions: ${successCount}/${results.length}`);
  console.log(`- Correct image detection: ${correctImageCount}/${results.length}`);
  console.log(`- Items with option sets: ${withOptionSets}/${results.length}`);
  
  // Save summary
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryFile = path.join(OUTPUT_DIR, `modal-access-summary-${timestamp}.json`);
  await fs.writeFile(summaryFile, JSON.stringify({
    timestamp: timestamp,
    results: results,
    statistics: {
      totalTested: results.length,
      successfulExtractions: successCount,
      correctImageDetection: correctImageCount,
      itemsWithOptionSets: withOptionSets
    }
  }, null, 2));
  console.log(`\nSummary saved to: ${summaryFile}`);
}

// Run tests
runTests().catch(console.error);