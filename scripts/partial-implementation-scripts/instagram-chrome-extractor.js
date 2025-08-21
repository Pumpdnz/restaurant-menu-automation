#!/usr/bin/env node

/**
 * Instagram Logo Extractor using Chrome DevTools Protocol
 * 
 * This script connects to an already-running Chrome instance to extract Instagram logos
 * Requires Chrome to be started with remote debugging enabled
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
  console.log('Usage: node instagram-chrome-extractor.js --url="https://instagram.com/username" --name="Restaurant Name" --location="City"');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function extractWithExistingChrome() {
  console.log('📸 Instagram Logo Extraction (Using Existing Chrome)\n');
  console.log(`📍 Restaurant: ${restaurantName}`);
  console.log(`📱 Instagram: ${instagramUrl}`);
  console.log(`📍 Location: ${location}\n`);

  // Extract username
  const usernameMatch = instagramUrl.match(/instagram\.com\/([^\/\?]+)/);
  const username = usernameMatch ? usernameMatch[1] : null;
  
  if (!username) {
    console.error('❌ Could not extract username from Instagram URL');
    process.exit(1);
  }
  
  console.log(`👤 Username: ${username}\n`);

  const execPromise = util.promisify(exec);
  
  // First, check if Chrome is running
  try {
    const { stdout } = await execPromise('pgrep -f "Google Chrome"');
    if (stdout) {
      console.log('✅ Chrome is already running\n');
    }
  } catch (e) {
    console.log('🚀 Starting Chrome with remote debugging...\n');
    // Start Chrome with remote debugging if not running
    exec('open -a "Google Chrome" --args --remote-debugging-port=9222');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Open the Instagram URL in Chrome
  console.log('🌐 Opening Instagram profile in Chrome...\n');
  await execPromise(`open -a "Google Chrome" "${instagramUrl}"`);
  
  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // Connect to the running Chrome instance
    console.log('🔌 Connecting to Chrome DevTools...\n');
    
    // Try both localhost and 127.0.0.1
    let browser;
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    } catch (e) {
      console.log('⚠️  Trying alternative connection...');
      browser = await chromium.connectOverCDP('http://localhost:9222');
    }
    
    // Get all open pages
    const contexts = browser.contexts();
    let instagramPage = null;
    
    // Find the Instagram tab
    for (const context of contexts) {
      const pages = context.pages();
      for (const page of pages) {
        const url = page.url();
        if (url.includes('instagram.com') && url.includes(username)) {
          instagramPage = page;
          console.log('✅ Found Instagram tab\n');
          break;
        }
      }
      if (instagramPage) break;
    }
    
    if (!instagramPage) {
      console.error('❌ Could not find Instagram tab. Make sure the profile is open.');
      process.exit(1);
    }

    // Create output directory
    const outputDir = path.join(
      '/Users/giannimunro/Desktop/cursor-projects',
      'automation/planning/downloaded-images',
      `${sanitize(restaurantName)}-${sanitize(location)}`
    );
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Output directory: ${outputDir}\n`);

    // Check if logged in
    const isLoggedIn = await instagramPage.evaluate(() => {
      return !window.location.pathname.includes('/accounts/login') &&
             !document.querySelector('input[name="username"]');
    });

    if (!isLoggedIn) {
      console.log('⚠️  Please log in to Instagram in the Chrome window');
      console.log('⏳ Waiting for login...\n');
      
      // Wait for user to log in
      await instagramPage.waitForFunction(
        () => !window.location.pathname.includes('/accounts/login'),
        { timeout: 60000 }
      );
      
      console.log('✅ Logged in successfully!\n');
      
      // Navigate back to the profile
      await instagramPage.goto(instagramUrl, { waitUntil: 'domcontentloaded' });
      await instagramPage.waitForTimeout(3000);
    }

    // Close any modals
    try {
      await instagramPage.evaluate(() => {
        // Try to close any notification modals
        const closeButtons = document.querySelectorAll('[aria-label="Close"], button:has(svg[aria-label="Close"])');
        closeButtons.forEach(btn => btn.click());
        
        // Press Escape as backup
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
    } catch (e) {
      // Modals might not exist
    }

    // Take screenshot
    const screenshotPath = path.join(outputDir, 'instagram-profile-screenshot.png');
    await instagramPage.screenshot({ path: screenshotPath, fullPage: false });
    console.log('📸 Profile screenshot saved\n');

    // Extract profile picture
    console.log('🔍 Extracting profile picture...\n');
    
    const profileData = await instagramPage.evaluate(() => {
      // Find profile picture
      const selectors = [
        'header img[alt*="profile picture"]',
        'header img[alt*="Profile picture"]',
        'header canvas + img',
        'header img[draggable="false"]',
        'img[style*="border-radius: 50%"]'
      ];
      
      let profileImg = null;
      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.includes('44884218_345707102882519_2446069589734326272')) {
          profileImg = img;
          break;
        }
      }
      
      // If not found, look for any circular image in header
      if (!profileImg) {
        const headerImgs = document.querySelectorAll('header img');
        for (const img of headerImgs) {
          if (img.width === img.height && img.width >= 100 && img.width <= 200) {
            profileImg = img;
            break;
          }
        }
      }
      
      if (profileImg) {
        // Get high-res version
        let src = profileImg.src;
        if (src.includes('s150x150')) {
          src = src.replace('s150x150', 's320x320');
        }
        
        return {
          found: true,
          src: src,
          alt: profileImg.alt || '',
          width: profileImg.naturalWidth || profileImg.width,
          height: profileImg.naturalHeight || profileImg.height
        };
      }
      
      return { found: false };
    });

    if (profileData.found) {
      console.log('✅ Profile picture found!');
      console.log(`📊 Dimensions: ${profileData.width}x${profileData.height}px\n`);
      
      // Download the image
      const logoPath = path.join(outputDir, 'logo-from-instagram.jpg');
      const curlCommand = `curl -L -o "${logoPath}" "${profileData.src}"`;
      
      console.log('📥 Downloading profile picture...\n');
      
      try {
        await execPromise(curlCommand);
        const stats = fs.statSync(logoPath);
        
        if (stats.size > 0) {
          console.log(`💾 Logo saved: ${logoPath}`);
          console.log(`📦 Size: ${stats.size} bytes\n`);
        } else {
          throw new Error('Downloaded file is empty');
        }
      } catch (downloadError) {
        console.error('⚠️  Download failed, taking screenshot instead...\n');
        
        // Fallback: Screenshot the profile picture
        const profilePicElement = await instagramPage.$('header img');
        if (profilePicElement) {
          const screenshotPath = path.join(outputDir, 'logo-from-instagram-screenshot.png');
          await profilePicElement.screenshot({ path: screenshotPath });
          console.log(`💾 Logo screenshot saved: ${screenshotPath}\n`);
        }
      }

      // Save results
      const resultsPath = path.join(outputDir, 'instagram-brand-analysis.json');
      const results = {
        restaurant: restaurantName,
        location: location,
        instagramUrl: instagramUrl,
        username: username,
        extractedAt: new Date().toISOString(),
        method: 'chrome-devtools',
        profilePicture: {
          found: true,
          dimensions: `${profileData.width}x${profileData.height}`,
          saved: true,
          src: profileData.src
        },
        note: 'Profile picture downloaded. Manual color analysis required.'
      };
      
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`📄 Results saved to: ${resultsPath}\n`);
      
      console.log('✅ Instagram extraction completed successfully!');
      console.log('📝 Next step: Manually analyze logo-from-instagram.jpg for brand colors\n');
      
    } else {
      console.error('❌ Could not find profile picture');
      
      // Save error report
      const resultsPath = path.join(outputDir, 'instagram-brand-analysis.json');
      const results = {
        restaurant: restaurantName,
        location: location,
        instagramUrl: instagramUrl,
        username: username,
        extractedAt: new Date().toISOString(),
        method: 'chrome-devtools',
        profilePicture: {
          found: false,
          error: 'Profile picture not found'
        }
      };
      
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    }
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Tip: Make sure Chrome is running and you are logged into Instagram');
  }
}

// Run the extraction
extractWithExistingChrome().catch(console.error);