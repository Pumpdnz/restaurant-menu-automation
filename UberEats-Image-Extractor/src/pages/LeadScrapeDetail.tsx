import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft,
  Play,
  X,
  Trash2,
  ExternalLink,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Utensils,
  Target,
  Calendar,
  Hash,
  Globe,
  RefreshCw,
} from 'lucide-react';
import {
  useLeadScrapeJob,
  useStartLeadScrapeJob,
  useCancelLeadScrapeJob,
  useDeleteLeadScrapeJob,
} from '../hooks/useLeadScrape';
import { ScrapeJobStepList } from '../components/leads/ScrapeJobStepList';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';

// Status badge colors
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

// Status icons
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'in_progress':
    case 'pending':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4" />;
    case 'cancelled':
      return <X className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

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

// Calculate aggregate stats from step data (job-level fields are not updated by backend)
function calculateJobStats(job: any): { leads_extracted: number; leads_passed: number; leads_failed: number } {
  const steps = job.steps || [];

  // leads_extracted = Step 1's leads_processed (initial extraction count)
  const step1 = steps.find((s: any) => s.step_number === 1);
  const leads_extracted = step1?.leads_processed || 0;

  // leads_passed = Step 1's leads_passed (leads that passed initial quality checks)
  // This represents leads that successfully made it past extraction
  const leads_passed = step1?.leads_passed || 0;

  // leads_failed = Sum of leads_failed across all steps
  const leads_failed = steps.reduce((sum: number, s: any) => sum + (s.leads_failed || 0), 0);

  return { leads_extracted, leads_passed, leads_failed };
}

// Calculate progress percentage from step data
function calculateProgress(job: any): number {
  if (!job.steps || job.steps.length === 0) return 0;
  if (job.total_steps === 0) return 0;

  // Use step completion as the primary progress indicator
  const completedSteps = job.steps.filter((s: any) => s.status === 'completed').length;
  return Math.round((completedSteps / job.total_steps) * 100);
}

// Progress bar component
function AnimatedProgressBar({ value }: { value: number }) {
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-blue-light-1 via-brand-blue to-brand-coral transition-all duration-500 ease-out relative overflow-hidden"
        style={{ width: `${Math.min(value, 100)}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

// Loading skeleton
function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>

      {/* Steps skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeadScrapeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch job data
  const { data, isLoading, error, refetch } = useLeadScrapeJob(id || '');
  const job = data?.job;

  // Mutations
  const startMutation = useStartLeadScrapeJob();
  const cancelMutation = useCancelLeadScrapeJob();
  const deleteMutation = useDeleteLeadScrapeJob();

  const isActionLoading = startMutation.isPending || cancelMutation.isPending || deleteMutation.isPending;

  // Action handlers
  const handleStart = async () => {
    if (!id) return;
    await startMutation.mutateAsync(id);
    refetch();
  };

  const handleCancel = async () => {
    if (!id) return;
    await cancelMutation.mutateAsync(id);
    refetch();
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    navigate('/leads');
  };

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Error state
  if (error || !job) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load job details</h3>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'The job could not be found or you do not have permission to view it.'}
          </p>
          <Button onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lead Scrapes
          </Button>
        </div>
      </div>
    );
  }

  const stats = calculateJobStats(job);
  const progress = calculateProgress(job);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/leads')}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{job.name}</h1>
              <Badge className={statusColors[job.status]} variant="outline">
                {getStatusIcon(job.status)}
                <span className="ml-1">{job.status.replace('_', ' ')}</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDistanceToNow(new Date(job.created_at))} ago
              {job.started_at && ` • Started ${formatDistanceToNow(new Date(job.started_at))} ago`}
              {job.completed_at && ` • Completed ${formatDistanceToNow(new Date(job.completed_at))} ago`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isActionLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>

          {job.status === 'draft' && (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={isActionLoading}
              className="bg-gradient-to-r from-brand-blue to-brand-green"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Start Scrape
            </Button>
          )}

          {(job.status === 'pending' || job.status === 'in_progress') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isActionLoading}>
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-1" />
                  )}
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this scrape job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop the extraction process. Any leads already extracted will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, continue</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>Yes, cancel job</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {['completed', 'cancelled', 'failed', 'draft'].includes(job.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isActionLoading}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this scrape job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All associated leads ({stats.leads_extracted}) will also be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {job.initial_url ? (
              <a
                href={job.initial_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                {getPlatformLabel(job.platform)}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <p className="text-lg font-semibold">{getPlatformLabel(job.platform)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{job.city}</p>
            <p className="text-xs text-muted-foreground">{job.country?.toUpperCase()} • {job.region_code?.toUpperCase()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Utensils className="h-3 w-3" />
              Cuisine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{job.cuisine || 'All'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Leads Target
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{job.leads_limit}</p>
            <p className="text-xs text-muted-foreground">Page offset: {job.page_offset || 1}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Extraction Progress</CardTitle>
          <CardDescription>
            {job.status === 'in_progress' && 'Extraction is currently running...'}
            {job.status === 'completed' && 'Extraction completed successfully'}
            {job.status === 'failed' && 'Extraction failed - check steps for details'}
            {job.status === 'cancelled' && 'Extraction was cancelled'}
            {job.status === 'draft' && 'Extraction has not started yet'}
            {job.status === 'pending' && 'Extraction is queued to start'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {stats.leads_passed} of {stats.leads_extracted > 0 ? stats.leads_extracted : job.leads_limit} leads passed
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <AnimatedProgressBar value={progress} />
          </div>

          {/* Lead stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.leads_extracted}</p>
              <p className="text-xs text-muted-foreground">Extracted</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.leads_passed}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.leads_failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Extraction Steps</CardTitle>
          <CardDescription>
            Step {job.current_step || 0} of {job.total_steps || 5}
            {job.steps && ` • ${job.steps.filter((s: any) => s.status === 'completed').length} completed`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {job.steps && job.steps.length > 0 ? (
            <ScrapeJobStepList
              jobId={job.id}
              steps={job.steps}
              currentStep={job.current_step}
              isExpanded={true}
              onRefresh={() => refetch()}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Steps will appear once the job is started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Section (if exists) */}
      {job.metadata && Object.keys(job.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(job.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(job.created_at), 'PPpp')}</span>
            </div>
            {job.started_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started</span>
                <span>{format(new Date(job.started_at), 'PPpp')}</span>
              </div>
            )}
            {job.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{format(new Date(job.completed_at), 'PPpp')}</span>
              </div>
            )}
            {job.cancelled_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cancelled</span>
                <span>{format(new Date(job.cancelled_at), 'PPpp')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{format(new Date(job.updated_at), 'PPpp')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
