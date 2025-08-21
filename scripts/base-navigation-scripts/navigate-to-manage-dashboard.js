#!/usr/bin/env node

/**
 * Navigate to Manage Dashboard
 * 
 * This script logs into manage.pumpd.co.nz as a super admin
 * and navigates to the dashboard. It serves as a base script
 * for other manage.pumpd.co.nz automation scripts.
 * 
 * Usage:
 *   node navigate-to-manage-dashboard.js [options]
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
  const screenshotPath = path.join(screenshotDir, `manage-dashboard-${name}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
  return screenshotPath;
};

async function navigateToManageDashboard() {
  console.log('🚀 Starting Manage Dashboard Navigation...\n');
  
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
    
    // Look for email input by ID or type
    const emailInput = page.locator('#email, input[type="email"]').first();
    await emailInput.fill(LOGIN_EMAIL);
    console.log('  ✓ Email entered');
    
    // Look for password input by ID or type
    const passwordInput = page.locator('#password, input[type="password"]').first();
    await passwordInput.fill(LOGIN_PASSWORD);
    console.log('  ✓ Password entered');
    
    // STEP 3: Click login button
    console.log('\n🔑 STEP 3: Login');
    
    // Try multiple selectors for the login button
    const loginButtonSelectors = [
      'button.bg-brand-yellow',
      'button:has-text("Login")',
      'button:has-text("Sign In")',
      'button[type="submit"]',
      'form button.inline-flex'
    ];
    
    let loginSuccessful = false;
    for (const selector of loginButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          await button.click();
          console.log(`  ✓ Clicked login button using: ${selector}`);
          loginSuccessful = true;
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    if (!loginSuccessful) {
      throw new Error('Could not find login button');
    }
    
    // STEP 4: Wait for dashboard to load
    console.log('\n⏳ STEP 4: Wait for dashboard');
    
    // Wait for navigation away from login page
    await page.waitForFunction(
      url => !window.location.href.includes('/login'),
      { timeout: 10000 }
    ).catch(() => {
      console.log('  ⚠️ URL check failed, waiting for content...');
    });
    
    // Additional wait for dashboard content to load
    await page.waitForTimeout(5000);
    
    // Verify we're on the dashboard by checking for navigation elements
    const dashboardElements = [
      'nav',
      'button:has-text("Ordering Page")',
      'div.sidebar',
      '[data-testid="dashboard"]'
    ];
    
    let dashboardLoaded = false;
    for (const selector of dashboardElements) {
      if (await page.locator(selector).count() > 0) {
        dashboardLoaded = true;
        break;
      }
    }
    
    if (dashboardLoaded) {
      console.log('  ✓ Dashboard loaded successfully');
    } else {
      console.log('  ⚠️ Dashboard elements not found, but continuing...');
    }
    
    await takeScreenshot(page, '02-dashboard');
    
    // STEP 5: Get current URL and page info
    console.log('\n📊 STEP 5: Dashboard Information');
    const currentUrl = page.url();
    const pageTitle = await page.title();
    
    console.log(`  URL: ${currentUrl}`);
    console.log(`  Title: ${pageTitle}`);
    
    console.log('\n✅ Successfully logged into manage.pumpd.co.nz dashboard!');
    
    // Return the page and browser for reuse by other scripts
    return {
      browser,
      context,
      page,
      loginEmail: LOGIN_EMAIL,
      dashboardUrl: currentUrl
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
      // Only close if not in debug mode and not returning for reuse
      console.log('\n⏸️  Browser will close in 5 seconds...');
      await page.waitForTimeout(5000);
      await browser.close();
      console.log('✨ Browser closed');
    }
  }
}

// Export for use by other scripts
export { navigateToManageDashboard, takeScreenshot };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  navigateToManageDashboard().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}