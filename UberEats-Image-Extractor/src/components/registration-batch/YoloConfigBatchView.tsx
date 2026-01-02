import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  Loader2,
  Zap,
  Copy,
  Check,
  AlertCircle,
  Globe,
  Search,
  ExternalLink,
  Linkedin,
  Facebook,
  Save,
  Sparkles,
  Square,
  CheckSquare,
  Play,
} from 'lucide-react';

import {
  RegistrationJob,
  useCompleteRegistrationStep,
  useSaveRestaurantFromConfig,
} from '../../hooks/useRegistrationBatch';

import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';

// Import original tab components
import { AccountTab } from '../registration/tabs/AccountTab';
import { RestaurantTab } from '../registration/tabs/RestaurantTab';
import { MenuTab } from '../registration/tabs/MenuTab';
import { WebsiteTab } from '../registration/tabs/WebsiteTab';
import { PaymentTab } from '../registration/tabs/PaymentTab';
import { OnboardingTab } from '../registration/tabs/OnboardingTab';

// Import types and helpers from YoloModeDialog
import type { YoloModeFormData, Restaurant } from '../registration/YoloModeDialog';
import {
  initializeFormData,
  generateSubdomain,
} from '../registration/YoloModeDialog';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean restaurant name by removing bracketed sections (often location names from delivery platforms)
 * Example: "Jax Burger Shack (Northside Drive)" -> "Jax Burger Shack"
 */
function cleanRestaurantName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim() || name;
}

/**
 * Generate default password from restaurant name
 * - Removes bracketed sections first
 * - Capitalizes only first letter, rest lowercase
 * Example: "Jax Burger Shack (Northside Drive)" -> "Jaxburgershack789!"
 */
function generateDefaultPassword(restaurantName: string): string {
  const cleanedName = cleanRestaurantName(restaurantName);
  const alphaOnly = cleanedName.replace(/[^a-zA-Z]/g, '');
  if (!alphaOnly) return 'Restaurant789!';
  return alphaOnly.charAt(0).toUpperCase() + alphaOnly.slice(1).toLowerCase() + '789!';
}

/**
 * Generate a Google search URL
 */
function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Generate a Google AI mode search URL
 */
function googleAISearchUrl(query: string): string {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(query)}`;
}

/**
 * Convert RegistrationJobRestaurant to the Restaurant type expected by tabs
 */
function toRestaurantType(job: RegistrationJob): Restaurant {
  const r = job.restaurant;
  if (!r) {
    return {
      id: job.restaurant_id,
      name: job.restaurant_name || 'Unknown Restaurant',
    };
  }
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    subdomain: r.subdomain,
    email: r.email,
    phone: r.phone,
    address: r.address,
    city: r.city,
    opening_hours: r.opening_hours,
    cuisine: r.cuisine,
    contact_name: r.contact_name,
    contact_email: r.contact_email,
    contact_phone: r.contact_phone,
    theme: r.theme,
    primary_color: r.primary_color,
    secondary_color: r.secondary_color,
    tertiary_color: r.tertiary_color,
    accent_color: r.accent_color,
    background_color: r.background_color,
    logo_url: r.logo_url,
    logo_nobg_url: r.logo_nobg_url,
    logo_standard_url: r.logo_standard_url,
    logo_thermal_url: r.logo_thermal_url,
    logo_thermal_alt_url: r.logo_thermal_alt_url,
    logo_thermal_contrast_url: r.logo_thermal_contrast_url,
    logo_thermal_adaptive_url: r.logo_thermal_adaptive_url,
    logo_favicon_url: r.logo_favicon_url,
    website_og_image: r.website_og_image,
    ubereats_og_image: r.ubereats_og_image,
    doordash_og_image: r.doordash_og_image,
    facebook_cover_image: r.facebook_cover_image,
    user_email: r.user_email,
    user_password_hint: r.user_password_hint,
    stripe_connect_url: r.stripe_connect_url,
    menus: r.menus,
  };
}

/**
 * Initialize form data for a job, using cleaned password
 */
function initializeJobFormData(job: RegistrationJob): YoloModeFormData {
  const restaurant = toRestaurantType(job);
  const formData = initializeFormData(restaurant, null);

  // Override password with our cleaned version
  const cleanedPassword = generateDefaultPassword(restaurant.name);
  formData.account.password = restaurant.user_password_hint || cleanedPassword;
  formData.onboarding.userPassword = restaurant.user_password_hint || cleanedPassword;

  return formData;
}

// ============================================================================
// COMPONENT TYPES
// ============================================================================

interface YoloConfigBatchViewProps {
  batchId: string;
  jobs: RegistrationJob[];
  onComplete: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function YoloConfigBatchView({
  batchId,
  jobs,
  onComplete,
}: YoloConfigBatchViewProps) {
  const completeStepMutation = useCompleteRegistrationStep();
  const saveRestaurantMutation = useSaveRestaurantFromConfig();

  // Filter jobs that need Yolo configuration
  const pendingJobs = useMemo(() => {
    return jobs.filter((job) => {
      const step5 = job.steps?.find((s) => s.step_number === 5);
      return step5?.status === 'action_required';
    });
  }, [jobs]);

  // Form data state for each job
  const [formDataByJob, setFormDataByJob] = useState<Record<string, YoloModeFormData>>({});

  // Header image field type for Issue 16
  type HeaderImageField = 'website_og_image' | 'ubereats_og_image' | 'doordash_og_image' | 'facebook_cover_image';

  // Track if header image save is in progress
  const [isHeaderImageSaving, setIsHeaderImageSaving] = useState(false);

  // Currently selected job for editing
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Jobs selected for execution (checkboxes)
  const [selectedForExecution, setSelectedForExecution] = useState<Set<string>>(new Set());

  // Active tab within selected job
  const [activeTab, setActiveTab] = useState('account');

  // Copy indicator
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);

  // Toggle selection for execution
  const toggleJobSelection = useCallback((jobId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the job for editing
    setSelectedForExecution(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedForExecution(new Set());
  }, []);

  // Initialize form data when jobs change
  useEffect(() => {
    const initial: Record<string, YoloModeFormData> = {};
    pendingJobs.forEach((job) => {
      // Preserve existing form data if present
      if (formDataByJob[job.id]) {
        initial[job.id] = formDataByJob[job.id];
      } else {
        initial[job.id] = initializeJobFormData(job);
      }
    });
    setFormDataByJob(initial);

    // Select first job if none selected
    if (!selectedJobId && pendingJobs.length > 0) {
      setSelectedJobId(pendingJobs[0].id);
    }
  }, [pendingJobs]);

  // Get selected job
  const selectedJob = useMemo(() => {
    return pendingJobs.find((j) => j.id === selectedJobId) || null;
  }, [pendingJobs, selectedJobId]);

  // Get selected form data
  const selectedFormData = selectedJobId ? formDataByJob[selectedJobId] : null;

  // Update form data helper (matches tab component expectations)
  const updateFormData = useCallback(<
    S extends keyof YoloModeFormData,
    K extends keyof YoloModeFormData[S]
  >(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => {
    if (!selectedJobId) return;
    setFormDataByJob((prev) => {
      const currentFormData = prev[selectedJobId];
      if (!currentFormData) return prev;

      const updated = {
        ...currentFormData,
        [section]: {
          ...currentFormData[section],
          [key]: value,
        },
      };

      // Sync email between account and onboarding tabs when one is empty
      if (section === 'onboarding' && key === 'userEmail' && typeof value === 'string') {
        // If account email is empty, sync from onboarding
        if (!currentFormData.account.email) {
          updated.account = { ...updated.account, email: value };
        }
      } else if (section === 'account' && key === 'email' && typeof value === 'string') {
        // If onboarding email is empty, sync from account
        if (!currentFormData.onboarding.userEmail) {
          updated.onboarding = { ...updated.onboarding, userEmail: value };
        }
      }

      return {
        ...prev,
        [selectedJobId]: updated,
      };
    });
  }, [selectedJobId]);

  // Handle header image save - saves directly to database (Issue 16)
  const handleHeaderImageSave = useCallback(async (field: HeaderImageField, url: string) => {
    if (!selectedJobId) return;

    setIsHeaderImageSaving(true);
    try {
      await saveRestaurantMutation.mutateAsync({
        jobId: selectedJobId,
        updates: { [field]: url },
      });
    } finally {
      setIsHeaderImageSaving(false);
    }
  }, [selectedJobId, saveRestaurantMutation]);

  // Check if a job is configured (has password set)
  const isJobConfigured = useCallback((jobId: string) => {
    const formData = formDataByJob[jobId];
    return formData?.account?.password?.length > 0;
  }, [formDataByJob]);

  // Select all configured jobs for execution (must be after isJobConfigured)
  const selectAllConfigured = useCallback(() => {
    const configuredIds = pendingJobs
      .filter(job => isJobConfigured(job.id))
      .map(job => job.id);
    setSelectedForExecution(new Set(configuredIds));
  }, [pendingJobs, isJobConfigured]);

  // Count of selected jobs that are configured (must be after isJobConfigured)
  const selectedConfiguredCount = useMemo(() => {
    return Array.from(selectedForExecution).filter(id => isJobConfigured(id)).length;
  }, [selectedForExecution, isJobConfigured]);

  // Copy configuration from one job to all others
  const handleCopyToAll = (sourceJobId: string) => {
    const sourceConfig = formDataByJob[sourceJobId];
    if (!sourceConfig) return;

    const updates: Record<string, YoloModeFormData> = {};

    pendingJobs.forEach((job) => {
      if (job.id !== sourceJobId) {
        const restaurant = toRestaurantType(job);
        // Copy all settings but regenerate unique fields
        updates[job.id] = {
          ...sourceConfig,
          account: {
            ...sourceConfig.account,
            email: restaurant.user_email || restaurant.email || sourceConfig.account.email,
            password: generateDefaultPassword(restaurant.name),
            phone: restaurant.phone || sourceConfig.account.phone,
          },
          restaurant: {
            ...sourceConfig.restaurant,
            name: restaurant.name,
            phone: restaurant.phone || sourceConfig.restaurant.phone,
            address: restaurant.address || sourceConfig.restaurant.address,
            city: restaurant.city || sourceConfig.restaurant.city,
            subdomain: restaurant.subdomain || generateSubdomain(restaurant.name),
            opening_hours: restaurant.opening_hours || sourceConfig.restaurant.opening_hours,
          },
          menu: {
            ...sourceConfig.menu,
            selectedMenuId: restaurant.menus?.[0]?.id || '',
          },
          onboarding: {
            ...sourceConfig.onboarding,
            userName: restaurant.contact_name || sourceConfig.onboarding.userName,
            userEmail: restaurant.user_email || restaurant.email || sourceConfig.onboarding.userEmail,
            userPassword: generateDefaultPassword(restaurant.name),
          },
        };
      }
    });

    setFormDataByJob((prev) => ({ ...prev, ...updates }));
    setCopiedFrom(sourceJobId);
    setTimeout(() => setCopiedFrom(null), 2000);
  };

  // Submit configurations for selected jobs only
  const handleSubmit = async () => {
    // Build configurations object only for selected jobs
    const configurations: Record<string, YoloModeFormData> = {};
    const selectedJobIds = Array.from(selectedForExecution);

    selectedJobIds.forEach((jobId) => {
      if (formDataByJob[jobId]) {
        configurations[jobId] = formDataByJob[jobId];
      }
    });

    if (Object.keys(configurations).length === 0) {
      return; // Nothing selected
    }

    await completeStepMutation.mutateAsync({
      batchId,
      stepNumber: 5,
      data: {
        configurations,
        selectedJobIds, // Pass selected IDs to backend
      },
    });

    onComplete();
  };

  // Start a single restaurant immediately
  const handleStartSingle = async (jobId: string) => {
    const formData = formDataByJob[jobId];
    if (!formData) return;

    await completeStepMutation.mutateAsync({
      batchId,
      stepNumber: 5,
      data: {
        configurations: { [jobId]: formData },
        selectedJobIds: [jobId],
      },
    });

    onComplete();
  };

  // Extract saveable fields from form data to compare with restaurant
  const getSaveableFields = useCallback((formData: YoloModeFormData, restaurant: Restaurant | undefined) => {
    if (!restaurant) return {};

    return {
      email: formData.account.email,
      phone: formData.account.phone || formData.restaurant.phone,
      user_password_hint: formData.account.password,
      name: formData.restaurant.name,
      address: formData.restaurant.address,
      city: formData.restaurant.city,
      opening_hours: formData.restaurant.opening_hours,
      theme: formData.website.theme,
      cuisine: formData.website.cuisines,
      primary_color: formData.website.primaryColor,
      secondary_color: formData.website.secondaryColor,
      contact_name: formData.onboarding.userName,
      contact_email: formData.onboarding.userEmail,
      // Note: Header images (Issue 16) are saved directly via handleHeaderImageSave
    };
  }, []);

  // Check if there are unsaved changes for the selected job
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedJob || !selectedFormData) return false;
    const r = selectedJob.restaurant;
    if (!r) return false;

    // Compare form data with original restaurant data
    const formEmail = selectedFormData.account.email;
    const formPhone = selectedFormData.account.phone || selectedFormData.restaurant.phone;
    const formPassword = selectedFormData.account.password;
    const formName = selectedFormData.restaurant.name;
    const formAddress = selectedFormData.restaurant.address;
    const formCity = selectedFormData.restaurant.city;
    const formOpeningHours = selectedFormData.restaurant.opening_hours;
    const formTheme = selectedFormData.website.theme;
    const formCuisines = selectedFormData.website.cuisines;
    const formPrimaryColor = selectedFormData.website.primaryColor;
    const formSecondaryColor = selectedFormData.website.secondaryColor;
    const formContactName = selectedFormData.onboarding.userName;
    const formContactEmail = selectedFormData.onboarding.userEmail;

    // Check each field for changes
    if (formEmail !== (r.email || '')) return true;
    if (formPhone !== (r.phone || '')) return true;
    if (formPassword !== (r.user_password_hint || generateDefaultPassword(r.name))) return true;
    if (formName !== (r.name || '')) return true;
    if (formAddress !== (r.address || '')) return true;
    if (formCity !== (r.city || '')) return true;
    if (formTheme !== (r.theme || 'dark')) return true;
    if (formPrimaryColor !== (r.primary_color || '')) return true;
    if (formSecondaryColor !== (r.secondary_color || '')) return true;
    if (formContactName !== (r.contact_name || '')) return true;
    if (formContactEmail !== (r.contact_email || '')) return true;

    // Compare cuisines (array)
    const originalCuisines = Array.isArray(r.cuisine) ? r.cuisine : (r.cuisine ? [r.cuisine] : []);
    if (JSON.stringify(formCuisines) !== JSON.stringify(originalCuisines)) return true;

    // Compare opening_hours (JSONB object)
    if (JSON.stringify(formOpeningHours || {}) !== JSON.stringify(r.opening_hours || {})) return true;

    return false;
  }, [selectedJob, selectedFormData]);

  // Save restaurant data changes
  const handleSaveRestaurant = async () => {
    if (!selectedJobId || !selectedFormData || !selectedJob?.restaurant) return;

    const updates = getSaveableFields(selectedFormData, toRestaurantType(selectedJob));

    await saveRestaurantMutation.mutateAsync({
      jobId: selectedJobId,
      updates,
    });
  };

  // Check completion status
  const configuredCount = Object.keys(formDataByJob).filter(isJobConfigured).length;
  const allConfigured = configuredCount === pendingJobs.length && pendingJobs.length > 0;

  if (pendingJobs.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Step 5: Configure Yolo Mode</CardTitle>
          </div>
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            {configuredCount}/{pendingJobs.length} configured
          </Badge>
        </div>
        <CardDescription>
          Configure account setup settings for each restaurant. Select a restaurant on the left, then edit settings in the tabs.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-12 gap-4 min-h-[500px]">
          {/* Left sidebar: Restaurant list */}
          <div className="col-span-4 border rounded-lg bg-white overflow-hidden">
            <div className="p-2 border-b bg-muted/30 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Restaurants</span>
                  <span className="text-xs text-muted-foreground">
                    ({selectedForExecution.size} selected)
                  </span>
                </div>
                {selectedJob?.restaurant?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(`/restaurants/${selectedJob.restaurant?.id}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Details
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={selectAllConfigured}
                  title="Select all configured"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={deselectAll}
                  title="Deselect all"
                >
                  None
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[450px]">
              <div className="p-1">
                {pendingJobs.map((job) => {
                  const isSelected = job.id === selectedJobId;
                  const isConfigured = isJobConfigured(job.id);
                  const isChecked = selectedForExecution.has(job.id);
                  const restaurant = job.restaurant;

                  return (
                    <div
                      key={job.id}
                      className={`flex items-center gap-1 p-1 rounded-md mb-1 transition-colors ${
                        isSelected
                          ? 'bg-orange-100 border border-orange-300'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {/* Checkbox for selection */}
                      <button
                        onClick={(e) => toggleJobSelection(job.id, e)}
                        className="flex-shrink-0 p-1 hover:bg-muted rounded"
                        title={isChecked ? 'Deselect for execution' : 'Select for execution'}
                      >
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* Restaurant info - clickable to edit */}
                      <button
                        onClick={() => setSelectedJobId(job.id)}
                        className="flex-1 text-left p-1 min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {restaurant?.name || job.restaurant_name}
                            </div>
                            {restaurant?.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {restaurant.email}
                              </div>
                            )}
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            {isConfigured ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-orange-400" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Quick start button for single restaurant */}
                      {isConfigured && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-shrink-0 h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartSingle(job.id);
                          }}
                          disabled={completeStepMutation.isPending}
                          title="Start this restaurant only"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right panel: Tab editor */}
          <div className="col-span-8 border rounded-lg bg-white overflow-hidden">
            {selectedJob && selectedFormData ? (
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="h-full flex flex-col"
              >
                {/* Research Links Bar */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border-b text-xs">
                  <span className="text-muted-foreground font-medium mr-1">Research:</span>

                  {/* Website Link */}
                  {selectedJob.restaurant?.website_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => window.open(selectedJob.restaurant?.website_url, '_blank')}
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      Website
                    </Button>
                  )}

                  {/* Facebook Link */}
                  {selectedJob.restaurant?.facebook_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => window.open(selectedJob.restaurant?.facebook_url, '_blank')}
                    >
                      <Facebook className="h-3 w-3 mr-1" />
                      Facebook
                    </Button>
                  )}

                  {/* UberEats Link */}
                  {selectedJob?.restaurant?.ubereats_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => window.open(`${selectedJob.restaurant?.ubereats_url}`, '_blank')}
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
                      `${selectedJob.restaurant?.name || ''} ${selectedJob.restaurant?.city || ''} email address`
                    ), '_blank')}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    Email Search
                  </Button>

                  {/* LinkedIn search: Contact person */}
                  {selectedJob.restaurant?.contact_name && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => window.open(googleSearchUrl(
                        `${selectedJob.restaurant?.contact_name} ${selectedJob.restaurant?.name || ''} LinkedIn`
                      ), '_blank')}
                    >
                      <Linkedin className="h-3 w-3 mr-1" />
                      Contact LinkedIn
                    </Button>
                  )}

                  {/* Google search: Contact email */}
                  {selectedJob.restaurant?.contact_name && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => window.open(googleSearchUrl(
                        `${selectedJob.restaurant?.contact_name} ${selectedJob.restaurant?.name || ''} ${selectedJob.restaurant?.city || ''} email address`
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
                      `What is the name of the owner of ${selectedJob.restaurant?.name || ''} ${selectedJob.restaurant?.city || ''} and are there any publicly available email addresses or phone numbers for contacting the business or their owners?`
                    ), '_blank')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Search
                  </Button>

                  <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                </div>

                <div className="border-b px-2 pt-2 flex items-center justify-between">
                  <TabsList className="justify-start">
                    <TabsTrigger value="account" className="text-xs">Account</TabsTrigger>
                    <TabsTrigger value="restaurant" className="text-xs">Restaurant</TabsTrigger>
                    <TabsTrigger value="menu" className="text-xs">Menu</TabsTrigger>
                    <TabsTrigger value="website" className="text-xs">Website</TabsTrigger>
                    <TabsTrigger value="payment" className="text-xs">Payment</TabsTrigger>
                    <TabsTrigger value="onboarding" className="text-xs">Onboarding</TabsTrigger>
                  </TabsList>

                  {/* Save Changes Button */}
                  <Button
                    size="sm"
                    variant={hasUnsavedChanges ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    disabled={!hasUnsavedChanges || saveRestaurantMutation.isPending}
                    onClick={handleSaveRestaurant}
                  >
                    {saveRestaurantMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                      </>
                    )}
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4">
                    <TabsContent value="account" className="mt-0">
                      <AccountTab
                        formData={selectedFormData}
                        updateFormData={updateFormData}
                        registrationStatus={null}
                      />
                    </TabsContent>

                    <TabsContent value="restaurant" className="mt-0">
                      <RestaurantTab
                        formData={selectedFormData}
                        updateFormData={updateFormData}
                        registrationStatus={null}
                      />
                    </TabsContent>

                    <TabsContent value="menu" className="mt-0">
                      <MenuTab
                        formData={selectedFormData}
                        updateFormData={updateFormData}
                        restaurant={toRestaurantType(selectedJob)}
                      />
                    </TabsContent>

                    <TabsContent value="website" className="mt-0">
                      <WebsiteTab
                        formData={selectedFormData}
                        updateFormData={updateFormData}
                        restaurant={toRestaurantType(selectedJob)}
                        onHeaderImageSave={handleHeaderImageSave}
                        isHeaderImageSaving={isHeaderImageSaving}
                      />
                    </TabsContent>

                    <TabsContent value="payment" className="mt-0">
                      <PaymentTab
                        formData={selectedFormData}
                        updateFormData={updateFormData}
                      />
                    </TabsContent>

                    <TabsContent value="onboarding" className="mt-0">
                      <OnboardingTab
                        formData={selectedFormData}
                        updateFormData={updateFormData}
                      />
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a restaurant to configure
              </div>
            )}
          </div>
        </div>

        {/* Copy to all action */}
        {pendingJobs.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Copy className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Copy settings from:</span>
            <Select onValueChange={(value) => handleCopyToAll(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select restaurant..." />
              </SelectTrigger>
              <SelectContent>
                {pendingJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.restaurant?.name || job.restaurant_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {copiedFrom && (
              <Badge variant="default" className="bg-green-500">
                <Check className="h-3 w-3 mr-1" />
                Copied!
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              (Unique fields like password, subdomain regenerated per restaurant)
            </span>
          </div>
        )}

        {/* Validation/selection info */}
        {selectedConfiguredCount === 0 ? (
          <Alert variant="default" className="border-orange-300 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription>
              Select restaurants to start Yolo Mode. Use the checkboxes on the left, or click "All" to select all configured restaurants.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="default" className="border-green-300 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              {selectedConfiguredCount} restaurant(s) selected for execution.
              {pendingJobs.length - configuredCount > 0 && (
                <span className="text-muted-foreground ml-1">
                  ({pendingJobs.length - configuredCount} still need configuration)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Submit button */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            onClick={handleSubmit}
            disabled={selectedConfiguredCount === 0 || completeStepMutation.isPending}
            size="lg"
          >
            {completeStepMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting Yolo Mode...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Start Selected ({selectedConfiguredCount})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default YoloConfigBatchView;
