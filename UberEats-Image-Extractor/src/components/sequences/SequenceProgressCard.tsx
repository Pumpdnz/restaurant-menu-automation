import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Pause,
  Play,
  X,
  ExternalLink,
  Eye,
  CheckCircle2,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { SequenceTaskList } from './SequenceTaskList';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { SequenceDetailModal } from './SequenceDetailModal';

interface SequenceInstance {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_step_order: number;
  total_steps: number;
  started_at: string;
  completed_at?: string;
  cancelled_at?: string;
  paused_at?: string;
  sequence_templates?: {
    id: string;
    name: string;
  };
  restaurants?: {
    id: string;
    name: string;
  };
  tasks?: Array<{
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
  }>;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface SequenceProgressCardProps {
  instance: SequenceInstance;
  onPause?: (instanceId: string) => void;
  onResume?: (instanceId: string) => void;
  onCancel?: (instanceId: string) => void;
  onFinish?: (instanceId: string, option: 'finish-only' | 'finish-followup' | 'finish-start-new') => void;
  onDelete?: (instanceId: string) => void;
  onRefresh?: () => void;
  onStartSequence?: (restaurant: { id: string; name: string }) => void;
  onFollowUpTask?: (taskId: string) => void;
  compact?: boolean;
  hideRestaurantLink?: boolean;
}

const statusColors = {
  active: 'bg-green-100 text-green-800 border-green-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
};

export function SequenceProgressCard({
  instance,
  onPause,
  onResume,
  onCancel,
  onFinish,
  onDelete,
  onRefresh,
  onStartSequence,
  onFollowUpTask,
  compact = false,
  hideRestaurantLink = false
}: SequenceProgressCardProps) {
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [sequenceDetailOpen, setSequenceDetailOpen] = useState(false);
  const progress = instance.progress || { completed: 0, total: instance.total_steps || 0, percentage: 0 };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleTaskCompleted = () => {
    // Task was completed successfully by TaskTypeQuickView
    // Trigger data refresh to show updated sequence state
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleEditTask = (taskId: string) => {
    setEditTaskId(taskId);
  };

  const handleViewSequenceDetails = () => {
    setSequenceDetailOpen(true);
  };

  // Get time ago text
  const getTimeAgoText = () => {
    if (instance.status === 'completed' && instance.completed_at) {
      return `Completed ${formatDistanceToNow(new Date(instance.completed_at))} ago`;
    }
    if (instance.status === 'cancelled' && instance.cancelled_at) {
      return `Cancelled ${formatDistanceToNow(new Date(instance.cancelled_at))} ago`;
    }
    if (instance.status === 'paused' && instance.paused_at) {
      return `Paused ${formatDistanceToNow(new Date(instance.paused_at))} ago`;
    }
    return `Started ${formatDistanceToNow(new Date(instance.started_at))} ago`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <span className="truncate">{instance.name}</span>
              <Badge className={statusColors[instance.status]} variant="outline">
                {instance.status}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {getTimeAgoText()} • Step {instance.current_step_order} of {instance.total_steps}
            </CardDescription>
            {instance.restaurants && !hideRestaurantLink && (
              <div className="text-sm text-muted-foreground mt-1">
                Restaurant: <Link
                  to={`/restaurants/${instance.restaurants.id}`}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {instance.restaurants.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {progress.completed} of {progress.total} completed
            </span>
            <span className="font-medium">{progress.percentage}%</span>
          </div>
          <AnimatedProgressBar value={progress.percentage} />
        </div>

        {/* Task List */}
        {!compact && instance.tasks && (
          <SequenceTaskList
            tasks={instance.tasks}
            isExpanded={isTasksExpanded}
            onToggleExpand={() => setIsTasksExpanded(!isTasksExpanded)}
            onTaskClick={handleTaskClick}
            onTaskComplete={handleTaskCompleted}
            onEditTask={handleEditTask}
            onViewDetails={handleTaskClick}
            onRefresh={onRefresh}
            onStartSequence={onStartSequence}
            onFollowUpTask={onFollowUpTask}
          />
        )}
      </CardContent>

      <CardFooter className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleViewSequenceDetails}>
          <Eye className="h-4 w-4 mr-1" />
          View Details
        </Button>

        {instance.status === 'active' && onPause && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(instance.id)}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
            {onCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancel(instance.id)}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
          </>
        )}

        {instance.status === 'paused' && onResume && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResume(instance.id)}
          >
            <Play className="h-4 w-4 mr-1" />
            Resume
          </Button>
        )}

        {/* Finish Dropdown - for active and paused sequences */}
        {['active', 'paused'].includes(instance.status) && onFinish && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finish
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onFinish(instance.id, 'finish-only')}>
                <CheckCircle2 className="h-4 w-4 text-brand-green mr-2" />
                Finish Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFinish(instance.id, 'finish-followup')}>
                <CheckCircle2 className="h-4 w-4 text-brand-green mr-2" />
                Finish & Set Follow-up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFinish(instance.id, 'finish-start-new')}>
                <CheckCircle2 className="h-4 w-4 text-brand-green mr-2" />
                Finish & Start New Sequence
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Delete Button - for completed and cancelled sequences */}
        {['completed', 'cancelled'].includes(instance.status) && onDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(instance.id)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
      </CardFooter>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Edit Task Modal */}
      {editTaskId && (
        <TaskDetailModal
          taskId={editTaskId}
          open={!!editTaskId}
          onClose={() => setEditTaskId(null)}
          onSuccess={() => {
            setEditTaskId(null);
            if (onRefresh) {
              onRefresh();
            }
          }}
          initialMode="edit"
        />
      )}

      {/* Sequence Detail Modal */}
      <SequenceDetailModal
        open={sequenceDetailOpen}
        onClose={() => setSequenceDetailOpen(false)}
        sequenceInstance={instance}
        onRefresh={onRefresh}
      />
    </Card>
  );
}

// Animated Progress Bar Component
function AnimatedProgressBar({ value }: { value: number }) {
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-blue-light-1 via-brand-blue to-brand-coral transition-all duration-500 ease-out relative overflow-hidden"
        style={{ width: `${value}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}
