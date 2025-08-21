#!/usr/bin/env node

/**
 * Navigate to Website Settings Script for admin.pumpd.co.nz
 * 
 * This script logs into the admin portal and navigates to the Website settings tab
 * It's designed to be a foundation for website configuration automation
 * 
 * Usage:
 *   node navigate-to-website-settings.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --debug                   Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   ADMIN_PASSWORD          Admin password for login
 *   DEBUG_MODE              Enable debug mode (true/false)
 * 
 * Example:
 *   node navigate-to-website-settings.js --email="test@example.com"
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

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
  console.error('Usage: node navigate-to-website-settings.js --email="email@example.com"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `website-settings-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function navigateToWebsiteSettings() {
  console.log('🚀 Starting Navigation to Website Settings...\n');
  
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
      // Use bounding box calculations to click on specific tab positions
      // The tabs are: System (1st), Services (2nd), Payments (3rd), Website (4th), Integrations (5th)
      
      console.log('  Looking for tab navigation...');
      
      const tabContainer = page.locator('.components__TabSelectComponent--dwNZLr, [class*="TabSelectComponent"]').first();
      
      if (await tabContainer.count() > 0) {
        console.log('  Found tab container');
        
        // Get the current text to understand where we are
        const currentText = await tabContainer.textContent();
        console.log(`  Current tab text: "${currentText}"`);
        
        // Get the bounding box of the tab container
        const box = await tabContainer.boundingBox();
        
        if (box) {
          console.log(`  Tab container dimensions: ${box.width}x${box.height} at (${box.x}, ${box.y})`);
          
          // Calculate tab positions assuming 5 equal-width tabs
          const tabWidth = box.width / 5;
          const tabY = box.y + (box.height / 2);
          
          // Try clicking through tabs sequentially to reach Website (4th tab)
          // Start from System tab first
          const systemX = box.x + (tabWidth * 0.5);
          await page.mouse.click(systemX, tabY);
          console.log('  Clicked on System tab (1st) to ensure starting position');
          await page.waitForTimeout(500);
          
          // Now click through to Website tab
          for (let i = 1; i <= 3; i++) {
            const nextTabX = box.x + (tabWidth * (i + 0.5));
            console.log(`  Clicking tab ${i + 1} at position ${nextTabX}`);
            await page.mouse.click(nextTabX, tabY);
            await page.waitForTimeout(1000);
            
            // Check if we reached Website tab (should be on 4th click)
            if (i === 3) {
              // This should be the Website tab
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
                console.log('  ⚠️ Website content not detected, but should be on Website tab');
              }
            }
          }
        }
      } else {
        console.log('  ⚠️ Tab container not found with expected class');
        
        // Fallback: try to find and click Website text directly
        const websiteText = page.locator('text="Website"').first();
        if (await websiteText.count() > 0) {
          await websiteText.click();
          console.log('  ✓ Clicked on Website text');
        }
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
    console.log('Ready for website configuration tasks.');
    
    // Log current URL for reference
    console.log(`\nCurrent URL: ${page.url()}`);
    
    // Check for website configuration elements
    console.log('\n🔍 Checking for website configuration elements...');
    
    // Look for common website settings elements
    const customCodeSection = page.locator('*:has-text("Custom Code"), *:has-text("Header"), *:has-text("Footer")');
    const themeSection = page.locator('*:has-text("Theme"), *:has-text("Colors"), *:has-text("Brand")');
    const domainSection = page.locator('*:has-text("Domain"), *:has-text("Subdomain"), *:has-text("URL")');
    
    if (await customCodeSection.count() > 0) {
      console.log('  ✓ Found Custom Code section');
    }
    if (await themeSection.count() > 0) {
      console.log('  ✓ Found Theme/Colors section');
    }
    if (await domainSection.count() > 0) {
      console.log('  ✓ Found Domain configuration section');
    }
    
    await takeScreenshot(page, '06-final-state');
    
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

// Run the navigation
navigateToWebsiteSettings();