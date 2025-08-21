// components/FieldEditor.jsx - Component for editing CSV fields
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/FieldEditor.css';

// Fields that can be edited
const EDITABLE_FIELDS = [
  { key: 'menuName', label: 'Menu Name', required: true },
  { key: 'categoryName', label: 'Category Name', required: true },
  { key: 'dishName', label: 'Dish Name', required: true },
  { key: 'dishPrice', label: 'Dish Price', required: true },
  { key: 'dishDescription', label: 'Description', required: false },
  { key: 'tags', label: 'Tags', required: false, isArray: true }
];

function FieldEditor({ 
  items, 
  fieldEdits, 
  onFieldEdit, 
  bulkEditMode, 
  selectedBulkField,
  selectedPriceItems = [],
  onPriceItemSelect = () => {},
  priceAdjustmentMethod = 'percentage',
  markupPercentage = '',
  fixedAmount = '',
  defaultRounding = '.99',
  itemRoundingOverrides = {},
  onRoundingOverride = () => {},
  getFinalPrice = () => 0
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' or a specific category name
  const [bulkSelectedItems, setBulkSelectedItems] = useState([]);
  const [showBulkMenuName, setShowBulkMenuName] = useState(false);
  const [inlineEdits, setInlineEdits] = useState({});
  
  // Handle item selection for editing
  const handleSelectItem = (item) => {
    setSelectedItem(item);
    
    // Initialize edited fields with current values + any existing edits
    const initialValues = {};
    EDITABLE_FIELDS.forEach(field => {
      let value = item[field.key];
      
      // Handle array fields (like tags)
      if (field.isArray && Array.isArray(value)) {
        value = value.join(', ');
      }
      
      // Apply any existing edits
      if (fieldEdits[item.dishName] && fieldEdits[item.dishName][field.key] !== undefined) {
        value = fieldEdits[item.dishName][field.key];
        
        // Convert arrays back to comma-separated strings for editing
        if (field.isArray && Array.isArray(value)) {
          value = value.join(', ');
        }
      }
      
      initialValues[field.key] = value || '';
    });
    
    setEditedFields(initialValues);
  };
  
  // Handle field change
  const handleFieldChange = (fieldKey, value) => {
    setEditedFields(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };
  
  // Handle bulk category rename
  const handleBulkCategoryRename = (oldCategory, newCategory) => {
    // Get all items in this category
    const categoryItems = items.filter(item => item.categoryName === oldCategory);
    
    // Apply the edit to each item
    categoryItems.forEach(item => {
      onFieldEdit(item.dishName, 'categoryName', newCategory);
    });
    
    // Update the category filter if it was the renamed category
    if (categoryFilter === oldCategory) {
      setCategoryFilter(newCategory);
    }
  };
  
  // Handle bulk menu name update
  const handleBulkMenuNameUpdate = (newMenuName) => {
    if (!newMenuName.trim() || bulkSelectedItems.length === 0) return;
    
    // Apply the menu name edit to each selected item
    bulkSelectedItems.forEach(dishName => {
      onFieldEdit(dishName, 'menuName', newMenuName.trim());
    });
    
    // Clear selections and close bulk edit
    setBulkSelectedItems([]);
    setShowBulkMenuName(false);
  };
  
  // Handle item selection for bulk operations
  const handleBulkItemSelect = (dishName, isSelected) => {
    setBulkSelectedItems(prev => {
      if (isSelected && !prev.includes(dishName)) {
        return [...prev, dishName];
      } else if (!isSelected && prev.includes(dishName)) {
        return prev.filter(item => item !== dishName);
      }
      return prev;
    });
  };
  
  // Select all visible items
  const handleSelectAllVisible = () => {
    const visibleDishNames = filteredItems.map(item => item.dishName);
    setBulkSelectedItems(visibleDishNames);
  };
  
  // Deselect all items
  const handleDeselectAll = () => {
    setBulkSelectedItems([]);
  };
  
  // Handle inline field editing
  const handleInlineEdit = (dishName, fieldKey, value) => {
    // Update local state for immediate visual feedback
    setInlineEdits(prev => ({
      ...prev,
      [dishName]: {
        ...prev[dishName],
        [fieldKey]: value
      }
    }));
    
    // Debounce the actual save to avoid too many rapid updates
    clearTimeout(window.inlineEditTimeout);
    window.inlineEditTimeout = setTimeout(() => {
      onFieldEdit(dishName, fieldKey, value);
    }, 300);
  };
  
  // Get current value for inline editing (from edits, inline edits, or original)
  const getCurrentValue = (item, fieldKey) => {
    // Priority: inline edits > field edits > original value
    if (inlineEdits[item.dishName] && inlineEdits[item.dishName][fieldKey] !== undefined) {
      return inlineEdits[item.dishName][fieldKey];
    }
    if (fieldEdits[item.dishName] && fieldEdits[item.dishName][fieldKey] !== undefined) {
      return fieldEdits[item.dishName][fieldKey];
    }
    return item[fieldKey] || '';
  };
  
  // Calculate intermediate price (before rounding)
  const getCalculatedPrice = (item) => {
    const currentPrice = parseFloat(item.dishPrice) || 0;
    if (priceAdjustmentMethod === 'percentage') {
      const markup = parseFloat(markupPercentage) || 0;
      if (markup <= 0 || markup >= 100) return currentPrice;
      return currentPrice / (1 + markup / 100);
    } else {
      const amount = parseFloat(fixedAmount) || 0;
      return Math.max(0.50, currentPrice - amount);
    }
  };
  
  // Get price display string for an item
  const getPriceDisplay = (item) => {
    const currentPrice = parseFloat(item.dishPrice) || 0;
    const calculatedPrice = getCalculatedPrice(item);
    const finalPrice = getFinalPrice(item);
    
    return {
      current: currentPrice.toFixed(2),
      calculated: calculatedPrice.toFixed(2),
      final: finalPrice.toFixed(2)
    };
  };
  
  // Render inline edit input for selected bulk field
  const renderInlineEditField = (item, fieldKey) => {
    const currentValue = getCurrentValue(item, fieldKey);
    const inputId = `inline-${item.dishName}-${fieldKey}`;
    
    if (fieldKey === 'dishDescription') {
      return (
        <textarea
          id={inputId}
          value={currentValue}
          onChange={(e) => handleInlineEdit(item.dishName, fieldKey, e.target.value)}
          onBlur={() => {
            // Clear any pending timeout and save immediately on blur
            clearTimeout(window.inlineEditTimeout);
            onFieldEdit(item.dishName, fieldKey, getCurrentValue(item, fieldKey));
          }}
          className="inline-edit-textarea"
          rows={2}
          placeholder={`Enter ${fieldKey.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
        />
      );
    } else if (fieldKey === 'dishPrice') {
      return (
        <input
          id={inputId}
          type="number"
          step="0.01"
          min="0"
          value={currentValue}
          onChange={(e) => handleInlineEdit(item.dishName, fieldKey, e.target.value)}
          onBlur={() => {
            clearTimeout(window.inlineEditTimeout);
            onFieldEdit(item.dishName, fieldKey, getCurrentValue(item, fieldKey));
          }}
          className="inline-edit-input price-input"
          placeholder="0.00"
        />
      );
    } else {
      return (
        <input
          id={inputId}
          type="text"
          value={currentValue}
          onChange={(e) => handleInlineEdit(item.dishName, fieldKey, e.target.value)}
          onBlur={() => {
            clearTimeout(window.inlineEditTimeout);
            onFieldEdit(item.dishName, fieldKey, getCurrentValue(item, fieldKey));
          }}
          className="inline-edit-input"
          placeholder={`Enter ${fieldKey.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
        />
      );
    }
  };
  
  // Save changes
  const handleSaveChanges = () => {
    if (!selectedItem) return;
    
    // Process the fields before saving
    const processedFields = {};
    
    Object.entries(editedFields).forEach(([key, value]) => {
      const fieldDef = EDITABLE_FIELDS.find(f => f.key === key);
      
      // Skip if the field value hasn't changed
      if (value === selectedItem[key] && 
          !(fieldEdits[selectedItem.dishName] && 
            fieldEdits[selectedItem.dishName][key] !== undefined)) {
        return;
      }
      
      // Process special field types
      if (fieldDef && fieldDef.isArray) {
        // Convert comma-separated string to array for array fields
        processedFields[key] = value
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      } else {
        processedFields[key] = value;
      }
    });
    
    // Only save if there are actual changes
    if (Object.keys(processedFields).length > 0) {
      onFieldEdit(selectedItem.dishName, processedFields);
    }
    
    // Clear selection
    setSelectedItem(null);
    setEditedFields({});
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setSelectedItem(null);
    setEditedFields({});
  };
  
  // Get unique categories for filtering
  const uniqueCategories = [...new Set(items.map(item => item.categoryName || 'Uncategorized'))].sort();
  
  // Filter items based on search term and category filter
  const filteredItems = items.filter(item => {
    // Filter by search term
    const matchesSearch = !searchTerm || 
      (item.dishName && item.dishName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    // Filter by category if not 'all'
    if (categoryFilter !== 'all') {
      return item.categoryName === categoryFilter;
    }
    
    return true;
  });
  
  // Check if the current item has been edited
  const hasEdits = (item) => {
    return fieldEdits[item.dishName] && Object.keys(fieldEdits[item.dishName]).length > 0;
  };
  
  return (
    <div className="field-editor">
      <div className="field-editor-header">
        <h3>Edit CSV Fields</h3>
        <div className="search-filters">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="category-filter">
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="category-select"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {categoryFilter !== 'all' && (
          <div className="category-rename-section">
            <h4>Rename Category: {categoryFilter}</h4>
            <div className="rename-controls">
              <input 
                type="text" 
                placeholder="New category name" 
                id="new-category-name"
              />
              <button 
                className="rename-category-button"
                onClick={() => {
                  const newName = document.getElementById('new-category-name').value;
                  if (newName && newName !== categoryFilter) {
                    handleBulkCategoryRename(categoryFilter, newName);
                    document.getElementById('new-category-name').value = '';
                  }
                }}
              >
                Rename All Items in Category
              </button>
            </div>
            <div className="rename-info">
              This will change the category for all {items.filter(item => item.categoryName === categoryFilter).length} items in this category.
            </div>
          </div>
        )}
        
        <div className="bulk-edit-section">
          <div className="bulk-edit-header">
            <h4>Bulk Edit Menu Name</h4>
            <button 
              className="toggle-bulk-button"
              onClick={() => setShowBulkMenuName(!showBulkMenuName)}
            >
              {showBulkMenuName ? 'Hide Bulk Edit' : 'Show Bulk Edit'}
            </button>
          </div>
          
          {showBulkMenuName && (
            <div className="bulk-edit-controls">
              <div className="selection-controls">
                <button onClick={handleSelectAllVisible} className="select-button">
                  Select All Visible ({filteredItems.length})
                </button>
                <button onClick={handleDeselectAll} className="select-button">
                  Deselect All
                </button>
                <span className="selection-count">
                  {bulkSelectedItems.length} items selected
                </span>
              </div>
              
              <div className="bulk-edit-input">
                <input 
                  type="text" 
                  placeholder="New menu name for selected items" 
                  id="bulk-menu-name"
                />
                <button 
                  className="apply-bulk-button"
                  onClick={() => {
                    const newMenuName = document.getElementById('bulk-menu-name').value;
                    if (newMenuName) {
                      handleBulkMenuNameUpdate(newMenuName);
                      document.getElementById('bulk-menu-name').value = '';
                    }
                  }}
                  disabled={bulkSelectedItems.length === 0}
                >
                  Apply to {bulkSelectedItems.length} Items
                </button>
              </div>
              
              <div className="bulk-edit-info">
                Select items below and enter a new menu name to apply to all selected items.
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="field-editor-content">
        <div className={`items-list ${bulkEditMode && selectedBulkField ? 'expanded' : ''}`}>
          <div className="items-list-header">
            <span>Menu Items ({items.length})</span>
            <span className="edited-count">
              {Object.keys(fieldEdits).length} edited
            </span>
          </div>
          
          {filteredItems.length === 0 ? (
            <div className="no-items">No items match your search</div>
          ) : (
            <div className="items-container">
              {filteredItems.map(item => (
                <div 
                  key={item.dishName}
                  className={`item-row ${hasEdits(item) ? 'edited' : ''} ${selectedItem && selectedItem.dishName === item.dishName ? 'selected' : ''} ${bulkSelectedItems.includes(item.dishName) ? 'bulk-selected' : ''} ${selectedBulkField === 'priceMarkup' && selectedPriceItems.includes(item.dishName) ? 'price-selected' : ''}`}
                >
                  {showBulkMenuName && (
                    <div className="bulk-select-checkbox">
                      <input
                        type="checkbox"
                        checked={bulkSelectedItems.includes(item.dishName)}
                        onChange={(e) => handleBulkItemSelect(item.dishName, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  
                  {selectedBulkField === 'priceMarkup' && (
                    <div className="price-select-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedPriceItems.includes(item.dishName)}
                        onChange={(e) => onPriceItemSelect(item.dishName, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <div className="item-content" onClick={() => !showBulkMenuName && !bulkEditMode && handleSelectItem(item)}>
                    <div className="item-info">
                      <div className="item-name">{item.dishName}</div>
                      <div className="item-category">{item.categoryName}</div>
                      <div className="item-menu-name">{item.menuName}</div>
                    </div>
                    
                    {selectedBulkField === 'priceMarkup' && selectedPriceItems.includes(item.dishName) && (
                      <div className="price-adjustment-display">
                        <div className="price-calculation">
                          {(() => {
                            const prices = getPriceDisplay(item);
                            return (
                              <div className="price-flow">
                                <span className="price-current">${prices.current}</span>
                                <span className="price-arrow">→</span>
                                <span className="price-calculated">${prices.calculated}</span>
                                <span className="price-arrow">→</span>
                                <span className="price-final">${prices.final}</span>
                              </div>
                            );
                          })()} 
                        </div>
                        <div className="rounding-override">
                          <select
                            value={itemRoundingOverrides[item.dishName] || defaultRounding}
                            onChange={(e) => onRoundingOverride(item.dishName, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="none">No rounding</option>
                            <option value=".00">.00</option>
                            <option value=".50">.50</option>
                            <option value=".90">.90</option>
                            <option value=".99">.99</option>
                          </select>
                        </div>
                      </div>
                    )}
                    
                    {bulkEditMode && selectedBulkField && selectedBulkField !== 'priceMarkup' && (
                      <div className="inline-edit-container">
                        <label className="inline-edit-label">
                          {selectedBulkField.replace(/([A-Z])/g, ' $1')}:
                        </label>
                        {renderInlineEditField(item, selectedBulkField)}
                      </div>
                    )}
                    
                    {hasEdits(item) && <div className="edited-badge">Edited</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {!(bulkEditMode && selectedBulkField) && (
          <div className="edit-panel">
          {selectedItem ? (
            <>
              <div className="edit-panel-header">
                <h4>Editing: {selectedItem.dishName}</h4>
              </div>
              
              <div className="edit-fields">
                {EDITABLE_FIELDS.map(field => (
                  <div key={field.key} className="field-group">
                    <label>
                      {field.label}
                      {field.required && <span className="required">*</span>}
                    </label>
                    
                    {field.key === 'dishDescription' ? (
                      <textarea
                        value={editedFields[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <input
                        type={field.key === 'dishPrice' ? 'number' : 'text'}
                        step={field.key === 'dishPrice' ? '0.01' : undefined}
                        value={editedFields[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        required={field.required}
                      />
                    )}
                    
                    {field.isArray && (
                      <div className="field-hint">
                        Separate multiple values with commas
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="edit-actions">
                <button 
                  className="cancel-button" 
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button 
                  className="save-button" 
                  onClick={handleSaveChanges}
                >
                  Save Changes
                </button>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>Select an item to edit its fields</p>
              <p className="hint">
                Edited fields will be used in the CSV export. Required fields are marked with *
              </p>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

FieldEditor.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  fieldEdits: PropTypes.object.isRequired,
  onFieldEdit: PropTypes.func.isRequired,
  bulkEditMode: PropTypes.bool,
  selectedBulkField: PropTypes.string,
  selectedPriceItems: PropTypes.arrayOf(PropTypes.string),
  onPriceItemSelect: PropTypes.func,
  priceAdjustmentMethod: PropTypes.string,
  markupPercentage: PropTypes.string,
  fixedAmount: PropTypes.string,
  defaultRounding: PropTypes.string,
  itemRoundingOverrides: PropTypes.object,
  onRoundingOverride: PropTypes.func,
  getFinalPrice: PropTypes.func
};

FieldEditor.defaultProps = {
  bulkEditMode: false,
  selectedBulkField: '',
  selectedPriceItems: [],
  onPriceItemSelect: () => {},
  priceAdjustmentMethod: 'percentage',
  markupPercentage: '',
  fixedAmount: '',
  defaultRounding: '.99',
  itemRoundingOverrides: {},
  onRoundingOverride: () => {},
  getFinalPrice: () => 0
};

export default FieldEditor;