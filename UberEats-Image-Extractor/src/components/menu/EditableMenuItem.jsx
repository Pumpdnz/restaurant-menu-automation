import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { X, Plus, Trash2, ImagePlus, Link } from 'lucide-react';
import { cn } from '../../lib/utils';
import OptionSetsDisplay from './OptionSetsDisplay';
import PresetTagsPopover from './PresetTagsPopover';
import CommonImagesPopover from './CommonImagesPopover';
import { isPresetTag, getTagStyle } from '../../lib/item-tags-constants';

// Simple URL validation for images
const validateImageUrl = (url) => {
  if (!url || !url.trim()) {
    return { isValid: false, error: 'Please enter a URL' };
  }

  // Basic URL format check
  try {
    new URL(url);
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }

  // Check for common image extensions or known CDN patterns
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i,
    /tb-static\.uber\.com/i,
    /img\.cdn4dd\.com/i,
    /cloudinary\.com/i,
    /imgur\.com/i,
    /unsplash\.com/i,
    /cdn.*\.firecrawl\.dev/i,
  ];

  const looksLikeImage = imagePatterns.some(pattern => pattern.test(url));

  // Reject obvious non-image URLs
  const invalidPatterns = [
    /\.(html|htm|php|asp|aspx)(\?|$)/i,
    /placeholder/i,
    /no-image/i,
    /default-image/i,
  ];

  const looksInvalid = invalidPatterns.some(pattern => pattern.test(url));

  if (looksInvalid) {
    return { isValid: false, error: 'This URL appears to be a placeholder or non-image' };
  }

  // Warn but allow if doesn't look like a typical image URL
  if (!looksLikeImage) {
    return { isValid: true, warning: 'URL may not be an image - verify it loads correctly' };
  }

  return { isValid: true };
};

export default function EditableMenuItem({
  item,
  isEditMode,
  onUpdate,
  onDelete,
  validationErrors = {}
}) {
  const [editedItem, setEditedItem] = useState(item);
  const [newTag, setNewTag] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');

  // Reset when item changes or edit mode changes
  useEffect(() => {
    setEditedItem(item);
    setHasChanges(false);
    setNewImageUrl('');
    setImageUrlError('');
  }, [item, isEditMode]);

  // Track changes
  useEffect(() => {
    const changed = 
      editedItem.name !== item.name ||
      editedItem.price !== item.price ||
      editedItem.description !== item.description ||
      JSON.stringify(editedItem.tags || []) !== JSON.stringify(item.tags || []) ||
      editedItem.imageURL !== item.imageURL;
    setHasChanges(changed);
  }, [editedItem, item]);

  const handleFieldChange = (field, value) => {
    const updated = { ...editedItem, [field]: value };
    console.log(`[EditableMenuItem] Field change: ${field} =`, value);
    console.log('[EditableMenuItem] Updated item to be sent:', updated);
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

  const handleToggleTag = (tag) => {
    const currentTags = editedItem.tags || [];
    if (currentTags.includes(tag)) {
      handleFieldChange('tags', currentTags.filter(t => t !== tag));
    } else {
      handleFieldChange('tags', [...currentTags, tag]);
    }
  };

  const handleRemoveImage = () => {
    handleFieldChange('imageURL', null);
  };

  const handleAddImage = () => {
    const validation = validateImageUrl(newImageUrl);

    if (!validation.isValid) {
      setImageUrlError(validation.error);
      return;
    }

    // Clear any previous error and add the image
    setImageUrlError('');
    const trimmedUrl = newImageUrl.trim();
    console.log('[EditableMenuItem] Adding image URL:', trimmedUrl);
    console.log('[EditableMenuItem] Current editedItem before update:', editedItem);
    handleFieldChange('imageURL', trimmedUrl);
    setNewImageUrl('');
  };

  const handleImageUrlKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddImage();
    }
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
                {item.tags.map((tag, tagIndex) => {
                  const tagStyle = getTagStyle(tag);
                  const badgeStyle = tagStyle ? {
                    background: tagStyle.gradient,
                    borderColor: tagStyle.borderColor,
                    boxShadow: `0 2px 8px ${tagStyle.shadowColor}`,
                    color: 'white',
                  } : {};

                  return (
                    <span
                      key={tagIndex}
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border",
                        !tagStyle && "bg-secondary text-secondary-foreground"
                      )}
                      style={tagStyle ? badgeStyle : {}}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {item.optionSets && item.optionSets.length > 0 && (
          <OptionSetsDisplay optionSets={item.optionSets} />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className={`border rounded-lg p-4 ${hasChanges ? 'border-blue-500 bg-blue-50/50' : ''} relative group`}>
      {onDelete && (
        <Button
          onClick={onDelete}
          size="sm"
          variant="destructive"
          className="absolute bottom-2 left-2 h-8 w-8 p-0 z-10"
          title="Delete item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <div className="flex">
        {editedItem.imageURL && (
          <div className="relative mr-4">
            <img
              src={editedItem.imageURL}
              alt={editedItem.name}
              className="h-24 w-24 rounded-lg object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Button
              onClick={handleRemoveImage}
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!editedItem.imageURL && (
          <div className="mr-4 flex flex-col gap-2">
            {/* Image placeholder or "removed" indicator */}
            <div className="h-24 w-24 rounded-lg bg-gray-100 flex flex-col items-center justify-center text-gray-400 text-xs text-center p-2 border-2 border-dashed border-gray-300">
              <ImagePlus className="h-6 w-6 mb-1" />
              {item.imageURL ? 'Removed' : 'No image'}
            </div>
            {/* Add image URL input */}
            <div className="w-48 space-y-1">
              <div className="flex gap-1">
                <Input
                  value={newImageUrl}
                  onChange={(e) => {
                    setNewImageUrl(e.target.value);
                    setImageUrlError('');
                  }}
                  onKeyPress={handleImageUrlKeyPress}
                  placeholder="Paste image URL..."
                  className={cn("h-8 text-xs", imageUrlError && "border-red-500")}
                />
                <Button
                  onClick={handleAddImage}
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  disabled={!newImageUrl.trim()}
                  title="Add image"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {imageUrlError && (
                <p className="text-xs text-red-500">{imageUrlError}</p>
              )}
              {/* Common Images Popover */}
              <CommonImagesPopover
                onSelectImage={(imageUrl, imageName) => {
                  console.log('[EditableMenuItem] Selected common image:', imageName, imageUrl);
                  handleFieldChange('imageURL', imageUrl);
                }}
                selectedImageUrl={editedItem.imageURL}
              />
            </div>
          </div>
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
            {/* Selected Tags Display */}
            <div className="flex flex-wrap gap-1 mb-2">
              {(editedItem.tags || []).map((tag, index) => {
                const tagStyle = getTagStyle(tag);
                const badgeStyle = tagStyle ? {
                  background: tagStyle.gradient,
                  borderColor: tagStyle.borderColor,
                  boxShadow: `0 2px 8px ${tagStyle.shadowColor}`,
                  color: 'white',
                } : {};

                return (
                  <span
                    key={index}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border",
                      !tagStyle && "bg-secondary text-secondary-foreground"
                    )}
                    style={tagStyle ? badgeStyle : {}}
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 rounded-full hover:bg-black/20 p-0.5"
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            {/* Tag Input Row */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add custom tag..."
                className="flex-1"
              />
              <Button
                onClick={handleAddTag}
                size="sm"
                variant="outline"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <PresetTagsPopover
                selectedTags={editedItem.tags || []}
                onToggleTag={handleToggleTag}
              />
            </div>
          </div>

          {/* Change indicator */}
          {hasChanges && (
            <p className="text-xs text-blue-600 font-medium">Item has unsaved changes</p>
          )}
        </div>
      </div>
      
      {/* Option Sets Display (read-only in edit mode) */}
      {editedItem.optionSets && editedItem.optionSets.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <OptionSetsDisplay optionSets={editedItem.optionSets} />
        </div>
      )}
    </div>
  );
}