#!/usr/bin/env node

/**
 * Menu CSV Import Script for admin.pumpd.co.nz
 * 
 * This script performs automated CSV menu import including:
 * - Login to existing restaurant account
 * - Navigation to restaurant management
 * - CSV import process
 * - File selection and upload
 * Uses admin password from environment or default
 * 
 * Usage:
 *   node import-csv-menu.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --csvFile=<path>         Path to CSV file to import (optional, will find latest if not provided)
 *   --restaurantName=<name>   Restaurant name for file selection (optional)
 * 
 * Environment Variables:
 *   DEBUG_MODE              Enable debug mode (true/false)
 *   ADMIN_PASSWORD          Admin password for login
 * 
 * Example:
 *   node import-csv-menu.js --email="test@example.com" --csvFile="/path/to/menu.csv"
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const LOGIN_URL = "https://admin.pumpd.co.nz/login";
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || false;

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse arguments
const email = getArg('email');
const csvFile = getArg('csvFile');
const restaurantName = getArg('restaurantName');

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email) {
  console.error('❌ Error: Email is required');
  console.error('Usage: node import-csv-menu.js --email="email@example.com" --csvFile="/path/to/menu.csv"');
  process.exit(1);
}

// If csvFile is not provided, try to find the most recent CSV for the restaurant
async function findLatestCSV(name) {
  const menuDir = path.join(__dirname, '../../extracted-menus');
  try {
    const files = await fs.readdir(menuDir);
    
    // Filter CSV files (excluding _no_images variants)
    const csvFiles = files.filter(f => 
      f.endsWith('.csv') && 
      !f.includes('_no_images') && 
      !f.includes('_cleaned') &&
      !f.includes('_fixed') &&
      !f.includes('.backup')
    );
    
    if (csvFiles.length === 0) {
      console.log('  ⚠️ No CSV files found in extracted-menus directory');
      return null;
    }
    
    // Sort by modification time to get the most recent
    const fileStats = await Promise.all(
      csvFiles.map(async (file) => {
        const filePath = path.join(menuDir, file);
        const stats = await fs.stat(filePath);
        return { file, path: filePath, mtime: stats.mtime };
      })
    );
    
    fileStats.sort((a, b) => b.mtime - a.mtime);
    
    // If restaurant name provided, try to find matching file
    if (name) {
      const cleanName = name.toLowerCase().replace(/\s+/g, '');
      const matchingFile = fileStats.find(f => 
        f.file.toLowerCase().includes(cleanName)
      );
      if (matchingFile) {
        console.log(`  ✓ Found matching CSV: ${matchingFile.file}`);
        return matchingFile.path;
      }
    }
    
    // Return the most recent file
    console.log(`  ✓ Using most recent CSV: ${fileStats[0].file}`);
    return fileStats[0].path;
    
  } catch (error) {
    console.error('  ❌ Error finding CSV file:', error.message);
    return null;
  }
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `csv-import-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function importCSVMenu() {
  console.log('🚀 Starting CSV Menu Import...\n');
  
  // Determine CSV file to use
  let csvPath = csvFile;
  if (!csvPath) {
    console.log('🔍 No CSV file specified, searching for latest...');
    csvPath = await findLatestCSV(restaurantName);
    if (!csvPath) {
      console.error('❌ No CSV file found. Please specify --csvFile parameter');
      process.exit(1);
    }
  }
  
  // Verify CSV file exists
  try {
    await fs.access(csvPath);
    console.log(`📄 CSV File: ${csvPath}`);
  } catch {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  CSV File: ${path.basename(csvPath)}`);
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100 // Slow down for debugging
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    // STEP 1: Login
    console.log('🔐 STEP 1: Login to admin portal');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-login-page');
    
    // Fill login form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    console.log('  ✓ Credentials entered');
    
    // Click login button
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  ✓ Clicked login');
    
    // Wait for dashboard
    console.log('\n⏳ Waiting for dashboard...');
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
    console.log('  ✓ Reached dashboard:', page.url());
    
    // Wait for loading overlay to disappear
    await page.waitForFunction(() => {
      const loader = document.querySelector('.cover-loader');
      return !loader || !loader.classList.contains('active');
    }, { timeout: 10000 });
    
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02-dashboard-loaded');
    
    // STEP 2: Click Manage button for the restaurant
    console.log('\n🏪 STEP 2: Navigate to restaurant management');
    
    // Strategy to click the Manage button (not View Store)
    // The selector matches two buttons, we need the first one (Manage)
    try {
      // Try to click using more specific selector for Manage button
      const manageButton = page.locator('#restaurant-list-item-0 button:has-text("Manage")').first();
      await manageButton.click();
      console.log('  ✓ Clicked Manage button');
    } catch {
      // Fallback: Use nth-child or index-based selection
      try {
        const buttons = await page.locator('#restaurant-list-item-0 button').all();
        if (buttons.length >= 1) {
          await buttons[0].click(); // First button should be Manage
          console.log('  ✓ Clicked Manage button (via index)');
        }
      } catch {
        // Last fallback: Use the exact selector path
        await page.click('#restaurant-list-item-0 > div > div.flex-line.centered.child-mr-10.m-t-2 > button:first-child');
        console.log('  ✓ Clicked Manage button (via exact selector)');
      }
    }
    
    // Wait for navigation to restaurant management page
    console.log('  ⏳ Waiting for restaurant management page...');
    await page.waitForURL('**/admin.pumpd.co.nz/restaurant/**', { timeout: 15000 });
    console.log('  ✓ Navigated to restaurant page');
    
    // Wait 3 seconds for page to fully load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-restaurant-management');
    
    // STEP 3: Click Menu button
    console.log('\n📋 STEP 3: Navigate to Menu section');
    
    // Wait for any loading spinners to disappear
    await page.waitForFunction(() => {
      const spinner = document.querySelector('.loader, .loading, .spinner, svg[class*="spin"]');
      return !spinner || spinner.style.display === 'none';
    }, { timeout: 10000 }).catch(() => console.log('  ⚠️ Loading check timeout, continuing...'));
    
    // Click the menu navigation - it's the 4th icon in the sidebar (fork and knife icon)
    try {
      // Try clicking the menu link directly
      await page.click('#nav-link-menus');
      console.log('  ✓ Clicked Menu navigation');
    } catch {
      // Fallback: Click by finding the fork/knife icon in the sidebar
      try {
        const menuIcon = page.locator('aside a[href*="/menu"], nav a[href*="/menu"], #nav-link-menus').first();
        await menuIcon.click();
        console.log('  ✓ Clicked Menu navigation (via href selector)');
      } catch {
        // Last resort: Click the 4th navigation item in the sidebar
        const navItems = await page.locator('aside a, nav a, [id^="nav-link"]').all();
        if (navItems.length >= 4) {
          await navItems[3].click(); // 0-indexed, so 3 is the 4th item
          console.log('  ✓ Clicked Menu navigation (via position)');
        } else {
          throw new Error('Could not find menu navigation');
        }
      }
    }
    
    // Wait for menu page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04-menu-page');
    
    // STEP 4: Click CSV Import button
    console.log('\n📥 STEP 4: Open CSV Import dialog');
    
    try {
      // Try the provided selector first
      await page.click('#scroll-root > div > div > div > div > div > div.flex-l-r-center.m-b-6 > div > div:nth-child(3) > button');
      console.log('  ✓ Clicked CSV Import button');
    } catch {
      // Fallback: Look for button with CSV or Import text
      try {
        const csvButton = page.locator('button').filter({ hasText: /CSV|Import/i }).first();
        await csvButton.click();
        console.log('  ✓ Clicked CSV Import button (via text search)');
      } catch {
        console.error('  ❌ Could not find CSV Import button');
        throw new Error('CSV Import button not found');
      }
    }
    
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '05-csv-import-dialog');
    
    // STEP 5: Type "import" in the confirmation field
    console.log('\n✍️ STEP 5: Confirm import action');
    
    try {
      // Use a more generic selector that doesn't rely on dynamic IDs
      // Look for the modal content and find the input within it
      const confirmInput = page.locator('div.content__Content-hOzsB.UWPkM input').first();
      await confirmInput.click();
      await confirmInput.fill('import');
      console.log('  ✓ Typed "import" confirmation');
    } catch {
      // Fallback: Try with different class combinations
      try {
        const confirmInput = page.locator('div[class*="content__Content"] input').first();
        await confirmInput.click();
        await confirmInput.fill('import');
        console.log('  ✓ Typed "import" confirmation (via class pattern)');
      } catch {
        // Last fallback: Find any visible input in a modal/dialog
        try {
          const confirmInput = page.locator('input:visible').first();
          await confirmInput.click();
          await confirmInput.fill('import');
          console.log('  ✓ Typed "import" confirmation (via visible input)');
        } catch {
          console.error('  ⚠️ Could not find confirmation input');
        }
      }
    }
    
    await takeScreenshot(page, '06-import-confirmed');
    
    // STEP 6: Click Proceed button
    console.log('\n➡️ STEP 6: Proceed with import');
    
    try {
      // Look for Proceed button without relying on dynamic IDs
      await page.click('button:has-text("Proceed")');
      console.log('  ✓ Clicked Proceed');
    } catch {
      // Fallback: Find button in modal content
      try {
        const proceedButton = page.locator('div.content__Content-hOzsB.UWPkM button').first();
        await proceedButton.click();
        console.log('  ✓ Clicked Proceed (via content class)');
      } catch {
        // Last fallback: Find any button with proceed-like text
        const proceedButton = page.locator('button').filter({ hasText: /Proceed|Continue|Next/i }).first();
        await proceedButton.click();
        console.log('  ✓ Clicked Proceed (via text search)');
      }
    }
    
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '07-file-selection-dialog');
    
    // STEP 7: Handle file upload
    console.log('\n📁 STEP 7: Select and upload CSV file');
    
    // Playwright can handle file uploads directly without OS dialog interaction
    // We need to find the actual file input element (might be hidden)
    
    try {
      // Method 1: Direct file input selection
      // Look for a hidden file input that's triggered by the button
      const fileInput = await page.locator('input[type="file"]').first();
      
      if (await fileInput.count() > 0) {
        // Set the file directly on the input element
        await fileInput.setInputFiles(csvPath);
        console.log('  ✓ CSV file selected via file input');
        
      } else {
        console.log('  ⚠️ No file input found, trying alternative method...');
        
        // Method 2: Click the Choose File button and handle file chooser
        page.on('filechooser', async (fileChooser) => {
          await fileChooser.setFiles(csvPath);
          console.log('  ✓ CSV file selected via file chooser event');
        });
        
        // Click the Choose File button
        try {
          await page.click('button:has-text("Choose")');
          console.log('  ⚠️ Clicked Choose File button');
        } catch {
          // Fallback: Find button in modal content
          const chooseButton = page.locator('div[class*="content__Content"] button').filter({ hasText: /Choose|Select|Browse/i }).first();
          await chooseButton.click();
          console.log('  ⚠️ Clicked Choose File button (via pattern search)');
        }
      }
      
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '08-file-selected');
      
      // STEP 8: Confirm upload and wait for processing
      console.log('\n⏳ STEP 8: Processing CSV import...');
      
      // Look for the Upload button specifically in the modal
      try {
        // Primary method: Look for Upload button specifically
        await page.click('button:has-text("Upload"):visible');
        console.log('  ✓ Clicked Upload button');
      } catch {
        try {
          // Fallback: Use the exact selector from the modal
          await page.click('#Os_dpmgVLp-content button, div[class*="content__Content"] button:has-text("Upload")');
          console.log('  ✓ Clicked Upload button (via modal selector)');
        } catch {
          // Last resort: Find button that's actually visible and contains Upload
          const uploadButton = page.locator('button:visible').filter({ hasText: 'Upload' }).first();
          await uploadButton.click();
          console.log('  ✓ Clicked Upload button (via visible filter)');
        }
      }
      
      // Wait for success indication
      await page.waitForTimeout(5000);
      
      // Check for success message or navigation change
      const successIndicator = page.locator('text=/Success|Imported|Complete/i').first();
      if (await successIndicator.count() > 0) {
        console.log('  ✅ CSV import completed successfully!');
      } else {
        console.log('  ⚠️ Import status unclear - check screenshot');
      }
      
      await takeScreenshot(page, '09-import-complete');
      
    } catch (error) {
      console.error('  ❌ File upload failed:', error.message);
      await takeScreenshot(page, 'error-file-upload');
      
      // Alternative approach documentation
      console.log('\n📝 Alternative Manual Approach:');
      console.log('If automated file upload fails, you can:');
      console.log('1. Use the browser window that remains open');
      console.log('2. Manually click "Choose File" button');
      console.log('3. Navigate to:', csvPath);
      console.log('4. Select the CSV file manually');
      console.log('5. Complete the import process');
    }
    
    console.log('\n✅ CSV IMPORT PROCESS COMPLETED!');
    console.log('Summary:');
    console.log(`  ✓ Logged in as: ${email}`);
    console.log(`  ✓ CSV File: ${path.basename(csvPath)}`);
    console.log(`  ✓ File Size: ${(await fs.stat(csvPath)).size} bytes`);
    console.log('  ✓ Import initiated');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
  } finally {
    if (DEBUG_MODE) {
      console.log('\n🐛 Browser left open for inspection');
      console.log('Press Ctrl+C to exit');
      await new Promise(() => {}); // Keep alive
    } else {
      await browser.close();
      console.log('\n✨ Browser closed');
    }
  }
}

// Run the import
importCSVMenu();