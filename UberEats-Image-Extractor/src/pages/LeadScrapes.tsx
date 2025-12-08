import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Loader2,
  Users,
} from 'lucide-react';
import {
  useLeadScrapeJobs,
  usePendingLeads,
} from '../hooks/useLeadScrape';
import { ScrapeJobProgressCard } from '../components/leads/ScrapeJobProgressCard';
import { CreateLeadScrapeJob } from '../components/leads/CreateLeadScrapeJob';
import { PendingLeadsTable } from '../components/leads/PendingLeadsTable';

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

  // Jobs tab filters
  const [jobFilters, setJobFilters] = useState({
    search: '',
    status: [] as string[],
    platform: [] as string[],
  });

  // Pending leads tab filters
  const [pendingFilters, setPendingFilters] = useState({
    search: '',
    platform: [] as string[],
  });

  // Modal state
  const [createJobOpen, setCreateJobOpen] = useState(false);

  // Data fetching - Jobs
  const jobQueryFilters = useMemo(() => ({
    search: jobFilters.search || undefined,
    status: jobFilters.status.length > 0 ? jobFilters.status.join(',') : undefined,
    platform: jobFilters.platform.length > 0 ? jobFilters.platform.join(',') : undefined,
  }), [jobFilters]);

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useLeadScrapeJobs(jobQueryFilters);
  const jobs = jobsData?.jobs || [];

  // Data fetching - Pending leads
  const pendingQueryFilters = useMemo(() => ({
    search: pendingFilters.search || undefined,
    platform: pendingFilters.platform.length > 0 ? pendingFilters.platform.join(',') : undefined,
  }), [pendingFilters]);

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = usePendingLeads(pendingQueryFilters);
  const pendingLeads = pendingData?.leads || [];

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
    });
  };

  const handleResetPendingFilters = () => {
    setPendingFilters({
      search: '',
      platform: [],
    });
  };

  const hasJobFilters = jobFilters.search !== '' || jobFilters.status.length > 0 || jobFilters.platform.length > 0;
  const hasPendingFilters = pendingFilters.search !== '' || pendingFilters.platform.length > 0;

  return (
    <div className="p-6 space-y-6">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList size="full">
          <TabsTrigger size="full" variant="blue" value="jobs">Scrape Jobs</TabsTrigger>
          <TabsTrigger size="full" variant="blue" value="pending">
            Pending Leads
            {pendingLeads.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingLeads.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* SCRAPE JOBS TAB */}
        <TabsContent value="jobs" className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {hasPendingFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetPendingFilters}
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Platform Filter */}
              <MultiSelect
                options={[
                  { label: 'UberEats', value: 'ubereats' },
                  { label: 'DoorDash', value: 'doordash' },
                ]}
                selected={pendingFilters.platform}
                onChange={(selected) => setPendingFilters({ ...pendingFilters, platform: selected })}
                placeholder="Platform"
              />
            </div>
          </div>

          {/* Pending Leads Table Component */}
          <PendingLeadsTable
            leads={pendingLeads}
            isLoading={pendingLoading}
            onRefresh={refetchPending}
          />
        </TabsContent>
      </Tabs>

      {/* Create Lead Scrape Job Dialog */}
      <CreateLeadScrapeJob
        open={createJobOpen}
        onClose={() => setCreateJobOpen(false)}
        onSuccess={() => {
          refetchJobs();
        }}
      />
    </div>
  );
}
