import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';

export default function MenuItemAssociationDialog({
  open,
  onOpenChange,
  optionSet,
  menuId,
  orgId,
  onAssociationsUpdated
}) {
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && menuId && optionSet) {
      loadMenuItems();
    }
  }, [open, menuId, optionSet]);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      
      // Get all menu items for this menu
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select(`
          id,
          name,
          category:categories (
            id,
            name
          )
        `)
        .eq('menu_id', menuId)
        .order('category_id', { ascending: true });

      if (itemsError) throw itemsError;

      // Get existing associations for this option set
      const { data: associations, error: assocError } = await supabase
        .from('menu_item_option_sets')
        .select('menu_item_id')
        .eq('option_set_id', optionSet.id);

      if (assocError) throw assocError;

      // Set selected items based on existing associations
      const associatedIds = new Set(associations?.map(a => a.menu_item_id) || []);
      setSelectedItems(associatedIds);

      // Group items by category
      const grouped = {};
      items?.forEach(item => {
        const categoryName = item.category?.name || 'Uncategorized';
        if (!grouped[categoryName]) {
          grouped[categoryName] = [];
        }
        grouped[categoryName].push(item);
      });

      setMenuItems(grouped);
    } catch (error) {
      console.error('Error loading menu items:', error);
      toast({
        title: "Error loading menu items",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleToggleCategory = (categoryItems) => {
    const categoryIds = categoryItems.map(item => item.id);
    const allSelected = categoryIds.every(id => selectedItems.has(id));
    
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      categoryIds.forEach(id => {
        if (allSelected) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      });
      return newSet;
    });
  };

  const handleSave = async () => {
    // Validate at least one menu item is selected
    if (selectedItems.size === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one menu item to assign this option set to.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      // Get current associations
      const { data: currentAssocs, error: fetchError } = await supabase
        .from('menu_item_option_sets')
        .select('menu_item_id, id')
        .eq('option_set_id', optionSet.id);

      if (fetchError) throw fetchError;

      const currentIds = new Set(currentAssocs?.map(a => a.menu_item_id) || []);
      
      // Find items to add and remove
      const toAdd = Array.from(selectedItems).filter(id => !currentIds.has(id));
      const toRemove = currentAssocs?.filter(a => !selectedItems.has(a.menu_item_id)) || [];

      // Remove associations
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('menu_item_option_sets')
          .delete()
          .in('id', toRemove.map(a => a.id));

        if (deleteError) throw deleteError;
      }

      // Add new associations
      if (toAdd.length > 0) {
        // Get the max display order for each menu item
        const { data: maxOrders, error: orderError } = await supabase
          .from('menu_item_option_sets')
          .select('menu_item_id, display_order')
          .in('menu_item_id', toAdd);

        if (orderError) throw orderError;

        const orderMap = {};
        maxOrders?.forEach(item => {
          orderMap[item.menu_item_id] = Math.max(
            orderMap[item.menu_item_id] || 0,
            item.display_order || 0
          );
        });

        const newAssociations = toAdd.map(menuItemId => ({
          menu_item_id: menuItemId,
          option_set_id: optionSet.id,
          display_order: (orderMap[menuItemId] || 0) + 1,
          organisation_id: orgId
        }));

        const { error: insertError } = await supabase
          .from('menu_item_option_sets')
          .insert(newAssociations);

        if (insertError) throw insertError;
      }

      toast({
        title: "Associations updated",
        description: `Updated menu items for "${optionSet.name}"`
      });

      onAssociationsUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating associations:', error);
      toast({
        title: "Error updating associations",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter items based on search term
  const filterItems = (items) => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Menu Item Associations</DialogTitle>
          <DialogDescription>
            Select which menu items should have the "{optionSet?.name}" option set
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search menu items..."
              className="pl-9"
            />
          </div>

          {/* Selected count */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-600">
              {selectedItems.size} items selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => setSelectedItems(new Set())}
                variant="outline"
                size="sm"
              >
                Clear All
              </Button>
              <Button
                onClick={() => {
                  const allIds = new Set();
                  Object.values(menuItems).forEach(items => {
                    items.forEach(item => allIds.add(item.id));
                  });
                  setSelectedItems(allIds);
                }}
                variant="outline"
                size="sm"
              >
                Select All
              </Button>
            </div>
          </div>

          {/* Menu items grouped by category */}
          <ScrollArea className="h-[400px] border rounded-lg p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading menu items...
              </div>
            ) : Object.keys(menuItems).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No menu items found
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(menuItems).map(([category, items]) => {
                  const filteredItems = filterItems(items);
                  if (filteredItems.length === 0) return null;
                  
                  const categorySelected = filteredItems.every(item => 
                    selectedItems.has(item.id)
                  );
                  
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Checkbox
                          checked={categorySelected}
                          onCheckedChange={() => handleToggleCategory(filteredItems)}
                        />
                        <Label className="text-sm font-medium cursor-pointer">
                          {category}
                        </Label>
                        <Badge variant="secondary" className="text-xs">
                          {filteredItems.length} items
                        </Badge>
                      </div>
                      
                      <div className="pl-6 space-y-1">
                        {filteredItems.map(item => (
                          <div key={item.id} className="flex items-center gap-2 py-1">
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => handleToggleItem(item.id)}
                            />
                            <Label
                              htmlFor={item.id}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {item.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || selectedItems.size === 0}
          >
            {saving ? 'Saving...' : selectedItems.size === 0 ? 'Select Items to Save' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}