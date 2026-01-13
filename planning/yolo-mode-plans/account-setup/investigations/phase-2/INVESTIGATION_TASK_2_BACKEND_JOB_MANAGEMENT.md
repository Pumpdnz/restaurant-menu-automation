# Investigation Task 2: Backend Job Management for Async Yolo Mode

## Overview

This investigation analyzed backend job execution patterns to propose a server-side job management system that continues independently of frontend connections.

---

## Current Backend Job Management Patterns

### Lead Scrape Job Architecture (Reference Model)

**Job States:**
```
draft → pending → in_progress → completed/failed/cancelled
```

**Key Characteristics:**
- Sequential step progression with status tracking
- Uses `setImmediate()` callbacks for async processing
- Database-driven state machine (all state in Supabase)
- Step statuses: `pending`, `action_required`, `in_progress`, `completed`

**Key Files:**
- `/src/routes/lead-scrape-routes.js` - Uses `setImmediate()` at lines 151, 250, 394, 521
- `/src/services/lead-scrape-service.js` - Service layer managing job lifecycle
- `/src/services/lead-scrape-firecrawl-service.js` - Step execution with error handling

### setImmediate() Pattern Example

```javascript
// From lead-scrape-routes.js
setImmediate(async () => {
  try {
    const step1Result = await leadScrapeFirecrawlService.processStep1(job.id, job);
    console.log('Step 1 completed:', step1Result);
  } catch (step1Error) {
    console.error('Step 1 failed:', step1Error.message);
  }
});
```

### Current Registration Flow (Problem Area)

The registration system currently:
- Calls `execAsync()` directly for Playwright script execution (180s timeout)
- **Blocks** the HTTP response until script completes
- No job persistence or retry capability
- No real-time status updates if user navigates away

File: `/src/routes/registration-routes.js` (lines 615-748)

---

## No Job Queue System

The codebase has **NO job queue system** (no Bull, BullMQ, etc.). The `setImmediate()` pattern works for:
- Single-server deployments
- Short-running background tasks
- In-memory state management

For production scaling, consider:
- **Bull/BullMQ** for queue persistence and retries
- **Redis** for job state and progress tracking
- **Temporal** or **Inngest** for complex orchestration

---

## Proposed Registration Job Execution Flow

### 1. Job Creation Phase

```
1. Frontend calls POST /api/registration-jobs
2. Backend creates registration_jobs record (status: pending)
3. Backend creates registration_job_steps records for all 12 steps
4. Returns immediately with job_id and status
5. setImmediate() triggers background execution
```

### 2. Background Execution

```javascript
setImmediate(async () => {
  try {
    // Update job status
    await updateJobStatus(jobId, 'in_progress');

    // Execute Phase 1 (parallel steps)
    await executePhase1(jobId, config);

    // Execute Phase 2 (after account registration completes)
    await executePhase2(jobId, config);

    // Execute Phase 3 & 4
    await executePhase3(jobId, config);
    await executePhase4(jobId, config);

    await updateJobStatus(jobId, 'completed');
  } catch (error) {
    await updateJobStatus(jobId, 'failed', error.message);
  }
});
```

### 3. Step Execution Pattern

```javascript
async function executeStep(jobId, stepId, stepHandler) {
  // Update step status
  await updateStepStatus(jobId, stepId, 'running');

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await stepHandler();
      await updateStepStatus(jobId, stepId, 'completed', { result_data: result });
      return result;
    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === MAX_RETRIES) {
        await updateStepStatus(jobId, stepId, 'failed', { error_message: error.message });
        throw error;
      }

      await updateStepStatus(jobId, stepId, 'retrying', { retry_count: attempt + 1 });
      await sleep(RETRY_DELAY * (attempt + 1)); // Exponential backoff
    }
  }
  throw lastError;
}
```

---

## Error Handling Strategy

### Retryable Errors
- Network timeouts (reschedule immediately)
- Rate limiting (exponential backoff)
- Temporary script failures (retry up to 3 times)
- API call failures (500 errors retry, 4xx fail immediately)

### Non-Retryable Errors
- Invalid email/password (user intervention needed)
- Duplicate account (mark as completed with warning)
- Restaurant already exists (mark as completed)
- Validation failures (require manual fixing)

### Error Classification

```javascript
function isRetryableError(error) {
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('timeout') ||
    message.includes('rate') ||
    message.includes('econnreset') ||
    message.includes('network') ||
    error.statusCode >= 500
  );
}
```

---

## Proposed API Endpoints

### Create Registration Job

```
POST /api/registration-jobs
Body: {
  restaurant_id: string (required),
  auto_start: boolean (default: true),
  execution_config: {
    email: string,
    password: string,
    phone: string,
    csv_path: string,
    // ... other config
  }
}
Response: {
  job_id: string,
  status: 'pending',
  steps: [...]
}
```

### Get Job Status

```
GET /api/registration-jobs/:jobId
Response: {
  id: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled',
  current_phase: 'phase1' | 'phase2' | 'phase3' | 'phase4',
  current_step: number,
  progress_percent: number,
  steps: [{
    step_id: string,
    step_label: string,
    status: string,
    duration_ms: number,
    error_message: string | null
  }],
  created_at: string,
  started_at: string,
  completed_at: string | null,
  error_message: string | null
}
```

### Poll Progress (Alternative to WebSocket)

```
GET /api/registration-jobs/:jobId/progress
Response: {
  status: string,
  current_phase: string,
  current_step: number,
  step_statuses: Record<string, string>,
  progress_percent: number
}
// Called every 2-5s from frontend
```

### Cancel Job

```
POST /api/registration-jobs/:jobId/cancel
Response: {
  success: true,
  status: 'cancelled'
}
```

### Retry Failed Step

```
POST /api/registration-jobs/:jobId/retry
Body: {
  from_step?: string  // Optional: restart from specific step
}
Response: {
  success: true,
  status: 'in_progress'
}
```

### Get Active Job for Restaurant

```
GET /api/restaurants/:restaurantId/registration-jobs/active
Response: {
  job: RegistrationJob | null
}
```

---

## Service Layer Structure

### New Service: `registration-job-service.js`

```javascript
// Core functions
async function createJob(restaurantId, orgId, config)
async function startJob(jobId)
async function cancelJob(jobId)
async function retryJob(jobId, fromStep?)
async function getJob(jobId)
async function getActiveJobForRestaurant(restaurantId)

// Internal execution
async function executeJob(jobId)
async function executePhase(jobId, phaseNumber)
async function executeStep(jobId, stepId, handler)
async function updateJobStatus(jobId, status, error?)
async function updateStepStatus(jobId, stepId, status, data?)

// Step handlers (delegate to existing services)
async function handleAccountRegistration(config)
async function handleCodeGeneration(config)
async function handleMenuImport(config)
// ... etc
```

---

## Integration with Existing Endpoints

The new job system should **wrap** existing registration endpoints:

```javascript
// Example: Account Registration Step Handler
async function handleAccountRegistration(config) {
  // Calls existing endpoint internally
  const response = await fetch('/api/registration/pumpd-user-registration', {
    method: 'POST',
    body: JSON.stringify({
      email: config.email,
      password: config.password,
      phone: config.phone
    })
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
```

---

## Key Implementation Advantages

1. **Minimal new dependencies** - Uses existing patterns
2. **Database-driven** - All state persisted, survives process restarts
3. **Frontend-agnostic** - Works with polling, WebSocket, or SSE
4. **Retry-capable** - Failed steps can be retried without re-creating job
5. **Audit trail** - All execution logged in registration_job_steps
6. **Parallelize-able** - Future: Run multiple steps for different restaurants in parallel

---

## Implementation Priority

1. **Phase 1**: Create registration_jobs table schema and service layer
2. **Phase 2**: Create job management endpoints (create, status, cancel)
3. **Phase 3**: Port registration endpoints to use job system with setImmediate
4. **Phase 4**: Add retry logic and error handling
5. **Phase 5**: Frontend integration with polling
