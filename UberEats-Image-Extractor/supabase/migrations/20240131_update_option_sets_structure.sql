-- Migration: Update option_sets table structure for enhanced option extraction
-- Date: 2024-01-31
-- Description: Updates the existing option_sets table to support the new extraction workflow

-- Step 1: Add missing columns to option_sets table
ALTER TABLE public.option_sets 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_selections INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS multiple_selections_allowed BOOLEAN DEFAULT false;

-- Step 2: Rename existing columns for consistency
ALTER TABLE public.option_sets 
RENAME COLUMN min_selection TO min_selections;

ALTER TABLE public.option_sets 
RENAME COLUMN max_selection TO max_selections;

-- Step 3: Update column comments for clarity
COMMENT ON TABLE public.option_sets IS 'Stores customization option sets for menu items (e.g., size choices, toppings, etc.)';
COMMENT ON COLUMN public.option_sets.menu_item_id IS 'Foreign key to the menu item this option set belongs to';
COMMENT ON COLUMN public.option_sets.organisation_id IS 'Organisation that owns this option set';
COMMENT ON COLUMN public.option_sets.name IS 'Display name of the option set (e.g., "Choose your size", "Select toppings")';
COMMENT ON COLUMN public.option_sets.description IS 'Optional description or instructions for the option set';
COMMENT ON COLUMN public.option_sets.type IS 'Type of option set (e.g., "single_choice", "multiple_choice", "required_modifier")';
COMMENT ON COLUMN public.option_sets.min_selections IS 'Minimum number of selections required (0 if optional)';
COMMENT ON COLUMN public.option_sets.max_selections IS 'Maximum number of selections allowed';
COMMENT ON COLUMN public.option_sets.is_required IS 'Whether at least one selection from this set is required';
COMMENT ON COLUMN public.option_sets.display_order IS 'Order in which to display this option set';
COMMENT ON COLUMN public.option_sets.multiple_selections_allowed IS 'Whether multiple selections are allowed (automatically set based on max_selections > 1)';

-- Step 4: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_option_sets_menu_item 
  ON public.option_sets(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_option_sets_organisation 
  ON public.option_sets(organisation_id);

CREATE INDEX IF NOT EXISTS idx_option_sets_display_order 
  ON public.option_sets(menu_item_id, display_order);

-- Step 5: Add check constraints
ALTER TABLE public.option_sets 
ADD CONSTRAINT check_min_max_selections 
  CHECK (min_selections >= 0 AND max_selections >= min_selections);

-- Step 6: Update the type column to use an enum-like check constraint
ALTER TABLE public.option_sets 
DROP CONSTRAINT IF EXISTS option_sets_type_check;

ALTER TABLE public.option_sets 
ADD CONSTRAINT option_sets_type_check 
  CHECK (type IS NULL OR type IN ('single_choice', 'multiple_choice', 'required_modifier', 'optional_modifier'));

-- Step 7: Ensure foreign key constraints are in place
ALTER TABLE public.option_sets
DROP CONSTRAINT IF EXISTS option_sets_menu_item_id_fkey;

ALTER TABLE public.option_sets
ADD CONSTRAINT option_sets_menu_item_id_fkey 
  FOREIGN KEY (menu_item_id) 
  REFERENCES public.menu_items(id) 
  ON DELETE CASCADE;

ALTER TABLE public.option_sets
DROP CONSTRAINT IF EXISTS option_sets_organisation_id_fkey;

ALTER TABLE public.option_sets
ADD CONSTRAINT option_sets_organisation_id_fkey 
  FOREIGN KEY (organisation_id) 
  REFERENCES public.organisations(id) 
  ON DELETE CASCADE;

-- Step 8: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_option_sets_updated_at ON public.option_sets;

CREATE TRIGGER update_option_sets_updated_at
    BEFORE UPDATE ON public.option_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Update multiple_selections_allowed based on max_selections
UPDATE public.option_sets 
SET multiple_selections_allowed = (max_selections > 1)
WHERE multiple_selections_allowed IS NULL 
   OR multiple_selections_allowed != (max_selections > 1);

-- Step 10: Create trigger to automatically update multiple_selections_allowed
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