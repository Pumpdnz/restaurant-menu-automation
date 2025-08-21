#!/usr/bin/env node

/**
 * Google Images Logo Search and Extraction
 * 
 * This script searches Google Images for restaurant logos, captures results,
 * allows for selection (automatic or manual), and downloads the chosen logo.
 * 
 * Usage:
 *   node google-logo-search.js --name="Restaurant Name" --location="City" [--auto]
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('./restaurant-registration/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

const restaurantName = getArg('name');
const location = getArg('location');
const autoSelect = args.includes('--auto');

if (!restaurantName || !location) {
  console.error('❌ Error: Restaurant name and location are required');
  console.log('Usage: node google-logo-search.js --name="Restaurant Name" --location="City" [--auto]');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function searchAndExtractLogo() {
  console.log('🚀 Starting Google Images Logo Search...\n');
  console.log(`📍 Restaurant: ${restaurantName}`);
  console.log(`📍 Location: ${location}`);
  console.log(`🤖 Mode: ${autoSelect ? 'Automatic' : 'Manual'} selection\n`);

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();

  try {
    // Create output directory
    const outputDir = path.join(
      '/Users/giannimunro/Desktop/cursor-projects',
      'automation/planning/downloaded-images',
      `${sanitize(restaurantName)}-${sanitize(location)}`
    );
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Output directory: ${outputDir}\n`);

    // Build search query - include site filters for better results
    const searchQuery = `${restaurantName} ${location} Restaurant Logo site:instagram.com OR site:facebook.com`;
    console.log(`🔍 Search query: "${searchQuery}"\n`);

    // Navigate to Google Images
    console.log('📱 Navigating to Google Images...');
    await page.goto('https://images.google.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Perform search
    console.log('🔎 Performing search...');
    const searchBox = await page.locator('textarea[name="q"], input[name="q"]').first();
    await searchBox.fill(searchQuery);
    await searchBox.press('Enter');
    
    // Wait for results to load
    await page.waitForTimeout(3000);
    // Wait for any images to be present (not necessarily visible)
    await page.waitForSelector('img[class*="YQ4gaf"], img[class*="rg_i"], img[data-atf]', { 
      state: 'attached',
      timeout: 10000 
    });

    // Take screenshot of search results
    const screenshotPath = path.join(outputDir, 'google-search-results.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Search results screenshot saved\n`);

    // Extract image data from search results
    console.log('📊 Extracting image data...');
    const imageData = await page.evaluate(() => {
      const images = [];
      // Use multiple selectors to find images in different Google layouts
      const imgElements = document.querySelectorAll('img[class*="YQ4gaf"], img[class*="rg_i"], img[data-atf], div[data-ved] img');
      
      imgElements.forEach((img, index) => {
        // Skip tiny images (likely UI elements)
        if (img.width < 50 || img.height < 50) return;
        
        if (images.length < 20) { // Limit to first 20 valid results
          const parent = img.closest('a');
          const title = parent?.getAttribute('aria-label') || img.alt || '';
          
          images.push({
            index: index,
            src: img.src,
            alt: img.alt || '',
            title: title,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            dataId: img.getAttribute('data-atf') || '',
            isBase64: img.src?.startsWith('data:image')
          });
        }
      });
      
      return images;
    });

    console.log(`✅ Found ${imageData.length} images\n`);

    // Save metadata
    const metadataPath = path.join(outputDir, 'search-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(imageData, null, 2));
    console.log(`💾 Metadata saved to: ${metadataPath}\n`);

    // Selection logic
    let selectedIndex = 0;
    let scoredImages = [];
    
    if (autoSelect) {
      // Automatic selection based on criteria
      console.log('🤖 Applying automatic selection criteria...');
      
      // Score each image
      scoredImages = imageData.map((img, idx) => {
        let score = 0;
        
        // Prefer square or near-square images (logos are usually square)
        if (img.width && img.height) {
          const aspectRatio = img.width / img.height;
          if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
            score += 3;
          }
        }
        
        // Prefer images with "logo" in title/alt
        if (img.title.toLowerCase().includes('logo') || img.alt.toLowerCase().includes('logo')) {
          score += 2;
        }
        
        // Prefer images with restaurant name
        if (img.title.toLowerCase().includes(restaurantName.toLowerCase()) || 
            img.alt.toLowerCase().includes(restaurantName.toLowerCase())) {
          score += 2;
        }
        
        // Avoid images with food-related terms
        const avoidTerms = ['food', 'dish', 'meal', 'plate', 'menu', 'interior', 'exterior', 'person', 'people'];
        avoidTerms.forEach(term => {
          if (img.title.toLowerCase().includes(term) || img.alt.toLowerCase().includes(term)) {
            score -= 1;
          }
        });
        
        return { ...img, score };
      });
      
      // Sort by score and select the best
      scoredImages.sort((a, b) => b.score - a.score);
      selectedIndex = scoredImages[0].index;
      
      console.log(`✅ Auto-selected image ${selectedIndex}:`);
      console.log(`   Title: ${scoredImages[0].title}`);
      console.log(`   Score: ${scoredImages[0].score}\n`);
      
    } else {
      // Manual selection prompt
      console.log('👤 Manual selection mode');
      console.log('Please review the search results screenshot and select an image index');
      console.log('Available images:');
      imageData.forEach((img, idx) => {
        if (img.title || img.alt) {
          console.log(`  [${idx}] ${img.title || img.alt} (${img.width}x${img.height})`);
        }
      });
      
      // For agent use, save selection info for manual review
      const selectionPath = path.join(outputDir, 'selection-required.json');
      fs.writeFileSync(selectionPath, JSON.stringify({
        message: 'Manual selection required',
        availableImages: imageData,
        recommendation: scoredImages[0] ? scoredImages[0].index : 0
      }, null, 2));
      
      console.log(`\n⚠️ Manual selection required. Review images and use --index parameter`);
      console.log(`   Recommended: index ${scoredImages[0] ? scoredImages[0].index : 0}`);
      selectedIndex = scoredImages[0] ? scoredImages[0].index : 0;
    }

    // Click on the selected image to get full resolution
    console.log(`🖱️ Clicking on image ${selectedIndex}...`);
    const imageElements = await page.locator('img[class*="YQ4gaf"], img[class*="rg_i"], img[data-atf]').all();
    if (imageElements[selectedIndex]) {
      await imageElements[selectedIndex].click();
      await page.waitForTimeout(2000);
      
      // Try to find the full resolution image
      console.log('🔍 Looking for full resolution image...');
      
      // Check for the enlarged preview
      let fullResUrl = null;
      
      // Method 1: Check the side panel (newer Google Images layout)
      const sidePanel = await page.locator('div[role="dialog"] img, div[jsname="figiqf"] img').first();
      if (await sidePanel.count() > 0) {
        fullResUrl = await sidePanel.getAttribute('src');
      }
      
      // Method 2: Check for preview panel
      if (!fullResUrl) {
        const previewImg = await page.locator('img[jsname="HiaYvf"], img[jsname="kn3ccd"]').first();
        if (await previewImg.count() > 0) {
          fullResUrl = await previewImg.getAttribute('src');
        }
      }
      
      // Method 3: Use the original thumbnail as fallback
      if (!fullResUrl) {
        fullResUrl = imageData[selectedIndex].src;
      }
      
      if (fullResUrl) {
        console.log(`✅ Found image URL\n`);
        
        // Save URL
        const urlPath = path.join(outputDir, 'logo-url.txt');
        fs.writeFileSync(urlPath, fullResUrl);
        
        // Download image
        console.log('💾 Downloading logo...');
        let logoBuffer;
        
        if (fullResUrl.startsWith('data:image')) {
          // Handle base64 images
          const base64Data = fullResUrl.split(',')[1];
          logoBuffer = Buffer.from(base64Data, 'base64');
        } else {
          // Download from URL
          try {
            const response = await page.context().request.get(fullResUrl);
            logoBuffer = await response.body();
          } catch (error) {
            console.log('⚠️ Direct download failed, trying alternative method...');
            // Alternative: Use page.goto and screenshot
            const downloadPage = await context.newPage();
            await downloadPage.goto(fullResUrl);
            await downloadPage.waitForTimeout(2000);
            logoBuffer = await downloadPage.screenshot();
            await downloadPage.close();
          }
        }
        
        // Save logo
        const logoPath = path.join(outputDir, 'logo-from-search.png');
        fs.writeFileSync(logoPath, logoBuffer);
        console.log(`✅ Logo saved to: ${logoPath}`);
        console.log(`📦 Size: ${logoBuffer.length} bytes\n`);
        
        // Create result summary
        const results = {
          restaurant: restaurantName,
          location: location,
          searchQuery: searchQuery,
          selectedImage: {
            index: selectedIndex,
            title: imageData[selectedIndex].title,
            dimensions: `${imageData[selectedIndex].width}x${imageData[selectedIndex].height}`,
            url: fullResUrl.substring(0, 100) + '...'
          },
          savedTo: logoPath,
          extractedAt: new Date().toISOString()
        };
        
        const resultsPath = path.join(outputDir, 'search-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        
        console.log('✅ Logo extraction completed successfully!');
        
      } else {
        console.log('❌ Could not find full resolution image URL');
      }
      
    } else {
      console.log(`❌ Could not find image at index ${selectedIndex}`);
    }

  } catch (error) {
    console.error('❌ Error during search:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the search
searchAndExtractLogo().catch(console.error);