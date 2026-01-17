# UI Components Specification

## Overview

This document specifies all UI components for the variable enhancement system across all 5 implementation phases.

## Component Architecture

```
src/components/ui/
├── variable-selector.tsx      ★ NEW - Main component (Phase 1-2)
├── variable-badge.tsx          ★ NEW - Clickable badge (Phase 2)
├── variable-search.tsx         ★ NEW - Search/filter UI (Phase 5)
├── variable-category-filter.tsx ★ NEW - Category tabs (Phase 5)
└── variable-preview.tsx        ★ NEW - Live preview (Phase 3)

src/hooks/
└── useVariableInsertion.ts     ★ NEW - Insertion logic (Phase 2)
```

## Phase 1: VariableSelector Component (Basic)

### VariableSelector.tsx

**Location:** `src/components/ui/variable-selector.tsx`

**Purpose:** Display all available variables in organized categories

**Props:**
```typescript
interface VariableSelectorProps {
  // Phase 2 addition
  onVariableSelect?: (variableName: string) => void;

  // Phase 3 addition
  currentMessage?: string;
  showValidation?: boolean;

  // Phase 5 additions
  enableSearch?: boolean;
  enableCategoryFilter?: boolean;
  showRecent?: boolean;
}
```

**Phase 1 Implementation:**

```tsx
import React from 'react';
import { Badge } from './badge';
import { Label } from './label';
import { getAvailableVariables } from '../../services/variable-replacement-service';

interface VariableSelectorProps {
  onVariableSelect?: (variableName: string) => void;
}

export function VariableSelector({ onVariableSelect }: VariableSelectorProps) {
  const availableVariables = getAvailableVariables();

  const handleVariableClick = (variableName: string) => {
    if (onVariableSelect) {
      onVariableSelect(variableName);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Available Variables</Label>

      {availableVariables.map((category) => (
        <div key={category.category} className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            {category.category}
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {category.variables.map((variable) => (
              <div key={variable.name} className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className="text-xs shrink-0 cursor-default"
                  title={`Example: ${variable.example}`}
                >
                  {'{' + variable.name + '}'}
                </Badge>
                <span className="text-muted-foreground">
                  {variable.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Usage in Components:**

```tsx
// In CreateMessageTemplateModal.tsx
import { VariableSelector } from '../ui/variable-selector';

// Replace lines 255-269 (hardcoded list) with:
<div className="space-y-2 border-t pt-4">
  <VariableSelector />
</div>
```

## Phase 2: Click-to-Insert Functionality

### useVariableInsertion Hook

**Location:** `src/hooks/useVariableInsertion.ts`

**Purpose:** Handle cursor position and variable insertion logic

```typescript
import { RefObject, useCallback } from 'react';

interface UseVariableInsertionProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

interface UseVariableInsertionReturn {
  insertVariable: (variableName: string) => void;
}

export function useVariableInsertion({
  textareaRef,
  value,
  onChange
}: UseVariableInsertionProps): UseVariableInsertionReturn {
  const insertVariable = useCallback((variableName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Get current cursor position
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Build new value with variable inserted at cursor
    const newValue =
      value.substring(0, start) +
      `{${variableName}}` +
      value.substring(end);

    // Update value
    onChange(newValue);

    // Restore focus and move cursor after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variableName.length + 2; // +2 for {}
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  }, [textareaRef, value, onChange]);

  return { insertVariable };
}
```

### Updated VariableSelector (Phase 2)

```tsx
import React from 'react';
import { Badge } from './badge';
import { Label } from './label';
import { getAvailableVariables } from '../../services/variable-replacement-service';

interface VariableSelectorProps {
  onVariableSelect?: (variableName: string) => void;
}

export function VariableSelector({ onVariableSelect }: VariableSelectorProps) {
  const availableVariables = getAvailableVariables();

  const handleVariableClick = (variableName: string) => {
    if (onVariableSelect) {
      onVariableSelect(variableName);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Available Variables</Label>
      <p className="text-xs text-muted-foreground">
        Click a variable to insert it at cursor position
      </p>

      {availableVariables.map((category) => (
        <div key={category.category} className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            {category.category}
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {category.variables.map((variable) => (
              <div key={variable.name} className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className="text-xs shrink-0 cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => handleVariableClick(variable.name)}
                  title={`Click to insert. Example: ${variable.example}`}
                >
                  {'{' + variable.name + '}'}
                </Badge>
                <span className="text-muted-foreground">
                  {variable.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Updated CreateMessageTemplateModal (Phase 2)

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { VariableSelector } from '../ui/variable-selector';
import { useVariableInsertion } from '../../hooks/useVariableInsertion';

export function CreateMessageTemplateModal({ ... }: CreateMessageTemplateModalProps) {
  // ... existing state ...

  // NEW: Ref for message textarea
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // NEW: Variable insertion hook
  const { insertVariable } = useVariableInsertion({
    textareaRef: messageTextareaRef,
    value: formData.message_content,
    onChange: (value) => setFormData({ ...formData, message_content: value })
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {/* ... existing header ... */}

        <div className="space-y-4 py-4">
          {/* ... existing fields ... */}

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="message_content">Message Content *</Label>
            <Textarea
              ref={messageTextareaRef}  {/* NEW: Add ref */}
              id="message_content"
              value={formData.message_content}
              onChange={(e) => setFormData({ ...formData, message_content: e.target.value })}
              placeholder="Write your message template here. Use {variable_name} for dynamic content."
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* ... existing detected variables ... */}

          {/* Available Variables - REPLACE hardcoded list */}
          <div className="space-y-2 border-t pt-4">
            <VariableSelector onVariableSelect={insertVariable} />
          </div>

          {/* ... existing preview ... */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Phase 3: Real-time Validation

### Updated VariableSelector (Phase 3)

```tsx
import React from 'react';
import { Badge } from './badge';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import {
  getAvailableVariables,
  validateVariablesRealtime
} from '../../services/variable-replacement-service';

interface VariableSelectorProps {
  onVariableSelect?: (variableName: string) => void;
  currentMessage?: string;
  showValidation?: boolean;
}

export function VariableSelector({
  onVariableSelect,
  currentMessage,
  showValidation = false
}: VariableSelectorProps) {
  const availableVariables = getAvailableVariables();

  // Validate current message
  const validation = currentMessage && showValidation
    ? validateVariablesRealtime(currentMessage)
    : null;

  const handleVariableClick = (variableName: string) => {
    if (onVariableSelect) {
      onVariableSelect(variableName);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Available Variables</Label>
      <p className="text-xs text-muted-foreground">
        Click a variable to insert it at cursor position
      </p>

      {/* Validation Status */}
      {showValidation && validation && validation.hasVariables && (
        <Alert variant={validation.isValid ? "default" : "destructive"}>
          {validation.isValid ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {validation.isValid ? (
              <span>
                ✓ All variables valid ({validation.knownVariables.length} used)
              </span>
            ) : (
              <span>
                ⚠️ Unknown variables:{' '}
                {validation.unknownVariables.map(v => `{${v}}`).join(', ')}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Categories and Variables */}
      {availableVariables.map((category) => (
        <div key={category.category} className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            {category.category}
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {category.variables.map((variable) => {
              // Highlight if variable is used in current message
              const isUsed = currentMessage?.includes(`{${variable.name}}`);

              return (
                <div key={variable.name} className="flex items-start gap-2">
                  <Badge
                    variant={isUsed ? "default" : "outline"}
                    className={`text-xs shrink-0 cursor-pointer transition-colors ${
                      isUsed
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-primary/10'
                    }`}
                    onClick={() => handleVariableClick(variable.name)}
                    title={`Click to insert. Example: ${variable.example}`}
                  >
                    {'{' + variable.name + '}'}
                  </Badge>
                  <span className="text-muted-foreground">
                    {variable.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Updated CreateMessageTemplateModal (Phase 3)

```tsx
// Add validation display
<VariableSelector
  onVariableSelect={insertVariable}
  currentMessage={formData.message_content}
  showValidation={true}
/>
```

## Phase 4: Dynamic Variables (UI Updates)

### Updated VariableSelector

No UI changes needed - automatically picks up new variables from `getAvailableVariables()`

### Admin UI: ExampleCustomersPage

**Location:** `src/pages/ExampleCustomers.tsx`

**Purpose:** Manage city example customers

```tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { CreateExampleCustomerModal } from '../components/example-customers/CreateExampleCustomerModal';
import api from '../services/api';
import { toast } from 'sonner';

export default function ExampleCustomers() {
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedExample, setSelectedExample] = useState<any>(null);

  // Fetch cities
  const { data: cities } = useQuery({
    queryKey: ['example-customers-cities'],
    queryFn: async () => {
      const response = await api.get('/example-customers/cities');
      return response.data.cities;
    }
  });

  // Fetch examples
  const { data: examples, isLoading } = useQuery({
    queryKey: ['example-customers', selectedCity],
    queryFn: async () => {
      const params = selectedCity !== 'all' ? { city: selectedCity } : {};
      const response = await api.get('/example-customers', { params });
      return response.data.data;
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/example-customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['example-customers'] });
      toast.success('Example customer deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete', {
        description: error.response?.data?.error || error.message
      });
    }
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await api.patch(`/example-customers/${id}`, { is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['example-customers'] });
      toast.success('Status updated');
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this example?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (example: any) => {
    setSelectedExample(example);
    setEditModalOpen(true);
  };

  // Group by city
  const groupedExamples = examples?.reduce((acc: any, example: any) => {
    if (!acc[example.city]) acc[example.city] = [];
    acc[example.city].push(example);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Example Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage example customer references for dynamic variables
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Example
        </Button>
      </div>

      {/* City Filter */}
      <div className="flex gap-4 items-center">
        <label className="text-sm font-medium">Filter by City:</label>
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities?.map((city: string) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Examples Table */}
      <div className="rounded-lg border bg-card">
        {selectedCity === 'all' && groupedExamples ? (
          // Grouped view
          Object.entries(groupedExamples).map(([city, cityExamples]: [string, any]) => (
            <div key={city} className="border-b last:border-b-0">
              <div className="bg-muted px-4 py-2 font-semibold">{city}</div>
              <ExampleCustomersTable
                examples={cityExamples}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={(id, is_active) =>
                  toggleActiveMutation.mutate({ id, is_active })
                }
              />
            </div>
          ))
        ) : (
          // Single city view
          <ExampleCustomersTable
            examples={examples || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={(id, is_active) =>
              toggleActiveMutation.mutate({ id, is_active })
            }
          />
        )}
      </div>

      {/* Modals */}
      <CreateExampleCustomerModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {selectedExample && (
        <CreateExampleCustomerModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedExample(null);
          }}
          exampleId={selectedExample.id}
        />
      )}
    </div>
  );
}

// Table component
function ExampleCustomersTable({ examples, onEdit, onDelete, onToggleActive }: any) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Order</TableHead>
          <TableHead>Display Name</TableHead>
          <TableHead>Store URL</TableHead>
          <TableHead>Restaurant</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {examples.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
              No examples found
            </TableCell>
          </TableRow>
        ) : (
          examples.map((example: any) => (
            <TableRow key={example.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span>{example.display_order}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">{example.display_name}</TableCell>
              <TableCell>
                <a
                  href={example.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-blue hover:underline text-sm"
                >
                  {example.store_url}
                </a>
              </TableCell>
              <TableCell>
                {example.restaurants ? (
                  <span className="text-sm">{example.restaurants.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={example.is_active ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => onToggleActive(example.id, !example.is_active)}
                >
                  {example.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(example)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(example.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
```

## Phase 5: Enhanced Variable Picker

### VariableSearch Component

**Location:** `src/components/ui/variable-search.tsx`

```tsx
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from './input';

interface VariableSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function VariableSearch({
  onSearch,
  placeholder = "Search variables..."
}: VariableSearchProps) {
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
}
```

### Final VariableSelector (Phase 5 - Complete)

```tsx
import React, { useState, useMemo } from 'react';
import { Badge } from './badge';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { AlertCircle, CheckCircle, Star } from 'lucide-react';
import { VariableSearch } from './variable-search';
import {
  getAvailableVariables,
  validateVariablesRealtime
} from '../../services/variable-replacement-service';

interface VariableSelectorProps {
  onVariableSelect?: (variableName: string) => void;
  currentMessage?: string;
  showValidation?: boolean;
  enableSearch?: boolean;
  enableCategoryFilter?: boolean;
  showRecent?: boolean;
}

export function VariableSelector({
  onVariableSelect,
  currentMessage,
  showValidation = false,
  enableSearch = false,
  enableCategoryFilter = false,
  showRecent = false
}: VariableSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recentVariables, setRecentVariables] = useState<string[]>([]);
  const [favoriteVariables, setFavoriteVariables] = useState<string[]>([]);

  const availableVariables = getAvailableVariables();

  // Validation
  const validation = currentMessage && showValidation
    ? validateVariablesRealtime(currentMessage)
    : null;

  // Filter variables by search and category
  const filteredVariables = useMemo(() => {
    let result = availableVariables;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(cat => cat.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.map(category => ({
        ...category,
        variables: category.variables.filter(
          v =>
            v.name.toLowerCase().includes(query) ||
            v.description.toLowerCase().includes(query)
        )
      })).filter(category => category.variables.length > 0);
    }

    return result;
  }, [availableVariables, selectedCategory, searchQuery]);

  // Handle variable click
  const handleVariableClick = (variableName: string) => {
    if (onVariableSelect) {
      onVariableSelect(variableName);

      // Add to recent (max 10)
      setRecentVariables(prev => {
        const updated = [variableName, ...prev.filter(v => v !== variableName)];
        return updated.slice(0, 10);
      });
    }
  };

  // Toggle favorite
  const toggleFavorite = (variableName: string) => {
    setFavoriteVariables(prev =>
      prev.includes(variableName)
        ? prev.filter(v => v !== variableName)
        : [...prev, variableName]
    );
  };

  // Get all variables flat
  const allVariablesFlat = availableVariables.flatMap(cat => cat.variables);

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Available Variables</Label>

      {/* Search */}
      {enableSearch && (
        <VariableSearch onSearch={setSearchQuery} />
      )}

      {/* Validation */}
      {showValidation && validation && validation.hasVariables && (
        <Alert variant={validation.isValid ? "default" : "destructive"}>
          {validation.isValid ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {validation.isValid ? (
              <span>✓ All variables valid ({validation.knownVariables.length} used)</span>
            ) : (
              <span>
                ⚠️ Unknown: {validation.unknownVariables.map(v => `{${v}}`).join(', ')}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Category Filter */}
      {enableCategoryFilter ? (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="all" size="sm">All</TabsTrigger>
            {showRecent && recentVariables.length > 0 && (
              <TabsTrigger value="recent" size="sm">Recent</TabsTrigger>
            )}
            {favoriteVariables.length > 0 && (
              <TabsTrigger value="favorites" size="sm">Favorites</TabsTrigger>
            )}
            {availableVariables.map(category => (
              <TabsTrigger key={category.category} value={category.category} size="sm">
                {category.category}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Recent Tab */}
          {showRecent && (
            <TabsContent value="recent">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {recentVariables.map(varName => {
                  const variable = allVariablesFlat.find(v => v.name === varName);
                  if (!variable) return null;

                  return (
                    <VariableBadgeRow
                      key={varName}
                      variable={variable}
                      isUsed={currentMessage?.includes(`{${varName}}`)}
                      isFavorite={favoriteVariables.includes(varName)}
                      onClick={() => handleVariableClick(varName)}
                      onToggleFavorite={() => toggleFavorite(varName)}
                    />
                  );
                })}
              </div>
            </TabsContent>
          )}

          {/* Favorites Tab */}
          <TabsContent value="favorites">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {favoriteVariables.map(varName => {
                const variable = allVariablesFlat.find(v => v.name === varName);
                if (!variable) return null;

                return (
                  <VariableBadgeRow
                    key={varName}
                    variable={variable}
                    isUsed={currentMessage?.includes(`{${varName}}`)}
                    isFavorite={true}
                    onClick={() => handleVariableClick(varName)}
                    onToggleFavorite={() => toggleFavorite(varName)}
                  />
                );
              })}
            </div>
          </TabsContent>

          {/* Category Tabs */}
          <TabsContent value="all">
            {filteredVariables.map(category => (
              <CategorySection
                key={category.category}
                category={category}
                currentMessage={currentMessage}
                favoriteVariables={favoriteVariables}
                onVariableClick={handleVariableClick}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </TabsContent>

          {availableVariables.map(category => (
            <TabsContent key={category.category} value={category.category}>
              <CategorySection
                category={category}
                currentMessage={currentMessage}
                favoriteVariables={favoriteVariables}
                onVariableClick={handleVariableClick}
                onToggleFavorite={toggleFavorite}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        // No category filter - show all
        filteredVariables.map(category => (
          <CategorySection
            key={category.category}
            category={category}
            currentMessage={currentMessage}
            favoriteVariables={favoriteVariables}
            onVariableClick={handleVariableClick}
            onToggleFavorite={toggleFavorite}
          />
        ))
      )}
    </div>
  );
}

// Category section component
function CategorySection({ category, currentMessage, favoriteVariables, onVariableClick, onToggleFavorite }: any) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">
        {category.category}
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {category.variables.map((variable: any) => (
          <VariableBadgeRow
            key={variable.name}
            variable={variable}
            isUsed={currentMessage?.includes(`{${variable.name}}`)}
            isFavorite={favoriteVariables.includes(variable.name)}
            onClick={() => onVariableClick(variable.name)}
            onToggleFavorite={() => onToggleFavorite(variable.name)}
          />
        ))}
      </div>
    </div>
  );
}

// Variable badge row component
function VariableBadgeRow({ variable, isUsed, isFavorite, onClick, onToggleFavorite }: any) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-center gap-1">
        <Badge
          variant={isUsed ? "default" : "outline"}
          className={`text-xs shrink-0 cursor-pointer transition-colors ${
            isUsed ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'
          }`}
          onClick={onClick}
          title={`Click to insert. Example: ${variable.example}`}
        >
          {'{' + variable.name + '}'}
        </Badge>
        <Star
          className={`h-3 w-3 cursor-pointer transition-colors ${
            isFavorite
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground hover:text-yellow-400'
          }`}
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        />
      </div>
      <span className="text-muted-foreground">{variable.description}</span>
    </div>
  );
}
```

## Component Integration Summary

### Components to Update

1. **CreateMessageTemplateModal.tsx**
   - Remove lines 255-269 (hardcoded variables)
   - Add VariableSelector with all Phase 2-3 features

2. **CreateTaskTemplateModal.tsx**
   - Remove line 372 (hardcoded variables)
   - Add VariableSelector

3. **CreateTaskModal.tsx**
   - Remove line 535 (hardcoded variables)
   - Add VariableSelector

4. **SequenceStepBuilder.tsx**
   - Add VariableSelector (currently has NOTHING)
   - Critical for user experience

### Feature Matrix

| Component | Phase 1 | Phase 2 | Phase 3 | Phase 5 |
|-----------|---------|---------|---------|---------|
| All 63 variables | ✓ | ✓ | ✓ | ✓ |
| Click-to-insert | - | ✓ | ✓ | ✓ |
| Real-time validation | - | - | ✓ | ✓ |
| Search | - | - | - | ✓ |
| Category filter | - | - | - | ✓ |
| Recent/Favorites | - | - | - | ✓ |

---

**Last Updated:** 2025-01-26
**Version:** 1.0
**Status:** Ready for Implementation
