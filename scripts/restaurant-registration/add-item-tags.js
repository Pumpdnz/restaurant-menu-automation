#!/usr/bin/env node

/**
 * Menu Item Tags Configuration Script for admin.pumpd.co.nz
 * 
 * This script performs automated configuration of the menu item tags including:
 * - Login to existing restaurant account
 * - Smart restaurant matching by name
 * - Navigation to correct restaurant management
 * - Item tags configuration
 * 
 * Usage:
 *   node add-item-tags.js [options]
 *
 * Options:
 *   --email=<email>           Login email (required)
 *   --password=<password>     User password (required)
 *   --name=<name>             Restaurant name for matching (required)
 *   --debug                   Keep browser open after completion
 *
 * Environment Variables:
 *   DEBUG_MODE=true           Alternative way to enable debug mode
 *
 * Example:
 *   node add-item-tags.js --email="test@example.com" --password="Password123!" --name="Test Restaurant"
 *   node add-item-tags.js --email="test@example.com" --password="Password123!" --name="Test Restaurant" --debug
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
} = require('../lib/browser-config.cjs');

// Configuration
const LOGIN_URL = "https://admin.pumpd.co.nz/login";

// DEBUG_MODE can be set via environment variable or --debug flag
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || process.argv.includes('--debug');

// Item Tags Configuration
const ITEM_TAGS = [
  { name: 'Popular', color: '#b400fa' },
  { name: 'New', color: '#3f92ff' },
  { name: 'Deal', color: '#4fc060' },
  { name: 'Vegan', color: '#36AB36' },
  { name: 'Vegetarian', color: '#32CD32' },
  { name: 'Gluten Free', color: '#FF8C00' },
  { name: 'Dairy Free', color: '#4682B4' },
  { name: 'Nut Free', color: '#DEB887' },
  { name: 'Halal', color: '#8B7355' },
  { name: 'Spicy', color: '#FF3333' }
];

// Selectors for tag creation form
const SELECTORS = {
  createButton: '#scroll-root > div > div > div > div > div > div.m-t-8 > div.grid-2.xs.xs-gap.m-t-10 > div:nth-child(1) > div > button',
  tagNameField: 'form > div > div:nth-child(3) > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  tagTextField: 'form > div > div:nth-child(3) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  colorPicker: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj > div',
  colorInput: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
  saveButton: 'form > div > div:nth-child(4) > button'
};

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse arguments
const email = getArg('email');
const password = getArg('password'); // NEW: Accept password as argument
const restaurantName = getArg('name'); // NEW: Accept restaurant name for matching

// Validate required arguments
if (!email || !password || !restaurantName) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<restaurant_name>');
  console.error('\nExample:');
  console.error('node add-item-tags.js --email=test@example.com --password=Password123! --name="Test Restaurant"');
  process.exit(1);
}

// Screenshot utility - uses shared config (disabled by default)
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const takeScreenshot = async (page, name) => {
  return sharedTakeScreenshot(page, `item-tags-${name}`, SCREENSHOT_DIR);
};

async function addItemTags() {
  console.log('🚀 Starting Menu Item Tags Configuration...\n');
  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Restaurant: ${restaurantName}`);
  console.log(`  Debug Mode: ${DEBUG_MODE ? 'ON (browser will stay open)' : 'OFF'}`);
  console.log('');
  
  const browser = await createBrowser(chromium);
  const context = await createContext(browser);
  
  const page = await context.newPage();
  
  try {
    // STEP 1: Login
    console.log('🔐 STEP 1: Login to admin portal');
    console.log(`  📍 Navigating to: ${LOGIN_URL}`);

    const navigationStart = Date.now();
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`  ⏱️ Navigation took: ${Date.now() - navigationStart}ms`);

    // Wait for React app to hydrate and render the login form
    // The page loads CSS first, then React renders the actual form elements
    console.log('  ⏳ Waiting 10s for React app to render...');
    await page.waitForTimeout(10000);

    // DEBUG: Log page information
    console.log('\n  🔍 DEBUG: Page Information');
    console.log(`  📍 Current URL: ${page.url()}`);
    console.log(`  📄 Page Title: ${await page.title()}`);

    // Check for Cloudflare challenge
    const pageContent = await page.content();
    const isCloudflareChallenge = pageContent.includes('Just a moment') ||
                                   pageContent.includes('cf-browser-verification') ||
                                   pageContent.includes('checking your browser');
    console.log(`  🛡️ Cloudflare Challenge Detected: ${isCloudflareChallenge}`);

    // Log first 800 chars of page content for debugging
    const cleanContent = pageContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`  📝 Page Text (first 800 chars): ${cleanContent.substring(0, 800)}`);

    // Check what form elements exist
    const emailInputCount = await page.locator('input[type="email"]').count();
    const passwordInputCount = await page.locator('input[type="password"]').count();
    const anyInputCount = await page.locator('input').count();
    const formCount = await page.locator('form').count();
    console.log(`  📋 Form Elements Found:`);
    console.log(`      - Email inputs: ${emailInputCount}`);
    console.log(`      - Password inputs: ${passwordInputCount}`);
    console.log(`      - Total inputs: ${anyInputCount}`);
    console.log(`      - Forms: ${formCount}`);

    // If no email input found, wait and check again
    if (emailInputCount === 0) {
      console.log('\n  ⚠️ No email input found! Waiting 5 seconds and checking again...');
      await page.waitForTimeout(5000);

      const emailInputCountRetry = await page.locator('input[type="email"]').count();
      console.log(`  📋 After wait - Email inputs: ${emailInputCountRetry}`);

      if (emailInputCountRetry === 0) {
        // Log all input elements for debugging
        const allInputs = await page.locator('input').all();
        console.log(`  📋 All input elements found (${allInputs.length}):`);
        for (let i = 0; i < Math.min(allInputs.length, 10); i++) {
          const input = allInputs[i];
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          const placeholder = await input.getAttribute('placeholder');
          console.log(`      [${i}] type="${type}" name="${name}" id="${id}" placeholder="${placeholder}"`);
        }
      }
    }

    await takeScreenshot(page, '01-login-page');

    // Wait for email input to be visible before filling
    console.log('\n  ⏳ Waiting for email input to be visible...');
    try {
      await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 60000 });
      console.log('  ✓ Email input is visible');
    } catch (waitError) {
      console.error(`  ❌ Email input not visible after 30s: ${waitError.message}`);
      throw waitError;
    }

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
    
    // Wait longer for dashboard content to fully load
    console.log('  ⏳ Waiting for dashboard content to load...');
    await page.waitForTimeout(5000);
    
    // Try to wait for restaurant elements to appear
    try {
      await page.waitForSelector('h4', { timeout: 10000 });
      console.log('  ✓ Dashboard content loaded');
    } catch (error) {
      console.log('  ⚠️ No h4 elements found, continuing anyway...');
    }
    
    // Wait for DOM instead of network idle (dashboard has continuous polling)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('  ⚠️ Page load state timeout - continuing anyway');
    }
    // Give extra time for dashboard to fully load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02-dashboard-loaded');
    
    // STEP 2: Navigate to restaurant management with smart matching
    console.log('\n🏪 STEP 2: Navigate to restaurant management');
    console.log(`  🔍 Looking for restaurant: ${restaurantName}`);
    
    // Wait for restaurant list to load
    await page.waitForTimeout(2000);
    
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
    
    console.log(`  ℹ️ Found ${allRestaurantNames.length} restaurants in the list`);
    if (allRestaurantNames.length > 0) {
      console.log(`  📊 Evaluating restaurants for best match:`);
      
      for (let i = 0; i < allRestaurantNames.length; i++) {
        const { score, reason } = calculateMatchScore(restaurantName, allRestaurantNames[i]);
        
        if (score > 0) {
          console.log(`    ${i}: "${allRestaurantNames[i]}" - Score: ${score} (${reason})`);
          
          if (score > bestScore) {
            bestScore = score;
            restaurantIndex = i;
            bestMatch = { name: allRestaurantNames[i], reason };
          }
        }
      }
    }
    
    if (restaurantIndex >= 0) {
      console.log(`  ✅ Best match: "${bestMatch.name}" at index ${restaurantIndex} (${bestMatch.reason})`);
      
      // Use the simple, reliable selector pattern with the found index
      const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
      
      // If the first selector doesn't work, try with view-store pattern
      if (await manageButton.count() === 0) {
        console.log('  ⚠️ Standard selector not found, trying view-store pattern...');
        const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
        if (await alternativeButton.count() > 0) {
          await alternativeButton.click();
          console.log(`  ✓ Clicked Manage button using view-store pattern`);
        } else {
          console.log('  ⚠️ View-store pattern not found, trying index-based fallback...');
          // Final fallback - just click the button at that index
          const allManageButtons = page.locator('button:has-text("Manage")');
          if (await allManageButtons.count() > restaurantIndex) {
            await allManageButtons.nth(restaurantIndex).click();
            console.log(`  ✓ Clicked Manage button at index ${restaurantIndex}`);
          } else {
            throw new Error('Could not find Manage button for restaurant');
          }
        }
      } else {
        await manageButton.click();
        console.log(`  ✓ Clicked Manage button for ${restaurantName}`);
      }
    } else {
      console.log(`  ❌ No matching restaurant found for "${restaurantName}"`);
      console.log('  Available restaurants:');
      allRestaurantNames.forEach((name, index) => {
        console.log(`    ${index}: "${name}"`);
      });
      throw new Error('Restaurant not found in list');
    }
    
    // Wait for navigation to restaurant management page
    console.log('  ⏳ Waiting for restaurant management page...');
    try {
      await page.waitForURL('**/admin.pumpd.co.nz/restaurant/**', { timeout: 15000 });
      console.log('  ✓ Navigated to restaurant page');
    } catch (error) {
      console.log('  ⚠️ Navigation timeout, checking current URL...');
      const currentUrl = page.url();
      if (currentUrl.includes('admin.pumpd.co.nz/restaurant/')) {
        console.log('  ✓ Already on restaurant page');
      } else {
        throw error;
      }
    }
    
    // Add extra wait to ensure page is fully loaded
    await page.waitForTimeout(2000);
    // Wait for DOM instead of network idle (dashboard has continuous polling)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('  ⚠️ Page load state timeout - continuing anyway');
    }
    
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
    // Wait for DOM instead of network idle (dashboard has continuous polling)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('  ⚠️ Page load state timeout - continuing anyway');
    }
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04-menu-page');
    
    // STEP 4: Click Item Tags Button
    console.log('\n📥 STEP 4: Navigate to Item Tags tab');

    try {
      // Try the provided selector first
      await page.click('#scroll-root > div > div > div > div > div > div.group__ButtonGroupComponent-dVAWMN.puSOV.bsl-1 > button:nth-child(3)');
      console.log('  ✓ Clicked Item tags tab button');
    } catch {
      // Fallback: Look for button with CSV or Import text
      try {
        const tagsButton = page.locator('button').filter({ hasText: /Item|Tags/i }).first();
        await tagsButton.click();
        console.log('  ✓ Clicked Item tags tab button (via text search)');
      } catch {
        console.error('  ❌ Could not find Item tags tab button');
        throw new Error('Item tags tab button not found');
      }
    }

    // Wait for Item Tags page to load
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '05-item-tags-page');

    // STEP 5: Create Item Tags in loop
    console.log('\n🏷️  STEP 5: Creating Item Tags');
    console.log(`  📋 ${ITEM_TAGS.length} tags to create\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ITEM_TAGS.length; i++) {
      const tag = ITEM_TAGS[i];
      console.log(`  [${i + 1}/${ITEM_TAGS.length}] Creating tag: "${tag.name}" (${tag.color})`);

      try {
        // Step 5.1: Click "Create New Item Tag" button
        await page.click(SELECTORS.createButton);
        await page.waitForTimeout(500);

        // Step 5.2: Fill Tag Name field
        const tagNameField = page.locator(SELECTORS.tagNameField);
        await tagNameField.fill(tag.name);

        // Step 5.3: Fill Tag Text field (same as tag name)
        const tagTextField = page.locator(SELECTORS.tagTextField);
        await tagTextField.fill(tag.name);

        // Step 5.4: Click color picker to open it
        await page.click(SELECTORS.colorPicker);
        await page.waitForTimeout(300);

        // Step 5.5: Fill color input with hex value
        const colorInput = page.locator(SELECTORS.colorInput);
        await colorInput.fill(tag.color);
        await page.waitForTimeout(200);

        // Step 5.6: Click Save button
        await page.click(SELECTORS.saveButton);

        // Step 5.7: Wait for save to complete
        await page.waitForTimeout(2000);

        console.log(`      ✓ Created "${tag.name}"`);
        successCount++;

      } catch (tagError) {
        console.error(`      ❌ Failed to create "${tag.name}": ${tagError.message}`);
        failCount++;

        // Try to close any open modal/form before continuing
        try {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } catch {
          // Ignore escape errors
        }
      }
    }

    // Take final screenshot
    await takeScreenshot(page, '06-tags-completed');

    // Summary
    console.log('\n📊 Item Tags Summary:');
    console.log(`  ✅ Successfully created: ${successCount}/${ITEM_TAGS.length}`);
    if (failCount > 0) {
      console.log(`  ❌ Failed: ${failCount}/${ITEM_TAGS.length}`);
    }

    if (successCount === ITEM_TAGS.length) {
      console.log('\n✅ All item tags configured successfully!');
    } else if (successCount > 0) {
      console.log('\n⚠️ Item tags partially configured');
    } else {
      throw new Error('Failed to create any item tags');
    }

  } catch (error) {
    console.error('\n❌ Error during item tags configuration:', error.message);
    await takeScreenshot(page, 'error-state');
    throw error;
  } finally {
    if (DEBUG_MODE) {
      console.log('\n🐛 DEBUG MODE: Browser left open for inspection');
      console.log('Press Ctrl+C to exit');
      await new Promise(() => {}); // Keep alive indefinitely
    } else {
      await browser.close();
      console.log('\n✨ Browser closed');
    }
  }
}

// Run the script
addItemTags().catch((error) => {
  console.error('Script failed:', error.message);
  process.exit(1);
});