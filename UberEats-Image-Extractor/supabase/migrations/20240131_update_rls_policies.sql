-- Migration: Update RLS policies for option sets and items
-- Date: 2024-01-31
-- Description: Ensures RLS policies are properly configured for multi-tenant access

-- Step 1: Drop existing policies if they need updating
DROP POLICY IF EXISTS options_access_policy ON public.option_set_items;
DROP POLICY IF EXISTS option_set_items_access_policy ON public.option_set_items;
DROP POLICY IF EXISTS option_sets_access_policy ON public.option_sets;

-- Step 2: Recreate RLS policies for option_sets using the existing has_org_access function
CREATE POLICY option_sets_access_policy 
  ON public.option_sets
  FOR ALL
  USING (has_org_access(organisation_id));

-- Step 3: Recreate RLS policies for option_set_items
CREATE POLICY option_set_items_access_policy 
  ON public.option_set_items
  FOR ALL
  USING (has_org_access(organisation_id));

-- Step 4: Ensure RLS is enabled on both tables
ALTER TABLE public.option_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_set_items ENABLE ROW LEVEL SECURITY;

-- Step 5: Grant appropriate permissions to authenticated users
GRANT ALL ON public.option_sets TO authenticated;
GRANT ALL ON public.option_set_items TO authenticated;

-- Step 6: Grant usage on sequences if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'option_sets_id_seq') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.option_sets_id_seq TO authenticated;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'option_set_items_id_seq') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.option_set_items_id_seq TO authenticated;
  END IF;
END $$;

-- Step 7: Add comment explaining the RLS policy
COMMENT ON POLICY option_sets_access_policy ON public.option_sets IS 
  'Users can access option sets for their organisation or if they are super_admin';

COMMENT ON POLICY option_set_items_access_policy ON public.option_set_items IS 
  'Users can access option set items for their organisation or if they are super_admin';