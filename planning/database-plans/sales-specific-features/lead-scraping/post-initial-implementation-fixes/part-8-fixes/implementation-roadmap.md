# Part 8: Add organisation_id to Leads Table with RLS Policies

## Overview
Add `organisation_id` FK column to the `leads` table, implement proper RLS policies, add a composite index for deduplication queries, and update all relevant services.

## Current State
- **Leads table**: No direct `organisation_id` column; accesses org context through `lead_scrape_jobs.organisation_id` via FK
- **Current RLS**: Single policy named `leads_access_policy` for ALL operations, using:
  ```sql
  EXISTS (SELECT 1 FROM lead_scrape_jobs WHERE lead_scrape_jobs.id = leads.lead_scrape_job_id
          AND has_org_access(lead_scrape_jobs.organisation_id))
  ```
- **Global deduplication**: `filterGlobalDuplicates()` at line 104-142 queries ALL leads without org filter
- **Lead insert**: Only in `processStep1()` at line 743-744, job object has `organisation_id`
- **Services**: All functions receive `orgId` from routes via `req.user.organisationId`

## Key Files to Modify

### 1. Database Migration (new file)
Create via `mcp__supabase__apply_migration`

### 2. Services
- `/UberEats-Image-Extractor/src/services/lead-scrape-firecrawl-service.js`
  - Line 104-142: `filterGlobalDuplicates()` - Add orgId parameter
  - Line 716-722: Call to `filterGlobalDuplicates()` - Pass `job.organisation_id`
  - Line 729-740: `leadsToCreate` - Add `organisation_id: job.organisation_id`

### 3. Routes (no changes needed)
Routes already pass `req.user.organisationId` to services and `job` object contains `organisation_id`

---

## Implementation Steps

### Step 1: Database Migration

```sql
-- 1. Add nullable column first
ALTER TABLE public.leads
ADD COLUMN organisation_id uuid REFERENCES public.organisations(id);

-- 2. Backfill from parent job
UPDATE public.leads l
SET organisation_id = j.organisation_id
FROM public.lead_scrape_jobs j
WHERE l.lead_scrape_job_id = j.id
AND l.organisation_id IS NULL;

-- 3. Make NOT NULL
ALTER TABLE public.leads
ALTER COLUMN organisation_id SET NOT NULL;

-- 4. Create composite index for duplicate lookups
CREATE INDEX idx_leads_org_store_link ON public.leads (organisation_id, store_link);

-- 5. Drop old policy
DROP POLICY IF EXISTS "leads_access_policy" ON public.leads;

-- 6. Create new policies
CREATE POLICY "leads_org_access" ON public.leads
FOR ALL
USING (has_org_access(organisation_id))
WITH CHECK (has_org_access(organisation_id));

CREATE POLICY "leads_super_admin_bypass" ON public.leads
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);
```

### Step 2: Update filterGlobalDuplicates (line 104)
Add `orgId` parameter and filter:

```javascript
async function filterGlobalDuplicates(restaurants, orgId) {
  // ...
  const { data: existingLeads, error } = await client
    .from('leads')
    .select('store_link')
    .eq('organisation_id', orgId)  // ADD THIS
    .in('store_link', storeLinks);
  // ...
}
```

### Step 3: Update processStep1 (lines 716-740)
1. Pass `job.organisation_id` to `filterGlobalDuplicates()`
2. Add `organisation_id` to `leadsToCreate`:

```javascript
// Line 717-718: Update call
const { unique: globallyUniqueRestaurants, duplicateCount: globalDuplicateCount } =
  await filterGlobalDuplicates(uniqueRestaurants, job.organisation_id);

// Line 731: Add to leadsToCreate
const leadsToCreate = limitedRestaurants.map(r => ({
  lead_scrape_job_id: jobId,
  organisation_id: job.organisation_id,  // ADD THIS
  restaurant_name: r.restaurant_name,
  // ... rest unchanged
}));
```

---

## RLS Policy Notes

**Why Two Policies?**
- `leads_org_access`: Uses `has_org_access()` which already includes super_admin check internally
- `leads_super_admin_bypass`: Explicit bypass for consistency with restaurants/organisations tables (technically redundant but matches existing patterns)

**has_org_access function** (already exists): Returns true if user is super_admin OR user.organisation_id matches the provided org_id.

---

## Testing Checklist
- [ ] Migration runs successfully (backfill + NOT NULL)
- [ ] New leads get organisation_id from job
- [ ] Global deduplication only matches same-org leads
- [ ] RLS: regular user sees only own org's leads
- [ ] RLS: super admin sees all leads
- [ ] Index used for duplicate queries (check with EXPLAIN)

---

## Execution Order
1. Apply database migration via `mcp__supabase__apply_migration`
2. Update `filterGlobalDuplicates()` function signature and query
3. Update `processStep1()` call to `filterGlobalDuplicates` and `leadsToCreate` object
4. Test end-to-end

---

## Organisation Context Verification

### How Backend Access Works
- **Backend uses `SUPABASE_SERVICE_ROLE_KEY`** which bypasses RLS (line 10-11 of database-service.js)
- **When authenticated request**: `setUserSupabaseClient(token)` creates user client with RLS
- **Background/async processing** (e.g., `setImmediate`): Uses service role, bypasses RLS
- **RLS is a safety net**, application-level filtering is the primary access control

### All Leads Table Access Points - Verified Safe

#### lead-scrape-firecrawl-service.js
| Function | Lines | Access Pattern | Org Context |
|----------|-------|----------------|-------------|
| `filterGlobalDuplicates` | 119 | SELECT all | **NEEDS FIX** - add orgId filter |
| `processStep1` INSERT | 743 | INSERT | **NEEDS FIX** - add organisation_id |
| `processStep2` | 827, 859, 873, 889, 919, 927 | Filter by `lead_scrape_job_id` | Safe - job has org |
| `processStep3` | 970, 999, 1045, 1054, 1082, 1090 | Filter by `lead_scrape_job_id` | Safe - job has org |
| `processStep4` | 1196, 1225, 1267, 1282, 1310, 1318 | Filter by `lead_scrape_job_id` | Safe - job has org |
| `checkForDuplicates` | 1416 | Filter by `lead_scrape_job_id` | Safe - job has org |

#### lead-scrape-service.js
| Function | Lines | Access Pattern | Org Context |
|----------|-------|----------------|-------------|
| `getJobStep` | 622 | Filter by `lead_scrape_job_id` | Safe - job is org-filtered |
| `triggerStepProcessing` | 718 | Filter by `lead_scrape_job_id` | Safe |
| `passLeadsToNextStep` | 800 | Explicit org check at line 790 | Safe - verified |
| `retryFailedLeads` | 939, 956 | Explicit org check at line 933 | Safe - verified |
| `getPendingLeads` | 1052 | Gets org jobs first, then job IDs | Safe |
| `getPendingLeadsFilterOptions` | 1136 | Gets org jobs first | Safe |
| `getLead` | 1172 | Uses `lead_scrape_jobs!inner` join | Safe - RLS on join |
| `updateLead` | 1244 | Calls `getLead(leadId, orgId)` first | Safe - verified |
| `convertLeadsToRestaurants` | 1519 | Leads fetched with org context | Safe |
| `deleteLeads` | 1604 | Gets org jobs first, filters both | Safe |

### Conclusion
All existing code paths have proper organisation isolation through:
1. Filtering by `lead_scrape_job_id` (which has `organisation_id`)
2. Explicit `orgId` parameter checks before operations
3. Inner joins with org-filtered parent tables

**Only 2 changes needed** (already in plan):
1. `filterGlobalDuplicates()` - add `orgId` parameter
2. `processStep1()` - add `organisation_id` to inserted leads
