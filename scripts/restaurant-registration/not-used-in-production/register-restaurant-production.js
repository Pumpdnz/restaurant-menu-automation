#!/usr/bin/env node

/**
 * Restaurant Registration Production Script for admin.pumpd.co.nz
 * 
 * This script performs restaurant registration for an existing account:
 * - Login to existing account
 * - Navigate to restaurant creation
 * - Fill restaurant details form
 * - Configure operating hours
 * - Submit restaurant registration
 * 
 * NOTE: This script assumes the user account has already been created via API
 * 
 * Usage:
 *   node register-restaurant-production.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --password=<password>     Login password (required)
 *   --name=<name>            Restaurant name (required)
 *   --address=<address>      Full address (default: Christchurch test address)
 *   --phone=<phone>          Phone number (default: "031234567")
 *   --dayHours=<json>        JSON string of day hours (default: standard hours)
 * 
 * Environment Variables:
 *   TEST_EMAIL               Login email
 *   TEST_PASSWORD            Login password
 *   RESTAURANT_NAME          Restaurant name
 *   RESTAURANT_ADDRESS       Restaurant address
 *   RESTAURANT_PHONE         Restaurant phone
 *   DAY_HOURS               JSON string of hours per day
 *   DEBUG_MODE              Enable debug mode (true/false)
 * 
 * Example:
 *   node register-restaurant-production.js --email=test@example.com --password="Test789!" --name="Pizza Palace" --phone="03 456 7890"
 * 
 * Example with custom hours (object format):
 *   node register-restaurant-production.js --dayHours='{"Monday":{"open":"11:00","close":"22:00"},"Tuesday":{"open":"11:00","close":"22:00"}}'
 * 
 * Example with hours crossing midnight (array format for duplicate days):
 *   node register-restaurant-production.js --dayHours='[{"day":"Tuesday","hours":{"open":"09:30","close":"20:30"}},{"day":"Friday","hours":{"open":"09:30","close":"23:59"}},{"day":"Saturday","hours":{"open":"00:00","close":"02:00"}},{"day":"Saturday","hours":{"open":"09:30","close":"23:59"}},{"day":"Sunday","hours":{"open":"00:00","close":"02:00"}}]'
 */

const { chromium } = require('playwright');
const path = require('path');

// Load environment variables from centralized .env file
require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') });

// Import shared browser configuration
const {
  createBrowser,
  createContext,
  takeScreenshot: sharedTakeScreenshot
} = require('../../lib/browser-config.cjs');

// Configuration
const LOGIN_URL = "https://admin.pumpd.co.nz/login";
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || false;

// Get parameters from command line arguments or environment variables
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse restaurant data from arguments or use defaults
const restaurantName = getArg('name') || process.env.RESTAURANT_NAME;
if (!restaurantName) {
  console.error('❌ Error: Restaurant name is required (--name="Restaurant Name")');
  process.exit(1);
}

// Clean password to remove any escape characters
const cleanPassword = (pwd) => {
  if (pwd === null || pwd === undefined) return null;
  // Remove single backslashes that might be escaping special characters
  return pwd.replace(/\\(.)/g, '$1');
};

const rawPassword = getArg('password') || process.env.TEST_PASSWORD;
if (!rawPassword) {
  console.error('❌ Error: Password is required (--password="Password")');
  process.exit(1);
}
const cleanedPassword = cleanPassword(rawPassword);

const email = getArg('email') || process.env.TEST_EMAIL;
if (!email) {
  console.error('❌ Error: Email is required (--email="email@example.com")');
  process.exit(1);
}

const TEST_DATA = {
  login: {
    email: email,
    password: cleanedPassword
  },
  restaurant: {
    name: restaurantName,
    address: getArg('address') || process.env.RESTAURANT_ADDRESS || "255 Saint Asaph Street, Christchurch Central City, Christchurch 8011, New Zealand",
    phone: getArg('phone') || process.env.RESTAURANT_PHONE || "031234567"
  }
};

// Parse day hours if provided as JSON string or array
let customDayHours = null;
const dayHoursArg = getArg('dayHours') || process.env.DAY_HOURS;
if (dayHoursArg) {
  try {
    const parsed = JSON.parse(dayHoursArg);
    // Check if it's an array (for duplicate days) or object
    if (Array.isArray(parsed)) {
      // Convert array format to our internal format
      customDayHours = parsed;
    } else {
      // Convert object to array format
      customDayHours = Object.entries(parsed).map(([day, hours]) => ({ day, hours }));
    }
  } catch (e) {
    console.error('Failed to parse dayHours:', e.message);
  }
}

// Screenshot utility - uses shared config (disabled by default)
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const takeScreenshot = async (page, name) => {
  return sharedTakeScreenshot(page, `restaurant-${name}`, SCREENSHOT_DIR);
};

async function registerRestaurantOnly() {
  console.log('🚀 Starting Restaurant Registration (Account Already Exists)...\n');
  console.log('Configuration:');
  console.log(`  Email: ${TEST_DATA.login.email}`);
  console.log(`  Password: ${'*'.repeat(TEST_DATA.login.password.length)}`);
  console.log(`  Restaurant: ${TEST_DATA.restaurant.name}`);
  console.log(`  Address: ${TEST_DATA.restaurant.address}`);
  console.log(`  Phone: ${TEST_DATA.restaurant.phone}`);
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
  
  const browser = await createBrowser(chromium);
  const context = await createContext(browser);
  
  const page = await context.newPage();
  
  try {
    // STEP 1: Navigate to login page
    console.log('📍 STEP 1: Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-login-page');

    // STEP 2: Login to existing account
    console.log('🔐 STEP 2: Logging in to existing account...');
    
    // Fill email
    await page.fill('input[type="email"]', TEST_DATA.login.email);
    console.log('  ✓ Email entered');
    
    // Fill password
    await page.fill('input[type="password"]', TEST_DATA.login.password);
    console.log('  ✓ Password entered');
    
    await takeScreenshot(page, '02-login-filled');
    
    // Click Continue/Login button
    const loginButton = page.locator('button').filter({ hasText: /Continue|Login|Sign In/i }).first();
    await loginButton.click();
    console.log('  ✓ Clicked Login button');
    
    // Wait for navigation to dashboard
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
    
    // STEP 4: Click Create New Restaurant
    console.log('\n🏪 STEP 4: Click Create New Restaurant button');
    
    // Check if there are existing restaurants (button text might be different)
    let createButton = page.locator('button').filter({ hasText: /Create New Restaurant|Add Restaurant|New Restaurant/i }).first();
    
    // Check if button exists
    const buttonExists = await createButton.count() > 0;
    
    if (buttonExists) {
      await createButton.click();
      console.log('  ✓ Clicked Create/Add Restaurant button');
    } else {
      // Try navigation menu approach
      console.log('  ⚠️ No create button found, trying navigation menu...');
      
      // Click on Restaurants menu item
      const restaurantsMenu = page.locator('nav a, nav button').filter({ hasText: /Restaurants/i }).first();
      await restaurantsMenu.click();
      await page.waitForTimeout(2000);
      
      // Now look for create button again
      createButton = page.locator('button').filter({ hasText: /Create|Add|New/i }).first();
      await createButton.click();
      console.log('  ✓ Clicked Create Restaurant via menu');
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
    let subdomain = TEST_DATA.restaurant.name.toLowerCase().replace(/\s+/g, '');
    
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
      console.log('  ✓ Clicked address wrapper (exact selector)');
    } catch {
      await page.click('div.selectasync__WrapperInner-fSgFTI');
      console.log('  ✓ Clicked address wrapper (class selector)');
    }
    
    await page.waitForTimeout(500);
    
    // Type address
    await page.keyboard.type(TEST_DATA.restaurant.address);
    console.log('  ✓ Typed address');
    
    // STEP 9: Wait for and click dropdown
    console.log('\n📍 STEP 9: Select address from dropdown');
    console.log('  ⏳ Waiting for suggestions to load...');
    
    await page.waitForTimeout(2000); // Give autocomplete time to load
    
    // Wait for the actual address suggestion
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
    
    // Extract the expected address pattern from our input
    const addressParts = TEST_DATA.restaurant.address.split(',')[0].trim();
    console.log(`  🔍 Looking for address containing: "${addressParts}"`);
    
    // Click the address suggestion
    try {
      const addressOption = page.locator('div.selectasync__DropdownOption-gQpgNZ').filter({ 
        hasText: addressParts 
      }).first();
      await addressOption.hover();
      await page.waitForTimeout(500);
      await addressOption.click();
      console.log('  ✓ Clicked address suggestion');
    } catch {
      // Fallback: click first option
      const firstOption = page.locator('div.selectasync__DropdownOption-gQpgNZ').first();
      await firstOption.click();
      console.log('  ✓ Selected first address option');
    }
    
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '08-address-selected');
    
    // STEP 10: Fill phone number
    console.log('\n📞 STEP 10: Fill phone number');
    
    // Scroll to phone number field
    await page.evaluate(() => {
      const phoneSection = document.querySelector('input[type="tel"]') || 
                          Array.from(document.querySelectorAll('input')).find(input => 
                            input.placeholder?.toLowerCase().includes('phone') ||
                            input.parentElement?.textContent?.toLowerCase().includes('phone')
                          );
      if (phoneSection) {
        phoneSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(500);
    
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
    
    console.log(`  Found ${daySelectors.length} day selectors`);
    
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
    
    // Configure opening and closing times
    console.log('  ⏰ Setting opening and closing times...');
    
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
    
    // Find all time inputs directly
    const openingHoursSection = page.locator('form > div:nth-child(6)');
    const allTimeInputs = await openingHoursSection.locator('input[type="text"]').all();
    console.log(`  Found ${allTimeInputs.length} time inputs total`);
    
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
    
    // Scroll to system locale field
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
    
    // Scroll to timezone field
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
    
    // Scroll to currency field
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
    
    // Scroll to tax toggle
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
      
      try {
        const toggleLabel = page.locator('label').filter({
          has: page.locator('span:has-text("Off")')
        }).first();
        await toggleLabel.click();
        console.log('  ✓ Toggled tax via fallback method');
      } catch (fallbackError) {
        console.log('  ❌ Could not toggle tax');
      }
    }
    
    await takeScreenshot(page, '15-tax-toggled');
    
    // Wait after configuration for form to settle
    await page.waitForTimeout(2000);
    
    // STEP 16: Submit the form
    console.log('\n🚀 STEP 16: Create Restaurant');
    
    try {
      const createButton = page.locator('form > button');
      await createButton.click();
      console.log('  ✓ Clicked Create Restaurant button');
    } catch (error) {
      console.log('  ⚠️ Failed with form > button selector, trying exact selector...');
      
      try {
        await page.click('#BFEs20ZQ--content > div.content__Content-hOzsB.UWPkM > form > button');
        console.log('  ✓ Clicked Create Restaurant button (exact selector)');
      } catch (error2) {
        console.log('  ❌ Failed to click Create Restaurant button:', error2.message);
        throw error2;
      }
    }
    
    // STEP 17: Wait for success and return to dashboard
    console.log('\n⏳ STEP 17: Waiting for restaurant creation...');
    
    try {
      await page.waitForURL('**/admin.pumpd.co.nz/restaurants**', { timeout: 30000 });
      console.log('  ✓ Restaurant created successfully!');
      console.log('  ✓ Returned to dashboard:', page.url());
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      await takeScreenshot(page, '16-restaurant-created-success');
    } catch (error) {
      console.log('  ⚠️ Navigation timeout - checking for error messages...');
      
      const errorElement = await page.locator('.error, .alert-danger, [role="alert"]').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('  ❌ Error message found:', errorText);
      }
      
      await takeScreenshot(page, '16-restaurant-creation-error');
      throw new Error('Restaurant creation may have failed - check screenshot');
    }
    
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
    console.log(`  Email: ${TEST_DATA.login.email}`);
    
    // Return success data
    return {
      success: true,
      subdomain: subdomain,
      restaurantName: TEST_DATA.restaurant.name,
      dashboardUrl: page.url()
    };
    
  } catch (error) {
    console.error('\n❌ Registration failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
    throw error;
    
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
registerRestaurantOnly()
  .then(result => {
    if (result && result.success) {
      console.log('\n🎉 Script completed successfully');
      // Output subdomain for parsing by the API
      console.log(`Subdomain: ${result.subdomain}.pumpd.co.nz`);
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });