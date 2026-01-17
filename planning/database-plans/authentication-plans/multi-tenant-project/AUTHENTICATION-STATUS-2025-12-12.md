# Multi-Tenant Authentication System - Current Status

**Date:** December 12, 2025
**Status:** Production Ready
**Deployment:** Netlify (Frontend) + Railway (Playwright Execution)

---

## Overview

The multi-tenant authentication system has been fully implemented and deployed. This document captures the current state of the authentication flow, recent fixes, and configuration details.

---

## Deployment Configuration

### Supabase Auth Settings

| Setting | Value |
|---------|-------|
| **Project ID** | `qgabsyggzlkcstjzugdh` |
| **Site URL** | `https://pumpd-menu-builder.netlify.app` |
| **Email Confirmation** | Disabled |
| **Redirect URLs** | `https://pumpd-menu-builder.netlify.app/login`, `https://pumpd-menu-builder.netlify.app/reset-password` |

### Key Decision: Email Confirmation Disabled

Email confirmation on signup has been disabled because:
1. The invitation system already validates user email addresses (they must receive the invite to access the signup link)
2. Simplifies the user onboarding flow
3. Password reset emails continue to work independently

---

## Authentication Flows

### 1. User Invitation Flow (Primary)

**Sequence:**
1. Admin invites user via Team Settings page
2. Invitation email sent with unique token link
3. User clicks link → Signup page with pre-filled email and organization details
4. User completes signup form (name, password)
5. `supabase.auth.signUp()` called with `invitation_token` in user metadata
6. Database trigger `handle_new_user()` creates profile with correct org and role
7. User automatically logged in (session returned immediately)
8. Redirect to `/auth/callback` to finalize setup
9. Toast: "Account created successfully! Welcome to {organization_name}!"
10. Redirect to dashboard

**Key Files:**
- `src/pages/Signup.tsx` - Signup form with invitation handling
- `src/pages/AuthCallback.tsx` - Post-auth processing
- `src/services/invitation-service.ts` - Invitation management
- `supabase/functions/send-invitation/index.ts` - Email sending

### 2. Direct Signup Flow (New Organizations)

**Sequence:**
1. User visits `/signup` directly (no invitation)
2. User enters name, email, organization name, password
3. `supabase.auth.signUp()` called
4. Database trigger creates profile with `role='user'`, `organisation_id=NULL`
5. `AuthCallback` creates new organization and updates profile
6. User redirected to dashboard

### 3. Password Reset Flow

**Sequence:**
1. User clicks "Forgot Password" on login page
2. `supabase.auth.resetPasswordForEmail()` called
3. Supabase sends reset email with link to `https://pumpd-menu-builder.netlify.app/reset-password`
4. User sets new password
5. Redirect to login

---

## Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',  -- 'user', 'admin', 'super_admin'
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Organisation Invites Table

```sql
CREATE TABLE organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' or 'admin'
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Trigger: handle_new_user()

This trigger fires on `INSERT` to `auth.users` and creates the initial profile:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    invite_token TEXT;
    invite_record RECORD;
    user_role TEXT := 'user';
    user_org_id UUID := NULL;
BEGIN
    -- Check if user has an invitation token in metadata
    invite_token := new.raw_user_meta_data->>'invitation_token';

    IF invite_token IS NOT NULL THEN
        -- Look up the invitation
        SELECT organisation_id, role INTO invite_record
        FROM public.organisation_invites
        WHERE token = invite_token
          AND accepted_at IS NULL
          AND expires_at > NOW();

        IF FOUND THEN
            user_role := invite_record.role;
            user_org_id := invite_record.organisation_id;
        END IF;
    END IF;

    INSERT INTO public.profiles (id, email, name, role, organisation_id)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email),
        user_role,
        user_org_id
    );
    RETURN new;
END;
$function$;
```

---

## Recent Fixes (December 12, 2025)

### Issue 1: Email Confirmation URL Showing localhost:3000

**Problem:** Supabase confirmation emails contained `http://localhost:3000` instead of production URL.

**Root Cause:** Supabase Auth project settings had Site URL set to localhost from development.

**Solution:** Updated Supabase dashboard:
- Site URL → `https://pumpd-menu-builder.netlify.app`
- Added redirect URLs for `/login` and `/reset-password`
- Disabled email confirmation (invitation flow validates emails)

### Issue 2: Toast Message Showing "Check Your Email"

**Problem:** After signup, toast said "Please check your email to verify your account" even though email confirmation was disabled.

**Root Cause:** Hardcoded toast message in `Signup.tsx` assumed email confirmation flow.

**Solution:** Updated `Signup.tsx` to check for session:
```typescript
if (authData.session) {
  // User is logged in, show welcome message
  toast({
    title: 'Account created successfully!',
    description: inviteData
      ? `Welcome to ${inviteData.organisationName}!`
      : `Welcome to ${data.organizationName}!`
  });
  navigate(`/auth/callback${inviteToken ? `?invite=${inviteToken}` : ''}`);
} else {
  // Fallback for email confirmation required
  toast({ title: 'Account created!', description: 'Please check your email...' });
  navigate('/login');
}
```

### Issue 3: Profile Created with Wrong Organization and Role

**Problem:** Invited users were getting `role='user'` and `organisation_id=NULL` instead of their invited role and organization.

**Root Cause:** Database trigger `handle_new_user()` was hardcoded:
```sql
-- OLD (broken)
INSERT INTO public.profiles (...)
VALUES (new.id, new.email, ..., 'user', NULL);
```

**Solution:** Updated trigger to read `invitation_token` from user metadata and lookup invitation details (see trigger code above).

---

## File Structure

```
src/
├── context/
│   └── AuthContext.tsx          # Auth state management, login/logout/signup functions
├── pages/
│   ├── Signup.tsx               # Signup form with invitation handling
│   ├── Login.tsx                # Login form
│   ├── AuthCallback.tsx         # Post-auth processing and profile setup
│   └── ResetPassword.tsx        # Password reset form
├── services/
│   └── invitation-service.ts    # Invitation CRUD operations
├── lib/
│   └── supabase.ts              # Supabase client initialization
└── types/
    └── auth.ts                  # TypeScript types for auth

supabase/
└── functions/
    └── send-invitation/
        └── index.ts             # Edge function for sending invitation emails
```

---

## Role Hierarchy

| Role | Permissions |
|------|-------------|
| `super_admin` | Full system access, can manage all organizations |
| `admin` | Can manage organization settings, invite users, manage team |
| `user` | Standard access to organization resources |

---

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://qgabsyggzlkcstjzugdh.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

### Edge Functions
```
RESEND_API_KEY=<for_sending_emails>
```

---

## Testing Checklist

- [x] New user signup via invitation link
- [x] Invited user gets correct organization and role
- [x] Direct signup creates new organization
- [x] Password reset flow works
- [x] Google OAuth signup
- [x] Logout clears session properly
- [x] Role-based access control works
- [x] Feature flags per organization work

---

## Known Limitations

1. **Google OAuth + Invitations:** Google OAuth users signing up via invitation may need the AuthCallback to update their profile with invitation details (the trigger handles email/password signups automatically).

2. **Invitation Expiry:** Invitations expire after the configured period. Expired invitations show an error message.

3. **Single Organization:** Users currently belong to one organization. Multi-org support would require schema changes.

---

## Related Documentation

- [Implementation Guide](Implementation-Guide-MultiTenant-Auth.md)
- [Password Reset and Invitations Plan](PASSWORD-RESET-AND-INVITATIONS-PLAN.md)
- [RLS Fixes Guide](POST-AUTH-RLS-FIXES-GUIDE.md)
- [Simplified Auth Plan](SIMPLIFIED-Auth-Implementation-Plan.md)
