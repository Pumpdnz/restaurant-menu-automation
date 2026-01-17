/prime planning/ralph-loops/dashboard-update-v2

## Context: Dashboard Update V2 - Investigation Phase

This session executes parallel investigations to gather implementation context for updating the Dashboard page with new report and navigation components.

### Previous Sessions Summary
- Planning session: Created investigation plan with 6 parallel investigation tasks

### Target Changes Overview
1. **Remove:** 4 stats cards (not displaying real data)
2. **Fix:** Lead Scraping reports - add proper tabs, remove nested card, add feature flag
3. **Add:** Recent Pending Leads preview (5 most recent at step 4, status "passed")
4. **Add:** Recent Batch Registration Jobs preview
5. **Add:** Paginated Tasks Due Today list
6. **Add:** Recently Created Restaurants preview with city filter
7. **Modify:** Quick actions - move to top, update buttons, add "New Task" dialog
8. **Fix:** Recent Restaurants and Extractions to work properly

### Feature Flag Requirements
- Lead scraping components: Hide when flag disabled
- Tasks components: Hide when flag disabled
- Registration batches: Hide when flag disabled
- Restaurants preview: No flag needed

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation

**Instructions:**
1. Read the investigation plan at `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_PLAN.md`
2. Spin up **6 general-purpose subagents in parallel** using the Task tool
3. **CRITICAL:** Use `subagent_type="general-purpose"` for ALL subagents
4. Each subagent investigates ONE area and creates a deliverable document
5. Send ALL 6 Task tool calls in a SINGLE message

**Subagent Topics:**
1. Dashboard Structure & Current Implementation
2. Data Queries & API Patterns
3. Feature Flag Implementation
4. Task Dialog Component Integration
5. UI Patterns & Reports Components
6. Preview Table Components

### Task 2: Wait and Compile

**Instructions:**
1. Wait for all 6 subagents to complete
2. Read all investigation documents from `planning/ralph-loops/dashboard-update-v2/`
3. Compile key findings summary

### Task 3: Report and Continue

**Instructions:**
1. Summarize key findings from all investigation documents
2. Identify any blockers or additional questions
3. Run `/plan-ralph-loop` to generate Ralph Loop configuration from findings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_PLAN.md` | Main investigation plan with subagent instructions |
| `UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Current Dashboard component |
| `UberEats-Image-Extractor/src/context/AuthContext.tsx` | Feature flag system |
| `UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx` | Task dialog to integrate |

---

## Notes
- Testing Method: Combined (Browser at localhost:5007 + Build verification)
- Success Criteria: Build passes, UI correct, behaviors work, no console errors
- Feature flags hide components completely when disabled
- Implementation approach: Incremental (one feature per Ralph iteration)
- After investigation, proceed to Ralph Loop setup via `/plan-ralph-loop`
