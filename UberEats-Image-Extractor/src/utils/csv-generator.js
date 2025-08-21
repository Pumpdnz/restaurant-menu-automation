/**
 * csv-generator.js - Utility for converting Firecrawl API data to CSV format
 * 
 * This utility handles the conversion of JSON data from the Firecrawl API
 * to a structured CSV format compatible with Pump'd's menu creation system.
 */

/**
 * CSV column headers for the Pump'd menu format
 */
export const CSV_HEADERS = [
  'menuID',
  'menuName',
  'menuDisplayName',
  'menuDescription',
  'categoryID',
  'categoryName',
  'categoryDisplayName',
  'categoryDescription',
  'dishID',
  'dishName',
  'dishPrice',
  'dishType',
  'dishDescription',
  'displayName',
  'printName',
  'tags'
];

/**
 * Default dish type for menu items
 */
export const DEFAULT_DISH_TYPE = 'standard';

/**
 * CSV column headers for option sets
 */
export const OPTION_SETS_CSV_HEADERS = [
  'optionSetName',
  'optionSetDisplayName', 
  'required',
  'selectMultiple',
  'enableOptionQuantity',
  'minOptionsRequired',
  'maxOptionsAllowed',
  'freeQuantity',
  'optionName',
  'optionPrintName',
  'optionPrice',
  'menuItems'
];

/**
 * Convert Firecrawl extraction data to CSV format
 * 
 * @param {Object} data - Extraction data from Firecrawl API
 * @param {Object} options - Conversion options
 * @param {Array<string>} options.comboItems - Array of dish names to mark as "combo" items
 * @param {Object} options.fieldEdits - Custom field edits to apply
 * @returns {Object} - CSV data and metadata
 */
export function convertToCSV(data, options = {}) {
  if (!data || !data.menuItems || !Array.isArray(data.menuItems)) {
    throw new Error('Invalid data structure: menuItems array is required');
  }
  
  // Extract options
  const comboItems = options.comboItems || [];
  const fieldEdits = options.fieldEdits || {};
  
  // Build CSV content starting with headers
  let csvContent = CSV_HEADERS.join(',') + '\n';
  
  // Get a consistent menu name as fallback for all items
  const restaurantName = getRestaurantName(data);
  const defaultMenuName = restaurantName || 'Takeaway Menu';
  
  // Process each menu item
  data.menuItems.forEach(item => {
    // Skip excluded items (if exclusions are defined in options)
    if (options.excludedItems && options.excludedItems.includes(item.dishName)) {
      return;
    }
    
    // Apply any custom field edits if they exist
    const customItem = {
      ...item,
      ...(fieldEdits[item.dishName] || {})
    };
    
    // Use custom menu name if available from edits, otherwise use default
    const itemMenuName = customItem.menuName || defaultMenuName;
    
    // Determine if this item is a combo
    const isDishTypeCombo = comboItems.includes(customItem.dishName);
    const dishType = isDishTypeCombo ? 'combo' : DEFAULT_DISH_TYPE;
    
    // Format tags as a comma-separated string
    const tagsString = customItem.tags && Array.isArray(customItem.tags) 
      ? customItem.tags.join(', ')
      : '';
    
    // Build the CSV row with all required fields
    const row = [
      '', // menuID - leave blank
      escapeCSVField(itemMenuName), // menuName
      '', // menuDisplayName - leave blank
      '', // menuDescription - leave blank
      '', // categoryID - leave blank
      escapeCSVField(customItem.categoryName || 'Uncategorized'), // categoryName
      '', // categoryDisplayName - leave blank
      '', // categoryDescription - leave blank
      '', // dishID - leave blank
      escapeCSVField(customItem.dishName || ''), // dishName
      formatPrice(customItem.dishPrice || 0), // dishPrice
      dishType, // dishType - standard or combo
      escapeCSVField(customItem.dishDescription || ''), // dishDescription
      '', // displayName - leave blank
      '', // printName - leave blank
      escapeCSVField(tagsString) // tags
    ];
    
    // Add the row to the CSV content
    csvContent += row.join(',') + '\n';
  });
  
  return {
    csvContent,
    rowCount: data.menuItems.length,
    columnCount: CSV_HEADERS.length
  };
}

/**
 * Generate a downloadable CSV blob
 * 
 * @param {Object} data - Extraction data from Firecrawl API
 * @param {Object} options - Conversion options
 * @returns {Object} - Blob and suggested filename
 */
export function generateCSVBlob(data, options = {}) {
  // Convert data to CSV format
  const { csvContent } = convertToCSV(data, options);
  
  // Create blob with UTF-8 encoding and BOM
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
  
  // Generate a filename based on restaurant name and date
  const restaurantName = getRestaurantName(data);
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `${formatFilename(restaurantName)}_menu_${date}.csv`;
  
  return {
    blob,
    filename
  };
}

/**
 * Download the CSV file
 * 
 * @param {Object} data - Extraction data from Firecrawl API
 * @param {Object} options - Conversion options
 * @returns {boolean} - Success status
 */
export function downloadCSV(data, options = {}) {
  try {
    // Generate CSV blob and filename
    const { blob, filename } = generateCSVBlob(data, options);
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Error downloading CSV:', error);
    return false;
  }
}

/**
 * Extract restaurant name from the data
 * 
 * @param {Object} data - Extraction data
 * @returns {string} - Restaurant name or default
 */
function getRestaurantName(data) {
  let restaurantName = 'restaurant';
  
  // Try to get the actual restaurant name from restaurantInfo
  if (data.restaurantInfo && data.restaurantInfo.name) {
    restaurantName = data.restaurantInfo.name;
  }
  // NOTE: Removed fallback to data.menuItems[0].menuName because this represents
  // menu sections/categories (like "Featured Items"), not the restaurant name
  
  return restaurantName;
}

/**
 * Format a filename to be filesystem-safe
 * 
 * @param {string} name - Original name
 * @returns {string} - Filesystem-safe name
 */
function formatFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

/**
 * Format a price value consistently
 * 
 * @param {number|string} price - Price value
 * @returns {string} - Formatted price
 */
function formatPrice(price) {
  // Handle various price formats
  if (typeof price === 'string') {
    // Remove currency symbols and whitespace
    price = price.replace(/[$€£¥\s]/g, '');
    
    // Parse to float
    price = parseFloat(price);
  }
  
  // Handle NaN or invalid values
  if (isNaN(price)) {
    return '0.00';
  }
  
  // Format with 2 decimal places
  return price.toFixed(2);
}

/**
 * Escape a field for CSV (handle commas, quotes, etc.)
 * 
 * @param {string} field - Field value
 * @returns {string} - Escaped field value
 */
function escapeCSVField(field) {
  if (field === undefined || field === null) {
    return '';
  }
  
  const stringField = String(field);
  
  // If the field contains commas, quotes, or newlines, enclose it in quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    // Double up any quotes within the field
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * Convert option sets data to CSV format
 * 
 * @param {Object} data - Option sets data from extraction
 * @param {Object} options - Conversion options
 * @returns {Object} - CSV data and metadata
 */
export function convertOptionSetsToCSV(data, options = {}) {
  if (!data || !data.optionSets || !Array.isArray(data.optionSets)) {
    throw new Error('Invalid data structure: optionSets array is required');
  }
  
  // Build CSV content starting with headers
  let csvContent = OPTION_SETS_CSV_HEADERS.join(',') + '\n';
  
  // Process each option set
  data.optionSets.forEach(optionSet => {
    // For each option within the option set, create a row
    optionSet.options.forEach(option => {
      // Build the CSV row with all required fields
      const row = [
        escapeCSVField(optionSet.optionSetName || ''), // optionSetName
        '', // optionSetDisplayName - leave blank
        optionSet.required ? 'true' : 'false', // required
        optionSet.selectMultiple ? 'true' : 'false', // selectMultiple
        'false', // enableOptionQuantity - default to false
        optionSet.minOptionsRequired || 0, // minOptionsRequired
        optionSet.maxOptionsAllowed || 1, // maxOptionsAllowed
        0, // freeQuantity - default to 0
        escapeCSVField(option.optionName || ''), // optionName
        '', // optionPrintName - leave blank
        formatPrice(option.optionPrice || 0), // optionPrice
        escapeCSVField(optionSet.menuItems ? optionSet.menuItems.join('; ') : '') // menuItems
      ];
      
      // Add the row to the CSV content
      csvContent += row.join(',') + '\n';
    });
  });
  
  return {
    csvContent,
    rowCount: data.optionSets.reduce((total, set) => total + set.options.length, 0),
    columnCount: OPTION_SETS_CSV_HEADERS.length
  };
}

/**
 * Generate a downloadable option sets CSV blob
 * 
 * @param {Object} data - Option sets data from extraction
 * @param {Object} options - Conversion options
 * @returns {Object} - Blob and suggested filename
 */
export function generateOptionSetsCSVBlob(data, options = {}) {
  // Convert data to CSV format
  const { csvContent } = convertOptionSetsToCSV(data, options);
  
  // Create blob with UTF-8 encoding and BOM
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
  
  // Generate a filename based on date
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `option_sets_${date}.csv`;
  
  return {
    blob,
    filename
  };
}

/**
 * Download the option sets CSV file
 * 
 * @param {Object} data - Option sets data from extraction
 * @param {Object} options - Conversion options
 * @returns {boolean} - Success status
 */
export function downloadOptionSetsCSV(data, options = {}) {
  try {
    // Generate CSV blob and filename
    const { blob, filename } = generateOptionSetsCSVBlob(data, options);
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Error downloading option sets CSV:', error);
    return false;
  }
}