# Investigation Task 3: CDN Safeguard Flow

## How Current CDN Upload + Polling Works

### Location: `handleUploadImagesToCDN(menuId)` - RestaurantDetail.jsx:2942-3026

### Initial Upload Request
```javascript
const response = await api.post(`/menus/${menuId}/upload-images`);
```

**Returns**:
```javascript
{
  success: boolean,
  mode: 'synchronous' | 'asynchronous',
  batchId: string | undefined,
  stats: { totalImages, successful, failed, alreadyUploaded },
  message: string
}
```

### Three Possible Outcomes:

1. **No images to upload** → Returns immediately with stats (no batchId)
2. **Synchronous mode** (≤10 images) → Processes all, returns results immediately
3. **Asynchronous mode** (>10 images) → Returns batchId, starts background processing

### Polling Mechanism (Async Mode)

```javascript
const pollInterval = setInterval(async () => {
  const progressResponse = await api.get(`/upload-batches/${batchId}`);
  const batch = progressResponse.data.batch;

  if (batch.status === 'completed') {
    clearInterval(pollInterval);
    toast({ title: "Upload complete!", description: `${batch.uploaded_count} images` });
    fetchRestaurantDetails();
  } else if (batch.status === 'failed') {
    clearInterval(pollInterval);
    toast({ title: "Upload failed", variant: "destructive" });
  } else if (batch.status === 'processing') {
    toast({ title: "Uploading...", description: `${uploaded}/${total}` });
  }
}, 2000);  // Every 2 seconds
```

### Problem for Streamlined Flow
The current function doesn't return a promise that resolves when upload completes - it just sets up polling and returns immediately.

---

## Pattern for "Check CDN → Upload → Wait → Generate CSV → Import"

### Required Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. CHECK PHASE                                         │
│     GET /api/menus/{menuId}/cdn-stats                   │
│     → Returns { uploadPercentage, totalImages, ... }    │
│                                                         │
│     IF uploadPercentage === 100 OR totalImages === 0    │
│       → Skip to GENERATE phase                          │
│     ELSE                                                │
│       → Continue to UPLOAD phase                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. UPLOAD PHASE                                        │
│     POST /api/menus/{menuId}/upload-images              │
│     → IF mode === 'synchronous': done immediately       │
│     → IF mode === 'asynchronous': wait for completion   │
│                                                         │
│     WAIT using promise-wrapped polling                  │
│     → Poll GET /api/upload-batches/{batchId}            │
│     → Resolve when status === 'completed'               │
│     → Reject when status === 'failed' or timeout        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. GENERATE & IMPORT PHASE                             │
│     POST /api/registration/import-menu-direct           │
│     → { restaurantId, menuId }                          │
│     → Backend generates CSV internally                  │
│     → Backend runs import script                        │
│     → Returns success/error                             │
└─────────────────────────────────────────────────────────┘
```

---

## Required Promise/Async Flow Changes

### Current Issue
`handleUploadImagesToCDN()` is async but doesn't wait for completion:
- Uses `setInterval()` for polling (fire-and-forget)
- Returns immediately after starting poll

### Solution: Create Promise-Wrapped Polling Function

```javascript
/**
 * Waits for CDN upload completion with promise-based polling
 * @returns Promise that resolves with upload stats or rejects on failure
 */
const waitForCdnUploadCompletion = async (menuId, maxWaitTime = 300000) => {
  // Step 1: Initiate upload
  const response = await api.post(`/menus/${menuId}/upload-images`);

  // Handle immediate completion (no images or sync mode)
  if (!response.data.batchId) {
    return response.data.stats;
  }

  if (response.data.mode === 'synchronous') {
    return response.data.stats;
  }

  // Step 2: Async mode - poll until complete
  const batchId = response.data.batchId;
  const pollInterval = 2000;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        reject(new Error('CDN upload timeout - please try again'));
        return;
      }

      try {
        const progressResponse = await api.get(`/upload-batches/${batchId}`);
        const batch = progressResponse.data.batch;

        // Update progress toast
        if (batch.status === 'processing') {
          const uploaded = batch.progress?.uploaded || batch.uploaded_count || 0;
          const total = batch.progress?.total || batch.total_images || 0;
          toast({
            title: "Uploading images...",
            description: `${uploaded}/${total} complete`
          });
          setTimeout(poll, pollInterval);

        } else if (batch.status === 'completed') {
          resolve({
            successful: batch.uploaded_count,
            failed: batch.failed_count,
            total: batch.total_images
          });

        } else if (batch.status === 'failed') {
          reject(new Error('CDN upload failed - some images could not be uploaded'));
        }

      } catch (error) {
        reject(new Error(`Failed to check upload status: ${error.message}`));
      }
    };

    // Start polling
    poll();
  });
};
```

### Reference Pattern from Codebase

From `uploadcare-service.js`:
```javascript
async waitForUploadCompletion(token, maxWaitTime = 60000) {
  const pollInterval = 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    // Poll endpoint
    // Check if complete/failed
    // Return or throw
    await this.sleep(pollInterval);
  }
  throw new Error('Upload timeout');
}
```

---

## Complete Streamlined Import Handler

```javascript
const handleStreamlinedMenuImport = async () => {
  if (!selectedMenuForCsvUpload) {
    toast({ title: "Error", description: "Please select a menu", variant: "destructive" });
    return;
  }

  // Validation (same as current)
  if (registrationStatus?.account?.registration_status !== 'completed' ||
      registrationStatus?.restaurant?.registration_status !== 'completed') {
    toast({ title: "Error", description: "Registration must be completed first", variant: "destructive" });
    return;
  }

  setIsUploading(true);
  setUploadStatus(null);
  setUploadError(null);

  try {
    // ═══════════════════════════════════════════════════════
    // PHASE 1: CHECK CDN STATUS
    // ═══════════════════════════════════════════════════════
    toast({ title: "Checking images...", description: "Verifying CDN upload status" });

    const statsResponse = await api.get(`/menus/${selectedMenuForCsvUpload}/cdn-stats`);
    const stats = statsResponse.data.stats;

    // ═══════════════════════════════════════════════════════
    // PHASE 2: UPLOAD TO CDN IF NEEDED
    // ═══════════════════════════════════════════════════════
    if (stats.totalImages > 0 && stats.uploadPercentage < 100) {
      toast({
        title: "Uploading images to CDN...",
        description: `${stats.pendingUploads} images need uploading`
      });

      await waitForCdnUploadCompletion(selectedMenuForCsvUpload);

      toast({ title: "Images uploaded!", description: "Proceeding with import..." });
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 3: IMPORT MENU
    // ═══════════════════════════════════════════════════════
    toast({ title: "Importing menu...", description: "This may take a minute" });

    const response = await railwayApi.post('/api/registration/import-menu-direct', {
      restaurantId: id,
      menuId: selectedMenuForCsvUpload
    });

    if (response.data.success) {
      setUploadStatus('success');
      setSelectedMenuForCsvUpload('');
      toast({ title: "Success!", description: "Menu imported successfully" });
    } else {
      throw new Error(response.data.error || 'Import failed');
    }

  } catch (error) {
    console.error('Streamlined import error:', error);
    setUploadStatus('error');
    setUploadError(error.message);
    toast({
      title: "Import Failed",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setIsUploading(false);
  }
};
```

---

## Progress Feedback UI Considerations

### Phase-Based Toast Messages

| Phase | Title | Description |
|-------|-------|-------------|
| Check | "Checking images..." | "Verifying CDN upload status" |
| Upload (start) | "Uploading images to CDN..." | "X images need uploading" |
| Upload (progress) | "Uploading images..." | "X/Y complete" |
| Upload (done) | "Images uploaded!" | "Proceeding with import..." |
| Import | "Importing menu..." | "This may take a minute" |
| Success | "Success!" | "Menu imported successfully" |
| Error | "Import Failed" | `{error.message}` |

### Loading State Management

```javascript
// State variables
const [isUploading, setIsUploading] = useState(false);
const [uploadPhase, setUploadPhase] = useState(null); // 'checking' | 'uploading' | 'importing'

// UI Button
<Button disabled={!selectedMenuForCsvUpload || isUploading}>
  {isUploading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      {uploadPhase === 'checking' && 'Checking...'}
      {uploadPhase === 'uploading' && 'Uploading Images...'}
      {uploadPhase === 'importing' && 'Importing...'}
    </>
  ) : (
    <><Upload className="h-4 w-4 mr-2" /> Import Selected Menu</>
  )}
</Button>
```

---

## Error Handling Patterns

### Existing Pattern in Codebase
```javascript
// From RestaurantDetail.jsx:2751-2753
} catch (error) {
  console.error('Polling error:', error);
  clearInterval(pollInterval);
  toast({
    title: "Progress check failed",
    description: "Could not check upload status",
    variant: "destructive"
  });
}
```

### Recommended Error Handling
```javascript
try {
  // ... operation
} catch (error) {
  // Log for debugging
  console.error('Phase failed:', phase, error);

  // User-friendly message
  const userMessage = {
    'checking': 'Failed to check image status',
    'uploading': 'Image upload failed',
    'importing': 'Menu import failed'
  }[phase] || 'Operation failed';

  toast({
    title: userMessage,
    description: error.message,
    variant: "destructive"
  });

  throw error; // Re-throw for outer handler
}
```

---

## Timeout & Cleanup Considerations

### Recommended Timeouts

| Phase | Timeout | Rationale |
|-------|---------|-----------|
| CDN Stats Check | 10 seconds | Simple DB query |
| CDN Upload (async) | 5 minutes | Large batches may take time |
| Menu Import | 2 minutes | Script execution (already set) |

### Component Unmount Cleanup

```javascript
useEffect(() => {
  return () => {
    // Clear any active polling intervals on unmount
    if (cdnPollIntervalRef.current) {
      clearInterval(cdnPollIntervalRef.current);
    }
  };
}, []);
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Core Pattern** | Promise-wrapped polling for CDN upload |
| **New Function** | `waitForCdnUploadCompletion(menuId)` |
| **Phases** | Check → Upload (if needed) → Import |
| **Progress UI** | Phase-based toast messages |
| **Timeout** | 5 minutes for CDN upload, 2 minutes for import |
| **Error Handling** | Per-phase messages with retry guidance |
| **Cleanup** | Clear intervals on unmount |

The key insight is converting the event-driven `setInterval` polling to a promise-based awaitable function, enabling clean sequential execution of the multi-phase flow.
