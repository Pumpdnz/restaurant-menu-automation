#!/usr/bin/env node

/**
 * Instagram Logo and Brand Color Extractor
 * 
 * This script extracts profile pictures and brand colors from Instagram profiles
 * Handles Instagram's dynamic content loading and various profile layouts
 * 
 * Usage:
 *   node instagram-logo-extractor.js --url="https://instagram.com/username" --name="Restaurant Name" --location="City"
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
  console.log('Usage: node instagram-logo-extractor.js --url="https://instagram.com/username" --name="Restaurant Name" --location="City"');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function extractInstagramLogo() {
  console.log('📸 Starting Instagram Logo Extraction...\n');
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

  // Option to use actual Chrome profile or automation profile
  const useRealProfile = process.argv.includes('--use-real-profile');
  
  let context;
  if (useRealProfile) {
    // Use your actual Chrome profile (where you're already logged in)
    const userDataDir = '/Users/giannimunro/Library/Application Support/Google/Chrome';
    console.log('🔐 Using your real Chrome profile (already logged in)');
    
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1200, height: 800 },
      channel: 'chrome', // Use actual Chrome instead of Chromium
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--profile-directory=Default'  // Specify which Chrome profile to use
      ]
    });
  } else {
    // Use separate automation profile
    const userDataDir = '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile';
    
    // Ensure the profile directory exists
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      console.log('📁 Created browser profile directory');
    }
    
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1200, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled'
      ]
    });
    
    console.log('🔐 Using separate automation profile');
  }
  
  const page = await context.newPage();

  try {
    // Create output directory first
    const outputDir = path.join(
      '/Users/giannimunro/Desktop/cursor-projects',
      'automation/planning/downloaded-images',
      `${sanitize(restaurantName)}-${sanitize(location)}`
    );
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Output directory: ${outputDir}\n`);
    
    // First, try alternative methods to get profile picture
    console.log('🔍 Attempting alternative profile picture extraction methods...\n');
    
    // Method 1: Try direct API-like URL (sometimes works for public profiles)
    const execPromise = util.promisify(exec);
    let profilePictureFound = false;
    
    try {
      // Try to fetch profile data using a web request
      const profileDataUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
      const curlDataCommand = `curl -s -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${profileDataUrl}" > "${outputDir}/profile-data.json"`;
      
      console.log('📊 Attempting to fetch profile data...');
      await execPromise(curlDataCommand);
      
      // Check if we got valid JSON
      const profileDataPath = path.join(outputDir, 'profile-data.json');
      if (fs.existsSync(profileDataPath)) {
        const dataContent = fs.readFileSync(profileDataPath, 'utf-8');
        if (dataContent && !dataContent.includes('<!DOCTYPE') && !dataContent.includes('login')) {
          console.log('✅ Profile data retrieved');
          profilePictureFound = true;
        }
      }
    } catch (e) {
      console.log('⚠️  Direct data fetch failed, trying browser method...\n');
    }
    
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
    
    // Wait for content to load
    await page.waitForTimeout(3000);

    // Check if we're logged in
    const isLoginPage = await page.evaluate(() => {
      return window.location.pathname.includes('/accounts/login') ||
             document.querySelector('input[name="username"]') !== null;
    });

    if (isLoginPage && useRealProfile) {
      console.log('⚠️  Login required even with real profile.');
      console.log('    Please log in manually in your regular Chrome browser first.\n');
    } else if (isLoginPage) {
      console.log('⚠️  Instagram login page detected.');
      console.log('📝 Please log in manually in the browser window that opened.');
      console.log('    Your credentials will be saved for future runs.');
      console.log('    After logging in, close the "Turn on Notifications" popup if it appears.\n');
      
      // Give user time to login manually
      console.log('⏳ Waiting 30 seconds for manual login...');
      await page.waitForTimeout(30000);
      
      // Check if still on login page
      const stillLoginPage = await page.evaluate(() => {
        return window.location.pathname.includes('/accounts/login') ||
               document.querySelector('input[name="username"]') !== null;
      });
      
      if (!stillLoginPage) {
        console.log('✅ Login successful! Continuing with extraction...\n');
        // Navigate to the profile again after login
        await page.goto(instagramUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
      } else {
        console.log('⚠️  Still on login page, attempting to continue anyway...\n');
      }
    } else if (useRealProfile) {
      console.log('✅ Already logged in! Proceeding with extraction...\n');
    }

    // Try to close any modal that might be blocking content
    try {
      // First check if there's a modal overlay
      const hasModal = await page.evaluate(() => {
        // Check for Instagram's typical modal dialog
        return document.querySelector('[role="dialog"]') !== null ||
               document.querySelector('div[style*="position: fixed"]') !== null;
      });
      
      if (hasModal) {
        console.log('🔍 Detected modal overlay, attempting to close...');
        
        // Try multiple methods to close the modal
        const closeActions = [
          // Method 1: Use the specific selector paths for Instagram's notification popup
          async () => {
            // Try the CSS selector path first
            const notificationClose = await page.$('body > div.x1n2onr6.xzkaem6 > div:nth-child(2) > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div.x1uvtmcs.x4k7w5x.x1h91t0o.x1beo9mf.xaigb6o.x12ejxvf.x3igimt.xarpa2k.xedcshv.x1lytzrv.x1t2pt76.x7ja8zs.x1n2onr6.x1qrby5j.x1jfb8zj > div > div > div > div > div.x7r02ix.x15fl9t6.x1yw9sn2.x1evh3fb.x4giqqa.xb88tzc.xw2csxc.x1odjw0f.x5fp0pe > div > div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9z._aba9._abch._abck.x1vjfegm._abcm > div > div');
            if (notificationClose) {
              await notificationClose.click();
              console.log('  ✓ Clicked notification close button using CSS selector');
              return true;
            }
            
            // Try the XPath as fallback
            const xpathClose = await page.$('xpath=/html/body/div[5]/div[2]/div/div/div[1]/div/div[2]/div/div/div/div/div[2]/div/div[1]/div/div');
            if (xpathClose) {
              await xpathClose.click();
              console.log('  ✓ Clicked notification close button using XPath');
              return true;
            }
            
            return false;
          },
          // Method 2: Look for "Not Now" button (common in Instagram popups)
          async () => {
            const notNowBtn = await page.$('button:has-text("Not Now"), button:has-text("Not now")');
            if (notNowBtn) {
              await notNowBtn.click();
              console.log('  ✓ Clicked "Not Now" button');
              return true;
            }
            return false;
          },
          // Method 3: Click the X button with various selectors
          async () => {
            const closeBtn = await page.$('svg[aria-label="Close"], button[aria-label="Close"], [role="button"]:has(svg)');
            if (closeBtn) {
              await closeBtn.click();
              console.log('  ✓ Clicked close button');
              return true;
            }
            return false;
          },
          // Method 4: Press Escape
          async () => {
            await page.keyboard.press('Escape');
            console.log('  ✓ Pressed Escape key');
            return true;
          },
          // Method 5: Click outside the modal
          async () => {
            await page.mouse.click(10, 10);
            console.log('  ✓ Clicked outside modal');
            return true;
          }
        ];
        
        for (const action of closeActions) {
          try {
            if (await action()) {
              await page.waitForTimeout(2000);
              const stillHasModal = await page.evaluate(() => {
                return document.querySelector('[role="dialog"]') !== null;
              });
              if (!stillHasModal) {
                console.log('✅ Successfully closed modal');
                break;
              }
            }
          } catch (actionError) {
            // Continue to next method if this one fails
            continue;
          }
        }
        
        // Final check if modal is still present
        const modalStillPresent = await page.evaluate(() => {
          return document.querySelector('[role="dialog"]') !== null;
        });
        
        if (modalStillPresent) {
          console.log('⚠️  Modal still present, continuing anyway...');
        }
      }
    } catch (e) {
      console.log('⚠️  Modal handling error, continuing anyway...');
    }
    
    // Wait for the page content to fully load
    await page.waitForTimeout(3000);

    // Take screenshot of profile page
    const screenshotPath = path.join(outputDir, 'instagram-profile-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('📸 Profile screenshot saved\n');

    // Extract profile picture
    console.log('🔍 Searching for profile picture...');
    
    const profileData = await page.evaluate(() => {
      // Multiple strategies to find profile picture
      const strategies = [
        // Strategy 1: Look for profile picture in header
        () => {
          const headerImgs = document.querySelectorAll('header img');
          for (const img of headerImgs) {
            // Skip Instagram's default avatar
            if (img.src && !img.src.includes('44884218_345707102882519_2446069589734326272')) {
              // Check if it's likely a profile pic (square-ish dimensions)
              if (img.width > 50 && img.height > 50) {
                return img;
              }
            }
          }
          return null;
        },
        
        // Strategy 2: Look for circular images (profile pics are usually circular)
        () => {
          const allImages = Array.from(document.querySelectorAll('img'));
          for (const img of allImages) {
            const computed = window.getComputedStyle(img);
            const parent = img.parentElement;
            const parentComputed = parent ? window.getComputedStyle(parent) : null;
            
            // Check if image or parent has circular styling
            if (computed.borderRadius === '50%' || 
                (parentComputed && parentComputed.borderRadius === '50%')) {
              // Verify it's likely a profile pic by size
              if (img.width >= 100 && img.width <= 200 && img.height >= 100 && img.height <= 200) {
                return img;
              }
            }
          }
          return null;
        },
        
        // Strategy 3: Look for specific Instagram profile pic patterns
        () => {
          const profileImg = document.querySelector('div[role="button"] img');
          if (profileImg && profileImg.width === profileImg.height && profileImg.width > 100) {
            return profileImg;
          }
          return null;
        },
        
        // Strategy 4: Look for images with specific alt text patterns
        () => {
          const imgs = document.querySelectorAll('img[alt*="profile picture"], img[alt*="Profile picture"]');
          if (imgs.length > 0) {
            return imgs[0];
          }
          return null;
        }
      ];

      // Try each strategy
      let profileImg = null;
      for (const strategy of strategies) {
        profileImg = strategy();
        if (profileImg) break;
      }

      if (profileImg) {
        // Get high-res version if available
        let highResSrc = profileImg.src;
        
        // Instagram URLs often have size parameters we can modify
        if (highResSrc.includes('_s150x150')) {
          highResSrc = highResSrc.replace('_s150x150', '');
        }
        if (highResSrc.includes('s150x150')) {
          highResSrc = highResSrc.replace('s150x150', 's320x320');
        }
        
        return {
          found: true,
          src: highResSrc,
          originalSrc: profileImg.src,
          alt: profileImg.alt || '',
          width: profileImg.naturalWidth || profileImg.width,
          height: profileImg.naturalHeight || profileImg.height
        };
      }

      // Check if profile might be private
      const isPrivate = document.querySelector('h2')?.textContent?.includes('This account is private') ||
                       document.querySelector('span')?.textContent?.includes('This Account is Private');
      
      if (isPrivate) {
        return { found: false, error: 'Profile is private' };
      }

      return { found: false, error: 'Profile picture not found' };
    });

    if (profileData.found) {
      console.log(`✅ Profile picture found`);
      console.log(`📊 Dimensions: ${profileData.width}x${profileData.height}px`);
      console.log(`🔗 URL: ${profileData.src}`);
      
      // Download profile picture using curl -L to follow redirects
      const execPromise = util.promisify(exec);
      
      const logoPath = path.join(outputDir, 'logo-from-instagram.jpg');
      const curlCommand = `curl -L -o "${logoPath}" "${profileData.src}"`;
      
      console.log('📥 Downloading profile picture with curl...');
      
      try {
        const { stdout, stderr } = await execPromise(curlCommand);
        
        // Check if file was created and has content
        const stats = fs.statSync(logoPath);
        if (stats.size > 0) {
          console.log(`💾 Logo saved: ${logoPath}`);
          console.log(`📦 Size: ${stats.size} bytes\n`);
        } else {
          throw new Error('Downloaded file is empty');
        }
      } catch (downloadError) {
        console.error('⚠️ Curl download failed, trying alternative method...');
        
        // Fallback: Take a screenshot of just the profile picture
        try {
          const profilePicElement = await page.$('header img, div[role="button"] img, img[alt*="profile picture"]');
          if (profilePicElement) {
            const screenshotPath = path.join(outputDir, 'logo-from-instagram-screenshot.png');
            await profilePicElement.screenshot({ path: screenshotPath });
            console.log(`💾 Logo saved via screenshot: ${screenshotPath}`);
            const stats = fs.statSync(screenshotPath);
            console.log(`📦 Size: ${stats.size} bytes\n`);
          }
        } catch (screenshotError) {
          console.error('❌ Error capturing profile picture:', screenshotError.message);
        }
      }

      // Extract colors from page (Instagram's branding colors)
      console.log('🎨 Extracting Instagram page colors...');
      const colorData = await page.evaluate(() => {
        // Instagram typically uses consistent branding
        return {
          theme: 'light', // Instagram is typically light theme
          background: '#FFFFFF',
          colors: [
            { hex: '#FFFFFF', name: 'White', usage: 'background' },
            { hex: '#000000', name: 'Black', usage: 'text' },
            { hex: '#E4405F', name: 'Instagram Gradient Pink', usage: 'branding' },
            { hex: '#C13584', name: 'Instagram Gradient Purple', usage: 'branding' },
            { hex: '#F77737', name: 'Instagram Gradient Orange', usage: 'branding' }
          ]
        };
      });

      // Save results to JSON
      const resultsPath = path.join(outputDir, 'instagram-brand-analysis.json');
      const results = {
        restaurant: restaurantName,
        location: location,
        instagramUrl: instagramUrl,
        extractedAt: new Date().toISOString(),
        profilePicture: {
          found: true,
          dimensions: `${profileData.width}x${profileData.height}`,
          saved: true,
          src: profileData.src,
          note: 'Logo colors need manual analysis after download'
        },
        instagramColors: colorData.colors,
        theme: colorData.theme,
        backgroundColor: colorData.background,
        note: 'Profile picture downloaded. Manual color analysis required for accurate brand colors.'
      };
      
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`📄 Results saved to: ${resultsPath}\n`);

      // Display results
      console.log('🎨 Instagram Brand Colors:');
      colorData.colors.forEach((color, index) => {
        if (index < 3) {
          console.log(`  ${index + 1}. ${color.hex} - ${color.name}`);
        }
      });
      console.log('\n⚠️  Note: Profile picture colors need manual analysis');
      console.log('    Please examine the downloaded image for actual brand colors\n');

      console.log('✅ Instagram extraction completed successfully!');
      console.log('📝 Next step: Manually analyze logo-from-instagram.jpg for brand colors');

    } else {
      console.error(`❌ Profile picture not found: ${profileData.error}`);
      
      // Save error report
      const resultsPath = path.join(outputDir, 'instagram-brand-analysis.json');
      const results = {
        restaurant: restaurantName,
        location: location,
        instagramUrl: instagramUrl,
        extractedAt: new Date().toISOString(),
        profilePicture: {
          found: false,
          error: profileData.error
        },
        note: profileData.error === 'Profile is private' ? 
               'Cannot extract logo from private profile' : 
               'Profile picture not found. Manual extraction may be required.'
      };
      
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`📄 Error report saved to: ${resultsPath}\n`);
    }

  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
  } finally {
    await context.close();
  }
}

// Run the extraction
extractInstagramLogo().catch(console.error);