# Investigation Plan: Preset Item Tags in Menu Edit Mode

## Overview

The goal is to enhance the menu item editor (`EditableMenuItem.jsx`) to include preset item tags while maintaining the existing functionality for users to type custom tags and click the plus button. The enhancement should provide quick-select options for commonly used tags without removing the flexibility of custom tag entry.

## Known Information

### Current Implementation

1. **EditableMenuItem.jsx** (`UberEats-Image-Extractor/src/components/menu/EditableMenuItem.jsx`)
   - Simple text input field for typing tags
   - "+" button to add typed tags
   - Enter key support for adding tags
   - Badge display with X buttons to remove tags
   - No preset tags - completely manual entry
   - Tags stored as simple string array: `tags: string[]`

2. **Existing TagInput Component** (`src/components/demo-meeting/TagInput.tsx`)
   - More sophisticated popover-based implementation
   - Supports predefined options with checkboxes
   - Custom value input with Enter key and + button
   - Visual distinction between predefined (blue) and custom (gray) tags
   - Uses `TagItem` interface: `{ type: 'predefined' | 'custom', value: string }`
   - Already battle-tested in the qualification/demo-meeting feature

3. **Existing Pattern for Preset Constants** (`src/lib/qualification-constants.ts`)
   - Shows pattern for defining presets as `const` arrays
   - TypeScript type safety with `as const`
   - Exported for use across components

### Preset Tags to Implement

**Dietary Tags:**
- Vegan, Vegetarian, Gluten free, Spicy, Hot, Dairy free, Nut free

**Popular Tags:**
- Popular, Most Liked, Favourite, Must Try, Recommended, Trending, Highly Rated, Specialty

**New Tags:**
- New, Limited Time, Limited Time Only, Seasonal, While Stock Lasts, Today Only

**Deal Tags:**
- Deal, Promo, Promotion, Special, Buy 1 Get 1, 2 for 1, Combo, Free Item, Free Gift, Discount

## Instructions

Execute the following investigation using the Task tool to spin up **4 parallel subagents**. Each subagent should:
1. Only investigate - **DO NOT modify any code**
2. Create an investigation document in `planning/database-plans/item-tags-enhancements/presets-in-menu-edit-mode/` as its deliverable
3. Report findings comprehensively with file paths and line numbers

After all subagents complete their work:
1. Read all investigation documents
2. Synthesize findings into a coherent summary for the user
3. Provide recommendations for the implementation approach

---

## subagent_1_instructions

### Context
We need to understand the full context of how `EditableMenuItem.jsx` is used throughout the application, including parent components, data flow, and any API interactions for tags.

### Instructions
1. Read `EditableMenuItem.jsx` completely
2. Find all files that import or use `EditableMenuItem`
3. Trace the data flow:
   - Where does `item` prop come from?
   - What happens when `onUpdate` is called?
   - How do tags get saved to the database?
4. Check if there's any existing tag validation or normalization
5. Look for any menu-related API endpoints or services that handle tags
6. Search for any existing menu item type definitions

### Deliverable
Create `INVESTIGATION_TASK_1_COMPONENT_CONTEXT.md` with:
- Component usage map (which files use EditableMenuItem)
- Data flow diagram/explanation
- API endpoint/service references for tag persistence
- Any constraints or considerations discovered

### Report
Include file paths with line numbers for all findings.

---

## subagent_2_instructions

### Context
There's an existing `TagInput.tsx` component that already implements preset tags with custom value support. We need to assess if this can be adapted for the menu item editor.

### Instructions
1. Read `TagInput.tsx` thoroughly - understand its full API
2. Read `TagList.tsx` to understand display patterns
3. Examine how it's currently used in `QualificationDataDisplay.tsx`
4. Analyze the `TagItem` interface and its implications
5. Identify what changes would be needed to use this component in `EditableMenuItem.jsx`
6. Consider differences:
   - Current tags are `string[]`, TagInput uses `TagItem[]`
   - Styling differences between components
   - Popover behavior vs inline display

### Deliverable
Create `INVESTIGATION_TASK_2_TAGINPUT_ANALYSIS.md` with:
- Full API documentation for TagInput
- Current usage examples
- Gap analysis: what's needed to adapt for menu items
- Migration considerations for existing `string[]` tag data

### Report
Include specific recommendations for adaptation approach.

---

## subagent_3_instructions

### Context
We need to evaluate different UI/UX approaches for integrating preset tags into the menu item editor while maintaining the current user experience.

### Instructions
1. Review the screenshot provided by the user (shows current tag input UI)
2. Research UI patterns for tag selection:
   - Dropdown/popover with categories
   - Inline chip suggestions
   - Two-step: quick-select + custom input
3. Consider space constraints in the menu item card
4. Evaluate grouping the tags by category (Dietary, Popular, New, Deal)
5. Consider mobile responsiveness
6. Look at how similar tag inputs work in the existing codebase

### Deliverable
Create `INVESTIGATION_TASK_3_UIUX_OPTIONS.md` with:
- At least 3 UI approach options with pros/cons
- Mockup descriptions or wireframe ideas
- Recommendation based on existing design patterns
- Accessibility considerations

### Report
Include comparison table of approaches.

---

## subagent_4_instructions

### Context
We need to plan how to define and organize the preset tags, and consider any data structure implications.

### Instructions
1. Review how `qualification-constants.ts` organizes preset values
2. Plan the constants file structure for menu item tags
3. Consider:
   - Should tags be categorized in the UI?
   - Should we track predefined vs custom (like TagItem does)?
   - How will this affect existing menu items with tags?
   - Any backwards compatibility concerns?
4. Search for any existing menu item tag constants or configuration
5. Look for any database migrations related to menu items or tags

### Deliverable
Create `INVESTIGATION_TASK_4_DATA_STRUCTURE.md` with:
- Proposed constants file structure
- Data structure recommendation (keep `string[]` or migrate to `TagItem[]`)
- Backwards compatibility strategy
- TypeScript type definitions needed

### Report
Include code examples for the proposed structure.

---

## Expected Outputs

After investigation completion, the following files should exist:
1. `INVESTIGATION_TASK_1_COMPONENT_CONTEXT.md`
2. `INVESTIGATION_TASK_2_TAGINPUT_ANALYSIS.md`
3. `INVESTIGATION_TASK_3_UIUX_OPTIONS.md`
4. `INVESTIGATION_TASK_4_DATA_STRUCTURE.md`

These will inform the implementation plan for adding preset item tags to the menu edit mode.
