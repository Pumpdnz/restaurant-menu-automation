# Session 5: Clickable Navigation Enhancements

**Date:** 2026-01-12
**Duration:** ~20 minutes
**Focus:** Making lead counts and stats clickable for quick navigation

---

## Summary

Implemented clickable navigation for lead counts across the Reports Tab and LeadScrapeDetail page:
1. Total Leads column in City Breakdown Tab now clickable (city and cuisine rows)
2. Processed stat card in LeadScrapeDetail opens Step 4 modal
3. Pending stat card in LeadScrapeDetail navigates to filtered pending leads
4. Fixed URL parameter reading for Pending Leads tab filters

---

## Files Modified

### Frontend Components
| File | Changes |
|------|---------|
| `src/components/reports/CityBreakdownTab.tsx` | Made Total Leads column clickable for both city rows and expanded cuisine rows |
| `src/pages/LeadScrapeDetail.tsx` | Added modal state, made Processed and Pending stat cards clickable |
| `src/pages/LeadScrapes.tsx` | Fixed pending filters to initialize from URL parameters |

---

## Feature 1: Clickable Total Leads (City Breakdown Tab)

### Problem
The "Total Leads" column values in the City Breakdown table were plain text. Users couldn't quickly navigate to view those leads.

### Solution
- **City rows**: Wrapped lead count in a button that opens `/leads?tab=pending&city={city}` in new tab
- **Cuisine rows**: Wrapped lead count in a button that opens `/leads?tab=pending&city={city}&cuisine={cuisine}` in new tab
- Added `e.stopPropagation()` to prevent row expansion when clicking
- Added hover styling (`hover:text-brand-blue`) and tooltips

### Code Changes (CityBreakdownTab.tsx)

**City row (lines 277-288):**
```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    window.open(`/leads?tab=pending&city=${encodeURIComponent(city.city)}`, '_blank');
  }}
  className="hover:text-brand-blue cursor-pointer transition-colors"
  title={`View ${city.total_leads.toLocaleString()} pending leads in ${city.city}`}
>
  {city.total_leads.toLocaleString()}
</button>
```

**Cuisine row (lines 306-317):**
```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    window.open(`/leads?tab=pending&city=${encodeURIComponent(city.city)}&cuisine=${encodeURIComponent(cuisine.name)}`, '_blank');
  }}
  className="hover:text-brand-blue cursor-pointer transition-colors"
  title={`View ${cuisine.leads} pending leads for ${cuisine.name} in ${city.city}`}
>
  {cuisine.leads}
</button>
```

---

## Feature 2: Clickable Processed Stat (LeadScrapeDetail)

### Problem
The "Processed" stat card on the LeadScrapeDetail page showed a count but wasn't interactive.

### Solution
- Added `ScrapeJobStepDetailModal` import and state management
- Created `handleOpenStepModal(stepNumber)` function to find and open step modal
- Converted Processed stat `<div>` to `<button>` that opens Step 4 modal
- Added hover styling (`hover:bg-purple-100`)

### Code Changes (LeadScrapeDetail.tsx)

**New imports (lines 28-29):**
```tsx
import { ScrapeJobStepDetailModal } from '../components/leads/ScrapeJobStepDetailModal';
import { LeadScrapeJobStep } from '../hooks/useLeadScrape';
```

**Modal state (lines 192-202):**
```tsx
const [selectedStep, setSelectedStep] = useState<LeadScrapeJobStep | null>(null);
const [isStepDetailModalOpen, setIsStepDetailModalOpen] = useState(false);

const handleOpenStepModal = (stepNumber: number) => {
  const step = job?.steps?.find((s: LeadScrapeJobStep) => s.step_number === stepNumber);
  if (step) {
    setSelectedStep(step);
    setIsStepDetailModalOpen(true);
  }
};
```

**Clickable Processed card (lines 466-474):**
```tsx
<button
  type="button"
  onClick={() => handleOpenStepModal(4)}
  className="text-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer w-full"
  title="Click to view processed leads (Step 4)"
>
  <p className="text-2xl font-bold text-purple-600 hover:text-purple-700">{job.lead_stats.processed}</p>
  <p className="text-xs text-muted-foreground">Processed</p>
</button>
```

---

## Feature 3: Clickable Pending Stat (LeadScrapeDetail)

### Problem
The "Pending" stat card showed a count but wasn't interactive.

### Solution
- Created `handleViewPendingLeads()` function to build URL with city/cuisine params
- Converted Pending stat `<div>` to `<button>` that opens filtered pending leads in new tab
- Added hover styling (`hover:bg-yellow-100`)

### Code Changes (LeadScrapeDetail.tsx)

**Handler function (lines 205-212):**
```tsx
const handleViewPendingLeads = () => {
  if (!job) return;
  const params = new URLSearchParams({ tab: 'pending' });
  if (job.city) params.set('city', job.city);
  if (job.cuisine) params.set('cuisine', job.cuisine);
  window.open(`/leads?${params.toString()}`, '_blank');
};
```

**Clickable Pending card (lines 475-483):**
```tsx
<button
  type="button"
  onClick={handleViewPendingLeads}
  className="text-center p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer w-full"
  title={`Click to view pending leads for ${job.city}${job.cuisine ? ` - ${job.cuisine}` : ''}`}
>
  <p className="text-2xl font-bold text-yellow-600 hover:text-yellow-700">{job.lead_stats.pending}</p>
  <p className="text-xs text-muted-foreground">Pending</p>
</button>
```

---

## Feature 4: URL Parameter Support for Pending Tab

### Problem
When navigating to `/leads?tab=pending&city=X&cuisine=Y`, the filters weren't being populated with the URL parameter values.

### Solution
- Updated `pendingFilters` state initialization to read from URL parameters
- Updated `handleResetPendingFilters` to clear URL parameters

### Code Changes (LeadScrapes.tsx)

**Filter initialization (lines 109-115):**
```tsx
// Before
const [pendingFilters, setPendingFilters] = useState({
  search: '',
  platform: [] as string[],
  city: [] as string[],
  cuisine: [] as string[],
});

// After
const [pendingFilters, setPendingFilters] = useState({
  search: '',
  platform: [] as string[],
  city: urlCity ? [urlCity] : [] as string[],
  cuisine: urlCuisine ? [urlCuisine] : [] as string[],
});
```

**Reset handler (lines 174-183):**
```tsx
const handleResetPendingFilters = () => {
  setPendingFilters({
    search: '',
    platform: [],
    city: [],
    cuisine: [],
  });
  // Clear URL params (keep only tab)
  setSearchParams({ tab: activeTab });
};
```

---

## Behavior Summary

| Element | Location | Click Action |
|---------|----------|--------------|
| City row "Total Leads" | City Breakdown Tab | Opens `/leads?tab=pending&city={city}` in new tab |
| Cuisine row "Leads" | City Breakdown Tab (expanded) | Opens `/leads?tab=pending&city={city}&cuisine={cuisine}` in new tab |
| "Processed" stat card | LeadScrapeDetail page | Opens ScrapeJobStepDetailModal showing Step 4 leads |
| "Pending" stat card | LeadScrapeDetail page | Opens `/leads?tab=pending&city={city}&cuisine={cuisine}` in new tab |

---

## Technical Decisions

1. **New tab navigation**: Used `window.open(url, '_blank')` to preserve current page state
2. **URL encoding**: Applied `encodeURIComponent()` for city/cuisine values to handle special characters
3. **Event propagation**: Used `e.stopPropagation()` to prevent row expansion when clicking lead counts
4. **State initialization**: URL params read once at component mount (works for new tab navigation)

---

## Testing Notes

- Click city row Total Leads → opens pending tab filtered by city
- Click cuisine row Leads → opens pending tab filtered by city + cuisine
- Click Processed stat → opens Step 4 modal with processed leads
- Click Pending stat → opens pending tab filtered by job's city/cuisine
- URL params populate filter dropdowns correctly on new tab
- Clear All button clears both filters and URL params

---

## Current State

All planned Session 5 improvements have been completed:

### City Breakdown Tab
- Total Leads column is now clickable at both city and cuisine levels
- Consistent hover styling with existing clickable indicators

### LeadScrapeDetail Page
- Processed stat card opens Step 4 modal for detailed view
- Pending stat card navigates to filtered pending leads
- Both cards have hover effects indicating interactivity

### LeadScrapes Page
- Pending tab now properly reads city/cuisine from URL parameters
- Deep linking from Reports Tab and LeadScrapeDetail works correctly

---

## Next Steps

All planned clickable navigation enhancements have been implemented. The Reports Tab and LeadScrapeDetail page now provide comprehensive interactivity for navigating between different views of lead data.
