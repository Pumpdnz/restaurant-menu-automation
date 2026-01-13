# Investigation Summary: Dashboard Update

## Overview
This document summarizes findings from 6 parallel investigations to prepare a Ralph Loop for updating the Dashboard page with new report and navigation components.

---

## Key Findings

### 1. Dashboard Structure
- Current dashboard is a React JSX file using shadcn/ui components
- Uses React Query for data fetching (restaurantAPI, extractionAPI, analyticsAPI)
- Has 4 stat cards, 2 preview sections, 3 quick action buttons
- **No feature flags currently** - will need to add conditional rendering

### 2. Reports Components
- `ReportsTabContent` is the main orchestrator with two sub-tabs
- Components can be imported: `HeatmapGrid`, `StatCard`, `OpportunityCard`
- Data flows through `useLeadScrapeAnalytics.ts` hooks
- **Can reuse directly** with `onStartScrape` callback

### 3. Feature Flags
- Stored in `organisations.feature_flags` JSON column
- Access via `useAuth().isFeatureEnabled(path)`
- **Exact flags needed:**
  - `leadScraping` - Lead scraping reports section
  - `tasksAndSequences` - Tasks preview section
  - `registrationBatches` - Batch registration preview

### 4. Data Queries
- **Existing hooks to reuse:**
  - `usePendingLeads()` - Pending leads preview
  - `useRegistrationBatches()` - Batch registration preview
- **Need to create:**
  - Tasks due today query (currently client-side only)
  - Recently created restaurants query with limit/filter

### 5. Task Dialog
- `CreateTaskModal` component at `src/components/tasks/CreateTaskModal.tsx`
- Simple state management: `useState(false)` → `setOpen(true)` → modal renders
- Props: `open`, `onClose`, `onSuccess`, optional `restaurantId`
- **Ready to use** - just import and add state

### 6. UI Patterns
- shadcn/ui (Radix-based) with Tailwind CSS
- Standard components: Card, Button, Badge, Table, Tabs, Dialog
- Brand colors: brand-blue, brand-green, brand-purple, brand-orange
- `cn()` utility for class merging

---

## Blockers and Issues

### None Identified
All required patterns and components exist in the codebase.

### Minor Gaps
1. **Tasks due today hook** - Needs to be created or use client-side filtering
2. **Recent restaurants hook** - Needs to be created or use existing with limit param
3. **Dashboard file is JSX** - May want to convert to TSX for type safety

---

## Recommended Architecture

### Dashboard Sections (in order)

1. **Stats Cards Row** (4 cards)
   - Keep existing pattern, update metrics as needed

2. **Lead Scraping Reports** (feature-gated: `leadScraping`)
   - Import `ReportsTabContent` from reports components
   - Show in collapsed/preview mode for Dashboard

3. **Two-Column Row:**
   - **Pending Leads Preview** (feature-gated: `leadScraping`)
   - **Recent Batch Registrations** (feature-gated: `registrationBatches`)

4. **Two-Column Row:**
   - **Tasks Due Today** (feature-gated: `tasksAndSequences`)
   - **Recently Created Restaurants** (always visible)

5. **Quick Actions Row** (updated buttons)
   - New Extraction → `/extractions/new`
   - New Task → Opens `CreateTaskModal` (feature-gated)
   - Add Restaurant → `/restaurants` with modal or `/restaurants/new`
   - View Leads → `/leads` (feature-gated)

---

## Implementation Approach

### Phase 1: Structure
- Convert Dashboard.jsx to Dashboard.tsx
- Add feature flag imports and checks
- Restructure layout with new grid system

### Phase 2: Feature Sections
- Add ReportsTabContent (or simplified version)
- Add PendingLeadsPreview component
- Add BatchRegistrationPreview component
- Add TasksDueTodayList component
- Add RecentRestaurantsPreview component

### Phase 3: Quick Actions
- Update quick action buttons
- Add CreateTaskModal with state
- Wire up feature-gated visibility

### Phase 4: Polish
- Loading states with Skeleton
- Error handling
- Responsive design verification
- Browser testing at localhost:5007

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/Dashboard.jsx` | Major update (or convert to TSX) |

## Files to Create (if needed)

| File | Purpose |
|------|---------|
| `src/hooks/useTasksDueToday.ts` | Query for tasks due today |
| `src/hooks/useRecentRestaurants.ts` | Query for recent restaurants |
| `src/components/dashboard/PendingLeadsPreview.tsx` | Compact leads preview |
| `src/components/dashboard/BatchRegistrationPreview.tsx` | Compact batches preview |
| `src/components/dashboard/TasksDueTodayList.tsx` | Tasks due today list |
| `src/components/dashboard/RecentRestaurantsPreview.tsx` | Recent restaurants list |

## Imports Required

```tsx
// Feature flags
import { useAuth } from '../context/AuthContext';

// Reports
import ReportsTabContent from '../components/reports/ReportsTabContent';

// Tasks
import CreateTaskModal from '../components/tasks/CreateTaskModal';

// Data hooks
import { usePendingLeads } from '../hooks/useLeadScrape';
import { useRegistrationBatches } from '../hooks/useRegistrationBatch';
```

---

## Browser Verification Checklist

At `localhost:5007`:
1. [ ] Dashboard loads without errors
2. [ ] Stats cards display correctly
3. [ ] Reports tab shows (if leadScraping enabled)
4. [ ] Pending leads preview shows data
5. [ ] Batch registration preview shows data
6. [ ] Tasks due today list works
7. [ ] Recent restaurants displays
8. [ ] Quick actions navigate correctly
9. [ ] New Task modal opens and submits
10. [ ] Feature-gated sections hide when disabled
