# Ralph Loop: dashboard-update-v3

## Configuration

| Setting | Value |
|---------|-------|
| Ralph Loop Directory | `.claude/data/ralph-loops/dashboard-update-v3` |
| Project Directory | `/Users/giannimunro/Desktop/cursor-projects/automation` |
| Frontend Directory | `UberEats-Image-Extractor` |
| Frontend Port | `5007` |
| Backend Port | `3007` |
| Max Iterations | `36` |

**IMPORTANT:** The dev server must be running BEFORE starting the Ralph Loop. The init.sh script only verifies - it does NOT start the server.

## Key Files (READ THESE FIRST)

| File | Path | Purpose |
|------|------|---------|
| Progress | `.claude/data/ralph-loops/dashboard-update-v3/progress.txt` | Current iteration state |
| Features | `.claude/data/ralph-loops/dashboard-update-v3/feature_list.json` | All features and pass status |
| Init Script | `.claude/data/ralph-loops/dashboard-update-v3/init.sh` | Environment setup |

---

## Task Definition

**Dashboard Update V3** - Fix and enhance multiple Dashboard components that weren't completed correctly in the previous Ralph Loop iteration (V2).

### Components to Update

1. **Recent Restaurants + Recent Extractions Area**
   - Remove Recent Extractions component
   - Remove Quick View Recent Restaurants (keep Recently Created)
   - Enhance Recently Created Restaurants with pagination (5 pages, 5 rows)
   - Add Lead Contact popup and Tasks column

2. **Tasks Due Today**
   - Move to top of dashboard (after Quick Actions)
   - When <25 tasks due today, backfill with overdue tasks

3. **Lead Scraping Reports**
   - Fix blue/purple header styling (use text-foreground)
   - Create tabbed component: Heatmap (tab 1, default) + City Table (tab 2)
   - Remove Opportunities tab

4. **Pending Leads Preview**
   - Add Cuisine column (badges)
   - Add Rating column (star + average + review count)
   - Add UberEats link under restaurant name
   - Clickable name to open LeadDetailModal

5. **Batch Jobs Preview**
   - Make rows clickable for navigation
   - Add Restaurants preview column
   - Add Progress bar column

6. **Layout**
   - Two-column grid for Pending Leads + Batch Jobs

## Technical Context

### Primary Files

| File | Purpose |
|------|---------|
| `/UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Main dashboard page |
| `/UberEats-Image-Extractor/src/hooks/useDashboard.ts` | Dashboard data hooks |
| `/UberEats-Image-Extractor/src/components/reports/ReportsTabContent.tsx` | Reports container |
| `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` | Heatmap + table |

### Key Line Numbers in Dashboard.jsx

| Section | Lines |
|---------|-------|
| Recent Restaurants (quick view, REMOVE) | 201-244 |
| Recent Extractions (REMOVE) | 246-298 |
| Lead Scraping Reports | 300-316 |
| Pending Leads Preview | 318-372 |
| Batch Jobs Preview | 374-444 |
| Tasks Due Today | 446-554 |
| Recently Created Restaurants | 556-669 |

### Reusable Components

| Component | Location |
|-----------|----------|
| LeadContactQuickView | `src/components/restaurants/LeadContactQuickView.tsx` |
| TaskCell | `src/components/restaurants/TaskCell.tsx` |
| LeadDetailModal | `src/components/leads/LeadDetailModal.tsx` |
| Progress | `src/components/ui/progress` |

### Feature Flags

- `leadScraping` - Pending Leads, Reports sections
- `registrationBatches` - Batch Jobs section
- `tasksAndSequences` - Tasks Due Today section

## Implementation Steps

### Phase 1: Cleanup (Features 1-2)
1. Remove Recent Extractions and Quick View sections
2. Update useRecentRestaurants hook to return additional fields

### Phase 2: Recent Restaurants Enhancement (Features 3-4)
3. Add pagination to Recently Created Restaurants
4. Add Lead Contact and Tasks columns

### Phase 3: Tasks Due Today (Feature 5)
5. Move to top of dashboard with overdue fallback logic

### Phase 4: Reports Restructuring (Features 6-8)
6. Fix header styling
7. Create tabbed Heatmap/City Table
8. Remove Opportunities tab

### Phase 5: Pending Leads + Batch Jobs (Features 9-11)
9. Enhance Pending Leads preview
10. Enhance Batch Jobs with navigation
11. Create two-column grid

### Phase 6: Verification (Feature 12)
12. Final E2E verification

## Testing & Verification

### Method: Combined (Build + Browser)

**Build Verification:**
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor
npm run build
```
Must pass with no TypeScript/lint errors.

**Browser Verification:**
1. Use Claude in Chrome tools
2. Navigate to http://localhost:5007
3. Test each feature as described in feature_list.json

To verify UI features, use these MCP tools:
- `mcp__claude-in-chrome__tabs_context_mcp` - Get browser tab context at session start
- `mcp__claude-in-chrome__navigate` - Navigate to the dev server URL
- `mcp__claude-in-chrome__computer` with `action: "screenshot"` - Capture visual state
- `mcp__claude-in-chrome__find` - Locate elements by description
- `mcp__claude-in-chrome__read_console_messages` - Check for JavaScript errors

### Verification Checklist

- [ ] Build passes (no TypeScript/lint errors)
- [ ] Recent Extractions removed
- [ ] Quick View Recent Restaurants removed
- [ ] Recently Created Restaurants has pagination (5 pages, 5 rows)
- [ ] Lead Contact column works with popup
- [ ] Tasks column works with TaskCell
- [ ] Tasks Due Today at top of dashboard
- [ ] Overdue tasks shown when due today < 25
- [ ] Lead Scraping header is not purple (uses text-foreground)
- [ ] Heatmap/City Table tabs work (heatmap default)
- [ ] Opportunities tab removed
- [ ] Pending Leads has Cuisine, Rating, UberEats link columns
- [ ] Batch Jobs rows clickable for navigation
- [ ] Batch Jobs has restaurants preview and progress bar
- [ ] Pending Leads + Batch Jobs in two-column grid
- [ ] No console errors

### Important: Do NOT Skip Verification

- For UI/frontend features: You MUST use browser verification tools to confirm the feature works
- Simply reading the code is NOT sufficient verification for UI features
- Take screenshots to document that features render correctly
- Check the browser console for JavaScript errors after testing

---

## Session Start Procedure (MANDATORY)

Every iteration MUST begin with these steps:

1. `pwd` - Confirm working directory is `/Users/giannimunro/Desktop/cursor-projects/automation`
2. Read `.claude/data/ralph-loops/dashboard-update-v3/progress.txt` - Understand current state
3. Read `.claude/data/ralph-loops/dashboard-update-v3/feature_list.json` - See all features and their status
4. `git log --oneline -10` - Review recent work
5. Run `bash .claude/data/ralph-loops/dashboard-update-v3/init.sh` - Verify dev server is running on port 5007
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
2. Update `.claude/data/ralph-loops/dashboard-update-v3/feature_list.json`: set `passes: true`
3. Commit with descriptive message
4. Update `.claude/data/ralph-loops/dashboard-update-v3/progress.txt`
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
4. Update `.claude/data/ralph-loops/dashboard-update-v3/feature_list.json`: change `passes: false` to `passes: true`
5. Log session ID: Run `/get-session-id` and include the returned ID in progress.txt
6. Update `.claude/data/ralph-loops/dashboard-update-v3/progress.txt` with results (include session ID, feature worked on, outcome)
7. Git commit (see Git Commit Instructions below)
8. If ALL features pass: output `<promise>dashboard-update-v3 COMPLETE</promise>`
9. Exit cleanly - the orchestrator will automatically spawn the next iteration

---

## Git Commit Instructions

**Important:** This project has code in a subdirectory and state files at the project root.

| Type | Location |
|------|----------|
| App code | `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/` |
| State files | `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/data/ralph-loops/dashboard-update-v3/` |

**Always commit from the project root directory:**

```bash
# Ensure you're at project root
cd /Users/giannimunro/Desktop/cursor-projects/automation

# Stage app code changes (use relative path from project root)
git add UberEats-Image-Extractor/src/path/to/changed/file.tsx

# Stage state file updates
git add .claude/data/ralph-loops/dashboard-update-v3/progress.txt
git add .claude/data/ralph-loops/dashboard-update-v3/feature_list.json

# Commit all together
git commit -m "feat(Dashboard): Description of feature implemented"
```

**Do NOT:**
- Run `git add` from inside `UberEats-Image-Extractor/` when also committing state files
- Use relative paths like `../.claude/data/...` - always use paths relative to project root

---

## Completion Signal

When ALL features in `.claude/data/ralph-loops/dashboard-update-v3/feature_list.json` have `passes: true`, output:

```
<promise>dashboard-update-v3 COMPLETE</promise>
```

## Constraints
- Do NOT skip verification steps
- Do NOT mark frontend features as passing without browser verification
- Do NOT modify feature definitions in `.claude/data/ralph-loops/dashboard-update-v3/feature_list.json` (only `passes` field)
- Do NOT exceed 36 iterations
- If stuck on same issue for 3+ iterations, document blocker clearly in `.claude/data/ralph-loops/dashboard-update-v3/progress.txt`

---

## Investigation Reference Documents

These documents contain detailed analysis from the investigation phase:

| Document | Content |
|----------|---------|
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_1.md` | Recent Restaurants + Tasks Due Today analysis |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_2.md` | Lead Scraping Reports restructuring |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_3.md` | Pending Leads preview enhancements |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_4.md` | Batch Jobs + grid layout |
