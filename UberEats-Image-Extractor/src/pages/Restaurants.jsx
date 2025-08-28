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
  ExternalLink,
  Trash2,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Restaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, restaurantId: null, restaurantName: null });
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants');
      const data = response.data.restaurants || [];
      // Sort by created date by default (newest first)
      const sorted = [...data].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA;
      });
      setRestaurants(sorted);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
      setError('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    let direction = 'asc';
    if (sortField === field && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortField(field);
    setSortDirection(direction);

    const sorted = [...restaurants].sort((a, b) => {
      let valueA, valueB;
      
      if (field === 'created_at') {
        valueA = new Date(a.created_at);
        valueB = new Date(b.created_at);
      } else if (field === 'last_scraped') {
        // Use the most recent extraction date
        const aExtractions = a.extractions || [];
        const bExtractions = b.extractions || [];
        valueA = aExtractions.length > 0 ? new Date(aExtractions[0].created_at) : new Date(0);
        valueB = bExtractions.length > 0 ? new Date(bExtractions[0].created_at) : new Date(0);
      }

      if (direction === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    
    setRestaurants(sorted);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
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

  const handleDeleteRestaurant = async () => {
    if (!deleteConfirm.restaurantId) return;
    
    try {
      const response = await api.delete(`/restaurants/${deleteConfirm.restaurantId}`);
      
      if (response.data.success) {
        // Refresh the restaurants list
        await fetchRestaurants();
        console.log('Restaurant deleted successfully');
      }
    } catch (err) {
      console.error('Failed to delete restaurant:', err);
      // You could add error toast here
    } finally {
      setDeleteConfirm({ open: false, restaurantId: null, restaurantName: null });
    }
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
                  <TableHead className="min-w-[200px]">Lead Contact</TableHead>
                  <TableHead 
                    className="min-w-[120px] cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('last_scraped')}
                  >
                    Last Scraped
                    {getSortIcon('last_scraped')}
                  </TableHead>
                  <TableHead 
                    className="min-w-[100px] cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('created_at')}
                  >
                    Created
                    {getSortIcon('created_at')}
                  </TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                        <div className="space-y-1">
                          {restaurant.contact_name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {restaurant.contact_name}
                            </div>
                          )}
                          {restaurant.contact_phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {restaurant.contact_phone}
                            </div>
                          )}
                          {restaurant.contact_email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {restaurant.contact_email}
                            </div>
                          )}
                          {!restaurant.contact_name && !restaurant.contact_phone && !restaurant.contact_email && (
                            <span className="text-xs text-muted-foreground">No lead contact</span>
                          )}
                        </div>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm({ 
                              open: true, 
                              restaurantId: restaurant.id, 
                              restaurantName: restaurant.name 
                            })}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete restaurant"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, restaurantId: null, restaurantName: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Restaurant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.restaurantName}</span>? 
              This will also delete all associated extractions, menus, and menu items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, restaurantId: null, restaurantName: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRestaurant}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Restaurant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}