# Quick Reference: Multi-Tenant Auth Implementation (UPDATED)
## Current Status: Database & Backend Complete ✅

## ✅ COMPLETED COMPONENTS

### 1. Database Structure (DONE)
```sql
-- ✅ Organizations Table (CREATED)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ Profiles Table with 3-Tier Roles (CREATED)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('super_admin', 'admin', 'user')),
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ Organization Invitations Table (CREATED)
CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'user')),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ All data tables updated with organisation_id
-- restaurants, extraction_jobs, menus, menu_items, categories, 
-- item_images, option_sets, options
```

### 2. RLS Policies (DONE)
```sql
-- ✅ Super Admin Bypass Policy
CREATE FUNCTION has_org_access(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.role = 'super_admin' 
      OR profiles.organisation_id = org_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ Applied to all tables with simple function call
CREATE POLICY "restaurant_access_policy" ON restaurants
  FOR ALL USING (has_org_access(organisation_id));
```

### 3. Frontend Auth (PARTIALLY DONE)
```typescript
// ✅ AuthContext CREATED at: /src/context/AuthContext.tsx
// ✅ Auth Types CREATED at: /src/types/auth.ts
// ✅ Supabase Client CREATED at: /src/lib/supabase.ts

// Three-tier role system implemented:
type UserRole = 'super_admin' | 'admin' | 'user';

// Role check functions available:
isAdmin()      // Returns true for admin OR super_admin
isSuperAdmin() // Returns true for super_admin only
hasRole(role)  // Flexible role checking

// ⚠️ STILL NEEDED:
// - Login page component
// - Signup page component  
// - Password reset pages
// - Organization management UI
// - Super admin dashboard
```

### 4. Backend Middleware (DONE)
```javascript
// ✅ CREATED at: /middleware/auth.js

// Available middleware functions:
authMiddleware      // Token validation & profile loading
requireRole(role)   // Role-based access control
requireSuperAdmin() // Super admin only endpoints
requireOrgAdmin()   // Admin or super admin
addOrgFilter()      // Helper for org filtering

// Three-tier permission system:
// super_admin → Access everything
// admin → Access org data + user permissions
// user → Access org data only
```

### 5. Database Service Updates (DONE)
```javascript
// ✅ UPDATED: /src/services/database-service.js
// All create functions now accept organisationId parameter:

createMenu(menuData, organisationId)
createExtractionJob(jobData, organisationId)
upsertRestaurant(restaurantData, organisationId)
createRestaurant(restaurantData, organisationId)
// etc...
```

## 🔴 PENDING COMPONENTS

### 1. Frontend Pages (NOT STARTED)
```
❌ /src/pages/Login.tsx
❌ /src/pages/Signup.tsx
❌ /src/pages/ForgotPassword.tsx
❌ /src/pages/ResetPassword.tsx
❌ /src/pages/InviteAccept.tsx
❌ /src/pages/OrganizationSettings.tsx
❌ /src/pages/SuperAdminDashboard.tsx
❌ /src/pages/AuthCallback.tsx (OAuth handler)
❌ /src/pages/Billing.tsx (Usage & subscription)
```

### 2. App Router Updates (NOT STARTED)
```typescript
// Need to wrap App with AuthProvider
// Add protected routes
// Add role-based route guards
```

### 3. Google OAuth Setup (NOT STARTED)
```
- Enable in Supabase Dashboard
- Configure Google Cloud Console
- Add redirect URLs
- Set environment variables
```

### 4. Stripe Billing Integration (PLANNED - NOT STARTED)
```javascript
// FUTURE IMPLEMENTATION - After Auth is Complete
// This section outlines the billing architecture to ensure 
// UI components are built with billing in mind

// 1. Meter Configuration
const STRIPE_METERS = {
  EXTRACTION_CREDITS: 'extraction_credits',  // Each Firecrawl API call
  IMAGE_DOWNLOADS: 'image_downloads',        // Bulk image operations
  CSV_EXPORTS: 'csv_exports'                 // Menu exports
};

// 2. Usage Tracking Pattern (to be implemented)
async function trackUsage(eventType, quantity = 1) {
  await stripe.billing.meterEvents.create({
    event_name: eventType,
    payload: {
      value: quantity,
      stripe_customer_id: org.stripe_customer_id
    }
  });
}

// 3. Hook for All Firecrawl Operations
// Wrap existing scraping functions:
async function scrapeWithBilling(url, options) {
  try {
    const result = await firecrawlScrape(url, options);
    // Track successful extraction
    await trackUsage(STRIPE_METERS.EXTRACTION_CREDITS);
    return result;
  } catch (error) {
    // Don't charge for failed extractions
    throw error;
  }
}

// 4. UI Components to Build with Billing in Mind:
// - Usage dashboard widget
// - Billing alerts component  
// - Subscription status indicator
// - Usage limit warnings
// - Credit balance display
```

## 📋 CURRENT ENVIRONMENT VARIABLES

```env
# ✅ Already in .env
SUPABASE_URL=https://qgabsyggzlkcstjzugdh.supabase.co
SUPABASE_ANON_KEY=eyJhbG...

# ⚠️ NEEDS TO BE ADDED (get from Supabase dashboard)
SUPABASE_SERVICE_ROLE_KEY=

# For frontend (create .env.local)
VITE_SUPABASE_URL=https://qgabsyggzlkcstjzugdh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

## 🚀 NEXT IMMEDIATE STEPS

### Day 1: Create Login/Signup Pages
```bash
# 1. Create login page with email/password
# 2. Add Google OAuth button
# 3. Create signup page with org creation
# 4. Add invitation token handling
```

### Day 2: OAuth & Password Reset
```bash
# 1. Setup Google OAuth in Supabase
# 2. Create callback handler
# 3. Create password reset flow
# 4. Test authentication
```

### Day 3: Organization Management
```bash
# 1. Create org settings page
# 2. Add member list
# 3. Implement invitation system
# 4. Test invite flow
```

### Day 4: Super Admin Dashboard
```bash
# 1. Create super admin dashboard
# 2. Add org switcher
# 3. Implement impersonation
# 4. Add billing management
```

## ✅ WHAT'S WORKING NOW

1. **Database Ready** - All tables, RLS policies, and migrations applied
2. **Backend Auth** - Middleware complete with 3-tier roles
3. **Frontend Context** - AuthContext ready with role checks
4. **Data Isolation** - All queries filter by organization
5. **Invitation System** - Database structure ready

## 🔧 TESTING CHECKLIST

### Can Test Now:
- [x] Database migrations applied successfully
- [x] RLS policies created
- [x] Default organization created
- [x] Auth middleware exports correct functions

### Need UI to Test:
- [ ] User signup creates organization
- [ ] Login loads correct profile
- [ ] Google OAuth works
- [ ] Password reset flow
- [ ] Invitation acceptance
- [ ] Role-based access control
- [ ] Super admin can access all orgs
- [ ] Data isolation between orgs

## 🎯 SIMPLIFIED APPROACH BENEFITS

### What We Removed:
- ❌ Emergency profile fallbacks
- ❌ JWT role overrides  
- ❌ Complex retry logic
- ❌ Cross-tab synchronization
- ❌ 6 role levels → 3 roles

### What We Kept:
- ✅ Three-tier role system
- ✅ Organization invitations
- ✅ Super admin control
- ✅ Stripe billing ready
- ✅ Clean data isolation

## 📝 KEY PATTERNS TO FOLLOW

### Frontend Query Pattern:
```typescript
// Always include org filter
const { data } = await supabase
  .from('extraction_jobs')
  .select('*')
  .eq('organisation_id', user.organisationId);
```

### Backend Query Pattern:
```javascript
// Use middleware for auth
app.get('/api/extractions', authMiddleware, async (req, res) => {
  // req.user.organisationId automatically available
  const data = await getExtractions(req.user.organisationId);
  res.json(data);
});
```

### Role Check Pattern:
```javascript
// Frontend
if (hasRole('admin')) {
  // Show admin features
}

// Backend
app.post('/api/invite', requireOrgAdmin(), async (req, res) => {
  // Only admins can invite
});
```

## 💳 STRIPE BILLING ARCHITECTURE (Future Implementation)

### Billing Integration Points
```javascript
// 1. SERVER-SIDE: Intercept all Firecrawl API calls
// Location: /server.js (modify existing endpoints)

app.post('/api/scrape/batch', authMiddleware, async (req, res) => {
  // Check organization has active subscription
  const hasAccess = await checkBillingStatus(req.user.organisationId);
  if (!hasAccess) {
    return res.status(402).json({ 
      error: 'Payment required',
      upgrade_url: '/billing/upgrade'
    });
  }
  
  // Proceed with extraction
  const result = await performExtraction(req.body);
  
  // Track usage AFTER successful extraction
  await recordMeterEvent({
    organisation_id: req.user.organisationId,
    event_type: 'extraction',
    quantity: result.itemCount || 1
  });
  
  res.json(result);
});

// 2. DATABASE: Usage tracking table (to be created)
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  event_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

// 3. FRONTEND: Usage context for UI components
interface UsageContextType {
  currentUsage: number;
  usageLimit: number;
  remainingCredits: number;
  billingPeriod: { start: Date; end: Date };
  canExtract: boolean;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
}
```

### UI Components Built with Billing in Mind
```typescript
// 1. Extraction Button Component
<ExtractButton 
  onExtract={handleExtract}
  disabled={!canExtract}
  tooltip={!canExtract ? 'Upgrade for more extractions' : null}
/>

// 2. Usage Indicator in Header
<UsageIndicator 
  current={450} 
  limit={1000}
  showUpgrade={usage > limit * 0.8}
/>

// 3. Organization Settings - Billing Tab
<BillingTab>
  <CurrentPlan />
  <UsageChart />
  <InvoiceHistory />
  <PaymentMethods />
  <UpgradeOptions />
</BillingTab>

// 4. Super Admin - Billing Overview
<SuperAdminBilling>
  <TotalMRR />
  <CustomerList />
  <UsageAnalytics />
  <FailedPayments />
</SuperAdminBilling>
```

### Billing Middleware Pattern
```javascript
// Create reusable billing middleware
const requireActiveSubscription = async (req, res, next) => {
  const org = await getOrganization(req.user.organisationId);
  
  if (!org.stripe_customer_id) {
    return res.status(402).json({ 
      error: 'No payment method',
      setup_url: '/billing/setup'
    });
  }
  
  const subscription = await stripe.subscriptions.retrieve(
    org.stripe_subscription_id
  );
  
  if (subscription.status !== 'active') {
    return res.status(402).json({ 
      error: 'Subscription inactive',
      billing_url: '/billing'
    });
  }
  
  req.subscription = subscription;
  next();
};

// Apply to all paid features
app.post('/api/scrape/*', requireActiveSubscription);
app.post('/api/export/*', requireActiveSubscription);
app.post('/api/images/bulk/*', requireActiveSubscription);
```

### Extensibility Considerations
1. **Feature Flags** - Enable/disable features based on plan
2. **Usage Quotas** - Different limits per subscription tier
3. **Overage Handling** - Allow overages with additional charges
4. **Grace Periods** - Continue access briefly after payment failure
5. **Webhooks** - Handle Stripe events for real-time updates

## 🚨 CRITICAL REMINDERS

1. **No Default Exports** - Use named exports for all components
2. **Organization Filter** - EVERY query must filter by org_id
3. **Role Hierarchy** - super_admin > admin > user
4. **No Complex Fallbacks** - Simple errors are better
5. **Test RLS** - Always verify data isolation
6. **Billing Ready** - Build UI components with usage tracking in mind
7. **Track Everything** - Log all billable events for future integration

## 📊 PROGRESS SUMMARY

| Component | Status | Location |
|-----------|--------|----------|
| Database Schema | ✅ Complete | Supabase |
| RLS Policies | ✅ Complete | Supabase |
| Auth Types | ✅ Complete | /src/types/auth.ts |
| Auth Context | ✅ Complete | /src/context/AuthContext.tsx |
| Backend Middleware | ✅ Complete | /middleware/auth.js |
| Database Service | ✅ Updated | /src/services/database-service.js |
| Login Page | ❌ Pending | /src/pages/Login.tsx |
| Signup Page | ❌ Pending | /src/pages/Signup.tsx |
| OAuth Handler | ❌ Pending | /src/pages/AuthCallback.tsx |
| Org Management | ❌ Pending | /src/pages/OrganizationSettings.tsx |
| Super Admin | ❌ Pending | /src/pages/SuperAdminDashboard.tsx |

---

**Last Updated**: Current session
**Database**: qgabsyggzlkcstjzugdh (Supabase)
**Ready for**: Frontend implementation