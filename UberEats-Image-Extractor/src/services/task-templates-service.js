/**
 * Task Templates Service
 * Handles business logic for task template management
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

/**
 * List task templates with optional filtering
 * @param {object} filters - Filter criteria
 * @returns {Promise<Array>} Array of task templates
 */
async function listTemplates(filters = {}) {
  let query = getSupabaseClient()
    .from('task_templates')
    .select(`
      *,
      message_templates (
        id, name, type, message_content
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

  const { data, error } = await query;

  if (error) {
    console.error('Error listing task templates:', error);
    throw error;
  }

  return data;
}

/**
 * Get task template by ID
 * @param {string} id - Template ID
 * @returns {Promise<object>} Task template object
 */
async function getTemplateById(id) {
  const { data, error } = await getSupabaseClient()
    .from('task_templates')
    .select(`
      *,
      message_templates (
        id, name, type, message_content
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    console.error('Error getting task template:', error);
    throw error;
  }

  return data;
}

/**
 * Create task template
 * @param {object} templateData - Template data
 * @returns {Promise<object>} Created template
 */
async function createTemplate(templateData) {
  const { data, error } = await getSupabaseClient()
    .from('task_templates')
    .insert(templateData)
    .select(`
      *,
      message_templates (
        id, name, type, message_content
      )
    `)
    .single();

  if (error) {
    console.error('Error creating task template:', error);
    throw error;
  }

  return data;
}

/**
 * Update task template
 * @param {string} id - Template ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated template
 */
async function updateTemplate(id, updates) {
  const { data, error } = await getSupabaseClient()
    .from('task_templates')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select(`
      *,
      message_templates (
        id, name, type, message_content
      )
    `)
    .single();

  if (error) {
    console.error('Error updating task template:', error);
    throw error;
  }

  return data;
}

/**
 * Delete task template
 * @param {string} id - Template ID
 * @returns {Promise<void>}
 */
async function deleteTemplate(id) {
  // Check if template is being used by any tasks
  const { data: tasks, error: checkError } = await getSupabaseClient()
    .from('tasks')
    .select('id, name')
    .eq('task_template_id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .limit(5);

  if (checkError) {
    console.error('Error checking template usage:', checkError);
    throw checkError;
  }

  if (tasks && tasks.length > 0) {
    throw new Error(
      `Cannot delete template. It has been used to create ${tasks.length} task(s). ` +
      `Consider deactivating it instead.`
    );
  }

  const { error } = await getSupabaseClient()
    .from('task_templates')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Error deleting task template:', error);
    throw error;
  }
}

/**
 * Duplicate a task template
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
    priority: template.priority,
    message_template_id: template.message_template_id,
    default_message: template.default_message,
    organisation_id: getCurrentOrganizationId(),
    created_by: template.created_by,
    is_active: template.is_active
  };

  return createTemplate(duplicateData);
}

/**
 * Toggle template active status
 * @param {string} id - Template ID
 * @param {boolean} isActive - New active status
 * @returns {Promise<object>} Updated template
 */
async function toggleActive(id, isActive) {
  return updateTemplate(id, { is_active: isActive });
}

/**
 * Get template usage statistics
 * @param {string} id - Template ID
 * @returns {Promise<object>} Usage statistics
 */
async function getUsageStats(id) {
  const template = await getTemplateById(id);

  // Get count of tasks created from this template
  const { count: taskCount, error: countError } = await getSupabaseClient()
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_template_id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (countError) {
    console.error('Error getting usage stats:', countError);
    throw countError;
  }

  // Get recent tasks created from this template
  const { data: recentTasks, error: tasksError } = await getSupabaseClient()
    .from('tasks')
    .select('id, name, created_at, status, restaurants(id, name)')
    .eq('task_template_id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false })
    .limit(5);

  if (tasksError) {
    console.error('Error getting recent tasks:', tasksError);
    throw tasksError;
  }

  return {
    template_id: id,
    template_name: template.name,
    usage_count: template.usage_count || 0,
    tasks_created: taskCount || 0,
    recent_tasks: recentTasks || [],
    is_active: template.is_active
  };
}

/**
 * Get templates by type
 * @param {string} type - Template type
 * @returns {Promise<Array>} Array of templates
 */
async function getTemplatesByType(type) {
  return listTemplates({ type, is_active: true });
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  toggleActive,
  getUsageStats,
  getTemplatesByType
};
