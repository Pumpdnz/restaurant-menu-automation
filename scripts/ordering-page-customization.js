#!/usr/bin/env node

/**
 * Ordering Page Customization Script for manage.pumpd.co.nz
 * 
 * This script automates the process of customizing the ordering page
 * with restaurant-specific colors and presets, then extracts the code injections
 * 
 * Usage:
 *   node ordering-page-customization.js --email="email@example.com" --password="password" --primary="#XXXXXX" --secondary="#XXXXXX" --name="Restaurant Name" [--lightmode]
 * 
 * Arguments:
 *   --email       Login email (optional, uses default if not provided)
 *   --password    Login password (optional, uses default if not provided)
 *   --primary     Primary color hex code
 *   --secondary   Secondary color hex code
 *   --name        Restaurant name
 *   --lightmode   Enable light mode (optional, dark mode by default)
 */

import { createRequire } from 'module';
import fs from 'fs';
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
const email = getArg('email') || 'claude.agent@gmail.com'; // Fallback for backward compatibility
const password = getArg('password') || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2'; // Fallback for backward compatibility
const primaryColor = getArg('primary') || '#E6B800'; // Default to Noi's golden color
const secondaryColor = getArg('secondary') || '#F2D966'; // Default to Noi's light golden
const restaurantName = getArg('name') || 'Noi';
const lightMode = args.includes('--lightmode');

// Login credentials
const LOGIN_EMAIL = email;
const LOGIN_PASSWORD = password;
const LOGIN_URL = 'https://manage.pumpd.co.nz';

console.log('🚀 Starting Ordering Page Customization...\n');
console.log(`📍 Restaurant: ${restaurantName}`);
console.log(`🎨 Primary Color: ${primaryColor}`);
console.log(`🎨 Secondary Color: ${secondaryColor}`);
console.log(`🎭 Theme: ${lightMode ? 'Light' : 'Dark'} mode\n`);

async function customizeOrderingPage() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();

  try {
    // Step 1-3: Navigate and Login
    console.log('📱 Step 1-3: Navigating to manage.pumpd.co.nz and logging in...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Enter credentials
    await page.fill('#email', LOGIN_EMAIL);
    await page.fill('#password', LOGIN_PASSWORD);
    console.log('  ✓ Credentials entered');
    
    // Click login button - using the specific selector
    const loginButtonSelector = '#radix-\\:r0\\:-content-login > form > button.inline-flex.items-center.justify-center.gap-2.whitespace-nowrap.rounded-md.text-sm.font-medium.ring-offset-background.transition-colors.focus-visible\\:outline-none.focus-visible\\:ring-2.focus-visible\\:ring-ring.focus-visible\\:ring-offset-2.disabled\\:pointer-events-none.disabled\\:opacity-50.\\[\\&_svg\\]\\:pointer-events-none.\\[\\&_svg\\]\\:size-4.\\[\\&_svg\\]\\:shrink-0.h-10.px-4.py-2.w-full.relative.bg-brand-yellow.hover\\:bg-brand-yellow-light-1.text-brand-dark-text.\\[\\&_svg\\]\\:text-brand-dark-text.\\[\\&_svg\\]\\:stroke-brand-dark-text';
    
    try {
      await page.click(loginButtonSelector);
    } catch {
      // Fallback to simpler selector
      await page.click('button.bg-brand-yellow');
    }
    console.log('  ✓ Clicked login button');
    
    // Step 4: Wait for page to load
    await page.waitForTimeout(5000);
    console.log('  ✓ Dashboard loaded\n');
    
    // Step 5: Click "Ordering Page" in navigation
    console.log('📋 Step 5: Navigating to Ordering Page...');
    const orderingPageSelector = '#root > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > div > div > div.duration-200.fixed.inset-y-0.z-10.hidden.h-svh.w-\\[--sidebar-width\\].transition-\\[left\\,right\\,width\\].ease-linear.md\\:flex.left-0.group-data-\\[collapsible\\=offcanvas\\]\\:left-\\[calc\\(var\\(--sidebar-width\\)\\*-1\\)\\].group-data-\\[collapsible\\=icon\\]\\:w-\\[--sidebar-width-icon\\].group-data-\\[side\\=left\\]\\:border-r.group-data-\\[side\\=right\\]\\:border-l.overflow-visible > div > div.flex.min-h-0.flex-1.flex-col.gap-2.overflow-auto.group-data-\\[collapsible\\=icon\\]\\:overflow-hidden > nav > button:nth-child(5)';
    
    try {
      await page.click(orderingPageSelector, { timeout: 5000 });
    } catch {
      // Fallback: try simpler selectors
      try {
        await page.click('button:has-text("Ordering Page")');
      } catch {
        await page.click('nav button:nth-child(5)');
      }
    }
    await page.waitForTimeout(3000);
    console.log('  ✓ Ordering Page loaded\n');
    
    // Step 6-7: Add Restaurant's colors
    console.log('🎨 Step 6-7: Setting brand colors...');
    
    // Use simpler approach - find color inputs by their class pattern
    try {
      // Find all inputs with font-mono class (these are typically color inputs)
      const colorInputs = page.locator('input.font-mono.text-sm');
      
      // Set primary color (first input)
      await colorInputs.first().click();
      await colorInputs.first().clear();
      await colorInputs.first().fill(primaryColor);
      console.log(`  ✓ Primary color set to ${primaryColor}`);
      
      // Small delay between inputs
      await page.waitForTimeout(500);
      
      // Set secondary color (second input)
      await colorInputs.nth(1).click();
      await colorInputs.nth(1).clear();
      await colorInputs.nth(1).fill(secondaryColor);
      console.log(`  ✓ Secondary color set to ${secondaryColor}`);
      
    } catch (error) {
      console.log('  ⚠️ Using fallback color input method...');
      // Fallback: try to find by any input that looks like a color field
      const allInputs = page.locator('input[value^="#"]');
      await allInputs.first().click();
      await allInputs.first().clear();
      await allInputs.first().fill(primaryColor);
      
      await allInputs.nth(1).click();
      await allInputs.nth(1).clear();
      await allInputs.nth(1).fill(secondaryColor);
    }
    
    // Wait a bit for colors to apply
    await page.waitForTimeout(1000);
    console.log('  ✓ Colors applied\n');
    
    // Step 8: Optional light mode
    if (lightMode) {
      console.log('🌞 Step 8: Setting light mode...');
      await page.click('#light-mode');
      await page.waitForTimeout(1000);
      console.log('  ✓ Light mode enabled\n');
    }
    
    // Step 9: Click Presets tab
    console.log('📑 Step 9: Switching to Presets tab...');
    await page.click('button:has-text("Presets"), [id*="trigger-presets"]');
    await page.waitForTimeout(2000);
    console.log('  ✓ Presets tab opened\n');
    
    // Step 10: Select Interactive Showcase preset
    console.log('🎯 Step 10: Selecting Interactive Showcase preset...');
    
    // First scroll down to find Interactive Showcase (it's in the third category)
    await page.evaluate(() => {
      // Find the presets content area and scroll it
      const presetsContent = document.querySelector('[id*="content-presets"], [id*="content-category"]');
      if (presetsContent) {
        presetsContent.scrollTop = presetsContent.scrollHeight / 2; // Scroll to middle
      }
    });
    await page.waitForTimeout(1000);
    
    // Now look for Interactive Showcase - use a more flexible selector
    // The selector pattern is: [id*="content-category"] > div:nth-child(3) > div.grid.gap-3 > div:nth-child(2)
    try {
      // Try using a partial selector that's more stable
      const interactiveShowcase = await page.locator('[id*="content-category"] > div:nth-child(3) > div.grid.gap-3 > div:nth-child(2) > div').first();
      await interactiveShowcase.click();
      console.log('  ✓ Clicked Interactive Showcase using specific selector');
    } catch {
      try {
        // Alternative: Look for the second item in the third category
        await page.click('div:nth-child(3) > div.grid.gap-3 > div:nth-child(2) > div');
        console.log('  ✓ Clicked Interactive Showcase using simplified selector');
      } catch {
        // Final fallback: look for text content and click the parent card
        await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            if (element.textContent?.includes('Interactive Showcase') && 
                !element.textContent?.includes('Modern Minimal')) {
              // Find the clickable card parent
              let parent = element;
              while (parent && !parent.classList.contains('cursor-pointer')) {
                parent = parent.parentElement;
              }
              if (parent) {
                parent.click();
                break;
              }
            }
          }
        });
        console.log('  ✓ Clicked Interactive Showcase using text search');
      }
    }
    
    await page.waitForTimeout(2000);
    console.log('  ✓ Interactive Showcase preset selected\n');
    
    // Step 11: Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    
    // Step 12: Click Components tab
    console.log('🔧 Step 12: Switching to Components tab...');
    await page.click('button:has-text("Components"), [id*="trigger-components"]');
    await page.waitForTimeout(2000);
    console.log('  ✓ Components tab opened\n');
    
    // Step 13-14: Configure Nav Bar Text Effects
    console.log('✨ Step 13-14: Configuring Nav Bar Text Effects...');
    
    // Scroll to find Nav Bar Text Effects
    await page.evaluate(() => {
      const element = Array.from(document.querySelectorAll('div')).find(el => 
        el.textContent?.includes('Nav Bar Text Effects')
      );
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await page.waitForTimeout(1000);
    
    // Click Nav Bar Text Effects using the correct selector
    const navBarTextEffectsSelector = '[id*="content-components"] > div > div.space-y-6 > div:nth-child(6) > div.space-y-2 > div:nth-child(2)';
    
    try {
      await page.click(navBarTextEffectsSelector);
      console.log('  ✓ Clicked Nav Bar Text Effects using specific selector');
    } catch {
      // Fallback: look for the component by text
      await page.evaluate(() => {
        const components = Array.from(document.querySelectorAll('[class*="space-y-2"] > div'));
        const navBarComponent = components.find(comp => 
          comp.textContent?.includes('Nav Bar Text Effects') &&
          !comp.textContent?.includes('Menu Item')
        );
        if (navBarComponent) navBarComponent.click();
      });
      console.log('  ✓ Clicked Nav Bar Text Effects using text search');
    }
    await page.waitForTimeout(1000);
    
    // Deselect Logo Text Gradient
    const logoGradientCheckbox = page.locator('#navBarTextEffects-nav-logo-gradient');
    if (await logoGradientCheckbox.isChecked()) {
      await logoGradientCheckbox.click();
      console.log('  ✓ Logo Text Gradient deselected');
    }
    console.log('  ✓ Nav Bar Text Effects configured\n');
    
    // Step 15-17: Configure Welcome Messages
    console.log('👋 Step 15-17: Configuring Welcome Messages...');
    
    // Scroll to find Welcome Messages
    await page.evaluate(() => {
      const element = Array.from(document.querySelectorAll('div')).find(el => 
        el.textContent?.includes('Welcome Messages')
      );
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await page.waitForTimeout(1000);
    
    // Click Welcome Messages using the correct selector (third item in the sixth category)
    const welcomeMessagesSelector = '[id*="content-components"] > div > div.space-y-6 > div:nth-child(6) > div.space-y-2 > div:nth-child(3)';
    
    try {
      await page.click(welcomeMessagesSelector);
      console.log('  ✓ Clicked Welcome Messages using specific selector');
    } catch {
      // Fallback: look for the component by text
      await page.evaluate(() => {
        const components = Array.from(document.querySelectorAll('[class*="space-y-2"] > div'));
        const welcomeComponent = components.find(comp => 
          comp.textContent?.includes('Welcome Messages') &&
          !comp.textContent?.includes('Nav Bar')
        );
        if (welcomeComponent) welcomeComponent.click();
      });
      console.log('  ✓ Clicked Welcome Messages using text search');
    }
    await page.waitForTimeout(1000);
    
    // Toggle Time-based Greeting to expand editor
    const greetingCheckbox = page.locator('#welcomeMessages-welcome-greeting-basic');
    await greetingCheckbox.click(); // Deselect
    await page.waitForTimeout(500);
    await greetingCheckbox.click(); // Reselect
    await page.waitForTimeout(1000);
    console.log('  ✓ Welcome Messages expanded\n');
    
    // Step 18: Enter restaurant name
    console.log(`🏪 Step 18: Setting restaurant name to "${restaurantName}"...`);
    
    // Scroll down quickly to the expanded welcome messages section
    await page.evaluate(() => {
      // Find the border-t element that contains the expanded fields
      const expandedSection = document.querySelector('div.mt-6.pt-4.border-t.border-gray-200');
      if (expandedSection) {
        expandedSection.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
    await page.waitForTimeout(500); // Short wait for scroll to complete
    
    // Use a stable selector that doesn't rely on radix IDs
    // This targets the structure: expanded section -> space-y-6 -> first div -> 6th child div -> input
    const restaurantNameSelector = 'div.mt-6.pt-4.border-t.border-gray-200 div.space-y-6 > div:nth-child(1) > div:nth-child(6) > input';
    
    try {
      const nameInput = page.locator(restaurantNameSelector);
      await nameInput.click();
      await nameInput.clear();
      await nameInput.fill(restaurantName);
      console.log(`  ✓ Restaurant name set to "${restaurantName}"`);
    } catch (error) {
      console.log(`  ❌ Failed to set restaurant name: ${error.message}`);
      throw error;
    }
    console.log(`  ✓ Restaurant name configuration complete\n`);
    
    // Create output directory for code injections
    const outputDir = path.join(__dirname, '..', 'generated-code', sanitize(restaurantName));
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Step 19: Save Head code
    console.log('💾 Step 19: Extracting Head code...');
    
    // Get the head code from the right panel
    const headCode = await page.evaluate(() => {
      // Find the code block in the head tab
      const codeBlock = document.querySelector('[id*="content-head"] pre, [id*="content-head"] code');
      return codeBlock ? codeBlock.textContent : null;
    });
    
    if (headCode) {
      const headPath = path.join(outputDir, 'head-injection.html');
      fs.writeFileSync(headPath, headCode);
      console.log(`  ✓ Head code saved to: ${headPath}\n`);
    } else {
      // Try download button as fallback
      await page.click('button:has-text("Download"):visible');
      console.log('  ✓ Head code downloaded\n');
    }
    
    // Step 20-21: Save Body code
    console.log('💾 Step 20-21: Extracting Body code...');
    
    // Click Body tab
    await page.click('button:has-text("Body"), [id*="trigger-body"]');
    await page.waitForTimeout(2000);
    
    // Get the body code
    const bodyCode = await page.evaluate(() => {
      const codeBlock = document.querySelector('[id*="content-body"] pre, [id*="content-body"] code');
      return codeBlock ? codeBlock.textContent : null;
    });
    
    if (bodyCode) {
      const bodyPath = path.join(outputDir, 'body-injection.html');
      fs.writeFileSync(bodyPath, bodyCode);
      console.log(`  ✓ Body code saved to: ${bodyPath}\n`);
    } else {
      // Try download button as fallback
      await page.click('button:has-text("Download"):visible');
      console.log('  ✓ Body code downloaded\n');
    }
    
    // Save configuration summary
    const config = {
      restaurant: restaurantName,
      primaryColor: primaryColor,
      secondaryColor: secondaryColor,
      theme: lightMode ? 'light' : 'dark',
      preset: 'Interactive Showcase',
      components: {
        navBarTextEffects: {
          enabled: true,
          logoGradient: false
        },
        welcomeMessages: {
          enabled: true,
          timeBasedGreeting: true,
          restaurantName: restaurantName
        }
      },
      generatedAt: new Date().toISOString()
    };
    
    const configPath = path.join(outputDir, 'configuration.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`  ✓ Configuration saved to: ${configPath}\n`);
    
    console.log('✅ Ordering Page Customization Complete!');
    console.log(`📁 All files saved to: ${outputDir}`);
    
  } catch (error) {
    console.error('❌ Error during customization:', error.message);
    
    // Take a screenshot for debugging
    const screenshotPath = path.join(__dirname, `error-screenshot-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Error screenshot saved to: ${screenshotPath}`);
    
  } finally {
    // Keep browser open for manual inspection if needed
    console.log('\n⏸️  Browser will remain open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

// Helper function to sanitize names for file paths
function sanitize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Run the customization
customizeOrderingPage().catch(console.error);