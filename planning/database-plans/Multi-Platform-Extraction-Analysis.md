# Multi-Platform Menu Extraction Analysis

## Current State Assessment

### Platform Limitations
The system is currently hardcoded to only accept UberEats and DoorDash URLs. This limitation exists in multiple places:

1. **URL Validation** (`server.js:422-443`)
   - Function `validateRestaurantUrl()` explicitly checks for 'ubereats.com' or 'doordash.com'
   - Returns error "URL must be from UberEats or DoorDash" for all other platforms

2. **Platform Detection** (`server.js:141-144`)
   - Binary detection: `isUberEats` or `isDoorDash`
   - Platform name defaults to "Custom" for anything else
   - No support for other NZ platforms

3. **Extraction Logic** (`server.js`)
   - Prompts are tailored for UberEats/DoorDash DOM structures
   - Category-based extraction assumes specific layouts
   - Uses Firecrawl API with hardcoded schemas

### Database Structure
- Platform stored as string in `platforms` table
- Currently only "UberEats", "DoorDash", or "Custom" values
- Menu extraction tracks platform_id foreign key

## Required Changes for Multi-Platform Support

### 1. Remove URL Restrictions
**File to modify:** `server.js:422-443`

Replace `validateRestaurantUrl()` with platform-agnostic validation:
```javascript
function validateRestaurantUrl(url, res) {
  if (!url) {
    res.status(400).json({ 
      success: false, 
      error: 'URL is required' 
    });
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch (e) {
    res.status(400).json({
      success: false,
      error: 'Invalid URL format'
    });
    return false;
  }
}
```

### 2. Enhanced Platform Detection
**File to create:** `src/utils/platform-detector.js`

```javascript
const PLATFORM_CONFIG = {
  'ubereats.com': {
    name: 'UberEats',
    type: 'delivery',
    extractionMethod: 'firecrawl-structured'
  },
  'doordash.com': {
    name: 'DoorDash', 
    type: 'delivery',
    extractionMethod: 'firecrawl-structured'
  },
  'ordermeal.co.nz': {
    name: 'OrderMeal',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic'
  },
  'nextorder.co.nz': {
    name: 'NextOrder',
    type: 'ordering', 
    extractionMethod: 'firecrawl-generic'
  },
  'foodhub.co.nz': {
    name: 'FoodHub',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic'
  },
  'mobi2go.com': {
    name: 'Mobi2Go',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic'
  },
  '.pdf': {
    name: 'PDF',
    type: 'document',
    extractionMethod: 'pdf-parse'
  }
};
```

### 3. Platform Adapters
**Files to create:**
- `src/adapters/ubereats-adapter.js`
- `src/adapters/doordash-adapter.js`
- `src/adapters/ordermeal-adapter.js`
- `src/adapters/nextorder-adapter.js`
- `src/adapters/foodhub-adapter.js`
- `src/adapters/mobi2go-adapter.js`
- `src/adapters/pdf-adapter.js`
- `src/adapters/generic-adapter.js`

Each adapter should implement:
```javascript
class PlatformAdapter {
  async extractMenuData(url, options) {}
  async scanCategories(url) {}
  normalizeMenuItem(item) {}
  getExtractionSchema() {}
  getExtractionPrompt() {}
}
```

### 4. Database Updates
**Migration needed:** Add new platforms to database
```sql
INSERT INTO platforms (name, type) VALUES
  ('OrderMeal', 'ordering'),
  ('NextOrder', 'ordering'),
  ('FoodHub', 'ordering'),
  ('Mobi2Go', 'ordering'),
  ('PDF', 'document'),
  ('Generic', 'other');
```

### 5. PDF Support Implementation
**Dependencies to add:**
```json
{
  "pdf-parse": "^1.1.1",
  "pdf-lib": "^1.17.1"
}
```

**File to create:** `src/utils/pdf-extractor.js`
- Parse PDF content
- Extract tables and text
- Use NLP to identify menu items
- Extract prices using regex patterns

### 6. Frontend Updates
**Files to modify:**
- `src/pages/NewExtraction.jsx` - Remove platform restrictions
- `src/components/PlatformSelector.jsx` - Add new platforms
- Update validation to accept any URL

## Implementation Priority

1. **Phase 1: Remove Restrictions** (Quick Win)
   - Update `validateRestaurantUrl()` 
   - Allow any URL to be processed
   - Use generic extraction for unknown platforms

2. **Phase 2: Platform Detection**
   - Implement platform detector
   - Add platform configurations
   - Update database with new platforms

3. **Phase 3: Platform Adapters**
   - Create adapter interface
   - Implement UberEats/DoorDash adapters (refactor existing)
   - Add generic adapter for new platforms

4. **Phase 4: New Platform Support**
   - Research each platform's structure
   - Create specific adapters
   - Test extraction quality

5. **Phase 5: PDF Support**
   - Add PDF parsing library
   - Create PDF adapter
   - Handle price-only merges from PDFs

## Testing Requirements

### Test URLs for New Platforms:
- OrderMeal: `https://www.ordermeal.co.nz/[restaurant-name]`
- NextOrder: `https://www.nextorder.co.nz/[restaurant-name]`
- FoodHub: `https://www.foodhub.co.nz/[restaurant-name]`
- Mobi2Go: `https://www.mobi2go.com/[restaurant-name]`

### Test Cases:
1. URL validation accepts all platforms
2. Platform detection correctly identifies each
3. Extraction returns structured data
4. Database stores platform correctly
5. Merge works across different platforms

## Files to Review in Next Session

### Core Files to Modify:
1. `/server.js` - Lines 422-443 (validateRestaurantUrl)
2. `/server.js` - Lines 141-144 (platform detection)
3. `/server.js` - Lines 1749-2003 (batch extraction)
4. `/src/pages/NewExtraction.jsx` - URL validation
5. `/src/services/database-service.js` - Platform handling

### New Files to Create:
1. `/src/utils/platform-detector.js`
2. `/src/adapters/base-adapter.js`
3. `/src/adapters/[platform]-adapter.js` (for each platform)
4. `/src/utils/pdf-extractor.js`

## Notes for Next Session

The system uses Firecrawl API for web scraping, which is platform-agnostic. The main limitations are:
1. Artificial URL validation
2. Hardcoded platform detection
3. Platform-specific prompts/schemas

Removing these restrictions is straightforward. The challenge will be creating effective extraction schemas for each new platform's unique structure.

**Priority:** Start by removing URL restrictions to allow immediate testing with new platforms using generic extraction, then iteratively improve platform-specific extraction quality.

## Current Feature Progress

### Completed in This Session:
- ✅ Fixed menu merge issues (duplicates, Featured Items, excluded items)
- ✅ Implemented price-only merge mode for price updates
- ✅ Added category normalization
- ✅ Investigated extraction limitations

### Next Steps:
- Remove platform restrictions
- Add new platform support
- Implement PDF parsing
- Create platform adapters
- Test with real restaurant data from NZ platforms