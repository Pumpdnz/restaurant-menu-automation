// components/URLInput.jsx - Component for URL input
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { validateRestaurantUrl } from '../services/firecrawl-service';
import PromptInput from './PromptInput';
import SchemaInput from './SchemaInput';
import '../styles/URLInput.css';

function URLInput({ 
  url, 
  onUrlChange, 
  onExtract, 
  isLoading,
  showAdvanced,
  customPrompt,
  onCustomPromptChange,
  customSchema,
  onCustomSchemaChange,
  onToggleAdvanced,
  selectedPromptId,
  onPromptSelect,
  selectedSchemaId,
  onSchemaSelect,
  platformType,
  onPlatformDetect,
  extractionMethod,
  onMethodSelect,
  extractionStrategy,
  onStrategySelect,
  extractionMethodOptions,
  cacheResults,
  onToggleCacheResults,
  onClearCache,
  hasCachedData,
  targetedExtraction
}) {
  const [validationError, setValidationError] = useState(null);
  
  // Detect platform type from URL
  useEffect(() => {
    if (url) {
      try {
        const validation = validateRestaurantUrl(url);
        if (validation.valid && validation.platform) {
          onPlatformDetect(validation.platform);
        }
      } catch (error) {
        // Ignore validation errors here, they'll be handled on form submit
      }
    }
  }, [url, onPlatformDetect]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate URL
    const validation = validateRestaurantUrl(url);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }
    
    // Clear any validation errors
    setValidationError(null);
    
    // Call the extract function
    onExtract();
  };
  
  // Get platform display name
  const getPlatformDisplayName = () => {
    if (!platformType) return null;
    return platformType === 'ubereats' ? 'UberEats' : 'DoorDash';
  };
  
  return (
    <div className="url-input-container">
      <form onSubmit={handleSubmit} className="url-input">
        <div className="input-wrapper">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              onUrlChange(e.target.value);
              setValidationError(null); // Reset validation on change
            }}
            placeholder="Enter UberEats or DoorDash restaurant URL"
            disabled={isLoading}
            className={validationError ? 'invalid' : ''}
          />
          
          {validationError && (
            <div className="validation-error">
              {validationError}
            </div>
          )}
          
          <div className="platform-icons">
            <div className={`platform-icon ubereats ${platformType === 'ubereats' ? 'active' : ''}`}>UberEats</div>
            <div className={`platform-icon doordash ${platformType === 'doordash' ? 'active' : ''}`}>DoorDash</div>
          </div>
          
          {platformType && (
            <div className="platform-detected">
              {getPlatformDisplayName()} platform detected. 
              {platformType === 'doordash' && ' Using optimized settings for DoorDash.'}
            </div>
          )}
        </div>
        
        <div className="method-selector">
          <span className="method-label">Extraction Method:</span>
          <div className="method-options">
            <label className={`method-option ${extractionMethod === 'scrape' ? 'active' : ''}`}>
              <input
                type="radio"
                name="extraction-method"
                value="scrape"
                checked={extractionMethod === 'scrape'}
                onChange={() => onMethodSelect('scrape')}
                disabled={isLoading}
              />
              <span className="method-name">Direct Scrape</span>
              <span className="method-description">Faster, uses FIRE-1 agent</span>
            </label>
            
            <label className={`method-option ${extractionMethod === 'extract' ? 'active' : ''}`}>
              <input
                type="radio"
                name="extraction-method"
                value="extract"
                checked={extractionMethod === 'extract'}
                onChange={() => onMethodSelect('extract')}
                disabled={isLoading}
              />
              <span className="method-name">Extract API</span>
              <span className="method-description">Original method (slower)</span>
            </label>
          </div>
        </div>
        
        <div className="strategy-selector">
          <span className="strategy-label">Extraction Strategy:</span>
          <div className="strategy-options">
            {extractionMethodOptions && extractionMethodOptions.map(option => {
              // Disable image-update if no targeted category or no existing data
              const isImageUpdate = option.id === 'image-update';
              const isDisabled = isLoading || (isImageUpdate && (!targetedExtraction || targetedExtraction.type !== 'category'));
              
              return (
                <label 
                  key={option.id} 
                  className={`strategy-option ${extractionStrategy === option.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                  title={isImageUpdate && isDisabled ? 'Select a category first to use image update mode' : ''}
                >
                  <input
                    type="radio"
                    name="extraction-strategy"
                    value={option.id}
                    checked={extractionStrategy === option.id}
                    onChange={() => onStrategySelect(option.id)}
                    disabled={isDisabled}
                  />
                  <span className="strategy-name">{option.name}</span>
                  <span className="strategy-description">
                    {option.description}
                    {isImageUpdate && isDisabled && ' (Select a category first)'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        
        <div className="cache-toggle">
          <label className={`cache-option ${cacheResults ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={cacheResults}
              onChange={onToggleCacheResults}
              disabled={isLoading}
            />
            <span className="toggle-label">Cache & Combine Results</span>
            <span className="toggle-description">Keep existing results and add new ones</span>
          </label>
          
          {hasCachedData && (
            <button 
              type="button"
              className="clear-cache-button"
              onClick={onClearCache}
              disabled={isLoading}
            >
              Clear Cache
            </button>
          )}
        </div>
        
        <div className="advanced-toggle">
          <button 
            type="button" 
            className={`toggle-button ${showAdvanced ? 'active' : ''}`}
            onClick={onToggleAdvanced}
            disabled={isLoading}
          >
            {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </button>
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading || !url}
          className="extract-button"
        >
          {isLoading ? 'Extracting...' : targetedExtraction ? 
            targetedExtraction.type === 'category' && cacheResults ? 
              `Update Images for ${targetedExtraction.value}` :
              `Extract ${targetedExtraction.type === 'category' ? 'Category' : 'Item'}: ${targetedExtraction.value}` : 
            'Extract Menu Data'}
        </button>
        
        {targetedExtraction && (
          <div className="targeted-extraction-info">
            <span className="targeted-badge">
              {targetedExtraction.type === 'category' && cacheResults ? 
                'Image Update Target' : 
                targetedExtraction.type === 'category' ? 'Category Target' : 'Item Target'}:
            </span>
            <span className="targeted-value">{targetedExtraction.value}</span>
            {targetedExtraction.type === 'category' && cacheResults && (
              <span className="image-update-note">Only images will be updated</span>
            )}
          </div>
        )}
      </form>
      
      {showAdvanced && (
        <div className="advanced-options">
          <PromptInput 
            value={customPrompt}
            onChange={onCustomPromptChange}
            disabled={isLoading}
            selectedPromptId={selectedPromptId}
            onPromptSelect={onPromptSelect}
            platformType={platformType}
          />
          
          <SchemaInput 
            value={customSchema}
            onChange={onCustomSchemaChange}
            disabled={isLoading}
            selectedSchemaId={selectedSchemaId}
            onSchemaSelect={onSchemaSelect}
          />
          
          {platformType === 'doordash' && (
            <div className="platform-help-box">
              <h4>DoorDash Extraction Tips</h4>
              <p>
                DoorDash websites structure their menu data differently than UberEats. 
                For best results with DoorDash:
              </p>
              <ul>
                <li>Use the "DoorDash Optimized" prompt</li>
                <li>If you're mainly interested in images, try the "DoorDash Images Focus" prompt</li>
                <li>The "Images Focused" schema is recommended for DoorDash image extraction</li>
                <li>For large menus, use the "Category-Based" extraction strategy to improve reliability</li>
              </ul>
            </div>
          )}
          
          <div className="platform-help-box">
            <h4>Category-Based Extraction (NEW!)</h4>
            <p>
              The category-based extraction strategy is recommended for large menus and complex restaurant pages:
            </p>
            <ul>
              <li>First scans for menu categories</li>
              <li>Then extracts each category separately</li>
              <li>Combines results for a complete menu</li>
              <li>Much more reliable for large restaurants with 30+ menu items</li>
            </ul>
            <p className="note">
              Note: Category-based extraction may take longer but produces more complete results for complex menus.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

URLInput.propTypes = {
  url: PropTypes.string.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onExtract: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  showAdvanced: PropTypes.bool,
  customPrompt: PropTypes.string,
  onCustomPromptChange: PropTypes.func,
  customSchema: PropTypes.string,
  onCustomSchemaChange: PropTypes.func,
  onToggleAdvanced: PropTypes.func,
  selectedPromptId: PropTypes.string,
  onPromptSelect: PropTypes.func,
  selectedSchemaId: PropTypes.string,
  onSchemaSelect: PropTypes.func,
  platformType: PropTypes.string,
  onPlatformDetect: PropTypes.func,
  extractionMethod: PropTypes.string,
  onMethodSelect: PropTypes.func,
  extractionStrategy: PropTypes.string,
  onStrategySelect: PropTypes.func,
  extractionMethodOptions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string
  })),
  cacheResults: PropTypes.bool,
  onToggleCacheResults: PropTypes.func,
  onClearCache: PropTypes.func,
  hasCachedData: PropTypes.bool,
  targetedExtraction: PropTypes.shape({
    type: PropTypes.oneOf(['category', 'item']),
    value: PropTypes.string
  })
};

URLInput.defaultProps = {
  showAdvanced: false,
  customPrompt: '',
  customSchema: '',
  onCustomPromptChange: () => {},
  onCustomSchemaChange: () => {},
  onToggleAdvanced: () => {},
  selectedPromptId: 'default',
  onPromptSelect: () => {},
  selectedSchemaId: 'default',
  onSchemaSelect: () => {},
  platformType: null,
  onPlatformDetect: () => {},
  extractionMethod: 'scrape',
  onMethodSelect: () => {},
  extractionStrategy: 'standard',
  onStrategySelect: () => {},
  extractionMethodOptions: [],
  cacheResults: false,
  onToggleCacheResults: () => {},
  onClearCache: () => {},
  hasCachedData: false,
  targetedExtraction: null
};

export default URLInput;