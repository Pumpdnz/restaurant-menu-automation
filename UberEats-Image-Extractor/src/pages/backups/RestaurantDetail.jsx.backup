import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from '../hooks/use-toast';
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  Clock, 
  MapPin,
  Instagram,
  Facebook,
  DollarSign,
  Edit,
  Save,
  X,
  ChevronLeft,
  Palette,
  User,
  CreditCard,
  Settings,
  CheckCircle,
  AlertCircle,
  Calendar,
  Link2,
  Hash,
  Search,
  RefreshCw,
  ExternalLink,
  FileSearch,
  SearchIcon,
  FileText,
  UserPlus,
  LogIn,
  History,
  Loader2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Upload,
  FileCheck,
  Code,
  XCircle,
  Database,
  Download,
  Plus,
  Workflow,
  Tag,
  Settings2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DateTimePicker } from '../components/ui/date-time-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { cn } from '../lib/utils';
import api from '../services/api';
import { SequenceProgressCard } from '../components/sequences/SequenceProgressCard';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import {
  useRestaurantSequences,
  usePauseSequence,
  useResumeSequence,
  useCancelSequence,
  useFinishSequence,
  useDeleteSequenceInstance
} from '../hooks/useSequences';
import { QualificationForm } from '../components/demo-meeting/QualificationForm';
import { QualificationDataDisplay } from '../components/demo-meeting/QualificationDataDisplay';
import { RestaurantTasksList } from '../components/tasks/RestaurantTasksList';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';
import { useAuth } from '../context/AuthContext';

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isFeatureEnabled } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const [extractingLogo, setExtractingLogo] = useState(false);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [logoCandidates, setLogoCandidates] = useState([]);
  const [selectedLogoCandidate, setSelectedLogoCandidate] = useState(null);
  const [selectedAdditionalImages, setSelectedAdditionalImages] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [processLogoDialogOpen, setProcessLogoDialogOpen] = useState(false);
  const [processMode, setProcessMode] = useState('manual'); // 'extract', 'manual', 'reprocess', 'replace'
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [versionsToUpdate, setVersionsToUpdate] = useState({
    logo_url: false,
    logo_nobg_url: true,
    logo_standard_url: false,
    logo_thermal_url: true,
    logo_thermal_alt_url: true,
    logo_thermal_contrast_url: false,
    logo_thermal_adaptive_url: false,
    logo_favicon_url: true
  });

  const [colorsToUpdate, setColorsToUpdate] = useState({
    primary_color: true,
    secondary_color: true,
    tertiary_color: true,
    accent_color: true,
    background_color: true,
    theme: true
  });

  // Branding extraction states (Firecrawl branding format)
  const [extractingBranding, setExtractingBranding] = useState(false);
  const [brandingSourceUrl, setBrandingSourceUrl] = useState('');
  const [useFirecrawlBranding, setUseFirecrawlBranding] = useState(false);

  // Platform extraction states
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionConfig, setExtractionConfig] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionMode, setExtractionMode] = useState('standard'); // 'standard' or 'premium'
  const [extractOptionSets, setExtractOptionSets] = useState(true);
  const [validateImages, setValidateImages] = useState(true);

  // Sequence states
  const [startSequenceModalOpen, setStartSequenceModalOpen] = useState(false);

  // Task modal states
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [duplicateTaskId, setDuplicateTaskId] = useState(null);
  const [followUpTaskId, setFollowUpTaskId] = useState(null);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);

  // Fetch restaurant sequences (only when tasksAndSequences feature is enabled)
  const { data: restaurantSequences, isLoading: sequencesLoading, refetch: refetchSequences } = useRestaurantSequences(id, {
    enabled: isFeatureEnabled('tasksAndSequences')
  });

  // Sequence action mutations
  const pauseSequenceMutation = usePauseSequence();
  const resumeSequenceMutation = useResumeSequence();
  const cancelSequenceMutation = useCancelSequence();
  const finishSequenceMutation = useFinishSequence();
  const deleteSequenceMutation = useDeleteSequenceInstance();

  // New states for URL search and details extraction
  const [searchingForUrl, setSearchingForUrl] = useState({});
  const [extractingDetails, setExtractingDetails] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsExtractionConfig, setDetailsExtractionConfig] = useState(null);
  const [selectedDetailFields, setSelectedDetailFields] = useState([]);
  
  // Registration states
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [loadingRegistrationStatus, setLoadingRegistrationStatus] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [registrationType, setRegistrationType] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registrationLogs, setRegistrationLogs] = useState([]);
  const [showRegistrationLogs, setShowRegistrationLogs] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // CSV Upload states
  const [csvFile, setCsvFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Item Tags states
  const [isAddingTags, setIsAddingTags] = useState(false);
  const [tagsStatus, setTagsStatus] = useState(null);

  // Option Sets states
  const [selectedMenuForOptionSets, setSelectedMenuForOptionSets] = useState('');
  const [isAddingOptionSets, setIsAddingOptionSets] = useState(false);
  const [optionSetsStatus, setOptionSetsStatus] = useState(null);

  // Website Customization states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [codeGenerated, setCodeGenerated] = useState(false);
  const [customizationStatus, setCustomizationStatus] = useState(null);
  const [generatedFilePaths, setGeneratedFilePaths] = useState(null);
  const [customizationMode, setCustomizationMode] = useState('generate'); // 'generate' or 'existing'
  const [existingHeadPath, setExistingHeadPath] = useState('');
  const [existingBodyPath, setExistingBodyPath] = useState('');
  const [filesValidated, setFilesValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  // Payment and Services states
  const [isConfiguringPayments, setIsConfiguringPayments] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [isConfiguringServices, setIsConfiguringServices] = useState(false);
  const [servicesStatus, setServicesStatus] = useState(null);
  const [includeConnectLink, setIncludeConnectLink] = useState(false); // Default to no-link version
  
  // Onboarding User Management states
  const [isCreatingOnboardingUser, setIsCreatingOnboardingUser] = useState(false);
  const [onboardingUserStatus, setOnboardingUserStatus] = useState(null);
  const [isUpdatingOnboarding, setIsUpdatingOnboarding] = useState(false);
  const [onboardingUpdateStatus, setOnboardingUpdateStatus] = useState(null);
  const [onboardingUserEmail, setOnboardingUserEmail] = useState('');
  const [onboardingUserName, setOnboardingUserName] = useState('');
  const [onboardingUserPassword, setOnboardingUserPassword] = useState('');
  const [onboardingStripeConnectUrl, setOnboardingStripeConnectUrl] = useState('');

  // Workflow Notes Popover states
  const [notesPopoverOpen, setNotesPopoverOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Finalise Setup states
  const [isSettingUpSystemSettings, setIsSettingUpSystemSettings] = useState(false);
  const [systemSettingsStatus, setSystemSettingsStatus] = useState(null);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [isConfiguringUberIntegration, setIsConfiguringUberIntegration] = useState(false);
  const [uberIntegrationStatus, setUberIntegrationStatus] = useState(null);
  const [receiptLogoVersion, setReceiptLogoVersion] = useState('logo_thermal_url');

  // Setup completion tracking
  const [setupCompletionStatus, setSetupCompletionStatus] = useState({
    system_settings: false,
    api_key: false,
    uber_integration: false
  });
  const [loadingSetupStatus, setLoadingSetupStatus] = useState(false);
  
  const isNewRestaurant = id === 'new';
  
  // Platform capabilities configuration
  const PLATFORM_CAPABILITIES = {
    ubereats: { 
      canExtractMenu: true, 
      canExtractDetails: true,
      detailFields: ['address', 'hours'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours' }
    },
    doordash: { 
      canExtractMenu: true, 
      canExtractDetails: true,
      detailFields: ['hours'],
      fieldLabels: { hours: 'Opening Hours' }
    },
    website: { 
      canExtractMenu: true, 
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    },
    instagram: { 
      canExtractMenu: false, 
      canExtractDetails: false,
      detailFields: [],
      fieldLabels: {}
    },
    facebook: { 
      canExtractMenu: false, 
      canExtractDetails: false,
      detailFields: [],
      fieldLabels: {}
    },
    ordermeal: {
      canExtractMenu: true,
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    },
    meandyou: {
      canExtractMenu: true,
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    },
    mobi2go: {
      canExtractMenu: true,
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    },
    delivereasy: {
      canExtractMenu: true,
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    },
    nextorder: {
      canExtractMenu: true,
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    },
    foodhub: {
      canExtractMenu: true,
      canExtractDetails: true,
      detailFields: ['address', 'hours', 'phone'],
      fieldLabels: { address: 'Physical Address', hours: 'Opening Hours', phone: 'Phone Number' }
    }
  };

  // Auto-populate onboarding fields when restaurant data is loaded
  useEffect(() => {
    if (restaurant && !isNewRestaurant) {
      // Auto-populate from contact_name and contact_email if available
      if (restaurant.contact_name) {
        setOnboardingUserName(restaurant.contact_name);
      }
      if (restaurant.contact_email) {
        setOnboardingUserEmail(restaurant.contact_email);
      }
      // Auto-populate Stripe Connect URL if available
      if (restaurant.stripe_connect_url) {
        setOnboardingStripeConnectUrl(restaurant.stripe_connect_url);
      }
    }
  }, [restaurant, isNewRestaurant]);

  // Fetch feature flag for branding extraction on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/config/features');
        setUseFirecrawlBranding(response.data.useFirecrawlBrandingFormat || false);
      } catch (err) {
        console.log('Feature config not available, using defaults');
      }
    };
    fetchConfig();
  }, []);

  // Set default branding source URL when restaurant loads
  useEffect(() => {
    if (restaurant?.website_url && !brandingSourceUrl) {
      setBrandingSourceUrl(restaurant.website_url);
    }
  }, [restaurant?.website_url]);

  useEffect(() => {
    if (isNewRestaurant) {
      // Initialize empty restaurant for creation
      const emptyRestaurant = {
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        organisation_name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        opening_hours: [],
        cuisine: [],
        onboarding_status: 'lead'
      };
      setRestaurant(emptyRestaurant);
      setEditedData(emptyRestaurant);
      setIsEditing(true);
      setLoading(false);
    } else {
      fetchRestaurantDetails();
    }
  }, [id]);

  const fetchRestaurantDetails = async () => {
    try {
      const response = await api.get(`/restaurants/${id}/details`);
      const restaurantData = response.data.restaurant;
      setRestaurant(restaurantData);
      // Data is already in 24-hour format from database
      setEditedData(restaurantData);
      setError(null);
      
      // Fetch registration status if not a new restaurant
      if (!isNewRestaurant) {
        fetchRegistrationStatus();
        fetchSetupCompletionStatus();
      }
    } catch (err) {
      console.error('Failed to fetch restaurant details:', err);
      setError('Failed to load restaurant details');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrationStatus = async () => {
    setLoadingRegistrationStatus(true);
    try {
      const response = await api.get(`/registration/status/${id}`);
      // Map pumpdRestaurant to restaurant for consistency
      const data = {
        ...response.data,
        restaurant: response.data.pumpdRestaurant || response.data.restaurant
      };
      setRegistrationStatus(data);
    } catch (err) {
      console.error('Failed to fetch registration status:', err);
      // Don't show error for registration status as it's not critical
    } finally {
      setLoadingRegistrationStatus(false);
    }
  };

  const fetchSetupCompletionStatus = async () => {
    setLoadingSetupStatus(true);
    try {
      const response = await api.get(`/registration/setup-status/${id}`);
      if (response.data.success && response.data.status) {
        setSetupCompletionStatus(response.data.status);

        // Also update individual status states for UI consistency
        if (response.data.status.system_settings) {
          setSystemSettingsStatus({ success: true });
        }
        if (response.data.status.api_key) {
          setApiKeyStatus({ success: true });
        }
        if (response.data.status.uber_integration) {
          setUberIntegrationStatus({ success: true });
        }
      }
    } catch (err) {
      console.error('Failed to fetch setup completion status:', err);
      // Don't show error for setup status as it's not critical
    } finally {
      setLoadingSetupStatus(false);
    }
  };

  const fetchRegistrationLogs = async () => {
    try {
      const response = await api.get(`/registration/logs/${id}`);
      setRegistrationLogs(response.data.logs || []);
      setShowRegistrationLogs(true);
    } catch (err) {
      console.error('Failed to fetch registration logs:', err);
      toast({
        title: "Error",
        description: "Failed to fetch registration logs",
        variant: "destructive"
      });
    }
  };

  // Sequence action handlers
  const handlePauseSequence = async (instanceId) => {
    await pauseSequenceMutation.mutateAsync(instanceId);
    refetchSequences();
  };

  const handleResumeSequence = async (instanceId) => {
    await resumeSequenceMutation.mutateAsync(instanceId);
    refetchSequences();
  };

  const handleCancelSequence = async (instanceId) => {
    if (window.confirm('Are you sure you want to cancel this sequence? This will delete all pending tasks.')) {
      await cancelSequenceMutation.mutateAsync(instanceId);
      refetchSequences();
    }
  };

  const handleFinishSequence = async (instanceId, option) => {
    if (!window.confirm('Are you sure you want to finish this sequence? Active tasks will be marked complete and pending tasks will be cancelled.')) {
      return;
    }

    await finishSequenceMutation.mutateAsync(instanceId);
    refetchSequences();

    // Handle the different finish options
    if (option === 'finish-followup') {
      // Find the last active task from the sequence to use as follow-up source
      const sequence = restaurantSequences?.data?.find(s => s.id === instanceId);
      const lastActiveTask = sequence?.tasks?.find(t => t.status === 'active');

      if (lastActiveTask) {
        setFollowUpTaskId(lastActiveTask.id);
      } else {
        // If no active task found, just open the create task modal
        setTaskModalOpen(true);
      }
    } else if (option === 'finish-start-new') {
      // Open the start sequence modal
      setStartSequenceModalOpen(true);
    }
    // For 'finish-only', do nothing extra
  };

  const handleDeleteSequence = async (instanceId) => {
    if (window.confirm('Are you sure you want to delete this sequence? This action cannot be undone.')) {
      await deleteSequenceMutation.mutateAsync(instanceId);
      refetchSequences();
    }
  };

  const handleRegistration = async () => {
    if (!registrationType) {
      toast({
        title: "Error",
        description: "Please select a registration type",
        variant: "destructive"
      });
      return;
    }

    // Validate email and password for all registration types
    if (!registrationEmail || !registrationPassword) {
      toast({
        title: "Error",
        description: "Please enter email and password",
        variant: "destructive"
      });
      return;
    }

    setRegistering(true);
    try {
      // Handle account-only registration
      if (registrationType === 'account_only') {
        const accountData = {
          restaurantId: id,
          email: registrationEmail || restaurant.email,
          password: registrationPassword || (() => {
            const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
          })(),
          phone: restaurant.phone || '',
          restaurantName: restaurant.name
        };

        const response = await api.post('/registration/register-account', accountData);
        
        toast({
          title: "Success",
          description: response.data.message || "Account registered successfully"
        });
      } else {
        // Handle restaurant registration (with or without account creation)
        const registrationData = {
          restaurantId: id,
          registrationType,
          restaurantName: restaurant.name,
          email: registrationEmail || restaurant.email,
          password: registrationPassword || (() => {
            const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
          })(),
          address: restaurant.address,
          phone: restaurant.phone,
          hours: restaurant.opening_hours,
          city: restaurant.city,
          cuisine: restaurant.cuisine
        };

        const response = await api.post('/registration/register-restaurant', registrationData);
        
        toast({
          title: "Success",
          description: response.data.message || "Registration initiated successfully"
        });
      }

      setRegistrationDialogOpen(false);
      setRegistrationType('');
      setRegistrationEmail('');
      setRegistrationPassword('');
      setShowPassword(false);
      
      // Refresh registration status
      fetchRegistrationStatus();
    } catch (err) {
      console.error('Registration failed:', err);
      toast({
        title: "Error",
        description: err.response?.data?.error || "Registration failed",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  };

  // CSV Upload handlers
  const handleCsvFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setCsvFile(file);
        setUploadError(null);
      } else {
        setCsvFile(null);
        setUploadError('Please select a valid CSV file');
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive"
        });
      }
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file first",
        variant: "destructive"
      });
      return;
    }

    if (!registrationStatus?.account || registrationStatus.account.registration_status !== 'completed') {
      toast({
        title: "Error",
        description: "Account registration must be completed before uploading menu",
        variant: "destructive"
      });
      return;
    }

    if (!registrationStatus?.restaurant || registrationStatus.restaurant.registration_status !== 'completed') {
      toast({
        title: "Error",
        description: "Restaurant registration must be completed before uploading menu",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append('csvFile', csvFile);
    formData.append('restaurantId', id);

    try {
      const response = await api.post('/registration/upload-csv-menu', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setUploadStatus('success');
        setCsvFile(null);
        // Reset file input
        const fileInput = document.getElementById('csv-file-input');
        if (fileInput) fileInput.value = '';
        
        toast({
          title: "Success",
          description: "Menu uploaded successfully",
        });
      } else {
        setUploadStatus('error');
        setUploadError(response.data.error || 'Upload failed');
        toast({
          title: "Upload Failed",
          description: response.data.error || 'Failed to upload menu',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      setUploadStatus('error');
      setUploadError(error.response?.data?.error || error.message);
      toast({
        title: "Upload Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Item Tags handler
  const handleAddItemTags = async () => {
    if (!registrationStatus?.account || registrationStatus.account.registration_status !== 'completed') {
      toast({
        title: "Error",
        description: "Account registration must be completed before adding tags",
        variant: "destructive"
      });
      return;
    }

    if (!registrationStatus?.restaurant || registrationStatus.restaurant.registration_status !== 'completed') {
      toast({
        title: "Error",
        description: "Restaurant registration must be completed before adding tags",
        variant: "destructive"
      });
      return;
    }

    setIsAddingTags(true);
    setTagsStatus(null);

    try {
      const response = await api.post('/registration/add-item-tags', {
        restaurantId: id
      });

      setTagsStatus(response.data);

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Item tags configured successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Tag configuration completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setTagsStatus({
        success: false,
        error: errorMessage
      });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsAddingTags(false);
    }
  };

  // Option Sets handler
  const handleAddOptionSets = async () => {
    if (!selectedMenuForOptionSets) {
      toast({
        title: "Error",
        description: "Please select a menu first",
        variant: "destructive"
      });
      return;
    }

    if (!registrationStatus?.account || registrationStatus.account.registration_status !== 'completed') {
      toast({
        title: "Error",
        description: "Account registration must be completed before adding option sets",
        variant: "destructive"
      });
      return;
    }

    if (!registrationStatus?.restaurant || registrationStatus.restaurant.registration_status !== 'completed') {
      toast({
        title: "Error",
        description: "Restaurant registration must be completed before adding option sets",
        variant: "destructive"
      });
      return;
    }

    setIsAddingOptionSets(true);
    setOptionSetsStatus(null);

    try {
      const response = await api.post('/registration/add-option-sets', {
        restaurantId: id,
        menuId: selectedMenuForOptionSets
      });

      setOptionSetsStatus(response.data);

      if (response.data.success) {
        toast({
          title: "Success",
          description: `Option sets configured successfully (${response.data.summary?.created || 0} created)`,
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Option sets configuration completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setOptionSetsStatus({
        success: false,
        error: errorMessage
      });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsAddingOptionSets(false);
    }
  };

  // Website Customization handlers
  const handleGenerateCodeInjections = async () => {
    setIsGenerating(true);
    setCustomizationStatus(null);
    
    try {
      const response = await api.post('/registration/generate-code-injections', {
        restaurantId: id
      });
      
      if (response.data.success) {
        setCodeGenerated(true);
        setGeneratedFilePaths(response.data.filePaths);
        setCustomizationStatus({
          success: true,
          message: 'Code injections generated successfully'
        });
        toast({
          title: "Success",
          description: "Code injections generated successfully",
        });
      } else {
        setCustomizationStatus({
          success: false,
          message: response.data.error || 'Failed to generate code injections'
        });
        toast({
          title: "Generation Failed",
          description: response.data.error || 'Failed to generate code injections',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Code generation error:', error);
      setCustomizationStatus({
        success: false,
        message: error.response?.data?.error || error.message
      });
      toast({
        title: "Generation Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Validate existing file paths
  const handleValidateFiles = async () => {
    if (!existingHeadPath || !existingBodyPath) {
      setCustomizationStatus({
        success: false,
        message: 'Please enter both head and body file paths'
      });
      toast({
        title: "Error",
        description: "Please enter both head and body file paths",
        variant: "destructive"
      });
      return;
    }
    
    setIsValidating(true);
    setCustomizationStatus(null);
    setFilesValidated(false);
    
    try {
      const response = await api.post('/registration/validate-files', {
        headPath: existingHeadPath,
        bodyPath: existingBodyPath
      });
      
      if (response.data.valid) {
        setFilesValidated(true);
        setGeneratedFilePaths({
          headInjection: existingHeadPath,
          bodyInjection: existingBodyPath,
          configuration: null // No configuration file for existing files
        });
        setCustomizationStatus({
          success: true,
          message: 'Files validated successfully'
        });
        toast({
          title: "Success",
          description: "Files validated and ready for configuration",
        });
      } else {
        setCustomizationStatus({
          success: false,
          message: response.data.error || 'File validation failed'
        });
        toast({
          title: "Validation Failed",
          description: response.data.error || 'One or more files could not be found',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('File validation error:', error);
      setCustomizationStatus({
        success: false,
        message: error.response?.data?.error || error.message
      });
      toast({
        title: "Validation Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfigureWebsite = async () => {
    // Check based on mode
    if (customizationMode === 'generate' && !generatedFilePaths) {
      setCustomizationStatus({
        success: false,
        message: 'Please generate code injections first'
      });
      toast({
        title: "Error",
        description: "Please generate code injections first",
        variant: "destructive"
      });
      return;
    }
    
    if (customizationMode === 'existing' && !filesValidated) {
      setCustomizationStatus({
        success: false,
        message: 'Please validate your files first'
      });
      toast({
        title: "Error",
        description: "Please validate your files first",
        variant: "destructive"
      });
      return;
    }
    
    setIsConfiguring(true);
    setCustomizationStatus(null);
    
    try {
      const response = await api.post('/registration/configure-website', {
        restaurantId: id,
        filePaths: generatedFilePaths
      });
      
      setCustomizationStatus({
        success: response.data.success,
        message: response.data.success 
          ? 'Website configured successfully' 
          : response.data.error || 'Configuration failed'
      });
      
      toast({
        title: response.data.success ? "Success" : "Configuration Failed",
        description: response.data.success 
          ? "Website configured successfully" 
          : response.data.error || 'Configuration failed',
        variant: response.data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Website configuration error:', error);
      setCustomizationStatus({
        success: false,
        message: error.response?.data?.error || error.message
      });
      toast({
        title: "Configuration Error",
        description: error.response?.data?.error || error.message,
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };
  
  // Reset states when switching modes
  const handleModeChange = (newMode) => {
    setCustomizationMode(newMode);
    setCustomizationStatus(null);
    if (newMode === 'generate') {
      setFilesValidated(false);
      setExistingHeadPath('');
      setExistingBodyPath('');
    } else {
      setCodeGenerated(false);
      setGeneratedFilePaths(null);
    }
  };

  // Payment and Services handlers
  const handleSetupStripePayments = async () => {
    setIsConfiguringPayments(true);
    setPaymentStatus(null);
    
    try {
      const response = await api.post('/registration/configure-payment', {
        restaurantId: id,
        includeConnectLink
      });
      
      setPaymentStatus(response.data);
      
      // If successful and we have a Stripe URL, refresh restaurant data to show it
      if (response.data.success && response.data.stripeConnectUrl) {
        await fetchRestaurant();
        toast({
          title: "Success",
          description: "Stripe payments configured. Please complete the Stripe Connect process.",
        });
      } else if (response.data.success) {
        toast({
          title: "Success",
          description: "Stripe payments configured successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Configuration completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setPaymentStatus({ 
        success: false, 
        error: errorMessage 
      });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsConfiguringPayments(false);
    }
  };

  const handleConfigureServices = async () => {
    setIsConfiguringServices(true);
    setServicesStatus(null);
    
    try {
      const response = await api.post('/registration/configure-services', {
        restaurantId: id
      });
      
      setServicesStatus(response.data);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Services configured successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Configuration completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setServicesStatus({ 
        success: false, 
        error: errorMessage 
      });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsConfiguringServices(false);
    }
  };

  // Onboarding User Management handlers
  const generateDefaultPassword = (restaurantName) => {
    // Generate password following the established convention: "Restaurantname789!"
    const cleanName = restaurantName.replace(/[^a-zA-Z]/g, '');
    const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
    return `${capitalizedName}789!`;
  };

  const handleCreateOnboardingUser = async () => {
    setIsCreatingOnboardingUser(true);
    setOnboardingUserStatus(null);
    
    try {
      const response = await api.post('/registration/create-onboarding-user', {
        restaurantId: id,
        userName: onboardingUserName,
        userEmail: onboardingUserEmail,
        userPassword: onboardingUserPassword || generateDefaultPassword(restaurant?.name || 'Restaurant')
      });
      
      setOnboardingUserStatus(response.data);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Onboarding user created successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "User creation completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setOnboardingUserStatus({ 
        success: false, 
        error: errorMessage 
      });
      toast({
        title: "Error",
        description: errorMessage || "Failed to create onboarding user",
        variant: "destructive"
      });
    } finally {
      setIsCreatingOnboardingUser(false);
    }
  };

  const handleUpdateOnboardingRecord = async () => {
    setIsUpdatingOnboarding(true);
    setOnboardingUpdateStatus(null);

    try {
      const response = await api.post('/registration/update-onboarding-record', {
        restaurantId: id,
        userEmail: onboardingUserEmail,
        updates: {
          contactPerson: onboardingUserName,
          stripeConnectUrl: onboardingStripeConnectUrl || null
        }
      });
      
      setOnboardingUpdateStatus(response.data);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Onboarding record updated successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Update completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setOnboardingUpdateStatus({ 
        success: false, 
        error: errorMessage 
      });
      toast({
        title: "Error",
        description: errorMessage || "Failed to update onboarding record",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingOnboarding(false);
    }
  };

  // Finalise Setup Handlers
  const handleSetupSystemSettings = async () => {
    setIsSettingUpSystemSettings(true);
    setSystemSettingsStatus(null);

    try {
      const response = await api.post('/registration/setup-system-settings', {
        restaurantId: restaurant?.id || id,
        receiptLogoVersion: receiptLogoVersion
      });

      setSystemSettingsStatus(response.data);

      if (response.data.success) {
        // Update completion status
        setSetupCompletionStatus(prev => ({
          ...prev,
          system_settings: true
        }));
        toast({
          title: "Success",
          description: "System settings configured successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Configuration completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setSystemSettingsStatus({
        success: false,
        error: errorMessage
      });
      toast({
        title: "Error",
        description: errorMessage || "Failed to configure system settings",
        variant: "destructive"
      });
    } finally {
      setIsSettingUpSystemSettings(false);
    }
  };

  const handleCreateApiKey = async () => {
    setIsCreatingApiKey(true);
    setApiKeyStatus(null);

    try {
      const response = await api.post('/registration/create-api-key', {
        restaurantId: restaurant?.id || id
      });

      setApiKeyStatus(response.data);

      if (response.data.success) {
        // Update completion status
        setSetupCompletionStatus(prev => ({
          ...prev,
          api_key: true
        }));
        toast({
          title: "Success",
          description: "API key created successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "API key creation completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setApiKeyStatus({
        success: false,
        error: errorMessage
      });
      toast({
        title: "Error",
        description: errorMessage || "Failed to create API key",
        variant: "destructive"
      });
    } finally {
      setIsCreatingApiKey(false);
    }
  };

  const handleConfigureUberIntegration = async () => {
    setIsConfiguringUberIntegration(true);
    setUberIntegrationStatus(null);

    try {
      const response = await api.post('/registration/configure-uber-integration', {
        restaurantId: restaurant?.id || id
      });

      setUberIntegrationStatus(response.data);

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Uber integration configured successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: response.data.message || "Configuration completed with warnings",
          variant: "warning"
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setUberIntegrationStatus({
        success: false,
        error: errorMessage
      });
      toast({
        title: "Error",
        description: errorMessage || "Failed to configure Uber integration",
        variant: "destructive"
      });
    } finally {
      setIsConfiguringUberIntegration(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let dataToSave = {};
      
      if (isNewRestaurant) {
        // For new restaurants, send all data
        dataToSave = { ...editedData };
      } else {
        // For updates, only send changed fields
        Object.keys(editedData).forEach(key => {
          // Compare with original restaurant data
          // Use JSON.stringify for deep comparison of objects/arrays
          const originalValue = restaurant[key];
          const editedValue = editedData[key];
          
          // Check if value has changed
          let hasChanged = false;
          
          if (originalValue === undefined && editedValue !== undefined) {
            // New field added
            hasChanged = true;
          } else if (typeof originalValue === 'object' && originalValue !== null) {
            // For objects and arrays, do deep comparison
            hasChanged = JSON.stringify(originalValue) !== JSON.stringify(editedValue);
          } else {
            // For primitive values
            hasChanged = originalValue !== editedValue;
          }
          
          // Only include changed fields
          if (hasChanged) {
            // Special handling for base64 logo fields - skip if they're base64
            const logoFields = [
              'logo_url', 'logo_nobg_url', 'logo_standard_url', 
              'logo_thermal_url', 'logo_thermal_alt_url',
              'logo_thermal_contrast_url', 'logo_thermal_adaptive_url',
              'logo_favicon_url'
            ];
            
            // Skip base64 data unless it's actually a new/different value
            if (logoFields.includes(key) && editedValue?.startsWith('data:')) {
              // Only skip if it's the same base64 data
              if (originalValue !== editedValue) {
                console.log(`Including changed logo field: ${key}`);
                dataToSave[key] = editedValue;
              }
            } else {
              dataToSave[key] = editedValue;
            }
          }
        });
        
        console.log('Fields being updated:', Object.keys(dataToSave));
      }
      
      // Only proceed if there are changes to save
      if (!isNewRestaurant && Object.keys(dataToSave).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }
      
      // Save data with 24-hour format opening hours
      let response;
      if (isNewRestaurant) {
        // Create new restaurant
        response = await api.post('/restaurants', dataToSave);
        const newRestaurantId = response.data.restaurant.id;
        setSuccess('Restaurant created successfully');
        // Navigate to the new restaurant's detail page
        setTimeout(() => {
          navigate(`/restaurants/${newRestaurantId}`);
        }, 1500);
      } else {
        // Update existing restaurant with only changed fields
        response = await api.patch(`/restaurants/${id}/workflow`, dataToSave);
        setRestaurant(response.data.restaurant);
        setIsEditing(false);
        setSuccess('Restaurant details updated successfully');
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Failed to save restaurant:', err);
      setError(err.response?.data?.error || `Failed to ${isNewRestaurant ? 'create' : 'update'} restaurant`);
    } finally {
      setSaving(false);
    }
  };

  const convertTo24Hour = (time12h) => {
    if (!time12h) return '';
    
    // Normalize the input by trimming and converting to uppercase for matching
    const normalizedTime = time12h.trim();
    
    // Already in 24-hour format (HH:MM with no AM/PM)
    if (/^\d{1,2}:\d{2}$/.test(normalizedTime) && !normalizedTime.match(/am|pm/i)) {
      return normalizedTime;
    }
    
    // Parse various 12-hour formats
    // Matches: "5:00 pm", "5:00pm", "5:00 PM", "5:00PM", "5 pm", "5PM", etc.
    const match = normalizedTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (!match) {
      console.warn(`Could not parse time: ${time12h}`);
      return time12h; // Return original if we can't parse it
    }
    
    let hours = parseInt(match[1]);
    const minutes = match[2] || '00';
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const convertTo12Hour = (time24h) => {
    if (!time24h) return '';
    
    // Already in 12-hour format
    if (time24h.match(/AM|PM/i)) {
      return time24h;
    }
    
    const [hours24, minutes = '00'] = time24h.split(':');
    let hours = parseInt(hours24);
    const period = hours >= 12 ? 'PM' : 'AM';
    
    if (hours > 12) {
      hours -= 12;
    } else if (hours === 0) {
      hours = 12;
    }
    
    return `${hours}:${minutes.padStart(2, '0')} ${period}`;
  };

  const normalizeOpeningHours = (hours) => {
    if (!hours) return hours;
    
    if (Array.isArray(hours)) {
      return hours.map(slot => ({
        ...slot,
        hours: {
          open: convertTo24Hour(slot.hours.open),
          close: convertTo24Hour(slot.hours.close)
        }
      }));
    } else if (typeof hours === 'object') {
      const normalized = {};
      Object.keys(hours).forEach(day => {
        if (hours[day]) {
          normalized[day] = {
            open: convertTo24Hour(hours[day].open),
            close: convertTo24Hour(hours[day].close)
          };
        }
      });
      return normalized;
    }
    
    return hours;
  };

  const handleCancel = () => {
    if (isNewRestaurant) {
      navigate('/restaurants');
    } else {
      setEditedData(restaurant);
      setIsEditing(false);
      setError(null);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Direct status update without entering edit mode
  const handleStatusChange = async (newStatus) => {
    try {
      const response = await api.patch(`/restaurants/${id}/workflow`, {
        onboarding_status: newStatus
      });

      if (response.data.success) {
        // Update local state
        setRestaurant(prev => ({ ...prev, onboarding_status: newStatus }));
        toast({
          title: "Status Updated",
          description: `Onboarding status changed to ${newStatus.replace('_', ' ')}`,
        });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      });
    }
  };

  // Direct notes update without entering edit mode
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const response = await api.patch(`/restaurants/${id}/workflow`, {
        workflow_notes: localNotes
      });

      if (response.data.success) {
        setRestaurant(prev => ({ ...prev, workflow_notes: localNotes }));
        toast({
          title: "Notes Saved",
          description: "Workflow notes updated successfully",
        });
        setNotesPopoverOpen(false);
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive"
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleGoogleSearch = async () => {
    if (!restaurant?.name) {
      setError('Restaurant name is required for search');
      return;
    }

    // Use city field if available, otherwise try to extract from address
    const city = restaurant?.city || (() => {
      if (restaurant?.address) {
        const cityMatch = restaurant.address.match(/([A-Za-z\s]+),?\s*(?:New Zealand)?$/);
        return cityMatch ? cityMatch[1].trim() : 'New Zealand';
      }
      return 'New Zealand';
    })();

    setSearchingGoogle(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/google-business-search', {
        restaurantName: restaurant.name,
        city: city,
        restaurantId: id
      });

      if (response.data.success) {
        const data = response.data.data;
        
        // Update local state with extracted data
        const updates = {};
        if (data.address) updates.address = data.address;
        if (data.phone) updates.phone = data.phone;
        if (data.websiteUrl) updates.website_url = data.websiteUrl;
        if (data.instagramUrl) updates.instagram_url = data.instagramUrl;
        if (data.facebookUrl) updates.facebook_url = data.facebookUrl;
        if (data.openingHours && data.openingHours.length > 0) {
          updates.opening_hours = data.openingHours;
        }

        // Merge with existing data
        setRestaurant(prev => ({
          ...prev,
          ...updates
        }));

        setSuccess(`Found business information: ${Object.keys(updates).length} fields updated`);
        
        // Refresh data from server
        setTimeout(() => {
          fetchRestaurantDetails();
        }, 1500);
      }
    } catch (err) {
      console.error('Google search error:', err);
      setError(err.response?.data?.error || 'Failed to search for business information');
    } finally {
      setSearchingGoogle(false);
    }
  };

  const handleOpeningHoursChange = (day, field, value, index = null) => {
    const currentHours = editedData.opening_hours || {};
    
    // Handle array format (multiple time slots per day)
    if (Array.isArray(currentHours)) {
      const updatedHours = [...currentHours];
      if (index !== null) {
        // Update specific slot
        const slotIndex = updatedHours.findIndex((slot, i) => 
          slot.day === day && i === index
        );
        if (slotIndex !== -1) {
          updatedHours[slotIndex].hours[field] = value;
        }
      }
      setEditedData(prev => ({
        ...prev,
        opening_hours: updatedHours
      }));
    } else {
      // Handle object format (single time slot per day)
      setEditedData(prev => ({
        ...prev,
        opening_hours: {
          ...currentHours,
          [day]: {
            ...currentHours[day],
            [field]: value
          }
        }
      }));
    }
  };

  // Get available URLs for branding extraction (exclude blocked platforms)
  const getAvailableBrandingUrls = () => {
    const urls = [];
    if (restaurant?.website_url) urls.push({ label: 'Website', value: restaurant.website_url });
    if (restaurant?.ubereats_url) urls.push({ label: 'UberEats', value: restaurant.ubereats_url });
    if (restaurant?.doordash_url) urls.push({ label: 'DoorDash', value: restaurant.doordash_url });
    if (restaurant?.ordermeal_url) urls.push({ label: 'OrderMeal', value: restaurant.ordermeal_url });
    if (restaurant?.meandyou_url) urls.push({ label: 'Me&U', value: restaurant.meandyou_url });
    if (restaurant?.mobi2go_url) urls.push({ label: 'Mobi2go', value: restaurant.mobi2go_url });
    if (restaurant?.delivereasy_url) urls.push({ label: 'Delivereasy', value: restaurant.delivereasy_url });
    if (restaurant?.nextorder_url) urls.push({ label: 'NextOrder', value: restaurant.nextorder_url });
    if (restaurant?.foodhub_url) urls.push({ label: 'Foodhub', value: restaurant.foodhub_url });
    // Note: Instagram and Facebook excluded - blocked by Firecrawl
    return urls;
  };

  const handleExtractBranding = async () => {
    if (!brandingSourceUrl) {
      setError('Please select or enter a URL for branding extraction');
      return;
    }

    setExtractingBranding(true);
    setError(null);

    try {
      const response = await api.post('/website-extraction/branding', {
        restaurantId: id,
        sourceUrl: brandingSourceUrl
      });

      if (response.data.success) {
        const data = response.data.data;

        // Update local state
        const updates = {};

        // Logo versions
        if (data.logoVersions?.original) updates.logo_url = data.logoVersions.original;
        if (data.logoVersions?.nobg) updates.logo_nobg_url = data.logoVersions.nobg;
        if (data.logoVersions?.standard) updates.logo_standard_url = data.logoVersions.standard;
        if (data.logoVersions?.thermal) updates.logo_thermal_url = data.logoVersions.thermal;
        if (data.logoVersions?.thermal_alt) updates.logo_thermal_alt_url = data.logoVersions.thermal_alt;
        if (data.logoVersions?.thermal_contrast) updates.logo_thermal_contrast_url = data.logoVersions.thermal_contrast;
        if (data.logoVersions?.thermal_adaptive) updates.logo_thermal_adaptive_url = data.logoVersions.thermal_adaptive;
        if (data.images?.favicon || data.logoVersions?.favicon) {
          updates.logo_favicon_url = data.images?.favicon || data.logoVersions?.favicon;
        }

        // Colors
        if (data.colors?.primaryColor) updates.primary_color = data.colors.primaryColor;
        if (data.colors?.secondaryColor) updates.secondary_color = data.colors.secondaryColor;
        if (data.colors?.tertiaryColor) updates.tertiary_color = data.colors.tertiaryColor;
        if (data.colors?.accentColor) updates.accent_color = data.colors.accentColor;
        if (data.colors?.backgroundColor) updates.background_color = data.colors.backgroundColor;
        if (data.colors?.theme) updates.theme = data.colors.theme;

        // New OG fields
        if (data.images?.ogImage) updates.website_og_image = data.images.ogImage;
        if (data.metadata?.ogTitle) updates.website_og_title = data.metadata.ogTitle;
        if (data.metadata?.ogDescription) updates.website_og_description = data.metadata.ogDescription;

        setRestaurant(prev => ({ ...prev, ...updates }));
        setEditedData(prev => ({ ...prev, ...updates }));

        const confidencePercent = data.confidence ? Math.round(data.confidence * 100) : 0;
        setSuccess(`Branding extracted successfully${confidencePercent > 0 ? ` (${confidencePercent}% confidence)` : ''}`);

        // Refresh data
        setTimeout(() => fetchRestaurantDetails(), 1000);
      } else {
        setError(response.data.error || 'Failed to extract branding');
      }
    } catch (err) {
      console.error('Branding extraction error:', err);
      setError(err.response?.data?.error || 'Failed to extract branding');
    } finally {
      setExtractingBranding(false);
    }
  };

  const handleExtractLogo = async () => {
    if (!restaurant?.website_url) {
      setError('Website URL is required for logo extraction');
      return;
    }

    setLogoDialogOpen(true);
    setLoadingCandidates(true);
    setLogoCandidates([]);
    setSelectedLogoCandidate(null);
    setSelectedAdditionalImages([]);
    setError(null);

    try {
      const response = await api.post('/website-extraction/logo-candidates', {
        websiteUrl: restaurant.website_url
      });

      if (response.data.success && response.data.data?.candidates) {
        setLogoCandidates(response.data.data.candidates);
        // Pre-select the highest confidence candidate
        if (response.data.data.candidates.length > 0) {
          const topCandidate = response.data.data.candidates.reduce((prev, current) => 
            (current.confidence > prev.confidence) ? current : prev
          );
          setSelectedLogoCandidate(topCandidate.url);
        }
      } else {
        setError('No logo candidates found on the website');
        setLogoDialogOpen(false);
      }
    } catch (err) {
      console.error('Logo candidate extraction error:', err);
      setError(err.response?.data?.error || 'Failed to find logo candidates');
      setLogoDialogOpen(false);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleProcessSelectedLogo = async () => {
    if (!selectedLogoCandidate) {
      setError('Please select a logo candidate');
      return;
    }

    setProcessingLogo(true);
    setError(null);

    try {
      // Prepare additional images data
      const additionalImages = selectedAdditionalImages.map(url => {
        const candidate = logoCandidates.find(c => c.url === url);
        return {
          url: url,
          confidence: candidate?.confidence || 0,
          location: candidate?.location || '',
          description: candidate?.reason || ''
        };
      });

      const response = await api.post('/website-extraction/process-selected-logo', {
        logoUrl: selectedLogoCandidate,
        websiteUrl: restaurant.website_url,
        restaurantId: id,
        additionalImages
      });

      if (response.data.success) {
        const data = response.data.data;
        
        // Update local state with extracted logo and colors
        const updates = {};
        
        if (data.logoVersions?.original) {
          updates.logo_url = data.logoVersions.original;
        }
        if (data.logoVersions?.nobg) {
          updates.logo_nobg_url = data.logoVersions.nobg;
        }
        if (data.logoVersions?.standard) {
          updates.logo_standard_url = data.logoVersions.standard;
        }
        if (data.logoVersions?.thermal) {
          updates.logo_thermal_url = data.logoVersions.thermal;
        }
        if (data.logoVersions?.thermal_alt) {
          updates.logo_thermal_alt_url = data.logoVersions.thermal_alt;
        }
        if (data.logoVersions?.thermal_contrast) {
          updates.logo_thermal_contrast_url = data.logoVersions.thermal_contrast;
        }
        if (data.logoVersions?.thermal_adaptive) {
          updates.logo_thermal_adaptive_url = data.logoVersions.thermal_adaptive;
        }
        if (data.logoVersions?.favicon) {
          updates.logo_favicon_url = data.logoVersions.favicon;
        }
        if (data.colors?.primaryColor) {
          updates.primary_color = data.colors.primaryColor;
        }
        if (data.colors?.secondaryColor) {
          updates.secondary_color = data.colors.secondaryColor;
        }
        if (data.colors?.tertiaryColor) {
          updates.tertiary_color = data.colors.tertiaryColor;
        }
        if (data.colors?.accentColor) {
          updates.accent_color = data.colors.accentColor;
        }
        if (data.colors?.backgroundColor) {
          updates.background_color = data.colors.backgroundColor;
        }
        if (data.colors?.theme) {
          updates.theme = data.colors.theme;
        }

        // Update both restaurant and editedData
        setRestaurant(prev => ({
          ...prev,
          ...updates
        }));
        
        setEditedData(prev => ({
          ...prev,
          ...updates
        }));
        
        setSuccess('Logo and colors extracted successfully');
        setLogoDialogOpen(false);
        
        // Refresh restaurant data after a short delay
        setTimeout(() => {
          fetchRestaurantDetails();
        }, 1000);
      } else {
        setError(response.data.error || 'Failed to process logo');
      }
    } catch (err) {
      console.error('Logo processing error:', err);
      setError(err.response?.data?.error || 'Failed to process selected logo');
    } finally {
      setProcessingLogo(false);
    }
  };

  const handleProcessLogo = async () => {
    if (processMode === 'extract') {
      // Close Process Logo dialog and open Extract Logo dialog
      setProcessLogoDialogOpen(false);
      handleExtractLogo();
      return;
    }

    if (processMode === 'manual' || processMode === 'replace') {
      // Process the provided URL
      if (!newLogoUrl) {
        toast({
          title: "Error",
          description: "Please provide a logo URL",
          variant: "destructive"
        });
        return;
      }

      setProcessingLogo(true);
      setError(null);

      try {
        // Build versionsToUpdate array based on checkboxes
        const versions = Object.keys(versionsToUpdate)
          .filter(key => versionsToUpdate[key]);

        // Build colorsToUpdate array based on checkboxes
        const colors = Object.keys(colorsToUpdate)
          .filter(key => colorsToUpdate[key]);

        const response = await api.post('/website-extraction/process-selected-logo', {
          logoUrl: newLogoUrl,
          websiteUrl: restaurant.website_url || '',
          restaurantId: id,
          versionsToUpdate: processMode === 'replace' ? versions : undefined,
          colorsToUpdate: processMode === 'replace' ? colors : undefined
        });

        if (response.data.success) {
          const data = response.data.data;

          // Update local state with processed logo and colors
          const updates = {};

          // Only update selected versions if in 'replace' mode, otherwise update all
          const isReplaceMode = processMode === 'replace';
          const shouldUpdate = (versionKey) => !isReplaceMode || versions.includes(versionKey);

          if (shouldUpdate('logo_url') && data.logoVersions?.original) {
            updates.logo_url = data.logoVersions.original;
          }
          if (shouldUpdate('logo_nobg_url') && data.logoVersions?.nobg) {
            updates.logo_nobg_url = data.logoVersions.nobg;
          }
          if (shouldUpdate('logo_standard_url') && data.logoVersions?.standard) {
            updates.logo_standard_url = data.logoVersions.standard;
          }
          if (shouldUpdate('logo_thermal_url') && data.logoVersions?.thermal) {
            updates.logo_thermal_url = data.logoVersions.thermal;
          }
          if (shouldUpdate('logo_thermal_alt_url') && data.logoVersions?.thermal_alt) {
            updates.logo_thermal_alt_url = data.logoVersions.thermal_alt;
          }
          if (shouldUpdate('logo_thermal_contrast_url') && data.logoVersions?.thermal_contrast) {
            updates.logo_thermal_contrast_url = data.logoVersions.thermal_contrast;
          }
          if (shouldUpdate('logo_thermal_adaptive_url') && data.logoVersions?.thermal_adaptive) {
            updates.logo_thermal_adaptive_url = data.logoVersions.thermal_adaptive;
          }
          if (shouldUpdate('logo_favicon_url') && data.logoVersions?.favicon) {
            updates.logo_favicon_url = data.logoVersions.favicon;
          }

          // Update colors based on selection (only in replace mode)
          const shouldUpdateColor = (colorKey) => !isReplaceMode || colors.includes(colorKey);

          if (shouldUpdateColor('primary_color') && data.colors?.primaryColor) {
            updates.primary_color = data.colors.primaryColor;
          }
          if (shouldUpdateColor('secondary_color') && data.colors?.secondaryColor) {
            updates.secondary_color = data.colors.secondaryColor;
          }
          if (shouldUpdateColor('tertiary_color') && data.colors?.tertiaryColor) {
            updates.tertiary_color = data.colors.tertiaryColor;
          }
          if (shouldUpdateColor('accent_color') && data.colors?.accentColor) {
            updates.accent_color = data.colors.accentColor;
          }
          if (shouldUpdateColor('background_color') && data.colors?.backgroundColor) {
            updates.background_color = data.colors.backgroundColor;
          }
          if (shouldUpdateColor('theme') && data.colors?.theme) {
            updates.theme = data.colors.theme;
          }

          // Update both restaurant and editedData
          setRestaurant(prev => ({
            ...prev,
            ...updates
          }));

          setEditedData(prev => ({
            ...prev,
            ...updates
          }));

          toast({
            title: "Success",
            description: "Logo processed successfully"
          });

          // Close dialog and reset state
          setProcessLogoDialogOpen(false);
          setNewLogoUrl('');
          setProcessMode('manual');
          setError(null);
        } else {
          setError(response.data.error || 'Failed to process logo');
        }
      } catch (err) {
        console.error('Error processing logo:', err);
        setError(err.response?.data?.error || 'Failed to process logo');
      } finally {
        setProcessingLogo(false);
      }
    } else if (processMode === 'reprocess') {
      // Reprocess existing logo
      if (!restaurant?.logo_url) {
        toast({
          title: "Error",
          description: "No existing logo to reprocess",
          variant: "destructive"
        });
        return;
      }

      setProcessingLogo(true);
      setError(null);

      try {
        // Build versionsToUpdate array based on checkboxes
        const versions = Object.keys(versionsToUpdate)
          .filter(key => versionsToUpdate[key]);

        // For reprocessing, use the existing logo URL
        const logoUrl = restaurant.logo_url;

        const response = await api.post('/website-extraction/process-selected-logo', {
          logoUrl: logoUrl,
          websiteUrl: restaurant.website_url || '',
          restaurantId: id,
          versionsToUpdate: versions,
          sourceVersion: 'original'
        });

        if (response.data.success) {
          const data = response.data.data;
          
          // Update local state with processed logo versions
          const updates = {};
          
          // Only update the versions that were selected for reprocessing
          if (versionsToUpdate.logo_nobg_url && data.logoVersions?.nobg) {
            updates.logo_nobg_url = data.logoVersions.nobg;
          }
          if (versionsToUpdate.logo_standard_url && data.logoVersions?.standard) {
            updates.logo_standard_url = data.logoVersions.standard;
          }
          if (versionsToUpdate.logo_thermal_url && data.logoVersions?.thermal) {
            updates.logo_thermal_url = data.logoVersions.thermal;
          }
          if (versionsToUpdate.logo_thermal_alt_url && data.logoVersions?.thermal_alt) {
            updates.logo_thermal_alt_url = data.logoVersions.thermal_alt;
          }
          if (versionsToUpdate.logo_thermal_contrast_url && data.logoVersions?.thermal_contrast) {
            updates.logo_thermal_contrast_url = data.logoVersions.thermal_contrast;
          }
          if (versionsToUpdate.logo_thermal_adaptive_url && data.logoVersions?.thermal_adaptive) {
            updates.logo_thermal_adaptive_url = data.logoVersions.thermal_adaptive;
          }
          if (versionsToUpdate.logo_favicon_url && data.logoVersions?.favicon) {
            updates.logo_favicon_url = data.logoVersions.favicon;
          }

          // Update both restaurant and editedData
          setRestaurant(prev => ({
            ...prev,
            ...updates
          }));

          setEditedData(prev => ({
            ...prev,
            ...updates
          }));

          toast({
            title: "Success",
            description: "Logo versions regenerated successfully"
          });

          // Close dialog and reset state
          setProcessLogoDialogOpen(false);
          setNewLogoUrl('');
          setProcessMode('manual');
          setError(null);
        } else {
          setError(response.data.error || 'Failed to reprocess logo');
        }
      } catch (err) {
        console.error('Error reprocessing logo:', err);
        setError(err.response?.data?.error || 'Failed to reprocess logo');
      } finally {
        setProcessingLogo(false);
      }
    }
  };

  // Platform extraction functions
  const detectPlatformFromUrl = (url) => {
    if (!url) return 'website';
    
    if (url.includes('ubereats.com')) return 'ubereats';
    if (url.includes('doordash.com')) return 'doordash';
    if (url.includes('ordermeal.co.nz')) return 'ordermeal';
    if (url.includes('meandyou.co.nz')) return 'meandyou';
    if (url.includes('mobi2go.com')) return 'mobi2go';
    if (url.includes('delivereasy.co.nz')) return 'delivereasy';
    if (url.includes('nextorder.co.nz')) return 'nextorder';
    if (url.includes('foodhub.co.nz')) return 'foodhub';
    
    return 'website';
  };

  const handlePlatformExtraction = (url, platform) => {
    // Use the platform identifier directly since it's provided from the platform links
    // This handles platforms like Mobi2go, FoodHub that use custom domains
    // The platform parameter is already lowercase (e.g., "mobi2go", "foodhub")

    // Create a proper display name for the platform
    const platformDisplayName = platform.charAt(0).toUpperCase() + platform.slice(1);

    setExtractionConfig({
      url,
      platform,
      platformName: platformDisplayName,
      restaurantId: id,
      restaurantName: restaurant?.name || 'Unknown Restaurant'
    });
    // Reset extraction mode to standard when opening dialog
    setExtractionMode('standard');
    setExtractOptionSets(true);
    setValidateImages(true);
    setExtractionDialogOpen(true);
  };

  const startPlatformExtraction = async () => {
    if (!extractionConfig) return;
    
    setIsExtracting(true);
    setError(null);
    
    try {
      let response;
      
      // Check if this is UberEats and premium mode is selected
      if (extractionConfig.platform === 'ubereats' && extractionMode === 'premium') {
        // Use premium extraction endpoint
        response = await api.post('/extract-menu-premium', {
          storeUrl: extractionConfig.url,
          restaurantId: extractionConfig.restaurantId,
          restaurantName: extractionConfig.restaurantName,
          extractOptionSets: extractOptionSets,
          validateImages: validateImages,
          async: true
        });
      } else {
        // Use standard extraction endpoint
        response = await api.post('/extractions/start', {
          url: extractionConfig.url,
          platform: extractionConfig.platform, // Include platform to avoid detection issues
          restaurantId: extractionConfig.restaurantId,
          extractionType: 'batch',
          options: {
            includeImages: true,
            generateCSV: true
          }
        });
      }

      if (response.data.success) {
        toast({
          title: "Extraction started",
          description: `${extractionMode === 'premium' ? 'Premium' : 'Standard'} extraction from ${extractionConfig.platformName}`,
        });
        
        // Navigate to extraction detail page with appropriate parameters
        const isPremium = response.data.statusUrl ? true : false;
        navigate(`/extractions/${response.data.jobId}?poll=true${isPremium ? '&premium=true' : ''}`);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to start extraction');
      toast({
        title: "Extraction failed",
        description: error.response?.data?.error || error.message,
        variant: "destructive"
      });
    } finally {
      setIsExtracting(false);
      setExtractionDialogOpen(false);
    }
  };

  // New function to handle finding a platform URL
  const handleFindUrl = async (platform) => {
    setSearchingForUrl(prev => ({ ...prev, [platform]: true }));
    setError(null);
    
    try {
      const response = await api.post('/platform-url-search', {
        restaurantName: restaurant?.name,
        city: restaurant?.city || 'Wellington',
        platform: platform,
        restaurantId: id
      });
      
      if (response.data.success && response.data.url) {
        // Update the local restaurant state with the found URL
        const urlField = `${platform}_url`;
        setRestaurant(prev => ({
          ...prev,
          [urlField]: response.data.url
        }));
        
        toast({
          title: 'URL Found',
          description: `Successfully found ${platform} URL`,
        });
        
        // Refresh restaurant data
        await fetchRestaurantDetails();
      } else {
        toast({
          title: 'No URL Found',
          description: `Could not find a ${platform} URL for this restaurant`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error(`Failed to find ${platform} URL:`, error);
      toast({
        title: 'Search Failed',
        description: error.response?.data?.error || 'Failed to search for URL',
        variant: 'destructive'
      });
    } finally {
      setSearchingForUrl(prev => ({ ...prev, [platform]: false }));
    }
  };

  // New function to handle extracting business details
  const handleExtractDetails = (url, platform, platformName) => {
    const capabilities = PLATFORM_CAPABILITIES[platform];
    if (!capabilities?.canExtractDetails) return;
    
    setDetailsExtractionConfig({
      url,
      platform,
      platformName,
      restaurantId: id,
      restaurantName: restaurant?.name || 'Unknown Restaurant',
      availableFields: capabilities.detailFields,
      fieldLabels: capabilities.fieldLabels
    });
    
    // Pre-select all available fields
    setSelectedDetailFields(capabilities.detailFields);
    setDetailsDialogOpen(true);
  };

  // Function to start the details extraction
  const startDetailsExtraction = async () => {
    if (!detailsExtractionConfig || selectedDetailFields.length === 0) return;
    
    setExtractingDetails(true);
    setError(null);
    
    try {
      const response = await api.post('/platform-details-extraction', {
        url: detailsExtractionConfig.url,
        platform: detailsExtractionConfig.platform,
        extractFields: selectedDetailFields,
        restaurantId: detailsExtractionConfig.restaurantId,
        restaurantName: detailsExtractionConfig.restaurantName
      });
      
      if (response.data.success) {
        const extracted = response.data.extracted;
        let successMessage = 'Successfully extracted: ';
        const extractedItems = [];
        
        if (extracted.address) extractedItems.push('address');
        if (extracted.phone) extractedItems.push('phone');
        if (extracted.hours && extracted.hours.length > 0) extractedItems.push('opening hours');
        
        successMessage += extractedItems.join(', ');
        
        toast({
          title: 'Extraction Complete',
          description: successMessage,
        });
        
        // Refresh restaurant data to show updated fields
        await fetchRestaurantDetails();
        setDetailsDialogOpen(false);
      } else {
        toast({
          title: 'Extraction Failed',
          description: 'No data could be extracted from this URL',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to extract details:', error);
      toast({
        title: 'Extraction Error',
        description: error.response?.data?.error || 'Failed to extract business details',
        variant: 'destructive'
      });
    } finally {
      setExtractingDetails(false);
    }
  };

  const addOpeningHoursSlot = (day) => {
    const currentHours = editedData.opening_hours;
    
    // If no hours exist yet, create object format by default
    if (!currentHours || (typeof currentHours === 'object' && Object.keys(currentHours).length === 0)) {
      setEditedData(prev => ({
        ...prev,
        opening_hours: {
          [day]: { open: '09:00', close: '17:00' }
        }
      }));
      return;
    }
    
    if (!Array.isArray(currentHours)) {
      // Object format - check if we need to convert to array (for multiple slots)
      if (currentHours[day]) {
        // Day already has hours, convert to array format for multiple slots
        const arrayFormat = [];
        Object.keys(currentHours).forEach(d => {
          if (currentHours[d]) {
            arrayFormat.push({
              day: d,
              hours: currentHours[d]
            });
          }
        });
        // Add the new slot for this day
        arrayFormat.push({
          day: day,
          hours: { open: '09:00', close: '17:00' }
        });
        setEditedData(prev => ({
          ...prev,
          opening_hours: arrayFormat
        }));
      } else {
        // Just add to object format
        setEditedData(prev => ({
          ...prev,
          opening_hours: {
            ...currentHours,
            [day]: { open: '09:00', close: '17:00' }
          }
        }));
      }
    } else {
      // Array format - just add new slot
      setEditedData(prev => ({
        ...prev,
        opening_hours: [...currentHours, {
          day: day,
          hours: { open: '09:00', close: '17:00' }
        }]
      }));
    }
  };

  const removeOpeningHoursSlot = (day, index) => {
    const currentHours = editedData.opening_hours || [];
    if (Array.isArray(currentHours)) {
      const updatedHours = currentHours.filter((slot, i) => 
        !(slot.day === day && i === index)
      );
      setEditedData(prev => ({
        ...prev,
        opening_hours: updatedHours
      }));
    }
  };

  const deleteOpeningHours = (day) => {
    const currentHours = editedData.opening_hours || {};
    
    if (Array.isArray(currentHours)) {
      // Remove all slots for this day from array format
      const updatedHours = currentHours.filter(slot => slot.day !== day);
      setEditedData(prev => ({
        ...prev,
        opening_hours: updatedHours
      }));
    } else {
      // Remove the day from object format
      const updatedHours = { ...currentHours };
      delete updatedHours[day];
      setEditedData(prev => ({
        ...prev,
        opening_hours: updatedHours
      }));
    }
  };

  const renderOpeningHours = () => {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hours = isEditing ? editedData.opening_hours : restaurant?.opening_hours;
    
    if (!hours) {
      return daysOfWeek.map(day => (
        <div key={day} className="flex items-center justify-between">
          <span className="text-sm font-medium w-24">{day}</span>
          {isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addOpeningHoursSlot(day)}
            >
              Add Hours
            </Button>
          ) : (
            <span className="text-sm text-gray-500">Closed</span>
          )}
        </div>
      ));
    }

    // Handle array format (multiple time slots per day)
    if (Array.isArray(hours)) {
      const groupedHours = {};
      hours.forEach((slot, index) => {
        if (!groupedHours[slot.day]) {
          groupedHours[slot.day] = [];
        }
        groupedHours[slot.day].push({ ...slot.hours, index });
      });

      return daysOfWeek.map(day => {
        const daySlots = groupedHours[day] || [];
        
        return (
          <div key={day} className="space-y-2 mb-3">
            <div className="flex items-start gap-4">
              <span className="text-sm font-medium w-24 pt-2">{day}</span>
              <div className="flex-1 space-y-2">
                {daySlots.length === 0 ? (
                  isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addOpeningHoursSlot(day)}
                      className="mt-1"
                    >
                      Add Hours
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-500 inline-block pt-2">Closed</span>
                  )
                ) : (
                  daySlots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            type="time"
                            value={slot.open || ''}
                            onChange={(e) => handleOpeningHoursChange(day, 'open', e.target.value, slot.index)}
                            className="w-32"
                          />
                          <span className="text-gray-500">-</span>
                          <Input
                            type="time"
                            value={slot.close || ''}
                            onChange={(e) => handleOpeningHoursChange(day, 'close', e.target.value, slot.index)}
                            className="w-32"
                          />
                          {daySlots.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOpeningHoursSlot(day, slot.index)}
                              className="h-8 w-8 flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm">
                          {convertTo12Hour(slot.open)} - {convertTo12Hour(slot.close)}
                        </span>
                      )}
                    </div>
                  ))
                )}
                {isEditing && daySlots.length > 0 && (
                  <div className="flex gap-2">
                    {daySlots.length < 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addOpeningHoursSlot(day)}
                      >
                        Add Time Slot
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteOpeningHours(day)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete All Hours
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      });
    }

    // Handle object format (single time slot per day)
    return daysOfWeek.map(day => (
      <div key={day} className="space-y-2 mb-3">
        <div className="flex items-start gap-4">
          <span className="text-sm font-medium w-24 pt-2">{day}</span>
          <div className="flex-1 space-y-2">
            {!hours[day] ? (
              isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOpeningHoursSlot(day)}
                  className="mt-1"
                >
                  Add Hours
                </Button>
              ) : (
                <span className="text-sm text-gray-500 inline-block pt-2">Closed</span>
              )
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        type="time"
                        value={hours[day]?.open || ''}
                        onChange={(e) => handleOpeningHoursChange(day, 'open', e.target.value)}
                        className="w-32"
                      />
                      <span className="text-gray-500">-</span>
                      <Input
                        type="time"
                        value={hours[day]?.close || ''}
                        onChange={(e) => handleOpeningHoursChange(day, 'close', e.target.value)}
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteOpeningHours(day)}
                        className="h-8 w-8 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm">
                      {convertTo12Hour(hours[day].open)} - {convertTo12Hour(hours[day].close)}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addOpeningHoursSlot(day)}
                    >
                      Add Time Slot
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteOpeningHours(day)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete All Hours
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    ));
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      lead: 'bg-gray-100 text-gray-800',
      info_gathered: 'bg-blue-100 text-blue-800',
      registered: 'bg-purple-100 text-purple-800',
      menu_imported: 'bg-orange-100 text-orange-800',
      configured: 'bg-green-100 text-green-800',
      completed: 'bg-emerald-100 text-emerald-800'
    };

    return (
      <Badge className={statusColors[status] || statusColors.lead}>
        {status?.replace('_', ' ').toUpperCase() || 'LEAD'}
      </Badge>
    );
  };

  const getWarmthBadge = (warmth) => {
    if (!warmth) return null;
    const colors = {
      frozen: 'bg-blue-100 text-blue-800 border-blue-200',
      cold: 'bg-gray-100 text-gray-800 border-gray-200',
      warm: 'bg-orange-100 text-orange-800 border-orange-200',
      hot: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[warmth])}>
        {warmth}
      </Badge>
    );
  };

  const getStageBadge = (stage) => {
    if (!stage) return null;
    const colors = {
      uncontacted: 'bg-gray-100 text-gray-800',
      reached_out: 'bg-blue-100 text-blue-800',
      in_talks: 'bg-purple-100 text-purple-800',
      demo_booked: 'bg-green-100 text-green-800',
      rebook_demo: 'bg-yellow-100 text-yellow-800',
      demo_completed: 'bg-orange-200 text-orange-900',
      contract_sent: 'bg-indigo-100 text-indigo-800',
      closed_won: 'bg-green-100 text-green-800',
      closed_lost: 'bg-red-100 text-red-800',
      reengaging: 'bg-orange-100 text-orange-800'
    };
    return (
      <Badge variant="outline" className={colors[stage]}>
        {stage?.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const handleUploadImagesToCDN = async (menuId) => {
    try {
      toast({ 
        title: "Uploading images to CDN...", 
        description: "This may take a moment" 
      });
      
      const response = await api.post(`/menus/${menuId}/upload-images`);
      
      if (response.data.success) {
        toast({ 
          title: "Success", 
          description: `Uploaded ${response.data.uploadedCount || response.data.stats?.uploadedCount || 0} images to CDN` 
        });
        // Refresh restaurant data to show updated status
        fetchRestaurantDetails();
      }
    } catch (error) {
      console.error('Failed to upload images:', error);
      toast({ 
        title: "Upload failed", 
        description: error.response?.data?.error || "Failed to upload images",
        variant: "destructive"
      });
    }
  };

  const handleDownloadCSVWithCDN = async (menuId) => {
    try {
      const response = await api.get(`/menus/${menuId}/csv-with-cdn`, {
        params: { download: 'true' },
        responseType: 'text'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `menu_${menuId}_cdn_export.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({ 
        title: "CSV exported", 
        description: "Downloaded menu with CDN image URLs" 
      });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast({ 
        title: "Export failed", 
        description: error.response?.data?.error || "Failed to export CSV",
        variant: "destructive"
      });
    }
  };

  // Reusable component for platform URL fields
  const PlatformUrlField = ({ platform, platformName, urlValue, fieldName, placeholder }) => {
    const capabilities = PLATFORM_CAPABILITIES[platform];
    const isSearching = searchingForUrl[platform];
    
    return (
      <div>
        <div className="flex items-center justify-between">
          <Label>{platformName}</Label>
          {!isEditing && (
            <div className="flex gap-2">
              {/* Find URL button - shows when no URL exists */}
              {!urlValue && isFeatureEnabled('googleSearchExtraction') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFindUrl(platform)}
                  disabled={isSearching || extractingDetails}
                >
                  {isSearching ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <SearchIcon className="h-3 w-3 mr-1" />
                  )}
                  Find URL
                </Button>
              )}

              {/* Get Business Details button - shows when URL exists and platform supports it */}
              {urlValue && capabilities?.canExtractDetails && isFeatureEnabled('platformDetailsExtraction') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExtractDetails(urlValue, platform, platformName)}
                  disabled={extractingDetails || isExtracting}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Get Details
                </Button>
              )}

              {/* Extract Menu button - shows when URL exists and platform supports menu extraction */}
              {urlValue && capabilities?.canExtractMenu && isFeatureEnabled('standardExtraction') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePlatformExtraction(urlValue, platform)}
                  disabled={isExtracting}
                >
                  <FileSearch className="h-3 w-3 mr-1" />
                  Extract Menu
                </Button>
              )}
            </div>
          )}
        </div>
        
        {isEditing ? (
          <Input
            value={editedData[fieldName] || ''}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={placeholder}
            className="mt-2"
          />
        ) : (
          <p className="text-sm mt-1">
            {urlValue ? (
              <a 
                href={urlValue}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-blue hover:underline"
              >
                {urlValue}
              </a>
            ) : '-'}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Building2 className="h-8 w-8 text-brand-blue animate-pulse" />
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/restaurants')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isNewRestaurant ? 'Add New Restaurant' : (restaurant?.name || 'Restaurant Details')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isNewRestaurant ? 'Fill in the details below' : (restaurant?.address || 'No address provided')}
              </p>
            </div>
          </div>
          {/* Status, Notes, and Actions */}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 lg:gap-4">
          {!isNewRestaurant && (
            <div className="flex items-center gap-2">
              <Select
                value={restaurant?.onboarding_status || 'lead'}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-auto h-7 px-2 border-0 bg-transparent focus:ring-0 hover:bg-muted/50">
                  {getStatusBadge(restaurant?.onboarding_status)}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                      Lead
                    </span>
                  </SelectItem>
                  <SelectItem value="info_gathered">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Info Gathered
                    </span>
                  </SelectItem>
                  <SelectItem value="registered">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Registered
                    </span>
                  </SelectItem>
                  <SelectItem value="menu_imported">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Menu Imported
                    </span>
                  </SelectItem>
                  <SelectItem value="configured">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Configured
                    </span>
                  </SelectItem>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Completed
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Popover open={notesPopoverOpen} onOpenChange={(open) => {
                setNotesPopoverOpen(open);
                if (open) {
                  setLocalNotes(restaurant?.workflow_notes || '');
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2 gap-1",
                      restaurant?.workflow_notes ? "text-blue-600" : "text-muted-foreground"
                    )}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">Notes</span>
                    {restaurant?.workflow_notes && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Workflow Notes</Label>
                      <span className="text-xs text-muted-foreground">
                        {localNotes.length} characters
                      </span>
                    </div>
                    <Textarea
                      value={localNotes}
                      onChange={(e) => setLocalNotes(e.target.value)}
                      placeholder="Add notes about this restaurant's onboarding process..."
                      className="min-h-[150px] resize-y"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNotesPopoverOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                      >
                        {savingNotes ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Save Notes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
          <div className="flex gap-2">
          {!isNewRestaurant && isFeatureEnabled('googleSearchExtraction') && (
            <Button
              onClick={handleGoogleSearch}
              variant="outline"
              disabled={searchingGoogle || !restaurant?.name}
              title="Search Google for business information"
            >
              {searchingGoogle ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Google Search
                </>
              )}
            </Button>
          )}
          
          {!isEditing && !isNewRestaurant ? (
            <Button onClick={() => {
              setEditedData(restaurant);
              setIsEditing(true);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-brand-blue to-brand-green"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : (isNewRestaurant ? 'Create Restaurant' : 'Save Changes')}
              </Button>
            </>
          )}
          </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList size="full">
          <TabsTrigger value="overview" size="full">Overview</TabsTrigger>
          {isFeatureEnabled('tasksAndSequences') && (
            <TabsTrigger value="tasks-sequences" size="full">Tasks and Sequences</TabsTrigger>
          )}
          <TabsTrigger value="platforms" size="full">Gathering Info</TabsTrigger>
          {isFeatureEnabled('registration') && (
            <TabsTrigger value="registration" size="full">Registration</TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Restaurant Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Restaurant Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.name || '-'}</p>
                  )}
                </div>
                
                <div>
                  <Label>Organisation Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.organisation_name || ''}
                      onChange={(e) => handleFieldChange('organisation_name', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.organisation_name || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>City</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.city || ''}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      placeholder="e.g., Wellington, Auckland, Christchurch"
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.city || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Address</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedData.address || ''}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.address || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Restaurant Phone</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.phone || ''}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.phone || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Restaurant Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedData.email || ''}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.email || '-'}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact & Lead Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact & Lead Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Contact Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.contact_name || ''}
                      onChange={(e) => handleFieldChange('contact_name', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.contact_name || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Contact Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedData.contact_email || ''}
                      onChange={(e) => handleFieldChange('contact_email', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.contact_email || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Contact Phone</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.contact_phone || ''}
                      onChange={(e) => handleFieldChange('contact_phone', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.contact_phone || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Weekly Sales Range</Label>
                  {isEditing ? (
                    <Select
                      value={editedData.weekly_sales_range || ''}
                      onValueChange={(value) => handleFieldChange('weekly_sales_range', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-1000">$0 - $1,000</SelectItem>
                        <SelectItem value="1000-5000">$1,000 - $5,000</SelectItem>
                        <SelectItem value="5000-10000">$5,000 - $10,000</SelectItem>
                        <SelectItem value="10000-25000">$10,000 - $25,000</SelectItem>
                        <SelectItem value="25000+">$25,000+</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.weekly_sales_range || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Lead Created</Label>
                  <p className="text-sm mt-1">
                    {restaurant?.lead_created_at
                      ? new Date(restaurant.lead_created_at).toLocaleString()
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sales Information */}
          {isFeatureEnabled('tasksAndSequences') && (
          <Card>
            <CardHeader>
              <CardTitle>Sales Information</CardTitle>
              <CardDescription>Lead tracking, categorization, and sales pipeline management</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Lead Type */}
              <div>
                <Label>Lead Type</Label>
                {isEditing ? (
                  <Select
                    value={editedData.lead_type || ''}
                    onValueChange={(value) => handleFieldChange('lead_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select lead type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1 capitalize">{restaurant?.lead_type || '-'}</p>
                )}
              </div>

              {/* Lead Category */}
              <div>
                <Label>Lead Category</Label>
                {isEditing ? (
                  <Select
                    value={editedData.lead_category || ''}
                    onValueChange={(value) => handleFieldChange('lead_category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid_ads">Paid Ads</SelectItem>
                      <SelectItem value="organic_content">Organic Content</SelectItem>
                      <SelectItem value="warm_outreach">Warm Outreach</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1">{restaurant?.lead_category?.replace(/_/g, ' ') || '-'}</p>
                )}
              </div>

              {/* Lead Engagement Source */}
              <div>
                <Label>Lead Engagement Source</Label>
                {isEditing ? (
                  <Select
                    value={editedData.lead_engagement_source || ''}
                    onValueChange={(value) => handleFieldChange('lead_engagement_source', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select engagement source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="meta_ad_form">Meta Ad Form</SelectItem>
                      <SelectItem value="landing_page_demo_booking">Landing Page Demo Booking</SelectItem>
                      <SelectItem value="website_demo_booking">Website Demo Booking</SelectItem>
                      <SelectItem value="website_live_chat">Website Live Chat</SelectItem>
                      <SelectItem value="inbound_social_media_message">Inbound Social Media Message</SelectItem>
                      <SelectItem value="inbound_email">Inbound Email</SelectItem>
                      <SelectItem value="inbound_call">Inbound Call</SelectItem>
                      <SelectItem value="cold_social_media_message">Cold Social Media Message</SelectItem>
                      <SelectItem value="cold_email">Cold Email</SelectItem>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="inbound_referral">Inbound Referral</SelectItem>
                      <SelectItem value="outbound_referral">Outbound Referral</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1">{restaurant?.lead_engagement_source?.replace(/_/g, ' ') || '-'}</p>
                )}
              </div>

              {/* Lead Warmth */}
              <div>
                <Label>Lead Warmth</Label>
                {isEditing ? (
                  <Select
                    value={editedData.lead_warmth || ''}
                    onValueChange={(value) => handleFieldChange('lead_warmth', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warmth" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frozen">Frozen</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="hot">Hot</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    {restaurant?.lead_warmth ? getWarmthBadge(restaurant.lead_warmth) : '-'}
                  </div>
                )}
              </div>

              {/* Lead Stage */}
              <div>
                <Label>Lead Stage</Label>
                {isEditing ? (
                  <Select
                    value={editedData.lead_stage || ''}
                    onValueChange={(value) => handleFieldChange('lead_stage', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncontacted">Uncontacted</SelectItem>
                      <SelectItem value="reached_out">Reached Out</SelectItem>
                      <SelectItem value="in_talks">In Talks</SelectItem>
                      <SelectItem value="demo_booked">Demo Booked</SelectItem>
                      <SelectItem value="rebook_demo">Rebook Demo</SelectItem>
                      <SelectItem value="demo_completed">Demo Completed</SelectItem>
                      <SelectItem value="contract_sent">Contract Sent</SelectItem>
                      <SelectItem value="closed_won">Closed Won</SelectItem>
                      <SelectItem value="closed_lost">Closed Lost</SelectItem>
                      <SelectItem value="reengaging">Reengaging</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    {restaurant?.lead_stage ? getStageBadge(restaurant.lead_stage) : '-'}
                  </div>
                )}
              </div>

              {/* Lead Status */}
              <div>
                <Label>Lead Status</Label>
                {isEditing ? (
                  <Select
                    value={editedData.lead_status || ''}
                    onValueChange={(value) => handleFieldChange('lead_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="ghosted">Ghosted</SelectItem>
                      <SelectItem value="reengaging">Reengaging</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1 capitalize">{restaurant?.lead_status || '-'}</p>
                )}
              </div>

              {/* ICP Rating */}
              <div>
                <Label>ICP Rating (0-10)</Label>
                {isEditing ? (
                  <Select
                    value={editedData.icp_rating?.toString() || ''}
                    onValueChange={(value) => handleFieldChange('icp_rating', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                        <SelectItem key={rating} value={rating.toString()}>
                          {rating}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.icp_rating !== null && restaurant?.icp_rating !== undefined
                      ? `${restaurant.icp_rating}/10`
                      : '-'}
                  </p>
                )}
              </div>

              {/* Last Contacted */}
              <div>
                <Label>Last Contacted</Label>
                {isEditing ? (
                  <DateTimePicker
                    value={editedData.last_contacted ? new Date(editedData.last_contacted) : null}
                    onChange={(date) => handleFieldChange('last_contacted', date ? date.toISOString() : null)}
                    placeholder="Set last contacted"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.last_contacted
                      ? new Date(restaurant.last_contacted).toLocaleString()
                      : '-'}
                  </p>
                )}
              </div>

              {/* Assigned Sales Rep */}
              <div>
                <Label>Assigned Sales Rep</Label>
                {isEditing ? (
                  <Input
                    value={editedData.assigned_sales_rep || ''}
                    onChange={(e) => handleFieldChange('assigned_sales_rep', e.target.value)}
                    placeholder="User ID (UUID)"
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.assigned_sales_rep || '-'}</p>
                )}
              </div>
              
              {/* Demo Store Built */}
              <div>
                <Label>Demo Store Built</Label>
                {isEditing ? (
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="demo_store_built"
                      checked={editedData.demo_store_built || false}
                      onCheckedChange={(checked) => handleFieldChange('demo_store_built', checked)}
                    />
                    <label
                      htmlFor="demo_store_built"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Yes
                    </label>
                  </div>
                ) : (
                  <p className="text-sm mt-1">{restaurant?.demo_store_built ? 'Yes' : 'No'}</p>
                )}
              </div>

              {/* Demo Store URL - conditional rendering */}
              {(isEditing ? editedData.demo_store_built : restaurant?.demo_store_built) && (
                <div>
                  <Label>Demo Store URL</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.demo_store_url || ''}
                      onChange={(e) => handleFieldChange('demo_store_url', e.target.value)}
                      placeholder="https://demo-restaurant.pumpd.co.nz"
                    />
                  ) : (
                    <p className="text-sm mt-1">
                      {restaurant?.demo_store_url ? (
                        <a
                          href={restaurant.demo_store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue hover:underline"
                        >
                          {restaurant.demo_store_url}
                        </a>
                      ) : '-'}
                    </p>
                  )}
                </div>
              )}

              {/* Demo Store Subdomain */}
              <div>
                <Label>Demo Store Subdomain</Label>
                {isEditing ? (
                  <Input
                    value={editedData.subdomain || ''}
                    onChange={(e) => handleFieldChange('subdomain', e.target.value)}
                    placeholder="restaurant-name"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.subdomain ? (
                      <a
                        href={`https://${restaurant.subdomain}.pumpd.co.nz`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.subdomain}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              {/* Qualification Data Section */}
              <div className="col-span-2 border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">Demo Qualification Data</h3>

                {isEditing ? (
                  <QualificationForm
                    data={editedData}
                    onChange={handleFieldChange}
                  />
                ) : (
                  <QualificationDataDisplay data={restaurant} />
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Platforms & Branding */}
        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform URLs</CardTitle>
                <CardDescription>
                  <p>Online Ordering, Social Media & Website URLs</p>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                <PlatformUrlField
                  platform="website"
                  platformName="Website URL"
                  urlValue={restaurant?.website_url}
                  fieldName="website_url"
                  placeholder="https://..."
                />

                <PlatformUrlField
                  platform="ubereats"
                  platformName="UberEats URL"
                  urlValue={restaurant?.ubereats_url}
                  fieldName="ubereats_url"
                  placeholder="https://www.ubereats.com/..."
                />

                <PlatformUrlField
                  platform="doordash"
                  platformName="DoorDash URL"
                  urlValue={restaurant?.doordash_url}
                  fieldName="doordash_url"
                  placeholder="https://www.doordash.com/..."
                />

                <PlatformUrlField
                  platform="instagram"
                  platformName="Instagram URL"
                  urlValue={restaurant?.instagram_url}
                  fieldName="instagram_url"
                  placeholder="https://instagram.com/..."
                />

                <PlatformUrlField
                  platform="facebook"
                  platformName="Facebook URL"
                  urlValue={restaurant?.facebook_url}
                  fieldName="facebook_url"
                  placeholder="https://facebook.com/..."
                />

                {/* NZ-specific ordering platforms */}
                <PlatformUrlField
                  platform="delivereasy"
                  platformName="Delivereasy URL"
                  urlValue={restaurant?.delivereasy_url}
                  fieldName="delivereasy_url"
                  placeholder="https://delivereasy.co.nz/..."
                />
                
                <PlatformUrlField
                  platform="ordermeal"
                  platformName="OrderMeal URL"
                  urlValue={restaurant?.ordermeal_url}
                  fieldName="ordermeal_url"
                  placeholder="https://ordermeal.co.nz/..."
                />

                <PlatformUrlField
                  platform="meandyou"
                  platformName="Me&U URL"
                  urlValue={restaurant?.meandyou_url}
                  fieldName="meandyou_url"
                  placeholder="https://meandyou.co.nz/..."
                />

                <PlatformUrlField
                  platform="mobi2go"
                  platformName="Mobi2go URL"
                  urlValue={restaurant?.mobi2go_url}
                  fieldName="mobi2go_url"
                  placeholder="https://mobi2go.com/..."
                />

                <PlatformUrlField
                  platform="nextorder"
                  platformName="NextOrder URL"
                  urlValue={restaurant?.nextorder_url}
                  fieldName="nextorder_url"
                  placeholder="https://nextorder.co.nz/..."
                />

                <PlatformUrlField
                  platform="foodhub"
                  platformName="Foodhub URL"
                  urlValue={restaurant?.foodhub_url}
                  fieldName="foodhub_url"
                  placeholder="https://foodhub.co.nz/..."
                />
              </CardContent>
            </Card>

            {/* Opening Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Opening Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {renderOpeningHours()}
                </div>
                
                {isEditing && (
                  <div className="mt-4">
                    <Label>Opening Hours Description</Label>
                    <Textarea
                      value={editedData.opening_hours_text || ''}
                      onChange={(e) => handleFieldChange('opening_hours_text', e.target.value)}
                      placeholder="e.g., Open daily 11am-10pm, closed Mondays"
                      rows={2}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>  

          {/* Recent Menus */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Menus</CardTitle>
              <CardDescription>Latest menu versions for this restaurant</CardDescription>
            </CardHeader>
            <CardContent>
              {restaurant?.menus && restaurant.menus.length > 0 ? (
                <div className="space-y-2">
                  {restaurant.menus.slice(0, 5).map((menu) => (
                    <div key={menu.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Version {menu.version}</span>
                          <span className="text-xs text-muted-foreground">
                            {menu.platforms?.name || 'Unknown'}
                          </span>
                          {menu.is_active && (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(menu.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/menus/${menu.id}`)}
                          className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Menu
                        </Button>
                        {isFeatureEnabled('csvWithImagesDownload') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUploadImagesToCDN(menu.id)}
                          className="text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Upload Images
                        </Button>
                        )}
                        {isFeatureEnabled('csvWithImagesDownload') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadCSVWithCDN(menu.id)}
                          className="text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download CSV
                        </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/menus?restaurant=${id}`)}
                  >
                    View All Menus
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No menus found</p>
              )}
            </CardContent>
          </Card>

          {/* Branding card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Branding & Visual Identity</CardTitle>
                  <CardDescription>Logo, colors, and theme settings</CardDescription>
                </div>
                {/* Branding Extraction Controls - inline with header */}
                {!isNewRestaurant && useFirecrawlBranding && isFeatureEnabled('brandingExtraction.firecrawlBranding') && (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={brandingSourceUrl}
                      onValueChange={setBrandingSourceUrl}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableBrandingUrls().map((url) => (
                          <SelectItem key={url.value} value={url.value}>
                            {url.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={brandingSourceUrl}
                      onChange={(e) => setBrandingSourceUrl(e.target.value)}
                      placeholder="Or enter URL..."
                      className="w-[180px]"
                    />
                    <Button
                      onClick={handleExtractBranding}
                      variant="default"
                      size="sm"
                      disabled={extractingBranding || !brandingSourceUrl}
                      title="Extract branding from selected URL"
                    >
                      {extractingBranding ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Palette className="h-3 w-3 mr-1" />
                          Extract Branding
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Theme</Label>
                  {isEditing ? (
                    <Select
                      value={editedData.theme || 'light'}
                      onValueChange={(value) => handleFieldChange('theme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="mt-1">
                      {restaurant?.theme || 'light'}
                    </Badge>
                  )}
                </div>

                <div>
                  <Label>Primary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.primary_color || '#000000'}
                        onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.primary_color || ''}
                        onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.primary_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.primary_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.primary_color || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Secondary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.secondary_color || '#000000'}
                        onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.secondary_color || ''}
                        onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.secondary_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.secondary_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.secondary_color || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Tertiary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.tertiary_color || '#000000'}
                        onChange={(e) => handleFieldChange('tertiary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.tertiary_color || ''}
                        onChange={(e) => handleFieldChange('tertiary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.tertiary_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.tertiary_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.tertiary_color || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Accent Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.accent_color || '#000000'}
                        onChange={(e) => handleFieldChange('accent_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.accent_color || ''}
                        onChange={(e) => handleFieldChange('accent_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.accent_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.accent_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.accent_color || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Background Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.background_color || '#FFFFFF'}
                        onChange={(e) => handleFieldChange('background_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.background_color || ''}
                        onChange={(e) => handleFieldChange('background_color', e.target.value)}
                        placeholder="#FFFFFF"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.background_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.background_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.background_color || '-'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Logo Management Actions */}
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-semibold">Logo Management</Label>
                {!isNewRestaurant && (
                  <div className="flex gap-2 items-center">
                    {/* Legacy Extract Logo Button (when feature flag is off) */}
                    {!useFirecrawlBranding && restaurant?.website_url && isFeatureEnabled('logoExtraction') && (
                      <Button
                        onClick={handleExtractLogo}
                        variant="outline"
                        size="sm"
                        disabled={extractingLogo}
                        title="Extract logo from website"
                      >
                        {extractingLogo ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Palette className="h-3 w-3 mr-1" />
                            Extract Logo
                          </>
                        )}
                      </Button>
                    )}

                    {isFeatureEnabled('logoProcessing') && (
                    <Button
                      onClick={() => setProcessLogoDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      title="Process logo manually or reprocess existing"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Process Logo
                    </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Main Logos Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Logo URL</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_url || ''}
                      onChange={(e) => handleFieldChange('logo_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : (
                    <div className="mt-2">
                      {restaurant?.logo_url ? (
                        <img 
                          src={restaurant.logo_url} 
                          alt="Logo" 
                          className="h-20 w-auto object-contain bg-gray-100 rounded p-2"
                        />
                      ) : (
                        <span className="text-sm">-</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Logo (No Background)</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_nobg_url || ''}
                      onChange={(e) => handleFieldChange('logo_nobg_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_nobg_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_nobg_url} 
                        alt="Logo (No Background)"
                        className="h-20 w-auto object-contain bg-gray-100 rounded p-2"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>

                <div>
                  <Label>Logo (Standard)</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_standard_url || ''}
                      onChange={(e) => handleFieldChange('logo_standard_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_standard_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_standard_url} 
                        alt="Logo (Standard)"
                        className="h-20 w-auto object-contain bg-white rounded border p-2"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>

                <div>
                  <Label>Logo (Favicon)</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_favicon_url || ''}
                      onChange={(e) => handleFieldChange('logo_favicon_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_favicon_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_favicon_url} 
                        alt="Logo (Favicon)"
                        className="h-8 w-8 object-contain bg-gray-100 rounded border p-1"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>
              </div>

              {/* Thermal Logos Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                <div>
                  <Label>Thermal (Inverted)</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_thermal_url || ''}
                      onChange={(e) => handleFieldChange('logo_thermal_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_thermal_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_thermal_url} 
                        alt="Thermal (Inverted)"
                        className="h-20 w-auto object-contain bg-white rounded border border-gray-300 p-2"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>
                <div>
                  <Label>Thermal Alt (Dark Logos)</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_thermal_alt_url || ''}
                      onChange={(e) => handleFieldChange('logo_thermal_alt_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_thermal_alt_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_thermal_alt_url} 
                        alt="Thermal Alt"
                        className="h-20 w-auto object-contain bg-white rounded border border-gray-300 p-2"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>

                <div>
                  <Label>Thermal High Contrast</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_thermal_contrast_url || ''}
                      onChange={(e) => handleFieldChange('logo_thermal_contrast_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_thermal_contrast_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_thermal_contrast_url} 
                        alt="Thermal High Contrast"
                        className="h-20 w-auto object-contain bg-white rounded border border-gray-300 p-2"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>

                <div>
                  <Label>Thermal Adaptive</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_thermal_adaptive_url || ''}
                      onChange={(e) => handleFieldChange('logo_thermal_adaptive_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  ) : restaurant?.logo_thermal_adaptive_url ? (
                    <div className="mt-2">
                      <img 
                        src={restaurant.logo_thermal_adaptive_url} 
                        alt="Thermal Adaptive"
                        className="h-20 w-auto object-contain bg-white rounded border border-gray-300 p-2"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-2">-</p>
                  )}
                </div>
              </div>

              {/* Header Images Grid - OG Images */}
              {(isEditing || restaurant?.website_og_image || restaurant?.ubereats_og_image ||
                restaurant?.doordash_og_image || restaurant?.facebook_cover_image) && (
                <div className="mt-6 pt-6 border-t">
                  <Label className="text-base font-semibold mb-4 block">Header Images</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Website OG Image</Label>
                      {isEditing ? (
                        <>
                          <Input
                            value={editedData.website_og_image || ''}
                            onChange={(e) => handleFieldChange('website_og_image', e.target.value)}
                            placeholder="https://..."
                            className="mt-2"
                          />
                          {editedData.website_og_image && (
                            <img
                              src={editedData.website_og_image}
                              alt="Website OG Image Preview"
                              className="w-full h-24 object-cover rounded border mt-2"
                            />
                          )}
                        </>
                      ) : restaurant?.website_og_image ? (
                        <div className="mt-2">
                          <img
                            src={restaurant.website_og_image}
                            alt="Website OG Image"
                            className="w-full h-32 object-cover rounded border"
                          />
                        </div>
                      ) : (
                        <p className="text-sm mt-2 text-muted-foreground">-</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">UberEats Image</Label>
                      {isEditing ? (
                        <>
                          <Input
                            value={editedData.ubereats_og_image || ''}
                            onChange={(e) => handleFieldChange('ubereats_og_image', e.target.value)}
                            placeholder="https://..."
                            className="mt-2"
                          />
                          {editedData.ubereats_og_image && (
                            <img
                              src={editedData.ubereats_og_image}
                              alt="UberEats Image Preview"
                              className="w-full h-24 object-cover rounded border mt-2"
                            />
                          )}
                        </>
                      ) : restaurant?.ubereats_og_image ? (
                        <div className="mt-2">
                          <img
                            src={restaurant.ubereats_og_image}
                            alt="UberEats Image"
                            className="w-full h-32 object-cover rounded border"
                          />
                        </div>
                      ) : (
                        <p className="text-sm mt-2 text-muted-foreground">-</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">DoorDash Image</Label>
                      {isEditing ? (
                        <>
                          <Input
                            value={editedData.doordash_og_image || ''}
                            onChange={(e) => handleFieldChange('doordash_og_image', e.target.value)}
                            placeholder="https://..."
                            className="mt-2"
                          />
                          {editedData.doordash_og_image && (
                            <img
                              src={editedData.doordash_og_image}
                              alt="DoorDash Image Preview"
                              className="w-full h-24 object-cover rounded border mt-2"
                            />
                          )}
                        </>
                      ) : restaurant?.doordash_og_image ? (
                        <div className="mt-2">
                          <img
                            src={restaurant.doordash_og_image}
                            alt="DoorDash Image"
                            className="w-full h-32 object-cover rounded border"
                          />
                        </div>
                      ) : (
                        <p className="text-sm mt-2 text-muted-foreground">-</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Facebook Cover</Label>
                      {isEditing ? (
                        <>
                          <Input
                            value={editedData.facebook_cover_image || ''}
                            onChange={(e) => handleFieldChange('facebook_cover_image', e.target.value)}
                            placeholder="https://..."
                            className="mt-2"
                          />
                          {editedData.facebook_cover_image && (
                            <img
                              src={editedData.facebook_cover_image}
                              alt="Facebook Cover Preview"
                              className="w-full h-24 object-cover rounded border mt-2"
                            />
                          )}
                        </>
                      ) : restaurant?.facebook_cover_image ? (
                        <div className="mt-2">
                          <img
                            src={restaurant.facebook_cover_image}
                            alt="Facebook Cover"
                            className="w-full h-32 object-cover rounded border"
                          />
                        </div>
                      ) : (
                        <p className="text-sm mt-2 text-muted-foreground">-</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Header Tags - Title and Description */}
              {(isEditing || restaurant?.website_og_title || restaurant?.website_og_description) && (
                <div className="mt-6 pt-6 border-t">
                  <Label className="text-base font-semibold mb-4 block">Header Tags</Label>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">OG Title</Label>
                      {isEditing ? (
                        <Input
                          value={editedData.website_og_title || ''}
                          onChange={(e) => handleFieldChange('website_og_title', e.target.value)}
                          placeholder="Enter OG title..."
                          className="mt-1"
                        />
                      ) : (
                        <p className="mt-1 text-sm font-medium">{restaurant?.website_og_title || '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">OG Description</Label>
                      {isEditing ? (
                        <Textarea
                          value={editedData.website_og_description || ''}
                          onChange={(e) => handleFieldChange('website_og_description', e.target.value)}
                          placeholder="Enter OG description..."
                          className="mt-1"
                          rows={3}
                        />
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">{restaurant?.website_og_description || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks and Sequences Tab */}
        {isFeatureEnabled('tasksAndSequences') && (
        <TabsContent value="tasks-sequences" className="space-y-6">
          {/* Standalone Tasks Section - Moved to top */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Standalone Tasks</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Tasks not part of any sequence
                </p>
              </div>
              <Button onClick={() => setTaskModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </div>

            <RestaurantTasksList
              restaurantId={id}
              onCreateTask={() => setTaskModalOpen(true)}
              onEditTask={(taskId) => setEditTaskId(taskId)}
              onDuplicateTask={(taskId) => setDuplicateTaskId(taskId)}
              onFollowUpTask={(taskId) => setFollowUpTaskId(taskId)}
              onStartSequence={(restaurant) => {
                setStartSequenceModalOpen(true);
              }}
              refreshKey={tasksRefreshKey}
            />
          </div>

          {/* Divider */}
          <div className="border-t my-6" />

          {/* Sequences Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Active Sequences</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Automated task sequences for this restaurant
                </p>
              </div>
              <Button onClick={() => setStartSequenceModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Start Sequence
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {sequencesLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Sequences List */}
          {!sequencesLoading && restaurantSequences?.data && restaurantSequences.data.length > 0 && (
            <div className="space-y-4">
              {restaurantSequences.data.map((instance) => (
                <SequenceProgressCard
                  key={instance.id}
                  instance={instance}
                  compact={false}
                  onPause={handlePauseSequence}
                  onResume={handleResumeSequence}
                  onCancel={handleCancelSequence}
                  onFinish={handleFinishSequence}
                  onDelete={handleDeleteSequence}
                  onRefresh={refetchSequences}
                  hideRestaurantLink={true}
                  onStartSequence={() => {
                    setStartSequenceModalOpen(true);
                  }}
                  onFollowUpTask={(taskId) => {
                    setFollowUpTaskId(taskId);
                  }}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!sequencesLoading && (!restaurantSequences?.data || restaurantSequences.data.length === 0) && (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="rounded-full bg-muted p-4">
                  <Workflow className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No active sequences</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Start a sequence to automate follow-up tasks and streamline your workflow.
                    Sequences help you stay organized and ensure nothing falls through the cracks.
                  </p>
                </div>
                <Button onClick={() => setStartSequenceModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start Your First Sequence
                </Button>
              </div>
            </Card>
          )}

          {/* Start Sequence Modal */}
          {restaurant && (
            <StartSequenceModal
              open={startSequenceModalOpen}
              onClose={() => setStartSequenceModalOpen(false)}
              restaurant={restaurant}
            />
          )}

          {/* Task Modals */}
          {taskModalOpen && !duplicateTaskId && !followUpTaskId && (
            <CreateTaskModal
              open={taskModalOpen}
              onClose={() => setTaskModalOpen(false)}
              onSuccess={() => {
                setTaskModalOpen(false);
                setTasksRefreshKey(prev => prev + 1);
              }}
              restaurantId={id}
            />
          )}

          {duplicateTaskId && (
            <CreateTaskModal
              open={!!duplicateTaskId}
              onClose={() => setDuplicateTaskId(null)}
              onSuccess={() => {
                setDuplicateTaskId(null);
                setTasksRefreshKey(prev => prev + 1);
              }}
              restaurantId={id}
              duplicateFromTaskId={duplicateTaskId}
            />
          )}

          {followUpTaskId && (
            <CreateTaskModal
              open={!!followUpTaskId}
              onClose={() => setFollowUpTaskId(null)}
              onSuccess={() => {
                setFollowUpTaskId(null);
                setTasksRefreshKey(prev => prev + 1);
              }}
              restaurantId={id}
              followUpFromTaskId={followUpTaskId}
            />
          )}

          {editTaskId && (
            <TaskDetailModal
              open={!!editTaskId}
              taskId={editTaskId}
              onClose={() => setEditTaskId(null)}
              onSuccess={() => {
                setEditTaskId(null);
                setTasksRefreshKey(prev => prev + 1);
              }}
              initialMode="edit"
            />
          )}
        </TabsContent>
        )}

        {/* Registration Tab */}
        {isFeatureEnabled('registration') && (
        <TabsContent value="registration" className="space-y-4">
          {/* Registration Status Card */}
          {(isFeatureEnabled('registration.userAccountRegistration') || isFeatureEnabled('registration.restaurantRegistration')) && (
          <Card>
            <CardHeader>
              <CardTitle>Pumpd Platform Registration</CardTitle>
              <CardDescription>
                Manage restaurant registration on the Pumpd platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingRegistrationStatus ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading registration status...</span>
                </div>
              ) : registrationStatus ? (
                <div className="space-y-4">
                  {/* Account Status */}
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Account Status</h4>
                      {registrationStatus.account?.registration_status === 'completed' ? (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Registered
                        </Badge>
                      ) : registrationStatus.account?.registration_status === 'in_progress' ? (
                        <Badge variant="warning">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Registered</Badge>
                      )}
                    </div>
                    {registrationStatus.account && (
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>Email: {registrationStatus.account.email}</p>
                        {registrationStatus.account.registration_date && (
                          <p>Registered: {new Date(registrationStatus.account.registration_date).toLocaleDateString()}</p>
                        )}
                        {registrationStatus.account.pumpd_dashboard_url && (
                          <a 
                            href={registrationStatus.account.pumpd_dashboard_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Dashboard
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Restaurant Status */}
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Restaurant Status</h4>
                      {registrationStatus.restaurant?.registration_status === 'completed' ? (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Registered
                        </Badge>
                      ) : registrationStatus.restaurant?.registration_status === 'in_progress' ? (
                        <Badge variant="warning">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Registered</Badge>
                      )}
                    </div>
                    {registrationStatus.restaurant && (
                      <div className="text-sm space-y-1 text-muted-foreground">
                        {registrationStatus.restaurant.pumpd_subdomain && (
                          <p>Subdomain: {registrationStatus.restaurant.pumpd_subdomain}</p>
                        )}
                        {registrationStatus.restaurant.pumpd_full_url && (
                          <a 
                            href={registrationStatus.restaurant.pumpd_full_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Restaurant Page
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {registrationStatus.restaurant.registration_date && (
                          <p>Registered: {new Date(registrationStatus.restaurant.registration_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!registrationStatus.account && isFeatureEnabled('registration.userAccountRegistration') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Set type to account only
                          setRegistrationType('account_only');
                          // Pre-populate from restaurant email if available
                          if (restaurant?.email) {
                            setRegistrationEmail(restaurant.email);
                          }
                          // Generate default password hint
                          if (restaurant?.name) {
                            const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
                            const defaultPassword = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
                            setRegistrationPassword(defaultPassword);
                          }
                          setRegistrationDialogOpen(true);
                        }}
                        disabled={registering}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Register Account
                      </Button>
                    )}

                    {(!registrationStatus.restaurant || registrationStatus.restaurant.registration_status === 'failed') && isFeatureEnabled('registration.restaurantRegistration') && (
                      <Button
                        onClick={() => {
                          // Pre-populate email and password from account if exists
                          if (registrationStatus.account) {
                            setRegistrationEmail(registrationStatus.account.email || '');
                            setRegistrationPassword(registrationStatus.account.user_password_hint || '');
                            // Pre-select registration type based on account's restaurant count
                            if (registrationStatus.account.restaurant_count === 0) {
                              setRegistrationType('existing_account_first_restaurant');
                            } else {
                              setRegistrationType('existing_account_additional_restaurant');
                            }
                          } else {
                            // No existing account, pre-populate from restaurant data
                            if (restaurant?.email) {
                              setRegistrationEmail(restaurant.email);
                            }
                            // Generate default password hint
                            if (restaurant?.name) {
                              const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
                              const defaultPassword = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
                              setRegistrationPassword(defaultPassword);
                            }
                          }
                          setRegistrationDialogOpen(true);
                        }}
                        disabled={registering}
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        Register Restaurant
                      </Button>
                    )}

                    <Button 
                      variant="outline"
                      onClick={fetchRegistrationLogs}
                    >
                      <History className="h-4 w-4 mr-2" />
                      View Registration Logs
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={fetchRegistrationStatus}
                      disabled={loadingRegistrationStatus}
                    >
                      <RefreshCw className={cn(
                        "h-4 w-4 mr-2",
                        loadingRegistrationStatus && "animate-spin"
                      )} />
                      Refresh Status
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">No registration found for this restaurant</p>
                  <div className="flex justify-center gap-2">
                    {isFeatureEnabled('registration.userAccountRegistration') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Set type to account only
                        setRegistrationType('account_only');
                        // Pre-populate from restaurant email if available
                        if (restaurant?.email) {
                          setRegistrationEmail(restaurant.email);
                        }
                        // Generate default password hint
                        if (restaurant?.name) {
                          const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
                          const defaultPassword = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
                          setRegistrationPassword(defaultPassword);
                        }
                        setRegistrationDialogOpen(true);
                      }}
                      disabled={registering}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Register Account
                    </Button>
                    )}
                    {isFeatureEnabled('registration.restaurantRegistration') && (
                    <Button
                      onClick={() => {
                        // Pre-populate email and password from account if exists
                        if (registrationStatus.account) {
                          setRegistrationEmail(registrationStatus.account.email || '');
                          setRegistrationPassword(registrationStatus.account.user_password_hint || '');
                          // Pre-select registration type based on account's restaurant count
                          if (registrationStatus.account.restaurant_count === 0) {
                            setRegistrationType('existing_account_first_restaurant');
                          } else {
                            setRegistrationType('existing_account_additional_restaurant');
                          }
                        } else {
                          // No existing account, pre-populate from restaurant data
                          if (restaurant?.email) {
                            setRegistrationEmail(restaurant.email);
                          }
                          // Generate default password hint
                          if (restaurant?.name) {
                            const cleaned = restaurant.name.replace(/[^a-zA-Z0-9]/g, '');
                            const defaultPassword = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + '789!';
                            setRegistrationPassword(defaultPassword);
                          }
                        }
                        setRegistrationDialogOpen(true);
                      }}
                      disabled={registering}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Register Restaurant
                    </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Recent Menus */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Menus</CardTitle>
              <CardDescription>Latest menu versions for this restaurant</CardDescription>
            </CardHeader>
            <CardContent>
              {restaurant?.menus && restaurant.menus.length > 0 ? (
                <div className="space-y-2">
                  {restaurant.menus.slice(0, 5).map((menu) => (
                    <div key={menu.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Version {menu.version}</span>
                          <span className="text-xs text-muted-foreground">
                            {menu.platforms?.name || 'Unknown'}
                          </span>
                          {menu.is_active && (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(menu.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/menus/${menu.id}`)}
                          className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Menu
                        </Button>
                        {isFeatureEnabled('csvWithImagesDownload') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUploadImagesToCDN(menu.id)}
                          className="text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Upload Images
                        </Button>
                        )}
                        {isFeatureEnabled('csvWithImagesDownload') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadCSVWithCDN(menu.id)}
                          className="text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download CSV
                        </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/menus?restaurant=${id}`)}
                  >
                    View All Menus
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No menus found</p>
              )}
            </CardContent>
          </Card>

          {/* CSV Menu Upload Card */}
          {isFeatureEnabled('registration.menuUploading') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Menu CSV Upload
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import menu items to your Pumpd restaurant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prerequisites Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {registrationStatus?.account?.registration_status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={registrationStatus?.account?.registration_status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                    Account registered
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {registrationStatus?.restaurant?.registration_status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={registrationStatus?.restaurant?.registration_status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                    Restaurant registered
                  </span>
                </div>
              </div>

              {/* File Upload Section */}
              {registrationStatus?.account?.registration_status === 'completed' && 
               registrationStatus?.restaurant?.registration_status === 'completed' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="csv-file-input">Select CSV File</Label>
                    <div className="flex gap-2">
                      <Input
                        id="csv-file-input"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCsvFileSelect}
                        disabled={isUploading}
                        className="flex-1"
                      />
                      {csvFile && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCsvFile(null);
                            setUploadError(null);
                            setUploadStatus(null);
                            const fileInput = document.getElementById('csv-file-input');
                            if (fileInput) fileInput.value = '';
                          }}
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {csvFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>

                  {/* Upload Button */}
                  <Button
                    onClick={handleCsvUpload}
                    disabled={!csvFile || isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Menu
                      </>
                    )}
                  </Button>

                  {/* Add Tags Button */}
                  {isFeatureEnabled('registration.itemTagUploading') && (
                  <Button
                    onClick={handleAddItemTags}
                    disabled={isAddingTags}
                    className="w-full"
                    variant="outline"
                  >
                    {isAddingTags ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Tags...
                      </>
                    ) : (
                      <>
                        <Tag className="h-4 w-4 mr-2" />
                        Add Item Tags
                      </>
                    )}
                  </Button>
                  )}

                  {/* Status Messages */}
                  {uploadStatus === 'success' && (
                    <Alert className="border-green-200 bg-green-50">
                      <FileCheck className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Menu uploaded successfully! The items have been imported to your Pumpd restaurant.
                      </AlertDescription>
                    </Alert>
                  )}

                  {uploadError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {uploadError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Tags Status Messages */}
                  {tagsStatus && (
                    <Alert className={tagsStatus.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                      {tagsStatus.success ? (
                        <FileCheck className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={tagsStatus.success ? 'text-green-800' : 'text-red-800'}>
                        {tagsStatus.success
                          ? 'Item tags configured successfully!'
                          : (tagsStatus.error || 'Failed to configure item tags')}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Option Sets Section */}
                  {isFeatureEnabled('registration.optionSetUploading') && (
                  <div className="border-t pt-4 mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Settings2 className="h-4 w-4" />
                        Add Option Sets from Menu
                      </div>

                      {/* Menu Dropdown */}
                      <Select
                        value={selectedMenuForOptionSets}
                        onValueChange={setSelectedMenuForOptionSets}
                        disabled={isAddingOptionSets}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a menu..." />
                        </SelectTrigger>
                        <SelectContent>
                          {restaurant?.menus && restaurant.menus.length > 0 ? (
                            restaurant.menus.map((menu) => (
                              <SelectItem key={menu.id} value={menu.id}>
                                Version {menu.version} - {menu.platforms?.name || 'Unknown'}
                                {menu.is_active && ' (Active)'}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No menus available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      {/* Add Option Sets Button */}
                      <Button
                        onClick={handleAddOptionSets}
                        disabled={isAddingOptionSets || !selectedMenuForOptionSets}
                        className="w-full"
                        variant="outline"
                      >
                        {isAddingOptionSets ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding Option Sets...
                          </>
                        ) : (
                          <>
                            <Settings2 className="h-4 w-4 mr-2" />
                            Add Option Sets
                          </>
                        )}
                      </Button>

                      {/* Option Sets Status Messages */}
                      {optionSetsStatus && (
                        <Alert className={optionSetsStatus.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                          {optionSetsStatus.success ? (
                            <FileCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <AlertDescription className={optionSetsStatus.success ? 'text-green-800' : 'text-red-800'}>
                            {optionSetsStatus.success
                              ? `Option sets configured successfully! (${optionSetsStatus.summary?.created || 0} created, ${optionSetsStatus.summary?.failed || 0} failed)`
                              : (optionSetsStatus.error || 'Failed to configure option sets')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Both account and restaurant registration must be completed before you can upload a menu.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          )}

          {/* Website Settings Card */}
          {isFeatureEnabled('registration.websiteSettings') && (
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Website Settings
                  </CardTitle>
                  <CardDescription>
                    Theme and branding settings required for website customization
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditedData(restaurant);
                      setIsEditing(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Settings
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedData({});
                      }}
                      disabled={saving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-gradient-to-r from-brand-blue to-brand-green"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Theme */}
                <div>
                  <Label>Theme</Label>
                  {isEditing ? (
                    <Select
                      value={editedData.theme || 'light'}
                      onValueChange={(value) => handleFieldChange('theme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.theme ? (
                        <Badge variant="outline">{restaurant.theme}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Cuisine */}
                <div>
                  <Label>Cuisine</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.cuisine?.join(', ') || ''}
                      onChange={(e) => handleFieldChange('cuisine', e.target.value.split(',').map(c => c.trim()))}
                      placeholder="e.g., Italian, Pizza, Pasta"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {restaurant?.cuisine?.length > 0 ? (
                        restaurant.cuisine.map((c, i) => (
                          <Badge key={i} variant="secondary">{c}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Primary Color */}
                <div>
                  <Label>Primary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.primary_color || '#000000'}
                        onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.primary_color || ''}
                        onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.primary_color ? (
                        <>
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: restaurant.primary_color }}
                          />
                          <span className="text-sm">{restaurant.primary_color}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Secondary Color */}
                <div>
                  <Label>Secondary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.secondary_color || '#000000'}
                        onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.secondary_color || ''}
                        onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.secondary_color ? (
                        <>
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: restaurant.secondary_color }}
                          />
                          <span className="text-sm">{restaurant.secondary_color}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status indicators */}
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    {restaurant?.theme ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={restaurant?.theme ? 'text-green-600' : 'text-gray-500'}>Theme</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {restaurant?.cuisine?.length > 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={restaurant?.cuisine?.length > 0 ? 'text-green-600' : 'text-gray-500'}>Cuisine</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {restaurant?.primary_color ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={restaurant?.primary_color ? 'text-green-600' : 'text-gray-500'}>Primary</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {restaurant?.secondary_color ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={restaurant?.secondary_color ? 'text-green-600' : 'text-gray-500'}>Secondary</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Website Customization Card */}
          {(isFeatureEnabled('registration.codeInjection') || isFeatureEnabled('registration.websiteSettings')) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Website Customization
              </CardTitle>
              <CardDescription>
                Generate and apply custom styling to your Pumpd website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prerequisites Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {registrationStatus?.account?.registration_status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={registrationStatus?.account?.registration_status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                    Account registered
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {registrationStatus?.restaurant?.registration_status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={registrationStatus?.restaurant?.registration_status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                    Restaurant registered
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {restaurant?.primary_color && restaurant?.secondary_color ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={restaurant?.primary_color && restaurant?.secondary_color ? 'text-green-600' : 'text-gray-500'}>
                    Theme colors configured
                    {restaurant?.primary_color && restaurant?.secondary_color && (
                      <span className="ml-2">
                        <span 
                          className="inline-block w-3 h-3 rounded-full border border-gray-300" 
                          style={{ backgroundColor: restaurant.primary_color }}
                          title={`Primary: ${restaurant.primary_color}`}
                        />
                        <span 
                          className="inline-block w-3 h-3 rounded-full border border-gray-300 ml-1" 
                          style={{ backgroundColor: restaurant.secondary_color }}
                          title={`Secondary: ${restaurant.secondary_color}`}
                        />
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {registrationStatus?.account?.registration_status === 'completed' && 
               registrationStatus?.restaurant?.registration_status === 'completed' &&
               restaurant?.primary_color && restaurant?.secondary_color ? (
                <div className="space-y-4">
                  {/* Mode Selector */}
                  <div className="space-y-2">
                    <Label>Configuration Method</Label>
                    <RadioGroup value={customizationMode} onValueChange={handleModeChange}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="generate" id="mode-generate" />
                        <Label htmlFor="mode-generate" className="font-normal cursor-pointer">
                          Generate new code injections
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="existing" id="mode-existing" />
                        <Label htmlFor="mode-existing" className="font-normal cursor-pointer">
                          Use existing HTML files
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Mode-specific UI */}
                  {customizationMode === 'generate' ? (
                    <>
                      {/* Generate Code Injections Button */}
                      {isFeatureEnabled('registration.codeInjection') && (
                      <div className="space-y-2">
                        <Button
                          onClick={handleGenerateCodeInjections}
                          disabled={isGenerating || isConfiguring}
                          className="w-full"
                          variant={codeGenerated ? "outline" : "default"}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Code className="h-4 w-4 mr-2" />
                              {codeGenerated ? 'Regenerate Code Injections' : 'Generate Code Injections'}
                            </>
                          )}
                        </Button>
                        {codeGenerated && (
                          <p className="text-xs text-muted-foreground text-center">
                            Code injections ready for configuration
                          </p>
                        )}
                      </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* File Path Inputs */}
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="head-path">Head Injection File Path</Label>
                          <Input
                            id="head-path"
                            type="text"
                            placeholder="/path/to/head-injection.html"
                            value={existingHeadPath}
                            onChange={(e) => setExistingHeadPath(e.target.value)}
                            disabled={isValidating || isConfiguring}
                          />
                          <p className="text-xs text-muted-foreground">
                            Full path to your head injection HTML file
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="body-path">Body Injection File Path</Label>
                          <Input
                            id="body-path"
                            type="text"
                            placeholder="/path/to/body-injection.html"
                            value={existingBodyPath}
                            onChange={(e) => setExistingBodyPath(e.target.value)}
                            disabled={isValidating || isConfiguring}
                          />
                          <p className="text-xs text-muted-foreground">
                            Full path to your body injection HTML file
                          </p>
                        </div>

                        {/* Validate Files Button */}
                        <Button
                          onClick={handleValidateFiles}
                          disabled={!existingHeadPath || !existingBodyPath || isValidating || isConfiguring}
                          className="w-full"
                          variant={filesValidated ? "outline" : "default"}
                        >
                          {isValidating ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            <>
                              <FileCheck className="h-4 w-4 mr-2" />
                              {filesValidated ? 'Files Validated ✓' : 'Validate Files'}
                            </>
                          )}
                        </Button>
                        {filesValidated && (
                          <p className="text-xs text-muted-foreground text-center">
                            Files validated and ready for configuration
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Configure Website Settings Button (shown for both modes) */}
                  {isFeatureEnabled('registration.websiteSettings') && (
                  <Button
                    onClick={handleConfigureWebsite}
                    disabled={
                      (customizationMode === 'generate' && !codeGenerated) ||
                      (customizationMode === 'existing' && !filesValidated) ||
                      isConfiguring || isGenerating || isValidating
                    }
                    className="w-full"
                    variant="default"
                  >
                    {isConfiguring ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Configuring...
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Website Settings
                      </>
                    )}
                  </Button>
                  )}

                  {/* Status Messages */}
                  {customizationStatus && (
                    <Alert className={customizationStatus.success ? 'border-green-600' : 'border-destructive'}>
                      {customizationStatus.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription className={customizationStatus.success ? 'text-green-600' : ''}>
                        {customizationStatus.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Info Alert */}
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 text-sm">
                      <strong>Note:</strong> Website customization will use {restaurant?.theme === 'light' ? 'light' : 'dark'} theme mode.
                      {customizationMode === 'generate' ? (
                        <> First generate code injections, then apply them to your website.</>
                      ) : (
                        <> Validate your HTML files first, then apply them to your website.</>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {!restaurant?.primary_color || !restaurant?.secondary_color ? (
                      <>Theme colors must be configured in the Branding tab before customizing website.</>
                    ) : (
                      <>Account and restaurant registration must be completed before customizing website.</>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          )}

          {/* Payment & Services Configuration Card */}
          {(isFeatureEnabled('registration.stripePayments') || isFeatureEnabled('registration.servicesConfiguration')) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment & Services Configuration
              </CardTitle>
              <CardDescription>
                Configure Stripe payments and service settings for your restaurant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prerequisites Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {registrationStatus?.account?.registration_status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={registrationStatus?.account?.registration_status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                    Account registered
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {registrationStatus?.restaurant?.registration_status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={registrationStatus?.restaurant?.registration_status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                    Restaurant registered
                  </span>
                </div>
                {restaurant?.stripe_connect_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-yellow-600">
                      Stripe Connect URL available - complete setup if not done
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {registrationStatus?.account?.registration_status === 'completed' && 
               registrationStatus?.restaurant?.registration_status === 'completed' ? (
                <div className="space-y-4">
                  {/* Stripe configuration options */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeConnectLink"
                        checked={includeConnectLink}
                        onChange={(e) => setIncludeConnectLink(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="includeConnectLink" className="text-sm text-gray-700">
                        Include "Connect to Stripe" button (use if button is visible in UI)
                      </label>
                    </div>
                    
                    <div className="flex gap-4">
                      {isFeatureEnabled('registration.stripePayments') && (
                      <Button
                        onClick={handleSetupStripePayments}
                        disabled={isConfiguringPayments}
                        className="flex items-center gap-2"
                      >
                        {isConfiguringPayments ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Configuring Stripe...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            Setup Stripe Payments
                          </>
                        )}
                      </Button>
                      )}

                      {isFeatureEnabled('registration.servicesConfiguration') && (
                      <Button
                        onClick={handleConfigureServices}
                        disabled={isConfiguringServices}
                        className="flex items-center gap-2"
                        variant="outline"
                      >
                        {isConfiguringServices ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Configuring Services...
                          </>
                        ) : (
                          <>
                            <Settings className="h-4 w-4" />
                            Configure Services
                          </>
                        )}
                      </Button>
                      )}
                    </div>
                  </div>

                  {/* Payment Status/Results */}
                  {paymentStatus && (
                    <Alert className={paymentStatus.success ? 'border-green-500' : 'border-red-500'}>
                      <AlertDescription>
                        {paymentStatus.success ? (
                          <>
                            <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                            {paymentStatus.message || 'Stripe configuration completed!'}
                            {paymentStatus.stripeConnectUrl && (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                <strong className="block mb-2">Complete Stripe setup:</strong>
                                <a 
                                  href={paymentStatus.stripeConnectUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline break-all flex items-center gap-1"
                                >
                                  {paymentStatus.stripeConnectUrl}
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                            {paymentStatus.error || 'Failed to configure Stripe payments'}
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Services Status/Results */}
                  {servicesStatus && (
                    <Alert className={servicesStatus.success ? 'border-green-500' : 'border-red-500'}>
                      <AlertDescription>
                        {servicesStatus.success ? (
                          <>
                            <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                            {servicesStatus.message || 'Services configured successfully!'}
                          </>
                        ) : (
                          <>
                            <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                            {servicesStatus.error || 'Failed to configure services'}
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Show existing Stripe URL if available */}
                  {restaurant?.stripe_connect_url && !paymentStatus && (
                    <Alert className="border-blue-500">
                      <AlertDescription>
                        <AlertCircle className="inline h-4 w-4 text-blue-500 mr-2" />
                        <strong>Existing Stripe Connect URL:</strong>
                        <a 
                          href={restaurant.stripe_connect_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block mt-2 text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {restaurant.stripe_connect_url}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Account and restaurant registration must be completed before configuring payments and services.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          )}

          {/* Onboarding User Management Card */}
          {isFeatureEnabled('registration.onboardingUserManagement') && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Onboarding User Management
              </CardTitle>
              <CardDescription>
                Create and manage onboarding users for restaurant setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">User Name</label>
                  <Input
                    value={onboardingUserName}
                    onChange={(e) => setOnboardingUserName(e.target.value)}
                    placeholder="Restaurant Owner Name"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">User Email</label>
                  <Input
                    type="email"
                    value={onboardingUserEmail}
                    onChange={(e) => setOnboardingUserEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">
                    Password (optional - auto-generated if empty)
                  </label>
                  <Input
                    type="text"
                    value={onboardingUserPassword}
                    onChange={(e) => setOnboardingUserPassword(e.target.value)}
                    placeholder="Leave empty for auto-generation"
                    className="mt-1"
                  />
                  {!onboardingUserPassword && restaurant?.name && (
                    <p className="text-xs text-gray-500 mt-1">
                      Will use: {generateDefaultPassword(restaurant.name)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Stripe Connect URL</label>
                  <Input
                    type="url"
                    value={onboardingStripeConnectUrl}
                    onChange={(e) => setOnboardingStripeConnectUrl(e.target.value)}
                    placeholder="https://connect.stripe.com/..."
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {onboardingStripeConnectUrl
                      ? 'URL will be saved when updating record'
                      : 'Paste the Stripe Connect onboarding link here'}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4">
                <Button
                  onClick={handleCreateOnboardingUser}
                  disabled={isCreatingOnboardingUser || !onboardingUserName || !onboardingUserEmail}
                  className="flex items-center gap-2"
                >
                  {isCreatingOnboardingUser ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create Onboarding User
                    </>
                  )}
                </Button>
                
                {isFeatureEnabled('registration.onboardingSync') && (
                <Button
                  onClick={handleUpdateOnboardingRecord}
                  disabled={isUpdatingOnboarding || !onboardingUserEmail}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isUpdatingOnboarding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating Record...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      Update Onboarding Record
                    </>
                  )}
                </Button>
                )}
              </div>
              
              {/* Status displays */}
              {onboardingUserStatus && (
                <Alert className={onboardingUserStatus.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {onboardingUserStatus.success ? (
                      <>
                        <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                        {onboardingUserStatus.message || 'Onboarding user created successfully'}
                        {onboardingUserStatus.userEmail && (
                          <span className="block mt-1">
                            Email: {onboardingUserStatus.userEmail}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                        {onboardingUserStatus.error || 'Failed to create onboarding user'}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              {onboardingUpdateStatus && (
                <Alert className={onboardingUpdateStatus.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {onboardingUpdateStatus.success ? (
                      <>
                        <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                        Record updated successfully
                        {onboardingUpdateStatus.onboardingId && (
                          <span className="block mt-1 text-xs text-gray-600">
                            Onboarding ID: {onboardingUpdateStatus.onboardingId}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                        {onboardingUpdateStatus.error || 'Failed to update onboarding record'}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          )}

          {/* Finalise Setup Card */}
          {isFeatureEnabled('registration.finalisingSetup') && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Finalise Setup
              </CardTitle>
              <CardDescription>
                Complete the restaurant configuration with system settings, API key creation, and Uber integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prerequisites Check */}
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Prerequisites:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Restaurant must have a Pumpd account created</li>
                      <li>User credentials must be available in the database</li>
                      <li>Restaurant must be registered on the platform</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Receipt Logo Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Receipt Logo Selection
                </label>
                <div className="flex items-center gap-4">
                  <Select value={receiptLogoVersion} onValueChange={setReceiptLogoVersion}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select receipt logo version" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurant?.logo_url && (
                        <SelectItem value="logo_url">Original Logo</SelectItem>
                      )}
                      {restaurant?.logo_nobg_url && (
                        <SelectItem value="logo_nobg_url">No Background Logo</SelectItem>
                      )}
                      {restaurant?.logo_standard_url && (
                        <SelectItem value="logo_standard_url">Standard Logo</SelectItem>
                      )}
                      {restaurant?.logo_thermal_url && (
                        <SelectItem value="logo_thermal_url">Thermal Logo</SelectItem>
                      )}
                      {restaurant?.logo_thermal_alt_url && (
                        <SelectItem value="logo_thermal_alt_url">Thermal Alt Logo</SelectItem>
                      )}
                      {restaurant?.logo_thermal_contrast_url && (
                        <SelectItem value="logo_thermal_contrast_url">Thermal High Contrast</SelectItem>
                      )}
                      {restaurant?.logo_thermal_adaptive_url && (
                        <SelectItem value="logo_thermal_adaptive_url">Thermal Adaptive</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {receiptLogoVersion && restaurant?.[receiptLogoVersion] && (
                    <div className="flex items-center gap-2">
                      <img
                        src={restaurant[receiptLogoVersion]}
                        alt="Selected receipt logo"
                        className="h-12 w-12 object-contain border rounded p-1"
                      />
                      <Badge variant="secondary">Selected</Badge>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  This logo will be converted to PNG format and used for receipts
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Setup System Settings Button */}
                <Card className="border-2 hover:border-brand-blue transition-colors">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Settings className="h-8 w-8 text-brand-blue" />
                        {systemSettingsStatus?.success && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold">System Settings</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Configure GST, pickup times, and other system settings
                        </p>
                      </div>
                      {isFeatureEnabled('registration.finalisingSetup') && (
                      <Button
                        onClick={handleSetupSystemSettings}
                        disabled={isSettingUpSystemSettings || !restaurant?.id}
                        className="w-full"
                        variant={systemSettingsStatus?.success ? "outline" : "default"}
                      >
                        {isSettingUpSystemSettings ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Configuring...
                          </>
                        ) : systemSettingsStatus?.success ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reconfigure
                          </>
                        ) : (
                          <>
                            <Settings className="h-4 w-4 mr-2" />
                            Setup Settings
                          </>
                        )}
                      </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Create API Key Button */}
                <Card className="border-2 hover:border-brand-blue transition-colors">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Code className="h-8 w-8 text-brand-blue" />
                        {apiKeyStatus?.success && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold">API Key</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Generate API key for online ordering integration
                        </p>
                      </div>
                      <Button
                        onClick={handleCreateApiKey}
                        disabled={isCreatingApiKey || !restaurant?.id || !setupCompletionStatus.system_settings}
                        className="w-full"
                        variant={apiKeyStatus?.success ? "outline" : "default"}
                      >
                        {isCreatingApiKey ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : apiKeyStatus?.success ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Regenerate
                          </>
                        ) : (
                          <>
                            <Code className="h-4 w-4 mr-2" />
                            Create API Key
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Configure Uber Integration Button */}
                <Card className="border-2 hover:border-brand-blue transition-colors">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Link2 className="h-8 w-8 text-brand-blue" />
                        {uberIntegrationStatus?.success && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold">Uber Integration</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Complete Uber OAuth and configure integration
                        </p>
                      </div>
                      <Button
                        onClick={handleConfigureUberIntegration}
                        disabled={isConfiguringUberIntegration || !restaurant?.id || !setupCompletionStatus.api_key}
                        className="w-full"
                        variant={uberIntegrationStatus?.success ? "outline" : "default"}
                      >
                        {isConfiguringUberIntegration ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Configuring...
                          </>
                        ) : uberIntegrationStatus?.success ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reconfigure
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" />
                            Configure Uber
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status Messages */}
              {systemSettingsStatus && (
                <Alert className={systemSettingsStatus.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {systemSettingsStatus.success ? (
                      <>
                        <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                        {systemSettingsStatus.message || 'System settings configured successfully'}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                        {systemSettingsStatus.error || 'Failed to configure system settings'}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {apiKeyStatus && (
                <Alert className={apiKeyStatus.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {apiKeyStatus.success ? (
                      <>
                        <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                        {apiKeyStatus.message || 'API key created successfully'}
                        {apiKeyStatus.apiKey && (
                          <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-sm">
                            {apiKeyStatus.apiKey}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                        {apiKeyStatus.error || 'Failed to create API key'}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {uberIntegrationStatus && (
                <Alert className={uberIntegrationStatus.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {uberIntegrationStatus.success ? (
                      <>
                        <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
                        {uberIntegrationStatus.message || 'Uber integration configured successfully'}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
                        {uberIntegrationStatus.error || 'Failed to configure Uber integration'}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>
        )}
      </Tabs>

      {/* Logo Candidate Selection Dialog */}
      <Dialog open={logoDialogOpen} onOpenChange={setLogoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Restaurant Logo</DialogTitle>
            <DialogDescription>
              Choose the correct logo for your restaurant from the candidates found on the website.
              {logoCandidates.length > 0 && (
                <span className="block mt-1 text-xs">
                  Found {logoCandidates.length} potential logo{logoCandidates.length !== 1 ? 's' : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingCandidates ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-brand-blue" />
              <span className="ml-3">Finding logo candidates...</span>
            </div>
          ) : logoCandidates.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>• Click radio button to select the main logo (click again to deselect)</p>
                <p>• Check boxes to save additional images for future use (social media, marketing, etc.)</p>
                <p>• You can save images without selecting a main logo when using manual URL entry</p>
              </div>
              <RadioGroup value={selectedLogoCandidate} onValueChange={setSelectedLogoCandidate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {logoCandidates.map((candidate, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "relative border rounded-lg p-4 transition-all",
                        selectedLogoCandidate === candidate.url 
                          ? "border-brand-blue bg-blue-50/50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-2">
                          <RadioGroupItem 
                            value={candidate.url}
                            className="mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Allow deselecting by clicking again
                              if (selectedLogoCandidate === candidate.url) {
                                setSelectedLogoCandidate(null);
                              } else {
                                setSelectedLogoCandidate(candidate.url);
                              }
                            }}
                          />
                          <Checkbox
                            checked={selectedAdditionalImages.includes(candidate.url)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAdditionalImages([...selectedAdditionalImages, candidate.url]);
                              } else {
                                setSelectedAdditionalImages(selectedAdditionalImages.filter(url => url !== candidate.url));
                              }
                            }}
                            disabled={selectedLogoCandidate === candidate.url}
                            className="ml-0.5"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="mb-2">
                            <img 
                              src={candidate.preview || candidate.url}
                              alt={`Logo candidate ${index + 1}`}
                              className="max-h-32 max-w-full object-contain mx-auto border rounded bg-white p-2"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = candidate.url;
                              }}
                            />
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Confidence:</span>
                              <Badge variant={candidate.confidence >= 70 ? "default" : candidate.confidence >= 40 ? "secondary" : "outline"}>
                                {candidate.confidence}%
                              </Badge>
                            </div>
                            {candidate.width && candidate.height && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Size:</span>
                                <span>{candidate.width} × {candidate.height}px</span>
                              </div>
                            )}
                            {candidate.location && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Location:</span>
                                <span className="capitalize">{candidate.location}</span>
                              </div>
                            )}
                            {candidate.format && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Format:</span>
                                <span className="uppercase">{candidate.format}</span>
                              </div>
                            )}
                            {candidate.reason && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-muted-foreground leading-tight">{candidate.reason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No logo candidates found</p>
              {restaurant?.website_url && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Visit the website to find the logo:
                  </p>
                  <a 
                    href={restaurant.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-brand-blue hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {restaurant.website_url}
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Right-click on the logo image and select "Copy Image Address"
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setLogoDialogOpen(false)}
                disabled={processingLogo}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const url = prompt('Enter the direct URL to the logo image:');
                  if (url) {
                    setSelectedLogoCandidate(url);
                    // Process immediately after setting the URL
                    setProcessingLogo(true);
                    setError('');
                    
                    try {
                      // Prepare additional images data  
                      const additionalImages = selectedAdditionalImages.map(imageUrl => {
                        const candidate = logoCandidates.find(c => c.url === imageUrl);
                        return {
                          url: imageUrl,
                          confidence: candidate?.confidence || 0,
                          location: candidate?.location || '',
                          description: candidate?.reason || ''
                        };
                      });

                      const response = await api.post('/website-extraction/process-selected-logo', {
                        restaurantId: id,
                        logoUrl: url,
                        websiteUrl: restaurant.website_url,
                        additionalImages
                      });
                      
                      if (response.data.success) {
                        const data = response.data.data;
                        
                        // Update local state with extracted logo and colors
                        const updates = {};
                        
                        if (data.logoVersions?.original) {
                          updates.logo_url = data.logoVersions.original;
                        }
                        if (data.logoVersions?.nobg) {
                          updates.logo_nobg_url = data.logoVersions.nobg;
                        }
                        if (data.logoVersions?.standard) {
                          updates.logo_standard_url = data.logoVersions.standard;
                        }
                        if (data.logoVersions?.thermal) {
                          updates.logo_thermal_url = data.logoVersions.thermal;
                        }
                        if (data.logoVersions?.thermal_alt) {
                          updates.logo_thermal_alt_url = data.logoVersions.thermal_alt;
                        }
                        if (data.logoVersions?.thermal_contrast) {
                          updates.logo_thermal_contrast_url = data.logoVersions.thermal_contrast;
                        }
                        if (data.logoVersions?.thermal_adaptive) {
                          updates.logo_thermal_adaptive_url = data.logoVersions.thermal_adaptive;
                        }
                        if (data.logoVersions?.favicon) {
                          updates.logo_favicon_url = data.logoVersions.favicon;
                        }
                        if (data.colors?.primaryColor) {
                          updates.primary_color = data.colors.primaryColor;
                        }
                        if (data.colors?.secondaryColor) {
                          updates.secondary_color = data.colors.secondaryColor;
                        }
                        if (data.colors?.tertiaryColor) {
                          updates.tertiary_color = data.colors.tertiaryColor;
                        }
                        if (data.colors?.accentColor) {
                          updates.accent_color = data.colors.accentColor;
                        }
                        if (data.colors?.backgroundColor) {
                          updates.background_color = data.colors.backgroundColor;
                        }
                        if (data.colors?.theme) {
                          updates.theme = data.colors.theme;
                        }
                        
                        // Update both restaurant and editedData
                        setRestaurant(prev => ({
                          ...prev,
                          ...updates
                        }));
                        
                        setEditedData(prev => ({
                          ...prev,
                          ...updates
                        }));
                        
                        toast({
                          title: "Success",
                          description: "Logo and brand colors extracted successfully",
                        });
                        
                        // Close dialog and reset state
                        setLogoDialogOpen(false);
                        setSelectedLogoCandidate('');
                        setLogoCandidates([]);
                        setError(null);
                      } else {
                        setError(response.data.error || 'Failed to process logo');
                      }
                    } catch (err) {
                      console.error('Error processing logo:', err);
                      setError(err.response?.data?.error || 'Failed to process logo');
                    } finally {
                      setProcessingLogo(false);
                    }
                  }
                }}
                disabled={processingLogo}
              >
                Enter URL Manually
              </Button>
            </div>
            <Button
              onClick={handleProcessSelectedLogo}
              disabled={!selectedLogoCandidate || processingLogo}
            >
              {processingLogo ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Use Selected Logo
                  {selectedAdditionalImages.length > 0 && (
                    <span className="ml-1 text-xs">
                      (+{selectedAdditionalImages.length} images)
                    </span>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
          
          {restaurant?.website_url && logoCandidates.length > 0 && (
            <div className="text-center pt-4 mt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Don't see the correct logo? Visit the website:
              </p>
              <a 
                href={restaurant.website_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-brand-blue hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                {restaurant.website_url}
              </a>
              <p className="text-xs text-muted-foreground mt-2">
                Right-click on the logo and select "Copy Image Address", then use "Enter URL Manually" above
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Process Logo Dialog */}
      <Dialog open={processLogoDialogOpen} onOpenChange={setProcessLogoDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Process Restaurant Logo</DialogTitle>
            <DialogDescription>
              {!restaurant?.logo_url 
                ? "Choose how to add and process your restaurant logo"
                : "Update or reprocess your restaurant logo"}
            </DialogDescription>
          </DialogHeader>
          
          {!restaurant?.logo_url ? (
            // Mode A: No Existing Logo
            <div className="space-y-4">
              <RadioGroup value={processMode} onValueChange={setProcessMode}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="extract" id="extract" />
                  <label htmlFor="extract" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Extract logo from website</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically find and extract logo from your website
                      </p>
                    </div>
                  </label>
                </div>
                
                <div className="flex items-start space-x-2 mt-3">
                  <RadioGroupItem value="manual" id="manual" />
                  <label htmlFor="manual" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Enter logo URL manually</p>
                      <p className="text-sm text-muted-foreground">
                        Provide a direct link to your logo image
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>

              {processMode === 'manual' && (
                <div className="space-y-2">
                  <Label htmlFor="manualLogoUrl">Logo URL</Label>
                  <Input
                    id="manualLogoUrl"
                    value={newLogoUrl}
                    onChange={(e) => setNewLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              )}

              {restaurant?.website_url && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Visit website to find logo:</p>
                  <a 
                    href={restaurant.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-blue hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {restaurant.website_url}
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Right-click on logo and select "Copy Image Address"
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Mode B: Existing Logo Present
            <div className="space-y-4">
              {/* Show current logo */}
              <div>
                <p className="font-medium mb-2">Current Logo:</p>
                <img 
                  src={restaurant.logo_url} 
                  alt="Current logo" 
                  className="h-20 object-contain border rounded p-2"
                />
              </div>

              <RadioGroup value={processMode} onValueChange={setProcessMode}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="reprocess" id="reprocess" />
                  <label htmlFor="reprocess" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Reprocess existing logo</p>
                      <p className="text-sm text-muted-foreground">
                        Generate updated versions from current logo
                      </p>
                    </div>
                  </label>
                </div>
                
                <div className="flex items-start space-x-2 mt-3">
                  <RadioGroupItem value="replace" id="replace" />
                  <label htmlFor="replace" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Replace with new logo URL</p>
                      <p className="text-sm text-muted-foreground">
                        Provide a different logo image
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>

              {processMode === 'replace' && (
                <div className="space-y-2">
                  <Label htmlFor="replaceLogoUrl">New Logo URL</Label>
                  <Input
                    id="replaceLogoUrl"
                    value={newLogoUrl}
                    onChange={(e) => setNewLogoUrl(e.target.value)}
                    placeholder="https://example.com/new-logo.png"
                  />
                </div>
              )}

              {/* Version selection checkboxes */}
              <div className="space-y-2">
                <p className="font-medium">
                  {processMode === 'reprocess' 
                    ? 'Select versions to regenerate:' 
                    : processMode === 'replace' 
                      ? 'Select which versions to replace:' 
                      : ''}
                </p>
                
                {(processMode === 'reprocess' || processMode === 'replace') && (
                  <div className="space-y-2 pl-4">
                    {processMode === 'replace' && (
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={versionsToUpdate.logo_url}
                          onChange={(e) => setVersionsToUpdate(prev => ({
                            ...prev,
                            logo_url: e.target.checked
                          }))}
                        />
                        <span className="text-sm">Logo URL (Original)</span>
                      </label>
                    )}
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_nobg_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_nobg_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (No Background) - Remove/update background</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_standard_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_standard_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (Standard) - 500x500 optimized version</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_thermal_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_thermal_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (Thermal - Inverted) - For light background logos</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_thermal_alt_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_thermal_alt_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (Thermal - Standard) - For dark background logos</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_thermal_contrast_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_thermal_contrast_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (Thermal - High Contrast) - Binary black/white</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_thermal_adaptive_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_thermal_adaptive_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (Thermal - Adaptive) - Preserves mid-tones</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={versionsToUpdate.logo_favicon_url}
                        onChange={(e) => setVersionsToUpdate(prev => ({
                          ...prev,
                          logo_favicon_url: e.target.checked
                        }))}
                      />
                      <span className="text-sm">Logo (Favicon) - 32x32 browser icon</span>
                    </label>

                    {/* Color Selection */}
                    {processMode === 'replace' && (
                      <>
                        <div className="mt-4 mb-2 pt-3 border-t">
                          <p className="text-sm font-medium text-gray-700">Brand Colors to Update:</p>
                        </div>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={colorsToUpdate.primary_color}
                            onChange={(e) => setColorsToUpdate(prev => ({
                              ...prev,
                              primary_color: e.target.checked
                            }))}
                          />
                          <span className="text-sm">Primary Color</span>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={colorsToUpdate.secondary_color}
                            onChange={(e) => setColorsToUpdate(prev => ({
                              ...prev,
                              secondary_color: e.target.checked
                            }))}
                          />
                          <span className="text-sm">Secondary Color</span>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={colorsToUpdate.tertiary_color}
                            onChange={(e) => setColorsToUpdate(prev => ({
                              ...prev,
                              tertiary_color: e.target.checked
                            }))}
                          />
                          <span className="text-sm">Tertiary Color</span>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={colorsToUpdate.accent_color}
                            onChange={(e) => setColorsToUpdate(prev => ({
                              ...prev,
                              accent_color: e.target.checked
                            }))}
                          />
                          <span className="text-sm">Accent Color</span>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={colorsToUpdate.background_color}
                            onChange={(e) => setColorsToUpdate(prev => ({
                              ...prev,
                              background_color: e.target.checked
                            }))}
                          />
                          <span className="text-sm">Background Color</span>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={colorsToUpdate.theme}
                            onChange={(e) => setColorsToUpdate(prev => ({
                              ...prev,
                              theme: e.target.checked
                            }))}
                          />
                          <span className="text-sm">Theme (Light/Dark)</span>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>

              {restaurant?.website_url && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Visit website:</p>
                  <a 
                    href={restaurant.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-blue hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {restaurant.website_url}
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setProcessLogoDialogOpen(false);
              setNewLogoUrl('');
              setProcessMode('manual');
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => handleProcessLogo()}
              disabled={processingLogo || (processMode === 'manual' && !newLogoUrl) || (processMode === 'replace' && !newLogoUrl)}
            >
              {processingLogo ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : processMode === 'extract' ? (
                'Continue'
              ) : (
                'Process Logo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform Extraction Dialog */}
      <Dialog open={extractionDialogOpen} onOpenChange={setExtractionDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Start Menu Extraction</DialogTitle>
            <DialogDescription>
              Confirm extraction configuration before proceeding
            </DialogDescription>
          </DialogHeader>
          
          {extractionConfig && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Restaurant</Label>
                  <p className="font-medium">{extractionConfig.restaurantName}</p>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Platform</Label>
                  <p className="font-medium">{extractionConfig.platformName}</p>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">URL</Label>
                  <p className="text-sm text-gray-600 break-all">{extractionConfig.url}</p>
                </div>
              </div>
              
              {/* Show extraction mode options only for UberEats */}
              {extractionConfig.platform === 'ubereats' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Extraction Mode</Label>
                    <RadioGroup value={extractionMode} onValueChange={setExtractionMode}>
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value="standard" id="standard" />
                          <Label htmlFor="standard" className="flex-1 cursor-pointer">
                            <div className="font-medium">Standard Extraction</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Fast extraction of menu items with images and basic information
                            </div>
                          </Label>
                        </div>
                        
                        {isFeatureEnabled('premiumExtraction') && (
                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value="premium" id="premium" />
                          <Label htmlFor="premium" className="flex-1 cursor-pointer">
                            <div className="font-medium">Premium Extraction</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Advanced extraction with customization options, modifiers, and validated images
                            </div>
                          </Label>
                        </div>
                        )}
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Show premium options when premium mode is selected */}
                  {extractionMode === 'premium' && isFeatureEnabled('premiumExtraction') && (
                    <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label className="text-sm font-medium">Premium Options</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="extractOptionSets"
                            checked={extractOptionSets}
                            onCheckedChange={setExtractOptionSets}
                          />
                          <Label htmlFor="extractOptionSets" className="text-sm cursor-pointer">
                            Extract customization options (toppings, sizes, etc.)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="validateImages"
                            checked={validateImages}
                            onCheckedChange={setValidateImages}
                          />
                          <Label htmlFor="validateImages" className="text-sm cursor-pointer">
                            Validate and optimize menu images
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {extractionMode === 'premium' && extractionConfig.platform === 'ubereats' ? (
                    <>
                      Premium extraction will extract detailed menu information including all customization options. 
                      This process may take several minutes depending on the menu size.
                    </>
                  ) : (
                    <>
                      This will scan the menu categories and extract all menu items from the {extractionConfig.platformName} page. 
                      The process may take several minutes depending on the menu size.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtractionDialogOpen(false)}
              disabled={isExtracting}
            >
              Cancel
            </Button>
            <Button
              onClick={startPlatformExtraction}
              disabled={isExtracting || !extractionConfig}
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting extraction...
                </>
              ) : (
                'Start Extraction'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Business Details Extraction Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Extract Business Details</DialogTitle>
            <DialogDescription>
              Select which business details to extract from {detailsExtractionConfig?.platformName}
            </DialogDescription>
          </DialogHeader>
          
          {detailsExtractionConfig && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Platform</Label>
                  <p className="font-medium">{detailsExtractionConfig.platformName}</p>
                </div>
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">URL</Label>
                  <p className="text-sm text-gray-600 break-all">{detailsExtractionConfig.url}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select fields to extract:</Label>
                {detailsExtractionConfig.availableFields.map(field => (
                  <div key={field} className="flex items-center space-x-3">
                    <Checkbox
                      id={field}
                      checked={selectedDetailFields.includes(field)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDetailFields(prev => [...prev, field]);
                        } else {
                          setSelectedDetailFields(prev => prev.filter(f => f !== field));
                        }
                      }}
                    />
                    <Label 
                      htmlFor={field}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {detailsExtractionConfig.fieldLabels[field]}
                    </Label>
                  </div>
                ))}
              </div>
              
              {detailsExtractionConfig.availableFields.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This platform does not support business details extraction
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {detailsExtractionConfig.platform === 'ubereats' ? 
                      'UberEats can provide address and opening hours information.' :
                      detailsExtractionConfig.platform === 'doordash' ?
                      'DoorDash can only provide opening hours information.' :
                      detailsExtractionConfig.platform === 'website' ?
                      'Website extraction can provide address, opening hours, and phone number.' :
                      'This platform can provide address, opening hours, and phone number.'
                    }
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
              disabled={extractingDetails}
            >
              Cancel
            </Button>
            <Button
              onClick={startDetailsExtraction}
              disabled={extractingDetails || selectedDetailFields.length === 0}
            >
              {extractingDetails ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Details'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration Type Selection Dialog */}
      <Dialog open={registrationDialogOpen} onOpenChange={(open) => {
        setRegistrationDialogOpen(open);
        // Reset registration type when dialog is closed
        if (!open) {
          setRegistrationType('');
          setRegistrationEmail('');
          setRegistrationPassword('');
          setShowPassword(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {registrationType === 'account_only' ? 'Register Account on Pumpd' : 'Register Restaurant on Pumpd'}
            </DialogTitle>
            <DialogDescription>
              {registrationType === 'account_only' 
                ? 'Create a new Pumpd account for this restaurant'
                : 'Select how you want to register this restaurant'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Only show radio group options if not account_only */}
            {registrationType !== 'account_only' ? (
              <RadioGroup value={registrationType} onValueChange={setRegistrationType}>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="new_account_with_restaurant" id="new_account" />
                    <div className="space-y-1">
                      <Label htmlFor="new_account" className="font-medium">
                        New Account with Restaurant
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Create a new Pumpd account and register this restaurant
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="existing_account_first_restaurant" id="existing_first" />
                    <div className="space-y-1">
                      <Label htmlFor="existing_first" className="font-medium">
                        Login to Existing Account - First Restaurant
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Login to an existing account and add this as the first restaurant
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="existing_account_additional_restaurant" id="existing_additional" />
                    <div className="space-y-1">
                      <Label htmlFor="existing_additional" className="font-medium">
                        Login to Existing Account - Additional Restaurant
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Login to an existing account that already has restaurants
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            ) : (
              <div className="text-sm text-muted-foreground">
                Enter your email and password to create a new Pumpd account.
              </div>
            )}

            {/* Email and Password fields - show for all registration types */}
            {registrationType && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="registration-email">Email</Label>
                  <Input
                    id="registration-email"
                    type="email"
                    placeholder="Enter your Pumpd account email"
                    value={registrationEmail}
                    onChange={(e) => setRegistrationEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registration-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="registration-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your Pumpd account password"
                      value={registrationPassword}
                      onChange={(e) => setRegistrationPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Default format: Restaurantname789!
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegistrationDialogOpen(false);
                setRegistrationType('');
                setRegistrationEmail('');
                setRegistrationPassword('');
                setShowPassword(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegistration}
              disabled={!registrationType || registering}
            >
              {registering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                registrationType === 'account_only' ? 'Register Account' : 'Register Restaurant'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration Logs Dialog */}
      <Dialog open={showRegistrationLogs} onOpenChange={setShowRegistrationLogs}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Logs</DialogTitle>
            <DialogDescription>
              History of registration attempts for this restaurant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {registrationLogs.length > 0 ? (
              <div className="space-y-2">
                {registrationLogs.map((log, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{log.action}</span>
                        {log.status === 'success' ? (
                          <Badge variant="success">Success</Badge>
                        ) : log.status === 'in_progress' ? (
                          <Badge variant="warning">In Progress</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.error_message && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{log.error_message}</AlertDescription>
                      </Alert>
                    )}
                    {log.script_name && (
                      <p className="text-sm text-muted-foreground">
                        Script: {log.script_name}
                      </p>
                    )}
                    {log.execution_time_ms && (
                      <p className="text-sm text-muted-foreground">
                        Execution time: {(log.execution_time_ms / 1000).toFixed(2)}s
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No registration logs found
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRegistrationLogs(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}