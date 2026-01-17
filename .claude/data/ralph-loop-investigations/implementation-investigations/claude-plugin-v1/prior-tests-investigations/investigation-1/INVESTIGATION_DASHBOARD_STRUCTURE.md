# Dashboard Structure Investigation

> **STATUS: ✅ COMPLETE** - Recommendations implemented via Ralph Loop (2026-01-15)
> CityBreakdownTab placed between Recent Activity grid and Quick Actions, wrapped in Card with brand-purple styling.

## Overview
Investigation of `/UberEats-Image-Extractor/src/pages/Dashboard.jsx` to understand the current structure, styling patterns, and optimal placement for a city breakdown table.

---

## Current Dashboard Layout

### Layout Structure Diagram
```
+----------------------------------------------------------+
|  Page Header                                              |
|  - h1: "Dashboard" (text-2xl font-bold text-foreground)   |
|  - p: description (text-sm text-muted-foreground)         |
+----------------------------------------------------------+
|                                                           |
|  Stats Grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)  |
|  +----------+ +----------+ +----------+ +----------+     |
|  | Active   | | Total    | | Extract- | | Success  |     |
|  | Restaur- | | Menus    | | ions     | | Rate     |     |
|  | ants     | |          | |          | |          |     |
|  +----------+ +----------+ +----------+ +----------+     |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  Two-Column Grid (grid-cols-1 lg:grid-cols-2)            |
|  +-------------------------+ +-------------------------+ |
|  |  Recent Restaurants     | |  Recent Extractions     | |
|  |  - List with links      | |  - List with status     | |
|  |  - Platform badges      | |  - Platform badges      | |
|  |  - Menu count           | |  - Item count           | |
|  +-------------------------+ +-------------------------+ |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  Quick Actions Card (full-width)                         |
|  +--------------------------------------------------+   |
|  |  grid-cols-1 md:grid-cols-3                      |   |
|  |  [New Extraction] [Manage Restaurants] [Analytics]|   |
|  +--------------------------------------------------+   |
|                                                           |
+----------------------------------------------------------+
```

### Container Structure
- Root: `<div className="space-y-6">`
- All sections use `space-y-6` (24px vertical gap)

---

## Card Component Patterns

### 1. Stat Cards (Top Stats Grid)
```jsx
<Card
  className={cn(
    "border backdrop-blur-sm bg-background/95 hover:shadow-lg transition-all duration-200",
    stat.borderColor  // e.g., "border-brand-blue/20"
  )}
>
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

**Color Patterns Used:**
| Color | Border | Background | Icon |
|-------|--------|------------|------|
| Blue | `border-brand-blue/20` | `bg-brand-blue/10` | `text-brand-blue` |
| Green | `border-brand-green/20` | `bg-brand-green/10` | `text-brand-green` |
| Purple | `border-brand-purple/20` | `bg-brand-purple/10` | `text-brand-purple` |
| Orange | `border-brand-orange/20` | `bg-brand-orange/10` | `text-brand-orange` |

### 2. List Cards (Recent Restaurants/Extractions)
```jsx
<Card className="backdrop-blur-sm bg-background/95 border-border">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Card Title</CardTitle>
      <Link className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors">
        View all
        <ArrowRight className="ml-1 h-4 w-4" />
      </Link>
    </div>
  </CardHeader>
  <CardContent className="p-0">
    <div className="divide-y divide-border">
      {/* List items */}
    </div>
  </CardContent>
</Card>
```

### 3. List Item Pattern
```jsx
<Link
  to={`/path/${id}`}
  className="block px-6 py-4 hover:bg-accent/50 transition-all duration-200"
>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-foreground">{name}</p>
      <Badge variant="outline" className="mt-1">
        {platform}
      </Badge>
    </div>
    <div className="text-right">
      <p className="text-sm text-foreground">{count} items</p>
      <p className="text-xs text-muted-foreground">{relativeTime}</p>
    </div>
  </div>
</Link>
```

### 4. Quick Actions Card
```jsx
<Card className="backdrop-blur-sm bg-background/95 border-border">
  <CardHeader>
    <CardTitle>Quick Actions</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Primary action button */}
      <Link className="flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 transition-all duration-200 shadow-lg">
        <Icon className="mr-2 h-4 w-4" />
        Action
      </Link>
      {/* Secondary action buttons */}
      <Link className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200">
        <Icon className="mr-2 h-4 w-4" />
        Action
      </Link>
    </div>
  </CardContent>
</Card>
```

---

## Existing Analytics Integration

### API Services Used
```jsx
import { restaurantAPI, extractionAPI, analyticsAPI } from '../services/api';
```

### Current Analytics Query
```jsx
const { data: stats = {}, isLoading: statsLoading } = useQuery({
  queryKey: ['extraction-stats'],
  queryFn: async () => {
    const response = await analyticsAPI.getExtractionStats();
    return response.data || {};
  }
});
```

### Analytics API Endpoint
From `/services/api.js`:
```javascript
export const analyticsAPI = {
  getExtractionStats: () => api.get('/analytics/extraction-stats'),
};
```

---

## Import Patterns

### Current Dashboard Imports
```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Store, Download, FileText, TrendingUp,
  Clock, AlertCircle, CheckCircle, XCircle, ArrowRight
} from 'lucide-react';
import { restaurantAPI, extractionAPI, analyticsAPI } from '../services/api';
import { cn, formatDate, getRelativeTime } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
```

### Additional Imports for Table-Based Components
Based on `CityBreakdownTab.tsx` pattern:
```jsx
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { MapPin, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
```

---

## Recommended Placement for City Breakdown Table

### Option A: New Section After Two-Column Grid (Recommended)
**Location:** Between the Recent Restaurants/Extractions grid and Quick Actions card.

**Rationale:**
1. Follows the visual flow: Summary stats -> Recent activity -> Geographic breakdown -> Actions
2. Geographic data is a natural extension of the analytics already shown
3. Full-width card gives room for the table to breathe
4. Maintains the hierarchy: quick overview first, detailed breakdown later

**Code Structure:**
```jsx
{/* After the grid-cols-2 section, before Quick Actions */}
<Card className="backdrop-blur-sm bg-background/95 border-border">
  <CardHeader className="flex flex-row items-center justify-between py-3">
    <div className="flex items-center gap-2">
      <MapPin className="h-5 w-5 text-brand-purple" />
      <CardTitle className="text-base">City Breakdown</CardTitle>
    </div>
    <Button variant="outline" size="sm">
      <Download className="h-4 w-4 mr-1" />
      Export CSV
    </Button>
  </CardHeader>
  <CardContent className="p-0">
    <Table>
      {/* Table content */}
    </Table>
  </CardContent>
</Card>
```

### Option B: Replace Quick Actions
**Not recommended** - Quick Actions provides valuable navigation shortcuts.

### Option C: Add as Tab to a Tabbed Analytics Section
**Consider for future** - If more analytics views are added, could create a tabbed interface.

---

## Styling Classes Summary

### Container Classes
| Purpose | Classes |
|---------|---------|
| Root container | `space-y-6` |
| Stats grid | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` |
| Two-column grid | `grid grid-cols-1 lg:grid-cols-2 gap-6` |
| Three-column grid | `grid grid-cols-1 md:grid-cols-3 gap-4` |

### Card Classes
| Type | Classes |
|------|---------|
| Base card | `backdrop-blur-sm bg-background/95 border-border` |
| Stat card | `border backdrop-blur-sm bg-background/95 hover:shadow-lg transition-all duration-200` |
| Card header with actions | `flex flex-row items-center justify-between py-3` |
| Card content for tables | `p-0` |

### Typography Classes
| Element | Classes |
|---------|---------|
| Page title | `text-2xl font-bold text-foreground` |
| Page description | `text-sm text-muted-foreground` |
| Card title | `text-base` (via CardTitle with override) |
| Stat title | `text-sm font-medium text-muted-foreground` |
| Stat value | `text-2xl font-semibold text-foreground` |
| Table header | `text-left align-middle font-medium text-muted-foreground` |
| Table cell | `p-4 align-middle` |

### Button Classes
| Type | Classes |
|------|---------|
| Primary gradient | `bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 transition-all duration-200 shadow-lg` |
| Outline | `border border-border text-foreground bg-background hover:bg-accent transition-all duration-200` |
| Link-style | `text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors` |

### Loading State Classes
| Element | Classes |
|---------|---------|
| Skeleton stats | `h-32 rounded-lg` |
| Skeleton cards | `h-96 rounded-lg` |
| Animated spinner | `animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue` |

---

## Required Modifications

### 1. Add New API Endpoint
Add to `analyticsAPI` in `/services/api.js`:
```javascript
getCityBreakdown: () => api.get('/analytics/city-breakdown'),
```

### 2. Add New Query to Dashboard
```jsx
const { data: cityBreakdown = [], isLoading: cityLoading } = useQuery({
  queryKey: ['city-breakdown'],
  queryFn: async () => {
    const response = await analyticsAPI.getCityBreakdown();
    return response.data || [];
  }
});
```

### 3. Update Loading State
Add `cityLoading` to the combined loading check:
```jsx
const isLoading = restaurantsLoading || extractionsLoading || statsLoading || cityLoading;
```

### 4. Add Loading Skeleton
```jsx
{/* In loading state, after the two-column grid skeletons */}
<Skeleton className="h-64 rounded-lg" />
```

---

## Component Structure Recommendation

Consider creating a separate component for reusability:
```
/src/components/dashboard/CityBreakdownCard.jsx
```

This keeps the Dashboard.jsx file clean and allows the city breakdown to be potentially reused elsewhere.

---

## Summary

The Dashboard follows a consistent pattern:
1. **Page header** with title and description
2. **Stats grid** with colored stat cards (4-column on desktop)
3. **Two-column grid** for recent activity cards
4. **Full-width action card** at the bottom

The city breakdown table should be inserted as a **new full-width Card** between the two-column grid and Quick Actions, following the established Card patterns with:
- Glass-morphism styling (`backdrop-blur-sm bg-background/95`)
- Header with title and action button
- `p-0` CardContent for table
- Standard Table component from ui/table
- Brand color accents (recommend `brand-purple` for geographic/location theme)
