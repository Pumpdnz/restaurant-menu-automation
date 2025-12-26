import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Edit2,
  Trash2,
  Save,
  X,
  Plus,
  GripVertical,
  Check,
  Copy,
  Settings
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Collapsible,
  CollapsibleContent,
} from '../ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { cn } from '../../lib/utils';
import MenuItemAssociationDialog from './MenuItemAssociationDialog';

export default function OptionSetCard({ 
  optionSet, 
  isExpanded, 
  onToggleExpanded, 
  onSave, 
  onDelete,
  onCancel,
  menuId,
  orgId,
  onAssociationsUpdated
}) {
  const [isEditing, setIsEditing] = useState(optionSet.isEditing || false);
  const [editedSet, setEditedSet] = useState(optionSet);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAssociationDialog, setShowAssociationDialog] = useState(false);

  useEffect(() => {
    setEditedSet(optionSet);
    setIsEditing(optionSet.isEditing || false);
  }, [optionSet]);

  useEffect(() => {
    // Check if there are unsaved changes
    const changed = JSON.stringify(editedSet) !== JSON.stringify(optionSet);
    setHasChanges(changed);
  }, [editedSet, optionSet]);

  const handleFieldChange = (field, value) => {
    setEditedSet(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (itemIndex, field, value) => {
    const updatedItems = [...(editedSet.option_set_items || [])];
    
    // If setting an item as default, unset all other defaults
    if (field === 'is_default' && value === true) {
      updatedItems.forEach((item, idx) => {
        if (idx !== itemIndex) {
          item.is_default = false;
        }
      });
    }
    
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      [field]: value
    };
    setEditedSet(prev => ({ ...prev, option_set_items: updatedItems }));
  };

  const addItem = () => {
    const newItem = {
      name: '',
      price: 0,
      description: '',
      is_default: false
    };
    setEditedSet(prev => ({
      ...prev,
      option_set_items: [...(prev.option_set_items || []), newItem]
    }));
  };

  const removeItem = (itemIndex) => {
    const updatedItems = (editedSet.option_set_items || []).filter((_, i) => i !== itemIndex);
    setEditedSet(prev => ({ ...prev, option_set_items: updatedItems }));
  };

  const handleSave = () => {
    // Ensure we use the correct field name for the backend
    const saveData = { ...editedSet };
    if ('required' in saveData && !('is_required' in saveData)) {
      saveData.is_required = saveData.required;
      delete saveData.required;
    }
    onSave(saveData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (optionSet.isNew) {
      onCancel();
    } else {
      setEditedSet(optionSet);
      setIsEditing(false);
    }
  };

  const handleDuplicate = () => {
    const duplicated = {
      ...optionSet,
      id: `new-${Date.now()}`,
      name: `${optionSet.name} (Copy)`,
      isNew: true,
      isEditing: true,
      option_set_items: optionSet.option_set_items?.map(item => ({ ...item, id: undefined }))
    };
    // This would need to be handled by parent component
    console.log('Duplicate option set:', duplicated);
  };

  return (
    <Card className={`${hasChanges ? 'border-blue-500' : ''} ${isEditing ? 'bg-blue-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div 
            className={`flex-1 ${!isEditing ? 'cursor-pointer' : ''}`}
            onClick={!isEditing ? onToggleExpanded : undefined}
          >
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editedSet.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Option set name"
                  className="text-lg font-semibold"
                />
                <Textarea
                  value={editedSet.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="text-sm"
                />
              </div>
            ) : (
              <>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                  {editedSet.name}
                  {editedSet.is_shared && (
                    <Badge variant="outline" className="ml-2">Shared</Badge>
                  )}
                </CardTitle>
                {editedSet.description && (
                  <CardDescription className="ml-7 mt-1">
                    {editedSet.description}
                  </CardDescription>
                )}
              </>
            )}
          </div>

          <div 
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stats badges */}
            {!isEditing && (
              <>
                <Badge variant="secondary">
                  {editedSet.option_set_items?.length || 0} options
                </Badge>
                {editedSet.usageCount > 0 && (
                  <Badge variant="outline">
                    Used {editedSet.usageCount}x
                  </Badge>
                )}
              </>
            )}

            {/* Action buttons */}
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  size="sm"
                  disabled={!hasChanges}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      disabled={editedSet.usageCount > 0}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Option Set?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{editedSet.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Selection rules (only in edit mode or expanded view) */}
        <Collapsible open={isEditing || isExpanded}>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
            <div className="mt-4 flex gap-4 items-center border-t pt-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Min selections:</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedSet.min_selections || 0}
                    onChange={(e) => handleFieldChange('min_selections', parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                ) : (
                  <span className="font-medium">{editedSet.min_selections || 0}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs">Max selections:</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    min="1"
                    value={editedSet.max_selections || ''}
                    onChange={(e) => handleFieldChange('max_selections', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="∞"
                    className="w-20"
                  />
                ) : (
                  <span className="font-medium">
                    {editedSet.max_selections || '∞'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Checkbox
                      id={`required-${editedSet.id}`}
                      checked={editedSet.is_required || editedSet.required}
                      onCheckedChange={(checked) => handleFieldChange('is_required', checked)}
                    />
                    <Label
                      htmlFor={`required-${editedSet.id}`}
                      className="text-xs cursor-pointer"
                    >
                      Required
                    </Label>
                  </>
                ) : (
                  (editedSet.is_required || editedSet.required) && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Checkbox
                      id={`multiple-${editedSet.id}`}
                      checked={editedSet.multiple_selections_allowed}
                      onCheckedChange={(checked) => handleFieldChange('multiple_selections_allowed', checked)}
                    />
                    <Label
                      htmlFor={`multiple-${editedSet.id}`}
                      className="text-xs cursor-pointer"
                    >
                      Allow Multiple
                    </Label>
                  </>
                ) : (
                  editedSet.multiple_selections_allowed && (
                    <Badge variant="secondary" className="text-xs">Multiple</Badge>
                  )
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>

      {/* Options list (only when expanded) */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Options</Label>
                {isEditing && (
                  <Button
                    onClick={addItem}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                )}
              </div>

              {(!editedSet.option_set_items || editedSet.option_set_items.length === 0) ? (
                <p className="text-sm text-gray-500 italic py-4 text-center">
                  No options defined
                </p>
              ) : (
                <div className="space-y-2">
                  {editedSet.option_set_items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded border ${
                        isEditing ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox
                              checked={item.is_default}
                              onCheckedChange={(checked) => handleItemChange(index, 'is_default', checked)}
                              title="Set as default option"
                            />
                            <span className="text-xs text-gray-500">Default</span>
                          </div>
                          <Input
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="Option name"
                            className="flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-sm">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price || ''}
                              onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-24"
                            />
                          </div>
                          <Button
                            onClick={() => removeItem(index)}
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="h-5 w-5 rounded border flex items-center justify-center">
                            {item.is_default && (
                              <Check className="h-3 w-3 text-green-600" />
                            )}
                          </div>
                          <span className="flex-1">{item.name}</span>
                          {item.price > 0 && (
                            <span className="font-medium">
                              +${item.price.toFixed(2)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Menu items using this option set */}
            {!isEditing && editedSet.menuItems && editedSet.menuItems.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Applied to Menu Items</Label>
                  <Button
                    onClick={() => setShowAssociationDialog(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Manage Items
                  </Button>
                </div>
                <div className="space-y-2">
                  {editedSet.menuItems.map((item, index) => (
                    <div key={item.id || index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{item.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </div>
                      {isEditing && (
                        <Button
                          onClick={() => console.log('Remove association', item.id)}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Menu Item Association Dialog */}
      <MenuItemAssociationDialog
        open={showAssociationDialog}
        onOpenChange={setShowAssociationDialog}
        optionSet={editedSet}
        menuId={menuId}
        orgId={orgId}
        onAssociationsUpdated={() => {
          onAssociationsUpdated();
          setShowAssociationDialog(false);
        }}
      />
    </Card>
  );
}