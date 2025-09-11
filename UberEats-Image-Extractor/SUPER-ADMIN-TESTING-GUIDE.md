# Super Admin API Testing Guide

## Phase 1 Completion Status

### ✅ Completed Tasks
1. **Database Schema Updates** - Added feature_flags, billing_rates, is_archived to organisations
2. **Usage Events Table** - Created usage_events table for tracking billable actions  
3. **UI Components** - Created SuperAdminDashboard and tab components
4. **Route Protection** - Created SuperAdminRoute component with access control
5. **API Middleware** - Created superAdminMiddleware in `/middleware/superAdmin.js`
6. **API Routes** - Added 6 super admin endpoints to server.js

### 📋 Testing Instructions

## Manual Testing Steps

### 1. Create a Super Admin User
First, you need a user with super_admin role in the database:

```sql
-- Run this in Supabase SQL Editor
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';
```

### 2. Test Frontend Access

1. **Login** as the super admin user
2. **Navigate** to `/super-admin` 
3. **Verify** you can see:
   - Super Admin Dashboard header
   - Tab navigation (Overview, Organizations, Users, Usage, Settings)
   - Content area for each tab

4. **Test access control**:
   - Logout and login as regular user
   - Try to navigate to `/super-admin`
   - Should redirect to home page with "Access Denied" message

### 3. Test API Endpoints

#### Automated Testing
```bash
# 1. Get your auth token
# Login to app and run in browser console:
localStorage.getItem("auth_token")

# 2. Add token to .env
# Edit .env and add:
TEST_SUPER_ADMIN_TOKEN=your_token_here

# 3. Run test script
cd UberEats-Image-Extractor
node test-super-admin.js
```

#### Manual API Testing with curl

```bash
# Set your token
TOKEN="your_auth_token_here"

# Test organizations endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3007/api/super-admin/organizations

# Test stats endpoint  
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3007/api/super-admin/stats

# Test users endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3007/api/super-admin/users

# Test without token (should fail)
curl http://localhost:3007/api/super-admin/organizations

# Test role update
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}' \
  http://localhost:3007/api/super-admin/users/USER_ID_HERE/role
```

### 4. Expected Results

#### ✅ Success Cases
- Super admin can access dashboard
- All API endpoints return data with valid super_admin token
- Stats show correct counts

#### ❌ Failure Cases  
- Regular users cannot access `/super-admin` route
- API endpoints return 401 without token
- API endpoints return 403 with non-super_admin token

## Next Steps - Phase 2

Once testing is complete and any issues are fixed, proceed to Phase 2:

### Phase 2: Organization Management
- [ ] Create organization creation form
- [ ] Implement organization editing
- [ ] Add archive/unarchive functionality  
- [ ] Add delete with data reassignment
- [ ] Update feature flags interface
- [ ] Update billing rates interface

### Phase 3: User Management
- [ ] Create global user list with filters
- [ ] Add user search functionality
- [ ] Implement role management UI
- [ ] Add user creation/deletion

### Phase 4: Usage Statistics
- [ ] Create usage dashboard
- [ ] Add filtering by date range
- [ ] Add filtering by organization
- [ ] Export functionality

## Troubleshooting

### Common Issues

1. **"No authorization token provided"**
   - Make sure you're logged in
   - Check localStorage has auth_token

2. **"Super admin access required"**  
   - Verify user has super_admin role in database
   - Check profiles table

3. **"Invalid or expired token"**
   - Token may have expired, login again
   - Check token format (should be JWT)

4. **Server not running on port 3007**
   - Make sure to run `npm start` in UberEats-Image-Extractor directory
   - Check no other process using port 3007

## Database Verification Queries

```sql
-- Check super admin users
SELECT id, email, role, organisation_id 
FROM profiles 
WHERE role = 'super_admin';

-- Check organizations
SELECT id, name, is_archived, created_at 
FROM organisations;

-- Check usage events (once populated)
SELECT * FROM usage_events 
ORDER BY created_at DESC 
LIMIT 10;
```