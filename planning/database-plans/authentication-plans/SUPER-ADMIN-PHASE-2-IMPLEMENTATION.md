# Super Admin Dashboard - Phase 2 Implementation Plan
## Organization Management Features

## Overview
Phase 2 implements complete organization management functionality including creation, editing, archiving, deletion, and data reassignment capabilities.

## Timeline
**Duration**: 2 Days (16-20 hours)
**Dependencies**: Phase 1 must be completed
**Deliverables**: Full CRUD operations for organizations with feature flags, billing rates, and data management tools

## Architecture Overview

### Component Structure
```
/src/components/super-admin/organizations/
├── OrganizationCreateModal.tsx       // Create new organization
├── OrganizationEditModal.tsx         // Edit existing organization
├── OrganizationArchiveModal.tsx      // Archive confirmation
├── OrganizationDeleteModal.tsx       // Hard delete confirmation
├── OrganizationDataModal.tsx         // Data reassignment/duplication
├── OrganizationCard.tsx              // Organization display card
├── FeatureFlagsEditor.tsx           // Feature flags configuration
└── BillingRatesEditor.tsx           // Billing rates configuration
```

## Task Breakdown

### Task 1: Database Schema Enhancements (1 hour)

#### 1.1 Add Data Reassignment Functions
```sql
-- Migration: create_data_reassignment_functions

-- Function to reassign a restaurant and all related data to a new organization
CREATE OR REPLACE FUNCTION reassign_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Update restaurant
  UPDATE restaurants 
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE id = p_restaurant_id;
  
  -- Update related menus
  UPDATE menus 
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  
  -- Update related extraction jobs
  UPDATE extraction_jobs
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  
  -- Update menu items through menus
  UPDATE menu_items mi
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE mi.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  
  -- Update categories through menus
  UPDATE categories c
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE c.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  
  -- Log the reassignment
  INSERT INTO usage_events (
    organisation_id,
    event_type,
    event_subtype,
    metadata
  ) VALUES (
    p_target_org_id,
    'data_reassignment',
    'restaurant',
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'source_org_id', (SELECT organisation_id FROM restaurants WHERE id = p_restaurant_id),
      'target_org_id', p_target_org_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to duplicate a restaurant to another organization
CREATE OR REPLACE FUNCTION duplicate_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS UUID AS $$
DECLARE
  v_new_restaurant_id UUID;
  v_menu_mapping JSONB := '{}';
  v_old_menu_id UUID;
  v_new_menu_id UUID;
BEGIN
  -- Create new restaurant in target org
  INSERT INTO restaurants (
    name,
    platform,
    url,
    location,
    cuisine_type,
    price_range,
    rating,
    review_count,
    image_url,
    phone,
    address,
    hours,
    metadata,
    organisation_id
  )
  SELECT 
    name || ' (Copy)',
    platform,
    url,
    location,
    cuisine_type,
    price_range,
    rating,
    review_count,
    image_url,
    phone,
    address,
    hours,
    metadata,
    p_target_org_id
  FROM restaurants
  WHERE id = p_restaurant_id
  RETURNING id INTO v_new_restaurant_id;
  
  -- Duplicate menus
  FOR v_old_menu_id IN
    SELECT id FROM menus WHERE restaurant_id = p_restaurant_id
  LOOP
    INSERT INTO menus (
      restaurant_id,
      name,
      description,
      currency,
      language,
      organisation_id
    )
    SELECT
      v_new_restaurant_id,
      name,
      description,
      currency,
      language,
      p_target_org_id
    FROM menus
    WHERE id = v_old_menu_id
    RETURNING id INTO v_new_menu_id;
    
    -- Store menu mapping for items
    v_menu_mapping := v_menu_mapping || jsonb_build_object(v_old_menu_id::text, v_new_menu_id);
    
    -- Duplicate menu items
    INSERT INTO menu_items (
      menu_id,
      name,
      description,
      price,
      image_url,
      category_id,
      metadata,
      organisation_id
    )
    SELECT
      v_new_menu_id,
      name,
      description,
      price,
      image_url,
      category_id,
      metadata,
      p_target_org_id
    FROM menu_items
    WHERE menu_id = v_old_menu_id;
  END LOOP;
  
  RETURN v_new_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get organization data statistics
CREATE OR REPLACE FUNCTION get_organization_data_stats(p_org_id UUID)
RETURNS TABLE (
  restaurants_count BIGINT,
  menus_count BIGINT,
  menu_items_count BIGINT,
  extractions_count BIGINT,
  option_sets_count BIGINT,
  total_storage_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM restaurants WHERE organisation_id = p_org_id)::BIGINT,
    (SELECT COUNT(*) FROM menus WHERE organisation_id = p_org_id)::BIGINT,
    (SELECT COUNT(*) FROM menu_items WHERE organisation_id = p_org_id)::BIGINT,
    (SELECT COUNT(*) FROM extraction_jobs WHERE organisation_id = p_org_id)::BIGINT,
    (SELECT COUNT(*) FROM option_sets WHERE organisation_id = p_org_id)::BIGINT,
    COALESCE((
      SELECT SUM(pg_column_size(metadata))::NUMERIC / 1048576
      FROM extraction_jobs 
      WHERE organisation_id = p_org_id
    ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 1.2 Add Organization Validation
```sql
-- Migration: add_organization_constraints

-- Add check constraint for billing rates
ALTER TABLE organisations 
ADD CONSTRAINT check_billing_rates_positive 
CHECK (
  (billing_rates IS NULL) OR 
  (NOT EXISTS (
    SELECT * FROM jsonb_each_text(billing_rates) 
    WHERE value::numeric < 0
  ))
);

-- Add unique constraint for organization names
ALTER TABLE organisations
ADD CONSTRAINT unique_org_name_when_active
EXCLUDE (name WITH =) WHERE (status = 'active');
```

### Task 2: Create Organization Feature (3 hours)

#### 2.1 Create Organization Modal Component
**File**: `/src/components/super-admin/organizations/OrganizationCreateModal.tsx`
```typescript
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { FeatureFlagsEditor } from './FeatureFlagsEditor';
import { BillingRatesEditor } from './BillingRatesEditor';
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

      // Create admin user invitation
      if (formData.sendInvite) {
        const { error: inviteError } = await supabase.functions.invoke('send-invitation', {
          body: {
            email: formData.adminEmail,
            inviterName: 'Super Admin',
            organizationName: formData.name,
            role: 'Admin',
            inviteUrl: `${window.location.origin}/invite/${generateInviteToken()}`
          }
        });

        if (inviteError) {
          console.error('Failed to send invitation:', inviteError);
        }
      }

      // Create initial admin user profile
      const { error: userError } = await supabase
        .from('profiles')
        .insert({
          email: formData.adminEmail,
          name: formData.adminName,
          role: 'admin',
          organisation_id: org.id
        });

      if (userError && userError.code !== '23505') { // Ignore duplicate key error
        console.error('Failed to create user profile:', userError);
      }

      toast({
        title: 'Organization created',
        description: `${formData.name} has been created successfully${formData.sendInvite ? ' and invitation sent' : ''}.`
      });

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
```

#### 2.2 Feature Flags Editor Component
**File**: `/src/components/super-admin/organizations/FeatureFlagsEditor.tsx`
```typescript
import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Card } from '../../ui/card';

interface FeatureFlag {
  enabled: boolean;
  ratePerItem: number;
}

interface FeatureFlagsEditorProps {
  featureFlags: Record<string, FeatureFlag>;
  onChange: (flags: Record<string, FeatureFlag>) => void;
  disabled?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  standardExtraction: 'Standard Extraction',
  premiumExtraction: 'Premium Extraction',
  logoExtraction: 'Logo Extraction',
  logoProcessing: 'Logo Processing',
  googleSearchExtraction: 'Google Search',
  platformDetailsExtraction: 'Platform Details',
  csvDownload: 'CSV Download',
  csvWithImagesDownload: 'CSV with Images',
  imageUploadToCDN: 'Image Upload to CDN',
  imageZipDownload: 'Image ZIP Download'
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  standardExtraction: 'Basic menu extraction from delivery platforms',
  premiumExtraction: 'Advanced extraction with option sets and modifiers',
  logoExtraction: 'Restaurant logo extraction from platforms',
  logoProcessing: 'Logo background removal and processing',
  googleSearchExtraction: 'Google business information search',
  platformDetailsExtraction: 'Platform-specific restaurant details',
  csvDownload: 'Export menus as CSV files',
  csvWithImagesDownload: 'Export menus as CSV with image URLs',
  imageUploadToCDN: 'Upload menu images to CDN',
  imageZipDownload: 'Download images as ZIP archive'
};

export function FeatureFlagsEditor({ featureFlags, onChange, disabled }: FeatureFlagsEditorProps) {
  const handleToggle = (feature: string) => {
    onChange({
      ...featureFlags,
      [feature]: {
        ...featureFlags[feature],
        enabled: !featureFlags[feature].enabled
      }
    });
  };

  const handleRateChange = (feature: string, rate: string) => {
    const numRate = parseFloat(rate) || 0;
    onChange({
      ...featureFlags,
      [feature]: {
        ...featureFlags[feature],
        ratePerItem: numRate
      }
    });
  };

  return (
    <div className="space-y-3">
      {Object.entries(featureFlags).map(([feature, config]) => (
        <Card key={feature} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={() => handleToggle(feature)}
                  disabled={disabled}
                />
                <Label className="font-medium">
                  {FEATURE_LABELS[feature] || feature}
                </Label>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-9">
                {FEATURE_DESCRIPTIONS[feature]}
              </p>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <Label className="text-sm text-gray-600">Rate: $</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={config.ratePerItem}
                onChange={(e) => handleRateChange(feature, e.target.value)}
                disabled={disabled || !config.enabled}
                className="w-24"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### Task 3: Edit Organization Feature (2 hours)

#### 3.1 Edit Organization Modal
**File**: `/src/components/super-admin/organizations/OrganizationEditModal.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Loader2, AlertCircle, Users, Settings, Activity } from 'lucide-react';
import { FeatureFlagsEditor } from './FeatureFlagsEditor';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface OrganizationEditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

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
          billing_rates: Object.entries(organization.feature_flags).reduce((acc, [key, value]: [string, any]) => ({
            ...acc,
            [key]: value.ratePerItem
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Details
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
```

### Task 4: Archive & Delete Features (3 hours)

#### 4.1 Archive Organization Modal
**File**: `/src/components/super-admin/organizations/OrganizationArchiveModal.tsx`
```typescript
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
```

#### 4.2 Delete Organization Modal (Hard Delete)
**File**: `/src/components/super-admin/organizations/OrganizationDeleteModal.tsx`
```typescript
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
```

### Task 5: Data Management Tools (3 hours)

#### 5.1 Data Reassignment Modal
**File**: `/src/components/super-admin/organizations/OrganizationDataModal.tsx`
```typescript
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
  platform: string;
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
          platform,
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
                        {restaurant.platform} • {restaurant.menu_count} menu(s)
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
```

### Task 6: Update Main Organizations Component (2 hours)

#### 6.1 Enhanced Organizations List
**File**: `/src/components/super-admin/SuperAdminOrganizations.tsx` (Update)
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Search, Edit, Archive, Trash2, Database, RefreshCw, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { OrganizationCreateModal } from './organizations/OrganizationCreateModal';
import { OrganizationEditModal } from './organizations/OrganizationEditModal';
import { OrganizationArchiveModal } from './organizations/OrganizationArchiveModal';
import { OrganizationDeleteModal } from './organizations/OrganizationDeleteModal';
import { OrganizationDataModal } from './organizations/OrganizationDataModal';

interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
  archived_at?: string;
  member_count?: number;
  extraction_count?: number;
}

export function SuperAdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Query organizations with counts
      const { data, error } = await supabase
        .from('organisations')
        .select(`
          *,
          profiles(count),
          extraction_jobs(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orgs = data?.map(org => ({
        ...org,
        member_count: org.profiles?.[0]?.count || 0,
        extraction_count: org.extraction_jobs?.[0]?.count || 0
      })) || [];

      setOrganizations(orgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = (action: string, org: Organization) => {
    setSelectedOrg(org);
    switch (action) {
      case 'edit':
        setEditModalOpen(true);
        break;
      case 'archive':
        setArchiveModalOpen(true);
        break;
      case 'restore':
        handleRestore(org);
        break;
      case 'delete':
        setDeleteModalOpen(true);
        break;
      case 'data':
        setDataModalOpen(true);
        break;
    }
  };

  const handleRestore = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organisations')
        .update({
          status: 'active',
          archived_at: null,
          archived_by: null
        })
        .eq('id', org.id);

      if (error) throw error;
      
      await loadOrganizations();
    } catch (error) {
      console.error('Error restoring organization:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-gray-500">Manage all organizations in the system</p>
        </div>
        <Button 
          onClick={() => setCreateModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button 
          variant="outline" 
          size="icon"
          onClick={loadOrganizations}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Organizations List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <CardDescription>
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAction('edit', org)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      
                      {org.status === 'active' ? (
                        <DropdownMenuItem onClick={() => handleAction('archive', org)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => handleAction('restore', org)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleAction('delete', org)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Permanently
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleAction('data', org)}>
                        <Database className="h-4 w-4 mr-2" />
                        Manage Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {org.member_count} members
                    </span>
                    <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                      {org.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {org.extraction_count} extractions
                  </div>
                  {org.archived_at && (
                    <div className="text-xs text-gray-400">
                      Archived {new Date(org.archived_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredOrgs.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No organizations found
        </div>
      )}

      {/* Modals */}
      <OrganizationCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={loadOrganizations}
      />

      {selectedOrg && (
        <>
          <OrganizationEditModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSuccess={loadOrganizations}
            organizationId={selectedOrg.id}
          />

          <OrganizationArchiveModal
            open={archiveModalOpen}
            onClose={() => setArchiveModalOpen(false)}
            onSuccess={loadOrganizations}
            organization={selectedOrg}
          />

          <OrganizationDeleteModal
            open={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onSuccess={loadOrganizations}
            organization={selectedOrg}
          />

          <OrganizationDataModal
            open={dataModalOpen}
            onClose={() => setDataModalOpen(false)}
            onSuccess={loadOrganizations}
            sourceOrgId={selectedOrg.id}
            sourceOrgName={selectedOrg.name}
          />
        </>
      )}
    </div>
  );
}
```

## Testing Checklist

### Organization Creation
- [ ] Can create organization with name
- [ ] Feature flags are configurable
- [ ] Billing rates can be set per feature
- [ ] Admin user is created
- [ ] Invitation email is sent (if enabled)
- [ ] Organization appears in list

### Organization Editing
- [ ] Can modify organization name
- [ ] Can toggle feature flags
- [ ] Can update billing rates
- [ ] Changes persist after save
- [ ] Archived orgs cannot be edited

### Archive & Restore
- [ ] Active orgs can be archived
- [ ] Archived orgs show different status
- [ ] Users lose access to archived orgs
- [ ] Data is preserved when archived
- [ ] Archived orgs can be restored
- [ ] Restored orgs regain active status

### Delete (Hard Delete)
- [ ] Only archived orgs can be deleted
- [ ] Confirmation requires typing org name
- [ ] Shows data impact before deletion
- [ ] All related data is deleted (CASCADE)
- [ ] Cannot be undone

### Data Management
- [ ] Can select restaurants to reassign
- [ ] Can select target organization
- [ ] Reassignment moves data correctly
- [ ] Duplication creates copies
- [ ] Original data unchanged in duplication
- [ ] Success feedback shows

## API Endpoints Summary

```javascript
// Organizations
POST   /api/super-admin/organizations
GET    /api/super-admin/organizations
GET    /api/super-admin/organizations/:id
PUT    /api/super-admin/organizations/:id
POST   /api/super-admin/organizations/:id/archive
POST   /api/super-admin/organizations/:id/restore
DELETE /api/super-admin/organizations/:id
POST   /api/super-admin/organizations/reassign-data
POST   /api/super-admin/organizations/duplicate-data
```

## Success Criteria

Phase 2 is complete when:
1. ✅ Organizations can be created with custom features/billing
2. ✅ Organizations can be edited (name, features, rates)
3. ✅ Organizations can be archived (soft delete)
4. ✅ Archived organizations can be restored
5. ✅ Archived organizations can be permanently deleted
6. ✅ Data can be reassigned between organizations
7. ✅ Data can be duplicated to other organizations
8. ✅ All modals work correctly
9. ✅ Error handling is in place
10. ✅ Success feedback is provided

---

**Duration**: 2 Days
**Dependencies**: Phase 1 Complete
**Next Phase**: User Management (Phase 3)