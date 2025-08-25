import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  GitMerge,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Edit3,
  Save
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/use-toast';

export default function MenuMerge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  
  const [validation, setValidation] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [includeUnique, setIncludeUnique] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [mergeSuccess, setMergeSuccess] = useState(false);
  const [mergeMode, setMergeMode] = useState('full'); // 'full' or 'price-only'
  
  // Get menu IDs from URL
  const menuIds = searchParams.get('menuIds')?.split(',') || [];

  useEffect(() => {
    if (menuIds.length >= 2) {
      validateMenus();
    } else {
      navigate('/menus');
    }
  }, []);

  const validateMenus = async () => {
    setValidating(true);
    try {
      const response = await api.post('/menus/merge/validate', {
        menuIds
      });
      
      setValidation(response.data);
      
      if (response.data.valid) {
        // Automatically start comparison
        compareMenus();
      }
    } catch (error) {
      console.error('Validation failed:', error);
      setValidation({
        valid: false,
        errors: [error.response?.data?.error || 'Failed to validate menus'],
        warnings: []
      });
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const compareMenus = async () => {
    setComparing(true);
    try {
      const response = await api.post('/menus/merge/compare', {
        menuIds,
        mergeMode
      });
      
      setComparison(response.data);
      
      // Debug: Log the unique items to see what's being shown
      console.log('Unique items received:', response.data.comparison.uniqueItems);
      console.log('Duplicate groups:', response.data.comparison.duplicateGroups);
      
      // Initialize decisions for duplicate groups
      const initialDecisions = {};
      response.data.comparison.duplicateGroups.forEach(group => {
        // For exact matches (99%+), automatically use keep_menu1
        const defaultAction = group.similarity >= 0.99 
          ? 'keep_menu1' 
          : (group.suggestedResolution?.recommended || 'keep_menu1');
        
        initialDecisions[group.groupId] = {
          action: defaultAction,
          similarity: group.similarity
        };
      });
      setDecisions(initialDecisions);
      
      // Initialize include unique items (all included by default)
      const initialUnique = {};
      Object.keys(response.data.comparison.uniqueItems).forEach(menuId => {
        initialUnique[menuId] = response.data.comparison.uniqueItems[menuId].map(item => item.id);
      });
      setIncludeUnique(initialUnique);
      
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setComparing(false);
    }
  };

  const previewMerge = async () => {
    setPreviewing(true);
    try {
      const response = await api.post('/menus/merge/preview', {
        menuIds,
        decisions,
        includeUnique,
        mergeMode
      });
      
      setPreview(response.data);
      setShowPreviewDialog(true);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setPreviewing(false);
    }
  };

  const executeMerge = async () => {
    setExecuting(true);
    setMergeSuccess(false);
    try {
      const response = await api.post('/menus/merge/execute', {
        menuIds,
        decisions,
        includeUnique,
        mergeMode,
        menuName: menuName || 'Merged Menu',
        performedBy: 'user' // You might want to get this from auth context
      });
      
      if (response.data.success) {
        // Set success state for visual feedback
        setMergeSuccess(true);
        setExecuting(false);
        
        // Show success toast
        toast({
          title: "✓ Merge Successful",
          description: `Successfully created merged menu: ${menuName || 'Merged Menu'}`,
          className: "bg-green-50 border-green-200",
        });
        
        // Close dialog and navigate after a short delay for user to see success
        setTimeout(() => {
          setShowPreviewDialog(false);
          navigate(`/menus/${response.data.menuId}`);
        }, 2000);
      } else {
        throw new Error(response.data.error || 'Merge failed');
      }
    } catch (error) {
      console.error('Merge execution failed:', error);
      
      // Show error toast
      toast({
        title: "Merge Failed",
        description: error.response?.data?.error || error.message || 'Failed to execute merge. Please try again.',
        variant: "destructive",
      });
      
      setExecuting(false);
      setMergeSuccess(false);
    }
  };

  const handleDecisionChange = (groupId, action, customFields = null) => {
    setDecisions(prev => ({
      ...prev,
      [groupId]: {
        action,
        customFields,
        similarity: prev[groupId]?.similarity
      }
    }));
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleUniqueItem = (menuId, itemId) => {
    setIncludeUnique(prev => {
      const menuItems = prev[menuId] || [];
      const newItems = menuItems.includes(itemId)
        ? menuItems.filter(id => id !== itemId)
        : [...menuItems, itemId];
      
      return {
        ...prev,
        [menuId]: newItems
      };
    });
  };

  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.95) return 'text-red-600';
    if (similarity >= 0.85) return 'text-orange-600';
    if (similarity >= 0.75) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getSimilarityLabel = (similarity) => {
    if (similarity >= 0.99) return 'Identical';
    if (similarity >= 0.95) return 'Exact Match';
    if (similarity >= 0.85) return 'Very Similar';
    if (similarity >= 0.75) return 'Similar';
    return 'Possible Match';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/menus')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Menus
        </Button>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Cannot merge selected menus:</div>
            <ul className="list-disc list-inside space-y-1">
              {validation?.errors?.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/menus')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Menus
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitMerge className="h-6 w-6 text-purple-600" />
              Merge Menus
            </h1>
            <p className="text-muted-foreground mt-1">
              Merging {validation?.menuDetails?.length || 0} menus
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={previewMerge}
              disabled={!comparison || previewing}
            >
              {previewing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Preview
            </Button>
            <Button
              onClick={() => setShowPreviewDialog(true)}
              disabled={!preview}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Merged Menu
            </Button>
          </div>
        </div>
      </div>

      {/* Merge Mode Selector */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Merge Mode:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="full"
                  checked={mergeMode === 'full'}
                  onChange={(e) => setMergeMode(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Full Merge</span>
                <span className="text-xs text-muted-foreground">(All fields)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="price-only"
                  checked={mergeMode === 'price-only'}
                  onChange={(e) => setMergeMode(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Price Update</span>
                <span className="text-xs text-muted-foreground">(Keep delivery platform items, update prices only)</span>
              </label>
            </div>
          </div>
          {mergeMode === 'price-only' && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Price Update Mode:</strong> Menu 1 structure will be kept with prices from Menu 2. 
                Perfect for updating delivery platform menus with restaurant's direct pricing.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Warnings */}
      {validation?.warnings?.length > 0 && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {validation.warnings.map((warning, idx) => (
              <div key={idx}>{warning}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Menu Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {validation?.menuDetails?.map((menu, idx) => (
          <Card key={menu.id} className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Menu {idx + 1}
              </CardTitle>
              <CardDescription className="text-xs">
                {menu.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{menu.itemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform:</span>
                  <Badge variant="outline" className="text-xs">
                    {menu.platform}
                  </Badge>
                </div>
                {menu.isMerged && (
                  <Badge variant="secondary" className="text-xs w-full justify-center">
                    Already Merged
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      {comparing ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-brand-blue animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Analyzing menus for duplicates...</p>
          </div>
        </div>
      ) : comparison && (
        <Tabs defaultValue="duplicates" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="duplicates">
              Duplicates ({comparison.statistics.duplicates})
            </TabsTrigger>
            <TabsTrigger value="unique">
              Unique Items ({comparison.statistics.unique})
            </TabsTrigger>
            <TabsTrigger value="summary">
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Duplicates Tab */}
          <TabsContent value="duplicates" className="space-y-4">
            {comparison.comparison.duplicateGroups.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No duplicate items detected
                </CardContent>
              </Card>
            ) : (
              comparison.comparison.duplicateGroups.map((group) => (
                <Card key={group.groupId} className="overflow-hidden">
                  <CardHeader 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleGroupExpansion(group.groupId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(group.groupId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <CardTitle className="text-base">
                          {group.items[0]?.name || 'Unnamed Item'}
                        </CardTitle>
                        <Badge 
                          variant="secondary"
                          className={cn('text-xs', getSimilarityColor(group.similarity))}
                        >
                          {Math.round(group.similarity * 100)}% {getSimilarityLabel(group.similarity)}
                        </Badge>
                      </div>
                      
                      <Badge variant="outline">
                        {group.items.length} versions
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  {expandedGroups.has(group.groupId) && (
                    <CardContent className="border-t">
                      {/* Item Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {group.items.map((item, idx) => (
                          <div key={item.id} className="p-3 border rounded-lg">
                            <div className="text-sm font-medium mb-2">
                              Menu {idx + 1} Version
                            </div>
                            
                            {/* Item Image */}
                            {item.imageURL && (
                              <div className="mb-2">
                                <img 
                                  src={item.imageURL} 
                                  alt={item.name}
                                  className="w-full h-32 object-cover rounded"
                                />
                              </div>
                            )}
                            
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="text-muted-foreground">Name: </span>
                                <span className="font-medium">{item.name}</span>
                              </div>
                              {item.price && (
                                <div>
                                  <span className="text-muted-foreground">Price: </span>
                                  <span className="font-medium">${item.price}</span>
                                </div>
                              )}
                              {item.description && (
                                <div>
                                  <span className="text-muted-foreground">Description: </span>
                                  <span className="text-xs">{item.description}</span>
                                </div>
                              )}
                              {item.categoryName && (
                                <div>
                                  <span className="text-muted-foreground">Category: </span>
                                  <Badge variant="outline" className="text-xs">
                                    {item.categoryName}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Resolution Options */}
                      <div className="border-t pt-4">
                        <Label className="text-sm font-medium mb-2 block">
                          Resolution:
                        </Label>
                        <RadioGroup
                          value={decisions[group.groupId]?.action || 'keep_menu1'}
                          onValueChange={(value) => handleDecisionChange(group.groupId, value)}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="keep_menu1" id={`${group.groupId}-menu1`} />
                              <Label htmlFor={`${group.groupId}-menu1`} className="cursor-pointer flex items-center gap-2">
                                Keep Menu 1 version
                                {group.items[0]?.imageURL && (
                                  <span className="text-xs text-muted-foreground">(includes image)</span>
                                )}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="keep_menu2" id={`${group.groupId}-menu2`} />
                              <Label htmlFor={`${group.groupId}-menu2`} className="cursor-pointer flex items-center gap-2">
                                Keep Menu 2 version
                                {group.items[1]?.imageURL && (
                                  <span className="text-xs text-muted-foreground">(includes image)</span>
                                )}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="keep_both" id={`${group.groupId}-both`} />
                              <Label htmlFor={`${group.groupId}-both`} className="cursor-pointer">
                                Keep both versions
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="custom" id={`${group.groupId}-custom`} />
                              <Label htmlFor={`${group.groupId}-custom`} className="cursor-pointer">
                                Custom merge (choose fields)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="exclude" id={`${group.groupId}-exclude`} />
                              <Label htmlFor={`${group.groupId}-exclude`} className="cursor-pointer">
                                Exclude from merged menu
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                        
                        {/* Custom Merge Options */}
                        {decisions[group.groupId]?.action === 'custom' && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-3">
                            <div className="text-sm font-medium mb-2">Custom Merge Selection:</div>
                            
                            {/* Image Selection if both items have images */}
                            {group.items[0]?.imageURL && group.items[1]?.imageURL && (
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Image:</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {group.items.map((item, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        const customFields = decisions[group.groupId]?.customFields || {};
                                        handleDecisionChange(group.groupId, 'custom', {
                                          ...customFields,
                                          image: { source: `menu${idx + 1}`, value: item.imageURL }
                                        });
                                      }}
                                      className={cn(
                                        "relative rounded overflow-hidden border-2 transition-all",
                                        decisions[group.groupId]?.customFields?.image?.source === `menu${idx + 1}`
                                          ? "border-purple-600 ring-2 ring-purple-600/20"
                                          : "border-gray-200 hover:border-gray-300"
                                      )}
                                    >
                                      <img 
                                        src={item.imageURL} 
                                        alt={`Menu ${idx + 1}`}
                                        className="w-full h-20 object-cover"
                                      />
                                      {decisions[group.groupId]?.customFields?.image?.source === `menu${idx + 1}` && (
                                        <div className="absolute inset-0 bg-purple-600/10 flex items-center justify-center">
                                          <CheckCircle className="h-6 w-6 text-purple-600" />
                                        </div>
                                      )}
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
                                        Menu {idx + 1}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Other field selections */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs text-muted-foreground">Name from:</Label>
                                <select 
                                  className="w-full text-sm border rounded p-1"
                                  value={decisions[group.groupId]?.customFields?.name?.source || 'menu1'}
                                  onChange={(e) => {
                                    const customFields = decisions[group.groupId]?.customFields || {};
                                    const menuIndex = parseInt(e.target.value.replace('menu', '')) - 1;
                                    handleDecisionChange(group.groupId, 'custom', {
                                      ...customFields,
                                      name: { source: e.target.value, value: group.items[menuIndex]?.name }
                                    });
                                  }}
                                >
                                  <option value="menu1">Menu 1</option>
                                  <option value="menu2">Menu 2</option>
                                </select>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground">Price from:</Label>
                                <select 
                                  className="w-full text-sm border rounded p-1"
                                  value={decisions[group.groupId]?.customFields?.price?.source || 'menu1'}
                                  onChange={(e) => {
                                    const customFields = decisions[group.groupId]?.customFields || {};
                                    const menuIndex = parseInt(e.target.value.replace('menu', '')) - 1;
                                    handleDecisionChange(group.groupId, 'custom', {
                                      ...customFields,
                                      price: { source: e.target.value, value: group.items[menuIndex]?.price }
                                    });
                                  }}
                                >
                                  <option value="menu1">Menu 1 (${group.items[0]?.price})</option>
                                  <option value="menu2">Menu 2 (${group.items[1]?.price})</option>
                                </select>
                              </div>
                              
                              <div className="col-span-2">
                                <Label className="text-xs text-muted-foreground">Description from:</Label>
                                <select 
                                  className="w-full text-sm border rounded p-1"
                                  value={decisions[group.groupId]?.customFields?.description?.source || 'menu1'}
                                  onChange={(e) => {
                                    const customFields = decisions[group.groupId]?.customFields || {};
                                    const menuIndex = parseInt(e.target.value.replace('menu', '')) - 1;
                                    handleDecisionChange(group.groupId, 'custom', {
                                      ...customFields,
                                      description: { source: e.target.value, value: group.items[menuIndex]?.description }
                                    });
                                  }}
                                >
                                  <option value="menu1">Menu 1</option>
                                  <option value="menu2">Menu 2</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {group.suggestedResolution && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {group.similarity >= 0.99 ? (
                              <span className="text-green-600 font-medium">
                                ✓ Automatically set to keep Menu 1 (items are identical)
                              </span>
                            ) : (
                              <>Suggestion: {group.suggestedResolution.reason}</>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {/* Unique Items Tab */}
          <TabsContent value="unique" className="space-y-4">
            {Object.entries(comparison.comparison.uniqueItems).map(([menuId, items]) => {
              // Group items by category
              const itemsByCategory = items.reduce((acc, item) => {
                const category = item.categoryName || item.categories?.name || 'Uncategorized';
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
                return acc;
              }, {});
              
              // Function to toggle all items in a category
              const toggleCategory = (menuId, category, items) => {
                const currentIncluded = includeUnique[menuId] || [];
                const categoryItemIds = items.map(item => item.id);
                const allChecked = categoryItemIds.every(id => currentIncluded.includes(id));
                
                if (allChecked) {
                  // Deselect all items in this category
                  setIncludeUnique(prev => ({
                    ...prev,
                    [menuId]: currentIncluded.filter(id => !categoryItemIds.includes(id))
                  }));
                } else {
                  // Select all items in this category
                  const newIds = categoryItemIds.filter(id => !currentIncluded.includes(id));
                  setIncludeUnique(prev => ({
                    ...prev,
                    [menuId]: [...currentIncluded, ...newIds]
                  }));
                }
              };
              
              return (
                <Card key={menuId}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Menu {menuIds.indexOf(menuId) + 1} Unique Items
                    </CardTitle>
                    <CardDescription>
                      {items.length} items unique to this menu
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(itemsByCategory).map(([category, categoryItems]) => {
                        const currentIncluded = includeUnique[menuId] || [];
                        const categoryItemIds = categoryItems.map(item => item.id);
                        const allChecked = categoryItemIds.every(id => currentIncluded.includes(id));
                        const someChecked = categoryItemIds.some(id => currentIncluded.includes(id)) && !allChecked;
                        
                        return (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={allChecked}
                                  indeterminate={someChecked}
                                  onCheckedChange={() => toggleCategory(menuId, category, categoryItems)}
                                />
                                <span className="font-medium text-sm">{category}</span>
                                <span className="text-xs text-muted-foreground">({categoryItems.length} items)</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCategory(menuId, category, categoryItems)}
                              >
                                {allChecked ? 'Deselect All' : 'Select All'}
                              </Button>
                            </div>
                            <div className="pl-6 space-y-1">
                              {categoryItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={includeUnique[menuId]?.includes(item.id)}
                                      onCheckedChange={() => toggleUniqueItem(menuId, item.id)}
                                    />
                                    <div>
                                      <div className="text-sm font-medium">{item.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        ${item.price}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Merge Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded">
                      <div className="text-2xl font-bold text-purple-600">
                        {comparison.statistics.totalItems}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Items</div>
                    </div>
                    <div className="p-3 border rounded">
                      <div className="text-2xl font-bold text-orange-600">
                        {comparison.statistics.duplicates}
                      </div>
                      <div className="text-sm text-muted-foreground">Duplicate Groups</div>
                    </div>
                    <div className="p-3 border rounded">
                      <div className="text-2xl font-bold text-green-600">
                        {comparison.statistics.unique}
                      </div>
                      <div className="text-sm text-muted-foreground">Unique Items</div>
                    </div>
                    <div className="p-3 border rounded">
                      <div className="text-2xl font-bold text-blue-600">
                        {Object.values(decisions).filter(d => d.action !== 'exclude').length + 
                         Object.values(includeUnique).reduce((sum, items) => sum + items.length, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Items After Merge</div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-2">Resolution Decisions</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Keep Menu 1:</span>
                        <span>{Object.values(decisions).filter(d => d.action === 'keep_menu1').length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Keep Menu 2:</span>
                        <span>{Object.values(decisions).filter(d => d.action === 'keep_menu2').length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Keep Both:</span>
                        <span>{Object.values(decisions).filter(d => d.action === 'keep_both').length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Excluded:</span>
                        <span>{Object.values(decisions).filter(d => d.action === 'exclude').length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Save Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        setShowPreviewDialog(open);
        if (open) {
          setMergeSuccess(false); // Reset success state when dialog opens
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mergeSuccess ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Merge Successful!
                </div>
              ) : (
                'Save Merged Menu'
              )}
            </DialogTitle>
            <DialogDescription>
              {mergeSuccess 
                ? 'Your menu has been successfully merged. Redirecting...'
                : 'Review the merge summary and provide a name for the new menu'
              }
            </DialogDescription>
          </DialogHeader>
          
          {!mergeSuccess && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 border rounded">
                  <div className="text-2xl font-bold">{preview.preview.menu.itemCount}</div>
                  <div className="text-xs text-muted-foreground">Total Items</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-2xl font-bold">{preview.preview.changes.modified}</div>
                  <div className="text-xs text-muted-foreground">Modified</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-2xl font-bold">{preview.preview.changes.excluded}</div>
                  <div className="text-xs text-muted-foreground">Excluded</div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="menu-name">Menu Name</Label>
                <Input
                  id="menu-name"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder="Enter a name for the merged menu"
                  className="mt-1"
                  disabled={executing}
                />
              </div>
            </div>
          )}
          
          {mergeSuccess && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  {menuName || 'Merged Menu'} created successfully!
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Redirecting to your new menu...
                </p>
              </div>
            </div>
          )}
          
          {!mergeSuccess && (
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowPreviewDialog(false)}
                disabled={executing}
              >
                Cancel
              </Button>
              <Button 
                onClick={executeMerge} 
                disabled={executing || !menuName || mergeSuccess}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Merged Menu
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}