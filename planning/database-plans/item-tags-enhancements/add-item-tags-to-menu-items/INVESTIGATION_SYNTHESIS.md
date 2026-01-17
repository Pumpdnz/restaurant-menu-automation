# Investigation Synthesis: Enhance add-item-tags.js to Apply Tags to Menu Items

## Executive Summary

This document synthesizes findings from 4 parallel investigation tasks to understand how to enhance `add-item-tags.js` to apply tags to menu items, mirroring the functionality in `add-option-sets.js`.

**Conclusion:** The enhancement is feasible and follows established patterns. The implementation requires changes to 3 files with an estimated effort of 8-14 hours.

---

## Key Findings Summary

### 1. UI Flow (Task 1)

**What Works in add-option-sets.js:**
- Uses `span.m-l-2:text-is("${itemName}")` selector with `xpath=ancestor::label` traversal
- Deduplicates input with `[...new Set(menuItemNames)]` before processing
- Clicks ALL matching checkboxes to handle Featured Items duplicates
- Removed `isChecked()` calls for ~10s per-item performance improvement

**Selectors for Item Tags (CONFIRMED):**
| Selector | Purpose | Value |
|----------|---------|-------|
| Tab container ID | Internal form tabs | `#tag-tab-options-tab-select-content` |
| `addRemoveItemsTab` | Navigate to menu item selection | `#tag-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(4) > div` |
| `menuExpandArrow` | Expand menu tree root | `form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg` |
| Category expanders | Expand categories | `form div.m-l-2 > div > div > div.cursor.flex-center > svg` |
| Menu item labels | Checkbox selection | `span.m-l-2:text-is("${itemName}")` |

**Key Discovery:** The tab container ID follows the pattern `#[feature]-tab-options-tab-select-content`:
- Option Sets: `#option-set-tab-options-tab-select-content`
- Item Tags: `#tag-tab-options-tab-select-content`

---

### 2. Database Data Flow (Task 2)

**Schema:**
- `menu_items.tags` is a PostgreSQL text array (`text[]`)
- No junction table - tags stored directly on menu items
- Tags have case inconsistencies from extraction (e.g., "Gluten Free" vs "Gluten free")

**Data Quality:**
- Useful tags: Vegetarian (44), Popular (27), Spicy (17), Gluten Free (7)
- Platform noise to filter: "Thumb up outline" (39), percentages, counts
- Recommendation: Use case-insensitive matching when building mappings

**Proposed Query Pattern:**
```javascript
const { data: menuItems } = await supabase
  .from('menu_items')
  .select('id, name, tags')
  .eq('menu_id', menuId)
  .not('tags', 'is', null);

// Build tag-to-items mapping with case-insensitive matching
const tagToItems = {};
menuItems.forEach(item => {
  item.tags?.forEach(tag => {
    const normalized = tag.toLowerCase();
    // Match against preset tags...
  });
});
```

---

### 3. API Invocation (Task 3)

**Current Invocation Paths:**
1. `POST /api/registration/add-item-tags` - Only receives `restaurantId`
2. `registration-batch-service.js` - Part of Phase 4, has `selectedMenuId` available but doesn't pass it
3. `RestaurantDetail.jsx` - Manual trigger, only sends `restaurantId`

**Key Differences from add-option-sets.js:**
| Aspect | add-item-tags.js | add-option-sets.js |
|--------|------------------|-------------------|
| Parameters | CLI args | JSON payload file |
| Receives menuId | No | Yes |
| Fetches menu items | No | Yes |
| Temp file | None | Creates/deletes |
| Timeout | 3 minutes | 60 minutes |

**Required API Changes:**
1. Accept `menuId` parameter
2. Fetch menu items with tags from database
3. Build tag-to-menuItems mapping
4. Write JSON payload to temp file
5. Execute script with `--payload` argument
6. Clean up temp file

---

### 4. Script Enhancement (Task 4)

**Current Script Structure:**
- 10 hardcoded tags in `ITEM_TAGS` constant
- 6 selectors (creation only, no menu item selection)
- CLI arguments for credentials
- No menu item association capability

**Proposed Payload Format:**
```json
{
  "email": "...",
  "password": "...",
  "restaurantName": "...",
  "adminUrl": "...",
  "itemTags": [
    {
      "name": "Popular",
      "color": "#b400fa",
      "menuItemNames": ["Burger", "Pizza", "Fries"]
    }
  ]
}
```

**New Logic to Add (from add-option-sets.js lines 641-707):**
1. Navigate to "Add / Remove From Items" tab
2. Expand menu tree root
3. Expand all category sections
4. Find and click checkboxes using `span.m-l-2:text-is()` selector
5. Handle duplicates with Set deduplication + click all matches

---

## Implementation Roadmap

### Phase 1: Payload Support (1-2 hours)
- Add JSON payload file reading to add-item-tags.js
- Maintain backwards compatibility with CLI args
- Test with hardcoded menuItemNames array

### Phase 2: Selector Validation (1-2 hours)
- Manually inspect Item Tags form UI in CloudWaitress
- Confirm/update selector paths for "Add / Remove From Items" tab
- Validate menu tree structure is identical to Option Sets form

### Phase 3: Menu Item Selection (2-3 hours)
- Copy logic from add-option-sets.js lines 641-707
- Adapt selectors for Item Tags form
- Add comprehensive logging

### Phase 4: API Integration (2-3 hours)
- Update `/add-item-tags` endpoint to accept menuId
- Add query for menu items with tags
- Build tag-to-menuItems mapping
- Generate JSON payload file

### Phase 5: Testing (2-4 hours)
- Test with real restaurant data
- Test edge cases (empty items, existing tags, large menus)
- Performance testing

**Total Estimated Effort: 8-14 hours**

---

## Technical Decisions Required

### Decision 1: Backwards Compatibility
**Options:**
- A) Require menuId (breaking change for manual triggers)
- B) Support both modes: CLI args (create only) + payload (create + apply)

**Recommendation:** Option B - maintain backwards compatibility

### Decision 2: Handling Existing Tags
**Options:**
- A) Skip existing tags (log and continue)
- B) Update existing tags with new menu items (more complex)

**Recommendation:** Option A - skip existing for initial implementation

### Decision 3: Frontend Changes
**Options:**
- A) Add menu selector for manual item tags trigger (like option sets)
- B) Share existing option sets menu selector
- C) No frontend changes (batch mode only)

**Recommendation:** Option C for initial release, Option A/B for polish

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Item Tags form UI differs from Option Sets | High | Manual UI inspection before implementation |
| Tag case sensitivity mismatches | Medium | Case-insensitive matching in query |
| Large menus slow performance | Medium | Increase timeout to 60 min like option sets |
| CloudWaitress UI changes | Medium | Use text-based fallback selectors |
| Duplicate tag names in database | Low | Normalize before querying |

---

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/restaurant-registration/add-item-tags.js` | Add payload support, new selectors, menu item selection logic |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Accept menuId, query menu items, build payload |
| `UberEats-Image-Extractor/src/services/registration-batch-service.js` | Pass menuId to item tags endpoint |

---

## Next Steps

1. **Validate UI Selectors** - Run add-item-tags.js with `--debug` and inspect Item Tags form
2. **Create Implementation Plan** - Based on validated selectors, create detailed implementation plan
3. **Implement Phase 1-2** - Payload support and selector validation
4. **Test and Iterate** - Validate with test restaurant before full rollout
