# Super Admin Dashboard PRD (Simplified)

## Executive Summary
The Super Admin Dashboard provides centralized management of organizations, users, and usage tracking for billing purposes. Focus is on essential administrative functions with extensibility for future features.

## Core Functionality

### 1. Organization Management

#### 1.1 Create Organization
- **Fields Required:**
  - Organization Name
  - Initial Admin User (email)
  - Feature Flags (toggles for each billable feature)
  - Billing Rates per Feature (customizable pricing)
  
- **Feature Flags & Billing Configuration:**
  ```typescript
  interface OrganizationFeatures {
    standardExtraction: { enabled: boolean; ratePerItem: number; }
    premiumExtraction: { enabled: boolean; ratePerItem: number; }
    logoExtraction: { enabled: boolean; ratePerItem: number; }
    logoProcessing: { enabled: boolean; ratePerItem: number; }
    googleSearchExtraction: { enabled: boolean; ratePerItem: number; }
    platformDetailsExtraction: { enabled: boolean; ratePerItem: number; }
    csvDownload: { enabled: boolean; ratePerItem: number; }
    csvWithImagesDownload: { enabled: boolean; ratePerItem: number; }
    imageUploadToCDN: { enabled: boolean; ratePerItem: number; }
    imageZipDownload: { enabled: boolean; ratePerItem: number; }
    // Extensible for future features
  }
  ```

#### 1.2 Edit Organization
- Modify organization name
- Toggle feature flags on/off
- Adjust billing rates per feature
- View current member count
- View total usage statistics

#### 1.3 Archive Organization
- **Soft Delete**: 
  - Remove user access (set status to 'archived')
  - Preserve ALL data:
    - Restaurants
    - Extraction Jobs
    - Menus & Menu Items
    - Option Sets & Options
    - Images
    - All historical data
  - Can be reactivated later
  - Archived orgs don't count toward billing

#### 1.4 Delete Archived Organization
- **Hard Delete** (Only for archived orgs):
  - Permanently remove organization
  - CASCADE delete all associated data
  - Requires confirmation (type organization name)
  - Show data impact before deletion:
    - X restaurants will be deleted
    - X menus will be deleted
    - X extraction jobs will be deleted
    - etc.

#### 1.5 Data Management
- **Reassign Data**:
  - Move restaurants from one org to another
  - Move menus from one org to another
  - Update all foreign key relationships
  
- **Duplicate Data**:
  - Copy restaurants to another org
  - Copy menus to another org
  - Maintain original in source org

### 2. User Management

#### 2.1 Create User
- **Fields**:
  - Email (required)
  - Name (required)
  - Role (super_admin/admin/user)
  - Organization (required)
  - Send invitation email (checkbox)
  
- **Process**:
  - Create user profile
  - Assign to organization
  - Send invitation email with temporary password
  - User must reset password on first login

#### 2.2 View All Users
- **Table Columns**:
  - Name
  - Email
  - Role
  - Organization
  - Created Date
  - Last Login
  - Status (active/inactive)
  
- **Features**:
  - Search by name/email
  - Filter by organization
  - Filter by role
  - Sort by any column
  - Pagination

#### 2.3 Edit User
- **Editable Fields**:
  - Name
  - Email
  - Role
  - Organization (reassign)
  
- **Future Extensible Fields** (prepare schema):
  - Phone
  - Avatar
  - Bio
  - Preferences
  - Timezone

#### 2.4 Delete User
- Soft delete (deactivate) vs Hard delete option
- Confirmation required
- Check if user is last admin of org (prevent)

### 3. Usage Statistics Dashboard

#### 3.1 Filters
- **Date Range**: 
  - Presets: Today, Yesterday, Last 7 days, Last 30 days, Last 90 days
  - Custom date range picker
  
- **Organization**:
  - All organizations
  - Specific organization (dropdown)
  
- **Extraction Type** (when applicable):
  - All types
  - Standard
  - Premium

#### 3.2 Metrics Display
```typescript
interface UsageMetrics {
  // Core Metrics
  totalCreditsUsed: number;
  totalExtractions: number;
  
  // Restaurant & Menu Metrics
  totalRestaurantsCreated: number;
  totalMenuExtractions: number; // Standard + Premium
  totalMenuItemsExtracted: number; // All items
  
  // Standard Extraction Metrics
  totalStandardExtractions: number;
  totalStandardMenuItems: number;
  
  // Premium Extraction Metrics
  totalPremiumExtractions: number;
  totalPremiumMenuItems: number;
  
  // Logo Metrics
  totalLogosExtracted: number;
  totalLogosProcessed: number;
  
  // Search & Platform Metrics
  totalGoogleSearchExtractions: number;
  totalPlatformDetailsExtractions: number;
  
  // CSV Export Metrics
  totalCSVDownloads: number; // Combined
  totalCSVWithoutImages: number;
  totalCSVWithImages: number;
  
  // Image Metrics
  totalImageUploadJobs: number;
  totalImagesUploadedToCDN: number;
  totalImageZIPDownloads: number;
  totalImagesDownloaded: number;
}
```

#### 3.3 Display Format
- **Statistics Cards**: Show each metric as a card with:
  - Metric name
  - Current value
  - Change from previous period (if applicable)
  - Billing impact (credits × rate)
  
- **Export Options**:
  - Export as CSV
  - Export as JSON
  - Include billing calculations

## Database Schema Requirements

### 3.1 Organizations Table Update
```sql
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  feature_flags JSONB DEFAULT '{}',
  billing_rates JSONB DEFAULT '{}',
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID REFERENCES auth.users(id);
```

### 3.2 Usage Tracking Table (New)
```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  event_type TEXT NOT NULL, -- 'standard_extraction', 'premium_extraction', etc.
  event_subtype TEXT, -- 'menu_item', 'logo', etc.
  quantity INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_usage_org_date (organisation_id, created_at),
  INDEX idx_usage_type_date (event_type, created_at)
);
```

### 3.3 Data Reassignment Functions
```sql
-- Function to reassign restaurant to new organization
CREATE OR REPLACE FUNCTION reassign_restaurant(
  restaurant_id UUID,
  new_org_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Update restaurant
  UPDATE restaurants 
  SET organisation_id = new_org_id 
  WHERE id = restaurant_id;
  
  -- Update related menus
  UPDATE menus 
  SET organisation_id = new_org_id 
  WHERE restaurant_id = restaurant_id;
  
  -- Update related extraction jobs
  UPDATE extraction_jobs
  SET organisation_id = new_org_id
  WHERE restaurant_id = restaurant_id;
  
  -- Continue for all related tables...
END;
$$ LANGUAGE plpgsql;
```

## UI Components Structure

### 4.1 Main Dashboard Layout
```
Super Admin Dashboard
├── Organizations Tab
│   ├── Organization List
│   │   ├── Create New Button
│   │   ├── Search Bar
│   │   └── Organization Cards/Table
│   ├── Organization Detail Modal
│   │   ├── Edit Features & Rates
│   │   ├── Archive Button
│   │   └── Data Management
│   └── Archived Organizations
│       ├── List of Archived
│       └── Delete Permanently Button
│
├── Users Tab
│   ├── User List
│   │   ├── Create User Button
│   │   ├── Search & Filters
│   │   └── User Table
│   └── User Detail Modal
│       ├── Edit User Form
│       └── Delete User Button
│
└── Usage Statistics Tab
    ├── Filter Controls
    │   ├── Date Range Picker
    │   ├── Organization Selector
    │   └── Extraction Type Filter
    ├── Metrics Dashboard
    │   └── Statistics Cards Grid
    └── Export Button
```

### 4.2 Key Components
```typescript
// Organization Management
<OrganizationCreateModal />
<OrganizationEditModal />
<OrganizationArchiveConfirm />
<OrganizationDeleteConfirm />
<DataReassignmentModal />

// User Management  
<UserCreateModal />
<UserEditModal />
<UserTable />
<UserDeleteConfirm />

// Usage Statistics
<UsageFilters />
<StatisticCard />
<UsageGrid />
<UsageExport />
```

## API Endpoints

### 5.1 Organization Endpoints
```typescript
// Organizations
POST   /api/super-admin/organizations          // Create
GET    /api/super-admin/organizations          // List all
GET    /api/super-admin/organizations/:id      // Get details
PUT    /api/super-admin/organizations/:id      // Update
POST   /api/super-admin/organizations/:id/archive    // Archive
DELETE /api/super-admin/organizations/:id      // Hard delete
POST   /api/super-admin/organizations/reassign-data  // Reassign data
POST   /api/super-admin/organizations/duplicate-data // Duplicate data
```

### 5.2 User Endpoints
```typescript
// Users
POST   /api/super-admin/users                  // Create
GET    /api/super-admin/users                  // List all
GET    /api/super-admin/users/:id              // Get details
PUT    /api/super-admin/users/:id              // Update
DELETE /api/super-admin/users/:id              // Delete
POST   /api/super-admin/users/:id/invite       // Send invite
```

### 5.3 Usage Endpoints
```typescript
// Usage Statistics
GET    /api/super-admin/usage/statistics       // Get all metrics
GET    /api/super-admin/usage/export          // Export data
POST   /api/super-admin/usage/track           // Track new event
```

## Implementation Priority

### Phase 1: Foundation (Day 1)
- [ ] Create Super Admin Dashboard shell
- [ ] Add route protection for super_admin role
- [ ] Create tab navigation structure
- [ ] Setup API middleware for super admin endpoints

### Phase 2: Organization Management (Day 2-3)
- [ ] Organization list view
- [ ] Create organization with features/rates
- [ ] Edit organization features/rates
- [ ] Archive organization functionality
- [ ] Hard delete for archived orgs
- [ ] Data reassignment tools

### Phase 3: User Management (Day 4)
- [ ] User list with organization association
- [ ] Create user with invitation
- [ ] Edit user details
- [ ] Delete user functionality
- [ ] User reassignment to different org

### Phase 4: Usage Statistics (Day 5-6)
- [ ] Usage tracking implementation
- [ ] Statistics dashboard UI
- [ ] Date range filtering
- [ ] Organization filtering
- [ ] Export functionality
- [ ] Billing calculations display

### Phase 5: Testing & Polish (Day 7)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Loading states
- [ ] Confirmation dialogs

## Extensibility Considerations

### Future Feature Additions
When adding new billable features:
1. Add feature flag to organization settings
2. Add billing rate configuration
3. Add usage tracking event type
4. Add statistic metric to dashboard
5. Update export formats

### Database Extensibility
- Feature flags stored as JSONB (flexible)
- Billing rates stored as JSONB (flexible)
- Usage events table supports any event type
- Metadata field for additional tracking data

### UI Extensibility
- Dynamic feature flag rendering
- Configurable statistics cards
- Pluggable export formats
- Modular component structure

## Security Requirements

### Access Control
- Only `super_admin` role can access
- Double-check role on all operations
- Validate organization ownership before data operations
- Require confirmations for destructive actions

### Data Protection
- Soft delete by default (archive)
- Hard delete requires explicit confirmation
- Audit trail for future implementation
- Rate limiting on bulk operations

## Success Criteria

### Must Have
- [ ] Create organizations with custom features/billing
- [ ] Archive and delete organizations
- [ ] Reassign data between organizations
- [ ] Complete user CRUD operations
- [ ] Usage statistics with date filtering
- [ ] Export usage data for billing

### Should Have
- [ ] Bulk user operations
- [ ] Usage trend visualizations
- [ ] Billing impact calculations
- [ ] Search and filter on all lists

### Nice to Have
- [ ] Audit log of actions
- [ ] Email templates management
- [ ] Automated billing reports
- [ ] Usage alerts and thresholds

---

**Version**: 2.0 (Simplified)
**Status**: Ready for Implementation
**Focus**: Core administrative functions with billing preparation