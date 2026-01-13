# YoloConfigBatchView Rewrite Plan

## Overview

This document details the plan to rewrite `YoloConfigBatchView.tsx` to match the functionality of the original `YoloModeDialog.tsx`. The current batch implementation has an incorrect configuration structure that is incompatible with the Yolo Mode execution code.

**Date Created:** 2024-12-21
**Status:** Ready for Implementation
**Approach:** Option A - Reuse Original Tab Components

---

## Problem Statement

### Minor Issues (Password Generation)

#### Issue 1: Incorrect Capitalization
**Current behavior:** Capitalizes all words in restaurant name
**Expected behavior:** Only first letter capitalized, rest lowercase

**Example:**
- Input: "Jax Burger Shack"
- Current output: "JaxBurgerShack789!"
- Expected output: "Jaxburgershack789!"

#### Issue 2: Bracketed Location Names Not Removed
**Current behavior:** Includes bracketed text in password
**Expected behavior:** Remove bracketed sections (often location names from delivery platforms)

**Example:**
- Input: "Jax Burger Shack (Northside Drive)"
- Current output: "JaxBurgerShackNorthsideDrive789!"
- Expected output: "Jaxburgershack789!"

### Major Issue: Complete UI/Config Mismatch

The current `YoloConfigBatchView.tsx` has a completely different configuration structure than what the Yolo Mode execution expects.

---

## Configuration Structure Comparison

### Original YoloModeFormData (from YoloModeDialog.tsx:96-149)

```typescript
export interface YoloModeFormData {
  account: {
    registerNewUser: boolean;
    email: string;
    password: string;
    phone: string;
  };
  restaurant: {
    registrationMode: 'existing_account_first_restaurant' | 'existing_account_additional_restaurant';
    name: string;
    phone: string;
    address: string;
    city: string;
    subdomain: string;
    opening_hours: Record<string, any>;
  };
  menu: {
    selectedMenuId: string;
    uploadImages: boolean;
    addOptionSets: boolean;
    addItemTags: boolean;
  };
  website: {
    theme: 'light' | 'dark';
    cuisines: string[];
    primaryColor: string;
    secondaryColor: string;
    disableGradients: boolean;
    configureHeader: boolean;
    headerImageSource: string;
    headerLogoSource: string;
    headerLogoDarkTint: string;
    headerLogoLightTint: string;
    navLogoSource: string;
    navLogoDarkTint: string;
    navLogoLightTint: string;
    navTextColor: string;
    navTextCustomColor: string;
    cardTextColor: string;
    cardTextCustomColor: string;
    faviconSource: string;
    itemLayout: 'list' | 'card';
  };
  payment: {
    includeStripeLink: boolean;
  };
  onboarding: {
    createOnboardingUser: boolean;
    syncOnboardingRecord: boolean;
    userName: string;
    userEmail: string;
    userPassword: string;
  };
}
```

### Current YoloConfigBatchView Config (WRONG)

```typescript
const DEFAULT_CONFIG = {
  skipSteps: [] as string[],
  password: '',
  enablePayments: true,
  paymentGateway: 'stripe',
  enableDelivery: true,
  enablePickup: true,
  enableDineIn: false,
  gstPercentage: 15,
  menuImportFormat: 'auto',
};
```

### Field-by-Field Comparison

| Section | Original Field | Current Batch | Status |
|---------|---------------|---------------|--------|
| **account** | registerNewUser | ❌ Missing | REQUIRED |
| | email | ❌ Missing | REQUIRED |
| | password | ✅ Has (but wrong format) | FIX |
| | phone | ❌ Missing | REQUIRED |
| **restaurant** | registrationMode | ❌ Missing | REQUIRED |
| | name | ❌ Missing | REQUIRED |
| | phone | ❌ Missing | REQUIRED |
| | address | ❌ Missing | REQUIRED |
| | city | ❌ Missing | REQUIRED |
| | subdomain | ❌ Missing | REQUIRED |
| | opening_hours | ❌ Missing | REQUIRED |
| **menu** | selectedMenuId | ❌ Missing | REQUIRED |
| | uploadImages | ❌ Missing | REQUIRED |
| | addOptionSets | ❌ Missing | REQUIRED |
| | addItemTags | ❌ Missing | REQUIRED |
| **website** | theme | ❌ Missing | REQUIRED |
| | cuisines | ❌ Missing | REQUIRED |
| | primaryColor | ❌ Missing | REQUIRED |
| | secondaryColor | ❌ Missing | REQUIRED |
| | disableGradients | ❌ Missing | REQUIRED |
| | configureHeader | ❌ Missing | REQUIRED |
| | headerImageSource | ❌ Missing | REQUIRED |
| | headerLogoSource | ❌ Missing | REQUIRED |
| | headerLogoDarkTint | ❌ Missing | REQUIRED |
| | headerLogoLightTint | ❌ Missing | REQUIRED |
| | navLogoSource | ❌ Missing | REQUIRED |
| | navLogoDarkTint | ❌ Missing | REQUIRED |
| | navLogoLightTint | ❌ Missing | REQUIRED |
| | navTextColor | ❌ Missing | REQUIRED |
| | navTextCustomColor | ❌ Missing | REQUIRED |
| | cardTextColor | ❌ Missing | REQUIRED |
| | cardTextCustomColor | ❌ Missing | REQUIRED |
| | faviconSource | ❌ Missing | REQUIRED |
| | itemLayout | ❌ Missing | REQUIRED |
| **payment** | includeStripeLink | ❌ Has wrong fields | FIX |
| **onboarding** | createOnboardingUser | ❌ Missing | REQUIRED |
| | syncOnboardingRecord | ❌ Missing | REQUIRED |
| | userName | ❌ Missing | REQUIRED |
| | userEmail | ❌ Missing | REQUIRED |
| | userPassword | ❌ Missing | REQUIRED |
| **INVALID** | enablePayments | ⚠️ NOT IN ORIGINAL | REMOVE |
| | paymentGateway | ⚠️ NOT IN ORIGINAL | REMOVE |
| | enableDelivery | ⚠️ NOT IN ORIGINAL | REMOVE |
| | enablePickup | ⚠️ NOT IN ORIGINAL | REMOVE |
| | enableDineIn | ⚠️ NOT IN ORIGINAL | REMOVE |
| | gstPercentage | ⚠️ NOT IN ORIGINAL | REMOVE |
| | menuImportFormat | ⚠️ NOT IN ORIGINAL | REMOVE |
| | skipSteps | ⚠️ May keep for batch | EVALUATE |

---

## Original Tab Components (To Reuse)

Located in: `src/components/registration/tabs/`

| Tab File | Size | Purpose |
|----------|------|---------|
| `AccountTab.tsx` | 4KB | Email, password, phone, registerNewUser |
| `RestaurantTab.tsx` | 10KB | Name, address, subdomain, opening hours |
| `MenuTab.tsx` | 10KB | Menu selection, uploadImages, addOptionSets, addItemTags |
| `WebsiteTab.tsx` | 24KB | Theme, colors, logos, header config (most complex) |
| `PaymentTab.tsx` | 3KB | includeStripeLink |
| `OnboardingTab.tsx` | 7KB | Onboarding user creation and sync |
| `index.ts` | 296B | Barrel exports |

### Key Helper Functions (from YoloModeDialog.tsx)

```typescript
// Generate default password - NEEDS FIXING
function generateDefaultPassword(restaurantName: string): string {
  // Current implementation doesn't remove brackets
  const cleaned = (restaurantName || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return 'Restaurant789!';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
}

// Generate subdomain
function generateSubdomain(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Determine registration mode
function determineRegistrationMode(registrationStatus: RegistrationStatus | null):
  'existing_account_first_restaurant' | 'existing_account_additional_restaurant';

// Initialize form data from restaurant
function initializeFormData(restaurant: Restaurant, registrationStatus: RegistrationStatus | null): YoloModeFormData;
```

---

## Implementation Plan

### Phase 1: Fix Password Generation (Quick Win)

**Files to modify:**
- `src/components/registration/YoloModeDialog.tsx` - Fix generateDefaultPassword()
- `src/components/registration-batch/YoloConfigBatchView.tsx` - Apply same fix

**Implementation:**

```typescript
// Helper to clean restaurant name (remove bracketed sections like "(Henderson)")
function cleanRestaurantName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim() || name;
}

// Fixed password generation
function generateDefaultPassword(restaurantName: string): string {
  // First clean the name (remove bracketed location suffixes)
  const cleanedName = cleanRestaurantName(restaurantName);
  // Then remove non-alpha characters
  const alphaOnly = cleanedName.replace(/[^a-zA-Z]/g, '');
  if (!alphaOnly) return 'Restaurant789!';
  // Capitalize first letter only, rest lowercase
  return alphaOnly.charAt(0).toUpperCase() + alphaOnly.slice(1).toLowerCase() + '789!';
}
```

**Test cases:**
- "Jax Burger Shack (Northside Drive)" → "Jaxburgershack789!"
- "Texas Chicken (Henderson)" → "Texaschicken789!"
- "PIZZA HUT" → "Pizzahut789!"

---

### Phase 2: Rewrite YoloConfigBatchView

**Approach:** Create a batch wrapper that reuses the original tab components with per-restaurant state management.

#### 2.1 New Component Structure

```
src/components/registration-batch/
├── YoloConfigBatchView.tsx      # Main batch view (REWRITE)
├── BatchRestaurantSelector.tsx  # Restaurant list with expand/collapse (NEW)
├── BatchConfigTabs.tsx          # Wrapper around original tabs (NEW)
├── BatchCopySettings.tsx        # Copy settings to all restaurants (NEW)
└── index.ts                     # Barrel exports (UPDATE)
```

#### 2.2 YoloConfigBatchView.tsx - Proposed Structure

```tsx
export function YoloConfigBatchView({
  batchId,
  jobs,
  onComplete,
}: YoloConfigBatchViewProps) {
  // State: per-restaurant form data using YoloModeFormData structure
  const [formDataByJob, setFormDataByJob] = useState<Record<string, YoloModeFormData>>({});

  // State: currently selected restaurant for editing
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // State: active tab within the selected restaurant
  const [activeTab, setActiveTab] = useState('account');

  // Initialize form data for each job using initializeFormData()
  useEffect(() => {
    const initial: Record<string, YoloModeFormData> = {};
    pendingJobs.forEach((job) => {
      initial[job.id] = initializeFormData(job.restaurant, null);
    });
    setFormDataByJob(initial);
  }, [pendingJobs]);

  // Render: Restaurant list on left, tab editor on right (or stacked on mobile)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5: Configure Yolo Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Restaurant list */}
          <div className="col-span-4">
            <BatchRestaurantSelector
              jobs={pendingJobs}
              formDataByJob={formDataByJob}
              selectedJobId={selectedJobId}
              onSelect={setSelectedJobId}
            />
          </div>

          {/* Right: Tab editor for selected restaurant */}
          <div className="col-span-8">
            {selectedJobId && (
              <BatchConfigTabs
                job={pendingJobs.find(j => j.id === selectedJobId)!}
                formData={formDataByJob[selectedJobId]}
                onFormDataChange={(updates) => updateJobFormData(selectedJobId, updates)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}
          </div>
        </div>

        {/* Copy settings action */}
        <BatchCopySettings
          jobs={pendingJobs}
          formDataByJob={formDataByJob}
          onCopy={handleCopySettings}
        />

        {/* Submit button */}
        <Button onClick={handleSubmit}>
          Start Yolo Mode ({configuredCount}/{pendingJobs.length})
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### 2.3 BatchConfigTabs.tsx - Reusing Original Tabs

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { AccountTab } from '../registration/tabs/AccountTab';
import { RestaurantTab } from '../registration/tabs/RestaurantTab';
import { MenuTab } from '../registration/tabs/MenuTab';
import { WebsiteTab } from '../registration/tabs/WebsiteTab';
import { PaymentTab } from '../registration/tabs/PaymentTab';
import { OnboardingTab } from '../registration/tabs/OnboardingTab';

export function BatchConfigTabs({
  job,
  formData,
  onFormDataChange,
  activeTab,
  onTabChange,
}: BatchConfigTabsProps) {
  // Create updateFormData helper matching the signature tabs expect
  const updateFormData = useCallback(<
    S extends keyof YoloModeFormData,
    K extends keyof YoloModeFormData[S]
  >(section: S, key: K, value: YoloModeFormData[S][K]) => {
    onFormDataChange({
      ...formData,
      [section]: {
        ...formData[section],
        [key]: value,
      },
    });
  }, [formData, onFormDataChange]);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
        <TabsTrigger value="menu">Menu</TabsTrigger>
        <TabsTrigger value="website">Website</TabsTrigger>
        <TabsTrigger value="payment">Payment</TabsTrigger>
        <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <AccountTab
          formData={formData}
          updateFormData={updateFormData}
          registrationStatus={null}
        />
      </TabsContent>

      {/* ... other tabs ... */}
    </Tabs>
  );
}
```

#### 2.4 Required Data for Tabs

The tabs need access to restaurant data. Ensure `RegistrationJob` type includes:

```typescript
interface RegistrationJob {
  id: string;
  restaurant: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    subdomain?: string;
    opening_hours?: Record<string, any>;
    cuisine?: string | string[];
    primary_color?: string;
    secondary_color?: string;
    // ... all logo fields
    menus?: Array<{ id: string; name: string; ... }>;
  };
  // ...
}
```

**Check:** The `getRegistrationBatchJob()` query may need to include more restaurant fields and the menus relation.

---

### Phase 3: Backend Changes

#### 3.1 Update completeStep5() to Accept YoloModeFormData

The backend `completeStep5()` currently expects a different structure. It needs to accept and store the full `YoloModeFormData` structure.

**File:** `src/services/registration-batch-service.js`

```javascript
async function completeStep5(batchId, configurations, orgId) {
  // configurations should now be: { 'job-uuid': YoloModeFormData, ... }

  for (const [jobId, formData] of Object.entries(configurations)) {
    // Save full formData to execution_config
    await client
      .from('registration_jobs')
      .update({ execution_config: formData })
      .eq('id', jobId);

    await updateStepStatus(jobId, 5, 'completed');
  }

  // ... rest of validation and Step 6 triggering
}
```

#### 3.2 Update processStep6() to Use YoloModeFormData

The `processStep6()` function needs to execute Yolo Mode using the stored `execution_config` which is now `YoloModeFormData`.

**Integration Point:** Check how `useYoloModeExecution.ts` is called and ensure `processStep6()` can call the same backend logic.

**File:** `src/hooks/useYoloModeExecution.ts`

This hook calls various API endpoints for each step. The batch version needs to call the same endpoints with the stored config.

---

### Phase 4: API Contract Update

#### 4.1 Update Step 5 Complete Endpoint

**Endpoint:** `POST /api/registration-batches/:id/steps/5/complete`

**Current Body (WRONG):**
```json
{
  "configurations": [
    { "job_id": "uuid", "execution_config": { "password": "...", "skipSteps": [] } }
  ]
}
```

**New Body (CORRECT):**
```json
{
  "configurations": {
    "job-uuid-1": {
      "account": { "registerNewUser": true, "email": "...", "password": "...", "phone": "..." },
      "restaurant": { "registrationMode": "...", "name": "...", ... },
      "menu": { "selectedMenuId": "...", "uploadImages": true, ... },
      "website": { "theme": "dark", "primaryColor": "#000", ... },
      "payment": { "includeStripeLink": false },
      "onboarding": { "createOnboardingUser": true, ... }
    },
    "job-uuid-2": { ... }
  }
}
```

---

## Files to Create/Modify Summary

### New Files
- `src/components/registration-batch/BatchRestaurantSelector.tsx`
- `src/components/registration-batch/BatchConfigTabs.tsx`
- `src/components/registration-batch/BatchCopySettings.tsx`

### Files to Modify
- `src/components/registration/YoloModeDialog.tsx` - Fix generateDefaultPassword()
- `src/components/registration-batch/YoloConfigBatchView.tsx` - Complete rewrite
- `src/components/registration-batch/index.ts` - Add new exports
- `src/services/registration-batch-service.js` - Update completeStep5() and processStep6()
- `src/routes/registration-batch-routes.js` - Validate new request body format

### Files to Study (for reference)
- `src/components/registration/tabs/*.tsx` - All tab implementations
- `src/hooks/useYoloModeExecution.ts` - Execution logic to reuse
- `src/services/registration-batch-service.js` - getRegistrationBatchJob() query

---

## Implementation Checklist

### Phase 1: Password Fix
- [ ] Create `cleanRestaurantName()` helper function
- [ ] Update `generateDefaultPassword()` in YoloModeDialog.tsx
- [ ] Apply same fix in YoloConfigBatchView.tsx (will be replaced in Phase 2)
- [ ] Test password generation with bracketed names

### Phase 2: UI Rewrite
- [ ] Create `BatchRestaurantSelector.tsx`
- [ ] Create `BatchConfigTabs.tsx` - wrapper around original tabs
- [ ] Create `BatchCopySettings.tsx`
- [ ] Rewrite `YoloConfigBatchView.tsx`
- [ ] Update `index.ts` exports
- [ ] Verify all tab components render correctly
- [ ] Test form state management per-restaurant
- [ ] Test "Copy to All" functionality

### Phase 3: Backend
- [ ] Update `getRegistrationBatchJob()` to include all required restaurant fields and menus
- [ ] Update `completeStep5()` to accept YoloModeFormData structure
- [ ] Verify `processStep6()` can use stored YoloModeFormData
- [ ] Test Step 5 → Step 6 transition with new data structure

### Phase 4: Integration Testing
- [ ] Test full flow: Step 4 complete → Step 5 UI shows → Configure → Submit → Step 6 runs
- [ ] Test with multiple restaurants
- [ ] Test "Copy to All" with different restaurant data
- [ ] Verify all Yolo Mode steps execute correctly

---

## Notes

### Why Option A (Reuse Tabs)?

1. **Proven UI:** The tab components already work in single-restaurant mode
2. **Consistent UX:** Users familiar with YoloModeDialog will recognize the interface
3. **Reduced Risk:** Less new code means fewer bugs
4. **Maintainability:** Changes to tabs automatically apply to both single and batch modes

### Potential Challenges

1. **Tab Props:** Some tabs expect `registrationStatus` which may not be available in batch mode (pass null)
2. **Restaurant Data:** Tabs expect full restaurant object - ensure batch query includes all fields
3. **Menu Selection:** MenuTab needs `restaurant.menus` array - verify this is loaded
4. **State Sync:** Managing form state for multiple restaurants requires careful handling

### Batch-Specific Features to Add

1. **Restaurant Selector:** Visual list showing config status per restaurant
2. **Copy Settings:** Copy from one restaurant to all others (except unique fields like subdomain)
3. **Validation Summary:** Show which restaurants are ready vs need attention
4. **Progress Indicator:** Show configured count vs total

---

## Related Documentation

- [implementation-roadmap.md](./implementation-roadmap.md) - Overall Phase 2 progress
- [service-layer.md](./service-layer.md) - Backend service specifications
- [ui-components.md](./ui-components.md) - Frontend component specifications
