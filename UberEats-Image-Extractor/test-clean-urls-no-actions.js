#!/usr/bin/env node

/**
 * Test Script: Clean URLs Method
 * 
 * Converts modal URLs to direct item page URLs and tests extraction
 * 
 * Usage: node test-clean-urls.js
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

// Test items with modal URLs - using items with option sets
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

function cleanModalUrl(modalUrl) {
  console.log('\nCleaning URL...');
  console.log('Modal URL:', modalUrl.substring(0, 100) + '...');
  
  try {
    // Parse the URL
    const urlObj = new URL(modalUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    
    // Get the modctx parameter
    const modctx = urlObj.searchParams.get('modctx');
    if (!modctx) {
      console.log('No modctx parameter found');
      return null;
    }
    
    // Decode the modctx parameter
    // It's double encoded, so we need to decode twice
    let decoded = decodeURIComponent(modctx);
    console.log('First decode:', decoded.substring(0, 100) + '...');
    
    // The decoded string is still URL-encoded, decode again
    decoded = decodeURIComponent(decoded);
    console.log('Second decode:', decoded.substring(0, 100) + '...');
    
    // Now we have a JSON string, parse it
    let modctxData;
    try {
      modctxData = JSON.parse(decoded);
      console.log('Parsed modctx data:', modctxData);
    } catch (e) {
      console.log('Failed to parse modctx as JSON:', e.message);
      return null;
    }
    
    // Extract UUIDs from the parsed object
    const sectionUuid = modctxData.sectionUuid;
    const subsectionUuid = modctxData.subsectionUuid;
    const itemUuid = modctxData.itemUuid;
    
    if (!sectionUuid || !subsectionUuid || !itemUuid) {
      console.log('Could not extract all UUIDs from parsed data');
      console.log('Section:', sectionUuid);
      console.log('Subsection:', subsectionUuid);
      console.log('Item:', itemUuid);
      return null;
    }
    
    // Build the clean URL
    const cleanUrl = `${baseUrl}/${sectionUuid}/${subsectionUuid}/${itemUuid}`;
    console.log('Clean URL:', cleanUrl);
    
    return {
      modalUrl: modalUrl,
      cleanUrl: cleanUrl,
      sectionUuid: sectionUuid,
      subsectionUuid: subsectionUuid,
      itemUuid: itemUuid
    };
  } catch (error) {
    console.error('Error cleaning URL:', error.message);
    return null;
  }
}

async function testCleanUrl(item, cleanUrlData) {
  console.log(`\n=== Testing Clean URL: ${item.name} ===`);
  console.log(`Category: ${item.category}`);
  console.log(`Expected to have image: ${item.hasImage ? 'Yes' : 'No'}`);
  console.log(`Expected to have option sets: ${item.hasOptionSets ? 'Yes' : 'No'}`);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const schema = {
    "type": "object",
    "properties": {
      "itemName": {
        "type": "string",
        "description": "The name of the menu item"
      },
      "price": {
        "type": "string",
        "description": "The price of the item as a string with $ symbol"
      },
      "priceValue": {
        "type": "number",
        "description": "The numeric price value in dollars"
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
        "description": "Whether there's an actual product image (not a placeholder)"
      },
      "optionSets": {
        "type": "array",
        "description": "Customization sections for this item",
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
      },
      "pageType": {
        "type": "string",
        "description": "What type of page is this (main menu, item detail, etc)"
      }
    },
    "required": ["itemName", "price", "priceValue"]
  };
  
  const prompt = `Extract complete menu item details from this item detail page.

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

  try {
    const payload = {
      url: cleanUrlData.cleanUrl,
      formats: [
        {
          type: 'json',
          schema: schema,
          prompt: prompt
        },
        'screenshot'
      ],
      onlyMainContent: true,
      waitFor: 3000,
      blockAds: true,
      timeout: 60000,
      skipTlsVerification: true
    };
    
    console.log('Sending request to Firecrawl...');
    const startTime = Date.now();
    
    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      payload,
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
    const outputFile = path.join(OUTPUT_DIR, `clean-url-${item.name.replace(/\s+/g, '-')}-${timestamp}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
    console.log(`Response saved to: ${outputFile}`);
    
    // Analyze results
    if (response.data.success && response.data.data) {
      const jsonData = response.data.data.json;
      
      if (jsonData) {
        console.log('\nExtracted Data:');
        console.log(`- Item Name: ${jsonData.itemName || 'Not found'}`);
        console.log(`- Price: ${jsonData.price || 'Not found'} (${jsonData.priceValue ? `$${jsonData.priceValue}` : 'N/A'})`);
        console.log(`- Has Image: ${jsonData.hasImage ? 'Yes' : 'No'}`);
        console.log(`- Image URL: ${jsonData.imageUrl ? jsonData.imageUrl.substring(0, 80) + '...' : 'Not found'}`);
        console.log(`- Option Sets: ${jsonData.optionSets ? jsonData.optionSets.length : 0}`);
        console.log(`- Page Type: ${jsonData.pageType || 'Unknown'}`);
        
        if (jsonData.optionSets && jsonData.optionSets.length > 0) {
          console.log('\nOption Sets Found:');
          jsonData.optionSets.forEach(set => {
            const reqText = set.required ? 'Required' : 'Optional';
            const selText = set.maxSelections === 1 ? 'Choose 1' : `Choose up to ${set.maxSelections}`;
            console.log(`  - ${set.name} (${reqText}, ${selText}, ${set.options ? set.options.length : 0} options)`);
            if (set.options && set.options.length > 0) {
              set.options.slice(0, 3).forEach(opt => {
                console.log(`    • ${opt.name} ${opt.price}`);
              });
              if (set.options.length > 3) {
                console.log(`    ... and ${set.options.length - 3} more`);
              }
            }
          });
        }
        
        // Check if it's the right page
        if (jsonData.pageType && jsonData.pageType.includes('menu')) {
          console.log('⚠️  WARNING: This appears to be the main menu page, not item detail');
        }
      }
      
      // Log screenshot URL if available but don't save to file
      if (response.data.data.screenshot) {
        console.log(`Screenshot available at: ${response.data.data.screenshot.substring(0, 100)}...`);
      }
    }
    
    return {
      success: response.data.success,
      data: response.data.data?.json
    };
    
  } catch (error) {
    console.error(`Error accessing clean URL: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('Clean URLs Method Test');
  console.log('======================');
  console.log('Converting modal URLs to direct item page URLs');
  console.log('');
  
  const results = [];
  
  for (const item of TEST_ITEMS) {
    // Clean the URL
    const cleanUrlData = cleanModalUrl(item.modalUrl);
    
    if (!cleanUrlData) {
      console.log(`\n❌ Failed to clean URL for ${item.name}`);
      continue;
    }
    
    // Test the clean URL
    const result = await testCleanUrl(item, cleanUrlData);
    
    results.push({
      item: item.name,
      category: item.category,
      expectedImage: item.hasImage,
      expectedOptionSets: item.hasOptionSets,
      cleanUrl: cleanUrlData.cleanUrl,
      success: result.success,
      foundImage: !!result.data?.hasImage,
      foundOptionSets: result.data?.optionSets?.length > 0,
      optionSetsCount: result.data?.optionSets?.length || 0,
      pageType: result.data?.pageType
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
    const imageStatus = r.foundImage ? '✓' : '✗';
    const optionStatus = r.foundOptionSets ? `✓ (${r.optionSetsCount})` : '✗';
    console.log(`\n${r.item}:`);
    console.log(`  - Clean URL: ${r.cleanUrl.substring(0, 80)}...`);
    console.log(`  - Access successful: ${r.success ? 'Yes' : 'No'}`);
    console.log(`  - Image found: ${imageStatus} (expected: ${r.expectedImage ? 'Yes' : 'No'})`);
    console.log(`  - Option sets found: ${optionStatus} (expected: ${r.expectedOptionSets ? 'Yes' : 'No'})`);
    console.log(`  - Page type: ${r.pageType || 'Unknown'}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  const imageFoundCount = results.filter(r => r.foundImage).length;
  const optionSetsFoundCount = results.filter(r => r.foundOptionSets).length;
  const correctPageCount = results.filter(r => r.pageType && !r.pageType.includes('menu')).length;
  
  console.log('\nOverall:');
  console.log(`- URLs accessed successfully: ${successCount}/${results.length}`);
  console.log(`- Items with images found: ${imageFoundCount}/${results.filter(r => r.expectedImage).length} expected`);
  console.log(`- Items with option sets found: ${optionSetsFoundCount}/${results.filter(r => r.expectedOptionSets).length} expected`);
  console.log(`- Correct page type: ${correctPageCount}/${results.length}`);
  
  if (correctPageCount === 0) {
    console.log('\n⚠️  ISSUE: Clean URLs may not be leading to item detail pages');
    console.log('The URL pattern might need adjustment');
  } else {
    console.log('\n✓ SUCCESS: Clean URL method shows promise!');
  }
  
  // Save summary
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryFile = path.join(OUTPUT_DIR, `clean-url-summary-${timestamp}.json`);
  await fs.writeFile(summaryFile, JSON.stringify({
    timestamp: timestamp,
    results: results,
    statistics: {
      totalTested: results.length,
      successful: successCount,
      imagesFound: imageFoundCount,
      optionSetsFound: optionSetsFoundCount,
      correctPages: correctPageCount
    }
  }, null, 2));
  console.log(`\nSummary saved to: ${summaryFile}`);
}

// Run tests
runTests().catch(console.error);