# Investigation Task 1: CSV Upload Flow & UI Structure

## Current UI Structure of the CSV Upload Section

The CSV upload section is located at **lines 5495-5615** in RestaurantDetail.jsx:

### Components:
1. **File Input Container (lines 5499-5532)**:
   - Label: "Select CSV File"
   - Input element with ID `csv-file-input` accepting `.csv` and `text/csv`
   - Clear button (X icon) when file selected
   - File info display showing filename and size in KB

2. **Upload Button (lines 5535-5551)**:
   - Primary button labeled "Upload Menu"
   - Shows spinner + "Uploading..." when `isUploading` is true
   - Disabled when no CSV file or while uploading

3. **Item Tags Feature (lines 5554-5580)** - feature flagged `'registration.itemTagUploading'`

4. **Status Messages (lines 5583-5615)**:
   - Success alert (green)
   - Error alert with message
   - Tags status alert

---

## Existing Option Sets Dropdown Pattern (Reference)

Location: **lines 5617-5695**

```jsx
<div className="border-t pt-4 mt-4">  // Separator
  <div className="space-y-3">         // Vertical spacing

    {/* Header with icon */}
    <div className="flex items-center gap-2 text-sm font-medium">
      <Settings2 className="h-4 w-4" />
      Add Option Sets from Menu
    </div>

    {/* Menu Dropdown */}
    <Select
      value={selectedMenuForOptionSets}
      onValueChange={setSelectedMenuForOptionSets}
      disabled={isAddingOptionSets}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a menu..." />
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

    {/* Button + Status */}
    ...
  </div>
</div>
```

**Key Components** (already imported):
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` (line 60)
- Icons from lucide-react (line 49)

---

## Current CSV Upload Handler Function

**Function**: `handleCsvUpload()` at **lines 817-888**

### Flow:
1. **Validation** (lines 818-843):
   - Check if `csvFile` exists
   - Verify account registration status
   - Verify restaurant registration status

2. **Upload State** (lines 845-847):
   - Set `isUploading = true`
   - Clear `uploadStatus` and `uploadError`

3. **API Call** (lines 849-854):
   - Create FormData with `csvFile` and `restaurantId`
   - POST to `/api/registration/upload-csv-menu`

4. **Success** (lines 856-866):
   - Set `uploadStatus = 'success'`
   - Clear file state
   - Show success toast

5. **Error** (lines 867-884):
   - Set error states
   - Show error toast

---

## Existing State Variables

**CSV-related** (lines 270-282):
```javascript
const [csvFile, setCsvFile] = useState(null);
const [uploadStatus, setUploadStatus] = useState(null);
const [isUploading, setIsUploading] = useState(false);
const [uploadError, setUploadError] = useState(null);
```

**Menu-related (Option Sets)**:
```javascript
const [selectedMenuForOptionSets, setSelectedMenuForOptionSets] = useState('');
const [isAddingOptionSets, setIsAddingOptionSets] = useState(false);
const [optionSetsStatus, setOptionSetsStatus] = useState(null);
```

---

## Recommended Placement for New Menu Selector

**Insert Location**: Between lines 5492 and 5493 (before current file input section)

### Proposed UI Structure:
```jsx
{/* NEW: Menu Selector for Streamlined Upload */}
<div className="space-y-2 mb-4">
  <Label>Select Menu to Import</Label>
  <Select
    value={selectedMenuForCsvUpload}
    onValueChange={setSelectedMenuForCsvUpload}
    disabled={isUploading || isCheckingCdn}
  >
    <SelectTrigger className="w-full">
      <SelectValue placeholder="Select a menu..." />
    </SelectTrigger>
    <SelectContent>
      {restaurant?.menus?.map((menu) => (
        <SelectItem key={menu.id} value={menu.id}>
          Version {menu.version} - {menu.platforms?.name || 'Unknown'}
          {menu.is_active && ' (Active)'}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* One-Click Import Button */}
  <Button
    onClick={handleStreamlinedMenuImport}
    disabled={!selectedMenuForCsvUpload || isUploading}
    className="w-full"
  >
    {isUploading ? (
      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
    ) : (
      <><Upload className="h-4 w-4 mr-2" /> Import Selected Menu</>
    )}
  </Button>
</div>

<div className="border-t pt-4 mt-4">
  <p className="text-sm text-muted-foreground mb-2">Or upload CSV manually:</p>
  {/* Existing file input section */}
</div>
```

---

## Required State Variable Additions

```javascript
// Add around line 280 with other menu-related states
const [selectedMenuForCsvUpload, setSelectedMenuForCsvUpload] = useState('');
const [isCheckingCdn, setIsCheckingCdn] = useState(false);
const [cdnUploadProgress, setCdnUploadProgress] = useState(null);
```

---

## Changes Needed to Upload Handler

### New Function: `handleStreamlinedMenuImport()`

```javascript
const handleStreamlinedMenuImport = async () => {
  if (!selectedMenuForCsvUpload) {
    toast({ title: "Error", description: "Please select a menu", variant: "destructive" });
    return;
  }

  // Validate registration status (same as current)
  if (!registrationStatus?.account?.registration_status === 'completed' ||
      !registrationStatus?.restaurant?.registration_status === 'completed') {
    toast({ title: "Error", description: "Registration must be completed first", variant: "destructive" });
    return;
  }

  setIsUploading(true);
  setUploadStatus(null);
  setUploadError(null);

  try {
    // Step 1: Check CDN status
    setIsCheckingCdn(true);
    const statsResponse = await api.get(`/menus/${selectedMenuForCsvUpload}/cdn-stats`);
    const stats = statsResponse.data.stats;
    setIsCheckingCdn(false);

    // Step 2: Upload to CDN if needed
    if (stats.uploadPercentage < 100 && stats.totalImages > 0) {
      toast({ title: "Uploading images...", description: "CDN upload required before import" });
      await waitForCdnUploadCompletion(selectedMenuForCsvUpload);
    }

    // Step 3: Call new streamlined import endpoint
    const response = await railwayApi.post('/api/registration/import-menu-direct', {
      restaurantId: id,
      menuId: selectedMenuForCsvUpload
    });

    if (response.data.success) {
      setUploadStatus('success');
      setSelectedMenuForCsvUpload('');
      toast({ title: "Success", description: "Menu imported successfully" });
    } else {
      throw new Error(response.data.error || 'Import failed');
    }
  } catch (error) {
    setUploadStatus('error');
    setUploadError(error.message);
    toast({ title: "Import Failed", description: error.message, variant: "destructive" });
  } finally {
    setIsUploading(false);
    setIsCheckingCdn(false);
  }
};
```

### Keep Existing `handleCsvUpload()` for Manual Fallback

No changes needed - keep as-is for users who prefer manual CSV upload.

---

## Summary

| Aspect | Details |
|--------|---------|
| **Insertion Point** | Line 5492 (before file input section) |
| **Pattern to Follow** | Option Sets dropdown (lines 5617-5695) |
| **New State Variables** | 3 (`selectedMenuForCsvUpload`, `isCheckingCdn`, `cdnUploadProgress`) |
| **New Function** | `handleStreamlinedMenuImport()` |
| **Existing Handler** | Keep `handleCsvUpload()` unchanged for manual fallback |
| **UI Components** | All already imported (Select, Button, Loader2, etc.) |
