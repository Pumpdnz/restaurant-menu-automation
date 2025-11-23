import { useState, useEffect } from 'react';
import { useFinishSequence } from '../../hooks/useSequences';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface SequenceInstance {
  id: string;
  name: string;
  tasks: Array<{
    id: string;
    status: string;
  }>;
}

interface FinishSequenceDialogProps {
  open: boolean;
  onClose: () => void;
  sequence: SequenceInstance;
  onFinishOnly?: () => void;
  onFinishWithFollowUp?: () => void;
  onFinishWithNewSequence?: () => void;
}

type FinishOption = 'finish-only' | 'finish-followup' | 'finish-start-new';

export function FinishSequenceDialog({
  open,
  onClose,
  sequence,
  onFinishOnly,
  onFinishWithFollowUp,
  onFinishWithNewSequence,
}: FinishSequenceDialogProps) {
  const [finishOption, setFinishOption] = useState<FinishOption>('finish-only');
  const finishMutation = useFinishSequence();

  // Reset to default option when dialog opens
  useEffect(() => {
    if (open) {
      setFinishOption('finish-only');
    }
  }, [open]);

  // Calculate task counts
  const activeTasks = sequence.tasks.filter(t => t.status === 'active');
  const pendingTasks = sequence.tasks.filter(t => t.status === 'pending');

  const handleFinish = async () => {
    try {
      await finishMutation.mutateAsync(sequence.id);

      // Execute the appropriate callback based on selected option
      if (finishOption === 'finish-only' && onFinishOnly) {
        onFinishOnly();
      } else if (finishOption === 'finish-followup' && onFinishWithFollowUp) {
        onFinishWithFollowUp();
      } else if (finishOption === 'finish-start-new' && onFinishWithNewSequence) {
        onFinishWithNewSequence();
      }

      onClose();
    } catch (error) {
      // Error handling is done by the mutation hook
      console.error('Error finishing sequence:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Finish Sequence: {sequence.name}</DialogTitle>
          <DialogDescription>
            This will end the sequence early and update task statuses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task count summary */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium">Impact on tasks:</p>
              <div className="text-sm text-muted-foreground space-y-1">
                {activeTasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>
                      {activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''} will be marked as completed
                    </span>
                  </div>
                )}
                {pendingTasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-gray-500" />
                    <span>
                      {pendingTasks.length} pending task{pendingTasks.length !== 1 ? 's' : ''} will be cancelled
                    </span>
                  </div>
                )}
                {activeTasks.length === 0 && pendingTasks.length === 0 && (
                  <span>No tasks will be affected</span>
                )}
              </div>
            </div>
          </div>

          {/* Finish options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">What would you like to do next?</Label>
            <RadioGroup value={finishOption} onValueChange={(value) => setFinishOption(value as FinishOption)}>
              {/* Option A: Finish Only */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                <RadioGroupItem value="finish-only" id="finish-only" className="mt-1" />
                <div className="flex-1 cursor-pointer" onClick={() => setFinishOption('finish-only')}>
                  <Label htmlFor="finish-only" className="font-medium cursor-pointer">
                    Finish Only
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Simply end the sequence
                  </p>
                </div>
              </div>

              {/* Option B: Finish and Set Follow-Up */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                <RadioGroupItem value="finish-followup" id="finish-followup" className="mt-1" />
                <div className="flex-1 cursor-pointer" onClick={() => setFinishOption('finish-followup')}>
                  <Label htmlFor="finish-followup" className="font-medium cursor-pointer">
                    Finish and Set Follow-Up
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a follow-up task after finishing
                  </p>
                </div>
              </div>

              {/* Option C: Finish and Start New Sequence */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                <RadioGroupItem value="finish-start-new" id="finish-start-new" className="mt-1" />
                <div className="flex-1 cursor-pointer" onClick={() => setFinishOption('finish-start-new')}>
                  <Label htmlFor="finish-start-new" className="font-medium cursor-pointer">
                    Finish and Start New Sequence
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start another sequence immediately
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={finishMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleFinish} disabled={finishMutation.isPending}>
            {finishMutation.isPending ? 'Finishing...' : 'Finish Sequence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
