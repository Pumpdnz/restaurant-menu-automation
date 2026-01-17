import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Store,
  Download,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { restaurantAPI, extractionAPI } from '../services/api';
import { getRelativeTime } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { CreateLeadScrapeJob } from '../components/leads/CreateLeadScrapeJob';
import { ReportsTabContent } from '../components/reports/ReportsTabContent';
import { useAuth } from '../context/AuthContext';
import { usePendingLeadsPreview } from '../hooks/useDashboard';

export default function Dashboard() {
  // Feature flags
  const { isFeatureEnabled } = useAuth();

  // Dialog state for CreateLeadScrapeJob
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [prefillScrapeData, setPrefillScrapeData] = useState({
    city: undefined,
    cuisine: undefined,
    pageOffset: undefined,
  });

  // Callback for ReportsTabContent to trigger dialog with prefill data
  // ReportsTabContent passes an object with { city, cuisine, pageOffset }
  const handleStartScrape = (params) => {
    setPrefillScrapeData({
      city: params.city,
      cuisine: params.cuisine,
      pageOffset: params.pageOffset,
    });
    setCreateJobOpen(true);
  };

  // Fetch dashboard data
  const { data: restaurants = [], isLoading: restaurantsLoading, error: restaurantsError } = useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      const response = await restaurantAPI.getAll();
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    }
  });

  const { data: recentExtractions = [], isLoading: extractionsLoading, error: extractionsError } = useQuery({
    queryKey: ['recent-extractions'],
    queryFn: async () => {
      const response = await extractionAPI.getAll({ limit: 5 });
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    }
  });

  // Pending Leads Preview
  const { data: pendingLeadsData, isLoading: pendingLeadsLoading } = usePendingLeadsPreview(5);
  const pendingLeads = pendingLeadsData?.leads || [];
  const totalPendingLeads = pendingLeadsData?.total || 0;

  const isLoading = restaurantsLoading || extractionsLoading;

  // Calculate summary stats - with safety checks
  const safeRestaurants = Array.isArray(restaurants) ? restaurants : [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-brand-green" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-brand-red" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-brand-yellow animate-pulse" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your restaurant menu extraction system
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your restaurant menu extraction system
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Restaurants */}
        <Card className="backdrop-blur-sm bg-background/95 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Restaurants</CardTitle>
              <Link 
                to="/restaurants" 
                className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors"
              >
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {safeRestaurants.slice(0, 5).map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/restaurants/${restaurant.id}`}
                  className="block px-6 py-4 hover:bg-accent/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{restaurant.name}</p>
                      <Badge variant="outline" className="mt-1">
                        {restaurant.platform}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-foreground">{restaurant.menu_count || 0} menus</p>
                      <p className="text-xs text-muted-foreground">{getRelativeTime(restaurant.updated_at)}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {safeRestaurants.length === 0 && (
                <div className="px-6 py-8 text-center text-muted-foreground">
                  No restaurants yet. Start by extracting a menu.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Extractions */}
        <Card className="backdrop-blur-sm bg-background/95 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Extractions</CardTitle>
              <Link 
                to="/extractions" 
                className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors"
              >
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {Array.isArray(recentExtractions) && recentExtractions.map((extraction) => (
                <Link
                  key={extraction.id}
                  to={`/extractions/${extraction.id}`}
                  className="block px-6 py-4 hover:bg-accent/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getStatusIcon(extraction.status)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">
                          {extraction.restaurant_name || 'Unknown Restaurant'}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {extraction.platform}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-foreground">
                        {extraction.item_count || 0} items
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getRelativeTime(extraction.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              {(!Array.isArray(recentExtractions) || recentExtractions.length === 0) && (
                <div className="px-6 py-8 text-center text-muted-foreground">
                  No recent extractions. Start a new extraction to see it here.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Scraping Reports - Feature flagged */}
      {isFeatureEnabled('leadScraping') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-purple">Lead Scraping</h2>
            <Link
              to="/leads?tab=reports"
              className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors"
            >
              View Full Reports
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <ReportsTabContent onStartScrape={handleStartScrape} />
        </div>
      )}

      {/* Pending Leads Preview - Feature flagged */}
      {isFeatureEnabled('leadScraping') && (
        <Card className="backdrop-blur-sm bg-background/95 border-border">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base flex items-center gap-2">
              Pending Leads
              <Badge variant="secondary" className="text-xs">
                {totalPendingLeads}
              </Badge>
            </CardTitle>
            <Link to="/leads?tab=pending">
              <div className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {pendingLeadsLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : pendingLeads.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No pending leads to display
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant Name</TableHead>
                    <TableHead className="w-32">City</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLeads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{lead.restaurant_name}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.city || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="backdrop-blur-sm bg-background/95 border-border">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/extractions/new"
              className="flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 transition-all duration-200 shadow-lg"
            >
              <Download className="mr-2 h-4 w-4" />
              New Extraction
            </Link>
            <Link
              to="/restaurants"
              className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200"
            >
              <Store className="mr-2 h-4 w-4" />
              Manage Restaurants
            </Link>
            <Link
              to="/analytics"
              className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              View Analytics
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Create Lead Scrape Job Dialog */}
      <CreateLeadScrapeJob
        open={createJobOpen}
        onClose={() => {
          setCreateJobOpen(false);
          setPrefillScrapeData({ city: undefined, cuisine: undefined, pageOffset: undefined });
        }}
        prefillCity={prefillScrapeData.city}
        prefillCuisine={prefillScrapeData.cuisine}
        prefillPageOffset={prefillScrapeData.pageOffset}
      />
    </div>
  );
}