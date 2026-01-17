-- Rollback Migration: Remove demo booking qualification columns and task type
-- Date: 2025-01-19
-- Description: Reverts the demo booking qualification feature
-- Author: Development Team
-- ⚠️  WARNING: This will permanently delete all qualification data
-- ⚠️  WARNING: This will fail if any demo_meeting tasks exist

-- ============================================================================
-- PRE-ROLLBACK CHECKLIST
-- ============================================================================
-- BEFORE running this rollback, ensure you have:
--
-- 1. Backed up all qualification data:
--    \copy (SELECT * FROM restaurants WHERE contact_role IS NOT NULL OR meeting_link IS NOT NULL) TO '/backup/qualification_data.csv' CSV HEADER;
--
-- 2. Checked for demo_meeting tasks:
--    SELECT COUNT(*) FROM tasks WHERE type = 'demo_meeting';
--    If count > 0, you must either:
--    a) Delete them: DELETE FROM tasks WHERE type = 'demo_meeting';
--    b) Convert them: UPDATE tasks SET type = 'internal_activity' WHERE type = 'demo_meeting';
--
-- 3. Notified stakeholders of rollback and data loss
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Rollback task type constraint
-- ============================================================================

-- Drop current constraint
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Restore original constraint without demo_meeting
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check CHECK (
    type IN (
      'internal_activity',
      'social_message',
      'text',
      'email',
      'call'
    )
  );

-- ============================================================================
-- SECTION 2: Drop indexes (fastest to drop first)
-- ============================================================================

-- Drop GIN indexes for JSONB arrays
DROP INDEX IF EXISTS public.idx_restaurants_painpoints;
DROP INDEX IF EXISTS public.idx_restaurants_core_selling_points;
DROP INDEX IF EXISTS public.idx_restaurants_features_to_highlight;
DROP INDEX IF EXISTS public.idx_restaurants_possible_objections;

-- Drop B-tree indexes
DROP INDEX IF EXISTS public.idx_restaurants_contact_role;
DROP INDEX IF EXISTS public.idx_restaurants_number_of_venues;
DROP INDEX IF EXISTS public.idx_restaurants_website_type;

-- ============================================================================
-- SECTION 3: Drop check constraints
-- ============================================================================

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_number_of_venues_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_weekly_uber_sales_volume_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_uber_aov_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_uber_markup_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_uber_profitability_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_website_type_check;

-- ============================================================================
-- SECTION 4: Drop columns (WARNING: DATA LOSS)
-- ============================================================================

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS contact_role,
  DROP COLUMN IF EXISTS number_of_venues,
  DROP COLUMN IF EXISTS point_of_sale,
  DROP COLUMN IF EXISTS online_ordering_platform,
  DROP COLUMN IF EXISTS online_ordering_handles_delivery,
  DROP COLUMN IF EXISTS self_delivery,
  DROP COLUMN IF EXISTS weekly_uber_sales_volume,
  DROP COLUMN IF EXISTS uber_aov,
  DROP COLUMN IF EXISTS uber_markup,
  DROP COLUMN IF EXISTS uber_profitability,
  DROP COLUMN IF EXISTS uber_profitability_description,
  DROP COLUMN IF EXISTS current_marketing_description,
  DROP COLUMN IF EXISTS website_type,
  DROP COLUMN IF EXISTS painpoints,
  DROP COLUMN IF EXISTS core_selling_points,
  DROP COLUMN IF EXISTS features_to_highlight,
  DROP COLUMN IF EXISTS possible_objections,
  DROP COLUMN IF EXISTS details,
  DROP COLUMN IF EXISTS meeting_link;

COMMIT;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

-- ============================================================================
-- POST-ROLLBACK VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after rollback to verify success:
--
-- 1. Verify columns removed:
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'restaurants'
--   AND column_name IN ('contact_role', 'meeting_link', 'painpoints');
-- Expected: 0 rows
--
-- 2. Verify indexes removed:
-- SELECT indexname
-- FROM pg_indexes
-- WHERE tablename = 'restaurants'
--   AND indexname LIKE 'idx_restaurants_contact_role%';
-- Expected: 0 rows
--
-- 3. Verify task type constraint updated:
-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.tasks'::regclass
--   AND conname = 'tasks_type_check';
-- Expected: Should NOT contain 'demo_meeting'
--
-- 4. Verify no demo_meeting tasks remain:
-- SELECT COUNT(*) FROM tasks WHERE type = 'demo_meeting';
-- Expected: 0 (or error if column doesn't exist)
-- ============================================================================
