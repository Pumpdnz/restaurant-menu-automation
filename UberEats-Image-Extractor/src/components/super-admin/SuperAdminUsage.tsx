import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Calendar, Download, RefreshCw, Loader2, FileJson, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UsageStatsGrid } from './UsageStatsGrid';
import { UsageExporter, type UsageStats } from './UsageExporter';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface Organization {
  id: string;
  name: string;
}

type DatePreset = '7d' | '30d' | '90d' | 'all';

export function SuperAdminUsage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');

  // Calculate date range based on preset
  const getDateRange = () => {
    const end = endOfDay(new Date());
    let start: Date;

    switch (datePreset) {
      case '7d':
        start = startOfDay(subDays(new Date(), 7));
        break;
      case '30d':
        start = startOfDay(subDays(new Date(), 30));
        break;
      case '90d':
        start = startOfDay(subDays(new Date(), 90));
        break;
      case 'all':
        start = new Date('2020-01-01'); // Far enough back to include all data
        break;
      default:
        start = startOfDay(subDays(new Date(), 30));
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadUsageStats();
  }, [selectedOrg, datePreset]);

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
      const { start, end } = getDateRange();

      const { data, error } = await supabase.rpc('get_usage_statistics', {
        p_org_id: selectedOrg === 'all' ? null : selectedOrg,
        p_start_date: start,
        p_end_date: end,
      });

      if (error) throw error;

      // The RPC returns an array with one row, or the row directly
      const statsData = Array.isArray(data) ? data[0] : data;
      setStats(statsData || null);
    } catch (error) {
      console.error('Error loading usage stats:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!stats) return;
    const { start, end } = getDateRange();
    const org = organizations.find(o => o.id === selectedOrg);
    UsageExporter.exportToCSV(stats, {
      organisationId: selectedOrg === 'all' ? undefined : selectedOrg,
      organisationName: org?.name,
      startDate: format(new Date(start), 'yyyy-MM-dd'),
      endDate: format(new Date(end), 'yyyy-MM-dd'),
    });
  };

  const handleExportJSON = () => {
    if (!stats) return;
    const { start, end } = getDateRange();
    const org = organizations.find(o => o.id === selectedOrg);
    UsageExporter.exportToJSON(stats, {
      organisationId: selectedOrg === 'all' ? undefined : selectedOrg,
      organisationName: org?.name,
      startDate: format(new Date(start), 'yyyy-MM-dd'),
      endDate: format(new Date(end), 'yyyy-MM-dd'),
    });
  };

  const getDatePresetLabel = () => {
    switch (datePreset) {
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      case '90d':
        return 'Last 90 Days';
      case 'all':
        return 'All Time';
      default:
        return 'Last 30 Days';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Usage Statistics</h2>
          <p className="text-gray-500">Monitor usage and prepare billing data</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Organization Filter */}
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={loadUsageStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!stats || loading}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Date Range Info */}
      <Card className="bg-gray-50">
        <CardContent className="py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing data for: <span className="font-medium">{getDatePresetLabel()}</span>
              {selectedOrg !== 'all' && (
                <>
                  {' '}&middot;{' '}
                  <span className="font-medium">
                    {organizations.find(o => o.id === selectedOrg)?.name}
                  </span>
                </>
              )}
            </span>
            {loading && (
              <span className="flex items-center text-gray-500">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Loading...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <UsageStatsGrid stats={stats} loading={loading} />
    </div>
  );
}
