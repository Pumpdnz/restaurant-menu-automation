/**
 * Shared Browser Configuration for Playwright Scripts
 *
 * This module provides consistent browser launch configuration
 * that works both locally (with visible browser) and in production (headless).
 *
 * Usage in scripts:
 *   const { getBrowserConfig, createBrowser } = require('../lib/browser-config');
 *
 *   // Option 1: Get config and launch yourself
 *   const config = getBrowserConfig();
 *   const browser = await chromium.launch(config);
 *
 *   // Option 2: Use helper to create browser
 *   const browser = await createBrowser();
 *
 * IMPORTANT: Environment variables are read at RUNTIME (inside functions),
 * not at module load time. This allows dotenv to load .env files before
 * the values are checked.
 */

// Helper functions to read env vars at runtime (after dotenv has loaded)
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isHeadless() {
  return process.env.HEADLESS === 'true';
}

function isDebugMode() {
  return process.env.DEBUG_MODE === 'true';
}

/**
 * Get browser launch configuration based on environment
 * @param {Object} options - Override options
 * @returns {Object} Playwright launch configuration
 */
function getBrowserConfig(options = {}) {
  // Read env vars at runtime, not module load time
  const IS_PRODUCTION = isProduction();
  const FORCE_HEADLESS = isHeadless();
  const headless = IS_PRODUCTION || FORCE_HEADLESS;

  const baseConfig = {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',  // Important for Docker/containers
      '--disable-gpu',             // No GPU in cloud environments
    ],
  };

  // Add debug/development options
  if (!headless && !IS_PRODUCTION) {
    baseConfig.slowMo = options.slowMo || 100;
  }

  // Add single-process mode for containers to reduce memory
  if (IS_PRODUCTION) {
    baseConfig.args.push('--single-process');
  }

  // Log config for debugging
  if (isDebugMode()) {
    console.log(`[Browser Config] NODE_ENV=${process.env.NODE_ENV}, HEADLESS=${process.env.HEADLESS}, resolved headless=${headless}`);
  }

  return { ...baseConfig, ...options };
}

/**
 * Get browser context configuration
 * @param {Object} options - Override options
 * @returns {Object} Playwright context configuration
 */
function getContextConfig(options = {}) {
  return {
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    ...options,
  };
}

/**
 * Create a browser instance with production-ready configuration
 * @param {Object} chromium - Playwright chromium object
 * @param {Object} options - Override options
 * @returns {Promise<Browser>} Browser instance
 */
async function createBrowser(chromium, options = {}) {
  const config = getBrowserConfig(options);

  console.log(`[Browser] Launching in ${config.headless ? 'headless' : 'visible'} mode`);
  if (isProduction()) {
    console.log('[Browser] Production mode - optimized for containers');
  }

  return await chromium.launch(config);
}

/**
 * Create a browser context with standard configuration
 * @param {Browser} browser - Browser instance
 * @param {Object} options - Override options
 * @returns {Promise<BrowserContext>} Browser context
 */
async function createContext(browser, options = {}) {
  const config = getContextConfig(options);
  return await browser.newContext(config);
}

/**
 * Conditionally take a screenshot (disabled by default, must opt-in with ENABLE_SCREENSHOTS=true)
 * @param {Page} page - Playwright page
 * @param {string} name - Screenshot name
 * @param {string} directory - Directory to save screenshots
 * @returns {Promise<void>}
 */
async function takeScreenshot(page, name, directory = './screenshots') {
  const ENABLE_SCREENSHOTS = process.env.ENABLE_SCREENSHOTS === 'true';

  // Screenshots are disabled by default - must explicitly enable with ENABLE_SCREENSHOTS=true
  if (!ENABLE_SCREENSHOTS) {
    if (isDebugMode()) {
      console.log(`[Screenshot] Skipped: ${name} (screenshots disabled)`);
    }
    return null;
  }

  const fs = require('fs').promises;
  const path = require('path');

  const screenshotPath = path.join(directory, `${name}-${Date.now()}.png`);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[Screenshot] Saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error(`[Screenshot] Failed to save ${name}:`, error.message);
    return null;
  }
}

/**
 * Log environment info for debugging
 */
function logEnvironmentInfo() {
  console.log('[Environment]');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  IS_PRODUCTION: ${isProduction()}`);
  console.log(`  HEADLESS: ${isHeadless()}`);
  console.log(`  DEBUG_MODE: ${isDebugMode()}`);
  console.log(`  ENABLE_SCREENSHOTS: ${process.env.ENABLE_SCREENSHOTS || 'false'}`);
}

module.exports = {
  getBrowserConfig,
  getContextConfig,
  createBrowser,
  createContext,
  takeScreenshot,
  logEnvironmentInfo,
  // Export functions instead of constants for runtime evaluation
  isProduction,
  isHeadless,
  isDebugMode,
};