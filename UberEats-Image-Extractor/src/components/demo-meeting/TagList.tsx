import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TagItem } from '../../lib/qualification-constants';

interface TagListProps {
  label: string;
  items: TagItem[] | null | undefined;
  maxVisible?: number;
}

/**
 * TagList Component
 * Displays a list of tags with expand/collapse functionality
 *
 * Used in TaskDetailModal to show JSONB array qualification fields
 * Shows first N tags, then "+ X more" button to expand
 */
export function TagList({ label, items, maxVisible = 10 }: TagListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no items
  if (!items || items.length === 0) {
    return null;
  }

  const shouldShowExpand = items.length > maxVisible;
  const visibleItems = isExpanded ? items : items.slice(0, maxVisible);
  const hiddenCount = items.length - maxVisible;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((item, index) => (
          <Badge
            key={`${item.value}-${index}`}
            variant={item.type === 'predefined' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {item.value}
          </Badge>
        ))}

        {shouldShowExpand && !isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="h-6 px-2 text-xs"
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            +{hiddenCount} more
          </Button>
        )}

        {shouldShowExpand && isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 px-2 text-xs"
          >
            <ChevronUp className="h-3 w-3 mr-1" />
            Show less
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Tag Count
 * Shows just the count for very compact display
 */
interface TagCountProps {
  items: TagItem[] | null | undefined;
  label?: string;
}

export function TagCount({ items, label }: TagCountProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <span className="text-xs text-muted-foreground">
      {label && `${label}: `}
      {items.length} {items.length === 1 ? 'item' : 'items'}
    </span>
  );
}
