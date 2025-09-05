/**
 * Test script for CSV generation with CDN data
 * Tests the /api/menus/:id/csv-with-cdn endpoint
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE_URL = `http://localhost:${process.env.PORT || 3007}/api`;
const TEST_MENU_ID = 'df3cb573-720e-4375-ab4c-705adb0aee32'; // Smokey Ts menu with CDN uploads

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

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

/**
 * Test CSV generation with CDN data
 */
async function testCSVGeneration() {
  logSection('Testing CSV Generation with CDN Data');
  
  try {
    // 1. Get JSON response to analyze structure
    log('\n1. Testing JSON response format...', 'yellow');
    const jsonResponse = await axios.get(
      `${API_BASE_URL}/menus/${TEST_MENU_ID}/csv-with-cdn`,
      { params: { format: 'json' } }
    );
    
    if (jsonResponse.data.success) {
      // Parse CSV to get data
      const csvLines = jsonResponse.data.csvData.split('\n');
      const headers = csvLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataLines = csvLines.slice(1).filter(line => line.trim());
      
      // Parse CSV data into objects
      const data = dataLines.map(line => {
        const values = line.match(/(".*?"|[^,]+)/g) || [];
        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index] ? values[index].replace(/"/g, '').trim() : '';
        });
        return item;
      });
      
      const stats = {
        totalItems: data.length,
        withCDN: 0,
        withoutCDN: 0,
        headers: headers
      };
      
      // Analyze CDN data
      data.forEach(item => {
        if (item.isCDNImage === 'TRUE') {
          stats.withCDN++;
        } else {
          stats.withoutCDN++;
        }
      });
      
      log('✅ JSON response successful', 'green');
      log(`   Total items: ${stats.totalItems}`, 'blue');
      log(`   Items with CDN images: ${stats.withCDN}`, 'green');
      log(`   Items without CDN images: ${stats.withoutCDN}`, 'yellow');
      log(`   Total headers: ${stats.headers.length}`, 'blue');
      
      // Verify headers
      const expectedHeaders = [
        'restaurantCode', 'restaurantName', 'categoryName', 'itemName',
        'itemDescription', 'itemPrice', 'isVegan', 'isVegetarian',
        'isGlutenFree', 'isHalal', 'isDairyFree', 'isNutFree',
        'containsAlcohol', 'isSpicy', 'isHealthy', 'imageURL',
        'isCDNImage', 'imageCDNID', 'imageCDNFilename', 'imageExternalURL'
      ];
      
      const hasAllHeaders = expectedHeaders.every(h => stats.headers.includes(h));
      if (hasAllHeaders) {
        log('✅ All 20 required headers present', 'green');
      } else {
        log('❌ Missing headers!', 'red');
        const missing = expectedHeaders.filter(h => !stats.headers.includes(h));
        log(`   Missing: ${missing.join(', ')}`, 'red');
      }
      
      // Show sample items
      log('\n   Sample items with CDN:', 'cyan');
      data
        .filter(item => item.isCDNImage === 'TRUE')
        .slice(0, 3)
        .forEach(item => {
          log(`   - ${item.itemName}`, 'blue');
          log(`     CDN ID: ${item.imageCDNID}`, 'blue');
          log(`     CDN Filename: ${item.imageCDNFilename}`, 'blue');
        });
      
      log('\n   Sample items without CDN:', 'cyan');
      data
        .filter(item => item.isCDNImage === 'FALSE')
        .slice(0, 3)
        .forEach(item => {
          log(`   - ${item.itemName}`, 'blue');
          log(`     Original URL: ${item.imageURL ? item.imageURL.substring(0, 50) + '...' : 'No image'}`, 'blue');
        });
      
      // 2. Test CSV download
      log('\n2. Testing CSV download format...', 'yellow');
      const csvResponse = await axios.get(
        `${API_BASE_URL}/menus/${TEST_MENU_ID}/csv-with-cdn`,
        { 
          params: { download: 'true' },
          responseType: 'text'
        }
      );
      
      // Save CSV for inspection
      const outputPath = path.join(__dirname, 'test-output', `test_menu_cdn_${Date.now()}.csv`);
      if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      }
      fs.writeFileSync(outputPath, csvResponse.data);
      
      // Parse CSV to verify structure
      const downloadedCsvLines = csvResponse.data.split('\n');
      const csvHeaders = downloadedCsvLines[0].split(',');
      const csvDataLines = downloadedCsvLines.slice(1).filter(line => line.trim());
      
      log('✅ CSV download successful', 'green');
      log(`   CSV saved to: ${outputPath}`, 'blue');
      log(`   CSV headers: ${csvHeaders.length}`, 'blue');
      log(`   CSV data rows: ${csvDataLines.length}`, 'blue');
      
      // Verify CSV headers match JSON headers
      const csvHeadersClean = csvHeaders.map(h => h.trim().replace(/"/g, ''));
      const headersMatch = expectedHeaders.every(h => csvHeadersClean.includes(h));
      
      if (headersMatch) {
        log('✅ CSV headers match expected format', 'green');
      } else {
        log('❌ CSV headers mismatch!', 'red');
      }
      
      // 3. Check data consistency
      log('\n3. Verifying data consistency...', 'yellow');
      
      // Verify imageExternalURL is always empty
      const hasExternalURLs = data.some(item => item.imageExternalURL);
      if (!hasExternalURLs) {
        log('✅ imageExternalURL correctly empty for all items', 'green');
      } else {
        log('⚠️  Some items have imageExternalURL set (should be empty)', 'yellow');
      }
      
      // Verify CDN items have all required fields
      const cdnItems = data.filter(item => item.isCDNImage === 'TRUE');
      const cdnComplete = cdnItems.every(item => 
        item.imageCDNID && item.imageCDNFilename
      );
      
      if (cdnComplete) {
        log('✅ All CDN items have required CDN fields', 'green');
      } else {
        log('⚠️  Some CDN items missing CDN fields', 'yellow');
      }
      
      // Verify non-CDN items have CDN fields empty
      const nonCdnItems = data.filter(item => item.isCDNImage === 'FALSE');
      const nonCdnCorrect = nonCdnItems.every(item => 
        !item.imageCDNID && !item.imageCDNFilename
      );
      
      if (nonCdnCorrect) {
        log('✅ Non-CDN items correctly have empty CDN fields', 'green');
      } else {
        log('⚠️  Some non-CDN items have CDN fields set', 'yellow');
      }
      
      return {
        success: true,
        totalItems: stats.totalItems,
        withCDN: stats.withCDN,
        withoutCDN: stats.withoutCDN,
        csvPath: outputPath
      };
      
    } else {
      log('❌ Failed to get CSV data', 'red');
      return { success: false };
    }
    
  } catch (error) {
    log(`❌ Error testing CSV generation: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`   Server response: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return { success: false, error: error.message };
  }
}

/**
 * Compare with original CSV endpoint
 */
async function compareWithOriginal() {
  logSection('Comparing with Original CSV Endpoint');
  
  try {
    // Get original CSV
    const originalResponse = await axios.post(
      `${API_BASE_URL}/generate-clean-csv`,
      { menuId: TEST_MENU_ID }
    );
    
    // Get CDN CSV
    const cdnResponse = await axios.get(
      `${API_BASE_URL}/menus/${TEST_MENU_ID}/csv-with-cdn`,
      { params: { format: 'json' } }
    );
    
    if (originalResponse.data.success && cdnResponse.data.success) {
      const originalItems = originalResponse.data.data.length;
      const cdnCsvLines = cdnResponse.data.csvData.split('\n').filter(line => line.trim());
      const cdnItems = cdnCsvLines.length - 1; // Minus header row
      
      log('✅ Comparison complete', 'green');
      log(`   Original CSV items: ${originalItems}`, 'blue');
      log(`   CDN CSV items: ${cdnItems}`, 'blue');
      
      if (originalItems === cdnItems) {
        log('✅ Item count matches (all items included)', 'green');
      } else {
        log(`⚠️  Item count mismatch (diff: ${Math.abs(originalItems - cdnItems)})`, 'yellow');
      }
      
      // Check that CDN version has extra columns
      const originalHeaders = originalResponse.data.headers || [];
      const cdnHeaderLine = cdnCsvLines[0];
      const cdnHeaders = cdnHeaderLine.split(',').map(h => h.trim().replace(/"/g, ''));
      const newHeaders = cdnHeaders.filter(h => !originalHeaders.includes(h));
      
      log(`\n   New CDN headers: ${newHeaders.join(', ')}`, 'cyan');
      
      return { success: true };
    }
    
  } catch (error) {
    log(`⚠️  Could not compare with original: ${error.message}`, 'yellow');
    return { success: false };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  log('     CSV with CDN Data Test Suite', 'cyan');
  console.log('='.repeat(60));
  log(`Menu ID: ${TEST_MENU_ID}`, 'blue');
  log(`API URL: ${API_BASE_URL}`, 'blue');
  console.log('='.repeat(60));
  
  // Run tests
  const csvResult = await testCSVGeneration();
  const compareResult = await compareWithOriginal();
  
  // Summary
  logSection('Test Summary');
  
  if (csvResult.success) {
    log('✅ CSV generation with CDN data working correctly', 'green');
    log(`   Total menu items: ${csvResult.totalItems}`, 'blue');
    log(`   Items with CDN uploads: ${csvResult.withCDN}`, 'green');
    log(`   Items without CDN: ${csvResult.withoutCDN}`, 'yellow');
    log(`   CSV saved to: ${csvResult.csvPath}`, 'blue');
    
    log('\n📊 CDN Coverage:', 'cyan');
    const percentage = csvResult.totalItems > 0 
      ? Math.round((csvResult.withCDN / csvResult.totalItems) * 100)
      : 0;
    log(`   ${percentage}% of items have CDN images`, percentage > 50 ? 'green' : 'yellow');
  } else {
    log('❌ CSV generation test failed', 'red');
    if (csvResult.error) {
      log(`   Error: ${csvResult.error}`, 'red');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  log('          Tests Complete', 'cyan');
  console.log('='.repeat(60));
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run tests
runTests().then(() => {
  process.exit(0);
}).catch(error => {
  log(`\n❌ Test suite error: ${error.message}`, 'red');
  process.exit(1);
});