#!/usr/bin/env node

/**
 * Menu Option Sets Configuration Script for CloudWaitress Admin Portals
 *
 * This script performs automated configuration of menu item option sets including:
 * - Login to existing restaurant account
 * - Smart restaurant matching by name
 * - Navigation to correct restaurant management
 * - Option Sets configuration with conditions and items
 *
 * Supports multiple CloudWaitress resellers with configurable admin URLs.
 *
 * Usage:
 *   node add-option-sets.js [options]
 *
 * Options:
 *   --payload="/path/to/temp-option-sets-payload.json" (required)
 *   Contains: {
 *      email: string,
 *      password: string,
 *      restaurantName: string,
 *      adminUrl: string (optional - defaults to https://admin.pumpd.co.nz),
 *      optionSets: [{
 *        name: string,
 *        display_name: string,
 *        is_required: boolean,
 *        multiple_selections_allowed: boolean,
 *        min_selections: number,
 *        max_selections: number,
 *        items: [{ name: string, price: number }],
 *        menuItemNames: string[] (optional - menu items to apply this option set to)
 *      }],
 *      menuItemMappings: object (for future use)
 *   }
 *   --admin-url=<url>         Override admin portal URL from payload
 *   --debug                   Keep browser open after completion
 *
 * Environment Variables:
 *   DEBUG_MODE=true           Alternative way to enable debug mode
 *
 * Example (default NZ):
 *   node add-option-sets.js --payload="/path/to/temp-option-sets-payload.json"
 *
 * Example (custom admin URL):
 *   node add-option-sets.js --payload="/path/to/temp-option-sets-payload.json" --admin-url="https://admin.ozorders.com.au"
 *
 * =============================================================================
 * IMPORTANT: Menu Item Selection - Featured Items Handling
 * =============================================================================
 *
 * The "Add / Remove From Items" tab in CloudWaitress displays menu items in a
 * tree structure with categories. Some menus have a "Featured Items" section
 * at the top that duplicates items from other categories.
 *
 * PROBLEM:
 * When a menu item appears in BOTH "Featured Items" AND its actual category
 * (e.g., "Half Chicken" in Featured Items AND in "Chicken" category), the
 * menuItemNames array from extraction contains duplicates. Using .first()
 * selector would:
 *   1. First occurrence: Click Featured Items checkbox (selects it)
 *   2. Second occurrence: Click Featured Items checkbox AGAIN (deselects it!)
 *
 * SOLUTION:
 * 1. Deduplicate menuItemNames using Set to process each name only once
 * 2. For each unique name, find ALL matching checkboxes in the DOM
 * 3. Click ALL of them (both Featured Items AND category checkboxes)
 *
 * SELECTOR USED:
 * The working selector is: span.m-l-2:text-is("${itemName}")
 * - span.m-l-2 targets the menu item label spans in the checkbox tree
 * - :text-is() does exact text matching
 * - We then traverse up to the parent label and click it
 *
 * NOTE: The alternative selector `label:has(span:text-is(...))` was NOT
 * matching elements in this UI. Always use the span.m-l-2 approach.
 *
 * PERFORMANCE:
 * - Removed isChecked() calls before clicking (saves ~10s per item)
 * - Removed waitForTimeout() between clicks
 * - Clicking an already-checked checkbox is safe in this UI
 * =============================================================================
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

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

// Selectors for Option Sets form
const SELECTORS = {
  // Tab navigation (Option Sets is 2nd button, Item Tags is 3rd)
  optionSetsTab: '#scroll-root > div > div > div > div > div > div.group__ButtonGroupComponent-dVAWMN.puSOV.bsl-1 > button:nth-child(2)',

  // Create button
  createButton: '#scroll-root > div > div > div > div > div > div.m-t-8 > div.grid-2.xs.xs-gap.m-t-10 > div:nth-child(1) > div > button',

  // Name inputs
  nameInput: 'form > div > div:nth-child(1) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  displayNameInput: 'form > div > div:nth-child(1) > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',

  // Tab buttons within form
  conditionsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(3) > div',
  optionsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div',

  // Conditions tab toggles
  requiredToggle: 'form > div > div:nth-child(1) > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label',
  selectMultipleToggle: 'form > div > div:nth-child(1) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label',
  enableQuantityToggle: 'form > div > div:nth-child(1) > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label',
  minSelectionsInput: 'form > div > div:nth-child(1) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  maxSelectionsInput: 'form > div > div:nth-child(1) > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',

  // Options tab
  addOptionButton: 'form > div > div:nth-child(1) > div > div > div > div:nth-child(2) > button',

  // Add / Remove From Items tab
  addRemoveItemsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(4) > div',
  menuExpandArrow: 'form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg',

  // Save button
  saveButton: 'form > div > div:last-child > button'
};

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null; // Handle paths with = in them
};

// Parse arguments
const payloadPath = getArg('payload');
const adminUrlArg = getArg('admin-url'); // Can override payload's adminUrl

// Validate required arguments
if (!payloadPath) {
  console.error('Error: Missing required parameters');
  console.error('Required: --payload="/path/to/payload.json"');
  console.error('\nExample:');
  console.error('node add-option-sets.js --payload="/path/to/temp-option-sets-payload.json"');
  process.exit(1);
}

// Screenshot utility - uses shared config (disabled by default)
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const takeScreenshot = async (page, name) => {
  return sharedTakeScreenshot(page, `option-sets-${name}`, SCREENSHOT_DIR);
};

async function addOptionSets() {
  // Load payload from file
  let payload;
  try {
    const payloadContent = await fs.readFile(payloadPath, 'utf-8');
    payload = JSON.parse(payloadContent);
  } catch (error) {
    console.error(`Error reading payload file: ${error.message}`);
    process.exit(1);
  }

  const { email, password, restaurantName, optionSets, menuItemMappings } = payload;

  // Get admin URL: command line arg > payload > default
  const adminUrl = (adminUrlArg || payload.adminUrl || DEFAULT_ADMIN_URL).replace(/\/$/, '');
  const LOGIN_URL = buildLoginUrl(adminUrl);
  const ADMIN_HOSTNAME = getAdminHostname(adminUrl);

  // Validate payload
  if (!email || !password || !restaurantName) {
    console.error('Error: Payload missing required fields (email, password, restaurantName)');
    process.exit(1);
  }

  if (!optionSets || optionSets.length === 0) {
    console.log('No option sets to create');
    process.exit(0);
  }

  console.log('Starting Menu Option Sets Configuration...\n');
  console.log('Configuration:');
  console.log(`  Admin Portal: ${adminUrl}`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Restaurant: ${restaurantName}`);
  console.log(`  Option Sets: ${optionSets.length}`);
  console.log(`  Debug Mode: ${DEBUG_MODE ? 'ON (browser will stay open)' : 'OFF'}`);
  console.log('');

  const browser = await createBrowser(chromium);
  const context = await createContext(browser);

  const page = await context.newPage();

  try {
    // STEP 1: Login
    console.log('STEP 1: Login to admin portal');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-login-page');

    // Fill login form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    console.log('  Credentials entered');

    // Click login button
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  Clicked login');

    // Wait for dashboard
    console.log('\nWaiting for dashboard...');
    await page.waitForURL(`**/${ADMIN_HOSTNAME}/**`, { timeout: 15000 });
    console.log('  Reached dashboard:', page.url());

    // Wait for loading overlay to disappear
    await page.waitForFunction(() => {
      const loader = document.querySelector('.cover-loader');
      return !loader || !loader.classList.contains('active');
    }, { timeout: 10000 });

    // Wait longer for dashboard content to fully load
    console.log('  Waiting for dashboard content to load...');
    await page.waitForTimeout(5000);

    // Try to wait for restaurant elements to appear
    try {
      await page.waitForSelector('h4', { timeout: 10000 });
      console.log('  Dashboard content loaded');
    } catch (error) {
      console.log('  No h4 elements found, continuing anyway...');
    }

    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('  Page load state timeout - continuing anyway');
    }
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02-dashboard-loaded');

    // STEP 2: Navigate to restaurant management with smart matching
    console.log('\nSTEP 2: Navigate to restaurant management');
    console.log(`  Looking for restaurant: ${restaurantName}`);

    await page.waitForTimeout(2000);

    // Helper function for fuzzy restaurant name matching
    const normalizeForMatching = (str) => {
      return str
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Function to calculate match score
    const calculateMatchScore = (searchTerm, restName) => {
      const searchNorm = normalizeForMatching(searchTerm);
      const nameNorm = normalizeForMatching(restName);

      if (searchNorm === nameNorm) {
        return { score: 1000, reason: 'exact match' };
      }

      const searchWords = searchNorm.split(' ').filter(w => w.length > 1);
      const nameWords = nameNorm.split(' ');

      let score = 0;
      let matchedWords = 0;
      let reason = '';

      for (const searchWord of searchWords) {
        if (nameWords.includes(searchWord)) {
          score += 10;
          matchedWords++;
        } else if (nameWords.some(nameWord => {
          const lengthDiff = Math.abs(nameWord.length - searchWord.length);
          if (lengthDiff <= 2) {
            const commonChars = searchWord.split('').filter(char => nameWord.includes(char)).length;
            return commonChars >= Math.min(searchWord.length, nameWord.length) - 1;
          }
          return false;
        })) {
          score += 8;
          matchedWords++;
        } else if (nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord))) {
          score += 5;
          matchedWords++;
        }
      }

      if (matchedWords === searchWords.length && searchWords.length > 0) {
        score += 50;
        reason = `all ${searchWords.length} words matched`;
      } else if (matchedWords > 0) {
        reason = `${matchedWords}/${searchWords.length} words matched`;
      }

      const extraWords = nameWords.length - searchWords.length;
      if (extraWords > 0 && score > 0) {
        score -= extraWords * 2;
      }

      if (score === 0 && nameNorm.includes(searchNorm)) {
        score = 25;
        reason = 'substring match';
      }

      return { score, reason };
    };

    let restaurantIndex = -1;
    let bestScore = 0;
    let bestMatch = null;

    const allRestaurantNames = await page.locator('h4').allTextContents();

    console.log(`  Found ${allRestaurantNames.length} restaurants in the list`);
    if (allRestaurantNames.length > 0) {
      console.log(`  Evaluating restaurants for best match:`);

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
      console.log(`  Best match: "${bestMatch.name}" at index ${restaurantIndex} (${bestMatch.reason})`);

      const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();

      if (await manageButton.count() === 0) {
        console.log('  Standard selector not found, trying view-store pattern...');
        const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
        if (await alternativeButton.count() > 0) {
          await alternativeButton.click();
          console.log(`  Clicked Manage button using view-store pattern`);
        } else {
          console.log('  View-store pattern not found, trying index-based fallback...');
          const allManageButtons = page.locator('button:has-text("Manage")');
          if (await allManageButtons.count() > restaurantIndex) {
            await allManageButtons.nth(restaurantIndex).click();
            console.log(`  Clicked Manage button at index ${restaurantIndex}`);
          } else {
            throw new Error('Could not find Manage button for restaurant');
          }
        }
      } else {
        await manageButton.click();
        console.log(`  Clicked Manage button for ${restaurantName}`);
      }
    } else {
      console.log(`  No matching restaurant found for "${restaurantName}"`);
      console.log('  Available restaurants:');
      allRestaurantNames.forEach((name, index) => {
        console.log(`    ${index}: "${name}"`);
      });
      throw new Error('Restaurant not found in list');
    }

    // Wait for navigation
    console.log('  Waiting for restaurant management page...');
    try {
      await page.waitForURL(`**/${ADMIN_HOSTNAME}/restaurant/**`, { timeout: 15000 });
      console.log('  Navigated to restaurant page');
    } catch (error) {
      console.log('  Navigation timeout, checking current URL...');
      const currentUrl = page.url();
      if (currentUrl.includes(`${ADMIN_HOSTNAME}/restaurant/`)) {
        console.log('  Already on restaurant page');
      } else {
        throw error;
      }
    }

    await page.waitForTimeout(2000);
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('  Page load state timeout - continuing anyway');
    }

    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-restaurant-management');

    // STEP 3: Click Menu button
    console.log('\nSTEP 3: Navigate to Menu section');

    await page.waitForFunction(() => {
      const spinner = document.querySelector('.loader, .loading, .spinner, svg[class*="spin"]');
      return !spinner || spinner.style.display === 'none';
    }, { timeout: 10000 }).catch(() => console.log('  Loading check timeout, continuing...'));

    try {
      await page.click('#nav-link-menus');
      console.log('  Clicked Menu navigation');
    } catch {
      try {
        const menuIcon = page.locator('aside a[href*="/menu"], nav a[href*="/menu"], #nav-link-menus').first();
        await menuIcon.click();
        console.log('  Clicked Menu navigation (via href selector)');
      } catch {
        const navItems = await page.locator('aside a, nav a, [id^="nav-link"]').all();
        if (navItems.length >= 4) {
          await navItems[3].click();
          console.log('  Clicked Menu navigation (via position)');
        } else {
          throw new Error('Could not find menu navigation');
        }
      }
    }

    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('  Page load state timeout - continuing anyway');
    }
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04-menu-page');

    // STEP 4: Click Option Sets Tab
    console.log('\nSTEP 4: Navigate to Option Sets tab');

    try {
      await page.click(SELECTORS.optionSetsTab);
      console.log('  Clicked Option Sets tab button');
    } catch {
      try {
        const optionSetsButton = page.locator('button').filter({ hasText: /Option|Sets/i }).first();
        await optionSetsButton.click();
        console.log('  Clicked Option Sets tab button (via text search)');
      } catch {
        console.error('  Could not find Option Sets tab button');
        throw new Error('Option Sets tab button not found');
      }
    }

    await page.waitForTimeout(2000);
    await takeScreenshot(page, '05-option-sets-page');

    // STEP 5: Create Option Sets in loop
    console.log('\nSTEP 5: Creating Option Sets');
    console.log(`  ${optionSets.length} option sets to create\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < optionSets.length; i++) {
      const optionSet = optionSets[i];
      console.log(`  [${i + 1}/${optionSets.length}] Creating: "${optionSet.name}"`);
      console.log(`    - Required: ${optionSet.is_required}, Multiple: ${optionSet.multiple_selections_allowed}`);
      console.log(`    - Min: ${optionSet.min_selections}, Max: ${optionSet.max_selections}`);
      console.log(`    - Items: ${optionSet.items?.length || 0}`);

      try {
        // Step 5.1: Click "Create New Option Set" button
        await page.click(SELECTORS.createButton);
        await page.waitForTimeout(800);

        // Step 5.2: Fill Name input
        const nameInput = page.locator(SELECTORS.nameInput);
        await nameInput.fill(optionSet.name);
        await page.waitForTimeout(200);

        // Step 5.3: Fill Display Name input
        const displayNameInput = page.locator(SELECTORS.displayNameInput);
        await displayNameInput.fill(optionSet.display_name || optionSet.name);
        await page.waitForTimeout(200);

        // Step 5.4: Click Conditions tab
        try {
          await page.click(SELECTORS.conditionsTab);
          await page.waitForTimeout(500);
          console.log('    Switched to Conditions tab');
        } catch (tabError) {
          console.log('    Could not click Conditions tab, trying fallback...');
          const condTab = page.locator('div').filter({ hasText: /Conditions/i }).first();
          await condTab.click();
          await page.waitForTimeout(500);
        }

        // Step 5.5: Toggle Required if needed
        if (optionSet.is_required) {
          try {
            await page.click(SELECTORS.requiredToggle);
            console.log('    Toggled Required ON');
            await page.waitForTimeout(300);
          } catch (toggleError) {
            console.log('    Could not toggle Required:', toggleError.message);
          }
        }

        // Step 5.6: Toggle Select Multiple if needed
        if (optionSet.multiple_selections_allowed) {
          try {
            await page.click(SELECTORS.selectMultipleToggle);
            console.log('    Toggled Select Multiple ON');
            await page.waitForTimeout(300);
          } catch (toggleError) {
            console.log('    Could not toggle Select Multiple:', toggleError.message);
          }
        }

        // Step 5.7: Toggle Enable Option Quantity if max_selections > 1
        if (optionSet.max_selections > 1) {
          try {
            await page.click(SELECTORS.enableQuantityToggle);
            console.log('    Toggled Enable Quantity ON');
            await page.waitForTimeout(300);
          } catch (toggleError) {
            console.log('    Could not toggle Enable Quantity:', toggleError.message);
          }
        }

        // Step 5.8: Fill Min Options Required
        try {
          const minInput = page.locator(SELECTORS.minSelectionsInput);
          await minInput.click();
          await minInput.fill(String(optionSet.min_selections || 0));
          console.log(`    Set Min Selections: ${optionSet.min_selections || 0}`);
          await page.waitForTimeout(200);
        } catch (inputError) {
          console.log('    Could not set Min Selections:', inputError.message);
        }

        // Step 5.9: Fill Max Options Required
        try {
          const maxInput = page.locator(SELECTORS.maxSelectionsInput);
          await maxInput.click();
          await maxInput.fill(String(optionSet.max_selections || 1));
          console.log(`    Set Max Selections: ${optionSet.max_selections || 1}`);
          await page.waitForTimeout(200);
        } catch (inputError) {
          console.log('    Could not set Max Selections:', inputError.message);
        }

        // Step 5.10: Click Options tab
        try {
          await page.click(SELECTORS.optionsTab);
          await page.waitForTimeout(500);
          console.log('    Switched to Options tab');
        } catch (tabError) {
          console.log('    Could not click Options tab, trying fallback...');
          const optTab = page.locator('div').filter({ hasText: /^Options$/i }).first();
          await optTab.click();
          await page.waitForTimeout(500);
        }

        // Step 5.11: Add option items
        const items = optionSet.items || [];
        if (items.length > 0) {
          console.log(`    Adding ${items.length} option items...`);

          // Click Add Option button for each item
          for (let j = 0; j < items.length; j++) {
            try {
              await page.click(SELECTORS.addOptionButton);
              await page.waitForTimeout(400);
            } catch (addError) {
              console.log(`    Could not click Add Option for item ${j + 1}`);
            }
          }

          await page.waitForTimeout(500);

          // Step 5.12: Fill in option names, print names, and prices
          // Target inputs specifically within the options table rows (not the whole form)
          // Each table row (tr) contains: arrows, Name input, Print Name input, Price input, checkbox, buttons
          const tableRows = await page.locator('form table tbody tr').all();
          console.log(`    Found ${tableRows.length} option rows`);

          // Fill each row individually
          let filledCount = 0;
          for (let j = 0; j < items.length && j < tableRows.length; j++) {
            const item = items[j];
            const row = tableRows[j];
            try {
              // Find inputs within this specific row
              const rowTextInputs = await row.locator('input[type="text"]').all();
              const rowNumberInputs = await row.locator('input[type="number"]').all();

              // Fill Name input (first text input in row)
              if (rowTextInputs.length > 0) {
                await rowTextInputs[0].fill(item.name);
                await page.waitForTimeout(100);
              }

              // Fill Print Name input (second text input in row)
              if (rowTextInputs.length > 1) {
                await rowTextInputs[1].fill(item.name);
                await page.waitForTimeout(100);
              }

              // Fill Price input (number input in row) - only if price > 0
              if (rowNumberInputs.length > 0 && item.price && item.price > 0) {
                const priceStr = item.price.toFixed(2);
                await rowNumberInputs[0].fill(priceStr);
                await page.waitForTimeout(100);
              }

              filledCount++;
              const priceDisplay = item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : '(Free)';
              console.log(`      Added: "${item.name}" - ${priceDisplay}`);
            } catch (itemError) {
              console.log(`      Failed to fill item "${item.name}": ${itemError.message}`);
            }
          }
          console.log(`    Filled ${filledCount}/${items.length} option items`);
        }

        // Step 5.13: Add to menu items (if menuItemNames provided)
        const menuItemNames = optionSet.menuItemNames || [];
        if (menuItemNames.length > 0) {
          console.log(`    Adding to ${menuItemNames.length} menu items...`);

          try {
            // Click "Add / Remove From Items" tab
            await page.click(SELECTORS.addRemoveItemsTab);
            await page.waitForTimeout(500);
            console.log('    Switched to Add/Remove From Items tab');

            // Expand the Menu tree (click the main Menu expand arrow)
            try {
              await page.click(SELECTORS.menuExpandArrow);
              await page.waitForTimeout(300);
              console.log('    Expanded Menu tree');
            } catch (expandError) {
              console.log('    Menu tree may already be expanded or not found');
            }

            // Expand all category sections
            // Categories are under: form > div > div:nth-child(1) > div > div > div > div > div > div.m-l-2 > div:nth-child(N)
            const categoryExpanders = await page.locator('form div.m-l-2 > div > div > div.cursor.flex-center > svg').all();
            console.log(`    Found ${categoryExpanders.length} category expanders`);

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
            // Deduplicate names, then click ALL matching checkboxes for each name
            // This handles items appearing in both Featured Items AND their category
            let matchedCount = 0;
            const uniqueMenuItemNames = [...new Set(menuItemNames)];
            for (const itemName of uniqueMenuItemNames) {
              try {
                // Find ALL matching spans with m-l-2 class (menu item labels)
                const labelSpanLocator = page.locator(`span.m-l-2:text-is("${itemName}")`);
                const count = await labelSpanLocator.count();
                if (count > 0) {
                  // Click all matching checkboxes
                  for (let i = 0; i < count; i++) {
                    const labelSpan = labelSpanLocator.nth(i);
                    const parentLabel = labelSpan.locator('xpath=ancestor::label');
                    await parentLabel.click();
                  }
                  matchedCount++;
                  console.log(`      Checked: "${itemName}" (${count} checkbox${count > 1 ? 'es' : ''})`);
                } else {
                  console.log(`      Not found: "${itemName}"`);
                }
              } catch (checkError) {
                console.log(`      Failed to check "${itemName}": ${checkError.message}`);
              }
            }
            console.log(`    Matched ${matchedCount}/${uniqueMenuItemNames.length} menu items`);

          } catch (addItemsError) {
            console.log(`    Failed to add menu items: ${addItemsError.message}`);
          }
        }

        // Step 5.14: Click Save button
        await page.waitForTimeout(500);
        await page.click(SELECTORS.saveButton);
        console.log('    Clicked Save');

        // Step 5.14: Wait for save to complete
        await page.waitForTimeout(2500);

        console.log(`    Created "${optionSet.name}" successfully`);
        successCount++;

      } catch (optionSetError) {
        console.error(`    Failed to create "${optionSet.name}": ${optionSetError.message}`);
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
    await takeScreenshot(page, '06-option-sets-completed');

    // Summary
    console.log('\nOption Sets Summary:');
    console.log(`  Successfully created: ${successCount}/${optionSets.length}`);
    if (failCount > 0) {
      console.log(`  Failed: ${failCount}/${optionSets.length}`);
    }

    if (successCount === optionSets.length) {
      console.log('\nAll option sets configured successfully!');
    } else if (successCount > 0) {
      console.log('\nOption sets partially configured');
    } else {
      throw new Error('Failed to create any option sets');
    }

  } catch (error) {
    console.error('\nError during option sets configuration:', error.message);
    await takeScreenshot(page, 'error-state');
    throw error;
  } finally {
    if (DEBUG_MODE) {
      console.log('\nDEBUG MODE: Browser left open for inspection');
      console.log('Press Ctrl+C to exit');
      await new Promise(() => {}); // Keep alive indefinitely
    } else {
      await browser.close();
      console.log('\nBrowser closed');
    }
  }
}

// Run the script
addOptionSets().catch((error) => {
  console.error('Script failed:', error.message);
  process.exit(1);
});
