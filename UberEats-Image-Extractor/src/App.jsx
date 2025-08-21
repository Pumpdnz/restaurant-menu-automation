// App.jsx - Main application component
import React, { useState, useRef, useEffect } from 'react';
import URLInput from './components/URLInput';
import ResultsDisplay from './components/ResultsDisplay';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorDisplay from './components/ErrorDisplay';
import { 
  extractMenuData, 
  extractMenuDataWithMethod,
  categoryBasedExtractMenuData,
  extractOptionSetsData,
  validateRestaurantUrl,
  DEFAULT_PROMPT,
  DEFAULT_SCHEMA,
  SCHEMA_OPTIONS,
  PROMPT_OPTIONS,
  EXTRACTION_METHOD_OPTIONS
} from './services/firecrawl-service';
import { downloadCSV, downloadOptionSetsCSV } from './utils/csv-generator';
import '../src/styles/App.css';

function App() {
  // Basic state
  const [url, setUrl] = useState('');
  const [extractionData, setExtractionData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [folderSelected, setFolderSelected] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  
  // Advanced state for new features
  const [customPrompt, setCustomPrompt] = useState('');
  const [customSchema, setCustomSchema] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState(null);
  const [comboItems, setComboItems] = useState([]);
  const [fieldEdits, setFieldEdits] = useState({});
  const [excludedItems, setExcludedItems] = useState([]);
  
  // New state for platform-specific features
  const [platformType, setPlatformType] = useState(null);
  const [selectedPromptId, setSelectedPromptId] = useState('default');
  const [selectedSchemaId, setSelectedSchemaId] = useState('default');
  const [extractionMethod, setExtractionMethod] = useState('scrape'); // 'scrape' or 'extract'
  const [extractionStrategy, setExtractionStrategy] = useState('standard'); // 'standard' or 'category-based'
  
  // State for caching and combining extraction results
  const [cacheResults, setCacheResults] = useState(false);
  const [cachedData, setCachedData] = useState(null);
  const [targetedExtraction, setTargetedExtraction] = useState(null); // Format: { type: 'category', value: 'categoryName' } or { type: 'item', value: 'itemName' }
  
  // Use a ref for the downloader to maintain state across renders
  const folderHandleRef = useRef(null);
  
  // Initialize prompt and schema values
  useEffect(() => {
    setCustomPrompt(DEFAULT_PROMPT);
    setCustomSchema(JSON.stringify(DEFAULT_SCHEMA, null, 2));
  }, []);
  
  // Update prompt when platform is detected or prompt selection changes
  useEffect(() => {
    if (platformType === 'doordash' && selectedPromptId === 'default') {
      // Auto-select DoorDash-specific prompt when DoorDash URL is detected
      setSelectedPromptId('doordash');
      const doorDashPrompt = PROMPT_OPTIONS.find(option => option.id === 'doordash');
      if (doorDashPrompt) {
        setCustomPrompt(doorDashPrompt.prompt);
      }
      
      // Auto-select DoorDash-specific schema
      setSelectedSchemaId('doordash');
      const doorDashSchema = SCHEMA_OPTIONS.find(option => option.id === 'doordash');
      if (doorDashSchema) {
        setCustomSchema(JSON.stringify(doorDashSchema.schema, null, 2));
      }
      
      // Automatically show advanced options for DoorDash
      setShowAdvanced(true);
    } else if (platformType === 'ubereats' && selectedPromptId === 'default') {
      // Auto-select UberEats-specific prompt
      setSelectedPromptId('ubereats');
      const uberEatsPrompt = PROMPT_OPTIONS.find(option => option.id === 'ubereats');
      if (uberEatsPrompt) {
        setCustomPrompt(uberEatsPrompt.prompt);
      }
    }
  }, [platformType]);
  
  /**
   * Handle platform detection from URL
   */
  const handlePlatformDetect = (platform) => {
    setPlatformType(platform);
  };
  
  /**
   * Handle prompt selection
   */
  const handlePromptSelect = (promptId) => {
    setSelectedPromptId(promptId);
    
    // If selecting DoorDash Images Focus, also select Images schema
    if (promptId === 'doordash_images') {
      setSelectedSchemaId('images');
      const imagesSchema = SCHEMA_OPTIONS.find(option => option.id === 'images');
      if (imagesSchema) {
        setCustomSchema(JSON.stringify(imagesSchema.schema, null, 2));
      }
    }
  };
  
  /**
   * Handle schema selection
   */
  const handleSchemaSelect = (schemaId) => {
    setSelectedSchemaId(schemaId);
  };
  
  /**
   * Handle extraction method selection
   */
  const handleMethodSelect = (method) => {
    setExtractionMethod(method);
  };
  
  /**
   * Handle extraction strategy selection (standard vs category-based)
   */
  const handleStrategySelect = (strategy) => {
    setExtractionStrategy(strategy);
  };
  
  /**
   * Handle URL extraction
   */
  const handleExtract = async () => {
    // Validate URL
    const validation = validateRestaurantUrl(url);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Only clear extraction data if we're not caching results
    if (!cacheResults) {
      setExtractionData(null);
      setComboItems([]);
      setFieldEdits({});
    }
    
    setExtractionStatus({
      status: 'processing',
      progress: 0,
      method: extractionMethod,
      strategy: extractionStrategy,
      targeted: targetedExtraction ? true : false
    });
    
    try {
      // Parse schema if provided
      let schemaObj = DEFAULT_SCHEMA;
      if (customSchema) {
        try {
          schemaObj = JSON.parse(customSchema);
        } catch (err) {
          throw new Error(`Invalid schema JSON: ${err.message}`);
        }
      }
      
      // Modify schema/prompt for targeted extraction if applicable
      let targetedPrompt = customPrompt || DEFAULT_PROMPT;
      let targetedSchema = schemaObj;
      
      if (targetedExtraction) {
        if (targetedExtraction.type === 'category') {
          console.log(`Performing targeted extraction for category: ${targetedExtraction.value}`);
          // Add specific instructions to focus on a particular category
          targetedPrompt = `${targetedPrompt}\n\nIMPORTANT: Focus SPECIFICALLY on the "${targetedExtraction.value}" category and ensure all items in this category are extracted completely.`;
        } else if (targetedExtraction.type === 'item') {
          console.log(`Performing targeted extraction for item: ${targetedExtraction.value}`);
          // Add specific instructions to focus on a particular item
          targetedPrompt = `${targetedPrompt}\n\nIMPORTANT: Focus SPECIFICALLY on extracting complete information for the menu item named "${targetedExtraction.value}", including high-resolution images and full description.`;
        }
      }
      
      // Check if we should use image-update mode
      let effectiveStrategy = extractionStrategy;
      let isImageUpdateMode = false;
      
      // Check if user explicitly selected image-update strategy
      if (extractionStrategy === 'image-update') {
        console.log('DEBUG: User selected image-update strategy');
        console.log('DEBUG: targetedExtraction:', targetedExtraction);
        console.log('DEBUG: extractionData exists:', !!extractionData);
        console.log('DEBUG: extractionData.menuItems exists:', !!(extractionData && extractionData.menuItems));
        
        // User manually selected image update mode
        if (!targetedExtraction || targetedExtraction.type !== 'category') {
          throw new Error('Image update mode requires a category to be selected');
        }
        
        // Check both extractionData and cachedData
        const dataSource = extractionData || cachedData;
        if (!dataSource || !dataSource.menuItems) {
          throw new Error('Image update mode requires existing menu data');
        }
        
        const existingCategoryItems = dataSource.menuItems.filter(
          item => item.categoryName === targetedExtraction.value
        );
        
        if (existingCategoryItems.length === 0) {
          throw new Error(`No existing items found for category "${targetedExtraction.value}"`);
        }
        
        console.log(`User selected image-update mode for category "${targetedExtraction.value}"`);
        isImageUpdateMode = true;
        effectiveStrategy = 'category-based'; // Use category-based internally
      } 
      // Also check for automatic image update mode
      else if (targetedExtraction && targetedExtraction.type === 'category' && cacheResults && extractionData) {
        // Check if we already have data for this category
        const existingCategoryItems = extractionData.menuItems?.filter(
          item => item.categoryName === targetedExtraction.value
        ) || [];
        
        if (existingCategoryItems.length > 0) {
          console.log(`Auto-detected existing items for category "${targetedExtraction.value}", switching to image-update mode`);
          isImageUpdateMode = true;
          effectiveStrategy = 'category-based'; // Force category-based for image updates
        }
      }
      
      console.log(`Using ${effectiveStrategy} strategy with ${extractionMethod} method for menu data extraction`);
      if (targetedExtraction) {
        console.log(`Targeted extraction: ${targetedExtraction.type} - ${targetedExtraction.value}`);
      }
      if (cacheResults && extractionData) {
        console.log('Caching enabled: Results will be combined with previous extraction data');
      }
      
      let result;
      
      if (isImageUpdateMode) {
        // Use specialized image update extraction
        console.log('=== IMAGE UPDATE MODE ACTIVATED ===');
        
        // Use the same data source we validated above
        const dataSource = extractionData || cachedData;
        const existingCategoryItems = dataSource.menuItems.filter(
          item => item.categoryName === targetedExtraction.value
        );
        console.log(`Found ${existingCategoryItems.length} existing items in category "${targetedExtraction.value}"`);
        
        result = await categoryBasedExtractMenuData(url, {
          targetedCategory: targetedExtraction.value,
          imageUpdateMode: true,
          existingMenuItems: existingCategoryItems
        });
      } else {
        // Use normal extraction
        console.log('=== NORMAL EXTRACTION MODE ===');
        console.log(`Strategy: ${effectiveStrategy}, Method: ${extractionMethod}`);
        
        result = await extractMenuDataWithMethod(
          url, 
          targetedPrompt,
          targetedSchema,
          effectiveStrategy,
          targetedExtraction
        );
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract menu data');
      }
      
      // Handle combining results with cached data if applicable
      let combinedData;
      
      if (cacheResults && (extractionData || cachedData)) {
        const existingData = extractionData || cachedData;
        
        // Combine menu items from both extractions
        const existingMenuItems = existingData.menuItems || [];
        const newMenuItems = result.data.menuItems || [];
        
        if (targetedExtraction && targetedExtraction.type === 'category') {
          // If targeted extraction for a category, replace all items in that category
          const targetCategory = targetedExtraction.value;
          const filteredExisting = existingMenuItems.filter(item => 
            item.categoryName !== targetCategory
          );
          const newCategoryItems = newMenuItems.filter(item => 
            item.categoryName === targetCategory || !item.categoryName
          );
          
          combinedData = {
            ...existingData,
            menuItems: [...filteredExisting, ...newCategoryItems]
          };
          
          console.log(`Replaced ${newCategoryItems.length} items in category "${targetCategory}"`);
        } 
        else if (targetedExtraction && targetedExtraction.type === 'item') {
          // If targeted extraction for a specific item, replace just that item
          const targetItem = targetedExtraction.value;
          const filteredExisting = existingMenuItems.filter(item => 
            item.dishName !== targetItem
          );
          const newTargetItems = newMenuItems.filter(item => 
            item.dishName === targetItem || item.dishName.includes(targetItem)
          );
          
          combinedData = {
            ...existingData,
            menuItems: [...filteredExisting, ...newTargetItems]
          };
          
          console.log(`Replaced ${newTargetItems.length} occurrences of item "${targetItem}"`);
        }
        else {
          // If not targeted, append all new items
          // Use a Set to deduplicate items based on dishName + categoryName
          const existingItemKeys = new Set(
            existingMenuItems.map(item => `${item.dishName}__${item.categoryName}`)
          );
          
          // Filter out duplicates from new items
          const uniqueNewItems = newMenuItems.filter(item => 
            !existingItemKeys.has(`${item.dishName}__${item.categoryName}`)
          );
          
          combinedData = {
            ...existingData,
            menuItems: [...existingMenuItems, ...uniqueNewItems]
          };
          
          console.log(`Added ${uniqueNewItems.length} new unique menu items`);
        }
      } else {
        // No caching, just use the new data
        combinedData = result.data;
      }
      
      // Save the combined data and update the cache
      setExtractionData(combinedData);
      setCachedData(combinedData);
      
      setExtractionStatus({
        status: 'completed',
        progress: 100,
        method: result.method || extractionMethod, // Use the method that was actually used (in case of fallback)
        strategy: result.strategy || extractionStrategy,
        warnings: result.warnings,
        targeted: targetedExtraction ? true : false,
        combined: cacheResults && (extractionData || cachedData) ? true : false
      });
      
      // Clear the targeted extraction after it's completed
      if (targetedExtraction) {
        setTargetedExtraction(null);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Extraction error:', error);
      setError(error.message);
      setIsLoading(false);
      setExtractionStatus({
        status: 'failed',
        error: error.message,
        method: extractionMethod,
        strategy: extractionStrategy,
        targeted: targetedExtraction ? true : false
      });
      
      // Clear targeted extraction if it fails
      if (targetedExtraction) {
        setTargetedExtraction(null);
      }
    }
  };
  
  /**
   * Handle folder selection
   */
  const handleSelectFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        setError('Your browser doesn\'t support folder selection. Please use Chrome, Edge, or another modern browser.');
        return;
      }
      
      // Show the directory picker
      folderHandleRef.current = await window.showDirectoryPicker();
      setFolderSelected(true);
      
      // If there was an error, clear it since we've successfully selected a folder
      if (error) {
        setError(null);
      }
    } catch (err) {
      // Ignore AbortError which happens when user cancels the picker
      if (err.name !== 'AbortError') {
        console.error('Folder selection error:', err);
        setError('Error selecting folder: ' + err.message);
      }
    }
  };
  
  /**
   * Handle download progress updates
   */
  const updateDownloadProgress = (progress) => {
    setDownloadProgress(progress);
  };
  
  /**
   * Handle combo item selection
   */
  const handleComboSelection = (dishName, isCombo) => {
    setComboItems(prev => {
      if (isCombo && !prev.includes(dishName)) {
        return [...prev, dishName];
      } else if (!isCombo && prev.includes(dishName)) {
        return prev.filter(item => item !== dishName);
      }
      return prev;
    });
  };
  
  /**
   * Handle field editing for CSV
   */
  const handleFieldEdit = (dishName, fieldName, value) => {
    // Handle single field edit
    if (typeof fieldName === 'string') {
      setFieldEdits(prev => {
        const current = prev[dishName] || {};
        return {
          ...prev,
          [dishName]: {
            ...current,
            [fieldName]: value
          }
        };
      });
    } 
    // Handle multiple fields at once (fieldName is an object of fields)
    else if (typeof fieldName === 'object') {
      setFieldEdits(prev => {
        const current = prev[dishName] || {};
        return {
          ...prev,
          [dishName]: {
            ...current,
            ...fieldName // fieldName is an object with multiple field:value pairs
          }
        };
      });
    }
  };
  
  /**
   * Handle toggling item exclusion for CSV
   */
  const handleItemExcludeToggle = (dishName) => {
    setExcludedItems(prev => {
      if (prev.includes(dishName)) {
        // Remove from excluded items
        return prev.filter(item => item !== dishName);
      } else {
        // Add to excluded items
        return [...prev, dishName];
      }
    });
  };
  
  /**
   * Handle CSV download
   */
  const handleCSVDownload = () => {
    if (!extractionData) return;
    
    downloadCSV(extractionData, {
      comboItems,
      fieldEdits
    });
  };
  
  /**
   * Handle option sets CSV download
   */
  const handleOptionSetsCSVDownload = () => {
    if (!extractionData) return;
    
    downloadOptionSetsCSV(extractionData, {});
  };
  
  /**
   * Toggle advanced options display
   */
  const toggleAdvancedOptions = () => {
    setShowAdvanced(prev => !prev);
  };
  
  /**
   * Toggle cache results
   */
  const toggleCacheResults = () => {
    setCacheResults(prev => !prev);
  };
  
  /**
   * Set targeted extraction for a category
   */
  const setTargetedCategoryExtraction = (categoryName) => {
    setTargetedExtraction({
      type: 'category',
      value: categoryName
    });
  };
  
  /**
   * Set targeted extraction for a specific menu item
   */
  const setTargetedItemExtraction = (itemName) => {
    setTargetedExtraction({
      type: 'item',
      value: itemName
    });
  };
  
  /**
   * Clear all cached data
   */
  const clearCachedData = () => {
    setCachedData(null);
    setExtractionData(null);
    setComboItems([]);
    setFieldEdits({});
  };
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>Menu Scraper</h1>
        <p className="app-description">
          Extract menu data and images from UberEats and DoorDash restaurants
        </p>
      </header>
      
      <main className="app-main">
        <URLInput 
          url={url} 
          onUrlChange={setUrl}
          onExtract={handleExtract}
          isLoading={isLoading}
          showAdvanced={showAdvanced}
          customPrompt={customPrompt}
          onCustomPromptChange={setCustomPrompt}
          customSchema={customSchema}
          onCustomSchemaChange={setCustomSchema}
          onToggleAdvanced={toggleAdvancedOptions}
          selectedPromptId={selectedPromptId}
          onPromptSelect={handlePromptSelect}
          selectedSchemaId={selectedSchemaId}
          onSchemaSelect={handleSchemaSelect}
          platformType={platformType}
          onPlatformDetect={handlePlatformDetect}
          extractionMethod={extractionMethod}
          onMethodSelect={handleMethodSelect}
          extractionStrategy={extractionStrategy}
          onStrategySelect={handleStrategySelect}
          extractionMethodOptions={EXTRACTION_METHOD_OPTIONS}
          cacheResults={cacheResults}
          onToggleCacheResults={toggleCacheResults}
          onClearCache={clearCachedData}
          hasCachedData={!!extractionData || !!cachedData}
          targetedExtraction={targetedExtraction}
        />
        
        <div className="app-actions">
          <button 
            onClick={handleSelectFolder}
            className="folder-button"
            disabled={isLoading}
          >
            {folderSelected ? '✓ Folder Selected' : 'Select Download Folder'}
          </button>
          
          {downloadProgress && (
            <div className="download-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${downloadProgress.percent}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {downloadProgress.current} / {downloadProgress.total} 
                ({downloadProgress.percent}%)
              </div>
            </div>
          )}
        </div>
        
        {error && <ErrorDisplay message={error} />}
        
        {isLoading && (
          <LoadingOverlay 
            status={extractionStatus?.status || 'pending'} 
            progress={extractionStatus?.progress || 0}
            method={extractionStatus?.method || extractionMethod}
            strategy={extractionStatus?.strategy || extractionStrategy}
            warnings={extractionStatus?.warnings}
          />
        )}
        
        {extractionData && (
          <ResultsDisplay 
            data={extractionData}
            folderHandle={folderHandleRef.current}
            folderSelected={folderSelected}
            onSelectFolder={handleSelectFolder}
            onUpdateProgress={updateDownloadProgress}
            comboItems={comboItems}
            onComboSelection={handleComboSelection}
            fieldEdits={fieldEdits}
            onFieldEdit={handleFieldEdit}
            onCSVDownload={handleCSVDownload}
            onOptionSetsCSVDownload={handleOptionSetsCSVDownload}
            platformType={platformType}
            onTargetCategory={setTargetedCategoryExtraction}
            onTargetItem={setTargetedItemExtraction}
            cacheResults={cacheResults}
            targetedExtraction={targetedExtraction}
            url={url}
            onExtract={handleExtract}
            isLoading={isLoading}
            excludedItems={excludedItems}
            onItemExcludeToggle={handleItemExcludeToggle}
            extractionStrategy={extractionStrategy}
          />
        )}
      </main>
      
      <footer className="app-footer">
        <p>Menu Scraper - Internal Tool for Pump'd</p>
        {platformType && (
          <div className="platform-indicator">
            <span className={`platform-tag ${platformType}`}>
              {platformType === 'ubereats' ? 'UberEats Mode' : 'DoorDash Mode'}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}

export default App;