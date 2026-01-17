-- Migration: Add subject_line column to message_templates table
-- Date: 2025-11-22
-- Description: Adds email subject line support for message templates
-- Author: Development Team
-- Estimated Time: ~30 seconds on production
-- Status: Ready for deployment
-- Part of: Email Enhancements Feature (Feature 1)

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add subject_line column to message_templates table
-- ============================================================================

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS subject_line TEXT NULL;

-- ============================================================================
-- SECTION 2: Add column comments
-- ============================================================================

COMMENT ON COLUMN public.message_templates.subject_line IS
  'Email subject line for message templates (only applicable for email type templates). Supports variable replacement via {variable_name} syntax.';

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
      AND table_name = 'message_templates'
      AND column_name = 'subject_line'
  ) THEN
    RAISE EXCEPTION 'Migration failed: subject_line column was not added to message_templates table';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Migration Notes:
-- - Column is nullable (NULL) by default - only email templates need subjects
-- - Subject line supports same variable replacement as message content
-- - Variables extracted and included in available_variables JSONB array
-- - No indexes needed - subject_line is not used in WHERE clauses
-- - Used in preview/rendering when creating tasks from templates

-- Rollback Instructions:
-- To rollback this migration, run:
-- ALTER TABLE public.message_templates DROP COLUMN IF EXISTS subject_line;
