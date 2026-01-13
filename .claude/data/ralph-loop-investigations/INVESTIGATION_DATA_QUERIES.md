# Investigation: Data Queries and Hooks

## Overview
Dashboard needs to fetch: pending leads (step 4, status "passed"), recent registration batches, tasks due today, recently created restaurants.

## Query Summary Table

| Entity | Query Method | Data Source | Filtering | Pagination | Sorting |
|--------|--------------|-------------|-----------|-----------|---------|
| Pending Leads | Hook (`usePendingLeads`) | `/leads/pending` | API-side | Yes (offset/limit) | Client-side |
| Registration Batches | Hook (`useRegistrationBatches`) | `/registration-batches` | API-side | No | API-side |
| Tasks | Direct API (no hook) | `/tasks` | Client-side | No | Client-side |
| Restaurants | Direct API (no hook) | `/restaurants/list` | Client-side | No | Client-side |

## 1. Pending Leads Queries

**Location:** `src/hooks/useLeadScrape.ts`
**Hook:** `usePendingLeads(filters)`

**Endpoint:** `GET /leads/pending?search=...&platform=...&city=...&cuisine=...&limit=...&offset=...`

**Table:** `leads` (filtered by `step_progression_status = 'passed'`)

**Key Columns:**
- `id`, `restaurant_name`, `store_link`, `platform`, `city`, `region`
- `ubereats_number_of_reviews`, `ubereats_average_review_rating`
- `phone`, `email`, `website_url`, `instagram_url`, `facebook_url`
- `contact_name`, `contact_email`, `contact_phone`
- `created_at`, `updated_at`

**Filter Options:** Search, Platform, City, Cuisine, Pagination

## 2. Registration Batches Queries

**Location:** `src/hooks/useRegistrationBatch.ts`
**Hook:** `useRegistrationBatches(filters)`

**Endpoint:** `GET /registration-batches?status=...&search=...&current_step=...`

**Tables:**
- `registration_batch_jobs` (main)
- `registration_jobs` (sub-table with restaurants)

**Key Columns:**
- `id`, `name`, `status`, `total_restaurants`, `completed_restaurants`, `failed_restaurants`
- `current_step`, `created_at`, `started_at`, `completed_at`

**Status Options:** pending, in_progress, completed, failed, cancelled

## 3. Tasks Queries

**Location:** Direct API fetch in `Tasks.tsx`
**Endpoint:** `GET /tasks`

**Table:** `tasks`

**Key Columns:**
- `id`, `name`, `description`, `type`, `status`, `priority`
- `due_date`, `assigned_to`, `restaurant_id`
- Relationship: `restaurants` (with lead info)

**Filter Options (Client-Side):**
- Status: active, pending, completed, cancelled
- Type: internal_activity, email, call, social_message, text
- Priority: low, medium, high
- Due Date: overdue, today, week, month, no_date, custom range

## 4. Restaurants Queries

**Location:** `src/pages/Restaurants.jsx`
**Endpoint:** `GET /restaurants/list`

**Table:** `restaurants`

**Key Columns:**
- `id`, `name`, `city`, `address`, `contact_name`, `contact_email`
- `lead_type`, `lead_category`, `lead_warmth`, `lead_stage`, `lead_status`
- `demo_store_built`, `icp_rating`, `last_contacted`, `created_at`
- `restaurant_platforms` (array)

## Existing Hooks to Reuse

### From `useLeadScrape.ts`
- ✅ `usePendingLeads()` - Already fetches step 4, passed leads
- ✅ `usePendingLeadsFilterOptions()` - City and cuisine filters

### From `useRegistrationBatch.ts`
- ✅ `useRegistrationBatches()` - Recent batches with filtering
- ✅ `useRegistrationBatchProgress()` - Lightweight polling for progress

### General Hooks
- ✅ `useCityCodes()` - City dropdown data
- ✅ `useCuisines()` - Cuisine dropdown data

## Queries to Create/Enhance

### Tasks Preview Query
Need: Tasks due today with limit
```typescript
// New hook needed
const useTasksDueToday = (limit?: number) => {
  return useQuery({
    queryKey: ['tasks-due-today', limit],
    queryFn: () => tasksAPI.getTasksDueToday({ limit })
  });
};
```

### Restaurants Recently Created Query
Need: Recent restaurants with limit and city filter
```typescript
// New hook needed
const useRecentRestaurants = (options: { limit?: number; city?: string }) => {
  return useQuery({
    queryKey: ['recent-restaurants', options],
    queryFn: () => restaurantAPI.getRecent(options)
  });
};
```

### Dashboard Stats Query
Consider: Aggregated dashboard-specific stats
```typescript
// Optional - for dashboard stats cards
const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.getStats()
  });
};
```

## API Endpoints Needed

Based on existing patterns, new endpoints may be needed:
1. `GET /tasks/due-today?limit=10` - Tasks filtered by due date
2. `GET /restaurants/recent?limit=5&city=...` - Recently created restaurants
3. Or use existing endpoints with additional query params

## React Query Configuration

Current pattern from Dashboard.jsx:
```javascript
useQuery({
  queryKey: ['key'],
  queryFn: fetchFunction,
  staleTime: 5 * 60 * 1000,    // 5 minutes
  gcTime: 10 * 60 * 1000,      // 10 minutes
  retry: 1,
  refetchOnMount: true,
  refetchOnWindowFocus: false
});
```
