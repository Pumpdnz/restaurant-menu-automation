# CSV Generation Quick Reference

## ⚡ Quick Commands

### Generate Both CSV Versions
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation/planning
node generate-csv-without-images.js
```

### Manual CSV Column Removal (Alternative Method)
```bash
# Remove imageURL column (last column) from existing CSV
cut -d',' -f1-16 himalaya_menu_with_images.csv > himalaya_menu_no_images.csv
```

## 📁 File Outputs

| File | Columns | Use Case |
|------|---------|----------|
| `*_no_images.csv` | 16 | Upload to Pumpd menu import |
| `*_with_images.csv` | 17 | Reference for manual image upload |

## 🔧 Script Requirements

1. Input file: `himalaya_scrape_response.json`
2. Location: Must run from `/automation/planning/`
3. Output: Two CSV files with date stamps

## 📋 CSV Column Structure

### Without Images (16 columns)
```
menuID,menuName,menuDisplayName,menuDescription,categoryID,categoryName,categoryDisplayName,categoryDescription,dishID,dishName,dishPrice,dishType,dishDescription,displayName,printName,tags
```

### With Images (17 columns)
```
menuID,menuName,menuDisplayName,menuDescription,categoryID,categoryName,categoryDisplayName,categoryDescription,dishID,dishName,dishPrice,dishType,dishDescription,displayName,printName,tags,imageURL
```

## 🚨 Important Notes

1. **Pumpd CSV Upload**: Use the `_no_images.csv` version ONLY
2. **Image URLs**: Keep the `_with_images.csv` for Step 7 (manual image upload)
3. **Date Format**: Files are named with YYYY-MM-DD format

## 🔄 Integration Points

### From Step 1 (Menu Scraping)
- Input: `himalaya_scrape_response.json`

### To Step 8 (Menu Import)
- Output: `*_no_images.csv` for upload

### To Step 7 (Restaurant Setup)
- Reference: `*_with_images.csv` for image URLs

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "require is not defined" | Script uses ES6 modules, run with Node.js v14+ |
| "File not found" | Ensure `himalaya_scrape_response.json` exists |
| CSV has 17 columns | Use the `_no_images.csv` version |
| Missing prices | Script converts to 0.00 by default |

## 📝 Example Usage in Automation

```javascript
// For future automation agents
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function generateMenuCSVs(restaurantName) {
  const planningDir = '/Users/giannimunro/Desktop/cursor-projects/automation/planning';
  
  try {
    // Run the CSV generation script
    await execAsync('node generate-csv-without-images.js', { cwd: planningDir });
    
    // Return file paths
    const date = new Date().toISOString().split('T')[0];
    return {
      forUpload: `${restaurantName}_menu_${date}_no_images.csv`,
      withImages: `${restaurantName}_menu_${date}_with_images.csv`
    };
  } catch (error) {
    console.error('CSV generation failed:', error);
    throw error;
  }
}
```