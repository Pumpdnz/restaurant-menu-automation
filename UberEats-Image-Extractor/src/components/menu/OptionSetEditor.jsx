import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Trash2, Plus, ChevronDown, X, Copy } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export default function OptionSetEditor({ 
  optionSets = [], 
  onUpdate, 
  isEditMode = false 
}) {
  const [editedOptionSets, setEditedOptionSets] = useState(optionSets);
  const [expandedSets, setExpandedSets] = useState(new Set());

  useEffect(() => {
    setEditedOptionSets(optionSets);
  }, [optionSets]);

  const handleOptionSetChange = (setIndex, field, value) => {
    const updated = [...editedOptionSets];
    updated[setIndex] = { ...updated[setIndex], [field]: value };
    setEditedOptionSets(updated);
    onUpdate(updated);
  };

  const handleOptionChange = (setIndex, optionIndex, field, value) => {
    const updated = [...editedOptionSets];
    updated[setIndex].options[optionIndex] = {
      ...updated[setIndex].options[optionIndex],
      [field]: value
    };
    setEditedOptionSets(updated);
    onUpdate(updated);
  };

  const addOption = (setIndex) => {
    const updated = [...editedOptionSets];
    updated[setIndex].options.push({
      name: '',
      priceChange: 0,
      isDefault: false,
      description: ''
    });
    setEditedOptionSets(updated);
    onUpdate(updated);
  };

  const removeOption = (setIndex, optionIndex) => {
    const updated = [...editedOptionSets];
    updated[setIndex].options.splice(optionIndex, 1);
    setEditedOptionSets(updated);
    onUpdate(updated);
  };

  const addOptionSet = () => {
    const newSet = {
      name: 'New Option Set',
      description: '',
      minSelections: 0,
      maxSelections: 1,
      required: false,
      options: []
    };
    const updated = [...editedOptionSets, newSet];
    setEditedOptionSets(updated);
    onUpdate(updated);
    // Auto-expand the new set
    setExpandedSets(prev => new Set([...prev, editedOptionSets.length]));
  };

  const removeOptionSet = (setIndex) => {
    const updated = editedOptionSets.filter((_, index) => index !== setIndex);
    setEditedOptionSets(updated);
    onUpdate(updated);
  };

  const duplicateOptionSet = (setIndex) => {
    const original = editedOptionSets[setIndex];
    const duplicate = {
      ...original,
      name: `${original.name} (Copy)`,
      options: [...original.options.map(opt => ({ ...opt }))]
    };
    const updated = [...editedOptionSets, duplicate];
    setEditedOptionSets(updated);
    onUpdate(updated);
  };

  const toggleExpanded = (setIndex) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setIndex)) {
        newSet.delete(setIndex);
      } else {
        newSet.add(setIndex);
      }
      return newSet;
    });
  };

  if (!isEditMode) {
    return null; // Use OptionSetsDisplay for view mode
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h6 className="text-sm font-medium text-gray-700">Option Sets</h6>
        <Button
          onClick={addOptionSet}
          size="sm"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Option Set
        </Button>
      </div>

      {editedOptionSets.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No option sets defined</p>
      ) : (
        <div className="space-y-3">
          {editedOptionSets.map((optionSet, setIndex) => {
            const isExpanded = expandedSets.has(setIndex);
            
            return (
              <Collapsible
                key={setIndex}
                open={isExpanded}
                onOpenChange={() => toggleExpanded(setIndex)}
                className="border rounded-lg p-3 bg-gray-50"
              >
                {/* Option Set Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CollapsibleTrigger asChild>
                        <button
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              !isExpanded && "-rotate-90"
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <Input
                        value={optionSet.name}
                        onChange={(e) => handleOptionSetChange(setIndex, 'name', e.target.value)}
                        placeholder="Option set name"
                        className="flex-1"
                      />
                      {optionSet.isShared && (
                        <Badge variant="outline" className="text-xs">
                          Shared
                        </Badge>
                      )}
                    </div>

                    <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                      <Textarea
                        value={optionSet.description || ''}
                        onChange={(e) => handleOptionSetChange(setIndex, 'description', e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className="mt-2 text-sm"
                      />

                      {/* Selection Rules */}
                      <div className="mt-3 flex gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Min</Label>
                          <Input
                            type="number"
                            min="0"
                            value={optionSet.minSelections}
                            onChange={(e) => handleOptionSetChange(setIndex, 'minSelections', parseInt(e.target.value) || 0)}
                            className="w-16"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Max</Label>
                          <Input
                            type="number"
                            min="1"
                            value={optionSet.maxSelections || ''}
                            onChange={(e) => handleOptionSetChange(setIndex, 'maxSelections', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="∞"
                            className="w-16"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`required-${setIndex}`}
                            checked={optionSet.required}
                            onCheckedChange={(checked) => handleOptionSetChange(setIndex, 'required', checked)}
                          />
                          <Label
                            htmlFor={`required-${setIndex}`}
                            className="text-xs cursor-pointer"
                          >
                            Required
                          </Label>
                        </div>
                      </div>

                      {/* Options List */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs text-gray-600">Options</Label>
                          <Button
                            onClick={() => addOption(setIndex)}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Option
                          </Button>
                        </div>

                        {optionSet.options.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">No options defined</p>
                        ) : (
                          <div className="space-y-1">
                            {optionSet.options.map((option, optionIndex) => (
                              <div
                                key={optionIndex}
                                className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200"
                              >
                                <Checkbox
                                  checked={option.isDefault}
                                  onCheckedChange={(checked) =>
                                    handleOptionChange(setIndex, optionIndex, 'isDefault', checked)
                                  }
                                  title="Set as default"
                                />

                                <Input
                                  value={option.name}
                                  onChange={(e) =>
                                    handleOptionChange(setIndex, optionIndex, 'name', e.target.value)
                                  }
                                  placeholder="Option name"
                                  className="flex-1"
                                />

                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500 text-sm">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={option.priceChange || ''}
                                    onChange={(e) =>
                                      handleOptionChange(setIndex, optionIndex, 'priceChange', parseFloat(e.target.value) || 0)
                                    }
                                    placeholder="0.00"
                                    className="w-20"
                                  />
                                </div>

                                <Button
                                  onClick={() => removeOption(setIndex, optionIndex)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      onClick={() => duplicateOptionSet(setIndex)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Duplicate option set"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => removeOptionSet(setIndex)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      title="Delete option set"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Collapsed summary */}
                {!isExpanded && (
                  <p className="text-xs text-gray-500 mt-1">
                    {optionSet.options.length} option{optionSet.options.length !== 1 ? 's' : ''} •
                    Select {optionSet.minSelections === optionSet.maxSelections
                      ? optionSet.minSelections
                      : optionSet.maxSelections === null
                      ? `${optionSet.minSelections}+`
                      : `${optionSet.minSelections}-${optionSet.maxSelections}`}
                  </p>
                )}
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}