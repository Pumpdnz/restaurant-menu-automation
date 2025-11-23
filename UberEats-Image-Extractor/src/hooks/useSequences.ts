import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../services/api';

// Types
export interface SequenceTemplate {
  id: string;
  organisation_id: string;
  created_by: string;
  name: string;
  description?: string;
  tags: string[];
  is_active: boolean;
  usage_count: number;
  metadata: any;
  created_at: string;
  updated_at: string;
  sequence_steps: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  sequence_template_id: string;
  step_order: number;
  name: string;
  description?: string;
  task_template_id?: string;
  type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call' | 'demo_meeting';
  priority: 'low' | 'medium' | 'high';
  message_template_id?: string;
  custom_message?: string;
  subject_line?: string;
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days';
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface SequenceInstance {
  id: string;
  sequence_template_id: string;
  restaurant_id: string;
  organisation_id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_step_order: number;
  total_steps: number;
  assigned_to?: string;
  created_by?: string;
  started_at: string;
  paused_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  sequence_templates?: {
    id: string;
    name: string;
  };
  restaurants?: {
    id: string;
    name: string;
  };
  tasks?: any[];
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  tags?: string[];
  steps: {
    step_order: number;
    name: string;
    description?: string;
    task_template_id?: string;
    type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call' | 'demo_meeting';
    priority?: 'low' | 'medium' | 'high';
    message_template_id?: string;
    custom_message?: string;
    subject_line?: string;
    delay_value: number;
    delay_unit: 'minutes' | 'hours' | 'days';
  }[];
}

export interface StartSequenceRequest {
  sequence_template_id: string;
  restaurant_id: string;
  assigned_to?: string;
}

export function useSequences() {
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [instances, setInstances] = useState<SequenceInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch sequence templates
  const fetchTemplates = useCallback(async (filters: {
    is_active?: boolean;
    tags?: string[];
    search?: string;
  } = {}): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.is_active !== undefined) {
        params.append('is_active', filters.is_active.toString());
      }
      if (filters.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await api.get(`/sequence-templates?${params.toString()}`);

      if (response.data.success) {
        setTemplates(response.data.data || []);
      }
    } catch (error: any) {
      toast.error('Failed to fetch sequence templates', {
        description: error.response?.data?.error || error.message,
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single template
  const getTemplate = useCallback(async (id: string): Promise<SequenceTemplate | null> => {
    try {
      const response = await api.get(`/sequence-templates/${id}`);

      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      toast.error('Failed to fetch template', {
        description: error.response?.data?.error || error.message,
      });
      return null;
    }
  }, []);

  // Create sequence template
  const createTemplate = useCallback(async (data: CreateTemplateRequest): Promise<SequenceTemplate | null> => {
    setCreating(true);
    try {
      const response = await api.post('/sequence-templates', data);

      if (response.data.success) {
        toast.success('Sequence template created successfully');
        await fetchTemplates();
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create template';
      toast.error('Failed to create template', {
        description: errorMessage,
      });
      return null;
    } finally {
      setCreating(false);
    }
  }, [fetchTemplates]);

  // Update sequence template
  const updateTemplate = useCallback(async (id: string, updates: {
    name?: string;
    description?: string;
    tags?: string[];
    is_active?: boolean;
  }): Promise<SequenceTemplate | null> => {
    try {
      const response = await api.patch(`/sequence-templates/${id}`, updates);

      if (response.data.success) {
        toast.success('Template updated successfully');
        await fetchTemplates();
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      toast.error('Failed to update template', {
        description: error.response?.data?.error || error.message,
      });
      return null;
    }
  }, [fetchTemplates]);

  // Delete sequence template
  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete(`/sequence-templates/${id}`);

      if (response.data.success) {
        toast.success('Template deleted successfully');
        await fetchTemplates();
        return true;
      }
      return false;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      toast.error('Failed to delete template', {
        description: errorMessage,
      });
      return false;
    }
  }, [fetchTemplates]);

  // Duplicate sequence template
  const duplicateTemplate = useCallback(async (id: string, newName?: string): Promise<SequenceTemplate | null> => {
    try {
      const response = await api.post(`/sequence-templates/${id}/duplicate`, { name: newName });

      if (response.data.success) {
        toast.success('Template duplicated successfully');
        await fetchTemplates();
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      toast.error('Failed to duplicate template', {
        description: error.response?.data?.error || error.message,
      });
      return null;
    }
  }, [fetchTemplates]);

  // Fetch sequence instances
  const fetchInstances = useCallback(async (filters: {
    restaurant_id?: string;
    status?: string;
    assigned_to?: string;
  } = {}): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.restaurant_id) params.append('restaurant_id', filters.restaurant_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);

      const response = await api.get(`/sequence-instances?${params.toString()}`);

      if (response.data.success) {
        setInstances(response.data.data || []);
      }
    } catch (error: any) {
      toast.error('Failed to fetch sequences', {
        description: error.response?.data?.error || error.message,
      });
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single instance
  const getInstance = useCallback(async (id: string): Promise<SequenceInstance | null> => {
    try {
      const response = await api.get(`/sequence-instances/${id}`);

      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      toast.error('Failed to fetch sequence', {
        description: error.response?.data?.error || error.message,
      });
      return null;
    }
  }, []);

  // Start sequence
  const startSequence = useCallback(async (data: StartSequenceRequest): Promise<SequenceInstance | null> => {
    try {
      const response = await api.post('/sequence-instances', data);

      if (response.data.success) {
        toast.success('Sequence started successfully', {
          description: `Created ${response.data.data.tasks_created} tasks`,
        });
        await fetchInstances();
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to start sequence';
      toast.error('Failed to start sequence', {
        description: errorMessage,
      });
      return null;
    }
  }, [fetchInstances]);

  // Pause sequence
  const pauseSequence = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await api.patch(`/sequence-instances/${id}/pause`);

      if (response.data.success) {
        toast.success('Sequence paused');
        await fetchInstances();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error('Failed to pause sequence', {
        description: error.response?.data?.error || error.message,
      });
      return false;
    }
  }, [fetchInstances]);

  // Resume sequence
  const resumeSequence = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await api.patch(`/sequence-instances/${id}/resume`);

      if (response.data.success) {
        toast.success('Sequence resumed');
        await fetchInstances();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error('Failed to resume sequence', {
        description: error.response?.data?.error || error.message,
      });
      return false;
    }
  }, [fetchInstances]);

  // Cancel sequence
  const cancelSequence = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await api.patch(`/sequence-instances/${id}/cancel`);

      if (response.data.success) {
        toast.success('Sequence cancelled');
        await fetchInstances();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error('Failed to cancel sequence', {
        description: error.response?.data?.error || error.message,
      });
      return false;
    }
  }, [fetchInstances]);

  // Get restaurant sequences
  const getRestaurantSequences = useCallback(async (restaurantId: string): Promise<SequenceInstance[]> => {
    try {
      const response = await api.get(`/sequence-instances/restaurants/${restaurantId}/sequences`);

      if (response.data.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('Failed to fetch restaurant sequences:', error);
      return [];
    }
  }, []);

  return {
    // State
    templates,
    instances,
    loading,
    creating,

    // Template methods
    fetchTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,

    // Instance methods
    fetchInstances,
    getInstance,
    startSequence,
    pauseSequence,
    resumeSequence,
    cancelSequence,
    getRestaurantSequences,
  };
}

// React Query hooks for better data fetching and caching

// Template hooks
export function useSequenceTemplates(filters: {
  is_active?: boolean;
  tags?: string[];
  search?: string;
} = {}) {
  return useQuery<{ success: boolean; data: SequenceTemplate[] }>({
    queryKey: ['sequence-templates', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/sequence-templates?${params.toString()}`);
      return response.data;
    },
  });
}

export function useSequenceTemplate(id: string, options?: any) {
  return useQuery<SequenceTemplate>({
    queryKey: ['sequence-template', id],
    queryFn: async () => {
      const response = await api.get(`/sequence-templates/${id}`);
      return response.data.data;
    },
    ...options,
  });
}

export function useCreateSequenceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemplateRequest) => {
      const response = await api.post('/sequence-templates', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-templates'] });
      toast.success('Sequence template created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create template', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useUpdateSequenceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await api.patch(`/sequence-templates/${id}`, updates);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-templates'] });
      queryClient.invalidateQueries({ queryKey: ['sequence-template', variables.id] });
      toast.success('Template updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update template', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useDeleteSequenceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/sequence-templates/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete template', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useDuplicateSequenceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName?: string }) => {
      const response = await api.post(`/sequence-templates/${id}/duplicate`, { name: newName });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-templates'] });
      toast.success('Template duplicated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to duplicate template', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

// Instance hooks
export function useSequenceInstances(filters: {
  restaurant_id?: string;
  status?: string;
  assigned_to?: string;
} = {}) {
  return useQuery<{ success: boolean; data: SequenceInstance[] }>({
    queryKey: ['sequence-instances', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.restaurant_id) params.append('restaurant_id', filters.restaurant_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);

      const response = await api.get(`/sequence-instances?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds to update progress
  });
}

export function useSequenceInstance(id: string, options?: any) {
  return useQuery<SequenceInstance>({
    queryKey: ['sequence-instance', id],
    queryFn: async () => {
      const response = await api.get(`/sequence-instances/${id}`);
      return response.data.data;
    },
    ...options,
  });
}

export function useStartSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: StartSequenceRequest) => {
      const response = await api.post('/sequence-instances', data);
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-sequences', variables.restaurant_id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sequence started successfully', {
        description: `Created ${data.tasks_created} tasks`,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to start sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function usePauseSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch(`/sequence-instances/${id}/pause`);
      return response.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instance', id] });
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      toast.success('Sequence paused');
    },
    onError: (error: any) => {
      toast.error('Failed to pause sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useResumeSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch(`/sequence-instances/${id}/resume`);
      return response.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instance', id] });
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      toast.success('Sequence resumed');
    },
    onError: (error: any) => {
      toast.error('Failed to resume sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useCancelSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch(`/sequence-instances/${id}/cancel`);
      return response.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instance', id] });
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sequence cancelled');
    },
    onError: (error: any) => {
      toast.error('Failed to cancel sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useFinishSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/sequence-instances/${id}/finish`);
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-instance', id] });
      queryClient.invalidateQueries({ queryKey: ['sequence-instances'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-sequences'] });

      const completedCount = data.completedTasks?.length || 0;
      const cancelledCount = data.cancelledTasks?.length || 0;

      toast.success('Sequence finished', {
        description: `${completedCount} task(s) completed, ${cancelledCount} task(s) cancelled`,
      });
    },
    onError: (error: any) => {
      toast.error('Failed to finish sequence', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
}

export function useRestaurantSequences(restaurantId: string) {
  return useQuery<{ success: boolean; data: SequenceInstance[] }>({
    queryKey: ['restaurant-sequences', restaurantId],
    queryFn: async () => {
      const response = await api.get(`/sequence-instances/restaurants/${restaurantId}/sequences`);
      return response.data;
    },
    enabled: !!restaurantId,
    refetchInterval: 30000, // Refetch every 30 seconds to update progress
  });
}
