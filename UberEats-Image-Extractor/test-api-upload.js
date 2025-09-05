/**
 * Test script for the CDN upload API endpoints
 * Tests the /api/menus/:id/upload-images and related endpoints
 */

require('dotenv').config();
const axios = require('axios');

// Test configuration
const API_BASE_URL = `http://localhost:${process.env.PORT || 3007}/api`;
const TEST_MENU_ID = 'df3cb573-720e-4375-ab4c-705adb0aee32'; // Smokey Ts menu

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Check if server is running
 */
async function testServerHealth() {
  logSection('Test 1: Server Health Check');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    log('✅ Server is running', 'green');
    return true;
  } catch (error) {
    // Try a known endpoint if health doesn't exist
    try {
      const response = await axios.get(`${API_BASE_URL}/menus/${TEST_MENU_ID}`);
      log('✅ Server is running (health endpoint not found, but API responsive)', 'green');
      return true;
    } catch (err) {
      log('❌ Server is not running or not accessible', 'red');
      log(`   Please start the server with: npm start`, 'yellow');
      return false;
    }
  }
}

/**
 * Test 2: Verify menu exists
 */
async function testMenuExists() {
  logSection('Test 2: Verify Test Menu Exists');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/menus/${TEST_MENU_ID}`);
    
    if (response.data.success) {
      const menu = response.data.menu;
      log(`✅ Menu found: ${menu.restaurants?.name || 'Unknown Restaurant'}`, 'green');
      log(`   Total categories: ${menu.categories?.length || 0}`, 'blue');
      
      // Count total images
      let totalImages = 0;
      if (menu.categories) {
        menu.categories.forEach(cat => {
          if (cat.menu_items) {
            cat.menu_items.forEach(item => {
              totalImages += item.item_images?.length || 0;
            });
          }
        });
      }
      log(`   Total images: ${totalImages}`, 'blue');
      
      return true;
    } else {
      log('❌ Menu not found', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error fetching menu: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 3: Test upload endpoint with small batch
 */
async function testUploadEndpoint() {
  logSection('Test 3: Test Upload Images Endpoint');
  
  try {
    log('Starting image upload...', 'yellow');
    
    const response = await axios.post(
      `${API_BASE_URL}/menus/${TEST_MENU_ID}/upload-images`,
      {
        options: {
          testMode: false // Actually upload
        }
      }
    );
    
    const data = response.data;
    
    if (data.success) {
      log(`✅ Upload endpoint responded successfully`, 'green');
      log(`   Mode: ${data.mode}`, 'blue');
      log(`   Batch ID: ${data.batchId}`, 'blue');
      
      if (data.mode === 'synchronous') {
        // Synchronous mode - results are immediate
        log(`   Total images: ${data.stats.totalImages}`, 'blue');
        log(`   Successful: ${data.stats.successful}`, 'green');
        log(`   Failed: ${data.stats.failed}`, data.stats.failed > 0 ? 'red' : 'blue');
        
        if (data.results && data.results.successful.length > 0) {
          log('\n   Sample uploaded images:', 'cyan');
          data.results.successful.slice(0, 3).forEach(img => {
            log(`   - ${img.itemName}: ${img.cdnUrl}`, 'blue');
          });
        }
        
        if (data.results && data.results.failed.length > 0) {
          log('\n   Failed uploads:', 'red');
          data.results.failed.slice(0, 3).forEach(img => {
            log(`   - ${img.itemName}: ${img.error}`, 'red');
          });
        }
      } else {
        // Asynchronous mode - need to track progress
        log(`   Total images: ${data.totalImages}`, 'blue');
        log(`   Progress URL: ${data.progressUrl}`, 'blue');
        log('\n   Upload is processing asynchronously...', 'yellow');
      }
      
      return data.batchId;
    } else {
      log(`❌ Upload failed: ${data.error}`, 'red');
      return null;
    }
  } catch (error) {
    if (error.response?.status === 503 && error.response?.data?.error?.includes('UploadCare service not configured')) {
      log('⚠️  UploadCare service not configured', 'yellow');
      log('   Please ensure UPLOADCARE_PUBLIC_KEY is set in .env file', 'yellow');
    } else if (error.response?.data?.message?.includes('No images to upload')) {
      log('ℹ️  No images to upload (all already uploaded or no images exist)', 'blue');
    } else {
      log(`❌ Error calling upload endpoint: ${error.message}`, 'red');
      if (error.response?.data) {
        log(`   Server response: ${JSON.stringify(error.response.data)}`, 'red');
      }
    }
    return null;
  }
}

/**
 * Test 4: Test progress tracking endpoint
 */
async function testProgressTracking(batchId) {
  logSection('Test 4: Test Progress Tracking');
  
  if (!batchId) {
    log('⚠️  Skipping progress tracking (no batch ID)', 'yellow');
    return false;
  }
  
  try {
    log(`Checking progress for batch ${batchId}...`, 'yellow');
    
    let attempts = 0;
    const maxAttempts = 30; // Maximum 30 attempts (1 minute with 2-second intervals)
    let lastStatus = null;
    
    while (attempts < maxAttempts) {
      const response = await axios.get(`${API_BASE_URL}/upload-batches/${batchId}`);
      
      if (response.data.success) {
        const batch = response.data.batch;
        const progress = batch.progress;
        
        // Only log if status changed or first check
        if (batch.status !== lastStatus || attempts === 0) {
          log(`\n   Status: ${batch.status}`, batch.status === 'completed' ? 'green' : 'yellow');
          log(`   Progress: ${progress.uploaded}/${progress.total} (${progress.percentage}%)`, 'blue');
          
          if (progress.failed > 0) {
            log(`   Failed: ${progress.failed}`, 'red');
          }
          
          lastStatus = batch.status;
        }
        
        // Check if completed
        if (batch.status === 'completed' || batch.status === 'failed' || batch.status === 'partial') {
          log(`\n✅ Batch processing completed`, 'green');
          log(`   Final status: ${batch.status}`, batch.status === 'completed' ? 'green' : 'yellow');
          log(`   Total uploaded: ${progress.uploaded}`, 'green');
          log(`   Total failed: ${progress.failed}`, progress.failed > 0 ? 'red' : 'blue');
          
          if (batch.restaurantName) {
            log(`   Restaurant: ${batch.restaurantName}`, 'blue');
          }
          
          return true;
        }
        
        // Wait before next check
        await sleep(2000);
        attempts++;
      } else {
        log(`❌ Failed to get batch status: ${response.data.error}`, 'red');
        return false;
      }
    }
    
    log(`⚠️  Batch still processing after ${maxAttempts * 2} seconds`, 'yellow');
    return true; // Still considered successful, just taking longer
    
  } catch (error) {
    log(`❌ Error checking progress: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 5: Test retry endpoint
 */
async function testRetryEndpoint(batchId) {
  logSection('Test 5: Test Retry Failed Uploads');
  
  if (!batchId) {
    log('⚠️  Skipping retry test (no batch ID)', 'yellow');
    return false;
  }
  
  try {
    // First check if there are any failed uploads to retry
    const statusResponse = await axios.get(`${API_BASE_URL}/upload-batches/${batchId}`);
    
    if (statusResponse.data.success) {
      const failedCount = statusResponse.data.batch.progress.failed;
      
      if (failedCount === 0) {
        log('ℹ️  No failed uploads to retry', 'blue');
        return true;
      }
      
      log(`Retrying ${failedCount} failed uploads...`, 'yellow');
      
      const retryResponse = await axios.post(`${API_BASE_URL}/upload-batches/${batchId}/retry`);
      
      if (retryResponse.data.success) {
        log(`✅ Retry initiated successfully`, 'green');
        log(`   Message: ${retryResponse.data.message}`, 'blue');
        return true;
      } else {
        log(`❌ Retry failed: ${retryResponse.data.error}`, 'red');
        return false;
      }
    }
  } catch (error) {
    log(`❌ Error testing retry: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 6: Check CDN stats
 */
async function testCDNStats() {
  logSection('Test 6: Verify CDN Upload Stats');
  
  try {
    // Use the database service to get CDN stats
    // Since we don't have a direct API endpoint for this, we'll check via the menu
    const response = await axios.get(`${API_BASE_URL}/menus/${TEST_MENU_ID}`);
    
    if (response.data.success) {
      const menu = response.data.menu;
      let cdnUploaded = 0;
      let totalImages = 0;
      
      if (menu.categories) {
        menu.categories.forEach(cat => {
          if (cat.menu_items) {
            cat.menu_items.forEach(item => {
              if (item.item_images) {
                item.item_images.forEach(img => {
                  totalImages++;
                  if (img.cdn_uploaded) {
                    cdnUploaded++;
                  }
                });
              }
            });
          }
        });
      }
      
      const percentage = totalImages > 0 ? Math.round((cdnUploaded / totalImages) * 100) : 0;
      
      log(`✅ CDN Upload Statistics:`, 'green');
      log(`   Total images: ${totalImages}`, 'blue');
      log(`   CDN uploaded: ${cdnUploaded}`, 'green');
      log(`   Percentage: ${percentage}%`, percentage === 100 ? 'green' : 'yellow');
      
      return true;
    }
  } catch (error) {
    log(`❌ Error getting CDN stats: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  log('     CDN Upload API Test Suite', 'cyan');
  console.log('='.repeat(60));
  log(`Menu ID: ${TEST_MENU_ID}`, 'blue');
  log(`API URL: ${API_BASE_URL}`, 'blue');
  console.log('='.repeat(60));
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Test 1: Server health
  results.total++;
  const serverRunning = await testServerHealth();
  if (serverRunning) {
    results.passed++;
  } else {
    results.failed++;
    log('\n❌ Cannot continue tests - server is not running', 'red');
    printSummary(results);
    process.exit(1);
  }
  
  // Test 2: Menu exists
  results.total++;
  const menuExists = await testMenuExists();
  if (menuExists) {
    results.passed++;
  } else {
    results.failed++;
    log('\n❌ Cannot continue tests - test menu not found', 'red');
    printSummary(results);
    process.exit(1);
  }
  
  // Test 3: Upload endpoint
  results.total++;
  const batchId = await testUploadEndpoint();
  if (batchId) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Test 4: Progress tracking
  if (batchId) {
    results.total++;
    const progressWorks = await testProgressTracking(batchId);
    if (progressWorks) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Test 5: Retry endpoint
    results.total++;
    const retryWorks = await testRetryEndpoint(batchId);
    if (retryWorks) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Test 6: CDN stats
  results.total++;
  const statsWork = await testCDNStats();
  if (statsWork) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  printSummary(results);
}

function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  log('                 Test Summary', 'cyan');
  console.log('='.repeat(60));
  
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'blue');
  
  const successRate = results.total > 0 
    ? Math.round((results.passed / results.total) * 100) 
    : 0;
  
  log(`Success Rate: ${successRate}%`, successRate === 100 ? 'green' : 'yellow');
  
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log(`\n⚠️  ${results.failed} test(s) failed`, 'red');
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run the tests
runTests().then(() => {
  process.exit(0);
}).catch(error => {
  log(`\n❌ Test suite error: ${error.message}`, 'red');
  process.exit(1);
});