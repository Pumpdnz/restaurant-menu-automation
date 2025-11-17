#!/usr/bin/env node

/**
 * Finalise Onboarding Script
 * 
 * This script completes the onboarding process by configuring Uber Delivery Management integration
 * and setting the default delivery provider to Uber
 * 
 * Usage:
 *   node finalise-onboarding.js --email=<email> --nzbn=<nzbn> --company-name=<name> --trading-name=<name> --director-name=<name> --director-mobile=<mobile> [options]
 * 
 * Options:
 *   --email=<email>               Login email (required)
 *   --nzbn=<nzbn>                 NZBN number (required)
 *   --company-name=<name>         Legal company name (required)
 *   --trading-name=<name>         Trading name (required)
 *   --director-name=<name>        Director's full name (required)
 *   --director-mobile=<mobile>    Director's mobile number (required)
 *   --debug                       Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   ADMIN_PASSWORD               Admin password for login
 *   DEBUG_MODE                   Enable debug mode (true/false)
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
const nzbn = getArg('nzbn');
const companyName = getArg('company-name');
const tradingName = getArg('trading-name');
const directorName = getArg('director-name');
const directorMobile = getArg('director-mobile');

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
const requiredArgs = {
  email,
  nzbn,
  'company-name': companyName,
  'trading-name': tradingName,
  'director-name': directorName,
  'director-mobile': directorMobile
};

const missingArgs = Object.entries(requiredArgs)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingArgs.length > 0) {
  console.error('❌ Error: Missing required arguments:', missingArgs.join(', '));
  console.error('Usage: node finalise-onboarding.js --email="email@example.com" --nzbn="123456789" --company-name="Company Ltd" --trading-name="Trading Name" --director-name="John Doe" --director-mobile="0211234567"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `finalise-onboarding-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function finaliseOnboarding() {
  console.log('🚀 Starting Onboarding Finalisation...\n');
  
  console.log('Configuration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  NZBN: ${nzbn}`);
  console.log(`  Company Name: ${companyName}`);
  console.log(`  Trading Name: ${tradingName}`);
  console.log(`  Director Name: ${directorName}`);
  console.log(`  Director Mobile: ${directorMobile}`);
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
    
    // STEP 4: Navigate to Integrations tab
    console.log('\n🔌 STEP 4: Navigate to Integrations tab');
    
    try {
      // Try to find and click Integrations text directly
      const integrationsText = page.locator('text="Integrations"').first();
      if (await integrationsText.count() > 0) {
        await integrationsText.click();
        console.log('  ✓ Clicked on Integrations text');
        await page.waitForTimeout(2000);
      } else {
        // Fallback: Try button with Integrations text
        console.log('  Integrations text not found, trying button selector...');
        const integrationsButton = page.locator('button:has-text("Integrations")').first();
        if (await integrationsButton.count() > 0) {
          await integrationsButton.click();
          console.log('  ✓ Clicked Integrations button');
          await page.waitForTimeout(2000);
        } else {
          throw new Error('Could not find Integrations tab');
        }
      }
    } catch (error) {
      console.error('  ❌ Failed to navigate to Integrations:', error.message);
      throw error;
    }
    
    console.log('  ✓ Integrations settings loaded');
    await takeScreenshot(page, '05-integrations-settings');
    
    // STEP 5: Configure Uber Delivery Management
    console.log('\n🚚 STEP 5: Configuring Uber Delivery Management');
    
    // Scroll to and click the Uber Delivery Management card
    const uberCard = page.locator('#scroll-root > div > div > div > div > div > div.m-t-4.grid-2.md.sm-gap > div:nth-child(11)');
    await uberCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await uberCard.click();
    console.log('  ✓ Clicked Uber Delivery Management card');
    
    // Wait for popup to appear
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '06-uber-popup');
    
    // 1. Click enabled toggle
    const enabledToggleXPath = '//*[contains(@id, "-content")]/div[3]/form/div[1]/div[1]/div[2]/label';
    const enabledToggle = page.locator(`xpath=${enabledToggleXPath}`);
    await enabledToggle.click();
    console.log('  ✓ Enabled Uber integration');
    
    // 2. Insert NZBN
    const nzbnXPath = '//*[contains(@id, "-content")]/div[3]/form/div[3]/div/div/input';
    const nzbnInput = page.locator(`xpath=${nzbnXPath}`);
    await nzbnInput.fill(nzbn);
    console.log(`  ✓ Entered NZBN: ${nzbn}`);
    
    // 3. Insert company name
    const companyNameXPath = '//*[contains(@id, "-content")]/div[3]/form/div[4]/div/div/input';
    const companyNameInput = page.locator(`xpath=${companyNameXPath}`);
    await companyNameInput.fill(companyName);
    console.log(`  ✓ Entered Company Name: ${companyName}`);
    
    // 4. Insert trading name
    const tradingNameXPath = '//*[contains(@id, "-content")]/div[3]/form/div[5]/div/div/input';
    const tradingNameInput = page.locator(`xpath=${tradingNameXPath}`);
    await tradingNameInput.fill(tradingName);
    console.log(`  ✓ Entered Trading Name: ${tradingName}`);
    
    // 5. Insert director name
    const directorNameXPath = '//*[contains(@id, "-content")]/div[3]/form/div[6]/div/div/input';
    const directorNameInput = page.locator(`xpath=${directorNameXPath}`);
    await directorNameInput.fill(directorName);
    console.log(`  ✓ Entered Director Name: ${directorName}`);
    
    // 6. Insert director mobile number
    const directorMobileXPath = '//*[contains(@id, "-content")]/div[3]/form/div[7]/div/div/input';
    const directorMobileInput = page.locator(`xpath=${directorMobileXPath}`);
    await directorMobileInput.fill(directorMobile);
    console.log(`  ✓ Entered Director Mobile: ${directorMobile}`);
    
    // 7. Click confirm checkbox
    const confirmCheckboxXPath = '//*[@id="agree"]';
    const confirmCheckbox = page.locator(`xpath=${confirmCheckboxXPath}`);
    await confirmCheckbox.click();
    console.log('  ✓ Checked confirmation checkbox');
    
    // 8. Click Save button
    const saveButtonXPath = '//*[contains(@id, "-content")]/div[3]/form/button';
    const saveButton = page.locator(`xpath=${saveButtonXPath}`);
    await saveButton.click();
    console.log('  ✓ Clicked Save button');
    
    // 9. Wait 5 seconds for save to complete
    console.log('  ⏳ Waiting for Uber integration to save...');
    await page.waitForTimeout(5000);
    console.log('  ✓ Uber Delivery Management configured');
    await takeScreenshot(page, '07-uber-saved');
    
    // 10. Scroll to top of page
    await page.evaluate(() => window.scrollTo(0, 0));
    console.log('  ✓ Scrolled to top of page');
    
    // STEP 6: Navigate to Services tab
    console.log('\n🛠️ STEP 6: Navigate to Services tab');
    
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
    } catch (error) {
      console.error('  ❌ Failed to navigate to Services:', error.message);
      throw error;
    }
    
    console.log('  ✓ Services settings loaded');
    await takeScreenshot(page, '08-services-settings');
    
    // STEP 7: Configure Default Delivery Provider
    console.log('\n📦 STEP 7: Setting Default Delivery Provider');
    
    // 12. Click the Deliveries menu dropdown
    const deliveriesMenu = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(2)');
    await deliveriesMenu.click();
    console.log('  ✓ Opened Deliveries menu');
    await page.waitForTimeout(1500);
    
    // 13. Click the Default Delivery Provider dropdown
    const providerDropdown = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div.selectadv__Wrapper-cKWklP.FVSIE > div.selectadv__InputIcon-dZhktu.PrPXn');
    await providerDropdown.click();
    console.log('  ✓ Opened Default Delivery Provider dropdown');
    await page.waitForTimeout(1000);
    
    // 14. Click the Uber option
    try {
      // Try with text selector first
      const uberOption = page.locator('div.selectadv__DropdownOption-bmnJxJ:has-text("Uber")').first();
      if (await uberOption.count() > 0) {
        await uberOption.click();
        console.log('  ✓ Selected Uber as default delivery provider');
      } else {
        // Fallback to full selector
        const uberOptionFull = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > div > div > div > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div.selectadv__Wrapper-cKWklP.FVSIE > div.selectadv__Dropdown-eSUwYi.dtQnDO > div.selectadv__DropdownOption-bmnJxJ.eoQlWp');
        await uberOptionFull.click();
        console.log('  ✓ Selected Uber as default delivery provider (via full selector)');
      }
    } catch (error) {
      console.error('  ⚠️ Could not select Uber option:', error.message);
    }
    
    // Save the delivery settings
    const saveDeliveryButton = page.locator('#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > form > div > button');
    await saveDeliveryButton.click();
    console.log('  ✓ Saved delivery settings');
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, '09-final-configuration');
    
    console.log('\n✅ Onboarding Finalisation Complete!');
    console.log('==========================================');
    console.log('Configured:');
    console.log('  • Uber Delivery Management integration');
    console.log('  • Default delivery provider set to Uber');
    console.log('  • NZBN:', nzbn);
    console.log('  • Company:', companyName);
    console.log('  • Trading as:', tradingName);
    console.log('  • Director:', directorName);
    console.log('==========================================\n');
    
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Keep browser open in debug mode
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode enabled - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
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
finaliseOnboarding().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});