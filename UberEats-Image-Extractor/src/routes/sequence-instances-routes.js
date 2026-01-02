/**
 * Sequence Instances Routes
 * API routes for sequence instance management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const sequenceInstancesService = require('../services/sequence-instances-service');

/**
 * GET /api/sequence-instances
 * List all sequence instances with filtering
 * Query params:
 *   - restaurant_id: UUID
 *   - status: active|paused|completed|cancelled
 *   - assigned_to: UUID
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {};

    if (req.query.restaurant_id) {
      filters.restaurant_id = req.query.restaurant_id;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.assigned_to) {
      filters.assigned_to = req.query.assigned_to;
    }

    const instances = await sequenceInstancesService.listSequenceInstances(filters);
    res.json({ success: true, data: instances, count: instances.length });
  } catch (error) {
    console.error('Error listing sequence instances:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sequence-instances/:id
 * Get single sequence instance with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const instance = await sequenceInstancesService.getSequenceInstance(req.params.id);
    res.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error fetching sequence instance:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sequence-instances/batch/restaurants
 * Get sequences for multiple restaurants in one query
 * Query params:
 *   - restaurant_ids: comma-separated UUIDs (required)
 */
router.get('/batch/restaurants', authMiddleware, async (req, res) => {
  try {
    const { restaurant_ids } = req.query;

    if (!restaurant_ids) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: restaurant_ids'
      });
    }

    const ids = restaurant_ids.split(',').filter(id => id.trim());

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one restaurant_id is required'
      });
    }

    const result = await sequenceInstancesService.getSequencesByRestaurantIds(ids);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching batch sequences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-instances/bulk-recreate
 * Bulk recreate sequences for multiple instances
 * Body:
 *   - instance_ids: UUID[] (required, 1-100 items)
 */
router.post('/bulk-recreate', authMiddleware, async (req, res) => {
  try {
    const { instance_ids } = req.body;

    if (!instance_ids || !Array.isArray(instance_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: instance_ids (must be an array)'
      });
    }

    if (instance_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one instance_id is required'
      });
    }

    if (instance_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 instances per bulk operation'
      });
    }

    const result = await sequenceInstancesService.recreateSequenceBulk(instance_ids);

    // Determine status code based on results
    let statusCode = 200;
    if (result.summary.success > 0 && result.summary.failure > 0) {
      statusCode = 207; // Multi-Status (partial success)
    } else if (result.summary.failure > 0 && result.summary.success === 0) {
      statusCode = 207; // Multi-Status (all failed, but operation completed)
    }

    res.status(statusCode).json({ success: true, data: result });
  } catch (error) {
    console.error('Error bulk recreating sequences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-instances/bulk
 * Start sequences for multiple restaurants
 *
 * Request Body:
 * {
 *   sequence_template_id: UUID (required),
 *   restaurant_ids: UUID[] (required, 1-100 items),
 *   assigned_to: UUID (optional)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     succeeded: [...],
 *     failed: [...],
 *     summary: { total, success, failure }
 *   }
 * }
 */
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    // ===============================================
    // Validate Required Fields
    // ===============================================
    if (!req.body.sequence_template_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sequence_template_id'
      });
    }

    if (!req.body.restaurant_ids || !Array.isArray(req.body.restaurant_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: restaurant_ids (must be an array)'
      });
    }

    if (req.body.restaurant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one restaurant_id is required'
      });
    }

    if (req.body.restaurant_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 restaurants per bulk operation'
      });
    }

    // ===============================================
    // Prepare Options
    // ===============================================
    const options = {
      assigned_to: req.body.assigned_to || req.user.id,
      created_by: req.user.id
    };

    // ===============================================
    // Execute Bulk Operation
    // ===============================================
    const results = await sequenceInstancesService.startSequenceBulk(
      req.body.sequence_template_id,
      req.body.restaurant_ids,
      options
    );

    // ===============================================
    // Determine Status Code
    // ===============================================
    let statusCode = 201; // Created (all succeeded)

    if (results.summary.success > 0 && results.summary.failure > 0) {
      statusCode = 207; // Multi-Status (partial success)
    } else if (results.summary.failure > 0 && results.summary.success === 0) {
      statusCode = 207; // Multi-Status (all failed, but operation completed)
    }

    // ===============================================
    // Send Response
    // ===============================================
    res.status(statusCode).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error in bulk sequence creation:', error);

    // Handle pre-flight errors (template validation, etc.)
    if (error.message.includes('inactive') ||
        error.message.includes('no steps') ||
        error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Server errors
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/sequence-instances
 * Start a new sequence for a restaurant
 * Body:
 *   - sequence_template_id: UUID (required)
 *   - restaurant_id: UUID (required)
 *   - assigned_to: UUID (optional)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.sequence_template_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sequence_template_id'
      });
    }

    if (!req.body.restaurant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurant_id'
      });
    }

    const options = {
      assigned_to: req.body.assigned_to || req.user.id,
      created_by: req.user.id
    };

    const instance = await sequenceInstancesService.startSequence(
      req.body.sequence_template_id,
      req.body.restaurant_id,
      options
    );

    res.status(201).json({ success: true, data: instance });
  } catch (error) {
    console.error('Error starting sequence:', error);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/sequence-instances/:id/pause
 * Pause an active sequence
 */
router.patch('/:id/pause', authMiddleware, async (req, res) => {
  try {
    const instance = await sequenceInstancesService.pauseSequence(req.params.id);
    res.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error pausing sequence:', error);
    if (error.message.includes('not found') || error.message.includes('not active')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/sequence-instances/:id/resume
 * Resume a paused sequence
 */
router.patch('/:id/resume', authMiddleware, async (req, res) => {
  try {
    const instance = await sequenceInstancesService.resumeSequence(req.params.id);
    res.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error resuming sequence:', error);
    if (error.message.includes('not found') || error.message.includes('not paused')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/sequence-instances/:id/cancel
 * Cancel a sequence and delete pending tasks
 */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const instance = await sequenceInstancesService.cancelSequence(req.params.id);
    res.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error cancelling sequence:', error);
    if (error.message.includes('not found') || error.message.includes('already')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-instances/:id/finish
 * Finish a sequence early
 * - Marks active tasks as completed
 * - Marks pending tasks as cancelled
 * - Sets sequence status to completed
 */
router.post('/:id/finish', authMiddleware, async (req, res) => {
  try {
    const result = await sequenceInstancesService.finishSequence(req.params.id);
    res.json({
      success: true,
      data: result.instance,
      completedTasks: result.completedTasks,
      cancelledTasks: result.cancelledTasks
    });
  } catch (error) {
    console.error('Error finishing sequence:', error);
    if (error.message.includes('not found') || error.message.includes('only finish')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-instances/:id/recreate
 * Recreate a sequence - deletes existing and starts fresh from same template
 * This allows variable replacement to use updated restaurant data
 */
router.post('/:id/recreate', authMiddleware, async (req, res) => {
  try {
    const result = await sequenceInstancesService.recreateSequence(req.params.id);
    res.json({
      success: true,
      data: result,
      message: `Sequence recreated with ${result.tasks_created} tasks`
    });
  } catch (error) {
    console.error('Error recreating sequence:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/sequence-instances/:id
 * Delete a sequence instance and its associated tasks
 * Only allows deleting completed or cancelled sequences
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deletedInstance = await sequenceInstancesService.deleteSequenceInstance(req.params.id);
    res.json({ success: true, data: deletedInstance });
  } catch (error) {
    console.error('Error deleting sequence instance:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('Can only delete')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sequence-instances/:id/progress
 * Get detailed progress information for a sequence
 */
router.get('/:id/progress', authMiddleware, async (req, res) => {
  try {
    const progress = await sequenceInstancesService.getSequenceProgress(req.params.id);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error fetching sequence progress:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/restaurants/:restaurantId/sequences
 * Get all sequences for a specific restaurant
 */
router.get('/restaurants/:restaurantId/sequences', authMiddleware, async (req, res) => {
  try {
    const sequences = await sequenceInstancesService.getRestaurantSequences(req.params.restaurantId);
    res.json({ success: true, data: sequences, count: sequences.length });
  } catch (error) {
    console.error('Error fetching restaurant sequences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/sequences/start
 * Start a sequence for a restaurant (convenience endpoint)
 * Body:
 *   - sequence_template_id: UUID (required)
 *   - assigned_to: UUID (optional)
 */
router.post('/restaurants/:restaurantId/sequences/start', authMiddleware, async (req, res) => {
  try {
    if (!req.body.sequence_template_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sequence_template_id'
      });
    }

    const options = {
      assigned_to: req.body.assigned_to || req.user.id,
      created_by: req.user.id
    };

    const instance = await sequenceInstancesService.startSequence(
      req.body.sequence_template_id,
      req.params.restaurantId,
      options
    );

    res.status(201).json({ success: true, data: instance });
  } catch (error) {
    console.error('Error starting sequence:', error);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
