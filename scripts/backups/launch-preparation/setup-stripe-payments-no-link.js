#!/usr/bin/env node

/**
 * Setup Stripe Payments
 * 
 * This script logs into the admin portal and configures Stripe payment settings
 * 
 * Usage:
 *   node setup-stripe-payments.js --email=<email> [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --debug                   Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   ADMIN_PASSWORD          Admin password for login
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
const password = getArg('password');  // NEW: User password
const restaurantName = getArg('name'); // NEW: For matching

// Validate required arguments
if (!email || !password || !restaurantName) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<restaurant_name>');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `payments-settings-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function setupStripePayments() {
  console.log('🚀 Starting Stripe Payments Configuration...\n');
  
  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Restaurant Name: ${restaurantName}`);
  console.log(`  Debug Mode: ${DEBUG_MODE}`);
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    // STEP 1: Login
    console.log('🔐 STEP 1: Login to admin portal');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeScreenshot(page, '01-login-page');
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    console.log('  ✓ Credentials entered');
    
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  ✓ Clicked login');
    
    // Wait for redirect
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
    
    // STEP 2: Navigate to restaurant management with smart matching
    console.log('\n🏪 STEP 2: Navigate to restaurant management');
    console.log(`  🔍 Looking for restaurant: ${restaurantName}`);
    
    // Wait a bit for the list to fully render
    await page.waitForTimeout(2000);
    
    // Helper functions for smart matching
    const normalizeForMatching = (str) => {
      return str
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const calculateMatchScore = (searchTerm, restaurantNameInList) => {
      const searchNorm = normalizeForMatching(searchTerm);
      const nameNorm = normalizeForMatching(restaurantNameInList);
      
      // Exact match (after normalization) - highest priority
      if (searchNorm === nameNorm) {
        return { score: 1000, reason: 'exact match' };
      }
      
      // Split into words for word-based matching
      const searchWords = searchNorm.split(' ').filter(w => w.length > 1);
      const nameWords = nameNorm.split(' ');
      
      let score = 0;
      let matchedWords = 0;
      let reason = '';
      
      // Count how many search words are found in the restaurant name
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
      
      // Bonus for matching all words
      if (matchedWords === searchWords.length && searchWords.length > 0) {
        score += 50;
        reason = `all ${searchWords.length} words matched`;
      } else if (matchedWords > 0) {
        reason = `${matchedWords}/${searchWords.length} words matched`;
      }
      
      // Penalty for extra words
      const extraWords = nameWords.length - searchWords.length;
      if (extraWords > 0 && score > 0) {
        score -= extraWords * 2;
      }
      
      // Substring match fallback
      if (score === 0 && nameNorm.includes(searchNorm)) {
        score = 25;
        reason = 'substring match';
      }
      
      return { score, reason };
    };
    
    // Find the best matching restaurant
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
      
      // Try multiple selectors for the Manage button
      const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
      
      if (await manageButton.count() === 0) {
        console.log('  ⚠️ Standard selector not found, trying view-store pattern...');
        const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
        if (await alternativeButton.count() > 0) {
          await alternativeButton.click();
          console.log(`  ✓ Clicked Manage button using view-store pattern`);
        } else {
          console.log('  ⚠️ View-store pattern not found, trying index-based fallback...');
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
    
    // Wait for navigation to complete
    console.log('  ⏳ Waiting for navigation to restaurant management...');
    try {
      await page.waitForURL('**/restaurant/**', { timeout: 8000 });
      console.log('  ✓ Navigated to restaurant page');
    } catch (error) {
      console.log('  ⚠️ Navigation timeout, checking current URL...');
    }
    
    // Additional wait to ensure page is fully loaded
    await page.waitForTimeout(3000);
    try {
      await page.waitForLoadState('networkidle', { timeout: 8000 });
    } catch (error) {
      console.log('  ⚠️ Network idle timeout after navigation, continuing...');
    }
    
    // Wait for the navigation menu to appear
    try {
      await page.waitForSelector('#nav-link-settings', { timeout: 8000 });
      console.log('  ✓ Navigation menu loaded');
    } catch (error) {
      console.log('  ⚠️ Settings link not found, continuing anyway...');
    }
    
    console.log('  ✓ Restaurant management page loaded');
    await takeScreenshot(page, '03-restaurant-management');
    
    // STEP 3: Navigate to Settings section
    console.log('\n⚙️ STEP 3: Navigate to Settings section');
    
    // Wait for the navigation menu to be fully loaded
    console.log('  ⏳ Waiting for navigation menu to load...');
    
    try {
      // Try ID-based selector first
      const settingsLink = page.locator('#nav-link-settings');
      if (await settingsLink.count() > 0) {
        await settingsLink.click();
        console.log('  ✓ Clicked Settings navigation (via ID)');
      } else {
        // Fallback to text-based selector
        const settingsTextLink = page.locator('nav a:has-text("Settings"), nav button:has-text("Settings")').first();
        if (await settingsTextLink.count() > 0) {
          await settingsTextLink.click();
          console.log('  ✓ Clicked Settings navigation (via text)');
        } else {
          // Try looking for icon + text combination
          const settingsIconLink = page.locator('a:has(svg):has-text("Settings")').first();
          if (await settingsIconLink.count() > 0) {
            await settingsIconLink.click();
            console.log('  ✓ Clicked Settings navigation (via icon+text)');
          } else {
            console.log('  ⚠️ Could not find Settings link, trying alternative selectors...');
            // Look for any link containing "settings" in href
            const settingsHrefLink = page.locator('a[href*="settings"]').first();
            await settingsHrefLink.click();
            console.log('  ✓ Clicked Settings navigation (via href)');
          }
        }
      }
    } catch (error) {
      console.error('  ❌ Failed to navigate to Settings:', error.message);
      await takeScreenshot(page, 'error-settings-navigation');
      throw error;
    }
    
    // Wait for settings page to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04-settings-page');
    
    // STEP 4: Click on Payments tab
    console.log('\n💳 STEP 4: Navigate to Payments tab');
    
    // Wait for the tab navigation to be visible
    await page.waitForTimeout(2000);
    
    try {
      // Try to find and click Payments text directly
      const paymentsText = page.locator('text="Payments"').first();
      if (await paymentsText.count() > 0) {
        await paymentsText.click();
        console.log('  ✓ Clicked on Payments text');
        await page.waitForTimeout(2000);
      } else {
        // Fallback: Try button with Payments text
        console.log('  Payments text not found, trying button selector...');
        const paymentsButton = page.locator('button:has-text("Payments")').first();
        if (await paymentsButton.count() > 0) {
          await paymentsButton.click();
          console.log('  ✓ Clicked Payments button');
          await page.waitForTimeout(2000);
        } else {
          throw new Error('Could not find Payments tab');
        }
      }
      
      // Verify we're on the Payments tab by checking for Payments-specific content
      const paymentsContent = await page.locator('text=/Payment Methods|Transaction|Fee/i').count();
      if (paymentsContent > 0) {
        console.log('  ✓ Payments tab content detected');
      } else {
        console.log('  ⚠️ Could not verify Payments content, checking URL...');
      }
      
      console.log('  ✓ Successfully navigated to Payments tab');
      
    } catch (error) {
      console.error('  ❌ Failed to navigate to Payments tab:', error.message);
      await takeScreenshot(page, 'error-payments-tab');
      throw error;
    }
    
    await takeScreenshot(page, '05-payments-settings');
    
    console.log('\n✅ Successfully navigated to Payments Settings!');
    
    // STEP 5: Configure Stripe Payment Method
    console.log('\n💳 STEP 5: Configuring Stripe Payment Method');
    
    // 1. Click "Add Payment Method"
    console.log('  Adding payment method...');
    const addPaymentMethodSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.heading__SettingsSectionHeading-gINcTH.hDzVir.flex-l-r-center > div.flex-line.centered.cursor';
    await page.click(addPaymentMethodSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Clicked Add Payment Method');
    
    // 2. Click "Stripe"
    console.log('  Selecting Stripe...');
    // Use the generic selector that works with dynamic IDs
    const stripeOptionSelector = 'div[id$="-content"] > div:nth-child(4) > div > div:nth-child(1)';
    await page.click(stripeOptionSelector);
    console.log('  ✓ Selected Stripe');
    await page.waitForTimeout(1000);
    
    // 3. Scroll to and click "Add Method" button
    console.log('  Adding Stripe method...');
    // Use a more flexible selector for the Add Method button
    const addMethodButtonSelector = 'div[id$="-content"] > div:nth-child(5) > button';
    const addMethodButton = page.locator(addMethodButtonSelector);
    await addMethodButton.scrollIntoViewIfNeeded();
    await addMethodButton.click();
    console.log('  ✓ Clicked Add Method');
    
    // 4. Wait for method to be added - wait for the popup to close and Stripe section to appear
    console.log('  ⏳ Waiting for Stripe to be added...');
    try {
      // Wait for the popup/modal to disappear (it should close after adding)
      await page.waitForTimeout(2000); // Brief wait for animation
      
      // Wait for Stripe settings section to appear in the list
      const stripeSettingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(4)';
      await page.waitForSelector(stripeSettingsSelector, { timeout: 5000 });
      console.log('  ✓ Stripe payment method added successfully');
    } catch (error) {
      console.log('  ⚠️ Could not verify Stripe was added, continuing anyway...');
      await page.waitForTimeout(3000); // Fallback wait
    }
    
    // 5. Open Stripe settings
    console.log('  Opening Stripe settings...');
    const stripeSettingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(4)';
    await page.click(stripeSettingsSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Opened Stripe settings');
    
    // 6. Enable Stripe toggle
    console.log('  Enabling Stripe...');
    const enableToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
    const enableToggle = page.locator(enableToggleSelector);
    await enableToggle.scrollIntoViewIfNeeded();
    await enableToggle.click();
    console.log('  ✓ Enabled Stripe');
    await page.waitForTimeout(1000);
    
    // 7. Set Currency to NZD
    console.log('  Setting currency to NZD...');
    const currencyInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div';
    await page.click(currencyInputSelector);
    await page.waitForTimeout(1000);
    
    // 8. Type NZD
    await page.keyboard.type('NZD');
    await page.waitForTimeout(1500);
    
    // 9. Click NZD option from dropdown
    const nzdOptionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div';
    await page.click(nzdOptionSelector);
    await page.waitForTimeout(1000);
    console.log('  ✓ Set currency to NZD');
    
    // 10. Set Layout to "Accordion without radio button"
    console.log('  Setting layout...');
    const layoutSectionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj';
    const layoutSection = page.locator(layoutSectionSelector);
    await layoutSection.scrollIntoViewIfNeeded();
    await layoutSection.click();
    await page.waitForTimeout(1000);
    
    // 11. Click "Accordion without radio button"
    const accordionOptionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div:nth-child(3)';
    await page.click(accordionOptionSelector);
    await page.waitForTimeout(1000);
    console.log('  ✓ Set layout to Accordion without radio button');
    
    // 12. Set Theme to "Flat"
    console.log('  Setting theme...');
    const themeSectionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div';
    const themeSection = page.locator(themeSectionSelector);
    await themeSection.scrollIntoViewIfNeeded();
    await themeSection.click();
    await page.waitForTimeout(1000);
    
    // 13. Click "Flat"
    const flatOptionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div:nth-child(3)';
    await page.click(flatOptionSelector);
    await page.waitForTimeout(1000);
    console.log('  ✓ Set theme to Flat');
    
    // 14-15. Set Label to "Stripe"
    console.log('  Setting labels...');
    const labelInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(8) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const labelInput = page.locator(labelInputSelector);
    await labelInput.scrollIntoViewIfNeeded();
    await labelInput.click();
    await labelInput.fill('Stripe');
    console.log('  ✓ Set label to Stripe');
    
    // 16-17. Set Delivery Label to "Stripe"
    const deliveryLabelSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(9) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const deliveryLabel = page.locator(deliveryLabelSelector);
    await deliveryLabel.scrollIntoViewIfNeeded();
    await deliveryLabel.click();
    await deliveryLabel.fill('Stripe');
    console.log('  ✓ Set delivery label to Stripe');
    
    // 18-19. Set Print Label to "Paid Online - Pump'd"
    const printLabelSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(10) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const printLabel = page.locator(printLabelSelector);
    await printLabel.scrollIntoViewIfNeeded();
    await printLabel.click();
    await printLabel.fill("Paid Online - Pump'd");
    console.log('  ✓ Set print label');
    
    // 20-21. Set Maximum Order Value to "9999"
    const maxOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(11) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const maxOrder = page.locator(maxOrderSelector);
    await maxOrder.scrollIntoViewIfNeeded();
    await maxOrder.click();
    await maxOrder.fill('9999');
    console.log('  ✓ Set maximum order value to $9999');
    
    // 22-23. Set Minimum Order Value to "2"
    const minOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(12) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const minOrder = page.locator(minOrderSelector);
    await minOrder.scrollIntoViewIfNeeded();
    await minOrder.click();
    await minOrder.fill('2');
    console.log('  ✓ Set minimum order value to $2');
    
    // 24. Save the configuration
    console.log('  Saving configuration...');
    const saveButtonSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
    const saveButton = page.locator(saveButtonSelector);
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    console.log('  ✓ Configuration saved');
    
    // 25. Wait for save to complete with extra margin for error
    console.log('  ⏳ Waiting for configuration to save...');
    await page.waitForTimeout(8000); // Increased from 3000 to 8000 for better reliability
    
    // Note: Connect to Stripe button is no longer available in the UI
    // The configuration is complete at this point
    
    await takeScreenshot(page, '06-stripe-configured');
    
    console.log('\n✅ Stripe payment method successfully configured!');
    console.log('ℹ️  Note: Stripe connection must be completed separately through the Stripe dashboard');
    
    // Keep browser open in debug mode
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode enabled - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    }
    
  } catch (error) {
    console.error('\n❌ Navigation failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    // Debug information
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode - browser will remain open for inspection');
      await new Promise(() => {});
    }
    
    throw error;
  } finally {
    if (!DEBUG_MODE) {
      console.log('\n✨ Browser closed');
      await browser.close();
    }
  }
}

// Run the script
setupStripePayments().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});