# Menu Editing Enhancements Investigation Plan

## Overview

This investigation plan covers three key enhancements to the menu editing system in the UberEats-Image-Extractor application:

1. **Add New Menu Items** - ✅ **IMPLEMENTED (2026-01-06)** - Users can now add new menu items via UI
2. **Add Menu Item Images via URL** - ✅ **IMPLEMENTED (2026-01-06)** - Users can now add images via URL input
3. **Common Menu Item Images Library** - ✅ **IMPLEMENTED (2026-01-07)** - Reusable library of 24 beverage images with search and auto-suggestion

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Add New Menu Items | ✅ Complete | "Add Item" button in MenuDetail.jsx, creates via API |
| Add Image via URL | ✅ Complete | URL input in EditableMenuItem.jsx |
| Common Images Library | ✅ Complete | `common-images-constants.ts` + `CommonImagesPopover.jsx` |

## All Features Complete

All three menu editing enhancement features have been successfully implemented. See individual completion documents for details:
- [Feature 3 Completion Summary](./FEATURE_3_COMMON_IMAGES_LIBRARY_COMPLETE.md)

## Known Information

### Current System Architecture

**Key Components:**
- `EditableMenuItem.jsx` - Main component for editing individual menu items (view/edit modes)
- `MenuDetail.jsx` - Page for viewing/editing a menu with tabs for items and option sets
- `MenuItemValidator.js` - Validation utilities for menu items
- `database-service.js` - Backend service with `bulkUpdateMenuItems()` function

**Database Schema:**
- `menu_items` table: id, menu_id, category_id, name, price, description, tags, is_deleted
- `item_images` table: id, menu_item_id, url, type, uploaded_by, created_at
- `categories` table: id, menu_id, name, organisation_id

**Existing API Endpoints:**
- `POST /api/categories/:id/items` - Add new item to category (EXISTS but may not be wired to UI)
- `PATCH /api/menu-items/:id` - Update single menu item
- `POST /api/menu-items/bulk-update` - Bulk update multiple items

**Frontend API Client (`api.js`):**
```javascript
export const menuItemAPI = {
  update: (id, data) => api.patch(`/menu-items/${id}`, data),
  bulkUpdate: (updates) => api.post('/menu-items/bulk-update', { updates }),
  addToCategory: (categoryId, data) => api.post(`/categories/${categoryId}/items`, data),
};
```

**Current Limitations:**
1. No UI to add new menu items (only delete button exists)
2. No UI to add images via URL (only delete image button)
3. No library of common product images

---

## Instructions for Next Claude Session

**IMPORTANT:** Execute the following investigation using the Task tool to spin up 3 subagents in parallel. Each subagent should:
- ONLY investigate, NOT change code
- Create an investigation document in `planning/database-plans/further-enhancements/`
- Report findings in the document

### Execution Steps:

1. **Read this entire plan first** to understand the context
2. **Launch 3 Task subagents in parallel** using a SINGLE message with multiple Task tool calls
3. **Wait for all subagents to complete**
4. **Read all investigation documents** created by subagents
5. **Report consolidated findings** to the user with recommendations for implementation order

---

## subagent_1_instructions

### Context
We need to add the ability to create NEW menu items from the menu editing UI. The API endpoint `POST /api/categories/:id/items` already exists but is not connected to the frontend UI. The main editing interface is in `MenuDetail.jsx` which renders `EditableMenuItem.jsx` components for each item.

### Investigation Tasks
1. **Examine `EditableMenuItem.jsx`** to understand:
   - Current edit/view state management
   - How new items could be rendered (isNew flag pattern)
   - Required fields for a new item

2. **Examine `MenuDetail.jsx`** to understand:
   - How categories and items are rendered
   - Where an "Add Item" button should be placed
   - How the save/bulk update flow works

3. **Examine the API endpoint** `POST /api/categories/:id/items` in `server.js`:
   - What data it expects
   - What it returns
   - Any validation requirements

4. **Examine `database-service.js`**:
   - How items are created
   - Required fields for database insertion

5. **Examine `MenuItemValidator.js`**:
   - Validation rules for new items

### Deliverable
Create `planning/database-plans/further-enhancements/INVESTIGATION_TASK_1_ADD_MENU_ITEMS.md` with:
- Summary of current implementation
- Required changes for each file
- Recommended UI placement for "Add Item" button
- Data flow diagram (text-based)
- Potential challenges

---

## subagent_2_instructions

### Context
We need to add the ability to add menu item images via URL input. Currently, `EditableMenuItem.jsx` shows images and allows deletion, but there's no way to add a new image URL. The `item_images` table stores image URLs with associations to menu items.

### Investigation Tasks
1. **Examine `EditableMenuItem.jsx`** to understand:
   - How images are currently displayed
   - How image deletion works
   - Where an "Add Image URL" input should be placed
   - How image state is managed (imageURL field)

2. **Examine the image handling in `database-service.js`**:
   - How images are associated with menu items
   - How new image records are created
   - The `item_images` table operations

3. **Examine `bulkUpdateMenuItems` function**:
   - How image changes are handled during bulk save
   - Whether it supports adding new images or only updates

4. **Examine any image validation** in the codebase:
   - URL validation patterns
   - Image format/size restrictions
   - `image-validation-service.js` capabilities

5. **Check server.js for image endpoints**:
   - Any existing endpoints for adding images
   - Upload vs URL-based image addition

### Deliverable
Create `planning/database-plans/further-enhancements/INVESTIGATION_TASK_2_ADD_IMAGE_URL.md` with:
- Current image handling flow
- Required UI changes in EditableMenuItem
- Backend changes needed (if any)
- Validation requirements
- State management approach

---

## subagent_3_instructions

### Context
We need to create a library of common menu item images (e.g., Coca Cola, Sprite, Fanta, water bottles) that can be selected when editing menus. This should be extensible to eventually support AUTOMATIC image association for common items (e.g., auto-detect "Coca Cola" in item name and suggest/apply the appropriate image).

### Investigation Tasks
1. **Examine `item-tags-constants.ts`** as a pattern:
   - How constants are structured
   - How they're imported and used
   - Styling/metadata patterns

2. **Examine how tags are selected** in the UI:
   - `PresetTagsPopover.jsx` as a potential pattern
   - How preset values are displayed and selected
   - Click-to-apply patterns

3. **Research common food/beverage items** that would benefit from a standard image library:
   - Coca Cola products (Coke, Diet Coke, Coke Zero, Sprite, Fanta)
   - Pepsi products
   - Water brands
   - Common sides (fries, coleslaw)
   - Standard condiments

4. **Design the extensibility system**:
   - How to match item names to suggested images (fuzzy matching?)
   - Auto-suggestion vs manual selection
   - Multiple image options per product

5. **Examine EditableMenuItem.jsx**:
   - Where a "Select Common Image" button could be placed
   - How the popover/modal pattern works

### Deliverable
Create `planning/database-plans/further-enhancements/INVESTIGATION_TASK_3_COMMON_IMAGES_LIBRARY.md` with:
- Proposed constants file structure
- List of common items to include initially
- UI component design (similar to PresetTagsPopover)
- Auto-association algorithm design
- Extensibility considerations
- Integration points with EditableMenuItem

---

## Success Criteria

After all three investigations are complete, we should have:
1. Clear implementation plans for each feature
2. Understanding of file changes required
3. Recommended implementation order
4. Identified dependencies between features
5. Estimated complexity for each feature
