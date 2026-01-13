/prime planning/yolo-mode-plans/account-setup/phase-4

## Context: Reports Tab Session 9 - Backend Sorting for Pending Leads

We've been implementing a Reports Tab for the Lead Scraping page in the UberEats-Image-Extractor app across multiple sessions.

### Previous Sessions Summary
- Session 2: Initial Reports Tab implementation (5 API endpoints, 11 components)
- Session 3: Added visual page indicators, searchable city/cuisine filters with defaults, top 10 cuisine coverage indicators
- Session 4: Added multi-select priorities, clickable page/cuisine indicators, heatmap improvements, city/cuisine filters on Jobs tab
- Session 5: Added clickable Total Leads column, clickable Processed/Pending stats, URL param support for pending filters
- Session 6: Consolidated Coverage and City Breakdown tabs, added Expand All toggle, clickable status badge dropdown, Current Step filter
- Session 7: Registration Batches improvements (filtering, sorting, 3-column grid)
- Session 8: Fixed Pending Leads tab bugs:
  - Increased default limit from 50 to 500
  - Added pagination UI (50 per page) integrated into table footer
  - Fixed multi-select city/cuisine filters (was only using first value)
  - Fixed response structure mismatch (pagination.total vs total)

---

## Issue for Session 9

### Frontend Sorting Only Applies to Each Paginated Page

**Problem:** The Pending Leads table has client-side sorting (by restaurant name, city, reviews, created date). With pagination now implemented, sorting only applies to the current page of 50 leads, not all 500+ leads. This means the "top" results by reviews might be on page 5, but the user only sees sorted results within page 1.

**Root Cause:** Sorting is done in the frontend (`PendingLeadsTable.tsx`) on the `leads` array that only contains the current page's data.

**Solution Options:**
1. **Move sorting to backend** - Pass sort params to API, sort in database query (recommended)
2. **Fetch all data then paginate client-side** - Less efficient but simpler
3. **Remove sorting when paginated** - Poor UX

**Recommended approach:** Implement backend sorting for pending leads, similar to how it was done for Registration Batches in Session 7.

**Files to investigate/modify:**

| File | Changes Needed |
|------|----------------|
| `src/services/lead-scrape-service.js` | Add `sort_by` and `sort_direction` params to `getPendingLeads()` |
| `src/routes/leads-routes.js` | Pass sort params from query string to service |
| `src/hooks/useLeadScrape.ts` | Update `PendingLeadsFilters` interface, pass sort params in hook |
| `src/pages/LeadScrapes.tsx` | Pass sort state to query filters instead of just to table |
| `src/components/leads/PendingLeadsTable.tsx` | Remove client-side sorting, keep sort UI but delegate to parent |

**Implementation pattern (from Session 7 Registration Batches):**

Backend service example:
```javascript
// Sort handling
const sortColumnMap = {
  'restaurant_name': 'restaurant_name',
  'city': 'city', // This is job city, need to handle join
  'ubereats_number_of_reviews': 'ubereats_number_of_reviews',
  'created_at': 'created_at'
};
const sortColumn = sortColumnMap[filters.sort_by] || 'created_at';
const sortDirection = filters.sort_direction === 'asc' ? true : false;
query = query.order(sortColumn, { ascending: sortDirection });
```

Frontend query filters:
```typescript
const pendingQueryFilters = useMemo(() => ({
  // ...existing filters
  sort_by: pendingSortState[0]?.column,
  sort_direction: pendingSortState[0]?.direction,
}), [pendingFilters, pendingPage, pendingSortState]);
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/services/lead-scrape-service.js` | Backend service with `getPendingLeads` function (line ~1165) |
| `src/routes/leads-routes.js` | API routes including `/leads/pending` endpoint |
| `src/hooks/useLeadScrape.ts` | React Query hooks, `PendingLeadsFilters` interface, sort types |
| `src/pages/LeadScrapes.tsx` | Main page with `pendingSortState` and `pendingQueryFilters` |
| `src/components/leads/PendingLeadsTable.tsx` | Table with `SortableHeader` components, client-side sorting logic |

---

## Notes
- The sort state types (`SortState`, `SortableColumn`, etc.) already exist in `useLeadScrape.ts`
- The `SortableHeader` component in PendingLeadsTable already handles UI for sort direction
- Multi-column sorting is supported in the frontend - decide if backend should support it too
- Reset pagination to page 0 when sort changes (like we do for filters)
- The `city` column sorts by the job's city (from `lead_scrape_jobs` table), not the lead's city field
