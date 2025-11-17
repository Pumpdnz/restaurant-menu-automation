import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Calendar,
  Flag,
  User,
  MessageSquare,
  Phone,
  Mail,
  Plus,
  Edit,
  Filter,
  X,
  ClipboardList,
  Copy,
  ChevronDown
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { cn } from '../lib/utils';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { EditTaskModal } from '../components/tasks/EditTaskModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';
import { TaskTypeQuickView } from '../components/tasks/TaskTypeQuickView';
import { DateRange } from 'react-day-picker';

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    priority: 'all',
    assigned_to: 'all'
  });

  const [dueDateFilter, setDueDateFilter] = useState<{
    type: 'all' | 'overdue' | 'today' | 'week' | 'month' | 'no_date' | 'custom';
    customDates?: DateRange;
  }>({
    type: 'all',
    customDates: undefined
  });

  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [modals, setModals] = useState({
    create: false,
    edit: null,
    detail: null,
    duplicate: null,
    followUp: null
  });

  // NZ Timezone utility functions
  const getStartOfDayNZ = (date: Date): Date => {
    // Create date string in NZ timezone
    const nzDateString = date.toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [day, month, year] = nzDateString.split('/');
    // Create a new Date object at start of day in NZ timezone
    const nzDate = new Date(`${year}-${month}-${day}T00:00:00+13:00`);
    return nzDate;
  };

  const getEndOfDayNZ = (date: Date): Date => {
    // Create date string in NZ timezone
    const nzDateString = date.toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [day, month, year] = nzDateString.split('/');
    // Create a new Date object at end of day in NZ timezone
    const nzDate = new Date(`${year}-${month}-${day}T23:59:59.999+13:00`);
    return nzDate;
  };

  const getTodayStartNZ = (): Date => {
    const now = new Date();
    return getStartOfDayNZ(now);
  };

  const getTodayEndNZ = (): Date => {
    const now = new Date();
    return getEndOfDayNZ(now);
  };

  useEffect(() => {
    fetchTasks();
  }, [filters, dueDateFilter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== 'all') params[key] = value;
      });

      // Handle due date filter
      if (dueDateFilter.type !== 'all') {
        const now = new Date();

        switch (dueDateFilter.type) {
          case 'overdue':
            // Tasks due before now, excluding completed
            params.due_before = now.toISOString();
            if (params.status === 'all' || !params.status) {
              // Add filter to exclude completed tasks
              params.status_not = 'completed';
            }
            break;

          case 'today':
            // Tasks due today in NZ timezone
            params.due_after = getTodayStartNZ().toISOString();
            params.due_before = getTodayEndNZ().toISOString();
            break;

          case 'week':
            // Tasks due in next 7 days
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() + 7);
            params.due_after = now.toISOString();
            params.due_before = getEndOfDayNZ(weekEnd).toISOString();
            break;

          case 'month':
            // Tasks due in next 30 days
            const monthEnd = new Date(now);
            monthEnd.setDate(monthEnd.getDate() + 30);
            params.due_after = now.toISOString();
            params.due_before = getEndOfDayNZ(monthEnd).toISOString();
            break;

          case 'no_date':
            // Tasks with no due date
            params.no_due_date = 'true';
            break;

          case 'custom':
            // Custom date range selection
            if (dueDateFilter.customDates?.from) {
              // Start date
              params.due_after = getStartOfDayNZ(dueDateFilter.customDates.from).toISOString();

              // End date (if provided, otherwise use same day as start)
              const endDate = dueDateFilter.customDates.to || dueDateFilter.customDates.from;
              params.due_before = getEndOfDayNZ(endDate).toISOString();
            }
            break;
        }
      }

      const response = await api.get('/tasks', { params });
      setTasks(response.data.tasks || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCompleteWithFollowUp = async (taskId: string) => {
    try {
      // First, complete the current task
      await api.patch(`/tasks/${taskId}/complete`);

      // Then open the follow-up task modal
      setModals({ ...modals, followUp: taskId });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/cancel`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const handleUpdateDueDate = async (taskId: string, dueDate: string | null) => {
    try {
      await api.patch(`/tasks/${taskId}`, { due_date: dueDate });
      // Update local state optimistically
      setTasks(prev => prev.map((t: any) =>
        t.id === taskId ? { ...t, due_date: dueDate } : t
      ));
    } catch (error) {
      console.error('Failed to update due date:', error);
      // Refetch if update fails
      fetchTasks();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      // Use the specific endpoint for complete/cancel, or general update for others
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

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      type: 'all',
      priority: 'all',
      assigned_to: 'all'
    });
    setDueDateFilter({
      type: 'all',
      customDates: undefined
    });
    setTempDateRange(undefined);
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== 'all') || dueDateFilter.type !== 'all';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'active':
        return <Circle className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'social_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <ClipboardList className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800 border-gray-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[priority as keyof typeof colors])}>
        {priority}
      </Badge>
    );
  };

  const getDueDateInput = (dueDate: string | null, taskId: string) => {
    return (
      <DateTimePicker
        value={dueDate ? new Date(dueDate) : null}
        onChange={(date) => handleUpdateDueDate(taskId, date ? date.toISOString() : null)}
        placeholder="Set due date"
        className="h-8 text-xs"
      />
    );
  };

  const getInteractiveStatusIcon = (task: any) => {
    const statusOptions = [
      {
        value: 'pending',
        label: 'Pending',
        icon: <Circle className="h-4 w-4 text-gray-400" />,
        description: 'Waiting on dependencies'
      },
      {
        value: 'active',
        label: 'Active',
        icon: <Circle className="h-4 w-4 text-blue-600" />,
        description: 'Currently working on'
      },
      {
        value: 'completed',
        label: 'Completed',
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        description: 'Task finished'
      },
      {
        value: 'cancelled',
        label: 'Cancelled',
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        description: 'Task cancelled'
      }
    ];

    const currentStatus = statusOptions.find(s => s.value === task.status);

    return (
      <Select
        value={task.status}
        onValueChange={(v) => handleStatusChange(task.id, v)}
      >
        <SelectTrigger className="h-8 w-8 border-0 bg-transparent p-0 hover:bg-muted/50 rounded-full">
          {currentStatus?.icon || <Circle className="h-5 w-5 text-gray-400" />}
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              <div className="flex items-center gap-2">
                {status.icon}
                <div>
                  <div className="font-medium">{status.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {status.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} {hasActiveFilters() ? 'filtered ' : ''}tasks
          </p>
        </div>
        <Button
          onClick={() => setModals({ ...modals, create: true })}
          className="bg-gradient-to-r from-brand-blue to-brand-green"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Filters</h3>
          </div>
          {hasActiveFilters() && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <Select
              value={filters.status}
              onValueChange={(v) => updateFilter('status', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <Select
              value={filters.type}
              onValueChange={(v) => updateFilter('type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="internal_activity">Internal Activity</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="social_message">Social Message</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">Priority</label>
            <Select
              value={filters.priority}
              onValueChange={(v) => updateFilter('priority', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date Filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">Due Date</label>
            <div className="space-y-2">
              <Select
                value={dueDateFilter.type}
                onValueChange={(v) => {
                  if (v === 'custom') {
                    setDueDateFilter({ type: v as any, customDates: undefined });
                    setTempDateRange(dueDateFilter.customDates);
                  } else {
                    setDueDateFilter({ type: v as any, customDates: undefined });
                    setTempDateRange(undefined);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="no_date">No Due Date</SelectItem>
                  <SelectItem value="custom">Custom Date Range...</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Range Picker */}
              {dueDateFilter.type === 'custom' && (
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDateFilter.customDates?.from && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dueDateFilter.customDates?.from ? (
                        dueDateFilter.customDates.to ? (
                          <>
                            {format(dueDateFilter.customDates.from, 'dd/MM/yyyy')} -{' '}
                            {format(dueDateFilter.customDates.to, 'dd/MM/yyyy')}
                          </>
                        ) : (
                          format(dueDateFilter.customDates.from, 'dd/MM/yyyy')
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
                    <div className="p-4">
                      <CalendarComponent
                        mode="range"
                        defaultMonth={tempDateRange?.from}
                        selected={tempDateRange}
                        onSelect={setTempDateRange}
                        numberOfMonths={2}
                      />
                      <div className="flex justify-end mt-4 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTempDateRange(dueDateFilter.customDates);
                            setIsDatePickerOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (tempDateRange?.from && tempDateRange?.to) {
                              setDueDateFilter({
                                type: 'custom',
                                customDates: tempDateRange
                              });
                              setIsDatePickerOpen(false);
                            }
                          }}
                          disabled={!tempDateRange?.from || !tempDateRange?.to}
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Display selected custom dates as badge */}
              {dueDateFilter.type === 'custom' && dueDateFilter.customDates?.from && dueDateFilter.customDates?.to && (
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <span className="font-medium">Range:</span>
                    {format(dueDateFilter.customDates.from, 'dd/MM/yyyy')} - {format(dueDateFilter.customDates.to, 'dd/MM/yyyy')}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setDueDateFilter({
                          type: 'custom',
                          customDates: undefined
                        });
                        setTempDateRange(undefined);
                      }}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Tasks Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No tasks found. Create your first task to get started.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task: any) => (
                <TableRow key={task.id} className={task.status === 'completed' ? 'opacity-60' : ''}>
                  <TableCell>
                    {getInteractiveStatusIcon(task)}
                  </TableCell>
                  <TableCell>
                    <div
                      className="font-medium cursor-pointer hover:text-brand-blue"
                      onClick={() => setModals({ ...modals, detail: task.id })}
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
                    {task.restaurants ? (
                      <div
                        className="text-sm cursor-pointer hover:text-brand-blue"
                        onClick={() => navigate(`/restaurants/${task.restaurant_id}`)}
                      >
                        {task.restaurants.name}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <TaskTypeQuickView task={task}>
                      <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                        {getTypeIcon(task.type)}
                        <span className="text-sm capitalize">
                          {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </TaskTypeQuickView>
                  </TableCell>
                  <TableCell>
                    {getPriorityBadge(task.priority)}
                  </TableCell>
                  <TableCell>
                    {getDueDateInput(task.due_date, task.id)}
                  </TableCell>
                  <TableCell>
                    {task.assigned_to ? (
                      <div className="text-sm">{task.assigned_to.full_name || task.assigned_to.email}</div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {task.status === 'active' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 flex items-center gap-0.5 px-2"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark as Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCompleteWithFollowUp(task.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Complete & Set Follow-up
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setModals({ ...modals, edit: task.id })}
                        title="Edit task"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setModals({ ...modals, duplicate: task.id })}
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

      {/* Modals */}
      {modals.create && (
        <CreateTaskModal
          open={modals.create}
          onClose={() => setModals({ ...modals, create: false })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.edit && (
        <EditTaskModal
          open={!!modals.edit}
          taskId={modals.edit}
          onClose={() => setModals({ ...modals, edit: null })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.detail && (
        <TaskDetailModal
          open={!!modals.detail}
          taskId={modals.detail}
          onClose={() => setModals({ ...modals, detail: null })}
        />
      )}

      {modals.duplicate && (
        <CreateTaskModal
          open={!!modals.duplicate}
          duplicateFromTaskId={modals.duplicate}
          onClose={() => setModals({ ...modals, duplicate: null })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.followUp && (
        <CreateTaskModal
          open={!!modals.followUp}
          followUpFromTaskId={modals.followUp}
          onClose={() => {
            setModals({ ...modals, followUp: null });
            fetchTasks(); // Refresh to show the completed task
          }}
          onSuccess={fetchTasks}
        />
      )}
    </div>
  );
}
