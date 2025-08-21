const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Sanitize function to match other agents (lowercase with hyphens)
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Configuration
const config = {
  restaurantName: process.argv[2] || 'Restaurant Name',
  city: process.argv[3] || 'City',
  selectedIndex: parseInt(process.argv[4]),
  outputDir: process.argv[5] || path.join(__dirname, '../planning/downloaded-images'),
  headless: process.env.HEADLESS === 'true' ? true : false,
  userDataDir: '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile'
};

async function extractSelectedLogo() {
  let browser;
  
  try {
    // Validate inputs
    if (isNaN(config.selectedIndex)) {
      console.error('❌ Error: Please provide a valid image index number');
      process.exit(1);
    }
    
    // Check if search metadata exists using standardized naming
    const restaurantDir = path.join(config.outputDir, `${sanitize(config.restaurantName)}-${sanitize(config.city)}`);
    const searchMetadataPath = path.join(restaurantDir, 'search-metadata.json');
    
    if (!fs.existsSync(searchMetadataPath)) {
      console.error('❌ Error: No search metadata found. Please run search-and-screenshot.cjs first.');
      process.exit(1);
    }
    
    const searchMetadata = JSON.parse(fs.readFileSync(searchMetadataPath, 'utf8'));
    
    if (config.selectedIndex >= searchMetadata.imageCount) {
      console.error(`❌ Error: Invalid index. Only ${searchMetadata.imageCount} images were found.`);
      process.exit(1);
    }
    
    console.log(`\n🎯 Extracting logo at index ${config.selectedIndex} for ${config.restaurantName} in ${config.city}`);
    console.log(`📋 Selected: ${searchMetadata.images[config.selectedIndex].alt || 'No description'}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: config.headless,
      userDataDir: config.userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    
    // Navigate to Google Images with the same search
    await page.goto('https://www.google.com/imghp', { waitUntil: 'networkidle0' });
    
    await page.waitForSelector('textarea[name="q"]', { timeout: 10000 });
    await page.type('textarea[name="q"]', searchMetadata.searchQuery);
    await page.keyboard.press('Enter');
    
    // Wait for results
    await page.waitForSelector('div[data-id]', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click on selected image
    console.log('\n🖱️  Clicking on selected image...');
    await page.evaluate((index) => {
      const images = document.querySelectorAll('div[data-id] img');
      if (images[index]) {
        images[index].click();
      }
    }, config.selectedIndex);
    
    // Wait for image panel
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract full resolution image
    console.log('🔍 Extracting full resolution image...');
    const fullResImage = await page.evaluate(() => {
      const selectors = [
        'img[jsname="kn3ccd"]',
        'img.sFlh5c.FyHeAf',
        '[data-panel-type="image"] img',
        'div[data-ved] img[src*="http"]',
        'img[src*="gstatic"]',
        'img[src*="googleusercontent"]'
      ];
      
      for (let selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.startsWith('data:') && img.src.includes('http')) {
          return {
            src: img.src,
            alt: img.alt || 'Logo image',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          };
        }
      }
      
      // Fallback: find any large image
      const allImgs = document.querySelectorAll('img');
      for (let img of allImgs) {
        if (img.src && !img.src.startsWith('data:') && 
            img.src.includes('http') && 
            (img.naturalWidth > 100 || img.width > 100)) {
          return {
            src: img.src,
            alt: img.alt || 'Logo image',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          };
        }
      }
      
      return null;
    });
    
    if (fullResImage) {
      console.log('\n✅ Found full resolution image!');
      console.log(`📐 Dimensions: ${fullResImage.width}x${fullResImage.height}`);
      console.log(`🔗 URL: ${fullResImage.src}`);
      
      // Save URL
      const urlFile = path.join(restaurantDir, 'logo-url.txt');
      fs.writeFileSync(urlFile, fullResImage.src);
      console.log(`\n💾 URL saved to: ${urlFile}`);
      
      // Update/create metadata
      const metadataFile = path.join(restaurantDir, 'metadata.json');
      const metadata = {
        restaurant: config.restaurantName,
        city: config.city,
        searchQuery: searchMetadata.searchQuery,
        selectedIndex: config.selectedIndex,
        selectionReason: 'Manually selected after screenshot evaluation',
        imageUrl: fullResImage.src,
        dimensions: {
          width: fullResImage.width,
          height: fullResImage.height
        },
        searchTimestamp: searchMetadata.searchTimestamp,
        extractionTimestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
      console.log(`📊 Metadata saved to: ${metadataFile}`);
      
      console.log('\n✅ Logo extraction complete!');
      console.log('   Next step: Use download-and-analyze-logo.cjs to download and analyze colors');
    } else {
      console.log('❌ Could not extract full resolution image');
      console.log('   The image might be protected or the page structure has changed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Usage instructions
if (process.argv.length < 5) {
  console.log(`
Usage: node extract-selected-logo.cjs <restaurant-name> <city> <selected-index> [output-dir]

This script extracts the logo at the specified index after manual evaluation of the screenshot.

Examples:
  node extract-selected-logo.cjs "Artisan Cafe" "Rotorua" 3
  node extract-selected-logo.cjs "Smokey Ts" "Christchurch" 0

Note: You must run search-and-screenshot.cjs first and review the screenshot before using this script.

Environment variables:
  HEADLESS=true  - Run in headless mode (default: false)
  `);
  process.exit(1);
}

// Run the extraction
extractSelectedLogo();