#!/usr/bin/env node

/**
 * Menu Item Tags Configuration Script for CloudWaitress Admin Portals
 *
 * This script performs automated configuration of the menu item tags including:
 * - Login to existing restaurant account
 * - Smart restaurant matching by name
 * - Navigation to correct restaurant management
 * - Item tags configuration
 * - Applying tags to specific menu items (when payload provided)
 *
 * Supports multiple CloudWaitress resellers with configurable admin URLs.
 *
 * Usage:
 *   node add-item-tags.js [options]
 *
 * Options:
 *   --payload="/path/to/temp-item-tags-payload.json" (enhanced mode)
 *   Contains: {
 *      email: string,
 *      password: string,
 *      restaurantName: string,
 *      adminUrl: string (optional - defaults to https://admin.pumpd.co.nz),
 *      itemTags: [{
 *        name: string,
 *        color: string,
 *        menuItemNames: string[] (optional - menu items to apply this tag to)
 *      }]
 *   }
 *
 *   Legacy mode (creates preset tags without menu item assignment):
 *   --email=<email>           Login email (required)
 *   --password=<password>     User password (required)
 *   --name=<name>             Restaurant name for matching (required)
 *   --admin-url=<url>         CloudWaitress admin portal URL (default: https://admin.pumpd.co.nz)
 *   --debug                   Keep browser open after completion
 *
 * Environment Variables:
 *   DEBUG_MODE=true           Alternative way to enable debug mode
 *
 * Example (enhanced mode with payload):
 *   node add-item-tags.js --payload="/path/to/temp-item-tags-payload.json"
 *
 * Example (legacy mode - NZ):
 *   node add-item-tags.js --email="test@example.com" --password="Password123!" --name="Test Restaurant"
 *
 * Example (legacy mode - custom admin URL):
 *   node add-item-tags.js --email="test@example.com" --password="Password123!" --name="Test Restaurant" --admin-url="https://admin.ozorders.com.au"
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables from centralized .env file
require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') });

// Import shared browser configuration
const {
  createBrowser,
  createContext,
  takeScreenshot: sharedTakeScreenshot
} = require('../lib/browser-config.cjs');

// Import country configuration
const {
  getAdminHostname,
  buildLoginUrl
} = require('../lib/country-config.cjs');

// Configuration
const DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';

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
  // Tag creation selectors
  createButton: '#scroll-root > div > div > div > div > div > div.m-t-8 > div.grid-2.xs.xs-gap.m-t-10 > div:nth-child(1) > div > button',
  tagNameField: 'form > div > div:nth-child(3) > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  tagTextField: 'form > div > div:nth-child(3) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  colorPicker: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj > div',
  colorInput: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
  saveButton: 'form > div > div:nth-child(4) > button',

  // Menu item selection selectors (for applying tags to items)
  // The tab container ID follows the pattern #[feature]-tab-options-tab-select-content
  addRemoveItemsTab: '#tag-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div',
  menuExpandArrow: 'form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg'
};

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse arguments - support both payload mode and legacy CLI mode
const payloadPath = getArg('payload');

// These will be populated either from payload or CLI args
let email, password, restaurantName, adminUrl, itemTags;

// Async initialization function to load payload if provided
async function initializeParams() {
  if (payloadPath) {
    // Enhanced mode: Load from JSON payload file
    console.log(`📄 Loading payload from: ${payloadPath}`);
    try {
      const payloadContent = await fs.readFile(payloadPath, 'utf-8');
      const payload = JSON.parse(payloadContent);

      email = payload.email;
      password = payload.password;
      restaurantName = payload.restaurantName;
      adminUrl = (payload.adminUrl || DEFAULT_ADMIN_URL).replace(/\/$/, '');
      itemTags = payload.itemTags || ITEM_TAGS.map(t => ({ ...t, menuItemNames: [] }));

      console.log(`  ✓ Loaded ${itemTags.length} item tags from payload`);
      const tagsWithItems = itemTags.filter(t => t.menuItemNames && t.menuItemNames.length > 0);
      if (tagsWithItems.length > 0) {
        console.log(`  ✓ ${tagsWithItems.length} tags have menu items to apply`);
      }
    } catch (err) {
      console.error(`❌ Error reading payload file: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Legacy mode: Use CLI arguments
    email = getArg('email');
    password = getArg('password');
    restaurantName = getArg('name');
    adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
    // Use default ITEM_TAGS without menu item assignments
    itemTags = ITEM_TAGS.map(t => ({ ...t, menuItemNames: [] }));
  }

  // Validate required parameters
  if (!email || !password || !restaurantName) {
    console.error('❌ Error: Missing required parameters');
    console.error('\nEnhanced mode (with menu item assignment):');
    console.error('  --payload="/path/to/temp-item-tags-payload.json"');
    console.error('\nLegacy mode (create tags only):');
    console.error('  --email=<email> --password=<password> --name=<restaurant_name>');
    console.error('\nExample:');
    console.error('node add-item-tags.js --email=test@example.com --password=Password123! --name="Test Restaurant"');
    process.exit(1);
  }

  return { email, password, restaurantName, adminUrl, itemTags };
}

// Screenshot utility - uses shared config (disabled by default)
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const takeScreenshot = async (page, name) => {
  return sharedTakeScreenshot(page, `item-tags-${name}`, SCREENSHOT_DIR);
};

async function addItemTags() {
  // Initialize parameters (async to support payload file loading)
  await initializeParams();

  // Build URLs from admin base URL (must happen after initializeParams)
  const LOGIN_URL = buildLoginUrl(adminUrl);
  const ADMIN_HOSTNAME = getAdminHostname(adminUrl);

  console.log('🚀 Starting Menu Item Tags Configuration...\n');
  console.log('Configuration:');
  console.log(`  Admin Portal: ${adminUrl}`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Restaurant: ${restaurantName}`);
  console.log(`  Tags to create: ${itemTags.length}`);
  console.log(`  Mode: ${payloadPath ? 'Enhanced (with menu item assignment)' : 'Legacy (create tags only)'}`);
  console.log(`  Debug Mode: ${DEBUG_MODE ? 'ON (browser will stay open)' : 'OFF'}`);
  console.log('');
  
  const browser = await createBrowser(chromium);
  const context = await createContext(browser);
  
  const page = await context.newPage();
  
  try {
    // STEP 1: Login
    console.log('🔐 STEP 1: Login to admin portal');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await takeScreenshot(page, '01-login-page');

    // Fill login form using force option to bypass visibility checks
    await page.fill('input[type="email"]', email, { force: true });
    await page.fill('input[type="password"]', password);
    console.log('  ✓ Credentials entered');
    
    // Click login button
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  ✓ Clicked login');
    
    // Wait for dashboard
    console.log('\n⏳ Waiting for dashboard...');
    await page.waitForURL(`**/${ADMIN_HOSTNAME}/**`, { timeout: 15000 });
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
      await page.waitForURL(`**/${ADMIN_HOSTNAME}/restaurant/**`, { timeout: 15000 });
      console.log('  ✓ Navigated to restaurant page');
    } catch (error) {
      console.log('  ⚠️ Navigation timeout, checking current URL...');
      const currentUrl = page.url();
      if (currentUrl.includes(`${ADMIN_HOSTNAME}/restaurant/`)) {
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
    console.log(`  📋 ${itemTags.length} tags to create\n`);

    let successCount = 0;
    let failCount = 0;
    let totalItemsAssigned = 0;

    for (let i = 0; i < itemTags.length; i++) {
      const tag = itemTags[i];
      const menuItemNames = tag.menuItemNames || [];
      console.log(`  [${i + 1}/${itemTags.length}] Creating tag: "${tag.name}" (${tag.color})${menuItemNames.length > 0 ? ` - ${menuItemNames.length} items to apply` : ''}`);

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

        // Step 5.6: Add to menu items (if menuItemNames provided)
        if (menuItemNames.length > 0) {
          console.log(`      Adding to ${menuItemNames.length} menu items...`);

          try {
            // Click "Add / Remove From Items" tab
            await page.click(SELECTORS.addRemoveItemsTab);
            await page.waitForTimeout(500);
            console.log('        Switched to Add/Remove From Items tab');

            // Expand the Menu tree - try multiple selectors
            let menuExpanded = false;

            // Try the primary selector first
            try {
              const primaryArrow = page.locator(SELECTORS.menuExpandArrow).first();
              if (await primaryArrow.count() > 0) {
                await primaryArrow.click();
                await page.waitForTimeout(300);
                console.log('        Expanded Menu tree (primary selector)');
                menuExpanded = true;
              }
            } catch (e) {
              // Primary selector failed
            }

            // Fallback: Try to find any expand arrow within the form that's not in a category
            if (!menuExpanded) {
              try {
                // Look for the first cursor.flex-center svg that's not inside m-l-2 (which are categories)
                const formExpandArrows = await page.locator('form div.cursor.flex-center > svg').all();
                if (formExpandArrows.length > 0) {
                  await formExpandArrows[0].click();
                  await page.waitForTimeout(300);
                  console.log(`        Expanded Menu tree (fallback - found ${formExpandArrows.length} arrows)`);
                  menuExpanded = true;
                }
              } catch (e) {
                console.log('        Menu tree may already be expanded or not found');
              }
            }

            // Wait a bit more for the tree to expand
            await page.waitForTimeout(500);

            // Expand all category sections to reveal menu items
            // Use the same selector pattern as add-option-sets.js
            const categoryExpanders = await page.locator('form div.m-l-2 > div > div > div.cursor.flex-center > svg').all();
            console.log(`        Found ${categoryExpanders.length} category expanders`);

            for (let k = 0; k < categoryExpanders.length; k++) {
              try {
                await categoryExpanders[k].click();
                await page.waitForTimeout(200);
              } catch (catError) {
                // Category may already be expanded
              }
            }
            await page.waitForTimeout(300);

            // Find and click checkboxes for matching menu item names
            // Deduplicate names to handle Featured Items duplicates
            let matchedCount = 0;
            const uniqueMenuItemNames = [...new Set(menuItemNames)];

            for (const itemName of uniqueMenuItemNames) {
              try {
                // Find ALL matching spans with m-l-2 class (menu item labels)
                const labelSpanLocator = page.locator(`span.m-l-2:text-is("${itemName}")`);
                const count = await labelSpanLocator.count();

                if (count > 0) {
                  // Click all matching checkboxes (handles Featured Items appearing in multiple places)
                  for (let j = 0; j < count; j++) {
                    const labelSpan = labelSpanLocator.nth(j);
                    const parentLabel = labelSpan.locator('xpath=ancestor::label');
                    await parentLabel.click();
                  }
                  matchedCount++;
                  console.log(`        Checked: "${itemName}" (${count} checkbox${count > 1 ? 'es' : ''})`);
                } else {
                  console.log(`        Not found: "${itemName}"`);
                }
              } catch (checkError) {
                console.log(`        Failed to check "${itemName}": ${checkError.message}`);
              }
            }

            console.log(`      Matched ${matchedCount}/${uniqueMenuItemNames.length} menu items`);
            totalItemsAssigned += matchedCount;

          } catch (addItemsError) {
            console.log(`      Failed to add menu items: ${addItemsError.message}`);
          }
        }

        // Step 5.7: Click Save button
        await page.click(SELECTORS.saveButton);

        // Step 5.8: Wait for save to complete
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
    console.log(`  ✅ Successfully created: ${successCount}/${itemTags.length}`);
    if (failCount > 0) {
      console.log(`  ❌ Failed: ${failCount}/${itemTags.length}`);
    }
    if (totalItemsAssigned > 0) {
      console.log(`  🏷️  Menu items assigned: ${totalItemsAssigned}`);
    }

    if (successCount === itemTags.length) {
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