// components/ExcludeItemsSelector.jsx - Component for selecting items to exclude from CSV export
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/ExcludeItemsSelector.css';

function ExcludeItemsSelector({ items, excludedItems, onItemExcludeToggle }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'included', 'excluded'
  
  // Filter items based on search term and view mode
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      (item.dishName && item.dishName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    const isExcluded = excludedItems.includes(item.dishName);
    
    if (viewMode === 'included') return !isExcluded;
    if (viewMode === 'excluded') return isExcluded;
    
    return true; // 'all' mode
  });
  
  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    const categoryName = item.categoryName || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(item);
    return acc;
  }, {});
  
  // Handle toggling exclusion state for an item
  const handleToggleItem = (dishName) => {
    onItemExcludeToggle(dishName);
  };
  
  // Handle toggling all items in a category
  const handleToggleCategory = (categoryName) => {
    const categoryItems = itemsByCategory[categoryName] || [];
    const allExcluded = categoryItems.every(item => excludedItems.includes(item.dishName));
    
    // If all are excluded, include all. Otherwise, exclude all.
    if (allExcluded) {
      // Include all in the category
      categoryItems.forEach(item => {
        if (excludedItems.includes(item.dishName)) {
          onItemExcludeToggle(item.dishName);
        }
      });
    } else {
      // Exclude all in the category
      categoryItems.forEach(item => {
        if (!excludedItems.includes(item.dishName)) {
          onItemExcludeToggle(item.dishName);
        }
      });
    }
  };
  
  return (
    <div className="exclude-items-selector">
      <div className="selector-header">
        <h3>Select Items to Include/Exclude from CSV</h3>
      </div>
      
      <div className="selector-toolbar">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="view-mode-toggles">
          <button 
            className={`view-mode-button ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All Items
          </button>
          <button 
            className={`view-mode-button ${viewMode === 'included' ? 'active' : ''}`}
            onClick={() => setViewMode('included')}
          >
            Included Only
          </button>
          <button 
            className={`view-mode-button ${viewMode === 'excluded' ? 'active' : ''}`}
            onClick={() => setViewMode('excluded')}
          >
            Excluded Only
          </button>
        </div>
      </div>
      
      <div className="items-by-category">
        {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => (
          <div key={categoryName} className="category-group">
            <div className="category-header">
              <h4>{categoryName}</h4>
              <div className="category-action">
                <button
                  className="toggle-category-button"
                  onClick={() => handleToggleCategory(categoryName)}
                >
                  {categoryItems.every(item => excludedItems.includes(item.dishName))
                    ? 'Include All'
                    : 'Exclude All'}
                </button>
              </div>
            </div>
            
            <div className="category-items">
              {categoryItems.map(item => (
                <div 
                  key={item.dishName} 
                  className={`exclude-item ${excludedItems.includes(item.dishName) ? 'excluded' : 'included'}`}
                >
                  <div className="item-details">
                    <div className="item-name">{item.dishName}</div>
                    <div className="item-price">${parseFloat(item.dishPrice).toFixed(2)}</div>
                  </div>
                  <div className="item-action">
                    <button
                      className="toggle-item-button"
                      onClick={() => handleToggleItem(item.dishName)}
                    >
                      {excludedItems.includes(item.dishName) ? 'Include' : 'Exclude'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="selector-summary">
        <div className="summary-stat">
          <span className="stat-label">Total Items:</span>
          <span className="stat-value">{items.length}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Included in CSV:</span>
          <span className="stat-value">{items.length - excludedItems.length}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Excluded from CSV:</span>
          <span className="stat-value">{excludedItems.length}</span>
        </div>
      </div>
    </div>
  );
}

ExcludeItemsSelector.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  excludedItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  onItemExcludeToggle: PropTypes.func.isRequired
};

export default ExcludeItemsSelector;