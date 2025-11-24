/**
 * Sequence Templates Service
 * Handles business logic for sequence template management
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

/**
 * List sequence templates with optional filtering
 * @param {object} filters - Filter criteria
 * @returns {Promise<Array>} Array of sequence templates
 */
async function listSequenceTemplates(filters = {}) {
  let query = getSupabaseClient()
    .from('sequence_templates')
    .select(`
      *,
      sequence_steps (
        id, step_order, name, type, delay_value, delay_unit
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing sequence templates:', error);
    throw error;
  }

  // Sort steps by step_order for each template
  return data.map(template => ({
    ...template,
    sequence_steps: template.sequence_steps.sort((a, b) => a.step_order - b.step_order)
  }));
}

/**
 * Get sequence template by ID with full step details
 * @param {string} id - Template ID
 * @returns {Promise<object>} Sequence template object
 */
async function getSequenceTemplateById(id) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_templates')
    .select(`
      *,
      sequence_steps (
        *,
        task_templates (id, name, type),
        message_templates (id, name, type)
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Sequence template not found');
    }
    console.error('Error getting sequence template:', error);
    throw error;
  }

  // Sort steps by step_order
  data.sequence_steps = data.sequence_steps.sort((a, b) => a.step_order - b.step_order);

  return data;
}

/**
 * Create sequence template with steps in a transaction
 * @param {object} templateData - Template data
 * @param {Array} steps - Array of step objects
 * @returns {Promise<object>} Created template
 */
async function createSequenceTemplate(templateData, steps) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Validation
  if (!templateData.name || templateData.name.length < 3) {
    throw new Error('Template name must be at least 3 characters');
  }

  if (!steps || steps.length === 0) {
    throw new Error('Template must have at least one step');
  }

  if (steps.length > 50) {
    throw new Error('Template cannot have more than 50 steps');
  }

  // Validate step orders are sequential
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  for (let i = 0; i < sortedSteps.length; i++) {
    if (sortedSteps[i].step_order !== i + 1) {
      throw new Error(`Step orders must be sequential. Expected ${i + 1}, got ${sortedSteps[i].step_order}`);
    }
  }

  try {
    // Start transaction by creating template first
    const { data: template, error: templateError } = await client
      .from('sequence_templates')
      .insert({
        ...templateData,
        organisation_id: orgId
      })
      .select()
      .single();

    if (templateError) {
      console.error('Error creating template:', templateError);
      throw templateError;
    }

    // Insert all steps
    const stepsToInsert = steps.map(step => ({
      ...step,
      sequence_template_id: template.id
    }));

    const { data: createdSteps, error: stepsError } = await client
      .from('sequence_steps')
      .insert(stepsToInsert)
      .select();

    if (stepsError) {
      // Rollback: delete the template
      await client.from('sequence_templates').delete().eq('id', template.id);
      console.error('Error creating steps:', stepsError);
      throw stepsError;
    }

    // Return template with steps
    return {
      ...template,
      sequence_steps: createdSteps.sort((a, b) => a.step_order - b.step_order)
    };
  } catch (error) {
    console.error('Error in createSequenceTemplate:', error);
    throw error;
  }
}

/**
 * Update sequence template metadata (not steps)
 * @param {string} id - Template ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated template
 */
async function updateSequenceTemplate(id, updates) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_templates')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error updating sequence template:', error);
    throw error;
  }

  return data;
}

/**
 * Update sequence template with steps
 * @param {string} id - Template ID
 * @param {object} updates - Fields to update (name, description, tags, steps)
 * @returns {Promise<object>} Updated template with steps
 */
async function updateSequenceTemplateWithSteps(id, updates) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  try {
    // Update template metadata
    const templateUpdates = {};
    if (updates.name !== undefined) templateUpdates.name = updates.name;
    if (updates.description !== undefined) templateUpdates.description = updates.description;
    if (updates.tags !== undefined) templateUpdates.tags = updates.tags;
    if (updates.is_active !== undefined) templateUpdates.is_active = updates.is_active;

    const { data: template, error: templateError } = await client
      .from('sequence_templates')
      .update(templateUpdates)
      .eq('id', id)
      .eq('organisation_id', orgId)
      .select()
      .single();

    if (templateError) {
      console.error('Error updating template:', templateError);
      throw templateError;
    }

    // If steps are provided, replace all steps
    if (updates.steps && Array.isArray(updates.steps)) {
      // Delete existing steps
      const { error: deleteError } = await client
        .from('sequence_steps')
        .delete()
        .eq('sequence_template_id', id);

      if (deleteError) {
        console.error('Error deleting old steps:', deleteError);
        throw deleteError;
      }

      // Insert new steps
      const stepsToInsert = updates.steps.map((step) => ({
        sequence_template_id: id,
        step_order: step.step_order,
        name: step.name,
        description: step.description,
        task_template_id: step.task_template_id,
        type: step.type,
        priority: step.priority || 'medium',
        message_template_id: step.message_template_id,
        custom_message: step.custom_message,
        subject_line: step.subject_line,
        delay_value: step.delay_value,
        delay_unit: step.delay_unit,
      }));

      const { data: createdSteps, error: stepsError } = await client
        .from('sequence_steps')
        .insert(stepsToInsert)
        .select();

      if (stepsError) {
        console.error('Error creating new steps:', stepsError);
        throw stepsError;
      }

      return {
        ...template,
        sequence_steps: createdSteps.sort((a, b) => a.step_order - b.step_order)
      };
    }

    // If no steps provided, just return template
    return template;
  } catch (error) {
    console.error('Error in updateSequenceTemplateWithSteps:', error);
    throw error;
  }
}

/**
 * Delete sequence template (with safety checks)
 * @param {string} id - Template ID
 * @returns {Promise<void>}
 */
async function deleteSequenceTemplate(id) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Check for active instances
  const { count: activeCount, error: countError } = await client
    .from('sequence_instances')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_template_id', id)
    .eq('status', 'active');

  if (countError) {
    console.error('Error checking active instances:', countError);
    throw countError;
  }

  if (activeCount > 0) {
    throw new Error(
      `Cannot delete template. ${activeCount} active sequence(s) are using this template. ` +
      `Please cancel or complete them first, or deactivate the template instead.`
    );
  }

  // Proceed with deletion (cascade will handle steps and completed instances)
  const { error } = await client
    .from('sequence_templates')
    .delete()
    .eq('id', id)
    .eq('organisation_id', orgId);

  if (error) {
    console.error('Error deleting sequence template:', error);
    throw error;
  }
}

/**
 * Update a single step
 * @param {string} stepId - Step ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated step
 */
async function updateStep(stepId, updates) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_steps')
    .update(updates)
    .eq('id', stepId)
    .select()
    .single();

  if (error) {
    console.error('Error updating sequence step:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a step and reorder remaining steps
 * @param {string} stepId - Step ID
 * @returns {Promise<void>}
 */
async function deleteStep(stepId) {
  const client = getSupabaseClient();

  // Get the step to find its order and template
  const { data: step, error: fetchError } = await client
    .from('sequence_steps')
    .select('sequence_template_id, step_order')
    .eq('id', stepId)
    .single();

  if (fetchError) {
    console.error('Error fetching step:', fetchError);
    throw fetchError;
  }

  // Delete the step
  const { error: deleteError } = await client
    .from('sequence_steps')
    .delete()
    .eq('id', stepId);

  if (deleteError) {
    console.error('Error deleting step:', deleteError);
    throw deleteError;
  }

  // Reorder remaining steps
  const { data: remainingSteps, error: selectError } = await client
    .from('sequence_steps')
    .select('id, step_order')
    .eq('sequence_template_id', step.sequence_template_id)
    .gt('step_order', step.step_order)
    .order('step_order');

  if (selectError) {
    console.error('Error fetching remaining steps:', selectError);
    throw selectError;
  }

  // Update step orders
  for (const remainingStep of remainingSteps) {
    await client
      .from('sequence_steps')
      .update({ step_order: remainingStep.step_order - 1 })
      .eq('id', remainingStep.id);
  }
}

/**
 * Reorder steps within a template
 * @param {string} templateId - Template ID
 * @param {Array} newOrder - Array of {id, step_order} objects
 * @returns {Promise<Array>} Updated steps
 */
async function reorderSteps(templateId, newOrder) {
  const client = getSupabaseClient();

  // Validate that all steps belong to this template
  const { data: existingSteps, error: fetchError } = await client
    .from('sequence_steps')
    .select('id')
    .eq('sequence_template_id', templateId);

  if (fetchError) {
    console.error('Error fetching steps:', fetchError);
    throw fetchError;
  }

  const existingStepIds = new Set(existingSteps.map(s => s.id));
  const newOrderIds = new Set(newOrder.map(s => s.id));

  if (existingStepIds.size !== newOrderIds.size) {
    throw new Error('Step count mismatch');
  }

  // Update each step's order
  const updatePromises = newOrder.map(({ id, step_order }) =>
    client
      .from('sequence_steps')
      .update({ step_order })
      .eq('id', id)
  );

  await Promise.all(updatePromises);

  // Return updated steps
  return getSequenceTemplateById(templateId).then(t => t.sequence_steps);
}

/**
 * Duplicate a sequence template
 * @param {string} id - Template ID to duplicate
 * @param {string} newName - Optional new name
 * @returns {Promise<object>} Duplicated template
 */
async function duplicateSequenceTemplate(id, newName) {
  const original = await getSequenceTemplateById(id);

  const duplicateData = {
    name: newName || `Copy of ${original.name}`,
    description: original.description,
    tags: original.tags,
    created_by: original.created_by,
    is_active: true // New template starts active
  };

  const steps = original.sequence_steps.map(step => ({
    step_order: step.step_order,
    name: step.name,
    description: step.description,
    task_template_id: step.task_template_id,
    type: step.type,
    priority: step.priority,
    message_template_id: step.message_template_id,
    custom_message: step.custom_message,
    subject_line: step.subject_line,
    delay_value: step.delay_value,
    delay_unit: step.delay_unit
  }));

  return createSequenceTemplate(duplicateData, steps);
}

/**
 * Toggle template active status
 * @param {string} id - Template ID
 * @param {boolean} isActive - New active status
 * @returns {Promise<object>} Updated template
 */
async function toggleActive(id, isActive) {
  return updateSequenceTemplate(id, { is_active: isActive });
}

/**
 * Get template usage statistics
 * @param {string} id - Template ID
 * @returns {Promise<object>} Usage statistics
 */
async function getUsageStats(id) {
  const template = await getSequenceTemplateById(id);

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

  // Get recent instances created from this template
  const { data: recentInstances, error: instancesError } = await getSupabaseClient()
    .from('sequence_instances')
    .select('id, name, created_at, status, restaurants(id, name)')
    .eq('sequence_template_id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false })
    .limit(5);

  if (instancesError) {
    console.error('Error getting recent instances:', instancesError);
    throw instancesError;
  }

  return {
    template_id: id,
    template_name: template.name,
    usage_count: template.usage_count || 0,
    instances_created: recentInstances?.length || 0,
    recent_instances: recentInstances || [],
    is_active: template.is_active
  };
}

module.exports = {
  listSequenceTemplates,
  getSequenceTemplateById,
  createSequenceTemplate,
  updateSequenceTemplate,
  updateSequenceTemplateWithSteps,
  deleteSequenceTemplate,
  updateStep,
  deleteStep,
  reorderSteps,
  duplicateSequenceTemplate,
  toggleActive,
  getUsageStats
};
