import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import OptionSetCard from './OptionSetCard';
import MenuItemAssociationDialog from './MenuItemAssociationDialog';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';

export default function OptionSetsManagement({ menuId, orgId }) {
  const [optionSets, setOptionSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedSets, setExpandedSets] = useState(new Set());
  const [newlyCreatedOptionSet, setNewlyCreatedOptionSet] = useState(null);
  const [showNewOptionSetDialog, setShowNewOptionSetDialog] = useState(false);
  const { toast } = useToast();

  // Load option sets for this menu
  useEffect(() => {
    loadOptionSets();
  }, [menuId, orgId]);

  const loadOptionSets = async () => {
    try {
      setLoading(true);

      // Get all unique option sets for this menu through the junction table
      const { data, error } = await supabase
        .from('menu_item_option_sets')
        .select(`
          option_set:option_sets!inner (
            *,
            option_set_items (*)
          ),
          menu_item:menu_items!inner (
            id,
            name,
            category:categories (
              name
            )
          )
        `)
        .eq('menu_item.menu_id', menuId)
        .eq('option_set.organisation_id', orgId);

      if (error) throw error;

      // Deduplicate option sets (same option set may be used by multiple items)
      const uniqueSets = new Map();
      const optionSetUsage = new Map(); // Track menu items for each option set

      data?.forEach(item => {
        if (item.option_set && item.menu_item) {
          const optionSetId = item.option_set.id;

          if (!uniqueSets.has(optionSetId)) {
            uniqueSets.set(optionSetId, item.option_set);
            optionSetUsage.set(optionSetId, {
              menuItems: []
            });
          }

          // Track menu item usage
          const usage = optionSetUsage.get(optionSetId);
          const categoryName = item.menu_item.category?.name || 'Uncategorized';
          usage.menuItems.push({
            id: item.menu_item.id,
            name: item.menu_item.name,
            category: categoryName
          });
        }
      });

      // Add usage information to each option set
      const optionSetsWithUsage = Array.from(uniqueSets.entries()).map(([id, optionSet]) => {
        const usage = optionSetUsage.get(id);
        return {
          ...optionSet,
          menuItems: usage?.menuItems || [],
          usageCount: usage?.menuItems.length || 0
        };
      });

      setOptionSets(optionSetsWithUsage);
    } catch (error) {
      console.error('Error loading option sets:', error);
      toast({
        title: "Error loading option sets",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newSet = {
      id: `new-${Date.now()}`,
      name: 'New Option Set',
      description: '',
      min_selections: 0,
      max_selections: 1,
      is_required: false,
      option_set_items: [],
      isNew: true,
      isEditing: true
    };
    
    setOptionSets([newSet, ...optionSets]);
    setExpandedSets(new Set([newSet.id]));
    setIsCreating(true);
  };

  const handleSave = async (optionSet) => {
    try {
      const { id, isNew, isEditing, usageCount, categories, option_set_items, ...saveData } = optionSet;
      
      if (isNew) {
        // Prepare option set data without items
        const optionSetData = {
          name: saveData.name,
          description: saveData.description,
          min_selections: saveData.min_selections,
          max_selections: saveData.max_selections,
          is_required: saveData.is_required || saveData.required || false,
          multiple_selections_allowed: saveData.multiple_selections_allowed || false,
          organisation_id: orgId,
          extraction_source: 'manual',
          option_set_hash: await generateHash({ ...saveData, option_set_items })
        };
        
        // Create new option set
        const { data: newSet, error: setError } = await supabase
          .from('option_sets')
          .insert(optionSetData)
          .select()
          .single();

        if (setError) throw setError;

        // Create option set items
        if (option_set_items?.length > 0) {
          const { error: itemsError } = await supabase
            .from('option_set_items')
            .insert(
              option_set_items.map((item, index) => ({
                name: item.name,
                price: item.price || 0,
                description: item.description,
                is_default: item.is_default || false,
                option_set_id: newSet.id,
                display_order: index,
                organisation_id: orgId
              }))
            );

          if (itemsError) throw itemsError;
        }

        // Store the newly created option set and show the association dialog
        setNewlyCreatedOptionSet(newSet);
        setShowNewOptionSetDialog(true);
        setIsCreating(false);

        // Remove the temporary new item from the list
        setOptionSets(prev => prev.filter(os => !os.isNew));

        toast({
          title: "Option set created",
          description: `Now assign "${newSet.name}" to menu items`
        });

        // Don't reload yet - wait for user to assign menu items
        return;
      } else {
        // Update existing option set
        const { error: setError } = await supabase
          .from('option_sets')
          .update({
            name: saveData.name,
            description: saveData.description,
            min_selections: saveData.min_selections,
            max_selections: saveData.max_selections,
            is_required: saveData.is_required || saveData.required || false,
            multiple_selections_allowed: saveData.multiple_selections_allowed || false,
            option_set_hash: await generateHash({ ...saveData, option_set_items })
          })
          .eq('id', id);

        if (setError) throw setError;

        // Update option set items (delete and recreate for simplicity)
        await supabase
          .from('option_set_items')
          .delete()
          .eq('option_set_id', id);

        if (option_set_items?.length > 0) {
          const { error: itemsError } = await supabase
            .from('option_set_items')
            .insert(
              option_set_items.map((item, index) => ({
                name: item.name,
                price: item.price || 0,
                description: item.description,
                is_default: item.is_default || false,
                option_set_id: id,
                display_order: index,
                organisation_id: orgId
              }))
            );

          if (itemsError) throw itemsError;
        }

        toast({
          title: "Option set updated",
          description: `"${saveData.name}" has been updated successfully`
        });
      }

      setIsCreating(false);
      await loadOptionSets();
    } catch (error) {
      console.error('Error saving option set:', error);
      toast({
        title: "Error saving option set",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (optionSetId) => {
    try {
      // First check if this option set is in use
      const { data: usage, error: usageError } = await supabase
        .from('menu_item_option_sets')
        .select('id')
        .eq('option_set_id', optionSetId)
        .limit(1);

      if (usageError) throw usageError;

      if (usage && usage.length > 0) {
        toast({
          title: "Cannot delete option set",
          description: "This option set is currently in use by menu items. Remove it from all items before deleting.",
          variant: "destructive"
        });
        return;
      }

      // Delete option set items first
      await supabase
        .from('option_set_items')
        .delete()
        .eq('option_set_id', optionSetId);

      // Then delete the option set
      const { error } = await supabase
        .from('option_sets')
        .delete()
        .eq('id', optionSetId);

      if (error) throw error;

      toast({
        title: "Option set deleted",
        description: "The option set has been removed successfully"
      });

      await loadOptionSets();
    } catch (error) {
      console.error('Error deleting option set:', error);
      toast({
        title: "Error deleting option set",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCancel = (optionSetId) => {
    if (optionSetId.startsWith('new-')) {
      // Remove new unsaved option set
      setOptionSets(optionSets.filter(os => os.id !== optionSetId));
      setIsCreating(false);
    } else {
      // Reload to revert changes
      loadOptionSets();
    }
  };

  const toggleExpanded = (optionSetId) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(optionSetId)) {
        newSet.delete(optionSetId);
      } else {
        newSet.add(optionSetId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = new Set(filteredSets.map(os => os.id));
    setExpandedSets(allIds);
  };

  const collapseAll = () => {
    setExpandedSets(new Set());
  };

  const generateHash = async (optionSet) => {
    // Simple hash generation for manual option sets using Web Crypto API
    const normalized = {
      name: optionSet.name,
      items: (optionSet.option_set_items || []).map(item => ({
        name: item.name,
        price: item.price
      })).sort((a, b) => a.name.localeCompare(b.name))
    };
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(normalized));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  // Get unique categories for filter
  const allCategories = [...new Set(
    optionSets.flatMap(os => os.categories || [])
  )].sort();

  // Filter option sets
  const filteredSets = optionSets.filter(os => {
    const matchesSearch = !searchTerm || 
      os.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || 
      os.categories?.includes(filterCategory);
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading option sets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search option sets..."
            className="pl-9"
          />
        </div>
        {allCategories.length > 0 && (
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center justify-between">
          <Button
            onClick={handleCreateNew}
            disabled={isCreating}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Option Set
          </Button>
        </div>
      </div>

      {/* Stats and Controls */}
      <div className="flex justify-between items-center">
                
      {filteredSets.length > 0 && (
          <Button
            onClick={() => {
              const allExpanded = filteredSets.every(os => expandedSets.has(os.id));
              if (allExpanded) {
                collapseAll();
              } else {
                expandAll();
              }
            }}
            variant="outline"
            size="sm"
          >
            {filteredSets.every(os => expandedSets.has(os.id)) ? (
              <>
                <Minimize2 className="h-4 w-4 mr-2" />
                Collapse All
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 mr-2" />
                Expand All
              </>
            )}
          </Button>
        )}
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{filteredSets.length} option set{filteredSets.length !== 1 ? 's' : ''}</span>
          {filteredSets.length > 0 && (
            <>
              <span>•</span>
              <span>
                {filteredSets.reduce((acc, os) => acc + (os.usageCount || 0), 0)} total usage
                {filteredSets.reduce((acc, os) => acc + (os.usageCount || 0), 0) !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Option Sets List */}
      {filteredSets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {searchTerm || filterCategory !== 'all' 
              ? 'No option sets found matching your filters'
              : 'No option sets created yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSets.map(optionSet => (
            <OptionSetCard
              key={optionSet.id}
              optionSet={optionSet}
              isExpanded={expandedSets.has(optionSet.id)}
              onToggleExpanded={() => toggleExpanded(optionSet.id)}
              onSave={handleSave}
              onDelete={() => handleDelete(optionSet.id)}
              onCancel={() => handleCancel(optionSet.id)}
              menuId={menuId}
              orgId={orgId}
              onAssociationsUpdated={loadOptionSets}
            />
          ))}
        </div>
      )}

      {/* Dialog for assigning menu items to newly created option set */}
      {newlyCreatedOptionSet && (
        <MenuItemAssociationDialog
          open={showNewOptionSetDialog}
          onOpenChange={(open) => {
            if (!open) {
              // User closed the dialog - reload the list
              setShowNewOptionSetDialog(false);
              setNewlyCreatedOptionSet(null);
              loadOptionSets();
            }
          }}
          optionSet={newlyCreatedOptionSet}
          menuId={menuId}
          orgId={orgId}
          onAssociationsUpdated={() => {
            setShowNewOptionSetDialog(false);
            setNewlyCreatedOptionSet(null);
            loadOptionSets();
          }}
        />
      )}
    </div>
  );
}