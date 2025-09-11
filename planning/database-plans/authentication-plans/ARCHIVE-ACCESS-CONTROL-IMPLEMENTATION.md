# Archive Access Control Implementation Plan

## Executive Summary
Implement comprehensive access control for archived organizations to prevent users from accessing data while preserving it for potential restoration.

## Current State
- Organizations can be archived (status = 'archived')
- Archived organizations retain all data
- **ISSUE**: Users can still login and access archived organization data
- No RLS policies check organization status
- No application-layer checks for archived status

## Implementation Goals
1. Block all data access for users in archived organizations
2. Preserve all data for restoration
3. Allow super admins to access archived data
4. Minimal performance impact (<2ms per query)
5. Clear user feedback when access is blocked

## Implementation Plan

### Phase 1: Database Layer (2 hours)

#### Task 1.1: Review and Choose Migration Strategy
**Decision Required**: Choose between two migrations:

**Option A: Standard Migration** (`add_archive_access_control.sql`)
- Pros: Simpler, straightforward
- Cons: Adds JOIN to every RLS policy (3-5ms overhead)
- Use if: <100 organizations expected

**Option B: Optimized Migration** (`add_archive_access_control_optimized.sql`)
- Pros: Better performance (1-2ms overhead), uses cached functions
- Cons: More complex, requires function maintenance
- Use if: Performance is critical or >100 organizations

**Recommendation**: Use Option B (Optimized) for better scalability

#### Task 1.2: Pre-Migration Checks
```sql
-- Check current archived organizations
SELECT id, name, status, archived_at 
FROM organisations 
WHERE status = 'archived';

-- Check users in archived organizations
SELECT p.email, p.name, o.name as org_name, o.status
FROM profiles p
JOIN organisations o ON o.id = p.organisation_id
WHERE o.status = 'archived';

-- Backup critical tables
pg_dump -h [host] -U [user] -d [database] \
  -t organisations -t profiles -t restaurants \
  -t menus -t menu_items > backup_before_archive_control.sql
```

#### Task 1.3: Apply Migration
```bash
# Apply the chosen migration
psql -h [host] -U [user] -d [database] < add_archive_access_control_optimized.sql

# Verify policies are created
SELECT tablename, policyname 
FROM pg_policies 
WHERE policyname LIKE '%org members%'
ORDER BY tablename;
```

#### Task 1.4: Test Database Access
```sql
-- Test as a user in archived org (should return empty)
SET LOCAL role = 'authenticated';
SET LOCAL auth.uid = '[user_id_in_archived_org]';
SELECT * FROM restaurants LIMIT 1;

-- Test as super admin (should return data)
SET LOCAL auth.uid = '[super_admin_id]';
SELECT * FROM restaurants LIMIT 1;
```

### Phase 2: Authentication Layer (1 hour)

#### Task 2.1: Update AuthContext.tsx
```typescript
// Add to AuthContext.tsx
const checkOrganizationStatus = async () => {
  if (!user || user.role === 'super_admin') return true;
  
  const { data, error } = await supabase
    .from('organisations')
    .select('status, archived_at')
    .eq('id', user.organisation_id)
    .single();
  
  if (error || !data) {
    console.error('Failed to check organization status:', error);
    return false;
  }
  
  if (data.status === 'archived') {
    // Clear session and redirect
    await supabase.auth.signOut();
    navigate('/organization-archived', {
      state: { 
        message: 'Your organization has been archived. Please contact support.',
        archivedAt: data.archived_at
      }
    });
    return false;
  }
  
  return true;
};

// Check on mount and user change
useEffect(() => {
  if (user) {
    checkOrganizationStatus();
  }
}, [user]);

// Add periodic check (every 5 minutes)
useEffect(() => {
  if (!user || user.role === 'super_admin') return;
  
  const interval = setInterval(() => {
    checkOrganizationStatus();
  }, 5 * 60 * 1000); // 5 minutes
  
  return () => clearInterval(interval);
}, [user]);
```

#### Task 2.2: Create Archived Organization Page
```typescript
// Create src/pages/OrganizationArchived.tsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Archive, Mail } from 'lucide-react';

export function OrganizationArchived() {
  const location = useLocation();
  const navigate = useNavigate();
  const { message, archivedAt } = location.state || {};
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <Archive className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle>Organization Archived</CardTitle>
          <CardDescription>
            {message || 'This organization has been archived and is no longer accessible.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {archivedAt && (
            <p className="text-sm text-gray-500 text-center">
              Archived on {new Date(archivedAt).toLocaleDateString()}
            </p>
          )}
          
          <div className="space-y-2">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate('/login')}
            >
              Return to Login
            </Button>
            
            <Button 
              className="w-full"
              onClick={() => window.location.href = 'mailto:support@pumpd.co.nz'}
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </div>
          
          <p className="text-xs text-gray-400 text-center">
            If you believe this is an error or need to restore access, 
            please contact your administrator or our support team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Task 2.3: Add Route to App.tsx
```typescript
// Add to App.tsx routes
<Route path="/organization-archived" element={<OrganizationArchived />} />
```

### Phase 3: API Middleware (1 hour)

#### Task 3.1: Update Server Middleware
```javascript
// Add to server.js or create middleware/checkOrgStatus.js
const checkOrgStatus = async (req, res, next) => {
  // Skip for super admins
  if (req.user && req.user.role === 'super_admin') {
    return next();
  }
  
  // Skip for public endpoints
  const publicPaths = ['/api/auth', '/api/status', '/api/health'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  try {
    const { supabase } = req;
    
    if (req.user && req.user.organisation_id) {
      const { data, error } = await supabase
        .from('organisations')
        .select('status')
        .eq('id', req.user.organisation_id)
        .single();
      
      if (error || !data) {
        return res.status(500).json({ 
          error: 'Failed to verify organization status' 
        });
      }
      
      if (data.status === 'archived') {
        return res.status(403).json({ 
          error: 'Organization is archived',
          code: 'ORG_ARCHIVED',
          message: 'Your organization has been archived. Please contact support.'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error checking org status:', error);
    next(); // Allow request to continue on error
  }
};

// Apply middleware globally
app.use('/api', checkOrgStatus);
```

#### Task 3.2: Update React API Error Handling
```typescript
// Add to API service or axios interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.data?.code === 'ORG_ARCHIVED') {
      // Trigger logout and redirect
      window.location.href = '/organization-archived';
    }
    return Promise.reject(error);
  }
);
```

### Phase 4: Testing (2 hours)

#### Test Case 1: Archive Organization
1. Login as super admin
2. Archive an organization with active users
3. Verify organization status in database

#### Test Case 2: User Access Block
1. Login as user in archived organization
2. Should be redirected to archived page
3. Verify no data is accessible

#### Test Case 3: Super Admin Access
1. Login as super admin
2. Navigate to archived organization
3. Verify data is still visible

#### Test Case 4: Restore Organization
1. As super admin, restore archived organization
2. Verify users can login again
3. Verify data access is restored

#### Test Case 5: API Access
1. Make API calls with archived org user token
2. Verify 403 responses with ORG_ARCHIVED code
3. Verify super admin API calls still work

#### Test Case 6: Performance
```sql
-- Measure query performance
EXPLAIN ANALYZE 
SELECT * FROM restaurants 
WHERE organisation_id = '[active_org_id]' 
LIMIT 100;

-- Should show index scans and <5ms execution
```

### Phase 5: Rollback Plan

If issues occur:

#### Database Rollback
```sql
-- Revert RLS policies to original
DROP POLICY IF EXISTS "Enable read access for org members" ON restaurants;
CREATE POLICY "Enable read access for org members" ON restaurants
FOR SELECT
USING (
  organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  )
);

-- Drop new functions
DROP FUNCTION IF EXISTS user_can_access_org_data CASCADE;
DROP FUNCTION IF EXISTS user_org_is_active CASCADE;
DROP FUNCTION IF EXISTS get_user_org_status CASCADE;

-- Remove triggers
DROP TRIGGER IF EXISTS org_status_change_trigger ON organisations;
DROP FUNCTION IF EXISTS log_org_status_change CASCADE;
```

#### Application Rollback
1. Remove organization status checks from AuthContext
2. Remove /organization-archived route
3. Remove API middleware checks
4. Deploy previous version

## Success Metrics

### Immediate (Day 1)
- [ ] Users in archived orgs cannot access data
- [ ] Users see clear messaging when blocked
- [ ] Super admins can still access all data
- [ ] No errors in production logs

### Short-term (Week 1)
- [ ] Query performance remains <5ms p95
- [ ] No increase in support tickets
- [ ] Successful archive/restore of 1+ organization

### Long-term (Month 1)
- [ ] Zero data leaks from archived organizations
- [ ] Audit log shows all archive operations
- [ ] Performance metrics stable

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation | High | Use optimized migration, monitor metrics |
| Users locked out incorrectly | High | Test thoroughly, have rollback ready |
| Super admin access blocked | Medium | Test super admin bypass explicitly |
| Migration fails | Medium | Run in transaction, have backup |
| App doesn't handle 403s | Low | Add global error handler |

## Timeline

- **Day 1 Morning**: Review plan, prepare migration
- **Day 1 Afternoon**: Apply database migration (maintenance window)
- **Day 2 Morning**: Deploy application changes
- **Day 2 Afternoon**: Testing and monitoring
- **Day 3**: Monitor and address any issues

## Communication Plan

### For Users
**Before Migration**:
"We're implementing enhanced security controls. There may be brief interruptions on [date]."

**If Affected by Archive**:
"Your organization has been archived. This is typically due to [reason]. Please contact support to discuss restoration options."

### For Admins
"Archive control now fully enforced. Users in archived organizations will be blocked from all data access. Use the Super Admin dashboard to manage archived organizations."

## Post-Implementation Checklist

- [ ] Migration applied successfully
- [ ] All RLS policies updated
- [ ] AuthContext checks organization status
- [ ] API middleware active
- [ ] Archived page accessible
- [ ] Super admin access verified
- [ ] Performance metrics acceptable
- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring alerts configured

## Related Documents
- [SUPER-ADMIN-PHASE-2-IMPLEMENTATION.md](./SUPER-ADMIN-PHASE-2-IMPLEMENTATION.md)
- [Migration SQL - Optimized](../../migrations/add_archive_access_control_optimized.sql)
- [Migration SQL - Standard](../../migrations/add_archive_access_control.sql)