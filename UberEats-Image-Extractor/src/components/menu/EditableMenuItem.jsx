import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { X, Plus } from 'lucide-react';

export default function EditableMenuItem({ 
  item, 
  isEditMode, 
  onUpdate, 
  validationErrors = {} 
}) {
  const [editedItem, setEditedItem] = useState(item);
  const [newTag, setNewTag] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Reset when item changes or edit mode changes
  useEffect(() => {
    setEditedItem(item);
    setHasChanges(false);
  }, [item, isEditMode]);

  // Track changes
  useEffect(() => {
    const changed = 
      editedItem.name !== item.name ||
      editedItem.price !== item.price ||
      editedItem.description !== item.description ||
      JSON.stringify(editedItem.tags || []) !== JSON.stringify(item.tags || []);
    setHasChanges(changed);
  }, [editedItem, item]);

  const handleFieldChange = (field, value) => {
    const updated = { ...editedItem, [field]: value };
    setEditedItem(updated);
    onUpdate(item.id, updated);
  };

  const handlePriceChange = (value) => {
    // Allow only numbers and decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    const formattedValue = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : cleanValue;
    
    // Convert to number for storage
    const numericValue = parseFloat(formattedValue) || 0;
    handleFieldChange('price', numericValue);
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const currentTags = editedItem.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        handleFieldChange('tags', [...currentTags, newTag.trim()]);
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const currentTags = editedItem.tags || [];
    handleFieldChange('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isEditMode) {
    // View mode - original display
    return (
      <div className="border rounded-lg p-4">
        <div className="flex">
          {item.imageURL && (
            <img
              src={item.imageURL}
              alt={item.name}
              className="h-24 w-24 rounded-lg object-cover mr-4"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <div className="flex-1">
            <div className="flex justify-between">
              <h5 className="text-base font-medium text-gray-900">
                {item.name}
              </h5>
              <span className="text-base font-medium text-gray-900">
                ${(item.price || 0).toFixed(2)}
              </span>
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-gray-500">
                {item.description}
              </p>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag, tagIndex) => (
                  <Badge
                    key={tagIndex}
                    variant="secondary"
                    className="text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className={`border rounded-lg p-4 ${hasChanges ? 'border-blue-500 bg-blue-50/50' : ''}`}>
      <div className="flex">
        {item.imageURL && (
          <img
            src={item.imageURL}
            alt={editedItem.name}
            className="h-24 w-24 rounded-lg object-cover mr-4"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 space-y-3">
          {/* Name and Price */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                value={editedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Item name"
                className={validationErrors.name ? 'border-red-500' : ''}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>
              )}
            </div>
            <div className="w-32">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  value={editedItem.price || ''}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="0.00"
                  className={`pl-7 ${validationErrors.price ? 'border-red-500' : ''}`}
                />
              </div>
              {validationErrors.price && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.price}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Textarea
              value={editedItem.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Item description (optional)"
              rows={2}
              className={`resize-none ${validationErrors.description ? 'border-red-500' : ''}`}
            />
            {validationErrors.description && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.description}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {(editedItem.tags || []).map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs gap-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add tag (e.g., Vegetarian, Spicy)"
                className="flex-1"
              />
              <Button
                onClick={handleAddTag}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Change indicator */}
          {hasChanges && (
            <p className="text-xs text-blue-600 font-medium">Item has unsaved changes</p>
          )}
        </div>
      </div>
    </div>
  );
}