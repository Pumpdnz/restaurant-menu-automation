# Investigation: UI Patterns

## Overview
Documentation of UI patterns, component library, and styling approaches for consistent Dashboard implementation.

## UI Library Stack

| Library | Version | Purpose |
|---------|---------|---------|
| shadcn/ui | - | Primary component library (Radix UI-based) |
| Tailwind CSS | 3.4.17 | Styling |
| tailwindcss-animate | 1.0.7 | Animations |
| lucide-react | 0.540.0 | Icons |
| react-hook-form | 7.62.0 | Form management |
| clsx + tailwind-merge | - | Class merging (via `cn()`) |

## Core UI Components

### Card System
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Button Variants
- `default` - Primary blue background
- `destructive` - Red background
- `outline` - Border only
- `secondary` - Gray background
- `ghost` - Transparent
- `link` - Text link style
- `tertiary` - Yellow background
- `liquidglassexperimental` - Gradient + blur

### Badge Variants
- `default` - Primary color
- `secondary` - Gray
- `destructive` - Red
- `success` - Green
- `outline` - Border only

### Tabs Component
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

Tab variants: `default`, `blue`
Tab sizes: `default`, `full`

### Table Component
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Filter/Combobox Pattern

From `CitySearchCombobox.tsx`:
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Select City</Button>
  </PopoverTrigger>
  <PopoverContent>
    <Command shouldFilter={false}>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandGroup heading="Region">
          <CommandItem>
            <Check className={cn("mr-2", selected && "opacity-100")} />
            City Name
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

## List/Preview Pattern

From `LeadPreview.tsx`:
```tsx
<Popover>
  <PopoverTrigger>
    <Badge>Count</Badge>
  </PopoverTrigger>
  <PopoverContent className="w-96">
    <div className="flex justify-between items-center">
      <h4>Title</h4>
      <Badge>{total}</Badge>
    </div>
    <ScrollArea className="h-64">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 p-2">
          <Checkbox />
          <span>{item.name}</span>
          <Badge variant={statusVariant}>{item.status}</Badge>
        </div>
      ))}
    </ScrollArea>
    <div className="flex justify-end gap-2 mt-2">
      <Button variant="outline" size="sm">Refresh</Button>
      <Button size="sm">View All</Button>
    </div>
  </PopoverContent>
</Popover>
```

## Table with Filtering Pattern

```tsx
<div className="flex gap-2 mb-4">
  <MultiSelect options={typeOptions} value={types} onChange={setTypes} />
  <MultiSelect options={statusOptions} value={statuses} onChange={setStatuses} />
</div>

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {filteredItems.map(item => (
      <Collapsible key={item.id} asChild>
        <TableRow>
          <TableCell>{item.name}</TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
          </TableCell>
          <TableCell>
            <DropdownMenu>...</DropdownMenu>
          </TableCell>
        </TableRow>
      </Collapsible>
    ))}
  </TableBody>
</Table>
```

## Theme/Color System

### Brand Colors
- `brand-blue` - Primary blue
- `brand-green` - Success/positive
- `brand-purple` - Info/analytics
- `brand-orange` - Warning/attention

### Status Color Mapping
```typescript
const statusColors = {
  available: 'gray',
  processing: 'blue',
  processed: 'yellow',
  passed: 'green',
  failed: 'red'
};
```

## Standard Import Pattern

```tsx
// UI Components
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '../ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from '../ui/command';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { MultiSelect } from '../ui/multi-select';
import { Skeleton } from '../ui/skeleton';

// Utilities
import { cn } from '../../lib/utils';

// Icons
import { Plus, Check, X, ArrowRight, RefreshCw } from 'lucide-react';
```

## Utility Functions

From `/lib/utils.ts`:
- `cn()` - Merge Tailwind classes
- `formatDate()` - Date formatting with time
- `formatPrice()` - Currency formatting (NZD)
- `getRelativeTime()` - "X minutes ago" format
- `truncate()` - Text truncation with ellipsis

## Responsive Design

```tsx
// Mobile-first responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"

// Full width on mobile
className="w-full md:w-auto"

// Scrollable content
<ScrollArea className="h-64 md:h-96" />
```

## Form Pattern

```tsx
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';

const form = useForm<FormData>();

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```
