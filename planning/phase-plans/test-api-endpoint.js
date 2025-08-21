// Test script for the /api/download-images endpoint

import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testDownloadImagesEndpoint() {
  try {
    // Read the Himalaya menu data
    const dataPath = join(dirname(dirname(__dirname)), 'himalaya_scrape_response.json');
    const scrapedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log('🧪 Testing /api/download-images endpoint');
    console.log('═'.repeat(50));
    
    // Prepare request payload
    const payload = {
      data: scrapedData.data,
      options: {
        outputPath: './downloads/himalaya-test-' + Date.now(),
        groupByCategory: true,
        skipPlaceholders: true
      }
    };
    
    console.log(`\n📤 Sending request to http://localhost:3007/api/download-images`);
    console.log(`   - Menu items: ${payload.data.menuItems.length}`);
    console.log(`   - Output path: ${payload.options.outputPath}`);
    console.log(`   - Group by category: ${payload.options.groupByCategory}`);
    console.log(`   - Skip placeholders: ${payload.options.skipPlaceholders}`);
    
    // Make the API request
    const response = await fetch('http://localhost:3007/api/download-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`\n📥 Response status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ Download completed successfully!');
      console.log('═'.repeat(50));
      console.log('Statistics:');
      console.log(`  - Total items: ${result.stats.total}`);
      console.log(`  - Downloaded: ${result.stats.downloaded}`);
      console.log(`  - Failed: ${result.stats.failed}`);
      console.log(`  - No image: ${result.stats.noImage}`);
      console.log(`\n📁 Download path: ${result.downloadPath}`);
      console.log(`📄 Mapping file: ${result.mappingFile}`);
      
      // Verify the mapping file exists
      const mappingPath = join(dirname(dirname(__dirname)), 'automation', 'UberEats-Image-Extractor', result.mappingFile);
      if (fs.existsSync(mappingPath)) {
        console.log('\n✅ Mapping file verified to exist');
        
        // Read and display first few entries
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`\n📋 First 3 downloaded items:`);
        mapping.items
          .filter(item => item.status === 'success')
          .slice(0, 3)
          .forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.dishName} → ${item.localPath}`);
          });
      } else {
        console.log('\n⚠️  Warning: Mapping file not found at expected location');
      }
      
    } else {
      console.log('\n❌ Download failed!');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Check if server is running
async function checkServerStatus() {
  try {
    // Try to fetch the root endpoint instead
    const response = await fetch('http://localhost:3007/');
    console.log('✅ Server is running on port 3007\n');
    return true;
  } catch (error) {
    console.log('❌ Server is not running on port 3007');
    console.log('   Please start the server with: cd automation/UberEats-Image-Extractor && npm start\n');
    return false;
  }
}

// Run the test
async function main() {
  console.log('🚀 API Endpoint Test for Image Downloads');
  console.log('═'.repeat(50));
  
  const serverRunning = await checkServerStatus();
  if (serverRunning) {
    await testDownloadImagesEndpoint();
  }
}

main();