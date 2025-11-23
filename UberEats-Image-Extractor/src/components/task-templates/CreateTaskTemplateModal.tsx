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
import { Checkbox } from '../ui/checkbox';
import { useToast } from '../../hooks/use-toast';
import { Badge } from '../ui/badge';

interface CreateTaskTemplateModalProps {
  open: boolean;
  templateId?: string | null;
  duplicateFromId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTaskTemplateModal({
  open,
  templateId,
  duplicateFromId,
  onClose,
  onSuccess
}: CreateTaskTemplateModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);

  const isEditMode = !!templateId;
  const isDuplicateMode = !!duplicateFromId;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'internal_activity',
    priority: 'medium',
    message_template_id: '',
    default_message: '',
    subject_line: '',
    is_active: true
  });

  useEffect(() => {
    if (open) {
      fetchMessageTemplates();
      if (isEditMode && templateId) {
        fetchTemplate();
      } else if (isDuplicateMode && duplicateFromId) {
        fetchTemplate(duplicateFromId);
      }
    }
  }, [open, templateId, duplicateFromId]);

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

  const fetchTemplate = async (id?: string) => {
    const fetchId = id || templateId;
    if (!fetchId) return;

    setFetching(true);
    try {
      const response = await api.get(`/task-templates/${fetchId}`);
      const template = response.data.template;

      setFormData({
        name: template.name || '',
        description: template.description || '',
        type: template.type || 'internal_activity',
        priority: template.priority || 'medium',
        message_template_id: template.message_template_id || '',
        default_message: template.default_message || '',
        subject_line: template.subject_line || '',
        is_active: template.is_active !== undefined ? template.is_active : true
      });
    } catch (err: any) {
      console.error('Failed to fetch template:', err);
      setError('Failed to load template details');
    } finally {
      setFetching(false);
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

  const handleMessageTemplateSelect = (templateId: string) => {
    if (!templateId || templateId === 'none') {
      setFormData({ ...formData, message_template_id: '', default_message: '', subject_line: '' });
      return;
    }

    const template = messageTemplates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        message_template_id: templateId,
        default_message: '', // Clear default message when template is selected
        subject_line: template.subject_line || ''
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.type) {
      setError('Please fill in required fields');
      return;
    }

    // Validate that either message template or default message is provided for communication tasks
    if (['email', 'social_message', 'text'].includes(formData.type)) {
      if (!formData.message_template_id && !formData.default_message) {
        setError('Please select a message template or provide a default message');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Clean up data before sending
      const cleanedData: any = { ...formData };
      if (!cleanedData.message_template_id) delete cleanedData.message_template_id;
      if (!cleanedData.default_message) delete cleanedData.default_message;
      if (!cleanedData.description) delete cleanedData.description;

      const response = isEditMode
        ? await api.patch(`/task-templates/${templateId}`, cleanedData)
        : await api.post('/task-templates', cleanedData);

      if (response.data.success) {
        toast({
          title: "Success",
          description: `Task template ${isEditMode ? 'updated' : 'created'} successfully`
        });
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} template`);
      toast({
        title: "Error",
        description: err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} template`,
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
      message_template_id: '',
      default_message: '',
      subject_line: '',
      is_active: true
    });
  };

  const isMessageType = ['email', 'social_message', 'text'].includes(formData.type);
  const filteredTemplates = getFilteredMessageTemplates();

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
          <DialogTitle>
            {isEditMode ? 'Edit' : isDuplicateMode ? 'Duplicate' : 'Create'} Task Template
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update' : isDuplicateMode ? 'Duplicate' : 'Create a'} reusable task template for your sales workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
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
              placeholder="Brief description of this template..."
              rows={2}
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v, message_template_id: '', default_message: '', subject_line: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_activity">Internal Activity</SelectItem>
                  <SelectItem value="demo_meeting">Demo Meeting</SelectItem>
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

          {/* Message Template Selector (for communication tasks) */}
          {isMessageType && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message Template (Optional)</Label>
                  {formData.message_template_id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, message_template_id: '' })}
                    >
                      Clear Template
                    </Button>
                  )}
                </div>
                <Select
                  value={formData.message_template_id}
                  onValueChange={handleMessageTemplateSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a message template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template (use default message)</SelectItem>
                    {filteredTemplates.length > 0 ? (
                      filteredTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-templates" disabled>
                        No {formData.type.replace(/_/g, ' ')} templates available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.message_template_id && (
                  <p className="text-xs text-muted-foreground">
                    Tasks created from this template will use the selected message template
                  </p>
                )}
              </div>

              {/* Default Subject Line and Message (only if no message template selected) */}
              {!formData.message_template_id && (
                <div className="space-y-4">
                  {/* Subject Line (only for email type) */}
                  {formData.type === 'email' && (
                    <div className="space-y-2">
                      <Label htmlFor="subject_line">Default Email Subject Line</Label>
                      <Input
                        id="subject_line"
                        value={formData.subject_line}
                        onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                        placeholder="Enter email subject... (supports variables like {restaurant_name})"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tip: Use variables for personalization
                      </p>
                    </div>
                  )}

                  {/* Default Message */}
                  <div className="space-y-2">
                    <Label htmlFor="default_message">Default Message</Label>
                    <Textarea
                      id="default_message"
                      value={formData.default_message}
                      onChange={(e) => setFormData({ ...formData, default_message: e.target.value })}
                      placeholder="Use variables like {restaurant_name}, {contact_name}, etc."
                      rows={5}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: {'{restaurant_name}'}, {'{contact_name}'}, {'{first_name}'}, {'{city}'}, {'{cuisine}'}, {'{demo_store_url}'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Status */}
          <div className="space-y-2 pt-2">
            <Label>Status</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
              />
              <label
                htmlFor="is_active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Active
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Inactive templates won't appear in the task creation dropdown
            </p>
          </div>

          {/* Info Badge */}
          {isMessageType && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                  Tip
                </Badge>
                <p className="text-sm text-blue-800">
                  {formData.message_template_id
                    ? 'Using a message template allows you to manage message content centrally. Updates to the message template will not affect tasks already created.'
                    : 'Provide a default message that will be used when creating tasks. You can still override it per task.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading
              ? (isEditMode ? 'Updating...' : 'Creating...')
              : (isEditMode ? 'Update Template' : isDuplicateMode ? 'Create Duplicate' : 'Create Template')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
