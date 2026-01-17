# Sequences Page Refactoring Plan

**Date:** November 23, 2025
**Enhancement:** Phase 2.4 - Sequences Page Filter Improvements & Template Integration
**Includes:** Phase 2.3 Finish Sequence Integration
**Estimated Time:** 5.5 hours
**Status:** ✅ **COMPLETE**
**Actual Time:** ~5.5 hours

---

## Implementation Complete Summary

**All planned features have been successfully implemented:**

✅ Tab-based layout (Instances + Templates)
✅ Advanced filters on Instances tab (Restaurant, Status, Search)
✅ "Reset to Default" and "Clear All" buttons
✅ "New Sequence" button with two-step modal flow
✅ SelectRestaurantForSequenceModal with restaurant filters
✅ Templates tab integration (full SequenceTemplates page functionality)
✅ Navigation updates (removed sequence-templates link, added redirect)
✅ Phase 2.3 Finish Sequence integration (all three workflows)
✅ useRestaurants hook created

**Files Created:** 2
**Files Modified:** 3
**Total Lines:** ~700 lines

---

## Table of Contents
1. [Overview](#overview)
2. [Research Findings](#research-findings)
3. [Requirements Summary](#requirements-summary)
4. [Implementation Plan](#implementation-plan)
5. [Files to Modify](#files-to-modify)
6. [Detailed Implementation Steps](#detailed-implementation-steps)
7. [Testing Checklist](#testing-checklist)

---

## Overview

### Current State
- Sequences page (`/sequences`) displays only sequence instances with basic status filter
- Sequence Templates page (`/sequence-templates`) is a separate page
- Limited filtering capability on sequences page
- No "Create New Sequence" button on sequences page

### Target State
- Sequences page with **tab-based layout**:
  - **Tab 1: Instances** - All sequence instances with advanced filters
  - **Tab 2: Templates** - All sequence templates (moved from separate page)
- Advanced filtering on Instances tab:
  - Restaurant filter (MultiSelect)
  - Status filter (MultiSelect)
  - Search box (search across restaurant, sequence name, template name)
- "Create New Sequence" button to start a sequence for a restaurant
- Remove `/sequence-templates` route and update all navigation

### Key Design Decisions
- **DO NOT** add "Assigned To" filter (per user correction)
- **DO NOT** add "Sequence Template" filter on Instances tab (redundant with Templates tab)
- Use existing `StartSequenceModal` component for creating new sequences
- Follow Tasks page pattern for filter structure and layout
- Follow SocialMediaDashboard pattern for tab implementation
- **Integrate Phase 2.3 "Finish Sequence" functionality** to support all three finish options:
  - Finish Only
  - Finish & Set Follow-up (uses `CreateTaskModal`)
  - Finish & Start New Sequence (uses `StartSequenceModal`)

---

## Research Findings

### 1. Filter Patterns from Tasks Page

**Location:** `/src/pages/Tasks.tsx`

**Filter Structure:**
- Collapsible filter cards with clear section headers
- Two-tier filtering: "Task Filters" and "Restaurant Filters"
- Default filter values to show most relevant items
- "Clear All" and "Reset to Default" buttons
- Grid layout: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

**Components Used:**
- `Input` - Search field with icon
- `MultiSelect` - Most filters (status, type, priority)
- `Select` - Single-choice filters
- State management with default values

**Filter State Pattern:**
```tsx
const [filters, setFilters] = useState({
  search: '',
  status: ['active'] as string[],  // Default values
  restaurant_id: [] as string[]
});
```

**Filtering Logic:**
- Client-side filtering in `applyFiltersAndSort()` function
- Sequential filter application
- Uses `.includes()` for MultiSelect matching
- Uses `.toLowerCase().includes()` for search

### 2. Create Sequence Component

**Component:** `StartSequenceModal.tsx`

**Props:**
```tsx
interface StartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;  // Requires restaurant object
}
```

**Flow:**
1. User selects a sequence template from dropdown
2. Preview shows all steps with delays
3. Confirmation creates all tasks (first active, rest pending)

**Challenge:** Component requires a `restaurant` object, but we need a "Create New Sequence" button on the main page where no restaurant context exists.

**Solution:** Create intermediate modal for restaurant selection → opens StartSequenceModal

### 3. Tab Implementation Pattern

**Best Example:** `SocialMediaDashboard.tsx`

**Pattern:**
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="grid grid-cols-2 gap-1.5 sm:flex">
    <TabsTrigger value="instances">Instances</TabsTrigger>
    <TabsTrigger value="templates">Templates</TabsTrigger>
  </TabsList>

  <TabsContent value="instances">
    {/* Instances content */}
  </TabsContent>

  <TabsContent value="templates">
    {/* Templates content */}
  </TabsContent>
</Tabs>
```

**Features:**
- URL sync with `useSearchParams` for deep linking
- Separate state/logic per tab
- Responsive layout for tab triggers

### 4. Current Navigation Links

**Files with Sequence Template Links:**

1. **NavigationItems.jsx** (lines 37-38)
```jsx
{ href: '/sequences', label: 'Sequences', icon: Workflow },
{ href: '/sequence-templates', label: 'Sequence Templates', icon: ClipboardList },
```

2. **App.tsx** (lines 163-164)
```jsx
<Route path="sequences" element={<Sequences />} />
<Route path="sequence-templates" element={<SequenceTemplates />} />
```

**Action:** Remove `/sequence-templates` link from navigation, remove route from App.tsx

---

## Requirements Summary

### Functional Requirements

#### FR1: Tab-Based Layout
- Two tabs: "Instances" and "Templates"
- Default to "Instances" tab
- URL sync: `/sequences?tab=instances` or `/sequences?tab=templates`
- Maintain scroll position when switching tabs

#### FR2: Instances Tab Filters
- **Restaurant Filter** (MultiSelect)
  - Options: All restaurants that have sequences
  - Display: Restaurant name
  - Default: Empty (show all)

- **Status Filter** (MultiSelect)
  - Options: active, paused, completed, cancelled
  - Default: `['active']` (show only active)

- **Search Box** (Text Input)
  - Search fields: Restaurant name, sequence template name, sequence instance name (if exists)
  - Position: Top right of filter row
  - Placeholder: "Search sequences..."
  - Width: `w-64` (256px)

- **Filter Actions**
  - "Clear All" button (appears when any non-default filters applied)
  - "Reset to Default" button (appears when filters differ from defaults)

#### FR3: Create New Sequence Button
- Position: Top right of page header
- Label: "New Sequence"
- Icon: Plus icon
- Style: Gradient `bg-gradient-to-r from-brand-blue to-brand-green`
- Opens: `SelectRestaurantForSequenceModal` → `StartSequenceModal`

#### FR4: Templates Tab Content
- Migrate entire SequenceTemplates page content into tab
- Keep all existing functionality:
  - Search templates
  - Active/Inactive filter
  - Create template button
  - Edit/Delete/Duplicate actions
  - Template cards display

#### FR5: Navigation Updates
- Remove "Sequence Templates" from sidebar navigation
- Remove `/sequence-templates` route
- Redirect `/sequence-templates` → `/sequences?tab=templates` (for bookmarks)

### Non-Functional Requirements

#### NFR1: Performance
- Client-side filtering (no server calls on filter change)
- Maintain React Query caching behavior
- Auto-refresh sequence instances every 30 seconds

#### NFR2: UX Consistency
- Follow Tasks page filter layout patterns
- Match existing component styles
- Maintain responsive breakpoints

#### NFR3: Accessibility
- Keyboard navigation for tabs
- Screen reader labels for filters
- Focus management when opening modals

---

## Implementation Plan

### Phase 1: Component Preparation (1 hour)

**Step 1.1: Create SelectRestaurantForSequenceModal**
- New component: `/src/components/sequences/SelectRestaurantForSequenceModal.tsx`
- Props: `{ open, onClose, onSelectRestaurant }`
- Features:
  - Search restaurants by name
  - Filter by active restaurants only
  - Display restaurant with lead stage badge
  - "Select" button to confirm
- Flow: Select restaurant → Opens StartSequenceModal with restaurant context

**Step 1.2: Update StartSequenceModal**
- Add optional `initialOpen` prop to control visibility
- Allow parent to control open/close state
- No structural changes needed

### Phase 2: Sequences Page Refactoring (2.5 hours)

**Step 2.1: Add Tab Structure**
- Import Tabs components from shadcn/ui
- Create two tabs: "Instances" and "Templates"
- Add URL parameter sync with `useSearchParams`
- Maintain activeTab state

**Step 2.2: Create Instances Tab Content**
- Extract current Sequences page content into Instances tab
- Add advanced filter section:
  - Restaurant filter (MultiSelect)
  - Status filter (MultiSelect - upgrade from single Select)
  - Search input
- Implement filter state management
- Implement client-side filtering logic

**Step 2.3: Create Templates Tab Content**
- Copy entire SequenceTemplates page content
- Integrate into Templates TabsContent
- Maintain all existing functionality
- Keep component imports

**Step 2.4: Add Create New Sequence Button**
- Add to page header
- Opens SelectRestaurantForSequenceModal
- Handle two-step modal flow

**Step 2.5: Integrate Phase 2.3 Finish Sequence Functionality**
- Add `CreateTaskModal` import
- Add task creation modal state (createTaskModalOpen, followUpTaskId, selectedRestaurantId)
- Implement `handleFinish` function to support all three finish options:
  - Finish Only: Just completes the sequence
  - Finish & Set Follow-up: Opens CreateTaskModal with followUpFromTaskId
  - Finish & Start New Sequence: Opens StartSequenceModal with restaurant
- Pass `onFinish` prop to SequenceProgressCard components
- Add CreateTaskModal to JSX modals section

### Phase 3: Navigation Updates (30 minutes)

**Step 3.1: Update NavigationItems.jsx**
- Remove "Sequence Templates" link
- Keep only "Sequences" link

**Step 3.2: Update App.tsx**
- Remove `/sequence-templates` route
- Add redirect from `/sequence-templates` to `/sequences?tab=templates`

**Step 3.3: Test Navigation**
- Verify sidebar navigation
- Test redirect for old bookmarks

### Phase 4: Testing & Polish (1 hour)

**Step 4.1: Filter Testing**
- Test each filter independently
- Test filter combinations
- Test clear/reset buttons
- Test search functionality

**Step 4.2: Tab Testing**
- Test tab switching
- Test URL sync
- Test deep linking
- Test browser back/forward

**Step 4.3: Modal Flow Testing**
- Test create sequence flow
- Test restaurant selection
- Test sequence template selection
- Test error handling

**Step 4.4: Responsive Testing**
- Test mobile layout
- Test tablet layout
- Test desktop layout

---

## Files to Modify

### New Files (1)
1. `/src/components/sequences/SelectRestaurantForSequenceModal.tsx` ⭐ NEW

### Modified Files (3)
1. `/src/pages/Sequences.tsx` 🔧 MAJOR REFACTOR
2. `/src/components/navigation/NavigationItems.jsx` 🔧 REMOVE LINK
3. `/src/App.tsx` 🔧 REMOVE ROUTE + ADD REDIRECT

### Reference Files (No Changes)
- `/src/pages/SequenceTemplates.tsx` - Content will be copied to Sequences.tsx
- `/src/components/sequences/StartSequenceModal.tsx` - No changes needed (used for creating sequences)
- `/src/components/tasks/CreateTaskModal.tsx` - No changes needed (used for Phase 2.3 finish-followup integration)
- `/src/pages/Tasks.tsx` - Reference for filter patterns

---

## Detailed Implementation Steps

### STEP 1: Create SelectRestaurantForSequenceModal

**File:** `/src/components/sequences/SelectRestaurantForSequenceModal.tsx`

```tsx
import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRestaurants } from '@/hooks/useRestaurants';

interface SelectRestaurantForSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void;
}

export function SelectRestaurantForSequenceModal({
  open,
  onClose,
  onSelectRestaurant,
}: SelectRestaurantForSequenceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: restaurants, isLoading } = useRestaurants();

  // Filter restaurants by search term and active status
  const filteredRestaurants = restaurants?.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const isActive = r.lead_status === 'active';
    return matchesSearch && isActive;
  }) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[600px]">
        <DialogHeader>
          <DialogTitle>Select Restaurant for Sequence</DialogTitle>
          <DialogDescription>
            Choose a restaurant to start a new sequence
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search restaurants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Restaurant List */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {isLoading && (
              <p className="text-center text-muted-foreground py-8">Loading restaurants...</p>
            )}

            {!isLoading && filteredRestaurants.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No restaurants found matching "{searchTerm}"
              </p>
            )}

            {filteredRestaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => onSelectRestaurant(restaurant)}
              >
                <div className="flex-1">
                  <h4 className="font-medium">{restaurant.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {restaurant.lead_stage?.replace(/_/g, ' ')}
                    </Badge>
                    {restaurant.lead_warmth && (
                      <Badge variant="secondary" className="text-xs">
                        {restaurant.lead_warmth}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button size="sm">Select</Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Features:**
- Search by restaurant name
- Filter to active restaurants only
- Display lead stage and warmth badges
- Scrollable list for many restaurants
- Click row or "Select" button to choose

---

### STEP 2: Refactor Sequences.tsx

**File:** `/src/pages/Sequences.tsx`

**Imports Required:**
```tsx
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { SelectRestaurantForSequenceModal } from '../components/sequences/SelectRestaurantForSequenceModal';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import { SequenceProgressCard } from '../components/sequences/SequenceProgressCard';
// ... other imports
```

**High-Level Structure:**
```tsx
export default function Sequences() {
  // Tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'instances';

  // Instances tab state
  const [instanceFilters, setInstanceFilters] = useState({
    search: '',
    status: ['active'] as string[],
    restaurant_id: [] as string[]
  });

  // Templates tab state (from SequenceTemplates.tsx)
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Modal state for creating sequences
  const [selectRestaurantOpen, setSelectRestaurantOpen] = useState(false);
  const [startSequenceOpen, setStartSequenceOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // Modal state for task creation (Finish & Set Follow-up)
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [followUpTaskId, setFollowUpTaskId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Data fetching
  const { data: instances, isLoading: instancesLoading } = useSequenceInstances();
  const { data: templates, isLoading: templatesLoading } = useSequenceTemplates();
  const { data: restaurants } = useRestaurants();

  // Filter instances logic
  const filteredInstances = useMemo(() => {
    if (!instances?.data) return [];

    return instances.data.filter((instance) => {
      // Status filter
      if (instanceFilters.status.length > 0 && !instanceFilters.status.includes(instance.status)) {
        return false;
      }

      // Restaurant filter
      if (instanceFilters.restaurant_id.length > 0 && !instanceFilters.restaurant_id.includes(instance.restaurant_id)) {
        return false;
      }

      // Search filter
      if (instanceFilters.search) {
        const searchLower = instanceFilters.search.toLowerCase();
        const restaurantName = instance.restaurant?.name?.toLowerCase() || '';
        const templateName = instance.sequence_template?.name?.toLowerCase() || '';
        return restaurantName.includes(searchLower) || templateName.includes(searchLower);
      }

      return true;
    });
  }, [instances, instanceFilters]);

  // Filter templates logic (from SequenceTemplates.tsx)
  const filteredTemplates = useMemo(() => {
    // ... existing template filtering logic
  }, [templates, templateSearchTerm, filterActive]);

  // Tab change handler
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Create sequence flow
  const handleCreateSequence = () => {
    setSelectRestaurantOpen(true);
  };

  const handleRestaurantSelected = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectRestaurantOpen(false);
    setStartSequenceOpen(true);
  };

  const handleStartSequenceClose = () => {
    setStartSequenceOpen(false);
    setSelectedRestaurant(null);
  };

  // Finish sequence handler (for Phase 2.3 integration)
  const handleFinish = async (instanceId: string, option: 'finish-only' | 'finish-followup' | 'finish-start-new') => {
    if (!window.confirm('Are you sure you want to finish this sequence? Active tasks will be marked complete and pending tasks will be cancelled.')) {
      return;
    }

    await finishMutation.mutateAsync(instanceId);

    const sequence = instances?.data?.find(s => s.id === instanceId);

    if (option === 'finish-followup') {
      // Find last active task and open CreateTaskModal
      const lastActiveTask = sequence?.tasks?.find(t => t.status === 'active');
      if (lastActiveTask && sequence?.restaurant_id) {
        setFollowUpTaskId(lastActiveTask.id);
        setSelectedRestaurantId(sequence.restaurant_id);
        setCreateTaskModalOpen(true);
      }
    } else if (option === 'finish-start-new') {
      // Open StartSequenceModal with restaurant
      if (sequence?.restaurants) {
        setSelectedRestaurant(sequence.restaurants);
        setStartSequenceOpen(true);
      }
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setInstanceFilters({
      search: '',
      status: ['active'],
      restaurant_id: []
    });
  };

  const handleClearFilters = () => {
    setInstanceFilters({
      search: '',
      status: [],
      restaurant_id: []
    });
  };

  // Check if filters are at default
  const isDefaultFilters =
    instanceFilters.search === '' &&
    instanceFilters.status.length === 1 &&
    instanceFilters.status[0] === 'active' &&
    instanceFilters.restaurant_id.length === 0;

  const hasAnyFilters =
    instanceFilters.search !== '' ||
    instanceFilters.status.length > 0 ||
    instanceFilters.restaurant_id.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Sequences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sequence instances and templates
          </p>
        </div>
        <Button
          onClick={handleCreateSequence}
          className="bg-gradient-to-r from-brand-blue to-brand-green"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* INSTANCES TAB */}
        <TabsContent value="instances" className="space-y-6">
          {/* Filters Card */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h3 className="font-medium">Filters</h3>
              </div>
              <div className="flex gap-2">
                {hasAnyFilters && !isDefaultFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    Clear All
                  </Button>
                )}
                {!isDefaultFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                  >
                    Reset to Default
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search Input */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sequences..."
                  value={instanceFilters.search}
                  onChange={(e) => setInstanceFilters({ ...instanceFilters, search: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <MultiSelect
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Paused', value: 'paused' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' }
                ]}
                selected={instanceFilters.status}
                onChange={(selected) => setInstanceFilters({ ...instanceFilters, status: selected })}
                placeholder="Status"
              />

              {/* Restaurant Filter */}
              <MultiSelect
                options={
                  restaurants?.map((r) => ({
                    label: r.name,
                    value: r.id
                  })) || []
                }
                selected={instanceFilters.restaurant_id}
                onChange={(selected) => setInstanceFilters({ ...instanceFilters, restaurant_id: selected })}
                placeholder="Restaurant"
              />
            </div>
          </div>

          {/* Instances List */}
          {instancesLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!instancesLoading && filteredInstances.length === 0 && (
            <div className="text-center py-12">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sequences found</h3>
              <p className="text-muted-foreground mb-4">
                {hasAnyFilters
                  ? 'Try adjusting your filters'
                  : 'Get started by creating a new sequence'}
              </p>
              {!hasAnyFilters && (
                <Button onClick={handleCreateSequence}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Sequence
                </Button>
              )}
            </div>
          )}

          {!instancesLoading && filteredInstances.length > 0 && (
            <div className="space-y-4">
              {filteredInstances.map((instance) => (
                <SequenceProgressCard
                  key={instance.id}
                  instance={instance}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                  onFinish={handleFinish}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-6">
          {/* Copy entire SequenceTemplates.tsx content here */}
          {/* Keep all existing template functionality */}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SelectRestaurantForSequenceModal
        open={selectRestaurantOpen}
        onClose={() => setSelectRestaurantOpen(false)}
        onSelectRestaurant={handleRestaurantSelected}
      />

      {selectedRestaurant && (
        <StartSequenceModal
          open={startSequenceOpen}
          onClose={handleStartSequenceClose}
          restaurant={selectedRestaurant}
        />
      )}

      {/* Create Task Modal for Follow-up (Phase 2.3 integration) */}
      {followUpTaskId && selectedRestaurantId && (
        <CreateTaskModal
          open={createTaskModalOpen}
          onClose={() => {
            setCreateTaskModalOpen(false);
            setFollowUpTaskId(null);
            setSelectedRestaurantId(null);
          }}
          onSuccess={() => {
            setCreateTaskModalOpen(false);
            setFollowUpTaskId(null);
            setSelectedRestaurantId(null);
          }}
          restaurantId={selectedRestaurantId}
          followUpFromTaskId={followUpTaskId}
        />
      )}
    </div>
  );
}
```

**Key Changes:**
1. Added Tabs structure with URL sync
2. Upgraded status filter from Select to MultiSelect
3. Added restaurant filter (MultiSelect)
4. Added search input
5. Implemented filter state and logic
6. Added "Clear All" and "Reset to Default" buttons
7. Added "New Sequence" button in header
8. Integrated Templates tab content
9. Added modal flow for creating sequences
10. **Integrated Phase 2.3 Finish Sequence functionality:**
    - Added `handleFinish` handler for all three finish options
    - Added `CreateTaskModal` for "Finish & Set Follow-up" option
    - Passed `onFinish` prop to `SequenceProgressCard` components
    - Supports finish-only, finish-followup, and finish-start-new workflows

---

### STEP 3: Update Navigation

**File:** `/src/components/navigation/NavigationItems.jsx`

**Before:**
```jsx
const navigationItems = [
  // ... other items
  { href: '/sequences', label: 'Sequences', icon: Workflow },
  { href: '/sequence-templates', label: 'Sequence Templates', icon: ClipboardList },
  // ... other items
];
```

**After:**
```jsx
const navigationItems = [
  // ... other items
  { href: '/sequences', label: 'Sequences', icon: Workflow },
  // REMOVED: sequence-templates link
  // ... other items
];
```

---

### STEP 4: Update App.tsx Routes

**File:** `/src/App.tsx`

**Before:**
```jsx
<Routes>
  {/* ... other routes */}
  <Route path="sequences" element={<Sequences />} />
  <Route path="sequence-templates" element={<SequenceTemplates />} />
  {/* ... other routes */}
</Routes>
```

**After:**
```jsx
<Routes>
  {/* ... other routes */}
  <Route path="sequences" element={<Sequences />} />
  {/* Redirect old route to new tab-based page */}
  <Route
    path="sequence-templates"
    element={<Navigate to="/sequences?tab=templates" replace />}
  />
  {/* ... other routes */}
</Routes>
```

**Note:** Import Navigate from react-router-dom:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
```

---

## Testing Checklist

### Functional Testing

#### Instances Tab - Filters
- [ ] Status filter: Select single status, verify filtered results
- [ ] Status filter: Select multiple statuses, verify OR logic
- [ ] Status filter: Default shows only "active" sequences
- [ ] Restaurant filter: Select single restaurant, verify filtered results
- [ ] Restaurant filter: Select multiple restaurants, verify OR logic
- [ ] Search box: Search by restaurant name, verify results
- [ ] Search box: Search by sequence template name, verify results
- [ ] Combined filters: Apply multiple filters, verify AND logic
- [ ] Clear All: Clears all filters to empty state
- [ ] Reset to Default: Resets to status=['active'] only
- [ ] Filter buttons: "Clear All" only shows when filters applied
- [ ] Filter buttons: "Reset to Default" only shows when not at default

#### Instances Tab - Display
- [ ] Loading state: Shows spinner while fetching
- [ ] Empty state: Shows when no sequences exist
- [ ] Empty state: Shows when filters return no results
- [ ] Filtered results: Shows correct sequences matching all filters
- [ ] Sequence cards: Display correctly with all information
- [ ] Action buttons: Pause/Resume/Cancel/Finish work correctly

#### Templates Tab
- [ ] Template list: Displays all templates correctly
- [ ] Search templates: Filters templates by name
- [ ] Active/Inactive filter: Filters templates correctly
- [ ] Create template: Opens modal and creates template
- [ ] Edit template: Opens modal and saves changes
- [ ] Delete template: Confirms and deletes template
- [ ] Duplicate template: Creates copy correctly

#### Tab Navigation
- [ ] Default tab: Opens to "Instances" tab
- [ ] Tab switching: Switches between tabs correctly
- [ ] URL sync: URL updates with ?tab=instances or ?tab=templates
- [ ] Deep linking: Navigate to /sequences?tab=templates works
- [ ] Browser back: Back button navigates tab history
- [ ] Browser forward: Forward button navigates tab history
- [ ] Scroll position: Maintains scroll when switching tabs (or resets)

#### Create Sequence Flow
- [ ] "New Sequence" button: Opens SelectRestaurantForSequenceModal
- [ ] Restaurant search: Filters restaurants by name
- [ ] Restaurant selection: Shows only active restaurants
- [ ] Select restaurant: Opens StartSequenceModal with restaurant
- [ ] Template selection: Shows available templates
- [ ] Preview timeline: Shows all steps with delays
- [ ] Create sequence: Creates sequence and tasks successfully
- [ ] Close modals: Canceling resets modal state

#### Finish Sequence Flow (Phase 2.3 Integration)
- [ ] Finish button: Available on sequence cards
- [ ] Finish confirmation: Shows confirmation dialog with three options
- [ ] Finish Only: Marks active tasks complete, pending tasks cancelled, sequence completed
- [ ] Finish & Set Follow-up: Opens CreateTaskModal after finishing sequence
- [ ] Follow-up task: Pre-fills with restaurant context and followUpFromTaskId
- [ ] Follow-up task: Creates task successfully and closes modal
- [ ] Finish & Start New Sequence: Opens StartSequenceModal after finishing
- [ ] Start new sequence: Pre-fills with same restaurant
- [ ] Start new sequence: Creates new sequence successfully
- [ ] Modal state: Properly resets after finishing with any option
- [ ] Error handling: Handles failures gracefully

#### Navigation Updates
- [ ] Sidebar: "Sequence Templates" link removed
- [ ] Sidebar: "Sequences" link still works
- [ ] Old route redirect: /sequence-templates redirects to /sequences?tab=templates
- [ ] Bookmark redirect: Old bookmarks work with redirect

### Responsive Testing
- [ ] Mobile (< 640px): Filters stack in single column
- [ ] Tablet (640px - 1024px): Filters in 2 columns
- [ ] Desktop (> 1024px): Filters in 4 columns
- [ ] Tab triggers: Responsive on mobile
- [ ] Search input: Appropriate width on all screens

### Performance Testing
- [ ] Filter changes: No server calls, client-side only
- [ ] Large datasets: Filters perform well with 100+ sequences
- [ ] React Query cache: Maintains cache when switching tabs
- [ ] Auto-refresh: Instances still refresh every 30 seconds

### Accessibility Testing
- [ ] Keyboard navigation: Tab through filters
- [ ] Keyboard navigation: Tab through tab triggers
- [ ] Screen reader: Filter labels announced correctly
- [ ] Screen reader: Tab triggers announced correctly
- [ ] Focus management: Focus moves to modal when opened
- [ ] Focus management: Focus returns when modal closes

---

## Implementation Notes

### Default Filter Values

Following Tasks page pattern, set sensible defaults to show most relevant items:

**Instances Tab Defaults:**
- `search`: '' (empty)
- `status`: ['active'] (show active sequences only)
- `restaurant_id`: [] (show all restaurants)

**Rationale:**
- Most users care about active sequences in progress
- Reduces visual clutter on initial load
- Easy to clear/reset to see all sequences

### Filter Logic

**AND logic between filter types:**
- Must match ALL filter criteria

**OR logic within filter type:**
- Must match ANY selected value in MultiSelect

**Example:**
```
status=['active', 'paused'] AND restaurant_id=['123', '456']
Shows sequences that are:
  (active OR paused) AND (restaurant 123 OR restaurant 456)
```

### URL Parameter Strategy

Use `useSearchParams` for tab persistence:
- `/sequences` → defaults to instances tab
- `/sequences?tab=instances` → instances tab
- `/sequences?tab=templates` → templates tab

**Benefits:**
- Deep linking support
- Browser back/forward navigation
- Shareable URLs

**Limitation:**
- Filter state NOT persisted in URL (too complex)
- Filters reset when navigating away and back
- This matches Tasks page behavior

### Modal Flow Explanation

**Two-Step Modal Process:**

1. **SelectRestaurantForSequenceModal**
   - Purpose: Select which restaurant to start sequence for
   - Needed because: Main page has no restaurant context
   - Output: Selected restaurant object

2. **StartSequenceModal**
   - Purpose: Select sequence template and start sequence
   - Input: Restaurant object from step 1
   - Output: Created sequence instance

**Alternative Considered:** Single modal with restaurant + template selection
**Rejected because:** Existing StartSequenceModal is well-tested and works perfectly

### Component Reuse Strategy

**Maximum Reuse:**
- Use existing `SequenceProgressCard` for instance display
- Use existing `StartSequenceModal` for sequence creation
- Use existing `SequenceTemplateCard` for template display
- Use existing filter components from Tasks page pattern

**New Components:**
- Only `SelectRestaurantForSequenceModal` needed

**Copied Code:**
- Templates tab content copied from SequenceTemplates.tsx
- Maintain existing functionality and styling

---

## Risk Assessment

### Low Risk
- Tab implementation: Well-established pattern in codebase
- Filter logic: Mirrors Tasks page proven approach
- Component reuse: Existing components well-tested

### Medium Risk
- Modal flow: Two-step process could confuse users
  - **Mitigation:** Clear modal titles and descriptions
  - **Mitigation:** Smooth transition between modals

- Navigation redirect: Old links could break
  - **Mitigation:** Use React Router Navigate for redirect
  - **Mitigation:** Test all entry points

### Considerations
- Filter state: Not persisted in URL
  - **Impact:** Users must re-apply filters after navigation
  - **Acceptable:** Matches Tasks page behavior

- Templates tab: Duplicates SequenceTemplates.tsx code
  - **Impact:** Changes must be made in two places temporarily
  - **Resolution:** Can delete SequenceTemplates.tsx after confirming redirect works

---

## Future Enhancements (Out of Scope)

### Filter Persistence
- Save filter preferences to localStorage
- Restore filters on page load
- User-specific default filters

### Advanced Filtering
- Date range filter (started, completed)
- Duration filter (expected duration)
- Progress filter (% complete)

### Bulk Actions
- Select multiple sequences
- Bulk pause/resume/cancel
- Bulk status update

### Export
- Export filtered sequences to CSV
- Export sequence timeline
- Export task list

---

## Success Criteria

### Must Have
- ✅ Tab-based layout with Instances and Templates tabs
- ✅ Restaurant filter (MultiSelect)
- ✅ Status filter (MultiSelect)
- ✅ Search box (restaurant name, template name)
- ✅ "New Sequence" button with two-step modal flow
- ✅ Navigation updated (removed sequence-templates link)
- ✅ Route redirect from /sequence-templates to /sequences?tab=templates
- ✅ All existing functionality preserved

### Should Have
- Clear All and Reset to Default buttons
- URL sync for tab state
- Loading and empty states
- Responsive layout

### Nice to Have
- Smooth animations
- Keyboard shortcuts
- Filter tooltips

---

## Estimated Time Breakdown

| Phase | Task | Time |
|-------|------|------|
| 1 | Create SelectRestaurantForSequenceModal | 1 hour |
| 2.1 | Add tab structure to Sequences.tsx | 30 min |
| 2.2 | Implement Instances tab filters | 1 hour |
| 2.3 | Integrate Templates tab content | 30 min |
| 2.4 | Add Create New Sequence button + modal flow | 30 min |
| 2.5 | Integrate Phase 2.3 Finish Sequence functionality | 30 min |
| 3 | Update navigation and routes | 30 min |
| 4 | Testing and polish | 1 hour |
| **Total** | | **5.5 hours** |

---

## Approval Checklist

Before implementation, confirm:
- [ ] Design approved: Tab-based layout with Instances + Templates
- [ ] Filters approved: Restaurant, Status, Search (no Assigned To, no Template filter)
- [ ] Create flow approved: Two-step modal (select restaurant → select template)
- [ ] Finish sequence integration approved: Support all three finish options (finish-only, finish-followup, finish-start-new)
- [ ] Navigation approved: Remove sequence-templates from sidebar
- [ ] Redirect approved: Old route redirects to new tab
- [ ] Timeline approved: 5.5 hours estimated

---

## Post-Implementation Tasks

After implementation complete:
- [ ] Update any documentation mentioning /sequence-templates page
- [ ] Notify users of UI change (if applicable)
- [ ] Monitor for any broken links or bookmarks
- [ ] Consider deleting SequenceTemplates.tsx after redirect confirmed working
- [ ] Add analytics tracking for tab usage (if applicable)

---

**End of Implementation Plan**
