import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { DateTimePicker } from '../ui/date-time-picker';
import { useToast } from '../../hooks/use-toast';

interface EditTaskModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTaskModal({ open, taskId, onClose, onSuccess }: EditTaskModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'internal_activity',
    priority: 'medium',
    status: 'pending',
    message: ''
  });

  const [dueDate, setDueDate] = useState<Date | null>(null);

  useEffect(() => {
    if (open && taskId) {
      fetchTask();
    }
  }, [open, taskId]);

  const fetchTask = async () => {
    if (!taskId) return;

    setFetching(true);
    try {
      const response = await api.get(`/tasks/${taskId}`);
      const task = response.data.task;

      setFormData({
        name: task.name || '',
        description: task.description || '',
        type: task.type || 'internal_activity',
        priority: task.priority || 'medium',
        status: task.status || 'pending',
        message: task.message || ''
      });

      // Set due date if exists
      if (task.due_date) {
        setDueDate(new Date(task.due_date));
      } else {
        setDueDate(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch task:', err);
      setError('Failed to load task details');
    } finally {
      setFetching(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name || !formData.type) {
      setError('Please fill in required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare data for update
      const updateData: any = { ...formData };

      // Add due_date if set
      if (dueDate) {
        updateData.due_date = dueDate.toISOString();
      } else {
        updateData.due_date = null;
      }

      const response = await api.patch(`/tasks/${taskId}`, updateData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Task updated successfully"
        });
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update task');
      toast({
        title: "Error",
        description: err.response?.data?.error || 'Failed to update task',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/tasks/${taskId}`);
      toast({
        title: "Success",
        description: "Task deleted successfully"
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || 'Failed to delete task',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task details and status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Task Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Follow up on demo booking"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={3}
            />
          </div>

          {/* Status, Type and Priority */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_activity">Internal Activity</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="social_message">Social Message</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <DateTimePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="Set due date"
            />
          </div>

          {/* Message (for communication tasks) */}
          {['email', 'social_message', 'text'].includes(formData.type) && (
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Use variables like {restaurant_name}, {contact_name}, etc."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {'{restaurant_name}'}, {'{contact_name}'}, {'{first_name}'}, {'{city}'}, {'{cuisine}'}, {'{demo_store_url}'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            Delete Task
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? 'Updating...' : 'Update Task'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
