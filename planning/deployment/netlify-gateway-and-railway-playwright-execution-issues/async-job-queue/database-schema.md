# Database Schema: script_jobs Table

**Last Updated**: 2025-12-09
**Status**: Planned
**Table Name**: `script_jobs`

## Overview

The `script_jobs` table provides a centralized job queue for all Playwright script executions. It enables async processing to bypass Netlify's 30-second gateway timeout by returning a job ID immediately and allowing clients to poll for completion.

---

## Table Schema

### SQL Migration

```sql
-- Migration: create_script_jobs_table
-- Description: Creates the script_jobs table for async Playwright script execution
-- Date: 2025-12-09

-- Create enum types for job status and job type
CREATE TYPE script_job_status AS ENUM (
  'pending',      -- Job created, waiting to be picked up
  'queued',       -- Job in queue, will be processed soon
  'in_progress',  -- Job currently executing
  'completed',    -- Job finished successfully
  'failed',       -- Job failed (may be retryable)
  'cancelled',    -- Job cancelled by user or system
  'timed_out'     -- Job exceeded maximum execution time
);

CREATE TYPE script_job_type AS ENUM (
  'add-item-tags',
  'add-option-sets',
  'import-csv-menu',
  'register-restaurant',
  'configure-website-dark',
  'configure-website-light',
  'setup-stripe-payments',
  'setup-stripe-payments-no-link',
  'setup-services',
  'setup-system-settings',
  'create-api-key',
  'finalise-onboarding'
);

-- Main script_jobs table
CREATE TABLE IF NOT EXISTS public.script_jobs (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-readable job ID for logging/display
  job_id TEXT UNIQUE NOT NULL DEFAULT ('JOB_' || to_char(now(), 'YYYYMMDD_HH24MISS') || '_' || substr(gen_random_uuid()::text, 1, 8)),

  -- Job classification
  job_type script_job_type NOT NULL,

  -- Current status
  status script_job_status NOT NULL DEFAULT 'pending',

  -- Input data for the script (JSON payload)
  input_payload JSONB NOT NULL DEFAULT '{}',

  -- Result data after completion
  result JSONB,

  -- Error information if failed
  error_message TEXT,
  error_code TEXT,
  error_stack TEXT,

  -- Retry configuration
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_delay_ms INTEGER NOT NULL DEFAULT 5000,
  next_retry_at TIMESTAMPTZ,

  -- Progress tracking
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  progress_message TEXT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  timeout_at TIMESTAMPTZ,

  -- Execution context
  worker_id TEXT,  -- ID of worker processing this job
  process_pid INTEGER,  -- PID of child process (for cleanup)

  -- Business context (foreign keys)
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.pumpd_restaurants(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Queue management
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher = more priority

  -- Metadata for flexible storage
  metadata JSONB DEFAULT '{}'
);

-- Add comment for documentation
COMMENT ON TABLE public.script_jobs IS 'Async job queue for Playwright script executions';

---

## Indexes

```sql
-- Primary queue processing index (most critical for worker polling)
CREATE INDEX idx_script_jobs_queue_processing
  ON public.script_jobs (status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'queued');

-- Active jobs index (for monitoring)
CREATE INDEX idx_script_jobs_active
  ON public.script_jobs (status, started_at)
  WHERE status = 'in_progress';

-- Failed jobs requiring attention
CREATE INDEX idx_script_jobs_failed
  ON public.script_jobs (status, created_at DESC)
  WHERE status = 'failed';

-- Retryable jobs (for retry worker)
CREATE INDEX idx_script_jobs_retryable
  ON public.script_jobs (next_retry_at)
  WHERE status = 'failed' AND retry_count < max_retries AND next_retry_at IS NOT NULL;

-- Job type filtering
CREATE INDEX idx_script_jobs_type
  ON public.script_jobs (job_type, status);

-- Organisation filtering (for multi-tenant queries)
CREATE INDEX idx_script_jobs_organisation
  ON public.script_jobs (organisation_id, status, created_at DESC);

-- Restaurant filtering
CREATE INDEX idx_script_jobs_restaurant
  ON public.script_jobs (restaurant_id, status, created_at DESC);

-- User's jobs
CREATE INDEX idx_script_jobs_created_by
  ON public.script_jobs (created_by, created_at DESC);

-- Timeout detection
CREATE INDEX idx_script_jobs_timeout
  ON public.script_jobs (timeout_at)
  WHERE status = 'in_progress' AND timeout_at IS NOT NULL;

-- Updated timestamp for change tracking
CREATE INDEX idx_script_jobs_updated
  ON public.script_jobs (updated_at DESC);

-- Job ID lookup (for API queries)
CREATE INDEX idx_script_jobs_job_id
  ON public.script_jobs (job_id);
```

---

## Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_script_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_script_jobs_updated_at
  BEFORE UPDATE ON public.script_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_script_jobs_updated_at();

-- Set timeout_at when job starts
CREATE OR REPLACE FUNCTION set_script_job_timeout()
RETURNS TRIGGER AS $$
DECLARE
  timeout_duration INTERVAL := INTERVAL '5 minutes';  -- Standard 5-minute timeout for all job types
BEGIN
  -- Set timeout_at when status changes to in_progress
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    NEW.started_at = now();
    NEW.timeout_at = now() + timeout_duration;
  END IF;

  -- Set completed_at when job completes or fails
  IF NEW.status IN ('completed', 'failed', 'cancelled', 'timed_out') AND OLD.status NOT IN ('completed', 'failed', 'cancelled', 'timed_out') THEN
    NEW.completed_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_script_job_timeout
  BEFORE UPDATE ON public.script_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_script_job_timeout();
```

---

## Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE public.script_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view jobs for their organisation
CREATE POLICY "Users can view organisation jobs"
  ON public.script_jobs
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.user_organisations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create jobs for their organisation
CREATE POLICY "Users can create organisation jobs"
  ON public.script_jobs
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM public.user_organisations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can cancel their own pending jobs
CREATE POLICY "Users can cancel own pending jobs"
  ON public.script_jobs
  FOR UPDATE
  USING (
    created_by = auth.uid()
    AND status IN ('pending', 'queued')
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Policy: Service role can do everything (for workers)
CREATE POLICY "Service role full access"
  ON public.script_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

## Monitoring Views

```sql
-- Queue status overview
CREATE OR REPLACE VIEW public.script_jobs_queue_status AS
SELECT
  job_type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job
FROM public.script_jobs
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY job_type, status
ORDER BY job_type, status;

-- Failed jobs needing attention
CREATE OR REPLACE VIEW public.script_jobs_failed_summary AS
SELECT
  id,
  job_id,
  job_type,
  error_message,
  error_code,
  retry_count,
  max_retries,
  created_at,
  completed_at,
  organisation_id
FROM public.script_jobs
WHERE status = 'failed'
  AND (retry_count >= max_retries OR next_retry_at IS NULL)
  AND created_at > now() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Job metrics for monitoring
CREATE OR REPLACE VIEW public.script_jobs_metrics AS
SELECT
  job_type,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
  COUNT(*) FILTER (WHERE status IN ('pending', 'queued')) as queued_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed') /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed')), 0),
    2
  ) as success_rate_percent,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'completed') as avg_duration_seconds
FROM public.script_jobs
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY job_type;
```

---

## Column Reference

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `job_id` | TEXT | No | Auto-generated | Human-readable ID (JOB_YYYYMMDD_HHMMSS_xxxxxxxx) |
| `job_type` | ENUM | No | - | Type of script to execute |
| `status` | ENUM | No | 'pending' | Current job status |
| `input_payload` | JSONB | No | '{}' | Script input parameters |
| `result` | JSONB | Yes | - | Script output/results |
| `error_message` | TEXT | Yes | - | Error description if failed |
| `error_code` | TEXT | Yes | - | Error code for classification |
| `error_stack` | TEXT | Yes | - | Stack trace for debugging |
| `retry_count` | INTEGER | No | 0 | Number of retry attempts |
| `max_retries` | INTEGER | No | 3 | Maximum retry attempts |
| `retry_delay_ms` | INTEGER | No | 5000 | Delay between retries (ms) |
| `next_retry_at` | TIMESTAMPTZ | Yes | - | When to retry failed job |
| `progress_percent` | INTEGER | Yes | 0 | Progress 0-100 |
| `progress_message` | TEXT | Yes | - | Current progress description |
| `current_step` | INTEGER | Yes | 0 | Current step number |
| `total_steps` | INTEGER | Yes | 0 | Total steps in job |
| `created_at` | TIMESTAMPTZ | No | now() | Job creation time |
| `started_at` | TIMESTAMPTZ | Yes | - | When execution started |
| `completed_at` | TIMESTAMPTZ | Yes | - | When job finished |
| `cancelled_at` | TIMESTAMPTZ | Yes | - | When job was cancelled |
| `updated_at` | TIMESTAMPTZ | No | now() | Last update time |
| `timeout_at` | TIMESTAMPTZ | Yes | - | When job should timeout |
| `worker_id` | TEXT | Yes | - | ID of processing worker |
| `process_pid` | INTEGER | Yes | - | OS process ID |
| `organisation_id` | UUID | Yes | - | FK to organisations |
| `restaurant_id` | UUID | Yes | - | FK to pumpd_restaurants |
| `created_by` | UUID | Yes | - | FK to auth.users |
| `priority` | INTEGER | No | 0 | Queue priority (higher = first) |
| `metadata` | JSONB | Yes | '{}' | Flexible metadata storage |

---

## Job Status Lifecycle

```
                    ┌──────────────┐
                    │   pending    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    queued    │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │      in_progress        │
              └────┬──────────────┬─────┘
                   │              │
          ┌────────▼────┐   ┌────▼────────┐
          │  completed  │   │   failed    │──┐
          └─────────────┘   └──────┬──────┘  │
                                   │         │ retry_count < max_retries
                                   │    ┌────▼────┐
                                   │    │ pending │ (retry)
                                   │    └─────────┘
                                   │
                            ┌──────▼──────┐
                            │  timed_out  │
                            └─────────────┘

     User can cancel:
     ┌──────────────┐
     │  cancelled   │ ◄── from pending/queued only
     └──────────────┘
```

---

## Input Payload Examples

### add-item-tags
```json
{
  "email": "owner@restaurant.com",
  "password": "SecurePass123!",
  "restaurantName": "The Best Restaurant",
  "itemTags": [
    { "name": "Spicy", "display_name": "Spicy", "color": "#FF0000" },
    { "name": "Vegan", "display_name": "Vegan", "color": "#00FF00" }
  ]
}
```

### add-option-sets
```json
{
  "email": "owner@restaurant.com",
  "password": "SecurePass123!",
  "restaurantName": "The Best Restaurant",
  "optionSets": [
    {
      "name": "Size",
      "display_name": "Choose Size",
      "is_required": true,
      "multiple_selections_allowed": false,
      "min_selections": 1,
      "max_selections": 1,
      "items": [
        { "name": "Small", "price": 0 },
        { "name": "Medium", "price": 2.00 },
        { "name": "Large", "price": 4.00 }
      ]
    }
  ]
}
```

### import-csv-menu
```json
{
  "email": "owner@restaurant.com",
  "password": "SecurePass123!",
  "restaurantName": "The Best Restaurant",
  "csvFilePath": "/tmp/uploads/menu_12345.csv"
}
```

---

## Result Examples

### Successful Completion
```json
{
  "success": true,
  "message": "Successfully created 5 item tags",
  "data": {
    "itemsCreated": 5,
    "itemsFailed": 0,
    "details": [
      { "name": "Spicy", "status": "created" },
      { "name": "Vegan", "status": "created" }
    ]
  },
  "duration_ms": 45000
}
```

### Partial Success
```json
{
  "success": true,
  "partial": true,
  "message": "Created 3 of 5 item tags",
  "data": {
    "itemsCreated": 3,
    "itemsFailed": 2,
    "details": [
      { "name": "Spicy", "status": "created" },
      { "name": "Vegan", "status": "created" },
      { "name": "Duplicate", "status": "failed", "error": "Already exists" }
    ]
  }
}
```

---

## Cleanup Query

```sql
-- Delete jobs older than 30 days (run via cron)
DELETE FROM public.script_jobs
WHERE created_at < now() - INTERVAL '30 days'
  AND status IN ('completed', 'failed', 'cancelled', 'timed_out');

-- Archive completed jobs older than 7 days (alternative approach)
-- INSERT INTO public.script_jobs_archive SELECT * FROM public.script_jobs WHERE ...
```

---

## Related Tables

- `public.organisations` - Organisation context
- `public.pumpd_restaurants` - Restaurant context
- `auth.users` - User who created the job
- `public.user_organisations` - For RLS policies

---

## Migration File Location

Create at: `supabase/migrations/YYYYMMDDHHMMSS_create_script_jobs_table.sql`

Example: `supabase/migrations/20251209120000_create_script_jobs_table.sql`
