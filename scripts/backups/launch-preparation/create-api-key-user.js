#!/usr/bin/env node

/**
 * Create API Key (User Credentials Version)
 *
 * This script logs into the admin portal using user credentials and creates an API key
 * for the specific restaurant passed as an argument.
 *
 * Usage:
 *   node create-api-key-user.js --email=<email> --password=<password> --name=<restaurant_name>
 *
 * Options:
 *   --email=<email>           Login email (required)
 *   --password=<password>     User password (required)
 *   --name=<restaurant_name>  Restaurant name for smart matching (required)
 *   --debug                   Enable debug mode (keeps browser open)
 *
 * Environment Variables:
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
const password = getArg('password');
const restaurantName = getArg('name');

// Validate required arguments
if (!email || !password || !restaurantName) {
  console.error('❌ Error: Email, password, and restaurant name are required');
  console.error('Usage: node create-api-key-user.js --email="email@example.com" --password="password" --name="Restaurant Name"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `api-key-user-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};


async function createApiKey() {
  console.log('🚀 Starting API Key Creation (User Credentials)...\n');

  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Restaurant: ${restaurantName}`);
  console.log(`  Debug Mode: ${DEBUG_MODE}`);
  console.log('');

  const browser = await chromium.launch({
    headless: false,  // Always show browser for visibility
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  try {
    // STEP 1: Login
    console.log('\n🔐 STEP 1: Login to admin portal');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-login-page');

    // Use the correct selectors from the backup
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    console.log('  ✓ Credentials entered');

    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  ✓ Clicked login');

    // Wait for redirect using the proven pattern
    console.log('  ⏳ Waiting for redirect...');
    try {
      await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 10000 });
      console.log('  ✓ Successfully logged in!');
    } catch (error) {
      throw new Error('Login failed - not redirected to dashboard');
    }

    // Wait for dashboard to load
    console.log('\n⏳ Waiting for dashboard...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (error) {
      console.log('  ⚠️ Network idle timeout, continuing anyway...');
    }
    console.log('  ✓ Reached dashboard:', page.url());

    // Wait for loading overlay to disappear
    try {
      await page.waitForFunction(() => {
        const loader = document.querySelector('.cover-loader');
        return !loader || !loader.classList.contains('active');
      }, { timeout: 5000 });
    } catch (error) {
      console.log('  ⚠️ Loading overlay check timed out, continuing...');
    }

    // Additional wait for restaurants to load
    console.log('  ⏳ Waiting for dashboard content to fully load...');
    await page.waitForTimeout(5000);

    // Try to wait for restaurant elements to appear
    try {
      await page.waitForSelector('h4', { timeout: 8000 });
      console.log('  ✓ Dashboard content loaded');
    } catch (error) {
      console.log('  ⚠️ No h4 elements found, continuing anyway...');
    }

    await takeScreenshot(page, '02-dashboard');

    // STEP 2: Click the Developers tab button
    console.log('\n🔧 STEP 2: Navigate to Developers tab');

    // Click the Developers button in the navigation menu
    const developersTab = page.locator('#scroll-root > div > div > menu > div > div:nth-child(1) > nav > a:nth-child(4)');

    // Wait for the button to be visible
    await developersTab.waitFor({ state: 'visible', timeout: 10000 });
    await developersTab.click();
    console.log('  ✓ Clicked Developers tab');

    // Wait for page to load
    console.log('  ⏳ Waiting for developers page to load...');
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
    await nameInput.fill('Online Ordering Integration');
    console.log('  ✓ Entered API key name: "Online Ordering Integration"');

    // STEP 5: Select all restaurants
    console.log('\n🏪 STEP 5: Configuring Restaurant Access');

    // Click the Restaurant Access dropdown
    const restaurantDropdown = page.locator('#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__InputIcon-dZhktu.PrPXn');

    // Track the number of restaurants selected for the final output
    let restaurantsSelected = 0;

    // Check if dropdown exists (multi-restaurant accounts)
    if (await restaurantDropdown.count() > 0) {
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
      restaurantsSelected = optionsSelected;

      // Close dropdown by clicking outside if still open
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // Single-restaurant account - restaurant is auto-selected
      console.log(`  ℹ️ Restaurant "${restaurantName}" auto-selected for single-restaurant account`);
      restaurantsSelected = 1;
    }

    // STEP 6: Save the API key
    console.log('\n💾 STEP 6: Saving API Key');

    const saveButton = page.locator('#api-form-modal-content > div.content__Content-hOzsB.UWPkM > form > button');
    await saveButton.click();
    console.log('  ✓ Clicked Save button');

    // Wait for save to complete
    console.log('  ⏳ Waiting for API key to be created...');
    await page.waitForTimeout(3000);

    // Take screenshot for debugging
    await takeScreenshot(page, '04-api-key-created');

    // STEP 7: Extract and log the API key
    console.log('\n📋 STEP 7: Extracting API Key');

    try {
      // Get the first (most recent) API key from the list
      const apiKeyElement = page.locator('#scroll-root > div > div > div > div > div > div:nth-child(1) > div.item-list__ItemListWrapper-dyLBYn.jkyIVq > div > div > div.p-lr-4.p-tb-2 > p.small > span').first();
      await apiKeyElement.waitFor({ state: 'visible', timeout: 5000 });
      const apiKey = await apiKeyElement.textContent();

      console.log('\n✅ API Key Successfully Created!');
      console.log('==========================================');
      console.log(`🔑 API Key: ${apiKey}`);
      console.log(`📝 Name: Online Ordering Integration`);
      console.log(`🏪 Access: ${restaurantsSelected} restaurant(s)`);
      console.log('==========================================\n');

      // Store API key for potential use
      const apiKeyData = {
        key: apiKey,
        name: 'Online Ordering Integration',
        restaurants: restaurantsSelected,
        email: email,
        createdAt: new Date().toISOString()
      };

      const sanitizedEmail = email.replace(/[@\.]/g, '_');
      const apiKeyPath = path.join(__dirname, `${sanitizedEmail}-api-key.json`);
      await fs.writeFile(apiKeyPath, JSON.stringify(apiKeyData, null, 2));
      console.log(`💾 API key saved to: ${apiKeyPath}`);

      // Output structured result for backend parsing
      console.log('\n### SCRIPT_RESULT_START ###');
      console.log(JSON.stringify({
        success: true,
        apiKey: apiKey,
        apiKeyName: 'Online Ordering Integration',
        restaurantsConfigured: restaurantsSelected,
        timestamp: new Date().toISOString()
      }));
      console.log('### SCRIPT_RESULT_END ###');
    } catch (error) {
      console.error('  ❌ Failed to extract API key:', error.message);
      console.log('  ℹ️ The API key may still have been created. Check the browser window.');
    }

    console.log('\n✅ API Key Creation Process Complete!');

  } catch (error) {
    console.error('\n❌ Error during API key creation:', error.message);

    if (DEBUG_MODE) {
      await takeScreenshot(page, 'error');
    }

    throw error;
  } finally {
    if (!DEBUG_MODE) {
      await browser.close();
      console.log('\n🎭 Browser closed');
    } else {
      console.log('\n🎭 Browser kept open for debugging (Debug Mode)');
      console.log('Press Ctrl+C to exit...');
      // Keep the process alive
      await new Promise(() => {});
    }
  }
}

// Run the script
createApiKey().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});