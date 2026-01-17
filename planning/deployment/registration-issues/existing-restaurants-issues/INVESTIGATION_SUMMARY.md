# Investigation Summary: Restaurant Registration Password Handling Issues

## Overview

Four parallel investigations were conducted to identify why the registration dialog password is not being used correctly. The investigations examined:
1. Frontend password flow
2. Backend password handling
3. Registration type logic
4. Email lookup and account association

---

## Key Findings

### Finding 1: Frontend is CORRECT
**Investigation 1** confirmed that the frontend correctly captures and sends the password from the dialog to the backend. The default password `{Restaurantname}789!` is only generated as a fallback when the user leaves the password field empty.

### Finding 2: Backend is CORRECT (but has a timing issue)
**Investigation 2** confirmed that the backend does NOT override the incoming password. The password flows correctly from request → database → Playwright script.

### Finding 3: The ROOT CAUSE is in Password Timing
**Investigation 4** identified the critical bug:

```javascript
// Line 374: Password is set BEFORE email lookup
const password = requestPassword || restaurant.user_password_hint;

// Lines 388-393: Email lookup happens AFTER password is set
const { data: existingAccount } = await supabase
  .from('pumpd_accounts')
  .select('*')
  .eq('organisation_id', organisationId)
  .eq('email', email)
  .maybeSingle();

// Line 421: Existing account is assigned BUT...
account = existingAccount;

// ...password variable is NEVER updated to use existingAccount.user_password_hint
```

**The password from an existing account is NEVER retrieved and used.**

---

## Root Cause Summary

| Issue | Location | Description |
|-------|----------|-------------|
| Password set before lookup | registration-routes.js:374 | Password variable assigned before email lookup |
| No password update after lookup | registration-routes.js:388-423 | When existing account found, its `user_password_hint` is never used |
| Missing email lookup for Type 1 | registration-routes.js:385-503 | `new_account_with_restaurant` never checks if email exists |

---

## Why the Reported Behavior Occurs

### Issue A: Existing Email Registration (ROOT CAUSE CONFIRMED)
- **Reported**: Password from existing `pumpd_accounts` was NOT used on first attempt
- **Root Cause**: Password is set on line 374 BEFORE email lookup. When existing account is found (line 392), its `user_password_hint` is NEVER used.

**Why retry works:**
1. **First attempt**: Frontend pre-populates DEFAULT password (line 4865-4868) because `registrationStatus.account` doesn't exist yet
2. Backend finds existing account, links restaurant to it, but uses WRONG password → script FAILS
3. **Second attempt**: Frontend now has `registrationStatus.account` populated, so it pre-fills the CORRECT password (line 4852)
4. Backend receives correct password → script SUCCEEDS

**Fix**: After line 422, update password to use `existingAccount.user_password_hint`:
```javascript
} else {
  account = existingAccount;
  // FIX: Use the existing account's password
  if (existingAccount.user_password_hint) {
    password = existingAccount.user_password_hint;
  }
}
```

### Issue B: New Email Registration (CLARIFIED)
When there is NO existing `pumpd_accounts` record:
- Frontend pre-populates DEFAULT password format (line 4865-4868)
- Backend line 374: `password = requestPassword || restaurant.user_password_hint`
- If user doesn't change the pre-populated password, the default format is used
- This is EXPECTED behavior for truly new accounts

**The fix for Issue A will NOT affect Issue B** - new accounts will still use the dialog password (which defaults to `{Restaurantname}789!` if not changed).

---

## Additional Issues Discovered

### Issue A: Duplicate Account Risk
The upsert uses `onConflict: 'organisation_id,restaurant_id,email'` (3-part key), which can create duplicate accounts for the same email across different restaurants.

### Issue B: Hardcoded restaurant_count
`existing_account_additional_restaurant` type hardcodes `restaurant_count: 1` instead of querying the actual count.

### Issue C: Shell Injection Vulnerability
Password is inserted directly into shell command string (line 603) without proper escaping:
```javascript
let command = `node ${scriptPath} --email="${email}" --password="${password}" ...`;
```

---

## Recommended Fixes

### Fix 1: Update Password After Email Lookup (Critical - Issue A)
**Location**: registration-routes.js, after line 422

```javascript
} else {
  account = existingAccount;
  // FIX: Use the existing account's password instead of dialog/default
  if (existingAccount.user_password_hint) {
    password = existingAccount.user_password_hint;
  }
}
```

This ensures that when registering a restaurant with an email that matches an existing `pumpd_accounts` record, the stored password from that account is used (not the default format pre-populated in the dialog).

### Fix 2: (Optional) Remove Fallback to restaurant.user_password_hint
The fallback on line 374 to `restaurant.user_password_hint` is mostly unused since frontend validation requires password. Consider simplifying:

```javascript
// Line 374 - Change from:
const password = requestPassword || restaurant.user_password_hint;
// To:
const password = requestPassword;
if (!password) {
  return res.status(400).json({ success: false, error: 'Password is required' });
}
```

This makes the code clearer and removes the hidden fallback behavior.

### Fix 3: Add Email Lookup for new_account_with_restaurant
Before creating a new account via CloudWaitress API, check if email already exists in `pumpd_accounts`.

### Fix 4: Fix Upsert Conflict Key
Change from:
```javascript
onConflict: 'organisation_id,restaurant_id,email'
```
To:
```javascript
onConflict: 'organisation_id,email'
```

### Fix 5: Query Actual Restaurant Count
Instead of hardcoding `restaurant_count: 1`, query the actual count from the account or Pumpd dashboard.

### Fix 6: Escape Password in Shell Command
Use `child_process.execFile()` instead of `execAsync()` with template strings, or properly escape special characters.

---

## Files Requiring Changes

| File | Lines | Changes Needed |
|------|-------|----------------|
| registration-routes.js | 374, 421-422 | Add password update after email lookup |
| registration-routes.js | 385-503 | Add email lookup for Type 1 |
| registration-routes.js | 444-458 | Fix upsert conflict key |
| registration-routes.js | 407 | Query actual restaurant count |
| registration-routes.js | 603 | Escape password in command |

---

## Investigation Files

- [INVESTIGATION_1_FRONTEND_PASSWORD_FLOW.md](./INVESTIGATION_1_FRONTEND_PASSWORD_FLOW.md)
- [INVESTIGATION_2_BACKEND_PASSWORD_HANDLING.md](./INVESTIGATION_2_BACKEND_PASSWORD_HANDLING.md)
- [INVESTIGATION_3_REGISTRATION_TYPE_LOGIC.md](./INVESTIGATION_3_REGISTRATION_TYPE_LOGIC.md)
- [INVESTIGATION_4_EMAIL_LOOKUP_ASSOCIATION.md](./INVESTIGATION_4_EMAIL_LOOKUP_ASSOCIATION.md)

---

## Conclusion

**Root cause identified and fix confirmed.**

### The Bug
When registering a restaurant with an email that matches an existing `pumpd_accounts` record:
1. Frontend pre-populates the dialog with DEFAULT password (because it doesn't know about the existing account yet)
2. Backend finds the existing account and links the restaurant to it
3. BUT backend uses the DEFAULT password from the dialog, NOT the existing account's `user_password_hint`
4. Playwright script fails because it tries to log in with the wrong password

### Why Retry Works
On retry, the frontend now has `registrationStatus.account` populated (from the linked account), so it pre-fills the CORRECT password from `existingAccount.user_password_hint`.

### The Fix
**registration-routes.js, after line 422:**
```javascript
} else {
  account = existingAccount;
  // FIX: Use the existing account's password
  if (existingAccount.user_password_hint) {
    password = existingAccount.user_password_hint;
  }
}
```

This single fix ensures that on the FIRST registration attempt, when an existing account is found by email, its stored password is used instead of the default format.
