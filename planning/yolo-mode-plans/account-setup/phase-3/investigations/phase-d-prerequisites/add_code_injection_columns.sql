-- ============================================================================
-- CODE INJECTION DATABASE PERSISTENCE MIGRATION
-- ============================================================================
-- Description: Adds columns to pumpd_restaurants table for storing code
--              injection content that was previously saved to the filesystem.
--
-- Purpose: Enable code injection persistence in production environments
--          where the filesystem is ephemeral (Heroku, Railway, etc.)
--
-- Risk Level: LOW
--   - Additive migration (no existing data modified)
--   - All columns are nullable (backward compatible)
--   - Easy rollback via DROP COLUMN statements
--
-- Estimated Data Size: 28-43 KB per restaurant
--   - head_injection: 18-24 KB (CSS/styling)
--   - body_injection: 9-19 KB (JavaScript)
--   - code_injection_config: ~500 bytes (metadata)
--
-- Date: 2025-12-30
-- ============================================================================

-- Add code injection storage columns
ALTER TABLE public.pumpd_restaurants
  ADD COLUMN IF NOT EXISTS head_injection TEXT NULL,
  ADD COLUMN IF NOT EXISTS body_injection TEXT NULL,
  ADD COLUMN IF NOT EXISTS code_injection_config JSONB NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS code_injection_generated_at TIMESTAMP WITH TIME ZONE NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.pumpd_restaurants.head_injection IS
  'HTML/CSS content for head code injection (typically 18-24 KB). Contains styling, fonts, and animations for the ordering page.';

COMMENT ON COLUMN public.pumpd_restaurants.body_injection IS
  'HTML/JavaScript content for body code injection (typically 9-19 KB). Contains interactive functionality like ripple effects, phone validation, and greeting messages.';

COMMENT ON COLUMN public.pumpd_restaurants.code_injection_config IS
  'JSONB metadata about the code injection generation. Schema: { primaryColor: string, secondaryColor: string, theme: "dark"|"light", preset: string, features: object, generatedBy: uuid }';

COMMENT ON COLUMN public.pumpd_restaurants.code_injection_generated_at IS
  'Timestamp when the code injection was last generated. Used for cache invalidation and tracking.';

-- Create index on config for querying by theme or features
CREATE INDEX IF NOT EXISTS idx_pumpd_restaurants_code_injection_config
  ON public.pumpd_restaurants USING gin (code_injection_config);

-- Create index on generated_at for finding stale/recent generations
CREATE INDEX IF NOT EXISTS idx_pumpd_restaurants_code_injection_generated_at
  ON public.pumpd_restaurants (code_injection_generated_at DESC NULLS LAST)
  WHERE code_injection_generated_at IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm success)
-- ============================================================================

-- Verify columns were added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'pumpd_restaurants'
--   AND column_name LIKE 'code_injection%' OR column_name IN ('head_injection', 'body_injection');

-- Verify indexes were created:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'pumpd_restaurants'
--   AND indexname LIKE '%code_injection%';

-- ============================================================================
-- ROLLBACK SCRIPT (If needed)
-- ============================================================================
-- DROP INDEX IF EXISTS idx_pumpd_restaurants_code_injection_config;
-- DROP INDEX IF EXISTS idx_pumpd_restaurants_code_injection_generated_at;
-- ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS head_injection;
-- ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS body_injection;
-- ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS code_injection_config;
-- ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS code_injection_generated_at;
