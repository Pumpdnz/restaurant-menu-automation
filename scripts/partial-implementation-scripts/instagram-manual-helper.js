#!/usr/bin/env node

/**
 * Instagram Manual Logo Extraction Helper
 * 
 * This script helps with manual extraction when Instagram blocks automation
 * It opens the profile and provides instructions for manual extraction
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import util from 'util';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

const instagramUrl = getArg('url');
const restaurantName = getArg('name') || 'restaurant';
const location = getArg('location') || 'unknown';

if (!instagramUrl) {
  console.error('❌ Error: Instagram URL is required');
  console.log('Usage: node instagram-manual-helper.js --url="https://instagram.com/username" --name="Restaurant Name" --location="City"');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function manualExtraction() {
  console.log('📸 Instagram Manual Logo Extraction Helper\n');
  console.log(`📍 Restaurant: ${restaurantName}`);
  console.log(`📱 Instagram: ${instagramUrl}`);
  console.log(`📍 Location: ${location}\n`);

  // Extract username
  const usernameMatch = instagramUrl.match(/instagram\.com\/([^\/\?]+)/);
  const username = usernameMatch ? usernameMatch[1] : null;
  
  // Create output directory
  const outputDir = path.join(
    '/Users/giannimunro/Desktop/cursor-projects',
    'automation/planning/downloaded-images',
    `${sanitize(restaurantName)}-${sanitize(location)}`
  );
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('📁 Output directory created:');
  console.log(`   ${outputDir}\n`);
  
  // Open Instagram in default browser
  const execPromise = util.promisify(exec);
  console.log('🌐 Opening Instagram profile in your default browser...\n');
  await execPromise(`open "${instagramUrl}"`);
  
  console.log('📝 MANUAL EXTRACTION INSTRUCTIONS:');
  console.log('════════════════════════════════════════════════\n');
  console.log('1. LOG IN to Instagram if required\n');
  console.log('2. FIND THE PROFILE PICTURE:');
  console.log('   - Look for the circular profile image');
  console.log('   - It\'s usually at the top-left of the profile\n');
  console.log('3. SAVE THE PROFILE PICTURE:');
  console.log('   - Right-click on the profile picture');
  console.log('   - Select "Open Image in New Tab"');
  console.log('   - In the new tab, right-click the image');
  console.log('   - Select "Save Image As..."');
  console.log('   - Save as: logo-from-instagram.jpg\n');
  console.log('4. SAVE TO THIS LOCATION:');
  console.log(`   ${outputDir}/\n`);
  console.log('5. IDENTIFY BRAND COLORS from the logo:');
  console.log('   - Note the main colors (3-4 colors)');
  console.log('   - Use a color picker tool if needed');
  console.log('   - Common tool: https://imagecolorpicker.com/\n');
  console.log('════════════════════════════════════════════════\n');
  
  // Create a template JSON file
  const templatePath = path.join(outputDir, 'instagram-brand-analysis.json');
  const template = {
    restaurant: restaurantName,
    location: location,
    instagramUrl: instagramUrl,
    username: username,
    extractedAt: new Date().toISOString(),
    method: 'manual',
    profilePicture: {
      found: false,
      saved: false,
      note: 'Update this after manually saving the image'
    },
    logoColors: [
      { hex: '#000000', name: 'Color 1', description: 'Update with actual color' },
      { hex: '#000000', name: 'Color 2', description: 'Update with actual color' },
      { hex: '#000000', name: 'Color 3', description: 'Update with actual color' }
    ],
    note: 'Please update the logoColors array with actual colors from the profile picture'
  };
  
  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
  console.log('📄 Template JSON created. Please update it with actual colors:');
  console.log(`   ${templatePath}\n`);
  
  console.log('✅ Setup complete! Follow the manual instructions above.');
  console.log('💡 Tip: The browser has been opened to the Instagram profile.');
}

// Run the helper
manualExtraction().catch(console.error);