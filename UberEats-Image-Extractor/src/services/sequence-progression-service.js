/**
 * Sequence Progression Service
 * Handles automatic task progression logic when tasks are completed, deleted, or skipped
 */

const { getSupabaseClient } = require('./database-service');

/**
 * Activate the next task in sequence after one completes
 * @param {string} sequenceInstanceId - Instance ID
 * @param {string} completedTaskId - ID of task that was just completed
 * @returns {Promise<object|null>} Next task or null if sequence complete
 */
async function activateNextTask(sequenceInstanceId, completedTaskId) {
  const client = getSupabaseClient();

  try {
    // 1. Fetch sequence instance
    const { data: instance, error: instanceError } = await client
      .from('sequence_instances')
      .select('*')
      .eq('id', sequenceInstanceId)
      .single();

    if (instanceError) {
      console.error('Error fetching sequence instance:', instanceError);
      return null;
    }

    // 2. Check if instance is active
    if (instance.status !== 'active') {
      console.log('Sequence is not active (paused or cancelled), skipping progression');
      return null;
    }

    // 3. Get completed task to find its step order
    const { data: completedTask, error: taskError } = await client
      .from('tasks')
      .select('sequence_step_order')
      .eq('id', completedTaskId)
      .single();

    if (taskError) {
      console.error('Error fetching completed task:', taskError);
      return null;
    }

    // 4. Find next pending task
    const { data: nextTask, error: nextTaskError } = await client
      .from('tasks')
      .select('*')
      .eq('sequence_instance_id', sequenceInstanceId)
      .eq('status', 'pending')
      .gt('sequence_step_order', completedTask.sequence_step_order)
      .order('sequence_step_order', { ascending: true })
      .limit(1)
      .single();

    if (nextTaskError) {
      if (nextTaskError.code === 'PGRST116') {
        // No next task found - sequence complete
        await client
          .from('sequence_instances')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', sequenceInstanceId);

        console.log('Sequence completed - no more tasks');
        return null;
      }
      console.error('Error finding next task:', nextTaskError);
      return null;
    }

    // 5. Fetch corresponding sequence step to get delay
    const { data: step, error: stepError } = await client
      .from('sequence_steps')
      .select('delay_value, delay_unit')
      .eq('sequence_template_id', instance.sequence_template_id)
      .eq('step_order', nextTask.sequence_step_order)
      .single();

    if (stepError) {
      console.error('Error fetching sequence step:', stepError);
      return null;
    }

    // 6. Calculate due date from NOW (completion time)
    const dueDate = calculateDueDate(new Date(), step.delay_value, step.delay_unit);

    // 7. Update next task (activate it)
    const { data: activatedTask, error: updateError } = await client
      .from('tasks')
      .update({
        status: 'active',
        due_date: dueDate
      })
      .eq('id', nextTask.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error activating next task:', updateError);
      return null;
    }

    // 8. Update sequence instance current_step
    await client
      .from('sequence_instances')
      .update({ current_step_order: nextTask.sequence_step_order })
      .eq('id', sequenceInstanceId);

    console.log(`Activated next task in sequence: ${activatedTask.name} (step ${nextTask.sequence_step_order})`);
    return activatedTask;
  } catch (error) {
    console.error('Error in activateNextTask:', error);
    return null;
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
      console.error(`Invalid delay_unit: ${delayUnit}`);
      return fromDate;
  }

  return date.toISOString();
}

/**
 * Handle deletion of a task within a sequence
 * @param {string} sequenceInstanceId - Instance ID
 * @param {string} deletedTaskId - ID of task being deleted
 * @returns {Promise<void>}
 */
async function handleTaskDeletion(sequenceInstanceId, deletedTaskId) {
  const client = getSupabaseClient();

  try {
    // Fetch task to check status
    const { data: task, error: fetchError } = await client
      .from('tasks')
      .select('status, sequence_step_order')
      .eq('id', deletedTaskId)
      .single();

    if (fetchError) {
      console.error('Error fetching task for deletion:', fetchError);
      throw fetchError;
    }

    // If task is active, activate next task before deleting
    if (task.status === 'active') {
      console.log('Deleting active task, activating next task in sequence');

      // Find next pending task
      const { data: nextTask, error: nextError } = await client
        .from('tasks')
        .select('*')
        .eq('sequence_instance_id', sequenceInstanceId)
        .eq('status', 'pending')
        .gt('sequence_step_order', task.sequence_step_order)
        .order('sequence_step_order', { ascending: true })
        .limit(1)
        .single();

      if (!nextError && nextTask) {
        // Activate immediately (no delay)
        await client
          .from('tasks')
          .update({
            status: 'active',
            due_date: new Date().toISOString()
          })
          .eq('id', nextTask.id);

        await client
          .from('sequence_instances')
          .update({ current_step_order: nextTask.sequence_step_order })
          .eq('id', sequenceInstanceId);
      } else {
        // No next task - mark sequence complete
        await client
          .from('sequence_instances')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', sequenceInstanceId);
      }
    }

    // Delete the task
    const { error: deleteError } = await client
      .from('tasks')
      .delete()
      .eq('id', deletedTaskId);

    if (deleteError) {
      console.error('Error deleting task:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    console.error('Error in handleTaskDeletion:', error);
    throw error;
  }
}

/**
 * Skip a task (mark as cancelled) and activate next
 * @param {string} taskId - Task ID to skip
 * @returns {Promise<object>} Next activated task
 */
async function handleTaskSkip(taskId) {
  const client = getSupabaseClient();

  try {
    // Get task info
    const { data: task } = await client
      .from('tasks')
      .select('sequence_instance_id, status')
      .eq('id', taskId)
      .single();

    if (!task || !task.sequence_instance_id) {
      throw new Error('Task is not part of a sequence');
    }

    if (task.status !== 'active' && task.status !== 'pending') {
      throw new Error('Can only skip active or pending tasks');
    }

    // Mark task as cancelled
    await client
      .from('tasks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // If task was active, activate next
    if (task.status === 'active') {
      return await activateNextTask(task.sequence_instance_id, taskId);
    }

    return null;
  } catch (error) {
    console.error('Error in handleTaskSkip:', error);
    throw error;
  }
}

/**
 * Handle out-of-order task completion with warning
 * @param {string} taskId - Task ID
 * @returns {Promise<object>} Warning message and next task info
 */
async function handleOutOfOrderCompletion(taskId) {
  const client = getSupabaseClient();

  try {
    const { data: task } = await client
      .from('tasks')
      .select('sequence_instance_id, sequence_step_order, status')
      .eq('id', taskId)
      .single();

    if (!task || !task.sequence_instance_id) {
      return null; // Not a sequence task
    }

    // Check if there are pending tasks with lower step_order
    const { count: skippedCount } = await client
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_instance_id', task.sequence_instance_id)
      .lt('sequence_step_order', task.sequence_step_order)
      .in('status', ['pending', 'active']);

    if (skippedCount > 0) {
      return {
        warning: true,
        message: `Warning: You are completing this task out of order. ${skippedCount} task(s) before this step are not yet completed.`,
        skipped_count: skippedCount
      };
    }

    return null;
  } catch (error) {
    console.error('Error in handleOutOfOrderCompletion:', error);
    return null;
  }
}

module.exports = {
  activateNextTask,
  handleTaskDeletion,
  handleTaskSkip,
  handleOutOfOrderCompletion,
  calculateDueDate
};
