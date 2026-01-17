# TASK 1: Database Schema Investigation - Async Job Queue Pattern

**Completed:** 2025-12-09
**Status:** Complete
**Project ID:** qgabsyggzlkcstjzugdh

---

## Executive Summary

The Supabase project already has established patterns for job tracking through:
1. **extraction_jobs** table (menu extraction tracking)
2. **lead_scrape_jobs** table (lead scraping with multi-step job support)
3. **lead_scrape_job_steps** table (step-level tracking for complex workflows)

These existing tables provide excellent references for designing a generalized async job queue. The system currently uses:
- **Service Role Key** for backend operations (bypasses RLS)
- **Anon Key** option for client-side operations with RLS
- PostgreSQL TIMESTAMPTZ for timestamps with automatic update triggers
- UUID primary keys with proper foreign key constraints
- JSONB for flexible payload storage
- Composite indexes for query optimization

---

## Answers to Investigation Questions

### 1. How is Supabase Currently Configured and Accessed?

**Configuration:**
- Project ID: `qgabsyggzlkcstjzugdh`
- Region: `ap-southeast-1`
- URL: `https://qgabsyggzlkcstjzugdh.supabase.co`
- Database: PostgreSQL 17.4.1.074

**Environment Variables (.env):**
```
SUPABASE_URL=https://qgabsyggzlkcstjzugdh.supabase.co
SUPABASE_ANON_KEY=eyJhbGc... (JWT-based anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (Service role key)
```

**Client Initialization Pattern:**
```javascript
// From database-service.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.SUPABASE_SERVICE_KEY || 
                    process.env.SUPABASE_ANON_KEY;

let supabase = null;

function initializeDatabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Database] Supabase URL or key not found');
    return false;
  }
  
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Database] Supabase client initialized');
    return true;
  } catch (error) {
    console.error('[Database] Failed to initialize:', error);
    return false;
  }
}
```

**Design Pattern:**
- Single Supabase client instance (lazy-initialized)
- Service role key preferred for backend operations
- Supports user-authenticated client via token (for RLS)
- Default org ID fallback: `'00000000-0000-0000-0000-000000000000'`

---

### 2. What Authentication Pattern is Used?

**Two-Tier Authentication Pattern:**

1. **Backend (Service Role)**
   - Uses `SUPABASE_SERVICE_ROLE_KEY`
   - Bypasses Row Level Security (RLS)
   - Full database access for backend operations
   - Used for extraction jobs, imports, system operations

2. **User-Authenticated (Anon Key + Token)**
   - Uses `SUPABASE_ANON_KEY` with JWT token
   - Respects Row Level Security (RLS) policies
   - User context through `auth.uid()`
   - Used when creating authenticated client with token

**Code Pattern for User Client:**
```javascript
function setUserSupabaseClient(token) {
  if (token && supabaseUrl) {
    userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    console.log('[Database] User-authenticated client created');
  }
}

// Smart client getter - uses user auth if available, falls back to service role
function getSupabaseClient() {
  return userSupabaseClient || supabase;
}
```

**RLS Pattern Examples:**
```sql
-- From add_archive_access_control_optimized.sql
CREATE POLICY "Enable read access for org members" ON extraction_jobs
FOR SELECT
USING (
  user_can_access_org_data(auth.uid(), organisation_id)
);

CREATE POLICY "Enable insert for org members" ON extraction_jobs
FOR INSERT
WITH CHECK (
  user_can_access_org_data(auth.uid(), organisation_id)
);
```

---

### 3. Are There Any Existing Job/Task Tracking Tables?

**YES - Two Comprehensive Systems Exist:**

#### System 1: extraction_jobs (Menu Extraction)
```sql
-- Current schema (from planning/database-plans/sales-specific-features/database-schemas/extraction_jobs.sql)
create table public.extraction_jobs (
  id uuid not null default extensions.uuid_generate_v4(),
  job_id character varying(100) not null,          -- Unique job identifier
  restaurant_id uuid null,
  platform_id uuid null,
  url text not null,
  job_type character varying(50) not null,         -- 'full_menu', etc.
  status character varying(50) not null default 'pending',  -- pending, in_progress, completed, failed
  progress jsonb null default '{}'::jsonb,         -- Progress tracking data
  config jsonb null default '{}'::jsonb,           -- Job configuration
  error text null,                                  -- Error message
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  organisation_id uuid null,
  
  constraint extraction_jobs_pkey primary key (id),
  constraint extraction_jobs_job_id_key unique (job_id),
  constraint extraction_jobs_organisation_id_fkey foreign key (organisation_id) references organisations (id),
  constraint extraction_jobs_platform_id_fkey foreign key (platform_id) references platforms (id),
  constraint extraction_jobs_restaurant_id_fkey foreign key (restaurant_id) references restaurants (id) on delete cascade
);

-- Indexes
create index idx_extraction_jobs_status on public.extraction_jobs using btree (status);
create index idx_extraction_jobs_restaurant on public.extraction_jobs using btree (restaurant_id);
create index idx_extraction_jobs_org on public.extraction_jobs using btree (organisation_id);

-- Auto-update timestamp trigger
create trigger update_extraction_jobs_updated_at before update on extraction_jobs 
for each row execute function update_updated_at_column();
```

**Current Usage in Code:**
```javascript
// Creating a job
async function createExtractionJob(jobData, organisationId = null) {
  const { data, error } = await client
    .from('extraction_jobs')
    .insert({
      job_id: jobData.jobId,
      restaurant_id: jobData.restaurantId,
      platform_id: jobData.platformId,
      url: jobData.url,
      job_type: jobData.jobType || 'full_menu',
      status: 'pending',
      config: jobData.config || {},
      organisation_id: orgId,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
}

// Updating a job
async function updateExtractionJob(jobId, updates) {
  const { data, error } = await client
    .from('extraction_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('job_id', jobId)
    .select()
    .single();
}

// Getting a job with relationships
async function getExtractionJob(jobId) {
  const { data, error } = await client
    .from('extraction_jobs')
    .select(`
      *,
      restaurants (name, slug),
      platforms (name)
    `)
    .eq('job_id', jobId)
    .single();
}
```

#### System 2: lead_scrape_jobs (Multi-Step Job Framework)
```sql
-- More advanced schema with multi-step support (deployed Dec 5, 2025)
create table if not exists public.lead_scrape_jobs (
  id uuid not null default extensions.uuid_generate_v4(),
  name text not null,
  platform text not null,
  country text not null default 'nz',
  city text null,
  city_code text null,
  region_code text null,
  cuisine text null,
  leads_limit integer not null default 21,
  page_offset integer null default 1,
  initial_url text null,
  status text not null default 'draft',  -- draft, pending, in_progress, completed, cancelled, failed
  current_step integer null default 0,    -- Tracks multi-step progress
  total_steps integer null,
  leads_extracted integer null default 0,
  leads_passed integer null default 0,
  leads_failed integer null default 0,
  organisation_id uuid null,
  created_by uuid null,                   -- User who created job
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb, -- Flexible metadata storage
  
  constraint lead_scrape_jobs_pkey primary key (id),
  constraint lead_scrape_jobs_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint lead_scrape_jobs_organisation_id_fkey foreign key (organisation_id) references organisations (id),
  constraint lead_scrape_jobs_status_check check (
    status = any (array['draft'::text, 'pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'failed'::text])
  ),
  constraint lead_scrape_jobs_leads_limit_check check (leads_limit > 0 and leads_limit <= 999),
  constraint lead_scrape_jobs_page_offset_check check (page_offset >= 1 and page_offset <= 999)
);

-- Indexes for common queries
create index idx_lead_scrape_jobs_status on public.lead_scrape_jobs using btree (status);
create index idx_lead_scrape_jobs_org on public.lead_scrape_jobs using btree (organisation_id);
create index idx_lead_scrape_jobs_created_at on public.lead_scrape_jobs using btree (created_at desc);
```

#### System 2b: lead_scrape_job_steps (Step-Level Tracking)
```sql
-- For multi-step job tracking
create table if not exists public.lead_scrape_job_steps (
  id uuid not null default extensions.uuid_generate_v4(),
  job_id uuid not null,
  step_number integer not null,
  step_name text not null,
  step_description text null,
  step_type text not null default 'automatic',     -- automatic, action_required
  status text not null default 'pending',          -- pending, in_progress, action_required, completed, failed
  target_url_template text null,
  leads_received integer null default 0,
  leads_processed integer null default 0,
  leads_passed integer null default 0,
  leads_failed integer null default 0,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,
  error_message text null,
  
  constraint lead_scrape_job_steps_pkey primary key (id),
  constraint lead_scrape_job_steps_job_id_fkey foreign key (job_id) 
    references lead_scrape_jobs (id) on delete cascade,
  constraint lead_scrape_job_steps_unique_step unique (job_id, step_number),
  constraint lead_scrape_job_steps_status_check check (
    status = any (array['pending'::text, 'in_progress'::text, 'action_required'::text, 'completed'::text, 'failed'::text])
  )
);

-- Indexes
create index idx_lead_scrape_job_steps_job_id on public.lead_scrape_job_steps using btree (job_id);
create index idx_lead_scrape_job_steps_status on public.lead_scrape_job_steps using btree (status);
create index idx_lead_scrape_job_steps_step_number on public.lead_scrape_job_steps using btree (step_number);
```

---

### 4. What's the Pattern for Database Operations?

**Pattern: Supabase JavaScript Client (Not Raw SQL)**

The codebase exclusively uses the Supabase JavaScript client library, NOT raw SQL queries:

```javascript
// ✅ USED: Supabase JS client
const { data, error } = await client
  .from('extraction_jobs')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: true });

// ❌ NOT USED: Raw SQL queries
// const result = await db.query('SELECT * FROM extraction_jobs WHERE status = ?', ['pending']);
```

**Common Patterns:**

1. **INSERT Operations:**
```javascript
const { data, error } = await client
  .from('table_name')
  .insert({ field1: value1, field2: value2 })
  .select()
  .single();
```

2. **UPDATE Operations:**
```javascript
const { data, error } = await client
  .from('table_name')
  .update({ status: 'completed' })
  .eq('id', jobId)
  .select()
  .single();
```

3. **SELECT Operations with Relationships:**
```javascript
const { data, error } = await client
  .from('table_name')
  .select(`
    *,
    related_table (field1, field2),
    another_table (*)
  `)
  .eq('organisation_id', orgId)
  .order('created_at', { ascending: false });
```

4. **Filter Patterns:**
```javascript
// Simple equality
.eq('status', 'pending')

// Arrays
.in('status', ['pending', 'in_progress'])

// Comparisons
.gt('created_at', timestamp)
.lt('created_at', timestamp)

// Text search
.ilike('name', '%pattern%')
```

5. **Error Handling Pattern:**
```javascript
try {
  const { data, error } = await client.from('table').select('*');
  if (error) throw error;
  return data;
} catch (error) {
  console.error('[Database] Error message:', error);
  return null;
}
```

**Advantages of this Approach:**
- Type safety (with TypeScript)
- Automatic RLS enforcement
- No SQL injection risks
- Built-in real-time subscription support
- Cleaner code than raw SQL

---

## Existing Database Tables Related to Job Tracking

### Table Relationships:
```
organisations (org_id)
    ├─ extraction_jobs
    │   ├─ restaurants (restaurant_id)
    │   ├─ platforms (platform_id)
    │   └─ menus (extraction_job_id)
    │
    └─ lead_scrape_jobs
        └─ lead_scrape_job_steps (job_id)
```

### Table Summaries:

| Table | Purpose | Status | Records | Key Fields |
|-------|---------|--------|---------|-----------|
| extraction_jobs | Menu extraction tracking | Active | ~100s | job_id, status, job_type, progress, config, error |
| lead_scrape_jobs | Lead scraping jobs | Deployed 12/5/25 | New | status, current_step, total_steps, metadata |
| lead_scrape_job_steps | Multi-step tracking | Deployed 12/5/25 | New | job_id, step_number, status, error_message |
| menus | Menu versions | Active | ~1000s | restaurant_id, extraction_job_id, is_merged |
| merge_operations | Menu merge tracking | Deployed 8/22/25 | New | restaurant_id, result_menu_id, source_menu_ids |
| registration_logs | Registration attempts | Active | ~100s | restaurant_id, pumpd_account_id, action, status |

---

## Proposed Generic Jobs Table Schema

Based on investigation findings, here's the recommended schema for a generalized async job queue:

### Recommended Approach: Extend Existing Pattern

Rather than creating a completely new table, we should either:

**Option A: Extend extraction_jobs to be generic (SIMPLER)**
```sql
-- Add new columns to extraction_jobs to support more job types
ALTER TABLE public.extraction_jobs
  ADD COLUMN IF NOT EXISTS job_category VARCHAR(50),  -- 'extraction', 'import', 'tagging', 'optimization'
  ADD COLUMN IF NOT EXISTS retries INTEGER DEFAULT 0 MAX 3,
  ADD COLUMN IF NOT EXISTS result JSONB,  -- Store job results
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Update constraint to support more job types
ALTER TABLE public.extraction_jobs
  DROP CONSTRAINT IF EXISTS check_job_type;

ALTER TABLE public.extraction_jobs
  ADD CONSTRAINT check_job_type CHECK (job_type IN (
    'full_menu',
    'add_item_tags',
    'add_option_sets',
    'import_csv',
    'image_upload',
    'bulk_update'
  ));
```

**Option B: Create New Generic Jobs Table (CLEANER - RECOMMENDED)**

```sql
-- ============================================================================
-- CREATE GENERIC ASYNC JOBS TABLE
-- ============================================================================
-- Purpose: Unified job queue for all long-running async operations
-- Supports: extract menus, import CSVs, tag items, upload images, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(100) NOT NULL UNIQUE,  -- Human-readable job identifier
  
  -- Job Classification
  job_type VARCHAR(50) NOT NULL,        -- 'add-item-tags', 'add-option-sets', 'import-csv', 'image-upload', 'extract-menu'
  job_category VARCHAR(50),              -- Category for grouping (optional): 'extraction', 'import', 'enrichment', 'optimization'
  
  -- Status Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Enum: pending, queued, in_progress, paused, completed, failed, cancelled
  
  -- Input & Output
  input_payload JSONB,                  -- Job input parameters (required for reconstruction)
  result JSONB,                         -- Job results/output data
  error_message TEXT,                   -- Last error message if failed
  
  -- Execution Details
  retries INTEGER DEFAULT 0,            -- Number of retry attempts
  max_retries INTEGER DEFAULT 3,        -- Maximum allowed retries
  retry_delay_ms INTEGER DEFAULT 1000,  -- Milliseconds to wait before retry
  execution_time_ms INTEGER,            -- How long the job took to execute
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,               -- When execution began
  completed_at TIMESTAMPTZ,             -- When execution finished
  cancelled_at TIMESTAMPTZ,             -- If job was cancelled
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  -- Context
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Relationships (for linking to related entities)
  parent_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,  -- For sub-jobs
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,   -- Custom metadata for job-specific use
  priority INTEGER DEFAULT 0,           -- Higher = earlier execution (-10 to 10)
  
  -- Constraints
  CONSTRAINT check_status CHECK (status IN (
    'pending',
    'queued',
    'in_progress',
    'paused',
    'completed',
    'failed',
    'cancelled'
  )),
  CONSTRAINT check_job_type CHECK (job_type IN (
    'add-item-tags',
    'add-option-sets',
    'import-csv',
    'image-upload',
    'extract-menu',
    'merge-menus',
    'bulk-update',
    'generate-content'
  )),
  CONSTRAINT check_retries CHECK (retries >= 0 AND retries <= max_retries),
  CONSTRAINT check_completed_timestamp CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT check_started_timestamp CHECK (
    (status IN ('in_progress', 'completed', 'failed', 'cancelled') AND started_at IS NOT NULL) OR
    (status NOT IN ('in_progress', 'completed', 'failed', 'cancelled') AND started_at IS NULL)
  )
) TABLESPACE pg_default;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Basic lookup indexes
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON public.jobs USING BTREE (job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs USING BTREE (status);
CREATE INDEX IF NOT EXISTS idx_jobs_organisation_id ON public.jobs USING BTREE (organisation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_restaurant_id ON public.jobs USING BTREE (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs USING BTREE (created_by);

-- For queue processing (find next job to execute)
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON public.jobs USING BTREE (
  status,
  priority DESC,
  created_at ASC
) WHERE status IN ('pending', 'queued');

-- For pagination and sorting
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs USING BTREE (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at ON public.jobs USING BTREE (completed_at DESC);

-- For filtering by job type and category
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON public.jobs USING BTREE (job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_job_category ON public.jobs USING BTREE (job_category);

-- For finding failed jobs requiring attention
CREATE INDEX IF NOT EXISTS idx_jobs_failed ON public.jobs USING BTREE (created_at DESC) 
  WHERE status = 'failed';

-- For finding jobs with retry potential
CREATE INDEX IF NOT EXISTS idx_jobs_retryable ON public.jobs USING BTREE (created_at ASC)
  WHERE status = 'failed' AND retries < max_retries;

-- For parent-child job relationships
CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id ON public.jobs USING BTREE (parent_job_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp on any modification
CREATE OR REPLACE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on the jobs table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see jobs from their organizations
CREATE POLICY "Enable read access for org members" ON public.jobs
FOR SELECT
USING (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR -- Allow super admins
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Policy: Users can only insert jobs for their organizations
CREATE POLICY "Enable insert for org members" ON public.jobs
FOR INSERT
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR -- Allow super admins
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Policy: Users can update jobs they created or admins can update any
CREATE POLICY "Enable update for org members" ON public.jobs
FOR UPDATE
USING (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR -- Allow super admins
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for queue monitoring
CREATE OR REPLACE VIEW public.jobs_queue_status AS
SELECT
  job_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as latest_job,
  AVG(
    EXTRACT(EPOCH FROM (COALESCE(completed_at, CURRENT_TIMESTAMP) - started_at))
  ) as avg_duration_seconds
FROM public.jobs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY job_type, status
ORDER BY job_type, status;

-- View for failed jobs requiring attention
CREATE OR REPLACE VIEW public.jobs_failed_summary AS
SELECT
  id,
  job_id,
  job_type,
  organisation_id,
  restaurant_id,
  error_message,
  retries,
  max_retries,
  created_at,
  started_at
FROM public.jobs
WHERE status = 'failed'
  AND retries < max_retries
ORDER BY created_at DESC;

-- View for job processing metrics
CREATE OR REPLACE VIEW public.jobs_metrics AS
SELECT
  job_type,
  COUNT(*) as total_jobs,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN status IN ('pending', 'queued', 'in_progress') THEN 1 ELSE 0 END) as in_progress_count,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as success_rate_percent,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, CURRENT_TIMESTAMP) - started_at))) / 60,
    2
  ) as avg_duration_minutes
FROM public.jobs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY job_type
ORDER BY total_jobs DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.jobs IS 'Generic async job queue for all long-running operations';
COMMENT ON COLUMN public.jobs.job_id IS 'Human-readable unique job identifier (e.g., "extract-ubereats-pizza-palace-20251209")';
COMMENT ON COLUMN public.jobs.job_type IS 'Type of job: add-item-tags, add-option-sets, import-csv, image-upload, extract-menu, merge-menus, bulk-update, generate-content';
COMMENT ON COLUMN public.jobs.status IS 'Job status: pending (created), queued (ready), in_progress (executing), completed (success), failed (error), cancelled (user stop)';
COMMENT ON COLUMN public.jobs.input_payload IS 'Job input parameters as JSONB - allows job reconstruction and audit trail';
COMMENT ON COLUMN public.jobs.result IS 'Job output/results as JSONB - stores processed data, metrics, generated content, etc.';
COMMENT ON COLUMN public.jobs.error_message IS 'Human-readable error message if job failed - useful for debugging';
COMMENT ON COLUMN public.jobs.retries IS 'Number of retry attempts made so far';
COMMENT ON COLUMN public.jobs.max_retries IS 'Maximum number of retries allowed before permanent failure';
COMMENT ON COLUMN public.jobs.execution_time_ms IS 'Total execution time in milliseconds (completed_at - started_at)';
COMMENT ON COLUMN public.jobs.priority IS 'Job priority for queue ordering: -10 (lowest) to +10 (highest), 0 = normal';
COMMENT ON COLUMN public.jobs.parent_job_id IS 'For jobs that spawn sub-jobs (e.g., import multiple items)';
COMMENT ON COLUMN public.jobs.metadata IS 'Job-specific metadata as JSONB - for storing custom fields per job type';
```

---

## Database Operations Service Interface

The `database-service.js` exports pattern should be extended with job operations:

```javascript
// Add to module.exports in database-service.js
module.exports = {
  // ... existing exports ...
  
  // Job Queue Operations
  createJob,                    // Create new job
  updateJobStatus,              // Update job status
  updateJobProgress,            // Update job progress (in input_payload)
  updateJobResult,              // Update job result after completion
  markJobFailed,                // Mark job as failed with error
  getJob,                       // Get single job
  getJobs,                      // Get multiple jobs with filters
  getNextQueuedJob,             // Get next job to execute (for worker)
  retryFailedJob,               // Retry a failed job
  cancelJob,                    // Cancel a running job
  getJobMetrics,                // Get queue metrics
  getFailedJobsSummary,         // Get jobs needing attention
};
```

**Example Implementation:**

```javascript
/**
 * Create a new async job
 */
async function createJob(jobData, organisationId) {
  if (!isDatabaseAvailable()) return null;
  
  const {
    jobType,
    jobCategory,
    inputPayload,
    restaurantId = null,
    createdBy = null,
    priority = 0,
    maxRetries = 3
  } = jobData;
  
  // Generate human-readable job ID
  const jobId = `${jobType}-${restaurantId ? restaurantId.substring(0, 8) : 'generic'}-${Date.now()}`;
  
  try {
    const { data, error } = await getSupabaseClient()
      .from('jobs')
      .insert({
        job_id: jobId,
        job_type: jobType,
        job_category: jobCategory,
        status: 'pending',
        input_payload: inputPayload,
        restaurant_id: restaurantId,
        created_by: createdBy,
        priority,
        max_retries: maxRetries,
        organisation_id: organisationId
      })
      .select()
      .single();
    
    if (error) throw error;
    console.log(`[Jobs] Created job: ${jobId}`);
    return data;
  } catch (error) {
    console.error('[Jobs] Error creating job:', error);
    return null;
  }
}

/**
 * Get the next job to process from queue
 */
async function getNextQueuedJob(jobTypes = null) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    let query = getSupabaseClient()
      .from('jobs')
      .select('*')
      .in('status', ['pending', 'queued'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (jobTypes && jobTypes.length > 0) {
      query = query.in('job_type', jobTypes);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('[Jobs] Error getting next queued job:', error);
    return null;
  }
}

/**
 * Mark job as failed with retry logic
 */
async function markJobFailed(jobId, errorMessage) {
  if (!isDatabaseAvailable()) return false;
  
  try {
    // Get current job to check retry count
    const job = await getJob(jobId);
    if (!job) return false;
    
    const shouldRetry = job.retries < job.max_retries;
    const newStatus = shouldRetry ? 'pending' : 'failed'; // Retry as pending
    
    const { error } = await getSupabaseClient()
      .from('jobs')
      .update({
        status: newStatus,
        error_message: errorMessage,
        retries: job.retries + 1,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId);
    
    if (error) throw error;
    
    const action = shouldRetry ? `scheduled for retry` : `marked as failed`;
    console.log(`[Jobs] Job ${jobId} ${action}`);
    return true;
  } catch (error) {
    console.error('[Jobs] Error marking job as failed:', error);
    return false;
  }
}
```

---

## Recommendations

### 1. **Table Design**
- Use **Option B: Create New Generic Jobs Table** ✅ RECOMMENDED
- Reason: Cleaner separation of concerns, extensible for future job types, doesn't modify existing extraction_jobs table
- Implementation: ~1-2 weeks of development + testing

### 2. **Job Types to Support**
Based on codebase analysis, initially support:
- `add-item-tags` - Tag menu items with attributes
- `add-option-sets` - Process item options/variations
- `import-csv` - Import menu from CSV
- `image-upload` - Upload images to CDN
- `extract-menu` - Extract menu from platform (like current extraction_jobs)
- `merge-menus` - Merge multiple menu versions
- `bulk-update` - Bulk modify items
- `generate-content` - AI-generated descriptions

### 3. **Job Queue Processing**
Implement a separate job worker process:
- Poll for jobs every 30-60 seconds
- Process in priority order
- Implement exponential backoff retry
- Log all execution details for debugging

### 4. **Monitoring & Observability**
Add the provided views and queries:
- `jobs_queue_status` - Monitor queue health
- `jobs_failed_summary` - See failed jobs needing attention
- `jobs_metrics` - Track success rates and performance

### 5. **Migration Path**
- Phase 1: Create new `jobs` table alongside existing extraction_jobs
- Phase 2: Keep extraction_jobs for backward compatibility
- Phase 3: Migrate existing workflows to use new jobs table
- Phase 4: Deprecate extraction_jobs after full migration

---

## Potential Concerns & Blockers

### 1. **Concurrency & Race Conditions**
**Concern:** Multiple workers processing same job simultaneously  
**Mitigation:** Add job locking mechanism (atomic status update)
```sql
-- Pessimistic lock on job pickup
UPDATE jobs 
SET status = 'in_progress', started_at = NOW()
WHERE id = $1 
  AND status IN ('pending', 'queued')
RETURNING *;
```

### 2. **Database Load**
**Concern:** Frequent polling for new jobs could overload database  
**Mitigation:**
- Implement polling intervals (30-60 seconds minimum)
- Use connection pooling
- Consider Redis cache layer for queue (optional)
- Batch process jobs where possible

### 3. **Long-Running Job Timeout**
**Concern:** Jobs might hang indefinitely  
**Mitigation:**
- Add `timeout_at` column (for future)
- Implement job heartbeat mechanism
- Set max execution times per job type

### 4. **Storage of Large Payloads**
**Concern:** JSONB fields might store very large datasets  
**Mitigation:**
- Limit input_payload to config/reference data only
- Store actual data in separate tables
- Reference data by ID in input_payload
- Example: Instead of storing all menu items, store restaurant_id + filters

### 5. **RLS Performance**
**Concern:** RLS policies might slow down queue polling  
**Mitigation:**
- Use service role key for worker process (bypasses RLS)
- Create separate query functions for queue processing
- Index on (status, priority, created_at) as shown

### 6. **Data Retention**
**Concern:** Jobs table could grow very large  
**Mitigation:** (Implement in Phase 2)
- Archive completed jobs older than 30 days
- Implement data retention policy
- Add archival table: `jobs_archive`

---

## Code Snippets for Integration

### Database Service Extension

```javascript
// Add to src/services/database-service.js

/**
 * Job Queue Operations
 */

async function createJob(jobData, organisationId = null) {
  if (!isDatabaseAvailable()) return null;
  
  const orgId = organisationId || getCurrentOrganizationId();
  const {
    jobType,
    jobCategory,
    inputPayload,
    restaurantId = null,
    createdBy = null,
    priority = 0,
    maxRetries = 3
  } = jobData;
  
  // Generate unique job ID
  const timestamp = Date.now();
  const jobId = `${jobType}-${timestamp}`;
  
  try {
    const { data, error } = await getSupabaseClient()
      .from('jobs')
      .insert({
        job_id: jobId,
        job_type: jobType,
        job_category: jobCategory,
        status: 'pending',
        input_payload: inputPayload,
        restaurant_id: restaurantId,
        created_by: createdBy,
        priority,
        max_retries: maxRetries,
        organisation_id: orgId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    console.log(`[Jobs] Created job: ${jobId}`);
    return data;
  } catch (error) {
    console.error('[Jobs] Error creating job:', error);
    return null;
  }
}

async function updateJobStatus(jobId, status, metadata = null) {
  if (!isDatabaseAvailable()) return null;
  
  if (!['pending', 'queued', 'in_progress', 'paused', 'completed', 'failed', 'cancelled'].includes(status)) {
    console.error('[Jobs] Invalid status:', status);
    return null;
  }
  
  try {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    
    // Set timing based on status
    if (status === 'in_progress' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
    }
    
    const { data, error } = await getSupabaseClient()
      .from('jobs')
      .update(updates)
      .eq('job_id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Jobs] Error updating job status:', error);
    return null;
  }
}

async function updateJobResult(jobId, result, executionTimeMs = null) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const updates = {
      result,
      status: 'completed',
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTimeMs,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await getSupabaseClient()
      .from('jobs')
      .update(updates)
      .eq('job_id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    console.log(`[Jobs] Job ${jobId} completed in ${executionTimeMs}ms`);
    return data;
  } catch (error) {
    console.error('[Jobs] Error updating job result:', error);
    return null;
  }
}

async function getNextQueuedJob(jobTypes = null) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    let query = getSupabaseClient()
      .from('jobs')
      .select('*')
      .in('status', ['pending', 'queued'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (jobTypes && jobTypes.length > 0) {
      query = query.in('job_type', jobTypes);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('[Jobs] Error getting next queued job:', error);
    return null;
  }
}

async function getJob(jobId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const { data, error } = await getSupabaseClient()
      .from('jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Jobs] Error getting job:', error);
    return null;
  }
}

async function getJobs(filters = {}) {
  if (!isDatabaseAvailable()) return [];
  
  const {
    status = null,
    jobType = null,
    restaurantId = null,
    organisationId = null,
    limit = 50,
    offset = 0
  } = filters;
  
  try {
    let query = getSupabaseClient()
      .from('jobs')
      .select('*');
    
    if (status) query = query.eq('status', status);
    if (jobType) query = query.eq('job_type', jobType);
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    if (organisationId) query = query.eq('organisation_id', organisationId);
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Jobs] Error getting jobs:', error);
    return [];
  }
}
```

---

## Testing Queries

Run these queries to verify the schema and operations:

```sql
-- Test 1: Verify table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'jobs';

-- Test 2: Verify columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
ORDER BY ordinal_position;

-- Test 3: Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'jobs' 
ORDER BY indexname;

-- Test 4: Verify constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'jobs';

-- Test 5: Test INSERT (note: requires valid organisation_id)
BEGIN;
INSERT INTO jobs (
  job_id,
  job_type,
  status,
  input_payload,
  organisation_id
) VALUES (
  'test-job-' || NOW()::text,
  'add-item-tags',
  'pending',
  '{"item_ids": [1, 2, 3], "tags": ["vegetarian"]}'::jsonb,
  (SELECT id FROM organisations LIMIT 1)
)
RETURNING id, job_id, status;
ROLLBACK;

-- Test 6: Monitor queue
SELECT * FROM public.jobs_queue_status;

-- Test 7: Get next job (simulates worker)
SELECT * FROM jobs 
WHERE status IN ('pending', 'queued')
ORDER BY priority DESC, created_at ASC
LIMIT 1;
```

---

## Migration Checklist

- [ ] Create new `jobs` table with migration file
- [ ] Create indexes for performance
- [ ] Create RLS policies
- [ ] Create monitoring views
- [ ] Add trigger for auto-update timestamp
- [ ] Add database-service.js functions
- [ ] Create job worker service
- [ ] Add job creation APIs
- [ ] Add job status polling/monitoring endpoints
- [ ] Add tests for job operations
- [ ] Document job types and payloads
- [ ] Plan migration of extraction_jobs to new system

---

## Summary

The Supabase project is well-structured for async job processing with:
- ✅ Established patterns (extraction_jobs, lead_scrape_jobs)
- ✅ Proper authentication (Service Role + User Auth)
- ✅ RLS policies for security
- ✅ JSONB for flexible data storage
- ✅ Automatic timestamp triggers
- ✅ JavaScript client integration (no raw SQL)

The proposed `jobs` table extends these proven patterns into a generic, scalable job queue system suitable for all long-running async operations across the platform.

---

**Investigation Completed By:** Claude Code Analysis  
**Date:** December 9, 2025  
**Project ID:** qgabsyggzlkcstjzugdh
