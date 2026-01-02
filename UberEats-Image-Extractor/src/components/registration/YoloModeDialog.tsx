import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
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
import {
  Loader2,
  Play,
  Save,
  X,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Globe,
  Search,
  ExternalLink,
  Linkedin,
  Facebook,
  Sparkles,
} from 'lucide-react';

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
  // Platform URLs for research links
  website_url?: string;
  ubereats_url?: string;
  facebook_url?: string;
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

// Header image field type for save functionality
type HeaderImageField = 'website_og_image' | 'ubereats_og_image' | 'doordash_og_image' | 'facebook_cover_image';

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
  /** Optional callback to refresh restaurant data after saving header image */
  onRefresh?: () => void;
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

// Header image sources in priority order: Website > Facebook > UberEats > DoorDash
const HEADER_IMAGE_PRIORITY = [
  'website_og_image',
  'facebook_cover_image',
  'ubereats_og_image',
  'doordash_og_image',
] as const;

// Get the best available header image source based on priority
function getDefaultHeaderImageSource(restaurant: Restaurant): { hasImage: boolean; source: string } {
  for (const source of HEADER_IMAGE_PRIORITY) {
    const value = restaurant[source as keyof Restaurant];
    if (value && typeof value === 'string' && value.length > 0) {
      return { hasImage: true, source };
    }
  }
  // Default to website_og_image if none available
  return { hasImage: false, source: 'website_og_image' };
}

// Google search URL helper
function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// Google AI mode search URL helper
function googleAISearchUrl(query: string): string {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(query)}`;
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

  // Get the best available header image
  const headerImage = getDefaultHeaderImageSource(restaurant);

  return {
    account: {
      registerNewUser: !registrationStatus?.hasAccount,
      email: restaurant.user_email || restaurant.email || restaurant.contact_email || '',
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
      configureHeader: headerImage.hasImage,
      headerImageSource: headerImage.source,
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
      itemLayout: 'card',
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
  onSave,
  onRefresh,
}: YoloModeDialogProps) {
  const { isFeatureEnabled } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [formData, setFormData] = useState<YoloModeFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'progress'>('form');
  const [isHeaderImageSaving, setIsHeaderImageSaving] = useState(false);

  // Execution hook
  const {
    isExecuting,
    executionStatus,
    currentPhase,
    stepResults,
    canResume,
    executeYoloMode,
    cancelExecution,
    resetExecution,
    checkAndResumeExecution,
    resumeExecution,
  } = useYoloModeExecution();

  // Check for in-progress or failed execution when dialog opens
  // This allows resuming progress view if user closed dialog during execution
  useEffect(() => {
    if (open && restaurant?.id) {
      checkAndResumeExecution(restaurant.id).then((hasExecution) => {
        if (hasExecution) {
          // Switch to progress view if there's an in-progress or failed (resumable) execution
          setViewMode('progress');
          console.log('[YoloModeDialog] Found existing execution, showing progress view');
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

      const updated = {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      };

      // Sync email between account and onboarding tabs when one is empty
      if (section === 'onboarding' && key === 'userEmail' && typeof value === 'string') {
        // If account email is empty, sync from onboarding
        if (!prev.account.email) {
          updated.account = { ...updated.account, email: value };
        }
      } else if (section === 'account' && key === 'email' && typeof value === 'string') {
        // If onboarding email is empty, sync from account
        if (!prev.onboarding.userEmail) {
          updated.onboarding = { ...updated.onboarding, userEmail: value };
        }
      }

      return updated;
    });
  }, []);

  // Handle header image save - saves directly to database (URL converted to base64 on backend)
  const handleHeaderImageSave = useCallback(async (field: HeaderImageField, url: string) => {
    if (!restaurant?.id) return;

    setIsHeaderImageSaving(true);
    try {
      await api.patch(`/restaurants/${restaurant.id}`, { [field]: url });
      // Refresh restaurant data to show the new image
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save header image:', error);
      throw error;
    } finally {
      setIsHeaderImageSaving(false);
    }
  }, [restaurant?.id, onRefresh]);

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
              {/* Research Links Bar */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border rounded-t-lg text-xs">
                <span className="text-muted-foreground font-medium mr-1">Research:</span>

                {/* Website Link */}
                {restaurant?.website_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(restaurant.website_url, '_blank')}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    Website
                  </Button>
                )}

                {/* Facebook Link */}
                {restaurant?.facebook_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(restaurant.facebook_url, '_blank')}
                  >
                    <Facebook className="h-3 w-3 mr-1" />
                    Facebook
                  </Button>
                )}

                {/* UberEats Link */}
                {restaurant?.ubereats_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(restaurant.ubereats_url, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    UberEats Page
                  </Button>
                )}

                {/* Google search: Restaurant email */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => window.open(googleSearchUrl(
                    `${restaurant?.name || ''} ${restaurant?.city || ''} email address`
                  ), '_blank')}
                >
                  <Search className="h-3 w-3 mr-1" />
                  Email Search
                </Button>

                {/* LinkedIn search: Contact person */}
                {restaurant?.contact_name && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(googleSearchUrl(
                      `${restaurant.contact_name} ${restaurant?.name || ''} LinkedIn`
                    ), '_blank')}
                  >
                    <Linkedin className="h-3 w-3 mr-1" />
                    Contact LinkedIn
                  </Button>
                )}

                {/* Google search: Contact email */}
                {restaurant?.contact_name && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(googleSearchUrl(
                      `${restaurant.contact_name} ${restaurant?.name || ''} ${restaurant?.city || ''} email address`
                    ), '_blank')}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    Contact Email
                  </Button>
                )}

                {/* AI Mode Search */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => window.open(googleAISearchUrl(
                    `What is the name of the owner of ${restaurant?.name || ''} ${restaurant?.city || ''} and are there any publicly available email addresses or phone numbers for contacting the business or their owners?`
                  ), '_blank')}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Search
                </Button>

                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </div>

              <TabsList size="full" className="grid w-full rounded-t-none" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
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
                    onHeaderImageSave={handleHeaderImageSave}
                    isHeaderImageSaving={isHeaderImageSaving}
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
                      <>
                        <span className="flex items-center text-red-600 text-sm">
                          <XCircle className="h-4 w-4 mr-1" />
                          Setup Failed
                        </span>
                        {canResume && restaurant?.id && (
                          <Button
                            variant="default"
                            onClick={() => resumeExecution(restaurant.id)}
                            disabled={isExecuting}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </Button>
                        )}
                      </>
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
