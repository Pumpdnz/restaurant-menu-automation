# Step 3.1 - CSV Generation Without ImageURL Column

## Overview
This documentation covers the generation of CSV files from scraped menu data, specifically creating versions with and without the imageURL column to accommodate different import requirements.

## Background

### The Problem
- The Pumpd CSV upload service does NOT accept the imageURL column
- However, we need the imageURL data for Step 7 (Restaurant Setup) where images are added manually
- The menu scraper API currently generates CSV with imageURL included

### The Solution
Generate two versions of the CSV:
1. **Without imageURL** - For immediate upload to Pumpd's menu import service
2. **With imageURL** - For reference during manual image upload in Step 7

## Implementation

### Script Location
`/automation/planning/generate-csv-without-images.js`

### Script Functionality
The script performs the following operations:
1. Reads the scraped menu data from `himalaya_scrape_response.json`
2. Generates two CSV files:
   - `himalaya_menu_YYYY-MM-DD_no_images.csv` (16 columns)
   - `himalaya_menu_YYYY-MM-DD_with_images.csv` (17 columns)
3. Properly escapes CSV fields containing special characters
4. Formats prices to 2 decimal places
5. Handles missing data gracefully with defaults

### CSV Format Differences

#### Without ImageURL (16 columns)
```csv
menuID,menuName,menuDisplayName,menuDescription,categoryID,categoryName,categoryDisplayName,categoryDescription,dishID,dishName,dishPrice,dishType,dishDescription,displayName,printName,tags
```

#### With ImageURL (17 columns)
```csv
menuID,menuName,menuDisplayName,menuDescription,categoryID,categoryName,categoryDisplayName,categoryDescription,dishID,dishName,dishPrice,dishType,dishDescription,displayName,printName,tags,imageURL
```

## Usage Instructions

### Prerequisites
1. Completed menu scraping (Step 1)
2. Generated `himalaya_scrape_response.json` file
3. Node.js installed (v14+)

### Running the Script

```bash
# Navigate to the planning directory
cd /Users/giannimunro/Desktop/cursor-projects/automation/planning

# Run the script
node generate-csv-without-images.js
```

### Expected Output
```
CSV without images saved as: /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/downloads/csvs-from-script/himalaya_menu_2025-08-01_no_images.csv
CSV with images saved as: /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/downloads/csvs-from-script/himalaya_menu_2025-08-01_with_images.csv

Statistics:
Total items: 17
CSV without images: 16 columns
CSV with images: 17 columns

Files saved to: /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/downloads/csvs-from-script
```

### Generated Files

Files are saved to: `/automation/UberEats-Image-Extractor/downloads/csvs-from-script/`

1. **himalaya_menu_2025-08-01_no_images.csv**
   - Use this for Pumpd menu import
   - Compatible with CSV upload service
   - No imageURL column

2. **himalaya_menu_2025-08-01_with_images.csv**
   - Reference file for manual image upload
   - Contains full imageURL data
   - Use during Step 7 (Restaurant Setup)

## Key Implementation Details

### CSV Field Escaping
```javascript
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
```

### Price Formatting
```javascript
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
```

### Menu Name Deduplication
The script ensures unique menu names by appending numbers:
- "Featured Items"
- "Featured Items 2"
- "Featured Items 3"

## Integration with Automation Workflow

### For Automated Agents
```javascript
// Function to generate both CSV versions
async function generateCSVVersions(scrapedDataPath) {
  // Run the script
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const { stdout, stderr } = await execAsync(
      'node generate-csv-without-images.js',
      { cwd: '/path/to/planning' }
    );
    
    console.log('CSV generation output:', stdout);
    
    // Return paths to generated files
    const date = new Date().toISOString().split('T')[0];
    const outputDir = '/automation/UberEats-Image-Extractor/downloads/csvs-from-script';
    return {
      withoutImages: `${outputDir}/himalaya_menu_${date}_no_images.csv`,
      withImages: `${outputDir}/himalaya_menu_${date}_with_images.csv`
    };
  } catch (error) {
    console.error('CSV generation failed:', error);
    throw error;
  }
}
```

### API Endpoint Enhancement (Future)
```javascript
// Proposed API endpoint modification
app.post('/api/generate-csv', (req, res) => {
  const { data, options } = req.body;
  const includeImageUrl = options?.includeImageUrl ?? true;
  
  // Generate CSV with or without imageURL based on option
  // ...
});
```

## Validation Checklist

### CSV Without Images
- [x] 16 columns total
- [x] No imageURL column
- [x] Proper field escaping
- [x] Price formatting (XX.XX)
- [x] Compatible with Pumpd import

### CSV With Images
- [x] 17 columns total
- [x] ImageURL as last column
- [x] All image URLs preserved
- [x] Same data as no-images version

## Common Issues & Solutions

### Issue: Module Import Error
**Error**: `require is not defined in ES module scope`
**Solution**: Use ES6 imports instead of CommonJS require

### Issue: File Path Not Found
**Error**: `ENOENT: no such file or directory`
**Solution**: Ensure the scraped data file exists and path is correct

### Issue: Invalid CSV Format
**Error**: Upload service rejects CSV
**Solution**: Verify 16 columns exactly, no trailing commas

## Next Steps

1. **Step 3.2**: Test image downloading functionality
2. **Step 7 Integration**: Use the with-images CSV for reference when manually uploading images
3. **API Enhancement**: Add `excludeImageUrl` option to server endpoint

## Important Notes

1. **Always generate both versions** - You'll need the imageURL data later
2. **Use the correct version** - Upload service requires no-images version
3. **Keep files organized** - Store in appropriate directories for easy access
4. **Date-based naming** - Files include date for version tracking