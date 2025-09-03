-- Migration: Update options table structure for enhanced option extraction
-- Date: 2024-01-31
-- Description: Updates the existing options table to support the new extraction workflow

-- Step 1: Rename table from options to option_set_items for clarity
-- Skip if already renamed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'options' AND table_schema = 'public') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'option_set_items' AND table_schema = 'public') THEN
    ALTER TABLE public.options RENAME TO option_set_items;
  END IF;
END $$;

-- Step 2: Add missing columns to option_set_items (formerly options) table
ALTER TABLE public.option_set_items 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS price_display TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Step 3: Rename price_adjustment to price for consistency
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'option_set_items' 
             AND column_name = 'price_adjustment' 
             AND table_schema = 'public') THEN
    ALTER TABLE public.option_set_items RENAME COLUMN price_adjustment TO price;
  END IF;
END $$;

-- Step 4: Update column types and comments
COMMENT ON TABLE public.option_set_items IS 'Individual options within an option set (e.g., "Small", "Medium", "Large" within a size option set)';
COMMENT ON COLUMN public.option_set_items.option_set_id IS 'Foreign key to the option set this item belongs to';
COMMENT ON COLUMN public.option_set_items.organisation_id IS 'Organisation that owns this option item';
COMMENT ON COLUMN public.option_set_items.name IS 'Display name of the option (e.g., "Small", "Add Bacon")';
COMMENT ON COLUMN public.option_set_items.description IS 'Optional description of the option';
COMMENT ON COLUMN public.option_set_items.price IS 'Price adjustment for this option (can be negative for discounts)';
COMMENT ON COLUMN public.option_set_items.price_display IS 'Display format of the price (e.g., "+$2.00", "No extra cost")';
COMMENT ON COLUMN public.option_set_items.is_default IS 'Whether this option is selected by default';
COMMENT ON COLUMN public.option_set_items.is_available IS 'Whether this option is currently available';
COMMENT ON COLUMN public.option_set_items.display_order IS 'Order in which to display this option within its set';
COMMENT ON COLUMN public.option_set_items.metadata IS 'Additional metadata for the option (e.g., nutritional info, allergens)';

-- Step 5: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_option_set_items_option_set 
  ON public.option_set_items(option_set_id);

CREATE INDEX IF NOT EXISTS idx_option_set_items_organisation 
  ON public.option_set_items(organisation_id);

CREATE INDEX IF NOT EXISTS idx_option_set_items_display_order 
  ON public.option_set_items(option_set_id, display_order);

CREATE INDEX IF NOT EXISTS idx_option_set_items_availability 
  ON public.option_set_items(option_set_id, is_available);

-- Step 6: Update foreign key constraints to use new table name
ALTER TABLE public.option_set_items
DROP CONSTRAINT IF EXISTS options_option_set_id_fkey;

ALTER TABLE public.option_set_items
ADD CONSTRAINT option_set_items_option_set_id_fkey 
  FOREIGN KEY (option_set_id) 
  REFERENCES public.option_sets(id) 
  ON DELETE CASCADE;

ALTER TABLE public.option_set_items
DROP CONSTRAINT IF EXISTS options_organisation_id_fkey;

ALTER TABLE public.option_set_items
ADD CONSTRAINT option_set_items_organisation_id_fkey 
  FOREIGN KEY (organisation_id) 
  REFERENCES public.organisations(id) 
  ON DELETE CASCADE;

-- Step 7: Add check constraint for price
ALTER TABLE public.option_set_items 
ADD CONSTRAINT check_price_range 
  CHECK (price >= -1000 AND price <= 1000);

-- Step 8: Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_options_updated_at ON public.option_set_items;
DROP TRIGGER IF EXISTS update_option_set_items_updated_at ON public.option_set_items;

CREATE TRIGGER update_option_set_items_updated_at
    BEFORE UPDATE ON public.option_set_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Update RLS policy names to reflect new table name
ALTER POLICY IF EXISTS options_access_policy ON public.option_set_items 
  RENAME TO option_set_items_access_policy;