import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  platform?: string;
  city?: string;
  cuisine?: string;
}

export interface SummaryStats {
  total_jobs: number;
  completed_jobs: number;
  total_leads_extracted: number;
  total_leads_passed: number;
  total_leads_failed: number;
  unique_cities: number;
  unique_cuisines: number;
  avg_success_rate: number;
}

export interface CuisineData {
  name: string;
  leads: number;
  jobs: number;
  pages_scraped: number[]; // Array of page numbers (1-10) that have been scraped
  page_jobs: Record<number, string>; // Map of page number to job ID
}

export interface CityCoverage {
  city: string;
  total_leads: number;
  total_jobs: number;
  cuisines: CuisineData[];
  last_scraped: string | null;
  pages_scraped: number[]; // Array of page numbers (1-10) that have been scraped
}

export interface HeatmapData {
  cities: string[];
  cuisines: string[];
  matrix: number[][];
  maxValue: number;
}

export interface Opportunity {
  city: string;
  cuisine: string;
  current_leads: number;
  current_max_page: number;
  suggested_page_offset: number;
  opportunity_score: number;
  priority: 'high' | 'medium' | 'low';
  last_scraped: string | null;
}

export interface ActivityTrend {
  date: string;
  jobs_created: number;
  jobs_completed: number;
  leads_extracted: number;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch summary statistics
 */
export function useAnalyticsSummary(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['lead-scrape-analytics', 'summary', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.platform) params.set('platform', filters.platform);

      const response = await api.get(`/lead-scrape-jobs/analytics/summary?${params}`);
      return response.data.data as SummaryStats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch coverage by city/cuisine
 */
export function useAnalyticsCoverage(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['lead-scrape-analytics', 'coverage', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.city) params.set('city', filters.city);
      if (filters.cuisine) params.set('cuisine', filters.cuisine);

      const response = await api.get(`/lead-scrape-jobs/analytics/coverage?${params}`);
      return response.data.data as CityCoverage[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch heatmap matrix data
 */
export function useAnalyticsHeatmap(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['lead-scrape-analytics', 'heatmap', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.platform) params.set('platform', filters.platform);

      const response = await api.get(`/lead-scrape-jobs/analytics/heatmap?${params}`);
      return response.data.data as HeatmapData;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch opportunity analysis
 */
export function useAnalyticsOpportunities(filters: AnalyticsFilters & { minScore?: number } = {}) {
  return useQuery({
    queryKey: ['lead-scrape-analytics', 'opportunities', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.minScore) params.set('minScore', filters.minScore.toString());

      const response = await api.get(`/lead-scrape-jobs/analytics/opportunities?${params}`);
      return response.data.data as Opportunity[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch activity trends over time
 */
export function useAnalyticsTrends(timeframe: string = '30d') {
  return useQuery({
    queryKey: ['lead-scrape-analytics', 'trends', timeframe],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('timeframe', timeframe);

      const response = await api.get(`/lead-scrape-jobs/analytics/trends?${params}`);
      return response.data.data as ActivityTrend[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
