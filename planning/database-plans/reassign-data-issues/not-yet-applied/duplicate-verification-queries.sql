-- =====================================================================
-- Verification Queries for duplicate_restaurant_to_org Migration
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
WHERE routine_name = 'duplicate_restaurant_to_org';

-- Expected: 1 row showing function with JSONB return type

-- ===================================================================
-- 2. Get pre-duplication snapshot for a restaurant
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
  'Source Restaurant' as info,
  rd.restaurant_name,
  rd.organisation_id as org_id,
  (SELECT COUNT(*) FROM menus WHERE restaurant_id = rd.restaurant_id) as menus,
  (SELECT COUNT(*) FROM categories c
   JOIN menus m ON c.menu_id = m.id
   WHERE m.restaurant_id = rd.restaurant_id) as categories,
  (SELECT COUNT(*) FROM menu_items mi
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = rd.restaurant_id) as menu_items,
  (SELECT COUNT(*) FROM item_images ii
   JOIN menu_items mi ON ii.menu_item_id = mi.id
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = rd.restaurant_id) as images,
  (SELECT COUNT(DISTINCT os.id) FROM option_sets os
   JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
   JOIN menu_items mi ON mios.menu_item_id = mi.id
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = rd.restaurant_id) as option_sets,
  (SELECT COUNT(*) FROM option_set_items osi
   JOIN option_sets os ON osi.option_set_id = os.id
   JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
   JOIN menu_items mi ON mios.menu_item_id = mi.id
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = rd.restaurant_id) as option_items,
  (SELECT COUNT(*) FROM menu_item_option_sets mios
   JOIN menu_items mi ON mios.menu_item_id = mi.id
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = rd.restaurant_id) as menu_item_option_sets
FROM restaurant_data rd;

-- Save these counts before running the duplication!

-- ===================================================================
-- 3. Test the duplication function
-- ===================================================================
-- Replace with actual IDs
-- SELECT duplicate_restaurant_to_org(
--   'SOURCE_RESTAURANT_ID'::UUID,
--   'TARGET_ORG_ID'::UUID
-- );

-- Expected output:
-- {
--   "success": true,
--   "source_restaurant_id": "...",
--   "new_restaurant_id": "...",
--   "source_org_id": "...",
--   "target_org_id": "...",
--   "duplicated_counts": {
--     "restaurants": 1,
--     "menus": X,
--     "categories": X,
--     "menu_items": X,
--     "option_sets": X,
--     "option_set_items": X,
--     "item_images": X,
--     "menu_item_option_sets": X
--   }
-- }

-- ===================================================================
-- 4. Compare source and duplicated restaurant
-- ===================================================================
-- Replace IDs after duplication
WITH comparison AS (
  SELECT
    'source' as type,
    r.id as restaurant_id,
    r.name,
    r.organisation_id,
    (SELECT COUNT(*) FROM menus WHERE restaurant_id = r.id) as menus,
    (SELECT COUNT(*) FROM categories c JOIN menus m ON c.menu_id = m.id WHERE m.restaurant_id = r.id) as categories,
    (SELECT COUNT(*) FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id) as menu_items,
    (SELECT COUNT(*) FROM item_images ii JOIN menu_items mi ON ii.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id) as images,
    (SELECT COUNT(DISTINCT os.id) FROM option_sets os JOIN menu_item_option_sets mios ON os.id = mios.option_set_id JOIN menu_items mi ON mios.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id) as option_sets,
    (SELECT COUNT(*) FROM option_set_items osi JOIN option_sets os ON osi.option_set_id = os.id JOIN menu_item_option_sets mios ON os.id = mios.option_set_id JOIN menu_items mi ON mios.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id) as option_items
  FROM restaurants r
  WHERE r.id = 'SOURCE_RESTAURANT_ID'

  UNION ALL

  SELECT
    'duplicate' as type,
    r.id,
    r.name,
    r.organisation_id,
    (SELECT COUNT(*) FROM menus WHERE restaurant_id = r.id),
    (SELECT COUNT(*) FROM categories c JOIN menus m ON c.menu_id = m.id WHERE m.restaurant_id = r.id),
    (SELECT COUNT(*) FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id),
    (SELECT COUNT(*) FROM item_images ii JOIN menu_items mi ON ii.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id),
    (SELECT COUNT(DISTINCT os.id) FROM option_sets os JOIN menu_item_option_sets mios ON os.id = mios.option_set_id JOIN menu_items mi ON mios.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id),
    (SELECT COUNT(*) FROM option_set_items osi JOIN option_sets os ON osi.option_set_id = os.id JOIN menu_item_option_sets mios ON os.id = mios.option_set_id JOIN menu_items mi ON mios.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id)
  FROM restaurants r
  WHERE r.id = 'NEW_RESTAURANT_ID'
)
SELECT * FROM comparison ORDER BY type;

-- Expected: Counts should match (except name has " (Copy)" appended)

-- ===================================================================
-- 5. Verify foreign key integrity
-- ===================================================================
-- Check that all menu_items.category_id references exist in target org
SELECT
  'invalid_category_refs' as issue,
  mi.id as menu_item_id,
  mi.category_id,
  mi.organisation_id as item_org,
  c.organisation_id as category_org
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
LEFT JOIN categories c ON mi.category_id = c.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID'
  AND mi.category_id IS NOT NULL
  AND (c.id IS NULL OR c.organisation_id != mi.organisation_id);

-- Expected: 0 rows (all category references are valid)

-- ===================================================================
-- 6. Verify all images were duplicated
-- ===================================================================
SELECT
  'NEW_RESTAURANT_ID' as restaurant_id,
  COUNT(DISTINCT mi.id) as menu_items_with_images,
  COUNT(*) as total_images
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID';

-- Compare with source:
SELECT
  'SOURCE_RESTAURANT_ID' as restaurant_id,
  COUNT(DISTINCT mi.id) as menu_items_with_images,
  COUNT(*) as total_images
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'SOURCE_RESTAURANT_ID';

-- Expected: Counts should match

-- ===================================================================
-- 7. Verify option sets and associations
-- ===================================================================
-- Check that all option sets are properly linked
SELECT
  'NEW_RESTAURANT_ID' as restaurant_id,
  COUNT(DISTINCT os.id) as unique_option_sets,
  COUNT(DISTINCT mios.id) as menu_item_option_set_links,
  COUNT(DISTINCT osi.id) as total_option_items
FROM option_sets os
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN option_set_items osi ON os.id = osi.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID';

-- Compare with source:
SELECT
  'SOURCE_RESTAURANT_ID' as restaurant_id,
  COUNT(DISTINCT os.id) as unique_option_sets,
  COUNT(DISTINCT mios.id) as menu_item_option_set_links,
  COUNT(DISTINCT osi.id) as total_option_items
FROM option_sets os
JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
JOIN option_set_items osi ON os.id = osi.option_set_id
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'SOURCE_RESTAURANT_ID';

-- Expected: Counts should match

-- ===================================================================
-- 8. Check for cross-organization references (should be none)
-- ===================================================================
-- Verify duplicated data doesn't reference source org
SELECT
  'cross_org_menu_items' as issue,
  mi.id,
  mi.organisation_id as item_org,
  m.organisation_id as menu_org
FROM menu_items mi
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID'
  AND mi.organisation_id != m.organisation_id

UNION ALL

SELECT
  'cross_org_categories',
  c.id,
  c.organisation_id,
  m.organisation_id
FROM categories c
JOIN menus m ON c.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID'
  AND c.organisation_id != m.organisation_id

UNION ALL

SELECT
  'cross_org_images',
  ii.id,
  ii.organisation_id,
  mi.organisation_id
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID'
  AND ii.organisation_id != mi.organisation_id

UNION ALL

SELECT
  'cross_org_option_sets',
  mios.id,
  mios.organisation_id,
  mi.organisation_id
FROM menu_item_option_sets mios
JOIN menu_items mi ON mios.menu_item_id = mi.id
JOIN menus m ON mi.menu_id = m.id
WHERE m.restaurant_id = 'NEW_RESTAURANT_ID'
  AND mios.organisation_id != mi.organisation_id;

-- Expected: 0 rows (all records in same organization)

-- ===================================================================
-- 9. View duplication audit log
-- ===================================================================
SELECT
  created_at,
  organisation_id,
  event_type,
  event_subtype,
  metadata->>'source_restaurant_id' as source_id,
  metadata->>'new_restaurant_id' as new_id,
  metadata->>'source_org_id' as source_org,
  metadata->>'target_org_id' as target_org,
  metadata->'duplicated_counts' as counts,
  metadata->>'error' as error_message
FROM usage_events
WHERE event_type = 'data_duplication'
  AND event_subtype IN ('restaurant', 'error')
ORDER BY created_at DESC
LIMIT 20;

-- ===================================================================
-- 10. Test edge cases
-- ===================================================================

-- Test: Restaurant doesn't exist
-- SELECT duplicate_restaurant_to_org(
--   '00000000-0000-0000-0000-000000000000'::UUID,
--   'VALID_TARGET_ORG_ID'::UUID
-- );
-- Expected: ERROR: Restaurant with ID 00000000-0000-0000-0000-000000000000 not found

-- Test: Target org doesn't exist
-- SELECT duplicate_restaurant_to_org(
--   'VALID_RESTAURANT_ID'::UUID,
--   '00000000-0000-0000-0000-000000000000'::UUID
-- );
-- Expected: ERROR: Target organization with ID 00000000-0000-0000-0000-000000000000 not found

-- ===================================================================
-- 11. Performance check
-- ===================================================================
-- Run this to see how long duplications take
SELECT
  metadata->>'source_restaurant_id' as source_id,
  metadata->>'new_restaurant_id' as new_id,
  metadata->'duplicated_counts' as counts,
  created_at,
  LEAD(created_at) OVER (ORDER BY created_at) - created_at as duration
FROM usage_events
WHERE event_type = 'data_duplication'
  AND event_subtype = 'restaurant'
ORDER BY created_at DESC
LIMIT 10;

-- ===================================================================
-- 12. Verify source restaurant is unchanged
-- ===================================================================
-- Confirm original restaurant data is intact
SELECT
  r.id,
  r.name,
  r.organisation_id,
  r.updated_at,
  (SELECT COUNT(*) FROM menus WHERE restaurant_id = r.id) as menus,
  (SELECT COUNT(*) FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.restaurant_id = r.id) as items
FROM restaurants r
WHERE r.id = 'SOURCE_RESTAURANT_ID';

-- Expected: All data should be identical to pre-duplication snapshot

-- ===================================================================
-- End of verification queries
-- ===================================================================
