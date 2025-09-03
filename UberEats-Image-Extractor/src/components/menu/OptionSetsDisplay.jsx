import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Info, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export default function OptionSetsDisplay({ optionSets = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSets, setExpandedSets] = useState(new Set());

  if (!optionSets || optionSets.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // When expanding main section, don't auto-expand all sets
      setExpandedSets(new Set());
    } else {
      // When collapsing main section, collapse all sets
      setExpandedSets(new Set());
    }
  };

  const toggleSetExpanded = (index, e) => {
    e.stopPropagation();
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-2 w-full text-left hover:bg-gray-50 p-2 rounded-lg transition-colors group"
      >
        <div className="flex items-center gap-2 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-gray-700 rotate-180" />
          )}
          <h6 className="text-sm font-medium text-gray-700">Customization Options</h6>
          <Badge variant="secondary" className="text-xs">
            {optionSets.length} {optionSets.length === 1 ? 'Set' : 'Sets'}
          </Badge>
        </div>
        <span className="text-xs text-gray-500 group-hover:text-gray-700">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 mt-3">
          {optionSets.map((optionSet, index) => {
            const isSetExpanded = expandedSets.has(index);
            
            return (
              <div key={index} className="bg-gray-50 rounded-lg overflow-hidden">
                <button
                  onClick={(e) => toggleSetExpanded(index, e)}
                  className="w-full p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h6 className="text-sm font-medium text-gray-900">
                          {optionSet.name}
                        </h6>
                        {optionSet.isShared && (
                          <Badge variant="outline" className="text-xs">
                            Shared
                          </Badge>
                        )}
                      </div>
                      {!isSetExpanded && optionSet.description && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{optionSet.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {optionSet.minSelections === optionSet.maxSelections
                          ? `Select ${optionSet.minSelections}`
                          : optionSet.maxSelections === null
                          ? `Select ${optionSet.minSelections}+`
                          : `Select ${optionSet.minSelections}-${optionSet.maxSelections}`}
                      </Badge>
                      {isSetExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                </button>

                {isSetExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {optionSet.description && (
                      <p className="text-xs text-gray-600">{optionSet.description}</p>
                    )}
                    
                    <div className="space-y-1">
                      {optionSet.options && optionSet.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-200"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded border border-gray-300 flex items-center justify-center">
                              {option.isDefault && (
                                <Check className="h-3 w-3 text-green-600" />
                              )}
                            </div>
                            <span className="text-sm text-gray-700">{option.name}</span>
                            {option.description && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm max-w-xs">{option.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {option.priceChange !== 0 && (
                              <span className="text-sm font-medium text-gray-900">
                                {option.priceChange > 0 ? '+' : ''}${Math.abs(option.priceChange).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {optionSet.required && (
                      <div className="flex items-center gap-1 text-xs text-orange-600">
                        <Info className="h-3 w-3" />
                        <span>Required selection</span>
                      </div>
                    )}
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