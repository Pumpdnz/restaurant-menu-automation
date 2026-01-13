# Implementation Plan: Menu CSV Upload Streamlining

## Overview

Streamline the menu CSV upload process on the Registration tab by adding a menu selector dropdown that automatically handles CDN image uploading and CSV generation without requiring manual file downloads.

## Current Flow (User Pain Points)
1. User uploads images to CDN (manual button click)
2. User downloads CSV with images (manual download)
3. User drag-and-drops CSV to upload card (manual file selection)
4. Script processes the upload

## New Flow (Streamlined)
1. User selects menu from dropdown
2. System checks if CDN images exist
3. System auto-uploads to CDN if needed (with progress)
4. System generates CSV internally and imports automatically

---

## Implementation Steps

### Step 1: Create CDN Stats API Endpoint
**File**: `UberEats-Image-Extractor/server.js`
**Location**: After line 2810 (after upload-images endpoint)

Add new endpoint:
```javascript
/**
 * GET /api/menus/:id/cdn-stats
 * Get CDN upload statistics for a menu
 */
app.get('/api/menus/:id/cdn-stats', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!db.isDatabaseAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    const stats = await db.getMenuCDNStats(id);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found or no images'
      });
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[API] Error getting CDN stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### Step 2: Create Direct Menu Import Endpoint
**File**: `UberEats-Image-Extractor/src/routes/registration-routes.js`
**Location**: After the existing `upload-csv-menu` endpoint (around line 975)

Add new endpoint:
```javascript
// Direct menu import - generates CSV internally and imports
router.post('/import-menu-direct', authMiddleware, async (req, res) => {
  const { restaurantId, menuId } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Direct Import] Request received:', { restaurantId, menuId, organisationId });

  if (!organisationId) {
    return res.status(401).json({ success: false, error: 'Organisation context required' });
  }

  if (!restaurantId || !menuId) {
    return res.status(400).json({ success: false, error: 'restaurantId and menuId are required' });
  }

  let tempFilePath = null;

  try {
    const { supabase } = require('../services/database-service');

    // Get restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Get account credentials
    const { data: pumpdRestaurant } = await supabase
      .from('pumpd_restaurants')
      .select('*, pumpd_accounts(email, user_password_hint)')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    const account = pumpdRestaurant?.pumpd_accounts;
    if (!account?.email || !account?.user_password_hint) {
      throw new Error('Restaurant account credentials not found');
    }

    // Generate CSV content internally
    console.log('[Direct Import] Generating CSV for menu:', menuId);
    const csvContent = await generateMenuCSVContent(menuId);

    // Write to temp file
    const tempDir = '/tmp/csv-uploads';
    await fs.mkdir(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, `direct-import-${Date.now()}-${restaurantId}.csv`);
    await fs.writeFile(tempFilePath, csvContent);

    console.log('[Direct Import] CSV written to:', tempFilePath);

    // Get script config
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);

    // Execute import script
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/import-csv-menu.js');
    const command = [
      'node', scriptPath,
      `--email="${account.email}"`,
      `--password="${account.user_password_hint}"`,
      `--name="${restaurant.name}"`,
      `--csvFile="${tempFilePath}"`,
      `--admin-url="${scriptConfig.adminUrl}"`
    ].join(' ');

    console.log('[Direct Import] Executing script...');
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false', HEADLESS: 'false' },
      timeout: 120000
    });

    console.log('[Direct Import] Script output:', stdout);
    if (stderr) console.error('[Direct Import] Script stderr:', stderr);

    const success = stdout.includes('CSV import completed successfully') ||
                   stdout.includes('✅') ||
                   stdout.includes('Successfully imported');

    if (success) {
      await supabase
        .from('restaurants')
        .update({ onboarding_status: 'menu_imported' })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);

      UsageTrackingService.trackRegistrationStep(organisationId, 'menu_upload', {
        restaurant_id: restaurantId,
        menu_id: menuId,
        method: 'direct_import'
      }).catch(err => console.error('[UsageTracking] Failed:', err));
    }

    res.json({
      success,
      message: success ? 'Menu imported successfully' : 'Import may have failed - check logs'
    });

  } catch (error) {
    console.error('[Direct Import] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Cleanup temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log('[Direct Import] Temp file cleaned up');
      } catch (err) {
        console.error('[Direct Import] Failed to cleanup:', err);
      }
    }
  }
});

// Helper function to generate CSV content
async function generateMenuCSVContent(menuId) {
  const db = require('../services/database-service');
  const menu = await db.getMenuWithItems(menuId);

  if (!menu) throw new Error('Menu not found');

  // CSV generation logic (extracted from server.js csv-with-cdn endpoint)
  const UNWANTED_PHRASES = ['Plus small', 'Thumb up outline', 'No. 1 most liked', 'No. 2 most liked', 'No. 3 most liked'];
  const REGEX_PATTERNS = [/\d+%/g, /\(\d+\)/g];

  function cleanField(value) {
    if (!value || typeof value !== 'string') return value || '';
    let cleaned = value;
    UNWANTED_PHRASES.forEach(phrase => { cleaned = cleaned.replace(new RegExp(phrase, 'g'), ''); });
    REGEX_PATTERNS.forEach(pattern => { cleaned = cleaned.replace(pattern, ''); });
    cleaned = cleaned.replace(/\r?\n/g, ' ').replace(/;\s*;/g, ';').replace(/,\s*,/g, ',');
    cleaned = cleaned.replace(/\s+/g, ' ').replace(/^\s*[;,]\s*/, '').replace(/\s*[;,]\s*$/, '');
    return cleaned.trim();
  }

  function escapeCSVField(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = [
    'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
    'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
    'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
    'displayName', 'printName', 'tags',
    'isCDNImage', 'imageCDNID', 'imageCDNFilename', 'imageExternalURL'
  ];

  const rows = [];

  if (menu.categories) {
    menu.categories.forEach(category => {
      if (category.menu_items) {
        category.menu_items.forEach(item => {
          let isCDNImage = 'FALSE', imageCDNID = '', imageCDNFilename = '';

          if (item.item_images?.length > 0) {
            const primaryImage = item.item_images.find(img => img.type === 'primary') || item.item_images[0];
            if (primaryImage?.cdn_uploaded && primaryImage?.cdn_id) {
              isCDNImage = 'TRUE';
              imageCDNID = primaryImage.cdn_id;
              imageCDNFilename = primaryImage.cdn_filename || '';
            }
          }

          rows.push([
            '', 'Menu', '', '',
            '', escapeCSVField(cleanField(category.name || 'Uncategorized')), '', '',
            '', escapeCSVField(cleanField(item.name || '')),
            escapeCSVField(item.price || ''),
            escapeCSVField(item.item_type || ''),
            escapeCSVField(cleanField(item.description || '')),
            '', '', '',
            isCDNImage, imageCDNID, imageCDNFilename, ''
          ].join(','));
        });
      }
    });
  }

  return [headers.join(','), ...rows].join('\n');
}
```

---

### Step 3: Add Frontend State Variables
**File**: `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
**Location**: Around line 280 (with other menu-related states)

Add:
```javascript
// Streamlined menu import states
const [selectedMenuForImport, setSelectedMenuForImport] = useState('');
const [importPhase, setImportPhase] = useState(null); // 'checking' | 'uploading' | 'importing'
```

---

### Step 4: Add Promise-Based CDN Upload Wait Function
**File**: `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
**Location**: After `handleDownloadCSVWithCDN` function (around line 3052)

Add:
```javascript
// Wait for CDN upload completion with promise-based polling
const waitForCdnUploadCompletion = async (menuId, maxWaitTime = 300000) => {
  const response = await api.post(`/menus/${menuId}/upload-images`);

  // Handle immediate completion
  if (!response.data.batchId) {
    return response.data.stats || { alreadyUploaded: true };
  }

  if (response.data.mode === 'synchronous') {
    return response.data.stats;
  }

  // Async mode - poll until complete
  const batchId = response.data.batchId;
  const pollInterval = 2000;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startTime > maxWaitTime) {
        reject(new Error('CDN upload timeout - please try again'));
        return;
      }

      try {
        const progressResponse = await api.get(`/upload-batches/${batchId}`);
        const batch = progressResponse.data.batch;

        if (batch.status === 'processing') {
          const uploaded = batch.progress?.uploaded || batch.uploaded_count || 0;
          const total = batch.progress?.total || batch.total_images || 0;
          toast({ title: "Uploading images...", description: `${uploaded}/${total} complete` });
          setTimeout(poll, pollInterval);
        } else if (batch.status === 'completed') {
          resolve({ successful: batch.uploaded_count, total: batch.total_images });
        } else if (batch.status === 'failed') {
          reject(new Error('CDN upload failed'));
        }
      } catch (error) {
        reject(new Error(`Upload status check failed: ${error.message}`));
      }
    };

    poll();
  });
};
```

---

### Step 5: Add Streamlined Import Handler
**File**: `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
**Location**: After the `waitForCdnUploadCompletion` function

Add:
```javascript
// Streamlined menu import - checks CDN, uploads if needed, then imports
const handleStreamlinedMenuImport = async () => {
  if (!selectedMenuForImport) {
    toast({ title: "Error", description: "Please select a menu", variant: "destructive" });
    return;
  }

  if (registrationStatus?.account?.registration_status !== 'completed' ||
      registrationStatus?.restaurant?.registration_status !== 'completed') {
    toast({ title: "Error", description: "Registration must be completed first", variant: "destructive" });
    return;
  }

  setIsUploading(true);
  setUploadStatus(null);
  setUploadError(null);

  try {
    // Phase 1: Check CDN status
    setImportPhase('checking');
    toast({ title: "Checking images...", description: "Verifying CDN upload status" });

    const statsResponse = await api.get(`/menus/${selectedMenuForImport}/cdn-stats`);
    const stats = statsResponse.data.stats;

    // Phase 2: Upload to CDN if needed
    if (stats.totalImages > 0 && stats.uploadPercentage < 100) {
      setImportPhase('uploading');
      toast({
        title: "Uploading images to CDN...",
        description: `${stats.totalImages - stats.uploadedImages} images need uploading`
      });

      await waitForCdnUploadCompletion(selectedMenuForImport);
      toast({ title: "Images uploaded!", description: "Proceeding with import..." });
    }

    // Phase 3: Import menu
    setImportPhase('importing');
    toast({ title: "Importing menu...", description: "This may take a minute" });

    const response = await railwayApi.post('/api/registration/import-menu-direct', {
      restaurantId: id,
      menuId: selectedMenuForImport
    });

    if (response.data.success) {
      setUploadStatus('success');
      setSelectedMenuForImport('');
      toast({ title: "Success!", description: "Menu imported successfully" });
      fetchRestaurantDetails();
    } else {
      throw new Error(response.data.error || 'Import failed');
    }

  } catch (error) {
    console.error('Streamlined import error:', error);
    setUploadStatus('error');
    setUploadError(error.message);
    toast({ title: "Import Failed", description: error.message, variant: "destructive" });
  } finally {
    setIsUploading(false);
    setImportPhase(null);
  }
};
```

---

### Step 6: Add UI Components
**File**: `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
**Location**: In Registration tab, before the existing CSV file input section (around line 5492)

Add the menu selector dropdown and import button:
```jsx
{/* Streamlined Menu Import */}
<div className="space-y-3 mb-6">
  <div className="flex items-center gap-2 text-sm font-medium">
    <FileSpreadsheet className="h-4 w-4" />
    Quick Menu Import
  </div>

  <Select
    value={selectedMenuForImport}
    onValueChange={setSelectedMenuForImport}
    disabled={isUploading}
  >
    <SelectTrigger className="w-full">
      <SelectValue placeholder="Select a menu to import..." />
    </SelectTrigger>
    <SelectContent>
      {restaurant?.menus && restaurant.menus.length > 0 ? (
        restaurant.menus.map((menu) => (
          <SelectItem key={menu.id} value={menu.id}>
            Version {menu.version} - {menu.platforms?.name || 'Unknown'}
            {menu.is_active && ' (Active)'}
          </SelectItem>
        ))
      ) : (
        <SelectItem value="none" disabled>
          No menus available
        </SelectItem>
      )}
    </SelectContent>
  </Select>

  <Button
    onClick={handleStreamlinedMenuImport}
    disabled={!selectedMenuForImport || isUploading}
    className="w-full"
  >
    {isUploading ? (
      <>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        {importPhase === 'checking' && 'Checking...'}
        {importPhase === 'uploading' && 'Uploading Images...'}
        {importPhase === 'importing' && 'Importing Menu...'}
        {!importPhase && 'Processing...'}
      </>
    ) : (
      <>
        <Upload className="h-4 w-4 mr-2" />
        Import Selected Menu
      </>
    )}
  </Button>

  <p className="text-xs text-muted-foreground">
    Automatically uploads images to CDN if needed, then imports the menu.
  </p>
</div>

<div className="border-t pt-4">
  <p className="text-sm text-muted-foreground mb-3">Or upload CSV manually:</p>
  {/* Existing file input section continues here */}
</div>
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `server.js` | Add `GET /api/menus/:id/cdn-stats` endpoint (~25 LOC) |
| `registration-routes.js` | Add `POST /import-menu-direct` endpoint + helper function (~120 LOC) |
| `RestaurantDetail.jsx` | Add state variables, 2 functions, UI components (~80 LOC) |

**Total**: ~225 lines of code

---

## Testing Checklist

- [ ] Menu with 0 images imports successfully (skips CDN check)
- [ ] Menu with all images already on CDN imports without upload
- [ ] Menu with pending images triggers CDN upload first
- [ ] CDN upload progress shows in toast notifications
- [ ] Import succeeds after CDN upload completes
- [ ] Error handling shows appropriate messages
- [ ] Manual CSV upload still works as fallback
- [ ] Registration status validation works correctly

---

## Rollback Plan

If issues arise:
1. New endpoints can be disabled without affecting existing functionality
2. Manual CSV upload path remains unchanged as fallback
3. Feature can be hidden behind feature flag if needed
