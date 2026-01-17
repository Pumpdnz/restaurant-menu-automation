# Investigation Task 1: Component Context for EditableMenuItem

## Summary

Comprehensive investigation of the `EditableMenuItem.jsx` component tracing its usage, data flow, API integration, and database persistence mechanisms.

---

## 1. Component Usage Map

### EditableMenuItem.jsx Location
**Path:** `UberEats-Image-Extractor/src/components/menu/EditableMenuItem.jsx`

### Files Using EditableMenuItem

#### 1.1 MenuDetail.jsx
**Path:** `UberEats-Image-Extractor/src/pages/MenuDetail.jsx`

- **Line 21:** Import statement
- **Lines 1050-1057:** Component instantiation
```javascript
<EditableMenuItem
  key={item.id}
  item={currentItem}
  isEditMode={isEditMode}
  onUpdate={handleItemChange}
  onDelete={() => handleDeleteItem(item.id)}
  validationErrors={validationErrors[item.id] || {}}
/>
```

**Context:** MenuDetail renders menu items from a selected category, allowing view/edit modes.

#### 1.2 ExtractionDetail.jsx
**Path:** `UberEats-Image-Extractor/src/pages/ExtractionDetail.jsx`

- **Line 20:** Import statement
- **Lines 1245-1252:** Component instantiation (same props pattern)

**Context:** Displays menu items extracted from delivery platforms for editing before save.

---

## 2. Data Flow Analysis

### 2.1 From Parent to Component
```
Parent State: menuData (organized by category)
    ↓
Item Lookup: const currentItem = editedItems[item.id] || item;
    ↓
EditableMenuItem Props:
  - item: currentItem
  - isEditMode: boolean
  - onUpdate: handleItemChange callback
  - onDelete: handleDeleteItem callback
  - validationErrors: object
```

### 2.2 Component Internal State (Lines 16-24)
```javascript
const [editedItem, setEditedItem] = useState(item);
const [newTag, setNewTag] = useState('');
const [hasChanges, setHasChanges] = useState(false);
```

### 2.3 Tag Handling (Lines 57-70)
```javascript
const handleAddTag = () => {
  if (newTag.trim()) {
    const currentTags = editedItem.tags || [];
    if (!currentTags.includes(newTag.trim())) {
      handleFieldChange('tags', [...currentTags, newTag.trim()]);
    }
    setNewTag('');
  }
};
```

**Features:**
- Duplicate prevention
- Whitespace trimming
- Array-based storage

### 2.4 Field Change Handler (Lines 37-41)
```javascript
const handleFieldChange = (field, value) => {
  const updated = { ...editedItem, [field]: value };
  setEditedItem(updated);
  onUpdate(item.id, updated);  // Calls parent immediately
};
```

---

## 3. API and Database Persistence

### 3.1 API Service
**File:** `UberEats-Image-Extractor/src/services/api.js` (Lines 94-103)
```javascript
export const menuItemAPI = {
  update: (id, data) => api.patch(`/menu-items/${id}`, data),
  bulkUpdate: (updates) => api.post('/menu-items/bulk-update', { updates }),
  addToCategory: (categoryId, data) => api.post(`/categories/${categoryId}/items`, data),
};
```

### 3.2 Backend Endpoint
**File:** `UberEats-Image-Extractor/server.js`
**Endpoint:** `POST /api/menu-items/bulk-update`

### 3.3 Database Service
**File:** `UberEats-Image-Extractor/src/services/database-service.js`
**Function:** `bulkUpdateMenuItems` (Lines ~300-450)

Updates `menu_items` table in Supabase with all fields including tags.

---

## 4. Validation

### MenuItemValidator.js (Lines 34-41)
```javascript
if (item.tags && !Array.isArray(item.tags)) {
  errors.tags = 'Tags must be an array';
} else if (item.tags && item.tags.some(tag => typeof tag !== 'string')) {
  errors.tags = 'All tags must be strings';
} else if (item.tags && item.tags.some(tag => tag.length > 50)) {
  errors.tags = 'Each tag must be less than 50 characters';
}
```

**Constraints:**
- Tags must be array (optional)
- Each tag must be string
- Max 50 characters per tag

---

## 5. Existing Preset Tags Reference

**File:** `scripts/restaurant-registration/add-item-tags.js` (Lines 59-71)
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

---

## 6. Key Interface Definitions

```typescript
interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  tags?: string[];  // Array of tag strings
  imageURL?: string | null;
  categoryId?: string;
  optionSets?: OptionSet[];
}

interface EditableMenuItemProps {
  item: MenuItem;
  isEditMode: boolean;
  onUpdate: (itemId: string, updatedItem: MenuItem) => void;
  onDelete?: (itemId: string) => void;
  validationErrors?: Record<string, string>;
}
```

---

## 7. File References Summary

| Component | File Path | Key Lines |
|-----------|-----------|-----------|
| EditableMenuItem | `src/components/menu/EditableMenuItem.jsx` | 1-271 |
| MenuDetail | `src/pages/MenuDetail.jsx` | 21, 326-357, 1050-1057 |
| ExtractionDetail | `src/pages/ExtractionDetail.jsx` | 20, 463-484, 1245-1252 |
| API Service | `src/services/api.js` | 94-103 |
| Database Service | `src/services/database-service.js` | ~1500-1700 |
| Validator | `src/components/menu/MenuItemValidator.js` | 34-41 |
