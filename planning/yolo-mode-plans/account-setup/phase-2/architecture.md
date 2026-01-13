# Architecture: Phase 2 - Registration Batch Orchestration

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │RegistrationBatches│  │RegistrationBatch │  │  CompanySelection │          │
│  │      Page         │  │   Detail Page    │  │      View        │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│  ┌────────▼─────────────────────▼─────────────────────▼─────────┐          │
│  │                     React Query Hooks                         │          │
│  │  useRegistrationBatch() │ useRegistrationBatches() │ mutations │          │
│  └──────────────────────────────┬───────────────────────────────┘          │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │ HTTP/Polling (5-30s)
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                              BACKEND                                        │
│  ┌──────────────────────────────▼───────────────────────────────┐          │
│  │                    Express Routes                             │          │
│  │  /api/registration-batches  │  /api/registration-jobs        │          │
│  └──────────────────────────────┬───────────────────────────────┘          │
│                                 │                                           │
│  ┌──────────────────────────────▼───────────────────────────────┐          │
│  │                    Service Layer                              │          │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │          │
│  │  │ Registration   │  │  Registration  │  │  Companies     │  │          │
│  │  │ Batch Service  │  │  Step Service  │  │  Office Batch  │  │          │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘  │          │
│  │          │ setImmediate()    │                   │           │          │
│  │          ▼                   ▼                   ▼           │          │
│  │  ┌──────────────────────────────────────────────────────┐    │          │
│  │  │              Step Processors                          │    │          │
│  │  │  Step1: Extraction │ Step2: Search │ Step6: Yolo      │    │          │
│  │  └──────────────────────────────────────────────────────┘    │          │
│  └──────────────────────────────┬───────────────────────────────┘          │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                              DATABASE                                       │
│  ┌──────────────────────────────▼───────────────────────────────┐          │
│  │                       Supabase                                │          │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │          │
│  │  │registration_batch│  │ registration_jobs │                  │          │
│  │  │     _jobs        │──│                   │                  │          │
│  │  └──────────────────┘  └────────┬─────────┘                  │          │
│  │                                 │                             │          │
│  │  ┌──────────────────┐  ┌───────▼──────────┐                  │          │
│  │  │companies_office_ │  │registration_job_ │                  │          │
│  │  │search_candidates │  │     steps        │                  │          │
│  │  └──────────────────┘  └──────────────────┘                  │          │
│  └──────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
UberEats-Image-Extractor/
├── src/
│   ├── pages/
│   │   ├── RegistrationBatches.tsx        # Batch list page
│   │   └── RegistrationBatchDetail.tsx    # Single batch view
│   │
│   ├── components/
│   │   └── registration-batch/
│   │       ├── BatchProgressCard.tsx      # Progress card for list
│   │       ├── BatchStepList.tsx          # Step progress table
│   │       ├── BatchRestaurantTable.tsx   # Restaurant status table
│   │       ├── CompanySelectionView.tsx   # Step 3 action UI
│   │       ├── YoloConfigBatchView.tsx    # Step 5 action UI
│   │       └── SubStepProgress.tsx        # Step 6 sub-step display
│   │
│   ├── hooks/
│   │   ├── useRegistrationBatch.ts        # Single batch query + polling
│   │   ├── useRegistrationBatches.ts      # Batch list query
│   │   └── useRegistrationBatchMutations.ts # Mutations
│   │
│   ├── services/
│   │   ├── registration-batch-service.js  # Core batch orchestration
│   │   ├── registration-job-service.js    # Per-job management
│   │   ├── registration-step-service.js   # Step execution
│   │   └── companies-office-batch-service.js # Batch contact extraction
│   │
│   └── routes/
│       └── registration-batch-routes.js   # API endpoints
│
├── supabase/
│   └── migrations/
│       └── YYYYMMDD_add_registration_batch_tables.sql
│
└── planning/
    └── yolo-mode-plans/
        └── account-setup/
            ├── phase-2/                   # THIS DOCUMENTATION
            └── investigations/phase-2/    # Investigation findings
```

---

## Data Flow

### 1. Batch Creation Flow

```
PendingLeadsTable.tsx
        │
        │ [Convert with Batch]
        ▼
POST /api/leads/convert
  { create_registration_batch: true }
        │
        ▼
leads-routes.js
        │
        ▼
leadScrapeService.convertLeadsToRestaurants()
        │
        ├─ Create restaurant records
        ├─ Mark leads as converted
        │
        ▼
registrationBatchService.createRegistrationBatchJob()
        │
        ├─ INSERT registration_batch_jobs
        ├─ INSERT registration_jobs (per restaurant)
        └─ INSERT registration_job_steps (6 per job)
        │
        ▼
Return { restaurants, registration_batch }
        │
        ▼
Navigate to /registration-batches/:id
```

### 2. Step Execution Flow

```
POST /api/registration-batches/:id/start
        │
        ▼
registrationBatchService.startBatchJob()
        │
        ├─ UPDATE batch status = 'in_progress'
        │
        ▼
setImmediate(processStep1)
        │
        ▼
Step 1: Track extraction completion
        │
        ├─ Poll extraction job status
        ├─ UPDATE step status = 'completed'
        │
        ▼
Step 2: Run contact search (automatic)
        │
        ├─ companiesOfficeBatchService.searchForRestaurant()
        ├─ INSERT companies_office_search_candidates
        ├─ UPDATE step status = 'action_required'
        │
        ▼
[PAUSE - Wait for user action]
        │
        ▼
POST /steps/3/complete { selections }
        │
        ▼
Step 3: Save selections
        │
        ├─ UPDATE search candidates
        ├─ UPDATE step status = 'completed'
        │
        ▼
setImmediate(processStep4)
        │
        ▼
Step 4: Extract company details (automatic)
        │
        ├─ Extract and save to restaurant
        ├─ UPDATE step status = 'completed'
        │
        ▼
[PAUSE - Wait for user action]
        │
        ▼
POST /steps/5/complete { configurations }
        │
        ▼
Step 5: Save yolo configs
        │
        ├─ UPDATE registration_jobs.execution_config
        ├─ UPDATE step status = 'completed'
        │
        ▼
setImmediate(processStep6)
        │
        ▼
Step 6: Execute Yolo Mode (12 sub-steps)
        │
        ├─ For each sub-step:
        │   ├─ UPDATE sub_step_progress
        │   ├─ Execute handler
        │   └─ Track result
        │
        ├─ UPDATE job status = 'completed'
        ├─ UPDATE batch completed_restaurants++
        │
        ▼
All restaurants done → UPDATE batch status = 'completed'
```

### 3. Frontend Polling Flow

```
RegistrationBatchDetail.tsx
        │
        ▼
useRegistrationBatch(batchId)
        │
        ├─ queryKey: ['registration-batch', batchId]
        ├─ refetchInterval: 5000 (active) | 10000 (idle) | false (done)
        │
        ▼
GET /api/registration-batches/:id
        │
        ▼
Render batch progress
        │
        ├─ If step.status === 'action_required'
        │   └─ Show action UI (CompanySelectionView, YoloConfigView)
        │
        └─ Else show progress indicators
```

---

## Service Layer Architecture

### Registration Batch Service

```
┌─────────────────────────────────────────────────────────────┐
│              registration-batch-service.js                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Batch Lifecycle:                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  create  │───▶│  start   │───▶│ process  │──┐           │
│  └──────────┘    └──────────┘    └──────────┘  │           │
│                                       │        │           │
│                                       ▼        │           │
│                              ┌──────────┐      │           │
│                              │ complete │◀─────┘           │
│                              └──────────┘                   │
│                                    │                        │
│                       ┌────────────┼────────────┐          │
│                       ▼            ▼            ▼          │
│                 ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│                 │completed │ │  failed  │ │cancelled │     │
│                 └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
│  Step Processors:                                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ processStep1() │ processStep2() │ processStep4() │    │ │
│  │ processStep6() │ completeStep3() │ completeStep5()│    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Async Execution Pattern

```javascript
// setImmediate() pattern for background processing
router.post('/:id/start', async (req, res) => {
  // 1. Validate and update status synchronously
  await updateBatchStatus(batchId, 'in_progress');

  // 2. Return response immediately
  res.json({ success: true, status: 'in_progress' });

  // 3. Process steps asynchronously
  setImmediate(async () => {
    try {
      await processStep1(batchId);
    } catch (error) {
      await handleBatchError(batchId, error);
    }
  });
});
```

---

## Error Handling

### Step-Level Retry

```
Step Execution
     │
     ├─ Try execute
     │   │
     │   ├─ Success → Mark completed
     │   │
     │   └─ Failure
     │       │
     │       ├─ retry_count < max_retries
     │       │   └─ Wait (exponential backoff) → Retry
     │       │
     │       └─ retry_count >= max_retries
     │           └─ Mark failed
```

### Batch-Level Error Handling

```
Job Failure
     │
     ├─ Mark job as failed
     ├─ Increment batch.failed_restaurants
     │
     ├─ If failure_rate > 50%
     │   └─ Mark batch as failed
     │
     └─ Else continue with remaining restaurants
```

---

## Security Considerations

### Row Level Security (RLS)

All tables use RLS policies based on `organisation_id`:

```sql
-- Users can only see their org's batches
CREATE POLICY "org_isolation" ON registration_batch_jobs
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);
```

### API Authentication

```javascript
// All routes require authentication
router.use(authMiddleware);

// Organisation validation
router.param('batchId', async (req, res, next, batchId) => {
  const batch = await getBatchJob(batchId);
  if (batch.organisation_id !== req.user.organisation_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.batch = batch;
  next();
});
```

---

## Performance Considerations

### Polling Optimization

```typescript
// Dynamic polling intervals based on state
refetchInterval: (query) => {
  const batch = query.state.data?.batch_job;

  // Stop polling when done
  if (['completed', 'failed', 'cancelled'].includes(batch?.status)) {
    return false;
  }

  // Faster polling during active execution
  return batch?.status === 'in_progress' ? 5000 : 10000;
}
```

### Batch Size Limits

```javascript
// Limit restaurants per batch to prevent overload
const MAX_RESTAURANTS_PER_BATCH = 50;

if (restaurant_ids.length > MAX_RESTAURANTS_PER_BATCH) {
  throw new Error(`Maximum ${MAX_RESTAURANTS_PER_BATCH} restaurants per batch`);
}
```

### Sequential Execution

Phase 1 uses sequential execution (one restaurant at a time in Step 6) to:
- Avoid rate limiting from external APIs
- Simplify debugging and error handling
- Ensure predictable resource usage

---

## Integration Points

### Authentication (Existing)

- `authMiddleware` validates JWT and sets `req.user`
- `req.user.organisation_id` used for data isolation

### Database Service (Existing)

- Supabase client from `database-service.js`
- Connection pooling handled by Supabase

### Existing Services

| Service | Integration |
|---------|-------------|
| `lead-scrape-service.js` | Extended for batch creation |
| `companies-office-service.js` | Wrapped by batch service |
| `registration-service.js` | Called from Step 6 handlers |
| `onboarding-service.js` | Called from Step 6 handlers |

### UI Framework (Existing)

- React with TypeScript
- Tailwind CSS + shadcn/ui components
- React Query for data fetching
- React Router for navigation

---

## Testing Strategy

### Unit Tests

```
src/services/__tests__/
├── registration-batch-service.test.js
├── registration-step-service.test.js
└── companies-office-batch-service.test.js
```

### Integration Tests

```
src/routes/__tests__/
└── registration-batch-routes.test.js
```

### E2E Tests

```
tests/e2e/
└── registration-batch-flow.spec.ts
```

### Test Scenarios

1. **Happy Path**: Create batch → Start → Complete all steps
2. **Action Required**: Verify pause at Steps 3 and 5
3. **Partial Failure**: Some restaurants fail, batch continues
4. **Cancellation**: Cancel mid-execution
5. **Retry**: Retry failed restaurant
6. **Polling**: Verify frontend updates during execution
