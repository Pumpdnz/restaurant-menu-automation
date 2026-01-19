/prime planning/ralph-loops/dashboard-update-v4/

## Context: Dashboard Update v4 - Investigation Phase

This investigation continues work from the previous Ralph Loop (dashboard-update-v3) to fix remaining issues with the Dashboard page. The dashboard requires fixes across 6 distinct areas: Quick Actions buttons, Tasks Due Today table, Recent Restaurants component, Pending Leads preview, Recent Batch Jobs preview, and layout grid reorganization.

### Previous Sessions Summary
- Planning session: Created investigation plan with 6 parallel investigation tasks
- Testing approach: Combined (browser verification + build validation + console error checks)
- Feature flag testing: Required for `tasksAndSequences`, `leadScraping`, `registrationBatches`
- Browser verification: Both visual and interactive testing required

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation
**Instructions:**
1. Read the investigation plan at `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_PLAN.md`
2. Spin up **6 general-purpose subagents in parallel** using the Task tool with `subagent_type="general-purpose"`
3. Each subagent investigates ONE area and creates a deliverable document:
   - Subagent 1: Quick Actions (INVESTIGATION_QUICK_ACTIONS.md)
   - Subagent 2: Tasks Due Today table (INVESTIGATION_TASKS_TABLE.md)
   - Subagent 3: Recent Restaurants (INVESTIGATION_RECENT_RESTAURANTS.md)
   - Subagent 4: Pending Leads (INVESTIGATION_PENDING_LEADS.md)
   - Subagent 5: Recent Batch Jobs (INVESTIGATION_BATCH_JOBS.md)
   - Subagent 6: Validation approach (INVESTIGATION_VALIDATION.md)
4. Wait for all subagents to complete
5. Read all investigation documents and compile findings

### Task 2: Report and Continue
**Instructions:**
1. Summarize key findings from all 6 investigation documents
2. Identify any blockers or additional questions
3. Run `/plan-ralph-loop` to generate Ralph Loop configuration from findings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `planning/ralph-loops/dashboard-update-v4/INVESTIGATION_PLAN.md` | Main investigation plan with subagent instructions |
| `UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Main dashboard file (810 lines) |
| `UberEats-Image-Extractor/src/pages/Tasks.tsx` | Reference for full task table features (1755 lines) |
| `UberEats-Image-Extractor/src/pages/Restaurants.jsx` | Reference for restaurant features (1269 lines) |
| `UberEats-Image-Extractor/src/components/restaurants/TaskCell.tsx` | TaskCell component with Start Sequence |
| `UberEats-Image-Extractor/src/components/leads/PendingLeadsTable.tsx` | Full PendingLeadsTable implementation |

---

## Fixes Summary

1. **Quick Actions** - New Task button feature flag + gradients, Manage → New Restaurant
2. **Tasks Due Today** - 25 tasks, 5/page pagination, full table features (status toggle, clickable names, descriptions, due date editor, priority chips, type popovers, action buttons)
3. **Recent Restaurants** - Start Sequence fix, more columns, toggleable status, move to 2-col grid position 1
4. **Pending Leads** - Multi-select, collapsible drawers, full Action buttons
5. **Recent Batch Jobs** - Clickable truncated restaurant names
6. **Validation** - Interactive component testing approach

---

## Notes
- Testing Method: Combined (browser + build + console)
- All interactive components must be validated (popovers, toggles, modals)
- Feature flags must be tested in both enabled and disabled states
- After investigation, proceed to Ralph Loop setup via `/plan-ralph-loop`
