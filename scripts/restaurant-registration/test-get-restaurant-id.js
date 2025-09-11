#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const params = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  params[key.replace('--', '')] = value;
});

const TEST_DATA = {
  login: {
    email: params.email || process.env.TEST_EMAIL,
    password: params.password || process.env.TEST_PASSWORD
  },
  restaurant: {
    name: params.name || process.env.TEST_RESTAURANT_NAME
  }
};

// Validate required parameters
if (!TEST_DATA.login.email || !TEST_DATA.login.password || !TEST_DATA.restaurant.name) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<restaurant_name>');
  console.error('\nExample:');
  console.error('node test-get-restaurant-id.js --email=test@example.com --password=Password123! --name="Test Restaurant"');
  process.exit(1);
}

// Load environment variables
const LOGIN_URL = process.env.LOGIN_URL || 'https://admin.pumpd.co.nz/login';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const HEADLESS = process.env.HEADLESS !== 'false';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || './screenshots';

// Create screenshots directory if it doesn't exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Generate unique timestamp for screenshots
const timestamp = Date.now();

// Screenshot helper
async function takeScreenshot(page, name) {
  const filename = `test-restaurant-id-${name}-${timestamp}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${filepath}`);
}

async function getRestaurantId() {
  let browser;
  
  try {
    console.log('\n🚀 Starting Restaurant ID Extraction Test');
    console.log('================================');
    console.log(`📧 Email: ${TEST_DATA.login.email}`);
    console.log(`🏪 Restaurant: ${TEST_DATA.restaurant.name}`);
    console.log(`🔗 URL: ${LOGIN_URL}`);
    console.log(`🖥️  Mode: ${HEADLESS ? 'Headless' : 'Visible'}`);
    console.log('================================\n');
    
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    
    const page = await context.newPage();
    
    // STEP 1: Navigate to login page
    console.log('📍 STEP 1: Navigate to login page');
    await page.goto(LOGIN_URL);
    console.log('  ✓ Loaded login page');
    
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, '01-login-page');
    
    // STEP 2: Fill login credentials
    console.log('\n🔐 STEP 2: Fill login credentials');
    
    await page.fill('input[type="email"]', TEST_DATA.login.email);
    console.log('  ✓ Filled email');
    
    await page.fill('input[type="password"]', TEST_DATA.login.password);
    console.log('  ✓ Filled password');
    
    await takeScreenshot(page, '02-credentials-filled');
    
    // STEP 3: Submit login
    console.log('\n🚪 STEP 3: Submit login');
    
    try {
      // Try multiple selectors for the login button
      const loginButton = await page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]').first();
      await loginButton.click();
      console.log('  ✓ Clicked login button');
    } catch (error) {
      console.log('  ⚠️ Standard selectors failed, trying form submit button...');
      await page.locator('form button[type="submit"]').first().click();
      console.log('  ✓ Clicked form submit button');
    }
    
    // STEP 4: Wait for dashboard
    console.log('\n⏳ STEP 4: Waiting for dashboard...');
    
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
    
    await page.waitForLoadState('networkidle');
    console.log('  ⏳ Waiting for dashboard content to load...');
    
    // Wait longer for the dashboard to fully load and restaurants to appear
    await page.waitForTimeout(5000);
    
    // Try to wait for restaurant elements to appear
    try {
      await page.waitForSelector('h4', { timeout: 10000 });
      console.log('  ✓ Dashboard content loaded');
    } catch (error) {
      console.log('  ⚠️ No h4 elements found, continuing anyway...');
    }
    
    await takeScreenshot(page, '03-dashboard');
    
    // STEP 5: Find and click Manage button
    console.log('\n🏪 STEP 5: Find and click Manage button');
    console.log(`  🔍 Looking for restaurant: ${TEST_DATA.restaurant.name}`);
    
    // Wait a bit more for the list to fully render
    await page.waitForTimeout(2000);
    
    // Helper function for fuzzy restaurant name matching
    const normalizeForMatching = (str) => {
      return str
        .toLowerCase()                    // Case insensitive
        .replace(/['']/g, '')             // Remove apostrophes
        .replace(/\s+/g, ' ')             // Normalize spaces
        .trim();
    };
    
    // Function to calculate match score between search term and restaurant name
    const calculateMatchScore = (searchTerm, restaurantName) => {
      const searchNorm = normalizeForMatching(searchTerm);
      const nameNorm = normalizeForMatching(restaurantName);
      
      // Exact match (after normalization) - highest priority
      if (searchNorm === nameNorm) {
        return { score: 1000, reason: 'exact match' };
      }
      
      // Split into words for word-based matching
      const searchWords = searchNorm.split(' ').filter(w => w.length > 1); // Filter out single chars
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
        // Check for partial word match (e.g., "zaikaa" matches "ziakaa")
        else if (nameWords.some(nameWord => {
          // Use Levenshtein-like simple check: if words are similar length and share most characters
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
      const { score, reason } = calculateMatchScore(TEST_DATA.restaurant.name, allRestaurantNames[i]);
      
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
    } else {
      console.log(`  ❌ No matching restaurant found for "${TEST_DATA.restaurant.name}"`);
      console.log('  Available restaurants:');
      allRestaurantNames.forEach((name, index) => {
        console.log(`    ${index}: "${name}"`);
      });
    }
    
    if (restaurantIndex >= 0) {
      // Use the simple, reliable selector pattern with the found index
      const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
      
      // If the first selector doesn't work, try with view-store pattern
      if (await manageButton.count() === 0) {
        console.log('  ⚠️ Standard selector not found, trying view-store pattern...');
        // Try the view-store ID pattern
        const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
        if (await alternativeButton.count() > 0) {
          await alternativeButton.click();
          console.log(`  ✓ Clicked Manage button using view-store pattern`);
        } else {
          console.log('  ⚠️ View-store pattern not found, trying index-based fallback...');
          // Final fallback - just click the button at that index
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
        console.log(`  ✓ Clicked Manage button for ${TEST_DATA.restaurant.name}`);
      }
      
      // STEP 6: Wait for navigation and extract restaurant ID
      console.log('\n🆔 STEP 6: Extract restaurant ID');
      console.log('  ⏳ Waiting for restaurant management page to load...');
      
      try {
        // Wait for URL change to restaurant management
        await page.waitForURL('**/restaurant/**', { timeout: 15000 });
        console.log('  ✓ Navigated to restaurant page');
      } catch (error) {
        console.log('  ⚠️ Navigation timeout, checking current URL...');
      }
      
      // Add extra wait to ensure URL is fully loaded and stable
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle');
      
      // Get the current URL for debugging
      const restaurantUrl = page.url();
      console.log('  📍 Current URL:', restaurantUrl);
      
      await takeScreenshot(page, '04-restaurant-admin');
      
      // Extract restaurant ID from URL
      console.log('  🔍 Attempting to extract restaurant ID from URL...');
      
      // Try multiple regex patterns to match different possible formats
      let restaurantIdMatch = restaurantUrl.match(/restaurant\/(RES[A-Za-z0-9_-]+)/i);
      
      // If first pattern doesn't match, try a more generic pattern
      if (!restaurantIdMatch) {
        console.log('  ⚠️ Standard RES pattern did not match, trying generic pattern...');
        restaurantIdMatch = restaurantUrl.match(/restaurant\/([A-Za-z0-9_-]+)/);
      }
      
      if (restaurantIdMatch) {
        const restaurantId = restaurantIdMatch[1];
        console.log(`  ✓ Restaurant ID extracted: ${restaurantId}`);
        
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
        console.log('================================');
        console.log(`🏪 Restaurant: ${TEST_DATA.restaurant.name}`);
        console.log(`🆔 Restaurant ID: ${restaurantId}`);
        console.log(`🔗 Dashboard URL: ${restaurantUrl}`);
        console.log('================================\n');
        
        // Output for parsing
        console.log('RestaurantID:', restaurantId);
        
        // Success - close browser and exit
        if (!DEBUG_MODE) {
          await browser.close();
          console.log('✨ Browser closed');
        }
        
        return { success: true, restaurantId, url: restaurantUrl };
      } else {
        console.log('  ❌ Could not extract restaurant ID from URL');
        console.log('  URL format:', restaurantUrl);
        console.log('  Expected format: .../restaurant/RESxxxxx or .../restaurant/[id]');
        console.log('  Please check if the URL contains the restaurant ID in a different format');
        throw new Error(`Failed to extract restaurant ID from URL: ${restaurantUrl}`);
      }
    } else {
      throw new Error('Restaurant not found in list');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (browser) {
      const page = browser.contexts()[0]?.pages()[0];
      if (page) {
        await takeScreenshot(page, 'error-state');
        console.log('\nCurrent URL:', page.url());
        console.log('Page title:', await page.title());
      }
    }
    
    throw error;
    
  } finally {
    if (DEBUG_MODE) {
      console.log('\n⚠️ Debug mode - browser will remain open');
      console.log('Press Ctrl+C to exit...');
      await new Promise(() => {}); // Keep process alive
    } else if (browser) {
      await browser.close();
    }
  }
}

// Run the test
getRestaurantId()
  .then(result => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });