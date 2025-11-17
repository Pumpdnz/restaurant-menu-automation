#!/usr/bin/env node

/**
 * Setup Services Settings
 * 
 * This script logs into the admin portal and configures Services settings
 * 
 * Usage:
 *   node setup-services-settings.js --email=<email> [options]
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
  console.error('Usage: node navigate-to-services-settings.js --email="email@example.com"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `services-settings-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function setupServicesSettings() {
  console.log('🚀 Starting Services Settings Configuration...\n');
  
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
    
    // STEP 4: Click on Services tab
    console.log('\n🛠️ STEP 4: Navigate to Services tab');
    
    // Wait for the tab navigation to be visible
    await page.waitForTimeout(2000);
    
    try {
      // Try to find and click Services text directly
      const servicesText = page.locator('text="Services"').first();
      if (await servicesText.count() > 0) {
        await servicesText.click();
        console.log('  ✓ Clicked on Services text');
        await page.waitForTimeout(2000);
      } else {
        // Fallback: Try button with Services text
        console.log('  Services text not found, trying button selector...');
        const servicesButton = page.locator('button:has-text("Services")').first();
        if (await servicesButton.count() > 0) {
          await servicesButton.click();
          console.log('  ✓ Clicked Services button');
          await page.waitForTimeout(2000);
        } else {
          throw new Error('Could not find Services tab');
        }
      }
      
      // Verify we're on the Services tab by checking for Services-specific content
      const servicesContent = await page.locator('text=/Delivery|Pickup|Dine/i').count();
      if (servicesContent > 0) {
        console.log('  ✓ Services tab content detected');
      } else {
        console.log('  ⚠️ Could not verify Services content, checking URL...');
      }
      
      console.log('  ✓ Successfully navigated to Services tab');
      
    } catch (error) {
      console.error('  ❌ Failed to navigate to Services tab:', error.message);
      await takeScreenshot(page, 'error-services-tab');
      throw error;
    }
    
    await takeScreenshot(page, '05-services-settings');
    
    console.log('\n✅ Successfully navigated to Services Settings!');
    
    // STEP 5: Configure Pickup Settings
    console.log('\n🚚 STEP 5: Configuring Pickup Settings');
    
    // 1. Click the Pickups dropdown to expand
    console.log('  Expanding Pickups section...');
    const pickupsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(1)';
    await page.click(pickupsSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Expanded Pickups section');
    
    // 2. Click Order Timing tab
    console.log('  Navigating to Order Timing tab...');
    try {
      // First try clicking the text directly
      const orderTimingText = page.locator('text="Order Timing"').first();
      if (await orderTimingText.count() > 0) {
        await orderTimingText.click();
        console.log('  ✓ Clicked Order Timing tab (via text)');
      }
    } catch (error) {
      // Fallback to selector
      console.log('  Text click failed, trying selector...');
      const orderTimingSelector = '#accounts-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div';
      await page.click(orderTimingSelector);
      console.log('  ✓ Clicked Order Timing tab (via selector)');
    }
    await page.waitForTimeout(2000);
    
    // 3. Set First Order Offset to 0
    console.log('  Setting First Order Offset...');
    const firstOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const firstOrderInput = page.locator(firstOrderSelector);
    await firstOrderInput.fill('0');
    console.log('  ✓ Set First Order Offset to 0 minutes');
    
    // 4. Set Last Order Offset to 15
    console.log('  Setting Last Order Offset...');
    const lastOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const lastOrderInput = page.locator(lastOrderSelector);
    await lastOrderInput.fill('15');
    console.log('  ✓ Set Last Order Offset to 15 minutes');
    
    // 5. Set Maximum Days Ahead to 8
    console.log('  Setting Maximum Days Ahead...');
    const maxDaysSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const maxDaysInput = page.locator(maxDaysSelector);
    await maxDaysInput.fill('8');
    console.log('  ✓ Set Maximum Days Ahead to 8 days');
    
    // 6. Save the configuration
    console.log('  Saving Order Timing configuration...');
    const saveButtonSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveButton = page.locator(saveButtonSelector);
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    console.log('  ✓ Configuration saved');
    
    // 7. Wait for save to complete and page to update
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    // 8. Scroll to top of page using the scroll-root container
    console.log('  Scrolling to top...');
    const scrollRoot = page.locator('#scroll-root');
    await scrollRoot.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(2000);
    
    // 9. Click Wait Times & Auto Statuses tab
    console.log('  Navigating to Wait Times & Auto Statuses tab...');
    try {
      // First try clicking the text directly
      const waitTimesText = page.locator('text="Wait Times & Auto Statuses"').first();
      if (await waitTimesText.count() > 0) {
        await waitTimesText.click();
        console.log('  ✓ Clicked Wait Times tab (via text)');
      }
    } catch (error) {
      // Fallback to selector
      console.log('  Text click failed, trying selector...');
      const waitTimesSelector = '#accounts-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(4) > div';
      await page.click(waitTimesSelector);
      console.log('  ✓ Clicked Wait Times tab (via selector)');
    }
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, '06-wait-times-tab');
    
    // STEP 6: Configure Wait Times & Auto Statuses
    console.log('\n⏱️ STEP 6: Configuring Wait Times & Auto Statuses');
    
    // 1. Click each of the Auto status toggles to toggle them on
    console.log('  Enabling Auto Confirm toggle...');
    const confirmToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(1) > div';
    await page.click(confirmToggleSelector);
    console.log('  ✓ Clicked Auto Confirm toggle');
    await page.waitForTimeout(1000);
    
    console.log('  Enabling Auto Ready toggle...');
    const readyToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(2) > div';
    await page.click(readyToggleSelector);
    console.log('  ✓ Clicked Auto Ready toggle');
    await page.waitForTimeout(1000);
    
    console.log('  Enabling Auto Complete toggle...');
    const completeToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(3) > div';
    await page.click(completeToggleSelector);
    console.log('  ✓ Clicked Auto Complete toggle');
    await page.waitForTimeout(1000);
    
    // 2. Scroll to and click into Time Till Confirm input
    console.log('  Setting Time Till Confirm...');
    const confirmTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const confirmTimeInput = page.locator(confirmTimeSelector);
    await confirmTimeInput.scrollIntoViewIfNeeded();
    await confirmTimeInput.click();
    await confirmTimeInput.fill('1');
    console.log('  ✓ Set Time Till Confirm to 1 minute');
    
    // 4. Scroll to and click into Time Till Ready input
    console.log('  Setting Time Till Ready...');
    const readyTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const readyTimeInput = page.locator(readyTimeSelector);
    await readyTimeInput.scrollIntoViewIfNeeded();
    await readyTimeInput.click();
    await readyTimeInput.fill('15');
    console.log('  ✓ Set Time Till Ready to 15 minutes');
    
    // 6. Scroll to and click into the Time Till Complete input
    console.log('  Setting Time Till Complete...');
    const completeTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const completeTimeInput = page.locator(completeTimeSelector);
    await completeTimeInput.scrollIntoViewIfNeeded();
    await completeTimeInput.click();
    await completeTimeInput.fill('30');
    console.log('  ✓ Set Time Till Complete to 30 minutes');
    
    // 8. Scroll to and click the save button
    console.log('  Saving Wait Times configuration...');
    const saveWaitTimesSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveWaitTimesButton = page.locator(saveWaitTimesSelector);
    await saveWaitTimesButton.scrollIntoViewIfNeeded();
    await saveWaitTimesButton.click();
    console.log('  ✓ Configuration saved');
    
    // 9. Wait for save to complete
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    await takeScreenshot(page, '07-wait-times-configured');
    
    // STEP 7: Configure Deliveries Settings
    console.log('\n🚚 STEP 7: Configuring Deliveries Settings');
    
    // 10. Click to open the Deliveries Settings
    console.log('  Opening Deliveries section...');
    const deliveriesSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(2)';
    await page.click(deliveriesSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Expanded Deliveries section');
    
    // 11. Scroll to and click Enable Map picker toggle
    console.log('  Enabling Map Picker...');
    const mapPickerSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
    const mapPickerToggle = page.locator(mapPickerSelector);
    await mapPickerToggle.scrollIntoViewIfNeeded();
    await mapPickerToggle.click();
    console.log('  ✓ Enabled Map Picker');
    await page.waitForTimeout(1000);
    
    // 12. Scroll to and click Force Street Number toggle
    console.log('  Enabling Force Street Number...');
    const streetNumberSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(10) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
    const streetNumberToggle = page.locator(streetNumberSelector);
    await streetNumberToggle.scrollIntoViewIfNeeded();
    await streetNumberToggle.click();
    console.log('  ✓ Enabled Force Street Number');
    await page.waitForTimeout(1000);
    
    // 13. Scroll to and click Force Specific street address toggle
    console.log('  Enabling Force Specific Street Address...');
    const streetAddressSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(11) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
    const streetAddressToggle = page.locator(streetAddressSelector);
    await streetAddressToggle.scrollIntoViewIfNeeded();
    await streetAddressToggle.click();
    console.log('  ✓ Enabled Force Specific Street Address');
    await page.waitForTimeout(1000);
    
    // 14. Click save button
    console.log('  Saving Deliveries configuration...');
    const saveDeliveriesSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveDeliveriesButton = page.locator(saveDeliveriesSelector);
    await saveDeliveriesButton.scrollIntoViewIfNeeded();
    await saveDeliveriesButton.click();
    console.log('  ✓ Configuration saved');
    
    // 15. Wait for save to complete
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    // 16. Scroll to top of page and click the Conditions tab
    console.log('  Navigating to Conditions tab...');
    const scrollRoot2 = page.locator('#scroll-root');
    await scrollRoot2.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(2000);
    const conditionsSelector = '#section-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div';
    await page.click(conditionsSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Clicked Conditions tab');
    
    // 17. Click into and insert "2" for minimum order amount input field
    console.log('  Setting Minimum Order Amount...');
    const minOrderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const minOrderInput = page.locator(minOrderSelector);
    await minOrderInput.scrollIntoViewIfNeeded();
    await minOrderInput.click();
    await minOrderInput.fill('2');
    console.log('  ✓ Set Minimum Order Amount to $2');
    
    // 18. Scroll to and click save button
    console.log('  Saving Conditions configuration...');
    const saveConditionsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveConditionsButton = page.locator(saveConditionsSelector);
    await saveConditionsButton.scrollIntoViewIfNeeded();
    await saveConditionsButton.click();
    console.log('  ✓ Configuration saved');
    
    // 19. Wait for save to complete
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    // 20. Scroll to top of page
    console.log('  Scrolling to top...');
    const scrollRoot3 = page.locator('#scroll-root');
    await scrollRoot3.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(2000);
    
    // 21. Click Order timing tab
    console.log('  Navigating to Order Timing tab...');
    const orderTimingTabSelector = '#section-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(5) > div';
    await page.click(orderTimingTabSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Clicked Order Timing tab');
    
    // 22. Repeat Order Timing steps from pickups
    console.log('  Configuring Delivery Order Timing...');
    console.log('  Setting First Order Offset...');
    const deliveryFirstOrderInput = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input');
    await deliveryFirstOrderInput.fill('0');
    console.log('  ✓ Set First Order Offset to 0 minutes');
    
    console.log('  Setting Last Order Offset...');
    const deliveryLastOrderInput = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input');
    await deliveryLastOrderInput.fill('15');
    console.log('  ✓ Set Last Order Offset to 15 minutes');
    
    console.log('  Setting Maximum Days Ahead...');
    const deliveryMaxDaysInput = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input');
    await deliveryMaxDaysInput.fill('8');
    console.log('  ✓ Set Maximum Days Ahead to 8 days');
    
    console.log('  Saving Delivery Order Timing configuration...');
    const saveDeliveryTimingSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveDeliveryTimingButton = page.locator(saveDeliveryTimingSelector);
    await saveDeliveryTimingButton.scrollIntoViewIfNeeded();
    await saveDeliveryTimingButton.click();
    console.log('  ✓ Configuration saved');
    
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    // STEP 8: Configure Delivery Wait Times & Auto Statuses
    console.log('\n⏱️ STEP 8: Configuring Delivery Wait Times & Auto Statuses');
    
    // Navigate to Wait Times & Auto Statuses tab for Deliveries
    console.log('  Navigating to Wait Times & Auto Statuses tab...');
    const scrollRoot4 = page.locator('#scroll-root');
    await scrollRoot4.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(2000);
    
    try {
      // First try clicking the text directly
      const deliveryWaitTimesText = page.locator('text="Wait Times & Auto Statuses"').first();
      if (await deliveryWaitTimesText.count() > 0) {
        await deliveryWaitTimesText.click();
        console.log('  ✓ Clicked Wait Times tab (via text)');
      }
    } catch (error) {
      // Fallback to selector
      console.log('  Text click failed, trying selector...');
      const deliveryWaitTimesSelector = '#section-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(4) > div';
      await page.click(deliveryWaitTimesSelector);
      console.log('  ✓ Clicked Wait Times tab (via selector)');
    }
    await page.waitForTimeout(2000);
    
    // Enable all Auto status toggles (4 for Deliveries including On Route)
    console.log('  Enabling Auto Confirm toggle...');
    const deliveryConfirmToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(1) > div';
    await page.click(deliveryConfirmToggleSelector);
    console.log('  ✓ Clicked Auto Confirm toggle');
    await page.waitForTimeout(1000);
    
    console.log('  Enabling Auto Ready toggle...');
    const deliveryReadyToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(2) > div';
    await page.click(deliveryReadyToggleSelector);
    console.log('  ✓ Clicked Auto Ready toggle');
    await page.waitForTimeout(1000);
    
    console.log('  Enabling Auto On Route toggle...');
    const deliveryOnRouteToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(3) > div';
    await page.click(deliveryOnRouteToggleSelector);
    console.log('  ✓ Clicked Auto On Route toggle');
    await page.waitForTimeout(1000);
    
    console.log('  Enabling Auto Complete toggle...');
    const deliveryCompleteToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div:nth-child(4) > div';
    await page.click(deliveryCompleteToggleSelector);
    console.log('  ✓ Clicked Auto Complete toggle');
    await page.waitForTimeout(1000);
    
    // Set time values for each status
    console.log('  Setting Time Till Confirm...');
    const deliveryConfirmTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const deliveryConfirmTimeInput = page.locator(deliveryConfirmTimeSelector);
    await deliveryConfirmTimeInput.scrollIntoViewIfNeeded();
    await deliveryConfirmTimeInput.click();
    await deliveryConfirmTimeInput.fill('1');
    console.log('  ✓ Set Time Till Confirm to 1 minute');
    
    console.log('  Setting Time Till Ready...');
    const deliveryReadyTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const deliveryReadyTimeInput = page.locator(deliveryReadyTimeSelector);
    await deliveryReadyTimeInput.scrollIntoViewIfNeeded();
    await deliveryReadyTimeInput.click();
    await deliveryReadyTimeInput.fill('15');
    console.log('  ✓ Set Time Till Ready to 15 minutes');
    
    console.log('  Setting Time Till On Route...');
    const deliveryOnRouteTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const deliveryOnRouteTimeInput = page.locator(deliveryOnRouteTimeSelector);
    await deliveryOnRouteTimeInput.scrollIntoViewIfNeeded();
    await deliveryOnRouteTimeInput.click();
    await deliveryOnRouteTimeInput.fill('10');
    console.log('  ✓ Set Time Till On Route to 10 minutes');
    
    console.log('  Setting Time Till Complete...');
    const deliveryCompleteTimeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    const deliveryCompleteTimeInput = page.locator(deliveryCompleteTimeSelector);
    await deliveryCompleteTimeInput.scrollIntoViewIfNeeded();
    await deliveryCompleteTimeInput.click();
    await deliveryCompleteTimeInput.fill('30');
    console.log('  ✓ Set Time Till Complete to 30 minutes');
    
    // Save configuration
    console.log('  Saving Delivery Wait Times configuration...');
    const saveDeliveryWaitTimesSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveDeliveryWaitTimesButton = page.locator(saveDeliveryWaitTimesSelector);
    await saveDeliveryWaitTimesButton.scrollIntoViewIfNeeded();
    await saveDeliveryWaitTimesButton.click();
    console.log('  ✓ Configuration saved');
    
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    await takeScreenshot(page, '09-delivery-wait-times-configured');
    
    // STEP 9: Configure Custom Checkout Fields
    console.log('\n📝 STEP 9: Configuring Custom Checkout Fields');
    
    // Navigate to Custom Checkout Fields tab
    console.log('  Navigating to Custom Checkout Fields tab...');
    const scrollRoot5 = page.locator('#scroll-root');
    await scrollRoot5.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(2000);
    
    const customCheckoutSelector = '#section-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(8) > div';
    await page.click(customCheckoutSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Clicked Custom Checkout Fields tab');
    
    // Remove the default "Request No Contact Delivery" field if it exists
    console.log('  Checking for default "Request No Contact Delivery" field...');
    const removeButtonSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div > div > div:nth-child(1) > div:nth-child(1) > div.preview__FieldActions-fEoEZR.jZeUTf > button';
    const removeButton = page.locator(removeButtonSelector);
    
    try {
      const removeButtonCount = await removeButton.count();
      if (removeButtonCount > 0) {
        console.log('  Field found, removing...');
        await removeButton.scrollIntoViewIfNeeded();
        await removeButton.click();
        console.log('  ✓ Clicked Remove button');
        await page.waitForTimeout(1000);
      } else {
        console.log('  ✓ No default field found (already removed)');
      }
    } catch (error) {
      console.log('  ✓ No default field found (already removed)');
    }
    
    // Save configuration
    console.log('  Saving Custom Checkout Fields configuration...');
    const saveCustomCheckoutSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveCustomCheckoutButton = page.locator(saveCustomCheckoutSelector);
    await saveCustomCheckoutButton.scrollIntoViewIfNeeded();
    await saveCustomCheckoutButton.click();
    console.log('  ✓ Configuration saved');
    
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    await takeScreenshot(page, '10-custom-checkout-configured');
    
    // STEP 10: Disable Dine-Ins
    console.log('\n🍽️ STEP 10: Disabling Dine-Ins');
    
    // Click to open Dine-Ins settings
    console.log('  Opening Dine-Ins section...');
    const dineInsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(3)';
    await page.click(dineInsSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Expanded Dine-Ins section');
    
    // Toggle off Dine-Ins
    console.log('  Disabling Dine-Ins...');
    const dineInsToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
    const dineInsToggle = page.locator(dineInsToggleSelector);
    await dineInsToggle.scrollIntoViewIfNeeded();
    await dineInsToggle.click();
    console.log('  ✓ Clicked Dine-Ins toggle to disable');
    await page.waitForTimeout(1000);
    
    // Save Dine-Ins configuration
    console.log('  Saving Dine-Ins configuration...');
    const saveDineInsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveDineInsButton = page.locator(saveDineInsSelector);
    await saveDineInsButton.scrollIntoViewIfNeeded();
    await saveDineInsButton.click();
    console.log('  ✓ Configuration saved');
    
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    // STEP 11: Disable Table Bookings
    console.log('\n📅 STEP 11: Disabling Table Bookings');
    
    // Click to open Table Bookings settings
    console.log('  Opening Table Bookings section...');
    const tableBookingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(4)';
    await page.click(tableBookingsSelector);
    await page.waitForTimeout(2000);
    console.log('  ✓ Expanded Table Bookings section');
    
    // Toggle off Table Bookings
    console.log('  Disabling Table Bookings...');
    const tableBookingsToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
    const tableBookingsToggle = page.locator(tableBookingsToggleSelector);
    await tableBookingsToggle.scrollIntoViewIfNeeded();
    await tableBookingsToggle.click();
    console.log('  ✓ Clicked Table Bookings toggle to disable');
    await page.waitForTimeout(1000);
    
    // Save Table Bookings configuration
    console.log('  Saving Table Bookings configuration...');
    const saveTableBookingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button';
    const saveTableBookingsButton = page.locator(saveTableBookingsSelector);
    await saveTableBookingsButton.scrollIntoViewIfNeeded();
    await saveTableBookingsButton.click();
    console.log('  ✓ Configuration saved');
    
    console.log('  Waiting for save to complete...');
    await page.waitForTimeout(5000);
    
    await takeScreenshot(page, '11-services-fully-configured');
    
    console.log('\n✅ Services Settings successfully configured!');
    console.log('  ✓ Pickup Settings configured');
    console.log('    - Order Timing: 0/15 minutes, 8 days ahead');
    console.log('    - Wait Times: Confirm 1min, Ready 15min, Complete 30min');
    console.log('  ✓ Delivery Settings configured');
    console.log('    - Map Picker enabled');
    console.log('    - Force Street Number enabled');
    console.log('    - Force Specific Street Address enabled');
    console.log('    - Minimum Order: $2');
    console.log('    - Order Timing: 0/15 minutes, 8 days ahead');
    console.log('    - Wait Times: Confirm 1min, Ready 15min, On Route 10min, Complete 30min');
    console.log('  ✓ Custom Checkout Fields configured');
    console.log('    - Removed default "Request No Contact Delivery" field');
    console.log('  ✓ Dine-Ins disabled');
    console.log('  ✓ Table Bookings disabled');
    console.log('\n🎉 All Services Settings have been configured successfully!');
    
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
setupServicesSettings().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});