# Investigation: Data Queries & API Patterns

## Overview

This document details the existing data fetching patterns in the codebase and specifies the new queries needed for the Dashboard Update v2 project's preview components.

## 1. Existing Query Patterns

### 1.1 React Query Configuration

The codebase uses **@tanstack/react-query** for all data fetching. Key patterns observed:

```typescript
// Standard query pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['unique-key', filters],
  queryFn: async () => {
    const response = await api.get('/endpoint', { params });
    return response.data;
  },
  refetchInterval: 30000, // Optional: for real-time updates
  staleTime: 5 * 60 * 1000, // Optional: cache duration
});
```

### 1.2 API Service Layer

Located at: `/UberEats-Image-Extractor/src/services/api.js`

- Uses Axios with auth interceptor (adds Bearer token from Supabase session)
- Adds `X-Organization-ID` header for multi-tenant filtering
- Base URL: `/api` (proxied through Netlify)

### 1.3 Existing Data Fetching in Dashboard

**File:** `/UberEats-Image-Extractor/src/pages/Dashboard.jsx`

```javascript
// Current Dashboard queries:

// 1. Restaurants - fetches ALL restaurants (no limit)
const { data: restaurants } = useQuery({
  queryKey: ['restaurants'],
  queryFn: async () => {
    const response = await restaurantAPI.getAll();
    return Array.isArray(response.data) ? response.data : [];
  }
});

// 2. Recent Extractions - already has limit
const { data: recentExtractions } = useQuery({
  queryKey: ['recent-extractions'],
  queryFn: async () => {
    const response = await extractionAPI.getAll({ limit: 5 });
    return Array.isArray(response.data) ? response.data : [];
  }
});

// 3. Extraction Stats
const { data: stats } = useQuery({
  queryKey: ['extraction-stats'],
  queryFn: async () => {
    const response = await analyticsAPI.getExtractionStats();
    return response.data || {};
  }
});
```

---

## 2. Existing Hooks Reference

### 2.1 Restaurant Queries

**File:** `/UberEats-Image-Extractor/src/hooks/useRestaurants.ts`

```typescript
export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      const response = await api.get('/restaurants/list');
      return response.data.restaurants || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

**API Endpoints (server.js):**
- `GET /api/restaurants` - Full restaurant list
- `GET /api/restaurants/list` - Lightweight list for tables
- `GET /api/restaurants/switcher` - Minimal list for dropdown

### 2.2 Lead Scrape Queries

**File:** `/UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

```typescript
// Get all lead scrape jobs with filtering
export function useLeadScrapeJobs(filters: LeadScrapeJobFilters = {}) {
  return useQuery({
    queryKey: ['lead-scrape-jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      // ... build params from filters
      const response = await api.get(`/lead-scrape-jobs?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000,
  });
}

// Get pending leads (step 4, status "passed")
export function usePendingLeads(filters: PendingLeadsFilters = {}) {
  return useQuery({
    queryKey: ['pending-leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      // ... build params
      const response = await api.get(`/leads/pending?${params.toString()}`);
      return response.data;
    },
  });
}
```

### 2.3 Registration Batch Queries

**File:** `/UberEats-Image-Extractor/src/hooks/useRegistrationBatch.ts`

```typescript
// List batches with filtering
export function useRegistrationBatches(filters: RegistrationBatchFilters = {}) {
  return useQuery({
    queryKey: ['registration-batches', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      // ... build params
      const response = await api.get(`/registration-batches?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000,
  });
}
```

### 2.4 Task Queries

**File:** `/UberEats-Image-Extractor/src/pages/Tasks.tsx`

Current implementation fetches ALL tasks via direct API call:
```javascript
const fetchTasks = async () => {
  const response = await api.get('/tasks');
  setTasks(response.data.tasks || []);
};
```

**API Endpoint (tasks-routes.js):**
- `GET /api/tasks` - List tasks with filters
- `GET /api/tasks/overdue` - Overdue tasks
- `GET /api/tasks/upcoming` - Tasks due in next 7 days

---

## 3. Required New Queries for Dashboard Components

### 3.1 Recently Created Restaurants (for preview component)

**New Hook:** `useRecentRestaurants`

```typescript
// New hook to add to useRestaurants.ts or create dedicated file

export function useRecentRestaurants(limit: number = 5) {
  return useQuery({
    queryKey: ['recent-restaurants', limit],
    queryFn: async () => {
      const response = await api.get('/restaurants/recent', {
        params: { limit }
      });
      return response.data.restaurants || [];
    },
    staleTime: 30000, // 30 seconds
  });
}
```

**Required Backend Endpoint:** `GET /api/restaurants/recent`

```javascript
// Add to server.js
app.get('/api/restaurants/recent', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;

  const { data, error } = await db.supabase
    .from('restaurants')
    .select('id, name, city, created_at, onboarding_status, lead_stage')
    .eq('organisation_id', req.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  res.json({ success: true, restaurants: data });
});
```

### 3.2 Pending Leads Count (for preview component)

**New Hook:** `usePendingLeadsPreview`

```typescript
export function usePendingLeadsPreview(limit: number = 5) {
  return useQuery({
    queryKey: ['pending-leads-preview', limit],
    queryFn: async () => {
      const response = await api.get('/leads/pending', {
        params: { limit }
      });
      return {
        leads: response.data.leads || [],
        total: response.data.pagination?.total || 0
      };
    },
    staleTime: 30000,
  });
}
```

**Existing Endpoint Works:** `GET /api/leads/pending`
- Already supports `limit` parameter
- Returns leads at step 4 with status "passed"
- Includes pagination with total count

### 3.3 Recent Registration Batches (for preview component)

**New Hook:** `useRecentRegistrationBatches`

```typescript
export function useRecentRegistrationBatches(limit: number = 5) {
  return useQuery({
    queryKey: ['recent-registration-batches', limit],
    queryFn: async () => {
      const response = await api.get('/registration-batches', {
        params: {
          limit,
          sort_by: 'created_at',
          sort_direction: 'desc'
        }
      });
      return response.data.batch_jobs || [];
    },
    refetchInterval: 30000, // For progress updates
  });
}
```

**Existing Endpoint Works:** `GET /api/registration-batches`
- Already supports `limit`, `sort_by`, `sort_direction`

### 3.4 Tasks Due Today (for preview component)

**New Hook:** `useTasksDueToday`

```typescript
export function useTasksDueToday(limit: number = 5) {
  return useQuery({
    queryKey: ['tasks-due-today', limit],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await api.get('/tasks', {
        params: {
          status: 'active',
          due_after: today.toISOString(),
          due_before: tomorrow.toISOString(),
          sort_by: 'due_date',
          sort_order: 'asc'
        }
      });

      const tasks = response.data.tasks || [];
      return {
        tasks: tasks.slice(0, limit),
        total: tasks.length
      };
    },
    staleTime: 60000, // 1 minute
  });
}
```

**Existing Endpoint Works:** `GET /api/tasks`
- Supports `due_after`, `due_before`, `status` filters
- NOTE: No server-side limit, must slice client-side or add limit param

**Recommended Backend Enhancement:**
```javascript
// Update tasks-routes.js to support limit
router.get('/', authMiddleware, async (req, res) => {
  const filters = {
    // ... existing filters
    limit: req.query.limit ? parseInt(req.query.limit) : undefined
  };
  // ... rest of handler
});
```

### 3.5 Overdue Tasks Count (for alert badge)

**New Hook:** `useOverdueTasksCount`

```typescript
export function useOverdueTasksCount() {
  return useQuery({
    queryKey: ['overdue-tasks-count'],
    queryFn: async () => {
      const response = await api.get('/tasks/overdue');
      return {
        count: (response.data.tasks || []).length,
        tasks: response.data.tasks || []
      };
    },
    refetchInterval: 60000, // 1 minute
  });
}
```

**Existing Endpoint Works:** `GET /api/tasks/overdue`

---

## 4. Dashboard Hooks File Structure

**Recommended:** Create a new hooks file for dashboard-specific queries.

**File:** `/UberEats-Image-Extractor/src/hooks/useDashboard.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// Recently created restaurants
export function useRecentRestaurants(limit: number = 5) { ... }

// Pending leads preview
export function usePendingLeadsPreview(limit: number = 5) { ... }

// Recent registration batches
export function useRecentRegistrationBatches(limit: number = 5) { ... }

// Tasks due today
export function useTasksDueToday(limit: number = 5) { ... }

// Overdue tasks count
export function useOverdueTasksCount() { ... }

// Dashboard summary stats (combine multiple queries)
export function useDashboardSummary() {
  const restaurants = useRecentRestaurants(5);
  const pendingLeads = usePendingLeadsPreview(5);
  const batches = useRecentRegistrationBatches(5);
  const tasksDueToday = useTasksDueToday(5);
  const overdueTasks = useOverdueTasksCount();

  return {
    isLoading: restaurants.isLoading || pendingLeads.isLoading ||
               batches.isLoading || tasksDueToday.isLoading,
    restaurants: restaurants.data,
    pendingLeads: pendingLeads.data,
    batches: batches.data,
    tasksDueToday: tasksDueToday.data,
    overdueTasks: overdueTasks.data,
  };
}
```

---

## 5. Query Keys Reference

For React Query cache invalidation, use these consistent keys:

| Query | Key Pattern | Invalidation Trigger |
|-------|-------------|---------------------|
| Recent Restaurants | `['recent-restaurants', limit]` | Restaurant created/updated |
| Pending Leads | `['pending-leads-preview', limit]` | Lead converted/deleted |
| Registration Batches | `['recent-registration-batches', limit]` | Batch created/updated |
| Tasks Due Today | `['tasks-due-today', limit]` | Task created/completed |
| Overdue Tasks | `['overdue-tasks-count']` | Task completed/rescheduled |

---

## 6. Required Backend Changes Summary

| Endpoint | Change Type | Description |
|----------|-------------|-------------|
| `GET /api/restaurants/recent` | **NEW** | Lightweight recent restaurants endpoint |
| `GET /api/tasks` | **UPDATE** | Add `limit` query parameter support |
| `GET /api/leads/pending` | None | Already supports required params |
| `GET /api/registration-batches` | None | Already supports required params |
| `GET /api/tasks/overdue` | None | Already works as needed |

---

## 7. Type Definitions

```typescript
// Types for dashboard preview components

interface DashboardRestaurant {
  id: string;
  name: string;
  city?: string;
  created_at: string;
  onboarding_status?: string;
  lead_stage?: string;
}

interface DashboardPendingLead {
  id: string;
  restaurant_name: string;
  city?: string;
  created_at: string;
  ubereats_number_of_reviews?: string;
}

interface DashboardBatchJob {
  id: string;
  name: string;
  status: string;
  total_restaurants: number;
  completed_restaurants: number;
  current_step: number;
  created_at: string;
}

interface DashboardTask {
  id: string;
  name: string;
  type: string;
  priority: string;
  due_date: string;
  restaurants?: {
    id: string;
    name: string;
  };
}
```

---

## Summary: Queries Needed Per Component

| Component | Hook | Endpoint | Exists? |
|-----------|------|----------|---------|
| Recently Created Restaurants | `useRecentRestaurants(5)` | `/api/restaurants/recent` | **NEW** |
| Recent Extractions | Already exists in Dashboard | `/api/extractions?limit=5` | Yes |
| Pending Leads Preview | `usePendingLeadsPreview(5)` | `/api/leads/pending?limit=5` | Yes |
| Recent Batch Jobs | `useRecentRegistrationBatches(5)` | `/api/registration-batches?limit=5` | Yes |
| Tasks Due Today | `useTasksDueToday(5)` | `/api/tasks?due_after=...&due_before=...` | Partial* |
| Overdue Tasks Badge | `useOverdueTasksCount()` | `/api/tasks/overdue` | Yes |

*Partial: Endpoint works but limit must be applied client-side unless backend updated.
