#!/usr/bin/env node

/**
 * Simple logo downloader that doesn't hang
 * Uses curl as a subprocess instead of complex HTTP handling
 * No color analysis - manual inspection required
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Sanitize function to match other agents (lowercase with hyphens)
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const restaurantName = process.argv[2] || 'Restaurant Name';
const city = process.argv[3] || 'City';
const baseDir = process.argv[4] || path.join(__dirname, '../planning/downloaded-images');

const restaurantDir = path.join(baseDir, `${sanitize(restaurantName)}-${sanitize(city)}`);
const urlFile = path.join(restaurantDir, 'logo-url.txt');

// Check if URL file exists
if (!fs.existsSync(urlFile)) {
  console.error(`❌ No logo URL found at: ${urlFile}`);
  process.exit(1);
}

const logoUrl = fs.readFileSync(urlFile, 'utf8').trim();
console.log(`🔗 Logo URL: ${logoUrl}`);

// Download using curl (more reliable than Node's HTTP)
const logoPath = path.join(restaurantDir, 'logo-from-search.png');
console.log('📥 Downloading logo...');

try {
  // Use curl with timeout and follow redirects
  execSync(`curl -L --max-time 30 -o "${logoPath}" "${logoUrl}"`, { stdio: 'inherit' });
  
  // Check if file was created and has content
  const stats = fs.statSync(logoPath);
  if (stats.size === 0) {
    throw new Error('Downloaded file is empty');
  }
  
  console.log(`✅ Logo downloaded to: ${logoPath}`);
  console.log(`📦 File size: ${stats.size} bytes`);
  
  // Update metadata
  const metadataFile = path.join(restaurantDir, 'metadata.json');
  const metadata = fs.existsSync(metadataFile) 
    ? JSON.parse(fs.readFileSync(metadataFile, 'utf8'))
    : {};
  
  metadata.download = {
    url: logoUrl,
    path: logoPath,
    size: stats.size,
    downloadedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  console.log(`📝 Metadata updated: ${metadataFile}`);
  
} catch (error) {
  console.error('❌ Failed to download logo:', error.message);
  
  // Try wget as fallback
  console.log('🔄 Trying wget as fallback...');
  try {
    execSync(`wget --timeout=30 -O "${logoPath}" "${logoUrl}"`, { stdio: 'inherit' });
    console.log(`✅ Logo downloaded with wget`);
  } catch (wgetError) {
    console.error('❌ Both curl and wget failed');
    process.exit(1);
  }
}

console.log('\n✨ Download complete!');
console.log('📁 Logo saved to:', logoPath);
console.log('\n🎨 For color analysis:');
console.log('   Please manually inspect the logo and extract brand colors');