import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Play,
  XCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ChevronRight,
  Store,
} from 'lucide-react';

import {
  RegistrationBatchJob,
  useStartRegistrationBatch,
  useCancelRegistrationBatch,
  REGISTRATION_STEPS,
} from '../../hooks/useRegistrationBatch';

import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { cn } from '../../lib/utils';

// Status badge component
export function StatusBadge({ status, size = 'default' }: { status: string; size?: 'default' | 'sm' }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; icon?: React.ReactNode }> = {
    pending: { variant: 'secondary', icon: <Clock className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} /> },
    in_progress: { variant: 'default', className: 'bg-blue-500', icon: <Loader2 className={cn('mr-1 animate-spin', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} /> },
    action_required: { variant: 'outline', className: 'border-orange-500 text-orange-600', icon: <AlertCircle className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} /> },
    completed: { variant: 'default', className: 'bg-green-500', icon: <CheckCircle2 className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} /> },
    failed: { variant: 'destructive', icon: <XCircle className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} /> },
    cancelled: { variant: 'outline' },
  };

  const config = variants[status] || { variant: 'secondary' };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center',
        config.className,
        size === 'sm' && 'text-xs px-1.5 py-0'
      )}
    >
      {config.icon}
      {status.replace('_', ' ')}
    </Badge>
  );
}

// Step indicator component
export function StepIndicator({
  step,
  currentStep,
  isActionRequired,
  size = 'default',
}: {
  step: number;
  currentStep: number;
  isActionRequired: boolean;
  size?: 'default' | 'sm';
}) {
  const isCompleted = step < currentStep;
  const isCurrent = step === currentStep;

  const sizeClasses = size === 'sm'
    ? 'w-5 h-5 text-[10px]'
    : 'w-6 h-6 text-xs';

  const iconClasses = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium',
        sizeClasses,
        isCompleted && 'bg-green-500 text-white',
        isCurrent && isActionRequired && 'bg-orange-500 text-white',
        isCurrent && !isActionRequired && 'bg-blue-500 text-white animate-pulse',
        !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
      )}
      title={REGISTRATION_STEPS[step - 1]?.step_name}
    >
      {isCompleted ? (
        <CheckCircle2 className={iconClasses} />
      ) : isCurrent && isActionRequired ? (
        <AlertCircle className={iconClasses} />
      ) : (
        step
      )}
    </div>
  );
}

interface BatchProgressCardProps {
  batch: RegistrationBatchJob;
  onRefresh?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export function BatchProgressCard({
  batch,
  onRefresh,
  showActions = true,
  compact = false,
}: BatchProgressCardProps) {
  const navigate = useNavigate();
  const startMutation = useStartRegistrationBatch();
  const cancelMutation = useCancelRegistrationBatch();
  const [isRestaurantListExpanded, setIsRestaurantListExpanded] = useState(false);

  const progress = batch.total_restaurants > 0
    ? Math.round(
        ((batch.completed_restaurants + batch.failed_restaurants) / batch.total_restaurants) * 100
      )
    : 0;

  const currentStepDef = REGISTRATION_STEPS[batch.current_step - 1];
  const isActionRequired = currentStepDef?.step_type === 'action_required';

  if (compact) {
    return (
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => navigate(`/registration-batches/${batch.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium truncate">{batch.name}</p>
                <StatusBadge status={batch.status} size="sm" />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{batch.completed_restaurants}/{batch.total_restaurants} completed</span>
                <span>Step {batch.current_step}/{batch.total_steps}</span>
              </div>
              {/* Compact restaurant preview */}
              {batch.jobs && batch.jobs.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Store className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">
                    {batch.jobs.slice(0, 2).map(j => j.restaurant?.name || 'Unknown').join(', ')}
                    {batch.jobs.length > 2 && ` +${batch.jobs.length - 2}`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <StepIndicator
                  key={step}
                  step={step}
                  currentStep={batch.current_step}
                  isActionRequired={step === batch.current_step && isActionRequired}
                  size="sm"
                />
              ))}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{batch.name}</CardTitle>
              <StatusBadge status={batch.status} />
            </div>
            <CardDescription>
              {batch.completed_restaurants} completed, {batch.failed_restaurants} failed of {batch.total_restaurants} restaurants
              {batch.started_at && (
                <> &bull; Started {formatDistanceToNow(new Date(batch.started_at))} ago</>
              )}
            </CardDescription>

            {/* Restaurant preview */}
            {batch.jobs && batch.jobs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {batch.jobs.slice(0, isRestaurantListExpanded ? undefined : 4).map((job) => (
                  <a
                    key={job.id}
                    href={`/restaurants/${job.restaurant_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                    title={job.restaurant?.city ? `${job.restaurant.name} - ${job.restaurant.city} (Click to open)` : `${job.restaurant?.name} (Click to open)`}
                  >
                    <Store className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[120px] hover:text-brand-blue">{job.restaurant?.name || 'Unknown'}</span>
                    {job.restaurant?.city && (
                      <span className="text-muted-foreground">({job.restaurant.city})</span>
                    )}
                  </a>
                ))}
                {batch.jobs.length > 4 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRestaurantListExpanded(!isRestaurantListExpanded);
                    }}
                    className="flex items-center text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    {isRestaurantListExpanded ? 'Show less' : `+${batch.jobs.length - 4} more`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step indicators */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <StepIndicator
                key={step}
                step={step}
                currentStep={batch.current_step}
                isActionRequired={step === batch.current_step && isActionRequired}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-sm text-muted-foreground flex items-center flex-wrap gap-1">
            <span>Step {batch.current_step} of {batch.total_steps}: {currentStepDef?.step_name || 'Unknown'}</span>
            {isActionRequired && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Action Required
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      {showActions && (
        <CardFooter className="flex justify-between">
          <div className="flex gap-2">
            {batch.status === 'pending' && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  startMutation.mutate(batch.id);
                }}
                disabled={startMutation.isPending}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
            )}
            {batch.status === 'in_progress' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelMutation.mutate(batch.id);
                }}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/registration-batches/${batch.id}`)}
            >
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export default BatchProgressCard;
