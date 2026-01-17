-- Migration: Add subject_line column to tasks table
-- Date: 2025-11-22
-- Description: Adds email subject line support for email-type tasks
-- Author: Development Team
-- Estimated Time: ~30 seconds on production
-- Status: Ready for deployment
-- Part of: Email Enhancements Feature (Feature 1)

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add subject_line columns to tasks table
-- ============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS subject_line TEXT NULL,
  ADD COLUMN IF NOT EXISTS subject_line_rendered TEXT NULL;

-- ============================================================================
-- SECTION 2: Add column comments
-- ============================================================================

COMMENT ON COLUMN public.tasks.subject_line IS
  'Email subject line template (only applicable for email type tasks). Supports variable replacement via {variable_name} syntax.';

COMMENT ON COLUMN public.tasks.subject_line_rendered IS
  'Email subject line with variables replaced. Generated automatically from subject_line when task has restaurant_id.';

-- ============================================================================
-- SECTION 3: Verification
-- ============================================================================

-- Verify columns were added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'subject_line'
  ) THEN
    RAISE EXCEPTION 'Migration failed: subject_line column was not added to tasks table';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'subject_line_rendered'
  ) THEN
    RAISE EXCEPTION 'Migration failed: subject_line_rendered column was not added to tasks table';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Migration Notes:
-- - Both columns are nullable (NULL) by default - only email tasks need subjects
-- - subject_line: User-provided template with {variable_name} syntax
-- - subject_line_rendered: Auto-generated with variables replaced
-- - No default values - users must explicitly set subject when needed
-- - Supports variable replacement via variable-replacement-service.js
-- - No indexes needed - these columns are not used in WHERE clauses

-- Rollback Instructions:
-- To rollback this migration, run:
-- ALTER TABLE public.tasks
--   DROP COLUMN IF EXISTS subject_line,
--   DROP COLUMN IF EXISTS subject_line_rendered;
