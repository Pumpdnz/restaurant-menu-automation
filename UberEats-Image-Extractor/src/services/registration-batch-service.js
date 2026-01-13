/**
 * Registration Batch Service
 * Handles business logic for registration batch orchestration
 *
 * This service manages the end-to-end registration pipeline:
 * - Step 1: Menu & Branding Extraction (track existing jobs)
 * - Step 2: Contact Details Search (Companies Office)
 * - Step 3: Company Selection (action_required)
 * - Step 4: Company Details Extraction
 * - Step 5: Yolo Mode Configuration (action_required)
 * - Step 6: Pumpd Account Setup (phased parallel execution)
 */

const { getServiceSupabaseClient } = require('./database-service');
const { executeWithRetry, formatErrorMessage } = require('./database-error-handler');
const axios = require('axios');

// Base URL for internal API calls (server calls itself)
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3007';

// CloudWaitress Rate Limiting Configuration
// Minimum delay between account creations in milliseconds (default: 60 seconds)
const CLOUDWAITRESS_RATE_LIMIT_MS = parseInt(process.env.CLOUDWAITRESS_RATE_LIMIT_MS || '60000', 10);

/**
 * Helper function to delay execution
 * @param {number} ms - Milliseconds to delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Global CloudWaitress Account Creation Queue
 * Ensures only one account creation happens at a time with rate limiting,
 * while allowing all other registration steps to proceed in parallel.
 */
class CloudWaitressRateLimiter {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastExecutionTime = 0;
  }

  /**
   * Add an account creation operation to the queue
   * @param {Function} operation - Async function to execute
   * @returns {Promise} - Resolves when the operation completes
   */
  async enqueue(operation, jobInfo = '') {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject, jobInfo });
      console.log(`[CloudWaitress Queue] Added to queue: ${jobInfo} (queue length: ${this.queue.length})`);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { operation, resolve, reject, jobInfo } = this.queue.shift();

      // Calculate delay needed based on last execution time
      const now = Date.now();
      const timeSinceLastExecution = now - this.lastExecutionTime;
      const delayNeeded = Math.max(0, CLOUDWAITRESS_RATE_LIMIT_MS - timeSinceLastExecution);

      if (delayNeeded > 0 && this.lastExecutionTime > 0) {
        console.log(`[CloudWaitress Queue] Rate limit: waiting ${delayNeeded}ms before ${jobInfo}`);
        await delay(delayNeeded);
      }

      console.log(`[CloudWaitress Queue] Executing: ${jobInfo} (remaining in queue: ${this.queue.length})`);

      try {
        this.lastExecutionTime = Date.now();
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessing = false;
  }
}

// Global instance of the rate limiter
const cloudWaitressRateLimiter = new CloudWaitressRateLimiter();

/**
 * Registration Step Definitions
 * These are the standard steps for registration batch processing
 */
const REGISTRATION_STEPS = [
  {
    step_number: 1,
    step_name: 'Menu & Branding Extraction',
    step_description: 'Track menu and branding extraction job completion',
    step_type: 'automatic'
  },
  {
    step_number: 2,
    step_name: 'Contact Details Search',
    step_description: 'Search Companies Office for legal entities',
    step_type: 'automatic' // Transitions to action_required when done
  },
  {
    step_number: 3,
    step_name: 'Company Selection',
    step_description: 'Select correct company entity for each restaurant',
    step_type: 'action_required'
  },
  {
    step_number: 4,
    step_name: 'Company Details Extraction',
    step_description: 'Extract and save full company details',
    step_type: 'automatic'
  },
  {
    step_number: 5,
    step_name: 'Yolo Mode Configuration',
    step_description: 'Configure account setup settings per restaurant',
    step_type: 'action_required'
  },
  {
    step_number: 6,
    step_name: 'Pumpd Account Setup',
    step_description: 'Execute full account registration workflow',
    step_type: 'automatic'
  }
];

/**
 * Get step definitions
 */
function getRegistrationStepDefinitions() {
  return REGISTRATION_STEPS;
}

// ============================================================================
// BATCH JOB OPERATIONS
// ============================================================================

/**
 * List all registration batch jobs with filtering
 * @param {object} filters - Filter options
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Batch jobs list
 */
async function listRegistrationBatchJobs(filters = {}, orgId) {
  const client = getServiceSupabaseClient();

  try {
    let query = client
      .from('registration_batch_jobs')
      .select(`
        *,
        registration_jobs (
          id,
          restaurant_id,
          status,
          current_step,
          error_message,
          restaurant:restaurants (
            id,
            name,
            city,
            cuisine
          )
        )
      `)
      .eq('organisation_id', orgId);

    // Apply filters
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters.status) {
      const statuses = filters.status.split(',');
      query = query.in('status', statuses);
    }

    // Filter by current step (direct column)
    if (filters.current_step) {
      const steps = filters.current_step.split(',').map(s => parseInt(s));
      query = query.in('current_step', steps);
    }

    // Apply sorting
    const sortBy = filters.sort_by || 'created_at';
    const sortDirection = filters.sort_direction === 'asc' ? true : false;

    // Map frontend sort keys to database columns
    const sortColumnMap = {
      'created_at': 'created_at',
      'total_restaurants': 'total_restaurants',
      'current_step': 'current_step',
      'name': 'name'
    };

    const sortColumn = sortColumnMap[sortBy] || 'created_at';
    query = query.order(sortColumn, { ascending: sortDirection });

    const { data, error } = await query;

    if (error) throw error;

    // Map response
    let batchJobs = data.map(batch => ({
      ...batch,
      jobs: batch.registration_jobs || []
    }));

    batchJobs.forEach(batch => delete batch.registration_jobs);

    // Client-side filtering for city (batch contains ANY restaurant in selected cities)
    if (filters.city) {
      const cities = filters.city.split(',').map(c => c.toLowerCase());
      batchJobs = batchJobs.filter(batch => {
        return batch.jobs.some(job => {
          const restaurantCity = job.restaurant?.city?.toLowerCase();
          return restaurantCity && cities.includes(restaurantCity);
        });
      });
    }

    // Client-side filtering for cuisine (batch contains ANY restaurant with selected cuisines)
    if (filters.cuisine) {
      const cuisines = filters.cuisine.split(',').map(c => c.toLowerCase());
      batchJobs = batchJobs.filter(batch => {
        return batch.jobs.some(job => {
          const restaurantCuisine = job.restaurant?.cuisine;
          if (!restaurantCuisine) return false;

          // Handle both string and array cuisine formats
          const cuisineArray = Array.isArray(restaurantCuisine)
            ? restaurantCuisine.map(c => c.toLowerCase())
            : [restaurantCuisine.toLowerCase()];

          return cuisineArray.some(c => cuisines.includes(c));
        });
      });
    }

    // Apply pagination after client-side filtering
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    const totalCount = batchJobs.length;
    const paginatedJobs = batchJobs.slice(offset, offset + limit);

    return {
      batch_jobs: paginatedJobs,
      total_count: totalCount,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: offset + paginatedJobs.length < totalCount
      }
    };
  } catch (error) {
    console.error('[Registration Batch Service] Error listing batch jobs:', error);
    throw error;
  }
}

/**
 * Get a single registration batch job with full details
 * @param {string} batchId - Batch job ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Batch job with details
 */
async function getRegistrationBatchJob(batchId, orgId) {
  const client = getServiceSupabaseClient();

  try {
    const { data: batch, error: batchError } = await client
      .from('registration_batch_jobs')
      .select('*')
      .eq('id', batchId)
      .eq('organisation_id', orgId)
      .single();

    if (batchError) throw batchError;
    if (!batch) throw new Error('Batch job not found');

    // Get all registration jobs with steps
    // Note: Must include all restaurant fields needed for Yolo Mode configuration (Step 5)
    // This includes: extraction URLs, branding colors, all logo variants, opening hours, etc.
    const { data: jobs, error: jobsError } = await client
      .from('registration_jobs')
      .select(`
        *,
        restaurant:restaurants(
          id, name, slug, subdomain, address, city, email, phone,
          ubereats_url, doordash_url, website_url, facebook_url,
          opening_hours, cuisine,
          contact_name, contact_email, contact_phone,
          theme, primary_color, secondary_color, tertiary_color, accent_color, background_color,
          logo_url, logo_nobg_url, logo_standard_url,
          logo_thermal_url, logo_thermal_alt_url, logo_thermal_contrast_url, logo_thermal_adaptive_url,
          logo_favicon_url, website_og_image, ubereats_og_image, doordash_og_image, facebook_cover_image,
          user_email, user_password_hint,
          stripe_connect_url
        ),
        steps:registration_job_steps(*)
      `)
      .eq('batch_job_id', batchId)
      .order('created_at', { ascending: true });

    if (jobsError) throw jobsError;

    // Sort steps by step_number
    let registrationJobs = jobs.map(job => ({
      ...job,
      steps: (job.steps || []).sort((a, b) => a.step_number - b.step_number)
    }));

    // If batch is at Step 3 (Company Selection), fetch and attach company candidates
    const step3NeedsAction = batch.current_step === 3 ||
      registrationJobs.some(job => {
        const step3 = job.steps.find(s => s.step_number === 3);
        return step3?.status === 'action_required';
      });

    if (step3NeedsAction) {
      // Fetch company search candidates for all jobs in this batch
      const { data: candidates } = await client
        .from('companies_office_search_candidates')
        .select('*')
        .in('registration_job_id', registrationJobs.map(j => j.id));

      // Attach candidates to each job
      if (candidates && candidates.length > 0) {
        const candidatesByJobId = {};
        candidates.forEach(c => {
          candidatesByJobId[c.registration_job_id] = c;
        });

        registrationJobs = registrationJobs.map(job => ({
          ...job,
          company_candidates: candidatesByJobId[job.id]?.combined_results || [],
          company_search_status: candidatesByJobId[job.id]?.status || null,
          selected_company_number: candidatesByJobId[job.id]?.selected_company_number || null
        }));
      }
    }

    // Always fetch menus - they're needed for Step 5 configuration and validation
    // The overhead is minimal and it ensures menus are always available
    const shouldFetchMenus = true;

    console.log(`[Registration Batch Service] Fetching menus for batch, current_step=${batch.current_step}`);

    if (shouldFetchMenus) {
      // Get all restaurant IDs
      const restaurantIds = registrationJobs
        .map(j => j.restaurant?.id)
        .filter(Boolean);

      if (restaurantIds.length > 0) {
        // Fetch menus for all restaurants (include restaurant_id for grouping)
        const { data: menus, error: menusError } = await client
          .from('menus')
          .select(`
            id,
            version,
            created_at,
            restaurant_id,
            platform_id,
            is_active,
            platforms (id, name)
          `)
          .in('restaurant_id', restaurantIds)
          .order('created_at', { ascending: false });

        if (menusError) {
          console.error('[Registration Batch Service] Error fetching menus:', menusError);
        }

        console.log(`[Registration Batch Service] Found ${(menus || []).length} menus for ${restaurantIds.length} restaurants`);

        // Get item counts for each menu
        const menuIds = (menus || []).map(m => m.id);
        let countByMenuId = {};

        if (menuIds.length > 0) {
          const { data: itemCounts } = await client
            .from('menu_items')
            .select('menu_id')
            .in('menu_id', menuIds);

          // Count items per menu
          (itemCounts || []).forEach(item => {
            countByMenuId[item.menu_id] = (countByMenuId[item.menu_id] || 0) + 1;
          });
        }

        // Group menus by restaurant_id
        const menusByRestaurant = {};
        (menus || []).forEach(menu => {
          const restaurantId = menu.restaurant_id;
          if (!menusByRestaurant[restaurantId]) {
            menusByRestaurant[restaurantId] = [];
          }
          menusByRestaurant[restaurantId].push({
            ...menu,
            item_count: countByMenuId[menu.id] || 0
          });
        });

        // Attach menus to each job's restaurant
        registrationJobs = registrationJobs.map(job => {
          const restaurantMenus = job.restaurant?.id ? menusByRestaurant[job.restaurant.id] || [] : [];
          console.log(`[Registration Batch Service] Restaurant ${job.restaurant?.name} (${job.restaurant?.id}) has ${restaurantMenus.length} menus`);
          return {
            ...job,
            restaurant: job.restaurant ? {
              ...job.restaurant,
              menus: restaurantMenus
            } : job.restaurant
          };
        });
      }
    }

    // Calculate step summary
    const stepSummary = {};
    for (let i = 1; i <= 6; i++) {
      stepSummary[`step_${i}`] = {
        pending: 0,
        in_progress: 0,
        action_required: 0,
        completed: 0,
        failed: 0,
        skipped: 0
      };
    }

    registrationJobs.forEach(job => {
      job.steps.forEach(step => {
        if (stepSummary[`step_${step.step_number}`]) {
          stepSummary[`step_${step.step_number}`][step.status]++;
        }
      });
    });

    return {
      batch_job: batch,
      registration_jobs: registrationJobs,
      step_summary: stepSummary
    };
  } catch (error) {
    console.error('[Registration Batch Service] Error getting batch job:', error);
    throw error;
  }
}

/**
 * Create a new registration batch job
 * @param {object} data - Batch creation data
 * @param {string} data.name - Batch name
 * @param {string[]} data.restaurant_ids - Restaurant UUIDs
 * @param {string} data.organisation_id - Organisation ID
 * @param {string} [data.source_lead_scrape_job_id] - Source lead scrape job
 * @param {object} [data.execution_config] - Default config for all jobs
 * @param {string} data.created_by - User UUID
 * @returns {Promise<object>} Created batch with jobs
 */
async function createRegistrationBatchJob(data) {
  const client = getServiceSupabaseClient();
  const {
    name,
    restaurant_ids,
    organisation_id,
    source_lead_scrape_job_id,
    execution_config,
    created_by
  } = data;

  try {
    // 1. Create the batch job
    const { data: batchJob, error: batchError } = await client
      .from('registration_batch_jobs')
      .insert({
        name,
        organisation_id,
        source_lead_scrape_job_id,
        total_restaurants: restaurant_ids.length,
        total_steps: 6,
        created_by,
        execution_mode: 'parallel',
        status: 'pending',
        metadata: { default_execution_config: execution_config }
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // 2. Create registration jobs for each restaurant
    const registrationJobs = [];
    for (const restaurant_id of restaurant_ids) {
      const job = await createRegistrationJob({
        batch_job_id: batchJob.id,
        restaurant_id,
        organisation_id,
        execution_config: execution_config || {}
      });
      registrationJobs.push(job);
    }

    console.log(`[Registration Batch Service] Created batch ${batchJob.id} with ${registrationJobs.length} jobs`);

    return {
      batch_job: batchJob,
      registration_jobs: registrationJobs
    };
  } catch (error) {
    console.error('[Registration Batch Service] Error creating batch job:', error);
    throw error;
  }
}

/**
 * Create a single registration job with steps
 * @param {object} data - Job data
 * @returns {Promise<object>} Created job with steps
 */
async function createRegistrationJob(data) {
  const client = getServiceSupabaseClient();
  const { batch_job_id, restaurant_id, organisation_id, execution_config } = data;

  try {
    // Create the registration job
    const { data: job, error: jobError } = await client
      .from('registration_jobs')
      .insert({
        batch_job_id,
        restaurant_id,
        organisation_id,
        execution_config,
        status: 'pending',
        current_step: 1,
        total_steps: 6
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Create steps for the job
    const steps = REGISTRATION_STEPS.map(stepDef => ({
      job_id: job.id,
      step_number: stepDef.step_number,
      step_name: stepDef.step_name,
      step_description: stepDef.step_description,
      step_type: stepDef.step_type,
      status: 'pending'
    }));

    const { error: stepsError } = await client
      .from('registration_job_steps')
      .insert(steps);

    if (stepsError) throw stepsError;

    return job;
  } catch (error) {
    console.error('[Registration Batch Service] Error creating registration job:', error);
    throw error;
  }
}

/**
 * Update batch job status
 * @param {string} batchId - Batch ID
 * @param {string} status - New status
 * @param {object} [additionalUpdates] - Additional fields to update
 */
async function updateBatchStatus(batchId, status, additionalUpdates = {}) {
  const client = getServiceSupabaseClient();

  try {
    const updates = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalUpdates
    };

    const { data, error } = await client
      .from('registration_batch_jobs')
      .update(updates)
      .eq('id', batchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Registration Batch Service] Error updating batch status:', error);
    throw error;
  }
}

/**
 * Start a batch job - triggers Step 1 processing
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 */
async function startBatchJob(batchId, orgId) {
  const client = getServiceSupabaseClient();

  try {
    // 1. Validate batch exists and is in correct state
    const { batch_job } = await getRegistrationBatchJob(batchId, orgId);

    if (batch_job.status !== 'pending' && batch_job.status !== 'draft') {
      throw new Error(`Cannot start batch in status: ${batch_job.status}`);
    }

    // 2. Update batch status to in_progress
    await updateBatchStatus(batchId, 'in_progress', {
      started_at: new Date().toISOString(),
      current_step: 1
    });

    // 3. Update all jobs to in_progress
    await client
      .from('registration_jobs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('batch_job_id', batchId)
      .eq('status', 'pending');

    console.log(`[Registration Batch Service] Started batch ${batchId}`);

    // 4. Trigger Step 1 processing asynchronously
    setImmediate(async () => {
      try {
        await processStep1(batchId, orgId);
      } catch (error) {
        console.error(`[Registration Batch Service] Step 1 failed for batch ${batchId}:`, error);
        await handleBatchError(batchId, error);
      }
    });

    return { started: true, batch_id: batchId };
  } catch (error) {
    console.error('[Registration Batch Service] Error starting batch:', error);
    throw error;
  }
}

/**
 * Cancel a running batch job
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 */
async function cancelBatchJob(batchId, orgId) {
  const client = getServiceSupabaseClient();

  try {
    // Validate batch exists
    const { batch_job } = await getRegistrationBatchJob(batchId, orgId);

    if (batch_job.status === 'completed' || batch_job.status === 'cancelled') {
      throw new Error(`Cannot cancel batch in status: ${batch_job.status}`);
    }

    // Cancel all in-progress/pending jobs
    const { data: cancelledJobs } = await client
      .from('registration_jobs')
      .update({ status: 'cancelled' })
      .eq('batch_job_id', batchId)
      .in('status', ['pending', 'in_progress'])
      .select();

    // Get count of already completed jobs
    const { count: completedCount } = await client
      .from('registration_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('batch_job_id', batchId)
      .eq('status', 'completed');

    // Update batch status
    await updateBatchStatus(batchId, 'cancelled', {
      cancelled_at: new Date().toISOString()
    });

    console.log(`[Registration Batch Service] Cancelled batch ${batchId}`);

    return {
      cancelled_jobs: cancelledJobs?.length || 0,
      already_completed: completedCount || 0
    };
  } catch (error) {
    console.error('[Registration Batch Service] Error cancelling batch:', error);
    throw error;
  }
}

/**
 * Get batch progress (lightweight for polling)
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 */
async function getBatchProgress(batchId, orgId) {
  const client = getServiceSupabaseClient();

  try {
    const { data: batch, error } = await client
      .from('registration_batch_jobs')
      .select('id, status, current_step, total_steps, total_restaurants, completed_restaurants, failed_restaurants, updated_at')
      .eq('id', batchId)
      .eq('organisation_id', orgId)
      .single();

    if (error) throw error;

    // Calculate progress percentage
    const progressPercent = Math.round(
      ((batch.completed_restaurants + batch.failed_restaurants) / batch.total_restaurants) * 100
    );

    // Find step requiring action
    const { data: actionSteps } = await client
      .from('registration_job_steps')
      .select('step_number')
      .eq('status', 'action_required')
      .in('job_id',
        client.from('registration_jobs').select('id').eq('batch_job_id', batchId)
      )
      .limit(1);

    return {
      status: batch.status,
      progress_percent: progressPercent,
      current_step: batch.current_step,
      step_requiring_action: actionSteps?.[0]?.step_number || null,
      restaurants_summary: {
        total: batch.total_restaurants,
        completed: batch.completed_restaurants,
        failed: batch.failed_restaurants,
        in_progress: batch.total_restaurants - batch.completed_restaurants - batch.failed_restaurants
      },
      last_updated: batch.updated_at
    };
  } catch (error) {
    console.error('[Registration Batch Service] Error getting batch progress:', error);
    throw error;
  }
}

/**
 * Mark registration jobs as having extractions executed on creation
 * This is called when user starts extractions from PendingLeadsTable before batch start
 * @param {string} batchId - Batch ID
 * @param {string[]} restaurantIds - Restaurant IDs that had extractions started
 * @param {string} orgId - Organization ID
 */
async function markExtractionsExecutedOnCreation(batchId, restaurantIds, orgId) {
  const client = getServiceSupabaseClient();

  try {
    // Verify batch exists and belongs to org
    const { data: batch, error: batchError } = await client
      .from('registration_batch_jobs')
      .select('id')
      .eq('id', batchId)
      .eq('organisation_id', orgId)
      .single();

    if (batchError || !batch) {
      throw new Error('Batch not found');
    }

    // Update registration jobs for the specified restaurants
    const { data: updatedJobs, error: updateError } = await client
      .from('registration_jobs')
      .update({
        extractions_executed_on_creation: true,
        updated_at: new Date().toISOString()
      })
      .eq('batch_job_id', batchId)
      .in('restaurant_id', restaurantIds)
      .select('id, restaurant_id');

    if (updateError) throw updateError;

    console.log(`[Registration Batch Service] Marked ${updatedJobs?.length || 0} jobs as having extractions executed on creation`);

    return {
      updated_count: updatedJobs?.length || 0,
      restaurant_ids: updatedJobs?.map(j => j.restaurant_id) || []
    };
  } catch (error) {
    console.error('[Registration Batch Service] Error marking extractions executed:', error);
    throw error;
  }
}

// ============================================================================
// STEP PROCESSING
// ============================================================================

/**
 * Update step status for a registration job
 * Includes retry logic for transient database errors
 */
async function updateStepStatus(jobId, stepNumber, status, additionalData = {}) {
  const client = getServiceSupabaseClient();

  const updates = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalData
  };

  if (status === 'in_progress' && !additionalData.started_at) {
    updates.started_at = new Date().toISOString();
  }

  if ((status === 'completed' || status === 'failed') && !additionalData.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const data = await executeWithRetry(
    () => client
      .from('registration_job_steps')
      .update(updates)
      .eq('job_id', jobId)
      .eq('step_number', stepNumber)
      .select()
      .single(),
    `updateStepStatus(job=${jobId}, step=${stepNumber}, status=${status})`
  );

  return data;
}

/**
 * Update job status
 * Includes retry logic for transient database errors
 * @param {string} jobId - Job ID
 * @param {string} status - New status
 * @param {string|null} errorMessage - Optional error message
 * @param {number|null} currentStep - Optional current step number to update
 */
async function updateJobStatus(jobId, status, errorMessage = null, currentStep = null) {
  const client = getServiceSupabaseClient();

  const updates = {
    status,
    updated_at: new Date().toISOString()
  };

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  if (currentStep !== null) {
    updates.current_step = currentStep;
  }

  const data = await executeWithRetry(
    () => client
      .from('registration_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single(),
    `updateJobStatus(job=${jobId}, status=${status})`
  );

  return data;
}

/**
 * Increment batch progress counters
 * Includes retry logic for transient database errors
 */
async function incrementBatchProgress(batchId, type) {
  // Skip for single-restaurant mode (no batch)
  if (!batchId) {
    return;
  }

  const client = getServiceSupabaseClient();

  const column = type === 'completed' ? 'completed_restaurants' : 'failed_restaurants';

  // Read current value with retry
  const batch = await executeWithRetry(
    () => client
      .from('registration_batch_jobs')
      .select(column)
      .eq('id', batchId)
      .single(),
    `incrementBatchProgress.read(batch=${batchId}, type=${type})`
  );

  // Update with retry
  await executeWithRetry(
    () => client
      .from('registration_batch_jobs')
      .update({
        [column]: (batch?.[column] || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId),
    `incrementBatchProgress.update(batch=${batchId}, type=${type})`
  );
}

/**
 * Check if all jobs have completed a specific step
 */
async function checkAllJobsCompletedStep(batchId, stepNumber) {
  const client = getServiceSupabaseClient();

  // Get all job IDs for this batch
  const { data: jobs } = await client
    .from('registration_jobs')
    .select('id')
    .eq('batch_job_id', batchId);

  if (!jobs || jobs.length === 0) return true;

  // Check step status for all jobs
  const { data: steps } = await client
    .from('registration_job_steps')
    .select('status')
    .eq('step_number', stepNumber)
    .in('job_id', jobs.map(j => j.id));

  // All jobs must be completed, skipped, or failed
  return steps.every(step =>
    ['completed', 'skipped', 'failed'].includes(step.status)
  );
}

/**
 * Calculate final batch status
 */
async function calculateBatchFinalStatus(batchId) {
  const client = getServiceSupabaseClient();

  const { data: batch } = await client
    .from('registration_batch_jobs')
    .select('total_restaurants, completed_restaurants, failed_restaurants')
    .eq('id', batchId)
    .single();

  const total = batch.total_restaurants;
  const completed = batch.completed_restaurants;
  const failed = batch.failed_restaurants;

  if (completed + failed < total) {
    return 'in_progress';
  }

  // Check failure rate
  const failureRate = failed / total;
  if (failureRate > 0.5) {
    return 'failed';
  }

  return 'completed';
}

/**
 * Handle batch-level errors
 */
async function handleBatchError(batchId, error) {
  console.error(`[Registration Batch Service] Batch ${batchId} error:`, error);

  try {
    await updateBatchStatus(batchId, 'failed', {
      metadata: { error_message: error.message }
    });
  } catch (updateError) {
    console.error('[Registration Batch Service] Failed to update batch error status:', updateError);
  }
}

// ============================================================================
// STEP 1: Menu & Branding Extraction Tracking
// ============================================================================

/**
 * Process Step 1 - Trigger menu & branding extractions if not already started
 * Extractions run in background; validation happens before Step 6
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 */
async function processStep1(batchId, orgId) {
  console.log(`[Registration Batch Service] Processing Step 1 for batch ${batchId}`);

  const client = getServiceSupabaseClient();
  const { batch_job, registration_jobs } = await getRegistrationBatchJob(batchId, orgId);

  for (const job of registration_jobs) {
    try {
      await updateStepStatus(job.id, 1, 'in_progress');
      await updateJobStatus(job.id, 'in_progress', null, 1); // Update job's current_step to 1

      const restaurant = job.restaurant;
      if (!restaurant) {
        await updateStepStatus(job.id, 1, 'failed', {
          error_message: 'Restaurant data not found'
        });
        continue;
      }

      // Check if extractions were already executed on creation (from PendingLeadsTable)
      // If so, skip triggering new extractions - they're already running
      if (job.extractions_executed_on_creation) {
        console.log(`[Registration Batch Service] Skipping extraction triggering for ${restaurant.name} - already executed on creation`);
        await updateStepStatus(job.id, 1, 'completed', {
          result_data: {
            extractions_triggered: { menu: false, branding: false },
            skipped_reason: 'Extractions already executed on creation',
            timestamp: new Date().toISOString()
          }
        });
        continue;
      }

      // Check if extraction jobs already exist for this restaurant
      const { data: existingJobs } = await client
        .from('extraction_jobs')
        .select('id, job_type, status')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const hasMenuExtraction = existingJobs?.some(j => j.job_type === 'full_menu' || j.job_type === 'premium');
      const extractionsTriggered = { menu: false, branding: false };

      // Trigger menu extraction if not started and restaurant has UberEats URL
      if (!hasMenuExtraction && restaurant.ubereats_url) {
        try {
          const premiumExtractionService = require('./premium-extraction-service');

          const result = await premiumExtractionService.extractPremiumMenu(
            restaurant.ubereats_url,
            orgId,
            {
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
              extractOptionSets: true,
              validateImages: true,
              async: true, // Run in background
              saveToDatabase: true
            }
          );

          extractionsTriggered.menu = true;
          extractionsTriggered.menuJobId = result.jobId;
          console.log(`[Registration Batch Service] Triggered menu extraction for ${restaurant.name} (job: ${result.jobId})`);
        } catch (extractError) {
          console.error(`[Registration Batch Service] Failed to trigger menu extraction for ${restaurant.name}:`, extractError);
          // Non-blocking - continue with other steps
        }
      }

      // Trigger branding extraction if restaurant has website URL and no logo
      // Uses logo-extraction-service directly (same as /api/website-extraction/branding endpoint)
      if (restaurant.website_url && !restaurant.logo_url) {
        try {
          const logoService = require('./logo-extraction-service');
          const databaseService = require('./database-service');

          // Fire and forget - don't await the full process
          (async () => {
            try {
              // Step 1: Extract branding from Firecrawl
              const brandingResult = await logoService.extractBrandingWithFirecrawl(restaurant.website_url);

              if (!brandingResult?.success) {
                console.error(`[Registration Batch Service] Branding extraction failed for ${restaurant.name}: ${brandingResult?.error}`);
                return;
              }

              // Step 2: Process logo if found
              let logoVersions = {};
              if (brandingResult.images?.logoUrl) {
                try {
                  const logoBuffer = await logoService.downloadImageToBuffer(
                    brandingResult.images.logoUrl,
                    restaurant.website_url
                  );
                  logoVersions = await logoService.processLogoVersions(logoBuffer, { skipFavicon: false });
                } catch (logoError) {
                  console.error(`[Registration Batch Service] Logo processing failed for ${restaurant.name}:`, logoError.message);
                }
              }

              // Step 2b: If Firecrawl provided a separate favicon URL, download and convert to base64
              if (brandingResult.images?.faviconUrl) {
                try {
                  const faviconBuffer = await logoService.downloadImageToBuffer(
                    brandingResult.images.faviconUrl,
                    restaurant.website_url
                  );
                  const sharp = require('sharp');
                  const sharpIco = require('sharp-ico');

                  let processableBuffer = faviconBuffer;

                  // Check if it's an ICO file (by URL extension or magic bytes)
                  const isIcoUrl = brandingResult.images.faviconUrl.toLowerCase().endsWith('.ico');
                  const isIcoMagic = faviconBuffer.length >= 4 &&
                    faviconBuffer[0] === 0 && faviconBuffer[1] === 0 &&
                    faviconBuffer[2] === 1 && faviconBuffer[3] === 0;

                  if (isIcoUrl || isIcoMagic) {
                    console.log(`[Registration Batch Service] Converting ICO favicon for ${restaurant.name}`);
                    try {
                      // Decode ICO and get the largest image
                      const images = sharpIco.sharpsFromIco(faviconBuffer);
                      if (images && images.length > 0) {
                        // Get the largest image (last in array, sorted by size)
                        const largestImage = images[images.length - 1];
                        processableBuffer = await largestImage.png().toBuffer();
                      }
                    } catch (icoError) {
                      console.error(`[Registration Batch Service] ICO decode failed, trying as regular image:`, icoError.message);
                    }
                  }

                  const resizedFavicon = await sharp(processableBuffer)
                    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
                    .png()
                    .toBuffer();
                  logoVersions.favicon = `data:image/png;base64,${resizedFavicon.toString('base64')}`;
                } catch (faviconError) {
                  console.error(`[Registration Batch Service] Favicon processing failed for ${restaurant.name}:`, faviconError.message);
                }
              }

              // Step 2c: If Firecrawl provided an OG image URL, download and convert to base64
              let ogImageBase64 = null;
              if (brandingResult.images?.ogImageUrl) {
                try {
                  const ogImageBuffer = await logoService.downloadImageToBuffer(
                    brandingResult.images.ogImageUrl,
                    restaurant.website_url
                  );
                  ogImageBase64 = `data:image/jpeg;base64,${ogImageBuffer.toString('base64')}`;
                } catch (ogError) {
                  console.error(`[Registration Batch Service] OG image processing failed for ${restaurant.name}:`, ogError.message);
                }
              }

              // Step 3: Build update object with ALL available fields
              const updateData = {};

              // Logo versions - all variants
              const versionMapping = {
                'logo_url': 'original',
                'logo_nobg_url': 'nobg',
                'logo_standard_url': 'standard',
                'logo_thermal_url': 'thermal',
                'logo_thermal_alt_url': 'thermal_alt',
                'logo_thermal_contrast_url': 'thermal_contrast',
                'logo_thermal_adaptive_url': 'thermal_adaptive',
                'logo_favicon_url': 'favicon'
              };

              for (const [field, versionKey] of Object.entries(versionMapping)) {
                if (logoVersions[versionKey]) {
                  updateData[field] = logoVersions[versionKey];
                }
              }

              // Colors - all variants (handle both naming conventions from Firecrawl)
              if (brandingResult.colors) {
                const colors = brandingResult.colors;
                if (colors.primaryColor || colors.primary) {
                  updateData.primary_color = colors.primaryColor || colors.primary;
                }
                if (colors.secondaryColor || colors.secondary) {
                  updateData.secondary_color = colors.secondaryColor || colors.secondary;
                }
                if (colors.tertiaryColor || colors.tertiary) {
                  updateData.tertiary_color = colors.tertiaryColor || colors.tertiary;
                }
                if (colors.accentColor || colors.accent) {
                  updateData.accent_color = colors.accentColor || colors.accent;
                }
                if (colors.backgroundColor || colors.background) {
                  updateData.background_color = colors.backgroundColor || colors.background;
                }
                if (colors.theme) {
                  updateData.theme = colors.theme;
                }
              }

              // OG metadata - website header fields
              if (ogImageBase64) {
                updateData.website_og_image = ogImageBase64;
              } else if (brandingResult.images?.ogImageUrl) {
                updateData.website_og_image = brandingResult.images.ogImageUrl;
              }
              if (brandingResult.metadata?.ogTitle) {
                updateData.website_og_title = brandingResult.metadata.ogTitle;
              }
              if (brandingResult.metadata?.ogDescription) {
                updateData.website_og_description = brandingResult.metadata.ogDescription;
              }

              // Step 4: Update restaurant if we have data
              if (Object.keys(updateData).length > 0) {
                await databaseService.updateRestaurant(restaurant.id, updateData);
                console.log(`[Registration Batch Service] Branding saved for ${restaurant.name}: ${Object.keys(updateData).join(', ')}`);
              }
            } catch (innerError) {
              console.error(`[Registration Batch Service] Branding extraction error for ${restaurant.name}:`, innerError);
            }
          })();

          extractionsTriggered.branding = true;
          console.log(`[Registration Batch Service] Triggered branding extraction for ${restaurant.name}`);
        } catch (extractError) {
          console.error(`[Registration Batch Service] Failed to trigger branding extraction for ${restaurant.name}:`, extractError);
          // Non-blocking - continue with other steps
        }
      }

      // Mark Step 1 as completed (extractions run in background)
      await updateStepStatus(job.id, 1, 'completed', {
        result_data: {
          extractions_triggered: extractionsTriggered,
          existing_extraction_jobs: existingJobs?.length || 0,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error(`[Registration Batch Service] Step 1 failed for job ${job.id}:`, error);
      await updateStepStatus(job.id, 1, 'failed', {
        error_message: error.message
      });
    }
  }

  // Update batch current step
  await updateBatchStatus(batchId, 'in_progress', { current_step: 2 });

  // Auto-progress to Step 2
  console.log(`[Registration Batch Service] Step 1 complete, starting Step 2 for batch ${batchId}`);
  await processStep2(batchId, orgId);
}

// ============================================================================
// STEP 2: Contact Details Search
// ============================================================================

/**
 * Process Step 2 - Run Companies Office search
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 */
async function processStep2(batchId, orgId) {
  console.log(`[Registration Batch Service] Processing Step 2 for batch ${batchId}`);

  const { batch_job, registration_jobs } = await getRegistrationBatchJob(batchId, orgId);

  // Import companies office batch service (lazy load to avoid circular deps)
  const companiesOfficeBatchService = require('./companies-office-batch-service');

  // Filter to jobs ready for Step 2
  const eligibleJobs = registration_jobs.filter(job => {
    const step1 = job.steps.find(s => s.step_number === 1);
    return step1?.status === 'completed';
  });

  console.log(`[Registration Batch Service] Step 2: Processing ${eligibleJobs.length} restaurants in parallel`);

  // Process ALL restaurants in parallel instead of sequentially
  await Promise.allSettled(eligibleJobs.map(async (job) => {
    try {
      await updateStepStatus(job.id, 2, 'in_progress');
      await updateJobStatus(job.id, 'in_progress', null, 2); // Update job's current_step to 2

      const restaurant = job.restaurant;
      if (!restaurant) {
        await updateStepStatus(job.id, 2, 'failed', {
          error_message: 'Restaurant data not found'
        });
        return;
      }

      // Run Companies Office search
      const searchResult = await companiesOfficeBatchService.searchForRestaurant({
        restaurantId: restaurant.id,
        registrationJobId: job.id,
        restaurantName: restaurant.name,
        street: restaurant.address,
        city: restaurant.city
      });

      // Check if candidates were found
      const candidatesFound = searchResult.combined && searchResult.combined.length > 0;

      if (candidatesFound) {
        // Candidates found - Step 2 complete, Step 3 needs user selection
        await updateStepStatus(job.id, 2, 'completed');
        await updateStepStatus(job.id, 3, 'action_required');
        await updateJobStatus(job.id, 'action_required', null, 3); // Update job's current_step to 3
        console.log(`[Registration Batch Service] Job ${job.id}: ${searchResult.combined.length} candidates found, Step 3 action required`);
      } else {
        // No candidates - Step 2 action_required so user can retry or enter manually
        await updateStepStatus(job.id, 2, 'action_required');
        console.log(`[Registration Batch Service] Job ${job.id}: No candidates found, Step 2 action required for retry/manual entry`);
      }

    } catch (error) {
      console.error(`[Registration Batch Service] Step 2 failed for job ${job.id}:`, error);
      await updateStepStatus(job.id, 2, 'failed', {
        error_message: error.message
      });
    }
  }));

  // Update batch to show Step 3 needs action
  await updateBatchStatus(batchId, 'in_progress', { current_step: 3 });
  console.log(`[Registration Batch Service] Step 2 complete for batch ${batchId}, awaiting company selection`);
}

// ============================================================================
// STEP 3: Company Selection (Action Required)
// ============================================================================

/**
 * Complete Step 3 - Process user's company selections
 * Called from API endpoint when user submits selections
 */
async function completeStep3(batchId, selections, orgId) {
  console.log(`[Registration Batch Service] Completing Step 3 for batch ${batchId}`);

  const companiesOfficeBatchService = require('./companies-office-batch-service');

  for (const [jobId, selection] of Object.entries(selections)) {
    try {
      // Save selection
      await companiesOfficeBatchService.selectCompany(
        null, // restaurantId will be looked up
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

    } catch (error) {
      console.error(`[Registration Batch Service] Step 3 selection failed for job ${jobId}:`, error);
      await updateStepStatus(jobId, 3, 'failed', {
        error_message: error.message
      });
    }
  }

  // Check if all jobs completed Step 3
  const allCompleted = await checkAllJobsCompletedStep(batchId, 3);

  if (allCompleted) {
    // Auto-trigger Step 4
    console.log(`[Registration Batch Service] All Step 3 selections complete, starting Step 4`);
    setImmediate(async () => {
      try {
        await processStep4(batchId, orgId);
      } catch (error) {
        console.error(`[Registration Batch Service] Step 4 failed for batch ${batchId}:`, error);
      }
    });
  }

  return {
    updated: Object.keys(selections).length,
    auto_processing: allCompleted
  };
}

// ============================================================================
// STEP 4: Company Details Extraction
// ============================================================================

/**
 * Process Step 4 - Extract full company details
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 */
async function processStep4(batchId, orgId) {
  console.log(`[Registration Batch Service] Processing Step 4 for batch ${batchId}`);

  const { batch_job, registration_jobs } = await getRegistrationBatchJob(batchId, orgId);
  const companiesOfficeBatchService = require('./companies-office-batch-service');

  // Filter to jobs ready for Step 4
  const eligibleJobs = registration_jobs.filter(job => {
    const step3 = job.steps.find(s => s.step_number === 3);
    return step3?.status === 'completed';
  });

  console.log(`[Registration Batch Service] Step 4: Processing ${eligibleJobs.length} restaurants in parallel`);

  // Process ALL restaurants in parallel instead of sequentially
  await Promise.allSettled(eligibleJobs.map(async (job) => {
    try {
      await updateStepStatus(job.id, 4, 'in_progress');
      await updateJobStatus(job.id, 'in_progress', null, 4); // Update job's current_step to 4

      // Get selected company
      const searchRecord = await companiesOfficeBatchService.getSearchRecord(
        job.restaurant?.id,
        job.id
      );

      if (!searchRecord || searchRecord.status === 'no_match') {
        // Skip extraction for no-match restaurants
        await updateStepStatus(job.id, 4, 'skipped', {
          result_data: { reason: 'No company selected' }
        });
        // Still set Step 5 to action_required so user can configure yolo mode
        await updateStepStatus(job.id, 5, 'action_required');
        await updateJobStatus(job.id, 'action_required', null, 5); // Update job's current_step to 5
        return;
      }

      // Extract and save company details
      await companiesOfficeBatchService.extractAndSaveCompanyDetails(
        job.restaurant?.id,
        searchRecord.selected_company_number
      );

      await updateStepStatus(job.id, 4, 'completed', {
        result_data: { company_details_saved: true }
      });

      // Step 4 completed/skipped - set Step 5 to action_required
      await updateStepStatus(job.id, 5, 'action_required');
      await updateJobStatus(job.id, 'action_required', null, 5); // Update job's current_step to 5

    } catch (error) {
      console.error(`[Registration Batch Service] Step 4 failed for job ${job.id}:`, error);
      await updateStepStatus(job.id, 4, 'failed', {
        error_message: error.message
      });
    }
  }));

  // Update batch to Step 5 (action_required - yolo config)
  await updateBatchStatus(batchId, 'in_progress', { current_step: 5 });
  console.log(`[Registration Batch Service] Step 4 complete for batch ${batchId}, awaiting yolo configuration`);
}

// ============================================================================
// STEP 5: Yolo Mode Configuration (Action Required)
// ============================================================================

/**
 * Complete Step 5 - Save yolo mode configurations
 * Called from API endpoint when user submits configurations
 *
 * @param {string} batchId - Batch ID
 * @param {object} configurations - Config keyed by job ID
 * @param {string} orgId - Organization ID
 * @param {string[]} selectedJobIds - Optional array of job IDs to execute (selective execution)
 * @param {object} authContext - Auth context for server-to-server calls { token, organisationId }
 */
async function completeStep5(batchId, configurations, orgId, selectedJobIds = null, authContext = null) {
  console.log(`[Registration Batch Service] Completing Step 5 for batch ${batchId}`);

  const client = getServiceSupabaseClient();

  // Determine which jobs to process
  // If selectedJobIds is provided, only process those jobs
  // Otherwise, process all jobs in configurations (legacy behavior)
  const jobIdsToProcess = selectedJobIds || Object.keys(configurations);

  console.log(`[Registration Batch Service] Processing ${jobIdsToProcess.length} selected jobs`);

  const processedJobs = [];
  const failedJobs = [];

  for (const jobId of jobIdsToProcess) {
    let config = configurations[jobId];
    if (!config) {
      console.warn(`[Registration Batch Service] No config found for job ${jobId}, skipping`);
      continue;
    }

    try {
      // Get current job config if using defaults
      if (config.use_defaults) {
        const { data: job } = await client
          .from('registration_jobs')
          .select('execution_config')
          .eq('id', jobId)
          .single();

        // Merge defaults with any overrides
        config = {
          ...job?.execution_config,
          ...config,
          use_defaults: undefined // Remove flag
        };
      }

      // Save configuration to job
      await client
        .from('registration_jobs')
        .update({ execution_config: config })
        .eq('id', jobId);

      await updateStepStatus(jobId, 5, 'completed', {
        result_data: { config_applied: true }
      });

      processedJobs.push(jobId);

    } catch (error) {
      console.error(`[Registration Batch Service] Step 5 config failed for job ${jobId}:`, error);
      await updateStepStatus(jobId, 5, 'failed', {
        error_message: error.message
      });
      failedJobs.push(jobId);
    }
  }

  // If no jobs were successfully processed, return early
  if (processedJobs.length === 0) {
    return {
      updated: 0,
      auto_processing: false,
      message: 'No jobs were successfully configured'
    };
  }

  // Validate menus for the selected/processed jobs only
  console.log(`[Registration Batch Service] Validating menu extraction for ${processedJobs.length} jobs`);

  const { registration_jobs } = await getRegistrationBatchJob(batchId, orgId);
  const jobsWithoutMenus = [];
  const jobsReadyForExecution = [];

  for (const job of registration_jobs) {
    // Only check jobs that were processed
    if (!processedJobs.includes(job.id)) continue;

    // Check if restaurant has a menu
    const { data: menus } = await client
      .from('menus')
      .select('id')
      .eq('restaurant_id', job.restaurant?.id)
      .limit(1);

    if (!menus || menus.length === 0) {
      jobsWithoutMenus.push({
        jobId: job.id,
        restaurantName: job.restaurant?.name,
        restaurantId: job.restaurant?.id
      });
    } else {
      jobsReadyForExecution.push(job.id);
    }
  }

  // Mark jobs without menus as blocked
  if (jobsWithoutMenus.length > 0) {
    console.warn(`[Registration Batch Service] ${jobsWithoutMenus.length} restaurants missing menus:`,
      jobsWithoutMenus.map(j => j.restaurantName).join(', '));

    for (const { jobId, restaurantName } of jobsWithoutMenus) {
      await updateStepStatus(jobId, 5, 'action_required', {
        result_data: {
          blocked_reason: 'Menu extraction not complete',
          message: `Waiting for menu extraction to complete for ${restaurantName}`
        }
      });
    }
  }

  // Proceed to Step 6 for jobs that are ready
  if (jobsReadyForExecution.length > 0) {
    // Update batch to Step 6 (or keep at 5 if some jobs still pending)
    const allBatchJobsCompleted = await checkAllJobsCompletedStep(batchId, 5);
    if (allBatchJobsCompleted) {
      await updateBatchStatus(batchId, 'in_progress', { current_step: 6 });
    }

    console.log(`[Registration Batch Service] Starting Step 6 for ${jobsReadyForExecution.length} jobs`);

    // Auto-trigger Step 6 for the ready jobs only
    setImmediate(async () => {
      try {
        await processStep6ForSelectedJobs(batchId, orgId, jobsReadyForExecution, authContext);
      } catch (error) {
        console.error(`[Registration Batch Service] Step 6 failed for batch ${batchId}:`, error);
      }
    });
  }

  return {
    updated: processedJobs.length,
    failed: failedJobs.length,
    auto_processing: jobsReadyForExecution.length > 0,
    jobs_started: jobsReadyForExecution.length,
    blocked_jobs: jobsWithoutMenus.length,
    message: jobsWithoutMenus.length > 0
      ? `${jobsReadyForExecution.length} started, ${jobsWithoutMenus.length} waiting for menus`
      : `${jobsReadyForExecution.length} jobs started`
  };
}

// ============================================================================
// STEP 6: Pumpd Account Setup (Yolo Mode Execution)
// ============================================================================

/**
 * Process Step 6 - Execute Yolo Mode for all restaurants
 * Uses phased parallel execution matching current Yolo Mode logic
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 * @param {object} authContext - Auth context for server-to-server calls { token, organisationId }
 */
async function processStep6(batchId, orgId, authContext = null) {
  console.log(`[Registration Batch Service] Processing Step 6 for batch ${batchId}`);

  const { batch_job, registration_jobs } = await getRegistrationBatchJob(batchId, orgId);

  // Filter eligible jobs (Step 5 completed)
  const eligibleJobs = registration_jobs.filter(job => {
    const step5 = job.steps.find(s => s.step_number === 5);
    return step5?.status === 'completed';
  });

  console.log(`[Registration Batch Service] Starting Yolo Mode for ${eligibleJobs.length} restaurants`);

  // In parallel mode, execute all restaurants simultaneously
  await Promise.allSettled(
    eligibleJobs.map(job => executeYoloModeForJob(job, batchId, authContext))
  );

  // Check if batch is complete
  const finalStatus = await calculateBatchFinalStatus(batchId);
  await updateBatchStatus(batchId, finalStatus, {
    completed_at: new Date().toISOString()
  });

  console.log(`[Registration Batch Service] Batch ${batchId} ${finalStatus}`);
}

/**
 * Process Step 6 for selected jobs only (selective execution)
 * @param {string} batchId - Batch ID
 * @param {string} orgId - Organization ID
 * @param {string[]} selectedJobIds - Array of job IDs to execute
 * @param {object} authContext - Auth context for server-to-server calls { token, organisationId }
 */
async function processStep6ForSelectedJobs(batchId, orgId, selectedJobIds, authContext = null) {
  console.log(`[Registration Batch Service] Processing Step 6 for ${selectedJobIds.length} selected jobs in batch ${batchId}`);

  const { batch_job, registration_jobs } = await getRegistrationBatchJob(batchId, orgId);

  // Filter to only the selected jobs that have Step 5 completed
  const eligibleJobs = registration_jobs.filter(job => {
    if (!selectedJobIds.includes(job.id)) return false;
    const step5 = job.steps.find(s => s.step_number === 5);
    return step5?.status === 'completed';
  });

  console.log(`[Registration Batch Service] Starting Yolo Mode for ${eligibleJobs.length} selected restaurants`);

  // Execute all restaurants in parallel - CloudWaitress rate limiting is handled
  // at the sub-step level via the global cloudWaitressRateLimiter queue
  await Promise.allSettled(
    eligibleJobs.map(job => executeYoloModeForJob(job, batchId, authContext))
  );

  // Check batch status after execution
  const { registration_jobs: allJobs } = await getRegistrationBatchJob(batchId, orgId);

  // Count job statuses
  const completedCount = allJobs.filter(j => j.status === 'completed').length;
  const actionRequiredCount = allJobs.filter(j => j.status === 'action_required').length;
  const inProgressCount = allJobs.filter(j => j.status === 'in_progress').length;

  // Determine batch status
  if (completedCount === allJobs.length) {
    // All jobs completed successfully
    await updateBatchStatus(batchId, 'completed', {
      completed_at: new Date().toISOString()
    });
    console.log(`[Registration Batch Service] Batch ${batchId} completed`);
  } else if (actionRequiredCount > 0) {
    // Some jobs need retry - batch stays at action_required
    await updateBatchStatus(batchId, 'action_required', {
      current_step: 5 // Move batch back to Step 5 for retry
    });
    console.log(`[Registration Batch Service] Batch ${batchId} has ${actionRequiredCount} jobs needing retry`);
  } else if (inProgressCount > 0) {
    console.log(`[Registration Batch Service] Batch ${batchId} still has ${inProgressCount} jobs in progress`);
  } else {
    console.log(`[Registration Batch Service] Batch ${batchId} status: ${completedCount} completed, ${actionRequiredCount} action_required`);
  }
}

/**
 * Execute Yolo Mode for a single restaurant using phased parallel execution
 * @param {object} job - Registration job
 * @param {string} batchId - Batch ID
 * @param {object} authContext - Auth context for server-to-server calls { token, organisationId }
 */
async function executeYoloModeForJob(job, batchId, authContext = null) {
  const client = getServiceSupabaseClient();

  await updateStepStatus(job.id, 6, 'in_progress');
  await updateJobStatus(job.id, 'in_progress', null, 6); // Update job's current_step to 6

  const config = job.execution_config || {};
  const phaseProgress = initializePhaseProgress();

  // Shared context for passing data between steps
  const context = {
    codeInjectionId: null, // New: Database storage ID for code injection
    codeInjectionGeneratedAt: null, // New: Generation timestamp
    codeGenerationFilePaths: null, // Legacy: kept for backward compatibility
    onboardingUserCreated: false,
    menuImportSucceeded: false,
    authContext, // Auth context for server-to-server calls
  };

  // Extract config sections for conditional logic
  const account = config.account || {};
  const menu = config.menu || {};
  const onboarding = config.onboarding || {};

  try {
    // ========== PHASE 1: Initial Parallel Operations ==========
    await updatePhaseProgress(job.id, 6, 'phase1', 'in_progress', phaseProgress);

    const phase1Promises = [];

    // 1a. Account Registration (only if registerNewUser is true)
    if (account.registerNewUser !== false) {
      phase1Promises.push(
        executeSubStep('cloudwaitressAccount', job, config, phaseProgress, context)
          .then(result => ({ step: 'cloudwaitressAccount', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'cloudwaitressAccount', 'skipped', { reason: 'Account registration disabled' });
      phase1Promises.push(Promise.resolve({ step: 'cloudwaitressAccount', result: { skipped: true } }));
    }

    // 1b. Code Generation (always run for website config)
    phase1Promises.push(
      executeSubStep('codeGeneration', job, config, phaseProgress, context)
        .then(result => ({ step: 'codeGeneration', result }))
    );

    // 1c. Onboarding User Creation (only if enabled)
    if (onboarding.createOnboardingUser) {
      phase1Promises.push(
        executeSubStep('createOnboardingUser', job, config, phaseProgress, context)
          .then(result => {
            context.onboardingUserCreated = result.success && !result.skipped;
            return { step: 'createOnboardingUser', result };
          })
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'createOnboardingUser', 'skipped', { reason: 'Onboarding user creation disabled' });
      phase1Promises.push(Promise.resolve({ step: 'createOnboardingUser', result: { skipped: true } }));
    }

    // 1d. Image Upload (only if menu selected and uploadImages enabled)
    if (menu.selectedMenuId && menu.uploadImages) {
      phase1Promises.push(
        executeSubStep('uploadImages', job, config, phaseProgress, context)
          .then(result => ({ step: 'uploadImages', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'uploadImages', 'skipped', { reason: 'No menu selected or image upload disabled' });
      phase1Promises.push(Promise.resolve({ step: 'uploadImages', result: { skipped: true } }));
    }

    const phase1Results = await Promise.allSettled(phase1Promises);

    // Check account registration result (BLOCKING)
    const accountResult = phase1Results[0];
    if (accountResult.status === 'rejected') {
      throw new Error(`Account registration failed: ${accountResult.reason?.message || accountResult.reason}`);
    }
    if (accountResult.status === 'fulfilled' && accountResult.value.result?.success === false) {
      throw new Error(`Account registration failed`);
    }

    // Store codeGeneration result for websiteConfig
    const codeGenResult = phase1Results[1];
    if (codeGenResult.status === 'fulfilled' && codeGenResult.value.result?.result) {
      const codeGenData = codeGenResult.value.result.result;
      // New: Capture database ID for persistent storage
      context.codeInjectionId = codeGenData.codeInjectionId || null;
      context.codeInjectionGeneratedAt = codeGenData.generatedAt || null;
      // Legacy: Keep file paths for backward compatibility
      context.codeGenerationFilePaths = codeGenData.filePaths || null;
    }

    await updatePhaseProgress(job.id, 6, 'phase1', 'completed', phaseProgress, context);

    // ========== PHASE 2: Configuration (Parallel after Phase 1) ==========
    await updatePhaseProgress(job.id, 6, 'phase2', 'in_progress', phaseProgress);

    // restaurantRegistration is BLOCKING for remaining config steps
    await executeSubStep('restaurantRegistration', job, config, phaseProgress, context);

    // Run remaining Phase 2 steps in parallel
    const phase2Promises = [];

    // 2a. Website Configuration (only if codeGeneration succeeded - check DB ID or file paths)
    if (context.codeInjectionId || context.codeGenerationFilePaths) {
      phase2Promises.push(
        executeSubStep('websiteConfig', job, config, phaseProgress, context)
          .then(result => ({ step: 'websiteConfig', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'websiteConfig', 'skipped', { reason: 'Code generation failed or no filePaths' });
      phase2Promises.push(Promise.resolve({ step: 'websiteConfig', result: { skipped: true } }));
    }

    // 2b. Services Configuration (always run)
    phase2Promises.push(
      executeSubStep('servicesConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'servicesConfig', result }))
    );

    // 2c. Payment Configuration (always run)
    phase2Promises.push(
      executeSubStep('paymentConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'paymentConfig', result }))
    );

    // 2d. Menu Import (only if menu selected)
    if (menu.selectedMenuId) {
      phase2Promises.push(
        executeSubStep('menuImport', job, config, phaseProgress, context)
          .then(result => {
            context.menuImportSucceeded = result.success && !result.skipped;
            return { step: 'menuImport', result };
          })
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'menuImport', 'skipped', { reason: 'No menu selected' });
      phase2Promises.push(Promise.resolve({ step: 'menuImport', result: { skipped: true } }));
    }

    // 2e. Onboarding Sync (only if onboarding user was created and sync enabled)
    if (onboarding.syncOnboardingRecord && context.onboardingUserCreated) {
      phase2Promises.push(
        executeSubStep('syncOnboardingUser', job, config, phaseProgress, context)
          .then(result => ({ step: 'syncOnboardingUser', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'syncOnboardingUser', 'skipped', { reason: 'Onboarding sync disabled or user not created' });
      phase2Promises.push(Promise.resolve({ step: 'syncOnboardingUser', result: { skipped: true } }));
    }

    const phase2Results = await Promise.allSettled(phase2Promises);

    // Check menu import result for Phase 3 & 4
    const menuImportResult = phase2Results[3];
    if (menuImportResult.status === 'fulfilled' && menuImportResult.value.result?.success) {
      context.menuImportSucceeded = true;
    }

    await updatePhaseProgress(job.id, 6, 'phase2', 'completed', phaseProgress, context);

    // ========== PHASE 3: Menu Setup (After menuImport) ==========
    await updatePhaseProgress(job.id, 6, 'phase3', 'in_progress', phaseProgress);

    if (menu.addOptionSets && context.menuImportSucceeded) {
      await executeSubStep('optionSets', job, config, phaseProgress, context);
    } else {
      const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Option sets disabled';
      updateSubStepInProgress(phaseProgress, 'optionSets', 'skipped', { reason });
    }

    await updatePhaseProgress(job.id, 6, 'phase3', 'completed', phaseProgress, context);

    // ========== PHASE 4: Finalization (After menuImport) ==========
    await updatePhaseProgress(job.id, 6, 'phase4', 'in_progress', phaseProgress);

    if (menu.addItemTags && context.menuImportSucceeded) {
      await executeSubStep('itemTags', job, config, phaseProgress, context);
    } else {
      const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Item tags disabled';
      updateSubStepInProgress(phaseProgress, 'itemTags', 'skipped', { reason });
    }

    await updatePhaseProgress(job.id, 6, 'phase4', 'completed', phaseProgress, context);

    // ========== COMPLETE ==========
    await updateStepStatus(job.id, 6, 'completed', {
      sub_step_progress: phaseProgress
    });

    await updateJobStatus(job.id, 'completed');
    await incrementBatchProgress(batchId, 'completed');

    console.log(`[Registration Batch Service] Yolo Mode completed for job ${job.id}`);

  } catch (error) {
    console.error(`[Registration Batch Service] Yolo Mode failed for job ${job.id}:`, error);

    // Preserve sub_step_progress on Step 6 for resume functionality
    // This allows the Resume button to detect partial progress and continue from last completed phase
    await updateStepStatus(job.id, 6, 'failed', {
      error_message: error.message,
      sub_step_progress: phaseProgress,
      error_details: {
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });

    // Set job status to action_required with current_step at 6 for resume
    await updateJobStatus(job.id, 'action_required', `Step 6 failed: ${error.message}`, 6);

    console.log(`[Registration Batch Service] Job ${job.id} Step 6 failed - can be resumed from last completed phase`);
  }
}

// Maximum retry attempts for each sub-step (matches frontend)
const MAX_SUB_STEP_RETRIES = 3;

/**
 * Execute a single sub-step with progress tracking and retry logic
 * @param {string} subStepName - Name of the sub-step
 * @param {object} job - Registration job
 * @param {object} config - Execution config
 * @param {object} phaseProgress - Phase progress tracking object
 * @param {object} context - Shared context for passing data between steps
 */
async function executeSubStep(subStepName, job, config, phaseProgress, context = {}) {
  const stepsEnabled = config.steps_enabled || {};

  // Skip if disabled in config
  if (stepsEnabled[subStepName] === false) {
    updateSubStepInProgress(phaseProgress, subStepName, 'skipped', { reason: 'Disabled in config' });
    return { skipped: true };
  }

  // For cloudwaitressAccount, route through the rate limiter queue
  // This ensures only one account creation happens at a time across all jobs/batches
  if (subStepName === 'cloudwaitressAccount' && CLOUDWAITRESS_RATE_LIMIT_MS > 0) {
    const restaurantName = job.restaurant?.name || job.restaurant_id;
    return cloudWaitressRateLimiter.enqueue(
      () => executeSubStepInternal(subStepName, job, config, phaseProgress, context),
      restaurantName
    );
  }

  // All other sub-steps execute directly
  return executeSubStepInternal(subStepName, job, config, phaseProgress, context);
}

/**
 * Internal execution of a sub-step with retry logic
 * Separated to allow cloudwaitressAccount to be queued while keeping retry logic intact
 */
async function executeSubStepInternal(subStepName, job, config, phaseProgress, context = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_SUB_STEP_RETRIES; attempt++) {
    try {
      if (attempt === 1) {
        updateSubStepInProgress(phaseProgress, subStepName, 'in_progress', {
          started_at: Date.now(),
          attempt: 1
        });
      } else {
        updateSubStepInProgress(phaseProgress, subStepName, 'retrying', {
          attempt,
          previous_error: lastError?.message
        });
        console.log(`[Registration Batch Service] Retrying ${subStepName} (attempt ${attempt}/${MAX_SUB_STEP_RETRIES})`);
      }

      const result = await executeYoloModeSubStep(subStepName, job, config, context);
      updateSubStepInProgress(phaseProgress, subStepName, 'completed', {
        completed_at: Date.now(),
        attempts: attempt
      });
      return result;

    } catch (error) {
      lastError = error;
      console.error(`[Registration Batch Service] ${subStepName} failed (attempt ${attempt}/${MAX_SUB_STEP_RETRIES}):`, error.message);

      if (attempt < MAX_SUB_STEP_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, attempt - 1);
        console.log(`[Registration Batch Service] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  updateSubStepInProgress(phaseProgress, subStepName, 'failed', {
    error: lastError?.message || 'Unknown error',
    attempts: MAX_SUB_STEP_RETRIES
  });
  throw lastError;
}

/**
 * Execute a single Yolo Mode sub-step by calling the appropriate API endpoint
 *
 * @param {string} subStepName - Name of the sub-step to execute
 * @param {object} job - Registration job with restaurant data
 * @param {object} config - Execution config (YoloModeFormData structure)
 * @param {object} context - Shared context for passing data between steps (e.g., codeGeneration results)
 * @returns {Promise<object>} Result from the API call
 */
async function executeYoloModeSubStep(subStepName, job, config, context = {}) {
  const restaurantId = job.restaurant_id;

  console.log(`[Registration Batch Service] Executing sub-step: ${subStepName} for job ${job.id} (restaurant: ${restaurantId})`);

  // Map sub-step to endpoint and build payload
  const { endpoint, payload, useLocalApi } = buildSubStepRequest(subStepName, restaurantId, config, context);

  if (!endpoint) {
    console.log(`[Registration Batch Service] Sub-step ${subStepName} has no endpoint defined, skipping`);
    return { success: true, skipped: true, subStep: subStepName };
  }

  try {
    const baseUrl = useLocalApi ? API_BASE_URL : API_BASE_URL;
    const url = `${baseUrl}${endpoint}`;

    console.log(`[Registration Batch Service] Calling ${url}`);

    // Build headers for internal service-to-service call
    // Use service key instead of user JWT to avoid token expiration during long operations
    const serviceKey = process.env.INTERNAL_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = {
      'Content-Type': 'application/json',
      'X-Service-Key': serviceKey,
    };

    if (context.authContext?.organisationId) {
      headers['X-Organisation-ID'] = context.authContext.organisationId;
      console.log(`[Registration Batch Service] Using service key auth for org: ${context.authContext.organisationId}`);
    } else {
      console.warn(`[Registration Batch Service] No organisation ID available for ${subStepName}`);
    }

    const response = await axios.post(url, payload, {
      timeout: 3600000, // 60 minutes timeout for Playwright scripts (option sets can take very long for large menus)
      headers,
    });

    console.log(`[Registration Batch Service] Sub-step ${subStepName} completed successfully`);
    return { success: true, subStep: subStepName, result: response.data };

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error(`[Registration Batch Service] Sub-step ${subStepName} failed:`, errorMessage);
    throw new Error(`${subStepName} failed: ${errorMessage}`);
  }
}

/**
 * Build the API request for a given sub-step
 * Maps sub-step names to endpoints and constructs appropriate payloads
 */
function buildSubStepRequest(subStepName, restaurantId, config, context) {
  // Extract config sections with defaults
  const account = config.account || {};
  const restaurant = config.restaurant || {};
  const menu = config.menu || {};
  const website = config.website || {};
  const payment = config.payment || {};
  const onboarding = config.onboarding || {};

  const stepMappings = {
    // ===== PHASE 1 =====
    cloudwaitressAccount: {
      endpoint: '/api/registration/register-account',
      payload: {
        restaurantId,
        email: account.email,
        password: account.password,
        phone: account.phone,
      },
      useLocalApi: true, // Uses local api (not railwayApi)
    },

    codeGeneration: {
      endpoint: '/api/registration/generate-code-injections',
      payload: {
        restaurantId,
        noGradient: website.disableGradients || false,
      },
    },

    createOnboardingUser: {
      endpoint: '/api/registration/create-onboarding-user',
      payload: {
        restaurantId,
        userName: onboarding.userName,
        userEmail: onboarding.userEmail,
        userPassword: onboarding.userPassword || undefined,
      },
    },

    uploadImages: {
      endpoint: menu.selectedMenuId ? `/api/menus/${menu.selectedMenuId}/upload-images` : null,
      payload: {},
      useLocalApi: true,
    },

    // ===== PHASE 2 =====
    restaurantRegistration: {
      endpoint: '/api/registration/register-restaurant',
      payload: {
        restaurantId,
        registrationType: restaurant.registrationMode,
        email: account.email,
        password: account.password,
        restaurantName: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        hours: restaurant.opening_hours,
        city: restaurant.city,
      },
    },

    websiteConfig: {
      endpoint: '/api/registration/configure-website',
      payload: {
        restaurantId,
        codeInjectionId: context.codeInjectionId || null, // New: Database storage ID
        filePaths: context.codeGenerationFilePaths || null, // Legacy: kept for backward compatibility
        headerConfig: {
          enabled: website.configureHeader || false,
          backgroundSource: website.headerImageSource,
        },
        itemsConfig: {
          layout: website.itemLayout || 'list',
        },
        textColorConfig: {
          navText: website.navTextColor || 'auto',
          boxText: website.cardTextColor || 'auto',
        },
        navLogoTintConfig: {
          darkColor: website.navLogoDarkTint !== 'none' ? website.navLogoDarkTint : null,
          lightColor: website.navLogoLightTint !== 'none' ? website.navLogoLightTint : null,
        },
        headerLogoTintConfig: {
          darkColor: website.headerLogoDarkTint !== 'none' ? website.headerLogoDarkTint : null,
          lightColor: website.headerLogoLightTint !== 'none' ? website.headerLogoLightTint : null,
        },
      },
    },

    servicesConfig: {
      endpoint: '/api/registration/configure-services',
      payload: {
        restaurantId,
      },
    },

    paymentConfig: {
      endpoint: '/api/registration/configure-payment',
      payload: {
        restaurantId,
        includeConnectLink: payment.includeStripeLink || false,
      },
    },

    menuImport: {
      endpoint: menu.selectedMenuId ? '/api/registration/import-menu-direct' : null,
      payload: {
        restaurantId,
        menuId: menu.selectedMenuId,
      },
    },

    syncOnboardingUser: {
      endpoint: '/api/registration/update-onboarding-record',
      payload: {
        restaurantId,
        userEmail: onboarding.userEmail,
        contactPerson: onboarding.userName,
      },
      useLocalApi: true,
    },

    // ===== PHASE 3 =====
    optionSets: {
      endpoint: menu.selectedMenuId ? '/api/registration/add-option-sets' : null,
      payload: {
        restaurantId,
        menuId: menu.selectedMenuId,
      },
    },

    // ===== PHASE 4 =====
    itemTags: {
      endpoint: menu.selectedMenuId ? '/api/registration/add-item-tags' : null,
      payload: {
        restaurantId,
        menuId: menu.selectedMenuId,
      },
    },
  };

  const mapping = stepMappings[subStepName];
  if (!mapping) {
    console.warn(`[Registration Batch Service] Unknown sub-step: ${subStepName}`);
    return { endpoint: null, payload: {}, useLocalApi: false };
  }

  return mapping;
}

/**
 * Initialize phase progress structure
 */
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
 * Update phase status in progress object
 * Includes retry logic for transient database errors
 * @param {string} jobId - Job ID
 * @param {number} stepNumber - Step number (6 for YOLO mode)
 * @param {string} phaseName - Phase name (phase1-phase4)
 * @param {string} status - Phase status (in_progress, completed)
 * @param {object} phaseProgress - Phase progress object to update
 * @param {object|null} context - Optional context to persist for resume capability
 */
async function updatePhaseProgress(jobId, stepNumber, phaseName, status, phaseProgress, context = null) {
  phaseProgress.current_phase = phaseName;
  phaseProgress.phases[phaseName].status = status;

  // Store context variables for resume capability when phase completes
  if (context && status === 'completed') {
    phaseProgress.context = {
      // NEW: Database-persisted code injection (primary)
      codeInjectionId: context.codeInjectionId || null,
      codeInjectionGeneratedAt: context.codeInjectionGeneratedAt || null,
      // LEGACY: File paths (fallback during migration)
      codeGenerationFilePaths: context.codeGenerationFilePaths || null,
      // Other context variables
      onboardingUserCreated: context.onboardingUserCreated || false,
      menuImportSucceeded: context.menuImportSucceeded || false
    };
  }

  // Update in database with retry logic
  const client = getServiceSupabaseClient();

  await executeWithRetry(
    () => client
      .from('registration_job_steps')
      .update({
        sub_step_progress: phaseProgress,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('step_number', stepNumber),
    `updatePhaseProgress(job=${jobId}, phase=${phaseName}, status=${status})`
  );
}

/**
 * Update sub-step status in progress object
 */
function updateSubStepInProgress(phaseProgress, subStepName, status, data = {}) {
  // Find which phase contains this sub-step
  for (const [phaseName, phase] of Object.entries(phaseProgress.phases)) {
    if (phase.sub_steps && phase.sub_steps[subStepName]) {
      phase.sub_steps[subStepName] = {
        ...phase.sub_steps[subStepName],
        status,
        ...data
      };
      break;
    }
  }
}

// ============================================================================
// STEP 6 RESUME FUNCTIONALITY
// ============================================================================

/**
 * Detect the last fully completed phase from sub_step_progress
 * @param {object} phaseProgress - The sub_step_progress object
 * @returns {string|null} Last completed phase name or null if none completed
 */
function detectLastCompletePhase(phaseProgress) {
  if (!phaseProgress?.phases) return null;

  // Check phases in reverse order (phase4 → phase1)
  for (const phase of ['phase4', 'phase3', 'phase2', 'phase1']) {
    if (phaseProgress.phases[phase]?.status === 'completed') {
      return phase;
    }
  }
  return null;
}

/**
 * Reconstruct context from completed sub-steps in phaseProgress
 * This allows resuming Step 6 with the necessary context data
 *
 * Priority:
 * 1. Use explicitly stored context from phaseProgress.context (Phase D persistence)
 * 2. Fall back to inference from sub-step statuses (legacy behavior)
 *
 * @param {object} phaseProgress - The sub_step_progress object
 * @returns {object} Reconstructed context
 */
function reconstructContext(phaseProgress) {
  // If context was explicitly stored (Phase D), use it directly
  if (phaseProgress?.context) {
    console.log('[reconstructContext] Using stored context from phaseProgress.context');
    return {
      codeInjectionId: phaseProgress.context.codeInjectionId || null,
      codeInjectionGeneratedAt: phaseProgress.context.codeInjectionGeneratedAt || null,
      codeGenerationFilePaths: phaseProgress.context.codeGenerationFilePaths || null,
      onboardingUserCreated: phaseProgress.context.onboardingUserCreated || false,
      menuImportSucceeded: phaseProgress.context.menuImportSucceeded || false,
      authContext: null
    };
  }

  // Fallback: Infer context from sub-step statuses (legacy behavior)
  console.log('[reconstructContext] Inferring context from sub-step statuses (no stored context)');

  const context = {
    codeInjectionId: null, // New: Database storage ID
    codeInjectionGeneratedAt: null, // New: Generation timestamp
    codeGenerationFilePaths: null, // Legacy: kept for backward compatibility
    onboardingUserCreated: false,
    menuImportSucceeded: false,
    authContext: null
  };

  if (!phaseProgress?.phases) return context;

  const phase1 = phaseProgress.phases.phase1?.sub_steps || {};
  const phase2 = phaseProgress.phases.phase2?.sub_steps || {};

  // Check if codeGeneration completed - look for codeInjectionId or filePaths in the sub-step data
  if (phase1.codeGeneration?.status === 'completed') {
    const codeGenData = phase1.codeGeneration || {};
    // New: Capture database ID if available
    context.codeInjectionId = codeGenData.codeInjectionId || null;
    context.codeInjectionGeneratedAt = codeGenData.generatedAt || null;
    // Legacy: If filePaths were stored, use them; otherwise mark as true to indicate it ran
    context.codeGenerationFilePaths = codeGenData.filePaths || true;
  }

  // Check if onboarding user was created
  if (phase1.createOnboardingUser?.status === 'completed') {
    context.onboardingUserCreated = true;
  }

  // Check if menu import succeeded
  if (phase2.menuImport?.status === 'completed') {
    context.menuImportSucceeded = true;
  }

  return context;
}

/**
 * Resume Step 6 execution from last completed phase
 * @param {object} job - Registration job with steps and execution_config
 * @param {string} batchId - Batch ID
 * @param {object} authContext - Auth context for API calls
 */
async function resumeYoloModeForJob(job, batchId, authContext = null) {
  // Get Step 6 record with existing progress
  const step6 = job.steps?.find(s => s.step_number === 6);
  const existingProgress = step6?.sub_step_progress;

  if (!existingProgress) {
    // No existing progress - start from scratch
    console.log(`[Registration Batch Service] No existing progress for job ${job.id}, starting fresh`);
    return executeYoloModeForJob(job, batchId, authContext);
  }

  const config = job.execution_config || {};
  const phaseProgress = existingProgress; // Use existing progress

  // Reconstruct context from completed steps
  const context = reconstructContext(phaseProgress);
  context.authContext = authContext;

  // Detect resume point
  const lastCompletePhase = detectLastCompletePhase(phaseProgress);

  console.log(`[Registration Batch Service] Resuming job ${job.id} from ${lastCompletePhase || 'beginning'}`);

  await updateStepStatus(job.id, 6, 'in_progress');
  await updateJobStatus(job.id, 'in_progress', null, 6);

  // Extract config sections for conditional logic
  const menu = config.menu || {};

  try {
    // Resume from appropriate phase
    switch (lastCompletePhase) {
      case 'phase1':
        // Phase 1 complete, resume from Phase 2
        await executePhase2Resume(job, config, phaseProgress, context);
        await executePhase3Resume(job, config, phaseProgress, context, menu);
        await executePhase4Resume(job, config, phaseProgress, context, menu);
        break;

      case 'phase2':
        // Phase 2 complete, resume from Phase 3
        await executePhase3Resume(job, config, phaseProgress, context, menu);
        await executePhase4Resume(job, config, phaseProgress, context, menu);
        break;

      case 'phase3':
        // Phase 3 complete, resume from Phase 4
        await executePhase4Resume(job, config, phaseProgress, context, menu);
        break;

      case 'phase4':
        // All phases complete - just mark as done
        console.log(`[Registration Batch Service] Job ${job.id} already fully completed`);
        break;

      default:
        // No completed phases - resume from Phase 1 (may have partial progress)
        console.log(`[Registration Batch Service] No completed phases, resuming from Phase 1`);
        await executePhase1Resume(job, config, phaseProgress, context);
        await executePhase2Resume(job, config, phaseProgress, context);
        await executePhase3Resume(job, config, phaseProgress, context, menu);
        await executePhase4Resume(job, config, phaseProgress, context, menu);
    }

    // Mark complete
    await updateStepStatus(job.id, 6, 'completed', {
      sub_step_progress: phaseProgress
    });

    await updateJobStatus(job.id, 'completed');
    await incrementBatchProgress(batchId, 'completed');

    console.log(`[Registration Batch Service] Resume completed for job ${job.id}`);

  } catch (error) {
    console.error(`[Registration Batch Service] Resume failed for job ${job.id}:`, error);

    // Store partial progress for future resume attempts
    await updateStepStatus(job.id, 6, 'failed', {
      sub_step_progress: phaseProgress,
      error_message: error.message,
      error_details: {
        timestamp: new Date().toISOString(),
        error: error.message,
        resumed_from: lastCompletePhase
      }
    });

    await updateJobStatus(job.id, 'action_required', `Resume failed: ${error.message}`, 6);

    throw error;
  }
}

/**
 * Helper to check if a sub-step should be skipped during resume
 * @param {object} phaseProgress - The sub_step_progress object
 * @param {string} subStepKey - Sub-step key name
 * @returns {boolean} True if sub-step is already completed or skipped
 */
function shouldSkipSubStepOnResume(phaseProgress, subStepKey) {
  const status = getSubStepStatus(phaseProgress, subStepKey);
  return status === 'completed' || status === 'skipped';
}

/**
 * Execute Phase 1 for resume (when Phase 1 partially failed)
 * Only retries failed/pending sub-steps, skips already completed ones
 */
async function executePhase1Resume(job, config, phaseProgress, context) {
  const account = config.account || {};
  const menu = config.menu || {};
  const onboarding = config.onboarding || {};

  await updatePhaseProgress(job.id, 6, 'phase1', 'in_progress', phaseProgress);

  const phase1Promises = [];

  // 1a. Account Registration (only if registerNewUser is true and not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'cloudwaitressAccount')) {
    console.log('[Resume] cloudwaitressAccount already completed, skipping');
    phase1Promises.push(Promise.resolve({ step: 'cloudwaitressAccount', result: { skipped: true, reason: 'already completed' } }));
  } else if (account.registerNewUser !== false) {
    phase1Promises.push(
      executeSubStep('cloudwaitressAccount', job, config, phaseProgress, context)
        .then(result => ({ step: 'cloudwaitressAccount', result }))
    );
  } else {
    updateSubStepInProgress(phaseProgress, 'cloudwaitressAccount', 'skipped', { reason: 'Account registration disabled' });
    phase1Promises.push(Promise.resolve({ step: 'cloudwaitressAccount', result: { skipped: true } }));
  }

  // 1b. Code Generation (only if not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'codeGeneration')) {
    console.log('[Resume] codeGeneration already completed, skipping');
    // Reconstruct context from existing data if available
    const codeGenData = phaseProgress.phases?.phase1?.sub_steps?.codeGeneration || {};
    context.codeInjectionId = codeGenData.codeInjectionId || context.codeInjectionId;
    context.codeInjectionGeneratedAt = codeGenData.generatedAt || context.codeInjectionGeneratedAt;
    context.codeGenerationFilePaths = codeGenData.filePaths || context.codeGenerationFilePaths || true;
    phase1Promises.push(Promise.resolve({ step: 'codeGeneration', result: { skipped: true, reason: 'already completed' } }));
  } else {
    phase1Promises.push(
      executeSubStep('codeGeneration', job, config, phaseProgress, context)
        .then(result => ({ step: 'codeGeneration', result }))
    );
  }

  // 1c. Onboarding User Creation (only if enabled and not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'createOnboardingUser')) {
    console.log('[Resume] createOnboardingUser already completed, skipping');
    context.onboardingUserCreated = getSubStepStatus(phaseProgress, 'createOnboardingUser') === 'completed';
    phase1Promises.push(Promise.resolve({ step: 'createOnboardingUser', result: { skipped: true, reason: 'already completed' } }));
  } else if (onboarding.createOnboardingUser) {
    phase1Promises.push(
      executeSubStep('createOnboardingUser', job, config, phaseProgress, context)
        .then(result => {
          context.onboardingUserCreated = result.success && !result.skipped;
          return { step: 'createOnboardingUser', result };
        })
    );
  } else {
    updateSubStepInProgress(phaseProgress, 'createOnboardingUser', 'skipped', { reason: 'Onboarding user creation disabled' });
    phase1Promises.push(Promise.resolve({ step: 'createOnboardingUser', result: { skipped: true } }));
  }

  // 1d. Image Upload (only if menu selected and uploadImages enabled and not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'uploadImages')) {
    console.log('[Resume] uploadImages already completed, skipping');
    phase1Promises.push(Promise.resolve({ step: 'uploadImages', result: { skipped: true, reason: 'already completed' } }));
  } else if (menu.selectedMenuId && menu.uploadImages) {
    phase1Promises.push(
      executeSubStep('uploadImages', job, config, phaseProgress, context)
        .then(result => ({ step: 'uploadImages', result }))
    );
  } else {
    updateSubStepInProgress(phaseProgress, 'uploadImages', 'skipped', { reason: 'No menu selected or image upload disabled' });
    phase1Promises.push(Promise.resolve({ step: 'uploadImages', result: { skipped: true } }));
  }

  const phase1Results = await Promise.allSettled(phase1Promises);

  // Check account registration result (BLOCKING) - only if it was actually run
  const accountResult = phase1Results[0];
  if (accountResult.status === 'rejected') {
    throw new Error(`Account registration failed: ${accountResult.reason?.message || accountResult.reason}`);
  }
  if (accountResult.status === 'fulfilled' &&
      accountResult.value.result?.success === false &&
      accountResult.value.result?.reason !== 'already completed') {
    throw new Error(`Account registration failed`);
  }

  // Store codeGeneration result for websiteConfig (only if it was actually run)
  const codeGenResult = phase1Results[1];
  if (codeGenResult.status === 'fulfilled' &&
      codeGenResult.value.result?.result &&
      codeGenResult.value.result?.reason !== 'already completed') {
    const codeGenData = codeGenResult.value.result.result;
    context.codeInjectionId = codeGenData.codeInjectionId || null;
    context.codeInjectionGeneratedAt = codeGenData.generatedAt || null;
    context.codeGenerationFilePaths = codeGenData.filePaths || null;
  }

  await updatePhaseProgress(job.id, 6, 'phase1', 'completed', phaseProgress, context);
}

/**
 * Execute Phase 2 for resume (after Phase 1 already completed)
 * Only retries failed/pending sub-steps, skips already completed ones
 */
async function executePhase2Resume(job, config, phaseProgress, context) {
  const menu = config.menu || {};
  const onboarding = config.onboarding || {};

  await updatePhaseProgress(job.id, 6, 'phase2', 'in_progress', phaseProgress);

  // restaurantRegistration is BLOCKING for remaining config steps - only run if not completed
  if (shouldSkipSubStepOnResume(phaseProgress, 'restaurantRegistration')) {
    console.log('[Resume] restaurantRegistration already completed, skipping');
  } else {
    await executeSubStep('restaurantRegistration', job, config, phaseProgress, context);
  }

  // Run remaining Phase 2 steps in parallel (only those not already completed)
  const phase2Promises = [];

  // 2a. Website Configuration (only if codeGeneration succeeded and not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'websiteConfig')) {
    console.log('[Resume] websiteConfig already completed, skipping');
    phase2Promises.push(Promise.resolve({ step: 'websiteConfig', result: { skipped: true, reason: 'already completed' } }));
  } else if (context.codeInjectionId || context.codeGenerationFilePaths) {
    phase2Promises.push(
      executeSubStep('websiteConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'websiteConfig', result }))
    );
  } else {
    updateSubStepInProgress(phaseProgress, 'websiteConfig', 'skipped', { reason: 'Code generation failed - no content available' });
    phase2Promises.push(Promise.resolve({ step: 'websiteConfig', result: { skipped: true } }));
  }

  // 2b. Services Configuration (only if not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'servicesConfig')) {
    console.log('[Resume] servicesConfig already completed, skipping');
    phase2Promises.push(Promise.resolve({ step: 'servicesConfig', result: { skipped: true, reason: 'already completed' } }));
  } else {
    phase2Promises.push(
      executeSubStep('servicesConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'servicesConfig', result }))
    );
  }

  // 2c. Payment Configuration (only if not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'paymentConfig')) {
    console.log('[Resume] paymentConfig already completed, skipping');
    phase2Promises.push(Promise.resolve({ step: 'paymentConfig', result: { skipped: true, reason: 'already completed' } }));
  } else {
    phase2Promises.push(
      executeSubStep('paymentConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'paymentConfig', result }))
    );
  }

  // 2d. Menu Import (only if menu selected and not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'menuImport')) {
    console.log('[Resume] menuImport already completed, skipping');
    // If already completed, mark context as succeeded
    context.menuImportSucceeded = getSubStepStatus(phaseProgress, 'menuImport') === 'completed';
    phase2Promises.push(Promise.resolve({ step: 'menuImport', result: { skipped: true, reason: 'already completed', success: context.menuImportSucceeded } }));
  } else if (menu.selectedMenuId) {
    phase2Promises.push(
      executeSubStep('menuImport', job, config, phaseProgress, context)
        .then(result => {
          context.menuImportSucceeded = result.success && !result.skipped;
          return { step: 'menuImport', result };
        })
    );
  } else {
    updateSubStepInProgress(phaseProgress, 'menuImport', 'skipped', { reason: 'No menu selected' });
    phase2Promises.push(Promise.resolve({ step: 'menuImport', result: { skipped: true } }));
  }

  // 2e. Onboarding Sync (only if not already completed)
  if (shouldSkipSubStepOnResume(phaseProgress, 'syncOnboardingUser')) {
    console.log('[Resume] syncOnboardingUser already completed, skipping');
    phase2Promises.push(Promise.resolve({ step: 'syncOnboardingUser', result: { skipped: true, reason: 'already completed' } }));
  } else if (onboarding.syncOnboardingRecord && context.onboardingUserCreated) {
    phase2Promises.push(
      executeSubStep('syncOnboardingUser', job, config, phaseProgress, context)
        .then(result => ({ step: 'syncOnboardingUser', result }))
    );
  } else {
    updateSubStepInProgress(phaseProgress, 'syncOnboardingUser', 'skipped', { reason: 'Onboarding sync disabled or user not created' });
    phase2Promises.push(Promise.resolve({ step: 'syncOnboardingUser', result: { skipped: true } }));
  }

  const phase2Results = await Promise.allSettled(phase2Promises);

  // Check menu import result for Phase 3 & 4 (only if it was actually run)
  const menuImportResult = phase2Results[3];
  if (menuImportResult?.status === 'fulfilled' && menuImportResult.value?.result?.success) {
    context.menuImportSucceeded = true;
  }

  await updatePhaseProgress(job.id, 6, 'phase2', 'completed', phaseProgress, context);
}

/**
 * Execute Phase 3 for resume (optionSets)
 * Only retries if optionSets is not already completed
 */
async function executePhase3Resume(job, config, phaseProgress, context, menu) {
  await updatePhaseProgress(job.id, 6, 'phase3', 'in_progress', phaseProgress);

  // Check if optionSets already completed - skip if so
  if (shouldSkipSubStepOnResume(phaseProgress, 'optionSets')) {
    console.log('[Resume] optionSets already completed, skipping');
  } else if (menu.addOptionSets && context.menuImportSucceeded) {
    await executeSubStep('optionSets', job, config, phaseProgress, context);
  } else {
    const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Option sets disabled';
    updateSubStepInProgress(phaseProgress, 'optionSets', 'skipped', { reason });
  }

  await updatePhaseProgress(job.id, 6, 'phase3', 'completed', phaseProgress, context);
}

/**
 * Execute Phase 4 for resume (itemTags)
 * Only retries if itemTags is not already completed
 */
async function executePhase4Resume(job, config, phaseProgress, context, menu) {
  await updatePhaseProgress(job.id, 6, 'phase4', 'in_progress', phaseProgress);

  // Check if itemTags already completed - skip if so
  if (shouldSkipSubStepOnResume(phaseProgress, 'itemTags')) {
    console.log('[Resume] itemTags already completed, skipping');
  } else if (menu.addItemTags && context.menuImportSucceeded) {
    await executeSubStep('itemTags', job, config, phaseProgress, context);
  } else {
    const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Item tags disabled';
    updateSubStepInProgress(phaseProgress, 'itemTags', 'skipped', { reason });
  }

  await updatePhaseProgress(job.id, 6, 'phase4', 'completed', phaseProgress, context);
}

// ============================================================================
// STEP 6 SUB-STEP MANUAL EDITING
// ============================================================================

/**
 * Sub-step dependency map
 * Each key lists the sub-steps that must be completed before it can be marked complete
 */
const SUB_STEP_DEPENDENCIES = {
  cloudwaitressAccount: [],
  codeGeneration: [],
  createOnboardingUser: [],
  uploadImages: [],
  restaurantRegistration: ['cloudwaitressAccount'],
  websiteConfig: ['codeGeneration', 'restaurantRegistration'],
  servicesConfig: ['restaurantRegistration'],
  paymentConfig: ['restaurantRegistration'],
  menuImport: ['restaurantRegistration'],
  syncOnboardingUser: ['createOnboardingUser', 'restaurantRegistration'],
  optionSets: ['menuImport'],
  itemTags: ['menuImport']
};

/**
 * Sub-step to phase mapping
 */
const SUB_STEP_PHASES = {
  cloudwaitressAccount: 'phase1',
  codeGeneration: 'phase1',
  createOnboardingUser: 'phase1',
  uploadImages: 'phase1',
  restaurantRegistration: 'phase2',
  websiteConfig: 'phase2',
  servicesConfig: 'phase2',
  paymentConfig: 'phase2',
  menuImport: 'phase2',
  syncOnboardingUser: 'phase2',
  optionSets: 'phase3',
  itemTags: 'phase4'
};

/**
 * Get sub-step status from phaseProgress
 * @param {object} phaseProgress - The sub_step_progress object
 * @param {string} subStepKey - Sub-step key name
 * @returns {string|null} Status or null if not found
 */
function getSubStepStatus(phaseProgress, subStepKey) {
  if (!phaseProgress?.phases) return null;

  for (const phase of Object.values(phaseProgress.phases)) {
    if (phase.sub_steps && phase.sub_steps[subStepKey]) {
      return phase.sub_steps[subStepKey].status;
    }
  }
  return null;
}

/**
 * Validate if a sub-step can be transitioned to a new status
 * @param {object} phaseProgress - The sub_step_progress object
 * @param {string} subStepKey - Sub-step key name
 * @param {string} newStatus - Target status
 * @returns {object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateSubStepTransition(phaseProgress, subStepKey, newStatus) {
  const warnings = [];
  const errors = [];

  // Check if sub-step exists
  const currentStatus = getSubStepStatus(phaseProgress, subStepKey);
  if (currentStatus === null) {
    errors.push(`Sub-step '${subStepKey}' not found`);
    return { valid: false, errors, warnings };
  }

  // Validate transition to 'completed'
  if (newStatus === 'completed') {
    const deps = SUB_STEP_DEPENDENCIES[subStepKey] || [];
    for (const dep of deps) {
      const depStatus = getSubStepStatus(phaseProgress, dep);
      if (!['completed', 'skipped'].includes(depStatus)) {
        errors.push(`Cannot mark '${subStepKey}' as completed: dependency '${dep}' is '${depStatus}'`);
      }
    }
  }

  // Validate transition from 'failed' to 'completed' (must reset first)
  if (currentStatus === 'failed' && newStatus === 'completed') {
    warnings.push(`Sub-step was previously failed. Consider resetting to pending first.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Get dependent sub-steps that should be affected when a sub-step changes
 * @param {string} subStepKey - The sub-step being changed
 * @returns {string[]} List of dependent sub-step keys
 */
function getDependentSubSteps(subStepKey) {
  const dependents = [];
  for (const [key, deps] of Object.entries(SUB_STEP_DEPENDENCIES)) {
    if (deps.includes(subStepKey)) {
      dependents.push(key);
    }
  }
  return dependents;
}

/**
 * Calculate phase status based on sub-step statuses
 * @param {object} phaseProgress - The sub_step_progress object
 * @param {string} phaseName - Phase name to calculate
 * @returns {string} Calculated phase status
 */
function calculatePhaseStatus(phaseProgress, phaseName) {
  const phase = phaseProgress.phases[phaseName];
  if (!phase?.sub_steps) return 'pending';

  const statuses = Object.values(phase.sub_steps).map(s => s.status);

  // If any sub-step is in_progress or retrying, phase is in_progress
  if (statuses.some(s => s === 'in_progress' || s === 'retrying')) {
    return 'in_progress';
  }

  // If all sub-steps are completed or skipped, phase is completed
  if (statuses.every(s => s === 'completed' || s === 'skipped')) {
    return 'completed';
  }

  // If any sub-step failed (and none in_progress), phase is failed
  if (statuses.some(s => s === 'failed')) {
    return 'failed';
  }

  // If all sub-steps are pending, phase is pending
  if (statuses.every(s => s === 'pending')) {
    return 'pending';
  }

  // Mixed state (some completed, some pending, none failed) = in_progress
  return 'in_progress';
}

/**
 * Update current_phase based on phase statuses
 * Sets current_phase to the first non-completed phase
 * @param {object} phaseProgress - The sub_step_progress object
 */
function updateCurrentPhase(phaseProgress) {
  const phaseOrder = ['phase1', 'phase2', 'phase3', 'phase4'];

  for (const phaseName of phaseOrder) {
    const status = phaseProgress.phases[phaseName]?.status;
    if (status !== 'completed' && status !== 'skipped') {
      phaseProgress.current_phase = phaseName;
      return;
    }
  }

  // All phases completed
  phaseProgress.current_phase = 'completed';
}

/**
 * Get allowed status transitions for a sub-step
 * @param {string} currentStatus - Current sub-step status
 * @param {string[]} deps - Dependency keys
 * @param {object} phaseProgress - The sub_step_progress object
 * @returns {string[]} List of allowed target statuses
 */
function getAllowedTransitions(currentStatus, deps, phaseProgress) {
  const transitions = [];

  // Can always mark as failed
  if (currentStatus !== 'failed') transitions.push('failed');

  // Can always mark as pending
  if (currentStatus !== 'pending') transitions.push('pending');

  // Can mark as completed only if all deps are completed/skipped
  const depsOk = deps.every(dep => {
    const status = getSubStepStatus(phaseProgress, dep);
    return status === 'completed' || status === 'skipped';
  });
  if (depsOk && currentStatus !== 'completed') transitions.push('completed');

  // Can mark as skipped if deps are ok
  if (depsOk && currentStatus !== 'skipped') transitions.push('skipped');

  return transitions;
}

/**
 * Update a single sub-step status with validation
 * @param {string} jobId - Job ID
 * @param {string} subStepKey - Sub-step key name
 * @param {string} newStatus - Target status ('completed', 'failed', 'skipped', 'pending')
 * @param {object} data - Additional data to store
 * @param {string} orgId - Organization ID for auth
 * @returns {Promise<object>} Updated sub_step_progress and validation info
 */
async function updateSubStepStatus(jobId, subStepKey, newStatus, data = {}, orgId) {
  const client = getServiceSupabaseClient();

  // Get job with Step 6 data
  const { data: job, error: jobError } = await client
    .from('registration_jobs')
    .select(`
      id,
      organisation_id,
      steps:registration_job_steps(*)
    `)
    .eq('id', jobId)
    .eq('organisation_id', orgId)
    .single();

  if (jobError || !job) {
    throw new Error('Job not found');
  }

  const step6 = job.steps?.find(s => s.step_number === 6);
  if (!step6?.sub_step_progress) {
    throw new Error('No Step 6 progress exists for this job');
  }

  const phaseProgress = step6.sub_step_progress;

  // Validate the transition
  const validation = validateSubStepTransition(phaseProgress, subStepKey, newStatus);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  // Update the sub-step in the phaseProgress object
  const phaseName = SUB_STEP_PHASES[subStepKey];
  if (phaseProgress.phases[phaseName]?.sub_steps?.[subStepKey]) {
    phaseProgress.phases[phaseName].sub_steps[subStepKey] = {
      ...phaseProgress.phases[phaseName].sub_steps[subStepKey],
      status: newStatus,
      manually_updated: true,
      updated_at: new Date().toISOString(),
      ...data
    };
  }

  // CASCADE: Recalculate phase status
  const oldPhaseStatus = phaseProgress.phases[phaseName].status;
  const newPhaseStatus = calculatePhaseStatus(phaseProgress, phaseName);
  if (oldPhaseStatus !== newPhaseStatus) {
    phaseProgress.phases[phaseName].status = newPhaseStatus;
    console.log(`[updateSubStepStatus] Phase ${phaseName} status cascaded: ${oldPhaseStatus} → ${newPhaseStatus}`);
  }

  // CASCADE: Update current_phase
  const oldCurrentPhase = phaseProgress.current_phase;
  updateCurrentPhase(phaseProgress);
  if (oldCurrentPhase !== phaseProgress.current_phase) {
    console.log(`[updateSubStepStatus] current_phase updated: ${oldCurrentPhase} → ${phaseProgress.current_phase}`);
  }

  // CASCADE: Determine if job/step status needs updating
  const allPhasesCompleted = ['phase1', 'phase2', 'phase3', 'phase4']
    .every(p => phaseProgress.phases[p]?.status === 'completed');
  const anyPhaseFailed = ['phase1', 'phase2', 'phase3', 'phase4']
    .some(p => phaseProgress.phases[p]?.status === 'failed');

  const currentStepStatus = step6.status;
  let newStepStatus = currentStepStatus;
  let statusCascaded = false;

  if (allPhasesCompleted && currentStepStatus !== 'completed') {
    newStepStatus = 'completed';
    statusCascaded = true;
  } else if (anyPhaseFailed && currentStepStatus !== 'failed') {
    newStepStatus = 'failed';
    statusCascaded = true;
  } else if (!allPhasesCompleted && !anyPhaseFailed && currentStepStatus === 'completed') {
    // User reopened a completed step by marking something as failed/pending
    newStepStatus = 'in_progress';
    statusCascaded = true;
  }

  // Save sub_step_progress to database
  await executeWithRetry(
    () => client
      .from('registration_job_steps')
      .update({
        sub_step_progress: phaseProgress,
        status: newStepStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', step6.id),
    `updateSubStepStatus(job=${jobId}, subStep=${subStepKey}, status=${newStatus})`
  );

  // CASCADE: Update job status if step status changed
  if (statusCascaded) {
    const newJobStatus = newStepStatus === 'completed' ? 'completed' :
                         newStepStatus === 'failed' ? 'action_required' : 'in_progress';
    console.log(`[updateSubStepStatus] Cascading job status to: ${newJobStatus}`);
    await updateJobStatus(jobId, newJobStatus, null, 6);
  }

  return {
    success: true,
    sub_step_progress: phaseProgress,
    validation_warnings: validation.warnings,
    updated_sub_step: subStepKey,
    new_status: newStatus,
    phase_status_changed: oldPhaseStatus !== newPhaseStatus,
    new_phase_status: newPhaseStatus,
    step_status_changed: statusCascaded,
    new_step_status: newStepStatus
  };
}

/**
 * Reset a sub-step to pending, optionally cascading to dependents
 * @param {string} jobId - Job ID
 * @param {string} subStepKey - Sub-step key name
 * @param {boolean} cascadeReset - Whether to reset dependent sub-steps
 * @param {string} orgId - Organization ID for auth
 * @returns {Promise<object>} Updated sub_step_progress
 */
async function resetSubStep(jobId, subStepKey, cascadeReset = true, orgId) {
  const client = getServiceSupabaseClient();

  // Get job with Step 6 data
  const { data: job, error: jobError } = await client
    .from('registration_jobs')
    .select(`
      id,
      organisation_id,
      steps:registration_job_steps(*)
    `)
    .eq('id', jobId)
    .eq('organisation_id', orgId)
    .single();

  if (jobError || !job) {
    throw new Error('Job not found');
  }

  const step6 = job.steps?.find(s => s.step_number === 6);
  if (!step6?.sub_step_progress) {
    throw new Error('No Step 6 progress exists for this job');
  }

  const phaseProgress = step6.sub_step_progress;
  const resetSubSteps = [subStepKey];

  // If cascading, add all dependent sub-steps
  if (cascadeReset) {
    const dependents = getDependentSubSteps(subStepKey);
    resetSubSteps.push(...dependents);

    // Recursively get dependents of dependents
    for (const dep of dependents) {
      const nestedDeps = getDependentSubSteps(dep);
      for (const nested of nestedDeps) {
        if (!resetSubSteps.includes(nested)) {
          resetSubSteps.push(nested);
        }
      }
    }
  }

  // Reset each sub-step and track affected phases
  const affectedPhases = new Set();
  for (const stepKey of resetSubSteps) {
    const phaseName = SUB_STEP_PHASES[stepKey];
    affectedPhases.add(phaseName);
    if (phaseProgress.phases[phaseName]?.sub_steps?.[stepKey]) {
      phaseProgress.phases[phaseName].sub_steps[stepKey] = {
        status: 'pending',
        reset_at: new Date().toISOString(),
        reset_cascade: cascadeReset && stepKey !== subStepKey
      };
    }
  }

  // CASCADE: Recalculate affected phase statuses
  const phaseChanges = [];
  for (const phaseName of affectedPhases) {
    const oldStatus = phaseProgress.phases[phaseName].status;
    const newStatus = calculatePhaseStatus(phaseProgress, phaseName);
    if (oldStatus !== newStatus) {
      phaseProgress.phases[phaseName].status = newStatus;
      phaseChanges.push({ phase: phaseName, from: oldStatus, to: newStatus });
      console.log(`[resetSubStep] Phase ${phaseName} status cascaded: ${oldStatus} → ${newStatus}`);
    }
  }

  // CASCADE: Update current_phase
  const oldCurrentPhase = phaseProgress.current_phase;
  updateCurrentPhase(phaseProgress);
  if (oldCurrentPhase !== phaseProgress.current_phase) {
    console.log(`[resetSubStep] current_phase updated: ${oldCurrentPhase} → ${phaseProgress.current_phase}`);
  }

  // CASCADE: Determine if job/step status needs updating
  const allPhasesCompleted = ['phase1', 'phase2', 'phase3', 'phase4']
    .every(p => phaseProgress.phases[p]?.status === 'completed');
  const anyPhaseFailed = ['phase1', 'phase2', 'phase3', 'phase4']
    .some(p => phaseProgress.phases[p]?.status === 'failed');

  const currentStepStatus = step6.status;
  let newStepStatus = currentStepStatus;
  let statusCascaded = false;

  // Resetting sub-steps typically means reopening work
  if (!allPhasesCompleted && currentStepStatus === 'completed') {
    newStepStatus = 'in_progress';
    statusCascaded = true;
  } else if (!anyPhaseFailed && currentStepStatus === 'failed') {
    // If we reset a failed sub-step and no phases are failed anymore
    newStepStatus = 'in_progress';
    statusCascaded = true;
  }

  // Save to database
  await executeWithRetry(
    () => client
      .from('registration_job_steps')
      .update({
        sub_step_progress: phaseProgress,
        status: newStepStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', step6.id),
    `resetSubStep(job=${jobId}, subStep=${subStepKey}, cascade=${cascadeReset})`
  );

  // CASCADE: Update job status if step status changed
  if (statusCascaded) {
    const newJobStatus = 'action_required'; // Reset implies user needs to take action
    console.log(`[resetSubStep] Cascading job status to: ${newJobStatus}`);
    await updateJobStatus(jobId, newJobStatus, null, 6);
  }

  return {
    success: true,
    sub_step_progress: phaseProgress,
    reset_sub_steps: resetSubSteps,
    phase_changes: phaseChanges,
    step_status_changed: statusCascaded,
    new_step_status: newStepStatus
  };
}

/**
 * Get validation context for a sub-step (dependencies and allowed transitions)
 * @param {string} jobId - Job ID
 * @param {string} subStepKey - Sub-step key name
 * @param {string} orgId - Organization ID for auth
 * @returns {Promise<object>} Validation context
 */
async function getSubStepValidation(jobId, subStepKey, orgId) {
  const client = getServiceSupabaseClient();

  // Get job with Step 6 data
  const { data: job, error: jobError } = await client
    .from('registration_jobs')
    .select(`
      id,
      organisation_id,
      steps:registration_job_steps(*)
    `)
    .eq('id', jobId)
    .eq('organisation_id', orgId)
    .single();

  if (jobError || !job) {
    throw new Error('Job not found');
  }

  const step6 = job.steps?.find(s => s.step_number === 6);
  if (!step6?.sub_step_progress) {
    throw new Error('No Step 6 progress exists for this job');
  }

  const phaseProgress = step6.sub_step_progress;
  const currentStatus = getSubStepStatus(phaseProgress, subStepKey);
  const deps = SUB_STEP_DEPENDENCIES[subStepKey] || [];
  const phaseName = SUB_STEP_PHASES[subStepKey];
  const dependents = getDependentSubSteps(subStepKey);

  // Check each dependency status
  const dependencies = {};
  let canMarkComplete = true;

  for (const dep of deps) {
    const depStatus = getSubStepStatus(phaseProgress, dep);
    const isValid = ['completed', 'skipped'].includes(depStatus);
    dependencies[dep] = {
      status: depStatus,
      required: true,
      valid: isValid,
      errorMessage: isValid ? null : `Dependency '${dep}' must be completed or skipped first`
    };
    if (!isValid) canMarkComplete = false;
  }

  // Determine allowed status transitions (legacy format)
  const canMarkAs = {
    completed: canMarkComplete,
    failed: currentStatus === 'in_progress' || currentStatus === 'pending',
    skipped: true, // Can always skip
    pending: true  // Can always reset to pending
  };

  // Enhanced: Get allowed transitions array
  const allowedTransitions = getAllowedTransitions(currentStatus, deps, phaseProgress);

  // Enhanced: Dependency statuses array for UI
  const dependencyStatuses = deps.map(dep => ({
    key: dep,
    status: getSubStepStatus(phaseProgress, dep),
    phase: SUB_STEP_PHASES[dep]
  }));

  // Enhanced: Cascade warning for reset operations
  let cascadeWarning = null;
  if (dependents.length > 0) {
    cascadeWarning = `Resetting will also reset: ${dependents.join(', ')}`;
  }

  return {
    success: true,
    subStepKey,
    currentStatus,
    phase: phaseName,
    phase_status: phaseProgress.phases[phaseName]?.status,
    dependencies,
    dependents,
    canMarkAs,
    // Enhanced response fields
    allowed_transitions: allowedTransitions,
    dependency_statuses: dependencyStatuses,
    cascade_warning: cascadeWarning,
    blocking_dependencies: dependencyStatuses.filter(d =>
      !['completed', 'skipped'].includes(d.status)
    )
  };
}

// ============================================================================
// STEP 2 RETRY
// ============================================================================

/**
 * Retry Step 2 (Companies Office search) for a single job with custom search parameters
 *
 * @param {string} jobId - Registration job ID
 * @param {object} searchParams - Custom search parameters
 * @param {string} searchParams.restaurant_name - Restaurant name to search
 * @param {string} searchParams.street - Street address
 * @param {string} searchParams.city - City name
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Updated job with new search results
 */
async function retryStep2ForJob(jobId, searchParams, orgId) {
  const client = getServiceSupabaseClient();
  const companiesOfficeBatchService = require('./companies-office-batch-service');

  console.log(`[Registration Batch Service] Retrying Step 2 for job ${jobId}`);

  // Get the job
  const { data: job, error: jobError } = await client
    .from('registration_jobs')
    .select(`
      *,
      restaurant:restaurants(id, name, address, city),
      steps:registration_job_steps(*)
    `)
    .eq('id', jobId)
    .eq('organisation_id', orgId)
    .single();

  if (jobError || !job) {
    throw new Error('Registration job not found');
  }

  // Validate that Step 2 can be retried (must be action_required, failed, or have no_match status)
  const step2 = job.steps.find(s => s.step_number === 2);
  const step3 = job.steps.find(s => s.step_number === 3);

  // Allow retry if Step 2 is failed, or Step 3 is action_required (meaning search completed but needs re-search)
  const canRetry = step2?.status === 'failed' ||
                   step2?.status === 'action_required' ||
                   step3?.status === 'action_required';

  if (!canRetry) {
    throw new Error('Cannot retry Step 2 - job is not in a retryable state');
  }

  try {
    // Mark Step 2 as in_progress
    await updateStepStatus(jobId, 2, 'in_progress');

    // Use custom search params or fall back to restaurant data
    const restaurant = job.restaurant;
    const restaurantName = searchParams.restaurant_name || restaurant?.name;
    const street = searchParams.street || restaurant?.address;
    const city = searchParams.city || restaurant?.city;

    console.log(`[Registration Batch Service] Retrying search with: name="${restaurantName}", street="${street}", city="${city}"`);

    // Run Companies Office search with new parameters
    const searchResult = await companiesOfficeBatchService.searchForRestaurant({
      restaurantId: restaurant.id,
      registrationJobId: jobId,
      restaurantName,
      street,
      city
    });

    // Check if candidates were found
    const candidatesFound = searchResult.combined && searchResult.combined.length > 0;

    if (candidatesFound) {
      // Candidates found - Step 2 complete, Step 3 needs user selection
      await updateStepStatus(jobId, 2, 'completed');
      await updateStepStatus(jobId, 3, 'action_required');
      console.log(`[Registration Batch Service] Retry succeeded: ${searchResult.combined.length} candidates found, Step 3 action required`);
    } else {
      // No candidates - Step 2 action_required so user can retry again or enter manually
      await updateStepStatus(jobId, 2, 'action_required');
      console.log(`[Registration Batch Service] Retry found no candidates, Step 2 action required for another retry/manual entry`);
    }

    return {
      job_id: jobId,
      search_result: {
        combined: searchResult.combined,
        by_name: searchResult.byName,
        by_address: searchResult.byAddress,
        total_candidates: searchResult.combined.length
      },
      message: candidatesFound
        ? `Found ${searchResult.combined.length} company candidates`
        : 'No matching companies found'
    };

  } catch (error) {
    console.error(`[Registration Batch Service] Step 2 retry failed for job ${jobId}:`, error);
    await updateStepStatus(jobId, 2, 'failed', {
      error_message: error.message
    });
    throw error;
  }
}

/**
 * Skip Step 2/3/4 with manual entry of contact details
 * Used when Companies Office search fails and user wants to manually enter contact info
 *
 * @param {string} jobId - Registration job ID
 * @param {object} manualDetails - Manual entry details
 * @param {string} manualDetails.contact_name - Contact name (required)
 * @param {string} [manualDetails.full_legal_name] - Full legal name (optional)
 * @param {string} [manualDetails.contact_email] - Contact email (optional)
 * @param {string} [manualDetails.contact_phone] - Contact phone (optional)
 * @param {string} [manualDetails.company_name] - Company name (optional)
 * @param {string} [manualDetails.company_number] - Company number (optional)
 * @param {string} [manualDetails.gst_number] - GST number (optional)
 * @param {string} [manualDetails.nzbn] - NZBN (optional)
 * @param {string} orgId - Organisation ID
 * @returns {Promise<object>} Result
 */
async function skipWithManualEntry(jobId, manualDetails, orgId) {
  const client = getServiceSupabaseClient();

  console.log(`[Registration Batch Service] Skipping Steps 2-4 with manual entry for job ${jobId}`);

  if (!manualDetails.contact_name) {
    throw new Error('Contact name is required for manual entry');
  }

  // Get the job
  const { data: job, error: jobError } = await client
    .from('registration_jobs')
    .select(`
      *,
      restaurant:restaurants(id, name),
      steps:registration_job_steps(*)
    `)
    .eq('id', jobId)
    .eq('organisation_id', orgId)
    .single();

  if (jobError || !job) {
    throw new Error('Registration job not found');
  }

  const restaurantId = job.restaurant_id;

  // Save the manual details to the restaurant record
  const updates = {
    contact_name: manualDetails.contact_name,
    updated_at: new Date().toISOString()
  };

  if (manualDetails.full_legal_name) updates.full_legal_name = manualDetails.full_legal_name;
  if (manualDetails.contact_email) updates.contact_email = manualDetails.contact_email;
  if (manualDetails.contact_phone) updates.contact_phone = manualDetails.contact_phone;
  if (manualDetails.company_name) updates.company_name = manualDetails.company_name;
  if (manualDetails.company_number) updates.company_number = manualDetails.company_number;
  if (manualDetails.gst_number) updates.gst_number = manualDetails.gst_number;
  if (manualDetails.nzbn) updates.nzbn = manualDetails.nzbn;

  const { error: updateError } = await client
    .from('restaurants')
    .update(updates)
    .eq('id', restaurantId);

  if (updateError) {
    throw new Error(`Failed to save manual details: ${updateError.message}`);
  }

  // Mark Steps 2, 3, 4 as completed with manual_entry flag
  await updateStepStatus(jobId, 2, 'completed', {
    result_data: { manual_entry: true, skipped_search: true }
  });

  await updateStepStatus(jobId, 3, 'completed', {
    result_data: { manual_entry: true, skipped_selection: true }
  });

  await updateStepStatus(jobId, 4, 'completed', {
    result_data: {
      manual_entry: true,
      contact_name: manualDetails.contact_name,
      company_name: manualDetails.company_name || null,
      company_number: manualDetails.company_number || null
    }
  });

  // Check if all jobs in the batch have now completed Step 4
  const batchId = job.batch_job_id;
  const allCompleted = await checkAllJobsCompletedStep(batchId, 4);

  if (allCompleted) {
    // Update batch to Step 5
    await updateBatchStatus(batchId, 'in_progress', { current_step: 5 });
  }

  console.log(`[Registration Batch Service] Manual entry saved for job ${jobId}, all completed: ${allCompleted}`);

  return {
    job_id: jobId,
    manual_entry: true,
    details_saved: updates,
    batch_progressed: allCompleted
  };
}

// ============================================================================
// RESTAURANT DATA UPDATE (Issue 14)
// ============================================================================

/**
 * Allowed fields for restaurant update from Yolo Mode configuration
 * These are the only fields that can be updated via this endpoint
 */
const ALLOWED_RESTAURANT_UPDATE_FIELDS = [
  'email',           // Account tab
  'phone',           // Account + Restaurant tabs
  'user_password_hint', // Account tab (stored password hint)
  'name',            // Restaurant tab
  'address',         // Restaurant tab
  'city',            // Restaurant tab
  'opening_hours',   // Restaurant tab (JSONB)
  'theme',           // Website tab
  'cuisine',         // Website tab (text[])
  'primary_color',   // Website tab
  'secondary_color', // Website tab
  'contact_name',    // Onboarding tab
  'contact_email',   // Onboarding tab
  // Note: onboarding password is NOT saved to database for security
  // Header images (Issue 16 - allow manual entry/replacement)
  'website_og_image',    // Website tab - Website OG image
  'ubereats_og_image',   // Website tab - UberEats banner image
  'doordash_og_image',   // Website tab - DoorDash image
  'facebook_cover_image', // Website tab - Facebook cover image
];

// Fields that contain image URLs and should be converted to base64 on save
const IMAGE_URL_FIELDS = [
  'website_og_image',
  'ubereats_og_image',
  'doordash_og_image',
  'facebook_cover_image',
];

/**
 * Convert image URL to base64 data URI
 * Uses the downloadImageToBuffer function from logo-extraction-service
 *
 * @param {string} imageUrl - HTTP/HTTPS URL of the image
 * @returns {Promise<string|null>} Base64 data URI or null on failure
 */
async function convertImageUrlToBase64(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  // Already base64? Return as-is
  if (imageUrl.startsWith('data:image')) {
    return imageUrl;
  }

  // Not a URL? Return as-is
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  try {
    console.log(`[Registration Batch Service] Converting image URL to base64:`, imageUrl.substring(0, 80) + '...');
    const { downloadImageToBuffer } = require('./logo-extraction-service');
    const imageBuffer = await downloadImageToBuffer(imageUrl, imageUrl);
    const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    console.log(`[Registration Batch Service] Image converted to base64 (${base64.length} chars)`);
    return base64;
  } catch (error) {
    console.error(`[Registration Batch Service] Failed to convert image URL to base64:`, error.message);
    // Return original URL on failure - better to have the URL than nothing
    return imageUrl;
  }
}

/**
 * Update restaurant record from Yolo Mode configuration
 * Only updates allowed fields to prevent unauthorized modifications
 * Converts image URLs to base64 before saving
 *
 * @param {string} jobId - Registration job ID
 * @param {object} updates - Partial restaurant data to update
 * @param {string} orgId - Organization ID for authorization
 * @returns {Promise<object>} Updated restaurant data
 */
async function updateRestaurantFromConfig(jobId, updates, orgId) {
  const client = getServiceSupabaseClient();

  console.log(`[Registration Batch Service] Updating restaurant for job ${jobId}`);

  // Get the job to find the restaurant_id
  const { data: job, error: jobError } = await client
    .from('registration_jobs')
    .select('id, restaurant_id, organisation_id')
    .eq('id', jobId)
    .eq('organisation_id', orgId)
    .single();

  if (jobError || !job) {
    throw new Error('Registration job not found or access denied');
  }

  // Filter updates to only allowed fields
  const filteredUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_RESTAURANT_UPDATE_FIELDS.includes(key)) {
      // Handle cuisine array conversion if needed
      if (key === 'cuisine' && typeof value === 'string') {
        filteredUpdates[key] = [value];
      } else {
        filteredUpdates[key] = value;
      }
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  // Convert image URLs to base64 (Issue 16)
  for (const field of IMAGE_URL_FIELDS) {
    if (filteredUpdates[field] && typeof filteredUpdates[field] === 'string') {
      const originalValue = filteredUpdates[field];
      // Only convert if it's a URL (not already base64)
      if (originalValue.startsWith('http://') || originalValue.startsWith('https://')) {
        filteredUpdates[field] = await convertImageUrlToBase64(originalValue);
      }
    }
  }

  console.log(`[Registration Batch Service] Updating fields:`, Object.keys(filteredUpdates));

  // Update the restaurant
  const { data: restaurant, error: updateError } = await client
    .from('restaurants')
    .update(filteredUpdates)
    .eq('id', job.restaurant_id)
    .eq('organisation_id', orgId)
    .select()
    .single();

  if (updateError) {
    console.error(`[Registration Batch Service] Restaurant update failed:`, updateError);
    throw new Error(`Failed to update restaurant: ${updateError.message}`);
  }

  console.log(`[Registration Batch Service] Restaurant updated successfully`);

  return restaurant;
}

// ============================================================================
// SINGLE RESTAURANT YOLO MODE EXECUTION
// ============================================================================

/**
 * Execute Yolo Mode for a single restaurant (no batch required)
 * Creates/updates registration_job and tracks progress asynchronously
 *
 * This function enables RestaurantDetail.tsx to start YOLO mode execution
 * that survives dialog close and page navigation.
 *
 * @param {string} restaurantId - Restaurant UUID
 * @param {object} formData - YoloModeFormData from frontend
 * @param {string} organisationId - User's organization
 * @param {object} authContext - Auth context for server-to-server API calls
 * @returns {Promise<{jobId: string}>} - Job ID for polling
 */
async function executeYoloModeForSingleRestaurant(restaurantId, formData, organisationId, authContext = null) {
  const client = getServiceSupabaseClient();

  console.log(`[Registration Batch Service] Starting single-restaurant YOLO mode for restaurant ${restaurantId}`);

  // 1. Check for existing single-restaurant job (batch_job_id IS NULL)
  let { data: existingJob } = await client
    .from('registration_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('organisation_id', organisationId)
    .is('batch_job_id', null)
    .single();

  // 2. Create or update job
  let jobId;
  if (existingJob && existingJob.status !== 'completed') {
    jobId = existingJob.id;
    console.log(`[Registration Batch Service] Reusing existing job ${jobId}, resetting for retry`);

    // Reset job for retry
    await client
      .from('registration_jobs')
      .update({
        execution_config: formData,
        status: 'pending',
        error_message: null,
        current_step: 6,
      })
      .eq('id', jobId);

    // Reset Step 6 if exists, or create it if missing
    const { data: existingStep } = await client
      .from('registration_job_steps')
      .select('id')
      .eq('job_id', jobId)
      .eq('step_number', 6)
      .maybeSingle();

    if (existingStep) {
      await client
        .from('registration_job_steps')
        .update({
          status: 'pending',
          sub_step_progress: null,
          error_message: null,
          started_at: null,
          completed_at: null,
        })
        .eq('id', existingStep.id);
    } else {
      // Create Step 6 record if it doesn't exist
      const { error: stepError } = await client
        .from('registration_job_steps')
        .insert({
          job_id: jobId,
          step_number: 6,
          step_name: 'Pumpd Account Setup',
          step_type: 'automatic',
          status: 'pending',
        });

      if (stepError) {
        console.error(`[Registration Batch Service] Failed to create step record:`, stepError);
      }
    }
  } else {
    // Create new registration_job
    const { data: newJob, error: createError } = await client
      .from('registration_jobs')
      .insert({
        restaurant_id: restaurantId,
        batch_job_id: null, // Single-restaurant marker (no batch)
        status: 'pending',
        current_step: 6,
        execution_config: formData,
        organisation_id: organisationId,
      })
      .select()
      .single();

    if (createError) {
      console.error(`[Registration Batch Service] Failed to create job:`, createError);
      throw new Error(`Failed to create registration job: ${createError.message}`);
    }

    jobId = newJob.id;
    console.log(`[Registration Batch Service] Created new job ${jobId}`);

    // Create Step 6 tracking record
    const { error: stepError } = await client
      .from('registration_job_steps')
      .insert({
        job_id: jobId,
        step_number: 6,
        step_name: 'Pumpd Account Setup',
        step_type: 'automatic',
        status: 'pending',
      });

    if (stepError) {
      console.error(`[Registration Batch Service] Failed to create step record:`, stepError);
      // Non-fatal, continue
    }
  }

  // 3. Mark as in_progress before async start
  await client
    .from('registration_jobs')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', jobId);

  // 4. Trigger async execution via setImmediate (returns immediately to caller)
  setImmediate(async () => {
    try {
      // Fetch the full job with restaurant data
      // Explicit column list - excludes saved_images which can contain megabytes of base64 data
      const { data: job, error: fetchError } = await client
        .from('registration_jobs')
        .select(`
          *,
          restaurant:restaurants(
            id, name, slug, subdomain, address, city, email, phone,
            ubereats_url, doordash_url, website_url, facebook_url,
            opening_hours, cuisine,
            contact_name, contact_email, contact_phone,
            theme, primary_color, secondary_color, tertiary_color, accent_color, background_color,
            logo_url, logo_nobg_url, logo_standard_url,
            logo_thermal_url, logo_thermal_alt_url, logo_thermal_contrast_url, logo_thermal_adaptive_url,
            logo_favicon_url, website_og_image, ubereats_og_image, doordash_og_image, facebook_cover_image,
            user_email, user_password_hint,
            stripe_connect_url
          )
        `)
        .eq('id', jobId)
        .single();

      if (fetchError || !job) {
        throw new Error(`Failed to fetch job: ${fetchError?.message || 'Job not found'}`);
      }

      // Execute YOLO mode phases (reusing existing logic)
      await executeYoloModeForSingleRestaurantInternal(job, formData, authContext);

      // Mark job as completed
      await client
        .from('registration_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      console.log(`[Registration Batch Service] Single-restaurant YOLO mode completed for job ${jobId}`);

    } catch (error) {
      console.error(`[Registration Batch Service] Single-restaurant YOLO mode failed:`, error);

      // Mark job as failed
      await client
        .from('registration_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', jobId);

      // Also update Step 6 with error
      await updateStepStatus(jobId, 6, 'failed', {
        error_message: error.message,
      });
    }
  });

  // Return immediately with job ID for polling
  return { jobId };
}

/**
 * Internal function to execute YOLO mode phases for a single restaurant
 * Reuses the same logic as batch processing but without batch-specific operations
 */
async function executeYoloModeForSingleRestaurantInternal(job, formData, authContext) {
  await updateStepStatus(job.id, 6, 'in_progress');

  const config = formData || job.execution_config || {};
  const phaseProgress = initializePhaseProgress();

  // Shared context for passing data between steps
  const context = {
    codeInjectionId: null, // New: Database storage ID for code injection
    codeInjectionGeneratedAt: null, // New: Generation timestamp
    codeGenerationFilePaths: null, // Legacy: kept for backward compatibility
    onboardingUserCreated: false,
    menuImportSucceeded: false,
    authContext,
  };

  // Extract config sections for conditional logic
  const account = config.account || {};
  const menu = config.menu || {};
  const onboarding = config.onboarding || {};

  try {
    // ========== PHASE 1: Initial Parallel Operations ==========
    await updatePhaseProgress(job.id, 6, 'phase1', 'in_progress', phaseProgress);

    const phase1Promises = [];

    // 1a. Account Registration
    if (account.registerNewUser !== false) {
      phase1Promises.push(
        executeSubStep('cloudwaitressAccount', job, config, phaseProgress, context)
          .then(result => ({ step: 'cloudwaitressAccount', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'cloudwaitressAccount', 'skipped', { reason: 'Account registration disabled' });
      phase1Promises.push(Promise.resolve({ step: 'cloudwaitressAccount', result: { skipped: true } }));
    }

    // 1b. Code Generation
    phase1Promises.push(
      executeSubStep('codeGeneration', job, config, phaseProgress, context)
        .then(result => ({ step: 'codeGeneration', result }))
    );

    // 1c. Onboarding User Creation
    if (onboarding.createOnboardingUser) {
      phase1Promises.push(
        executeSubStep('createOnboardingUser', job, config, phaseProgress, context)
          .then(result => {
            context.onboardingUserCreated = result.success && !result.skipped;
            return { step: 'createOnboardingUser', result };
          })
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'createOnboardingUser', 'skipped', { reason: 'Onboarding user creation disabled' });
      phase1Promises.push(Promise.resolve({ step: 'createOnboardingUser', result: { skipped: true } }));
    }

    // 1d. Image Upload
    if (menu.selectedMenuId && menu.uploadImages) {
      phase1Promises.push(
        executeSubStep('uploadImages', job, config, phaseProgress, context)
          .then(result => ({ step: 'uploadImages', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'uploadImages', 'skipped', { reason: 'No menu selected or image upload disabled' });
      phase1Promises.push(Promise.resolve({ step: 'uploadImages', result: { skipped: true } }));
    }

    const phase1Results = await Promise.allSettled(phase1Promises);

    // Check account registration result (BLOCKING)
    const accountResult = phase1Results[0];
    if (accountResult.status === 'rejected') {
      throw new Error(`Account registration failed: ${accountResult.reason?.message || accountResult.reason}`);
    }
    if (accountResult.status === 'fulfilled' && accountResult.value.result?.success === false) {
      throw new Error(`Account registration failed`);
    }

    // Store codeGeneration result for websiteConfig
    const codeGenResult = phase1Results[1];
    if (codeGenResult.status === 'fulfilled' && codeGenResult.value.result?.result) {
      const codeGenData = codeGenResult.value.result.result;
      // New: Capture database ID for persistent storage
      context.codeInjectionId = codeGenData.codeInjectionId || null;
      context.codeInjectionGeneratedAt = codeGenData.generatedAt || null;
      // Legacy: Keep file paths for backward compatibility
      context.codeGenerationFilePaths = codeGenData.filePaths || null;
    }

    await updatePhaseProgress(job.id, 6, 'phase1', 'completed', phaseProgress, context);

    // ========== PHASE 2: Configuration ==========
    await updatePhaseProgress(job.id, 6, 'phase2', 'in_progress', phaseProgress);

    // Restaurant registration is BLOCKING
    await executeSubStep('restaurantRegistration', job, config, phaseProgress, context);

    // Run remaining Phase 2 steps in parallel
    const phase2Promises = [];

    // Website Configuration (only if codeGeneration succeeded - check DB ID or file paths)
    if (context.codeInjectionId || context.codeGenerationFilePaths) {
      phase2Promises.push(
        executeSubStep('websiteConfig', job, config, phaseProgress, context)
          .then(result => ({ step: 'websiteConfig', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'websiteConfig', 'skipped', { reason: 'Code generation failed - no content available' });
      phase2Promises.push(Promise.resolve({ step: 'websiteConfig', result: { skipped: true } }));
    }

    phase2Promises.push(
      executeSubStep('servicesConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'servicesConfig', result }))
    );

    phase2Promises.push(
      executeSubStep('paymentConfig', job, config, phaseProgress, context)
        .then(result => ({ step: 'paymentConfig', result }))
    );

    if (menu.selectedMenuId) {
      phase2Promises.push(
        executeSubStep('menuImport', job, config, phaseProgress, context)
          .then(result => {
            context.menuImportSucceeded = result.success && !result.skipped;
            return { step: 'menuImport', result };
          })
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'menuImport', 'skipped', { reason: 'No menu selected' });
      phase2Promises.push(Promise.resolve({ step: 'menuImport', result: { skipped: true } }));
    }

    if (onboarding.syncOnboardingRecord && context.onboardingUserCreated) {
      phase2Promises.push(
        executeSubStep('syncOnboardingUser', job, config, phaseProgress, context)
          .then(result => ({ step: 'syncOnboardingUser', result }))
      );
    } else {
      updateSubStepInProgress(phaseProgress, 'syncOnboardingUser', 'skipped', { reason: 'Onboarding sync disabled or user not created' });
      phase2Promises.push(Promise.resolve({ step: 'syncOnboardingUser', result: { skipped: true } }));
    }

    const phase2Results = await Promise.allSettled(phase2Promises);

    // Check menu import result for Phase 3 & 4
    const menuImportResult = phase2Results[3];
    if (menuImportResult.status === 'fulfilled' && menuImportResult.value.result?.success) {
      context.menuImportSucceeded = true;
    }

    await updatePhaseProgress(job.id, 6, 'phase2', 'completed', phaseProgress, context);

    // ========== PHASE 3: Menu Setup ==========
    await updatePhaseProgress(job.id, 6, 'phase3', 'in_progress', phaseProgress);

    if (menu.addOptionSets && context.menuImportSucceeded) {
      await executeSubStep('optionSets', job, config, phaseProgress, context);
    } else {
      const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Option sets disabled';
      updateSubStepInProgress(phaseProgress, 'optionSets', 'skipped', { reason });
    }

    await updatePhaseProgress(job.id, 6, 'phase3', 'completed', phaseProgress, context);

    // ========== PHASE 4: Finalization ==========
    await updatePhaseProgress(job.id, 6, 'phase4', 'in_progress', phaseProgress);

    if (menu.addItemTags && context.menuImportSucceeded) {
      await executeSubStep('itemTags', job, config, phaseProgress, context);
    } else {
      const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Item tags disabled';
      updateSubStepInProgress(phaseProgress, 'itemTags', 'skipped', { reason });
    }

    await updatePhaseProgress(job.id, 6, 'phase4', 'completed', phaseProgress, context);

    // ========== COMPLETE ==========
    await updateStepStatus(job.id, 6, 'completed', {
      sub_step_progress: phaseProgress
    });

    console.log(`[Registration Batch Service] Single-restaurant YOLO mode phases completed for job ${job.id}`);

  } catch (error) {
    console.error(`[Registration Batch Service] Single-restaurant YOLO mode failed for job ${job.id}:`, error);

    // Update step with error and progress so far
    await updateStepStatus(job.id, 6, 'failed', {
      error_message: error.message,
      sub_step_progress: phaseProgress
    });

    throw error;
  }
}

/**
 * Get execution progress for single restaurant YOLO mode
 * Used by frontend polling to check status and display progress
 *
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} organisationId - Organization ID for authorization
 * @returns {Promise<object|null>} Progress object or null if not started
 */
async function getSingleRestaurantYoloProgress(restaurantId, organisationId) {
  const client = getServiceSupabaseClient();

  const { data: job, error } = await client
    .from('registration_jobs')
    .select(`
      id,
      status,
      current_step,
      error_message,
      started_at,
      completed_at,
      updated_at,
      registration_job_steps (
        step_number,
        status,
        sub_step_progress,
        error_message,
        started_at,
        completed_at,
        updated_at
      )
    `)
    .eq('restaurant_id', restaurantId)
    .eq('organisation_id', organisationId)
    .is('batch_job_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    return null;
  }

  // Find Step 6 details
  const step6 = job.registration_job_steps?.find(s => s.step_number === 6);

  // Detect stalled jobs: in_progress but no activity for more than 5 minutes
  const STALL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  let isStalled = false;

  if (job.status === 'in_progress') {
    // Find the most recent activity timestamp from sub-steps
    const phases = step6?.sub_step_progress?.phases || {};
    let lastActivityTime = 0;

    Object.values(phases).forEach((phase) => {
      if (phase?.sub_steps) {
        Object.values(phase.sub_steps).forEach((subStep) => {
          if (subStep.completed_at && subStep.completed_at > lastActivityTime) {
            lastActivityTime = subStep.completed_at;
          }
          if (subStep.started_at && subStep.started_at > lastActivityTime) {
            lastActivityTime = subStep.started_at;
          }
        });
      }
    });

    // Fall back to step updated_at or job started_at
    if (!lastActivityTime) {
      lastActivityTime = step6?.updated_at ? new Date(step6.updated_at).getTime() :
                        job.started_at ? new Date(job.started_at).getTime() : 0;
    }

    const timeSinceActivity = Date.now() - lastActivityTime;
    isStalled = timeSinceActivity > STALL_THRESHOLD_MS;

    if (isStalled) {
      console.log(`[Registration Batch Service] Job ${job.id} detected as stalled (no activity for ${Math.round(timeSinceActivity / 1000 / 60)} minutes)`);
    }
  }

  return {
    jobId: job.id,
    status: isStalled ? 'stalled' : job.status,
    currentPhase: step6?.sub_step_progress?.current_phase || null,
    phases: step6?.sub_step_progress?.phases || {},
    error: job.error_message || step6?.error_message || null,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    stepStatus: step6?.status || 'pending',
    isStalled,
  };
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Step definitions
  getRegistrationStepDefinitions,

  // Batch operations
  listRegistrationBatchJobs,
  getRegistrationBatchJob,
  createRegistrationBatchJob,
  startBatchJob,
  cancelBatchJob,
  getBatchProgress,
  markExtractionsExecutedOnCreation,

  // Job operations
  createRegistrationJob,
  updateJobStatus,

  // Step operations
  updateStepStatus,
  checkAllJobsCompletedStep,

  // Step processors
  processStep1,
  processStep2,
  completeStep3,
  processStep4,
  completeStep5,
  processStep6,

  // Step 6 resume functionality
  resumeYoloModeForJob,
  detectLastCompletePhase,
  reconstructContext,

  // Step 6 sub-step manual editing
  updateSubStepStatus,
  resetSubStep,
  getSubStepValidation,
  getSubStepStatus,
  validateSubStepTransition,
  SUB_STEP_DEPENDENCIES,
  SUB_STEP_PHASES,

  // Step retry/skip
  retryStep2ForJob,
  skipWithManualEntry,

  // Restaurant data update (Issue 14)
  updateRestaurantFromConfig,

  // Single restaurant YOLO mode (async execution)
  executeYoloModeForSingleRestaurant,
  getSingleRestaurantYoloProgress,

  // Utility
  updateBatchStatus,
  incrementBatchProgress,
  calculateBatchFinalStatus
};
