# Investigation Task 4: Script Enhancement Plan for add-item-tags.js

## Overview

This document analyzes the current `add-item-tags.js` script structure and compares it with `add-option-sets.js` to plan the modifications needed to support menu item selection (applying tags to specific menu items).

---

## 1. Current Script Structure Analysis

### 1.1 File Location
`/scripts/restaurant-registration/add-item-tags.js`

### 1.2 High-Level Script Flow

```
1. Parse CLI arguments (email, password, name, admin-url, debug)
2. Create browser and context
3. Login to admin portal
4. Navigate to restaurant dashboard
5. Smart restaurant matching by name
6. Click "Manage" button
7. Navigate to Menu section
8. Click "Item Tags" tab
9. Loop through ITEM_TAGS array:
   - Click "Create New Item Tag" button
   - Fill tag name field
   - Fill tag text field (same as name)
   - Click color picker, fill hex color
   - Click Save button
10. Close browser
```

### 1.3 Parameter Handling

**Current approach: CLI Arguments**
```javascript
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

// Parse arguments
const email = getArg('email');
const password = getArg('password');
const restaurantName = getArg('name');
const adminUrl = (getArg('admin-url') || DEFAULT_ADMIN_URL).replace(/\/$/, '');
```

**Validation:**
```javascript
if (!email || !password || !restaurantName) {
  console.error('Error: Missing required parameters');
  process.exit(1);
}
```

### 1.4 ITEM_TAGS Constant

**Current hardcoded tags (Lines 60-71):**
```javascript
const ITEM_TAGS = [
  { name: 'Popular', color: '#b400fa' },
  { name: 'New', color: '#3f92ff' },
  { name: 'Deal', color: '#4fc060' },
  { name: 'Vegan', color: '#36AB36' },
  { name: 'Vegetarian', color: '#32CD32' },
  { name: 'Gluten Free', color: '#FF8C00' },
  { name: 'Dairy Free', color: '#4682B4' },
  { name: 'Nut Free', color: '#DEB887' },
  { name: 'Halal', color: '#8B7355' },
  { name: 'Spicy', color: '#FF3333' }
];
```

**Observation:** These tags are fixed and don't include any `menuItemNames` array. The script creates all 10 tags regardless of which ones are needed.

### 1.5 Current SELECTORS Object (Lines 74-81)

```javascript
const SELECTORS = {
  createButton: '#scroll-root > div > div > div > div > div > div.m-t-8 > div.grid-2.xs.xs-gap.m-t-10 > div:nth-child(1) > div > button',
  tagNameField: 'form > div > div:nth-child(3) > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  tagTextField: 'form > div > div:nth-child(3) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  colorPicker: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj > div',
  colorInput: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',
  saveButton: 'form > div > div:nth-child(4) > button'
};
```

**Gap Analysis:** Missing selectors:
- `addRemoveItemsTab` - Tab to select which menu items get this tag
- `menuExpandArrow` - Arrow to expand the menu tree
- Tab navigation for the Item Tags form

### 1.6 Main Loop Structure (Lines 428-475)

```javascript
for (let i = 0; i < ITEM_TAGS.length; i++) {
  const tag = ITEM_TAGS[i];

  try {
    // Step 5.1: Click "Create New Item Tag" button
    await page.click(SELECTORS.createButton);

    // Step 5.2: Fill Tag Name field
    await page.locator(SELECTORS.tagNameField).fill(tag.name);

    // Step 5.3: Fill Tag Text field (same as tag name)
    await page.locator(SELECTORS.tagTextField).fill(tag.name);

    // Step 5.4: Click color picker to open it
    await page.click(SELECTORS.colorPicker);

    // Step 5.5: Fill color input with hex value
    await page.locator(SELECTORS.colorInput).fill(tag.color);

    // Step 5.6: Click Save button
    await page.click(SELECTORS.saveButton);

    // Step 5.7: Wait for save to complete
    await page.waitForTimeout(2000);

    successCount++;
  } catch (tagError) {
    failCount++;
    // Try to close modal on error
    await page.keyboard.press('Escape');
  }
}
```

**Gap Analysis:** No step exists for:
- Navigating to "Add / Remove From Items" tab
- Expanding the menu tree
- Selecting menu items via checkboxes

---

## 2. Comparison with add-option-sets.js Structure

### 2.1 Parameter Handling

**add-option-sets.js approach: JSON Payload File**
```javascript
const payloadPath = getArg('payload');

// Load payload from file
const payloadContent = await fs.readFile(payloadPath, 'utf-8');
const payload = JSON.parse(payloadContent);

const { email, password, restaurantName, optionSets, menuItemMappings } = payload;
const adminUrl = (adminUrlArg || payload.adminUrl || DEFAULT_ADMIN_URL).replace(/\/$/, '');
```

**Key Differences:**

| Aspect | add-item-tags.js | add-option-sets.js |
|--------|------------------|-------------------|
| Input method | CLI arguments | JSON file |
| Tag/Option data | Hardcoded constant | From payload |
| Menu items | Not supported | Via `menuItemNames` array |
| Flexibility | Fixed 10 tags | Dynamic based on payload |

### 2.2 SELECTORS Object Comparison

**add-option-sets.js (Lines 112-143):**
```javascript
const SELECTORS = {
  // Tab navigation
  optionSetsTab: '#scroll-root > div > div > div > div > div > div.group__ButtonGroupComponent-dVAWMN.puSOV.bsl-1 > button:nth-child(2)',

  // Create button
  createButton: '...',

  // Name inputs
  nameInput: '...',
  displayNameInput: '...',

  // Tab buttons within form
  conditionsTab: '#option-set-tab-options-tab-select-content > ... > div:nth-child(3) > div',
  optionsTab: '#option-set-tab-options-tab-select-content > ... > div:nth-child(2) > div',

  // Add / Remove From Items tab  <-- KEY SELECTOR
  addRemoveItemsTab: '#option-set-tab-options-tab-select-content > ... > div:nth-child(4) > div',
  menuExpandArrow: 'form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg',

  // Toggle and input selectors
  requiredToggle: '...',
  selectMultipleToggle: '...',
  // ...

  // Save button
  saveButton: 'form > div > div:last-child > button'
};
```

**Selectors Missing from add-item-tags.js:**
1. `addRemoveItemsTab` - To switch to menu item selection
2. `menuExpandArrow` - To expand the menu tree
3. No internal form tabs (Item Tags may have same/similar tab structure)

### 2.3 Menu Item Selection Logic (add-option-sets.js Lines 641-707)

```javascript
// Step 5.13: Add to menu items (if menuItemNames provided)
const menuItemNames = optionSet.menuItemNames || [];
if (menuItemNames.length > 0) {
  console.log(`    Adding to ${menuItemNames.length} menu items...`);

  try {
    // Click "Add / Remove From Items" tab
    await page.click(SELECTORS.addRemoveItemsTab);
    await page.waitForTimeout(500);

    // Expand the Menu tree
    try {
      await page.click(SELECTORS.menuExpandArrow);
      await page.waitForTimeout(300);
    } catch (expandError) {
      console.log('    Menu tree may already be expanded or not found');
    }

    // Expand all category sections
    const categoryExpanders = await page.locator('form div.m-l-2 > div > div > div.cursor.flex-center > svg').all();
    for (let k = 0; k < categoryExpanders.length; k++) {
      try {
        await categoryExpanders[k].click();
        await page.waitForTimeout(200);
      } catch (catError) {
        // Category may already be expanded
      }
    }

    // Find and click checkboxes for matching menu item names
    // Deduplicate names to handle Featured Items duplicates
    let matchedCount = 0;
    const uniqueMenuItemNames = [...new Set(menuItemNames)];

    for (const itemName of uniqueMenuItemNames) {
      try {
        // Find ALL matching spans (handles Featured Items duplicates)
        const labelSpanLocator = page.locator(`span.m-l-2:text-is("${itemName}")`);
        const count = await labelSpanLocator.count();

        if (count > 0) {
          // Click all matching checkboxes
          for (let i = 0; i < count; i++) {
            const labelSpan = labelSpanLocator.nth(i);
            const parentLabel = labelSpan.locator('xpath=ancestor::label');
            await parentLabel.click();
          }
          matchedCount++;
        } else {
          console.log(`      Not found: "${itemName}"`);
        }
      } catch (checkError) {
        console.log(`      Failed to check "${itemName}": ${checkError.message}`);
      }
    }
  } catch (addItemsError) {
    console.log(`    Failed to add menu items: ${addItemsError.message}`);
  }
}
```

**Critical Implementation Pattern:**
1. **Deduplication:** Uses `[...new Set(menuItemNames)]` to avoid double-clicking
2. **Featured Items Handling:** Clicks ALL matching checkboxes for same name
3. **Selector Pattern:** `span.m-l-2:text-is("${itemName}")` for exact text match
4. **Traversal:** Uses `xpath=ancestor::label` to find clickable element

---

## 3. Proposed Script Modifications

### 3.1 Enhanced Payload Structure

**New JSON payload format:**
```json
{
  "email": "test@example.com",
  "password": "Password123!",
  "restaurantName": "Test Restaurant",
  "adminUrl": "https://admin.pumpd.co.nz",
  "itemTags": [
    {
      "name": "Popular",
      "color": "#b400fa",
      "menuItemNames": ["Burger", "Pizza", "Fries"]
    },
    {
      "name": "Vegan",
      "color": "#36AB36",
      "menuItemNames": ["Garden Salad", "Veggie Wrap"]
    },
    {
      "name": "New",
      "color": "#3f92ff",
      "menuItemNames": []  // Empty = create tag but don't apply to any items
    }
  ]
}
```

**Key Design Decisions:**
- `itemTags` array replaces hardcoded `ITEM_TAGS` constant
- Each tag has optional `menuItemNames` array
- Empty array = create tag only (for preset tags that aren't used yet)
- Maintains `name` and `color` properties for tag creation

### 3.2 Backwards Compatibility Mode

**Support both invocation modes:**

```javascript
// Mode 1: JSON payload (enhanced mode)
if (payloadPath) {
  const payload = JSON.parse(await fs.readFile(payloadPath, 'utf-8'));
  // Process with menuItemNames support
}

// Mode 2: CLI arguments (legacy mode - creates all 10 preset tags)
else if (email && password && restaurantName) {
  // Use hardcoded ITEM_TAGS without menuItemNames
  // Equivalent to current behavior
}

else {
  console.error('Error: Must provide either --payload or CLI arguments');
  process.exit(1);
}
```

### 3.3 New SELECTORS to Add

```javascript
const SELECTORS = {
  // Existing selectors...
  createButton: '...',
  tagNameField: '...',
  tagTextField: '...',
  colorPicker: '...',
  colorInput: '...',
  saveButton: '...',

  // NEW: Add / Remove From Items tab (needs validation)
  addRemoveItemsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(4) > div',

  // NEW: Menu tree expansion
  menuExpandArrow: 'form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg',

  // NOTE: These selectors are copied from add-option-sets.js
  // They need to be validated against the actual Item Tags form
  // The tab structure may differ between Option Sets and Item Tags
};
```

**Important:** The Item Tags form UI needs to be inspected to confirm:
1. Whether it has the same tab structure as Option Sets
2. The exact selector paths for the "Add / Remove From Items" tab
3. Whether the menu tree structure is identical

### 3.4 Modified Main Loop

```javascript
for (let i = 0; i < itemTags.length; i++) {
  const tag = itemTags[i];
  console.log(`  [${i + 1}/${itemTags.length}] Creating tag: "${tag.name}"`);

  try {
    // Step 1: Click "Create New Item Tag" button
    await page.click(SELECTORS.createButton);
    await page.waitForTimeout(500);

    // Step 2: Fill Tag Name field
    await page.locator(SELECTORS.tagNameField).fill(tag.name);

    // Step 3: Fill Tag Text field
    await page.locator(SELECTORS.tagTextField).fill(tag.name);

    // Step 4: Set color
    await page.click(SELECTORS.colorPicker);
    await page.waitForTimeout(300);
    await page.locator(SELECTORS.colorInput).fill(tag.color);
    await page.waitForTimeout(200);

    // Step 5: Add to menu items (NEW FUNCTIONALITY)
    const menuItemNames = tag.menuItemNames || [];
    if (menuItemNames.length > 0) {
      console.log(`    Adding to ${menuItemNames.length} menu items...`);

      // Navigate to "Add / Remove From Items" tab
      await page.click(SELECTORS.addRemoveItemsTab);
      await page.waitForTimeout(500);

      // Expand menu tree
      try {
        await page.click(SELECTORS.menuExpandArrow);
        await page.waitForTimeout(300);
      } catch {
        // May already be expanded
      }

      // Expand categories
      const categoryExpanders = await page.locator('form div.m-l-2 > div > div > div.cursor.flex-center > svg').all();
      for (const expander of categoryExpanders) {
        try {
          await expander.click();
          await page.waitForTimeout(200);
        } catch {
          // May already be expanded
        }
      }

      // Select menu items
      const uniqueNames = [...new Set(menuItemNames)];
      let matchedCount = 0;

      for (const itemName of uniqueNames) {
        try {
          const labelSpanLocator = page.locator(`span.m-l-2:text-is("${itemName}")`);
          const count = await labelSpanLocator.count();

          if (count > 0) {
            for (let j = 0; j < count; j++) {
              const labelSpan = labelSpanLocator.nth(j);
              const parentLabel = labelSpan.locator('xpath=ancestor::label');
              await parentLabel.click();
            }
            matchedCount++;
            console.log(`      Checked: "${itemName}" (${count} checkbox${count > 1 ? 'es' : ''})`);
          } else {
            console.log(`      Not found: "${itemName}"`);
          }
        } catch (checkError) {
          console.log(`      Failed: "${itemName}": ${checkError.message}`);
        }
      }
      console.log(`    Matched ${matchedCount}/${uniqueNames.length} menu items`);
    }

    // Step 6: Click Save button
    await page.click(SELECTORS.saveButton);
    await page.waitForTimeout(2000);

    successCount++;
  } catch (tagError) {
    failCount++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}
```

---

## 4. Edge Case Handling

### 4.1 Tag Without Menu Items

**Scenario:** A tag should be created but not applied to any menu items yet.

**Solution:**
```javascript
const menuItemNames = tag.menuItemNames || [];
if (menuItemNames.length > 0) {
  // Only enter this block if there are items to select
  // ...
}
// Skip directly to Save if no items
```

**Effect:** Tag is created with name, text, and color, but no menu items selected. The "Add / Remove From Items" tab is never navigated to.

### 4.2 Tag Already Exists

**Scenario:** The tag "Popular" already exists in CloudWaitress.

**Current Behavior:** Clicking "Create New" and saving will likely:
- Create a duplicate tag (if system allows)
- Show an error toast (if uniqueness enforced)

**Proposed Solution Options:**

**Option A: Pre-check for existing tags (Recommended)**
```javascript
// Before creating, check if tag already exists on the page
const existingTags = await page.locator('tag-list-selector').allTextContents();
if (existingTags.some(t => t.toLowerCase() === tag.name.toLowerCase())) {
  console.log(`    Tag "${tag.name}" already exists, skipping creation`);
  // Option: Could still update menu item selections for existing tag
  continue;
}
```

**Option B: Update mode for existing tags**
```javascript
if (tagAlreadyExists) {
  // Click edit on existing tag instead of create
  // Navigate to "Add / Remove From Items"
  // Add the menu items
  // Save
}
```

**Recommendation:** Start with Option A (skip existing) for simplicity. Option B adds complexity and requires additional selectors for the edit workflow.

### 4.3 Large Menus with Many Items

**Scenario:** Menu has 200+ items across 20 categories.

**Performance Considerations:**

1. **Category Expansion Time:**
   - Current approach expands ALL categories
   - For 20 categories: ~4 seconds (200ms * 20)
   - Consider: Only expand categories that contain target items

2. **Checkbox Selection Time:**
   - Current approach: One selector per item name
   - With Featured Items: May click 2 checkboxes per item
   - For 50 items: ~10-15 seconds

3. **Total Per-Tag Time:**
   - Create form: ~2 seconds
   - Expand categories: ~4 seconds
   - Select items: ~15 seconds
   - Save: ~2 seconds
   - **Total: ~23 seconds per tag with menu items**

**Optimization Opportunities:**
- Batch category expansion (fire all clicks, then wait once)
- Remove per-checkbox waitForTimeout (as done in add-option-sets.js)
- Consider parallel checkbox clicks (risky)

### 4.4 Menu Item Name Mismatches

**Scenario:** Database has "Chicken Burger" but CloudWaitress shows "Grilled Chicken Burger"

**Current Behavior:** Item won't be found, logged as "Not found"

**Mitigation Options:**
1. **Fuzzy matching** - Could add tolerance for minor differences
2. **Logging** - Report all "Not found" items for manual review
3. **Pre-validation** - API could warn about potential mismatches before execution

**Recommendation:** Keep strict matching, rely on good logging. Fuzzy matching risks false positives.

### 4.5 Featured Items Duplicates

**Scenario:** "Chicken Burger" appears in both "Featured Items" and "Mains" category.

**Current Solution (from add-option-sets.js):**
```javascript
const uniqueMenuItemNames = [...new Set(menuItemNames)];  // Deduplicate input
const count = await labelSpanLocator.count();            // Find ALL matches
for (let i = 0; i < count; i++) {                        // Click ALL
  // ...
}
```

**This handles:**
- Duplicate names in the input array (from extraction)
- Same item appearing in multiple categories (Featured + actual category)

---

## 5. New Selectors Required

### 5.1 Confirmed Selectors (from add-option-sets.js)

| Selector | Purpose | Notes |
|----------|---------|-------|
| `addRemoveItemsTab` | Switch to menu item selection tab | Needs UI validation |
| `menuExpandArrow` | Expand root menu tree | Needs UI validation |
| Category expander | `form div.m-l-2 > div > div > div.cursor.flex-center > svg` | Dynamic |
| Menu item checkbox | `span.m-l-2:text-is("${itemName}")` | Dynamic by name |

### 5.2 Selectors Requiring UI Validation

The Item Tags form UI needs to be inspected to confirm these selectors work. The form structure may differ from Option Sets.

**Questions to validate:**
1. Does Item Tags form have internal tabs like Option Sets?
2. Is the "Add / Remove From Items" tab in position 4 (div:nth-child(4))?
3. Is the menu tree structure identical to Option Sets form?
4. Is the `#option-set-tab-options-tab-select-content` ID used, or a different ID?

### 5.3 Potential Alternative Selectors

If the exact selectors don't match, try:
- Text-based: `div:has-text("Add / Remove From Items")`
- Role-based: `[role="tab"]:has-text("Items")`
- Data attributes: `[data-tab="items"]`

---

## 6. Enhanced Payload Format Proposal

### 6.1 Full Payload Structure

```json
{
  "email": "restaurant@example.com",
  "password": "SecurePassword123!",
  "restaurantName": "Test Restaurant NZ",
  "adminUrl": "https://admin.pumpd.co.nz",
  "itemTags": [
    {
      "name": "Popular",
      "color": "#b400fa",
      "menuItemNames": [
        "Classic Burger",
        "Chicken Burger",
        "Loaded Fries"
      ]
    },
    {
      "name": "Vegan",
      "color": "#36AB36",
      "menuItemNames": [
        "Garden Salad",
        "Veggie Wrap",
        "Falafel Bowl"
      ]
    },
    {
      "name": "Gluten Free",
      "color": "#FF8C00",
      "menuItemNames": [
        "Grilled Chicken",
        "Garden Salad",
        "Rice Bowl"
      ]
    },
    {
      "name": "New",
      "color": "#3f92ff",
      "menuItemNames": []
    }
  ]
}
```

### 6.2 Type Definition

```typescript
interface ItemTagPayload {
  email: string;
  password: string;
  restaurantName: string;
  adminUrl?: string;  // Optional, defaults to https://admin.pumpd.co.nz
  itemTags: Array<{
    name: string;           // Tag name (e.g., "Popular")
    color: string;          // Hex color (e.g., "#b400fa")
    menuItemNames?: string[]; // Menu items to apply tag to (optional)
  }>;
}
```

### 6.3 Source of menuItemNames Data

The `menuItemNames` array should come from the database `menu_items.tags` column:

```sql
-- Query to build menuItemNames for each tag
SELECT
  unnest(tags) as tag_name,
  array_agg(name) as menu_item_names
FROM menu_items
WHERE menu_id = $menuId
  AND tags IS NOT NULL
  AND array_length(tags, 1) > 0
GROUP BY unnest(tags);
```

---

## 7. Summary of Required Changes

### 7.1 Script Changes

| Component | Current State | Required Change |
|-----------|--------------|-----------------|
| Parameter input | CLI args only | Add JSON payload support |
| Tag data source | Hardcoded `ITEM_TAGS` | Read from payload |
| SELECTORS object | 6 selectors | Add 2+ new selectors |
| Main loop | Create only | Add menu item selection |
| Error handling | Basic escape | Add tag exists check |

### 7.2 API Changes (registration-routes.js)

| Component | Current State | Required Change |
|-----------|--------------|-----------------|
| `/add-item-tags` endpoint | No menuId param | Add menuId parameter |
| Query logic | None | Add query for tags with menu items |
| Payload generation | CLI args string | Write JSON payload file |
| Response | Basic success/fail | Include match statistics |

### 7.3 Batch Service Changes (registration-batch-service.js)

| Component | Current State | Required Change |
|-----------|--------------|-----------------|
| `getSubStepEndpoint` | Passes basic params | Include menuId for item-tags |
| Data gathering | Not implemented | Fetch menu items with tags |

---

## 8. Risks and Considerations

### 8.1 UI Selector Fragility

**Risk:** The selectors from add-option-sets.js may not work for Item Tags form.

**Mitigation:**
- Test selectors against actual UI before implementation
- Add fallback text-based selectors
- Consider using Playwright's "inspect" mode to find correct paths

### 8.2 Tag Creation Order

**Risk:** If tags are created in a specific order and one fails, subsequent tags may be misaligned.

**Mitigation:**
- Each tag creation is independent (no dependencies)
- Continue on error, report at end
- Consider retry logic for transient failures

### 8.3 CloudWaitress UI Changes

**Risk:** CloudWaitress may update their UI, breaking selectors.

**Mitigation:**
- Use robust fallback patterns
- Log detailed selector failures for debugging
- Maintain screenshot capability for error diagnosis

### 8.4 Performance with Many Tags and Items

**Risk:** 10 tags x 50 items each = 500 checkbox operations = slow.

**Mitigation:**
- Process only tags that have menuItemNames
- Skip tags that already exist (if possible)
- Consider: Expand categories once, process all tags, collapse

---

## 9. Recommended Implementation Approach

### Phase 1: Payload Support (Low Risk)
1. Add JSON payload file reading
2. Keep CLI args for backwards compatibility
3. Test with hardcoded menuItemNames array

### Phase 2: Selector Validation (Medium Risk)
1. Manually inspect Item Tags form UI
2. Capture screenshots of form structure
3. Validate/update selector paths

### Phase 3: Menu Item Selection (Medium Risk)
1. Copy logic from add-option-sets.js
2. Adapt selectors for Item Tags form
3. Add comprehensive logging

### Phase 4: API Integration (Low Risk)
1. Update registration-routes.js endpoint
2. Add database query for tags with menu items
3. Update batch service integration

### Phase 5: Testing and Hardening
1. Test with real restaurant data
2. Test edge cases (empty items, existing tags)
3. Performance testing with large menus

---

## 10. Estimated Effort

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| Phase 1 | Payload support | 1-2 hours |
| Phase 2 | Selector validation | 1-2 hours |
| Phase 3 | Menu item selection | 2-3 hours |
| Phase 4 | API integration | 2-3 hours |
| Phase 5 | Testing | 2-4 hours |
| **Total** | | **8-14 hours** |

---

## 11. Appendix: Code Reference

### Current add-item-tags.js Structure

```
Lines 1-32:    Header comments and usage documentation
Lines 34-51:   Imports and environment setup
Lines 54-71:   ITEM_TAGS constant (hardcoded)
Lines 74-81:   SELECTORS object
Lines 83-109:  CLI argument parsing
Lines 112-115: Screenshot utility
Lines 117-509: Main addItemTags() function
  Lines 133-179:   Login
  Lines 182-354:   Restaurant navigation with smart matching
  Lines 357-396:   Menu section navigation
  Lines 398-419:   Item Tags tab navigation
  Lines 421-486:   Tag creation loop
  Lines 495-508:   Cleanup
Lines 512-515: Script execution
```

### add-option-sets.js Menu Item Selection (Reference)

```
Lines 641-707:  Menu item selection implementation
  - Line 642:   menuItemNames extraction from payload
  - Line 648:   addRemoveItemsTab click
  - Line 654:   menuExpandArrow click
  - Lines 663-673: Category expansion loop
  - Line 680:   Deduplication with Set
  - Lines 681-701: Checkbox selection loop
    - Line 684:  span.m-l-2:text-is selector
    - Line 690:  ancestor::label traversal
```
