# Product Requirements Document: Super Admin Dashboard

## 1. Executive Summary

### 1.1 Purpose
Create a comprehensive dashboard for super administrators to manage and monitor all organizations, users, and system-wide data in the Menu Extractor application.

### 1.2 Goals
- Provide centralized management of all organizations and users
- Enable monitoring of system usage and activity
- Prepare foundation for billing and usage tracking
- Maintain security while providing necessary administrative access

### 1.3 Success Criteria
- Super admins can view and manage all organizations
- User management across organizations is seamless
- Usage metrics are clearly visible for billing preparation
- Dashboard loads quickly despite large data volumes
- Clear separation between super admin and regular admin features

## 2. User Stories

### 2.1 As a Super Admin, I want to:
1. **View all organizations** so I can monitor system usage
2. **Manage users globally** so I can resolve access issues
3. **See usage statistics** so I can identify heavy users for billing
4. **Access any organization's data** so I can provide support
5. **Promote/demote user roles** so I can manage permissions
6. **Export usage data** so I can analyze trends and prepare billing

### 2.2 User Journey
1. Super admin logs in → Redirected to Super Admin Dashboard
2. Views overview statistics → Sees system health at a glance
3. Navigates to Organizations tab → Sees all orgs with metrics
4. Clicks on specific org → Views detailed organization data
5. Navigates to Users tab → Manages users across system
6. Exports usage data → Downloads CSV for analysis

## 3. Functional Requirements

### 3.1 Authentication & Access Control
- **Requirement**: Only users with `role = 'super_admin'` can access
- **Implementation**: 
  - Route protection at component level
  - Redirect non-super-admins to regular dashboard
  - Add visual indicator showing "Super Admin Mode"

### 3.2 Dashboard Overview
- **Statistics Cards**:
  - Total Organizations (with growth trend)
  - Total Users (active/inactive breakdown)
  - Total Extractions (this month vs last month)
  - Total Menus/Restaurants
  - Storage Usage (if applicable)

- **Recent Activity Feed**:
  - New organizations created
  - Recent extractions
  - New user registrations
  - Failed operations requiring attention

### 3.3 Organization Management

#### 3.3.1 Organization List View
- **Display Fields**:
  - Organization Name
  - Created Date
  - Member Count
  - Admin Count
  - Total Extractions
  - Total Menus
  - Last Activity
  - Status (Active/Inactive)

- **Features**:
  - Search by organization name
  - Filter by:
    - Status (Active/Inactive)
    - Size (member count ranges)
    - Activity (last 7/30/90 days)
  - Sort by:
    - Name (A-Z, Z-A)
    - Created date
    - Member count
    - Extraction count
  - Pagination (20 items per page)

#### 3.3.2 Organization Detail View
- **Organization Info**:
  - Name and ID
  - Creation date
  - Settings/configuration
  
- **Members Section**:
  - List of all members with roles
  - Add/remove members
  - Change member roles
  
- **Usage Statistics**:
  - Extraction history graph (last 30 days)
  - Top extracted restaurants
  - Storage usage
  
- **Data Access**:
  - View all restaurants
  - View all menus
  - View extraction jobs
  - Export organization data

### 3.4 User Management

#### 3.4.1 Global User List
- **Display Fields**:
  - User Name
  - Email
  - Organization
  - Role
  - Created Date
  - Last Login
  - Status

- **Features**:
  - Search by name or email
  - Filter by:
    - Organization
    - Role (user/admin/super_admin)
    - Status (active/inactive)
  - Bulk actions:
    - Export selected users
    - Deactivate multiple users

#### 3.4.2 User Actions
- **Individual User Actions**:
  - Change role (with confirmation)
  - Move to different organization
  - Remove from organization
  - Reset password (send reset email)
  - Deactivate/Reactivate account
  
- **Role Change Rules**:
  - Cannot demote last admin of an organization
  - Cannot remove last member of an organization
  - Require confirmation for super_admin promotion

### 3.5 Usage & Billing Preparation

#### 3.5.1 Usage Metrics
- **Per Organization**:
  - Monthly extraction count
  - Image downloads count
  - CSV exports count
  - API calls (if tracked)
  - Storage usage

- **Visualization**:
  - Usage trends graph (6 months)
  - Top 10 organizations by usage
  - Usage distribution chart

#### 3.5.2 Export Functionality
- **Export Formats**: CSV, JSON
- **Export Types**:
  - Full organization list with metrics
  - User list with organization mapping
  - Usage report by organization
  - Monthly usage summary

### 3.6 Navigation Structure
```
Super Admin Dashboard
├── Overview (default view)
│   ├── Statistics Cards
│   └── Recent Activity
├── Organizations
│   ├── Organization List
│   └── Organization Detail (/:orgId)
├── Users
│   ├── User List
│   └── User Detail (/:userId)
├── Usage & Billing
│   ├── Usage Overview
│   ├── Organization Usage
│   └── Export Reports
└── Settings
    └── Super Admin Settings
```

## 4. Technical Requirements

### 4.1 Frontend Components Structure
```typescript
/src/pages/
├── SuperAdminDashboard.tsx       // Main dashboard container
├── SuperAdminOrganizations.tsx   // Organizations management
├── SuperAdminUsers.tsx          // Users management
├── SuperAdminUsage.tsx          // Usage & billing prep
└── SuperAdminOrgDetail.tsx      // Organization detail view

/src/components/super-admin/
├── SuperAdminRoute.tsx          // Route protection wrapper
├── StatsCard.tsx                // Reusable statistics card
├── OrganizationTable.tsx        // Organizations data table
├── UserTable.tsx                // Users data table
├── UsageChart.tsx               // Usage visualization
├── ActivityFeed.tsx             // Recent activity component
└── SuperAdminHeader.tsx         // Header with indicator
```

### 4.2 API Endpoints Required
```javascript
// Organizations
GET /api/super-admin/organizations
GET /api/super-admin/organizations/:id
GET /api/super-admin/organizations/:id/members
GET /api/super-admin/organizations/:id/usage

// Users
GET /api/super-admin/users
PUT /api/super-admin/users/:id/role
PUT /api/super-admin/users/:id/organization
DELETE /api/super-admin/users/:id

// Statistics
GET /api/super-admin/stats/overview
GET /api/super-admin/stats/usage
GET /api/super-admin/stats/activity

// Export
GET /api/super-admin/export/organizations
GET /api/super-admin/export/users
GET /api/super-admin/export/usage
```

### 4.3 Database Queries

#### 4.3.1 Get Organizations with Metrics
```sql
SELECT 
  o.id,
  o.name,
  o.created_at,
  o.settings,
  COUNT(DISTINCT p.id) as member_count,
  COUNT(DISTINCT CASE WHEN p.role = 'admin' THEN p.id END) as admin_count,
  COUNT(DISTINCT ej.id) as extraction_count,
  COUNT(DISTINCT m.id) as menu_count,
  MAX(ej.created_at) as last_activity
FROM organisations o
LEFT JOIN profiles p ON p.organisation_id = o.id
LEFT JOIN extraction_jobs ej ON ej.organisation_id = o.id
LEFT JOIN menus m ON m.organisation_id = o.id
GROUP BY o.id
ORDER BY o.created_at DESC;
```

#### 4.3.2 Get All Users with Organization
```sql
SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  p.created_at,
  p.updated_at,
  o.id as org_id,
  o.name as org_name
FROM profiles p
LEFT JOIN organisations o ON p.organisation_id = o.id
ORDER BY p.created_at DESC;
```

#### 4.3.3 Get System Statistics
```sql
-- Overview stats
SELECT 
  (SELECT COUNT(*) FROM organisations) as total_orgs,
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM extraction_jobs) as total_extractions,
  (SELECT COUNT(*) FROM menus) as total_menus,
  (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as total_admins,
  (SELECT COUNT(*) FROM profiles WHERE role = 'super_admin') as total_super_admins;

-- Recent activity
SELECT 
  'new_org' as type,
  name as description,
  created_at
FROM organisations
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'new_user' as type,
  email as description,
  created_at
FROM profiles
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;
```

### 4.4 State Management
```typescript
// Extend AuthContext
interface SuperAdminContextType {
  selectedOrganization?: Organization;
  organizations: Organization[];
  globalUsers: UserProfile[];
  systemStats: SystemStatistics;
  loadOrganizations: () => Promise<void>;
  loadGlobalUsers: () => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  removeUserFromOrg: (userId: string) => Promise<void>;
}
```

### 4.5 Performance Considerations
- **Pagination**: All lists must be paginated (20-50 items per page)
- **Caching**: Cache organization and user lists for 5 minutes
- **Lazy Loading**: Load detailed data only when needed
- **Debouncing**: Debounce search inputs (300ms)
- **Virtual Scrolling**: For large lists (>100 items)

## 5. UI/UX Requirements

### 5.1 Design Principles
- **Clarity**: Clear distinction from regular admin interface
- **Efficiency**: Quick access to common tasks
- **Scalability**: Handle hundreds of orgs/thousands of users
- **Responsiveness**: Work on desktop and tablet (mobile optional)

### 5.2 Visual Design
- **Color Scheme**: 
  - Use purple accent for super admin features
  - Red badges for critical items
  - Green for active/healthy status
  
- **Layout**:
  - Left sidebar navigation
  - Main content area with tabs
  - Sticky header with search
  
- **Components**:
  - Use existing shadcn/ui components
  - Consistent with current design system
  - Add "Super Admin" badge in header

### 5.3 Interaction Patterns
- **Confirmations**: 
  - Modal for role changes
  - Modal for user removal
  - Toast for successful actions
  
- **Loading States**:
  - Skeleton loaders for tables
  - Spinner for actions
  - Progress bar for exports
  
- **Error Handling**:
  - Clear error messages
  - Retry options for failed loads
  - Fallback UI for missing data

## 6. Security Requirements

### 6.1 Access Control
- Route-level protection
- API-level authorization
- Double-check role on sensitive operations
- Log all super admin actions (future feature)

### 6.2 Data Protection
- No client-side caching of sensitive data
- Secure API endpoints with role validation
- Rate limiting on export endpoints
- Sanitize all inputs

## 7. Implementation Phases

### Phase 1: Foundation (Day 1)
- [ ] Create SuperAdminDashboard component
- [ ] Add route protection
- [ ] Build overview statistics
- [ ] Create navigation structure

### Phase 2: Organization Management (Day 2)
- [ ] Organization list with search/filter
- [ ] Organization detail view
- [ ] Member management within org
- [ ] Usage statistics per org

### Phase 3: User Management (Day 3)
- [ ] Global user list
- [ ] User search and filtering
- [ ] Role management
- [ ] User actions (remove, deactivate)

### Phase 4: Usage & Export (Day 4)
- [ ] Usage metrics visualization
- [ ] Export functionality
- [ ] CSV generation
- [ ] Usage reports

### Phase 5: Polish & Testing (Day 5)
- [ ] Loading states
- [ ] Error handling
- [ ] Performance optimization
- [ ] Manual testing

## 8. Success Metrics

### 8.1 Performance KPIs
- Dashboard loads in <2 seconds
- Organization list loads in <1 second
- Search returns results in <500ms
- Export completes in <5 seconds for 1000 records

### 8.2 Functionality KPIs
- 100% of super admin features accessible
- All CRUD operations working
- Export includes all required fields
- No data leakage between organizations

### 8.3 Usability KPIs
- Maximum 3 clicks to any feature
- Clear visual distinction of super admin mode
- All actions have appropriate feedback
- Error messages are actionable

## 9. Future Enhancements (Out of Scope)

### 9.1 Version 2 Features
- Audit log for all super admin actions
- Impersonation capability
- Bulk operations on organizations
- Email templates management
- System configuration panel
- API key management
- Webhook configuration

### 9.2 Version 3 Features
- Real-time monitoring dashboard
- Automated alerts and notifications
- Advanced analytics and reporting
- Database query interface
- Backup and restore functionality
- Multi-region support

## 10. Risks & Mitigations

### 10.1 Performance Risk
**Risk**: Large data volumes slow down dashboard
**Mitigation**: Implement pagination, caching, and lazy loading

### 10.2 Security Risk
**Risk**: Unauthorized access to super admin features
**Mitigation**: Multiple authorization checks, route protection

### 10.3 Usability Risk
**Risk**: Too complex for super admins to use effectively
**Mitigation**: Progressive disclosure, clear UI patterns

### 10.4 Data Risk
**Risk**: Accidental data modification/deletion
**Mitigation**: Confirmation dialogs, soft deletes, activity logs

## 11. Testing Requirements

### 11.1 Unit Tests
- Component rendering tests
- State management tests
- Utility function tests

### 11.2 Integration Tests
- API endpoint tests
- Database query tests
- Authentication flow tests

### 11.3 Manual Testing Checklist
- [ ] Super admin can login and access dashboard
- [ ] Non-super-admins are redirected
- [ ] All statistics load correctly
- [ ] Organization list displays and filters work
- [ ] User management actions work
- [ ] Export generates valid CSV
- [ ] Error states display appropriately
- [ ] Loading states show during operations

## 12. Documentation Requirements

### 12.1 Code Documentation
- JSDoc comments for all functions
- README for super-admin folder
- API endpoint documentation

### 12.2 User Documentation
- Super Admin guide
- Common tasks walkthrough
- Troubleshooting guide

## 13. Dependencies

### 13.1 Technical Dependencies
- React 18+
- TypeScript
- Supabase Client
- shadcn/ui components
- Recharts for visualizations
- Papa Parse for CSV generation

### 13.2 Data Dependencies
- Existing authentication system
- Organization structure
- User role system
- RLS policies (bypass for super admin)

## 14. Acceptance Criteria

### 14.1 Must Have
- [x] PRD document created
- [ ] Super admin route protection working
- [ ] Overview dashboard displays stats
- [ ] Organization list with metrics
- [ ] User list with organization info
- [ ] Role management functionality
- [ ] Export to CSV working

### 14.2 Should Have
- [ ] Search and filter on all lists
- [ ] Usage metrics per organization
- [ ] Organization detail view
- [ ] Bulk user operations

### 14.3 Nice to Have
- [ ] Activity feed
- [ ] Usage trends visualization
- [ ] Quick actions menu
- [ ] Keyboard shortcuts

---

**Document Version**: 1.0
**Created Date**: 2024-01-09
**Last Updated**: 2024-01-09
**Status**: Ready for Implementation
**Owner**: Super Admin Team
**Reviewers**: Development Team