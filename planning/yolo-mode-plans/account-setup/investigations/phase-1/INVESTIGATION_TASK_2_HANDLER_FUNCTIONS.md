# Investigation Task 2: Handler Functions Analysis

## Overview
Comprehensive analysis of all handler functions in RestaurantDetail.jsx that will be orchestrated in Yolo Mode.

---

## Handler Summary Table

| Handler | Line | API Client | Timeout | Dependencies |
|---------|------|------------|---------|--------------|
| handleRegistration | 691 | api/railwayApi | - | None |
| handleCsvUpload | 813 | railwayApi | 2min | Registration complete |
| handleAddItemTags | 895 | railwayApi | 3min | Registration + Menu |
| handleAddOptionSets | 953 | railwayApi | 5min | Registration + Menu |
| handleGenerateCodeInjections | 1017 | railwayApi | 2min | None |
| handleConfigureWebsite | 1132 | railwayApi | 3min | Code injections |
| handleConfigureServices | 1280 | railwayApi | 3min | None |
| handleCreateOnboardingUser | 1327 | railwayApi | 2min | None (feature-flagged) |
| handleUpdateOnboardingRecord | 1369 | api | - | Onboarding user created |
| handleSetupSystemSettings | 1414 | railwayApi | 3min | None |
| handleUploadImagesToCDN | 2936 | api | Polling | Menu exists |

---

## Detailed Handler Analysis

### 1. handleRegistration (Line 691)

**Required State:**
- `registrationType`: 'account_only' | 'ubereats' | 'doordash' | 'ubereats_doordash'
- `registrationEmail`: string
- `registrationPassword`: string
- `restaurant.phone`: string (REQUIRED)
- `restaurant.name`, `address`, `opening_hours`, `city`, `cuisine`

**API Endpoints:**
- Account only: `POST /registration/register-account` (api)
- Restaurant: `POST /api/registration/register-restaurant` (railwayApi)

**State Updates:**
- `setRegistering(true/false)`
- Clears form fields on success
- Calls `fetchRegistrationStatus()` to refresh

**Dependencies:** None (can start immediately)

---

### 2. handleCsvUpload (Line 813)

**Required State:**
- `csvFile`: File object
- `registrationStatus.account.registration_status === 'completed'`
- `registrationStatus.restaurant.registration_status === 'completed'`

**API Endpoint:** `POST /api/registration/upload-csv-menu` (railwayApi)

**State Updates:**
- `setIsUploading(true/false)`
- `setUploadStatus('success'/'error')`
- `setCsvFile(null)` on success

**Dependencies:** Registration must be complete

---

### 3. handleAddItemTags (Line 895)

**Required State:**
- `id`: restaurantId
- Registration completed (both account and restaurant)

**API Endpoint:** `POST /api/registration/add-item-tags` (railwayApi)

**State Updates:**
- `setIsAddingTags(true/false)`
- `setTagsStatus(response.data)`

**Dependencies:** Registration + Menu import complete
**Phase:** Phase 4 (after option sets)

---

### 4. handleAddOptionSets (Line 953)

**Required State:**
- `selectedMenuForOptionSets`: menuId
- Registration completed

**API Endpoint:** `POST /api/registration/add-option-sets` (railwayApi)

**State Updates:**
- `setIsAddingOptionSets(true/false)`
- `setOptionSetsStatus(response.data)`

**Dependencies:** Registration + Menu import complete
**Phase:** Phase 3

---

### 5. handleGenerateCodeInjections (Line 1017)

**Required State:**
- `id`: restaurantId
- `noGradient`: boolean

**API Endpoint:** `POST /api/registration/generate-code-injections` (railwayApi)

**Returns:**
```javascript
{
  filePaths: {
    headInjection: string,
    bodyInjection: string,
    configuration: string
  }
}
```

**State Updates:**
- `setIsGenerating(true/false)`
- `setCodeGenerated(true)` on success
- `setGeneratedFilePaths(response.data.filePaths)`

**Dependencies:** None (can run in parallel)
**Phase:** Phase 1

---

### 6. handleConfigureWebsite (Line 1132)

**Required State:**
- `generatedFilePaths` or `filesValidated`
- `headerEnabled`, `headerBgSource`
- `itemLayout`
- `navTextColorSource`, `boxTextColorSource`
- `navLogoDarkTint`, `navLogoLightTint`
- `headerLogoDarkTint`, `headerLogoLightTint`

**API Endpoint:** `POST /api/registration/configure-website` (railwayApi)

**Payload:**
```javascript
{
  restaurantId,
  filePaths: { headInjection, bodyInjection },
  headerConfig: { enabled, backgroundSource },
  itemsConfig: { layout },
  textColorConfig: { navText, boxText },
  navLogoTintConfig: { darkColor, lightColor },
  headerLogoTintConfig: { darkColor, lightColor }
}
```

**Dependencies:** Code injections generated
**Phase:** Phase 2

---

### 7. handleConfigureServices (Line 1280)

**Required State:**
- `id`: restaurantId

**API Endpoint:** `POST /api/registration/configure-services` (railwayApi)

**State Updates:**
- `setIsConfiguringServices(true/false)`
- `setServicesStatus(response.data)`

**Dependencies:** None
**Phase:** Phase 2 (parallel)

---

### 8. handleCreateOnboardingUser (Line 1327)

**Required State:**
- `onboardingUserName`
- `onboardingUserEmail`
- `onboardingUserPassword` (optional - auto-generated)

**API Endpoint:** `POST /api/registration/create-onboarding-user` (railwayApi)

**State Updates:**
- `setIsCreatingOnboardingUser(true/false)`
- `setOnboardingUserStatus(response.data)`

**Feature Flag:** `onboardingUserManagement`
**Dependencies:** None
**Phase:** Phase 1 (parallel)

---

### 9. handleUpdateOnboardingRecord (Line 1369)

**Required State:**
- `onboardingUserEmail`
- `onboardingUserName`
- `onboardingStripeConnectUrl` (optional)

**API Endpoint:** `POST /registration/update-onboarding-record` (api - different client!)

**State Updates:**
- `setIsUpdatingOnboarding(true/false)`
- `setOnboardingUpdateStatus(response.data)`

**Feature Flag:** `onboardingSync`
**Dependencies:** Onboarding user created
**Phase:** Phase 2

---

### 10. handleSetupSystemSettings (Line 1414)

**Required State:**
- `id`: restaurantId
- `receiptLogoVersion`: string

**API Endpoint:** `POST /api/registration/setup-system-settings` (railwayApi)

**State Updates:**
- `setIsSettingUpSystemSettings(true/false)`
- `setSystemSettingsStatus(response.data)`
- `setSetupCompletionStatus(prev => ({ ...prev, system_settings: true }))`

**Dependencies:** None
**Phase:** Phase 2 (parallel)

---

### 11. handleUploadImagesToCDN (Line 2936)

**Required State:**
- `menuId`: string

**API Endpoints:**
- Initial: `POST /menus/${menuId}/upload-images` (api)
- Polling: `GET /upload-batches/${batchId}` (api)

**Modes:**
- Synchronous (≤10 images): Returns immediately
- Asynchronous (>10 images): Polls every 2 seconds

**Dependencies:** Menu must exist
**Phase:** Phase 1 (parallel with registration)

---

## Execution Phases

### Phase 1: Initial Setup (Parallel)
```
┌─────────────────────────────────────────────┐
│  Can start immediately - no dependencies    │
├─────────────────────────────────────────────┤
│  • handleRegistration (account)             │
│  • handleRegistration (restaurant)          │
│  • handleGenerateCodeInjections             │
│  • handleCreateOnboardingUser (if enabled)  │
│  • handleUploadImagesToCDN (if menu exists) │
└─────────────────────────────────────────────┘
```

### Phase 2: After Registration (Parallel)
```
┌─────────────────────────────────────────────┐
│  Requires: Registration complete            │
├─────────────────────────────────────────────┤
│  • handleCsvUpload                          │
│  • handleConfigureWebsite (needs code gen)  │
│  • handleConfigureServices                  │
│  • handleSetupSystemSettings                │
│  • handleUpdateOnboardingRecord (if enabled)│
└─────────────────────────────────────────────┘
```

### Phase 3: After Menu Upload
```
┌─────────────────────────────────────────────┐
│  Requires: Menu imported                    │
├─────────────────────────────────────────────┤
│  • handleAddOptionSets                      │
│  • handleUploadImagesToCDN (if deferred)    │
└─────────────────────────────────────────────┘
```

### Phase 4: Sequential (After Phase 3)
```
┌─────────────────────────────────────────────┐
│  Requires: Option sets complete             │
├─────────────────────────────────────────────┤
│  • handleAddItemTags                        │
└─────────────────────────────────────────────┘
```

---

## Dependency Graph

```
handleRegistration (account + restaurant)
    │
    ├──► handleCsvUpload ──────────────────┐
    │         │                            │
    │         ├──► handleAddOptionSets     │
    │         │         │                  │
    │         │         └──► handleAddItemTags
    │         │
    │         └──► handleUploadImagesToCDN
    │
    ├──► handleConfigureServices
    │
    ├──► handleSetupSystemSettings
    │
    └──► handleConfigureWebsite
              ▲
              │
handleGenerateCodeInjections

handleCreateOnboardingUser
    │
    └──► handleUpdateOnboardingRecord
```

---

## Common Patterns to Reuse

### 1. Loading State Wrapper
```javascript
const executeHandler = async (handlerFn, setLoading, setStatus) => {
  setLoading(true);
  try {
    const result = await handlerFn();
    setStatus({ success: true, data: result });
    return result;
  } catch (error) {
    setStatus({ success: false, error: error.message });
    throw error;
  } finally {
    setLoading(false);
  }
};
```

### 2. Registration Status Check
```javascript
const isRegistrationComplete = () => {
  return registrationStatus?.account?.registration_status === 'completed' &&
         registrationStatus?.restaurant?.registration_status === 'completed';
};
```

### 3. Feature Flag Check
```javascript
const shouldExecuteStep = (stepName) => {
  const flagMap = {
    'onboardingUser': 'registration.onboardingUserManagement',
    'onboardingSync': 'registration.onboardingSync',
  };
  return isFeatureEnabled(flagMap[stepName]);
};
```

---

## API Client Usage

| Handler | Client | Reason |
|---------|--------|--------|
| handleRegistration (account) | api | Direct API call |
| handleRegistration (restaurant) | railwayApi | Script execution |
| handleUpdateOnboardingRecord | api | Direct API call |
| handleUploadImagesToCDN | api | Direct API call |
| All others | railwayApi | Script execution |

---

## Key Findings

1. **Registration is critical** - Most handlers require registration to complete first
2. **Two API clients** - Must use correct client for each endpoint
3. **Parallel opportunities** - Phase 1 operations can all run simultaneously
4. **Polling complexity** - Image upload uses async polling pattern
5. **Feature flags** - Two handlers are conditionally executed
6. **Timeout considerations** - Scripts have 2-5 minute timeouts
