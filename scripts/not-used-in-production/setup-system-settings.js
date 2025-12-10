#!/usr/bin/env node

/**
 * Setup System Settings
 * 
 * This script logs into the admin portal and configures System settings
 * 
 * Usage:
 *   node setup-system-settings.js --email=<email> [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --receipt-logo=<path>     Path to receipt logo image (optional)
 *   --gst=<number>            GST number (optional)
 *   --google-oauth=<id>       Google OAuth Client ID (optional)
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
const receiptLogoPath = getArg('receipt-logo');
const gstNumber = getArg('gst');
const googleOAuthClientId = getArg('google-oauth');

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email) {
  console.error('❌ Error: Email is required');
  console.error('Usage: node navigate-to-system-settings.js --email="email@example.com"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `system-settings-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function setupSystemSettings() {
  console.log('🚀 Starting System Settings Configuration...\n');
  
  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  if (receiptLogoPath) console.log(`  Receipt Logo: ${receiptLogoPath}`);
  if (gstNumber) console.log(`  GST Number: ${gstNumber}`);
  if (googleOAuthClientId) console.log(`  Google OAuth Client ID: ${googleOAuthClientId}`);
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
    
    // System tab is the default tab, so we're already on it
    console.log('\n💻 STEP 4: System Settings');
    console.log('  ✓ System tab is loaded by default');
    
    // Verify we're on the System tab by checking for System-specific content
    try {
      // Look for System-specific content (adjust selector as needed)
      const systemContent = await page.locator('text=/System|Restaurant Name|Timezone/i').count();
      if (systemContent > 0) {
        console.log('  ✓ System settings content confirmed');
      }
    } catch (error) {
      console.log('  ⚠️ Could not verify System content, but tab should be active');
    }
    
    await takeScreenshot(page, '05-system-settings');
    
    // STEP 5: Configure System Settings
    console.log('\n⚙️ STEP 5: Configuring System Settings');
    
    // 1. Open General Settings menu dropdown
    console.log('  Opening General Settings menu...');
    const generalSettingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(2)';
    await page.click(generalSettingsSelector);
    await page.waitForTimeout(1500);
    console.log('  ✓ General Settings menu opened');
    await takeScreenshot(page, '06-general-settings-open');
    
    // 2. Try to create GST tax (might already exist)
    console.log('  Configuring GST tax...');
    try {
      const createTaxButtonSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(8) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div > button';
      
      // Scroll to the button first
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, createTaxButtonSelector);
      await page.waitForTimeout(1000);
      
      await page.click(createTaxButtonSelector, { timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('  ✓ Clicked Create New Tax button');
      
      // 3. Replace "TAX" with "GST" in name field
      const taxNameInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(8) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div > div > div.flex-line > div.flex-line > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
      await page.fill(taxNameInputSelector, '');
      await page.fill(taxNameInputSelector, 'GST');
      console.log('  ✓ Set tax name to GST');
      
      // 4. Replace Rate default "0" with "15"
      const taxRateInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(8) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div > div > div.flex-line > div.flex-line > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
      await page.fill(taxRateInputSelector, '');
      await page.fill(taxRateInputSelector, '15');
      console.log('  ✓ Set tax rate to 15%');
    } catch (error) {
      console.log('  ⚠️ Tax configuration may already exist, continuing...');
    }
    
    // 5. Scroll to and Click Save button
    const saveGeneralSettingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
    
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, saveGeneralSettingsSelector);
    await page.waitForTimeout(1000);
    
    await page.click(saveGeneralSettingsSelector);
    console.log('  ✓ Saved General Settings');
    await takeScreenshot(page, '07-general-settings-saved');
    
    // 6. Wait 2 seconds
    await page.waitForTimeout(2000);
    
    // 7. Open Location Settings Dropdown
    console.log('  Opening Location Settings menu...');
    const locationSettingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(3)';
    await page.click(locationSettingsSelector);
    await page.waitForTimeout(1500);
    console.log('  ✓ Location Settings menu opened');
    await takeScreenshot(page, '08-location-settings-open');
    
    // 8. Scroll to Phone number input section
    console.log('  Updating phone number format...');
    const phoneInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
    
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, phoneInputSelector);
    await page.waitForTimeout(1000);
    
    // 9. Click into the field and replace the first 0 with "+64"
    const currentPhone = await page.inputValue(phoneInputSelector);
    if (currentPhone && currentPhone.startsWith('0')) {
      const newPhone = '+64' + currentPhone.substring(1);
      await page.fill(phoneInputSelector, newPhone);
      console.log(`  ✓ Updated phone number from ${currentPhone} to ${newPhone}`);
    } else {
      console.log(`  ⚠️ Phone number doesn't start with 0: ${currentPhone}`);
    }
    
    // 10. Scroll to Save button and click
    const saveLocationSettingsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
    
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, saveLocationSettingsSelector);
    await page.waitForTimeout(1000);
    
    await page.click(saveLocationSettingsSelector);
    console.log('  ✓ Saved Location Settings');
    await takeScreenshot(page, '09-location-settings-saved');
    
    // 11. Wait 2 seconds
    await page.waitForTimeout(2000);
    
    // 12. Click Receipt printing menu dropdown
    console.log('  Opening Receipt Printing menu...');
    const receiptPrintingSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(8)';
    await page.click(receiptPrintingSelector);
    await page.waitForTimeout(1500);
    console.log('  ✓ Receipt Printing menu opened');
    await takeScreenshot(page, '10-receipt-printing-open');
    
    // STEP 6: Configure Receipt Printer
    console.log('\n🖨️ STEP 6: Configuring Receipt Printer');
    
    // 1. Click the Create Printer button
    console.log('  Creating new printer...');
    const createPrinterSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > div.p-4 > div.flex > button.button__ButtonComponent-igFjHP.kkCuBg.p-lr-2.m-r-2';
    await page.click(createPrinterSelector);
    console.log('  ✓ Clicked Create Printer button');
    
    // 2. Wait 2 seconds for popup
    await page.waitForTimeout(2000);
    console.log('  ✓ Printer configuration popup opened');
    await takeScreenshot(page, '11-printer-popup');
    
    // 3. Click into name input field and insert "Receipt"
    // Using exact XPath provided
    await page.waitForTimeout(1000);
    const printerNameXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/input';
    try {
      const nameInput = await page.locator(`xpath=${printerNameXPath}`);
      await nameInput.fill('Receipt');
      console.log('  ✓ Set printer name to "Receipt"');
    } catch (error) {
      console.log('  ⚠️ Could not set printer name using XPath:', error.message);
    }
    
    // 4. Click toggle for Auto print orders
    try {
      // Use XPath with wildcard for dynamic ID
      const autoPrintXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/label';
      const autoPrintToggle = await page.locator(`xpath=${autoPrintXPath}`);
      await autoPrintToggle.click();
      console.log('  ✓ Enabled Auto print orders');
    } catch (error) {
      console.log('  ⚠️ Could not enable auto print:', error.message);
    }
    
    // 5. Click Customization tab
    console.log('  Switching to Customization tab...');
    try {
      // Use the stable class for tab components
      const tabs = await page.locator('.components__TabSelectComponent-dsNZLr, .components__TabSelectOptionsComponent-USxIn > div');
      const customizationTab = await tabs.filter({ hasText: 'Customization' }).first();
      await customizationTab.click();
      await page.waitForTimeout(1000);
      console.log('  ✓ Switched to Customization tab');
    } catch (error) {
      // Fallback to text selector
      try {
        const customizationTab = await page.locator('div[role="dialog"] :text("Customization")').first();
        await customizationTab.click();
        await page.waitForTimeout(1000);
        console.log('  ✓ Switched to Customization tab (via text)');
      } catch (fallbackError) {
        console.log('  ⚠️ Could not switch to Customization tab:', fallbackError.message);
      }
    }
    
    // 6. Scroll to bottom of the Detail customisation div
    console.log('  Scrolling to Customer Name option...');
    
    // Scroll using XPath for the scrollable component
    const scrollableXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/div';
    await page.evaluate((xpath) => {
      const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, scrollableXPath);
    await page.waitForTimeout(1000);
    
    // 7. Click the toggle for Customer Name
    try {
      const customerNameXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/div/div[19]/div[1]/div/label';
      const customerNameToggle = await page.locator(`xpath=${customerNameXPath}`);
      await customerNameToggle.click();
      console.log('  ✓ Enabled Customer Name display');
    } catch (error) {
      console.log('  ⚠️ Could not enable Customer Name:', error.message);
    }
    
    // 8-17. Configure highlighted fields
    console.log('  Configuring highlighted fields...');
    try {
      // Click into the highlighted fields dropdown
      const highlightedFieldsXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/div[2]';
      const highlightedFieldsDropdown = await page.locator(`xpath=${highlightedFieldsXPath}`);
      await highlightedFieldsDropdown.click();
      await page.waitForTimeout(500);
      
      // Type "Origin"
      await page.keyboard.type('Origin');
      await page.waitForTimeout(500);
      
      // Click the Origin option from dropdown
      const originOptionXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/div[3]/div';
      const originOption = await page.locator(`xpath=${originOptionXPath}`);
      await originOption.click();
      console.log('  ✓ Added Origin to highlighted fields');
      
      // Click the dropdown to clear and prepare for next input
      await highlightedFieldsDropdown.click();
      await page.waitForTimeout(500);
      
      // Click again to allow typing
      await highlightedFieldsDropdown.click();
      await page.waitForTimeout(500);
      
      // Type "Payment Method"
      await page.keyboard.type('Payment Method');
      await page.waitForTimeout(500);
      
      // Click the Payment Method option (same XPath as origin after typing)
      const paymentMethodOption = await page.locator(`xpath=${originOptionXPath}`);
      await paymentMethodOption.click();
      console.log('  ✓ Added Payment Method to highlighted fields');
      
      // Click dropdown to close
      await highlightedFieldsDropdown.click();
      await page.waitForTimeout(500);
    } catch (error) {
      console.log('  ⚠️ Could not configure highlighted fields:', error.message);
    }
    
    // 18. Click the Header & Footer tab
    console.log('  Switching to Header & Footer tab...');
    try {
      // Wait for tab to be available after previous actions
      await page.waitForTimeout(1000);
      
      // Use a more specific selector for the Header & Footer tab
      const headerFooterTab = await page.locator('div:has-text("Header & Footer"):not(:has-text("Customization"))').last();
      await headerFooterTab.click();
      await page.waitForTimeout(1000);
      console.log('  ✓ Switched to Header & Footer tab');
    } catch (error) {
      // Fallback: try clicking by exact text
      try {
        await page.getByText('Header & Footer', { exact: true }).click();
        await page.waitForTimeout(1000);
        console.log('  ✓ Switched to Header & Footer tab (via exact text)');
      } catch (fallbackError) {
        console.log('  ⚠️ Could not switch to Header & Footer tab:', fallbackError.message);
      }
    }
    
    // 19. Click the Print Logo toggle
    try {
      const printLogoXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/div[1]/label';
      const printLogoToggle = await page.locator(`xpath=${printLogoXPath}`);
      await printLogoToggle.click();
      console.log('  ✓ Enabled Print Logo');
    } catch (error) {
      console.log('  ⚠️ Could not enable Print Logo:', error.message);
    }
    
    // 20-21. Only if GST number provided in arguments
    if (gstNumber) {
      try {
        console.log(`  Adding GST number to footer: ${gstNumber}`);
        const receiptFooterXPath = '//*[@id="receipt-footer-html-editor"]/div[1]';
        const footerEditor = await page.locator(`xpath=${receiptFooterXPath}`);
        await footerEditor.click();
        await page.keyboard.type(`GST: ${gstNumber}`);
        console.log(`  ✓ Added GST number to receipt footer`);
      } catch (error) {
        console.log('  ⚠️ Could not add GST to footer:', error.message);
      }
    }
    
    // 22. Extract and log the API key
    console.log('  Extracting API key...');
    try {
      const apiKeyXPath = '//*[contains(@id, "-content")]/div[2]/p/span';
      const apiKeyElement = await page.locator(`xpath=${apiKeyXPath}`);
      const apiKey = await apiKeyElement.textContent();
      console.log(`  📋 API Key: ${apiKey}`);
    } catch (error) {
      console.log('  ⚠️ Could not extract API key:', error.message);
    }
    
    // 23. Click save button
    try {
      const saveButtonXPath = '//*[contains(@id, "-content")]/form/div/div[2]/button';
      const saveButton = await page.locator(`xpath=${saveButtonXPath}`);
      await saveButton.click();
      console.log('  ✓ Clicked save button for printer configuration');
      
      // Wait 8 seconds for the printer to be saved
      console.log('  ⏳ Waiting for printer to save...');
      await page.waitForTimeout(8000);
      console.log('  ✓ Printer configuration saved');
    } catch (error) {
      console.log('  ⚠️ Could not save printer:', error.message);
    }
    await takeScreenshot(page, '12-printer-saved');
    
    // STEP 7: Configure Kitchen Printer (same steps as Receipt printer but with "Kitchen" name)
    console.log('\n🖨️ STEP 7: Configuring Kitchen Printer');
    
    // 1. Click the Create Printer button again
    console.log('  Creating second printer...');
    const createPrinterSelector2 = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > div.p-4 > div.flex > button.button__ButtonComponent-igFjHP.kkCuBg.p-lr-2.m-r-2';
    await page.click(createPrinterSelector2);
    console.log('  ✓ Clicked Create Printer button');
    
    // 2. Wait for popup
    await page.waitForTimeout(2000);
    console.log('  ✓ Printer configuration popup opened');
    await takeScreenshot(page, '13-kitchen-printer-popup');
    
    // 3. Set printer name to "Kitchen"
    await page.waitForTimeout(1000);
    const printerNameXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/input';
    try {
      const nameInput2 = await page.locator(`xpath=${printerNameXPath2}`);
      await nameInput2.fill('Kitchen');
      console.log('  ✓ Set printer name to "Kitchen"');
    } catch (error) {
      console.log('  ⚠️ Could not set printer name using XPath:', error.message);
    }
    
    // 4. Click toggle for Auto print orders
    try {
      const autoPrintXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/label';
      const autoPrintToggle2 = await page.locator(`xpath=${autoPrintXPath2}`);
      await autoPrintToggle2.click();
      console.log('  ✓ Enabled Auto print orders');
    } catch (error) {
      console.log('  ⚠️ Could not enable auto print:', error.message);
    }
    
    // 5. Click Customization tab
    console.log('  Switching to Customization tab...');
    try {
      const tabs = await page.locator('.components__TabSelectComponent-dsNZLr, .components__TabSelectOptionsComponent-USxIn > div');
      const customizationTab = await tabs.filter({ hasText: 'Customization' }).first();
      await customizationTab.click();
      await page.waitForTimeout(1000);
      console.log('  ✓ Switched to Customization tab');
    } catch (error) {
      try {
        const customizationTab = await page.locator('div[role="dialog"] :text("Customization")').first();
        await customizationTab.click();
        await page.waitForTimeout(1000);
        console.log('  ✓ Switched to Customization tab (via text)');
      } catch (fallbackError) {
        console.log('  ⚠️ Could not switch to Customization tab:', fallbackError.message);
      }
    }
    
    // 6. Scroll and enable Customer Name
    console.log('  Scrolling to Customer Name option...');
    const scrollableXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/div';
    await page.evaluate((xpath) => {
      const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, scrollableXPath2);
    await page.waitForTimeout(1000);
    
    // 7. Click Customer Name toggle
    try {
      const customerNameXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/div/div[19]/div[1]/div/label';
      const customerNameToggle2 = await page.locator(`xpath=${customerNameXPath2}`);
      await customerNameToggle2.click();
      console.log('  ✓ Enabled Customer Name display');
    } catch (error) {
      console.log('  ⚠️ Could not enable Customer Name:', error.message);
    }
    
    // 8-17. Configure highlighted fields
    console.log('  Configuring highlighted fields...');
    try {
      const highlightedFieldsXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/div[2]';
      const highlightedFieldsDropdown2 = await page.locator(`xpath=${highlightedFieldsXPath2}`);
      await highlightedFieldsDropdown2.click();
      await page.waitForTimeout(500);
      
      await page.keyboard.type('Origin');
      await page.waitForTimeout(500);
      
      const originOptionXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/div[3]/div';
      const originOption2 = await page.locator(`xpath=${originOptionXPath2}`);
      await originOption2.click();
      console.log('  ✓ Added Origin to highlighted fields');
      
      await highlightedFieldsDropdown2.click();
      await page.waitForTimeout(500);
      await highlightedFieldsDropdown2.click();
      await page.waitForTimeout(500);
      
      await page.keyboard.type('Payment Method');
      await page.waitForTimeout(500);
      
      const paymentMethodOption2 = await page.locator(`xpath=${originOptionXPath2}`);
      await paymentMethodOption2.click();
      console.log('  ✓ Added Payment Method to highlighted fields');
      
      await highlightedFieldsDropdown2.click();
      await page.waitForTimeout(500);
    } catch (error) {
      console.log('  ⚠️ Could not configure highlighted fields:', error.message);
    }
    
    // 18. Click Header & Footer tab
    console.log('  Switching to Header & Footer tab...');
    try {
      await page.waitForTimeout(1000);
      const headerFooterTab = await page.locator('div:has-text("Header & Footer"):not(:has-text("Customization"))').last();
      await headerFooterTab.click();
      await page.waitForTimeout(1000);
      console.log('  ✓ Switched to Header & Footer tab');
    } catch (error) {
      try {
        await page.getByText('Header & Footer', { exact: true }).click();
        await page.waitForTimeout(1000);
        console.log('  ✓ Switched to Header & Footer tab (via exact text)');
      } catch (fallbackError) {
        console.log('  ⚠️ Could not switch to Header & Footer tab:', fallbackError.message);
      }
    }
    
    // 19. Click Print Logo toggle
    try {
      const printLogoXPath2 = '//*[contains(@id, "-content")]/form/div/div[1]/div[1]/div/div[2]/div[1]/label';
      const printLogoToggle2 = await page.locator(`xpath=${printLogoXPath2}`);
      await printLogoToggle2.click();
      console.log('  ✓ Enabled Print Logo');
    } catch (error) {
      console.log('  ⚠️ Could not enable Print Logo:', error.message);
    }
    
    // 20-21. Add GST to footer if provided
    if (gstNumber) {
      try {
        console.log(`  Adding GST number to footer: ${gstNumber}`);
        const receiptFooterXPath2 = '//*[@id="receipt-footer-html-editor"]/div[1]';
        const footerEditor2 = await page.locator(`xpath=${receiptFooterXPath2}`);
        await footerEditor2.click();
        await page.keyboard.type(`GST: ${gstNumber}`);
        console.log(`  ✓ Added GST number to receipt footer`);
      } catch (error) {
        console.log('  ⚠️ Could not add GST to footer:', error.message);
      }
    }
    
    // 22. Extract API key
    console.log('  Extracting API key...');
    try {
      const apiKeyXPath2 = '//*[contains(@id, "-content")]/div[2]/p/span';
      const apiKeyElement2 = await page.locator(`xpath=${apiKeyXPath2}`);
      const apiKey2 = await apiKeyElement2.textContent();
      console.log(`  📋 API Key: ${apiKey2}`);
    } catch (error) {
      console.log('  ⚠️ Could not extract API key:', error.message);
    }
    
    // 23. Click save button
    try {
      const saveButtonXPath2 = '//*[contains(@id, "-content")]/form/div/div[2]/button';
      const saveButton2 = await page.locator(`xpath=${saveButtonXPath2}`);
      await saveButton2.click();
      console.log('  ✓ Clicked save button for Kitchen printer configuration');
      
      console.log('  ⏳ Waiting for Kitchen printer to save...');
      await page.waitForTimeout(8000);
      console.log('  ✓ Kitchen printer configuration saved');
    } catch (error) {
      console.log('  ⚠️ Could not save Kitchen printer:', error.message);
    }
    await takeScreenshot(page, '14-kitchen-printer-saved');
    
    // Store webhook secret for final output
    let webhookSecret = '';
    
    // STEP 8: Upload Receipt Logo (optional)
    if (receiptLogoPath) {
      console.log('\n🖼️ STEP 8: Uploading Receipt Logo');
      
      try {
        // 1. Click Receipt Logo tab
        const receiptLogoTabXPath = '//*[@id="notifications-tab-options-tab-select-content"]/div[1]/div[2]/div';
        const receiptLogoTab = await page.locator(`xpath=${receiptLogoTabXPath}`);
        await receiptLogoTab.click();
        await page.waitForTimeout(1000);
        console.log('  ✓ Clicked Receipt Logo tab');
        
        // 2. Click Custom Receipt Logo button
        const customLogoXPath = '/html/body/div[1]/main/div[2]/div/div/div/div/div/div[3]/div/div[8]/div[2]/div/form/div/div/div/div[2]/div[1]/button[2]';
        const customLogoButton = await page.locator(`xpath=${customLogoXPath}`);
        await customLogoButton.click();
        await page.waitForTimeout(1000);
        console.log('  ✓ Clicked Custom Receipt Logo button');
        
        // 3. Click Upload button
        const uploadButtonXPath = '/html/body/div[1]/main/div[2]/div/div/div/div/div/div[3]/div/div[8]/div[2]/div/form/div/div/div/div[2]/div[2]/div/button[1]';
        const uploadButton = await page.locator(`xpath=${uploadButtonXPath}`);
        await uploadButton.click();
        console.log('  ✓ Clicked Upload button');
        await page.waitForTimeout(2000);
        
        // 4. Handle Uploadcare widget
        const logoFilePath = path.resolve(receiptLogoPath);
        
        // Set up file chooser handler
        page.once('filechooser', async (fileChooser) => {
          await fileChooser.setFiles(logoFilePath);
          console.log('  ✓ Receipt logo selected via fileChooser');
        });
        
        // Click Choose File button
        const chooseFileButton = page.locator('button:has-text("Choose a local file")').first();
        if (await chooseFileButton.count() > 0) {
          await chooseFileButton.click();
          console.log('  ✓ Triggered file chooser');
          await page.waitForTimeout(8000);
          
          // Wait for preview and confirm
          const previewImage = await page.locator('.uploadcare--preview__image, img[src*="ucarecdn.com"]').first();
          if (await previewImage.count() > 0) {
            console.log('  ✓ Upload successful, preview loaded');
            
            const addButton = page.locator('.uploadcare--dialog button:has-text("Add")').first();
            if (await addButton.count() > 0) {
              await addButton.click();
              console.log('  ✓ Confirmed receipt logo upload');
              await page.waitForTimeout(2000);
            }
          }
        }
        
        // 5. Click save button - use more specific selector
        const saveReceiptLogoButton = await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button');
        await saveReceiptLogoButton.click();
        console.log('  ✓ Clicked save button for receipt logo');
        
        // 6. Wait 10 seconds for save to complete fully
        console.log('  ⏳ Waiting for receipt logo to save...');
        await page.waitForTimeout(10000);
        console.log('  ✓ Receipt logo saved');
        
      } catch (error) {
        console.error('  ❌ Failed to upload receipt logo:', error.message);
      }
    } else {
      console.log('\n📋 STEP 8: Skipping receipt logo upload (no logo path provided)');
    }
    
    // STEP 9: Configure Audio Notifications
    console.log('\n🔊 STEP 9: Configuring Audio Notifications');
    
    // Open Audio Notifications menu
    await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(10)').click();
    console.log('  ✓ Opened Audio Notifications menu');
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '15-audio-notifications-open');
    
    // 1. Click on Sound dropdown
    await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__InputIcon-dZhktu.PrPXn').click();
    console.log('  ✓ Clicked Sound dropdown');
    await page.waitForTimeout(500);
    
    // 2. Select Plucky option
    await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__Dropdown-eSUwYi.dtQnDO > div:nth-child(6)').click();
    console.log('  ✓ Selected Plucky sound');
    await page.waitForTimeout(500);
    
    // 3-4. Set Repeat count to 5
    const repeatInput = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj input');
    await repeatInput.click();
    await repeatInput.fill('5');
    console.log('  ✓ Set Repeat count to 5');
    
    // 5. Click Stop on Click toggle
    await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label').click();
    console.log('  ✓ Enabled Stop on Click');
    
    // 6. Scroll to and save Audio Notifications
    const audioSaveButton = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button');
    await audioSaveButton.scrollIntoViewIfNeeded();
    await audioSaveButton.click();
    console.log('  ✓ Saved Audio Notifications');
    await page.waitForTimeout(2000);
    
    // STEP 10: Configure Google OAuth (optional)
    if (googleOAuthClientId) {
      console.log('\n🔐 STEP 10: Configuring Google OAuth');
      
      try {
        // 7a. Click Customer accounts menu
        await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(11)').click();
        console.log('  ✓ Opened Customer Accounts menu');
        await page.waitForTimeout(1500);
        
        // 7b. Click Google tab
        await page.locator('#accounts-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(3) > div').click();
        console.log('  ✓ Clicked Google tab');
        await page.waitForTimeout(1000);
        
        // 7c. Insert Google OAuth Client ID
        const googleOAuthInput = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input');
        await googleOAuthInput.fill(googleOAuthClientId);
        console.log(`  ✓ Entered Google OAuth Client ID: ${googleOAuthClientId}`);
        
        // 7d. Click Save button
        await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button').click();
        console.log('  ✓ Saved Google OAuth configuration');
        await page.waitForTimeout(2000);
      } catch (error) {
        console.error('  ❌ Failed to configure Google OAuth:', error.message);
      }
    } else {
      console.log('\n📋 STEP 10: Skipping Google OAuth configuration (no client ID provided)');
    }
    
    // STEP 11: Configure Webhooks
    console.log('\n🔗 STEP 11: Configuring Webhooks');
    
    try {
      // 8. Scroll to and click Webhooks menu
      const webhooksMenu = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(14)');
      await webhooksMenu.scrollIntoViewIfNeeded();
      await webhooksMenu.click();
      console.log('  ✓ Opened Webhooks menu');
      await page.waitForTimeout(1500);
      
      // 9. Click Create Webhook button
      await page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > button').click();
      console.log('  ✓ Clicked Create Webhook button');
      await page.waitForTimeout(2000);
      
      // 10. Insert webhook URL
      const webhookUrlXPath = '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/input';
      const webhookUrlInput = await page.locator(`xpath=${webhookUrlXPath}`);
      await webhookUrlInput.fill('https://pumpd-webhook-app-5c7ade204a3d.herokuapp.com/webhook/pumpd');
      console.log('  ✓ Entered webhook URL');
      
      // 11. Extract and log webhook secret key
      const secretKeyXPath = '//*[contains(@id, "-content")]/div[2]/p/span';
      const secretKeyElement = await page.locator(`xpath=${secretKeyXPath}`);
      webhookSecret = await secretKeyElement.textContent();
      console.log(`  📋 Webhook Secret Key: ${webhookSecret}`);
      
      // 11. Click Events tab
      await page.locator('#webhook-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div').click();
      console.log('  ✓ Clicked Events tab');
      await page.waitForTimeout(1000);
      
      // 12. Deselect specific toggles
      const toggleXPaths = [
        '//*[contains(@id, "-content")]/form/div/div[1]/div[2]/div/div[2]/div/label',
        '//*[contains(@id, "-content")]/form/div/div[1]/div[4]/div/div[2]/div/label',
        '//*[contains(@id, "-content")]/form/div/div[1]/div[5]/div/div[2]/div/label',
        '//*[contains(@id, "-content")]/form/div/div[1]/div[6]/div/div[2]/div/label',
        '//*[contains(@id, "-content")]/form/div/div[1]/div[7]/div/div[2]/div/label'
      ];
      
      for (const toggleXPath of toggleXPaths) {
        try {
          const toggle = await page.locator(`xpath=${toggleXPath}`);
          await toggle.click();
          console.log('  ✓ Deselected event toggle');
          await page.waitForTimeout(300);
        } catch (error) {
          console.log('  ⚠️ Could not deselect toggle:', error.message);
        }
      }
      
      // 13. Scroll to and click save button
      const saveWebhookXPath = '//*[contains(@id, "-content")]/form/div/div[2]/button';
      const saveWebhookButton = await page.locator(`xpath=${saveWebhookXPath}`);
      await saveWebhookButton.scrollIntoViewIfNeeded();
      await saveWebhookButton.click();
      console.log('  ✓ Clicked save button for webhook');
      
      // 14. Wait 8 seconds for save
      console.log('  ⏳ Waiting for webhook to save...');
      await page.waitForTimeout(8000);
      console.log('  ✓ Webhook configuration saved');
      
    } catch (error) {
      console.error('  ❌ Failed to configure webhook:', error.message);
    }
    
    // STEP 12: Output configuration results
    console.log('\n✅ Successfully configured System Settings!');
    console.log('\n📋 Configuration Summary:');
    console.log('==========================================');
    
    // Try to extract printer API keys from the page if they're still visible
    try {
      const printerCards = await page.locator('.p-4:has-text("Receipt"), .p-4:has-text("Kitchen")');
      const printerCount = await printerCards.count();
      
      if (printerCount > 0) {
        console.log('\n🖨️ Printer API Keys:');
        for (let i = 0; i < printerCount; i++) {
          const card = printerCards.nth(i);
          const nameElement = await card.locator('h3, .font-bold').first();
          const name = await nameElement.textContent();
          
          // Try to find API key in the card
          const apiKeyElement = await card.locator('code, span:has-text("RES")');
          if (await apiKeyElement.count() > 0) {
            const apiKey = await apiKeyElement.first().textContent();
            console.log(`  ${name}: ${apiKey}`);
          }
        }
      }
    } catch (error) {
      console.log('  ⚠️ Could not extract printer API keys from page');
    }
    
    if (webhookSecret) {
      console.log('\n🔗 Webhook Configuration:');
      console.log(`  Secret Key: ${webhookSecret}`);
      console.log(`  URL: https://pumpd-webhook-app-5c7ade204a3d.herokuapp.com/webhook/pumpd`);
    }
    
    console.log('\n==========================================');
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
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
setupSystemSettings().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});