# Unified Architecture Plan: End-to-End Restaurant Onboarding Orchestration

## Executive Summary

This document synthesizes findings from 8 parallel investigations to propose a comprehensive architecture for orchestrating the entire restaurant onboarding pipeline - from lead extraction through fully registered Pumpd accounts.

**Vision:** Enable users to orchestrate the entire process from lead scraping to Pumpd registration with minimal manual intervention, while maintaining necessary user decision points for accuracy.

---

## The Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 1: LEAD SCRAPING (EXISTS)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Lead Scrape Job → Extract Leads → Review/Pass Leads → Pending Leads        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 2: REGISTRATION ORCHESTRATION (NEW)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: Convert & Extract (AUTOMATIC)                                      │
│  ├─ Convert leads to restaurants                                            │
│  ├─ Create registration_batch_job + registration_jobs                       │
│  ├─ Trigger menu extraction (premium)                                       │
│  └─ Trigger branding extraction                                             │
│                                                                             │
│  Step 2: Contact Search (AUTOMATIC → ACTION_REQUIRED)                       │
│  ├─ Run companies office search for each restaurant                         │
│  ├─ Persist candidates to database                                          │
│  └─ Mark step as action_required when candidates ready                      │
│                                                                             │
│  Step 3: Company Selection (ACTION_REQUIRED)                                │
│  ├─ User reviews company candidates per restaurant                          │
│  ├─ User selects correct company entity                                     │
│  └─ Triggers detail extraction on selection                                 │
│                                                                             │
│  Step 4: Company Details Extraction (AUTOMATIC)                             │
│  ├─ Extract full details from Companies Office                              │
│  └─ Auto-save to restaurant records                                         │
│                                                                             │
│  Step 5: Yolo Mode Configuration (ACTION_REQUIRED)                          │
│  ├─ User reviews/configures yolo mode settings per restaurant               │
│  ├─ Option to "apply settings to all"                                       │
│  └─ Triggers yolo mode execution on confirmation                            │
│                                                                             │
│  Step 6: Pumpd Account Setup (AUTOMATIC - 12 sub-steps)                     │
│  ├─ Account Registration                                                    │
│  ├─ Code Generation                                                         │
│  ├─ Restaurant Registration                                                 │
│  ├─ Website Configuration                                                   │
│  ├─ Services Configuration                                                  │
│  ├─ Payment Configuration                                                   │
│  ├─ Menu Import                                                             │
│  ├─ Option Sets                                                             │
│  ├─ Item Tags                                                               │
│  └─ ... remaining steps                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables Required

#### 1. `registration_batch_jobs` (Parent Batch)
```sql
CREATE TABLE registration_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  source_lead_scrape_job_id UUID REFERENCES lead_scrape_jobs(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending, in_progress, completed, failed, cancelled

  -- Progress
  total_restaurants INTEGER DEFAULT 0,
  completed_restaurants INTEGER DEFAULT 0,
  failed_restaurants INTEGER DEFAULT 0,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 6,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID,
  metadata JSONB DEFAULT '{}'
);
```

#### 2. `registration_jobs` (Per-Restaurant Job)
```sql
CREATE TABLE registration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_job_id UUID NOT NULL REFERENCES registration_batch_jobs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  organisation_id UUID NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER DEFAULT 1,

  -- Config (from yolo mode dialog)
  execution_config JSONB DEFAULT '{}',

  -- Results
  pumpd_user_id UUID,
  pumpd_restaurant_id UUID,

  -- Error tracking
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

#### 3. `registration_job_steps` (Step Progress)
```sql
CREATE TABLE registration_job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES registration_jobs(id) ON DELETE CASCADE,

  -- Step identification
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL, -- automatic, action_required

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending, in_progress, action_required, completed, failed

  -- Sub-step progress (for yolo mode step)
  sub_step_progress JSONB DEFAULT '{}',

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  UNIQUE(job_id, step_number)
);
```

#### 4. `companies_office_search_candidates` (Contact Search State)
```sql
CREATE TABLE companies_office_search_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  registration_job_id UUID REFERENCES registration_jobs(id),

  -- Search queries used
  search_queries JSONB NOT NULL,

  -- Results
  name_results JSONB,
  address_results JSONB,
  candidate_count INTEGER DEFAULT 0,

  -- Selection
  selected_company_number TEXT,
  status TEXT DEFAULT 'awaiting_selection',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Step Definitions

```javascript
const REGISTRATION_STEPS = [
  {
    step_number: 1,
    step_name: 'Menu & Branding Extraction',
    step_description: 'Extract menu data and brand assets',
    step_type: 'automatic'
  },
  {
    step_number: 2,
    step_name: 'Contact Details Search',
    step_description: 'Search Companies Office for legal entities',
    step_type: 'automatic' // Transitions to action_required when done
  },
  {
    step_number: 3,
    step_name: 'Company Selection',
    step_description: 'Select correct company entity for each restaurant',
    step_type: 'action_required'
  },
  {
    step_number: 4,
    step_name: 'Company Details Extraction',
    step_description: 'Extract full company details and save',
    step_type: 'automatic'
  },
  {
    step_number: 5,
    step_name: 'Yolo Mode Configuration',
    step_description: 'Configure account setup settings',
    step_type: 'action_required'
  },
  {
    step_number: 6,
    step_name: 'Pumpd Account Setup',
    step_description: 'Execute full account registration workflow',
    step_type: 'automatic'
  }
];
```

---

## Integration Points

### 1. Lead Conversion Extension

Modify `convertLeadsToRestaurants()` in lead-scrape-service.js:

```javascript
async function convertLeadsToRestaurants(leadIds, orgId, userId, options = {}) {
  const {
    addressSource = 'auto',
    createRegistrationBatch = false  // NEW OPTION
  } = options;

  // Existing conversion logic...
  const restaurants = await Promise.all(leadIds.map(convertLead));

  // NEW: Create registration batch if requested
  if (createRegistrationBatch && restaurants.length > 0) {
    const batchJob = await createRegistrationBatchJob({
      name: `Batch from ${leadScrapeJobName}`,
      organisation_id: orgId,
      source_lead_scrape_job_id: leadScrapeJobId,
      restaurant_ids: restaurants.map(r => r.id),
      created_by: userId
    });

    return { restaurants, batchJobId: batchJob.id };
  }

  return { restaurants };
}
```

### 2. UI Modification for Conversion

In PendingLeadsTable.tsx, add option to create registration batch:

```tsx
const handleConvert = async () => {
  const result = await convertMutation.mutateAsync({
    leadIds: selectedLeads,
    createRegistrationBatch: true  // New checkbox option
  });

  if (result.batchJobId) {
    // Navigate to registration batches page
    navigate(`/registration-batches/${result.batchJobId}`);
  }
};
```

---

## New UI Components

### 1. RegistrationBatches.tsx (Main Page)

```
Tabs: [Active Batches] [Completed] [Failed]

Active Batches Tab:
├── Filters (status, org)
├── BatchProgressCard[] with:
│   ├── Batch name & stats
│   ├── Overall progress bar
│   ├── Step progress indicators
│   └── Actions (view, pause, cancel)
```

### 2. RegistrationBatchDetail.tsx (Single Batch View)

```
Header: Batch name, status, progress

Restaurant Table:
├── Restaurant name
├── Current step
├── Status
├── Actions (view, configure)

Step Progress Panel:
├── Step 1: ✓ Completed (12/12 restaurants)
├── Step 2: ✓ Completed (12/12 restaurants)
├── Step 3: ⏳ Action Required (5/12 selected)
│   └── [Select Companies] button
├── Step 4-6: ○ Pending
```

### 3. CompanySelectionBatchView.tsx (Step 3 Action)

```
Restaurant List with Company Candidates:
├── Restaurant 1
│   ├── Search: "Pizza Palace, 123 Main St"
│   └── Candidates: [Select ▼]
│       ├── Pizza Palace Ltd (123-456-789)
│       ├── PP Holdings Ltd (987-654-321)
│       └── None of these
├── Restaurant 2
│   └── ...

[Save Selections] → Triggers Step 4
```

### 4. YoloModeConfigBatchView.tsx (Step 5 Action)

```
Common Settings:
├── [x] Use same password pattern for all
├── [x] Auto-configure services
├── [x] Import menus immediately

Per-Restaurant Overrides:
├── Restaurant 1: [Configure] (uses defaults)
├── Restaurant 2: [Configure] (custom settings)
├── Restaurant 3: [Configure] (uses defaults)

[Start Registration] → Triggers Step 6
```

---

## Backend Services

### 1. registration-batch-service.js

```javascript
// Core functions
async function createRegistrationBatchJob(data)
async function startBatchJob(batchId)
async function cancelBatchJob(batchId)
async function getBatchJob(batchId)
async function getBatchJobsForOrg(orgId, filters)

// Step progression
async function processStep1(batchId)  // Menu & branding
async function processStep2(batchId)  // Contact search
async function completeStep3(batchId, selections)  // Company selection
async function processStep4(batchId)  // Company details
async function completeStep5(batchId, configs)  // Yolo config
async function processStep6(batchId)  // Yolo execution
```

### 2. API Endpoints

```
POST   /api/registration-batches
GET    /api/registration-batches
GET    /api/registration-batches/:id
POST   /api/registration-batches/:id/start
POST   /api/registration-batches/:id/cancel

GET    /api/registration-batches/:id/step/:stepNumber
POST   /api/registration-batches/:id/step/:stepNumber/complete

GET    /api/registration-jobs/:id
GET    /api/registration-jobs/:id/steps
```

---

## Execution Flow

### Step 1: Menu & Branding (Automatic)

```javascript
async function processStep1(batchId) {
  const batch = await getBatchJob(batchId);

  for (const job of batch.registration_jobs) {
    await updateStepStatus(job.id, 1, 'in_progress');

    // Trigger extractions (already happens during conversion)
    // Just wait for completion
    await waitForExtractions(job.restaurant_id);

    await updateStepStatus(job.id, 1, 'completed');
  }

  // Auto-progress to Step 2
  await processStep2(batchId);
}
```

### Step 2: Contact Search (Automatic → Action Required)

```javascript
async function processStep2(batchId) {
  const batch = await getBatchJob(batchId);

  for (const job of batch.registration_jobs) {
    await updateStepStatus(job.id, 2, 'in_progress');

    const restaurant = await getRestaurant(job.restaurant_id);

    // Run companies office search
    const candidates = await searchCompaniesOffice({
      restaurantName: restaurant.name,
      street: restaurant.address,
      city: restaurant.city
    });

    // Persist candidates
    await saveSearchCandidates(job.id, restaurant.id, candidates);

    await updateStepStatus(job.id, 2, 'action_required');
  }

  // Batch step transitions to action_required
  await updateBatchStepStatus(batchId, 3, 'action_required');
}
```

### Step 3: Company Selection (Action Required)

User completes via UI, then:

```javascript
async function completeStep3(batchId, selections) {
  // selections = { restaurantId: companyNumber, ... }

  for (const [restaurantId, companyNumber] of Object.entries(selections)) {
    await updateSearchCandidate(restaurantId, {
      selected_company_number: companyNumber,
      status: 'selected'
    });

    await updateStepStatus(jobId, 3, 'completed');
  }

  // Auto-progress to Step 4
  await processStep4(batchId);
}
```

### Step 6: Yolo Mode Execution (Automatic with Sub-Steps)

```javascript
async function processStep6(batchId) {
  const batch = await getBatchJob(batchId);

  for (const job of batch.registration_jobs) {
    await updateStepStatus(job.id, 6, 'in_progress');

    // Execute yolo mode with sub-step tracking
    const subSteps = [
      'account', 'codeGeneration', 'onboardingUser', 'imageUpload',
      'restaurantRegistration', 'websiteConfig', 'servicesConfig',
      'paymentConfig', 'menuImport', 'onboardingSync', 'optionSets', 'itemTags'
    ];

    for (const subStep of subSteps) {
      await updateSubStepStatus(job.id, 6, subStep, 'running');

      try {
        await executeYoloModeStep(subStep, job);
        await updateSubStepStatus(job.id, 6, subStep, 'completed');
      } catch (error) {
        await updateSubStepStatus(job.id, 6, subStep, 'failed');
        // Handle retry or mark job as failed
      }
    }

    await updateStepStatus(job.id, 6, 'completed');
  }

  await updateBatchStatus(batchId, 'completed');
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create database migrations for new tables
2. Create registration-batch-service.js
3. Create API endpoints

### Phase 2: Lead Conversion Integration (Week 1-2)
1. Extend convertLeadsToRestaurants() for batch creation
2. Modify PendingLeadsTable UI for batch option
3. Implement Step 1 (extraction tracking)

### Phase 3: Contact Details Integration (Week 2)
1. Create companies_office_search_candidates table
2. Implement Step 2 (batch contact search)
3. Create CompanySelectionBatchView component
4. Implement Step 3 (selection handling)
5. Implement Step 4 (detail extraction)

### Phase 4: Yolo Mode Integration (Week 3)
1. Create YoloModeConfigBatchView component
2. Implement Step 5 (batch configuration)
3. Implement Step 6 (yolo execution with sub-steps)
4. Add sub-step progress tracking

### Phase 5: UI & Polish (Week 3-4)
1. Create RegistrationBatches.tsx page
2. Create RegistrationBatchDetail.tsx page
3. Add navigation and routing
4. Create polling hooks
5. Add progress visualizations

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Batch parent/child | Explicit batch table | Clear hierarchy, consistent with lead scrape |
| Sub-steps for Yolo | JSONB metadata | Single step with nested progress, simpler schema |
| Contact candidate persistence | Dedicated table | Required for async user selection |
| Step progression | Sequential with action_required gates | Matches existing patterns, enables user verification |
| Polling intervals | 5s active, 10s idle | Responsive without overwhelming |

---

## Success Criteria

1. **User can convert leads and start registration batch in one flow**
2. **Batch progress visible even after navigating away**
3. **Contact selection works asynchronously (user can leave and return)**
4. **Yolo mode executes for all restaurants without manual intervention**
5. **Failed restaurants can be retried without affecting completed ones**
6. **UI patterns consistent with existing LeadScrapes page**

---

## Files to Create/Modify

### New Files
```
src/services/registration-batch-service.js
src/routes/registration-batch-routes.js
src/pages/RegistrationBatches.tsx
src/pages/RegistrationBatchDetail.tsx
src/components/registration/BatchProgressCard.tsx
src/components/registration/CompanySelectionBatchView.tsx
src/components/registration/YoloModeConfigBatchView.tsx
src/hooks/useRegistrationBatch.ts
supabase/migrations/YYYYMMDD_add_registration_batch_tables.sql
```

### Modified Files
```
src/services/lead-scrape-service.js (extend conversion)
src/routes/leads-routes.js (add batch option)
src/components/leads/PendingLeadsTable.tsx (add batch UI)
src/App.tsx (add routes)
server.js (mount routes)
```

---

## Investigation Documents Reference

1. [INVESTIGATION_TASK_1_DATABASE_SCHEMA.md](./INVESTIGATION_TASK_1_DATABASE_SCHEMA.md) - Original registration job tables
2. [INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md](./INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md) - setImmediate patterns
3. [INVESTIGATION_TASK_3_FRONTEND_POLLING.md](./INVESTIGATION_TASK_3_FRONTEND_POLLING.md) - React Query polling
4. [INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md](./INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md) - Batch job structure
5. [INVESTIGATION_LEAD_CONVERSION_FLOW.md](./INVESTIGATION_LEAD_CONVERSION_FLOW.md) - Conversion integration
6. [INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md](./INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md) - Companies office flow
7. [INVESTIGATION_LEADSCRAPES_UI_PATTERNS.md](./INVESTIGATION_LEADSCRAPES_UI_PATTERNS.md) - UI component patterns
8. [INVESTIGATION_STEP_ORCHESTRATION.md](./INVESTIGATION_STEP_ORCHESTRATION.md) - Step handling patterns
