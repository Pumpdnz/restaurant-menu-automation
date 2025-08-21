// components/CSVDownloader.jsx - Component for downloading CSV files
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { generateCSVBlob } from '../utils/csv-generator';
import '../styles/CSVDownloader.css';

function CSVDownloader({ data, comboItems, fieldEdits, excludedItems, onDownload }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Calculate stats
  const totalItems = data.menuItems ? data.menuItems.length : 0;
  const includedItems = excludedItems ? totalItems - excludedItems.length : totalItems;
  const comboCount = comboItems.length;
  const editedItemsCount = Object.keys(fieldEdits).length;
  
  const handleDownload = async () => {
    if (!data || !data.menuItems || data.menuItems.length === 0) {
      setError('No data available for download');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Generate the CSV blob
      const { blob, filename } = generateCSVBlob(data, {
        comboItems,
        fieldEdits,
        excludedItems
      });
      
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
      
      // Show success state briefly
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 4000);
      
      // Notify parent
      if (onDownload) {
        onDownload(filename);
      }
    } catch (error) {
      console.error('Error generating CSV:', error);
      setError(`Failed to generate CSV: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="csv-downloader">
      <div className="csv-downloader-header">
        <h3>Download CSV</h3>
      </div>
      
      <div className="csv-info">
        <div className="csv-stat">
          <span className="stat-label">Total Items</span>
          <span className="stat-value">{totalItems}</span>
        </div>
        
        <div className="csv-stat">
          <span className="stat-label">Items in CSV</span>
          <span className="stat-value">{includedItems}</span>
          {excludedItems && excludedItems.length > 0 && (
            <span className="stat-note">({excludedItems.length} excluded)</span>
          )}
        </div>
        
        <div className="csv-stat">
          <span className="stat-label">Combo Items</span>
          <span className="stat-value">{comboCount}</span>
        </div>
        
        <div className="csv-stat">
          <span className="stat-label">Edited Fields</span>
          <span className="stat-value">{editedItemsCount}</span>
        </div>
      </div>
      
      <div className="csv-help">
        <p>
          Generate a CSV file compatible with Pump'd's menu import system.
          Combo items and field edits will be applied to the generated file.
        </p>
      </div>
      
      {error && (
        <div className="csv-error">
          {error}
        </div>
      )}
      
      <div className="csv-actions">
        <button 
          className={`csv-download-button ${isSuccess ? 'success' : ''}`}
          onClick={handleDownload}
          disabled={isGenerating || totalItems === 0}
        >
          {isGenerating ? 'Generating...' : 
           isSuccess ? 'Downloaded!' : 
           'Download CSV'}
        </button>
      </div>
    </div>
  );
}

CSVDownloader.propTypes = {
  data: PropTypes.object.isRequired,
  comboItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  fieldEdits: PropTypes.object.isRequired,
  excludedItems: PropTypes.arrayOf(PropTypes.string),
  onDownload: PropTypes.func
};

CSVDownloader.defaultProps = {
  excludedItems: []
};

export default CSVDownloader;