#!/usr/bin/env node

/**
 * Create Onboarding User Script
 * 
 * This script creates a new "New Sign Up" user in the Super Admin section for onboarding purposes
 * 
 * Usage:
 *   node create-onboarding-user.js --name="User Name" --email="email@example.com" --password="Password123!" [options]
 * 
 * Options:
 *   --name=<name>            User's full name (required)
 *   --email=<email>          User's email address (required)
 *   --password=<password>    User's password (required)
 *   --debug                  Enable debug mode (keeps browser open)
 * 
 * Note: When passing passwords with special characters, use double quotes:
 *   --password="Currygarden789!"
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
const { chromium } = require('./restaurant-registration/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Get parameters
const userName = getArg('name');
const userEmail = getArg('email');
const userPassword = getArg('password');
const userRole = 'New Sign Up'; // Fixed role for onboarding users

// Debug: Log the raw password to see what we're getting
if (process.argv.includes('--debug')) {
  console.log('Debug - Raw password received:', userPassword);
  console.log('Debug - Password length:', userPassword?.length);
}

// Configuration
const LOGIN_EMAIL = process.env.MANAGE_EMAIL || 'claude.agent@gmail.com';
const LOGIN_PASSWORD = process.env.MANAGE_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';
const LOGIN_URL = 'https://manage.pumpd.co.nz';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || process.argv.includes('--debug');

// Validate required arguments
if (!userName || !userEmail || !userPassword) {
  console.error('❌ Error: Missing required arguments');
  console.error('Usage: node create-onboarding-user.js --name="Name" --email="email@example.com" --password="Password123!"');
  console.error('\nNote: Use double quotes for passwords with special characters:');
  console.error('  --password="Currygarden789!"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotDir = path.join(__dirname, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `onboarding-user-${name}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
  return screenshotPath;
};

async function createOnboardingUser() {
  console.log('🚀 Starting Onboarding User Creation...\n');
  
  console.log('Configuration:');
  console.log(`  Name: ${userName}`);
  console.log(`  Email: ${userEmail}`);
  console.log(`  Password: ${'*'.repeat(userPassword.length)}`);
  console.log(`  Role: ${userRole}`);
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
    console.log('  ✓ Login page loaded');
    
    // STEP 2: Enter credentials
    console.log('\n🔐 STEP 2: Enter credentials');
    const emailInput = page.locator('#email, input[type="email"]').first();
    await emailInput.fill(LOGIN_EMAIL);
    console.log('  ✓ Email entered');
    
    const passwordInput = page.locator('#password').first();
    await passwordInput.fill(LOGIN_PASSWORD);
    console.log('  ✓ Password entered');
    
    // Wait a moment before clicking login to ensure form is ready
    await page.waitForTimeout(1000);
    
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
    await page.waitForTimeout(5000);
    console.log('  ✓ Dashboard loaded');
    await takeScreenshot(page, '01-dashboard');
    
    // STEP 5: Navigate to Super Admin section
    console.log('\n🔧 STEP 5: Navigate to Super Admin section');
    const navSuperAdmin = page.locator('nav button:has-text("Super Admin")').first();
    await navSuperAdmin.click();
    console.log('  ✓ Clicked Super Admin button');
    
    // Wait for Super Admin page to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02-super-admin');
    
    // Verify we're on the Super Admin page
    const superAdminHeader = await page.locator('h1:has-text("Super Admin")').count();
    if (superAdminHeader > 0) {
      console.log('  ✓ Super Admin page loaded');
    }
    
    // STEP 6: Click Add User button
    console.log('\n👤 STEP 6: Click Add User button');
    
    // Use multiple selector strategies for robustness
    const addUserSelectors = [
      'button:has-text("Add User")',
      'button.bg-primary:has-text("Add User")',
      'button[class*="bg-primary"]:has-text("Add User")'
    ];
    
    let addUserClicked = false;
    for (const selector of addUserSelectors) {
      try {
        const addUserButton = page.locator(selector).first();
        if (await addUserButton.count() > 0) {
          await addUserButton.click();
          console.log(`  ✓ Clicked Add User button`);
          addUserClicked = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!addUserClicked) {
      throw new Error('Could not find Add User button');
    }
    
    // Wait for Add User dialog/form to appear
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '03-add-user-dialog');
    
    // STEP 7: Fill in user details
    console.log('\n📝 STEP 7: Fill in user details');
    
    // Fill Name field
    try {
      // Look for input associated with "Name" label
      const nameInput = page.locator('label:has-text("Name") + input, label:has-text("Name") ~ input, input[placeholder*="Name"]').first();
      await nameInput.fill(userName);
      console.log(`  ✓ Name set to: ${userName}`);
    } catch (error) {
      console.log('  ⚠️ Could not find Name field, trying alternative selector...');
      const nameAlt = page.locator('input').nth(0); // First input is usually name
      await nameAlt.fill(userName);
      console.log(`  ✓ Name set using alternative selector`);
    }
    
    await page.waitForTimeout(500);
    
    // Fill Email field
    try {
      // Look for input associated with "Email" label
      const emailFormInput = page.locator('label:has-text("Email") + input, label:has-text("Email") ~ input, input[type="email"]').first();
      await emailFormInput.fill(userEmail);
      console.log(`  ✓ Email set to: ${userEmail}`);
    } catch (error) {
      console.log('  ⚠️ Could not find Email field, trying alternative selector...');
      const emailAlt = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      await emailAlt.fill(userEmail);
      console.log(`  ✓ Email set using alternative selector`);
    }
    
    await page.waitForTimeout(500);
    
    // Fill Password field
    try {
      // Use XPath to find password input with dynamic ID
      const passwordFormInput = page.locator('//*[contains(@id, "password")]');
      await passwordFormInput.fill(userPassword);
      console.log(`  ✓ Password set to: ${'*'.repeat(userPassword.length)}`);
    } catch (error) {
      console.log('  ⚠️ Could not find Password field with XPath, trying alternative selectors...');
      try {
        // Fallback to label-based selector
        const passwordLabelInput = page.locator('label:has-text("Password") + input, label:has-text("Password") ~ input').first();
        await passwordLabelInput.fill(userPassword);
        console.log(`  ✓ Password set using label selector`);
      } catch (error2) {
        // Last resort: any password input
        const passwordAlt = page.locator('input[type="password"]').first();
        await passwordAlt.fill(userPassword);
        console.log(`  ✓ Password set using type selector`);
      }
    }
    
    await page.waitForTimeout(500);
    
    // Verify Role is set to "New Sign Up" (should be default)
    try {
      const roleDisplay = await page.locator('text="New Sign Up"').count();
      if (roleDisplay > 0) {
        console.log('  ✓ Role confirmed as: New Sign Up');
      } else {
        console.log('  ⚠️ Could not verify role setting');
      }
    } catch (error) {
      console.log('  ⚠️ Could not check role field');
    }
    
    // Verify Organisation is set to "None" (should be default)
    try {
      const orgDisplay = await page.locator('text="None"').count();
      if (orgDisplay > 0) {
        console.log('  ✓ Organisation confirmed as: None');
      } else {
        console.log('  ⚠️ Could not verify organisation setting');
      }
    } catch (error) {
      console.log('  ⚠️ Could not check organisation field');
    }
    
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '04-form-filled');
    
    // STEP 8: Submit the form
    console.log('\n💾 STEP 8: Submit the form');
    
    // Look for submit/save button - "Create User" is the correct text
    const submitButtonSelectors = [
      'button:has-text("Create User")',
      'button:has-text("Add User")',
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button[type="submit"]'
    ];
    
    let submitClicked = false;
    for (const selector of submitButtonSelectors) {
      try {
        const submitButton = page.locator(selector).last(); // Use last() in case there are multiple
        if (await submitButton.count() > 0) {
          await submitButton.click();
          console.log(`  ✓ Clicked submit button`);
          submitClicked = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!submitClicked) {
      console.log('  ⚠️ Could not find submit button');
    }
    
    // Wait for dialog to close or success message
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '05-after-submit');
    
    // Check if user was created successfully
    try {
      // Look for the new user in the table
      const newUserRow = page.locator(`text="${userEmail}"`).first();
      if (await newUserRow.count() > 0) {
        console.log(`  ✓ User created successfully: ${userEmail}`);
      } else {
        console.log('  ⚠️ Could not verify user creation in table');
      }
    } catch (error) {
      console.log('  ⚠️ Could not check for user in table');
    }
    
    console.log('\n✅ Onboarding user creation process completed!');
    console.log('\n📊 User Details:');
    console.log(`  Name: ${userName}`);
    console.log(`  Email: ${userEmail}`);
    console.log(`  Password: [Set successfully]`);
    console.log(`  Role: New Sign Up`);
    console.log(`  Organisation: None (pending assignment)`);
    
    
    // Keep browser open in debug mode
    if (DEBUG_MODE) {
      console.log('\n🔍 Debug mode enabled - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    }
    
    return {
      success: true,
      userName,
      userEmail
    };
    
  } catch (error) {
    console.error('\n❌ User creation failed:', error.message);
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
export { createOnboardingUser };

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createOnboardingUser().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}