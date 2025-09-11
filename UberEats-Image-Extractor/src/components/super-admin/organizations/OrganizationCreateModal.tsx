import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { FeatureFlagsEditor } from './FeatureFlagsEditor';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface OrganizationCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FeatureFlag {
  enabled: boolean;
  ratePerItem: number;
}

interface FeatureFlags {
  standardExtraction: FeatureFlag;
  premiumExtraction: FeatureFlag;
  logoExtraction: FeatureFlag;
  logoProcessing: FeatureFlag;
  googleSearchExtraction: FeatureFlag;
  platformDetailsExtraction: FeatureFlag;
  csvDownload: FeatureFlag;
  csvWithImagesDownload: FeatureFlag;
  imageUploadToCDN: FeatureFlag;
  imageZipDownload: FeatureFlag;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  standardExtraction: { enabled: true, ratePerItem: 0.10 },
  premiumExtraction: { enabled: true, ratePerItem: 0.25 },
  logoExtraction: { enabled: true, ratePerItem: 0.15 },
  logoProcessing: { enabled: true, ratePerItem: 0.20 },
  googleSearchExtraction: { enabled: true, ratePerItem: 0.05 },
  platformDetailsExtraction: { enabled: true, ratePerItem: 0.05 },
  csvDownload: { enabled: true, ratePerItem: 0.01 },
  csvWithImagesDownload: { enabled: true, ratePerItem: 0.02 },
  imageUploadToCDN: { enabled: true, ratePerItem: 0.001 },
  imageZipDownload: { enabled: true, ratePerItem: 0.05 }
};

export function OrganizationCreateModal({ open, onClose, onSuccess }: OrganizationCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    adminEmail: '',
    adminName: '',
    sendInvite: true
  });
  
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);

  const handleCreate = async () => {
    if (!formData.name || !formData.adminEmail || !formData.adminName) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: formData.name,
          feature_flags: featureFlags,
          billing_rates: Object.entries(featureFlags).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: value.ratePerItem
          }), {}),
          status: 'active'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Check if user already exists (use maybeSingle to avoid 406 error)
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', formData.adminEmail);

      if (checkError) {
        console.error('Error checking user:', checkError);
      }

      const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

      let invitationSent = false;
      let userHandled = false;

      if (existingUser) {
        // User exists - reassign them to the new organization
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            organisation_id: org.id,
            role: 'admin',
            name: formData.adminName || existingUser.name
          })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('Failed to reassign user:', updateError);
          setError(`User exists but couldn't be reassigned: ${updateError.message}`);
        } else {
          userHandled = true;
          toast({
            title: 'Organization created',
            description: `${formData.name} created and ${formData.adminEmail} reassigned as admin.`
          });
        }
      } else {
        // User doesn't exist - create invitation
        if (formData.sendInvite) {
          // Generate a proper invitation token and store it
          const inviteToken = generateInviteToken();
          
          // Store the invitation in the database
          const { error: inviteDbError } = await supabase
            .from('organisation_invites')
            .insert({
              organisation_id: org.id,
              email: formData.adminEmail,
              role: 'admin',
              token: inviteToken,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });

          if (inviteDbError) {
            console.error('Failed to store invitation:', inviteDbError);
          }

          // Send the invitation email
          const { error: inviteError } = await supabase.functions.invoke('send-invitation', {
            body: {
              email: formData.adminEmail,
              inviterName: 'Super Admin',
              organizationName: formData.name,
              role: 'Admin',
              inviteUrl: `${window.location.origin}/invite/${inviteToken}`
            }
          });

          if (inviteError) {
            console.error('Failed to send invitation email:', inviteError);
            toast({
              title: 'Organization created',
              description: `${formData.name} created but invitation email failed. User can still be invited manually.`,
              variant: 'default'
            });
          } else {
            invitationSent = true;
            toast({
              title: 'Organization created',
              description: `${formData.name} created and invitation sent to ${formData.adminEmail}.`
            });
          }
        } else {
          // Not sending invite but user doesn't exist
          toast({
            title: 'Organization created',
            description: `${formData.name} created. Admin user needs to be invited manually.`,
            variant: 'default'
          });
        }
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error creating organization:', err);
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      adminEmail: '',
      adminName: '',
      sendInvite: true
    });
    setFeatureFlags(DEFAULT_FEATURE_FLAGS);
    setError(null);
  };

  const generateInviteToken = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Set up a new organization with custom features and billing rates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Organization Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Organization Details</h3>
            
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter organization name"
                disabled={loading}
              />
            </div>
          </div>

          {/* Initial Admin User */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Initial Admin User</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Admin Name *</Label>
                <Input
                  id="admin-name"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="John Doe"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="admin@example.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="send-invite"
                checked={formData.sendInvite}
                onChange={(e) => setFormData({ ...formData, sendInvite: e.target.checked })}
                disabled={loading}
                className="rounded border-gray-300"
              />
              <Label htmlFor="send-invite" className="text-sm">
                Send invitation email to admin
              </Label>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Feature Configuration</h3>
            <FeatureFlagsEditor
              featureFlags={featureFlags}
              onChange={setFeatureFlags}
              disabled={loading}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Organization'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}