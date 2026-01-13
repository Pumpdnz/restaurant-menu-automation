# Investigation Task 3: Frontend Polling & State for Async Yolo Mode

## Overview

This investigation analyzed frontend polling patterns and state management to propose a persistent progress display for registration jobs in the Complete Setup card.

---

## Current Polling Patterns

### React Query Polling in useLeadScrape.ts

**Standard Polling:**
```typescript
// useLeadScrapeJobs - List polling
refetchInterval: 30000  // 30 seconds

// useLeadScrapeJob - Single job
refetchInterval: 10000  // 10 seconds
enabled: !!jobId
```

**Dynamic Polling (Smart Intervals):**
```typescript
// useStepLeads - Adapts based on activity
refetchInterval: (query) => {
  const hasProcessingLeads = query.state.data?.leads?.some(
    (l: Lead) => l.step_progression_status === 'processing'
  );
  return hasProcessingLeads ? 3000 : 10000; // 3s when active, 10s otherwise
}
```

**Conditional Polling:**
```typescript
// useRestaurantSequences
refetchInterval: isEnabled ? 30000 : false;
```

### Query Cache Management

```typescript
// Invalidate related queries after mutations
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
  queryClient.invalidateQueries({ queryKey: ['lead-scrape-job', jobId] });
}
```

---

## Current State in useYoloModeExecution.ts

**Existing Hook Structure:**
```typescript
- isExecuting: boolean
- executionStatus: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
- currentPhase: 'phase1' | 'phase2' | 'phase3' | 'phase4' | null
- stepResults: Record<string, StepResult>
- executeYoloMode()
- cancelExecution()
- resetExecution()
```

**Problems with Current Approach:**
1. State is client-side only - lost on navigation
2. Execution stops if dialog closes (AbortController)
3. No persistent job identifier for polling
4. Progress cannot be shown outside dialog
5. No resume capability

---

## Proposed Hook: useRegistrationJob

```typescript
interface RegistrationJob {
  id: string;
  restaurant_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  currentPhase: ExecutionPhase;
  stepResults: Record<string, StepResult>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

function useRegistrationJob(jobId: string | null) {
  return useQuery<{ success: boolean; job: RegistrationJob }>({
    queryKey: ['registration-job', jobId],
    queryFn: async () => {
      const response = await api.get(`/registration-jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      if (!job) return false;

      // Stop polling when complete
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return false;
      }

      // Smart interval: 5s during execution, 10s otherwise
      return job.status === 'in_progress' ? 5000 : 10000;
    },
    staleTime: 0, // Always fetch for real-time status
  });
}
```

### Hook for Active Restaurant Job

```typescript
function useActiveRegistrationJob(restaurantId: string | null) {
  return useQuery({
    queryKey: ['registration-jobs', 'active', restaurantId],
    queryFn: async () => {
      const response = await api.get(`/restaurants/${restaurantId}/registration-jobs/active`);
      return response.data;
    },
    enabled: !!restaurantId,
    refetchInterval: 10000, // Check for active jobs every 10s
  });
}
```

---

## UI Component Modifications

### Complete Setup Card Changes

**Current State (RestaurantDetail.jsx line ~5269):**
```jsx
// Static button that opens dialog
<Button onClick={() => setYoloModeOpen(true)}>
  Open Complete Setup
</Button>
```

**Proposed Changes:**

```tsx
function CompleteSetupCard({ restaurant, registrationStatus }) {
  // Get any active registration job for this restaurant
  const { data: activeJob } = useActiveRegistrationJob(restaurant.id);
  const { data: jobData } = useRegistrationJob(activeJob?.job?.id);

  // Show different UI based on job state
  if (activeJob?.job?.status === 'in_progress') {
    return <InProgressView job={jobData?.job} />;
  }

  if (activeJob?.job?.status === 'completed') {
    return <CompletedView job={jobData?.job} />;
  }

  if (activeJob?.job?.status === 'failed') {
    return <FailedView job={jobData?.job} onRetry={handleRetry} />;
  }

  // Default: show Open Dialog button
  return <StartSetupButton onClick={() => setYoloModeOpen(true)} />;
}
```

### InProgressView Component

```tsx
function InProgressView({ job }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Setup In Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Reuse existing YoloModeProgress component */}
        <YoloModeProgress
          stepResults={job.stepResults}
          currentPhase={job.currentPhase}
        />
        <p className="text-sm text-muted-foreground mt-2">
          Started {formatDistanceToNow(job.startedAt)} ago
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## YoloModeProgress Component Reuse

**Compatibility Analysis:**
- YoloModeProgress is completely decoupled from dialog
- Takes only `stepResults` and `currentPhase` as props
- Can be used in any container (dialog, card, page)
- No hardcoded dialog-specific styling

**Usage Pattern:**
```tsx
// In Dialog (current)
<YoloModeProgress
  stepResults={stepResults}
  currentPhase={currentPhase}
/>

// In Card (new)
<YoloModeProgress
  stepResults={jobData?.job?.stepResults || {}}
  currentPhase={jobData?.job?.currentPhase || null}
/>
```

**Optional Enhancements:**
```tsx
// Add compact prop for card variant
<YoloModeProgress
  stepResults={stepResults}
  currentPhase={currentPhase}
  compact={true}  // Collapsed view for card
/>
```

---

## State Persistence Strategy

### 1. Database-Backed (Primary)
- All job state stored in `registration_jobs` table
- Job ID stored in restaurant context
- Polling resumes automatically on page load

### 2. Session Storage (Fallback)
```typescript
// Store job ID during execution
useEffect(() => {
  if (jobId) {
    sessionStorage.setItem(`yolo_job_${restaurantId}`, jobId);
  }
}, [jobId, restaurantId]);

// Retrieve on mount
useEffect(() => {
  const storedJobId = sessionStorage.getItem(`yolo_job_${restaurantId}`);
  if (storedJobId) {
    setRegistrationJobId(storedJobId);
  }
}, [restaurantId]);
```

### 3. Query Cache Rehydration
```typescript
// React Query cache persists the job data
// If active job exists in cache, resume polling automatically
```

---

## Page Navigation Handling

### Dialog Close Handling
```typescript
const handleClose = () => {
  if (isExecuting) {
    toast.info('Setup is running in background. Check the Complete Setup card for progress.');
  }
  onOpenChange(false);
};
```

### Navigation Away Strategy
```typescript
// In RestaurantDetail or parent component
useEffect(() => {
  if (activeRegistrationJob?.status === 'in_progress') {
    // Show banner when navigating away (optional)
    toast.info(
      <span>
        Restaurant setup is running in the background.
        <Link to={`/restaurants/${restaurantId}`}>View progress</Link>
      </span>
    );
  }
}, [location.pathname]);
```

### Auto-Refresh on Return
```typescript
useEffect(() => {
  // When page becomes visible, invalidate to refresh
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && activeJobId) {
      queryClient.invalidateQueries({
        queryKey: ['registration-job', activeJobId]
      });
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [activeJobId]);
```

---

## Polling Configuration Recommendations

### Refetch Intervals
```typescript
// Active execution
refetchInterval: 5000  // 5 seconds for responsive updates

// Pending/waiting
refetchInterval: 10000  // 10 seconds for lower frequency

// Completed/Failed/Cancelled
refetchInterval: false  // Stop polling
```

### Cache Configuration
```typescript
staleTime: 0,  // Always check for latest
gcTime: 5 * 60 * 1000,  // Keep 5 minutes
retry: 3,  // Retry on failure
retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
```

---

## Risk Mitigation

### Memory Leaks
- Use `enabled` flag to stop polling when not needed
- Cleanup subscriptions on unmount
- Clear cache on logout

### Stale Data
- Set `staleTime: 0` for registration jobs
- Force refetch when returning to page
- Manual refresh button as fallback

### Network Issues
- Exponential backoff for retries
- Show offline indicator if polling fails
- Allow manual refresh

### Job Orphans
- Store job ID immediately (don't wait for completion)
- Implement cleanup for abandoned jobs (no updates for 24h)
- Show historical jobs in UI

---

## Key Questions Answered

| Question | Answer |
|----------|--------|
| How does React Query polling work? | Uses `refetchInterval` in ms or function for dynamic intervals |
| What refetch interval is used? | Lead scrape: 30s list, 10s single job, 3-10s dynamic for steps |
| How show progress without dialog? | Query active job, render YoloModeProgress in card |
| How handle navigation? | Store job ID in sessionStorage, resume polling on return |
| How reuse YoloModeProgress? | Already decoupled - works with any container |

---

## Implementation Summary

1. **Create `useRegistrationJob` hook** with React Query polling
2. **Create `useActiveRegistrationJob` hook** for checking active jobs
3. **Extend Complete Setup card** to show progress inline
4. **Add session storage fallback** for job ID persistence
5. **Add visibility change handler** for auto-refresh on return
6. **Reuse YoloModeProgress component** as-is (minimal changes)
