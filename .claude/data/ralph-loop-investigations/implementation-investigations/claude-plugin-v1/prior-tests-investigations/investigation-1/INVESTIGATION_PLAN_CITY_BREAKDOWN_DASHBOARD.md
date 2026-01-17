# Investigation Plan: City Breakdown Table on Dashboard

> **STATUS: ✅ COMPLETE** - Implemented via Ralph Loop in 9 iterations (2026-01-15)
> See: `.claude/data/ralph-loops/city-breakdown-dashboard/progress.txt`

## Overview

Add the city breakdown table from the Lead Scraping Reports tab to the Dashboard page. The table shows lead counts per city with full interactive functionality including expandable cuisine rows, clickable stats, and top 10 cuisine coverage indicators that route to correct pages or trigger dialog components.

## Known Information

### Current Implementation
- **Dashboard Page**: `/UberEats-Image-Extractor/src/pages/Dashboard.jsx`
  - Uses Card-based layout with Tailwind CSS
  - Grid layouts: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for stats, `lg:grid-cols-2` for content cards
  - Styling: `backdrop-blur-sm bg-background/95 border-border`

- **City Breakdown Component**: `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx`
  - Fetches data via `useAnalyticsCoverage()`, `useAnalyticsSummary()`, `useAnalyticsHeatmap()`
  - Features: Expandable city rows, cuisine breakdowns, page indicators, CSV export
  - Interactive elements: Clickable cuisine coverage buttons, clickable lead counts, page indicators opening scrape jobs

- **Reports Tab Context**: `/UberEats-Image-Extractor/src/components/reports/ReportsTabContent.tsx`
  - Parent context may provide navigation functions or state

### Feature Requirements
- Full interactive component (not simplified)
- All existing functionality preserved
- Must match Dashboard styling patterns
- Top 10 cuisine coverage components must route correctly (open tabs or trigger dialogs)

## Testing & Validation Requirements

- **Testing Method**: Browser verification with Claude in Chrome
- **Browser Verification Steps**:
  1. Navigate to Dashboard page
  2. Verify city breakdown table renders correctly
  3. Test expandable rows functionality
  4. Test clickable stats routing to correct pages
  5. Test cuisine coverage buttons (trigger dialogs or open correct tabs)
  6. Verify no console errors
  7. Verify styling matches existing Dashboard components

- **Feature Flag Testing**: Not applicable (no feature flags)

## Success Criteria

- [x] Build passes (no TypeScript/lint errors) ✅ *Iteration 1*
- [x] City breakdown table renders on Dashboard ✅ *Iteration 2*
- [x] Expandable city rows work correctly ✅ *Iteration 3*
- [x] Clickable lead counts route to correct lead detail pages ✅ *Iteration 4*
- [x] Top 10 cuisine coverage buttons trigger correct dialogs OR open correct tabs ✅ *Iterations 5-6*
- [x] Page indicators work (green=scraped, gray=unscraped) ✅ *Iteration 7*
- [x] CSV export button functions ✅ *Iteration 8*
- [x] Table styling matches existing Dashboard card patterns ✅ *Iteration 9*
- [x] No console errors during interaction ✅ *Iteration 9*
- [x] Responsive layout works on different screen sizes ✅ *Iteration 9*

## Feature Categories

### Functional Features
- City breakdown data display with lead counts
- Expandable cuisine detail rows
- Navigation to lead detail pages from clickable stats
- Cuisine coverage button interactions (dialogs/routing)
- CSV export functionality

### UI Features
- Card wrapper matching Dashboard styling
- Responsive grid placement
- Consistent typography and spacing
- Interactive hover states

### Integration Features
- Analytics hooks integration (`useAnalyticsCoverage`, etc.)
- Navigation/routing integration
- Dialog component integration (if cuisine buttons trigger dialogs)

## Instructions

Execute the following investigation tasks using the Task tool to spin up 3 subagents in parallel. Each subagent should investigate its assigned area and create an investigation document as its deliverable in `planning/yolo-mode-plans/ralph-loops/`.

**CRITICAL**: Use `subagent_type="general-purpose"` for all investigation subagents.

After all subagents complete, read all investigation documents and compile findings, then run `/plan-ralph-loop` to generate Ralph Loop configuration.

---

## subagent_1_instructions

### Context
Investigate the CityBreakdownTab component to understand its dependencies, props, and how it integrates with parent context.

### Instructions
1. Read `/UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx` thoroughly
2. Identify all hooks used and their data sources
3. Document all props required by the component
4. Identify any context dependencies (navigation, dialogs, etc.)
5. Note how cuisine coverage buttons work - do they open dialogs or navigate?
6. Document any parent component dependencies from ReportsTabContent

### Deliverable
Create `INVESTIGATION_CITY_BREAKDOWN_COMPONENT.md` with:
- Component props interface
- All hooks and their purposes
- Context dependencies
- How interactive elements work (buttons, clicks, routing)
- Any state management requirements
- Recommendations for standalone usage on Dashboard

### Report
Summary of component requirements and any adaptation needed for Dashboard integration.

---

## subagent_2_instructions

### Context
Investigate the Dashboard page to understand its current structure, styling patterns, and where the city breakdown table should be placed.

### Instructions
1. Read `/UberEats-Image-Extractor/src/pages/Dashboard.jsx` thoroughly
2. Document the current layout structure and grid system
3. Identify existing Card component patterns and styling classes
4. Determine the best placement for the city breakdown table (new section, replace existing, etc.)
5. Note any existing analytics integrations
6. Document the import patterns used

### Deliverable
Create `INVESTIGATION_DASHBOARD_STRUCTURE.md` with:
- Current Dashboard layout diagram/description
- Card component patterns with exact class names
- Recommended placement for city breakdown table
- Required imports and modifications
- Styling classes to apply for consistency

### Report
Summary of Dashboard structure and recommended integration approach.

---

## subagent_3_instructions

### Context
Investigate the routing and dialog interactions to understand how the interactive elements should work when moved to the Dashboard.

### Instructions
1. Search for how cuisine coverage buttons work in CityBreakdownTab
2. Find the dialog components that may be triggered
3. Understand the navigation/routing patterns used
4. Check if there are any React Router dependencies
5. Identify if LeadScrapes page passes any callbacks or context to the table
6. Document how "view pending leads" and similar clickable elements route

### Deliverable
Create `INVESTIGATION_ROUTING_INTERACTIONS.md` with:
- How cuisine buttons trigger dialogs vs navigation
- Dialog component locations and how they're rendered
- Navigation patterns (React Router, programmatic navigation)
- Any callbacks passed from parent components
- List of all clickable elements and their expected behavior
- Recommendations for maintaining functionality on Dashboard

### Report
Summary of interactive functionality and requirements for Dashboard integration.

---

## Post-Investigation Steps

1. Read all three investigation documents
2. Compile findings into a summary
3. Run `/plan-ralph-loop` to generate Ralph Loop configuration for implementation
