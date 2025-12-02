import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from './badge';
import { getAvailableVariables } from '../../services/variable-replacement-client';

interface VariableSelectorProps {
  /** Callback when a variable is clicked - inserts variable at cursor position */
  onVariableSelect?: (variableName: string) => void;
  /** Whether the entire component starts collapsed */
  defaultCollapsed?: boolean;
}

/**
 * VariableSelector - Displays available template variables with click-to-insert
 * The entire component and individual categories are collapsible
 */
export function VariableSelector({
  onVariableSelect,
  defaultCollapsed = true
}: VariableSelectorProps) {
  const availableVariables = getAvailableVariables();
  const isClickable = !!onVariableSelect;
  const totalVariables = availableVariables.reduce((sum, cat) => sum + cat.variables.length, 0);

  // State for entire component collapsed
  const [isComponentCollapsed, setIsComponentCollapsed] = useState(defaultCollapsed);

  // Initialize collapsed state for categories based on collapsedByDefault
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    const defaultCollapsed = new Set<string>();
    availableVariables.forEach(cat => {
      if (cat.collapsedByDefault) {
        defaultCollapsed.add(cat.category);
      }
    });
    return defaultCollapsed;
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleVariableClick = (variableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onVariableSelect) {
      onVariableSelect(`{${variableName}}`);
    }
  };

  return (
    <div className="space-y-2">
      {/* Main Header - Click to collapse/expand entire component */}
      <button
        type="button"
        onClick={() => setIsComponentCollapsed(!isComponentCollapsed)}
        className="w-full flex items-center gap-2 text-left hover:text-foreground transition-colors"
      >
        {isComponentCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-sm font-medium flex-1">Available Variables</span>
        <span className="text-xs text-muted-foreground">
          {totalVariables} variables
        </span>
        {isClickable && !isComponentCollapsed && (
          <span className="text-xs text-muted-foreground ml-2">Click to insert</span>
        )}
      </button>

      {/* Categories - Only shown when component is expanded */}
      {!isComponentCollapsed && (
        <div className="space-y-2 pl-2">
          {availableVariables.map((category) => {
            const isCategoryCollapsed = collapsedCategories.has(category.category);

            return (
              <div key={category.category} className="border rounded-md">
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.category)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
                >
                  {isCategoryCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                    {category.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.variables.length}
                  </span>
                </button>

                {/* Variables */}
                {!isCategoryCollapsed && (
                  <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                    {category.variables.map((variable) => (
                      <Badge
                        key={variable.name}
                        variant="outline"
                        className={`text-xs font-mono ${
                          isClickable
                            ? 'cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors'
                            : 'cursor-default'
                        }`}
                        onClick={(e) => handleVariableClick(variable.name, e)}
                        title={`${variable.description} (e.g., ${variable.example})`}
                      >
                        {'{' + variable.name + '}'}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
