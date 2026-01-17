# Investigation 2: Backend Password Handling

## Executive Summary

**FINDING: The backend correctly uses the incoming password from the frontend WITHOUT overriding it.**

The password flows through the system exactly as sent by the frontend. There is NO password regeneration or override logic in the backend for the `/register-restaurant` endpoint.

---

## Password Flow Diagram

```
FRONTEND (RestaurantDetail.jsx)
    ↓
[User enters password in input field]
    ↓
registrationPassword = user input
    ↓
registrationData.password = registrationPassword || (default format)
    ↓
POST /api/registration/register-restaurant
─────────────────────────────────────────────────────────
BACKEND (registration-routes.js)
    ↓
Line 336: Destructure requestPassword from req.body
    ↓
Line 374: password = requestPassword || restaurant.user_password_hint
    ↓
Lines 403, 448: Store password in pumpd_accounts.user_password_hint
    ↓
Line 603: Insert password into command string:
          `--password="${password}"`
    ↓
Line 610-613: Execute Playwright script with password parameter
```

---

## Critical Code References

### Backend Password Extraction (Line 336)
```javascript
router.post('/register-restaurant', requireRegistrationRestaurant, async (req, res) => {
  const {
    restaurantId,
    registrationType,
    email: requestEmail,
    password: requestPassword,  // <-- PASSWORD EXTRACTED HERE
    restaurantName,
    ...
  } = req.body;
```

### Backend Password Fallback Logic (Line 374)
```javascript
const password = requestPassword || restaurant.user_password_hint;
```

**Priority Order:**
1. `requestPassword` (from frontend input)
2. `restaurant.user_password_hint` (fallback to database)

### Password Validation (Lines 376-380)
```javascript
if (!email || !password) {
  return res.status(400).json({
    success: false,
    error: 'Email and password are required for registration'
  });
}
```

### Password Storage (Multiple Locations)

**Line 403** - For existing account types:
```javascript
user_password_hint: password,
```

**Line 448** - For new account with restaurant:
```javascript
user_password_hint: password,
```

### Password in Script Execution (Line 603)
```javascript
let command = `node ${scriptPath} --email="${email}" --password="${password}" ...`;
```

### Script Execution (Lines 610-613)
```javascript
const { stdout, stderr } = await execAsync(command, {
  env: { ...process.env, DEBUG_MODE: 'false' },
  timeout: 180000 // 3 minute timeout
});
```

---

## Password Handling Analysis

### NO Password Validation/Sanitization
- Password is NOT modified by `.trim()`, `.toLowerCase()`, `.toUpperCase()`, or any other transformation
- The password is passed AS-IS from frontend to database to Playwright script

### NO Password Regeneration
- There is NO logic that regenerates passwords in the backend
- The default password format (`Name789!`) is ONLY generated in the frontend as a fallback
- If frontend sends a password, that exact password is used

### NO Override Logic
- Once extracted on line 374, the password variable is never reassigned
- The password flows directly from `requestPassword` → database storage → command string

---

## Validation Summary

| Aspect | Status | Evidence |
|--------|--------|----------|
| Frontend sends password | ✓ Confirmed | Lines 628-631, 639 in RestaurantDetail.jsx |
| Backend extracts password | ✓ Confirmed | Line 336 destructuring |
| Backend uses incoming password | ✓ Confirmed | Line 374: `password = requestPassword \|\| fallback` |
| Backend modifies password | ✗ NOT Found | No sanitization/transformation code |
| Backend stores correct password | ✓ Confirmed | Lines 403, 448 store `password` variable |
| Backend passes to script | ✓ Confirmed | Line 603 includes `--password="${password}"` |

---

## Potential Issues Identified

### 1. Shell Injection Vulnerability (Line 603)
**Risk Level**: HIGH

```javascript
let command = `node ${scriptPath} --email="${email}" --password="${password}" ...`;
```

**Issue**: If password contains special characters like `$`, backticks, or quotes, they could:
- Break the command string
- Cause shell injection
- Be interpreted as shell commands

**Example Problematic Passwords**:
- `Pass$word` - `$` could be interpreted as variable
- `Pass\`word` - backtick could execute commands
- `Pass"word` - quote could break string

### 2. Missing Input Validation (Lines 376-380)
The backend only checks if password exists, NOT if it's a valid password format:

**Missing Checks**:
- No minimum length validation
- No complexity requirements validation
- No check for special characters that might break commands

---

## Conclusion

**PRIMARY FINDING**: The backend correctly implements password handling. If the frontend sends a password, that exact password is:
1. Extracted from request body (line 336)
2. Used as primary value via fallback logic (line 374)
3. Stored in database (lines 403, 448)
4. Passed to Playwright script (line 603)
5. Executed in subprocess (lines 610-613)

**NO BACKEND OVERRIDE DETECTED**: There is no code that regenerates or modifies the password once it's received from the frontend.

**RECOMMENDATION**: Consider using `child_process.execFile()` instead of `execAsync()` with shell commands, or properly escape special characters in passwords to prevent shell injection vulnerabilities.
