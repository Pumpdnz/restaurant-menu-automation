# Dashboard Structure Investigation

## File Location
`/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/pages/Dashboard.jsx`

---

## 1. Complete Component Hierarchy

```
Dashboard (default export)
├── Loading State (conditional)
│   ├── Header (h1 + p)
│   ├── Stats Grid Skeletons (4x Skeleton)
│   └── Content Grid Skeletons (2x Skeleton)
│
└── Main Content (when loaded)
    ├── Page Header
    │   ├── h1 "Dashboard"
    │   └── p (description)
    │
    ├── Stats Grid (4 cards)
    │   ├── Active Restaurants Card
    │   ├── Total Menus Card
    │   ├── Extractions Card
    │   └── Success Rate Card
    │
    ├── Two-Column Content Grid
    │   ├── Recent Restaurants Card
    │   │   ├── CardHeader (title + "View all" link)
    │   │   └── CardContent (list of 5 restaurants)
    │   │
    │   └── Recent Extractions Card
    │       ├── CardHeader (title + "View all" link)
    │       └── CardContent (list of extractions)
    │
    ├── City Breakdown Card (full-width)
    │   ├── CardHeader (title)
    │   └── CardContent
    │       └── CityBreakdownTab component
    │
    ├── Quick Actions Card (full-width)
    │   ├── CardHeader (title)
    │   └── CardContent (3-button grid)
    │       ├── "New Extraction" Link
    │       ├── "Manage Restaurants" Link
    │       └── "View Analytics" Link
    │
    └── CreateLeadScrapeJob Dialog (hidden until triggered)
```

---

## 2. Current Imports List

### React & Router
```javascript
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
```

### Data Fetching
```javascript
import { useQuery } from '@tanstack/react-query';
```

### Icons (Lucide React)
```javascript
import {
  Store,
  Download,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight
} from 'lucide-react';
```

### API Services
```javascript
import { restaurantAPI, extractionAPI, analyticsAPI } from '../services/api';
```

### Utilities
```javascript
import { cn, formatDate, getRelativeTime } from '../lib/utils';
```

### UI Components
```javascript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
```

### Feature Components
```javascript
import { CreateLeadScrapeJob } from '../components/leads/CreateLeadScrapeJob';
import { CityBreakdownTab } from '../components/reports/CityBreakdownTab';
```

---

## 3. State Management Approach

### Local State (useState)
```javascript
// Dialog state for CreateLeadScrapeJob
const [createJobOpen, setCreateJobOpen] = useState(false);
const [prefillScrapeData, setPrefillScrapeData] = useState({
  city: undefined,
  cuisine: undefined,
  pageOffset: undefined,
});
```

### Server State (React Query)
| Query Key | API Call | Returns | Default |
|-----------|----------|---------|---------|
| `['restaurants']` | `restaurantAPI.getAll()` | Array of restaurants | `[]` |
| `['recent-extractions']` | `extractionAPI.getAll({ limit: 5 })` | Array of extractions | `[]` |
| `['extraction-stats']` | `analyticsAPI.getExtractionStats()` | Stats object | `{}` |

### Derived State
```javascript
const isLoading = restaurantsLoading || extractionsLoading || statsLoading;
const safeRestaurants = Array.isArray(restaurants) ? restaurants : [];
const activeRestaurants = safeRestaurants.filter(r => r.status === 'active').length;
const totalMenus = safeRestaurants.reduce((sum, r) => sum + (r.menu_count || 0), 0);
const successRate = stats?.success_rate || 0;
const totalExtractions = stats?.total_extractions || 0;
```

---

## 4. Grid Layout Structure

### Main Container
```jsx
<div className="space-y-6">
```

### Stats Grid (4-column responsive)
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 4 stat cards */}
</div>
```

### Two-Column Content Grid
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Recent Restaurants Card */}
  {/* Recent Extractions Card */}
</div>
```

### Full-Width Cards
- City Breakdown Card (no grid, full width)
- Quick Actions Card (no grid, full width)

### Quick Actions Internal Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* 3 action buttons */}
</div>
```

---

## 5. API Integration Points

### 1. Restaurants API
```javascript
const { data: restaurants = [], isLoading: restaurantsLoading, error: restaurantsError } = useQuery({
  queryKey: ['restaurants'],
  queryFn: async () => {
    const response = await restaurantAPI.getAll();
    return Array.isArray(response.data) ? response.data : [];
  }
});
```

### 2. Extractions API
```javascript
const { data: recentExtractions = [], isLoading: extractionsLoading, error: extractionsError } = useQuery({
  queryKey: ['recent-extractions'],
  queryFn: async () => {
    const response = await extractionAPI.getAll({ limit: 5 });
    return Array.isArray(response.data) ? response.data : [];
  }
});
```

### 3. Analytics API
```javascript
const { data: stats = {}, isLoading: statsLoading, error: statsError } = useQuery({
  queryKey: ['extraction-stats'],
  queryFn: async () => {
    const response = await analyticsAPI.getExtractionStats();
    return response.data || {};
  }
});
```

---

## 6. Styling Patterns

### Brand Colors Used
| Color | Usage |
|-------|-------|
| `text-brand-blue` | Active restaurants stat, links |
| `text-brand-green` | Total menus stat, success status |
| `text-brand-purple` | Extractions stat, City Breakdown title |
| `text-brand-orange` | Success rate stat |
| `text-brand-red` | Failed status |
| `text-brand-yellow` | Processing status |

### Card Styling Pattern
```jsx
<Card className="backdrop-blur-sm bg-background/95 border-border">
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Stat Card Pattern
```jsx
<Card className={cn(
  "border backdrop-blur-sm bg-background/95 hover:shadow-lg transition-all duration-200",
  stat.borderColor // e.g., "border-brand-blue/20"
)}>
  <CardContent className="p-6">
    <div className="flex items-center">
      <div className={cn("rounded-lg p-3", stat.bgColor)}>
        <Icon className={cn("h-6 w-6", stat.color)} />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
        <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
      </div>
    </div>
  </CardContent>
</Card>
```

### List Item Pattern (Restaurants/Extractions)
```jsx
<Link className="block px-6 py-4 hover:bg-accent/50 transition-all duration-200">
  <div className="flex items-center justify-between">
    <div>{/* Left content */}</div>
    <div className="text-right">{/* Right content */}</div>
  </div>
</Link>
```

### Primary Button Pattern (Gradient)
```jsx
className="flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 transition-all duration-200 shadow-lg"
```

### Secondary Button Pattern
```jsx
className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200"
```

---

## 7. Helper Functions

### getStatusIcon(status)
Returns appropriate icon based on extraction status:
- `completed` -> CheckCircle (green)
- `failed` -> XCircle (red)
- `processing` -> Clock (yellow, animated)
- default -> AlertCircle (muted)

### handleStartScrape(city, cuisine, pageOffset)
Callback passed to CityBreakdownTab to trigger the CreateLeadScrapeJob dialog with prefilled data.

---

## 8. Component Props & Communication

### CityBreakdownTab Props
```javascript
<CityBreakdownTab
  filters={{}}
  onStartScrape={handleStartScrape}  // Callback with (city, cuisine, pageOffset)
/>
```

### CreateLeadScrapeJob Props
```javascript
<CreateLeadScrapeJob
  open={createJobOpen}
  onClose={() => { /* reset state */ }}
  prefillCity={prefillScrapeData.city}
  prefillCuisine={prefillScrapeData.cuisine}
  prefillPageOffset={prefillScrapeData.pageOffset}
/>
```

---

## 9. Loading State Pattern

The Dashboard uses a skeleton-based loading pattern:
1. Shows title/description immediately
2. Displays skeleton placeholders matching final layout
3. Switches to real content when `isLoading` becomes false

```jsx
if (isLoading) {
  return (
    <div className="space-y-6">
      <div>{/* Header always visible */}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
```

---

## 10. Key Observations for Implementation

1. **Consistent Card Pattern**: All sections use the same Card component with consistent styling
2. **Responsive Breakpoints**: Uses `md:` (768px) and `lg:` (1024px) breakpoints
3. **Color System**: Uses brand color variables with opacity modifiers
4. **Transitions**: Consistent `transition-all duration-200` for hover effects
5. **List Items as Links**: Both restaurant and extraction lists render as clickable Link components
6. **Dialog Pattern**: Uses controlled dialog with open/onClose pattern for CreateLeadScrapeJob
7. **Empty States**: Both lists have empty state messages when no data
8. **Safety Checks**: Extensive null/undefined checking with fallbacks
