# Sticky Header Pattern

This document describes how to implement sticky headers that stay fixed at the top of the page when scrolling.

## Layout Context

The app uses a sidebar layout where page content is rendered inside a scroll container:

```
NavigationWrapper
└── SidebarInset
    └── <div className="h-full max-h-screen overflow-y-auto overflow-x-hidden px-6 pt-6 pb-6 scrollbar-hide">
        └── {children}  <!-- Page content renders here -->
```

**Key properties of the scroll container:**
- `h-full max-h-screen` - Full height, max viewport height
- `overflow-y-auto` - This is the scroll container (sticky works relative to this)
- `px-6` - 24px horizontal padding
- `pt-6 pb-6` - 24px vertical padding

## Implementation Pattern

### Step 1: Wrap page content appropriately

If using Radix Tabs, the `<Tabs>` component must wrap both `<TabsList>` and `<TabsContent>`. Structure your page like this:

```jsx
return (
  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col -mt-6 -mb-6">
    {/* Sticky Header */}
    <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border-b space-y-4">
      {/* Header content */}
      {/* TabsList if using tabs */}
    </div>

    {/* Scrollable Content */}
    <div className="pt-6 space-y-6">
      {/* TabsContent components or regular content */}
    </div>
  </Tabs>
);
```

For pages without tabs:

```jsx
return (
  <div className="flex flex-col -mt-6 -mb-6">
    {/* Sticky Header */}
    <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border-b space-y-4">
      {/* Header content */}
    </div>

    {/* Scrollable Content */}
    <div className="pt-6 space-y-6">
      {/* Page content */}
    </div>
  </div>
);
```

### Step 2: Required CSS Classes Explained

#### On the outer wrapper:
```
-mt-6 -mb-6
```
- `-mt-6` - Pulls content up to compensate for scroll container's `pt-6`
- `-mb-6` - Pulls content down to compensate for scroll container's `pb-6`

#### On the sticky header:
```
sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border-b space-y-4
```

| Class | Purpose |
|-------|---------|
| `sticky` | Enables sticky positioning |
| `-top-6` | Sticks when 24px from scroll container top (compensates for `pt-6` padding) |
| `z-40` | High z-index to stay above content (mobile nav trigger uses z-50) |
| `bg-white/80` | Semi-transparent white background |
| `backdrop-blur-sm` | Blur effect for content scrolling behind |
| `-mx-6` | Extends to full width (negates parent's `px-6`) |
| `px-6` | Restores horizontal padding inside sticky header |
| `pt-6` | Top padding inside sticky header |
| `pb-4` | Bottom padding inside sticky header |
| `border-b` | Visual separator line at bottom |
| `space-y-4` | Vertical spacing between header elements |

#### On the scrollable content:
```
pt-6 space-y-6
```
- `pt-6` - Top padding to create space below sticky header
- `space-y-6` - Vertical spacing between content sections

## Visual Styling Options

### Glassmorphism (recommended):
```jsx
className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]"
```

### Solid background:
```jsx
className="sticky -top-6 z-40 bg-background -mx-6 px-6 pt-6 pb-4 border-b space-y-4"
```

### With subtle shadow:
```jsx
className="sticky -top-6 z-40 bg-muted/50 -mx-6 px-6 pt-6 pb-4 border-b shadow-sm space-y-4"
```

## Including Collapsible Filters in Sticky Header

For pages with filter sections, you can include them in the sticky header using the Collapsible component for smooth animations.

### Required Imports
```jsx
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '../components/ui/collapsible';
```

### Filter Toggle Button
Add a chevron icon that rotates when filters are expanded:
```jsx
<Button
  variant="outline"
  onClick={() => setShowFilters(!showFilters)}
  className={cn(
    "relative",
    hasActiveFilters && "border-brand-blue text-brand-blue"
  )}
>
  <Filter className="h-4 w-4 mr-2" />
  Filters
  {activeFiltersCount > 0 && (
    <Badge variant="secondary" className="ml-2 bg-brand-blue text-white">
      {activeFiltersCount}
    </Badge>
  )}
  <ChevronDown className={cn(
    "h-4 w-4 ml-2 transition-transform duration-200",
    showFilters && "rotate-180"
  )} />
</Button>
```

### Collapsible Filter Section
Wrap filters in Collapsible for smooth animation:
```jsx
<Collapsible open={showFilters} onOpenChange={setShowFilters}>
  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
    <div className="bg-card/50 border rounded-lg p-4">
      {/* Filter controls */}
    </div>
  </CollapsibleContent>
</Collapsible>
```

### Complete Example: Restaurants.jsx
```jsx
return (
  <div className="flex flex-col -mt-6 -mb-6">
    {/* Sticky Header + Filters */}
    <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
      {/* Header Row */}
      <div className="sm:flex sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Restaurants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredCount} restaurants
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
            <ChevronDown className={cn(
              "h-4 w-4 ml-2 transition-transform duration-200",
              showFilters && "rotate-180"
            )} />
          </Button>
          <Button>Add Restaurant</Button>
        </div>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="bg-card/50 border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filter inputs */}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>

    {/* Scrollable Content */}
    <div className="pt-6">
      {/* Table or other content */}
    </div>

    {/* Dialogs */}
  </div>
);
```

---

## Example: RestaurantDetail.jsx (with Tabs)

```jsx
return (
  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col -mt-6 -mb-6">
    {/* Sticky Header + Tabs */}
    <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
      {/* Header row with back button, title, status, actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/restaurants')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <RestaurantSwitcher ... />
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 lg:gap-4">
          {/* Status selector, Notes button, Google Search, Edit Details */}
        </div>
      </div>

      {/* TabsList */}
      <TabsList size="full">
        <TabsTrigger value="overview" size="full">Overview</TabsTrigger>
        <TabsTrigger value="tasks-sequences" size="full">Tasks and Sequences</TabsTrigger>
        <TabsTrigger value="platforms" size="full">Gathering Info</TabsTrigger>
        <TabsTrigger value="registration" size="full">Registration</TabsTrigger>
      </TabsList>
    </div>

    {/* Scrollable Content */}
    <div className="pt-6 space-y-6">
      {/* Success/Error alerts */}

      {/* Tab content */}
      <TabsContent value="overview" className="space-y-4">
        ...
      </TabsContent>

      <TabsContent value="tasks-sequences" className="space-y-4">
        ...
      </TabsContent>

      {/* etc. */}
    </div>

    {/* Dialogs can be placed here, outside the scrollable content */}
  </Tabs>
);
```

## Troubleshooting

### Header has a gap at the top
- Ensure `-top-6` is used (not `top-0`)
- Ensure outer wrapper has `-mt-6`

### Header scrolls up slightly before sticking
- You're probably using `top-0` instead of `-top-6`

### Content shows through header
- Add a solid or semi-transparent background (`bg-background` or `bg-white/80`)
- Add `backdrop-blur-sm` for glassmorphism effect

### Header doesn't extend full width
- Add `-mx-6 px-6` to negate parent padding and restore inner padding

### Other pages have no top spacing
- Don't remove `pt-6` from Navigation.jsx scroll container
- Only the page with sticky header should use `-mt-6 -mb-6` on its wrapper

### Z-index issues
- Use `z-40` for sticky headers
- Mobile nav trigger uses `z-50`
- Dialogs/modals typically use `z-50` or higher
