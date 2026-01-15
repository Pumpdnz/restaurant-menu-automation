/prime planning/yolo-mode-plans/ralph-loops/

## Context: City Breakdown Dashboard - Investigation Phase

Adding the city breakdown table from the Lead Scraping Reports tab to the Dashboard page. The table shows lead counts per city with full interactive functionality including expandable cuisine rows, clickable stats, and top 10 cuisine coverage indicators.

### Previous Sessions Summary
- Planning session: Created investigation plan with 3 parallel investigation tasks

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation

**Instructions:**
1. Read the investigation plan at `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_PLAN_CITY_BREAKDOWN_DASHBOARD.md`
2. Spin up 3 general-purpose subagents in parallel using the Task tool with `subagent_type="general-purpose"`
3. Each subagent investigates ONE area and creates a deliverable document:
   - Subagent 1: CityBreakdownTab component analysis → `INVESTIGATION_CITY_BREAKDOWN_COMPONENT.md`
   - Subagent 2: Dashboard structure analysis → `INVESTIGATION_DASHBOARD_STRUCTURE.md`
   - Subagent 3: Routing/interactions analysis → `INVESTIGATION_ROUTING_INTERACTIONS.md`
4. Wait for all subagents to complete
5. Read all investigation documents and compile findings

### Task 2: Report and Continue

**Instructions:**
1. Summarize key findings from all investigation documents
2. Identify any blockers or additional questions
3. Run `/plan-ralph-loop` to generate Ralph Loop configuration from findings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_PLAN_CITY_BREAKDOWN_DASHBOARD.md` | Main investigation plan |
| `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_CITY_BREAKDOWN_COMPONENT.md` | Subagent 1 deliverable |
| `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_DASHBOARD_STRUCTURE.md` | Subagent 2 deliverable |
| `planning/yolo-mode-plans/ralph-loops/INVESTIGATION_ROUTING_INTERACTIONS.md` | Subagent 3 deliverable |

---

## Source Files to Investigate

| File | Purpose |
|------|---------|
| `UberEats-Image-Extractor/src/pages/Dashboard.jsx` | Target page for integration |
| `UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` | Component to integrate |
| `UberEats-Image-Extractor/src/components/reports/ReportsTabContent.tsx` | Parent context |
| `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx` | Current usage context |

---

## Success Criteria Reference

- [ ] Build passes (no TypeScript/lint errors)
- [ ] City breakdown table renders on Dashboard
- [ ] Expandable city rows work correctly
- [ ] Clickable lead counts route to correct lead detail pages
- [ ] Top 10 cuisine coverage buttons trigger correct dialogs OR open correct tabs
- [ ] Table styling matches existing Dashboard card patterns
- [ ] No console errors during interaction

---

## Notes
- **Testing Method**: Browser verification with Claude in Chrome
- **Scope**: Full interactive component (not simplified)
- After investigation, proceed to Ralph Loop setup via `/plan-ralph-loop`
