import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Check, ChevronDown, Image, Search, GlassWater, UtensilsCrossed, Droplet } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  COMMON_IMAGE_CATEGORIES,
  searchCommonImages,
  getActiveCategories
} from '../../lib/common-images-constants';

// Icon mapping for categories
const CATEGORY_ICONS = {
  beverage: GlassWater,
  side: UtensilsCrossed,
  condiment: Droplet
};

/**
 * CommonImagesPopover Component
 *
 * Displays a searchable grid of common product images for quick selection.
 *
 * @param {function} onSelectImage - Callback when image is selected (imageUrl: string, imageName: string) => void
 * @param {string} selectedImageUrl - Currently selected image URL (for visual feedback)
 * @param {string} className - Additional CSS classes
 */
export default function CommonImagesPopover({
  onSelectImage,
  selectedImageUrl = null,
  className
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('beverage');

  // Get categories that have images
  const activeCategories = useMemo(() => getActiveCategories(), []);

  // Filter images based on search and category
  const filteredImages = useMemo(() => {
    if (searchQuery.trim()) {
      // Search across all categories
      const results = searchCommonImages(searchQuery, 30);
      return results.map(r => r.image);
    }

    // Show images from active category
    const category = COMMON_IMAGE_CATEGORIES[activeCategory];
    return category ? category.images : [];
  }, [searchQuery, activeCategory]);

  const handleSelectImage = (image) => {
    onSelectImage(image.imageUrl, image.name);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isSelected = (imageUrl) => selectedImageUrl === imageUrl;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1", className)}
          type="button"
        >
          <Image className="h-3.5 w-3.5" />
          Common Images
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] p-0 max-h-[500px] overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <div className="p-3 border-b">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search images (e.g., 'Coke', 'Sprite')"
              className="pl-9 h-9"
            />
          </div>

          {/* Category Tabs - only show when not searching */}
          {!searchQuery.trim() && activeCategories.length > 1 && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              {activeCategories.map((category) => {
                const IconComponent = CATEGORY_ICONS[category.id];
                const isActive = activeCategory === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                    {category.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Image Grid */}
        <div className="overflow-y-auto max-h-[380px] p-3">
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {filteredImages.map((image) => {
                const selected = isSelected(image.imageUrl);

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => handleSelectImage(image)}
                    className={cn(
                      "relative flex flex-col items-center p-2 rounded-lg border-2 transition-all hover:border-primary/50",
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    {/* Image Preview */}
                    <div className="relative w-full aspect-square rounded-md overflow-hidden bg-white">
                      <img
                        src={image.imageUrl}
                        alt={image.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Show placeholder on error
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      {/* Placeholder for broken images */}
                      <div
                        className="absolute inset-0 items-center justify-center bg-muted text-muted-foreground hidden"
                      >
                        <Image className="h-8 w-8" />
                      </div>

                      {/* Selection indicator */}
                      {selected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>

                    {/* Image Name */}
                    <p className="mt-1.5 text-xs font-medium text-center line-clamp-2 leading-tight">
                      {image.name}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Image className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No images found</p>
              {searchQuery && (
                <p className="text-xs mt-1">Try a different search term</p>
              )}
            </div>
          )}
        </div>

        {/* Footer with count */}
        <div className="px-3 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
