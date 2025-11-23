import { useState, useMemo, useEffect } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MultiSelect } from '@/components/ui/multi-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRestaurants } from '@/hooks/useRestaurants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SelectRestaurantForSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void;
  onSelectRestaurants?: (restaurants: any[]) => void;
  allowMultiple?: boolean;
}

export function SelectRestaurantForSequenceModal({
  open,
  onClose,
  onSelectRestaurant,
  onSelectRestaurants,
  allowMultiple = false,
}: SelectRestaurantForSequenceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    lead_status: [] as string[],
    lead_stage: [] as string[],
    lead_warmth: [] as string[],
  });
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);

  const { data: restaurants, isLoading } = useRestaurants();

  // Reset selection when modal closes or mode changes
  useEffect(() => {
    if (!open) {
      setSelectedRestaurantIds([]);
      setSearchTerm('');
      setFilters({
        lead_status: [],
        lead_stage: [],
        lead_warmth: [],
      });
    }
  }, [open]);

  // Filter restaurants by search term and filters
  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return [];

    return restaurants.filter((r) => {
      // Search filter
      if (searchTerm) {
        const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
      }

      // Lead status filter
      if (filters.lead_status.length > 0 && !filters.lead_status.includes(r.lead_status)) {
        return false;
      }

      // Lead stage filter
      if (filters.lead_stage.length > 0 && !filters.lead_stage.includes(r.lead_stage)) {
        return false;
      }

      // Lead warmth filter
      if (filters.lead_warmth.length > 0 && !filters.lead_warmth.includes(r.lead_warmth)) {
        return false;
      }

      return true;
    });
  }, [restaurants, searchTerm, filters]);

  // Toggle restaurant selection
  const handleToggleRestaurant = (restaurantId: string) => {
    setSelectedRestaurantIds(prev =>
      prev.includes(restaurantId)
        ? prev.filter(id => id !== restaurantId)
        : [...prev, restaurantId]
    );
  };

  // Select all filtered restaurants
  const handleSelectAll = () => {
    const MAX_SELECTION = 100;

    if (filteredRestaurants.length > MAX_SELECTION) {
      toast.error(`Cannot select more than ${MAX_SELECTION} restaurants at once`);
      return;
    }

    setSelectedRestaurantIds(filteredRestaurants.map(r => r.id));
    toast.success(`Selected ${filteredRestaurants.length} restaurant${filteredRestaurants.length !== 1 ? 's' : ''}`);
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedRestaurantIds([]);
  };

  // Confirm selection and proceed
  const handleConfirmSelection = () => {
    const WARN_THRESHOLD = 50;

    const selectedRestaurants = restaurants?.filter(r =>
      selectedRestaurantIds.includes(r.id)
    ) || [];

    if (selectedRestaurants.length === 0) {
      toast.error('Please select at least one restaurant');
      return;
    }

    if (selectedRestaurants.length > WARN_THRESHOLD) {
      toast.info('Large selection - bulk operation may take a moment...', {
        duration: 3000,
      });
    }

    onSelectRestaurants?.(selectedRestaurants);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[700px]">
        <DialogHeader>
          <DialogTitle>
            {allowMultiple ? 'Select Restaurants for Bulk Sequence' : 'Select Restaurant for Sequence'}
          </DialogTitle>
          <DialogDescription>
            {allowMultiple
              ? 'Choose multiple restaurants to start the same sequence for all at once'
              : 'Choose a restaurant to start a new sequence'}
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Lead Status Filter */}
            <MultiSelect
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Ghosted', value: 'ghosted' },
                { label: 'Reengaging', value: 'reengaging' },
                { label: 'Closed', value: 'closed' },
              ]}
              selected={filters.lead_status}
              onChange={(selected) => setFilters({ ...filters, lead_status: selected })}
              placeholder="Lead Status"
            />

            {/* Lead Stage Filter */}
            <MultiSelect
              options={[
                { label: 'Uncontacted', value: 'uncontacted' },
                { label: 'Reached Out', value: 'reached_out' },
                { label: 'In Talks', value: 'in_talks' },
                { label: 'Demo Booked', value: 'demo_booked' },
                { label: 'Rebook Demo', value: 'rebook_demo' },
                { label: 'Contract Sent', value: 'contract_sent' },
                { label: 'Closed Won', value: 'closed_won' },
                { label: 'Closed Lost', value: 'closed_lost' },
                { label: 'Reengaging', value: 'reengaging' },
              ]}
              selected={filters.lead_stage}
              onChange={(selected) => setFilters({ ...filters, lead_stage: selected })}
              placeholder="Lead Stage"
            />

            {/* Lead Warmth Filter */}
            <MultiSelect
              options={[
                { label: 'Frozen', value: 'frozen' },
                { label: 'Cold', value: 'cold' },
                { label: 'Warm', value: 'warm' },
                { label: 'Hot', value: 'hot' },
              ]}
              selected={filters.lead_warmth}
              onChange={(selected) => setFilters({ ...filters, lead_warmth: selected })}
              placeholder="Lead Warmth"
            />
          </div>
        </div>

        {/* Selection toolbar - shown when in multi-select mode */}
        {allowMultiple && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-medium">
                  {selectedRestaurantIds.length} selected
                </Badge>
                {selectedRestaurantIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {filteredRestaurants.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredRestaurants.length > 100}
                >
                  Select All ({filteredRestaurants.length})
                </Button>
              )}
            </div>

            <Button
              onClick={handleConfirmSelection}
              disabled={selectedRestaurantIds.length === 0}
              className="bg-gradient-to-r from-brand-blue to-brand-green"
            >
              Continue ({selectedRestaurantIds.length})
            </Button>
          </div>
        )}

        {/* Restaurant List */}
        <ScrollArea className="h-[380px] pr-4">
          <div className="space-y-2">
            {isLoading && (
              <p className="text-center text-muted-foreground py-8">Loading restaurants...</p>
            )}

            {!isLoading && filteredRestaurants.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {searchTerm || filters.lead_status.length > 0 || filters.lead_stage.length > 0 || filters.lead_warmth.length > 0
                  ? 'No restaurants found matching your filters'
                  : 'No restaurants available'}
              </p>
            )}

            {filteredRestaurants.map((restaurant) => {
              const isSelected = selectedRestaurantIds.includes(restaurant.id);

              return (
                <div
                  key={restaurant.id}
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-lg transition-colors",
                    allowMultiple
                      ? isSelected
                        ? "bg-accent border-primary cursor-pointer"
                        : "hover:bg-accent/50 cursor-pointer"
                      : "hover:bg-accent cursor-pointer"
                  )}
                  onClick={() => {
                    if (allowMultiple) {
                      handleToggleRestaurant(restaurant.id);
                    } else {
                      onSelectRestaurant(restaurant);
                    }
                  }}
                >
                  {/* Checkbox for multi-select mode */}
                  {allowMultiple && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleRestaurant(restaurant.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}

                  {/* Restaurant info */}
                  <div className="flex-1">
                    <h4 className="font-medium">{restaurant.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant.lead_stage && (
                        <Badge variant="outline" className="text-xs">
                          {restaurant.lead_stage.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {restaurant.lead_warmth && (
                        <Badge variant="secondary" className="text-xs">
                          {restaurant.lead_warmth}
                        </Badge>
                      )}
                      {restaurant.lead_status && (
                        <Badge variant="secondary" className="text-xs">
                          {restaurant.lead_status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action indicator */}
                  {!allowMultiple && (
                    <Button size="sm" onClick={(e) => {
                      e.stopPropagation();
                      onSelectRestaurant(restaurant);
                    }}>
                      Select
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Results Count */}
        {!isLoading && filteredRestaurants.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Warning for large selections */}
        {allowMultiple && selectedRestaurantIds.length >= 50 && (
          <Alert variant={selectedRestaurantIds.length >= 100 ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {selectedRestaurantIds.length >= 100
                ? `Maximum 100 restaurants can be selected. Please reduce your selection.`
                : `Large selection (${selectedRestaurantIds.length} restaurants). The bulk operation may take a moment to complete.`
              }
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
