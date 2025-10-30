import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { VideoStatus } from '@/hooks/useSocialMedia';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface VideoJobStatusProps {
  status: VideoStatus;
  progress: number;
  errorMessage?: string;
  showProgress?: boolean;
}

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const statusConfig: Record<VideoStatus, StatusConfig> = {
  queued: {
    label: 'Queued',
    variant: 'secondary',
    icon: Clock,
    color: 'text-blue-600',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default',
    icon: Loader2,
    color: 'text-blue-600',
  },
  completed: {
    label: 'Completed',
    variant: 'default',
    icon: CheckCircle2,
    color: 'text-green-600',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: XCircle,
    color: 'text-red-600',
  },
};

export function VideoJobStatus({
  status,
  progress,
  errorMessage,
  showProgress = true,
}: VideoJobStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="space-y-3">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>

      {/* Progress bar */}
      {showProgress && (status === 'in_progress' || status === 'queued') && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {status === 'queued' ? 'Waiting to start...' : 'Generating video...'}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Error message */}
      {status === 'failed' && errorMessage && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <p className="font-medium mb-1">Error:</p>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
