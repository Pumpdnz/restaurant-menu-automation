# Implementation Plan: Registration Yolo Mode

## Overview

**Feature:** Registration Yolo Mode - One-click complete restaurant setup
**Goal:** Allow users to review/edit all settings in a single dialog and execute the full registration workflow automatically

---

## Architecture Summary

### Component Structure
```
RestaurantDetail.jsx
├── YoloModeButton (trigger)
└── YoloModeDialog (new component)
    ├── YoloModeFormState (hook)
    ├── YoloModeTabs
    │   ├── AccountTab
    │   ├── RestaurantTab
    │   ├── MenuTab
    │   ├── WebsiteTab
    │   ├── PaymentTab
    │   └── OnboardingTab (conditional)
    ├── YoloModeFooter
    └── YoloModeExecutor (orchestration logic)
```

### Execution Phases
```
Phase 1 (Parallel):     Account Reg | Code Gen | Onboarding User | Image Upload
                              ↓
Phase 2 (After Reg):    Restaurant Reg | Website Config | Services | Payment | Onboarding Sync
                              ↓
Phase 3 (After Menu):   Menu Import | Option Sets
                              ↓
Phase 4 (Sequential):   Item Tags
```

**Note:** System Settings, API Key, and Uber Integration are NOT included in Yolo Mode as they require external customer onboarding processes to be completed first. These steps remain as manual operations in the Finalise Setup section.

---

## Implementation Tasks

### Phase 1: Foundation (New Component File)

#### Task 1.1: Create YoloModeDialog Component Shell
**File:** `src/components/registration/YoloModeDialog.jsx`

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Play, Save, X } from 'lucide-react';

export function YoloModeDialog({
  open,
  onOpenChange,
  restaurant,
  registrationStatus,
  onExecute,
  onSave
}) {
  const { isFeatureEnabled } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [formData, setFormData] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open && restaurant) {
      setFormData(initializeFormData(restaurant, registrationStatus));
    }
  }, [open, restaurant, registrationStatus]);

  // Determine visible tabs based on feature flags
  const showOnboardingTab = isFeatureEnabled('registration.onboardingUserManagement');

  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'account', label: 'Account' },
      { id: 'restaurant', label: 'Restaurant' },
      { id: 'menu', label: 'Menu' },
      { id: 'website', label: 'Website' },
      { id: 'payment', label: 'Payment' },
    ];
    if (showOnboardingTab) {
      baseTabs.push({ id: 'onboarding', label: 'Onboarding' });
    }
    return baseTabs;
  }, [showOnboardingTab]);

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Complete Restaurant Setup</DialogTitle>
          <DialogDescription>
            Review and edit all settings, then execute the full setup with one click
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className={`grid w-full grid-cols-${tabs.length}`}>
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 px-1">
            {/* Tab contents will be added in subsequent tasks */}
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4 flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onSave(formData)}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            <Button onClick={() => onExecute(formData)} disabled={isExecuting}>
              {isExecuting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Executing...</>
              ) : (
                <><Play className="h-4 w-4 mr-2" />Execute Full Setup</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Task 1.2: Create Form State Initialization Function

```jsx
// Add to YoloModeDialog.jsx

function initializeFormData(restaurant, registrationStatus) {
  const generateDefaultPassword = (name) => {
    const cleaned = (name || '').replace(/[^a-zA-Z0-9]/g, '');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
  };

  const determineRegistrationMode = () => {
    if (!registrationStatus?.hasAccount) return 'new_account_with_restaurant';
    if (!registrationStatus?.hasRestaurant) return 'existing_account_first_restaurant';
    return 'existing_account_additional_restaurant';
  };

  return {
    // Account Section
    account: {
      registerNewUser: !registrationStatus?.hasAccount,
      email: restaurant.user_email || restaurant.email || '',
      password: restaurant.user_password_hint || generateDefaultPassword(restaurant.name),
      phone: restaurant.phone || '',
    },

    // Restaurant Section
    restaurant: {
      registrationMode: determineRegistrationMode(),
      name: restaurant.name || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      opening_hours: restaurant.opening_hours || {},
      subdomain: restaurant.subdomain || '',
    },

    // Menu Section
    menu: {
      selectedMenuId: restaurant.menus?.[0]?.id || '',
      uploadImages: true,
      addOptionSets: true,
      addItemTags: true,
    },

    // Website Section
    website: {
      theme: restaurant.theme || 'dark',
      cuisine: Array.isArray(restaurant.cuisine) ? restaurant.cuisine[0] : (restaurant.cuisine || ''),
      primaryColor: restaurant.primary_color || '#000000',
      secondaryColor: restaurant.secondary_color || '#FFFFFF',
      disableGradients: false,
      configureHeader: !!restaurant.website_og_image,
      headerImageSource: 'website_og_image',
      headerLogoSource: 'logo_nobg_url',
      headerLogoDarkTint: 'none',
      headerLogoLightTint: 'none',
      navLogoSource: 'logo_nobg_url',
      navLogoDarkTint: 'none',
      navLogoLightTint: 'none',
      navTextColor: restaurant.theme === 'light' ? 'secondary' : 'white',
      faviconSource: 'logo_favicon_url',
      itemLayout: 'list',
    },

    // Payment Section
    payment: {
      includeStripeLink: false,
    },

    // Onboarding Section
    onboarding: {
      createOnboardingUser: true,
      syncOnboardingRecord: true,
      userName: restaurant.contact_name || '',
      userEmail: restaurant.contact_email || '',
      userPassword: '',
    },
  };
}
```

---

### Phase 2: Tab Components

#### Task 2.1: Account Tab
**File:** `src/components/registration/tabs/AccountTab.jsx`

```jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';

export function AccountTab({ formData, updateFormData, registrationStatus }) {
  const isAccountComplete = registrationStatus?.account?.registration_status === 'completed';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Account Details</CardTitle>
            <Badge variant={isAccountComplete ? "default" : "outline"}>
              {isAccountComplete ? "Registered" : "Not Registered"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="register-new-user"
              checked={formData.account.registerNewUser}
              onCheckedChange={(checked) =>
                updateFormData('account', 'registerNewUser', checked)
              }
              disabled={isAccountComplete}
            />
            <Label htmlFor="register-new-user">
              Register New User Account
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.account.email}
                onChange={(e) => updateFormData('account', 'email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.account.phone}
                onChange={(e) => updateFormData('account', 'phone', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="text"
              value={formData.account.password}
              onChange={(e) => updateFormData('account', 'password', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default format: RestaurantName789!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Task 2.2: Restaurant Tab
```jsx
// Similar structure with:
// - Registration Mode RadioGroup (new_account_with_restaurant, existing_account_first_restaurant, existing_account_additional_restaurant)
// - Restaurant Name, Phone, Address, City inputs
// - Opening Hours editor (use existing OpeningHoursEditor component)
// - Subdomain input
```

#### Task 2.3: Menu Tab
```jsx
// Structure with:
// - Menu selector dropdown (from restaurant.menus)
// - Upload Images checkbox
// - Add Option Sets checkbox
// - Add Item Tags checkbox
```

#### Task 2.4: Website Tab
```jsx
// Structure with:
// - Theme selection (light/dark)
// - Cuisine input
// - Primary/Secondary color pickers
// - Disable Gradients checkbox
// - Configure Header checkbox + conditional fields
// - Header Image source selector
// - Header Logo source + tint options
// - Nav Logo source + tint options
// - Nav Text color selector
// - Favicon source selector
// - Item Layout (list/card)
```

#### Task 2.5: Payment Tab
```jsx
// Structure with:
// - Include Stripe Link checkbox
// - Description of what this does
```

#### Task 2.6: Onboarding Tab (Conditional)
```jsx
// Structure with:
// - Create Onboarding User checkbox
// - User Name, Email, Password inputs
// - Sync Onboarding Record checkbox (nested, requires onboardingSync flag)
```

---

### Phase 3: Execution Orchestration

#### Task 3.1: Create Execution Hook
**File:** `src/hooks/useYoloModeExecution.js`

```javascript
import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { railwayApi } from '../services/api';

export function useYoloModeExecution() {
  const { isFeatureEnabled } = useAuth();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [stepResults, setStepResults] = useState({});
  const abortControllerRef = useRef(null);

  const updateStepStatus = useCallback((stepName, status) => {
    setStepResults(prev => ({
      ...prev,
      [stepName]: { ...prev[stepName], ...status }
    }));
  }, []);

  const executeYoloMode = useCallback(async (formData, restaurant, handlers) => {
    setIsExecuting(true);
    setExecutionStatus('running');
    setStepResults({});
    abortControllerRef.current = new AbortController();

    const results = {
      phase1: {},
      phase2: {},
      phase3: {},
      phase4: {},
    };

    try {
      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: Parallel Initial Operations
      // ═══════════════════════════════════════════════════════════════
      setCurrentPhase('phase1');
      const phase1Promises = [];

      // 1a. Account Registration (if enabled)
      if (formData.account.registerNewUser) {
        updateStepStatus('accountRegistration', { status: 'running' });
        phase1Promises.push(
          handlers.registerAccount(formData.account)
            .then(result => {
              updateStepStatus('accountRegistration', { status: 'completed', result });
              results.phase1.account = result;
            })
            .catch(error => {
              updateStepStatus('accountRegistration', { status: 'failed', error: error.message });
              results.phase1.account = { error: error.message };
            })
        );
      }

      // 1b. Code Injection Generation
      updateStepStatus('codeGeneration', { status: 'running' });
      phase1Promises.push(
        handlers.generateCodeInjections(formData.website.disableGradients)
          .then(result => {
            updateStepStatus('codeGeneration', { status: 'completed', result });
            results.phase1.codeGeneration = result;
          })
          .catch(error => {
            updateStepStatus('codeGeneration', { status: 'failed', error: error.message });
            results.phase1.codeGeneration = { error: error.message };
          })
      );

      // 1c. Onboarding User Creation (if feature enabled and selected)
      if (isFeatureEnabled('registration.onboardingUserManagement') &&
          formData.onboarding.createOnboardingUser) {
        updateStepStatus('onboardingUser', { status: 'running' });
        phase1Promises.push(
          handlers.createOnboardingUser(formData.onboarding)
            .then(result => {
              updateStepStatus('onboardingUser', { status: 'completed', result });
              results.phase1.onboardingUser = result;
            })
            .catch(error => {
              updateStepStatus('onboardingUser', { status: 'failed', error: error.message });
              results.phase1.onboardingUser = { error: error.message };
            })
        );
      }

      // 1d. Image Upload to CDN (if menu selected and images enabled)
      if (formData.menu.selectedMenuId && formData.menu.uploadImages) {
        updateStepStatus('imageUpload', { status: 'running' });
        phase1Promises.push(
          handlers.uploadImagesToCDN(formData.menu.selectedMenuId)
            .then(result => {
              updateStepStatus('imageUpload', { status: 'completed', result });
              results.phase1.imageUpload = result;
            })
            .catch(error => {
              updateStepStatus('imageUpload', { status: 'failed', error: error.message });
              results.phase1.imageUpload = { error: error.message };
            })
        );
      }

      await Promise.allSettled(phase1Promises);

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: After Registration Completes
      // ═══════════════════════════════════════════════════════════════
      setCurrentPhase('phase2');
      const phase2Promises = [];

      // 2a. Restaurant Registration
      updateStepStatus('restaurantRegistration', { status: 'running' });
      phase2Promises.push(
        handlers.registerRestaurant(formData.restaurant, formData.account)
          .then(result => {
            updateStepStatus('restaurantRegistration', { status: 'completed', result });
            results.phase2.restaurant = result;
          })
          .catch(error => {
            updateStepStatus('restaurantRegistration', { status: 'failed', error: error.message });
            results.phase2.restaurant = { error: error.message };
          })
      );

      // 2b. Website Configuration (needs code generation complete)
      if (results.phase1.codeGeneration?.filePaths) {
        updateStepStatus('websiteConfig', { status: 'running' });
        phase2Promises.push(
          handlers.configureWebsite(formData.website, results.phase1.codeGeneration.filePaths)
            .then(result => {
              updateStepStatus('websiteConfig', { status: 'completed', result });
              results.phase2.website = result;
            })
            .catch(error => {
              updateStepStatus('websiteConfig', { status: 'failed', error: error.message });
              results.phase2.website = { error: error.message };
            })
        );
      }

      // 2c. Services Configuration
      updateStepStatus('servicesConfig', { status: 'running' });
      phase2Promises.push(
        handlers.configureServices()
          .then(result => {
            updateStepStatus('servicesConfig', { status: 'completed', result });
            results.phase2.services = result;
          })
          .catch(error => {
            updateStepStatus('servicesConfig', { status: 'failed', error: error.message });
            results.phase2.services = { error: error.message };
          })
      );

      // 2d. Payment Configuration
      updateStepStatus('paymentConfig', { status: 'running' });
      phase2Promises.push(
        handlers.configurePayment(formData.payment.includeStripeLink)
          .then(result => {
            updateStepStatus('paymentConfig', { status: 'completed', result });
            results.phase2.payment = result;
          })
          .catch(error => {
            updateStepStatus('paymentConfig', { status: 'failed', error: error.message });
            results.phase2.payment = { error: error.message };
          })
      );

      // 2e. Onboarding Sync (if enabled and user created in Phase 1)
      if (isFeatureEnabled('registration.onboardingSync') &&
          formData.onboarding.syncOnboardingRecord &&
          results.phase1.onboardingUser?.success) {
        updateStepStatus('onboardingSync', { status: 'running' });
        phase2Promises.push(
          handlers.updateOnboardingRecord(formData.onboarding.userEmail)
            .then(result => {
              updateStepStatus('onboardingSync', { status: 'completed', result });
              results.phase2.onboardingSync = result;
            })
            .catch(error => {
              updateStepStatus('onboardingSync', { status: 'failed', error: error.message });
              results.phase2.onboardingSync = { error: error.message };
            })
        );
      }

      await Promise.allSettled(phase2Promises);

      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: Menu Import (After Restaurant Registered)
      // ═══════════════════════════════════════════════════════════════
      setCurrentPhase('phase3');

      if (formData.menu.selectedMenuId && results.phase2.restaurant?.success) {
        // 3a. Import Menu
        updateStepStatus('menuImport', { status: 'running' });
        try {
          const menuResult = await handlers.importMenuDirect(formData.menu.selectedMenuId);
          updateStepStatus('menuImport', { status: 'completed', result: menuResult });
          results.phase3.menu = menuResult;

          // 3b. Add Option Sets (after menu import)
          if (formData.menu.addOptionSets) {
            updateStepStatus('optionSets', { status: 'running' });
            try {
              const optionResult = await handlers.addOptionSets(formData.menu.selectedMenuId);
              updateStepStatus('optionSets', { status: 'completed', result: optionResult });
              results.phase3.optionSets = optionResult;
            } catch (error) {
              updateStepStatus('optionSets', { status: 'failed', error: error.message });
              results.phase3.optionSets = { error: error.message };
            }
          }
        } catch (error) {
          updateStepStatus('menuImport', { status: 'failed', error: error.message });
          results.phase3.menu = { error: error.message };
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 4: Item Tags (Sequential, After Option Sets)
      // ═══════════════════════════════════════════════════════════════
      setCurrentPhase('phase4');

      if (formData.menu.addItemTags && results.phase3.menu?.success) {
        updateStepStatus('itemTags', { status: 'running' });
        try {
          const tagsResult = await handlers.addItemTags();
          updateStepStatus('itemTags', { status: 'completed', result: tagsResult });
          results.phase4.itemTags = tagsResult;
        } catch (error) {
          updateStepStatus('itemTags', { status: 'failed', error: error.message });
          results.phase4.itemTags = { error: error.message };
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // COMPLETE
      // ═══════════════════════════════════════════════════════════════
      // Note: System Settings, API Key, and Uber Integration are NOT
      // included as they require external customer onboarding processes
      setExecutionStatus('completed');
      return results;

    } catch (error) {
      setExecutionStatus('failed');
      throw error;
    } finally {
      setIsExecuting(false);
      setCurrentPhase(null);
    }
  }, [isFeatureEnabled, updateStepStatus]);

  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExecuting(false);
    setExecutionStatus('cancelled');
  }, []);

  return {
    isExecuting,
    executionStatus,
    currentPhase,
    stepResults,
    executeYoloMode,
    cancelExecution,
  };
}
```

---

### Phase 4: Integration with RestaurantDetail.jsx

#### Task 4.1: Add Yolo Mode State and Button

Add to RestaurantDetail.jsx state declarations (~line 360):
```javascript
// Yolo Mode states
const [yoloModeOpen, setYoloModeOpen] = useState(false);
```

Add button to Registration tab (after the existing registration buttons):
```jsx
{/* Yolo Mode Button */}
<Card className="mt-4">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Workflow className="h-5 w-5" />
      Complete Setup (Yolo Mode)
    </CardTitle>
    <CardDescription>
      Review all settings and execute the full registration workflow automatically
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Button
      onClick={() => setYoloModeOpen(true)}
      className="w-full"
      size="lg"
    >
      <Play className="h-4 w-4 mr-2" />
      Open Yolo Mode Setup
    </Button>
  </CardContent>
</Card>
```

#### Task 4.2: Import and Render YoloModeDialog

Add import:
```javascript
import { YoloModeDialog } from '../components/registration/YoloModeDialog';
```

Add dialog at end of component (before closing tags):
```jsx
<YoloModeDialog
  open={yoloModeOpen}
  onOpenChange={setYoloModeOpen}
  restaurant={restaurant}
  registrationStatus={registrationStatus}
  onExecute={handleYoloModeExecute}
  onSave={handleYoloModeSave}
/>
```

#### Task 4.3: Create Handler Functions for Yolo Mode

```javascript
const handleYoloModeExecute = async (formData) => {
  // Create handlers object that wraps existing functions
  const handlers = {
    registerAccount: async (accountData) => {
      const response = await api.post('/registration/register-account', {
        restaurantId: id,
        email: accountData.email,
        password: accountData.password,
        phone: accountData.phone,
      });
      return response.data;
    },

    registerRestaurant: async (restaurantData, accountData) => {
      const response = await railwayApi.post('/api/registration/register-restaurant', {
        restaurantId: id,
        registrationType: restaurantData.registrationMode,
        email: accountData.email,
        password: accountData.password,
        restaurantName: restaurantData.name,
        address: restaurantData.address,
        phone: restaurantData.phone,
        hours: restaurantData.opening_hours,
        city: restaurantData.city,
      });
      return response.data;
    },

    generateCodeInjections: async (noGradient) => {
      const response = await railwayApi.post('/api/registration/generate-code-injections', {
        restaurantId: id,
        noGradient,
      });
      return response.data;
    },

    configureWebsite: async (websiteData, filePaths) => {
      const response = await railwayApi.post('/api/registration/configure-website', {
        restaurantId: id,
        filePaths,
        headerConfig: {
          enabled: websiteData.configureHeader,
          backgroundSource: websiteData.headerImageSource,
        },
        itemsConfig: {
          layout: websiteData.itemLayout,
        },
        textColorConfig: {
          navText: websiteData.navTextColor,
          boxText: websiteData.navTextColor,
        },
        navLogoTintConfig: {
          darkColor: websiteData.navLogoDarkTint !== 'none' ? websiteData.navLogoDarkTint : null,
          lightColor: websiteData.navLogoLightTint !== 'none' ? websiteData.navLogoLightTint : null,
        },
        headerLogoTintConfig: {
          darkColor: websiteData.headerLogoDarkTint !== 'none' ? websiteData.headerLogoDarkTint : null,
          lightColor: websiteData.headerLogoLightTint !== 'none' ? websiteData.headerLogoLightTint : null,
        },
      });
      return response.data;
    },

    configureServices: async () => {
      const response = await railwayApi.post('/api/registration/configure-services', {
        restaurantId: id,
      });
      return response.data;
    },

    configurePayment: async (includeStripeLink) => {
      const response = await railwayApi.post('/api/registration/configure-payment', {
        restaurantId: id,
        includeConnectLink: includeStripeLink,
      });
      return response.data;
    },

    importMenuDirect: async (menuId) => {
      const response = await railwayApi.post('/api/registration/import-menu-direct', {
        restaurantId: id,
        menuId,
      });
      return response.data;
    },

    addOptionSets: async (menuId) => {
      const response = await railwayApi.post('/api/registration/add-option-sets', {
        restaurantId: id,
        menuId,
      });
      return response.data;
    },

    addItemTags: async () => {
      const response = await railwayApi.post('/api/registration/add-item-tags', {
        restaurantId: id,
      });
      return response.data;
    },

    createOnboardingUser: async (onboardingData) => {
      const response = await railwayApi.post('/api/registration/create-onboarding-user', {
        restaurantId: id,
        userName: onboardingData.userName,
        userEmail: onboardingData.userEmail,
        userPassword: onboardingData.userPassword,
      });
      return response.data;
    },

    updateOnboardingRecord: async (userEmail) => {
      const response = await api.post('/registration/update-onboarding-record', {
        restaurantId: id,
        userEmail,
      });
      return response.data;
    },

    // Note: setupSystemSettings, createApiKey, and configureUberIntegration
    // are NOT included in Yolo Mode as they require external customer
    // onboarding processes to be completed first

    uploadImagesToCDN: async (menuId) => {
      // This uses the existing handleUploadImagesToCDN logic
      // but wrapped to return a promise
      const response = await api.post(`/menus/${menuId}/upload-images`);

      if (!response.data.batchId || response.data.mode === 'synchronous') {
        return response.data;
      }

      // Poll for async completion
      return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          try {
            const progressResponse = await api.get(`/upload-batches/${response.data.batchId}`);
            const batch = progressResponse.data.batch;

            if (batch.status === 'completed') {
              clearInterval(pollInterval);
              resolve({ success: true, uploaded: batch.uploaded_count });
            } else if (batch.status === 'failed') {
              clearInterval(pollInterval);
              reject(new Error('Image upload failed'));
            }
          } catch (err) {
            clearInterval(pollInterval);
            reject(err);
          }
        }, 2000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          reject(new Error('Image upload timeout'));
        }, 300000);
      });
    },
  };

  // Execute using the hook
  const results = await executeYoloMode(formData, restaurant, handlers);

  // Refresh data after completion
  await fetchRestaurantDetails();
  await fetchRegistrationStatus();

  toast({
    title: "Setup Complete",
    description: "Restaurant registration workflow completed",
  });

  setYoloModeOpen(false);
};

const handleYoloModeSave = async (formData) => {
  // Save form data to restaurant record
  const updates = {
    user_email: formData.account.email,
    user_password_hint: formData.account.password,
    phone: formData.account.phone || formData.restaurant.phone,
    name: formData.restaurant.name,
    address: formData.restaurant.address,
    city: formData.restaurant.city,
    opening_hours: formData.restaurant.opening_hours,
    theme: formData.website.theme,
    primary_color: formData.website.primaryColor,
    secondary_color: formData.website.secondaryColor,
    contact_name: formData.onboarding.userName,
    contact_email: formData.onboarding.userEmail,
  };

  try {
    await api.put(`/restaurants/${id}`, updates);
    toast({ title: "Saved", description: "Settings saved successfully" });
    await fetchRestaurantDetails();
  } catch (error) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  }
};
```

---

### Phase 5: Progress Display Component

#### Task 5.1: Create Execution Progress Display
**File:** `src/components/registration/YoloModeProgress.jsx`

```jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, Loader2, Circle } from 'lucide-react';

const STEPS = [
  { id: 'accountRegistration', label: 'Account Registration', phase: 1 },
  { id: 'codeGeneration', label: 'Code Generation', phase: 1 },
  { id: 'onboardingUser', label: 'Onboarding User', phase: 1, conditional: true },
  { id: 'imageUpload', label: 'Image Upload', phase: 1, conditional: true },
  { id: 'restaurantRegistration', label: 'Restaurant Registration', phase: 2 },
  { id: 'websiteConfig', label: 'Website Configuration', phase: 2 },
  { id: 'servicesConfig', label: 'Services Configuration', phase: 2 },
  { id: 'paymentConfig', label: 'Payment Configuration', phase: 2 },
  { id: 'onboardingSync', label: 'Onboarding Sync', phase: 2, conditional: true },
  { id: 'menuImport', label: 'Menu Import', phase: 3 },
  { id: 'optionSets', label: 'Option Sets', phase: 3, conditional: true },
  { id: 'itemTags', label: 'Item Tags', phase: 4, conditional: true },
];
// Note: System Settings, API Key, and Uber Integration are NOT included
// as they require external customer onboarding processes

export function YoloModeProgress({ stepResults, currentPhase }) {
  const getStepIcon = (step) => {
    const result = stepResults[step.id];
    if (!result) return <Circle className="h-4 w-4 text-gray-300" />;
    if (result.status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (result.status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (result.status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

  const getPhaseLabel = (phase) => {
    const labels = {
      1: 'Initial Setup',
      2: 'Configuration',
      3: 'Menu Setup',
      4: 'Finalization',
    };
    return labels[phase];
  };

  // Group steps by phase (4 phases - excludes System Settings/API Key/Uber Integration)
  const phases = [1, 2, 3, 4].map(phaseNum => ({
    phase: phaseNum,
    label: getPhaseLabel(phaseNum),
    steps: STEPS.filter(s => s.phase === phaseNum),
    isCurrent: currentPhase === `phase${phaseNum}`,
  }));

  return (
    <div className="space-y-4">
      {phases.map(phase => (
        <Card key={phase.phase} className={phase.isCurrent ? 'border-blue-500' : ''}>
          <CardHeader className="py-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Phase {phase.phase}: {phase.label}
              {phase.isCurrent && <Badge>Running</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="space-y-1">
              {phase.steps.map(step => {
                const result = stepResults[step.id];
                return (
                  <div key={step.id} className="flex items-center gap-2 text-sm">
                    {getStepIcon(step)}
                    <span className={result?.status === 'failed' ? 'text-red-500' : ''}>
                      {step.label}
                    </span>
                    {result?.error && (
                      <span className="text-xs text-red-400 ml-auto">
                        {result.error}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## File Structure Summary

```
src/
├── components/
│   └── registration/
│       ├── YoloModeDialog.jsx          # Main dialog component
│       ├── YoloModeProgress.jsx        # Progress display
│       └── tabs/
│           ├── AccountTab.jsx
│           ├── RestaurantTab.jsx
│           ├── MenuTab.jsx
│           ├── WebsiteTab.jsx
│           ├── PaymentTab.jsx
│           └── OnboardingTab.jsx
├── hooks/
│   └── useYoloModeExecution.js         # Orchestration hook
└── pages/
    └── RestaurantDetail.jsx            # Integration point
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `src/components/registration/` directory
- [ ] Create `YoloModeDialog.jsx` shell component
- [ ] Create `initializeFormData` function
- [ ] Create `updateFormData` helper

### Phase 2: Tab Components
- [ ] Create `tabs/AccountTab.jsx`
- [ ] Create `tabs/RestaurantTab.jsx`
- [ ] Create `tabs/MenuTab.jsx`
- [ ] Create `tabs/WebsiteTab.jsx`
- [ ] Create `tabs/PaymentTab.jsx`
- [ ] Create `tabs/OnboardingTab.jsx`

### Phase 3: Orchestration
- [ ] Create `useYoloModeExecution.js` hook
- [ ] Implement parallel Phase 1 execution
- [ ] Implement sequential Phase 2-4 execution
- [ ] Add error handling and rollback consideration

**Note:** System Settings, API Key, and Uber Integration are excluded from Yolo Mode orchestration as they require external customer onboarding processes.

### Phase 4: Integration
- [ ] Add Yolo Mode state to RestaurantDetail.jsx
- [ ] Add Yolo Mode button to Registration tab
- [ ] Create handler wrapper functions
- [ ] Import and render YoloModeDialog

### Phase 5: Progress & Polish
- [ ] Create `YoloModeProgress.jsx` component
- [ ] Add progress display to dialog during execution
- [ ] Add toast notifications for completion
- [ ] Test all execution paths

---

## Testing Scenarios

1. **Full new registration** - No existing account or restaurant
2. **Existing account, new restaurant** - Account complete, add restaurant
3. **With onboarding features** - Test feature-flagged steps
4. **Without menu selection** - Skip menu-related steps
5. **Error handling** - Test individual step failures
6. **Cancel mid-execution** - Test abort controller

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Foundation | 4 tasks | 2-3 hours |
| Phase 2: Tab Components | 6 tabs | 4-6 hours |
| Phase 3: Orchestration | 4 tasks | 2-3 hours |
| Phase 4: Integration | 4 tasks | 2-3 hours |
| Phase 5: Progress & Polish | 4 tasks | 2-3 hours |
| **Total** | **22 tasks** | **12-18 hours** |

**Note:** Scope reduced by excluding System Settings, API Key, and Uber Integration steps which require external customer onboarding processes.
