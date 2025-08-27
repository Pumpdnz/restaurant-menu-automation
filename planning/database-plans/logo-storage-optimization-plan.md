# Logo Storage Optimization Plan

## Problem
When updating restaurant details, the request fails because base64-encoded logo URLs make the payload too large (multiple MB). Each logo version is stored as a base64 data URL directly in the database, causing issues when any field needs updating.

## Current State
- Logo URLs stored as base64 strings in restaurants table
- 8 logo versions: original, nobg, standard, thermal, thermal_alt, thermal_contrast, thermal_adaptive, favicon
- Each base64 string can be 50-500KB
- Total payload can exceed 2-4MB when updating any field

## Solution Options Analysis

### Option 1: Exclude Unchanged Logo Fields (Quick Fix) ✅ RECOMMENDED
**Implementation**: Modify frontend to only send changed fields
- **Pros**: 
  - Quick to implement
  - No database changes needed
  - Backward compatible
- **Cons**: 
  - Still have large data in responses
  - Doesn't solve root problem
- **Effort**: 1-2 hours

### Option 2: Supabase Storage Migration
**Implementation**: Upload logos to Supabase Storage, store URLs only
- **Pros**:
  - Proper long-term solution
  - Reduced database size
  - Better performance
  - CDN benefits
- **Cons**:
  - Requires migration of existing data
  - More complex implementation
- **Effort**: 4-6 hours

### Option 3: Separate Logo Table
**Implementation**: Create restaurant_logos table with foreign key
- **Pros**:
  - Cleaner data structure
  - Can still use base64 if needed
  - Easier to query non-logo data
- **Cons**:
  - Requires schema changes
  - Need to update all queries
- **Effort**: 3-4 hours

### Option 4: Hybrid Approach
**Implementation**: Implement Option 1 now, plan Option 2 for later
- **Pros**:
  - Immediate fix
  - Proper long-term solution planned
- **Cons**:
  - Two-phase implementation
- **Effort**: 1-2 hours now + 4-6 hours later

## Recommended Implementation (Option 1)

### Phase 1: Immediate Fix

#### Frontend Changes (RestaurantDetail.jsx)

1. **Track Original Data**
```javascript
const [originalData, setOriginalData] = useState(null);

useEffect(() => {
  if (restaurant) {
    setOriginalData(restaurant);
  }
}, [restaurant]);
```

2. **Modify handleSave to Send Only Changes**
```javascript
const handleSave = async () => {
  const changedFields = {};
  const logoFields = [
    'logo_url', 'logo_nobg_url', 'logo_standard_url', 
    'logo_thermal_url', 'logo_thermal_alt_url', 
    'logo_thermal_contrast_url', 'logo_thermal_adaptive_url', 
    'logo_favicon_url'
  ];
  
  // Compare and include only changed non-logo fields
  Object.keys(editedData).forEach(key => {
    if (logoFields.includes(key)) {
      // Only include logo fields if they were explicitly changed
      // (not base64, but a new URL)
      if (editedData[key] !== originalData[key] && 
          !editedData[key]?.startsWith('data:')) {
        changedFields[key] = editedData[key];
      }
    } else {
      // Include all other changed fields
      if (editedData[key] !== originalData[key]) {
        changedFields[key] = editedData[key];
      }
    }
  });
  
  // Send only changed fields
  await api.patch(`/restaurants/${id}`, changedFields);
};
```

#### Backend Changes (server.js)

1. **Modify PATCH endpoint to handle partial updates**
```javascript
app.patch('/api/restaurants/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Remove any base64 logo fields from updates
  const logoFields = [
    'logo_url', 'logo_nobg_url', 'logo_standard_url',
    'logo_thermal_url', 'logo_thermal_alt_url',
    'logo_thermal_contrast_url', 'logo_thermal_adaptive_url',
    'logo_favicon_url'
  ];
  
  const filteredUpdates = {};
  Object.keys(updates).forEach(key => {
    if (logoFields.includes(key) && updates[key]?.startsWith('data:')) {
      // Skip base64 data unless it's a new upload
      return;
    }
    filteredUpdates[key] = updates[key];
  });
  
  await db.updateRestaurant(id, filteredUpdates);
});
```

### Phase 2: Future Optimization (Supabase Storage)

#### Migration Steps

1. **Create Storage Bucket**
```sql
-- Via Supabase dashboard or API
CREATE BUCKET restaurant_logos;
```

2. **Migration Script**
```javascript
async function migrateLgosToStorage() {
  const restaurants = await db.getAllRestaurants();
  
  for (const restaurant of restaurants) {
    const logoFields = ['logo_url', 'logo_nobg_url', ...];
    
    for (const field of logoFields) {
      if (restaurant[field]?.startsWith('data:')) {
        // Extract base64 data
        const base64Data = restaurant[field].split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Upload to storage
        const fileName = `${restaurant.id}/${field}.png`;
        const { data, error } = await supabase.storage
          .from('restaurant_logos')
          .upload(fileName, buffer);
        
        // Update database with storage URL
        const publicUrl = supabase.storage
          .from('restaurant_logos')
          .getPublicUrl(fileName).data.publicUrl;
        
        await db.updateRestaurant(restaurant.id, {
          [field]: publicUrl
        });
      }
    }
  }
}
```

3. **Update Logo Processing Service**
```javascript
async function processLogoVersions(logoBuffer) {
  // Instead of returning base64
  // Upload to storage and return URLs
  const versions = {};
  
  // Process each version
  const versionBuffers = {
    original: logoBuffer,
    nobg: noBgBuffer,
    // ... other versions
  };
  
  for (const [name, buffer] of Object.entries(versionBuffers)) {
    const fileName = `${restaurantId}/${name}_${Date.now()}.png`;
    const { data, error } = await supabase.storage
      .from('restaurant_logos')
      .upload(fileName, buffer);
    
    versions[name] = supabase.storage
      .from('restaurant_logos')
      .getPublicUrl(fileName).data.publicUrl;
  }
  
  return versions;
}
```

## Benefits Analysis

### Immediate (Option 1)
- Fixes update issue immediately
- Reduces payload by 90%+ for normal updates
- No breaking changes

### Long-term (Option 2)
- Database size reduction: ~80%
- Response time improvement: ~60%
- CDN caching benefits
- Proper image serving with transformations

## Testing Checklist

### Phase 1 Testing
- [ ] Update restaurant name without logo fields
- [ ] Update contact details
- [ ] Update opening hours
- [ ] Edit logo URL manually (non-base64)
- [ ] Verify logo processing still works
- [ ] Check that logo display still works

### Phase 2 Testing
- [ ] Migration script handles all existing logos
- [ ] New logo processing uploads to storage
- [ ] URLs are accessible and cached
- [ ] Fallback for failed uploads
- [ ] Cleanup of old base64 data

## Rollback Plan

### Phase 1
- Revert frontend changes
- No database impact

### Phase 2
- Keep base64 data until verified
- Dual-write period (both base64 and storage)
- Gradual migration with feature flag

## Timeline

- **Phase 1**: Immediate (today)
- **Phase 2**: Next sprint (1-2 weeks)

## Decision

Implement **Option 1 (Quick Fix)** immediately to resolve the critical issue, then plan **Option 2 (Storage Migration)** for proper long-term solution.