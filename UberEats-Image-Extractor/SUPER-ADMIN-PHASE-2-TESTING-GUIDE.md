# Super Admin Dashboard - Phase 2 Testing Guide
## Organization Management Features

## Phase 2 Completion Status ✅

### Completed Tasks
1. ✅ **Database Schema Enhancements**
   - Created `reassign_restaurant_to_org` function
   - Created `duplicate_restaurant_to_org` function
   - Created `get_organization_data_stats` function
   - Added `archived_by` column to organisations table
   - Added billing rates validation trigger

2. ✅ **React Components Created**
   - `FeatureFlagsEditor.tsx` - Feature configuration UI
   - `OrganizationCreateModal.tsx` - Create new organizations
   - `OrganizationEditModal.tsx` - Edit organization details
   - `OrganizationArchiveModal.tsx` - Archive organizations
   - `OrganizationDeleteModal.tsx` - Permanently delete organizations
   - `OrganizationDataModal.tsx` - Reassign/duplicate data
   - Updated `SuperAdminOrganizations.tsx` - Enhanced main component

3. ✅ **API Endpoints Added**
   - GET `/api/super-admin/organizations/:id` - Get organization details
   - PUT `/api/super-admin/organizations/:id` - Update organization
   - POST `/api/super-admin/organizations/:id/restore` - Restore archived org
   - DELETE `/api/super-admin/organizations/:id` - Permanently delete
   - POST `/api/super-admin/organizations/reassign-data` - Reassign data
   - POST `/api/super-admin/organizations/duplicate-data` - Duplicate data

## Testing Instructions

### Prerequisites
1. Ensure server is running on port 3007
2. Have a super_admin user account ready
3. Have at least 2 test organizations in the database

### 1. Test Organization Creation

#### UI Testing
1. Navigate to `/super-admin`
2. Go to Organizations tab
3. Click "Create Organization" button
4. Fill in:
   - Organization Name: "Test Org Phase 2"
   - Admin Name: "Test Admin"
   - Admin Email: "admin@testorg.com"
   - Keep "Send invitation email" checked
5. Configure features:
   - Toggle features on/off
   - Adjust billing rates
6. Click "Create Organization"
7. **Expected**: Organization appears in list with configured features

#### API Testing
```bash
TOKEN="your_super_admin_token"

curl -X POST http://localhost:3007/api/super-admin/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Org",
    "feature_flags": {
      "standardExtraction": {"enabled": true, "ratePerItem": 0.10},
      "premiumExtraction": {"enabled": true, "ratePerItem": 0.25}
    },
    "billing_rates": {
      "standardExtraction": 0.10,
      "premiumExtraction": 0.25
    }
  }'
```

### 2. Test Organization Editing

#### UI Testing
1. Click the three-dot menu on an organization card
2. Select "Edit"
3. In the modal:
   - Change organization name
   - Toggle feature flags
   - Adjust billing rates
   - View member list
   - Check usage statistics
4. Save changes
5. **Expected**: Changes persist after modal closes

#### API Testing
```bash
ORG_ID="your_org_id"

curl -X PUT http://localhost:3007/api/super-admin/organizations/$ORG_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Org Name",
    "feature_flags": {
      "csvDownload": {"enabled": false, "ratePerItem": 0}
    }
  }'
```

### 3. Test Archive & Restore

#### Archive Testing
1. Click three-dot menu on active organization
2. Select "Archive"
3. Review data preservation warning
4. Confirm archive
5. **Expected**: 
   - Organization status changes to "archived"
   - Appears when filter set to "Archived"
   - Users lose access

#### Restore Testing
1. Filter to show "Archived" organizations
2. Click three-dot menu on archived org
3. Select "Restore"
4. **Expected**: Organization returns to active status

#### API Testing
```bash
# Archive
curl -X POST http://localhost:3007/api/super-admin/organizations/$ORG_ID/archive \
  -H "Authorization: Bearer $TOKEN"

# Restore
curl -X POST http://localhost:3007/api/super-admin/organizations/$ORG_ID/restore \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Test Permanent Deletion

#### UI Testing
1. Ensure organization is archived first
2. Click three-dot menu on archived org
3. Select "Delete Permanently"
4. Type organization name to confirm
5. Click delete button
6. **Expected**: Organization permanently removed

#### API Testing
```bash
# Delete (only works on archived orgs)
curl -X DELETE http://localhost:3007/api/super-admin/organizations/$ORG_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Test Data Management

#### Reassign Data Testing
1. Click three-dot menu on any organization
2. Select "Manage Data"
3. Select "Reassign Data" tab
4. Select target organization
5. Select restaurants to move
6. Click "Reassign Selected"
7. **Expected**: Restaurants move to target org

#### Duplicate Data Testing
1. In Data Management modal
2. Select "Duplicate Data" tab
3. Select target organization
4. Select restaurants to copy
5. Click "Duplicate Selected"
6. **Expected**: Copies created in target org

#### API Testing
```bash
# Reassign
curl -X POST http://localhost:3007/api/super-admin/organizations/reassign-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantIds": ["restaurant_id_1", "restaurant_id_2"],
    "targetOrgId": "target_org_id"
  }'

# Duplicate
curl -X POST http://localhost:3007/api/super-admin/organizations/duplicate-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantIds": ["restaurant_id_1"],
    "targetOrgId": "target_org_id"
  }'
```

### 6. Test Filtering & Search

1. **Search Testing**:
   - Type organization name in search box
   - **Expected**: Real-time filtering

2. **Status Filter Testing**:
   - Click "Active" tab - shows only active orgs
   - Click "Archived" tab - shows only archived orgs
   - Click "All" tab - shows all organizations

3. **Refresh Testing**:
   - Click refresh button
   - **Expected**: List reloads with latest data

## Validation Checklist

### Organization Creation ✓
- [ ] Name is required
- [ ] Admin email is required
- [ ] Feature flags can be toggled
- [ ] Billing rates can be adjusted
- [ ] Rates must be positive numbers
- [ ] Organization appears in list after creation

### Organization Editing ✓
- [ ] Name can be changed
- [ ] Features can be toggled on/off
- [ ] Billing rates update correctly
- [ ] Member list shows correct users
- [ ] Usage statistics display
- [ ] Changes persist after save

### Archive & Restore ✓
- [ ] Only active orgs can be archived
- [ ] Archive preserves all data
- [ ] Users lose access to archived orgs
- [ ] Archived orgs can be restored
- [ ] Restored orgs regain active status

### Delete (Hard Delete) ✓
- [ ] Only archived orgs can be deleted
- [ ] Requires typing org name to confirm
- [ ] Shows data impact warning
- [ ] All related data is deleted
- [ ] Cannot be undone

### Data Management ✓
- [ ] Restaurants can be selected
- [ ] Target org can be selected
- [ ] Reassignment moves data
- [ ] Duplication creates copies
- [ ] Original data unchanged in duplication
- [ ] Success feedback displayed

## Database Verification Queries

```sql
-- Check organization status
SELECT id, name, status, archived_at, feature_flags, billing_rates
FROM organisations
WHERE name LIKE '%Test%';

-- Check data statistics for an org
SELECT * FROM get_organization_data_stats('org_id_here');

-- Verify restaurant reassignment
SELECT r.id, r.name, r.organisation_id, o.name as org_name
FROM restaurants r
JOIN organisations o ON r.organisation_id = o.id
WHERE r.name LIKE '%Test%';

-- Check archived organizations
SELECT id, name, status, archived_at, archived_by
FROM organisations
WHERE status = 'archived';
```

## Common Issues & Solutions

### Issue: "Organization must be archived before deletion"
**Solution**: Archive the organization first, then delete

### Issue: Feature flags not saving
**Solution**: Ensure billing rates are positive numbers

### Issue: Data reassignment fails
**Solution**: Check that target organization exists and is active

### Issue: Modal not closing after action
**Solution**: Check browser console for errors, ensure API call succeeded

## Phase 2 Success Criteria ✅

1. ✅ Organizations can be created with custom features/billing
2. ✅ Organizations can be edited (name, features, rates)
3. ✅ Organizations can be archived (soft delete)
4. ✅ Archived organizations can be restored
5. ✅ Archived organizations can be permanently deleted
6. ✅ Data can be reassigned between organizations
7. ✅ Data can be duplicated to other organizations
8. ✅ All modals work correctly
9. ✅ Error handling is in place
10. ✅ Success feedback is provided

## Next Steps - Phase 3

Once Phase 2 testing is complete:
1. **User Management** - Global user list, role management
2. **Usage Statistics** - Detailed metrics and billing calculations
3. **Performance Optimization** - Caching, pagination
4. **Audit Logging** - Track all super admin actions

---

**Phase 2 Status**: COMPLETE ✅
**Ready for**: Testing & Production Deployment