import React from 'react';
import { Check, X, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BooleanFieldProps {
  label: string;
  value: boolean | null | undefined;
}

/**
 * BooleanField Component
 * Displays a Yes/No/Unknown value with icons
 *
 * Used in TaskDetailModal to show boolean qualification fields
 */
export function BooleanField({ label, value }: BooleanFieldProps) {
  // Don't render if explicitly null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-medium text-muted-foreground min-w-[140px]">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        {value === true && (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Yes</span>
          </>
        )}
        {value === false && (
          <>
            <X className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">No</span>
          </>
        )}
        {value !== true && value !== false && (
          <>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Unknown</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Boolean Indicator
 * Shows just an icon for compact display
 */
interface BooleanIndicatorProps {
  value: boolean | null | undefined;
  size?: 'sm' | 'md';
}

export function BooleanIndicator({ value, size = 'md' }: BooleanIndicatorProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (value === true) {
    return <Check className={cn(iconSize, 'text-green-600')} />;
  }
  if (value === false) {
    return <X className={cn(iconSize, 'text-red-600')} />;
  }
  return <HelpCircle className={cn(iconSize, 'text-muted-foreground')} />;
}
