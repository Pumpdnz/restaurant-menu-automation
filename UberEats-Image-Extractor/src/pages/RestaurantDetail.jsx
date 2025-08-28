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
  FileSearch
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
import { cn } from '../lib/utils';
import api from '../services/api';

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  
  // Platform extraction states
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionConfig, setExtractionConfig] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const isNewRestaurant = id === 'new';

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
    } catch (err) {
      console.error('Failed to fetch restaurant details:', err);
      setError('Failed to load restaurant details');
    } finally {
      setLoading(false);
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

        const response = await api.post('/website-extraction/process-selected-logo', {
          logoUrl: newLogoUrl,
          websiteUrl: restaurant.website_url || '',
          restaurantId: id,
          versionsToUpdate: processMode === 'replace' ? versions : undefined
        });

        if (response.data.success) {
          const data = response.data.data;
          
          // Update local state with processed logo and colors
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

  const handlePlatformExtraction = (url, platformName) => {
    const platform = detectPlatformFromUrl(url);
    setExtractionConfig({
      url,
      platform,
      platformName,
      restaurantId: id,
      restaurantName: restaurant?.name || 'Unknown Restaurant'
    });
    setExtractionDialogOpen(true);
  };

  const startPlatformExtraction = async () => {
    if (!extractionConfig) return;
    
    setIsExtracting(true);
    setError(null);
    
    try {
      // Use the proper extraction start endpoint that creates database job
      const response = await api.post('/extractions/start', {
        url: extractionConfig.url,
        restaurantId: extractionConfig.restaurantId,
        extractionType: 'batch',
        options: {
          includeImages: true,
          generateCSV: true
        }
      });

      if (response.data.success) {
        toast({
          title: "Extraction started",
          description: `Extracting menu from ${extractionConfig.platformName}`,
        });
        
        // Navigate to extraction detail page
        navigate(`/extractions/${response.data.jobId}?poll=true`);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          {!isNewRestaurant && getStatusBadge(restaurant?.onboarding_status)}
        </div>
        <div className="flex gap-2">
          {!isNewRestaurant && (
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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact & Lead</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="platforms">Platforms & Social</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
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
                  <Label>Phone</Label>
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
                  <Label>Email</Label>
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
                      {restaurant?.cuisine?.map((c, i) => (
                        <Badge key={i} variant="secondary">{c}</Badge>
                      )) || <span className="text-sm">-</span>}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Subdomain</Label>
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
                          {restaurant.subdomain}.pumpd.co.nz
                        </a>
                      ) : '-'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opening Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
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
        </TabsContent>

        {/* Contact & Lead Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact & Lead Information</CardTitle>
              <CardDescription>Contact details and lead tracking information</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <Label>User Account Email</Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editedData.user_email || ''}
                    onChange={(e) => handleFieldChange('user_email', e.target.value)}
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.user_email || '-'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Visual Identity</CardTitle>
              <CardDescription>Logo, colors, and theme settings</CardDescription>
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
                  <div className="flex gap-2">
                    {restaurant?.website_url && (
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
                    <Button
                      onClick={() => setProcessLogoDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      title="Process logo manually or reprocess existing"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Process Logo
                    </Button>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment & Service Configuration</CardTitle>
              <CardDescription>Stripe and service settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Stripe Connect URL</Label>
                {isEditing ? (
                  <Textarea
                    value={editedData.stripe_connect_url || ''}
                    onChange={(e) => handleFieldChange('stripe_connect_url', e.target.value)}
                    rows={2}
                  />
                ) : (
                  <div className="mt-1">
                    {restaurant?.stripe_connect_url ? (
                      <a 
                        href={restaurant.stripe_connect_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-blue hover:underline break-all"
                      >
                        {restaurant.stripe_connect_url}
                      </a>
                    ) : (
                      <span className="text-sm">-</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Payment Settings (JSON)</Label>
                {isEditing ? (
                  <Textarea
                    value={JSON.stringify(editedData.payment_settings || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        handleFieldChange('payment_settings', JSON.parse(e.target.value));
                      } catch {}
                    }}
                    rows={6}
                    className="font-mono text-xs"
                  />
                ) : (
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-1">
                    {JSON.stringify(restaurant?.payment_settings || {}, null, 2)}
                  </pre>
                )}
              </div>

              <div>
                <Label>Service Settings (JSON)</Label>
                {isEditing ? (
                  <Textarea
                    value={JSON.stringify(editedData.service_settings || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        handleFieldChange('service_settings', JSON.parse(e.target.value));
                      } catch {}
                    }}
                    rows={6}
                    className="font-mono text-xs"
                  />
                ) : (
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-1">
                    {JSON.stringify(restaurant?.service_settings || {}, null, 2)}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms & Social Tab */}
        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform & Social Media Links</CardTitle>
              <CardDescription>Delivery platforms and social media URLs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label>UberEats URL</Label>
                  {!isEditing && restaurant?.ubereats_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.ubereats_url, 'UberEats')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.ubereats_url || ''}
                    onChange={(e) => handleFieldChange('ubereats_url', e.target.value)}
                    placeholder="https://www.ubereats.com/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.ubereats_url ? (
                      <a 
                        href={restaurant.ubereats_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.ubereats_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>DoorDash URL</Label>
                  {!isEditing && restaurant?.doordash_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.doordash_url, 'DoorDash')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.doordash_url || ''}
                    onChange={(e) => handleFieldChange('doordash_url', e.target.value)}
                    placeholder="https://www.doordash.com/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.doordash_url ? (
                      <a 
                        href={restaurant.doordash_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.doordash_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Website URL</Label>
                  {!isEditing && restaurant?.website_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.website_url, 'Website')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.website_url || ''}
                    onChange={(e) => handleFieldChange('website_url', e.target.value)}
                    placeholder="https://..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.website_url ? (
                      <a 
                        href={restaurant.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.website_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>Instagram URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.instagram_url || ''}
                    onChange={(e) => handleFieldChange('instagram_url', e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.instagram_url ? (
                      <a 
                        href={restaurant.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.instagram_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>Facebook URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.facebook_url || ''}
                    onChange={(e) => handleFieldChange('facebook_url', e.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.facebook_url ? (
                      <a 
                        href={restaurant.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.facebook_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              {/* NZ-specific ordering platforms */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>OrderMeal URL</Label>
                  {!isEditing && restaurant?.ordermeal_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.ordermeal_url, 'OrderMeal')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.ordermeal_url || ''}
                    onChange={(e) => handleFieldChange('ordermeal_url', e.target.value)}
                    placeholder="https://ordermeal.co.nz/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.ordermeal_url ? (
                      <a 
                        href={restaurant.ordermeal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.ordermeal_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Me&U URL</Label>
                  {!isEditing && restaurant?.meandyou_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.meandyou_url, 'Me&U')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.meandyou_url || ''}
                    onChange={(e) => handleFieldChange('meandyou_url', e.target.value)}
                    placeholder="https://meandyou.co.nz/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.meandyou_url ? (
                      <a 
                        href={restaurant.meandyou_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.meandyou_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Mobi2go URL</Label>
                  {!isEditing && restaurant?.mobi2go_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.mobi2go_url, 'Mobi2go')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.mobi2go_url || ''}
                    onChange={(e) => handleFieldChange('mobi2go_url', e.target.value)}
                    placeholder="https://mobi2go.com/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.mobi2go_url ? (
                      <a 
                        href={restaurant.mobi2go_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.mobi2go_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Delivereasy URL</Label>
                  {!isEditing && restaurant?.delivereasy_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.delivereasy_url, 'Delivereasy')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.delivereasy_url || ''}
                    onChange={(e) => handleFieldChange('delivereasy_url', e.target.value)}
                    placeholder="https://delivereasy.co.nz/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.delivereasy_url ? (
                      <a 
                        href={restaurant.delivereasy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.delivereasy_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>NextOrder URL</Label>
                  {!isEditing && restaurant?.nextorder_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.nextorder_url, 'NextOrder')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.nextorder_url || ''}
                    onChange={(e) => handleFieldChange('nextorder_url', e.target.value)}
                    placeholder="https://nextorder.co.nz/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.nextorder_url ? (
                      <a 
                        href={restaurant.nextorder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.nextorder_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Foodhub URL</Label>
                  {!isEditing && restaurant?.foodhub_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePlatformExtraction(restaurant.foodhub_url, 'Foodhub')}
                      disabled={isExtracting}
                    >
                      <FileSearch className="h-3 w-3 mr-1" />
                      Extract Menu
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editedData.foodhub_url || ''}
                    onChange={(e) => handleFieldChange('foodhub_url', e.target.value)}
                    placeholder="https://foodhub.co.nz/..."
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.foodhub_url ? (
                      <a 
                        href={restaurant.foodhub_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.foodhub_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Status</CardTitle>
              <CardDescription>Track onboarding progress and notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Onboarding Status</Label>
                {isEditing ? (
                  <Select
                    value={editedData.onboarding_status || 'lead'}
                    onValueChange={(value) => handleFieldChange('onboarding_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="info_gathered">Info Gathered</SelectItem>
                      <SelectItem value="registered">Registered</SelectItem>
                      <SelectItem value="menu_imported">Menu Imported</SelectItem>
                      <SelectItem value="configured">Configured</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    {getStatusBadge(restaurant?.onboarding_status)}
                  </div>
                )}
              </div>

              <div>
                <Label>Onboarding Completed</Label>
                <p className="text-sm mt-1">
                  {restaurant?.onboarding_completed_at 
                    ? new Date(restaurant.onboarding_completed_at).toLocaleString()
                    : 'Not completed'}
                </p>
              </div>

              <div>
                <Label>Password Hint</Label>
                {isEditing ? (
                  <Input
                    value={editedData.user_password_hint || ''}
                    onChange={(e) => handleFieldChange('user_password_hint', e.target.value)}
                    placeholder="e.g., Restaurantname789!"
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.user_password_hint || '-'}</p>
                )}
              </div>

              <div>
                <Label>Workflow Notes</Label>
                {isEditing ? (
                  <Textarea
                    value={editedData.workflow_notes || ''}
                    onChange={(e) => handleFieldChange('workflow_notes', e.target.value)}
                    rows={4}
                    placeholder="Any notes about the onboarding process..."
                  />
                ) : (
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {restaurant?.workflow_notes || '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

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
                    <div key={menu.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="text-sm font-medium">Version {menu.version}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {menu.platforms?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {menu.is_active && (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(menu.created_at).toLocaleDateString()}
                        </span>
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
        </TabsContent>
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
        <DialogContent className="sm:max-w-[500px]">
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
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will scan the menu categories and extract all menu items from the {extractionConfig.platformName} page. 
                  The process may take several minutes depending on the menu size.
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
    </div>
  );
}