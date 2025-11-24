/**
 * Sequence Instances Service
 * Handles business logic for active sequence instance management
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
const variableReplacementService = require('./variable-replacement-service');
const { getSequenceTemplateById } = require('./sequence-templates-service');

/**
 * Start a new sequence for a restaurant
 * @param {string} templateId - Sequence template ID
 * @param {string} restaurantId - Restaurant ID
 * @param {object} options - Additional options (assigned_to, created_by)
 * @returns {Promise<object>} Created sequence instance
 */
async function startSequence(templateId, restaurantId, options = {}) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  try {
    // 1. Fetch template with steps
    const template = await getSequenceTemplateById(templateId);

    if (!template.is_active) {
      throw new Error('Cannot start sequence from inactive template');
    }

    if (!template.sequence_steps || template.sequence_steps.length === 0) {
      throw new Error('Template has no steps');
    }

    // 2. Check for duplicate active sequence
    const { count: existingCount } = await client
      .from('sequence_instances')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_template_id', templateId)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'active');

    if (existingCount > 0) {
      throw new Error('An active sequence already exists for this restaurant using this template');
    }

    // 3. Fetch restaurant data
    const { data: restaurant, error: restaurantError } = await client
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError) {
      console.error('Error fetching restaurant:', restaurantError);
      throw new Error('Restaurant not found');
    }

    // 4. Create sequence instance
    const instanceName = `${template.name} - ${restaurant.name} - ${new Date().toISOString().split('T')[0]}`;

    const { data: instance, error: instanceError } = await client
      .from('sequence_instances')
      .insert({
        sequence_template_id: templateId,
        restaurant_id: restaurantId,
        organisation_id: orgId,
        name: instanceName,
        status: 'active',
        current_step_order: 1,
        total_steps: template.sequence_steps.length,
        assigned_to: options.assigned_to || options.created_by,
        created_by: options.created_by
      })
      .select()
      .single();

    if (instanceError) {
      console.error('Error creating sequence instance:', instanceError);
      throw instanceError;
    }

    // 5. Create all tasks
    const tasksToCreate = [];
    const now = new Date();

    for (const step of template.sequence_steps) {
      let message = step.custom_message;

      // Get message from template if referenced
      if (step.message_template_id && step.message_templates) {
        message = step.message_templates.message_content;
      } else if (step.task_template_id && step.task_templates && !message) {
        // Use task template's default message if no custom message
        message = step.task_templates.default_message;
      }

      // Render message with variables
      let messageRendered = null;
      if (message) {
        messageRendered = await variableReplacementService.replaceVariables(message, restaurant);
      }

      // Get subject line from template hierarchy (for email types)
      let subjectLine = step.subject_line;
      if (step.type === 'email') {
        if (step.message_template_id && step.message_templates && step.message_templates.subject_line) {
          subjectLine = step.message_templates.subject_line;
        } else if (step.task_template_id && step.task_templates && step.task_templates.subject_line && !subjectLine) {
          subjectLine = step.task_templates.subject_line;
        }
      }

      // Render subject line with variables (for email types)
      let subjectLineRendered = null;
      if (step.type === 'email' && subjectLine) {
        subjectLineRendered = await variableReplacementService.replaceVariables(subjectLine, restaurant);
      }

      // Calculate due_date for first step
      let dueDate = null;
      let status = 'pending';

      if (step.step_order === 1) {
        status = 'active';
        // Calculate due date based on first step delay
        dueDate = calculateDueDate(now, step.delay_value, step.delay_unit);
      }

      const taskData = {
        organisation_id: orgId,
        restaurant_id: restaurantId,
        sequence_instance_id: instance.id,
        sequence_step_order: step.step_order,
        task_template_id: step.task_template_id,
        message_template_id: step.message_template_id,
        assigned_to: options.assigned_to || options.created_by,
        created_by: options.created_by,
        name: step.name,
        description: step.description,
        status: status,
        type: step.type,
        priority: step.priority,
        message: message,
        message_rendered: messageRendered,
        subject_line: subjectLine || null,
        subject_line_rendered: subjectLineRendered,
        due_date: dueDate
      };

      tasksToCreate.push(taskData);
    }

    // Batch insert tasks
    const { data: createdTasks, error: tasksError } = await client
      .from('tasks')
      .insert(tasksToCreate)
      .select();

    if (tasksError) {
      // Rollback: delete instance
      await client.from('sequence_instances').delete().eq('id', instance.id);
      console.error('Error creating tasks:', tasksError);
      throw tasksError;
    }

    // 6. Update template usage_count
    await client
      .from('sequence_templates')
      .update({ usage_count: (template.usage_count || 0) + 1 })
      .eq('id', templateId);

    // Return instance with created tasks
    return {
      ...instance,
      tasks: createdTasks,
      tasks_created: createdTasks.length
    };
  } catch (error) {
    console.error('Error in startSequence:', error);
    throw error;
  }
}

/**
 * Helper function to calculate due date
 * @param {Date} fromDate - Starting date
 * @param {number} delayValue - Delay amount
 * @param {string} delayUnit - Delay unit (minutes, hours, days)
 * @returns {string} ISO date string
 */
function calculateDueDate(fromDate, delayValue, delayUnit) {
  const date = new Date(fromDate);

  switch(delayUnit) {
    case 'minutes':
      date.setMinutes(date.getMinutes() + delayValue);
      break;
    case 'hours':
      date.setHours(date.getHours() + delayValue);
      break;
    case 'days':
      date.setDate(date.getDate() + delayValue);
      break;
    default:
      throw new Error(`Invalid delay_unit: ${delayUnit}`);
  }

  return date.toISOString();
}

/**
 * Get sequence instance with progress details
 * @param {string} id - Instance ID
 * @returns {Promise<object>} Sequence instance
 */
async function getSequenceInstance(id) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_instances')
    .select(`
      *,
      sequence_templates (id, name),
      restaurants (id, name),
      tasks (
        id, name, status, due_date, sequence_step_order,
        completed_at, created_at
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Sequence instance not found');
    }
    console.error('Error getting sequence instance:', error);
    throw error;
  }

  // Sort tasks by step_order
  if (data.tasks) {
    data.tasks = data.tasks.sort((a, b) => a.sequence_step_order - b.sequence_step_order);
  }

  // Calculate progress
  const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
  data.progress = {
    completed: completedTasks,
    total: data.total_steps,
    percentage: Math.round((completedTasks / data.total_steps) * 100)
  };

  return data;
}

/**
 * List sequence instances with filtering
 * @param {object} filters - Filter criteria
 * @returns {Promise<Array>} Array of sequence instances
 */
async function listSequenceInstances(filters = {}) {
  let query = getSupabaseClient()
    .from('sequence_instances')
    .select(`
      *,
      sequence_templates (id, name),
      restaurants (
        id,
        name,
        contact_name,
        contact_email,
        contact_phone,
        email,
        phone,
        instagram_url,
        facebook_url
      ),
      tasks (
        id,
        name,
        description,
        type,
        status,
        priority,
        due_date,
        sequence_step_order,
        completed_at,
        message,
        message_rendered,
        subject_line,
        subject_line_rendered
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('created_at', { ascending: false });

  if (filters.restaurant_id) {
    query = query.eq('restaurant_id', filters.restaurant_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing sequence instances:', error);
    throw error;
  }

  // Add progress to each instance and sort tasks by step_order
  return data.map(instance => {
    // Sort tasks by sequence_step_order and add restaurant data to each task
    const sortedTasks = instance.tasks && instance.tasks.length > 0
      ? instance.tasks
          .sort((a, b) => a.sequence_step_order - b.sequence_step_order)
          .map(task => ({
            ...task,
            restaurants: instance.restaurants // Copy restaurant data from instance to each task
          }))
      : [];

    const completedTasks = sortedTasks.filter(t => t.status === 'completed').length;
    return {
      ...instance,
      tasks: sortedTasks,
      progress: {
        completed: completedTasks,
        total: instance.total_steps,
        percentage: Math.round((completedTasks / instance.total_steps) * 100)
      }
    };
  });
}

/**
 * Pause an active sequence
 * @param {string} instanceId - Instance ID
 * @returns {Promise<object>} Updated instance
 */
async function pauseSequence(instanceId) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_instances')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString()
    })
    .eq('id', instanceId)
    .eq('organisation_id', getCurrentOrganizationId())
    .eq('status', 'active') // Only pause if currently active
    .select()
    .single();

  if (error) {
    console.error('Error pausing sequence:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Sequence not found or not active');
  }

  return data;
}

/**
 * Resume a paused sequence
 * @param {string} instanceId - Instance ID
 * @returns {Promise<object>} Updated instance
 */
async function resumeSequence(instanceId) {
  const { data, error } = await getSupabaseClient()
    .from('sequence_instances')
    .update({
      status: 'active',
      paused_at: null
    })
    .eq('id', instanceId)
    .eq('organisation_id', getCurrentOrganizationId())
    .eq('status', 'paused') // Only resume if currently paused
    .select()
    .single();

  if (error) {
    console.error('Error resuming sequence:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Sequence not found or not paused');
  }

  return data;
}

/**
 * Cancel a sequence and delete pending tasks
 * @param {string} instanceId - Instance ID
 * @returns {Promise<object>} Updated instance
 */
async function cancelSequence(instanceId) {
  const client = getSupabaseClient();

  try {
    // Update instance status
    const { data: instance, error: updateError } = await client
      .from('sequence_instances')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .eq('organisation_id', getCurrentOrganizationId())
      .in('status', ['active', 'paused']) // Only cancel if active or paused
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling sequence:', updateError);
      throw updateError;
    }

    if (!instance) {
      throw new Error('Sequence not found or already completed/cancelled');
    }

    // Delete pending tasks
    const { error: deleteError } = await client
      .from('tasks')
      .delete()
      .eq('sequence_instance_id', instanceId)
      .eq('status', 'pending');

    if (deleteError) {
      console.error('Error deleting pending tasks:', deleteError);
      // Don't throw - instance is already cancelled
    }

    return instance;
  } catch (error) {
    console.error('Error in cancelSequence:', error);
    throw error;
  }
}

/**
 * Finish a sequence early
 * - Marks active tasks as completed
 * - Marks pending tasks as cancelled
 * - Sets sequence status to completed
 * @param {string} instanceId - Instance ID
 * @returns {Promise<object>} Result with updated instance and task counts
 */
async function finishSequence(instanceId) {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  try {
    // First, get the sequence to verify it exists and is active/paused
    const { data: instance, error: fetchError } = await client
      .from('sequence_instances')
      .select('id, status')
      .eq('id', instanceId)
      .eq('organisation_id', getCurrentOrganizationId())
      .single();

    if (fetchError || !instance) {
      throw new Error('Sequence not found');
    }

    if (!['active', 'paused'].includes(instance.status)) {
      throw new Error('Can only finish active or paused sequences');
    }

    // Mark active tasks as completed
    const { data: completedTasks, error: completeError } = await client
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: now
      })
      .eq('sequence_instance_id', instanceId)
      .eq('status', 'active')
      .select('id, name');

    if (completeError) {
      console.error('Error completing active tasks:', completeError);
      throw completeError;
    }

    // Mark pending tasks as cancelled
    const { data: cancelledTasks, error: cancelError } = await client
      .from('tasks')
      .update({
        status: 'cancelled'
      })
      .eq('sequence_instance_id', instanceId)
      .eq('status', 'pending')
      .select('id, name');

    if (cancelError) {
      console.error('Error cancelling pending tasks:', cancelError);
      throw cancelError;
    }

    // Update sequence status to completed
    const { data: updatedInstance, error: updateError } = await client
      .from('sequence_instances')
      .update({
        status: 'completed',
        completed_at: now
      })
      .eq('id', instanceId)
      .eq('organisation_id', getCurrentOrganizationId())
      .select()
      .single();

    if (updateError) {
      console.error('Error updating sequence status:', updateError);
      throw updateError;
    }

    return {
      instance: updatedInstance,
      completedTasks: completedTasks || [],
      cancelledTasks: cancelledTasks || []
    };
  } catch (error) {
    console.error('Error in finishSequence:', error);
    throw error;
  }
}

/**
 * Get all sequences for a restaurant
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of sequence instances
 */
async function getRestaurantSequences(restaurantId) {
  return listSequenceInstances({ restaurant_id: restaurantId });
}

/**
 * Get sequence progress
 * @param {string} instanceId - Instance ID
 * @returns {Promise<object>} Progress details
 */
async function getSequenceProgress(instanceId) {
  const instance = await getSequenceInstance(instanceId);

  const timeline = instance.tasks.map(task => ({
    step_order: task.sequence_step_order,
    name: task.name,
    status: task.status,
    due_date: task.due_date,
    completed_at: task.completed_at
  }));

  return {
    instance_id: instance.id,
    status: instance.status,
    current_step: instance.current_step_order,
    total_steps: instance.total_steps,
    progress: instance.progress,
    timeline
  };
}

/**
 * Start sequences for multiple restaurants (bulk operation)
 * NOTE: No duplicate checking - restaurants can have multiple sequences
 *
 * @param {string} templateId - Sequence template ID
 * @param {string[]} restaurantIds - Array of restaurant IDs (max 100)
 * @param {object} options - Additional options (assigned_to, created_by)
 * @returns {Promise<object>} Bulk operation results
 */
async function startSequenceBulk(templateId, restaurantIds, options = {}) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Validation
  if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
    throw new Error('At least one restaurant_id is required');
  }

  if (restaurantIds.length > 100) {
    throw new Error('Maximum 100 restaurants per bulk operation');
  }

  // Initialize result tracking
  const results = {
    succeeded: [],
    failed: [],
    summary: {
      total: restaurantIds.length,
      success: 0,
      failure: 0
    }
  };

  try {
    // ===============================================
    // STEP 1: Pre-flight Template Validation
    // (Fail fast for all if template is invalid)
    // ===============================================
    const template = await getSequenceTemplateById(templateId);

    if (!template.is_active) {
      throw new Error('Cannot start sequences from inactive template');
    }

    if (!template.sequence_steps || template.sequence_steps.length === 0) {
      throw new Error('Template has no steps');
    }

    // ===============================================
    // STEP 2: Bulk Fetch Restaurants (Optimization)
    // Single query to get all restaurants at once
    // ===============================================
    const { data: restaurants, error: restaurantsError } = await client
      .from('restaurants')
      .select('*')
      .in('id', restaurantIds)
      .eq('organisation_id', orgId);

    if (restaurantsError) {
      console.error('Error fetching restaurants:', restaurantsError);
      throw new Error('Failed to fetch restaurants');
    }

    // Create map for quick lookups
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

    // ===============================================
    // STEP 3: Process Each Restaurant Independently
    // ===============================================
    for (const restaurantId of restaurantIds) {
      try {
        // Check if restaurant exists
        const restaurant = restaurantMap.get(restaurantId);
        if (!restaurant) {
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: 'Unknown',
            error: 'Restaurant not found or not accessible',
            reason: 'not_found'
          });
          continue;
        }

        // Create sequence instance
        const instanceName = `${template.name} - ${restaurant.name} - ${new Date().toISOString().split('T')[0]}`;

        const { data: instance, error: instanceError } = await client
          .from('sequence_instances')
          .insert({
            sequence_template_id: templateId,
            restaurant_id: restaurantId,
            organisation_id: orgId,
            name: instanceName,
            status: 'active',
            current_step_order: 1,
            total_steps: template.sequence_steps.length,
            assigned_to: options.assigned_to || options.created_by,
            created_by: options.created_by
          })
          .select()
          .single();

        if (instanceError) {
          console.error(`Error creating instance for ${restaurant.name}:`, instanceError);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: instanceError.message || 'Failed to create sequence instance',
            reason: 'server_error'
          });
          continue;
        }

        // Create tasks for this sequence
        const tasksToCreate = [];
        const now = new Date();

        for (const step of template.sequence_steps) {
          let message = step.custom_message;

          // Get message from template if referenced
          if (step.message_template_id && step.message_templates) {
            message = step.message_templates.message_content;
          } else if (step.task_template_id && step.task_templates && !message) {
            message = step.task_templates.default_message;
          }

          // Render message with variables
          let messageRendered = null;
          if (message) {
            try {
              messageRendered = await variableReplacementService.replaceVariables(message, restaurant);
            } catch (varError) {
              console.warn(`Variable replacement failed for ${restaurant.name}:`, varError);
              // Continue with unrendered message
              messageRendered = message;
            }
          }

          // Get subject line from template hierarchy (for email types)
          let subjectLine = step.subject_line;
          if (step.type === 'email') {
            if (step.message_template_id && step.message_templates && step.message_templates.subject_line) {
              subjectLine = step.message_templates.subject_line;
            } else if (step.task_template_id && step.task_templates && step.task_templates.subject_line && !subjectLine) {
              subjectLine = step.task_templates.subject_line;
            }
          }

          // Render subject line with variables (for email types)
          let subjectLineRendered = null;
          if (step.type === 'email' && subjectLine) {
            try {
              subjectLineRendered = await variableReplacementService.replaceVariables(subjectLine, restaurant);
            } catch (varError) {
              console.warn(`Subject line variable replacement failed for ${restaurant.name}:`, varError);
              // Continue with unrendered subject
              subjectLineRendered = subjectLine;
            }
          }

          // Calculate due_date for first step
          let dueDate = null;
          let status = 'pending';

          if (step.step_order === 1) {
            status = 'active';
            dueDate = calculateDueDate(now, step.delay_value, step.delay_unit);
          }

          tasksToCreate.push({
            organisation_id: orgId,
            restaurant_id: restaurantId,
            sequence_instance_id: instance.id,
            sequence_step_order: step.step_order,
            task_template_id: step.task_template_id,
            message_template_id: step.message_template_id,
            assigned_to: options.assigned_to || options.created_by,
            created_by: options.created_by,
            name: step.name,
            description: step.description,
            status: status,
            type: step.type,
            priority: step.priority,
            message: message,
            message_rendered: messageRendered,
            subject_line: subjectLine || null,
            subject_line_rendered: subjectLineRendered,
            due_date: dueDate
          });
        }

        // Batch insert tasks
        const { data: createdTasks, error: tasksError } = await client
          .from('tasks')
          .insert(tasksToCreate)
          .select();

        if (tasksError) {
          // ROLLBACK: Delete sequence instance
          await client.from('sequence_instances').delete().eq('id', instance.id);
          console.error(`Error creating tasks for ${restaurant.name}:`, tasksError);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: tasksError.message || 'Failed to create tasks',
            reason: 'server_error'
          });
          continue;
        }

        // Verify all tasks were created
        if (createdTasks.length !== template.sequence_steps.length) {
          // ROLLBACK: Delete sequence instance
          await client.from('sequence_instances').delete().eq('id', instance.id);
          console.error(`Incomplete task creation for ${restaurant.name}`);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: `Only ${createdTasks.length} of ${template.sequence_steps.length} tasks were created`,
            reason: 'server_error'
          });
          continue;
        }

        // SUCCESS!
        results.succeeded.push({
          restaurant_id: restaurantId,
          restaurant_name: restaurant.name,
          instance_id: instance.id,
          tasks_created: createdTasks.length
        });

      } catch (error) {
        // Catch any unexpected errors for this restaurant
        console.error(`Unexpected error processing restaurant ${restaurantId}:`, error);
        const restaurant = restaurantMap.get(restaurantId);
        results.failed.push({
          restaurant_id: restaurantId,
          restaurant_name: restaurant?.name || 'Unknown',
          error: error.message || 'Unexpected server error',
          reason: 'server_error'
        });
      }
    }

    // ===============================================
    // STEP 4: Update Template Usage Count
    // ===============================================
    if (results.succeeded.length > 0) {
      await client
        .from('sequence_templates')
        .update({ usage_count: (template.usage_count || 0) + results.succeeded.length })
        .eq('id', templateId);
    }

    // ===============================================
    // STEP 5: Calculate Final Summary
    // ===============================================
    results.summary.success = results.succeeded.length;
    results.summary.failure = results.failed.length;

    console.log(`[Bulk Sequence] Completed: ${results.summary.success} succeeded, ${results.summary.failure} failed`);

    return results;

  } catch (error) {
    // Pre-flight errors (template validation, etc.)
    console.error('Error in startSequenceBulk (pre-flight):', error);
    throw error;
  }
}

module.exports = {
  startSequence,
  startSequenceBulk,
  getSequenceInstance,
  listSequenceInstances,
  pauseSequence,
  resumeSequence,
  cancelSequence,
  finishSequence,
  getRestaurantSequences,
  getSequenceProgress
};
