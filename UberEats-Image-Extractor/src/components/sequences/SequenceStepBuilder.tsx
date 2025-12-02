import { ChevronUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { VariableSelector } from '../ui/variable-selector';
import api from '../../services/api';

export interface StepFormData {
  step_order: number;
  name: string;
  description?: string;
  task_template_id?: string;
  type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call' | 'demo_meeting';
  priority: 'low' | 'medium' | 'high';
  message_template_id?: string;
  custom_message?: string;
  subject_line?: string;
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days';
}

interface SequenceStepBuilderProps {
  index: number;
  step: StepFormData;
  onChange: (index: number, field: keyof StepFormData, value: any) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  totalSteps: number;
}

export function SequenceStepBuilder({
  index,
  step,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canRemove,
  canMoveUp,
  canMoveDown,
  totalSteps,
}: SequenceStepBuilderProps) {
  // Collapse/expand state
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch task templates
  const { data: taskTemplates, error: taskTemplatesError, isLoading: taskTemplatesLoading } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await api.get('/task-templates');
      return response.data.templates || [];
    },
  });

  // Fetch message templates
  const { data: messageTemplates, error: messageTemplatesError, isLoading: messageTemplatesLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      const response = await api.get('/message-templates');
      return response.data.templates || [];
    },
  });

  // Log errors for debugging
  if (taskTemplatesError) {
    console.error('Error loading task templates:', taskTemplatesError);
  }
  if (messageTemplatesError) {
    console.error('Error loading message templates:', messageTemplatesError);
  }

  // Filter message templates by type (email, text, social_message)
  const relevantMessageTemplates = messageTemplates?.filter((template: any) => {
    if (step.type === 'email') return template.type === 'email';
    if (step.type === 'text') return template.type === 'sms';
    if (step.type === 'social_message') return template.type === 'social';
    return false;
  }) || [];

  const showMessageTemplates = ['email', 'text', 'social_message'].includes(step.type);
  const showQualificationInfo = step.type === 'demo_meeting';
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Handler to insert variable at cursor position
  const handleInsertVariable = (variable: string) => {
    const textarea = messageTextareaRef.current;
    const currentMessage = step.custom_message || '';

    if (!textarea) {
      onChange(index, 'custom_message', currentMessage + variable);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = currentMessage.substring(0, start) + variable + currentMessage.substring(end);

    onChange(index, 'custom_message', newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  // Handle task template selection
  const handleTaskTemplateChange = (templateId: string) => {
    if (templateId === 'none') {
      onChange(index, 'task_template_id', undefined);
      return;
    }

    const selectedTemplate = taskTemplates?.find((t: any) => t.id === templateId);
    if (!selectedTemplate) return;

    // CRITICAL: Set template ID first so the Select shows the right value
    onChange(index, 'task_template_id', templateId);

    // Auto-fill other fields (checking against current step values from props)
    if (!step.name || step.name === '') {
      onChange(index, 'name', selectedTemplate.name);
    }
    if (!step.description || step.description === '') {
      onChange(index, 'description', selectedTemplate.description || '');
    }
    if (selectedTemplate.type) {
      onChange(index, 'type', selectedTemplate.type);
    }
    if (selectedTemplate.priority) {
      onChange(index, 'priority', selectedTemplate.priority);
    }

    // If template has a message template, set it AND populate the message content
    if (selectedTemplate.message_template_id) {
      // Find the message template first
      const linkedMessageTemplate = messageTemplates?.find(
        (mt: any) => mt.id === selectedTemplate.message_template_id
      );

      // Set message template ID
      onChange(index, 'message_template_id', selectedTemplate.message_template_id);

      // Populate custom message
      if (linkedMessageTemplate && linkedMessageTemplate.message_content) {
        onChange(index, 'custom_message', linkedMessageTemplate.message_content);
      }

      // Populate subject line for email templates
      if (step.type === 'email' && linkedMessageTemplate && linkedMessageTemplate.subject_line) {
        onChange(index, 'subject_line', linkedMessageTemplate.subject_line);
      }
    }
  };

  // Handle message template selection
  const handleMessageTemplateChange = (templateId: string) => {
    if (templateId === 'none') {
      onChange(index, 'message_template_id', undefined);
      // Don't clear custom message - user might want to keep their edits
      return;
    }

    const selectedTemplate = messageTemplates?.find((t: any) => t.id === templateId);
    if (selectedTemplate) {
      onChange(index, 'message_template_id', templateId);

      // Always populate custom message so user can see and edit it
      if (selectedTemplate.message_content) {
        onChange(index, 'custom_message', selectedTemplate.message_content);
      }

      // Populate subject line for email templates
      if (step.type === 'email' && selectedTemplate.subject_line) {
        onChange(index, 'subject_line', selectedTemplate.subject_line);
      }
    }
  };

  // Handle type change - clear task template if type doesn't match
  const handleTypeChange = (newType: string) => {
    onChange(index, 'type', newType);

    // Clear subject line if changing away from email
    if (step.type === 'email' && newType !== 'email') {
      onChange(index, 'subject_line', '');
    }

    // If a task template is selected, check if its type matches the new type
    if (step.task_template_id) {
      const selectedTaskTemplate = taskTemplates?.find((t: any) => t.id === step.task_template_id);

      // If template type doesn't match new type, clear the task template
      if (selectedTaskTemplate && selectedTaskTemplate.type !== newType) {
        onChange(index, 'task_template_id', undefined);
        // Note: We keep message_template_id and custom_message intact
      }
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Move Up/Down Buttons */}
        <div className="flex flex-col gap-1 mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMoveUp(index)}
            disabled={!canMoveUp}
            className="h-6 w-6 p-0"
            title="Move step up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMoveDown(index)}
            disabled={!canMoveDown}
            className="h-6 w-6 p-0"
            title="Move step down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Step Number */}
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold mt-1 flex-shrink-0">
          {index + 1}
        </div>

        {/* Collapsed/Expanded Content */}
        {isCollapsed ? (
          // Collapsed View - Just show step name
          <div className="flex-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-2 text-left hover:text-primary transition-colors flex-1"
            >
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{step.name || 'Untitled Step'}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({step.type} • {step.priority} priority • {step.delay_value} {step.delay_unit})
              </span>
            </button>
          </div>
        ) : (
          // Expanded View - Show all form fields
          <>
            {/* Collapse Button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="mt-1 hover:text-primary transition-colors flex-shrink-0"
              title="Collapse step"
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {/* Form Fields */}
            <div className="flex-1 space-y-3">
          {/* Step Name */}
          <div>
            <Label htmlFor={`step-name-${index}`} className="text-xs">
              Step Name *
            </Label>
            <Input
              id={`step-name-${index}`}
              placeholder="e.g., Send demo confirmation email"
              value={step.name}
              onChange={(e) => onChange(index, 'name', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor={`step-description-${index}`} className="text-xs">
              Description (optional)
            </Label>
            <Textarea
              id={`step-description-${index}`}
              placeholder="Describe this step..."
              value={step.description || ''}
              onChange={(e) => onChange(index, 'description', e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Task Template (optional) */}
          <div>
            <Label htmlFor={`step-task-template-${index}`} className="text-xs">
              Task Template (optional)
            </Label>
            <Select
              value={step.task_template_id || 'none'}
              onValueChange={handleTaskTemplateChange}
              disabled={taskTemplatesLoading}
            >
              <SelectTrigger id={`step-task-template-${index}`} className="mt-1">
                <SelectValue placeholder={
                  taskTemplatesLoading
                    ? "Loading templates..."
                    : "Select a task template..."
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {taskTemplates && taskTemplates.length > 0 ? (
                  taskTemplates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))
                ) : (
                  !taskTemplatesLoading && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No task templates available
                    </div>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {taskTemplatesError
                ? "Error loading templates"
                : "Use a predefined task template"}
            </p>
          </div>

          {/* Message Template (conditional - only for email/text/social) */}
          {showMessageTemplates && (
            <div>
              <Label htmlFor={`step-message-template-${index}`} className="text-xs">
                Message Template (optional)
              </Label>
              <Select
                value={step.message_template_id || 'none'}
                onValueChange={handleMessageTemplateChange}
                disabled={messageTemplatesLoading}
              >
                <SelectTrigger id={`step-message-template-${index}`} className="mt-1">
                  <SelectValue placeholder={
                    messageTemplatesLoading
                      ? "Loading templates..."
                      : "Select a message template..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (use custom message)</SelectItem>
                  {relevantMessageTemplates && relevantMessageTemplates.length > 0 ? (
                    relevantMessageTemplates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))
                  ) : (
                    !messageTemplatesLoading && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No {step.type} message templates available
                      </div>
                    )
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {messageTemplatesError
                  ? "Error loading templates"
                  : "Pre-filled message template for this step"}
              </p>
            </div>
          )}

          {/* Subject Line - Only for Email type */}
          {step.type === 'email' && (
            <div>
              <Label htmlFor={`step-subject-${index}`} className="text-xs">
                Email Subject (optional)
              </Label>
              <Input
                id={`step-subject-${index}`}
                placeholder="e.g., Demo booking confirmation - {restaurant_name}"
                value={step.subject_line || ''}
                onChange={(e) => onChange(index, 'subject_line', e.target.value)}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports variables like {'{restaurant_name}'}, {'{contact_name}'}
              </p>
            </div>
          )}

          {/* Qualification Info for Demo Meeting */}
          {showQualificationInfo && (
            <div className="col-span-full">
              <Label className="text-xs mb-2 block">Demo Qualification Details</Label>
              <div className="p-4 border rounded-md bg-blue-50 space-y-2">
                <p className="text-sm text-blue-900 font-medium">
                  📝 Demo Meeting Task
                </p>
                <p className="text-xs text-blue-800">
                  When this step executes, a demo meeting task will be created for the sales rep.
                  The task will include the QualificationForm for collecting demo details.
                </p>
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> You can pre-fill qualification data in the task template
                  if you want default values for this sequence.
                </p>
              </div>
            </div>
          )}

          {/* Type, Priority, and Delay in one row */}
          <div className="grid grid-cols-4 gap-2">
            {/* Type */}
            <div>
              <Label className="text-xs">Type *</Label>
              <Select
                value={step.type}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="social_message">Social Message</SelectItem>
                  <SelectItem value="demo_meeting">Demo Meeting</SelectItem>
                  <SelectItem value="internal_activity">Internal Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-xs">Priority *</Label>
              <Select
                value={step.priority}
                onValueChange={(value) => onChange(index, 'priority', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delay Value */}
            <div>
              <Label className="text-xs">
                {index === 0 ? 'Start delay' : 'Delay after previous'}
              </Label>
              <Input
                type="number"
                min="0"
                value={step.delay_value}
                onChange={(e) =>
                  onChange(index, 'delay_value', parseInt(e.target.value) || 0)
                }
                className="mt-1"
              />
            </div>

            {/* Delay Unit */}
            <div>
              <Label className="text-xs">Unit</Label>
              <Select
                value={step.delay_unit}
                onValueChange={(value) => onChange(index, 'delay_unit', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Message (optional) */}
          <div>
            <Label htmlFor={`step-message-${index}`} className="text-xs">
              Custom Message (optional)
            </Label>
            <Textarea
              ref={messageTextareaRef}
              id={`step-message-${index}`}
              placeholder="Custom message for this step (supports variables like {restaurant_name})"
              value={step.custom_message || ''}
              onChange={(e) => onChange(index, 'custom_message', e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Available Variables Reference */}
          <div className="border-t pt-3 mt-3">
            <VariableSelector onVariableSelect={handleInsertVariable} />
          </div>
        </div>
          </>
        )}

        {/* Delete Button */}
        {canRemove && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onRemove(index)}
            className="mt-1 flex-shrink-0"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </Card>
  );
}
