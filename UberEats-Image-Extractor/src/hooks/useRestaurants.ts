import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface Restaurant {
  id: string;
  name: string;
  lead_status?: string;
  lead_stage?: string;
  lead_warmth?: string;
  [key: string]: any;
}

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      const response = await api.get('/restaurants/list');
      return response.data.restaurants || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
