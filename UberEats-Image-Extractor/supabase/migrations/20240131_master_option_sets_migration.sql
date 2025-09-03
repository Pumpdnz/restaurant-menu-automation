-- Master Migration: Option Sets Feature for Premium Menu Extraction
-- Date: 2024-01-31
-- Author: Claude Code
-- Description: Complete migration for adding option sets extraction capability
-- 
-- This migration:
-- 1. Updates existing option_sets and options tables structure
-- 2. Renames options table to option_set_items for clarity
-- 3. Adds extraction tracking columns to menu_items
-- 4. Creates helper functions for option sets management
-- 5. Updates RLS policies for multi-tenant access
--
-- IMPORTANT: Review this migration before applying to production
-- Run with: supabase migration apply or via Supabase dashboard

-- ============================================================================
-- PART 1: Update option_sets table structure
-- ============================================================================

-- Add missing columns to option_sets table
ALTER TABLE public.option_sets 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS multiple_selections_allowed BOOLEAN DEFAULT false;

-- Handle column renaming safely
DO $$ 
BEGIN
  -- Check if min_selection exists and min_selections doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'option_sets' 
             AND column_name = 'min_selection' 
             AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'option_sets' 
                     AND column_name = 'min_selections' 
                     AND table_schema = 'public') THEN
    ALTER TABLE public.option_sets RENAME COLUMN min_selection TO min_selections;
  END IF;
  
  -- Check if max_selection exists and max_selections doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'option_sets' 
             AND column_name = 'max_selection' 
             AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'option_sets' 
                     AND column_name = 'max_selections' 
                     AND table_schema = 'public') THEN
    ALTER TABLE public.option_sets RENAME COLUMN max_selection TO max_selections;
  END IF;
END $$;

-- Ensure columns exist with correct defaults
ALTER TABLE public.option_sets 
ADD COLUMN IF NOT EXISTS min_selections INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1;

-- Add extraction tracking columns
ALTER TABLE public.option_sets
ADD COLUMN IF NOT EXISTS extraction_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS source_data JSONB;

-- ============================================================================
-- PART 2: Rename and update options table to option_set_items
-- ============================================================================

-- Rename table if needed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'options' 
             AND table_schema = 'public') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables 
                     WHERE table_name = 'option_set_items' 
                     AND table_schema = 'public') THEN
    ALTER TABLE public.options RENAME TO option_set_items;
  END IF;
END $$;

-- Add missing columns to option_set_items
ALTER TABLE public.option_set_items 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS price_display TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extraction_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ DEFAULT NOW();

-- Rename price_adjustment to price if needed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'option_set_items' 
             AND column_name = 'price_adjustment' 
             AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'option_set_items' 
                     AND column_name = 'price' 
                     AND table_schema = 'public') THEN
    ALTER TABLE public.option_set_items RENAME COLUMN price_adjustment TO price;
  END IF;
END $$;

-- Ensure price column exists
ALTER TABLE public.option_set_items 
ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;

-- ============================================================================
-- PART 3: Add extraction tracking to menu_items
-- ============================================================================

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS has_option_sets BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS option_sets_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS modal_url TEXT,
ADD COLUMN IF NOT EXISTS clean_url TEXT,
ADD COLUMN IF NOT EXISTS image_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS image_validation_data JSONB;

-- ============================================================================
-- PART 4: Add constraints
-- ============================================================================

-- Drop and recreate constraints to ensure consistency
ALTER TABLE public.option_sets 
DROP CONSTRAINT IF EXISTS check_min_max_selections;

ALTER TABLE public.option_sets 
ADD CONSTRAINT check_min_max_selections 
  CHECK (min_selections >= 0 AND max_selections >= min_selections);

ALTER TABLE public.option_sets 
DROP CONSTRAINT IF EXISTS option_sets_type_check;

ALTER TABLE public.option_sets 
ADD CONSTRAINT option_sets_type_check 
  CHECK (type IS NULL OR type IN ('single_choice', 'multiple_choice', 'required_modifier', 'optional_modifier'));

ALTER TABLE public.option_sets
DROP CONSTRAINT IF EXISTS check_extraction_source;

ALTER TABLE public.option_sets
ADD CONSTRAINT check_extraction_source 
  CHECK (extraction_source IS NULL OR extraction_source IN ('ubereats', 'doordash', 'menulog', 'manual', 'import'));

ALTER TABLE public.option_set_items 
DROP CONSTRAINT IF EXISTS check_price_range;

ALTER TABLE public.option_set_items 
ADD CONSTRAINT check_price_range 
  CHECK (price >= -1000 AND price <= 1000);

ALTER TABLE public.option_set_items
DROP CONSTRAINT IF EXISTS check_extraction_source_items;

ALTER TABLE public.option_set_items
ADD CONSTRAINT check_extraction_source_items 
  CHECK (extraction_source IS NULL OR extraction_source IN ('ubereats', 'doordash', 'menulog', 'manual', 'import'));

ALTER TABLE public.menu_items
DROP CONSTRAINT IF EXISTS check_extraction_method;

ALTER TABLE public.menu_items
ADD CONSTRAINT check_extraction_method 
  CHECK (extraction_method IS NULL OR extraction_method IN ('standard', 'premium', 'clean-url', 'modal-fallback', 'manual'));

-- ============================================================================
-- PART 5: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_option_sets_menu_item ON public.option_sets(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_option_sets_organisation ON public.option_sets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_option_sets_display_order ON public.option_sets(menu_item_id, display_order);

CREATE INDEX IF NOT EXISTS idx_option_set_items_option_set ON public.option_set_items(option_set_id);
CREATE INDEX IF NOT EXISTS idx_option_set_items_organisation ON public.option_set_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_option_set_items_display_order ON public.option_set_items(option_set_id, display_order);
CREATE INDEX IF NOT EXISTS idx_option_set_items_availability ON public.option_set_items(option_set_id, is_available);

CREATE INDEX IF NOT EXISTS idx_menu_items_has_option_sets ON public.menu_items(has_option_sets) WHERE has_option_sets = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_extraction_method ON public.menu_items(extraction_method);
CREATE INDEX IF NOT EXISTS idx_menu_items_image_validated ON public.menu_items(image_validated) WHERE image_validated = false;

-- ============================================================================
-- PART 6: Update RLS policies
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS options_access_policy ON public.option_set_items;
DROP POLICY IF EXISTS option_set_items_access_policy ON public.option_set_items;
DROP POLICY IF EXISTS option_sets_access_policy ON public.option_sets;

-- Create new policies
CREATE POLICY option_sets_access_policy 
  ON public.option_sets
  FOR ALL
  USING (has_org_access(organisation_id));

CREATE POLICY option_set_items_access_policy 
  ON public.option_set_items
  FOR ALL
  USING (has_org_access(organisation_id));

-- Enable RLS
ALTER TABLE public.option_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_set_items ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.option_sets TO authenticated;
GRANT ALL ON public.option_set_items TO authenticated;

-- ============================================================================
-- PART 7: Add table and column comments
-- ============================================================================

COMMENT ON TABLE public.option_sets IS 'Stores customization option sets for menu items (e.g., size choices, toppings, etc.)';
COMMENT ON TABLE public.option_set_items IS 'Individual options within an option set (e.g., "Small", "Medium", "Large" within a size option set)';

COMMENT ON COLUMN public.option_sets.menu_item_id IS 'Foreign key to the menu item this option set belongs to';
COMMENT ON COLUMN public.option_sets.organisation_id IS 'Organisation that owns this option set';
COMMENT ON COLUMN public.option_sets.name IS 'Display name of the option set (e.g., "Choose your size", "Select toppings")';
COMMENT ON COLUMN public.option_sets.description IS 'Optional description or instructions for the option set';
COMMENT ON COLUMN public.option_sets.type IS 'Type of option set (single_choice, multiple_choice, required_modifier, optional_modifier)';
COMMENT ON COLUMN public.option_sets.min_selections IS 'Minimum number of selections required (0 if optional)';
COMMENT ON COLUMN public.option_sets.max_selections IS 'Maximum number of selections allowed';
COMMENT ON COLUMN public.option_sets.is_required IS 'Whether at least one selection from this set is required';
COMMENT ON COLUMN public.option_sets.display_order IS 'Order in which to display this option set';
COMMENT ON COLUMN public.option_sets.multiple_selections_allowed IS 'Whether multiple selections are allowed (automatically set based on max_selections > 1)';
COMMENT ON COLUMN public.option_sets.extraction_source IS 'Source platform (ubereats, doordash, manual)';
COMMENT ON COLUMN public.option_sets.extracted_at IS 'When this option set was extracted';
COMMENT ON COLUMN public.option_sets.source_data IS 'Original extraction data for debugging';

COMMENT ON COLUMN public.option_set_items.option_set_id IS 'Foreign key to the option set this item belongs to';
COMMENT ON COLUMN public.option_set_items.organisation_id IS 'Organisation that owns this option item';
COMMENT ON COLUMN public.option_set_items.name IS 'Display name of the option (e.g., "Small", "Add Bacon")';
COMMENT ON COLUMN public.option_set_items.description IS 'Optional description of the option';
COMMENT ON COLUMN public.option_set_items.price IS 'Price adjustment for this option (can be negative for discounts)';
COMMENT ON COLUMN public.option_set_items.price_display IS 'Display format of the price (e.g., "+$2.00", "No extra cost")';
COMMENT ON COLUMN public.option_set_items.is_default IS 'Whether this option is selected by default';
COMMENT ON COLUMN public.option_set_items.is_available IS 'Whether this option is currently available';
COMMENT ON COLUMN public.option_set_items.display_order IS 'Order in which to display this option within its set';

COMMENT ON COLUMN public.menu_items.has_option_sets IS 'Whether this menu item has option sets';
COMMENT ON COLUMN public.menu_items.option_sets_extracted_at IS 'Timestamp when option sets were last extracted';
COMMENT ON COLUMN public.menu_items.extraction_method IS 'Method used for extraction (standard, clean-url, modal-fallback)';
COMMENT ON COLUMN public.menu_items.modal_url IS 'The quickView modal URL for this menu item from UberEats';
COMMENT ON COLUMN public.menu_items.clean_url IS 'The cleaned direct item page URL';
COMMENT ON COLUMN public.menu_items.image_validated IS 'Whether the image has been validated as non-placeholder';
COMMENT ON COLUMN public.menu_items.image_validation_data IS 'Image validation metadata (resolution, accessibility, etc.)';

-- ============================================================================
-- PART 8: Update multiple_selections_allowed based on max_selections
-- ============================================================================

-- Update existing rows
UPDATE public.option_sets 
SET multiple_selections_allowed = (max_selections > 1)
WHERE multiple_selections_allowed IS NULL 
   OR multiple_selections_allowed != (max_selections > 1);

-- Create trigger to automatically update multiple_selections_allowed
CREATE OR REPLACE FUNCTION update_multiple_selections_allowed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.multiple_selections_allowed = (NEW.max_selections > 1);
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_option_sets_multiple_selections ON public.option_sets;

CREATE TRIGGER update_option_sets_multiple_selections
    BEFORE INSERT OR UPDATE OF max_selections ON public.option_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_multiple_selections_allowed();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification query (run manually to check):
-- SELECT 
--   'option_sets' as table_name, count(*) as row_count 
-- FROM option_sets
-- UNION ALL
-- SELECT 
--   'option_set_items' as table_name, count(*) as row_count 
-- FROM option_set_items;