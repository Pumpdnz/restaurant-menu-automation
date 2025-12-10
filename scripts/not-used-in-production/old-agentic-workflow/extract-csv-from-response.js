#!/usr/bin/env node

/**
 * Helper script to extract CSV data from the generate-clean-csv endpoint response
 * Handles control characters and special encoding issues that break jq
 * 
 * Usage: node extract-csv-from-response.js <response.json> <output_dir>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Extract CSV from Response');
    console.log('==========================');
    console.log('\nUsage: node extract-csv-from-response.js <response.json> [output_dir]');
    console.log('\nThis script extracts CSV data from the generate-clean-csv endpoint response');
    console.log('It handles control characters and encoding issues that break jq');
    console.log('\nExample:');
    console.log('  node extract-csv-from-response.js response.json ../extracted-menus/');
    process.exit(1);
  }
  
  const responsePath = path.resolve(args[0]);
  const outputDir = args[1] ? path.resolve(args[1]) : path.dirname(responsePath);
  
  if (!fs.existsSync(responsePath)) {
    console.error(`❌ Error: Response file not found: ${responsePath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    console.log(`📂 Reading response from: ${responsePath}`);
    
    // Read and parse JSON (handles control characters better than jq)
    const responseContent = fs.readFileSync(responsePath, 'utf8');
    const data = JSON.parse(responseContent);
    
    if (!data.success) {
      console.error(`❌ Error: API returned error: ${data.error}`);
      process.exit(1);
    }
    
    if (!data.csvDataWithImages || !data.csvDataNoImages) {
      console.error('❌ Error: Response missing CSV data fields');
      console.error('Available fields:', Object.keys(data));
      process.exit(1);
    }
    
    // Extract filenames
    const filenameWithImages = data.filenameWithImages || 'menu_with_images.csv';
    const filenameNoImages = data.filenameNoImages || 'menu_no_images.csv';
    
    // Write CSV files
    const pathWithImages = path.join(outputDir, filenameWithImages);
    const pathNoImages = path.join(outputDir, filenameNoImages);
    
    console.log(`\n💾 Saving CSV files...`);
    
    fs.writeFileSync(pathWithImages, data.csvDataWithImages, 'utf8');
    console.log(`  ✅ With images: ${pathWithImages}`);
    
    fs.writeFileSync(pathNoImages, data.csvDataNoImages, 'utf8');
    console.log(`  ✅ Without images: ${pathNoImages}`);
    
    // Display statistics
    if (data.stats) {
      console.log(`\n📊 Statistics:`);
      console.log(`  - Rows: ${data.stats.rowCount}`);
      console.log(`  - Columns: ${data.stats.columnCount}`);
      console.log(`  - Cleaned fields: ${data.stats.cleanedFields}`);
      if (data.stats.removedPhrases) {
        console.log(`  - Removed phrases: ${data.stats.removedPhrases.join(', ')}`);
      }
    }
    
    console.log('\n✨ Extraction completed successfully!');
    
    // Return success for scripting
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Error processing response: ${error.message}`);
    
    if (error instanceof SyntaxError) {
      console.error('\n⚠️  JSON parsing failed. The response may contain invalid JSON.');
      console.error('   Try using the fallback cleaning script directly on the CSV file.');
    }
    
    process.exit(1);
  }
}

// Run the script
main();