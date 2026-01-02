/**
 * Shared Multi-Column Sorting Utilities
 *
 * This module provides reusable sorting functionality for data tables.
 * See planning/issues-fixed/multi-column-sorting-pattern.md for full documentation.
 */

export type SortDirection = 'disabled' | 'desc' | 'asc';

export interface ColumnSort<T extends string = string> {
  column: T;
  direction: 'desc' | 'asc';
}

export type SortState<T extends string = string> = ColumnSort<T>[];

/**
 * Get the current direction for a specific column from sort state
 */
export function getColumnDirection<T extends string>(
  sortState: SortState<T>,
  column: T
): SortDirection {
  const found = sortState.find(s => s.column === column);
  return found ? found.direction : 'disabled';
}

/**
 * Get the sort priority (1-based index) for a column, or null if not in sort
 */
export function getColumnPriority<T extends string>(
  sortState: SortState<T>,
  column: T
): number | null {
  const index = sortState.findIndex(s => s.column === column);
  return index >= 0 ? index + 1 : null;
}

/**
 * Cycle through sort states: disabled -> desc -> asc -> disabled
 * When enabling a column, it's added as secondary sort (appended to end)
 * When changing direction, column maintains its priority
 * When disabling, column is removed from sort
 */
export function cycleSortColumn<T extends string>(
  sortState: SortState<T>,
  column: T
): SortState<T> {
  const currentIndex = sortState.findIndex(s => s.column === column);

  if (currentIndex === -1) {
    // Column is disabled -> enable as descending, add as secondary (append to end)
    return [...sortState, { column, direction: 'desc' }];
  }

  const current = sortState[currentIndex];

  if (current.direction === 'desc') {
    // Descending -> Ascending (keep position)
    const newState = [...sortState];
    newState[currentIndex] = { column, direction: 'asc' };
    return newState;
  }

  // Ascending -> Disabled (remove from list)
  return sortState.filter((_, i) => i !== currentIndex);
}

/**
 * Generic multi-column sort comparator
 * Returns a sort function that can be used with Array.sort()
 *
 * @param sortState - Current sort state
 * @param getValueForColumn - Function to extract comparable value for a column
 */
export function createMultiColumnComparator<T, C extends string>(
  sortState: SortState<C>,
  getValueForColumn: (item: T, column: C) => string | number | Date | null
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    for (const { column, direction } of sortState) {
      const aVal = getValueForColumn(a, column);
      const bVal = getValueForColumn(b, column);

      // Handle nulls - sort them last
      if (aVal === null && bVal === null) continue;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Compare values
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
      // If equal, continue to next sort column
    }
    return 0;
  };
}
