# Move Menu Feature - Option Sets Analysis

## Executive Summary
**The Move Menu feature is SAFE to use with premium extracted menus containing option sets.** The data relationships are preserved correctly when moving menus between restaurants.

## Current Implementation Analysis

### Frontend Flow
1. **Component**: `MoveMenusDialog.jsx`
   - Collects selected menu IDs
   - Allows selection of target restaurant
   - Sends PATCH request to `/api/menus/bulk-reassign`

### Backend Processing
1. **Endpoint**: `PATCH /api/menus/bulk-reassign` (server.js:4770)
   - Validates menu IDs and target restaurant ID
   - Calls `db.reassignMenusToRestaurant(menuIds, restaurantId)`

2. **Database Service**: `reassignMenusToRestaurant` (database-service.js:1356)
   - Verifies target restaurant exists
   - Updates only the `restaurant_id` field in the `menus` table
   - Does NOT touch any other relationships

### Database Relationships

#### Key Foreign Key Relationships:
```
menus → restaurants (via restaurant_id)
menu_items → menus (via menu_id) [CASCADE DELETE]
menu_items → categories (via category_id) [CASCADE DELETE]
menu_item_option_sets → menu_items (via menu_item_id) [CASCADE DELETE]
menu_item_option_sets → option_sets (via option_set_id) [CASCADE DELETE]
option_set_items → option_sets (via option_set_id) [CASCADE DELETE]
```

## Why Option Sets Stay Connected

### The Critical Point:
When moving a menu to a different restaurant, the `reassignMenusToRestaurant` function **ONLY** updates:
```sql
UPDATE menus
SET restaurant_id = [new_restaurant_id],
    updated_at = [current_timestamp]
WHERE id IN ([menu_ids])
```

### What This Means:
1. **Menu ID remains unchanged** - The primary key of the menu stays the same
2. **All child relationships intact** - Since menu_id doesn't change:
   - All `menu_items` stay connected to the same menu
   - All `categories` stay connected to the same menu
   - All `menu_item_option_sets` stay connected to their menu items
   - All `option_sets` referenced by menu items remain linked
   - All `option_set_items` within option sets remain intact

### Data Hierarchy Preserved:
```
Restaurant (changes)
    └── Menu (ID unchanged)
        ├── Categories (unchanged)
        └── Menu Items (unchanged)
            └── Menu Item Option Sets (unchanged)
                └── Option Sets (unchanged)
                    └── Option Set Items (unchanged)
```

## Testing Confirmation

### Database Foreign Key Analysis:
- `menu_items` → `menus`: Connected via `menu_id` (not restaurant_id)
- `menu_item_option_sets` → `menu_items`: Connected via `menu_item_id`
- `option_set_items` → `option_sets`: Connected via `option_set_id`

### Cascade Rules:
- Deleting a menu would cascade delete all items and option sets
- But moving a menu doesn't delete anything, only updates the parent restaurant reference

## Potential Considerations

### 1. Organization Context
- All data remains in the same organization
- No cross-organization moves are possible (good for data integrity)

### 2. Restaurant-Specific Data
- If any customizations were made specific to the original restaurant, they will move with the menu
- This is typically desired behavior when correcting a mistaken restaurant assignment

### 3. Extraction Jobs
- The `extraction_job_id` in the menu remains unchanged
- Historical tracking of where the menu was extracted from is preserved

## Recommendations

### Safe to Proceed
✅ **You can safely move the premium-extracted menu to the correct restaurant**
- All menu items will be preserved
- All option sets will remain connected
- All customization options will stay intact
- All images and descriptions will be maintained

### Best Practices
1. **Before Moving**:
   - Verify the target restaurant is the correct one
   - Note the current menu ID for reference

2. **After Moving**:
   - Verify menu appears under new restaurant
   - Spot-check a few items with option sets to confirm data integrity
   - Check that image URLs are still accessible

### No Code Changes Needed
The current implementation correctly handles menus with option sets. The feature was designed with proper database relationships that naturally support this use case.

## Conclusion
The Move Menu feature works correctly with premium extraction data including option sets. The database design with proper foreign key relationships ensures all related data moves together as a cohesive unit when reassigning a menu to a different restaurant.

---
*Analysis completed: 2025-01-14*