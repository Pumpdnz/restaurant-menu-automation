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
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  ExternalLink,
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  Instagram,
  Facebook,
  Clock,
  Edit,
  Save,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ShoppingCart,
  Image as ImageIcon,
  Link2,
} from 'lucide-react';
import { OpeningHoursEditor, OpeningHoursSlot } from '../OpeningHoursEditor';
import { cn } from '../../lib/utils';
import {
  Lead,
  useLead,
  useUpdateLead,
  usePassLeadsToNextStep,
  useDeleteLeads,
} from '../../hooks/useLeadScrape';
import { useToast } from '../../hooks/use-toast';

interface LeadDetailModalProps {
  open: boolean;
  leadId: string | null;
  stepId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// Status colors
const statusColors: Record<string, string> = {
  available: 'bg-gray-100 text-gray-800 border-gray-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  processed: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  passed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

// Header image field type
type HeaderImageField = 'website_og_image' | 'ubereats_og_image' | 'doordash_og_image' | 'facebook_cover_image';

// All possible header image sources
const HEADER_IMAGE_SOURCES = [
  { value: 'website_og_image' as HeaderImageField, label: 'Website OG Image' },
  { value: 'ubereats_og_image' as HeaderImageField, label: 'UberEats Image' },
  { value: 'doordash_og_image' as HeaderImageField, label: 'DoorDash Image' },
  { value: 'facebook_cover_image' as HeaderImageField, label: 'Facebook Cover' },
] as const;

export function LeadDetailModal({
  open,
  leadId,
  stepId,
  onClose,
  onSuccess,
}: LeadDetailModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form state for edit mode
  const [formData, setFormData] = useState<Partial<Lead>>({});

  // Header image editing state
  const [selectedHeaderImageSource, setSelectedHeaderImageSource] = useState<HeaderImageField>('ubereats_og_image');
  const [headerImageUrlInput, setHeaderImageUrlInput] = useState('');
  const [isHeaderImageSaving, setIsHeaderImageSaving] = useState(false);

  // Opening hours state
  const [openingHours, setOpeningHours] = useState<OpeningHoursSlot[]>([]);

  // Helper to convert 12-hour time to 24-hour format
  const convertTo24Hour = (time12h: string): string => {
    if (!time12h) return '';
    // If already in 24-hour format (no AM/PM), return as-is
    if (!time12h.includes('AM') && !time12h.includes('PM') && !time12h.includes('am') && !time12h.includes('pm')) {
      return time12h;
    }
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    let hoursNum = parseInt(hours, 10);

    if (modifier?.toUpperCase() === 'PM' && hoursNum !== 12) {
      hoursNum += 12;
    } else if (modifier?.toUpperCase() === 'AM' && hoursNum === 12) {
      hoursNum = 0;
    }

    return `${hoursNum.toString().padStart(2, '0')}:${minutes || '00'}`;
  };

  // Normalize lead opening hours to OpeningHoursSlot format (for editing)
  const normalizeLeadHours = (hours: any[]): OpeningHoursSlot[] => {
    if (!hours || !Array.isArray(hours)) return [];

    return hours
      .filter(entry => (entry.open && entry.close) || (entry.hours?.open && entry.hours?.close)) // Skip closed days
      .map(entry => ({
        day: entry.day,
        hours: {
          open: entry.hours?.open || convertTo24Hour(entry.open),
          close: entry.hours?.close || convertTo24Hour(entry.close),
        }
      }));
  };

  // Convert 24-hour time to 12-hour format (for saving in lead format)
  const convertTo12Hour = (time24h: string): string => {
    if (!time24h) return '';
    const [hours, minutes] = time24h.split(':');
    let hoursNum = parseInt(hours, 10);
    const ampm = hoursNum >= 12 ? 'PM' : 'AM';
    hoursNum = hoursNum % 12 || 12;
    return `${hoursNum}:${minutes || '00'} ${ampm}`;
  };

  // Convert OpeningHoursSlot format back to lead scraping format (for saving)
  const convertToLeadFormat = (slots: OpeningHoursSlot[]): any[] => {
    if (!slots || slots.length === 0) return [];

    return slots.map(slot => ({
      day: slot.day,
      open: convertTo12Hour(slot.hours.open),
      close: convertTo12Hour(slot.hours.close),
    }));
  };

  // Fetch lead data
  const { data, isLoading, refetch } = useLead(leadId || '', {
    enabled: open && !!leadId,
  });

  // Mutations
  const updateMutation = useUpdateLead();
  const passMutation = usePassLeadsToNextStep();
  const deleteMutation = useDeleteLeads();

  const lead = data?.lead;

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (open) {
      setMode('view');
    }
  }, [open, leadId]);

  // Initialize form data when lead loads
  useEffect(() => {
    if (lead) {
      setFormData({
        // Basic Info
        restaurant_name: lead.restaurant_name,
        store_link: lead.store_link,
        // Location
        ubereats_address: lead.ubereats_address,
        google_address: lead.google_address,
        city: lead.city,
        region: lead.region,
        country: lead.country,
        google_maps_url: lead.google_maps_url,
        // UberEats Info
        ubereats_number_of_reviews: lead.ubereats_number_of_reviews,
        ubereats_average_review_rating: lead.ubereats_average_review_rating,
        ubereats_cuisine: lead.ubereats_cuisine,
        ubereats_price_rating: lead.ubereats_price_rating,
        // Google Info
        google_number_of_reviews: lead.google_number_of_reviews,
        google_average_review_rating: lead.google_average_review_rating,
        // Contact Person
        contact_name: lead.contact_name,
        contact_role: lead.contact_role,
        contact_phone: lead.contact_phone,
        contact_email: lead.contact_email,
        // Business Contact
        phone: lead.phone,
        email: lead.email,
        // Organisation
        organisation_name: lead.organisation_name,
        number_of_venues: lead.number_of_venues,
        // Online Presence
        website_url: lead.website_url,
        instagram_url: lead.instagram_url,
        facebook_url: lead.facebook_url,
        // Business Details
        website_type: lead.website_type,
        online_ordering_platform: lead.online_ordering_platform,
        online_ordering_handles_delivery: lead.online_ordering_handles_delivery,
        // Ordering Platform Discovery (Step 4)
        ordering_platform_url: lead.ordering_platform_url,
        ordering_platform_name: lead.ordering_platform_name,
        // Opening Hours
        opening_hours_text: lead.opening_hours_text,
        opening_hours: lead.opening_hours,
        // Header Images
        website_og_image: lead.website_og_image,
        ubereats_og_image: lead.ubereats_og_image,
        doordash_og_image: lead.doordash_og_image,
        facebook_cover_image: lead.facebook_cover_image,
      });

      // Initialize opening hours from lead data (normalize format)
      if (lead.opening_hours && Array.isArray(lead.opening_hours)) {
        setOpeningHours(normalizeLeadHours(lead.opening_hours));
      } else {
        setOpeningHours([]);
      }

      // Reset header image input
      setHeaderImageUrlInput('');
    }
  }, [lead]);

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({ title: 'Copied!', description: `${field} copied to clipboard` });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!leadId) return;

    try {
      // Convert opening hours back to lead format before saving
      const updatesWithHours = {
        ...formData,
        opening_hours: openingHours.length > 0 ? convertToLeadFormat(openingHours) : null,
      };

      await updateMutation.mutateAsync({
        id: leadId,
        updates: updatesWithHours,
      });
      setMode('view');
      refetch();
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    if (lead) {
      setFormData({
        // Basic Info
        restaurant_name: lead.restaurant_name,
        store_link: lead.store_link,
        // Location
        ubereats_address: lead.ubereats_address,
        google_address: lead.google_address,
        city: lead.city,
        region: lead.region,
        country: lead.country,
        google_maps_url: lead.google_maps_url,
        // UberEats Info
        ubereats_number_of_reviews: lead.ubereats_number_of_reviews,
        ubereats_average_review_rating: lead.ubereats_average_review_rating,
        ubereats_cuisine: lead.ubereats_cuisine,
        ubereats_price_rating: lead.ubereats_price_rating,
        // Google Info
        google_number_of_reviews: lead.google_number_of_reviews,
        google_average_review_rating: lead.google_average_review_rating,
        // Contact Person
        contact_name: lead.contact_name,
        contact_role: lead.contact_role,
        contact_phone: lead.contact_phone,
        contact_email: lead.contact_email,
        // Business Contact
        phone: lead.phone,
        email: lead.email,
        // Organisation
        organisation_name: lead.organisation_name,
        number_of_venues: lead.number_of_venues,
        // Online Presence
        website_url: lead.website_url,
        instagram_url: lead.instagram_url,
        facebook_url: lead.facebook_url,
        // Business Details
        website_type: lead.website_type,
        online_ordering_platform: lead.online_ordering_platform,
        online_ordering_handles_delivery: lead.online_ordering_handles_delivery,
        // Ordering Platform Discovery (Step 4)
        ordering_platform_url: lead.ordering_platform_url,
        ordering_platform_name: lead.ordering_platform_name,
        // Opening Hours
        opening_hours_text: lead.opening_hours_text,
        opening_hours: lead.opening_hours,
        // Header Images
        website_og_image: lead.website_og_image,
        ubereats_og_image: lead.ubereats_og_image,
        doordash_og_image: lead.doordash_og_image,
        facebook_cover_image: lead.facebook_cover_image,
      });

      // Reset opening hours (normalize format)
      if (lead.opening_hours && Array.isArray(lead.opening_hours)) {
        setOpeningHours(normalizeLeadHours(lead.opening_hours));
      } else {
        setOpeningHours([]);
      }

      // Reset header image input
      setHeaderImageUrlInput('');
    }
    setMode('view');
  };

  // Handle header image URL save
  const handleHeaderImageSave = async () => {
    if (!leadId || !headerImageUrlInput.trim()) return;

    setIsHeaderImageSaving(true);
    try {
      const newUrl = headerImageUrlInput.trim();
      await updateMutation.mutateAsync({
        id: leadId,
        updates: {
          [selectedHeaderImageSource]: newUrl,
        },
      });
      // Update local formData immediately so preview shows
      setFormData(prev => ({
        ...prev,
        [selectedHeaderImageSource]: newUrl,
      }));
      setHeaderImageUrlInput('');
      refetch();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsHeaderImageSaving(false);
    }
  };

  // Get header image URL for a source
  const getHeaderImageUrl = (source: HeaderImageField): string | null => {
    return formData[source] as string | null;
  };

  // Check if any header images exist
  const hasAnyHeaderImage = HEADER_IMAGE_SOURCES.some(
    source => getHeaderImageUrl(source.value)
  );

  // Pass to next step
  const handlePassToNext = async () => {
    if (!leadId || !stepId) return;
    await passMutation.mutateAsync({
      stepId,
      leadIds: [leadId],
    });
    onSuccess?.();
    onClose();
  };

  // Delete lead
  const handleDelete = async () => {
    if (!leadId) return;
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    await deleteMutation.mutateAsync([leadId]);
    onSuccess?.();
    onClose();
  };

  const isAnyLoading = updateMutation.isPending || passMutation.isPending || deleteMutation.isPending;

  // Copy button component
  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  // Info field component
  const InfoField = ({
    icon: Icon,
    label,
    value,
    copyable = false,
    link = false,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | null | undefined;
    copyable?: boolean;
    link?: boolean;
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 group">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          {link ? (
            <a
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-blue hover:underline flex items-center gap-1 break-all"
            >
              {value}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <div className="text-sm font-medium break-all">{value}</div>
          )}
        </div>
        {copyable && <CopyButton text={value} field={label} />}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // No lead state
  if (!lead) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px]">
          <div className="text-center py-8 text-muted-foreground">
            Lead not found
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit mode
  if (mode === 'edit') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update lead information</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="restaurant_name">Restaurant Name</Label>
                <Input
                  id="restaurant_name"
                  value={formData.restaurant_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, restaurant_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store_link">Store Link</Label>
                <Input
                  id="store_link"
                  value={formData.store_link || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, store_link: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <Separator />
              <div className="text-sm font-medium">Location</div>

              <div className="space-y-2">
                <Label htmlFor="ubereats_address">UberEats Address</Label>
                <Textarea
                  id="ubereats_address"
                  value={formData.ubereats_address || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, ubereats_address: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_address">Google Address</Label>
                <Textarea
                  id="google_address"
                  value={formData.google_address || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, google_address: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={formData.region || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_maps_url">Google Maps URL</Label>
                <Input
                  id="google_maps_url"
                  value={formData.google_maps_url || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, google_maps_url: e.target.value })
                  }
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <Separator />
              <div className="text-sm font-medium">UberEats Info</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ubereats_average_review_rating">Average Rating</Label>
                  <Input
                    id="ubereats_average_review_rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.ubereats_average_review_rating || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, ubereats_average_review_rating: e.target.value ? parseFloat(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ubereats_number_of_reviews">Number of Reviews</Label>
                  <Input
                    id="ubereats_number_of_reviews"
                    value={formData.ubereats_number_of_reviews || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, ubereats_number_of_reviews: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubereats_price_rating">Price Rating (1-4)</Label>
                <Input
                  id="ubereats_price_rating"
                  type="number"
                  min="1"
                  max="4"
                  value={formData.ubereats_price_rating || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, ubereats_price_rating: e.target.value ? parseInt(e.target.value) : null })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubereats_cuisine">Cuisine (comma-separated)</Label>
                <Input
                  id="ubereats_cuisine"
                  value={Array.isArray(formData.ubereats_cuisine) ? formData.ubereats_cuisine.join(', ') : ''}
                  onChange={(e) =>
                    setFormData({ ...formData, ubereats_cuisine: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })
                  }
                  placeholder="Italian, Pizza, Pasta"
                />
              </div>

              <Separator />
              <div className="text-sm font-medium">Google Info</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="google_average_review_rating">Google Rating</Label>
                  <Input
                    id="google_average_review_rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.google_average_review_rating || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, google_average_review_rating: e.target.value ? parseFloat(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google_number_of_reviews">Google Reviews</Label>
                  <Input
                    id="google_number_of_reviews"
                    value={formData.google_number_of_reviews || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, google_number_of_reviews: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium">Contact Person</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_role">Contact Role</Label>
                  <Input
                    id="contact_role"
                    value={formData.contact_role || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_role: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    value={formData.contact_email || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_email: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium">Business Contact</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={formData.email || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium">Organisation</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="organisation_name">Organisation Name</Label>
                  <Input
                    id="organisation_name"
                    value={formData.organisation_name || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, organisation_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number_of_venues">Number of Venues</Label>
                  <Input
                    id="number_of_venues"
                    type="number"
                    min="1"
                    value={formData.number_of_venues || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, number_of_venues: e.target.value ? parseInt(e.target.value) : null })
                    }
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium">Online Presence</div>

              <div className="space-y-2">
                <Label htmlFor="website_url">Website</Label>
                <Input
                  id="website_url"
                  value={formData.website_url || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, website_url: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram_url">Instagram</Label>
                  <Input
                    id="instagram_url"
                    value={formData.instagram_url || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, instagram_url: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook_url">Facebook</Label>
                  <Input
                    id="facebook_url"
                    value={formData.facebook_url || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, facebook_url: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium">Business Details</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website_type">Website Type</Label>
                  <Input
                    id="website_type"
                    value={formData.website_type || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, website_type: e.target.value })
                    }
                    placeholder="e.g., WordPress, Squarespace"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="online_ordering_platform">Online Ordering Platform</Label>
                  <Input
                    id="online_ordering_platform"
                    value={formData.online_ordering_platform || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, online_ordering_platform: e.target.value })
                    }
                    placeholder="e.g., UberEats, DoorDash"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="online_ordering_handles_delivery"
                  checked={formData.online_ordering_handles_delivery || false}
                  onChange={(e) =>
                    setFormData({ ...formData, online_ordering_handles_delivery: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="online_ordering_handles_delivery" className="text-sm font-normal">
                  Online Ordering Handles Delivery
                </Label>
              </div>

              <Separator />
              <div className="text-sm font-medium">Ordering Platform (Step 4)</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ordering_platform_name">Platform Name</Label>
                  <Input
                    id="ordering_platform_name"
                    value={formData.ordering_platform_name || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, ordering_platform_name: e.target.value })
                    }
                    placeholder="e.g., GloriaFood, Mobi2Go"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordering_platform_url">Ordering URL</Label>
                  <Input
                    id="ordering_platform_url"
                    value={formData.ordering_platform_url || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, ordering_platform_url: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium">Opening Hours</div>

              <div className="space-y-2">
                <Label htmlFor="opening_hours_text">Opening Hours (text format)</Label>
                <Textarea
                  id="opening_hours_text"
                  value={formData.opening_hours_text || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, opening_hours_text: e.target.value })
                  }
                  rows={3}
                  placeholder="Mon-Fri: 9am-9pm&#10;Sat-Sun: 10am-10pm"
                />
              </div>

              <div className="space-y-2">
                <Label>Structured Hours</Label>
                <div className="border rounded-lg p-3 bg-muted/20">
                  <OpeningHoursEditor
                    value={openingHours}
                    onChange={setOpeningHours}
                    isEditing={true}
                  />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Header Images
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Select Image Source</Label>
                  <Select
                    value={selectedHeaderImageSource}
                    onValueChange={(value) => setSelectedHeaderImageSource(value as HeaderImageField)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HEADER_IMAGE_SOURCES.map((source) => {
                        const imageUrl = getHeaderImageUrl(source.value);
                        const hasImage = !!imageUrl && imageUrl.length > 0;
                        return (
                          <SelectItem key={source.value} value={source.value}>
                            <div className="flex items-center gap-2">
                              {hasImage ? (
                                <>
                                  <div className="h-6 w-10 rounded border bg-muted/50 overflow-hidden">
                                    <img
                                      src={imageUrl}
                                      alt={source.label}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </div>
                                  <span>{source.label}</span>
                                </>
                              ) : (
                                <>
                                  <div className="h-6 w-10 rounded border bg-muted/50 flex items-center justify-center">
                                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground">{source.label} (empty)</span>
                                </>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* URL Input for adding/replacing header image */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    Paste image URL to add/replace selected source
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={headerImageUrlInput}
                      onChange={(e) => setHeaderImageUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1"
                      disabled={isHeaderImageSaving}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isHeaderImageSaving) {
                          e.preventDefault();
                          handleHeaderImageSave();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleHeaderImageSave}
                      disabled={!headerImageUrlInput.trim() || isHeaderImageSaving}
                      size="sm"
                    >
                      {isHeaderImageSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Apply & Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Preview of selected header image */}
                {getHeaderImageUrl(selectedHeaderImageSource) && (
                  <div className="p-2 bg-muted/30 rounded space-y-1">
                    <span className="text-xs text-muted-foreground">Preview:</span>
                    <img
                      src={getHeaderImageUrl(selectedHeaderImageSource) || ''}
                      alt="Header preview"
                      className="w-full max-h-32 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isAnyLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isAnyLoading}>
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // View mode
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {lead.restaurant_name}
                <Badge
                  variant="outline"
                  className={cn('capitalize', statusColors[lead.step_progression_status])}
                >
                  {lead.step_progression_status}
                </Badge>
                {lead.is_duplicate && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    Duplicate
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {lead.platform} • Step {lead.current_step}
                {lead.city && ` • ${lead.city}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
            {/* Validation errors */}
            {lead.validation_errors && lead.validation_errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Validation Issues ({lead.validation_errors.length})
                </div>
                <ul className="text-sm text-red-600 space-y-1">
                  {lead.validation_errors.map((error, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reviews */}
            {(lead.ubereats_average_review_rating || lead.ubereats_number_of_reviews) && (
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                {lead.ubereats_average_review_rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span className="text-lg font-semibold">
                      {lead.ubereats_average_review_rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {lead.ubereats_number_of_reviews && (
                  <div className="text-sm text-muted-foreground">
                    {lead.ubereats_number_of_reviews} reviews
                  </div>
                )}
                {lead.ubereats_price_rating && (
                  <Badge variant="outline">{'$'.repeat(lead.ubereats_price_rating)}</Badge>
                )}
              </div>
            )}

            {/* Cuisine */}
            {lead.ubereats_cuisine && lead.ubereats_cuisine.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">Cuisine</div>
                <div className="flex flex-wrap gap-1">
                  {lead.ubereats_cuisine.map((c, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Location & Contact */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Location & Contact</div>
              <InfoField icon={MapPin} label="Address" value={lead.ubereats_address || lead.google_address} copyable />
              <InfoField icon={Phone} label="Phone" value={lead.phone} copyable />
              <InfoField icon={Mail} label="Email" value={lead.email} copyable />
            </div>

            {/* Contact Person */}
            {(lead.contact_name || lead.contact_email || lead.contact_phone) && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="text-sm font-medium mb-2">Contact Person</div>
                  {lead.contact_name && (
                    <div className="flex items-center gap-2 p-2">
                      <div className="text-sm">
                        <span className="font-medium">{lead.contact_name}</span>
                        {lead.contact_role && (
                          <span className="text-muted-foreground ml-2">
                            ({lead.contact_role})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <InfoField
                    icon={Phone}
                    label="Contact Phone"
                    value={lead.contact_phone}
                    copyable
                  />
                  <InfoField
                    icon={Mail}
                    label="Contact Email"
                    value={lead.contact_email}
                    copyable
                  />
                </div>
              </>
            )}

            {/* Online Presence */}
            {(lead.website_url || lead.instagram_url || lead.facebook_url || lead.store_link) && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="text-sm font-medium mb-2">Online Presence</div>
                  <InfoField icon={Globe} label="Website" value={lead.website_url} link />
                  <InfoField
                    icon={Instagram}
                    label="Instagram"
                    value={lead.instagram_url}
                    link
                  />
                  <InfoField
                    icon={Facebook}
                    label="Facebook"
                    value={lead.facebook_url}
                    link
                  />
                  <InfoField
                    icon={ExternalLink}
                    label="Store Link"
                    value={lead.store_link}
                    link
                  />
                  {lead.google_maps_url && (
                    <InfoField
                      icon={MapPin}
                      label="Google Maps"
                      value={lead.google_maps_url}
                      link
                    />
                  )}
                </div>
              </>
            )}

            {/* Ordering Platform */}
            {(lead.ordering_platform_url || lead.ordering_platform_name) && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Ordering Platform
                  </div>
                  {lead.ordering_platform_name && (
                    <div className="text-sm bg-muted/30 p-3 rounded-lg">
                      <span className="font-medium">{lead.ordering_platform_name}</span>
                      {lead.ordering_source && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          (found via {lead.ordering_source.replace('_', ' ')})
                        </span>
                      )}
                    </div>
                  )}
                  <InfoField
                    icon={ExternalLink}
                    label="Ordering URL"
                    value={lead.ordering_platform_url}
                    link
                  />
                </div>
              </>
            )}

            {/* Opening Hours */}
            {lead.opening_hours && Array.isArray(lead.opening_hours) && lead.opening_hours.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Opening Hours
                  </div>
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg space-y-1">
                    {lead.opening_hours.map((entry: { day: string; open: string; close: string; period?: string }, idx: number) => (
                      <div key={idx} className="flex justify-between gap-4">
                        <span className="font-medium">{entry.day}{entry.period ? ` (${entry.period})` : ''}</span>
                        <span>{entry.open} - {entry.close}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Header Images */}
            {hasAnyHeaderImage && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Header Images
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {HEADER_IMAGE_SOURCES.map((source) => {
                      const imageUrl = lead[source.value];
                      if (!imageUrl) return null;
                      return (
                        <div key={source.value} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{source.label}</div>
                          <div className="h-20 rounded border bg-muted/30 overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={source.label}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Duplicate info */}
            {lead.is_duplicate && (lead.duplicate_of_lead_id || lead.duplicate_of_restaurant_id) && (
              <>
                <Separator />
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-orange-700 mb-1">
                    Duplicate Detected
                  </div>
                  <div className="text-xs text-orange-600">
                    {lead.duplicate_of_restaurant_id
                      ? `Matches existing restaurant: ${lead.duplicate_of_restaurant_id}`
                      : `Matches lead: ${lead.duplicate_of_lead_id}`}
                  </div>
                </div>
              </>
            )}

            {/* Converted info */}
            {lead.converted_to_restaurant_id && (
              <>
                <Separator />
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Converted to Restaurant
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Restaurant ID: {lead.converted_to_restaurant_id}
                    {lead.converted_at && (
                      <span className="ml-2">
                        • {new Date(lead.converted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Timestamps */}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <div className="font-medium">Created</div>
                <div>{new Date(lead.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="font-medium">Updated</div>
                <div>{new Date(lead.updated_at).toLocaleString()}</div>
              </div>
            </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={handleDelete}
            disabled={isAnyLoading}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button variant="outline" onClick={() => setMode('edit')}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {stepId && lead.step_progression_status !== 'passed' && (
              <Button onClick={handlePassToNext} disabled={isAnyLoading}>
                {passMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Pass to Next Step
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LeadDetailModal;
