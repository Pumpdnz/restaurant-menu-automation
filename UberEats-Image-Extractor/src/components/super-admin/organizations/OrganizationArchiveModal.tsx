import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertTriangle, Archive, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface OrganizationArchiveModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization: any;
}

export function OrganizationArchiveModal({ open, onClose, onSuccess, organization }: OrganizationArchiveModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && organization) {
      loadStats();
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

  const handleArchive = async () => {
    setLoading(true);

    try {
      // Get current user ID for audit
      const { data: { user } } = await supabase.auth.getUser();

      // Archive the organization
      const { error } = await supabase
        .from('organisations')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: user?.id
        })
        .eq('id', organization.id);

      if (error) throw error;

      // Log the action
      await supabase.from('usage_events').insert({
        organisation_id: organization.id,
        event_type: 'organization_archived',
        metadata: { archived_by: user?.email }
      });

      toast({
        title: 'Organization archived',
        description: `${organization.name} has been archived. All data is preserved and can be restored.`
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error archiving organization:', err);
      toast({
        title: 'Archive failed',
        description: err.message || 'Failed to archive organization',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Archive className="h-5 w-5 text-orange-500" />
            <DialogTitle>Archive Organization</DialogTitle>
          </div>
          <DialogDescription>
            Archive "{organization?.name}" and remove user access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm">
              Archiving will:
              <ul className="mt-2 space-y-1">
                <li>• Remove access for all users</li>
                <li>• Preserve all data (can be restored)</li>
                <li>• Stop billing for this organization</li>
                <li>• Allow restoration at any time</li>
              </ul>
            </AlertDescription>
          </Alert>

          {stats && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <p className="text-sm font-medium text-gray-700">Data to be preserved:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>• {stats.restaurants_count} restaurants</div>
                <div>• {stats.menus_count} menus</div>
                <div>• {stats.menu_items_count} menu items</div>
                <div>• {stats.extractions_count} extractions</div>
                <div>• {stats.option_sets_count} option sets</div>
                <div>• {parseFloat(stats.total_storage_mb).toFixed(2)} MB storage</div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600">
            This action is reversible. You can restore the organization from the archived organizations list.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleArchive} 
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archive Organization
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}