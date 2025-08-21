#!/usr/bin/env node

/**
 * Create API Key Script
 * 
 * This script logs into the admin portal and creates an API key with access to all restaurants
 * for the "invalid phone number fixer" purpose
 * 
 * Usage:
 *   node create-api-key.js --email=<email> [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --debug                   Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   ADMIN_PASSWORD          Admin password for login
 *   DEBUG_MODE              Enable debug mode (true/false)
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const { chromium } = require('./restaurant-registration/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration
const LOGIN_URL = "https://admin.pumpd.co.nz/login";
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || process.argv.includes('--debug');

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse arguments
const email = getArg('email');

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email) {
  console.error('❌ Error: Email is required');
  console.error('Usage: node create-api-key.js --email="email@example.com"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `api-key-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function createApiKey() {
  console.log('🚀 Starting API Key Creation...\n');
  
  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Debug Mode: ${DEBUG_MODE}`);
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100
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
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    console.log('  ✓ Credentials entered');
    
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  ✓ Clicked login');
    
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
    console.log('  ✓ Login successful');
    
    // Wait for dashboard to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02-dashboard');
    
    // STEP 2: Navigate to Developers tab
    console.log('\n🔧 STEP 2: Navigate to Developers tab');
    
    const developersTab = page.locator('#scroll-root > div > div > menu > div > div:nth-child(1) > nav > a:nth-child(4)');
    await developersTab.click();
    console.log('  ✓ Clicked Developers tab');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-developers-page');
    
    // STEP 3: Click Create API Key button
    console.log('\n🔑 STEP 3: Creating API Key');
    
    const createApiKeyButton = page.locator('#scroll-root > div > div > div > div > div > div:nth-child(1) > div.flex-l-r-center.m-b-7 > button');
    await createApiKeyButton.click();
    console.log('  ✓ Clicked Create API Key button');
    
    // Wait for popup to appear
    await page.waitForTimeout(2000);
    
    // STEP 4: Fill in API key name
    console.log('\n📝 STEP 4: Configuring API Key');
    
    const nameInput = page.locator('#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input');
    await nameInput.fill('invalid phone number fixer');
    console.log('  ✓ Entered API key name: "invalid phone number fixer"');
    
    // STEP 5: Select all restaurants
    console.log('\n🏪 STEP 5: Granting access to all restaurants');
    
    // Click the Restaurant Access dropdown
    const restaurantDropdown = page.locator('#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__InputIcon-dZhktu.PrPXn');
    await restaurantDropdown.click();
    console.log('  ✓ Opened restaurant dropdown');
    await page.waitForTimeout(1000);
    
    // Try to select all available options
    let optionIndex = 1;
    let optionsSelected = 0;
    const maxAttempts = 10; // Safety limit
    
    while (optionIndex <= maxAttempts) {
      try {
        // Try with numbered child selector first
        let optionSelector = `#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div.selectadv__Wrapper-cKWklP.FVSIE > div.selectadv__Dropdown-eSUwYi.dtQnDO > div:nth-child(${optionIndex})`;
        
        // If it's the first option and numbered selector fails, try without child number
        if (optionIndex === 1) {
          const numberedOption = await page.locator(optionSelector).count();
          if (numberedOption === 0) {
            optionSelector = '#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div.selectadv__Wrapper-cKWklP.FVSIE > div.selectadv__Dropdown-eSUwYi.dtQnDO > div';
          }
        }
        
        const option = page.locator(optionSelector);
        const optionCount = await option.count();
        
        if (optionCount > 0) {
          await option.click();
          optionsSelected++;
          console.log(`  ✓ Selected restaurant option ${optionsSelected}`);
          await page.waitForTimeout(500);
          
          // Click dropdown again to show remaining options
          await restaurantDropdown.click();
          await page.waitForTimeout(500);
        } else {
          // No more options available
          break;
        }
        
        optionIndex++;
      } catch (error) {
        // No more options or error selecting
        break;
      }
    }
    
    console.log(`  ✓ Selected ${optionsSelected} restaurant(s)`);
    
    // Close dropdown by clicking outside if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // STEP 6: Save the API key
    console.log('\n💾 STEP 6: Saving API Key');
    
    const saveButton = page.locator('#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > button');
    await saveButton.click();
    console.log('  ✓ Clicked Save button');
    
    // STEP 7: Wait for save to complete
    console.log('  ⏳ Waiting for API key to be created...');
    await page.waitForTimeout(3000);
    
    // STEP 8: Take screenshot for debugging
    await takeScreenshot(page, '04-api-key-created');
    
    // STEP 9: Extract and log the API key
    console.log('\n📋 STEP 7: Extracting API Key');
    
    try {
      // Get the first (most recent) API key from the list
      const apiKeyElement = page.locator('#scroll-root > div > div > div > div > div > div:nth-child(1) > div.item-list__ItemListWrapper-dyLBYn.jkyIVq > div > div > div.p-lr-4.p-tb-2 > p.small > span').first();
      await apiKeyElement.waitFor({ state: 'visible', timeout: 5000 });
      const apiKey = await apiKeyElement.textContent();
      
      console.log('\n✅ API Key Successfully Created!');
      console.log('==========================================');
      console.log(`🔑 API Key: ${apiKey}`);
      console.log(`📝 Name: invalid phone number fixer`);
      console.log(`🏪 Access: ${optionsSelected} restaurant(s)`);
      console.log('==========================================\n');
      
      // Store API key for potential use in other scripts
      const apiKeyData = {
        key: apiKey,
        name: 'invalid phone number fixer',
        email: email,
        createdAt: new Date().toISOString(),
        restaurants: optionsSelected
      };
      
      // Create filename with email prefix (sanitize email for filename)
      const sanitizedEmail = email.replace(/[@\.]/g, '_');
      const apiKeyPath = path.join(__dirname, `${sanitizedEmail}-api-key-data.json`);
      await fs.writeFile(apiKeyPath, JSON.stringify(apiKeyData, null, 2));
      console.log(`💾 API key data saved to: ${apiKeyPath}`);
      
    } catch (error) {
      console.error('  ❌ Failed to extract API key:', error.message);
      console.log('  ℹ️ The API key may still have been created. Check the browser window.');
    }
    
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Keep browser open in debug mode
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode enabled - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    // Debug information
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode - browser will remain open for inspection');
      await new Promise(() => {});
    }
    
    throw error;
  } finally {
    if (!DEBUG_MODE) {
      console.log('\n✨ Browser closed');
      await browser.close();
    }
  }
}

// Run the script
createApiKey().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});