import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../services/api';

// ============================================================================
// TYPES
// ============================================================================

// Lightweight restaurant info for batch list preview
export interface RegistrationJobPreview {
  id: string;
  restaurant_id: string;
  status: string;
  current_step: number;
  error_message: string | null;
  restaurant?: {
    id: string;
    name: string;
    city?: string;
    cuisine?: string | string[];
  };
}

export interface RegistrationBatchJob {
  id: string;
  name: string;
  organisation_id: string;
  source_lead_scrape_job_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'action_required';
  total_restaurants: number;
  completed_restaurants: number;
  failed_restaurants: number;
  current_step: number;
  total_steps: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  metadata: Record<string, any>;
  // Jobs with restaurant preview (populated in list endpoint)
  jobs?: RegistrationJobPreview[];
}

export interface RegistrationJob {
  id: string;
  batch_job_id: string;
  restaurant_id: string;
  restaurant_name?: string;
  organisation_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'action_required';
  current_step: number;
  execution_config: Record<string, any>;
  pumpd_user_id: string | null;
  pumpd_restaurant_id: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  steps?: RegistrationJobStep[];
  restaurant?: RegistrationJobRestaurant;
  company_candidates?: CompanyCandidate[];
}

// Extended restaurant type with all fields needed for Yolo Mode configuration
export interface RegistrationJobRestaurant {
  id: string;
  name: string;
  slug?: string;
  subdomain?: string;
  address?: string;
  city?: string;
  email?: string;
  phone?: string;
  ubereats_url?: string;
  doordash_url?: string;
  website_url?: string;
  facebook_url?: string;
  opening_hours?: Record<string, any>;
  cuisine?: string | string[];
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  theme?: 'light' | 'dark';
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
  accent_color?: string;
  background_color?: string;
  logo_url?: string;
  logo_nobg_url?: string;
  logo_standard_url?: string;
  logo_thermal_url?: string;
  logo_thermal_alt_url?: string;
  logo_thermal_contrast_url?: string;
  logo_thermal_adaptive_url?: string;
  logo_favicon_url?: string;
  website_og_image?: string;
  ubereats_og_image?: string;
  doordash_og_image?: string;
  facebook_cover_image?: string;
  user_email?: string;
  user_password_hint?: string;
  stripe_connect_url?: string;
  menus?: Array<{
    id: string;
    name: string;
    version?: string;
    source_url?: string;
    created_at?: string;
    item_count?: number;
    platforms?: { name: string };
  }>;
}

export interface RegistrationJobStep {
  id: string;
  job_id: string;
  step_number: number;
  step_name: string;
  step_type: 'automatic' | 'action_required';
  status: 'pending' | 'in_progress' | 'action_required' | 'completed' | 'failed';
  sub_step_progress: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  retry_count: number;
}

export interface CompanyCandidate {
  company_name: string;
  company_number: string;
  status: string;
  match_source: 'name' | 'address';
}

export interface StepSummary {
  total: number;
  completed: number;
  in_progress: number;
  action_required: number;
  pending: number;
  failed: number;
}

export interface RegistrationBatchFilters {
  status?: string[];
  search?: string;
  current_step?: string[];
  city?: string[];
  cuisine?: string[];
  sort_by?: 'created_at' | 'total_restaurants' | 'current_step' | 'name';
  sort_direction?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================================================
// SINGLE BATCH HOOK
// ============================================================================

/**
 * Hook to fetch a single registration batch with details
 * Includes smart polling: 5s when active, 10s when idle, stops when complete
 */
export function useRegistrationBatch(batchId: string | undefined) {
  return useQuery<{
    success: boolean;
    batch_job: RegistrationBatchJob;
    registration_jobs: RegistrationJob[];
    step_summary: Record<string, StepSummary>;
  }>({
    queryKey: ['registration-batch', batchId],
    queryFn: async () => {
      const response = await api.get(`/registration-batches/${batchId}`);
      return response.data;
    },
    enabled: !!batchId,
    staleTime: 0,
    refetchInterval: (query) => {
      const batch = query.state.data?.batch_job;
      if (!batch) return false;

      // Stop polling when terminal state reached
      if (['completed', 'failed', 'cancelled'].includes(batch.status)) {
        return false;
      }

      // Faster polling during active execution
      if (batch.status === 'in_progress') {
        return 5000; // 5 seconds
      }

      // Slower polling when pending or waiting for action
      return 10000; // 10 seconds
    },
  });
}

// ============================================================================
// BATCH LIST HOOK
// ============================================================================

/**
 * Hook to fetch registration batches with filtering
 */
export function useRegistrationBatches(filters: RegistrationBatchFilters = {}) {
  return useQuery<{
    success: boolean;
    batch_jobs: RegistrationBatchJob[];
    total_count: number;
  }>({
    queryKey: ['registration-batches', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status?.length) params.append('status', filters.status.join(','));
      if (filters.search) params.append('search', filters.search);
      if (filters.current_step?.length) params.append('current_step', filters.current_step.join(','));
      if (filters.city?.length) params.append('city', filters.city.join(','));
      if (filters.cuisine?.length) params.append('cuisine', filters.cuisine.join(','));
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_direction) params.append('sort_direction', filters.sort_direction);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await api.get(`/registration-batches?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000, // Refresh list every 30 seconds
  });
}

// ============================================================================
// BATCH PROGRESS HOOK (Lightweight polling)
// ============================================================================

/**
 * Lightweight hook for polling batch progress
 */
export function useRegistrationBatchProgress(batchId: string | undefined) {
  return useQuery<{
    success: boolean;
    status: string;
    progress_percent: number;
    current_step: number;
    step_requiring_action: number | null;
    restaurants_summary: {
      total: number;
      completed: number;
      in_progress: number;
      failed: number;
      pending: number;
    };
    last_updated: string;
  }>({
    queryKey: ['registration-batch-progress', batchId],
    queryFn: async () => {
      const response = await api.get(`/registration-batches/${batchId}/progress`);
      return response.data;
    },
    enabled: !!batchId,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 5000;

      if (['completed', 'failed', 'cancelled'].includes(status)) {
        return false;
      }

      return status === 'in_progress' ? 3000 : 10000;
    },
  });
}

// ============================================================================
// STEP DATA HOOK
// ============================================================================

/**
 * Hook to fetch step-specific data (e.g., company candidates for step 3)
 */
export function useRegistrationBatchStep(batchId: string | undefined, stepNumber: number) {
  return useQuery<{
    success: boolean;
    step_number: number;
    step_name: string;
    step_type: string;
    restaurants: Array<{
      job_id: string;
      restaurant_id: string;
      restaurant_name: string;
      step_status: string;
      candidates?: CompanyCandidate[];
      selected_company_number?: string | null;
    }>;
    summary: {
      total: number;
      action_required: number;
      completed: number;
    };
  }>({
    queryKey: ['registration-batch-step', batchId, stepNumber],
    queryFn: async () => {
      const response = await api.get(`/registration-batches/${batchId}/steps/${stepNumber}`);
      return response.data;
    },
    enabled: !!batchId && stepNumber > 0,
  });
}

// ============================================================================
// INDIVIDUAL JOB HOOK
// ============================================================================

/**
 * Hook to fetch a single registration job with full details
 */
export function useRegistrationJob(jobId: string | undefined) {
  return useQuery<{
    success: boolean;
    job: RegistrationJob;
  }>({
    queryKey: ['registration-job', jobId],
    queryFn: async () => {
      const response = await api.get(`/registration-batches/jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      if (!status) return false;

      if (['completed', 'failed', 'cancelled'].includes(status)) {
        return false;
      }

      return 5000;
    },
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to start a registration batch
 */
export function useStartRegistrationBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await api.post(`/registration-batches/${batchId}/start`);
      return response.data;
    },
    onSuccess: (_, batchId) => {
      toast.success('Registration batch started');
      queryClient.invalidateQueries({ queryKey: ['registration-batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    },
    onError: (error: any) => {
      toast.error('Failed to start batch', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to cancel a registration batch
 */
export function useCancelRegistrationBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await api.post(`/registration-batches/${batchId}/cancel`);
      return response.data;
    },
    onSuccess: (_, batchId) => {
      toast.success('Registration batch cancelled');
      queryClient.invalidateQueries({ queryKey: ['registration-batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    },
    onError: (error: any) => {
      toast.error('Failed to cancel batch', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to complete an action-required step
 */
export function useCompleteRegistrationStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      batchId,
      stepNumber,
      data,
    }: {
      batchId: string;
      stepNumber: number;
      data: Record<string, any>;
    }) => {
      const response = await api.post(
        `/registration-batches/${batchId}/steps/${stepNumber}/complete`,
        data
      );
      return response.data;
    },
    onSuccess: (response, { batchId }) => {
      if (response.auto_processing) {
        toast.success('Step completed, processing next step...');
      } else {
        toast.success('Selections saved');
      }
      queryClient.invalidateQueries({ queryKey: ['registration-batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['registration-batch-step'] });
    },
    onError: (error: any) => {
      toast.error('Failed to complete step', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to retry a failed registration job
 */
export function useRetryRegistrationJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      fromStep,
      resetConfig = false,
    }: {
      jobId: string;
      fromStep?: number;
      resetConfig?: boolean;
    }) => {
      const response = await api.post(`/registration-batches/jobs/${jobId}/retry`, {
        from_step: fromStep,
        reset_config: resetConfig,
      });
      return response.data;
    },
    onSuccess: (response) => {
      toast.success('Retry started');
      // Invalidate related queries
      if (response.job?.batch_job_id) {
        queryClient.invalidateQueries({
          queryKey: ['registration-batch', response.job.batch_job_id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['registration-job'] });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    },
    onError: (error: any) => {
      toast.error('Failed to retry job', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to resume Step 6 from last completed phase
 * Use when a job failed mid-execution and has partial progress saved
 */
export function useResumeStep6() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post(`/registration-batches/jobs/${jobId}/resume-step-6`);
      return response.data;
    },
    onSuccess: (response) => {
      toast.success('Step 6 resume initiated', {
        description: `Resuming from ${response.resuming_from || 'beginning'}`,
      });
      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
      queryClient.invalidateQueries({ queryKey: ['registration-job'] });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    },
    onError: (error: any) => {
      toast.error('Failed to resume Step 6', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to update a sub-step status manually
 */
export function useUpdateSubStepStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      subStepKey,
      status,
      data,
    }: {
      jobId: string;
      subStepKey: string;
      status: 'completed' | 'failed' | 'skipped' | 'pending';
      data?: Record<string, any>;
    }) => {
      const response = await api.patch(
        `/registration-batches/jobs/${jobId}/steps/6/sub-steps/${subStepKey}`,
        { status, data }
      );
      return response.data;
    },
    onSuccess: (response) => {
      toast.success('Sub-step updated', {
        description: `${response.updated_sub_step} marked as ${response.new_status}`,
      });
      if (response.validation_warnings?.length > 0) {
        toast.warning('Warning', {
          description: response.validation_warnings.join(', '),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
      queryClient.invalidateQueries({ queryKey: ['registration-job'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update sub-step', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to reset a sub-step to pending
 */
export function useResetSubStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      subStepKey,
      cascade = true,
    }: {
      jobId: string;
      subStepKey: string;
      cascade?: boolean;
    }) => {
      const response = await api.post(
        `/registration-batches/jobs/${jobId}/steps/6/sub-steps/${subStepKey}/reset`,
        { cascade }
      );
      return response.data;
    },
    onSuccess: (response) => {
      const count = response.reset_sub_steps?.length || 1;
      toast.success('Sub-step reset', {
        description: count > 1
          ? `Reset ${count} sub-steps (including dependents)`
          : 'Sub-step reset to pending',
      });
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
      queryClient.invalidateQueries({ queryKey: ['registration-job'] });
    },
    onError: (error: any) => {
      toast.error('Failed to reset sub-step', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to get sub-step validation context
 */
export function useSubStepValidation(jobId: string, subStepKey: string) {
  return useQuery({
    queryKey: ['sub-step-validation', jobId, subStepKey],
    queryFn: async () => {
      const response = await api.get(
        `/registration-batches/jobs/${jobId}/steps/6/sub-steps/${subStepKey}/validation`
      );
      return response.data;
    },
    enabled: !!jobId && !!subStepKey,
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Hook to create a new registration batch (standalone, not from lead conversion)
 */
export function useCreateRegistrationBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      restaurant_ids: string[];
      auto_start?: boolean;
      execution_config?: Record<string, any>;
    }) => {
      const response = await api.post('/registration-batches', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Registration batch created', {
        description: data.batch_job?.name || 'Batch ready to start',
      });
      queryClient.invalidateQueries({ queryKey: ['registration-batches'] });
    },
    onError: (error: any) => {
      toast.error('Failed to create batch', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to retry Step 2 (Companies Office search) with custom parameters
 */
export function useRetryStep2Search() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      searchParams,
    }: {
      jobId: string;
      searchParams: {
        restaurant_name?: string;
        street?: string;
        city?: string;
      };
    }) => {
      const response = await api.post(
        `/registration-batches/jobs/${jobId}/retry-search`,
        searchParams
      );
      return response.data;
    },
    onSuccess: (response) => {
      toast.success('Search completed', {
        description: response.message || `Found ${response.search_result?.total_candidates || 0} candidates`,
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
      queryClient.invalidateQueries({ queryKey: ['registration-batch-step'] });
    },
    onError: (error: any) => {
      toast.error('Search failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to skip Step 2/3/4 with manual entry of contact details
 * Used when Companies Office search fails repeatedly
 */
export function useSkipWithManualEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      manualDetails,
    }: {
      jobId: string;
      manualDetails: {
        contact_name: string;
        full_legal_name?: string;
        contact_email?: string;
        contact_phone?: string;
        company_name?: string;
        company_number?: string;
        gst_number?: string;
        nzbn?: string;
      };
    }) => {
      const response = await api.post(
        `/registration-batches/jobs/${jobId}/skip-with-manual-entry`,
        manualDetails
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Contact details saved', {
        description: 'Companies Office steps skipped - proceeding with registration',
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
      queryClient.invalidateQueries({ queryKey: ['registration-batch-step'] });
    },
    onError: (error: any) => {
      toast.error('Failed to save details', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

/**
 * Hook to save restaurant data from Yolo Mode configuration tabs (Issue 14)
 * Updates allowed fields: email, phone, password hint, name, theme, colors, contact info
 */
export function useSaveRestaurantFromConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      updates,
    }: {
      jobId: string;
      updates: {
        email?: string;
        phone?: string;
        user_password_hint?: string;
        name?: string;
        theme?: 'light' | 'dark';
        cuisine?: string | string[];
        primary_color?: string;
        secondary_color?: string;
        contact_name?: string;
        contact_email?: string;
        // Header images (Issue 16 - can be URL or base64, server converts URLs)
        website_og_image?: string;
        ubereats_og_image?: string;
        doordash_og_image?: string;
        facebook_cover_image?: string;
      };
    }) => {
      const response = await api.patch(
        `/registration-batches/jobs/${jobId}/restaurant`,
        updates
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Restaurant data saved', {
        description: 'Changes have been saved to the database',
      });
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['registration-batch'] });
    },
    onError: (error: any) => {
      toast.error('Failed to save changes', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to get step definitions (static data)
 */
export function useRegistrationStepDefinitions() {
  return useQuery<{
    success: boolean;
    steps: Array<{
      step_number: number;
      step_name: string;
      step_description: string;
      step_type: 'automatic' | 'action_required';
    }>;
  }>({
    queryKey: ['registration-step-definitions'],
    queryFn: async () => {
      const response = await api.get('/registration-batches/step-definitions');
      return response.data;
    },
    staleTime: Infinity, // Step definitions never change
  });
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const REGISTRATION_STEPS = [
  {
    step_number: 1,
    step_name: 'Menu & Branding Extraction',
    step_description: 'Extract menu data and brand assets',
    step_type: 'automatic' as const,
  },
  {
    step_number: 2,
    step_name: 'Contact Details Search',
    step_description: 'Search Companies Office for legal entities',
    step_type: 'automatic' as const,
  },
  {
    step_number: 3,
    step_name: 'Company Selection',
    step_description: 'Select correct company entity for each restaurant',
    step_type: 'action_required' as const,
  },
  {
    step_number: 4,
    step_name: 'Company Details Extraction',
    step_description: 'Extract full company details and save',
    step_type: 'automatic' as const,
  },
  {
    step_number: 5,
    step_name: 'Yolo Mode Configuration',
    step_description: 'Configure account setup settings',
    step_type: 'action_required' as const,
  },
  {
    step_number: 6,
    step_name: 'Pumpd Account Setup',
    step_description: 'Execute full account registration workflow',
    step_type: 'automatic' as const,
  },
];

export const YOLO_MODE_SUB_STEPS = [
  { key: 'cloudwaitressAccount', label: 'Account Registration', phase: 'phase1' },
  { key: 'codeGeneration', label: 'Code Generation', phase: 'phase1' },
  { key: 'createOnboardingUser', label: 'Onboarding User', phase: 'phase1' },
  { key: 'uploadImages', label: 'Image Upload', phase: 'phase1' },
  { key: 'restaurantRegistration', label: 'Restaurant Registration', phase: 'phase2' },
  { key: 'websiteConfig', label: 'Website Configuration', phase: 'phase2' },
  { key: 'servicesConfig', label: 'Services Configuration', phase: 'phase2' },
  { key: 'paymentConfig', label: 'Payment Configuration', phase: 'phase2' },
  { key: 'menuImport', label: 'Menu Import', phase: 'phase2' },
  { key: 'syncOnboardingUser', label: 'Onboarding Sync', phase: 'phase2' },
  { key: 'optionSets', label: 'Option Sets', phase: 'phase3' },
  { key: 'itemTags', label: 'Item Tags', phase: 'phase4' },
];

/**
 * Helper to extract sub-step status from the nested phase progress structure
 * The backend stores: { phases: { phase1: { sub_steps: { cloudwaitressAccount: { status: 'completed' } } } } }
 */
export function getSubStepStatus(
  subStepProgress: Record<string, any> | null | undefined,
  subStepKey: string
): { status: string; [key: string]: any } | null {
  if (!subStepProgress?.phases) return null;

  for (const phase of Object.values(subStepProgress.phases) as any[]) {
    if (phase?.sub_steps?.[subStepKey]) {
      return phase.sub_steps[subStepKey];
    }
  }
  return null;
}

/**
 * Get aggregated sub-step counts from the nested phase progress structure
 */
export function getSubStepCounts(subStepProgress: Record<string, any> | null | undefined): {
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  skipped: number;
  pending: number;
} {
  const counts = { total: 0, completed: 0, inProgress: 0, failed: 0, skipped: 0, pending: 0 };

  if (!subStepProgress?.phases) return counts;

  for (const phase of Object.values(subStepProgress.phases) as any[]) {
    if (phase?.sub_steps) {
      for (const subStep of Object.values(phase.sub_steps) as any[]) {
        counts.total++;
        switch (subStep?.status) {
          case 'completed': counts.completed++; break;
          case 'in_progress': counts.inProgress++; break;
          case 'failed': counts.failed++; break;
          case 'skipped': counts.skipped++; break;
          default: counts.pending++; break;
        }
      }
    }
  }

  return counts;
}
