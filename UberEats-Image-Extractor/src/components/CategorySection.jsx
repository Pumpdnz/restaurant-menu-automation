// components/CategorySection.jsx - Display a menu category
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MenuItem from './MenuItem';
import '../styles/CategorySection.css';

function CategorySection({ 
  category, 
  items,
  folderHandle, 
  folderSelected, 
  onSelectFolder,
  onUpdateProgress,
  isExpanded,
  onToggleExpand,
  onTargetCategory,
  canExtract,
  isTargeted
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Ensure items is always an array
  const categoryItems = Array.isArray(items) ? items : [];
  
  // Download all items in this category
  const handleDownloadCategory = async () => {
    if (!folderSelected) {
      onSelectFolder();
      return;
    }
    
    setIsDownloading(true);
    
    // Initialize progress tracking
    let completed = 0;
    const total = categoryItems.length;
    
    onUpdateProgress({
      current: 0,
      total,
      percent: 0
    });
    
    try {
      // Create category subfolder
      let categoryFolderHandle;
      try {
        const sanitizedCategoryName = category.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_');
        
        categoryFolderHandle = await folderHandle.getDirectoryHandle(
          sanitizedCategoryName || `category_${category.id || '0'}`,
          { create: true }
        );
      } catch (error) {
        console.error(`Error creating folder for category "${category.name}":`, error);
        categoryFolderHandle = folderHandle; // Fall back to parent folder
      }
      
      // Download each item
      for (const item of categoryItems) {
        if (item.imageURL) {
          try {
            // Fetch the image
            const response = await fetch(item.imageURL);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
            
            const blob = await response.blob();
            
            // Create a safe filename from the dish name
            const safeFilename = item.dishName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .substring(0, 50);
            
            // Save the file
            const filename = `${safeFilename || `item_${categoryItems.indexOf(item)}`}.jpg`;
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
    } catch (error) {
      console.error('Error downloading category:', error);
    } finally {
      setIsDownloading(false);
      
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
    }
  };
  
  // Handle targeted extraction for this category
  const handleTargetCategory = () => {
    if (onTargetCategory && category.name) {
      onTargetCategory(category.name);
    }
  };

  return (
    <div className={`category-section ${isTargeted ? 'targeted' : ''}`}>
      <div className="category-header">
        <div className="category-info" onClick={onToggleExpand}>
          <h3>{category.name}</h3>
          <span className="item-count">{categoryItems.length} items</span>
          <button className="expand-toggle">
            {isExpanded ? '▼' : '►'}
          </button>
        </div>
        
        <div className="category-actions">
          {canExtract && (
            <button
              className="target-category-button"
              onClick={handleTargetCategory}
              disabled={isTargeted}
              title="Rescrape this category"
            >
              {isTargeted ? 'Targeted for extraction' : 'Rescrape category'}
            </button>
          )}
          
          <button 
            className="download-category-button"
            onClick={handleDownloadCategory}
            disabled={isDownloading || !folderSelected || categoryItems.length === 0}
          >
            {isDownloading ? 'Downloading...' : `Download ${category.name}`}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="menu-items-grid">
          {categoryItems.map((item, index) => (
            <MenuItem 
              key={`${category.name}-${index}`}
              item={{
                id: index,
                name: item.dishName || `Item ${index + 1}`,
                price: item.dishPrice,
                description: item.dishDescription || '',
                imageUrl: item.imageURL // Pass as imageUrl which MenuItem expects
              }}
              folderHandle={folderHandle}
              folderSelected={folderSelected}
              onSelectFolder={onSelectFolder}
              onTargetItem={onTargetCategory ? 
                () => onTargetCategory(item.dishName) : undefined}
              canExtract={canExtract}
              isTargeted={isTargeted && item.dishName === category.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

CategorySection.propTypes = {
  category: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string.isRequired
  }).isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      dishName: PropTypes.string,
      dishPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      dishDescription: PropTypes.string,
      imageURL: PropTypes.string,
      categoryName: PropTypes.string
    })
  ),
  folderHandle: PropTypes.object,
  folderSelected: PropTypes.bool.isRequired,
  onSelectFolder: PropTypes.func.isRequired,
  onUpdateProgress: PropTypes.func.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  onTargetCategory: PropTypes.func,
  canExtract: PropTypes.bool,
  isTargeted: PropTypes.bool
};

CategorySection.defaultProps = {
  items: [],
  canExtract: false,
  isTargeted: false,
  onTargetCategory: null
};

export default CategorySection;