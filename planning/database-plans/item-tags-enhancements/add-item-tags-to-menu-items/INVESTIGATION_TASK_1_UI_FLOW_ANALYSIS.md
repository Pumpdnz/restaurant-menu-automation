# Investigation Task 1: UI Flow Analysis for Applying Tags to Menu Items

## Executive Summary

This document analyzes the UI flow used in `add-option-sets.js` for associating option sets with menu items via the "Add / Remove From Items" tab. The goal is to understand the complete interaction pattern so it can be replicated in `add-item-tags.js` for applying tags to menu items.

---

## 1. Complete UI Flow for Applying Option Sets to Menu Items

### Overview

The `add-option-sets.js` script (lines 641-707) performs the following sequence after creating an option set:

1. Navigate to the "Add / Remove From Items" tab within the Option Set form
2. Expand the main Menu tree
3. Expand all category sections to reveal menu items
4. Find and click checkboxes for each menu item that should have this option set
5. Save the option set (which persists the menu item associations)

### Detailed Step-by-Step Flow

#### Step 1: Click "Add / Remove From Items" Tab
```javascript
// Line 648
await page.click(SELECTORS.addRemoveItemsTab);
await page.waitForTimeout(500);
```

This navigates from the "Options" tab (where option items are added) to the "Add / Remove From Items" tab which displays a tree structure of all menu items.

#### Step 2: Expand Main Menu Tree
```javascript
// Lines 653-659
try {
  await page.click(SELECTORS.menuExpandArrow);
  await page.waitForTimeout(300);
  console.log('    Expanded Menu tree');
} catch (expandError) {
  console.log('    Menu tree may already be expanded or not found');
}
```

The menu tree has a top-level "Menu" node that must be expanded to reveal categories.

#### Step 3: Expand All Category Sections
```javascript
// Lines 663-674
const categoryExpanders = await page.locator('form div.m-l-2 > div > div > div.cursor.flex-center > svg').all();
console.log(`    Found ${categoryExpanders.length} category expanders`);

for (let k = 0; k < categoryExpanders.length; k++) {
  try {
    await categoryExpanders[k].click();
    await page.waitForTimeout(200);
  } catch (catError) {
    // Category may already be expanded
  }
}
await page.waitForTimeout(300);
```

Each category (e.g., "Burgers", "Sides", "Drinks") has an expand arrow that reveals the menu items within that category.

#### Step 4: Find and Click Menu Item Checkboxes
```javascript
// Lines 679-701
let matchedCount = 0;
const uniqueMenuItemNames = [...new Set(menuItemNames)];
for (const itemName of uniqueMenuItemNames) {
  try {
    // Find ALL matching spans with m-l-2 class (menu item labels)
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
      console.log(`      Checked: "${itemName}" (${count} checkbox${count > 1 ? 'es' : ''})`);
    } else {
      console.log(`      Not found: "${itemName}"`);
    }
  } catch (checkError) {
    console.log(`      Failed to check "${itemName}": ${checkError.message}`);
  }
}
```

---

## 2. All Relevant Selectors and Their Purposes

### Main Navigation Selectors (add-option-sets.js)

| Selector | Purpose | Location in Code |
|----------|---------|------------------|
| `SELECTORS.optionSetsTab` | Navigate to Option Sets section (2nd button) | Line 114 |
| `SELECTORS.addRemoveItemsTab` | Navigate to "Add / Remove From Items" tab within form (4th tab) | Line 138 |
| `SELECTORS.menuExpandArrow` | Expand the main Menu tree root | Line 139 |

### Tab Selectors Breakdown

**Option Sets Tab (Main Navigation):**
```javascript
optionSetsTab: '#scroll-root > div > div > div > div > div > div.group__ButtonGroupComponent-dVAWMN.puSOV.bsl-1 > button:nth-child(2)'
```

**Item Tags Tab (Main Navigation) - From add-item-tags.js:**
```javascript
// Line 403
'#scroll-root > div > div > div > div > div > div.group__ButtonGroupComponent-dVAWMN.puSOV.bsl-1 > button:nth-child(3)'
```

**Add / Remove From Items Tab (Within Option Set Form):**
```javascript
addRemoveItemsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(4) > div'
```

### Form Tab Structure (Option Sets)

| Tab Index | Tab Name | Selector Path |
|-----------|----------|---------------|
| 1 | (Default/Details) | `div:nth-child(1)` |
| 2 | Options | `div:nth-child(2)` |
| 3 | Conditions | `div:nth-child(3)` |
| 4 | Add / Remove From Items | `div:nth-child(4)` |

### Tree Expansion Selectors

**Main Menu Expand Arrow:**
```javascript
menuExpandArrow: 'form > div > div:nth-child(1) > div > div > div > div > div > div > div.cursor.flex-center > svg'
```

**Category Expanders (All):**
```javascript
'form div.m-l-2 > div > div > div.cursor.flex-center > svg'
```

### Menu Item Checkbox Selector

**Primary Selector (Working):**
```javascript
`span.m-l-2:text-is("${itemName}")`
```
- `span.m-l-2` - Targets menu item label spans in the checkbox tree
- `:text-is()` - Playwright's exact text matching
- Then traverse up to parent `label` element to click

**XPath to Parent Label:**
```javascript
.locator('xpath=ancestor::label')
```

### Important Notes on Selectors

1. **DO NOT USE:** `label:has(span:text-is(...))` - This alternative selector was tested and does NOT match elements in this UI.

2. **Always use the span.m-l-2 approach** to find menu items, then traverse up to the label.

---

## 3. Checkbox Selection Algorithm

### 3.1 Deduplication Strategy

**Problem:**
Menu extraction may produce duplicate menu item names in the `menuItemNames` array, particularly when items appear in both "Featured Items" and their actual category.

**Solution:**
```javascript
// Line 680
const uniqueMenuItemNames = [...new Set(menuItemNames)];
```

Using JavaScript's `Set` ensures each menu item name is processed only once, preventing:
- Wasted time clicking the same checkbox twice
- Accidentally unchecking an already-checked checkbox

### 3.2 Featured Items Handling

**Problem Explained (from script header comments, lines 49-82):**

When a menu item appears in BOTH "Featured Items" AND its actual category (e.g., "Half Chicken" in Featured Items AND in "Chicken" category), the menuItemNames array from extraction contains duplicates.

Using `.first()` selector would cause issues:
1. First occurrence: Click Featured Items checkbox (selects it)
2. Second occurrence: Click Featured Items checkbox AGAIN (deselects it!)

**Solution:**
```javascript
// Lines 684-691
const labelSpanLocator = page.locator(`span.m-l-2:text-is("${itemName}")`);
const count = await labelSpanLocator.count();
if (count > 0) {
  // Click ALL matching checkboxes
  for (let i = 0; i < count; i++) {
    const labelSpan = labelSpanLocator.nth(i);
    const parentLabel = labelSpan.locator('xpath=ancestor::label');
    await parentLabel.click();
  }
}
```

**Key Points:**
1. Find ALL matching checkboxes for each menu item name
2. Click ALL of them (both Featured Items AND category checkboxes)
3. This ensures complete coverage and prevents accidental deselection

### 3.3 Performance Optimizations

**From script header (lines 78-82):**

| Optimization | Reason |
|-------------|--------|
| Removed `isChecked()` calls | Saves ~10s per item |
| Removed `waitForTimeout()` between clicks | Faster execution |
| Clicking already-checked checkbox is safe | No harm in this UI |

### 3.4 Complete Algorithm Flowchart

```
START
  |
  v
Deduplicate menuItemNames using Set
  |
  v
FOR each unique itemName:
  |
  v
  Find ALL spans matching: span.m-l-2:text-is("{itemName}")
  |
  v
  count = number of matches
  |
  v
  IF count > 0:
  |   |
  |   v
  |   FOR i = 0 to count-1:
  |   |   |
  |   |   v
  |   |   Get nth labelSpan
  |   |   |
  |   |   v
  |   |   Find ancestor label element
  |   |   |
  |   |   v
  |   |   Click label (toggles checkbox)
  |   |
  |   v
  |   Log: "Checked: {itemName} ({count} checkboxes)"
  |
  v
  ELSE:
  |   |
  |   v
  |   Log: "Not found: {itemName}"
  |
  v
NEXT itemName
  |
  v
Log summary: "Matched {matchedCount}/{totalCount} menu items"
  |
  v
END
```

---

## 4. Differences Between Item Tags and Option Sets UI

### 4.1 Main Navigation Tab Positions

| Feature | Tab Position | Selector |
|---------|-------------|----------|
| Option Sets | 2nd button | `button:nth-child(2)` |
| Item Tags | 3rd button | `button:nth-child(3)` |

### 4.2 Form Tab IDs

**Option Sets Form:**
- Tab container ID: `#option-set-tab-options-tab-select-content`
- Tabs: Options (2), Conditions (3), Add/Remove From Items (4)

**Item Tags Form:**
- Tab container ID: **UNKNOWN - Needs Investigation**
- Expected similar pattern but may have different ID prefix

### 4.3 Form Structure Differences

**Option Sets Form (div:nth-child hierarchy in SELECTORS):**
```javascript
// Main inputs are in div:nth-child(1)
nameInput: 'form > div > div:nth-child(1) > div:nth-child(2) > ...'
displayNameInput: 'form > div > div:nth-child(1) > div:nth-child(3) > ...'
```

**Item Tags Form (div:nth-child hierarchy in SELECTORS):**
```javascript
// Main inputs are in div:nth-child(3)
tagNameField: 'form > div > div:nth-child(3) > div:nth-child(1) > ...'
tagTextField: 'form > div > div:nth-child(3) > div:nth-child(2) > ...'
saveButton: 'form > div > div:nth-child(4) > button'
```

### 4.4 Expected Selector Differences for Item Tags

Based on the pattern analysis, the Item Tags form likely has:

1. **Different tab container ID** - Instead of `#option-set-tab-options-tab-select-content`, it may use something like `#item-tag-tab-options-tab-select-content`

2. **Different tab indices** - The "Add / Remove From Items" tab may not be at position 4

3. **Similar tree structure** - The menu item tree is likely the same, using:
   - Same expand arrow selectors
   - Same category expander pattern
   - Same `span.m-l-2` for menu item labels

### 4.5 Selectors That Should Be Reusable

| Selector | Purpose | Expected Reusability |
|----------|---------|---------------------|
| `form div.m-l-2 > div > div > div.cursor.flex-center > svg` | Category expanders | HIGH - Shared UI component |
| `span.m-l-2:text-is("${itemName}")` | Menu item labels | HIGH - Shared UI component |
| `.locator('xpath=ancestor::label')` | Parent label finder | HIGH - Standard pattern |

### 4.6 Selectors That Need Investigation

| Selector | Purpose | Action Needed |
|----------|---------|--------------|
| `addRemoveItemsTab` | Navigate to menu item selection | Discover actual ID for Item Tags |
| `menuExpandArrow` | Expand menu tree root | Verify path in Item Tags form |
| Form tab structure | Tab navigation | Determine tab positions in Item Tags |

---

## 5. Summary of Key Findings

### What Works in Option Sets

1. **Selector Pattern:** `span.m-l-2:text-is("${itemName}")` + XPath ancestor traversal
2. **Deduplication:** Using `Set` to process unique names only
3. **Multi-checkbox Handling:** Click ALL matching checkboxes for each item
4. **Performance:** Skip isChecked() calls, no delays between clicks

### What Needs to Be Discovered for Item Tags

1. **Tab Container ID:** The ID prefix for Item Tags form tabs (equivalent to `#option-set-tab-options-tab-select-content`)
2. **Tab Position:** Which nth-child is "Add / Remove From Items" in Item Tags form
3. **Menu Expand Arrow Path:** May differ slightly due to different form structure

### Recommended Next Steps

1. **Manual UI Inspection:** Open Item Tags form in browser dev tools and inspect:
   - Tab container element IDs
   - Tab positions
   - Menu tree structure

2. **Debug Mode Testing:** Run add-item-tags.js with `--debug` flag and manually navigate to verify selector paths

3. **Compare Form HTML:** Use browser dev tools to compare Option Sets form HTML structure with Item Tags form structure

---

## 6. Code Reference Summary

### Key Lines in add-option-sets.js

| Lines | Purpose |
|-------|---------|
| 49-82 | Detailed documentation of Featured Items problem and solution |
| 112-143 | SELECTORS object with all form element selectors |
| 641-707 | Complete "Add / Remove From Items" implementation |
| 680 | Deduplication with `[...new Set(menuItemNames)]` |
| 684-691 | Multi-checkbox click loop |

### Key Lines in add-item-tags.js

| Lines | Purpose |
|-------|---------|
| 74-81 | SELECTORS object (currently missing Add/Remove Items selectors) |
| 60-71 | ITEM_TAGS constant with predefined tags |
| 428-475 | Tag creation loop (no menu item selection currently) |

---

## Document Metadata

- **Created:** 2026-01-06
- **Task:** Investigation Task 1 - UI Flow Analysis
- **Source Files Analyzed:**
  - `/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/add-option-sets.js`
  - `/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/add-item-tags.js`
  - `/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/backups/add-option-sets-before-attempt-to-enhance-for-featured-menu-item-handling.js`
