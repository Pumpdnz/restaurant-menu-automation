import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
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
import { useRestaurants } from '@/hooks/useRestaurants';

interface SelectRestaurantForSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void;
}

export function SelectRestaurantForSequenceModal({
  open,
  onClose,
  onSelectRestaurant,
}: SelectRestaurantForSequenceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    lead_status: [] as string[],
    lead_stage: [] as string[],
    lead_warmth: [] as string[],
  });

  const { data: restaurants, isLoading } = useRestaurants();

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[700px]">
        <DialogHeader>
          <DialogTitle>Select Restaurant for Sequence</DialogTitle>
          <DialogDescription>
            Choose a restaurant to start a new sequence
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

            {filteredRestaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => onSelectRestaurant(restaurant)}
              >
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
                <Button size="sm">Select</Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Results Count */}
        {!isLoading && filteredRestaurants.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
