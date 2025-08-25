-- Migration: Update menus table with merge tracking fields
-- Date: 2025-08-22
-- Description: Adds fields to track if a menu was created through merging

-- Add merge-related columns to menus table
ALTER TABLE menus 
ADD COLUMN IF NOT EXISTS merge_source_ids UUID[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS merge_operation_id UUID REFERENCES merge_operations(id) ON DELETE SET NULL;

-- Add indexes for merge fields
CREATE INDEX IF NOT EXISTS idx_menus_is_merged ON menus(is_merged) WHERE is_merged = TRUE;
CREATE INDEX IF NOT EXISTS idx_menus_merge_operation ON menus(merge_operation_id);
CREATE INDEX IF NOT EXISTS idx_menus_merge_sources ON menus USING GIN(merge_source_ids);

-- Add comments
COMMENT ON COLUMN menus.merge_source_ids IS 'Array of source menu IDs if this menu was created through merging';
COMMENT ON COLUMN menus.is_merged IS 'Flag indicating if this menu was created through a merge operation';
COMMENT ON COLUMN menus.merge_operation_id IS 'Reference to the merge operation that created this menu';