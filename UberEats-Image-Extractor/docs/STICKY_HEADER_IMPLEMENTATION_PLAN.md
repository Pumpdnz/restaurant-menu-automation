# Sticky Header Implementation Plan

## Pages to Update
1. **LeadScrapes.tsx** - Lead Scraping page with tabs and per-tab filters
2. **Restaurants.jsx** - Restaurants list page with collapsible filters

---

## 1. LeadScrapes.tsx

### Current Structure (lines 163-387)
```jsx
<div className="p-6 space-y-6">
  {/* Header - title + "New Lead Scrape" button */}
  <div className="flex justify-between items-center">...</div>

  {/* Tabs */}
  <Tabs value={activeTab} onValueChange={handleTabChange}>
    <TabsList size="full">...</TabsList>

    {/* SCRAPE JOBS TAB */}
    <TabsContent value="jobs" className="space-y-6">
      {/* Filters Card */}
      <div className="bg-card border rounded-lg p-4">...</div>
      {/* Jobs List */}
      ...
    </TabsContent>

    {/* PENDING LEADS TAB */}
    <TabsContent value="pending" className="space-y-6">
      {/* Filters Card */}
      <div className="bg-card border rounded-lg p-4">...</div>
      {/* Pending Leads Table */}
      ...
    </TabsContent>
  </Tabs>

  {/* Create Job Dialog */}
  <CreateLeadScrapeJob ... />
</div>
```

### Target Structure
```jsx
<Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col -mt-6 -mb-6">
  {/* Sticky Header + Tabs */}
  <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold">Lead Scraping</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Extract and enrich restaurant leads from delivery platforms
        </p>
      </div>
      <Button onClick={() => setCreateJobOpen(true)} className="bg-gradient-to-r from-brand-blue to-brand-green">
        <Plus className="h-4 w-4 mr-2" />
        New Lead Scrape
      </Button>
    </div>

    {/* TabsList */}
    <TabsList size="full">
      <TabsTrigger size="full" variant="blue" value="jobs">Scrape Jobs</TabsTrigger>
      <TabsTrigger size="full" variant="blue" value="pending">
        Pending Leads
        {pendingLeads.length > 0 && <Badge variant="secondary" className="ml-2">{pendingLeads.length}</Badge>}
      </TabsTrigger>
    </TabsList>
  </div>

  {/* Scrollable Content */}
  <div className="pt-6 space-y-6">
    {/* SCRAPE JOBS TAB */}
    <TabsContent value="jobs" className="space-y-6 mt-0">
      {/* Filters Card */}
      <div className="bg-card border rounded-lg p-4">...</div>
      {/* Jobs List */}
      ...
    </TabsContent>

    {/* PENDING LEADS TAB */}
    <TabsContent value="pending" className="space-y-6 mt-0">
      {/* Filters Card */}
      <div className="bg-card border rounded-lg p-4">...</div>
      {/* Pending Leads Table */}
      ...
    </TabsContent>
  </div>

  {/* Create Job Dialog - outside scrollable content */}
  <CreateLeadScrapeJob ... />
</Tabs>
```

### Key Changes
1. Remove outer `<div className="p-6 space-y-6">` wrapper
2. Move `<Tabs>` to be the outermost element with `className="flex flex-col -mt-6 -mb-6"`
3. Create sticky header div containing:
   - Header (title + button)
   - TabsList
4. Wrap TabsContent components in `<div className="pt-6 space-y-6">`
5. Add `mt-0` to TabsContent to override default margin
6. Move dialog outside scrollable content div but inside Tabs

---

## 2. Restaurants.jsx

### Current Structure (lines 671-1214)
```jsx
<div>
  {/* Header - title + count + filter toggle + add button */}
  <div className="sm:flex sm:items-center justify-between mb-6">...</div>

  {/* Filters Section (collapsible) */}
  {showFilters && (
    <div className="bg-card border rounded-lg p-4 mb-6">...</div>
  )}

  {/* Table */}
  <div className="rounded-lg border bg-card overflow-hidden">...</div>

  {/* Dialogs */}
  <Dialog>...</Dialog>
  <CreateTaskModal ... />
  <StartSequenceModal ... />
</div>
```

### Target Structure
```jsx
<div className="flex flex-col -mt-6 -mb-6">
  {/* Sticky Header + Filters */}
  <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
    {/* Header Row */}
    <div className="sm:flex sm:items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Restaurants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filteredRestaurants.length} {hasActiveFilters() ? 'filtered ' : ''}
          restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
          {restaurants.length !== filteredRestaurants.length && ` of ${restaurants.length} total`}
        </p>
      </div>
      <div className="mt-4 sm:mt-0 flex items-center gap-2">
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} ...>
          <Filter className="h-4 w-4 mr-2" />
          Filters
          ...
        </Button>
        <Button onClick={() => navigate('/restaurants/new')} ...>
          Add Restaurant
        </Button>
      </div>
    </div>

    {/* Filters Section (collapsible, inside sticky) */}
    {showFilters && (
      <div className="bg-card/50 border rounded-lg p-4">
        {/* Filter content - same as before but without mb-6 */}
        ...
      </div>
    )}
  </div>

  {/* Scrollable Content */}
  <div className="pt-6">
    {/* Table */}
    <div className="rounded-lg border bg-card overflow-hidden">...</div>
  </div>

  {/* Dialogs - outside scrollable content */}
  <Dialog>...</Dialog>
  <CreateTaskModal ... />
  <StartSequenceModal ... />
</div>
```

### Key Changes
1. Change outer `<div>` to have `className="flex flex-col -mt-6 -mb-6"`
2. Create sticky header div containing:
   - Header row (title, count, buttons)
   - Collapsible filters section (moved inside sticky)
3. Remove `mb-6` from header and filters (spacing handled by sticky container)
4. Wrap table in `<div className="pt-6">`
5. Move dialogs outside scrollable content

### Alternative: Filters Outside Sticky
If filters are too tall and cause issues on smaller screens, keep them outside the sticky header:

```jsx
<div className="flex flex-col -mt-6 -mb-6">
  {/* Sticky Header (just title + buttons) */}
  <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg rounded-b-[16px]">
    <div className="sm:flex sm:items-center justify-between">
      {/* Header content */}
    </div>
  </div>

  {/* Scrollable Content */}
  <div className="pt-6 space-y-6">
    {/* Filters Section (scrollable) */}
    {showFilters && (
      <div className="bg-card border rounded-lg p-4">...</div>
    )}

    {/* Table */}
    <div className="rounded-lg border bg-card overflow-hidden">...</div>
  </div>

  {/* Dialogs */}
</div>
```

---

## Implementation Order

### Phase 1: LeadScrapes.tsx
1. Restructure to wrap with `<Tabs>` as outer element
2. Add sticky header with title and TabsList
3. Wrap TabsContent in scrollable div
4. Test both tabs work correctly

### Phase 2: Restaurants.jsx
1. Add outer wrapper with negative margins
2. Create sticky header with title and buttons
3. Move filters inside sticky header (or keep outside based on UX preference)
4. Wrap table in scrollable div
5. Test filter toggle and table scrolling

---

## Testing Checklist
- [ ] Header stays fixed when scrolling
- [ ] No gap at top of page
- [ ] No "wiggle" on pages that don't need scrolling
- [ ] Filters work correctly
- [ ] Tab switching works (LeadScrapes)
- [ ] Filter toggle works (Restaurants)
- [ ] Dialogs/modals appear above sticky header
- [ ] Mobile responsiveness maintained
