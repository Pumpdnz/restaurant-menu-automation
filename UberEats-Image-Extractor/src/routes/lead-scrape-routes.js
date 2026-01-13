/**
 * Lead Scrape Routes
 * API routes for lead scraping operations
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const {
  requireLeadScrapingJobs,
  requireLeadScrapingEnrichment
} = require('../../middleware/feature-flags');
const leadScrapeService = require('../services/lead-scrape-service');
const leadScrapeFirecrawlService = require('../services/lead-scrape-firecrawl-service');
const { UsageTrackingService } = require('../services/usage-tracking-service');

// ============================================================================
// LEAD SCRAPE JOBS ENDPOINTS
// ============================================================================

/**
 * GET /api/lead-scrape-jobs
 * List all lead scrape jobs with filtering
 * Query params:
 *   - search: string (search by job name)
 *   - status: string (comma-separated: draft,pending,in_progress,completed,cancelled,failed)
 *   - platform: string (ubereats, doordash, etc.)
 *   - city: string
 *   - cuisine: string
 *   - current_step: string (comma-separated: 1,2,3,4,5)
 *   - started_after: ISO date
 *   - started_before: ISO date
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      platform: req.query.platform,
      city: req.query.city,
      cuisine: req.query.cuisine,
      current_step: req.query.current_step,
      started_after: req.query.started_after,
      started_before: req.query.started_before,
      limit: req.query.limit,
      offset: req.query.offset
    };

    // Remove undefined values
    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    );

    const result = await leadScrapeService.listLeadScrapeJobs(filters, req.user.organisationId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing lead scrape jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/:id
 * Get a single lead scrape job with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const job = await leadScrapeService.getLeadScrapeJob(req.params.id, req.user.organisationId);
    res.json({ success: true, job });
  } catch (error) {
    console.error('Error fetching lead scrape job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lead-scrape-jobs
 * Create a new lead scrape job
 * Body:
 *   - platform: string (required)
 *   - country: string (default: 'nz')
 *   - city: string (required)
 *   - cuisine: string (required)
 *   - leads_limit: number (default: 21)
 *   - page_offset: number (default: 1)
 *   - save_as_draft: boolean (default: false)
 * Protected by leadScraping.scrapeJobs feature flag
 */
router.post('/', authMiddleware, requireLeadScrapingJobs, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.platform) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: platform'
      });
    }

    if (!req.body.city) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: city'
      });
    }

    if (!req.body.cuisine) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: cuisine'
      });
    }

    let job = await leadScrapeService.createLeadScrapeJob(
      req.body,
      req.user.organisationId,
      req.user.id
    );

    // Track job creation (async, don't await)
    UsageTrackingService.trackLeadScrapeJobCreated(req.user.organisationId, {
      job_id: job.id,
      platform: req.body.platform,
      city: req.body.city,
      cuisine: req.body.cuisine
    }).catch(err => console.error('[UsageTracking] Failed to track job creation:', err));

    // Auto-start if not saved as draft
    if (!req.body.save_as_draft && job.status === 'pending') {
      try {
        job = await leadScrapeService.startLeadScrapeJob(job.id, req.user.organisationId);
        console.log(`[LeadScrapeRoutes] Auto-started job ${job.id}`);

        // Return response immediately
        res.status(201).json({ success: true, job });

        // Auto-trigger step 1 extraction (runs in background)
        console.log(`[LeadScrapeRoutes] Job data for step 1 (from create):`, JSON.stringify({
          id: job.id,
          country: job.country,
          city_code: job.city_code,
          region_code: job.region_code,
          cuisine: job.cuisine,
          page_offset: job.page_offset,
          platform: job.platform,
          status: job.status
        }, null, 2));

        setImmediate(async () => {
          try {
            console.log(`[LeadScrapeRoutes] Auto-triggering step 1 for job ${job.id} (from create)`);
            const step1Result = await leadScrapeFirecrawlService.processStep1(job.id, job);
            console.log(`[LeadScrapeRoutes] Step 1 auto-extraction completed:`, step1Result);
          } catch (step1Error) {
            console.error(`[LeadScrapeRoutes] Step 1 auto-extraction failed:`, step1Error.message);
            console.error(`[LeadScrapeRoutes] Full error:`, step1Error);
          }
        });
        return; // Response already sent
      } catch (startError) {
        console.error(`[LeadScrapeRoutes] Failed to auto-start job ${job.id}:`, startError.message);
        // Still return the created job even if auto-start failed
      }
    }

    res.status(201).json({ success: true, job });
  } catch (error) {
    console.error('Error creating lead scrape job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/lead-scrape-jobs/:id
 * Update a draft lead scrape job
 * Body (all optional):
 *   - city: string
 *   - city_code: string
 *   - region_code: string
 *   - cuisine: string
 *   - leads_limit: number
 *   - page_offset: number
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const job = await leadScrapeService.updateLeadScrapeJob(
      req.params.id,
      req.body,
      req.user.organisationId
    );
    res.json({ success: true, job });
  } catch (error) {
    console.error('Error updating lead scrape job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Can only update')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/lead-scrape-jobs/:id
 * Delete a lead scrape job and all associated data
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await leadScrapeService.deleteLeadScrapeJob(req.params.id, req.user.organisationId);
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead scrape job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LEAD SCRAPE JOB ACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/lead-scrape-jobs/:id/start
 * Start a draft lead scrape job and auto-trigger step 1 extraction
 */
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const job = await leadScrapeService.startLeadScrapeJob(req.params.id, req.user.organisationId);

    // Return response immediately
    res.json({ success: true, job });

    // Auto-trigger step 1 extraction (runs in background)
    console.log(`[LeadScrapeRoutes] Job data for step 1:`, JSON.stringify({
      id: job.id,
      country: job.country,
      city_code: job.city_code,
      region_code: job.region_code,
      cuisine: job.cuisine,
      page_offset: job.page_offset,
      platform: job.platform,
      status: job.status
    }, null, 2));

    setImmediate(async () => {
      try {
        console.log(`[LeadScrapeRoutes] Auto-triggering step 1 for job ${job.id}`);
        const step1Result = await leadScrapeFirecrawlService.processStep1(job.id, job);
        console.log(`[LeadScrapeRoutes] Step 1 auto-extraction completed:`, step1Result);
      } catch (step1Error) {
        console.error(`[LeadScrapeRoutes] Step 1 auto-extraction failed:`, step1Error.message);
        console.error(`[LeadScrapeRoutes] Full error:`, step1Error);
      }
    });
  } catch (error) {
    console.error('Error starting lead scrape job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Can only start')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lead-scrape-jobs/:id/cancel
 * Cancel a lead scrape job
 */
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const job = await leadScrapeService.cancelLeadScrapeJob(req.params.id, req.user.organisationId);
    res.json({ success: true, job });
  } catch (error) {
    console.error('Error cancelling lead scrape job:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Can only cancel')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/lead-scrape-jobs/:id/status
 * Update job status directly
 * Body:
 *   - status: string (draft, pending, in_progress, completed, cancelled, failed)
 */
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'pending', 'in_progress', 'completed', 'cancelled', 'failed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const job = await leadScrapeService.updateJobStatus(
      req.params.id,
      status,
      req.user.organisationId
    );
    res.json({ success: true, job });
  } catch (error) {
    console.error('Error updating job status:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LEAD SCRAPE JOB STEPS ENDPOINTS
// ============================================================================

/**
 * GET /api/lead-scrape-jobs/:jobId/steps/:stepNumber
 * Get a specific step with its leads
 */
router.get('/:jobId/steps/:stepNumber', authMiddleware, async (req, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    if (isNaN(stepNumber) || stepNumber < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number'
      });
    }

    const result = await leadScrapeService.getJobStep(
      req.params.jobId,
      stepNumber,
      req.user.organisationId
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching step:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LEAD SCRAPE JOB STEP ACTION ENDPOINTS
// Base path: /api/lead-scrape-job-steps
// ============================================================================

/**
 * POST /api/lead-scrape-job-steps/:stepId/process
 * Trigger processing for a step
 * - For automatic steps: initiates Firecrawl extraction
 * - For action_required steps: marks ready for manual processing
 * Protected by leadScraping.stepEnrichment feature flag
 */
router.post('/steps/:stepId/process', authMiddleware, requireLeadScrapingEnrichment, async (req, res) => {
  try {
    const result = await leadScrapeService.triggerStepProcessing(
      req.params.stepId,
      req.user.organisationId
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering step processing:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('must be') ||
        error.message.includes('already') ||
        error.message.includes('No leads')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lead-scrape-job-steps/:stepId/pass-leads
 * Pass selected leads to the next step and auto-trigger processing
 * Body:
 *   - lead_ids: string[] (required)
 *   - auto_process: boolean (optional, default: true) - whether to auto-trigger processing
 */
router.post('/steps/:stepId/pass-leads', authMiddleware, async (req, res) => {
  try {
    if (!req.body.lead_ids || !Array.isArray(req.body.lead_ids) || req.body.lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'lead_ids array is required and must not be empty'
      });
    }

    const autoProcess = req.body.auto_process !== false; // Default to true

    const result = await leadScrapeService.passLeadsToNextStep(
      req.params.stepId,
      req.body.lead_ids,
      req.user.organisationId,
      autoProcess
    );

    // Return response immediately
    res.json({
      success: true,
      ...result,
      message: result.auto_process
        ? `Passed ${result.passed_count} leads to step ${result.next_step_number}. Auto-processing started.`
        : `Passed ${result.passed_count} leads${result.is_last_step ? ' (final step)' : ''}`
    });

    // Auto-trigger processing for the next step if enabled and leads were passed
    if (result.auto_process && result.passed_lead_ids.length > 0) {
      setImmediate(async () => {
        try {
          console.log(`[LeadScrapeRoutes] Auto-triggering step ${result.next_step_number} processing for ${result.passed_lead_ids.length} leads`);

          let processResult;
          switch (result.next_step_number) {
            case 2:
              processResult = await leadScrapeFirecrawlService.processStep2(result.job_id, result.passed_lead_ids);
              break;
            case 3:
              processResult = await leadScrapeFirecrawlService.processStep3(result.job_id, result.passed_lead_ids);
              break;
            case 4:
              processResult = await leadScrapeFirecrawlService.processStep4(result.job_id, result.passed_lead_ids);
              break;
            default:
              console.log(`[LeadScrapeRoutes] No processor for step ${result.next_step_number}`);
              return;
          }

          console.log(`[LeadScrapeRoutes] Step ${result.next_step_number} auto-processing completed:`, processResult);
        } catch (processError) {
          console.error(`[LeadScrapeRoutes] Step ${result.next_step_number} auto-processing failed:`, processError.message);
        }
      });
    }
  } catch (error) {
    console.error('Error passing leads:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lead-scrape-job-steps/:stepId/retry
 * Retry failed leads in a step
 * Body:
 *   - lead_ids: string[] (required)
 */
router.post('/steps/:stepId/retry', authMiddleware, async (req, res) => {
  try {
    if (!req.body.lead_ids || !Array.isArray(req.body.lead_ids) || req.body.lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'lead_ids array is required and must not be empty'
      });
    }

    const result = await leadScrapeService.retryFailedLeads(
      req.params.stepId,
      req.body.lead_ids,
      req.user.organisationId
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error retrying leads:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FIRECRAWL EXTRACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/lead-scrape-jobs/:jobId/extract/:stepNumber
 * Trigger Firecrawl extraction for a specific step
 * This is an async operation - returns immediately while extraction runs
 * Body (optional):
 *   - lead_ids: string[] - specific leads to process (for steps 2-5)
 * Protected by leadScraping.stepEnrichment feature flag
 */
router.post('/:jobId/extract/:stepNumber', authMiddleware, requireLeadScrapingEnrichment, async (req, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 4) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number. Must be 1-4.'
      });
    }

    // Get job to verify access and get job data
    const job = await leadScrapeService.getLeadScrapeJob(
      req.params.jobId,
      req.user.organisationId
    );

    if (job.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Job must be in_progress to run extractions'
      });
    }

    // Get the step
    const stepResult = await leadScrapeService.getJobStep(
      req.params.jobId,
      stepNumber,
      req.user.organisationId
    );

    if (stepResult.step.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Step is already completed'
      });
    }

    // Run extraction based on step number
    let extractionResult;
    const leadIds = req.body.lead_ids || null;

    // Start extraction (runs in background for long operations)
    res.json({
      success: true,
      message: `Started extraction for step ${stepNumber}`,
      step: stepResult.step,
      job_id: req.params.jobId
    });

    // Run extraction after response (non-blocking)
    setImmediate(async () => {
      try {
        switch (stepNumber) {
          case 1:
            extractionResult = await leadScrapeFirecrawlService.processStep1(req.params.jobId, job);
            break;
          case 2:
            extractionResult = await leadScrapeFirecrawlService.processStep2(req.params.jobId, leadIds);
            break;
          case 3:
            extractionResult = await leadScrapeFirecrawlService.processStep3(req.params.jobId, leadIds);
            break;
          case 4:
            extractionResult = await leadScrapeFirecrawlService.processStep4(req.params.jobId, leadIds);
            break;
        }
        console.log(`[LeadScrapeRoutes] Step ${stepNumber} extraction completed:`, extractionResult);
      } catch (error) {
        console.error(`[LeadScrapeRoutes] Step ${stepNumber} extraction failed:`, error);
      }
    });

  } catch (error) {
    console.error('Error triggering extraction:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lead-scrape-jobs/:jobId/extract/:stepNumber/sync
 * Trigger Firecrawl extraction synchronously (waits for completion)
 * Use for smaller extractions or when you need immediate results
 * Body (optional):
 *   - lead_ids: string[] - specific leads to process (for steps 2-5)
 * Protected by leadScraping.stepEnrichment feature flag
 */
router.post('/:jobId/extract/:stepNumber/sync', authMiddleware, requireLeadScrapingEnrichment, async (req, res) => {
  try {
    const stepNumber = parseInt(req.params.stepNumber);
    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 4) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number. Must be 1-4.'
      });
    }

    // Get job to verify access and get job data
    const job = await leadScrapeService.getLeadScrapeJob(
      req.params.jobId,
      req.user.organisationId
    );

    if (job.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Job must be in_progress to run extractions'
      });
    }

    // Run extraction based on step number
    let extractionResult;
    const leadIds = req.body.lead_ids || null;

    switch (stepNumber) {
      case 1:
        extractionResult = await leadScrapeFirecrawlService.processStep1(req.params.jobId, job);
        break;
      case 2:
        extractionResult = await leadScrapeFirecrawlService.processStep2(req.params.jobId, leadIds);
        break;
      case 3:
        extractionResult = await leadScrapeFirecrawlService.processStep3(req.params.jobId, leadIds);
        break;
      case 4:
        extractionResult = await leadScrapeFirecrawlService.processStep4(req.params.jobId, leadIds);
        break;
    }

    res.json({
      success: true,
      message: `Completed extraction for step ${stepNumber}`,
      result: extractionResult,
      job_id: req.params.jobId
    });

  } catch (error) {
    console.error('Error in sync extraction:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/lead-scrape-jobs/:jobId/validate-leads
 * Validate leads and check for duplicates
 * Body:
 *   - lead_ids: string[] (optional - validates all if not provided)
 *   - step_number: number (required)
 */
router.post('/:jobId/validate-leads', authMiddleware, async (req, res) => {
  try {
    const { lead_ids, step_number } = req.body;

    if (!step_number || step_number < 1 || step_number > 4) {
      return res.status(400).json({
        success: false,
        error: 'step_number is required and must be 1-4'
      });
    }

    // Get job to verify access
    const job = await leadScrapeService.getLeadScrapeJob(
      req.params.jobId,
      req.user.organisationId
    );

    // Get leads to validate
    const stepResult = await leadScrapeService.getJobStep(
      req.params.jobId,
      step_number,
      req.user.organisationId
    );

    let leadsToValidate = stepResult.leads;
    if (lead_ids && lead_ids.length > 0) {
      leadsToValidate = leadsToValidate.filter(l => lead_ids.includes(l.id));
    }

    const validationResults = [];
    for (const lead of leadsToValidate) {
      const validation = leadScrapeFirecrawlService.validateLeadForStep(lead, step_number);
      const duplicateCheck = await leadScrapeFirecrawlService.checkForDuplicates(
        lead,
        req.params.jobId,
        req.user.organisationId
      );

      validationResults.push({
        lead_id: lead.id,
        restaurant_name: lead.restaurant_name,
        ...validation,
        ...duplicateCheck
      });
    }

    const validCount = validationResults.filter(r => r.is_valid && !r.is_duplicate).length;
    const invalidCount = validationResults.filter(r => !r.is_valid).length;
    const duplicateCount = validationResults.filter(r => r.is_duplicate).length;

    res.json({
      success: true,
      results: validationResults,
      summary: {
        total: validationResults.length,
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount
      }
    });

  } catch (error) {
    console.error('Error validating leads:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

const leadScrapeAnalyticsService = require('../services/lead-scrape-analytics-service');

/**
 * GET /api/lead-scrape-jobs/analytics/summary
 * Get summary statistics for lead scraping
 * Query params:
 *   - startDate: ISO date (optional)
 *   - endDate: ISO date (optional)
 *   - platform: string (optional)
 */
router.get('/analytics/summary', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, platform } = req.query;

    const stats = await leadScrapeAnalyticsService.getSummaryStats(
      req.user.organisationId,
      { startDate, endDate, platform }
    );

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/coverage
 * Get coverage data grouped by city/cuisine
 * Query params:
 *   - startDate: ISO date (optional)
 *   - endDate: ISO date (optional)
 *   - platform: string (optional)
 *   - city: string (optional)
 *   - cuisine: string (optional)
 */
router.get('/analytics/coverage', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, platform, city, cuisine } = req.query;

    const coverage = await leadScrapeAnalyticsService.getCoverageByCity(
      req.user.organisationId,
      { startDate, endDate, platform, city, cuisine }
    );

    res.json({ success: true, data: coverage });
  } catch (error) {
    console.error('Error fetching coverage data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/heatmap
 * Get heatmap matrix data (city x cuisine)
 * Query params:
 *   - startDate: ISO date (optional)
 *   - endDate: ISO date (optional)
 *   - platform: string (optional)
 */
router.get('/analytics/heatmap', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, platform } = req.query;

    const heatmap = await leadScrapeAnalyticsService.getHeatmapMatrix(
      req.user.organisationId,
      { startDate, endDate, platform }
    );

    res.json({ success: true, data: heatmap });
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/opportunities
 * Get gap/opportunity analysis
 * Query params:
 *   - startDate: ISO date (optional)
 *   - endDate: ISO date (optional)
 *   - platform: string (optional)
 *   - minScore: number (optional, filter by minimum opportunity score)
 */
router.get('/analytics/opportunities', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, platform, minScore } = req.query;

    let opportunities = await leadScrapeAnalyticsService.getOpportunities(
      req.user.organisationId,
      { startDate, endDate, platform }
    );

    // Filter by minimum score if provided
    if (minScore) {
      opportunities = opportunities.filter(o => o.opportunity_score >= parseInt(minScore));
    }

    res.json({ success: true, data: opportunities });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/trends
 * Get activity trends over time
 * Query params:
 *   - timeframe: string (e.g., '7d', '30d', '90d')
 */
router.get('/analytics/trends', authMiddleware, async (req, res) => {
  try {
    const { timeframe } = req.query;

    const trends = await leadScrapeAnalyticsService.getActivityTrends(
      req.user.organisationId,
      { timeframe }
    );

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
