import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Store, 
  Download, 
  FileText, 
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { restaurantAPI, extractionAPI, analyticsAPI } from '../services/api';
import { cn, formatDate, getRelativeTime } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';

export default function Dashboard() {
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

  const { data: stats = {}, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['extraction-stats'],
    queryFn: async () => {
      const response = await analyticsAPI.getExtractionStats();
      return response.data || {};
    }
  });

  const isLoading = restaurantsLoading || extractionsLoading || statsLoading;

  // Calculate summary stats - with safety checks
  const safeRestaurants = Array.isArray(restaurants) ? restaurants : [];
  const activeRestaurants = safeRestaurants.filter(r => r.status === 'active').length;
  const totalMenus = safeRestaurants.reduce((sum, r) => sum + (r.menu_count || 0), 0);
  const successRate = stats?.success_rate || 0;
  const totalExtractions = stats?.total_extractions || 0;

  const statCards = [
    {
      title: 'Active Restaurants',
      value: activeRestaurants,
      icon: Store,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      borderColor: 'border-brand-blue/20',
    },
    {
      title: 'Total Menus',
      value: totalMenus,
      icon: FileText,
      color: 'text-brand-green',
      bgColor: 'bg-brand-green/10',
      borderColor: 'border-brand-green/20',
    },
    {
      title: 'Extractions',
      value: totalExtractions,
      icon: Download,
      color: 'text-brand-purple',
      bgColor: 'bg-brand-purple/10',
      borderColor: 'border-brand-purple/20',
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      icon: TrendingUp,
      color: 'text-brand-orange',
      bgColor: 'bg-brand-orange/10',
      borderColor: 'border-brand-orange/20',
    },
  ];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className={cn(
                "border backdrop-blur-sm bg-background/95 hover:shadow-lg transition-all duration-200",
                stat.borderColor
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={cn(
                    "rounded-lg p-3",
                    stat.bgColor
                  )}>
                    <Icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
    </div>
  );
}