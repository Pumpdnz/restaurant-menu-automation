# Critical Issues to Fix - Option Sets Implementation

Generated: 2025-09-04
Status: **BLOCKING - Must fix before frontend changes**

---

## 🚨 Priority 1: Database Constraint Violation (BLOCKING)

### Issue
Option sets failing to save due to check constraint violation:
```
Error: new row for relation "option_sets" violates check constraint "check_extraction_source"
```

### Impact
- **ALL option sets fail to save** (0 saved out of 6 master sets + all unique sets)
- Junction table entries cannot be created
- Menu items have no option sets

### Root Cause
Database has a CHECK constraint on `extraction_source` column that we're violating.

### Investigation Needed
1. Check what the constraint expects
2. Verify what value we're sending ('premium')
3. Fix the mismatch

### Example Failures
```log
[Database] Error saving option set: {
  code: '23514',
  message: 'new row for relation "option_sets" violates check constraint "check_extraction_source"'
}
[Database] Successfully saved/retrieved 0 unique option sets
```

---

## 🚨 Priority 2: Frontend Query Failure (BLOCKING)

### Issue
Menu fetch query still uses old relationship structure:
```
Error: Could not find a relationship between 'menu_items' and 'option_sets' in the schema cache
Hint: Perhaps you meant 'menu_item_option_sets' instead of 'option_sets'
```

### Impact
- Frontend cannot display menus with option sets
- Application breaks when viewing menu details

### Root Cause
`getMenuWithItems()` query still expects direct foreign key from option_sets to menu_items, but we removed that relationship.

### Fix Required
Update query to use junction table:
```javascript
// OLD (broken)
menu_items (
  *,
  option_sets (*)
)

// NEW (needed)
menu_items (
  *,
  menu_item_option_sets (
    option_set:option_sets (
      *,
      option_set_items (*)
    )
  )
)
```

---

## ⚠️ Priority 3: Extraction Performance Issue

### Issue
Categories are extracted in pairs but wait for both to complete before starting next pair.

### Current Behavior
```log
[05:42:48] Extracting items from category: Sides
[05:42:48] Extracting items from category: Biryani
[05:42:48] Extracted 6 items from Sides
[05:42:51] Extracted 1 items from Biryani  // 3 second wait!
[05:42:51] Extracting items from category: Hot Beverages  // Only starts after BOTH complete
```

### Expected Behavior
- Start next category immediately when ANY category completes
- Don't wait for slowest category in batch

### Impact
- Extraction takes longer than necessary
- Poor user experience with delays

### Solution Approach
Use Promise.race() or individual promise handling instead of Promise.all() for batches.

---

## ⚠️ Priority 4: No Retry for Failed Categories

### Issue
Categories that return 0 items are not retried, potentially missing data.

### Example
```log
[0] Extracted 0 items from Vegetarian currys  // Likely failed, no retry
[0] Extracted 8 items from currys              // Succeeded
```

### Impact
- Missing menu items
- Incomplete menus
- Poor extraction quality

### Solution Needed
1. Detect 0-item responses
2. Retry with modified prompt or approach
3. Log persistent failures for manual review

---

## ℹ️ Priority 5: Duplicate Image URLs (Warning)

### Issue
Multiple menu items share the same image URLs, creating duplicates.

### Example
```log
[Database] WARNING: Duplicate image URLs detected:
  - https://tb-static.uber.com/... appears 3 times
  - https://tb-static.uber.com/... appears 6 times
  - null... appears 7 times
```

### Impact
- Unnecessary storage of duplicate images
- Inefficient CDN uploads
- Wasted bandwidth

### Solution Options
1. Deduplicate images at extraction time
2. Create shared image table with references
3. Skip duplicate uploads to CDN

---

## 🔧 Fix Implementation Order

### Phase 1: Critical Fixes (Must do first)
1. **Fix extraction_source constraint** ✅ Highest Priority
   - Query the constraint definition
   - Update our code to match expected values
   - Test option set saving

2. **Update getMenuWithItems query** ✅ Highest Priority
   - Modify to use junction table
   - Test frontend menu display
   - Ensure option sets load correctly

### Phase 2: Performance & Quality
3. **Improve extraction concurrency**
   - Replace Promise.all() with better concurrency model
   - Start next category as soon as one completes

4. **Add retry logic for failed categories**
   - Detect 0-item responses
   - Implement retry with backoff
   - Log persistent failures

### Phase 3: Optimization
5. **Handle duplicate images**
   - Implement deduplication strategy
   - Consider shared image references

---

## 🧪 Testing Requirements

### After Fix 1 & 2:
```sql
-- Verify option sets are saved
SELECT COUNT(*) FROM option_sets WHERE option_set_hash IS NOT NULL;

-- Verify junction entries exist
SELECT COUNT(*) FROM menu_item_option_sets;

-- Check frontend query works
-- Navigate to menu in UI and verify no errors
```

### Success Criteria
1. ✅ Option sets save without constraint errors
2. ✅ Junction table has entries linking items to sets
3. ✅ Frontend displays menu with option sets
4. ✅ Extraction completes faster
5. ✅ No missing menu categories

---

## 📊 Current State Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Option Set Saving | ❌ FAILED | Check constraint violation |
| Junction Table | ❌ EMPTY | No entries due to save failure |
| Frontend Query | ❌ BROKEN | Uses old relationship |
| Extraction Speed | ⚠️ SLOW | Poor concurrency |
| Data Quality | ⚠️ INCOMPLETE | Missing categories |
| Image Handling | ⚠️ INEFFICIENT | Duplicates not handled |

---

## 🚨 Action Required

**MUST FIX #1 and #2 before any frontend work can proceed!**

The option sets deduplication logic is working correctly, but the database save is completely broken due to the constraint violation. Additionally, even if we fix saving, the frontend cannot display the data due to the outdated query structure.

---

*Document Created: 2025-09-04*
*Status: Multiple blocking issues identified*
*Next Step: Fix extraction_source constraint violation*