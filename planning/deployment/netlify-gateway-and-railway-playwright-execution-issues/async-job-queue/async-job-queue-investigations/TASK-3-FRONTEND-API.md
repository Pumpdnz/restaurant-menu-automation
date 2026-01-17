# TASK 3: Frontend API Service Investigation

**Date**: 2025-12-09  
**Status**: Complete  
**Objective**: Understand how frontend makes API calls and design polling mechanism

## Executive Summary

The frontend implements a **hybrid API pattern** combining:
- **Axios** for HTTP requests with automatic authentication and org headers
- **TanStack React Query (v5)** for server state management and automatic refetching
- **Custom hooks** for domain-specific business logic
- **Sonner** toast library for user notifications
- **Manual polling** with `useEffect` and `setInterval` for some components
- **Dynamic refetch intervals** based on data state in advanced use cases

**Key Finding**: The frontend already has sophisticated polling patterns implemented, particularly in `useLeadScrape.ts` hook which uses dynamic refetch intervals (3s vs 10s based on processing state). This can be extracted into a reusable pattern.

---

## 1. Current API Call Architecture

### 1.1 Base API Service (`/src/services/api.js`)

**Structure**: Axios instance with automatic request interceptors

```javascript
// Base API Configuration
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Adds auth token + org ID
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    const orgId = localStorage.getItem('currentOrgId');
    if (orgId) {
      config.headers['X-Organization-ID'] = orgId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);
```

**Key Characteristics**:
- Centralized auth token management from Supabase
- Organization ID passed via headers
- All endpoints use `/api` baseURL
- No global error interceptor (handled at call site)

### 1.2 API Endpoints Organization

The API service exports grouped endpoints:

```javascript
// Restaurant APIs
restaurantAPI = {
  getAll, getById, create, update, getMenus, getPriceHistory
}

// Extraction APIs
extractionAPI = {
  start, getAll, getById, retry, cancel,
  startPremium, getPremiumStatus, getPremiumResults,
  scanCategories, batchExtract, getStatus, getResults
}

// Menu APIs
menuAPI = { getById, activate, compare, comparePost, duplicate, delete, export }

// Menu Item APIs
menuItemAPI = { update, bulkUpdate, addToCategory }

// Analytics, Search, Export APIs
```

**Pattern**: RESTful CRUD operations with status polling endpoints for long-running operations.

---

## 2. Existing Polling Logic

### 2.1 Hook-Based Polling (TanStack React Query)

**Most Advanced Pattern**: `useLeadScrapeJob()` with dynamic refetch intervals

```typescript
export function useLeadScrapeJob(jobId: string, options?: any) {
  return useQuery<{ success: boolean; job: LeadScrapeJob }>({
    queryKey: ['lead-scrape-job', jobId],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: 10000, // Refetch every 10 seconds for active jobs
    ...options,
  });
}
```

**Dynamic Polling**: `useStepLeads()` adjusts polling speed based on data state

```typescript
export function useStepLeads(jobId: string, stepNumber: number, options?: { enabled?: boolean }) {
  return useQuery<{ success: boolean; step: LeadScrapeJobStep; leads: Lead[] }>({
    queryKey: ['step-leads', jobId, stepNumber],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}/steps/${stepNumber}`);
      return response.data;
    },
    enabled: !!jobId && stepNumber > 0 && (options?.enabled !== false),
    // Dynamic refetch interval: 3s when processing, 10s otherwise
    refetchInterval: (query) => {
      const hasProcessingLeads = query.state.data?.leads?.some(
        (l: Lead) => l.step_progression_status === 'processing'
      );
      return hasProcessingLeads ? 3000 : 10000;
    },
  });
}
```

**Benefits**:
- Automatic cache management
- Deduplication of requests
- Efficient re-rendering only when data changes
- Built-in retry logic with exponential backoff

### 2.2 Manual Polling (useEffect Pattern)

**Found in**: `Extractions.jsx`

```javascript
useEffect(() => {
  fetchExtractions();
  // Poll for updates every 5 seconds
  const interval = setInterval(fetchExtractions, 5000);
  return () => clearInterval(interval);
}, []);

const fetchExtractions = async () => {
  try {
    const response = await api.get('/extractions');
    setExtractions(response.data.jobs || []);
    setError(null);
  } catch (err) {
    console.error('Failed to fetch extractions:', err);
    setError('Failed to load extractions');
  } finally {
    setLoading(false);
  }
};
```

**Characteristics**:
- Simple but repetitive
- Fixed interval (5 seconds)
- No deduplication or caching
- Manual cleanup required
- Prone to race conditions if intervals overlap

---

## 3. How Loading State is Managed

### 3.1 Hook-Based State Management

Using TanStack React Query built-in states:

```typescript
const { data, isLoading, isError, error, isFetching } = useLeadScrapeJob(jobId);

// Component usage
if (isLoading) return <LoadingSpinner />;
if (isError) return <ErrorMessage error={error} />;
if (isFetching) return <RefreshingIndicator />; // Subtle update indicator
```

### 3.2 Local State Management (useState)

Used in hooks like `useSocialMedia()`:

```typescript
const [videos, setVideos] = useState<VideoJob[]>([]);
const [loading, setLoading] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);

const fetchVideos = useCallback(async (filters = {}) => {
  setLoading(true);
  try {
    const response = await api.get(`/social-media/videos?${params}`);
    setVideos(response.data.videos || []);
  } catch (error) {
    toast.error('Failed to fetch videos');
    setVideos([]);
  } finally {
    setLoading(false);
  }
}, []);
```

### 3.3 Component-Level Loading UI

**ExtractionProgressCard.jsx** example:

```jsx
const status = extraction?.state || extraction?.status || 'unknown';
const isInProgress = status === 'running' || status === 'processing' || status === 'in_progress';

return (
  <Card>
    <CardHeader>
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
        {getStatusIcon(status)} {/* Spinner if in_progress */}
        <span className="capitalize">{status}</span>
      </div>
    </CardHeader>
    
    {isInProgress && (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          Premium extraction with option sets in progress. This typically takes 2-5 minutes.
        </p>
      </div>
    )}
    
    {/* Progress bar, phase tracking, error message */}
  </Card>
);
```

**Patterns Used**:
- Status color mapping (green=complete, red=failed, blue=processing)
- Spinner animations for in-progress states
- Progress bars for deterministic operations
- Phase tracking with completion indicators
- Error message containers with styling

---

## 4. Error Handling & Display

### 4.1 Toast Notifications (Sonner)

**Used across all hooks**:

```typescript
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
  toast.success('Lead scrape job created', {
    description: data.job.save_as_draft ? 'Saved as draft' : 'Ready to start',
  });
},
onError: (error: any) => {
  toast.error('Failed to create job', {
    description: error.response?.data?.error || error.message,
  });
}
```

### 4.2 Inline Error Display

**ErrorDisplay.jsx** component:

```jsx
function ErrorDisplay({ message }) {
  return (
    <div className="error-display">
      <div className="error-icon">⚠️</div>
      <div className="error-message">{message}</div>
    </div>
  );
}
```

### 4.3 Error Handling in Components

```javascript
const [error, setError] = useState(null);

try {
  const response = await api.get('/extractions');
  setExtractions(response.data.jobs || []);
  setError(null);
} catch (err) {
  console.error('Failed to fetch extractions:', err);
  setError('Failed to load extractions');
}
```

**Key Points**:
- Toast for user-visible notifications
- Component-level error state for UI updates
- Detailed error messages from API
- Console logging for debugging

---

## 5. UI Feedback for Long Operations

### 5.1 Progress Tracking UI

**LoadingOverlay.jsx** provides multi-phase feedback:

```jsx
return (
  <div className="loading-overlay">
    <div className="loading-spinner"></div>
    <h3 className="loading-status">{message}</h3>
    
    {/* Method and strategy badges */}
    <span className="method-badge">Using Extract API</span>
    <span className="strategy-badge">Category-Based Extraction</span>
    
    {/* Progress bar */}
    {status === 'in_progress' && progress > 0 && (
      <div className="progress-bar">
        <div style={{ width: `${progressPercent}%` }}></div>
      </div>
    )}
    
    {/* Description of current operation */}
    <p className="loading-description">{getMethodDescription()}</p>
    
    {/* Warnings if any */}
    {warnings && warnings.map((warning) => <li>{warning}</li>)}
  </div>
);
```

### 5.2 Phase Tracking

**ExtractionProgressCard.jsx**:

```jsx
function ExtractionPhase({ name, isActive, isComplete, detail }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded ${
      isActive ? 'bg-blue-50' : isComplete ? 'bg-green-50' : 'bg-gray-50'
    }`}>
      <div className="flex items-center gap-2">
        {isActive ? (
          <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
        ) : isComplete ? (
          <CheckCircle className="h-3 w-3 text-green-600" />
        ) : (
          <div className="h-3 w-3 rounded-full border-2 border-gray-300" />
        )}
        <span>{name}</span>
      </div>
      {detail && <span className="text-xs text-gray-600">{detail}</span>}
    </div>
  );
}
```

**Phases Tracked**:
- Scanning Categories
- Extracting Items
- Extracting Option Sets
- Validating Images
- Saving to Database

---

## 6. Proposed useJobPolling Hook Design

### 6.1 Hook Specification

Based on the existing patterns and requirements for async job queue:

```typescript
/**
 * useJobPolling - Universal polling hook for async job status tracking
 * 
 * Features:
 * - Smart polling intervals (fast when processing, slow when idle)
 * - Automatic cleanup on unmount
 * - Exponential backoff on errors
 * - Status callbacks for UI updates
 * - Completion detection with custom matchers
 */
interface UseJobPollingOptions {
  // Polling configuration
  initialInterval?: number;      // ms, default: 5000
  maxInterval?: number;          // ms, default: 30000
  backoffMultiplier?: number;    // default: 1.5
  
  // Job detection
  isComplete?: (job: any) => boolean;
  isError?: (job: any) => boolean;
  
  // Dynamic intervals based on job state
  getInterval?: (job: any) => number;
  
  // Callbacks
  onStatusChange?: (job: any) => void;
  onComplete?: (job: any) => void;
  onError?: (error: Error) => void;
  
  // Control
  enabled?: boolean;
  autoStop?: boolean; // default: true
}

interface UseJobPollingResult {
  job: any;
  isLoading: boolean;
  isComplete: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  
  // Manual controls
  refetch: () => Promise<void>;
  stop: () => void;
  resume: () => void;
  cancel: () => void;
}

function useJobPolling(
  jobId: string,
  fetchJob: (jobId: string) => Promise<any>,
  options?: UseJobPollingOptions
): UseJobPollingResult
```

### 6.2 Implementation Strategy

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

export function useJobPolling(
  jobId: string,
  fetchJob: (jobId: string) => Promise<any>,
  options: UseJobPollingOptions = {}
) {
  const {
    initialInterval = 5000,
    maxInterval = 30000,
    backoffMultiplier = 1.5,
    isComplete = (job) => job.status === 'completed',
    isError = (job) => job.status === 'failed',
    getInterval = undefined,
    onStatusChange,
    onComplete,
    onError,
    enabled = true,
    autoStop = true,
  } = options;

  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(initialInterval);
  const consecutiveErrorsRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(enabled);

  // Calculate next polling interval with exponential backoff for errors
  const calculateNextInterval = useCallback((currentJob?: any): number => {
    if (getInterval && currentJob) {
      return getInterval(currentJob);
    }

    if (consecutiveErrorsRef.current > 0) {
      // Exponential backoff: 5s -> 7.5s -> 11s -> 16s -> 24s -> 30s
      const backoffInterval = Math.min(
        initialInterval * Math.pow(backoffMultiplier, consecutiveErrorsRef.current - 1),
        maxInterval
      );
      return backoffInterval;
    }

    return currentIntervalRef.current;
  }, [getInterval, initialInterval, backoffMultiplier, maxInterval]);

  // Fetch job status
  const poll = useCallback(async () => {
    if (!isRunningRef.current || !enabled || !jobId) return;

    setIsFetching(true);
    try {
      const result = await fetchJob(jobId);
      setJob(result);
      setError(null);
      consecutiveErrorsRef.current = 0;

      // Notify subscribers
      onStatusChange?.(result);

      if (isError(result)) {
        onError?.(new Error(result.error_message || 'Job failed'));
        if (autoStop) isRunningRef.current = false;
      } else if (isComplete(result)) {
        onComplete?.(result);
        if (autoStop) isRunningRef.current = false;
      } else {
        // Update interval for next poll based on job state
        currentIntervalRef.current = calculateNextInterval(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      consecutiveErrorsRef.current += 1;
      currentIntervalRef.current = calculateNextInterval(job);
      
      onError?.(error);
    } finally {
      setIsFetching(false);
    }
  }, [jobId, enabled, fetchJob, isError, isComplete, autoStop, onStatusChange, onComplete, onError, calculateNextInterval, job]);

  // Initial fetch
  useEffect(() => {
    if (!enabled || !jobId) return;

    poll().then(() => {
      setIsLoading(false);
    });
  }, [jobId, enabled, poll]);

  // Setup polling interval
  useEffect(() => {
    if (!enabled || !isRunningRef.current || !jobId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Schedule next poll
    intervalRef.current = setInterval(() => {
      poll();
    }, currentIntervalRef.current);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, jobId, poll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Manual controls
  const refetch = useCallback(async () => {
    await poll();
  }, [poll]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    isRunningRef.current = true;
    consecutiveErrorsRef.current = 0;
    currentIntervalRef.current = initialInterval;
  }, [initialInterval]);

  const cancel = useCallback(() => {
    stop();
    setJob(null);
    setError(null);
  }, [stop]);

  return {
    job,
    isLoading,
    isComplete: job ? isComplete(job) : false,
    isError: job ? isError(job) : false,
    error,
    isFetching,
    refetch,
    stop,
    resume,
    cancel,
  };
}
```

### 6.3 Migration Path from Current Patterns

**Option A: Keep TanStack React Query (Recommended)**

```typescript
// For jobs that fit TRQC model (GET endpoints)
const { data: job, isLoading, refetchInterval } = useQuery({
  queryKey: ['async-job', jobId],
  queryFn: () => api.get(`/async-jobs/${jobId}`),
  refetchInterval: (query) => {
    const job = query.state.data?.data;
    if (!job) return 60000;
    if (job.status === 'completed' || job.status === 'failed') return false;
    
    // Faster polling when processing
    if (job.status === 'processing') return 3000;
    return 10000;
  },
});
```

**Option B: Custom Hook for Complex Jobs**

```typescript
// For jobs needing custom logic, error handling, etc.
const { job, isLoading, error, refetch } = useJobPolling(
  jobId,
  async (id) => {
    const response = await api.get(`/async-jobs/${id}`);
    return response.data.job;
  },
  {
    initialInterval: 5000,
    isComplete: (job) => job.status === 'completed',
    isError: (job) => job.status === 'failed',
    getInterval: (job) => {
      // Adaptive polling based on progress
      if (job.status === 'processing' && job.progress < 50) return 3000;
      return 10000;
    },
    onComplete: (job) => {
      toast.success(`Job completed: ${job.name}`);
    },
    onError: (error) => {
      console.error('Job failed:', error);
    },
  }
);
```

---

## 7. UI State Management Approach for Async Jobs

### 7.1 Component State Architecture

```typescript
interface AsyncJobUIState {
  // Job data
  job: AsyncJob | null;
  
  // Loading states
  isInitialLoading: boolean;  // First fetch
  isFetching: boolean;        // Polling fetch
  
  // Job status tracking
  currentPhase: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;           // 0-100
  
  // User feedback
  error: Error | null;
  warnings: string[];
  notifications: Notification[];
  
  // User interactions
  isUserInitiated: boolean;
  canRetry: boolean;
  canCancel: boolean;
}
```

### 7.2 Component Pattern

```typescript
function AsyncJobDetail({ jobId }: { jobId: string }) {
  const {
    job,
    isLoading,
    isFetching,
    isComplete,
    error,
    refetch,
    cancel,
  } = useJobPolling(jobId, fetchAsyncJob, {
    initialInterval: 5000,
    isComplete: (j) => ['completed', 'failed', 'cancelled'].includes(j.status),
  });

  if (isLoading) {
    return <JobLoadingSkeleton />;
  }

  if (error && !job) {
    return (
      <ErrorCard 
        error={error}
        action={<Button onClick={refetch}>Retry</Button>}
      />
    );
  }

  const canRetry = job?.status === 'failed' && job?.retry_count < 3;
  const canCancel = !['completed', 'failed', 'cancelled'].includes(job?.status);

  return (
    <div className="space-y-4">
      {/* Header with status */}
      <JobHeader 
        job={job}
        isFetching={isFetching}
      />

      {/* Progress visualization */}
      {job?.status === 'processing' && (
        <ProgressCard 
          phase={job.current_phase}
          progress={job.progress}
          estimatedTime={job.estimated_completion}
        />
      )}

      {/* Phase tracking */}
      <JobPhasesCard phases={job?.phases || []} />

      {/* Error display */}
      {job?.status === 'failed' && (
        <ErrorCard 
          error={job.error_message}
          retryable={canRetry}
          onRetry={() => retryJob(jobId)}
        />
      )}

      {/* Completion state */}
      {job?.status === 'completed' && (
        <SuccessCard 
          results={job.results}
          actions={[
            <Button onClick={() => downloadResults(job)}>
              Download Results
            </Button>,
            <Button onClick={() => navigate('/jobs')}>
              Back to List
            </Button>,
          ]}
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {canCancel && (
          <Button 
            variant="destructive"
            onClick={() => cancel()}
            disabled={isFetching}
          >
            Cancel Job
          </Button>
        )}
        {canRetry && (
          <Button 
            onClick={() => retryJob(jobId)}
            disabled={isFetching}
          >
            Retry
          </Button>
        )}
        <Button 
          variant="outline"
          onClick={refetch}
          disabled={isFetching}
        >
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
```

### 7.3 Toast Notifications Integration

```typescript
function useJobNotifications(job: AsyncJob | null, error: Error | null) {
  const prevStatusRef = useRef(job?.status);

  useEffect(() => {
    if (!job) return;

    if (job.status !== prevStatusRef.current) {
      const status = job.status;
      prevStatusRef.current = status;

      switch (status) {
        case 'queued':
          toast.info('Job queued for processing');
          break;
        case 'processing':
          toast.info('Job processing started', {
            description: `Expected time: ${job.estimated_duration}`,
          });
          break;
        case 'completed':
          toast.success('Job completed!', {
            description: `Results: ${job.summary}`,
          });
          break;
        case 'failed':
          toast.error('Job failed', {
            description: job.error_message,
          });
          break;
        case 'cancelled':
          toast.info('Job cancelled');
          break;
      }
    }
  }, [job?.status]);

  useEffect(() => {
    if (error) {
      toast.error('Error checking job status', {
        description: error.message,
      });
    }
  }, [error?.message]);
}
```

---

## 8. Potential Concerns & Blockers

### 8.1 Identified Issues

| Issue | Severity | Impact | Solution |
|-------|----------|--------|----------|
| **No WebSocket Support** | Medium | Polling adds latency (5-30s) vs real-time (< 1s) | Consider adding WebSocket fallback for critical jobs |
| **Manual Polling in Some Components** | Medium | Inconsistent patterns, harder to maintain | Migrate all to TanStack React Query or useJobPolling |
| **Fixed Polling Intervals** | Low | May waste bandwidth or miss quick status changes | Use dynamic intervals based on job state |
| **No Global Error Handling** | Medium | Errors handled at component level inconsistently | Add API error interceptor with retry logic |
| **Cache Invalidation Race Conditions** | Low | Multiple mutations could cause stale cache | Ensure proper `queryClient.invalidateQueries` ordering |
| **No Job Cancellation UI** | Medium | Users can't stop long-running jobs from UI | Add cancel endpoints and UI controls |
| **Browser Tab Visibility** | Low | Polling continues even in inactive tabs | Pause polling when tab is hidden (use `useVisibility`) |
| **Memory Leaks from Intervals** | Low | Intervals might not clear on unmount in edge cases | Ensure all intervals cleared in cleanup functions |

### 8.2 Performance Considerations

**Polling Overhead per Job**:
- 5-second interval = 720 requests/hour per job
- 10-second interval = 360 requests/hour per job
- With 100 concurrent jobs = 36,000 requests/hour

**Recommendations**:
1. Use longer intervals (10-30s) for non-critical jobs
2. Implement server-side debouncing to group status checks
3. Use batch status endpoints: `/async-jobs/status?jobIds=id1,id2,id3`
4. Consider WebSocket for high-frequency jobs
5. Add response caching: `Cache-Control: max-age=2`

### 8.3 Backward Compatibility

**Current Code to Update**:
1. **Extractions.jsx** - Manual `setInterval` → useJobPolling or TRQC
2. **useSocialMedia.ts** - Manual callbacks → use TanStack mutations
3. **Sequences** - Consider polling for instance status updates
4. **LeadScrape** - Already good, but could use unified hook

**Migration Strategy**:
- Phase 1: Create useJobPolling hook (non-breaking)
- Phase 2: Deprecate manual polling in new features
- Phase 3: Migrate existing components gradually
- Phase 4: Consider WebSocket upgrade for next major version

---

## 9. Code Snippets Summary

### 9.1 Current Patterns Found

**Pattern 1: TanStack React Query with refetchInterval**
```typescript
// Most common, recommended pattern
useQuery({
  queryKey: ['job', jobId],
  queryFn: () => api.get(`/jobs/${jobId}`),
  refetchInterval: 5000,
  enabled: !!jobId,
})
```

**Pattern 2: Dynamic Refetch Intervals**
```typescript
// Advanced pattern in useLeadScrape
refetchInterval: (query) => {
  const hasProcessing = query.state.data?.leads?.some(l => l.status === 'processing');
  return hasProcessing ? 3000 : 10000;
}
```

**Pattern 3: Manual useEffect Polling**
```typescript
// Used in Extractions.jsx, should be avoided
useEffect(() => {
  const interval = setInterval(fetchExtractions, 5000);
  return () => clearInterval(interval);
}, []);
```

### 9.2 Recommended New Patterns

**Pattern 1: For Simple Jobs (TanStack)**
```typescript
useQuery({
  queryKey: ['async-job', jobId],
  queryFn: () => api.get(`/jobs/${jobId}`),
  refetchInterval: (query) => {
    const job = query.state.data?.job;
    return ['completed', 'failed'].includes(job?.status) ? false : 5000;
  },
})
```

**Pattern 2: For Complex Jobs (Custom Hook)**
```typescript
useJobPolling(jobId, fetchJob, {
  initialInterval: 5000,
  isComplete: (job) => job.status === 'completed',
  isError: (job) => job.status === 'failed',
  getInterval: (job) => job.progress > 80 ? 2000 : 5000,
  onComplete: (job) => toast.success(`Job done!`),
})
```

**Pattern 3: For Lists (TanStack with Derived State)**
```typescript
const { data: jobs } = useQuery({
  queryKey: ['async-jobs'],
  queryFn: () => api.get('/jobs'),
  refetchInterval: () => {
    const hasRunning = jobs?.some(j => j.status === 'processing');
    return hasRunning ? 3000 : 10000;
  },
})
```

---

## 10. Testing Considerations

### 10.1 Polling Hook Tests

```typescript
describe('useJobPolling', () => {
  it('should fetch job initially', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ id: '1', status: 'processing' });
    renderHook(() => useJobPolling('1', fetchFn));
    
    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledWith('1');
    });
  });

  it('should stop polling when job completes', async () => {
    let callCount = 0;
    const fetchFn = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ 
        id: '1', 
        status: callCount > 1 ? 'completed' : 'processing' 
      });
    });

    renderHook(() => useJobPolling('1', fetchFn, {
      isComplete: (job) => job.status === 'completed',
    }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  it('should implement exponential backoff on errors', async () => {
    const fetchFn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: '1', status: 'processing' });

    renderHook(() => useJobPolling('1', fetchFn));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });
});
```

---

## Conclusion

The frontend already implements sophisticated async job tracking patterns, particularly with TanStack React Query. The main opportunities for improvement are:

1. **Standardize** on TanStack React Query for all polling scenarios
2. **Create** a reusable `useJobPolling` hook for complex cases
3. **Implement** dynamic polling intervals to reduce bandwidth
4. **Add** WebSocket support for critical, high-frequency jobs
5. **Improve** error handling and retry logic
6. **Migrate** manual polling patterns to standardized approaches

The proposed `useJobPolling` hook builds on the existing `useLeadScrape` patterns and provides a flexible, composable solution for the async job queue requirements.

