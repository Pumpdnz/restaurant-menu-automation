#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function checkLoginPage() {
  console.log('Checking admin.pumpd.co.nz login page...\n');
  
  const browser = await chromium.launch({
    headless: true, // Run headless for speed
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Navigating to login page...');
    await page.goto('https://admin.pumpd.co.nz/login', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    console.log('✓ Page loaded');
    
    // Wait for potential JavaScript rendering
    await page.waitForTimeout(5000);
    
    // Take screenshot
    const screenshotPath = path.join(__dirname, 'screenshots', `login-page-check-${Date.now()}.png`);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    // Get page content
    const pageTitle = await page.title();
    const pageURL = page.url();
    
    console.log(`\nPage Title: ${pageTitle}`);
    console.log(`Current URL: ${pageURL}`);
    
    // Check for various possible elements
    const checks = {
      'Email input': 'input[type="email"]',
      'Password input': 'input[type="password"]',
      'Any input': 'input',
      'Login button': 'button',
      'Form element': 'form',
      'Error message': '[class*="error"], [class*="Error"], .error, .alert',
      'Loading spinner': '[class*="load"], [class*="spin"], .loader, .spinner'
    };
    
    console.log('\nElement checks:');
    for (const [name, selector] of Object.entries(checks)) {
      const count = await page.locator(selector).count();
      console.log(`  ${name}: ${count > 0 ? `Found (${count})` : 'Not found'}`);
    }
    
    // Get any visible text on the page
    const visibleText = await page.locator('body').innerText();
    console.log('\nVisible text on page (first 500 chars):');
    console.log(visibleText.substring(0, 500));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✨ Browser closed');
  }
}

checkLoginPage();