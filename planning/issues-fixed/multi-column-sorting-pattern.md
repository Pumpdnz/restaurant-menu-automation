# Multi-Column Sorting Pattern

## Overview
Client-side multi-column sorting implementation for data tables. This pattern allows users to sort by multiple columns simultaneously with clear visual indicators.

## Files Involved

### Core Sort Logic (Reusable)
**File:** `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

```typescript
// Types
export type SortableColumn = 'restaurant_name' | 'city' | 'ubereats_number_of_reviews' | 'created_at';
export type SortDirection = 'disabled' | 'desc' | 'asc';

export interface ColumnSort {
  column: SortableColumn;
  direction: 'desc' | 'asc';
}

export type SortState = ColumnSort[];

// Default sort configuration
export const DEFAULT_PENDING_LEADS_SORT: SortState = [
  { column: 'created_at', direction: 'desc' },
  { column: 'ubereats_number_of_reviews', direction: 'desc' }
];

// Utility functions
export function getColumnDirection(sortState: SortState, column: SortableColumn): SortDirection;
export function getColumnPriority(sortState: SortState, column: SortableColumn): number | null;
export function cycleSortColumn(sortState: SortState, column: SortableColumn): SortState;
```

### Implementation Example
**File:** `UberEats-Image-Extractor/src/components/leads/PendingLeadsTable.tsx`

## Behavior

### Click Cycle
1. **Disabled** → Click → **Descending**
2. **Descending** → Click → **Ascending**
3. **Ascending** → Click → **Disabled**

### Sort Priority
- First column clicked = Primary sort (priority 1)
- Second column clicked = Secondary sort (priority 2)
- New columns are **appended** to sort order (not prepended)
- Existing columns maintain their priority when toggling direction

## SortableHeader Component

```tsx
interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  sortState: SortState;
  onSort: (column: SortableColumn) => void;
  className?: string;
}

function SortableHeader({ column, label, sortState, onSort, className }: SortableHeaderProps) {
  const direction = getColumnDirection(sortState, column);
  const priority = getColumnPriority(sortState, column);
  const isActive = direction !== 'disabled';

  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(column)}
        className={cn(
          "h-8 px-2 -ml-2 font-medium",
          isActive && "bg-muted/30"
        )}
      >
        {label}
        <span className="ml-1.5 flex flex-col items-center justify-center h-4 w-4">
          {/* Up chevron - visible when ascending, faint when descending, almost invisible when disabled */}
          <ChevronUp
            className={cn(
              "h-3 w-3 -mb-0.5 transition-all",
              direction === 'asc' && "stroke-brand-red",
              direction === 'desc' && "stroke-muted-foreground/20",
              direction === 'disabled' && "stroke-muted-foreground/40"
            )}
          />
          {/* Down chevron - visible when descending, faint when ascending, almost invisible when disabled */}
          <ChevronDown
            className={cn(
              "h-3 w-3 -mt-0.5 transition-all",
              direction === 'desc' && "stroke-brand-blue",
              direction === 'asc' && "stroke-muted-foreground/20",
              direction === 'disabled' && "stroke-muted-foreground/40"
            )}
          />
        </span>
        {/* Priority badge - always show even when a single column is sorted */}
        {priority !== null && (
          <span className="ml-1 text-[10px] font-medium stroke-blue-600 text-blue-600 bg-blue-100 rounded-full w-4 h-4 flex items-center justify-center">
            {priority}
          </span>
        )}
      </Button>
    </TableHead>
  );
}
```

## Visual Design Notes

### Icon Styling
- Use `stroke-*` classes instead of `text-*` for SVG icons (ChevronUp, ChevronDown)
- **No hover effects** on icons (causes flashing)
- Ascending active: `stroke-brand-red`
- Descending active: `stroke-brand-blue`
- Inactive (opposite direction): `stroke-muted-foreground/20`
- Disabled: `stroke-muted-foreground/40`

### Button Styling
- Active sorted columns have subtle background: `bg-muted/30`
- No hover effect changes on icons to prevent flashing

### Priority Badge
- Always visible when column is sorted (not just when multiple columns)
- Blue theme: `text-blue-600 bg-blue-100`
- Circular badge: `rounded-full w-4 h-4`

## Client-Side Sorting Logic

```tsx
const sortedLeads = useMemo(() => {
  if (sortState.length === 0) return filteredLeads;

  return [...filteredLeads].sort((a, b) => {
    for (const { column, direction } of sortState) {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (column) {
        case 'restaurant_name':
          aVal = a.restaurant_name?.toLowerCase() || '';
          bVal = b.restaurant_name?.toLowerCase() || '';
          break;
        case 'city':
          aVal = a.city?.toLowerCase() || '';
          bVal = b.city?.toLowerCase() || '';
          break;
        case 'ubereats_number_of_reviews':
          // Parse review count, stripping "+" and converting to number
          aVal = a.ubereats_number_of_reviews
            ? parseInt(a.ubereats_number_of_reviews.replace(/[^0-9]/g, ''), 10) || 0
            : 0;
          bVal = b.ubereats_number_of_reviews
            ? parseInt(b.ubereats_number_of_reviews.replace(/[^0-9]/g, ''), 10) || 0
            : 0;
          break;
        case 'created_at':
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
      }

      // Compare values
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      // If equal, continue to next sort column
    }
    return 0;
  });
}, [filteredLeads, sortState]);
```

## Integration Steps for New Tables

1. **Define sortable columns type** for the specific table
2. **Create default sort state** with desired initial sorting
3. **Add sort state to parent component** with `useState`
4. **Pass sortState and onSortChange** to table component
5. **Add SortableHeader component** (or reuse if extracted to shared components)
6. **Add sortedData useMemo** with column-specific comparison logic
7. **Replace static TableHead** with SortableHeader for sortable columns
8. **Use sortedData** in table body mapping

## Required Imports

```tsx
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
```

---

## Restaurants Page Analysis

**File:** `UberEats-Image-Extractor/src/pages/Restaurants.jsx`

### Current State
The restaurants page has **single-column sorting** (not multi-column):

```javascript
// Current state variables
const [sortField, setSortField] = useState('created_at');
const [sortDirection, setSortDirection] = useState('desc');

// Current toggle behavior - clicking same column toggles direction
const handleSort = (field) => {
  if (sortField === field) {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortDirection('asc');
  }
};
```

### Currently Sortable Columns
- `name` - Restaurant name (string, case-insensitive)
- `icp_rating` - ICP Rating (numeric 0-10)
- `last_contacted` - Last Contact date
- `created_at` - Created date
- `last_scraped` - Last Scraped date (from `restaurant_platforms[0].last_scraped_at`)

### Current Sort Icons
Uses `ArrowUpDown`, `ArrowUp`, `ArrowDown` from lucide-react

### Changes Required for Multi-Column Sorting

1. **Convert to TypeScript** (optional but recommended) or add JSDoc types

2. **Replace single-column state with multi-column state:**
   ```javascript
   // FROM:
   const [sortField, setSortField] = useState('created_at');
   const [sortDirection, setSortDirection] = useState('desc');

   // TO:
   const [sortState, setSortState] = useState([
     { column: 'created_at', direction: 'desc' }
   ]);
   ```

3. **Add sort utility functions** (copy from useLeadScrape.ts or create shared module)

4. **Replace sort header rendering** with SortableHeader pattern

5. **Update sorting logic** to iterate through sortState array

### Recommended Sortable Columns for Restaurants
- `name` - Restaurant name
- `icp_rating` - ICP Rating
- `last_contacted` - Last Contact
- `created_at` - Created date
- `lead_warmth` - Lead Warmth (alphabetical)
- `lead_stage` - Lead Stage (alphabetical)
