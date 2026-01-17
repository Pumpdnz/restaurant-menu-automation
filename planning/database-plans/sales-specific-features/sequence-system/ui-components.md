# Task Sequence System - UI Components

**Version:** 1.0
**Last Updated:** 2025-01-17

---

## Table of Contents

1. [Overview](#overview)
2. [Design System](#design-system)
3. [Page Components](#page-components)
4. [Modal Components](#modal-components)
5. [Reusable Components](#reusable-components)
6. [Enhanced Existing Pages](#enhanced-existing-pages)
7. [State Management](#state-management)
8. [User Flows](#user-flows)

---

## Overview

The sequence system UI integrates with the existing Pumpd admin interface, using shadcn/ui components and following established design patterns.

### UI Principles

- **Consistency**: Match existing UI patterns and component styles
- **Clarity**: Clear visual hierarchy and status indicators
- **Efficiency**: Streamlined workflows for common tasks
- **Feedback**: Immediate visual feedback for user actions

### Technology Stack

- **Framework**: React with TypeScript
- **Component Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Routing**: React Router
- **Forms**: React Hook Form + Zod validation

---

## Design System

### Colors & Status Indicators

**Sequence Status Colors:**

```tsx
const statusColors = {
  active: 'bg-green-100 text-green-800 border-green-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
};
```

**Task Status Colors (existing):**

```tsx
const taskStatusColors = {
  active: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-600',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};
```

### Typography

Following existing pattern:

- **Page Titles**: `text-2xl font-bold`
- **Section Titles**: `text-lg font-semibold`
- **Card Titles**: `text-base font-medium`
- **Body Text**: `text-sm`
- **Muted Text**: `text-sm text-muted-foreground`

### Spacing

- **Page Padding**: `p-6`
- **Card Padding**: `p-4`
- **Component Spacing**: `space-y-4` for vertical, `space-x-2` for horizontal
- **Section Margins**: `mb-6`

---

## Page Components

### 1. SequenceTemplates Page

**File:** `UberEats-Image-Extractor/src/pages/SequenceTemplates.tsx`

**Purpose:** Manage sequence template library

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Sequence Templates                   [+ New Template]      │
├─────────────────────────────────────────────────────────────┤
│  [Search...] [Filter: Active ▼] [Tags: All ▼]              │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Demo Follow-up Sequence                    [Active]   │  │
│  │ 7 steps • Used 15 times • Tags: demo, onboarding      │  │
│  │ ┌─────────────────────────────────────────────────┐   │  │
│  │ │ 1. Send demo confirmation (0 days)              │   │  │
│  │ │ 2. Prepare materials (1 day)                    │   │  │
│  │ │ 3. Reminder call (1 day)                        │   │  │
│  │ │ ... +4 more steps                               │   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  │ [Edit] [Duplicate] [Deactivate] [Delete]              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Cold Outreach Sequence                  [Inactive]    │  │
│  │ 5 steps • Used 8 times • Tags: outreach, cold         │  │
│  │ ...                                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Component Structure:**

```tsx
export default function SequenceTemplates() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(true);

  const { data: templates, isLoading } = useSequenceTemplates({
    search: searchTerm,
    tags: selectedTags,
    is_active: filterActive
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sequence Templates</h1>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterActive?.toString()} onValueChange={...}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {templates?.data.map(template => (
          <SequenceTemplateCard
            key={template.id}
            template={template}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Modals */}
      <CreateSequenceTemplateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
```

**Features:**

- Search by name/description
- Filter by active status
- Filter by tags
- Card view with expandable step preview
- Quick actions: Edit, Duplicate, Delete
- Empty state for no templates

---

### 2. Sequences Page

**File:** `UberEats-Image-Extractor/src/pages/Sequences.tsx`

**Purpose:** View and manage active sequence instances

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Active Sequences                                            │
├─────────────────────────────────────────────────────────────┤
│  [Filter: All ▼] [Restaurant: All ▼] [Assigned: All ▼]     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Demo Follow-up - Bella Pizza              [Active]    │  │
│  │ Started 3 days ago • Step 3 of 7                       │  │
│  │ ▓▓▓▓▓▓░░░░░░░░░░░░░░ 29%                              │  │
│  │                                                        │  │
│  │ ✓ Send demo confirmation (completed)                  │  │
│  │ ✓ Prepare materials (completed)                       │  │
│  │ ⚡ Reminder call (active - due in 2 hours)            │  │
│  │ ○ Conduct demo (pending)                              │  │
│  │ ○ Follow-up email (pending)                           │  │
│  │ ... +2 more                                            │  │
│  │                                                        │  │
│  │ [View Details] [Pause] [Cancel]                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Cold Outreach - Pizza Palace           [Completed]    │  │
│  │ Completed 1 day ago • All 5 steps completed            │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%                             │  │
│  │ [View Details]                                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Component Structure:**

```tsx
export default function Sequences() {
  const [filters, setFilters] = useState({
    status: 'active',
    restaurant_id: undefined,
    assigned_to: undefined
  });

  const { data: instances, isLoading } = useSequenceInstances(filters);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Active Sequences</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={filters.status} onValueChange={...}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        {/* More filters */}
      </div>

      {/* Instances List */}
      <div className="space-y-4">
        {instances?.data.map(instance => (
          <SequenceProgressCard
            key={instance.id}
            instance={instance}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Modal Components

### 1. CreateSequenceTemplateModal

**File:** `UberEats-Image-Extractor/src/components/sequences/CreateSequenceTemplateModal.tsx`

**Purpose:** Create new sequence template with steps

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  Create Sequence Template                    [×] │
├──────────────────────────────────────────────────┤
│  Basic Information                               │
│  ┌────────────────────────────────────────────┐  │
│  │ Template Name *                            │  │
│  │ [Demo Follow-up Sequence              ]   │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Description                                │  │
│  │ [7-step sequence for demo follow-ups  ]   │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Tags (comma-separated)                     │  │
│  │ [demo, onboarding, follow-up          ]   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Steps                              [+ Add Step] │
│  ┌────────────────────────────────────────────┐  │
│  │ [1] Send demo confirmation         [≡] [×] │  │
│  │     Type: Email • Priority: High           │  │
│  │     Delay: [0] [days ▼]                    │  │
│  │     Message: [Select template ▼]           │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ [2] Prepare demo materials         [≡] [×] │  │
│  │     Type: Internal • Priority: Medium      │  │
│  │     Delay: [1] [days ▼]                    │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ [3] Reminder call                  [≡] [×] │  │
│  │     Type: Call • Priority: High            │  │
│  │     Delay: [1] [days ▼]                    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [Cancel]                    [Create Template]  │
└──────────────────────────────────────────────────┘
```

**Component Structure:**

```tsx
export function CreateSequenceTemplateModal({ open, onClose }) {
  const form = useForm<SequenceTemplateFormData>({
    resolver: zodResolver(sequenceTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      tags: [],
      steps: [
        {
          step_order: 1,
          name: '',
          type: 'email',
          priority: 'medium',
          delay_value: 0,
          delay_unit: 'days'
        }
      ]
    }
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'steps'
  });

  const createMutation = useCreateSequenceTemplate();

  const onSubmit = async (data) => {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        description: data.description,
        tags: data.tags,
        steps: data.steps.map((step, index) => ({
          ...step,
          step_order: index + 1
        }))
      });
      toast.success('Sequence template created');
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sequence Template</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Demo Follow-up Sequence" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe this sequence..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="demo, onboarding, follow-up"
                        onChange={(e) => field.onChange(e.target.value.split(',').map(t => t.trim()))}
                        value={field.value?.join(', ')}
                      />
                    </FormControl>
                    <FormDescription>Comma-separated tags</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Steps</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({
                    step_order: fields.length + 1,
                    name: '',
                    type: 'email',
                    priority: 'medium',
                    delay_value: 1,
                    delay_unit: 'days'
                  })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>

              <DndContext onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map(f => f.id)}>
                  {fields.map((field, index) => (
                    <SequenceStepBuilder
                      key={field.id}
                      index={index}
                      control={form.control}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Features:**

- Form validation with Zod
- Drag-and-drop step reordering
- Add/remove steps dynamically
- Task template and message template selection
- Real-time validation feedback

---

### 2. StartSequenceModal

**File:** `UberEats-Image-Extractor/src/components/sequences/StartSequenceModal.tsx`

**Purpose:** Start a sequence for a restaurant

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  Start Sequence for Bella Pizza              [×] │
├──────────────────────────────────────────────────┤
│  Select Sequence Template                        │
│  ┌────────────────────────────────────────────┐  │
│  │ [Demo Follow-up Sequence            ▼]    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Preview Timeline                                │
│  ┌────────────────────────────────────────────┐  │
│  │ 1. Send demo confirmation (immediate)      │  │
│  │ 2. Prepare materials (+1 day)              │  │
│  │ 3. Reminder call (+1 day)                  │  │
│  │ 4. Conduct demo (+1 day)                   │  │
│  │ 5. Follow-up email (+1 day)                │  │
│  │ 6. Check-in call (+3 days)                 │  │
│  │ 7. Send contract (+7 days)                 │  │
│  │                                            │  │
│  │ Total duration: ~14 days                   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Assign To (optional)                            │
│  ┌────────────────────────────────────────────┐  │
│  │ [Current User                       ▼]    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ⚠️  This will create 7 tasks immediately       │
│                                                  │
│  [Cancel]                    [Start Sequence]   │
└──────────────────────────────────────────────────┘
```

**Component Structure:**

```tsx
export function StartSequenceModal({ open, onClose, restaurant }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [assignedTo, setAssignedTo] = useState(currentUser.id);

  const { data: templates } = useSequenceTemplates({ is_active: true });
  const { data: template } = useSequenceTemplate(selectedTemplate, {
    enabled: !!selectedTemplate
  });

  const startMutation = useStartSequence();

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync({
        sequence_template_id: selectedTemplate,
        restaurant_id: restaurant.id,
        assigned_to: assignedTo
      });
      toast.success('Sequence started successfully');
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start Sequence for {restaurant.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Selection */}
          <div>
            <Label>Select Sequence Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates?.data.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.sequence_steps.length} steps)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {template && (
            <div>
              <Label>Preview Timeline</Label>
              <Card className="p-4 mt-2">
                <div className="space-y-2">
                  {template.sequence_steps.map((step, index) => (
                    <div key={step.id} className="flex items-center text-sm">
                      <span className="text-muted-foreground mr-2">{index + 1}.</span>
                      <span>{step.name}</span>
                      <span className="ml-auto text-muted-foreground">
                        {step.delay_value === 0
                          ? '(immediate)'
                          : `(+${step.delay_value} ${step.delay_unit})`}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t text-sm text-muted-foreground">
                    Total: {calculateTotalDuration(template.sequence_steps)}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Assignment */}
          <div>
            <Label>Assign To (optional)</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentUser.id}>Current User</SelectItem>
                {/* Other users */}
              </SelectContent>
            </Select>
          </div>

          {/* Warning */}
          {template && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will create {template.sequence_steps.length} tasks immediately
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={!selectedTemplate || startMutation.isPending}
          >
            {startMutation.isPending ? 'Starting...' : 'Start Sequence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Reusable Components

### 1. SequenceProgressCard

**File:** `UberEats-Image-Extractor/src/components/sequences/SequenceProgressCard.tsx`

**Purpose:** Display sequence instance with progress

```tsx
export function SequenceProgressCard({ instance, onPause, onResume, onCancel }) {
  const progress = instance.progress;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {instance.name}
              <Badge className={statusColors[instance.status]}>
                {instance.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              Started {formatDistanceToNow(new Date(instance.started_at))} ago
              • Step {instance.current_step_order} of {instance.total_steps}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>{progress.completed} of {progress.total} completed</span>
            <span>{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} />
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {instance.tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center text-sm">
              {task.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600 mr-2" />}
              {task.status === 'active' && <Zap className="h-4 w-4 text-blue-600 mr-2" />}
              {task.status === 'pending' && <Circle className="h-4 w-4 text-gray-400 mr-2" />}

              <span className={task.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                {task.name}
              </span>

              {task.status === 'active' && task.due_date && (
                <span className="ml-auto text-xs text-muted-foreground">
                  due {formatDistanceToNow(new Date(task.due_date))}
                </span>
              )}
            </div>
          ))}
          {instance.tasks.length > 5 && (
            <div className="text-sm text-muted-foreground">
              ... +{instance.tasks.length - 5} more
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/sequences/${instance.id}`}>View Details</Link>
        </Button>

        {instance.status === 'active' && (
          <>
            <Button variant="outline" size="sm" onClick={() => onPause(instance.id)}>
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onCancel(instance.id)}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </>
        )}

        {instance.status === 'paused' && (
          <Button variant="outline" size="sm" onClick={() => onResume(instance.id)}>
            <Play className="h-4 w-4 mr-1" />
            Resume
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

---

### 2. SequenceStepBuilder

**File:** `UberEats-Image-Extractor/src/components/sequences/SequenceStepBuilder.tsx`

**Purpose:** Build/edit a single sequence step

```tsx
export function SequenceStepBuilder({ index, control, onRemove }) {
  const { data: taskTemplates } = useTaskTemplates();
  const { data: messageTemplates } = useMessageTemplates();

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div className="cursor-grab mt-2">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Step Number */}
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold mt-1">
          {index + 1}
        </div>

        {/* Form Fields */}
        <div className="flex-1 space-y-3">
          <FormField
            control={control}
            name={`steps.${index}.name`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input {...field} placeholder="Step name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-2">
            <FormField
              control={control}
              name={`steps.${index}.type`}
              render={({ field }) => (
                <FormItem>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="social_message">Social Message</SelectItem>
                      <SelectItem value="internal_activity">Internal Activity</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`steps.${index}.priority`}
              render={({ field }) => (
                <FormItem>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <FormField
                control={control}
                name={`steps.${index}.delay_value`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`steps.${index}.delay_unit`}
                render={({ field }) => (
                  <FormItem>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minutes">min</SelectItem>
                        <SelectItem value="hours">hrs</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Optional: Message Template Selection */}
          <FormField
            control={control}
            name={`steps.${index}.message_template_id`}
            render={({ field }) => (
              <FormItem>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Message template (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {messageTemplates?.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {/* Delete Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="mt-1"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
```

---

## Enhanced Existing Pages

### 1. Restaurant Detail Page Enhancement

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

**Add Section:** Active Sequences

```tsx
// Add to existing RestaurantDetail component

<div className="mt-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold">Active Sequences</h2>
    <Button size="sm" onClick={() => setStartSequenceModalOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      Start Sequence
    </Button>
  </div>

  {/* Sequences for this restaurant */}
  {restaurantSequences?.length > 0 ? (
    <div className="space-y-4">
      {restaurantSequences.map(instance => (
        <SequenceProgressCard
          key={instance.id}
          instance={instance}
          compact={true}
        />
      ))}
    </div>
  ) : (
    <Card className="p-6 text-center text-muted-foreground">
      No active sequences. Start a sequence to automate follow-up tasks.
    </Card>
  )}

  <StartSequenceModal
    open={startSequenceModalOpen}
    onClose={() => setStartSequenceModalOpen(false)}
    restaurant={restaurant}
  />
</div>
```

---

### 2. Tasks Page Enhancement

**File:** `UberEats-Image-Extractor/src/pages/Tasks.tsx`

**Enhancements:**

1. **Add Sequence Filter**
2. **Show Sequence Badge on Tasks**
3. **Show Step Position**

```tsx
// Add to existing filters
<Select value={sequenceFilter} onValueChange={setSequenceFilter}>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="All Tasks" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Tasks</SelectItem>
    <SelectItem value="sequence_only">Sequence Tasks Only</SelectItem>
    <SelectItem value="standalone_only">Standalone Tasks Only</SelectItem>
  </SelectContent>
</Select>

// In task row rendering
{task.sequence_instance_id && (
  <Badge variant="outline" className="ml-2">
    <Workflow className="h-3 w-3 mr-1" />
    Step {task.sequence_step_order} of {task.sequence_total_steps}
  </Badge>
)}
```

---

## State Management

### React Query Hooks

**File:** `UberEats-Image-Extractor/src/hooks/useSequences.ts`

```tsx
// Sequence Templates
export function useSequenceTemplates(filters) {
  return useQuery({
    queryKey: ['sequence-templates', filters],
    queryFn: () => sequenceTemplatesApi.list(filters)
  });
}

export function useSequenceTemplate(id, options) {
  return useQuery({
    queryKey: ['sequence-template', id],
    queryFn: () => sequenceTemplatesApi.get(id),
    ...options
  });
}

export function useCreateSequenceTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sequenceTemplatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-templates'] });
    }
  });
}

// Sequence Instances
export function useSequenceInstances(filters) {
  return useQuery({
    queryKey: ['sequence-instances', filters],
    queryFn: () => sequenceInstancesApi.list(filters)
  });
}

export function useStartSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sequenceInstancesApi.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
}

export function usePauseSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sequenceInstancesApi.pause,
    onSuccess: (_, instanceId) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instance', instanceId] });
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
    }
  });
}
```

---

## User Flows

### Flow 1: Create Sequence Template

```
1. Navigate to "Sequence Templates" page
2. Click "New Template" button
3. Modal opens
4. Fill in template name, description, tags
5. Add first step (default provided)
6. Click "Add Step" for each additional step
7. Configure each step:
   - Name
   - Type (email, call, etc.)
   - Priority
   - Delay from previous step
   - Optional: message template
8. Drag to reorder steps if needed
9. Click "Create Template"
10. Modal closes, new template appears in list
```

### Flow 2: Start Sequence

```
1. Navigate to Restaurant Detail page
2. Click "Start Sequence" button
3. Modal opens
4. Select sequence template from dropdown
5. Review preview timeline
6. Optionally select user to assign tasks to
7. Click "Start Sequence"
8. Modal closes
9. Sequence appears in "Active Sequences" section
10. All tasks created immediately
11. First task is active, others pending
```

### Flow 3: Monitor Sequence Progress

```
1. Navigate to "Sequences" page
2. See list of all active sequences
3. Each card shows:
   - Sequence name and restaurant
   - Progress bar
   - Current step
   - List of tasks with status
4. Click "View Details" to see full task list
5. Can pause/resume/cancel from card
```

### Flow 4: Complete Tasks in Sequence

```
1. Task appears in Tasks list
2. User completes task
3. Task marked as completed
4. Next task automatically activates
5. Due date calculated based on delay
6. Progress bar updates
7. When all tasks done, sequence marked complete
```

---

**End of UI Components Document**

For implementation roadmap, see [implementation-roadmap.md](implementation-roadmap.md).
