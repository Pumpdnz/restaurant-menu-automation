# Ralph Loop: dashboard-update-v2

## Configuration

| Setting | Value |
|---------|-------|
| Ralph Loop Directory | `.claude/data/ralph-loops/dashboard-update-v2` |
| Project Directory | `/Users/giannimunro/Desktop/cursor-projects/automation` |
| Frontend Directory | `UberEats-Image-Extractor` |
| Frontend Port | `5007` |
| Backend Port | `3007` |
| Max Iterations | `30` |

**IMPORTANT:** The dev server must be running BEFORE starting the Ralph Loop. The init.sh script only verifies - it does NOT start the server.

## Key Files (READ THESE FIRST)

| File | Path | Purpose |
|------|------|---------|
| Progress | `.claude/data/ralph-loops/dashboard-update-v2/progress.txt` | Current iteration state |
| Features | `.claude/data/ralph-loops/dashboard-update-v2/feature_list.json` | All features and pass status |
| Init Script | `.claude/data/ralph-loops/dashboard-update-v2/init.sh` | Environment setup |

---

## Task Definition

Update the Dashboard page (`UberEats-Image-Extractor/src/pages/Dashboard.jsx`) with new report and navigation components:

1. **Remove:** 4 stats cards (Active Restaurants, Total Menus, Extractions, Success Rate) - not displaying real data
2. **Fix:** Lead Scraping reports - replace Card-wrapped CityBreakdownTab with ReportsTabContent, add feature flag
3. **Add:** Pending Leads preview (5 most recent at step 4, status "passed") with feature flag
4. **Add:** Recent Batch Registration Jobs preview with feature flag
5. **Add:** Paginated Tasks Due Today list with feature flag
6. **Add:** Recently Created Restaurants preview with city filter
7. **Modify:** Quick Actions - move to top, add "New Task" button with CreateTaskModal dialog
8. **Fix:** Recent Restaurants and Recent Extractions to work consistently

## Technical Context

### Feature Flag System
- Access via `useAuth()` hook: `const { isFeatureEnabled } = useAuth();`
- Keys:
  - `leadScraping` - Lead Scraping components
  - `tasksAndSequences` - Tasks/Sequences components
  - `registrationBatches` - Automation/Registration Batches

### Data Fetching
- Create new hooks file: `/UberEats-Image-Extractor/src/hooks/useDashboard.ts`
- Hooks needed: `useRecentRestaurants`, `usePendingLeadsPreview`, `useRecentRegistrationBatches`, `useTasksDueToday`, `useOverdueTasksCount`
- Backend needs: New `GET /api/restaurants/recent` endpoint

### UI Patterns
- **Lead Scraping Fix:** Use `ReportsTabContent` directly (no Card wrapper) - it provides its own tabs
- **Preview Tables:** Follow Template A pattern from `INVESTIGATION_PREVIEW_COMPONENTS.md`
- **Task Dialog:** Import `CreateTaskModal`, use with `open`, `onClose`, `onSuccess` props

### Investigation Documents
All detailed implementation guidance is in:
- `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_DASHBOARD_STRUCTURE.md`
- `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_DATA_QUERIES.md`
- `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_FEATURE_FLAGS.md`
- `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_TASK_DIALOG.md`
- `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_UI_PATTERNS.md`
- `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_PREVIEW_COMPONENTS.md`

## Implementation Steps

Follow the features in `feature_list.json` in priority order:

1. **Setup (Feature 1):** Create useDashboard.ts hooks file
2. **Backend (Feature 2):** Add /api/restaurants/recent endpoint
3. **UI Removal (Feature 3):** Remove stats cards
4. **UI Fix (Feature 4):** Fix Lead Scraping reports with ReportsTabContent + feature flag
5. **UI Add (Features 5-8):** Add preview components (Pending Leads, Batch Jobs, Tasks, Restaurants)
6. **UI Update (Feature 9):** Update Quick Actions with New Task dialog
7. **Fixes (Features 10-11):** Fix intermittent data loading issues
8. **Verification (Feature 12):** Final E2E verification

## Testing & Verification

### Method: Combined (Browser + Build)

Each feature requires:
1. **Build verification:** `npm run build` must pass
2. **Browser verification:** Navigate to `http://localhost:5007` and verify visually

### Browser Verification Steps
1. Navigate to http://localhost:5007
2. Verify component renders correctly
3. Test interactive elements (tabs, buttons, pagination, filters)
4. Check feature flag behavior (components hidden when flag disabled)
5. Check browser console for errors

### Verification Checklist
- [ ] Stats cards are removed
- [ ] Lead Scraping reports show tabs (City Breakdown, Opportunities)
- [ ] Lead Scraping section hidden when leadScraping flag disabled
- [ ] Pending Leads preview shows 5 leads with View All link
- [ ] Batch Jobs preview shows recent batches
- [ ] Tasks Due Today list is paginated
- [ ] Recently Created Restaurants has working city filter
- [ ] Quick Actions at top with working New Task button
- [ ] New Task dialog opens and can create tasks
- [ ] Recent Restaurants loads consistently
- [ ] Recent Extractions loads consistently
- [ ] No console errors

---

## Session Start Procedure (MANDATORY)

Every iteration MUST begin with these steps:

1. `pwd` - Confirm working directory is `/Users/giannimunro/Desktop/cursor-projects/automation`
2. Read `.claude/data/ralph-loops/dashboard-update-v2/progress.txt` - Understand current state
3. Read `.claude/data/ralph-loops/dashboard-update-v2/feature_list.json` - See all features and their status
4. `git log --oneline -10` - Review recent work
5. Run `bash .claude/data/ralph-loops/dashboard-update-v2/init.sh` - Verify dev server is running on port 5007
6. **CRITICAL: Run basic E2E test BEFORE any new work**
   - Navigate to `http://localhost:5007` and verify app loads
   - If baseline test fails, FIX IT FIRST
   - Do NOT proceed to new features with broken baseline
7. Choose highest-priority feature where `passes: false`
8. Begin implementation

---

## CRITICAL: One Feature Per Iteration

Work on EXACTLY ONE feature per iteration. Do not:
- Attempt to implement multiple features
- Make "while I'm here" additional changes
- Premature optimization
- Refactoring beyond the current feature

After completing ONE feature:
1. Verify it works (browser test at `http://localhost:5007`)
2. Update `.claude/data/ralph-loops/dashboard-update-v2/feature_list.json`: set `passes: true`
3. Commit with descriptive message
4. Update `.claude/data/ralph-loops/dashboard-update-v2/progress.txt`
5. Exit iteration

---

## Clean State on Exit (MANDATORY)

Before ending this iteration, ensure:
- [ ] No half-implemented code remains
- [ ] All changes are committed with descriptive messages
- [ ] No major bugs introduced
- [ ] Code is orderly and documented
- [ ] Next session can immediately start on next feature

---

## Iteration Workflow

1. Follow Session Start Procedure above
2. Implement ONE feature
3. Run verification (build + browser test at `http://localhost:5007`)
4. Update `.claude/data/ralph-loops/dashboard-update-v2/feature_list.json`: change `passes: false` to `passes: true`
5. Log session ID: Run `/get-session-id` and include the returned ID in progress.txt
6. Update `.claude/data/ralph-loops/dashboard-update-v2/progress.txt` with results (include session ID, feature worked on, outcome)
7. Git commit with descriptive message
8. If ALL features pass: output `<promise>dashboard-update-v2 COMPLETE</promise>`
9. Exit cleanly - the orchestrator will automatically spawn the next iteration

## Completion Signal

When ALL features in `.claude/data/ralph-loops/dashboard-update-v2/feature_list.json` have `passes: true`, output:

```
<promise>dashboard-update-v2 COMPLETE</promise>
```

## Constraints
- Do NOT skip verification steps
- Do NOT mark frontend features as passing without browser verification
- Do NOT modify feature definitions in `.claude/data/ralph-loops/dashboard-update-v2/feature_list.json` (only `passes` field)
- Do NOT exceed 30 iterations
- If stuck on same issue for 3+ iterations, document blocker clearly in `.claude/data/ralph-loops/dashboard-update-v2/progress.txt`
