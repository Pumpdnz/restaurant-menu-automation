# Investigation: UI Patterns & Reports Components

## Overview
This document captures the UI patterns for tabs, cards, heatmaps, and tables used across the codebase, specifically for fixing the Lead Scraping reports section on the Dashboard.

---

## Key Finding: The Problem

### Current Dashboard.jsx Structure (Incorrect)
The Dashboard currently wraps `CityBreakdownTab` inside a Card, which causes **double nesting** because `CityBreakdownTab` already contains its own Cards:

```jsx
{/* Current Dashboard.jsx - Lines 288-298 (PROBLEMATIC) */}
<Card className="backdrop-blur-sm bg-background/95 border-border">
  <CardHeader className="flex flex-row items-center justify-between py-3">
    <CardTitle className="text-brand-purple">City Breakdown</CardTitle>
  </CardHeader>
  <CardContent className="p-0">
    <CityBreakdownTab
      filters={{}}
      onStartScrape={handleStartScrape}
    />
  </CardContent>
</Card>
```

### Why This Is Wrong
`CityBreakdownTab` already renders its own cards internally (see lines 266-299 and 301-439):
- A "Coverage Heatmap" Card
- A "City Breakdown" Card with table
- Stat cards at the bottom

**Result:** Card > Card nesting creates visual inconsistency and wasted space.

---

## Correct Tab Component Usage

### Tab Component API (from `/components/ui/tabs.tsx`)

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Variants available:
// TabsList: size="default" | "full"
// TabsTrigger: variant="default" | "blue", size="default" | "full"

<Tabs defaultValue="breakdown" value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="breakdown" className="gap-1">
      <Grid className="h-4 w-4" />
      City Breakdown
    </TabsTrigger>
    <TabsTrigger value="opportunities" className="gap-1">
      <Target className="h-4 w-4" />
      Opportunities
    </TabsTrigger>
  </TabsList>

  <TabsContent value="breakdown" className="mt-4">
    {/* Content renders directly - NO wrapping Card needed */}
    <CityBreakdownTab filters={filters} onStartScrape={handleScrape} />
  </TabsContent>

  <TabsContent value="opportunities" className="mt-4">
    <OpportunitiesTab filters={filters} onStartScrape={handleScrape} />
  </TabsContent>
</Tabs>
```

---

## Reference: How LeadScrapes.tsx Does It Correctly

LeadScrapes.tsx shows the proper pattern for tabbed content:

```tsx
// LeadScrapes.tsx - Lines 204-477
<Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col -mt-6 -mb-6">
  {/* Sticky Header + Tabs */}
  <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 ...">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold">Lead Scraping</h1>
        <p className="text-sm text-muted-foreground mt-1">...</p>
      </div>
      <Button>New Lead Scrape</Button>
    </div>

    {/* TabsList */}
    <TabsList size="full">
      <TabsTrigger size="full" variant="blue" value="jobs">Scrape Jobs</TabsTrigger>
      <TabsTrigger size="full" variant="blue" value="pending">Pending Leads</TabsTrigger>
      <TabsTrigger size="full" variant="blue" value="reports">
        <BarChart3 className="h-4 w-4 mr-1" />
        Reports
      </TabsTrigger>
    </TabsList>
  </div>

  {/* Scrollable Content - NO outer Card wrapper */}
  <div className="pt-6 space-y-6">
    <TabsContent value="jobs" className="space-y-6 mt-0">
      {/* Filters and content rendered directly */}
    </TabsContent>

    <TabsContent value="reports" className="space-y-6 mt-0">
      {/* ReportsTabContent renders its own cards internally */}
      <ReportsTabContent onStartScrape={...} />
    </TabsContent>
  </div>
</Tabs>
```

### Key Observations:
1. **No Card wrapper around tab content** - Each tab content manages its own cards
2. **TabsContent gets `mt-0` or `mt-4`** - Controlled spacing
3. **Tab components contain their own Cards** - `CityBreakdownTab` and `OpportunitiesTab` manage their own card structure
4. **Filters are separate** - Filter UI is outside the content cards

---

## Reference: How ReportsTabContent.tsx Does It

```tsx
// ReportsTabContent.tsx - Complete file
export function ReportsTabContent({ onStartScrape }: ReportsTabContentProps) {
  const [subTab, setSubTab] = useState('breakdown');
  const [filters] = useState<AnalyticsFilters>({});

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="breakdown" className="gap-1">
            <Grid className="h-4 w-4" />
            City Breakdown
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1">
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="mt-4">
          {/* NO Card wrapper - CityBreakdownTab has its own cards */}
          <CityBreakdownTab
            filters={filters}
            onStartScrape={handleHeatmapStartScrape}
          />
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4">
          {/* NO Card wrapper - OpportunitiesTab manages its own layout */}
          <OpportunitiesTab
            filters={filters}
            onStartScrape={handleOpportunityStartScrape}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Card Usage Patterns

### When TO Use Card Wrapper (Correct Examples)

1. **Single content blocks** (Dashboard stats):
```jsx
<Card className="border backdrop-blur-sm bg-background/95">
  <CardContent className="p-6">
    <div className="flex items-center">
      <div className="rounded-lg p-3 bg-brand-blue/10">
        <Icon className="h-6 w-6 text-brand-blue" />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-muted-foreground">Title</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  </CardContent>
</Card>
```

2. **Lists with headers** (Recent Restaurants):
```jsx
<Card className="backdrop-blur-sm bg-background/95 border-border">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Recent Restaurants</CardTitle>
      <Link to="/restaurants">View all</Link>
    </div>
  </CardHeader>
  <CardContent className="p-0">
    <div className="divide-y divide-border">
      {items.map(item => (
        <Link key={item.id} className="block px-6 py-4 hover:bg-accent/50">
          {/* Item content */}
        </Link>
      ))}
    </div>
  </CardContent>
</Card>
```

3. **Tables** (from CityBreakdownTab):
```jsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between py-3">
    <CardTitle className="text-base">City Breakdown</CardTitle>
    <Button variant="outline" size="sm" onClick={exportCSV}>
      <Download className="h-4 w-4 mr-1" />
      Export CSV
    </Button>
  </CardHeader>
  <CardContent className="p-0">
    <Table style={{ tableLayout: 'fixed' }}>
      {/* Table content */}
    </Table>
  </CardContent>
</Card>
```

### When NOT to Use Card Wrapper

1. **Tab content that already contains cards:**
   - `CityBreakdownTab` - Has Heatmap Card + Table Card + StatCards
   - `OpportunitiesTab` - Has filter bar + OpportunityCard grid
   - `ReportsTabContent` - Wrapper for the above

2. **Nested components:**
   - If a component renders its own Cards, don't wrap it in another Card

---

## CityBreakdownTab Internal Structure

The component manages 3 distinct visual sections, each with appropriate cards:

```tsx
// CityBreakdownTab.tsx structure
<div className="space-y-6">
  {/* Section 1: Heatmap - wrapped in Card */}
  {heatmap && (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coverage Heatmap (City x Cuisine)</CardTitle>
      </CardHeader>
      <CardContent>
        <HeatmapGrid ... />
      </CardContent>
    </Card>
  )}

  {/* Section 2: Table - wrapped in Card */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between py-3">
      <CardTitle className="text-base">City Breakdown</CardTitle>
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download className="h-4 w-4 mr-1" />
        Export CSV
      </Button>
    </CardHeader>
    <CardContent className="p-0">
      <Table>...</Table>
    </CardContent>
  </Card>

  {/* Section 3: Stats Grid - individual StatCards */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard title="Total Jobs" value={...} icon={BarChart3} color="blue" />
    <StatCard title="Leads Extracted" value={...} icon={Users} color="green" />
    <StatCard title="Cities Covered" value={...} icon={MapPin} color="purple" />
    <StatCard title="Cuisines Tracked" value={...} icon={Utensils} color="orange" />
  </div>
</div>
```

---

## Correct Code Template for Dashboard Lead Scraping Section

### Option A: Direct Component (Minimal Change)
Just remove the Card wrapper:

```jsx
{/* Lead Scraping Reports - renders its own cards */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-brand-purple">Lead Scraping</h2>
    {/* Optional: Link to full reports page */}
    <Link to="/leads?tab=reports" className="text-sm text-brand-blue hover:text-brand-blue/80">
      View Full Reports
    </Link>
  </div>
  <CityBreakdownTab
    filters={{}}
    onStartScrape={handleStartScrape}
  />
</div>
```

### Option B: Tabbed Interface (Full Pattern)
Add sub-tabs matching the LeadScrapes Reports tab:

```jsx
{/* Lead Scraping Reports Section */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-brand-purple">Lead Scraping</h2>
    <Link to="/leads?tab=reports" className="text-sm text-brand-blue hover:text-brand-blue/80">
      View Full Reports
    </Link>
  </div>

  <Tabs defaultValue="breakdown">
    <TabsList>
      <TabsTrigger value="breakdown" className="gap-1">
        <Grid className="h-4 w-4" />
        City Breakdown
      </TabsTrigger>
      <TabsTrigger value="opportunities" className="gap-1">
        <Target className="h-4 w-4" />
        Opportunities
      </TabsTrigger>
    </TabsList>

    <TabsContent value="breakdown" className="mt-4">
      <CityBreakdownTab
        filters={{}}
        onStartScrape={handleStartScrape}
      />
    </TabsContent>

    <TabsContent value="opportunities" className="mt-4">
      <OpportunitiesTab
        filters={{}}
        onStartScrape={handleStartScrapeFromOpportunity}
      />
    </TabsContent>
  </Tabs>
</div>
```

### Option C: Use ReportsTabContent Directly (Recommended)
Since `ReportsTabContent` already provides the tabbed interface:

```jsx
{/* Lead Scraping Reports Section */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-brand-purple">Lead Scraping</h2>
    <Link to="/leads?tab=reports" className="text-sm text-brand-blue hover:text-brand-blue/80">
      View Full Reports
    </Link>
  </div>

  <ReportsTabContent
    onStartScrape={(params) => {
      setPrefillScrapeData(params);
      setCreateJobOpen(true);
    }}
  />
</div>
```

**Required imports for Option C:**
```tsx
import { ReportsTabContent } from '../components/reports/ReportsTabContent';
```

---

## Summary: Rules for Tab/Card Usage

1. **Never wrap tab content in a Card if that content already contains Cards**
2. **TabsContent components should use `mt-4` for spacing from TabsList**
3. **Each major data section should have its own Card** (table, heatmap, form)
4. **Use `space-y-6` for section spacing within tab content**
5. **Cards with tables should use `CardContent className="p-0"` for edge-to-edge tables**
6. **Card headers with actions use `className="flex flex-row items-center justify-between py-3"`**

---

## Files Referenced

| File | Purpose |
|------|---------|
| `/UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Current dashboard (has the problem) |
| `/UberEats-Image-Extractor/src/pages/LeadScrapes.tsx` | Reference for correct tab pattern |
| `/UberEats-Image-Extractor/src/components/reports/ReportsTabContent.tsx` | Tab wrapper component |
| `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` | Heatmap + table content |
| `/UberEats-Image-Extractor/src/components/reports/OpportunitiesTab.tsx` | Opportunities grid |
| `/UberEats-Image-Extractor/src/components/ui/tabs.tsx` | Tab component definitions |
