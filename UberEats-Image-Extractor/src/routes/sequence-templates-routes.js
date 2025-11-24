/**
 * Sequence Templates Routes
 * API routes for sequence template management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const sequenceTemplatesService = require('../services/sequence-templates-service');

/**
 * GET /api/sequence-templates
 * List all sequence templates with filtering
 * Query params:
 *   - is_active: boolean
 *   - tags: comma-separated string
 *   - search: string
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {};

    if (req.query.is_active !== undefined) {
      filters.is_active = req.query.is_active === 'true';
    }

    if (req.query.tags) {
      filters.tags = req.query.tags.split(',').map(tag => tag.trim());
    }

    if (req.query.search) {
      filters.search = req.query.search;
    }

    const templates = await sequenceTemplatesService.listSequenceTemplates(filters);
    res.json({ success: true, data: templates, count: templates.length });
  } catch (error) {
    console.error('Error listing sequence templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sequence-templates/:id
 * Get single sequence template with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await sequenceTemplatesService.getSequenceTemplateById(req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching sequence template:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-templates
 * Create new sequence template with steps
 * Body:
 *   - name: string (required)
 *   - description: string
 *   - tags: array of strings
 *   - steps: array of step objects (required)
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

    if (!req.body.steps || !Array.isArray(req.body.steps) || req.body.steps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: steps (must be non-empty array)'
      });
    }

    const templateData = {
      name: req.body.name,
      description: req.body.description,
      tags: req.body.tags || [],
      created_by: req.user.id
    };

    const template = await sequenceTemplatesService.createSequenceTemplate(templateData, req.body.steps);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Error creating sequence template:', error);
    if (error.message.includes('sequential') || error.message.includes('at least')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/sequence-templates/:id
 * Update sequence template metadata and optionally steps
 * Body:
 *   - name: string
 *   - description: string
 *   - tags: array
 *   - is_active: boolean
 *   - steps: array (optional - if provided, replaces all steps)
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.tags !== undefined) updates.tags = req.body.tags;
    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
    if (req.body.steps !== undefined) updates.steps = req.body.steps;

    // Use appropriate service method based on whether steps are being updated
    const template = updates.steps
      ? await sequenceTemplatesService.updateSequenceTemplateWithSteps(req.params.id, updates)
      : await sequenceTemplatesService.updateSequenceTemplate(req.params.id, updates);

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Error updating sequence template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/sequence-templates/:id
 * Delete sequence template
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await sequenceTemplatesService.deleteSequenceTemplate(req.params.id);
    res.json({ success: true, message: 'Sequence template deleted successfully' });
  } catch (error) {
    console.error('Error deleting sequence template:', error);
    if (error.message.includes('Cannot delete')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-templates/:id/duplicate
 * Duplicate a sequence template
 * Body:
 *   - name: string (optional)
 */
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const newName = req.body.name;
    const template = await sequenceTemplatesService.duplicateSequenceTemplate(req.params.id, newName);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Error duplicating sequence template:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sequence-templates/:templateId/reorder
 * Reorder steps within a template
 * Body:
 *   - order: array of {id, step_order} objects
 */
router.post('/:templateId/reorder', authMiddleware, async (req, res) => {
  try {
    if (!req.body.order || !Array.isArray(req.body.order)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: order (must be array)'
      });
    }

    const steps = await sequenceTemplatesService.reorderSteps(req.params.templateId, req.body.order);
    res.json({ success: true, data: steps });
  } catch (error) {
    console.error('Error reordering steps:', error);
    if (error.message.includes('mismatch')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sequence-templates/:id/usage
 * Get template usage statistics
 */
router.get('/:id/usage', authMiddleware, async (req, res) => {
  try {
    const stats = await sequenceTemplatesService.getUsageStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/sequence-steps/:id
 * Update a single step
 */
router.patch('/steps/:id', authMiddleware, async (req, res) => {
  try {
    const step = await sequenceTemplatesService.updateStep(req.params.id, req.body);
    res.json({ success: true, data: step });
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/sequence-steps/:id
 * Delete a step and reorder remaining steps
 */
router.delete('/steps/:id', authMiddleware, async (req, res) => {
  try {
    await sequenceTemplatesService.deleteStep(req.params.id);
    res.json({ success: true, message: 'Step deleted and remaining steps reordered' });
  } catch (error) {
    console.error('Error deleting step:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
