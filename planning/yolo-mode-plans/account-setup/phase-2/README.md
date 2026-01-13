# Phase 2: Registration Batch Orchestration

## Overview

Phase 2 extends the Yolo Mode registration system to support:
- **Async Execution**: Server-side execution that continues after dialog closes
- **Batch Processing**: Execute registration for multiple restaurants simultaneously
- **End-to-End Pipeline**: Seamless flow from lead conversion to Pumpd registration
- **Contact Extraction Integration**: Companies Office search integrated into the workflow

This is the "Phase 2 of Lead Scraping" - orchestrating the complete journey from extracted leads to fully registered Pumpd accounts.

---

## Documentation Structure

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file - overview and quick start |
| [architecture.md](./architecture.md) | System design, data flow, integration points |
| [database-schema.md](./database-schema.md) | Table definitions and migrations |
| [api-specification.md](./api-specification.md) | REST API endpoints |
| [service-layer.md](./service-layer.md) | Backend service implementation |
| [ui-components.md](./ui-components.md) | Frontend components and hooks |
| [lead-conversion-integration.md](./lead-conversion-integration.md) | Lead conversion integration |
| [contact-extraction-integration.md](./contact-extraction-integration.md) | Companies Office integration |
| [implementation-roadmap.md](./implementation-roadmap.md) | Implementation plan with checklists |

### Investigation Documents

Located in `../investigations/phase-2/`:
- `UNIFIED_ARCHITECTURE_PLAN.md` - Comprehensive architecture from investigations
- `INVESTIGATION_TASK_1_DATABASE_SCHEMA.md` - Database patterns
- `INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md` - Backend patterns
- `INVESTIGATION_TASK_3_FRONTEND_POLLING.md` - Frontend polling patterns
- `INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md` - Batch execution patterns
- `INVESTIGATION_LEAD_CONVERSION_FLOW.md` - Lead conversion analysis
- `INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md` - Contact extraction analysis
- `INVESTIGATION_LEADSCRAPES_UI_PATTERNS.md` - UI component patterns
- `INVESTIGATION_STEP_ORCHESTRATION.md` - Step handling patterns

---

## Architecture Overview

### The 6-Step Pipeline

```
Step 1: Menu & Branding Extraction     [AUTOMATIC]
        Track existing extraction jobs

Step 2: Contact Details Search         [AUTOMATIC]
        Search Companies Office for legal entities

Step 3: Company Selection              [ACTION_REQUIRED]
        User selects correct company for each restaurant

Step 4: Company Details Extraction     [AUTOMATIC]
        Extract and save full company details

Step 5: Yolo Mode Configuration        [ACTION_REQUIRED]
        User configures settings per restaurant

Step 6: Pumpd Account Setup            [AUTOMATIC]
        Execute 12 Yolo Mode sub-steps
```

### System Layers

```
Frontend (React)
    │
    ├── Pages: RegistrationBatches, RegistrationBatchDetail
    ├── Components: BatchProgressCard, CompanySelectionView, etc.
    └── Hooks: useRegistrationBatch, useRegistrationBatches
    │
    │ HTTP/Polling
    ▼
Backend (Express)
    │
    ├── Routes: /api/registration-batches/*
    └── Services: registration-batch-service, etc.
    │
    │ setImmediate() async
    ▼
Database (Supabase)
    │
    └── Tables: registration_batch_jobs, registration_jobs, etc.
```

---

## Core Principles

### 1. Async Execution with setImmediate()
```javascript
// Return response immediately, process in background
res.json({ success: true });
setImmediate(() => processSteps(batchId));
```

### 2. Database-Driven State
- All job state persisted in database
- Survives server restarts
- Enables polling from any client

### 3. Action Required Gates
- Steps 3 and 5 pause for user input
- State persisted for async completion
- User can navigate away and return

### 4. Step-Level Retry
- Each step has independent retry logic
- Exponential backoff on failure
- Failed restaurants don't block others

### 5. Pattern Reuse
- Mirrors lead scrape job patterns
- Reuses existing UI components
- Consistent user experience

---

## Existing UI Patterns

### From LeadScrapes

| Pattern | Source | Reuse |
|---------|--------|-------|
| Job list with filters | LeadScrapes.tsx | Direct |
| Progress card | ScrapeJobProgressCard.tsx | Adapt |
| Step list | ScrapeJobStepList.tsx | Adapt |
| Polling hooks | useLeadScrape.ts | Pattern |
| Action required | PendingLeadsTable.tsx | Pattern |

### From Yolo Mode

| Pattern | Source | Reuse |
|---------|--------|-------|
| Step progress | YoloModeProgress.tsx | Adapt |
| Sub-step tracking | useYoloModeExecution.ts | Pattern |
| Configuration UI | YoloModeDialog.tsx | Adapt |

---

## Implementation Location

### New Files to Create

**Pages:**
```
src/pages/RegistrationBatches.tsx
src/pages/RegistrationBatchDetail.tsx
```

**Components:**
```
src/components/registration-batch/
├── BatchProgressCard.tsx
├── BatchStepList.tsx
├── BatchRestaurantTable.tsx
├── CompanySelectionView.tsx
├── YoloConfigBatchView.tsx
└── SubStepProgress.tsx
```

**Hooks:**
```
src/hooks/useRegistrationBatch.ts
src/hooks/useRegistrationBatches.ts
src/hooks/useRegistrationBatchMutations.ts
```

**Services:**
```
src/services/registration-batch-service.js
src/services/registration-job-service.js
src/services/registration-step-service.js
src/services/companies-office-batch-service.js
```

**Routes:**
```
src/routes/registration-batch-routes.js
```

**Migrations:**
```
supabase/migrations/YYYYMMDD_add_registration_batch_tables.sql
```

### Files to Modify

```
src/services/lead-scrape-service.js  # Add batch creation option
src/routes/leads-routes.js           # Add batch creation param
src/components/leads/PendingLeadsTable.tsx  # Add batch checkbox
src/App.tsx                          # Add routes
server.js                            # Mount routes
```

---

## Quick Start Guide

### 1. Create Database Tables

```bash
# Create migration file
touch supabase/migrations/YYYYMMDD_add_registration_batch_tables.sql

# Copy schema from database-schema.md
# Run migration
supabase db push
```

### 2. Implement Backend Services

```bash
# Create service files
touch src/services/registration-batch-service.js
touch src/services/registration-job-service.js
touch src/services/registration-step-service.js
touch src/services/companies-office-batch-service.js

# Implement according to service-layer.md
```

### 3. Create API Routes

```bash
# Create routes file
touch src/routes/registration-batch-routes.js

# Mount in server.js
app.use('/api/registration-batches', registrationBatchRoutes);
```

### 4. Implement Frontend

```bash
# Create components
mkdir -p src/components/registration-batch
mkdir -p src/hooks

# Create pages
touch src/pages/RegistrationBatches.tsx
touch src/pages/RegistrationBatchDetail.tsx

# Add routes in App.tsx
```

### 5. Test Flow

1. Convert leads with batch creation enabled
2. Navigate to /registration-batches/:id
3. Verify Step 1 completes (extraction tracking)
4. Complete Step 3 (company selection)
5. Complete Step 5 (yolo config)
6. Verify Step 6 executes

---

## Related Documentation

### Phase 1 (Completed)
- `../phase-1/IMPLEMENTATION_PLAN.md` - Original yolo mode implementation
- `../phase-1/COMPLETION_SUMMARY.md` - Phase 1 completion notes

### Other Project Docs
- `../../extraction-plans/` - Menu extraction documentation
- `../../authentication-plans/` - Auth system documentation

---

## Status

| Item | Status |
|------|--------|
| Investigation | ✅ Complete |
| Documentation | ✅ Complete |
| Database Schema | ⏳ Not Started |
| Backend Services | ⏳ Not Started |
| API Endpoints | ⏳ Not Started |
| Frontend Pages | ⏳ Not Started |
| Frontend Components | ⏳ Not Started |
| Integration Testing | ⏳ Not Started |

---

## Next Steps

1. **Review Documentation**: Read through all docs in this folder
2. **Create Database Tables**: Start with [database-schema.md](./database-schema.md)
3. **Implement Backend**: Follow [service-layer.md](./service-layer.md)
4. **Create API**: Follow [api-specification.md](./api-specification.md)
5. **Build UI**: Follow [ui-components.md](./ui-components.md)
6. **Test Integration**: Follow checklist in [implementation-roadmap.md](./implementation-roadmap.md)

---

## Last Updated

2024-12-20
