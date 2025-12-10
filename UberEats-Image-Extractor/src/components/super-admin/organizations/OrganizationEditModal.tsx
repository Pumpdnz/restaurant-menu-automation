import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Loader2, AlertCircle, Users, Settings, Activity, Key } from 'lucide-react';
import { FeatureFlagsEditor } from './FeatureFlagsEditor';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface OrganizationEditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

// Timezone options grouped by country
const TIMEZONE_OPTIONS: Record<string, Array<{iana: string, display: string, city: string}>> = {
  NZ: [
    { iana: 'Pacific/Auckland', display: 'Auckland (NZST/NZDT)', city: 'Auckland' },
    { iana: 'Pacific/Chatham', display: 'Chatham Islands', city: 'Chatham' }
  ],
  AU: [
    { iana: 'Australia/Sydney', display: 'Sydney (AEST/AEDT)', city: 'Sydney' },
    { iana: 'Australia/Melbourne', display: 'Melbourne (AEST/AEDT)', city: 'Melbourne' },
    { iana: 'Australia/Brisbane', display: 'Brisbane (AEST)', city: 'Brisbane' },
    { iana: 'Australia/Perth', display: 'Perth (AWST)', city: 'Perth' },
    { iana: 'Australia/Adelaide', display: 'Adelaide (ACST/ACDT)', city: 'Adelaide' },
    { iana: 'Australia/Darwin', display: 'Darwin (ACST)', city: 'Darwin' },
    { iana: 'Australia/Hobart', display: 'Hobart (AEST/AEDT)', city: 'Hobart' }
  ],
  US: [
    { iana: 'America/New_York', display: 'Eastern Time (ET)', city: 'New York' },
    { iana: 'America/Chicago', display: 'Central Time (CT)', city: 'Chicago' },
    { iana: 'America/Denver', display: 'Mountain Time (MT)', city: 'Denver' },
    { iana: 'America/Los_Angeles', display: 'Pacific Time (PT)', city: 'Los Angeles' },
    { iana: 'America/Phoenix', display: 'Arizona (MST)', city: 'Phoenix' },
    { iana: 'America/Anchorage', display: 'Alaska Time (AKT)', city: 'Anchorage' },
    { iana: 'Pacific/Honolulu', display: 'Hawaii Time (HST)', city: 'Honolulu' }
  ],
  GB: [
    { iana: 'Europe/London', display: 'London (GMT/BST)', city: 'London' }
  ],
  CA: [
    { iana: 'America/Toronto', display: 'Eastern Time (ET)', city: 'Toronto' },
    { iana: 'America/Winnipeg', display: 'Central Time (CT)', city: 'Winnipeg' },
    { iana: 'America/Edmonton', display: 'Mountain Time (MT)', city: 'Edmonton' },
    { iana: 'America/Vancouver', display: 'Pacific Time (PT)', city: 'Vancouver' },
    { iana: 'America/Halifax', display: 'Atlantic Time (AT)', city: 'Halifax' },
    { iana: 'America/St_Johns', display: 'Newfoundland (NT)', city: "St. John's" }
  ]
};

export function OrganizationEditModal({ open, onClose, onSuccess, organizationId }: OrganizationEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const { toast } = useToast();
  
  const [organization, setOrganization] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (open && organizationId) {
      loadOrganization();
      loadMembers();
      loadStats();
    }
  }, [open, organizationId]);

  const loadOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) throw error;
      setOrganization(data);
    } catch (err: any) {
      console.error('Error loading organization:', err);
      setError('Failed to load organization');
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organisation_id', organizationId);

      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error('Error loading members:', err);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_organization_data_stats', {
        p_org_id: organizationId
      });

      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (err: any) {
      console.error('Error loading stats:', err);
    }
  };

  const handleUpdate = async () => {
    if (!organization) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('organisations')
        .update({
          name: organization.name,
          feature_flags: organization.feature_flags,
          settings: organization.settings,
          billing_rates: Object.entries(organization.feature_flags || {}).reduce((acc, [key, value]: [string, any]) => ({
            ...acc,
            [key]: value?.ratePerItem
          }), {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (updateError) throw updateError;

      toast({
        title: 'Organization updated',
        description: 'Changes have been saved successfully.'
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error updating organization:', err);
      setError(err.message || 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  if (!organization) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Modify organization settings, features, and billing rates
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Usage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={organization.name}
                onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* System-wide Country */}
            <div className="space-y-2">
              <Label htmlFor="system-country">Country</Label>
              <Select
                value={organization.settings?.country || 'NZ'}
                onValueChange={(value) => setOrganization({
                  ...organization,
                  settings: {
                    ...organization.settings,
                    country: value
                  }
                })}
                disabled={loading || organization.status === 'archived'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NZ">New Zealand</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                System-wide country setting for searches and default configurations
              </p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  organization.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {organization.status}
                </span>
                {organization.archived_at && (
                  <span className="text-sm text-gray-500">
                    Archived on {new Date(organization.archived_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Feature Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Feature Configuration</h3>
              <FeatureFlagsEditor
                featureFlags={organization.feature_flags || {}}
                onChange={(flags) => setOrganization({ ...organization, feature_flags: flags })}
                disabled={loading || organization.status === 'archived'}
              />
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">CloudWaitress API</h3>
                <p className="text-sm text-gray-500">
                  Configure CloudWaitress integrator credentials for this organization's restaurant registrations
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cw-integrator-id">Integrator ID</Label>
                  <Input
                    id="cw-integrator-id"
                    placeholder="CWI_xxxx-xxxx-xxxx-xxxx"
                    value={organization.settings?.cloudwaitress?.integrator_id || ''}
                    onChange={(e) => setOrganization({
                      ...organization,
                      settings: {
                        ...organization.settings,
                        cloudwaitress: {
                          ...organization.settings?.cloudwaitress,
                          integrator_id: e.target.value || null
                        }
                      }
                    })}
                    disabled={loading || organization.status === 'archived'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cw-secret">Secret</Label>
                  <Input
                    id="cw-secret"
                    placeholder="CWS_xxxx-xxxx-xxxx-xxxx"
                    value={organization.settings?.cloudwaitress?.secret || ''}
                    onChange={(e) => setOrganization({
                      ...organization,
                      settings: {
                        ...organization.settings,
                        cloudwaitress: {
                          ...organization.settings?.cloudwaitress,
                          secret: e.target.value || null
                        }
                      }
                    })}
                    disabled={loading || organization.status === 'archived'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cw-api-url">API URL (optional)</Label>
                  <Input
                    id="cw-api-url"
                    placeholder="https://api.cloudwaitress.com"
                    value={organization.settings?.cloudwaitress?.api_url || ''}
                    onChange={(e) => setOrganization({
                      ...organization,
                      settings: {
                        ...organization.settings,
                        cloudwaitress: {
                          ...organization.settings?.cloudwaitress,
                          api_url: e.target.value || null
                        }
                      }
                    })}
                    disabled={loading || organization.status === 'archived'}
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to use default: https://api.cloudwaitress.com
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cw-admin-url">Admin Portal URL</Label>
                  <Input
                    id="cw-admin-url"
                    placeholder="https://admin.pumpd.co.nz"
                    value={organization.settings?.cloudwaitress?.admin_url || ''}
                    onChange={(e) => setOrganization({
                      ...organization,
                      settings: {
                        ...organization.settings,
                        cloudwaitress: {
                          ...organization.settings?.cloudwaitress,
                          admin_url: e.target.value || null
                        }
                      }
                    })}
                    disabled={loading || organization.status === 'archived'}
                  />
                  <p className="text-xs text-gray-500">
                    The whitelabel CloudWaitress admin portal URL for this organization
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cw-country">Country</Label>
                  <Select
                    value={organization.settings?.cloudwaitress?.country || 'NZ'}
                    onValueChange={(value) => setOrganization({
                      ...organization,
                      settings: {
                        ...organization.settings,
                        cloudwaitress: {
                          ...organization.settings?.cloudwaitress,
                          country: value,
                          timezone: null // Reset timezone when country changes
                        }
                      }
                    })}
                    disabled={loading || organization.status === 'archived'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NZ">New Zealand</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Country settings for timezone, currency, and tax configuration
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cw-timezone">Timezone</Label>
                  <Select
                    value={organization.settings?.cloudwaitress?.timezone || '_default'}
                    onValueChange={(value) => setOrganization({
                      ...organization,
                      settings: {
                        ...organization.settings,
                        cloudwaitress: {
                          ...organization.settings?.cloudwaitress,
                          timezone: value === '_default' ? null : value
                        }
                      }
                    })}
                    disabled={loading || organization.status === 'archived'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Use country default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_default">Use country default</SelectItem>
                      {(TIMEZONE_OPTIONS[organization.settings?.cloudwaitress?.country || 'NZ'] || TIMEZONE_OPTIONS.NZ).map((tz) => (
                        <SelectItem key={tz.iana} value={tz.city}>
                          {tz.display}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Override the default timezone for restaurant registration
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Leave fields empty to use system default credentials. Custom credentials allow independent billing and tracking for this organization.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <div className="space-y-4">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    member.role === 'admin' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {member.role}
                  </span>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-center text-gray-500 py-8">No members in this organization</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="usage" className="mt-6">
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500">Restaurants</p>
                  <p className="text-2xl font-bold">{stats.restaurants_count}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500">Menus</p>
                  <p className="text-2xl font-bold">{stats.menus_count}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500">Menu Items</p>
                  <p className="text-2xl font-bold">{stats.menu_items_count}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500">Extractions</p>
                  <p className="text-2xl font-bold">{stats.extractions_count}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500">Option Sets</p>
                  <p className="text-2xl font-bold">{stats.option_sets_count}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500">Storage</p>
                  <p className="text-2xl font-bold">{parseFloat(stats.total_storage_mb).toFixed(2)} MB</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={loading || organization.status === 'archived'} 
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}