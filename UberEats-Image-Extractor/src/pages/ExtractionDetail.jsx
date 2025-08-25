import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api, { menuItemAPI } from '../services/api';
import { 
  ArrowLeftIcon,
  DocumentArrowDownIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import EditableMenuItem from '../components/menu/EditableMenuItem';
import { validateMenuItem, validateMenuItems, getChangedItems } from '../components/menu/MenuItemValidator';
import { useToast } from '../hooks/use-toast';

export default function ExtractionDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [job, setJob] = useState(null);
  const [menuData, setMenuData] = useState(null);
  const [originalMenuData, setOriginalMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingInterval = useRef(null);

  useEffect(() => {
    const shouldPoll = searchParams.get('poll') === 'true';
    fetchJobDetails(shouldPoll);
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [jobId]);

  const fetchJobDetails = async (shouldStartPolling = false) => {
    try {
      // Get job details
      const jobResponse = await api.get(`/extractions/${jobId}`);
      // API returns { success: true, job: {...} }
      const jobData = jobResponse.data.job || jobResponse.data;
      setJob(jobData);

      // Check job status
      const status = jobData.state || jobData.status;
      const isInProgress = status === 'running' || status === 'pending' || status === 'processing';
      
      // Start polling if job is in progress and we should poll
      if (isInProgress && shouldStartPolling && !pollingInterval.current) {
        setIsPolling(true);
        pollingInterval.current = setInterval(() => {
          fetchJobDetails(false); // Don't restart polling in recursive calls
        }, 3000); // Poll every 3 seconds
      }
      
      // Stop polling if job is complete or failed
      if (!isInProgress && pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
        setIsPolling(false);
        
        // Show completion toast
        if (status === 'completed') {
          toast({
            title: "Extraction Complete!",
            description: "Menu data has been successfully extracted.",
            variant: "success"
          });
        } else if (status === 'failed') {
          toast({
            title: "Extraction Failed",
            description: jobData.error || "An error occurred during extraction.",
            variant: "destructive"
          });
        }
      }

      // If completed, get the menu data
      if (status === 'completed') {
        if (jobData.menuId) {
          // Use database API for new extractions
          const menuResponse = await api.get(`/menus/${jobData.menuId}`);
          if (menuResponse.data.success && menuResponse.data.menu) {
            const dbMenu = menuResponse.data.menu;
            // Transform database structure to component format
            const transformedData = {};
            
            dbMenu.categories.forEach(category => {
              transformedData[category.name] = category.menu_items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                description: item.description,
                tags: item.tags || [],
                imageURL: item.item_images?.[0]?.url || null,
                categoryId: category.id,
                categoryName: category.name
              }));
            });
            
            setMenuData(transformedData);
            setOriginalMenuData(JSON.parse(JSON.stringify(transformedData)));
            
            // Set first category as selected by default
            const categories = Object.keys(transformedData);
            if (categories.length > 0) {
              setSelectedCategory(categories[0]);
            }
          }
        } else {
          // Fall back to old API for legacy extractions
          const resultsResponse = await api.get(`/batch-extract-results/${jobId}`);
          if (resultsResponse.data.success && resultsResponse.data.data) {
            setMenuData(resultsResponse.data.data);
            setOriginalMenuData(JSON.parse(JSON.stringify(resultsResponse.data.data)));
            // Set first category as selected by default
            const categories = Object.keys(resultsResponse.data.data);
            if (categories.length > 0) {
              setSelectedCategory(categories[0]);
            }
          }
        }
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch job details:', err);
      setError('Failed to load extraction details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async (includeImages = true) => {
    try {
      // Check if the job has a menuId (database-driven)
      if (job.menuId) {
        // Use direct CSV download endpoint for database menus
        const response = await api.get(`/menus/${job.menuId}/csv`, {
          responseType: 'blob',
          params: { format: includeImages ? 'full' : 'no_images' }
        });
        
        // Create download link
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers['content-disposition'];
        let filename = `${job.restaurant || 'menu'}_export.csv`;
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else if (menuData) {
        // Fall back to old method using in-memory data
        const csvResponse = await api.post('/generate-clean-csv', {
          data: { 
            menuItems: Object.values(menuData).flat(),
            restaurantInfo: { name: job.restaurant || 'restaurant' }
          }
        });
        
        const csvData = includeImages ? csvResponse.data.csvDataWithImages : csvResponse.data.csvDataNoImages;
        const filename = includeImages ? csvResponse.data.filenameWithImages : csvResponse.data.filenameNoImages;
        
        if (csvResponse.data.success && csvData) {
          const blob = new Blob([csvData], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename || `menu-${jobId}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      } else {
        // Try to fetch menu data first
        const resultsResponse = await api.get(`/batch-extract-results/${jobId}`);
        if (resultsResponse.data.success && resultsResponse.data.data) {
          const csvResponse = await api.post('/generate-clean-csv', {
            data: { 
              menuItems: Object.values(resultsResponse.data.data).flat(),
              restaurantInfo: { name: job.restaurant || 'restaurant' }
            }
          });
          
          const csvData = includeImages ? csvResponse.data.csvDataWithImages : csvResponse.data.csvDataNoImages;
          const filename = includeImages ? csvResponse.data.filenameWithImages : csvResponse.data.filenameNoImages;
          
          if (csvResponse.data.success && csvData) {
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `menu-${jobId}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
        }
      }
    } catch (err) {
      console.error('Failed to download CSV:', err);
      alert('Failed to download CSV. Please try again.');
    }
  };

  const handleUpdateItem = (itemId, updatedItem) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: updatedItem
    }));
    
    // Validate the updated item
    const errors = validateMenuItem(updatedItem);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (Object.keys(errors).length > 0) {
        newErrors[itemId] = errors;
      } else {
        delete newErrors[itemId];
      }
      return newErrors;
    });
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setEditedItems({});
    setValidationErrors({});
  };

  const handleCancelEdit = () => {
    if (Object.keys(editedItems).length > 0) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    setIsEditMode(false);
    setEditedItems({});
    setValidationErrors({});
  };

  const handleSaveChanges = async () => {
    // Validate all edited items
    const allErrors = validateMenuItems(Object.values(editedItems));
    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(allErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive"
      });
      return;
    }

    // Build a map of original items by ID
    const originalItemsMap = {};
    Object.values(originalMenuData).forEach(categoryItems => {
      categoryItems.forEach(item => {
        originalItemsMap[item.id] = item;
      });
    });

    // Get only changed items
    const changedItems = getChangedItems(originalItemsMap, editedItems);

    if (changedItems.length === 0) {
      toast({
        title: "No Changes",
        description: "No items have been modified.",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Bulk update all changed items
      const updatePromises = changedItems.map(item => 
        menuItemAPI.update(item.id, {
          name: item.name,
          price: item.price,
          description: item.description,
          tags: item.tags
        })
      );

      await Promise.all(updatePromises);

      // Update local state with saved changes
      const updatedMenuData = { ...menuData };
      changedItems.forEach(item => {
        const category = Object.keys(updatedMenuData).find(cat =>
          updatedMenuData[cat].some(menuItem => menuItem.id === item.id)
        );
        if (category) {
          const itemIndex = updatedMenuData[category].findIndex(menuItem => menuItem.id === item.id);
          if (itemIndex !== -1) {
            updatedMenuData[category][itemIndex] = {
              ...updatedMenuData[category][itemIndex],
              ...item
            };
          }
        }
      });

      setMenuData(updatedMenuData);
      setOriginalMenuData(JSON.parse(JSON.stringify(updatedMenuData)));
      setIsEditMode(false);
      setEditedItems({});
      setValidationErrors({});

      toast({
        title: "Success",
        description: `Updated ${changedItems.length} menu item${changedItems.length > 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImages = async (downloadAsZip = true) => {
    try {
      // Check if the job has a menuId (database-driven)
      if (job.menuId) {
        if (downloadAsZip) {
          // Use the ZIP download endpoint for browser download
          const response = await api.get(`/menus/${job.menuId}/download-images-zip`, {
            responseType: 'blob'
          });
          
          // Create download link
          const url = window.URL.createObjectURL(response.data);
          const a = document.createElement('a');
          a.href = url;
          
          // Extract filename from Content-Disposition header or use default
          const contentDisposition = response.headers['content-disposition'];
          let filename = `${job.restaurant || 'menu'}_images.zip`;
          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }
          
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } else {
          // Use original server-side download for internal use
          // TODO: When user auth is implemented, read the user's preferred download path
          // from their profile settings (e.g., user.settings.defaultImageDownloadPath)
          // and pass it as outputPath option. This will allow users to configure
          // where structured images are downloaded on their local machine.
          // Example future implementation:
          // const userSettings = await api.get('/user/settings');
          // const outputPath = userSettings.data.defaultImageDownloadPath || './downloads/extracted-images';
          
          const response = await api.post(`/menus/${job.menuId}/download-images`, {
            options: {
              groupByCategory: true,
              skipPlaceholders: true
              // outputPath: userSettings.defaultImageDownloadPath // Future: User-configured path
            }
          });
          
          if (response.data.success) {
            alert(`Downloaded ${response.data.stats.downloaded} images successfully!\nLocation: ${response.data.downloadPath}`);
          }
        }
      } else if (menuData) {
        if (downloadAsZip) {
          alert('ZIP download is only available for new extractions saved to the database. Please run a new extraction to use this feature.');
        } else {
          // Fall back to old method using in-memory data for server-side download
          // TODO: Same as above - when user auth is implemented, use user's preferred path
          // from their profile settings instead of hardcoded path
          const imageData = {
            menuItems: Object.values(menuData).flat(),
            restaurantInfo: { name: job.restaurant || 'restaurant' }
          };
          
          const response = await api.post('/download-images', {
            data: imageData,
            options: {
              outputPath: `./downloads/extracted-images/${job.restaurant || 'menu'}-${jobId}`,
              // Future: Replace with user.settings.defaultImageDownloadPath
              groupByCategory: true,
              skipPlaceholders: true
            }
          });
          
          if (response.data.success) {
            alert(`Downloaded ${response.data.stats.downloaded} images successfully!\nLocation: ${response.data.downloadPath}`);
          }
        }
      } else {
        alert('No menu data available for image download.');
      }
    } catch (err) {
      console.error('Failed to download images:', err);
      alert('Failed to download images. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  const totalItems = job?.totalItems || (menuData ? 
    Object.values(menuData).reduce((sum, category) => sum + category.length, 0) : 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/extractions')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Extractions
        </button>
      </div>

      {/* Job Info */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Extraction Details
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {job.restaurant || job.restaurant?.name || 'Unknown Restaurant'}
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Job ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{jobId}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  (job.state === 'completed' || job.status === 'completed') ? 'bg-green-100 text-green-800' :
                  (job.state === 'failed' || job.status === 'failed') ? 'bg-red-100 text-red-800' :
                  (job.state === 'running' || job.status === 'running') ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {job.state || job.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Items</dt>
              <dd className="mt-1 text-sm text-gray-900">{totalItems}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Platform</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {job.platform || job.platform?.name || 'Unknown'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {job.startTime ? new Date(job.startTime).toLocaleString() : 
                 job.created_at ? new Date(job.created_at).toLocaleString() : 
                 'Invalid Date'}
              </dd>
            </div>
            {/* Progress Indicator for Running Jobs */}
            {(job.state === 'running' || job.status === 'running' || job.state === 'processing' || job.status === 'processing') && (
              <div className="sm:col-span-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin mr-2" />
                    <h4 className="text-sm font-medium text-blue-900">
                      Extraction in Progress
                    </h4>
                    {isPolling && (
                      <span className="ml-auto text-xs text-blue-600">
                        Auto-refreshing every 3 seconds
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-blue-700">
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                      Scanning menu categories and items...
                    </div>
                    <div className="text-xs text-blue-600 mt-2">
                      This process typically takes 1-3 minutes depending on menu size.
                    </div>
                  </div>
                  {!isPolling && (
                    <button
                      onClick={() => fetchJobDetails(true)}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Enable auto-refresh
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Failed Job Indicator */}
            {(job.state === 'failed' || job.status === 'failed') && (
              <div className="sm:col-span-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <XCircleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-900 mb-1">
                        Extraction Failed
                      </h4>
                      <p className="text-sm text-red-700">
                        {job.error || 'An error occurred during the extraction process.'}
                      </p>
                      <button
                        onClick={() => navigate('/extractions/new')}
                        className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                      >
                        Try a new extraction
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Download Buttons for Completed Jobs */}
            {(job.state === 'completed' || job.status === 'completed') && (
              <div className="sm:col-span-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleDownloadCSV(false)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    CSV (No Images)
                  </button>
                  <button
                    onClick={() => handleDownloadCSV(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    CSV (With Images)
                  </button>
                  <button
                    onClick={() => handleDownloadImages(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PhotoIcon className="h-4 w-4 mr-2" />
                    Download Images (ZIP)
                  </button>
                  <button
                    onClick={() => handleDownloadImages(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    title="Downloads images to server location for internal processing"
                  >
                    <PhotoIcon className="h-4 w-4 mr-2" />
                    Download Images (Server)
                  </button>
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Menu Data */}
      {menuData && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Menu Items
              </h3>
              {job.menuId && (
                <div className="flex gap-2">
                  {!isEditMode ? (
                    <button
                      onClick={handleEnterEditMode}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <PencilIcon className="h-4 w-4 mr-1.5" />
                      Edit Items
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveChanges}
                        disabled={isSaving || Object.keys(validationErrors).length > 0}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                      >
                        <CheckIcon className="h-4 w-4 mr-1.5" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100"
                      >
                        <XMarkIcon className="h-4 w-4 mr-1.5" />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {isEditMode && Object.keys(editedItems).length > 0 && (
              <p className="mt-2 text-sm text-blue-600">
                {Object.keys(editedItems).length} item{Object.keys(editedItems).length > 1 ? 's' : ''} modified
              </p>
            )}
          </div>
          <div className="border-t border-gray-200">
            <div className="flex">
              {/* Category Sidebar */}
              <div className="w-64 bg-gray-50 border-r border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {Object.keys(menuData).map((category) => (
                    <li key={category}>
                      <button
                        onClick={() => setSelectedCategory(category)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 ${
                          selectedCategory === category ? 'bg-white font-medium' : ''
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>{category}</span>
                          <span className="text-sm text-gray-500">
                            {menuData[category].length}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Items List */}
              <div className="flex-1 p-6">
                {selectedCategory && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      {selectedCategory}
                    </h4>
                    <div className="space-y-4">
                      {menuData[selectedCategory].map((item, index) => {
                        // Get the current item state (edited or original)
                        const currentItem = editedItems[item.id] || item;
                        
                        return (
                          <EditableMenuItem
                            key={item.id || index}
                            item={currentItem}
                            isEditMode={isEditMode}
                            onUpdate={handleUpdateItem}
                            validationErrors={validationErrors[item.id] || {}}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}