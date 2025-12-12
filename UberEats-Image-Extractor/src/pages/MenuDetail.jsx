import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ClockIcon,
  BuildingStorefrontIcon,
  TagIcon,
  ChevronDownIcon,
  TrashIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import EditableMenuItem from '../components/menu/EditableMenuItem';
import OptionSetsManagement from '../components/menu/OptionSetsManagement';
import { validateMenuItem, validateMenuItems, getChangedItems } from '../components/menu/MenuItemValidator';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useAuth } from '../context/AuthContext';

export default function MenuDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isFeatureEnabled } = useAuth();
  const [menu, setMenu] = useState(null);
  const [menuData, setMenuData] = useState(null);
  const [originalMenuData, setOriginalMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTab, setSelectedTab] = useState('items'); // 'items' or 'optionSets'
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState(null);
  const [tempCategoryName, setTempCategoryName] = useState('');
  const [deletedItems, setDeletedItems] = useState(new Set());
  const [deletedCategories, setDeletedCategories] = useState(new Set());
  const uploadIntervalRef = useRef(null);
  const [categoryNameChanges, setCategoryNameChanges] = useState({});

  useEffect(() => {
    fetchMenuDetails();
    
    // Cleanup function to clear interval on unmount
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
    };
  }, [id]);

  const fetchMenuDetails = async () => {
    try {
      const response = await api.get(`/menus/${id}`);
      if (response.data.success && response.data.menu) {
        const dbMenu = response.data.menu;
        setMenu(dbMenu);
        
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
              // Transform option sets for display component
              optionSets: (item.option_sets || []).map(set => ({
                ...set,
                options: (set.option_set_items || []).map(optItem => ({
                  name: optItem.name,
                  description: optItem.description,
                  priceChange: optItem.price || 0,
                  isDefault: optItem.is_default || false
                })),
                minSelections: set.min_selections || 0,
                maxSelections: set.max_selections || 1,
                isShared: false // Can be determined by checking if multiple items use this set
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
      setError(null);
    } catch (err) {
      console.error('Failed to fetch menu details:', err);
      setError('Failed to load menu details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async (includeImages = true, useCDN = false) => {
    try {
      let response;
      
      if (useCDN) {
        // Use new CDN endpoint
        response = await api.get(`/menus/${id}/csv-with-cdn`, {
          params: { download: 'true' },
          responseType: 'text'
        });
        
        // For CDN endpoint, response.data is the CSV string directly
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `menu_${id}_cdn_export.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "CSV exported successfully",
          description: `Exported menu with CDN data to ${filename}`,
        });
      } else {
        // Use existing export endpoint
        response = await api.post(`/menus/${id}/export`, {
          includeImages: includeImages
        });
        
        if (response.data.success && response.data.csvData) {
          const blob = new Blob([response.data.csvData], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const filename = response.data.filename || `menu_${id}_export.csv`;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "CSV exported successfully",
            description: `Exported ${response.data.stats?.rowCount || 'all'} items to ${filename}`,
          });
        }
      }
    } catch (err) {
      console.error('Failed to export CSV:', err);
      toast({
        title: "Export failed",
        description: err.response?.data?.error || 'Failed to export menu to CSV',
        variant: "destructive",
      });
    }
  };

  const handleDownloadImages = async () => {
    try {
      toast({
        title: "Preparing images...",
        description: "This may take a few moments",
      });
      
      const response = await api.get(`/menus/${id}/download-images-zip`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `menu_${id}_images.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Images downloaded successfully",
        description: "Check your downloads folder for the ZIP file",
      });
    } catch (err) {
      console.error('Failed to download images:', err);
      toast({
        title: "Download failed",
        description: 'Failed to download menu images',
        variant: "destructive",
      });
    }
  };

  const handleUploadImagesToCDN = async () => {
    try {
      // Clear any existing interval before starting
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }

      toast({
        title: "Starting CDN upload...",
        description: "Checking images to upload",
      });

      const response = await api.post(`/menus/${id}/upload-images`, {
        options: {
          preserveFilenames: true,
          skipExisting: true
        }
      });

      if (response.data.success) {
        const { mode, batchId, stats, message } = response.data;

        // Handle case where all images are already uploaded (no batchId)
        if (!batchId) {
          toast({
            title: stats?.alreadyUploaded > 0 ? "Images already uploaded" : "No images to upload",
            description: message || `${stats?.alreadyUploaded || 0} images already on CDN`,
            variant: "default"
          });
          return;
        }

        // Handle synchronous mode (small batches processed immediately)
        if (mode === 'synchronous') {
          toast({
            title: "Upload complete!",
            description: `Successfully uploaded ${response.data.stats?.successful || 0} images to CDN`,
            variant: "success"
          });
          return;
        }

        // Handle asynchronous mode - set up polling
        toast({
          title: "Upload started",
          description: `Uploading ${response.data.totalImages} images to CDN...`,
        });

        // Poll for progress using ref
        uploadIntervalRef.current = setInterval(async () => {
          try {
            const progressResponse = await api.get(`/upload-batches/${batchId}`);
            const batch = progressResponse.data.batch;

            if (batch.status === 'completed') {
              clearInterval(uploadIntervalRef.current);
              uploadIntervalRef.current = null;
              toast({
                title: "Upload complete!",
                description: `Successfully uploaded ${batch.progress?.uploaded || batch.uploaded_count || 0} images to CDN`,
                variant: "success"
              });
            } else if (batch.status === 'failed') {
              clearInterval(uploadIntervalRef.current);
              uploadIntervalRef.current = null;
              toast({
                title: "Upload failed",
                description: "Some images failed to upload to CDN",
                variant: "destructive"
              });
            } else if (batch.status === 'processing') {
              // Show progress toast
              const uploaded = batch.progress?.uploaded || batch.uploaded_count || 0;
              const total = batch.progress?.total || batch.total_images || 0;
              toast({
                title: "Uploading...",
                description: `${uploaded}/${total} images uploaded`,
              });
            }
          } catch (err) {
            console.error('Error checking progress:', err);
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
            toast({
              title: "Progress check failed",
              description: "Could not check upload status. Images may still be uploading in the background.",
              variant: "destructive"
            });
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

  const handleItemChange = (itemId, updatedItem) => {
    const errors = validateMenuItem(updatedItem);
    
    setEditedItems(prev => ({
      ...prev,
      [itemId]: updatedItem
    }));
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(prev => ({
        ...prev,
        [itemId]: errors
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
    
    // Update the menuData state to reflect the changes
    setMenuData(prev => {
      const newData = { ...prev };
      Object.keys(newData).forEach(category => {
        newData[category] = newData[category].map(item => 
          item.id === itemId ? updatedItem : item
        );
      });
      return newData;
    });
  };

  const handleCancelEdit = () => {
    if (Object.keys(editedItems).length > 0 || deletedItems.size > 0 || deletedCategories.size > 0 || Object.keys(categoryNameChanges).length > 0) {
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
    setMenuData(JSON.parse(JSON.stringify(originalMenuData)));
  };

  const handleDeleteItem = (itemId) => {
    setDeletedItems(prev => new Set([...prev, itemId]));
    
    // Remove from editedItems if it was being edited
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
      setCategoryNameChanges(prev => {
        const newChanges = {
          ...prev,
          [editingCategoryName]: tempCategoryName
        };
        console.log('[Frontend] Saving category name change:', editingCategoryName, '->', tempCategoryName);
        console.log('[Frontend] Updated categoryNameChanges:', newChanges);
        return newChanges;
      });
      
      // Don't update selectedCategory to the new name since it doesn't exist as a key in menuData
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
    // Validate all edited items that aren't deleted
    const itemsToValidate = Object.values(editedItems).filter(item => !deletedItems.has(item.id));
    const allErrors = validateMenuItems(itemsToValidate);
    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(allErrors);
      toast({
        title: "Validation errors",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      let hasChanges = false;
      const changesSummary = [];
      
      // Collect all items to delete (individual deletions + category deletions)
      const itemsToDelete = new Set(deletedItems);
      
      // Add items from deleted categories
      if (deletedCategories.size > 0) {
        for (const categoryName of deletedCategories) {
          const itemsInCategory = menuData[categoryName] || [];
          for (const item of itemsInCategory) {
            itemsToDelete.add(item.id);
          }
        }
        changesSummary.push(`${deletedCategories.size} categories deleted`);
        hasChanges = true;
      }
      
      // Mark items for deletion by setting deleted flag
      const deletionUpdates = [];
      if (itemsToDelete.size > 0) {
        for (const itemId of itemsToDelete) {
          // Find the original item to get all its data
          let originalItem = null;
          for (const category of Object.values(menuData)) {
            const found = category.find(item => item.id === itemId);
            if (found) {
              originalItem = found;
              break;
            }
          }
          
          if (originalItem) {
            deletionUpdates.push({
              id: itemId,
              name: originalItem.name,
              price: originalItem.price,
              category: originalItem.category,
              description: originalItem.description,
              is_deleted: true  // Mark as deleted
            });
          }
        }
        changesSummary.push(`${itemsToDelete.size} items deleted`);
        hasChanges = true;
      }
      
      // Handle category name changes by updating items with new category name
      const categoryRenamedItems = [];
      console.log('[Frontend] Processing category name changes:', categoryNameChanges);
      console.log('[Frontend] Category name changes length:', Object.keys(categoryNameChanges).length);
      if (Object.keys(categoryNameChanges).length > 0) {
        for (const [oldName, newName] of Object.entries(categoryNameChanges)) {
          console.log('[Frontend] Processing category rename:', oldName, '->', newName);
          const itemsInCategory = menuData[oldName] || [];
          console.log('[Frontend] Items in category:', itemsInCategory.length);
          for (const item of itemsInCategory) {
            // Skip if item is deleted
            if (itemsToDelete.has(item.id)) continue;
            
            // Get the current state of the item (edited or original)
            const currentItem = editedItems[item.id] || item;
            
            // Create update with all required fields
            // Don't include imageURL for category renames to preserve existing images
            const updatedItem = {
              id: item.id,
              name: currentItem.name,
              price: currentItem.price,
              category: newName,  // Use the new category name
              description: currentItem.description || null,
              tags: currentItem.tags || null
              // Omit imageURL to prevent accidental deletion
            };
            
            categoryRenamedItems.push(updatedItem);
            console.log('[Frontend] Added renamed item:', updatedItem);
          }
        }
        console.log('[Frontend] Total categoryRenamedItems:', categoryRenamedItems.length);
        changesSummary.push(`${Object.keys(categoryNameChanges).length} categories renamed`);
        hasChanges = true;
      }
      
      // Get only the changed items that aren't deleted and weren't renamed
      const changedItems = getChangedItems(editedItems, originalMenuData).filter(
        item => !itemsToDelete.has(item.id) && 
                !categoryRenamedItems.some(renamed => renamed.id === item.id)
      );
      
      // Combine all updates: deletions, category renames, and other changes
      const allItemsToUpdate = [...deletionUpdates, ...categoryRenamedItems, ...changedItems];
      
      console.log('[Frontend] Category name changes:', categoryNameChanges);
      console.log('[Frontend] Category renamed items:', categoryRenamedItems);
      console.log('[Frontend] All items to update:', allItemsToUpdate);
      
      if (allItemsToUpdate.length > 0) {
        const response = await menuItemAPI.bulkUpdate(allItemsToUpdate);
        if (response.data.success) {
          if (changedItems.length > 0 && !deletedItems.size) {
            changesSummary.push(`${changedItems.length} items updated`);
          }
          hasChanges = true;
        }
      }
      
      if (!hasChanges) {
        toast({
          title: "No changes to save",
          description: "No items have been modified",
        });
        setIsEditMode(false);
        setIsSaving(false);
        return;
      }
      
      // Update the original data to reflect saved changes
      setOriginalMenuData(JSON.parse(JSON.stringify(menuData)));
      setIsEditMode(false);
      setEditedItems({});
      setDeletedItems(new Set());
      setDeletedCategories(new Set());
      setCategoryNameChanges({});
      setValidationErrors({});
      
      toast({
        title: "Changes saved",
        description: changesSummary.join(', '),
      });
      
      // Refresh the menu data
      await fetchMenuDetails();
    } catch (err) {
      console.error('Failed to save changes:', err);
      toast({
        title: "Save failed",
        description: err.response?.data?.error || 'Failed to save menu changes',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      handleCancelEdit();
    } else {
      setIsEditMode(true);
    }
  };

  const getStatusBadge = () => {
    if (!menu) return null;
    
    if (menu.is_active) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
        <XCircleIcon className="h-3 w-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const getPlatformBadge = () => {
    if (!menu?.platforms) return null;
    
    const platformColors = {
      ubereats: 'bg-green-100 text-green-800 border-green-200',
      doordash: 'bg-red-100 text-red-800 border-red-200',
      unknown: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    const platform = menu.platforms.name?.toLowerCase() || 'unknown';
    
    return (
      <Badge 
        variant="outline"
        className={`capitalize ${platformColors[platform] || platformColors.unknown}`}
      >
        {menu.platforms.name || 'Unknown'}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (!menu || !menuData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Menu not found</p>
      </div>
    );
  }

  const categories = Object.keys(menuData).filter(cat => {
    // Filter out deleted categories
    if (deletedCategories.has(cat)) return false;
    
    // Filter out categories with no items (all items deleted)
    const itemsInCategory = menuData[cat] || [];
    const hasActiveItems = itemsInCategory.some(item => !deletedItems.has(item.id));
    return hasActiveItems;
  });
  const totalItems = Object.values(menuData).reduce((sum, items) => {
    const activeItems = items.filter(item => !deletedItems.has(item.id));
    return sum + activeItems.length;
  }, 0);
  const editedItemCount = Object.keys(editedItems).length;
  const hasErrors = Object.keys(validationErrors).length > 0;
  const totalChanges = editedItemCount + deletedItems.size + deletedCategories.size + Object.keys(categoryNameChanges).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/menus')}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Menus
            </button>
          </div>
          <div className="flex items-center space-x-3">
            {!isEditMode ? (
              <>
                <Button
                  onClick={toggleEditMode}
                  variant="outline"
                  size="sm"
                >
                  <PencilIcon className="h-4 w-4 mr-1.5" />
                  Edit Menu
                </Button>
{(isFeatureEnabled('csvDownload') || isFeatureEnabled('csvWithImagesDownload')) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <DocumentArrowDownIcon className="h-4 w-4 mr-1.5" />
                      Export CSV
                      <ChevronDownIcon className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isFeatureEnabled('csvWithImagesDownload') && (
                    <DropdownMenuItem onClick={() => handleDownloadCSV(true, true)}>
                      <CheckCircleIcon className="h-4 w-4 mr-2 text-green-600" />
                      CSV with CDN Images
                    </DropdownMenuItem>
                    )}
                    {isFeatureEnabled('csvDownload') && (
                    <DropdownMenuItem onClick={() => handleDownloadCSV(false)}>
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      CSV without Images
                    </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
{(isFeatureEnabled('imageUploadToCDN') || isFeatureEnabled('imageZipDownload')) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PhotoIcon className="h-4 w-4 mr-1.5" />
                      Export Images
                      <ChevronDownIcon className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isFeatureEnabled('imageUploadToCDN') && (
                    <DropdownMenuItem onClick={handleUploadImagesToCDN}>
                      <ArrowPathIcon className="h-4 w-4 mr-2 text-purple-600" />
                      Upload to CDN
                    </DropdownMenuItem>
                    )}
                    {isFeatureEnabled('imageZipDownload') && (
                    <DropdownMenuItem onClick={handleDownloadImages}>
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Download Images (ZIP)
                    </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={handleSaveChanges}
                  disabled={isSaving || hasErrors || totalChanges === 0}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckIcon className="h-4 w-4 mr-1.5" />
                  {isSaving ? 'Saving...' : `Save Changes (${totalChanges})`}
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  variant="outline"
                  size="sm"
                >
                  <XMarkIcon className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Menu Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BuildingStorefrontIcon className="h-6 w-6 text-gray-600" />
              <span>{menu.restaurants?.name || 'Unknown Restaurant'}</span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge()}
              {getPlatformBadge()}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Version</p>
              <p className="font-medium">v{menu.version || '1.0'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="font-medium">{totalItems}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium text-sm">{formatDate(menu.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="font-medium text-sm">{formatDate(menu.updated_at)}</p>
            </div>
          </div>
          {menu.is_merged && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-800">
                <Badge variant="secondary" className="mr-2">Merged Menu</Badge>
                Created from multiple menu sources
              </p>
            </div>
          )}
          {/* Navigation Buttons */}
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/restaurants/${menu.restaurant_id || menu.restaurants?.id}`)}
              className="flex items-center gap-2"
            >
              <BuildingStorefrontIcon className="h-4 w-4" />
              Manage Restaurant
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/menus?restaurant=${menu.restaurant_id || menu.restaurants?.id}`)}
              className="flex items-center gap-2"
            >
              <DocumentTextIcon className="h-4 w-4" />
              View All Menus
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Mode Notification */}
      {isEditMode && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <PencilIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Edit Mode Active</p>
              <p className="text-sm text-blue-700 mt-1">
                Click on any menu item field to edit. Changes will be highlighted in yellow.
                {editedItemCount > 0 && (
                  <span className="ml-2 font-medium">
                    {editedItemCount} item{editedItemCount !== 1 ? 's' : ''} modified
                  </span>
                )}
              </p>
              {hasErrors && (
                <p className="text-sm text-red-600 mt-1">
                  Please fix validation errors before saving
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setSelectedTab('items')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'items'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Menu Items
            </button>
            <button
              onClick={() => setSelectedTab('optionSets')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'optionSets'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Option Sets Management
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {selectedTab === 'items' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
              </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {categories.map((category) => {
                  const displayName = categoryNameChanges[category] || category;
                  const itemCount = menuData[category].filter(item => !deletedItems.has(item.id)).length;
                  
                  return (
                    <div
                      key={category}
                      className={`group relative ${
                        selectedCategory === category
                          ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedCategory(category)}
                        className="w-full text-left px-4 py-2 text-sm transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium flex-1 pr-2">{displayName}</span>
                          <div className="flex items-center gap-2">
                            {isEditMode && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditCategoryName(category);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded"
                                  title="Edit category name"
                                >
                                  <PencilIcon className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(category);
                                  }}
                                  className="p-1 hover:bg-red-100 rounded"
                                  title="Delete category"
                                >
                                  <TrashIcon className="h-3 w-3 text-red-600" />
                                </button>
                              </div>
                            )}
                            <span className="text-xs text-gray-500 min-w-[20px] text-right">
                              {itemCount}
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Menu Items */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {editingCategoryName === selectedCategory ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempCategoryName}
                      onChange={(e) => setTempCategoryName(e.target.value)}
                      className="px-2 py-1 border rounded"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveCategoryName}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    </button>
                    <button
                      onClick={handleCancelEditCategoryName}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <XMarkIcon className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <span>{categoryNameChanges[selectedCategory] || selectedCategory}</span>
                )}
                <Badge variant="secondary">
                  {(() => {
                    const originalCategoryName = Object.entries(categoryNameChanges).find(
                      ([original, renamed]) => renamed === selectedCategory
                    )?.[0] || selectedCategory;
                    return menuData[originalCategoryName]?.filter(item => !deletedItems.has(item.id)).length || 0;
                  })()} items
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedCategory && (() => {
                  // Find the original category name if it was renamed
                  const originalCategoryName = Object.entries(categoryNameChanges).find(
                    ([original, renamed]) => renamed === selectedCategory
                  )?.[0] || selectedCategory;
                  
                  const items = menuData[originalCategoryName];
                  if (!items) return null;
                  
                  return items.map((item) => {
                    // Skip deleted items
                    if (deletedItems.has(item.id)) {
                      return null;
                    }
                    
                    // Get the current item state (edited or original)
                    const currentItem = editedItems[item.id] || item;
                  
                    return (
                      <EditableMenuItem
                        key={item.id}
                        item={currentItem}
                        isEditMode={isEditMode}
                        onUpdate={handleItemChange}
                        onDelete={() => handleDeleteItem(item.id)}
                        validationErrors={validationErrors[item.id] || {}}
                      />
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      ) : (
        /* Option Sets Management View */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Option Sets Overview</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Manage shared option sets that can be applied to multiple menu items. 
                Changes here will affect all items using these option sets.
              </p>
            </CardHeader>
            <CardContent>
              <OptionSetsManagement 
                menuId={menu.id}
                orgId={menu.organisation_id}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}