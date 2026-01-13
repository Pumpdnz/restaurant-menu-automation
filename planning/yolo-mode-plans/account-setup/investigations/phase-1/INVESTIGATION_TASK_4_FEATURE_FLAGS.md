# Investigation Task 4: Feature Flags Analysis

## Overview
Documentation of the feature flag system for handling conditional steps in Yolo Mode.

---

## How Feature Flags Are Checked

### Primary Hook: useAuth()

**Location:** `src/context/AuthContext.tsx`

**Usage Pattern:**
```jsx
// In component
const { isFeatureEnabled } = useAuth();

// Check a feature
if (isFeatureEnabled('registration.onboardingUserManagement')) {
  // Feature is enabled
}
```

**Function Signature:**
```typescript
isFeatureEnabled(path: string): boolean
```

**Dot Notation Support:**
- `'registration'` - Check parent feature
- `'registration.onboardingUserManagement'` - Check nested feature
- `'registration.onboardingSync'` - Check another nested feature

---

### Alternative Hook: useFeatureFlags()

**Location:** `src/hooks/useFeatureFlags.ts`

**Returns:**
```typescript
{
  featureFlags: object,      // Full flags object
  isFeatureEnabled: (path: string) => boolean,
  getFeatureFlag: (path: string) => any,  // Get full flag value
  loading: boolean,
  error: Error | null,
  refetch: () => void
}
```

**Use when you need:**
- Full flag value (not just boolean)
- Rate per item or other config values
- Loading/error states

---

## Feature Flag Structure

Stored in Supabase: `organisations.feature_flags` (JSONB)

```json
{
  "registration": {
    "enabled": true,
    "userAccountRegistration": { "enabled": true },
    "restaurantRegistration": { "enabled": true },
    "menuUploading": { "enabled": true },
    "itemTagUploading": { "enabled": true },
    "optionSetUploading": { "enabled": true },
    "websiteSettings": { "enabled": true },
    "codeInjection": { "enabled": true },
    "stripePayments": { "enabled": true },
    "servicesConfiguration": { "enabled": true },
    "onboardingUserManagement": { "enabled": true },
    "onboardingSync": { "enabled": true },
    "finalisingSetup": { "enabled": true }
  }
}
```

---

## Complete List of Registration Feature Flags

| Flag Path | Purpose | Yolo Mode Impact |
|-----------|---------|------------------|
| `registration` | Master registration feature | Required for all steps |
| `registration.userAccountRegistration` | Create Pumpd accounts | Account creation step |
| `registration.restaurantRegistration` | Register restaurants | Restaurant creation step |
| `registration.menuUploading` | Upload CSV menus | Menu import step |
| `registration.itemTagUploading` | Add item tags | Item tags step |
| `registration.optionSetUploading` | Add option sets | Option sets step |
| `registration.websiteSettings` | Configure website | Website config step |
| `registration.codeInjection` | Generate code injections | Code generation step |
| `registration.stripePayments` | Setup Stripe | Payment config step |
| `registration.servicesConfiguration` | Configure services | Services step |
| `registration.onboardingUserManagement` | Create onboarding users | **Conditional section** |
| `registration.onboardingSync` | Sync onboarding data | **Conditional section** |
| `registration.finalisingSetup` | System settings | Finalize step |

---

## Conditionally Show/Hide Sections in Yolo Mode Dialog

### Pattern from RestaurantDetail.jsx (Lines 7090-7257)

```jsx
const { isFeatureEnabled } = useAuth();

{/* Conditional section rendering */}
{isFeatureEnabled('registration.onboardingUserManagement') && (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>Onboarding User Setup</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>User Name</Label>
          <Input
            value={formData.onboardingUserName}
            onChange={(e) => updateFormData('onboardingUserName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>User Email</Label>
          <Input
            value={formData.onboardingUserEmail}
            onChange={(e) => updateFormData('onboardingUserEmail', e.target.value)}
          />
        </div>

        {/* Nested conditional for sync */}
        {isFeatureEnabled('registration.onboardingSync') && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sync-onboarding"
              checked={formData.syncOnboarding}
              onCheckedChange={(checked) => updateFormData('syncOnboarding', checked)}
            />
            <Label htmlFor="sync-onboarding">
              Sync restaurant data to onboarding record
            </Label>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

---

## Conditionally Skip Steps During Execution

### Pattern for Yolo Mode Orchestration

```javascript
const executeYoloMode = async (formData) => {
  const results = {};

  // Phase 1: Parallel operations
  const phase1Promises = [];

  // Always run registration (if feature enabled - should be)
  if (isFeatureEnabled('registration.userAccountRegistration')) {
    phase1Promises.push(
      executeStep('registerAccount', handleRegistration)
        .then(result => { results.account = result; })
    );
  }

  // Conditionally run onboarding user creation
  if (isFeatureEnabled('registration.onboardingUserManagement') &&
      formData.createOnboardingUser) {
    phase1Promises.push(
      executeStep('createOnboardingUser', () => handleCreateOnboardingUser(
        formData.onboardingUserName,
        formData.onboardingUserEmail,
        formData.onboardingUserPassword
      )).then(result => { results.onboardingUser = result; })
    );
  }

  // Wait for Phase 1
  await Promise.allSettled(phase1Promises);

  // Phase 2: After dependencies met
  const phase2Promises = [];

  // Conditionally sync onboarding
  if (isFeatureEnabled('registration.onboardingSync') &&
      formData.syncOnboarding &&
      results.onboardingUser?.success) {
    phase2Promises.push(
      executeStep('updateOnboardingRecord', handleUpdateOnboardingRecord)
        .then(result => { results.onboardingSync = result; })
    );
  }

  await Promise.allSettled(phase2Promises);

  return results;
};
```

---

## Backend Middleware for Feature Flags

**Location:** `middleware/feature-flags.js`

### Blocking Middleware Pattern
```javascript
const requireRegistrationOnboardingUser = checkFeatureFlag('registration.onboardingUserManagement');
const requireRegistrationOnboardingSync = checkFeatureFlag('registration.onboardingSync');

// Usage in routes
router.post('/create-onboarding-user',
  requireRegistrationOnboardingUser,
  handler
);
```

### What it does:
- Returns 403 if feature disabled
- Attaches `req.featureEnabled` and `req.featureConfig` to request
- Checks organization's feature_flags from database

---

## Yolo Mode Dialog Feature Flag Integration

### Recommended Implementation

```jsx
const YoloModeDialog = ({ restaurant, onClose, onExecute }) => {
  const { isFeatureEnabled } = useAuth();

  // Determine which sections to show
  const showOnboardingSection = isFeatureEnabled('registration.onboardingUserManagement');
  const showOnboardingSyncOption = isFeatureEnabled('registration.onboardingSync');

  // Form state with feature-aware defaults
  const [formData, setFormData] = useState({
    // Account
    email: restaurant.user_email || '',
    password: '',

    // Onboarding (only if feature enabled)
    createOnboardingUser: showOnboardingSection,
    syncOnboarding: showOnboardingSyncOption,
    onboardingUserName: restaurant.contact_name || '',
    onboardingUserEmail: restaurant.contact_email || '',
    onboardingUserPassword: '',

    // ... other fields
  });

  return (
    <Dialog>
      {/* ... dialog content ... */}

      {/* Onboarding Tab - Conditionally rendered */}
      {showOnboardingSection && (
        <TabsContent value="onboarding">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-onboarding-user"
                checked={formData.createOnboardingUser}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, createOnboardingUser: checked }))
                }
              />
              <Label htmlFor="create-onboarding-user">
                Create Onboarding User
              </Label>
            </div>

            {formData.createOnboardingUser && (
              <>
                {/* User fields */}

                {showOnboardingSyncOption && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sync-onboarding"
                      checked={formData.syncOnboarding}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, syncOnboarding: checked }))
                      }
                    />
                    <Label htmlFor="sync-onboarding">
                      Sync restaurant data after user creation
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      )}
    </Dialog>
  );
};
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Check flags in UI** | `const { isFeatureEnabled } = useAuth()` |
| **Conditional sections** | `{isFeatureEnabled('path') && <Section />}` |
| **Skip execution steps** | Check flag before adding to Promise array |
| **Nested conditions** | Check parent flag first, then child |
| **Form defaults** | Set based on feature availability |
| **Backend enforcement** | Middleware returns 403 if disabled |

---

## Key Onboarding Feature Flags for Yolo Mode

1. **`registration.onboardingUserManagement`**
   - Controls: "Create Onboarding User" section visibility
   - Controls: `handleCreateOnboardingUser` execution
   - Default: Check if enabled, show section only if true

2. **`registration.onboardingSync`**
   - Controls: "Sync Onboarding Record" checkbox visibility
   - Controls: `handleUpdateOnboardingRecord` execution
   - Depends on: `onboardingUserManagement` being enabled
   - Default: Check if enabled, only sync if user created successfully
