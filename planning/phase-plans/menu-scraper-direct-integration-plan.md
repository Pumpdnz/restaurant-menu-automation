# Menu Scraper Direct Integration Plan

## Overview
Instead of using Puppeteer to navigate to http://localhost:3005, we can call the API endpoints directly from our automation workflow. The app is now running on port 3007 with the same functionality.

## Available API Endpoints

### 1. Direct Scrape (Recommended)
**Endpoint**: POST `http://localhost:3007/api/scrape`
**Purpose**: Fast, single-pass menu extraction using Firecrawl's FIRE-1 agent
**Payload**:
```javascript
{
  url: "https://www.ubereats.com/nz/store/[restaurant-slug]/[store-id]",
  prompt: "optional custom prompt",
  schema: "optional custom schema"
}
```
**Response**:
```javascript
{
  success: true,
  data: {
    menuItems: [
      {
        dishName: "Chicken Momo",
        dishPrice: 30.00,
        dishDescription: "Steamed dumplings...",
        categoryName: "Mains",
        menuName: "Menu",
        imageURL: "https://...",
        tags: ["Popular"]
      }
    ]
  }
}
```

### 2. Generate CSV
**Endpoint**: POST `http://localhost:3007/api/generate-csv`
**Purpose**: Convert extracted menu data to Pumpd-compatible CSV format
**Payload**:
```javascript
{
  data: {
    menuItems: [...], // From scrape response
    restaurantInfo: { name: "Restaurant Name" }
  },
  options: {
    comboItems: ["Combo Meal 1"], // Items to mark as combo
    fieldEdits: {} // Custom field overrides
  }
}
```
**Response**:
```javascript
{
  success: true,
  csvData: "menuID,menuName,menuDisplayName...\n...",
  filename: "restaurant_name_menu_2025-07-31.csv",
  stats: {
    rowCount: 17,
    columnCount: 17
  }
}
```

### 3. Category-Based Extraction (For Large Menus)
**Step 1**: POST `http://localhost:3007/api/scan-categories`
**Step 2**: POST `http://localhost:3007/api/batch-extract-categories`

### 4. Option Sets Extraction (UberEats Only)
**Step 1**: POST `http://localhost:3007/api/scan-menu-items`
**Step 2**: POST `http://localhost:3007/api/batch-extract-option-sets`

## Integration Workflow

### Phase 1: Direct API Calls
```javascript
async function extractMenuData(uberEatsUrl, itemCount) {
  try {
    // Step 1: Determine extraction method
    const method = itemCount < 30 ? 'scrape' : 'category-based';
    
    if (method === 'scrape') {
      // Direct scrape for small menus
      const scrapeResponse = await fetch('http://localhost:3007/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uberEatsUrl })
      });
      
      const scrapeData = await scrapeResponse.json();
      
      if (!scrapeData.success) {
        throw new Error(scrapeData.error);
      }
      
      // Step 2: Generate CSV
      const csvResponse = await fetch('http://localhost:3007/api/generate-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: scrapeData.data,
          options: {}
        })
      });
      
      const csvData = await csvResponse.json();
      
      return {
        menuItems: scrapeData.data.menuItems,
        csv: csvData.csvData,
        filename: csvData.filename
      };
    } else {
      // Category-based extraction for large menus
      // First scan categories, then batch extract
    }
  } catch (error) {
    console.error('Menu extraction failed:', error);
    throw error;
  }
}
```

### Phase 2: Save Results Locally
```javascript
const fs = require('fs');
const path = require('path');

async function saveMenuData(csvData, filename, restaurantName) {
  // Create output directory
  const outputDir = path.join(__dirname, 'extracted-menus', restaurantName);
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Save CSV file
  const csvPath = path.join(outputDir, filename);
  fs.writeFileSync(csvPath, csvData);
  
  // Return path for next steps
  return {
    csvPath,
    outputDir
  };
}
```

### Phase 3: Image Handling
Since we can't programmatically download images through the browser, we have options:
1. **Extract image URLs only** - Let the Pumpd system download during import
2. **Download images server-side** - Add a new endpoint to download and save images
3. **Manual step** - Flag for manual image download if required

## Benefits of Direct Integration

1. **No Browser Automation Needed**: Faster, more reliable
2. **Programmatic CSV Access**: Direct file system writes
3. **Error Handling**: Better control over failures
4. **Parallel Processing**: Can run multiple extractions simultaneously
5. **No UI Interaction**: Completely headless operation

## Implementation Steps

### 1. Test API Endpoints
```bash
# Test server status
curl http://localhost:3007/api/status

# Test scrape endpoint
curl -X POST http://localhost:3007/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.ubereats.com/nz/store/himalaya-queenstown/jWXFNxw2TZK5VU6oAyyBNQ"}'
```

### 2. Create Wrapper Functions
```javascript
// menuScraperService.js
class MenuScraperService {
  constructor(baseUrl = 'http://localhost:3007') {
    this.baseUrl = baseUrl;
  }
  
  async scrapeMenu(url) {
    // Implementation
  }
  
  async generateCSV(menuData, options) {
    // Implementation
  }
  
  async saveResults(data, outputPath) {
    // Implementation
  }
}
```

### 3. Integrate with Main Workflow
- Replace Puppeteer navigation with direct API calls
- Handle responses programmatically
- Save files to designated directories
- Return paths for subsequent workflow steps

## Next Steps

1. Verify the server is running on port 3007
2. Test each API endpoint with Himalaya restaurant data
3. Create service wrapper for clean integration
4. Update workflow to use direct API calls
5. Test end-to-end extraction without browser automation