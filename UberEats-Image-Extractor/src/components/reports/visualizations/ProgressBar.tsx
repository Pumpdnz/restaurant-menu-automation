import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = true,
  color = 'blue',
  size = 'md',
  onClick,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div
      className={cn(
        'space-y-1.5',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity'
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium truncate">{label}</span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{value.toLocaleString()}</span>
          {showPercentage && (
            <span className="text-xs">({percentage}%)</span>
          )}
        </div>
      </div>
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-300', colorClasses[color])}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
