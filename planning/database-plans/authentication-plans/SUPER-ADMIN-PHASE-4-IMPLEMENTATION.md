# Super Admin Dashboard - Phase 4: Usage Statistics Implementation

## Overview
Phase 4 implements comprehensive usage tracking and statistics dashboard with billing calculations and export functionality. This phase hooks into all existing extraction endpoints to track billable events and provides detailed analytics.

## Timeline
**Duration**: 2 Days (16-20 hours)
**Prerequisites**: Phases 1-3 completed
**Deliverable**: Full usage statistics dashboard with tracking, filtering, and export capabilities

## Architecture Overview

### Usage Tracking Flow
```
User Action → API Endpoint → Track Usage Event → Store in DB → Display in Dashboard
                     ↓
              Billing Calculation → Export Reports
```

### Event Types to Track
```typescript
enum UsageEventType {
  // Extraction Events
  STANDARD_EXTRACTION = 'standard_extraction',
  PREMIUM_EXTRACTION = 'premium_extraction',
  
  // Logo Events
  LOGO_EXTRACTION = 'logo_extraction',
  LOGO_PROCESSING = 'logo_processing',
  
  // Search Events
  GOOGLE_SEARCH = 'google_search',
  PLATFORM_DETAILS = 'platform_details',
  
  // Export Events
  CSV_DOWNLOAD = 'csv_download',
  CSV_WITH_IMAGES_DOWNLOAD = 'csv_with_images_download',
  
  // Image Events
  IMAGE_UPLOAD_JOB = 'image_upload_job',
  IMAGE_CDN_UPLOAD = 'image_cdn_upload',
  IMAGE_ZIP_DOWNLOAD = 'image_zip_download',
  IMAGE_DOWNLOAD = 'image_download',
  
  // Restaurant/Menu Events
  RESTAURANT_CREATED = 'restaurant_created',
  MENU_CREATED = 'menu_created',
  MENU_ITEM_EXTRACTED = 'menu_item_extracted'
}
```

## Task Breakdown

### Task 1: Backend Usage Tracking Integration (4 hours)

#### 1.1 Create Usage Tracking Service
**File**: `/src/services/usage-tracking-service.js`
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class UsageTrackingService {
  /**
   * Track a usage event
   * @param {string} organisationId - Organization ID
   * @param {string} eventType - Type of event
   * @param {number} quantity - Quantity (default 1)
   * @param {object} metadata - Additional metadata
   */
  static async trackEvent(organisationId, eventType, quantity = 1, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('usage_events')
        .insert({
          organisation_id: organisationId,
          event_type: eventType,
          quantity: quantity,
          metadata: metadata
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log(`Tracked ${eventType} for org ${organisationId}: ${quantity} units`);
      return data;
    } catch (error) {
      console.error('Failed to track usage event:', error);
      // Don't throw - we don't want tracking failures to break functionality
      return null;
    }
  }

  /**
   * Track extraction with items
   */
  static async trackExtraction(organisationId, extractionType, itemCount, metadata = {}) {
    const eventType = extractionType === 'premium' 
      ? 'premium_extraction' 
      : 'standard_extraction';
    
    // Track the extraction itself
    await this.trackEvent(organisationId, eventType, 1, metadata);
    
    // Track the items extracted
    if (itemCount > 0) {
      await this.trackEvent(
        organisationId, 
        'menu_item_extracted', 
        itemCount, 
        { ...metadata, extraction_type: extractionType }
      );
    }
  }

  /**
   * Track CSV download
   */
  static async trackCSVDownload(organisationId, withImages, metadata = {}) {
    const eventType = withImages 
      ? 'csv_with_images_download' 
      : 'csv_download';
    
    await this.trackEvent(organisationId, eventType, 1, metadata);
  }

  /**
   * Track image operations
   */
  static async trackImageOperation(organisationId, operation, imageCount = 1, metadata = {}) {
    const eventTypeMap = {
      'upload': 'image_cdn_upload',
      'download': 'image_download',
      'zip': 'image_zip_download',
      'upload_job': 'image_upload_job'
    };
    
    const eventType = eventTypeMap[operation];
    if (eventType) {
      await this.trackEvent(organisationId, eventType, imageCount, metadata);
    }
  }

  /**
   * Get usage statistics for an organization
   */
  static async getUsageStats(organisationId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .rpc('get_usage_statistics', {
          p_org_id: organisationId,
          p_start_date: startDate,
          p_end_date: endDate
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }
}

module.exports = { UsageTrackingService };
```

#### 1.2 Update Existing Endpoints with Tracking
**File**: `/server.js` (modifications to existing endpoints)
```javascript
const { UsageTrackingService } = require('./src/services/usage-tracking-service');

// Example: Update scrape batch endpoint
app.post('/api/scrape/batch', authMiddleware, async (req, res) => {
  try {
    const { urls, extractionType = 'standard' } = req.body;
    const organisationId = req.user.organisationId;
    
    // ... existing extraction logic ...
    
    // Track the extraction
    if (result.success) {
      await UsageTrackingService.trackExtraction(
        organisationId,
        extractionType,
        result.items?.length || 0,
        {
          restaurant_id: result.restaurantId,
          url: urls[0]
        }
      );
    }
    
    res.json(result);
  } catch (error) {
    // ... error handling ...
  }
});

// Example: Update CSV export endpoint
app.get('/api/export/csv/:menuId', authMiddleware, async (req, res) => {
  try {
    const { menuId } = req.params;
    const { includeImages } = req.query;
    const organisationId = req.user.organisationId;
    
    // ... existing export logic ...
    
    // Track the download
    await UsageTrackingService.trackCSVDownload(
      organisationId,
      includeImages === 'true',
      { menu_id: menuId }
    );
    
    res.send(csvData);
  } catch (error) {
    // ... error handling ...
  }
});

// Example: Update logo extraction endpoint
app.post('/api/extract/logo', authMiddleware, async (req, res) => {
  try {
    const { restaurantId, source } = req.body;
    const organisationId = req.user.organisationId;
    
    // ... existing logo extraction logic ...
    
    // Track logo extraction
    await UsageTrackingService.trackEvent(
      organisationId,
      'logo_extraction',
      1,
      { restaurant_id: restaurantId, source }
    );
    
    // If processing was done
    if (result.processed) {
      await UsageTrackingService.trackEvent(
        organisationId,
        'logo_processing',
        1,
        { restaurant_id: restaurantId }
      );
    }
    
    res.json(result);
  } catch (error) {
    // ... error handling ...
  }
});

// Add tracking to all other endpoints...
```

### Task 2: Database Functions for Statistics (2 hours)

#### 2.1 Create Comprehensive Statistics Function
**File**: Database migration
```sql
-- Migration: create_usage_statistics_function
CREATE OR REPLACE FUNCTION get_usage_statistics(
  p_org_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  -- Core Metrics
  total_credits_used NUMERIC,
  total_extractions BIGINT,
  
  -- Restaurant & Menu Metrics
  total_restaurants_created BIGINT,
  total_menu_extractions BIGINT,
  total_menu_items_extracted BIGINT,
  
  -- Standard Extraction Metrics
  total_standard_extractions BIGINT,
  total_standard_menu_items BIGINT,
  
  -- Premium Extraction Metrics
  total_premium_extractions BIGINT,
  total_premium_menu_items BIGINT,
  
  -- Logo Metrics
  total_logos_extracted BIGINT,
  total_logos_processed BIGINT,
  
  -- Search & Platform Metrics
  total_google_search_extractions BIGINT,
  total_platform_details_extractions BIGINT,
  
  -- CSV Export Metrics
  total_csv_downloads BIGINT,
  total_csv_without_images BIGINT,
  total_csv_with_images BIGINT,
  
  -- Image Metrics
  total_image_upload_jobs BIGINT,
  total_images_uploaded_to_cdn BIGINT,
  total_image_zip_downloads BIGINT,
  total_images_downloaded BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH event_counts AS (
    SELECT 
      event_type,
      SUM(quantity) as total_quantity
    FROM usage_events
    WHERE 
      (p_org_id IS NULL OR organisation_id = p_org_id)
      AND created_at >= p_start_date
      AND created_at <= p_end_date
    GROUP BY event_type
  ),
  metrics AS (
    SELECT
      -- Calculate total credits (sum of quantity * rate for each event type)
      COALESCE(
        (SELECT SUM(ec.total_quantity * 
          CASE ec.event_type
            WHEN 'standard_extraction' THEN 0.10
            WHEN 'premium_extraction' THEN 0.25
            WHEN 'logo_extraction' THEN 0.15
            WHEN 'logo_processing' THEN 0.20
            WHEN 'google_search' THEN 0.05
            WHEN 'platform_details' THEN 0.05
            WHEN 'csv_download' THEN 0.01
            WHEN 'csv_with_images_download' THEN 0.02
            WHEN 'image_cdn_upload' THEN 0.001
            WHEN 'image_zip_download' THEN 0.05
            ELSE 0
          END
        ) FROM event_counts ec), 0
      )::NUMERIC as total_credits_used,
      
      -- Total extractions (standard + premium)
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'standard_extraction'), 0) +
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'premium_extraction'), 0) as total_extractions,
      
      -- Individual metrics
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'restaurant_created'), 0) as total_restaurants_created,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'menu_created'), 0) as total_menu_extractions,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'menu_item_extracted'), 0) as total_menu_items_extracted,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'standard_extraction'), 0) as total_standard_extractions,
      COALESCE((SELECT SUM(quantity) FROM usage_events 
        WHERE event_type = 'menu_item_extracted' 
        AND metadata->>'extraction_type' = 'standard'
        AND (p_org_id IS NULL OR organisation_id = p_org_id)
        AND created_at >= p_start_date AND created_at <= p_end_date), 0) as total_standard_menu_items,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'premium_extraction'), 0) as total_premium_extractions,
      COALESCE((SELECT SUM(quantity) FROM usage_events 
        WHERE event_type = 'menu_item_extracted' 
        AND metadata->>'extraction_type' = 'premium'
        AND (p_org_id IS NULL OR organisation_id = p_org_id)
        AND created_at >= p_start_date AND created_at <= p_end_date), 0) as total_premium_menu_items,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'logo_extraction'), 0) as total_logos_extracted,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'logo_processing'), 0) as total_logos_processed,
      
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'google_search'), 0) as total_google_search_extractions,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'platform_details'), 0) as total_platform_details_extractions,
      
      -- CSV metrics
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_download'), 0) +
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_with_images_download'), 0) as total_csv_downloads,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_download'), 0) as total_csv_without_images,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'csv_with_images_download'), 0) as total_csv_with_images,
      
      -- Image metrics
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_upload_job'), 0) as total_image_upload_jobs,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_cdn_upload'), 0) as total_images_uploaded_to_cdn,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_zip_download'), 0) as total_image_zip_downloads,
      COALESCE((SELECT total_quantity FROM event_counts WHERE event_type = 'image_download'), 0) as total_images_downloaded
  )
  SELECT * FROM metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_usage_statistics TO authenticated;
```

#### 2.2 Create Organization Usage Summary Function
```sql
-- Migration: create_org_usage_summary_function
CREATE OR REPLACE FUNCTION get_organization_usage_summary(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  organisation_id UUID,
  organisation_name TEXT,
  total_credits NUMERIC,
  total_events BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as organisation_id,
    o.name as organisation_name,
    COALESCE(SUM(
      ue.quantity * 
      CASE ue.event_type
        WHEN 'standard_extraction' THEN 0.10
        WHEN 'premium_extraction' THEN 0.25
        WHEN 'logo_extraction' THEN 0.15
        WHEN 'logo_processing' THEN 0.20
        WHEN 'google_search' THEN 0.05
        WHEN 'platform_details' THEN 0.05
        WHEN 'csv_download' THEN 0.01
        WHEN 'csv_with_images_download' THEN 0.02
        WHEN 'image_cdn_upload' THEN 0.001
        WHEN 'image_zip_download' THEN 0.05
        ELSE 0
      END
    ), 0)::NUMERIC as total_credits,
    COUNT(ue.id) as total_events,
    MAX(ue.created_at) as last_activity
  FROM organisations o
  LEFT JOIN usage_events ue ON ue.organisation_id = o.id
    AND ue.created_at >= p_start_date
    AND ue.created_at <= p_end_date
  WHERE o.status = 'active'
  GROUP BY o.id, o.name
  ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 3: Frontend Usage Statistics Components (4 hours)

#### 3.1 Usage Statistics Main Component
**File**: `/src/components/super-admin/SuperAdminUsage.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Calendar, Download, Filter, RefreshCw } from 'lucide-react';
import { DatePickerWithRange } from '../ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { UsageStatsGrid } from './UsageStatsGrid';
import { UsageExporter } from './UsageExporter';
import { format } from 'date-fns';

interface UsageStats {
  total_credits_used: number;
  total_extractions: number;
  total_restaurants_created: number;
  total_menu_extractions: number;
  total_menu_items_extracted: number;
  total_standard_extractions: number;
  total_standard_menu_items: number;
  total_premium_extractions: number;
  total_premium_menu_items: number;
  total_logos_extracted: number;
  total_logos_processed: number;
  total_google_search_extractions: number;
  total_platform_details_extractions: number;
  total_csv_downloads: number;
  total_csv_without_images: number;
  total_csv_with_images: number;
  total_image_upload_jobs: number;
  total_images_uploaded_to_cdn: number;
  total_image_zip_downloads: number;
  total_images_downloaded: number;
}

interface Organization {
  id: string;
  name: string;
}

export function SuperAdminUsage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadUsageStats();
  }, [selectedOrg, dateRange]);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadUsageStats = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_usage_statistics', {
        p_org_id: selectedOrg === 'all' ? null : selectedOrg,
        p_start_date: dateRange.from.toISOString(),
        p_end_date: dateRange.to.toISOString()
      });

      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!stats) return;

    const exporter = new UsageExporter();
    const filename = `usage-stats-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}`;
    
    if (format === 'csv') {
      exporter.exportToCSV(stats, filename);
    } else {
      exporter.exportToJSON(stats, filename);
    }
  };

  const presetRanges = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 }
  ];

  const handlePresetRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    
    if (days === 0) {
      from.setHours(0, 0, 0, 0);
    } else if (days === 1) {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
    } else {
      from.setDate(from.getDate() - days);
    }
    
    setDateRange({ from, to });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Statistics</h2>
          <p className="text-gray-500">
            Track usage and calculate billing across organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadUsageStats()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={!stats}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={!stats}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Organization Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Organization</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <DatePickerWithRange
                from={dateRange.from}
                to={dateRange.to}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
              />
            </div>

            {/* Preset Ranges */}
            <div>
              <label className="text-sm font-medium mb-2 block">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {presetRanges.map(preset => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetRange(preset.days)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : stats ? (
        <UsageStatsGrid stats={stats} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No usage data available for the selected period
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### 3.2 Usage Statistics Grid Component
**File**: `/src/components/super-admin/UsageStatsGrid.tsx`
```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  FileText, 
  Download, 
  Image, 
  Search, 
  Package, 
  CreditCard,
  TrendingUp,
  Menu
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  cost?: number;
  category: string;
}

function StatCard({ title, value, icon, subtitle, cost, category }: StatCardProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const getCategoryColor = (cat: string) => {
    const colors = {
      'credits': 'bg-purple-50 text-purple-600',
      'extraction': 'bg-blue-50 text-blue-600',
      'restaurant': 'bg-green-50 text-green-600',
      'logo': 'bg-yellow-50 text-yellow-600',
      'search': 'bg-pink-50 text-pink-600',
      'export': 'bg-indigo-50 text-indigo-600',
      'image': 'bg-orange-50 text-orange-600'
    };
    return colors[cat] || 'bg-gray-50 text-gray-600';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{formatNumber(value)}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {cost !== undefined && (
            <p className="text-sm font-medium text-green-600">
              {formatCurrency(cost)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UsageStatsGridProps {
  stats: any; // Use the UsageStats interface from parent
}

export function UsageStatsGrid({ stats }: UsageStatsGridProps) {
  // Calculate costs based on default rates (these would come from org settings in production)
  const costs = {
    standard_extraction: stats.total_standard_extractions * 0.10,
    premium_extraction: stats.total_premium_extractions * 0.25,
    logo_extraction: stats.total_logos_extracted * 0.15,
    logo_processing: stats.total_logos_processed * 0.20,
    google_search: stats.total_google_search_extractions * 0.05,
    platform_details: stats.total_platform_details_extractions * 0.05,
    csv_download: stats.total_csv_without_images * 0.01,
    csv_with_images: stats.total_csv_with_images * 0.02,
    image_upload: stats.total_images_uploaded_to_cdn * 0.001,
    image_zip: stats.total_image_zip_downloads * 0.05
  };

  const statCards = [
    // Core Metrics
    {
      title: 'Total Credits Used',
      value: stats.total_credits_used,
      icon: <CreditCard className="h-4 w-4" />,
      category: 'credits',
      cost: stats.total_credits_used
    },
    {
      title: 'Total Extractions',
      value: stats.total_extractions,
      icon: <TrendingUp className="h-4 w-4" />,
      subtitle: `${stats.total_standard_extractions} standard, ${stats.total_premium_extractions} premium`,
      category: 'extraction'
    },

    // Restaurant & Menu Metrics
    {
      title: 'Restaurants Created',
      value: stats.total_restaurants_created,
      icon: <Package className="h-4 w-4" />,
      category: 'restaurant'
    },
    {
      title: 'Menu Extractions',
      value: stats.total_menu_extractions,
      icon: <Menu className="h-4 w-4" />,
      subtitle: `${stats.total_menu_items_extracted} total items`,
      category: 'extraction'
    },

    // Standard Extraction
    {
      title: 'Standard Extractions',
      value: stats.total_standard_extractions,
      icon: <FileText className="h-4 w-4" />,
      subtitle: `${stats.total_standard_menu_items} items`,
      cost: costs.standard_extraction,
      category: 'extraction'
    },

    // Premium Extraction
    {
      title: 'Premium Extractions',
      value: stats.total_premium_extractions,
      icon: <FileText className="h-4 w-4" />,
      subtitle: `${stats.total_premium_menu_items} items`,
      cost: costs.premium_extraction,
      category: 'extraction'
    },

    // Logo Metrics
    {
      title: 'Logos Extracted',
      value: stats.total_logos_extracted,
      icon: <Image className="h-4 w-4" />,
      cost: costs.logo_extraction,
      category: 'logo'
    },
    {
      title: 'Logos Processed',
      value: stats.total_logos_processed,
      icon: <Image className="h-4 w-4" />,
      cost: costs.logo_processing,
      category: 'logo'
    },

    // Search Metrics
    {
      title: 'Google Searches',
      value: stats.total_google_search_extractions,
      icon: <Search className="h-4 w-4" />,
      cost: costs.google_search,
      category: 'search'
    },
    {
      title: 'Platform Details',
      value: stats.total_platform_details_extractions,
      icon: <Search className="h-4 w-4" />,
      cost: costs.platform_details,
      category: 'search'
    },

    // CSV Metrics
    {
      title: 'Total CSV Downloads',
      value: stats.total_csv_downloads,
      icon: <Download className="h-4 w-4" />,
      subtitle: `${stats.total_csv_without_images} plain, ${stats.total_csv_with_images} with images`,
      category: 'export'
    },

    // Image Metrics
    {
      title: 'Image Upload Jobs',
      value: stats.total_image_upload_jobs,
      icon: <Image className="h-4 w-4" />,
      subtitle: `${stats.total_images_uploaded_to_cdn} images uploaded`,
      category: 'image'
    },
    {
      title: 'Image ZIP Downloads',
      value: stats.total_image_zip_downloads,
      icon: <Download className="h-4 w-4" />,
      cost: costs.image_zip,
      category: 'image'
    },
    {
      title: 'Individual Image Downloads',
      value: stats.total_images_downloaded,
      icon: <Image className="h-4 w-4" />,
      category: 'image'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {statCards.map((card, index) => (
        <StatCard key={index} {...card} />
      ))}
    </div>
  );
}
```

#### 3.3 Usage Export Utility
**File**: `/src/components/super-admin/UsageExporter.ts`
```typescript
export class UsageExporter {
  /**
   * Export usage statistics to CSV
   */
  exportToCSV(stats: any, filename: string) {
    const headers = [
      'Metric',
      'Value',
      'Rate',
      'Cost'
    ];

    const rows = [
      ['Total Credits Used', stats.total_credits_used, '-', stats.total_credits_used],
      ['Total Extractions', stats.total_extractions, '-', '-'],
      ['Restaurants Created', stats.total_restaurants_created, '-', '-'],
      ['Menu Extractions', stats.total_menu_extractions, '-', '-'],
      ['Menu Items Extracted', stats.total_menu_items_extracted, '-', '-'],
      ['Standard Extractions', stats.total_standard_extractions, '$0.10', stats.total_standard_extractions * 0.10],
      ['Standard Menu Items', stats.total_standard_menu_items, '-', '-'],
      ['Premium Extractions', stats.total_premium_extractions, '$0.25', stats.total_premium_extractions * 0.25],
      ['Premium Menu Items', stats.total_premium_menu_items, '-', '-'],
      ['Logos Extracted', stats.total_logos_extracted, '$0.15', stats.total_logos_extracted * 0.15],
      ['Logos Processed', stats.total_logos_processed, '$0.20', stats.total_logos_processed * 0.20],
      ['Google Search Extractions', stats.total_google_search_extractions, '$0.05', stats.total_google_search_extractions * 0.05],
      ['Platform Details Extractions', stats.total_platform_details_extractions, '$0.05', stats.total_platform_details_extractions * 0.05],
      ['CSV Downloads (Total)', stats.total_csv_downloads, '-', '-'],
      ['CSV Downloads (Without Images)', stats.total_csv_without_images, '$0.01', stats.total_csv_without_images * 0.01],
      ['CSV Downloads (With Images)', stats.total_csv_with_images, '$0.02', stats.total_csv_with_images * 0.02],
      ['Image Upload Jobs', stats.total_image_upload_jobs, '-', '-'],
      ['Images Uploaded to CDN', stats.total_images_uploaded_to_cdn, '$0.001', stats.total_images_uploaded_to_cdn * 0.001],
      ['Image ZIP Downloads', stats.total_image_zip_downloads, '$0.05', stats.total_image_zip_downloads * 0.05],
      ['Individual Image Downloads', stats.total_images_downloaded, '-', '-']
    ];

    // Calculate total cost
    const totalCost = rows.reduce((sum, row) => {
      const cost = row[3];
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);

    // Add total row
    rows.push(['', '', '', '']);
    rows.push(['TOTAL COST', '', '', totalCost]);

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' ? `"${cell}"` : cell
      ).join(','))
    ].join('\n');

    // Download
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  }

  /**
   * Export usage statistics to JSON
   */
  exportToJSON(stats: any, filename: string) {
    const exportData = {
      ...stats,
      billing_summary: {
        standard_extraction_cost: stats.total_standard_extractions * 0.10,
        premium_extraction_cost: stats.total_premium_extractions * 0.25,
        logo_extraction_cost: stats.total_logos_extracted * 0.15,
        logo_processing_cost: stats.total_logos_processed * 0.20,
        google_search_cost: stats.total_google_search_extractions * 0.05,
        platform_details_cost: stats.total_platform_details_extractions * 0.05,
        csv_download_cost: stats.total_csv_without_images * 0.01,
        csv_with_images_cost: stats.total_csv_with_images * 0.02,
        image_upload_cost: stats.total_images_uploaded_to_cdn * 0.001,
        image_zip_cost: stats.total_image_zip_downloads * 0.05,
        total_cost: stats.total_credits_used
      },
      export_timestamp: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    this.downloadFile(jsonContent, `${filename}.json`, 'application/json');
  }

  /**
   * Helper to download a file
   */
  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
```

### Task 4: API Endpoints for Usage Statistics (2 hours)

#### 4.1 Super Admin Usage API Endpoints
**File**: `/server.js` (additions)
```javascript
// Usage Statistics Endpoints
app.get('/api/super-admin/usage/statistics', superAdminMiddleware, async (req, res) => {
  try {
    const { org_id, start_date, end_date } = req.query;
    
    const { data, error } = await supabase.rpc('get_usage_statistics', {
      p_org_id: org_id || null,
      p_start_date: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: end_date || new Date().toISOString()
    });

    if (error) throw error;
    res.json(data[0] || {});
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

app.get('/api/super-admin/usage/organization-summary', superAdminMiddleware, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const { data, error } = await supabase.rpc('get_organization_usage_summary', {
      p_start_date: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: end_date || new Date().toISOString()
    });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching organization summary:', error);
    res.status(500).json({ error: 'Failed to fetch organization summary' });
  }
});

// Manual usage event tracking (for testing)
app.post('/api/super-admin/usage/track', superAdminMiddleware, async (req, res) => {
  try {
    const { organisation_id, event_type, quantity, metadata } = req.body;
    
    const result = await UsageTrackingService.trackEvent(
      organisation_id,
      event_type,
      quantity,
      metadata
    );
    
    res.json({ success: true, event: result });
  } catch (error) {
    console.error('Error tracking usage event:', error);
    res.status(500).json({ error: 'Failed to track usage event' });
  }
});
```

### Task 5: Integration and Testing (2 hours)

#### 5.1 Update Existing Extraction Endpoints
Create a comprehensive list of all endpoints that need tracking:

**Endpoints to Update**:
1. `/api/scrape/batch` - Track standard/premium extractions
2. `/api/scrape/single` - Track single extractions
3. `/api/export/csv/:menuId` - Track CSV downloads
4. `/api/export/images/:menuId` - Track image downloads
5. `/api/images/upload-to-cdn` - Track CDN uploads
6. `/api/images/download-zip` - Track ZIP downloads
7. `/api/extract/logo` - Track logo extraction
8. `/api/process/logo` - Track logo processing
9. `/api/search/google` - Track Google searches
10. `/api/search/platform-details` - Track platform details
11. `/api/restaurants/create` - Track restaurant creation
12. `/api/menus/create` - Track menu creation

#### 5.2 Testing Checklist

**Tracking Tests**:
- [ ] Standard extraction creates usage event
- [ ] Premium extraction creates usage event
- [ ] Menu items are tracked separately
- [ ] Logo extraction/processing tracked
- [ ] CSV downloads tracked (with/without images)
- [ ] Image operations tracked
- [ ] Search operations tracked

**Statistics Tests**:
- [ ] Statistics load for all organizations
- [ ] Statistics filter by organization
- [ ] Date range filtering works
- [ ] All metrics calculate correctly
- [ ] Credits calculation is accurate
- [ ] Export to CSV includes all data
- [ ] Export to JSON includes billing summary

**UI Tests**:
- [ ] Date range picker works
- [ ] Organization filter works
- [ ] Preset date ranges work
- [ ] Statistics cards display correctly
- [ ] Loading states display
- [ ] Export buttons work
- [ ] Refresh button updates data

**Performance Tests**:
- [ ] Statistics load in <2 seconds
- [ ] Export handles large datasets
- [ ] Database queries are optimized
- [ ] No N+1 query issues

## Migration Rollout Plan

### Step 1: Deploy Database Changes
```bash
# Run migrations in order
1. Update organizations table (feature flags, billing rates)
2. Create usage_events table
3. Create statistics functions
4. Apply RLS policies
```

### Step 2: Deploy Backend Changes
```bash
1. Deploy usage tracking service
2. Update all extraction endpoints
3. Deploy new API endpoints
4. Test tracking with manual events
```

### Step 3: Deploy Frontend Changes
```bash
1. Deploy usage statistics components
2. Update SuperAdminUsage component
3. Test with real data
4. Verify exports work
```

## Monitoring & Maintenance

### Usage Event Monitoring
```sql
-- Check recent events
SELECT event_type, COUNT(*), SUM(quantity) 
FROM usage_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type;

-- Check for missing events
SELECT 
  (SELECT COUNT(*) FROM extraction_jobs WHERE created_at > NOW() - INTERVAL '1 day') as extractions,
  (SELECT COUNT(*) FROM usage_events WHERE event_type LIKE '%extraction%' AND created_at > NOW() - INTERVAL '1 day') as tracked_extractions;
```

### Performance Monitoring
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM get_usage_statistics(
  NULL,
  NOW() - INTERVAL '30 days',
  NOW()
);
```

## Common Issues & Solutions

### Issue 1: Events Not Being Tracked
**Solution**: Check that tracking service is being called in endpoints:
```javascript
// Verify in endpoint
console.log('Tracking event:', eventType, quantity);
await UsageTrackingService.trackEvent(...);
```

### Issue 2: Statistics Not Calculating
**Solution**: Check database function permissions:
```sql
GRANT EXECUTE ON FUNCTION get_usage_statistics TO authenticated;
GRANT SELECT ON usage_events TO authenticated;
```

### Issue 3: Export Failing
**Solution**: Check browser console for errors, ensure data is loaded:
```typescript
if (!stats) {
  console.error('No stats to export');
  return;
}
```

## Success Criteria

Phase 4 is complete when:
1. ✅ All extraction endpoints track usage events
2. ✅ Usage statistics display for all 20+ metrics
3. ✅ Date range filtering works
4. ✅ Organization filtering works
5. ✅ Export to CSV/JSON works
6. ✅ Billing calculations are accurate
7. ✅ Performance is acceptable (<2s load time)
8. ✅ All tests pass

## Next Steps (Phase 5)
- Polish UI with loading states
- Add error handling
- Implement confirmation dialogs
- Performance optimization
- End-to-end testing

---

**Phase 4 Complete**: Full usage tracking and statistics dashboard implemented