## Lead Conversion Flow Investigation Findings

### Pending Lead Identification

**File: lead-scrape-service.js (Lines 1036-1113)**

The `getPendingLeads()` function identifies convertible leads:

1. **Query Logic (Lines 1040-1065)**:
   - Fetches all jobs for the organization with their `total_steps`
   - Calculates `maxSteps` as the maximum `total_steps` across all jobs
   - Filters leads where:
     - `current_step >= maxSteps` (at or beyond final step)
     - `step_progression_status === 'passed'`
     - `converted_to_restaurant_id IS NULL`

2. **Current Criteria**:
   - A lead is "pending" if it's at the final step AND has status "passed"
   - Uses `maxSteps` from all jobs to determine the final step threshold

3. **With Step 4 as Final**:
   - When step count changes from 5 to 4, `maxSteps` will be 4
   - Leads at `current_step = 4` with status "passed" will be identified as pending
   - **Critical**: Existing leads at `current_step = 5` need migration to work correctly

### Conversion Process

**File: lead-scrape-service.js (Lines 1220-1313)**

The `convertLeadsToRestaurants()` function maps lead data to restaurant:

**Data Mapping (Lines 1245-1272)**:
```
Lead → Restaurant
- lead.restaurant_name → name
- slug (generated from restaurant_name)
- lead.phone → phone
- lead.email → email
- lead.ubereats_address or lead.google_address → address
- lead.city → city
- lead.region → region
- lead.country → country
- lead.website_url → website_url
- lead.instagram_url → instagram_url
- lead.facebook_url → facebook_url
- lead.google_maps_url → google_maps_url
- lead.contact_name → contact_name
- lead.contact_email → contact_email
- lead.contact_phone → contact_phone
```

**Contact Fields Handling**:
- Contact fields ARE included in the conversion (lines 1261-1263)
- They're populated from the lead record, NOT required to be non-null
- If Step 5 doesn't populate them, they'll be NULL on conversion
- Restaurant schema allows null contact fields

### Edge Cases

**Leads at Step 5 when change deploys**:
- Leads at `current_step = 5` need to be migrated to `current_step = 4`
- Without migration, `maxSteps` calculation may cause inconsistencies
- Database migration handles this by setting Step 5 leads to Step 4 with "passed" status

**Jobs in progress with 5 steps**:
- Existing jobs have `total_steps = 5` stored in database
- Migration updates all to `total_steps = 4`
- Step 5 records are deleted from `lead_scrape_job_steps`

### Required Changes

1. **No code changes needed for conversion logic** - it's already dynamic
2. **Database migration required** (handled in Task 2):
   - Update `total_steps` from 5 to 4
   - Move Step 5 leads to Step 4 as "passed"
   - Delete Step 5 records

3. **Contact field handling**:
   - Contact fields will be NULL on conversion if not populated elsewhere
   - Future: Add separate contact enrichment feature outside lead scraping
   - Current: Fields can be manually entered via LeadDetailModal
