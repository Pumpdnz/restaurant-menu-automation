import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Collapsible,
  CollapsibleContent,
} from '../ui/collapsible';
import {
  ExternalLink,
  Star,
  MapPin,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Trash2,
  Play,
  Eye,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Phone,
  Globe,
  Instagram,
  Facebook,
  DollarSign,
  Clock,
  Mail,
  User,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  Lead,
  LeadScrapeJobStep,
  useStepLeads,
  usePassLeadsToNextStep,
  useRetryFailedLeads,
  useDeleteLeads,
  useTriggerExtraction,
} from '../../hooks/useLeadScrape';
import { LeadDetailModal } from './LeadDetailModal';

interface ScrapeJobStepDetailModalProps {
  open: boolean;
  jobId: string;
  step: LeadScrapeJobStep | null;
  onClose: () => void;
  onRefresh?: () => void;
}

// Status colors for badges
const statusColors: Record<string, string> = {
  available: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  processed: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// Row backgrounds by status
const rowBackgrounds: Record<string, string> = {
  available: '',
  processing: 'bg-blue-50/30',
  processed: 'bg-yellow-50/30',
  passed: 'bg-green-50/30',
  failed: 'bg-red-50/30',
};

// Step status colors
const stepStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  action_required: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// Compute display status based on lead position relative to viewed step
// If lead has moved beyond this step, show as "passed"
// Otherwise show the actual step_progression_status
const getDisplayStatus = (lead: Lead, viewingStepNumber: number): string => {
  if (lead.current_step > viewingStepNumber) {
    return 'passed';
  }
  return lead.step_progression_status;
};

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

export function ScrapeJobStepDetailModal({
  open,
  jobId,
  step,
  onClose,
  onRefresh,
}: ScrapeJobStepDetailModalProps) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

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

  // Fetch leads for this step
  const { data, isLoading, refetch } = useStepLeads(jobId, step?.step_number || 0, {
    enabled: open && !!step,
  });

  // Mutations
  const passLeadsMutation = usePassLeadsToNextStep();
  const retryMutation = useRetryFailedLeads();
  const deleteMutation = useDeleteLeads();
  const triggerExtractionMutation = useTriggerExtraction();

  const leads = data?.leads || [];

  // Filter leads based on search and status (using computed display status)
  const filteredLeads = useMemo(() => {
    if (!step) return [];
    return leads.filter((lead) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          lead.restaurant_name.toLowerCase().includes(query) ||
          lead.city?.toLowerCase().includes(query) ||
          lead.ubereats_address?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter (use computed display status)
      const displayStatus = getDisplayStatus(lead, step.step_number);
      if (statusFilter !== 'all' && displayStatus !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [leads, searchQuery, statusFilter, step]);

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

  // Get selectable leads (not passed or processing based on computed status)
  const selectableLeads = filteredLeads.filter((l) => {
    if (!step) return false;
    const displayStatus = getDisplayStatus(l, step.step_number);
    return displayStatus !== 'passed' && displayStatus !== 'processing';
  });

  // Check if all selectable leads are selected
  const allSelected = selectableLeads.length > 0 &&
    selectableLeads.every((l) => selectedLeadIds.has(l.id));

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
      setSelectedLeadIds(new Set(selectableLeads.map((l) => l.id)));
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  // Handle pass leads
  const handlePassLeads = async () => {
    if (selectedLeadIds.size === 0 || !step) return;
    await passLeadsMutation.mutateAsync({
      stepId: step.id,
      leadIds: Array.from(selectedLeadIds),
      jobId,
      stepNumber: step.step_number,
    });
    clearSelection();
    refetch();
    onRefresh?.();
  };

  // Handle retry leads
  const handleRetryLeads = async () => {
    if (selectedLeadIds.size === 0 || !step) return;
    await retryMutation.mutateAsync({
      stepId: step.id,
      leadIds: Array.from(selectedLeadIds),
    });
    clearSelection();
    refetch();
    onRefresh?.();
  };

  // Handle delete leads
  const handleDeleteLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedLeadIds.size} lead(s)? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(Array.from(selectedLeadIds));
    clearSelection();
    refetch();
    onRefresh?.();
  };

  // Handle trigger extraction for selected leads
  const handleTriggerExtraction = async () => {
    if (!step) return;
    const leadIds = selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : undefined;
    await triggerExtractionMutation.mutateAsync({
      jobId,
      stepNumber: step.step_number,
      leadIds,
    });
    clearSelection();
    refetch();
    onRefresh?.();
  };

  // Handle pass all processed leads to next step (auto-triggers processing)
  const handlePassAllAndProcess = async () => {
    if (!step) return;
    // Get all leads with 'processed' status at this step
    const processedLeads = leads.filter((lead) => {
      const displayStatus = getDisplayStatus(lead, step.step_number);
      return displayStatus === 'processed';
    });

    if (processedLeads.length === 0) {
      return;
    }

    await passLeadsMutation.mutateAsync({
      stepId: step.id,
      leadIds: processedLeads.map(l => l.id),
      jobId,
      stepNumber: step.step_number,
    });
    clearSelection();
    refetch();
    onRefresh?.();
  };

  // Open lead detail modal
  const handleLeadClick = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setIsLeadModalOpen(true);
  };

  // Get status counts (using computed display status)
  const statusCounts = useMemo(() => {
    if (!step) return {};
    return leads.reduce(
      (acc, lead) => {
        const displayStatus = getDisplayStatus(lead, step.step_number);
        acc[displayStatus] = (acc[displayStatus] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [leads, step]);

  const isAnyLoading =
    passLeadsMutation.isPending ||
    retryMutation.isPending ||
    deleteMutation.isPending ||
    triggerExtractionMutation.isPending;

  if (!step) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  Step {step.step_number}: {step.step_name}
                  <Badge
                    variant="outline"
                    className={cn('capitalize', stepStatusColors[step.status])}
                  >
                    {step.status.replace('_', ' ')}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {step.step_description || 'Manage leads at this extraction step'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Status summary */}
                <div className="flex gap-1">
                  {statusCounts.processing && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {statusCounts.processing} processing
                    </Badge>
                  )}
                  {statusCounts.passed && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {statusCounts.passed} passed
                    </Badge>
                  )}
                  {statusCounts.processed && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      {statusCounts.processed} ready
                    </Badge>
                  )}
                  {statusCounts.failed && (
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      {statusCounts.failed} failed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 py-3 border-b">
            {/* Search and filter */}
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={toggleExpandAll}
                disabled={filteredLeads.length === 0}
              >
                <ChevronsDownUp className="h-4 w-4 mr-1" />
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
                Refresh
              </Button>
              {/* Pass All & Process button - passes all processed leads to next step and triggers processing */}
              {step.status !== 'completed' && step.step_number !== 1 && selectedLeadIds.size === 0 && (statusCounts.processed || 0) > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handlePassAllAndProcess}
                  disabled={isAnyLoading || step.status === 'in_progress'}
                >
                  {passLeadsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-1" />
                  )}
                  Pass All & Process ({statusCounts.processed})
                </Button>
              )}
              {/* Process Selected button - re-processes selected leads at current step */}
              {step.status !== 'completed' && step.step_number !== 1 && selectedLeadIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTriggerExtraction}
                  disabled={isAnyLoading || step.status === 'in_progress'}
                >
                  {triggerExtractionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Process {selectedLeadIds.size} Selected
                </Button>
              )}
            </div>
          </div>

          {/* Selection toolbar */}
          {selectedLeadIds.size > 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-blue-50 border-b">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-700">
                  {selectedLeadIds.size} selected
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={clearSelection}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handlePassLeads}
                  disabled={isAnyLoading}
                >
                  {passLeadsMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <ArrowRight className="h-3 w-3 mr-1" />
                  )}
                  Pass to Next
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleRetryLeads}
                  disabled={isAnyLoading}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-600 hover:text-red-700"
                  onClick={handleDeleteLeads}
                  disabled={isAnyLoading}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Leads table */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <div className="text-sm">
                  {leads.length === 0
                    ? 'No leads at this step'
                    : 'No leads match your filters'}
                </div>
                {leads.length > 0 && (
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
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
                    <TableHead className="w-32">Location</TableHead>
                    <TableHead className="w-24">Rating</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-20">Issues</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const displayStatus = getDisplayStatus(lead, step.step_number);
                    return (
                    <React.Fragment key={lead.id}>
                      <TableRow
                        className={cn(
                          'cursor-pointer',
                          rowBackgrounds[displayStatus],
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
                            disabled={displayStatus === 'passed' || displayStatus === 'processing'}
                          />
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(lead.id)}>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {lead.restaurant_name}
                              {lead.is_duplicate && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-orange-50 text-orange-700"
                                >
                                  Dup
                                </Badge>
                              )}
                            </div>
                            {lead.ubereats_cuisine && lead.ubereats_cuisine.length > 0 && (
                              <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                                {lead.ubereats_cuisine.join(', ')}
                              </div>
                            )}
                          </div>
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
                          {lead.ubereats_average_review_rating ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {lead.ubereats_average_review_rating.toFixed(1)}
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
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs capitalize',
                              statusColors[displayStatus]
                            )}
                          >
                            {displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(lead.id)}>
                          {lead.validation_errors && lead.validation_errors.length > 0 ? (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                              {lead.validation_errors.length}
                            </Badge>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleLeadClick(lead)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {lead.store_link && (
                              <a
                                href={lead.store_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-7 w-7 hover:bg-muted rounded"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded details row with animation */}
                      <Collapsible open={expandedLeadIds.has(lead.id)} asChild>
                        <TableRow className="hover:bg-transparent border-0">
                          <TableCell colSpan={8} className="p-0">
                            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                              <LeadDetailsPanel lead={lead} />
                            </CollapsibleContent>
                          </TableCell>
                        </TableRow>
                      </Collapsible>
                    </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer with counts */}
          <div className="flex items-center justify-between py-2 px-3 border-t bg-muted/20 text-xs text-muted-foreground">
            <div>
              Showing {filteredLeads.length} of {leads.length} leads
            </div>
            <div className="flex gap-4">
              <span>Received: {step.leads_received}</span>
              <span>Processed: {step.leads_processed}</span>
              <span className="text-green-600">Passed: {step.leads_passed}</span>
              <span className="text-red-600">Failed: {step.leads_failed}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead detail modal */}
      <LeadDetailModal
        open={isLeadModalOpen}
        leadId={selectedLeadId}
        stepId={step?.id}
        onClose={() => {
          setIsLeadModalOpen(false);
          setSelectedLeadId(null);
        }}
        onSuccess={() => {
          refetch();
          onRefresh?.();
        }}
      />
    </>
  );
}

export default ScrapeJobStepDetailModal;
