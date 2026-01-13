# Collapsible Animation Pattern

This guide explains how to add smooth expand/collapse animations to components in the app.

## Prerequisites

### Tailwind Configuration

The following keyframes and animations must be defined in `tailwind.config.js`:

```js
// In tailwind.config.js → theme.extend
keyframes: {
  'collapsible-down': {
    from: { height: '0', opacity: '0' },
    to: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
  },
  'collapsible-up': {
    from: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
    to: { height: '0', opacity: '0' },
  },
},
animation: {
  'collapsible-down': 'collapsible-down 0.2s ease-out',
  'collapsible-up': 'collapsible-up 0.2s ease-out',
},
```

These animations use CSS variables provided by Radix UI's Collapsible component.

---

## Pattern 1: Using Radix Collapsible Component

This is the recommended approach for most collapsible sections.

### Required Imports

```tsx
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
```

### Basic Implementation

```tsx
const [isExpanded, setIsExpanded] = useState(true);

return (
  <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
    <div className="border rounded-lg">
      {/* Trigger */}
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                !isExpanded && "-rotate-90"
              )}
            />
            <span className="font-medium">Section Title</span>
          </div>
        </div>
      </CollapsibleTrigger>

      {/* Animated Content */}
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="border-t p-4">
          {/* Your content here */}
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
);
```

### Key Classes

| Class | Purpose |
|-------|---------|
| `data-[state=closed]:animate-collapsible-up` | Animates height to 0 when closing |
| `data-[state=open]:animate-collapsible-down` | Animates height from 0 when opening |
| `transition-transform duration-200` | Smooth chevron rotation |
| `-rotate-90` | Rotates chevron when collapsed |

---

## Pattern 2: Animated Chevron Icon

For chevrons that rotate smoothly when toggled:

### Option A: Rotate 90° (Right → Down)

```tsx
<ChevronDown
  className={cn(
    "h-4 w-4 transition-transform duration-200",
    !isExpanded && "-rotate-90"
  )}
/>
```

Or use two icons:

```tsx
{isExpanded ? (
  <ChevronDown className="h-4 w-4" />
) : (
  <ChevronRight className="h-4 w-4" />
)}
```

### Option B: Rotate 180° (Down → Up)

Best for filter toggles:

```tsx
<ChevronDown
  className={cn(
    "h-4 w-4 transition-transform duration-200",
    isExpanded && "rotate-180"
  )}
/>
```

---

## Pattern 3: Upgrading Existing Components

Many components currently use conditional rendering without animations. Here's how to upgrade them:

### Before (No Animation)

```tsx
const [isExpanded, setIsExpanded] = useState(false);

return (
  <div>
    <button onClick={() => setIsExpanded(!isExpanded)}>
      Toggle
    </button>
    {isExpanded && (
      <div>Content</div>
    )}
  </div>
);
```

### After (With Animation)

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const [isExpanded, setIsExpanded] = useState(false);

return (
  <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
    <CollapsibleTrigger asChild>
      <button>Toggle</button>
    </CollapsibleTrigger>
    <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
      <div>Content</div>
    </CollapsibleContent>
  </Collapsible>
);
```

---

## Components Updated

The following components have been updated with smooth collapsible animations:

### 1. ScrapeJobStepList.tsx ✅

**Location:** `src/components/leads/ScrapeJobStepList.tsx`

**Changes:**
- Added animation classes to `CollapsibleContent`: `data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden`
- Updated chevron to use `transition-transform duration-200` with `-rotate-90` for smooth rotation

### 2. ScrapeJobProgressCard.tsx ✅

**Location:** `src/components/leads/ScrapeJobProgressCard.tsx`

**Status:** No changes needed - delegates to `ScrapeJobStepList` which now has animations.

### 3. PendingLeadsTable.tsx ✅

**Location:** `src/components/leads/PendingLeadsTable.tsx`

**Changes:**
- Added `Collapsible` and `CollapsibleContent` imports
- Wrapped expanded row content with `Collapsible open={...} asChild` pattern for valid table structure
- Added animation classes to `CollapsibleContent`

### 4. SequenceTaskList.tsx ✅

**Location:** `src/components/sequences/SequenceTaskList.tsx`

**Changes:**
- Wrapped component with `Collapsible` and `CollapsibleTrigger`
- Added `CollapsibleContent` with animation classes
- Updated chevron to use `transition-transform` rotation pattern

### 5. SequenceProgressCard.tsx ✅

**Location:** `src/components/sequences/SequenceProgressCard.tsx`

**Status:** No changes needed - delegates to `SequenceTaskList` which now has animations.

### 6. ScrapeJobStepDetailModal.tsx ✅

**Location:** `src/components/leads/ScrapeJobStepDetailModal.tsx`

**Changes:**
- Added `Collapsible` and `CollapsibleContent` imports
- Wrapped expanded row content with `Collapsible asChild` pattern
- Added animation classes to `CollapsibleContent`

---

## Complete Example: Animated Step List

Here's a complete example based on ScrapeJobStepList:

```tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Step {
  id: string;
  name: string;
  status: string;
}

interface StepListProps {
  steps: Step[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function StepList({ steps, isExpanded = true, onToggleExpand }: StepListProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="border rounded-lg overflow-hidden">
        {/* Header/Trigger */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !isExpanded && "-rotate-90"
                )}
              />
              <span className="text-sm font-medium">
                Steps ({steps.filter(s => s.status === 'completed').length}/{steps.length})
              </span>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Animated Content */}
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>{step.name}</TableCell>
                    <TableCell>{step.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
```

---

## Complete Example: Filter Section in Sticky Header

See [STICKY_HEADER_PATTERN.md](./STICKY_HEADER_PATTERN.md) for implementing collapsible filters in sticky headers.

---

## Troubleshooting

### Animation not working

1. **Check Tailwind config**: Ensure `collapsible-down` and `collapsible-up` keyframes are defined
2. **Check animation classes**: Must use `data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down`
3. **Rebuild CSS**: Run `npm run build` or restart dev server after config changes

### Content jumps instead of animating

- The animation relies on Radix's `--radix-collapsible-content-height` CSS variable
- Make sure `CollapsibleContent` wraps the content directly
- Don't add `overflow-hidden` on the inner content div

### Chevron doesn't animate

- Add `transition-transform duration-200` to chevron icon
- Use `cn()` utility for conditional classes

### Animation too fast/slow

Adjust the duration in `tailwind.config.js`:

```js
animation: {
  'collapsible-down': 'collapsible-down 0.3s ease-out', // slower
  'collapsible-up': 'collapsible-up 0.15s ease-out',    // faster
},
```
