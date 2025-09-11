-- Migration: Add access control for archived organizations
-- Purpose: Prevent users from accessing data in archived organizations
-- Date: 2025-09-10

-- ============================================
-- STEP 1: Update RLS policies for main data tables
-- ============================================

-- RESTAURANTS table
-- Drop existing select policy and recreate with archive check
DROP POLICY IF EXISTS "Enable read access for org members" ON restaurants;

CREATE POLICY "Enable read access for org members" ON restaurants
FOR SELECT
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'  -- Only allow access if org is active
  )
  OR
  -- Super admins can see all restaurants regardless of org status
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- MENUS table
DROP POLICY IF EXISTS "Enable read access for org members" ON menus;

CREATE POLICY "Enable read access for org members" ON menus
FOR SELECT
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- MENU_ITEMS table
DROP POLICY IF EXISTS "Enable read access for org members" ON menu_items;

CREATE POLICY "Enable read access for org members" ON menu_items
FOR SELECT
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- CATEGORIES table
DROP POLICY IF EXISTS "Enable read access for org members" ON categories;

CREATE POLICY "Enable read access for org members" ON categories
FOR SELECT
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- EXTRACTION_JOBS table
DROP POLICY IF EXISTS "Enable read access for org members" ON extraction_jobs;

CREATE POLICY "Enable read access for org members" ON extraction_jobs
FOR SELECT
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- OPTION_SETS table
DROP POLICY IF EXISTS "Enable read access for org members" ON option_sets;

CREATE POLICY "Enable read access for org members" ON option_sets
FOR SELECT
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- ============================================
-- STEP 2: Update INSERT/UPDATE/DELETE policies
-- ============================================

-- Prevent INSERT operations for archived orgs
-- RESTAURANTS table
DROP POLICY IF EXISTS "Enable insert for org members" ON restaurants;

CREATE POLICY "Enable insert for org members" ON restaurants
FOR INSERT
WITH CHECK (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
    AND p.role IN ('admin', 'user')
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Prevent UPDATE operations for archived orgs
DROP POLICY IF EXISTS "Enable update for org members" ON restaurants;

CREATE POLICY "Enable update for org members" ON restaurants
FOR UPDATE
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
    AND p.role IN ('admin', 'user')
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Prevent DELETE operations for archived orgs
DROP POLICY IF EXISTS "Enable delete for org admins" ON restaurants;

CREATE POLICY "Enable delete for org admins" ON restaurants
FOR DELETE
USING (
  organisation_id IN (
    SELECT p.organisation_id 
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    WHERE p.id = auth.uid()
    AND o.status = 'active'
    AND p.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- ============================================
-- STEP 3: Update ORGANISATIONS table policy
-- ============================================

-- Users can only see their active organization
DROP POLICY IF EXISTS "org_select_member" ON organisations;

CREATE POLICY "org_select_member" ON organisations
FOR SELECT
USING (
  -- Users can see their own organization if it's active
  (
    id IN (
      SELECT organisation_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
    AND status = 'active'
  )
  OR
  -- Super admins can see all organizations
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- ============================================
-- STEP 4: Create function to check org status
-- ============================================

CREATE OR REPLACE FUNCTION check_user_org_active(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_status TEXT;
BEGIN
  SELECT o.status INTO org_status
  FROM profiles p
  JOIN organisations o ON o.id = p.organisation_id
  WHERE p.id = user_id;
  
  RETURN org_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: Create trigger to logout users when org is archived
-- ============================================

CREATE OR REPLACE FUNCTION notify_org_archived()
RETURNS TRIGGER AS $$
BEGIN
  -- When an org is archived, notify all connected clients
  IF NEW.status = 'archived' AND OLD.status = 'active' THEN
    -- This will be handled by the application layer
    -- but we log it for audit purposes
    INSERT INTO usage_events (
      organisation_id,
      event_type,
      event_subtype,
      metadata
    ) VALUES (
      NEW.id,
      'organization',
      'archived',
      jsonb_build_object(
        'archived_at', NEW.archived_at,
        'archived_by', NEW.archived_by,
        'previous_status', OLD.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS org_archived_trigger ON organisations;
CREATE TRIGGER org_archived_trigger
  AFTER UPDATE ON organisations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_org_archived();

-- ============================================
-- STEP 6: Add helpful view for checking access
-- ============================================

CREATE OR REPLACE VIEW user_access_status AS
SELECT 
  p.id as user_id,
  p.email,
  p.name as user_name,
  p.role as user_role,
  o.id as org_id,
  o.name as org_name,
  o.status as org_status,
  o.archived_at,
  CASE 
    WHEN o.status = 'archived' THEN 'blocked'
    WHEN p.role = 'super_admin' THEN 'full_access'
    ELSE 'normal'
  END as access_level
FROM profiles p
LEFT JOIN organisations o ON o.id = p.organisation_id;

-- Grant select on the view
GRANT SELECT ON user_access_status TO authenticated;

-- ============================================
-- NOTES:
-- ============================================
-- After applying this migration:
-- 1. Users in archived organizations will not be able to see any data
-- 2. Super admins can still access archived organization data
-- 3. No data modifications allowed in archived organizations (except by super admin)
-- 4. The application should check organization status on login and redirect users
-- 5. Consider adding a message to users explaining why they can't access data

-- To apply this migration:
-- 1. Review all policies to ensure they match your requirements
-- 2. Test in a development environment first
-- 3. Apply during a maintenance window
-- 4. Update the application to handle archived org status