-- Migration: Add demo_meeting task type to tasks table
-- Date: 2025-01-19
-- Description: Updates task type constraint to include 'demo_meeting'
-- Author: Development Team
-- Estimated Time: <1 minute on production
-- Status: Ready for deployment
-- Dependency: None (can run independently)

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Update task type constraint
-- ============================================================================

-- Drop existing constraint (if exists)
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Add new constraint with demo_meeting type included
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check CHECK (
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

COMMENT ON CONSTRAINT tasks_type_check ON public.tasks IS
  'Allowed task types: internal_activity, social_message, text, email, call, demo_meeting';

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
-- WHERE conrelid = 'public.tasks'::regclass
--   AND conname = 'tasks_type_check';
-- Expected: Should see 'demo_meeting' in the definition
--
-- 2. Test creating a demo_meeting task (should succeed):
-- INSERT INTO tasks (organisation_id, name, type)
-- VALUES (
--   'test-org-id'::uuid,
--   'Test Demo Meeting',
--   'demo_meeting'
-- );
-- Expected: Success
--
-- 3. Test invalid task type (should fail):
-- INSERT INTO tasks (organisation_id, name, type)
-- VALUES (
--   'test-org-id'::uuid,
--   'Test Invalid Type',
--   'invalid_type'
-- );
-- Expected: ERROR - new row violates check constraint "tasks_type_check"
--
-- 4. Query existing task types to confirm no data issues:
-- SELECT type, COUNT(*) as count
-- FROM tasks
-- GROUP BY type
-- ORDER BY count DESC;
-- ============================================================================
