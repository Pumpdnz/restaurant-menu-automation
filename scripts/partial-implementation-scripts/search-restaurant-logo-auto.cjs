const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration object for easy reuse
const config = {
  restaurantName: process.argv[2] || 'Restaurant Name',
  city: process.argv[3] || 'City',
  imageIndex: parseInt(process.argv[4]) || 0,
  outputDir: process.argv[5] || path.join(__dirname, '../planning/downloaded-images'),
  headless: process.env.HEADLESS === 'true' ? true : false,
  userDataDir: '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile'
};

async function searchRestaurantLogo() {
  let browser;
  
  try {
    // Create output directory
    const restaurantDir = path.join(config.outputDir, `${config.restaurantName.replace(/\s+/g, '')}-${config.city.replace(/\s+/g, '')}`);
    if (!fs.existsSync(restaurantDir)) {
      fs.mkdirSync(restaurantDir, { recursive: true });
    }

    console.log(`\n🔍 Searching for ${config.restaurantName} in ${config.city}...`);
    console.log(`📁 Output directory: ${restaurantDir}`);
    console.log(`🎯 Will select image index: ${config.imageIndex}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: config.headless,
      userDataDir: config.userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    
    // Navigate to Google Images
    await page.goto('https://www.google.com/imghp', { waitUntil: 'networkidle0' });
    
    // Perform search
    const searchQuery = `${config.restaurantName} ${config.city} Restaurant Logo site:instagram.com OR site:facebook.com`;
    console.log(`\n📝 Search query: "${searchQuery}"`);
    
    await page.waitForSelector('textarea[name="q"]', { timeout: 10000 });
    await page.type('textarea[name="q"]', searchQuery);
    await page.keyboard.press('Enter');
    
    // Wait for results
    await page.waitForSelector('div[data-id]', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot of results
    const screenshotPath = path.join(restaurantDir, 'search-results.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: false 
    });
    console.log(`\n📸 Screenshot saved to: ${screenshotPath}`);
    
    // Extract image results
    const imageResults = await page.evaluate(() => {
      const images = document.querySelectorAll('div[data-id] img');
      const results = [];
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        const img = images[i];
        results.push({
          index: i,
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
      return results;
    });
    
    if (imageResults.length === 0) {
      console.log('❌ No image results found');
      return;
    }
    
    // Display results
    console.log(`\n✅ Found ${imageResults.length} image results:\n`);
    imageResults.forEach((img, i) => {
      console.log(`[${i}] ${img.alt || 'No description'}`);
      console.log(`    Dimensions: ${img.width}x${img.height}px`);
    });
    
    // Auto-select specified image
    console.log(`\n✅ Auto-selecting image ${config.imageIndex}`);
    
    // Click on selected image
    await page.evaluate((index) => {
      const images = document.querySelectorAll('div[data-id] img');
      if (images[index]) {
        images[index].click();
      }
    }, config.imageIndex);
    
    // Wait for image panel
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract full resolution image
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
      console.log('\n🎯 Found full resolution image!');
      console.log(`📐 Dimensions: ${fullResImage.width}x${fullResImage.height}`);
      console.log(`🔗 URL: ${fullResImage.src}`);
      
      // Save URL to file for later download
      const urlFile = path.join(restaurantDir, 'logo-url.txt');
      fs.writeFileSync(urlFile, fullResImage.src);
      console.log(`\n💾 URL saved to: ${urlFile}`);
      
      // Also save metadata
      const metadataFile = path.join(restaurantDir, 'metadata.json');
      fs.writeFileSync(metadataFile, JSON.stringify({
        restaurant: config.restaurantName,
        city: config.city,
        searchQuery: searchQuery,
        selectedIndex: config.imageIndex,
        imageUrl: fullResImage.src,
        dimensions: {
          width: fullResImage.width,
          height: fullResImage.height
        },
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log(`📊 Metadata saved to: ${metadataFile}`);
    } else {
      console.log('❌ Could not extract full resolution image');
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
if (process.argv.length < 4) {
  console.log(`
Usage: node search-restaurant-logo-auto.cjs <restaurant-name> <city> <image-index> [output-dir]

This is an automated version that selects the specified image index without user interaction.

Examples:
  node search-restaurant-logo-auto.cjs "Artisan Cafe" "Rotorua" 0
  node search-restaurant-logo-auto.cjs "Smokey Ts" "Christchurch" 0 "/custom/output/path"

Environment variables:
  HEADLESS=true  - Run in headless mode (default: false)
  `);
  process.exit(1);
}

// Run the search
searchRestaurantLogo();