# UI Components: Registration Batch Orchestration

## Overview

This document defines the frontend components for the Phase 2 Registration Batch Orchestration system.

## Related Investigation Documents
- [INVESTIGATION_TASK_3_FRONTEND_POLLING.md](../investigations/phase-2/INVESTIGATION_TASK_3_FRONTEND_POLLING.md)
- [INVESTIGATION_LEADSCRAPES_UI_PATTERNS.md](../investigations/phase-2/INVESTIGATION_LEADSCRAPES_UI_PATTERNS.md)

---

## Component Hierarchy

```
src/
├── pages/
│   ├── RegistrationBatches.tsx          # Main batch list page
│   └── RegistrationBatchDetail.tsx       # Single batch detail view
│
├── components/registration-batch/
│   ├── BatchProgressCard.tsx             # Progress card for batch list
│   ├── BatchStepList.tsx                 # Step progress table
│   ├── BatchRestaurantTable.tsx          # Restaurant status table
│   ├── CompanySelectionView.tsx          # Step 3 action UI
│   ├── YoloConfigBatchView.tsx           # Step 5 action UI
│   └── SubStepProgress.tsx               # Step 6 sub-step display
│
└── hooks/
    ├── useRegistrationBatch.ts           # Single batch polling
    ├── useRegistrationBatches.ts         # Batch list with filters
    └── useRegistrationBatchMutations.ts  # Mutations (start, cancel, etc.)
```

---

## Pages

### RegistrationBatches.tsx

Main page listing all registration batches.

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRegistrationBatches } from '@/hooks/useRegistrationBatches';
import { BatchProgressCard } from '@/components/registration-batch/BatchProgressCard';
import { BatchFilters } from '@/components/registration-batch/BatchFilters';

export function RegistrationBatches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'active';

  const [filters, setFilters] = useState({
    status: activeTab === 'active' ? ['pending', 'in_progress'] : ['completed', 'failed', 'cancelled'],
    search: ''
  });

  const { data: batches, isLoading, refetch } = useRegistrationBatches(filters);

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Registration Batches</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <BatchFilters filters={filters} onFiltersChange={setFilters} />

          <div className="space-y-4 mt-4">
            {batches?.map((batch) => (
              <BatchProgressCard
                key={batch.id}
                batch={batch}
                onRefresh={refetch}
              />
            ))}

            {batches?.length === 0 && (
              <EmptyState
                icon={Layers}
                title="No batches found"
                description={
                  activeTab === 'active'
                    ? "Convert leads to restaurants to create a registration batch"
                    : "No completed batches yet"
                }
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### RegistrationBatchDetail.tsx

Detailed view of a single batch.

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useRegistrationBatch } from '@/hooks/useRegistrationBatch';
import { BatchStepList } from '@/components/registration-batch/BatchStepList';
import { BatchRestaurantTable } from '@/components/registration-batch/BatchRestaurantTable';
import { CompanySelectionView } from '@/components/registration-batch/CompanySelectionView';
import { YoloConfigBatchView } from '@/components/registration-batch/YoloConfigBatchView';

export function RegistrationBatchDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useRegistrationBatch(batchId);
  const batch = data?.batch_job;
  const jobs = data?.registration_jobs || [];

  // Determine which action view to show
  const actionRequiredStep = findActionRequiredStep(batch, jobs);

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" onClick={() => navigate('/registration-batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batches
          </Button>
          <h1 className="text-2xl font-bold mt-2">{batch?.name}</h1>
          <p className="text-muted-foreground">
            {batch?.completed_restaurants} of {batch?.total_restaurants} restaurants complete
          </p>
        </div>

        <div className="flex gap-2">
          {batch?.status === 'pending' && (
            <Button onClick={() => startBatch(batchId)}>
              <Play className="h-4 w-4 mr-2" />
              Start Batch
            </Button>
          )}
          {batch?.status === 'in_progress' && (
            <Button variant="destructive" onClick={() => cancelBatch(batchId)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <Progress value={calculateProgress(batch)} className="flex-1" />
            <span className="text-sm font-medium">{calculateProgress(batch)}%</span>
          </div>
          <BatchStepList batch={batch} jobs={jobs} />
        </CardContent>
      </Card>

      {/* Action Required Section */}
      {actionRequiredStep === 3 && (
        <CompanySelectionView batchId={batchId} jobs={jobs} />
      )}

      {actionRequiredStep === 5 && (
        <YoloConfigBatchView batchId={batchId} jobs={jobs} />
      )}

      {/* Restaurant Table */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurants</CardTitle>
        </CardHeader>
        <CardContent>
          <BatchRestaurantTable jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Components

### BatchProgressCard.tsx

Progress card for the batch list view.

```tsx
interface BatchProgressCardProps {
  batch: RegistrationBatch;
  onRefresh: () => void;
}

export function BatchProgressCard({ batch, onRefresh }: BatchProgressCardProps) {
  const navigate = useNavigate();
  const { mutate: startBatch } = useStartBatch();
  const { mutate: cancelBatch } = useCancelBatch();

  const progress = Math.round(
    ((batch.completed_restaurants + batch.failed_restaurants) / batch.total_restaurants) * 100
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {batch.name}
              <StatusBadge status={batch.status} />
            </CardTitle>
            <CardDescription>
              {batch.completed_restaurants} completed, {batch.failed_restaurants} failed
              {batch.started_at && ` • Started ${formatDistanceToNow(batch.started_at)} ago`}
            </CardDescription>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <StepIndicator
                key={step}
                step={step}
                currentStep={batch.current_step}
                isActionRequired={isStepActionRequired(step, batch)}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Progress value={progress} className="mb-2" />
        <p className="text-sm text-muted-foreground">
          Step {batch.current_step} of {batch.total_steps}: {getStepName(batch.current_step)}
        </p>
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/registration-batches/${batch.id}`)}>
          View Details
        </Button>
        {batch.status === 'pending' && (
          <Button size="sm" onClick={() => startBatch(batch.id)}>
            Start
          </Button>
        )}
        {batch.status === 'in_progress' && (
          <Button variant="destructive" size="sm" onClick={() => cancelBatch(batch.id)}>
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

---

### CompanySelectionView.tsx

Step 3 action UI for selecting company entities.

```tsx
interface CompanySelectionViewProps {
  batchId: string;
  jobs: RegistrationJob[];
}

export function CompanySelectionView({ batchId, jobs }: CompanySelectionViewProps) {
  const [selections, setSelections] = useState<Record<string, string | null>>({});
  const { mutate: completeStep, isLoading } = useCompleteStep();

  // Filter jobs needing company selection
  const jobsNeedingSelection = jobs.filter(job => {
    const step3 = job.steps.find(s => s.step_number === 3);
    return step3?.status === 'action_required';
  });

  const handleSubmit = () => {
    completeStep({
      batchId,
      stepNumber: 3,
      data: { selections }
    });
  };

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Company Selection Required
        </CardTitle>
        <CardDescription>
          Select the correct legal entity for each restaurant ({jobsNeedingSelection.length} remaining)
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {jobsNeedingSelection.map((job) => (
            <CompanySelectionRow
              key={job.id}
              job={job}
              selection={selections[job.id]}
              onSelect={(companyNumber) =>
                setSelections(prev => ({ ...prev, [job.id]: companyNumber }))
              }
            />
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={isLoading || Object.keys(selections).length === 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Selections & Continue
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function CompanySelectionRow({ job, selection, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const candidates = job.company_candidates || [];

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium">{job.restaurant.name}</h4>
          <p className="text-sm text-muted-foreground">{job.restaurant.address}</p>
        </div>

        <Select value={selection || ''} onValueChange={onSelect}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a company..." />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((candidate) => (
              <SelectItem key={candidate.company_number} value={candidate.company_number}>
                {candidate.company_name} ({candidate.company_number})
              </SelectItem>
            ))}
            <SelectItem value="none">None of these / Skip</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {expanded && candidates.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => (
                <TableRow key={c.company_number}>
                  <TableCell>{c.company_name}</TableCell>
                  <TableCell>{c.company_number}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>
                    <Badge variant={c.match_source === 'name' ? 'default' : 'secondary'}>
                      {c.match_source}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Button variant="link" size="sm" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide' : 'Show'} {candidates.length} candidates
      </Button>
    </div>
  );
}
```

---

### YoloConfigBatchView.tsx

Step 5 action UI for configuring Yolo Mode settings.

```tsx
interface YoloConfigBatchViewProps {
  batchId: string;
  jobs: RegistrationJob[];
}

export function YoloConfigBatchView({ batchId, jobs }: YoloConfigBatchViewProps) {
  const [configurations, setConfigurations] = useState<Record<string, YoloConfig>>({});
  const [applyToAll, setApplyToAll] = useState(true);
  const [defaultConfig, setDefaultConfig] = useState<Partial<YoloConfig>>({
    steps_enabled: {
      account: true,
      codeGeneration: true,
      websiteConfig: true,
      servicesConfig: true,
      paymentConfig: true,
      menuImport: true,
      optionSets: true,
      itemTags: true
    }
  });

  const { mutate: completeStep, isLoading } = useCompleteStep();

  const jobsNeedingConfig = jobs.filter(job => {
    const step5 = job.steps.find(s => s.step_number === 5);
    return step5?.status === 'action_required';
  });

  const handleSubmit = () => {
    const finalConfigs = {};

    for (const job of jobsNeedingConfig) {
      finalConfigs[job.id] = configurations[job.id] || {
        use_defaults: true,
        ...defaultConfig
      };
    }

    completeStep({
      batchId,
      stepNumber: 5,
      data: { configurations: finalConfigs }
    });
  };

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-orange-500" />
          Configuration Required
        </CardTitle>
        <CardDescription>
          Configure Yolo Mode settings for {jobsNeedingConfig.length} restaurants
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Default Settings */}
        <div className="mb-6 p-4 border rounded-lg bg-white">
          <h4 className="font-medium mb-4">Default Settings (Apply to All)</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="account"
                checked={defaultConfig.steps_enabled?.account}
                onCheckedChange={(checked) =>
                  setDefaultConfig(prev => ({
                    ...prev,
                    steps_enabled: { ...prev.steps_enabled, account: checked }
                  }))
                }
              />
              <label htmlFor="account">Account Registration</label>
            </div>
            {/* ... more checkboxes for each step */}
          </div>
        </div>

        {/* Per-Restaurant Overrides */}
        <div className="space-y-2">
          {jobsNeedingConfig.map((job) => (
            <div key={job.id} className="flex justify-between items-center p-3 border rounded bg-white">
              <div>
                <p className="font-medium">{job.restaurant.name}</p>
                <p className="text-sm text-muted-foreground">{job.restaurant.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={configurations[job.id] ? 'default' : 'secondary'}>
                  {configurations[job.id] ? 'Custom' : 'Default'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConfigModal(job)}
                >
                  Configure
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting Registration...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Registration ({jobsNeedingConfig.length} restaurants)
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

### SubStepProgress.tsx

Displays Yolo Mode sub-step progress for Step 6.

```tsx
interface SubStepProgressProps {
  subStepProgress: {
    current_sub_step: string;
    total_sub_steps: number;
    sub_steps: Record<string, SubStepStatus>;
  };
}

const SUB_STEP_LABELS = {
  account: 'Account Registration',
  codeGeneration: 'Code Generation',
  onboardingUser: 'Onboarding User',
  imageUpload: 'Image Upload',
  restaurantRegistration: 'Restaurant Registration',
  websiteConfig: 'Website Configuration',
  servicesConfig: 'Services Configuration',
  paymentConfig: 'Payment Configuration',
  menuImport: 'Menu Import',
  onboardingSync: 'Onboarding Sync',
  optionSets: 'Option Sets',
  itemTags: 'Item Tags'
};

export function SubStepProgress({ subStepProgress }: SubStepProgressProps) {
  const { sub_steps } = subStepProgress;

  const completedCount = Object.values(sub_steps).filter(
    s => s.status === 'completed'
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Sub-step progress</span>
        <span>{completedCount} / {Object.keys(sub_steps).length}</span>
      </div>

      <Progress value={(completedCount / Object.keys(sub_steps).length) * 100} />

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            Show details
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {Object.entries(sub_steps).map(([key, status]) => (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-2 text-sm p-2 rounded',
                  status.status === 'completed' && 'bg-green-50',
                  status.status === 'in_progress' && 'bg-blue-50',
                  status.status === 'failed' && 'bg-red-50',
                  status.status === 'skipped' && 'bg-gray-50'
                )}
              >
                <SubStepIcon status={status.status} />
                <span>{SUB_STEP_LABELS[key]}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
```

---

## Hooks

### useRegistrationBatch.ts

```tsx
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export function useRegistrationBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['registration-batch', batchId],
    queryFn: async () => {
      const response = await api.get(`/registration-batches/${batchId}`);
      return response.data;
    },
    enabled: !!batchId,
    refetchInterval: (query) => {
      const batch = query.state.data?.batch_job;
      if (!batch) return false;

      // Stop polling when complete
      if (['completed', 'failed', 'cancelled'].includes(batch.status)) {
        return false;
      }

      // Faster polling during active execution
      return batch.status === 'in_progress' ? 5000 : 10000;
    },
    staleTime: 0
  });
}

export function useRegistrationBatches(filters: BatchFilters) {
  return useQuery({
    queryKey: ['registration-batches', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status?.length) params.set('status', filters.status.join(','));
      if (filters.search) params.set('search', filters.search);

      const response = await api.get(`/registration-batches?${params}`);
      return response.data.batch_jobs;
    },
    refetchInterval: 30000 // Refresh list every 30s
  });
}
```

### useRegistrationBatchMutations.ts

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { toast } from 'sonner';

export function useStartBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchId: string) =>
      api.post(`/registration-batches/${batchId}/start`),
    onSuccess: (_, batchId) => {
      toast.success('Batch started successfully');
      queryClient.invalidateQueries({ queryKey: ['registration-batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    },
    onError: (error) => {
      toast.error(`Failed to start batch: ${error.message}`);
    }
  });
}

export function useCancelBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchId: string) =>
      api.post(`/registration-batches/${batchId}/cancel`),
    onSuccess: (_, batchId) => {
      toast.success('Batch cancelled');
      queryClient.invalidateQueries({ queryKey: ['registration-batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    }
  });
}

export function useCompleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, stepNumber, data }) =>
      api.post(`/registration-batches/${batchId}/steps/${stepNumber}/complete`, data),
    onSuccess: (response, { batchId }) => {
      if (response.data.auto_processing) {
        toast.success('Step completed, processing next step...');
      } else {
        toast.success('Selections saved');
      }
      queryClient.invalidateQueries({ queryKey: ['registration-batch', batchId] });
    }
  });
}
```
