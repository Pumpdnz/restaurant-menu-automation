import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Eye,
  FileText,
  Store,
  Globe,
  Phone,
  Mail,
  Calendar,
  ExternalLink
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

export default function Restaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants');
      setRestaurants(response.data.restaurants || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
      setError('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformBadge = (platforms) => {
    if (!platforms || platforms.length === 0) {
      return <Badge variant="outline" className="text-muted-foreground">No platforms</Badge>;
    }
    
    const platform = platforms[0].platforms?.name || 'unknown';
    const platformColors = {
      ubereats: 'bg-green-100 text-green-800 border-green-200',
      doordash: 'bg-red-100 text-red-800 border-red-200',
      unknown: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    return (
      <Badge 
        variant="outline"
        className={cn('capitalize', platformColors[platform] || platformColors.unknown)}
      >
        {platform}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewRestaurant = (restaurantId) => {
    navigate(`/restaurants/${restaurantId}`);
  };

  const handleViewMenus = (restaurantId) => {
    // Navigate to menus page with restaurant filter
    // TODO: Add filtering support in Menus component
    navigate(`/menus?restaurant=${restaurantId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Store className="h-8 w-8 text-brand-blue animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-brand-red/5 border border-brand-red/20 p-4">
        <p className="text-sm text-brand-red">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-foreground">Restaurants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your restaurants and their menus
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Button
            onClick={() => navigate('/restaurants/new')}
            className="bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            Add Restaurant
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Name</TableHead>
                  <TableHead className="min-w-[100px]">Platform</TableHead>
                  <TableHead className="min-w-[150px]">Contact</TableHead>
                  <TableHead className="min-w-[100px]">Website</TableHead>
                  <TableHead className="min-w-[120px]">Last Scraped</TableHead>
                  <TableHead className="min-w-[100px]">Created</TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No restaurants found. Add a restaurant to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  restaurants.map((restaurant) => (
                    <TableRow key={restaurant.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{restaurant.name}</div>
                            {restaurant.address && (
                              <div className="text-xs text-muted-foreground">{restaurant.address}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPlatformBadge(restaurant.restaurant_platforms)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {restaurant.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {restaurant.phone}
                            </div>
                          )}
                          {restaurant.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {restaurant.email}
                            </div>
                          )}
                          {!restaurant.phone && !restaurant.email && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {restaurant.website ? (
                          <a 
                            href={restaurant.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-blue hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            Visit
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {restaurant.restaurant_platforms?.[0]?.last_scraped_at 
                            ? formatDate(restaurant.restaurant_platforms[0].last_scraped_at)
                            : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(restaurant.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewRestaurant(restaurant.id)}
                            className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                            title="View restaurant details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewMenus(restaurant.id)}
                            className="text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                            title="View menus"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {restaurant.restaurant_platforms?.[0]?.url && (
                            <a 
                              href={restaurant.restaurant_platforms[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                                title="View on platform"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Store className="h-6 w-6 text-brand-blue" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Total Restaurants</p>
              <p className="text-2xl font-semibold text-foreground">{restaurants.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Globe className="h-6 w-6 text-brand-green" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">With Platform URLs</p>
              <p className="text-2xl font-semibold text-foreground">
                {restaurants.filter(r => r.restaurant_platforms?.length > 0).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Mail className="h-6 w-6 text-brand-orange" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">With Contact Info</p>
              <p className="text-2xl font-semibold text-foreground">
                {restaurants.filter(r => r.email || r.phone).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-6 w-6 text-brand-red" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">This Month</p>
              <p className="text-2xl font-semibold text-foreground">
                {restaurants.filter(r => {
                  const created = new Date(r.created_at);
                  const now = new Date();
                  return created.getMonth() === now.getMonth() && 
                         created.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}