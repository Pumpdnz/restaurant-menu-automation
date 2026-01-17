# Solution Implemented: Registration Password Handling Fix

**Date**: 2025-12-12
**Status**: COMPLETED

## Problem

When registering a new restaurant with an email that matches an existing `pumpd_accounts` record:
1. First attempt FAILED - used wrong password (default format from dialog)
2. Retry SUCCEEDED - frontend now had access to existing account's password

## Root Cause

In `registration-routes.js`, the password was set from the request BEFORE the email lookup. When an existing account was found, its stored `user_password_hint` was never used.

## Fix Applied

**File**: `UberEats-Image-Extractor/src/routes/registration-routes.js`

### Change 1: Line 374
```javascript
// Before:
const password = requestPassword || restaurant.user_password_hint;

// After:
let password = requestPassword; // Will be updated if existing account found
```

### Change 2: Lines 422-427
```javascript
} else {
  account = existingAccount;
  // Use the existing account's password instead of dialog/default
  if (existingAccount.user_password_hint) {
    password = existingAccount.user_password_hint;
    console.log('[Registration] Using existing account password for:', email);
  }
}
```

## Result

| Scenario | Before | After |
|----------|--------|-------|
| New email (no existing account) | Uses dialog password | Uses dialog password (unchanged) |
| Email matches existing account | Uses dialog password (WRONG) | Uses existing account's password (CORRECT) |
