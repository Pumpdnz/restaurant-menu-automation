#!/usr/bin/env node

/**
 * Simple Instagram Logo Extractor
 * Uses a persistent browser profile so you only need to log in once
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
  console.log('Usage: node instagram-simple-extractor.js --url="https://instagram.com/username" --name="Restaurant Name" --location="City"');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function extractInstagramLogo() {
  console.log('📸 Instagram Logo Extraction\n');
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

  // Use a dedicated Instagram profile directory
  const profileDir = path.join(process.env.HOME, '.playwright-instagram-profile');
  
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
    console.log('📁 Created browser profile for Instagram\n');
  }

  // Launch browser with persistent context
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1200, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  console.log('🔐 Using persistent browser profile\n');
  
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

    // Navigate to Instagram
    console.log('📱 Navigating to Instagram profile...');
    await page.goto(instagramUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);

    // Check if we need to log in
    const needsLogin = await page.evaluate(() => {
      return window.location.pathname.includes('/accounts/login') ||
             document.querySelector('input[name="username"]') !== null;
    });

    if (needsLogin) {
      console.log('⚠️  Instagram login required');
      console.log('📝 Please log in manually in the browser window');
      console.log('    Your login will be saved for future use\n');
      
      // Wait for user to complete login (up to 5 minutes)
      console.log('⏳ Waiting for login (5 minutes timeout)...');
      console.log('    Take your time to log in...\n');
      
      try {
        await page.waitForFunction(
          () => !window.location.pathname.includes('/accounts/login'),
          { timeout: 300000 }  // 5 minutes
        );
        
        console.log('✅ Login successful!\n');
        
        // Navigate back to the target profile
        await page.goto(instagramUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
      } catch (e) {
        console.error('❌ Login timeout after 5 minutes.');
        console.log('💡 Tip: If you need more time, press any key in this terminal to keep waiting...');
        
        // Give extra time if needed
        await page.waitForTimeout(60000); // Extra minute
        
        const stillNeedsLogin = await page.evaluate(() => {
          return window.location.pathname.includes('/accounts/login');
        });
        
        if (stillNeedsLogin) {
          console.error('❌ Still on login page. Please try again.');
          await context.close();
          process.exit(1);
        } else {
          console.log('✅ Login successful!\n');
          await page.goto(instagramUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(3000);
        }
      }
    } else {
      console.log('✅ Already logged in!\n');
    }

    // Close any popups/modals
    try {
      await page.evaluate(() => {
        // Close notification prompts
        const buttons = Array.from(document.querySelectorAll('button'));
        const notNowButton = buttons.find(btn => 
          btn.textContent.includes('Not Now') || 
          btn.textContent.includes('Cancel')
        );
        if (notNowButton) notNowButton.click();
        
        // Also try pressing Escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
    } catch (e) {
      // No modals to close
    }

    // Take screenshot
    const screenshotPath = path.join(outputDir, 'instagram-profile-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log('📸 Screenshot saved\n');

    // Extract profile picture
    console.log('🔍 Looking for profile picture...\n');
    
    const profileData = await page.evaluate(() => {
      // Try multiple strategies to find the profile picture
      const strategies = [
        // Look for image with alt text containing profile picture
        () => document.querySelector('img[alt*="profile picture" i], img[alt*="profile picture" i]'),
        
        // Look in header for circular images
        () => {
          const imgs = document.querySelectorAll('header img');
          for (const img of imgs) {
            const style = window.getComputedStyle(img);
            const parent = img.parentElement;
            const parentStyle = parent ? window.getComputedStyle(parent) : null;
            
            // Check for circular styling
            if (style.borderRadius === '50%' || 
                (parentStyle && parentStyle.borderRadius === '50%')) {
              return img;
            }
            
            // Check for square profile pic dimensions
            if (img.width === img.height && img.width >= 100 && img.width <= 200) {
              return img;
            }
          }
          return null;
        },
        
        // Look for canvas + img pattern (Instagram sometimes uses this)
        () => document.querySelector('header canvas + img, header img[draggable="false"]')
      ];

      let profileImg = null;
      for (const strategy of strategies) {
        profileImg = strategy();
        if (profileImg && profileImg.src && 
            !profileImg.src.includes('44884218_345707102882519_2446069589734326272')) {
          break;
        }
      }

      if (profileImg) {
        // Try to get higher resolution
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
      
      // Download the profile picture
      const execPromise = util.promisify(exec);
      const logoPath = path.join(outputDir, 'logo-from-instagram.jpg');
      const curlCommand = `curl -L -H "User-Agent: Mozilla/5.0" -o "${logoPath}" "${profileData.src}"`;
      
      console.log('📥 Downloading profile picture...\n');
      
      try {
        await execPromise(curlCommand);
        const stats = fs.statSync(logoPath);
        
        if (stats.size > 1000) {  // At least 1KB
          console.log(`💾 Logo saved successfully!`);
          console.log(`📦 File size: ${stats.size} bytes`);
          console.log(`📍 Location: ${logoPath}\n`);
          
          // Save metadata
          const resultsPath = path.join(outputDir, 'instagram-brand-analysis.json');
          const results = {
            restaurant: restaurantName,
            location: location,
            instagramUrl: instagramUrl,
            username: username,
            extractedAt: new Date().toISOString(),
            profilePicture: {
              found: true,
              dimensions: `${profileData.width}x${profileData.height}`,
              path: logoPath,
              size: stats.size
            },
            note: 'Logo downloaded. Manual color analysis required.'
          };
          
          fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
          console.log('📄 Metadata saved\n');
          
          console.log('✅ Extraction complete!');
          console.log('📝 Next: Analyze the logo for brand colors\n');
          
        } else {
          throw new Error('Downloaded file too small');
        }
      } catch (e) {
        console.error('⚠️  Download failed, saving screenshot instead...\n');
        
        // Take a screenshot of just the profile picture
        const element = await page.$('header img');
        if (element) {
          const logoScreenshotPath = path.join(outputDir, 'logo-from-instagram-screenshot.png');
          await element.screenshot({ path: logoScreenshotPath });
          console.log(`💾 Logo screenshot saved: ${logoScreenshotPath}\n`);
        }
      }
      
    } else {
      console.error('❌ Could not find profile picture');
      console.log('    The profile might be private or have no picture\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await context.close();
    console.log('👋 Browser closed');
  }
}

// Run extraction
extractInstagramLogo().catch(console.error);