-- Migration: Add merge_decisions table for menu merge feature
-- Date: 2025-08-22
-- Description: Creates table to track individual merge decisions for duplicate items

-- Create merge_decisions table
CREATE TABLE IF NOT EXISTS merge_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merge_operation_id UUID REFERENCES merge_operations(id) ON DELETE CASCADE,
  item_group_id VARCHAR(255) NOT NULL,
  decision_type VARCHAR(50) NOT NULL CHECK (decision_type IN ('keep_menu1', 'keep_menu2', 'keep_both', 'custom', 'exclude')),
  custom_selection JSONB DEFAULT '{}',
  source_items JSONB NOT NULL DEFAULT '[]',
  result_item JSONB,
  similarity_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_merge_decisions_operation ON merge_decisions(merge_operation_id);
CREATE INDEX idx_merge_decisions_group ON merge_decisions(item_group_id);
CREATE INDEX idx_merge_decisions_type ON merge_decisions(decision_type);

-- Add comments
COMMENT ON TABLE merge_decisions IS 'Stores individual item-level decisions made during menu merge';
COMMENT ON COLUMN merge_decisions.item_group_id IS 'Groups duplicate items together for resolution';
COMMENT ON COLUMN merge_decisions.decision_type IS 'Type of merge decision: keep_menu1, keep_menu2, keep_both, custom, exclude';
COMMENT ON COLUMN merge_decisions.custom_selection IS 'Field-level selections when decision_type is custom';
COMMENT ON COLUMN merge_decisions.source_items IS 'Original items from source menus';
COMMENT ON COLUMN merge_decisions.result_item IS 'The resulting merged item';
COMMENT ON COLUMN merge_decisions.similarity_score IS 'Similarity score between duplicate items (0.00-1.00)';