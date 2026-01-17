# Investigation Plan: Enhance add-item-tags.js to Apply Tags to Menu Items

## Overview

This investigation aims to understand how the `add-option-sets.js` script handles associating option sets with menu items, so we can implement similar functionality in `add-item-tags.js` to apply tags to menu items.

**Current State:**
- `add-option-sets.js` creates option sets AND associates them with menu items via the "Add / Remove From Items" tab
- `add-item-tags.js` only creates the 10 predefined tags (Popular, New, Deal, Vegan, etc.) but does NOT apply them to any menu items

**Goal:**
Enhance `add-item-tags.js` to apply tags to menu items, similar to how `add-option-sets.js` handles option set associations.

---

## Known Information

### Database Schema Differences

**Option Sets (Complex - Junction Table):**
- `option_sets` table: Stores option set definitions
- `menu_item_option_sets` junction table: Links option sets to menu items (many-to-many)
- Data flow: API fetches junction table records, builds `menuItemNames` array for each option set

**Item Tags (Simple - Array Column):**
- `menu_items.tags` column: ARRAY type storing tag strings directly on the menu item
- No separate item_tags table - tags are stored inline in menu_items
- Simpler data model but same UI interaction needed in Pumpd admin

### How add-option-sets.js Handles Menu Items

1. **Payload Structure:**
```javascript
{
  email: "...",
  password: "...",
  restaurantName: "...",
  optionSets: [{
    name: "Choose Size",
    menuItemNames: ["Burger", "Hot Dog", "Fries"]  // <-- KEY: Menu items to apply to
  }]
}
```

2. **Script Steps (Lines 641-707 in add-option-sets.js):**
   - Click "Add / Remove From Items" tab
   - Expand Menu tree (click expand arrow)
   - Expand all category sections
   - Find checkboxes by menu item name using `span.m-l-2:text-is("${itemName}")`
   - Click ALL matching checkboxes (handles Featured Items duplicates)

3. **Selector Used:**
```javascript
SELECTORS.addRemoveItemsTab: '#option-set-tab-options-tab-select-content > ... > div:nth-child(4) > div'
SELECTORS.menuExpandArrow: 'form > div > ... > svg'
```

### Current add-item-tags.js Behavior

1. Creates 10 predefined tags via hardcoded `ITEM_TAGS` array
2. For each tag: clicks create, fills name/text/color, saves
3. **Does NOT navigate to "Add / Remove From Items" tab**
4. **Does NOT accept any menu item mapping data**

### API Invocation Differences

**Option Sets API (registration-routes.js:3003-3264):**
- Receives `menuId` parameter
- Fetches option sets from `menu_item_option_sets` junction table
- Builds `menuItemNames` array by joining with `menu_items` table
- Passes complete payload via JSON file

**Item Tags API (registration-routes.js:2868-2997):**
- Only receives `restaurantId` parameter
- Does NOT fetch any menu item data
- Passes only credentials via command line args

---

## Instructions

Use the Task tool to spin up **4 parallel subagents** to investigate the following areas. Each subagent should:

1. **Only investigate** - do NOT modify any code
2. Create a detailed investigation document as their deliverable
3. Report findings back to the orchestrator

After all subagents complete, read all investigation documents and synthesize a comprehensive report for the user.

---

## subagent_1_instructions

### Context
We need to understand the complete UI flow for applying tags to menu items in the Pumpd admin portal. The Item Tags section should have an "Add / Remove From Items" tab similar to Option Sets.

### Instructions
1. Read `scripts/restaurant-registration/add-option-sets.js` thoroughly, focusing on:
   - Lines 641-707: The "Add / Remove From Items" tab handling
   - The selector patterns used for the tab, expand arrows, and checkboxes
   - How `menuItemNames` array is processed
   - How Featured Items duplicates are handled

2. Search the codebase for any existing implementation or partial work on item tags menu item selection

3. Document the exact selectors and UI interaction patterns from add-option-sets.js that would need to be replicated for item tags

4. Identify any differences in the Item Tags form UI vs Option Sets form UI that might affect selector paths

### Deliverable
Create `INVESTIGATION_TASK_1_UI_FLOW_ANALYSIS.md` documenting:
- The complete UI flow for applying option sets to menu items
- All relevant selectors and their purposes
- The checkbox selection algorithm (deduplication, Featured Items handling)
- Any observed differences between Item Tags and Option Sets UI

### Report
Summarize the key findings about the UI flow and selectors needed

---

## subagent_2_instructions

### Context
We need to understand how menu item tag data is stored in the database and how to fetch menu items that have tags for building the `menuItemNames` mapping.

### Instructions
1. Query the database to understand the `menu_items.tags` column structure:
   - What format are tags stored in? (array of strings?)
   - Sample some menu items with tags to see the data format
   - Check if tags are case-sensitive

2. Understand how option sets fetch their menu item mappings from `registration-routes.js` lines 3083-3174

3. Design a similar query pattern for item tags:
   - How would we fetch menu items that should have each tag applied?
   - Consider: tags may already exist in `menu_items.tags` from extraction
   - Should we match based on existing tags in the database?

4. Investigate where tag data comes from during menu extraction:
   - Check the extraction services for how tags are populated
   - Look at `item-tags-constants.ts` for predefined tag lists

### Deliverable
Create `INVESTIGATION_TASK_2_DATABASE_DATA_FLOW.md` documenting:
- The database schema for tags in menu_items
- Sample data showing tag formats
- Proposed query patterns for building menuItemNames mappings
- How tag data flows from extraction to database

### Report
Summarize the database structure and proposed query approach

---

## subagent_3_instructions

### Context
We need to understand all the places where `add-item-tags.js` is invoked and how to modify the API endpoints to pass menu item mapping data.

### Instructions
1. Trace all invocation paths for `add-item-tags.js`:
   - `registration-routes.js` `/add-item-tags` endpoint
   - `registration-batch-service.js` batch execution
   - Any frontend components that call the API

2. Compare with how `add-option-sets.js` is invoked:
   - How does it receive the JSON payload file?
   - What parameters are passed?
   - How is the menuId used to fetch option sets data?

3. Document the changes needed to the API layer:
   - What new parameters should the `/add-item-tags` endpoint accept?
   - Should it require a menuId like option sets?
   - How should the payload file be structured?

4. Consider the registration batch service integration:
   - How does batch execution pass parameters to the endpoint?
   - What changes are needed to `getSubStepEndpoint` for item tags?

### Deliverable
Create `INVESTIGATION_TASK_3_API_INVOCATION_ANALYSIS.md` documenting:
- All current invocation paths for add-item-tags.js
- Comparison with add-option-sets.js invocation
- Required changes to registration-routes.js
- Required changes to registration-batch-service.js
- Payload structure proposal

### Report
Summarize the invocation patterns and required API changes

---

## subagent_4_instructions

### Context
We need to understand the add-item-tags.js script structure and plan the modifications needed to support menu item selection.

### Instructions
1. Read `scripts/restaurant-registration/add-item-tags.js` thoroughly, documenting:
   - Current script structure and flow
   - The ITEM_TAGS constant and how tags are created
   - The SELECTORS object and what's currently defined
   - Any gaps that need to be filled for menu item selection

2. Compare the script structure with `add-option-sets.js`:
   - How are parameters received (CLI args vs JSON payload)?
   - What additional selectors are needed?
   - What modifications to the main loop are required?

3. Design the enhanced script flow:
   - Should it continue to support creating tags without menu items (backwards compatibility)?
   - How should the payload be structured to include menuItemNames per tag?
   - What new command line parameters or payload file format is needed?

4. Consider edge cases:
   - What if a tag doesn't need to be applied to any menu items?
   - How to handle tags that already exist vs new tags?
   - Performance considerations for large menus

### Deliverable
Create `INVESTIGATION_TASK_4_SCRIPT_ENHANCEMENT_PLAN.md` documenting:
- Current script structure analysis
- Comparison with add-option-sets.js structure
- Proposed script modifications
- New selectors needed
- Enhanced payload format proposal
- Edge case handling

### Report
Summarize the script analysis and enhancement requirements

---

## Final Synthesis

After all 4 subagents complete their investigations:

1. Read all 4 investigation documents
2. Create a synthesis document combining findings
3. Report to user:
   - Executive summary of investigation findings
   - Recommended implementation approach
   - Key technical decisions to be made
   - Estimated complexity and effort
   - Any blockers or risks identified
