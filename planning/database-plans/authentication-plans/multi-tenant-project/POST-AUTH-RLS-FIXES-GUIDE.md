# Post-Authentication RLS Policy Fixes Guide

## Issue Summary
After implementing multi-tenant authentication with Row Level Security (RLS) policies, many database operations that previously worked started failing with RLS policy violations. This document outlines the common issues and their solutions.

**Date Discovered**: January 29, 2025  
**Status**: RESOLVED ✅

## Root Cause
The multi-tenancy implementation introduced:
1. RLS policies on all tables requiring `organisation_id` matching
2. User-authenticated Supabase clients that enforce RLS
3. Missing `organisation_id` fields in INSERT operations
4. Legacy code that didn't account for organization context

## Common Error Messages

### 1. RLS Policy Violation on INSERT
```
code: '42501'
message: 'new row violates row-level security policy for table "tablename"'
```

**Cause**: INSERT operations missing the `organisation_id` field when RLS policies require it.

**Solution**: Include `organisation_id` in all INSERT operations:
```javascript
// ❌ WRONG - Missing organisation_id
await supabase.from('categories').insert({
  menu_id: menuId,
  name: categoryName
});

// ✅ CORRECT - Includes organisation_id
const orgId = getCurrentOrganizationId();
await supabase.from('categories').insert({
  menu_id: menuId,
  name: categoryName,
  organisation_id: orgId
});
```

### 2. Empty Results Despite Data Existing
**Symptom**: Queries return no data even though data exists in the database.

**Cause**: Using anon key without user authentication context.

**Solution**: Use user-authenticated Supabase client:
```javascript
// ❌ WRONG - Using default client
const { data } = await supabase.from('restaurants').select('*');

// ✅ CORRECT - Using authenticated client
const client = getSupabaseClient(); // Returns user-authenticated client
const { data } = await client.from('restaurants').select('*');
```

### 3. Category Rename Not Working
**Symptom**: Category renames appear to save but don't actually update.

**Cause**: Multiple issues:
1. Category field not being sent to server (frontend issue)
2. RLS blocking category creation (missing organisation_id)
3. Image URLs being inadvertently deleted

**Solution**: Complete fix involves:
1. Frontend: Ensure category field is included in bulk updates
2. Backend: Add organisation_id to category inserts
3. Frontend: Don't send imageURL field for category-only updates

## Implementation Checklist

When fixing RLS issues in existing features:

### 1. Frontend Changes
- [ ] Ensure auth token is sent with all API requests
- [ ] Include organization ID in request headers
- [ ] Check that all required fields are being sent

```javascript
// api.js - Ensure interceptor is configured
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  const orgId = localStorage.getItem('currentOrgId');
  if (orgId) {
    config.headers['X-Organization-ID'] = orgId;
  }
  return config;
});
```

### 2. Backend Middleware
- [ ] Apply auth middleware to all protected routes
- [ ] Apply organization middleware to set context
- [ ] Ensure middleware order is correct

```javascript
// server.js
app.get('/api/restaurants', authMiddleware, async (req, res) => {
  // Route is now protected and has user context
});
```

### 3. Database Service Updates
- [ ] Use getSupabaseClient() instead of direct supabase reference
- [ ] Include organisation_id in all INSERT operations
- [ ] Add getCurrentOrganizationId() where needed

```javascript
// database-service.js
async function createSomething(data) {
  const client = getSupabaseClient(); // User-authenticated
  const orgId = getCurrentOrganizationId();
  
  const { data: result, error } = await client
    .from('table')
    .insert({
      ...data,
      organisation_id: orgId // Always include
    });
}
```

### 4. Table-Specific Requirements

#### Categories Table
```javascript
{
  menu_id: uuid,
  name: string,
  organisation_id: uuid, // REQUIRED for RLS
  created_at: timestamp,
  updated_at: timestamp
}
```

#### Restaurants Table
```javascript
{
  name: string,
  slug: string,
  organisation_id: uuid, // REQUIRED for RLS
  // ... other fields
}
```

#### Menus Table
```javascript
{
  restaurant_id: uuid,
  platform_id: uuid,
  organisation_id: uuid, // REQUIRED for RLS
  // ... other fields
}
```

## Debugging Steps

When encountering RLS issues:

1. **Check Server Logs**
   - Look for RLS policy violation errors
   - Check if organisation_id is being set

2. **Verify Auth Token**
   - Browser DevTools → Network → Request Headers
   - Should see: `Authorization: Bearer <token>`

3. **Check Organization Context**
   ```javascript
   console.log('[Database] Current org ID:', getCurrentOrganizationId());
   ```

4. **Test Queries Directly**
   ```sql
   -- Check if data exists
   SELECT * FROM table_name WHERE organisation_id = '00000000-0000-0000-0000-000000000000';
   
   -- Check RLS policies
   SELECT * FROM pg_policies WHERE tablename = 'table_name';
   ```

## Common Patterns

### Pattern 1: Bulk Operations
```javascript
async function bulkUpdate(items) {
  const orgId = getCurrentOrganizationId();
  const client = getSupabaseClient();
  
  for (const item of items) {
    // Handle creates that need org_id
    if (needsCreate) {
      await client.from('table').insert({
        ...data,
        organisation_id: orgId
      });
    }
    // Updates typically don't need org_id (already set)
    else {
      await client.from('table').update(data).eq('id', item.id);
    }
  }
}
```

### Pattern 2: Nested Creates
```javascript
async function createWithRelations(parentData, childrenData) {
  const orgId = getCurrentOrganizationId();
  const client = getSupabaseClient();
  
  // Create parent with org_id
  const { data: parent } = await client.from('parents').insert({
    ...parentData,
    organisation_id: orgId
  });
  
  // Create children with org_id
  const children = childrenData.map(child => ({
    ...child,
    parent_id: parent.id,
    organisation_id: orgId // Don't forget!
  }));
  
  await client.from('children').insert(children);
}
```

## Testing After Fixes

1. **Test Create Operations**
   - Create new records
   - Verify organisation_id is set correctly

2. **Test Read Operations**
   - List all records
   - Filter by various criteria
   - Verify only org's data is visible

3. **Test Update Operations**
   - Edit existing records
   - Bulk updates
   - Category renames

4. **Test Delete Operations**
   - Soft deletes (is_deleted flag)
   - Hard deletes
   - Cascade deletes

## Migration Guide for Other Features

If you encounter similar issues in other parts of the app:

1. **Identify the broken feature**
   - Note the error message
   - Check browser console and server logs

2. **Apply the standard fixes**
   - Add organisation_id to INSERTs
   - Use getSupabaseClient() for queries
   - Apply auth middleware to routes

3. **Test thoroughly**
   - Test with multiple organizations
   - Test with different user roles
   - Verify data isolation

4. **Document any unique issues**
   - Add to this guide if you find new patterns
   - Update table-specific requirements

## Related Files

- `/middleware/auth.js` - Authentication middleware
- `/middleware/organization-middleware.js` - Organization context
- `/src/services/database-service.js` - Database operations
- `/src/services/api.js` - Frontend API service
- `/src/context/AuthContext.tsx` - Auth state management

## Future Improvements

1. **Add database triggers** to automatically set organisation_id
2. **Create helper functions** for common INSERT patterns
3. **Add TypeScript types** to enforce organisation_id inclusion
4. **Implement request context** to avoid passing orgId everywhere
5. **Add automated tests** for RLS policy compliance

## Conclusion

The multi-tenant authentication implementation is working correctly, but requires careful attention to:
1. Always include organisation_id in INSERT operations
2. Use authenticated Supabase clients for queries
3. Apply auth middleware to all protected routes
4. Test with actual user sessions, not just anon keys

Following this guide should help resolve most RLS-related issues encountered after the authentication system implementation.