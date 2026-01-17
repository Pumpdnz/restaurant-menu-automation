# Implementation Checklist - Restaurant Data Reassignment Fix

## Pre-Implementation

### 1. Review Documentation
- [ ] Read [problem-analysis.md](problem-analysis.md)
- [ ] Read [solution-implementation-plan.md](solution-implementation-plan.md)
- [ ] Understand what tables will be updated

### 2. Backup Strategy
- [ ] Take database snapshot/backup via Supabase dashboard
- [ ] Note the backup timestamp for rollback reference
- [ ] Verify backup completed successfully

### 3. Test Data Preparation (Optional but Recommended)
- [ ] Identify a test restaurant to use for validation
- [ ] Document the restaurant ID and current organization ID
- [ ] Run pre-reassignment snapshot query (see verification-queries.sql #2)
- [ ] Save the output for comparison

## Implementation

### 4. Apply Migration
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Open [reassign_restaurant_to_org_complete.sql](reassign_restaurant_to_org_complete.sql)
- [ ] Copy the entire SQL content
- [ ] Paste into Supabase SQL Editor
- [ ] Review the SQL one more time
- [ ] Click "Run" to execute the migration
- [ ] Wait for "Success" confirmation

### 5. Verify Function Creation
- [ ] Run verification query #1 from [verification-queries.sql](verification-queries.sql)
- [ ] Confirm function exists with JSONB return type
- [ ] Check that function comment is present

```sql
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'reassign_restaurant_to_org';
```

Expected: 1 row with `routine_type = 'FUNCTION'` and `data_type = 'jsonb'`

## Testing

### 6. Test Edge Cases (Important!)
Run these tests to ensure error handling works:

- [ ] **Test: Invalid restaurant ID**
```sql
SELECT reassign_restaurant_to_org(
  '00000000-0000-0000-0000-000000000000'::UUID,
  'VALID_TARGET_ORG_ID'::UUID
);
```
Expected: ERROR: Restaurant with ID ... not found ✓

- [ ] **Test: Invalid target org ID**
```sql
SELECT reassign_restaurant_to_org(
  'VALID_RESTAURANT_ID'::UUID,
  '00000000-0000-0000-0000-000000000000'::UUID
);
```
Expected: ERROR: Target organization with ID ... not found ✓

- [ ] **Test: Same organization**
```sql
-- Get a restaurant and its current org
SELECT id, organisation_id FROM restaurants LIMIT 1;

-- Try to reassign to same org
SELECT reassign_restaurant_to_org(
  'RESTAURANT_ID'::UUID,
  'SAME_ORG_ID'::UUID
);
```
Expected: ERROR: Restaurant is already in target organization ✓

### 7. Test Real Reassignment (Optional - Skip if not ready)
If you want to test with real data:

- [ ] Choose a test restaurant (preferably small, low-risk)
- [ ] Get pre-reassignment counts (verification query #2)
- [ ] Run the reassignment:
```sql
SELECT reassign_restaurant_to_org(
  'TEST_RESTAURANT_ID'::UUID,
  'TARGET_ORG_ID'::UUID
);
```
- [ ] Review the returned JSONB (should show affected_counts)
- [ ] Run post-reassignment verification (query #4)
- [ ] Run orphaned records check (query #5)
- [ ] Verify in application UI that data is accessible

## Post-Implementation

### 8. Verify Data Integrity
- [ ] Run orphaned records check (verification query #5)
- [ ] Confirm 0 rows returned
- [ ] Check usage_events audit log (query #6)
- [ ] Verify all reassignments logged correctly

### 9. Monitor
- [ ] Check for any errors in Supabase logs
- [ ] Monitor application for any access issues
- [ ] Review performance (query #8) - should be < 2 seconds

### 10. Update API Server
The Node.js endpoint `/api/super-admin/organizations/reassign-data` needs to be updated to handle the new return format:

**Current code** (in server.js around line 7982):
```javascript
const { error } = await supabase.rpc('reassign_restaurant_to_org', {
  p_restaurant_id: restaurantId,
  p_target_org_id: targetOrgId
});
```

**Updated code**:
```javascript
const { data, error } = await supabase.rpc('reassign_restaurant_to_org', {
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
    affectedCounts: data.affected_counts,
    sourceOrgId: data.source_org_id,
    targetOrgId: data.target_org_id
  });
}
```

- [ ] Update the endpoint code in server.js
- [ ] Test the endpoint via API call
- [ ] Verify response includes affected_counts

### 11. Documentation
- [ ] Update API documentation with new response format
- [ ] Document the 11 tables that get updated
- [ ] Add troubleshooting guide (if needed)
- [ ] Update runbooks for operations team

## Rollback Plan (If Needed)

If something goes wrong:

### Option 1: Restore from Backup
- [ ] Go to Supabase Dashboard → Database → Backups
- [ ] Restore from the backup taken in step 2
- [ ] Verify restoration successful

### Option 2: Reverse a Specific Reassignment
If only one reassignment was problematic:
- [ ] Find the reassignment in usage_events
- [ ] Extract source_org_id and restaurant_id
- [ ] Run reassignment back to original org:
```sql
SELECT reassign_restaurant_to_org(
  'RESTAURANT_ID'::UUID,
  'ORIGINAL_SOURCE_ORG_ID'::UUID
);
```

### Option 3: Revert to Old Function
- [ ] Run the old function definition (from backup or git history)
- [ ] This will lose the new functionality but restore old behavior

## Success Criteria

✅ Migration applied successfully
✅ Function created with correct signature
✅ All edge case tests pass
✅ No orphaned records found
✅ Test reassignment completes in < 2 seconds
✅ Audit log shows all reassignments
✅ API endpoint updated and tested
✅ No errors in production logs

## Notes

- The migration is **backward compatible** - existing API calls will still work
- All updates happen in a **single transaction** (atomic)
- Failed reassignments are **logged in usage_events** with error details
- The function returns **detailed affected_counts** for transparency

## Support

If you encounter issues:
1. Check the usage_events table for error logs
2. Review the verification queries output
3. Check Supabase logs for detailed error messages
4. Refer to the problem-analysis.md for troubleshooting guidance
