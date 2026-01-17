-- Migration: Add subject_line column to task_templates table
-- Date: 2025-11-22
-- Description: Adds default email subject line support for task templates
-- Author: Development Team
-- Estimated Time: ~30 seconds on production
-- Status: Ready for deployment
-- Part of: Email Enhancements Feature (Feature 1)

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add subject_line column to task_templates table
-- ============================================================================

ALTER TABLE public.task_templates
  ADD COLUMN IF NOT EXISTS subject_line TEXT NULL;

-- ============================================================================
-- SECTION 2: Add column comments
-- ============================================================================

COMMENT ON COLUMN public.task_templates.subject_line IS
  'Default email subject line for email type templates. Used when creating tasks from this template. Supports variable replacement.';

-- ============================================================================
-- SECTION 3: Verification
-- ============================================================================

-- Verify column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'subject_line'
  ) THEN
    RAISE EXCEPTION 'Migration failed: subject_line column was not added to task_templates table';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Migration Notes:
-- - Column is nullable (NULL) by default - only email templates need subjects
-- - When creating task from template, subject_line is copied to new task
-- - Supports variable replacement when task is created
-- - No indexes needed - subject_line is not used in WHERE clauses

-- Rollback Instructions:
-- To rollback this migration, run:
-- ALTER TABLE public.task_templates DROP COLUMN IF EXISTS subject_line;
