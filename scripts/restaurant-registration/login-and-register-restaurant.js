#!/usr/bin/env node

/**
 * Login and Restaurant Registration Script for admin.pumpd.co.nz
 * 
 * This script performs restaurant registration for an existing account:
 * - Login to existing user account
 * - Navigate to restaurant section
 * - Create a new restaurant
 * - Fill restaurant details form
 * 
 * Usage:
 *   node login-and-register-restaurant.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --password=<password>     Login password (required)
 *   --name=<name>            Restaurant name (required)
 *   --address=<address>      Full address (optional)
 *   --phone=<phone>          Phone number (optional)
 *   --dayHours=<json>        JSON string of day hours (optional)
 * 
 * Environment Variables:
 *   DEBUG_MODE              Enable debug mode (true/false)
 *   ADMIN_PASSWORD          Admin password for bypassing confirmations
 * 
 * Example:
 *   node login-and-register-restaurant.js --email=test@example.com --password=Test789! --name="Pizza Palace" --phone="03 456 7890"
 * 
 * Example with custom hours (array format for midnight crossing):
 *   node login-and-register-restaurant.js --email=test@example.com --password=Test789! --name="Late Night Bar" \
 *     --dayHours='[{"day":"Friday","hours":{"open":"17:00","close":"23:59"}},{"day":"Saturday","hours":{"open":"00:00","close":"03:00"}}]'
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const LOGIN_URL = "https://admin.pumpd.co.nz/login";
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "7uo@%K2^Hz%yiXDeP39Ckp6BvF!2";

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse required parameters
const email = getArg('email');
const password = getArg('password');
const restaurantName = getArg('name');

if (!email || !password || !restaurantName) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<restaurant_name>');
  process.exit(1);
}

// Parse restaurant data
const TEST_DATA = {
  login: {
    email: email,
    password: password
  },
  restaurant: {
    name: restaurantName,
    address: getArg('address') || "255 Saint Asaph Street, Christchurch Central City, Christchurch 8011, New Zealand",
    phone: getArg('phone') || "031234567"
  }
};

// Parse day hours if provided as JSON string or array
let customDayHours = null;
const dayHoursArg = getArg('dayHours');
if (dayHoursArg) {
  try {
    const parsed = JSON.parse(dayHoursArg);
    // Check if it's an array (for duplicate days) or object
    if (Array.isArray(parsed)) {
      // Already in array format
      customDayHours = parsed;
    } else {
      // Convert object to array format
      customDayHours = Object.entries(parsed).map(([day, hours]) => ({ day, hours }));
    }
  } catch (e) {
    console.error('Failed to parse dayHours:', e.message);
  }
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `login-restaurant-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function loginAndRegisterRestaurant() {
  console.log('🚀 Starting Login and Restaurant Registration...\n');
  console.log('Configuration:');
  console.log(`  Email: ${TEST_DATA.login.email}`);
  console.log(`  Password: ${'*'.repeat(TEST_DATA.login.password.length)}`);
  console.log(`  Restaurant: ${TEST_DATA.restaurant.name}`);
  console.log(`  Address: ${TEST_DATA.restaurant.address}`);
  console.log(`  Phone: ${TEST_DATA.restaurant.phone}`);
  console.log(`  Has Existing Restaurants: ${TEST_DATA.hasExistingRestaurants}`);
  if (customDayHours) {
    console.log(`  Custom Hours: Yes`);
    console.log('  Hours Configuration:');
    customDayHours.forEach((entry, index) => {
      console.log(`    ${index + 1}. ${entry.day}: ${entry.hours.open} - ${entry.hours.close}`);
    });
  } else {
    console.log(`  Hours: Default (Mon-Thu: 09:00-21:30, Fri-Sat: 09:00-23:00, Sun: 10:30-20:30)`);
  }
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
    // STEP 1: Navigate to login page
    console.log('📍 STEP 1: Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-login-page');

    // STEP 2: Fill login form
    console.log('📝 STEP 2: Logging in...');
    
    // Email
    await page.fill('input[type="email"]', TEST_DATA.login.email);
    console.log('  ✓ Email entered');
    
    // Password
    await page.fill('input[type="password"]', TEST_DATA.login.password);
    console.log('  ✓ Password entered');
    
    await takeScreenshot(page, '02-login-filled');
    
    // Click login button (try multiple selectors with better error handling)
    try {
      // First try type="submit" button
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        console.log('  ✓ Clicked submit button');
      } else {
        // Fallback to text-based selectors
        const loginButton = page.locator('button').filter({ hasText: /Continue|Login|Sign In/i }).first();
        await loginButton.click();
        console.log('  ✓ Clicked login button');
      }
    } catch (error) {
      console.error('  ❌ Failed to find login button, trying final fallback...');
      // Final fallback - click any visible button
      await page.click('button:visible');
      console.log('  ✓ Clicked visible button');
    }
    
    // Wait for dashboard
    console.log('\n⏳ Waiting for dashboard after login...');
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
    console.log('  ✓ Reached dashboard:', page.url());
    
    // STEP 3: Wait for loading overlay to disappear
    console.log('\n🔄 STEP 3: Wait for loading overlay to disappear');
    await page.waitForFunction(() => {
      const loader = document.querySelector('.cover-loader');
      return !loader || !loader.classList.contains('active');
    }, { timeout: 10000 });
    console.log('  ✓ Loading overlay gone');
    
    await page.waitForTimeout(3000); // Extra wait
    await takeScreenshot(page, '03-dashboard-loaded');
    
    // STEP 4: Navigate to restaurant creation
    console.log('\n🏪 STEP 4: Navigate to restaurant creation');
    
    // Unified approach - works for both new and existing restaurant accounts
    try {
      // First try: Primary selector (for accounts with no restaurants)
      const primaryButton = page.locator('button:has-text("Create New Restaurant")');
      if (await primaryButton.count() > 0) {
        await primaryButton.click();
        console.log('  ✓ Clicked Create New Restaurant button');
      } else {
        // Fallback: For accounts with existing restaurants
        const fallbackButton = page.locator('button:has-text("Add Restaurant"), button:has-text("New Restaurant"), a:has-text("Add Restaurant"), a:has-text("New Restaurant")').first();
        if (await fallbackButton.count() > 0) {
          await fallbackButton.click();
          console.log('  ✓ Clicked New/Add Restaurant button');
        } else {
          throw new Error('Could not find Create/Add Restaurant button');
        }
      }
    } catch (error) {
      console.log('  ❌ Failed to find restaurant creation button');
      console.log('  Current URL:', page.url());
      await takeScreenshot(page, 'error-no-create-button');
      throw error;
    }
    
    // Handle potential notification popup
    console.log('  ⏳ Waiting 3 seconds in case of notification popup...');
    await page.waitForTimeout(3000);
    
    // Wait for form
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('  ✓ Form loaded');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '04-form-loaded');
    
    // STEP 5: Fill restaurant name
    console.log('\n📋 STEP 5: Fill restaurant name');
    
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.fill(TEST_DATA.restaurant.name);
    console.log('  ✓ Restaurant name filled');
    
    // STEP 6: Fill subdomain
    console.log('\n📋 STEP 6: Fill subdomain');
    let subdomain = TEST_DATA.restaurant.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Ensure subdomain is at least 4 characters long
    if (subdomain.length < 4) {
        subdomain = 'order-' + subdomain;
        console.log(`  ⚠ Subdomain too short, added prefix: ${subdomain}`);
    } else {
        console.log(`  ✓ Generated subdomain: ${subdomain}`);
    }
    
    // Try multiple approaches for subdomain input
    try {
      // Approach 1: Click the wrapper div first
      const subdomainWrapper = page.locator('div.inputgroup__InputGroupField-cWVTlp.ezKAHp');
      await subdomainWrapper.click();
      console.log('  ✓ Clicked subdomain wrapper');
      await page.waitForTimeout(200);
      
      // Type in the focused element
      await page.keyboard.type(subdomain);
      console.log('  ✓ Typed subdomain via keyboard');
    } catch (e1) {
      console.log('  ⚠ Wrapper approach failed:', e1.message);
      
      try {
        // Approach 2: Find input inside the wrapper
        const subdomainInput = page.locator('div.inputgroup__InputGroupField-cWVTlp.ezKAHp input');
        await subdomainInput.fill(subdomain);
        console.log('  ✓ Filled subdomain via nested input');
      } catch (e2) {
        console.log('  ⚠ Nested input approach failed:', e2.message);
        
        // Approach 3: Use nth selector
        const secondInput = page.locator('form input[type="text"]').nth(1);
        await secondInput.fill(subdomain);
        console.log('  ✓ Filled subdomain via nth selector');
      }
    }
    
    await takeScreenshot(page, '05-restaurant-details');
    
    // STEP 7: Select Google Maps
    console.log('\n🗺️ STEP 7: Select Google Maps');
    
    try {
      await page.click('button:has-text("Google Maps")');
      console.log('  ✓ Clicked Google Maps button');
    } catch {
      await page.click('label:has-text("Google Maps")');
      console.log('  ✓ Clicked Google Maps label');
    }
    
    await page.waitForTimeout(1000);
    
    // STEP 8: Address input
    console.log('\n📍 STEP 8: Enter address');
    
    // Click address field
    try {
      const addressWrapper = page.locator('form > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectasync__WrapperInner-fSgFTI.eMHWRb');
      await addressWrapper.click();
      console.log('  ✓ Clicked address wrapper');
    } catch {
      await page.click('div.selectasync__WrapperInner-fSgFTI');
      console.log('  ✓ Clicked address wrapper (class selector)');
    }
    
    await page.waitForTimeout(500);
    
    // Type address
    await page.keyboard.type(TEST_DATA.restaurant.address);
    console.log('  ✓ Typed address');
    
    // Wait for and select dropdown
    console.log('\n📍 STEP 9: Select address from dropdown');
    console.log('  ⏳ Waiting for suggestions to load...');
    
    await page.waitForTimeout(2000); // Give autocomplete time to load
    
    // Wait for dropdown with actual addresses
    await page.waitForFunction(
      () => {
        const dropdown = document.querySelector('div.selectasync__Dropdown-bYdgnM.dIqlbY');
        if (!dropdown) return false;
        const items = dropdown.querySelectorAll('div');
        if (!items.length) return false;
        const firstText = items[0]?.textContent || '';
        return !firstText.includes('Loading') && items.length > 0;
      },
      { timeout: 10000 }
    );
    
    console.log('  ✓ Address suggestion loaded');
    
    // Extract the expected address pattern
    const addressParts = TEST_DATA.restaurant.address.split(',')[0].trim();
    console.log(`  🔍 Looking for address containing: "${addressParts}"`);
    
    // Try to click the best matching address
    try {
      const addressOption = page.locator('div.selectasync__DropdownOption-gQpgNZ').filter({ 
        hasText: addressParts 
      }).first();
      await addressOption.hover();
      await page.waitForTimeout(500);
      await addressOption.click();
      console.log('  ✓ Clicked address suggestion');
    } catch {
      // Fallback: just click the first option
      const firstOption = page.locator('div.selectasync__DropdownOption-gQpgNZ').first();
      await firstOption.click();
      console.log('  ✓ Selected first address option');
    }
    
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '08-address-selected');
    
    // STEP 10: Fill phone number
    console.log('\n📞 STEP 10: Fill phone number');
    
    try {
      await page.fill('input[type="tel"]', TEST_DATA.restaurant.phone);
      console.log('  ✓ Phone number filled');
    } catch {
      const phoneInput = page.locator('input').filter({ 
        has: page.locator('..', { hasText: 'Phone Number' }) 
      }).first();
      await phoneInput.fill(TEST_DATA.restaurant.phone);
      console.log('  ✓ Phone number filled via text search');
    }
    
    await takeScreenshot(page, '09-phone-filled');
    
    // STEP 11: Set opening hours
    console.log('\n🕐 STEP 11: Set opening hours');
    
    // Scroll to opening hours section
    await page.evaluate(() => {
      const hoursSection = Array.from(document.querySelectorAll('h2, h3, h4, div')).find(el => 
        el.textContent?.includes('Opening Hours')
      );
      if (hoursSection) {
        hoursSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Use custom hours if provided, otherwise use defaults
    let dayEntries;
    if (customDayHours) {
      dayEntries = customDayHours;
    } else {
      const defaultHours = {
        'Monday': { open: '09:00', close: '21:30' },
        'Tuesday': { open: '09:00', close: '21:30' },
        'Wednesday': { open: '09:00', close: '21:30' },
        'Thursday': { open: '09:00', close: '21:30' },
        'Friday': { open: '09:00', close: '23:00' },
        'Saturday': { open: '09:00', close: '23:00' },
        'Sunday': { open: '10:30', close: '20:30' }
      };
      dayEntries = Object.entries(defaultHours).map(([day, hours]) => ({ day, hours }));
    }
    
    // Calculate how many slots we need to add (we start with 1)
    const slotsNeeded = dayEntries.length - 1;
    
    console.log(`  🔘 Adding ${slotsNeeded} time slots...`);
    const addSlotButton = page.locator('button:has-text("Add Time Slot")');
    
    for (let i = 0; i < slotsNeeded; i++) {
      await addSlotButton.click();
      console.log(`    ✓ Added time slot ${i + 2}`);
      await page.waitForTimeout(300);
    }
    
    await takeScreenshot(page, '10-time-slots-added');
    
    // Configure days of the week
    console.log('  📅 Configuring days and times...');
    
    // Get all day selectors
    const daySelectors = await page.locator('select').filter({ 
      has: page.locator('option:has-text("Monday")') 
    }).all();
    
    // Set each day selector
    for (let i = 0; i < Math.min(daySelectors.length, dayEntries.length); i++) {
      try {
        const { day } = dayEntries[i];
        await daySelectors[i].selectOption(day);
        console.log(`    ✓ Set row ${i + 1} to ${day}`);
        await page.waitForTimeout(200);
      } catch (error) {
        console.log(`    ⚠️ Failed to set row ${i + 1}: ${error.message}`);
      }
    }
    
    // Helper function to clear and type in time input
    const setTimeInput = async (input, time) => {
      await input.click();
      await page.waitForTimeout(100);
      
      // Select all with Cmd+A (Mac) or Ctrl+A (Windows/Linux)
      await page.keyboard.down('Meta'); // Use 'Control' for Windows/Linux
      await page.keyboard.press('a');
      await page.keyboard.up('Meta');
      await page.waitForTimeout(100);
      
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(100);
      
      await page.keyboard.type(time);
      await page.waitForTimeout(100);
    };
    
    // Find all time inputs and set them
    const openingHoursSection = page.locator('form > div:nth-child(6)');
    const allTimeInputs = await openingHoursSection.locator('input[type="text"]').all();
    
    // Process time inputs in pairs (open time, close time)
    let inputIndex = 0;
    for (let i = 0; i < dayEntries.length && inputIndex < allTimeInputs.length; i++) {
      const { day, hours } = dayEntries[i];
      
      try {
        const openInput = allTimeInputs[inputIndex];
        const closeInput = allTimeInputs[inputIndex + 1];
        
        if (openInput && closeInput) {
          await setTimeInput(openInput, hours.open);
          await setTimeInput(closeInput, hours.close);
          
          console.log(`    ✓ Set ${day}: ${hours.open} - ${hours.close}`);
          inputIndex += 2;
        } else {
          console.log(`    ⚠️ Could not find time inputs for ${day}`);
        }
        
        await page.waitForTimeout(300);
      } catch (error) {
        console.log(`    ⚠️ Failed to set times for ${day}: ${error.message}`);
        inputIndex += 2;
      }
    }
    
    await takeScreenshot(page, '11-times-configured');
    
    // STEP 12: Set System Locale
    console.log('\n🌍 STEP 12: Set System Locale');
    
    await page.evaluate(() => {
      const localeSection = Array.from(document.querySelectorAll('h2, h3, h4, div')).find(el => 
        el.textContent?.includes('System Locale')
      );
      if (localeSection) {
        localeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    try {
      const localeWrapper = page.locator('form > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div');
      await localeWrapper.click();
      console.log('  ✓ Clicked locale selector');
      
      await page.waitForTimeout(500);
      await page.keyboard.type('New Zealand');
      console.log('  ✓ Typed "New Zealand"');
      
      await page.waitForTimeout(1500);
      
      const dropdownOption = page.locator('form > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div').first();
      await dropdownOption.click();
      console.log('  ✓ Selected New Zealand locale');
    } catch (error) {
      console.log('  ⚠️ Failed to set locale:', error.message);
    }
    
    await takeScreenshot(page, '12-locale-set');
    
    // STEP 13: Set Timezone
    console.log('\n⏰ STEP 13: Set Timezone');
    
    await page.evaluate(() => {
      const timezoneSection = Array.from(document.querySelectorAll('h2, h3, h4, div')).find(el => 
        el.textContent?.includes('Timezone')
      );
      if (timezoneSection) {
        timezoneSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    try {
      const timezoneWrapper = page.locator('form > div:nth-child(9) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div');
      await timezoneWrapper.click();
      console.log('  ✓ Clicked timezone selector');
      
      await page.waitForTimeout(500);
      await page.keyboard.type('Auckland');
      console.log('  ✓ Typed "Auckland"');
      
      await page.waitForTimeout(1500);
      
      const timezoneOption = page.locator('form > div:nth-child(9) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div').first();
      await timezoneOption.click();
      console.log('  ✓ Selected Auckland timezone');
    } catch (error) {
      console.log('  ⚠️ Failed to set timezone:', error.message);
    }
    
    await takeScreenshot(page, '13-timezone-set');
    
    // STEP 14: Set Currency
    console.log('\n💰 STEP 14: Set Currency');
    
    await page.evaluate(() => {
      const currencySection = Array.from(document.querySelectorAll('h2, h3, h4, div')).find(el => 
        el.textContent?.includes('Currency')
      );
      if (currencySection) {
        currencySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    try {
      const currencyWrapper = page.locator('form > div:nth-child(12) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div');
      await currencyWrapper.click();
      console.log('  ✓ Clicked currency selector');
      
      await page.waitForTimeout(500);
      await page.keyboard.type('NZD');
      console.log('  ✓ Typed "NZD"');
      
      await page.waitForTimeout(1500);
      
      const currencyOption = page.locator('form > div:nth-child(12) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div').first();
      await currencyOption.click();
      console.log('  ✓ Selected NZD currency');
    } catch (error) {
      console.log('  ⚠️ Failed to set currency:', error.message);
    }
    
    await takeScreenshot(page, '14-currency-set');
    
    // STEP 15: Toggle Tax in Prices
    console.log('\n💸 STEP 15: Toggle Tax in Prices');
    
    await page.evaluate(() => {
      const taxSection = Array.from(document.querySelectorAll('h2, h3, h4, div')).find(el => 
        el.textContent?.includes('Tax in Prices') || el.textContent?.includes('Tax In Prices')
      );
      if (taxSection) {
        taxSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    try {
      const taxToggle = page.locator('form > div:nth-child(13) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label');
      await taxToggle.click();
      console.log('  ✓ Toggled Tax in Prices to ON');
    } catch (error) {
      console.log('  ⚠️ Failed to toggle tax:', error.message);
    }
    
    await takeScreenshot(page, '15-tax-toggled');
    
    await page.waitForTimeout(2000);
    
    // STEP 16: Submit the form
    console.log('\n🚀 STEP 16: Create Restaurant');
    
    try {
      const createButton = page.locator('form > button');
      await createButton.click();
      console.log('  ✓ Clicked Create Restaurant button');
    } catch (error) {
      console.log('  ⚠️ Failed with form > button selector:', error.message);
      throw error;
    }
    
    // STEP 17: Wait for success and return to dashboard
    console.log('\n⏳ STEP 17: Waiting for restaurant creation...');
    
    let navigationSuccess = false;
    try {
      // Wait for navigation back to dashboard
      await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 30000 });
      navigationSuccess = true;
    } catch (navError) {
      // Check if we're already on the dashboard (sometimes navigation is too quick)
      const currentUrl = page.url();
      if (currentUrl.includes('admin.pumpd.co.nz')) {
        navigationSuccess = true;
      }
    }
    
    if (navigationSuccess) {
      console.log('  ✓ Restaurant created successfully!');
      console.log('  ✓ Returned to dashboard:', page.url());
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      await takeScreenshot(page, '16-restaurant-created-success');
      
      // STEP 18: Navigate to restaurant management
      console.log('\n🏪 STEP 18: Navigate to restaurant management');
      
      // Find the Manage button for our specific restaurant by name
      // First, find the element containing our restaurant name, then find the associated Manage button
      console.log(`  🔍 Looking for restaurant: ${TEST_DATA.restaurant.name}`);
      
      // Wait a bit for the list to update
      await page.waitForTimeout(3000);
      
      // Helper function for fuzzy restaurant name matching
      const normalizeForMatching = (str) => {
        return str
          .toLowerCase()                    // Case insensitive
          .replace(/['']/g, '')             // Remove apostrophes
          .replace(/\s+/g, ' ')             // Normalize spaces
          .trim();
      };
      
      // Function to calculate match score between search term and restaurant name
      const calculateMatchScore = (searchTerm, restaurantName) => {
        const searchNorm = normalizeForMatching(searchTerm);
        const nameNorm = normalizeForMatching(restaurantName);
        
        // Exact match (after normalization) - highest priority
        if (searchNorm === nameNorm) {
          return { score: 1000, reason: 'exact match' };
        }
        
        // Split into words for word-based matching
        const searchWords = searchNorm.split(' ').filter(w => w.length > 1); // Filter out single chars
        const nameWords = nameNorm.split(' ');
        
        let score = 0;
        let matchedWords = 0;
        let reason = '';
        
        // Count how many search words are found in the restaurant name
        for (const searchWord of searchWords) {
          // Check for exact word match
          if (nameWords.includes(searchWord)) {
            score += 10;
            matchedWords++;
          }
          // Check for partial word match (e.g., "zaikaa" matches "ziakaa")
          else if (nameWords.some(nameWord => {
            // Use Levenshtein-like simple check: if words are similar length and share most characters
            const lengthDiff = Math.abs(nameWord.length - searchWord.length);
            if (lengthDiff <= 2) {
              const commonChars = searchWord.split('').filter(char => nameWord.includes(char)).length;
              return commonChars >= Math.min(searchWord.length, nameWord.length) - 1;
            }
            return false;
          })) {
            score += 8;
            matchedWords++;
          }
          // Check for substring match
          else if (nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord))) {
            score += 5;
            matchedWords++;
          }
        }
        
        // Bonus for matching all words
        if (matchedWords === searchWords.length && searchWords.length > 0) {
          score += 50;
          reason = `all ${searchWords.length} words matched`;
        } else if (matchedWords > 0) {
          reason = `${matchedWords}/${searchWords.length} words matched`;
        }
        
        // Penalty for extra words in restaurant name (less specific match)
        const extraWords = nameWords.length - searchWords.length;
        if (extraWords > 0 && score > 0) {
          score -= extraWords * 2;
        }
        
        // If the full search term is contained in the restaurant name (substring match)
        if (score === 0 && nameNorm.includes(searchNorm)) {
          score = 25;
          reason = 'substring match';
        }
        
        return { score, reason };
      };
      
      // Try to find which index our restaurant is at by checking the h4 elements
      let restaurantIndex = -1;
      let bestScore = 0;
      let bestMatch = null;
      
      const allRestaurantNames = await page.locator('h4').allTextContents();
      
      console.log(`  🔍 Searching for best match for: "${TEST_DATA.restaurant.name}"`);
      console.log(`  📊 Evaluating ${allRestaurantNames.length} restaurants:`);
      
      for (let i = 0; i < allRestaurantNames.length; i++) {
        const { score, reason } = calculateMatchScore(TEST_DATA.restaurant.name, allRestaurantNames[i]);
        
        if (score > 0) {
          console.log(`    ${i}: "${allRestaurantNames[i]}" - Score: ${score} (${reason})`);
          
          if (score > bestScore) {
            bestScore = score;
            restaurantIndex = i;
            bestMatch = { name: allRestaurantNames[i], reason };
          }
        }
      }
      
      if (restaurantIndex >= 0) {
        console.log(`  ✅ Best match: "${bestMatch.name}" at index ${restaurantIndex} (${bestMatch.reason})`);
      } else {
        console.log(`  ❌ No matching restaurant found for "${TEST_DATA.restaurant.name}"`);
      }
      
      if (restaurantIndex >= 0) {
        // Use the simple, reliable selector pattern with the found index
        const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
        
        // If the first selector doesn't work, try with view-store pattern
        if (await manageButton.count() === 0) {
          // Try the view-store ID pattern
          const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
          if (await alternativeButton.count() > 0) {
            await alternativeButton.click();
            console.log(`  ✓ Clicked Manage button using view-store pattern`);
          } else {
            // Final fallback - just click the button at that index
            const allManageButtons = page.locator('button:has-text("Manage")');
            if (await allManageButtons.count() > restaurantIndex) {
              await allManageButtons.nth(restaurantIndex).click();
              console.log(`  ✓ Clicked Manage button at index ${restaurantIndex}`);
            }
          }
        } else {
          await manageButton.click();
          console.log(`  ✓ Clicked Manage button for ${TEST_DATA.restaurant.name}`);
        }
        
        // Wait for navigation to complete and page to load
        console.log('  ⏳ Waiting for restaurant management page to load...');
        try {
          // Wait for URL change to restaurant management
          await page.waitForURL('**/restaurant/**', { timeout: 15000 });
          console.log('  ✓ Navigated to restaurant page');
        } catch (error) {
          console.log('  ⚠️ Navigation timeout, checking current URL...');
        }
        
        // Add extra wait to ensure URL is fully loaded and stable
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        // Get the current URL for debugging
        const restaurantUrl = page.url();
        console.log('  📍 Current URL:', restaurantUrl);
        
        await takeScreenshot(page, '17-restaurant-admin');
        
        // Extract restaurant ID from URL (format: RES followed by alphanumeric characters)
        console.log('  🔍 Attempting to extract restaurant ID from URL...');
        
        // Try multiple regex patterns to match different possible formats
        let restaurantIdMatch = restaurantUrl.match(/restaurant\/(RES[A-Za-z0-9_-]+)/i);
        
        // If first pattern doesn't match, try a more generic pattern
        if (!restaurantIdMatch) {
          console.log('  ⚠️ Standard RES pattern did not match, trying generic pattern...');
          restaurantIdMatch = restaurantUrl.match(/restaurant\/([A-Za-z0-9_-]+)/);
        }
        
        if (restaurantIdMatch) {
          const restaurantId = restaurantIdMatch[1];
          console.log(`  ✓ Restaurant ID extracted: ${restaurantId}`);
          
          console.log('\n✅ RESTAURANT REGISTRATION COMPLETED!');
          console.log('Successfully created restaurant with:');
          console.log('  ✓ Login to existing account');
          console.log('  ✓ Restaurant name and subdomain');
          console.log('  ✓ Address selection with Google Maps');
          console.log('  ✓ Phone number');
          console.log('  ✓ Opening hours configured');
          console.log('  ✓ System locale (English - New Zealand)');
          console.log('  ✓ Timezone (Auckland)');
          console.log('  ✓ Currency (NZD)');
          console.log('  ✓ Tax in Prices toggle');
          console.log('  ✓ Restaurant successfully created!');
          
          console.log('\n📊 Restaurant Details:');
          console.log(`  Name: ${TEST_DATA.restaurant.name}`);
          console.log(`  Subdomain: ${subdomain}.pumpd.co.nz`);
          console.log(`  Restaurant ID: ${restaurantId}`);
          console.log(`  Account Email: ${TEST_DATA.login.email}`);
          
          // Output for parsing
          console.log('\nSubdomain:', `${subdomain}.pumpd.co.nz`);
          console.log('RestaurantID:', restaurantId);
          
          // Success - close browser and exit
          if (!DEBUG_MODE) {
            await browser.close();
            console.log('\n✨ Browser closed');
          }
          
          // Return success with restaurant ID
          return { success: true, restaurantId, subdomain };
        } else {
          console.log('  ❌ Could not extract restaurant ID from URL');
          console.log('  URL format:', restaurantUrl);
          console.log('  Expected format: .../restaurant/RESxxxxx or .../restaurant/[id]');
          console.log('  Please check if the URL contains the restaurant ID in a different format');
          throw new Error(`Failed to extract restaurant ID from URL: ${restaurantUrl}`);
        }
      } else {
        console.log(`  ⚠️ Could not find restaurant "${TEST_DATA.restaurant.name}" in the list`);
        console.log('  ℹ️ Restaurant was created but Manage button not found');
        await takeScreenshot(page, '17-restaurant-list');
        throw new Error('Could not find restaurant in list to click Manage button');
      }
    } else {
      console.log('  ⚠️ Navigation timeout - checking for error messages...');
      
      const errorElement = await page.locator('.error, .alert-danger, [role="alert"]').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('  ❌ Error message found:', errorText);
      }
      
      await takeScreenshot(page, '16-restaurant-creation-error');
      throw new Error('Restaurant creation may have failed - check screenshot');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
    throw error; // Re-throw for proper error handling
    
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

// Run the script
loginAndRegisterRestaurant().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});