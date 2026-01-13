import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Check, ChevronDown, Leaf, Star, Sparkles, Tag } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TAG_CATEGORIES, isPresetTag, getTagStyle } from '../../lib/item-tags-constants';

// Icon mapping for categories
const CATEGORY_ICONS = {
  dietary: Leaf,
  popular: Star,
  new: Sparkles,
  deal: Tag
};

/**
 * PresetTagsPopover Component
 *
 * Displays a categorized dropdown of preset tags for quick selection.
 *
 * @param {string[]} selectedTags - Currently selected tags
 * @param {function} onToggleTag - Callback when tag is toggled (tag: string) => void
 * @param {string} className - Additional CSS classes
 */
export default function PresetTagsPopover({
  selectedTags = [],
  onToggleTag,
  className
}) {
  const [isOpen, setIsOpen] = useState(false);

  const isTagSelected = (tag) => selectedTags.includes(tag);

  const handleTagClick = (tag) => {
    onToggleTag(tag);
  };

  // Count selected preset tags
  const selectedPresetCount = selectedTags.filter(isPresetTag).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1", className)}
          type="button"
        >
          <Tag className="h-3.5 w-3.5" />
          Presets
          {selectedPresetCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {selectedPresetCount}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[340px] p-0 max-h-[500px] overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <div className="overflow-y-auto max-h-[500px]">
          {Object.entries(TAG_CATEGORIES).map(([categoryKey, category], categoryIndex) => {
            const IconComponent = CATEGORY_ICONS[categoryKey];
            const selectedInCategory = category.tags.filter(tag =>
              selectedTags.includes(tag)
            ).length;

            return (
              <div
                key={categoryKey}
                className={cn(
                  "p-3",
                  categoryIndex > 0 && "border-t"
                )}
              >
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-2">
                  {IconComponent && (
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {category.label}
                  </span>
                  {selectedInCategory > 0 && (
                    <Badge variant="default" className="h-5 px-1.5 text-xs">
                      {selectedInCategory}
                    </Badge>
                  )}
                </div>

                {/* Tag Grid */}
                <div className="flex flex-wrap gap-1.5">
                  {category.tags.map((tag) => {
                    const selected = isTagSelected(tag);
                    const tagStyle = getTagStyle(tag);

                    // Always show with gradient styling (like ordering page)
                    const buttonStyle = tagStyle ? {
                      background: tagStyle.gradient,
                      borderColor: tagStyle.borderColor,
                      boxShadow: selected ? `0 2px 8px ${tagStyle.shadowColor}` : 'none',
                      opacity: selected ? 1 : 0.7,
                    } : {};

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagClick(tag)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all",
                          "border text-white",
                          selected ? "ring-2 ring-offset-1 ring-black/20" : "hover:opacity-100"
                        )}
                        style={buttonStyle}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
