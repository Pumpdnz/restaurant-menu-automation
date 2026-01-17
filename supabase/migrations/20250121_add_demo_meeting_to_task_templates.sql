-- Migration: Add demo_meeting type to task_templates table
-- Date: 2025-01-21
-- Description: Updates task_templates type constraint to include 'demo_meeting'
-- Author: Development Team
-- Estimated Time: <1 minute on production
-- Status: Ready for deployment
-- Dependency: Requires 20250119_add_demo_meeting_task_type.sql to be applied first

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Update task_templates type constraint
-- ============================================================================

-- Drop existing constraint (if exists)
ALTER TABLE public.task_templates
  DROP CONSTRAINT IF EXISTS task_templates_type_check;

-- Add new constraint with demo_meeting type included
ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_type_check CHECK (
    type IN (
      'internal_activity',
      'social_message',
      'text',
      'email',
      'call',
      'demo_meeting'
    )
  );

-- ============================================================================
-- SECTION 2: Add comment for documentation
-- ============================================================================

COMMENT ON CONSTRAINT task_templates_type_check ON public.task_templates IS
  'Allowed task template types: internal_activity, social_message, text, email, call, demo_meeting';

COMMIT;

-- ============================================================================
-- MIGRATION END
-- ============================================================================

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after migration to verify success:
--
-- 1. Verify constraint updated:
-- SELECT conname, pg_get_constraintdef(oid) as definition
-- FROM pg_constraint
-- WHERE conrelid = 'public.task_templates'::regclass
--   AND conname = 'task_templates_type_check';
-- Expected: Should see 'demo_meeting' in the definition
--
-- 2. Test creating a demo_meeting task template (should succeed):
-- INSERT INTO task_templates (organisation_id, name, type, priority)
-- VALUES (
--   'test-org-id'::uuid,
--   'Test Demo Meeting Template',
--   'demo_meeting',
--   'medium'
-- );
-- Expected: Success
--
-- 3. Test invalid task template type (should fail):
-- INSERT INTO task_templates (organisation_id, name, type, priority)
-- VALUES (
--   'test-org-id'::uuid,
--   'Test Invalid Type',
--   'invalid_type',
--   'medium'
-- );
-- Expected: ERROR - new row violates check constraint "task_templates_type_check"
--
-- 4. Query existing task template types to confirm no data issues:
-- SELECT type, COUNT(*) as count
-- FROM task_templates
-- GROUP BY type
-- ORDER BY count DESC;
-- ============================================================================
