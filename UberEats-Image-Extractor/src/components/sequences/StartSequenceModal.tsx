import { useState, useEffect } from 'react';
import { useSequenceTemplates, useSequenceTemplate, useStartSequence } from '../../hooks/useSequences';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Restaurant {
  id: string;
  name: string;
}

interface StartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
}

// Helper to calculate total duration
function calculateTotalDuration(steps: any[]) {
  if (!steps || steps.length === 0) return '0 days';

  let totalMinutes = 0;

  steps.forEach((step) => {
    const { delay_value, delay_unit } = step;
    if (delay_unit === 'minutes') {
      totalMinutes += delay_value;
    } else if (delay_unit === 'hours') {
      totalMinutes += delay_value * 60;
    } else if (delay_unit === 'days') {
      totalMinutes += delay_value * 24 * 60;
    }
  });

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);

  if (days > 0 && hours > 0) {
    return `~${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (days > 0) {
    return `~${days} day${days !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `~${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
  }
}

export function StartSequenceModal({ open, onClose, restaurant }: StartSequenceModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const { data: templates, isLoading: templatesLoading } = useSequenceTemplates({
    is_active: true
  });

  const { data: selectedTemplate, isLoading: templateLoading } = useSequenceTemplate(
    selectedTemplateId,
    { enabled: !!selectedTemplateId }
  );

  const startSequenceMutation = useStartSequence();

  // Reset selection when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
    }
  }, [open]);

  const handleStart = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a sequence template');
      return;
    }

    try {
      await startSequenceMutation.mutateAsync({
        sequence_template_id: selectedTemplateId,
        restaurant_id: restaurant.id
      });
      toast.success('Sequence started successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error starting sequence:', error);
      toast.error(error.message || 'Failed to start sequence');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Sequence for {restaurant.name}</DialogTitle>
          <DialogDescription>
            Select a sequence template to create automated follow-up tasks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template-select">Select Sequence Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              disabled={templatesLoading}
            >
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templatesLoading && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                {templates?.data && templates.data.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No active templates available
                  </div>
                )}
                {templates?.data?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.sequence_steps?.length || 0} steps)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview Timeline */}
          {selectedTemplate && !templateLoading && (
            <div className="space-y-2">
              <Label>Preview Timeline</Label>
              <Card className="p-4">
                {selectedTemplate.sequence_steps && selectedTemplate.sequence_steps.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTemplate.sequence_steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="flex items-start gap-3 text-sm"
                      >
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-medium text-xs flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{step.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Type: {step.type} • Priority: {step.priority}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {step.delay_value === 0 ? (
                            <span>immediate</span>
                          ) : (
                            <span>
                              +{step.delay_value} {step.delay_unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t text-sm text-muted-foreground">
                      Total duration: {calculateTotalDuration(selectedTemplate.sequence_steps)}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No steps defined in this template
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Loading State */}
          {templateLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Warning */}
          {selectedTemplate && selectedTemplate.sequence_steps && selectedTemplate.sequence_steps.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will create {selectedTemplate.sequence_steps.length} task
                {selectedTemplate.sequence_steps.length !== 1 ? 's' : ''} immediately.
                The first task will be active, and the rest will be pending.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={startSequenceMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={
              !selectedTemplateId ||
              startSequenceMutation.isPending ||
              templateLoading ||
              !selectedTemplate?.sequence_steps ||
              selectedTemplate.sequence_steps.length === 0
            }
          >
            {startSequenceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              'Start Sequence'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
