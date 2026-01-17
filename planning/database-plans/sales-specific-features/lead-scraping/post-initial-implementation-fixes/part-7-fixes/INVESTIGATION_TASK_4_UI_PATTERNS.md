# Investigation Task 4: UI Patterns and User Feedback Mechanisms

**Date**: 2025-12-20
**Status**: COMPLETED

---

## Current Conversion Dialog Structure

**File:** `src/components/leads/PendingLeadsTable.tsx` (lines 800-885)

### State Machine
- **`isConverting` = true**: Shows loading state with spinner and progress bar
- **`isConverting` = false**: Shows results with ScrollArea for success/failure list

### Components Used
- `Dialog` + `DialogContent` from shadcn/ui
- `Progress value={undefined}` for indeterminate progress bar
- `ScrollArea` for results list
- `CheckCircle2` (success icon) and `AlertCircle` (failure icon)
- Colored backgrounds: `green-50` for success, `red-50` for failure

### Structure
```
DialogContent
├── DialogHeader
│   └── DialogTitle: "Converting Leads" / "Conversion Results"
├── DialogDescription (during conversion)
│   ├── Loader2 (spinning)
│   ├── Progress bar
│   └── "Converting X leads..."
├── ScrollArea (after conversion)
│   └── Results list with success/failure indicators
└── DialogFooter
    ├── Button: "Start Sequence" (if successes)
    └── Button: "Close"
```

---

## Checkbox/Selection Component Patterns

### Checkbox Component
**File:** `src/components/ui/checkbox.tsx`

- Uses **Radix UI CheckboxPrimitive** for accessible checkboxes
- Custom styled with Tailwind: hover states, disabled states, focus rings
- Supports `checked` and `onCheckedChange` props

### Usage in Tables (PendingLeadsTable)
```jsx
// Header checkbox for select-all (line 613-616)
<Checkbox
  checked={selectedLeadIds.size === leads.length && leads.length > 0}
  onCheckedChange={(checked) => {
    if (checked) {
      setSelectedLeadIds(new Set(leads.map(lead => lead.id)));
    } else {
      setSelectedLeadIds(new Set());
    }
  }}
/>

// Row-level checkboxes (line 653-656)
<Checkbox
  checked={selectedLeadIds.has(lead.id)}
  onCheckedChange={(checked) => {
    const newSelected = new Set(selectedLeadIds);
    if (checked) {
      newSelected.add(lead.id);
    } else {
      newSelected.delete(lead.id);
    }
    setSelectedLeadIds(newSelected);
  }}
/>
```

### State Management Pattern
```javascript
const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

const toggleOption = (optionId: string) => {
  setSelectedLeadIds(prev => {
    const next = new Set(prev);
    next.has(optionId) ? next.delete(optionId) : next.add(optionId);
    return next;
  });
};
```

---

## Background Task Notification Patterns

### Toast System Architecture
**Files:**
- `src/hooks/use-toast.ts`
- `src/components/ui/sonner.tsx`

### Configuration
- **Library:** Sonner (lightweight toast alternative)
- **TOAST_LIMIT:** 1 (only one toast visible at a time)
- **Implementation:** Global dispatch-based system with memory state

### Toast Methods
```javascript
toast.success('Message', { description: 'Details' });
toast.error('Message', { description: 'Details' });
toast.warning('Message', { description: 'Details' });
toast.info('Message');
```

### Features
- Dismissible toasts with auto-hide timeout
- Support for title + description format
- Can update existing toasts via `update()` method
- Can programmatically dismiss via `dismiss()` method

### Real Example (BulkStartSequenceModal lines 160-172)
```javascript
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
```

---

## Toast Message Patterns for Async Operations

### useMutation Pattern
```javascript
return useMutation({
  mutationFn: async (leadIds: string[]) => {
    const response = await api.post('/leads/convert', { lead_ids: leadIds });
    return response.data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
    toast.success('Leads converted successfully');
  },
  onError: (error) => {
    toast.error('Failed to convert leads', {
      description: error.response?.data?.error || error.message,
    });
  },
});
```

### Key Patterns
- React Query mutations with `isPending` state for loading feedback
- Automatic cache invalidation on success
- Error handling with descriptive messages
- Toast notifications for all state changes
- Loading spinners (`<Loader2 className="animate-spin" />`) during operations

---

## Background Task Indicator Pattern (ScrapeJobProgressCard)

**File:** `src/components/leads/ScrapeJobProgressCard.tsx`

### Features
- **Status Badge:** Colored badges for job status (draft/pending/in_progress/completed/cancelled/failed)
- **Animated Progress Bar:** Custom gradient bar with shimmer animation (lines 80-91)
- **Step Counter:** "Step X of Y" with visual indicators
- **Statistics Display:** Leads extracted, passed, failed
- **Action Buttons:** Start, Cancel, Delete with loading states
- **Refresh Button:** Manual refresh with loading state

### Progress Bar Animation CSS
```css
.progress-bar {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## Recommended UI Approach for Extraction Options

### Pre-Extraction Checkbox Dialog Structure
```
Dialog Header
├── Title: "Select Extraction Options"
└── Description: "Choose which data to extract for converted restaurants"

Dialog Content
├── ScrollArea
│   ├── Checkbox Group: Menu Extraction
│   │   ├── [x] Extract Menu Items (Premium)
│   │   │   └── Description: "Full menu with prices and descriptions"
│   │   ├── [x] Extract Item Images
│   │   │   └── Description: "Download and validate all menu images"
│   │   └── [x] Extract Option Sets
│   │       └── Description: "Modifiers, add-ons, and customizations"
│   │
│   ├── Checkbox Group: Branding Extraction
│   │   ├── [x] Logo & Colors
│   │   │   └── Description: "Extract logo and brand colors from website"
│   │   ├── [x] Favicon
│   │   │   └── Description: "Extract favicon for thermal printing"
│   │   └── [x] Open Graph Data
│   │       └── Description: "Website title, description, and preview image"
│   │
│   └── Alert (optional)
│       └── "X restaurants have UberEats URLs, Y have website URLs"

Dialog Footer
├── Checkbox: "Select All"
├── Button: Cancel
└── Button: Start Extraction (X options selected)
```

### Implementation
```jsx
<Dialog open={showExtractionOptions} onOpenChange={setShowExtractionOptions}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Select Extraction Options</DialogTitle>
      <DialogDescription>
        Choose which data to extract for {restaurants.length} restaurants
      </DialogDescription>
    </DialogHeader>

    <ScrollArea className="max-h-[400px] pr-4">
      <div className="space-y-6">
        {/* Menu Extraction Group */}
        <div className="space-y-3">
          <h4 className="font-medium">Menu Extraction</h4>
          <div className="space-y-2">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={extractionOptions.has('menu')}
                onCheckedChange={() => toggleOption('menu')}
              />
              <div>
                <span className="font-medium">Extract Menu Items</span>
                <p className="text-sm text-muted-foreground">
                  Full menu with prices and descriptions
                </p>
              </div>
            </label>
            {/* More checkboxes... */}
          </div>
        </div>

        {/* Branding Extraction Group */}
        <div className="space-y-3">
          <h4 className="font-medium">Branding Extraction</h4>
          {/* Similar structure... */}
        </div>
      </div>
    </ScrollArea>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowExtractionOptions(false)}>
        Cancel
      </Button>
      <Button onClick={handleStartExtractions} disabled={extractionOptions.size === 0}>
        Start Extraction ({extractionOptions.size} selected)
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Recommended Feedback Mechanism for Background Extractions

### Hybrid Approach (5 Stages)

#### 1. Initial Feedback (Immediate)
```javascript
toast.success('Starting extractions...', {
  description: `Processing ${restaurants.length} restaurants`,
});
```

#### 2. Modal Progress (During Operation)
- Use conversion dialog pattern with animated progress bar
- Show "Creating extraction jobs..." with indeterminate progress
- Disable user interaction during operation

#### 3. Job Creation Complete
```javascript
toast.success('Extraction jobs created', {
  description: `${jobIds.length} extractions started in background`,
});
```

#### 4. Background Progress (Optional Polling)
- ScrapeJobProgressCard pattern for individual job tracking
- Or simple badge/counter in navbar showing "X extractions in progress"

#### 5. Completion Feedback
- Toast notification when extractions complete (if still on page)
- Or notification badge for later viewing

### Quick Fire-and-Forget Pattern
```javascript
const handleStartExtractions = async () => {
  setIsStartingExtractions(true);

  try {
    // Start menu extractions (async, returns job IDs)
    const menuJobs = await Promise.all(
      restaurantsWithUberEats.map(r =>
        api.post('/api/extract-menu-premium', {
          storeUrl: r.ubereats_url,
          restaurantId: r.id,
          async: true
        })
      )
    );

    // Start branding extractions (fire and forget)
    restaurantsWithWebsite.forEach(r => {
      api.post('/api/website-extraction/branding', {
        restaurantId: r.id,
        sourceUrl: r.website_url,
        previewOnly: false,
        versionsToUpdate: ALL_VERSIONS,
        colorsToUpdate: ALL_COLORS,
        headerFieldsToUpdate: ALL_HEADERS
      }); // No await
    });

    toast.success('Extractions started!', {
      description: `${menuJobs.length} menu + ${restaurantsWithWebsite.length} branding jobs`,
    });

    onClose();
  } catch (error) {
    toast.error('Failed to start extractions', {
      description: error.message,
    });
  } finally {
    setIsStartingExtractions(false);
  }
};
```

---

## Summary of UI Component Patterns

| Pattern | Component | Usage |
|---------|-----------|-------|
| Dialog/Modal | `Dialog`, `DialogContent` | Confirmation, options, results |
| Checkbox | `Checkbox` | Multi-select options |
| Progress | `Progress` | Indeterminate loading |
| Toast | `toast.success/error/warning` | Async feedback |
| Loading | `Loader2` with `animate-spin` | Button/action loading |
| Status Badge | `Badge` with variants | Job status display |
| Scroll Area | `ScrollArea` | Long lists in dialogs |
| Icons | `CheckCircle2`, `AlertCircle` | Success/failure indicators |
