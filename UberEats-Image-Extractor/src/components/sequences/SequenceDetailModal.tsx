import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import {
  CheckCircle,
  Circle,
  Clock,
  Pause,
  Play,
  X,
  Calendar,
  User,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

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
  created_at?: string;
  updated_at?: string;
}

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
  created_at?: string;
  updated_at?: string;
  sequence_templates?: {
    id: string;
    name: string;
    description?: string;
  };
  restaurants?: {
    id: string;
    name: string;
  };
  tasks?: Task[];
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  assigned_to?: {
    id: string;
    full_name?: string;
    email: string;
  };
  created_by?: {
    id: string;
    full_name?: string;
    email: string;
  };
}

interface SequenceDetailModalProps {
  open: boolean;
  onClose: () => void;
  sequenceInstance: SequenceInstance;
  onRefresh?: () => void;
}

const statusColors = {
  active: 'bg-green-100 text-green-800 border-green-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
};

export function SequenceDetailModal({
  open,
  onClose,
  sequenceInstance,
  onRefresh,
}: SequenceDetailModalProps) {
  const { progress, tasks = [] } = sequenceInstance;

  const getTaskIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600 fill-green-600" />;
      case 'active':
        return <Circle className="h-4 w-4 text-blue-600 fill-blue-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; color: string }> = {
      email: { label: 'Email', color: 'bg-blue-100 text-blue-800' },
      call: { label: 'Call', color: 'bg-green-100 text-green-800' },
      text: { label: 'Text', color: 'bg-purple-100 text-purple-800' },
      social_message: { label: 'Social', color: 'bg-pink-100 text-pink-800' },
      demo_meeting: { label: 'Demo', color: 'bg-yellow-100 text-yellow-800' },
      internal_activity: { label: 'Internal', color: 'bg-gray-100 text-gray-800' }
    };

    const config = typeConfig[type] || typeConfig.internal_activity;
    return (
      <Badge className={`${config.color} text-xs px-2 py-0`}>
        {config.label}
      </Badge>
    );
  };

  const formatDueDate = (dueDate: string | null, status: string, completedAt: string | null) => {
    if (status === 'completed') {
      return completedAt
        ? new Date(completedAt).toLocaleDateString('en-NZ', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Completed';
    }
    if (!dueDate) return 'Not set';

    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    const diffTime = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';

    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDueDateColor = (dueDate: string | null, status: string) => {
    if (status === 'completed') return 'text-green-600';
    if (!dueDate) return 'text-gray-500';

    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    const diffTime = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600';
    if (diffDays === 0) return 'text-blue-600';
    return 'text-gray-700';
  };

  const getStatusText = () => {
    if (sequenceInstance.status === 'completed' && sequenceInstance.completed_at) {
      return `Completed ${formatDistanceToNow(new Date(sequenceInstance.completed_at))} ago`;
    }
    if (sequenceInstance.status === 'cancelled' && sequenceInstance.cancelled_at) {
      return `Cancelled ${formatDistanceToNow(new Date(sequenceInstance.cancelled_at))} ago`;
    }
    if (sequenceInstance.status === 'paused' && sequenceInstance.paused_at) {
      return `Paused ${formatDistanceToNow(new Date(sequenceInstance.paused_at))} ago`;
    }
    return `Started ${formatDistanceToNow(new Date(sequenceInstance.started_at))} ago`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                {sequenceInstance.name}
                <Badge className={statusColors[sequenceInstance.status]} variant="outline">
                  {sequenceInstance.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-2">
                {getStatusText()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Overview */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {progress?.completed || 0} of {progress?.total || 0} tasks completed
              </span>
              <span className="font-medium">{progress?.percentage || 0}%</span>
            </div>
            <Progress value={progress?.percentage || 0} className="h-3" />
          </div>

          <Separator />

          {/* Sequence Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Template</div>
              <div className="font-medium">{sequenceInstance.sequence_templates?.name || 'N/A'}</div>
              {sequenceInstance.sequence_templates?.description && (
                <div className="text-xs text-muted-foreground mt-1">
                  {sequenceInstance.sequence_templates.description}
                </div>
              )}
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Restaurant</div>
              {sequenceInstance.restaurants ? (
                <Link
                  to={`/restaurants/${sequenceInstance.restaurants.id}`}
                  className="font-medium text-brand-blue hover:underline inline-flex items-center gap-1"
                  onClick={onClose}
                >
                  {sequenceInstance.restaurants.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <div className="font-medium">N/A</div>
              )}
            </div>
            {sequenceInstance.assigned_to && (
              <div>
                <div className="text-muted-foreground mb-1">Assigned To</div>
                <div className="font-medium flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {sequenceInstance.assigned_to.full_name || sequenceInstance.assigned_to.email}
                </div>
              </div>
            )}
            {sequenceInstance.created_by && (
              <div>
                <div className="text-muted-foreground mb-1">Created By</div>
                <div className="font-medium flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {sequenceInstance.created_by.full_name || sequenceInstance.created_by.email}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Task Timeline */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Task Timeline</h3>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No tasks in this sequence
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      task.status === 'active' ? 'bg-blue-50 border-blue-200' : 'bg-card'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-[120px]">
                      {getTaskIcon(task.status)}
                      <span className="text-xs text-muted-foreground">
                        Step {task.sequence_step_order}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{task.name}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {task.description}
                            </div>
                          )}
                        </div>
                        {getTypeBadge(task.type)}
                      </div>
                      <div className={cn('text-xs mt-2 flex items-center gap-1', getDueDateColor(task.due_date, task.status))}>
                        <Calendar className="h-3 w-3" />
                        {formatDueDate(task.due_date, task.status, task.completed_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Audit Log */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Audit Log</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Started: {new Date(sequenceInstance.started_at).toLocaleString()}</span>
              </div>
              {sequenceInstance.paused_at && (
                <div className="flex items-center gap-2">
                  <Pause className="h-3 w-3" />
                  <span>Paused: {new Date(sequenceInstance.paused_at).toLocaleString()}</span>
                </div>
              )}
              {sequenceInstance.completed_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  <span>Completed: {new Date(sequenceInstance.completed_at).toLocaleString()}</span>
                </div>
              )}
              {sequenceInstance.cancelled_at && (
                <div className="flex items-center gap-2">
                  <X className="h-3 w-3" />
                  <span>Cancelled: {new Date(sequenceInstance.cancelled_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
