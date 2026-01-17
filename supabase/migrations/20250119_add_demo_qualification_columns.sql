-- Migration: Add demo booking qualification columns to restaurants table
-- Date: 2025-01-19
-- Description: Adds 18 new columns for capturing qualification data during demo booking
-- Author: Development Team
-- Estimated Time: ~2-3 minutes on production
-- Status: Ready for deployment

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add new columns to restaurants table
-- ============================================================================

-- Contact & Business Context
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_role TEXT,
  ADD COLUMN IF NOT EXISTS number_of_venues INTEGER,
  ADD COLUMN IF NOT EXISTS point_of_sale TEXT,
  ADD COLUMN IF NOT EXISTS online_ordering_platform TEXT,
  ADD COLUMN IF NOT EXISTS online_ordering_handles_delivery BOOLEAN,
  ADD COLUMN IF NOT EXISTS self_delivery BOOLEAN;

-- UberEats Metrics
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS weekly_uber_sales_volume NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS uber_aov NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS uber_markup NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS uber_profitability NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS uber_profitability_description TEXT;

-- Marketing & Website
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS current_marketing_description TEXT,
  ADD COLUMN IF NOT EXISTS website_type TEXT;

-- Sales Context (JSON Arrays)
-- Default to empty arrays to ensure consistency
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS painpoints JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS core_selling_points JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features_to_highlight JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS possible_objections JSONB DEFAULT '[]'::jsonb;

-- Meeting Details
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- ============================================================================
-- SECTION 2: Add check constraints for data integrity
-- ============================================================================

-- Ensure number_of_venues is positive if provided
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_number_of_venues_check
  CHECK (number_of_venues IS NULL OR number_of_venues > 0);

-- Ensure weekly_uber_sales_volume is non-negative if provided
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_weekly_uber_sales_volume_check
  CHECK (weekly_uber_sales_volume IS NULL OR weekly_uber_sales_volume >= 0);

-- Ensure uber_aov is non-negative if provided
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_uber_aov_check
  CHECK (uber_aov IS NULL OR uber_aov >= 0);

-- Ensure uber_markup is between 0-100% if provided
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_uber_markup_check
  CHECK (uber_markup IS NULL OR (uber_markup >= 0 AND uber_markup <= 100));

-- Ensure uber_profitability is between -100 and 100% if provided
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_uber_profitability_check
  CHECK (uber_profitability IS NULL OR (uber_profitability >= -100 AND uber_profitability <= 100));

-- Ensure website_type is one of the allowed values if provided
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_website_type_check
  CHECK (website_type IS NULL OR website_type IN ('platform_subdomain', 'custom_domain'));

-- ============================================================================
-- SECTION 3: Add indexes for filtering and searching
-- ============================================================================

-- B-tree indexes for standard filtering
-- These improve performance when filtering restaurants by these fields

CREATE INDEX IF NOT EXISTS idx_restaurants_contact_role
  ON public.restaurants(contact_role)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_number_of_venues
  ON public.restaurants(number_of_venues)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_website_type
  ON public.restaurants(website_type)
  TABLESPACE pg_default;

-- GIN indexes for JSONB array searching
-- These enable fast searches within the JSONB arrays
-- Use cases: Find restaurants with specific painpoints, selling points, etc.

CREATE INDEX IF NOT EXISTS idx_restaurants_painpoints
  ON public.restaurants USING GIN (painpoints)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_core_selling_points
  ON public.restaurants USING GIN (core_selling_points)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_features_to_highlight
  ON public.restaurants USING GIN (features_to_highlight)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_possible_objections
  ON public.restaurants USING GIN (possible_objections)
  TABLESPACE pg_default;

-- ============================================================================
-- SECTION 4: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.restaurants.contact_role IS 'Role/title of the contact person (e.g., Owner, Manager, Director)';
COMMENT ON COLUMN public.restaurants.number_of_venues IS 'Number of restaurant locations/venues operated';
COMMENT ON COLUMN public.restaurants.point_of_sale IS 'Name of POS system (e.g., Lightspeed, Square, Vend)';
COMMENT ON COLUMN public.restaurants.online_ordering_platform IS 'Current online ordering platform (e.g., Mr Yum, Mobi2Go)';
COMMENT ON COLUMN public.restaurants.online_ordering_handles_delivery IS 'Whether the online ordering platform handles delivery (NULL=unknown)';
COMMENT ON COLUMN public.restaurants.self_delivery IS 'Whether they do their own delivery vs third-party (NULL=unknown)';
COMMENT ON COLUMN public.restaurants.weekly_uber_sales_volume IS 'Weekly sales volume on UberEats in dollars';
COMMENT ON COLUMN public.restaurants.uber_aov IS 'Average order value on UberEats in dollars';
COMMENT ON COLUMN public.restaurants.uber_markup IS 'Menu markup percentage on UberEats (0-100)';
COMMENT ON COLUMN public.restaurants.uber_profitability IS 'Profitability percentage on UberEats (-100 to 100)';
COMMENT ON COLUMN public.restaurants.uber_profitability_description IS 'Detailed explanation of profitability calculation';
COMMENT ON COLUMN public.restaurants.current_marketing_description IS 'Description of their current marketing efforts';
COMMENT ON COLUMN public.restaurants.website_type IS 'Type of website: platform_subdomain or custom_domain';
COMMENT ON COLUMN public.restaurants.painpoints IS 'Array of identified painpoints in JSONB format';
COMMENT ON COLUMN public.restaurants.core_selling_points IS 'Array of relevant selling points for this prospect';
COMMENT ON COLUMN public.restaurants.features_to_highlight IS 'Array of Pumpd features to emphasize';
COMMENT ON COLUMN public.restaurants.possible_objections IS 'Array of anticipated objections';
COMMENT ON COLUMN public.restaurants.details IS 'Additional free-form notes from demo booking';
COMMENT ON COLUMN public.restaurants.meeting_link IS 'Link to meeting (Calendly, Zoom, etc.) or meeting notes';

COMMIT;

-- ============================================================================
-- MIGRATION END
-- ============================================================================

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after migration to verify success:
--
-- 1. Verify new columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'restaurants'
--   AND column_name IN ('contact_role', 'meeting_link', 'painpoints')
-- ORDER BY column_name;
--
-- 2. Verify indexes created:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'restaurants'
--   AND indexname LIKE 'idx_restaurants_%'
-- ORDER BY indexname;
--
-- 3. Verify check constraints:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.restaurants'::regclass
--   AND conname LIKE 'restaurants_%_check'
-- ORDER BY conname;
--
-- 4. Test JSONB default values on new records:
-- SELECT painpoints, core_selling_points
-- FROM restaurants
-- WHERE created_at > NOW() - INTERVAL '1 day'
-- LIMIT 1;
--
-- 5. Test check constraint (should fail):
-- INSERT INTO restaurants (organisation_id, name, number_of_venues)
-- VALUES ('test-org-id'::uuid, 'Test Restaurant', -1);
-- Expected: ERROR - new row violates check constraint
-- ============================================================================
