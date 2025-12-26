import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft,
  Play,
  XCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ChevronDown,
  ExternalLink,
  RotateCcw,
  ChevronsUpDown,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';

import {
  useRegistrationBatch,
  useStartRegistrationBatch,
  useCancelRegistrationBatch,
  useRetryRegistrationJob,
  RegistrationJob,
  REGISTRATION_STEPS,
  YOLO_MODE_SUB_STEPS,
  getSubStepStatus,
  getSubStepCounts,
} from '../hooks/useRegistrationBatch';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { cn } from '../lib/utils';

// Import registration batch components
import {
  StatusBadge,
  BatchStepProgress,
  CompanySelectionView,
  ContactSearchRetryView,
  YoloConfigBatchView,
} from '../components/registration-batch';

// Restaurant row component
function RestaurantRow({
  job,
  isExpanded,
  onToggle,
  onRetry,
}: {
  job: RegistrationJob;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const currentStepDef = REGISTRATION_STEPS[job.current_step - 1];
  const step6Data = job.steps?.find((s) => s.step_number === 6);

  // Get sub-step progress using the helper for nested structure
  const subStepProgress = step6Data?.sub_step_progress;
  const subStepCounts = getSubStepCounts(subStepProgress);
  const isStep6Active = job.current_step === 6 && (job.status === 'in_progress' || job.status === 'completed');
  const hasSubStepProgress = subStepCounts.total > 0;

  // Find currently running sub-step for display
  const currentSubStep = hasSubStepProgress
    ? YOLO_MODE_SUB_STEPS.find((s) => {
        const status = getSubStepStatus(subStepProgress, s.key);
        return status?.status === 'in_progress';
      })
    : null;

  return (
    <>
      <TableRow
        className={cn('cursor-pointer hover:bg-muted/30', isExpanded && 'bg-muted/50')}
        onClick={onToggle}
      >
        <TableCell>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )}
          />
        </TableCell>
        <TableCell className="font-medium">
          {job.restaurant?.name || job.restaurant_name || 'Unknown'}
        </TableCell>
        <TableCell>
          <StatusBadge status={job.status} />
        </TableCell>
        <TableCell>
          {currentStepDef ? (
            <div className="space-y-1">
              <span className="text-sm">
                Step {job.current_step}: {currentStepDef.step_name}
                {isStep6Active && hasSubStepProgress && (
                  <span className="text-muted-foreground ml-1">
                    ({subStepCounts.completed + subStepCounts.skipped}/{subStepCounts.total})
                  </span>
                )}
              </span>
              {/* Show current sub-step when Step 6 is in progress */}
              {isStep6Active && currentSubStep && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{currentSubStep.label}</span>
                </div>
              )}
              {/* Mini progress bar for Step 6 */}
              {isStep6Active && hasSubStepProgress && (
                <Progress
                  value={((subStepCounts.completed + subStepCounts.skipped) / subStepCounts.total) * 100}
                  className="h-1 w-24"
                />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {job.error_message && (
            <span className="text-sm text-destructive">{job.error_message}</span>
          )}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          {job.status === 'failed' && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/restaurants/${job.restaurant_id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>

      {/* Expanded details with animation */}
      <Collapsible open={isExpanded} asChild>
        <TableRow className="bg-muted/30 border-0">
          <TableCell colSpan={6} className="p-0">
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <div className="p-4">
                <div className="grid grid-cols-6 gap-2">
                  {job.steps?.map((step) => {
                    const stepDef = REGISTRATION_STEPS[step.step_number - 1];
                    return (
                      <div
                        key={step.step_number}
                        className={cn(
                          'p-2 rounded border text-center text-xs',
                          step.status === 'completed' && 'bg-green-50 border-green-200',
                          step.status === 'in_progress' && 'bg-blue-50 border-blue-200',
                          step.status === 'action_required' && 'bg-orange-50 border-orange-200',
                          step.status === 'failed' && 'bg-red-50 border-red-200',
                          step.status === 'pending' && 'bg-muted'
                        )}
                      >
                        <div className="font-medium">{stepDef?.step_name}</div>
                        <StatusBadge status={step.status} />
                        {step.duration_ms && (
                          <div className="text-muted-foreground mt-1">
                            {Math.round(step.duration_ms / 1000)}s
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sub-step progress for Step 6 */}
                {(job.current_step === 6 || step6Data?.status === 'completed') && hasSubStepProgress && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Yolo Mode Sub-Steps:</p>
                    <div className="flex flex-wrap gap-2">
                      {YOLO_MODE_SUB_STEPS.map((subStep) => {
                        const progress = getSubStepStatus(subStepProgress, subStep.key);
                        const status = progress?.status || 'pending';

                        return (
                          <Badge
                            key={subStep.key}
                            variant={
                              status === 'completed' ? 'default' :
                              status === 'in_progress' ? 'default' :
                              status === 'failed' ? 'destructive' :
                              status === 'skipped' ? 'outline' : 'secondary'
                            }
                            className={cn(
                              status === 'completed' && 'bg-green-500',
                              status === 'in_progress' && 'bg-blue-500',
                              status === 'skipped' && 'text-muted-foreground'
                            )}
                          >
                            {status === 'in_progress' && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {status === 'completed' && (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            {status === 'failed' && (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {subStep.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </Collapsible>
    </>
  );
}

// Main component
export default function RegistrationBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useRegistrationBatch(id);
  const startMutation = useStartRegistrationBatch();
  const cancelMutation = useCancelRegistrationBatch();
  const retryMutation = useRetryRegistrationJob();

  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [isProgressOpen, setIsProgressOpen] = useState(true);

  const batch = data?.batch_job;
  const jobs = data?.registration_jobs || [];

  // Calculate progress
  const progress = batch && batch.total_restaurants > 0
    ? Math.round(
        ((batch.completed_restaurants + batch.failed_restaurants) / batch.total_restaurants) * 100
      )
    : 0;

  // Check if action is required - look at actual step statuses, not just definitions
  const stepRequiringAction = useMemo(() => {
    if (!batch || jobs.length === 0) return null;

    // Check each step (1-6) to see if any job has that step with action_required status
    for (let stepNum = 1; stepNum <= 6; stepNum++) {
      const hasActionRequired = jobs.some((job) => {
        const step = job.steps?.find((s) => s.step_number === stepNum);
        return step?.status === 'action_required';
      });
      if (hasActionRequired) {
        return stepNum;
      }
    }

    return null;
  }, [batch, jobs]);

  const toggleExpanded = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-2">Batch Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The registration batch you're looking for doesn't exist.
          </p>
          <Button variant="outline" onClick={() => navigate('/registration-batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batches
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col -mt-6 -mb-6">
      {/* Sticky Header with Collapsible Progress Overview */}
      <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
        {/* Header Row */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/registration-batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{batch.name}</h1>
              <StatusBadge status={batch.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDistanceToNow(new Date(batch.created_at))} ago
              {batch.started_at && (
                <> &bull; Started {format(new Date(batch.started_at), 'PPp')}</>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            {batch.status === 'pending' && (
              <Button
                onClick={() => startMutation.mutate(batch.id)}
                disabled={startMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Batch
              </Button>
            )}
            {batch.status === 'in_progress' && (
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate(batch.id)}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Progress Overview */}
        <Collapsible open={isProgressOpen} onOpenChange={setIsProgressOpen}>
          <Card className="bg-card/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Progress Overview</CardTitle>
                    <CardDescription className="text-xs">
                      {batch.completed_restaurants} completed, {batch.failed_restaurants} failed of {batch.total_restaurants} restaurants
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{progress}%</span>
                    <ChevronsUpDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      !isProgressOpen && "rotate-180"
                    )} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <CardContent className="space-y-4 pt-0">
                {/* Overall progress bar */}
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Step progress */}
                <BatchStepProgress
                  currentStep={batch.current_step}
                  totalSteps={batch.total_steps}
                  stepRequiringAction={stepRequiringAction}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Scrollable Content */}
      <div className="pt-6 space-y-6">
        {/* Action Required Section */}
      {stepRequiringAction === 2 && (
        <ContactSearchRetryView
          batchId={batch.id}
          jobs={jobs}
          onComplete={refetch}
        />
      )}

      {stepRequiringAction === 3 && (
        <CompanySelectionView
          batchId={batch.id}
          jobs={jobs}
          onComplete={refetch}
        />
      )}

      {stepRequiringAction === 5 && (
        <YoloConfigBatchView
          batchId={batch.id}
          jobs={jobs}
          onComplete={refetch}
        />
      )}

      {/* Restaurant Table */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurants ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      if (expandedJobIds.size === jobs.length) {
                        setExpandedJobIds(new Set());
                      } else {
                        setExpandedJobIds(new Set(jobs.map((j) => j.id)));
                      }
                    }}
                    title={expandedJobIds.size === jobs.length ? 'Collapse All' : 'Expand All'}
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Current Step</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <RestaurantRow
                  key={job.id}
                  job={job}
                  isExpanded={expandedJobIds.has(job.id)}
                  onToggle={() => toggleExpanded(job.id)}
                  onRetry={() => retryMutation.mutate({ jobId: job.id })}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
