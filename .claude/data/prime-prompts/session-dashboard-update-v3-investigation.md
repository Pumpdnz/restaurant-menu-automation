/prime planning/ralph-loops/dashboard-update-v3/

## Context: Dashboard Update V3 - Investigation Phase

Investigating the Dashboard page to gather implementation details for fixing and enhancing multiple components that weren't completed correctly in the previous Ralph Loop iteration.

### Previous Sessions Summary
- Planning session: Created investigation plan with 4 parallel investigation tasks covering:
  1. Recent Restaurants + Tasks Due Today restructuring
  2. Lead Scraping Reports tabbed component
  3. Pending Leads preview enhancements
  4. Batch Jobs preview + two-column grid

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation
**Instructions:**
1. Read the investigation plan at `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_PLAN.md`
2. Spin up 4 general-purpose subagents in parallel using the Task tool with `subagent_type="general-purpose"`
3. Each subagent investigates ONE area and creates their deliverable document:
   - Subagent 1: Recent Restaurants and Tasks Due Today (INVESTIGATION_TASK_1.md)
   - Subagent 2: Lead Scraping Reports restructuring (INVESTIGATION_TASK_2.md)
   - Subagent 3: Pending Leads preview enhancements (INVESTIGATION_TASK_3.md)
   - Subagent 4: Batch Jobs preview + grid layout (INVESTIGATION_TASK_4.md)
4. **IMPORTANT:** Spawn all 4 subagents in a SINGLE message with multiple Task tool calls
5. Wait for all subagents to complete

### Task 2: Report and Continue
**Instructions:**
1. Read all 4 investigation documents from `planning/ralph-loops/dashboard-update-v3/`
2. Summarize key findings from all investigation documents
3. Identify any blockers or additional questions
4. Run `/plan-ralph-loop` to generate Ralph Loop configuration from findings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_PLAN.md` | Main investigation plan |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_1.md` | Recent Restaurants + Tasks Due Today findings |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_2.md` | Lead Scraping Reports findings |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_3.md` | Pending Leads preview findings |
| `planning/ralph-loops/dashboard-update-v3/INVESTIGATION_TASK_4.md` | Batch Jobs + grid layout findings |

---

## Dashboard Component Changes Summary

### 1. Recent Restaurants + Recent Extractions Area
- Replace top Recent Restaurants with working version + pagination (5 pages, 5 rows)
- Add columns: lead contact details popup, active tasks preview
- Replace Recent Extractions with Tasks Due Today component

### 2. Tasks Due Today Component
- Move to top-right position
- When <25 tasks due today, backfill with overdue tasks (most recently overdue)
- Fully featured with pagination (5 pages, 5 rows)

### 3. Lead Scraping Reports
- Fix blue section header styling
- Create tabbed component: Heatmap (tab 1, default) + City breakdown table (tab 2)
- Remove Opportunities tab from this section

### 4. Pending Leads + Batch Jobs Grid
- Two-column grid layout at equal height
- Pending Leads: add Cuisine, Rating, Created, UberEats links, multi-select, conversion, actions
- Batch Jobs: clickable navigation, restaurants preview, progress bars

---

## Testing Requirements
- **Method:** Combined (Build + Browser verification)
- **Browser Testing:** Visual confirmation + interactive testing
- **Feature Flags:** Use existing (leadScraping, registrationBatches, tasksAndSequences)

## Success Criteria
- Build passes (TypeScript/lint)
- All UI components render correctly
- Pagination works (5 pages, 5 rows where applicable)
- Tabs switch correctly (heatmap default)
- All interactive elements functional
- No console errors

---

## Notes
- After investigation, proceed to Ralph Loop setup via `/plan-ralph-loop`
- All subagents must use `subagent_type="general-purpose"` (NOT "Explore" or "Plan")
- Investigation only - no code changes until Ralph Loop execution
