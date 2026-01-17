# Async Script Job Queue

**Last Updated**: 2025-12-09
**Status**: Planning Complete - Ready for Implementation

## Overview

This project implements an async job queue pattern to solve the Netlify gateway timeout issue (~30 second limit) when executing Playwright scripts that take 2-5 minutes to complete.

**The Problem**: Playwright scripts execute synchronously, blocking HTTP responses for minutes. Netlify's proxy times out at ~30 seconds, returning 504 Gateway Timeout even though the script continues running on Railway.

**The Solution**: Return a job ID immediately (< 100ms), execute scripts in the background, and allow clients to poll for completion.

```
BEFORE:
  POST /api/registration/add-item-tags
  ↓ (waits 2-3 minutes)
  ↓ TIMEOUT at 30s → 504 Gateway Timeout
  ✗ User sees error, but script may still succeed

AFTER:
  POST /api/jobs { jobType: "add-item-tags", payload: {...} }
  ↓ (returns immediately)
  ← 202 Accepted { jobId: "JOB_xxx", status: "pending" }

  GET /api/jobs/JOB_xxx/status (poll every few seconds)
  ← { status: "in_progress", progress: { percent: 50 } }

  GET /api/jobs/JOB_xxx/status
  ← { status: "completed" }

  GET /api/jobs/JOB_xxx
  ← { status: "completed", result: {...} }
  ✓ User sees success
```

---

## Documentation Structure

| Document | Description |
|----------|-------------|
| [database-schema.md](./database-schema.md) | Full SQL migration for `script_jobs` table, indexes, triggers, RLS policies |
| [api-specification.md](./api-specification.md) | REST API endpoints specification |
| [service-layer.md](./service-layer.md) | ScriptJobService implementation |
| [ui-components.md](./ui-components.md) | React hooks and components |
| [architecture.md](./architecture.md) | System architecture and data flows |
| [implementation-roadmap.md](./implementation-roadmap.md) | Step-by-step implementation guide |

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│   Express API   │────▶│    Supabase     │
│   (Netlify)     │     │   (Railway)     │     │   script_jobs   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ POST /api/jobs        │ INSERT job            │
         │◀──────────────────────│◀──────────────────────│
         │ { jobId, status }     │                       │
         │                       │                       │
         │                       │     ┌─────────────────┴─────────────────┐
         │                       │     │          Worker Process           │
         │                       │     │                                   │
         │                       │     │  1. Poll for pending jobs         │
         │                       │     │  2. Claim job atomically          │
         │                       │     │  3. Execute Playwright script     │
         │                       │     │  4. Update status/result          │
         │                       │     └───────────────────────────────────┘
         │                       │
         │ GET /api/jobs/xxx     │
         │ (poll every 2-10s)    │
         │◀──────────────────────│
         │ { status, progress }  │
         │                       │
```

---

## Core Principles

### 1. Immediate Response
All job-creating endpoints return within 100ms with a job ID. No blocking.

### 2. Smart Polling
Clients poll with increasing intervals:
- First 30 seconds: Every 2 seconds
- 30s - 2 minutes: Every 5 seconds
- After 2 minutes: Every 10 seconds

### 3. Retry Logic
Transient errors (timeouts, network issues) trigger automatic retries:
- Max 3 retries
- Exponential backoff: 5s → 10s → 20s
- Permanent errors fail immediately

### 4. Atomic Operations
Jobs are claimed atomically to prevent double-processing in multi-worker environments.

### 5. Graceful Degradation
Old synchronous endpoints remain working during migration.

---

## Existing Patterns

### Database Operations
Uses Supabase JavaScript client (not raw SQL):
```javascript
const { data, error } = await supabase
  .from('script_jobs')
  .insert({ ... })
  .select()
  .single();
```

### API Calls
Uses Axios with auth interceptors:
```javascript
const response = await api.post('/jobs', { jobType, payload });
```

### State Management
Uses TanStack React Query v5 for polling:
```javascript
const { data } = useQuery({
  queryKey: ['job-status', jobId],
  refetchInterval: 5000,
});
```

---

## Implementation Locations

### New Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20251209120000_create_script_jobs_table.sql` | Database migration |
| `UberEats-Image-Extractor/src/services/script-job-service.js` | Core job service |
| `UberEats-Image-Extractor/src/routes/job-routes.js` | API endpoints |
| `UberEats-Image-Extractor/worker.js` | Background worker |
| `UberEats-Image-Extractor/src/hooks/useJobPolling.js` | Polling hook |
| `UberEats-Image-Extractor/src/hooks/useCreateJob.js` | Job creation hook |
| `UberEats-Image-Extractor/src/components/JobStatusCard.jsx` | Status display |
| `UberEats-Image-Extractor/src/components/JobProgressBar.jsx` | Progress bar |

### Files to Modify

| File | Change |
|------|--------|
| `UberEats-Image-Extractor/server.js` | Mount job routes |
| `UberEats-Image-Extractor/src/services/api.js` | Add job API methods |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Add deprecation warnings |

---

## Quick Start Guide

### 1. Apply Database Migration
```bash
cd automation
# Copy migration SQL to supabase/migrations/
supabase db push
```

### 2. Create Service and Routes
Follow the code in:
- [service-layer.md](./service-layer.md)
- [api-specification.md](./api-specification.md)

### 3. Create Frontend Hooks
Follow the code in:
- [ui-components.md](./ui-components.md)

### 4. Start Worker
```bash
cd UberEats-Image-Extractor
npm run worker
```

### 5. Test
```bash
# Create a job
curl -X POST http://localhost:3007/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobType": "add-item-tags", "payload": {...}}'

# Poll for status
curl http://localhost:3007/api/jobs/JOB_xxx/status \
  -H "Authorization: Bearer $TOKEN"
```

---

## Related Documentation

### This Issue
- [RAILWAY-PLAYWRIGHT-JS-EXECUTION-ISSUE.md](../RAILWAY-PLAYWRIGHT-JS-EXECUTION-ISSUE.md) - Resolved script execution issue
- [PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md](../PLAYWRIGHT-TIMEOUT-ISSUE-2025-12-09.md) - Original timeout investigation
- [PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md](../PLAYWRIGHT-ARCHITECTURE-DISCUSSION.md) - Architecture options analysis

### Investigation Findings
- [async-job-queue-investigations/](../async-job-queue-investigations/) - Codebase investigation reports

### Project Documentation
- [/automation/CLAUDE.md](../../../../CLAUDE.md) - Project overview
- [/automation/CLAUDE.local.md](../../../../CLAUDE.local.md) - Supabase credentials

---

## Status

| Component | Status |
|-----------|--------|
| Problem Analysis | ✅ Complete |
| Architecture Design | ✅ Complete |
| Database Schema | ✅ Documented |
| API Specification | ✅ Documented |
| Service Layer | ✅ Documented |
| UI Components | ✅ Documented |
| Implementation Roadmap | ✅ Documented |
| **Implementation** | ⏳ Not Started |

---

## Next Steps

1. **Execute Phase 1**: Create and apply database migration
2. **Execute Phase 2**: Implement ScriptJobService and job-routes
3. **Execute Phase 3**: Create frontend hooks and components
4. **Execute Phase 4**: Add cleanup jobs and deprecate old endpoints
5. **Deploy**: Update Railway to run worker process
6. **Validate**: Test end-to-end with real job execution
