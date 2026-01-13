# Ralph Loop: Dashboard Update with Reports and Navigation

## Loop Configuration
- **Max Iterations:** 10
- **Verification Method:** Browser automation at `localhost:5007`
- **Completion Criteria:** All browser verification checks pass

---

## Task Definition

Update the Dashboard page (`UberEats-Image-Extractor/src/pages/Dashboard.jsx`) to include:
1. Lead Scraping reports section (heatmap + city breakdown tabs)
2. Pending leads preview (step 4, status "passed")
3. Recent batch registration jobs preview
4. Tasks due today list with pagination
5. Recently created restaurants preview with city filter
6. Updated quick action buttons including "New Task" modal

All feature-specific sections must be wrapped in feature flag checks.

---

## Technical Context

### Feature Flags (from useAuth())
```tsx
const { isFeatureEnabled } = useAuth();
// Use these checks:
isFeatureEnabled('leadScraping')       // Reports, Pending Leads
isFeatureEnabled('registrationBatches') // Batch Registration
isFeatureEnabled('tasksAndSequences')  // Tasks, New Task button
```

### Existing Components to Import
```tsx
// Reports (reuse directly)
import ReportsTabContent from '../components/reports/ReportsTabContent';

// Task Modal (reuse directly)
import CreateTaskModal from '../components/tasks/CreateTaskModal';

// Data Hooks (reuse directly)
import { usePendingLeads } from '../hooks/useLeadScrape';
import { useRegistrationBatches } from '../hooks/useRegistrationBatch';

// Auth context for feature flags
import { useAuth } from '../context/AuthContext';
```

### Data Queries Needed

**Existing hooks:**
- `usePendingLeads()` - Returns leads at step 4 with "passed" status
- `useRegistrationBatches()` - Returns batch jobs with status filtering

**New queries needed:**
- Tasks due today (filter tasks by due_date === today, limit 10)
- Recent restaurants (order by created_at desc, limit 5)

### UI Components (shadcn/ui)
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
```

---

## Implementation Steps

### Step 1: Convert and Setup
- Convert Dashboard.jsx to Dashboard.tsx (optional but recommended)
- Add feature flag imports from AuthContext
- Add state for CreateTaskModal: `const [createTaskOpen, setCreateTaskOpen] = useState(false)`

### Step 2: Add Reports Section
```tsx
{isFeatureEnabled('leadScraping') && (
  <Card className="col-span-full">
    <CardHeader>
      <CardTitle>Lead Scraping Reports</CardTitle>
    </CardHeader>
    <CardContent>
      <ReportsTabContent onStartScrape={(params) => {
        // Navigate to leads page with params or open modal
        navigate(`/leads?city=${params.city}&cuisine=${params.cuisine}`);
      }} />
    </CardContent>
  </Card>
)}
```

### Step 3: Add Preview Sections

**Pending Leads Preview:**
```tsx
{isFeatureEnabled('leadScraping') && (
  <Card>
    <CardHeader>
      <CardTitle>Pending Leads</CardTitle>
      <CardDescription>Ready for conversion</CardDescription>
    </CardHeader>
    <CardContent>
      {/* List of pending leads with link to /leads */}
    </CardContent>
  </Card>
)}
```

**Batch Registration Preview:**
```tsx
{isFeatureEnabled('registrationBatches') && (
  <Card>
    <CardHeader>
      <CardTitle>Recent Batches</CardTitle>
    </CardHeader>
    <CardContent>
      {/* List of recent batches with status badges */}
    </CardContent>
  </Card>
)}
```

### Step 4: Add Tasks Section
```tsx
{isFeatureEnabled('tasksAndSequences') && (
  <Card>
    <CardHeader>
      <CardTitle>Tasks Due Today</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Paginated list of tasks due today */}
    </CardContent>
  </Card>
)}
```

### Step 5: Add Recent Restaurants
```tsx
<Card>
  <CardHeader>
    <CardTitle>Recently Added Restaurants</CardTitle>
    {/* Optional city filter dropdown */}
  </CardHeader>
  <CardContent>
    {/* List of 5 most recent restaurants */}
  </CardContent>
</Card>
```

### Step 6: Update Quick Actions
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* KEEP: New Extraction */}
  <Button asChild className="bg-gradient-to-r from-brand-blue to-brand-green">
    <Link to="/extractions/new">
      <Download className="h-4 w-4 mr-2" />
      New Extraction
    </Link>
  </Button>

  {/* CHANGE: Manage Restaurants → New Restaurant */}
  <Button asChild variant="outline">
    <Link to="/restaurants/new">
      <Plus className="h-4 w-4 mr-2" />
      New Restaurant
    </Link>
  </Button>

  {/* CHANGE: View Analytics → New Task (opens modal, feature-flagged) */}
  {isFeatureEnabled('tasksAndSequences') && (
    <Button onClick={() => setCreateTaskOpen(true)} variant="outline">
      <CheckSquare className="h-4 w-4 mr-2" />
      New Task
    </Button>
  )}
</div>

{/* CreateTaskModal */}
{createTaskOpen && (
  <CreateTaskModal
    open={createTaskOpen}
    onClose={() => setCreateTaskOpen(false)}
    onSuccess={() => {
      setCreateTaskOpen(false);
      // Optionally refresh tasks
    }}
  />
)}
```

---

## Browser Verification Steps

### Test Accounts
- **Full Access:** gianni@pumpd.co.nz (session already logged in - all feature flags enabled)
- **Limited Access:** support@pumpd.co.nz / Pumpd123! (leadScraping and registrationBatches DISABLED)

### Phase 1: Full Features Verification (default logged-in user)

1. Navigate to `http://localhost:5007/`
2. Take screenshot to verify page loads
3. Check console for errors: `read_console_messages` with pattern "error|Error"
4. Verify these components ARE visible:
   - Reports section with tabs (heatmap/city breakdown)
   - Pending leads preview (5 items)
   - Recent batch registration preview
   - Tasks due today list
   - Recently created restaurants table
5. Verify quick actions:
   - "New Extraction" button present
   - "New Restaurant" button present
   - "New Task" button present
6. Click "New Task" → verify CreateTaskModal opens
7. Close modal → verify it closes
8. Click "New Restaurant" → verify navigates to `/restaurants/new`
9. Navigate back to Dashboard
10. Screenshot final state

### Phase 2: Feature Flags Disabled Verification

1. Find user avatar in top-right corner and click it
2. Click "Logout" button
3. Wait for login page
4. Enter email: support@pumpd.co.nz
5. Enter password: Pumpd123!
6. Click login/submit button
7. Navigate to Dashboard
8. Verify these are HIDDEN (disabled flags):
   - Reports section (leadScraping disabled)
   - Pending leads preview (leadScraping disabled)
   - Batch registration preview (registrationBatches disabled)
9. Verify these ARE visible:
   - Tasks due today list (should be enabled)
   - Recently created restaurants (no flag)
   - "New Extraction" button (no flag)
   - "New Restaurant" button (no flag)
10. Screenshot to confirm feature flag hiding works
11. Logout
12. Login back as gianni@pumpd.co.nz to restore full access

---

## Completion Promise

The Ralph Loop is complete when ALL of the following are true:

### Code Requirements
- [ ] Old stat cards (Active Restaurants, Total Menus, Extractions, Success Rate) REMOVED
- [ ] Reports section added with feature flag `leadScraping`
- [ ] Pending Leads preview added with feature flag `leadScraping`
- [ ] Batch Registration preview added with feature flag `registrationBatches`
- [ ] Tasks Due Today list added with feature flag `tasksAndSequences`
- [ ] Recent Restaurants preview added (no feature flag)
- [ ] Quick actions updated: New Extraction, New Restaurant, New Task
- [ ] CreateTaskModal imported and wired to "New Task" button
- [ ] Build passes: `npm run build` in UberEats-Image-Extractor/

### Browser Verification - Phase 1 (Full Access)
- [ ] Dashboard loads at localhost:5007 without errors
- [ ] All 5 new sections visible
- [ ] "New Task" opens CreateTaskModal
- [ ] "New Restaurant" navigates to /restaurants/new
- [ ] No console errors

### Browser Verification - Phase 2 (Limited Access)
- [ ] Login as support@pumpd.co.nz works
- [ ] Reports section HIDDEN
- [ ] Pending Leads preview HIDDEN
- [ ] Batch Registration preview HIDDEN
- [ ] Tasks Due Today list VISIBLE
- [ ] Recent Restaurants VISIBLE

When ALL above criteria pass, output:

`<promise>DASHBOARD UPDATE COMPLETE</promise>`

---

## Error Handling

If verification fails:
1. Check browser console for specific error messages
2. Identify which component is failing
3. Fix the issue in the source code
4. Rebuild if necessary (check dev server is running)
5. Re-verify in browser

If stuck after 3 attempts on same issue:
- Document the blocker
- Ask user for guidance
- Do not continue looping on the same error

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.jsx` | Major restructure with new sections |

## Files to Create (if needed)

| File | Purpose |
|------|---------|
| `src/hooks/useDashboardData.ts` | Combined dashboard queries |
| `src/components/dashboard/PendingLeadsPreview.tsx` | Compact leads preview |
| `src/components/dashboard/BatchRegistrationPreview.tsx` | Compact batches preview |
| `src/components/dashboard/TasksDueTodayList.tsx` | Tasks due today |
| `src/components/dashboard/RecentRestaurantsPreview.tsx` | Recent restaurants |

---

## Dev Server

Ensure dev server is running before starting:
```bash
cd UberEats-Image-Extractor && npm run dev
# Server runs at localhost:5007
```
