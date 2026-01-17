# Prime Prompt: Ralph Loop v2.0 E2E Test - Remaining Dashboard Features

## Session Goal

Test the full Ralph Loop v2.0 implementation by running a complete cycle from parallel investigation through autonomous iteration. Implement **all remaining/deferred features** from the original City Breakdown Dashboard investigation.

---

## Context

### Ralph Loop v2.0 Status
The new CLI-based orchestrator has been fully implemented:
- `.claude/scripts/ralph-loop/` - Core orchestration scripts (5 files)
- `.claude/hooks/ralph-pre-tool.js` - Security hook for Bash commands
- `.claude/settings.local.json` - PreToolUse hook configured
- `/continue-ralph` skill updated to use v2.0 wrapper

### Previous Ralph Loop Test
Successfully completed `city-breakdown-dashboard` in 9 iterations:
- Added CityBreakdownTab component to Dashboard
- Full interactive functionality (expandable rows, clickable stats, dialogs)
- All navigation and dialog integrations working
- See: `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt`

---

## Features to Implement

### Deferred Items from Original Investigation

The following items were explicitly deferred during the first Ralph Loop:

1. **Feature Flag Protection**
   - The Dashboard is publicly accessible but LeadScrapes is feature-protected
   - The City Breakdown section should respect the `leadScraping` feature flag
   - Users without lead scraping access shouldn't see this section

2. **Refresh/Refetch After Dialog Actions**
   - When CreateLeadScrapeJob dialog successfully creates a job, data should refresh
   - Currently the city breakdown data is stale until manual page refresh
   - Need to trigger React Query refetch after successful scrape creation

3. **Dashboard JSX to TSX Conversion**
   - Dashboard.jsx should be converted to Dashboard.tsx for type safety
   - This enables proper TypeScript interfaces for state and props
   - Aligns with the rest of the codebase which uses TypeScript

### What Needs Investigation

These features were deferred because they require additional investigation:

- How does the feature flag system work? (`FeatureProtectedRoute`, feature checks)
- What's the pattern for conditional rendering based on feature access?
- How do other components trigger React Query refetches after mutations?
- What's the standard approach for JSX → TSX conversion in this codebase?
- Are there any additional type definitions needed?

---

## Instructions

### Step 1: Run Parallel Investigation

Execute `/plan-parallel-investigation-ralph` with this task description:

```
Implement all remaining deferred features for the Dashboard City Breakdown section:
1. Feature flag protection - respect leadScraping feature access
2. Auto-refresh after CreateLeadScrapeJob dialog success
3. Convert Dashboard.jsx to Dashboard.tsx with proper types

Investigate how each of these patterns works elsewhere in the codebase.
```

This will spawn parallel subagents to investigate:
- Feature flag system and conditional rendering patterns
- React Query refetch patterns after mutations
- JSX to TSX conversion patterns and type definitions

### Step 2: Review Investigation Findings

After subagents complete, read all investigation documents in:
`planning/yolo-mode-plans/ralph-loops/`

### Step 3: Run Plan Ralph Loop

Execute `/plan-ralph-loop` to generate Ralph Loop configuration files.

### Step 4: Start Ralph Loop v2.0

Execute `/continue-ralph {RALPH_LOOP_DIR}` to start the autonomous loop.

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| Original Investigation | `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_*.md` |
| Previous Ralph Loop | `.claude/data/ralph-loops/city-breakdown-dashboard/` |
| Dashboard Page | `/UberEats-Image-Extractor/src/pages/Dashboard.jsx` |
| CityBreakdownTab | `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` |
| Feature Protection | `/UberEats-Image-Extractor/src/components/FeatureProtectedRoute.tsx` |
| CreateLeadScrapeJob | `/UberEats-Image-Extractor/src/components/leads/CreateLeadScrapeJob.tsx` |

---

## Testing Goals

This session tests the complete Ralph Loop v2.0 workflow:
1. `/plan-parallel-investigation-ralph` with real deferred features
2. Parallel subagent coordination for multiple investigation areas
3. `/plan-ralph-loop` config generation from findings
4. Autonomous iteration with `--dangerously-skip-permissions`
5. PreToolUse hook security validation
6. Browser verification with Claude in Chrome
7. MCP error retry logic
8. macOS notifications on completion/failure

---

## Success Criteria

- [ ] Feature flag check wraps City Breakdown section
- [ ] City breakdown hidden for users without lead scraping access
- [ ] Data refreshes after successful scrape job creation
- [ ] Dashboard.tsx compiles with no TypeScript errors
- [ ] All existing functionality still works
- [ ] No console errors
- [ ] Build passes

---

## Notes

- Dev server runs on port 5173 (vite default)
- The feature scope is intentionally constrained to 3 main features
- Each feature may decompose into multiple implementation steps
- Aim for ~5-10 iterations total
- Browser verification required for feature flag and refresh behavior
