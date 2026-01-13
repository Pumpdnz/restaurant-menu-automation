/prime .claude/data/ralph-loop-investigations/

## Context: Dashboard Update - Ralph Loop Investigation Execution

This session will execute a parallel investigation to gather all technical details needed for creating a Ralph Loop that updates the Dashboard page in the Pumpd frontend.

### Previous Session Summary
- Discussed Ralph Loop methodology and best practices for prompts
- Explored using Claude for Chrome browser automation as verification for frontend Ralph Loops
- Identified the Dashboard update task with new components, feature flags, and navigation
- Created investigation plan at `.claude/data/ralph-loop-investigations/DASHBOARD_UPDATE_INVESTIGATION_PLAN.md`

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation

**Instructions:**
1. Read the investigation plan at `.claude/data/ralph-loop-investigations/DASHBOARD_UPDATE_INVESTIGATION_PLAN.md`
2. Launch all 6 subagents **IN PARALLEL** using the Task tool (single message, multiple Task calls)
3. Each subagent investigates only (no code changes) and creates their deliverable markdown file

**Subagents to launch:**
| # | Focus | Deliverable |
|---|-------|-------------|
| 1 | Dashboard Structure | `INVESTIGATION_DASHBOARD_STRUCTURE.md` |
| 2 | Reports Components | `INVESTIGATION_REPORTS_COMPONENTS.md` |
| 3 | Feature Flags | `INVESTIGATION_FEATURE_FLAGS.md` |
| 4 | Data Queries | `INVESTIGATION_DATA_QUERIES.md` |
| 5 | Task Dialog | `INVESTIGATION_TASK_DIALOG.md` |
| 6 | UI Patterns | `INVESTIGATION_UI_PATTERNS.md` |

### Task 2: Compile Findings

After all subagents complete:
1. Read all 6 investigation files
2. Compile a summary report with key findings
3. Identify any blockers or missing pieces

### Task 3: Draft Ralph Loop Prompt

Based on investigation findings:
1. Create a complete Ralph Loop prompt for the Dashboard update
2. Include browser verification steps using Claude for Chrome at `localhost:5007`
3. Set max iterations to 10
4. Define clear completion promise

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/data/ralph-loop-investigations/DASHBOARD_UPDATE_INVESTIGATION_PLAN.md` | Master investigation plan with subagent instructions |
| `UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Current dashboard to be updated |
| `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx` | Contains reports tab to duplicate |
| `UberEats-Image-Extractor/src/components/reports/` | Report components to reuse |
| `UberEats-Image-Extractor/src/components/FeatureProtectedRoute.tsx` | Feature flag implementation |

---

## Notes
- Dev server runs at `localhost:5007`
- Frontend is React with mix of JSX/TSX files
- Goal is to create a Ralph Loop with browser verification for the Dashboard update
- The Dashboard update includes: reports tabs, pending leads preview, batch registration preview, tasks list, restaurants preview, updated quick actions
