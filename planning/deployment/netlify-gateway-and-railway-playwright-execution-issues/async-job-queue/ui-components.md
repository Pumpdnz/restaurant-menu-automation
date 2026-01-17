# UI Components: Job Polling & Status Display

**Last Updated**: 2025-12-09
**Status**: Planned
**Framework**: React + TanStack Query

## Overview

This document specifies the frontend components for:
1. `useJobPolling` hook - Core polling logic
2. `useCreateJob` hook - Job creation mutation
3. `JobStatusCard` - Visual job status display
4. `JobProgressBar` - Progress indicator
5. API service methods for jobs

---

## Hooks

### useJobPolling

A custom hook for polling job status with smart intervals and automatic completion handling.

**File Location**: `UberEats-Image-Extractor/src/hooks/useJobPolling.js`

```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJobStatus, getJob } from '../services/api';

/**
 * Polling intervals based on job age
 */
const POLLING_INTERVALS = {
  FAST: 2000,      // First 30 seconds
  MEDIUM: 5000,    // 30s - 2 minutes
  SLOW: 10000,     // After 2 minutes
};

/**
 * Terminal job statuses that stop polling
 */
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'timed_out'];

/**
 * Hook for polling job status with smart intervals
 *
 * @param {string} jobId - The job ID to poll
 * @param {Object} options - Configuration options
 * @param {Function} options.onProgress - Callback when progress updates
 * @param {Function} options.onComplete - Callback when job completes
 * @param {Function} options.onError - Callback when job fails
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 * @param {number} options.maxPollTime - Maximum time to poll in ms (default: 10 minutes)
 *
 * @returns {Object} Job status, controls, and metadata
 */
export function useJobPolling(jobId, options = {}) {
  const {
    onProgress,
    onComplete,
    onError,
    enabled = true,
    maxPollTime = 10 * 60 * 1000, // 10 minutes
  } = options;

  const queryClient = useQueryClient();
  const startTimeRef = useRef(Date.now());
  const [isPolling, setIsPolling] = useState(enabled && !!jobId);
  const [pollCount, setPollCount] = useState(0);

  // Calculate polling interval based on elapsed time
  const getPollingInterval = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;

    if (elapsed < 30000) return POLLING_INTERVALS.FAST;
    if (elapsed < 120000) return POLLING_INTERVALS.MEDIUM;
    return POLLING_INTERVALS.SLOW;
  }, []);

  // Main status query
  const {
    data: statusData,
    error: statusError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId),
    enabled: isPolling && !!jobId,
    refetchInterval: (data) => {
      // Stop polling if terminal status
      if (data && TERMINAL_STATUSES.includes(data.status)) {
        return false;
      }
      // Stop polling if max time exceeded
      if (Date.now() - startTimeRef.current > maxPollTime) {
        return false;
      }
      return getPollingInterval();
    },
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
    staleTime: 0, // Always consider data stale
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Handle status changes
  useEffect(() => {
    if (!statusData) return;

    setPollCount((prev) => prev + 1);

    // Call progress callback
    if (onProgress && statusData.progress) {
      onProgress(statusData.progress);
    }

    // Handle terminal statuses
    if (TERMINAL_STATUSES.includes(statusData.status)) {
      setIsPolling(false);

      if (statusData.status === 'completed') {
        // Fetch full job details on completion
        getJob(jobId).then((fullJob) => {
          if (onComplete) {
            onComplete(fullJob);
          }
          // Update cache with full job data
          queryClient.setQueryData(['job', jobId], fullJob);
        });
      } else if (statusData.status === 'failed' && onError) {
        onError(statusData.error);
      }
    }
  }, [statusData, jobId, onProgress, onComplete, onError, queryClient]);

  // Handle query errors
  useEffect(() => {
    if (statusError && onError) {
      onError({
        code: 'POLLING_ERROR',
        message: statusError.message,
      });
    }
  }, [statusError, onError]);

  // Manual controls
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const resumePolling = useCallback(() => {
    if (jobId && !TERMINAL_STATUSES.includes(statusData?.status)) {
      startTimeRef.current = Date.now();
      setIsPolling(true);
      refetch();
    }
  }, [jobId, statusData?.status, refetch]);

  const reset = useCallback(() => {
    startTimeRef.current = Date.now();
    setPollCount(0);
    setIsPolling(enabled && !!jobId);
  }, [enabled, jobId]);

  // Calculate derived state
  const isComplete = statusData?.status === 'completed';
  const isFailed = statusData?.status === 'failed';
  const isCancelled = statusData?.status === 'cancelled';
  const isTimedOut = statusData?.status === 'timed_out';
  const isTerminal = TERMINAL_STATUSES.includes(statusData?.status);
  const isInProgress = statusData?.status === 'in_progress';
  const isPending = statusData?.status === 'pending' || statusData?.status === 'queued';

  return {
    // Status data
    status: statusData?.status,
    progress: statusData?.progress || { percent: 0 },
    error: statusData?.error || statusError,
    updatedAt: statusData?.updatedAt,

    // State flags
    isLoading,
    isFetching,
    isPolling,
    isComplete,
    isFailed,
    isCancelled,
    isTimedOut,
    isTerminal,
    isInProgress,
    isPending,

    // Metadata
    pollCount,
    elapsedTime: Date.now() - startTimeRef.current,
    currentInterval: getPollingInterval(),

    // Controls
    stopPolling,
    resumePolling,
    reset,
    refetch,
  };
}

export default useJobPolling;
```

---

### useCreateJob

Hook for creating jobs with automatic polling setup.

**File Location**: `UberEats-Image-Extractor/src/hooks/useCreateJob.js`

```javascript
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createJob } from '../services/api';
import { useJobPolling } from './useJobPolling';

/**
 * Hook for creating and tracking jobs
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onJobCreated - Callback when job is created
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onComplete - Callback when job completes
 * @param {Function} options.onError - Callback when job fails
 *
 * @returns {Object} Mutation and polling state
 */
export function useCreateJob(options = {}) {
  const {
    onJobCreated,
    onProgress,
    onComplete,
    onError,
  } = options;

  const queryClient = useQueryClient();
  const [activeJobId, setActiveJobId] = useState(null);

  // Mutation for creating jobs
  const createMutation = useMutation({
    mutationFn: ({ jobType, payload, priority, metadata, restaurantId }) =>
      createJob(jobType, payload, { priority, metadata, restaurantId }),
    onSuccess: (data) => {
      setActiveJobId(data.job.jobId);

      // Invalidate job lists
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      if (onJobCreated) {
        onJobCreated(data.job);
      }
    },
    onError: (error) => {
      if (onError) {
        onError({
          code: 'CREATE_FAILED',
          message: error.message,
        });
      }
    },
  });

  // Polling for active job
  const polling = useJobPolling(activeJobId, {
    enabled: !!activeJobId,
    onProgress,
    onComplete: (job) => {
      // Clear active job on completion
      setActiveJobId(null);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      if (onComplete) {
        onComplete(job);
      }
    },
    onError: (error) => {
      setActiveJobId(null);

      if (onError) {
        onError(error);
      }
    },
  });

  // Combined submit function
  const submit = useCallback((jobType, payload, jobOptions = {}) => {
    return createMutation.mutateAsync({
      jobType,
      payload,
      ...jobOptions,
    });
  }, [createMutation]);

  // Cancel active job
  const cancel = useCallback(async () => {
    if (activeJobId) {
      try {
        await cancelJob(activeJobId);
        setActiveJobId(null);
        polling.stopPolling();
      } catch (error) {
        console.error('Failed to cancel job:', error);
      }
    }
  }, [activeJobId, polling]);

  // Reset state
  const reset = useCallback(() => {
    setActiveJobId(null);
    createMutation.reset();
    polling.reset();
  }, [createMutation, polling]);

  return {
    // Mutation state
    submit,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    // Active job state
    activeJobId,
    status: polling.status,
    progress: polling.progress,
    isPolling: polling.isPolling,
    isComplete: polling.isComplete,
    isFailed: polling.isFailed,
    error: polling.error,

    // Combined state
    isLoading: createMutation.isPending || polling.isInProgress,
    isIdle: !createMutation.isPending && !activeJobId,

    // Controls
    cancel,
    reset,
    stopPolling: polling.stopPolling,
    resumePolling: polling.resumePolling,
  };
}

export default useCreateJob;
```

---

## Components

### JobStatusCard

A card component displaying job status with progress.

**File Location**: `UberEats-Image-Extractor/src/components/JobStatusCard.jsx`

```jsx
import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Pending',
  },
  queued: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Queued',
  },
  in_progress: {
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'In Progress',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Failed',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    label: 'Cancelled',
  },
  timed_out: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Timed Out',
  },
};

/**
 * Job status card with progress display
 *
 * @param {Object} props
 * @param {string} props.jobId - Job ID
 * @param {string} props.jobType - Type of job
 * @param {string} props.status - Current status
 * @param {Object} props.progress - Progress object { percent, message, currentStep, totalSteps }
 * @param {Object} props.error - Error object if failed
 * @param {Function} props.onCancel - Cancel callback
 * @param {Function} props.onRetry - Retry callback
 * @param {string} props.className - Additional classes
 */
export function JobStatusCard({
  jobId,
  jobType,
  status = 'pending',
  progress = {},
  error,
  onCancel,
  onRetry,
  className,
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  const formatJobType = (type) => {
    return type
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'h-5 w-5',
              config.color,
              config.animate && 'animate-spin'
            )}
          />
          <span className={cn('font-medium', config.color)}>
            {config.label}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-mono">{jobId}</span>
      </div>

      {/* Job Type */}
      <div className="text-sm text-gray-700 mb-3">
        {formatJobType(jobType)}
      </div>

      {/* Progress Bar */}
      {status === 'in_progress' && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{progress.message || 'Processing...'}</span>
            <span>{progress.percent || 0}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.percent || 0}%` }}
            />
          </div>
          {progress.currentStep && progress.totalSteps && (
            <div className="text-xs text-gray-500 mt-1">
              Step {progress.currentStep} of {progress.totalSteps}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {status === 'failed' && error && (
        <div className="text-sm text-red-600 bg-red-100 rounded p-2 mb-3">
          <span className="font-medium">{error.code}:</span> {error.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {['pending', 'queued'].includes(status) && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          >
            Cancel
          </button>
        )}
        {status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default JobStatusCard;
```

---

### JobProgressBar

A minimal progress bar component.

**File Location**: `UberEats-Image-Extractor/src/components/JobProgressBar.jsx`

```jsx
import React from 'react';
import { cn } from '../lib/utils';

/**
 * Minimal progress bar for job status
 *
 * @param {Object} props
 * @param {number} props.percent - Progress percentage (0-100)
 * @param {string} props.message - Progress message
 * @param {boolean} props.indeterminate - Show indeterminate animation
 * @param {string} props.className - Additional classes
 */
export function JobProgressBar({
  percent = 0,
  message,
  indeterminate = false,
  className,
}) {
  return (
    <div className={cn('w-full', className)}>
      {message && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{message}</span>
          {!indeterminate && <span>{percent}%</span>}
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        {indeterminate ? (
          <div className="h-full bg-blue-500 rounded-full animate-indeterminate" />
        ) : (
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        )}
      </div>
    </div>
  );
}

// Add to your global CSS or Tailwind config:
// @keyframes indeterminate {
//   0% { transform: translateX(-100%); width: 50%; }
//   100% { transform: translateX(200%); width: 50%; }
// }
// .animate-indeterminate {
//   animation: indeterminate 1.5s infinite ease-in-out;
// }

export default JobProgressBar;
```

---

## API Service Methods

Add these methods to the existing API service.

**File Location**: `UberEats-Image-Extractor/src/services/api.js`

```javascript
// Add to existing api.js

/**
 * Create a new job
 * @param {string} jobType - Type of job
 * @param {Object} payload - Job payload
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created job
 */
export async function createJob(jobType, payload, options = {}) {
  const response = await api.post('/jobs', {
    jobType,
    payload,
    priority: options.priority,
    metadata: options.metadata,
    restaurantId: options.restaurantId,
  });
  return response.data;
}

/**
 * Get job details
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job details
 */
export async function getJob(jobId) {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data.job;
}

/**
 * Get job status (lightweight, for polling)
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job status
 */
export async function getJobStatus(jobId) {
  const response = await api.get(`/jobs/${jobId}/status`);
  return response.data;
}

/**
 * Cancel a job
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Cancelled job
 */
export async function cancelJob(jobId) {
  const response = await api.delete(`/jobs/${jobId}`);
  return response.data;
}

/**
 * List jobs with filtering
 * @param {Object} filters - Filter options
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} Jobs list with pagination
 */
export async function listJobs(filters = {}, pagination = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    params.append('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status);
  }
  if (filters.jobType) params.append('jobType', filters.jobType);
  if (filters.restaurantId) params.append('restaurantId', filters.restaurantId);
  if (filters.since) params.append('since', filters.since);
  if (pagination.limit) params.append('limit', pagination.limit);
  if (pagination.offset) params.append('offset', pagination.offset);
  if (pagination.orderBy) params.append('orderBy', pagination.orderBy);
  if (pagination.orderDir) params.append('orderDir', pagination.orderDir);

  const response = await api.get(`/jobs?${params.toString()}`);
  return response.data;
}

/**
 * Get available job types
 * @returns {Promise<Array>} Job types with metadata
 */
export async function getJobTypes() {
  const response = await api.get('/jobs/types');
  return response.data.types;
}
```

---

## Usage Examples

### Basic Job Creation and Polling

```jsx
import React from 'react';
import { useCreateJob } from '../hooks/useCreateJob';
import { JobStatusCard } from '../components/JobStatusCard';
import { toast } from 'sonner';

function AddItemTagsForm({ restaurantId, itemTags }) {
  const {
    submit,
    isCreating,
    activeJobId,
    status,
    progress,
    isComplete,
    isFailed,
    error,
    cancel,
    reset,
  } = useCreateJob({
    onJobCreated: (job) => {
      toast.info(`Job started: ${job.jobId}`);
    },
    onComplete: (job) => {
      toast.success('Item tags added successfully!');
      // Navigate or refresh data
    },
    onError: (error) => {
      toast.error(`Job failed: ${error.message}`);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    await submit('add-item-tags', {
      email: formData.email,
      password: formData.password,
      restaurantName: formData.restaurantName,
      itemTags,
    }, {
      restaurantId,
      metadata: { source: 'menu-builder' },
    });
  };

  if (activeJobId) {
    return (
      <div className="space-y-4">
        <JobStatusCard
          jobId={activeJobId}
          jobType="add-item-tags"
          status={status}
          progress={progress}
          error={error}
          onCancel={status === 'pending' ? cancel : undefined}
        />

        {isComplete && (
          <button onClick={reset} className="btn btn-primary">
            Add More Tags
          </button>
        )}

        {isFailed && (
          <button onClick={reset} className="btn btn-secondary">
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={isCreating}>
        {isCreating ? 'Creating Job...' : 'Add Item Tags'}
      </button>
    </form>
  );
}
```

### Job List with Polling

```jsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listJobs } from '../services/api';
import { JobStatusCard } from '../components/JobStatusCard';

function JobsList({ restaurantId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', { restaurantId }],
    queryFn: () => listJobs({ restaurantId }, { limit: 10, orderDir: 'desc' }),
    refetchInterval: (data) => {
      // Refetch if there are active jobs
      const hasActiveJobs = data?.jobs?.some(
        (job) => ['pending', 'queued', 'in_progress'].includes(job.status)
      );
      return hasActiveJobs ? 5000 : false;
    },
  });

  if (isLoading) return <div>Loading jobs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="space-y-4">
      <h2>Recent Jobs</h2>
      {data.jobs.map((job) => (
        <JobStatusCard
          key={job.jobId}
          jobId={job.jobId}
          jobType={job.jobType}
          status={job.status}
          progress={job.progress}
          error={job.error}
        />
      ))}
    </div>
  );
}
```

---

## CSS Additions

Add to your global CSS or Tailwind config:

```css
/* Indeterminate progress bar animation */
@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
    width: 50%;
  }
  100% {
    transform: translateX(200%);
    width: 50%;
  }
}

.animate-indeterminate {
  animation: indeterminate 1.5s infinite ease-in-out;
}

/* Pulse animation for pending status */
@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}
```

---

## File Locations Summary

| File | Location |
|------|----------|
| useJobPolling | `src/hooks/useJobPolling.js` |
| useCreateJob | `src/hooks/useCreateJob.js` |
| JobStatusCard | `src/components/JobStatusCard.jsx` |
| JobProgressBar | `src/components/JobProgressBar.jsx` |
| API methods | `src/services/api.js` (add to existing) |
