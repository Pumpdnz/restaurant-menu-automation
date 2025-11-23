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
import { DateTimePicker } from '../ui/date-time-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
  ChevronUp,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { TaskTypeQuickView } from '../tasks/TaskTypeQuickView';
import { useToast } from '../../hooks/use-toast';

interface Task {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  due_date: string | null;
  sequence_step_order: number;
  completed_at: string | null;
  message?: string;
  message_rendered?: string;
  subject_line?: string;
  subject_line_rendered?: string;
  sequence_steps?: {
    delay_value: number;
    delay_unit: 'minutes' | 'hours' | 'days';
  };
  restaurants?: {
    id: string;
    name: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    email?: string;
    phone?: string;
    instagram_url?: string;
    facebook_url?: string;
  };
}

interface SequenceTaskListProps {
  tasks: Task[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTaskClick?: (taskId: string) => void;
  onTaskComplete?: () => void;
  onEditTask?: (taskId: string) => void;
  onViewDetails?: (taskId: string) => void;
}

export function SequenceTaskList({
  tasks,
  isExpanded,
  onToggleExpand,
  onTaskClick,
  onTaskComplete,
  onEditTask,
  onViewDetails,
}: SequenceTaskListProps) {
  const { toast } = useToast();

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      if (newStatus === 'completed') {
        await api.patch(`/tasks/${taskId}/complete`);
      } else if (newStatus === 'cancelled') {
        await api.patch(`/tasks/${taskId}/cancel`);
      } else {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      }
      toast({
        title: 'Status updated',
        description: 'Task status has been updated.',
      });
      if (onTaskComplete) {
        onTaskComplete();
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      toast({
        title: 'Task completed',
        description: 'The task has been marked as complete.',
      });
      if (onTaskComplete) {
        onTaskComplete();
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

  const handleCompleteAndFollowUp = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      toast({
        title: 'Task completed',
        description: 'Task completed. Create a follow-up task.',
      });
      if (onTaskComplete) {
        onTaskComplete();
      }
      if (onTaskClick) {
        onTaskClick(taskId);
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

  const getStatusIcon = (task: Task) => {
    const statusIcons = {
      pending: <Circle className="h-4 w-4 stroke-gray-700" />,
      active: <Circle className="h-4 w-4 stroke-brand-blue" />,
      completed: <CheckCircle2 className="h-4 w-4 stroke-brand-green" />,
      cancelled: <XCircle className="h-4 w-4 stroke-brand-red" />,
    };

    const currentIcon = statusIcons[task.status as keyof typeof statusIcons] || <Circle className="h-4 w-4 text-gray-400" />;

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

  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { priority: newPriority });
      toast({
        title: 'Priority updated',
        description: 'Task priority has been updated.',
      });
      if (onTaskComplete) {
        onTaskComplete();
      }
    } catch (error) {
      console.error('Failed to update task priority:', error);
      toast({
        title: 'Error',
        description: 'Failed to update priority',
        variant: 'destructive',
      });
    }
  };

  const getPriorityDropdown = (task: Task) => {
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
            <Badge variant="outline" className={cn('capitalize cursor-pointer text-xs', currentPriority?.color)}>
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

  const handleUpdateDueDate = async (taskId: string, dueDate: string | null) => {
    try {
      await api.patch(`/tasks/${taskId}`, { due_date: dueDate });
      toast({
        title: 'Due date updated',
        description: 'Task due date has been updated.',
      });
      if (onTaskComplete) {
        onTaskComplete();
      }
    } catch (error) {
      console.error('Failed to update due date:', error);
      toast({
        title: 'Error',
        description: 'Failed to update due date',
        variant: 'destructive',
      });
    }
  };

  const getDueDateOrDelayInput = (task: Task) => {
    if (task.status === 'completed') {
      return <span className="text-xs text-green-600">Done</span>;
    }

    // Pending tasks show delay from template (read-only)
    if (task.status === 'pending') {
      if (task.sequence_steps?.delay_value !== undefined) {
        const { delay_value, delay_unit } = task.sequence_steps;
        const formatDelay = () => {
          if (delay_value === 0) return 'Immediately';
          if (delay_value === 1) {
            return `After 1 ${delay_unit.slice(0, -1)}`;
          }
          return `After ${delay_value} ${delay_unit}`;
        };

        return (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDelay()}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Pending</span>
        </div>
      );
    }

    // Active and other tasks show due date picker
    const isOverdue =
      task.due_date &&
      new Date(task.due_date) < new Date() &&
      task.status !== 'completed' &&
      task.status !== 'cancelled';

    return (
      <DateTimePicker
        value={task.due_date ? new Date(task.due_date) : null}
        onChange={(date) => handleUpdateDueDate(task.id, date ? date.toISOString() : null)}
        placeholder="Set due date"
        className={cn('h-8 text-xs w-full', isOverdue && 'text-red-600')}
      />
    );
  };

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
        onClick={onToggleExpand}
      >
        <p className="text-sm font-medium">Tasks ({tasks.length})</p>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>

      {isExpanded && tasks.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-48">Due Date / Delay</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{getStatusIcon(task)}</TableCell>
                  <TableCell>
                    <div
                      className="font-medium text-sm cursor-pointer hover:text-brand-blue transition-colors"
                      onClick={() => onViewDetails?.(task.id)}
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
                      onTaskCompleted={onTaskComplete}
                      onFollowUpRequested={(taskId) => onTaskClick?.(taskId)}
                    >
                      <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                        {getTypeIcon(task.type)}
                        <span className="text-xs capitalize">
                          {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </TaskTypeQuickView>
                  </TableCell>
                  <TableCell>{getPriorityDropdown(task)}</TableCell>
                  <TableCell>{getDueDateOrDelayInput(task)}</TableCell>
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {onEditTask && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditTask(task.id)}
                          title="Edit task"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isExpanded && tasks.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg bg-muted/30">
          No tasks in this sequence
        </div>
      )}
    </div>
  );
}
