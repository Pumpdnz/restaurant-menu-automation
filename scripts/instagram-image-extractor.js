#!/usr/bin/env node

/**
 * Instagram Image Extractor
 * Extracts profile picture (logo) and post images from Instagram profiles
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import util from 'util';

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

const instagramUrl = getArg('url');
const restaurantName = getArg('name') || 'restaurant';
const location = getArg('location') || 'unknown';

if (!instagramUrl) {
  console.error('❌ Error: Instagram URL is required');
  console.log('Usage: node instagram-image-extractor.js --url="https://instagram.com/username" --name="Restaurant Name" --location="City"');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function extractInstagramImages() {
  console.log('📸 Instagram Image Extractor\n');
  console.log(`📍 Restaurant: ${restaurantName}`);
  console.log(`📱 Instagram: ${instagramUrl}`);
  console.log(`📍 Location: ${location}\n`);

  // Extract username from Instagram URL
  const usernameMatch = instagramUrl.match(/instagram\.com\/([^\/\?]+)/);
  const username = usernameMatch ? usernameMatch[1] : null;
  
  if (!username) {
    console.error('❌ Could not extract username from Instagram URL');
    process.exit(1);
  }
  
  console.log(`👤 Username: ${username}\n`);

  // Use separate automation profile
  const userDataDir = '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile';
  
  // Ensure the profile directory exists
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
    console.log('📁 Created browser profile directory');
  }
  
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1200, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  console.log('🔐 Using automation profile\n');
  
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
    
    // Navigate to Instagram profile
    console.log('📱 Navigating to Instagram profile...');
    try {
      await page.goto(instagramUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
    } catch (navError) {
      console.log('⚠️  Navigation timeout, continuing anyway...');
    }
    
    // Wait for initial content to load
    await page.waitForTimeout(3000);

    // Check if we're on login page
    const isLoginPage = await page.evaluate(() => {
      return window.location.pathname.includes('/accounts/login') ||
             document.querySelector('input[name="username"]') !== null;
    });

    if (isLoginPage) {
      console.log('⚠️  Instagram login page detected.');
      console.log('📝 Please log in manually in the browser window.');
      console.log('⏳ Waiting 30 seconds for manual login...\n');
      
      await page.waitForTimeout(30000);
      
      // Navigate to the profile again after login
      await page.goto(instagramUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    } else {
      console.log('✅ Not on login page, proceeding...\n');
    }

    // Step 1: Try to close modal using the specific selector
    console.log('🔍 Step 1: Checking for modal overlay...');
    
    const hasModal = await page.evaluate(() => {
      return document.querySelector('[role="dialog"]') !== null;
    });
    
    if (hasModal) {
      console.log('  ✓ Modal detected, attempting to close...');
      
      // Try the specific CSS selector for Instagram's notification popup
      try {
        const notificationClose = await page.$('body > div.x1n2onr6.xzkaem6 > div:nth-child(2) > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div.x1uvtmcs.x4k7w5x.x1h91t0o.x1beo9mf.xaigb6o.x12ejxvf.x3igimt.xarpa2k.xedcshv.x1lytzrv.x1t2pt76.x7ja8zs.x1n2onr6.x1qrby5j.x1jfb8zj > div > div > div > div > div.x7r02ix.x15fl9t6.x1yw9sn2.x1evh3fb.x4giqqa.xb88tzc.xw2csxc.x1odjw0f.x5fp0pe > div > div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9z._aba9._abch._abck.x1vjfegm._abcm > div > div');
        
        if (notificationClose) {
          await notificationClose.click();
          console.log('  ✓ Clicked notification close button');
          await page.waitForTimeout(2000);
        } else {
          console.log('  ⚠️ Close button not found with CSS selector');
          // Try pressing Escape as fallback
          await page.keyboard.press('Escape');
          console.log('  ✓ Pressed Escape key as fallback');
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        console.log('  ⚠️ Error closing modal:', e.message);
      }
    } else {
      console.log('  ✓ No modal detected');
    }

    // Step 2: Take screenshot
    console.log('\n📸 Step 2: Taking screenshot...');
    const screenshotPath = path.join(outputDir, 'instagram-profile-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`  ✓ Screenshot saved: ${screenshotPath}`);

    // Step 3: Wait 5 seconds
    console.log('\n⏳ Step 3: Waiting 5 seconds for all images to load...');
    await page.waitForTimeout(5000);
    console.log('  ✓ Wait complete');

    // Step 4: Execute code in the DOM to get all image URLs
    console.log('\n🔍 Step 4: Extracting all image URLs from the page...');
    const data = await page.evaluate(() => {
      const images = document.querySelectorAll("img");
      const urls = Array.from(images).map((img) => ({
        src: img.src,
        alt: img.alt || '',
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        className: img.className,
        id: img.id || '',
        isCircular: window.getComputedStyle(img).borderRadius === '50%' ||
                    (img.parentElement && window.getComputedStyle(img.parentElement).borderRadius === '50%'),
        parentTag: img.parentElement ? img.parentElement.tagName : '',
        inHeader: img.closest('header') !== null
      }));
      return urls;
    });

    console.log(`  ✓ Found ${data.length} images`);

    // Step 5: Save the data as JSON
    console.log('\n💾 Step 5: Saving image data...');
    const jsonPath = path.join(outputDir, 'all-images.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    console.log(`  ✓ Data saved to: ${jsonPath}`);

    // Step 6: Display and download profile picture
    console.log('\n🎯 Profile Picture:');
    console.log('=' .repeat(80));
    
    let profilePicture = null;
    data.forEach((img, index) => {
      // Filter for likely profile pictures
      if (img.inHeader && 
          img.width >= 50 && img.height >= 50 &&
          img.width === img.height && // Square images
          !img.src.includes('44884218_345707102882519_2446069589734326272')) { // Not default avatar
        
        if (!profilePicture) {
          profilePicture = img;
          console.log(`\n[Profile Picture - Image ${index}]`);
          console.log(`  URL: ${img.src}`);
          console.log(`  Alt: ${img.alt}`);
          console.log(`  Dimensions: ${img.width}x${img.height}`);
        }
      }
    });

    // Step 7: Download profile picture
    if (profilePicture) {
      console.log('\n📥 Downloading profile picture...');
      const execPromise = util.promisify(exec);
      const profilePath = path.join(outputDir, 'logo-from-instagram.jpg');
      const curlCommand = `curl -L -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Referer: https://www.instagram.com/" -o "${profilePath}" "${profilePicture.src}"`;
      
      try {
        await execPromise(curlCommand);
        const stats = fs.statSync(profilePath);
        if (stats.size > 1000) {
          console.log(`  ✓ Profile picture downloaded: ${stats.size} bytes`);
        } else {
          console.log(`  ⚠️ Profile picture download may have failed (only ${stats.size} bytes)`);
        }
      } catch (e) {
        console.log(`  ⚠️ Failed to download profile picture: ${e.message}`);
      }
    }

    // Step 8: Find and download post images
    console.log('\n📸 Post Images:');
    console.log('=' .repeat(80));
    
    // Filter for post images (usually larger, not profile pics, not in header)
    const postImages = data.filter(img => 
      !img.inHeader && 
      img.width >= 200 && 
      img.height >= 200 &&
      !img.src.includes('44884218_345707102882519_2446069589734326272') &&
      (img.src.includes('dst-jpg_e35') || img.src.includes('dst-jpg_e15') || 
       img.className.includes('x5yr21d') || img.parentTag === 'A')
    );

    console.log(`\nFound ${postImages.length} potential post images`);
    
    // Download first 9 post images
    const maxPostImages = Math.min(9, postImages.length);
    if (maxPostImages > 0) {
      console.log(`\n📥 Downloading first ${maxPostImages} post images...`);
      
      const execPromise = util.promisify(exec);
      for (let i = 0; i < maxPostImages; i++) {
        const img = postImages[i];
        const postPath = path.join(outputDir, `instagram-post-image-${i + 1}.jpg`);
        const curlCommand = `curl -L -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Referer: https://www.instagram.com/" -o "${postPath}" "${img.src}"`;
        
        try {
          console.log(`\n  [${i + 1}/${maxPostImages}] Downloading post image...`);
          console.log(`      Dimensions: ${img.width}x${img.height}`);
          
          await execPromise(curlCommand);
          const stats = fs.statSync(postPath);
          
          if (stats.size > 5000) { // Post images should be larger
            console.log(`      ✓ Downloaded: ${stats.size} bytes`);
          } else {
            console.log(`      ⚠️ Download may have failed (only ${stats.size} bytes)`);
          }
        } catch (e) {
          console.log(`      ⚠️ Failed to download: ${e.message}`);
        }
      }
    } else {
      console.log('\n  ⚠️ No post images found');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Instagram extraction complete!');
    console.log('📁 Files saved to:', outputDir);
    console.log('  - all-images.json (metadata for all images)');
    console.log('  - instagram-profile-screenshot.png (full page screenshot)');
    if (profilePicture) console.log('  - logo-from-instagram.jpg (profile picture/logo)');
    if (maxPostImages > 0) console.log(`  - instagram-post-image-1.jpg to instagram-post-image-${maxPostImages}.jpg (post images)`);
    
    console.log('\n🔍 Browser will remain open for manual inspection');
    console.log('\n⚠️  KEEPING BROWSER OPEN - Press Ctrl+C to exit when done debugging\n');

    // Keep the browser open indefinitely for debugging
    await new Promise(() => {}); // This will keep the script running

  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
    console.log('\n⚠️  KEEPING BROWSER OPEN FOR DEBUGGING - Press Ctrl+C to exit\n');
    
    // Keep browser open even on error
    await new Promise(() => {});
  }
}

// Run the extraction
extractInstagramImages().catch(console.error);