# Multi-Platform Menu Extraction System Architecture

## Overview
The UberEats Image Extractor has evolved into a comprehensive multi-platform menu extraction system supporting 15+ delivery and ordering platforms, with a focus on New Zealand platforms including Mobi2Go, DeliverEasy, FoodHub, OrderMeal, and NextOrder.

## System Architecture

### 1. Extraction Flow

```mermaid
graph TD
    A[User Initiates Extraction] -->|POST /api/extractions/start| B[Platform Detection]
    B --> C{Platform Type?}
    
    C -->|UberEats/DoorDash| D[Delivery Platform Flow]
    C -->|NZ Platforms| E[NZ Platform Flow]
    C -->|Unknown| F[Generic Platform Flow]
    
    D --> G[Platform-Specific Category Detection]
    E --> G
    F --> G
    
    G --> H[Phase 1: Detect Categories]
    H --> I[Phase 2: Per-Category Extraction]
    I --> J[Data Aggregation]
    J --> K[Save to Database]
    K --> L[Generate CSV & Images]
```

### 2. Platform Detection Workflow

#### Entry Point: `/api/extractions/start` (server.js:3229)
1. Receives URL from user
2. Calls `detectPlatform(url)` from platform-detector.js
3. Identifies platform based on hostname patterns
4. Returns platform configuration including:
   - Platform name
   - Type (delivery/ordering/website)
   - Extraction method (firecrawl-structured/firecrawl-generic)
   - Support status

#### Platform Detection Logic (platform-detector.js:117)
```javascript
// Simplified flow
detectPlatform(url) {
  1. Parse URL
  2. Check against PLATFORM_CONFIG patterns
  3. Return platform info or default to 'Website'
}
```

### 3. Prompt Selection Mechanism

#### Two-Phase Extraction Process

**Phase 1: Category Detection** (server.js:3355-3379)
- Platform-specific category detection prompts are selected based on platform name:
  - `UberEats` → UBEREATS_CATEGORY_PROMPT
  - `DoorDash` → DOORDASH_CATEGORY_PROMPT
  - `OrderMeal` → ORDERMEAL_CATEGORY_PROMPT
  - `Mobi2Go` → MOBI2GO_CATEGORY_PROMPT
  - `NextOrder` → NEXTORDER_CATEGORY_PROMPT
  - `DeliverEasy` → DELIVEREASY_CATEGORY_PROMPT
  - `FoodHub` → FOODHUB_CATEGORY_PROMPT
  - `Unknown/Other` → GENERIC_CATEGORY_PROMPT

**Phase 2: Per-Category Item Extraction** (server.js:229-238)
- Dynamic prompts generated for each category found
- Same schema (CATEGORY_DETECTION_SCHEMA) used across all platforms
- Prompts include:
  - Category name
  - Position information
  - Platform-specific navigation instructions

### 4. Supported Platforms

#### Tier 1: Fully Optimized (DO NOT MODIFY)
| Platform | Domain | Extraction Method | Status |
|----------|---------|------------------|---------|
| UberEats | ubereats.com | firecrawl-structured | ✅ Production Ready |
| DoorDash | doordash.com | firecrawl-structured | ✅ Production Ready |

#### Tier 2: NZ Platforms (Testing Required)
| Platform | Domain | Extraction Method | Category Prompt | Status |
|----------|---------|------------------|-----------------|---------|
| OrderMeal | ordermeal.co.nz | firecrawl-generic | ✅ Defined | 🔄 Testing Needed |
| NextOrder | nextorder.nz, nextorder.co.nz | firecrawl-generic | ✅ Defined | 🔄 Testing Needed |
| FoodHub | foodhub.co.nz | firecrawl-generic | ✅ Defined | 🔄 Testing Needed |
| Mobi2Go | mobi2go.com, scopa.co.nz, ljs.co.nz | firecrawl-generic | ✅ Defined | 🟢 2 Successful Extractions |
| Menulog | menulog.co.nz | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |
| DeliverEasy | delivereasy.co.nz | firecrawl-generic | ✅ Defined | 🔄 Testing Needed |
| Bopple | bopple.app | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |
| ResDiary | resdiary.com | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |
| Me&u | meandu.app | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |
| GloriaFood | gloriafood (embedded) | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |
| Sipo | sipocloudpos.com | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |
| BookNOrder | booknorder.co.nz | firecrawl-generic | ❌ Using Generic | 🔄 Testing Needed |

### 5. Database Schema

#### Platforms Table
```sql
- id (UUID)
- name (TEXT)
- base_url (TEXT)
- type (TEXT) -- 'delivery', 'ordering', 'website'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### Extraction Jobs Table
```sql
- id (UUID)
- job_id (TEXT UNIQUE)
- restaurant_id (UUID FK)
- platform_id (UUID FK)
- source_url (TEXT)
- status (TEXT) -- 'pending', 'running', 'completed', 'failed'
- extraction_type (TEXT) -- 'batch', 'single'
- created_at, started_at, completed_at
- menu_id (UUID FK) -- Links to extracted menu
- error (JSONB)
- options (JSONB) -- Stores extraction configuration
```

### 6. Key Technical Insights

#### DEFAULT_PROMPT Usage
- **Finding**: DEFAULT_PROMPT definitions exist in two locations but are NOT actively used
  - server.js:54 - Documentation/reference only
  - firecrawl-service.js:20 - Exported but unused
- **Actual Usage**: Platform-specific prompts are dynamically selected

#### Extraction Method Differences
- **firecrawl-structured**: Used for UberEats/DoorDash with complex JSON schemas
- **firecrawl-generic**: Used for all NZ platforms with simpler extraction logic

#### Category Detection Schema
- Universal schema (CATEGORY_DETECTION_SCHEMA) works across all platforms
- Returns array of categories with:
  - name (string)
  - position (number)
  - itemCount (number)
  - selector (string, optional)

### 7. Testing Methodology

#### Phase 1: Platform Detection Testing
```javascript
// Test URL patterns for each platform
const testUrls = {
  ordermeal: 'https://ordermeal.co.nz/restaurant-name/menu',
  nextorder: 'https://restaurant.nextorder.nz',
  foodhub: 'https://foodhub.co.nz/restaurant-name',
  mobi2go: 'https://restaurant.mobi2go.com/menu',
  delivereasy: 'https://delivereasy.co.nz/restaurant-name-delivery'
};

// Verify detectPlatform() returns correct platform info
```

#### Phase 2: Category Detection Testing
1. Use existing UI at `/extractions/new`
2. Input test URL for target platform
3. Monitor console logs for:
   - Platform detection result
   - Selected category prompt
   - Firecrawl API response
4. Verify categories are correctly identified

#### Phase 3: Full Extraction Testing
1. Complete category detection
2. Verify per-category extraction
3. Check database for:
   - Extraction job status
   - Menu creation
   - Menu items with correct data
4. Download CSV to verify data quality

### 8. Implementation Plan

#### Step 1: Verify Existing NZ Platform Prompts (Week 1)
- [x] OrderMeal - Has specific prompt
- [x] Mobi2Go - Has specific prompt, 2 successful extractions
- [x] NextOrder - Has specific prompt
- [x] DeliverEasy - Has specific prompt
- [x] FoodHub - Has specific prompt

#### Step 2: Test Each Platform (Week 2)
Priority Order:
1. **Mobi2Go** - Already working, verify consistency
2. **OrderMeal** - Most straightforward structure
3. **NextOrder** - Similar to OrderMeal
4. **FoodHub** - May have variations
5. **DeliverEasy** - Different URL structure

#### Step 3: Create Missing Platform Prompts (Week 3)
Platforms needing custom prompts:
- Menulog
- Bopple
- ResDiary
- Me&u
- GloriaFood
- Sipo
- BookNOrder

#### Step 4: Optimization (Week 4)
- Refine prompts based on test results
- Add platform-specific handling for edge cases
- Update documentation with findings

### 9. Monitoring & Debugging

#### Key Log Points
1. **Platform Detection**: server.js:3280
   ```
   [Extraction] Auto-detected platform: {platformName}
   ```

2. **Category Detection**: server.js:3355-3379
   ```
   [Job {jobId}] Using {platform}-specific category detection
   ```

3. **Per-Category Extraction**: server.js:201
   ```
   [Job {jobId}] Starting extraction for category: {categoryName}
   ```

#### Database Queries for Monitoring
```sql
-- Check platform usage
SELECT p.name, COUNT(ej.id) as extraction_count
FROM platforms p
LEFT JOIN extraction_jobs ej ON p.id = ej.platform_id
GROUP BY p.name
ORDER BY extraction_count DESC;

-- Recent NZ platform extractions
SELECT 
  ej.job_id,
  r.name as restaurant,
  p.name as platform,
  ej.status,
  ej.created_at
FROM extraction_jobs ej
JOIN restaurants r ON ej.restaurant_id = r.id
JOIN platforms p ON ej.platform_id = p.id
WHERE p.name IN ('mobi2go', 'ordermeal', 'nextorder', 'foodhub', 'delivereasy')
ORDER BY ej.created_at DESC
LIMIT 10;
```

### 10. Critical Notes

#### DO NOT MODIFY
- UberEats extraction logic (working perfectly)
- DoorDash extraction logic (working perfectly)
- CATEGORY_DETECTION_SCHEMA (universal, working for all)

#### Areas for Enhancement
- Platform-specific error handling
- Retry logic for failed categories
- Image extraction optimization for NZ platforms
- Menu item deduplication logic

### 11. Success Metrics

- **Category Detection Rate**: >95% of actual categories found
- **Item Extraction Rate**: >90% of menu items captured
- **Data Quality**: All required fields (name, price) present
- **Image Capture**: >80% of available images downloaded
- **Processing Time**: <2 minutes for 100 items

### 12. Platform Detection Analysis & Recommendations

#### Current Detection Issues

Based on testing with real URLs, several issues were identified:

1. **FoodHub Variants Not Detected**: URLs like `konyakebabs.co.nz` are detected as generic "Website" instead of FoodHub
2. **Restaurant Name Extraction Failures**: Some platforms fail to extract restaurant names (marked as "UNKNOWN")
3. **No Platform-Specific Prompts for Several Platforms**: Bopple, ResDiary, Me&u, GloriaFood, Sipo, BookNOrder still use generic prompts

#### Detection Strategy Analysis

**Current Approach: URL Pattern Matching**
- ✅ Works well for platforms with consistent domain patterns (UberEats, DoorDash, OrderMeal)
- ⚠️ Fails for platforms with variable domains (FoodHub restaurants on custom domains)
- ⚠️ Cannot detect embedded platforms (GloriaFood integrated into restaurant sites)

**Recommended Multi-Strategy Approach:**

1. **Primary: Enhanced URL Pattern Detection**
   - Add more domain patterns to PLATFORM_CONFIG
   - Include known restaurant domains for FoodHub
   - Add subdomain pattern matching

2. **Secondary: User Platform Selection**
   - Add optional platform selector in UI
   - Pre-populate based on URL detection
   - Allow manual override when detection fails

3. **Tertiary: Content-Based Detection**
   - Detect platform by page content/structure
   - Look for platform-specific elements (e.g., GloriaFood widgets)
   - Use as fallback when URL detection fails

#### Implementation Recommendations

```javascript
// Enhanced platform detection configuration
const ENHANCED_PLATFORM_CONFIG = {
  // FoodHub with known restaurant domains
  'foodhub': {
    domains: ['foodhub.co.nz'],
    customDomains: [
      'konyakebabs.co.nz',
      'larubythaionline.co.nz',
      'fusionkebab.co.nz',
      'lakepizza.co.nz'
    ],
    detectByContent: ['foodhub-widget', 'foodhub-menu']
  },
  
  // GloriaFood detection by widget presence
  'gloriafood': {
    detectByContent: ['gloriafood-widget', 'gf-ordering-module'],
    commonDomains: ['noi.co.nz', 'luckythai.co.nz']
  }
};
```

### 13. Next Actions

1. ✅ Complete architecture documentation
2. ✅ Add missing platforms to database
3. ✅ Analyze platform detection strategy
4. 🔄 Test extraction with real OrderMeal URL
5. ⏳ Implement enhanced platform detection
6. ⏳ Add user platform selection UI
7. ⏳ Create platform-specific prompts for missing platforms
8. ⏳ Document test results and refine prompts
9. ⏳ Create platform-specific troubleshooting guide

---

## Appendix A: Platform URL Patterns & Real Test URLs

### DeliverEasy
- Pattern: `https://www.delivereasy.co.nz/{restaurant-name}-delivery`
- **Real Test URL**: `https://www.delivereasy.co.nz/culture-burger-joint-nelson-delivery`

### Mobi2Go
- Pattern: Multiple variants - subdomain or direct domain
- **Real Test URLs**:
  - `https://www.scopa.co.nz/order#/menu`
  - `https://ljs.co.nz/order/#/menu`
  - `https://biggiespizza.mobi2go.com/#/menu`

### Bopple
- Pattern: `https://{restaurant}.bopple.app/{restaurant}/menu`
- **Real Test URL**: `https://empirechicken.bopple.app/empirechicken/menu`

### ResDiary
- Pattern: `https://www.resdiary.com/Preorder/Menu?restaurantName={name}&versionId={id}`
- **Real Test URL**: `https://www.resdiary.com/Preorder/Menu?restaurantName=TheFlyingBurritoBrothersAlbany&versionId=1947`

### NextOrder
- Pattern: `https://{restaurant}.nextorder.nz/`
- **Real Test URL**: `https://hambagu.nextorder.nz/`

### Me&u (meandu.app)
- Pattern: `https://www.meandu.app/{restaurant}/pickup/{section}`
- **Real Test URLs**:
  - `https://www.meandu.app/wb-city/pickup/starters`
  - `https://www.meandu.app/loco-bros-cb/pickup/menu`

### GloriaFood (Embedded)
- Pattern: Embedded in restaurant websites
- **Real Test URLs**:
  - `https://www.noi.co.nz/`
  - `https://www.luckythai.co.nz/`

### Sipo
- Pattern: `https://order.sipocloudpos.com/{restaurant-id-or-name}`
- **Real Test URLs**:
  - `https://order.sipocloudpos.com/5609595`
  - `https://order.sipocloudpos.com/currygarden`

### OrderMeal
- Pattern: `https://www.ordermeal.co.nz/{restaurant-name}/`
- **Real Test URLs**:
  - `https://www.ordermeal.co.nz/konya-kebabs-dunedin/`
  - `https://www.ordermeal.co.nz/the-kebab-and-chicken-house/`

### FoodHub
- Pattern: Direct domain or subdomain variants
- **Real Test URLs**:
  - `https://konyakebabs.co.nz/`
  - `https://larubythaionline.co.nz/`
  - `https://fusionkebab.co.nz/order-now/kebabs`
  - `https://lakepizza.co.nz/order-now`

### BookNOrder
- Pattern: `https://{restaurant}.booknorder.co.nz/`
- **Real Test URL**: `https://saharaindia.booknorder.co.nz/`

### Restaurant Websites (Generic)
- Pattern: Various restaurant websites
- **Real Test URLs**:
  - `https://www.soulthai.co.nz/menu/`
  - `https://www.santeriapizzaandpasta.com/`
  - `https://www.gorillakitchen.nz/online-ordering`

---

*Last Updated: January 2025*
*Version: 1.0.0*