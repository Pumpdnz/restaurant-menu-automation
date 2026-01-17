# Async Job Queue Pattern - Investigation Plan

**Date**: 2025-12-09
**Status**: Planning
**Goal**: Implement async job queue to solve Netlify gateway timeout (~30s limit)

## Problem Statement

Netlify's proxy has a hard ~30 second timeout that cannot be increased on the free tier. Playwright scripts take 60-180+ seconds to complete. Even though Railway can execute these scripts successfully, the Netlify gateway returns 504 before completion.

**Solution**: Return a job ID immediately, execute script in background, client polls for completion.

---

## Investigation Tasks for Parallel Subagents

### TASK 1: Database Schema Investigation

**Objective**: Understand current Supabase schema and design jobs table

**Files to Investigate**:
```
- UberEats-Image-Extractor/src/services/database-service.js
- UberEats-Image-Extractor/src/lib/supabase.js
- Any existing migration files in supabase/ directory
```

**Questions to Answer**:
1. How is Supabase currently configured and accessed?
2. What authentication pattern is used (anon key vs service role)?
3. Are there any existing job/task tracking tables?
4. What's the pattern for database operations (raw SQL vs JS client)?

**Deliverable**: Proposed `jobs` table schema with:
- job_id (UUID)
- job_type (enum: 'add-item-tags', 'add-option-sets', 'import-csv', etc.)
- status (enum: 'pending', 'running', 'completed', 'failed')
- input_payload (JSONB)
- result (JSONB)
- error_message (TEXT)
- created_at, started_at, completed_at (TIMESTAMPTZ)
- created_by (UUID, foreign key to users if applicable)

---

### TASK 2: API Routes Investigation

**Objective**: Understand current route structure and identify endpoints to convert

**Files to Investigate**:
```
- UberEats-Image-Extractor/src/routes/registration-routes.js
- UberEats-Image-Extractor/server.js
- Any other route files in src/routes/
```

**Questions to Answer**:
1. Which endpoints execute Playwright scripts via `child_process.exec`?
2. What are the current timeout configurations for each endpoint?
3. What request/response patterns are used?
4. How is error handling currently implemented?
5. Are there any existing async patterns in use?

**Deliverable**: List of endpoints to convert with their:
- Current endpoint path and method
- Script being executed
- Current timeout setting
- Input parameters required
- Response structure

**Known endpoints from previous investigation**:
```javascript
// From registration-routes.js - timeout values
timeout: 180000  // Lines: 603, 1694, 1847, 1974, 2822, 3054
timeout: 120000  // Lines: 880, 2371
timeout: 240000  // Line: 1388
timeout: 300000  // Lines: 2228, 3299
```

---

### TASK 3: Frontend API Service Investigation

**Objective**: Understand how frontend makes API calls and design polling mechanism

**Files to Investigate**:
```
- UberEats-Image-Extractor/src/services/api.js
- UberEats-Image-Extractor/src/services/api.ts (if exists)
- UberEats-Image-Extractor/src/pages/ (any pages that call registration endpoints)
- UberEats-Image-Extractor/src/hooks/ (any custom hooks)
```

**Questions to Answer**:
1. How are API calls currently structured (fetch, axios, react-query)?
2. Is there existing polling logic anywhere?
3. How is loading state managed in components?
4. How are errors displayed to users?
5. What UI feedback is shown during long operations?

**Deliverable**:
- Current API call patterns documented
- Proposed polling utility/hook design
- UI state management approach for async jobs

---

### TASK 4: Script Execution Investigation

**Objective**: Understand how Playwright scripts are executed and design background execution

**Files to Investigate**:
```
- UberEats-Image-Extractor/src/routes/registration-routes.js (exec patterns)
- scripts/restaurant-registration/*.js (all script files)
- scripts/lib/browser-config.cjs
```

**Questions to Answer**:
1. How are scripts currently invoked (`child_process.exec`)?
2. What environment variables are passed to scripts?
3. How is stdout/stderr captured?
4. How are script results parsed from output?
5. What happens when a script fails?

**Deliverable**:
- Document current execution pattern
- Propose background execution pattern that:
  - Doesn't block the HTTP response
  - Updates job status in database
  - Captures script output/errors
  - Handles process cleanup

---

### TASK 5: Error Handling & Retry Investigation

**Objective**: Design robust error handling and retry logic

**Files to Investigate**:
```
- UberEats-Image-Extractor/src/routes/registration-routes.js
- scripts/restaurant-registration/*.js (error handling in scripts)
- UberEats-Image-Extractor/src/middleware/ (if exists)
```

**Questions to Answer**:
1. What types of errors can occur during script execution?
2. Which errors are recoverable (should retry)?
3. How should failed jobs be reported to users?
4. Should there be automatic cleanup of old jobs?
5. What about orphaned jobs (server restart during execution)?

**Deliverable**:
- Error classification (retryable vs fatal)
- Retry strategy (max attempts, backoff)
- Job cleanup/expiration policy
- Orphan job recovery approach

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW                                 │
│                                                                      │
│  Frontend ──POST──> Netlify ──proxy──> Railway ──exec──> Script     │
│     │                  │                  │                 │        │
│     │                  │ 30s timeout      │                 │        │
│     │<────504─────────<│                  │                 │        │
│                                           │<────result─────<│        │
│                                           └────lost!────────         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         NEW ASYNC FLOW                               │
│                                                                      │
│  Frontend ──POST──> Netlify ──proxy──> Railway                      │
│     │                                     │                          │
│     │<─────{ jobId, status: pending }────<│                          │
│     │                                     │                          │
│     │                              [Background: exec script]         │
│     │                                     │                          │
│     │──GET /jobs/:id──> Netlify ─────> Railway                      │
│     │<───{ status: running }─────────────<│                          │
│     │                                     │                          │
│     │──GET /jobs/:id──> Netlify ─────> Railway                      │
│     │<───{ status: completed, result }───<│                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database Setup
1. Create `jobs` table migration
2. Create job service with CRUD operations
3. Add RLS policies for job access

### Phase 2: Backend Routes
1. Create `/api/jobs` routes (create, get, list)
2. Modify existing Playwright endpoints to create jobs
3. Implement background execution (non-blocking)
4. Add job status update logic

### Phase 3: Frontend Integration
1. Create `useJobPolling` hook
2. Update components to use async pattern
3. Add job status UI (progress, completion, errors)

### Phase 4: Cleanup & Monitoring
1. Add job expiration/cleanup cron
2. Add logging for job lifecycle
3. Handle orphaned jobs on server restart

---

## Files That Will Be Created/Modified

### New Files
```
- supabase/migrations/YYYYMMDD_create_jobs_table.sql
- UberEats-Image-Extractor/src/services/job-service.js
- UberEats-Image-Extractor/src/routes/job-routes.js
- UberEats-Image-Extractor/src/hooks/useJobPolling.js (or .ts)
```

### Modified Files
```
- UberEats-Image-Extractor/server.js (add job routes)
- UberEats-Image-Extractor/src/routes/registration-routes.js (convert to async)
- UberEats-Image-Extractor/src/services/api.js (add job API methods)
- UberEats-Image-Extractor/src/pages/*.jsx (update to use polling)
```

---

## Subagent Instructions Template

When spawning subagents, use this prompt structure:

```
You are investigating the codebase to plan implementation of an Async Job Queue Pattern.

**Your Task**: [TASK NAME from above]

**Objective**: [Objective from above]

**Files to Investigate**:
[File list from above]

**Questions to Answer**:
[Questions from above]

**Deliverable**:
[Deliverable description from above]

**Important Notes**:
- This is a READ-ONLY investigation task - do not modify any files
- Document your findings in detail
- If you find relevant files not listed, investigate them too
- Note any potential issues or concerns you identify
- Provide code snippets for important patterns you discover

**Return your findings in this format**:
1. Summary of findings
2. Answers to each question
3. Code snippets of relevant patterns
4. Recommendations
5. Potential concerns or blockers
```

---

## Success Criteria

The async job queue implementation will be successful when:

1. ✅ All Playwright endpoints return immediately with job ID
2. ✅ Jobs execute successfully in background
3. ✅ Frontend can poll for job status
4. ✅ Completed jobs return their results
5. ✅ Failed jobs return error information
6. ✅ No more 504 Gateway Timeout errors from Netlify
7. ✅ Users see meaningful progress feedback

---

## Related Documentation

- [RAILWAY-PLAYWRIGHT-JS-EXECUTION-ISSUE.md](./../RAILWAY-PLAYWRIGHT-JS-EXECUTION-ISSUE.md) - Resolved script execution issue
- [PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md](./../PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md) - Architecture options analysis
- [PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md](./../PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md) - Original timeout investigation
