# Investigation Task 2: Backend Infrastructure

## Current CDN Stats API Availability

### Database Function Exists
**Location**: `database-service.js:3229-3273`

```javascript
async function getMenuCDNStats(menuId) {
  // Returns:
  {
    totalImages: number,
    uploadedImages: number,
    failedUploads: number,
    pendingUploads: number,
    uploadPercentage: number // 0-100
  }
}
```

### API Endpoint Status: **NOT EXPOSED**

The function is used internally in `/api/menus/:id/upload-images` (server.js:2717-2727) but there is **NO dedicated GET endpoint** to retrieve CDN stats.

---

## New CDN Stats Endpoint Needed: YES

### Recommended New Endpoint

```javascript
// Add to server.js
app.get('/api/menus/:id/cdn-stats', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Effort**: ~20 lines of code

---

## CSV Generation Endpoint Analysis

### Existing Endpoint: `GET /api/menus/:id/csv-with-cdn`
**Location**: server.js:3987-4211

**Key Capability**: Already supports returning CSV as JSON (not just file download)

```javascript
// Query parameter: download=true/false

// When download=false, returns:
{
  success: true,
  csvData: string,        // Full CSV content
  filename: string,
  stats: {
    totalItems: number,
    itemsWithCDN: number,
    itemsWithoutCDN: number,
    itemsWithoutImages: number,
    cdnPercentage: number
  },
  message: string
}
```

**This means**: Frontend can get CSV text without downloading a file!

---

## CSV Upload Endpoint Analysis

### Current Endpoint: `POST /api/registration/upload-csv-menu`
**Location**: registration-routes.js:798-975

**Current Requirements**:
- Uses `multer` middleware for file upload
- Expects FormData with `csvFile` (actual file) and `restaurantId`
- Saves file to `/tmp/csv-uploads/`
- Runs `import-csv-menu.js` script with file path
- Cleans up temp file after execution

**Script Execution**:
```javascript
const command = [
  'node', scriptPath,
  `--email="${account.email}"`,
  `--password="${account.user_password_hint}"`,
  `--name="${restaurant.name}"`,
  `--csvFile="${csvFile.path}"`,  // Requires file path
  `--admin-url="${scriptConfig.adminUrl}"`
].join(' ');
```

---

## Options for Generating/Passing CSV Without User Download

### Option 1: New Endpoint that Generates CSV Internally (RECOMMENDED)

**New Endpoint**: `POST /api/registration/import-menu-direct`

```javascript
router.post('/import-menu-direct', authMiddleware, async (req, res) => {
  const { restaurantId, menuId } = req.body;

  try {
    // 1. Generate CSV content internally
    const csvContent = await generateMenuCSVWithCDN(menuId);

    // 2. Write to temp file
    const tempPath = `/tmp/csv-uploads/temp-${Date.now()}-${restaurantId}.csv`;
    await fs.writeFile(tempPath, csvContent);

    // 3. Get restaurant/account details (existing code)
    const { restaurant, account } = await getRestaurantAndAccount(restaurantId);

    // 4. Execute import script (existing pattern)
    const command = buildImportCommand(account, restaurant, tempPath);
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });

    // 5. Cleanup temp file
    await fs.unlink(tempPath);

    // 6. Return success
    res.json({ success: true, message: 'Menu imported successfully' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Advantages**:
- No frontend file handling needed
- Reuses existing script infrastructure
- Minimal changes to existing code

### Option 2: Accept Base64-Encoded CSV

Frontend converts CSV text to base64, sends to backend which decodes and writes to temp file.

**Less recommended** - adds unnecessary encoding/decoding step.

### Option 3: Accept CSV Text Directly

Frontend sends raw CSV text in request body.

**Concern**: Large CSVs could hit request size limits.

---

## Required Backend Modifications

### Priority 1: Create CDN Stats Endpoint
**File**: server.js
**Effort**: ~20 LOC

```javascript
app.get('/api/menus/:id/cdn-stats', authMiddleware, async (req, res) => {
  const stats = await db.getMenuCDNStats(req.params.id);
  res.json({ success: true, stats });
});
```

### Priority 2: Create Direct Import Endpoint
**File**: registration-routes.js
**Effort**: ~60 LOC

Key steps:
1. Accept `{ restaurantId, menuId }` in body
2. Call internal CSV generation logic (extract from server.js:4014-4160)
3. Write CSV to temp file
4. Execute existing import script
5. Clean up temp file
6. Return result

### Priority 3: Extract CSV Generation Logic
**Current Location**: server.js:4014-4160 (inline in endpoint)

Refactor to standalone function:
```javascript
async function generateMenuCSVWithCDN(menuId) {
  const menu = await db.getMenuWithItems(menuId);
  // ... cleaning logic, row building ...
  return csvContent;
}
```

---

## Implementation Architecture

```
Frontend Flow:
  1. User selects menu from dropdown
  2. GET /api/menus/{menuId}/cdn-stats
  3. If uploadPercentage < 100:
     → POST /api/menus/{menuId}/upload-images
     → Poll until complete
  4. POST /api/registration/import-menu-direct
     → { restaurantId, menuId }
  5. Display success/error

Backend Flow (new endpoint):
  1. Receive { restaurantId, menuId }
  2. Get restaurant + account details
  3. Generate CSV internally (no user involvement)
  4. Write CSV to /tmp/csv-uploads/
  5. Execute import-csv-menu.js script
  6. Clean up temp file
  7. Return result
```

---

## Key Code Locations

| Purpose | File | Lines |
|---------|------|-------|
| CSV Generation Logic | server.js | 4014-4160 |
| File Upload Handler | registration-routes.js | 798-975 |
| Import Script | import-csv-menu.js | 538-588 |
| Temp File Cleanup | registration-routes.js | 922-927 |
| CDN Stats Function | database-service.js | 3229-3273 |

---

## Summary

| Item | Status | Action Required |
|------|--------|-----------------|
| CDN Stats Function | EXISTS | None |
| CDN Stats API | MISSING | Create `GET /api/menus/:id/cdn-stats` |
| CSV Generation | EXISTS (inline) | Extract to reusable function |
| Direct Import Endpoint | MISSING | Create `POST /api/registration/import-menu-direct` |
| File Cleanup | EXISTS | Reuse existing pattern |

**Total Backend Effort**: ~100 LOC across 2 files
