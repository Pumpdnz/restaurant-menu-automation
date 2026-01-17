# CityBreakdownTab Component Investigation

> **STATUS: ✅ COMPLETE** - Findings implemented via Ralph Loop (2026-01-15)
> Component successfully integrated into Dashboard with all interactive functionality working.

## Overview

The `CityBreakdownTab` component provides a comprehensive city-by-city breakdown of lead scraping coverage with interactive elements for viewing and triggering scrapes. Located at:
`/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx`

---

## Component Props Interface

```typescript
interface CityBreakdownTabProps {
  filters: AnalyticsFilters;
  onStartScrape?: (city: string, cuisine: string, pageOffset?: number) => void;
}
```

### Props Details

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `filters` | `AnalyticsFilters` | Yes | Filter parameters for analytics queries |
| `onStartScrape` | `(city: string, cuisine: string, pageOffset?: number) => void` | No | Callback triggered when user wants to start a scrape |

### AnalyticsFilters Interface

```typescript
interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  platform?: string;
  city?: string;
  cuisine?: string;
}
```

---

## Hooks and Data Sources

### 1. useAnalyticsSummary
- **Source**: `/hooks/useLeadScrapeAnalytics.ts`
- **API Endpoint**: `GET /lead-scrape-jobs/analytics/summary`
- **Purpose**: Fetches aggregate statistics (total jobs, leads, cities, cuisines)
- **Returns**: `SummaryStats`
- **Cache**: 5 minutes (staleTime)

```typescript
interface SummaryStats {
  total_jobs: number;
  completed_jobs: number;
  total_leads_extracted: number;
  total_leads_passed: number;
  total_leads_failed: number;
  unique_cities: number;
  unique_cuisines: number;
  avg_success_rate: number;
}
```

### 2. useAnalyticsCoverage
- **Source**: `/hooks/useLeadScrapeAnalytics.ts`
- **API Endpoint**: `GET /lead-scrape-jobs/analytics/coverage`
- **Purpose**: Fetches city-level coverage data with cuisine breakdowns
- **Returns**: `CityCoverage[]`
- **Cache**: 5 minutes

```typescript
interface CityCoverage {
  city: string;
  total_leads: number;
  total_jobs: number;
  cuisines: CuisineData[];
  last_scraped: string | null;
  pages_scraped: number[];
}

interface CuisineData {
  name: string;
  leads: number;
  jobs: number;
  pages_scraped: number[]; // Array of page numbers (1-10)
  page_jobs: Record<number, string>; // Map page number to job ID
}
```

### 3. useAnalyticsHeatmap
- **Source**: `/hooks/useLeadScrapeAnalytics.ts`
- **API Endpoint**: `GET /lead-scrape-jobs/analytics/heatmap`
- **Purpose**: Fetches matrix data for city x cuisine heatmap visualization
- **Returns**: `HeatmapData`
- **Cache**: 5 minutes

```typescript
interface HeatmapData {
  cities: string[];
  cuisines: string[];
  matrix: number[][];
  maxValue: number;
}
```

---

## Internal State Management

```typescript
const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
```

- Tracks which city rows are expanded to show cuisine-level details
- Toggle functions: `toggleCity(city)`, `toggleExpandAll()`
- Computed: `isAllExpanded` based on comparing expandedCities size with allCityNames length

---

## Context Dependencies

### NO External Context Dependencies

The component is **self-contained** and does NOT require:
- React Router context (uses `window.open()` for navigation)
- Dialog context
- Toast context
- Redux/Zustand store

### External Dependencies

1. **React Query** - For data fetching via `useQuery`
2. **api service** - Axios instance from `@/services/api`
3. **UI Components**:
   - `Card`, `CardContent`, `CardHeader`, `CardTitle`
   - `Button`
   - `Skeleton`
   - `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
   - `Collapsible`, `CollapsibleContent`
4. **Visualization Components**:
   - `HeatmapGrid` - from `./visualizations/HeatmapGrid`
   - `StatCard` - from `./visualizations/StatCard`
5. **Icons**: lucide-react icons

---

## Interactive Elements Behavior

### 1. Heatmap Cell Click
- **Location**: `HeatmapGrid` component
- **Action**: Calls `onStartScrape(city, cuisine, pageOffset)`
- **Page Offset Logic**: Calculates next page from coverage data (max scraped page + 1, capped at 10)

### 2. City Row Click
- **Action**: Toggles row expansion to show/hide cuisine breakdown
- **No navigation involved**

### 3. Total Leads Count (City Level)
- **Action**: Opens new tab to `/leads?tab=pending&city={city}`
- **Method**: `window.open()` with `_blank` target

### 4. Cuisine Coverage Indicators (Top 10)
- **For unscraped cuisines (pageCount === 0)**:
  - Calls `onStartScrape(city, cuisineSlug, 1)` if provided
- **For scraped cuisines (pageCount > 0)**:
  - Opens new tab to `/leads?city={city}&cuisine={cuisine}`

### 5. Page Indicators (Cuisine Level - expanded rows)
- **For scraped pages**: Opens new tab to `/leads/{jobId}`
- **For unscraped pages**: Calls `onStartScrape(city, cuisine, page)` if provided

### 6. Leads Count (Cuisine Level)
- **Action**: Opens new tab to `/leads?tab=pending&city={city}&cuisine={cuisine}`

### 7. Expand All / Collapse All Button
- **Action**: Toggles all city rows expanded/collapsed

### 8. Export CSV Button
- **Action**: Downloads CSV file with coverage data
- **No external dependencies**

---

## Top 10 Cuisines Tracked

```typescript
const TOP_CUISINES = [
  { slug: 'bbq', label: 'BBQ' },
  { slug: 'burger', label: 'Burger' },
  { slug: 'chinese', label: 'Chinese' },
  { slug: 'indian', label: 'Indian' },
  { slug: 'italian', label: 'Italian' },
  { slug: 'mexican', label: 'Mexican' },
  { slug: 'pizza', label: 'Pizza' },
  { slug: 'pollo', label: 'Pollo' },
  { slug: 'thai', label: 'Thai' },
  { slug: 'vietnamese', label: 'Viet' },
];
```

---

## Parent Component Usage (ReportsTabContent)

```typescript
interface ReportsTabContentProps {
  onStartScrape: (params: { city: string; cuisine: string; pageOffset?: number }) => void;
}

// Handler that adapts the callback signature:
const handleHeatmapStartScrape = (city: string, cuisine: string, pageOffset?: number) => {
  onStartScrape({ city, cuisine, pageOffset });
};

// Usage:
<CityBreakdownTab
  filters={filters}
  onStartScrape={handleHeatmapStartScrape}
/>
```

The parent provides:
1. Empty filters object: `const [filters] = useState<AnalyticsFilters>({});`
2. `onStartScrape` callback that wraps parameters into an object

---

## Recommendations for Dashboard Integration

### Option 1: Direct Integration (Recommended)

The component can be used directly on the Dashboard with minimal adaptation:

```tsx
import { CityBreakdownTab } from '@/components/reports/CityBreakdownTab';
import { AnalyticsFilters } from '@/hooks/useLeadScrapeAnalytics';

function DashboardPage() {
  const filters: AnalyticsFilters = {}; // Or with date filters

  const handleStartScrape = (city: string, cuisine: string, pageOffset?: number) => {
    // Option A: Open dialog to configure scrape
    // Option B: Navigate to leads page with params
    // Option C: Directly trigger scrape API call
  };

  return (
    <CityBreakdownTab
      filters={filters}
      onStartScrape={handleStartScrape}
    />
  );
}
```

### Option 2: Without onStartScrape

If scraping functionality is not needed on Dashboard:

```tsx
<CityBreakdownTab filters={{}} />
```

This will:
- Disable all "start scrape" click handlers
- Keep navigation links working (opens in new tabs)
- Keep CSV export working

### Required Setup

1. **React Query Provider**: Must be present in app tree (already in place)
2. **API Service**: Axios instance at `@/services/api` must be configured
3. **UI Component Imports**: All shadcn/ui components must be available
4. **Visualization Components**: Import path `@/components/reports/visualizations/*`

### Considerations

1. **No Router Dependency**: Component uses `window.open()` for all navigation, so no React Router setup needed specifically for this component

2. **Loading States**: Component handles its own loading skeleton states

3. **Empty State**: Component handles empty data gracefully

4. **Filters**: Pass empty object `{}` for unfiltered data, or provide date range filters as needed

5. **Responsiveness**: Table uses `overflow-x-auto` for horizontal scrolling on smaller screens

---

## File Dependencies Summary

| File | Purpose |
|------|---------|
| `@/hooks/useLeadScrapeAnalytics.ts` | Data fetching hooks |
| `@/services/api.ts` | Axios API client |
| `@/components/reports/visualizations/HeatmapGrid.tsx` | Heatmap visualization |
| `@/components/reports/visualizations/StatCard.tsx` | Summary stat cards |
| `@/components/ui/*` | shadcn/ui components |
| `@/lib/utils.ts` | cn() utility function |
| `lucide-react` | Icons |

---

## Summary

The CityBreakdownTab is a well-encapsulated component that:

1. **Fetches its own data** via three React Query hooks
2. **Manages internal state** for row expansion
3. **Has no external context dependencies** - uses window.open for navigation
4. **Provides optional scrape callback** - can work without it
5. **Is ready for standalone use** on Dashboard with minimal wrapper code

The only required prop is `filters` (can be empty object), and optionally `onStartScrape` if you want scrape functionality. All navigation happens via new browser tabs, making the component portable across different routing setups.
