# Feature 1: Bulk Add Restaurants to Sequences - Implementation Plan

**Date:** November 24, 2025
**Status:** 📋 READY FOR IMPLEMENTATION
**Estimated Time:** 11-16 hours
**Priority:** Parallel with Features 2 & 3

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Phase 1: Frontend - SelectRestaurantForSequenceModal](#phase-1-frontend---selectrestaurantforsequencemodal)
4. [Phase 2: Frontend - BulkStartSequenceModal](#phase-2-frontend---bulkstartsequencemodal)
5. [Phase 3: Backend - Bulk Service & Endpoint](#phase-3-backend---bulk-service--endpoint)
6. [Phase 4: React Query Hook](#phase-4-react-query-hook)
7. [Phase 5: Integration - Sequences.tsx](#phase-5-integration---sequencestsx)
8. [Phase 6: Testing & Validation](#phase-6-testing--validation)
9. [Future Extensibility](#future-extensibility)
10. [Deployment Checklist](#deployment-checklist)

---

## Implementation Overview

### Goal

Enable users to select multiple restaurants and start the same sequence for all of them simultaneously, with comprehensive error handling and progress feedback.

### Key Requirements (From Discussion)

✅ **Approved:**
- Soft limit: 50 restaurants (warning)
- Hard limit: 100 restaurants (error)
- Dropdown mode selection (Single vs Bulk)
- Partial success error handling
- Performance: Best effort, no specific benchmark
- Extensible for future async job queue

✅ **Critical Change:**
- **NO duplicate sequence checking** - Restaurants can have multiple active sequences of the same template
- Error handling focuses on: restaurant not found, template errors, server errors

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks "New Sequence" dropdown                         │
│   ├─ "Single Restaurant"    → Existing flow (unchanged)    │
│   └─ "Multiple Restaurants" → NEW bulk flow                │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ SelectRestaurantForSequenceModal (ENHANCED)                 │
│   - allowMultiple={true} enables checkboxes                │
│   - User selects N restaurants (max 100)                    │
│   - onSelectRestaurants(restaurants[]) callback             │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ BulkStartSequenceModal (NEW COMPONENT)                      │
│   - Shows selected restaurants                              │
│   - Template selection                                       │
│   - Progress tracking during creation                       │
│   - Success/failure results display                         │
│   - Retry failed functionality                              │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ POST /api/sequence-instances/bulk (NEW ENDPOINT)           │
│   - Body: { sequence_template_id, restaurant_ids[] }       │
│   - Returns: { succeeded[], failed[], summary }            │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ startSequenceBulk() service (NEW FUNCTION)                  │
│   - Validates template                                       │
│   - Fetches all restaurants (bulk query)                    │
│   - Creates sequences independently per restaurant          │
│   - Tracks success/failure with detailed errors             │
│   - Returns comprehensive results                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Decisions

### Decision 1: No Duplicate Sequence Checking

**Updated Implementation:**
- Remove all duplicate checking logic from investigation document
- Allow multiple active sequences of same template per restaurant
- Simplifies bulk operation significantly
- Future enhancement: Add duplicate detection UI (warnings, not errors)

**Impact:**
- ✅ Faster bulk operations (no duplicate check queries)
- ✅ Simpler error handling (one less error category)
- ✅ More flexible for users
- ⚠️ May result in "duplicate" sequences (acceptable per requirements)

---

### Decision 2: Error Categories (Updated)

**Removed:**
- ~~`duplicate` - Active sequence already exists~~

**Remaining Error Types:**
```typescript
type ErrorReason =
  | 'not_found'          // Restaurant doesn't exist
  | 'validation_error'   // Template inactive, no steps, etc.
  | 'server_error';      // Database errors, network issues
```

**Error Handling Strategy:**
- Pre-flight validation: Template check (fail fast for all)
- Per-restaurant validation: Restaurant existence
- Per-restaurant creation: Catch all errors, continue processing
- Rollback: Delete instance if task creation fails

---

### Decision 3: Extensibility for Async Jobs

**Current Implementation (Synchronous):**
- Direct API call
- Wait for all sequences to complete
- Return full results

**Future Async Implementation (Extensible):**
```typescript
// Phase 1: Create operation record
POST /api/sequence-instances/bulk
Response: {
  operation_id: "uuid",
  status: "queued" | "in_progress"
}

// Phase 2: Poll for progress
GET /api/sequence-instances/bulk/:operation_id/status
Response: {
  status: "in_progress",
  completed: 10,
  total: 50,
  current_restaurant: "Pizza Palace"
}

// Phase 3: Get final results
GET /api/sequence-instances/bulk/:operation_id/results
Response: { succeeded[], failed[], summary }
```

**Extensibility Points in Current Implementation:**
1. Service returns operation ID (even if synchronous)
2. Results structure remains same
3. Frontend can poll instead of wait
4. Backend can switch to job queue without API changes

---

## Phase 1: Frontend - SelectRestaurantForSequenceModal

**Estimated Time:** 2-3 hours

**File:** `/src/components/sequences/SelectRestaurantForSequenceModal.tsx`

### 1.1 Update Interface (10 min)

```typescript
interface SelectRestaurantForSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void;      // Existing - single select
  onSelectRestaurants?: (restaurants: any[]) => void; // NEW - bulk select
  allowMultiple?: boolean;                             // NEW - enable multi-select mode
}
```

### 1.2 Add State Management (15 min)

```typescript
export function SelectRestaurantForSequenceModal({
  open,
  onClose,
  onSelectRestaurant,
  onSelectRestaurants,
  allowMultiple = false,
}: SelectRestaurantForSequenceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    lead_status: [] as string[],
    lead_stage: [] as string[],
    lead_warmth: [] as string[],
  });

  // NEW: Multi-select state
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);

  const { data: restaurants, isLoading } = useRestaurants();

  // Existing filtering logic...
  const filteredRestaurants = useMemo(() => {
    // ... existing filter code
  }, [restaurants, searchTerm, filters]);

  // NEW: Reset selection when modal closes or mode changes
  useEffect(() => {
    if (!open) {
      setSelectedRestaurantIds([]);
      setSearchTerm('');
      setFilters({
        lead_status: [],
        lead_stage: [],
        lead_warmth: [],
      });
    }
  }, [open]);

  // NEW: Toggle restaurant selection
  const handleToggleRestaurant = (restaurantId: string) => {
    setSelectedRestaurantIds(prev =>
      prev.includes(restaurantId)
        ? prev.filter(id => id !== restaurantId)
        : [...prev, restaurantId]
    );
  };

  // NEW: Select all filtered restaurants
  const handleSelectAll = () => {
    const MAX_SELECTION = 100;

    if (filteredRestaurants.length > MAX_SELECTION) {
      toast.error(`Cannot select more than ${MAX_SELECTION} restaurants at once`);
      return;
    }

    setSelectedRestaurantIds(filteredRestaurants.map(r => r.id));
    toast.success(`Selected ${filteredRestaurants.length} restaurant${filteredRestaurants.length !== 1 ? 's' : ''}`);
  };

  // NEW: Clear all selections
  const handleClearAll = () => {
    setSelectedRestaurantIds([]);
  };

  // NEW: Confirm selection and proceed
  const handleConfirmSelection = () => {
    const WARN_THRESHOLD = 50;

    const selectedRestaurants = restaurants?.filter(r =>
      selectedRestaurantIds.includes(r.id)
    ) || [];

    if (selectedRestaurants.length === 0) {
      toast.error('Please select at least one restaurant');
      return;
    }

    if (selectedRestaurants.length > WARN_THRESHOLD) {
      toast.info('Large selection - bulk operation may take a moment...', {
        duration: 3000,
      });
    }

    onSelectRestaurants?.(selectedRestaurants);
  };

  // ... rest of component
}
```

### 1.3 Update Dialog Header (5 min)

```tsx
<DialogHeader>
  <DialogTitle>
    {allowMultiple ? 'Select Restaurants for Bulk Sequence' : 'Select Restaurant for Sequence'}
  </DialogTitle>
  <DialogDescription>
    {allowMultiple
      ? 'Choose multiple restaurants to start the same sequence for all at once'
      : 'Choose a restaurant to start a new sequence'}
  </DialogDescription>
</DialogHeader>
```

### 1.4 Add Selection Toolbar (30 min)

```tsx
{/* Selection toolbar - shown when in multi-select mode */}
{allowMultiple && (
  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border">
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-medium">
          {selectedRestaurantIds.length} selected
        </Badge>
        {selectedRestaurantIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        )}
      </div>

      {filteredRestaurants.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={filteredRestaurants.length > 100}
        >
          Select All ({filteredRestaurants.length})
        </Button>
      )}
    </div>

    <Button
      onClick={handleConfirmSelection}
      disabled={selectedRestaurantIds.length === 0}
      className="bg-gradient-to-r from-brand-blue to-brand-green"
    >
      Continue ({selectedRestaurantIds.length})
    </Button>
  </div>
)}
```

### 1.5 Update Restaurant List UI (45 min)

```tsx
<ScrollArea className="h-[380px] pr-4">
  <div className="space-y-2">
    {isLoading && (
      <p className="text-center text-muted-foreground py-8">Loading restaurants...</p>
    )}

    {!isLoading && filteredRestaurants.length === 0 && (
      <p className="text-center text-muted-foreground py-8">
        {searchTerm || filters.lead_status.length > 0 || filters.lead_stage.length > 0 || filters.lead_warmth.length > 0
          ? 'No restaurants found matching your filters'
          : 'No restaurants available'}
      </p>
    )}

    {filteredRestaurants.map((restaurant) => {
      const isSelected = selectedRestaurantIds.includes(restaurant.id);

      return (
        <div
          key={restaurant.id}
          className={cn(
            "flex items-center gap-3 p-4 border rounded-lg transition-colors",
            allowMultiple
              ? isSelected
                ? "bg-accent border-primary cursor-pointer"
                : "hover:bg-accent/50 cursor-pointer"
              : "hover:bg-accent cursor-pointer"
          )}
          onClick={() => {
            if (allowMultiple) {
              handleToggleRestaurant(restaurant.id);
            } else {
              onSelectRestaurant(restaurant);
            }
          }}
        >
          {/* Checkbox for multi-select mode */}
          {allowMultiple && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleToggleRestaurant(restaurant.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* Restaurant info */}
          <div className="flex-1">
            <h4 className="font-medium">{restaurant.name}</h4>
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
              {restaurant.lead_status && (
                <Badge variant="secondary" className="text-xs">
                  {restaurant.lead_status}
                </Badge>
              )}
            </div>
          </div>

          {/* Action indicator */}
          {!allowMultiple && (
            <Button size="sm" onClick={(e) => {
              e.stopPropagation();
              onSelectRestaurant(restaurant);
            }}>
              Select
            </Button>
          )}
        </div>
      );
    })}
  </div>
</ScrollArea>
```

### 1.6 Add Warning for Large Selections (15 min)

```tsx
{/* Warning for large selections */}
{allowMultiple && selectedRestaurantIds.length >= 50 && (
  <Alert variant={selectedRestaurantIds.length >= 100 ? "destructive" : "default"}>
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      {selectedRestaurantIds.length >= 100
        ? `Maximum 100 restaurants can be selected. Please reduce your selection.`
        : `Large selection (${selectedRestaurantIds.length} restaurants). The bulk operation may take a moment to complete.`
      }
    </AlertDescription>
  </Alert>
)}
```

### 1.7 Add Required Imports (5 min)

```typescript
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
```

### Testing Checklist - Phase 1

- [ ] Single-select mode works unchanged (backward compatibility)
- [ ] Multi-select mode shows checkboxes
- [ ] Clicking checkbox toggles selection
- [ ] Clicking row toggles selection (multi-select mode)
- [ ] Selected count displays correctly
- [ ] "Select All" selects all filtered restaurants
- [ ] "Select All" respects 100 limit
- [ ] "Clear All" resets selection
- [ ] "Continue" button enabled only when ≥1 selected
- [ ] "Continue" button shows correct count
- [ ] Warning appears at 50+ selections
- [ ] Error appears at 100+ selections
- [ ] Selection state resets when modal closes
- [ ] Filters work correctly with selection
- [ ] Search works correctly with selection

---

## Phase 2: Frontend - BulkStartSequenceModal

**Estimated Time:** 3-4 hours

**File:** `/src/components/sequences/BulkStartSequenceModal.tsx` (NEW)

### 2.1 Create Component Structure (1 hour)

```typescript
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

// Helper to calculate total duration (reuse from StartSequenceModal)
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
            {/* TEMPLATE SELECTION - implemented in section 2.2 */}
            {/* RESTAURANT LIST - implemented in section 2.3 */}
            {/* PREVIEW TIMELINE - implemented in section 2.4 */}
            {/* WARNINGS - implemented in section 2.5 */}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* RESULTS DISPLAY - implemented in section 2.6 */}
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
```

### 2.2 Template Selection Section (20 min)

```tsx
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
```

### 2.3 Restaurant List Preview (30 min)

```tsx
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
```

### 2.4 Preview Timeline (30 min)

```tsx
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
```

### 2.5 Warnings & Progress (20 min)

```tsx
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
    <Progress value={undefined} className="w-full" /> {/* Indeterminate */}
  </div>
)}
```

### 2.6 Results Display (1 hour)

```tsx
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
```

### Testing Checklist - Phase 2

- [ ] Modal displays correct restaurant count
- [ ] Restaurant list shows all selected restaurants
- [ ] Remove button removes restaurant from list
- [ ] Removing last restaurant closes modal with warning
- [ ] Template selection works
- [ ] Template preview shows all steps correctly
- [ ] Duration calculation accurate
- [ ] Warning displays total task count correctly
- [ ] Progress indicator shows during operation
- [ ] Success results display correctly
- [ ] Failure results display correctly
- [ ] Retry button appears when failures exist
- [ ] Retry button filters to only failed restaurants
- [ ] Close button works in all states
- [ ] Modal resets state when closed

---

## Phase 3: Backend - Bulk Service & Endpoint

**Estimated Time:** 3-4 hours

### 3.1 Create Bulk Service Method (2.5 hours)

**File:** `/src/services/sequence-instances-service.js`

```javascript
/**
 * Start sequences for multiple restaurants (bulk operation)
 * NOTE: No duplicate checking - restaurants can have multiple sequences
 *
 * @param {string} templateId - Sequence template ID
 * @param {string[]} restaurantIds - Array of restaurant IDs (max 100)
 * @param {object} options - Additional options (assigned_to, created_by)
 * @returns {Promise<object>} Bulk operation results
 */
async function startSequenceBulk(templateId, restaurantIds, options = {}) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // Validation
  if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
    throw new Error('At least one restaurant_id is required');
  }

  if (restaurantIds.length > 100) {
    throw new Error('Maximum 100 restaurants per bulk operation');
  }

  // Initialize result tracking
  const results = {
    succeeded: [],
    failed: [],
    summary: {
      total: restaurantIds.length,
      success: 0,
      failure: 0
    }
  };

  try {
    // ===============================================
    // STEP 1: Pre-flight Template Validation
    // (Fail fast for all if template is invalid)
    // ===============================================
    const template = await getSequenceTemplateById(templateId);

    if (!template.is_active) {
      throw new Error('Cannot start sequences from inactive template');
    }

    if (!template.sequence_steps || template.sequence_steps.length === 0) {
      throw new Error('Template has no steps');
    }

    // ===============================================
    // STEP 2: Bulk Fetch Restaurants (Optimization)
    // Single query to get all restaurants at once
    // ===============================================
    const { data: restaurants, error: restaurantsError } = await client
      .from('restaurants')
      .select('*')
      .in('id', restaurantIds)
      .eq('organisation_id', orgId);

    if (restaurantsError) {
      console.error('Error fetching restaurants:', restaurantsError);
      throw new Error('Failed to fetch restaurants');
    }

    // Create map for quick lookups
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

    // ===============================================
    // STEP 3: Process Each Restaurant Independently
    // ===============================================
    for (const restaurantId of restaurantIds) {
      try {
        // Check if restaurant exists
        const restaurant = restaurantMap.get(restaurantId);
        if (!restaurant) {
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: 'Unknown',
            error: 'Restaurant not found or not accessible',
            reason: 'not_found'
          });
          continue;
        }

        // Create sequence instance
        const instanceName = `${template.name} - ${restaurant.name} - ${new Date().toISOString().split('T')[0]}`;

        const { data: instance, error: instanceError } = await client
          .from('sequence_instances')
          .insert({
            sequence_template_id: templateId,
            restaurant_id: restaurantId,
            organisation_id: orgId,
            name: instanceName,
            status: 'active',
            current_step_order: 1,
            total_steps: template.sequence_steps.length,
            assigned_to: options.assigned_to || options.created_by,
            created_by: options.created_by
          })
          .select()
          .single();

        if (instanceError) {
          console.error(`Error creating instance for ${restaurant.name}:`, instanceError);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: instanceError.message || 'Failed to create sequence instance',
            reason: 'server_error'
          });
          continue;
        }

        // Create tasks for this sequence
        const tasksToCreate = [];
        const now = new Date();

        for (const step of template.sequence_steps) {
          let message = step.custom_message;

          // Get message from template if referenced
          if (step.message_template_id && step.message_templates) {
            message = step.message_templates.message_content;
          } else if (step.task_template_id && step.task_templates && !message) {
            message = step.task_templates.default_message;
          }

          // Render message with variables
          let messageRendered = null;
          if (message) {
            try {
              messageRendered = await variableReplacementService.replaceVariables(message, restaurant);
            } catch (varError) {
              console.warn(`Variable replacement failed for ${restaurant.name}:`, varError);
              // Continue with unrendered message
              messageRendered = message;
            }
          }

          // Render subject line with variables (for email types)
          let subjectLineRendered = null;
          if (step.type === 'email' && step.subject_line) {
            try {
              subjectLineRendered = await variableReplacementService.replaceVariables(step.subject_line, restaurant);
            } catch (varError) {
              console.warn(`Subject line variable replacement failed for ${restaurant.name}:`, varError);
              // Continue with unrendered subject
              subjectLineRendered = step.subject_line;
            }
          }

          // Calculate due_date for first step
          let dueDate = null;
          let status = 'pending';

          if (step.step_order === 1) {
            status = 'active';
            dueDate = calculateDueDate(now, step.delay_value, step.delay_unit);
          }

          tasksToCreate.push({
            organisation_id: orgId,
            restaurant_id: restaurantId,
            sequence_instance_id: instance.id,
            sequence_step_order: step.step_order,
            task_template_id: step.task_template_id,
            message_template_id: step.message_template_id,
            assigned_to: options.assigned_to || options.created_by,
            created_by: options.created_by,
            name: step.name,
            description: step.description,
            status: status,
            type: step.type,
            priority: step.priority,
            message: message,
            message_rendered: messageRendered,
            subject_line: step.subject_line || null,
            subject_line_rendered: subjectLineRendered,
            due_date: dueDate
          });
        }

        // Batch insert tasks
        const { data: createdTasks, error: tasksError } = await client
          .from('tasks')
          .insert(tasksToCreate)
          .select();

        if (tasksError) {
          // ROLLBACK: Delete sequence instance
          await client.from('sequence_instances').delete().eq('id', instance.id);
          console.error(`Error creating tasks for ${restaurant.name}:`, tasksError);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: tasksError.message || 'Failed to create tasks',
            reason: 'server_error'
          });
          continue;
        }

        // Verify all tasks were created
        if (createdTasks.length !== template.sequence_steps.length) {
          // ROLLBACK: Delete sequence instance
          await client.from('sequence_instances').delete().eq('id', instance.id);
          console.error(`Incomplete task creation for ${restaurant.name}`);
          results.failed.push({
            restaurant_id: restaurantId,
            restaurant_name: restaurant.name,
            error: `Only ${createdTasks.length} of ${template.sequence_steps.length} tasks were created`,
            reason: 'server_error'
          });
          continue;
        }

        // SUCCESS!
        results.succeeded.push({
          restaurant_id: restaurantId,
          restaurant_name: restaurant.name,
          instance_id: instance.id,
          tasks_created: createdTasks.length
        });

      } catch (error) {
        // Catch any unexpected errors for this restaurant
        console.error(`Unexpected error processing restaurant ${restaurantId}:`, error);
        const restaurant = restaurantMap.get(restaurantId);
        results.failed.push({
          restaurant_id: restaurantId,
          restaurant_name: restaurant?.name || 'Unknown',
          error: error.message || 'Unexpected server error',
          reason: 'server_error'
        });
      }
    }

    // ===============================================
    // STEP 4: Update Template Usage Count
    // ===============================================
    if (results.succeeded.length > 0) {
      await client
        .from('sequence_templates')
        .update({ usage_count: (template.usage_count || 0) + results.succeeded.length })
        .eq('id', templateId);
    }

    // ===============================================
    // STEP 5: Calculate Final Summary
    // ===============================================
    results.summary.success = results.succeeded.length;
    results.summary.failure = results.failed.length;

    console.log(`[Bulk Sequence] Completed: ${results.summary.success} succeeded, ${results.summary.failure} failed`);

    return results;

  } catch (error) {
    // Pre-flight errors (template validation, etc.)
    console.error('Error in startSequenceBulk (pre-flight):', error);
    throw error;
  }
}

// Export new function
module.exports = {
  startSequence,
  startSequenceBulk, // NEW
  getSequenceInstance,
  listSequenceInstances,
  pauseSequence,
  resumeSequence,
  cancelSequence,
  finishSequence,
  getRestaurantSequences,
  getSequenceProgress
};
```

### 3.2 Create Bulk API Endpoint (1 hour)

**File:** `/src/routes/sequence-instances-routes.js`

```javascript
/**
 * POST /api/sequence-instances/bulk
 * Start sequences for multiple restaurants
 *
 * Request Body:
 * {
 *   sequence_template_id: UUID (required),
 *   restaurant_ids: UUID[] (required, 1-100 items),
 *   assigned_to: UUID (optional)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     succeeded: [...],
 *     failed: [...],
 *     summary: { total, success, failure }
 *   }
 * }
 */
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    // ===============================================
    // Validate Required Fields
    // ===============================================
    if (!req.body.sequence_template_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sequence_template_id'
      });
    }

    if (!req.body.restaurant_ids || !Array.isArray(req.body.restaurant_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid field: restaurant_ids (must be an array)'
      });
    }

    if (req.body.restaurant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one restaurant_id is required'
      });
    }

    if (req.body.restaurant_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 restaurants per bulk operation'
      });
    }

    // ===============================================
    // Prepare Options
    // ===============================================
    const options = {
      assigned_to: req.body.assigned_to || req.user.id,
      created_by: req.user.id
    };

    // ===============================================
    // Execute Bulk Operation
    // ===============================================
    const results = await sequenceInstancesService.startSequenceBulk(
      req.body.sequence_template_id,
      req.body.restaurant_ids,
      options
    );

    // ===============================================
    // Determine Status Code
    // ===============================================
    let statusCode = 201; // Created (all succeeded)

    if (results.summary.success > 0 && results.summary.failure > 0) {
      statusCode = 207; // Multi-Status (partial success)
    } else if (results.summary.failure > 0 && results.summary.success === 0) {
      statusCode = 207; // Multi-Status (all failed, but operation completed)
    }

    // ===============================================
    // Send Response
    // ===============================================
    res.status(statusCode).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error in bulk sequence creation:', error);

    // Handle pre-flight errors (template validation, etc.)
    if (error.message.includes('inactive') ||
        error.message.includes('no steps') ||
        error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Server errors
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});
```

**Add endpoint BEFORE the existing single-restaurant POST endpoint to avoid route conflicts.**

### Testing Checklist - Phase 3

- [ ] Endpoint accepts valid bulk request
- [ ] Validates sequence_template_id required
- [ ] Validates restaurant_ids is array
- [ ] Validates restaurant_ids not empty
- [ ] Validates restaurant_ids max 100
- [ ] Returns 400 for invalid template
- [ ] Returns 400 for inactive template
- [ ] Returns 400 for template with no steps
- [ ] Creates sequences for all valid restaurants
- [ ] Returns detailed success results
- [ ] Returns detailed failure results
- [ ] Handles restaurant not found
- [ ] Rolls back on task creation failure
- [ ] Updates template usage_count
- [ ] Returns correct status codes (201, 207)
- [ ] Handles variable replacement errors gracefully
- [ ] Performance acceptable for 50 restaurants
- [ ] No memory leaks with large batches

---

## Phase 4: React Query Hook

**Estimated Time:** 30 minutes

**File:** `/src/hooks/useSequences.ts`

### 4.1 Add Interfaces

```typescript
// Add to existing interfaces section
export interface BulkStartSequenceRequest {
  sequence_template_id: string;
  restaurant_ids: string[]; // Array of restaurant IDs
  assigned_to?: string;
}

export interface BulkStartSequenceResult {
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
```

### 4.2 Create Hook

```typescript
/**
 * React Query hook for bulk sequence creation
 * Starts the same sequence for multiple restaurants
 */
export function useBulkStartSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkStartSequenceRequest) => {
      const response = await api.post('/sequence-instances/bulk', data);
      return response.data.data as BulkStartSequenceResult;
    },
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // Invalidate each restaurant's sequences individually
      variables.restaurant_ids.forEach(restaurantId => {
        queryClient.invalidateQueries({
          queryKey: ['restaurant-sequences', restaurantId]
        });
      });

      // Note: Success toast handled in component (shows detailed results)
    },
    onError: (error: any) => {
      // Error toast for pre-flight failures only
      // (Partial failures handled in component)
      toast.error('Failed to start bulk operation', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}
```

### Testing Checklist - Phase 4

- [ ] Hook accepts BulkStartSequenceRequest
- [ ] Makes POST to /sequence-instances/bulk
- [ ] Returns BulkStartSequenceResult type
- [ ] Invalidates sequence-instances query
- [ ] Invalidates tasks query
- [ ] Invalidates each restaurant's sequences
- [ ] onError shows toast for pre-flight errors
- [ ] TypeScript types compile correctly

---

## Phase 5: Integration - Sequences.tsx

**Estimated Time:** 1-2 hours

**File:** `/src/pages/Sequences.tsx`

### 5.1 Add Imports (5 min)

```typescript
import { BulkStartSequenceModal } from '../components/sequences/BulkStartSequenceModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
```

### 5.2 Add State Management (10 min)

```typescript
// Existing state...
const [selectRestaurantOpen, setSelectRestaurantOpen] = useState(false);
const [startSequenceOpen, setStartSequenceOpen] = useState(false);
const [selectedRestaurant, setSelectedRestaurant] = useState(null);

// NEW: Bulk flow state
const [bulkMode, setBulkMode] = useState(false);
const [bulkStartOpen, setBulkStartOpen] = useState(false);
const [selectedRestaurants, setSelectedRestaurants] = useState<any[]>([]);
```

### 5.3 Add Handler Functions (15 min)

```typescript
// Existing handlers...
const handleRestaurantSelected = (restaurant) => {
  // Single restaurant flow (existing)
  setSelectedRestaurant(restaurant);
  setSelectRestaurantOpen(false);
  setStartSequenceOpen(true);
};

// NEW: Bulk restaurants selected handler
const handleRestaurantsSelected = (restaurants: any[]) => {
  setSelectedRestaurants(restaurants);
  setSelectRestaurantOpen(false);
  setBulkStartOpen(true);
};

// NEW: Close bulk modal handler
const handleBulkStartClose = () => {
  setBulkStartOpen(false);
  setSelectedRestaurants([]);
  setBulkMode(false);
};

// NEW: Handle mode selection
const handleNewSequenceClick = (mode: 'single' | 'bulk') => {
  setBulkMode(mode === 'bulk');
  setSelectRestaurantOpen(true);
};
```

### 5.4 Update "New Sequence" Button (20 min)

```tsx
{/* Replace existing "New Sequence" button with dropdown */}
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
      <Plus className="h-4 w-4 mr-2" />
      New Sequence
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleNewSequenceClick('single')}>
      <div className="flex flex-col">
        <span className="font-medium">Single Restaurant</span>
        <span className="text-xs text-muted-foreground">
          Start a sequence for one restaurant
        </span>
      </div>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleNewSequenceClick('bulk')}>
      <div className="flex flex-col">
        <span className="font-medium">Multiple Restaurants (Bulk)</span>
        <span className="text-xs text-muted-foreground">
          Start the same sequence for multiple restaurants
        </span>
      </div>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 5.5 Update Modal Calls (15 min)

```tsx
{/* Restaurant Selection Modal */}
<SelectRestaurantForSequenceModal
  open={selectRestaurantOpen}
  onClose={() => {
    setSelectRestaurantOpen(false);
    setBulkMode(false);
  }}
  onSelectRestaurant={handleRestaurantSelected}
  onSelectRestaurants={handleRestaurantsSelected}
  allowMultiple={bulkMode}
/>

{/* EXISTING: Single Restaurant Flow */}
{selectedRestaurant && (
  <StartSequenceModal
    open={startSequenceOpen}
    onClose={handleStartSequenceClose}
    restaurant={selectedRestaurant}
  />
)}

{/* NEW: Bulk Restaurant Flow */}
{selectedRestaurants.length > 0 && (
  <BulkStartSequenceModal
    open={bulkStartOpen}
    onClose={handleBulkStartClose}
    restaurants={selectedRestaurants}
  />
)}
```

### Testing Checklist - Phase 5

- [ ] "New Sequence" dropdown displays
- [ ] "Single Restaurant" option works
- [ ] "Multiple Restaurants" option works
- [ ] SelectRestaurantForSequenceModal opens in correct mode
- [ ] Single-select flow unchanged
- [ ] Bulk-select flow opens BulkStartSequenceModal
- [ ] BulkStartSequenceModal receives correct restaurants
- [ ] Modals close properly
- [ ] State resets when modals close
- [ ] No console errors

---

## Phase 6: Testing & Validation

**Estimated Time:** 2-3 hours

### 6.1 Unit Testing

**Backend Service Tests:**

```javascript
// Test file: /tests/services/sequence-instances-service.test.js

describe('startSequenceBulk', () => {
  test('creates sequences for all valid restaurants', async () => {
    const result = await startSequenceBulk(templateId, [restaurantId1, restaurantId2]);

    expect(result.summary.total).toBe(2);
    expect(result.summary.success).toBe(2);
    expect(result.summary.failure).toBe(0);
    expect(result.succeeded).toHaveLength(2);
  });

  test('handles restaurant not found', async () => {
    const result = await startSequenceBulk(templateId, ['invalid-id']);

    expect(result.summary.failure).toBe(1);
    expect(result.failed[0].reason).toBe('not_found');
  });

  test('handles inactive template', async () => {
    await expect(
      startSequenceBulk(inactiveTemplateId, [restaurantId1])
    ).rejects.toThrow('inactive template');
  });

  test('respects 100 restaurant limit', async () => {
    const ids = Array(101).fill('restaurant-id');

    await expect(
      startSequenceBulk(templateId, ids)
    ).rejects.toThrow('Maximum 100');
  });

  test('rolls back on task creation failure', async () => {
    // Mock task creation to fail
    // Verify sequence instance is deleted
  });
});
```

**Frontend Component Tests:**

```typescript
// Test file: /tests/components/BulkStartSequenceModal.test.tsx

describe('BulkStartSequenceModal', () => {
  test('displays correct restaurant count', () => {
    render(<BulkStartSequenceModal restaurants={mockRestaurants} />);
    expect(screen.getByText(/5 Restaurants/)).toBeInTheDocument();
  });

  test('allows restaurant removal', () => {
    // ... test removal logic
  });

  test('shows results after operation', async () => {
    // ... test results display
  });
});
```

### 6.2 Integration Testing

**Test Scenarios:**

1. **Happy Path - All Succeed**
   - Select 5 restaurants
   - Choose template
   - Verify 5 sequences created
   - Verify all tasks created correctly
   - Verify success results displayed

2. **Partial Failure**
   - Select 10 restaurants (2 don't exist)
   - Verify 8 succeed, 2 fail
   - Verify failure reasons correct
   - Verify "Retry Failed" button works

3. **All Fail**
   - Select invalid restaurants
   - Verify all fail with correct errors
   - Verify no sequences created

4. **Large Selection (50 restaurants)**
   - Select 50 restaurants
   - Verify warning displays
   - Verify operation completes in reasonable time
   - Verify all created successfully

5. **Limit Enforcement**
   - Try to select 101 restaurants
   - Verify error message
   - Verify cannot proceed

### 6.3 E2E Testing Checklist

- [ ] **Regression:** Single-restaurant flow works unchanged
- [ ] **Bulk - Happy Path:** All sequences created successfully
- [ ] **Bulk - Partial Failure:** Some succeed, some fail with clear errors
- [ ] **Bulk - All Fail:** Clear error messages, no data created
- [ ] **Bulk - Large Selection:** 50 restaurants completes successfully
- [ ] **Bulk - Retry:** Retry failed restaurants works
- [ ] **Limits:** Cannot select >100 restaurants
- [ ] **Limits:** Warning shows at 50+ restaurants
- [ ] **UI:** Progress indicator shows during operation
- [ ] **UI:** Results display correctly formatted
- [ ] **UI:** Modal closes properly in all states
- [ ] **Performance:** 50 restaurants completes in <15 seconds
- [ ] **Data Integrity:** No orphan sequence instances
- [ ] **Data Integrity:** All tasks created correctly
- [ ] **Error Handling:** Network errors handled gracefully
- [ ] **Navigation:** Queries invalidated, data refreshes

### 6.4 Performance Validation

**Benchmarks to Measure:**

```javascript
// Backend metrics to log:
console.time('bulk-sequence-creation');

// 1. Template validation: <100ms
// 2. Restaurant fetch: <200ms
// 3. Per-restaurant creation:
//    - Instance creation: <50ms
//    - Variable replacement: <100ms
//    - Task creation: <100ms
//    Total per restaurant: ~250ms

// Total for 50 restaurants: ~12.5 seconds (acceptable)

console.timeEnd('bulk-sequence-creation');
```

**Performance Acceptance Criteria:**
- ✅ 10 restaurants: <5 seconds
- ✅ 25 restaurants: <8 seconds
- ✅ 50 restaurants: <15 seconds
- ✅ No server timeouts
- ✅ No memory issues

**If performance is inadequate:**
1. Add database indexes
2. Optimize variable replacement (batch processing)
3. Consider async job queue

---

## Future Extensibility

### Async Job Queue Implementation

**When to implement:**
- Users regularly select >50 restaurants
- Operations frequently take >15 seconds
- Need for scheduled bulk operations

**Architecture:**

```typescript
// Phase 1: Create job
POST /api/sequence-instances/bulk-async
Body: { sequence_template_id, restaurant_ids }
Response: { operation_id: "uuid", status: "queued" }

// Phase 2: Poll status
GET /api/sequence-instances/bulk-async/:operation_id
Response: {
  status: "in_progress",
  progress: { completed: 10, total: 50 },
  started_at: "2025-11-24T10:00:00Z"
}

// Phase 3: Get results
GET /api/sequence-instances/bulk-async/:operation_id/results
Response: { succeeded: [...], failed: [...], summary: {...} }
```

**Implementation Considerations:**
- Use Bull queue or similar job processor
- Store operations in database table
- Email notification on completion
- Webhook callback option
- Status page for viewing all operations

**Current Code Extensibility:**
- ✅ Results structure remains same
- ✅ Frontend can poll instead of wait
- ✅ Service method can be wrapped in job
- ✅ Minimal API changes needed

---

## Deployment Checklist

### Pre-Deployment

- [ ] All Phase 1-5 implementations complete
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks met
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No console errors/warnings

### Backend Deployment

- [ ] `startSequenceBulk` service added
- [ ] `/bulk` endpoint added
- [ ] Endpoint added BEFORE single-restaurant POST
- [ ] Module exports updated
- [ ] Error handling tested
- [ ] Logging added
- [ ] Server timeout configured (2 min)

### Frontend Deployment

- [ ] `SelectRestaurantForSequenceModal` updated
- [ ] `BulkStartSequenceModal` created
- [ ] `useBulkStartSequence` hook created
- [ ] `Sequences.tsx` updated
- [ ] All imports correct
- [ ] No TypeScript errors
- [ ] Build succeeds

### Post-Deployment Verification

- [ ] Single-restaurant flow works in production
- [ ] Bulk-restaurant flow works in production
- [ ] Create 5 test sequences successfully
- [ ] Test partial failure scenario
- [ ] Test with 50 restaurants (if data available)
- [ ] Verify data integrity (no orphans)
- [ ] Check application logs for errors
- [ ] Monitor performance metrics
- [ ] Gather user feedback

### Rollback Plan

**If critical issues found:**

1. **Backend:** Remove `/bulk` endpoint temporarily
   ```javascript
   // Comment out in sequence-instances-routes.js
   // router.post('/bulk', ...);
   ```

2. **Frontend:** Hide bulk option
   ```tsx
   // In Sequences.tsx, use simple button instead of dropdown
   <Button onClick={() => handleNewSequenceClick('single')}>
     New Sequence
   </Button>
   ```

3. **Revert:** Deploy previous version if needed

---

## Success Metrics

### Quantitative Metrics

- [ ] 0 regressions in single-restaurant flow
- [ ] <15 second operation time for 50 restaurants
- [ ] >95% success rate for valid bulk operations
- [ ] 0 data integrity issues (orphan instances)
- [ ] 0 critical bugs reported

### Qualitative Metrics

- [ ] Users find bulk operation intuitive
- [ ] Error messages clear and actionable
- [ ] "Retry Failed" feature saves time
- [ ] Performance acceptable to users
- [ ] Feature adoption rate >50% within 2 weeks

---

## Appendix: Code Snippets Reference

### Error Response Example

```json
{
  "success": true,
  "data": {
    "succeeded": [
      {
        "restaurant_id": "uuid-1",
        "restaurant_name": "Pizza Palace",
        "instance_id": "uuid-100",
        "tasks_created": 5
      }
    ],
    "failed": [
      {
        "restaurant_id": "uuid-2",
        "restaurant_name": "Unknown Restaurant",
        "error": "Restaurant not found or not accessible",
        "reason": "not_found"
      },
      {
        "restaurant_id": "uuid-3",
        "restaurant_name": "Burger Barn",
        "error": "Failed to create tasks: Database connection error",
        "reason": "server_error"
      }
    ],
    "summary": {
      "total": 3,
      "success": 1,
      "failure": 2
    }
  }
}
```

### TypeScript Types Reference

```typescript
// Complete type definitions
export interface BulkStartSequenceRequest {
  sequence_template_id: string;
  restaurant_ids: string[];
  assigned_to?: string;
}

export interface BulkOperationSuccess {
  restaurant_id: string;
  restaurant_name: string;
  instance_id: string;
  tasks_created: number;
}

export interface BulkOperationFailure {
  restaurant_id: string;
  restaurant_name: string;
  error: string;
  reason: 'not_found' | 'validation_error' | 'server_error';
}

export interface BulkStartSequenceResult {
  succeeded: BulkOperationSuccess[];
  failed: BulkOperationFailure[];
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}
```

---

**Implementation Plan Status:** ✅ **READY FOR DEVELOPMENT**
**Estimated Total Time:** 11-16 hours
**Date Created:** November 24, 2025
**Plan Version:** 1.0

---

**End of Implementation Plan**
