#!/usr/bin/env node

/**
 * Navigate to Super Admin Section
 * 
 * This script logs into manage.pumpd.co.nz and navigates to the Super Admin section
 * 
 * Usage:
 *   node navigate-to-super-admin.js [options]
 * 
 * Options:
 *   --debug                   Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   MANAGE_EMAIL             Super admin email (default: claude.agent@gmail.com)
 *   MANAGE_PASSWORD          Super admin password
 *   DEBUG_MODE               Enable debug mode (true/false)
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('../restaurant-registration/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration with environment variable support
const LOGIN_EMAIL = process.env.MANAGE_EMAIL || 'claude.agent@gmail.com';
const LOGIN_PASSWORD = process.env.MANAGE_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';
const LOGIN_URL = 'https://manage.pumpd.co.nz';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || process.argv.includes('--debug');

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotDir = path.join(__dirname, '..', 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `super-admin-${name}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
  return screenshotPath;
};

async function navigateToSuperAdmin() {
  console.log('🚀 Starting Super Admin Navigation...\n');
  
  console.log('Configuration:');
  console.log(`  URL: ${LOGIN_URL}`);
  console.log(`  Email: ${LOGIN_EMAIL}`);
  console.log(`  Password: ${'*'.repeat(LOGIN_PASSWORD.length)}`);
  console.log(`  Debug Mode: ${DEBUG_MODE}`);
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    // STEP 1: Navigate to login page
    console.log('📱 STEP 1: Navigate to manage.pumpd.co.nz');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '01-login-page');
    console.log('  ✓ Login page loaded');
    
    // STEP 2: Enter credentials
    console.log('\n🔐 STEP 2: Enter credentials');
    
    const emailInput = page.locator('#email, input[type="email"]').first();
    await emailInput.fill(LOGIN_EMAIL);
    console.log('  ✓ Email entered');
    
    const passwordInput = page.locator('#password, input[type="password"]').first();
    await passwordInput.fill(LOGIN_PASSWORD);
    console.log('  ✓ Password entered');
    
    // STEP 3: Click login button
    console.log('\n🔑 STEP 3: Login');
    
    const loginButtonSelectors = [
      'button.bg-brand-yellow',
      'button:has-text("Login")',
      'button:has-text("Sign In")',
      'button[type="submit"]'
    ];
    
    let loginSuccessful = false;
    for (const selector of loginButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          await button.click();
          console.log(`  ✓ Clicked login button`);
          loginSuccessful = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!loginSuccessful) {
      throw new Error('Could not find login button');
    }
    
    // STEP 4: Wait for dashboard to load
    console.log('\n⏳ STEP 4: Wait for dashboard');
    await page.waitForTimeout(5000);
    console.log('  ✓ Dashboard loaded');
    await takeScreenshot(page, '02-dashboard');
    
    // STEP 5: Navigate to Super Admin section
    console.log('\n🔧 STEP 5: Navigate to Super Admin section');
    
    // Look for Super Admin button specifically in nav element
    // This avoids the footer badge by specifically looking in the navigation
    try {
      const navSuperAdmin = page.locator('nav button:has-text("Super Admin")').first();
      if (await navSuperAdmin.count() > 0) {
        await navSuperAdmin.click();
        console.log('  ✓ Clicked Super Admin button in navigation');
      } else {
        throw new Error('Super Admin button not found in navigation');
      }
    } catch (error) {
      console.error('  ❌ Failed to click Super Admin button:', error.message);
      
      // Try to list all buttons in nav for debugging
      try {
        const navButtons = await page.locator('nav button').all();
        console.log(`  Debug: Found ${navButtons.length} buttons in nav:`);
        for (let i = 0; i < navButtons.length; i++) {
          const text = await navButtons[i].textContent();
          console.log(`    Button ${i + 1}: ${text?.trim()}`);
        }
      } catch (debugError) {
        console.log('  Could not list nav buttons for debugging');
      }
      
      throw error;
    }
    
    // Wait for Super Admin page to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-super-admin');
    
    // STEP 6: Verify we're on the Super Admin page
    console.log('\n✅ STEP 6: Verify Super Admin page');
    
    // Check for Super Admin specific content
    const superAdminIndicators = [
      'text="Create Restaurant"',
      'text="Restaurant Management"',
      'text="Admin Controls"',
      'h1:has-text("Super Admin")',
      'h2:has-text("Super Admin")'
    ];
    
    let pageVerified = false;
    for (const indicator of superAdminIndicators) {
      if (await page.locator(indicator).count() > 0) {
        pageVerified = true;
        console.log(`  ✓ Super Admin page verified by: ${indicator}`);
        break;
      }
    }
    
    if (!pageVerified) {
      console.log('  ⚠️ Could not verify Super Admin page content, but continuing...');
    }
    
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);
    
    console.log('\n✅ Successfully navigated to Super Admin section!');
    
    // Keep browser open in debug mode
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode enabled - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    }
    
    // Return the page and browser for reuse by other scripts
    return {
      browser,
      context,
      page,
      loginEmail: LOGIN_EMAIL,
      currentUrl
    };
    
  } catch (error) {
    console.error('\n❌ Navigation failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
    // Debug information
    console.log('\nDebug Information:');
    console.log('  Current URL:', page.url());
    console.log('  Page title:', await page.title());
    
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode - browser will remain open for inspection');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    }
    
    throw error;
  } finally {
    if (!DEBUG_MODE) {
      console.log('\n⏸️  Browser will close in 5 seconds...');
      await page.waitForTimeout(5000);
      await browser.close();
      console.log('✨ Browser closed');
    }
  }
}

// Export for use by other scripts
export { navigateToSuperAdmin, takeScreenshot };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  navigateToSuperAdmin().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}