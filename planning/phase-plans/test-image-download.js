// Script to test downloading menu item images from UberEats URLs

import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to download an image from URL
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Function to create a safe filename from dish name
function createSafeFilename(dishName, index) {
  if (!dishName) return `item_${index}`;
  
  return dishName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

// Main function to test image downloads
async function testImageDownloads() {
  try {
    // Read the scraped data
    const dataPath = join(dirname(dirname(__dirname)), 'himalaya_scrape_response.json');
    const scrapedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Create output directory
    const outputDir = join(__dirname, 'downloaded-images', 'himalaya-queenstown');
    await mkdir(outputDir, { recursive: true });
    
    console.log(`Created output directory: ${outputDir}`);
    console.log(`\nStarting download of ${scrapedData.data.menuItems.length} menu item images...\n`);
    
    // Track statistics
    const stats = {
      total: scrapedData.data.menuItems.length,
      downloaded: 0,
      failed: 0,
      noImage: 0
    };
    
    // Group items by category
    const itemsByCategory = {};
    scrapedData.data.menuItems.forEach((item, index) => {
      const category = item.categoryName || 'Uncategorized';
      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
      }
      itemsByCategory[category].push({ ...item, index });
    });
    
    // Download images by category
    for (const [categoryName, items] of Object.entries(itemsByCategory)) {
      // Create category subdirectory
      const safeCategoryName = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const categoryDir = join(outputDir, safeCategoryName);
      await mkdir(categoryDir, { recursive: true });
      
      console.log(`\nCategory: ${categoryName} (${items.length} items)`);
      console.log('─'.repeat(50));
      
      for (const item of items) {
        if (!item.imageURL || item.imageURL.includes('placeholder')) {
          console.log(`⚠️  ${item.dishName}: No image available`);
          stats.noImage++;
          continue;
        }
        
        try {
          const filename = `${createSafeFilename(item.dishName, item.index)}.jpg`;
          const filepath = join(categoryDir, filename);
          
          process.stdout.write(`📥 ${item.dishName}: Downloading...`);
          
          await downloadImage(item.imageURL, filepath);
          
          // Get file size
          const fileStats = fs.statSync(filepath);
          const fileSizeKB = (fileStats.size / 1024).toFixed(1);
          
          console.log(`\r✅ ${item.dishName}: Downloaded (${fileSizeKB} KB)`);
          stats.downloaded++;
          
        } catch (error) {
          console.log(`\r❌ ${item.dishName}: Failed - ${error.message}`);
          stats.failed++;
        }
      }
    }
    
    // Print summary
    console.log('\n' + '═'.repeat(50));
    console.log('DOWNLOAD SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Total items: ${stats.total}`);
    console.log(`✅ Downloaded: ${stats.downloaded}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`⚠️  No image: ${stats.noImage}`);
    console.log(`\nImages saved to: ${outputDir}`);
    
    // Create a mapping file for reference
    const mappingData = {
      restaurant: 'Himalaya Queenstown',
      downloadDate: new Date().toISOString(),
      stats: stats,
      items: scrapedData.data.menuItems.map((item, index) => ({
        dishName: item.dishName,
        categoryName: item.categoryName,
        originalUrl: item.imageURL,
        localPath: item.imageURL && !item.imageURL.includes('placeholder') 
          ? `${item.categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}/${createSafeFilename(item.dishName, index)}.jpg`
          : null
      }))
    };
    
    const mappingPath = join(outputDir, 'image-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));
    console.log(`\nImage mapping saved to: ${mappingPath}`);
    
  } catch (error) {
    console.error('Error in image download test:', error);
  }
}

// Run the test
console.log('🖼️  Menu Item Image Download Test');
console.log('═'.repeat(50));
testImageDownloads();