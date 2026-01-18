# Dashboard Update V3 - E2E Verification Checklist

## Session Info
- Session ID: 16d77729-16a8-4649-ad30-d9113dcc55b7
- Date: 2026-01-18
- Iteration: 12/36

## Build Status
✅ **PASSED** - Build completed successfully with no TypeScript/lint errors

## Manual Browser Testing Checklist

### Prerequisites
- [ ] Navigate to http://localhost:5007
- [ ] Login to the application
- [ ] Navigate to Dashboard page
- [ ] Verify no console errors on page load

---

### Feature 1-2: Section Removal ✅
**Expected:** Recent Extractions and Quick View Recent Restaurants should not be visible

- [ ] Confirm Recent Extractions section is not present
- [ ] Confirm Quick View Recent Restaurants section is not present
- [ ] Only "Recently Created Restaurants" section remains

---

### Feature 3-4: Recently Created Restaurants ✅
**Expected:** Pagination (5 pages, 5 rows) + Lead Contact + Tasks columns

**Pagination:**
- [ ] Table shows exactly 5 rows per page
- [ ] Pagination controls visible at bottom
- [ ] Page 1/X indicator present
- [ ] Previous button disabled on first page
- [ ] Next button works to navigate to page 2
- [ ] Previous button works to go back to page 1
- [ ] Next button disabled on last page

**Lead Contact Column:**
- [ ] "Lead Contact" column header present
- [ ] LeadContactQuickView component renders for each row
- [ ] Clicking contact info opens popup with details
- [ ] Popup shows name, email, phone, address

**Tasks Column:**
- [ ] "Tasks" column header present
- [ ] TaskCell component renders for each row
- [ ] Shows task count or "No tasks" state
- [ ] Clicking opens task details/actions

---

### Feature 5: Tasks Due Today ✅
**Expected:** Moved to top after Quick Actions + overdue fallback

**Position:**
- [ ] Section appears immediately after "Quick Actions"
- [ ] Section appears before "Lead Scraping Reports"

**Overdue Fallback:**
- [ ] If <25 tasks due today, overdue tasks are shown
- [ ] Section title shows "Overdue & Due Today" when overdue included
- [ ] Badge shows correct count
- [ ] Most recent overdue tasks shown first

---

### Feature 6: Lead Scraping Header ✅
**Expected:** Header color is text-foreground (not purple)

- [ ] "Lead Scraping Reports" header visible
- [ ] Header color matches other section headers (not purple)
- [ ] Text is readable and properly styled

---

### Feature 7-8: Lead Scraping Reports Tabs ✅
**Expected:** Heatmap/City Table tabs + no Opportunities tab

**Tab Structure:**
- [ ] Two tabs visible: "Heatmap" and "City Table"
- [ ] "Heatmap" tab is selected by default
- [ ] Heatmap visualization displays correctly
- [ ] Clicking "City Table" tab switches view
- [ ] Table view shows city breakdown data
- [ ] Export CSV button visible only on City Table tab
- [ ] **NO "Opportunities" tab present**

**Summary Stats:**
- [ ] Summary stats section visible outside tabs
- [ ] Shows total leads, avg per city, etc.

---

### Feature 9: Pending Leads Preview ✅
**Expected:** Cuisine + Rating + UberEats link columns

**Cuisine Column:**
- [ ] "Cuisine" column header present
- [ ] Shows up to 2 cuisine badges
- [ ] Shows "+N more" badge if more than 2 cuisines
- [ ] Badges styled correctly

**Rating Column:**
- [ ] "Rating" column header present
- [ ] Shows star icon
- [ ] Shows average rating number
- [ ] Shows review count in parentheses
- [ ] Format: ⭐ 4.5 (1,234 reviews)

**Restaurant Name:**
- [ ] Restaurant name is clickable/styled as link
- [ ] Clicking name opens LeadDetailModal
- [ ] Modal displays lead details correctly

**UberEats Link:**
- [ ] UberEats platform link visible under restaurant name
- [ ] Link styled with external link icon
- [ ] Clicking opens UberEats URL in new tab

**Created Column:**
- [ ] Uses formatDistanceToNow (e.g., "2 hours ago")

---

### Feature 10: Batch Jobs Preview ✅
**Expected:** Clickable rows + Restaurants preview + Progress bar

**Row Navigation:**
- [ ] Rows have hover effect (cursor-pointer)
- [ ] Clicking row navigates to /registration-batches/:id
- [ ] URL updates correctly
- [ ] Batch detail page loads

**Restaurants Column:**
- [ ] "Restaurants" column header present
- [ ] Shows first 2-3 restaurant names
- [ ] Shows "+N more" if more restaurants
- [ ] Text truncates properly if needed

**Progress Bar Column:**
- [ ] "Progress" column header present
- [ ] Progress component renders
- [ ] Shows percentage visually (colored bar)
- [ ] Shows percentage text (e.g., "45%")

**Current Step Column:**
- [ ] "Current Step" column present
- [ ] Shows step number and name
- [ ] Format clear (e.g., "Step 3: Menu Import")

---

### Feature 11: Two-Column Grid ✅
**Expected:** Pending Leads + Batch Jobs in grid layout

**Grid Layout:**
- [ ] On desktop (lg breakpoint), sections appear side-by-side
- [ ] Both sections have equal height
- [ ] Gap between columns is consistent (gap-6)
- [ ] Both cards have backdrop-blur-sm styling
- [ ] Both cards have border-border styling

**Responsive:**
- [ ] On mobile/tablet, sections stack vertically (single column)
- [ ] Resize browser to verify responsive behavior

**Feature Flags:**
- [ ] Grid only shows sections if feature flags enabled
- [ ] If leadScraping disabled, Pending Leads hidden
- [ ] If registrationBatches disabled, Batch Jobs hidden
- [ ] Grid handles single-section display correctly

---

## Console Errors
- [ ] Open browser DevTools console
- [ ] Verify no errors on page load
- [ ] Verify no errors when interacting with features
- [ ] Verify no warnings about missing props/keys

---

## Final Verification

**All Features Working:**
- [ ] All 11 features verified and working correctly
- [ ] No regressions introduced
- [ ] Dashboard loads quickly and smoothly
- [ ] All interactions work as expected

**Code Quality:**
- [ ] Build passes with no errors
- [ ] No console errors or warnings
- [ ] Code is clean and maintainable
- [ ] Feature flags respected

---

## Completion Criteria

✅ All checkboxes above are checked
✅ Build passes
✅ No console errors
✅ All 11 features verified working

**Status:** PENDING MANUAL VERIFICATION

---

## Notes

This checklist should be used to manually verify all Dashboard features in the browser at http://localhost:5007. Each feature has specific acceptance criteria that must be met before marking the feature as passing.

Once all checkboxes are verified, update feature_list.json Feature 12 with `passes: true` and output the completion signal.
