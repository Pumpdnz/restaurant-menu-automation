# Investigation: Reports Components

## Overview
The Lead Scrapes page has report components (heatmap, city breakdown table) in a tabbed interface that can be reused on the Dashboard.

## Component Architecture

### ReportsTabContent.tsx
- Main orchestrator managing two sub-tabs
- **Props:** `onStartScrape: (params: { city: string; cuisine: string; pageOffset?: number }) => void`
- Simple wrapper with tab switching, passes callbacks to children

### CityBreakdownTab.tsx (472 lines)
Most complex component containing:
- `HeatmapGrid` - Visual matrix showing city x cuisine coverage
- `PageIndicators` - Shows pages 1-10 with status indicators
- `CuisineCoverageIndicators` - Small visual badges for top 10 cuisines
- `StatCard` - Summary stats (Total Jobs, Leads Extracted, Cities, Cuisines)

### OpportunitiesTab.tsx (548 lines)
- Advanced filtering with localStorage persistence
- Groups cities by NZ region
- Multi-select filters for cities/cuisines
- Sorting: score, leads count, city name
- Renders grid of `OpportunityCard` components

### OpportunityCard.tsx (106 lines)
- Reusable card for single opportunity
- Props: `Opportunity` object, callbacks `onStartScrape`, `onViewDetails`
- Priority badge (high/medium/low) with color coding

## Data Hooks Required

All data flows through `useLeadScrapeAnalytics.ts`:

| Hook | Returns | Purpose |
|------|---------|---------|
| `useAnalyticsSummary(filters)` | `SummaryStats` | Total jobs, leads, cities, cuisines |
| `useAnalyticsCoverage(filters)` | `CityCoverage[]` | Per-city breakdown with cuisine details |
| `useAnalyticsHeatmap(filters)` | `HeatmapData` | City/cuisine matrix for heatmap |
| `useAnalyticsOpportunities(filters)` | `Opportunity[]` | Scored opportunities with priorities |

## Props Required

```typescript
// ReportsTabContent
{ onStartScrape: (params: { city: string; cuisine: string; pageOffset?: number }) => void }

// CityBreakdownTab
{ filters: AnalyticsFilters; onStartScrape?: (city: string, cuisine: string, pageOffset?: number) => void }

// OpportunitiesTab
{ filters: AnalyticsFilters; onStartScrape: (opportunity: Opportunity) => void }

// HeatmapGrid
{ cities: string[]; cuisines: string[]; matrix: number[][]; maxValue: number; onCellClick?: Function }

// StatCard
{ title: string; value: string | number; subtitle?: string; icon?: LucideIcon; color?: string; trend?: object }
```

## Dependencies
- React Query (@tanstack/react-query)
- Lucide-react for icons
- shadcn/ui components (card, button, table, popover, checkbox)
- date-fns for date formatting
- Custom `cn()` utility

## Reusability Assessment

### Can Import Directly
- HeatmapGrid (fully reusable)
- StatCard (fully reusable)
- ProgressBar (fully reusable)
- OpportunityCard (fully reusable)

### Requires Modification
- CityBreakdownTab - Tightly coupled to API hooks
- OpportunitiesTab - Hardcoded NZ regions/cities
- ReportsTabContent - Depends on child components

## Dashboard Integration Notes
- Import ReportsTabContent with onStartScrape callback
- Provide AnalyticsFilters for date range filtering
- Consider read-only mode (hide action buttons) for dashboard preview
