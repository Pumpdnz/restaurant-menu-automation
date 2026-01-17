-- ============================================================
-- Migration: Add subject_line and demo_meeting type support
-- Date: November 22, 2025
-- Description: Adds subject_line column for email steps and
--              adds demo_meeting to allowed task types
-- ============================================================

BEGIN;

-- Add subject_line column to sequence_steps
ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS subject_line TEXT NULL;

COMMENT ON COLUMN public.sequence_steps.subject_line IS
  'Email subject line for email type sequence steps (supports variable replacement)';

-- Update the type constraint to include demo_meeting
-- Must DROP constraint before adding new one (cannot ALTER CHECK constraints)
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_type_check;

ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_type_check CHECK (
    (
      type = ANY (
        ARRAY[
          'internal_activity'::text,
          'social_message'::text,
          'text'::text,
          'email'::text,
          'call'::text,
          'demo_meeting'::text
        ]
      )
    )
  );

COMMIT;

-- Verification queries (for testing)
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'sequence_steps' AND column_name = 'subject_line';
--
-- SELECT COUNT(*)
-- FROM sequence_steps
-- WHERE type NOT IN ('internal_activity', 'social_message', 'text', 'email', 'call', 'demo_meeting');
-- Should return 0
