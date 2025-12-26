import { useState, useEffect } from 'react';
import { Loader2, X, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  useSequenceTemplates,
  useSequenceTemplate,
  useBulkStartSequence,
} from '@/hooks/useSequences';

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

interface Restaurant {
  id: string;
  name: string;
  lead_stage?: string;
  lead_warmth?: string;
  lead_status?: string;
}

interface BulkStartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: BulkOperationResult, restaurants: Restaurant[]) => void;
  restaurants: Restaurant[];
}

interface BulkOperationResult {
  succeeded: {
    restaurant_id: string;
    restaurant_name: string;
    instance_id: string;
    tasks_created: number;
  }[];
  failed: {
    restaurant_id: string;
    restaurant_name: string;
    error: string;
    reason: 'not_found' | 'validation_error' | 'server_error';
  }[];
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}

export function BulkStartSequenceModal({
  open,
  onClose,
  onSuccess,
  restaurants,
}: BulkStartSequenceModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [currentRestaurants, setCurrentRestaurants] = useState<Restaurant[]>(restaurants);
  const [operationResult, setOperationResult] = useState<BulkOperationResult | null>(null);
  const [operationComplete, setOperationComplete] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useSequenceTemplates({
    is_active: true,
  });

  const { data: selectedTemplate, isLoading: templateLoading } = useSequenceTemplate(
    selectedTemplateId,
    { enabled: !!selectedTemplateId }
  );

  const bulkStartMutation = useBulkStartSequence();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentRestaurants(restaurants);
      setSelectedTemplateId('');
      setOperationResult(null);
      setOperationComplete(false);
    }
  }, [open, restaurants]);

  // Handle restaurant removal from list
  const handleRemoveRestaurant = (restaurantId: string) => {
    setCurrentRestaurants(prev => prev.filter(r => r.id !== restaurantId));

    if (currentRestaurants.length === 1) {
      toast.error('At least one restaurant is required');
      onClose();
    }
  };

  // Handle bulk sequence start
  const handleStart = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a sequence template');
      return;
    }

    if (currentRestaurants.length === 0) {
      toast.error('No restaurants selected');
      return;
    }

    try {
      const result = await bulkStartMutation.mutateAsync({
        sequence_template_id: selectedTemplateId,
        restaurant_ids: currentRestaurants.map(r => r.id),
      });

      setOperationResult(result);
      setOperationComplete(true);

      // Trigger post-sequence actions (e.g., auto-extraction)
      if (onSuccess) {
        onSuccess(result, currentRestaurants);
      }

      // Show appropriate toast based on results
      if (result.summary.failure === 0) {
        toast.success('All sequences started successfully!', {
          description: `Created sequences for ${result.summary.success} restaurant${result.summary.success !== 1 ? 's' : ''}`,
        });
      } else if (result.summary.success === 0) {
        toast.error('All sequences failed to start', {
          description: 'See details below for more information',
        });
      } else {
        toast.warning('Some sequences failed to start', {
          description: `${result.summary.success} succeeded, ${result.summary.failure} failed`,
        });
      }
    } catch (error: any) {
      console.error('Bulk start error:', error);
      toast.error('Failed to start sequences', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  };

  // Handle retry failed restaurants
  const handleRetryFailed = () => {
    if (!operationResult) return;

    // Get failed restaurant IDs
    const failedIds = new Set(operationResult.failed.map(f => f.restaurant_id));

    // Filter to only failed restaurants
    const failedRestaurants = restaurants.filter(r => failedIds.has(r.id));

    // Reset state and update restaurant list
    setCurrentRestaurants(failedRestaurants);
    setOperationResult(null);
    setOperationComplete(false);

    toast.info(`Retrying ${failedRestaurants.length} failed restaurant${failedRestaurants.length !== 1 ? 's' : ''}`);
  };

  // Handle close
  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Start Sequence for {currentRestaurants.length} Restaurant{currentRestaurants.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {operationComplete
              ? 'Bulk operation complete'
              : 'Select a sequence template to create for all selected restaurants'}
          </DialogDescription>
        </DialogHeader>

        {/* Main content - conditional based on operation state */}
        {!operationComplete ? (
          <div className="space-y-6 py-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label htmlFor="template-select">Select Sequence Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={templatesLoading || bulkStartMutation.isPending}
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

            {/* Selected Restaurants List */}
            <div className="space-y-2">
              <Label>Selected Restaurants ({currentRestaurants.length})</Label>
              <ScrollArea className="h-[200px] border rounded-md p-3">
                <div className="space-y-2">
                  {currentRestaurants.map((restaurant) => (
                    <div
                      key={restaurant.id}
                      className="flex items-center justify-between p-3 bg-accent/50 rounded-md"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{restaurant.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {restaurant.lead_stage && (
                            <Badge variant="outline" className="text-xs">
                              {restaurant.lead_stage.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {restaurant.lead_warmth && (
                            <Badge variant="secondary" className="text-xs">
                              {restaurant.lead_warmth}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRestaurant(restaurant.id)}
                        disabled={bulkStartMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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

            {/* Warning about operation */}
            {selectedTemplate && selectedTemplate.sequence_steps && selectedTemplate.sequence_steps.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will create {selectedTemplate.sequence_steps.length} task
                  {selectedTemplate.sequence_steps.length !== 1 ? 's' : ''} for each of the{' '}
                  {currentRestaurants.length} selected restaurant
                  {currentRestaurants.length !== 1 ? 's' : ''}
                  {' '}({selectedTemplate.sequence_steps.length * currentRestaurants.length} total tasks).
                </AlertDescription>
              </Alert>
            )}

            {/* Progress indicator during operation */}
            {bulkStartMutation.isPending && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Creating sequences...</span>
                  <span className="text-sm text-muted-foreground">
                    Please wait, this may take a moment
                  </span>
                </div>
                <Progress value={undefined} className="w-full" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Results Summary Cards */}
            {operationResult && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-center">
                      {operationResult.summary.total}
                    </div>
                    <div className="text-xs text-muted-foreground text-center mt-1">
                      Total
                    </div>
                  </Card>
                  <Card className="p-4 border-green-500">
                    <div className="text-2xl font-bold text-center text-green-600">
                      {operationResult.summary.success}
                    </div>
                    <div className="text-xs text-muted-foreground text-center mt-1">
                      Succeeded
                    </div>
                  </Card>
                  <Card className="p-4 border-red-500">
                    <div className="text-2xl font-bold text-center text-red-600">
                      {operationResult.summary.failure}
                    </div>
                    <div className="text-xs text-muted-foreground text-center mt-1">
                      Failed
                    </div>
                  </Card>
                </div>

                {/* Success List */}
                {operationResult.succeeded.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <Label className="text-green-600">
                        Successful ({operationResult.succeeded.length})
                      </Label>
                    </div>
                    <ScrollArea className="h-[150px] border rounded-md p-3 bg-green-50">
                      <div className="space-y-2">
                        {operationResult.succeeded.map((item) => (
                          <div
                            key={item.restaurant_id}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <span className="text-sm font-medium">{item.restaurant_name}</span>
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              {item.tasks_created} tasks created
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Failure List */}
                {operationResult.failed.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Label className="text-red-600">
                        Failed ({operationResult.failed.length})
                      </Label>
                    </div>
                    <ScrollArea className="h-[150px] border rounded-md p-3 bg-red-50">
                      <div className="space-y-3">
                        {operationResult.failed.map((item) => (
                          <div
                            key={item.restaurant_id}
                            className="space-y-1 pb-3 border-b last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{item.restaurant_name}</span>
                              <Badge variant="destructive" className="text-xs">
                                {item.reason === 'not_found' && 'Not Found'}
                                {item.reason === 'validation_error' && 'Validation Error'}
                                {item.reason === 'server_error' && 'Server Error'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.error}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer - conditional based on operation state */}
        <DialogFooter>
          {!operationComplete ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={bulkStartMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={
                  !selectedTemplateId ||
                  bulkStartMutation.isPending ||
                  templateLoading ||
                  !selectedTemplate?.sequence_steps ||
                  selectedTemplate.sequence_steps.length === 0 ||
                  currentRestaurants.length === 0
                }
              >
                {bulkStartMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Sequences...
                  </>
                ) : (
                  `Start Sequences (${currentRestaurants.length})`
                )}
              </Button>
            </>
          ) : (
            <>
              {operationResult && operationResult.failed.length > 0 && (
                <Button variant="outline" onClick={handleRetryFailed}>
                  Retry Failed ({operationResult.failed.length})
                </Button>
              )}
              <Button onClick={handleClose}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
