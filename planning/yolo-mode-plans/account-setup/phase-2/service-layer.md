# Service Layer: Registration Batch Orchestration

## Overview

This document defines the backend service layer architecture for the Phase 2 Registration Batch Orchestration system.

## Related Investigation Documents
- [INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md](../investigations/phase-2/INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md)
- [INVESTIGATION_STEP_ORCHESTRATION.md](../investigations/phase-2/INVESTIGATION_STEP_ORCHESTRATION.md)
- [INVESTIGATION_LEAD_CONVERSION_FLOW.md](../investigations/phase-2/INVESTIGATION_LEAD_CONVERSION_FLOW.md)

---

## Service Structure

```
src/services/
├── registration-batch-service.js      # Core batch orchestration
├── registration-job-service.js        # Individual job management
├── registration-step-service.js       # Step execution handlers
└── companies-office-batch-service.js  # Batch contact extraction
```

---

## registration-batch-service.js

### Core Functions

```javascript
/**
 * Creates a new registration batch job with associated registration jobs and steps.
 *
 * @param {Object} data
 * @param {string} data.name - Batch name
 * @param {string[]} data.restaurant_ids - Restaurant UUIDs
 * @param {string} data.organisation_id - Organisation UUID
 * @param {string} [data.source_lead_scrape_job_id] - Source lead scrape job
 * @param {Object} [data.execution_config] - Default config for all jobs
 * @param {string} data.created_by - User UUID
 * @returns {Promise<{batch_job: Object, registration_jobs: Object[]}>}
 */
async function createRegistrationBatchJob(data) {
  const { name, restaurant_ids, organisation_id, source_lead_scrape_job_id, execution_config, created_by } = data;

  // 1. Create batch job
  const batchJob = await supabase
    .from('registration_batch_jobs')
    .insert({
      name,
      organisation_id,
      source_lead_scrape_job_id,
      total_restaurants: restaurant_ids.length,
      total_steps: 6,
      created_by,
      metadata: { execution_config }
    })
    .select()
    .single();

  // 2. Create registration jobs for each restaurant
  const registrationJobs = await Promise.all(
    restaurant_ids.map(restaurant_id =>
      createRegistrationJob({
        batch_job_id: batchJob.id,
        restaurant_id,
        organisation_id,
        execution_config
      })
    )
  );

  return { batch_job: batchJob, registration_jobs: registrationJobs };
}

/**
 * Starts batch job execution. Triggers Step 1 processing.
 */
async function startBatchJob(batchId, orgId) {
  // 1. Validate batch exists and is in correct state
  const batch = await getBatchJob(batchId, orgId);
  if (batch.status !== 'pending' && batch.status !== 'draft') {
    throw new Error('Batch already started or completed');
  }

  // 2. Update batch status
  await updateBatchStatus(batchId, 'in_progress', { started_at: new Date() });

  // 3. Trigger Step 1 processing (async)
  setImmediate(async () => {
    try {
      await processStep1(batchId);
    } catch (error) {
      console.error(`Step 1 failed for batch ${batchId}:`, error);
      await handleBatchError(batchId, error);
    }
  });

  return { started: true };
}

/**
 * Cancels a running batch job.
 */
async function cancelBatchJob(batchId, orgId) {
  const batch = await getBatchJob(batchId, orgId);

  // 1. Cancel all in-progress jobs
  const { data: cancelledJobs } = await supabase
    .from('registration_jobs')
    .update({ status: 'cancelled' })
    .eq('batch_job_id', batchId)
    .in('status', ['pending', 'in_progress'])
    .select();

  // 2. Update batch status
  await updateBatchStatus(batchId, 'cancelled', { cancelled_at: new Date() });

  return { cancelled_jobs: cancelledJobs.length };
}

/**
 * Gets batch job with all registration jobs and step progress.
 */
async function getBatchJobWithDetails(batchId, orgId) {
  const batch = await getBatchJob(batchId, orgId);

  const { data: jobs } = await supabase
    .from('registration_jobs')
    .select(`
      *,
      restaurant:restaurants(id, name, address, city),
      steps:registration_job_steps(*)
    `)
    .eq('batch_job_id', batchId)
    .order('created_at', { ascending: true });

  return { batch_job: batch, registration_jobs: jobs };
}
```

---

## Step Processing Functions

### Step 1: Menu & Branding Extraction

```javascript
/**
 * Processes Step 1 - Tracks menu and branding extraction completion.
 * These extractions are already triggered during lead conversion.
 */
async function processStep1(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  for (const job of batch.registration_jobs) {
    await updateStepStatus(job.id, 1, 'in_progress');

    try {
      // Check if extractions are already complete
      const restaurant = await getRestaurantWithExtractions(job.restaurant_id);

      const menuComplete = restaurant.menu_extraction_status === 'completed';
      const brandingComplete = restaurant.branding_extraction_status === 'completed';

      if (menuComplete && brandingComplete) {
        await updateStepStatus(job.id, 1, 'completed');
      } else {
        // Wait for extractions (poll or webhook)
        await waitForExtractions(job.restaurant_id, job.id);
        await updateStepStatus(job.id, 1, 'completed');
      }
    } catch (error) {
      await updateStepStatus(job.id, 1, 'failed', { error_message: error.message });
    }
  }

  // Auto-progress to Step 2
  await processStep2(batchId);
}
```

### Step 2: Contact Details Search

```javascript
/**
 * Processes Step 2 - Runs Companies Office search for all restaurants.
 * Marks step as action_required when candidates are ready.
 */
async function processStep2(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  for (const job of batch.registration_jobs) {
    if (job.steps[0].status !== 'completed') continue; // Skip if Step 1 incomplete

    await updateStepStatus(job.id, 2, 'in_progress');

    try {
      const restaurant = job.restaurant;

      // Run Companies Office search
      const candidates = await companiesOfficeBatchService.searchForRestaurant({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        street: restaurant.address,
        city: restaurant.city
      });

      // Persist candidates for async selection
      await supabase
        .from('companies_office_search_candidates')
        .upsert({
          restaurant_id: restaurant.id,
          registration_job_id: job.id,
          search_queries: {
            restaurant_name: restaurant.name,
            street: restaurant.address,
            city: restaurant.city
          },
          combined_results: candidates.combined,
          name_results: candidates.byName,
          address_results: candidates.byAddress,
          candidate_count: candidates.combined.length,
          status: candidates.combined.length > 0 ? 'awaiting_selection' : 'no_match',
          searched_at: new Date()
        });

      // Mark step as action_required (needs user selection)
      await updateStepStatus(job.id, 2, 'action_required');

    } catch (error) {
      await updateStepStatus(job.id, 2, 'failed', { error_message: error.message });
    }
  }

  // Update batch current step
  await updateBatchStatus(batchId, 'in_progress', { current_step: 3 });
}
```

### Step 3: Company Selection (Action Required)

```javascript
/**
 * Completes Step 3 - Processes user's company selections.
 * Called from API endpoint when user submits selections.
 */
async function completeStep3(batchId, selections, orgId) {
  // selections = { job_id: { company_number: '123' | null, no_match: bool } }

  for (const [jobId, selection] of Object.entries(selections)) {
    const job = await getRegistrationJob(jobId, orgId);

    if (selection.no_match || !selection.company_number) {
      // User indicated no matching company
      await supabase
        .from('companies_office_search_candidates')
        .update({
          status: 'no_match',
          selected_at: new Date()
        })
        .eq('registration_job_id', jobId);

      await updateStepStatus(jobId, 3, 'completed', {
        result_data: { no_match: true }
      });
    } else {
      // User selected a company
      await supabase
        .from('companies_office_search_candidates')
        .update({
          selected_company_number: selection.company_number,
          status: 'selected',
          selected_at: new Date()
        })
        .eq('registration_job_id', jobId);

      await updateStepStatus(jobId, 3, 'completed', {
        result_data: { company_number: selection.company_number }
      });
    }
  }

  // Check if all jobs completed Step 3
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

### Step 4: Company Details Extraction

```javascript
/**
 * Processes Step 4 - Extracts full company details for selected companies.
 */
async function processStep4(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  for (const job of batch.registration_jobs) {
    const step3 = job.steps.find(s => s.step_number === 3);
    if (step3.status !== 'completed') continue;

    await updateStepStatus(job.id, 4, 'in_progress');

    try {
      // Get selected company
      const { data: searchRecord } = await supabase
        .from('companies_office_search_candidates')
        .select('*')
        .eq('registration_job_id', job.id)
        .single();

      if (searchRecord.status === 'no_match') {
        // Skip extraction for no-match restaurants
        await updateStepStatus(job.id, 4, 'skipped', {
          result_data: { reason: 'No company selected' }
        });
        continue;
      }

      // Extract full company details
      const details = await companiesOfficeBatchService.extractCompanyDetails(
        searchRecord.selected_company_number
      );

      // Save to restaurant record
      await saveCompanyDetailsToRestaurant(job.restaurant_id, details);

      await updateStepStatus(job.id, 4, 'completed', {
        result_data: { company_details: details }
      });

    } catch (error) {
      await updateStepStatus(job.id, 4, 'failed', { error_message: error.message });
    }
  }

  // Update batch to Step 5 (action_required - yolo config)
  await updateBatchStatus(batchId, 'in_progress', { current_step: 5 });
}
```

### Step 5: Yolo Mode Configuration (Action Required)

```javascript
/**
 * Completes Step 5 - Saves yolo mode configurations.
 */
async function completeStep5(batchId, configurations, orgId) {
  // configurations = { job_id: { email, password, steps_enabled, ... } }

  for (const [jobId, config] of Object.entries(configurations)) {
    if (config.use_defaults) {
      // Generate default config from restaurant data
      const defaultConfig = await generateDefaultYoloConfig(jobId);
      config = { ...defaultConfig, ...config };
    }

    // Save configuration to job
    await supabase
      .from('registration_jobs')
      .update({ execution_config: config })
      .eq('id', jobId);

    await updateStepStatus(jobId, 5, 'completed', {
      result_data: { config_applied: true }
    });
  }

  // Check if all jobs configured
  const allCompleted = await checkAllJobsCompletedStep(batchId, 5);

  if (allCompleted) {
    // Auto-trigger Step 6 (Yolo execution)
    setImmediate(async () => {
      await processStep6(batchId);
    });
  }

  return { updated: Object.keys(configurations).length, auto_processing: allCompleted };
}
```

### Step 6: Pumpd Account Setup (Yolo Mode Execution)

Step 6 uses the **same phased parallel execution** as the current Yolo Mode hook (`useYoloModeExecution.ts`).

```javascript
/**
 * Processes Step 6 - Executes Yolo Mode for all restaurants.
 * Uses phased parallel execution inherited from current Yolo Mode logic.
 *
 * Phase 1: Parallel (cloudwaitressAccount blocks Phase 2)
 *   - cloudwaitressAccount, codeGeneration, createOnboardingUser, uploadImages
 *
 * Phase 2: Parallel after Phase 1 (restaurantRegistration blocks config, menuImport blocks Phase 3/4)
 *   - restaurantRegistration, websiteConfig, servicesConfig, paymentConfig, menuImport, syncOnboardingUser
 *
 * Phase 3: After menuImport
 *   - optionSets
 *
 * Phase 4: After menuImport
 *   - itemTags
 */
async function processStep6(batchId) {
  const batch = await getBatchJobWithDetails(batchId);

  // In parallel mode, start all eligible restaurants simultaneously
  const eligibleJobs = batch.registration_jobs.filter(job => {
    const step5 = job.steps.find(s => s.step_number === 5);
    return step5?.status === 'completed';
  });

  // Execute all restaurants in parallel
  await Promise.allSettled(
    eligibleJobs.map(job => executeYoloModeForJob(job, batchId))
  );

  // Check if batch is complete
  const finalStatus = await calculateBatchFinalStatus(batchId);
  await updateBatchStatus(batchId, finalStatus, { completed_at: new Date() });
}

/**
 * Executes Yolo Mode for a single restaurant using phased parallel execution.
 */
async function executeYoloModeForJob(job, batchId) {
  await updateStepStatus(job.id, 6, 'in_progress');

  const config = job.execution_config;
  const phaseProgress = initializePhaseProgress();

  try {
    // ========== PHASE 1: Initial Parallel Operations ==========
    await updatePhaseStatus(job.id, 6, 'phase1', 'in_progress', phaseProgress);

    const phase1Results = await Promise.allSettled([
      executeSubStep('cloudwaitressAccount', job, config, phaseProgress),
      executeSubStep('codeGeneration', job, config, phaseProgress),
      executeSubStep('createOnboardingUser', job, config, phaseProgress),
      executeSubStep('uploadImages', job, config, phaseProgress)
    ]);

    // cloudwaitressAccount is BLOCKING for Phase 2
    const accountResult = phase1Results[0];
    if (accountResult.status === 'rejected' && config.steps_enabled?.cloudwaitressAccount) {
      throw new Error(`Account registration failed: ${accountResult.reason}`);
    }

    await updatePhaseStatus(job.id, 6, 'phase1', 'completed', phaseProgress);

    // ========== PHASE 2: Configuration (Parallel after Phase 1) ==========
    await updatePhaseStatus(job.id, 6, 'phase2', 'in_progress', phaseProgress);

    // restaurantRegistration is BLOCKING for remaining config steps
    await executeSubStep('restaurantRegistration', job, config, phaseProgress);

    // Run remaining Phase 2 steps in parallel
    const phase2Results = await Promise.allSettled([
      executeSubStep('websiteConfig', job, config, phaseProgress),
      executeSubStep('servicesConfig', job, config, phaseProgress),
      executeSubStep('paymentConfig', job, config, phaseProgress),
      executeSubStep('menuImport', job, config, phaseProgress),
      executeSubStep('syncOnboardingUser', job, config, phaseProgress)
    ]);

    // menuImport is BLOCKING for Phases 3 & 4
    const menuImportResult = phase2Results[3];
    if (menuImportResult.status === 'rejected' && config.steps_enabled?.menuImport) {
      throw new Error(`Menu import failed: ${menuImportResult.reason}`);
    }

    await updatePhaseStatus(job.id, 6, 'phase2', 'completed', phaseProgress);

    // ========== PHASE 3: Menu Setup (After menuImport) ==========
    await updatePhaseStatus(job.id, 6, 'phase3', 'in_progress', phaseProgress);
    await executeSubStep('optionSets', job, config, phaseProgress);
    await updatePhaseStatus(job.id, 6, 'phase3', 'completed', phaseProgress);

    // ========== PHASE 4: Finalization (After menuImport) ==========
    await updatePhaseStatus(job.id, 6, 'phase4', 'in_progress', phaseProgress);
    await executeSubStep('itemTags', job, config, phaseProgress);
    await updatePhaseStatus(job.id, 6, 'phase4', 'completed', phaseProgress);

    // ========== COMPLETE ==========
    await updateStepStatus(job.id, 6, 'completed', {
      sub_step_progress: phaseProgress
    });

    await updateJobStatus(job.id, 'completed');
    await incrementBatchProgress(batchId, 'completed');

  } catch (error) {
    await updateStepStatus(job.id, 6, 'failed', {
      error_message: error.message,
      sub_step_progress: phaseProgress
    });

    await updateJobStatus(job.id, 'failed', error.message);
    await incrementBatchProgress(batchId, 'failed');
  }
}

/**
 * Executes a single sub-step with progress tracking.
 */
async function executeSubStep(subStepName, job, config, phaseProgress) {
  // Skip if disabled in config
  if (config.steps_enabled && !config.steps_enabled[subStepName]) {
    updateSubStepInProgress(phaseProgress, subStepName, 'skipped', { reason: 'Disabled in config' });
    return { skipped: true };
  }

  updateSubStepInProgress(phaseProgress, subStepName, 'in_progress', { started_at: new Date() });
  await updatePhaseProgressInDb(job.id, 6, phaseProgress);

  try {
    const result = await executeYoloModeSubStep(subStepName, job, config);
    updateSubStepInProgress(phaseProgress, subStepName, 'completed', {
      completed_at: new Date(),
      duration_ms: Date.now() - phaseProgress.phases[getPhaseForSubStep(subStepName)].sub_steps[subStepName].started_at
    });
    return result;
  } catch (error) {
    updateSubStepInProgress(phaseProgress, subStepName, 'failed', { error: error.message });
    throw error;
  }
}

function initializePhaseProgress() {
  return {
    current_phase: 'phase1',
    phases: {
      phase1: {
        status: 'pending',
        description: 'Initial parallel operations',
        sub_steps: {
          cloudwaitressAccount: { status: 'pending' },
          codeGeneration: { status: 'pending' },
          createOnboardingUser: { status: 'pending' },
          uploadImages: { status: 'pending' }
        }
      },
      phase2: {
        status: 'pending',
        description: 'Configuration (parallel after phase1)',
        sub_steps: {
          restaurantRegistration: { status: 'pending' },
          websiteConfig: { status: 'pending' },
          servicesConfig: { status: 'pending' },
          paymentConfig: { status: 'pending' },
          menuImport: { status: 'pending' },
          syncOnboardingUser: { status: 'pending' }
        }
      },
      phase3: {
        status: 'pending',
        description: 'Menu setup (after menuImport)',
        sub_steps: {
          optionSets: { status: 'pending' }
        }
      },
      phase4: {
        status: 'pending',
        description: 'Finalization (after menuImport)',
        sub_steps: {
          itemTags: { status: 'pending' }
        }
      }
    }
  };
}

/**
 * Executes a single Yolo Mode sub-step.
 */
async function executeYoloModeSubStep(subStep, job, config) {
  const handlers = {
    account: () => registrationService.createPumpdAccount(config),
    codeGeneration: () => registrationService.generateCode(job.restaurant_id),
    onboardingUser: () => onboardingService.createUser(config),
    imageUpload: () => registrationService.uploadImages(job.restaurant_id),
    restaurantRegistration: () => registrationService.registerRestaurant(config),
    websiteConfig: () => registrationService.configureWebsite(job.restaurant_id, config),
    servicesConfig: () => registrationService.configureServices(job.restaurant_id),
    paymentConfig: () => registrationService.configurePayment(job.restaurant_id, config),
    menuImport: () => registrationService.importMenu(job.restaurant_id, config.csv_path),
    onboardingSync: () => onboardingService.syncRestaurant(job.restaurant_id),
    optionSets: () => registrationService.addOptionSets(job.restaurant_id),
    itemTags: () => registrationService.addItemTags(job.restaurant_id)
  };

  const handler = handlers[subStep];
  if (!handler) throw new Error(`Unknown sub-step: ${subStep}`);

  return await handler();
}
```

---

## Helper Functions

```javascript
async function updateStepStatus(jobId, stepNumber, status, data = {}) {
  const update = {
    status,
    updated_at: new Date(),
    ...data
  };

  if (status === 'in_progress') {
    update.started_at = new Date();
  } else if (status === 'completed' || status === 'failed') {
    update.completed_at = new Date();
  }

  return supabase
    .from('registration_job_steps')
    .update(update)
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);
}

async function updateSubStepProgress(jobId, stepNumber, subStepProgress) {
  return supabase
    .from('registration_job_steps')
    .update({
      sub_step_progress: {
        current_sub_step: Object.entries(subStepProgress)
          .find(([, v]) => v.status === 'in_progress')?.[0],
        total_sub_steps: 12,
        sub_steps: subStepProgress
      },
      updated_at: new Date()
    })
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);
}

async function checkAllJobsCompletedStep(batchId, stepNumber) {
  const { data } = await supabase
    .from('registration_job_steps')
    .select('status')
    .eq('step_number', stepNumber)
    .in('job_id',
      supabase.from('registration_jobs')
        .select('id')
        .eq('batch_job_id', batchId)
    );

  return data.every(step =>
    step.status === 'completed' || step.status === 'skipped' || step.status === 'failed'
  );
}

function isBlockingSubStep(subStep) {
  const blockingSteps = ['account', 'restaurantRegistration', 'menuImport'];
  return blockingSteps.includes(subStep);
}
```

---

## Error Handling

```javascript
async function handleStepError(jobId, stepNumber, error) {
  const step = await getStep(jobId, stepNumber);

  if (step.retry_count < step.max_retries) {
    // Retry with exponential backoff
    const delay = Math.pow(2, step.retry_count) * 1000;

    await updateStepStatus(jobId, stepNumber, 'retrying', {
      retry_count: step.retry_count + 1
    });

    setTimeout(async () => {
      await retryStep(jobId, stepNumber);
    }, delay);
  } else {
    // Max retries exceeded
    await updateStepStatus(jobId, stepNumber, 'failed', {
      error_message: error.message,
      error_details: { stack: error.stack }
    });
  }
}

async function handleBatchError(batchId, error) {
  console.error(`Batch ${batchId} error:`, error);

  // Check failure threshold
  const batch = await getBatchJobWithDetails(batchId);
  const failedCount = batch.registration_jobs.filter(j => j.status === 'failed').length;
  const failureRate = failedCount / batch.total_restaurants;

  if (failureRate > 0.5) {
    await updateBatchStatus(batchId, 'failed', {
      error_message: `High failure rate: ${Math.round(failureRate * 100)}%`
    });
  }
}
```

---

## Service Dependencies

```javascript
// Required services
const supabase = require('./database-service');
const registrationService = require('./registration-service');
const onboardingService = require('./onboarding-service');
const companiesOfficeBatchService = require('./companies-office-batch-service');
```
