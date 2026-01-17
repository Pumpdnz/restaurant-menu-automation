# Investigation Plan: Restaurant Registration Password Handling Issues

## Overview
This investigation aims to verify the reported issues with password handling during restaurant registration when:
1. A new restaurant is registered without an existing `pumpd_accounts` record
2. The registration dialog password field is not being used correctly
3. The default password notation `{Restaurantname}789!` is being used instead of user-provided or existing account passwords

## Known Information

### Reported Behavior (From User Testing)
1. **Test 1 (New Email)**: When registering with a new email (no existing `pumpd_accounts` record):
   - A new `pumpd_accounts` record WAS created (correct)
   - The password from the dialog was NOT used (incorrect)
   - Default password `{Restaurantname}789!` was used instead

2. **Test 2 (Existing Email)**: When registering with an existing email:
   - The `pumpd_restaurants` record WAS correctly associated with existing `pumpd_accounts` (correct)
   - The password from the existing `pumpd_accounts` record was NOT used (incorrect)
   - Default password `{Restaurantname}789!` was used instead

### Key Files Identified
| File | Purpose |
|------|---------|
| `/UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Frontend registration dialog (lines 568-663, 7633-7777) |
| `/UberEats-Image-Extractor/src/routes/registration-routes.js` | Backend API endpoints for registration |
| `/scripts/restaurant-registration/login-and-register-restaurant.js` | Playwright script for actual registration |

### Key Functions
- `generateDefaultPassword()` (RestaurantDetail.jsx:1167-1172) - Generates `{Restaurantname}789!`
- `handleRegistration()` (RestaurantDetail.jsx:568-660) - Main registration handler
- `POST /register-restaurant` (registration-routes.js:331-652) - Backend registration endpoint

### Database Tables
- `pumpd_accounts` - Stores account credentials including `user_password_hint`
- `pumpd_restaurants` - Stores restaurant records with FK to `pumpd_accounts.id`

### Registration Type Options
1. `new_account_with_restaurant` - New Account with Restaurant
2. `existing_account_first_restaurant` - Login to Existing Account - First Restaurant
3. `existing_account_additional_restaurant` - Login to Existing Account - Additional Restaurant

---

## Instructions for Next Claude Session

Read this entire document, then execute the investigation by launching 4 parallel subagents using the Task tool. Each subagent should:
1. ONLY investigate - do NOT modify any code
2. Create their investigation deliverable document in this folder
3. Report their findings

After all subagents complete, read all 4 investigation documents and compile a summary report for the user.

### Execution Command
```
Use the Task tool to launch 4 subagents in parallel with subagent_type="Explore":
- Subagent 1: Frontend password flow investigation
- Subagent 2: Backend password handling investigation
- Subagent 3: Registration type logic investigation
- Subagent 4: Email lookup and account association investigation
```

---

## subagent_1_instructions

### Title: Frontend Password Flow Investigation

### Context
The registration dialog allows users to enter a custom password, but testing shows the default password `{Restaurantname}789!` is being used instead. We need to trace how the password value flows from the dialog input field to the API call.

### Instructions
1. Read `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
2. Focus on lines 568-663 (handleRegistration function) and lines 7633-7777 (dialog component)
3. Trace the flow of the password value:
   - Where is the password input field defined?
   - What state variable stores the dialog password?
   - How is `registrationPassword` state populated and used?
   - In `handleRegistration()`, trace exactly how `currentPassword` is determined
   - What conditions cause `generateDefaultPassword()` to be called vs using the dialog value?
4. Check lines 607-630 specifically - document the password fallback logic
5. Identify if there's a bug where dialog password is being ignored

### Deliverable
Create `/Users/giannimunro/Desktop/cursor-projects/automation/planning/deployment/registration-issues/INVESTIGATION_1_FRONTEND_PASSWORD_FLOW.md` containing:
- Complete flow diagram of password from dialog input to API call
- Exact line numbers where password value is determined
- Any identified issues or bugs in the logic
- Code snippets showing the problematic areas

### Report
Summarize findings about whether the frontend correctly passes the dialog password to the backend

---

## subagent_2_instructions

### Title: Backend Password Handling Investigation

### Context
Even if the frontend sends the correct password, the backend may be overriding it with the default format. We need to verify how the backend handles the incoming password value and what gets stored/used.

### Instructions
1. Read `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/routes/registration-routes.js`
2. Focus on the `/register-restaurant` endpoint (lines 331-652)
3. Trace the password handling:
   - How is `password` extracted from `req.body`?
   - What fallback logic exists if password is not provided?
   - What password value is stored in `pumpd_accounts.user_password_hint`?
   - What password value is passed to the Playwright script execution (line ~603)?
4. Check if there's any password regeneration or override logic
5. Verify what password reaches the `execAsync()` command on line 610-613

### Deliverable
Create `/Users/giannimunro/Desktop/cursor-projects/automation/planning/deployment/registration-issues/INVESTIGATION_2_BACKEND_PASSWORD_HANDLING.md` containing:
- Flow diagram of password through the backend
- Exact line numbers where password is extracted, stored, and passed to script
- Any identified issues where password gets overridden
- The exact command string construction showing password parameter

### Report
Summarize findings about whether the backend correctly uses the incoming password or overrides it

---

## subagent_3_instructions

### Title: Registration Type Logic Investigation

### Context
The three registration types (`new_account_with_restaurant`, `existing_account_first_restaurant`, `existing_account_additional_restaurant`) may have different password handling logic. We need to understand the differences and verify the third option's behavior.

### Instructions
1. Read `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` and `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/routes/registration-routes.js`
2. For each registration type, document:
   - What frontend logic is specific to that type?
   - What backend logic is specific to that type?
   - How is account creation vs association handled?
3. Focus specifically on `existing_account_additional_restaurant`:
   - What should happen when this option is selected?
   - What actually happens in the code?
   - Is there logic to lookup existing account by email?
   - Is there logic to use the password from an existing account?
4. Compare the expected behavior vs actual implementation

### Deliverable
Create `/Users/giannimunro/Desktop/cursor-projects/automation/planning/deployment/registration-issues/INVESTIGATION_3_REGISTRATION_TYPE_LOGIC.md` containing:
- Table comparing the three registration types
- Specific logic flows for "Login to Existing Account - Additional Restaurant"
- Gaps between expected and actual behavior
- Code snippets showing the registration type handling

### Report
Summarize whether the registration type logic correctly handles all three scenarios

---

## subagent_4_instructions

### Title: Email Lookup and Account Association Investigation

### Context
When registering a restaurant with an email that matches an existing `pumpd_accounts` record, the system should:
1. Find the existing account by email
2. Use the password from that account's `user_password_hint`
3. Associate the new restaurant with that account

We need to verify this lookup and association logic exists and works correctly.

### Instructions
1. Read `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/routes/registration-routes.js`
2. Search for email lookup logic:
   - Is there a query to find `pumpd_accounts` by email?
   - If found, is `user_password_hint` retrieved and used?
   - If not found, is a new account created with the dialog password?
3. Check the account association logic:
   - How is `pumpd_restaurants.pumpd_account_id` set?
   - When does this association happen?
4. Query the database to understand the current schema and constraints:
   - Unique constraint on `(organisation_id, email)` vs `(organisation_id, restaurant_id, email)`
   - This affects whether email lookup can find accounts from other restaurants

### Deliverable
Create `/Users/giannimunro/Desktop/cursor-projects/automation/planning/deployment/registration-issues/INVESTIGATION_4_EMAIL_LOOKUP_ASSOCIATION.md` containing:
- Current email lookup implementation (or lack thereof)
- Account association flow diagram
- Database constraints that affect the lookup
- Identified gaps in the lookup logic
- SQL queries to demonstrate the constraint behavior

### Report
Summarize whether email lookup properly finds existing accounts and uses their passwords

---

## Expected Outcomes

After completing all 4 investigations, we should be able to:

1. **Confirm or refute** the user's reported behavior
2. **Identify the root cause(s)** of the password handling issues
3. **Document the exact code locations** that need to be fixed
4. **Understand the full flow** from dialog → frontend → backend → script execution

This will inform the implementation plan for:
1. Adding a Super Admin tab for managing `pumpd_accounts` and `pumpd_restaurants`
2. Fixing the password handling logic to respect dialog input and existing account passwords
