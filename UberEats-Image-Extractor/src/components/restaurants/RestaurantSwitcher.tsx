import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Building2, Loader2, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Command, CommandInput } from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { restaurantAPI } from '../../services/api';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  city?: string;
  onboarding_status?: string;
}

interface RestaurantSwitcherProps {
  currentRestaurantId: string;
  currentRestaurantName: string;
  currentRestaurantAddress?: string;
  disabled?: boolean;
}

// Helper component for status indicator
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    lead: 'bg-gray-500',
    info_gathered: 'bg-blue-500',
    contacted: 'bg-yellow-500',
    meeting_scheduled: 'bg-purple-500',
    demo_completed: 'bg-indigo-500',
    proposal_sent: 'bg-pink-500',
    negotiating: 'bg-orange-500',
    closed_won: 'bg-green-500',
    closed_lost: 'bg-red-500',
    onboarding: 'bg-cyan-500',
    live: 'bg-emerald-500',
  };

  return (
    <span
      className={cn('w-2 h-2 rounded-full shrink-0', colors[status] || 'bg-gray-400')}
      title={status.replace('_', ' ')}
    />
  );
}

export function RestaurantSwitcher({
  currentRestaurantId,
  currentRestaurantName,
  currentRestaurantAddress,
  disabled = false,
}: RestaurantSwitcherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch minimal restaurant list for switcher (id, name, address, city, onboarding_status only)
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['restaurants-switcher'],
    queryFn: async () => {
      const response = await restaurantAPI.getSwitcherList();
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 60000, // Cache for 60 seconds
  });

  // Filter restaurants based on search
  const filteredRestaurants = React.useMemo(() => {
    if (!searchQuery) return restaurants;
    const query = searchQuery.toLowerCase();
    return restaurants.filter(
      (r: Restaurant) =>
        r.name?.toLowerCase().includes(query) ||
        r.address?.toLowerCase().includes(query) ||
        r.city?.toLowerCase().includes(query)
    );
  }, [restaurants, searchQuery]);

  const handleSelect = (restaurantId: string) => {
    if (restaurantId !== currentRestaurantId) {
      navigate(`/restaurants/${restaurantId}`);
    }
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-start text-left group cursor-pointer",
            "hover:opacity-80 transition-opacity",
            disabled && "cursor-not-allowed opacity-50"
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {currentRestaurantName}
            </h1>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-sm text-muted-foreground">
            {currentRestaurantAddress || 'No address provided'}
          </p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search restaurants..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: '400px',
              overscrollBehavior: 'contain',
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No restaurants found.
              </div>
            ) : (
              <div className="p-1">
                {filteredRestaurants.map((restaurant: Restaurant) => (
                  <div
                    key={restaurant.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-accent transition-colors',
                      restaurant.id === currentRestaurantId && 'bg-accent'
                    )}
                    onClick={() => handleSelect(restaurant.id)}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        restaurant.id === currentRestaurantId ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {restaurant.name}
                      </div>
                      {restaurant.address && (
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {restaurant.address}
                        </div>
                      )}
                    </div>
                    {restaurant.onboarding_status && (
                      <StatusDot status={restaurant.onboarding_status} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default RestaurantSwitcher;
