# Standard vs Premium Extraction Flow Documentation

## Scenario
- **URL Input**: `https://www.ubereats.com/nz/store/smokey-ts-cashel-street/rWCJOIotUEGcllMiycozVw`
- **Restaurant Selection Mode**: Manual (Select existing restaurant)
- **Selected Restaurant**: "Smokey Ts Cashel Street" (ID: `c7709b7f-29db-4383-b3d6-e525962c9f2b`)
- **Platform**: UberEats (auto-detected)

---

## PHASE 1: Frontend Data Preparation and API Call

### User Actions in Frontend (NewExtraction.jsx)
1. User enters URL: Platform is auto-detected as "ubereats" (line 78-79)
2. User selects "Select existing restaurant" radio button (restaurantMode = 'manual')
3. User selects "Smokey Ts Cashel Street" from dropdown (selectedRestaurantId = 'c7709b7f-29db-4383-b3d6-e525962c9f2b')
4. User toggles Premium Extraction Mode ON or OFF
5. User clicks "Start Extraction" button

### Form Submission Handler (handleSubmit - line 241)
Both modes perform the same validation:
- Validates URL is not empty
- Validates platform was detected
- Validates restaurant is selected (in manual mode)
- Sets loading state
- Calls `startExtraction.mutate()`

### Mutation Function Data Preparation (lines 150-217)

#### PREMIUM EXTRACTION (isPremiumMode = true)
```javascript
// Line 155-172
if (isPremiumMode && data.url.includes('ubereats.com')) {
  const premiumData = {
    storeUrl: data.url,  // Note: field name is 'storeUrl' not 'url'
    orgId: orgId || 'default-org',
    extractOptionSets: true,  // from state, default true
    validateImages: true,     // from state, default true
    async: true               // Always true for better UX
  };
  
  // Lines 165-170: Add restaurant info for manual mode
  if (restaurantMode === 'manual' && selectedRestaurantId) {
    const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
    premiumData.restaurantId = selectedRestaurantId;  // 'c7709b7f-29db-4383-b3d6-e525962c9f2b'
    premiumData.restaurantName = selectedRestaurant?.name || 'Unknown Restaurant';  // 'Smokey Ts Cashel Street'
  }
  
  return await extractionAPI.startPremium(premiumData);
}
```

**Premium Data Object Sent**:
```json
{
  "storeUrl": "https://www.ubereats.com/nz/store/smokey-ts-cashel-street/rWCJOIotUEGcllMiycozVw",
  "orgId": "00000000-0000-0000-0000-000000000000",
  "extractOptionSets": true,
  "validateImages": true,
  "async": true,
  "restaurantId": "c7709b7f-29db-4383-b3d6-e525962c9f2b",
  "restaurantName": "Smokey Ts Cashel Street"
}
```

#### STANDARD EXTRACTION (isPremiumMode = false)
```javascript
// Lines 174-215
else {
  let extractionData = { ...data };  // Contains url, platform, options
  
  // Lines 177-182: Add restaurant info for manual mode
  if (restaurantMode === 'manual' && selectedRestaurantId) {
    const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
    extractionData.restaurantId = selectedRestaurantId;  // 'c7709b7f-29db-4383-b3d6-e525962c9f2b'
    extractionData.restaurantName = selectedRestaurant?.name || 'Unknown Restaurant';  // 'Smokey Ts Cashel Street'
  }
  
  return await extractionAPI.start(extractionData);
}
```

**Standard Data Object Sent** (from line 266-270):
```json
{
  "url": "https://www.ubereats.com/nz/store/smokey-ts-cashel-street/rWCJOIotUEGcllMiycozVw",
  "platform": "ubereats",
  "options": {},
  "restaurantId": "c7709b7f-29db-4383-b3d6-e525962c9f2b",
  "restaurantName": "Smokey Ts Cashel Street"
}
```

### API Service Calls (api.js)

#### Premium Extraction
```javascript
// Line in api.js
startPremium: (data) => api.post('/extract-menu-premium', data)
```
- **Endpoint**: `POST /api/extract-menu-premium`
- **Headers**: Includes auth token and organization ID (from axios interceptor)

#### Standard Extraction
```javascript
// Line in api.js
start: (data) => api.post('/extractions/start', data)
```
- **Endpoint**: `POST /api/extractions/start`
- **Headers**: Includes auth token and organization ID (from axios interceptor)

### Key Differences in Phase 1

| Aspect | Standard Extraction | Premium Extraction |
|--------|-------------------|-------------------|
| **Endpoint** | `/api/extractions/start` | `/api/extract-menu-premium` |
| **URL Field Name** | `url` | `storeUrl` |
| **Organization ID** | Passed in headers | Passed in body as `orgId` |
| **Restaurant ID** | `restaurantId` (optional) | `restaurantId` (optional) |
| **Restaurant Name** | `restaurantName` (optional) | `restaurantName` (optional) |
| **Platform Field** | `platform: "ubereats"` | Not sent (validated server-side) |
| **Options** | `options: {}` | Individual fields: `extractOptionSets`, `validateImages` |
| **Async Mode** | Not specified | `async: true` (always) |
| **Auth Middleware** | Applied to all /api/* routes | Applied to all /api/* routes |

### Navigation After Success (lines 218-226)
Both modes handle success the same way:
```javascript
onSuccess: (response) => {
  const jobId = response.data.jobId;
  const isPremium = response.data.statusUrl ? true : false;  // Premium has statusUrl
  navigate(`/extractions/${jobId}?poll=true${isPremium ? '&premium=true' : ''}`);
}
```

---

## Key Issue Found: Organization ID Handling Inconsistency

### Investigation Results:

**Organization Middleware** (applies to ALL `/api/*` routes):
- The middleware runs on line 479: `app.use('/api/*', organizationMiddleware);`
- It extracts `orgId` from header `X-Organization-ID` and sets `req.organizationId`
- This means BOTH standard and premium endpoints have access to `req.organizationId`

**Current Implementation:**
- **Standard Extraction**: Uses `req.organizationId` (from header via middleware)
  ```javascript
  // Line 3529 in server.js
  const dbJob = await db.createExtractionJob({...}, req.organizationId);
  ```
  
- **Premium Extraction**: Requires `orgId` in request body and validates it
  ```javascript
  // Line 2089 in server.js
  const { storeUrl, orgId, restaurantName, ... } = req.body;
  
  // Lines 2099-2104: Validates orgId is present
  if (!orgId) {
    return res.status(400).json({
      success: false,
      error: 'Organization ID is required'
    });
  }
  
  // Line 2117: Passes body orgId to service
  premiumExtractionService.extractPremiumMenu(storeUrl, orgId, {...})
  ```

**The Problem:**
- Premium extraction is redundantly requiring `orgId` in the body when it's already available as `req.organizationId`
- This creates inconsistency and requires the frontend to manage organization ID differently for each mode
- The frontend has to explicitly pass `orgId` for premium but not for standard

**The Fix Should Be:**
- Premium extraction should use `req.organizationId` like standard extraction does
- Remove the `orgId` requirement from the request body
- Remove the validation check for `orgId` in premium endpoint
- Pass `req.organizationId` to the premium extraction service

## Investigation: Why `storeUrl` vs `url`?

### Finding: This appears to be an arbitrary naming inconsistency

**Evidence:**
1. **UberEats URL Structure**: All UberEats URLs contain `/store/` in their path:
   ```
   https://www.ubereats.com/nz/store/smokey-ts-cashel-street/rWCJOIotUEGcllMiycozVw
   ```

2. **Naming Origin**: The `storeUrl` naming first appears in `PREMIUM_EXTRACTION_IMPLEMENTATION_PLAN.md`:
   - This was part of the initial design for premium extraction
   - Likely chosen because premium was initially UberEats-only and URLs contain "store"

3. **Standard Extraction Naming**: All other endpoints consistently use `url`:
   - `/api/scan-categories` uses `url`
   - `/api/batch-extract-categories` uses `url`  
   - `/api/extractions/start` uses `url`
   - `/api/extract-images-for-category` uses `url`

4. **No Technical Reason**: There's no technical difference between the URLs:
   - Both receive the exact same URL format
   - Both validate URLs the same way
   - The parameter name doesn't affect functionality

**Conclusion**: This is another inconsistency (like orgId) that should be fixed:
- Premium extraction should use `url` to match all other endpoints
- This would make the API more consistent and less confusing
- The "store" in UberEats URLs is just part of their URL pattern, not a reason for different parameter naming

## Investigation: What Determines `statusUrl` Presence?

### Finding: It's NOT a reliable indicator of premium vs standard mode!

**Evidence from Code Analysis:**

1. **Premium Extraction Response** (server.js lines 2127-2134):
   ```javascript
   if (async) {
     return res.json({
       success: true,
       jobId: result.jobId,
       estimatedTime: result.estimatedTime,
       statusUrl: `/api/premium-extract-status/${result.jobId}`,
       resultsUrl: `/api/premium-extract-results/${result.jobId}`,
       message: result.message
     });
   }
   ```

2. **Standard Extraction Response** (server.js lines 3623-3633):
   ```javascript
   return res.json({
     success: true,
     jobId: jobId,
     message: 'Extraction started',
     restaurantId: restaurantData.restaurant.id,
     trackingUrl: `/api/extractions/${jobId}`,  // Note: NOT statusUrl
     options: {...}
   });
   ```

3. **BUT: Batch Extraction Also Has statusUrl** (server.js lines 1290-1297):
   ```javascript
   // This is the old batch extraction endpoint (NOT premium)
   return res.json({
     success: true,
     jobId: jobId,
     message: 'Batch extraction started',
     estimatedTime: estimatedSeconds,
     statusUrl: `/api/batch-extract-status/${jobId}`,  // Has statusUrl!
     resultsUrl: `/api/batch-extract-results/${jobId}`
   });
   ```

**The Problem:**
- Frontend uses `statusUrl` presence to detect premium mode (line 224 in NewExtraction.jsx)
- But BOTH premium extraction AND the old batch extraction endpoint return `statusUrl`
- The new standard extraction (`/api/extractions/start`) returns `trackingUrl` instead

**Actual Differentiators:**
- Premium extraction: jobId starts with "premium_"
- Standard extraction: jobId starts with "batch_" or other prefixes
- Premium has `/api/premium-extract-status/` in statusUrl
- Standard batch has `/api/batch-extract-status/` in statusUrl

**Conclusion**: The frontend detection logic is flawed. It should check:
1. If jobId starts with "premium_" OR
2. If statusUrl contains "/premium-extract-" OR
3. Check the actual endpoint that was called

## Actual Status Checking Implementation

### Standard Extraction Status Endpoint
**Endpoint**: `GET /api/extractions/:jobId` (server.js line 3653)
```javascript
// Returns job from database or in-memory store
// If job is completed, also returns menu data with total items count
// Response includes full job details and associated menu if available
```

### Premium Extraction Status Endpoint
**Endpoint**: `GET /api/premium-extract-status/:jobId` (server.js line 2152)
```javascript
// Calls premiumExtractionService.getJobStatus(jobId)
// Returns in-memory job status from the service
// Simpler response without database lookup
```

### Key Differences in Status Checking

| Aspect | Standard Extraction | Premium Extraction |
|--------|-------------------|-------------------|
| **Status Endpoint** | `/api/extractions/${jobId}` | `/api/premium-extract-status/${jobId}` |
| **Data Source** | Database first, fallback to memory | In-memory only (service state) |
| **Auth Required** | No (public endpoint) | Yes (authMiddleware) |
| **Menu Data** | Includes menu data if completed | No menu data in status |
| **Results Endpoint** | Same endpoint returns results | Separate `/api/premium-extract-results/${jobId}` |

---

## PHASE 2: Server-Side Processing

### Premium Extraction Processing (server.js lines 2088-2147)

#### Step 1: Request Validation
```javascript
// Line 2089: Extract parameters from body
const { storeUrl, orgId, restaurantName, restaurantId, extractOptionSets, validateImages, async } = req.body;

// Lines 2091-2096: URL validation
if (!storeUrl || typeof storeUrl !== 'string') {
  return res.status(400).json({ error: 'Store URL is required' });
}

// Lines 2099-2104: Organization validation (REDUNDANT - should use req.organizationId)
if (!orgId) {
  return res.status(400).json({ error: 'Organization ID is required' });
}

// Lines 2107-2111: Platform validation
if (!storeUrl.includes('ubereats.com')) {
  return res.status(400).json({ error: 'Only UberEats URLs are supported for premium extraction' });
}
```

#### Step 2: Premium Service Call
```javascript
// Line 2117: Call premium extraction service
const result = await premiumExtractionService.extractPremiumMenu(
  storeUrl,
  orgId,  // Uses body orgId, not req.organizationId
  {
    restaurantName: restaurantName || null,
    restaurantId: restaurantId || null,
    extractOptionSets: extractOptionSets !== false,  // Default true
    validateImages: validateImages !== false,        // Default true
    async: async !== false                           // Default true
  }
);
```

#### Step 3: Response Handling
```javascript
// Lines 2127-2145: Different responses for async vs sync
if (async) {
  // Async response with job tracking URLs
  return res.json({
    success: true,
    jobId: result.jobId,           // e.g., "premium_1234567890"
    estimatedTime: result.estimatedTime,
    statusUrl: `/api/premium-extract-status/${result.jobId}`,
    resultsUrl: `/api/premium-extract-results/${result.jobId}`,
    message: result.message
  });
} else {
  // Sync response with immediate results
  return res.json({
    success: true,
    data: result,
    message: 'Premium extraction completed successfully'
  });
}
```

### Standard Extraction Processing (server.js lines 3421-3647)

#### Step 1: Request Validation
```javascript
// Line 3425: Extract parameters
const { url, platform, options = {}, restaurantId, restaurantName } = req.body;

// Lines 3427-3437: Basic validation
if (!url) {
  return res.status(400).json({ error: 'URL is required' });
}
if (!platform) {
  return res.status(400).json({ error: 'Platform is required' });
}

// Lines 3440-3444: Platform-specific validation
const supportedPlatforms = ['ubereats', 'doordash'];
if (!supportedPlatforms.includes(platform)) {
  return res.status(400).json({ error: `Unsupported platform: ${platform}` });
}
```

#### Step 2: Restaurant Management
```javascript
// Lines 3449-3517: Complex restaurant creation/association logic
let restaurantData;

if (restaurantId) {
  // Manual mode: Use existing restaurant
  const existingRestaurant = await db.getRestaurant(restaurantId);
  if (!existingRestaurant) {
    return res.status(404).json({ error: 'Selected restaurant not found' });
  }
  restaurantData = { restaurant: existingRestaurant, isNew: false };
} else {
  // Auto mode: Extract store ID and create/find restaurant
  const storeId = extractStoreId(url, platform);
  
  // Lines 3477-3487: Check for existing restaurant by store ID
  const existingByStoreId = await db.getRestaurantByStoreId(storeId, platform);
  
  if (existingByStoreId) {
    restaurantData = { restaurant: existingByStoreId, isNew: false };
  } else {
    // Lines 3490-3517: Create new restaurant
    const extractedName = await extractRestaurantName(url, platform);
    const newRestaurant = await db.createRestaurant({
      name: restaurantName || extractedName || 'Unknown Restaurant',
      store_ids: { [platform]: storeId },
      platform_urls: { [platform]: url },
      organization_id: req.organizationId  // Uses header-based org ID
    });
    restaurantData = { restaurant: newRestaurant, isNew: true };
  }
}
```

#### Step 3: Job Creation and Processing
```javascript
// Lines 3520-3536: Create extraction job in database
const jobId = `batch_${Date.now()}_${generateJobId()}`;
const dbJob = await db.createExtractionJob({
  id: jobId,
  url: url,
  platform: platform,
  restaurant_id: restaurantData.restaurant.id,
  restaurant_name: restaurantData.restaurant.name,
  status: 'pending',
  options: options,
  created_at: new Date()
}, req.organizationId);  // Uses header-based org ID

// Lines 3539-3621: Start extraction based on platform
if (platform === 'ubereats') {
  processUberEatsExtraction(jobId, url, restaurantData.restaurant, options);
} else if (platform === 'doordash') {
  processDoorDashExtraction(jobId, url, restaurantData.restaurant, options);
}
```

#### Step 4: Response
```javascript
// Lines 3623-3641: Standard response
return res.json({
  success: true,
  jobId: jobId,
  message: 'Extraction started',
  restaurantId: restaurantData.restaurant.id,
  restaurantName: restaurantData.restaurant.name,
  trackingUrl: `/api/extractions/${jobId}`,  // Note: NOT statusUrl
  isNewRestaurant: restaurantData.isNew,
  options: {
    ...options,
    platform: platform
  }
});
```

### Key Differences in Server Processing

| Aspect | Standard Extraction | Premium Extraction |
|--------|-------------------|-------------------|
| **URL Validation** | Basic presence check | Must be UberEats |
| **Platform Handling** | Required field, validated | Not required, inferred from URL |
| **Organization ID** | From header (req.organizationId) | From body (orgId) - BUG |
| **Restaurant Logic** | Complex auto-create/associate | Simple optional association |
| **Database Usage** | Heavy (job creation, restaurant management) | None (in-memory only) |
| **Job ID Format** | `batch_timestamp_random` | `premium_timestamp` |
| **Processing** | Platform-specific functions | Single premium service |
| **Response Field** | `trackingUrl` | `statusUrl` + `resultsUrl` |
| **Async Support** | Always async | Configurable async/sync |

## Why Premium Doesn't Need Platform Field

After investigation, premium extraction doesn't need the `platform` field because:

1. **Single Platform Support**: Premium extraction ONLY supports UberEats (validated at line 2107-2111)
2. **URL Validation**: The endpoint explicitly checks that the URL contains 'ubereats.com'
3. **Service Design**: The premium extraction service is specifically built for UberEats deep extraction features
4. **No Platform Branching**: Unlike standard extraction which has different processing for UberEats vs DoorDash, premium only has one path

This is by design - premium extraction is a specialized UberEats-only feature with advanced capabilities like option sets extraction and image validation that are specific to how UberEats structures their data.

---

## CRITICAL BUGS FOUND: Premium Extraction's Database Timing and Missing Data Issues

### Updated Analysis: Premium DOES Save to Database, But Has Critical Timing and Data Flow Issues

After deeper investigation of the premium extraction service implementation, I need to correct my initial hypothesis. The premium service DOES save to the database, but there are several critical bugs in HOW and WHEN it does so.

### The Real Issues

#### Issue 1: Delayed Database Job Creation
Premium extraction creates the database job ONLY in Phase 7 (line 457 in premium-extraction-service.js), which happens AFTER all extraction is complete. This causes:

**Standard Extraction Timeline:**
```
Request received → Create DB job immediately → Process extraction → Update DB → Complete
     T=0                T=0.1s                    T=1-180s         T=180s      T=181s
```

**Premium Extraction Timeline:**
```
Request received → Process extraction → Create DB job → Save menu → Complete
     T=0              T=1-180s           T=180s         T=181s      T=182s
```

**Problems:**
- No database record exists during extraction (T=0 to T=180s)
- If server crashes during extraction, no record of the job exists
- Can't query job history until extraction is complete
- Job appears in database with 'processing' status when it's actually done

#### Issue 2: Missing menuId in Results Response
The premium service saves the menu to database and stores the menuId (line 538), but NEVER includes it in the results returned to the frontend.

**Bug Location:** premium-extraction-service.js
```javascript
// Line 538: menuId is saved to jobInfo
jobInfo.menuId = savedMenu.id;

// Lines 579-593: Results object is created WITHOUT menuId
const results = {
  success: true,
  jobId,
  summary: {...},
  categories,
  items: itemsWithOptionSets,
  // MISSING: menuId: jobInfo.menuId
};

// Line 658: getJobResults returns results without menuId
return jobInfo.results;  // This doesn't include menuId!
```

**Impact:**
- Frontend expects `resultsResponse.data.menuId` (ExtractionDetail.jsx line 140)
- Since menuId is missing, frontend can't load the menu from database
- Menu display fails even though data exists in database

#### Issue 3: Status Endpoint Doesn't Return menuId Either
The `getJobStatus` method (lines 615-634) also doesn't return the menuId, even after it's been set:

```javascript
return {
  success: true,
  jobId,
  status: jobInfo.status,
  progress: jobInfo.progress,
  startTime: jobInfo.startTime,
  elapsedTime: Date.now() - jobInfo.startTime,
  error: jobInfo.error
  // MISSING: menuId: jobInfo.menuId
};
```

### Why Menu Data Processing Fails

The actual failure sequence is:
1. Premium extraction completes successfully
2. Menu IS saved to database with a menuId (Phase 7)
3. `jobInfo.menuId` is set in memory
4. BUT the results object returned doesn't include menuId
5. Frontend receives results WITHOUT menuId
6. Frontend tries to load menu but has no menuId to query
7. Menu display fails even though data exists in database

### Evidence from Code

**Frontend expects menuId (ExtractionDetail.jsx lines 140-142):**
```javascript
if (resultsResponse.data.success && resultsResponse.data.menuId) {
  // Load the menu from database with option sets
  const menuResponse = await api.get(`/menus/${resultsResponse.data.menuId}`);
```

**But service never provides it (premium-extraction-service.js line 658):**
```javascript
getJobResults(jobId) {
  // ...
  return jobInfo.results;  // results object doesn't have menuId
}
```

### The Fix Required

#### Fix 1: Include menuId in Results
```javascript
// After line 593 in premium-extraction-service.js
const results = {
  success: true,
  jobId,
  menuId: savedMenu?.id || jobInfo.menuId,  // ADD THIS
  summary: {...},
  // ... rest of results
};
```

#### Fix 2: Include menuId in Status
```javascript
// In getJobStatus method
return {
  success: true,
  jobId,
  status: jobInfo.status,
  menuId: jobInfo.menuId,  // ADD THIS
  progress: jobInfo.progress,
  // ... rest of status
};
```

#### Fix 3: Create Database Job Earlier
Move database job creation to the beginning of extraction (like standard does):
1. Create job with 'pending' status immediately
2. Update to 'processing' during extraction
3. Update to 'completed' when done
4. This ensures job exists in database throughout the process

### Comparison Table: Database Persistence Timing

| Operation | Standard Extraction | Premium Extraction | Issue |
|-----------|-------------------|-------------------|-------|
| **Create DB Job** | Immediately on request | After extraction complete | Job doesn't exist during extraction |
| **Job Status in DB** | Updated throughout | Created with wrong status | Shows 'processing' when nearly done |
| **Menu Save** | After extraction | After extraction | ✓ Works correctly |
| **menuId in Response** | Included in job data | **MISSING** | **BUG: Frontend can't load menu** |
| **Recovery after Crash** | Can resume from DB | Lost completely | No DB record until Phase 7 |

### Impact Summary

The bugs explain why premium extraction appears to fail:
1. **Menu data IS saved** to database (contrary to initial hypothesis)
2. **But frontend can't access it** because menuId is missing from response
3. **Plus timing issues** make debugging difficult (job appears late in DB)
4. **And crash recovery is impossible** (no DB record during extraction)

---

*End of Corrected Analysis*

---

## PHASE 3: Actual Extraction Processing Logic

### Standard Extraction Processing (startBackgroundExtraction)

Located in server.js (line 123), standard extraction ALSO uses a multi-phase batch approach:

**Phase 1: Category Detection** (lines 3540-3613)
- Uses platform-specific prompts to detect categories
- Calls Firecrawl with CATEGORY_DETECTION_SCHEMA
- Extracts category list from response

**Phase 2: Background Processing Initiation** (line 3616)
- Calls `startBackgroundExtraction` with found categories
- Creates job in memory store
- Updates database job status to 'running'

**Phase 3: Category-by-Category Extraction** (lines 194-272)
- Processes categories with concurrency limit of 2
- Uses category-specific schemas and prompts
- Each category extracted independently
- Handles failures per category

**Phase 4: Results Aggregation & Database Save**
- Aggregates results from all categories
- Saves to database using `databaseService.saveExtractionResults`
- Updates job status to 'completed'

Key characteristics:
- Two-phase extraction (category detection → item extraction)
- Category-by-category processing with concurrency
- Database job created early, updated throughout
- Per-category error handling

### Premium Extraction Processing (runExtraction)

Located in premium-extraction-service.js, this is a multi-phase orchestrated process:

**Phase 1: Category Extraction** (lines 296-300)
- Extracts all category names first
- Uses specialized Firecrawl schema for categories

**Phase 2: Category-by-Category Item Extraction** (lines 302-346)
- Processes each category individually
- Extracts items with modal URLs
- Uses concurrency control (2 categories at a time)
- Handles failures gracefully per category

**Phase 3: URL Cleaning** (lines 349-355)
- Cleans modal URLs to get direct item links
- Removes tracking parameters
- Validates URL format

**Phase 4: Option Sets Extraction** (lines 358-369)
- Extracts customization options for each item
- Only if `extractOptionSets` is true
- Uses cleaned URLs from Phase 3

**Phase 5: Option Sets Deduplication** (lines 372-380)
- Identifies duplicate option sets
- Creates shared references
- Reduces data redundancy

**Phase 6: Image Validation** (lines 383-393)
- Validates image URLs are accessible
- Only if `validateImages` is true
- Checks for placeholder images

**Phase 7: Database Persistence** (lines 400-576)
- Creates/updates restaurant
- Creates extraction job (LATE!)
- Saves menu with all items
- Saves option sets for each item

### Key Processing Differences - CORRECTED

| Aspect | Standard | Premium |
|--------|----------|---------|
| **Category Detection** | Separate phase with platform-specific prompts | Single phase with generic prompt |
| **Extraction Strategy** | Category by category (like premium!) | Category by category |
| **Phases** | 4 phases (detect → extract → aggregate → save) | 7 phases (more granular) |
| **Error Handling** | Per-category failure handling | Per-category failure handling |
| **Concurrency** | 2 categories at a time | 2 categories at a time |
| **URL Processing** | Direct URLs as-is | Clean modal URLs first |
| **Option Sets** | Not extracted | Full extraction & deduplication |
| **Image Handling** | Save URLs as-is | Validate accessibility |
| **Progress Tracking** | Basic status updates | Detailed phase progress |
| **Memory Usage** | Stream to DB as available | All in memory until Phase 7 |
| **Database Job** | Created immediately, updated throughout | Created only in Phase 7 |

### The Real Similarity: Both Use Batch Category Processing!

Contrary to the initial analysis, BOTH standard and premium extractions use category-by-category batch processing:

**Standard Extraction Flow:**
1. Scan page for categories (Firecrawl call #1)
2. For each category, extract items (Firecrawl call #2, #3, etc.)
3. Process with concurrency limit of 2
4. Save to database as results come in

**Premium Extraction Flow:**
1. Extract all categories (Firecrawl call #1)
2. For each category, extract items with modal URLs (Firecrawl call #2, #3, etc.)
3. Process with concurrency limit of 2
4. Additional phases for URL cleaning, option sets, etc.
5. Save everything to database at the end

The key differences are NOT in the batch processing approach, but in:
- **When database persistence happens** (immediate vs delayed)
- **Additional processing steps** (premium has URL cleaning, option sets, image validation)
- **Data flow** (standard streams to DB, premium holds in memory)

---

## Current Implementation Status (Updated: 2025-09-03)

### ✅ Fixed Issues

1. **Database Column Name Mismatches**
   - Fixed `required` → `is_required` in option_sets table
   - Fixed `price_adjustment` → `price` in option_set_items table
   - Schema now correctly matches database structure

2. **Missing orgId Parameter**
   - Fixed `updateMenuItemOptionSets` call to include orgId parameter
   - Function signature: `(menuItemId, hasOptionSets, orgId)`

3. **Organization ID Handling**
   - Premium now uses `req.organizationId` from headers (via middleware)
   - Removed redundant `orgId` from request body
   - Consistent with standard extraction approach

4. **Field Naming Issues**
   - Fixed `category` → `categoryName` for consistency
   - Fixed image field case sensitivity (`imageUrl` vs `imageURL`)

5. **SavedMenu Structure Bug**
   - Fixed accessing nested structure: `savedMenu.menu.id` instead of `savedMenu.id`
   - Menu items accessed via `savedMenu.items` not `savedMenu.categories`

6. **Verbose Logging Reduction**
   - Organization middleware now skips logging for status polling endpoints
   - Reduces noise during extraction progress checks

### ✅ Fully Working

1. **Option Sets Extraction and Storage**
   - ✅ Successfully extracts option sets from UberEats
   - ✅ Saves option sets to database with correct schema
   - ✅ Saves option set items with correct pricing
   - ✅ **Fixed**: Now uses batch insertion for better performance
   - ✅ **Fixed**: Frontend properly displays option sets

2. **Menu Data Persistence**
   - ✅ Menu saves successfully with all items
   - ✅ Images are preserved through all phases
   - ✅ Categories and items have correct relationships
   - ✅ menuId included in results and properly used

3. **Frontend Option Sets Display**
   - ✅ API endpoint includes option sets in menu query
   - ✅ MenuDetail component transforms and displays option sets
   - ✅ OptionSetsDisplay component renders customization options

### 🔴 Remaining Issues

### 1. **Database Job Creation Timing**
- Standard creates job immediately
- Premium creates job only after extraction completes
- No crash recovery for premium extraction

### 2. **Unreliable Premium Detection**
- Frontend uses `statusUrl` presence (unreliable)
- Should use jobId prefix or endpoint path

## Final Implementation Notes

### Option Sets Data Flow (Working)
1. **Extraction Phase 4**: Successfully extracts option sets from UberEats
2. **Phase 5**: Deduplication working correctly
3. **Phase 7**: Batch saves to database efficiently
4. **Database**: Data correctly stored with proper schema
5. **API Response**: Includes option sets in menu fetch query
6. **Frontend**: Components properly transform and display option sets

### Database Schema Verification
- `option_sets` table columns confirmed:
  - `is_required` (boolean) ✅
  - `display_order` (integer) ✅
  - `min_selections` (integer) ✅
  - `max_selections` (integer) ✅
  
- `option_set_items` table columns confirmed:
  - `price` (numeric) ✅
  - `display_order` (integer) ✅
  - `description` (text) ✅

## Next Steps Priority

1. **MEDIUM - Early job creation**: 
   - Create database job at extraction start
   - Enable crash recovery
   - Update status tracking to use database

2. **LOW - Better premium detection**: 
   - Use jobId prefix pattern matching
   - Or check endpoint path instead of statusUrl presence

---

*End of Updated Extraction Flow Analysis*