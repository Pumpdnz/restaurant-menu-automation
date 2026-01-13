# Investigation Plan: Registration Yolo Mode

## Overview

The goal is to implement a "Yolo Mode" for restaurant registration that allows users to:
1. Review and edit all settings in a single confirmation dialog
2. Execute the complete setup automatically with proper dependency handling
3. Run non-dependent scripts in parallel for efficiency

This is a complex feature that orchestrates multiple existing registration/configuration scripts into a single automated workflow.

## Known Information

### Requirements (from initial-planning.md)

**Confirmation Dialog Fields:**
- Account Details: Email, Phone, Password, Register New User checkbox
- Restaurant Registration: Mode, Name, Hours, Phone, Address, Subdomain
- Menu Upload: Menu selection, Upload images checkbox, Option sets checkbox, Item tags checkbox
- Website Configuration: Theme, Colors, Header settings, Logo settings, Item layout
- Payment/Services: Stripe link checkbox
- Pump'd Onboarding: Feature-flagged steps (onboardingUserManagement, onboardingSync)

**Execution Phases:**
- Phase 1 (Parallel): Account Registration, Image Uploading, Code Injection Generation, Onboarding User Creation
- Phase 2 (After Phase 1 dependencies): Website Settings, Menu Importing, Payment Settings, Services Settings, Onboarding Record Update
- Phase 3 (After Menu Import): Option Sets Configuration
- Phase 4 (After Phase 3): Item Tags Configuration

### Existing Scripts Discovered

| Script | Path |
|--------|------|
| Account/Restaurant Registration | `scripts/restaurant-registration/login-and-register-restaurant.js` |
| Menu CSV Import | `scripts/restaurant-registration/import-csv-menu.js` |
| Option Sets | `scripts/restaurant-registration/add-option-sets.js` |
| Item Tags | `scripts/restaurant-registration/add-item-tags.js` |
| Website Settings (Dark) | `scripts/edit-website-settings-dark.js` |
| Website Settings (Light) | `scripts/edit-website-settings-light.js` |
| Stripe Payments | `scripts/setup-stripe-payments.js` |
| Stripe Payments (No Link) | `scripts/setup-stripe-payments-no-link.js` |
| Services Settings | `scripts/setup-services-settings.js` |

### Existing Handlers in RestaurantDetail.jsx

| Handler | Line | Purpose |
|---------|------|---------|
| `handleRegistration` | 691 | Account/Restaurant registration |
| `handleGenerateCodeInjections` | 1017 | Generate website code injections |
| `handleConfigureWebsite` | 1132 | Configure website settings |
| `handleConfigureServices` | 1280 | Configure services settings |
| `handleCreateOnboardingUser` | 1327 | Create onboarding user |
| `handleUpdateOnboardingRecord` | 1369 | Update onboarding record |
| `handleSetupSystemSettings` | 1414 | Setup system settings |
| `handleConfigureUberIntegration` | 1503 | Configure Uber integration |
| `handleCsvUpload` | 813 | Upload CSV menu |
| `handleUploadImagesToCDN` | 2936 | Upload images to CDN |
| `handleAddItemTags` | 887 | Add item tags |
| `handleAddOptionSets` | ~960 | Add option sets |

### Feature Flags for Onboarding
- `onboardingUserManagement`: Controls "Register New Onboarding User" step
- `onboardingSync`: Controls "Update onboarding record" step

---

## Instructions

Execute this investigation by spawning **5 parallel subagents** using the Task tool. Each subagent should investigate specific aspects of the implementation and create their investigation document in this folder.

**Important**:
- Each subagent should ONLY investigate and gather information, NOT modify code
- Each subagent should create their investigation document in `/Users/giannimunro/Desktop/cursor-projects/automation/planning/yolo-mode-plans/account-setup/`
- After all subagents complete, read all investigation files and report consolidated findings to the user

---

## subagent_1_instructions

### Context
Investigate the current Registration Dialog UI and all existing confirmation dialogs to understand the patterns for building the Yolo Mode confirmation dialog.

### Instructions
1. Read RestaurantDetail.jsx around lines 8800-9000 to find the current registration dialog
2. Search for other Dialog patterns in RestaurantDetail.jsx (look for `DialogContent`, `DialogHeader`, etc.)
3. Find examples of editable forms within dialogs
4. Look for RadioGroup and Checkbox patterns used in dialogs
5. Identify the largest/most complex dialog in the codebase as a reference
6. Document the shadcn Dialog component patterns used

### Deliverable
Create `INVESTIGATION_TASK_1_DIALOG_UI_PATTERNS.md` documenting:
- Current registration dialog structure
- Largest dialog pattern found (as reference for Yolo Mode dialog)
- Form patterns within dialogs (editable fields, save buttons)
- Component imports needed
- Recommended structure for Yolo Mode confirmation dialog with sections

### Report
Summarize UI patterns available for building the confirmation dialog.

---

## subagent_2_instructions

### Context
Investigate all existing handler functions that will be orchestrated in Yolo Mode to understand their parameters, dependencies, and return values.

### Instructions
1. Read the following handlers in RestaurantDetail.jsx:
   - `handleRegistration` (lines 691-800)
   - `handleGenerateCodeInjections` (lines 1017-1130)
   - `handleConfigureWebsite` (lines 1132-1280)
   - `handleConfigureServices` (lines 1280-1325)
   - `handleCreateOnboardingUser` (lines 1327-1368)
   - `handleUpdateOnboardingRecord` (lines 1369-1413)
   - `handleSetupSystemSettings` (lines 1414-1500)
   - `handleCsvUpload` (lines 813-884)
   - `handleUploadImagesToCDN` (lines 2936-3020)
2. Document each handler's:
   - Required parameters/state
   - API endpoints called
   - Return values/success indicators
   - Toast notifications shown
   - State updates made

### Deliverable
Create `INVESTIGATION_TASK_2_HANDLER_FUNCTIONS.md` documenting:
- Each handler's signature and requirements
- Data dependencies between handlers
- Which handlers can run in parallel vs must be sequential
- Common patterns that can be reused

### Report
Summarize handler orchestration requirements and dependencies.

---

## subagent_3_instructions

### Context
Investigate the backend API endpoints that support the registration workflow to understand what already exists and what might need modification.

### Instructions
1. Read `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/routes/registration-routes.js` to find all registration endpoints
2. Search server.js for any additional registration-related endpoints
3. Document the request/response format for each endpoint
4. Look for any batch or orchestration endpoints that might already exist
5. Check for rate limiting or concurrency considerations

### Deliverable
Create `INVESTIGATION_TASK_3_BACKEND_ENDPOINTS.md` documenting:
- All registration-related API endpoints
- Request/response formats
- Authentication requirements
- Potential for creating a new orchestrated endpoint vs frontend orchestration
- Rate limiting considerations

### Report
Summarize backend capabilities and gaps for Yolo Mode.

---

## subagent_4_instructions

### Context
Investigate the feature flag system and onboarding-related functionality to understand how conditional steps should be handled.

### Instructions
1. Read `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/hooks/useFeatureFlags.ts`
2. Search for `isFeatureEnabled` usage in RestaurantDetail.jsx
3. Find where onboarding feature flags are checked
4. Look for the `onboardingUserManagement` and `onboardingSync` feature flag definitions
5. Understand how organization-level feature flags work

### Deliverable
Create `INVESTIGATION_TASK_4_FEATURE_FLAGS.md` documenting:
- How feature flags are checked (`isFeatureEnabled` pattern)
- Full list of registration-related feature flags
- How to conditionally show/hide sections in Yolo Mode dialog
- How to conditionally skip steps during execution

### Report
Summarize feature flag integration requirements.

---

## subagent_5_instructions

### Context
Investigate the state management for all registration-related data to understand what state needs to be collected in the Yolo Mode dialog and how to initialize it.

### Instructions
1. Search RestaurantDetail.jsx for all `useState` declarations related to registration (lines 257-360)
2. Find how `restaurant` object is loaded and what fields it contains
3. Look for how opening_hours, colors, logos, etc. are stored
4. Find the `registrationStatus` state and how it's used
5. Document all state that feeds into the various registration handlers

### Deliverable
Create `INVESTIGATION_TASK_5_STATE_MANAGEMENT.md` documenting:
- All registration-related state variables
- Initial values and how they're populated
- Restaurant object structure (relevant fields)
- State that needs to be collected in Yolo Mode form
- Recommended form state structure for Yolo Mode dialog

### Report
Summarize state management approach for the Yolo Mode dialog.

---

## Success Criteria

After investigation, we should have enough information to:
1. Design the Yolo Mode confirmation dialog with all required sections
2. Know exactly which handlers to call and in what order
3. Understand which operations can run in parallel
4. Know how to handle feature-flagged steps
5. Have a clear state management approach for the dialog form
6. Be ready to write a detailed implementation plan
