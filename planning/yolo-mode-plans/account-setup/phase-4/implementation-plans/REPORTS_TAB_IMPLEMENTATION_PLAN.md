# Reports Tab Implementation Plan

**Date:** 2026-01-11
**Features:** Lead Scrapes Reports Tab (Data Layer + UI)
**Estimated Effort:** 6-8 hours total
**Dependencies:** None (uses existing schema)

---

## Overview

Add a "Reports" tab to the LeadScrapes page that provides:
1. Coverage analytics showing pages scraped per city/cuisine
2. Visual heatmap of scrape coverage
3. Gap analysis with actionable "Start Scrape" buttons
4. Integration with New Lead Scrape form (pre-fill parameters)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        LeadScrapes.tsx                          │
│  ┌──────────────┬──────────────────┬───────────────────────┐   │
│  │ Scrape Jobs  │  Pending Leads   │      Reports          │   │
│  │    (tab)     │      (tab)       │       (tab)           │   │
│  └──────────────┴──────────────────┴───────────────────────┘   │
│                                           │                      │
│  ┌────────────────────────────────────────▼──────────────────┐  │
│  │                    ReportsTabContent                       │  │
│  │  ┌─────────────────┬─────────────────┬─────────────────┐  │  │
│  │  │    Coverage     │  City Breakdown │  Opportunities  │  │  │
│  │  │   (sub-tab)     │    (sub-tab)    │    (sub-tab)    │  │  │
│  │  └─────────────────┴─────────────────┴─────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    useLeadScrapeAnalytics                       │
│                         (React Query)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              GET /api/lead-scrape-jobs/analytics                │
│                      (Express Route)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase SQL Query                            │
│           (Aggregation on lead_scrape_jobs table)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Data Layer (Backend)

### 1.1 Create Analytics Service

**File:** `UberEats-Image-Extractor/src/services/lead-scrape-analytics-service.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get summary statistics for lead scraping
 */
async function getSummaryStats(organisationId, filters = {}) {
  const { startDate, endDate, platform } = filters;

  let query = supabase
    .from('lead_scrape_jobs')
    .select('*', { count: 'exact' })
    .eq('organisation_id', organisationId)
    .in('status', ['completed', 'in_progress']);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (platform) query = query.eq('platform', platform);

  const { data: jobs, count, error } = await query;

  if (error) throw error;

  // Calculate aggregates
  const stats = {
    total_jobs: count,
    completed_jobs: jobs.filter(j => j.status === 'completed').length,
    total_leads_extracted: jobs.reduce((sum, j) => sum + (j.leads_extracted || 0), 0),
    total_leads_passed: jobs.reduce((sum, j) => sum + (j.leads_passed || 0), 0),
    total_leads_failed: jobs.reduce((sum, j) => sum + (j.leads_failed || 0), 0),
    unique_cities: [...new Set(jobs.map(j => j.city).filter(Boolean))].length,
    unique_cuisines: [...new Set(jobs.map(j => j.cuisine).filter(Boolean))].length,
    avg_success_rate: jobs.length > 0
      ? jobs.reduce((sum, j) => {
          const total = (j.leads_passed || 0) + (j.leads_failed || 0);
          return sum + (total > 0 ? (j.leads_passed || 0) / total : 0);
        }, 0) / jobs.length * 100
      : 0
  };

  return stats;
}

/**
 * Get coverage data grouped by city and cuisine
 */
async function getCoverageByCity(organisationId, filters = {}) {
  const { startDate, endDate, platform, city, cuisine } = filters;

  let query = supabase
    .from('lead_scrape_jobs')
    .select('city, cuisine, leads_extracted, leads_passed, leads_failed, page_offset, leads_limit, status, completed_at')
    .eq('organisation_id', organisationId)
    .eq('status', 'completed');

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (platform) query = query.eq('platform', platform);
  if (city) query = query.eq('city', city);
  if (cuisine) query = query.eq('cuisine', cuisine);

  const { data: jobs, error } = await query;

  if (error) throw error;

  // Group by city
  const cityMap = {};
  jobs.forEach(job => {
    const cityKey = job.city || 'Unknown';
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = {
        city: cityKey,
        total_leads: 0,
        total_jobs: 0,
        cuisines: {},
        last_scraped: null,
        max_page_offset: 0
      };
    }

    cityMap[cityKey].total_leads += job.leads_extracted || 0;
    cityMap[cityKey].total_jobs += 1;

    // Track max page offset for this city
    const maxPageForJob = (job.page_offset || 1) + Math.ceil((job.leads_limit || 0) / 21) - 1;
    if (maxPageForJob > cityMap[cityKey].max_page_offset) {
      cityMap[cityKey].max_page_offset = maxPageForJob;
    }

    // Update last scraped
    if (!cityMap[cityKey].last_scraped ||
        (job.completed_at && job.completed_at > cityMap[cityKey].last_scraped)) {
      cityMap[cityKey].last_scraped = job.completed_at;
    }

    // Track cuisine breakdown
    const cuisineKey = job.cuisine || 'Unknown';
    if (!cityMap[cityKey].cuisines[cuisineKey]) {
      cityMap[cityKey].cuisines[cuisineKey] = {
        leads: 0,
        jobs: 0,
        max_page: 0
      };
    }
    cityMap[cityKey].cuisines[cuisineKey].leads += job.leads_extracted || 0;
    cityMap[cityKey].cuisines[cuisineKey].jobs += 1;
    if (maxPageForJob > cityMap[cityKey].cuisines[cuisineKey].max_page) {
      cityMap[cityKey].cuisines[cuisineKey].max_page = maxPageForJob;
    }
  });

  // Convert to array and sort by total leads
  return Object.values(cityMap)
    .map(city => ({
      ...city,
      cuisines: Object.entries(city.cuisines).map(([name, data]) => ({
        name,
        ...data
      })).sort((a, b) => b.leads - a.leads)
    }))
    .sort((a, b) => b.total_leads - a.total_leads);
}

/**
 * Get heatmap matrix data (city × cuisine)
 */
async function getHeatmapMatrix(organisationId, filters = {}) {
  const coverage = await getCoverageByCity(organisationId, filters);

  // Extract all unique cuisines
  const allCuisines = new Set();
  coverage.forEach(city => {
    city.cuisines.forEach(c => allCuisines.add(c.name));
  });

  const cuisineList = [...allCuisines].sort();
  const cities = coverage.map(c => c.city);

  // Build matrix
  const matrix = coverage.map(city => {
    return cuisineList.map(cuisine => {
      const found = city.cuisines.find(c => c.name === cuisine);
      return found ? found.leads : 0;
    });
  });

  // Find max value for color scaling
  const maxValue = Math.max(...matrix.flat(), 1);

  return {
    cities,
    cuisines: cuisineList,
    matrix,
    maxValue
  };
}

/**
 * Get gap opportunities (city/cuisine combinations with low coverage)
 */
async function getOpportunities(organisationId, filters = {}) {
  const coverage = await getCoverageByCity(organisationId, filters);

  const opportunities = [];

  // Define expected cuisines per city (this could come from config)
  const expectedCuisines = [
    'Pizza', 'Thai', 'Chinese', 'Indian', 'Japanese',
    'Mexican', 'Italian', 'Burger', 'Korean', 'Vietnamese'
  ];

  // Get all cities we've scraped
  const cities = coverage.map(c => c.city);

  cities.forEach(city => {
    const cityData = coverage.find(c => c.city === city);

    expectedCuisines.forEach(cuisine => {
      const cuisineData = cityData?.cuisines.find(c => c.name === cuisine);
      const currentLeads = cuisineData?.leads || 0;
      const currentMaxPage = cuisineData?.max_page || 0;

      // Calculate opportunity score (higher = more opportunity)
      // Factors: low lead count, hasn't been scraped recently, low page coverage
      let score = 0;

      if (currentLeads === 0) {
        score = 100; // Never scraped this combo
      } else if (currentLeads < 20) {
        score = 80 - currentLeads; // Low coverage
      } else if (currentMaxPage < 3) {
        score = 50 - (currentMaxPage * 10); // Only scraped first pages
      }

      if (score > 20) { // Only include meaningful opportunities
        opportunities.push({
          city,
          cuisine,
          current_leads: currentLeads,
          current_max_page: currentMaxPage,
          suggested_page_offset: currentMaxPage + 1,
          opportunity_score: Math.round(score),
          priority: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
          last_scraped: cuisineData?.last_scraped || null
        });
      }
    });
  });

  // Sort by score descending
  return opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);
}

module.exports = {
  getSummaryStats,
  getCoverageByCity,
  getHeatmapMatrix,
  getOpportunities
};
```

### 1.2 Create Analytics Routes

**File:** `UberEats-Image-Extractor/src/routes/lead-scrape-analytics-routes.js`

```javascript
const express = require('express');
const router = express.Router();
const analyticsService = require('../services/lead-scrape-analytics-service');
const { authenticateToken } = require('../../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/lead-scrape-jobs/analytics/summary
 * Get summary statistics
 */
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, platform } = req.query;
    const organisationId = req.user.organisation_id;

    const stats = await analyticsService.getSummaryStats(organisationId, {
      startDate,
      endDate,
      platform
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/coverage
 * Get coverage data by city/cuisine
 */
router.get('/coverage', async (req, res) => {
  try {
    const { startDate, endDate, platform, city, cuisine } = req.query;
    const organisationId = req.user.organisation_id;

    const coverage = await analyticsService.getCoverageByCity(organisationId, {
      startDate,
      endDate,
      platform,
      city,
      cuisine
    });

    res.json({ success: true, data: coverage });
  } catch (error) {
    console.error('Error fetching coverage data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/heatmap
 * Get heatmap matrix data
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { startDate, endDate, platform } = req.query;
    const organisationId = req.user.organisation_id;

    const heatmap = await analyticsService.getHeatmapMatrix(organisationId, {
      startDate,
      endDate,
      platform
    });

    res.json({ success: true, data: heatmap });
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lead-scrape-jobs/analytics/opportunities
 * Get gap/opportunity analysis
 */
router.get('/opportunities', async (req, res) => {
  try {
    const { startDate, endDate, platform, minScore } = req.query;
    const organisationId = req.user.organisation_id;

    let opportunities = await analyticsService.getOpportunities(organisationId, {
      startDate,
      endDate,
      platform
    });

    // Filter by minimum score if provided
    if (minScore) {
      opportunities = opportunities.filter(o => o.opportunity_score >= parseInt(minScore));
    }

    res.json({ success: true, data: opportunities });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### 1.3 Register Routes in Server

**File to modify:** `UberEats-Image-Extractor/server.js`

Add after existing route registrations:

```javascript
const leadScrapeAnalyticsRoutes = require('./src/routes/lead-scrape-analytics-routes');
app.use('/api/lead-scrape-jobs/analytics', leadScrapeAnalyticsRoutes);
```

---

## Phase 2: Data Layer (Frontend Hook)

### 2.1 Create Analytics Hook

**File:** `UberEats-Image-Extractor/src/hooks/useLeadScrapeAnalytics.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

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
  max_page: number;
}

export interface CityCoverage {
  city: string;
  total_leads: number;
  total_jobs: number;
  cuisines: CuisineData[];
  last_scraped: string | null;
  max_page_offset: number;
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
```

---

## Phase 3: UI Components

### 3.1 Install recharts (Optional)

If we decide to use recharts for charts:

```bash
cd UberEats-Image-Extractor
npm install recharts
```

However, the investigation recommended **custom CSS-based visualizations** to minimize dependencies. The implementation below uses Tailwind CSS only.

### 3.2 Create Visualization Components

#### ProgressBar Component

**File:** `UberEats-Image-Extractor/src/components/reports/visualizations/ProgressBar.tsx`

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = true,
  color = 'blue',
  size = 'md',
  onClick,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div
      className={cn(
        'space-y-1.5',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity'
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium truncate">{label}</span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{value.toLocaleString()}</span>
          {showPercentage && (
            <span className="text-xs">({percentage}%)</span>
          )}
        </div>
      </div>
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-300', colorClasses[color])}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

#### StatCard Component

**File:** `UberEats-Image-Extractor/src/components/reports/visualizations/StatCard.tsx`

```tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={cn('p-2 rounded-lg', colorClasses[color])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span
              className={cn(
                trend.direction === 'up' && 'text-green-600',
                trend.direction === 'down' && 'text-red-600',
                trend.direction === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend.direction === 'up' && '↑'}
              {trend.direction === 'down' && '↓'}
              {trend.value}%
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### HeatmapGrid Component

**File:** `UberEats-Image-Extractor/src/components/reports/visualizations/HeatmapGrid.tsx`

```tsx
import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeatmapGridProps {
  cities: string[];
  cuisines: string[];
  matrix: number[][];
  maxValue: number;
  onCellClick?: (city: string, cuisine: string, value: number) => void;
}

function getHeatmapColor(value: number, max: number): string {
  if (value === 0) return 'bg-muted text-muted-foreground';

  const percentage = (value / max) * 100;

  if (percentage >= 80) return 'bg-green-500 text-white';
  if (percentage >= 60) return 'bg-green-400 text-white';
  if (percentage >= 40) return 'bg-yellow-400 text-gray-900';
  if (percentage >= 20) return 'bg-orange-400 text-white';
  return 'bg-red-300 text-gray-900';
}

export function HeatmapGrid({
  cities,
  cuisines,
  matrix,
  maxValue,
  onCellClick,
}: HeatmapGridProps) {
  if (cities.length === 0 || cuisines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for heatmap
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left font-semibold sticky left-0 bg-background z-10">
                City
              </th>
              {cuisines.map((cuisine) => (
                <th
                  key={cuisine}
                  className="p-2 text-center font-medium text-xs min-w-[60px]"
                >
                  <span className="writing-mode-vertical transform -rotate-45 inline-block">
                    {cuisine}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cities.map((city, cityIndex) => (
              <tr key={city} className="border-t">
                <td className="p-2 font-medium sticky left-0 bg-background">
                  {city}
                </td>
                {cuisines.map((cuisine, cuisineIndex) => {
                  const value = matrix[cityIndex]?.[cuisineIndex] ?? 0;
                  return (
                    <td key={`${city}-${cuisine}`} className="p-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              'w-full h-8 rounded text-xs font-semibold transition-all',
                              'hover:ring-2 hover:ring-offset-1 hover:ring-primary',
                              getHeatmapColor(value, maxValue),
                              onCellClick && 'cursor-pointer'
                            )}
                            onClick={() => onCellClick?.(city, cuisine, value)}
                          >
                            {value > 0 ? value : '-'}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{city} - {cuisine}</p>
                          <p>{value} leads extracted</p>
                          {value === 0 && (
                            <p className="text-yellow-500 text-xs mt-1">
                              Click to start scraping
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
```

#### OpportunityCard Component

**File:** `UberEats-Image-Extractor/src/components/reports/OpportunityCard.tsx`

```tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Calendar, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Opportunity } from '@/hooks/useLeadScrapeAnalytics';
import { formatDistanceToNow } from 'date-fns';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onStartScrape: (opportunity: Opportunity) => void;
  onViewDetails?: (opportunity: Opportunity) => void;
}

const priorityColors = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const priorityLabels = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export function OpportunityCard({
  opportunity,
  onStartScrape,
  onViewDetails,
}: OpportunityCardProps) {
  const lastScrapedText = opportunity.last_scraped
    ? formatDistanceToNow(new Date(opportunity.last_scraped), { addSuffix: true })
    : 'Never scraped';

  return (
    <Card className={cn('border-l-4', priorityColors[opportunity.priority])}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {opportunity.city} - {opportunity.cuisine}
            </CardTitle>
            <Badge variant="outline" className="mt-1 text-xs">
              {priorityLabels[opportunity.priority]}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{opportunity.opportunity_score}</div>
            <div className="text-xs text-muted-foreground">Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-muted-foreground">Current Leads:</span>
            <span className="ml-2 font-medium">{opportunity.current_leads}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max Page:</span>
            <span className="ml-2 font-medium">{opportunity.current_max_page}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Suggested Start:</span>
            <span className="ml-2 font-medium">Page {opportunity.suggested_page_offset}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Scraped:</span>
            <span className="ml-2 font-medium">{lastScrapedText}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onStartScrape(opportunity)}
          >
            <Play className="h-4 w-4 mr-1" />
            Start Scrape
          </Button>
          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(opportunity)}
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.3 Create Tab Content Components

#### CoverageOverviewTab

**File:** `UberEats-Image-Extractor/src/components/reports/CoverageOverviewTab.tsx`

```tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './visualizations/StatCard';
import { ProgressBar } from './visualizations/ProgressBar';
import {
  useAnalyticsSummary,
  useAnalyticsCoverage,
  AnalyticsFilters
} from '@/hooks/useLeadScrapeAnalytics';
import {
  BarChart3,
  Users,
  CheckCircle,
  MapPin,
  Utensils,
  TrendingUp
} from 'lucide-react';

interface CoverageOverviewTabProps {
  filters: AnalyticsFilters;
  onCityClick?: (city: string) => void;
}

export function CoverageOverviewTab({ filters, onCityClick }: CoverageOverviewTabProps) {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(filters);
  const { data: coverage, isLoading: coverageLoading } = useAnalyticsCoverage(filters);

  if (summaryLoading || coverageLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const maxLeads = coverage ? Math.max(...coverage.map(c => c.total_leads), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={summary?.total_jobs ?? 0}
          subtitle={`${summary?.completed_jobs ?? 0} completed`}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Leads Extracted"
          value={summary?.total_leads_extracted ?? 0}
          subtitle={`${summary?.total_leads_passed ?? 0} passed`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Cities Covered"
          value={summary?.unique_cities ?? 0}
          icon={MapPin}
          color="purple"
        />
        <StatCard
          title="Cuisines Tracked"
          value={summary?.unique_cuisines ?? 0}
          icon={Utensils}
          color="orange"
        />
      </div>

      {/* Success Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold">
              {(summary?.avg_success_rate ?? 0).toFixed(1)}%
            </div>
            <div className="flex-1">
              <ProgressBar
                value={summary?.total_leads_passed ?? 0}
                max={(summary?.total_leads_passed ?? 0) + (summary?.total_leads_failed ?? 0)}
                label="Leads passed vs failed"
                color="green"
                size="lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coverage by City */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coverage by City</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {coverage?.slice(0, 10).map((city) => (
            <ProgressBar
              key={city.city}
              value={city.total_leads}
              max={maxLeads}
              label={city.city}
              color="blue"
              onClick={() => onCityClick?.(city.city)}
            />
          ))}
          {coverage && coverage.length > 10 && (
            <p className="text-sm text-muted-foreground text-center">
              + {coverage.length - 10} more cities
            </p>
          )}
          {(!coverage || coverage.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No scrape data available. Start a scrape job to see coverage.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### CityBreakdownTab

**File:** `UberEats-Image-Extractor/src/components/reports/CityBreakdownTab.tsx`

```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeatmapGrid } from './visualizations/HeatmapGrid';
import {
  useAnalyticsCoverage,
  useAnalyticsHeatmap,
  AnalyticsFilters
} from '@/hooks/useLeadScrapeAnalytics';
import {
  Table as TableIcon,
  Grid,
  Download,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CityBreakdownTabProps {
  filters: AnalyticsFilters;
  onStartScrape?: (city: string, cuisine: string) => void;
}

export function CityBreakdownTab({ filters, onStartScrape }: CityBreakdownTabProps) {
  const [view, setView] = useState<'table' | 'heatmap'>('table');
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const { data: coverage, isLoading: coverageLoading } = useAnalyticsCoverage(filters);
  const { data: heatmap, isLoading: heatmapLoading } = useAnalyticsHeatmap(filters);

  const toggleCity = (city: string) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(city)) {
      newExpanded.delete(city);
    } else {
      newExpanded.add(city);
    }
    setExpandedCities(newExpanded);
  };

  const exportCSV = () => {
    if (!coverage) return;

    const rows = [['City', 'Cuisine', 'Leads', 'Jobs', 'Max Page']];
    coverage.forEach(city => {
      city.cuisines.forEach(cuisine => {
        rows.push([
          city.city,
          cuisine.name,
          cuisine.leads.toString(),
          cuisine.jobs.toString(),
          cuisine.max_page.toString()
        ]);
      });
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-coverage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (coverageLoading || heatmapLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      {/* View Toggle & Actions */}
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'heatmap')}>
          <TabsList>
            <TabsTrigger value="table" className="gap-1">
              <TableIcon className="h-4 w-4" /> Table
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-1">
              <Grid className="h-4 w-4" /> Heatmap
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Total Leads</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Cuisines</TableHead>
                  <TableHead className="text-right">Max Page</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverage?.map((city) => (
                  <Collapsible key={city.city} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCity(city.city)}
                        >
                          <TableCell>
                            {expandedCities.has(city.city) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{city.city}</TableCell>
                          <TableCell className="text-right">{city.total_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{city.total_jobs}</TableCell>
                          <TableCell className="text-right">{city.cuisines.length}</TableCell>
                          <TableCell className="text-right">{city.max_page_offset}</TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <>
                          {expandedCities.has(city.city) && city.cuisines.map((cuisine) => (
                            <TableRow key={`${city.city}-${cuisine.name}`} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell className="pl-8 text-sm text-muted-foreground">
                                {cuisine.name}
                              </TableCell>
                              <TableCell className="text-right text-sm">{cuisine.leads}</TableCell>
                              <TableCell className="text-right text-sm">{cuisine.jobs}</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right text-sm">{cuisine.max_page}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
                {(!coverage || coverage.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No coverage data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Heatmap View */}
      {view === 'heatmap' && heatmap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage Heatmap (City x Cuisine)</CardTitle>
          </CardHeader>
          <CardContent>
            <HeatmapGrid
              cities={heatmap.cities}
              cuisines={heatmap.cuisines}
              matrix={heatmap.matrix}
              maxValue={heatmap.maxValue}
              onCellClick={(city, cuisine, value) => {
                if (value === 0 && onStartScrape) {
                  onStartScrape(city, cuisine);
                }
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### OpportunitiesTab

**File:** `UberEats-Image-Extractor/src/components/reports/OpportunitiesTab.tsx`

```tsx
import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OpportunityCard } from './OpportunityCard';
import {
  useAnalyticsOpportunities,
  AnalyticsFilters,
  Opportunity
} from '@/hooks/useLeadScrapeAnalytics';

interface OpportunitiesTabProps {
  filters: AnalyticsFilters;
  onStartScrape: (opportunity: Opportunity) => void;
}

export function OpportunitiesTab({ filters, onStartScrape }: OpportunitiesTabProps) {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');

  const { data: opportunities, isLoading } = useAnalyticsOpportunities(filters);

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

  // Apply priority filter
  if (priorityFilter !== 'all') {
    filtered = filtered.filter(o => o.priority === priorityFilter);
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-40">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
            {priorityFilter !== 'all'
              ? 'Try adjusting your priority filter'
              : 'Great coverage! All city/cuisine combinations have been scraped.'}
          </p>
        </div>
      )}
    </div>
  );
}
```

### 3.4 Create Main ReportsTab Container

**File:** `UberEats-Image-Extractor/src/components/reports/ReportsTabContent.tsx`

```tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoverageOverviewTab } from './CoverageOverviewTab';
import { CityBreakdownTab } from './CityBreakdownTab';
import { OpportunitiesTab } from './OpportunitiesTab';
import { AnalyticsFilters, Opportunity } from '@/hooks/useLeadScrapeAnalytics';
import { BarChart3, Grid, Target } from 'lucide-react';

interface ReportsTabContentProps {
  onStartScrape: (params: { city: string; cuisine: string; pageOffset?: number }) => void;
}

export function ReportsTabContent({ onStartScrape }: ReportsTabContentProps) {
  const [subTab, setSubTab] = useState('coverage');
  const [filters] = useState<AnalyticsFilters>({});

  const handleOpportunityStartScrape = (opportunity: Opportunity) => {
    onStartScrape({
      city: opportunity.city,
      cuisine: opportunity.cuisine,
      pageOffset: opportunity.suggested_page_offset,
    });
  };

  const handleHeatmapStartScrape = (city: string, cuisine: string) => {
    onStartScrape({ city, cuisine });
  };

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="coverage" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="gap-1">
            <Grid className="h-4 w-4" />
            City Breakdown
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1">
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coverage" className="mt-4">
          <CoverageOverviewTab
            filters={filters}
            onCityClick={(city) => {
              // Switch to breakdown tab filtered by city
              setSubTab('breakdown');
            }}
          />
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <CityBreakdownTab
            filters={filters}
            onStartScrape={handleHeatmapStartScrape}
          />
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4">
          <OpportunitiesTab
            filters={filters}
            onStartScrape={handleOpportunityStartScrape}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Phase 4: Integration with LeadScrapes.tsx

### 4.1 Modify LeadScrapes.tsx

Add the Reports tab to the existing tabs structure.

**File to modify:** `UberEats-Image-Extractor/src/pages/LeadScrapes.tsx`

**Changes needed:**

1. Import the ReportsTabContent component
2. Add "reports" to the TabsTrigger list
3. Add TabsContent for reports
4. Handle the onStartScrape callback to open the New Scrape dialog with pre-filled values

```tsx
// Add import at top
import { ReportsTabContent } from '@/components/reports/ReportsTabContent';
import { BarChart3 } from 'lucide-react';

// In the tabs section, add:
<TabsTrigger value="reports" className="gap-1">
  <BarChart3 className="h-4 w-4" />
  Reports
</TabsTrigger>

// Add TabsContent:
<TabsContent value="reports">
  <ReportsTabContent
    onStartScrape={(params) => {
      // Pre-fill the new scrape dialog
      setNewScrapeDefaults(params);
      setShowNewScrapeDialog(true);
    }}
  />
</TabsContent>
```

---

## Implementation Checklist

### Phase 1: Backend (2 hours)
- [ ] Create `lead-scrape-analytics-service.js` with 4 methods
- [ ] Create `lead-scrape-analytics-routes.js` with 4 endpoints
- [ ] Register routes in `server.js`
- [ ] Test endpoints with Postman/curl

### Phase 2: Frontend Hook (30 min)
- [ ] Create `useLeadScrapeAnalytics.ts` hook
- [ ] Add TypeScript interfaces
- [ ] Test hook with dev tools

### Phase 3: UI Components (4 hours)
- [ ] Create `visualizations/ProgressBar.tsx`
- [ ] Create `visualizations/StatCard.tsx`
- [ ] Create `visualizations/HeatmapGrid.tsx`
- [ ] Create `OpportunityCard.tsx`
- [ ] Create `CoverageOverviewTab.tsx`
- [ ] Create `CityBreakdownTab.tsx`
- [ ] Create `OpportunitiesTab.tsx`
- [ ] Create `ReportsTabContent.tsx`

### Phase 4: Integration (1 hour)
- [ ] Modify `LeadScrapes.tsx` to add Reports tab
- [ ] Wire up `onStartScrape` callback to New Scrape dialog
- [ ] Test full flow end-to-end
- [ ] Verify responsive design on mobile

### Phase 5: Polish (1 hour)
- [ ] Add loading states and error handling
- [ ] Add empty states with helpful messaging
- [ ] Test with real data
- [ ] Performance check (memoization if needed)

---

## File Structure Summary

```
UberEats-Image-Extractor/src/
├── services/
│   └── lead-scrape-analytics-service.js    (NEW)
├── routes/
│   └── lead-scrape-analytics-routes.js     (NEW)
├── hooks/
│   └── useLeadScrapeAnalytics.ts           (NEW)
├── components/
│   └── reports/
│       ├── ReportsTabContent.tsx           (NEW)
│       ├── CoverageOverviewTab.tsx         (NEW)
│       ├── CityBreakdownTab.tsx            (NEW)
│       ├── OpportunitiesTab.tsx            (NEW)
│       ├── OpportunityCard.tsx             (NEW)
│       └── visualizations/
│           ├── ProgressBar.tsx             (NEW)
│           ├── StatCard.tsx                (NEW)
│           └── HeatmapGrid.tsx             (NEW)
└── pages/
    └── LeadScrapes.tsx                     (MODIFY)
```

---

## Testing Strategy

### Unit Tests
- Test analytics service calculations
- Test hook data transformations
- Test component rendering with mock data

### Integration Tests
- Test API endpoints return correct aggregations
- Test full flow from Reports → Start Scrape → Dialog opens

### Manual Testing
- Verify heatmap colors match data intensity
- Verify opportunity scores are logical
- Verify CSV export is valid
- Test on mobile viewport sizes

---

## Notes

- **No database migrations needed** - uses existing schema
- **No new dependencies needed** - uses Tailwind CSS for visualizations
- **Performance**: Queries are cached for 5 minutes via React Query
- **Extensibility**: Filters structure allows easy addition of date range, platform filters later
