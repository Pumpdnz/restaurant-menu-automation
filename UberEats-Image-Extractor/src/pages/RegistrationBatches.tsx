import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  Layers,
  RefreshCw,
  Play,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';

import {
  useRegistrationBatches,
  useStartRegistrationBatch,
  useCancelRegistrationBatch,
  RegistrationBatchJob,
  REGISTRATION_STEPS,
} from '../hooks/useRegistrationBatch';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { cn } from '../lib/utils';

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    pending: { variant: 'secondary' },
    in_progress: { variant: 'default', className: 'bg-blue-500' },
    completed: { variant: 'default', className: 'bg-green-500' },
    failed: { variant: 'destructive' },
    cancelled: { variant: 'outline' },
  };

  const config = variants[status] || { variant: 'secondary' };

  return (
    <Badge variant={config.variant} className={config.className}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

// Step indicator component
function StepIndicator({
  step,
  currentStep,
  isActionRequired,
}: {
  step: number;
  currentStep: number;
  isActionRequired: boolean;
}) {
  const isCompleted = step < currentStep;
  const isCurrent = step === currentStep;

  return (
    <div
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
        isCompleted && 'bg-green-500 text-white',
        isCurrent && isActionRequired && 'bg-orange-500 text-white',
        isCurrent && !isActionRequired && 'bg-blue-500 text-white',
        !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
      )}
      title={REGISTRATION_STEPS[step - 1]?.step_name}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : isCurrent && isActionRequired ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        step
      )}
    </div>
  );
}

// Batch progress card component
function BatchProgressCard({
  batch,
  onRefresh,
}: {
  batch: RegistrationBatchJob;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const startMutation = useStartRegistrationBatch();
  const cancelMutation = useCancelRegistrationBatch();

  const progress = batch.total_restaurants > 0
    ? Math.round(
        ((batch.completed_restaurants + batch.failed_restaurants) / batch.total_restaurants) * 100
      )
    : 0;

  const currentStepDef = REGISTRATION_STEPS[batch.current_step - 1];
  const isActionRequired = currentStepDef?.step_type === 'action_required';

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
          <p className="text-sm text-muted-foreground">
            Step {batch.current_step} of {batch.total_steps}: {currentStepDef?.step_name || 'Unknown'}
            {isActionRequired && (
              <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                Action Required
              </Badge>
            )}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {batch.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => startMutation.mutate(batch.id)}
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
              onClick={() => cancelMutation.mutate(batch.id)}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
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
    </Card>
  );
}

// Loading skeleton
function BatchCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-6 w-6 rounded-full" />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-48" />
      </CardContent>
      <CardFooter className="flex justify-between">
        <Skeleton className="h-8 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}

export default function RegistrationBatches() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'active';

  const [searchQuery, setSearchQuery] = useState('');

  // Build filters based on active tab
  const filters = useMemo(() => {
    const statusMap: Record<string, string[]> = {
      active: ['pending', 'in_progress'],
      completed: ['completed'],
      failed: ['failed', 'cancelled'],
    };

    return {
      status: statusMap[activeTab] || statusMap.active,
      search: searchQuery || undefined,
    };
  }, [activeTab, searchQuery]);

  const { data, isLoading, refetch } = useRegistrationBatches(filters);
  const batches = data?.batch_jobs || [];

  // Tab change handler
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col -mt-6 -mb-6">
      {/* Sticky Header + Tabs + Search */}
      <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Registration Batches</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Orchestrate restaurant registration from leads to Pumpd accounts
            </p>
          </div>
        </div>

        {/* Tabs + Search Row */}
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="active">
              Active
              {activeTab !== 'active' && data?.batch_jobs && (
                <Badge variant="secondary" className="ml-2">
                  {batches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="pt-6 space-y-4">
        <TabsContent value={activeTab} className="space-y-4 mt-0">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <BatchCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && batches.length === 0 && (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No batches found</h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === 'active'
                  ? 'Convert leads to restaurants to create a registration batch'
                  : activeTab === 'completed'
                  ? 'No completed batches yet'
                  : 'No failed batches'}
              </p>
              {activeTab === 'active' && (
                <Button onClick={() => navigate('/leads?tab=pending')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Go to Pending Leads
                </Button>
              )}
            </div>
          )}

          {/* Batch Cards */}
          {!isLoading && batches.length > 0 && (
            <div className="space-y-4">
              {batches.map((batch) => (
                <BatchProgressCard
                  key={batch.id}
                  batch={batch}
                  onRefresh={refetch}
                />
              ))}
            </div>
          )}

          {/* Results Count */}
          {!isLoading && batches.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
            </div>
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}
