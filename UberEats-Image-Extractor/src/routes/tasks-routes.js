/**
 * Tasks Routes
 * API routes for task management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const tasksService = require('../services/tasks-service');

/**
 * GET /api/tasks
 * List all tasks with filtering and sorting
 * Query params:
 *   - status: pending|active|completed|cancelled
 *   - type: internal_activity|social_message|text|email|call
 *   - priority: low|medium|high
 *   - restaurant_id: UUID
 *   - assigned_to: UUID
 *   - due_before: ISO date
 *   - due_after: ISO date
 *   - sort_by: created_at|due_date|priority
 *   - sort_order: asc|desc
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      priority: req.query.priority,
      restaurant_id: req.query.restaurant_id,
      assigned_to: req.query.assigned_to,
      due_before: req.query.due_before,
      due_after: req.query.due_after
    };

    // Remove undefined values
    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    );

    const sort = {
      by: req.query.sort_by || 'created_at',
      order: req.query.sort_order || 'desc'
    };

    const tasks = await tasksService.listTasks(filters, sort);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/overdue
 * Get overdue tasks
 */
router.get('/overdue', authMiddleware, async (req, res) => {
  try {
    const tasks = await tasksService.getOverdueTasks();
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/upcoming
 * Get upcoming tasks (due in next 7 days)
 */
router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    const tasks = await tasksService.getUpcomingTasks();
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/:id
 * Get single task with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks
 * Create new task
 * Body:
 *   - name: string (required)
 *   - description: string
 *   - restaurant_id: UUID
 *   - task_template_id: UUID
 *   - type: enum (required)
 *   - priority: enum
 *   - message: string
 *   - due_date: ISO date
 *   - assigned_to: UUID
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

    const taskData = {
      ...req.body,
      created_by: req.user.id,
      organisation_id: req.organizationId
    };

    const task = await tasksService.createTask(taskData);
    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update task
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.updateTask(req.params.id, req.body);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tasks/:id/complete
 * Mark task as completed
 */
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.completeTask(req.params.id);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tasks/:id/cancel
 * Cancel task
 */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const task = await tasksService.cancelTask(req.params.id);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await tasksService.deleteTask(req.params.id);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;