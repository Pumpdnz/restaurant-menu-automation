# Implementation Roadmap: Async Script Job Queue

**Last Updated**: 2025-12-09
**Status**: Not Started
**Target Completion**: 4-5 days (estimated)

## Overview

This roadmap outlines the step-by-step implementation of the async job queue pattern to solve the Netlify gateway timeout issue. The implementation is divided into 4 phases, each with specific deliverables and validation criteria.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Database Setup | Not Started | |
| Phase 2: Backend Service & Routes | Not Started | |
| Phase 3: Frontend Integration | Not Started | |
| Phase 4: Cleanup & Monitoring | Not Started | |

---

## Prerequisites

Before starting implementation:

- [ ] Ensure Railway Playwright execution issue is resolved (✅ Done - User-Agent fix)
- [ ] Verify Supabase project access and credentials
- [ ] Review existing `registration-routes.js` endpoints
- [ ] Backup current database schema
- [ ] Create development branch for implementation

---

## Phase 1: Database Setup (Day 1)

### Objective
Create the `script_jobs` table with all required columns, indexes, and RLS policies.

### Tasks

#### 1.1 Create Migration File
- [ ] Create migration file: `supabase/migrations/20251209120000_create_script_jobs_table.sql`
- [ ] Include table creation SQL
- [ ] Include enum types for `script_job_status` and `script_job_type`
- [ ] Include all column definitions

```sql
-- Key columns:
-- id (UUID), job_id (TEXT), job_type (ENUM), status (ENUM)
-- input_payload (JSONB), result (JSONB), error_message (TEXT)
-- progress_percent, progress_message, current_step, total_steps
-- retry_count, max_retries, next_retry_at
-- created_at, started_at, completed_at, updated_at
-- organisation_id, restaurant_id, created_by
```

#### 1.2 Create Indexes
- [ ] Queue processing index (status, priority, created_at)
- [ ] Active jobs index (status = 'in_progress')
- [ ] Failed jobs index
- [ ] Retryable jobs index (next_retry_at)
- [ ] Job type filtering index
- [ ] Organisation filtering index
- [ ] Restaurant filtering index
- [ ] User jobs index
- [ ] Timeout detection index
- [ ] Job ID lookup index

#### 1.3 Create Triggers
- [ ] Auto-update `updated_at` trigger
- [ ] Set `timeout_at` when job starts trigger
- [ ] Set `completed_at` on terminal status trigger

#### 1.4 Enable Row Level Security
- [ ] Enable RLS on `script_jobs` table
- [ ] Create "Users can view organisation jobs" policy
- [ ] Create "Users can create organisation jobs" policy
- [ ] Create "Users can cancel own pending jobs" policy
- [ ] Create "Service role full access" policy

#### 1.5 Create Monitoring Views
- [ ] `script_jobs_queue_status` view
- [ ] `script_jobs_failed_summary` view
- [ ] `script_jobs_metrics` view

#### 1.6 Apply Migration
- [ ] Run migration locally: `supabase db push`
- [ ] Verify table structure in Supabase dashboard
- [ ] Test insert and query operations

### Validation Checklist
- [ ] Table exists with all columns
- [ ] All indexes created
- [ ] Triggers functioning (test updated_at)
- [ ] RLS policies working (test with different user contexts)
- [ ] Views returning correct data

---

## Phase 2: Backend Service & Routes (Day 2-3)

### Objective
Create the ScriptJobService and job-routes API endpoints.

### Tasks

#### 2.1 Create ScriptJobService
- [ ] Create file: `UberEats-Image-Extractor/src/services/script-job-service.js`
- [ ] Define JOB_TYPES configuration mapping
- [ ] Define RETRYABLE_ERROR_CODES and NON_RETRYABLE_ERROR_CODES
- [ ] Implement ScriptJobService class

**Core Methods:**
- [ ] `createJob(jobType, payload, options)` - Create new job
- [ ] `getJob(jobId)` - Get job by human-readable ID
- [ ] `getJobByUuid(uuid)` - Get job by UUID
- [ ] `updateJobStatus(jobId, status, updates)` - Update status
- [ ] `updateJobProgress(jobId, progress)` - Update progress
- [ ] `updateJobResult(jobId, result)` - Mark completed with result
- [ ] `markJobFailed(jobId, error, retryable)` - Handle failures
- [ ] `cancelJob(jobId)` - Cancel pending job

**Query Methods:**
- [ ] `listJobs(filters, pagination)` - List with filtering
- [ ] `getPendingJobs(limit)` - Get jobs ready for processing
- [ ] `getRetryableJobs()` - Get jobs due for retry

**Worker Methods:**
- [ ] `claimNextJob()` - Atomically claim job for processing
- [ ] `releaseJob(jobId)` - Release job back to queue
- [ ] `executeJob(job)` - Execute Playwright script
- [ ] `processJobQueue()` - Main worker loop
- [ ] `stopProcessing()` - Graceful shutdown

**Helper Methods:**
- [ ] `formatJobResponse(row)` - Database to API format
- [ ] `parseScriptOutput(stdout, stderr, jobType)` - Extract results
- [ ] `classifyError(message)` - Determine error code
- [ ] `estimateTotalSteps(jobType)` - Step count by type

#### 2.2 Create Job Routes
- [ ] Create file: `UberEats-Image-Extractor/src/routes/job-routes.js`
- [ ] Import ScriptJobService
- [ ] Create Express router

**Endpoints:**
- [ ] `POST /` - Create new job
- [ ] `GET /:jobId` - Get job details
- [ ] `GET /:jobId/status` - Get status (for polling)
- [ ] `DELETE /:jobId` - Cancel job
- [ ] `GET /` - List jobs with filtering
- [ ] `GET /types` - Get available job types

**Middleware:**
- [ ] Request validation for job creation
- [ ] Error handling wrapper
- [ ] Auth middleware integration

#### 2.3 Integrate Routes with Server
- [ ] Import job-routes in `server.js`
- [ ] Mount routes at `/api/jobs`
- [ ] Ensure auth middleware applied

```javascript
// server.js
const jobRoutes = require('./src/routes/job-routes');
app.use('/api/jobs', authMiddleware, jobRoutes);
```

#### 2.4 Create Worker Entry Point
- [ ] Create file: `UberEats-Image-Extractor/worker.js`
- [ ] Initialize Supabase with service role key
- [ ] Create ScriptJobService instance
- [ ] Start job queue processing
- [ ] Handle graceful shutdown (SIGTERM)

#### 2.5 Update Package.json
- [ ] Add worker start script: `"worker": "node worker.js"`
- [ ] Ensure dependencies present (uuid, etc.)

### Validation Checklist
- [ ] `POST /api/jobs` returns 202 with job ID in < 100ms
- [ ] `GET /api/jobs/:id` returns correct job data
- [ ] `GET /api/jobs/:id/status` returns minimal status
- [ ] `DELETE /api/jobs/:id` cancels pending jobs
- [ ] Worker processes jobs and updates status
- [ ] Retry logic works for retryable errors
- [ ] Script execution completes successfully

---

## Phase 3: Frontend Integration (Day 3-4)

### Objective
Create React hooks and components for job polling and status display.

### Tasks

#### 3.1 Create useJobPolling Hook
- [ ] Create file: `UberEats-Image-Extractor/src/hooks/useJobPolling.js`
- [ ] Implement dynamic polling intervals (2s → 5s → 10s)
- [ ] Handle terminal states (stop polling)
- [ ] Implement callbacks (onProgress, onComplete, onError)
- [ ] Add manual controls (stopPolling, resumePolling, reset)
- [ ] Add background tab handling (pause polling)

#### 3.2 Create useCreateJob Hook
- [ ] Create file: `UberEats-Image-Extractor/src/hooks/useCreateJob.js`
- [ ] Integrate with TanStack Query mutation
- [ ] Auto-start polling on job creation
- [ ] Provide combined state (isLoading, isComplete, etc.)
- [ ] Implement cancel functionality

#### 3.3 Add API Service Methods
- [ ] Update `UberEats-Image-Extractor/src/services/api.js`
- [ ] Add `createJob(jobType, payload, options)`
- [ ] Add `getJob(jobId)`
- [ ] Add `getJobStatus(jobId)`
- [ ] Add `cancelJob(jobId)`
- [ ] Add `listJobs(filters, pagination)`
- [ ] Add `getJobTypes()`

#### 3.4 Create JobStatusCard Component
- [ ] Create file: `UberEats-Image-Extractor/src/components/JobStatusCard.jsx`
- [ ] Status icons and colors per status
- [ ] Progress bar for in_progress
- [ ] Error message display for failed
- [ ] Cancel button for pending
- [ ] Retry button for failed

#### 3.5 Create JobProgressBar Component
- [ ] Create file: `UberEats-Image-Extractor/src/components/JobProgressBar.jsx`
- [ ] Percentage display
- [ ] Message display
- [ ] Indeterminate mode for unknown progress

#### 3.6 Update Existing Pages
Choose ONE page to convert first as proof of concept:

- [ ] Identify page using `add-item-tags` endpoint
- [ ] Replace direct API call with `useCreateJob`
- [ ] Add `JobStatusCard` for status display
- [ ] Test full flow: create → poll → complete
- [ ] Handle errors gracefully

#### 3.7 Add CSS Animations
- [ ] Add indeterminate progress bar keyframes
- [ ] Add pulse animation for pending status
- [ ] Add spin animation for loader icon

### Validation Checklist
- [ ] useJobPolling polls correctly and stops on completion
- [ ] useCreateJob creates job and tracks progress
- [ ] JobStatusCard displays all states correctly
- [ ] Progress bar animates smoothly
- [ ] UI updates in real-time as job progresses
- [ ] Cancel works for pending jobs
- [ ] Errors displayed to user

---

## Phase 4: Cleanup & Monitoring (Day 4-5)

### Objective
Add cleanup jobs, logging, and deprecate old endpoints.

### Tasks

#### 4.1 Add Cleanup Methods to Service
- [ ] Implement `cleanupStalledJobs()` - Handle timed-out jobs
- [ ] Implement `cleanupOldJobs(days)` - Delete old completed jobs
- [ ] Implement `recoverOrphanedJobs()` - Handle worker crashes

#### 4.2 Schedule Cleanup Jobs
- [ ] Add hourly stalled job cleanup to worker
- [ ] Add daily old job cleanup to worker
- [ ] Add startup orphan recovery

```javascript
// In worker.js
setInterval(() => jobService.cleanupStalledJobs(), 60 * 60 * 1000);
setInterval(() => jobService.cleanupOldJobs(30), 24 * 60 * 60 * 1000);

// On startup
await jobService.recoverOrphanedJobs();
```

#### 4.3 Add Structured Logging
- [ ] Add job lifecycle logging (created, started, completed, failed)
- [ ] Include jobId, jobType, duration, success in logs
- [ ] Ensure passwords not logged
- [ ] Log worker startup/shutdown

#### 4.4 Deprecate Old Endpoints
- [ ] Add deprecation warnings to old endpoints in `registration-routes.js`
- [ ] Log usage of deprecated endpoints
- [ ] Document migration path for API consumers

```javascript
// registration-routes.js
router.post('/add-item-tags', async (req, res) => {
  console.warn('[DEPRECATED] Use POST /api/jobs with jobType: add-item-tags');
  // ... existing code for backward compatibility
});
```

#### 4.5 Update Documentation
- [ ] Update API documentation with new endpoints
- [ ] Add migration guide for frontend consumers
- [ ] Document environment variables

#### 4.6 Railway Deployment
- [ ] Update Railway to run both server and worker
- [ ] Or configure worker as separate service
- [ ] Verify environment variables set

#### 4.7 Testing in Production
- [ ] Deploy to Railway staging
- [ ] Test job creation via Netlify frontend
- [ ] Verify no 504 timeouts
- [ ] Test retry logic with simulated failures
- [ ] Monitor job queue metrics

### Validation Checklist
- [ ] Cleanup jobs run on schedule
- [ ] Orphaned jobs recovered on restart
- [ ] Logs include all job lifecycle events
- [ ] Old endpoints still work (backward compatible)
- [ ] Production deployment successful
- [ ] No more 504 Gateway Timeout errors

---

## Post-Implementation Tasks

### Future Enhancements (Not in scope)
- [ ] WebSocket real-time progress updates
- [ ] Job priority queues
- [ ] Job dependencies (job B waits for job A)
- [ ] Redis-backed queue for scale
- [ ] Dashboard for job monitoring
- [ ] Email notifications on failure

### Migration of Remaining Endpoints
After initial implementation validated, migrate remaining endpoints:

| Priority | Job Type | Script Path |
|----------|----------|-------------|
| High | add-option-sets | scripts/restaurant-registration/add-option-sets.js |
| High | import-csv-menu | scripts/restaurant-registration/import-csv-menu.js |
| Medium | register-restaurant | scripts/restaurant-registration/login-and-register-restaurant.js |
| Medium | configure-website-dark | scripts/edit-website-settings-dark.js |
| Medium | configure-website-light | scripts/edit-website-settings-light.js |
| Low | setup-stripe-payments | scripts/setup-stripe-payments.js |
| Low | setup-stripe-payments-no-link | scripts/setup-stripe-payments-no-link.js |
| Low | setup-services | scripts/setup-services-settings.js |
| Low | setup-system-settings | scripts/setup-system-settings-user.js |
| Low | create-api-key | scripts/create-api-key-user.js |
| Low | finalise-onboarding | scripts/finalise-onboarding-user.js |

---

## Handoff Summary

### What's Done
- [x] Issue analysis and root cause identification
- [x] Architecture design and documentation
- [x] Database schema design
- [x] API specification
- [x] Service layer design
- [x] Frontend component design
- [x] Implementation roadmap

### What's Next
1. **Immediate**: Execute Phase 1 (Database Setup)
2. **Then**: Execute Phase 2 (Backend Service & Routes)
3. **Then**: Execute Phase 3 (Frontend Integration)
4. **Finally**: Execute Phase 4 (Cleanup & Monitoring)

### Notes for Next Developer

#### Read Reference Files First
1. `async-job-queue/database-schema.md` - Full SQL migration
2. `async-job-queue/service-layer.md` - Complete service implementation
3. `async-job-queue/api-specification.md` - All endpoint details
4. `async-job-queue/ui-components.md` - Hook and component code
5. `async-job-queue/architecture.md` - System design and flows

#### Review Current Implementation
1. `UberEats-Image-Extractor/src/routes/registration-routes.js` - Current sync endpoints
2. `scripts/restaurant-registration/*.js` - Playwright scripts (add-item-tags, add-option-sets, import-csv-menu, login-and-register-restaurant)
3. `scripts/*.js` - Other Playwright scripts (edit-website-settings-*, setup-stripe-payments*, setup-services-settings, setup-system-settings-user, create-api-key-user, finalise-onboarding-user)
4. `scripts/lib/browser-config.cjs` - Browser configuration
5. `UberEats-Image-Extractor/src/services/api.js` - Current API service

#### Implementation Order
1. Database first (migrations need to exist before code)
2. Service layer second (core logic before routes)
3. Routes third (depends on service)
4. Frontend last (depends on working API)

#### Key Architecture Decisions
1. **Table name**: `script_jobs` (not `jobs`)
2. **Human-readable job IDs**: Format `JOB_YYYYMMDD_HHMMSS_xxxxxxxx`
3. **Polling intervals**: 2s → 5s → 10s based on age
4. **Max concurrent jobs**: 2 per worker
5. **Default retry strategy**: 3 retries with exponential backoff (5s → 10s → 20s)
6. **Job cleanup**: 30 days retention

---

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1: Database | 2-3 hours | Low |
| Phase 2: Backend | 6-8 hours | Medium |
| Phase 3: Frontend | 4-6 hours | Medium |
| Phase 4: Cleanup | 2-3 hours | Low |
| **Total** | **14-20 hours** | **Medium** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Database migration failure | Test locally first, backup production |
| Worker process crashes | Orphan recovery on startup |
| Queue backs up | Monitor pending count, scale workers |
| Script timeout in queue | Timeout detection and auto-fail |
| Backward compatibility | Keep old endpoints working during transition |
