import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ChevronDown,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Eye,
  Play,
  ArrowRight,
  Users,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import {
  LeadScrapeJobStep,
  useTriggerExtraction,
} from '../../hooks/useLeadScrape';
import { LeadPreview } from './LeadPreview';
import { ScrapeJobStepDetailModal } from './ScrapeJobStepDetailModal';

interface ScrapeJobStepListProps {
  jobId: string;
  steps: LeadScrapeJobStep[];
  currentStep: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onRefresh?: () => void;
  onStepClick?: (step: LeadScrapeJobStep) => void;
}

// Step status icon helper
const getStepStatusIcon = (status: string) => {
  switch (status) {
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'action_required':
      return (
        <div className="h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
      );
    case 'pending':
      return <Clock className="h-4 w-4 text-gray-400" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};

// Step type badge colors
const stepTypeColors: Record<string, string> = {
  automatic: 'bg-blue-50 text-blue-700 border-blue-200',
  action_required: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function ScrapeJobStepList({
  jobId,
  steps,
  currentStep,
  isExpanded = true,
  onToggleExpand,
  onRefresh,
  onStepClick,
}: ScrapeJobStepListProps) {
  const [processingSteps, setProcessingSteps] = useState<Set<number>>(new Set());
  const [selectedStep, setSelectedStep] = useState<LeadScrapeJobStep | null>(null);
  const [isStepDetailModalOpen, setIsStepDetailModalOpen] = useState(false);

  // Open step detail modal
  const handleOpenStepDetail = (step: LeadScrapeJobStep) => {
    setSelectedStep(step);
    setIsStepDetailModalOpen(true);
  };

  // Close step detail modal
  const handleCloseStepDetail = () => {
    setIsStepDetailModalOpen(false);
    setSelectedStep(null);
  };

  // Mutation for triggering extraction
  const triggerExtractionMutation = useTriggerExtraction();

  // Handle starting extraction for a step
  const handleTriggerExtraction = async (stepNumber: number) => {
    setProcessingSteps(prev => new Set(prev).add(stepNumber));
    try {
      await triggerExtractionMutation.mutateAsync({
        jobId,
        stepNumber,
      });
      if (onRefresh) onRefresh();
    } finally {
      setProcessingSteps(prev => {
        const next = new Set(prev);
        next.delete(stepNumber);
        return next;
      });
    }
  };

  // Get leads display for a step
  const getLeadsDisplay = (step: LeadScrapeJobStep) => {
    // Wrapper to make leads clickable with preview popover
    const LeadsWrapper = ({ children }: { children: React.ReactNode }) => {
      // Only wrap with preview if step has leads
      if (step.leads_received > 0 || step.leads_processed > 0) {
        return (
          <LeadPreview
            jobId={jobId}
            step={step}
            onLeadClick={() => handleOpenStepDetail(step)}
            onViewAllClick={() => handleOpenStepDetail(step)}
          >
            <button className="text-left hover:underline cursor-pointer">
              {children}
            </button>
          </LeadPreview>
        );
      }
      return <>{children}</>;
    };

    switch (step.status) {
      case 'in_progress':
        return (
          <LeadsWrapper>
            <div className="flex items-center gap-1 text-blue-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Processing...</span>
              {step.leads_received > 0 && (
                <span className="text-xs">({step.leads_received - step.leads_processed})</span>
              )}
            </div>
          </LeadsWrapper>
        );
      case 'action_required':
        // Calculate ready leads: processed but not yet passed
        const readyToReview = step.leads_processed - step.leads_passed;
        return (
          <LeadsWrapper>
            <div className="text-orange-500 text-sm font-medium flex items-center gap-1">
              <Users className="h-3 w-3" />
              {readyToReview > 0 ? `${readyToReview} ready to review` : 'No leads ready'}
            </div>
          </LeadsWrapper>
        );
      case 'pending':
        // Pending but has leads received from previous step
        if (step.leads_received > 0) {
          return (
            <LeadsWrapper>
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="h-3 w-3" />
                <span className="text-sm">{step.leads_received} ready for processing</span>
              </div>
            </LeadsWrapper>
          );
        }
        return (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="h-3 w-3" />
            <span className="text-xs">Pending</span>
          </div>
        );
      case 'completed':
        return (
          <LeadsWrapper>
            <div className="text-green-600 text-sm flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="font-medium">{step.leads_passed} passed</span>
            </div>
          </LeadsWrapper>
        );
      case 'failed':
        return (
          <LeadsWrapper>
            <div className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">{step.leads_failed} failed</span>
            </div>
          </LeadsWrapper>
        );
      default:
        return <span className="text-muted-foreground text-xs">-</span>;
    }
  };

  // Get step action button
  const getStepActions = (step: LeadScrapeJobStep) => {
    const isProcessing = processingSteps.has(step.step_number);

    // For pending steps that are the current step
    if (step.status === 'pending' && step.step_number === currentStep) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleTriggerExtraction(step.step_number)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Play className="h-3 w-3 mr-1" />
              Start
            </>
          )}
        </Button>
      );
    }

    // For action_required steps
    if (step.status === 'action_required') {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenStepDetail(step)}
        >
          <Eye className="h-3 w-3 mr-1" />
          Review
        </Button>
      );
    }

    // For completed steps with leads to view
    if (step.status === 'completed' && step.leads_passed > 0) {
      return (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleOpenStepDetail(step)}
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
      );
    }

    // For in_progress steps
    if (step.status === 'in_progress') {
      return (
        <div className="text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
          Processing...
        </div>
      );
    }

    return null;
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <>
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !isExpanded && "-rotate-90"
                )}
              />
              <span className="text-sm font-medium">
                Extraction Steps ({steps.filter(s => s.status === 'completed').length}/{steps.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Step status indicators */}
              {steps.map((step) => (
                <div key={step.id} title={`Step ${step.step_number}: ${step.step_name}`}>
                  {getStepStatusIcon(step.status)}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Status</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-32">Leads</TableHead>
                  <TableHead className="w-32">Time</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => (
                  <TableRow
                    key={step.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      step.step_number === currentStep
                        ? 'bg-blue-50/50'
                        : step.status === 'action_required'
                          ? 'bg-orange-50/50'
                          : ''
                    }`}
                    onClick={() => handleOpenStepDetail(step)}
                  >
                    <TableCell>
                      {getStepStatusIcon(step.status)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {step.step_number}. {step.step_name}
                        </div>
                        {step.step_description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {step.step_description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={stepTypeColors[step.step_type] || 'bg-gray-50'}
                      >
                        {step.step_type === 'automatic' ? 'Auto' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {getLeadsDisplay(step)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {step.completed_at ? (
                          <span title={format(new Date(step.completed_at), 'PPpp')}>
                            {formatDistanceToNow(new Date(step.completed_at), { addSuffix: true })}
                          </span>
                        ) : step.started_at ? (
                          <span title={format(new Date(step.started_at), 'PPpp')}>
                            Started {formatDistanceToNow(new Date(step.started_at), { addSuffix: true })}
                          </span>
                        ) : (
                          '-'
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {getStepActions(step)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>

    {/* Step Detail Modal */}
    <ScrapeJobStepDetailModal
      open={isStepDetailModalOpen}
      jobId={jobId}
      step={selectedStep}
      onClose={handleCloseStepDetail}
      onRefresh={onRefresh}
    />
    </>
  );
}

export default ScrapeJobStepList;
