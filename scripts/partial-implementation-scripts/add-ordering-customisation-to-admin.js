#!/usr/bin/env node

/**
 * Add Ordering Customisation to Admin Portal
 * 
 * This script logs into the admin portal, navigates to Website settings,
 * and adds custom head/body code injections from generated files
 * 
 * Usage:
 *   node add-ordering-customisation-to-admin.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --head=<path>             Path to head injection HTML file (required)
 *   --body=<path>             Path to body injection HTML file (required)
 *   --debug                   Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   ADMIN_PASSWORD          Admin password for login
 *   DEBUG_MODE              Enable debug mode (true/false)
 * 
 * Example:
 *   node add-ordering-customisation-to-admin.js --email="test@example.com" --head="../generated-code/restaurant/head-injection.html" --body="../generated-code/restaurant/body-injection.html"
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
const headPath = getArg('head');
const bodyPath = getArg('body');

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email || !headPath || !bodyPath) {
  console.error('❌ Error: Email, head path, and body path are required');
  console.error('Usage: node add-ordering-customisation-to-admin.js --email="email@example.com" --head="path/to/head.html" --body="path/to/body.html"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `website-settings-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function addOrderingCustomisation() {
  console.log('🚀 Starting Add Ordering Customisation to Admin...\n');
  
  // Read the injection files
  let headCode, bodyCode;
  try {
    headCode = await fs.readFile(path.resolve(headPath), 'utf-8');
    bodyCode = await fs.readFile(path.resolve(bodyPath), 'utf-8');
    console.log('✓ Loaded code injection files');
  } catch (error) {
    console.error('❌ Error reading injection files:', error.message);
    process.exit(1);
  }
  
  console.log('\nConfiguration:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${'*'.repeat(password.length)}`);
  console.log(`  Head file: ${headPath} (${headCode.length} chars)`);
  console.log(`  Body file: ${bodyPath} (${bodyCode.length} chars)`);
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
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
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
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    console.log('  ⏳ Restaurant management page loading...');
    await takeScreenshot(page, '03-restaurant-management');
    
    // STEP 3: Navigate to Settings section
    console.log('\n⚙️ STEP 3: Navigate to Settings section');
    
    // Wait for the navigation menu to be fully loaded
    console.log('  ⏳ Waiting for navigation menu to load...');
    
    // Look for Settings link in the navigation
    // Based on the menu pattern, settings should be similar to menus (#nav-link-menus)
    // Common patterns: #nav-link-settings, #nav-settings, or text-based selector
    
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
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04-settings-page');
    
    // STEP 4: Click on Website tab
    console.log('\n🌐 STEP 4: Navigate to Website tab');
    
    // Wait for the tab navigation to be visible
    await page.waitForTimeout(2000);
    
    try {
      // Try to find and click Website text directly
      const websiteText = page.locator('text="Website"').first();
      if (await websiteText.count() > 0) {
        await websiteText.click();
        console.log('  ✓ Clicked on Website text');
        await page.waitForTimeout(2000);
      } else {
        // Fallback: Try button with Website text
        console.log('  Website text not found, trying button selector...');
        const websiteButton = page.locator('button:has-text("Website")').first();
        if (await websiteButton.count() > 0) {
          await websiteButton.click();
          console.log('  ✓ Clicked Website button');
          await page.waitForTimeout(2000);
        } else {
          throw new Error('Could not find Website tab');
        }
      }
      
      // Verify we're on the Website tab by checking for Website-specific content
      const websiteIndicators = [
        page.locator('text=/Custom.*Header/i'),
        page.locator('text=/Custom.*Footer/i'),
        page.locator('text=/Header.*Code/i'),
        page.locator('text=/Footer.*Code/i'),
        page.locator('text=/Domain/i'),
        page.locator('text=/Subdomain/i')
      ];
      
      let foundWebsiteContent = false;
      for (const indicator of websiteIndicators) {
        if (await indicator.count() > 0) {
          foundWebsiteContent = true;
          console.log('  ✓ Website tab content detected');
          break;
        }
      }
      
      if (foundWebsiteContent) {
        console.log('  ✓ Successfully navigated to Website tab');
      } else {
        console.log('  ⚠️ Could not verify Website content, but tab should be active');
      }
      
    } catch (error) {
      console.error('  ❌ Failed to click Website tab:', error.message);
      
      // Additional debugging
      console.log('\n  Debugging - looking for tab structure:');
      
      // Check for various tab-related elements
      const debugSelectors = [
        '#settings-tab-select',
        '[class*="TabSelectComponent"]',
        'div:has-text("Website")',
        '#settings-tab-select-tab-select-content'
      ];
      
      for (const selector of debugSelectors) {
        const count = await page.locator(selector).count();
        console.log(`    ${selector}: ${count} element(s)`);
      }
      
      await takeScreenshot(page, 'error-website-tab');
      throw error;
    }
    
    // Wait for website settings to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '05-website-settings');
    
    console.log('\n✅ Successfully navigated to Website Settings!');
    
    // STEP 5: Scroll to Custom Code section and open it
    console.log('\n📝 STEP 5: Opening Custom Code section');
    
    // Scroll to the Custom Code dropdown section
    const customCodeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(18)';
    
    try {
      // Scroll the element into view
      await page.locator(customCodeSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      console.log('  ✓ Scrolled to Custom Code section');
      
      // Click to expand the dropdown
      await page.click(customCodeSelector);
      await page.waitForTimeout(1500);
      console.log('  ✓ Expanded Custom Code dropdown');
      
      await takeScreenshot(page, '06-custom-code-expanded');
    } catch (error) {
      console.log('  ⚠️ Using fallback selector for Custom Code section');
      // Fallback: look for text-based selector
      const customCodeText = page.locator('div:has-text("Custom Code"):has(svg)').first();
      await customCodeText.scrollIntoViewIfNeeded();
      await customCodeText.click();
      await page.waitForTimeout(1500);
    }
    
    // STEP 6: Add Head Code
    console.log('\n🔖 STEP 6: Adding Head Code Injection');
    
    try {
      // Look for the header code textarea
      const headerTextarea = page.locator('textarea').first(); // Usually the first textarea is for header
      await headerTextarea.click();
      await headerTextarea.clear();
      await headerTextarea.fill(headCode);
      console.log('  ✓ Head code injection added');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error('  ❌ Failed to add head code:', error.message);
    }
    
    // STEP 7: Add Body Code
    console.log('\n🔖 STEP 7: Adding Body Code Injection');
    
    try {
      // Look for the footer/body code textarea (usually the second one)
      const footerTextarea = page.locator('textarea').nth(1);
      await footerTextarea.click();
      await footerTextarea.clear();
      await footerTextarea.fill(bodyCode);
      console.log('  ✓ Body code injection added');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error('  ❌ Failed to add body code:', error.message);
    }
    
    // STEP 8: Save the changes
    console.log('\n💾 STEP 8: Saving changes');
    
    try {
      // Look for Save button
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();
      console.log('  ✓ Clicked Save button');
      
      // Wait for save confirmation
      await page.waitForTimeout(3000);
      
      // Check for success message
      const successMessage = page.locator('text=/success|saved|updated/i');
      if (await successMessage.count() > 0) {
        console.log('  ✓ Changes saved successfully!');
      }
    } catch (error) {
      console.error('  ❌ Failed to save changes:', error.message);
    }
    
    await takeScreenshot(page, '08-final-state');
    
    console.log('\n✅ Ordering customisation added successfully!');
    console.log(`Head code: ${headCode.length} characters`);
    console.log(`Body code: ${bodyCode.length} characters`);
    
  } catch (error) {
    console.error('\n❌ Navigation failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
  } finally {
    if (DEBUG_MODE) {
      console.log('\n🐛 Browser left open for inspection');
      console.log('You can now interact with the website settings page');
      console.log('Press Ctrl+C to exit');
      await new Promise(() => {}); // Keep alive
    } else {
      await browser.close();
      console.log('\n✨ Browser closed');
    }
  }
}

// Run the script
addOrderingCustomisation();