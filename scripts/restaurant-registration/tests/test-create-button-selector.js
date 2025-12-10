#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const params = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  params[key.replace('--', '')] = value;
});

const TEST_DATA = {
  login: {
    email: params.email || process.env.TEST_EMAIL,
    password: params.password || process.env.TEST_PASSWORD
  }
};

// Validate required parameters
if (!TEST_DATA.login.email || !TEST_DATA.login.password) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password>');
  console.error('\nExample:');
  console.error('node test-create-button-selector.js --email=test@example.com --password=Password123!');
  process.exit(1);
}

// Load environment variables
const LOGIN_URL = process.env.LOGIN_URL || 'https://admin.pumpd.co.nz/login';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const HEADLESS = process.env.HEADLESS !== 'false';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || './screenshots';

// Create screenshots directory if it doesn't exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Generate unique timestamp for screenshots
const timestamp = Date.now();

// Screenshot helper
async function takeScreenshot(page, name) {
  const filename = `test-create-button-${name}-${timestamp}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${filepath}`);
}

async function testCreateButtonSelectors() {
  let browser;
  
  try {
    console.log('\n🚀 Starting Create Button Selector Test');
    console.log('================================');
    console.log(`📧 Email: ${TEST_DATA.login.email}`);
    console.log(`🔗 URL: ${LOGIN_URL}`);
    console.log(`🖥️  Mode: ${HEADLESS ? 'Headless' : 'Visible'}`);
    console.log('================================\n');
    
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    
    const page = await context.newPage();
    
    // STEP 1: Navigate to login page
    console.log('📍 STEP 1: Navigate to login page');
    await page.goto(LOGIN_URL);
    console.log('  ✓ Loaded login page');
    
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, '01-login-page');
    
    // STEP 2: Fill login credentials
    console.log('\n🔐 STEP 2: Fill login credentials');
    
    await page.fill('input[type="email"]', TEST_DATA.login.email);
    console.log('  ✓ Filled email');
    
    await page.fill('input[type="password"]', TEST_DATA.login.password);
    console.log('  ✓ Filled password');
    
    await takeScreenshot(page, '02-credentials-filled');
    
    // STEP 3: Submit login
    console.log('\n🚪 STEP 3: Submit login');
    
    try {
      // Try multiple selectors for the login button
      const loginButton = await page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first();
      await loginButton.click();
      console.log('  ✓ Clicked login button');
    } catch (error) {
      console.log('  ⚠️ Standard selectors failed, trying form submit button...');
      await page.locator('form button[type="submit"]').first().click();
      console.log('  ✓ Clicked form submit button');
    }
    
    // STEP 4: Wait for dashboard
    console.log('\n⏳ STEP 4: Waiting for dashboard...');
    
    try {
      await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
      console.log('  ✓ Successfully logged in!');
      console.log('  ✓ Redirected to dashboard');
    } catch (error) {
      const currentUrl = page.url();
      if (currentUrl.includes('admin.pumpd.co.nz')) {
        console.log('  ✓ Successfully logged in (already on dashboard)');
      } else {
        throw new Error('Login failed - not redirected to dashboard');
      }
    }
    
    await page.waitForLoadState('networkidle');
    console.log('  ⏳ Waiting for dashboard content to load...');
    
    // Wait longer for the dashboard to fully load
    await page.waitForTimeout(8000);
    
    // Try to wait for h4 elements to appear (restaurant names)
    try {
      await page.waitForSelector('h4', { timeout: 10000 });
      console.log('  ✓ Dashboard content loaded');
    } catch (error) {
      console.log('  ⚠️ No h4 elements found after waiting');
    }
    
    await takeScreenshot(page, '03-dashboard');
    
    // STEP 5: Check for existing restaurants
    console.log('\n🔍 STEP 5: Check for existing restaurants');
    
    // Check if there are any h4 elements (restaurant names)
    const restaurantCount = await page.locator('h4').count();
    console.log(`  ℹ️ Found ${restaurantCount} restaurants on the dashboard`);
    
    if (restaurantCount > 0) {
      console.log('  ✅ Account has existing restaurants');
      const restaurantNames = await page.locator('h4').allTextContents();
      console.log('  📋 Restaurant list:');
      restaurantNames.forEach((name, index) => {
        console.log(`    ${index + 1}. ${name}`);
      });
    } else {
      console.log('  ✅ Account has no restaurants (first-time setup)');
    }
    
    // STEP 6: Test button selectors
    console.log('\n🔬 STEP 6: Test Create/Add Restaurant button selectors');
    console.log('=' .repeat(60));
    
    // Test Strategy 1: Primary selector (for accounts with no restaurants)
    console.log('\n📌 Strategy 1: Primary selector (Create New Restaurant)');
    const primarySelector = 'button:has-text("Create New Restaurant")';
    const primaryButton = page.locator(primarySelector);
    const primaryCount = await primaryButton.count();
    
    if (primaryCount > 0) {
      console.log(`  ✅ Found "${primarySelector}" - Count: ${primaryCount}`);
      console.log('  📍 Button text:', await primaryButton.first().textContent());
      console.log('  📍 Button visible:', await primaryButton.first().isVisible());
    } else {
      console.log(`  ❌ NOT FOUND: "${primarySelector}"`);
    }
    
    // Test Strategy 2: Fallback selectors (for accounts with existing restaurants)
    console.log('\n📌 Strategy 2: Fallback selectors (Add/New Restaurant)');
    const fallbackSelectors = [
      'button:has-text("Add Restaurant")',
      'button:has-text("New Restaurant")',
      'a:has-text("Add Restaurant")',
      'a:has-text("New Restaurant")'
    ];
    
    for (const selector of fallbackSelectors) {
      const button = page.locator(selector);
      const count = await button.count();
      
      if (count > 0) {
        console.log(`  ✅ Found "${selector}" - Count: ${count}`);
        console.log(`     📍 Text: "${await button.first().textContent()}"`);
        console.log(`     📍 Visible: ${await button.first().isVisible()}`);
      } else {
        console.log(`  ❌ NOT FOUND: "${selector}"`);
      }
    }
    
    // Test combined fallback selector
    console.log('\n📌 Testing combined fallback selector:');
    const combinedFallback = page.locator('button:has-text("Add Restaurant"), button:has-text("New Restaurant"), a:has-text("Add Restaurant"), a:has-text("New Restaurant")').first();
    const combinedCount = await combinedFallback.count();
    
    if (combinedCount > 0) {
      console.log('  ✅ Combined fallback selector found an element');
      console.log(`     📍 Text: "${await combinedFallback.textContent()}"`);
      console.log(`     📍 Visible: ${await combinedFallback.isVisible()}`);
      console.log(`     📍 Element type: ${await combinedFallback.evaluate(el => el.tagName)}`);
    } else {
      console.log('  ❌ Combined fallback selector found nothing');
    }
    
    // Test Strategy 3: Check for dropdown menus
    console.log('\n📌 Strategy 3: Check for dropdown menus');
    const dropdownSelectors = [
      'button[aria-label*="restaurants"]',
      'button:has-text("Restaurants")',
      'button[aria-expanded]',
      'button.dropdown-toggle'
    ];
    
    for (const selector of dropdownSelectors) {
      const dropdown = page.locator(selector);
      const count = await dropdown.count();
      
      if (count > 0) {
        console.log(`  ✅ Found dropdown: "${selector}" - Count: ${count}`);
        console.log(`     📍 Text: "${await dropdown.first().textContent()}"`);
      } else {
        console.log(`  ❌ NOT FOUND: "${selector}"`);
      }
    }
    
    // STEP 7: Proposed unified approach
    console.log('\n💡 STEP 7: Test proposed unified approach');
    console.log('=' .repeat(60));
    
    console.log('\nProposed approach:');
    console.log('1. First try: button:has-text("Create New Restaurant")');
    console.log('2. If not found, fallback to: Add Restaurant variants');
    
    let buttonFound = false;
    let buttonToClick = null;
    let buttonDescription = '';
    
    // Try primary selector first
    const primaryBtn = page.locator('button:has-text("Create New Restaurant")');
    if (await primaryBtn.count() > 0) {
      buttonFound = true;
      buttonToClick = primaryBtn;
      buttonDescription = 'Primary: "Create New Restaurant"';
      console.log('\n✅ Would use PRIMARY selector');
    } else {
      // Try fallback selectors
      const fallbackBtn = page.locator('button:has-text("Add Restaurant"), button:has-text("New Restaurant"), a:has-text("Add Restaurant"), a:has-text("New Restaurant")').first();
      if (await fallbackBtn.count() > 0) {
        buttonFound = true;
        buttonToClick = fallbackBtn;
        buttonDescription = 'Fallback: Add/New Restaurant variant';
        console.log('\n✅ Would use FALLBACK selector');
      }
    }
    
    if (buttonFound) {
      console.log(`  📍 Button found: ${buttonDescription}`);
      console.log(`  📍 Button text: "${await buttonToClick.textContent()}"`);
      console.log(`  📍 Button visible: ${await buttonToClick.isVisible()}`);
      console.log('\n🎯 RECOMMENDATION: Unified approach would work!');
      console.log('  No need for hasExistingRestaurants flag');
    } else {
      console.log('\n⚠️ WARNING: No create/add button found with either approach');
      console.log('  Manual inspection needed for this account type');
    }
    
    // STEP 8: Summary
    console.log('\n📊 SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Account type: ${restaurantCount > 0 ? 'Has existing restaurants' : 'No restaurants (first-time)'}`);
    console.log(`Restaurant count: ${restaurantCount}`);
    console.log(`Primary selector found: ${await primaryBtn.count() > 0 ? 'Yes' : 'No'}`);
    console.log(`Fallback selector found: ${combinedCount > 0 ? 'Yes' : 'No'}`);
    console.log(`Unified approach viable: ${buttonFound ? '✅ YES' : '❌ NO'}`);
    
    await takeScreenshot(page, '04-final-state');
    
    console.log('\n✅ TEST COMPLETED!');
    console.log('=' .repeat(60));
    
    // Success - close browser and exit
    if (!DEBUG_MODE) {
      await browser.close();
      console.log('✨ Browser closed');
    }
    
    return { 
      success: true, 
      hasRestaurants: restaurantCount > 0, 
      unifiedApproachWorks: buttonFound 
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (browser) {
      const page = browser.contexts()[0]?.pages()[0];
      if (page) {
        await takeScreenshot(page, 'error-state');
        console.log('\nCurrent URL:', page.url());
        console.log('Page title:', await page.title());
      }
    }
    
    throw error;
    
  } finally {
    if (DEBUG_MODE) {
      console.log('\n⚠️ Debug mode - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    } else if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testCreateButtonSelectors()
  .then(result => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });