// Script to generate CSV without imageURL column from scraped data

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to escape CSV fields
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

// Function to format price
function formatPrice(price) {
  if (typeof price === 'string') {
    price = price.replace(/[$€£¥\s]/g, '');
    price = parseFloat(price);
  }
  
  if (isNaN(price)) {
    return '0.00';
  }
  
  return price.toFixed(2);
}

// Main function to generate CSVs
async function generateCSVs() {
  // Read the scraped data
  const dataPath = join(dirname(dirname(__dirname)), 'himalaya_scrape_response.json');
  const scrapedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // CSV Headers (without imageURL)
  const headers = [
    'menuID',
    'menuName',
    'menuDisplayName',
    'menuDescription',
    'categoryID',
    'categoryName',
    'categoryDisplayName',
    'categoryDescription',
    'dishID',
    'dishName',
    'dishPrice',
    'dishType',
    'dishDescription',
    'displayName',
    'printName',
    'tags'
  ];

  // Build CSV content
  let csvContent = headers.join(',') + '\n';
  const menuNames = new Set();

  // Process each menu item
  scrapedData.data.menuItems.forEach(item => {
    // Generate a unique menuName if duplicates exist
    let menuName = item.menuName || 'Menu';
    if (menuNames.has(menuName)) {
      menuName = `${menuName} ${menuNames.size + 1}`;
    }
    menuNames.add(menuName);
    
    // Format tags
    const tagsString = item.tags && Array.isArray(item.tags) ? item.tags.join(', ') : '';
    
    // Build row (WITHOUT imageURL)
    const row = [
      '', // menuID
      escapeCSVField(menuName),
      '', // menuDisplayName
      '', // menuDescription
      '', // categoryID
      escapeCSVField(item.categoryName || 'Uncategorized'),
      '', // categoryDisplayName
      '', // categoryDescription
      '', // dishID
      escapeCSVField(item.dishName || ''),
      formatPrice(item.dishPrice || 0),
      'standard', // dishType
      escapeCSVField(item.dishDescription || ''),
      '', // displayName
      '', // printName
      escapeCSVField(tagsString)
    ];
    
    csvContent += row.join(',') + '\n';
  });

  // Create output directory if it doesn't exist
  const outputDir = join(dirname(dirname(__dirname)), 'automation', 'UberEats-Image-Extractor', 'downloads', 'csvs-from-script');
  await mkdir(outputDir, { recursive: true });

  // Save CSV without images
  const date = new Date().toISOString().split('T')[0];
  const filenameNoImages = `himalaya_menu_${date}_no_images.csv`;
  const filePathNoImages = join(outputDir, filenameNoImages);
  fs.writeFileSync(filePathNoImages, csvContent);

  console.log(`CSV without images saved as: ${filePathNoImages}`);

  // Also save the original CSV with images for comparison
  const headersWithImages = [...headers, 'imageURL'];
  let csvContentWithImages = headersWithImages.join(',') + '\n';

  // Reset menuNames for consistent naming
  menuNames.clear();

  scrapedData.data.menuItems.forEach(item => {
    let menuName = item.menuName || 'Menu';
    if (menuNames.has(menuName)) {
      menuName = `${menuName} ${menuNames.size + 1}`;
    }
    menuNames.add(menuName);
    
    const tagsString = item.tags && Array.isArray(item.tags) ? item.tags.join(', ') : '';
    
    // Build row WITH imageURL
    const row = [
      '', // menuID
      escapeCSVField(menuName),
      '', // menuDisplayName
      '', // menuDescription
      '', // categoryID
      escapeCSVField(item.categoryName || 'Uncategorized'),
      '', // categoryDisplayName
      '', // categoryDescription
      '', // dishID
      escapeCSVField(item.dishName || ''),
      formatPrice(item.dishPrice || 0),
      'standard', // dishType
      escapeCSVField(item.dishDescription || ''),
      '', // displayName
      '', // printName
      escapeCSVField(tagsString),
      escapeCSVField(item.imageURL || '') // imageURL included
    ];
    
    csvContentWithImages += row.join(',') + '\n';
  });

  const filenameWithImages = `himalaya_menu_${date}_with_images.csv`;
  const filePathWithImages = join(outputDir, filenameWithImages);
  fs.writeFileSync(filePathWithImages, csvContentWithImages);

  console.log(`CSV with images saved as: ${filePathWithImages}`);

  // Display statistics
  console.log(`\nStatistics:`);
  console.log(`Total items: ${scrapedData.data.menuItems.length}`);
  console.log(`CSV without images: ${headers.length} columns`);
  console.log(`CSV with images: ${headersWithImages.length} columns`);
  console.log(`\nFiles saved to: ${outputDir}`);
}

// Run the function
generateCSVs().catch(console.error);