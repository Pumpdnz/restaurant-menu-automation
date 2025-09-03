-- Migration: Add extraction tracking columns for option sets
-- Date: 2024-01-31
-- Description: Adds columns to track extraction method and validation status

-- Step 1: Add extraction tracking columns to menu_items
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS has_option_sets BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS option_sets_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS modal_url TEXT,
ADD COLUMN IF NOT EXISTS clean_url TEXT,
ADD COLUMN IF NOT EXISTS image_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS image_validation_data JSONB;

-- Step 2: Add comments for new columns
COMMENT ON COLUMN public.menu_items.has_option_sets IS 'Whether this menu item has option sets';
COMMENT ON COLUMN public.menu_items.option_sets_extracted_at IS 'Timestamp when option sets were last extracted';
COMMENT ON COLUMN public.menu_items.extraction_method IS 'Method used for extraction (standard, clean-url, modal-fallback)';
COMMENT ON COLUMN public.menu_items.modal_url IS 'The quickView modal URL for this menu item from UberEats';
COMMENT ON COLUMN public.menu_items.clean_url IS 'The cleaned direct item page URL';
COMMENT ON COLUMN public.menu_items.image_validated IS 'Whether the image has been validated as non-placeholder';
COMMENT ON COLUMN public.menu_items.image_validation_data IS 'Image validation metadata (resolution, accessibility, etc.)';

-- Step 3: Add extraction source tracking to option_sets
ALTER TABLE public.option_sets
ADD COLUMN IF NOT EXISTS extraction_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS source_data JSONB;

COMMENT ON COLUMN public.option_sets.extraction_source IS 'Source platform (ubereats, doordash, manual)';
COMMENT ON COLUMN public.option_sets.extracted_at IS 'When this option set was extracted';
COMMENT ON COLUMN public.option_sets.source_data IS 'Original extraction data for debugging';

-- Step 4: Add extraction source tracking to option_set_items
ALTER TABLE public.option_set_items
ADD COLUMN IF NOT EXISTS extraction_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ DEFAULT NOW();

-- Step 5: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_menu_items_has_option_sets 
  ON public.menu_items(has_option_sets) 
  WHERE has_option_sets = true;

CREATE INDEX IF NOT EXISTS idx_menu_items_extraction_method 
  ON public.menu_items(extraction_method);

CREATE INDEX IF NOT EXISTS idx_menu_items_image_validated 
  ON public.menu_items(image_validated) 
  WHERE image_validated = false;

-- Step 6: Add check constraint for extraction_method
ALTER TABLE public.menu_items
ADD CONSTRAINT check_extraction_method 
  CHECK (extraction_method IS NULL OR extraction_method IN (
    'standard', 
    'premium', 
    'clean-url', 
    'modal-fallback', 
    'manual'
  ));

-- Step 7: Add check constraint for extraction_source
ALTER TABLE public.option_sets
ADD CONSTRAINT check_extraction_source 
  CHECK (extraction_source IS NULL OR extraction_source IN (
    'ubereats', 
    'doordash', 
    'menulog', 
    'manual', 
    'import'
  ));

ALTER TABLE public.option_set_items
ADD CONSTRAINT check_extraction_source_items 
  CHECK (extraction_source IS NULL OR extraction_source IN (
    'ubereats', 
    'doordash', 
    'menulog', 
    'manual', 
    'import'
  ));