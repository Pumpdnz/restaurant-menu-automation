/prime .claude/data/ralph-loops/city-breakdown-dashboard/

## Context: Ralph Loop Iteration 1 - city-breakdown-dashboard

This is the first iteration of the Ralph Loop for adding the CityBreakdownTab to the Dashboard.

### Current State
- Iteration: 1
- Completed: 0/9 features
- Status: Starting

### Port Configuration
- Dev Server: localhost:5173

---

## Session Start Procedure (MANDATORY)

1. `pwd` - Confirm working directory
2. Read `progress.txt` - Current state
3. Read `feature_list.json` - All features and status
4. `git log --oneline -10` - Recent work
5. Run `./init.sh` - Ensure server running
6. **CRITICAL: Run `npm run build` BEFORE new work**
7. Choose highest-priority feature where `passes: false`

---

## CRITICAL: One Feature Per Iteration

Work on EXACTLY ONE feature. After completing:
1. Verify with build + browser test
2. Update feature_list.json: set `passes: true`
3. Git commit with descriptive message
4. Update progress.txt
5. Run /continue-t OR output promise

---

## Feature Priority Order

1. Dialog state management (setup foundation)
2. CityBreakdownTab renders on Dashboard
3. Expandable rows work
4. Clickable leads route correctly
5. Empty cuisine buttons open dialog
6. Scraped cuisine buttons navigate
7. Page indicators work
8. CSV export works
9. Styling matches Dashboard

Start with Feature 1 - this establishes the dialog infrastructure needed for other features.

---

## Completion Check

If ALL features pass: `<promise>city-breakdown-dashboard COMPLETE</promise>`

Otherwise, run `/continue-t` to spawn next iteration.

---

## Key Implementation Reference

### Dialog State Pattern (Feature 1)
```jsx
const [createJobOpen, setCreateJobOpen] = useState(false);
const [prefillScrapeData, setPrefillScrapeData] = useState(null);

const handleStartScrape = (city, cuisine, pageOffset) => {
  setPrefillScrapeData({ city, cuisine, pageOffset });
  setCreateJobOpen(true);
};
```

### Component Integration Pattern (Feature 2)
```jsx
<CityBreakdownTab
  filters={{}}
  onStartScrape={handleStartScrape}
/>
<CreateLeadScrapeJob
  open={createJobOpen}
  onClose={() => { setCreateJobOpen(false); setPrefillScrapeData(null); }}
  prefillCity={prefillScrapeData?.city}
  prefillCuisine={prefillScrapeData?.cuisine}
  prefillPageOffset={prefillScrapeData?.pageOffset}
/>
```
