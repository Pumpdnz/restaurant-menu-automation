# Popover/Dialog Scroll Fix

## Problem

ScrollArea and CommandList components inside Popovers/Dialogs don't respond to mouse wheel scrolling - only the scrollbar works.

## Root Cause

Radix UI's ScrollArea and cmdk's CommandList capture scroll events, but when nested inside Popovers or Dialogs, the scroll events bubble up to the parent overlay which prevents the inner scroll from working.

## Solution

Use native div with specific scroll handling instead of ScrollArea/CommandList:

```tsx
<div
  className="overflow-y-auto"
  style={{
    height: '300px',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  }}
  onWheel={(e) => {
    e.stopPropagation();
  }}
>
  {/* scrollable content */}
</div>
```

### Key Properties

| Property | Purpose |
|----------|---------|
| `overflow-y-auto` | Enable vertical scrolling |
| `height` (inline) | Fixed height to constrain scroll area |
| `overscrollBehavior: 'contain'` | Prevents scroll chaining to parent |
| `WebkitOverflowScrolling: 'touch'` | Smooth scrolling on iOS |
| `onWheel={(e) => e.stopPropagation()}` | Prevents scroll events from bubbling to dialog overlay |

## Reference Implementation

See `src/components/demo-meeting/TagInput.tsx` lines 172-182 for the working pattern.

## Files Using This Pattern

- `src/components/demo-meeting/TagInput.tsx` - Painpoints, selling points, features, objections popovers
- `src/components/leads/CitySearchCombobox.tsx` - City selection dropdown

## What NOT to Use

- `ScrollArea` component inside Popovers/Dialogs
- `CommandList` with className overflow (doesn't work reliably)
- Any Radix-based scroll component in nested overlay contexts
