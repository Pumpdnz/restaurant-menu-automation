# Sequence System Enhancements - Planning Document

**Date:** November 22, 2025
**Status:** 📋 PLANNING
**Dependencies:** Feature 4 Complete ✅

---

## Overview

After completing Feature 4 (Sequence Builder Enhancements), we need to improve the sequence display and task management to provide better visibility and organization.

**Two Major Enhancements:**
1. **Sequence Cards Enhancement** - Display actual tasks within sequence instance cards
2. **RestaurantDetail Task Separation** - Separate sequence tasks from standalone tasks in the Tasks & Sequences tab

---

## Enhancement 1: Sequence Cards Display

### Current State

**Location:** Sequences page (`/src/pages/Sequences.tsx` or `/src/pages/SequenceTemplates.tsx`)

**Current Card Display:**
- Sequence name
- Description
- Status (active/paused/completed)
- Restaurant name
- Progress indicator (e.g., "Step 3 of 5")
- Basic metadata

**Missing:**
- **Actual task list** - Users can't see which tasks are in the sequence
- **Task status** - No visibility of completed/pending/active tasks
- **Due dates** - Can't see when tasks are due
- **Task types** - No indication of email/call/demo_meeting tasks

### Desired State

**Enhanced Sequence Instance Card:**
```
┌─────────────────────────────────────────────────────────────┐
│ Demo Follow-up Sequence                        [Active ●]   │
│ Restaurant: Pizza Palace                                     │
│ Progress: 3/5 tasks completed                                │
│                                                               │
│ Tasks:                                                        │
│ ✓ [Email] Send confirmation           Due: Nov 20 (Done)    │
│ ✓ [Call] Follow-up call               Due: Nov 21 (Done)    │
│ ● [Demo] Book demo meeting             Due: Nov 22 (Active) │
│ ○ [Email] Send recap                   Due: Nov 25 (Pending)│
│ ○ [Internal] Update CRM                Due: Nov 27 (Pending)│
│                                                               │
│ [View Details] [Pause] [Complete]                           │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Task list within card** - Show all tasks in sequence
- **Status icons** - ✓ (completed), ● (active), ○ (pending)
- **Task type badges** - [Email], [Call], [Demo], [Text], [Social], [Internal]
- **Due dates** - Formatted relative dates
- **Color coding** - Red (overdue), Blue (today), Gray (future)
- **Expandable/collapsible** - Collapse task list when card minimized

### Implementation Plan

#### Phase 1: Data Fetching (30 minutes)

**Current query (assumed):**
```javascript
// sequence-instances-service.js
const { data: instances } = await supabase
  .from('sequence_instances')
  .select('*')
  .order('created_at', { ascending: false });
```

**Enhanced query with tasks:**
```javascript
const { data: instances } = await supabase
  .from('sequence_instances')
  .select(`
    *,
    restaurants (
      id, name
    ),
    sequence_templates (
      id, name
    ),
    tasks!sequence_instance_id (
      id,
      name,
      type,
      status,
      priority,
      due_date,
      sequence_step_order,
      completed_at
    )
  `)
  .order('created_at', { ascending: false });

// Sort tasks by step_order
instances.forEach(instance => {
  if (instance.tasks) {
    instance.tasks.sort((a, b) => a.sequence_step_order - b.sequence_step_order);
  }
});
```

#### Phase 2: Task List Component (1 hour)

**Create new component:**
```typescript
// /src/components/sequences/SequenceTaskList.tsx

interface SequenceTaskListProps {
  tasks: Task[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function SequenceTaskList({ tasks, isExpanded, onToggleExpand }: SequenceTaskListProps) {
  const getTaskIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active': return <Circle className="h-4 w-4 text-blue-600 fill-blue-600" />;
      default: return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTaskTypeBadge = (type: string) => {
    const typeConfig = {
      email: { label: 'Email', color: 'bg-blue-100 text-blue-800' },
      call: { label: 'Call', color: 'bg-green-100 text-green-800' },
      text: { label: 'Text', color: 'bg-purple-100 text-purple-800' },
      social_message: { label: 'Social', color: 'bg-pink-100 text-pink-800' },
      demo_meeting: { label: 'Demo', color: 'bg-yellow-100 text-yellow-800' },
      internal_activity: { label: 'Internal', color: 'bg-gray-100 text-gray-800' }
    };

    const config = typeConfig[type] || typeConfig.internal_activity;
    return (
      <Badge className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const formatDueDate = (dueDate: string, status: string) => {
    if (status === 'completed') return 'Done';
    // Use date formatting logic similar to Tasks page
    // Return relative date: "Today", "Tomorrow", "Nov 25", etc.
  };

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
      >
        <p className="text-sm font-medium">Tasks ({tasks.length})</p>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>

      {isExpanded && (
        <div className="space-y-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 text-sm"
            >
              {getTaskIcon(task.status)}
              {getTaskTypeBadge(task.type)}
              <span className="flex-1 truncate">{task.name}</span>
              <span className={`text-xs ${
                task.status === 'completed' ? 'text-green-600' :
                isOverdue(task.due_date) ? 'text-red-600' :
                isToday(task.due_date) ? 'text-blue-600' :
                'text-gray-600'
              }`}>
                {formatDueDate(task.due_date, task.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Phase 3: Update Sequence Card (30 minutes)

**Update SequenceInstanceCard component:**
```typescript
// /src/components/sequences/SequenceInstanceCard.tsx (or similar)

export function SequenceInstanceCard({ instance }: { instance: SequenceInstance }) {
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  const completedTasks = instance.tasks?.filter(t => t.status === 'completed').length || 0;
  const totalTasks = instance.tasks?.length || 0;

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{instance.sequence_templates?.name}</h3>
          <p className="text-sm text-muted-foreground">
            {instance.restaurants?.name}
          </p>
        </div>
        <Badge>{instance.status}</Badge>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span>Progress</span>
          <span className="font-medium">{completedTasks}/{totalTasks} completed</span>
        </div>
        <Progress value={(completedTasks / totalTasks) * 100} />
      </div>

      {/* Task List */}
      {instance.tasks && instance.tasks.length > 0 && (
        <SequenceTaskList
          tasks={instance.tasks}
          isExpanded={isTasksExpanded}
          onToggleExpand={() => setIsTasksExpanded(!isTasksExpanded)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Button size="sm" variant="outline">View Details</Button>
        <Button size="sm" variant="outline">Pause</Button>
        <Button size="sm" variant="outline">Complete</Button>
      </div>
    </Card>
  );
}
```

#### Phase 4: Testing (30 minutes)

**Test scenarios:**
1. Sequence with 0 tasks (edge case)
2. Sequence with 1 task
3. Sequence with all tasks completed
4. Sequence with mixed task statuses
5. Sequence with overdue tasks
6. Expand/collapse task list
7. Task type badges display correctly
8. Due date formatting

---

## Enhancement 2: RestaurantDetail Task Separation

### Current State

**Location:** RestaurantDetail page, "Tasks and Sequences" tab

**Current Display:**
- All tasks shown in single list (standalone + sequence tasks mixed)
- Sequences shown separately below tasks
- No visual separation of task sources

**Problem:**
- Can't distinguish standalone tasks from sequence tasks
- Sequence tasks clutter the standalone task list
- Duplicate visibility (task in list AND in sequence)

### Desired State

**Two Separate Sections:**

```
┌─────────────────────────────────────────────────────────────┐
│ Tasks & Sequences Tab                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Active Sequences (2)                      [+ Start Sequence] │
│                                                               │
│ ┌─── Demo Follow-up Sequence ───────────────────────────┐   │
│ │ Progress: 3/5 • Active                                 │   │
│ │ ● [Demo] Book demo meeting      Due: Today             │   │
│ │ ○ [Email] Send recap            Due: Nov 25            │   │
│ │ ○ [Internal] Update CRM         Due: Nov 27            │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌─── Onboarding Sequence ───────────────────────────────┐   │
│ │ Progress: 1/3 • Active                                 │   │
│ │ ✓ [Email] Welcome email         Done                   │   │
│ │ ● [Call] Introduction call      Due: Tomorrow          │   │
│ │ ○ [Internal] Setup account      Due: Dec 1             │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ───────────────────────────────────────────────────────────  │
│                                                               │
│ Standalone Tasks (3)                      [+ Create Task]    │
│                                                               │
│ • [Call] Follow-up on pricing           Due: Today (Overdue) │
│ • [Email] Send contract                 Due: Nov 24          │
│ • [Internal] Update notes               Due: Nov 30          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Sequences section first** - More important, shows automated workflow
- **Tasks section second** - Standalone tasks only
- **Clear separation** - Visual divider between sections
- **Sequence tasks NOT in standalone list** - Only show in sequence context
- **Collapsible sequences** - Each sequence can expand/collapse
- **Action buttons** - Add sequence, add standalone task

### Implementation Plan

#### Phase 1: Data Fetching Update (30 minutes)

**Current query (assumed):**
```javascript
// In RestaurantDetail component
const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('restaurant_id', restaurantId)
  .order('due_date');
```

**Enhanced query with separation:**
```javascript
// Fetch sequences with tasks
const { data: sequences } = await supabase
  .from('sequence_instances')
  .select(`
    *,
    sequence_templates (
      id, name
    ),
    tasks!sequence_instance_id (
      id,
      name,
      type,
      status,
      priority,
      due_date,
      sequence_step_order,
      completed_at
    )
  `)
  .eq('restaurant_id', restaurantId)
  .in('status', ['active', 'paused'])  // Only active sequences
  .order('created_at', { ascending: false });

// Fetch standalone tasks only (NOT part of any sequence)
const { data: standaloneTasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('restaurant_id', restaurantId)
  .is('sequence_instance_id', null)  // KEY: Only tasks NOT in sequences
  .in('status', ['active', 'pending'])
  .order('due_date');
```

**Key change:** `is('sequence_instance_id', null)` filters out sequence tasks

#### Phase 2: Update Component Structure (1 hour)

**Modify Tasks & Sequences tab:**

```typescript
// In RestaurantDetail.tsx or RestaurantTasksAndSequences.tsx

export function TasksAndSequencesTab({ restaurantId }: { restaurantId: string }) {
  const [sequences, setSequences] = useState([]);
  const [standaloneTasks, setStandaloneTasks] = useState([]);

  useEffect(() => {
    fetchSequencesAndTasks();
  }, [restaurantId]);

  const fetchSequencesAndTasks = async () => {
    // Fetch sequences with tasks
    const { data: seqData } = await supabase
      .from('sequence_instances')
      .select(`*, sequence_templates (*), tasks (*)`)
      .eq('restaurant_id', restaurantId)
      .in('status', ['active', 'paused']);

    // Fetch standalone tasks
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .is('sequence_instance_id', null)
      .in('status', ['active', 'pending']);

    setSequences(seqData || []);
    setStandaloneTasks(taskData || []);
  };

  return (
    <div className="space-y-6">
      {/* Sequences Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Active Sequences ({sequences.length})
          </h3>
          <Button onClick={() => setShowStartSequenceModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Start Sequence
          </Button>
        </div>

        {sequences.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No active sequences. Start a sequence to automate tasks.
          </Card>
        ) : (
          <div className="space-y-3">
            {sequences.map(sequence => (
              <SequenceCard
                key={sequence.id}
                sequence={sequence}
                onRefresh={fetchSequencesAndTasks}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <Separator />

      {/* Standalone Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Standalone Tasks ({standaloneTasks.length})
          </h3>
          <Button onClick={() => setShowCreateTaskModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>

        {standaloneTasks.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No standalone tasks. All current tasks are part of sequences.
          </Card>
        ) : (
          <RestaurantTasksList
            tasks={standaloneTasks}
            onRefresh={fetchSequencesAndTasks}
          />
        )}
      </div>
    </div>
  );
}
```

#### Phase 3: Reuse SequenceCard Component (30 minutes)

**Create SequenceCard for RestaurantDetail:**
```typescript
// /src/components/sequences/SequenceCard.tsx (in restaurant context)

export function SequenceCard({ sequence, onRefresh }: SequenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const tasks = sequence.tasks || [];
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const activeTask = tasks.find(t => t.status === 'active');

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{sequence.sequence_templates?.name}</h4>
            <Badge variant={sequence.status === 'active' ? 'default' : 'secondary'}>
              {sequence.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Progress: {completedCount}/{tasks.length} • Current: {activeTask?.name || 'Completed'}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isExpanded && (
        <SequenceTaskList
          tasks={tasks}
          isExpanded={true}
          onToggleExpand={() => {}}
        />
      )}

      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Button size="sm" variant="outline" onClick={() => handlePause(sequence.id)}>
          Pause
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleComplete(sequence.id)}>
          Complete
        </Button>
      </div>
    </Card>
  );
}
```

#### Phase 4: Testing (30 minutes)

**Test scenarios:**
1. Restaurant with no sequences, no standalone tasks
2. Restaurant with sequences only
3. Restaurant with standalone tasks only
4. Restaurant with both sequences and standalone tasks
5. Complete a sequence task → verify it stays in sequence, not in standalone
6. Create standalone task → verify it appears in standalone section only
7. Start new sequence → verify it appears in sequences section
8. Pause/complete sequence → verify UI updates

---

## Implementation Summary

### Enhancement 1: Sequence Cards Display

**Time Estimate:** 2.5-3 hours

**Files to Create:**
- `/src/components/sequences/SequenceTaskList.tsx` (new)

**Files to Modify:**
- `/src/components/sequences/SequenceInstanceCard.tsx` (or similar)
- `/src/services/sequence-instances-service.js` (query update)

**Key Changes:**
1. Enhance data fetching to include tasks
2. Create SequenceTaskList component
3. Update SequenceInstanceCard with task display
4. Add expand/collapse functionality
5. Add task status icons and type badges

### Enhancement 2: RestaurantDetail Task Separation

**Time Estimate:** 2.5-3 hours

**Files to Create:**
- `/src/components/sequences/SequenceCard.tsx` (for restaurant context - may already exist)

**Files to Modify:**
- `/src/pages/RestaurantDetail.tsx` or equivalent tab component
- Data fetching logic for tasks and sequences

**Key Changes:**
1. Split data fetching (sequences vs standalone tasks)
2. Add `is('sequence_instance_id', null)` filter for standalone tasks
3. Restructure tab layout (sequences first, tasks second)
4. Add section headers and action buttons
5. Reuse SequenceTaskList component

---

## Total Effort

| Enhancement | Time | Complexity | Risk |
|-------------|------|------------|------|
| Enhancement 1: Sequence Cards | 2.5-3h | Medium | Low |
| Enhancement 2: Task Separation | 2.5-3h | Medium | Low |
| **Total** | **5-6 hours** | **Medium** | **Low** |

---

## Dependencies

**Required (already complete):**
- ✅ Feature 4 (Sequence Builder) - subject_line, demo_meeting type
- ✅ Tasks page - TaskTypeQuickView, task filtering
- ✅ RestaurantDetail - Basic structure, tabs

**Optional:**
- Task modals (CreateTaskModal, EditTaskModal) - for standalone task management
- Sequence modals - for pause/complete actions

---

## Success Criteria

### Enhancement 1: Sequence Cards

- ✅ Sequence cards display task list
- ✅ Task status icons display correctly (✓ ● ○)
- ✅ Task type badges show correct colors
- ✅ Due dates formatted and color-coded
- ✅ Expand/collapse works
- ✅ Progress indicator accurate

### Enhancement 2: Task Separation

- ✅ Sequences section shows all active sequences
- ✅ Standalone tasks section shows non-sequence tasks only
- ✅ Sequence tasks NOT in standalone list
- ✅ Visual separation clear
- ✅ Action buttons functional
- ✅ Data refreshes correctly after actions

---

## Next Steps

1. **Review and approve** this plan
2. **Implement Enhancement 1** - Sequence Cards Display
3. **Implement Enhancement 2** - Task Separation
4. **Test both enhancements** end-to-end
5. **Update documentation** with completion reports

**Estimated Total Time:** 5-6 hours

---

**Status:** 📋 Ready for Implementation
**Last Updated:** November 22, 2025
