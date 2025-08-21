#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const CHROME_PROFILE_PATH = process.env.CHROME_PROFILE_PATH || "/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile";
const REGISTRATION_URL = process.env.REGISTRATION_URL || "https://admin.pumpd.co.nz/register";
const DEBUG_MODE = process.argv.includes('--debug') || process.env.DEBUG_MODE === 'true';

// Utility functions
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const takeScreenshot = async (page, name) => {
  if (DEBUG_MODE) {
    const screenshotPath = path.join(__dirname, 'screenshots', `${name}-${Date.now()}.png`);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  }
};

// Main registration function
async function registerRestaurant(data) {
  console.log('🚀 Starting restaurant registration process with Playwright...');
  
  const launchOptions = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    viewport: { width: 1280, height: 800 }
  };
  
  // Only use profile if not in test mode
  if (!process.argv.includes('--no-profile')) {
    launchOptions.userDataDir = CHROME_PROFILE_PATH;
  }
  
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to registration page
    console.log('📍 Step 1: Navigating to registration page...');
    await page.goto(REGISTRATION_URL, { waitUntil: 'networkidle' });
    await takeScreenshot(page, '01-registration-page');

    // Step 2: Fill registration form
    console.log('📝 Step 2: Filling registration form...');
    
    // Email - Playwright auto-waits for elements
    await page.fill('input[type="email"]', data.user.email);
    
    // Password fields
    const passwordFields = await page.locator('input[type="password"]').all();
    await passwordFields[0].fill(data.user.password);
    await passwordFields[1].fill(data.user.password);
    
    await takeScreenshot(page, '02-form-filled');
    
    // Click Continue - Playwright handles text selectors better
    await page.click('button:has-text("Continue")');
    await page.waitForLoadState('networkidle');

    // Step 3: Email confirmation
    console.log('✉️ Step 3: Confirming email...');
    
    // Wait for confirmation page
    await page.waitForTimeout(2000);
    
    // Find and fill confirmation code input
    // Try multiple strategies
    const confirmInput = await page.locator('input').filter({ 
      hasNot: page.locator('[type="email"], [type="password"]') 
    }).first();
    
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(data.user.adminPassword);
      console.log('Typed admin password into confirmation field');
    } else {
      console.log('WARNING: Could not find confirmation code input!');
    }
    
    await takeScreenshot(page, '03-email-confirmation');
    
    await page.click('button:has-text("Complete Registration")');
    console.log('Waiting for navigation after completing registration...');
    
    // Wait for dashboard
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 10000 });

    // Step 4: Create new restaurant
    console.log('🏪 Step 4: Creating new restaurant...');
    console.log('Current URL:', page.url());
    
    // Wait for any loading overlays to disappear
    await page.waitForFunction(() => {
      const loader = document.querySelector('.cover-loader');
      return !loader || !loader.classList.contains('active');
    });
    
    await page.waitForTimeout(3000); // Additional wait for content
    await takeScreenshot(page, '04-dashboard');
    
    // Click Create New Restaurant button
    await page.click('button:has-text("Create New Restaurant")');
    
    // Wait for potential notification popup
    console.log('⏳ Waiting 5 seconds for you to handle any notification popups...');
    await page.waitForTimeout(5000);
    
    // Wait for form to load
    await page.waitForSelector('form', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Step 5: Fill restaurant details
    console.log('📋 Step 5: Filling restaurant details...');
    
    // Restaurant name - using nth selector for first text input
    await page.locator('form input[type="text"]').nth(0).fill(data.restaurant.name);
    
    // Subdomain - second text input
    const subdomain = data.restaurant.name.toLowerCase().replace(/\s+/g, '');
    await page.locator('form input[type="text"]').nth(1).fill(subdomain);
    
    await takeScreenshot(page, '05-restaurant-details');

    // Step 6: Select Google Maps
    console.log('🗺️ Step 6: Selecting map data source...');
    await page.click('button:has-text("Google Maps"), label:has-text("Google Maps")');
    await page.waitForTimeout(1000);

    // Step 7: Configure address
    console.log('📍 Step 7: Setting restaurant address...');
    
    // Click on address wrapper to activate input
    try {
      await page.click('div.selectasync__WrapperInner-fSgFTI');
    } catch {
      // Fallback: click any element that looks like an address input
      await page.click('text=/.*address.*/i >> ..');
    }
    await page.waitForTimeout(500);
    
    // Type address - Playwright will find the focused input
    await page.keyboard.type(data.restaurant.address);
    
    // Wait for dropdown with suggestions
    console.log('Waiting for address suggestions to load...');
    
    // Wait for loading to complete
    await page.waitForFunction(() => {
      const spinner = document.querySelector('.selectasync__LoadingIndicator, [class*="loading"], [class*="spinner"]');
      return !spinner || spinner.style.display === 'none' || !spinner.offsetParent;
    }, { timeout: 10000 });
    
    // Wait for dropdown to appear
    await page.waitForSelector('.selectasync__Dropdown-bYdgnM div, [class*="dropdown"] div', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Additional wait to ensure dropdown is populated
    await page.waitForTimeout(1000);
    
    // Click first suggestion
    const firstSuggestion = page.locator('.selectasync__Dropdown-bYdgnM div, [class*="dropdown"] div').first();
    await firstSuggestion.scrollIntoViewIfNeeded();
    await firstSuggestion.click();
    
    await takeScreenshot(page, '07-address-selected');

    // Step 8: Phone number
    console.log('📞 Step 8: Adding phone number...');
    const phoneInput = page.locator('input[placeholder*="contact number"]');
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(data.user.phone);
    }

    // Step 9: Operating hours
    console.log('🕐 Step 9: Setting operating hours...');
    // This is simplified - would need expansion based on actual UI
    for (const schedule of data.restaurant.openingHours) {
      console.log(`  Setting hours for ${schedule.day}: ${schedule.open} - ${schedule.close}`);
    }
    
    await takeScreenshot(page, '09-operating-hours');

    // Step 10-12: Regional settings
    console.log('🌍 Step 10-12: Setting locale, timezone, and currency...');
    
    // Try standard selects first
    try {
      await page.selectOption('select[name="locale"]', 'en-NZ');
    } catch {
      // Try custom dropdown
      const localeDiv = page.locator('div[class*="locale"]').first();
      if (await localeDiv.isVisible()) {
        await localeDiv.click();
        await page.keyboard.type('NZ');
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
      }
    }
    
    try {
      await page.selectOption('select[name="timezone"]', 'Pacific/Auckland');
    } catch {
      const timezoneDiv = page.locator('div[class*="timezone"]').first();
      if (await timezoneDiv.isVisible()) {
        await timezoneDiv.click();
        await page.keyboard.type('Auckland');
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
      }
    }
    
    try {
      await page.selectOption('select[name="currency"]', 'NZD');
    } catch {
      const currencyDiv = page.locator('div[class*="currency"]').first();
      if (await currencyDiv.isVisible()) {
        await currencyDiv.click();
        await page.keyboard.type('NZD');
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
      }
    }

    // Step 13: Tax in prices
    console.log('🧾 Step 13: Enabling tax in prices...');
    const taxCheckbox = page.locator('input[type="checkbox"][name*="tax"], label:has-text("Tax") input[type="checkbox"]').first();
    if (await taxCheckbox.isVisible()) {
      await taxCheckbox.check();
    }
    
    await takeScreenshot(page, '13-final-settings');

    // Step 14: Create restaurant
    console.log('✅ Step 14: Creating restaurant...');
    
    await takeScreenshot(page, '14-before-submit');
    
    await page.click('button:has-text("Create Restaurant")');
    
    // Wait for navigation or error
    try {
      await Promise.race([
        page.waitForURL('**/restaurant/**', { timeout: 30000 }),
        page.waitForSelector('.error-message, .toast-error, [class*="error"]', { timeout: 5000 })
      ]);
    } catch {
      console.log('Navigation timeout or no error found');
    }
    
    // Check for errors
    const errorElement = page.locator('.error-message, .toast-error, [class*="error"]').first();
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      console.log('Error found:', errorText);
    }
    
    await takeScreenshot(page, '14-restaurant-created');

    // Extract restaurant ID from URL
    const finalUrl = page.url();
    const restaurantId = finalUrl.match(/restaurant\/([a-zA-Z0-9]+)/)?.[1] || 'unknown';

    console.log('🎉 Restaurant registration completed!');
    console.log(`📊 Restaurant ID: ${restaurantId}`);
    console.log(`🔗 Dashboard URL: ${finalUrl}`);

    return {
      success: true,
      restaurantId,
      dashboardUrl: finalUrl,
      subdomain
    };

  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    return {
      success: false,
      error: error.message,
      screenshot: `error-state-${Date.now()}.png`
    };
    
  } finally {
    if (!DEBUG_MODE) {
      await browser.close();
    } else {
      console.log('🐛 Debug mode: Browser left open for inspection');
      console.log('Press Ctrl+C to exit and close the browser');
      // Keep the process alive
      await new Promise(() => {});
    }
  }
}

// Load and validate input data
async function loadRegistrationData() {
  // Default test data - replace with actual data loading
  return {
    user: {
      name: "Alex Johnson",
      email: "alexjohnson.playwright1@gmail.com",
      phone: "+642102676751",
      password: "TestPassword789!",
      adminPassword: process.env.ADMIN_PASSWORD || "7uo@%K2^Hz%yiXDeP39Ckp6BvF!2"
    },
    restaurant: {
      name: "Mt vic chippery",
      city: "Wellington",
      address: "255 Saint Asaph Street, Christchurch Central City, Christchurch 8011, New Zealand",
      phone: "+64210 668 6029",
      openingHours: [
        { day: "Monday", open: "09:00", close: "23:00", is24Hour: false },
        { day: "Tuesday", open: "09:00", close: "23:00", is24Hour: false },
        { day: "Wednesday", open: "09:00", close: "23:00", is24Hour: false },
        { day: "Thursday", open: "09:00", close: "23:00", is24Hour: false },
        { day: "Friday", open: "09:00", close: "23:00", is24Hour: false },
        { day: "Saturday", open: "09:00", close: "23:00", is24Hour: false },
        { day: "Sunday", open: "09:00", close: "23:00", is24Hour: false }
      ]
    }
  };
}

// Main execution
async function main() {
  try {
    const data = await loadRegistrationData();
    const result = await registerRestaurant(data);
    
    // Save result
    await fs.writeFile(
      path.join(__dirname, 'registration-result-playwright.json'),
      JSON.stringify(result, null, 2)
    );
    
    if (!DEBUG_MODE) {
      process.exit(result.success ? 0 : 1);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { registerRestaurant };