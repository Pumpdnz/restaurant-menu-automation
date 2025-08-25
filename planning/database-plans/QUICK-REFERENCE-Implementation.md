# Quick Reference: Multi-Tenant Auth Implementation

## Critical Path - Must Implement First

### 1. Database Tables (Priority Order)
```sql
-- 1. Organizations (Required First)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profiles (Links Auth to App)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add org_id to existing tables
ALTER TABLE restaurants ADD COLUMN organisation_id UUID REFERENCES organisations(id);
ALTER TABLE extraction_jobs ADD COLUMN organisation_id UUID REFERENCES organisations(id);
ALTER TABLE menus ADD COLUMN organisation_id UUID REFERENCES organisations(id);
```

### 2. RLS Policies (Minimum Required)
```sql
-- Organization isolation
CREATE POLICY "org_isolation" ON restaurants
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
```

### 3. Frontend AuthContext (Copy Pattern)
```typescript
// Key features to implement:
- JWT role extraction from token
- Profile fallback mechanism (3 retries)
- Cross-tab synchronization
- Auto-refresh tokens
- Emergency profile creation on failure
```

### 4. Backend Middleware (Essential)
```javascript
// Extract JWT role from token
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
const jwtRole = payload?.app_metadata?.role;

// Always check permissions before data access
const permission = await checkRestaurantPermission(user, restaurantId, action);
```

## Implementation Checklist

### Week 1: Foundation
- [ ] Create Supabase project
- [ ] Set up auth with Google OAuth
- [ ] Create organisations table
- [ ] Create profiles table
- [ ] Link existing tables with org_id

### Week 2: Authentication
- [ ] Implement AuthContext with fallback
- [ ] Add JWT role extraction
- [ ] Set up auth middleware
- [ ] Create permission helpers
- [ ] Test auth flows

### Week 3: Data Isolation
- [ ] Implement RLS policies
- [ ] Add org filtering to queries
- [ ] Create access control tables
- [ ] Test data isolation
- [ ] Verify no cross-tenant leaks

### Week 4: Billing Integration
- [ ] Set up Stripe account
- [ ] Configure meters API
- [ ] Create usage tracking
- [ ] Implement webhook handlers
- [ ] Test billing events

### Week 5: Testing & Deployment
- [ ] Security testing
- [ ] Performance testing
- [ ] Migration scripts
- [ ] Documentation
- [ ] Production deployment

## Critical Code Patterns

### 1. Profile Fallback (MUST HAVE)
```typescript
// Emergency profile when DB fails
const emergencyProfile: UserProfile = {
  id: supabaseUser.id,
  email: supabaseUser.email || '',
  name: supabaseUser.user_metadata?.name || 'User',
  role: 'user',
  organisationId: 'default-org',
  restaurants: []
};
```

### 2. Organization Filtering (EVERY QUERY)
```typescript
const { data } = await supabase
  .from('extraction_jobs')
  .select('*')
  .eq('organisation_id', user.organisationId);
```

### 3. Permission Check (BEFORE ACCESS)
```javascript
if (user.role !== 'super_admin') {
  // Check organization match
  if (resource.organisation_id !== user.organisationId) {
    return { hasPermission: false };
  }
}
```

## Environment Variables Required
```env
# Supabase (Required)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (For Billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Common Pitfalls to Avoid

1. **No Profile Fallback** = Users locked out on DB issues
2. **Missing JWT Role** = Slow permission checks
3. **No Org Filtering** = Data leaks between tenants
4. **Client-side Permissions** = Security vulnerability
5. **No Service Role Key** = Cannot bypass RLS for admin

## Testing Checklist

### Security Tests
- [ ] Cannot access other org's data
- [ ] JWT tampering rejected
- [ ] Role elevation blocked
- [ ] Cross-tenant foreign keys prevented

### Performance Tests
- [ ] Org filtering doesn't slow queries
- [ ] RLS policies are efficient
- [ ] JWT caching works
- [ ] Token refresh is smooth

## Quick Win Implementation Order

1. **Day 1**: Create tables, no RLS yet
2. **Day 2**: Basic AuthContext without fallback
3. **Day 3**: Add organization filtering
4. **Day 4**: Implement RLS policies
5. **Day 5**: Add fallback mechanisms
6. **Week 2**: Billing integration

## SQL Migration Script

```sql
-- Run in order, test after each step

-- Step 1: Create core tables
CREATE TABLE IF NOT EXISTS organisations (...);
CREATE TABLE IF NOT EXISTS profiles (...);

-- Step 2: Add org_id to existing tables
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS organisation_id UUID;

-- Step 3: Create default org for existing data
INSERT INTO organisations (id, name, slug) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'default')
ON CONFLICT DO NOTHING;

-- Step 4: Assign existing data to default org
UPDATE restaurants SET organisation_id = '00000000-0000-0000-0000-000000000000' 
WHERE organisation_id IS NULL;

-- Step 5: Enable RLS (only after testing)
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

## Contact Points in pumpd-webhook Code

Key files to reference:
- `/src/context/auth/AuthProvider.tsx` - Full auth implementation
- `/server/middleware/auth.js` - Permission system
- `/server/handlers/dashboard-api.js` - Data filtering patterns
- `/server/services/stripe/meter-management.js` - Billing setup

## Final Note

The pumpd-webhook app's most critical pattern is the **JWT role with database fallback**. This prevents authentication failures from blocking users while maintaining security. Implement this pattern first before any other optimization.