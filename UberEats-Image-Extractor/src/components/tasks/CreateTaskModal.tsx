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

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurantId?: string;
  duplicateFromTaskId?: string;
  followUpFromTaskId?: string;
}

export function CreateTaskModal({ open, onClose, onSuccess, restaurantId, duplicateFromTaskId, followUpFromTaskId }: CreateTaskModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDuplicateMode = !!duplicateFromTaskId;
  const isFollowUpMode = !!followUpFromTaskId;

  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMessageTemplate, setSelectedMessageTemplate] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'internal_activity',
    priority: 'medium',
    restaurant_id: restaurantId || '',
    task_template_id: '',
    message_template_id: '',
    message: ''
  });

  const [dueDate, setDueDate] = useState<Date | null>(null);

  useEffect(() => {
    if (open) {
      fetchTaskTemplates();
      fetchMessageTemplates();
      if (!restaurantId) {
        fetchRestaurants();
      }
      if (isDuplicateMode && duplicateFromTaskId) {
        fetchTaskForDuplication();
      } else if (isFollowUpMode && followUpFromTaskId) {
        fetchTaskForFollowUp();
      }
    }
  }, [open, duplicateFromTaskId, followUpFromTaskId]);

  const fetchTaskTemplates = async () => {
    try {
      const response = await api.get('/task-templates');
      setTaskTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch task templates:', error);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants/list');
      setRestaurants(response.data.restaurants || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchMessageTemplates = async () => {
    try {
      const response = await api.get('/message-templates', {
        params: { is_active: true }
      });
      setMessageTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch message templates:', error);
    }
  };

  const fetchTaskForDuplication = async () => {
    if (!duplicateFromTaskId) return;

    try {
      const response = await api.get(`/tasks/${duplicateFromTaskId}`);
      const task = response.data.task;

      setFormData({
        name: task.name || '',
        description: task.description || '',
        type: task.type || 'internal_activity',
        priority: task.priority || 'medium',
        restaurant_id: task.restaurant_id || restaurantId || '',
        task_template_id: task.task_template_id || '',
        message_template_id: task.message_template_id || '',
        message: task.message || ''
      });

      // Set due date if exists
      if (task.due_date) {
        setDueDate(new Date(task.due_date));
      }

      // Set selected message template if present
      if (task.message_template_id) {
        setSelectedMessageTemplate(task.message_template_id);
      }
    } catch (error) {
      console.error('Failed to fetch task for duplication:', error);
    }
  };

  const fetchTaskForFollowUp = async () => {
    if (!followUpFromTaskId) return;

    try {
      const response = await api.get(`/tasks/${followUpFromTaskId}`);
      const task = response.data.task;

      setFormData({
        name: task.name || '',
        description: task.description || '',
        type: task.type || 'internal_activity',
        priority: task.priority || 'medium',
        restaurant_id: task.restaurant_id || restaurantId || '',
        task_template_id: task.task_template_id || '',
        message_template_id: task.message_template_id || '',
        message: task.message || ''
      });

      // Clear due date for follow-up task
      setDueDate(null);

      // Set selected message template if present
      if (task.message_template_id) {
        setSelectedMessageTemplate(task.message_template_id);
      }
    } catch (error) {
      console.error('Failed to fetch task for follow-up:', error);
    }
  };

  const getFilteredMessageTemplates = () => {
    return messageTemplates.filter(template => {
      if (formData.type === 'email') return template.type === 'email';
      if (formData.type === 'text') return template.type === 'text';
      if (formData.type === 'social_message') return template.type === 'social_message';
      return false;
    });
  };

  const handleMessageTemplateSelect = async (templateId: string) => {
    if (!templateId || templateId === 'none') {
      setSelectedMessageTemplate('');
      setFormData({ ...formData, message_template_id: '', message: '' });
      return;
    }

    const template = messageTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedMessageTemplate(templateId);
      setFormData({
        ...formData,
        message_template_id: templateId,
        message: template.message_content
      });
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId || templateId === 'none') {
      setFormData({
        ...formData,
        task_template_id: '',
        name: '',
        description: '',
        type: 'internal_activity',
        priority: 'medium',
        message_template_id: '',
        message: ''
      });
      setSelectedMessageTemplate('');
      return;
    }

    const template = taskTemplates.find(t => t.id === templateId);
    if (template) {
      // Check if template has an associated message template
      const hasMessageTemplate = template.message_template_id && template.message_templates;

      setFormData({
        ...formData,
        task_template_id: templateId,
        name: template.name,
        description: template.description || '',
        type: template.type,
        priority: template.priority,
        // If task template has a message template, use it; otherwise use default message
        message_template_id: hasMessageTemplate ? template.message_template_id : '',
        message: hasMessageTemplate
          ? (template.message_templates.message_content || '')
          : (template.default_message || '')
      });

      // Set the selected message template if present
      if (hasMessageTemplate) {
        setSelectedMessageTemplate(template.message_template_id);
      } else {
        setSelectedMessageTemplate('');
      }
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.type) {
      setError('Please fill in required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Clean up the data before sending - remove empty strings for UUID fields
      const cleanedData: any = { ...formData };

      // Remove empty UUID fields
      if (!cleanedData.task_template_id) delete cleanedData.task_template_id;
      if (!cleanedData.message_template_id) delete cleanedData.message_template_id;
      if (!cleanedData.restaurant_id) delete cleanedData.restaurant_id;

      // Remove empty optional fields
      if (!cleanedData.message) delete cleanedData.message;
      if (!cleanedData.description) delete cleanedData.description;

      // Add due_date if set
      if (dueDate) {
        cleanedData.due_date = dueDate.toISOString();
      }

      const response = await api.post('/tasks', cleanedData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Task created successfully"
        });
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task');
      toast({
        title: "Error",
        description: err.response?.data?.error || 'Failed to create task',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'internal_activity',
      priority: 'medium',
      restaurant_id: restaurantId || '',
      task_template_id: '',
      message_template_id: '',
      message: ''
    });
    setDueDate(null);
    setSelectedMessageTemplate('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isDuplicateMode
              ? 'Duplicate Task'
              : isFollowUpMode
              ? 'Create Follow-up Task'
              : 'Create New Task'}
          </DialogTitle>
          <DialogDescription>
            {isDuplicateMode
              ? 'Duplicate task'
              : isFollowUpMode
              ? 'Create a follow-up task'
              : 'Create a task'}{' '}
            for sales activities and follow-ups
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Task Template Selector */}
          <div className="space-y-2">
            <Label>Use Template (Optional)</Label>
            <Select
              value={formData.task_template_id}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {taskTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Restaurant Selector (if not pre-selected) */}
          {!restaurantId && (
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Select
                value={formData.restaurant_id}
                onValueChange={(v) => setFormData({ ...formData, restaurant_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant..." />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(restaurant => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-4">
              {/* Message Template Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message Template (Optional)</Label>
                  {selectedMessageTemplate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMessageTemplateSelect('none')}
                    >
                      Clear Template
                    </Button>
                  )}
                </div>
                <Select
                  value={selectedMessageTemplate}
                  onValueChange={handleMessageTemplateSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a message template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template (manual message)</SelectItem>
                    {getFilteredMessageTemplates().map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message Textarea */}
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
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading
              ? 'Creating...'
              : isDuplicateMode
              ? 'Create Duplicate'
              : isFollowUpMode
              ? 'Create Follow-up'
              : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
