/**
 * Message Templates Service
 * Handles business logic for message template management
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
const variableReplacementService = require('./variable-replacement-service');

/**
 * List message templates with optional filtering
 * @param {object} filters - Filter criteria
 * @returns {Promise<Array>} Array of message templates
 */
async function listTemplates(filters = {}) {
  let query = getSupabaseClient()
    .from('message_templates')
    .select('*')
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

  const { data, error } = await query;

  if (error) {
    console.error('Error listing message templates:', error);
    throw error;
  }

  return data;
}

/**
 * Get message template by ID
 * @param {string} id - Template ID
 * @returns {Promise<object>} Message template object
 */
async function getTemplateById(id) {
  const { data, error } = await getSupabaseClient()
    .from('message_templates')
    .select('*')
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    console.error('Error getting message template:', error);
    throw error;
  }

  return data;
}

/**
 * Create message template
 * @param {object} templateData - Template data
 * @returns {Promise<object>} Created template
 */
async function createTemplate(templateData) {
  // Extract variables from message content and subject line
  const messageVariables = variableReplacementService.extractVariables(templateData.message_content);
  const subjectVariables = templateData.subject_line
    ? variableReplacementService.extractVariables(templateData.subject_line)
    : [];

  // Combine and deduplicate variables
  const allVariables = [...new Set([...messageVariables, ...subjectVariables])];
  templateData.available_variables = allVariables;

  const { data, error } = await getSupabaseClient()
    .from('message_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) {
    console.error('Error creating message template:', error);
    throw error;
  }

  return data;
}

/**
 * Update message template
 * @param {string} id - Template ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated template
 */
async function updateTemplate(id, updates) {
  // Re-extract variables if message content or subject line changed
  if (updates.message_content || updates.subject_line) {
    // Get current template to merge variables
    const current = await getTemplateById(id);

    const messageContent = updates.message_content || current.message_content;
    const subjectLine = updates.subject_line !== undefined ? updates.subject_line : current.subject_line;

    const messageVariables = variableReplacementService.extractVariables(messageContent);
    const subjectVariables = subjectLine
      ? variableReplacementService.extractVariables(subjectLine)
      : [];

    // Combine and deduplicate variables
    updates.available_variables = [...new Set([...messageVariables, ...subjectVariables])];
  }

  const { data, error } = await getSupabaseClient()
    .from('message_templates')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error updating message template:', error);
    throw error;
  }

  return data;
}

/**
 * Delete message template
 * @param {string} id - Template ID
 * @returns {Promise<void>}
 */
async function deleteTemplate(id) {
  // Check if template is being used by any task templates
  const { data: taskTemplates, error: checkError } = await getSupabaseClient()
    .from('task_templates')
    .select('id, name')
    .eq('message_template_id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (checkError) {
    console.error('Error checking template usage:', checkError);
    throw checkError;
  }

  if (taskTemplates && taskTemplates.length > 0) {
    const templateNames = taskTemplates.map(t => t.name).join(', ');
    throw new Error(`Cannot delete template. It is being used by: ${templateNames}`);
  }

  const { error } = await getSupabaseClient()
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Error deleting message template:', error);
    throw error;
  }
}

/**
 * Preview template with sample or actual restaurant data
 * @param {string} templateId - Template ID
 * @param {string} restaurantId - Optional restaurant ID for real data
 * @returns {Promise<object>} Preview result with original and rendered content
 */
async function previewTemplate(templateId, restaurantId = null) {
  const template = await getTemplateById(templateId);

  if (restaurantId) {
    // Preview with real restaurant data
    const { data: restaurant, error } = await getSupabaseClient()
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (error) {
      console.error('Error fetching restaurant for preview:', error);
      throw error;
    }

    if (restaurant) {
      const renderedMessage = await variableReplacementService.replaceVariables(
        template.message_content,
        restaurant
      );
      const renderedSubject = template.subject_line
        ? await variableReplacementService.replaceVariables(template.subject_line, restaurant)
        : null;

      return {
        original: template.message_content,
        rendered: renderedMessage,
        subject_line_original: template.subject_line,
        subject_line_rendered: renderedSubject,
        variables: template.available_variables,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name
        }
      };
    }
  }

  // Preview with sample data
  const sampleData = {
    name: 'Sample Restaurant',
    contact_name: 'John Smith',
    contact_email: 'john@example.com',
    contact_phone: '021 123 4567',
    city: 'Auckland',
    cuisine: 'Italian, Pizza',
    organisation_name: 'Sample Group Ltd',
    subdomain: 'sample-restaurant',
    demo_store_url: 'https://demo-sample.pumpd.co.nz',
    demo_store_built: true,
    opening_hours_text: 'Mon-Fri 11am-9pm',
    lead_stage: 'demo_booked',
    lead_warmth: 'warm',
    icp_rating: 8
  };

  const renderedMessage = await variableReplacementService.replaceVariables(
    template.message_content,
    sampleData
  );
  const renderedSubject = template.subject_line
    ? await variableReplacementService.replaceVariables(template.subject_line, sampleData)
    : null;

  return {
    original: template.message_content,
    rendered: renderedMessage,
    subject_line_original: template.subject_line,
    subject_line_rendered: renderedSubject,
    variables: template.available_variables,
    usingSampleData: true
  };
}

/**
 * Validate message template
 * @param {string} messageContent - Template content to validate
 * @returns {Promise<object>} Validation result
 */
async function validateTemplate(messageContent) {
  const validation = variableReplacementService.validateVariables(messageContent);

  return {
    isValid: validation.isValid,
    unknownVariables: validation.unknownVariables,
    knownVariables: validation.knownVariables,
    totalVariables: validation.totalVariables,
    message: validation.isValid
      ? 'All variables are valid'
      : `Unknown variables found: ${validation.unknownVariables.join(', ')}`
  };
}

/**
 * Get available variables for templates
 * @returns {Array} Array of available variables with descriptions
 */
function getAvailableVariables() {
  return variableReplacementService.getAvailableVariables();
}

/**
 * Duplicate a message template
 * @param {string} id - Template ID to duplicate
 * @param {string} newName - Name for the duplicated template
 * @returns {Promise<object>} Duplicated template
 */
async function duplicateTemplate(id, newName) {
  const template = await getTemplateById(id);

  const duplicateData = {
    name: newName || `${template.name} (Copy)`,
    description: template.description,
    type: template.type,
    message_content: template.message_content,
    subject_line: template.subject_line,
    available_variables: template.available_variables,
    organisation_id: getCurrentOrganizationId(),
    is_active: template.is_active
  };

  return createTemplate(duplicateData);
}

/**
 * Increment usage count for a template
 * @param {string} id - Template ID
 * @returns {Promise<void>}
 */
async function incrementUsageCount(id) {
  const template = await getTemplateById(id);

  await getSupabaseClient()
    .from('message_templates')
    .update({ usage_count: (template.usage_count || 0) + 1 })
    .eq('id', id);
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  validateTemplate,
  getAvailableVariables,
  duplicateTemplate,
  incrementUsageCount
};