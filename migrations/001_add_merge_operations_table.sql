-- Migration: Add merge_operations table for menu merge feature
-- Date: 2025-08-22
-- Description: Creates table to track menu merge operations for audit trail and history

-- Create merge_operations table
CREATE TABLE IF NOT EXISTS merge_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  source_menu_ids UUID[] NOT NULL,
  result_menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
  merge_config JSONB DEFAULT '{}' NOT NULL,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_merge_operations_restaurant ON merge_operations(restaurant_id);
CREATE INDEX idx_merge_operations_result_menu ON merge_operations(result_menu_id);
CREATE INDEX idx_merge_operations_created_at ON merge_operations(created_at DESC);
CREATE INDEX idx_merge_operations_source_menus ON merge_operations USING GIN(source_menu_ids);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_merge_operations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_merge_operations_updated_at
  BEFORE UPDATE ON merge_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_merge_operations_updated_at();

-- Add comment
COMMENT ON TABLE merge_operations IS 'Tracks menu merge operations for audit trail and history';
COMMENT ON COLUMN merge_operations.source_menu_ids IS 'Array of menu IDs that were merged';
COMMENT ON COLUMN merge_operations.result_menu_id IS 'The resulting merged menu ID';
COMMENT ON COLUMN merge_operations.merge_config IS 'JSON configuration of merge decisions and options';
COMMENT ON COLUMN merge_operations.performed_by IS 'User or system that performed the merge';