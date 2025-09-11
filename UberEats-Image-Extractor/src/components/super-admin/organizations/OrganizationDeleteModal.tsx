import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface OrganizationDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization: any;
}

export function OrganizationDeleteModal({ open, onClose, onSuccess, organization }: OrganizationDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && organization) {
      loadStats();
      setConfirmName('');
    }
  }, [open, organization]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_organization_data_stats', {
        p_org_id: organization.id
      });

      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleDelete = async () => {
    if (confirmName !== organization.name) {
      toast({
        title: 'Confirmation required',
        description: 'Please type the organization name to confirm deletion',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // Permanently delete the organization (CASCADE will handle related data)
      const { error } = await supabase
        .from('organisations')
        .delete()
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: 'Organization deleted',
        description: `${organization.name} and all associated data have been permanently deleted.`
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error deleting organization:', err);
      toast({
        title: 'Deletion failed',
        description: err.message || 'Failed to delete organization',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const canDelete = organization?.status === 'archived';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            <DialogTitle>Permanently Delete Organization</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!canDelete ? (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                Organization must be archived before it can be permanently deleted.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>WARNING: This will permanently delete:</strong>
                  <ul className="mt-2 space-y-1">
                    <li>• The organization record</li>
                    <li>• All user associations</li>
                    <li>• All restaurants and menus</li>
                    <li>• All extraction history</li>
                    <li>• All images and files</li>
                    <li>• All usage data</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {stats && (
                <div className="p-4 bg-red-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-red-700">Data to be PERMANENTLY DELETED:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-red-600">
                    <div>• {stats.restaurants_count} restaurants</div>
                    <div>• {stats.menus_count} menus</div>
                    <div>• {stats.menu_items_count} menu items</div>
                    <div>• {stats.extractions_count} extractions</div>
                    <div>• {stats.option_sets_count} option sets</div>
                    <div>• {parseFloat(stats.total_storage_mb).toFixed(2)} MB storage</div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-name">
                  Type <strong>{organization?.name}</strong> to confirm deletion
                </Label>
                <Input
                  id="confirm-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Enter organization name"
                  disabled={loading}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {canDelete && (
            <Button 
              onClick={handleDelete} 
              disabled={loading || confirmName !== organization?.name}
              variant="destructive"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}