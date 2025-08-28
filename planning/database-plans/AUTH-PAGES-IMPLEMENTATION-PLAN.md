# Authentication Pages Implementation Plan
## For UberEats Image Extractor Application

### Overview
Comprehensive authentication system with Google OAuth 2.0, email authentication, and password management.

---

## Role Hierarchy & Permissions

### Three-Tier Role System

```
┌─────────────────────────────────────────────┐
│              SUPER ADMIN                    │
│  • Manage all organizations                 │
│  • Access all data across system            │
│  • Manage Stripe billing for all orgs       │
│  • Impersonate users (support)              │
│  • System-wide settings                     │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│              ORG ADMIN                      │
│  • Manage organization settings             │
│  • Invite/remove members                    │
│  • Manage all restaurants in org            │
│  • View billing & usage                     │
│  • Access all org data                      │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│              ORG USER                       │
│  • View organization data                   │
│  • Extract menus                            │
│  • Manage assigned restaurants              │
│  • Cannot invite members                    │
│  • Cannot access billing                    │
└─────────────────────────────────────────────┘
```

## Authentication Flow Architecture

```
┌──────────────────────────────────────────────┐
│                  User Entry                  │
└───────────────┬──────────────────────────────┘
                │
         ┌──────┴──────┬─────────────┐
         │             │             │
    ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
    │ Login   │  │ Signup  │  │ Invite  │
    │         │  │         │  │ Link    │
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │             │
         └────────┬───┴─────────────┘
                  │
        ┌─────────▼──────────┐
        │   Authenticate     │
        │ • Email/Pass       │
        │ • Google OAuth     │
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │  Check Profile     │
        │ • Super Admin?     │
        │ • Has Invite?      │
        │ • Join Existing?   │
        │ • Create New Org?  │
        └────────────────────┘
```

## Organization & Invitation System

### Database Schema Updates for Super Admin

```sql
-- Update profiles table to include super_admin role
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'user'));

-- Organization invitations table
CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_invites_token ON organisation_invites(token);
CREATE INDEX idx_invites_email ON organisation_invites(email);
CREATE INDEX idx_invites_org ON organisation_invites(organisation_id);

-- Updated RLS Policies for Super Admin Access
-- Super admins bypass all RLS
CREATE POLICY "super_admin_all_access" ON organisations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "super_admin_all_profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Regular admin policy for invites
CREATE POLICY "org_admins_manage_invites" ON organisation_invites
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Super admin policy for all data tables
CREATE POLICY "super_admin_all_restaurants" ON restaurants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Repeat for all data tables (extraction_jobs, menus, menu_items, etc.)
```

### Invitation Flow

```
Admin Creates Invite → Email Sent → User Clicks Link → 
→ Check if User Exists → 
  → Yes: Add to Organization
  → No: Signup with Pre-filled Org
```

---

## Page Components Structure

### 1. Login Page (`/login`)

**Features:**
- Email/password login form
- Google OAuth button
- "Remember me" checkbox
- Forgot password link
- Sign up link
- Error message display
- Loading states

**Component Structure:**
```typescript
interface LoginPageProps {
  redirectTo?: string; // Where to go after login
}

// Form fields
- email: string (required, email validation)
- password: string (required, min 8 chars)
- rememberMe: boolean (optional)
```

**UI Layout:**
```
┌─────────────────────────────────────┐
│         [App Logo]                  │
│                                     │
│    Welcome Back                    │
│    Sign in to your account         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Email                       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Password                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  □ Remember me   Forgot password?  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      Sign In                │   │
│  └─────────────────────────────┘   │
│                                     │
│  ────────── OR ──────────          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🔍 Continue with Google    │   │
│  └─────────────────────────────┘   │
│                                     │
│  Don't have an account? Sign up    │
└─────────────────────────────────────┘
```

---

### 2. Signup Page (`/signup`)

**Features:**
- Registration form with validation
- Google OAuth option
- Organization name field OR invitation code
- Terms acceptance checkbox
- Login link for existing users
- Real-time validation feedback
- Auto-fill from invitation

**Component Structure:**
```typescript
interface SignupPageProps {
  inviteToken?: string; // From URL params
}

interface InviteData {
  organisationId: string;
  organisationName: string;
  email: string;
  role: 'admin' | 'user';
}

// Form fields
- email: string (required, pre-filled if invited)
- password: string (required, strength meter)
- confirmPassword: string (required, match check)
- fullName: string (required)
- organizationName: string (required if no invite)
- inviteCode: string (optional, replaces org name)
- acceptTerms: boolean (required)
```

**UI Layout:**
```
┌─────────────────────────────────────┐
│         [App Logo]                  │
│                                     │
│    Create Account                   │
│    Start extracting menus today    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Full Name                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Email                       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Organization Name          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Password                    │   │
│  └─────────────────────────────┘   │
│  Password strength: ████░░░░       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Confirm Password            │   │
│  └─────────────────────────────┘   │
│                                     │
│  □ I agree to Terms & Privacy      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Create Account          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ────────── OR ──────────          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🔍 Sign up with Google     │   │
│  └─────────────────────────────┘   │
│                                     │
│  Already have account? Sign in     │
└─────────────────────────────────────┘
```

---

### 3. Forgot Password Page (`/forgot-password`)

**Features:**
- Email input for reset link
- Success/error messaging
- Rate limiting (1 request per minute)
- Back to login link

**Component Structure:**
```typescript
interface ForgotPasswordState {
  emailSent: boolean;
  cooldown: number; // seconds until next request
}
```

**UI Layout:**
```
┌─────────────────────────────────────┐
│         [App Logo]                  │
│                                     │
│    Reset Password                   │
│    We'll email you a reset link    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Email                       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    Send Reset Link         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ← Back to login                   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ✓ Email sent! Check inbox   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

### 4. Reset Password Page (`/reset-password`)

**Features:**
- New password form
- Password strength indicator
- Token validation
- Auto-login after reset
- Expiry handling (24 hours)

**Component Structure:**
```typescript
interface ResetPasswordProps {
  token: string; // From URL params
}

// Form fields
- newPassword: string (required, min 8 chars)
- confirmPassword: string (required, must match)
```

---

### 5. OAuth Callback Handler (`/auth/callback`)

**Features:**
- Handle OAuth redirects
- Create profile if needed
- Check for pending invitations
- Organization assignment
- Error handling
- Loading state

**Flow:**
```typescript
1. Receive OAuth callback
2. Extract user data from Supabase
3. Check if profile exists
4. Check for pending invitations by email
5. If has invitation:
   - Join existing organization
   - Apply invited role
   - Mark invitation as accepted
6. If new user without invitation:
   - Create new organization
   - Create admin profile
7. If existing user:
   - Load profile
8. Redirect to dashboard or onboarding
```

---

### 6. Organization Management Page (`/settings/organization`)

**Features:**
- View organization members
- Invite new members
- Remove members (admin only)
- Change member roles (admin only)
- View pending invitations
- Resend or cancel invitations
- **Billing tab (admin only)**
- **Usage statistics**

**UI Layout with Billing Tab:**
```
┌─────────────────────────────────────────┐
│    Organization Settings                │
│                                         │
│ [Members] [Billing] [Settings]         │
│                                         │
│    Members (3)                          │
│    ┌─────────────────────────────────┐ │
│    │ John Doe          john@email    │ │
│    │ Admin            [Change Role]  │ │
│    ├─────────────────────────────────┤ │
│    │ Jane Smith        jane@email    │ │
│    │ User       [Change] [Remove]    │ │
│    └─────────────────────────────────┘ │
│                                         │
│    Pending Invitations (2)             │
│    ┌─────────────────────────────────┐ │
│    │ bob@email.com     Expires 2d    │ │
│    │ User       [Resend] [Cancel]    │ │
│    └─────────────────────────────────┘ │
│                                         │
│    ┌─────────────────────────────────┐ │
│    │    + Invite New Member          │ │
│    └─────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Billing Tab Layout:**
```
┌─────────────────────────────────────────┐
│    Billing & Usage                      │
│                                         │
│    Current Plan: Pro                    │
│    $99/month + usage                    │
│                                         │
│    Usage This Month                     │
│    ┌─────────────────────────────────┐ │
│    │ Extractions: 450/1000            │ │
│    │ ████████████░░░░ 45%            │ │
│    │                                  │ │
│    │ Image Downloads: 1,234           │ │
│    │ CSV Exports: 12                  │ │
│    └─────────────────────────────────┘ │
│                                         │
│    [Upgrade Plan] [Payment Methods]     │
│    [View Invoices] [Download Usage]     │
│                                         │
│    ⚠️ 550 credits remaining this month  │
└─────────────────────────────────────────┘
```

---

### 7. Invite Member Modal

**Features:**
- Email input with validation
- Role selection (admin/user)
- Custom message (optional)
- Send invitation
- Copy invitation link

**Component:**
```typescript
interface InviteMemberForm {
  email: string;
  role: 'admin' | 'user';
  message?: string;
}

// Generate invite
async function inviteMember(data: InviteMemberForm) {
  const token = generateSecureToken();
  const expiresAt = addDays(new Date(), 7);
  
  // Save to database
  await createInvitation({
    ...data,
    token,
    expiresAt,
    organisationId: currentUser.organisationId
  });
  
  // Send email
  await sendInvitationEmail(data.email, token, data.message);
}
```

---

### 8. Accept Invitation Page (`/invite/accept`)

**Features:**
- Validate invitation token
- Show organization details
- Accept/Decline buttons
- Handle existing users
- Handle new users

**Flow for Existing Users:**
```
┌─────────────────────────────────────┐
│    You're Invited!                  │
│                                     │
│    [Org Name] has invited you to   │
│    join as a [Role]                │
│                                     │
│    ┌───────────────────────────┐   │
│    │     Accept Invitation     │   │
│    └───────────────────────────┘   │
│                                     │
│    ┌───────────────────────────┐   │
│    │         Decline           │   │
│    └───────────────────────────┘   │
└─────────────────────────────────────┘
```

**Flow for New Users:**
```
→ Redirect to signup with pre-filled data
→ Organization automatically assigned
→ Skip organization creation step
```

---

### 9. Super Admin Dashboard (`/super-admin`)

**Features:**
- View all organizations
- Manage organization settings
- View/Edit Stripe billing for any org
- Impersonate users for support
- System health monitoring
- Global settings management
- **Usage analytics across all orgs**
- **Failed payment alerts**

**UI Layout:**
```
┌──────────────────────────────────────────────┐
│          Super Admin Dashboard               │
├──────────────────────────────────────────────┤
│  Organizations (42)          [+ Create Org]  │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │ Acme Corp              12 users       │  │
│  │ Plan: Pro ($99/mo)    Usage: 1,234   │  │
│  │ Status: ✅ Active     Credits: 550   │  │
│  │ [View] [Edit] [Billing] [Impersonate] │  │
│  ├──────────────────────────────────────┤  │
│  │ Beta LLC               3 users        │  │
│  │ Plan: Basic ($29/mo)  Usage: 456      │  │
│  │ Status: ⚠️ Past Due   Credits: 44    │  │
│  │ [View] [Edit] [Billing] [Impersonate] │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  System Stats                               │
│  • Total Users: 156                         │
│  • Active Orgs: 42                          │
│  • MRR: $3,450                              │
│  • Extractions Today: 5,678                 │
│  • API Calls (24h): 12,456                  │
│  • Failed Payments: 3 ⚠️                     │
│                                              │
│  [System Settings] [Email Templates]        │
│  [API Keys] [Webhooks] [Logs] [Meters]     │
└──────────────────────────────────────────────┘
```

**Billing Management Modal (Super Admin):**
```
┌──────────────────────────────────────────────┐
│  Billing: Acme Corp                          │
│                                              │
│  Stripe Customer: cus_P1x2y3z4              │
│  Subscription: sub_A5b6c7d8                 │
│                                              │
│  Current Plan: Pro ($99/mo)                 │
│  Next Invoice: $143.50 on Jan 1             │
│                                              │
│  Usage This Period:                         │
│  • Extractions: 1,234 ($44.50)              │
│  • Image Downloads: 5,678                   │
│  • CSV Exports: 23                          │
│                                              │
│  Actions:                                   │
│  [Change Plan] [Apply Credit]               │
│  [Cancel Subscription] [Refund]             │
│  [Send Custom Invoice]                      │
│                                              │
│  Payment History:                           │
│  Dec 1: $143.50 ✅ Paid                      │
│  Nov 1: $132.00 ✅ Paid                      │
│  Oct 1: $156.75 ✅ Paid                      │
└──────────────────────────────────────────────┘
```

**Super Admin Actions:**
```typescript
interface SuperAdminActions {
  // Organization management
  createOrganization(data: OrgData): Promise<Organization>;
  updateOrganization(orgId: string, data: Partial<OrgData>): Promise<void>;
  deleteOrganization(orgId: string): Promise<void>;
  
  // Billing management
  updateSubscription(orgId: string, planId: string): Promise<void>;
  applyCredit(orgId: string, amount: number): Promise<void>;
  generateInvoice(orgId: string): Promise<Invoice>;
  
  // User management
  impersonateUser(userId: string): Promise<void>;
  resetUserPassword(userId: string): Promise<void>;
  changeUserRole(userId: string, role: UserRole): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  
  // System management
  getSystemStats(): Promise<SystemStats>;
  updateSystemSettings(settings: SystemSettings): Promise<void>;
  viewAuditLog(filters: AuditFilters): Promise<AuditLog[]>;
}
```

---

### 10. Organization Switcher (for Super Admins)

**Features:**
- Quick switch between organizations
- Search/filter organizations
- View as specific user
- Return to super admin view

**Component:**
```typescript
interface OrgSwitcherProps {
  currentOrgId?: string;
  onSwitch: (orgId: string | null) => void;
}

// In header when impersonating
<div className="bg-yellow-100 p-2">
  Viewing as: {currentOrg.name}
  <button onClick={() => exitImpersonation()}>
    Exit Impersonation
  </button>
</div>
```

---

## Implementation Details

### Authentication Context Updates

```typescript
// Additional methods for AuthContext
interface AuthContextType {
  // Existing methods...
  
  // New methods
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  
  // Organization invitation methods
  createInvitation: (email: string, role: 'admin' | 'user') => Promise<string>;
  validateInvitation: (token: string) => Promise<InviteData | null>;
  acceptInvitation: (token: string) => Promise<void>;
  declineInvitation: (token: string) => Promise<void>;
  getOrganizationMembers: () => Promise<UserProfile[]>;
  updateMemberRole: (userId: string, role: 'admin' | 'user') => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  getPendingInvitations: () => Promise<Invitation[]>;
  cancelInvitation: (inviteId: string) => Promise<void>;
  resendInvitation: (inviteId: string) => Promise<void>;
}
```

### Invitation Service Functions

```typescript
// services/invitation-service.ts

import { supabase } from '@/lib/supabase';
import { generateToken } from '@/utils/crypto';

export async function createInvitation(
  email: string,
  role: 'admin' | 'user',
  organisationId: string,
  invitedBy: string
) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
  
  const { data, error } = await supabase
    .from('organisation_invites')
    .insert({
      email,
      role,
      organisation_id: organisationId,
      invited_by: invitedBy,
      token,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();
    
  if (error) throw error;
  
  // Send invitation email
  await sendInvitationEmail(email, token);
  
  return token;
}

export async function acceptInvitation(token: string, userId: string) {
  // Get invitation
  const { data: invite, error } = await supabase
    .from('organisation_invites')
    .select('*, organisation:organisations(*)')
    .eq('token', token)
    .single();
    
  if (error || !invite) {
    throw new Error('Invalid invitation');
  }
  
  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invitation expired');
  }
  
  // Update user profile with organization
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      organisation_id: invite.organisation_id,
      role: invite.role
    })
    .eq('id', userId);
    
  if (updateError) throw updateError;
  
  // Mark invitation as accepted
  await supabase
    .from('organisation_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);
    
  return invite.organisation;
}
```

### Google OAuth Setup

**Supabase Dashboard Configuration:**
1. Enable Google provider in Authentication → Providers
2. Add Google Client ID and Secret
3. Set redirect URLs:
   - Development: `http://localhost:5173/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

**Google Cloud Console:**
1. Create OAuth 2.0 credentials
2. Add authorized redirect URIs
3. Configure consent screen
4. Add scopes: email, profile

### Password Requirements

```typescript
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChar: false, // Optional for better UX
};

function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  // Implementation
}
```

### Email Templates (Supabase)

**Reset Password Email:**
```html
Subject: Reset your password

Hi {{ .Email }},

Click the link below to reset your password:
{{ .SiteURL }}/reset-password?token={{ .Token }}

This link expires in 24 hours.

If you didn't request this, please ignore this email.
```

**Welcome Email:**
```html
Subject: Welcome to Menu Extractor!

Hi {{ .Name }},

Your account has been created successfully.
Organization: {{ .Organization }}

Get started by extracting your first menu:
{{ .SiteURL }}/dashboard

Need help? Contact support@yourapp.com
```

---

## Security Considerations

### 1. Rate Limiting
```typescript
// Implement rate limiting for auth endpoints
const rateLimits = {
  login: '5 attempts per 15 minutes',
  signup: '3 attempts per hour',
  passwordReset: '3 attempts per hour',
  oauthCallback: '10 attempts per minute'
};
```

### 2. Session Management
```typescript
// Session configuration
const sessionConfig = {
  duration: '7 days', // Default session
  rememberMe: '30 days', // Extended session
  inactiveTimeout: '30 minutes', // Auto logout
  refreshThreshold: '1 hour' // Token refresh
};
```

### 3. CSRF Protection
```typescript
// Add CSRF token to forms
const csrfToken = crypto.randomBytes(32).toString('hex');
sessionStorage.setItem('csrf', csrfToken);
```

### 4. Input Sanitization
```typescript
// Sanitize all inputs
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};
```

---

## Error Handling

### Common Auth Errors

```typescript
const authErrors = {
  'invalid_credentials': 'Email or password is incorrect',
  'user_not_found': 'No account found with this email',
  'email_taken': 'This email is already registered',
  'weak_password': 'Password is too weak',
  'invalid_token': 'Reset link is invalid or expired',
  'rate_limit': 'Too many attempts. Please try again later',
  'google_auth_failed': 'Google sign in failed. Please try again',
  'network_error': 'Connection error. Please check your internet'
};
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('Authentication', () => {
  test('Login with valid credentials');
  test('Login with invalid credentials');
  test('Google OAuth flow');
  test('Password reset flow');
  test('Signup with email');
  test('Token expiry handling');
  test('Rate limiting');
});
```

### E2E Tests
```typescript
describe('Auth User Journey', () => {
  test('Complete signup flow');
  test('Login and navigate to dashboard');
  test('Reset password and login');
  test('Google OAuth signup and profile creation');
});
```

---

## Billing Integration Strategy

### Phase 1: Build with Billing in Mind (Current)
```typescript
// Every extraction component should have usage awareness
interface ExtractionButtonProps {
  onExtract: () => Promise<void>;
  // Prepare for future billing
  beforeExtract?: () => Promise<boolean>; // Check credits
  afterExtract?: (result: any) => Promise<void>; // Track usage
}

// Header component with usage slot
<AppHeader>
  {user && <UsageIndicator />} {/* Placeholder for now */}
</AppHeader>
```

### Phase 2: Billing Implementation (After Auth)
```javascript
// 1. Add Stripe SDK
npm install stripe @stripe/stripe-js

// 2. Create billing service
class BillingService {
  async trackExtraction(orgId, itemCount) {
    // Record to database
    await supabase.from('usage_events').insert({
      organisation_id: orgId,
      event_type: 'extraction',
      quantity: itemCount
    });
    
    // Send to Stripe Meters API
    await stripe.billing.meterEvents.create({
      event_name: 'extraction_credits',
      payload: {
        value: itemCount,
        stripe_customer_id: org.stripe_customer_id
      }
    });
  }
}

// 3. Wrap all Firecrawl calls
const originalScrape = firecrawlScrape;
firecrawlScrape = async (...args) => {
  const result = await originalScrape(...args);
  await billingService.trackExtraction(
    currentUser.organisationId,
    result.itemCount
  );
  return result;
};
```

### Billing UI Components Roadmap
```typescript
// Components to build AFTER auth is complete:

1. <UsageBar /> - Visual progress bar for credits
2. <BillingAlert /> - Warning when approaching limits
3. <SubscriptionCard /> - Current plan details
4. <UsageHistory /> - Chart of daily/weekly usage
5. <InvoiceList /> - Downloadable invoices
6. <PaymentMethodForm /> - Add/update cards
7. <PlanSelector /> - Upgrade/downgrade UI
8. <UsageExport /> - CSV download for accounting
```

## Implementation Order

1. **Week 1: Core Auth**
   - Day 1-2: Login/Signup pages
   - Day 3: OAuth integration
   - Day 4: Password reset flow
   - Day 5: Organization invites

2. **Week 2: Organization Management**
   - Day 1-2: Org settings page
   - Day 3: Member management
   - Day 4: Super admin dashboard
   - Day 5: Testing & polish

3. **Week 3: Billing Integration**
   - Day 1: Stripe account setup
   - Day 2: Usage tracking backend
   - Day 3: Billing UI components
   - Day 4: Payment flow
   - Day 5: Testing & webhooks

---

## Component Libraries Used

- **shadcn/ui** - For form components
- **react-hook-form** - Form management
- **zod** - Schema validation
- **sonner** - Toast notifications
- **lucide-react** - Icons

---

## Environment Variables

```env
# Frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_APP_URL=http://localhost:5173

# Backend
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_SECRET=
```

---

## Success Metrics

- ✅ User can sign up with email
- ✅ User can sign up with Google
- ✅ User can login with email
- ✅ User can login with Google
- ✅ User can reset password
- ✅ Profile created on first login
- ✅ Organization created for new users
- ✅ Existing users maintain access
- ✅ Sessions persist across refreshes
- ✅ Proper error messages shown