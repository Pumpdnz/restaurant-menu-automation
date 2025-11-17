/**
 * Message Templates Routes
 * API routes for message template management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const messageTemplatesService = require('../services/message-templates-service');

/**
 * GET /api/message-templates
 * List all message templates
 * Query params:
 *   - type: social_message|text|email
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

    const templates = await messageTemplatesService.listTemplates(filters);
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching message templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/message-templates/variables
 * Get list of all available variables
 */
router.get('/variables', authMiddleware, async (req, res) => {
  try {
    const variables = messageTemplatesService.getAvailableVariables();
    res.json({ success: true, variables });
  } catch (error) {
    console.error('Error fetching available variables:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/message-templates/:id
 * Get single message template
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await messageTemplatesService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error fetching message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/message-templates
 * Create new message template
 * Body:
 *   - name: string (required)
 *   - description: string
 *   - type: social_message|text|email (required)
 *   - message_content: string (required)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name || !req.body.type || !req.body.message_content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, and message_content are required'
      });
    }

    const templateData = {
      ...req.body,
      created_by: req.user.id,
      organisation_id: req.organizationId
    };

    const template = await messageTemplatesService.createTemplate(templateData);
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error creating message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/message-templates/:id
 * Update message template
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await messageTemplatesService.updateTemplate(req.params.id, req.body);
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error updating message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/message-templates/:id
 * Delete message template
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await messageTemplatesService.deleteTemplate(req.params.id);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/message-templates/:id/preview
 * Preview template with sample or actual restaurant data
 * Body:
 *   - restaurant_id: UUID (optional)
 */
router.post('/:id/preview', authMiddleware, async (req, res) => {
  try {
    const preview = await messageTemplatesService.previewTemplate(
      req.params.id,
      req.body.restaurant_id
    );
    res.json({ success: true, preview });
  } catch (error) {
    console.error('Error previewing message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/message-templates/validate
 * Validate message template content
 * Body:
 *   - message_content: string (required)
 */
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    if (!req.body.message_content) {
      return res.status(400).json({
        success: false,
        error: 'message_content is required'
      });
    }

    const validation = await messageTemplatesService.validateTemplate(req.body.message_content);
    res.json({ success: true, validation });
  } catch (error) {
    console.error('Error validating message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/message-templates/:id/duplicate
 * Duplicate a message template
 * Body:
 *   - name: string (optional - defaults to "[Original Name] (Copy)")
 */
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const template = await messageTemplatesService.duplicateTemplate(
      req.params.id,
      req.body.name
    );
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error duplicating message template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
