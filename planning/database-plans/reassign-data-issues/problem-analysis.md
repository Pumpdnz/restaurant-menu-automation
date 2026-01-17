# Restaurant Data Reassignment - Problem Analysis

## Overview
The current `reassign_restaurant_to_org` RPC function fails to update `organisation_id` for several critical tables, resulting in incomplete data reassignment when restaurants are moved between organizations.

## Current RPC Function Scope
The function currently updates:
- ✅ `restaurants` - Direct restaurant record
- ✅ `menus` - Via `restaurant_id`
- ✅ `extraction_jobs` - Via `restaurant_id`
- ✅ `menu_items` - Via JOIN with `menus`
- ✅ `categories` - Via JOIN with `menus`
- ✅ `usage_events` - Logging entry

## Missing Tables Analysis

### 1. **pumpd_accounts**
**Relationship**: Direct via `restaurant_id`
```
organisation_id (FK) → organisations
restaurant_id (FK) → restaurants
```
**Impact**: HIGH - Users lose access to Pumpd account credentials and registration information
**Complexity**: LOW - Direct `restaurant_id` relationship

### 2. **pumpd_restaurants**
**Relationship**: Direct via `restaurant_id`
```
organisation_id (FK) → organisations
restaurant_id (FK) → restaurants
pumpd_account_id (FK) → pumpd_accounts
```
**Impact**: HIGH - Breaks Pumpd integration, subdomain access, webhook secrets, API keys
**Complexity**: LOW - Direct `restaurant_id` relationship

### 3. **item_images**
**Relationship**: Indirect via `menu_item_id`
```
organisation_id (FK) → organisations
menu_item_id (FK) → menu_items
```
**Chain**: `item_images` → `menu_items` → `menus` → `restaurants`
**Impact**: HIGH - Menu item images become inaccessible to new organization
**Complexity**: MEDIUM - Requires JOIN through menu_items

### 4. **menu_item_option_sets**
**Relationship**: Indirect via `menu_item_id` and `option_set_id`
```
organisation_id (FK) → organisations
menu_item_id (FK) → menu_items
option_set_id (FK) → option_sets
```
**Chain**: `menu_item_option_sets` → `menu_items` → `menus` → `restaurants`
**Impact**: HIGH - Breaks menu customization options (sizes, add-ons, modifiers)
**Complexity**: MEDIUM - Requires JOIN through menu_items

### 5. **option_sets**
**Relationship**: Indirect via `menu_item_option_sets`
```
organisation_id (FK) → organisations
(No direct restaurant_id, menu_id, or menu_item_id)
```
**Chain**: `option_sets` → `menu_item_option_sets` → `menu_items` → `menus` → `restaurants`
**Impact**: HIGH - Option sets become orphaned and inaccessible
**Complexity**: HIGH - No direct link; must traverse through menu_item_option_sets
**Special Consideration**: Option sets may be shared across multiple menu items

### 6. **option_set_items**
**Relationship**: Indirect via `option_set_id`
```
organisation_id (FK) → organisations
option_set_id (FK) → option_sets
```
**Chain**: `option_set_items` → `option_sets` → `menu_item_option_sets` → `menu_items` → `menus` → `restaurants`
**Impact**: HIGH - Individual option choices become inaccessible (e.g., "Large", "Extra Cheese")
**Complexity**: HIGH - Depends on option_sets being updated first

## Data Integrity Concerns

### Unique Constraints
- **pumpd_accounts**: `(organisation_id, email)` and `(organisation_id, restaurant_id, email)` UNIQUE
  - **Risk**: Email conflicts if target org already has account with same email
- **pumpd_restaurants**: `(organisation_id, restaurant_id)` and `pumpd_subdomain` UNIQUE
  - **Risk**: Subdomain conflicts unlikely but possible

### Foreign Key Cascades
- All tables have proper FK constraints with `ON DELETE CASCADE`
- No cascade issues expected during reassignment (UPDATE operations)

### Option Sets Scope
**Option Sets** are restaurant-specific:
- Each option set belongs exclusively to one restaurant's menu items
- Option sets are NOT shared across different restaurants
- Safe to reassign all option sets used by the restaurant's menu items

## Impact Assessment

### User Experience Impact
1. **Before Reassignment**: User in Org A can see all restaurant data
2. **After Current Implementation**: User in Org B sees:
   - ✅ Restaurant basic info
   - ✅ Menus
   - ✅ Menu items
   - ✅ Categories
   - ❌ Menu item images (broken image links)
   - ❌ Menu customization options (sizes, modifiers)
   - ❌ Individual option choices
   - ❌ Pumpd account credentials
   - ❌ Pumpd restaurant configuration
   - ❌ Webhook secrets and API keys

### Data Completeness
Current implementation reassigns approximately **60%** of related data:
- Missing **6 critical tables** with organization-scoped access
- Renders restaurant partially functional but critically incomplete

## Root Cause Analysis

### Why These Tables Were Missed
1. **Indirect Relationships**: Tables without direct `restaurant_id` FK
2. **Complex Join Paths**: Requires understanding full data model
3. **New Tables**: `pumpd_accounts` and `pumpd_restaurants` may have been added after initial RPC creation
4. **Incomplete Documentation**: Relationship mapping not fully documented

### Schema Design Observations
- Organization-based multi-tenancy implemented consistently
- All relevant tables have `organisation_id` column
- Well-indexed for organization-based queries
- FK constraints properly defined with cascade deletes

## Recommended Solution Approach

### Phase 1: Direct Relationships (Simple)
Update tables with direct `restaurant_id`:
- `pumpd_accounts`
- `pumpd_restaurants`

### Phase 2: Menu Item Descendants (Medium)
Update tables joined through `menu_items`:
- `item_images`
- `menu_item_option_sets`

### Phase 3: Option Sets Hierarchy (Complex)
Update option-related tables:
- `option_sets` (via menu_item_option_sets join)
- `option_set_items` (via option_sets)

### Execution Order
Must respect dependency chain:
1. `pumpd_accounts`, `pumpd_restaurants` (independent)
2. `item_images`, `menu_item_option_sets` (independent, depend on menu_items being updated)
3. `option_sets` (depends on menu_item_option_sets existence)
4. `option_set_items` (depends on option_sets being updated)

## Validation Requirements

### Pre-Reassignment Checks
- [ ] Target organization exists and is active
- [ ] Restaurant exists and belongs to source organization
- [ ] No email conflicts in pumpd_accounts
- [ ] No subdomain conflicts in pumpd_restaurants

### Post-Reassignment Verification
- [ ] All tables have updated organisation_id
- [ ] No orphaned records remain
- [ ] FK relationships remain intact
- [ ] Record counts match before/after

### Rollback Strategy
- Transaction-based approach (all or nothing)
- Log original organisation_id before changes
- Maintain audit trail in usage_events

## Testing Strategy

### Test Cases
1. **Simple Restaurant**: No options, no images
2. **Complex Restaurant**: Multiple menus, categories, items with options and images
3. **Edge Cases**:
   - Restaurant with no menus
   - Restaurant with Pumpd integration
   - Restaurant with no Pumpd integration
   - Concurrent reassignment attempts

### Verification Queries
Queries to verify complete reassignment:
```sql
-- Count records by table for a restaurant's original org
SELECT 'restaurants' as table_name, COUNT(*)
FROM restaurants WHERE id = 'restaurant_id' AND organisation_id = 'old_org_id'
UNION ALL
-- ... repeat for each table
```

## Next Steps
1. Review and validate this analysis
2. Proceed to implementation plan
3. Create comprehensive test suite
4. Implement RPC function updates
5. Test in development branch
6. Deploy to production with monitoring