// components/LoadingOverlay.jsx - Display a loading overlay
import React from 'react';
import PropTypes from 'prop-types';
import '../styles/LoadingOverlay.css';

function LoadingOverlay({ status, progress, method, strategy, warnings }) {
  // Status messages for different extraction phases
  const methodLabel = method === 'scrape' ? 'Direct scrape' : 'Extraction';
  const strategyLabel = strategy === 'category-based' ? ' (Category-Based)' : '';
  
  const statusMessages = {
    pending: `Initiating ${methodLabel}${strategyLabel}...`,
    submitted: `Submitting ${methodLabel}${strategyLabel} request...`,
    in_progress: `Extracting menu data...`,
    processing: `Processing menu data...`,
    completed: `${methodLabel}${strategyLabel} completed!`,
    failed: `${methodLabel}${strategyLabel} failed`
  };
  
  // Get the appropriate message based on status
  const message = statusMessages[status] || "Processing...";
  
  // Format progress percentage
  const progressPercent = progress ? Math.round(progress) : 0;
  
  // Method and strategy specific descriptions
  const getMethodDescription = () => {
    if (strategy === 'category-based') {
      if (status === 'pending') return "Initializing category-based extraction...";
      if (status === 'processing') return "Phase 1: Scanning for menu categories...";
      if (status === 'in_progress') return "Phase 2: Extracting menu items for each category...";
    } else if (method === 'scrape') {
      if (status === 'pending') return "Initializing direct scrape using FIRE-1 agent...";
      if (status === 'processing') return "Processing menu data from direct scrape...";
    } else if (method === 'extract') {
      if (status === 'pending') return "Initializing extraction process...";
      if (status === 'processing') return "This may take several minutes to complete...";
    }
    
    // Default descriptions
    if (status === 'pending') return "Connecting to extraction service...";
    if (status === 'submitted') return "Sending extraction request...";
    if (status === 'in_progress') return "Navigating through the menu and extracting items...";
    if (status === 'processing') return "Organizing menu data into a structured format...";
    if (status === 'completed') return "Preparing to display results...";
    if (status === 'failed') return "An error occurred during extraction.";
    
    return "";
  };
  
  // Special description for category-based extraction
  const getCategoryDescription = () => {
    if (strategy === 'category-based' && status === 'completed') {
      return "Category-based extraction divides large menus into manageable sections for more reliable results.";
    }
    return null;
  };
  
  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-spinner"></div>
        
        <div className="loading-content">
          <h3 className="loading-status">{message}</h3>
          
          <div className="extraction-method">
            <span className={`method-badge ${method}`}>
              {method === 'scrape' ? 'Using Direct Scrape' : 'Using Extract API'}
            </span>
            
            {strategy === 'category-based' && (
              <span className="strategy-badge category-based">
                Category-Based Extraction
              </span>
            )}
          </div>
          
          {status === 'in_progress' && progress > 0 && (
            <div className="loading-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {progressPercent}%
              </div>
            </div>
          )}
          
          <p className="loading-description">
            {getMethodDescription()}
          </p>
          
          {getCategoryDescription() && (
            <p className="strategy-description">
              {getCategoryDescription()}
            </p>
          )}
          
          {warnings && warnings.length > 0 && (
            <div className="extraction-warnings">
              <h4>Warnings:</h4>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

LoadingOverlay.propTypes = {
  status: PropTypes.string,
  progress: PropTypes.number,
  method: PropTypes.string,
  strategy: PropTypes.string,
  warnings: PropTypes.arrayOf(PropTypes.string)
};

LoadingOverlay.defaultProps = {
  status: 'pending',
  progress: 0,
  method: 'scrape',
  strategy: 'standard',
  warnings: []
};

export default LoadingOverlay;