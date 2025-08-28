# Menu Edit Enhancements Project Documentation

## Project Overview
Enhancement of the menu editing capabilities in the UberEats Image Extractor application to allow users to edit category names, delete categories, and delete individual menu items.

**Last Updated**: January 8, 2025  
**Status**: COMPLETE ✅ (Both MenuDetail and ExtractionDetail fully functional)

## Completed Features

### 1. UI Enhancements in MenuDetail.jsx

#### Category Management
- ✅ **Edit Category Names**: 
  - Inline editing with save/cancel buttons
  - Real-time UI updates while editing
  - Automatic category selection when editing starts
  - Fixed overlapping icons with item count

- ✅ **Delete Categories**:
  - Trash icon on hover for each category
  - Confirmation dialog before deletion
  - Removes all items in the category

#### Item Management  
- ✅ **Delete Individual Items**:
  - Red delete button in bottom-left corner of each item (in edit mode)
  - Items disappear from UI immediately
  - Marked for deletion on save

#### Visual Improvements
- ✅ Fixed edit/delete button positioning to avoid overlap
- ✅ Made delete buttons always visible (60% opacity) instead of hover-only
- ✅ Added proper spacing between buttons and content
- ✅ Implemented change tracking with visual indicators

### 2. Frontend State Management

#### State Variables Added
```javascript
const [editingCategoryName, setEditingCategoryName] = useState(null);
const [tempCategoryName, setTempCategoryName] = useState('');
const [deletedItems, setDeletedItems] = useState(new Set());
const [deletedCategories, setDeletedCategories] = useState(new Set());
const [categoryNameChanges, setCategoryNameChanges] = useState({});
```

#### Key Functions Implemented
- `handleStartEditCategoryName()` - Initiates category editing and auto-selects it
- `handleSaveCategoryName()` - Saves category name change locally
- `handleDeleteCategory()` - Marks category for deletion with confirmation
- `handleDeleteItem()` - Marks individual item for deletion

### 3. API Integration Updates

#### Problem Discovered
- No backend endpoints exist for `/api/categories/{id}` (PATCH/DELETE)
- No DELETE endpoint for `/api/menu-items/{id}`
- Bulk update endpoint only updates changed fields, not all fields

#### Solution Implemented
All operations now go through the existing `/api/menu-items/bulk-update` endpoint:

```javascript
// Category Rename: Send complete item data with new category
{
  id: "item-id",
  name: "Item Name",
  price: 10.99,
  category: "New Category Name",  // Changed field
  description: "Description",
  tags: ["tag1"],
  imageURL: "url"
}

// Item/Category Deletion: Mark with is_deleted flag
{
  id: "item-id",
  name: "Item Name",
  price: 10.99,
  category: "Category",
  description: "Description",
  is_deleted: true  // Deletion flag
}
```

### 4. Save Logic Rewrite

The `handleSaveChanges` function now:
1. Collects all items to delete (individual + category deletions)
2. Creates deletion updates with `is_deleted: true` flag
3. Handles category renames by updating all items with new category name
4. Combines all updates into single bulk request
5. Sends complete item data (not just changed fields)

## Issues Resolved

1. **Menu items disappearing when editing category name**: Fixed by mapping renamed categories to original names
2. **API endpoint 404 errors**: Removed calls to non-existent endpoints  
3. **Bulk update returning 0 updates**: Fixed by sending complete item data
4. **Overlapping edit/delete icons**: Restructured layout with proper spacing
5. **Category rename failing**: Fixed by updating category_id instead of non-existent category field
6. **Empty categories showing after deletion**: Fixed by filtering out categories with no items
7. **Database schema mismatch**: Handled proper relationship between menu_items and categories tables

## Remaining Work

### 1. ✅ Backend Updates COMPLETED

#### Database Service (database-service.js) - COMPLETED
The `bulkUpdateMenuItems` function now properly:
- ✅ Handles the `is_deleted` flag to delete items
- ✅ Handles category renames by creating/finding categories and updating category_id
- ✅ Properly manages the relationship between menu_items and categories tables

```javascript
// Implemented solution (lines 1549-1690)
async function bulkUpdateMenuItems(updates) {
  for (const update of updates) {
    const { id, imageURL, is_deleted, ...data } = update;
    
    // Handle deletions
    if (is_deleted) {
      // Delete item and its associations
      await supabase.from('item_images').delete().eq('menu_item_id', id);
      await supabase.from('menu_items').delete().eq('id', id);
      continue;
    }
    
    // Handle category renames
    if (data.category) {
      // Find or create category with new name
      // Update category_id instead of non-existent category field
      // ... (implemented)
    }
    
    // Update the item
    // ... (implemented)
  }
}
```

### 2. Extraction Edit View Updates

The extraction edit view needs the same enhancements. Files to modify:

#### /src/pages/ExtractionDetail.jsx (or similar)
- Add category editing capabilities
- Add item/category deletion
- Implement same state management
- Use same save logic pattern

Key changes needed:
```javascript
// Add state variables
const [deletedItems, setDeletedItems] = useState(new Set());
const [deletedCategories, setDeletedCategories] = useState(new Set());
const [categoryNameChanges, setCategoryNameChanges] = useState({});

// Add handler functions
const handleDeleteItem = (itemId) => { /* ... */ };
const handleDeleteCategory = (categoryName) => { /* ... */ };
const handleStartEditCategoryName = (categoryName) => { /* ... */ };

// Update save logic to handle deletions and renames
```

### 3. Testing Requirements

#### Frontend Testing
- [ ] Test category rename with special characters
- [ ] Test deleting category with many items (>50)
- [ ] Test simultaneous edits (rename + delete + item edits)
- [ ] Test cancel functionality restores original state
- [ ] Test save with validation errors

#### Backend Testing  
- [ ] Verify is_deleted flag properly removes items
- [ ] Test bulk update with 100+ items
- [ ] Verify database constraints maintained
- [ ] Test concurrent updates from multiple users
- [ ] Verify cascade deletes don't affect other menus

#### Integration Testing
- [ ] Full flow: Extract → Edit → Save → Reload
- [ ] Verify changes persist after page refresh
- [ ] Test with different user roles/permissions
- [ ] Verify menu history tracking (if applicable)

### 4. Additional Enhancements to Consider

#### Performance Optimizations
- Batch database operations in transactions
- Add pagination for large menus (500+ items)
- Implement optimistic updates for better UX
- Add debouncing for category name changes

#### UX Improvements
- Add undo/redo functionality
- Show deletion preview before save
- Add bulk operations (select multiple items)
- Add keyboard shortcuts for common actions
- Add drag-and-drop to reorder categories

#### Data Integrity
- Add soft delete option (archive instead of delete)
- Implement change history/audit log
- Add conflict resolution for concurrent edits
- Validate category names are unique per menu

## Technical Architecture

### Component Hierarchy
```
MenuDetail.jsx
├── Category List (left panel)
│   ├── Category Items
│   │   ├── Edit button
│   │   ├── Delete button
│   │   └── Item count
│   └── Category Name Editor (when editing)
└── Menu Items (right panel)
    ├── Category Header
    │   └── Inline name editor
    └── EditableMenuItem components
        ├── Delete button (bottom-left)
        └── Field editors (name, price, etc.)
```

### Data Flow
1. **User Action** → State Update → UI Update
2. **Save Triggered** → Collect Changes → Format for API
3. **API Call** → Backend Processing → Database Update
4. **Response** → Refresh Data → Update UI

### API Endpoints Used
- `GET /api/menus/{id}` - Fetch menu details
- `POST /api/menu-items/bulk-update` - Update/delete items
- `GET /api/restaurants/{id}/menus` - Refresh after save

## Migration Guide

### For MenuDetail.jsx Users
No action required - changes are backward compatible.

### For Developers Adding to Other Views

1. **Import Required Components**:
```javascript
import { EditableMenuItem } from '../components/menu/EditableMenuItem';
import { Trash2, PencilIcon, CheckIcon, XMarkIcon } from 'lucide-react';
```

2. **Add State Management**:
Copy state variables and handlers from MenuDetail.jsx (lines 50-270)

3. **Update Save Logic**:
Use the new pattern that combines all updates into single bulk request

4. **Test Thoroughly**:
Follow testing requirements above

## Known Limitations

1. **No Real-time Collaboration**: Changes by other users not reflected until refresh
2. **No Offline Support**: Requires active connection to save
3. **Limited Validation**: Frontend validation only, backend needs enhancement
4. **No Bulk Selection**: Can't delete multiple items at once
5. **No Export of Changes**: Can't download list of modifications

## Next Steps Priority

1. ~~**HIGH**: Update backend to handle `is_deleted` flag~~ ✅ COMPLETED
2. **HIGH**: Add same features to extraction edit view - IN PROGRESS
3. **MEDIUM**: Add comprehensive error handling
4. **MEDIUM**: Implement change history/audit log
5. **LOW**: Add performance optimizations
6. **LOW**: Implement additional UX enhancements

## Code References

### Key Files Modified
- `/src/pages/MenuDetail.jsx` (lines 50-390) - Main implementation
- `/src/components/menu/EditableMenuItem.jsx` (lines 130-145) - Delete button
- `/src/services/api.js` - API service layer

### Files Requiring Updates
- `/src/services/database-service.js` (line 1549+) - bulkUpdateMenuItems
- `/src/pages/ExtractionDetail.jsx` - Needs feature parity
- `/server.js` - Consider adding dedicated endpoints

## Current Implementation Summary

### MenuDetail.jsx - FULLY FUNCTIONAL ✅
All features are working correctly:
- **Category Renaming**: Creates new category, updates all items' category_id
- **Category Deletion**: Deletes all items in the category from database
- **Item Deletion**: Marks items with is_deleted flag and removes from database
- **UI Polish**: Delete buttons visible, proper positioning, empty categories filtered
- **Database Integration**: Properly handles menu_items ↔ categories relationship

### Database Service - FULLY FUNCTIONAL ✅
- Handles is_deleted flag for deletions
- Creates/finds categories for renames
- Updates category_id (not category field)
- Properly logs all operations for debugging

### ExtractionDetail.jsx - FULLY FUNCTIONAL ✅

All features are now working correctly:
- **Category Renaming**: Updates category display name locally via categoryNameChanges
- **Category Deletion**: Marks categories for deletion with confirmation
- **Item Deletion**: Marks individual items for deletion
- **UI Polish**: Edit/delete buttons visible in edit mode, proper positioning
- **Save Logic**: Bulk updates items with is_deleted flag and category renames
- **Bug Fix**: Fixed white screen issue when saving category name (keeps original key in menuData)

## Implementation Guide for Remaining Work

### Step 1: Update handleSaveChanges in ExtractionDetail.jsx
Copy the logic from MenuDetail.jsx (lines 297-389) with these key sections:
```javascript
// Collect all items to delete (individual + category deletions)
const itemsToDelete = new Set(deletedItems);
// Add items from deleted categories
// Mark items for deletion with is_deleted: true
// Handle category renames by updating items with new category name
// Combine all updates: [...deletionUpdates, ...categoryRenamedItems, ...changedItems]
// Call menuItemAPI.bulkUpdate(allItemsToUpdate)
```

### Step 2: Add UI Elements
1. **Import required icons** (add to line 4-13):
   ```javascript
   import { TrashIcon } from '@heroicons/react/24/outline';
   ```

2. **Update categories list filter** (around line 600+):
   ```javascript
   const categories = Object.keys(menuData).filter(cat => {
     if (deletedCategories.has(cat)) return false;
     const itemsInCategory = menuData[cat] || [];
     const hasActiveItems = itemsInCategory.some(item => !deletedItems.has(item.id));
     return hasActiveItems;
   });
   ```

3. **Add category edit/delete buttons** (in category list rendering):
   ```javascript
   {isEditMode && (
     <div className="flex items-center gap-1">
       <button onClick={() => handleStartEditCategoryName(category)}>
         <PencilIcon className="h-3 w-3" />
       </button>
       <button onClick={() => handleDeleteCategory(category)}>
         <TrashIcon className="h-3 w-3 text-red-600" />
       </button>
     </div>
   )}
   ```

4. **Pass onDelete to EditableMenuItem** (around line 710+):
   ```javascript
   <EditableMenuItem
     item={currentItem}
     isEditMode={isEditMode}
     onUpdate={handleItemChange}
     onDelete={() => handleDeleteItem(item.id)} // Add this line
     validationErrors={validationErrors[item.id] || {}}
   />
   ```

### Step 3: Testing Checklist
- [ ] Category rename updates all items in that category
- [ ] Category deletion removes all items
- [ ] Individual item deletion works
- [ ] Empty categories don't show after save
- [ ] Cancel resets all changes
- [ ] Save processes all changes correctly

## Conclusion

The menu edit enhancements are **95% complete**:
- ✅ MenuDetail.jsx fully functional with all features
- ✅ Backend properly handles all operations (is_deleted, category_id updates)
- ✅ Database schema properly utilized
- 🔄 ExtractionDetail.jsx 70% complete (core logic done, UI updates needed)

The remaining work is straightforward - primarily copying the proven implementation patterns from MenuDetail.jsx to complete the ExtractionDetail.jsx implementation.