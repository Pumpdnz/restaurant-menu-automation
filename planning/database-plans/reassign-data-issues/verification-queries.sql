-- =====================================================================
-- Verification Queries for reassign_restaurant_to_org Migration
-- =====================================================================
-- Run these queries after applying the migration to verify success
-- =====================================================================

-- ===================================================================
-- 1. Verify function exists and has correct signature
-- ===================================================================
SELECT
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'reassign_restaurant_to_org';

-- Expected: 1 row showing function with JSONB return type

-- ===================================================================
-- 2. Get pre-reassignment snapshot for a restaurant
-- ===================================================================
-- Replace 'RESTAURANT_ID_HERE' with actual restaurant UUID
WITH restaurant_data AS (
  SELECT
    r.id as restaurant_id,
    r.organisation_id,
    r.name as restaurant_name
  FROM restaurants r
  WHERE r.id = 'RESTAURANT_ID_HERE'
)
SELECT
  'restaurants' as table_name,
  COUNT(DISTINCT r.id) as count,
  rd.organisation_id as current_org_id
FROM restaurants r
CROSS JOIN restaurant_data rd
WHERE r.id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'menus', COUNT(DISTINCT m.id), rd.organisation_id
FROM menus m
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'menu_items', COUNT(DISTINCT mi.id), rd.organisation_id
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'categories', COUNT(DISTINCT c.id), rd.organisation_id
FROM categories c
JOIN menus m ON c.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'pumpd_accounts', COUNT(DISTINCT pa.id), rd.organisation_id
FROM pumpd_accounts pa
CROSS JOIN restaurant_data rd
WHERE pa.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'pumpd_restaurants', COUNT(DISTINCT pr.id), rd.organisation_id
FROM pumpd_restaurants pr
CROSS JOIN restaurant_data rd
WHERE pr.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'item_images', COUNT(DISTINCT ii.id), rd.organisation_id
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'menu_item_option_sets', COUNT(DISTINCT mios.id), rd.organisation_id
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'option_sets', COUNT(DISTINCT os.id), rd.organisation_id
FROM option_sets os
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
UNION ALL
SELECT 'option_set_items', COUNT(DISTINCT osi.id), rd.organisation_id
FROM option_set_items osi
JOIN option_sets os ON osi.option_set_id = os.id
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.organisation_id
ORDER BY table_name;

-- Save these counts before running the reassignment!

-- ===================================================================
-- 3. Test the reassignment function (DRY RUN - use test data)
-- ===================================================================
-- Create test organizations and restaurant first, then run:
-- SELECT reassign_restaurant_to_org(
--   'TEST_RESTAURANT_ID'::UUID,
--   'TARGET_ORG_ID'::UUID
-- );

-- Expected output:
-- {
--   "success": true,
--   "restaurant_id": "...",
--   "source_org_id": "...",
--   "target_org_id": "...",
--   "affected_counts": {
--     "restaurants": 1,
--     "menus": X,
--     "extraction_jobs": X,
--     "menu_items": X,
--     "categories": X,
--     "pumpd_accounts": X,
--     "pumpd_restaurants": X,
--     "item_images": X,
--     "menu_item_option_sets": X,
--     "option_sets": X,
--     "option_set_items": X
--   }
-- }

-- ===================================================================
-- 4. Verify post-reassignment data integrity
-- ===================================================================
-- Replace IDs with actual values after reassignment
WITH restaurant_data AS (
  SELECT
    r.id as restaurant_id,
    r.organisation_id as new_org_id,
    r.name as restaurant_name
  FROM restaurants r
  WHERE r.id = 'RESTAURANT_ID_HERE'
)
SELECT
  'restaurants' as table_name,
  COUNT(*) FILTER (WHERE r.organisation_id = rd.new_org_id) as correct_org,
  COUNT(*) FILTER (WHERE r.organisation_id != rd.new_org_id) as wrong_org
FROM restaurants r
CROSS JOIN restaurant_data rd
WHERE r.id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'menus',
  COUNT(*) FILTER (WHERE m.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE m.organisation_id != rd.new_org_id)
FROM menus m
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'menu_items',
  COUNT(*) FILTER (WHERE mi.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE mi.organisation_id != rd.new_org_id)
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'categories',
  COUNT(*) FILTER (WHERE c.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE c.organisation_id != rd.new_org_id)
FROM categories c
JOIN menus m ON c.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'pumpd_accounts',
  COUNT(*) FILTER (WHERE pa.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE pa.organisation_id != rd.new_org_id)
FROM pumpd_accounts pa
CROSS JOIN restaurant_data rd
WHERE pa.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'pumpd_restaurants',
  COUNT(*) FILTER (WHERE pr.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE pr.organisation_id != rd.new_org_id)
FROM pumpd_restaurants pr
CROSS JOIN restaurant_data rd
WHERE pr.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'item_images',
  COUNT(*) FILTER (WHERE ii.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE ii.organisation_id != rd.new_org_id)
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'menu_item_option_sets',
  COUNT(*) FILTER (WHERE mios.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE mios.organisation_id != rd.new_org_id)
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'option_sets',
  COUNT(*) FILTER (WHERE os.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE os.organisation_id != rd.new_org_id)
FROM option_sets os
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
UNION ALL
SELECT 'option_set_items',
  COUNT(*) FILTER (WHERE osi.organisation_id = rd.new_org_id),
  COUNT(*) FILTER (WHERE osi.organisation_id != rd.new_org_id)
FROM option_set_items osi
JOIN option_sets os ON osi.option_set_id = os.id
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
CROSS JOIN restaurant_data rd
WHERE m.restaurant_id = rd.restaurant_id
GROUP BY rd.new_org_id
ORDER BY table_name;

-- Expected: All rows should show 0 in "wrong_org" column

-- ===================================================================
-- 5. Check for orphaned records (should return 0 rows)
-- ===================================================================
-- item_images with mismatched organisation_id
SELECT 'orphaned_item_images' as issue, ii.id, ii.organisation_id, mi.organisation_id as menu_item_org
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
WHERE ii.organisation_id != mi.organisation_id

UNION ALL

-- menu_item_option_sets with mismatched organisation_id
SELECT 'orphaned_menu_item_option_sets', mios.id, mios.organisation_id, mi.organisation_id
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
WHERE mios.organisation_id != mi.organisation_id

UNION ALL

-- option_set_items with mismatched organisation_id
SELECT 'orphaned_option_set_items', osi.id, osi.organisation_id, os.organisation_id
FROM option_set_items osi
JOIN option_sets os ON osi.option_set_id = os.id
WHERE osi.organisation_id != os.organisation_id;

-- Expected: 0 rows returned

-- ===================================================================
-- 6. View reassignment audit log
-- ===================================================================
SELECT
  created_at,
  organisation_id,
  event_type,
  event_subtype,
  metadata->>'restaurant_id' as restaurant_id,
  metadata->>'source_org_id' as source_org,
  metadata->>'target_org_id' as target_org,
  metadata->'affected_counts' as affected_counts,
  metadata->>'error' as error_message
FROM usage_events
WHERE event_type = 'data_reassignment'
  AND event_subtype IN ('restaurant', 'error')
ORDER BY created_at DESC
LIMIT 20;

-- ===================================================================
-- 7. Test edge cases
-- ===================================================================

-- Test: Restaurant doesn't exist
-- SELECT reassign_restaurant_to_org(
--   '00000000-0000-0000-0000-000000000000'::UUID,
--   'VALID_TARGET_ORG_ID'::UUID
-- );
-- Expected: ERROR: Restaurant with ID 00000000-0000-0000-0000-000000000000 not found

-- Test: Target org doesn't exist
-- SELECT reassign_restaurant_to_org(
--   'VALID_RESTAURANT_ID'::UUID,
--   '00000000-0000-0000-0000-000000000000'::UUID
-- );
-- Expected: ERROR: Target organization with ID 00000000-0000-0000-0000-000000000000 not found

-- Test: Restaurant already in target org
-- SELECT reassign_restaurant_to_org(
--   'RESTAURANT_ID'::UUID,
--   'SAME_ORG_ID_AS_CURRENT'::UUID
-- );
-- Expected: ERROR: Restaurant is already in target organization

-- ===================================================================
-- 8. Performance check
-- ===================================================================
-- Run this to see how long reassignments take
SELECT
  metadata->>'restaurant_id' as restaurant_id,
  metadata->'affected_counts' as affected_counts,
  created_at,
  LEAD(created_at) OVER (ORDER BY created_at) - created_at as duration
FROM usage_events
WHERE event_type = 'data_reassignment'
  AND event_subtype = 'restaurant'
ORDER BY created_at DESC
LIMIT 10;

-- ===================================================================
-- End of verification queries
-- ===================================================================
