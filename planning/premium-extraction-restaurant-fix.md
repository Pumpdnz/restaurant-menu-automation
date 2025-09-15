# Premium Extraction Restaurant ID Fix - Implementation Plan

## Executive Summary
The premium extraction feature is creating duplicate restaurants instead of using the existing restaurant when initiated from the RestaurantDetail page. This occurs because the `restaurantId` parameter is sent from the frontend but ignored by the backend, causing the system to create/find restaurants by name instead.

## Root Cause Analysis

### Issue Flow
```
Frontend (RestaurantDetail.jsx)
    ↓ sends restaurantId
Backend (server.js:2100)
    ✗ ignores restaurantId parameter
    ↓
Premium Extraction Service
    ↓ extracts name from URL
Database Service (upsertRestaurant)
    ↓ generates slug from name
    ✗ creates new restaurant (slug mismatch)
```

### Detailed Problem Breakdown

#### 1. Frontend Behavior (CORRECT)
**File**: `src/pages/RestaurantDetail.jsx:1569`
```javascript
response = await api.post('/extract-menu-premium', {
  storeUrl: extractionConfig.url,
  restaurantId: extractionConfig.restaurantId,  // ✓ Sends restaurant ID
  restaurantName: extractionConfig.restaurantName,
  extractOptionSets: extractOptionSets,
  validateImages: validateImages,
  async: true
});
```

#### 2. Backend Endpoint (PROBLEM)
**File**: `server.js:2100`
```javascript
app.post('/api/extract-menu-premium', authMiddleware, async (req, res) => {
  // ✗ Does NOT destructure restaurantId from request body
  const { storeUrl, restaurantName, extractOptionSets = true, validateImages = true, async = false } = req.body;
  // ...
  const result = await premiumExtractionService.extractPremiumMenu(storeUrl, orgId, {
    restaurantName,  // Only passes name, not ID
    extractOptionSets,
    validateImages,
    async,
    saveToDatabase: true
  });
```

#### 3. Premium Extraction Service (PROBLEM)
**File**: `src/services/premium-extraction-service.js:268`
```javascript
// Creates/finds restaurant by name instead of using provided ID
const restaurantResult = await databaseService.upsertRestaurant({
  name: restaurantName,
  url: storeUrl,
  platformName: 'ubereats'
}, orgId);
```

#### 4. Database Service Slug Generation (CONSEQUENCE)
**File**: `src/services/database-service.js:126-128`
```javascript
// Generates slug from name - any variation creates new restaurant
const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const orgSuffix = orgId.substring(0, 8);
const slug = `${baseSlug}-${orgSuffix}`;
```

### Why Duplicates Occur
1. Restaurant name extracted from URL may differ from stored name
2. Examples of mismatches:
   - "Chaat Street" vs "chaat-street"
   - "Chaat Street Wellington" vs "Chaat Street"
   - Case differences, spacing, special characters
3. Different slug = new restaurant created

## Implementation Plan

### Phase 1: Backend Endpoint Updates

#### 1.1 Update server.js endpoint
**File**: `server.js:2100`
```javascript
app.post('/api/extract-menu-premium', authMiddleware, async (req, res) => {
  // ADD restaurantId to destructuring
  const {
    storeUrl,
    restaurantId,  // NEW
    restaurantName,
    extractOptionSets = true,
    validateImages = true,
    async = false
  } = req.body;

  // ... validation ...

  const result = await premiumExtractionService.extractPremiumMenu(storeUrl, orgId, {
    restaurantId,  // NEW - pass restaurant ID
    restaurantName,
    extractOptionSets,
    validateImages,
    async,
    saveToDatabase: true
  });
```

### Phase 2: Premium Extraction Service Updates

#### 2.1 Update extractPremiumMenu method signature
**File**: `src/services/premium-extraction-service.js:213`
```javascript
async extractPremiumMenu(storeUrl, orgId, options = {}) {
  const {
    restaurantId: providedRestaurantId = null,  // NEW - accept restaurant ID
    extractOptionSets = true,
    validateImages = true,
    async = false,
    saveToDatabase = true
  } = options;
```

#### 2.2 Update restaurant resolution logic
**File**: `src/services/premium-extraction-service.js:255-284`
```javascript
// Restaurant resolution logic
let restaurantId = providedRestaurantId;  // Use provided ID if available
let platformId = 1; // Default to UberEats

if (saveToDatabase) {
  try {
    // Get platform ID for UberEats
    const platform = await databaseService.getPlatformByName('ubereats');
    if (platform) {
      platformId = platform.id;
    }

    // If restaurant ID provided, verify it exists
    if (restaurantId) {
      const existingRestaurant = await databaseService.getRestaurantById(restaurantId, orgId);
      if (!existingRestaurant) {
        throw new Error(`Restaurant with ID ${restaurantId} not found`);
      }
      console.log(`[${orgId}] Using existing restaurant with ID: ${restaurantId}`);

      // Optionally update restaurant metadata/URLs if needed
      await databaseService.updateRestaurantPlatformUrl({
        restaurantId,
        platformId,
        url: storeUrl
      }, orgId);

    } else {
      // Fall back to create/find by name (for standalone extractions)
      const restaurantResult = await databaseService.upsertRestaurant({
        name: restaurantName,
        url: storeUrl,
        platformName: 'ubereats'
      }, orgId);

      if (restaurantResult && restaurantResult.restaurant) {
        restaurantId = restaurantResult.restaurant.id;
        console.log(`[${orgId}] Restaurant created/found with ID: ${restaurantId}`);
      } else {
        throw new Error('Restaurant creation failed - no restaurant data returned');
      }
    }
  } catch (error) {
    console.error(`[${orgId}] Failed to resolve restaurant:`, error.message);
    // ... error handling ...
  }
}
```

#### 2.3 Update job creation
**File**: `src/services/premium-extraction-service.js:337-339`
```javascript
const dbJob = await databaseService.createExtractionJob({
  jobId,
  restaurantId: restaurantId,  // Use the resolved restaurant ID
  platformId: platformId,
  url: storeUrl,
  jobType: 'premium_extraction',
  // ...
}, orgId);
```

### Phase 3: Database Service Additions

#### 3.1 Add getRestaurantById method
**File**: `src/services/database-service.js`
```javascript
async function getRestaurantById(restaurantId, organisationId = null) {
  if (!isDatabaseAvailable()) return null;

  const orgId = organisationId || getCurrentOrganizationId();

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('organisation_id', orgId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting restaurant by ID:', error);
    return null;
  }
}
```

#### 3.2 Add updateRestaurantPlatformUrl method
**File**: `src/services/database-service.js`
```javascript
async function updateRestaurantPlatformUrl(data, organisationId = null) {
  if (!isDatabaseAvailable()) return null;

  const { restaurantId, platformId, url } = data;
  const orgId = organisationId || getCurrentOrganizationId();

  try {
    const client = getSupabaseClient();

    // Check if platform URL already exists
    const { data: existing } = await client
      .from('restaurant_platform_urls')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('platform_id', platformId)
      .eq('organisation_id', orgId)
      .single();

    if (existing) {
      // Update existing URL
      const { data: updated, error } = await client
        .from('restaurant_platform_urls')
        .update({ url, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    } else {
      // Insert new platform URL
      const { data: inserted, error } = await client
        .from('restaurant_platform_urls')
        .insert({
          restaurant_id: restaurantId,
          platform_id: platformId,
          url,
          organisation_id: orgId
        })
        .select()
        .single();

      if (error) throw error;
      return inserted;
    }
  } catch (error) {
    console.error('[Database] Error updating restaurant platform URL:', error);
    return null;
  }
}
```

#### 3.3 Export new methods
**File**: `src/services/database-service.js` (at the end)
```javascript
module.exports = {
  // ... existing exports ...
  getRestaurantById,
  updateRestaurantPlatformUrl,
  // ...
};
```

### Phase 4: Frontend Validation (Optional Enhancement)

#### 4.1 Add restaurant ID validation
**File**: `src/pages/RestaurantDetail.jsx:1560`
```javascript
const handleStartExtraction = async () => {
  setIsExtracting(true);
  setExtractionError(null);

  // Validate restaurant ID exists
  if (!extractionConfig.restaurantId && id) {
    console.warn('Restaurant ID missing from extraction config, using page ID');
    extractionConfig.restaurantId = id;
  }

  try {
    let response;
    if (extractionMode === 'premium') {
      // ... existing premium extraction code ...
    }
```

## Testing Strategy

### 1. Unit Tests
- Test `getRestaurantById` method with valid/invalid IDs
- Test `updateRestaurantPlatformUrl` for insert/update scenarios
- Test premium extraction service with/without restaurant ID

### 2. Integration Tests
- Test premium extraction from RestaurantDetail page
- Verify no duplicate restaurants created
- Test extraction without restaurant ID (standalone)
- Test with invalid restaurant ID

### 3. Manual Testing Checklist
- [ ] Navigate to existing restaurant detail page
- [ ] Click "Extract Menu" button
- [ ] Select premium extraction
- [ ] Start extraction
- [ ] Verify extraction applies to current restaurant
- [ ] Check database - no duplicate restaurant created
- [ ] Verify menu items associated with correct restaurant
- [ ] Test standard extraction still works
- [ ] Test extraction from Extractions page (without restaurant context)

### 4. Edge Cases to Test
- Restaurant ID provided but doesn't exist
- Restaurant ID from different organization
- Extraction without restaurant ID (from extractions page)
- Multiple concurrent extractions for same restaurant
- Switching between standard and premium extraction

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   - Revert server.js changes
   - Revert premium-extraction-service.js changes
   - No database changes required (backward compatible)

2. **Data Cleanup** (if needed)
   - Identify duplicate restaurants created during issue period
   - Merge or remove duplicates
   - Reassociate menus with correct restaurants

## Success Metrics

1. **No Duplicate Restaurants**: Zero new restaurant records when extracting from existing restaurant pages
2. **Correct Association**: 100% of extractions associate with intended restaurant
3. **Backward Compatibility**: Standalone extractions continue to work
4. **Performance**: No degradation in extraction speed

## Timeline

- **Phase 1-3**: Core implementation (2-3 hours)
- **Phase 4**: Optional enhancements (30 minutes)
- **Testing**: Comprehensive testing (1-2 hours)
- **Total Estimate**: 3-5 hours

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing extractions | High | Maintain backward compatibility with null restaurant ID |
| Invalid restaurant IDs | Medium | Add validation and error handling |
| Performance impact | Low | Restaurant lookup is single DB query |
| Data inconsistency | Medium | Add transaction support if needed |

## Post-Implementation Monitoring

1. Monitor extraction job logs for errors
2. Check for new duplicate restaurants daily
3. Track extraction success rates
4. Monitor user feedback for issues

## Approval and Sign-off

- [ ] Development team review
- [ ] Testing complete
- [ ] Documentation updated
- [ ] Deployment approved

---

*Document created: 2025-01-14*
*Last updated: 2025-01-14*
*Author: System Analysis*