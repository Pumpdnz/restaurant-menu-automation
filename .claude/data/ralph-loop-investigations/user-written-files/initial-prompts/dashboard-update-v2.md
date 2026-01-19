/plan-parallel-investigation-ralph planning/ralph-loops/
# Task:
Update the Dashboard page to display new report and navigation components instead of the current basic ones we created on the first iteration
## Current components
1. Active Restaurants total card (not displaying actual restaurant count for the user's organisation)
2. Total Menus count card (not displaying actual values)
3. Extractions total count (not displaying actual count)
4. Success rate (not displaying actual count)
5. Recent restaurants list (works intermittently)
6. Recent extractions list (works intermittently)
7. Quick actions:
- New Extraction button (navigates to /extractions/new)
- Manage restaurants button (navigates to restaurants page)
- View analytics button (navigates to analytics page that is just a placeholder)
8. Lead Scraping reports (heatmap + city breakdown table in tabs)
These components were recently implemented but there are issues:
- Components are not currently tabbed (both the table and heatmap show at the same time)
- All currently nested within a card titled "City Breakdown" that violates design patterns across the application
- Not wrapped in a feature flag to prevent users without the lead-scraping feature flag from seeing the components

## Desired components:
1. Fix Lead Scraping page reports tab components
- City x cuisine heatmap and the City breakdown table components should be within a tabbed section for the user to toggle between the two views
- Remove from nesting within the card titled "City Breakdown" that violates design patterns across the application
- Wrap in a feature flag to prevent users without the lead-scraping feature flag from seeing the components

2. Recent Pending leads preview (5 most recent leads at step 4 with status "passed")
IMPORTANT: "Pending" leads are defined as leads which are yet to be converted into restaurants but have been "passed" from step 4

3. Recent Batch Registration jobs preview (most recently created registration batch job)

4. Paginated list of tasks due today

5. Recently created restaurants preview table with filter for city

6. Replace "Manage Restaurants" quick action button with "New Restaurant" (navigates directly to /restaurants/new)

7. Replace "Analytics" quick action button with "New Task" (opens existing new task dialog which needs to be imported and wired up on the dashboard page)
- Wrap in tasks and sequences feature flag

## Requirements 
### Components feature flagged appropriately:
- Lead scraping page reports and pending leads preview components wrapped in lead scraping feature flag
- Tasks List wrapped in Tasks and Sequences feature flag
- Recent batch registration jobs preview wrapped in registration batches feature flag
- Recently created restaurants peview does not need to be wrapped in a feature flag

### Move Existing Quick actions buttons to top of page:
- New Extraction button
- Replace Manage Restaurants with \"New Restaurant\" (navigates directly to /restaurants/new)
- Replace Analytics button with \"New Task\" (opens existing new task dialog which needs to be imported and wired up on the dashboard page)

### Remove existing totals components
- Active Restaurants
- Total Menus
- Extractions
- Success rate

### Make the Recent Restaurants and recent extractions previews actually work

## Verification steps:
- Use claude for chrome to navigate to "http://localhost:5007" and {test feature steps}

Please help me design the ralph loop and ask further questions if required