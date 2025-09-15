#!/usr/bin/env node

/**
 * Edit Website Settings - Light Theme Configuration
 * 
 * This script logs into the admin portal, navigates to Website settings,
 * configures light theme with custom colors, and adds code injections
 * 
 * Usage:
 *   node edit-website-settings-light.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --password=<password>     User password (required)
 *   --primary=<color>         Primary color hex code (required)
 *   --head=<path>             Path to head injection HTML file (required)
 *   --body=<path>             Path to body injection HTML file (required)
 *   --name=<text>             Restaurant name for matching (required)
 *   --logo=<path>             Path to logo image file (optional)
 *   --instagram=<url>         Instagram URL (optional)
 *   --facebook=<url>          Facebook URL (optional)
 *   --cuisine=<text>          Cuisine type (optional)
 *   --location=<text>         Restaurant location (optional)
 *   --address=<text>          Restaurant address (optional)
 *   --phone=<text>            Restaurant phone number (optional)
 *   --debug                   Enable debug mode (keeps browser open)
 * 
 * Environment Variables:
 *   DEBUG_MODE              Enable debug mode (true/false)
 * 
 * Example:
 *   node edit-website-settings-light.js --email="test@example.com" --password="Password123!" --name="Curry Garden" --primary="#A47F20" --head="../generated-code/restaurant/head-injection.html" --body="../generated-code/restaurant/body-injection.html"
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
const password = getArg('password'); // NEW: Accept password as argument
const primaryColor = getArg('primary');
const secondaryColor = getArg('secondary'); // Secondary color for light theme
const headPath = getArg('head');
const bodyPath = getArg('body');
const restaurantName = getArg('name');
const logoPath = getArg('logo');
const instagramUrl = getArg('instagram');
const facebookUrl = getArg('facebook');
const cuisine = getArg('cuisine');
const location = getArg('location');
const address = getArg('address');
const phoneNumber = getArg('phone');

// Validate required arguments
if (!email || !password || !primaryColor || !headPath || !bodyPath || !restaurantName) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<name> --primary=<color> --head=<path> --body=<path>');
  console.error('\nExample:');
  console.error('node edit-website-settings-dark.js --email="test@example.com" --password="Password123!" --name="Test Restaurant" --primary="#A47F20" --head="../generated-code/restaurant/head-injection.html" --body="../generated-code/restaurant/body-injection.html"');
  process.exit(1);
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `website-settings-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

async function editWebsiteSettingsLight() {
  console.log('🚀 Starting Light Theme Website Configuration...\n');
  
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
  console.log(`  Restaurant Name: ${restaurantName}`);
  console.log(`  Primary Color: ${primaryColor}`);
  console.log(`  Secondary Color: ${secondaryColor || '#FFFBF2 (default cream)'}`);
  console.log(`  Head file: ${headPath} (${headCode.length} chars)`);
  console.log(`  Body file: ${bodyPath} (${bodyCode.length} chars)`);
  if (logoPath) console.log(`  Logo: ${logoPath}`);
  if (instagramUrl) console.log(`  Instagram: ${instagramUrl}`);
  if (facebookUrl) console.log(`  Facebook: ${facebookUrl}`);
  if (cuisine) console.log(`  Cuisine: ${cuisine}`);
  if (location) console.log(`  Location: ${location}`);
  if (address) console.log(`  Address: ${address}`);
  if (phoneNumber) console.log(`  Phone: ${phoneNumber}`);
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
  
  // Track uploaded logo URL for output
  let uploadedLogoUrl = null;
  
  // Set up dialog handler to automatically accept theme change confirmation
  page.on('dialog', async dialog => {
    console.log('  📢 Dialog detected:', dialog.message());
    if (dialog.message().includes('Changing your theme will overwrite')) {
      console.log('  ✓ Accepting theme change confirmation');
      await dialog.accept();
    } else {
      await dialog.accept();
    }
  });
  
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
    
    // Wait for redirect with better error handling (like test-get-restaurant-id.js)
    console.log('  ⏳ Waiting for redirect...');
    try {
      await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
      console.log('  ✓ Successfully logged in!');
      console.log('  ✓ Redirected to dashboard');
    } catch (error) {
      const currentUrl = page.url();
      if (currentUrl.includes('admin.pumpd.co.nz')) {
        console.log('  ✓ Successfully logged in (already on dashboard)');
      } else {
        throw new Error('Login failed - not redirected to dashboard');
      }
    }
    
    // Improved waiting for dashboard content with timeout handling
    console.log('\n⏳ Waiting for dashboard...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (error) {
      console.log('  ⚠️ Network idle timeout, continuing anyway...');
    }
    console.log('  ✓ Reached dashboard:', page.url());
    
    // Wait for loading overlay to disappear (if present)
    try {
      await page.waitForFunction(() => {
        const loader = document.querySelector('.cover-loader');
        return !loader || !loader.classList.contains('active');
      }, { timeout: 5000 });
    } catch (error) {
      console.log('  ⚠️ Loading overlay check timed out, continuing...');
    }
    
    // Wait longer for dashboard content to fully load
    console.log('  ⏳ Waiting for dashboard content to load...');
    await page.waitForTimeout(5000);
    
    // Try to wait for restaurant elements to appear
    try {
      await page.waitForSelector('h4', { timeout: 8000 });
      console.log('  ✓ Dashboard content loaded');
    } catch (error) {
      console.log('  ⚠️ No h4 elements found, continuing anyway...');
    }
    
    await takeScreenshot(page, '02-dashboard');
    
    // STEP 2: Navigate to restaurant management with smart matching
    console.log('\n🏪 STEP 2: Navigate to restaurant management');
    console.log(`  🔍 Looking for restaurant: ${restaurantName}`);
    
    // Wait a bit for the list to fully render
    await page.waitForTimeout(2000);
    
    // Helper functions for smart matching
    const normalizeForMatching = (str) => {
      return str
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const calculateMatchScore = (searchTerm, restaurantNameInList) => {
      const searchNorm = normalizeForMatching(searchTerm);
      const nameNorm = normalizeForMatching(restaurantNameInList);
      
      // Exact match (after normalization) - highest priority
      if (searchNorm === nameNorm) {
        return { score: 1000, reason: 'exact match' };
      }
      
      // Split into words for word-based matching
      const searchWords = searchNorm.split(' ').filter(w => w.length > 1);
      const nameWords = nameNorm.split(' ');
      
      let score = 0;
      let matchedWords = 0;
      let reason = '';
      
      // Count how many search words are found in the restaurant name
      for (const searchWord of searchWords) {
        // Check for exact word match
        if (nameWords.includes(searchWord)) {
          score += 10;
          matchedWords++;
        }
        // Check for partial word match
        else if (nameWords.some(nameWord => {
          const lengthDiff = Math.abs(nameWord.length - searchWord.length);
          if (lengthDiff <= 2) {
            const commonChars = searchWord.split('').filter(char => nameWord.includes(char)).length;
            return commonChars >= Math.min(searchWord.length, nameWord.length) - 1;
          }
          return false;
        })) {
          score += 8;
          matchedWords++;
        }
        // Check for substring match
        else if (nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord))) {
          score += 5;
          matchedWords++;
        }
      }
      
      // Bonus for matching all words
      if (matchedWords === searchWords.length && searchWords.length > 0) {
        score += 50;
        reason = `all ${searchWords.length} words matched`;
      } else if (matchedWords > 0) {
        reason = `${matchedWords}/${searchWords.length} words matched`;
      }
      
      // Penalty for extra words in restaurant name (less specific match)
      const extraWords = nameWords.length - searchWords.length;
      if (extraWords > 0 && score > 0) {
        score -= extraWords * 2;
      }
      
      // If the full search term is contained in the restaurant name (substring match)
      if (score === 0 && nameNorm.includes(searchNorm)) {
        score = 25;
        reason = 'substring match';
      }
      
      return { score, reason };
    };
    
    // Try to find which index our restaurant is at by checking the h4 elements
    let restaurantIndex = -1;
    let bestScore = 0;
    let bestMatch = null;
    
    const allRestaurantNames = await page.locator('h4').allTextContents();
    
    console.log(`  ℹ️ Found ${allRestaurantNames.length} restaurants in the list`);
    console.log(`  📊 Evaluating restaurants for best match:`);
    
    for (let i = 0; i < allRestaurantNames.length; i++) {
      const { score, reason } = calculateMatchScore(restaurantName, allRestaurantNames[i]);
      
      if (score > 0) {
        console.log(`    ${i}: "${allRestaurantNames[i]}" - Score: ${score} (${reason})`);
        
        if (score > bestScore) {
          bestScore = score;
          restaurantIndex = i;
          bestMatch = { name: allRestaurantNames[i], reason };
        }
      }
    }
    
    if (restaurantIndex >= 0) {
      console.log(`  ✅ Best match: "${bestMatch.name}" at index ${restaurantIndex} (${bestMatch.reason})`);
      
      // Use the simple, reliable selector pattern with the found index
      const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
      
      // If the first selector doesn't work, try with view-store pattern
      if (await manageButton.count() === 0) {
        console.log('  ⚠️ Standard selector not found, trying view-store pattern...');
        const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
        if (await alternativeButton.count() > 0) {
          await alternativeButton.click();
          console.log(`  ✓ Clicked Manage button using view-store pattern`);
        } else {
          console.log('  ⚠️ View-store pattern not found, trying index-based fallback...');
          const allManageButtons = page.locator('button:has-text("Manage")');
          if (await allManageButtons.count() > restaurantIndex) {
            await allManageButtons.nth(restaurantIndex).click();
            console.log(`  ✓ Clicked Manage button at index ${restaurantIndex}`);
          } else {
            throw new Error('Could not find Manage button for restaurant');
          }
        }
      } else {
        await manageButton.click();
        console.log(`  ✓ Clicked Manage button for ${restaurantName}`);
      }
    } else {
      console.log(`  ❌ No matching restaurant found for "${restaurantName}"`);
      console.log('  Available restaurants:');
      allRestaurantNames.forEach((name, index) => {
        console.log(`    ${index}: "${name}"`);
      });
      throw new Error('Restaurant not found in list');
    }
    
    // Wait for navigation to complete and page to load
    console.log('  ⏳ Waiting for restaurant management page to load...');
    try {
      // Wait for URL change to restaurant management
      await page.waitForURL('**/restaurant/**', { timeout: 8000 });
      console.log('  ✓ Navigated to restaurant page');
    } catch (error) {
      console.log('  ⚠️ Navigation timeout, checking current URL...');
    }
    
    // Add extra wait to ensure URL is fully loaded and stable
    await page.waitForTimeout(3000);
    try {
      await page.waitForLoadState('networkidle', { timeout: 8000 });
    } catch (error) {
      console.log('  ⚠️ Network idle timeout after navigation, continuing...');
    }
    
    // Wait for the navigation menu to appear
    try {
      await page.waitForSelector('#nav-link-settings', { timeout: 8000 });
      console.log('  ✓ Navigation menu loaded');
    } catch (error) {
      console.log('  ⚠️ Settings link not found, continuing anyway...');
    }
    
    console.log('  ✓ Restaurant management page loaded');
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
        await page.waitForTimeout(1000);
      } else {
        // Fallback: Try button with Website text
        console.log('  Website text not found, trying button selector...');
        const websiteButton = page.locator('button:has-text("Website")').first();
        if (await websiteButton.count() > 0) {
          await websiteButton.click();
          console.log('  ✓ Clicked Website button');
          await page.waitForTimeout(1000);
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
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '05-website-settings');
    
    console.log('\n✅ Successfully navigated to Website Settings!');
    
    // STEP 5: Open Themes menu dropdown
    console.log('\n🎨 STEP 5: Opening Themes menu');
    
    const themesSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(2)';
    
    try {
      await page.locator(themesSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      console.log('  ✓ Scrolled to Themes section');
      
      await page.click(themesSelector);
      await page.waitForTimeout(1000);
      console.log('  ✓ Expanded Themes dropdown');
      
      await takeScreenshot(page, '05-themes-expanded');
    } catch (error) {
      console.log('  ⚠️ Using fallback selector for Themes section');
      const themesText = page.locator('div:has-text("Themes"):has(svg)').first();
      await themesText.scrollIntoViewIfNeeded();
      await themesText.click();
      await page.waitForTimeout(1000);
    }
    
    // STEP 6: Click Light Theme button
    console.log('\n☀️ STEP 6: Selecting Light Theme');
    
    // Light theme is typically the second button (index 2)
    const lightThemeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > div > div > div > div > button:nth-child(2)';
    
    try {
      await page.click(lightThemeSelector);
      console.log('  ✓ Clicked Light Theme button');
      
      // Wait for theme to apply (dialog will be handled automatically)
      await page.waitForTimeout(4000);
      console.log('  ✓ Light theme applied successfully');
      
      await takeScreenshot(page, '06-light-theme-applied');
    } catch (error) {
      console.log('  ⚠️ Using fallback selector for Light Theme');
      await page.click('button:has-text("Light Theme")');
      await page.waitForTimeout(4000);
    }
    
    // STEP 7: Open Colors menu dropdown
    console.log('\n🎨 STEP 7: Opening Colors menu');
    
    const colorsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(3)';
    
    try {
      await page.locator(colorsSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      console.log('  ✓ Scrolled to Colors section');
      
      await page.click(colorsSelector);
      await page.waitForTimeout(1000);
      console.log('  ✓ Expanded Colors dropdown');
      
      await takeScreenshot(page, '07-colors-expanded');
    } catch (error) {
      console.log('  ⚠️ Using fallback selector for Colors section');
      const colorsText = page.locator('div:has-text("Colors"):has(svg)').first();
      await colorsText.scrollIntoViewIfNeeded();
      await colorsText.click();
      await page.waitForTimeout(1000);
    }
    
    // STEP 8: Set all color configurations
    console.log('\n🎨 STEP 8: Setting Color Configurations');

    // Use secondary color or default cream for light theme backgrounds
    const lightBgColor = secondaryColor || '#FFFBF2';

    // Define selectors for each color field - IN REVERSE ORDER (bottom to top) to avoid picker overlap
    const colorFields = [
      {
        name: 'Box & Popup Text',
        pickerSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj',
        inputSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(6) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
        value: secondaryColor || primaryColor  // Use secondary if available, else primary
      },
      {
        name: 'Box & Popup Background',
        pickerSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj',
        inputSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
        value: '#FFFBF2'  // Cream background for boxes
      },
      {
        name: 'Text',
        pickerSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj',
        inputSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
        value: '#323232'  // Dark gray text for light mode
      },
      {
        name: 'Background',
        pickerSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj',
        inputSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
        value: '#FFFBF2'  // Cream background for light mode
      },
      {
        name: 'Primary Text',
        pickerSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj',
        inputSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
        value: '#FFFBF2'  // Cream text on primary
      },
      {
        name: 'Primary',
        pickerSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj',
        inputSelector: '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
        value: primaryColor
      }
    ];

    // Set each color (in reverse order to avoid picker overlap)
    for (const field of colorFields) {
      try {
        console.log(`  Setting ${field.name} color...`);

        // Click on color picker to open it
        await page.click(field.pickerSelector);
        await page.waitForTimeout(500);

        // Find and fill the color input - this clears existing value automatically
        await page.fill(field.inputSelector, field.value);
        console.log(`  ✓ Set ${field.name} to ${field.value}`);

        // Press escape to close the color picker before moving to next
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);

      } catch (error) {
        console.log(`  ⚠️ Failed to set ${field.name} color:`, error.message);
      }
    }

    await takeScreenshot(page, '08-colors-configured');
    
    // STEP 9: Save color changes
    console.log('\n💾 STEP 9: Saving color configuration');
    
    const saveColorSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
    
    try {
      await page.locator(saveColorSelector).scrollIntoViewIfNeeded();
      await page.click(saveColorSelector);
      console.log('  ✓ Clicked Save button for colors');
      await page.waitForTimeout(2000);
      
      await takeScreenshot(page, '09-colors-saved');
    } catch (error) {
      console.log('  ⚠️ Using fallback save button');
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(2000);
    }
    
    // STEP 10: Configure Fonts
    console.log('\n🔤 STEP 10: Configuring Fonts');
    
    const fontsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(4)';
    
    try {
      await page.locator(fontsSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      console.log('  ✓ Scrolled to Fonts section');
      
      await page.click(fontsSelector);
      await page.waitForTimeout(2000); // Wait for Google fonts to load
      console.log('  ✓ Expanded Fonts dropdown, Google fonts loading...');
      
      await takeScreenshot(page, '10-fonts-expanded');
    } catch (error) {
      console.log('  ⚠️ Using fallback selector for Fonts section');
      const fontsText = page.locator('div:has-text("Fonts"):has(svg)').first();
      await fontsText.scrollIntoViewIfNeeded();
      await fontsText.click();
      await page.waitForTimeout(2000);
    }
    
    // Set Heading Font to Gabarito
    console.log('  Setting Heading Font to Gabarito...');
    const headingFontSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__WrapperInner-iDIBDX.WOtfi';
    
    try {
      await page.click(headingFontSelector);
      await page.waitForTimeout(500);
      
      // Type "Gabarito" to filter the dropdown
      await page.keyboard.type('Gabarito');
      await page.waitForTimeout(1000);
      
      // Click the Gabarito option in dropdown
      const gabaritOption = page.locator('div.selectadv__Dropdown-eSUwYi div:has-text("Gabarito")').first();
      await gabaritOption.click();
      console.log('  ✓ Set Heading Font to Gabarito');
    } catch (error) {
      console.log('  ⚠️ Using alternative method for Heading Font');
      // Try clicking the input and typing
      const headingInput = page.locator(headingFontSelector + ' input').first();
      await headingInput.click();
      await headingInput.fill('Gabarito');
      await page.keyboard.press('Enter');
    }
    
    await page.waitForTimeout(1000);
    
    // Set Normal Font to Gabarito
    console.log('  Setting Normal Font to Gabarito...');
    const normalFontSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.selectadv__WrapperInner-iDIBDX.WOtfi';
    
    try {
      await page.click(normalFontSelector);
      await page.waitForTimeout(500);
      
      // Type "Gabarito" to filter the dropdown
      await page.keyboard.type('Gabarito');
      await page.waitForTimeout(1000);
      
      // Click the Gabarito option in dropdown
      const gabaritOption = page.locator('div.selectadv__Dropdown-eSUwYi div:has-text("Gabarito")').last();
      await gabaritOption.click();
      console.log('  ✓ Set Normal Font to Gabarito');
    } catch (error) {
      console.log('  ⚠️ Using alternative method for Normal Font');
      // Try clicking the input and typing
      const normalInput = page.locator(normalFontSelector + ' input').first();
      await normalInput.click();
      await normalInput.fill('Gabarito');
      await page.keyboard.press('Enter');
    }
    
    await page.waitForTimeout(1000);
    
    // Save Font configuration
    console.log('  Saving font configuration...');
    const saveFontSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
    
    try {
      await page.click(saveFontSelector);
      console.log('  ✓ Saved font configuration');
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '10-fonts-saved');
    } catch (error) {
      console.log('  ⚠️ Using fallback save button for fonts');
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(2000);
    }
    
    // STEP 11: Upload Logo (if provided)
    if (logoPath) {
      console.log('\n🖼️ STEP 11: Uploading Logo');
      
      const topNavSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(5)';
      
      try {
        await page.locator(topNavSelector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        console.log('  ✓ Scrolled to Top Nav Bar section');
        
        await page.click(topNavSelector);
        await page.waitForTimeout(1000);
        console.log('  ✓ Expanded Top Nav Bar dropdown');
        
        await takeScreenshot(page, '11-topnav-expanded');
      } catch (error) {
        console.log('  ⚠️ Using fallback selector for Top Nav Bar');
        const topNavText = page.locator('div:has-text("Top Nav Bar"):has(svg)').first();
        await topNavText.scrollIntoViewIfNeeded();
        await topNavText.click();
        await page.waitForTimeout(1000);
      }

      // First set nav bar colors
      console.log('  Setting Nav Bar colors...');

      // Always use cream for nav background in light theme
      const navBgColor = '#FFFBF2';

      // Set Nav Bar Background Color
      const navBgPickerSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj.grid-2.sm.sm-gap.max300 > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj';
      const navBgInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj.grid-2.sm.sm-gap.max300 > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input';

      try {
        await page.click(navBgPickerSelector);
        await page.waitForTimeout(500);
        await page.fill(navBgInputSelector, navBgColor);
        console.log(`  ✓ Set Nav Bar Background to ${navBgColor}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (error) {
        console.log('  ⚠️ Failed to set nav bar background color:', error.message);
      }

      // Set Nav Bar Text Color
      const navTextPickerSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj.grid-2.sm.sm-gap.max300 > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj > div';
      const navTextInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj.grid-2.sm.sm-gap.max300 > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input';

      try {
        await page.click(navTextPickerSelector);
        await page.waitForTimeout(500);
        const navTextColor = secondaryColor || primaryColor;  // Use secondary if available, else primary
        await page.fill(navTextInputSelector, navTextColor);
        console.log(`  ✓ Set Nav Bar Text to ${navTextColor}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (error) {
        console.log('  ⚠️ Failed to set nav bar text color:', error.message);
      }

      // Now Upload Logo
      console.log('  Uploading Logo...');
      const uploadLogoSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > button:nth-child(1)';

      try {
        await page.click(uploadLogoSelector);
        console.log('  ✓ Clicked Upload Logo button');
        await page.waitForTimeout(2000);
        
        // Handle Uploadcare file dialog
        const logoFilePath = path.resolve(logoPath);
        
        // Check if logo file exists
        try {
          await fs.access(logoFilePath);
          console.log(`  ✓ Logo file found: ${logoPath}`);
        } catch {
          console.log(`  ❌ Logo file not found: ${logoPath}`);
          // Close the upload dialog if open
          const closeButton = page.locator('.uploadcare--dialog button:has-text("Cancel"), .uploadcare--dialog [aria-label="Close"]').first();
          if (await closeButton.count() > 0) {
            await closeButton.click();
          }
        }
        
        // Handle Uploadcare widget
        console.log('  ℹ️ Handling Uploadcare widget...');
        
        // Wait for the Uploadcare dialog to fully load
        await page.waitForTimeout(2000);
        
        // Set up file chooser handler BEFORE clicking the button
        page.once('filechooser', async (fileChooser) => {
          await fileChooser.setFiles(logoFilePath);
          console.log(`  ✓ Logo selected via fileChooser: ${logoPath}`);
        });
        
        // Click on "Choose a local file" button to trigger the fileChooser
        const chooseFileButton = page.locator('button:has-text("Choose a local file")').first();
        if (await chooseFileButton.count() > 0) {
          await chooseFileButton.click();
          console.log('  ✓ Triggered file chooser');
          
          // Wait for upload to complete
          await page.waitForTimeout(5000);
          
          // Check if upload failed
          const errorMessage = page.locator('text="Something went wrong during the upload"').first();
          const tryAgainButton = page.locator('button:has-text("Please try again")').first();
          
          if (await errorMessage.count() > 0) {
            console.log('  ⚠️ Upload failed, retrying...');
            
            // Click try again if available
            if (await tryAgainButton.count() > 0) {
              await tryAgainButton.click();
              await page.waitForTimeout(2000);
              
              // Set up file chooser again
              page.once('filechooser', async (fileChooser) => {
                await fileChooser.setFiles(logoFilePath);
                console.log(`  ✓ Logo re-selected: ${logoPath}`);
              });
              
              // Try clicking Choose File again
              const retryChooseButton = page.locator('button:has-text("Choose a local file")').first();
              if (await retryChooseButton.count() > 0) {
                await retryChooseButton.click();
                console.log('  ✓ Retriggered file chooser');
                await page.waitForTimeout(5000);
              }
            }
          }
          
          // Wait for preview to appear (indicates successful upload)
          const previewImage = await page.locator('.uploadcare--preview__image, img[src*="ucarecdn.com"]').first();
          if (await previewImage.count() > 0) {
            console.log('  ✓ Upload successful, preview loaded');
            
            // Now click Add button to confirm
            const addButton = page.locator('.uploadcare--dialog button:has-text("Add")').first();
            if (await addButton.count() > 0) {
              await addButton.click();
              console.log('  ✓ Clicked Add button to confirm upload');
              await page.waitForTimeout(2000);
            } else {
              // Try alternative selectors for the confirmation button
              const doneButton = page.locator('.uploadcare--dialog button:has-text("Done")').first();
              if (await doneButton.count() > 0) {
                await doneButton.click();
                console.log('  ✓ Clicked Done button to confirm upload');
                await page.waitForTimeout(2000);
              }
            }
          } else {
            console.log('  ❌ Upload preview not found, may have failed');
            // Try to close dialog and continue
            const closeButton = page.locator('.uploadcare--dialog [aria-label="Close"], .uploadcare--dialog button:has-text("Cancel")').first();
            if (await closeButton.count() > 0) {
              await closeButton.click();
              console.log('  ℹ️ Closed upload dialog');
            }
          }
        } else {
          console.log('  ❌ Could not find upload mechanism');
        }
        
        // Extract the uploaded logo URL
        console.log('  📎 Extracting uploaded logo URL...');
        try {
          const logoImgSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > a > img';
          
          // Wait for the logo preview to be visible
          await page.waitForSelector(logoImgSelector, { timeout: 3000 });
          
          // Extract the src attribute
          const logoUrl = await page.locator(logoImgSelector).getAttribute('src');
          
          if (logoUrl) {
            console.log(`  📌 Uploaded Logo URL: ${logoUrl}`);
            uploadedLogoUrl = logoUrl; // Store for output
          } else {
            console.log('  ⚠️ Could not extract logo URL');
          }
        } catch (error) {
          console.log('  ⚠️ Failed to extract logo URL:', error.message);
        }
        
        // Save logo configuration
        const saveLogoSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
        await page.click(saveLogoSelector);
        console.log('  ✓ Saved logo configuration');
        await page.waitForTimeout(2000);
        
        await takeScreenshot(page, '11-logo-saved');
      } catch (error) {
        console.error('  ❌ Failed to upload logo:', error.message);
      }
    } else {
      console.log('\n📋 STEP 11: Skipping logo upload (no logo provided)');
    }
    
    // STEP 12: Upload Favicon (use same logo)
    if (logoPath) {
      console.log('\n🔖 STEP 12: Uploading Favicon');
      
      const faviconSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(15)';
      
      try {
        await page.locator(faviconSelector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        console.log('  ✓ Scrolled to Favicon section');
        
        await page.click(faviconSelector);
        await page.waitForTimeout(1000);
        console.log('  ✓ Expanded Favicon dropdown');
        
        // Click Upload button
        const uploadFaviconSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div > div > div > div > button:nth-child(1)';
        await page.click(uploadFaviconSelector);
        console.log('  ✓ Clicked Upload Favicon button');
        await page.waitForTimeout(2000);
        
        // Handle Uploadcare widget (same as logo)
        const logoFilePath = path.resolve(logoPath);
        
        // Set up file chooser handler
        page.once('filechooser', async (fileChooser) => {
          await fileChooser.setFiles(logoFilePath);
          console.log('  ✓ Favicon selected via fileChooser');
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
              console.log('  ✓ Confirmed favicon upload');
              await page.waitForTimeout(2000);
            }
          }
        }
        
        // Save favicon
        const saveFaviconButton = page.locator('button:has-text("Save")').first();
        await saveFaviconButton.click();
        console.log('  ✓ Saved favicon configuration');
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.error('  ❌ Failed to upload favicon:', error.message);
      }
    } else {
      console.log('\n📋 STEP 12: Skipping favicon upload (no logo provided)');
    }
    
    // STEP 13: Configure SEO Settings
    console.log('\n🔍 STEP 13: Configuring SEO Settings');
    
    const seoSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(16)';
    
    try {
      await page.locator(seoSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      console.log('  ✓ Scrolled to SEO section');
      
      await page.click(seoSelector);
      await page.waitForTimeout(1000);
      console.log('  ✓ Expanded SEO dropdown');
      
      // Set Store Page Title
      const titleInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj input';
      const titleInput = page.locator(titleInputSelector).first();
      await titleInput.click();
      await titleInput.clear();
      
      // Use the restaurant name passed as argument
      const seoTitle = `${restaurantName} ${location || ''} - Order Online for Delivery or Pickup`.trim();
      await titleInput.fill(seoTitle);
      console.log(`  ✓ Set page title: ${seoTitle}`);
      
      // Set Store Page Meta Description
      const metaInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj input';
      const metaInput = page.locator(metaInputSelector).first();
      await metaInput.click();
      await metaInput.clear();
      
      // Create meta description with address, phone, cuisine and location
      let metaDescription = '';
      if (address) metaDescription += `${address} `;
      if (phoneNumber) metaDescription += `${phoneNumber} - `;
      metaDescription += `Best ${cuisine || 'Food'} in ${location || 'Town'}`;
      
      await metaInput.fill(metaDescription);
      console.log(`  ✓ Set meta description: ${metaDescription}`);
      
      // Save SEO settings
      const saveSeoSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
      await page.click(saveSeoSelector);
      console.log('  ✓ Saved SEO configuration');
      await page.waitForTimeout(2000);
      
      await takeScreenshot(page, '13-seo-saved');
    } catch (error) {
      console.error('  ❌ Failed to configure SEO:', error.message);
    }
    
    // STEP 14: Configure Social Media Links (if provided)
    if (instagramUrl || facebookUrl) {
      console.log('\n📱 STEP 14: Configuring Social Media Links');
      
      const socialSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(17)';
      
      try {
        await page.locator(socialSelector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        console.log('  ✓ Scrolled to Social Media section');
        
        await page.click(socialSelector);
        await page.waitForTimeout(1000);
        console.log('  ✓ Expanded Social Media dropdown');
        
        // Add Facebook URL if provided
        if (facebookUrl) {
          const fbInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj input';
          const fbInput = page.locator(fbInputSelector).first();
          await fbInput.click();
          await fbInput.clear();
          
          // Ensure URL has https:// prefix
          const fbUrlWithProtocol = facebookUrl.startsWith('http') ? facebookUrl : `https://${facebookUrl}`;
          await fbInput.fill(fbUrlWithProtocol);
          console.log(`  ✓ Set Facebook URL: ${fbUrlWithProtocol}`);
        }
        
        // Add Instagram URL if provided
        if (instagramUrl) {
          const igInputSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj input';
          const igInput = page.locator(igInputSelector).first();
          await igInput.click();
          await igInput.clear();
          
          // Ensure URL has https:// prefix
          const igUrlWithProtocol = instagramUrl.startsWith('http') ? instagramUrl : `https://${instagramUrl}`;
          await igInput.fill(igUrlWithProtocol);
          console.log(`  ✓ Set Instagram URL: ${igUrlWithProtocol}`);
        }
        
        // Save social media settings
        const saveSocialSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
        await page.click(saveSocialSelector);
        console.log('  ✓ Saved social media configuration');
        await page.waitForTimeout(2000);
        
        await takeScreenshot(page, '14-social-saved');
      } catch (error) {
        console.error('  ❌ Failed to configure social media:', error.message);
      }
    } else {
      console.log('\n📋 STEP 14: Skipping social media (no URLs provided)');
    }
    
    // STEP 15: Scroll to Custom Code section and open it
    console.log('\n📝 STEP 15: Opening Custom Code section');
    
    const customCodeSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(18)';
    
    try {
      await page.locator(customCodeSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      console.log('  ✓ Scrolled to Custom Code section');
      
      await page.click(customCodeSelector);
      await page.waitForTimeout(1500);
      console.log('  ✓ Expanded Custom Code dropdown');
      
      await takeScreenshot(page, '15-custom-code-expanded');
    } catch (error) {
      console.log('  ⚠️ Using fallback selector for Custom Code section');
      const customCodeText = page.locator('div:has-text("Custom Code"):has(svg)').first();
      await customCodeText.scrollIntoViewIfNeeded();
      await customCodeText.click();
      await page.waitForTimeout(1500);
    }
    
    // STEP 16: Add Head Code
    console.log('\n🔖 STEP 16: Adding Head Code Injection');
    
    try {
      const headerTextarea = page.locator('textarea').first();
      await headerTextarea.click();
      await headerTextarea.clear();
      await headerTextarea.fill(headCode);
      console.log('  ✓ Head code injection added');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error('  ❌ Failed to add head code:', error.message);
    }
    
    // STEP 17: Add Body Code
    console.log('\n🔖 STEP 17: Adding Body Code Injection');
    
    try {
      const footerTextarea = page.locator('textarea').nth(1);
      await footerTextarea.click();
      await footerTextarea.clear();
      await footerTextarea.fill(bodyCode);
      console.log('  ✓ Body code injection added');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error('  ❌ Failed to add body code:', error.message);
    }
    
    // STEP 18: Save code injection changes
    console.log('\n💾 STEP 18: Saving code injection changes');
    
    try {
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();
      console.log('  ✓ Clicked Save button');
      
      await page.waitForTimeout(3000);
      
      const successMessage = page.locator('text=/success|saved|updated/i');
      if (await successMessage.count() > 0) {
        console.log('  ✓ Changes saved successfully!');
      }
    } catch (error) {
      console.error('  ❌ Failed to save changes:', error.message);
    }
    
    await takeScreenshot(page, '18-final-state');
    
    console.log('\n✅ Light theme configuration completed successfully!');
    console.log(`Primary Color: ${primaryColor}`);
    console.log(`Head code: ${headCode.length} characters`);
    console.log(`Body code: ${bodyCode.length} characters`);
    
    // Output result data in JSON format for API parsing
    if (uploadedLogoUrl) {
      console.log('\n===RESULT_DATA_START===');
      console.log(JSON.stringify({
        success: true,
        uploadedLogoUrl: uploadedLogoUrl
      }));
      console.log('===RESULT_DATA_END===');
    }
    
    // STEP 19: Wait for changes to save then view the store
    console.log('\n👀 STEP 19: Viewing the store with applied changes');
    console.log('  ⏳ Waiting 8 seconds for changes to fully save...');
    await page.waitForTimeout(8000);
    
    try {
      // Click the View Store button in navigation
      const viewStoreSelector = '#nav-link-view-store';
      
      // Wait for and click the View Store link
      await page.waitForSelector(viewStoreSelector, { timeout: 5000 });
      
      // Get the current context to handle new tabs
      const context = page.context();
      
      // Listen for new page/tab
      const newPagePromise = context.waitForEvent('page');
      
      // Click the View Store link which opens in new tab
      await page.click(viewStoreSelector);
      console.log('  ✓ Clicked View Store button');
      
      // Wait for the new page to open
      const newPage = await newPagePromise;
      console.log('  ✓ New tab opened');
      
      // Wait for the new page to load
      try {
        await newPage.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (error) {
        console.log('  ⚠️ Store page network idle timeout, continuing...');
      }
      await newPage.waitForTimeout(3000); // Extra wait for dynamic content
      
      // Get the final URL
      const finalUrl = newPage.url();
      console.log(`  📍 Store URL: ${finalUrl}`);
      
      // Take screenshot of the store page
      await takeScreenshot(newPage, '19-store-view');
      console.log('  ✓ Store page screenshot captured');
      
      // Close the store tab
      await newPage.close();
      console.log('  ✓ Store tab closed');
      
    } catch (error) {
      console.error('  ❌ Failed to view store:', error.message);
      // Continue anyway - not critical to the configuration
    }
    
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
editWebsiteSettingsLight().catch(console.error);