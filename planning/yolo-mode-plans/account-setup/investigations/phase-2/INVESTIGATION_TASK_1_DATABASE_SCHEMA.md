# Investigation Task 1: Database Schema for Async Yolo Mode

## Overview

This investigation analyzed existing job tracking patterns in the codebase to propose a database schema for async Yolo Mode registration jobs.

---

## Current Job Tracking Patterns

### Lead Scrape Job Tables (from `20251205_add_lead_scraping_tables.sql`)

#### `lead_scrape_jobs` Table
```sql
- id (UUID, PK)
- name, platform, country, city, city_code, region_code, cuisine
- leads_limit, page_offset, initial_url
- status (draft|pending|in_progress|completed|cancelled|failed)
- current_step, total_steps
- leads_extracted, leads_passed, leads_failed
- organisation_id (FK), created_by (FK)
- created_at, updated_at, started_at, completed_at, cancelled_at
- metadata (JSONB)
```

#### `lead_scrape_job_steps` Table
```sql
- id (UUID, PK)
- job_id (FK to lead_scrape_jobs)
- step_number, step_name, step_description
- step_type (automatic|action_required)
- status (pending|in_progress|action_required|completed|failed)
- target_url_template
- leads_received, leads_processed, leads_passed, leads_failed
- started_at, completed_at
- error_message
- metadata (JSONB)
```

### Existing Registration Tracking

Referenced in code but not in migrations:
- `pumpd_accounts`: Tracks user account registration (email, password, registration_status, registration_method)
- `pumpd_restaurants`: Tracks restaurant registration (links to pumpd_accounts)
- `registration_logs`: Logs registration actions with request/response data

---

## Yolo Mode Execution Phases

From `useYoloModeExecution.ts`, there are 4 phases with 12 total steps:

**Phase 1 (Parallel Initial Operations):**
- Account Registration (BLOCKING)
- Code Generation
- Onboarding User Creation (conditional)
- Image Upload to CDN

**Phase 2 (Configuration - Parallel after Phase 1):**
- Restaurant Registration (BLOCKING for remaining steps)
- Website Configuration
- Services Configuration
- Payment Configuration
- Menu Import (blocking for Phase 3/4)
- Onboarding Sync (conditional)

**Phase 3 (Menu Setup - Sequential):**
- Option Sets (depends on Menu Import)

**Phase 4 (Finalization):**
- Item Tags (depends on Menu Import)

---

## Key Differences from Lead Scrape Jobs

| Aspect | Lead Scrape | Registration |
|--------|-------------|--------------|
| Execution Flow | Step-by-step sequential | Complex parallel with dependencies |
| Step Dependencies | Independent | Intricate blocking relationships |
| Configuration | Simple parameters | Extensive (account, restaurant, menu, payment) |
| Retry Strategy | Simple retry-per-step | Phase-aware retry logic |
| Result Tracking | Counts (leads_extracted) | IDs (pumpd_user_id, pumpd_restaurant_id) |

---

## Proposed Schema Design

### `registration_jobs` Table

```sql
CREATE TABLE IF NOT EXISTS public.registration_jobs (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Basic Info
  name TEXT NOT NULL,
  restaurant_id UUID NOT NULL,
  organisation_id UUID NOT NULL,

  -- Configuration (JSONB for flexibility)
  execution_config JSONB NOT NULL DEFAULT '{}',  -- Stores form data from YoloModeDialog

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed, cancelled
  current_phase TEXT DEFAULT NULL,  -- phase1, phase2, phase3, phase4
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 12,

  -- Phase-specific progress
  phase1_status TEXT DEFAULT 'pending',
  phase2_status TEXT DEFAULT 'pending',
  phase3_status TEXT DEFAULT 'pending',
  phase4_status TEXT DEFAULT 'pending',

  -- Result tracking (from API responses)
  execution_results JSONB DEFAULT '{}',
  pumpd_user_id UUID NULL,
  pumpd_restaurant_id UUID NULL,

  -- Error tracking
  error_message TEXT NULL,
  last_error_details JSONB NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Foreign Keys
  CONSTRAINT registration_jobs_restaurant_fk FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT registration_jobs_org_fk FOREIGN KEY (organisation_id)
    REFERENCES organisations(id),

  -- Check Constraints
  CONSTRAINT registration_jobs_status_check CHECK (
    status = ANY (ARRAY['pending', 'in_progress', 'completed', 'failed', 'cancelled'])
  ),
  CONSTRAINT registration_jobs_phase_check CHECK (
    current_phase IS NULL OR current_phase = ANY (ARRAY['phase1', 'phase2', 'phase3', 'phase4'])
  )
);

-- Indexes
CREATE INDEX idx_registration_jobs_status ON public.registration_jobs USING BTREE (status);
CREATE INDEX idx_registration_jobs_restaurant ON public.registration_jobs USING BTREE (restaurant_id);
CREATE INDEX idx_registration_jobs_org ON public.registration_jobs USING BTREE (organisation_id);
CREATE INDEX idx_registration_jobs_created_at ON public.registration_jobs USING BTREE (created_at DESC);

-- Updated_at Trigger
CREATE TRIGGER update_registration_jobs_updated_at
  BEFORE UPDATE ON registration_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### `registration_job_steps` Table

```sql
CREATE TABLE IF NOT EXISTS public.registration_job_steps (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Relationships
  job_id UUID NOT NULL,

  -- Step identification
  step_id TEXT NOT NULL,  -- account, codeGeneration, onboardingUser, etc.
  step_number INTEGER NOT NULL,
  phase INTEGER NOT NULL,  -- 1, 2, 3, or 4
  step_label TEXT NOT NULL,

  -- Execution tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, skipped, retrying
  step_type TEXT DEFAULT 'automatic',  -- automatic, action_required

  -- Execution details
  start_time BIGINT NULL,  -- Unix timestamp (milliseconds)
  end_time BIGINT NULL,
  duration_ms INTEGER NULL,

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Results
  result_data JSONB DEFAULT '{}',
  error_message TEXT NULL,
  error_details JSONB NULL,

  -- Conditional execution
  is_conditional BOOLEAN DEFAULT FALSE,
  condition_not_met_reason TEXT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Foreign Keys & Constraints
  CONSTRAINT registration_job_steps_job_fk FOREIGN KEY (job_id)
    REFERENCES registration_jobs(id) ON DELETE CASCADE,
  CONSTRAINT registration_job_steps_unique_step UNIQUE (job_id, step_id),
  CONSTRAINT registration_job_steps_status_check CHECK (
    status = ANY (ARRAY['pending', 'running', 'completed', 'failed', 'skipped', 'retrying'])
  ),
  CONSTRAINT registration_job_steps_phase_check CHECK (
    phase >= 1 AND phase <= 4
  )
);

-- Indexes
CREATE INDEX idx_registration_job_steps_job_id ON public.registration_job_steps USING BTREE (job_id);
CREATE INDEX idx_registration_job_steps_status ON public.registration_job_steps USING BTREE (status);
CREATE INDEX idx_registration_job_steps_phase ON public.registration_job_steps USING BTREE (phase);

-- Updated_at Trigger
CREATE TRIGGER update_registration_job_steps_updated_at
  BEFORE UPDATE ON registration_job_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### RLS Policies

```sql
ALTER TABLE public.registration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_job_steps ENABLE ROW LEVEL SECURITY;

-- Policies for registration_jobs
CREATE POLICY "Users can view their org's registration jobs" ON public.registration_jobs
  FOR SELECT USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can create registration jobs for their org" ON public.registration_jobs
  FOR INSERT WITH CHECK (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can update their org's registration jobs" ON public.registration_jobs
  FOR UPDATE USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policies for registration_job_steps (inherited from parent job)
CREATE POLICY "Users can view steps for their org's jobs" ON public.registration_job_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registration_jobs
      WHERE id = registration_job_steps.job_id
      AND organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );
```

---

## Migration Considerations

1. **File Naming**: `20251220_add_registration_job_tables.sql`
2. **Phase-Specific Tracking**: Separate `phase_X_status` columns for quick phase status queries
3. **JSONB Storage**: `execution_config` stores entire YoloModeDialog form data for reproducibility
4. **Backward Compatibility**: Handle existing `pumpd_accounts` and `pumpd_restaurants` tables
5. **Indexing Strategy**: Focus on status, restaurant_id, org_id for filtering/polling queries
6. **Timestamp Precision**: BIGINT milliseconds for duration matching frontend `Date.now()` values

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate step table | Detailed audit trail, independent step management |
| Phase-based grouping | Quick determination of which phase completed |
| execution_config JSONB | Entire form submission for replay/debugging |
| Flexible result_data | Each step stores its own API response |
| Retry tracking per step | Matches frontend MAX_RETRIES = 3 |
| Conditional step handling | Tracks skipped conditional steps |
| No direct job queue | Table-based tracking allows familiar polling pattern |
