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
const { chromium } = require('playwright');

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

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email) {
  console.error('❌ Error: Email is required');
  console.error('Usage: node navigate-to-payments-settings.js --email="email@example.com"');
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
    
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
    console.log('  ✓ Login successful');
    
    // Wait for dashboard to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02-dashboard');
    
    // STEP 2: Navigate to restaurant management
    console.log('\n🏪 STEP 2: Navigate to restaurant management');
    
    const manageButton = page.locator('#restaurant-list-item-0 button:has-text("Manage")').first();
    await manageButton.click();
    console.log('  ✓ Clicked Manage button');
    
    // Wait for navigation to complete and page to load
    console.log('  ⏳ Waiting for restaurant management page to load...');
    try {
      // Wait for URL change to restaurant management
      await page.waitForURL('**/restaurant/**', { timeout: 10000 });
      console.log('  ✓ Navigated to restaurant page');
      
      // Wait for the navigation menu to appear
      await page.waitForSelector('#nav-link-settings', { timeout: 10000 });
      console.log('  ✓ Navigation menu loaded');
      
      // Additional wait for any dynamic content
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.log('  ⚠️ Initial wait failed, trying alternative approach...');
      // Fallback: just wait for network to be idle
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.waitForTimeout(3000);
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
    const currencyInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div';
    await page.click(currencyInputSelector);
    await page.waitForTimeout(1000);
    
    // 8. Type NZD
    await page.keyboard.type('NZD');
    await page.waitForTimeout(1500);
    
    // 9. Click NZD option from dropdown
    const nzdOptionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div';
    await page.click(nzdOptionSelector);
    await page.waitForTimeout(1000);
    console.log('  ✓ Set currency to NZD');
    
    // 10. Set Layout to "Accordion without radio button"
    console.log('  Setting layout...');
    const layoutSectionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj';
    const layoutSection = page.locator(layoutSectionSelector);
    await layoutSection.scrollIntoViewIfNeeded();
    await layoutSection.click();
    await page.waitForTimeout(1000);
    
    // 11. Click "Accordion without radio button"
    const accordionOptionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div:nth-child(3)';
    await page.click(accordionOptionSelector);
    await page.waitForTimeout(1000);
    console.log('  ✓ Set layout to Accordion without radio button');
    
    // 12. Set Theme to "Flat"
    console.log('  Setting theme...');
    const themeSectionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div';
    const themeSection = page.locator(themeSectionSelector);
    await themeSection.scrollIntoViewIfNeeded();
    await themeSection.click();
    await page.waitForTimeout(1000);
    
    // 13. Click "Flat"
    const flatOptionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div:nth-child(3)';
    await page.click(flatOptionSelector);
    await page.waitForTimeout(1000);
    console.log('  ✓ Set theme to Flat');
    
    // 14-15. Set Label to "Stripe"
    console.log('  Setting labels...');
    const labelInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(9) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const labelInput = page.locator(labelInputSelector);
    await labelInput.scrollIntoViewIfNeeded();
    await labelInput.click();
    await labelInput.fill('Stripe');
    console.log('  ✓ Set label to Stripe');
    
    // 16-17. Set Delivery Label to "Stripe"
    const deliveryLabelSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(10) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const deliveryLabel = page.locator(deliveryLabelSelector);
    await deliveryLabel.scrollIntoViewIfNeeded();
    await deliveryLabel.click();
    await deliveryLabel.fill('Stripe');
    console.log('  ✓ Set delivery label to Stripe');
    
    // 18-19. Set Print Label to "Paid Online - Pump'd"
    const printLabelSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(11) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const printLabel = page.locator(printLabelSelector);
    await printLabel.scrollIntoViewIfNeeded();
    await printLabel.click();
    await printLabel.fill("Paid Online - Pump'd");
    console.log('  ✓ Set print label');
    
    // 20-21. Set Maximum Order Value to "9999"
    const maxOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(12) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const maxOrder = page.locator(maxOrderSelector);
    await maxOrder.scrollIntoViewIfNeeded();
    await maxOrder.click();
    await maxOrder.fill('9999');
    console.log('  ✓ Set maximum order value to $9999');
    
    // 22-23. Set Minimum Order Value to "2"
    const minOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(13) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
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
    
    // 26. Click "Connect to Stripe"
    console.log('\n🔗 STEP 6: Connecting to Stripe');
    const connectStripeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div > button';
    const connectButton = page.locator(connectStripeSelector);
    await connectButton.scrollIntoViewIfNeeded();
    
    // Store the current URL before clicking
    const urlBeforeClick = page.url();
    console.log('  Current URL before click:', urlBeforeClick);
    
    // Click the button and handle navigation
    await connectButton.click();
    console.log('  ✓ Clicked Connect to Stripe');
    
    // Wait longer for navigation to start (increased from 2000 to 5000)
    console.log('  ⏳ Waiting for Stripe Connect to load...');
    await page.waitForTimeout(5000);
    
    // Check what happened after clicking
    let stripeConnectUrl = page.url();
    let navigationMethod = 'unknown';
    
    // Check if URL changed in the same tab
    if (stripeConnectUrl !== urlBeforeClick) {
      if (stripeConnectUrl.includes('stripe.com')) {
        navigationMethod = 'same-tab';
        console.log('  ✓ Navigated to Stripe Connect in same tab');
      } else {
        console.log('  ⚠️ URL changed but not to Stripe:', stripeConnectUrl);
      }
    } else {
      // URL didn't change, check for new tab
      console.log('  URL unchanged, checking for new tab...');
      const pages = context.pages();
      console.log(`  Found ${pages.length} total page(s)`);
      
      if (pages.length > 1) {
        const newPage = pages[pages.length - 1];
        await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
        // Additional wait for the page to fully load
        await newPage.waitForTimeout(3000);
        stripeConnectUrl = newPage.url();
        navigationMethod = 'new-tab';
        console.log('  ✓ Stripe Connect opened in new tab');
        console.log('  New tab URL:', stripeConnectUrl);
      } else {
        // No new tab, wait a bit more and check URL again
        console.log('  No new tab detected, waiting for possible redirect...');
        await page.waitForTimeout(5000);
        stripeConnectUrl = page.url();
        if (stripeConnectUrl !== urlBeforeClick) {
          navigationMethod = 'delayed-redirect';
          console.log('  ✓ Page redirected after delay');
        } else {
          navigationMethod = 'no-navigation';
          console.log('  ⚠️ No navigation detected - button may require manual interaction');
        }
      }
    }
    
    console.log('\n🌐 Stripe Connect Results:');
    console.log('━'.repeat(50));
    console.log(`Navigation Method: ${navigationMethod}`);
    console.log(`Final URL: ${stripeConnectUrl}`);
    console.log('━'.repeat(50));
    
    await takeScreenshot(page, '06-stripe-configured');
    
    console.log('\n✅ Stripe payment method successfully configured!');
    console.log('⚠️  Please complete the Stripe connection process at the URL above');
    
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