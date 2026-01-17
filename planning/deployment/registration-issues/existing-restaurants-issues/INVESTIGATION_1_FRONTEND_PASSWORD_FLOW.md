# Investigation 1: Frontend Password Flow

## Executive Summary

**FINDING: The frontend logic is CORRECT. The password flows properly from dialog input to API call.**

The issue is NOT in the frontend code. When a user enters a password in the dialog, it is correctly captured and sent to the backend. The default password `{Restaurantname}789!` is only generated as a fallback when the password field is empty.

---

## Password Flow Diagram

```
User enters password in dialog input
    ↓
onChange handler updates state (line 7725)
    ↓
registrationPassword state variable stores value (line 190)
    ↓
handleRegistration() captures value (line 591):
  const currentPassword = registrationPassword;
    ↓
API payload constructed (lines 628-631):
  password: currentPassword || generateDefaultPassword()
    ↓
POST request sent with password (line 639)
```

---

## Key Code Locations

### State Variable Declaration (Line 190)
```javascript
const [registrationPassword, setRegistrationPassword] = useState('');
```

### Dialog Input Field (Lines 7720-7725)
```javascript
<Input
  id="registration-password"
  type={showPassword ? "text" : "password"}
  placeholder="Enter your restaurant's account password"
  value={registrationPassword}
  onChange={(e) => setRegistrationPassword(e.target.value)}
  className="pr-10"
/>
```

### Password Capture in Handler (Line 591)
```javascript
const currentPassword = registrationPassword;
```

### Password Sent to API (Lines 628-631)
```javascript
password: currentPassword || (() => {
  const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
})(),
```

---

## Pre-population Behavior

The password field is pre-populated in multiple scenarios:

| Location | When | Value Set |
|----------|------|-----------|
| Lines 4823-4826 | "Register Account" button clicked | Default format |
| Lines 4864-4868 | "Register Restaurant" button (no account) | Default format |
| Lines 4851-4852 | "Register Restaurant" button (has account) | Existing account's password hint |
| Lines 4932-4935 | Another "Register Account" button | Default format |
| Lines 4963-4967 | Another "Register Restaurant" button | Default format |

---

## Fallback Logic Analysis

The fallback to default password ONLY occurs when `currentPassword` is empty/falsy:

```javascript
password: currentPassword || generateDefaultPassword()
```

This means:
- If user enters password → that password is used
- If user leaves field blank → default `{Restaurantname}789!` is generated
- If password is pre-populated and user doesn't change it → pre-populated value is used

---

## Why Users Might See Default Password

1. **User leaves password field empty** - Expected fallback behavior
2. **User cancels and reopens dialog** - Password field is cleared on close (lines 7640, 7656)
3. **Pre-population happens but user doesn't change it** - Uses whatever was pre-populated
4. **Backend issue** - Frontend sends correct password but backend may override it

---

## Conclusion

**The frontend is functioning correctly.** If the default password is being used despite the user entering a custom password, the issue lies elsewhere:
- Backend validation/processing
- Database storage logic
- Password hint generation on the backend
- How password is passed to the Playwright script

The frontend correctly passes the dialog password value to the API call when provided.
