#!/usr/bin/env node

/**
 * Menu Image Upload Script for admin.pumpd.co.nz
 * 
 * This script uploads images to menu items after CSV import
 * It reads the image mapping file and uploads images to corresponding menu items
 * Uses admin password from environment or default
 * 
 * Usage:
 *   node upload-menu-images.js [options]
 * 
 * Options:
 *   --email=<email>           Login email (required)
 *   --imageMapping=<path>     Path to image-mapping.json file (required)
 *   --imagesDir=<path>        Path to images directory (required)
 *   --maxUploads=<number>     Maximum number of images to upload (optional, default: all)
 * 
 * Example:
 *   node upload-menu-images.js --email="test@example.com" \
 *     --imageMapping="/path/to/image-mapping.json" --imagesDir="/path/to/images"
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const LOGIN_URL = "https://admin.pumpd.co.nz/login";
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || false;

// Get parameters from command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse arguments
const email = getArg('email');
const imageMappingPath = getArg('imageMapping') || '/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/downloads/extracted-images/currygarden-wellington/image-mapping.json';
const imagesDir = getArg('imagesDir') || '/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/downloads/extracted-images/currygarden-wellington';
const maxUploads = parseInt(getArg('maxUploads')) || 0; // 0 means all

// Use admin password from environment
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email) {
  console.error('❌ Error: Email is required');
  console.error('Usage: node upload-menu-images.js --email="email@example.com"');
  process.exit(1);
}


// Group items by category
function groupByCategory(items) {
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.categoryName]) {
      grouped[item.categoryName] = [];
    }
    grouped[item.categoryName].push(item);
  });
  return grouped;
}

// Utility function for screenshots
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `image-upload-${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

// Main upload function
async function uploadMenuImages() {
  console.log('🚀 Starting Menu Image Upload Process...\n');
  
  // Load full image mapping
  const mappingContent = await fs.readFile(imageMappingPath, 'utf-8');
  const imageMapping = JSON.parse(mappingContent);
  
  // Filter items with images
  const itemsWithImages = imageMapping.items.filter(item => 
    item.status === 'success' && item.localPath
  );
  
  console.log(`📊 Found ${itemsWithImages.length} items with images out of ${imageMapping.items.length} total items`);
  
  if (itemsWithImages.length === 0) {
    console.log('❌ No images to upload');
    process.exit(0);
  }
  
  // Group by category for efficient processing
  const categorizedItems = groupByCategory(itemsWithImages);
  const categories = Object.keys(categorizedItems);
  
  console.log(`📂 Categories with images: ${categories.length}`);
  categories.forEach(cat => {
    console.log(`  - ${cat}: ${categorizedItems[cat].length} items`);
  });
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
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    console.log('  ✓ Credentials entered');
    
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    console.log('  ✓ Clicked login');
    
    await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
    console.log('  ✓ Login successful');
    
    await page.waitForTimeout(2000);
    
    // STEP 2: Navigate to restaurant management
    console.log('\n🏪 STEP 2: Navigate to restaurant management');
    
    const manageButton = page.locator('#restaurant-list-item-0 button:has-text("Manage")').first();
    await manageButton.click();
    console.log('  ✓ Clicked Manage button');
    
    // Wait for the page to load
    await page.waitForTimeout(5000);
    console.log('  ⏳ Page loading...');
    
    // STEP 3: Navigate to Menu section
    console.log('\n📋 STEP 3: Navigate to Menu section');
    
    // Wait for the navigation menu to be fully loaded (same as CSV import script)
    console.log('  ⏳ Waiting for navigation menu to load...');
    await page.waitForSelector('#nav-link-menus', { state: 'visible', timeout: 30000 });
    
    // Additional wait to ensure the page is interactive
    await page.waitForTimeout(3000);
    
    // Click the menu navigation link (same selector that worked in CSV import)
    await page.click('#nav-link-menus');
    console.log('  ✓ Clicked Menu navigation');
    
    // Wait for menu page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // STEP 4: Open the menu to view categories and items
    console.log('\n📂 STEP 4: Opening menu to view items...');
    
    // Click on the menu dropdown to expand it using consistent class selector
    try {
      // Use the consistent class selector across ordering pages
      await page.click('.item__Wrapper-kdLbfs.list-item');
      console.log('  ✓ Clicked on menu dropdown to expand it');
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log('  ⚠️ Error opening menu:', error.message);
      // Try alternative selector with just the first part of the class
      try {
        const menuElement = page.locator('[class*="item__Wrapper-kdLbfs"]').first();
        await menuElement.click();
        console.log('  ✓ Clicked on menu element (fallback)');
        await page.waitForTimeout(3000);
      } catch (fallbackError) {
        console.log('  ❌ Could not open menu dropdown');
        throw new Error('Failed to open menu dropdown');
      }
    }
    
    // Take screenshot to see the opened menu
    await takeScreenshot(page, 'menu-opened');
    
    // Wait for menu categories to load
    await page.waitForTimeout(2000);
    
    // STEP 5: Process each category
    console.log('\n🖼️ STEP 5: Starting image uploads...\n');
    
    let totalUploaded = 0;
    const uploadLimit = maxUploads > 0 ? maxUploads : itemsWithImages.length;
    let expandedCategories = 0; // Track how many categories we've expanded
    
    // Get ALL categories in the menu (not just ones with images) to track unexpanded ones
    const allCategories = [...new Set(imageMapping.items.map(item => item.categoryName))];
    console.log(`Total categories in menu: ${allCategories.length}`);
    
    for (const categoryName of categories) {
      if (totalUploaded >= uploadLimit) {
        console.log(`\n⚠️ Reached upload limit of ${uploadLimit} images`);
        break;
      }
      
      console.log(`\n📂 Processing category: ${categoryName}`);
      const items = categorizedItems[categoryName];
      
      // Find and click the category to expand it
      try {
        // Use simple text selector like in our test
        await page.click(`text="${categoryName}"`);
        console.log(`  ✓ Clicked to expand category: ${categoryName}`);
        await page.waitForTimeout(3000);
        expandedCategories++;
        
        // Take a screenshot after expanding category
        await takeScreenshot(page, `category-expanded-${categoryName.replace(/\s+/g, '_')}`);
        
        // Process items in this category
        for (const item of items) {
          if (totalUploaded >= uploadLimit) break;
          
          // Find the actual position of this item in the FULL category list (not just items with images)
          const allCategoryItems = imageMapping.items.filter(i => i.categoryName === categoryName);
          const actualPosition = allCategoryItems.findIndex(i => i.dishName === item.dishName);
          
          console.log(`\n  📝 Processing: ${item.dishName} (actual position ${actualPosition} in category)`);
          
          try {
            // Wait for items to render after category expansion
            await page.waitForTimeout(1000);
            
            // Calculate the edit button index
            const allEditButtons = await page.locator('button:has(svg path[d*="M402.6"])').count();
            console.log(`    Total edit buttons on page: ${allEditButtons}`);
            
            // Calculate index accounting for ALL visible categories (expanded or not)
            let editButtonIndex;
            if (expandedCategories === 1) {
              // First category - use simple formula: 1 menu + 1 category + 1 for 1-indexing + position
              editButtonIndex = 3 + actualPosition;
            } else {
              // Count ALL categories that appear before this one (expanded or not)
              const categoriesBeforeCurrent = allCategories.slice(0, allCategories.indexOf(categoryName));
              const visibleCategoriesBeforeCurrent = categoriesBeforeCurrent.length;
              
              // Count items in previously EXPANDED categories only
              let previousItemsCount = 0;
              const expandedCategoriesBeforeCurrent = categories.slice(0, categories.indexOf(categoryName));
              for (const prevCat of expandedCategoriesBeforeCurrent) {
                previousItemsCount += imageMapping.items.filter(i => i.categoryName === prevCat).length;
              }
              
              // Formula: 1 (menu) + visibleCategoriesBeforeCurrent + 1 (current category) + previousItemsCount + actualPosition + 1 (for 1-indexing)
              editButtonIndex = 1 + visibleCategoriesBeforeCurrent + 1 + previousItemsCount + actualPosition + 1;
              
              console.log(`    Categories before current: ${visibleCategoriesBeforeCurrent}, Items in expanded: ${previousItemsCount}`);
            }
            
            console.log(`    Using nth-match selector with index ${editButtonIndex}`);
            
            // Use nth-match to click the specific edit button
            const targetEditButton = page.locator(
              `:nth-match(button:has(svg path[d*="M402.6"]), ${editButtonIndex})`
            );
            
            if (await targetEditButton.count() > 0) {
              // Click the edit button (pencil icon)
              await targetEditButton.click();
              console.log(`    ✓ Clicked edit button for: ${item.dishName}`);
            } else {
              console.log(`    ⚠️ Edit button not found at index ${editButtonIndex} for: ${item.dishName}`);
              continue;
            }
            
            await page.waitForTimeout(2000);
            
            // Verify the correct dialog opened
            const itemDetailsTab = page.locator('text="Item Details"');
            const imageTagsTab = page.locator('text="Image & Tags"');
            
            if (await itemDetailsTab.count() === 0 && await imageTagsTab.count() === 0) {
              console.log('    ⚠️ Edit dialog did not open correctly');
              
              // Check if wrong dialog opened
              if (await page.locator('text="Delete menu"').count() > 0 || 
                  await page.locator('text="Are you sure you want to delete"').count() > 0) {
                console.log('    ℹ️ Delete dialog opened instead - closing');
                await page.keyboard.press('Escape');
              } else if (await page.locator('text="Edit Menu"').count() > 0 || 
                         await page.locator('text="Edit Category"').count() > 0) {
                console.log('    ℹ️ Menu/Category edit dialog opened instead - closing');
                await page.keyboard.press('Escape');
              }
              
              await page.waitForTimeout(1000);
              continue;
            }
            
            console.log('    ✓ Edit dialog opened successfully');
            
            // Click Image & Tags tab
            const imageTabButton = page.locator('text="Image & Tags"').first();
            await imageTabButton.click();
            console.log('    ✓ Clicked Image & Tags tab');
            await page.waitForTimeout(1000);
            
            // Click Upload button
            const uploadButton = page.locator('button:has-text("Upload")').first();
            await uploadButton.click();
            console.log('    ✓ Clicked Upload button');
            await page.waitForTimeout(2000);
            
            // Handle Uploadcare file dialog
            // Construct full image path
            const imagePath = path.join(imagesDir, item.localPath);
            
            // Check if image file exists
            try {
              await fs.access(imagePath);
            } catch {
              console.log(`    ❌ Image file not found: ${imagePath}`);
              // Close the upload dialog
              const closeButton = page.locator('.uploadcare--dialog button:has-text("Cancel"), .uploadcare--dialog [aria-label="Close"]').first();
              if (await closeButton.count() > 0) {
                await closeButton.click();
              }
              continue;
            }
            
            // Handle Uploadcare widget - DON'T click the button, just set the file directly
            console.log('    ℹ️ Handling Uploadcare widget...');
            
            // Method 1: Direct file input (hidden but accessible)
            const fileInput = await page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
              // Set the file directly on the hidden input without clicking anything
              await fileInput.setInputFiles(imagePath);
              console.log(`    ✓ Image file set: ${item.localPath}`);
              
              // Wait for Uploadcare to process the upload
              await page.waitForTimeout(5000);
              
              // The upload should complete automatically
              // Check if preview appears or if we need to confirm
              const previewImage = page.locator('.uploadcare--preview__image, img[src*="ucarecdn.com"]').first();
              if (await previewImage.count() > 0) {
                console.log('    ✓ Image preview loaded');
              }
              
              // Look for Add/Done button if dialog is still open
              const confirmButton = page.locator('button').filter({ hasText: /^(Add|Done|Upload)$/i }).first();
              if (await confirmButton.count() > 0) {
                await confirmButton.click();
                console.log('    ✓ Confirmed image selection');
                await page.waitForTimeout(2000);
              }
            } else {
              // Method 2: Use fileChooser event if direct input doesn't work
              console.log('    ⚠️ No file input found, trying fileChooser method...');
              
              // Set up file chooser handler
              page.once('filechooser', async (fileChooser) => {
                await fileChooser.setFiles(imagePath);
                console.log(`    ✓ Image selected via fileChooser: ${item.localPath}`);
              });
              
              // Click the Choose File button to trigger the fileChooser
              const chooseFileButton = page.locator('button:has-text("Choose a local file")').first();
              if (await chooseFileButton.count() > 0) {
                await chooseFileButton.click();
                console.log('    ✓ Triggered file chooser');
                
                // Wait longer for upload to complete and check for errors
                await page.waitForTimeout(8000);
                
                // Check if upload failed
                const errorMessage = page.locator('text="Something went wrong during the upload"').first();
                const tryAgainButton = page.locator('button:has-text("Please try again")').first();
                
                if (await errorMessage.count() > 0) {
                  console.log('    ⚠️ Upload failed, retrying...');
                  
                  // Click try again if available
                  if (await tryAgainButton.count() > 0) {
                    await tryAgainButton.click();
                    await page.waitForTimeout(2000);
                    
                    // Set up file chooser again
                    page.once('filechooser', async (fileChooser) => {
                      await fileChooser.setFiles(imagePath);
                      console.log(`    ✓ Image re-selected: ${item.localPath}`);
                    });
                    
                    // Try clicking Choose File again
                    const retryChooseButton = page.locator('button:has-text("Choose a local file")').first();
                    if (await retryChooseButton.count() > 0) {
                      await retryChooseButton.click();
                      console.log('    ✓ Retriggered file chooser');
                      await page.waitForTimeout(8000);
                    }
                  }
                }
                
                // Wait for preview to appear (indicates successful upload)
                const previewImage = await page.locator('.uploadcare--preview__image, img[src*="ucarecdn.com"]').first();
                if (await previewImage.count() > 0) {
                  console.log('    ✓ Upload successful, preview loaded');
                  
                  // Now click Add button to confirm
                  const addButton = page.locator('.uploadcare--dialog button:has-text("Add")').first();
                  if (await addButton.count() > 0) {
                    await addButton.click();
                    console.log('    ✓ Clicked Add button to confirm upload');
                    await page.waitForTimeout(2000);
                  } else {
                    // Try alternative selectors for the confirmation button
                    const doneButton = page.locator('.uploadcare--dialog button:has-text("Done")').first();
                    if (await doneButton.count() > 0) {
                      await doneButton.click();
                      console.log('    ✓ Clicked Done button to confirm upload');
                      await page.waitForTimeout(2000);
                    }
                  }
                } else {
                  console.log('    ❌ Upload preview not found, may have failed');
                  // Try to close dialog and continue
                  const closeButton = page.locator('.uploadcare--dialog [aria-label="Close"], .uploadcare--dialog button:has-text("Cancel")').first();
                  if (await closeButton.count() > 0) {
                    await closeButton.click();
                    console.log('    ℹ️ Closed upload dialog');
                  }
                  continue;
                }
              } else {
                console.log('    ❌ Could not find upload mechanism');
                continue;
              }
            }
            
            // Save the changes
            const saveButton = page.locator('button:has-text("Save")').first();
            await saveButton.click();
            console.log('    ✓ Saved changes');
            await page.waitForTimeout(2000);
            
            totalUploaded++;
            console.log(`    ✅ Image uploaded successfully (${totalUploaded}/${uploadLimit})`);
            
          } catch (itemError) {
            console.log(`    ❌ Failed to upload image for ${item.dishName}:`, itemError.message);
            await takeScreenshot(page, `error-${item.dishName.replace(/\s+/g, '_')}`);
          }
        }
        
      } catch (categoryError) {
        console.log(`  ❌ Failed to process category ${categoryName}:`, categoryError.message);
        await takeScreenshot(page, `error-category-${categoryName.replace(/\s+/g, '_')}`);
      }
    }
    
    console.log('\n✅ IMAGE UPLOAD PROCESS COMPLETED!');
    console.log(`Total images uploaded: ${totalUploaded}`);
    
  } catch (error) {
    console.error('\n❌ Upload process failed:', error.message);
    await takeScreenshot(page, 'error-state');
    
  } finally {
    if (DEBUG_MODE) {
      console.log('\n🐛 Browser left open for inspection');
      console.log('Press Ctrl+C to exit');
      await new Promise(() => {}); // Keep alive
    } else {
      await browser.close();
      console.log('\n✨ Browser closed');
    }
  }
}

// Run the upload
uploadMenuImages();