# Option Sets Migration Status
## Database Schema Migration Progress

Generated: 2025-09-04

---

## ✅ Completed Database Changes

### 1. Created Junction Table ✅
- Table: `menu_item_option_sets`
- Columns: id, menu_item_id, option_set_id, display_order, created_at, organisation_id
- Indexes: Created on menu_item_id, option_set_id, organisation_id
- Unique constraint: (menu_item_id, option_set_id)
- RLS: Enabled with organization isolation policy

### 2. Added Hash Column ✅
- Added `option_set_hash VARCHAR(64)` to `option_sets` table
- Created index `idx_option_sets_hash`

### 3. Migrated Existing Data ✅
- Migrated 38 option_set relationships to junction table
- All existing menu_item → option_set relationships preserved

### 4. Removed Old Foreign Key ✅
- Dropped `option_sets_menu_item_id_fkey` constraint
- Dropped `menu_item_id` column from `option_sets`
- Dropped indexes: `idx_option_sets_menu_item`, `idx_option_sets_display_order`

---

## 📊 Current Database State

### Junction Table Records
```sql
SELECT COUNT(*) FROM menu_item_option_sets;
-- Result: 38 records
```

### Option Sets Status
```sql
SELECT COUNT(*) FROM option_sets;
-- Result: 38 option sets (all from menu df3cb573-720e-4375-ab4c-705adb0aee32)
```

### Option Set Items Status
```sql
SELECT COUNT(*) FROM option_set_items;
-- Result: 151 items across 38 option sets
```

---

## ⚠️ Pending Database Changes

### 1. Unique Constraint on Hash
**Status**: Pending - Cannot add until hashes are generated for existing records

```sql
-- Will be added after hash generation logic is implemented
ALTER TABLE option_sets 
ADD CONSTRAINT unique_option_set_per_org 
UNIQUE(organisation_id, option_set_hash);
```

**Blocker**: Need to implement hash generation function first and populate existing records

---

## 🔄 Next Steps

### Immediate Priority (Backend)
1. ✅ Create option-sets-deduplication-service.js with hash generation
2. ⏳ Generate and populate hashes for existing option_sets
3. ⏳ Add unique constraint after hashes are populated
4. ⏳ Update database-service.js functions
5. ⏳ Update premium-extraction-service.js

### Frontend Changes (After Backend)
1. ⏳ Remove OptionSetEditor from EditableMenuItem
2. ⏳ Update menu fetching to use junction table
3. ⏳ Create Option Sets Management UI

---

## 🎯 Migration Verification Checklist

### Database Structure ✅
- [x] Junction table created
- [x] Hash column added
- [x] Old foreign key removed
- [x] Indexes updated
- [ ] Unique constraint added (pending hash generation)

### Data Integrity ✅
- [x] All option_sets preserved (38 records)
- [x] All option_set_items preserved (151 records)
- [x] All relationships migrated to junction table
- [x] No data loss during migration

### Performance Considerations
- [x] Indexes on junction table foreign keys
- [x] Index on option_set_hash column
- [ ] Query performance testing (pending)

---

## 📝 Notes

1. **Hash Generation**: The unique constraint cannot be added until we implement the hash generation logic and populate existing records with hash values.

2. **No Deduplication Yet**: The 38 existing option_sets have not been deduplicated yet. This will happen when:
   - Hash generation is implemented
   - Deduplication logic identifies duplicates
   - Junction table is updated to point duplicates to master records

3. **Frontend Still Works**: The frontend will break once we update the queries. We need to update the backend services first.

4. **RLS Policies**: The junction table has RLS enabled, but we may need to review and update policies for the modified option_sets table.

---

## 🚀 Success Metrics

When complete, we should see:
- [ ] Reduction in option_sets table from 38 to ~10-15 unique sets
- [ ] All menu items correctly linked through junction table
- [ ] Bulk editing of option sets works correctly
- [ ] No performance degradation in menu loading
- [ ] Zero data loss or corruption

---

## 🔍 Verification Queries

### Check Junction Table Integrity
```sql
-- Verify all option_sets are linked
SELECT COUNT(DISTINCT os.id) as orphaned_option_sets
FROM option_sets os
LEFT JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
WHERE mios.id IS NULL;
```

### Check for Duplicate Option Sets (by name)
```sql
SELECT name, COUNT(*) as count, organisation_id
FROM option_sets
GROUP BY name, organisation_id
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

### Verify Menu Item Links
```sql
SELECT mi.name as menu_item, os.name as option_set
FROM menu_items mi
JOIN menu_item_option_sets mios ON mi.id = mios.menu_item_id
JOIN option_sets os ON mios.option_set_id = os.id
WHERE mi.menu_id = 'df3cb573-720e-4375-ab4c-705adb0aee32'
ORDER BY mi.name, mios.display_order;
```

---

*Last Updated: 2025-09-04 - Database schema migration complete, pending backend implementation*