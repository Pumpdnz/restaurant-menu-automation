# Implementation Plan: Async Single-Restaurant YOLO Mode

**Date:** 2024-12-23
**Status:** Ready for Implementation
**Recommended Approach:** Option B - Reuse registration_jobs/registration_job_steps tables

---

## Executive Summary

The single-restaurant YOLO mode currently uses frontend-driven execution that dies when the dialog closes. By reusing the batch system infrastructure, we can achieve async execution with **~350 lines of new code** while **reusing 95% of tested batch code**.

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| A: New execution table | Clean separation | Duplicate code, more maintenance | ❌ |
| B: Reuse registration_jobs | 95% code reuse, proven | batch_job_id NULL handling | ✅ **RECOMMENDED** |
| C: Add fields to restaurants | Lightweight | Limited progress tracking | ❌ |

---

## Current vs Target Architecture

### Current (Frontend-Driven)
```
User → YoloModeDialog → useYoloModeExecution hook → API calls
                        ↓
                   React state (lost on unmount)
```

### Target (Backend-Driven)
```
User → YoloModeDialog → POST /execute-single-restaurant → Backend async job
                        ↓                                        ↓
                   Poll for status ← GET /progress/:id ← registration_job_steps
```

---

## Database Schema (No Changes Needed)

The existing batch tables already support single-restaurant execution:

### registration_jobs (KEY TABLE)
```sql
-- batch_job_id can be NULL for single-restaurant jobs
batch_job_id UUID REFERENCES registration_batch_jobs(id) -- NULLABLE
restaurant_id UUID NOT NULL REFERENCES restaurants(id)
status TEXT NOT NULL DEFAULT 'pending'
execution_config JSONB DEFAULT '{}'  -- Stores YoloModeFormData
```

### registration_job_steps (PROGRESS TRACKING)
```sql
registration_job_id UUID NOT NULL
step_number INTEGER NOT NULL  -- Use 6 for YOLO execution
status TEXT NOT NULL
sub_step_progress JSONB  -- Stores detailed phase/sub-step progress
```

**Key Insight:** Single-restaurant jobs use `batch_job_id = NULL` to differentiate from batch jobs.

---

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Add Functions to `registration-batch-service.js`

**New function: `executeYoloModeForSingleRestaurant()`**
```javascript
/**
 * Execute Yolo Mode for a single restaurant (no batch required)
 * Creates/updates registration_job and tracks progress asynchronously
 *
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} formData - YoloModeFormData from frontend
 * @param {string} organisationId - User's organization
 * @param {object} context - Auth context for API calls
 * @returns {Promise<{jobId: string}>} - Job ID for polling
 */
async function executeYoloModeForSingleRestaurant(
  restaurantId,
  formData,
  organisationId,
  context
) {
  const client = getSupabaseClient();

  // 1. Check for existing single-restaurant job
  let { data: existingJob } = await client
    .from('registration_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('batch_job_id', null)  // Single-restaurant jobs only
    .single();

  // 2. Create or update job
  let jobId;
  if (existingJob && existingJob.status !== 'completed') {
    jobId = existingJob.id;
    // Reset and update config for retry
    await client
      .from('registration_jobs')
      .update({
        execution_config: formData,
        status: 'pending',
        error_message: null,
      })
      .eq('id', jobId);

    // Reset Step 6
    await client
      .from('registration_job_steps')
      .update({
        status: 'pending',
        sub_step_progress: null,
        error_message: null,
      })
      .eq('registration_job_id', jobId)
      .eq('step_number', 6);
  } else {
    // Create new registration_job
    const { data: newJob, error } = await client
      .from('registration_jobs')
      .insert({
        restaurant_id: restaurantId,
        batch_job_id: null,  // Single-restaurant marker
        status: 'pending',
        current_step: 6,
        execution_config: formData,
        organisation_id: organisationId,
      })
      .select()
      .single();

    if (error) throw error;
    jobId = newJob.id;

    // Create Step 6 tracking record
    await client
      .from('registration_job_steps')
      .insert({
        registration_job_id: jobId,
        step_number: 6,
        status: 'pending',
      });
  }

  // 3. Mark as in_progress before async start
  await client
    .from('registration_jobs')
    .update({ status: 'in_progress' })
    .eq('id', jobId);

  // 4. Trigger async execution
  setImmediate(async () => {
    try {
      const { data: job } = await client
        .from('registration_jobs')
        .select('*, restaurant:restaurants(*)')
        .eq('id', jobId)
        .single();

      // Reuse the existing executeYoloModeForJob logic
      await executeYoloModeForJobInternal(job, formData, context);

      // Mark completed
      await client
        .from('registration_jobs')
        .update({ status: 'completed' })
        .eq('id', jobId);

    } catch (error) {
      console.error(`Single-restaurant YOLO failed for ${restaurantId}:`, error);
      await client
        .from('registration_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', jobId);
    }
  });

  return { jobId };
}
```

**New function: `getSingleRestaurantYoloProgress()`**
```javascript
/**
 * Get execution progress for single restaurant YOLO mode
 * Used by frontend polling
 */
async function getSingleRestaurantYoloProgress(restaurantId, organisationId) {
  const client = getSupabaseClient();

  const { data: job, error } = await client
    .from('registration_jobs')
    .select(`
      id,
      status,
      current_step,
      error_message,
      created_at,
      updated_at,
      registration_job_steps (
        step_number,
        status,
        sub_step_progress,
        error_message,
        started_at,
        completed_at
      )
    `)
    .eq('restaurant_id', restaurantId)
    .eq('organisation_id', organisationId)
    .is('batch_job_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !job) return null;

  // Find Step 6 details
  const step6 = job.registration_job_steps?.find(s => s.step_number === 6);

  return {
    jobId: job.id,
    status: job.status,
    currentPhase: step6?.sub_step_progress?.current_phase || null,
    phases: step6?.sub_step_progress?.phases || {},
    error: job.error_message || step6?.error_message || null,
    startedAt: step6?.started_at,
    completedAt: step6?.completed_at,
  };
}
```

**Refactor: Extract `executeYoloModeForJobInternal()`**

Extract the core execution logic from `executeYoloModeForJob()` into a separate internal function that can be called by both batch and single-restaurant execution:

```javascript
/**
 * Internal function that executes YOLO mode phases for a job
 * Used by both batch processing and single-restaurant execution
 */
async function executeYoloModeForJobInternal(job, config, context) {
  // All the existing phase execution logic from executeYoloModeForJob()
  // but without the batch-specific incrementBatchProgress calls

  const phaseProgress = initializePhaseProgress();
  await updateStepStatus(job.id, 6, 'in_progress', { sub_step_progress: phaseProgress });

  // Phase 1-4 execution (existing code)
  // ...
}
```

#### 1.2 Add API Endpoints to `registration-routes.js`

```javascript
// POST /api/registration/execute-single-restaurant
router.post('/execute-single-restaurant', authMiddleware, async (req, res) => {
  try {
    const { restaurantId, formData } = req.body;
    const organisationId = req.user.organisation_id;

    // Build context for API calls
    const context = {
      authToken: req.headers.authorization,
      organisationId: organisationId,
    };

    const { jobId } = await registrationBatchService
      .executeYoloModeForSingleRestaurant(
        restaurantId,
        formData,
        organisationId,
        context
      );

    res.json({ success: true, jobId });
  } catch (error) {
    console.error('Execute single restaurant error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/registration/single-restaurant-progress/:restaurantId
router.get('/single-restaurant-progress/:restaurantId', authMiddleware, async (req, res) => {
  try {
    const organisationId = req.user.organisation_id;

    const progress = await registrationBatchService
      .getSingleRestaurantYoloProgress(
        req.params.restaurantId,
        organisationId
      );

    if (!progress) {
      return res.json({ status: 'not_started' });
    }

    res.json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### Phase 2: Frontend Changes

#### 2.1 Modify `useYoloModeExecution.ts`

Replace direct API execution with backend submission and polling:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';
import type { YoloModeFormData, Restaurant } from '../components/registration/YoloModeDialog';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
export type ExecutionPhase = 'phase1' | 'phase2' | 'phase3' | 'phase4' | null;
export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StepResult {
  status: StepStatus;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount?: number;
}

// Polling interval in milliseconds
const POLL_INTERVAL = 2000;
const MAX_POLL_DURATION = 30 * 60 * 1000; // 30 minutes

export function useYoloModeExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const [currentPhase, setCurrentPhase] = useState<ExecutionPhase>(null);
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({});
  const [jobId, setJobId] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  const restaurantIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Convert backend phase structure to frontend step results
  const convertPhasesToStepResults = useCallback((phases: Record<string, any>): Record<string, StepResult> => {
    const results: Record<string, StepResult> = {};

    Object.values(phases).forEach((phase: any) => {
      if (phase?.sub_steps) {
        Object.entries(phase.sub_steps).forEach(([stepName, step]: [string, any]) => {
          results[stepName] = {
            status: step.status as StepStatus,
            error: step.error,
            startTime: step.started_at,
            endTime: step.completed_at,
          };
        });
      }
    });

    return results;
  }, []);

  // Poll for execution progress
  const pollProgress = useCallback(async (restaurantId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      pollStartTimeRef.current = Date.now();

      const poll = async () => {
        // Check timeout
        const elapsed = Date.now() - (pollStartTimeRef.current || 0);
        if (elapsed > MAX_POLL_DURATION) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setExecutionStatus('failed');
          reject(new Error('Execution timeout - please check restaurant status'));
          return;
        }

        try {
          const response = await api.get(`/registration/single-restaurant-progress/${restaurantId}`);
          const { status, phases, currentPhase: phase, error } = response.data;

          // Update phase progress
          if (phases) {
            const results = convertPhasesToStepResults(phases);
            setStepResults(results);
          }

          if (phase) {
            setCurrentPhase(phase as ExecutionPhase);
          }

          // Check completion states
          if (status === 'completed') {
            setExecutionStatus('completed');
            setIsExecuting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            resolve();
          } else if (status === 'failed') {
            setExecutionStatus('failed');
            setIsExecuting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            reject(new Error(error || 'Execution failed'));
          }
          // If still running, continue polling
        } catch (err) {
          // Ignore individual poll errors, continue polling
          console.warn('Poll error (will retry):', err);
        }
      };

      // Start polling
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
      poll(); // Immediate first poll
    });
  }, [convertPhasesToStepResults]);

  // Start execution
  const executeYoloMode = useCallback(async (
    formData: YoloModeFormData,
    _restaurant: Restaurant,
    restaurantId: string
  ): Promise<any> => {
    setIsExecuting(true);
    setExecutionStatus('running');
    setStepResults({});
    setCurrentPhase('phase1');
    restaurantIdRef.current = restaurantId;

    try {
      // Submit to backend
      const response = await api.post('/registration/execute-single-restaurant', {
        restaurantId,
        formData,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to start execution');
      }

      setJobId(response.data.jobId);

      // Start polling (this will resolve when execution completes)
      await pollProgress(restaurantId);

      return { success: true };
    } catch (error: any) {
      setExecutionStatus('failed');
      setIsExecuting(false);
      throw error;
    }
  }, [pollProgress]);

  // Cancel execution (stops polling, backend continues)
  const cancelExecution = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsExecuting(false);
    setExecutionStatus('cancelled');
  }, []);

  // Reset state
  const resetExecution = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsExecuting(false);
    setExecutionStatus('idle');
    setCurrentPhase(null);
    setStepResults({});
    setJobId(null);
    restaurantIdRef.current = null;
    pollStartTimeRef.current = null;
  }, []);

  // Resume polling (for when user returns to dialog)
  const resumePolling = useCallback(async (restaurantId: string) => {
    if (pollIntervalRef.current) return; // Already polling

    // Check current status
    try {
      const response = await api.get(`/registration/single-restaurant-progress/${restaurantId}`);
      const { status } = response.data;

      if (status === 'in_progress' || status === 'pending') {
        setIsExecuting(true);
        setExecutionStatus('running');
        restaurantIdRef.current = restaurantId;
        await pollProgress(restaurantId);
      }
    } catch (err) {
      console.error('Resume polling error:', err);
    }
  }, [pollProgress]);

  return {
    isExecuting,
    executionStatus,
    currentPhase,
    stepResults,
    jobId,
    executeYoloMode,
    cancelExecution,
    resetExecution,
    resumePolling,
  };
}
```

#### 2.2 Modify `YoloModeDialog.tsx`

Add logic to check for in-progress execution when dialog opens:

```typescript
// In YoloModeDialog component, add useEffect to check for in-progress execution
useEffect(() => {
  if (open && restaurant?.id) {
    // Check if there's an in-progress execution
    api.get(`/registration/single-restaurant-progress/${restaurant.id}`)
      .then(response => {
        if (response.data.status === 'in_progress') {
          // Switch to progress view and resume polling
          setViewMode('progress');
          resumePolling(restaurant.id);
        }
      })
      .catch(() => {
        // No in-progress execution, stay on form view
      });
  }
}, [open, restaurant?.id, resumePolling]);
```

---

### Phase 3: Testing Checklist

#### Backend Tests
- [ ] Create single-restaurant job with `batch_job_id = NULL`
- [ ] Execute all 12 sub-steps successfully
- [ ] Verify progress updates in `sub_step_progress` JSONB
- [ ] Test retry logic (force failure, verify retry)
- [ ] Test error handling (job marked as failed)
- [ ] Verify existing batch jobs unaffected

#### Frontend Tests
- [ ] Submit execution and receive jobId
- [ ] Poll for progress updates
- [ ] Display phase progress correctly
- [ ] Handle execution completion
- [ ] Handle execution failure
- [ ] Cancel polling (backend continues)
- [ ] Resume polling on dialog reopen

#### Integration Tests
- [ ] Close dialog during execution → backend continues
- [ ] Navigate away from page → backend continues
- [ ] Return to page → resume polling shows current state
- [ ] Multiple tabs don't create duplicate jobs
- [ ] 30-minute execution completes successfully

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Polling timeout | Low | Medium | Show "check status" message with link |
| Duplicate jobs | Low | Low | Unique constraint on (restaurant_id, batch_job_id IS NULL) |
| Backend crash mid-execution | Very Low | High | Job remains in_progress, can resume |
| Network interruption | Medium | Low | Polling continues on reconnect |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/registration-batch-service.js` | Add 3 functions (~150 lines) |
| `src/routes/registration-routes.js` | Add 2 endpoints (~40 lines) |
| `src/hooks/useYoloModeExecution.ts` | Rewrite with polling (~200 lines) |
| `src/components/registration/YoloModeDialog.tsx` | Add resume check (~20 lines) |

**Total: ~400 lines of code changes**

---

## Deployment Notes

1. **No migrations required** - existing tables support the pattern
2. **Backwards compatible** - batch system unchanged
3. **Feature flag recommended** - can gate behind `registration.asyncSingleRestaurant`
4. **Monitoring** - add logs for job creation and completion

---

## Future Enhancements

1. **WebSocket updates** - Replace polling with real-time push
2. **Execution history** - Show past YOLO executions per restaurant
3. **Admin dashboard** - View all in-progress executions across restaurants
4. **Scheduled execution** - Queue YOLO mode for specific time
