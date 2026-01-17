# Restaurant Data Reassignment - Solution Implementation Plan

## Executive Summary
Comprehensive plan to update the `reassign_restaurant_to_org` RPC function to handle all organization-scoped tables, ensuring complete data reassignment when restaurants move between organizations.

## Implementation Strategy

### Design Principles
1. **Atomicity**: All updates in single transaction (all or nothing)
2. **Order of Execution**: Respect dependency chain
3. **Idempotency**: Safe to run multiple times
4. **Audit Trail**: Log all changes
5. **Validation**: Pre and post-update checks

### Update Sequence
```
1. pumpd_accounts          (direct via restaurant_id)
2. pumpd_restaurants       (direct via restaurant_id)
3. item_images             (via menu_items join)
4. menu_item_option_sets   (via menu_items join)
5. option_sets             (via menu_item_option_sets join)
6. option_set_items        (via option_sets join)
```

## SQL Implementation

### Updated RPC Function

```sql
CREATE OR REPLACE FUNCTION reassign_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_source_org_id UUID;
  v_affected_counts JSONB;
  v_restaurant_count INTEGER;
  v_menu_count INTEGER;
  v_extraction_job_count INTEGER;
  v_menu_item_count INTEGER;
  v_category_count INTEGER;
  v_pumpd_account_count INTEGER;
  v_pumpd_restaurant_count INTEGER;
  v_item_image_count INTEGER;
  v_menu_item_option_set_count INTEGER;
  v_option_set_count INTEGER;
  v_option_set_item_count INTEGER;
BEGIN
  -- Get source organization ID for logging
  SELECT organisation_id INTO v_source_org_id
  FROM restaurants
  WHERE id = p_restaurant_id;

  -- Validate restaurant exists
  IF v_source_org_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant with ID % not found', p_restaurant_id;
  END IF;

  -- Validate target organization exists
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE id = p_target_org_id) THEN
    RAISE EXCEPTION 'Target organization with ID % not found', p_target_org_id;
  END IF;

  -- Validate not reassigning to same organization
  IF v_source_org_id = p_target_org_id THEN
    RAISE EXCEPTION 'Restaurant is already in target organization';
  END IF;

  -- PHASE 1: Update core restaurant table
  UPDATE restaurants
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE id = p_restaurant_id;
  GET DIAGNOSTICS v_restaurant_count = ROW_COUNT;

  -- PHASE 2: Update menus
  UPDATE menus
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menu_count = ROW_COUNT;

  -- PHASE 3: Update extraction jobs
  UPDATE extraction_jobs
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_extraction_job_count = ROW_COUNT;

  -- PHASE 4: Update menu items (via menus)
  UPDATE menu_items mi
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE mi.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menu_item_count = ROW_COUNT;

  -- PHASE 5: Update categories (via menus)
  UPDATE categories c
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE c.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_category_count = ROW_COUNT;

  -- PHASE 6: Update pumpd_accounts (direct via restaurant_id)
  UPDATE pumpd_accounts
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_pumpd_account_count = ROW_COUNT;

  -- PHASE 7: Update pumpd_restaurants (direct via restaurant_id)
  UPDATE pumpd_restaurants
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_pumpd_restaurant_count = ROW_COUNT;

  -- PHASE 8: Update item_images (via menu_items)
  UPDATE item_images ii
  SET organisation_id = p_target_org_id
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  WHERE ii.menu_item_id = mi.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_item_image_count = ROW_COUNT;

  -- PHASE 9: Update menu_item_option_sets (via menu_items)
  UPDATE menu_item_option_sets mios
  SET organisation_id = p_target_org_id
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  WHERE mios.menu_item_id = mi.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menu_item_option_set_count = ROW_COUNT;

  -- PHASE 10: Update option_sets (via menu_item_option_sets)
  -- Option sets are restaurant-specific and not shared across restaurants
  UPDATE option_sets os
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menu_item_option_sets mios
  JOIN menu_items mi ON mios.menu_item_id = mi.id
  JOIN menus m ON mi.menu_id = m.id
  WHERE os.id = mios.option_set_id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_option_set_count = ROW_COUNT;

  -- PHASE 11: Update option_set_items (via option_sets)
  UPDATE option_set_items osi
  SET organisation_id = p_target_org_id
  FROM option_sets os
  JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
  JOIN menu_items mi ON mios.menu_item_id = mi.id
  JOIN menus m ON mi.menu_id = m.id
  WHERE osi.option_set_id = os.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_option_set_item_count = ROW_COUNT;

  -- Build affected counts JSON
  v_affected_counts := jsonb_build_object(
    'restaurants', v_restaurant_count,
    'menus', v_menu_count,
    'extraction_jobs', v_extraction_job_count,
    'menu_items', v_menu_item_count,
    'categories', v_category_count,
    'pumpd_accounts', v_pumpd_account_count,
    'pumpd_restaurants', v_pumpd_restaurant_count,
    'item_images', v_item_image_count,
    'menu_item_option_sets', v_menu_item_option_set_count,
    'option_sets', v_option_set_count,
    'option_set_items', v_option_set_item_count
  );

  -- Log the reassignment
  INSERT INTO usage_events (
    organisation_id,
    event_type,
    event_subtype,
    metadata
  ) VALUES (
    p_target_org_id,
    'data_reassignment',
    'restaurant',
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'source_org_id', v_source_org_id,
      'target_org_id', p_target_org_id,
      'affected_counts', v_affected_counts,
      'timestamp', NOW()
    )
  );

  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'restaurant_id', p_restaurant_id,
    'source_org_id', v_source_org_id,
    'target_org_id', p_target_org_id,
    'affected_counts', v_affected_counts
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO usage_events (
      organisation_id,
      event_type,
      event_subtype,
      metadata
    ) VALUES (
      p_target_org_id,
      'data_reassignment',
      'error',
      jsonb_build_object(
        'restaurant_id', p_restaurant_id,
        'source_org_id', v_source_org_id,
        'target_org_id', p_target_org_id,
        'error', SQLERRM,
        'timestamp', NOW()
      )
    );

    -- Re-raise the exception to rollback transaction
    RAISE;
END;
$$ LANGUAGE plpgsql;
```

## Migration File

### File: `supabase/migrations/YYYYMMDDHHMMSS_fix_reassign_restaurant_to_org.sql`

```sql
-- Migration: Fix reassign_restaurant_to_org to include all organization-scoped tables
-- Description: Updates the RPC function to reassign pumpd_accounts, pumpd_restaurants,
--              item_images, menu_item_option_sets, option_sets, and option_set_items

-- Drop existing function
DROP FUNCTION IF EXISTS reassign_restaurant_to_org(UUID, UUID);

-- Create updated function
CREATE OR REPLACE FUNCTION reassign_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS JSONB AS $$
-- [Include full function code from above]
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users (adjust as needed)
GRANT EXECUTE ON FUNCTION reassign_restaurant_to_org(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reassign_restaurant_to_org(UUID, UUID) TO service_role;

-- Add comment
COMMENT ON FUNCTION reassign_restaurant_to_org IS
  'Reassigns a restaurant and all related data from one organization to another. ' ||
  'Updates: restaurants, menus, extraction_jobs, menu_items, categories, ' ||
  'pumpd_accounts, pumpd_restaurants, item_images, menu_item_option_sets, ' ||
  'option_sets (exclusive only), and option_set_items.';
```

## Verification Queries

### Pre-Reassignment Data Snapshot
```sql
-- Get counts before reassignment
WITH restaurant_data AS (
  SELECT
    r.id as restaurant_id,
    r.organisation_id,
    r.name as restaurant_name
  FROM restaurants r
  WHERE r.id = 'TARGET_RESTAURANT_ID'
)
SELECT
  'restaurants' as table_name,
  COUNT(DISTINCT r.id) as count
FROM restaurants r, restaurant_data rd
WHERE r.id = rd.restaurant_id
UNION ALL
SELECT 'menus', COUNT(DISTINCT m.id)
FROM menus m, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'menu_items', COUNT(DISTINCT mi.id)
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'categories', COUNT(DISTINCT c.id)
FROM categories c
JOIN menus m ON c.menu_id = m.id, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'pumpd_accounts', COUNT(DISTINCT pa.id)
FROM pumpd_accounts pa, restaurant_data rd
WHERE pa.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'pumpd_restaurants', COUNT(DISTINCT pr.id)
FROM pumpd_restaurants pr, restaurant_data rd
WHERE pr.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'item_images', COUNT(DISTINCT ii.id)
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'menu_item_option_sets', COUNT(DISTINCT mios.id)
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'option_sets', COUNT(DISTINCT os.id)
FROM option_sets os
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
UNION ALL
SELECT 'option_set_items', COUNT(DISTINCT osi.id)
FROM option_set_items osi
JOIN option_sets os ON osi.option_set_id = os.id
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id, restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
ORDER BY table_name;
```

### Post-Reassignment Verification
```sql
-- Verify all records have new organisation_id
WITH restaurant_data AS (
  SELECT
    r.id as restaurant_id,
    r.organisation_id,
    r.name as restaurant_name
  FROM restaurants r
  WHERE r.id = 'TARGET_RESTAURANT_ID'
)
SELECT
  'restaurants' as table_name,
  COUNT(*) FILTER (WHERE r.organisation_id = 'TARGET_ORG_ID') as reassigned,
  COUNT(*) FILTER (WHERE r.organisation_id != 'TARGET_ORG_ID') as not_reassigned
FROM restaurants r, restaurant_data rd
WHERE r.id = rd.restaurant_id
UNION ALL
-- [Repeat for each table...]
```

### Orphaned Records Check
```sql
-- Check for any orphaned records (should return 0 rows)
SELECT 'orphaned_item_images' as issue, ii.id, ii.organisation_id
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
WHERE ii.organisation_id != mi.organisation_id
UNION ALL
SELECT 'orphaned_menu_item_option_sets', mios.id, mios.organisation_id
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
WHERE mios.organisation_id != mi.organisation_id
UNION ALL
SELECT 'orphaned_option_set_items', osi.id, osi.organisation_id
FROM option_set_items osi
JOIN option_sets os ON osi.option_set_id = os.id
WHERE osi.organisation_id != os.organisation_id;
```

## Testing Plan

### Test Environment Setup
1. Create development branch in Supabase
2. Apply migration
3. Prepare test data

### Test Cases

#### Test Case 1: Simple Restaurant (No Options/Images)
```
Setup:
- Restaurant with 1 menu, 3 categories, 5 items
- No images, no option sets
- Has pumpd_account and pumpd_restaurant records

Expected:
- All records reassigned
- affected_counts: {restaurants: 1, menus: 1, menu_items: 5, categories: 3,
  pumpd_accounts: 1, pumpd_restaurants: 1, item_images: 0,
  menu_item_option_sets: 0, option_sets: 0, option_set_items: 0}
```

#### Test Case 2: Complex Restaurant (Full Data)
```
Setup:
- Restaurant with 2 menus, 10 categories, 25 items
- 25 item images (1 per item)
- 5 option sets with 3-5 items each
- 20 menu_item_option_set associations
- Has pumpd integration

Expected:
- All records reassigned
- affected_counts reflect all records
- No orphaned records
```

#### Test Case 3: No Pumpd Integration
```
Setup:
- Restaurant without pumpd_accounts or pumpd_restaurants records

Expected:
- Successful reassignment
- affected_counts: {pumpd_accounts: 0, pumpd_restaurants: 0}
- No errors
```

#### Test Case 4: Edge Cases
```
a) Restaurant already in target organization
   Expected: Error raised, no changes

b) Invalid restaurant ID
   Expected: Error raised, no changes

c) Invalid target org ID
   Expected: Error raised, no changes

d) Concurrent reassignment attempts
   Expected: Transaction isolation prevents conflicts
```

### Automated Test Script
```sql
-- Test script to run all test cases
DO $$
DECLARE
  v_test_restaurant_id UUID;
  v_source_org_id UUID;
  v_target_org_id UUID;
  v_result JSONB;
BEGIN
  -- Setup test data
  INSERT INTO organisations (id, name)
  VALUES
    (gen_random_uuid(), 'Test Source Org'),
    (gen_random_uuid(), 'Test Target Org')
  RETURNING id INTO v_source_org_id, v_target_org_id;

  INSERT INTO restaurants (id, organisation_id, name)
  VALUES (gen_random_uuid(), v_source_org_id, 'Test Restaurant')
  RETURNING id INTO v_test_restaurant_id;

  -- ... add menus, items, options, etc.

  -- Execute reassignment
  SELECT reassign_restaurant_to_org(v_test_restaurant_id, v_target_org_id)
  INTO v_result;

  -- Verify results
  ASSERT v_result->>'success' = 'true', 'Reassignment failed';

  -- Cleanup
  DELETE FROM organisations WHERE id IN (v_source_org_id, v_target_org_id);

  RAISE NOTICE 'Test passed: %', v_result;
END $$;
```

## Deployment Plan

### Phase 1: Development Testing (Day 1-2)
1. ✅ Create problem analysis document
2. ✅ Create solution implementation plan
3. [ ] Create migration file
4. [ ] Apply to development branch
5. [ ] Run test suite
6. [ ] Fix any issues

### Phase 2: Staging Validation (Day 3)
1. [ ] Apply migration to staging environment
2. [ ] Test with production-like data
3. [ ] Verify performance (should be fast, single transaction)
4. [ ] Test rollback scenarios

### Phase 3: Production Deployment (Day 4)
1. [ ] Schedule maintenance window (off-peak hours)
2. [ ] Backup database
3. [ ] Apply migration
4. [ ] Run verification queries
5. [ ] Monitor for errors
6. [ ] Update API documentation

### Phase 4: Post-Deployment (Day 5-7)
1. [ ] Monitor usage_events for reassignment operations
2. [ ] Verify no orphaned records
3. [ ] Collect user feedback
4. [ ] Update runbooks

## Rollback Plan

### If Issues Found During Deployment
```sql
-- Rollback to previous version
DROP FUNCTION IF EXISTS reassign_restaurant_to_org(UUID, UUID);

-- Restore from backup or revert to previous definition
CREATE OR REPLACE FUNCTION reassign_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS VOID AS $$
-- [Original function code]
$$ LANGUAGE plpgsql;
```

### Data Rollback (if necessary)
```sql
-- Use usage_events log to find reassignment and reverse it
SELECT metadata FROM usage_events
WHERE event_type = 'data_reassignment'
  AND event_subtype = 'restaurant'
  AND metadata->>'restaurant_id' = 'RESTAURANT_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Extract source_org_id and call function to reassign back
SELECT reassign_restaurant_to_org(
  'RESTAURANT_ID'::UUID,
  'SOURCE_ORG_ID'::UUID
);
```

## Performance Considerations

### Expected Performance
- **Small Restaurant** (< 50 items): < 100ms
- **Medium Restaurant** (50-200 items): 100-500ms
- **Large Restaurant** (> 200 items): 500ms-2s

### Optimization Notes
- Single transaction ensures atomicity
- Indexed columns (organisation_id, restaurant_id) ensure fast updates
- JOIN operations use existing indexes
- No N+1 query issues (batch updates)

### Monitoring
```sql
-- Monitor function execution time
SELECT
  event_type,
  event_subtype,
  (metadata->>'timestamp')::timestamp as timestamp,
  metadata->'affected_counts' as counts
FROM usage_events
WHERE event_type = 'data_reassignment'
  AND event_subtype = 'restaurant'
ORDER BY created_at DESC
LIMIT 20;
```

## Documentation Updates

### API Documentation
Update endpoint documentation to include:
- New response format with `affected_counts`
- List of all tables updated
- Error scenarios and messages

### Developer Documentation
- Update database schema diagram
- Document reassignment process
- Add troubleshooting guide

### User Documentation
- Super admin guide for reassigning restaurants
- What data gets reassigned
- Impact on existing integrations

## Success Criteria

### Functional Requirements
- ✅ All 11 organization-scoped tables updated
- ✅ Atomic transaction (all or nothing)
- ✅ Audit trail in usage_events
- ✅ Detailed affected_counts returned
- ✅ Proper error handling

### Non-Functional Requirements
- ✅ Performance < 2s for large restaurants
- ✅ Zero data loss
- ✅ Zero orphaned records
- ✅ Backward compatible with existing API calls
- ✅ Comprehensive test coverage

### Validation
- [ ] All test cases pass
- [ ] No orphaned records found
- [ ] User acceptance testing complete
- [ ] Performance benchmarks met
- [ ] Documentation updated

## Risks and Mitigation

### Risk 1: Performance Degradation
**Risk**: Large restaurants might take too long to reassign
**Mitigation**: Transaction timeout, indexed queries, batch processing
**Detection**: Performance monitoring in usage_events

### Risk 2: Unique Constraint Violations
**Risk**: Email or subdomain conflicts in target organization
**Mitigation**: Pre-validation checks before reassignment
**Detection**: PostgreSQL constraint errors caught and logged

### Risk 3: Data Inconsistency
**Risk**: Partial reassignment if transaction fails midway
**Mitigation**: Single transaction with exception handling
**Detection**: Verification queries, usage_events error logging

## Appendix

### Related Tables NOT Updated (By Design)
- `organisations`: Organizations themselves don't change
- `users`: User accounts remain in their organizations
- `order_*` tables: Historical orders remain with original organization

### Future Enhancements
1. Batch reassignment API (multiple restaurants at once)
2. Preview mode (dry run showing what would be updated)
3. Selective reassignment (choose which data types to reassign)
4. Automatic conflict resolution for email/subdomain
5. Scheduled reassignments
6. Reassignment approval workflow
