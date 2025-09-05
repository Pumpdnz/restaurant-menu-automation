import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api, { menuItemAPI, extractionAPI } from '../services/api';
import { 
  ArrowLeftIcon,
  DocumentArrowDownIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  TrashIcon,
  ChevronDownIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import EditableMenuItem from '../components/menu/EditableMenuItem';
import OptionSetsManagement from '../components/menu/OptionSetsManagement';
import { validateMenuItem, validateMenuItems, getChangedItems } from '../components/menu/MenuItemValidator';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

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
  
  // New state for deletion and category management
  const [deletedItems, setDeletedItems] = useState(new Set());
  const [deletedCategories, setDeletedCategories] = useState(new Set());
  const [categoryNameChanges, setCategoryNameChanges] = useState({});
  const [editingCategoryName, setEditingCategoryName] = useState(null);
  const [tempCategoryName, setTempCategoryName] = useState('');
  
  // Premium extraction state
  const [isPremiumExtraction, setIsPremiumExtraction] = useState(false);
  const [premiumProgress, setPremiumProgress] = useState(null);

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
      // Check if this is a premium extraction (jobId starts with 'premium_')
      const isPremium = jobId.startsWith('premium_');
      setIsPremiumExtraction(isPremium);
      
      let jobData, status;
      
      if (isPremium) {
        // Handle premium extraction status - use the full jobId including premium_ prefix
        const statusResponse = await extractionAPI.getPremiumStatus(jobId);
        
        if (statusResponse.data.success) {
          // For completed premium extractions, we need to find the menu
          let menuId = statusResponse.data.menuId;
          
          // If no menuId and the job is completed, try to find it from the results
          if (!menuId && statusResponse.data.status === 'completed') {
            try {
              const resultsResponse = await extractionAPI.getPremiumResults(jobId);
              if (resultsResponse.data.success && resultsResponse.data.menuId) {
                menuId = resultsResponse.data.menuId;
              }
            } catch (err) {
              console.warn('Could not fetch premium results for menuId:', err);
            }
          }
          
          jobData = {
            id: jobId,
            url: statusResponse.data.url,
            restaurant: statusResponse.data.restaurantName || 'Restaurant',
            state: statusResponse.data.status,
            extractionType: 'premium',
            progress: statusResponse.data.progress,
            menuId: menuId,
            created_at: statusResponse.data.startTime ? new Date(statusResponse.data.startTime).toISOString() : null
          };
          
          // Set premium progress details
          setPremiumProgress(statusResponse.data.progress);
          status = statusResponse.data.status;
        } else {
          throw new Error(statusResponse.data.error || 'Failed to get premium extraction status');
        }
      } else {
        // Get standard job details
        const jobResponse = await api.get(`/extractions/${jobId}`);
        // API returns { success: true, job: {...} }
        jobData = jobResponse.data.job || jobResponse.data;
        status = jobData.state || jobData.status;
      }
      
      setJob(jobData);

      // Check job status
      const isInProgress = status === 'running' || status === 'pending' || status === 'processing' || status === 'in_progress';
      
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
            description: isPremium 
              ? "Premium menu data with option sets has been successfully extracted."
              : "Menu data has been successfully extracted.",
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
        if (isPremium) {
          // Get premium extraction results - use the full jobId including premium_ prefix
          const resultsResponse = await extractionAPI.getPremiumResults(jobId);
          
          if (resultsResponse.data.success && resultsResponse.data.menuId) {
            // Load the menu from database with option sets
            const menuResponse = await api.get(`/menus/${resultsResponse.data.menuId}`);
            if (menuResponse.data.success && menuResponse.data.menu) {
              const dbMenu = menuResponse.data.menu;
              // Transform database structure to component format
              const transformedData = {};
              
              dbMenu.categories.forEach(category => {
                // Only include categories that have items
                if (category.menu_items && category.menu_items.length > 0) {
                  transformedData[category.name] = category.menu_items.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    description: item.description,
                    tags: item.tags || [],
                    imageURL: item.item_images?.[0]?.url || null,
                    categoryId: category.id,
                    categoryName: category.name,
                    // Transform option sets from snake_case to camelCase
                    optionSets: (item.option_sets || []).map(optionSet => ({
                      ...optionSet,
                      minSelections: optionSet.min_selections,
                      maxSelections: optionSet.max_selections,
                      isRequired: optionSet.is_required,
                      options: (optionSet.option_set_items || []).map(optionItem => ({
                        ...optionItem,
                        name: optionItem.name,
                        description: optionItem.description,
                        priceChange: optionItem.price || 0,
                        isDefault: optionItem.is_default || false
                      }))
                    }))
                  }));
                }
              });
              
              setMenuData(transformedData);
              setOriginalMenuData(JSON.parse(JSON.stringify(transformedData)));
              
              // Set first category as selected by default
              const categories = Object.keys(transformedData);
              if (categories.length > 0) {
                setSelectedCategory(categories[0]);
              }
            }
          }
        } else if (jobData.menuId) {
          // Use database API for standard extractions
          const menuResponse = await api.get(`/menus/${jobData.menuId}`);
          if (menuResponse.data.success && menuResponse.data.menu) {
            const dbMenu = menuResponse.data.menu;
            // Transform database structure to component format
            const transformedData = {};
            
            dbMenu.categories.forEach(category => {
              // Only include categories that have items
              if (category.menu_items && category.menu_items.length > 0) {
                transformedData[category.name] = category.menu_items.map(item => ({
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  description: item.description,
                  tags: item.tags || [],
                  imageURL: item.item_images?.[0]?.url || null,
                  categoryId: category.id,
                  categoryName: category.name,
                  // Transform option sets from snake_case to camelCase
                  optionSets: (item.option_sets || []).map(optionSet => ({
                    ...optionSet,
                    minSelections: optionSet.min_selections,
                    maxSelections: optionSet.max_selections,
                    isRequired: optionSet.is_required,
                    options: (optionSet.option_set_items || []).map(optionItem => ({
                      ...optionItem,
                      name: optionItem.name,
                      description: optionItem.description,
                      priceChange: optionItem.price || 0,
                      isDefault: optionItem.is_default || false
                    }))
                  }))
                }));
              }
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

  const handleDownloadCSV = async (includeImages = true, useCDN = false) => {
    try {
      // Check if the job has a menuId (database-driven)
      if (job.menuId) {
        if (useCDN) {
          // Use new CDN endpoint
          const response = await api.get(`/menus/${job.menuId}/csv-with-cdn`, {
            params: { download: 'true' },
            responseType: 'text'
          });
          
          // Create download link
          const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${job.restaurant || 'menu'}_cdn_export.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "CSV exported successfully",
            description: "Exported menu with CDN data",
          });
        } else {
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
        }
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
    const hasChanges = Object.keys(editedItems).length > 0 || 
                       deletedItems.size > 0 || 
                       deletedCategories.size > 0 || 
                       Object.keys(categoryNameChanges).length > 0;
    
    if (hasChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    setIsEditMode(false);
    setEditedItems({});
    setValidationErrors({});
    setDeletedItems(new Set());
    setDeletedCategories(new Set());
    setCategoryNameChanges({});
    setEditingCategoryName(null);
    setTempCategoryName('');
  };

  const handleItemChange = (itemId, updatedItem) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: updatedItem
    }));
    
    // Validate the updated item
    const errors = validateMenuItem(updatedItem);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(prev => ({
        ...prev,
        [itemId]: errors
      }));
    } else {
      // Clear errors for this item if valid
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const handleDeleteItem = (itemId) => {
    setDeletedItems(prev => new Set([...prev, itemId]));
    
    // Remove from edited items
    setEditedItems(prev => {
      const newEdited = { ...prev };
      delete newEdited[itemId];
      return newEdited;
    });
    
    // Remove from validation errors
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[itemId];
      return newErrors;
    });
  };

  const handleDeleteCategory = (categoryName) => {
    if (window.confirm(`Are you sure you want to delete the entire "${categoryName}" category and all its items?`)) {
      setDeletedCategories(prev => new Set([...prev, categoryName]));
      
      // If this was the selected category, select another one
      if (selectedCategory === categoryName) {
        const remainingCategories = Object.keys(menuData).filter(
          cat => cat !== categoryName && !deletedCategories.has(cat)
        );
        if (remainingCategories.length > 0) {
          setSelectedCategory(remainingCategories[0]);
        }
      }
    }
  };

  const handleStartEditCategoryName = (categoryName) => {
    setEditingCategoryName(categoryName);
    setTempCategoryName(categoryNameChanges[categoryName] || categoryName);
    // Automatically switch to the category being edited
    setSelectedCategory(categoryName);
  };

  const handleSaveCategoryName = () => {
    if (tempCategoryName && tempCategoryName !== editingCategoryName) {
      setCategoryNameChanges(prev => ({
        ...prev,
        [editingCategoryName]: tempCategoryName
      }));
      
      // Keep the selected category as the original name (since that's what exists in menuData)
      // The display will show the new name via categoryNameChanges
    }
    setEditingCategoryName(null);
    setTempCategoryName('');
  };

  const handleCancelEditCategoryName = () => {
    setEditingCategoryName(null);
    setTempCategoryName('');
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

    setIsSaving(true);
    try {
      // Collect all items to delete (individual deletions + items from deleted categories)
      const itemsToDelete = new Set(deletedItems);
      
      // Add items from deleted categories
      deletedCategories.forEach(categoryName => {
        const originalCategoryName = Object.keys(categoryNameChanges).find(
          oldName => categoryNameChanges[oldName] === categoryName
        ) || categoryName;
        
        const itemsInCategory = menuData[originalCategoryName] || [];
        itemsInCategory.forEach(item => itemsToDelete.add(item.id));
      });

      // Create deletion updates
      const deletionUpdates = Array.from(itemsToDelete).map(itemId => {
        // Find the original item to get all its data
        let originalItem = null;
        Object.values(menuData).forEach(categoryItems => {
          const found = categoryItems.find(item => item.id === itemId);
          if (found) originalItem = found;
        });
        
        if (!originalItem) {
          console.warn(`Could not find item ${itemId} for deletion`);
          return null;
        }

        return {
          id: itemId,
          name: originalItem.name,
          price: originalItem.price,
          description: originalItem.description,
          tags: originalItem.tags || [],
          category: originalItem.categoryName,
          is_deleted: true // Mark for deletion
        };
      }).filter(Boolean);

      // Handle category renames - update all items in renamed categories
      const categoryRenamedItems = [];
      Object.entries(categoryNameChanges).forEach(([oldCategory, newCategory]) => {
        const itemsInCategory = menuData[oldCategory] || [];
        itemsInCategory.forEach(item => {
          // Skip if item is deleted
          if (itemsToDelete.has(item.id)) return;
          
          // Check if this item has other edits
          const hasOtherEdits = editedItems[item.id];
          
          categoryRenamedItems.push({
            id: item.id,
            name: hasOtherEdits?.name || item.name,
            price: hasOtherEdits?.price || item.price,
            description: hasOtherEdits?.description || item.description,
            tags: hasOtherEdits?.tags || item.tags || [],
            category: newCategory // New category name
            // Omit imageURL to prevent accidental deletion
          });
        });
      });

      // Get regular edited items (not deleted, not in renamed categories)
      const changedItems = [];
      Object.entries(editedItems).forEach(([itemId, editedItem]) => {
        // Skip if item is deleted
        if (itemsToDelete.has(itemId)) return;
        
        // Skip if item is in a renamed category (already handled)
        const itemCategory = Object.keys(menuData).find(cat =>
          menuData[cat].some(item => item.id === itemId)
        );
        if (itemCategory && categoryNameChanges[itemCategory]) return;
        
        changedItems.push({
          id: itemId,
          name: editedItem.name,
          price: editedItem.price,
          description: editedItem.description,
          tags: editedItem.tags || [],
          category: editedItem.categoryName,
          imageURL: editedItem.imageURL
        });
      });

      // Combine all updates
      const allItemsToUpdate = [...deletionUpdates, ...categoryRenamedItems, ...changedItems];

      if (allItemsToUpdate.length === 0) {
        toast({
          title: "No Changes",
          description: "No items have been modified.",
        });
        setIsSaving(false);
        return;
      }

      console.log('Sending bulk update with', allItemsToUpdate.length, 'items');
      console.log('Updates:', allItemsToUpdate);

      // Use bulk update endpoint
      const response = await menuItemAPI.bulkUpdate(allItemsToUpdate);

      if (response.updated > 0 || deletionUpdates.length > 0 || categoryRenamedItems.length > 0 || allItemsToUpdate.length > 0) {
        // Refresh the menu data
        await fetchJobDetails(false);
        
        // Reset edit mode
        setIsEditMode(false);
        setEditedItems({});
        setValidationErrors({});
        setDeletedItems(new Set());
        setDeletedCategories(new Set());
        setCategoryNameChanges({});
        setEditingCategoryName(null);

        toast({
          title: "Success",
          description: `Successfully updated ${response.updated || allItemsToUpdate.length} items.`,
        });
      } else {
        toast({
          title: "Warning",
          description: "No items were updated. Please check the data.",
          variant: "warning"
        });
      }
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

  const handleUploadImagesToCDN = async () => {
    try {
      if (!job.menuId) {
        toast({
          title: "No menu available",
          description: "This extraction doesn't have a saved menu. Please run a new extraction.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Starting CDN upload...",
        description: "Uploading images to CDN",
      });
      
      const response = await api.post(`/menus/${job.menuId}/upload-images`, {
        options: {
          preserveFilenames: true,
          skipExisting: true
        }
      });
      
      if (response.data.success) {
        const batchId = response.data.batchId;
        
        toast({
          title: "Upload started",
          description: `Uploading ${response.data.totalImages} images to CDN`,
        });
        
        // Poll for progress
        const checkProgress = setInterval(async () => {
          try {
            const progressResponse = await api.get(`/upload-batches/${batchId}`);
            const batch = progressResponse.data.batch;
            
            if (batch.status === 'completed') {
              clearInterval(checkProgress);
              toast({
                title: "Upload complete!",
                description: `Successfully uploaded ${batch.progress.uploaded} images to CDN`,
                variant: "success"
              });
            } else if (batch.status === 'failed') {
              clearInterval(checkProgress);
              toast({
                title: "Upload failed",
                description: "Some images failed to upload to CDN",
                variant: "destructive"
              });
            }
          } catch (err) {
            console.error('Error checking progress:', err);
            clearInterval(checkProgress);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to upload images to CDN:', err);
      toast({
        title: "Upload failed",
        description: err.response?.data?.error || 'Failed to upload images to CDN',
        variant: "destructive",
      });
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
            {(job.state === 'running' || job.status === 'running' || job.state === 'processing' || 
              job.status === 'processing' || job.state === 'in_progress' || job.status === 'in_progress') && (
              <div className="sm:col-span-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin mr-2" />
                    <h4 className="text-sm font-medium text-blue-900">
                      {isPremiumExtraction ? 'Premium Extraction in Progress' : 'Extraction in Progress'}
                    </h4>
                    {isPolling && (
                      <span className="ml-auto text-xs text-blue-600">
                        Auto-refreshing every 3 seconds
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {isPremiumExtraction && premiumProgress ? (
                      <>
                        {/* Premium extraction progress phases */}
                        <div className="space-y-3">
                          <div className={`flex items-center text-sm ${
                            premiumProgress.phase === 'scanning_categories' ? 'text-blue-700' : 
                            premiumProgress.categoriesScanned ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {premiumProgress.phase === 'scanning_categories' ? (
                              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                            ) : premiumProgress.categoriesScanned ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                            ) : (
                              <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                            )}
                            <span>Scanning menu categories</span>
                            {premiumProgress.categoriesFound > 0 && (
                              <span className="ml-auto text-xs">
                                {premiumProgress.categoriesFound} found
                              </span>
                            )}
                          </div>
                          
                          <div className={`flex items-center text-sm ${
                            premiumProgress.phase === 'extracting_items' ? 'text-blue-700' : 
                            premiumProgress.itemsExtracted ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {premiumProgress.phase === 'extracting_items' ? (
                              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                            ) : premiumProgress.itemsExtracted ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                            ) : (
                              <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                            )}
                            <span>Extracting menu items</span>
                            {premiumProgress.itemsFound > 0 && (
                              <span className="ml-auto text-xs">
                                {premiumProgress.itemsFound} items
                              </span>
                            )}
                          </div>
                          
                          {premiumProgress.extractOptionSets && (
                            <div className={`flex items-center text-sm ${
                              premiumProgress.phase === 'extracting_options' ? 'text-blue-700' : 
                              premiumProgress.optionSetsExtracted ? 'text-green-700' : 'text-gray-500'
                            }`}>
                              {premiumProgress.phase === 'extracting_options' ? (
                                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                              ) : premiumProgress.optionSetsExtracted ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                              ) : (
                                <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                              )}
                              <span>Extracting option sets</span>
                              {premiumProgress.optionSetsFound > 0 && (
                                <span className="ml-auto text-xs">
                                  {premiumProgress.optionSetsFound} sets
                                </span>
                              )}
                            </div>
                          )}
                          
                          {premiumProgress.validateImages && (
                            <div className={`flex items-center text-sm ${
                              premiumProgress.phase === 'validating_images' ? 'text-blue-700' : 
                              premiumProgress.imagesValidated ? 'text-green-700' : 'text-gray-500'
                            }`}>
                              {premiumProgress.phase === 'validating_images' ? (
                                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                              ) : premiumProgress.imagesValidated ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                              ) : (
                                <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                              )}
                              <span>Validating images</span>
                              {premiumProgress.imagesProcessed > 0 && (
                                <span className="ml-auto text-xs">
                                  {premiumProgress.imagesProcessed} validated
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className={`flex items-center text-sm ${
                            premiumProgress.phase === 'saving_to_database' ? 'text-blue-700' : 
                            premiumProgress.savedToDatabase ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {premiumProgress.phase === 'saving_to_database' ? (
                              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                            ) : premiumProgress.savedToDatabase ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                            ) : (
                              <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                            )}
                            <span>Saving to database</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-blue-600 mt-3">
                          Premium extraction with option sets typically takes 2-5 minutes.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center text-sm text-blue-700">
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></span>
                          Scanning menu categories and items...
                        </div>
                        <div className="text-xs text-blue-600 mt-2">
                          This process typically takes 1-3 minutes depending on menu size.
                        </div>
                      </>
                    )}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                        <DocumentArrowDownIcon className="h-4 w-4 mr-1.5" />
                        Export CSV
                        <ChevronDownIcon className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownloadCSV(true, true)}>
                        <CheckCircleIcon className="h-4 w-4 mr-2 text-green-600" />
                        CSV with CDN Images
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadCSV(false)}>
                        <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                        CSV without Images
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <PhotoIcon className="h-4 w-4 mr-1.5" />
                        Export Images
                        <ChevronDownIcon className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleUploadImagesToCDN}>
                        <CloudArrowUpIcon className="h-4 w-4 mr-2 text-purple-600" />
                        Upload to CDN
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadImages(true)}>
                        <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                        Download Images (ZIP)
                      </DropdownMenuItem>
                      {/* Only show server download for admin users */}
                      {localStorage.getItem('userRole') === 'admin' && (
                        <DropdownMenuItem onClick={() => handleDownloadImages(false)}>
                          <PhotoIcon className="h-4 w-4 mr-2" />
                          Download Images (Server)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            {isEditMode && (Object.keys(editedItems).length > 0 || deletedItems.size > 0 || deletedCategories.size > 0 || Object.keys(categoryNameChanges).length > 0) && (
              <div className="mt-2 space-y-1">
                {Object.keys(editedItems).length > 0 && (
                  <p className="text-sm text-blue-600">
                    {Object.keys(editedItems).length} item{Object.keys(editedItems).length > 1 ? 's' : ''} modified
                  </p>
                )}
                {deletedItems.size > 0 && (
                  <p className="text-sm text-red-600">
                    {deletedItems.size} item{deletedItems.size > 1 ? 's' : ''} marked for deletion
                  </p>
                )}
                {deletedCategories.size > 0 && (
                  <p className="text-sm text-red-600">
                    {deletedCategories.size} categor{deletedCategories.size > 1 ? 'ies' : 'y'} marked for deletion
                  </p>
                )}
                {Object.keys(categoryNameChanges).length > 0 && (
                  <p className="text-sm text-green-600">
                    {Object.keys(categoryNameChanges).length} categor{Object.keys(categoryNameChanges).length > 1 ? 'ies' : 'y'} renamed
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-gray-200">
            <div className="flex">
              {/* Category Sidebar */}
              <div className="w-64 bg-gray-50 border-r border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {Object.keys(menuData)
                    .filter(category => {
                      // Filter out deleted categories
                      if (deletedCategories.has(category)) return false;
                      // Filter out categories with all items deleted
                      const itemsInCategory = menuData[category] || [];
                      const hasActiveItems = itemsInCategory.some(item => !deletedItems.has(item.id));
                      return hasActiveItems;
                    })
                    .map((category) => {
                      const displayName = categoryNameChanges[category] || category;
                      const itemCount = menuData[category].filter(item => !deletedItems.has(item.id)).length;
                      
                      return (
                        <li key={category}>
                          {editingCategoryName === category ? (
                            <div className="px-4 py-3 bg-white">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={tempCategoryName}
                                  onChange={(e) => setTempCategoryName(e.target.value)}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveCategoryName}
                                  className="p-1 text-green-600 hover:text-green-700"
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEditCategoryName}
                                  className="p-1 text-red-600 hover:text-red-700"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedCategory(category)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-100 ${
                                selectedCategory === category ? 'bg-white font-medium' : ''
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span>{displayName}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">
                                    {itemCount}
                                  </span>
                                  {isEditMode && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEditCategoryName(category);
                                        }}
                                        className="p-1 text-gray-600 hover:text-blue-600 opacity-60"
                                      >
                                        <PencilIcon className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteCategory(category);
                                        }}
                                        className="p-1 text-red-600 hover:text-red-700 opacity-60"
                                      >
                                        <TrashIcon className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>

              {/* Items List */}
              <div className="flex-1 p-6">
                {selectedCategory && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      {categoryNameChanges[selectedCategory] || selectedCategory}
                    </h4>
                    <div className="space-y-4">
                      {menuData[selectedCategory]
                        .filter(item => !deletedItems.has(item.id))
                        .map((item, index) => {
                          // Get the current item state (edited or original)
                          const currentItem = editedItems[item.id] || item;
                          
                          return (
                            <EditableMenuItem
                              key={item.id || index}
                              item={currentItem}
                              isEditMode={isEditMode}
                              onUpdate={handleItemChange}
                              onDelete={() => handleDeleteItem(item.id)}
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