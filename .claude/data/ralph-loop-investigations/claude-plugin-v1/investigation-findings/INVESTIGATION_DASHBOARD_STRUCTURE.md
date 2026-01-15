# Investigation: Dashboard Structure

## Overview
The current Dashboard at `UberEats-Image-Extractor/src/pages/Dashboard.jsx` is a functional React component displaying system overview data with stats, recent activity, and quick action buttons. Uses React Query for data fetching and shadcn/ui for UI.

## Imports Analysis

### React & Router
- `React` - Base React library
- `Link` from `react-router-dom` - Navigation between pages

### Data Fetching
- `useQuery` from `@tanstack/react-query` - Server state management with caching

### Icons (lucide-react)
- `Store`, `Download`, `FileText`, `TrendingUp` - Stat card icons
- `Clock`, `AlertCircle`, `CheckCircle`, `XCircle` - Status indicators
- `ArrowRight` - Navigation indicator

### APIs
- `restaurantAPI` - Get all restaurants data
- `extractionAPI` - Get recent extractions (limit: 5)
- `analyticsAPI` - Get extraction statistics

### Utilities
- `cn` - Tailwind CSS class merging (clsx + twMerge)
- `formatDate`, `getRelativeTime` - Date formatting utilities

### UI Components (shadcn/ui)
- `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- `Badge` - Status badges with variants
- `Skeleton` - Loading placeholders

## Component Structure & Layout

### Page Header
- Title: "Dashboard"
- Subtitle: "Overview of your restaurant menu extraction system"

### Stats Grid (Responsive)
- 4 stat cards: 1 col (mobile), 2 cols (tablet), 4 cols (desktop)
- Each card: icon, title, value
- Colors: brand-blue, brand-green, brand-purple, brand-orange
- Hover shadow effect with backdrop blur

### Two-Column Section
- "Recent Restaurants" card - Top 5 restaurants
- "Recent Extractions" card - Top 5 extractions

### Quick Actions Section
- 3 gradient/bordered buttons in responsive grid
- 1 col (mobile), 3 cols (desktop)

## React Query Hooks

1. **Restaurants Query:** `['restaurants']` → `restaurantAPI.getAll()`
2. **Recent Extractions Query:** `['recent-extractions']` → `extractionAPI.getAll({ limit: 5 })`
3. **Stats Query:** `['extraction-stats']` → `analyticsAPI.getExtractionStats()`

## Current Quick Action Buttons

| Button | Icon | Path | Style |
|--------|------|------|-------|
| New Extraction | Download | `/extractions/new` | Gradient (blue→green) |
| Manage Restaurants | Store | `/restaurants` | Bordered |
| View Analytics | TrendingUp | `/analytics` | Bordered |

## Feature Flag Usage
- No explicit feature flags in current Dashboard
- App routing uses `FeatureProtectedRoute` for feature gating
- Dashboard wrapped in `ProtectedRoute` (auth-based)

## Parts to Keep vs Remove

### KEEP
- Stat card structure (proven UI pattern)
- React Query integration
- Loading skeletons and empty states
- Card-based layout system
- Icons and brand colors
- Responsive grid layout

### REMOVE/REPLACE
- Generic stat cards → Dashboard-specific metrics
- Basic recent lists → Feature-specific previews
- Current quick action buttons → Updated actions for new features
- Three-button layout → Expanded quick actions
