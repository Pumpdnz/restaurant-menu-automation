#\!/usr/bin/env node

// Test downloading image using page context
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('./restaurant-registration/node_modules/playwright');

async function testDownload() {
  const userDataDir = '/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile';
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1200, height: 800 }
  });
  
  const pages = await context.pages();
  const page = pages.find(p => p.url().includes('instagram.com')) || pages[0];
  
  console.log('Current URL:', page.url());
  
  // Method 1: Screenshot the profile image element
  const profileImg = await page.$('header img[alt*="profile picture"]');
  if (profileImg) {
    await profileImg.screenshot({ path: './profile-screenshot.png' });
    console.log('✓ Screenshot saved as profile-screenshot.png');
  }
  
  // Method 2: Get image as base64
  const imgData = await page.evaluate(() => {
    const img = document.querySelector('header img[alt*="profile picture"]');
    if (\!img) return null;
    
    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    
    // Create new image to bypass CORS
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    return {
      src: img.src,
      width: canvas.width,
      height: canvas.height,
      alt: img.alt
    };
  });
  
  console.log('Image data:', imgData);
  
  await context.close();
}

testDownload().catch(console.error);
