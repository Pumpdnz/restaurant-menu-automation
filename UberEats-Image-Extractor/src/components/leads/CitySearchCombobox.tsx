import * as React from 'react';
import { Check, ChevronsUpDown, MapPin, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Command, CommandInput } from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { useCityCodes, CityCode } from '../../hooks/useLeadScrape';

interface CitySearchComboboxProps {
  value?: string;
  country?: string;
  onSelect: (city: CityCode | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Group cities by region
function groupCitiesByRegion(cities: CityCode[]): Record<string, CityCode[]> {
  return cities.reduce((acc, city) => {
    const region = city.region_code || 'Other';
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(city);
    return acc;
  }, {} as Record<string, CityCode[]>);
}

// Region display names
const regionNames: Record<string, string> = {
  AKL: 'Auckland',
  WLG: 'Wellington',
  CHC: 'Christchurch',
  HAM: 'Hamilton',
  TGA: 'Tauranga',
  DUN: 'Dunedin',
  PLN: 'Palmerston North',
  NAP: 'Napier/Hastings',
  NP: 'New Plymouth',
  ROT: 'Rotorua',
  WAN: 'Whanganui',
  GIS: 'Gisborne',
  NEL: 'Nelson',
  INV: 'Invercargill',
  QT: 'Queenstown',
  Other: 'Other Regions',
};

export function CitySearchCombobox({
  value,
  country = 'nz',
  onSelect,
  placeholder = 'Select city...',
  disabled = false,
}: CitySearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch cities for the selected country
  const { data, isLoading } = useCityCodes(country);
  const cities = data?.cities || [];

  // Find the selected city
  const selectedCity = cities.find((c) => c.city_code === value);

  // Filter cities based on search
  const filteredCities = React.useMemo(() => {
    if (!searchQuery) return cities;
    const query = searchQuery.toLowerCase();
    return cities.filter(
      (city) =>
        city.city_name.toLowerCase().includes(query) ||
        city.region_code?.toLowerCase().includes(query)
    );
  }, [cities, searchQuery]);

  // Group filtered cities by region
  const groupedCities = React.useMemo(
    () => groupCitiesByRegion(filteredCities),
    [filteredCities]
  );

  // Sort regions (Auckland first, then alphabetically)
  const sortedRegions = React.useMemo(() => {
    const regions = Object.keys(groupedCities);
    return regions.sort((a, b) => {
      if (a === 'AKL') return -1;
      if (b === 'AKL') return 1;
      if (a === 'WLG') return -1;
      if (b === 'WLG') return 1;
      if (a === 'CHC') return -1;
      if (b === 'CHC') return 1;
      return a.localeCompare(b);
    });
  }, [groupedCities]);

  const handleSelect = (cityCode: string) => {
    const city = cities.find((c) => c.city_code === cityCode);
    onSelect(city || null);
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
              Loading cities...
            </span>
          ) : selectedCity ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {selectedCity.city_name}
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
            placeholder="Search cities..."
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
            ) : filteredCities.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No cities found.
              </div>
            ) : (
              sortedRegions.map((region) => (
                <div key={region} className="px-1 py-1">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {regionNames[region] || region}
                  </div>
                  {groupedCities[region]
                    .sort((a, b) => a.city_name.localeCompare(b.city_name))
                    .map((city) => (
                      <div
                        key={city.id}
                        className={cn(
                          'flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-accent transition-colors',
                          value === city.city_code && 'bg-accent'
                        )}
                        onClick={() => handleSelect(city.city_code)}
                      >
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === city.city_code ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{city.city_name}</span>
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

export default CitySearchCombobox;
