# Contact Extraction Integration

## Overview

This document describes how to integrate the Companies Office contact details extraction into the registration batch workflow as Steps 2-4.

## Related Investigation Documents
- [INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md](../investigations/phase-2/INVESTIGATION_CONTACT_DETAILS_EXTRACTION.md)

---

## Current Flow (RestaurantDetail Only)

```
RestaurantDetail.jsx
        │
        ▼
[Get Contacts] Button
        │
        ▼
CompaniesOfficeDialog (4-step wizard)
        │
        ├─ Step 1: Edit search queries
        ├─ Step 2: Select companies from results
        ├─ Step 3: (skipped)
        └─ Step 4: Select & save contact data
```

**Limitations:**
- Single restaurant at a time
- All state in React component (lost on close)
- Requires user to stay on page throughout

---

## Batch Flow (New)

```
Registration Batch Step 2: Contact Search (Automatic)
        │
        ├─ Run search for all restaurants
        └─ Persist candidates to database
        │
        ▼
Registration Batch Step 3: Company Selection (Action Required)
        │
        ├─ Show batch view of all candidates
        └─ User selects company for each restaurant
        │
        ▼
Registration Batch Step 4: Company Details (Automatic)
        │
        ├─ Extract full details for selected companies
        └─ Auto-save to restaurant records
```

---

## Database Changes

### companies_office_search_candidates Table

New table to persist intermediate state (see [database-schema.md](./database-schema.md)):

```sql
CREATE TABLE companies_office_search_candidates (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  registration_job_id UUID,
  search_queries JSONB NOT NULL,
  name_results JSONB,
  address_results JSONB,
  combined_results JSONB,
  candidate_count INTEGER,
  selected_company_number TEXT,
  selected_company_data JSONB,
  status TEXT, -- pending, searching, awaiting_selection, selected, no_match, failed
  searched_at TIMESTAMPTZ,
  selected_at TIMESTAMPTZ
);
```

---

## Backend Service

### companies-office-batch-service.js

```javascript
/**
 * Batch search service for Companies Office integration.
 * Wraps existing companies-office-routes.js functionality.
 */

const companiesOfficeService = require('./companies-office-service');

/**
 * Search Companies Office for a single restaurant.
 * Persists results to database.
 */
async function searchForRestaurant({ restaurantId, registrationJobId, restaurantName, street, city }) {
  // Create or update search record
  const searchRecord = await upsertSearchRecord(restaurantId, registrationJobId, {
    restaurant_name: restaurantName,
    street,
    city
  });

  try {
    // Run parallel searches (existing logic from companies-office-routes.js)
    const [nameResults, addressResults] = await Promise.allSettled([
      companiesOfficeService.searchByName(restaurantName),
      companiesOfficeService.searchByAddress(street, city)
    ]);

    // Combine and deduplicate results
    const combined = deduplicateResults(
      nameResults.value || [],
      addressResults.value || []
    );

    // Update search record
    await updateSearchRecord(searchRecord.id, {
      name_results: nameResults.value || [],
      address_results: addressResults.value || [],
      combined_results: combined,
      candidate_count: combined.length,
      status: combined.length > 0 ? 'awaiting_selection' : 'no_match',
      searched_at: new Date()
    });

    return {
      combined,
      byName: nameResults.value || [],
      byAddress: addressResults.value || []
    };
  } catch (error) {
    await updateSearchRecord(searchRecord.id, {
      status: 'failed',
      error_message: error.message
    });
    throw error;
  }
}

/**
 * Save user's company selection.
 */
async function selectCompany(restaurantId, registrationJobId, companyNumber) {
  if (!companyNumber) {
    // User indicated no match
    return updateSearchRecord(
      { restaurant_id: restaurantId, registration_job_id: registrationJobId },
      {
        status: 'no_match',
        selected_at: new Date()
      }
    );
  }

  // Get candidate data
  const searchRecord = await getSearchRecord(restaurantId, registrationJobId);
  const selectedCompany = searchRecord.combined_results.find(
    c => c.company_number === companyNumber
  );

  return updateSearchRecord(searchRecord.id, {
    selected_company_number: companyNumber,
    selected_company_data: selectedCompany,
    status: 'selected',
    selected_at: new Date()
  });
}

/**
 * Extract full company details and save to restaurant.
 * Also auto-populates email and GST number from NZBN details.
 */
async function extractAndSaveCompanyDetails(restaurantId, companyNumber) {
  // Extract full details (existing logic)
  const details = await companiesOfficeService.extractCompanyDetails(companyNumber);

  // Auto-select defaults including email and GST from NZBN
  const selections = autoSelectDefaults(details);

  // Save to restaurant (existing logic from companies-office-routes.js)
  await companiesOfficeService.saveToRestaurant(restaurantId, selections);

  // Also update the registration job's execution_config with extracted email/GST
  // This can be used to pre-populate the Yolo Mode configuration in Step 5
  const registrationJob = await getRegistrationJobByRestaurant(restaurantId);
  if (registrationJob && details.nzbn_details) {
    const updatedConfig = {
      ...registrationJob.execution_config,
      // Pre-populate from Companies Office extraction
      email: details.nzbn_details.email || registrationJob.execution_config?.email,
      gst_number: details.nzbn_details.gst_number
    };

    await updateRegistrationJobConfig(registrationJob.id, updatedConfig);
  }

  return details;
}

/**
 * Auto-select default values from company details.
 * Includes email and GST number from NZBN details.
 */
function autoSelectDefaults(details) {
  const activeDirector = findActiveDirector(details.directors);

  return {
    // Company info
    company_name: details.company_name,
    company_number: details.company_number,
    nzbn: details.nzbn,

    // GST from NZBN details
    gst_number: details.nzbn_details?.gst_number,

    // Contact from active director
    contact_name: activeDirector?.name,
    full_legal_name: activeDirector?.full_name,

    // Email from NZBN details (can be business email)
    contact_email: details.nzbn_details?.email,

    // Phone from NZBN details (optional)
    contact_phone: details.nzbn_details?.phone,

    // Store full metadata for reference
    save_full_metadata: true
  };
}

function findActiveDirector(directors) {
  return directors?.find(d => d.status === 'Current' || d.status === 'Active');
}

function deduplicateResults(nameResults, addressResults) {
  const seen = new Set();
  const combined = [];

  for (const result of [...nameResults, ...addressResults]) {
    if (!seen.has(result.company_number)) {
      seen.add(result.company_number);
      combined.push({
        ...result,
        match_source: nameResults.includes(result) ? 'name' : 'address'
      });
    }
  }

  return combined;
}

module.exports = {
  searchForRestaurant,
  selectCompany,
  extractAndSaveCompanyDetails
};
```

---

## Step Processing

### Step 2: Contact Search (Automatic)

```javascript
async function processStep2(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  for (const job of batch.registration_jobs) {
    // Skip if Step 1 not complete
    const step1 = job.steps.find(s => s.step_number === 1);
    if (step1.status !== 'completed') continue;

    await updateStepStatus(job.id, 2, 'in_progress');

    try {
      const restaurant = job.restaurant;

      // Search Companies Office
      await companiesOfficeBatchService.searchForRestaurant({
        restaurantId: restaurant.id,
        registrationJobId: job.id,
        restaurantName: restaurant.name,
        street: restaurant.address,
        city: restaurant.city
      });

      // Mark as action_required (needs user selection)
      await updateStepStatus(job.id, 2, 'action_required');

    } catch (error) {
      await updateStepStatus(job.id, 2, 'failed', {
        error_message: error.message
      });
    }
  }

  // Update batch to show Step 3 needs action
  await updateBatchStatus(batchId, 'in_progress', { current_step: 3 });
}
```

### Step 3: Company Selection (Action Required)

```javascript
async function completeStep3(batchId, selections, orgId) {
  // selections = { jobId: { company_number: '123' | null } }

  for (const [jobId, selection] of Object.entries(selections)) {
    const job = await getRegistrationJob(jobId, orgId);

    // Save selection
    await companiesOfficeBatchService.selectCompany(
      job.restaurant_id,
      jobId,
      selection.company_number
    );

    // Mark step complete
    await updateStepStatus(jobId, 3, 'completed', {
      result_data: {
        company_number: selection.company_number,
        no_match: !selection.company_number
      }
    });
  }

  // Check if all jobs have completed Step 3
  const allCompleted = await checkAllJobsCompletedStep(batchId, 3);

  if (allCompleted) {
    // Auto-trigger Step 4
    setImmediate(async () => {
      await processStep4(batchId);
    });
  }

  return { updated: Object.keys(selections).length, auto_processing: allCompleted };
}
```

### Step 4: Company Details (Automatic)

```javascript
async function processStep4(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  for (const job of batch.registration_jobs) {
    const step3 = job.steps.find(s => s.step_number === 3);
    if (step3.status !== 'completed') continue;

    await updateStepStatus(job.id, 4, 'in_progress');

    try {
      // Get selected company
      const searchRecord = await getSearchRecord(job.restaurant_id, job.id);

      if (searchRecord.status === 'no_match') {
        // Skip extraction
        await updateStepStatus(job.id, 4, 'skipped', {
          result_data: { reason: 'No company selected' }
        });
        continue;
      }

      // Extract and save
      const details = await companiesOfficeBatchService.extractAndSaveCompanyDetails(
        job.restaurant_id,
        searchRecord.selected_company_number
      );

      await updateStepStatus(job.id, 4, 'completed', {
        result_data: { company_details_saved: true }
      });

    } catch (error) {
      await updateStepStatus(job.id, 4, 'failed', {
        error_message: error.message
      });
    }
  }

  // Progress to Step 5 (Yolo config)
  await updateBatchStatus(batchId, 'in_progress', { current_step: 5 });
}
```

---

## UI Integration

### CompanySelectionView.tsx

See [ui-components.md](./ui-components.md) for the full component specification.

Key features:
- Shows all restaurants needing company selection
- Dropdown to select from candidates
- "None of these" option to skip
- External link to Companies Office for verification
- Bulk "Save & Continue" action

---

## API Endpoints

### Get Step 3 Data

```
GET /api/registration-batches/:batchId/steps/3

Response:
{
  "success": true,
  "step_number": 3,
  "step_name": "Company Selection",
  "restaurants": [
    {
      "job_id": "job-uuid",
      "restaurant_id": "rest-uuid",
      "restaurant_name": "Pizza Palace",
      "restaurant_address": "123 Main St, Auckland",
      "step_status": "action_required",
      "candidates": [
        {
          "company_name": "Pizza Palace Ltd",
          "company_number": "123456",
          "nzbn": "9429000123456",
          "status": "Registered",
          "incorporation_date": "2015-03-15",
          "registered_address": "123 Main Street, Auckland",
          "match_source": "name"
        }
      ],
      "selected_company_number": null
    }
  ]
}
```

### Submit Selections

```
POST /api/registration-batches/:batchId/steps/3/complete

Body:
{
  "selections": {
    "job-uuid-1": { "company_number": "123456" },
    "job-uuid-2": { "company_number": null }
  }
}

Response:
{
  "success": true,
  "updated": 2,
  "next_step": 4,
  "auto_processing": true
}
```

---

## Fallback to Single-Restaurant Flow

The existing CompaniesOfficeDialog should continue to work for:
- Restaurants not in a batch
- Users who prefer single-restaurant workflow
- Re-running contact extraction after batch completion

```tsx
// In RestaurantDetail.jsx
<Button
  onClick={() => setShowCompaniesOfficeDialog(true)}
  disabled={hasActiveRegistrationBatch}
>
  {hasActiveRegistrationBatch
    ? 'Contact extraction in batch'
    : 'Get Contacts'
  }
</Button>
```

---

## Edge Cases

### No Candidates Found
- Mark search record as `no_match`
- Step 3 auto-completes with `no_match: true`
- Step 4 skips extraction

### Search Failure
- Step 2 marks as `failed` for that restaurant
- Other restaurants continue
- User can retry individual restaurants

### All Restaurants Skip
- If all restaurants select "None of these"
- Step 4 completes with all skipped
- Batch continues to Step 5
