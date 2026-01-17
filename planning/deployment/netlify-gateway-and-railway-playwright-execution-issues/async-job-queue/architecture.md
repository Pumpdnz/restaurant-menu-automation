# Architecture: Async Script Job Queue

**Last Updated**: 2025-12-09
**Status**: Planned

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   React App     │    │  useCreateJob   │    │  useJobPolling  │          │
│  │   (Netlify)     │───▶│     Hook        │───▶│     Hook        │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│           │                      │                      │                    │
│           │              POST /api/jobs         GET /api/jobs/:id/status    │
│           │                      │                      │                    │
└───────────┼──────────────────────┼──────────────────────┼────────────────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (Railway)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Express Server                               │    │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │    │
│  │  │  job-routes.js  │    │ registration-   │    │   Middleware    │  │    │
│  │  │                 │    │   routes.js     │    │  (auth, cors)   │  │    │
│  │  │  POST /jobs     │    │  (deprecated)   │    │                 │  │    │
│  │  │  GET /jobs/:id  │    │                 │    │                 │  │    │
│  │  │  DELETE /jobs   │    │                 │    │                 │  │    │
│  │  └────────┬────────┘    └─────────────────┘    └─────────────────┘  │    │
│  └───────────┼──────────────────────────────────────────────────────────┘    │
│              │                                                               │
│              ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      SERVICE LAYER                                   │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │              ScriptJobService                                │    │    │
│  │  │                                                              │    │    │
│  │  │  createJob()      - Create job record, return immediately    │    │    │
│  │  │  getJob()         - Fetch job details                        │    │    │
│  │  │  updateProgress() - Update job progress                      │    │    │
│  │  │  markComplete()   - Mark job as done                         │    │    │
│  │  │  markFailed()     - Handle failures with retry logic         │    │    │
│  │  │                                                              │    │    │
│  │  └──────────────────────────┬──────────────────────────────────┘    │    │
│  │                             │                                        │    │
│  └─────────────────────────────┼────────────────────────────────────────┘    │
│                                │                                             │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            │                                         │
            ▼                                         ▼
┌───────────────────────────┐           ┌────────────────────────────────────┐
│      DATABASE LAYER       │           │          WORKER LAYER               │
│  ┌─────────────────────┐  │           │  ┌──────────────────────────────┐  │
│  │      Supabase       │  │           │  │     Job Queue Worker         │  │
│  │                     │  │           │  │                              │  │
│  │  ┌───────────────┐  │  │           │  │  processJobQueue()           │  │
│  │  │  script_jobs  │◀─┼──┼───────────┼──│  - Poll for pending jobs     │  │
│  │  │               │  │  │           │  │  - Claim job atomically      │  │
│  │  │  id           │  │  │           │  │  - Execute Playwright script │  │
│  │  │  job_id       │  │  │           │  │  - Update status/result      │  │
│  │  │  job_type     │  │  │           │  │  - Handle errors/retries     │  │
│  │  │  status       │  │  │           │  │                              │  │
│  │  │  payload      │  │  │           │  │  cleanupStalledJobs()        │  │
│  │  │  result       │  │  │           │  │  recoverOrphanedJobs()       │  │
│  │  │  progress     │  │  │           │  │                              │  │
│  │  │  ...          │  │  │           │  └──────────────┬───────────────┘  │
│  │  └───────────────┘  │  │           │                 │                  │
│  │                     │  │           │                 │                  │
│  └─────────────────────┘  │           │                 ▼                  │
│                           │           │  ┌──────────────────────────────┐  │
└───────────────────────────┘           │  │    Playwright Scripts        │  │
                                        │  │                              │  │
                                        │  │  add-item-tags.js            │  │
                                        │  │  add-option-sets.js          │  │
                                        │  │  import-csv-menu.js          │  │
                                        │  │  login-and-register-restaurant.js │
                                        │  │  edit-website-settings-*.js  │  │
                                        │  │  setup-stripe-payments*.js   │  │
                                        │  │  setup-services-settings.js  │  │
                                        │  │  create-api-key-user.js      │  │
                                        │  │  finalise-onboarding-user.js │  │
                                        │  │                              │  │
                                        │  └──────────────────────────────┘  │
                                        │                                    │
                                        └────────────────────────────────────┘
```

---

## Directory Structure

```
automation/
├── UberEats-Image-Extractor/
│   ├── server.js                           # Express server entry
│   ├── src/
│   │   ├── routes/
│   │   │   ├── job-routes.js               # NEW: Job queue API routes
│   │   │   ├── registration-routes.js      # MODIFY: Deprecate sync endpoints
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── script-job-service.js       # NEW: Core job service
│   │   │   ├── database-service.js         # Existing DB service
│   │   │   └── api.js                      # MODIFY: Add job API methods
│   │   ├── hooks/
│   │   │   ├── useJobPolling.js            # NEW: Polling hook
│   │   │   ├── useCreateJob.js             # NEW: Job creation hook
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── JobStatusCard.jsx           # NEW: Status display
│   │   │   ├── JobProgressBar.jsx          # NEW: Progress bar
│   │   │   └── ...
│   │   └── lib/
│   │       └── supabase.js                 # Supabase client
│   └── worker.js                           # NEW: Background worker entry
│
├── scripts/
│   ├── restaurant-registration/
│   │   ├── add-item-tags.js                # Playwright script
│   │   ├── add-option-sets.js              # Playwright script
│   │   ├── import-csv-menu.js              # Playwright script
│   │   └── login-and-register-restaurant.js # Restaurant registration
│   │
│   ├── edit-website-settings-dark.js       # Website config (dark theme)
│   ├── edit-website-settings-light.js      # Website config (light theme)
│   ├── setup-stripe-payments.js            # Payment setup with Stripe link
│   ├── setup-stripe-payments-no-link.js    # Payment setup without Stripe link
│   ├── setup-services-settings.js          # Services configuration
│   ├── setup-system-settings-user.js       # System settings
│   ├── create-api-key-user.js              # API key creation
│   ├── finalise-onboarding-user.js         # Finalise onboarding
│   │
│   └── lib/
│       ├── browser-config.cjs              # Browser launch config
│       └── browser-config.mjs              # ESM version
│
├── supabase/
│   └── migrations/
│       └── 20251209120000_create_script_jobs_table.sql  # NEW
│
└── planning/
    └── deployment/
        └── netlify-gateway-and-railway-playwright-execution-issues/
            └── async-job-queue/            # This documentation
```

---

## Data Flow

### Job Creation Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │  API Route   │     │  JobService  │     │   Database   │
│              │     │              │     │              │     │              │
│  User clicks │     │              │     │              │     │              │
│  "Submit"    │     │              │     │              │     │              │
│      │       │     │              │     │              │     │              │
│      ▼       │     │              │     │              │     │              │
│  POST /jobs  │────▶│ Validate     │     │              │     │              │
│  {           │     │ request      │     │              │     │              │
│   jobType,   │     │      │       │     │              │     │              │
│   payload    │     │      ▼       │     │              │     │              │
│  }           │     │ createJob()  │────▶│ Insert job   │────▶│ script_jobs  │
│              │     │              │     │ record       │     │ status:      │
│              │     │              │     │      │       │     │ 'pending'    │
│              │     │              │◀────│◀─────┘       │     │              │
│              │     │      │       │     │              │     │              │
│              │◀────│ 202 Accepted │     │              │     │              │
│  {           │     │ {            │     │              │     │              │
│   jobId,     │     │  jobId,      │     │              │     │              │
│   status     │     │  status      │     │              │     │              │
│  }           │     │ }            │     │              │     │              │
│              │     │              │     │              │     │              │
│  Start       │     │              │     │              │     │              │
│  polling     │     │              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘

        Response time: < 100ms (vs 2-5 minutes previously)
```

### Job Execution Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Database   │     │   Worker     │     │  Playwright  │     │   Target     │
│              │     │              │     │   Script     │     │   Site       │
│              │     │              │     │              │     │              │
│ script_jobs  │     │ Poll every   │     │              │     │              │
│              │◀────│ 2 seconds    │     │              │     │              │
│              │     │      │       │     │              │     │              │
│ status:      │     │      ▼       │     │              │     │              │
│ 'pending'    │────▶│ Claim job    │     │              │     │              │
│              │     │ atomically   │     │              │     │              │
│              │     │      │       │     │              │     │              │
│ status:      │◀────│──────┘       │     │              │     │              │
│ 'in_progress'│     │              │     │              │     │              │
│              │     │ Execute      │     │              │     │              │
│              │     │ script       │────▶│ Launch       │     │              │
│              │     │              │     │ browser      │     │              │
│              │     │              │     │      │       │     │              │
│ Update       │◀────│──────────────│◀────│ Progress     │────▶│ Login        │
│ progress     │     │              │     │ update       │     │ Navigate     │
│              │     │              │     │      │       │     │ Fill forms   │
│              │     │              │     │      │       │◀────│ Submit       │
│              │     │              │     │      │       │     │              │
│              │     │              │◀────│ Complete     │     │              │
│              │     │      │       │     │              │     │              │
│ status:      │◀────│──────┘       │     │              │     │              │
│ 'completed'  │     │              │     │              │     │              │
│ result: {...}│     │              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Polling Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │  API Route   │     │   Database   │
│              │     │              │     │              │
│ useJobPolling│     │              │     │              │
│      │       │     │              │     │              │
│      ▼       │     │              │     │              │
│ GET /status  │────▶│ getJob()     │────▶│ SELECT       │
│ (every 2s)   │     │              │     │ FROM jobs    │
│              │◀────│◀─────────────│◀────│ WHERE id=?   │
│              │     │              │     │              │
│ status:      │     │              │     │              │
│ 'in_progress'│     │              │     │              │
│ progress: 40%│     │              │     │              │
│      │       │     │              │     │              │
│      ▼       │     │              │     │              │
│ Update UI    │     │              │     │              │
│      │       │     │              │     │              │
│ (wait 2s)    │     │              │     │              │
│      │       │     │              │     │              │
│      ▼       │     │              │     │              │
│ GET /status  │────▶│              │────▶│              │
│              │◀────│◀─────────────│◀────│              │
│              │     │              │     │              │
│ status:      │     │              │     │              │
│ 'completed'  │     │              │     │              │
│      │       │     │              │     │              │
│      ▼       │     │              │     │              │
│ GET /jobs/id │────▶│ Full details │────▶│              │
│              │◀────│◀─────────────│◀────│              │
│              │     │              │     │              │
│ Show result  │     │              │     │              │
│ Stop polling │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Error Handling Architecture

### Error Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ERROR CLASSIFICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     RETRYABLE ERRORS                                 │    │
│  │                                                                      │    │
│  │  • ETIMEDOUT        - Network timeout                                │    │
│  │  • ECONNRESET       - Connection reset                               │    │
│  │  • ECONNREFUSED     - Connection refused                             │    │
│  │  • TIMEOUT          - Script timeout                                 │    │
│  │  • NAVIGATION_TIMEOUT - Page load timeout                            │    │
│  │  • ELEMENT_NOT_FOUND - DOM element not found (transient)             │    │
│  │  • RATE_LIMITED     - Too many requests                              │    │
│  │  • WORKER_DIED      - Process crashed                                │    │
│  │                                                                      │    │
│  │  Retry Strategy: Exponential backoff                                 │    │
│  │  Base delay: 5 seconds                                               │    │
│  │  Max retries: 3                                                      │    │
│  │  Delay formula: base * 2^(attempt-1)                                 │    │
│  │  → 5s → 10s → 20s                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                   NON-RETRYABLE ERRORS                               │    │
│  │                                                                      │    │
│  │  • AUTH_FAILED       - Invalid credentials                           │    │
│  │  • INVALID_CREDENTIALS - Bad username/password                       │    │
│  │  • VALIDATION_ERROR  - Invalid input data                            │    │
│  │  • RESTAURANT_NOT_FOUND - Restaurant doesn't exist                   │    │
│  │  • PERMISSION_DENIED - Access denied                                 │    │
│  │                                                                      │    │
│  │  Action: Mark job as failed permanently                              │    │
│  │  User notification required                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Recovery Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Script     │     │   Service    │     │   Database   │
│  Execution   │     │              │     │              │
│      │       │     │              │     │              │
│   ERROR      │     │              │     │              │
│      │       │     │              │     │              │
│      ▼       │     │              │     │              │
│ Catch error  │────▶│ Classify     │     │              │
│              │     │ error        │     │              │
│              │     │      │       │     │              │
│              │     │      ▼       │     │              │
│              │     │ Retryable?   │     │              │
│              │     │  │      │    │     │              │
│              │     │  ▼      ▼    │     │              │
│              │     │ YES    NO    │     │              │
│              │     │  │      │    │     │              │
│              │     │  ▼      ▼    │     │              │
│              │     │ retry  mark  │     │              │
│              │     │ count  failed│     │              │
│              │     │ < max? │     │     │              │
│              │     │  │     │     │     │              │
│              │     │  ▼     │     │     │              │
│              │     │ YES────┼─────│────▶│ status:      │
│              │     │  │     │     │     │ 'failed'     │
│              │     │  │     │     │     │ retry=false  │
│              │     │  ▼     │     │     │              │
│              │     │ Set    │     │     │              │
│              │     │ next   │     │     │              │
│              │     │ retry  │     │     │              │
│              │     │ time   │     │     │              │
│              │     │  │     │     │     │              │
│              │     │  ▼     │     │     │              │
│              │     │ Update │     │────▶│ status:      │
│              │     │        │     │     │ 'pending'    │
│              │     │        │     │     │ retry_count++│
│              │     │        │     │     │ next_retry_at│
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Security Considerations

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. API Authentication (JWT)                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │  All /api/jobs endpoints require valid JWT token                 │     │
│     │  Token verified by Supabase auth middleware                      │     │
│     │  User context extracted from token                               │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  2. Row Level Security (RLS)                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │  Users can only access jobs for their organisation               │     │
│     │  Jobs filtered by organisation_id via user_organisations join    │     │
│     │  Service role bypasses RLS for worker operations                 │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  3. Input Validation                                                         │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │  Job type must be in allowed enum                                │     │
│     │  Payload validated against job-type-specific schema              │     │
│     │  Sensitive fields (passwords) never logged                       │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  4. Credential Security                                                      │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │  Script payloads stored in database (encrypted at rest)          │     │
│     │  Temporary payload files deleted after execution                 │     │
│     │  Passwords not included in result/error output                   │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Concurrency Control

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONCURRENCY LIMITS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Worker Configuration:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  maxConcurrentJobs: 2                                                │    │
│  │                                                                      │    │
│  │  Rationale:                                                          │    │
│  │  - Each Playwright instance uses ~200-500MB RAM                      │    │
│  │  - Railway container has limited resources                           │    │
│  │  - 2 concurrent jobs balances throughput vs. stability               │    │
│  │                                                                      │    │
│  │  Scaling Strategy:                                                   │    │
│  │  - Can deploy multiple worker containers                             │    │
│  │  - Each worker has unique ID for job claiming                        │    │
│  │  - Atomic claim prevents double-processing                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Database Query Optimization:                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Queue Processing Index:                                             │    │
│  │  CREATE INDEX idx_script_jobs_queue_processing                       │    │
│  │    ON script_jobs (status, priority DESC, created_at ASC)            │    │
│  │    WHERE status IN ('pending', 'queued');                            │    │
│  │                                                                      │    │
│  │  This index makes queue polling O(1) instead of full table scan      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Polling Intervals:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Worker polling: 2 seconds (when no jobs)                            │    │
│  │  Client polling: 2s → 5s → 10s (dynamic based on age)                │    │
│  │  Background tab: Polling paused (refetchIntervalInBackground: false) │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Supabase Integration

```javascript
// Service Role Client (for worker - bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// User Client (for API routes - respects RLS)
const supabaseUser = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
```

### Express Middleware

```javascript
// job-routes.js integration with server.js
const jobRoutes = require('./src/routes/job-routes');

// Mount job routes
app.use('/api/jobs', authMiddleware, jobRoutes);
```

### TanStack Query Integration

```javascript
// QueryClient configuration for job polling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,           // Jobs always need fresh data
      refetchOnWindowFocus: true,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
});
```

---

## Testing Strategy

### Unit Tests

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UNIT TEST COVERAGE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ScriptJobService:                                                           │
│  ├── createJob()        - Validate job creation with all job types           │
│  ├── getJob()           - Test job retrieval and formatting                  │
│  ├── updateJobStatus()  - Test status transitions                            │
│  ├── updateJobProgress() - Test progress updates                             │
│  ├── markJobFailed()    - Test retry logic and error classification          │
│  ├── cancelJob()        - Test cancellation rules                            │
│  ├── claimNextJob()     - Test atomic claiming                               │
│  ├── parseScriptOutput() - Test output parsing for each job type             │
│  └── classifyError()    - Test error code classification                     │
│                                                                              │
│  API Routes:                                                                 │
│  ├── POST /api/jobs     - Test job creation, validation                      │
│  ├── GET /api/jobs/:id  - Test job retrieval, auth                           │
│  ├── GET /api/jobs/:id/status - Test status endpoint                         │
│  ├── DELETE /api/jobs/:id - Test cancellation                                │
│  └── GET /api/jobs      - Test listing, filtering, pagination                │
│                                                                              │
│  Hooks:                                                                      │
│  ├── useJobPolling      - Test polling intervals, terminal states            │
│  └── useCreateJob       - Test job creation flow                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Integration Tests

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION TEST SCENARIOS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Full Job Lifecycle                                                       │
│     Create job → Poll status → Verify completion → Check result              │
│                                                                              │
│  2. Error Recovery                                                           │
│     Create job → Simulate timeout → Verify retry → Complete                  │
│                                                                              │
│  3. Concurrent Jobs                                                          │
│     Create 3 jobs → Verify only 2 run at once → All complete                 │
│                                                                              │
│  4. Job Cancellation                                                         │
│     Create job → Cancel before execution → Verify cancelled                  │
│                                                                              │
│  5. Orphan Recovery                                                          │
│     Create job → Mark in_progress → Stop worker → Start new worker           │
│     → Verify job recovered                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Monitoring & Observability

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `jobs_pending_count` | Number of pending jobs | > 10 |
| `jobs_failed_count` | Failed jobs (24h) | > 5 |
| `job_duration_avg` | Average job duration | > 3 min |
| `job_success_rate` | Completion rate | < 90% |
| `queue_wait_time` | Time from create to start | > 5 min |

### Logging

```javascript
// Structured logging for job lifecycle
console.log(JSON.stringify({
  event: 'job_created',
  jobId: job.job_id,
  jobType: job.job_type,
  timestamp: new Date().toISOString(),
}));

console.log(JSON.stringify({
  event: 'job_completed',
  jobId: job.job_id,
  duration: completedAt - startedAt,
  success: true,
}));

console.log(JSON.stringify({
  event: 'job_failed',
  jobId: job.job_id,
  errorCode: error.code,
  retryable: isRetryable,
  retryCount: job.retry_count,
}));
```
