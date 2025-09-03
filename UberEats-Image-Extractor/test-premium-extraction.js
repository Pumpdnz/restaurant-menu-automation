#!/usr/bin/env node

/**
 * Test Script for Premium Menu Extraction Endpoint
 * 
 * Tests the new /api/extract-menu-premium endpoint
 * with option sets extraction and image validation
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const API_URL = 'http://localhost:3007';
const TEST_STORE_URL = 'https://www.ubereats.com/nz/store/romans-kitchen/BO3GLFqvTL-F8257il8P9g';
const TEST_ORG_ID = '443129c4-170f-49f1-87e6-bdcf2ae95227';  // Test organization ID
const OUTPUT_DIR = path.join(__dirname, 'test-output');

// Create a simple auth token for testing (you can modify this based on your auth setup)
const AUTH_TOKEN = 'test-token-123';

async function testPremiumExtraction() {
  console.log('=== Premium Menu Extraction Test ===');
  console.log('Store URL:', TEST_STORE_URL);
  console.log('Organization ID:', TEST_ORG_ID);
  console.log('');
  
  try {
    // Test synchronous extraction with a small menu
    console.log('1. Testing SYNCHRONOUS extraction (this will take 2-3 minutes)...');
    console.log('   Extracting with option sets and image validation enabled');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/api/extract-menu-premium`,
      {
        storeUrl: TEST_STORE_URL,
        orgId: TEST_ORG_ID,
        extractOptionSets: true,
        validateImages: true,
        async: false  // Synchronous mode for testing
      },
      {
        headers: {
          // 'Authorization': `Bearer ${AUTH_TOKEN}`,  // Auth disabled for testing
          'Content-Type': 'application/json'
        },
        timeout: 300000  // 5 minute timeout
      }
    );
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✓ Extraction completed in ${elapsedTime} seconds`);
    console.log('');
    
    // Analyze results
    if (response.data.success) {
      const { summary, categories, items, imageValidation } = response.data;
      
      console.log('=== Extraction Summary ===');
      console.log(`Total Categories: ${summary.totalCategories}`);
      console.log(`Total Items: ${summary.totalItems}`);
      console.log(`Items with Clean URLs: ${summary.itemsWithCleanUrls}`);
      console.log(`Items with Option Sets: ${summary.itemsWithOptionSets}`);
      console.log(`Unavailable Items (404): ${summary.unavailableItems}`);
      console.log('');
      
      console.log('=== Categories Found ===');
      categories.forEach((cat, idx) => {
        console.log(`  ${idx + 1}. ${cat}`);
      });
      console.log('');
      
      // Show sample items with option sets
      const itemsWithOptionSets = items.filter(item => item.hasOptionSets);
      if (itemsWithOptionSets.length > 0) {
        console.log('=== Sample Items with Option Sets ===');
        itemsWithOptionSets.slice(0, 3).forEach(item => {
          console.log(`\n${item.dishName || item.name}`);
          console.log(`  Price: $${item.dishPrice || item.price}`);
          console.log(`  Category: ${item.category}`);
          
          if (item.optionSetsData?.optionSets) {
            console.log(`  Option Sets (${item.optionSetsData.optionSets.length}):`);
            item.optionSetsData.optionSets.forEach(optSet => {
              console.log(`    - ${optSet.name} (${optSet.required ? 'Required' : 'Optional'})`);
              console.log(`      Min: ${optSet.minSelections}, Max: ${optSet.maxSelections}`);
              console.log(`      Options: ${optSet.options.length} choices`);
            });
          }
        });
      }
      console.log('');
      
      // Show image validation results
      if (imageValidation) {
        console.log('=== Image Validation Results ===');
        console.log(`Average Quality Score: ${imageValidation.averageScore}/100`);
        console.log(`Items with Images: ${imageValidation.percentages.withImages}`);
        console.log(`Placeholder Images: ${imageValidation.percentages.placeholders}`);
        console.log(`Good Quality Images: ${imageValidation.percentages.goodQuality}`);
      }
      console.log('');
      
      // Save results to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(OUTPUT_DIR, `premium-extraction-${timestamp}.json`);
      await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
      console.log(`Results saved to: ${outputFile}`);
      
    } else {
      console.log('✗ Extraction failed:', response.data.error);
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

// Test async extraction
async function testAsyncExtraction() {
  console.log('\n=== Testing ASYNC Premium Extraction ===');
  
  try {
    // Start async extraction
    console.log('Starting async extraction...');
    const startResponse = await axios.post(
      `${API_URL}/api/extract-menu-premium`,
      {
        storeUrl: TEST_STORE_URL,
        orgId: TEST_ORG_ID,
        extractOptionSets: true,
        validateImages: true,
        async: true  // Async mode
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (startResponse.data.success) {
      const { jobId, estimatedTime, statusUrl, resultsUrl } = startResponse.data;
      
      console.log(`✓ Job started: ${jobId}`);
      console.log(`  Estimated time: ${estimatedTime} seconds`);
      console.log(`  Status URL: ${statusUrl}`);
      console.log(`  Results URL: ${resultsUrl}`);
      console.log('');
      
      // Poll for status
      console.log('Polling for status...');
      let completed = false;
      let pollCount = 0;
      const maxPolls = 60;  // Max 5 minutes
      
      while (!completed && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000));  // Wait 5 seconds
        
        const statusResponse = await axios.get(
          `${API_URL}${statusUrl}`,
          {
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`
            }
          }
        );
        
        const status = statusResponse.data;
        pollCount++;
        
        console.log(`  [${pollCount}] Status: ${status.status}, Phase: ${status.progress.phase}`);
        console.log(`       Items extracted: ${status.progress.itemsExtracted}, Option sets: ${status.progress.optionSetsExtracted}`);
        
        if (status.status === 'completed' || status.status === 'failed') {
          completed = true;
          
          if (status.status === 'completed') {
            // Get results
            console.log('\n✓ Extraction completed! Getting results...');
            const resultsResponse = await axios.get(
              `${API_URL}${resultsUrl}`,
              {
                headers: {
                  'Authorization': `Bearer ${AUTH_TOKEN}`
                }
              }
            );
            
            const results = resultsResponse.data;
            if (results.success) {
              console.log('Results retrieved successfully');
              console.log(`Total items: ${results.summary.totalItems}`);
              console.log(`Items with option sets: ${results.summary.itemsWithOptionSets}`);
              
              // Save async results
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const outputFile = path.join(OUTPUT_DIR, `premium-extraction-async-${timestamp}.json`);
              await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
              console.log(`Async results saved to: ${outputFile}`);
            }
          } else {
            console.log('✗ Extraction failed:', status.error);
          }
        }
      }
      
      if (!completed) {
        console.log('✗ Timeout waiting for extraction to complete');
      }
      
    } else {
      console.log('✗ Failed to start async extraction:', startResponse.data.error);
    }
    
  } catch (error) {
    console.error('Error during async test:', error.message);
  }
}

// Run tests
async function runTests() {
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // Run synchronous test first (smaller, faster)
  await testPremiumExtraction();
  
  // Then run async test
  // await testAsyncExtraction();  // Uncomment to test async mode
  
  console.log('\n=== All Tests Complete ===');
}

// Execute tests
runTests().catch(console.error);