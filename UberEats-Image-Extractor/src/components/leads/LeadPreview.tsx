import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Star,
  MapPin,
  RefreshCw,
  ArrowRight,
  Trash2,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  Lead,
  LeadScrapeJobStep,
  useStepLeads,
  usePassLeadsToNextStep,
  useRetryFailedLeads,
  useDeleteLeads,
} from '../../hooks/useLeadScrape';

interface LeadPreviewProps {
  jobId: string;
  step: LeadScrapeJobStep;
  children: React.ReactNode;
  onLeadClick?: (lead: Lead) => void;
  onViewAllClick?: () => void;
}

// Status color mapping
const statusColors: Record<string, string> = {
  available: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  processed: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// Row background by status
const rowBackgrounds: Record<string, string> = {
  available: '',
  processing: 'bg-blue-50/50',
  processed: 'bg-yellow-50/50',
  passed: 'bg-green-50/50',
  failed: 'bg-red-50/50',
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

export function LeadPreview({
  jobId,
  step,
  children,
  onLeadClick,
  onViewAllClick,
}: LeadPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Fetch leads for this step
  const { data, isLoading, refetch } = useStepLeads(jobId, step.step_number, {
    enabled: isOpen,
  });

  // Mutations
  const passLeadsMutation = usePassLeadsToNextStep();
  const retryMutation = useRetryFailedLeads();
  const deleteMutation = useDeleteLeads();

  const leads = data?.leads || [];

  // Reset selection when popover closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedLeadIds(new Set());
    }
  }, [isOpen]);

  // Toggle selection
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

  // Select all
  const selectAll = () => {
    const selectableLeads = leads.filter((l) => {
      const displayStatus = getDisplayStatus(l, step.step_number);
      return displayStatus !== 'passed' && displayStatus !== 'processing';
    });
    setSelectedLeadIds(new Set(selectableLeads.map((l) => l.id)));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedLeadIds(new Set());
  };

  // Handle pass leads
  const handlePassLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    await passLeadsMutation.mutateAsync({
      stepId: step.id,
      leadIds: Array.from(selectedLeadIds),
      jobId,
      stepNumber: step.step_number,
    });
    setSelectedLeadIds(new Set());
    refetch();
  };

  // Handle retry leads
  const handleRetryLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    await retryMutation.mutateAsync({
      stepId: step.id,
      leadIds: Array.from(selectedLeadIds),
    });
    setSelectedLeadIds(new Set());
    refetch();
  };

  // Handle delete leads
  const handleDeleteLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedLeadIds.size} lead(s)? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(Array.from(selectedLeadIds));
    setSelectedLeadIds(new Set());
    refetch();
  };

  const isAnyLoading = passLeadsMutation.isPending || retryMutation.isPending || deleteMutation.isPending;

  // Get selectable leads (not passed or processing based on computed status)
  const selectableLeads = leads.filter((l) => {
    const displayStatus = getDisplayStatus(l, step.step_number);
    return displayStatus !== 'passed' && displayStatus !== 'processing';
  });
  const allSelected = selectableLeads.length > 0 && selectedLeadIds.size === selectableLeads.length;

  // Get counts by computed display status
  const statusCounts = leads.reduce(
    (acc, lead) => {
      const displayStatus = getDisplayStatus(lead, step.step_number);
      acc[displayStatus] = (acc[displayStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <div>
            <div className="font-medium text-sm">
              Step {step.step_number}: {step.step_name}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} at this step
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status counts */}
            <div className="flex gap-1">
              {statusCounts.processing && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  {statusCounts.processing} processing
                </Badge>
              )}
              {statusCounts.passed && (
                <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                  {statusCounts.passed} passed
                </Badge>
              )}
              {statusCounts.processed && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                  {statusCounts.processed} ready
                </Badge>
              )}
              {statusCounts.failed && (
                <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                  {statusCounts.failed} failed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Selection toolbar */}
        {selectedLeadIds.size > 0 && (
          <div className="flex items-center justify-between p-2 border-b bg-blue-50/50">
            <div className="text-sm text-blue-700">
              {selectedLeadIds.size} selected
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

        {/* Leads list */}
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No leads at this step
            </div>
          ) : (
            <div className="divide-y">
              {/* Select all row */}
              <div className="flex items-center gap-2 p-2 bg-muted/20 sticky top-0 z-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll();
                    else deselectAll();
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {allSelected ? 'Deselect all' : 'Select all'}
                </span>
              </div>

              {/* Lead rows */}
              {leads.map((lead) => {
                const displayStatus = getDisplayStatus(lead, step.step_number);
                return (
                <div
                  key={lead.id}
                  className={cn(
                    'flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors',
                    rowBackgrounds[displayStatus]
                  )}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={selectedLeadIds.has(lead.id)}
                    onCheckedChange={() => toggleSelection(lead.id)}
                    disabled={displayStatus === 'passed' || displayStatus === 'processing'}
                  />

                  {/* Lead info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onLeadClick?.(lead)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {lead.restaurant_name}
                      </span>
                      {lead.is_duplicate && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                          Duplicate
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {lead.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {lead.city}
                        </span>
                      )}
                      {lead.ubereats_average_review_rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-500" />
                          {lead.ubereats_average_review_rating.toFixed(1)}
                          {lead.ubereats_number_of_reviews && ` (${lead.ubereats_number_of_reviews})`}
                        </span>
                      )}
                      {lead.validation_errors && lead.validation_errors.length > 0 && (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <AlertTriangle className="h-3 w-3" />
                          {lead.validation_errors.length} issue{lead.validation_errors.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant="outline"
                    className={cn('text-xs capitalize shrink-0', statusColors[displayStatus])}
                  >
                    {displayStatus}
                  </Badge>

                  {/* External link */}
                  {lead.store_link && (
                    <a
                      href={lead.store_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-2 border-t bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-3 w-3 mr-1', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setIsOpen(false);
              onViewAllClick?.();
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            View All Details
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default LeadPreview;
