/**
 * Validation utilities for menu items
 */

/**
 * Validate a single menu item
 * @param {Object} item - The menu item to validate
 * @returns {Object} - Validation errors object (empty if valid)
 */
export function validateMenuItem(item) {
  const errors = {};

  // Name validation
  if (!item.name || item.name.trim().length === 0) {
    errors.name = 'Item name is required';
  } else if (item.name.length > 200) {
    errors.name = 'Item name must be less than 200 characters';
  }

  // Price validation
  if (item.price === undefined || item.price === null || item.price === '') {
    errors.price = 'Price is required';
  } else if (isNaN(item.price) || parseFloat(item.price) < 0) {
    errors.price = 'Price must be a positive number';
  } else if (parseFloat(item.price) > 9999.99) {
    errors.price = 'Price must be less than $10,000';
  }

  // Description validation (optional)
  if (item.description && item.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  // Tags validation (optional)
  if (item.tags && !Array.isArray(item.tags)) {
    errors.tags = 'Tags must be an array';
  } else if (item.tags && item.tags.some(tag => typeof tag !== 'string')) {
    errors.tags = 'All tags must be strings';
  } else if (item.tags && item.tags.some(tag => tag.length > 50)) {
    errors.tags = 'Each tag must be less than 50 characters';
  }

  return errors;
}

/**
 * Validate multiple menu items
 * @param {Array} items - Array of menu items to validate
 * @returns {Object} - Object with itemId as key and errors as value
 */
export function validateMenuItems(items) {
  const allErrors = {};
  
  items.forEach(item => {
    const errors = validateMenuItem(item);
    if (Object.keys(errors).length > 0) {
      allErrors[item.id] = errors;
    }
  });

  return allErrors;
}

/**
 * Check if an item has been modified
 * @param {Object} original - Original item
 * @param {Object} edited - Edited item
 * @returns {boolean} - True if item has changes
 */
export function hasItemChanges(original, edited) {
  // Check basic fields
  if (original.name !== edited.name) return true;
  if (original.price !== edited.price) return true;
  if (original.description !== edited.description) return true;
  if (original.imageURL !== edited.imageURL) return true;
  
  // Check tags array
  const originalTags = JSON.stringify(original.tags || []);
  const editedTags = JSON.stringify(edited.tags || []);
  if (originalTags !== editedTags) return true;

  return false;
}

/**
 * Get list of changed items
 * @param {Object} originalItems - Original items object (keyed by ID)
 * @param {Object} editedItems - Edited items object (keyed by ID)
 * @returns {Array} - Array of changed item objects with their IDs
 */
export function getChangedItems(editedItems, originalMenuData) {
  const changes = [];
  
  // First flatten the original menu data into a lookup by ID
  const originalLookup = {};
  if (originalMenuData) {
    Object.values(originalMenuData).forEach(categoryItems => {
      categoryItems.forEach(item => {
        originalLookup[item.id] = item;
      });
    });
  }
  
  // Now compare edited items with originals
  Object.keys(editedItems).forEach(itemId => {
    const original = originalLookup[itemId];
    const edited = editedItems[itemId];
    
    if (original && edited && hasItemChanges(original, edited)) {
      changes.push({
        id: itemId,
        name: edited.name,
        price: edited.price,
        description: edited.description,
        tags: edited.tags,
        imageURL: edited.imageURL
      });
    }
  });

  return changes;
}

/**
 * Format price for display
 * @param {number} price - Price value
 * @returns {string} - Formatted price string
 */
export function formatPrice(price) {
  if (price === undefined || price === null || price === '') {
    return '0.00';
  }
  return parseFloat(price).toFixed(2);
}

/**
 * Parse price from input string
 * @param {string} value - Input value
 * @returns {number} - Parsed price
 */
export function parsePrice(value) {
  // Remove non-numeric characters except decimal
  const cleanValue = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleanValue.split('.');
  const formattedValue = parts.length > 2 
    ? parts[0] + '.' + parts.slice(1).join('') 
    : cleanValue;
  
  // Parse and round to 2 decimal places
  const parsed = parseFloat(formattedValue) || 0;
  return Math.round(parsed * 100) / 100;
}