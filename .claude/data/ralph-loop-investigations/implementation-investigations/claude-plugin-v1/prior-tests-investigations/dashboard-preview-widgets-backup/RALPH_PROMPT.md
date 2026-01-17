# Ralph Loop: Dashboard Preview Widgets

## Configuration

| Setting | Value |
|---------|-------|
| Ralph Loop Directory | `.claude/data/ralph-loops/dashboard-preview-widgets` |
| Project Directory | `/Users/giannimunro/Desktop/cursor-projects/automation` |
| Frontend Directory | `UberEats-Image-Extractor` |
| Frontend Port | `5007` |
| Backend Port | `3007` |
| Max Iterations | `15` |

**IMPORTANT:** The dev server must be running BEFORE starting the Ralph Loop. The init.sh script only verifies - it does NOT start the server.

## Key Files (READ THESE FIRST)

| File | Path | Purpose |
|------|------|---------|
| Progress | `.claude/data/ralph-loops/dashboard-preview-widgets/progress.txt` | Current iteration state |
| Features | `.claude/data/ralph-loops/dashboard-preview-widgets/feature_list.json` | All features and pass status |
| Init Script | `.claude/data/ralph-loops/dashboard-preview-widgets/init.sh` | Environment verification |

---

## Task Definition

Add dashboard preview widgets to the Dashboard page (`UberEats-Image-Extractor/src/pages/Dashboard.jsx`):

1. **Quick Actions** - Add "New Task" button with feature flag
2. **CreateTaskModal** - Wire modal to New Task button
3. **Tasks Due Today** - List tasks due today with pagination
4. **Pending Leads** - Preview widget for pending leads
5. **Batch Registration** - Preview of recent registration batches
6. **Recent Restaurants** - Preview of recently created restaurants
7. **Feature Flag Verification** - Verify limited user sees correct sections

## Technical Context

### Feature Flags
Access via `useAuth()` hook:
```jsx
const { isFeatureEnabled } = useAuth();

// Check flags:
isFeatureEnabled('leadScraping')        // Pending Leads, CityBreakdownTab
isFeatureEnabled('registrationBatches') // Batch Registration
isFeatureEnabled('tasksAndSequences')   // Tasks Due Today, New Task button
```

### Existing Dashboard Structure
The Dashboard already has:
- CityBreakdownTab (from previous Ralph Loop)
- CreateLeadScrapeJob dialog state
- Recent Activity grid
- Quick Actions card

### Component Patterns
Follow existing patterns in the codebase:
- Card with `backdrop-blur-sm bg-background/95 border-border`
- CardHeader with CardTitle
- Supabase queries with `@tanstack/react-query`

---

## Implementation Steps

### Step 1: Quick Actions Update
1. Open `UberEats-Image-Extractor/src/pages/Dashboard.jsx`
2. Locate the Quick Actions card section
3. Add "New Task" button with `ListTodo` icon from lucide-react
4. Wrap in `isFeatureEnabled('tasksAndSequences')` conditional
5. Button should call `setCreateTaskOpen(true)` (state added in Step 2)

### Step 2: CreateTaskModal Integration
1. Import `CreateTaskModal` from `@/components/tasks/CreateTaskModal`
2. Add state: `const [createTaskOpen, setCreateTaskOpen] = useState(false)`
3. Wire New Task button onClick to `setCreateTaskOpen(true)`
4. Render modal: `<CreateTaskModal open={createTaskOpen} onOpenChange={setCreateTaskOpen} />`

### Step 3: Tasks Due Today Component
1. Create `src/components/dashboard/TasksDueTodayList.tsx`
2. Use `useQuery` to fetch tasks where `due_date::date = current_date`
3. Join with `restaurants` table for restaurant name
4. Display: task title, restaurant name, due time
5. Add "View All" link to `/tasks`
6. Import and render in Dashboard with `isFeatureEnabled('tasksAndSequences')` check

### Step 4: Pending Leads Preview
1. Create `src/components/dashboard/PendingLeadsPreview.tsx`
2. Query `leads` where `status = 'pending'`, limit 5
3. Display: restaurant name, city, cuisine, created_at
4. Add "View All" link to `/leads?tab=pending`
5. Import and render with `isFeatureEnabled('leadScraping')` check

### Step 5: Batch Registration Preview
1. Create `src/components/dashboard/BatchRegistrationPreview.tsx`
2. Query `registration_batches` ordered by `created_at desc`, limit 5
3. Display: batch name, status badge, restaurant count, date
4. Add "View All" link to `/registration-batches`
5. Import and render with `isFeatureEnabled('registrationBatches')` check

### Step 6: Recent Restaurants Preview
1. Create `src/components/dashboard/RecentRestaurantsPreview.tsx`
2. Query `restaurants` ordered by `created_at desc`, limit 5
3. Display: restaurant name, city, created date
4. Optional: Add city filter dropdown
5. Add "View All" link to `/restaurants`
6. No feature flag required

### Step 7: Feature Flag Verification
1. Login as `support@pumpd.co.nz` (limited permissions user)
2. Navigate to Dashboard at `http://localhost:5007`
3. Verify feature flag behavior per verification steps below

---

## Testing & Verification

### Method: Combined (Build + Browser Automation)

For each feature:
1. **Build Check**: Run `npm run build` in `UberEats-Image-Extractor/` - must pass with no errors
2. **Browser Verification**: Use Claude in Chrome to navigate to `http://localhost:5007` and verify:
   - Component renders correctly
   - Interactions work (clicks, navigation)
   - No console errors
3. **Feature Flag Check** (Feature 7 only): Login as limited user and verify hidden/shown sections

### Verification Steps

| Feature | Verification |
|---------|-------------|
| 1. Quick Actions | New Task button visible (for enabled users), has correct icon |
| 2. CreateTaskModal | Click New Task → modal opens with form fields |
| 3. Tasks Due Today | List shows tasks due today, "View All" links to /tasks |
| 4. Pending Leads | Preview shows pending leads, "View All" links to /leads?tab=pending |
| 5. Batch Registration | Preview shows recent batches with status badges |
| 6. Recent Restaurants | Preview shows recent restaurants, optional city filter works |
| 7. Feature Flags | support@pumpd.co.nz sees ONLY Tasks Due Today + Recent Restaurants |

---

## Session Start Procedure (MANDATORY)

Every iteration MUST begin with these steps:

1. `pwd` - Confirm working directory
2. Read `.claude/data/ralph-loops/dashboard-preview-widgets/progress.txt`
3. Read `.claude/data/ralph-loops/dashboard-preview-widgets/feature_list.json`
4. `git log --oneline -10` - Review recent work
5. Run `bash .claude/data/ralph-loops/dashboard-preview-widgets/init.sh`
6. **CRITICAL: Run basic E2E test BEFORE any new work**
   - Navigate to `http://localhost:5007` and verify app loads
   - If baseline test fails, FIX IT FIRST
   - Do NOT proceed to new features with broken baseline
7. Choose highest-priority feature where `passes: false`
8. Begin implementation

---

## CRITICAL: One Feature Per Iteration

Work on EXACTLY ONE feature per iteration. Do not:
- Attempt multiple features
- Make "while I'm here" changes
- Premature optimization
- Refactor beyond current feature

After completing ONE feature:
1. Verify it works (browser test at `http://localhost:5007`)
2. Update `.claude/data/ralph-loops/dashboard-preview-widgets/feature_list.json`: set `passes: true`
3. Commit with descriptive message
4. Update `.claude/data/ralph-loops/dashboard-preview-widgets/progress.txt`
5. Exit iteration

---

## Clean State on Exit (MANDATORY)

Before ending this iteration:
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
4. Update `.claude/data/ralph-loops/dashboard-preview-widgets/feature_list.json`: change `passes: false` to `passes: true`
5. Log session ID: Run `/get-session-id` and include the returned ID in progress.txt
6. Update `.claude/data/ralph-loops/dashboard-preview-widgets/progress.txt` with results (include session ID, feature worked on, outcome)
7. Git commit with descriptive message
8. If ALL features pass: output `<promise>DASHBOARD PREVIEW WIDGETS COMPLETE</promise>`
9. Exit cleanly - the orchestrator will automatically spawn the next iteration


## Completion Signal

When ALL features in `.claude/data/ralph-loops/dashboard-preview-widgets/feature_list.json` have `passes: true`, output:

```
<promise>DASHBOARD PREVIEW WIDGETS COMPLETE</promise>
```

## Constraints
- Do NOT skip verification steps
- Do NOT mark frontend features as passing without browser verification
- Do NOT modify feature definitions in `.claude/data/ralph-loops/dashboard-preview-widgets/feature_list.json` (only `passes` field)
- Do NOT exceed 15 iterations
- If stuck on same issue for 3+ iterations, document blocker clearly in `.claude/data/ralph-loops/dashboard-preview-widgets/progress.txt`
