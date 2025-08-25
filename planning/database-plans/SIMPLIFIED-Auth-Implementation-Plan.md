# Simplified Multi-Tenant Authentication Implementation Plan
## For UberEats Image Extractor Application

### Executive Summary
This plan simplifies the authentication structure from pumpd-webhook while maintaining core security and multi-tenancy features. We remove overengineered features like emergency profiles, JWT role overrides, and complex retry logic to create a lean, maintainable authentication system.

---

## Core Architecture Decisions

### What We're Building
- **Simple role-based access**: Admin and User roles only
- **Organization-based data isolation**: All data filtered by organization
- **Stripe billing integration**: Organizations linked to Stripe customers
- **Clean authentication flow**: No fallbacks or complex retry logic

### What We're NOT Building
- ❌ Emergency profile creation
- ❌ JWT role overrides
- ❌ Complex retry mechanisms
- ❌ Cross-tab synchronization
- ❌ Restaurant-level access control
- ❌ Multiple admin role levels

---

## Database Schema (Minimal & Clean)

### New Tables Required

```sql
-- 1. Organizations Table (Simple)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Profiles Table (Simplified)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX idx_profiles_org ON profiles(organisation_id);
CREATE INDEX idx_profiles_user ON profiles(id);
```

### Modify Existing Tables

```sql
-- Add organization_id to ALL data tables
ALTER TABLE restaurants 
  ADD COLUMN organisation_id UUID REFERENCES organisations(id),
  ADD COLUMN created_by UUID REFERENCES auth.users(id);

ALTER TABLE extraction_jobs
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

ALTER TABLE menus
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

ALTER TABLE menu_items
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

ALTER TABLE categories
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

-- Create indexes for all organization columns
CREATE INDEX idx_restaurants_org ON restaurants(organisation_id);
CREATE INDEX idx_extraction_jobs_org ON extraction_jobs(organisation_id);
CREATE INDEX idx_menus_org ON menus(organisation_id);
CREATE INDEX idx_menu_items_org ON menu_items(organisation_id);
CREATE INDEX idx_categories_org ON categories(organisation_id);
```

### Simple RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Simple organization visibility policy
CREATE POLICY "users_see_own_org" ON organisations
  FOR SELECT USING (
    id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Simple profile visibility
CREATE POLICY "users_see_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Simple data access policies (same pattern for all data tables)
CREATE POLICY "org_data_isolation" ON restaurants
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Repeat above policy for extraction_jobs, menus, menu_items, categories
```

---

## Frontend Implementation (Simplified)

### Files to Copy and Modify from pumpd-webhook

#### 1. AuthProvider (SIMPLIFY HEAVILY)
**Source**: `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/context/auth/AuthProvider.tsx`
**Target**: `/src/context/AuthContext.tsx`

**Keep These Parts:**
```typescript
// Lines 50-70: Basic context structure
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lines 140-160: Basic login function (remove retry logic)
const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  // Load profile once, no retries
  await loadUserProfile(data.user);
};

// Lines 200-220: Google OAuth (keep as-is)
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  if (error) throw error;
};

// Lines 400-420: Logout function (simplified)
const logout = async () => {
  await supabase.auth.signOut();
  setUser(null);
  navigate('/login');
};
```

**Remove These Parts:**
- ❌ Lines 500-650: All retry logic and fallback mechanisms
- ❌ Lines 300-350: JWT role extraction
- ❌ Lines 700-750: Cross-tab synchronization
- ❌ Lines 250-280: Emergency profile creation

**New Simplified loadUserProfile:**
```typescript
const loadUserProfile = async (supabaseUser: User) => {
  // Simple profile load - no retries, no fallbacks
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      organisation:organisations(*)
    `)
    .eq('id', supabaseUser.id)
    .single();

  if (error || !profile) {
    throw new Error('Profile not found');
  }

  setUser({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    organisationId: profile.organisation_id,
    organisation: profile.organisation
  });
};
```

#### 2. Types Definition (SIMPLIFY)
**Source**: `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/context/auth/types.ts`
**Target**: `/src/types/auth.ts`

```typescript
// Simplified types - no complex roles
export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organisationId: string;
  organisation?: Organisation;
}

export interface Organisation {
  id: string;
  name: string;
  stripe_customer_id?: string;
  settings?: Record<string, any>;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}
```

#### 3. Supabase Client (COPY AS-IS)
**Source**: `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/src/integrations/supabase/client.ts`
**Target**: `/src/lib/supabase.ts`

```typescript
// Copy exactly as-is - this is already simple and correct
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

---

## Backend Implementation (Simplified)

### Files to Copy and Modify from pumpd-webhook

#### 1. Auth Middleware (HEAVILY SIMPLIFIED)
**Source**: `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/server/middleware/auth.js`
**Target**: `/server/middleware/auth.js`

**Simplified Version:**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function authMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile with organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, organisation:organisations(*)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      organisationId: profile.organisation_id,
      organisation: profile.organisation
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Simple permission check helper
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
```

**What We Removed:**
- ❌ Lines 100-200: JWT role extraction and override logic
- ❌ Lines 250-350: Complex permission checking functions
- ❌ Lines 400-444: Restaurant-level permission checks

#### 2. API Route Pattern (REFERENCE ONLY)
**Source**: `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/server/handlers/dashboard-api.js`
**Reference**: Lines 125-145 for organization filtering pattern

**Pattern to Apply in All Routes:**
```javascript
// Every query must include organization filter
router.get('/extractions', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('extraction_jobs')
    .select('*')
    .eq('organisation_id', req.user.organisationId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

#### 3. Stripe Integration (ADAPT)
**Source**: `/Users/giannimunro/Desktop/cursor-projects/pumpd-webhook/server/services/stripe/meter-management.js`
**Target**: `/server/services/stripe.js`

**Modifications Needed:**
- Line 11-16: Change 'SMS Credits' to 'Extraction Credits'
- Line 12: Change event_name from 'sms_credits' to 'extraction_credits'
- Keep all the meter creation logic as-is

---

## Implementation Roadmap

### Phase 1: Database Setup (Day 1)
**Morning (2-3 hours):**
1. Create Supabase project
2. Run schema creation SQL:
   ```sql
   -- Run all CREATE TABLE statements
   -- Run all ALTER TABLE statements
   -- Run all CREATE INDEX statements
   ```

**Afternoon (2-3 hours):**
3. Enable RLS and create policies
4. Create test organization and user
5. Verify RLS policies work correctly

### Phase 2: Frontend Auth (Day 2-3)
**Day 2 Morning:**
1. Copy and simplify AuthProvider.tsx → AuthContext.tsx
   - Remove lines 500-750 (all complex logic)
   - Simplify loadUserProfile function
   - Remove retry logic

**Day 2 Afternoon:**
2. Create login/signup pages
3. Set up Google OAuth callback
4. Test authentication flow

**Day 3 Morning:**
5. Add organization context to data service
   ```typescript
   // services/database-service.js modifications
   const fetchExtractions = async () => {
     const { data } = await supabase
       .from('extraction_jobs')
       .select('*')
       .eq('organisation_id', user.organisationId);
     return data;
   };
   ```

**Day 3 Afternoon:**
6. Update all existing queries to include org filter
7. Test data isolation

### Phase 3: Backend Auth (Day 4)
**Morning:**
1. Copy and simplify auth.js middleware
2. Add authMiddleware to all routes
3. Update server.js to use auth

**Afternoon:**
4. Test all API endpoints with auth
5. Verify organization filtering works

### Phase 4: Billing Integration (Day 5)
**Morning:**
1. Set up Stripe account with meters API
2. Copy meter-management.js
3. Change to extraction credits

**Afternoon:**
4. Create webhook endpoint for usage tracking
5. Link organizations to Stripe customers

### Phase 5: Testing & Polish (Day 6)
1. Security testing checklist
2. Migration script for existing data
3. Documentation
4. Deployment prep

---

## Migration Strategy for Existing Data

```sql
-- Step 1: Create default organization
INSERT INTO organisations (id, name, stripe_customer_id)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization', null);

-- Step 2: Create profiles for existing users
INSERT INTO profiles (id, email, name, role, organisation_id)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', email),
  'admin', -- Make existing users admins
  '00000000-0000-0000-0000-000000000000'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Step 3: Assign existing data to default org
UPDATE restaurants SET organisation_id = '00000000-0000-0000-0000-000000000000' WHERE organisation_id IS NULL;
UPDATE extraction_jobs SET organisation_id = '00000000-0000-0000-0000-000000000000' WHERE organisation_id IS NULL;
UPDATE menus SET organisation_id = '00000000-0000-0000-0000-000000000000' WHERE organisation_id IS NULL;
UPDATE menu_items SET organisation_id = '00000000-0000-0000-0000-000000000000' WHERE organisation_id IS NULL;
UPDATE categories SET organisation_id = '00000000-0000-0000-0000-000000000000' WHERE organisation_id IS NULL;
```

---

## Environment Variables Required

```env
# Frontend (.env)
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon_key]

# Backend (.env)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service_key]
STRIPE_SECRET_KEY=sk_[key]
STRIPE_WEBHOOK_SECRET=whsec_[secret]
```

---

## Testing Checklist

### Security Tests
- [ ] User A cannot see User B's organization data
- [ ] Non-admin users cannot access admin endpoints
- [ ] All queries filter by organization_id
- [ ] RLS policies prevent direct table access

### Functionality Tests
- [ ] Login with email/password works
- [ ] Google OAuth works
- [ ] Profile loads correctly
- [ ] Organization data loads
- [ ] Extraction jobs filtered by org
- [ ] Menus filtered by org

---

## Common Patterns to Apply

### Frontend Query Pattern
```typescript
// Always include organization filter
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('organisation_id', user.organisationId);
```

### Backend Query Pattern
```javascript
// Always use service role and filter by org
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('organisation_id', req.user.organisationId);
```

### Creating New Records
```typescript
// Always include organisation_id and created_by
const { data } = await supabase
  .from('extraction_jobs')
  .insert({
    ...jobData,
    organisation_id: user.organisationId,
    created_by: user.id
  });
```

---

## Files Summary

### Files to Copy from pumpd-webhook (with modifications):
1. `AuthProvider.tsx` → Simplify heavily, remove 60% of code
2. `types.ts` → Simplify to 2 roles only
3. `supabase/client.ts` → Copy as-is
4. `auth.js` (backend) → Remove complex permissions
5. `stripe-client.js` → Copy as-is
6. `meter-management.js` → Change to extraction credits

### Files to Reference (don't copy):
1. `dashboard-api.js` → Reference for query patterns only

### New Files to Create:
1. `/src/pages/Login.tsx` - Simple login page
2. `/src/pages/Signup.tsx` - Simple signup page
3. `/server/routes/auth.js` - Auth endpoints
4. `/database/migrations/001_add_auth.sql` - Migration script

---

## Success Criteria

✅ Users can log in with email or Google
✅ Each user belongs to one organization
✅ All data is filtered by organization
✅ Admins can manage organization settings
✅ Regular users can only access their org's data
✅ Stripe billing tracks extraction usage
✅ No complex retry logic or fallbacks
✅ Clean, maintainable code

---

## Risk Mitigation

### Potential Issues and Solutions:

1. **Existing users have no profile**
   - Solution: Migration script creates profiles

2. **Existing data has no org_id**
   - Solution: Assign to default organization

3. **RLS too restrictive**
   - Solution: Test thoroughly, use service role for admin operations

4. **Stripe meter creation fails**
   - Solution: Manual creation via Stripe dashboard as backup

---

## Final Notes

This simplified approach removes approximately 60% of the complexity from pumpd-webhook while maintaining all essential features. The key principle is: **Simple and working beats complex and perfect**.

Focus on:
- One organization per user
- Two roles only (admin/user)
- Simple permission checks
- No fallback mechanisms
- Clear error messages

Avoid:
- Complex retry logic
- Emergency profiles
- JWT overrides
- Cross-tab sync
- Multiple permission levels

The result will be a clean, maintainable authentication system that can be understood and modified by any developer on the team.