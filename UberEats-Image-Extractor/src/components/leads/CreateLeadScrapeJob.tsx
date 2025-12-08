import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import {
  Loader2,
  Play,
  Save,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  LeadScrapeJob,
  CityCode,
  UberEatsCuisine,
  useCreateLeadScrapeJob,
  useUpdateLeadScrapeJob,
  useStartLeadScrapeJob,
} from '../../hooks/useLeadScrape';
import { CitySearchCombobox } from './CitySearchCombobox';
import { CuisineSearchCombobox } from './CuisineSearchCombobox';
import { cn } from '../../lib/utils';

interface CreateLeadScrapeJobProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editJob?: LeadScrapeJob | null;
}

// Platform options
const platforms = [
  { value: 'ubereats', label: 'UberEats' },
  { value: 'doordash', label: 'DoorDash', disabled: true },
];

// Country options
const countries = [
  { value: 'nz', label: 'New Zealand' },
  { value: 'au', label: 'Australia', disabled: true },
];

// Form validation
interface FormErrors {
  platform?: string;
  country?: string;
  city?: string;
  cuisine?: string;
}

export function CreateLeadScrapeJob({
  open,
  onClose,
  onSuccess,
  editJob,
}: CreateLeadScrapeJobProps) {
  // Form state
  const [platform, setPlatform] = useState('ubereats');
  const [country, setCountry] = useState('nz');
  const [selectedCity, setSelectedCity] = useState<CityCode | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<UberEatsCuisine | null>(null);
  const [leadsLimit, setLeadsLimit] = useState(21);
  const [pageOffset, setPageOffset] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});

  // Mutations
  const createMutation = useCreateLeadScrapeJob();
  const updateMutation = useUpdateLeadScrapeJob();
  const startMutation = useStartLeadScrapeJob();

  const isEditing = !!editJob;
  const isLoading = createMutation.isPending || updateMutation.isPending || startMutation.isPending;

  // Initialize form when editing
  useEffect(() => {
    if (editJob && open) {
      setPlatform(editJob.platform);
      setCountry(editJob.country || 'nz');
      // Note: we'd need to fetch the city details to properly set selectedCity
      // For now, we'll use city_code to pre-select
      setSelectedCity({
        id: '',
        country: editJob.country || 'nz',
        city_name: editJob.city,
        city_code: editJob.city_code,
        region_code: editJob.region_code || '',
        ubereats_slug: '',
      });
      // Set cuisine from slug (display_name will be populated when cuisines load)
      setSelectedCuisine({
        id: '',
        display_name: editJob.cuisine,
        slug: editJob.cuisine,
      });
      setLeadsLimit(editJob.leads_limit);
      setPageOffset(editJob.page_offset);
    }
  }, [editJob, open]);

  // Reset form when dialog opens for new job
  useEffect(() => {
    if (open && !editJob) {
      resetForm();
    }
  }, [open, editJob]);

  const resetForm = () => {
    setPlatform('ubereats');
    setCountry('nz');
    setSelectedCity(null);
    setSelectedCuisine(null);
    setLeadsLimit(21);
    setPageOffset(1);
    setErrors({});
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!platform) {
      newErrors.platform = 'Please select a platform';
    }

    if (!country) {
      newErrors.country = 'Please select a country';
    }

    if (!selectedCity) {
      newErrors.city = 'Please select a city';
    }

    if (!selectedCuisine) {
      newErrors.cuisine = 'Please select a cuisine type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle city selection
  const handleCitySelect = (city: CityCode | null) => {
    setSelectedCity(city);
    if (city) {
      setErrors((prev) => ({ ...prev, city: undefined }));
    }
  };

  // Handle cuisine selection
  const handleCuisineSelect = (cuisine: UberEatsCuisine | null) => {
    setSelectedCuisine(cuisine);
    if (cuisine) {
      setErrors((prev) => ({ ...prev, cuisine: undefined }));
    }
  };

  // Handle save as draft
  const handleSaveAsDraft = async () => {
    if (!validateForm()) return;

    try {
      if (isEditing && editJob) {
        await updateMutation.mutateAsync({
          id: editJob.id,
          updates: {
            platform,
            country,
            city: selectedCity!.city_name,
            cuisine: selectedCuisine!.slug,
            leads_limit: leadsLimit,
            page_offset: pageOffset,
          },
        });
      } else {
        await createMutation.mutateAsync({
          platform,
          country,
          city: selectedCity!.city_name,
          cuisine: selectedCuisine!.slug,
          leads_limit: leadsLimit,
          page_offset: pageOffset,
          save_as_draft: true,
        });
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Handle start lead scrape
  const handleStartScrape = async () => {
    if (!validateForm()) return;

    try {
      if (isEditing && editJob) {
        // Update first, then start
        await updateMutation.mutateAsync({
          id: editJob.id,
          updates: {
            platform,
            country,
            city: selectedCity!.city_name,
            cuisine: selectedCuisine!.slug,
            leads_limit: leadsLimit,
            page_offset: pageOffset,
          },
        });
        await startMutation.mutateAsync(editJob.id);
      } else {
        // Create and start directly
        await createMutation.mutateAsync({
          platform,
          country,
          city: selectedCity!.city_name,
          cuisine: selectedCuisine!.slug,
          leads_limit: leadsLimit,
          page_offset: pageOffset,
          save_as_draft: false,
        });
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Get estimated job preview
  const getJobPreview = () => {
    if (!selectedCity || !selectedCuisine) return null;

    return (
      <div className="bg-muted/50 rounded-lg p-3 border text-sm">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Job Preview</span>
        </div>
        <div className="space-y-1 text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Name:</span>{' '}
            {selectedCuisine.display_name} - {selectedCity.city_name} ({platforms.find((p) => p.value === platform)?.label})
          </div>
          <div>
            <span className="font-medium text-foreground">Target:</span>{' '}
            Up to {leadsLimit} leads from page {pageOffset}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Lead Scrape Job' : 'New Lead Scrape'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the job settings before starting'
              : 'Configure a new lead extraction job from delivery platforms'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform *</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger
                className={cn(errors.platform && 'border-red-500')}
              >
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem
                    key={p.value}
                    value={p.value}
                    disabled={p.disabled}
                  >
                    {p.label}
                    {p.disabled && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Coming Soon
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.platform && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.platform}
              </p>
            )}
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger
                className={cn(errors.country && 'border-red-500')}
              >
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    disabled={c.disabled}
                  >
                    {c.label}
                    {c.disabled && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Coming Soon
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.country}
              </p>
            )}
          </div>

          {/* City Selection */}
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <CitySearchCombobox
              value={selectedCity?.city_code}
              country={country}
              onSelect={handleCitySelect}
              placeholder="Search and select city..."
            />
            {errors.city && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.city}
              </p>
            )}
          </div>

          {/* Cuisine Selection */}
          <div className="space-y-2">
            <Label htmlFor="cuisine">Cuisine Type *</Label>
            <CuisineSearchCombobox
              value={selectedCuisine?.slug}
              onSelect={handleCuisineSelect}
              placeholder="Search and select cuisine..."
            />
            {errors.cuisine && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.cuisine}
              </p>
            )}
          </div>

          {/* Leads Limit Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="leadsLimit">Leads Limit</Label>
              <Badge variant="outline">{leadsLimit} leads</Badge>
            </div>
            <Slider
              id="leadsLimit"
              value={[leadsLimit]}
              onValueChange={([value]) => setLeadsLimit(value)}
              min={5}
              max={105}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of leads to extract from the platform
            </p>
          </div>

          {/* Page Offset */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pageOffset">Page Offset</Label>
              <Badge variant="outline">Page {pageOffset}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="pageOffset"
                type="number"
                min={1}
                max={20}
                value={pageOffset}
                onChange={(e) => setPageOffset(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground flex-1">
                Start from this page of results (useful for skipping already scraped leads)
              </span>
            </div>
          </div>

          {/* Job Preview */}
          {getJobPreview()}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={isLoading}
            >
              {(createMutation.isPending || updateMutation.isPending) &&
              !startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save as Draft
            </Button>
            <Button
              onClick={handleStartScrape}
              disabled={isLoading}
              className="bg-gradient-to-r from-brand-blue to-brand-green"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Lead Scrape
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateLeadScrapeJob;
