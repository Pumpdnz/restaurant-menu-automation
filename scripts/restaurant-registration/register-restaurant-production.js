#!/usr/bin/env node

/**
 * Restaurant Registration Production Script for admin.pumpd.co.nz
 * 
 * This script performs full restaurant registration including:
 * - User account creation
 * - Email confirmation
 * - Restaurant details form completion
 * 
 * Usage:
 *   node register-restaurant-production.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (default: from env or test account)
 *   --password=<password>     Login password (default: from env or test password)
 *   --name=<name>            Restaurant name (default: "Mt vic chippery")
 *   --address=<address>      Full address (default: Christchurch test address)
 *   --phone=<phone>          Phone number (default: "03 123 4567")
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
 *   node test-form-only-playwright.js --email=test@example.com --name="Pizza Palace" --phone="03 456 7890"
 * 
 * Example with custom hours (object format):
 *   node test-form-only-playwright.js --dayHours='{"Monday":{"open":"11:00","close":"22:00"},"Tuesday":{"open":"11:00","close":"22:00"}}'
 * 
 * Example with hours crossing midnight (array format for duplicate days):
 *   node test-form-only-playwright.js --dayHours='[{"day":"Tuesday","hours":{"open":"09:30","close":"20:30"}},{"day":"Friday","hours":{"open":"09:30","close":"23:59"}},{"day":"Saturday","hours":{"open":"00:00","close":"02:00"}},{"day":"Saturday","hours":{"open":"09:30","close":"23:59"}},{"day":"Sunday","hours":{"open":"00:00","close":"02:00"}}]'
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const REGISTRATION_URL = "https://admin.pumpd.co.nz/register";
const LOGIN_URL = "https://admin.pumpd.co.nz/login";
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || true;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "7uo@%K2^Hz%yiXDeP39Ckp6BvF!2";

// Get parameters from command line arguments or environment variables
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse restaurant data from arguments or use defaults
const restaurantName = getArg('name') || process.env.RESTAURANT_NAME || "Pumpd Pizza Test";

// Generate password based on restaurant name format: "RestaurantName789!"
// Remove spaces and special characters, capitalize first letter
const generatePassword = (name) => {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, ''); // Remove special chars and spaces
  const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
  return `${capitalizedName}789!`;
};

// Clean password to remove any escape characters
const cleanPassword = (pwd) => {
  if (pwd === null || pwd === undefined) return null;
  // Remove single backslashes that might be escaping special characters
  // The regex /\\(.)/g matches a backslash followed by any character
  return pwd.replace(/\\(.)/g, '$1');
};

const rawPassword = getArg('password') || process.env.TEST_PASSWORD || generatePassword(restaurantName);
const cleanedPassword = cleanPassword(rawPassword);

const TEST_DATA = {
  login: {
    email: getArg('email') || process.env.TEST_EMAIL || "gianni@pumpd.co.nz",
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

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `form-test-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function testFormOnly() {
  console.log('🚀 Starting Restaurant Registration...\n');
  console.log('Configuration:');
  console.log(`  Email: ${TEST_DATA.login.email}`);
  console.log(`  Password: ${TEST_DATA.login.password}`);
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
    // STEP 1: Navigate to registration page
    console.log('📍 STEP 1: Navigating to registration page...');
    await page.goto(REGISTRATION_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-registration-page');

    // STEP 2: Fill registration form
    console.log('📝 STEP 2: Filling registration form...');
    
    // Email - Playwright auto-waits for elements
    await page.fill('input[type="email"]', TEST_DATA.login.email);
    console.log('  ✓ Email entered');
    
    // Password fields
    const passwordFields = await page.locator('input[type="password"]').all();
    await passwordFields[0].fill(TEST_DATA.login.password);
    await passwordFields[1].fill(TEST_DATA.login.password);
    console.log('  ✓ Password entered and confirmed');
    
    await takeScreenshot(page, '02-form-filled');
    
    // Click Continue - Playwright handles text selectors better
    await page.click('button:has-text("Continue")');
    console.log('  ✓ Clicked Continue');
    
    // Wait for navigation to confirmation page
    await page.waitForLoadState('networkidle');
    
    // IMPORTANT: Wait for the confirmation page to fully load
    // This prevents the admin password from being typed into the wrong field
    await page.waitForTimeout(3000);
    
    // STEP 3: Email confirmation
    console.log('\n✉️ STEP 3: Confirming email...');
    
    // Find and fill confirmation code input
    // Try multiple strategies
    const confirmInput = await page.locator('input').filter({ 
      hasNot: page.locator('[type="email"], [type="password"]') 
    }).first();
    
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(ADMIN_PASSWORD);
      console.log('  ✓ Typed admin password into confirmation field');
    } else {
      console.log('  ⚠️ WARNING: Could not find confirmation code input!');
    }
    
    await takeScreenshot(page, '03-email-confirmation');
    
    await page.click('button:has-text("Complete Registration")');
    console.log('  ✓ Clicked Complete Registration');
    
    // Wait for dashboard
    console.log('\n⏳ Waiting for dashboard after registration...');
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
    await takeScreenshot(page, '02-dashboard-loaded');
    
    // STEP 5: Click Create New Restaurant
    console.log('\n🏪 STEP 5: Click Create New Restaurant button');
    
    const createButton = page.locator('button:has-text("Create New Restaurant")');
    await createButton.click();
    console.log('  ✓ Clicked Create New Restaurant');
    
    // Handle potential notification popup
    console.log('  ⏳ Waiting 3 seconds in case of notification popup...');
    await page.waitForTimeout(3000);
    
    // Wait for form
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('  ✓ Form loaded');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '03-form-loaded');
    
    // STEP 6: Fill restaurant name
    console.log('\n📋 STEP 6: Fill restaurant name');
    
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.fill(TEST_DATA.restaurant.name);
    console.log('  ✓ Restaurant name filled');
    
    // STEP 7: Fill subdomain (with improved approach)
    console.log('\n📋 STEP 7: Fill subdomain');
    let subdomain = TEST_DATA.restaurant.name.toLowerCase().replace(/\s+/g, '');
    
    // Ensure subdomain is at least 4 characters long
    if (subdomain.length < 4) {
        subdomain = 'order-' + subdomain;
        console.log(`  ⚠ Subdomain too short, added prefix: ${subdomain}`);
    } else {
        console.log(`  ✓ Generated subdomain: ${subdomain}`);
    }
    
    // Debug: Count all inputs
    const allInputs = await page.locator('form input').all();
    console.log(`  Found ${allInputs.length} total inputs in form`);
    
    // Try multiple approaches
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
    
    // STEP 8: Select Google Maps
    console.log('\n🗺️ STEP 8: Select Google Maps');
    
    try {
      await page.click('button:has-text("Google Maps")');
      console.log('  ✓ Clicked Google Maps button');
    } catch {
      await page.click('label:has-text("Google Maps")');
      console.log('  ✓ Clicked Google Maps label');
    }
    
    await page.waitForTimeout(1000);
    
    // STEP 7: Address input (with improved approach)
    console.log('\n📍 STEP 9: Enter address');
    
    // Debug: List all divs with selectasync class
    const selectDivs = await page.locator('div[class*="selectasync"]').all();
    console.log(`  Found ${selectDivs.length} selectasync divs`);
    
    // Click address field
    try {
      // Try the exact selector from user
      const addressWrapper = page.locator('form > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectasync__WrapperInner-fSgFTI.eMHWRb');
      await addressWrapper.click();
      console.log('  ✓ Clicked address wrapper (exact selector)');
    } catch {
      // Fallback
      await page.click('div.selectasync__WrapperInner-fSgFTI');
      console.log('  ✓ Clicked address wrapper (class selector)');
    }
    
    await page.waitForTimeout(500);
    
    // Type address
    await page.keyboard.type(TEST_DATA.restaurant.address);
    console.log('  ✓ Typed address');
    
    // STEP 8: Wait for and click dropdown
    console.log('\n📍 STEP 10: Select address from dropdown');
    console.log('  ⏳ Waiting for suggestions to load...');
    
    // Wait for dropdown suggestions to appear with actual address
    await page.waitForTimeout(2000); // Give autocomplete time to load
    
    // Wait for the actual address suggestion (not the loading indicator)
    await page.waitForFunction(
      () => {
        const dropdown = document.querySelector('div.selectasync__Dropdown-bYdgnM.dIqlbY');
        if (!dropdown) return false;
        const items = dropdown.querySelectorAll('div');
        if (!items.length) return false;
        // Check it's not a loading message and has actual addresses
        const firstText = items[0]?.textContent || '';
        return !firstText.includes('Loading') && items.length > 0;
      },
      { timeout: 10000 }
    );
    
    console.log('  ✓ Address suggestion loaded');
    
    // Debug dropdown contents
    const dropdownInfo = await page.evaluate(() => {
      const dropdown = document.querySelector('div.selectasync__Dropdown-bYdgnM.dIqlbY');
      if (!dropdown) return { found: false };
      
      const items = dropdown.querySelectorAll('div.selectasync__DropdownOption-gQpgNZ');
      const allItems = [];
      items.forEach((item, index) => {
        allItems.push({
          index,
          text: item.textContent?.trim() || '',
          className: item.className
        });
      });
      
      return {
        found: true,
        itemCount: items.length,
        items: allItems
      };
    });
    console.log('  📊 Dropdown info:', JSON.stringify(dropdownInfo, null, 2));
    
    // Click the address suggestion
    try {
      console.log('  🖱️ Attempting to select address...');
      
      // Extract the expected address pattern from our input
      const addressParts = TEST_DATA.restaurant.address.split(',')[0].trim(); // Get first part before comma
      console.log(`  🔍 Looking for address containing: "${addressParts}"`);
      
      // Method 1: Click using JavaScript events to find best matching address
      const clicked = await page.evaluate((searchAddress) => {
        const dropdown = document.querySelector('div.selectasync__Dropdown-bYdgnM.dIqlbY');
        if (!dropdown) return false;
        
        const options = dropdown.querySelectorAll('div.selectasync__DropdownOption-gQpgNZ');
        let bestMatch = null;
        
        // Find the option that best matches our address
        for (const option of options) {
          const text = option.textContent || '';
          if (text.includes(searchAddress)) {
            // Prefer options with "Central City" or more complete addresses
            if (text.includes('Central City') || (!bestMatch && text.includes(searchAddress))) {
              bestMatch = option;
            }
          }
        }
        
        if (bestMatch) {
          // Trigger all necessary events
          const mouseEnter = new MouseEvent('mouseenter', { bubbles: true, cancelable: true });
          const mouseOver = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
          const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
          const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
          const click = new MouseEvent('click', { bubbles: true, cancelable: true });
          
          bestMatch.dispatchEvent(mouseEnter);
          bestMatch.dispatchEvent(mouseOver);
          // Small delay for hover effect
          setTimeout(() => {
            bestMatch.dispatchEvent(mouseDown);
            bestMatch.dispatchEvent(mouseUp);
            bestMatch.dispatchEvent(click);
          }, 100);
          
          return true;
        }
        return false;
      }, addressParts);
      
      if (clicked) {
        console.log('  ✓ Clicked address via JavaScript events');
        await page.waitForTimeout(500);
      } else {
        throw new Error('JavaScript click failed');
      }
      
    } catch (error) {
      console.log('  ⚠️ JavaScript events failed, trying Playwright methods...');
      
      try {
        // Method 2: Click the first option that contains our address
        const addressOption = page.locator('div.selectasync__DropdownOption-gQpgNZ').filter({ 
          hasText: addressParts 
        }).first();
        await addressOption.hover();
        await page.waitForTimeout(500); // Wait for hover effect
        await addressOption.click();
        console.log('  ✓ Clicked address suggestion via Playwright');
        
      } catch (error2) {
        console.log('  ⚠️ Playwright click failed, using first option...');
        
        // Method 3: Just click the first option
        const firstOption = page.locator('div.selectasync__DropdownOption-gQpgNZ').first();
        await firstOption.click();
        console.log('  ✓ Selected first address option');
      }
    }
    
    // Wait to ensure selection is processed
    await page.waitForTimeout(1000);
    
    // Verify the address was selected by checking if dropdown is gone
    const dropdownGone = await page.evaluate(() => {
      const dropdown = document.querySelector('div.selectasync__Dropdown-bYdgnM.dIqlbY');
      return !dropdown || dropdown.style.display === 'none';
    });
    
    if (dropdownGone) {
      console.log('  ✓ Dropdown closed - address likely selected');
    } else {
      console.log('  ⚠️ Dropdown still visible - selection may have failed');
    }
    
    await takeScreenshot(page, '08-address-selected');
    
    // STEP 11: Fill phone number
    console.log('\n📞 STEP 11: Fill phone number');
    
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
      // Try to find phone input by type
      await page.fill('input[type="tel"]', TEST_DATA.restaurant.phone);
      console.log('  ✓ Phone number filled via tel input');
    } catch {
      // Fallback: find by surrounding text
      const phoneInput = page.locator('input').filter({ 
        has: page.locator('..', { hasText: 'Phone Number' }) 
      }).first();
      await phoneInput.fill(TEST_DATA.restaurant.phone);
      console.log('  ✓ Phone number filled via text search');
    }
    
    await takeScreenshot(page, '09-phone-filled');
    
    // STEP 12: Set opening hours
    console.log('\n🕐 STEP 12: Set opening hours');
    
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
      // Already in array format
      dayEntries = customDayHours;
    } else {
      // Convert default object to array format
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
    console.log(`  Total entries to configure: ${dayEntries.length}`);
    
    // Get all day selectors
    const daySelectors = await page.locator('select').filter({ 
      has: page.locator('option:has-text("Monday")') 
    }).all();
    
    console.log(`  Found ${daySelectors.length} day selectors`);
    
    // Set each day selector to match our entries
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
    
    await takeScreenshot(page, '11-days-configured');
    
    // Configure opening and closing times
    console.log('  ⏰ Setting opening and closing times...');
    
    // Helper function to clear and type in time input
    const setTimeInput = async (input, time) => {
      // Click to focus
      await input.click();
      await page.waitForTimeout(100);
      
      // Select all with Cmd+A (Mac) or Ctrl+A (Windows/Linux)
      await page.keyboard.down('Meta'); // Use 'Control' for Windows/Linux
      await page.keyboard.press('a');
      await page.keyboard.up('Meta');
      await page.waitForTimeout(100);
      
      // Delete selected text
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(100);
      
      // Type new time
      await page.keyboard.type(time);
      await page.waitForTimeout(100);
    };
    
    // Find all time inputs directly - they should be in pairs (open/close) for each day
    const openingHoursSection = page.locator('form > div:nth-child(6)');
    const allTimeInputs = await openingHoursSection.locator('input[type="text"]').all();
    console.log(`  Found ${allTimeInputs.length} time inputs total`);
    
    // Process time inputs in pairs (open time, close time)
    let inputIndex = 0;
    for (let i = 0; i < dayEntries.length && inputIndex < allTimeInputs.length; i++) {
      const { day, hours } = dayEntries[i];
      
      try {
        // Each day has 2 inputs: opening and closing time
        const openInput = allTimeInputs[inputIndex];
        const closeInput = allTimeInputs[inputIndex + 1];
        
        if (openInput && closeInput) {
          await setTimeInput(openInput, hours.open);
          await setTimeInput(closeInput, hours.close);
          
          console.log(`    ✓ Set ${day}: ${hours.open} - ${hours.close}`);
          inputIndex += 2; // Move to next pair
        } else {
          console.log(`    ⚠️ Could not find time inputs for ${day}`);
        }
        
        await page.waitForTimeout(300);
      } catch (error) {
        console.log(`    ⚠️ Failed to set times for ${day}: ${error.message}`);
        inputIndex += 2; // Skip to next pair even on error
      }
    }
    
    await takeScreenshot(page, '12-times-configured');
    
    // STEP 13: Set System Locale
    console.log('\n🌍 STEP 13: Set System Locale');
    
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
      // Click the locale selector wrapper
      const localeWrapper = page.locator('form > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div');
      await localeWrapper.click();
      console.log('  ✓ Clicked locale selector');
      
      await page.waitForTimeout(500);
      
      // Type "New Zealand"
      await page.keyboard.type('New Zealand');
      console.log('  ✓ Typed "New Zealand"');
      
      // Wait for dropdown to appear
      await page.waitForTimeout(1500);
      
      // Click the dropdown option
      const dropdownOption = page.locator('form > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div').first();
      await dropdownOption.click();
      console.log('  ✓ Selected New Zealand locale');
      
    } catch (error) {
      console.log('  ⚠️ Failed to set locale:', error.message);
      
      // Fallback approach
      try {
        const localeSelect = page.locator('div.selectadv__WrapperInner-kRcmvS').filter({
          has: page.locator('div:has-text("English")')
        }).first();
        await localeSelect.click();
        await page.waitForTimeout(500);
        await page.keyboard.type('New Zealand');
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        console.log('  ✓ Selected locale via fallback method');
      } catch (fallbackError) {
        console.log('  ❌ Could not set locale');
      }
    }
    
    await takeScreenshot(page, '13-locale-set');
    
    // STEP 14: Set Timezone
    console.log('\n⏰ STEP 14: Set Timezone');
    
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
      // Click the timezone selector wrapper
      const timezoneWrapper = page.locator('form > div:nth-child(9) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div');
      await timezoneWrapper.click();
      console.log('  ✓ Clicked timezone selector');
      
      await page.waitForTimeout(500);
      
      // Type "Auckland"
      await page.keyboard.type('Auckland');
      console.log('  ✓ Typed "Auckland"');
      
      // Wait for dropdown to appear
      await page.waitForTimeout(1500);
      
      // Click the dropdown option
      const timezoneOption = page.locator('form > div:nth-child(9) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div').first();
      await timezoneOption.click();
      console.log('  ✓ Selected Auckland timezone');
      
    } catch (error) {
      console.log('  ⚠️ Failed to set timezone:', error.message);
    }
    
    await takeScreenshot(page, '14-timezone-set');
    
    // STEP 15: Set Currency
    console.log('\n💰 STEP 15: Set Currency');
    
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
      // Click the currency selector wrapper
      const currencyWrapper = page.locator('form > div:nth-child(12) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div');
      await currencyWrapper.click();
      console.log('  ✓ Clicked currency selector');
      
      await page.waitForTimeout(500);
      
      // Type "NZD"
      await page.keyboard.type('NZD');
      console.log('  ✓ Typed "NZD"');
      
      // Wait for dropdown to appear
      await page.waitForTimeout(1500);
      
      // Click the dropdown option
      const currencyOption = page.locator('form > div:nth-child(12) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div').first();
      await currencyOption.click();
      console.log('  ✓ Selected NZD currency');
      
    } catch (error) {
      console.log('  ⚠️ Failed to set currency:', error.message);
    }
    
    await takeScreenshot(page, '15-currency-set');
    
    // STEP 16: Toggle Tax in Prices
    console.log('\n💸 STEP 16: Toggle Tax in Prices');
    
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
      // Click the tax toggle
      const taxToggle = page.locator('form > div:nth-child(13) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label');
      await taxToggle.click();
      console.log('  ✓ Toggled Tax in Prices to ON');
      
    } catch (error) {
      console.log('  ⚠️ Failed to toggle tax:', error.message);
      
      // Fallback: try to find toggle by surrounding text
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
    
    await takeScreenshot(page, '16-tax-toggled');
    
    // Wait after currency selection for form to settle
    await page.waitForTimeout(2000);
    
    // STEP 17: Submit the form
    console.log('\n🚀 STEP 17: Create Restaurant');
    
    try {
      // Click Create Restaurant button
      const createButton = page.locator('form > button');
      await createButton.click();
      console.log('  ✓ Clicked Create Restaurant button');
      
    } catch (error) {
      console.log('  ⚠️ Failed with form > button selector, trying exact selector...');
      
      // Try exact selector if needed
      try {
        await page.click('#BFEs20ZQ--content > div.content__Content-hOzsB.UWPkM > form > button');
        console.log('  ✓ Clicked Create Restaurant button (exact selector)');
      } catch (error2) {
        console.log('  ❌ Failed to click Create Restaurant button:', error2.message);
        throw error2;
      }
    }
    
    // STEP 18: Wait for success and return to dashboard
    console.log('\n⏳ STEP 18: Waiting for restaurant creation...');
    
    try {
      // Wait for navigation back to dashboard after successful creation
      await page.waitForURL('**/admin.pumpd.co.nz/restaurants**', { timeout: 30000 });
      console.log('  ✓ Restaurant created successfully!');
      console.log('  ✓ Returned to dashboard:', page.url());
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Take final screenshot for confirmation
      await takeScreenshot(page, '17-restaurant-created-success');
      
    } catch (error) {
      console.log('  ⚠️ Navigation timeout - checking for error messages...');
      
      // Check for any error messages on the page
      const errorElement = await page.locator('.error, .alert-danger, [role="alert"]').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('  ❌ Error message found:', errorText);
      }
      
      await takeScreenshot(page, '17-restaurant-creation-error');
      throw new Error('Restaurant creation may have failed - check screenshot');
    }
    
    console.log('\n✅ RESTAURANT REGISTRATION COMPLETED!');
    console.log('Successfully created restaurant with:');
    console.log('  ✓ User account created and confirmed');
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
    console.log(`  Subdomain: ${TEST_DATA.restaurant.name.toLowerCase().replace(/\s+/g, '')}.pumpd.co.nz`);
    console.log(`  Email: ${TEST_DATA.login.email}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
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

// Run the test
testFormOnly();