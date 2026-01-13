import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Layers,
  RefreshCw,
  Play,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Store,
  ArrowUp,
  ArrowDown,
  X,
  MapPin,
  Utensils,
} from 'lucide-react';

import {
  useRegistrationBatches,
  useStartRegistrationBatch,
  useCancelRegistrationBatch,
  RegistrationBatchJob,
  REGISTRATION_STEPS,
  RegistrationBatchFilters,
} from '../hooks/useRegistrationBatch';
import { useCityCodes, useCuisines, CityCode } from '../hooks/useLeadScrape';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { MultiSelect } from '../components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { cn } from '../lib/utils';

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

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    pending: { variant: 'secondary' },
    in_progress: { variant: 'default', className: 'bg-blue-500' },
    completed: { variant: 'default', className: 'bg-green-500' },
    failed: { variant: 'destructive' },
    cancelled: { variant: 'outline' },
  };

  const config = variants[status] || { variant: 'secondary' };

  return (
    <Badge variant={config.variant} className={config.className}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

// Step indicator component
function StepIndicator({
  step,
  currentStep,
  isActionRequired,
}: {
  step: number;
  currentStep: number;
  isActionRequired: boolean;
}) {
  const isCompleted = step < currentStep;
  const isCurrent = step === currentStep;

  return (
    <div
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
        isCompleted && 'bg-green-500 text-white',
        isCurrent && isActionRequired && 'bg-orange-500 text-white',
        isCurrent && !isActionRequired && 'bg-blue-500 text-white',
        !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
      )}
      title={REGISTRATION_STEPS[step - 1]?.step_name}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : isCurrent && isActionRequired ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        step
      )}
    </div>
  );
}

// Batch progress card component - now optimized for grid layout
function BatchProgressCard({
  batch,
  onRefresh,
}: {
  batch: RegistrationBatchJob;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const startMutation = useStartRegistrationBatch();
  const cancelMutation = useCancelRegistrationBatch();
  const [isRestaurantListExpanded, setIsRestaurantListExpanded] = useState(false);

  const progress = batch.total_restaurants > 0
    ? Math.round(
        ((batch.completed_restaurants + batch.failed_restaurants) / batch.total_restaurants) * 100
      )
    : 0;

  const currentStepDef = REGISTRATION_STEPS[batch.current_step - 1];
  const isActionRequired = currentStepDef?.step_type === 'action_required';

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight line-clamp-2">{batch.name}</CardTitle>
            <StatusBadge status={batch.status} />
          </div>
          <CardDescription className="text-xs">
            {batch.completed_restaurants}/{batch.total_restaurants} completed
            {batch.failed_restaurants > 0 && `, ${batch.failed_restaurants} failed`}
          </CardDescription>

          {/* Step indicators */}
          <div className="flex gap-1 pt-1">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <StepIndicator
                key={step}
                step={step}
                currentStep={batch.current_step}
                isActionRequired={step === batch.current_step && isActionRequired}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <div className="space-y-3">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {/* Current step */}
          <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-1">
            <span>Step {batch.current_step}: {currentStepDef?.step_name || 'Unknown'}</span>
            {isActionRequired && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px] px-1 py-0">
                Action
              </Badge>
            )}
          </div>

          {/* Restaurant preview */}
          {batch.jobs && batch.jobs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {batch.jobs.slice(0, isRestaurantListExpanded ? undefined : 3).map((job) => (
                <a
                  key={job.id}
                  href={`/restaurants/${job.restaurant_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[10px] bg-muted/50 px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                  title={job.restaurant?.city ? `${job.restaurant.name} - ${job.restaurant.city}` : job.restaurant?.name}
                >
                  <Store className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="truncate max-w-[80px]">{job.restaurant?.name || 'Unknown'}</span>
                </a>
              ))}
              {batch.jobs.length > 3 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRestaurantListExpanded(!isRestaurantListExpanded);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 hover:bg-muted/50 rounded transition-colors"
                >
                  {isRestaurantListExpanded ? 'Less' : `+${batch.jobs.length - 3}`}
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex justify-between gap-2">
        <div className="flex gap-1">
          {batch.status === 'pending' && (
            <Button
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => startMutation.mutate(batch.id)}
              disabled={startMutation.isPending}
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          {batch.status === 'in_progress' && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs px-2"
              onClick={() => cancelMutation.mutate(batch.id)}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => navigate(`/registration-batches/${batch.id}`)}
          >
            Details
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// Loading skeleton for grid layout
function BatchCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-1 pt-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-6 w-6 rounded-full" />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Skeleton className="h-7 w-16" />
        <div className="flex-1" />
        <Skeleton className="h-7 w-20" />
      </CardFooter>
    </Card>
  );
}

// Sort options
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'total_restaurants', label: 'Restaurant Count' },
  { value: 'current_step', label: 'Current Step' },
  { value: 'name', label: 'Name' },
];

// Step filter options
const STEP_OPTIONS = REGISTRATION_STEPS.map((step) => ({
  value: step.step_number.toString(),
  label: `Step ${step.step_number}: ${step.step_name}`,
}));

export default function RegistrationBatches() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'active';

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(new Set());
  const [citySearch, setCitySearch] = useState('');
  const [cuisineSearch, setCuisineSearch] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<RegistrationBatchFilters['sort_by']>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch city and cuisine options
  const { data: citiesData } = useCityCodes('nz');
  const { data: cuisinesData } = useCuisines();

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

  // Initialize filters with defaults when data loads
  useEffect(() => {
    if (!isInitialized && allCities.length > 0 && allCuisines.length > 0) {
      const defaultCitySet = new Set(
        allCities.filter(c => DEFAULT_CITIES.includes(c.city_name)).map(c => c.city_name)
      );
      const defaultCuisineSet = new Set(
        allCuisines.filter(c => DEFAULT_CUISINES.includes(c.slug)).map(c => c.slug)
      );
      setSelectedCities(defaultCitySet);
      setSelectedCuisines(defaultCuisineSet);
      setIsInitialized(true);
    }
  }, [isInitialized, allCities, allCuisines]);

  // City toggle handlers
  const toggleCity = (cityName: string) => {
    const newSet = new Set(selectedCities);
    if (newSet.has(cityName)) {
      newSet.delete(cityName);
    } else {
      newSet.add(cityName);
    }
    setSelectedCities(newSet);
  };

  const selectAllCities = () => setSelectedCities(new Set(allCities.map(c => c.city_name)));
  const clearAllCities = () => setSelectedCities(new Set());
  const selectDefaultCities = () => setSelectedCities(new Set(
    allCities.filter(c => DEFAULT_CITIES.includes(c.city_name)).map(c => c.city_name)
  ));

  // Cuisine toggle handlers
  const toggleCuisine = (slug: string) => {
    const newSet = new Set(selectedCuisines);
    if (newSet.has(slug)) {
      newSet.delete(slug);
    } else {
      newSet.add(slug);
    }
    setSelectedCuisines(newSet);
  };

  const selectAllCuisines = () => setSelectedCuisines(new Set(allCuisines.map(c => c.slug)));
  const clearAllCuisines = () => setSelectedCuisines(new Set());
  const selectDefaultCuisines = () => setSelectedCuisines(new Set(
    allCuisines.filter(c => DEFAULT_CUISINES.includes(c.slug)).map(c => c.slug)
  ));

  // Build filters based on active tab and selections
  const filters = useMemo(() => {
    const statusMap: Record<string, string[]> = {
      active: ['pending', 'in_progress'],
      completed: ['completed'],
      failed: ['failed', 'cancelled'],
    };

    return {
      status: statusMap[activeTab] || statusMap.active,
      search: searchQuery || undefined,
      current_step: selectedSteps.length > 0 ? selectedSteps : undefined,
      city: selectedCities.size > 0 ? [...selectedCities] : undefined,
      cuisine: selectedCuisines.size > 0 ? [...selectedCuisines] : undefined,
      sort_by: sortBy,
      sort_direction: sortDirection,
    };
  }, [activeTab, searchQuery, selectedSteps, selectedCities, selectedCuisines, sortBy, sortDirection]);

  const { data, isLoading, refetch } = useRegistrationBatches(filters);
  const batches = data?.batch_jobs || [];
  const totalCount = data?.total_count || 0;

  // Tab change handler
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSteps([]);
    selectDefaultCities();
    selectDefaultCuisines();
    setSortBy('created_at');
    setSortDirection('desc');
  };

  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Count active filters (city/cuisine different from all)
  const activeFilterCount =
    (selectedCities.size < allCities.length && selectedCities.size > 0 ? 1 : 0) +
    (selectedCuisines.size < allCuisines.length && selectedCuisines.size > 0 ? 1 : 0);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col -mt-6 -mb-6">
      {/* Sticky Header + Tabs + Filters */}
      <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Registration Batches</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Orchestrate restaurant registration from leads to Pumpd accounts
            </p>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="active">
              Active
              {activeTab === 'active' && totalCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48 h-9"
            />
          </div>

          {/* Current Step Filter */}
          <MultiSelect
            options={STEP_OPTIONS}
            selected={selectedSteps}
            onChange={setSelectedSteps}
            placeholder="Current Step"
            className="w-44"
          />

          {/* City Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-9">
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
              <Button variant="outline" size="sm" className="gap-1 h-9">
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

          {/* Sort */}
          <div className="flex items-center gap-1">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as RegistrationBatchFilters['sort_by'])}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={toggleSortDirection}
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Active filter indicator */}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              <button
                className="ml-1 hover:bg-muted rounded"
                onClick={handleClearFilters}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="pt-6">
        <TabsContent value={activeTab} className="mt-0">
          {/* Loading State - Grid */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <BatchCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && batches.length === 0 && (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No batches found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedSteps.length > 0
                  ? 'Try adjusting your filters'
                  : activeTab === 'active'
                  ? 'Convert leads to restaurants to create a registration batch'
                  : activeTab === 'completed'
                  ? 'No completed batches yet'
                  : 'No failed batches'}
              </p>
              {activeTab === 'active' && !searchQuery && selectedSteps.length === 0 && (
                <Button onClick={() => navigate('/leads?tab=pending')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Go to Pending Leads
                </Button>
              )}
              {(searchQuery || selectedSteps.length > 0) && (
                <Button variant="outline" onClick={handleClearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {/* Batch Cards - 3 Column Grid */}
          {!isLoading && batches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((batch) => (
                <BatchProgressCard
                  key={batch.id}
                  batch={batch}
                  onRefresh={refetch}
                />
              ))}
            </div>
          )}

          {/* Results Count */}
          {!isLoading && batches.length > 0 && (
            <div className="text-sm text-muted-foreground text-center mt-6">
              Showing {batches.length} of {totalCount} batch{totalCount !== 1 ? 'es' : ''}
            </div>
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}
