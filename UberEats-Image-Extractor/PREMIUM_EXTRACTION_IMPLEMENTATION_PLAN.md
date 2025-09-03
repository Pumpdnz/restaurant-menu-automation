# Premium Menu Extraction API Implementation Plan

## Overview
Implementation of `/api/extract-menu-premium` endpoint for enhanced menu extraction with option sets, validated images, and improved accuracy using the URL cleaning method.

## Current Status
- ✅ Database migrations applied (option_sets and option_set_items tables ready)
- ✅ Dead code endpoints removed (`/api/scan-menu-items` and `/api/batch-extract-option-sets`)
- 🔄 Ready to implement new services

## Implementation Tasks

### 1. ✅ Remove Dead Code Endpoints
- **Status**: COMPLETED
- Commented out `/api/scan-menu-items` and `/api/batch-extract-option-sets` endpoints in server.js
- These endpoints were legacy code before database migration

### 2. 🔄 Create URL Cleaning Service
**File**: `src/services/url-cleaning-service.js`
```javascript
class UrlCleaningService {
  cleanModalUrl(modalUrl) {
    // Parse URL and extract modctx parameter
    // Double decode (it's encoded twice)
    // Parse JSON to get UUIDs
    // Build clean URL: baseUrl/sectionUuid/subsectionUuid/itemUuid
  }
  
  cleanBatchUrls(modalUrls, orgId) {
    // Process array of modal URLs
    // Return cleaned URLs with metadata
  }
}
```

### 3. 📋 Create Option Sets Extraction Service
**File**: `src/services/option-sets-extraction-service.js`
```javascript
class OptionSetsExtractionService {
  async extractFromCleanUrl(cleanUrl, itemName) {
    // Use schema from test-clean-urls.js
    // Include actions to dismiss address popup
    // Extract option sets with full details
  }
  
  async batchExtract(cleanUrls, orgId) {
    // Process multiple URLs with rate limiting
    // Handle 404 errors gracefully (skip unavailable items)
  }
}
```

### 4. 📋 Create Image Validation Service
**File**: `src/services/image-validation-service.js`
```javascript
class ImageValidationService {
  isPlaceholder(url) {
    // Check for known placeholder patterns
    // /_static/8ab3af80072120d4.png
    // /_static/29ed4bc0793fd578.svg
  }
  
  async validateBatch(items, orgId) {
    // Validate all images
    // Return validation metadata
  }
}
```

### 5. 📋 Create Premium Extraction Service
**File**: `src/services/premium-extraction-service.js`
```javascript
class PremiumExtractionService {
  async extractPremiumMenu(storeUrl, orgId, options) {
    // Phase 1: Extract categories
    // Phase 2: Extract menu items with modal URLs
    // Phase 3: Clean URLs
    // Phase 4: Extract option sets
    // Phase 5: Validate images
    // Phase 6: Save to database
  }
}
```

### 6. 📋 Enhance Database Service
**File**: `src/services/database-service.js`
Add functions:
- `saveOptionSet(data, orgId)` - Save option set with RLS context
- `saveOptionSetItem(data, orgId)` - Save individual option
- `updateMenuItemOptionSets(menuItemId, hasOptionSets, orgId)` - Update menu item metadata
- `bulkSaveOptionSets(optionSets, orgId)` - Bulk save operation

### 7. 📋 Add Premium Extraction Endpoint
**File**: `server.js`
```javascript
app.post('/api/extract-menu-premium', authMiddleware, async (req, res) => {
  const { storeUrl, orgId, extractOptionSets, validateImages, async } = req.body;
  
  // Validate inputs
  // Check platform (UberEats only for now)
  // Generate job ID if async
  // Start extraction process
  // Return job ID or results
});
```

## Key Implementation Details

### URL Cleaning Logic (from test-clean-urls.js)
```javascript
// Double decode the modctx parameter
let decoded = decodeURIComponent(modctx);  // First decode
decoded = decodeURIComponent(decoded);      // Second decode
const modctxData = JSON.parse(decoded);     // Parse JSON

// Extract UUIDs
const sectionUuid = modctxData.sectionUuid;
const subsectionUuid = modctxData.subsectionUuid;
const itemUuid = modctxData.itemUuid;

// Build clean URL
const cleanUrl = `${baseUrl}/${sectionUuid}/${subsectionUuid}/${itemUuid}`;
```

### Option Sets Schema (from test-clean-urls.js)
```javascript
{
  "optionSets": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "required": { "type": "boolean" },
        "minSelections": { "type": "number" },
        "maxSelections": { "type": "number" },
        "options": {
          "type": "array",
          "items": {
            "properties": {
              "name": { "type": "string" },
              "price": { "type": "string" },
              "priceValue": { "type": "number" },
              "description": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### Modal URL Extraction Schema (from test-json-links-extraction.js)
```javascript
{
  "menuItems": {
    "type": "array",
    "items": {
      "properties": {
        "dishName": { "type": "string" },
        "dishPrice": { "type": "number" },
        "modalUrl": { 
          "type": "string",
          "description": "The quickView modal URL for this menu item"
        }
      }
    }
  }
}
```

## Error Handling Strategy
- **404 Errors**: Skip unavailable items, log them, continue with others
- **URL Cleaning Failures**: Log and skip items that can't be cleaned  
- **Extraction Failures**: Log errors, continue with remaining items
- **No fallback to modal URLs** - items that fail are marked and skipped

## Testing Items (from test-clean-urls.js)
```javascript
const TEST_ITEMS = [
  {
    name: "Pepper Steak and Chips",
    category: "Steak",
    hasImage: true,
    hasOptionSets: true,
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/..."
  },
  // ... more test items
];
```

## API Response Format
```javascript
// Request
POST /api/extract-menu-premium
{
  "storeUrl": "https://www.ubereats.com/...",
  "orgId": "uuid",
  "extractOptionSets": true,
  "validateImages": true,
  "async": true
}

// Response
{
  "success": true,
  "jobId": "premium_123456789_abc",
  "estimatedTime": 180,
  "statusUrl": "/api/premium-extract-status/premium_123456789_abc",
  "resultsUrl": "/api/premium-extract-results/premium_123456789_abc"
}
```

## Next Steps
1. Create the service files in order
2. Test each service individually
3. Integrate services into premium extraction endpoint
4. Test complete flow with real restaurant URLs
5. Add monitoring and metrics

## Notes
- This implementation is based on successful testing documented in extraction_debug_log.md
- Clean URL method achieved 100% success rate for available items (6/6 in tests)
- 404 errors are expected for unavailable items (~33% based on testing)
- No fallback to modal URLs - this is documented for future consideration if needed