import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
import { Alert, AlertDescription } from '../ui/alert';
import { SequenceStepBuilder, StepFormData } from './SequenceStepBuilder';
import { useUpdateSequenceTemplate, SequenceTemplate } from '../../hooks/useSequences';

interface EditSequenceTemplateModalProps {
  open: boolean;
  onClose: () => void;
  template: SequenceTemplate | null;
}

export function EditSequenceTemplateModal({
  open,
  onClose,
  template,
}: EditSequenceTemplateModalProps) {
  const updateMutation = useUpdateSequenceTemplate();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [steps, setSteps] = useState<StepFormData[]>([]);

  const [errors, setErrors] = useState<string[]>([]);

  // Load template data when modal opens
  useEffect(() => {
    if (template && open) {
      setName(template.name);
      setDescription(template.description || '');
      setTags(template.tags?.join(', ') || '');
      setSteps(
        template.sequence_steps.map((step) => ({
          step_order: step.step_order,
          name: step.name,
          description: step.description || '',
          task_template_id: step.task_template_id,
          type: step.type,
          priority: step.priority,
          message_template_id: step.message_template_id,
          custom_message: step.custom_message || '',
          subject_line: step.subject_line || '',
          delay_value: step.delay_value,
          delay_unit: step.delay_unit,
        }))
      );
    }
  }, [template, open]);

  const handleStepChange = (
    index: number,
    field: keyof StepFormData,
    value: any
  ) => {
    // Use functional setState to ensure we're always working with the latest state
    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      newSteps[index] = {
        ...newSteps[index],
        [field]: value,
      };
      return newSteps;
    });
  };

  const handleAddStep = () => {
    setSteps([
      ...steps,
      {
        step_order: steps.length + 1,
        name: '',
        description: '',
        type: 'email',
        priority: 'medium',
        delay_value: 1,
        delay_unit: 'days',
        custom_message: '',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    // Renumber steps
    const renumberedSteps = newSteps.map((step, i) => ({
      ...step,
      step_order: i + 1,
    }));
    setSteps(renumberedSteps);
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;

    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      return newSteps.map((step, i) => ({
        ...step,
        step_order: i + 1,
      }));
    });
  };

  const handleMoveStepDown = (index: number) => {
    if (index === steps.length - 1) return;

    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      return newSteps.map((step, i) => ({
        ...step,
        step_order: i + 1,
      }));
    });
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Validate template name
    if (!name || name.trim().length < 3) {
      newErrors.push('Template name must be at least 3 characters');
    }

    if (name.length > 100) {
      newErrors.push('Template name must be less than 100 characters');
    }

    // Validate steps
    if (steps.length === 0) {
      newErrors.push('Template must have at least one step');
    }

    if (steps.length > 50) {
      newErrors.push('Template cannot have more than 50 steps');
    }

    // Validate each step
    steps.forEach((step, index) => {
      if (!step.name || step.name.trim().length < 3) {
        newErrors.push(`Step ${index + 1}: Name must be at least 3 characters`);
      }
      if (step.delay_value < 0) {
        newErrors.push(`Step ${index + 1}: Delay value cannot be negative`);
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (!template || !validateForm()) {
      return;
    }

    const tagsArray = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const stepsData = steps.map((step, index) => ({
      step_order: index + 1,
      name: step.name.trim(),
      description: step.description?.trim() || undefined,
      task_template_id: step.task_template_id || undefined,
      type: step.type,
      priority: step.priority,
      message_template_id: step.message_template_id || undefined,
      custom_message: step.custom_message?.trim() || undefined,
      subject_line: step.subject_line?.trim() || undefined,
      delay_value: step.delay_value,
      delay_unit: step.delay_unit,
    }));

    const updates = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tagsArray,
      steps: stepsData,
    };

    try {
      await updateMutation.mutateAsync({ id: template.id, updates });
      handleClose();
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  };

  const handleClose = () => {
    setErrors([]);
    onClose();
  };

  if (!template) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sequence Template</DialogTitle>
          <DialogDescription>
            Update template information (Note: Editing a template does not
            affect active sequences using this template)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Warning about active instances */}
          {template.usage_count > 0 && (
            <Alert>
              <AlertDescription>
                This template has been used {template.usage_count} time(s).
                Changes will only affect new sequences created from this
                template.
              </AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>

            <div>
              <Label htmlFor="template-name">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template-name"
                placeholder="e.g., Demo Follow-up Sequence"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                3-100 characters
              </p>
            </div>

            <div>
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                placeholder="Describe what this sequence is used for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional, max 1000 characters
              </p>
            </div>

            <div>
              <Label htmlFor="template-tags">Tags</Label>
              <Input
                id="template-tags"
                placeholder="demo, onboarding, follow-up (comma-separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated tags for organizing templates
              </p>
            </div>
          </div>

          {/* Steps - Editable */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Steps</h3>
                <p className="text-sm text-muted-foreground">
                  Define the tasks in this sequence (1-50 steps)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStep}
                disabled={steps.length >= 50}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <SequenceStepBuilder
                  key={index}
                  index={index}
                  step={step}
                  onChange={handleStepChange}
                  onRemove={handleRemoveStep}
                  onMoveUp={handleMoveStepUp}
                  onMoveDown={handleMoveStepDown}
                  canRemove={steps.length > 1}
                  canMoveUp={index > 0}
                  canMoveDown={index < steps.length - 1}
                  totalSteps={steps.length}
                />
              ))}
            </div>

            {steps.length === 0 && (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-muted-foreground">No steps added yet</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStep}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Step
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Updating...' : 'Update Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
