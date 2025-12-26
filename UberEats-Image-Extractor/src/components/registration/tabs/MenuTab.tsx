import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { AlertCircle, FileSpreadsheet, Calendar, Utensils } from 'lucide-react';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import type { YoloModeFormData, Restaurant } from '../YoloModeDialog';

interface MenuTabProps {
  formData: YoloModeFormData;
  updateFormData: <S extends keyof YoloModeFormData, K extends keyof YoloModeFormData[S]>(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => void;
  restaurant: Restaurant;
}

// Get platform display name and badge color
function getPlatformInfo(menu: Restaurant['menus'][0]): { name: string; variant: 'default' | 'secondary' | 'outline' } {
  // Check multiple possible fields for platform info
  // Priority: platforms.name (from Supabase join) > platform > source_url > name
  const platformsName = menu.platforms?.name?.toLowerCase() || '';
  const platform = menu.platform?.toLowerCase() || '';
  const sourceUrl = menu.source_url?.toLowerCase() || '';
  const menuName = menu.name?.toLowerCase() || '';

  // Combine all sources to check
  const allText = `${platformsName} ${platform} ${sourceUrl} ${menuName}`;

  if (allText.includes('uber') || allText.includes('ubereats')) {
    return { name: 'UberEats', variant: 'default' };
  }
  if (allText.includes('door') || allText.includes('doordash')) {
    return { name: 'DoorDash', variant: 'secondary' };
  }
  if (allText.includes('menulog')) {
    return { name: 'Menulog', variant: 'outline' };
  }
  if (allText.includes('grubhub')) {
    return { name: 'Grubhub', variant: 'outline' };
  }
  // Return the actual platform name if available
  if (menu.platforms?.name) {
    return { name: menu.platforms.name, variant: 'outline' };
  }
  if (menu.platform) {
    return { name: menu.platform, variant: 'outline' };
  }
  return { name: 'Extracted', variant: 'outline' };
}

// Format date for display
function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Build display label for menu
function getMenuDisplayLabel(menu: Restaurant['menus'][0]): string {
  const parts: string[] = [];

  // Add version if available
  if (menu.version) {
    parts.push(`v${menu.version}`);
  }

  // Add platform
  const { name: platformName } = getPlatformInfo(menu);
  parts.push(platformName);

  // Add item count if available
  if (menu.item_count) {
    parts.push(`${menu.item_count} items`);
  }

  // Add date if available
  const dateStr = formatDate(menu.created_at);
  if (dateStr) {
    parts.push(dateStr);
  }

  return parts.join(' • ') || menu.name || `Menu ${menu.id.slice(0, 8)}`;
}

export function MenuTab({ formData, updateFormData, restaurant }: MenuTabProps) {
  const menus = restaurant.menus || [];
  const hasMenus = menus.length > 0;

  // Get the selected menu details
  const selectedMenu = useMemo(() => {
    if (!formData.menu.selectedMenuId) return null;
    return menus.find(m => m.id === formData.menu.selectedMenuId) || null;
  }, [formData.menu.selectedMenuId, menus]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Menu Selection</CardTitle>
          <CardDescription>
            Select a menu to import and configure additional options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasMenus ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No menus available for this restaurant. Extract a menu first before running Yolo Mode.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="menu-select">Menu to Import</Label>
                <Select
                  value={formData.menu.selectedMenuId}
                  onValueChange={(value) => updateFormData('menu', 'selectedMenuId', value)}
                >
                  <SelectTrigger id="menu-select">
                    <SelectValue placeholder="Select a menu..." />
                  </SelectTrigger>
                  <SelectContent>
                    {menus.map((menu) => {
                      const { name: platformName, variant } = getPlatformInfo(menu);
                      return (
                        <SelectItem key={menu.id} value={menu.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant={variant} className="text-xs">
                              {platformName}
                            </Badge>
                            <span>
                              {menu.version ? `v${menu.version}` : menu.name || menu.id.slice(0, 8)}
                            </span>
                            {menu.item_count && (
                              <span className="text-muted-foreground text-xs">
                                ({menu.item_count} items)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected menu details */}
              {selectedMenu && (
                <div className="bg-muted/30 rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Selected Menu Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Platform:</span>
                      <Badge variant={getPlatformInfo(selectedMenu).variant}>
                        {getPlatformInfo(selectedMenu).name}
                      </Badge>
                    </div>
                    {selectedMenu.version && (
                      <div>
                        <span className="text-muted-foreground">Version:</span>{' '}
                        <span>v{selectedMenu.version}</span>
                      </div>
                    )}
                    {selectedMenu.item_count && (
                      <div className="flex items-center gap-1">
                        <Utensils className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedMenu.item_count} items</span>
                      </div>
                    )}
                    {selectedMenu.created_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{formatDate(selectedMenu.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="upload-images"
                    checked={formData.menu.uploadImages}
                    onCheckedChange={(checked) =>
                      updateFormData('menu', 'uploadImages', checked as boolean)
                    }
                  />
                  <div>
                    <Label htmlFor="upload-images" className="cursor-pointer">
                      Upload Images to CDN
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Upload menu item images before importing the menu
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="add-option-sets"
                    checked={formData.menu.addOptionSets}
                    onCheckedChange={(checked) =>
                      updateFormData('menu', 'addOptionSets', checked as boolean)
                    }
                  />
                  <div>
                    <Label htmlFor="add-option-sets" className="cursor-pointer">
                      Add Option Sets
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Create option sets from extracted modifier data
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="add-item-tags"
                    checked={formData.menu.addItemTags}
                    onCheckedChange={(checked) =>
                      updateFormData('menu', 'addItemTags', checked as boolean)
                    }
                  />
                  <div>
                    <Label htmlFor="add-item-tags" className="cursor-pointer">
                      Add Item Tags
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Apply dietary and category tags to menu items
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
