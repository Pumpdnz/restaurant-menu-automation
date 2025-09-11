# Super Admin Dashboard - Phase 1 Implementation Plan

## Overview
Phase 1 establishes the foundation for the Super Admin Dashboard, including database schema updates, route protection, basic UI structure, and API middleware.

## Timeline
**Duration**: 1 Day (8-10 hours)
**Deliverable**: Working Super Admin Dashboard shell with protected routes and basic organization listing

## Tasks Breakdown

### Task 1: Database Schema Updates (1.5 hours) ✅ COMPLETED

#### 1.1 Update Organizations Table ✅
```sql
-- Migration: add_super_admin_fields_to_organizations
ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{
  "standardExtraction": {"enabled": true, "ratePerItem": 0.10},
  "premiumExtraction": {"enabled": true, "ratePerItem": 0.25},
  "logoExtraction": {"enabled": true, "ratePerItem": 0.15},
  "logoProcessing": {"enabled": true, "ratePerItem": 0.20},
  "googleSearchExtraction": {"enabled": true, "ratePerItem": 0.05},
  "platformDetailsExtraction": {"enabled": true, "ratePerItem": 0.05},
  "csvDownload": {"enabled": true, "ratePerItem": 0.01},
  "csvWithImagesDownload": {"enabled": true, "ratePerItem": 0.02},
  "imageUploadToCDN": {"enabled": true, "ratePerItem": 0.001},
  "imageZipDownload": {"enabled": true, "ratePerItem": 0.05}
}'::jsonb,
ADD COLUMN IF NOT EXISTS billing_rates JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_organisations_status ON organisations(status);
CREATE INDEX IF NOT EXISTS idx_organisations_archived_at ON organisations(archived_at);
```

#### 1.2 Create Usage Events Table ✅
```sql
-- Migration: create_usage_events_table
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_subtype TEXT,
  quantity INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_org_date ON usage_events(organisation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_type_date ON usage_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_org_type ON usage_events(organisation_id, event_type);

-- RLS Policy for usage_events
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_events_super_admin_all" ON usage_events
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "usage_events_org_read" ON usage_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organisation_id = usage_events.organisation_id
      AND profiles.role IN ('admin', 'user')
    )
  );
```

#### 1.3 Add Tracking Function ✅
```sql
-- Migration: create_track_usage_function
CREATE OR REPLACE FUNCTION track_usage_event(
  p_org_id UUID,
  p_event_type TEXT,
  p_event_subtype TEXT DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO usage_events (
    organisation_id,
    event_type,
    event_subtype,
    quantity,
    metadata
  ) VALUES (
    p_org_id,
    p_event_type,
    p_event_subtype,
    p_quantity,
    p_metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 2: Create Core Components (2 hours)

#### 2.1 Super Admin Route Protection Component
**File**: `/src/components/super-admin/SuperAdminRoute.tsx`
```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user || !isSuperAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

#### 2.2 Super Admin Layout Component
**File**: `/src/components/super-admin/SuperAdminLayout.tsx`
```typescript
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Building2, Users, BarChart3, Settings } from 'lucide-react';
import { Badge } from '../ui/badge';

interface SuperAdminLayoutProps {
  children?: React.ReactNode;
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function SuperAdminLayout({ children, activeTab, onTabChange }: SuperAdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Super Admin Dashboard</h1>
              <Badge variant="secondary" className="ml-3 bg-purple-100 text-purple-700">
                SUPER ADMIN
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-500 hover:text-gray-700">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="organizations" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Usage
            </TabsTrigger>
          </TabsList>

          {children}
        </Tabs>
      </div>
    </div>
  );
}
```

#### 2.3 Main Super Admin Dashboard Page
**File**: `/src/pages/SuperAdminDashboard.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { SuperAdminRoute } from '../components/super-admin/SuperAdminRoute';
import { SuperAdminLayout } from '../components/super-admin/SuperAdminLayout';
import { SuperAdminOrganizations } from '../components/super-admin/SuperAdminOrganizations';
import { SuperAdminUsers } from '../components/super-admin/SuperAdminUsers';
import { SuperAdminUsage } from '../components/super-admin/SuperAdminUsage';
import { TabsContent } from '../components/ui/tabs';

export function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('organizations');

  return (
    <SuperAdminRoute>
      <SuperAdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
        <TabsContent value="organizations" className="space-y-4">
          <SuperAdminOrganizations />
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4">
          <SuperAdminUsers />
        </TabsContent>
        
        <TabsContent value="usage" className="space-y-4">
          <SuperAdminUsage />
        </TabsContent>
      </SuperAdminLayout>
    </SuperAdminRoute>
  );
}
```

### Task 3: Create Placeholder Tab Components (1 hour)

#### 3.1 Organizations Tab Placeholder
**File**: `/src/components/super-admin/SuperAdminOrganizations.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
  member_count?: number;
}

export function SuperAdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Query organizations with member count
      const { data, error } = await supabase
        .from('organisations')
        .select(`
          *,
          profiles(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orgs = data?.map(org => ({
        ...org,
        member_count: org.profiles?.[0]?.count || 0
      })) || [];

      setOrganizations(orgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-gray-500">Manage all organizations in the system</p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Organizations List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{org.name}</CardTitle>
                <CardDescription>
                  Created {new Date(org.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {org.member_count} members
                  </span>
                  <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                    {org.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredOrgs.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No organizations found
        </div>
      )}
    </div>
  );
}
```

#### 3.2 Users Tab Placeholder
**File**: `/src/components/super-admin/SuperAdminUsers.tsx`
```typescript
import React from 'react';
import { Card } from '../ui/card';

export function SuperAdminUsers() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">User Management</h2>
      <p className="text-gray-500">User management interface coming in Phase 3</p>
    </Card>
  );
}
```

#### 3.3 Usage Tab Placeholder
**File**: `/src/components/super-admin/SuperAdminUsage.tsx`
```typescript
import React from 'react';
import { Card } from '../ui/card';

export function SuperAdminUsage() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Usage Statistics</h2>
      <p className="text-gray-500">Usage statistics interface coming in Phase 4</p>
    </Card>
  );
}
```

### Task 4: Update App Router (0.5 hours)

#### 4.1 Add Route to App.tsx
**File**: `/src/App.tsx`
```typescript
// Add to imports
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

// Add to routes (inside AuthProvider)
<Route 
  path="/super-admin" 
  element={
    <ProtectedRoute>
      <SuperAdminDashboard />
    </ProtectedRoute>
  } 
/>
```

#### 4.2 Update Navigation
**File**: Update main navigation component to show Super Admin link
```typescript
// In navigation component, add conditional link
{user && isSuperAdmin() && (
  <Link 
    to="/super-admin" 
    className="flex items-center px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-800"
  >
    <Shield className="h-4 w-4 mr-2" />
    Super Admin
  </Link>
)}
```

### Task 5: Create API Middleware (1 hour)

#### 5.1 Super Admin Middleware
**File**: `/middleware/superAdmin.js`
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const superAdminMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is super admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', user.id)
      .single();

    if (profileError || profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      organisationId: profile.organisation_id
    };

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { superAdminMiddleware };
```

#### 5.2 API Routes Setup
**File**: `/server.js` (additions)
```javascript
// Import super admin middleware
const { superAdminMiddleware } = require('./middleware/superAdmin');

// Super Admin Routes
app.get('/api/super-admin/organizations', superAdminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organisations')
      .select('*, profiles(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

app.get('/api/super-admin/stats', superAdminMiddleware, async (req, res) => {
  try {
    // Get overview statistics
    const stats = await supabase.rpc('get_system_stats');
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});
```

### Task 6: Create Database Functions ✅

#### 6.1 System Statistics Function
```sql
-- Migration: create_system_stats_function
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE (
  total_organisations BIGINT,
  active_organisations BIGINT,
  archived_organisations BIGINT,
  total_users BIGINT,
  total_admins BIGINT,
  total_super_admins BIGINT,
  total_extractions BIGINT,
  total_menus BIGINT,
  total_restaurants BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM organisations)::BIGINT as total_organisations,
    (SELECT COUNT(*) FROM organisations WHERE status = 'active')::BIGINT as active_organisations,
    (SELECT COUNT(*) FROM organisations WHERE status = 'archived')::BIGINT as archived_organisations,
    (SELECT COUNT(*) FROM profiles)::BIGINT as total_users,
    (SELECT COUNT(*) FROM profiles WHERE role = 'admin')::BIGINT as total_admins,
    (SELECT COUNT(*) FROM profiles WHERE role = 'super_admin')::BIGINT as total_super_admins,
    (SELECT COUNT(*) FROM extraction_jobs)::BIGINT as total_extractions,
    (SELECT COUNT(*) FROM menus)::BIGINT as total_menus,
    (SELECT COUNT(*) FROM restaurants)::BIGINT as total_restaurants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 7: Testing Checklist (1 hour)

#### 7.1 Access Control Tests
- [ ] Super admin can access /super-admin route
- [ ] Regular admin is redirected from /super-admin
- [ ] Regular user is redirected from /super-admin
- [ ] Non-authenticated user is redirected from /super-admin

#### 7.2 UI Tests
- [ ] Tab navigation works correctly
- [ ] Organizations list loads
- [ ] Search functionality filters organizations
- [ ] Super Admin badge displays
- [ ] Loading states display correctly

#### 7.3 API Tests
- [ ] Super admin middleware blocks non-super-admins
- [ ] Organizations endpoint returns data
- [ ] Stats endpoint returns correct counts

#### 7.4 Database Tests
- [ ] Organizations table has new columns
- [ ] Usage events table exists
- [ ] System stats function returns data
- [ ] RLS policies work correctly

## Deliverables Checklist

### Database
- [x] Organizations table updated with new columns
- [x] Usage events table created
- [x] Tracking function created
- [x] System stats function created
- [x] RLS policies applied

### Frontend Components
- [ ] SuperAdminRoute protection component
- [ ] SuperAdminLayout with tabs
- [ ] SuperAdminDashboard main page
- [ ] SuperAdminOrganizations component
- [ ] Placeholder components for Users and Usage

### Backend
- [ ] Super admin middleware created
- [ ] API endpoints configured
- [ ] Authentication working

### Integration
- [ ] Route added to App.tsx
- [ ] Navigation updated with Super Admin link
- [ ] All components connected

## Next Steps (Phase 2)
After Phase 1 is complete and tested:
1. Implement organization creation modal
2. Add organization edit functionality
3. Implement archive/delete features
4. Add data reassignment tools
5. Create feature flags management

## Common Issues & Solutions

### Issue 1: RLS Policies Blocking Access
**Solution**: Ensure super_admin bypass policy is created:
```sql
CREATE POLICY "super_admin_bypass" ON organisations
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );
```

### Issue 2: TypeScript Errors
**Solution**: Ensure all types are defined:
```typescript
// Add to types/auth.ts
export interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
  feature_flags: Record<string, any>;
  billing_rates: Record<string, number>;
  created_at: string;
  updated_at: string;
}
```

### Issue 3: Middleware Not Working
**Solution**: Check environment variables:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Success Criteria
Phase 1 is complete when:
1. ✅ Super admin can access dedicated dashboard
2. ✅ Organizations list displays with member counts
3. ✅ Tab navigation works
4. ✅ Route protection prevents unauthorized access
5. ✅ Database schema is updated
6. ✅ API middleware is functional
7. ✅ Basic search functionality works

---

**Ready to Execute**: This plan provides all code and SQL needed for Phase 1 implementation