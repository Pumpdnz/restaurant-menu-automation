# Menu Merge Feature - Database Migration Status

## Overview
Database migrations for the menu merge feature implementation.

## Migration Files Created

### ✅ 001_add_merge_operations_table.sql
**Status:** ✅ APPLIED  
**Created:** 2025-08-22  
**Description:** Creates the `merge_operations` table to track menu merge history and audit trail.

**Tables Created:**
- `merge_operations` - Stores merge operation records

**Indexes Added:**
- `idx_merge_operations_restaurant`
- `idx_merge_operations_result_menu`
- `idx_merge_operations_created_at`
- `idx_merge_operations_source_menus` (GIN index for array)

---

### ✅ 002_add_merge_decisions_table.sql
**Status:** ✅ APPLIED  
**Created:** 2025-08-22  
**Description:** Creates the `merge_decisions` table for tracking individual item-level merge decisions.

**Tables Created:**
- `merge_decisions` - Stores individual merge decisions for duplicate items

**Indexes Added:**
- `idx_merge_decisions_operation`
- `idx_merge_decisions_group`
- `idx_merge_decisions_type`

---

### ✅ 003_update_menus_table_merge_fields.sql
**Status:** ✅ APPLIED  
**Created:** 2025-08-22  
**Description:** Adds merge tracking fields to the existing `menus` table.

**Columns Added to `menus` table:**
- `merge_source_ids` (UUID[]) - Array of source menu IDs
- `is_merged` (BOOLEAN) - Flag for merged menus
- `merge_operation_id` (UUID) - Reference to merge operation

**Indexes Added:**
- `idx_menus_is_merged` (partial index)
- `idx_menus_merge_operation`
- `idx_menus_merge_sources` (GIN index for array)

---

### ✅ 004_create_merge_functions.sql
**Status:** ✅ APPLIED  
**Created:** 2025-08-22  
**Description:** Creates database functions for menu merge operations.

**Functions Created:**
1. `calculate_item_similarity(item1 JSONB, item2 JSONB)` 
   - Returns similarity score (0.00-1.00) between two menu items
   - Uses weighted scoring: 40% name, 30% description, 20% price, 10% category

2. `find_duplicate_items(menu_ids UUID[], threshold DECIMAL)`
   - Finds duplicate items across multiple menus
   - Default threshold: 0.85 (85% similarity)
   - Returns pairs of similar items with scores

3. `get_unique_menu_items(menu_ids UUID[], exclude_duplicates BOOLEAN)`
   - Gets unique items from specified menus
   - Can optionally exclude items detected as duplicates

4. `create_merged_menu(restaurant_id, source_menu_ids, platform_id, merge_config, performed_by)`
   - Creates a new menu from merging multiple sources
   - Records merge operation for audit trail
   - Auto-increments version number

**Extensions Required:**
- `pg_trgm` - PostgreSQL trigram extension for fuzzy text matching

---

## Application Order

Run migrations in this sequence:

```bash
# 1. Create merge operations table
psql -d your_database -f 001_add_merge_operations_table.sql

# 2. Create merge decisions table
psql -d your_database -f 002_add_merge_decisions_table.sql

# 3. Update menus table
psql -d your_database -f 003_update_menus_table_merge_fields.sql

# 4. Create functions (requires pg_trgm extension)
psql -d your_database -f 004_create_merge_functions.sql
```

## Rollback Scripts

If needed, migrations can be rolled back:

```sql
-- Rollback 004
DROP FUNCTION IF EXISTS create_merged_menu CASCADE;
DROP FUNCTION IF EXISTS get_unique_menu_items CASCADE;
DROP FUNCTION IF EXISTS find_duplicate_items CASCADE;
DROP FUNCTION IF EXISTS calculate_item_similarity CASCADE;

-- Rollback 003
ALTER TABLE menus 
DROP COLUMN IF EXISTS merge_source_ids,
DROP COLUMN IF EXISTS is_merged,
DROP COLUMN IF EXISTS merge_operation_id;

-- Rollback 002
DROP TABLE IF EXISTS merge_decisions CASCADE;

-- Rollback 001
DROP TABLE IF EXISTS merge_operations CASCADE;
DROP FUNCTION IF EXISTS update_merge_operations_updated_at CASCADE;
```

## Testing Queries

After applying migrations, test with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('merge_operations', 'merge_decisions');

-- Check menu columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menus' 
AND column_name IN ('merge_source_ids', 'is_merged', 'merge_operation_id');

-- Test similarity function
SELECT calculate_item_similarity(
  '{"name": "Margherita Pizza", "price": 25.00}'::JSONB,
  '{"name": "Margarita Pizza", "price": 26.00}'::JSONB
);
-- Expected: ~0.90 (high similarity)

-- Check pg_trgm extension
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

## Next Steps

After migrations are applied:

1. ✅ **Database Layer Complete** - All tables and functions ready
2. ⏳ **Backend Services** - Implement MenuMergeService in Node.js
3. ⏳ **API Endpoints** - Create merge validation, comparison, and execution endpoints
4. ⏳ **Frontend Components** - Build merge UI components
5. ⏳ **Testing** - Add comprehensive tests

## Notes

- All migrations are idempotent (can be run multiple times safely)
- Uses `IF NOT EXISTS` clauses to prevent errors on re-run
- Includes proper indexes for performance
- Foreign key constraints maintain referential integrity
- Trigger functions auto-update timestamps
- Comments added for documentation