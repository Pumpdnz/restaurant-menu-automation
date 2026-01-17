# Email Casing Issues Investigation Report

**Date:** 2025-12-20
**Status:** FIXES IMPLEMENTED

---

## Fixes Applied

### 1. Client-Side Email Normalization ✅
**File:** `UberEats-Image-Extractor/src/services/onboarding-service.js`

Added email normalization in `getOnboardingIdByEmail()`:
```javascript
const normalizedEmail = email?.trim().toLowerCase();
```

### 2. Database RPC Function Update (Pending Manual Execution)
**File:** `planning/deployment/registration-issues/email-casing-issues/RPC_FUNCTION_UPDATE.sql`

SQL script created to update the `get_onboarding_id_by_email` function to use `LOWER()` comparison.
**Action Required:** Run this SQL on the onboarding database (lqcgatpunhuiwcyqesap)

---

## Executive Summary

The email matching system across the Pumpd platform is **case-sensitive**, causing failures when:
1. Leads provide emails with casing (e.g., `Leomaninder25@gmail.com`)
2. CloudWaitress accounts are registered with that casing
3. Onboarding records are created with different casing (e.g., `leomaninder25@gmail.com`)
4. Later operations try to find the onboarding record using a different case

**Root Cause:** No email normalization (`.toLowerCase()`) is applied anywhere in the email flow from input to database lookup.

---

## Critical Findings

### 1. Email Lookup is Case-Sensitive

**Location:** `onboarding-service.js` (lines 74-77)
```javascript
const { data, error } = await onboardingSupabase
  .rpc('get_onboarding_id_by_email', {
    user_email: email  // Email passed AS-IS - no normalization
  });
```

**Impact:** `John@Example.com` ≠ `john@example.com` - treated as different users.

### 2. No Case Normalization Anywhere

| Location | Code | Issue |
|----------|------|-------|
| Request body parsing | `const { userEmail } = req.body` | No `.toLowerCase()` |
| Onboarding service | `user_email: email` | Passed as-is |
| Database queries | `.eq('email', email)` | Case-sensitive equality |
| Script parameters | `--email="${userEmail}"` | Exact value used |
| CloudWaitress API | `email: email` | Used in HMAC signature |

### 3. Multiple Email Sources Create Confusion

The system pulls emails from different sources depending on context:

| Context | Email Source | Field Name |
|---------|--------------|------------|
| Create onboarding user | Request body | `userEmail` |
| Update onboarding record | Request body | `userEmail` |
| System settings | `pumpd_accounts` table | `finalAccount.email` |
| API key creation | `pumpd_accounts` table | `finalAccount.email` |
| Uber integration | `pumpd_accounts` table | `finalAccount.email` |

**Risk:** If `pumpd_accounts.email` was stored with casing but `user_onboarding` was created without, lookups fail.

### 4. Database Schema is Case-Sensitive

**From migrations:**
```sql
email VARCHAR(255) NOT NULL,
UNIQUE(org_id, email),
UNIQUE(org_id, restaurant_id, email)
```

PostgreSQL's default VARCHAR collation is **case-sensitive**.

### 5. CloudWaitress Login Requires Exact Casing

**The login script sends email exactly as stored:**
```javascript
await page.fill('input[type="email"]', TEST_DATA.login.email);
```

If CloudWaitress was registered with `John@Example.com`, you must login with that exact casing.

---

## Data Flow Diagram

```
Lead Entry (with casing)           CloudWaitress Registration
         │                                    │
         ▼                                    ▼
┌─────────────────┐               ┌───────────────────────┐
│ restaurants     │               │ pumpd_accounts        │
│ email: "John@.."│◄──────────────│ email: "John@.." (*)  │
└─────────────────┘               └───────────────────────┘
         │                                    │
         │ Create onboarding                  │ System settings/
         │ (userEmail param)                  │ API key lookup
         ▼                                    ▼
┌─────────────────┐               ┌───────────────────────┐
│ user_onboarding │◄──────────────│ getOnboardingIdByEmail│
│ email: "john@.."│  MISMATCH!    │ (finalAccount.email)  │
│ (lowercase?)    │               │ "John@.." ≠ "john@.." │
└─────────────────┘               └───────────────────────┘

(*) CloudWaitress accounts MUST keep original casing for login scripts to work
```

---

## Affected Endpoints

| Endpoint | Email Source | Lookup Method | Affected |
|----------|--------------|---------------|----------|
| `/create-onboarding-user` | `userEmail` param | Script execution | ✅ |
| `/update-onboarding-record` | `userEmail` param | `getOnboardingIdByEmail()` | ✅ |
| `/setup-system-settings` | `finalAccount.email` | `getOnboardingIdByEmail()` | ✅ |
| `/create-api-key` | `finalAccount.email` | `getOnboardingIdByEmail()` | ✅ |
| `/configure-uber-integration` | `finalAccount.email` | `getOnboardingIdByEmail()` | ✅ |
| `/register-account` | Request `email` | Upsert with exact email | ✅ |

---

## Which Email is Used for Onboarding Creation?

**Answer:** The `userEmail` parameter from the request body.

**Location:** `/create-onboarding-user` endpoint (line 3137)
```javascript
const { userName, userEmail, userPassword, restaurantId } = req.body;
// ...
const command = [
  'node', scriptPath,
  `--email="${userEmail}"`,  // Passed to create-onboarding-user.js
].join(' ');
```

The `userEmail` comes from the frontend, which typically gets it from:
1. `restaurants.email` (the restaurant's email)
2. `restaurants.user_email` (the user managing the restaurant)
3. `pumpd_accounts.email` (the CloudWaitress account email)

If these have different casings, the system breaks.

---

## Scenarios That Cause Failures

### Scenario 1: Lead with Cased Email
1. Lead created with email `Leomaninder25@gmail.com`
2. CloudWaitress account registered with `Leomaninder25@gmail.com` (casing preserved for login)
3. Onboarding user created - email may be passed as `leomaninder25@gmail.com` (lowercase)
4. Later: `/update-onboarding-record` uses `Leomaninder25@gmail.com` (from pumpd_accounts)
5. **FAIL:** RPC function doesn't find `leomaninder25@gmail.com` record

### Scenario 2: Manual Entry vs System Entry
1. Admin manually enters email as `john@example.com` in restaurant record
2. Customer signs up as `John@Example.com` via CloudWaitress
3. System tries to link accounts
4. **FAIL:** Case mismatch prevents record association

### Scenario 3: Copy-Paste Email
1. User copies email from somewhere with capital letters
2. System stores it with capitals in pumpd_accounts
3. Frontend passes lowercase to `/create-onboarding-user`
4. **FAIL:** Onboarding record created with different case than account

---

## Recommended Solutions

### Option A: Normalize at Service Layer (Recommended)

Modify `getOnboardingIdByEmail()` to normalize email:

```javascript
async function getOnboardingIdByEmail(email) {
  // Normalize email before lookup
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) return null;

  const { data, error } = await onboardingSupabase
    .rpc('get_onboarding_id_by_email', {
      user_email: normalizedEmail
    });
  // ...
}
```

**Also update the RPC function** to use `LOWER()`:
```sql
CREATE OR REPLACE FUNCTION get_onboarding_id_by_email(user_email TEXT)
RETURNS TABLE (onboarding_id UUID, ...)
AS $$
  SELECT id, ... FROM user_onboarding
  WHERE LOWER(email) = LOWER(user_email);
$$ LANGUAGE SQL;
```

### Option B: Normalize at Entry Points

Add normalization in registration-routes.js:

```javascript
// At the start of each endpoint
const normalizedEmail = userEmail?.trim().toLowerCase();
```

### Option C: Normalize on Storage (Breaking Change)

Always store emails in lowercase across all tables.

**Warning:** This would break CloudWaitress logins if the login form is case-sensitive.

### Recommended Approach: Hybrid

1. **Keep pumpd_accounts.email as-is** (preserve casing for CloudWaitress login)
2. **Add normalized email column** `email_normalized` (always lowercase)
3. **Use normalized email for lookups** in onboarding system
4. **Use original email for login scripts**

---

## Implementation Priority

1. **HIGH:** Fix `getOnboardingIdByEmail()` to normalize input
2. **HIGH:** Update RPC function `get_onboarding_id_by_email` to use `LOWER()`
3. **MEDIUM:** Add email normalization in `/update-onboarding-record` endpoint
4. **MEDIUM:** Add email normalization in `/create-onboarding-user` endpoint
5. **LOW:** Consider adding `email_normalized` column to tables

---

## Files to Modify

| File | Changes Needed |
|------|----------------|
| `onboarding-service.js` | Add `email.toLowerCase()` before RPC call |
| `registration-routes.js` | Normalize `userEmail` param at endpoint entry |
| Database RPC function | Use `LOWER()` in WHERE clause |
| (Optional) Database schema | Add `email_normalized` column with trigger |

---

## Testing Checklist

After implementing fixes:

- [ ] Create onboarding user with cased email
- [ ] Update onboarding record with different case
- [ ] Retrieve onboarding data via system settings with different case
- [ ] Verify CloudWaitress login still works with original casing
- [ ] Test API key creation with case mismatch
- [ ] Test Uber integration lookup with case mismatch
