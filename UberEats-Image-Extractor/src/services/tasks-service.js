/**
 * Tasks Service
 * Handles business logic for task management
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');
const variableReplacementService = require('./variable-replacement-service');
const sequenceProgressionService = require('./sequence-progression-service');
const qualificationService = require('./qualification-service');

/**
 * List tasks with filtering and sorting
 * @param {object} filters - Filter criteria
 * @param {object} sort - Sort configuration
 * @returns {Promise<Array>} Array of tasks
 */
async function listTasks(filters = {}, sort = {}) {
  let query = getSupabaseClient()
    .from('tasks')
    .select(`
      *,
      restaurants (
        id, name, contact_name, contact_email, contact_phone,
        phone, email, instagram_url, facebook_url,
        city, cuisine, subdomain, organisation_name, demo_store_url,
        lead_type, lead_category, lead_warmth, lead_stage, lead_status,
        demo_store_built, icp_rating,
        contact_role, number_of_venues, point_of_sale,
        online_ordering_platform, online_ordering_handles_delivery, self_delivery,
        weekly_uber_sales_volume, uber_aov, uber_markup, uber_profitability,
        uber_profitability_description, current_marketing_description, website_type,
        painpoints, core_selling_points, features_to_highlight, possible_objections,
        details, meeting_link
      ),
      task_templates (
        id, name
      ),
      message_templates (
        id, name
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId());

  // Apply filters
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.status_not) query = query.neq('status', filters.status_not);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.restaurant_id) query = query.eq('restaurant_id', filters.restaurant_id);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

  // Date filters
  if (filters.no_due_date === 'true') {
    query = query.is('due_date', null);
  } else {
    // Regular date range filters
    if (filters.due_before) query = query.lte('due_date', filters.due_before);
    if (filters.due_after) query = query.gte('due_date', filters.due_after);
  }

  // Apply sorting
  const sortBy = sort.by || 'created_at';
  const sortOrder = sort.order === 'asc' ? { ascending: true } : { ascending: false };
  query = query.order(sortBy, sortOrder);

  const { data, error } = await query;

  if (error) {
    console.error('Error listing tasks:', error);
    throw error;
  }

  return data;
}

/**
 * Get task by ID
 * @param {string} id - Task ID
 * @returns {Promise<object>} Task object
 */
async function getTaskById(id) {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(`
      *,
      restaurants (
        id, name, contact_name, contact_email, contact_phone,
        phone, email, instagram_url, facebook_url,
        city, cuisine, subdomain, organisation_name, demo_store_url,
        ubereats_url, doordash_url,
        lead_type, lead_category, lead_warmth, lead_stage, lead_status,
        demo_store_built, icp_rating,
        contact_role, number_of_venues, point_of_sale,
        online_ordering_platform, online_ordering_handles_delivery, self_delivery,
        weekly_uber_sales_volume, uber_aov, uber_markup, uber_profitability,
        uber_profitability_description, current_marketing_description, website_type,
        painpoints, core_selling_points, features_to_highlight, possible_objections,
        details, meeting_link
      ),
      task_templates (
        id, name, description
      ),
      message_templates (
        id, name, message_content
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    console.error('Error getting task:', error);
    throw error;
  }

  return data;
}

/**
 * Create task
 * @param {object} taskData - Task data
 * @returns {Promise<object>} Created task
 */
async function createTask(taskData) {
  const client = getSupabaseClient();

  // If task is created from template, fetch template data
  if (taskData.task_template_id) {
    const { data: template, error: templateError } = await client
      .from('task_templates')
      .select('*, message_templates(*)')
      .eq('id', taskData.task_template_id)
      .single();

    if (templateError) {
      console.error('Error fetching task template:', templateError);
    } else if (template) {
      // Merge template defaults with provided data
      taskData.name = taskData.name || template.name;
      taskData.description = taskData.description || template.description;
      taskData.type = taskData.type || template.type;
      taskData.priority = taskData.priority || template.priority;
      taskData.subject_line = taskData.subject_line || template.subject_line;

      // If template has message template, use it ONLY if user hasn't specified one
      if (template.message_template_id && template.message_templates) {
        // Only use template's message template if user hasn't selected a different one
        if (!taskData.message_template_id) {
          taskData.message_template_id = template.message_template_id;
        }
        // Only use template's message if user hasn't provided custom message
        if (!taskData.message) {
          taskData.message = template.message_templates.message_content;
        }
        // Only use template's subject_line if user hasn't provided one
        if (!taskData.subject_line && template.message_templates.subject_line) {
          taskData.subject_line = template.message_templates.subject_line;
        }
      } else if (template.default_message && !taskData.message) {
        // Only use default message if user hasn't provided one
        taskData.message = template.default_message;
      }

      // Increment template usage count
      await client
        .from('task_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', template.id);
    }
  }

  // If task has a restaurant and message/subject_line, perform variable replacement
  if (taskData.restaurant_id && (taskData.message || taskData.subject_line)) {
    const { data: restaurant, error: restaurantError } = await client
      .from('restaurants')
      .select('*')
      .eq('id', taskData.restaurant_id)
      .single();

    if (restaurantError) {
      console.error('Error fetching restaurant for variable replacement:', restaurantError);
    } else if (restaurant) {
      if (taskData.message) {
        taskData.message_rendered = await variableReplacementService.replaceVariables(
          taskData.message,
          restaurant
        );
      }
      if (taskData.subject_line) {
        taskData.subject_line_rendered = await variableReplacementService.replaceVariables(
          taskData.subject_line,
          restaurant
        );
      }
    }
  }

  // Handle demo_meeting type - update restaurant with qualification data
  if (taskData.type === 'demo_meeting') {
    if (!taskData.restaurant_id) {
      throw new Error('restaurant_id is required for demo_meeting tasks');
    }

    if (taskData.qualification_data) {
      try {
        // Update restaurant with qualification data
        await qualificationService.updateRestaurantQualification(
          taskData.restaurant_id,
          taskData.qualification_data
        );

        // Store qualification data in task metadata for historical reference
        taskData.metadata = {
          ...(taskData.metadata || {}),
          qualification_data: taskData.qualification_data,
          qualification_snapshot_at: new Date().toISOString()
        };

        // Remove qualification_data from taskData (it's now in metadata)
        delete taskData.qualification_data;
      } catch (error) {
        console.error('Failed to update restaurant qualification:', error);
        throw new Error(`Failed to update restaurant qualification: ${error.message}`);
      }
    }
  }

  // Set default status to 'active' for manually created tasks
  // 'pending' is reserved for tasks with dependencies that need to be resolved first
  if (!taskData.status) {
    taskData.status = 'active';
  }

  // Create task
  const { data, error } = await client
    .from('tasks')
    .insert(taskData)
    .select(`
      *,
      restaurants (
        id, name, contact_name, contact_email, contact_phone,
        phone, email, instagram_url, facebook_url,
        city, cuisine, subdomain, organisation_name, demo_store_url,
        lead_type, lead_category, lead_warmth, lead_stage, lead_status,
        demo_store_built, icp_rating,
        contact_role, number_of_venues, point_of_sale,
        online_ordering_platform, online_ordering_handles_delivery, self_delivery,
        weekly_uber_sales_volume, uber_aov, uber_markup, uber_profitability,
        uber_profitability_description, current_marketing_description, website_type,
        painpoints, core_selling_points, features_to_highlight, possible_objections,
        details, meeting_link
      ),
      task_templates (id, name),
      message_templates (id, name)
    `)
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  return data;
}

/**
 * Update task
 * @param {string} id - Task ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated task
 */
async function updateTask(id, updates) {
  const client = getSupabaseClient();

  // Get current task to check type and for other operations
  const task = await getTaskById(id);

  if (!task) {
    throw new Error('Task not found');
  }

  // Handle demo_meeting type updates - update only changed fields on restaurant
  if (task.type === 'demo_meeting' && updates.qualification_data_changes) {
    if (!task.restaurant_id) {
      throw new Error('Task has no associated restaurant');
    }

    try {
      // Update only changed fields on restaurant
      await qualificationService.updateChangedFields(
        task.restaurant_id,
        updates.qualification_data_changes
      );

      // Update task metadata with merged qualification data
      const currentQualData = task.metadata?.qualification_data || {};
      updates.metadata = {
        ...(task.metadata || {}),
        qualification_data: {
          ...currentQualData,
          ...updates.qualification_data_changes
        },
        last_qualification_update: new Date().toISOString()
      };

      // Remove temporary field from updates
      delete updates.qualification_data_changes;
    } catch (error) {
      console.error('Failed to update restaurant qualification:', error);
      throw new Error(`Failed to update restaurant qualification: ${error.message}`);
    }
  }

  // If message or subject_line is being updated and task has restaurant, re-render
  if (task.restaurant_id) {
    if (updates.message) {
      updates.message_rendered = await variableReplacementService.replaceVariables(
        updates.message,
        task.restaurants
      );
    }
    if (updates.subject_line) {
      updates.subject_line_rendered = await variableReplacementService.replaceVariables(
        updates.subject_line,
        task.restaurants
      );
    }
  }

  const { data, error } = await client
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  return data;
}

/**
 * Complete task
 * @param {string} id - Task ID
 * @returns {Promise<object>} Completed task
 */
async function completeTask(id) {
  const client = getSupabaseClient();

  // Update task status
  const { data: task, error } = await client
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error completing task:', error);
    throw error;
  }

  // ✅ SEQUENCE PROGRESSION HOOK
  if (task.sequence_instance_id) {
    try {
      await sequenceProgressionService.activateNextTask(
        task.sequence_instance_id,
        task.id
      );
    } catch (err) {
      // Log error but don't fail task completion
      console.error('Error activating next task in sequence:', err);
    }
  }

  return task;
}

/**
 * Cancel task
 * @param {string} id - Task ID
 * @returns {Promise<object>} Cancelled task
 */
async function cancelTask(id) {
  const client = getSupabaseClient();

  // Get task info first
  const { data: task } = await client
    .from('tasks')
    .select('sequence_instance_id, status')
    .eq('id', id)
    .single();

  // Update task status
  const { data: cancelledTask, error } = await client
    .from('tasks')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error cancelling task:', error);
    throw error;
  }

  // ✅ SEQUENCE PROGRESSION HOOK (if task was active)
  if (task && task.sequence_instance_id && task.status === 'active') {
    try {
      await sequenceProgressionService.activateNextTask(
        task.sequence_instance_id,
        id
      );
    } catch (err) {
      console.error('Error activating next task in sequence:', err);
    }
  }

  return cancelledTask;
}

/**
 * Delete task
 * @param {string} id - Task ID
 * @returns {Promise<void>}
 */
async function deleteTask(id) {
  const client = getSupabaseClient();

  // Fetch task first to check for sequence
  const { data: task } = await client
    .from('tasks')
    .select('sequence_instance_id')
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  // ✅ SEQUENCE DELETION HOOK
  if (task && task.sequence_instance_id) {
    try {
      await sequenceProgressionService.handleTaskDeletion(
        task.sequence_instance_id,
        id
      );
      return; // handleTaskDeletion already deletes the task
    } catch (err) {
      console.error('Error handling sequence task deletion:', err);
      throw err;
    }
  }

  // Regular task deletion (not part of sequence)
  const { error } = await client
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

/**
 * Get tasks for a specific restaurant
 * @param {string} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of tasks
 */
async function getTasksByRestaurant(restaurantId) {
  return listTasks({ restaurant_id: restaurantId }, { by: 'created_at', order: 'desc' });
}

/**
 * Get overdue tasks
 * @returns {Promise<Array>} Array of overdue tasks
 */
async function getOverdueTasks() {
  const now = new Date().toISOString();
  return listTasks({ due_before: now, status: 'pending' }, { by: 'due_date', order: 'asc' });
}

/**
 * Get upcoming tasks (due in next 7 days)
 * @returns {Promise<Array>} Array of upcoming tasks
 */
async function getUpcomingTasks() {
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return listTasks(
    { due_after: now, due_before: sevenDaysFromNow, status: 'pending' },
    { by: 'due_date', order: 'asc' }
  );
}

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  completeTask,
  cancelTask,
  deleteTask,
  getTasksByRestaurant,
  getOverdueTasks,
  getUpcomingTasks
};