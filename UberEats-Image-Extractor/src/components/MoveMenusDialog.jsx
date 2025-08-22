import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Store, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function MoveMenusDialog({ isOpen, onClose, selectedMenus, onSuccess }) {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingRestaurants, setFetchingRestaurants] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchRestaurants();
      setSelectedRestaurantId('');
      setError(null);
    }
  }, [isOpen]);

  const fetchRestaurants = async () => {
    setFetchingRestaurants(true);
    try {
      const response = await api.get('/restaurants');
      setRestaurants(response.data.restaurants || []);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
      setError('Failed to load restaurants');
    } finally {
      setFetchingRestaurants(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedRestaurantId) {
      setError('Please select a restaurant');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const menuIds = Array.from(selectedMenus).map(menu => menu.id);
      const response = await api.patch('/menus/bulk-reassign', {
        menuIds,
        restaurantId: selectedRestaurantId
      });

      if (response.data.success) {
        onSuccess(response.data);
        onClose();
      } else {
        setError(response.data.error || 'Failed to reassign menus');
      }
    } catch (err) {
      console.error('Failed to reassign menus:', err);
      setError(err.response?.data?.error || 'Failed to reassign menus');
    } finally {
      setLoading(false);
    }
  };

  // Get unique current restaurants from selected menus
  const currentRestaurants = [...new Set(
    Array.from(selectedMenus).map(menu => menu.restaurants?.name).filter(Boolean)
  )];

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Move Menus to Another Restaurant</DialogTitle>
          <DialogDescription>
            Select a restaurant to move the {selectedMenus.size} selected menu{selectedMenus.size > 1 ? 's' : ''} to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current restaurants */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Currently assigned to:
            </p>
            <div className="flex flex-wrap gap-2">
              {currentRestaurants.length > 0 ? (
                currentRestaurants.map((name, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm"
                  >
                    <Store className="h-3 w-3" />
                    {name}
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Unknown restaurants</span>
              )}
            </div>
          </div>

          {/* Restaurant selector */}
          <div>
            <label htmlFor="restaurant" className="text-sm font-medium mb-2 block">
              Move to restaurant:
            </label>
            <Select
              value={selectedRestaurantId}
              onValueChange={setSelectedRestaurantId}
              disabled={fetchingRestaurants || loading}
            >
              <SelectTrigger id="restaurant">
                <SelectValue placeholder={
                  fetchingRestaurants ? "Loading restaurants..." : "Select a restaurant"
                } />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span>{restaurant.name}</span>
                      {restaurant.address && (
                        <span className="text-xs text-muted-foreground">
                          ({restaurant.address})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected restaurant preview */}
          {selectedRestaurant && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                The selected menu{selectedMenus.size > 1 ? 's' : ''} will be moved to{' '}
                <span className="font-semibold">{selectedRestaurant.name}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReassign}
            disabled={loading || !selectedRestaurantId || fetchingRestaurants}
            className="bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            {loading ? 'Moving...' : `Move ${selectedMenus.size} Menu${selectedMenus.size > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}