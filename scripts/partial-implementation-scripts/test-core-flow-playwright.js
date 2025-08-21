#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const REGISTRATION_URL = "https://admin.pumpd.co.nz/register";
const DEBUG_MODE = true; // Always debug for testing

// Test data
const TEST_DATA = {
  user: {
    name: "Test Core Flow",
    email: "testcoreflow1@gmail.com",
    phone: "+642102676755",
    password: "TestPassword789!",
    adminPassword: process.env.ADMIN_PASSWORD || "7uo@%K2^Hz%yiXDeP39Ckp6BvF!2"
  },
  restaurant: {
    name: "Mt vic chippery",
    address: "255 Saint Asaph Street, Christchurch Central City, Christchurch 8011, New Zealand"
  }
};

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `core-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function testCoreFlow() {
  console.log('🚀 Starting CORE FLOW TEST with Playwright...\n');
  
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
    // STEP 1: Registration
    console.log('📍 STEP 1: Navigate to registration page');
    await page.goto(REGISTRATION_URL, { waitUntil: 'networkidle' });
    await takeScreenshot(page, '01-registration-page');
    
    // STEP 2: Fill registration form
    console.log('\n📝 STEP 2: Fill registration form');
    await page.fill('input[type="email"]', TEST_DATA.user.email);
    console.log('  ✓ Email filled');
    
    const passwordFields = await page.locator('input[type="password"]').all();
    await passwordFields[0].fill(TEST_DATA.user.password);
    await passwordFields[1].fill(TEST_DATA.user.password);
    console.log('  ✓ Passwords filled');
    
    await takeScreenshot(page, '02-form-filled');
    
    // Click Continue
    await page.click('button:has-text("Continue")');
    console.log('  ✓ Clicked Continue');
    await page.waitForLoadState('networkidle');
    
    // STEP 3: Email confirmation
    console.log('\n✉️ STEP 3: Email confirmation');
    await page.waitForTimeout(2000);
    
    // Find the confirmation input
    const confirmInput = page.locator('input:visible').filter({ 
      hasNot: page.locator('[type="email"], [type="password"], [type="hidden"]') 
    }).first();
    
    await confirmInput.fill(TEST_DATA.user.adminPassword);
    console.log('  ✓ Admin password entered');
    
    await takeScreenshot(page, '03-email-confirmation');
    
    // Complete registration
    await page.click('button:has-text("Complete Registration")');
    console.log('  ✓ Clicked Complete Registration');
    
    // Wait for dashboard
    console.log('\n⏳ Waiting for dashboard...');
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
    console.log('  ✓ Reached dashboard:', page.url());
    
    // STEP 4: Wait for loading overlay
    console.log('\n🔄 STEP 4: Wait for loading overlay to disappear');
    await page.waitForFunction(() => {
      const loader = document.querySelector('.cover-loader');
      return !loader || !loader.classList.contains('active');
    }, { timeout: 10000 });
    console.log('  ✓ Loading overlay gone');
    
    await page.waitForTimeout(3000); // Extra wait
    await takeScreenshot(page, '04-dashboard-loaded');
    
    // STEP 5: Click Create New Restaurant
    console.log('\n🏪 STEP 5: Click Create New Restaurant button');
    
    // Debug: List all buttons
    const buttons = await page.locator('button').all();
    console.log(`  Found ${buttons.length} buttons on page`);
    
    // Try to click the button
    const createButton = page.locator('button:has-text("Create New Restaurant")');
    await createButton.click();
    console.log('  ✓ Clicked Create New Restaurant');
    
    // Wait for form
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('  ✓ Form loaded');
    await page.waitForTimeout(2000);
    
    // STEP 6: Fill restaurant details
    console.log('\n📋 STEP 6: Fill restaurant name and subdomain');
    
    // Restaurant name
    const nameInput = page.locator('form input[type="text"]').nth(0);
    await nameInput.fill(TEST_DATA.restaurant.name);
    console.log('  ✓ Restaurant name filled');
    
    // Subdomain
    const subdomain = TEST_DATA.restaurant.name.toLowerCase().replace(/\s+/g, '');
    
    // The subdomain might be in a wrapper div, not a direct input
    try {
      // Try the specific selector from the user
      const subdomainWrapper = page.locator('form > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.inputgroup__InputGroupField-cWVTlp.ezKAHp');
      await subdomainWrapper.click();
      await page.waitForTimeout(200);
      
      // Now find the input inside or the focused element
      const subdomainInput = await page.locator('input:focus');
      await subdomainInput.fill(subdomain);
      console.log('  ✓ Subdomain filled (via wrapper click)');
    } catch {
      // Fallback to second text input
      const subdomainInput = page.locator('form input[type="text"]').nth(1);
      await subdomainInput.fill(subdomain);
      console.log('  ✓ Subdomain filled (direct input)');
    }
    
    await takeScreenshot(page, '06-restaurant-details');
    
    // STEP 7: Select Google Maps
    console.log('\n🗺️ STEP 7: Select Google Maps');
    
    // Try different selectors
    try {
      await page.click('button:has-text("Google Maps")');
      console.log('  ✓ Clicked Google Maps button');
    } catch {
      try {
        await page.click('label:has-text("Google Maps")');
        console.log('  ✓ Clicked Google Maps label');
      } catch {
        console.log('  ❌ Could not find Google Maps selector');
      }
    }
    
    await page.waitForTimeout(1000);
    
    // STEP 8: Address input
    console.log('\n📍 STEP 8: Enter address');
    
    // Click address field
    try {
      // Try specific class first
      await page.click('div.selectasync__WrapperInner-fSgFTI.eMHWRb');
      console.log('  ✓ Clicked address wrapper (specific class)');
    } catch {
      // Fallback to any address-like field
      await page.click('text=/address/i >> ..');
      console.log('  ✓ Clicked address field (text search)');
    }
    
    await page.waitForTimeout(500);
    
    // Type address
    await page.keyboard.type(TEST_DATA.restaurant.address);
    console.log('  ✓ Typed address');
    
    // STEP 9: Wait for dropdown and click first result
    console.log('\n📍 STEP 9: Wait for address suggestions');
    
    // Wait for loading to finish
    console.log('  ⏳ Waiting for loading spinner to disappear...');
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('.selectasync__LoadingIndicator, [class*="loading"], [class*="spinner"]');
      return Array.from(spinners).every(spinner => 
        !spinner || spinner.style.display === 'none' || !spinner.offsetParent
      );
    }, { timeout: 15000 });
    console.log('  ✓ Loading complete');
    
    // Wait for dropdown
    await page.waitForSelector('.selectasync__Dropdown-bYdgnM div, [class*="dropdown"] div', { 
      state: 'visible',
      timeout: 10000 
    });
    console.log('  ✓ Dropdown visible');
    
    await page.waitForTimeout(1000); // Ensure populated
    
    // Click first suggestion
    const firstSuggestion = page.locator('.selectasync__Dropdown-bYdgnM div').first();
    await firstSuggestion.click();
    console.log('  ✓ Clicked first address suggestion');
    
    await takeScreenshot(page, '09-address-selected');
    
    console.log('\n✅ CORE FLOW TEST COMPLETED!');
    console.log('The form is ready for the next steps (phone, hours, etc.)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    // More detailed error info
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
  } finally {
    console.log('\n🐛 Browser left open for inspection');
    console.log('Press Ctrl+C to exit');
    await new Promise(() => {}); // Keep alive
  }
}

// Run the test
testCoreFlow();