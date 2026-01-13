import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../services/api';

// ============================================================================
// TYPES
// ============================================================================

export interface LeadScrapeJob {
  id: string;
  name: string;
  platform: string;
  country: string;
  city: string;
  city_code: string;
  region_code: string;
  cuisine: string;
  leads_limit: number;
  page_offset: number;
  initial_url: string | null;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  current_step: number;
  total_steps: number;
  leads_extracted: number;
  leads_passed: number;
  leads_failed: number;
  organisation_id: string;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
  steps?: LeadScrapeJobStep[];
  // Lead statistics (populated by backend)
  lead_stats?: {
    total_extracted: number;
    unprocessed: number;
    processed: number;
    pending: number;
    converted: number;
  };
}

export interface LeadScrapeJobStep {
  id: string;
  job_id: string;
  step_number: number;
  step_name: string;
  step_description: string;
  step_type: 'automatic' | 'action_required';
  status: 'pending' | 'in_progress' | 'action_required' | 'completed' | 'failed';
  target_url_template: string | null;
  leads_received: number;
  leads_processed: number;
  leads_passed: number;
  leads_failed: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
}

export interface Lead {
  id: string;
  lead_scrape_job_id: string;
  restaurant_name: string;
  store_link: string | null;
  platform: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  current_step: number;
  step_progression_status: 'available' | 'processing' | 'processed' | 'passed' | 'failed';

  // UberEats enrichment fields (Step 2)
  ubereats_number_of_reviews: string | null;
  ubereats_average_review_rating: number | null;
  ubereats_address: string | null;
  ubereats_cuisine: string[] | null;
  ubereats_price_rating: number | null;

  // Google enrichment fields (Step 3)
  google_number_of_reviews: string | null;
  google_average_review_rating: number | null;
  google_address: string | null;

  // Contact information
  phone: string | null;
  email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_maps_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  organisation_name: string | null;
  number_of_venues: number | null;

  // Business details
  opening_hours: any | null;
  opening_hours_text: string | null;
  website_type: string | null;

  // Header images
  website_og_image: string | null;
  ubereats_og_image: string | null;
  doordash_og_image: string | null;
  facebook_cover_image: string | null;
  online_ordering_platform: string | null;
  online_ordering_handles_delivery: boolean | null;

  // Ordering Platform Discovery (Step 4)
  ordering_platform_url: string | null;
  ordering_platform_name: string | null;
  ordering_source: 'website' | 'google_search' | 'not_found' | null;

  // Validation & status
  validation_errors: string[];
  is_valid: boolean;
  is_duplicate: boolean;
  duplicate_of_lead_id: string | null;
  duplicate_of_restaurant_id: string | null;

  // Conversion tracking
  converted_to_restaurant_id: string | null;
  converted_at: string | null;
  converted_by: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  metadata: any;
}

export interface CityCode {
  id: string;
  country: string;
  city_name: string;
  city_code: string;
  region_code: string;
  ubereats_slug: string;
}

export interface UberEatsCuisine {
  id: string;
  display_name: string;
  slug: string;
}

export interface CreateLeadScrapeJobRequest {
  platform: string;
  country?: string;
  city: string;
  cuisine: string;
  leads_limit?: number;
  page_offset?: number;
  save_as_draft?: boolean;
}

export interface LeadScrapeJobFilters {
  search?: string;
  status?: string;
  platform?: string;
  city?: string;
  cuisine?: string;
  current_step?: string;
  started_after?: string;
  started_before?: string;
  limit?: number;
  offset?: number;
}

export interface PendingLeadsFilters {
  search?: string;
  platform?: string;
  city?: string;
  cuisine?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// PENDING LEADS SORTING
// ============================================================================

export type SortableColumn = 'restaurant_name' | 'city' | 'ubereats_number_of_reviews' | 'created_at';
export type SortDirection = 'disabled' | 'desc' | 'asc';

export interface ColumnSort {
  column: SortableColumn;
  direction: 'desc' | 'asc';
}

export type SortState = ColumnSort[];

export const DEFAULT_PENDING_LEADS_SORT: SortState = [
  { column: 'created_at', direction: 'desc' },
  { column: 'ubereats_number_of_reviews', direction: 'desc' }
];

/**
 * Serialize sort state to API parameter string
 */
export function serializeSortState(sortState: SortState): string {
  return sortState.map(s => `${s.column}:${s.direction}`).join(',');
}

/**
 * Get the current direction for a specific column from sort state
 */
export function getColumnDirection(sortState: SortState, column: SortableColumn): SortDirection {
  const found = sortState.find(s => s.column === column);
  return found ? found.direction : 'disabled';
}

/**
 * Get the sort priority (1-based index) for a column, or null if not in sort
 */
export function getColumnPriority(sortState: SortState, column: SortableColumn): number | null {
  const index = sortState.findIndex(s => s.column === column);
  return index >= 0 ? index + 1 : null;
}

/**
 * Cycle through sort states: disabled -> desc -> asc -> disabled
 * When enabling a column, it's added as secondary sort (appended to end)
 * When changing direction, column maintains its priority
 * When disabling, column is removed from sort
 */
export function cycleSortColumn(sortState: SortState, column: SortableColumn): SortState {
  const currentIndex = sortState.findIndex(s => s.column === column);

  if (currentIndex === -1) {
    // Column is disabled -> enable as descending, add as secondary (append to end)
    return [...sortState, { column, direction: 'desc' }];
  }

  const current = sortState[currentIndex];

  if (current.direction === 'desc') {
    // Descending -> Ascending (keep position)
    const newState = [...sortState];
    newState[currentIndex] = { column, direction: 'asc' };
    return newState;
  }

  // Ascending -> Disabled (remove from list)
  return sortState.filter((_, i) => i !== currentIndex);
}

// ============================================================================
// LEAD SCRAPE JOBS HOOKS
// ============================================================================

/**
 * Hook to fetch lead scrape jobs with filtering
 */
export function useLeadScrapeJobs(filters: LeadScrapeJobFilters = {}) {
  return useQuery<{ success: boolean; jobs: LeadScrapeJob[]; total: number; limit: number; offset: number }>({
    queryKey: ['lead-scrape-jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.city) params.append('city', filters.city);
      if (filters.cuisine) params.append('cuisine', filters.cuisine);
      if (filters.current_step) params.append('current_step', filters.current_step);
      if (filters.started_after) params.append('started_after', filters.started_after);
      if (filters.started_before) params.append('started_before', filters.started_before);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await api.get(`/lead-scrape-jobs?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds for progress updates
  });
}

/**
 * Hook to fetch a single lead scrape job with details
 */
export function useLeadScrapeJob(jobId: string, options?: any) {
  return useQuery<{ success: boolean; job: LeadScrapeJob }>({
    queryKey: ['lead-scrape-job', jobId],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: 10000, // Refetch every 10 seconds for active jobs
    ...options,
  });
}

/**
 * Hook to create a new lead scrape job
 */
export function useCreateLeadScrapeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLeadScrapeJobRequest) => {
      const response = await api.post('/lead-scrape-jobs', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      toast.success('Lead scrape job created', {
        description: data.job.save_as_draft ? 'Saved as draft' : 'Ready to start',
      });
    },
    onError: (error: any) => {
      toast.error('Failed to create job', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to update a draft lead scrape job
 */
export function useUpdateLeadScrapeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateLeadScrapeJobRequest> }) => {
      const response = await api.patch(`/lead-scrape-jobs/${id}`, updates);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job', variables.id] });
      toast.success('Job updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update job', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to delete a lead scrape job
 */
export function useDeleteLeadScrapeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.delete(`/lead-scrape-jobs/${jobId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      toast.success('Job deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete job', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to start a lead scrape job
 */
export function useStartLeadScrapeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post(`/lead-scrape-jobs/${jobId}/start`);
      return response.data;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job', jobId] });
      toast.success('Lead scrape started');
    },
    onError: (error: any) => {
      toast.error('Failed to start job', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to cancel a lead scrape job
 */
export function useCancelLeadScrapeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post(`/lead-scrape-jobs/${jobId}/cancel`);
      return response.data;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job', jobId] });
      toast.success('Job cancelled');
    },
    onError: (error: any) => {
      toast.error('Failed to cancel job', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to trigger extraction for a job step
 */
export function useTriggerExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, stepNumber, leadIds }: { jobId: string; stepNumber: number; leadIds?: string[] }) => {
      const response = await api.post(`/lead-scrape-jobs/${jobId}/extract/${stepNumber}`, {
        lead_ids: leadIds,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job', variables.jobId] });
      toast.success(`Extraction started for step ${variables.stepNumber}`);
    },
    onError: (error: any) => {
      toast.error('Failed to start extraction', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to pass leads to the next step
 */
export function usePassLeadsToNextStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, leadIds, jobId, stepNumber }: { stepId: string; leadIds: string[]; jobId?: string; stepNumber?: number }) => {
      const response = await api.post(`/lead-scrape-jobs/steps/${stepId}/pass-leads`, {
        lead_ids: leadIds,
      });
      return { ...response.data, jobId, stepNumber, leadIds };
    },
    onMutate: async ({ leadIds, jobId, stepNumber }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['step-leads'] });

      // Snapshot the previous value for rollback
      const previousData = jobId && stepNumber
        ? queryClient.getQueryData(['step-leads', jobId, stepNumber])
        : null;

      // Optimistically update the leads to show 'processing' status
      if (jobId && stepNumber) {
        queryClient.setQueryData(
          ['step-leads', jobId, stepNumber],
          (old: any) => {
            if (!old?.leads) return old;
            return {
              ...old,
              leads: old.leads.map((lead: Lead) =>
                leadIds.includes(lead.id)
                  ? { ...lead, step_progression_status: 'processing' as const }
                  : lead
              ),
            };
          }
        );
      }

      return { previousData, jobId, stepNumber };
    },
    onError: (error: any, _variables, context) => {
      // Rollback to previous data on error
      if (context?.previousData && context.jobId && context.stepNumber) {
        queryClient.setQueryData(
          ['step-leads', context.jobId, context.stepNumber],
          context.previousData
        );
      }
      toast.error('Failed to pass leads', {
        description: error.response?.data?.error || error.message,
      });
    },
    onSuccess: () => {
      // Immediately invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      queryClient.invalidateQueries({ queryKey: ['step-leads'] });
      toast.success('Leads passed to next step');
    },
    onSettled: () => {
      // Always refetch after mutation settles to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['step-leads'] });
    },
  });
}

/**
 * Hook to retry failed leads
 */
export function useRetryFailedLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, leadIds }: { stepId: string; leadIds: string[] }) => {
      const response = await api.post(`/lead-scrape-jobs/steps/${stepId}/retry`, {
        lead_ids: leadIds,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      toast.success('Retry started');
    },
    onError: (error: any) => {
      toast.error('Failed to retry leads', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

// ============================================================================
// LEADS HOOKS
// ============================================================================

/**
 * Hook to fetch pending leads (ready for conversion)
 */
export function usePendingLeads(filters: PendingLeadsFilters = {}) {
  return useQuery<{ success: boolean; leads: Lead[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>({
    queryKey: ['pending-leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.city) params.append('city', filters.city);
      if (filters.cuisine) params.append('cuisine', filters.cuisine);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await api.get(`/leads/pending?${params.toString()}`);
      return response.data;
    },
  });
}

/**
 * Hook to fetch filter options for pending leads (unique cities and cuisines from jobs)
 */
export function usePendingLeadsFilterOptions() {
  return useQuery<{ success: boolean; cities: string[]; cuisines: string[] }>({
    queryKey: ['pending-leads-filter-options'],
    queryFn: async () => {
      const response = await api.get('/leads/pending/filter-options');
      return response.data;
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Hook to fetch a single lead
 */
export function useLead(leadId: string, options?: any) {
  return useQuery<{ success: boolean; lead: Lead }>({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const response = await api.get(`/leads/${leadId}`);
      return response.data;
    },
    enabled: !!leadId,
    ...options,
  });
}

/**
 * Hook to update a lead
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const response = await api.patch(`/leads/${id}`, updates);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      toast.success('Lead updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update lead', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Parameters for converting leads to restaurants
 */
export interface ConvertLeadsParams {
  leadIds: string[];
  createRegistrationBatch?: boolean;
  batchName?: string;
  sourceLeadScrapeJobId?: string;
}

/**
 * Hook to convert leads to restaurants
 */
export function useConvertLeadsToRestaurants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ConvertLeadsParams | string[]) => {
      // Support both old (string[]) and new (ConvertLeadsParams) signatures
      const isLegacy = Array.isArray(params);
      const leadIds = isLegacy ? params : params.leadIds;
      const createRegistrationBatch = isLegacy ? false : params.createRegistrationBatch;
      const batchName = isLegacy ? undefined : params.batchName;
      const sourceLeadScrapeJobId = isLegacy ? undefined : params.sourceLeadScrapeJobId;

      const response = await api.post('/leads/convert', {
        lead_ids: leadIds,
        create_registration_batch: createRegistrationBatch,
        batch_name: batchName,
        source_lead_scrape_job_id: sourceLeadScrapeJobId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });

      const { summary } = data;
      if (summary.converted > 0 && summary.failed === 0) {
        toast.success(`${summary.converted} lead${summary.converted > 1 ? 's' : ''} converted to restaurant${summary.converted > 1 ? 's' : ''}`);
      } else if (summary.converted > 0 && summary.failed > 0) {
        toast.warning(`${summary.converted} converted, ${summary.failed} failed`);
      } else {
        toast.error('Failed to convert leads');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to convert leads', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to delete leads
 */
export function useDeleteLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const response = await api.delete('/leads', { data: { lead_ids: leadIds } });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      toast.success(`${data.deleted_count} lead${data.deleted_count > 1 ? 's' : ''} deleted`);
    },
    onError: (error: any) => {
      toast.error('Failed to delete leads', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

// ============================================================================
// CITY CODES HOOK
// ============================================================================

/**
 * Hook to fetch city codes for dropdown
 */
export function useCityCodes(country?: string) {
  return useQuery<{ success: boolean; cities: CityCode[]; count: number }>({
    queryKey: ['city-codes', country],
    queryFn: async () => {
      const params = country ? `?country=${country}` : '';
      const response = await api.get(`/city-codes${params}`);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - city codes don't change often
  });
}

// ============================================================================
// CUISINES HOOK
// ============================================================================

/**
 * Hook to fetch UberEats cuisines for dropdown
 */
export function useCuisines() {
  return useQuery<{ success: boolean; cuisines: UberEatsCuisine[]; count: number }>({
    queryKey: ['ubereats-cuisines'],
    queryFn: async () => {
      const response = await api.get('/city-codes/cuisines');
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - cuisines don't change
  });
}

// ============================================================================
// STEP LEADS HOOKS
// ============================================================================

/**
 * Hook to fetch leads for a specific step
 * Uses dynamic refetch interval - faster polling when leads are being processed
 */
export function useStepLeads(jobId: string, stepNumber: number, options?: { enabled?: boolean }) {
  return useQuery<{ success: boolean; step: LeadScrapeJobStep; leads: Lead[] }>({
    queryKey: ['step-leads', jobId, stepNumber],
    queryFn: async () => {
      const response = await api.get(`/lead-scrape-jobs/${jobId}/steps/${stepNumber}`);
      return response.data;
    },
    enabled: !!jobId && stepNumber > 0 && (options?.enabled !== false),
    // Dynamic refetch interval: 3s when processing, 10s otherwise
    refetchInterval: (query) => {
      const hasProcessingLeads = query.state.data?.leads?.some(
        (l: Lead) => l.step_progression_status === 'processing'
      );
      return hasProcessingLeads ? 3000 : 10000;
    },
  });
}

/**
 * Hook to mark leads as failed
 */
export function useMarkLeadsFailed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadIds, reason }: { leadIds: string[]; reason?: string }) => {
      const response = await api.post('/leads/mark-failed', { lead_ids: leadIds, reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['step-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job'] });
      queryClient.invalidateQueries({ queryKey: ['pending-leads'] });
      toast.success('Leads marked as failed');
    },
    onError: (error: any) => {
      toast.error('Failed to mark leads', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to update job status directly
 */
export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: LeadScrapeJob['status'] }) => {
      const response = await api.patch(`/lead-scrape-jobs/${jobId}/status`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scrape-job', variables.jobId] });
      toast.success(`Job status updated to ${variables.status.replace('_', ' ')}`);
    },
    onError: (error: any) => {
      toast.error('Failed to update job status', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}
