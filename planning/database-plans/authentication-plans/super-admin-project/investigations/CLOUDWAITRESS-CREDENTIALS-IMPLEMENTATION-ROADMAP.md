# CloudWaitress Credentials Per Organization - Implementation Roadmap

## Overview

This document provides a step-by-step implementation guide for making CloudWaitress API credentials configurable per organization.

**Reference:** [Investigation Document](./CLOUDWAITRESS-API-CREDENTIALS-PER-ORGANIZATION.md)

---

## Phase 1: Backend Service Modifications

### Step 1.1: Update CloudWaitressAPIService

**File:** `UberEats-Image-Extractor/src/services/cloudwaitress-api-service.js`

**Changes:**
```javascript
class CloudWaitressAPIService {
  constructor(options = {}) {
    // Accept credentials from options, fall back to environment variables
    this.baseUrl = options.apiUrl || process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com';
    this.integratorId = options.integratorId || process.env.CLOUDWAITRESS_INTEGRATOR_ID || 'CWI_e2dae966-8523-4fd6-a853-58586a296bff';
    this.secret = options.secret || process.env.CLOUDWAITRESS_SECRET || 'CWS_09908059-7b25-492f-86c9-34c672d689a4';
  }

  // All existing methods remain unchanged
}
```

**Validation:** Service still works with no arguments (backward compatible)

---

### Step 1.2: Create Organization Settings Helper

**File:** `UberEats-Image-Extractor/src/services/organization-settings-service.js` (new file)

```javascript
const { supabase } = require('./database-service');

/**
 * Organization Settings Service
 * Manages organization-specific configuration settings
 */
class OrganizationSettingsService {

  /**
   * Get CloudWaitress API configuration for an organization
   * Falls back to environment variables if not configured
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{integratorId: string, secret: string, apiUrl: string}>}
   */
  static async getCloudWaitressConfig(organisationId) {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (error) {
        console.error('[OrgSettings] Error fetching organization settings:', error);
      }

      const cwSettings = data?.settings?.cloudwaitress;

      // Return org-specific settings if configured, otherwise use env vars
      return {
        integratorId: cwSettings?.integrator_id || process.env.CLOUDWAITRESS_INTEGRATOR_ID,
        secret: cwSettings?.secret || process.env.CLOUDWAITRESS_SECRET,
        apiUrl: cwSettings?.api_url || process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com'
      };
    } catch (err) {
      console.error('[OrgSettings] Failed to get CloudWaitress config:', err);
      // Fallback to environment variables
      return {
        integratorId: process.env.CLOUDWAITRESS_INTEGRATOR_ID,
        secret: process.env.CLOUDWAITRESS_SECRET,
        apiUrl: process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com'
      };
    }
  }

  /**
   * Update CloudWaitress configuration for an organization
   * @param {string} organisationId - The organization UUID
   * @param {object} config - The CloudWaitress configuration
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async updateCloudWaitressConfig(organisationId, config) {
    try {
      // First get existing settings
      const { data: existing, error: fetchError } = await supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (fetchError) throw fetchError;

      // Merge with existing settings
      const updatedSettings = {
        ...(existing?.settings || {}),
        cloudwaitress: {
          integrator_id: config.integratorId || null,
          secret: config.secret || null,
          api_url: config.apiUrl || 'https://api.cloudwaitress.com',
          updated_at: new Date().toISOString()
        }
      };

      // Update the organization
      const { error: updateError } = await supabase
        .from('organisations')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisationId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err) {
      console.error('[OrgSettings] Failed to update CloudWaitress config:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get CloudWaitress configuration for display (with masked secret)
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{integratorId: string, secret: string, apiUrl: string, isConfigured: boolean}>}
   */
  static async getCloudWaitressConfigMasked(organisationId) {
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (error) throw error;

      const cwSettings = data?.settings?.cloudwaitress;
      const isConfigured = !!(cwSettings?.integrator_id && cwSettings?.secret);

      return {
        integratorId: cwSettings?.integrator_id || '',
        secret: cwSettings?.secret ? '••••••••' + cwSettings.secret.slice(-8) : '',
        apiUrl: cwSettings?.api_url || 'https://api.cloudwaitress.com',
        isConfigured,
        updatedAt: cwSettings?.updated_at || null
      };
    } catch (err) {
      console.error('[OrgSettings] Failed to get masked CloudWaitress config:', err);
      return {
        integratorId: '',
        secret: '',
        apiUrl: 'https://api.cloudwaitress.com',
        isConfigured: false,
        updatedAt: null
      };
    }
  }
}

module.exports = { OrganizationSettingsService };
```

---

### Step 1.3: Update Registration Routes

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

**Add import at top:**
```javascript
const { OrganizationSettingsService } = require('../services/organization-settings-service');
```

**Update `/register-account` route (around line 197-208):**

```javascript
// BEFORE:
const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
const cloudWaitressAPI = new CloudWaitressAPIService();

// AFTER:
const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
const cwConfig = await OrganizationSettingsService.getCloudWaitressConfig(organisationId);
const cloudWaitressAPI = new CloudWaitressAPIService(cwConfig);

console.log('[Registration] Using CloudWaitress config for org:', organisationId);
console.log('[Registration] Integrator ID:', cwConfig.integratorId ? 'configured' : 'using default');
```

**Update `/register-restaurant` route (around line 426-434):**

```javascript
// BEFORE:
const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
const cloudWaitressAPI = new CloudWaitressAPIService();

// AFTER:
const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
const cwConfig = await OrganizationSettingsService.getCloudWaitressConfig(organisationId);
const cloudWaitressAPI = new CloudWaitressAPIService(cwConfig);
```

---

## Phase 2: API Endpoints for Settings Management

### Step 2.1: Create Organization Settings Routes

**File:** `UberEats-Image-Extractor/src/routes/organization-settings-routes.js` (new file)

```javascript
const express = require('express');
const router = express.Router();
const { OrganizationSettingsService } = require('../services/organization-settings-service');

/**
 * GET /api/organization/settings/cloudwaitress
 * Get CloudWaitress configuration (masked for security)
 * Requires: admin role
 */
router.get('/cloudwaitress', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  // Only admins can view API credentials
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const config = await OrganizationSettingsService.getCloudWaitressConfigMasked(organisationId);

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('[Settings] Error fetching CloudWaitress config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/organization/settings/cloudwaitress
 * Update CloudWaitress configuration
 * Requires: admin role
 */
router.put('/cloudwaitress', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;
  const { integratorId, secret, apiUrl } = req.body;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  // Only admins can update API credentials
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  // Validate input format
  if (integratorId && !integratorId.startsWith('CWI_')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Integrator ID format. Must start with CWI_'
    });
  }

  if (secret && !secret.startsWith('CWS_')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Secret format. Must start with CWS_'
    });
  }

  try {
    const result = await OrganizationSettingsService.updateCloudWaitressConfig(organisationId, {
      integratorId,
      secret,
      apiUrl
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Log the update
    const { supabase } = require('../services/database-service');
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        action: 'cloudwaitress_config_update',
        status: 'success',
        request_data: {
          integrator_id_updated: !!integratorId,
          secret_updated: !!secret,
          api_url_updated: !!apiUrl
        },
        initiated_by: req.user?.email || 'system'
      });

    res.json({
      success: true,
      message: 'CloudWaitress configuration updated successfully'
    });
  } catch (error) {
    console.error('[Settings] Error updating CloudWaitress config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/organization/settings/cloudwaitress
 * Remove CloudWaitress configuration (revert to system defaults)
 * Requires: admin role
 */
router.delete('/cloudwaitress', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const result = await OrganizationSettingsService.updateCloudWaitressConfig(organisationId, {
      integratorId: null,
      secret: null,
      apiUrl: null
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      message: 'CloudWaitress configuration removed. Using system defaults.'
    });
  } catch (error) {
    console.error('[Settings] Error removing CloudWaitress config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### Step 2.2: Register Routes in Server

**File:** `UberEats-Image-Extractor/server.js`

Add after other route imports:
```javascript
const organizationSettingsRoutes = require('./src/routes/organization-settings-routes');
```

Add after other route registrations:
```javascript
app.use('/api/organization/settings', organizationSettingsRoutes);
```

---

## Phase 3: Frontend - Settings Page

### Step 3.1: Update Settings Page

**File:** `UberEats-Image-Extractor/src/pages/Settings.tsx`

**Add imports:**
```typescript
import { Eye, EyeOff, Key, AlertTriangle, Check } from 'lucide-react';
```

**Add state variables (after existing state):**
```typescript
// CloudWaitress config state
const [cloudwaitressConfig, setCloudwaitressConfig] = useState({
  integratorId: '',
  secret: '',
  apiUrl: 'https://api.cloudwaitress.com',
  isConfigured: false
});
const [showSecret, setShowSecret] = useState(false);
const [configLoading, setConfigLoading] = useState(false);
const [configSaving, setConfigSaving] = useState(false);
const [newSecret, setNewSecret] = useState('');
```

**Add load function:**
```typescript
const loadCloudWaitressConfig = async () => {
  if (!user?.organisationId || !isAdmin()) return;

  setConfigLoading(true);
  try {
    const response = await fetch('/api/organization/settings/cloudwaitress', {
      headers: {
        'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
      }
    });
    const data = await response.json();

    if (data.success) {
      setCloudwaitressConfig(data.config);
    }
  } catch (error) {
    console.error('Failed to load CloudWaitress config:', error);
  } finally {
    setConfigLoading(false);
  }
};

// Call in useEffect
useEffect(() => {
  if (user?.organisationId) {
    loadOrganizationData();
    loadCloudWaitressConfig();
  }
}, [user]);
```

**Add save function:**
```typescript
const saveCloudWaitressConfig = async () => {
  setConfigSaving(true);
  try {
    const response = await fetch('/api/organization/settings/cloudwaitress', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
      },
      body: JSON.stringify({
        integratorId: cloudwaitressConfig.integratorId || undefined,
        secret: newSecret || undefined,
        apiUrl: cloudwaitressConfig.apiUrl || undefined
      })
    });

    const data = await response.json();

    if (data.success) {
      toast({
        title: 'Configuration saved',
        description: 'CloudWaitress API credentials have been updated.'
      });
      setNewSecret('');
      await loadCloudWaitressConfig();
    } else {
      throw new Error(data.error);
    }
  } catch (error: any) {
    toast({
      title: 'Failed to save configuration',
      description: error.message,
      variant: 'destructive'
    });
  } finally {
    setConfigSaving(false);
  }
};
```

**Update Organization Tab content (replace existing content):**
```tsx
<TabsContent value="organization" className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Organization Details</CardTitle>
      <CardDescription>
        View and manage your organization information
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-4">
      <div>
        <Label>Organization Name</Label>
        <p className="text-sm text-gray-600 mt-1">
          {user?.organisation?.name || 'Default Organization'}
        </p>
      </div>

      <div>
        <Label>Your Role</Label>
        <div className="mt-1">
          <Badge variant={getRoleBadgeVariant(user?.role || 'user')}>
            {getRoleIcon(user?.role || 'user')}
            <span className="ml-1">{user?.role}</span>
          </Badge>
        </div>
      </div>

      {user?.organisation?.created_at && (
        <div>
          <Label>Created</Label>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(user.organisation.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </CardContent>
  </Card>

  {/* CloudWaitress API Configuration - Admin Only */}
  {isAdmin() && (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Key className="h-5 w-5 text-purple-600" />
          <div>
            <CardTitle>CloudWaitress API Configuration</CardTitle>
            <CardDescription>
              Configure your integrator credentials for restaurant registration
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {cloudwaitressConfig.isConfigured ? (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Custom credentials configured. Last updated: {cloudwaitressConfig.updatedAt ? new Date(cloudwaitressConfig.updatedAt).toLocaleDateString() : 'Unknown'}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Using system default credentials. Configure your own for independent billing.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="integrator-id">Integrator ID</Label>
              <Input
                id="integrator-id"
                placeholder="CWI_xxxx-xxxx-xxxx-xxxx"
                value={cloudwaitressConfig.integratorId}
                onChange={(e) => setCloudwaitressConfig({
                  ...cloudwaitressConfig,
                  integratorId: e.target.value
                })}
              />
              <p className="text-xs text-gray-500">
                Your CloudWaitress integrator identifier
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret">Secret</Label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Input
                    id="secret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder={cloudwaitressConfig.secret || 'CWS_xxxx-xxxx-xxxx-xxxx'}
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {cloudwaitressConfig.isConfigured
                  ? 'Leave empty to keep existing secret, or enter a new one to update'
                  : 'Your CloudWaitress API secret'}
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCloudwaitressConfig({
                    integratorId: '',
                    secret: '',
                    apiUrl: 'https://api.cloudwaitress.com',
                    isConfigured: false
                  });
                  setNewSecret('');
                }}
              >
                Reset to Defaults
              </Button>
              <Button
                onClick={saveCloudWaitressConfig}
                disabled={configSaving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {configSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )}
</TabsContent>
```

---

## Phase 4: Frontend - Super Admin Integration

### Step 4.1: Update OrganizationEditModal

**File:** `UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`

**Add import:**
```typescript
import { Key, Eye, EyeOff } from 'lucide-react';
```

**Add state:**
```typescript
const [showSecret, setShowSecret] = useState(false);
```

**Update TabsList to include Integrations:**
```tsx
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
```

**Add Integrations TabContent (after details tab):**
```tsx
<TabsContent value="integrations" className="space-y-6 mt-6">
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium">CloudWaitress API</h3>
      <p className="text-sm text-gray-500">
        Configure CloudWaitress integrator credentials for this organization
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
                integrator_id: e.target.value
              }
            }
          })}
          disabled={loading || organization.status === 'archived'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cw-secret">Secret</Label>
        <div className="flex space-x-2">
          <Input
            id="cw-secret"
            type={showSecret ? 'text' : 'password'}
            placeholder="CWS_xxxx-xxxx-xxxx-xxxx"
            value={organization.settings?.cloudwaitress?.secret || ''}
            onChange={(e) => setOrganization({
              ...organization,
              settings: {
                ...organization.settings,
                cloudwaitress: {
                  ...organization.settings?.cloudwaitress,
                  secret: e.target.value
                }
              }
            })}
            disabled={loading || organization.status === 'archived'}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSecret(!showSecret)}
            type="button"
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
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
                api_url: e.target.value
              }
            }
          })}
          disabled={loading || organization.status === 'archived'}
        />
        <p className="text-xs text-gray-500">
          Leave empty to use default: https://api.cloudwaitress.com
        </p>
      </div>
    </div>

    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Leave fields empty to use system default credentials. Custom credentials allow independent billing and tracking.
      </AlertDescription>
    </Alert>
  </div>
</TabsContent>
```

**Update handleUpdate to include settings:**
```typescript
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
        settings: organization.settings, // ADD THIS LINE
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
```

---

## Phase 5: Testing Checklist

### Backend Tests

- [ ] CloudWaitressAPIService accepts custom credentials
- [ ] CloudWaitressAPIService falls back to env vars when no options provided
- [ ] OrganizationSettingsService.getCloudWaitressConfig returns org credentials
- [ ] OrganizationSettingsService.getCloudWaitressConfig falls back when not configured
- [ ] OrganizationSettingsService.updateCloudWaitressConfig saves correctly
- [ ] Registration routes use organization-specific credentials
- [ ] Settings API endpoints require admin role
- [ ] Settings API validates input format

### Frontend Tests

- [ ] Settings page loads CloudWaitress config for admins
- [ ] Settings page hides CloudWaitress config for non-admins
- [ ] Organization ID is NOT displayed
- [ ] Save button updates credentials
- [ ] Reset button clears to defaults
- [ ] Secret field shows/hides properly
- [ ] Super admin can edit org CloudWaitress settings
- [ ] Integrations tab appears in org edit modal

### Integration Tests

- [ ] Register account with org-specific credentials
- [ ] Register account with fallback credentials
- [ ] Register restaurant with org-specific credentials
- [ ] Credential changes persist across sessions

---

## Rollout Plan

### Stage 1: Development
1. Implement all backend changes
2. Test with existing registrations (should use env vars)
3. Implement frontend changes
4. Test credential management UI

### Stage 2: Staging
1. Deploy to staging environment
2. Configure test organization with custom credentials
3. Run full registration flow
4. Verify billing/tracking works correctly

### Stage 3: Production
1. Deploy backend changes first (backward compatible)
2. Monitor registration logs for errors
3. Deploy frontend changes
4. Notify organizations about new feature

---

## Estimated Timeline

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | Backend Service Modifications | 1 hour |
| 2 | API Endpoints | 1 hour |
| 3 | Settings Page Frontend | 1.5 hours |
| 4 | Super Admin Integration | 1 hour |
| 5 | Testing | 1.5 hours |
| **Total** | | **6 hours** |

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/services/cloudwaitress-api-service.js` | Modify | Accept credentials in constructor |
| `src/services/organization-settings-service.js` | Create | New service for org settings |
| `src/routes/registration-routes.js` | Modify | Use org-specific credentials |
| `src/routes/organization-settings-routes.js` | Create | New API endpoints |
| `server.js` | Modify | Register new routes |
| `src/pages/Settings.tsx` | Modify | Add CloudWaitress config UI |
| `src/components/super-admin/organizations/OrganizationEditModal.tsx` | Modify | Add Integrations tab |