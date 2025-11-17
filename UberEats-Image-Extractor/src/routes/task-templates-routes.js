/**
 * Task Templates Routes
 * API routes for task template management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const taskTemplatesService = require('../services/task-templates-service');

/**
 * GET /api/task-templates
 * List all task templates
 * Query params:
 *   - type: internal_activity|social_message|text|email|call
 *   - is_active: true|false
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {};

    if (req.query.type) {
      filters.type = req.query.type;
    }

    if (req.query.is_active !== undefined) {
      filters.is_active = req.query.is_active === 'true';
    }

    const templates = await taskTemplatesService.listTemplates(filters);
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching task templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/task-templates/:id
 * Get single task template
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await taskTemplatesService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error fetching task template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/task-templates/:id/usage
 * Get usage statistics for a template
 */
router.get('/:id/usage', authMiddleware, async (req, res) => {
  try {
    const stats = await taskTemplatesService.getUsageStats(req.params.id);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching template usage stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/task-templates
 * Create new task template
 * Body:
 *   - name: string (required)
 *   - description: string
 *   - type: internal_activity|social_message|text|email|call (required)
 *   - priority: low|medium|high
 *   - message_template_id: UUID
 *   - default_message: string
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name || !req.body.type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name and type are required'
      });
    }

    const templateData = {
      ...req.body,
      created_by: req.user.id,
      organisation_id: req.organizationId
    };

    const template = await taskTemplatesService.createTemplate(templateData);
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error creating task template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/task-templates/:id
 * Update task template
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await taskTemplatesService.updateTemplate(req.params.id, req.body);
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error updating task template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/task-templates/:id/toggle-active
 * Toggle template active status
 * Body:
 *   - is_active: boolean (required)
 */
router.patch('/:id/toggle-active', authMiddleware, async (req, res) => {
  try {
    if (req.body.is_active === undefined) {
      return res.status(400).json({
        success: false,
        error: 'is_active field is required'
      });
    }

    const template = await taskTemplatesService.toggleActive(
      req.params.id,
      req.body.is_active
    );
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error toggling template active status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/task-templates/:id
 * Delete task template
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await taskTemplatesService.deleteTemplate(req.params.id);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting task template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/task-templates/:id/duplicate
 * Duplicate a task template
 * Body:
 *   - name: string (optional - defaults to "[Original Name] (Copy)")
 */
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const template = await taskTemplatesService.duplicateTemplate(
      req.params.id,
      req.body.name
    );
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error duplicating task template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
