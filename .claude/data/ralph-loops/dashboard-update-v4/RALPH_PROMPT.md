# Ralph Loop: dashboard-update-v4

## Configuration

| Setting | Value |
|---------|-------|
| Ralph Loop Directory | `.claude/data/ralph-loops/dashboard-update-v4` |
| Project Directory | `/Users/giannimunro/Desktop/cursor-projects/automation` |
| Frontend Directory | `UberEats-Image-Extractor` |
| Frontend Port | `5007` |
| Backend Port | `3007` |
| Max Iterations | `36` |

**IMPORTANT:** The dev server must be running BEFORE starting the Ralph Loop. The init.sh script only verifies - it does NOT start the server.

## Key Files (READ THESE FIRST)

| File | Path | Purpose |
|------|------|---------|
| Progress | `.claude/data/ralph-loops/dashboard-update-v4/progress.txt` | Current iteration state |
| Features | `.claude/data/ralph-loops/dashboard-update-v4/feature_list.json` | All features and pass status |
| Init Script | `.claude/data/ralph-loops/dashboard-update-v4/init.sh` | Environment setup |

---

## Task Definition

Implement fixes to the Dashboard page across 6 areas:
1. **Quick Actions** - Feature flag wrapping and button conversions
2. **Tasks Due Today** - Full-featured table with interactive components
3. **Recent Restaurants** - Start Sequence fix, columns, toggleable status
4. **Pending Leads** - Multi-select, collapsible drawers, action buttons
5. **Recent Batch Jobs** - Clickable truncated restaurant names
6. **Layout Grid** - Reorganize components into 2-column grid

## Technical Context

### Primary File
- `UberEats-Image-Extractor/src/pages/Dashboard.jsx` (810 lines)

### Reference Files
| File | Purpose |
|------|---------|
| `src/pages/Tasks.tsx` | Full task table features (status toggle, priority dropdown, action buttons) |
| `src/pages/Restaurants.jsx` | Restaurant columns, badge helpers, TaskCell usage |
| `src/components/tasks/TaskTypeQuickView.tsx` | Task type popover component |
| `src/components/tasks/TaskDetailModal.tsx` | Task detail modal |
| `src/components/leads/PendingLeadsTable.tsx` | Multi-select, collapsible rows pattern |
| `src/components/sequences/StartSequenceModal.tsx` | Sequence modal |

### Investigation Documents
Detailed implementation guidance in:
- `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_QUICK_ACTIONS.md`
- `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_TASKS_TABLE.md`
- `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_RECENT_RESTAURANTS.md`
- `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_PENDING_LEADS.md`
- `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_BATCH_JOBS.md`
- `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_VALIDATION.md`

### Feature Flags
- `tasksAndSequences` - Controls Tasks section and New Task button
- `leadScraping` - Controls Pending Leads section
- `registrationBatches` - Controls Recent Batch Jobs section

### Key Patterns
- Feature flag: `{isFeatureEnabled('flagName') && (...)}`
- Status toggle: Select component with badge styling
- Popover: Radix UI Popover with click trigger
- Collapsible: Radix UI Collapsible with animation

## Implementation Steps

See `feature_list.json` for ordered features. Each feature has detailed steps.

**Order of Implementation:**
1. Quick Actions (features 1-2) - Simple UI changes
2. Tasks Due Today (features 3-7) - Complex table enhancements
3. Recent Restaurants (features 8-10) - Fix and enhance
4. Pending Leads (feature 11) - Add advanced features
5. Recent Batch Jobs (feature 12) - Simple popover addition

---

## Testing & Verification

### Method: Combined

**Browser Verification:**
1. Use Chrome DevTools MCP tools (NOT Claude in Chrome - those don't work in spawned sessions)
2. Navigate to http://localhost:5007
3. Test each feature as described in feature_list.json

To verify UI features, use these MCP tools:
- `mcp__chrome-devtools__list_pages` - List available Chrome pages/tabs
- `mcp__chrome-devtools__navigate_page` - Navigate to the dev server URL
- `mcp__chrome-devtools__take_screenshot` - Capture visual state
- `mcp__chrome-devtools__evaluate_script` - Run JavaScript to find/interact with elements
- `mcp__chrome-devtools__list_console_messages` - Check for JavaScript errors

**Build Verification:**
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor
npm run build
```
Must pass with no TypeScript/lint errors.

### Verification Checklist

**Quick Actions:**
- [ ] New Task button hidden when `tasksAndSequences` flag disabled
- [ ] New Task button visible with orange-coral gradient when enabled
- [ ] New Restaurant button navigates to /restaurants/new
- [ ] New Restaurant button has purple-blue gradient
- [ ] Buttons flex correctly for 2 or 3 buttons

**Tasks Due Today:**
- [ ] Status toggle changes task status via API
- [ ] Task name is clickable and opens TaskDetailModal
- [ ] Task description shows below name
- [ ] Due date editor allows changing dates
- [ ] Overdue dates show in red
- [ ] Priority dropdown allows changing priority
- [ ] Task type shows popover with TaskTypeQuickView
- [ ] Action dropdown shows for active tasks
- [ ] Mark Complete, Follow-up, Start Sequence options work

**Recent Restaurants:**
- [ ] Start Sequence from TaskCell dropdown opens modal
- [ ] Start Sequence from TaskTypeQuickView opens modal
- [ ] Lead Type, Lead Category, Lead Status columns show
- [ ] Onboarding status badge is toggleable
- [ ] Section positioned in 2-column grid position 1

**Pending Leads:**
- [ ] Expand toggle shows/hides drawer
- [ ] Checkbox selects/deselects lead
- [ ] Bulk actions bar appears when items selected
- [ ] View button opens LeadDetailModal
- [ ] Convert button triggers conversion

**Recent Batch Jobs:**
- [ ] "+N" badge is clickable
- [ ] Popover shows full restaurant list
- [ ] Restaurants are clickable links

### Important: Do NOT Skip Verification

- For UI/frontend features: You MUST use Chrome DevTools MCP tools to verify the feature works
- Simply reading the code is NOT sufficient verification for UI features
- Use `mcp__chrome-devtools__take_screenshot` to document that features render correctly
- Use `mcp__chrome-devtools__list_console_messages` to check for JavaScript errors
- **Note:** Claude in Chrome tools do NOT work in spawned sessions - use Chrome DevTools MCP instead

---

## Session Start Procedure (MANDATORY)

Every iteration MUST begin with these steps:

1. `pwd` - Confirm working directory is `/Users/giannimunro/Desktop/cursor-projects/automation`
2. Read `.claude/data/ralph-loops/dashboard-update-v4/progress.txt` - Understand current state
3. Read `.claude/data/ralph-loops/dashboard-update-v4/feature_list.json` - See all features and their status
4. `git log --oneline -10` - Review recent work
5. Run `bash .claude/data/ralph-loops/dashboard-update-v4/init.sh` - Verify dev server is running on port 5007
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
2. Update `.claude/data/ralph-loops/dashboard-update-v4/feature_list.json`: set `passes: true`
3. Commit with descriptive message
4. Update `.claude/data/ralph-loops/dashboard-update-v4/progress.txt`
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
4. Update `.claude/data/ralph-loops/dashboard-update-v4/feature_list.json`: change `passes: false` to `passes: true`
5. Log session ID: Run `/get-session-id` and include the returned ID in progress.txt
6. Update `.claude/data/ralph-loops/dashboard-update-v4/progress.txt` with results (include session ID, feature worked on, outcome)
7. Git commit (see Git Commit Instructions below)
8. If ALL features pass: output `<promise>dashboard-update-v4 COMPLETE</promise>`
9. Exit cleanly - the orchestrator will automatically spawn the next iteration

---

## Git Commit Instructions

**Important:** This project has code in a subdirectory and state files at the project root.

| Type | Location |
|------|----------|
| App code | `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/` |
| State files | `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/data/ralph-loops/dashboard-update-v4/` |

**Always commit from the project root directory:**

```bash
# Ensure you're at project root
cd /Users/giannimunro/Desktop/cursor-projects/automation

# Stage app code changes (use relative path from project root)
git add UberEats-Image-Extractor/src/pages/Dashboard.jsx

# Stage state file updates
git add .claude/data/ralph-loops/dashboard-update-v4/progress.txt
git add .claude/data/ralph-loops/dashboard-update-v4/feature_list.json

# Commit all together
git commit -m "feat(Dashboard): Description of feature implemented"
```

**Do NOT:**
- Run `git add` from inside `UberEats-Image-Extractor/` when also committing state files
- Use relative paths like `../.claude/data/...` - always use paths relative to project root

---

## Completion Signal

When ALL features in `.claude/data/ralph-loops/dashboard-update-v4/feature_list.json` have `passes: true`, output:

```
<promise>dashboard-update-v4 COMPLETE</promise>
```

## Constraints
- Do NOT skip verification steps
- Do NOT mark frontend features as passing without browser verification
- Do NOT modify feature definitions in `.claude/data/ralph-loops/dashboard-update-v4/feature_list.json` (only `passes` field)
- Do NOT exceed 36 iterations
- If stuck on same issue for 3+ iterations, document blocker clearly in `.claude/data/ralph-loops/dashboard-update-v4/progress.txt`
