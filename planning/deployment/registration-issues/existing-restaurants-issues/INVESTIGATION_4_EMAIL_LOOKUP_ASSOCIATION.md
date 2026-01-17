# Investigation 4: Email Lookup and Account Association

## Executive Summary

**FINDING: The email lookup and account association logic has significant gaps.**

The system has TWO different email lookup patterns, and they behave differently. The critical issues are:
1. `/register-account` endpoint has NO email lookup
2. Password from existing accounts is NOT explicitly used
3. Upsert logic can create DUPLICATE accounts for the same email

---

## Email Lookup Implementation

### Pattern A: `/register-restaurant` endpoint (Lines 388-393)
**For existing account types:**
```javascript
const { data: existingAccount } = await supabase
  .from('pumpd_accounts')
  .select('*')
  .eq('organisation_id', organisationId)
  .eq('email', email)                        // EMAIL LOOKUP!
  .maybeSingle();
```
✓ This DOES lookup by email across the organisation.

### Pattern B: `/register-account` endpoint (Lines 146-151)
```javascript
const { data: existingAccount } = await supabase
  .from('pumpd_accounts')
  .select('*')
  .eq('organisation_id', organisationId)
  .eq('restaurant_id', restaurantId)        // NO EMAIL LOOKUP!
  .single();
```
✗ This only checks the specific organisation/restaurant combination - does NOT lookup by email.

---

## Account Association Flow

```
Registration Request Received
    ↓
Extract email from request or restaurant (line 373)
    ↓
For Types 2 & 3: Email Lookup (line 392)
    ↓
┌─────────────────────────────────────────────────────┐
│ IF existingAccount found:                           │
│   account = existingAccount (line 421-422)          │
│ ELSE:                                               │
│   Create new pumpd_accounts record (lines 397-420)  │
└─────────────────────────────────────────────────────┘
    ↓
Register restaurant with account.id (line 512):
  pumpd_account_id: account.id
    ↓
Update pumpd_restaurants.pumpd_account_id
```

---

## Database Constraints

**From migration file:**
```sql
UNIQUE(org_id, email),                          -- Line 33
UNIQUE(org_id, restaurant_id, email)            -- Line 34
```

### Constraint Impact Analysis

| Constraint | Purpose | Impact |
|------------|---------|--------|
| `UNIQUE(org_id, email)` | One account per email per org | Supports cross-restaurant email lookup |
| `UNIQUE(org_id, restaurant_id, email)` | One record per restaurant/email combo | Redundant with first constraint |

---

## Critical Gaps Identified

### GAP 1: `/register-account` has NO email lookup
**Location**: Lines 145-151
**Issue**: Only checks `(organisation_id, restaurant_id)` - not the email
**Expected**: Should lookup by `(organisation_id, email)` first
**Impact**: New restaurant with existing email gets a new account instead of reusing existing

### GAP 2: No explicit "use existing account password" logic
**Location**: Lines 388-423

When `existingAccount` is found:
- Line 392: Lookup retrieves account ✓
- Line 421-422: Sets `account = existingAccount` ✓
- **BUT**: No explicit code to use `existingAccount.user_password_hint`

The password comes from line 374:
```javascript
const password = requestPassword || restaurant.user_password_hint;
```

This is **BEFORE** the email lookup, so it doesn't leverage the found account's password!

### GAP 3: Upsert with wrong conflict key
**Location**: Lines 442-460

```javascript
.upsert({
  organisation_id: organisationId,
  restaurant_id: restaurantId,  // DIFFERENT for each restaurant!
  email: email,
  ...
}, {
  onConflict: 'organisation_id,restaurant_id,email'  // 3-part key!
})
```

**Problem**: This creates a NEW record if `(org, restaurant, email)` combination doesn't exist, even though same email exists with different restaurant!

---

## Duplicate Account Scenario

**Scenario 1**: Restaurant A registers with email "chef@example.com"
- Creates: `pumpd_accounts(org1, rest_a, chef@example.com)`

**Scenario 2**: Restaurant B registers with same email "chef@example.com"
- Upsert checks `(org1, rest_b, chef@example.com)` - NOT FOUND
- Creates: `pumpd_accounts(org1, rest_b, chef@example.com)` - **NEW RECORD!**

**Result**: Two accounts for the same email!

The `UNIQUE(org_id, email)` constraint would prevent this, BUT the upsert uses the 3-part key which bypasses this check.

---

## Flow Analysis by Registration Type

### Type 1: `new_account_with_restaurant`
1. **Email Lookup**: MISSING
2. **Flow**:
   - Get restaurant (line 358)
   - Extract email (line 373)
   - **NO lookup for existing account by email**
   - Create/upsert account via API (line 438)
   - Register restaurant

### Type 2: `existing_account_first_restaurant`
1. **Email Lookup**: YES (line 392)
2. **Flow**:
   - Lookup account by `(org_id, email)`
   - If found, use it; if not, create new
   - **Password NOT retrieved from existing account**

### Type 3: `existing_account_additional_restaurant`
1. **Email Lookup**: YES (line 392)
2. **Flow**: Same as Type 2
3. **Password NOT retrieved from existing account**

---

## SQL Queries to Demonstrate Issues

### Query 1: Find existing account by email
```sql
SELECT * FROM pumpd_accounts
WHERE organisation_id = $1 AND email = $2
LIMIT 1;
```

### Query 2: Find duplicate accounts (same email)
```sql
SELECT COUNT(*), email FROM pumpd_accounts
WHERE organisation_id = 'org-uuid'
GROUP BY email
HAVING COUNT(*) > 1;
```

### Query 3: Show proper constraint behavior
```sql
-- This will FAIL if org_id+email already exists
INSERT INTO pumpd_accounts
  (organisation_id, restaurant_id, email, user_password_hint)
VALUES
  ('org-uuid', 'rest-b-uuid', 'chef@example.com', 'password');
```

---

## Validation Summary

| Aspect | Current Implementation | Issue |
|--------|----------------------|-------|
| Email lookup in `/register-account` | Missing | No search by email |
| Email lookup in `/register-restaurant` (existing types) | Present | Works correctly |
| Using existing account's password | Implicit | No explicit code to use `user_password_hint` |
| Account association | Present | Works for existing types |
| Database constraints | `UNIQUE(org_id, email)` | Allows proper lookup |
| Upsert strategy | `onConflict: 'organisation_id,restaurant_id,email'` | **Can create duplicates!** |

---

## Root Cause of Reported Issue

**Why the password from existing account is NOT being used:**

1. Password variable is set on line 374: `const password = requestPassword || restaurant.user_password_hint;`
2. Email lookup happens AFTER this (line 388-393)
3. Even when existing account is found, the password variable is NOT updated to use `existingAccount.user_password_hint`
4. The script runs with the password from step 1, not the existing account's password

**Missing Code:**
```javascript
// This should exist but doesn't:
if (existingAccount && existingAccount.user_password_hint) {
  password = existingAccount.user_password_hint;
}
```

---

## Conclusion

The email lookup and account association logic has significant gaps:

1. **Missing Email Lookup in `/register-account`** - Should lookup by email first
2. **Implicit Password Usage** - Should explicitly use `existingAccount.user_password_hint` when found
3. **Duplicate Account Risk** - Upsert uses 3-part key, can create duplicates per restaurant
4. **Gap in `new_account_with_restaurant`** - No email lookup at all
5. **Password set before lookup** - Existing account's password is never retrieved and used

These issues explain the reported behavior where:
- Existing account passwords are not being used
- Default password format is used instead of stored `user_password_hint`
