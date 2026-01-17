## Database Investigation Findings

### Relevant Tables

**1. lead_scrape_jobs**
- `id` (UUID, PK)
- `total_steps` (integer, nullable) - Stores the total number of steps for this job
- `current_step` (integer, nullable, default 0) - Tracks which step the job is currently on
- `leads_extracted`, `leads_passed`, `leads_failed` - Counters for lead outcomes
- `status` (text) - Job status ('draft', 'pending', 'in_progress', 'completed', 'cancelled', 'failed')

**2. lead_scrape_job_steps**
- `id` (UUID, PK)
- `job_id` (UUID, FK to lead_scrape_jobs with ON DELETE CASCADE)
- `step_number` (integer, NOT NULL) - Numeric identifier (1-5 currently)
- `step_name` (text) - Display name of step
- `step_description` (text) - Details about what step does
- `step_type` (text) - 'automatic' or 'action_required'
- `status` (text) - 'pending', 'in_progress', 'action_required', 'completed', 'failed'
- `leads_received`, `leads_processed`, `leads_passed`, `leads_failed` - Metrics
- **Constraint**: `UNIQUE (job_id, step_number)`

**3. leads**
- `id` (UUID, PK)
- `lead_scrape_job_id` (UUID, FK to lead_scrape_jobs with ON DELETE CASCADE)
- `current_step` (integer, default 1) - Which step this lead is currently at
- `step_progression_status` (text) - 'available', 'processing', 'processed', 'passed', 'failed'
- Contact fields (populated by Step 5):
  - `contact_name` (text)
  - `contact_email` (text)
  - `contact_phone` (text)
  - `contact_role` (text)
- Indexes:
  - `idx_leads_current_step` (on current_step)
  - `idx_leads_job_step` (on lead_scrape_job_id, current_step)

### Existing Data Impact

**Jobs with total_steps = 5**:
```sql
SELECT COUNT(*) as total_jobs_with_5_steps FROM lead_scrape_jobs WHERE total_steps = 5;
```

**Leads at current_step = 5**:
```sql
SELECT COUNT(*) as leads_at_step_5
FROM leads
WHERE current_step = 5;
```

**Step records for step_number = 5**:
```sql
SELECT COUNT(*) as step_5_records
FROM lead_scrape_job_steps
WHERE step_number = 5;
```

### Migration Strategy

**Option A: Hard Migration (Recommended)**

Execute in single transaction:
```sql
-- Update total_steps for all jobs with 5 steps
UPDATE lead_scrape_jobs
SET total_steps = 4
WHERE total_steps = 5;

-- Delete all Step 5 records
DELETE FROM lead_scrape_job_steps
WHERE step_number = 5;

-- Move Step 5 leads to Step 4 as passed (ready for conversion)
UPDATE leads
SET current_step = 4,
    step_progression_status = 'passed'
WHERE current_step = 5;
```

**Pros**:
- Clean break - no legacy code paths needed
- Leads at Step 5 become immediately convertible
- No ambiguity about lead status

**Option B: Gradual Migration**

Add deprecation flag, skip Step 5 in code, run cleanup later.

**Cons**: More complex, legacy code paths remain

### Recommended Approach

Use **Option A** for simplicity and code alignment. The migration:
1. Updates job step counts (5→4)
2. Moves Step 5 leads to Step 4 as "passed"
3. Deletes orphaned Step 5 records
