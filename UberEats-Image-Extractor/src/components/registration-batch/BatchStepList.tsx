import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  XCircle,
  ChevronRight,
} from 'lucide-react';

import {
  REGISTRATION_STEPS,
  YOLO_MODE_SUB_STEPS,
  StepSummary,
} from '../../hooks/useRegistrationBatch';

import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';

interface BatchStepListProps {
  currentStep: number;
  totalSteps: number;
  stepSummary?: Record<string, StepSummary>;
  onStepClick?: (stepNumber: number) => void;
  compact?: boolean;
}

// Get status icon for a step
function getStepStatusIcon(status: string, className?: string) {
  const iconClass = cn('h-4 w-4', className);

  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(iconClass, 'text-green-500')} />;
    case 'in_progress':
      return <Loader2 className={cn(iconClass, 'text-blue-500 animate-spin')} />;
    case 'action_required':
      return <AlertCircle className={cn(iconClass, 'text-orange-500')} />;
    case 'failed':
      return <XCircle className={cn(iconClass, 'text-red-500')} />;
    default:
      return <Clock className={cn(iconClass, 'text-muted-foreground')} />;
  }
}

// Get step status based on current step
function getStepStatus(stepNumber: number, currentStep: number, isActionRequired: boolean): string {
  if (stepNumber < currentStep) return 'completed';
  if (stepNumber === currentStep) {
    return isActionRequired ? 'action_required' : 'in_progress';
  }
  return 'pending';
}

// Progress bar for step
function StepProgressBar({ summary }: { summary?: StepSummary }) {
  if (!summary || summary.total === 0) return null;

  const completedPercent = (summary.completed / summary.total) * 100;
  const inProgressPercent = (summary.in_progress / summary.total) * 100;
  const failedPercent = (summary.failed / summary.total) * 100;

  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted mt-2">
      <div
        className="bg-green-500 transition-all"
        style={{ width: `${completedPercent}%` }}
      />
      <div
        className="bg-blue-500 transition-all"
        style={{ width: `${inProgressPercent}%` }}
      />
      <div
        className="bg-red-500 transition-all"
        style={{ width: `${failedPercent}%` }}
      />
    </div>
  );
}

export function BatchStepList({
  currentStep,
  totalSteps,
  stepSummary,
  onStepClick,
  compact = false,
}: BatchStepListProps) {
  return (
    <div className={cn('space-y-2', compact && 'space-y-1')}>
      {REGISTRATION_STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isActionRequired = step.step_type === 'action_required';
        const status = getStepStatus(stepNum, currentStep, isActionRequired && stepNum === currentStep);
        const summary = stepSummary?.[`step_${stepNum}`];

        const isClickable = !!onStepClick && stepNum <= currentStep;

        return (
          <div
            key={stepNum}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
              status === 'completed' && 'bg-green-50 border-green-200',
              status === 'in_progress' && 'bg-blue-50 border-blue-200',
              status === 'action_required' && 'bg-orange-50 border-orange-200',
              status === 'failed' && 'bg-red-50 border-red-200',
              status === 'pending' && 'bg-muted/50 border-muted',
              isClickable && 'cursor-pointer hover:shadow-sm',
              compact && 'p-2'
            )}
            onClick={() => isClickable && onStepClick?.(stepNum)}
          >
            {/* Step number and icon */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                  status === 'completed' && 'bg-green-500 text-white',
                  status === 'in_progress' && 'bg-blue-500 text-white',
                  status === 'action_required' && 'bg-orange-500 text-white',
                  status === 'failed' && 'bg-red-500 text-white',
                  status === 'pending' && 'bg-muted text-muted-foreground',
                  compact && 'w-6 h-6 text-xs'
                )}
              >
                {status === 'completed' ? (
                  <CheckCircle2 className={cn('h-4 w-4', compact && 'h-3 w-3')} />
                ) : (
                  stepNum
                )}
              </div>
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', compact && 'text-sm')}>
                  {step.step_name}
                </span>
                {step.step_type === 'action_required' && (
                  <Badge variant="outline" className="text-xs">
                    Manual
                  </Badge>
                )}
              </div>
              {!compact && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.step_description}
                </p>
              )}

              {/* Summary counts */}
              {summary && summary.total > 0 && (
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {summary.completed > 0 && (
                    <span className="text-green-600">{summary.completed} done</span>
                  )}
                  {summary.in_progress > 0 && (
                    <span className="text-blue-600">{summary.in_progress} running</span>
                  )}
                  {summary.action_required > 0 && (
                    <span className="text-orange-600">{summary.action_required} need action</span>
                  )}
                  {summary.failed > 0 && (
                    <span className="text-red-600">{summary.failed} failed</span>
                  )}
                  {summary.pending > 0 && (
                    <span>{summary.pending} pending</span>
                  )}
                </div>
              )}

              <StepProgressBar summary={summary} />
            </div>

            {/* Arrow for clickable items */}
            {isClickable && (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Horizontal step progress for header
export function BatchStepProgress({
  currentStep,
  totalSteps,
  stepRequiringAction,
}: {
  currentStep: number;
  totalSteps: number;
  stepRequiringAction: number | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span>Step Progress</span>
        <span className="font-medium">Step {currentStep} of {totalSteps}</span>
      </div>

      <div className="flex gap-2">
        {REGISTRATION_STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isActionRequired = stepNum === stepRequiringAction;

          return (
            <div key={stepNum} className="flex-1">
              <div
                className={cn(
                  'h-2 rounded-full transition-colors',
                  isCompleted && 'bg-green-500',
                  isCurrent && isActionRequired && 'bg-orange-500',
                  isCurrent && !isActionRequired && 'bg-blue-500 animate-pulse',
                  !isCompleted && !isCurrent && 'bg-muted'
                )}
              />
              <p
                className={cn(
                  'text-xs mt-1 truncate',
                  isCurrent ? 'font-medium' : 'text-muted-foreground'
                )}
                title={step.step_name}
              >
                {step.step_name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sub-step progress for Step 6 (Yolo Mode)
export function YoloSubStepProgress({
  subStepProgress,
  compact = false,
}: {
  subStepProgress: Record<string, { status: string; error?: string }>;
  compact?: boolean;
}) {
  const completedCount = Object.values(subStepProgress).filter(
    (s) => s.status === 'completed'
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Yolo Mode Progress</span>
        <span className="font-medium">{completedCount}/{YOLO_MODE_SUB_STEPS.length}</span>
      </div>

      <Progress
        value={(completedCount / YOLO_MODE_SUB_STEPS.length) * 100}
        className="h-2"
      />

      {!compact && (
        <div className="flex flex-wrap gap-2 mt-2">
          {YOLO_MODE_SUB_STEPS.map((subStep) => {
            const progress = subStepProgress[subStep.key];
            const status = progress?.status || 'pending';

            return (
              <Badge
                key={subStep.key}
                variant={
                  status === 'completed' ? 'default' :
                  status === 'in_progress' ? 'default' :
                  status === 'failed' ? 'destructive' : 'secondary'
                }
                className={cn(
                  'text-xs',
                  status === 'completed' && 'bg-green-500',
                  status === 'in_progress' && 'bg-blue-500'
                )}
              >
                {status === 'in_progress' && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {status === 'completed' && (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                {status === 'failed' && (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {subStep.label}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BatchStepList;
