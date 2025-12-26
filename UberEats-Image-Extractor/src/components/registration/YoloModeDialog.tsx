import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Loader2, Play, Save, X, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

// Tab components
import { AccountTab } from './tabs/AccountTab';
import { RestaurantTab } from './tabs/RestaurantTab';
import { MenuTab } from './tabs/MenuTab';
import { WebsiteTab } from './tabs/WebsiteTab';
import { PaymentTab } from './tabs/PaymentTab';
import { OnboardingTab } from './tabs/OnboardingTab';

// Progress component
import { YoloModeProgress } from './YoloModeProgress';

// Execution hook
import { useYoloModeExecution } from '../../hooks/useYoloModeExecution';

// Types
interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  subdomain?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  opening_hours?: Record<string, any>;
  cuisine?: string | string[];
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
  accent_color?: string;
  background_color?: string;
  theme?: 'light' | 'dark';
  logo_url?: string;
  logo_nobg_url?: string;
  logo_standard_url?: string;
  logo_thermal_url?: string;
  logo_thermal_alt_url?: string;
  logo_thermal_contrast_url?: string;
  logo_thermal_adaptive_url?: string;
  logo_favicon_url?: string;
  website_og_image?: string;
  ubereats_og_image?: string;
  doordash_og_image?: string;
  facebook_cover_image?: string;
  user_email?: string;
  user_password_hint?: string;
  stripe_connect_url?: string;
  menus?: Array<{
    id: string;
    name: string;
    version?: string;
    platform?: string;
    platforms?: { name: string }; // Nested object from Supabase join
    source_url?: string;
    created_at?: string;
    item_count?: number;
  }>;
}

interface RegistrationStatus {
  success: boolean;
  account?: {
    id: string;
    email: string;
    registration_status: 'pending' | 'completed' | 'failed';
    pumpd_user_id?: string;
  } | null;
  pumpdRestaurant?: {
    id: string;
    pumpd_restaurant_id: string;
    pumpd_subdomain: string;
    registration_status: 'pending' | 'completed' | 'failed';
    dashboard_url?: string;
  } | null;
  hasAccount: boolean;
  hasRestaurant: boolean;
}

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

interface YoloModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant;
  registrationStatus: RegistrationStatus | null;
  onExecute: (formData: YoloModeFormData) => Promise<void>;
  onSave: (formData: YoloModeFormData) => Promise<void>;
}

// Helper function to generate default password
function generateDefaultPassword(restaurantName: string): string {
  const cleaned = (restaurantName || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return 'Restaurant789!';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
}

// Helper function to generate subdomain
function generateSubdomain(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Helper function to determine registration mode
// Note: Account creation is now handled separately in Phase 1, so we only have two modes:
// - First restaurant for the account (new or existing account)
// - Additional restaurant for an existing account with restaurants
function determineRegistrationMode(
  registrationStatus: RegistrationStatus | null
): 'existing_account_first_restaurant' | 'existing_account_additional_restaurant' {
  // If no restaurant registered yet, this is the first restaurant
  if (!registrationStatus?.hasRestaurant) return 'existing_account_first_restaurant';
  // Otherwise, it's an additional restaurant
  return 'existing_account_additional_restaurant';
}

// Initialize form data from restaurant and registration status
function initializeFormData(
  restaurant: Restaurant,
  registrationStatus: RegistrationStatus | null
): YoloModeFormData {
  const theme = restaurant.theme || 'dark';
  const cuisines = Array.isArray(restaurant.cuisine)
    ? restaurant.cuisine
    : (restaurant.cuisine ? [restaurant.cuisine] : []);

  return {
    account: {
      registerNewUser: !registrationStatus?.hasAccount,
      email: restaurant.user_email || restaurant.email || '',
      password: restaurant.user_password_hint || generateDefaultPassword(restaurant.name),
      phone: restaurant.phone || '',
    },
    restaurant: {
      registrationMode: determineRegistrationMode(registrationStatus),
      name: restaurant.name || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      subdomain: restaurant.subdomain || generateSubdomain(restaurant.name),
      opening_hours: restaurant.opening_hours || {},
    },
    menu: {
      selectedMenuId: restaurant.menus?.[0]?.id || '',
      uploadImages: true,
      addOptionSets: true,
      addItemTags: true,
    },
    website: {
      theme,
      cuisines,
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
      navTextColor: theme === 'light' ? 'secondary' : 'white',
      navTextCustomColor: '',
      cardTextColor: theme === 'light' ? 'secondary' : 'white',
      cardTextCustomColor: '',
      faviconSource: 'logo_favicon_url',
      itemLayout: 'list',
    },
    payment: {
      includeStripeLink: false,
    },
    onboarding: {
      createOnboardingUser: true,
      syncOnboardingRecord: true,
      userName: restaurant.contact_name || '',
      userEmail: restaurant.user_email || restaurant.email || restaurant.contact_email || '',
      userPassword: restaurant.user_password_hint || generateDefaultPassword(restaurant.name),
    },
  };
}

export function YoloModeDialog({
  open,
  onOpenChange,
  restaurant,
  registrationStatus,
  onExecute,
  onSave
}: YoloModeDialogProps) {
  const { isFeatureEnabled } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [formData, setFormData] = useState<YoloModeFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'progress'>('form');

  // Execution hook
  const {
    isExecuting,
    executionStatus,
    currentPhase,
    stepResults,
    executeYoloMode,
    cancelExecution,
    resetExecution,
    checkAndResumeExecution,
  } = useYoloModeExecution();

  // Check for in-progress execution when dialog opens
  // This allows resuming progress view if user closed dialog during execution
  useEffect(() => {
    if (open && restaurant?.id) {
      checkAndResumeExecution(restaurant.id).then((hasExecution) => {
        if (hasExecution) {
          // Switch to progress view if there's an in-progress execution
          setViewMode('progress');
          console.log('[YoloModeDialog] Resuming in-progress execution');
        } else {
          // Reset to form view
          setActiveTab('account');
          setViewMode('form');
          resetExecution();
        }
      });
    }
  }, [open, restaurant?.id, checkAndResumeExecution, resetExecution]);

  // Update form data when restaurant changes (while dialog is open)
  useEffect(() => {
    if (open && restaurant) {
      setFormData(initializeFormData(restaurant, registrationStatus));
    }
  }, [open, restaurant, registrationStatus]);

  // Determine visible tabs based on feature flags
  const showOnboardingTab = isFeatureEnabled('registration.onboardingUserManagement');

  // Build tabs array
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

  // Helper to update form data
  const updateFormData = useCallback(<
    S extends keyof YoloModeFormData,
    K extends keyof YoloModeFormData[S]
  >(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => {
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      };
    });
  }, []);

  // Handle execute
  const handleExecute = async () => {
    if (!formData) return;
    setViewMode('progress');
    try {
      await executeYoloMode(formData, restaurant, restaurant.id);
      // Call the parent's onExecute for any additional handling (refresh data, etc.)
      await onExecute(formData);
    } catch (error) {
      // Error handling is done in the hook
      console.error('Yolo mode execution error:', error);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!formData) return;
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) return null;

  // Handle back to form
  const handleBackToForm = () => {
    if (!isExecuting) {
      setViewMode('form');
      resetExecution();
    }
  };

  // Handle cancel execution
  const handleCancelExecution = () => {
    cancelExecution();
  };

  // Handle close dialog
  const handleClose = () => {
    if (isExecuting) {
      // Optionally show a confirmation before closing during execution
      cancelExecution();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {viewMode === 'progress' ? 'Executing Setup...' : 'Complete Restaurant Setup'}
          </DialogTitle>
          <DialogDescription>
            {viewMode === 'progress'
              ? `Running automated setup for ${restaurant.name}`
              : 'Review and edit all settings, then execute the full setup with one click'
            }
          </DialogDescription>
        </DialogHeader>

        {viewMode === 'form' ? (
          <>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <TabsList size="full" className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
                {tabs.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.id} size="full">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4 px-1">
                <TabsContent value="account" className="mt-0">
                  <AccountTab
                    formData={formData}
                    updateFormData={updateFormData}
                    registrationStatus={registrationStatus}
                  />
                </TabsContent>

                <TabsContent value="restaurant" className="mt-0">
                  <RestaurantTab
                    formData={formData}
                    updateFormData={updateFormData}
                    registrationStatus={registrationStatus}
                  />
                </TabsContent>

                <TabsContent value="menu" className="mt-0">
                  <MenuTab
                    formData={formData}
                    updateFormData={updateFormData}
                    restaurant={restaurant}
                  />
                </TabsContent>

                <TabsContent value="website" className="mt-0">
                  <WebsiteTab
                    formData={formData}
                    updateFormData={updateFormData}
                    restaurant={restaurant}
                  />
                </TabsContent>

                <TabsContent value="payment" className="mt-0">
                  <PaymentTab
                    formData={formData}
                    updateFormData={updateFormData}
                  />
                </TabsContent>

                {showOnboardingTab && (
                  <TabsContent value="onboarding" className="mt-0">
                    <OnboardingTab
                      formData={formData}
                      updateFormData={updateFormData}
                    />
                  </TabsContent>
                )}
              </div>
            </Tabs>

            <DialogFooter className="border-t pt-4 flex justify-between sm:justify-between">
              <Button variant="outline" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  disabled={isSaving || isExecuting}
                >
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Save Changes</>
                  )}
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting || isSaving}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Execute Full Setup
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Progress View */}
            <div className="flex-1 overflow-y-auto mt-4 px-1">
              <YoloModeProgress
                stepResults={stepResults}
                currentPhase={currentPhase}
              />
            </div>

            <DialogFooter className="border-t pt-4 flex justify-between sm:justify-between">
              {executionStatus === 'completed' || executionStatus === 'failed' || executionStatus === 'cancelled' ? (
                <>
                  <Button variant="outline" onClick={handleBackToForm}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Settings
                  </Button>
                  <div className="flex items-center gap-2">
                    {executionStatus === 'completed' && (
                      <span className="flex items-center text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Setup Complete
                      </span>
                    )}
                    {executionStatus === 'failed' && (
                      <span className="flex items-center text-red-600 text-sm">
                        <XCircle className="h-4 w-4 mr-1" />
                        Setup Failed
                      </span>
                    )}
                    {executionStatus === 'cancelled' && (
                      <span className="flex items-center text-amber-600 text-sm">
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancelled
                      </span>
                    )}
                    <Button onClick={handleClose}>
                      Close
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div />
                  <Button
                    variant="destructive"
                    onClick={handleCancelExecution}
                    disabled={!isExecuting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel Execution
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Export types and helpers for use in other components
export { initializeFormData, generateDefaultPassword, generateSubdomain, determineRegistrationMode };
export type { Restaurant, RegistrationStatus };
