import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Loader2, MoveRight, Copy, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface OrganizationDataModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceOrgId: string;
  sourceOrgName: string;
}

interface Restaurant {
  id: string;
  name: string;
  menu_count?: number;
}

export function OrganizationDataModal({ 
  open, 
  onClose, 
  onSuccess, 
  sourceOrgId, 
  sourceOrgName 
}: OrganizationDataModalProps) {
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<'reassign' | 'duplicate'>('reassign');
  const [targetOrgId, setTargetOrgId] = useState<string>('');
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadRestaurants();
      loadOrganizations();
    }
  }, [open, sourceOrgId]);

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select(`
          id,
          name,
          menus(count)
        `)
        .eq('organisation_id', sourceOrgId);

      if (error) throw error;

      const restaurantsWithCount = data?.map(r => ({
        ...r,
        menu_count: r.menus?.[0]?.count || 0
      })) || [];

      setRestaurants(restaurantsWithCount);
    } catch (err) {
      console.error('Error loading restaurants:', err);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name')
        .neq('id', sourceOrgId)
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      console.error('Error loading organizations:', err);
    }
  };

  const handleOperation = async () => {
    if (!targetOrgId || selectedRestaurants.length === 0) {
      toast({
        title: 'Selection required',
        description: 'Please select target organization and restaurants',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      for (const restaurantId of selectedRestaurants) {
        if (operation === 'reassign') {
          const { error } = await supabase.rpc('reassign_restaurant_to_org', {
            p_restaurant_id: restaurantId,
            p_target_org_id: targetOrgId
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.rpc('duplicate_restaurant_to_org', {
            p_restaurant_id: restaurantId,
            p_target_org_id: targetOrgId
          });
          if (error) throw error;
        }
      }

      const targetOrg = organizations.find(o => o.id === targetOrgId);
      toast({
        title: `Data ${operation === 'reassign' ? 'reassigned' : 'duplicated'}`,
        description: `${selectedRestaurants.length} restaurant(s) ${operation === 'reassign' ? 'moved' : 'copied'} to ${targetOrg?.name}`
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error(`Error ${operation}ing data:`, err);
      toast({
        title: `${operation === 'reassign' ? 'Reassignment' : 'Duplication'} failed`,
        description: err.message || `Failed to ${operation} data`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedRestaurants([]);
    setTargetOrgId('');
    setOperation('reassign');
  };

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants(prev => 
      prev.includes(id) 
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedRestaurants(restaurants.map(r => r.id));
  };

  const deselectAll = () => {
    setSelectedRestaurants([]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Data Management</DialogTitle>
          <DialogDescription>
            Reassign or duplicate data from {sourceOrgName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={operation} onValueChange={(v) => setOperation(v as 'reassign' | 'duplicate')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reassign" className="flex items-center gap-2">
              <MoveRight className="h-4 w-4" />
              Reassign Data
            </TabsTrigger>
            <TabsTrigger value="duplicate" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Duplicate Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reassign" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Reassigning will move the selected restaurants and all related data 
                (menus, items, extractions) to the target organization.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="duplicate" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Duplicating will create copies of the selected restaurants and all related data 
                in the target organization. Original data remains unchanged.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="space-y-4 mt-4">
          {/* Target Organization */}
          <div className="space-y-2">
            <Label>Target Organization</Label>
            <Select value={targetOrgId} onValueChange={setTargetOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Restaurant Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Restaurants</Label>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedRestaurants.includes(restaurant.id)}
                      onChange={() => toggleRestaurant(restaurant.id)}
                      className="rounded border-gray-300"
                    />
                    <div>
                      <p className="font-medium">{restaurant.name}</p>
                      <p className="text-sm text-gray-500">
                        {restaurant.menu_count} menu(s)
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {restaurants.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No restaurants in this organization
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          {selectedRestaurants.length > 0 && targetOrgId && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription>
                <strong>{selectedRestaurants.length} restaurant(s)</strong> will be{' '}
                <strong>{operation === 'reassign' ? 'moved' : 'copied'}</strong> to{' '}
                <strong>{organizations.find(o => o.id === targetOrgId)?.name}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleOperation} 
            disabled={loading || !targetOrgId || selectedRestaurants.length === 0}
            className={operation === 'reassign' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {operation === 'reassign' ? (
                  <>
                    <MoveRight className="mr-2 h-4 w-4" />
                    Reassign Selected
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate Selected
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}