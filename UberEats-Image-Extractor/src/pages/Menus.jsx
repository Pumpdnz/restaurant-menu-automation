import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { 
  FileText,
  Edit,
  Eye,
  Calendar,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  MoveHorizontal,
  ToggleLeft,
  ToggleRight
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
import { Checkbox } from '../components/ui/checkbox';
import { cn } from '../lib/utils';
import MoveMenusDialog from '../components/MoveMenusDialog';

export default function Menus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMenus, setSelectedMenus] = useState(new Set());
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  
  const restaurantFilter = searchParams.get('restaurant');

  useEffect(() => {
    fetchMenus();
  }, [restaurantFilter]);

  const fetchMenus = async () => {
    try {
      const params = {};
      if (restaurantFilter) {
        params.restaurant = restaurantFilter;
      }
      
      const response = await api.get('/menus', { params });
      setMenus(response.data.menus || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch menus:', err);
      setError('Failed to load menus');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
        <XCircle className="h-3 w-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const getPlatformBadge = (platform) => {
    const platformColors = {
      ubereats: 'bg-green-100 text-green-800 border-green-200',
      doordash: 'bg-red-100 text-red-800 border-red-200',
      unknown: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    return (
      <Badge 
        variant="outline"
        className={cn('capitalize', platformColors[platform?.toLowerCase()] || platformColors.unknown)}
      >
        {platform || 'Unknown'}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewMenu = (menuId) => {
    navigate(`/menus/${menuId}`);
  };

  const handleEditMenu = (menuId) => {
    // Navigate to edit page (to be implemented)
    navigate(`/menus/${menuId}/edit`);
  };

  const handleSelectMenu = (menu) => {
    const newSelected = new Set(selectedMenus);
    if (newSelected.has(menu)) {
      newSelected.delete(menu);
    } else {
      newSelected.add(menu);
    }
    setSelectedMenus(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMenus.size === menus.length) {
      setSelectedMenus(new Set());
    } else {
      setSelectedMenus(new Set(menus));
    }
  };

  const isMenuSelected = (menu) => {
    return Array.from(selectedMenus).some(selected => selected.id === menu.id);
  };

  const handleMoveSuccess = async (result) => {
    // Refresh the menus list
    await fetchMenus();
    // Clear selection
    setSelectedMenus(new Set());
    // Show success message (you could add a toast here)
    console.log(`Successfully moved ${result.updatedCount} menus to ${result.restaurant.name}`);
  };

  const handleToggleStatus = async (menuId, currentStatus) => {
    try {
      const response = await api.patch(`/menus/${menuId}/status`, {
        isActive: !currentStatus
      });
      
      if (response.data.success) {
        // Refresh the menus list to show updated status
        await fetchMenus();
        console.log(response.data.message);
      }
    } catch (err) {
      console.error('Failed to toggle menu status:', err);
      // You could add error toast here
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FileText className="h-8 w-8 text-brand-blue animate-pulse" />
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
          <h1 className="text-2xl font-bold text-foreground">Menus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {restaurantFilter 
              ? `Showing menus for selected restaurant`
              : 'Browse and manage all restaurant menus'}
          </p>
          {selectedMenus.size > 0 && (
            <p className="mt-1 text-sm text-brand-blue font-medium">
              {selectedMenus.size} menu{selectedMenus.size > 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none space-x-2">
          {selectedMenus.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsMoveDialogOpen(true)}
              className="border-brand-blue text-brand-blue hover:bg-brand-blue/10"
            >
              <MoveHorizontal className="h-4 w-4 mr-2" />
              Move {selectedMenus.size} Menu{selectedMenus.size > 1 ? 's' : ''}
            </Button>
          )}
          {restaurantFilter && (
            <Button
              variant="outline"
              onClick={() => navigate('/menus')}
            >
              Show All Menus
            </Button>
          )}
          <Button
            onClick={() => navigate('/extractions/new')}
            className="bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            Extract New Menu
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={menus.length > 0 && selectedMenus.size === menus.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="min-w-[200px]">Restaurant</TableHead>
                  <TableHead className="min-w-[100px]">Version</TableHead>
                  <TableHead className="min-w-[100px]">Platform</TableHead>
                  <TableHead className="min-w-[80px]">Items</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[150px]">Created</TableHead>
                  <TableHead className="min-w-[150px]">Last Updated</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {restaurantFilter 
                        ? 'No menus found for this restaurant.' 
                        : 'No menus found. Extract a menu to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  menus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell>
                        <Checkbox
                          checked={isMenuSelected(menu)}
                          onCheckedChange={() => handleSelectMenu(menu)}
                          aria-label={`Select menu ${menu.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {menu.restaurants?.name || 'Unknown Restaurant'}
                            </div>
                            {menu.restaurants?.address && (
                              <div className="text-xs text-muted-foreground">
                                {menu.restaurants.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            v{menu.version || '1.0'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPlatformBadge(menu.platforms?.name)}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {menu.menu_data?.menuItems?.length || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(menu.is_active)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(menu.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(menu.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(menu.id, menu.is_active)}
                            className={menu.is_active 
                              ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}
                            title={menu.is_active ? "Deactivate menu" : "Activate menu"}
                          >
                            {menu.is_active ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewMenu(menu.id)}
                            className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                            title="View menu details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditMenu(menu.id)}
                            className="text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
                            title="Edit menu"
                          >
                            <Edit className="h-4 w-4" />
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
              <FileText className="h-6 w-6 text-brand-blue" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Total Menus</p>
              <p className="text-2xl font-semibold text-foreground">{menus.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-brand-green" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Active Menus</p>
              <p className="text-2xl font-semibold text-foreground">
                {menus.filter(m => m.is_active).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Database className="h-6 w-6 text-brand-orange" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Total Items</p>
              <p className="text-2xl font-semibold text-foreground">
                {menus.reduce((sum, m) => sum + (m.menu_data?.menuItems?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-brand-red" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Latest Update</p>
              <p className="text-sm font-semibold text-foreground">
                {menus.length > 0 
                  ? formatDate(Math.max(...menus.map(m => new Date(m.updated_at))))
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Move Menus Dialog */}
      <MoveMenusDialog
        isOpen={isMoveDialogOpen}
        onClose={() => setIsMoveDialogOpen(false)}
        selectedMenus={selectedMenus}
        onSuccess={handleMoveSuccess}
      />
    </div>
  );
}
