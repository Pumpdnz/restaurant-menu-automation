/**
 * Lead Scrape Service
 * Handles business logic for lead scraping operations
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

/**
 * UberEats Step Definitions
 * These are the standard steps for UberEats lead extraction
 */
const UBEREATS_STEPS = [
  {
    step_number: 1,
    step_name: 'Category Page Scan',
    step_description: 'Extract restaurant names and URLs from category listing',
    step_type: 'automatic'
  },
  {
    step_number: 2,
    step_name: 'Store Page Enrichment',
    step_description: 'Batch scrape individual store pages for details',
    step_type: 'action_required'
  },
  {
    step_number: 3,
    step_name: 'Google Business Lookup',
    step_description: 'Search Google for business details (phone, website, hours)',
    step_type: 'action_required'
  },
  {
    step_number: 4,
    step_name: 'Ordering Platform Discovery',
    step_description: 'Discover online ordering platforms from website',
    step_type: 'action_required'
  }
];

/**
 * Build UberEats category URL
 * @param {string} countryCode - Country code (nz, au)
 * @param {string} cityCode - City code (e.g., 'auckland')
 * @param {string} regionCode - Region code (e.g., 'auk')
 * @param {string} cuisine - Cuisine type
 * @param {number} pageOffset - Page number (default 1)
 * @returns {string} Full UberEats category URL
 */
function buildUberEatsCategoryUrl(countryCode, cityCode, regionCode, cuisine, pageOffset = 1) {
  return `https://www.ubereats.com/${countryCode}/category/${cityCode}-${regionCode}/${cuisine}?page=${pageOffset}`;
}

/**
 * Get step definitions for a platform
 * @param {string} platform - Platform name (ubereats, doordash, etc.)
 * @returns {Array} Array of step definitions
 */
function getStepDefinitions(platform) {
  switch (platform.toLowerCase()) {
    case 'ubereats':
      return UBEREATS_STEPS;
    default:
      return UBEREATS_STEPS; // Default to UberEats for now
  }
}

/**
 * List all lead scrape jobs with filtering
 * @param {object} filters - Filter options
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Jobs list with pagination
 */
async function listLeadScrapeJobs(filters = {}, orgId) {
  const client = getSupabaseClient();

  try {
    let query = client
      .from('lead_scrape_jobs')
      .select(`
        *,
        lead_scrape_job_steps (
          id,
          step_number,
          step_name,
          step_type,
          status,
          leads_received,
          leads_processed,
          leads_passed,
          leads_failed,
          started_at,
          completed_at
        )
      `)
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters.status) {
      const statuses = filters.status.split(',');
      query = query.in('status', statuses);
    }

    if (filters.platform) {
      query = query.eq('platform', filters.platform);
    }

    if (filters.city) {
      query = query.eq('city', filters.city);
    }

    if (filters.cuisine) {
      query = query.ilike('cuisine', `%${filters.cuisine}%`);
    }

    if (filters.started_after) {
      query = query.gte('started_at', filters.started_after);
    }

    if (filters.started_before) {
      query = query.lte('started_at', filters.started_before);
    }

    // Pagination
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Sort steps by step_number within each job
    const jobs = data.map(job => ({
      ...job,
      steps: (job.lead_scrape_job_steps || []).sort((a, b) => a.step_number - b.step_number)
    }));

    // Remove the raw nested data
    jobs.forEach(job => delete job.lead_scrape_job_steps);

    return {
      jobs,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error listing jobs:', error);
    throw error;
  }
}

/**
 * Get a single lead scrape job by ID
 * @param {string} jobId - Job ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Job with steps
 */
async function getLeadScrapeJob(jobId, orgId) {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('lead_scrape_jobs')
      .select(`
        *,
        lead_scrape_job_steps (
          id,
          step_number,
          step_name,
          step_description,
          step_type,
          status,
          leads_received,
          leads_processed,
          leads_passed,
          leads_failed,
          started_at,
          completed_at,
          error_message,
          metadata
        )
      `)
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Lead scrape job not found');
      }
      throw error;
    }

    // Sort steps by step_number
    const job = {
      ...data,
      steps: (data.lead_scrape_job_steps || []).sort((a, b) => a.step_number - b.step_number)
    };
    delete job.lead_scrape_job_steps;

    return job;
  } catch (error) {
    console.error('[LeadScrapeService] Error getting job:', error);
    throw error;
  }
}

/**
 * Create a new lead scrape job
 * @param {object} jobData - Job data
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID (created_by)
 * @returns {Promise<object>} Created job
 */
async function createLeadScrapeJob(jobData, orgId, userId) {
  const client = getSupabaseClient();

  try {
    const {
      platform,
      country = 'nz',
      city,
      city_code,
      region_code,
      cuisine,
      leads_limit = 21,
      page_offset = 1,
      save_as_draft = false
    } = jobData;

    // Validate required fields
    if (!platform) {
      throw new Error('Platform is required');
    }
    if (!city) {
      throw new Error('City is required');
    }
    if (!cuisine) {
      throw new Error('Cuisine is required');
    }

    // Lookup city codes if not provided
    let finalCityCode = city_code;
    let finalRegionCode = region_code;

    if (!finalCityCode || !finalRegionCode) {
      const { data: cityData, error: cityError } = await client
        .from('city_codes')
        .select('city_code, region_code')
        .eq('city_name', city)
        .eq('country', country)
        .single();

      if (cityError && cityError.code !== 'PGRST116') {
        throw cityError;
      }

      if (cityData) {
        finalCityCode = cityData.city_code;
        finalRegionCode = cityData.region_code;
      } else {
        // Fallback: generate from city name
        finalCityCode = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        finalRegionCode = finalCityCode.substring(0, 3);
      }
    }

    // Build initial URL
    const initialUrl = buildUberEatsCategoryUrl(
      country,
      finalCityCode,
      finalRegionCode,
      cuisine.toLowerCase(),
      page_offset
    );

    // Generate job name
    const dateStr = new Date().toISOString().split('T')[0];
    const jobName = `${platform} - ${cuisine} - ${city.toLowerCase()} - ${dateStr}`;

    // Get step definitions
    const stepDefinitions = getStepDefinitions(platform);

    // Create the job
    const { data: job, error: jobError } = await client
      .from('lead_scrape_jobs')
      .insert({
        name: jobName,
        platform: platform.toLowerCase(),
        country,
        city,
        city_code: finalCityCode,
        region_code: finalRegionCode,
        cuisine: cuisine.toLowerCase(),
        leads_limit,
        page_offset,
        initial_url: initialUrl,
        status: save_as_draft ? 'draft' : 'pending',
        current_step: 0,
        total_steps: stepDefinitions.length,
        organisation_id: orgId,
        created_by: userId,
        metadata: {}
      })
      .select()
      .single();

    if (jobError) throw jobError;

    return job;
  } catch (error) {
    console.error('[LeadScrapeService] Error creating job:', error);
    throw error;
  }
}

/**
 * Update a draft lead scrape job
 * @param {string} jobId - Job ID
 * @param {object} updates - Fields to update
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Updated job
 */
async function updateLeadScrapeJob(jobId, updates, orgId) {
  const client = getSupabaseClient();

  try {
    // First check job exists and is draft
    const { data: existing, error: fetchError } = await client
      .from('lead_scrape_jobs')
      .select('status')
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Lead scrape job not found');
      }
      throw fetchError;
    }

    if (existing.status !== 'draft') {
      throw new Error('Can only update draft jobs');
    }

    // Build update object (only allow certain fields)
    const allowedFields = ['city', 'city_code', 'region_code', 'cuisine', 'leads_limit', 'page_offset'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // Rebuild initial URL if relevant fields changed
    if (updates.city || updates.cuisine || updates.page_offset) {
      const { data: job } = await client
        .from('lead_scrape_jobs')
        .select('country, city_code, region_code, cuisine, page_offset')
        .eq('id', jobId)
        .single();

      const newUrl = buildUberEatsCategoryUrl(
        job.country,
        updateData.city_code || job.city_code,
        updateData.region_code || job.region_code,
        (updateData.cuisine || job.cuisine).toLowerCase(),
        updateData.page_offset || job.page_offset
      );
      updateData.initial_url = newUrl;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('lead_scrape_jobs')
      .update(updateData)
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[LeadScrapeService] Error updating job:', error);
    throw error;
  }
}

/**
 * Delete a lead scrape job and all associated data
 * @param {string} jobId - Job ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Deleted job
 */
async function deleteLeadScrapeJob(jobId, orgId) {
  const client = getSupabaseClient();

  try {
    // Get job first
    const { data: existing, error: fetchError } = await client
      .from('lead_scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Lead scrape job not found');
      }
      throw fetchError;
    }

    // Delete job (cascade will handle steps and leads)
    const { error: deleteError } = await client
      .from('lead_scrape_jobs')
      .delete()
      .eq('id', jobId)
      .eq('organisation_id', orgId);

    if (deleteError) throw deleteError;

    return existing;
  } catch (error) {
    console.error('[LeadScrapeService] Error deleting job:', error);
    throw error;
  }
}

/**
 * Start a lead scrape job
 * Creates steps and begins processing
 * @param {string} jobId - Job ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Started job with steps
 */
async function startLeadScrapeJob(jobId, orgId) {
  const client = getSupabaseClient();

  try {
    // Get job
    const { data: job, error: fetchError } = await client
      .from('lead_scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Lead scrape job not found');
      }
      throw fetchError;
    }

    if (job.status !== 'draft' && job.status !== 'pending') {
      throw new Error('Can only start draft or pending jobs');
    }

    // Get step definitions
    const stepDefinitions = getStepDefinitions(job.platform);

    // Create steps
    const stepsToCreate = stepDefinitions.map(stepDef => ({
      job_id: jobId,
      step_number: stepDef.step_number,
      step_name: stepDef.step_name,
      step_description: stepDef.step_description,
      step_type: stepDef.step_type,
      status: stepDef.step_number === 1 ? 'pending' : 'pending',
      leads_received: 0,
      leads_processed: 0,
      leads_passed: 0,
      leads_failed: 0
    }));

    const { data: steps, error: stepsError } = await client
      .from('lead_scrape_job_steps')
      .insert(stepsToCreate)
      .select();

    if (stepsError) throw stepsError;

    // Update job status
    const { data: updatedJob, error: updateError } = await client
      .from('lead_scrape_jobs')
      .update({
        status: 'in_progress',
        current_step: 1,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      ...updatedJob,
      steps: steps.sort((a, b) => a.step_number - b.step_number)
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error starting job:', error);
    throw error;
  }
}

/**
 * Cancel a lead scrape job
 * @param {string} jobId - Job ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Cancelled job
 */
async function cancelLeadScrapeJob(jobId, orgId) {
  const client = getSupabaseClient();

  try {
    // Get job
    const { data: job, error: fetchError } = await client
      .from('lead_scrape_jobs')
      .select('status')
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Lead scrape job not found');
      }
      throw fetchError;
    }

    if (!['draft', 'pending', 'in_progress'].includes(job.status)) {
      throw new Error('Can only cancel draft, pending, or in-progress jobs');
    }

    // Update job status
    const { data, error } = await client
      .from('lead_scrape_jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[LeadScrapeService] Error cancelling job:', error);
    throw error;
  }
}

/**
 * Get a specific step with its leads
 * @param {string} jobId - Job ID
 * @param {number} stepNumber - Step number
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Step with leads
 */
async function getJobStep(jobId, stepNumber, orgId) {
  const client = getSupabaseClient();

  try {
    // Verify job belongs to org
    const { data: job, error: jobError } = await client
      .from('lead_scrape_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organisation_id', orgId)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        throw new Error('Lead scrape job not found');
      }
      throw jobError;
    }

    // Get step
    const { data: step, error: stepError } = await client
      .from('lead_scrape_job_steps')
      .select('*')
      .eq('job_id', jobId)
      .eq('step_number', stepNumber)
      .single();

    if (stepError) {
      if (stepError.code === 'PGRST116') {
        throw new Error('Step not found');
      }
      throw stepError;
    }

    // Get leads for this step - query is STATUS-AGNOSTIC
    // Always get leads at this step OR beyond (to show both current and passed)
    // This handles:
    // - Leads currently at this step (available, processing, processed, failed)
    // - Leads that have passed through this step (current_step > stepNumber)
    // Frontend computes display status based on lead.current_step vs stepNumber:
    // - lead.current_step > stepNumber → display as "passed"
    // - lead.current_step === stepNumber → display actual step_progression_status
    let leadsQuery = client
      .from('leads')
      .select('*')
      .eq('lead_scrape_job_id', jobId)
      .gte('current_step', stepNumber);

    const { data: leads, error: leadsError } = await leadsQuery.order('created_at', { ascending: true });

    if (leadsError) throw leadsError;

    return {
      step,
      leads: leads || []
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error getting step:', error);
    throw error;
  }
}

/**
 * Trigger processing for a step
 * This marks the step as in_progress and prepares leads for processing
 * For automatic steps, this would trigger the actual Firecrawl extraction (Phase 3)
 * For action_required steps, this marks them ready for manual processing
 * @param {string} stepId - Step ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Updated step with processing status
 */
async function triggerStepProcessing(stepId, orgId) {
  const client = getSupabaseClient();

  try {
    // Get step with job info
    const { data: step, error: stepError } = await client
      .from('lead_scrape_job_steps')
      .select(`
        *,
        lead_scrape_jobs!inner (
          id,
          organisation_id,
          status,
          platform,
          initial_url
        )
      `)
      .eq('id', stepId)
      .single();

    if (stepError) {
      if (stepError.code === 'PGRST116') {
        throw new Error('Step not found');
      }
      throw stepError;
    }

    if (step.lead_scrape_jobs.organisation_id !== orgId) {
      throw new Error('Step not found');
    }

    // Validate job is in progress
    if (step.lead_scrape_jobs.status !== 'in_progress') {
      throw new Error('Job must be in progress to process steps');
    }

    // Validate step can be processed
    if (step.status === 'completed') {
      throw new Error('Step is already completed');
    }

    if (step.status === 'in_progress') {
      throw new Error('Step is already being processed');
    }

    // For step 1, we don't need leads_received > 0 check as it's the initial extraction
    // For other steps, ensure there are leads to process
    if (step.step_number > 1 && step.leads_received === 0) {
      throw new Error('No leads available to process in this step');
    }

    // Update step status to in_progress
    const { data: updatedStep, error: updateError } = await client
      .from('lead_scrape_job_steps')
      .update({
        status: 'in_progress',
        started_at: step.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', stepId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Mark available leads as processing
    if (step.step_number > 1) {
      await client
        .from('leads')
        .update({
          step_progression_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('lead_scrape_job_id', step.job_id)
        .eq('current_step', step.step_number)
        .eq('step_progression_status', 'available');
    }

    // Update job's current_step if needed
    await client
      .from('lead_scrape_jobs')
      .update({
        current_step: step.step_number,
        updated_at: new Date().toISOString()
      })
      .eq('id', step.job_id);

    return {
      step: updatedStep,
      message: step.step_type === 'automatic'
        ? 'Step processing initiated. Use Firecrawl integration to extract data.'
        : 'Step marked for manual processing. Complete actions and pass leads when ready.',
      step_type: step.step_type,
      job_id: step.job_id,
      platform: step.lead_scrape_jobs.platform,
      initial_url: step.lead_scrape_jobs.initial_url
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error triggering step processing:', error);
    throw error;
  }
}

/**
 * Pass leads to the next step and optionally auto-trigger processing
 * @param {string} stepId - Step ID
 * @param {Array<string>} leadIds - Lead IDs to pass
 * @param {string} orgId - Organization ID
 * @param {boolean} autoProcess - Whether to auto-trigger processing (default: true)
 * @returns {Promise<object>} Updated step, passed count, job_id, and lead_ids for processing
 */
async function passLeadsToNextStep(stepId, leadIds, orgId, autoProcess = true) {
  const client = getSupabaseClient();

  try {
    if (!leadIds || leadIds.length === 0) {
      throw new Error('At least one lead ID is required');
    }

    // Get step with job info
    const { data: step, error: stepError } = await client
      .from('lead_scrape_job_steps')
      .select(`
        *,
        lead_scrape_jobs!inner (
          id,
          organisation_id,
          total_steps
        )
      `)
      .eq('id', stepId)
      .single();

    if (stepError) {
      if (stepError.code === 'PGRST116') {
        throw new Error('Step not found');
      }
      throw stepError;
    }

    if (step.lead_scrape_jobs.organisation_id !== orgId) {
      throw new Error('Step not found');
    }

    const nextStepNumber = step.step_number + 1;
    const isLastStep = step.step_number >= step.lead_scrape_jobs.total_steps;

    // Update leads - accept 'processed' or 'available' status leads at current step
    // Set to 'available' for next step (ready for processing selection)
    const { data: updatedLeads, error: leadsError } = await client
      .from('leads')
      .update({
        current_step: isLastStep ? step.step_number : nextStepNumber,
        step_progression_status: isLastStep ? 'passed' : 'available',
        updated_at: new Date().toISOString()
      })
      .in('id', leadIds)
      .eq('lead_scrape_job_id', step.job_id)
      .eq('current_step', step.step_number)
      .in('step_progression_status', ['processed', 'available', 'failed']) // Accept processed, available, or failed leads
      .select();

    if (leadsError) throw leadsError;

    const passedCount = updatedLeads?.length || 0;
    const passedLeadIds = updatedLeads?.map(l => l.id) || [];

    if (passedCount === 0) {
      console.warn(`[LeadScrapeService] No leads matched for passing. Requested: ${leadIds.length}, Matched: 0`);
    }

    // Update current step counts
    const { data: updatedStep, error: stepUpdateError } = await client
      .from('lead_scrape_job_steps')
      .update({
        leads_passed: step.leads_passed + passedCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', stepId)
      .select()
      .single();

    if (stepUpdateError) throw stepUpdateError;

    // Update next step's leads_received and status if not last step
    if (!isLastStep && passedCount > 0) {
      // Get the current next step data
      const { data: nextStep } = await client
        .from('lead_scrape_job_steps')
        .select('id, leads_received, status')
        .eq('job_id', step.job_id)
        .eq('step_number', nextStepNumber)
        .single();

      // Update next step - transition to action_required if pending OR completed
      // Completed steps need to become action_required when new leads arrive
      // (e.g., user comes back later to process remaining leads from previous step)
      const shouldBecomeActionRequired =
        nextStep?.status === 'pending' || nextStep?.status === 'completed';

      await client
        .from('lead_scrape_job_steps')
        .update({
          leads_received: (nextStep?.leads_received || 0) + passedCount,
          status: shouldBecomeActionRequired ? 'action_required' : nextStep?.status,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', step.job_id)
        .eq('step_number', nextStepNumber);

      // Update job's current_step to next step
      await client
        .from('lead_scrape_jobs')
        .update({
          current_step: nextStepNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', step.job_id);
    }

    // Mark current step as completed after passing leads
    // When a user passes leads, they've made a deliberate decision about which leads qualify.
    // The step is considered "completed" because the user has finished their review/selection.
    // If more leads arrive later from the previous step, the step will transition back to
    // 'action_required' (handled in the next step update logic above).
    if (passedCount > 0) {
      await client
        .from('lead_scrape_job_steps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stepId);
    }

    return {
      passed_count: passedCount,
      passed_lead_ids: passedLeadIds,
      step: updatedStep,
      job_id: step.job_id,
      next_step_number: isLastStep ? null : nextStepNumber,
      is_last_step: isLastStep,
      auto_process: autoProcess && !isLastStep && passedCount > 0
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error passing leads:', error);
    throw error;
  }
}

/**
 * Retry failed leads in a step
 * @param {string} stepId - Step ID
 * @param {Array<string>} leadIds - Lead IDs to retry
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Retried count
 */
async function retryFailedLeads(stepId, leadIds, orgId) {
  const client = getSupabaseClient();
  const firecrawlService = require('./lead-scrape-firecrawl-service');

  try {
    // Get step with job info
    const { data: step, error: stepError } = await client
      .from('lead_scrape_job_steps')
      .select(`
        *,
        lead_scrape_jobs!inner (
          id,
          organisation_id
        )
      `)
      .eq('id', stepId)
      .single();

    if (stepError) {
      if (stepError.code === 'PGRST116') {
        throw new Error('Step not found');
      }
      throw stepError;
    }

    if (step.lead_scrape_jobs.organisation_id !== orgId) {
      throw new Error('Step not found');
    }

    // First, get the current status of the leads to determine what we're retrying
    const { data: currentLeads, error: currentError } = await client
      .from('leads')
      .select('id, step_progression_status')
      .in('id', leadIds)
      .eq('lead_scrape_job_id', step.job_id)
      .eq('current_step', step.step_number);

    if (currentError) throw currentError;

    console.log(`[LeadScrapeService] Retry requested for ${leadIds.length} leads, found ${currentLeads?.length || 0} at step ${step.step_number}`);
    console.log(`[LeadScrapeService] Lead statuses:`, currentLeads?.map(l => ({ id: l.id, status: l.step_progression_status })));

    // Count how many are in failed status for updating step stats
    const failedCount = currentLeads?.filter(l => l.step_progression_status === 'failed').length || 0;

    // Update leads to 'available' status - allow retrying failed, processed, or any status
    // (This allows re-processing leads that completed but user wants to re-run)
    const { data: updatedLeads, error: leadsError } = await client
      .from('leads')
      .update({
        step_progression_status: 'available',
        validation_errors: [],
        updated_at: new Date().toISOString()
      })
      .in('id', leadIds)
      .eq('lead_scrape_job_id', step.job_id)
      .eq('current_step', step.step_number)
      .select();

    if (leadsError) throw leadsError;

    const retriedCount = updatedLeads?.length || 0;
    console.log(`[LeadScrapeService] Updated ${retriedCount} leads to 'available' status`);

    // Update step stats
    if (retriedCount > 0) {
      await client
        .from('lead_scrape_job_steps')
        .update({
          leads_failed: Math.max(0, step.leads_failed - failedCount),
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', stepId);

      // Get the retried lead IDs
      const retriedLeadIds = updatedLeads.map(l => l.id);

      // Trigger re-extraction in background for the retried leads
      console.log(`[LeadScrapeService] Triggering retry extraction for ${retriedCount} leads in step ${step.step_number}`);

      // Fire and forget - don't await
      (async () => {
        try {
          const processFn = {
            2: firecrawlService.processStep2,
            3: firecrawlService.processStep3,
            4: firecrawlService.processStep4,
          }[step.step_number];

          if (processFn) {
            console.log(`[LeadScrapeService] Calling processStep${step.step_number} for job ${step.job_id} with ${retriedLeadIds.length} leads`);
            await processFn(step.job_id, retriedLeadIds);
            console.log(`[LeadScrapeService] processStep${step.step_number} completed`);
          } else {
            console.log(`[LeadScrapeService] No process function found for step ${step.step_number}`);
          }
        } catch (err) {
          console.error(`[LeadScrapeService] Retry extraction error:`, err);
        }
      })();
    } else {
      console.log(`[LeadScrapeService] No leads were updated - they may not be at the correct step`);
    }

    return {
      retried_count: retriedCount,
      auto_processing: retriedCount > 0
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error retrying leads:', error);
    throw error;
  }
}

/**
 * Get pending leads (completed all steps)
 * @param {object} filters - Filter options
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Leads with pagination
 */
async function getPendingLeads(filters = {}, orgId) {
  const client = getSupabaseClient();

  try {
    // First get job IDs for this org
    const { data: jobs, error: jobsError } = await client
      .from('lead_scrape_jobs')
      .select('id, total_steps')
      .eq('organisation_id', orgId);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return {
        leads: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false }
      };
    }

    const jobIds = jobs.map(j => j.id);
    const maxSteps = Math.max(...jobs.map(j => j.total_steps));

    let query = client
      .from('leads')
      .select('*, lead_scrape_jobs!inner(name, platform, city, cuisine)', { count: 'exact' })
      .in('lead_scrape_job_id', jobIds)
      .gte('current_step', maxSteps)
      .eq('step_progression_status', 'passed')
      .is('converted_to_restaurant_id', null)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.search) {
      query = query.ilike('restaurant_name', `%${filters.search}%`);
    }

    if (filters.platform) {
      query = query.eq('platform', filters.platform);
    }

    // Filter by job's city (from the lead scrape job, not the lead itself)
    if (filters.city) {
      query = query.eq('lead_scrape_jobs.city', filters.city);
    }

    // Filter by job's cuisine (from the lead scrape job, not the lead itself)
    if (filters.cuisine) {
      query = query.eq('lead_scrape_jobs.cuisine', filters.cuisine);
    }

    // Pagination
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data
    const leads = (data || []).map(lead => ({
      ...lead,
      job: lead.lead_scrape_jobs,
      lead_scrape_jobs: undefined
    }));

    return {
      leads,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error getting pending leads:', error);
    throw error;
  }
}

/**
 * Get filter options for pending leads (unique cities and cuisines from jobs that have pending leads)
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Filter options { cities: string[], cuisines: string[] }
 */
async function getPendingLeadsFilterOptions(orgId) {
  const client = getSupabaseClient();

  try {
    // Get jobs for this org with their total_steps
    const { data: jobs, error: jobsError } = await client
      .from('lead_scrape_jobs')
      .select('id, total_steps, city, cuisine')
      .eq('organisation_id', orgId);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return { cities: [], cuisines: [] };
    }

    const jobIds = jobs.map(j => j.id);
    const maxSteps = Math.max(...jobs.map(j => j.total_steps));

    // Get job IDs that have pending leads
    const { data: pendingLeadJobIds, error: pendingError } = await client
      .from('leads')
      .select('lead_scrape_job_id')
      .in('lead_scrape_job_id', jobIds)
      .gte('current_step', maxSteps)
      .eq('step_progression_status', 'passed')
      .is('converted_to_restaurant_id', null);

    if (pendingError) throw pendingError;

    // Get unique job IDs that have pending leads
    const uniqueJobIds = [...new Set(pendingLeadJobIds?.map(l => l.lead_scrape_job_id) || [])];

    // Filter jobs to only those with pending leads and extract unique cities/cuisines
    const jobsWithPendingLeads = jobs.filter(j => uniqueJobIds.includes(j.id));

    const cities = [...new Set(jobsWithPendingLeads.map(j => j.city).filter(Boolean))].sort();
    const cuisines = [...new Set(jobsWithPendingLeads.map(j => j.cuisine).filter(Boolean))].sort();

    return { cities, cuisines };
  } catch (error) {
    console.error('[LeadScrapeService] Error getting pending leads filter options:', error);
    throw error;
  }
}

/**
 * Get a single lead by ID
 * @param {string} leadId - Lead ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Lead data
 */
async function getLead(leadId, orgId) {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('leads')
      .select(`
        *,
        lead_scrape_jobs!inner (
          id,
          name,
          platform,
          organisation_id
        )
      `)
      .eq('id', leadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Lead not found');
      }
      throw error;
    }

    if (data.lead_scrape_jobs.organisation_id !== orgId) {
      throw new Error('Lead not found');
    }

    return {
      ...data,
      job: {
        id: data.lead_scrape_jobs.id,
        name: data.lead_scrape_jobs.name,
        platform: data.lead_scrape_jobs.platform
      },
      lead_scrape_jobs: undefined
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error getting lead:', error);
    throw error;
  }
}

/**
 * Update a lead
 * @param {string} leadId - Lead ID
 * @param {object} updates - Fields to update
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Updated lead
 */
async function updateLead(leadId, updates, orgId) {
  const client = getSupabaseClient();

  try {
    // Verify lead belongs to org
    await getLead(leadId, orgId);

    // Only allow certain fields to be updated
    const allowedFields = [
      'restaurant_name', 'phone', 'email', 'website_url',
      'instagram_url', 'facebook_url', 'google_maps_url',
      'contact_name', 'contact_email', 'contact_phone', 'contact_role',
      'organisation_name', 'city', 'region', 'opening_hours', 'opening_hours_text',
      'ubereats_address', 'google_address'
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[LeadScrapeService] Error updating lead:', error);
    throw error;
  }
}

/**
 * Map ordering platform name to the appropriate restaurant URL column
 * @param {string} platformName - Name of the ordering platform
 * @returns {string} Column name in restaurants table
 */
function getOrderingPlatformColumn(platformName) {
  if (!platformName) return null;

  const platformLower = platformName.toLowerCase();

  if (platformLower.includes('me&u') || platformLower.includes('meandu') || platformLower.includes('mryum')) {
    return 'meandyou_url';
  }
  if (platformLower.includes('mobi2go')) {
    return 'mobi2go_url';
  }
  if (platformLower.includes('delivereasy')) {
    return 'delivereasy_url';
  }
  if (platformLower.includes('nextorder')) {
    return 'nextorder_url';
  }
  if (platformLower.includes('foodhub')) {
    return 'foodhub_url';
  }
  if (platformLower.includes('ordermeal')) {
    return 'ordermeal_url';
  }

  // For any other platform (Bite, Bopple, Bustle, GloriaFood, etc.)
  return 'additional_ordering_platform_url';
}

/**
 * Convert 12-hour time format to 24-hour format
 * Handles formats: "5:00 PM", "5pm", "5:30pm", "17:00"
 * @param {string} time12h - Time in 12-hour format (e.g., "5:00 PM", "5pm", "5:30pm")
 * @returns {string} Time in 24-hour format (e.g., "17:00")
 */
function convertTo24Hour(time12h) {
  if (!time12h) return null;

  const timeStr = time12h.trim().toLowerCase();

  // Already in 24-hour format (no am/pm)
  if (!timeStr.includes('am') && !timeStr.includes('pm')) {
    // Ensure proper format HH:MM
    if (timeStr.includes(':')) {
      const [h, m] = timeStr.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return `${timeStr.padStart(2, '0')}:00`;
  }

  // Extract am/pm modifier
  const isPM = timeStr.includes('pm');
  const isAM = timeStr.includes('am');

  // Remove am/pm suffix to get just the time part
  const timePart = timeStr.replace(/\s*(am|pm)\s*/gi, '').trim();

  // Parse hours and minutes
  let hours, minutes;
  if (timePart.includes(':')) {
    [hours, minutes] = timePart.split(':').map(s => parseInt(s, 10));
  } else {
    hours = parseInt(timePart, 10);
    minutes = 0;
  }

  // Convert to 24-hour format
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`;
}

/**
 * Convert lead opening hours format to restaurant format
 * Lead format: [{ day, open, close, period }]
 * Restaurant format: [{ day, hours: { open, close } }]
 * @param {Array} leadHours - Opening hours from lead
 * @returns {Array} Opening hours in restaurant format
 */
function convertOpeningHoursFormat(leadHours) {
  if (!leadHours || !Array.isArray(leadHours) || leadHours.length === 0) {
    return null;
  }

  // Check if already in restaurant format
  if (leadHours[0]?.hours) {
    return leadHours;
  }

  // Group by day and merge periods (take earliest open, latest close)
  const dayMap = {};
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (const entry of leadHours) {
    const day = entry.day;
    const open24 = convertTo24Hour(entry.open);
    const close24 = convertTo24Hour(entry.close);

    if (!dayMap[day]) {
      dayMap[day] = { open: open24, close: close24 };
    } else {
      // Merge: take earliest open and latest close
      if (open24 < dayMap[day].open) {
        dayMap[day].open = open24;
      }
      if (close24 > dayMap[day].close) {
        dayMap[day].close = close24;
      }
    }
  }

  // Convert to array in day order
  return dayOrder
    .filter(day => dayMap[day])
    .map(day => ({
      day,
      hours: {
        open: dayMap[day].open,
        close: dayMap[day].close
      }
    }));
}

/**
 * Calculate ICP rating based on reviews
 * Formula: ((ubereats_reviews * ubereats_rating) + (google_reviews * google_rating)) / 1000
 * Max: 10, Rounded to 0dp
 * @param {object} lead - Lead data
 * @returns {number} ICP rating 0-10
 */
function calculateIcpRating(lead) {
  // Parse review counts (may contain '+' like "500+")
  const parseReviewCount = (val) => {
    if (!val) return 0;
    const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };

  const ubereatsReviews = parseReviewCount(lead.ubereats_number_of_reviews);
  const ubereatsRating = parseFloat(lead.ubereats_average_review_rating) || 0;
  const googleReviews = parseReviewCount(lead.google_number_of_reviews);
  const googleRating = parseFloat(lead.google_average_review_rating) || 0;

  const score = ((ubereatsReviews * ubereatsRating) + (googleReviews * googleRating)) / 1000;

  return Math.min(10, Math.round(score));
}

/**
 * Convert leads to restaurants
 * @param {Array<string>} leadIds - Lead IDs to convert
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID performing conversion
 * @param {object} options - Conversion options
 * @param {string} options.address_source - Which address to use: 'ubereats', 'google', or 'auto' (default)
 * @returns {Promise<object>} Conversion results
 */
async function convertLeadsToRestaurants(leadIds, orgId, userId, options = {}) {
  const client = getSupabaseClient();
  const {
    address_source = 'auto',
    create_registration_batch = false,
    batch_name = null,
    source_lead_scrape_job_id = null
  } = options;

  const converted = [];
  const failed = [];

  for (const leadId of leadIds) {
    try {
      // Get lead
      const lead = await getLead(leadId, orgId);

      if (lead.converted_to_restaurant_id) {
        failed.push({
          lead_id: leadId,
          error: 'Lead already converted'
        });
        continue;
      }

      // Generate slug
      const baseSlug = lead.restaurant_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const orgSuffix = orgId.substring(0, 8);
      const slug = `${baseSlug}-${orgSuffix}`;

      // Determine address based on user selection
      let address;
      switch (address_source) {
        case 'ubereats':
          address = lead.ubereats_address;
          break;
        case 'google':
          address = lead.google_address;
          break;
        case 'auto':
        default:
          address = lead.ubereats_address || lead.google_address;
          break;
      }

      // Build ordering platform URL field
      const platformColumn = getOrderingPlatformColumn(lead.ordering_platform_name);
      const orderingPlatformFields = {};
      if (platformColumn && lead.ordering_platform_url) {
        orderingPlatformFields[platformColumn] = lead.ordering_platform_url;
      }

      // Calculate ICP rating
      const icpRating = calculateIcpRating(lead);

      // Create restaurant with all field mappings
      const { data: restaurant, error: restaurantError } = await client
        .from('restaurants')
        .insert({
          // Basic info
          name: lead.restaurant_name,
          slug,
          organisation_id: orgId,
          phone: lead.phone,
          email: lead.email,
          address,
          city: lead.city,

          // URLs
          website_url: lead.website_url,
          instagram_url: lead.instagram_url,
          facebook_url: lead.facebook_url,
          ubereats_url: lead.store_link,
          ...orderingPlatformFields,

          // Contact info
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          contact_phone: lead.contact_phone,
          contact_role: lead.contact_role,

          // Business details
          cuisine: lead.ubereats_cuisine || [],
          opening_hours: convertOpeningHoursFormat(lead.opening_hours),
          opening_hours_text: lead.opening_hours_text,
          website_type: lead.website_type,
          online_ordering_platform: lead.ordering_platform_name,
          ubereats_og_image: lead.ubereats_og_image,

          // Sales pipeline fields (outbound cold lead defaults)
          lead_type: 'outbound',
          lead_category: 'cold_outreach',
          lead_warmth: 'frozen',
          lead_stage: 'uncontacted',
          lead_status: 'inactive',
          icp_rating: icpRating,

          // Metadata
          metadata: {
            converted_from_lead: leadId,
            source: `lead_scrape_${lead.platform}`,
            ubereats_reviews: lead.ubereats_number_of_reviews,
            ubereats_rating: lead.ubereats_average_review_rating,
            google_reviews: lead.google_number_of_reviews,
            google_rating: lead.google_average_review_rating,
            google_maps_url: lead.google_maps_url,
            region: lead.region,
            country: lead.country
          }
        })
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Update lead with conversion info
      await client
        .from('leads')
        .update({
          converted_to_restaurant_id: restaurant.id,
          converted_at: new Date().toISOString(),
          converted_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      converted.push({
        lead_id: leadId,
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name
      });
    } catch (error) {
      console.error(`[LeadScrapeService] Error converting lead ${leadId}:`, error);
      failed.push({
        lead_id: leadId,
        error: error.message
      });
    }
  }

  const result = {
    converted,
    failed,
    summary: {
      total: leadIds.length,
      converted: converted.length,
      failed: failed.length
    }
  };

  // Create registration batch if requested and we have converted restaurants
  if (create_registration_batch && converted.length > 0) {
    try {
      const registrationBatchService = require('./registration-batch-service');

      const restaurantIds = converted.map(c => c.restaurant_id);
      const batchJobName = batch_name || `Batch from Lead Conversion ${new Date().toISOString().split('T')[0]}`;

      const batchResult = await registrationBatchService.createRegistrationBatchJob({
        name: batchJobName,
        restaurant_ids: restaurantIds,
        organisation_id: orgId,
        source_lead_scrape_job_id,
        created_by: userId
      });

      result.registration_batch = {
        id: batchResult.batch_job.id,
        name: batchResult.batch_job.name,
        status: batchResult.batch_job.status,
        total_restaurants: batchResult.batch_job.total_restaurants
      };

      console.log(`[LeadScrapeService] Created registration batch ${batchResult.batch_job.id} for ${restaurantIds.length} restaurants`);
    } catch (batchError) {
      console.error('[LeadScrapeService] Failed to create registration batch:', batchError);
      result.registration_batch_error = batchError.message;
    }
  }

  return result;
}

/**
 * Delete leads
 * @param {Array<string>} leadIds - Lead IDs to delete
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} Delete count
 */
async function deleteLeads(leadIds, orgId) {
  const client = getSupabaseClient();

  try {
    // Get job IDs for org
    const { data: jobs } = await client
      .from('lead_scrape_jobs')
      .select('id')
      .eq('organisation_id', orgId);

    const jobIds = jobs?.map(j => j.id) || [];

    const { data, error } = await client
      .from('leads')
      .delete()
      .in('id', leadIds)
      .in('lead_scrape_job_id', jobIds)
      .select();

    if (error) throw error;

    return {
      deleted_count: data?.length || 0
    };
  } catch (error) {
    console.error('[LeadScrapeService] Error deleting leads:', error);
    throw error;
  }
}

/**
 * Get cuisines for dropdown
 * @returns {Promise<Array>} Cuisine list with display_name and slug
 */
async function getCuisines() {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('ubereats_cuisines')
      .select('id, display_name, slug')
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[LeadScrapeService] Error getting cuisines:', error);
    throw error;
  }
}

/**
 * Get city codes
 * @param {string} country - Country code (nz, au)
 * @returns {Promise<Array>} City codes
 */
async function getCityCodes(country = null) {
  const client = getSupabaseClient();

  try {
    let query = client
      .from('city_codes')
      .select('*')
      .eq('is_active', true)
      .order('city_name', { ascending: true });

    if (country) {
      query = query.eq('country', country);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[LeadScrapeService] Error getting city codes:', error);
    throw error;
  }
}

module.exports = {
  // Job operations
  listLeadScrapeJobs,
  getLeadScrapeJob,
  createLeadScrapeJob,
  updateLeadScrapeJob,
  deleteLeadScrapeJob,
  startLeadScrapeJob,
  cancelLeadScrapeJob,

  // Step operations
  getJobStep,
  triggerStepProcessing,
  passLeadsToNextStep,
  retryFailedLeads,

  // Lead operations
  getPendingLeads,
  getPendingLeadsFilterOptions,
  getLead,
  updateLead,
  convertLeadsToRestaurants,
  deleteLeads,

  // Utility
  getCuisines,
  getCityCodes,
  getStepDefinitions,
  buildUberEatsCategoryUrl
};
