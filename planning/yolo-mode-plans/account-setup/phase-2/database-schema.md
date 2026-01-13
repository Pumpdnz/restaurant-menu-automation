# Database Schema: Registration Batch Orchestration

## Overview

This document defines the database schema for the Phase 2 Registration Batch Orchestration system, enabling async execution of Yolo Mode across multiple restaurants.

## Related Investigation Documents
- [INVESTIGATION_TASK_1_DATABASE_SCHEMA.md](../investigations/phase-2/INVESTIGATION_TASK_1_DATABASE_SCHEMA.md)
- [INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md](../investigations/phase-2/INVESTIGATION_TASK_4_BATCH_EXTENSIBILITY.md)
- [INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md](../investigations/phase-2/INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md)

---

## Entity Relationship Diagram

```
┌─────────────────────────────┐
│   registration_batch_jobs   │
│   (Parent Batch)            │
└─────────────┬───────────────┘
              │ 1:N
              ▼
┌─────────────────────────────┐      ┌─────────────────────────────────────┐
│    registration_jobs        │      │  companies_office_search_candidates │
│    (Per Restaurant)         │──────│  (Contact Search State)             │
└─────────────┬───────────────┘      └─────────────────────────────────────┘
              │ 1:N
              ▼
┌─────────────────────────────┐
│  registration_job_steps     │
│  (Step Progress)            │
└─────────────────────────────┘
```

---

## Table Definitions

### 1. registration_batch_jobs

Parent table tracking a batch of restaurants going through registration.

```sql
CREATE TABLE IF NOT EXISTS public.registration_batch_jobs (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Basic Info
  name TEXT NOT NULL,
  organisation_id UUID NOT NULL,

  -- Source Tracking
  source_lead_scrape_job_id UUID NULL,

  -- Status & Execution Mode
  status TEXT NOT NULL DEFAULT 'pending',
  execution_mode TEXT NOT NULL DEFAULT 'parallel',
  -- parallel: All restaurants progress through steps independently
  -- sequential: One restaurant completes before next starts (fallback)

  -- Progress Tracking
  total_restaurants INTEGER DEFAULT 0,
  completed_restaurants INTEGER DEFAULT 0,
  failed_restaurants INTEGER DEFAULT 0,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 6,

  -- User Tracking
  created_by UUID NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Foreign Keys
  CONSTRAINT registration_batch_jobs_org_fk FOREIGN KEY (organisation_id)
    REFERENCES organisations(id),
  CONSTRAINT registration_batch_jobs_source_job_fk FOREIGN KEY (source_lead_scrape_job_id)
    REFERENCES lead_scrape_jobs(id) ON DELETE SET NULL,

  -- Check Constraints
  CONSTRAINT registration_batch_jobs_status_check CHECK (
    status = ANY (ARRAY['draft', 'pending', 'in_progress', 'completed', 'failed', 'cancelled'])
  ),
  CONSTRAINT registration_batch_jobs_mode_check CHECK (
    execution_mode = ANY (ARRAY['sequential', 'parallel'])
  )
);

-- Indexes
CREATE INDEX idx_registration_batch_jobs_status ON public.registration_batch_jobs USING BTREE (status);
CREATE INDEX idx_registration_batch_jobs_org ON public.registration_batch_jobs USING BTREE (organisation_id);
CREATE INDEX idx_registration_batch_jobs_created_at ON public.registration_batch_jobs USING BTREE (created_at DESC);
CREATE INDEX idx_registration_batch_jobs_source_job ON public.registration_batch_jobs USING BTREE (source_lead_scrape_job_id);

-- Updated_at Trigger
CREATE TRIGGER update_registration_batch_jobs_updated_at
  BEFORE UPDATE ON registration_batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Status Values
| Status | Description |
|--------|-------------|
| `draft` | Created but not started |
| `pending` | Ready to start |
| `in_progress` | Currently executing |
| `completed` | All restaurants finished (success or failure) |
| `failed` | Critical failure (>50% restaurants failed) |
| `cancelled` | User cancelled |

---

### 2. registration_jobs

Per-restaurant job tracking within a batch.

```sql
CREATE TABLE IF NOT EXISTS public.registration_jobs (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Relationships
  batch_job_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  organisation_id UUID NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 6,

  -- Configuration (from Yolo Mode settings)
  execution_config JSONB NOT NULL DEFAULT '{}',

  -- Results
  pumpd_user_id UUID NULL,
  pumpd_restaurant_id UUID NULL,
  execution_results JSONB DEFAULT '{}',

  -- Error Tracking
  error_message TEXT NULL,
  last_error_details JSONB NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Foreign Keys
  CONSTRAINT registration_jobs_batch_fk FOREIGN KEY (batch_job_id)
    REFERENCES registration_batch_jobs(id) ON DELETE CASCADE,
  CONSTRAINT registration_jobs_restaurant_fk FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT registration_jobs_org_fk FOREIGN KEY (organisation_id)
    REFERENCES organisations(id),

  -- Check Constraints
  CONSTRAINT registration_jobs_status_check CHECK (
    status = ANY (ARRAY['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'skipped'])
  ),

  -- Unique Constraints
  CONSTRAINT registration_jobs_unique_restaurant_batch UNIQUE (batch_job_id, restaurant_id)
);

-- Indexes
CREATE INDEX idx_registration_jobs_batch ON public.registration_jobs USING BTREE (batch_job_id);
CREATE INDEX idx_registration_jobs_restaurant ON public.registration_jobs USING BTREE (restaurant_id);
CREATE INDEX idx_registration_jobs_status ON public.registration_jobs USING BTREE (status);
CREATE INDEX idx_registration_jobs_org ON public.registration_jobs USING BTREE (organisation_id);

-- Updated_at Trigger
CREATE TRIGGER update_registration_jobs_updated_at
  BEFORE UPDATE ON registration_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### execution_config JSONB Structure
```json
{
  "email": "owner@restaurant.com",
  "password": "generated_password",
  "phone": "+64211234567",
  "csv_path": "/path/to/menu.csv",
  "steps_enabled": {
    "cloudwaitressAccount": true,
    "codeGeneration": true,
    "createOnboardingUser": true,
    "syncOnboardingUser": true,
    "websiteConfig": true,
    "servicesConfig": true,
    "paymentConfig": true,
    "menuImport": true,
    "uploadImages": true,
    "optionSets": true,
    "itemTags": true,
  },
  "settings": {
    "register_new_cloudwaitress_account": true,
    "first_restaurant_for_account": true,
    "menu_to_import": "menu_id",
    "website_theme": "light",
    "cuisines": {},
    "primary_color": "#3f92ff",
    "secondary_color": "#223851",
    "disable_gradients": false,
    "configure_header": true,
    "header_image": "ubereats",
    "header_logo_source": "logo_no_bg",
    "header_logo_dark_tint": false,
    "header_logo_light_tint": false,
    "nav_logo_source": "logo_no_bg",
    "nav_logo_dark_tint": "#ffffff",
    "nav_logo_light_tint": false,
    "nav_text_color": "#223851",
    "card_text_color": "#2D2D2D",
    "item_layout": "card",
    "favicon_source": "favicon",
    "include_stripe_connect_link": false,
    "auto_configure_services": true,
    "import_menu_immediately": true
  }
}
```

---

### 3. registration_job_steps

Step-level progress tracking with sub-step support.

```sql
CREATE TABLE IF NOT EXISTS public.registration_job_steps (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Relationships
  job_id UUID NOT NULL,

  -- Step Identification
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_description TEXT NULL,
  step_type TEXT NOT NULL DEFAULT 'automatic',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',

  -- Sub-Step Progress (for Yolo Mode step)
  sub_step_progress JSONB DEFAULT '{}',

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  duration_ms INTEGER NULL,

  -- Error Handling
  error_message TEXT NULL,
  error_details JSONB NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Result Data
  result_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Foreign Keys
  CONSTRAINT registration_job_steps_job_fk FOREIGN KEY (job_id)
    REFERENCES registration_jobs(id) ON DELETE CASCADE,

  -- Unique Constraints
  CONSTRAINT registration_job_steps_unique UNIQUE (job_id, step_number),

  -- Check Constraints
  CONSTRAINT registration_job_steps_status_check CHECK (
    status = ANY (ARRAY['pending', 'in_progress', 'action_required', 'completed', 'failed', 'skipped', 'retrying'])
  ),
  CONSTRAINT registration_job_steps_type_check CHECK (
    step_type = ANY (ARRAY['automatic', 'action_required'])
  ),
  CONSTRAINT registration_job_steps_step_range CHECK (
    step_number >= 1 AND step_number <= 6
  )
);

-- Indexes
CREATE INDEX idx_registration_job_steps_job ON public.registration_job_steps USING BTREE (job_id);
CREATE INDEX idx_registration_job_steps_status ON public.registration_job_steps USING BTREE (status);
CREATE INDEX idx_registration_job_steps_step_number ON public.registration_job_steps USING BTREE (step_number);

-- Updated_at Trigger
CREATE TRIGGER update_registration_job_steps_updated_at
  BEFORE UPDATE ON registration_job_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### sub_step_progress JSONB Structure (for Step 6)

Step 6 uses the same phased parallel execution as the current Yolo Mode:

```json
{
  "current_phase": "phase2",
  "phases": {
    "phase1": {
      "status": "completed",
      "description": "Initial parallel operations",
      "sub_steps": {
        "cloudwaitressAccount": { "status": "completed", "duration_ms": 5200 },
        "codeGeneration": { "status": "completed", "duration_ms": 12000 },
        "createOnboardingUser": { "status": "skipped", "reason": "Feature disabled" },
        "uploadImages": { "status": "completed", "duration_ms": 8500 }
      }
    },
    "phase2": {
      "status": "in_progress",
      "description": "Configuration (parallel after phase1)",
      "sub_steps": {
        "restaurantRegistration": { "status": "completed", "duration_ms": 45000 },
        "websiteConfig": { "status": "in_progress", "started_at": "..." },
        "servicesConfig": { "status": "pending" },
        "paymentConfig": { "status": "pending" },
        "menuImport": { "status": "in_progress", "started_at": "..." },
        "syncOnboardingUser": { "status": "pending" }
      }
    },
    "phase3": {
      "status": "pending",
      "description": "Menu setup (after menuImport)",
      "sub_steps": {
        "optionSets": { "status": "pending" }
      }
    },
    "phase4": {
      "status": "pending",
      "description": "Finalization (after menuImport)",
      "sub_steps": {
        "itemTags": { "status": "pending" }
      }
    }
  }
}
```

**Phase Dependencies (same as current Yolo Mode):**
- **Phase 1**: All sub-steps run in parallel. `cloudwaitressAccount` is blocking for Phase 2.
- **Phase 2**: Runs after Phase 1. `restaurantRegistration` blocks remaining config steps. `menuImport` blocks Phases 3 & 4.
- **Phase 3**: Runs after `menuImport` completes.
- **Phase 4**: Runs after `menuImport` completes.

---

### 4. companies_office_search_candidates

Persists intermediate state for contact details extraction.

```sql
CREATE TABLE IF NOT EXISTS public.companies_office_search_candidates (
  id UUID NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Relationships
  restaurant_id UUID NOT NULL,
  registration_job_id UUID NULL,

  -- Search Configuration
  search_queries JSONB NOT NULL,

  -- Search Results
  name_results JSONB DEFAULT '[]',
  address_results JSONB DEFAULT '[]',
  combined_results JSONB DEFAULT '[]',
  candidate_count INTEGER DEFAULT 0,

  -- Selection
  selected_company_number TEXT NULL,
  selected_company_data JSONB NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  searched_at TIMESTAMP WITH TIME ZONE NULL,
  selected_at TIMESTAMP WITH TIME ZONE NULL,

  -- Foreign Keys
  CONSTRAINT companies_search_restaurant_fk FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT companies_search_job_fk FOREIGN KEY (registration_job_id)
    REFERENCES registration_jobs(id) ON DELETE SET NULL,

  -- Unique Constraint
  CONSTRAINT companies_search_unique_restaurant UNIQUE (restaurant_id, registration_job_id),

  -- Check Constraints
  CONSTRAINT companies_search_status_check CHECK (
    status = ANY (ARRAY['pending', 'searching', 'awaiting_selection', 'selected', 'no_match', 'failed'])
  )
);

-- Indexes
CREATE INDEX idx_companies_search_restaurant ON public.companies_office_search_candidates USING BTREE (restaurant_id);
CREATE INDEX idx_companies_search_job ON public.companies_office_search_candidates USING BTREE (registration_job_id);
CREATE INDEX idx_companies_search_status ON public.companies_office_search_candidates USING BTREE (status);

-- Updated_at Trigger
CREATE TRIGGER update_companies_search_updated_at
  BEFORE UPDATE ON companies_office_search_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### search_queries JSONB Structure
```json
{
  "restaurant_name": "Pizza Palace",
  "street": "123 Main Street",
  "city": "Auckland",
  "original_values": {
    "restaurant_name": "Pizza Palace Ltd",
    "street": "123 Main St",
    "city": "Auckland"
  }
}
```

#### combined_results JSONB Structure
```json
[
  {
    "company_name": "Pizza Palace Limited",
    "company_number": "123456789",
    "nzbn": "9429000123456",
    "status": "Registered",
    "incorporation_date": "2015-03-15",
    "registered_address": "123 Main Street, Auckland",
    "match_source": "name"
  }
]
```

#### selected_company_data JSONB Structure (after full extraction)
```json
{
  "company_name": "Pizza Palace Limited",
  "company_number": "123456789",
  "nzbn": "9429000123456",
  "status": "Registered",
  "incorporation_date": "2015-03-15",
  "registered_address": "123 Main Street, Auckland",
  "directors": [
    {
      "name": "John Smith",
      "full_name": "John Andrew Smith",
      "position": "Director",
      "status": "Current",
      "appointed_date": "2015-03-15"
    }
  ],
  "shareholders": [
    {
      "name": "John Smith",
      "type": "Individual",
      "percentage": "100%"
    }
  ],
  "nzbn_details": {
    "gst_number": "123-456-789",
    "email": "john@pizzapalace.co.nz",
    "phone": "+64 21 123 4567",
    "website": "www.pizzapalace.co.nz"
  }
}
```

**Note:** The `nzbn_details.email` and `nzbn_details.gst_number` can be auto-populated into the restaurant record and/or `execution_config` during Step 4.

---

## Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE public.registration_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_job_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies_office_search_candidates ENABLE ROW LEVEL SECURITY;

-- Batch Jobs Policies
CREATE POLICY "Users can view their org's batch jobs" ON public.registration_batch_jobs
  FOR SELECT USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can create batch jobs for their org" ON public.registration_batch_jobs
  FOR INSERT WITH CHECK (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can update their org's batch jobs" ON public.registration_batch_jobs
  FOR UPDATE USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

-- Registration Jobs Policies (inherited from batch)
CREATE POLICY "Users can view their org's registration jobs" ON public.registration_jobs
  FOR SELECT USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can manage their org's registration jobs" ON public.registration_jobs
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

-- Steps Policies (inherited from job)
CREATE POLICY "Users can view steps for their jobs" ON public.registration_job_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registration_jobs
      WHERE id = registration_job_steps.job_id
      AND organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

CREATE POLICY "Users can manage steps for their jobs" ON public.registration_job_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM registration_jobs
      WHERE id = registration_job_steps.job_id
      AND organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- Companies Search Policies (inherited from restaurant)
CREATE POLICY "Users can view their restaurant's search candidates" ON public.companies_office_search_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE id = companies_office_search_candidates.restaurant_id
      AND organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

CREATE POLICY "Users can manage their restaurant's search candidates" ON public.companies_office_search_candidates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE id = companies_office_search_candidates.restaurant_id
      AND organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );
```

---

## Step Definitions (Reference)

| Step | Name | Type | Description |
|------|------|------|-------------|
| 1 | Menu & Branding Extraction | automatic | Track extraction job completion |
| 2 | Contact Details Search | automatic→action_required | Run Companies Office search |
| 3 | Company Selection | action_required | User selects correct company |
| 4 | Company Details Extraction | automatic | Extract and save company details |
| 5 | Yolo Mode Configuration | action_required | User configures settings |
| 6 | Pumpd Account Setup | automatic | Execute 12 yolo mode sub-steps |

---

## Migration File

Save as: `supabase/migrations/YYYYMMDD_add_registration_batch_tables.sql`

Include all table definitions, indexes, triggers, and RLS policies from above.

## AMENDMENTS:
1. The database migration was applied manually by the user to save context and the above snippets were copied and pasted exactly as seen here into the supabase dashboard SQL editor. To reference exact table schema definitions see the folder at path planning/yolo-mode-plans/account-setup/phase-2/database-schemas/

2. The RLS policies created from the original SQL snippets did not follow the established patterns for other tables in the project. This blocked functionality so all RLS policies were dropped and replaced with policies that matched the established patterns. The main patterns are:
- Use the helper function "has_org_access"
- Use a permissive "ALL" policy for normal users
- Add a super admin bypass policy

/prime @planning/yolo-mode-plans/account-setup/phase-2/

## Context: Phase 2 Registration Batch Orchestration - Integration Testing

### Session Summary

This session continues Phase 2.9 Integration Testing. The previous session completed ALL frontend implementation (hooks, pages, components) and began testing.

### What Was Completed

**Phase 2.1-2.5 (Backend):** ✅ Complete
- Database tables: `registration_batch_jobs`, `registration_jobs`, `registration_job_steps`, `companies_office_search_candidates`
- Services: `registration-batch-service.js`, `companies-office-batch-service.js`
- Routes: `src/routes/registration-batch-routes.js` mounted at `/api/registration-batches`

**Phase 2.4-2.8 (Frontend):** ✅ Complete
- `src/hooks/useRegistrationBatch.ts` - All hooks with smart polling
- `src/pages/RegistrationBatches.tsx` - List page with tabs
- `src/pages/RegistrationBatchDetail.tsx` - Detail page with step progress
- `src/components/registration-batch/` - BatchProgressCard, BatchStepList, CompanySelectionView, YoloConfigBatchView
- `src/components/leads/PendingLeadsTable.tsx` - Added "Create Registration Batch" checkbox
- `src/App.tsx` - Routes at `/registration-batches` and `/registration-batches/:id`
- `src/components/navigation/NavigationItems.jsx` - Added navigation to sidebar for `/registration-batches`

**Issue Fixed:** RLS policies updated to use `has_org_access()` helper function pattern

### Current Blocker - NEEDS IMMEDIATE FIX

**Error:**
ReferenceError: Cannot access 'batch_job' before initialization
    at processStep1 (registration-batch-service.js:674:83)

**Location:** `src/services/registration-batch-service.js` line 674

**Context:** When starting a batch, the `processStep1()` function fails because it references `batch_job` before declaration.

### Testing Flow That Revealed The Bug

1. User selects leads in PendingLeadsTable
2. "Create Registration Batch" checkbox is checked (default: true)
3. User clicks "Convert to Restaurants"
4. ✅ Restaurants created successfully
5. ✅ Registration batch created successfully (after RLS fix)
6. ✅ Registration jobs created for each restaurant
7. User navigates to `/registration-batches/:id`
8. User clicks "Start Batch"
9. ❌ `processStep1()` crashes with variable initialization error

### Next Steps

1. **IMMEDIATE:** Fix the `batch_job` variable initialization error in `processStep1()`
2. **THEN:** Continue integration testing:
    - Test Step 1 extraction tracking
    - Test Step 2 contact search
    - Test Step 3 company selection UI
    - Test Step 4 detail extraction
    - Test Step 5 yolo configuration
    - Test Step 6 yolo execution

### Key Files to Review

- `src/services/registration-batch-service.js:674` - The bug location
- `src/services/registration-batch-service.js:389` - Where `processStep1` is called
- `planning/yolo-mode-plans/account-setup/phase-2/implementation-roadmap.md` - Full status

### Instructions

1. First, read `src/services/registration-batch-service.js` around line 674 to understand the `processStep1()` function
2. Identify the variable initialization issue
3. Fix the bug
4. Test by starting a batch and verify Step 1 begins processing
5. Continue with remaining integration tests