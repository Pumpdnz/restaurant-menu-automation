# Lead Scraping UI Components

## Overview

This document specifies the React components for the lead scraping feature. All components follow existing patterns from the codebase, particularly the Sequences page and its related components.

## Component Hierarchy

```
LeadScrapes.tsx (Page)
├── Tabs (Scrape Jobs | Pending Leads)
│
├── [Tab: Scrape Jobs]
│   ├── Filters (Search, Status, Platform, Cuisine, City, Date)
│   ├── New Lead Scrape Button
│   │   └── CreateLeadScrapeJob.tsx (Dialog)
│   │
│   └── ScrapeJobProgressCard.tsx (per job)
│       ├── Header (Name, Status, Platform, Limit, Progress)
│       └── ScrapeJobStepList.tsx
│           ├── Step Row (Status, Name, Type, Leads, Date, Actions)
│           │   ├── LeadPreview.tsx (Popover on Leads column)
│           │   └── ScrapeJobStepDetailModal.tsx (on click)
│           └── LeadDetailModal.tsx (from LeadPreview)
│
└── [Tab: Pending Leads]
    ├── Filters (Search, Platform, Cuisine, City, Date)
    └── PendingLeadsTable.tsx
        ├── Bulk Select Actions
        └── LeadDetailModal.tsx (on row click)
```

## Page Components

### LeadScrapes.tsx

Main page component with tabbed interface.

**Location:** `src/pages/LeadScrapes.tsx`

**Pattern Reference:** `src/pages/Sequences.tsx`

```typescript
interface LeadScrapesProps {}

// State
const [activeTab, setActiveTab] = useState<'jobs' | 'pending'>('jobs');
const [jobFilters, setJobFilters] = useState<JobFilters>({
  search: '',
  status: [],
  platform: [],
  cuisine: '',
  city: [],
  startedDate: null
});
const [pendingFilters, setPendingFilters] = useState<PendingFilters>({
  search: '',
  platform: [],
  cuisine: '',
  city: [],
  completedDate: null
});
const [createJobOpen, setCreateJobOpen] = useState(false);
const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

// Hooks
const { data: jobs, isLoading: jobsLoading } = useLeadScrapeJobs(jobFilters);
const { data: pendingLeads, isLoading: pendingLoading } = usePendingLeads(pendingFilters);
```

**Layout:**
```jsx
<div className="p-6 space-y-6">
  {/* Header */}
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-2xl font-bold">Lead Scraping</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Extract and enrich leads from delivery platforms
      </p>
    </div>
    <Button onClick={() => setCreateJobOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      New Lead Scrape
    </Button>
  </div>

  {/* Tabs */}
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList size="full">
      <TabsTrigger size="full" variant="blue" value="jobs">Scrape Jobs</TabsTrigger>
      <TabsTrigger size="full" variant="blue" value="pending">Pending Leads</TabsTrigger>
    </TabsList>

    <TabsContent value="jobs">
      {/* Filters Card */}
      {/* Job Cards List */}
    </TabsContent>

    <TabsContent value="pending">
      {/* Filters Card */}
      {/* Pending Leads Table */}
    </TabsContent>
  </Tabs>

  {/* Modals */}
  <CreateLeadScrapeJob open={createJobOpen} onClose={() => setCreateJobOpen(false)} />
</div>
```

### LeadScrapeDetail.tsx

Detail page for individual scrape job management.

**Location:** `src/pages/LeadScrapeDetail.tsx`

**Route:** `/leads/:id`

```typescript
interface LeadScrapeDetailProps {}

// Uses useParams to get job ID
const { id } = useParams<{ id: string }>();
const { data: job, isLoading } = useLeadScrapeJob(id);
```

---

## Card Components

### ScrapeJobProgressCard.tsx

Displays a scrape job with progress and nested step list.

**Location:** `src/components/leads/ScrapeJobProgressCard.tsx`

**Pattern Reference:** `src/components/sequences/SequenceProgressCard.tsx`

```typescript
interface ScrapeJobProgressCardProps {
  job: LeadScrapeJob;
  onRefresh?: () => void;
}

interface LeadScrapeJob {
  id: string;
  name: string;
  platform: string;
  city: string;
  cuisine: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  leads_limit: number;
  initial_url: string;
  current_step: number;
  total_steps: number;
  leads_extracted: number;
  leads_passed: number;
  started_at: string | null;
  completed_at: string | null;
  steps: LeadScrapeJobStep[];
}
```

**Status Colors:**
```typescript
const statusColors = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  failed: 'bg-red-100 text-red-800 border-red-200'
};
```

**Layout:**
```jsx
<Card>
  <CardHeader>
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <CardTitle className="flex items-center gap-2 flex-wrap">
          {/* Name - clickable to /leads/:id */}
          <Link to={`/leads/${job.id}`} className="hover:text-brand-blue hover:underline">
            {job.name}
          </Link>
          <Badge className={statusColors[job.status]} variant="outline">
            {job.status.replace('_', ' ')}
          </Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          Started {formatDistanceToNow(new Date(job.started_at))} ago
        </CardDescription>
        {/* Platform Link */}
        <div className="text-sm text-muted-foreground mt-1">
          Platform: <a href={job.initial_url} target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1">
            {getPlatformLabel(job.platform)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {/* Leads Limit */}
        <div className="text-sm text-muted-foreground">
          Leads Limit: {job.leads_limit}
        </div>
      </div>
    </div>
  </CardHeader>

  <CardContent>
    {/* Progress Bar */}
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">
          {job.leads_passed} of {job.leads_extracted} leads passed
        </span>
        <span className="font-medium">{calculateProgress(job)}%</span>
      </div>
      <AnimatedProgressBar value={calculateProgress(job)} />
    </div>

    {/* Step List */}
    <ScrapeJobStepList
      steps={job.steps}
      currentStep={job.current_step}
      onRefresh={onRefresh}
    />
  </CardContent>

  <CardFooter className="flex gap-2 flex-wrap">
    <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${job.id}`)}>
      <Eye className="h-4 w-4 mr-1" />
      View Details
    </Button>
    {/* Additional action buttons based on status */}
  </CardFooter>
</Card>
```

---

## Step List Components

### ScrapeJobStepList.tsx

Nested table showing steps within a scrape job.

**Location:** `src/components/leads/ScrapeJobStepList.tsx`

**Pattern Reference:** `src/components/sequences/SequenceTaskList.tsx`

```typescript
interface ScrapeJobStepListProps {
  steps: LeadScrapeJobStep[];
  currentStep: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onRefresh?: () => void;
}

interface LeadScrapeJobStep {
  id: string;
  job_id: string;
  step_number: number;
  step_name: string;
  step_description: string;
  step_type: 'automatic' | 'action_required';
  status: 'pending' | 'in_progress' | 'action_required' | 'completed' | 'failed';
  leads_received: number;
  leads_processed: number;
  leads_passed: number;
  leads_failed: number;
  started_at: string | null;
  completed_at: string | null;
}
```

**Step Status Indicators:**
```typescript
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'action_required':
      return (
        <div className="h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
      );
    case 'pending':
      return <Clock className="h-4 w-4 text-gray-400" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};
```

**Table Columns:**

| Column | Content |
|--------|---------|
| Status | Status icon |
| Step | Name and description (clickable) |
| Type | "Automatic" or "Action Required" badge |
| Leads | Lead count with popover |
| Completed | Date/time or "Pending" |
| Actions | View, Quick Progress button |

**Leads Column Display:**
```typescript
const getLeadsDisplay = (step: LeadScrapeJobStep) => {
  switch (step.status) {
    case 'in_progress':
      return (
        <div className="flex items-center gap-1 text-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing...</span>
        </div>
      );
    case 'action_required':
      return (
        <LeadPreview step={step}>
          <div className="text-orange-500 cursor-pointer hover:underline">
            {step.leads_processed - step.leads_passed} ready
          </div>
        </LeadPreview>
      );
    case 'pending':
      return (
        <div className="flex items-center gap-1 text-gray-400">
          <Clock className="h-3 w-3" />
          <span>Pending</span>
        </div>
      );
    case 'completed':
      return (
        <LeadPreview step={step}>
          <div className="text-green-500 cursor-pointer hover:underline">
            {step.leads_passed} passed
          </div>
        </LeadPreview>
      );
    case 'failed':
      return (
        <div className="flex items-center gap-1 text-red-500">
          <AlertTriangle className="h-3 w-3" />
          <span>Failed</span>
        </div>
      );
  }
};
```

---

## Popover Components

### LeadPreview.tsx

Popover showing lead quick view with bulk actions.

**Location:** `src/components/leads/LeadPreview.tsx`

**Pattern Reference:** `src/components/tasks/TaskTypeQuickView.tsx`

```typescript
interface LeadPreviewProps {
  step: LeadScrapeJobStep;
  children: React.ReactNode;
  onLeadAction?: (action: string, leadIds: string[]) => void;
}

// Lead progression status colors
const progressionColors = {
  passed: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    indicator: 'bg-green-500'
  },
  processing: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    indicator: 'bg-blue-500'
  },
  processed: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    indicator: 'bg-orange-500'
  },
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    indicator: 'bg-red-500'
  },
  available: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    indicator: 'bg-gray-400'
  }
};
```

**Layout:**
```jsx
<Popover>
  <PopoverTrigger asChild>{children}</PopoverTrigger>
  <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
    {/* Header with totals */}
    <div className="space-y-2 mb-4">
      <div className="font-semibold text-sm">Lead Summary</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {step.status !== 'pending' && (
          <div>Received: {step.leads_received}</div>
        )}
        {['completed', 'action_required'].includes(step.status) && (
          <>
            <div className="text-green-600">Processed: {step.leads_processed}</div>
            <div className="text-orange-600">Awaiting: {step.leads_processed - step.leads_passed}</div>
          </>
        )}
        {step.status === 'completed' && (
          <div className="text-green-600">Passed: {step.leads_passed}</div>
        )}
      </div>
    </div>

    {/* Leads table */}
    <div className="space-y-1">
      {leads.map(lead => (
        <LeadPreviewRow
          key={lead.id}
          lead={lead}
          selected={selectedLeads.includes(lead.id)}
          onSelect={handleSelectLead}
          onClick={() => setDetailModalLead(lead)}
        />
      ))}
    </div>

    {/* Bulk action buttons (when leads selected) */}
    {selectedLeads.length > 0 && (
      <div className="pt-3 border-t mt-3 flex gap-2">
        {getBulkActions(selectedProgressionStatus).map(action => (
          <Button key={action.id} size="sm" variant={action.variant}
            onClick={() => handleBulkAction(action.id)}>
            {action.label}
          </Button>
        ))}
      </div>
    )}
  </PopoverContent>
</Popover>
```

**Bulk Actions by Progression Status:**
```typescript
const getBulkActions = (status: string) => {
  switch (status) {
    case 'passed':
      return [
        { id: 'retry', label: 'Retry', variant: 'outline' },
        { id: 'delete', label: 'Delete', variant: 'destructive' }
      ];
    case 'processed':
      return [
        { id: 'pass', label: 'Pass to Next Step', variant: 'default' },
        { id: 'delete', label: 'Delete', variant: 'destructive' }
      ];
    case 'available':
      return [
        { id: 'process', label: 'Process', variant: 'default' },
        { id: 'delete', label: 'Delete', variant: 'destructive' }
      ];
    case 'failed':
      return [
        { id: 'retry', label: 'Retry', variant: 'outline' },
        { id: 'delete', label: 'Delete', variant: 'destructive' }
      ];
    default:
      return [];
  }
};
```

---

## Modal Components

### CreateLeadScrapeJob.tsx

Dialog for creating a new scrape job.

**Location:** `src/components/leads/CreateLeadScrapeJob.tsx`

**Pattern Reference:** `src/components/sequences/CreateSequenceTemplateModal.tsx`

```typescript
interface CreateLeadScrapeJobProps {
  open: boolean;
  onClose: () => void;
  draftJobId?: string; // For editing draft jobs
}

interface FormData {
  platform: string;
  country: string;
  city: string;
  cuisine: string;
  leadsLimit: number;
  pageOffset: number;
}
```

**Platform Options:**
```typescript
const platformOptions = [
  { value: 'ubereats', label: 'UberEats', icon: UtensilsCrossed },
  { value: 'doordash', label: 'DoorDash', icon: Truck, disabled: true },
  { value: 'google_maps', label: 'Google Maps', icon: MapPin, disabled: true },
  { value: 'delivereasy', label: 'DeliverEasy', icon: Truck, disabled: true }
];
```

**Country Options:**
```typescript
const countryOptions = [
  { value: 'nz', label: 'New Zealand', flag: '🇳🇿' },
  { value: 'au', label: 'Australia', flag: '🇦🇺' }
];
```

**City Data Hook:**
```typescript
// Hook to fetch and filter city codes
function useCityCodes(country: string) {
  const { data: cities, isLoading } = useQuery({
    queryKey: ['city-codes', country],
    queryFn: async () => {
      const response = await api.get('/city-codes', { params: { country } });
      return response.data.cities;
    },
    enabled: !!country
  });

  return { cities: cities || [], isLoading };
}
```

**Layout:**
```jsx
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>New Lead Scrape</DialogTitle>
      <DialogDescription>
        Configure the parameters for your lead extraction job.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">
      {/* Platform Selection */}
      <div className="space-y-2">
        <Label>Platform</Label>
        <Select value={formData.platform} onValueChange={handlePlatformChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                <div className="flex items-center gap-2">
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Country Selection */}
      <div className="space-y-2">
        <Label>Country</Label>
        <Select value={formData.country} onValueChange={handleCountryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countryOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <span>{opt.flag}</span>
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City Selection - Searchable Combobox */}
      <div className="space-y-2">
        <Label>City *</Label>
        <CitySearchCombobox
          country={formData.country}
          value={formData.city}
          onChange={handleCityChange}
        />
      </div>

      {/* Cuisine Input */}
      <div className="space-y-2">
        <Label>Cuisine *</Label>
        <Input
          placeholder="e.g., indian, chinese, pizza"
          value={formData.cuisine}
          onChange={e => setFormData(prev => ({ ...prev, cuisine: e.target.value }))}
        />
      </div>

      {/* Leads Limit */}
      <div className="space-y-2">
        <Label>Leads Limit</Label>
        <Input
          type="number"
          min={1}
          max={999}
          value={formData.leadsLimit}
          onChange={e => setFormData(prev => ({
            ...prev,
            leadsLimit: parseInt(e.target.value) || 21
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of leads to extract (1-999)
        </p>
      </div>

      {/* Page Offset (UberEats only) */}
      {formData.platform === 'ubereats' && (
        <div className="space-y-2">
          <Label>Page Number</Label>
          <Input
            type="number"
            min={1}
            max={999}
            value={formData.pageOffset}
            onChange={e => setFormData(prev => ({
              ...prev,
              pageOffset: parseInt(e.target.value) || 1
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Start from page number (1-999, default: 1)
          </p>
        </div>
      )}
    </div>

    <DialogFooter className="flex gap-2">
      <Button variant="outline" onClick={handleSaveAsDraft}>
        Save as Draft
      </Button>
      <Button
        onClick={handleStartScrape}
        disabled={!isValid || isStarting}
        className="bg-gradient-to-r from-brand-blue to-brand-green"
      >
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Start Lead Scrape
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### CitySearchCombobox.tsx

Searchable combobox component for selecting cities with type-ahead filtering.

**Location:** `src/components/leads/CitySearchCombobox.tsx`

**Pattern Reference:** Uses shadcn/ui Combobox pattern

```typescript
interface CitySearchComboboxProps {
  country: string;
  value: string;
  onChange: (cityCode: string) => void;
  disabled?: boolean;
}

interface CityCode {
  id: string;
  country: string;
  city_name: string;
  city_code: string;
  region_code: string;
  ubereats_slug: string;
}
```

**Component Implementation:**
```tsx
import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

export function CitySearchCombobox({
  country,
  value,
  onChange,
  disabled = false
}: CitySearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch cities for selected country
  const { cities, isLoading } = useCityCodes(country);

  // Filter cities based on search query
  const filteredCities = useMemo(() => {
    if (!searchQuery) return cities;
    const query = searchQuery.toLowerCase();
    return cities.filter((city: CityCode) =>
      city.city_name.toLowerCase().includes(query) ||
      city.region_code.toLowerCase().includes(query)
    );
  }, [cities, searchQuery]);

  // Group cities by region
  const groupedCities = useMemo(() => {
    const groups: Record<string, CityCode[]> = {};
    filteredCities.forEach((city: CityCode) => {
      const region = city.region_code.toUpperCase();
      if (!groups[region]) groups[region] = [];
      groups[region].push(city);
    });
    return groups;
  }, [filteredCities]);

  // Get display label for selected city
  const selectedCity = cities.find((c: CityCode) => c.city_code === value);
  const displayLabel = selectedCity
    ? `${selectedCity.city_name} (${selectedCity.region_code.toUpperCase()})`
    : 'Select city...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || !country}
        >
          {isLoading ? (
            <span className="text-muted-foreground">Loading cities...</span>
          ) : (
            <span className={cn(!value && 'text-muted-foreground')}>
              {displayLabel}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cities..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No cities found.</CommandEmpty>
            {Object.entries(groupedCities).map(([region, regionCities]) => (
              <CommandGroup key={region} heading={region}>
                {regionCities.map((city) => (
                  <CommandItem
                    key={city.id}
                    value={city.city_code}
                    onSelect={() => {
                      onChange(city.city_code);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === city.city_code ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {city.city_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Features:**
- Type-ahead search filtering as user types
- Groups cities by region code (AUK, WGN, NSW, VIC, etc.)
- Shows region code in parentheses for selected value
- Handles loading state while fetching cities
- Disabled state when no country selected
- Maximum height with scroll for long city lists
- Clears search when city is selected

---

### LeadDetailModal.tsx

Modal for viewing and editing individual lead details.

**Location:** `src/components/leads/LeadDetailModal.tsx`

**Pattern Reference:** `src/components/tasks/TaskDetailModal.tsx`

```typescript
interface LeadDetailModalProps {
  open: boolean;
  leadId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'view' | 'edit';
}
```

**Layout:**
```jsx
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <div className="flex items-center justify-between">
        <DialogTitle className="flex items-center gap-2">
          {lead.restaurant_name}
          <Badge variant="outline" className={progressionColors[lead.step_progression_status].bg}>
            Step {lead.current_step}
          </Badge>
        </DialogTitle>
        <Button variant="ghost" size="sm" onClick={toggleEditMode}>
          <Edit className="h-4 w-4 mr-1" />
          {mode === 'view' ? 'Edit' : 'Cancel'}
        </Button>
      </div>
    </DialogHeader>

    <div className="space-y-6 py-4">
      {/* Basic Info Section */}
      <section>
        <h3 className="font-medium mb-3">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoField label="Restaurant Name" value={lead.restaurant_name} editable={mode === 'edit'} />
          <InfoField label="Store Link" value={lead.store_link} type="link" />
          <InfoField label="Platform" value={lead.platform} />
          <InfoField label="City" value={lead.city} />
          <InfoField label="Cuisine" value={lead.cuisine?.join(', ')} />
        </div>
      </section>

      {/* Ratings Section (Step 2+) */}
      {lead.current_step >= 2 && (
        <section>
          <h3 className="font-medium mb-3">Platform Ratings</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Review Count" value={lead.number_of_reviews} />
            <InfoField label="Average Rating" value={`${lead.average_review_rating}/5`} />
            <InfoField label="Address" value={lead.address} className="col-span-2" />
          </div>
        </section>
      )}

      {/* Contact Info Section (Step 3+) */}
      {lead.current_step >= 3 && (
        <section>
          <h3 className="font-medium mb-3">Contact Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Phone" value={lead.phone} editable={mode === 'edit'} />
            <InfoField label="Email" value={lead.email} editable={mode === 'edit'} />
            <InfoField label="Website" value={lead.website_url} type="link" editable={mode === 'edit'} />
            <InfoField label="Contact Name" value={lead.contact_name} editable={mode === 'edit'} />
          </div>
        </section>
      )}

      {/* Social Links Section (Step 4+) */}
      {lead.current_step >= 4 && (
        <section>
          <h3 className="font-medium mb-3">Social Media</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Instagram" value={lead.instagram_url} type="link" editable={mode === 'edit'} />
            <InfoField label="Facebook" value={lead.facebook_url} type="link" editable={mode === 'edit'} />
          </div>
        </section>
      )}

      {/* Validation Errors */}
      {lead.validation_errors?.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validation Issues</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2">
              {lead.validation_errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>

    <DialogFooter className="flex gap-2">
      {mode === 'edit' && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Changes
        </Button>
      )}
      {lead.step_progression_status === 'processed' && (
        <Button onClick={handlePassToNextStep}>
          <ArrowRight className="h-4 w-4 mr-2" />
          Pass to Next Step
        </Button>
      )}
      <Button variant="destructive" onClick={handleDelete}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### ScrapeJobStepDetailModal.tsx

Modal for viewing step details and managing leads at that step.

**Location:** `src/components/leads/ScrapeJobStepDetailModal.tsx`

```typescript
interface ScrapeJobStepDetailModalProps {
  open: boolean;
  stepId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}
```

**Features:**
- Full step overview with status, counts, timestamps
- Table of all leads at this step
- Color-coded rows by progression status
- Bulk select and actions (same as LeadPreview)
- Edit mode for manual data entry
- Quick progression action button

---

## Table Components

### PendingLeadsTable.tsx

Table for the Pending Leads tab showing leads ready for conversion.

**Location:** `src/components/leads/PendingLeadsTable.tsx`

```typescript
interface PendingLeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
  onConvert: (leadIds: string[]) => void;
  onDelete: (leadIds: string[]) => void;
  onRefresh: () => void;
}
```

**Table Columns:**

| Column | Content | Width |
|--------|---------|-------|
| Select | Checkbox | 40px |
| Name | Restaurant name (clickable) | flex |
| Platform | Platform badge | 100px |
| City | City name | 100px |
| Cuisine | Cuisine tags | 150px |
| Rating | Star rating | 80px |
| Phone | Contact phone | 120px |
| Email | Contact email | 150px |
| Created | Created date | 100px |
| Actions | Quick actions | 120px |

**Bulk Action Bar:**
```jsx
{selectedLeads.length > 0 && (
  <div className="flex items-center justify-between p-3 bg-muted border rounded-lg mb-4">
    <span className="text-sm font-medium">
      {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
    </span>
    <div className="flex gap-2">
      <Button onClick={() => onConvert(selectedLeads)}>
        <ArrowRightCircle className="h-4 w-4 mr-2" />
        Convert to Restaurants
      </Button>
      <Button variant="destructive" onClick={() => onDelete(selectedLeads)}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Selected
      </Button>
    </div>
  </div>
)}
```

---

## Hook Specifications

### useLeadScrapeJobs.ts

```typescript
interface UseLeadScrapeJobsOptions {
  search?: string;
  status?: string[];
  platform?: string[];
  city?: string[];
  cuisine?: string;
  startedAfter?: Date;
}

export function useLeadScrapeJobs(filters?: UseLeadScrapeJobsOptions) {
  return useQuery({
    queryKey: ['lead-scrape-jobs', filters],
    queryFn: async () => {
      const response = await api.get('/lead-scrape-jobs', { params: filters });
      return response.data;
    }
  });
}

export function useLeadScrapeJob(jobId: string) {
  return useQuery({
    queryKey: ['lead-scrape-job', jobId],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId
  });
}

export function useCreateLeadScrapeJob() {
  return useMutation({
    mutationFn: async (data: CreateJobData) => {
      const response = await api.post('/lead-scrape-jobs', data);
      return response.data;
    }
  });
}

export function useStartLeadScrapeJob() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post(`/lead-scrape-jobs/${jobId}/start`);
      return response.data;
    }
  });
}
```

### useLeads.ts

```typescript
export function usePendingLeads(filters?: PendingLeadsFilters) {
  return useQuery({
    queryKey: ['pending-leads', filters],
    queryFn: async () => {
      const response = await api.get('/leads/pending', { params: filters });
      return response.data;
    }
  });
}

export function useLeadsByStep(jobId: string, stepNumber: number) {
  return useQuery({
    queryKey: ['leads-by-step', jobId, stepNumber],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}/steps/${stepNumber}/leads`);
      return response.data;
    },
    enabled: !!jobId && stepNumber > 0
  });
}

export function useConvertLeadsToRestaurants() {
  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const response = await api.post('/leads/convert', { leadIds });
      return response.data;
    }
  });
}

export function usePassLeadsToNextStep() {
  return useMutation({
    mutationFn: async ({ stepId, leadIds }: { stepId: string; leadIds: string[] }) => {
      const response = await api.post(`/lead-scrape-job-steps/${stepId}/pass-leads`, { leadIds });
      return response.data;
    }
  });
}
```

---

## Shared UI Patterns

### Progress Bar Animation

Use existing `AnimatedProgressBar` component from `SequenceProgressCard.tsx`:

```typescript
function AnimatedProgressBar({ value }: { value: number }) {
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-blue-light-1 via-brand-blue to-brand-coral transition-all duration-500 ease-out relative overflow-hidden"
        style={{ width: `${value}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}
```

### Filter Card Layout

Follow the established filter card pattern from `Sequences.tsx`:

```jsx
<div className="bg-card border rounded-lg p-4">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4" />
      <h3 className="font-medium">Filters</h3>
    </div>
    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
      Clear All
    </Button>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* Filter inputs */}
  </div>
</div>
```

### Empty State

```jsx
<div className="text-center py-12">
  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
  <h3 className="text-lg font-medium mb-2">No scrape jobs found</h3>
  <p className="text-muted-foreground mb-4">
    Get started by creating a new lead scrape
  </p>
  <Button onClick={() => setCreateJobOpen(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Create First Lead Scrape
  </Button>
</div>
```
