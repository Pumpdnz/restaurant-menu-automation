# Ralph Loop: city-breakdown-dashboard

## Configuration

| Setting | Value |
|---------|-------|
| Ralph Loop Directory | `.claude/data/ralph-loops/city-breakdown-dashboard` |
| Project Directory | `/Users/giannimunro/Desktop/cursor-projects/automation` |
| Frontend Port | `5007` |
| Backend Port | `3007` |
| Max Iterations | `15` |

**IMPORTANT:** The dev server must be running BEFORE starting the Ralph Loop. The init.sh script only verifies - it does NOT start the server.

## Key Files (READ THESE FIRST)

| File | Path | Purpose |
|------|------|---------|
| Progress | `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt` | Current iteration state |
| Features | `.claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json` | All features and pass status |
| Init Script | `.claude/data/ralph-loops/city-breakdown-dashboard/init.sh` | Environment setup |

---

## Task Definition

Add the CityBreakdownTab component from the Lead Scraping Reports tab to the Dashboard page. The table shows lead counts per city with full interactive functionality including:
- Expandable cuisine rows
- Clickable stats that route to lead detail pages
- Top 10 cuisine coverage indicators
- Page indicators (green=scraped, gray=unscraped)
- CSV export functionality
- Full dialog integration for triggering new scrapes

## Technical Context

### Source Component
- **CityBreakdownTab**: `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx`
- Self-contained component, no React Router dependencies
- Uses `window.open()` for all external navigation
- Props: `filters: AnalyticsFilters` (required), `onStartScrape?: callback` (optional)

### Target Page
- **Dashboard**: `/UberEats-Image-Extractor/src/pages/Dashboard.jsx`
- Grid-based layout with Card components
- Glass-morphism styling: `backdrop-blur-sm bg-background/95 border-border`
- Placement: Between Recent Activity grid and Quick Actions card

### Dialog Integration
- **CreateLeadScrapeJob**: `/UberEats-Image-Extractor/src/components/leads/CreateLeadScrapeJob.tsx`
- Props: `open`, `onClose`, `onSuccess`, `prefillCity`, `prefillCuisine`, `prefillPageOffset`
- Dashboard must manage dialog state (`createJobOpen`, `prefillScrapeData`)

### Hooks Required
```typescript
import { CityBreakdownTab } from '@/components/reports/CityBreakdownTab';
import { CreateLeadScrapeJob } from '@/components/leads/CreateLeadScrapeJob';
```

### Styling Classes
- Card: `backdrop-blur-sm bg-background/95 border-border`
- Card header with actions: `flex flex-row items-center justify-between py-3`
- Card content for tables: `p-0`
- Brand purple for geographic theme: `text-brand-purple`

## Implementation Steps

### Feature 1: Dialog State Management
1. Add `createJobOpen` and `prefillScrapeData` state to Dashboard
2. Create `handleStartScrape` callback
3. Import `CreateLeadScrapeJob` component
4. Render dialog at end of Dashboard component

### Feature 2: Component Integration
1. Import `CityBreakdownTab`
2. Add between Recent Activity and Quick Actions
3. Pass `filters={{}}` and `onStartScrape={handleStartScrape}`
4. Wrap in styled Card matching Dashboard patterns

### Features 3-9: Interactive Elements
All interactive elements work via:
- `window.open()` for navigation (opens new tabs)
- `onStartScrape` callback for dialog triggers
- Internal state for expand/collapse

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
2. Navigate to http://localhost:5007/dashboard
3. Test each feature as described in feature_list.json

### Verification Steps
1. Build passes: `npm run build` exits 0
2. Navigate to Dashboard: Table renders with city data
3. Click city row: Expands to show cuisines
4. Click leads count: New tab opens with correct filter
5. Click empty cuisine: Dialog opens with prefill
6. Click scraped cuisine: New tab opens with filter
7. Click page indicator: Opens job or dialog
8. Click Export CSV: File downloads
9. Visual inspection: Styling matches existing cards

---

## Session Start Procedure (MANDATORY)

Every iteration MUST begin with these steps:

1. `pwd` - Confirm working directory is `/Users/giannimunro/Desktop/cursor-projects/automation`
2. Read `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt` - Understand current state
3. Read `.claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json` - See all features and their status
4. `git log --oneline -10` - Review recent work
5. Run `bash .claude/data/ralph-loops/city-breakdown-dashboard/init.sh` - Verify dev server is running on port 5007
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
2. Update `.claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json`: set `passes: true`
3. Commit with descriptive message
4. Update `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt`
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
4. Update `.claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json`: change `passes: false` to `passes: true`
5. Update `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt` with results
6. Git commit with descriptive message
7. If ALL features pass: output `<promise>city-breakdown-dashboard COMPLETE</promise>`
8. If NOT complete: run `/continue-ralph .claude/data/ralph-loops/city-breakdown-dashboard` to spawn next iteration

## Completion Signal

When ALL features in `.claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json` have `passes: true`, output:

```
<promise>city-breakdown-dashboard COMPLETE</promise>
```

## Constraints
- Do NOT skip verification steps
- Do NOT mark features as passing without browser verification
- Do NOT modify feature definitions in `.claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json` (only `passes` field)
- Do NOT exceed 15 iterations
- If stuck on same issue for 3+ iterations, document blocker clearly in `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt`

## Key Files Reference

| File | Purpose |
|------|---------|
| `UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Target page - modify this |
| `UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` | Source component - import this |
| `UberEats-Image-Extractor/src/components/leads/CreateLeadScrapeJob.tsx` | Dialog component - import this |
| `UberEats-Image-Extractor/src/hooks/useLeadScrapeAnalytics.ts` | Analytics hooks (already used by CityBreakdownTab) |

## Investigation Documents

Full analysis available at:
- `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_CITY_BREAKDOWN_COMPONENT.md`
- `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_DASHBOARD_STRUCTURE.md`
- `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_ROUTING_INTERACTIONS.md`
