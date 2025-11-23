import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MultiSelect } from '../ui/multi-select';
import { DateTimePicker } from '../ui/date-time-picker';
import { cn } from '../../lib/utils';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Mail,
  Phone,
  MessageSquare,
  ClipboardList,
  Edit,
  Copy,
  ChevronDown,
  Workflow,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { TaskTypeQuickView } from './TaskTypeQuickView';
import { TaskDetailModal } from './TaskDetailModal';
import { useToast } from '../../hooks/use-toast';

interface RestaurantTasksListProps {
  restaurantId: string;
  onCreateTask?: () => void;
  onEditTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onFollowUpTask?: (taskId: string) => void;
  onStartSequence?: (restaurant: { id: string; name: string }) => void;
  refreshKey?: number;
}

/**
 * RestaurantTasksList Component
 * Displays and manages tasks for a specific restaurant
 *
 * Features:
 * - Filtered task list (type, status, priority)
 * - Inline status updates
 * - Inline due date editing
 * - Quick view popover
 * - Edit and duplicate actions
 * - Task detail modal
 * - Quick complete with follow-up option
 */
export function RestaurantTasksList({ restaurantId, onCreateTask, onEditTask, onDuplicateTask, onFollowUpTask, onStartSequence, refreshKey = 0 }: RestaurantTasksListProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: ['active'] as string[],
    type: [] as string[],
    priority: [] as string[],
  });

  useEffect(() => {
    fetchTasks();
  }, [restaurantId, refreshKey]);

  useEffect(() => {
    applyFilters();
  }, [tasks, filters]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tasks?restaurant_id=${restaurantId}`);
      // Filter out sequence tasks (tasks that are part of a sequence)
      const standaloneTasks = (response.data.tasks || []).filter(
        (task: any) => !task.sequence_instance_id
      );
      setTasks(standaloneTasks);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((t) => filters.status.includes(t.status));
    }

    if (filters.type && filters.type.length > 0) {
      filtered = filtered.filter((t) => filters.type.includes(t.type));
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter((t) => filters.priority.includes(t.priority));
    }

    setFilteredTasks(filtered);
  };

  const updateFilter = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      type: [],
      priority: [],
    });
  };

  const resetToDefault = () => {
    setFilters({
      status: ['active'],
      type: [],
      priority: [],
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.status.length > 0 ||
      filters.type.length > 0 ||
      filters.priority.length > 0
    );
  };

  const hasNoFilters = () => {
    return (
      filters.status.length === 0 &&
      filters.type.length === 0 &&
      filters.priority.length === 0
    );
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      if (newStatus === 'completed') {
        await api.patch(`/tasks/${taskId}/complete`);
      } else if (newStatus === 'cancelled') {
        await api.patch(`/tasks/${taskId}/cancel`);
      } else {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      }
      await fetchTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { priority: newPriority });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t))
      );
    } catch (error) {
      console.error('Failed to update task priority:', error);
      fetchTasks();
    }
  };

  const handleUpdateDueDate = async (taskId: string, dueDate: string | null) => {
    try {
      await api.patch(`/tasks/${taskId}`, { due_date: dueDate });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, due_date: dueDate } : t))
      );
    } catch (error) {
      console.error('Failed to update due date:', error);
      fetchTasks();
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      toast({
        title: 'Task completed',
        description: 'The task has been marked as complete.',
      });
      await fetchTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteAndFollowUp = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      toast({
        title: 'Task completed',
        description: 'Task completed. Create a follow-up task.',
      });
      await fetchTasks();
      // Trigger create task modal with follow-up mode
      if (onFollowUpTask) {
        onFollowUpTask(taskId);
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteAndStartSequence = async (task: any) => {
    try {
      if (!task?.restaurants) {
        toast({
          title: 'Error',
          description: 'No restaurant data available',
          variant: 'destructive',
        });
        return;
      }

      await api.patch(`/tasks/${task.id}/complete`);
      toast({
        title: 'Task completed',
        description: 'Opening sequence selection...',
      });
      await fetchTasks();
      // Trigger start sequence modal
      if (onStartSequence) {
        onStartSequence({
          id: task.restaurants.id,
          name: task.restaurants.name
        });
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  };

  const handleEditTask = (taskId: string) => {
    if (onEditTask) {
      onEditTask(taskId);
    }
  };

  const handleDuplicateTask = (taskId: string) => {
    if (onDuplicateTask) {
      onDuplicateTask(taskId);
    }
  };

  const handleViewTaskDetails = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailModalOpen(true);
  };

  const getStatusIcon = (task: any) => {
    const statusIcons = {
      pending: <Circle className="h-4 w-4 stroke-gray-700" />,
      active: <Circle className="h-4 w-4 stroke-brand-blue" />,
      completed: <CheckCircle2 className="h-4 w-4 stroke-brand-green" />,
      cancelled: <XCircle className="h-4 w-4 stroke-brand-red" />,
    };

    const currentIcon = statusIcons[task.status as keyof typeof statusIcons] || <Circle className="h-4 w-4 text-gray-400" />;

    // All tasks should have status dropdown available
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted/50 rounded-md flex items-center gap-1">
            {currentIcon}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'pending')}>
            <Circle className="h-4 w-4 stroke-gray-700 mr-2" />
            Pending
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'active')}>
            <Circle className="h-4 w-4 stroke-brand-blue mr-2" />
            Active
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')}>
            <CheckCircle2 className="h-4 w-4 stroke-brand-green mr-2" />
            Completed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'cancelled')}>
            <XCircle className="h-4 w-4 stroke-brand-red mr-2" />
            Cancelled
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'social_message':
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <ClipboardList className="h-4 w-4" />;
    }
  };

  const getPriorityDropdown = (task: any) => {
    const priorityConfig = {
      low: { label: 'Low', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      high: { label: 'High', color: 'bg-red-100 text-red-800 border-red-200' },
    };

    const currentPriority = priorityConfig[task.priority as keyof typeof priorityConfig];

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted/50 rounded-md">
            <Badge variant="outline" className={cn('capitalize cursor-pointer', currentPriority?.color)}>
              {currentPriority?.label || task.priority}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'low')}>
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 mr-2">
              Low
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'medium')}>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 mr-2">
              Medium
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'high')}>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 mr-2">
              High
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getDueDateInput = (dueDate: string | null, taskId: string, taskStatus: string) => {
    const isOverdue =
      dueDate &&
      new Date(dueDate) < new Date() &&
      taskStatus !== 'completed' &&
      taskStatus !== 'cancelled';

    return (
      <DateTimePicker
        value={dueDate ? new Date(dueDate) : null}
        onChange={(date) => handleUpdateDueDate(taskId, date ? date.toISOString() : null)}
        placeholder="Set due date"
        className={cn('h-8 text-xs', isOverdue && 'text-red-600')}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <MultiSelect
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Active', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' },
            ]}
            selected={filters.status}
            onChange={(v) => updateFilter('status', v)}
            placeholder="Filter by status"
          />
        </div>
        <div className="flex-1">
          <MultiSelect
            options={[
              { label: 'Internal Activity', value: 'internal_activity' },
              { label: 'Email', value: 'email' },
              { label: 'Call', value: 'call' },
              { label: 'Social Message', value: 'social_message' },
              { label: 'Text', value: 'text' },
              { label: 'Demo Meeting', value: 'demo_meeting' },
            ]}
            selected={filters.type}
            onChange={(v) => updateFilter('type', v)}
            placeholder="Filter by type"
          />
        </div>
        <div className="flex-1">
          <MultiSelect
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
            ]}
            selected={filters.priority}
            onChange={(v) => updateFilter('priority', v)}
            placeholder="Filter by priority"
          />
        </div>
        {hasActiveFilters() && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="whitespace-nowrap"
          >
            Clear Filters
          </Button>
        )}
        {hasNoFilters() && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
            className="whitespace-nowrap"
          >
            Reset to Default
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No tasks found for this restaurant
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>{getStatusIcon(task)}</TableCell>
                  <TableCell>
                    <div
                      className="font-medium cursor-pointer hover:text-brand-blue"
                      onClick={() => handleViewTaskDetails(task.id)}
                    >
                      {task.name}
                    </div>
                    {task.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <TaskTypeQuickView
                      task={task}
                      onTaskCompleted={fetchTasks}
                      onFollowUpRequested={(taskId) => {
                        if (onFollowUpTask) {
                          onFollowUpTask(taskId);
                        }
                      }}
                      onStartSequenceRequested={(restaurant) => {
                        if (onStartSequence) {
                          onStartSequence(restaurant);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                        {getTypeIcon(task.type)}
                        <span className="text-sm capitalize">
                          {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </TaskTypeQuickView>
                  </TableCell>
                  <TableCell>{getPriorityDropdown(task)}</TableCell>
                  <TableCell>{getDueDateInput(task.due_date, task.id, task.status)}</TableCell>
                  <TableCell>
                    {task.assigned_to ? (
                      <div className="text-sm">
                        {task.assigned_to.full_name || task.assigned_to.email}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Quick Complete Dropdown - only for active tasks */}
                      {task.status === 'active' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Mark as complete"
                              className="flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                              <CheckCircle2 className="h-4 w-4 text-brand-green mr-2" />
                              Mark as Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCompleteAndFollowUp(task.id)}>
                              <CheckCircle2 className="h-4 w-4 text-brand-green mr-2" />
                              Complete & Set Follow-up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCompleteAndStartSequence(task)}
                              disabled={!task?.restaurants}
                            >
                              <Workflow className="h-4 w-4 text-brand-green mr-2" />
                              Complete & Start Sequence
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTask(task.id)}
                        title="Edit task"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicateTask(task.id)}
                        title="Duplicate task"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        open={detailModalOpen}
        taskId={selectedTaskId}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
