# Implementation Plan: Apply Item Tags to Menu Items

## Status Overview

| Component | Status | Notes |
|-----------|--------|-------|
| `add-item-tags.js` | **COMPLETE** | Payload mode + menu item selection with fallback selectors |
| `registration-routes.js` | **COMPLETE** | Accepts menuId, fetches tags, builds payload, 60min timeout |
| `registration-batch-service.js` | **COMPLETE** | Passes menuId to endpoint (conditional like option sets) |
| `RestaurantDetail.jsx` | **COMPLETE** | Menu selector dropdown + updated handler |

---

## IMPLEMENTATION COMPLETE

All four components have been fully implemented and tested.

---

## Completed Work

### 1. add-item-tags.js (DONE)

The script has been fully updated with:

1. **Payload mode support** (lines 103-149)
   - Reads JSON payload from `--payload` argument
   - Falls back to CLI args for legacy mode
   - Validates required parameters

2. **Confirmed selectors** (lines 83-87)
   ```javascript
   // User-confirmed selector - nth-child(2) for Add/Remove tab
   addRemoveItemsTab: '#tag-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div',
   menuExpandArrow: 'form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg'
   ```

3. **Menu item selection logic with fallback** (lines 454-548)
   - Navigates to "Add / Remove From Items" tab
   - **Primary selector** for menu expand arrow
   - **Fallback selector** using `form div.cursor.flex-center > svg` if primary fails
   - Expands all category sections
   - Selects items using `span.m-l-2:text-is()` selector
   - Handles Featured Items duplicates (clicks ALL matches)
   - Deduplicates input with `Set`

4. **Enhanced logging and summary** (lines 480-488)
   - Tracks `totalItemsAssigned` counter
   - Reports match statistics per tag
   - Logs which selector approach worked

---

### 2. registration-routes.js (DONE)

The `/add-item-tags` endpoint has been updated (lines 2871-3137):

1. **Accepts menuId parameter**
   ```javascript
   const { restaurantId, menuId } = req.body;
   ```

2. **Fetches menu items with tags** (when menuId provided)
   - Queries `menu_items` table for items with non-null tags
   - Case-insensitive matching against preset tags
   - Maps tag variants (e.g., "most liked" → "Popular")

3. **Builds JSON payload**
   - Creates temp file with credentials and itemTags array
   - Each tag includes `menuItemNames` array

4. **Enhanced timeout and cleanup**
   - 60 minute timeout (increased from 3 minutes)
   - Cleans up temp file after execution
   - Parses summary from script output

---

### 3. registration-batch-service.js (DONE)

Updated `getSubStepEndpoint` function (line 2171-2177):

```javascript
itemTags: {
  endpoint: menu.selectedMenuId ? '/api/registration/add-item-tags' : null,
  payload: {
    restaurantId,
    menuId: menu.selectedMenuId,
  },
},
```

- Endpoint is now conditional on `selectedMenuId` (like option sets)
- Passes `menuId` in payload for menu item assignment

---

### 4. RestaurantDetail.jsx (DONE)

Updated the Registration tab UI:

1. **New state variable** (line 284)
   ```javascript
   const [selectedMenuForItemTags, setSelectedMenuForItemTags] = useState('');
   ```

2. **Updated handler** (lines 946-1011)
   - Requires menu selection before proceeding
   - Passes `menuId: selectedMenuForItemTags` in API call
   - Shows items assigned count in success message

3. **New UI section** (lines 5909-5971)
   - "Add Item Tags from Menu" section with border separator
   - Menu dropdown (same style as Option Sets)
   - Button disabled until menu is selected

---

## Key Selectors (Confirmed Working)

| Selector | Purpose | Value |
|----------|---------|-------|
| Tab container ID | Internal form tabs | `#tag-tab-options-tab-select-content` |
| `addRemoveItemsTab` | Navigate to menu item selection | `...div:nth-child(2) > div` |
| `menuExpandArrow` | Expand menu tree root | Primary + fallback approach |
| Category expanders | Expand categories | `form div.m-l-2 > div > div > div.cursor.flex-center > svg` |
| Menu item labels | Checkbox selection | `span.m-l-2:text-is("${itemName}")` |

---

## Testing

### Manual Testing Steps

1. Go to a restaurant's Registration tab
2. Select a menu from the "Add Item Tags from Menu" dropdown
3. Click "Add Item Tags"
4. Watch console for:
   - "Switched to Add/Remove From Items tab"
   - "Expanded Menu tree (primary selector)" or "(fallback)"
   - Category expanders found count
   - Checked items with counts
5. Verify in CloudWaitress that tags have correct items assigned

### API Testing

```bash
# Enhanced mode (with menu item assignment)
curl -X POST http://localhost:3007/api/registration/add-item-tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"restaurantId": "uuid", "menuId": "menu-uuid"}'
```

---

## Files Modified

| File | Changes |
|------|---------|
| `scripts/restaurant-registration/add-item-tags.js` | Payload mode, new selectors, fallback logic, menu item selection |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Accept menuId, fetch tags, build payload, 60min timeout |
| `UberEats-Image-Extractor/src/services/registration-batch-service.js` | Pass menuId, conditional endpoint |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Menu selector dropdown, updated handler |

---

## Performance Considerations

| Scenario | Estimated Time |
|----------|----------------|
| Create tags only (legacy) | ~30 seconds |
| Create + assign (10 items total) | ~1 minute |
| Create + assign (50 items total) | ~3 minutes |
| Create + assign (200+ items) | ~8 minutes |

Timeout is set to 60 minutes to handle large menus.

---

## Backwards Compatibility

- **Without menuId**: Creates all 10 preset tags without menu item assignment (legacy behavior)
- **With menuId**: Creates tags AND applies them to extracted menu items
- **Batch service**: Endpoint is null if no menu selected (skips item tags step)
