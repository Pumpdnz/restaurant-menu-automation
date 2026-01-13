# Lead Conversion Integration

## Overview

This document describes how to integrate the registration batch system with the existing lead-to-restaurant conversion flow.

## Related Investigation Documents
- [INVESTIGATION_LEAD_CONVERSION_FLOW.md](../investigations/phase-2/INVESTIGATION_LEAD_CONVERSION_FLOW.md)

---

## Current Flow

```
PendingLeadsTable.tsx
        │
        ▼
[Select Leads] → [Convert to Restaurants]
        │
        ▼
POST /api/leads/convert
        │
        ▼
convertLeadsToRestaurants()
        │
        ├─ Create restaurant records
        ├─ Update lead.converted_to_restaurant_id
        └─ Return restaurants
        │
        ▼
[Sequence Modal] → [Start Sequences]
        │
        ▼
[Extraction Options] → [Start Menu/Branding Extraction]
```

---

## Modified Flow

```
PendingLeadsTable.tsx
        │
        ▼
[Select Leads] → [Convert to Restaurants]
        │
        ▼
POST /api/leads/convert?create_registration_batch=true  ◄── NEW
        │
        ▼
convertLeadsToRestaurants()
        │
        ├─ Create restaurant records
        ├─ Update lead.converted_to_restaurant_id
        ├─ Create registration_batch_jobs record         ◄── NEW
        ├─ Create registration_jobs for each restaurant  ◄── NEW
        └─ Create registration_job_steps (6 per job)     ◄── NEW
        │
        ▼
[Sequence Modal] → [Start Sequences]
        │
        ▼
[Extraction Options] → [Start Menu/Branding Extraction]
        │
        ▼
[Navigate to Registration Batch Detail]                   ◄── NEW
```

---

## Backend Changes

### leads-routes.js

```javascript
// Existing endpoint with new option
router.post('/convert', requireLeadScrapingConversion, async (req, res) => {
  try {
    const { lead_ids, address_source = 'auto' } = req.body;

    // NEW: Check for batch creation flag
    const {
      create_registration_batch = false,
      batch_name,
      auto_start_batch = false
    } = req.body;

    const result = await leadScrapeService.convertLeadsToRestaurants(
      lead_ids,
      req.user.organisation_id,
      req.user.id,
      {
        addressSource: address_source,
        createRegistrationBatch: create_registration_batch,  // NEW
        batchName: batch_name,                                // NEW
        autoStartBatch: auto_start_batch                      // NEW
      }
    );

    res.json({
      success: true,
      converted_count: result.restaurants.length,
      restaurants: result.restaurants,
      registration_batch: result.registration_batch || null  // NEW
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### lead-scrape-service.js

```javascript
async function convertLeadsToRestaurants(leadIds, orgId, userId, options = {}) {
  const {
    addressSource = 'auto',
    createRegistrationBatch = false,
    batchName,
    autoStartBatch = false
  } = options;

  // Existing conversion logic
  const restaurants = [];

  for (const leadId of leadIds) {
    const lead = await getLeadById(leadId, orgId);

    // Create restaurant record (existing logic)
    const restaurant = await createRestaurantFromLead(lead, {
      addressSource,
      organisationId: orgId
    });

    // Update lead as converted (existing logic)
    await markLeadAsConverted(leadId, restaurant.id, userId);

    restaurants.push(restaurant);
  }

  // NEW: Create registration batch if requested
  let registrationBatch = null;
  if (createRegistrationBatch && restaurants.length > 0) {
    registrationBatch = await registrationBatchService.createRegistrationBatchJob({
      name: batchName || generateBatchName(leadIds, orgId),
      restaurant_ids: restaurants.map(r => r.id),
      organisation_id: orgId,
      source_lead_scrape_job_id: restaurants[0].source_lead_job_id,
      created_by: userId
    });

    // Optionally auto-start the batch
    if (autoStartBatch) {
      await registrationBatchService.startBatchJob(registrationBatch.id, orgId);
    }
  }

  return {
    restaurants,
    registration_batch: registrationBatch
  };
}

function generateBatchName(leadIds, orgId) {
  const date = new Date().toISOString().split('T')[0];
  return `Batch ${date} (${leadIds.length} restaurants)`;
}
```

---

## Frontend Changes

### PendingLeadsTable.tsx

```tsx
// Add state for batch creation option
const [createBatch, setCreateBatch] = useState(true);

// Modify conversion handler
const handleConvert = async () => {
  try {
    const result = await convertMutation.mutateAsync({
      leadIds: selectedLeads,
      createRegistrationBatch: createBatch  // NEW
    });

    setConvertedRestaurants(result.restaurants);

    // NEW: Store batch info for navigation after sequence/extraction
    if (result.registration_batch) {
      setRegistrationBatch(result.registration_batch);
    }

    // Continue to sequence modal...
    setShowSequenceModal(true);
  } catch (error) {
    toast.error('Conversion failed');
  }
};

// Add checkbox to conversion dialog
<Dialog open={showConvertDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Convert {selectedLeads.length} Leads</DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
      {/* Existing options */}

      {/* NEW: Batch creation toggle */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="createBatch"
          checked={createBatch}
          onCheckedChange={setCreateBatch}
        />
        <label htmlFor="createBatch" className="text-sm">
          Create registration batch for automated setup
        </label>
      </div>
    </div>

    <DialogFooter>
      <Button onClick={handleConvert}>
        Convert & {createBatch ? 'Create Batch' : 'Continue'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Post-Extraction Navigation

```tsx
// After extraction options are configured and started
const handleExtractionComplete = () => {
  if (registrationBatch) {
    // Navigate to batch detail page
    navigate(`/registration-batches/${registrationBatch.id}`);
    toast.success('Conversion complete! View registration progress.');
  } else {
    // Close dialog
    setShowExtractionDialog(false);
  }
};
```

---

## Step 1 Integration

Step 1 of the registration batch (Menu & Branding Extraction) should track the extraction jobs that are already triggered during conversion.

### Tracking Extraction Status

```javascript
// In registration-batch-service.js

async function processStep1(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  for (const job of batch.registration_jobs) {
    await updateStepStatus(job.id, 1, 'in_progress');

    try {
      // Check restaurant's extraction status
      const restaurant = await getRestaurant(job.restaurant_id);

      // Check menu extraction job status
      const menuJob = await getLatestMenuExtractionJob(job.restaurant_id);
      const brandingComplete = restaurant.branding_extraction_status === 'completed';

      if (menuJob?.status === 'completed' && brandingComplete) {
        // Already complete
        await updateStepStatus(job.id, 1, 'completed', {
          result_data: {
            menu_job_id: menuJob.id,
            menu_items_count: menuJob.items_extracted,
            branding_complete: true
          }
        });
      } else {
        // Wait for completion (poll or use webhook)
        await waitForExtractions(job.restaurant_id, job.id);
      }
    } catch (error) {
      await updateStepStatus(job.id, 1, 'failed', {
        error_message: error.message
      });
    }
  }

  // Progress to Step 2
  await processStep2(batchId);
}

async function waitForExtractions(restaurantId, jobId) {
  const maxWaitMs = 10 * 60 * 1000; // 10 minutes
  const pollIntervalMs = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const restaurant = await getRestaurant(restaurantId);
    const menuJob = await getLatestMenuExtractionJob(restaurantId);

    const menuComplete = menuJob?.status === 'completed';
    const brandingComplete = restaurant.branding_extraction_status === 'completed';

    if (menuComplete && brandingComplete) {
      return true;
    }

    if (menuJob?.status === 'failed') {
      throw new Error('Menu extraction failed');
    }

    await sleep(pollIntervalMs);
  }

  throw new Error('Extraction timeout');
}
```

---

## Sequence Enrollment Integration

The sequence enrollment that happens after conversion should continue to work as before. The registration batch tracks the overall pipeline, while sequences handle outreach automation separately.

```
Lead Conversion
      │
      ├─── Creates Restaurant Records
      ├─── Creates Registration Batch (optional)
      │
      ▼
Sequence Enrollment (separate concern)
      │
      ├─── Creates sequence_instances
      └─── Handles email/outreach automation
      │
      ▼
Menu/Branding Extraction
      │
      ├─── Creates extraction jobs
      └─── Registration Step 1 tracks these
```

---

## Migration Considerations

1. **Existing Restaurants**: Restaurants converted before this feature won't have registration batches
2. **Manual Batch Creation**: Add ability to create batch from existing restaurants (future enhancement)
3. **Backward Compatibility**: `create_registration_batch` defaults to `false` for existing integrations
