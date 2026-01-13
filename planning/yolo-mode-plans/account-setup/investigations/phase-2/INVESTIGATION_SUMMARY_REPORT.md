# Async Yolo Mode Investigation Summary Report

## Executive Summary

This investigation analyzed four key areas to design an async Yolo Mode registration system that:
- Continues execution server-side after user closes dialog
- Displays progress in the Complete Setup card on RestaurantDetail
- Allows users to navigate away and return to see status
- Supports future batch execution of multiple restaurants

**Key Finding:** The codebase already has proven patterns in the lead scrape system that can be directly applied to registration jobs with minimal new dependencies.

---

## Synthesized Findings

### 1. Database Schema (Task 1)

**Proposed Tables:**
- `registration_jobs` - Main job tracking with phase-level status
- `registration_job_steps` - Individual step tracking with retry support
- `registration_batch_jobs` - Future batch support (optional in v1)

**Key Design Decisions:**
- 12 steps matching current YoloMode phases
- JSONB `execution_config` stores entire form for replay/debugging
- Phase-level status columns for quick queries (`phase1_status`, etc.)
- RLS policies inherit from organisation

### 2. Backend Job Management (Task 2)

**Proposed Pattern:** Use `setImmediate()` for background execution (same as lead scrape)

```javascript
// API returns immediately
res.json({ job_id, status: 'pending' });

// Background execution continues
setImmediate(async () => {
  await executePhase1(jobId);
  await executePhase2(jobId);
  // ...
});
```

**Key Endpoints:**
- `POST /api/registration-jobs` - Create and start job
- `GET /api/registration-jobs/:id` - Get status with steps
- `POST /api/registration-jobs/:id/cancel` - Cancel running job
- `GET /api/restaurants/:id/registration-jobs/active` - Find active job

**No Job Queue Required:** The `setImmediate()` pattern is sufficient for single-server deployment.

### 3. Frontend Polling (Task 3)

**Proposed Hooks:**
- `useRegistrationJob(jobId)` - Poll single job with smart intervals
- `useActiveRegistrationJob(restaurantId)` - Find active job for restaurant

**Polling Strategy:**
- 5 seconds during active execution
- 10 seconds when pending
- Stop polling when completed/failed/cancelled

**YoloModeProgress Reuse:** Existing component works as-is in card context.

### 4. Batch Extensibility (Task 4)

**Three-Level Hierarchy:**
```
registration_batch_jobs (1 per batch)
    └─ registration_jobs (1 per restaurant)
        └─ registration_job_steps (1 per step)
```

**Backward Compatibility:** "Implicit batches" - single registrations create batch with 1 restaurant.

**Failure Handling:** Per-step retry (3 attempts), continue to next restaurant on failure.

---

## Dependencies Between Components

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                          │
│  (Must be created first - foundation for everything)        │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐
│  BACKEND SERVICE    │  │  API ENDPOINTS      │
│  (Job execution)    │──│  (CRUD operations)  │
└─────────────────────┘  └──────────┬──────────┘
                                    │
                         ┌──────────┴──────────┐
                         ▼                      ▼
              ┌─────────────────────┐  ┌─────────────────────┐
              │  FRONTEND HOOKS     │  │  UI COMPONENTS      │
              │  (useRegistrationJob)│  │  (Complete Setup)   │
              └─────────────────────┘  └─────────────────────┘
```

---

## Implementation Order

### Phase 1: Database Foundation (Day 1-2)
1. Create migration: `20251220_add_registration_job_tables.sql`
2. Create `registration_jobs` table
3. Create `registration_job_steps` table
4. Add indexes and RLS policies

### Phase 2: Backend Service (Day 2-4)
1. Create `registration-job-service.js`
2. Implement job creation with step initialization
3. Implement `setImmediate()` execution pattern
4. Add step handlers wrapping existing endpoints
5. Implement retry logic with exponential backoff

### Phase 3: API Endpoints (Day 3-4)
1. `POST /api/registration-jobs` - Create job
2. `GET /api/registration-jobs/:id` - Get status
3. `POST /api/registration-jobs/:id/cancel` - Cancel
4. `GET /api/restaurants/:id/registration-jobs/active` - Active job

### Phase 4: Frontend Integration (Day 4-5)
1. Create `useRegistrationJob` hook
2. Create `useActiveRegistrationJob` hook
3. Modify Complete Setup card to show inline progress
4. Add session storage for job ID persistence

### Phase 5: Dialog Changes (Day 5)
1. Modify YoloModeDialog to create job instead of executing
2. Close dialog immediately after job creation
3. Toast notification pointing to Complete Setup card

---

## Blockers & Concerns

### Potential Blockers

| Issue | Mitigation |
|-------|------------|
| Existing `pumpd_accounts` table not in migrations | Reference existing production schema |
| No process restart handling | Jobs table persists; add resume logic if needed |
| Long-running Playwright scripts | Already have 180s timeout; consider longer for batch |

### Technical Concerns

1. **No Job Queue:** `setImmediate()` works but doesn't survive server restarts
   - **Mitigation:** Store job state in DB; add startup check for stuck jobs

2. **Concurrent Jobs:** No locking for same restaurant
   - **Mitigation:** Check for active job before creating new one

3. **Memory Usage:** Multiple parallel steps could consume memory
   - **Mitigation:** Phase 1 uses sequential execution

---

## Architectural Decisions Needed

### Decision 1: Implicit Batches?
**Options:**
- A) Every job has a batch (even single restaurants)
- B) `batch_job_id` is nullable for single jobs

**Recommendation:** Option A for consistent querying

### Decision 2: Resume on Failure?
**Options:**
- A) Failed jobs can be retried from the failed step
- B) Failed jobs must be recreated from scratch

**Recommendation:** Option A with `from_step` parameter on retry endpoint

### Decision 3: Parallel Steps Within a Phase?
**Options:**
- A) Keep parallel execution as current frontend does
- B) Execute all steps sequentially for simplicity

**Recommendation:** Option A - maintain current behavior, just move to backend

---

## Recommended Approach

### Minimum Viable Implementation (MVP)

1. **Database:** `registration_jobs` + `registration_job_steps` tables only (no batch table for MVP)

2. **Backend:** Simple job service with `setImmediate()` pattern

3. **Frontend:** Poll active job, show in Complete Setup card

4. **Dialog:** Create job → close immediately → show "View progress in Complete Setup card"

### Future Enhancements

1. Batch registration from Restaurants page
2. Job history and retry UI
3. Webhook notifications
4. Parallel execution mode

---

## Next Steps

1. **Review this report** and confirm architectural decisions
2. **Create database migration** based on Task 1 schema
3. **Implement backend service** using patterns from Task 2
4. **Build frontend hooks** following patterns from Task 3
5. **Plan batch UI** for future using patterns from Task 4

---

## File References

Investigation deliverables:
- [INVESTIGATION_TASK_1_DATABASE_SCHEMA.md](./INVESTIGATION_TASK_1_DATABASE_SCHEMA.md)
- [INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md](./INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md)
- [INVESTIGATION_TASK_3_FRONTEND_POLLING.md](./INVESTIGATION_TASK_3_FRONTEND_POLLING.md)
- [INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md](./INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md)

Key codebase files examined:
- `/supabase/migrations/20251205_add_lead_scraping_tables.sql`
- `/src/hooks/useLeadScrape.ts`
- `/src/hooks/useYoloModeExecution.ts`
- `/src/services/lead-scrape-service.js`
- `/src/routes/lead-scrape-routes.js`
- `/src/routes/registration-routes.js`
- `/src/components/registration/YoloModeProgress.tsx`
- `/src/pages/RestaurantDetail.jsx`

We've just extended the lead scrape conversion process to allow the user to speed up the process by batch enrolling of extracted leads in sequences and asynchronous execution of premium menu extractions and branding extractions.

The end goal of all of this is to be able to orchestrate the entire process from end to end with as little clicking around as possible.

Right now, the missing links to achieve this desired end result are:
1. The contact details extraction
2. The registration yolo mode steps need to be able to run asyncronously (just investigated)
3. The registration yolo mode steps need to be able to be run in batch mode

Integrating the contact details extraction into this flow is complex because it is a user interaction intensive process. This is necessary because it is a phased approach where it gets multiple candidates for the restaurant's legal company based on searching the companies register for address and restaurant name. It then returns the options to the user to select which of the legal company entities (if any) is the correct one for the restaurant before extracting the full company details from the register.

What adds to this complexity is that the RestaurantDetails.tsx page is currently the only place where a user can verify data extracted from extraction workflows, make modifications when necessary and configure things like yolo mode settings.
 
In order to link all of these things together we will need to create a new interface for orchestrating the batch enrichment and registration automation workflow. We will need to create a page that is very similar to the lead scraping page which allows the user to see batches of restaurants going through the steps.

Since we already have the functionality to convert leads to restaurants while triggering the menu and branding extractions, we could essentially think of this automation project as phase two of the lead scraping functionality. When a batch of leads is converted to restaurants we could enhance the current process to also create new records in the new tables described:
- 1 new record in registration_batch_jobs
- n (number of restaurants) new records in registration_jobs for each of the restaurants with fk links to the newly created restaurants records and registration_batch_jobs record
- n (number of restaurants * number of steps) new records for each of the registration steps in registration_job_steps

Then we would simply make this analogous to a new lead scrape job being created, where the first registration step has step_type = automatic and includes the menu extraction and branding extraction as processes.

The next steps would have step_type = action_required and be for the contact details extraction.
- The user interface for this process would need to be different to the current lead scraping feature because it requires user intervention, both when beginning the process to make sure that the search queries for the company name and address are correct and halfway through the extraction process to display company candidates and allow the user to select which company candidate to extract full details from.
- Therefore we could split this process into step 2 and step 3. However, it would require us to persist initial data from the company candidates extraction to the database for the user to be able to navigate away and then come back later to select the candidate to continue processing with instead of holding it in memory.
- We will also need to make this process able to be completed asynchronously so that the user could navigate away and then come back

Step 4 would be for configuring the yolo mode for each restaurant individually and then all subsequent steps would be able to run automatically
