# Implementation Checklist - Restaurant Duplication Fix

## Overview
This checklist guides you through implementing the complete `duplicate_restaurant_to_org` function that duplicates ALL restaurant data including categories, images, and option sets.

## Pre-Implementation

### 1. Review Documentation
- [ ] Read [duplicate-problem-analysis.md](duplicate-problem-analysis.md)
- [ ] Read [duplicate-solution-implementation-plan.md](duplicate-solution-implementation-plan.md)
- [ ] Understand what tables will be duplicated
- [ ] Understand ID mapping requirements

### 2. Backup Strategy
- [ ] Take database snapshot/backup via Supabase dashboard
- [ ] Note the backup timestamp for rollback reference
- [ ] Verify backup completed successfully

### 3. Test Data Preparation (Recommended)
- [ ] Identify a test restaurant with full data:
  - Has categories
  - Has menu items with images
  - Has option sets with items
- [ ] Document the restaurant ID
- [ ] Run pre-duplication snapshot query (see duplicate-verification-queries.sql #2)
- [ ] Save the output for comparison

## Implementation

### 4. Apply Migration
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Open [duplicate_restaurant_to_org_complete.sql](duplicate_restaurant_to_org_complete.sql)
- [ ] Copy the entire SQL content
- [ ] Paste into Supabase SQL Editor
- [ ] Review the SQL one more time
- [ ] Click "Run" to execute the migration
- [ ] Wait for "Success" confirmation

### 5. Verify Function Creation
- [ ] Run verification query #1 from [duplicate-verification-queries.sql](duplicate-verification-queries.sql)
- [ ] Confirm function exists with JSONB return type
- [ ] Check that function comment is present

```sql
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'duplicate_restaurant_to_org';
```

Expected: 1 row with `routine_type = 'FUNCTION'` and `data_type = 'jsonb'`

## Testing

### 6. Test Edge Cases (Important!)
Run these tests to ensure error handling works:

- [ ] **Test: Invalid restaurant ID**
```sql
SELECT duplicate_restaurant_to_org(
  '00000000-0000-0000-0000-000000000000'::UUID,
  'VALID_TARGET_ORG_ID'::UUID
);
```
Expected: ERROR: Restaurant with ID ... not found ✓

- [ ] **Test: Invalid target org ID**
```sql
SELECT duplicate_restaurant_to_org(
  'VALID_RESTAURANT_ID'::UUID,
  '00000000-0000-0000-0000-000000000000'::UUID
);
```
Expected: ERROR: Target organization with ID ... not found ✓

### 7. Test Real Duplication
Choose a test restaurant and duplicate it:

- [ ] Get pre-duplication counts (verification query #2)
- [ ] Run the duplication:
```sql
SELECT duplicate_restaurant_to_org(
  'TEST_RESTAURANT_ID'::UUID,
  'TARGET_ORG_ID'::UUID
);
```
- [ ] Review the returned JSONB (should show duplicated_counts)
- [ ] Note the new_restaurant_id from the response

### 8. Verify Duplication Completeness
- [ ] Run comparison query (verification query #4)
- [ ] Confirm counts match between source and duplicate
- [ ] Check foreign key integrity (query #5) - should return 0 rows
- [ ] Verify images duplicated (query #6)
- [ ] Verify option sets duplicated (query #7)
- [ ] Check for cross-org references (query #8) - should return 0 rows

## Critical Verification

### 9. Verify ID Mappings
The most critical aspect - ensure foreign keys point to new records:

- [ ] **Categories**: menu_items.category_id points to new categories
```sql
-- Should return 0 rows (all valid)
SELECT mi.id, mi.category_id, c.id
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
LEFT JOIN categories c ON mi.category_id = c.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID'
  AND mi.category_id IS NOT NULL
  AND c.id IS NULL;
```

- [ ] **Images**: item_images.menu_item_id points to new menu items
```sql
-- Should return counts > 0 if original had images
SELECT COUNT(*)
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID';
```

- [ ] **Option Sets**: menu_item_option_sets links new menu items to new option sets
```sql
-- Should return counts > 0 if original had options
SELECT COUNT(*)
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID';
```

### 10. Verify Source Unchanged
- [ ] Run query #12 to confirm source restaurant unchanged
- [ ] Compare with pre-duplication snapshot
- [ ] Verify all counts match original

## Post-Implementation

### 11. Data Integrity Checks
- [ ] Run cross-org reference check (query #8)
- [ ] Confirm 0 rows returned
- [ ] Check usage_events audit log (query #9)
- [ ] Verify all duplications logged correctly

### 12. Performance Monitoring
- [ ] Check duplication duration (query #11)
- [ ] Should be < 10 seconds for typical restaurants
- [ ] Monitor for any performance issues

### 13. Update API Server
The Node.js endpoint needs to be updated to handle the new JSONB return format:

**Current code** (in server.js around line 8023):
```javascript
const { data, error } = await supabase.rpc('duplicate_restaurant_to_org', {
  p_restaurant_id: restaurantId,
  p_target_org_id: targetOrgId
});

if (error) {
  results.push({ restaurantId, success: false, error: error.message });
} else {
  results.push({ restaurantId, success: true, newRestaurantId: data });
}
```

**Updated code**:
```javascript
const { data, error } = await supabase.rpc('duplicate_restaurant_to_org', {
  p_restaurant_id: restaurantId,
  p_target_org_id: targetOrgId
});

if (error) {
  results.push({
    restaurantId,
    success: false,
    error: error.message
  });
} else {
  results.push({
    restaurantId,
    success: data.success,
    newRestaurantId: data.new_restaurant_id,
    duplicatedCounts: data.duplicated_counts,
    sourceOrgId: data.source_org_id,
    targetOrgId: data.target_org_id
  });
}
```

- [ ] Update the endpoint code in server.js
- [ ] Test the endpoint via API call
- [ ] Verify response includes duplicated_counts and new_restaurant_id

### 14. Application Testing
Test the duplicated restaurant in the application:

- [ ] Log into target organization
- [ ] Navigate to the duplicated restaurant
- [ ] Verify restaurant details visible
- [ ] Verify all menus visible
- [ ] Verify categories appear correctly
- [ ] Verify menu items appear correctly
- [ ] **Verify menu item images display**
- [ ] **Verify customization options work (sizes, add-ons)**
- [ ] Test adding items to cart with options
- [ ] Verify everything functions correctly

### 15. Documentation
- [ ] Update API documentation with new response format
- [ ] Document the 8 tables that get duplicated
- [ ] Add notes about ID mapping
- [ ] Update runbooks for operations team

## Rollback Plan (If Needed)

If something goes wrong:

### Option 1: Restore from Backup
- [ ] Go to Supabase Dashboard → Database → Backups
- [ ] Restore from the backup taken in step 2
- [ ] Verify restoration successful

### Option 2: Delete Duplicated Restaurant
If the duplication created bad data:
- [ ] Get new_restaurant_id from the function response or usage_events
- [ ] Delete the restaurant (cascades will clean up related data):
```sql
DELETE FROM restaurants WHERE id = 'NEW_RESTAURANT_ID';
```
- [ ] Verify deletion completed

### Option 3: Revert to Old Function
- [ ] Run the old function definition (from duplicate_restaurant_to_org_incomplete.sql)
- [ ] This will restore old (incomplete) behavior

## Success Criteria

✅ Migration applied successfully
✅ Function created with correct signature
✅ All edge case tests pass
✅ Test duplication completes successfully
✅ All foreign key references valid
✅ Source restaurant unchanged
✅ Duplicated counts match source counts
✅ No cross-organization references
✅ Images display in application
✅ Customization options work in application
✅ API endpoint updated and tested
✅ No errors in production logs

## What Gets Duplicated

The complete function now duplicates **8 tables**:
- ✅ **restaurants** - New restaurant with " (Copy)" appended
- ✅ **menus** - All menus
- ✅ **categories** - All categories (with ID mapping)
- ✅ **menu_items** - All items (with correct category references)
- ✅ **item_images** - All images (with new menu_item_id)
- ✅ **option_sets** - All option sets (with ID mapping)
- ✅ **option_set_items** - All option items (with new option_set_id)
- ✅ **menu_item_option_sets** - All associations (with new IDs)

## What Doesn't Get Duplicated (By Design)

- ❌ **extraction_jobs** - Job history stays with original
- ❌ **pumpd_accounts** - Account credentials not duplicated
- ❌ **pumpd_restaurants** - Pumpd integration not duplicated
- ❌ **usage_events** - Event history stays with original

## Key Improvements Over Original

1. **Categories duplicated** - Menu structure preserved
2. **Menu item ID mapping** - Critical for images and options
3. **Images duplicated** - Menu items have images
4. **Option sets duplicated** - Customization works
5. **Option items duplicated** - All choices available
6. **Proper FK remapping** - All references point to new records
7. **JSONB response** - Detailed counts returned
8. **Error handling** - Proper validation and logging
9. **Audit trail** - All duplications logged

## Notes

- The duplication is **atomic** - all or nothing in single transaction
- All ID mappings handled automatically
- Failed duplications are **logged in usage_events** with error details
- The function returns **detailed duplicated_counts** for transparency
- Performance should be good (<10s) due to indexed queries

## Support

If you encounter issues:
1. Check the usage_events table for error logs
2. Review the verification queries output
3. Check Supabase logs for detailed error messages
4. Verify all ID mappings worked correctly (most common issue)
5. Refer to the duplicate-problem-analysis.md for troubleshooting

## Common Issues and Solutions

### Issue: menu_items.category_id is NULL
**Cause**: Categories duplicated after menu items
**Solution**: The function now duplicates categories BEFORE menu items ✓

### Issue: Images not showing
**Cause**: menu_item_id not remapped
**Solution**: The function now tracks menu_item mapping ✓

### Issue: No customization options
**Cause**: Option sets not duplicated
**Solution**: The function now duplicates all option-related tables ✓

### Issue: Foreign key violations
**Cause**: References to old org's data
**Solution**: The function now remaps all FKs using ID mappings ✓
