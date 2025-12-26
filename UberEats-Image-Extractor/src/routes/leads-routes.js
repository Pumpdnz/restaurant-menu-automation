/**
 * Leads Routes
 * API routes for lead management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { requireLeadScrapingConversion } = require('../../middleware/feature-flags');
const leadScrapeService = require('../services/lead-scrape-service');
const { UsageTrackingService } = require('../services/usage-tracking-service');

// ============================================================================
// LEADS ENDPOINTS
// ============================================================================

/**
 * GET /api/leads/pending
 * List pending leads (completed all steps, ready for conversion)
 * Query params:
 *   - search: string (search by restaurant name)
 *   - platform: string
 *   - city: string
 *   - cuisine: string
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 */
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      platform: req.query.platform,
      city: req.query.city,
      cuisine: req.query.cuisine,
      limit: req.query.limit,
      offset: req.query.offset
    };

    // Remove undefined values
    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    );

    const result = await leadScrapeService.getPendingLeads(filters, req.user.organisationId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching pending leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leads/pending/filter-options
 * Get available filter options for pending leads (unique cities and cuisines from jobs)
 * Returns only cities/cuisines from jobs that have pending leads
 */
router.get('/pending/filter-options', authMiddleware, async (req, res) => {
  try {
    const result = await leadScrapeService.getPendingLeadsFilterOptions(req.user.organisationId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching pending leads filter options:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leads/:id
 * Get a single lead with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const lead = await leadScrapeService.getLead(req.params.id, req.user.organisationId);
    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error fetching lead:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/leads/:id
 * Update a lead's information
 * Body (all optional):
 *   - restaurant_name: string
 *   - phone: string
 *   - email: string
 *   - website_url: string
 *   - instagram_url: string
 *   - facebook_url: string
 *   - google_maps_url: string
 *   - contact_name: string
 *   - contact_email: string
 *   - contact_phone: string
 *   - contact_role: string
 *   - organisation_name: string
 *   - city: string
 *   - region: string
 *   - opening_hours: object
 *   - opening_hours_text: string
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const lead = await leadScrapeService.updateLead(
      req.params.id,
      req.body,
      req.user.organisationId
    );
    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error updating lead:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/leads/convert
 * Convert selected leads to restaurants
 * Body:
 *   - lead_ids: string[] (required)
 *   - address_source: string (optional) - 'ubereats', 'google', or 'auto' (default)
 *   - create_registration_batch: boolean (optional) - Create a registration batch for Phase 2 orchestration
 *   - batch_name: string (optional) - Name for the registration batch
 *   - source_lead_scrape_job_id: string (optional) - Link to source lead scrape job
 * Protected by leadScraping.leadConversion feature flag
 */
router.post('/convert', authMiddleware, requireLeadScrapingConversion, async (req, res) => {
  try {
    if (!req.body.lead_ids || !Array.isArray(req.body.lead_ids) || req.body.lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'lead_ids array is required and must not be empty'
      });
    }

    if (req.body.lead_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 leads can be converted at once'
      });
    }

    // Validate address_source if provided
    const validAddressSources = ['ubereats', 'google', 'auto'];
    const addressSource = req.body.address_source || 'auto';
    if (!validAddressSources.includes(addressSource)) {
      return res.status(400).json({
        success: false,
        error: `Invalid address_source. Must be one of: ${validAddressSources.join(', ')}`
      });
    }

    const result = await leadScrapeService.convertLeadsToRestaurants(
      req.body.lead_ids,
      req.user.organisationId,
      req.user.id,
      {
        address_source: addressSource,
        create_registration_batch: req.body.create_registration_batch || false,
        batch_name: req.body.batch_name,
        source_lead_scrape_job_id: req.body.source_lead_scrape_job_id
      }
    );

    // Track lead conversions (only count successful conversions)
    if (result.summary.converted > 0) {
      UsageTrackingService.trackLeadsConverted(
        req.user.organisationId,
        result.summary.converted,
        {
          lead_ids: result.converted.map(r => r.lead_id),
          restaurant_ids: result.converted.map(r => r.restaurant_id)
        }
      ).catch(err => console.error('[UsageTracking] Failed to track lead conversions:', err));
    }

    // Determine status code
    let statusCode = 200;
    if (result.summary.converted > 0 && result.summary.failed > 0) {
      statusCode = 207; // Multi-Status (partial success)
    } else if (result.summary.failed > 0 && result.summary.converted === 0) {
      statusCode = 207; // Multi-Status (all failed, but operation completed)
    }

    res.status(statusCode).json({ success: true, ...result });
  } catch (error) {
    console.error('Error converting leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/leads
 * Delete multiple leads
 * Body:
 *   - lead_ids: string[] (required)
 */
router.delete('/', authMiddleware, async (req, res) => {
  try {
    if (!req.body.lead_ids || !Array.isArray(req.body.lead_ids) || req.body.lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'lead_ids array is required and must not be empty'
      });
    }

    const result = await leadScrapeService.deleteLeads(
      req.body.lead_ids,
      req.user.organisationId
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error deleting leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete a single lead
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await leadScrapeService.deleteLeads(
      [req.params.id],
      req.user.organisationId
    );

    if (result.deleted_count === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
