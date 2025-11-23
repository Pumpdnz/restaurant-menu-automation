import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { ExternalLink, Plus, ClipboardList, Workflow, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TaskTypeQuickView } from '../tasks/TaskTypeQuickView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TaskCellProps {
  task: {
    id: string;
    name: string;
    type: string;
    status: string;
    priority: string;
    due_date: string | null;
  } | null;
  restaurantName: string;
  restaurantId: string;
  onCreateTask?: () => void;
  onStartSequence?: () => void;
  onTaskCompleted?: () => void;
  onFollowUpRequested?: (taskId: string) => void;
  onStartSequenceRequested?: (restaurant: { id: string; name: string }) => void;
}

export function TaskCell({ task, restaurantName, restaurantId, onCreateTask, onStartSequence, onTaskCompleted, onFollowUpRequested, onStartSequenceRequested }: TaskCellProps) {
  const navigate = useNavigate();

  const handleNavigateToTasks = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/tasks', {
      state: {
        clearFilters: true,
        searchQuery: restaurantName
      }
    });
  };

  const handleCreateTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateTask) {
      onCreateTask();
    }
  };

  const handleStartSequence = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartSequence) {
      onStartSequence();
    }
  };

  if (!task) {
    return (
      <div className="flex items-center justify-between w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>No active tasks</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleCreateTask}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Add New Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleStartSequence}>
              <Workflow className="h-4 w-4 mr-2" />
              Start New Sequence
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const getTaskColor = () => {
    if (!task.due_date) return 'text-gray-500';

    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Overdue
    if (dueDate < today) return 'text-red-600 font-semibold';

    // Due today
    if (dueDate.toDateString() === today.toDateString()) {
      return 'text-blue-600 font-semibold';
    }

    // Future
    return 'text-gray-600';
  };

  return (
    <div className="flex items-center justify-between w-full min-w-0">
      <TaskTypeQuickView
        task={task}
        onTaskCompleted={onTaskCompleted}
        onFollowUpRequested={onFollowUpRequested}
        onStartSequenceRequested={onStartSequenceRequested}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "p-0 h-auto font-normal justify-start text-left overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1",
            getTaskColor()
          )}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap block text-left">
            {task.name}
          </span>
        </Button>
      </TaskTypeQuickView>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleNavigateToTasks}
        title="View all tasks for this restaurant"
        className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0 ml-2"
      >
        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
      </Button>
    </div>
  );
}
