# Restaurant Switcher Implementation Plan

## Overview

Add a restaurant switcher dropdown to the RestaurantDetail page header, allowing users to quickly navigate between restaurants without returning to the restaurants list.

## Implementation Status: COMPLETED

---

## Changes Made

### 1. New Database Function

**File:** `src/services/database-service.js`

Added minimal query function that only fetches fields needed for the switcher:

```javascript
async function getRestaurantSwitcherList() {
  const { data } = await client
    .from('restaurants')
    .select('id, name, address, city, onboarding_status')
    .eq('organisation_id', orgId)
    .order('name');
  return data || [];
}
```

**Why:** The original `getAllRestaurants()` and even `getAllRestaurantsList()` endpoints return extensive data including all restaurant fields, platform relationships, and tasks. This is wasteful for the switcher which only needs 5 fields.

### 2. New API Endpoint

**File:** `server.js`

```javascript
app.get('/api/restaurants/switcher', authMiddleware, async (req, res) => {
  const restaurants = await db.getRestaurantSwitcherList();
  return res.json(restaurants);
});
```

**Route:** `GET /api/restaurants/switcher`

**Response:** Array of minimal restaurant objects:
```json
[
  {
    "id": "uuid",
    "name": "Restaurant Name",
    "address": "123 Main St",
    "city": "Wellington",
    "onboarding_status": "lead"
  }
]
```

### 3. New API Method

**File:** `src/services/api.js`

```javascript
export const restaurantAPI = {
  // ... existing methods
  getSwitcherList: () => api.get('/restaurants/switcher'),
};
```

### 4. RestaurantSwitcher Component

**File:** `src/components/restaurants/RestaurantSwitcher.tsx`

New component that provides:
- Clickable restaurant name in header
- Searchable dropdown with all restaurants
- Search by name, address, or city
- Status indicator dots
- Current restaurant highlighted
- Keyboard navigation (built-in from cmdk)

### 5. RestaurantDetail Header Update

**File:** `src/pages/RestaurantDetail.jsx`

- Added import for `RestaurantSwitcher`
- Replaced static `<h1>` with `<RestaurantSwitcher>` component for existing restaurants
- Preserved static header for "Add New Restaurant" flow

---

## Data Efficiency Comparison

| Endpoint | Fields Returned | Includes Relations | Use Case |
|----------|-----------------|-------------------|----------|
| `/api/restaurants` | All (~50+ fields) | Yes (platforms, menus) | Full restaurant data |
| `/api/restaurants/list` | ~30 fields | Yes (platforms, tasks) | Restaurants table |
| `/api/restaurants/switcher` | 5 fields only | No | Switcher dropdown |

The switcher endpoint returns only:
- `id` - For navigation
- `name` - Display in list
- `address` - Display and search
- `city` - Search
- `onboarding_status` - Status dot indicator

---

## Future Enhancements

### Adding Filters (Requires API Changes)

If filters are added to the switcher (e.g., filter by status, city, cuisine), the API endpoint will need to be modified to return additional fields:

**Current fields:** `id, name, address, city, onboarding_status`

**Fields needed for filtering:**

| Filter Type | Additional Fields Required |
|-------------|---------------------------|
| By Status | Already included (`onboarding_status`) |
| By City | Already included (`city`) |
| By Cuisine | Add `cuisine` |
| By Lead Stage | Add `lead_stage` |
| By Assigned Rep | Add `assigned_sales_rep` |

**To add a filter:**

1. Update `getRestaurantSwitcherList()` in `database-service.js`:
   ```javascript
   .select('id, name, address, city, onboarding_status, cuisine, lead_stage')
   ```

2. Update the `Restaurant` interface in `RestaurantSwitcher.tsx`

3. Add filter UI components to the switcher

### Other Potential Enhancements

#### Keyboard Shortcut
Add `Cmd/Ctrl + K` to open the switcher from anywhere on the page.

#### Recent Restaurants Section
Group the dropdown into sections:
- **Recent** (last 5 viewed, stored in localStorage)
- **All Restaurants** (alphabetically sorted)

#### Virtual Scrolling
For organizations with 100+ restaurants, implement virtual scrolling using `@tanstack/react-virtual`.

---

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/services/database-service.js` | Added | `getRestaurantSwitcherList()` function |
| `server.js` | Added | `GET /api/restaurants/switcher` endpoint |
| `src/services/api.js` | Added | `restaurantAPI.getSwitcherList()` method |
| `src/components/restaurants/RestaurantSwitcher.tsx` | Created | New component |
| `src/pages/RestaurantDetail.jsx` | Modified | Header now uses RestaurantSwitcher |

---

## Testing Checklist

- [x] Switcher appears when clicking restaurant name
- [x] Static header preserved for "Add New Restaurant"
- [x] Search filters restaurants by name, address, city
- [x] Clicking a different restaurant navigates correctly
- [x] Clicking current restaurant closes dropdown
- [x] Loading state shows while fetching
- [x] Empty state shows when no results match
- [x] Keyboard navigation works (arrow keys, enter, escape)
- [x] Popover closes when clicking outside
- [x] Status dots show correct colors
- [x] Minimal data fetched (only 5 fields)

---

## Technical Notes

### Caching Strategy
- Cache key: `['restaurants-switcher']` (separate from full restaurant data)
- Stale time: 60 seconds
- This prevents unnecessary refetches while keeping data reasonably fresh

### Why Separate Endpoint?
The existing endpoints were inefficient for this use case:

1. **`/api/restaurants`** - Returns all fields plus platform relationships
2. **`/api/restaurants/list`** - Still returns ~30 fields plus tasks for each restaurant

Creating a dedicated endpoint ensures:
- Minimal network payload
- Faster response times
- No interference with other restaurant data caching
