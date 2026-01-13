# Complete Implementation Plan: Auth Middleware Retry Logic

**Date:** 2026-01-06
**Status:** Ready for Implementation
**Priority:** P1 - Critical
**Estimated Effort:** 2-3 hours

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Tasks](#implementation-tasks)
3. [Task 1: Extend isTransientError()](#task-1-extend-istransienterror)
4. [Task 2: Update auth.js](#task-2-update-authjs)
5. [Task 3: Update superAdmin.js](#task-3-update-superadminjs)
6. [Task 4: Update feature-flags.js](#task-4-update-feature-flagsjs)
7. [Test Plan](#test-plan)
8. [Rollback Plan](#rollback-plan)
9. [Monitoring](#monitoring)

---

## Overview

### Problem

The auth middleware calls `supabase.auth.getUser()` without retry logic. Transient network errors (`ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`, `AuthRetryableFetchError`) cause immediate 401 responses, making users appear logged out.

### Solution

Wrap all Supabase network calls in the existing `executeWithRetry()` function from `database-error-handler.js`, with extensions for auth-specific error types.

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/database-error-handler.js` | Add auth-specific error detection |
| `middleware/auth.js` | Wrap getUser() and profile fetch in retry |
| `middleware/superAdmin.js` | Wrap getUser() and profile fetch in retry |
| `middleware/feature-flags.js` | Wrap organisation fetch in retry |

---

## Implementation Tasks

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 1 | Extend `isTransientError()` | Detects `AuthRetryableFetchError`, `UND_ERR_CONNECT_TIMEOUT` |
| 2 | Update `auth.js` | getUser and profile fetch use retry; returns 503 for transient failures |
| 3 | Update `superAdmin.js` | Both middleware functions use retry |
| 4 | Update `feature-flags.js` | Organisation fetch uses retry |
| 5 | Test with network simulation | Verify retry behavior with throttled connections |

---

## Task 1: Extend isTransientError()

**File:** `UberEats-Image-Extractor/src/services/database-error-handler.js`

### Current Code (Lines 16-41)

```javascript
function isTransientError(error) {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  // Cloudflare 5xx errors (returned as HTML)
  if (errorStr.includes('520:') || errorStr.includes('502:') ||
      errorStr.includes('503:') || errorStr.includes('504:') ||
      errorStr.includes('cloudflare') || errorStr.includes('<!DOCTYPE html>')) {
    return true;
  }

  // Network/connection errors
  if (errorStr.includes('ECONNRESET') || errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED')) {
    return true;
  }

  // HTTP 5xx status codes
  if (error.status >= 500 || error.code >= 500) {
    return true;
  }

  return false;
}
```

### New Code (Replace Lines 16-41)

```javascript
function isTransientError(error) {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  // Auth-specific retryable errors (Supabase marks these as retryable)
  if (error.name === 'AuthRetryableFetchError') {
    return true;
  }

  // Supabase auth error with status 0 (network failure)
  if (error.__isAuthError && error.status === 0) {
    return true;
  }

  // Cloudflare 5xx errors (returned as HTML)
  if (errorStr.includes('520:') || errorStr.includes('502:') ||
      errorStr.includes('503:') || errorStr.includes('504:') ||
      errorStr.includes('cloudflare') || errorStr.includes('<!DOCTYPE html>')) {
    return true;
  }

  // Network/connection errors (including undici HTTP client errors)
  if (errorStr.includes('ECONNRESET') || errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED') ||
      errorStr.includes('UND_ERR_CONNECT_TIMEOUT') ||
      errorStr.includes('ConnectTimeoutError') ||
      errorStr.includes('fetch failed')) {
    return true;
  }

  // HTTP 5xx status codes
  if (error.status >= 500 || error.code >= 500) {
    return true;
  }

  return false;
}
```

### Diff Summary

Added 3 new checks:
1. `error.name === 'AuthRetryableFetchError'` - Supabase SDK error type
2. `error.__isAuthError && error.status === 0` - Network failure during auth
3. `UND_ERR_CONNECT_TIMEOUT`, `ConnectTimeoutError`, `fetch failed` - undici errors

---

## Task 2: Update auth.js

**File:** `UberEats-Image-Extractor/middleware/auth.js`

### Change 1: Add Import (After Line 2)

```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { executeWithRetry, isTransientError } = require('../src/services/database-error-handler');
```

### Change 2: Replace authMiddleware Function (Lines 26-108)

**Current Code:**
```javascript
async function authMiddleware(req, res, next) {
  try {
    // Check for internal service-to-service call first
    const serviceKey = req.headers['x-service-key'];
    const orgIdHeader = req.headers['x-organisation-id'];

    if (serviceKey && serviceKey === INTERNAL_SERVICE_KEY && orgIdHeader) {
      // Internal service call - bypass JWT validation
      console.log('[Auth] Internal service call authenticated for org:', orgIdHeader);
      req.user = {
        id: 'internal-service',
        email: 'service@internal',
        role: 'super_admin',
        organisationId: orgIdHeader,
        organisation: { id: orgIdHeader },
        isServiceCall: true
      };
      req.orgFilter = () => ({ organisation_id: orgIdHeader });
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization header with Bearer token is required'
      });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Token verification failed:', error);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    // Get user profile with organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        organisation:organisations(*)
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch failed:', profileError);
      return res.status(403).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      organisationId: profile.organisation_id,
      organisation: profile.organisation
    };

    // Add helper function to filter by organization
    req.orgFilter = () => ({ organisation_id: req.user.organisationId });

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}
```

**New Code:**
```javascript
async function authMiddleware(req, res, next) {
  try {
    // Check for internal service-to-service call first
    const serviceKey = req.headers['x-service-key'];
    const orgIdHeader = req.headers['x-organisation-id'];

    if (serviceKey && serviceKey === INTERNAL_SERVICE_KEY && orgIdHeader) {
      // Internal service call - bypass JWT validation
      console.log('[Auth] Internal service call authenticated for org:', orgIdHeader);
      req.user = {
        id: 'internal-service',
        email: 'service@internal',
        role: 'super_admin',
        organisationId: orgIdHeader,
        organisation: { id: orgIdHeader },
        isServiceCall: true
      };
      req.orgFilter = () => ({ organisation_id: orgIdHeader });
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization header with Bearer token is required'
      });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase (with retry for transient network errors)
    let user;
    try {
      const authResult = await executeWithRetry(
        () => supabase.auth.getUser(token),
        'JWT verification'
      );
      // executeWithRetry returns data directly, but getUser returns { user } inside data
      user = authResult?.user;
    } catch (authError) {
      // Check if this was a transient error that exhausted retries
      if (isTransientError(authError)) {
        console.error('[Auth] Service temporarily unavailable after retries:', authError.message);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Authentication service is temporarily unavailable. Please try again.',
          retryable: true
        });
      }
      // Non-transient auth error (invalid/expired token)
      console.error('Token verification failed:', authError);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    // Get user profile with organization (with retry for transient errors)
    let profile;
    try {
      profile = await executeWithRetry(
        () => supabase
          .from('profiles')
          .select(`
            *,
            organisation:organisations(*)
          `)
          .eq('id', user.id)
          .single(),
        `Profile fetch for user ${user.id}`
      );
    } catch (profileError) {
      if (isTransientError(profileError)) {
        console.error('[Auth] Service temporarily unavailable during profile fetch:', profileError.message);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Unable to fetch user profile. Please try again.',
          retryable: true
        });
      }
      console.error('Profile fetch failed:', profileError);
      return res.status(403).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    if (!profile) {
      return res.status(403).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      organisationId: profile.organisation_id,
      organisation: profile.organisation
    };

    // Add helper function to filter by organization
    req.orgFilter = () => ({ organisation_id: req.user.organisationId });

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Final catch - check if transient
    if (isTransientError(error)) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'An error occurred during authentication. Please try again.',
        retryable: true
      });
    }
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}
```

### Key Changes Summary

1. **Import added:** `executeWithRetry`, `isTransientError` from database-error-handler
2. **getUser wrapped:** Uses `executeWithRetry()` with proper error handling
3. **Profile fetch wrapped:** Uses `executeWithRetry()` with proper error handling
4. **503 responses:** Returns 503 (Service Unavailable) for transient errors after retries exhausted
5. **`retryable: true` flag:** Tells frontend this is a transient issue

---

## Task 3: Update superAdmin.js

**File:** `UberEats-Image-Extractor/middleware/superAdmin.js`

### Change 1: Add Import (After Line 1)

```javascript
const { createClient } = require('@supabase/supabase-js');
const { executeWithRetry, isTransientError } = require('../src/services/database-error-handler');
```

### Change 2: Replace superAdminMiddleware Function (Lines 13-83)

**New Code:**
```javascript
const superAdminMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No authorization token provided',
        code: 'NO_AUTH_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token and get user (with retry for transient errors)
    let user;
    try {
      const authResult = await executeWithRetry(
        () => supabase.auth.getUser(token),
        'Super admin JWT verification'
      );
      user = authResult?.user;
    } catch (authError) {
      if (isTransientError(authError)) {
        console.error('[SuperAdmin] Service temporarily unavailable:', authError.message);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          retryable: true
        });
      }
      console.error('Auth verification failed:', authError);
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if user is super admin (with retry for transient errors)
    let profile;
    try {
      profile = await executeWithRetry(
        () => supabase
          .from('profiles')
          .select('id, email, name, role, organisation_id')
          .eq('id', user.id)
          .single(),
        `Super admin profile fetch for ${user.id}`
      );
    } catch (profileError) {
      if (isTransientError(profileError)) {
        console.error('[SuperAdmin] Service temporarily unavailable during profile fetch:', profileError.message);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          retryable: true
        });
      }
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({
        error: 'Failed to fetch user profile',
        code: 'PROFILE_FETCH_ERROR'
      });
    }

    if (!profile || profile.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Super admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'super_admin',
        currentRole: profile?.role || 'none'
      });
    }

    // Attach user info to request for use in route handlers
    req.user = {
      id: user.id,
      email: user.email,
      name: profile.name,
      role: profile.role,
      organisationId: profile.organisation_id
    };

    // Attach Supabase client for use in routes
    req.supabase = supabase;

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    if (isTransientError(error)) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        retryable: true
      });
    }
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
```

### Change 3: Replace checkSuperAdmin Function (Lines 89-126)

**New Code:**
```javascript
const checkSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.isSuperAdmin = false;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');

    // Use retry for getUser (silent failure - just set flag to false)
    let user;
    try {
      const authResult = await executeWithRetry(
        () => supabase.auth.getUser(token),
        'Check super admin JWT'
      );
      user = authResult?.user;
    } catch (authError) {
      // For optional check, just set flag to false on any error
      req.isSuperAdmin = false;
      return next();
    }

    if (!user) {
      req.isSuperAdmin = false;
      return next();
    }

    // Use retry for profile fetch (silent failure)
    let profile;
    try {
      profile = await executeWithRetry(
        () => supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single(),
        'Check super admin profile'
      );
    } catch (profileError) {
      req.isSuperAdmin = false;
      return next();
    }

    req.isSuperAdmin = profile?.role === 'super_admin';
    if (req.isSuperAdmin) {
      req.user = {
        id: user.id,
        email: user.email,
        role: profile.role
      };
    }

    next();
  } catch (error) {
    req.isSuperAdmin = false;
    next();
  }
};
```

---

## Task 4: Update feature-flags.js

**File:** `UberEats-Image-Extractor/middleware/feature-flags.js`

### Change 1: Add Import (After Line 18)

```javascript
require('dotenv').config();
const { executeWithRetry, isTransientError } = require('../src/services/database-error-handler');
```

### Change 2: Update checkFeatureFlag Function (Lines 80-152)

Replace the organisation fetch section (Lines 105-122):

**Current Code:**
```javascript
      // If not available, fetch from database
      if (!featureFlags) {
        const { data: org, error } = await supabase
          .from('organisations')
          .select('feature_flags, name')
          .eq('id', organisationId)
          .single();

        if (error || !org) {
          console.error(`[Feature Flags] Failed to fetch org ${organisationId}:`, error);
          return res.status(403).json({
            error: 'Organization not found',
            message: 'Could not verify organization settings'
          });
        }

        featureFlags = org.feature_flags;
        orgName = org.name;
      }
```

**New Code:**
```javascript
      // If not available, fetch from database (with retry for transient errors)
      if (!featureFlags) {
        let org;
        try {
          org = await executeWithRetry(
            () => supabase
              .from('organisations')
              .select('feature_flags, name')
              .eq('id', organisationId)
              .single(),
            `Feature flags fetch for org ${organisationId}`
          );
        } catch (fetchError) {
          if (isTransientError(fetchError)) {
            console.error(`[Feature Flags] Service temporarily unavailable for org ${organisationId}:`, fetchError.message);
            return res.status(503).json({
              error: 'Service temporarily unavailable',
              message: 'Could not verify feature flags. Please try again.',
              retryable: true
            });
          }
          console.error(`[Feature Flags] Failed to fetch org ${organisationId}:`, fetchError);
          return res.status(403).json({
            error: 'Organization not found',
            message: 'Could not verify organization settings'
          });
        }

        if (!org) {
          return res.status(403).json({
            error: 'Organization not found',
            message: 'Could not verify organization settings'
          });
        }

        featureFlags = org.feature_flags;
        orgName = org.name;
      }
```

### Change 3: Update checkFeatureFlagOptional Function (Lines 160-192)

Replace organisation fetch section (Lines 170-178):

**Current Code:**
```javascript
      if (!featureFlags) {
        const { data: org } = await supabase
          .from('organisations')
          .select('feature_flags')
          .eq('id', req.user.organisationId)
          .single();

        featureFlags = org?.feature_flags;
      }
```

**New Code:**
```javascript
      if (!featureFlags) {
        try {
          const org = await executeWithRetry(
            () => supabase
              .from('organisations')
              .select('feature_flags')
              .eq('id', req.user.organisationId)
              .single(),
            'Optional feature flags fetch'
          );
          featureFlags = org?.feature_flags;
        } catch (error) {
          // For optional check, just continue with no flags on error
          featureFlags = null;
        }
      }
```

### Change 4: Update getFeatureFlags Function (Lines 198-234)

Replace organisation fetch section (Lines 209-224):

**Current Code:**
```javascript
    if (!featureFlags) {
      const { data: org, error } = await supabase
        .from('organisations')
        .select('feature_flags')
        .eq('id', req.user.organisationId)
        .single();

      if (error) {
        return res.status(500).json({
          error: 'Failed to fetch feature flags',
          message: error.message
        });
      }

      featureFlags = org?.feature_flags || {};
    }
```

**New Code:**
```javascript
    if (!featureFlags) {
      try {
        const org = await executeWithRetry(
          () => supabase
            .from('organisations')
            .select('feature_flags')
            .eq('id', req.user.organisationId)
            .single(),
          'Get feature flags for user'
        );
        featureFlags = org?.feature_flags || {};
      } catch (error) {
        if (isTransientError(error)) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Could not fetch feature flags. Please try again.',
            retryable: true
          });
        }
        return res.status(500).json({
          error: 'Failed to fetch feature flags',
          message: error.message
        });
      }
    }
```

---

## Test Plan

### Unit Tests

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| `isTransientError` with `AuthRetryableFetchError` | `{ name: 'AuthRetryableFetchError' }` | `true` |
| `isTransientError` with `UND_ERR_CONNECT_TIMEOUT` | `{ message: 'UND_ERR_CONNECT_TIMEOUT' }` | `true` |
| `isTransientError` with invalid token | `{ message: 'Invalid JWT' }` | `false` |
| Retry on ECONNRESET | Mock 2 failures, then success | Returns user on 3rd attempt |

### Integration Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Network timeout on getUser | Throttle network, make auth request | 503 after 3 retries |
| Network recovery | Fail 2x, succeed 3rd | 200 with user |
| Invalid token (no retry) | Send expired JWT | 401 immediately |
| Profile fetch timeout | Mock profile DB timeout | 503 after retries |

### Manual Testing

1. **Network Throttling Test:**
   - Use Chrome DevTools Network tab
   - Set "Slow 3G" or "Offline"
   - Make authenticated API request
   - Verify 503 response with `retryable: true`

2. **Recovery Test:**
   - Disable network
   - Make request (should fail with retries)
   - Re-enable network
   - Make request (should succeed)

---

## Rollback Plan

### If Issues Occur

1. **Immediate Rollback:**
   ```bash
   git revert HEAD  # Reverts the auth retry commit
   ```

2. **Partial Rollback (keep error handler changes):**
   - Revert only middleware files
   - Keep `isTransientError` extensions for future use

### Rollback Indicators

- Increased 503 error rate beyond expected
- Retry loops not terminating
- Memory/performance issues from retry delays

---

## Monitoring

### Log Messages to Watch

```
[Auth] Service temporarily unavailable after retries:
[SuperAdmin] Service temporarily unavailable:
[Feature Flags] Service temporarily unavailable:
[JWT verification] Transient error, retrying in
[Profile fetch] Transient error, retrying in
```

### Metrics to Track

| Metric | Baseline | Alert Threshold |
|--------|----------|-----------------|
| 401 error rate | Current rate | > 5% increase |
| 503 error rate | ~0% | > 1% |
| Auth retry count | 0 | > 100/hour |
| Avg auth latency | Current | > 3x increase |

### Dashboard Queries

```sql
-- Retry attempts in last hour
SELECT COUNT(*)
FROM logs
WHERE message LIKE '%Transient error, retrying%'
AND timestamp > NOW() - INTERVAL '1 hour';

-- 503 responses in last hour
SELECT COUNT(*)
FROM logs
WHERE status_code = 503
AND timestamp > NOW() - INTERVAL '1 hour';
```

---

## Checklist

- [ ] Create feature branch: `feat/auth-middleware-retry`
- [ ] Update `database-error-handler.js` with auth error detection
- [ ] Update `auth.js` with retry logic
- [ ] Update `superAdmin.js` with retry logic
- [ ] Update `feature-flags.js` with retry logic
- [ ] Run existing tests
- [ ] Manual test with network throttling
- [ ] Deploy to staging
- [ ] Monitor for 24 hours
- [ ] Deploy to production

---

**Plan Created:** 2026-01-06
**Ready for Implementation:** Yes
