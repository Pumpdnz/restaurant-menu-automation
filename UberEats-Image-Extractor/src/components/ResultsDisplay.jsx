// components/ResultsDisplay.jsx - Display extraction results
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CategorySection from './CategorySection';
import ComboSelector from './ComboSelector';
import FieldEditor from './FieldEditor';
import CSVDownloader from './CSVDownloader';
import ExcludeItemsSelector from './ExcludeItemsSelector';
import '../styles/ResultsDisplay.css';

function ResultsDisplay({ 
  data, 
  folderHandle, 
  folderSelected,
  onSelectFolder,
  onUpdateProgress,
  comboItems,
  onComboSelection,
  fieldEdits,
  onFieldEdit,
  onCSVDownload,
  onOptionSetsCSVDownload,
  platformType,
  onTargetCategory,
  onTargetItem,
  cacheResults,
  targetedExtraction,
  url,
  onExtract,
  isLoading,
  excludedItems,
  onItemExcludeToggle,
  extractionStrategy
}) {
  const [activeTab, setActiveTab] = useState(extractionStrategy === 'option-sets' ? 'option-sets' : 'images');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedBulkField, setSelectedBulkField] = useState('');
  const [markupPercentage, setMarkupPercentage] = useState('');
  const [selectedPriceItems, setSelectedPriceItems] = useState([]);
  const [priceAdjustmentMethod, setPriceAdjustmentMethod] = useState('percentage');
  const [fixedAmount, setFixedAmount] = useState('');
  const [defaultRounding, setDefaultRounding] = useState('.99');
  const [itemRoundingOverrides, setItemRoundingOverrides] = useState({});
  
  // Toggle expansion of a category
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };
  
  // Toggle bulk edit mode
  const toggleBulkEdit = () => {
    setBulkEditMode(prev => !prev);
    if (bulkEditMode) {
      // Clear field selection when exiting bulk edit mode
      setSelectedBulkField('');
    }
  };
  
  // Handle bulk field selection
  const handleBulkFieldSelect = (field) => {
    setSelectedBulkField(field);
    // Clear markup percentage when switching away from markup mode
    if (field !== 'priceMarkup') {
      setMarkupPercentage('');
    }
  };
  
  // Calculate original price from marked up price
  const calculateOriginalPrice = (currentPrice, markupPercentage) => {
    const price = parseFloat(currentPrice) || 0;
    const markup = parseFloat(markupPercentage) || 0;
    if (markup <= 0 || markup >= 100) return price;
    return price / (1 + markup / 100);
  };
  
  // Subtract fixed amount from price
  const subtractFixedAmount = (currentPrice, fixedAmount) => {
    const price = parseFloat(currentPrice) || 0;
    const amount = parseFloat(fixedAmount) || 0;
    return Math.max(0.50, price - amount); // Minimum price of $0.50
  };
  
  // Apply rounding to calculated price
  const roundToNearest = (price, roundingType) => {
    const numPrice = parseFloat(price) || 0;
    switch(roundingType) {
      case '.00':
        return Math.round(numPrice);
      case '.99':
        return Math.floor(numPrice) + 0.99;
      case '.90':
        return Math.floor(numPrice) + 0.90;
      case '.50':
        return Math.round(numPrice * 2) / 2;
      case 'none':
        return numPrice;
      default:
        return numPrice;
    }
  };
  
  // Get final calculated price for an item
  const getFinalPrice = (item) => {
    const currentPrice = parseFloat(item.dishPrice) || 0;
    let calculatedPrice;
    
    if (priceAdjustmentMethod === 'percentage') {
      calculatedPrice = calculateOriginalPrice(currentPrice, markupPercentage);
    } else {
      calculatedPrice = subtractFixedAmount(currentPrice, fixedAmount);
    }
    
    const roundingType = itemRoundingOverrides[item.dishName] || defaultRounding;
    return roundToNearest(calculatedPrice, roundingType);
  };
  
  // Handle price item selection
  const handlePriceItemSelect = (dishName, isSelected) => {
    setSelectedPriceItems(prev => {
      if (isSelected && !prev.includes(dishName)) {
        return [...prev, dishName];
      } else if (!isSelected && prev.includes(dishName)) {
        return prev.filter(item => item !== dishName);
      }
      return prev;
    });
  };
  
  // Select all visible items for price adjustment
  const handleSelectAllPriceItems = () => {
    const allItems = data.menuItems || [];
    const validItems = allItems.filter(item => parseFloat(item.dishPrice) > 0);
    setSelectedPriceItems(validItems.map(item => item.dishName));
  };
  
  // Deselect all price items
  const handleDeselectAllPriceItems = () => {
    setSelectedPriceItems([]);
  };
  
  // Set rounding override for specific item
  const handleRoundingOverride = (dishName, roundingType) => {
    setItemRoundingOverrides(prev => ({
      ...prev,
      [dishName]: roundingType
    }));
  };
  
  // Apply price adjustments to selected items
  const handleApplyPriceAdjustments = () => {
    if (selectedPriceItems.length === 0) {
      alert('Please select at least one item.');
      return;
    }
    
    if (priceAdjustmentMethod === 'percentage' && (!markupPercentage || markupPercentage <= 0)) {
      alert('Please enter a valid markup percentage greater than 0.');
      return;
    }
    
    if (priceAdjustmentMethod === 'fixed' && (!fixedAmount || fixedAmount <= 0)) {
      alert('Please enter a valid fixed amount greater than 0.');
      return;
    }
    
    const allItems = data.menuItems || [];
    let appliedCount = 0;
    
    selectedPriceItems.forEach(dishName => {
      const item = allItems.find(i => i.dishName === dishName);
      if (item && parseFloat(item.dishPrice) > 0) {
        const finalPrice = getFinalPrice(item);
        onFieldEdit(item.dishName, 'dishPrice', finalPrice.toFixed(2));
        appliedCount++;
      }
    });
    
    // Clear selections after applying
    setSelectedPriceItems([]);
    setItemRoundingOverrides({});
    
    alert(`Applied price adjustments to ${appliedCount} items.`);
  };
  
  // Calculate stats
  const totalItems = data && data.menuItems ? data.menuItems.length : 0;
  const totalCategories = getCategoriesFromData(data).length;
  const totalOptionSets = data && data.optionSets ? data.optionSets.length : 0;
  const hasOptionSets = extractionStrategy === 'option-sets' && totalOptionSets > 0;
  
  // Handle download all menu items
  const handleDownloadAll = async () => {
    if (!folderSelected) {
      onSelectFolder();
      return;
    }
    
    // Initialize progress tracking
    let completed = 0;
    const total = totalItems;
    
    onUpdateProgress({
      current: 0,
      total,
      percent: 0
    });
    
    // Create a folder for the restaurant
    let rootFolderHandle = folderHandle;
    try {
      // Sanitize restaurant name for folder name
      const restaurantName = getRestaurantName(data);
      const sanitizedName = restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_');
      
      rootFolderHandle = await folderHandle.getDirectoryHandle(
        sanitizedName || 'restaurant_menu',
        { create: true }
      );
    } catch (error) {
      console.error('Error creating restaurant folder:', error);
      // Continue with the root folder if we couldn't create a restaurant folder
    }
    
    // Process each category
    const categories = getCategoriesFromData(data);
    for (const category of categories) {
      // Create category subfolder
      let categoryFolderHandle;
      try {
        const sanitizedCategoryName = category.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_');
        
        categoryFolderHandle = await rootFolderHandle.getDirectoryHandle(
          sanitizedCategoryName || `category_${category.id}`,
          { create: true }
        );
      } catch (error) {
        console.error(`Error creating folder for category "${category.name}":`, error);
        categoryFolderHandle = rootFolderHandle; // Fall back to root folder
      }
      
      // Download each item in this category
      const items = getCategoryItems(data, category.name);
      for (const item of items) {
        if (item.imageURL) {
          try {
            // Fetch the image
            const response = await fetch(item.imageURL);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
            
            const blob = await response.blob();
            
            // Sanitize filename
            const safeFilename = item.dishName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .substring(0, 50);
            
            // Save the file
            const filename = `${safeFilename || `item_${items.indexOf(item)}`}.jpg`;
            const fileHandle = await categoryFolderHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
          } catch (error) {
            console.error(`Error downloading item "${item.dishName}":`, error);
          }
        }
        
        // Update progress
        completed++;
        onUpdateProgress({
          current: completed,
          total,
          percent: Math.round((completed / total) * 100)
        });
      }
    }
    
    // Final progress update
    onUpdateProgress({
      current: completed,
      total,
      percent: 100,
      completed: true
    });
    
    // Clear progress after a short delay
    setTimeout(() => {
      onUpdateProgress(null);
    }, 4000);
  };
  
  return (
    <div className="results-display">
      <div className="results-header">
        <div className="restaurant-info">
          <h2>{getRestaurantName(data)}</h2>
          {getRestaurantDescription(data) && (
            <p className="restaurant-description">{getRestaurantDescription(data)}</p>
          )}
        </div>
        
        <div className="results-stats">
          {hasOptionSets ? (
            <>
              <div className="stat-item">
                <span className="stat-value">{totalOptionSets}</span>
                <span className="stat-label">Option Sets</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{data.stats?.totalMenuItems || 0}</span>
                <span className="stat-label">Menu Items</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{data.stats?.menuItemsWithOptions || 0}</span>
                <span className="stat-label">Items with Options</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat-item">
                <span className="stat-value">{totalItems}</span>
                <span className="stat-label">Menu Items</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{totalCategories}</span>
                <span className="stat-label">Categories</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="results-tabs">
        {hasOptionSets ? (
          <>
            <button 
              className={`tab-button ${activeTab === 'option-sets' ? 'active' : ''}`}
              onClick={() => setActiveTab('option-sets')}
            >
              Option Sets
            </button>
            <button 
              className={`tab-button ${activeTab === 'csv' ? 'active' : ''}`}
              onClick={() => setActiveTab('csv')}
            >
              CSV Export
            </button>
          </>
        ) : (
          <>
            <button 
              className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              Images
            </button>
            <button 
              className={`tab-button ${activeTab === 'combo' ? 'active' : ''}`}
              onClick={() => setActiveTab('combo')}
            >
              Combo Items
            </button>
            <button 
              className={`tab-button ${activeTab === 'fields' ? 'active' : ''}`}
              onClick={() => setActiveTab('fields')}
            >
              Edit Fields
            </button>
            <button 
              className={`tab-button ${activeTab === 'exclude' ? 'active' : ''}`}
              onClick={() => setActiveTab('exclude')}
            >
              Include/Exclude Items
            </button>
            <button 
              className={`tab-button ${activeTab === 'csv' ? 'active' : ''}`}
              onClick={() => setActiveTab('csv')}
            >
              CSV Export
            </button>
          </>
        )}
      </div>
      
      <div className="results-content">
        {activeTab === 'images' && (
          <div className="images-tab">
            <div className="tab-actions">
              <button 
                className="download-all-button"
                onClick={handleDownloadAll}
                disabled={!folderSelected}
              >
                Download All Images
              </button>
              
              {!folderSelected && (
                <button 
                  className="select-folder-button"
                  onClick={onSelectFolder}
                >
                  Select Folder First
                </button>
              )}
            </div>
            
            <div className="categories-container">
              {getCategoriesFromData(data).map((category, categoryIndex) => (
                <CategorySection 
                  key={category.id || category.name}
                  category={category}
                  items={getCategoryItems(data, category.name)}
                  folderHandle={folderHandle}
                  folderSelected={folderSelected}
                  onSelectFolder={onSelectFolder}
                  onUpdateProgress={onUpdateProgress}
                  isExpanded={expandedCategories[category.id] !== false} // Default to expanded
                  onToggleExpand={() => toggleCategory(category.id)}
                  onTargetCategory={onTargetCategory ? () => onTargetCategory(category.name) : undefined}
                  canExtract={!!url && !isLoading}
                  isTargeted={targetedExtraction && 
                              targetedExtraction.type === 'category' && 
                              targetedExtraction.value === category.name}
                />
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'combo' && (
          <ComboSelector 
            items={data.menuItems || []}
            selectedItems={comboItems}
            onSelectionChange={onComboSelection}
          />
        )}
        
        {activeTab === 'fields' && (
          <div className="fields-tab">
            <div className="bulk-edit-controls">
              <button 
                className={`bulk-edit-toggle ${bulkEditMode ? 'active' : ''}`}
                onClick={toggleBulkEdit}
              >
                {bulkEditMode ? 'Exit Bulk Edit Mode' : 'Enter Bulk Edit Mode'}
              </button>
              
              {bulkEditMode && (
                <div className="bulk-edit-form">
                  <div className="bulk-edit-header">
                    <h3>Bulk Edit Items</h3>
                    <p>Select a field below to edit it inline for each menu item individually.</p>
                  </div>
                  
                  <div className="bulk-field-selector">
                    <label htmlFor="bulk-field-select">Bulk edit field:</label>
                    <select 
                      id="bulk-field-select"
                      value={selectedBulkField}
                      onChange={(e) => handleBulkFieldSelect(e.target.value)}
                    >
                      <option value="">Select field to edit</option>
                      <option value="dishName">Dish Name</option>
                      <option value="categoryName">Category Name</option>
                      <option value="dishPrice">Price</option>
                      <option value="priceMarkup">Price Markup Removal</option>
                      <option value="dishDescription">Description</option>
                    </select>
                  </div>
                  
                  {selectedBulkField === 'priceMarkup' ? (
                    <div className="markup-removal-section">
                      <div className="markup-header">
                        <h4>Price Adjustment</h4>
                        <p>Adjust prices using percentage markup removal or fixed amount subtraction with custom rounding.</p>
                      </div>
                      
                      <div className="adjustment-method-selection">
                        <h5>Adjustment Method:</h5>
                        <div className="method-radio-group">
                          <label className="radio-option">
                            <input
                              type="radio"
                              name="adjustmentMethod"
                              value="percentage"
                              checked={priceAdjustmentMethod === 'percentage'}
                              onChange={(e) => setPriceAdjustmentMethod(e.target.value)}
                            />
                            <span>Remove Percentage Markup</span>
                          </label>
                          <label className="radio-option">
                            <input
                              type="radio"
                              name="adjustmentMethod"
                              value="fixed"
                              checked={priceAdjustmentMethod === 'fixed'}
                              onChange={(e) => setPriceAdjustmentMethod(e.target.value)}
                            />
                            <span>Subtract Fixed Amount</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="adjustment-settings">
                        {priceAdjustmentMethod === 'percentage' ? (
                          <div className="markup-input">
                            <label htmlFor="markup-percentage">Markup percentage to remove:</label>
                            <div className="markup-input-group">
                              <input
                                id="markup-percentage"
                                type="number"
                                min="0.1"
                                max="99.9"
                                step="0.1"
                                value={markupPercentage}
                                onChange={(e) => setMarkupPercentage(e.target.value)}
                                placeholder="e.g., 30"
                              />
                              <span className="percentage-symbol">%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="fixed-amount-input">
                            <label htmlFor="fixed-amount">Fixed amount to subtract:</label>
                            <div className="fixed-amount-input-group">
                              <span className="dollar-symbol">$</span>
                              <input
                                id="fixed-amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={fixedAmount}
                                onChange={(e) => setFixedAmount(e.target.value)}
                                placeholder="e.g., 2.50"
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="default-rounding-input">
                          <label htmlFor="default-rounding">Default rounding:</label>
                          <select
                            id="default-rounding"
                            value={defaultRounding}
                            onChange={(e) => setDefaultRounding(e.target.value)}
                          >
                            <option value="none">No rounding</option>
                            <option value=".00">Nearest integer (.00)</option>
                            <option value=".50">Nearest .50</option>
                            <option value=".90">Nearest .90</option>
                            <option value=".99">Nearest .99</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="item-selection-controls">
                        <div className="selection-header">
                          <h5>Select Items to Adjust:</h5>
                          <div className="selection-buttons">
                            <button onClick={handleSelectAllPriceItems} className="select-all-button">
                              Select All
                            </button>
                            <button onClick={handleDeselectAllPriceItems} className="deselect-all-button">
                              Select None
                            </button>
                            <span className="selection-count">
                              {selectedPriceItems.length} items selected
                            </span>
                          </div>
                        </div>
                        
                        <button
                          className="apply-adjustment-button"
                          onClick={handleApplyPriceAdjustments}
                          disabled={selectedPriceItems.length === 0 || 
                                   (priceAdjustmentMethod === 'percentage' && (!markupPercentage || markupPercentage <= 0)) ||
                                   (priceAdjustmentMethod === 'fixed' && (!fixedAmount || fixedAmount <= 0))}
                        >
                          Apply to {selectedPriceItems.length} Selected Items
                        </button>
                      </div>
                    </div>
                  ) : selectedBulkField ? (
                    <p className="inline-edit-info">
                      Edit the {selectedBulkField.replace(/([A-Z])/g, ' $1').toLowerCase()} for each item in the list below.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            
            <FieldEditor 
              items={data.menuItems || []}
              fieldEdits={fieldEdits}
              onFieldEdit={onFieldEdit}
              bulkEditMode={bulkEditMode}
              selectedBulkField={selectedBulkField}
              selectedPriceItems={selectedPriceItems}
              onPriceItemSelect={handlePriceItemSelect}
              priceAdjustmentMethod={priceAdjustmentMethod}
              markupPercentage={markupPercentage}
              fixedAmount={fixedAmount}
              defaultRounding={defaultRounding}
              itemRoundingOverrides={itemRoundingOverrides}
              onRoundingOverride={handleRoundingOverride}
              getFinalPrice={getFinalPrice}
            />
          </div>
        )}
        
        {activeTab === 'exclude' && (
          <ExcludeItemsSelector
            items={data.menuItems || []}
            excludedItems={excludedItems}
            onItemExcludeToggle={onItemExcludeToggle}
          />
        )}
        
        {activeTab === 'option-sets' && hasOptionSets && (
          <div className="option-sets-tab">
            <div className="option-sets-header">
              <h3>Option Sets Extraction Results</h3>
              <p>Below are the option sets extracted from individual menu item pages, consolidated to remove duplicates.</p>
            </div>
            
            <div className="option-sets-summary">
              <div className="summary-item">
                <strong>Total Option Sets:</strong> {totalOptionSets}
              </div>
              <div className="summary-item">
                <strong>Menu Items Processed:</strong> {data.stats?.totalMenuItems || 0}
              </div>
              <div className="summary-item">
                <strong>Items with Options:</strong> {data.stats?.menuItemsWithOptions || 0}
              </div>
            </div>
            
            <div className="option-sets-list">
              {data.optionSets && data.optionSets.map((optionSet, index) => (
                <div key={index} className="option-set-card">
                  <div className="option-set-header">
                    <h4>{optionSet.optionSetName}</h4>
                    <div className="option-set-meta">
                      <span className={`requirement-badge ${optionSet.required ? 'required' : 'optional'}`}>
                        {optionSet.required ? 'Required' : 'Optional'}
                      </span>
                      <span className="selection-badge">
                        {optionSet.selectMultiple ? 
                          `Choose ${optionSet.minOptionsRequired || 0}-${optionSet.maxOptionsAllowed || 'unlimited'}` : 
                          'Choose 1'
                        }
                      </span>
                    </div>
                  </div>
                  
                  <div className="option-set-options">
                    {optionSet.options && optionSet.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="option-item">
                        <span className="option-name">{option.optionName}</span>
                        <span className="option-price">
                          {option.optionPrice > 0 ? `+$${option.optionPrice.toFixed(2)}` : 'Free'}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="option-set-menu-items">
                    <strong>Used by menu items:</strong>
                    <div className="menu-items-list">
                      {optionSet.menuItems && optionSet.menuItems.map((menuItem, menuItemIndex) => (
                        <span key={menuItemIndex} className="menu-item-tag">{menuItem}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'csv' && (
          <div className="csv-tab">
            {hasOptionSets ? (
              <div className="csv-option-sets">
                <h3>Download Option Sets CSV</h3>
                <p>Download the extracted option sets in CSV format for import into your menu system.</p>
                <button 
                  className="csv-download-button"
                  onClick={onOptionSetsCSVDownload}
                >
                  Download Option Sets CSV
                </button>
              </div>
            ) : (
              <CSVDownloader 
                data={data}
                comboItems={comboItems}
                fieldEdits={fieldEdits}
                excludedItems={excludedItems}
                onDownload={onCSVDownload}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions to extract data from the API response
function getRestaurantName(data) {
  if (data.restaurantInfo && data.restaurantInfo.name) {
    return data.restaurantInfo.name;
  }
  
  // Try to get from first menu item
  if (data.menuItems && data.menuItems.length > 0 && data.menuItems[0].menuName) {
    return data.menuItems[0].menuName;
  }
  
  return "Restaurant Menu";
}

function getRestaurantDescription(data) {
  if (data.restaurantInfo && data.restaurantInfo.description) {
    return data.restaurantInfo.description;
  }
  
  return "";
}

function getCategoriesFromData(data) {
  // If data includes explicit categories, use those
  if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
    return data.categories;
  }
  
  // Otherwise, extract unique categories from menu items
  if (data.menuItems && Array.isArray(data.menuItems)) {
    const uniqueCategories = new Map();
    
    data.menuItems.forEach((item, index) => {
      const categoryName = item.categoryName || "Uncategorized";
      
      if (!uniqueCategories.has(categoryName)) {
        uniqueCategories.set(categoryName, {
          id: index + 1,
          name: categoryName
        });
      }
    });
    
    return Array.from(uniqueCategories.values());
  }
  
  return [];
}

function getCategoryItems(data, categoryName) {
  if (!data.menuItems || !Array.isArray(data.menuItems) || !categoryName) {
    return [];
  }
  
  return data.menuItems.filter(item => item.categoryName === categoryName);
}

ResultsDisplay.propTypes = {
  data: PropTypes.shape({
    restaurantInfo: PropTypes.object,
    categories: PropTypes.array,
    menuItems: PropTypes.array
  }).isRequired,
  folderHandle: PropTypes.object,
  folderSelected: PropTypes.bool.isRequired,
  onSelectFolder: PropTypes.func.isRequired,
  onUpdateProgress: PropTypes.func.isRequired,
  comboItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  onComboSelection: PropTypes.func.isRequired,
  fieldEdits: PropTypes.object.isRequired,
  onFieldEdit: PropTypes.func.isRequired,
  onCSVDownload: PropTypes.func,
  onOptionSetsCSVDownload: PropTypes.func,
  platformType: PropTypes.string,
  onTargetCategory: PropTypes.func,
  onTargetItem: PropTypes.func,
  cacheResults: PropTypes.bool,
  targetedExtraction: PropTypes.object,
  url: PropTypes.string,
  onExtract: PropTypes.func,
  isLoading: PropTypes.bool,
  excludedItems: PropTypes.arrayOf(PropTypes.string),
  onItemExcludeToggle: PropTypes.func,
  extractionStrategy: PropTypes.string
};

ResultsDisplay.defaultProps = {
  onOptionSetsCSVDownload: null,
  platformType: null,
  onTargetCategory: null,
  onTargetItem: null,
  cacheResults: false,
  targetedExtraction: null,
  extractionStrategy: 'standard',
  url: '',
  onExtract: () => {},
  isLoading: false,
  excludedItems: [],
  onItemExcludeToggle: () => {}
};

export default ResultsDisplay;