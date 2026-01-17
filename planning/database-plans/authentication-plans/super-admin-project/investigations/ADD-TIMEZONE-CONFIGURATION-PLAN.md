# Add Configurable Timezone Setting for CloudWaitress Restaurant Registration

**Date:** 2025-12-10
**Status:** Planning
**Priority:** High
**Reference:** [CONFIGURABLE-LOGIN-URL-AND-COUNTRY-SETTINGS-ROADMAP.md](./CONFIGURABLE-LOGIN-URL-AND-COUNTRY-SETTINGS-ROADMAP.md)

---

## Problem Statement

The current implementation uses `countryConfig.timezoneDisplay` (e.g., "Auckland", "Sydney") to set timezones during restaurant registration. This is insufficient because:

1. **Multiple timezones per country**: US has Eastern, Central, Mountain, Pacific, etc.
2. **Australia has 5 timezones**: Sydney, Perth, Brisbane, Adelaide, Darwin
3. **Canada spans 6 timezones**: Pacific, Mountain, Central, Eastern, Atlantic, Newfoundland
4. **No override capability**: Organizations cannot specify a different timezone than the country default

### Current Flow

```
Organization Settings → country code (e.g., "AU")
                     ↓
Country Config       → timezoneDisplay: "Sydney"
                     ↓
Registration Script  → Types "Sydney" in timezone dropdown
```

### Desired Flow

```
Organization Settings → settings.cloudwaitress.timezone (e.g., "Perth")
                     ↓
Registration Script  → Types "Perth" in timezone dropdown
                     ↓
Fallback            → If not set, use countryConfig.timezoneDisplay
```

---

## Implementation Plan

### Phase 1: Update Country Configuration Files

**Files:**
- `/scripts/lib/country-config.js`
- `/scripts/lib/country-config.cjs`

**Changes:**

Add `timezones` array to each country config containing common timezones with IANA codes and display names:

```javascript
NZ: {
  // ... existing fields
  timezone: 'Pacific/Auckland',
  timezoneDisplay: 'Auckland',
  timezones: [
    { iana: 'Pacific/Auckland', display: 'Auckland', city: 'Auckland' },
    { iana: 'Pacific/Chatham', display: 'Chatham Islands', city: 'Chatham' }
  ]
},
AU: {
  // ... existing fields
  timezones: [
    { iana: 'Australia/Sydney', display: 'Sydney (AEST/AEDT)', city: 'Sydney' },
    { iana: 'Australia/Melbourne', display: 'Melbourne (AEST/AEDT)', city: 'Melbourne' },
    { iana: 'Australia/Brisbane', display: 'Brisbane (AEST)', city: 'Brisbane' },
    { iana: 'Australia/Perth', display: 'Perth (AWST)', city: 'Perth' },
    { iana: 'Australia/Adelaide', display: 'Adelaide (ACST/ACDT)', city: 'Adelaide' },
    { iana: 'Australia/Darwin', display: 'Darwin (ACST)', city: 'Darwin' },
    { iana: 'Australia/Hobart', display: 'Hobart (AEST/AEDT)', city: 'Hobart' }
  ]
},
US: {
  // ... existing fields
  timezones: [
    { iana: 'America/New_York', display: 'Eastern Time (ET)', city: 'New York' },
    { iana: 'America/Chicago', display: 'Central Time (CT)', city: 'Chicago' },
    { iana: 'America/Denver', display: 'Mountain Time (MT)', city: 'Denver' },
    { iana: 'America/Los_Angeles', display: 'Pacific Time (PT)', city: 'Los Angeles' },
    { iana: 'America/Phoenix', display: 'Arizona (MST)', city: 'Phoenix' },
    { iana: 'America/Anchorage', display: 'Alaska Time (AKT)', city: 'Anchorage' },
    { iana: 'Pacific/Honolulu', display: 'Hawaii Time (HST)', city: 'Honolulu' }
  ]
},
GB: {
  // ... existing fields
  timezones: [
    { iana: 'Europe/London', display: 'London (GMT/BST)', city: 'London' }
  ]
},
CA: {
  // ... existing fields
  timezones: [
    { iana: 'America/Toronto', display: 'Eastern Time (ET)', city: 'Toronto' },
    { iana: 'America/Winnipeg', display: 'Central Time (CT)', city: 'Winnipeg' },
    { iana: 'America/Edmonton', display: 'Mountain Time (MT)', city: 'Edmonton' },
    { iana: 'America/Vancouver', display: 'Pacific Time (PT)', city: 'Vancouver' },
    { iana: 'America/Halifax', display: 'Atlantic Time (AT)', city: 'Halifax' },
    { iana: 'America/St_Johns', display: 'Newfoundland (NT)', city: 'St. John\'s' }
  ]
}
```

Add helper functions:

```javascript
/**
 * Get timezones available for a country
 * @param {string} countryCode - ISO country code
 * @returns {Array<{iana: string, display: string, city: string}>}
 */
function getTimezonesForCountry(countryCode) {
  const config = getCountryConfig(countryCode);
  return config.timezones || [{
    iana: config.timezone,
    display: config.timezoneDisplay,
    city: config.timezoneDisplay
  }];
}

/**
 * Get timezone display name (city) from IANA timezone
 * @param {string} ianaTimezone - IANA timezone (e.g., 'Australia/Perth')
 * @param {string} countryCode - ISO country code for fallback
 * @returns {string} Display name for dropdown search (e.g., 'Perth')
 */
function getTimezoneDisplayName(ianaTimezone, countryCode) {
  const config = getCountryConfig(countryCode);
  const tz = config.timezones?.find(t => t.iana === ianaTimezone);
  return tz?.city || config.timezoneDisplay;
}
```

---

### Phase 2: Database Schema Update

**Location:** `settings.cloudwaitress.timezone`

**Structure:**
```json
{
  "settings": {
    "country": "AU",
    "cloudwaitress": {
      "integrator_id": "CWI_xxxx",
      "secret": "CWS_xxxx",
      "api_url": "https://api.cloudwaitress.com",
      "admin_url": "https://admin.pumpd.co.nz",
      "country": "AU",
      "timezone": "Australia/Perth",
      "updated_at": "2025-01-08T00:00:00.000Z"
    }
  }
}
```

**Migration:** No migration needed - JSONB field accepts new properties dynamically.

---

### Phase 3: Backend Service Updates

**File:** `/UberEats-Image-Extractor/src/services/organization-settings-service.js`

#### 3.1 Update `updateCloudWaitressConfig()` method

Add `timezone` to the merge logic:

```javascript
// Around line 116, add timezone handling:
timezone: config.timezone !== undefined ? config.timezone : (existingCw.timezone || null),
```

#### 3.2 Update `getCloudWaitressConfigMasked()` method

Return timezone in response:

```javascript
// Around line 188, add:
timezone: cwSettings?.timezone || null,
```

#### 3.3 Update `getScriptConfig()` method

Include timezone and timezoneDisplay in the config:

```javascript
// Around line 326, add:
const timezone = cwSettings.timezone || null;
const timezoneDisplay = timezone
  ? getTimezoneDisplayName(timezone, country)
  : countryConfig.timezoneDisplay;

return {
  // ... existing fields
  timezone,
  timezoneDisplay,
  // ...
};
```

#### 3.4 Add new helper method

```javascript
/**
 * Get timezone setting for an organization
 * @param {string} organisationId - The organization UUID
 * @returns {Promise<{timezone: string|null, timezoneDisplay: string}>}
 */
static async getTimezone(organisationId) {
  try {
    const { settings } = await this.getOrganizationSettings(organisationId);
    const cwSettings = settings?.cloudwaitress || {};
    const country = cwSettings.country || settings?.country || this.DEFAULT_COUNTRY;
    const countryConfig = getCountryConfig(country);

    const timezone = cwSettings.timezone || null;
    const timezoneDisplay = timezone
      ? getTimezoneDisplayName(timezone, country)
      : countryConfig.timezoneDisplay;

    return { timezone, timezoneDisplay };
  } catch (err) {
    console.error('[OrgSettings] Failed to get timezone:', err);
    return { timezone: null, timezoneDisplay: 'Auckland' };
  }
}
```

---

### Phase 4: API Route Updates

**File:** `/UberEats-Image-Extractor/src/routes/organization-settings-routes.js`

#### 4.1 Update PUT `/cloudwaitress` endpoint

Add `timezone` to destructuring and pass to service:

```javascript
// Line 58:
const { integratorId, secret, apiUrl, adminUrl, country, timezone } = req.body;

// Line 91-97:
const result = await OrganizationSettingsService.updateCloudWaitressConfig(organisationId, {
  integratorId,
  secret,
  apiUrl,
  adminUrl,
  country,
  timezone  // Add this
});
```

#### 4.2 Add new GET endpoint for timezones

```javascript
/**
 * GET /api/organization/settings/timezones
 * Get available timezones for the organization's country
 */
router.get('/timezones', async (req, res) => {
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const country = await OrganizationSettingsService.getCloudWaitressCountry(organisationId);
    const { getTimezonesForCountry } = require('../../../scripts/lib/country-config.cjs');
    const timezones = getTimezonesForCountry(country);

    res.json({
      success: true,
      country,
      timezones
    });
  } catch (error) {
    console.error('[Settings] Error fetching timezones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### Phase 5: Registration Route Updates

**File:** `/UberEats-Image-Extractor/src/routes/registration-routes.js`

#### 5.1 Update script command to include timezone

Around line 602, add `--timezone` argument:

```javascript
let command = `node ${scriptPath} --email="${email}" --password="${password}" --name="${restaurantName || restaurant.name}" --address="${restaurant.address || ''}" --phone="${restaurant.phone || ''}" --dayHours='${hoursJson}' --admin-url="${scriptConfig.adminUrl}" --country="${scriptConfig.country}" --timezone="${scriptConfig.timezoneDisplay}"`;
```

#### 5.2 Update logging

Around line 592-596:

```javascript
console.log('[Registration] Script config loaded:', {
  adminUrl: scriptConfig.adminUrl,
  country: scriptConfig.country,
  timezone: scriptConfig.timezoneDisplay,  // Add this
  adminHostname: scriptConfig.adminHostname
});
```

---

### Phase 6: Script Updates

**File:** `/scripts/restaurant-registration/login-and-register-restaurant.js`

#### 6.1 Add timezone argument parsing

Around line 86, add:

```javascript
const timezone = getArg('timezone') || countryConfig.timezoneDisplay;
```

#### 6.2 Update console output

Around line 151:

```javascript
console.log(`  Timezone: ${timezone}`);
```

#### 6.3 Update STEP 13 (Set Timezone)

Around line 573, change from:

```javascript
await page.keyboard.type(countryConfig.timezoneDisplay);
console.log(`  ✓ Typed "${countryConfig.timezoneDisplay}"`);
```

To:

```javascript
await page.keyboard.type(timezone);
console.log(`  ✓ Typed "${timezone}"`);
```

And around line 580:

```javascript
console.log(`  ✓ Selected ${timezone} timezone`);
```

---

### Phase 7: Frontend Updates

#### 7.1 Settings Page

**File:** `/UberEats-Image-Extractor/src/pages/Settings.tsx`

Add state for timezone:

```typescript
// Around line 50:
const [newTimezone, setNewTimezone] = useState('');
const [availableTimezones, setAvailableTimezones] = useState<Array<{iana: string, display: string, city: string}>>([]);
```

Add function to load available timezones when country changes:

```typescript
const loadTimezones = async (country: string) => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const response = await fetch(`/api/organization/settings/timezones?country=${country}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();

    if (data.success) {
      setAvailableTimezones(data.timezones);
    }
  } catch (error) {
    console.error('Failed to load timezones:', error);
  }
};
```

Update `loadCloudWaitressConfig` to load timezone:

```typescript
// Around line 178-179:
setNewTimezone(data.config.timezone || '');
await loadTimezones(data.config.country || 'NZ');
```

Update `saveCloudWaitressConfig` to include timezone:

```typescript
// Around line 203-207:
body: JSON.stringify({
  integratorId: newIntegratorId || undefined,
  secret: newSecret || undefined,
  adminUrl: newAdminUrl || undefined,
  country: newCountry || undefined,
  timezone: newTimezone || undefined
})
```

Add timezone dropdown in CloudWaitress configuration section (after country dropdown, around line 836):

```tsx
<div className="space-y-2">
  <Label htmlFor="timezone">Timezone</Label>
  <Select
    value={newTimezone}
    onValueChange={setNewTimezone}
    disabled={availableTimezones.length === 0}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select timezone (uses country default if not set)" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Use country default</SelectItem>
      {availableTimezones.map((tz) => (
        <SelectItem key={tz.iana} value={tz.city}>
          {tz.display}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-gray-500">
    Override the default timezone for this country. Leave empty to use the country's default timezone.
  </p>
</div>
```

Add effect to reload timezones when country changes:

```typescript
useEffect(() => {
  if (newCountry) {
    loadTimezones(newCountry);
  }
}, [newCountry]);
```

#### 7.2 Super Admin Organization Edit Modal

**File:** `/UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`

Add state for available timezones:

```typescript
const [availableTimezones, setAvailableTimezones] = useState<Array<{iana: string, display: string, city: string}>>([]);
```

Add function to load timezones (can be a simple static lookup based on country):

```typescript
const TIMEZONE_OPTIONS = {
  NZ: [
    { iana: 'Pacific/Auckland', display: 'Auckland', city: 'Auckland' },
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

const getCurrentTimezones = () => {
  const country = organization?.settings?.cloudwaitress?.country || 'NZ';
  return TIMEZONE_OPTIONS[country] || TIMEZONE_OPTIONS.NZ;
};
```

Add timezone dropdown after country dropdown in Integrations tab (around line 351):

```tsx
<div className="space-y-2">
  <Label htmlFor="cw-timezone">Timezone</Label>
  <Select
    value={organization.settings?.cloudwaitress?.timezone || ''}
    onValueChange={(value) => setOrganization({
      ...organization,
      settings: {
        ...organization.settings,
        cloudwaitress: {
          ...organization.settings?.cloudwaitress,
          timezone: value || null
        }
      }
    })}
    disabled={loading || organization.status === 'archived'}
  >
    <SelectTrigger>
      <SelectValue placeholder="Use country default" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Use country default</SelectItem>
      {getCurrentTimezones().map((tz) => (
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
```

---

## Implementation Order

1. **Phase 1**: Update country-config.js and country-config.cjs with timezone arrays and helper functions
2. **Phase 2**: No migration needed (JSONB accepts new fields)
3. **Phase 3**: Update OrganizationSettingsService
4. **Phase 4**: Update organization-settings-routes.js
5. **Phase 5**: Update registration-routes.js to pass timezone
6. **Phase 6**: Update login-and-register-restaurant.js to accept and use timezone
7. **Phase 7**: Update frontend components

---

## Testing Checklist

### Backend Testing
- [ ] `getCloudWaitressConfigMasked()` returns timezone field
- [ ] `updateCloudWaitressConfig()` saves timezone correctly
- [ ] `getScriptConfig()` returns correct timezoneDisplay
- [ ] `/api/organization/settings/timezones` returns correct timezones for country
- [ ] PUT `/cloudwaitress` accepts and saves timezone

### Script Testing
- [ ] Script accepts `--timezone` argument
- [ ] Script uses provided timezone over country default
- [ ] Script falls back to countryConfig.timezoneDisplay if no timezone provided

### Frontend Testing
- [ ] Settings page shows timezone dropdown
- [ ] Timezone options update when country changes
- [ ] Saving timezone works correctly
- [ ] Super Admin modal shows timezone dropdown
- [ ] Super Admin can edit timezone

### Integration Testing
- [ ] Full registration flow with custom timezone
- [ ] Verify timezone selected correctly in CloudWaitress admin

---

## Notes

### Why Store City Name, Not IANA Code

The CloudWaitress timezone dropdown searches by city name (e.g., "Perth", "Sydney", "New York"), not by IANA timezone code. Therefore:

1. We store the **city/display name** in `settings.cloudwaitress.timezone` (e.g., "Perth")
2. The IANA code is only for reference in the timezone options list
3. The script types the city name directly into the dropdown search

### Fallback Behavior

- If `settings.cloudwaitress.timezone` is null/empty, use `countryConfig.timezoneDisplay`
- This maintains backward compatibility with existing organizations

### Future Enhancement

Consider adding a `timezone_iana` field to store the full IANA code for other purposes (API calls, date formatting) while keeping `timezone` as the display name for CloudWaitress registration.
