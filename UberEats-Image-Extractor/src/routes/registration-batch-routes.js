/**
 * Registration Batch Routes
 * API routes for registration batch orchestration
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const registrationBatchService = require('../services/registration-batch-service');
const companiesOfficeBatchService = require('../services/companies-office-batch-service');

// ============================================================================
// REGISTRATION BATCH JOB ENDPOINTS
// ============================================================================

/**
 * GET /api/registration-batches
 * List all registration batch jobs with filtering
 * Query params:
 *   - search: string (search by batch name)
 *   - status: string (comma-separated: pending,in_progress,completed,failed,cancelled)
 *   - limit: number (default: 20)
 *   - offset: number (default: 0)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset
    };

    // Remove undefined values
    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    );

    const result = await registrationBatchService.listRegistrationBatchJobs(
      filters,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error listing batch jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/registration-batches/:id
 * Get a single registration batch job with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await registrationBatchService.getRegistrationBatchJob(
      req.params.id,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error fetching batch job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches
 * Create a new registration batch job
 * Body:
 *   - name: string (required)
 *   - restaurant_ids: string[] (required)
 *   - source_lead_scrape_job_id: string (optional)
 *   - execution_config: object (optional - default config for all jobs)
 *   - auto_start: boolean (optional - default: false)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: name'
      });
    }

    if (!req.body.restaurant_ids || !Array.isArray(req.body.restaurant_ids) || req.body.restaurant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'restaurant_ids array is required and must not be empty'
      });
    }

    const result = await registrationBatchService.createRegistrationBatchJob({
      name: req.body.name,
      restaurant_ids: req.body.restaurant_ids,
      organisation_id: req.user.organisationId,
      source_lead_scrape_job_id: req.body.source_lead_scrape_job_id,
      execution_config: req.body.execution_config,
      created_by: req.user.id
    });

    // Auto-start if requested
    if (req.body.auto_start) {
      try {
        await registrationBatchService.startBatchJob(
          result.batch_job.id,
          req.user.organisationId
        );
        result.batch_job.status = 'in_progress';
        result.auto_started = true;
      } catch (startError) {
        console.error('[RegistrationBatchRoutes] Failed to auto-start batch:', startError.message);
        result.auto_start_error = startError.message;
      }
    }

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error creating batch job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/:id/start
 * Start a registration batch job (triggers Step 1 processing)
 */
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const result = await registrationBatchService.startBatchJob(
      req.params.id,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error starting batch job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Cannot start') || error.message.includes('already')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/:id/cancel
 * Cancel a running registration batch job
 */
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const result = await registrationBatchService.cancelBatchJob(
      req.params.id,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error cancelling batch job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Cannot cancel')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/registration-batches/:id/progress
 * Get lightweight progress info for polling
 */
router.get('/:id/progress', authMiddleware, async (req, res) => {
  try {
    const result = await registrationBatchService.getBatchProgress(
      req.params.id,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error fetching batch progress:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/:id/mark-extractions-executed
 * Mark registration jobs as having extractions executed on creation
 * This prevents Step 1 from re-triggering extractions when batch starts
 * Body:
 *   - restaurant_ids: string[] (required) - Restaurant IDs that had extractions started
 */
router.post('/:id/mark-extractions-executed', authMiddleware, async (req, res) => {
  try {
    const { restaurant_ids } = req.body;

    if (!restaurant_ids || !Array.isArray(restaurant_ids) || restaurant_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'restaurant_ids array is required' });
    }

    const result = await registrationBatchService.markExtractionsExecutedOnCreation(
      req.params.id,
      restaurant_ids,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error marking extractions executed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// STEP MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/registration-batches/:id/steps/:stepNumber
 * Get step data for a specific step (includes per-restaurant status and candidates)
 */
router.get('/:id/steps/:stepNumber', authMiddleware, async (req, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number. Must be 1-6.'
      });
    }

    // Get full batch details
    const batchResult = await registrationBatchService.getRegistrationBatchJob(
      req.params.id,
      req.user.organisationId
    );

    // Get step definitions
    const stepDefs = registrationBatchService.getRegistrationStepDefinitions();
    const stepDef = stepDefs.find(s => s.step_number === stepNumber);

    // Get step status for each restaurant
    const restaurants = batchResult.registration_jobs.map(job => {
      const step = job.steps.find(s => s.step_number === stepNumber);
      return {
        job_id: job.id,
        restaurant_id: job.restaurant_id,
        restaurant_name: job.restaurant?.name,
        restaurant_address: job.restaurant?.address,
        restaurant_city: job.restaurant?.city,
        step_status: step?.status || 'pending',
        step_result: step?.result_data,
        step_error: step?.error_message
      };
    });

    // For Step 3, include company candidates
    let candidates = null;
    if (stepNumber === 3) {
      candidates = await companiesOfficeBatchService.getBatchSearchCandidates(req.params.id);
    }

    // Calculate summary
    const summary = {
      total: restaurants.length,
      pending: restaurants.filter(r => r.step_status === 'pending').length,
      in_progress: restaurants.filter(r => r.step_status === 'in_progress').length,
      action_required: restaurants.filter(r => r.step_status === 'action_required').length,
      completed: restaurants.filter(r => r.step_status === 'completed').length,
      failed: restaurants.filter(r => r.step_status === 'failed').length,
      skipped: restaurants.filter(r => r.step_status === 'skipped').length
    };

    res.json({
      success: true,
      step_number: stepNumber,
      step_name: stepDef?.step_name,
      step_type: stepDef?.step_type,
      step_description: stepDef?.step_description,
      restaurants,
      candidates,
      summary
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error fetching step data:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/:id/steps/:stepNumber/complete
 * Complete an action_required step with user selections/configurations
 *
 * For Step 3 (Company Selection):
 * Body: { selections: { job_id: { company_number: "123" | null, no_match: bool } } }
 *
 * For Step 5 (Yolo Configuration):
 * Body: { configurations: { job_id: { email, password, steps_enabled, use_defaults, ... } } }
 */
router.post('/:id/steps/:stepNumber/complete', authMiddleware, async (req, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    if (isNaN(stepNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number'
      });
    }

    let result;

    switch (stepNumber) {
      case 3:
        // Company Selection
        if (!req.body.selections || typeof req.body.selections !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'selections object is required for Step 3'
          });
        }

        result = await registrationBatchService.completeStep3(
          req.params.id,
          req.body.selections,
          req.user.organisationId
        );
        break;

      case 5:
        // Yolo Configuration (supports selective execution via selectedJobIds)
        if (!req.body.configurations || typeof req.body.configurations !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'configurations object is required for Step 5'
          });
        }

        // selectedJobIds is optional - if not provided, all jobs in configurations will be processed
        const selectedJobIds = Array.isArray(req.body.selectedJobIds) ? req.body.selectedJobIds : null;

        // Extract auth context for server-to-server calls during Step 6 execution
        const authContext = {
          token: req.headers.authorization?.replace('Bearer ', ''),
          organisationId: req.user.organisationId,
        };

        result = await registrationBatchService.completeStep5(
          req.params.id,
          req.body.configurations,
          req.user.organisationId,
          selectedJobIds,
          authContext
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Step ${stepNumber} is not an action_required step`
        });
    }

    res.json({
      success: true,
      ...result,
      message: result.auto_processing
        ? `Updated ${result.updated} jobs. Auto-processing next step.`
        : `Updated ${result.updated} jobs.`
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error completing step:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// INDIVIDUAL JOB ENDPOINTS
// ============================================================================

/**
 * GET /api/registration-batches/jobs/:jobId
 * Get a single registration job with full step details
 */
router.get('/jobs/:jobId', authMiddleware, async (req, res) => {
  try {
    const { getSupabaseClient } = require('../services/database-service');
    const client = getSupabaseClient();

    const { data: job, error } = await client
      .from('registration_jobs')
      .select(`
        *,
        restaurant:restaurants(id, name, address, city, email, phone),
        steps:registration_job_steps(*)
      `)
      .eq('id', req.params.jobId)
      .eq('organisation_id', req.user.organisationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Registration job not found'
        });
      }
      throw error;
    }

    // Sort steps by step_number
    job.steps = (job.steps || []).sort((a, b) => a.step_number - b.step_number);

    res.json({ success: true, job });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error fetching job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/jobs/:jobId/retry
 * Retry a failed registration job from a specific step
 * Body:
 *   - from_step: number (optional - defaults to current failed step)
 */
router.post('/jobs/:jobId/retry', authMiddleware, async (req, res) => {
  try {
    const { getSupabaseClient } = require('../services/database-service');
    const client = getSupabaseClient();

    // Get the job
    const { data: job, error: jobError } = await client
      .from('registration_jobs')
      .select('*, steps:registration_job_steps(*)')
      .eq('id', req.params.jobId)
      .eq('organisation_id', req.user.organisationId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({
        success: false,
        error: 'Registration job not found'
      });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Can only retry failed jobs'
      });
    }

    // Find the step to retry from
    const fromStep = req.body.from_step || job.current_step;
    const failedStep = job.steps.find(s => s.step_number === fromStep);

    if (!failedStep) {
      return res.status(400).json({
        success: false,
        error: `Step ${fromStep} not found`
      });
    }

    // Reset the step and job status
    await client
      .from('registration_job_steps')
      .update({
        status: 'pending',
        error_message: null,
        retry_count: (failedStep.retry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', failedStep.id);

    await client
      .from('registration_jobs')
      .update({
        status: 'in_progress',
        error_message: null,
        current_step: fromStep,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Trigger re-processing based on step
    res.json({
      success: true,
      message: `Retrying job from step ${fromStep}`,
      job_id: job.id,
      from_step: fromStep
    });

    // Run retry in background
    setImmediate(async () => {
      try {
        switch (fromStep) {
          case 1:
            await registrationBatchService.processStep1(job.batch_job_id);
            break;
          case 2:
            await registrationBatchService.processStep2(job.batch_job_id);
            break;
          case 4:
            await registrationBatchService.processStep4(job.batch_job_id);
            break;
          case 6:
            await registrationBatchService.processStep6(job.batch_job_id);
            break;
          default:
            console.log(`[RegistrationBatchRoutes] Step ${fromStep} requires manual action`);
        }
      } catch (retryError) {
        console.error('[RegistrationBatchRoutes] Retry failed:', retryError);
      }
    });

  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error retrying job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// COMPANY SELECTION ENDPOINTS (Step 3 helpers)
// ============================================================================

/**
 * GET /api/registration-batches/:id/candidates
 * Get all company search candidates for a batch (for Step 3 UI)
 */
router.get('/:id/candidates', authMiddleware, async (req, res) => {
  try {
    const candidates = await companiesOfficeBatchService.getBatchSearchCandidates(req.params.id);

    res.json({
      success: true,
      candidates,
      summary: {
        total: candidates.length,
        awaiting_selection: candidates.filter(c => c.status === 'awaiting_selection').length,
        selected: candidates.filter(c => c.status === 'selected').length,
        no_match: candidates.filter(c => c.status === 'no_match').length
      }
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error fetching candidates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/jobs/:jobId/retry-search
 * Retry Companies Office search for a single job with custom parameters
 * Body:
 *   - restaurant_name: string (optional - custom name to search)
 *   - street: string (optional - custom street address)
 *   - city: string (optional - custom city)
 */
router.post('/jobs/:jobId/retry-search', authMiddleware, async (req, res) => {
  try {
    const result = await registrationBatchService.retryStep2ForJob(
      req.params.jobId,
      {
        restaurant_name: req.body.restaurant_name,
        street: req.body.street,
        city: req.body.city
      },
      req.user.organisationId
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error retrying search:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Cannot retry')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/:id/candidates/:restaurantId/select
 * Select a company for a specific restaurant (individual selection)
 * Body:
 *   - company_number: string | null (null = no match)
 */
router.post('/:id/candidates/:restaurantId/select', authMiddleware, async (req, res) => {
  try {
    const result = await companiesOfficeBatchService.selectCompany(
      req.params.restaurantId,
      null, // Will look up job from restaurant
      req.body.company_number
    );

    res.json({
      success: true,
      result,
      message: req.body.company_number
        ? `Selected company ${req.body.company_number}`
        : 'Marked as no match'
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error selecting company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/registration-batches/jobs/:jobId/skip-with-manual-entry
 * Skip Companies Office search and manually enter contact details
 * Body:
 *   - contact_name: string (required) - Contact/owner name
 *   - full_legal_name: string (optional) - Full legal name if different
 *   - contact_email: string (optional) - Contact email
 *   - contact_phone: string (optional) - Contact phone
 *   - company_name: string (optional) - Company legal name
 *   - company_number: string (optional) - Company registration number
 *   - gst_number: string (optional) - GST number
 *   - nzbn: string (optional) - NZ Business Number
 */
router.post('/jobs/:jobId/skip-with-manual-entry', authMiddleware, async (req, res) => {
  try {
    const {
      contact_name,
      full_legal_name,
      contact_email,
      contact_phone,
      company_name,
      company_number,
      gst_number,
      nzbn
    } = req.body;

    if (!contact_name) {
      return res.status(400).json({
        success: false,
        error: 'Contact name is required'
      });
    }

    const result = await registrationBatchService.skipWithManualEntry(
      req.params.jobId,
      {
        contact_name,
        full_legal_name,
        contact_email,
        contact_phone,
        company_name,
        company_number,
        gst_number,
        nzbn
      },
      req.user.organisationId
    );

    res.json({
      success: true,
      ...result,
      message: 'Contact details saved and Companies Office steps skipped'
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error with manual entry:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// RESTAURANT DATA UPDATE (Issue 14)
// ============================================================================

/**
 * PATCH /api/registration-batches/jobs/:jobId/restaurant
 * Update restaurant data from Yolo Mode configuration tabs
 * Only updates allowed fields (email, phone, name, theme, colors, contact info)
 *
 * Body:
 *   - email: string (optional)
 *   - phone: string (optional)
 *   - user_password_hint: string (optional)
 *   - name: string (optional)
 *   - theme: 'light' | 'dark' (optional)
 *   - cuisine: string | string[] (optional)
 *   - primary_color: string (optional)
 *   - secondary_color: string (optional)
 *   - contact_name: string (optional)
 *   - contact_email: string (optional)
 */
router.patch('/jobs/:jobId/restaurant', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No update data provided'
      });
    }

    const restaurant = await registrationBatchService.updateRestaurantFromConfig(
      req.params.jobId,
      updates,
      req.user.organisationId
    );

    res.json({
      success: true,
      restaurant,
      message: 'Restaurant data updated successfully'
    });
  } catch (error) {
    console.error('[RegistrationBatchRoutes] Error updating restaurant:', error);
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('No valid fields')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
