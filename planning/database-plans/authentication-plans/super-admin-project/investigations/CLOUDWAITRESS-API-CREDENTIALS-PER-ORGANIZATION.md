# CloudWaitress API Credentials Per Organization

## Investigation Summary

**Date:** 2025-01-08
**Status:** Investigation Complete
**Priority:** High

---

## Current Implementation Analysis

### CloudWaitress API Service (`cloudwaitress-api-service.js`)

The service currently uses hardcoded environment variables for API authentication:

```javascript
constructor() {
  this.baseUrl = process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com';
  this.integratorId = process.env.CLOUDWAITRESS_INTEGRATOR_ID || 'CWI_e2dae966-8523-4fd6-a853-58586a296bff';
  this.secret = process.env.CLOUDWAITRESS_SECRET || 'CWS_09908059-7b25-492f-86c9-34c672d689a4';
}
```

**Key Methods:**
- `generateSignature(email, phone, password)` - Creates HMAC-SHA256 signature using the secret
- `registerUser(email, phone, password)` - Two-step registration process (start + verify)
- `checkUserExists(email)` - Checks if user already exists

### Registration Routes Usage

The CloudWaitress API is called from two routes in `registration-routes.js`:

1. **`/register-account`** (line 103-326):
   - Creates user accounts on Pumpd via CloudWaitress API
   - Retrieves organisation context from `req.user.organisationId`
   - Currently instantiates service without organization context

2. **`/register-restaurant`** (line 329-733):
   - For `new_account_with_restaurant` type, also creates account via CloudWaitress API
   - Same limitation - no organization-specific credentials

### Database Schema Analysis

The `organisations` table has two JSONB columns suitable for storing credentials:

| Column | Type | Purpose |
|--------|------|---------|
| `settings` | jsonb | General organization settings (currently `{}`) |
| `feature_flags` | jsonb | Feature toggles and billing rates |

**Recommendation:** Store CloudWaitress credentials in the `settings` column to keep them separate from feature flags.

### Settings Page Analysis (`Settings.tsx`)

Current Organization tab displays:
- Organization Name
- Organization ID (requested to be removed)
- User's Role
- Created Date

**Required Changes:**
- Remove Organization ID display
- Add CloudWaitress API credentials management for admin users

---

## Proposed Solution

### 1. Database Changes

Add CloudWaitress credentials to the `settings` JSONB column:

```json
{
  "cloudwaitress": {
    "integrator_id": "CWI_xxxx-xxxx-xxxx-xxxx",
    "secret": "CWS_xxxx-xxxx-xxxx-xxxx",
    "api_url": "https://api.cloudwaitress.com"
  }
}
```

No migration needed - just update the application to read/write these values.

### 2. Backend Changes

#### 2.1 Modify CloudWaitressAPIService

Update constructor to accept organization credentials:

```javascript
class CloudWaitressAPIService {
  constructor(options = {}) {
    this.baseUrl = options.apiUrl || process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com';
    this.integratorId = options.integratorId || process.env.CLOUDWAITRESS_INTEGRATOR_ID;
    this.secret = options.secret || process.env.CLOUDWAITRESS_SECRET;
  }

  // Existing methods remain unchanged
}
```

#### 2.2 Create Helper Function

Add a helper to fetch organization CloudWaitress settings:

```javascript
async function getOrganizationCloudWaitressConfig(organisationId) {
  const { supabase } = require('../services/database-service');

  const { data, error } = await supabase
    .from('organisations')
    .select('settings')
    .eq('id', organisationId)
    .single();

  if (error || !data?.settings?.cloudwaitress) {
    // Fall back to environment variables
    return {
      integratorId: process.env.CLOUDWAITRESS_INTEGRATOR_ID,
      secret: process.env.CLOUDWAITRESS_SECRET,
      apiUrl: process.env.CLOUDWAITRESS_API_URL
    };
  }

  return {
    integratorId: data.settings.cloudwaitress.integrator_id,
    secret: data.settings.cloudwaitress.secret,
    apiUrl: data.settings.cloudwaitress.api_url || 'https://api.cloudwaitress.com'
  };
}
```

#### 2.3 Update Registration Routes

Modify routes to use organization-specific credentials:

```javascript
// In /register-account route
const cwConfig = await getOrganizationCloudWaitressConfig(organisationId);
const cloudWaitressAPI = new CloudWaitressAPIService(cwConfig);
```

#### 2.4 Add Settings API Endpoint

Create a new route for managing organization settings:

```javascript
// GET /api/organization/settings
// Returns cloudwaitress config (masked secret) for admin users

// PUT /api/organization/settings/cloudwaitress
// Updates cloudwaitress credentials (admin only)
```

### 3. Frontend Changes

#### 3.1 Settings Page (`Settings.tsx`)

**Organization Tab Changes:**
- Remove Organization ID display
- Add CloudWaitress API Configuration section (admin only)
- Include fields for:
  - Integrator ID (text input)
  - Secret (password input with show/hide toggle)
  - Test Connection button

```tsx
// New section in Organization tab (admin only)
{isAdmin() && (
  <div className="space-y-4 pt-4 border-t">
    <h3 className="font-medium">CloudWaitress API Configuration</h3>
    <p className="text-sm text-gray-500">
      Configure your CloudWaitress integrator credentials for restaurant registration
    </p>

    <div className="space-y-2">
      <Label htmlFor="integrator-id">Integrator ID</Label>
      <Input
        id="integrator-id"
        placeholder="CWI_xxxx-xxxx-xxxx-xxxx"
        value={cloudwaitressConfig.integratorId}
        onChange={(e) => setCloudwaitressConfig({...cloudwaitressConfig, integratorId: e.target.value})}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="secret">Secret</Label>
      <div className="relative">
        <Input
          id="secret"
          type={showSecret ? 'text' : 'password'}
          placeholder="CWS_xxxx-xxxx-xxxx-xxxx"
          value={cloudwaitressConfig.secret}
          onChange={(e) => setCloudwaitressConfig({...cloudwaitressConfig, secret: e.target.value})}
        />
        <Button variant="ghost" size="icon" onClick={() => setShowSecret(!showSecret)}>
          {showSecret ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>

    <div className="flex space-x-2">
      <Button variant="outline" onClick={testConnection}>
        Test Connection
      </Button>
      <Button onClick={saveCloudwaitressConfig}>
        Save Configuration
      </Button>
    </div>
  </div>
)}
```

#### 3.2 Super Admin Feature Flags Editor

Add CloudWaitress settings management in super admin organization edit modal:

**Option A: Add to FeatureFlagsEditor**
- Add a new "API Integrations" section
- Include CloudWaitress credentials with masked display

**Option B: Separate Tab in OrganizationEditModal (Recommended)**
- Add "Integrations" tab alongside Details, Members, Usage
- Allows super admin to set/view/edit CloudWaitress credentials for any organization

```tsx
// In OrganizationEditModal.tsx - add new tab
<TabsTrigger value="integrations" className="flex items-center gap-2">
  <Key className="h-4 w-4" />
  Integrations
</TabsTrigger>

<TabsContent value="integrations" className="mt-6">
  <div className="space-y-6">
    <h3 className="font-medium">CloudWaitress API</h3>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Integrator ID</Label>
        <Input
          value={organization.settings?.cloudwaitress?.integrator_id || ''}
          onChange={(e) => updateSettings('cloudwaitress.integrator_id', e.target.value)}
          placeholder="CWI_xxxx-xxxx-xxxx-xxxx"
        />
      </div>
      <div className="space-y-2">
        <Label>Secret</Label>
        <Input
          type="password"
          value={organization.settings?.cloudwaitress?.secret || ''}
          onChange={(e) => updateSettings('cloudwaitress.secret', e.target.value)}
          placeholder="CWS_xxxx-xxxx-xxxx-xxxx"
        />
      </div>
    </div>
    <p className="text-sm text-gray-500">
      Leave empty to use system default credentials
    </p>
  </div>
</TabsContent>
```

---

## Security Considerations

1. **Secret Storage:** Secrets stored in JSONB are not encrypted at rest beyond PostgreSQL's standard encryption. For production, consider:
   - Using Supabase Vault for secrets
   - Encrypting before storage
   - Using a dedicated secrets manager

2. **Access Control:**
   - Only admin/super_admin should view/edit credentials
   - RLS policies already restrict organisation access
   - API endpoints must verify admin role

3. **Audit Trail:**
   - Consider logging credential changes to `registration_logs`
   - Track who modified and when

4. **Secret Masking:**
   - Never return full secret in API responses
   - Use `***` masking for display
   - Only show full value when editing

---

## Implementation Plan

### Phase 1: Backend (Estimated: 2-3 hours)

1. **Modify CloudWaitressAPIService**
   - Update constructor to accept options
   - No breaking changes to existing methods

2. **Create Helper Function**
   - `getOrganizationCloudWaitressConfig()`
   - Fallback to env vars if not configured

3. **Update Registration Routes**
   - `/register-account`
   - `/register-restaurant`

4. **Add Settings API Endpoints**
   - GET `/api/organization/settings/cloudwaitress`
   - PUT `/api/organization/settings/cloudwaitress`

### Phase 2: Frontend - Settings Page (Estimated: 1-2 hours)

1. **Remove Organization ID from display**

2. **Add CloudWaitress Configuration Section**
   - Admin-only visibility
   - Integrator ID input
   - Secret input with toggle
   - Save button
   - Test connection button (optional)

### Phase 3: Frontend - Super Admin (Estimated: 1-2 hours)

1. **Add Integrations Tab to OrganizationEditModal**
   - CloudWaitress credentials section
   - Secret masking/reveal
   - Save with organization update

2. **Update handleUpdate function**
   - Include settings in update payload

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/cloudwaitress-api-service.js` | Accept credentials in constructor |
| `src/routes/registration-routes.js` | Fetch org credentials before API calls |
| `src/pages/Settings.tsx` | Remove org ID, add CloudWaitress config UI |
| `src/components/super-admin/organizations/OrganizationEditModal.tsx` | Add Integrations tab |
| `src/routes/organization-routes.js` (new or existing) | Settings API endpoints |

---

## Testing Plan

1. **Unit Tests:**
   - CloudWaitressAPIService with custom credentials
   - Fallback to env vars when not configured

2. **Integration Tests:**
   - Registration with org-specific credentials
   - Registration with fallback credentials

3. **Manual Testing:**
   - Admin configures credentials in Settings
   - Super admin edits credentials for an organization
   - Registration uses correct credentials per org

---

## Rollback Plan

If issues arise:
1. Remove organization credential checks from routes
2. Service falls back to environment variables
3. Frontend changes can be feature-flagged

---

## Open Questions

1. Should we add a "Test Connection" feature to validate credentials before saving?
2. Do we need to encrypt secrets before storing in the database?
3. Should credential changes trigger notifications to organization admins?
4. Do we need rate limiting on the settings update endpoint?

---

## Appendix: Current Code References

### CloudWaitress Service Location
`UberEats-Image-Extractor/src/services/cloudwaitress-api-service.js`

### Registration Routes Location
`UberEats-Image-Extractor/src/routes/registration-routes.js`
- `/register-account`: Lines 103-326
- `/register-restaurant`: Lines 329-733

### Settings Page Location
`UberEats-Image-Extractor/src/pages/Settings.tsx`

### Super Admin Organization Edit Modal
`UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`
