-- Test Script for Demo Booking Migrations
-- Date: 2025-01-19
-- Purpose: Verify migrations work correctly before production deployment
-- Usage: Run this in a development/staging environment only

-- ============================================================================
-- TEST SUITE: Demo Booking Qualification Migrations
-- ============================================================================

\echo '=========================================='
\echo 'Demo Booking Migration Test Suite'
\echo 'Date: 2025-01-19'
\echo '=========================================='
\echo ''

-- ============================================================================
-- TEST 1: Verify New Columns Exist
-- ============================================================================
\echo 'TEST 1: Verifying new qualification columns exist...'

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'restaurants'
  AND column_name IN (
    'contact_role',
    'number_of_venues',
    'point_of_sale',
    'online_ordering_platform',
    'online_ordering_handles_delivery',
    'self_delivery',
    'weekly_uber_sales_volume',
    'uber_aov',
    'uber_markup',
    'uber_profitability',
    'uber_profitability_description',
    'current_marketing_description',
    'website_type',
    'painpoints',
    'core_selling_points',
    'features_to_highlight',
    'possible_objections',
    'details',
    'meeting_link'
  )
ORDER BY column_name;

\echo 'Expected: 18 rows'
\echo ''

-- ============================================================================
-- TEST 2: Verify Indexes Created
-- ============================================================================
\echo 'TEST 2: Verifying indexes created...'

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'restaurants'
  AND indexname IN (
    'idx_restaurants_contact_role',
    'idx_restaurants_number_of_venues',
    'idx_restaurants_website_type',
    'idx_restaurants_painpoints',
    'idx_restaurants_core_selling_points',
    'idx_restaurants_features_to_highlight',
    'idx_restaurants_possible_objections'
  )
ORDER BY indexname;

\echo 'Expected: 7 rows (4 GIN indexes for JSONB, 3 B-tree indexes)'
\echo ''

-- ============================================================================
-- TEST 3: Verify Check Constraints
-- ============================================================================
\echo 'TEST 3: Verifying check constraints...'

SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.restaurants'::regclass
  AND conname IN (
    'restaurants_number_of_venues_check',
    'restaurants_weekly_uber_sales_volume_check',
    'restaurants_uber_aov_check',
    'restaurants_uber_markup_check',
    'restaurants_uber_profitability_check',
    'restaurants_website_type_check'
  )
ORDER BY conname;

\echo 'Expected: 6 rows'
\echo ''

-- ============================================================================
-- TEST 4: Verify Task Type Constraint Updated
-- ============================================================================
\echo 'TEST 4: Verifying demo_meeting task type allowed...'

SELECT
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.tasks'::regclass
  AND conname = 'tasks_type_check';

\echo 'Expected: Definition should contain demo_meeting'
\echo ''

-- ============================================================================
-- TEST 5: Test JSONB Default Values
-- ============================================================================
\echo 'TEST 5: Testing JSONB default values on new insert...'

BEGIN;

-- Insert test restaurant
INSERT INTO restaurants (
  organisation_id,
  name,
  slug
) VALUES (
  (SELECT id FROM organisations LIMIT 1),
  'Test Restaurant for Migration',
  'test-restaurant-migration'
)
RETURNING
  id,
  painpoints,
  core_selling_points,
  features_to_highlight,
  possible_objections;

\echo 'Expected: All JSONB fields should be [] (empty arrays)'

ROLLBACK;
\echo 'TEST 5: Rolled back test insert'
\echo ''

-- ============================================================================
-- TEST 6: Test Check Constraint - Number of Venues (Should Succeed)
-- ============================================================================
\echo 'TEST 6a: Testing valid number_of_venues (should succeed)...'

BEGIN;

INSERT INTO restaurants (
  organisation_id,
  name,
  slug,
  number_of_venues
) VALUES (
  (SELECT id FROM organisations LIMIT 1),
  'Test Multi-Venue Restaurant',
  'test-multi-venue',
  3
);

\echo 'Expected: SUCCESS - number_of_venues = 3 is valid'

ROLLBACK;
\echo 'TEST 6a: Rolled back test insert'
\echo ''

-- ============================================================================
-- TEST 7: Test Check Constraint - Number of Venues (Should Fail)
-- ============================================================================
\echo 'TEST 7: Testing invalid number_of_venues (should fail)...'

BEGIN;

DO $$
BEGIN
  INSERT INTO restaurants (
    organisation_id,
    name,
    slug,
    number_of_venues
  ) VALUES (
    (SELECT id FROM organisations LIMIT 1),
    'Test Invalid Venue Count',
    'test-invalid-venue',
    -1
  );

  RAISE EXCEPTION 'TEST FAILED: Invalid number_of_venues was allowed!';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'TEST PASSED: Check constraint correctly rejected number_of_venues = -1';
END;
$$;

ROLLBACK;
\echo 'TEST 7: Rolled back test'
\echo ''

-- ============================================================================
-- TEST 8: Test Website Type Constraint (Should Succeed)
-- ============================================================================
\echo 'TEST 8a: Testing valid website_type (should succeed)...'

BEGIN;

INSERT INTO restaurants (
  organisation_id,
  name,
  slug,
  website_type
) VALUES (
  (SELECT id FROM organisations LIMIT 1),
  'Test Website Type',
  'test-website-type',
  'custom_domain'
);

\echo 'Expected: SUCCESS - custom_domain is valid'

ROLLBACK;
\echo 'TEST 8a: Rolled back test insert'
\echo ''

-- ============================================================================
-- TEST 9: Test Website Type Constraint (Should Fail)
-- ============================================================================
\echo 'TEST 9: Testing invalid website_type (should fail)...'

BEGIN;

DO $$
BEGIN
  INSERT INTO restaurants (
    organisation_id,
    name,
    slug,
    website_type
  ) VALUES (
    (SELECT id FROM organisations LIMIT 1),
    'Test Invalid Website Type',
    'test-invalid-website',
    'invalid_value'
  );

  RAISE EXCEPTION 'TEST FAILED: Invalid website_type was allowed!';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'TEST PASSED: Check constraint correctly rejected invalid website_type';
END;
$$;

ROLLBACK;
\echo 'TEST 9: Rolled back test'
\echo ''

-- ============================================================================
-- TEST 10: Test Creating Demo Meeting Task
-- ============================================================================
\echo 'TEST 10: Testing demo_meeting task creation...'

BEGIN;

INSERT INTO tasks (
  organisation_id,
  restaurant_id,
  name,
  type,
  priority,
  status,
  metadata
) VALUES (
  (SELECT id FROM organisations LIMIT 1),
  (SELECT id FROM restaurants LIMIT 1),
  'Test Demo Meeting Task',
  'demo_meeting',
  'high',
  'pending',
  '{"qualification_data": {"contact_role": "Owner", "meeting_link": "https://calendly.com/test"}}'::jsonb
)
RETURNING id, type, metadata;

\echo 'Expected: Task created with type = demo_meeting'

ROLLBACK;
\echo 'TEST 10: Rolled back test insert'
\echo ''

-- ============================================================================
-- TEST 11: Test GIN Index Functionality
-- ============================================================================
\echo 'TEST 11: Testing GIN index for JSONB array search...'

BEGIN;

-- Insert test data
INSERT INTO restaurants (
  organisation_id,
  name,
  slug,
  painpoints
) VALUES (
  (SELECT id FROM organisations LIMIT 1),
  'Test GIN Index',
  'test-gin-index',
  '[{"type": "predefined", "value": "High third-party commission fees"}]'::jsonb
);

-- Query using GIN index
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name, painpoints
FROM restaurants
WHERE painpoints @> '[{"value": "High third-party commission fees"}]'::jsonb;

\echo 'Expected: Query plan should show Index Scan using idx_restaurants_painpoints'

ROLLBACK;
\echo 'TEST 11: Rolled back test'
\echo ''

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================
\echo '=========================================='
\echo 'TEST SUITE COMPLETE'
\echo '=========================================='
\echo ''
\echo 'If all tests passed:'
\echo '✅ New columns created successfully'
\echo '✅ Indexes created and functional'
\echo '✅ Check constraints working correctly'
\echo '✅ Task type constraint updated'
\echo '✅ JSONB defaults working'
\echo '✅ Demo meeting tasks can be created'
\echo ''
\echo 'Ready to deploy to production!'
\echo ''
\echo 'Next steps:'
\echo '1. Review test results above'
\echo '2. Backup production database'
\echo '3. Apply migrations to production'
\echo '4. Run post-migration verification queries'
\echo '=========================================='
