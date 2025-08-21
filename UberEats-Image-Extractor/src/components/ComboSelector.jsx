// components/ComboSelector.jsx - Component for selecting combo menu items
import React from 'react';
import PropTypes from 'prop-types';
import '../styles/ComboSelector.css';

function ComboSelector({ items, selectedItems, onSelectionChange }) {
  const handleCheckboxChange = (dishName, isChecked) => {
    onSelectionChange(dishName, isChecked);
  };
  
  const selectAll = () => {
    items.forEach(item => {
      onSelectionChange(item.dishName, true);
    });
  };
  
  const clearAll = () => {
    items.forEach(item => {
      onSelectionChange(item.dishName, false);
    });
  };
  
  return (
    <div className="combo-selector">
      <div className="combo-selector-header">
        <h3>Select Combo Items</h3>
        <div className="combo-controls">
          <button 
            type="button" 
            className="combo-select-all"
            onClick={selectAll}
          >
            Select All
          </button>
          <button 
            type="button" 
            className="combo-clear-all"
            onClick={clearAll}
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div className="combo-help">
        Select menu items that should be marked as "combo" items in the CSV.
        Combo items are typically multi-item meals with special pricing.
      </div>
      
      <div className="combo-items">
        {items.length === 0 ? (
          <div className="no-items">No menu items to display</div>
        ) : (
          items.map(item => (
            <div key={item.dishName} className="combo-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.dishName)}
                  onChange={(e) => handleCheckboxChange(item.dishName, e.target.checked)}
                />
                <span className="checkmark"></span>
                <div className="item-details">
                  <div className="item-name">{item.dishName}</div>
                  {item.dishPrice && (
                    <div className="item-price">${parseFloat(item.dishPrice).toFixed(2)}</div>
                  )}
                </div>
              </label>
              
              {item.imageURL && (
                <div className="item-image">
                  <img src={item.imageURL} alt={item.dishName} loading="lazy" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="combo-summary">
        {selectedItems.length} of {items.length} items selected as combos
      </div>
    </div>
  );
}

ComboSelector.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    dishName: PropTypes.string.isRequired,
    dishPrice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    imageURL: PropTypes.string
  })).isRequired,
  selectedItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelectionChange: PropTypes.func.isRequired
};

export default ComboSelector;