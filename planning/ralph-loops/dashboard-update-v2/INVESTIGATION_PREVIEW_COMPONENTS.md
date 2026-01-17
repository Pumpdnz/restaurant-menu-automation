# Investigation: Preview Table Components for Dashboard

## Summary

This document captures the investigation findings for implementing preview/recent list components for the Dashboard. The codebase has established patterns for tables, pagination, filtering, and preview lists that should be followed for consistency.

---

## 1. Existing Preview List Patterns

### LeadPreview Component
**Location:** `/UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx`

The `LeadPreview` component is a Popover-based preview that shows a list of items when triggered:

**Key Features:**
- Uses `Popover` + `PopoverTrigger` + `PopoverContent` pattern
- Fixed width container (`w-[500px]`)
- Header with title, item count, and status badges
- ScrollArea with fixed height (`h-[300px]`) for item list
- Selection toolbar that appears when items are selected
- Footer with Refresh and View All buttons

**Structure:**
```tsx
<Popover>
  <PopoverTrigger>{children}</PopoverTrigger>
  <PopoverContent className="w-[500px] p-0">
    {/* Header with title + stats */}
    <div className="flex items-center justify-between p-3 border-b bg-muted/30">
      {/* Title + description */}
      {/* Status badges */}
    </div>

    {/* Selection toolbar (conditional) */}
    {selectedIds.size > 0 && (
      <div className="flex items-center justify-between p-2 border-b bg-blue-50/50">
        {/* Selection count + action buttons */}
      </div>
    )}

    {/* Scrollable list */}
    <ScrollArea className="h-[300px]">
      {/* Loading/Empty/Content states */}
      <div className="divide-y">
        {/* Select all row (sticky) */}
        {/* Item rows */}
      </div>
    </ScrollArea>

    {/* Footer */}
    <div className="flex items-center justify-between p-2 border-t bg-muted/20">
      <Button variant="ghost">Refresh</Button>
      <Button variant="outline">View All</Button>
    </div>
  </PopoverContent>
</Popover>
```

### VideoPreview Component
**Location:** `/UberEats-Image-Extractor/src/components/social-media/VideoPreview.tsx`

This is a Card-based preview for a single item (video) with:
- Card header with title and download button
- Video player or placeholder
- Metadata grid
- Expandable details sections

This pattern is more for individual item detail views, not list previews.

---

## 2. Table Component Usage for Lists

### Standard Table Pattern
**Location:** `/UberEats-Image-Extractor/src/components/ui/table.tsx`

**Components Available:**
- `Table` - wrapper with overflow handling
- `TableHeader` / `TableBody` / `TableFooter`
- `TableRow` - with hover state
- `TableHead` - column headers
- `TableCell` - data cells

**Styling Patterns:**
```tsx
// Standard table structure
<div className="rounded-lg border bg-card overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-10">Checkbox</TableHead>
        <TableHead>Name</TableHead>
        <TableHead className="w-24">Status</TableHead>
        <TableHead className="w-24 text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow
          key={item.id}
          className="cursor-pointer hover:bg-muted/50"
        >
          <TableCell>...</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### ScrapeJobStepList Collapsible Table
**Location:** `/UberEats-Image-Extractor/src/components/leads/ScrapeJobStepList.tsx`

Uses `Collapsible` + `CollapsibleContent` + `CollapsibleTrigger` for expandable table sections:
```tsx
<Collapsible open={isExpanded}>
  <CollapsibleTrigger asChild>
    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
      <ChevronDown className={cn("transition-transform", !isExpanded && "-rotate-90")} />
      <span>Title ({count})</span>
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
    <Table>...</Table>
  </CollapsibleContent>
</Collapsible>
```

---

## 3. Pagination Implementation

### PendingLeadsTable Pagination Pattern
**Location:** `/UberEats-Image-Extractor/src/components/leads/PendingLeadsTable.tsx`

**Pagination Props Interface:**
```tsx
interface PaginationControlsProps {
  pagination: {
    total: number;
    page: number;        // 0-indexed
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
  position: 'top' | 'bottom';
  searchInfo?: {
    searchQuery: string;
    filteredCount: number;
    totalCount: number;
  };
}
```

**PaginationControls Component:**
```tsx
function PaginationControls({ pagination, position, searchInfo }: PaginationControlsProps) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const startItem = pagination.page * pagination.pageSize + 1;
  const endItem = Math.min((pagination.page + 1) * pagination.pageSize, pagination.total);

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-4 py-2",
      position === 'top' ? "border-b bg-muted/30" : "border-t bg-muted/30"
    )}>
      {/* Left side - item count info */}
      <div className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {pagination.total} items
      </div>

      {/* Right side - pagination controls */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {pagination.onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <select value={pagination.pageSize} onChange={...}>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[100px] text-center">
              Page {pagination.page + 1} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Page Size Options:**
```tsx
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500, 1000];
```

**Usage in Parent Component (LeadScrapes.tsx):**
```tsx
// State management
const [pendingPage, setPendingPage] = useState(0);
const [pendingPageSize, setPendingPageSize] = useState(50);

// Pass to table component
<PendingLeadsTable
  pagination={pendingData?.pagination?.total ? {
    total: pendingData.pagination.total,
    page: pendingPage,
    pageSize: pendingPageSize,
    onPageChange: setPendingPage,
    onPageSizeChange: (size) => {
      setPendingPageSize(size);
      setPendingPage(0); // Reset to first page
    },
  } : undefined}
/>
```

---

## 4. Filter Component Patterns

### MultiSelect Component
**Location:** `/UberEats-Image-Extractor/src/components/ui/multi-select.tsx`

**Interface:**
```tsx
interface MultiSelectProps {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}
```

**Usage Example (from LeadScrapes.tsx):**
```tsx
<MultiSelect
  options={cityOptions}
  selected={filters.city ? [filters.city] : []}
  onChange={(selected) => setFilters({ ...filters, city: selected[selected.length - 1] || '' })}
  placeholder="City"
/>
```

### Filter Card Pattern
**Location:** `/UberEats-Image-Extractor/src/pages/LeadScrapes.tsx`

```tsx
<div className="bg-card border rounded-lg p-4">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4" />
      <h3 className="font-medium">Filters</h3>
    </div>
    {hasFilters && (
      <Button variant="ghost" size="sm" onClick={handleResetFilters}>
        Clear All
      </Button>
    )}
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
    {/* Search Input */}
    <div className="relative lg:col-span-2">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Search..." className="pl-10" />
    </div>

    {/* Filter dropdowns */}
    <MultiSelect options={...} />
  </div>
</div>
```

### City Filter with Search (OpportunitiesTab)
**Location:** `/UberEats-Image-Extractor/src/components/reports/OpportunitiesTab.tsx`

Uses Popover with search input and grouped checkboxes:
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" className="gap-1">
      <MapPin className="h-4 w-4" />
      Cities ({selectedCities.size}/{allCities.length})
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80 p-0">
    {/* Search header */}
    <div className="p-3 border-b">
      <Input placeholder="Search cities..." />
      <div className="flex gap-1">
        <Button size="sm" onClick={selectAll}>All</Button>
        <Button size="sm" onClick={selectDefaults}>Defaults</Button>
        <Button size="sm" onClick={clearAll}>None</Button>
      </div>
    </div>

    {/* Scrollable checkbox list */}
    <div className="max-h-72 overflow-y-auto">
      {groupedCities.map(...)}
    </div>
  </PopoverContent>
</Popover>
```

---

## 5. View All Navigation Patterns

### Button-based Navigation
```tsx
// From LeadPreview.tsx
<Button
  variant="outline"
  size="sm"
  className="h-7 text-xs"
  onClick={() => {
    setIsOpen(false);
    onViewAllClick?.();  // Callback to parent
  }}
>
  <Eye className="h-3 w-3 mr-1" />
  View All Details
</Button>
```

### Navigate with Query Params
```tsx
// From LeadScrapes.tsx
<Button onClick={() => navigate('/leads?tab=pending')}>
  Go to Pending Leads
</Button>

// From CityBreakdownTab.tsx - open in new tab
window.open(`/leads?tab=pending&city=${encodeURIComponent(city)}`, '_blank');
```

### Link Component
```tsx
import { Link } from 'react-router-dom';

<Link
  to={`/restaurants/${restaurantId}`}
  className="text-sm font-medium text-primary hover:underline"
>
  {restaurantName}
</Link>
```

---

## 6. Card Layout Patterns

### Standard Card with Header
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between py-3">
    <CardTitle className="text-base">Title</CardTitle>
    <Button variant="outline" size="sm">Action</Button>
  </CardHeader>
  <CardContent className="p-0">
    {/* Table or content */}
  </CardContent>
</Card>
```

### Card with Table Inside
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">City Breakdown</CardTitle>
  </CardHeader>
  <CardContent className="p-0">
    <Table>...</Table>
  </CardContent>
</Card>
```

---

## 7. Templates for New Preview Components

### Template A: Simple Preview Table Card

For showing a limited list (e.g., 5-10 items) with a "View All" link:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PreviewItem {
  id: string;
  name: string;
  status: string;
  // ... other fields
}

interface PreviewTableCardProps {
  title: string;
  items: PreviewItem[];
  isLoading: boolean;
  viewAllLink: string;
  limit?: number;
}

export function PreviewTableCard({
  title,
  items,
  isLoading,
  viewAllLink,
  limit = 5
}: PreviewTableCardProps) {
  const displayItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-20" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base flex items-center gap-2">
          {title}
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </CardTitle>
        <Link to={viewAllLink}>
          <Button variant="ghost" size="sm" className="text-xs">
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {displayItems.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No items to display
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {hasMore && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-2">
                    <Link to={viewAllLink} className="text-sm text-muted-foreground hover:text-foreground">
                      +{items.length - limit} more
                    </Link>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

### Template B: Preview Table with Filter

For tables that need city/status filtering in a compact form:

```tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PreviewItem {
  id: string;
  name: string;
  city: string;
  status: string;
}

interface FilteredPreviewTableProps {
  title: string;
  items: PreviewItem[];
  isLoading: boolean;
  viewAllLink: string;
  limit?: number;
}

export function FilteredPreviewTable({
  title,
  items,
  isLoading,
  viewAllLink,
  limit = 10
}: FilteredPreviewTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Get unique cities
  const cities = useMemo(() => {
    const citySet = new Set(items.map(item => item.city));
    return Array.from(citySet).sort();
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }

    if (selectedCity) {
      result = result.filter(item => item.city === selectedCity);
    }

    return result.slice(0, limit);
  }, [items, searchQuery, selectedCity, limit]);

  const hasActiveFilters = searchQuery || selectedCity;

  return (
    <Card>
      <CardHeader className="py-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            <Badge variant="secondary" className="text-xs">
              {items.length}
            </Badge>
          </CardTitle>
          <Link to={viewAllLink}>
            <Button variant="ghost" size="sm" className="text-xs">
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>

        {/* Compact filter row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>

          {/* City pills */}
          <div className="flex gap-1 flex-wrap">
            {cities.slice(0, 5).map((city) => (
              <Badge
                key={city}
                variant={selectedCity === city ? "default" : "outline"}
                className={cn(
                  "text-xs cursor-pointer hover:bg-muted",
                  selectedCity === city && "cursor-pointer"
                )}
                onClick={() => setSelectedCity(selectedCity === city ? null : city)}
              >
                {city}
              </Badge>
            ))}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => {
                setSearchQuery('');
                setSelectedCity(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-24">City</TableHead>
              <TableHead className="w-24">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                  {hasActiveFilters ? 'No matches found' : 'No items'}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.city}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### Template C: Stats Card with Preview Link

For dashboard overview cards that link to full lists:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatsPreviewCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  viewAllLink: string;
  viewAllLabel?: string;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
};

export function StatsPreviewCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  viewAllLink,
  viewAllLabel = 'View All'
}: StatsPreviewCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        <Link to={viewAllLink} className="mt-3 block">
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
            {viewAllLabel}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

---

## 8. Key Patterns to Follow

1. **Consistent Card Styling:**
   - Use `rounded-lg border bg-card` for containers
   - Use `bg-muted/30` for header/footer backgrounds
   - Use `p-3` or `py-3` for compact headers, `p-6` for standard

2. **Table in Cards:**
   - Set `CardContent className="p-0"` when table fills the card
   - Table inherits border-radius from card

3. **Badge Usage:**
   - `variant="secondary"` for counts
   - `variant="outline"` for status/categories
   - Custom colors via className for status (green/yellow/red)

4. **View All Pattern:**
   - Use `<Link to={...}>` wrapped `<Button variant="ghost" size="sm">`
   - Include `ArrowRight` icon
   - Position in CardHeader right side

5. **Filter Pattern:**
   - Search input with Search icon (left-aligned, `pl-9` or `pl-10`)
   - Filter badges/pills for quick category filtering
   - Clear All button when filters active

6. **Loading States:**
   - Use Skeleton components matching the layout
   - Match widths to expected content

7. **Empty States:**
   - Center-aligned text in muted-foreground
   - Provide action button when appropriate

---

## 9. File Locations Reference

| Component | Path |
|-----------|------|
| Table | `/UberEats-Image-Extractor/src/components/ui/table.tsx` |
| Card | `/UberEats-Image-Extractor/src/components/ui/card.tsx` |
| Pagination | `/UberEats-Image-Extractor/src/components/ui/pagination.tsx` |
| MultiSelect | `/UberEats-Image-Extractor/src/components/ui/multi-select.tsx` |
| LeadPreview | `/UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx` |
| PendingLeadsTable | `/UberEats-Image-Extractor/src/components/leads/PendingLeadsTable.tsx` |
| CityBreakdownTab | `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` |
