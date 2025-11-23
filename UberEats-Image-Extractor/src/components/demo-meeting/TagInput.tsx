import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Check, X, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TagItem } from '../../lib/qualification-constants';

interface TagInputProps {
  options: readonly string[];
  selected: TagItem[];
  onChange: (selected: TagItem[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
  maxTags?: number;
}

/**
 * TagInput Component
 * Multi-select component that supports both predefined options and custom values
 *
 * Features:
 * - Dropdown with checkboxes for predefined options
 * - Input field for custom values
 * - Visual distinction between predefined and custom tags
 * - Remove tags by clicking X
 * - Prevents duplicate values
 */
export function TagInput({
  options,
  selected = [],
  onChange,
  allowCustom = true,
  placeholder = 'Select options...',
  maxTags
}: TagInputProps) {
  const [customValue, setCustomValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Check if a value is already selected
   */
  const isSelected = (value: string): boolean => {
    return selected.some(item => item.value === value);
  };

  /**
   * Toggle selection of a predefined option
   */
  const toggleOption = (value: string) => {
    if (isSelected(value)) {
      // Remove if already selected
      onChange(selected.filter(item => item.value !== value));
    } else {
      // Add if not selected (check max tags limit)
      if (maxTags && selected.length >= maxTags) {
        return; // Don't add if max reached
      }
      onChange([...selected, { type: 'predefined', value }]);
    }
  };

  /**
   * Add a custom value
   */
  const addCustom = () => {
    const trimmedValue = customValue.trim();

    // Validate input
    if (!trimmedValue) {
      return;
    }

    // Check if already selected
    if (isSelected(trimmedValue)) {
      setCustomValue('');
      return;
    }

    // Check max tags limit
    if (maxTags && selected.length >= maxTags) {
      return;
    }

    // Add custom tag
    onChange([...selected, { type: 'custom', value: trimmedValue }]);
    setCustomValue('');
  };

  /**
   * Remove a tag
   */
  const removeTag = (value: string) => {
    onChange(selected.filter(item => item.value !== value));
  };

  /**
   * Handle Enter key in custom input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-start text-left font-normal h-auto min-h-[40px]"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <span className="text-sm">
                  {selected.length} selected
                </span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0 max-h-[500px]" align="start">
          {/* Custom Value Input - At Top for Visibility */}
          {allowCustom && (
            <div className="border-b p-3 bg-brand-blue/5 flex-shrink-0">
              <div className="text-xs font-semibold text-brand-blue mb-2 flex items-center gap-1">
                <Plus className="h-3 w-3" />
                Add Custom Value
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Type custom value and press Enter or click +"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-sm h-9"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={addCustom}
                  disabled={!customValue.trim() || (maxTags !== undefined && selected.length >= maxTags)}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {maxTags && selected.length >= maxTags && (
                <p className="text-xs text-amber-600 mt-1">
                  Maximum {maxTags} tags reached
                </p>
              )}
            </div>
          )}

          {/* Predefined Options - Fixed Height with Scroll */}
          <div className="relative flex-shrink-0">
            <div className="text-xs font-medium text-muted-foreground mb-2 px-4 pt-2 flex-shrink-0">
              Or select from common options:
            </div>
            <div
              className="overflow-y-auto px-2 pb-2"
              style={{
                height: '250px',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch'
              }}
              onWheel={(e) => {
                e.stopPropagation();
              }}
            >
              {options.map((option) => (
                <div
                  key={option}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-muted transition-colors',
                    isSelected(option) && 'bg-muted'
                  )}
                  onClick={() => toggleOption(option)}
                >
                  <div
                    className={cn(
                      'w-4 h-4 border rounded flex items-center justify-center shrink-0',
                      isSelected(option) && 'bg-brand-blue border-brand-blue'
                    )}
                  >
                    {isSelected(option) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm flex-1">{option}</span>
                </div>
              ))}
            </div>
            {/* Scroll indicator gradient - shows there's more content below */}
            {options.length > 6 && (
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Tags Display */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 border rounded-md bg-muted/30">
          {selected.map((item, index) => (
            <Badge
              key={`${item.type}-${item.value}-${index}`}
              variant={item.type === 'predefined' ? 'default' : 'secondary'}
              className={cn(
                "flex items-center gap-1.5 pl-2.5 pr-1.5 py-1",
                item.type === 'predefined' && "!text-white"
              )}
            >
              <span className={cn("text-xs", item.type === 'predefined' && "!text-white")}>{item.value}</span>
              <button
                onClick={() => removeTag(item.value)}
                className={cn(
                  "ml-0.5 rounded-full p-0.5 transition-colors",
                  item.type === 'predefined' ? "hover:bg-white/20" : "hover:bg-destructive/20"
                )}
                type="button"
              >
                <X className={cn("h-3 w-3", item.type === 'predefined' && "!text-white")} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Helper Text */}
      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select from options or add custom values
        </p>
      )}
    </div>
  );
}
