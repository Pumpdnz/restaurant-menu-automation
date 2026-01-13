import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { OpportunityCard } from './OpportunityCard';
import {
  useAnalyticsOpportunities,
  AnalyticsFilters,
  Opportunity
} from '@/hooks/useLeadScrapeAnalytics';
import { useCityCodes, useCuisines, CityCode } from '@/hooks/useLeadScrape';
import { X, Search, MapPin, Utensils, Flag } from 'lucide-react';

interface OpportunitiesTabProps {
  filters: AnalyticsFilters;
  onStartScrape: (opportunity: Opportunity) => void;
}

const STORAGE_KEY = 'opportunities-filter-preferences';

// Default cities to enable (by city_name)
const DEFAULT_CITIES = [
  'Auckland', 'Rotorua', 'Tauranga', 'Ashburton', 'Christchurch',
  'Hastings', 'Napier', 'Palmerston North', 'Whanganui', 'Nelson',
  'Kerikeri', 'Whangarei', 'Dunedin', 'Queenstown', 'Invercargill',
  'New Plymouth', 'Wellington', 'Hamilton'
];

// Default cuisines to enable (by slug)
const DEFAULT_CUISINES = [
  'bbq', 'burger', 'chinese', 'fish-and-chips', 'greek', 'indian',
  'italian', 'japanese', 'kebabs', 'korean', 'latin-american',
  'mediterranean', 'mexican', 'middle-eastern', 'pasta', 'pho',
  'pizza', 'pollo', 'ribs', 'south-american', 'spanish', 'thai',
  'turkish', 'vietnamese'
];

// Region display names for NZ
const regionNames: Record<string, string> = {
  auk: 'Auckland',
  bop: 'Bay of Plenty',
  can: 'Canterbury',
  hkb: "Hawke's Bay",
  mwt: 'Manawatū-Whanganui',
  nsn: 'Nelson',
  ntl: 'Northland',
  ota: 'Otago',
  stl: 'Southland',
  tki: 'Taranaki',
  wgn: 'Wellington',
  wko: 'Waikato',
  gis: 'Gisborne',
  mbh: 'Marlborough',
  tas: 'Tasman',
  wtc: 'West Coast',
};

// Region sort order (major regions first)
const regionSortOrder = ['auk', 'wgn', 'can', 'wko', 'bop', 'ota', 'hkb', 'mwt', 'ntl', 'tki', 'nsn', 'stl'];

// Load filter preferences from localStorage
function loadFilterPreferences(): { cities: string[]; cuisines: string[] } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load filter preferences:', e);
  }
  return null;
}

// Save filter preferences to localStorage
function saveFilterPreferences(cities: string[], cuisines: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cities, cuisines }));
  } catch (e) {
    console.error('Failed to save filter preferences:', e);
  }
}

// Group cities by region
function groupCitiesByRegion(cities: CityCode[]): Record<string, CityCode[]> {
  return cities.reduce((acc, city) => {
    const region = city.region_code?.toLowerCase() || 'other';
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(city);
    return acc;
  }, {} as Record<string, CityCode[]>);
}

export function OpportunitiesTab({ filters, onStartScrape }: OpportunitiesTabProps) {
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set(['high', 'medium', 'low']));
  const [sortBy, setSortBy] = useState<string>('score');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cuisineSearch, setCuisineSearch] = useState('');

  const { data: opportunities, isLoading: opportunitiesLoading } = useAnalyticsOpportunities(filters);
  const { data: citiesData, isLoading: citiesLoading } = useCityCodes('nz');
  const { data: cuisinesData, isLoading: cuisinesLoading } = useCuisines();

  const allCities = citiesData?.cities || [];
  const allCuisines = cuisinesData?.cuisines || [];

  // Group and sort cities by region
  const groupedCities = useMemo(() => groupCitiesByRegion(allCities), [allCities]);
  const sortedRegions = useMemo(() => {
    const regions = Object.keys(groupedCities);
    return regions.sort((a, b) => {
      const aIdx = regionSortOrder.indexOf(a);
      const bIdx = regionSortOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [groupedCities]);

  // Filter cities by search
  const filteredGroupedCities = useMemo(() => {
    if (!citySearch) return groupedCities;
    const query = citySearch.toLowerCase();
    const filtered: Record<string, CityCode[]> = {};
    for (const [region, cities] of Object.entries(groupedCities)) {
      const matchingCities = cities.filter(c =>
        c.city_name.toLowerCase().includes(query)
      );
      if (matchingCities.length > 0) {
        filtered[region] = matchingCities;
      }
    }
    return filtered;
  }, [groupedCities, citySearch]);

  // Filter cuisines by search
  const filteredCuisines = useMemo(() => {
    if (!cuisineSearch) return allCuisines;
    const query = cuisineSearch.toLowerCase();
    return allCuisines.filter(c =>
      c.display_name.toLowerCase().includes(query) ||
      c.slug.toLowerCase().includes(query)
    );
  }, [allCuisines, cuisineSearch]);

  // Initialize filters from localStorage or defaults when data loads
  useEffect(() => {
    if (!isInitialized && allCities.length > 0 && allCuisines.length > 0) {
      const saved = loadFilterPreferences();
      if (saved) {
        // Use saved preferences, but only include cities/cuisines that still exist
        const validCities = saved.cities.filter(c => allCities.some(city => city.city_name === c));
        const validCuisines = saved.cuisines.filter(c => allCuisines.some(cuisine => cuisine.slug === c));
        setSelectedCities(new Set(validCities));
        setSelectedCuisines(new Set(validCuisines));
      } else {
        // Use defaults
        const defaultCitySet = new Set(
          allCities.filter(c => DEFAULT_CITIES.includes(c.city_name)).map(c => c.city_name)
        );
        const defaultCuisineSet = new Set(
          allCuisines.filter(c => DEFAULT_CUISINES.includes(c.slug)).map(c => c.slug)
        );
        setSelectedCities(defaultCitySet);
        setSelectedCuisines(defaultCuisineSet);
      }
      setIsInitialized(true);
    }
  }, [isInitialized, allCities, allCuisines]);

  // Save preferences when they change
  useEffect(() => {
    if (isInitialized) {
      saveFilterPreferences([...selectedCities], [...selectedCuisines]);
    }
  }, [selectedCities, selectedCuisines, isInitialized]);

  const toggleCity = (cityName: string) => {
    const newSet = new Set(selectedCities);
    if (newSet.has(cityName)) {
      newSet.delete(cityName);
    } else {
      newSet.add(cityName);
    }
    setSelectedCities(newSet);
  };

  const toggleCuisine = (slug: string) => {
    const newSet = new Set(selectedCuisines);
    if (newSet.has(slug)) {
      newSet.delete(slug);
    } else {
      newSet.add(slug);
    }
    setSelectedCuisines(newSet);
  };

  const selectAllCities = () => setSelectedCities(new Set(allCities.map(c => c.city_name)));
  const clearAllCities = () => setSelectedCities(new Set());
  const selectDefaultCities = () => setSelectedCities(new Set(
    allCities.filter(c => DEFAULT_CITIES.includes(c.city_name)).map(c => c.city_name)
  ));

  const selectAllCuisines = () => setSelectedCuisines(new Set(allCuisines.map(c => c.slug)));
  const clearAllCuisines = () => setSelectedCuisines(new Set());
  const selectDefaultCuisines = () => setSelectedCuisines(new Set(
    allCuisines.filter(c => DEFAULT_CUISINES.includes(c.slug)).map(c => c.slug)
  ));

  const isLoading = opportunitiesLoading || citiesLoading || cuisinesLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  let filtered = opportunities ?? [];

  // Apply city filter
  if (selectedCities.size > 0) {
    filtered = filtered.filter(o => selectedCities.has(o.city));
  }

  // Apply cuisine filter - match by slug
  if (selectedCuisines.size > 0) {
    filtered = filtered.filter(o => selectedCuisines.has(o.cuisine));
  }

  // Apply priority filter
  if (selectedPriorities.size > 0 && selectedPriorities.size < 3) {
    filtered = filtered.filter(o => selectedPriorities.has(o.priority));
  }

  // Apply sorting
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return b.opportunity_score - a.opportunity_score;
      case 'leads':
        return a.current_leads - b.current_leads;
      case 'city':
        return a.city.localeCompare(b.city);
      default:
        return 0;
    }
  });

  const activeFilterCount =
    (selectedCities.size < allCities.length && selectedCities.size > 0 ? 1 : 0) +
    (selectedCuisines.size < allCuisines.length && selectedCuisines.size > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Priority Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Flag className="h-4 w-4" />
              Priority ({selectedPriorities.size}/3)
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              {[
                { value: 'high', label: 'High', color: 'text-red-500' },
                { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
                { value: 'low', label: 'Low', color: 'text-green-500' },
              ].map(({ value, label, color }) => (
                <label key={value} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded">
                  <Checkbox
                    checked={selectedPriorities.has(value)}
                    onCheckedChange={() => {
                      const newSet = new Set(selectedPriorities);
                      if (newSet.has(value)) {
                        newSet.delete(value);
                      } else {
                        newSet.add(value);
                      }
                      setSelectedPriorities(newSet);
                    }}
                  />
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-1 mt-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs flex-1"
                onClick={() => setSelectedPriorities(new Set(['high', 'medium', 'low']))}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs flex-1"
                onClick={() => setSelectedPriorities(new Set())}
              >
                None
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-40">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Opportunity Score</SelectItem>
              <SelectItem value="leads">Lowest Leads</SelectItem>
              <SelectItem value="city">City Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* City Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <MapPin className="h-4 w-4" />
              Cities ({selectedCities.size}/{allCities.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cities..."
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={selectAllCities}>
                  All
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={selectDefaultCities}>
                  Defaults
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAllCities}>
                  None
                </Button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {/* Default Cities Section */}
              {!citySearch && (
                <div className="border-b">
                  <div className="text-xs font-medium text-muted-foreground px-4 py-2 bg-muted/50">
                    Default Cities
                  </div>
                  <div className="p-2">
                    {allCities
                      .filter(c => DEFAULT_CITIES.includes(c.city_name))
                      .sort((a, b) => a.city_name.localeCompare(b.city_name))
                      .map(city => (
                        <label key={`default-${city.city_code}`} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded">
                          <Checkbox
                            checked={selectedCities.has(city.city_name)}
                            onCheckedChange={() => toggleCity(city.city_name)}
                          />
                          <span className="text-sm">{city.city_name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
              {/* All Cities by Region */}
              <div className="p-2">
                {Object.keys(filteredGroupedCities).length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No cities found
                  </div>
                ) : (
                  sortedRegions
                    .filter(region => filteredGroupedCities[region])
                    .map(region => (
                      <div key={region}>
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 sticky top-0 bg-popover z-10">
                          {regionNames[region] || region.toUpperCase()}
                        </div>
                        {filteredGroupedCities[region]
                          .sort((a, b) => a.city_name.localeCompare(b.city_name))
                          .map(city => (
                            <label key={city.city_code} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded">
                              <Checkbox
                                checked={selectedCities.has(city.city_name)}
                                onCheckedChange={() => toggleCity(city.city_name)}
                              />
                              <span className="text-sm">{city.city_name}</span>
                            </label>
                          ))}
                      </div>
                    ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Cuisine Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Utensils className="h-4 w-4" />
              Cuisines ({selectedCuisines.size}/{allCuisines.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cuisines..."
                  value={cuisineSearch}
                  onChange={(e) => setCuisineSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={selectAllCuisines}>
                  All
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={selectDefaultCuisines}>
                  Defaults
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAllCuisines}>
                  None
                </Button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {/* Default Cuisines Section */}
              {!cuisineSearch && (
                <div className="border-b">
                  <div className="text-xs font-medium text-muted-foreground px-4 py-2 bg-muted/50">
                    Default Cuisines
                  </div>
                  <div className="p-2">
                    {allCuisines
                      .filter(c => DEFAULT_CUISINES.includes(c.slug))
                      .sort((a, b) => a.display_name.localeCompare(b.display_name))
                      .map(cuisine => (
                        <label key={`default-${cuisine.slug}`} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded">
                          <Checkbox
                            checked={selectedCuisines.has(cuisine.slug)}
                            onCheckedChange={() => toggleCuisine(cuisine.slug)}
                          />
                          <span className="text-sm">{cuisine.display_name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
              {/* All Cuisines */}
              <div className="p-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 sticky top-0 bg-popover z-10">
                  All Cuisines
                </div>
                {filteredCuisines.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No cuisines found
                  </div>
                ) : (
                  filteredCuisines
                    .sort((a, b) => a.display_name.localeCompare(b.display_name))
                    .map(cuisine => (
                      <label key={cuisine.slug} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded">
                        <Checkbox
                          checked={selectedCuisines.has(cuisine.slug)}
                          onCheckedChange={() => toggleCuisine(cuisine.slug)}
                        />
                        <span className="text-sm">{cuisine.display_name}</span>
                      </label>
                    ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active filter indicator */}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            <button
              className="ml-1 hover:bg-muted rounded"
              onClick={() => {
                selectDefaultCities();
                selectDefaultCuisines();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Opportunity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((opportunity) => (
          <OpportunityCard
            key={`${opportunity.city}-${opportunity.cuisine}`}
            opportunity={opportunity}
            onStartScrape={onStartScrape}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No opportunities found</p>
          <p className="text-sm mt-1">
            {selectedCities.size === 0 || selectedCuisines.size === 0
              ? 'Select at least one city and cuisine to see opportunities'
              : selectedPriorities.size === 0
                ? 'Select at least one priority level'
                : selectedPriorities.size < 3
                  ? 'Try adjusting your filters'
                  : 'Great coverage! All city/cuisine combinations have been scraped.'}
          </p>
        </div>
      )}
    </div>
  );
}
