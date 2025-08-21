#!/usr/bin/env node

/**
 * Fallback script to clean CSV files if the server endpoint is unavailable
 * This script provides the same cleaning functionality as the /api/generate-clean-csv endpoint
 * 
 * Usage: node fallback-clean-csv.js <input.csv> [output_no_images.csv]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Phrases to remove from all fields
const UNWANTED_PHRASES = [
  'Plus small',
  'Thumb up outline',
  'No. 1 most liked',
  'No. 2 most liked',
  'No. 3 most liked'
];

// Regex patterns to remove
const REGEX_PATTERNS = [
  /\d+%/g,        // Percentages like "93%"
  /\(\d+\)/g      // Counts in parentheses like "(30)"
];

/**
 * Clean a field value by removing unwanted phrases while preserving legitimate content
 */
function cleanField(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }
  
  let cleaned = value;
  
  // Remove each unwanted phrase
  UNWANTED_PHRASES.forEach(phrase => {
    cleaned = cleaned.replace(new RegExp(phrase, 'g'), '');
  });
  
  // Remove regex patterns
  REGEX_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Clean up formatting if needed
  if (cleaned.includes(';') || UNWANTED_PHRASES.some(phrase => value.includes(phrase))) {
    cleaned = cleaned.replace(/;\s*;/g, ';');     // Remove duplicate semicolons
    cleaned = cleaned.replace(/,\s*,/g, ',');     // Remove duplicate commas
    cleaned = cleaned.replace(/\s+/g, ' ');       // Normalize spaces
    cleaned = cleaned.replace(/^\s*[;,]\s*/, ''); // Remove leading punctuation
    cleaned = cleaned.replace(/\s*[;,]\s*$/, ''); // Remove trailing punctuation
  }
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned || '';
}

/**
 * Parse CSV line considering quoted fields
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && nextChar === '"' && inQuotes) {
      // Double quote inside quoted field
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  fields.push(current);
  
  return fields;
}

/**
 * Escape field for CSV output
 */
function escapeCSVField(field) {
  if (field === undefined || field === null) {
    return '';
  }
  
  const stringField = String(field);
  
  // If the field contains commas, quotes, or newlines, enclose it in quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    // Double up any quotes within the field
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * Process CSV file
 */
function processCSV(inputPath, outputPath) {
  console.log(`\n📂 Processing: ${inputPath}`);
  
  // Read input file
  const content = fs.readFileSync(inputPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    console.error('❌ Error: Input file is empty');
    return;
  }
  
  // Parse header
  const headerFields = parseCSVLine(lines[0]);
  const hasImageColumn = headerFields[headerFields.length - 1].toLowerCase() === 'imageurl';
  
  // Prepare output header (remove imageURL column if present)
  const outputHeader = hasImageColumn ? headerFields.slice(0, -1) : headerFields;
  
  // Process data rows
  const outputRows = [outputHeader.join(',')];
  let cleanedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    
    // Clean each field
    const cleanedFields = fields.map((field, index) => {
      const cleaned = cleanField(field);
      if (cleaned !== field) {
        cleanedCount++;
      }
      return escapeCSVField(cleaned);
    });
    
    // Remove imageURL column if present
    const outputFields = hasImageColumn ? cleanedFields.slice(0, -1) : cleanedFields;
    outputRows.push(outputFields.join(','));
  }
  
  // Write output file
  fs.writeFileSync(outputPath, outputRows.join('\n') + '\n');
  
  console.log(`✅ Output saved to: ${outputPath}`);
  console.log(`📊 Statistics:`);
  console.log(`  - Rows processed: ${lines.length - 1}`);
  console.log(`  - Fields cleaned: ${cleanedCount}`);
  console.log(`  - Image column removed: ${hasImageColumn ? 'Yes' : 'No'}`);
  console.log(`  - Removed phrases: ${UNWANTED_PHRASES.join(', ')}`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Fallback CSV Cleaning Script');
    console.log('============================');
    console.log('\nUsage: node fallback-clean-csv.js <input.csv> [output.csv]');
    console.log('\nThis script will:');
    console.log('  1. Remove unwanted phrases from all fields');
    console.log('  2. Remove the imageURL column (if present)');
    console.log('  3. Preserve CSV structure and legitimate content');
    console.log('\nUnwanted phrases removed:');
    UNWANTED_PHRASES.forEach(phrase => {
      console.log(`  - ${phrase}`);
    });
    console.log('  - Percentage values (e.g., 93%, 100%)');
    console.log('  - Count values in parentheses (e.g., (30), (8))');
    console.log('\nExample:');
    console.log('  node fallback-clean-csv.js menu.csv menu_cleaned.csv');
    console.log('  node fallback-clean-csv.js menu.csv  # Auto-generates output filename');
    process.exit(1);
  }
  
  const inputPath = path.resolve(args[0]);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  // Generate output path if not provided
  let outputPath;
  if (args[1]) {
    outputPath = path.resolve(args[1]);
  } else {
    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, '.csv');
    outputPath = path.join(dir, `${base}_no_images.csv`);
  }
  
  try {
    processCSV(inputPath, outputPath);
    console.log('\n✨ Cleaning completed successfully!');
  } catch (error) {
    console.error(`\n❌ Error processing file: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();