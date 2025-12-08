import React, { useState, useMemo } from 'react';
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
  Check,
  X,
  AlertCircle,
  CheckCircle2,
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

export function PendingLeadsTable({
  leads,
  isLoading,
  onRefresh,
}: PendingLeadsTableProps) {
  // Selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);
  const [isConverting, setIsConverting] = useState(false);

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
    setIsConversionDialogOpen(true);

    const leadIds = Array.from(selectedLeadIds);
    const results: ConversionResult[] = [];

    // Get lead names for display
    const leadsToConvert = leads.filter((l) => leadIds.includes(l.id));

    try {
      const response = await convertMutation.mutateAsync(leadIds);

      // Process results from response
      if (response.results) {
        response.results.forEach((result: any) => {
          const lead = leadsToConvert.find((l) => l.id === result.lead_id);
          results.push({
            leadId: result.lead_id,
            restaurantName: lead?.restaurant_name || 'Unknown',
            success: result.success,
            error: result.error,
            restaurantId: result.restaurant_id,
          });
        });
      } else {
        // Fallback if no detailed results
        leadsToConvert.forEach((lead) => {
          results.push({
            leadId: lead.id,
            restaurantName: lead.restaurant_name,
            success: true,
          });
        });
      }

      setConversionResults(results);
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
    setIsConversionDialogOpen(true);

    try {
      const response = await convertMutation.mutateAsync([leadId]);

      setConversionResults([
        {
          leadId: lead.id,
          restaurantName: lead.restaurant_name,
          success: true,
          restaurantId: response.results?.[0]?.restaurant_id,
        },
      ]);
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Bulk action buttons */}
        {selectedLeadIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedLeadIds.size} selected
            </span>
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
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow
                key={lead.id}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  selectedLeadIds.has(lead.id) && 'bg-blue-50'
                )}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedLeadIds.has(lead.id)}
                    onCheckedChange={() => toggleSelection(lead.id)}
                  />
                </TableCell>
                <TableCell onClick={() => handleViewLead(lead.id)}>
                  <div>
                    <div className="font-medium">{lead.restaurant_name}</div>
                    {lead.store_link && (
                      <a
                        href={lead.store_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View on {getPlatformLabel(lead.platform)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell onClick={() => handleViewLead(lead.id)}>
                  <Badge variant="outline">{getPlatformLabel(lead.platform)}</Badge>
                </TableCell>
                <TableCell onClick={() => handleViewLead(lead.id)}>
                  {lead.city && (
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {lead.city}
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={() => handleViewLead(lead.id)}>
                  <div className="flex flex-wrap gap-1">
                    {lead.cuisine?.slice(0, 2).map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                    {lead.cuisine && lead.cuisine.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{lead.cuisine.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell onClick={() => handleViewLead(lead.id)}>
                  {lead.average_review_rating ? (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-medium">
                        {lead.average_review_rating.toFixed(1)}
                      </span>
                      {lead.number_of_reviews && (
                        <span className="text-xs text-muted-foreground">
                          ({lead.number_of_reviews})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell onClick={() => handleViewLead(lead.id)}>
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
                <TableCell onClick={() => handleViewLead(lead.id)}>
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
                        <span className="text-sm font-medium">
                          {result.restaurantName}
                        </span>
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
            <DialogFooter>
              <Button onClick={() => setIsConversionDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PendingLeadsTable;
