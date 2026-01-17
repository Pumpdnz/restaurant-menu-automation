# Routing and Interactions Analysis: CityBreakdownTab

> **STATUS: ✅ COMPLETE** - All interactions verified via Ralph Loop (2026-01-15)
> Dialog management, navigation, and callbacks all working correctly on Dashboard.

## Overview

This document analyzes the interactive elements, routing patterns, and dialog interactions in the CityBreakdownTab component to understand the requirements for moving it to the Dashboard.

---

## 1. How Cuisine Buttons Trigger Dialogs vs Navigation

### CuisineCoverageIndicators (City-Level Row)

**Location:** `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` (lines 126-186)

The cuisine coverage buttons at the city level have two distinct behaviors:

1. **Start Scrape (Empty coverage - 0 pages scraped):**
   - Calls `onCuisineClick(cuisineSlug)` callback
   - This triggers the `onStartScrape` prop passed from parent
   - Ultimately opens the CreateLeadScrapeJob dialog

2. **View Leads (Existing coverage - 1+ pages scraped):**
   - Uses `window.open()` to navigate to a new tab
   - URL pattern: `/leads?city=${city}&cuisine=${slug}`
   - Opens in `_blank` target (new browser tab)

### PageIndicators (Cuisine-Level Row - Expanded)

**Location:** Lines 69-123

Page indicator buttons (1-10) have two behaviors:

1. **Scraped Pages (Green):**
   - Clicks call `window.open('/leads/${jobId}', '_blank')`
   - Opens the lead scrape job detail page in new tab

2. **Unscraped Pages (Gray):**
   - Calls `onPageClick(page)` callback
   - This triggers `onStartScrape(city, cuisine.name, page)` with specific page offset
   - Opens CreateLeadScrapeJob dialog pre-filled with page offset

---

## 2. Dialog Component Locations and Rendering

### CreateLeadScrapeJob Dialog

**Location:** `/UberEats-Image-Extractor/src/components/leads/CreateLeadScrapeJob.tsx`

**How it's rendered:**
- Rendered in `LeadScrapes.tsx` (parent page) at lines 479-493
- Uses controlled state: `createJobOpen` and `setCreateJobOpen`
- Dialog component from `@/components/ui/dialog`

**Props received:**
```typescript
interface CreateLeadScrapeJobProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editJob?: LeadScrapeJob | null;
  prefillCity?: string;
  prefillCuisine?: string;
  prefillPageOffset?: number;
}
```

**Prefill data flow:**
1. CityBreakdownTab calls `onStartScrape(city, cuisine, pageOffset)`
2. ReportsTabContent receives and forwards to LeadScrapes via `onStartScrape`
3. LeadScrapes sets `prefillScrapeData` state and opens dialog
4. CreateLeadScrapeJob uses `useEffect` to initialize form with prefill values

---

## 3. Navigation Patterns

### Pattern 1: window.open() for External Navigation

CityBreakdownTab does NOT use React Router hooks directly. Instead, it uses native `window.open()` for all navigation:

```javascript
// View pending leads for a city
window.open(`/leads?tab=pending&city=${encodeURIComponent(city.city)}`, '_blank');

// View pending leads for city+cuisine
window.open(`/leads?tab=pending&city=${encodeURIComponent(city.city)}&cuisine=${encodeURIComponent(cuisine.name)}`, '_blank');

// View leads filtered by city/cuisine (from cuisine coverage buttons)
window.open(`/leads?city=${encodeURIComponent(city)}&cuisine=${encodeURIComponent(slug)}`, '_blank');

// View specific job detail
window.open(`/leads/${jobId}`, '_blank');
```

**Why window.open():**
- Opens in new tabs (`_blank`)
- Allows users to compare multiple views
- Doesn't disrupt current workflow/view

### Pattern 2: Callback-Based Dialog Opening

For actions that open dialogs, the component uses callbacks:
- `onStartScrape` callback is passed down from parent
- Component doesn't control dialog state directly
- Parent (LeadScrapes) manages dialog state

### React Router Usage in Parent

LeadScrapes.tsx uses React Router:
```typescript
import { useSearchParams } from 'react-router-dom';
// ...
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'jobs';
```

**Tab state is URL-driven** via search params for deep linking support.

---

## 4. Callbacks Passed from Parent Components

### Current Callback Chain

```
LeadScrapes.tsx
  |
  +-- ReportsTabContent
        |-- onStartScrape: (params) => {
        |     setPrefillScrapeData(params);
        |     setCreateJobOpen(true);
        |   }
        |
        +-- CityBreakdownTab
              |-- filters: AnalyticsFilters
              |-- onStartScrape: handleHeatmapStartScrape
                    = (city, cuisine, pageOffset) => onStartScrape({ city, cuisine, pageOffset })
```

### Callback Responsibilities

| Callback | Source | Purpose |
|----------|--------|---------|
| `onStartScrape` | LeadScrapes | Opens CreateLeadScrapeJob dialog with prefill data |
| `onCuisineClick` | CityBreakdownTab internal | Wrapper that calls onStartScrape for cuisine buttons |
| `onPageClick` | PageIndicators | Calls onStartScrape with specific page number |
| `onScrapedPageClick` | PageIndicators | Opens job detail via window.open |
| `onCellClick` | HeatmapGrid | Calls onStartScrape for heatmap cell clicks |

---

## 5. List of All Clickable Elements and Expected Behavior

### City Row Level

| Element | Behavior | Target |
|---------|----------|--------|
| Row Click | Toggle expand/collapse | Internal state |
| Expand/Collapse Chevron | Toggle expand/collapse | Internal state |
| Total Leads Count | `window.open('/leads?tab=pending&city={city}', '_blank')` | New tab |
| Cuisine Coverage Button (0 pages) | `onStartScrape(city, cuisineSlug, 1)` | Dialog |
| Cuisine Coverage Button (1+ pages) | `window.open('/leads?city={city}&cuisine={slug}', '_blank')` | New tab |

### Expanded Cuisine Row Level

| Element | Behavior | Target |
|---------|----------|--------|
| Leads Count | `window.open('/leads?tab=pending&city={city}&cuisine={cuisine}', '_blank')` | New tab |
| Page Indicator (Unscraped) | `onStartScrape(city, cuisine, page)` | Dialog |
| Page Indicator (Scraped) | `window.open('/leads/{jobId}', '_blank')` | New tab |

### Header Level

| Element | Behavior | Target |
|---------|----------|--------|
| Expand All/Collapse All Button | Toggle all city expansions | Internal state |
| Export CSV Button | Generate and download CSV file | Browser download |

### Heatmap Grid (HeatmapGrid.tsx)

| Element | Behavior | Target |
|---------|----------|--------|
| Cell Click | `onCellClick(city, cuisine, value)` -> `onStartScrape` | Dialog |

### Opportunities Tab (OpportunityCard.tsx)

| Element | Behavior | Target |
|---------|----------|--------|
| Start Scrape Button | `onStartScrape(opportunity)` | Dialog |
| View Details Button (optional) | `onViewDetails(opportunity)` | Currently unused |

---

## 6. Recommendations for Dashboard Integration

### Required Components to Include

1. **CityBreakdownTab** - Main component
2. **HeatmapGrid** - Visualization for coverage matrix
3. **StatCard** - Summary statistics display
4. **PageIndicators** - Page status visualization (internal to CityBreakdownTab)
5. **CuisineCoverageIndicators** - Cuisine status display (internal to CityBreakdownTab)

### Required Hooks

```typescript
import {
  useAnalyticsCoverage,
  useAnalyticsHeatmap,
  useAnalyticsSummary,
  AnalyticsFilters
} from '@/hooks/useLeadScrapeAnalytics';
```

### Dialog Management Options

**Option A: Lift Dialog to Dashboard (Recommended)**

Dashboard would need to:
1. Import `CreateLeadScrapeJob` component
2. Manage `createJobOpen` state
3. Manage `prefillScrapeData` state
4. Pass `onStartScrape` callback to CityBreakdownTab

```tsx
// Dashboard.tsx
const [createJobOpen, setCreateJobOpen] = useState(false);
const [prefillScrapeData, setPrefillScrapeData] = useState<{
  city?: string;
  cuisine?: string;
  pageOffset?: number;
} | null>(null);

const handleStartScrape = (city: string, cuisine: string, pageOffset?: number) => {
  setPrefillScrapeData({ city, cuisine, pageOffset });
  setCreateJobOpen(true);
};

// In render:
<CityBreakdownTab
  filters={{}}
  onStartScrape={handleStartScrape}
/>
<CreateLeadScrapeJob
  open={createJobOpen}
  onClose={() => {
    setCreateJobOpen(false);
    setPrefillScrapeData(null);
  }}
  onSuccess={() => {
    // Optionally refetch data
    setPrefillScrapeData(null);
  }}
  prefillCity={prefillScrapeData?.city}
  prefillCuisine={prefillScrapeData?.cuisine}
  prefillPageOffset={prefillScrapeData?.pageOffset}
/>
```

**Option B: Use Navigation Instead of Dialog**

Instead of opening dialog, navigate to LeadScrapes page:
```tsx
const handleStartScrape = (city: string, cuisine: string, pageOffset?: number) => {
  const params = new URLSearchParams({
    tab: 'jobs',
    action: 'new',
    city,
    cuisine,
    ...(pageOffset && { pageOffset: String(pageOffset) })
  });
  window.location.href = `/leads?${params}`;
};
```

### Navigation Considerations

Since CityBreakdownTab uses `window.open()` for navigation:
- No React Router dependencies to worry about
- Navigation will work regardless of where component is placed
- URLs are absolute paths, so routing will work

### Feature Flag Considerations

The Dashboard is NOT feature-protected, but LeadScrapes is:
```tsx
<Route path="leads" element={
  <FeatureProtectedRoute featurePath="leadScraping" featureName="Lead Scraping">
    <LeadScrapes />
  </FeatureProtectedRoute>
} />
```

**Recommendation:** Either:
1. Wrap CityBreakdownTab section in Dashboard with feature check
2. Or conditionally render based on feature flag availability

### State Dependencies

| State | Source | Notes |
|-------|--------|-------|
| `expandedCities` | Internal useState | Self-contained, no issues |
| Analytics data | React Query hooks | Will work from Dashboard if hooks are imported |
| Dialog state | Parent component | Must be provided by Dashboard |

---

## 7. Summary

### Key Findings

1. **No React Router Usage in CityBreakdownTab** - All navigation uses `window.open()` which is portable

2. **Dialog Management is External** - The CreateLeadScrapeJob dialog is controlled by parent state, requiring Dashboard to manage this

3. **Data Fetching is Hook-Based** - Uses `useAnalyticsCoverage`, `useAnalyticsHeatmap`, `useAnalyticsSummary` which will work from any location

4. **Callbacks Required:**
   - `onStartScrape?: (city: string, cuisine: string, pageOffset?: number) => void`

5. **Feature Gating May Be Needed** - Consider wrapping in feature check for organizations without lead scraping access

### Implementation Checklist

- [x] Add state management for CreateLeadScrapeJob dialog in Dashboard ✅ *Iteration 1*
- [x] Import and render CreateLeadScrapeJob component ✅ *Iteration 1*
- [x] Import CityBreakdownTab component ✅ *Iteration 2*
- [ ] Add feature flag check if needed *(Not implemented - deferred)*
- [x] Pass empty `filters` prop (or implement filter UI if desired) ✅ *Iteration 2*
- [x] Implement `onStartScrape` callback ✅ *Iteration 5 (fixed signature mismatch)*
- [ ] Consider refresh/refetch after successful scrape job creation *(Not implemented - deferred)*
- [ ] Convert Dashboard from JSX to TSX (optional but recommended for type safety) *(Not implemented - deferred)*
