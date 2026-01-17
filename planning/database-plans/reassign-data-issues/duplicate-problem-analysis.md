# Restaurant Data Duplication - Problem Analysis

## Overview
The current `duplicate_restaurant_to_org` RPC function creates an incomplete copy of restaurant data when duplicating to another organization. Several critical tables are missing from the duplication process.

## Current Implementation Scope
The function currently duplicates:
- ✅ `restaurants` - Creates new restaurant (appends " (Copy)" to name)
- ✅ `menus` - Duplicates menus (tracks menu_id mapping)
- ✅ `menu_items` - Duplicates items (but **NO ID mapping tracked!**)

## Missing Tables Analysis

### 1. **categories**
**Relationship**: Belongs to menu
```
category_id (FK) → categories
menu_id (FK) → menus
```
**Impact**: CRITICAL - Menu items reference categories; without duplicating categories, category_id references will be invalid
**Complexity**: MEDIUM - Requires category_id mapping to update menu_items
**Current Issue**: menu_items.category_id references old categories from source organization

### 2. **item_images**
**Relationship**: Belongs to menu_item
```
menu_item_id (FK) → menu_items
organisation_id (FK) → organisations
```
**Impact**: HIGH - Menu item images are missing from duplicated restaurant
**Complexity**: MEDIUM - Requires menu_item_id mapping
**Current Issue**: No images duplicated; duplicated menu items have no images

### 3. **menu_item_option_sets**
**Relationship**: Junction table linking menu items to option sets
```
menu_item_id (FK) → menu_items
option_set_id (FK) → option_sets
```
**Impact**: CRITICAL - Menu customization options are completely missing
**Complexity**: HIGH - Requires both menu_item_id and option_set_id mappings
**Current Issue**: Duplicated menu items have no customization options

### 4. **option_sets**
**Relationship**: Referenced by menu_item_option_sets
```
organisation_id (FK) → organisations
```
**Impact**: CRITICAL - Without option sets, customizations don't exist
**Complexity**: MEDIUM - Requires option_set_id mapping
**Current Issue**: No option sets duplicated; menu items can't have modifiers

### 5. **option_set_items**
**Relationship**: Belongs to option_set
```
option_set_id (FK) → option_sets
organisation_id (FK) → organisations
```
**Impact**: CRITICAL - Individual option choices are missing
**Complexity**: MEDIUM - Requires option_set_id mapping
**Current Issue**: Even if option sets were duplicated, individual options would be missing

## Critical Missing Feature: ID Mapping Tracking

### Current Mapping
```sql
v_menu_mapping := v_menu_mapping || jsonb_build_object(v_old_menu_id::text, v_new_menu_id);
```
Only tracks menu ID mappings!

### Required Mappings
1. **Menu mapping** ✅ (already implemented)
2. **Category mapping** ❌ (CRITICAL - menu_items reference categories)
3. **Menu item mapping** ❌ (CRITICAL - needed for images and option sets)
4. **Option set mapping** ❌ (CRITICAL - needed for option set items and menu_item_option_sets)

## Data Integrity Issues

### Issue 1: Invalid Category References
```sql
INSERT INTO menu_items (
  ...
  category_id,  -- ⚠️ References OLD category from source org!
  ...
)
```
**Problem**: Duplicated menu items have `category_id` pointing to categories in the source organization
**Impact**: Category lookups fail; data integrity violations possible

### Issue 2: No Images
**Problem**: `item_images` table not duplicated
**Impact**: Duplicated menu items appear without images

### Issue 3: No Customization Options
**Problem**: `option_sets`, `option_set_items`, and `menu_item_option_sets` not duplicated
**Impact**: Customers can't customize items (sizes, add-ons, modifiers)

### Issue 4: Incomplete Menu Structure
**Problem**: Categories not duplicated
**Impact**: Menu organization is lost; items can't be properly grouped

## Intentionally NOT Duplicated

These tables should NOT be duplicated (by design):
- ✅ `extraction_jobs` - Job history specific to original restaurant
- ✅ `pumpd_accounts` - Account credentials should not be duplicated
- ✅ `pumpd_restaurants` - Pumpd integration should not be duplicated
- ✅ `usage_events` - Event history specific to original restaurant

## User Experience Impact

### Current Implementation
When a restaurant is duplicated, the user gets:
- ✅ Basic restaurant information
- ✅ Menu structure (names, descriptions)
- ✅ Menu items (names, descriptions, prices)
- ❌ **Categories** (items appear uncategorized)
- ❌ **Menu item images** (all items show without images)
- ❌ **Customization options** (no sizes, modifiers, add-ons)
- ❌ **Option choices** (no "Large", "Extra Cheese", etc.)

### Expected Complete Duplication
After fix, user should get:
- ✅ Basic restaurant information
- ✅ Menu structure
- ✅ Menu items
- ✅ **Categories** (proper organization)
- ✅ **Menu item images** (all images duplicated)
- ✅ **Customization options** (all option sets)
- ✅ **Option choices** (all individual options)

## Complexity Analysis

### Duplication Order (Dependency Chain)
```
1. Restaurant (already done)
2. Menus (already done, mapping tracked)
3. Categories (NEW - must come before menu items!)
4. Menu items (existing, but needs category mapping update)
5. Option sets (NEW - independent)
6. Option set items (NEW - depends on option sets)
7. Item images (NEW - depends on menu items)
8. Menu item option sets (NEW - depends on menu items and option sets)
```

### Mapping Requirements
```javascript
{
  menus: { old_uuid: new_uuid },        // ✅ Already tracked
  categories: { old_uuid: new_uuid },   // ❌ Need to add
  menu_items: { old_uuid: new_uuid },   // ❌ CRITICAL - need to add
  option_sets: { old_uuid: new_uuid }   // ❌ Need to add
}
```

## Comparison with reassign_restaurant_to_org

| Aspect | Reassignment | Duplication |
|--------|--------------|-------------|
| Purpose | Move to new org | Create copy in new org |
| Original data | Modified | Unchanged |
| ID tracking | Not needed | Critical |
| Complexity | Medium | High |
| Tables updated | 11 | 8 (5 new + 3 existing) |

## Root Cause Analysis

### Why These Tables Were Missed
1. **Incremental Development**: Function likely built in stages, not completed
2. **No ID Tracking**: menu_item_id mapping not implemented
3. **Incomplete Specification**: Requirements didn't specify full data model
4. **Testing Gaps**: Tests didn't verify complete menu functionality

### Why This Is More Complex Than Reassignment
1. **ID Mapping**: Must track and remap all foreign key references
2. **Order Dependency**: Must duplicate in correct order to maintain references
3. **Multiple Mappings**: Need 4 separate mapping structures
4. **Complex Joins**: Must update FKs using mapping tables

## Testing Strategy

### Test Cases
1. **Simple Restaurant**: No categories, no options, no images
   - Expected: Restaurant + menus + items duplicated

2. **Restaurant with Categories**: Multiple categories
   - Expected: Categories duplicated, menu items reference new categories

3. **Restaurant with Images**: Multiple images per item
   - Expected: All images duplicated with new menu_item_id references

4. **Restaurant with Options**: Complex option sets
   - Expected: Option sets, items, and associations all duplicated

5. **Full Featured Restaurant**: Everything
   - Expected: Complete functional copy with all features

### Validation Queries
After duplication:
- [ ] All menu items have valid category_id (in target org)
- [ ] All item images reference new menu_item_id
- [ ] All option sets exist in target org
- [ ] All menu_item_option_sets reference new IDs
- [ ] No foreign key references to source org data

## Performance Considerations

### Current Implementation Issues
- Uses cursor loop for menus (acceptable)
- No batch inserts for menu items
- No transaction wrapper visible

### Optimization Opportunities
1. Use temporary tables for ID mappings
2. Batch insert menu items, images, options
3. Use CTEs for cleaner code
4. Add progress tracking for large restaurants

## Recommended Solution Approach

### Phase 1: Add ID Mapping Tracking
- Track category_id mappings
- Track menu_item_id mappings (CRITICAL)
- Track option_set_id mappings

### Phase 2: Duplicate Missing Tables
- Categories (before menu items)
- Option sets (independent)
- Option set items (after option sets)
- Item images (after menu items)
- Menu item option sets (after menu items and option sets)

### Phase 3: Update Foreign Key References
- Update menu_items.category_id to use new category IDs
- Ensure all FKs reference new duplicated records

### Phase 4: Return Comprehensive Result
- Return new restaurant ID (existing)
- Return duplication statistics (NEW)
- Return mappings for debugging (optional)

## Next Steps
1. Review and validate this analysis
2. Create detailed implementation plan
3. Develop complete SQL function
4. Build comprehensive test suite
5. Test in development environment
6. Deploy to production

## Success Criteria
- [ ] All 8 tables duplicated correctly
- [ ] All foreign key references valid
- [ ] No orphaned records
- [ ] ID mappings tracked correctly
- [ ] Complete functional restaurant copy
- [ ] Performance < 5 seconds for large restaurants
