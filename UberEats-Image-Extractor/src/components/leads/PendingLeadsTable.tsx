import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ExternalLink,
  Star,
  MapPin,
  Phone,
  Mail,
  Eye,
  ArrowRightCircle,
  Trash2,
  Loader2,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Globe,
  DollarSign,
  Clock,
  User,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
} from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/skeleton';
import {
  Lead,
  useConvertLeadsToRestaurants,
  useDeleteLeads,
} from '../../hooks/useLeadScrape';
import { LeadDetailModal } from './LeadDetailModal';
import { BulkStartSequenceModal } from '../sequences/BulkStartSequenceModal';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import api from '../../services/api';

// Table loading skeleton
function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><Skeleton className="h-4 w-4" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="w-24"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-28"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-36"><Skeleton className="h-4 w-14" /></TableHead>
            <TableHead className="w-20"><Skeleton className="h-4 w-12" /></TableHead>
            <TableHead className="w-32"><Skeleton className="h-4 w-14" /></TableHead>
            <TableHead className="w-28"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-24"><Skeleton className="h-4 w-14" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface PendingLeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
  onRefresh: () => void;
}

// Inline info field for expanded details
function InfoField({
  icon: Icon,
  label,
  value,
  isLink = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  isLink?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        {isLink ? (
          <a
            href={String(value).startsWith('http') ? String(value) : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline break-all"
          >
            {value}
          </a>
        ) : (
          <div className="text-xs break-all">{value}</div>
        )}
      </div>
    </div>
  );
}

// Expanded lead details panel
function LeadDetailsPanel({ lead }: { lead: Lead }) {
  return (
    <div className="grid grid-cols-3 gap-6 p-4 bg-muted/30 border-t">
      {/* Section 1: Location & Business Info */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Location & Business</div>
        <InfoField icon={MapPin} label="Address" value={lead.ubereats_address || lead.google_address} />
        <InfoField icon={MapPin} label="City" value={lead.city} />
        {lead.ubereats_price_rating && (
          <div className="flex items-start gap-2 py-1">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Price</div>
              <div className="text-xs">{'$'.repeat(lead.ubereats_price_rating)}</div>
            </div>
          </div>
        )}
        {lead.google_average_review_rating && (
          <div className="flex items-start gap-2 py-1">
            <Star className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Google Rating</div>
              <div className="text-xs flex items-center gap-1">
                {lead.google_average_review_rating.toFixed(1)}
                {lead.google_number_of_reviews && (
                  <span className="text-muted-foreground">({lead.google_number_of_reviews})</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Contact & Social */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Contact & Social</div>
        <InfoField icon={Phone} label="Phone" value={lead.phone} />
        <InfoField icon={Globe} label="Website" value={lead.website_url} isLink />
        <InfoField icon={Globe} label="Instagram" value={lead.instagram_url} isLink />
        <InfoField icon={Globe} label="Facebook" value={lead.facebook_url} isLink />
      </div>

      {/* Section 3: Business Details */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Business Details</div>
        <InfoField icon={User} label="Contact Person" value={lead.contact_name} />
        <InfoField icon={Mail} label="Contact Email" value={lead.contact_email} />
        <InfoField icon={Phone} label="Contact Phone" value={lead.contact_phone} />
        <InfoField icon={ShoppingCart} label="Ordering Platform" value={lead.ordering_platform_name} />
        <InfoField icon={Globe} label="Ordering URL" value={lead.ordering_platform_url} isLink />
        {lead.opening_hours && Array.isArray(lead.opening_hours) && lead.opening_hours.length > 0 && (
          <div className="flex items-start gap-2 py-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Hours</div>
              <div className="text-xs max-h-20 overflow-y-auto space-y-0.5">
                {lead.opening_hours.map((entry: { day: string; open: string; close: string; period?: string }, idx: number) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="font-medium">{entry.day}{entry.period ? ` (${entry.period})` : ''}</span>
                    <span className="text-muted-foreground">{entry.open} - {entry.close}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Platform labels
const getPlatformLabel = (platform: string) => {
  const labels: Record<string, string> = {
    ubereats: 'UberEats',
    doordash: 'DoorDash',
    google_maps: 'Google Maps',
    delivereasy: 'DeliverEasy',
  };
  return labels[platform] || platform;
};

// Conversion result type
interface ConversionResult {
  leadId: string;
  restaurantName: string;
  success: boolean;
  error?: string;
  restaurantId?: string;
}

// Registration batch type from API response
interface RegistrationBatch {
  id: string;
  name: string;
  status: string;
  total_restaurants: number;
}

export function PendingLeadsTable({
  leads,
  isLoading,
  onRefresh,
}: PendingLeadsTableProps) {
  const navigate = useNavigate();

  // Selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
  const [convertedRestaurants, setConvertedRestaurants] = useState<Array<{
    id: string;
    name: string;
    lead_stage?: string;
    lead_warmth?: string;
    lead_status?: string;
    ubereats_url?: string | null;
    website_url?: string | null;
  }>>([]);

  // Registration batch state
  const [createRegistrationBatch, setCreateRegistrationBatch] = useState(true);
  const [registrationBatch, setRegistrationBatch] = useState<RegistrationBatch | null>(null);

  // Extraction options state
  const [showExtractionOptions, setShowExtractionOptions] = useState(false);
  const [extractionOptions, setExtractionOptions] = useState<Set<string>>(
    new Set(['menu', 'images', 'optionSets', 'branding'])
  );
  const [isStartingExtractions, setIsStartingExtractions] = useState(false);

  // Mutations
  const convertMutation = useConvertLeadsToRestaurants();
  const deleteMutation = useDeleteLeads();

  // Filter leads based on search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.restaurant_name.toLowerCase().includes(query) ||
        lead.city?.toLowerCase().includes(query) ||
        lead.phone?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  // Check if all filtered leads are selected
  const allSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((l) => selectedLeadIds.has(l.id));

  // Toggle single selection
  const toggleSelection = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  // Toggle expanded row
  const toggleExpanded = (leadId: string) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  // Check if all filtered leads are expanded
  const allExpanded = filteredLeads.length > 0 &&
    filteredLeads.every((lead) => expandedLeadIds.has(lead.id));

  // Toggle expand/collapse all filtered leads
  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedLeadIds(new Set());
    } else {
      setExpandedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  // Handle view lead detail
  const handleViewLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsDetailModalOpen(true);
  };

  // Handle convert selected leads
  const handleConvertSelected = async () => {
    if (selectedLeadIds.size === 0) return;

    setIsConverting(true);
    setConversionResults([]);
    setRegistrationBatch(null);
    setIsConversionDialogOpen(true);

    const leadIds = Array.from(selectedLeadIds);
    const results: ConversionResult[] = [];

    // Get lead names for display
    const leadsToConvert = leads.filter((l) => leadIds.includes(l.id));

    // Generate batch name from first lead's job or date
    const batchName = `Batch ${new Date().toISOString().split('T')[0]} (${leadIds.length} restaurants)`;

    try {
      const response = await convertMutation.mutateAsync({
        leadIds,
        createRegistrationBatch,
        batchName,
      });

      // Process converted leads from response
      if (response.converted) {
        response.converted.forEach((item: any) => {
          results.push({
            leadId: item.lead_id,
            restaurantName: item.restaurant_name,
            success: true,
            restaurantId: item.restaurant_id,
          });
        });
      }

      // Process failed leads from response
      if (response.failed) {
        response.failed.forEach((item: any) => {
          const lead = leadsToConvert.find((l) => l.id === item.lead_id);
          results.push({
            leadId: item.lead_id,
            restaurantName: lead?.restaurant_name || 'Unknown',
            success: false,
            error: item.error,
          });
        });
      }

      setConversionResults(results);

      // Store registration batch info if created
      if (response.registration_batch) {
        setRegistrationBatch(response.registration_batch);
      }

      // Capture converted restaurants for sequence enrollment (include URLs for extraction)
      const successfulConversions = results
        .filter(r => r.success && r.restaurantId)
        .map(r => {
          const originalLead = leadsToConvert.find(l => l.id === r.leadId);
          return {
            id: r.restaurantId!,
            name: r.restaurantName,
            lead_stage: 'uncontacted' as const,
            lead_warmth: 'frozen' as const,
            lead_status: 'inactive' as const,
            ubereats_url: originalLead?.store_link || null,
            website_url: originalLead?.website_url || null,
          };
        });
      setConvertedRestaurants(successfulConversions);

      clearSelection();
      onRefresh();
    } catch (error: any) {
      // Handle error - mark all as failed
      leadsToConvert.forEach((lead) => {
        results.push({
          leadId: lead.id,
          restaurantName: lead.restaurant_name,
          success: false,
          error: error.message || 'Conversion failed',
        });
      });
      setConversionResults(results);
    } finally {
      setIsConverting(false);
    }
  };

  // Handle convert single lead
  const handleConvertSingle = async (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    setIsConverting(true);
    setConversionResults([]);
    setRegistrationBatch(null);
    setIsConversionDialogOpen(true);

    // Generate batch name for single restaurant
    const batchName = `${lead.restaurant_name} - ${new Date().toISOString().split('T')[0]}`;

    try {
      const response = await convertMutation.mutateAsync({
        leadIds: [leadId],
        createRegistrationBatch,
        batchName,
      });

      const convertedItem = response.converted?.[0];
      const restaurantId = convertedItem?.restaurant_id;
      const success = !!convertedItem;

      setConversionResults([
        {
          leadId: lead.id,
          restaurantName: convertedItem?.restaurant_name || lead.restaurant_name,
          success,
          restaurantId,
          error: !success ? response.failed?.[0]?.error : undefined,
        },
      ]);

      // Store registration batch info if created
      if (response.registration_batch) {
        setRegistrationBatch(response.registration_batch);
      }

      // Capture converted restaurant for sequence enrollment (include URLs for extraction)
      if (restaurantId) {
        setConvertedRestaurants([{
          id: restaurantId,
          name: lead.restaurant_name,
          lead_stage: 'uncontacted' as const,
          lead_warmth: 'frozen' as const,
          lead_status: 'inactive' as const,
          ubereats_url: lead.store_link || null,
          website_url: lead.website_url || null,
        }]);
      }

      onRefresh();
    } catch (error: any) {
      setConversionResults([
        {
          leadId: lead.id,
          restaurantName: lead.restaurant_name,
          success: false,
          error: error.message || 'Conversion failed',
        },
      ]);
    } finally {
      setIsConverting(false);
    }
  };

  // Handle delete selected leads
  const handleDeleteSelected = async () => {
    if (selectedLeadIds.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedLeadIds.size} lead(s)? This cannot be undone.`
      )
    )
      return;

    await deleteMutation.mutateAsync(Array.from(selectedLeadIds));
    clearSelection();
    onRefresh();
  };

  // Toggle extraction option
  const toggleExtractionOption = (option: string) => {
    setExtractionOptions(prev => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
        // If removing menu, also remove dependent options
        if (option === 'menu') {
          next.delete('images');
          next.delete('optionSets');
        }
      } else {
        next.add(option);
      }
      return next;
    });
  };

  // Handle sequence success - show extraction options if URLs available
  const handleSequenceSuccess = (
    result: { summary: { success: number }; succeeded: { restaurant_id: string }[] },
    restaurants: typeof convertedRestaurants
  ) => {
    // Only show extraction options if there are successful sequences
    if (result.summary.success > 0) {
      const successfulRestaurantIds = new Set(result.succeeded.map(s => s.restaurant_id));
      const eligibleRestaurants = restaurants.filter(r => successfulRestaurantIds.has(r.id));

      // Check if any have extractable URLs
      const hasUberEats = eligibleRestaurants.some(r => r.ubereats_url);
      const hasWebsite = eligibleRestaurants.some(r => r.website_url);

      if (hasUberEats || hasWebsite) {
        setConvertedRestaurants(eligibleRestaurants);
        // Reset extraction options to defaults
        setExtractionOptions(new Set(['menu', 'images', 'optionSets', 'branding']));
        setShowExtractionOptions(true);
      }
    }
  };

  // Handle starting extractions
  const handleStartExtractions = async () => {
    setIsStartingExtractions(true);

    try {
      const menuJobIds: string[] = [];
      let brandingCount = 0;

      // 1. Start menu extractions (async jobs) for restaurants with UberEats URLs
      if (extractionOptions.has('menu')) {
        const restaurantsWithUberEats = convertedRestaurants.filter(r => r.ubereats_url);

        for (const restaurant of restaurantsWithUberEats) {
          try {
            const response = await api.post('/extract-menu-premium', {
              storeUrl: restaurant.ubereats_url,
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
              async: true,
              extractOptionSets: extractionOptions.has('optionSets'),
              validateImages: extractionOptions.has('images'),
            });

            if (response.data.jobId) {
              menuJobIds.push(response.data.jobId);
            }
          } catch (error) {
            console.error(`Menu extraction failed for ${restaurant.name}:`, error);
          }

          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 2. Start branding extractions (fire and forget) for restaurants with website URLs
      if (extractionOptions.has('branding')) {
        const restaurantsWithWebsite = convertedRestaurants.filter(r => r.website_url);
        brandingCount = restaurantsWithWebsite.length;

        for (const restaurant of restaurantsWithWebsite) {
          // Fire without awaiting - true fire and forget
          api.post('/website-extraction/branding', {
            restaurantId: restaurant.id,
            sourceUrl: restaurant.website_url,
            previewOnly: false,
            versionsToUpdate: [
              'logo_url', 'logo_nobg_url', 'logo_standard_url',
              'logo_thermal_url', 'logo_thermal_alt_url', 'logo_thermal_contrast_url',
              'logo_thermal_adaptive_url', 'logo_favicon_url'
            ],
            colorsToUpdate: [
              'primary_color', 'secondary_color', 'tertiary_color',
              'accent_color', 'background_color', 'theme'
            ],
            headerFieldsToUpdate: [
              'website_og_image', 'website_og_title', 'website_og_description'
            ]
          }).catch((error) => {
            console.error(`Branding extraction failed for ${restaurant.name}:`, error);
          });
        }
      }

      // 3. Mark registration jobs as having extractions executed on creation
      // This prevents Step 1 from re-triggering extractions when batch starts
      if (registrationBatch && (menuJobIds.length > 0 || brandingCount > 0)) {
        const restaurantIdsWithExtractions = new Set<string>();

        // Add restaurants that had menu extraction started
        if (menuJobIds.length > 0) {
          convertedRestaurants
            .filter(r => r.ubereats_url)
            .forEach(r => restaurantIdsWithExtractions.add(r.id));
        }

        // Add restaurants that had branding extraction started
        if (brandingCount > 0) {
          convertedRestaurants
            .filter(r => r.website_url)
            .forEach(r => restaurantIdsWithExtractions.add(r.id));
        }

        if (restaurantIdsWithExtractions.size > 0) {
          try {
            await api.post(`/registration-batches/${registrationBatch.id}/mark-extractions-executed`, {
              restaurant_ids: Array.from(restaurantIdsWithExtractions)
            });
          } catch (error) {
            console.error('Failed to mark extractions as executed:', error);
            // Non-blocking - continue even if this fails
          }
        }
      }

      // 4. Show success toast
      const messages: string[] = [];
      if (menuJobIds.length > 0) {
        messages.push(`${menuJobIds.length} menu extraction${menuJobIds.length !== 1 ? 's' : ''}`);
      }
      if (brandingCount > 0) {
        messages.push(`${brandingCount} branding extraction${brandingCount !== 1 ? 's' : ''}`);
      }

      if (messages.length > 0) {
        toast.success('Extractions started!', {
          description: `Started ${messages.join(' and ')} in background`,
        });
      }

      // Close dialog and clean up
      setShowExtractionOptions(false);
      setConvertedRestaurants([]);

      // Navigate to registration batch detail if batch was created
      if (registrationBatch) {
        navigate(`/registration-batches/${registrationBatch.id}`);
        setRegistrationBatch(null);
      }

    } catch (error) {
      toast.error('Failed to start extractions', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsStartingExtractions(false);
    }
  };

  // Get conversion summary
  const conversionSummary = useMemo(() => {
    const successful = conversionResults.filter((r) => r.success).length;
    const failed = conversionResults.filter((r) => !r.success).length;
    return { successful, failed, total: conversionResults.length };
  }, [conversionResults]);

  const isAnyLoading = convertMutation.isPending || deleteMutation.isPending;

  // Loading state
  if (isLoading) {
    return <TableSkeleton />;
  }

  // Empty state
  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No pending leads</h3>
        <p className="text-muted-foreground">
          Leads that complete all extraction steps will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and bulk actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, city, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleExpandAll}
            disabled={filteredLeads.length === 0}
          >
            <ChevronsDownUp className="h-4 w-4 mr-1" />
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>

        {/* Bulk action buttons */}
        {selectedLeadIds.size > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {selectedLeadIds.size} selected
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={createRegistrationBatch}
                onCheckedChange={(checked) => setCreateRegistrationBatch(!!checked)}
              />
              <span className="text-sm">Create Registration Batch</span>
            </label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleConvertSelected}
                disabled={isAnyLoading}
              >
                {convertMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRightCircle className="h-4 w-4 mr-2" />
                )}
                Convert to Restaurants
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={isAnyLoading}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={toggleExpandAll}
                  title={allExpanded ? 'Collapse All' : 'Expand All'}
                >
                  {allExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead className="w-24">Platform</TableHead>
              <TableHead className="w-28">Location</TableHead>
              <TableHead className="w-36">Cuisine</TableHead>
              <TableHead className="w-20">Rating</TableHead>
              <TableHead className="w-32">Contact</TableHead>
              <TableHead className="w-28">Created</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead) => (
              <React.Fragment key={lead.id}>
                <TableRow
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    selectedLeadIds.has(lead.id) && 'bg-blue-50',
                    expandedLeadIds.has(lead.id) && 'border-b-0'
                  )}
                >
                  <TableCell className="w-8 p-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleExpanded(lead.id)}
                    >
                      {expandedLeadIds.has(lead.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedLeadIds.has(lead.id)}
                      onCheckedChange={() => toggleSelection(lead.id)}
                    />
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    <div>
                      <div className="font-medium">{lead.restaurant_name}</div>
                      {lead.store_link && (
                        <a
                          href={lead.store_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 py-0.5 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          View on {getPlatformLabel(lead.platform)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    <Badge variant="outline">{getPlatformLabel(lead.platform)}</Badge>
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    {lead.city && (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {lead.city}
                      </div>
                    )}
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    <div className="flex flex-wrap gap-1">
                      {lead.ubereats_cuisine?.slice(0, 2).map((c, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {c}
                        </Badge>
                      ))}
                      {lead.ubereats_cuisine && lead.ubereats_cuisine.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{lead.ubereats_cuisine.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    {lead.ubereats_average_review_rating ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">
                          {lead.ubereats_average_review_rating.toFixed(1)}
                        </span>
                        {lead.ubereats_number_of_reviews && (
                          <span className="text-xs text-muted-foreground">
                            ({lead.ubereats_number_of_reviews})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    <div className="space-y-1">
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[100px]">{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[100px]">{lead.email}</span>
                        </div>
                      )}
                      {!lead.phone && !lead.email && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => toggleExpanded(lead.id)}>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleViewLead(lead.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleConvertSingle(lead.id)}
                        disabled={isAnyLoading}
                      >
                        <ArrowRightCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {/* Expanded details row with animation */}
                <Collapsible open={expandedLeadIds.has(lead.id)} asChild>
                  <TableRow className="hover:bg-transparent border-0">
                    <TableCell colSpan={10} className="p-0">
                      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                        <LeadDetailsPanel lead={lead} />
                      </CollapsibleContent>
                    </TableCell>
                  </TableRow>
                </Collapsible>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground text-center">
        {searchQuery && filteredLeads.length !== leads.length
          ? `Showing ${filteredLeads.length} of ${leads.length} leads`
          : `${leads.length} pending lead${leads.length !== 1 ? 's' : ''}`}
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        open={isDetailModalOpen}
        leadId={selectedLeadId}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLeadId(null);
        }}
        onSuccess={onRefresh}
      />

      {/* Conversion Progress Dialog */}
      <Dialog open={isConversionDialogOpen} onOpenChange={setIsConversionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isConverting ? 'Converting Leads...' : 'Conversion Complete'}
            </DialogTitle>
            <DialogDescription>
              {isConverting
                ? 'Please wait while leads are being converted to restaurants.'
                : `${conversionSummary.successful} of ${conversionSummary.total} leads converted successfully.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isConverting ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                </div>
                <Progress value={undefined} className="w-full" />
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {conversionResults.map((result) => (
                    <div
                      key={result.leadId}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg',
                        result.success ? 'bg-green-50' : 'bg-red-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        {result.success && result.restaurantId ? (
                          <Link
                            to={`/restaurants/${result.restaurantId}`}
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {result.restaurantName}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium">
                            {result.restaurantName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs">
                        {result.success ? (
                          <span className="text-green-600">Converted</span>
                        ) : (
                          <span className="text-red-600">{result.error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {!isConverting && (
            <DialogFooter className="flex justify-between sm:justify-between">
              <div className="flex gap-2">
                {conversionSummary.successful > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSequenceModalOpen(true);
                      setIsConversionDialogOpen(false);
                    }}
                  >
                    Start Sequence ({conversionSummary.successful})
                  </Button>
                )}
                {registrationBatch && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsConversionDialogOpen(false);
                      navigate(`/registration-batches/${registrationBatch.id}`);
                    }}
                  >
                    View Registration Batch
                  </Button>
                )}
              </div>
              <Button onClick={() => setIsConversionDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Sequence Enrollment Modal */}
      <BulkStartSequenceModal
        open={isSequenceModalOpen}
        onClose={() => {
          setIsSequenceModalOpen(false);
          // Only clear if not showing extraction options
          if (!showExtractionOptions) {
            setConvertedRestaurants([]);
          }
        }}
        onSuccess={handleSequenceSuccess}
        restaurants={convertedRestaurants}
      />

      {/* Extraction Options Dialog */}
      <Dialog open={showExtractionOptions} onOpenChange={(open) => {
        setShowExtractionOptions(open);
        if (!open) {
          setConvertedRestaurants([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Automatic Extractions</DialogTitle>
            <DialogDescription>
              Select which extractions to run for {convertedRestaurants.length} converted restaurant{convertedRestaurants.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Menu Extraction Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Menu Extraction (UberEats)</Label>
              <p className="text-xs text-muted-foreground">
                {convertedRestaurants.filter(r => r.ubereats_url).length} restaurant{convertedRestaurants.filter(r => r.ubereats_url).length !== 1 ? 's have' : ' has'} UberEats URLs
              </p>
              <div className="space-y-2 pl-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={extractionOptions.has('menu')}
                    onCheckedChange={() => toggleExtractionOption('menu')}
                    disabled={!convertedRestaurants.some(r => r.ubereats_url)}
                  />
                  <span className="text-sm">Extract Menu Items</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={extractionOptions.has('images')}
                    onCheckedChange={() => toggleExtractionOption('images')}
                    disabled={!extractionOptions.has('menu') || !convertedRestaurants.some(r => r.ubereats_url)}
                  />
                  <span className="text-sm">Validate & Download Images</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={extractionOptions.has('optionSets')}
                    onCheckedChange={() => toggleExtractionOption('optionSets')}
                    disabled={!extractionOptions.has('menu') || !convertedRestaurants.some(r => r.ubereats_url)}
                  />
                  <span className="text-sm">Extract Option Sets</span>
                </label>
              </div>
            </div>

            {/* Branding Extraction Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Branding Extraction (Website)</Label>
              <p className="text-xs text-muted-foreground">
                {convertedRestaurants.filter(r => r.website_url).length} restaurant{convertedRestaurants.filter(r => r.website_url).length !== 1 ? 's have' : ' has'} website URLs
              </p>
              <div className="space-y-2 pl-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={extractionOptions.has('branding')}
                    onCheckedChange={() => toggleExtractionOption('branding')}
                    disabled={!convertedRestaurants.some(r => r.website_url)}
                  />
                  <span className="text-sm">Extract Logo, Colors & Favicon</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExtractionOptions(false);
                setConvertedRestaurants([]);
                // Navigate to batch detail if skipping extractions but batch was created
                if (registrationBatch) {
                  navigate(`/registration-batches/${registrationBatch.id}`);
                  setRegistrationBatch(null);
                }
              }}
            >
              {registrationBatch ? 'Skip & View Batch' : 'Skip Extractions'}
            </Button>
            <Button
              onClick={handleStartExtractions}
              disabled={extractionOptions.size === 0 || isStartingExtractions}
            >
              {isStartingExtractions ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                `Start Extractions`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PendingLeadsTable;
