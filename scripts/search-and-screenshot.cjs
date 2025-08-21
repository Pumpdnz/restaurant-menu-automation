const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Sanitize function to match other agents (lowercase with hyphens)
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Configuration object for easy reuse
const config = {
  restaurantName: process.argv[2] || 'Restaurant Name',
  city: process.argv[3] || 'City',
  outputDir: process.argv[4] || path.join(__dirname, '../planning/downloaded-images'),
  headless: process.env.HEADLESS === 'true' ? true : false,
  userDataDir: '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile'
};

async function searchAndScreenshot() {
  let browser;
  
  try {
    // Create output directory using standardized naming
    const restaurantDir = path.join(config.outputDir, `${sanitize(config.restaurantName)}-${sanitize(config.city)}`);
    if (!fs.existsSync(restaurantDir)) {
      fs.mkdirSync(restaurantDir, { recursive: true });
    }

    console.log(`\n🔍 Searching for ${config.restaurantName} in ${config.city}...`);
    console.log(`📁 Output directory: ${restaurantDir}`);
    
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
    
    // Extract image results metadata
    const imageResults = await page.evaluate(() => {
      const images = document.querySelectorAll('div[data-id] img');
      const results = [];
      for (let i = 0; i < Math.min(images.length, 20); i++) {
        const img = images[i];
        const container = img.closest('div[data-id]');
        results.push({
          index: i,
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          // Try to get any visible text near the image
          nearbyText: container ? container.textContent.trim().substring(0, 100) : ''
        });
      }
      return results;
    });
    
    // Save search metadata
    const searchMetadata = {
      restaurant: config.restaurantName,
      city: config.city,
      searchQuery: searchQuery,
      searchTimestamp: new Date().toISOString(),
      imageCount: imageResults.length,
      images: imageResults.map(img => ({
        index: img.index,
        alt: img.alt,
        dimensions: `${img.width}x${img.height}`,
        hasAlt: img.alt.length > 0,
        nearbyText: img.nearbyText
      }))
    };
    
    const metadataPath = path.join(restaurantDir, 'search-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(searchMetadata, null, 2));
    console.log(`\n📊 Search metadata saved to: ${metadataPath}`);
    
    // Display results summary for orchestrator
    console.log(`\n✅ Found ${imageResults.length} image results`);
    console.log('\n🎯 Image Analysis Summary:');
    console.log('==========================');
    
    imageResults.forEach((img, i) => {
      console.log(`\n[${i}] ${img.alt || 'No description'}`);
      console.log(`    Dimensions: ${img.width}x${img.height}px`);
      if (img.nearbyText && img.nearbyText.length > 0) {
        console.log(`    Context: ${img.nearbyText.substring(0, 50)}...`);
      }
    });
    
    console.log('\n📋 Evaluation Criteria Reminder:');
    console.log('1. High prevalence across multiple results');
    console.log('2. Good image quality and resolution');
    console.log('3. Absence of non-logo elements (text, people, food)');
    console.log('4. Clean, professional appearance');
    
    console.log('\n⏸️  Screenshot saved. Please review and select the best logo image.');
    console.log('   Use extract-selected-logo.cjs with the selected index to download.');
    
    // Keep page data for potential follow-up
    const pageDataPath = path.join(restaurantDir, 'page-data.json');
    fs.writeFileSync(pageDataPath, JSON.stringify({
      searchQuery,
      timestamp: new Date().toISOString(),
      imageCount: imageResults.length
    }, null, 2));
    
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
Usage: node search-and-screenshot.cjs <restaurant-name> <city> [output-dir]

This script searches for restaurant logos and saves a screenshot for evaluation.
It follows the "Orchestrator in the loop" principle by not automatically selecting images.

Examples:
  node search-and-screenshot.cjs "Artisan Cafe" "Rotorua"
  node search-and-screenshot.cjs "Smokey Ts" "Christchurch"

After reviewing the screenshot, use extract-selected-logo.cjs to download the chosen image.

Environment variables:
  HEADLESS=true  - Run in headless mode (default: false)
  `);
  process.exit(1);
}

// Run the search
searchAndScreenshot();