# Investigation Task 4: Batch Execution Extensibility

## Overview

This investigation analyzed batch processing patterns to propose extensibility for batch execution of multiple restaurants.

---

## Lead Scrape Reference Architecture

### Three-Level Hierarchy

```
lead_scrape_jobs (1 per "campaign")
    ↓ (1:N)
leads (individual entities)
    ↓
lead_scrape_job_steps (sequential phases)
```

**Key Characteristics:**
- Single job tracks overall status
- Steps have independent status and counts
- Each step can be processed independently
- Frontend polling uses React Query (10-30s intervals)

---

## Proposed Batch Structure

### Three-Level Hierarchy for Registration

```
registration_batch_jobs (1 per batch)
    ↓ (1:N)
registration_jobs (1 per restaurant)
    ↓ (1:N)
registration_job_steps (1 per execution phase)
```

---

## Database Schema Additions

### `registration_batch_jobs` Table

```sql
CREATE TABLE IF NOT EXISTS public.registration_batch_jobs (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Basic Info
  name TEXT NOT NULL,  -- e.g., "Auckland Outbound Q4"
  organisation_id UUID NOT NULL,

  -- Execution Mode
  execution_mode TEXT DEFAULT 'sequential',  -- sequential | parallel (future)

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, pending, in_progress, completed, failed, cancelled

  -- Progress Tracking
  total_restaurants INTEGER DEFAULT 0,
  completed_restaurants INTEGER DEFAULT 0,
  failed_restaurants INTEGER DEFAULT 0,

  -- Common Settings
  settings JSONB DEFAULT '{}',  -- Common config for all restaurants

  -- User tracking
  created_by UUID,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE NULL,

  -- Foreign Keys
  CONSTRAINT batch_jobs_org_fk FOREIGN KEY (organisation_id)
    REFERENCES organisations(id),

  -- Check Constraints
  CONSTRAINT batch_jobs_status_check CHECK (
    status = ANY (ARRAY['draft', 'pending', 'in_progress', 'completed', 'failed', 'cancelled'])
  ),
  CONSTRAINT batch_jobs_mode_check CHECK (
    execution_mode = ANY (ARRAY['sequential', 'parallel'])
  )
);

-- Indexes
CREATE INDEX idx_batch_jobs_status ON public.registration_batch_jobs USING BTREE (status);
CREATE INDEX idx_batch_jobs_org_id ON public.registration_batch_jobs USING BTREE (organisation_id);
CREATE INDEX idx_batch_jobs_created_at ON public.registration_batch_jobs USING BTREE (created_at DESC);
```

### Updated `registration_jobs` Table

Add batch relationship:
```sql
ALTER TABLE registration_jobs
ADD COLUMN batch_job_id UUID NULL
REFERENCES registration_batch_jobs(id) ON DELETE CASCADE;

CREATE INDEX idx_registration_jobs_batch ON registration_jobs USING BTREE (batch_job_id);
```

### `batch_operation_logs` Table (Optional)

```sql
CREATE TABLE IF NOT EXISTS public.batch_operation_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  batch_job_id UUID NOT NULL,
  registration_job_id UUID NULL,

  -- Operation Details
  operation TEXT NOT NULL,  -- job_created, step_completed, error_occurred, retry_attempted
  details JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT batch_logs_batch_fk FOREIGN KEY (batch_job_id)
    REFERENCES registration_batch_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_batch_logs_batch ON batch_operation_logs USING BTREE (batch_job_id);
```

---

## Parent/Child Job Relationships

### Status Propagation Rules

**Batch Job Status Transitions:**
```
draft → pending (user clicks "Start Batch")
pending → in_progress (first child starts)
in_progress → completed (all children complete or fail)
in_progress → cancelled (user cancels)
in_progress → failed (>50% child failures or critical error)
```

**Status Calculation Logic:**
```typescript
function calculateBatchStatus(batch: BatchJob): BatchStatus {
  const jobs = batch.registration_jobs;

  const allComplete = jobs.every(j => j.status === 'completed');
  const allFailed = jobs.every(j => j.status === 'failed');
  const anyInProgress = jobs.some(j => j.status === 'in_progress');
  const failureRate = jobs.filter(j => j.status === 'failed').length / jobs.length;

  if (batch.cancelled_at) return 'cancelled';
  if (allComplete) return 'completed';
  if (allFailed) return 'failed';
  if (failureRate > 0.5) return 'failed';  // Threshold
  if (anyInProgress) return 'in_progress';
  return 'pending';
}
```

### Example Scenario

```
Batch: "Auckland Q4" (3 restaurants)
├─ R1 (Pizza Palace): completed ✓
├─ R2 (Burger House): failed ✗ (at step 4)
└─ R3 (Chicken Shop): completed ✓

Batch Status: completed (2/3 successful, 1/3 failed)
```

---

## UI Considerations for Batch Mode

### 1. Batch Selection (Restaurants Page)

```
┌──────────────────────────────────────────────────────┐
│ [ ] Name           Type     Stage    ICP    Status   │
├──────────────────────────────────────────────────────┤
│ [✓] Pizza Palace   Outbound cold    7/10   ready    │
│ [✓] Burger House   Outbound warm    8/10   ready    │
│ [ ] Chicken Shop   Inbound  hot     9/10   ready    │
├──────────────────────────────────────────────────────┤
│ Selected: 2 restaurants  [Start Batch Registration]  │
└──────────────────────────────────────────────────────┘
```

### 2. Batch Progress View

```
┌──────────────────────────────────────────────────────┐
│ Batch Progress: "Auckland Q4"                        │
├──────────────────────────────────────────────────────┤
│ Status: in_progress  |  1 of 3 complete (33%)       │
│ ████░░░░░░░░░░░░░░░░ 33%                            │
├──────────────────────────────────────────────────────┤
│ Pizza Palace       ✓ Complete         23m 15s       │
│ Burger House       ⏳ In Progress     (12m)         │
│   └─ CSV Upload    ⏳ uploading...                   │
│ Chicken Shop       ○ Pending         (waiting)      │
├──────────────────────────────────────────────────────┤
│          [Pause] [Cancel] [Export]                   │
└──────────────────────────────────────────────────────┘
```

### 3. Batch History Page (`/registration-batches`)

```
Tabs: [In Progress] [Completed] [Failed]

┌─ Batch: "Auckland Q4" (3 restaurants)
├─ Status: completed          ✓ 100%
├─ Completed: 23m ago
├─ Result: 2 successful, 1 failed
├─ [View Details] [Retry Failed] [Archive]
```

### 4. Batch Results Summary

```
Batch: "Auckland Q4"  ✓ Completed
Duration: 47m 23s

┌─ Summary ─────────────────────┐
│ Total:       3                │
│ Successful:  2 (67%)          │
│ Failed:      1 (33%)          │
└───────────────────────────────┘

┌─ Results ─────────────────────────────────────────┐
│ Pizza Palace    ✓ Complete                        │
│ Burger House    ✗ Failed (CSV Upload error)       │
│ Chicken Shop    ✓ Complete                        │
└───────────────────────────────────────────────────┘

[Export Results] [Retry Failed] [Restart Batch]
```

---

## Failure Handling Strategies

### Per-Step Retry Logic

```javascript
{
  max_retries: 3,
  retry_backoff: 'exponential',  // 2s, 4s, 8s
  on_max_retries: 'fail_job',
  skip_subsequent_on_failure: true
}
```

### Restaurant-Level Handling

If a restaurant job fails:
1. Mark `registration_jobs.status = 'failed'`
2. Store error message with context
3. **Continue with next restaurant** (don't block batch)
4. Update batch: `failed_restaurants++`

### Batch-Level Decisions

```
- Step fails → auto-retry (step-level)
- All retries fail → mark restaurant failed, continue (job-level)
- If >50% fail → PAUSE batch, alert user
- User can: resume, cancel, or retry failed
```

### Retry Mechanisms

**Deferred Retry:**
```
Initial Batch: 3 restaurants
├─ R1: ✓ complete
├─ R2: ✗ failed at step 4
└─ R3: ✓ complete

"Retry Failed" creates:
┌─ Retry Batch: "Auckland Q4 - Retry"
├─ R2: start from step 4 (where it failed)
```

---

## API Endpoints for Batch Mode

### Batch Management

```
POST /registration-batches
Body: { restaurant_ids: [], common_config: {} }
Response: { batch_id, jobs_count }

GET /registration-batches
Query: status, created_after, limit
Response: [{ id, name, status, total, completed, failed }]

GET /registration-batches/:id
Response: Full batch with all jobs and steps

POST /registration-batches/:id/start
Response: { started_at, first_job_id }

POST /registration-batches/:id/pause
Response: { paused_at }

POST /registration-batches/:id/cancel
Response: { cancelled_at }

POST /registration-batches/:id/retry-failed
Response: { new_batch_id }
```

---

## Sequential vs Parallel Execution

### Phase 1: Sequential (Initial Implementation)

```
Timeline:
[R1 fully] → [R2 fully] → [R3 fully]
   45m          45m          45m
Total: ~135 minutes for 3 restaurants

Pros: Simpler, easier debugging, lower resources
Cons: Longer total time
```

### Phase 2: Parallel (Future Enhancement)

```
Timeline:
[R1] [R2] [R3] (all steps parallel)
     45m
Total: ~45 minutes for 3 restaurants

Requires: Queue system (Bull/Redis), concurrent handlers
```

**Design Decision:** Schema supports both modes via `execution_mode` field.

---

## Backward Compatibility

### Option A: Implicit Batches (Recommended)

```
- Single registration → create batch with 1 restaurant
- batch_jobs.name = "Single: {restaurant_name}"
- All queries use same batch context
- Consistent querying experience
```

### Option B: Nullable Batch ID

```
- registration_jobs.batch_job_id nullable
- Single registrations: batch_job_id = NULL
- Requires two code paths
```

---

## Extensibility Points

### Future Features

1. **Template-Based Batch Creation**
   - "Register all 'hot' leads from Auckland"
   - Save as reusable template

2. **Scheduled Batch Execution**
   - "Register 5 restaurants every Monday 9 AM"
   - Requires cron/scheduler service

3. **Conditional Step Logic**
   - Skip step if prerequisite failed
   - `depends_on_step`, `skip_if_failed` fields

4. **Webhook Integration**
   - Notify on batch complete
   - CRM integration, Slack notifications

5. **Custom Step Handlers**
   - Different handlers per restaurant type
   - Third-party integrations

---

## Key Architectural Decisions

| Decision | Approach | Rationale |
|----------|----------|-----------|
| Hierarchy | Batch → Jobs → Steps | Mirrors proven lead scrape pattern |
| Step Count | 12 steps | Consistent with existing YoloMode |
| Execution | Sequential (v1) | Simpler, with parallel framework ready |
| Failure | Per-step retry + job-level skip | Respects limits, enables control |
| Status | Separate tables | Granular tracking, efficient queries |
| Backward Compat | Implicit batches | All queries use same pattern |

---

## Implementation Roadmap

### Phase 1: Current (Completed)
- Single restaurant YoloModeDialog
- 12-step execution

### Phase 2: Batch Infrastructure
- Create batch tables
- Add selection UI to Restaurants page
- Create `/registration-batches` page
- Sequential batch execution

### Phase 3: Batch Features
- Pause/resume
- Retry failed
- Templates & saving

### Phase 4: Advanced
- Parallel execution
- Webhooks
- Scheduled execution
