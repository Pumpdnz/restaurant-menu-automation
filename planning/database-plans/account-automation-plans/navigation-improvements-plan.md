# Navigation Improvements Plan

## Overview
Improve navigation between restaurant management pages to provide more intuitive user experience when working with restaurants, menus, and extractions.

## Current Pain Points
1. Users must navigate back to restaurants list page to access RestaurantDetail page
2. No direct navigation from menu editing to restaurant management
3. Difficult to access "all menus" view for a specific restaurant
4. Redundant buttons (view/edit) that route to same page
5. No direct menu management from RestaurantDetail workflow tab

## Requirements by Page

### 1. Menus Page (List View) - `/menus`
**Current Issues:**
- Restaurant names are not clickable
- View and Edit buttons both route to same MenuDetail page

**Required Changes:**
- Make restaurant names clickable → RestaurantDetail page (`/restaurants/{restaurantId}`)
- Reroute "View" button → All menus for restaurant (`/menus?restaurant={restaurantId}`)
- Keep "Edit" button → MenuDetail page (`/menus/{menuId}`)

### 2. MenuDetail Page - `/menus/{menuId}`
**Current Issues:**
- No navigation to parent restaurant
- No way to view other menus for same restaurant

**Required Changes:**
Add two buttons in top card:
- "Manage Restaurant" button → RestaurantDetail page (`/restaurants/{restaurantId}`)
- "View All Menus" button → All menus for restaurant (`/menus?restaurant={restaurantId}`)

### 3. Extractions Page (List View) - `/extractions`
**Current Issues:**
- Restaurant names not clickable
- View button routes to ExtractionDetail (to be deprecated)

**Required Changes:**
- Make restaurant names clickable → RestaurantDetail page (`/restaurants/{restaurantId}`)
- Reroute "View" button → MenuDetail page (`/menus/{menuId}`)

### 4. RestaurantDetail Page (Workflow Tab) - `/restaurants/{restaurantId}`
**Current Issues:**
- Menus displayed but not clickable
- No direct actions available on menus
- Must navigate away to perform menu operations

**Required Changes:**
Add three action buttons for each menu in Workflow tab:
1. "View Menu" → MenuDetail page (`/menus/{menuId}`)
2. "Upload Images to CDN" → Execute upload function
3. "Download CSV with CDN Images" → Execute download function

## Technical Implementation Plan

### Data Requirements
Each component needs access to:
- Restaurant ID
- Restaurant Name
- Menu ID (where applicable)
- Menu status and metadata

### Routing Structure
```
/restaurants
  /{restaurantId} - RestaurantDetail
/menus
  ?restaurant={restaurantId} - Filtered menu list
  /{menuId} - MenuDetail
/extractions - Extractions list
```

### Component Updates Needed

#### 1. Menus.jsx
- Add onClick handler to restaurant name cell
- Modify action buttons routing logic
- Pass restaurant ID to navigation

#### 2. MenuDetail.jsx
- Add navigation buttons in header card
- Fetch and store restaurant ID from menu data
- Implement navigation handlers

#### 3. Extractions.jsx
- Add onClick handler to restaurant name
- Modify View button to route to MenuDetail
- Ensure menu ID is available in extraction data

#### 4. RestaurantDetail.jsx
- Enhance Workflow tab menu display
- Add action buttons for each menu
- Implement upload/download handlers
- Add navigation to MenuDetail

### Shared Components/Utilities Needed
- Navigation helper functions
- Consistent button styling
- Restaurant/Menu context providers (if needed)

## API/Backend Considerations
- Ensure all list endpoints include necessary IDs for navigation
- Menu endpoints should include restaurant_id
- Extraction endpoints should include menu_id and restaurant_id

## User Flow Improvements

### Before:
Extractions → Restaurants List → Find Restaurant → RestaurantDetail → Back → Menus List → MenuDetail

### After:
Extractions → Click Restaurant Name → RestaurantDetail → Click Menu → MenuDetail → Manage Restaurant → RestaurantDetail

## Success Metrics
- Reduced clicks to navigate between related pages
- Faster workflow completion
- Improved user satisfaction
- Reduced confusion about navigation paths

## Implementation Priority
1. **High Priority:**
   - Restaurant name clickability in lists
   - Navigation buttons in MenuDetail
   - Menu actions in RestaurantDetail Workflow tab

2. **Medium Priority:**
   - View/Edit button differentiation
   - Extraction to MenuDetail routing

3. **Low Priority:**
   - Additional quality-of-life improvements
   - Breadcrumb navigation

## Notes
- Maintain backward compatibility with existing bookmarks/links
- Consider adding breadcrumb navigation in future iteration
- Test all navigation paths thoroughly before deployment