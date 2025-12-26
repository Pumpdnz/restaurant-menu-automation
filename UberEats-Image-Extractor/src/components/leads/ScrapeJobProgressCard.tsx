import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  X,
  ExternalLink,
  Eye,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrapeJobStepList } from './ScrapeJobStepList';
import {
  LeadScrapeJob,
  useStartLeadScrapeJob,
  useCancelLeadScrapeJob,
  useDeleteLeadScrapeJob,
} from '../../hooks/useLeadScrape';

interface ScrapeJobProgressCardProps {
  job: LeadScrapeJob;
  onRefresh?: () => void;
  compact?: boolean;
}

// Status badge colors
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
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
function calculateJobStats(job: LeadScrapeJob): { leads_extracted: number; leads_passed: number; leads_failed: number } {
  const steps = job.steps || [];

  // leads_extracted = Step 1's leads_processed (initial extraction count)
  const step1 = steps.find((s: any) => s.step_number === 1);
  const leads_extracted = step1?.leads_processed || 0;

  // leads_passed = Step 1's leads_passed (leads that passed initial quality checks)
  const leads_passed = step1?.leads_passed || 0;

  // leads_failed = Sum of leads_failed across all steps
  const leads_failed = steps.reduce((sum: number, s: any) => sum + (s.leads_failed || 0), 0);

  return { leads_extracted, leads_passed, leads_failed };
}

// Calculate progress percentage from step data
function calculateProgress(job: LeadScrapeJob): number {
  if (!job.steps || job.steps.length === 0) return 0;
  if (job.total_steps === 0) return 0;

  // Use step completion as the primary progress indicator
  const completedSteps = job.steps.filter((s: any) => s.status === 'completed').length;
  return Math.round((completedSteps / job.total_steps) * 100);
}

// Progress bar component
function AnimatedProgressBar({ value }: { value: number }) {
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-blue-light-1 via-brand-blue to-brand-coral transition-all duration-500 ease-out relative overflow-hidden"
        style={{ width: `${Math.min(value, 100)}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

export function ScrapeJobProgressCard({
  job,
  onRefresh,
  compact = false,
}: ScrapeJobProgressCardProps) {
  const navigate = useNavigate();
  const [isStepsExpanded, setIsStepsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mutations
  const startMutation = useStartLeadScrapeJob();
  const cancelMutation = useCancelLeadScrapeJob();
  const deleteMutation = useDeleteLeadScrapeJob();

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
    } finally {
      // Small delay to show feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const stats = calculateJobStats(job);
  const progress = calculateProgress(job);

  // Get time ago text
  const getTimeAgoText = () => {
    if (job.status === 'completed' && job.completed_at) {
      return `Completed ${formatDistanceToNow(new Date(job.completed_at))} ago`;
    }
    if (job.status === 'cancelled' && job.cancelled_at) {
      return `Cancelled ${formatDistanceToNow(new Date(job.cancelled_at))} ago`;
    }
    if (job.started_at) {
      return `Started ${formatDistanceToNow(new Date(job.started_at))} ago`;
    }
    return `Created ${formatDistanceToNow(new Date(job.created_at))} ago`;
  };

  // Action handlers
  const handleStart = async () => {
    await startMutation.mutateAsync(job.id);
    if (onRefresh) onRefresh();
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this job?')) {
      await cancelMutation.mutateAsync(job.id);
      if (onRefresh) onRefresh();
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this job? All associated leads will also be deleted.')) {
      await deleteMutation.mutateAsync(job.id);
      if (onRefresh) onRefresh();
    }
  };

  const handleViewDetails = () => {
    navigate(`/leads/${job.id}`);
  };

  const isLoading = startMutation.isPending || cancelMutation.isPending || deleteMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/leads/${job.id}`}
                className="hover:text-brand-blue hover:underline truncate"
              >
                {job.name}
              </Link>
              <Badge className={statusColors[job.status]} variant="outline">
                {job.status.replace('_', ' ')}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {getTimeAgoText()} {job.current_step > 0 && `• Step ${job.current_step} of ${job.total_steps || 4}`}
            </CardDescription>
            {/* Platform Link */}
            <div className="text-sm text-muted-foreground mt-1">
              Platform:{' '}
              {job.initial_url ? (
                <a
                  href={job.initial_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {getPlatformLabel(job.platform)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                getPlatformLabel(job.platform)
              )}
            </div>
            {/* Job details */}
            <div className="text-sm text-muted-foreground">
              City: {job.city} | Cuisine: {job.cuisine} | Leads Limit: {job.leads_limit}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {stats.leads_passed} of {stats.leads_extracted > 0 ? stats.leads_extracted : job.leads_limit} leads passed
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <AnimatedProgressBar value={progress} />
        </div>

        {/* Step List */}
        {!compact && job.steps && job.steps.length > 0 && (
          <ScrapeJobStepList
            jobId={job.id}
            steps={job.steps}
            currentStep={job.current_step}
            isExpanded={isStepsExpanded}
            onToggleExpand={() => setIsStepsExpanded(!isStepsExpanded)}
            onRefresh={onRefresh}
          />
        )}

        {/* Step overview (compact or no steps data) */}
        {(compact || !job.steps || job.steps.length === 0) && job.total_steps > 0 && (
          <div className="text-sm text-muted-foreground">
            Step {job.current_step} of {job.total_steps}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={handleViewDetails}>
          <Eye className="h-4 w-4 mr-1" />
          View Details
        </Button>

        {job.status === 'draft' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStart}
            disabled={isLoading}
          >
            {startMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Start
          </Button>
        )}

        {(job.status === 'pending' || job.status === 'in_progress') && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-1" />
            )}
            Cancel
          </Button>
        )}

        {['completed', 'cancelled', 'failed', 'draft'].includes(job.status) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default ScrapeJobProgressCard;
