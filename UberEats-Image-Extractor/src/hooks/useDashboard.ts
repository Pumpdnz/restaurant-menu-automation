import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// Types for dashboard preview components
export interface DashboardRestaurant {
  id: string;
  name: string;
  city?: string;
  created_at: string;
  onboarding_status?: string;
  lead_stage?: string;
}

export interface DashboardPendingLead {
  id: string;
  restaurant_name: string;
  city?: string;
  created_at: string;
  ubereats_number_of_reviews?: string;
}

export interface DashboardBatchJob {
  id: string;
  name: string;
  status: string;
  total_restaurants: number;
  completed_restaurants: number;
  current_step: number;
  created_at: string;
}

export interface DashboardTask {
  id: string;
  name: string;
  type: string;
  priority: string;
  due_date: string;
  restaurants?: {
    id: string;
    name: string;
  };
}

/**
 * Fetch recently created restaurants (ordered by created_at desc)
 */
export function useRecentRestaurants(limit: number = 5) {
  return useQuery<DashboardRestaurant[]>({
    queryKey: ['recent-restaurants', limit],
    queryFn: async () => {
      const response = await api.get('/restaurants/recent', {
        params: { limit }
      });
      return response.data.restaurants || [];
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch pending leads preview (step 4, status "passed")
 */
export function usePendingLeadsPreview(limit: number = 5) {
  return useQuery<{ leads: DashboardPendingLead[]; total: number }>({
    queryKey: ['pending-leads-preview', limit],
    queryFn: async () => {
      const response = await api.get('/leads/pending', {
        params: { limit }
      });
      return {
        leads: response.data.leads || [],
        total: response.data.pagination?.total || 0
      };
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch recent registration batches
 */
export function useRecentRegistrationBatches(limit: number = 5) {
  return useQuery<DashboardBatchJob[]>({
    queryKey: ['recent-registration-batches', limit],
    queryFn: async () => {
      const response = await api.get('/registration-batches', {
        params: {
          limit,
          sort_by: 'created_at',
          sort_direction: 'desc'
        }
      });
      return response.data.batch_jobs || [];
    },
    refetchInterval: 30000, // For progress updates
  });
}

/**
 * Fetch tasks due today
 */
export function useTasksDueToday(limit: number = 10) {
  return useQuery<{ tasks: DashboardTask[]; total: number }>({
    queryKey: ['tasks-due-today', limit],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await api.get('/tasks', {
        params: {
          status: 'active',
          due_after: today.toISOString(),
          due_before: tomorrow.toISOString(),
          sort_by: 'due_date',
          sort_order: 'asc'
        }
      });

      const tasks = response.data.tasks || [];
      return {
        tasks: tasks.slice(0, limit),
        total: tasks.length
      };
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch overdue tasks count
 */
export function useOverdueTasksCount() {
  return useQuery<{ count: number; tasks: DashboardTask[] }>({
    queryKey: ['overdue-tasks-count'],
    queryFn: async () => {
      const response = await api.get('/tasks/overdue');
      const tasks = response.data.tasks || [];
      return {
        count: tasks.length,
        tasks
      };
    },
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Combined hook for all dashboard summary data
 */
export function useDashboardSummary() {
  const restaurants = useRecentRestaurants(5);
  const pendingLeads = usePendingLeadsPreview(5);
  const batches = useRecentRegistrationBatches(5);
  const tasksDueToday = useTasksDueToday(5);
  const overdueTasks = useOverdueTasksCount();

  return {
    isLoading: restaurants.isLoading || pendingLeads.isLoading ||
               batches.isLoading || tasksDueToday.isLoading,
    restaurants: restaurants.data,
    pendingLeads: pendingLeads.data,
    batches: batches.data,
    tasksDueToday: tasksDueToday.data,
    overdueTasks: overdueTasks.data,
  };
}
