import * as React from 'react';
import { Check, ChevronsUpDown, Utensils, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Command, CommandInput } from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { useCuisines, UberEatsCuisine } from '../../hooks/useLeadScrape';

interface CuisineSearchComboboxProps {
  value?: string; // The slug value
  onSelect: (cuisine: UberEatsCuisine | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Group cuisines alphabetically by first letter
function groupCuisinesByLetter(cuisines: UberEatsCuisine[]): Record<string, UberEatsCuisine[]> {
  return cuisines.reduce((acc, cuisine) => {
    const firstLetter = cuisine.display_name.charAt(0).toUpperCase();
    // Group numbers and special chars under '#'
    const key = /^[A-Z]/.test(firstLetter) ? firstLetter : '#';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(cuisine);
    return acc;
  }, {} as Record<string, UberEatsCuisine[]>);
}

export function CuisineSearchCombobox({
  value,
  onSelect,
  placeholder = 'Select cuisine...',
  disabled = false,
}: CuisineSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch cuisines
  const { data, isLoading } = useCuisines();
  const cuisines = data?.cuisines || [];

  // Find the selected cuisine
  const selectedCuisine = cuisines.find((c) => c.slug === value);

  // Filter cuisines based on search
  const filteredCuisines = React.useMemo(() => {
    if (!searchQuery) return cuisines;
    const query = searchQuery.toLowerCase();
    return cuisines.filter(
      (cuisine) =>
        cuisine.display_name.toLowerCase().includes(query) ||
        cuisine.slug.toLowerCase().includes(query)
    );
  }, [cuisines, searchQuery]);

  // Group filtered cuisines by first letter
  const groupedCuisines = React.useMemo(
    () => groupCuisinesByLetter(filteredCuisines),
    [filteredCuisines]
  );

  // Sort letters alphabetically (with '#' at the end)
  const sortedLetters = React.useMemo(() => {
    const letters = Object.keys(groupedCuisines);
    return letters.sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [groupedCuisines]);

  const handleSelect = (slug: string) => {
    const cuisine = cuisines.find((c) => c.slug === slug);
    onSelect(cuisine || null);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading cuisines...
            </span>
          ) : selectedCuisine ? (
            <span className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-muted-foreground" />
              {selectedCuisine.display_name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cuisines..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <div
            className="overflow-y-auto"
            style={{
              height: '300px',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCuisines.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No cuisines found.
              </div>
            ) : (
              sortedLetters.map((letter) => (
                <div key={letter} className="px-1 py-1">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground sticky top-0 bg-popover">
                    {letter}
                  </div>
                  {groupedCuisines[letter].map((cuisine) => (
                    <div
                      key={cuisine.id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-accent transition-colors',
                        value === cuisine.slug && 'bg-accent'
                      )}
                      onClick={() => handleSelect(cuisine.slug)}
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          value === cuisine.slug ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <Utensils className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{cuisine.display_name}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default CuisineSearchCombobox;
