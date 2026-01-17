# Investigation 3: Registration Type Logic

## Executive Summary

The three registration types have different handling logic, but **Types 2 and 3 are treated almost identically**. The main issues are:
1. No explicit logic to use existing account's password
2. Hardcoded restaurant_count assumptions
3. Email lookup only happens for existing account types (not for new_account_with_restaurant)

---

## Registration Type Comparison Table

| Aspect | new_account_with_restaurant | existing_account_first_restaurant | existing_account_additional_restaurant |
|--------|-----------------------------|------------------------------------|----------------------------------------|
| Account Creation | Via CloudWaitress API | Local record only | Local record only |
| Account Status | 'completed' | 'existing' | 'existing' |
| Registration Method | 'api' | 'playwright' | 'playwright' |
| Initial restaurant_count | 0 | 0 | 1 (hardcoded) |
| Password Validation | Via API call | None (Playwright handles) | None (Playwright handles) |
| Email Lookup | NO | YES | YES |
| Reuse Existing Account | N/A | Yes, if found by email | Yes, if found by email |

---

## Frontend Logic (RestaurantDetail.jsx)

### User Presentation (Lines 7658-7695)
- Radio button options presented when `registrationDialogOpen` is true
- All three options require email and password input
- Same form structure for all types
- Password field shows hint: "Default format: Restaurantname789!"

### Registration Handler (Lines 568-663)
```javascript
const handleRegistration = async () => {
  // Validates registration type, email, and password required for ALL types
  // Closes dialog and clears form immediately

  if (currentRegistrationType === 'account_only') {
    // Special case: account-only (not one of the three main types)
    POST to /registration/register-account
  } else {
    // All three main registration types use this branch
    POST to /api/registration/register-restaurant with:
    - registrationType: currentRegistrationType
    - restaurantId, email, password (from form)
    - restaurant details (from database)
  }
}
```

**KEY OBSERVATION**: No logic difference in the UI for the three registration types. All require user to provide email and password in the form.

---

## Backend Logic (registration-routes.js)

### Type 1: `new_account_with_restaurant`

**Flow:**
1. Lines 385-386: Condition check `if (registrationType !== 'new_account_with_restaurant')`
2. Lines 425-503: CloudWaitress API account creation via `cloudwaitressAPI.registerUser()`
3. Lines 442-463: Create pumpd_accounts record with:
   - `registration_status: 'completed'`
   - `registration_method: 'api'`
   - `restaurant_count: 0` (incremented after restaurant registration)
4. Lines 658-666: After success, update to `registration_status: 'completed'`, `restaurant_count: 1`

### Type 2: `existing_account_first_restaurant`

**Flow:**
1. Lines 385-423: Does NOT create new account via API
2. Lines 388-393: Check if account already exists in database by email
3. Lines 395-420: If account NOT found, create pumpd_accounts record with:
   - `registration_status: 'existing'`
   - `registration_method: 'playwright'`
   - `restaurant_count: 0`
4. Lines 668-674: After success, increment `restaurant_count: (account.restaurant_count || 0) + 1`

### Type 3: `existing_account_additional_restaurant`

**Flow:**
1. Lines 385-423: Does NOT create new account via API (same as Type 2)
2. Lines 388-393: Check if account already exists by email
3. Lines 395-420: If account NOT found, create pumpd_accounts record with:
   - `registration_status: 'existing'`
   - `registration_method: 'playwright'`
   - `restaurant_count: 1` (assumes existing account has 1 restaurant)
4. Lines 668-674: After success, increment `restaurant_count`

---

## Playwright Script Behavior

The script (`login-and-register-restaurant.js`) does NOT differentiate between registration types:

**Unified Approach (Lines 230-246):**
```javascript
// First try: Primary selector (for accounts with no restaurants)
const primaryButton = page.locator('button:has-text("Create New Restaurant")');
if (await primaryButton.count() > 0) {
  await primaryButton.click();
} else {
  // Fallback: For accounts with existing restaurants
  const fallbackButton = page.locator('button:has-text("Add Restaurant")...')
  if (await fallbackButton.count() > 0) {
    await fallbackButton.click();
  }
}
```

**KEY INSIGHT**: The script AUTO-DETECTS whether the account has restaurants by looking for the button type. It doesn't use the registration_type parameter at all.

---

## Critical Findings & Gaps

### GAP 1: No Email Lookup for `new_account_with_restaurant`
- **Expected**: Check if email already exists before creating new account
- **Actual**: Directly creates new account via CloudWaitress API
- **Impact**: Could fail or create duplicate if email already registered

### GAP 2: Password Handling Inconsistency
| Type | Password Handling |
|------|-------------------|
| Type 1 (new_account) | Sent to CloudWaitress API for validation |
| Types 2 & 3 (existing) | Stored in `user_password_hint`, NOT validated until Playwright runs |

**Risk**: If user provides wrong password for Types 2/3, `pumpd_accounts` record is created but script will fail at login.

### GAP 3: `account_only` Registration Type
- Handled at line 603 in RestaurantDetail.jsx
- NOT documented or exposed in the radio button options
- May be a legacy/unused code path

### GAP 4: Restaurant Count Logic Asymmetry
| Type | Initial restaurant_count | Issue |
|------|-------------------------|-------|
| Type 1 | 0 (becomes 1 after registration) | Correct |
| Type 2 | 0 | Correct for first restaurant |
| Type 3 | 1 (hardcoded) | **Wrong** - doesn't reflect actual count |

**Problem**: What if account already has 2+ restaurants? The hardcoded `1` doesn't reflect reality.

### GAP 5: No Validation of Existing Account Credentials
- Types 2 & 3 create `pumpd_accounts` record with `status='existing'` without verifying credentials work
- Validation only happens during Playwright script execution (asynchronous)
- User gets no feedback if credentials are wrong until they check registration logs

---

## Expected vs Actual Behavior

### `existing_account_additional_restaurant` (Type 3)

**Expected Behavior:**
1. User selects "Login to Existing Account - Additional Restaurant"
2. System looks up existing account by email
3. System retrieves and uses the stored `user_password_hint` from that account
4. Restaurant is registered using existing credentials

**Actual Behavior:**
1. User selects the option and enters email/password manually
2. System looks up existing account by email (line 392) ✓
3. If found, uses existing account record ✓
4. BUT password comes from request, NOT from existing account's `user_password_hint`
5. Password comparison logic is missing

---

## Conclusion

The registration type logic has these issues:

1. **Email lookup is missing for Type 1** - Always creates new account without checking
2. **Password from existing account is not used** - Relies on user entering correct password
3. **Restaurant count is hardcoded for Type 3** - Doesn't query actual count
4. **No credential pre-validation** - Errors only appear during async script execution
5. **Types 2 and 3 are nearly identical** - Only differ in `restaurant_count` initialization

The system works for the happy path but is vulnerable to user error and has logical inconsistencies.
