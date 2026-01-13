/prime planning/yolo-mode-plans/account-setup/phase-4

## Context: Reports Tab Session 8 - Pending Leads Tab Bug Fixes

We've been implementing a Reports Tab for the Lead Scraping page in the UberEats-Image-Extractor app across multiple sessions.

### Previous Sessions Summary
- Session 2: Initial Reports Tab implementation (5 API endpoints, 11 components)
- Session 3: Added visual page indicators, searchable city/cuisine filters with defaults, top 10 cuisine coverage indicators
- Session 4: Added multi-select priorities, clickable page/cuisine indicators, heatmap improvements, city/cuisine filters on Jobs tab
- Session 5: Added clickable Total Leads column, clickable Processed/Pending stats, URL param support for pending filters
- Session 6: Consolidated Coverage and City Breakdown tabs, added Expand All toggle, clickable status badge dropdown, Current Step filter
- Session 7: Created `/continue-session` skill for streamlined session handoff

---

## Tasks for Session 8

### Task 1: Pending Leads Tab has a 50 record limit
**Problem:** The Pending Leads tab appears to be limited to 50 records, even when there are more pending leads available.

**Files to investigate:**
- `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx` - Check pendingLeadsFilters state and pagination
- `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts` - Check `usePendingLeads` hook query params and `PendingLeadsFilters` interface
- `UberEats-Image-Extractor/src/services/lead-scrape-service.js` - Check `getPendingLeads` function default limit
- `UberEats-Image-Extractor/src/routes/lead-scrape-routes.js` - Check the pending leads endpoint

**What to check:**
- Is there a hardcoded limit of 50?
- Is pagination implemented correctly?
- Should the limit be increased or should pagination UI be added?

### Task 2: Multi-select Cities Filter only filtering by first city
**Problem:** When multiple cities are selected in the Pending Leads tab filter, only the first selected city is being used for filtering.

**Files to investigate:**
- `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx` - Check how `pendingFilters.city` is being handled (is it storing array or single string?)
- `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts` - Check `PendingLeadsFilters` interface and `usePendingLeads` hook
- `UberEats-Image-Extractor/src/services/lead-scrape-service.js` - Check `getPendingLeads` function city filter logic

**What to check:**
- Is the city filter storing an array or a single string?
- Is the backend handling comma-separated city values correctly?
- Compare with how the Jobs tab handles multi-select city filtering (this was updated in Session 6)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/pages/LeadScrapes.tsx` | Main page with Jobs, Pending Leads, and Reports tabs |
| `src/hooks/useLeadScrape.ts` | React Query hooks including `usePendingLeads` |
| `src/services/lead-scrape-service.js` | Backend service with `getPendingLeads` function |
| `src/routes/lead-scrape-routes.js` | API routes including pending leads endpoint |

---

## Notes
- The Jobs tab city filter was updated in Session 6 to support multi-select with comma-separated values, so compare its implementation
- The `PendingLeadsFilters` interface may need to be updated to support arrays for city/cuisine (like `LeadScrapeJobFilters` was updated)
- Check if there's pagination UI that should be showing but isn't, or if we need to add it
