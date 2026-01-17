-- ============================================================
-- Migration: Add index for efficiently finding oldest active task per restaurant
-- Feature: Restaurants Page Task Column (Feature 3)
-- Date: 2025-11-22
-- Description: Creates a partial index on tasks table to optimize
--              finding the oldest active task for each restaurant
-- ============================================================

-- Create partial index on tasks for efficient restaurant list view
-- Only indexes non-completed/non-cancelled tasks
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant_active
ON tasks(restaurant_id, due_date ASC NULLS LAST, created_at ASC)
WHERE status NOT IN ('completed', 'cancelled');

-- Add index comment for documentation
COMMENT ON INDEX idx_tasks_restaurant_active IS
  'Optimized partial index for finding oldest active task per restaurant. Used in restaurant list view to display current task status.';

-- Verification query (for testing)
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'tasks'
-- AND indexname = 'idx_tasks_restaurant_active';
