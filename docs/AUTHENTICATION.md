# Authentication System Documentation

## Overview
This document describes the authentication system implementation for the UberEats Image Extractor application, including lessons learned from debugging multi-tab synchronization issues.

## Current Implementation (Working)

### Core Components
1. **AuthContext.tsx** - Main authentication context provider
2. **supabase.ts** - Supabase client configuration
3. **Profiles & Organizations tables** - User data storage in Supabase

### Authentication Flow

#### Initial Load
1. When app loads, `initializeAuth()` checks for existing session once
2. If session exists, profile is loaded from database
3. Loading state is managed to prevent UI flicker

#### Login
1. User credentials validated via `supabase.auth.signInWithPassword()`
2. Profile loaded from database
3. Organization data fetched if user has one
4. User state set in context

#### Logout
1. User state cleared immediately
2. `supabase.auth.signOut()` called
3. Navigation to login page
4. Supabase broadcasts SIGNED_OUT event to all tabs

#### Multi-Tab Behavior
- **Login**: When user logs in on one tab, other tabs detect session on mount/refresh
- **Logout**: When user logs out on any tab, all tabs automatically log out via SIGNED_OUT event
- **Re-login**: After logout, logging in again requires manual refresh of other tabs (acceptable UX)

## Key Lessons Learned

### What to AVOID ❌

#### 1. Manual Multi-Tab Synchronization
**Problem**: Attempting to manually sync auth state across tabs using localStorage signals and flags
```javascript
// DON'T DO THIS
localStorage.setItem('auth_logout_signal', Date.now().toString());
localStorage.removeItem('auth_logout_signal');
```
**Why it fails**: Creates race conditions, complex flag management, and conflicts with Supabase's built-in mechanisms

#### 2. Multiple Concurrent Auth Checks
**Problem**: Having multiple event listeners all trying to load profile simultaneously
```javascript
// DON'T DO THIS
onAuthStateChange: SIGNED_IN → loadProfile()
onAuthStateChange: INITIAL_SESSION → loadProfile()
onFocus → loadProfile()
initializeAuth → loadProfile()
```
**Why it fails**: Causes database queries to hang or timeout due to concurrent operations

#### 3. Complex Flag Management
**Problem**: Using refs and flags to track logout initiators
```javascript
// DON'T DO THIS
const isLogoutInitiatorRef = useRef(false);
```
**Why it fails**: Flags don't reset properly, block subsequent operations, create more bugs than they solve

#### 4. Aggressive Timeouts on Database Queries
**Problem**: Adding short timeouts to Supabase queries
```javascript
// DON'T DO THIS
Promise.race([profilePromise, timeoutPromise])
```
**Why it fails**: Legitimate queries need time to complete, especially on initial load

#### 5. Calling getSession() Inside Profile Load
**Problem**: Checking session while already in an auth operation
```javascript
// DON'T DO THIS - causes hanging
const loadUserProfile = async (user) => {
  const { data: { session } } = await supabase.auth.getSession(); // HANGS HERE
  // ... rest of profile load
}
```
**Why it fails**: Creates deadlock-like situation with concurrent auth operations

### What WORKS ✅

#### 1. Simple, Single-Purpose Auth Checks
- One initialization check on mount
- Let each check complete naturally
- Don't duplicate checks across multiple events

#### 2. Trust Supabase's Built-in Multi-Tab Sync
- Supabase handles session persistence via localStorage
- SIGNED_OUT events broadcast automatically to all tabs
- No manual synchronization needed

#### 3. Proper RLS Policies
**Working configuration**:
```sql
-- Allow authenticated users to view all profiles
CREATE POLICY "profiles_authenticated_view_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Remove conflicting policies that restrict to own profile only
```

#### 4. Minimal Event Handling
```javascript
// GOOD - Only handle what's essential
onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT' && mounted) {
    // Clear state and navigate
  }
  // Don't handle SIGNED_IN, INITIAL_SESSION, etc. - let initializeAuth handle initial load
});
```

#### 5. Clean Separation of Concerns
- **initializeAuth**: Handles initial session check on mount
- **onAuthStateChange**: Only handles logout
- **loadUserProfile**: Simply loads profile, no session checks

## Database Requirements

### RLS Policies
Ensure profiles table has appropriate RLS policies:
```sql
-- Required policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all profiles (needed for org features)
CREATE POLICY "profiles_authenticated_view_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow users to update their own profile
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Required Tables
- **profiles**: User profile data (id, email, name, role, organisation_id)
- **organisations**: Organization data (id, name, created_at, etc.)

## Configuration

### Supabase Client Setup
```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
    // No custom storage or flow type needed
  }
});
```

## Troubleshooting

### Issue: Profile queries hanging
**Cause**: Multiple concurrent auth operations
**Solution**: Simplify auth flow, remove duplicate checks

### Issue: Multi-tab sync not working
**Cause**: Manual synchronization interfering with Supabase
**Solution**: Remove manual sync, trust Supabase's built-in mechanisms

### Issue: "Profile not found" errors
**Cause**: Conflicting RLS policies
**Solution**: Check and fix RLS policies on profiles table

### Issue: Second tab not auto-logging in
**Cause**: Not checking session on initial mount
**Solution**: Ensure initializeAuth runs on component mount

## Testing Multi-Tab Authentication

1. **Login Test**
   - Open app in Tab 1
   - Login with credentials
   - Open Tab 2 - should show logged in state
   
2. **Logout Test**
   - With both tabs open and logged in
   - Logout from either tab
   - Both tabs should navigate to login

3. **Re-login Test**
   - After logout, login in Tab 1
   - Tab 2 requires manual refresh (acceptable behavior)

## Summary

The key to successful multi-tab authentication with Supabase is **simplicity**. Let Supabase handle the complex parts (session management, token refresh, cross-tab events) and keep your code focused on the essential operations (loading profile, clearing state on logout). Avoid the temptation to add manual synchronization - it will create more problems than it solves.