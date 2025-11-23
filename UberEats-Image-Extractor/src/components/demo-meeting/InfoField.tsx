import React from 'react';

interface InfoFieldProps {
  label: string;
  value: string | number | null | undefined;
  formatter?: (value: string | number) => string;
}

/**
 * InfoField Component
 * Displays a labeled field value
 *
 * Used in TaskDetailModal to show qualification data
 */
export function InfoField({ label, value, formatter }: InfoFieldProps) {
  // Don't render if no value
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const displayValue = formatter && typeof value !== 'undefined'
    ? formatter(value as string | number)
    : String(value);

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {label}
      </div>
      <div className="text-sm">
        {displayValue}
      </div>
    </div>
  );
}

/**
 * Format currency values
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `$${value.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
}

/**
 * Format website type
 */
export function formatWebsiteType(type: string | null | undefined): string {
  if (!type) return '-';
  if (type === 'platform_subdomain') return 'Platform Subdomain';
  if (type === 'custom_domain') return 'Custom Domain';
  return type;
}
