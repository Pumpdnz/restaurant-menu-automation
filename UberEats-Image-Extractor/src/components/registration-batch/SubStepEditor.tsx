/**
 * SubStepEditor Component
 * Allows manual editing of Step 6 sub-step statuses via context menu
 */

import React from 'react';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  RotateCcw,
  Loader2,
  AlertCircle,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useUpdateSubStepStatus,
  useResetSubStep,
  useSubStepValidation,
} from '../../hooks/useRegistrationBatch';

interface SubStepEditorProps {
  jobId: string;
  subStepKey: string;
  label: string;
  status: string;
  disabled?: boolean;
  onStatusChange?: () => void;
}

export function SubStepEditor({
  jobId,
  subStepKey,
  label,
  status,
  disabled = false,
  onStatusChange,
}: SubStepEditorProps) {
  const updateStatus = useUpdateSubStepStatus();
  const resetSubStep = useResetSubStep();
  const validation = useSubStepValidation(jobId, subStepKey);

  const handleMarkAs = async (newStatus: 'completed' | 'failed' | 'skipped') => {
    try {
      await updateStatus.mutateAsync({
        jobId,
        subStepKey,
        status: newStatus,
      });
      onStatusChange?.();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleReset = async (cascade: boolean) => {
    try {
      await resetSubStep.mutateAsync({
        jobId,
        subStepKey,
        cascade,
      });
      onStatusChange?.();
    } catch (error) {
      // Error handled by hook
    }
  };

  const isLoading = updateStatus.isPending || resetSubStep.isPending;

  // Determine badge styling based on status
  const getBadgeVariant = () => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
      case 'retrying':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'skipped':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getBadgeClassName = () => {
    return cn(
      'cursor-pointer transition-opacity hover:opacity-80',
      status === 'completed' && 'bg-green-500 hover:bg-green-600',
      (status === 'in_progress' || status === 'retrying') && 'bg-blue-500',
      status === 'skipped' && 'text-muted-foreground'
    );
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-3 w-3 mr-1 animate-spin" />;
    }
    switch (status) {
      case 'in_progress':
      case 'retrying':
        return <Loader2 className="h-3 w-3 mr-1 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 mr-1" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  if (disabled) {
    // Render non-interactive badge when editing is disabled
    return (
      <Badge
        variant={getBadgeVariant()}
        className={cn(
          status === 'completed' && 'bg-green-500',
          (status === 'in_progress' || status === 'retrying') && 'bg-blue-500',
          status === 'skipped' && 'text-muted-foreground'
        )}
      >
        {getStatusIcon()}
        {label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant={getBadgeVariant()}
          className={getBadgeClassName()}
        >
          {getStatusIcon()}
          {label}
          <MoreHorizontal className="h-3 w-3 ml-1 opacity-50" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {subStepKey}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Show blocking dependencies warning */}
        {validation.data?.blocking_dependencies?.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs text-amber-600 bg-amber-50 rounded mx-1 mb-2">
              <span className="font-medium">Blocked by: </span>
              {validation.data.blocking_dependencies.map((d: any) => d.key).join(', ')}
            </div>
          </>
        )}

        {/* Mark as Completed */}
        <DropdownMenuItem
          onClick={() => handleMarkAs('completed')}
          disabled={
            status === 'completed' ||
            isLoading ||
            !validation.data?.allowed_transitions?.includes('completed')
          }
          className={cn(
            'text-green-600',
            !validation.data?.allowed_transitions?.includes('completed') && 'opacity-50'
          )}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Mark as Completed
        </DropdownMenuItem>

        {/* Mark as Failed */}
        <DropdownMenuItem
          onClick={() => handleMarkAs('failed')}
          disabled={status === 'failed' || isLoading}
          className="text-red-600"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Mark as Failed
        </DropdownMenuItem>

        {/* Mark as Skipped */}
        <DropdownMenuItem
          onClick={() => handleMarkAs('skipped')}
          disabled={
            status === 'skipped' ||
            isLoading ||
            !validation.data?.allowed_transitions?.includes('skipped')
          }
          className={cn(
            'text-muted-foreground',
            !validation.data?.allowed_transitions?.includes('skipped') && 'opacity-50'
          )}
        >
          <SkipForward className="h-4 w-4 mr-2" />
          Mark as Skipped
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Show cascade warning if there are dependents */}
        {validation.data?.cascade_warning && (
          <div className="px-2 py-1.5 text-xs text-orange-600 bg-orange-50 rounded mx-1 mb-2">
            {validation.data.cascade_warning}
          </div>
        )}

        {/* Reset to Pending */}
        <DropdownMenuItem
          onClick={() => handleReset(false)}
          disabled={status === 'pending' || isLoading}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Pending
        </DropdownMenuItem>

        {/* Reset with Cascade */}
        <DropdownMenuItem
          onClick={() => handleReset(true)}
          disabled={status === 'pending' || isLoading}
          className="text-orange-600"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset (+ Dependents)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
