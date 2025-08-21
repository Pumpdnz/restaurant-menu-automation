// components/MenuItem.jsx - Display a single menu item
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/MenuItem.css';

function MenuItem({ 
  item, 
  folderHandle, 
  folderSelected, 
  onSelectFolder,
  onTargetItem,
  canExtract,
  isTargeted
}) {
  // Ensure item has all required properties with defaults
  const safeItem = {
    id: item?.id || 0,
    name: item?.name || 'Unnamed Item',
    price: item?.price || 0,
    description: item?.description || '',
    imageUrl: item?.imageUrl || ''
  };
  
  const [itemName, setItemName] = useState(safeItem.name);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Format price for display
  const displayPrice = typeof safeItem.price === 'number' 
    ? `$${safeItem.price.toFixed(2)}` 
    : safeItem.price;
  
  // Generate a filename based on the current item name
  const generateFilename = () => {
    return itemName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50); // Limit length for filesystem compatibility
  };
  
  // Handle name edit
  const handleNameChange = (e) => {
    setItemName(e.target.value);
  };
  
  const handleStartEdit = () => {
    setIsEditing(true);
  };
  
  const handleSaveEdit = () => {
    setIsEditing(false);
  };
  
  // Download this item
  const handleDownload = async () => {
    if (!folderSelected) {
      onSelectFolder();
      return;
    }
    
    // Check if there's actually an image to download
    if (!safeItem.imageUrl) {
      alert("This menu item doesn't have an image to download.");
      return;
    }
    
    setIsDownloading(true);
    
    try {
      // Fetch the image
      const response = await fetch(safeItem.imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      
      const blob = await response.blob();
      
      // Save to file
      const filename = `${generateFilename()}.jpg`;
      const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      console.error(`Error downloading item "${itemName}":`, error);
      alert(`Error downloading image: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Placeholder image for items without images
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Cpath d='M30,40 L70,40 L70,60 L30,60 Z' fill='%23ddd'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='10' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3ENo Image%3C/text%3E%3C/svg%3E";
  
  // Handle targeted extraction of this item
  const handleTargetItem = () => {
    if (onTargetItem) {
      onTargetItem();
    }
  };
  
  return (
    <div className={`menu-item ${isTargeted ? 'targeted' : ''}`}>
      <div className="item-image-container">
        <img 
          src={safeItem.imageUrl || placeholderImage} 
          alt={itemName} 
          className={`item-image ${!safeItem.imageUrl ? 'no-image' : ''}`}
          loading="lazy"
        />
        
        {canExtract && !safeItem.imageUrl && (
          <button 
            className="target-item-button no-image-target"
            onClick={handleTargetItem}
            title="Try to get image for this item"
          >
            Get Image
          </button>
        )}
      </div>
      
      <div className="item-details">
        {isEditing ? (
          <div className="item-name-edit">
            <input
              type="text"
              value={itemName}
              onChange={handleNameChange}
              autoFocus
            />
            <button 
              className="save-name-button"
              onClick={handleSaveEdit}
            >
              Save
            </button>
          </div>
        ) : (
          <div className="item-name" onClick={handleStartEdit}>
            {itemName}
            <button className="edit-name-button">✎</button>
          </div>
        )}
        
        <div className="item-price">{displayPrice}</div>
        
        {safeItem.description && (
          <div className="item-description">{safeItem.description}</div>
        )}
        
        <div className="item-actions">
          {canExtract && (
            <button 
              className="target-item-button"
              onClick={handleTargetItem}
              disabled={isTargeted}
              title="Rescrape this item to get better data"
            >
              {isTargeted ? 'Targeted' : 'Rescrape'}
            </button>
          )}
          
          <button 
            className="download-item-button"
            onClick={handleDownload}
            disabled={isDownloading || !folderSelected || !safeItem.imageUrl}
          >
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}

MenuItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    imageUrl: PropTypes.string
  }).isRequired,
  folderHandle: PropTypes.object,
  folderSelected: PropTypes.bool.isRequired,
  onSelectFolder: PropTypes.func.isRequired,
  onTargetItem: PropTypes.func,
  canExtract: PropTypes.bool,
  isTargeted: PropTypes.bool
};

MenuItem.defaultProps = {
  item: {
    id: 0,
    name: 'Unnamed Item',
    imageUrl: '',
    price: '$0.00',
    description: ''
  },
  onTargetItem: null,
  canExtract: false,
  isTargeted: false
};

export default MenuItem;