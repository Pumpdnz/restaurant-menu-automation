#!/usr/bin/env node

/**
 * Test script for Firecrawl v1 to v2 migration
 * 
 * This script tests the key endpoints with a sample restaurant URL
 * to verify that the v2 migration is working correctly.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const SERVER_URL = 'http://localhost:3007';
const TEST_URL = 'https://www.ubereats.com/nz/store/himalaya-queenstown/jPWyo0BkQHKhAp7RbDZGiA';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function checkServerStatus() {
  log('\n1. Checking server status...', 'cyan');
  
  try {
    const response = await axios.get(`${SERVER_URL}/api/status`);
    const data = response.data;
    
    log(`✓ Server is ${data.status}`, 'green');
    log(`  Version: ${data.version}`);
    log(`  Firecrawl API Version: ${data.firecrawl.apiVersion}`, data.firecrawl.v2Enabled ? 'green' : 'yellow');
    log(`  API URL: ${data.firecrawl.apiUrl}`);
    
    if (data.firecrawl.v2Enabled) {
      log(`  Cache Max Age: ${data.firecrawl.cacheMaxAge} seconds`);
    }
    
    return data.firecrawl.v2Enabled;
  } catch (error) {
    log(`✗ Failed to check server status: ${error.message}`, 'red');
    throw error;
  }
}

async function testCategoryScanning() {
  log('\n2. Testing category scanning...', 'cyan');
  
  try {
    const startTime = Date.now();
    const response = await axios.post(`${SERVER_URL}/api/scan-categories`, {
      url: TEST_URL
    }, {
      timeout: 120000 // 2 minute timeout
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = response.data;
    
    if (data.success && data.data.categories) {
      log(`✓ Category scan successful (${duration}s)`, 'green');
      log(`  Found ${data.data.categories.length} categories:`);
      
      data.data.categories.forEach((cat, i) => {
        log(`    ${i + 1}. ${cat.name}${cat.position ? ` (position: ${cat.position})` : ''}`);
      });
      
      // Save categories for next test
      await fs.writeFile(
        path.join(OUTPUT_DIR, 'categories.json'),
        JSON.stringify(data.data, null, 2)
      );
      
      return data.data.categories;
    } else {
      throw new Error('No categories found in response');
    }
  } catch (error) {
    log(`✗ Category scan failed: ${error.message}`, 'red');
    
    if (error.response) {
      log(`  Response status: ${error.response.status}`);
      log(`  Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    throw error;
  }
}

async function testBatchExtraction(categories) {
  log('\n3. Testing batch extraction...', 'cyan');
  
  // Test with first 2 categories only for speed
  const testCategories = categories.slice(0, 2);
  log(`  Testing with ${testCategories.length} categories: ${testCategories.map(c => c.name).join(', ')}`);
  
  try {
    // Start async extraction
    const startTime = Date.now();
    const startResponse = await axios.post(`${SERVER_URL}/api/batch-extract-categories`, {
      url: TEST_URL,
      categories: testCategories,
      async: true
    }, {
      timeout: 30000
    });
    
    if (!startResponse.data.success || !startResponse.data.jobId) {
      throw new Error('Failed to start batch extraction job');
    }
    
    const jobId = startResponse.data.jobId;
    const estimatedTime = startResponse.data.estimatedTime;
    
    log(`✓ Batch extraction job started`, 'green');
    log(`  Job ID: ${jobId}`);
    log(`  Estimated time: ${estimatedTime} seconds`);
    
    // Poll for completion
    log('  Polling for completion...', 'yellow');
    
    let completed = false;
    let status = null;
    let pollCount = 0;
    const maxPolls = 20; // Max 5 minutes with 15 second intervals
    
    while (!completed && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
      pollCount++;
      
      try {
        const statusResponse = await axios.get(`${SERVER_URL}/api/batch-extract-status/${jobId}`);
        status = statusResponse.data;
        
        if (status.status === 'completed' || status.status === 'failed') {
          completed = true;
        } else {
          log(`    Progress: ${status.progress.percentage}% - ${status.progress.currentCategory || 'Processing...'}`, 'yellow');
        }
      } catch (error) {
        log(`    Warning: Failed to check status: ${error.message}`, 'yellow');
      }
    }
    
    if (!completed) {
      throw new Error('Extraction timed out after 5 minutes');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (status.status === 'failed') {
      throw new Error(`Extraction failed: ${status.error}`);
    }
    
    // Get results
    const resultsResponse = await axios.get(`${SERVER_URL}/api/batch-extract-results/${jobId}`);
    const results = resultsResponse.data;
    
    if (results.success && results.data && results.data.menuItems) {
      log(`✓ Batch extraction completed (${duration}s)`, 'green');
      log(`  Extracted ${results.data.menuItems.length} menu items`);
      
      // Show category breakdown
      const categoryBreakdown = {};
      results.data.menuItems.forEach(item => {
        const cat = item.categoryName || 'Unknown';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });
      
      Object.entries(categoryBreakdown).forEach(([cat, count]) => {
        log(`    ${cat}: ${count} items`);
      });
      
      // Save results
      await fs.writeFile(
        path.join(OUTPUT_DIR, 'extraction-results.json'),
        JSON.stringify(results.data, null, 2)
      );
      
      return results.data;
    } else {
      throw new Error('No menu items in results');
    }
  } catch (error) {
    log(`✗ Batch extraction failed: ${error.message}`, 'red');
    
    if (error.response) {
      log(`  Response status: ${error.response.status}`);
      log(`  Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    throw error;
  }
}

async function testCSVGeneration(extractionData) {
  log('\n4. Testing CSV generation...', 'cyan');
  
  // Add restaurant info for proper naming
  const dataWithInfo = {
    ...extractionData,
    restaurantInfo: {
      name: 'Test Restaurant'
    }
  };
  
  try {
    const response = await axios.post(`${SERVER_URL}/api/generate-clean-csv`, dataWithInfo);
    const data = response.data;
    
    if (data.success && data.csvDataWithImages && data.csvDataNoImages) {
      log(`✓ CSV generation successful`, 'green');
      log(`  Files generated:`);
      log(`    With images: ${data.filenameWithImages}`);
      log(`    Without images: ${data.filenameNoImages}`);
      log(`  Stats:`);
      log(`    Rows: ${data.stats.rowCount}`);
      log(`    Columns: ${data.stats.columnCount}`);
      log(`    Cleaned fields: ${data.stats.cleanedFields}`);
      
      // Save CSV files
      await fs.writeFile(
        path.join(OUTPUT_DIR, data.filenameWithImages),
        data.csvDataWithImages
      );
      
      await fs.writeFile(
        path.join(OUTPUT_DIR, data.filenameNoImages),
        data.csvDataNoImages
      );
      
      return true;
    } else {
      throw new Error('CSV generation returned incomplete data');
    }
  } catch (error) {
    log(`✗ CSV generation failed: ${error.message}`, 'red');
    
    if (error.response) {
      log(`  Response status: ${error.response.status}`);
      log(`  Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    throw error;
  }
}

async function runTests() {
  log('=== Firecrawl v2 Migration Test Suite ===', 'blue');
  log(`Test URL: ${TEST_URL}`, 'blue');
  log(`Output directory: ${OUTPUT_DIR}`, 'blue');
  
  try {
    // Ensure output directory exists
    await ensureOutputDir();
    
    // 1. Check server status
    const isV2Enabled = await checkServerStatus();
    
    if (!isV2Enabled) {
      log('\n⚠️  Warning: Firecrawl v2 is not enabled!', 'yellow');
      log('Set FIRECRAWL_API_VERSION=v2 in your .env file to test v2', 'yellow');
    }
    
    // 2. Test category scanning
    const categories = await testCategoryScanning();
    
    // 3. Test batch extraction
    const extractionData = await testBatchExtraction(categories);
    
    // 4. Test CSV generation
    await testCSVGeneration(extractionData);
    
    log('\n=== All tests passed! ===', 'green');
    log(`Results saved to: ${OUTPUT_DIR}`, 'green');
    
  } catch (error) {
    log('\n=== Test suite failed ===', 'red');
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Check if server is running
async function checkServerRunning() {
  try {
    await axios.get(`${SERVER_URL}/api/status`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    log('✗ Server is not running!', 'red');
    log(`Please start the server first: cd UberEats-Image-Extractor && npm start`, 'yellow');
    process.exit(1);
  }
  
  await runTests();
})();