import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Users,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import {
  useLeadScrapeJobs,
  usePendingLeads,
  usePendingLeadsFilterOptions,
  SortState,
  DEFAULT_PENDING_LEADS_SORT,
} from '../hooks/useLeadScrape';
import { ScrapeJobProgressCard } from '../components/leads/ScrapeJobProgressCard';
import { CreateLeadScrapeJob } from '../components/leads/CreateLeadScrapeJob';
import { PendingLeadsTable } from '../components/leads/PendingLeadsTable';
import { ReportsTabContent } from '../components/reports/ReportsTabContent';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { MultiSelect } from '../components/ui/multi-select';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '../components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

// Loading skeleton for job cards
function ScrapeJobCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-36" />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-4 w-4 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
      </CardFooter>
    </Card>
  );
}

// Loading skeleton for jobs list
function JobsListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <ScrapeJobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function LeadScrapes() {
  // Tab state from URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'jobs';

  // Get city/cuisine from URL params (for deep linking from Reports tab)
  const urlCity = searchParams.get('city') || '';
  const urlCuisine = searchParams.get('cuisine') || '';

  // Jobs tab filters - initialize with URL params if present
  const [jobFilters, setJobFilters] = useState({
    search: '',
    status: ['in_progress'] as string[],
    platform: [] as string[],
    city: urlCity,
    cuisine: urlCuisine,
    current_step: [] as string[],
  });

  // Pending leads tab filters - initialize with URL params if present
  const [pendingFilters, setPendingFilters] = useState({
    search: '',
    platform: [] as string[],
    city: urlCity ? [urlCity] : [] as string[],
    cuisine: urlCuisine ? [urlCuisine] : [] as string[],
  });

  // Pending leads pagination state
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingPageSize, setPendingPageSize] = useState(50);

  // Pending leads sort state
  const [pendingSortState, setPendingSortState] = useState<SortState>(DEFAULT_PENDING_LEADS_SORT);

  // Modal state
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [prefillScrapeData, setPrefillScrapeData] = useState<{
    city?: string;
    cuisine?: string;
    pageOffset?: number;
  } | null>(null);

  // Data fetching - Jobs
  const jobQueryFilters = useMemo(() => ({
    search: jobFilters.search || undefined,
    status: jobFilters.status.length > 0 ? jobFilters.status.join(',') : undefined,
    platform: jobFilters.platform.length > 0 ? jobFilters.platform.join(',') : undefined,
    city: jobFilters.city || undefined,
    cuisine: jobFilters.cuisine || undefined,
    current_step: jobFilters.current_step.length > 0 ? jobFilters.current_step.join(',') : undefined,
  }), [jobFilters]);

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useLeadScrapeJobs(jobQueryFilters);
  const jobs = jobsData?.jobs || [];

  // Data fetching - Pending leads
  const pendingQueryFilters = useMemo(() => ({
    search: pendingFilters.search || undefined,
    platform: pendingFilters.platform.length > 0 ? pendingFilters.platform.join(',') : undefined,
    city: pendingFilters.city.length > 0 ? pendingFilters.city.join(',') : undefined,
    cuisine: pendingFilters.cuisine.length > 0 ? pendingFilters.cuisine.join(',') : undefined,
    limit: pendingPageSize,
    offset: pendingPage * pendingPageSize,
  }), [pendingFilters, pendingPage, pendingPageSize]);

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = usePendingLeads(pendingQueryFilters);
  const pendingLeads = pendingData?.leads || [];

  // Fetch filter options for pending leads
  const { data: filterOptionsData } = usePendingLeadsFilterOptions();
  const cityOptions = (filterOptionsData?.cities || []).map(city => ({ label: city, value: city }));
  const cuisineOptions = (filterOptionsData?.cuisines || []).map(cuisine => ({ label: cuisine.charAt(0).toUpperCase() + cuisine.slice(1), value: cuisine }));

  // Tab change handler
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Filter reset handlers
  const handleResetJobFilters = () => {
    setJobFilters({
      search: '',
      status: [],
      platform: [],
      city: '',
      cuisine: '',
      current_step: [],
    });
    // Clear URL params
    setSearchParams({ tab: activeTab });
  };

  const handleResetPendingFilters = () => {
    setPendingFilters({
      search: '',
      platform: [],
      city: [],
      cuisine: [],
    });
    setPendingPage(0); // Reset pagination
    // Clear URL params (keep only tab)
    setSearchParams({ tab: activeTab });
  };

  // Helper to update pending filters and reset pagination
  const updatePendingFilters = (newFilters: typeof pendingFilters) => {
    setPendingFilters(newFilters);
    setPendingPage(0); // Reset to first page when filters change
  };

  const hasJobFilters = jobFilters.search !== '' || jobFilters.status.length > 0 || jobFilters.platform.length > 0 || jobFilters.city !== '' || jobFilters.cuisine !== '' || jobFilters.current_step.length > 0;
  const hasPendingFilters = pendingFilters.search !== '' || pendingFilters.platform.length > 0 || pendingFilters.city.length > 0 || pendingFilters.cuisine.length > 0;

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col -mt-6 -mb-6">
      {/* Sticky Header + Tabs */}
      <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Lead Scraping</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Extract and enrich restaurant leads from delivery platforms
            </p>
          </div>
          <Button
            onClick={() => setCreateJobOpen(true)}
            className="bg-gradient-to-r from-brand-blue to-brand-green"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Lead Scrape
          </Button>
        </div>

        {/* TabsList */}
        <TabsList size="full">
          <TabsTrigger size="full" variant="blue" value="jobs">Scrape Jobs</TabsTrigger>
          <TabsTrigger size="full" variant="blue" value="pending">
            Pending Leads
            {(pendingData?.pagination?.total || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingData?.pagination?.total || 0}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger size="full" variant="blue" value="reports">
            <BarChart3 className="h-4 w-4 mr-1" />
            Reports
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Scrollable Content */}
      <div className="pt-6 space-y-6">
        {/* SCRAPE JOBS TAB */}
        <TabsContent value="jobs" className="space-y-6 mt-0">
          {/* Filters Card */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h3 className="font-medium">Filters</h3>
              </div>
              {hasJobFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetJobFilters}
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Search Input */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or cuisine..."
                  value={jobFilters.search}
                  onChange={(e) => setJobFilters({ ...jobFilters, search: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <MultiSelect
                options={[
                  { label: 'Draft', value: 'draft' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'In Progress', value: 'in_progress' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' },
                  { label: 'Failed', value: 'failed' },
                ]}
                selected={jobFilters.status}
                onChange={(selected) => setJobFilters({ ...jobFilters, status: selected })}
                placeholder="Status"
              />

              {/* Platform Filter */}
              <MultiSelect
                options={[
                  { label: 'UberEats', value: 'ubereats' },
                  { label: 'DoorDash', value: 'doordash' },
                ]}
                selected={jobFilters.platform}
                onChange={(selected) => setJobFilters({ ...jobFilters, platform: selected })}
                placeholder="Platform"
              />

              {/* City Filter */}
              <MultiSelect
                options={cityOptions}
                selected={jobFilters.city ? [jobFilters.city] : []}
                onChange={(selected) => setJobFilters({ ...jobFilters, city: selected[selected.length - 1] || '' })}
                placeholder="City"
              />

              {/* Cuisine Filter */}
              <MultiSelect
                options={cuisineOptions}
                selected={jobFilters.cuisine ? [jobFilters.cuisine] : []}
                onChange={(selected) => setJobFilters({ ...jobFilters, cuisine: selected[selected.length - 1] || '' })}
                placeholder="Cuisine"
              />

              {/* Current Step Filter */}
              <MultiSelect
                options={[
                  { label: 'Step 1 (Extract)', value: '1' },
                  { label: 'Step 2 (Enrich)', value: '2' },
                  { label: 'Step 3 (Quality)', value: '3' },
                  { label: 'Step 4 (Store)', value: '4' },
                  { label: 'Step 5 (Complete)', value: '5' },
                ]}
                selected={jobFilters.current_step}
                onChange={(selected) => setJobFilters({ ...jobFilters, current_step: selected })}
                placeholder="Current Step"
              />
            </div>
          </div>

          {/* Jobs List */}
          {jobsLoading && <JobsListSkeleton />}

          {!jobsLoading && jobs.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No scrape jobs found</h3>
              <p className="text-muted-foreground mb-4">
                {hasJobFilters
                  ? 'Try adjusting your filters'
                  : 'Get started by creating a new lead scrape'}
              </p>
              {!hasJobFilters && (
                <Button onClick={() => setCreateJobOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Lead Scrape
                </Button>
              )}
            </div>
          )}

          {!jobsLoading && jobs.length > 0 && (
            <div className="space-y-4">
              {jobs.map((job) => (
                <ScrapeJobProgressCard
                  key={job.id}
                  job={job}
                  onRefresh={refetchJobs}
                />
              ))}
            </div>
          )}

          {/* Results Count */}
          {!jobsLoading && jobs.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </div>
          )}
        </TabsContent>

        {/* PENDING LEADS TAB */}
        <TabsContent value="pending" className="space-y-6">
          {/* Filters Card */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h3 className="font-medium">Filters</h3>
              </div>
              <div className="flex items-center gap-2">
                {hasPendingFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPendingFilters}
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchPending()}
                  disabled={pendingLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${pendingLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search Input */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants..."
                  value={pendingFilters.search}
                  onChange={(e) => updatePendingFilters({ ...pendingFilters, search: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* Platform Filter */}
              <MultiSelect
                options={[
                  { label: 'UberEats', value: 'ubereats' },
                  { label: 'DoorDash', value: 'doordash' },
                ]}
                selected={pendingFilters.platform}
                onChange={(selected) => updatePendingFilters({ ...pendingFilters, platform: selected })}
                placeholder="Platform"
              />

              {/* City Filter */}
              <MultiSelect
                options={cityOptions}
                selected={pendingFilters.city}
                onChange={(selected) => updatePendingFilters({ ...pendingFilters, city: selected })}
                placeholder="City"
              />

              {/* Cuisine Filter */}
              <MultiSelect
                options={cuisineOptions}
                selected={pendingFilters.cuisine}
                onChange={(selected) => updatePendingFilters({ ...pendingFilters, cuisine: selected })}
                placeholder="Cuisine"
              />
            </div>
          </div>

          {/* Pending Leads Table Component */}
          <PendingLeadsTable
            leads={pendingLeads}
            isLoading={pendingLoading}
            onRefresh={refetchPending}
            sortState={pendingSortState}
            onSortChange={setPendingSortState}
            pagination={pendingData?.pagination?.total ? {
              total: pendingData.pagination.total,
              page: pendingPage,
              pageSize: pendingPageSize,
              onPageChange: setPendingPage,
              onPageSizeChange: (size) => {
                setPendingPageSize(size);
                setPendingPage(0); // Reset to first page when page size changes
              },
            } : undefined}
          />
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="space-y-6 mt-0">
          <ReportsTabContent
            onStartScrape={(params) => {
              setPrefillScrapeData(params);
              setCreateJobOpen(true);
            }}
          />
        </TabsContent>
      </div>

      {/* Create Lead Scrape Job Dialog */}
      <CreateLeadScrapeJob
        open={createJobOpen}
        onClose={() => {
          setCreateJobOpen(false);
          setPrefillScrapeData(null);
        }}
        onSuccess={() => {
          refetchJobs();
          setPrefillScrapeData(null);
        }}
        prefillCity={prefillScrapeData?.city}
        prefillCuisine={prefillScrapeData?.cuisine}
        prefillPageOffset={prefillScrapeData?.pageOffset}
      />
    </Tabs>
  );
}
