# Extraction UX Implementation Roadmap

## Investigation Summary

### Premium Extraction Options - Confirmed Working

After investigation, the premium extraction options (`extractOptionSets` and `validateImages`) **ARE being properly used** in the backend.

**Note on Destructuring Defaults:**
The code uses `extractOptionSets = true` in destructuring, which might appear to always set `true`. However, JavaScript destructuring defaults **only apply when the value is `undefined`**, not when it's `false`:
```javascript
const { x = true } = { x: false };     // x is false
const { x = true } = { x: undefined }; // x is true
const { x = true } = {};               // x is true (undefined)
```

**Complete Data Flow - RestaurantDetail.jsx (verified working):**
1. `RestaurantDetail.jsx:144` - State initialized: `useState(true)`
2. `RestaurantDetail.jsx:7281-7296` - Checkbox updates state to `true`/`false`
3. `RestaurantDetail.jsx:2206-2207` - Explicitly sends boolean: `extractOptionSets: extractOptionSets`
4. `server.js:1817` - Receives from `req.body`, default only if undefined
5. `server.js:1855` - Passes to service: `extractOptionSets` (the actual value)
6. `premium-extraction-service.js:342` - Stores in `jobInfo.options` (original object)
7. `premium-extraction-service.js:536` - Checks: `if (options.extractOptionSets)` → skips if `false`
8. `premium-extraction-service.js:572` - Checks: `if (options.validateImages)` → skips if `false`

**Complete Data Flow - NewExtraction.jsx (verified working):**
1. `NewExtraction.jsx:41-42` - State initialized: `useState(true)` for both
2. `NewExtraction.jsx:573` - Checkbox: `onCheckedChange={setExtractOptionSets}` → sets `true`/`false`
3. `NewExtraction.jsx:599` - Checkbox: `onCheckedChange={setValidateImages}` → sets `true`/`false`
4. `NewExtraction.jsx:165-166` - Explicitly sends: `extractOptionSets, validateImages`
5. Same backend flow as above (server.js → premium-extraction-service.js)

**Conclusion:** Premium options UI should be KEPT on both pages as they are fully functional.

---

## Issues to Address

### Issue 1: Retry Button on Extractions Page Not Working (COMPLETED)

**Location:** `Extractions.jsx:216-225`

**Root Cause:** The retry endpoint (`server.js:4363-4434`) calls `startBackgroundExtraction` with empty categories `[]`:
```javascript
startBackgroundExtraction(
  newJobId,
  originalJob.url,
  [], // Empty categories!
  originalJob.restaurants?.name
);
```

When categories are empty, the extraction completes immediately without extracting anything.

**Resolution:** Comment out retry button with TODO explaining the fix needed.
**Status: (COMPLETED)**

---

### Issue 2: ExtractionDetail Page UI Overhaul

**Location:** `ExtractionDetail.jsx`

**Current Issues:**
- Basic UI with minimal visual design
- Category scan progress never updates
- No link to source menu URL
- No button to return to RestaurantDetail
- Poor extraction type indication
- Progress indicators are simplistic

**Required Improvements:**
1. Add external link to source URL (opens in new tab)
2. Add "Back to Restaurant" button
3. Clear premium vs standard extraction badge
4. Use `ExtractionProgressCard` component (already exists but unused)
5. Better progress visualization with phases
6. Show estimated time remaining

---

### Issue 3: RestaurantDetail Extraction Flow - Auto Navigation (COMPLETED)

**Location:** `RestaurantDetail.jsx:2230-2232`

**Current Flow:**
1. User clicks "Start Extraction" in dialog
2. API call starts extraction
3. User is immediately navigated to `/extractions/{jobId}`
4. User must manually navigate back to continue onboarding

**Desired Flow:**
1. User clicks "Start Extraction" in dialog
2. Show loading state on dialog
3. API call starts extraction
4. On success: toast notification, dialog closes, user stays on page
5. Recent Menus card shows new extraction with loading state
6. When extraction completes, Recent Menus refreshes to show new menu

**Status: (COMPLETED)**

---

## Implementation Plan

### Phase 1: Quick Fixes (Low Risk) (COMPLETED)

#### 1.1 Comment Out Retry Button
**File:** `src/pages/Extractions.jsx`

```jsx
// Lines 415-424: Comment out and add TODO
{/* extraction.status === 'failed' && (
  // TODO: Retry button disabled - the retry endpoint passes empty categories
  // which causes the extraction to complete immediately without extracting.
  // To fix: The retry endpoint needs to either:
  // 1. Re-scan categories from the URL before calling startBackgroundExtraction
  // 2. Store original categories in the job config and pass them on retry
  <Button
    size="sm"
    variant="ghost"
    onClick={() => handleRetry(extraction.job_id)}
    className="text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
  >
    <RefreshCw className="h-4 w-4" />
  </Button>
) */}
```

---

### Phase 2: ExtractionDetail Page Improvements

#### 2.1 Add Navigation Buttons and Links

**File:** `src/pages/ExtractionDetail.jsx`

Add after the header section (around line 880):

```jsx
{/* Navigation and Links */}
<div className="flex items-center gap-3 mb-4">
  <button
    onClick={() => navigate('/extractions')}
    className="flex items-center text-sm text-gray-500 hover:text-gray-700"
  >
    <ArrowLeftIcon className="h-4 w-4 mr-1" />
    Back to Extractions
  </button>

  {job?.restaurantId && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/restaurants/${job.restaurantId}`)}
    >
      <Building2Icon className="h-4 w-4 mr-1" />
      View Restaurant
    </Button>
  )}

  {job?.url && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open(job.url, '_blank')}
    >
      <ExternalLinkIcon className="h-4 w-4 mr-1" />
      View Source Menu
    </Button>
  )}
</div>
```

#### 2.2 Add Extraction Type Badge

In the Job Info section, add a clear badge:

```jsx
<div>
  <dt className="text-sm font-medium text-gray-500">Extraction Type</dt>
  <dd className="mt-1">
    <Badge className={isPremiumExtraction ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
      {isPremiumExtraction ? 'Premium Extraction' : 'Standard Extraction'}
    </Badge>
    {isPremiumExtraction && (
      <p className="text-xs text-muted-foreground mt-1">
        Includes option sets and image validation
      </p>
    )}
  </dd>
</div>
```

#### 2.3 Use ExtractionProgressCard Component

Replace the current inline progress UI with the existing `ExtractionProgressCard` component:

```jsx
import ExtractionProgressCard from '../components/extraction/ExtractionProgressCard';

// In the JSX, replace the progress indicator section with:
{(job.state === 'running' || job.status === 'running' || job.state === 'processing') && (
  <div className="sm:col-span-3">
    <ExtractionProgressCard
      extraction={job}
      progress={premiumProgress}
      isPremium={isPremiumExtraction}
      showDetails={true}
    />
  </div>
)}
```

---

### Phase 3: RestaurantDetail Extraction UX (Major Change) (COMPLETED)

#### 3.1 Add Extraction State for In-Progress Menus

**File:** `src/pages/RestaurantDetail.jsx`

Add new state variables:

```jsx
// Add near other state declarations (around line 175)
const [activeExtractions, setActiveExtractions] = useState([]);
const [extractionPolling, setExtractionPolling] = useState(null);
```

#### 3.2 Modify startPlatformExtraction Function

**Location:** Lines 2190-2246

Replace the current navigation logic:

```jsx
const startPlatformExtraction = async () => {
  if (!extractionConfig) return;

  setIsExtracting(true);
  setError(null);

  try {
    let response;

    if (extractionConfig.platform === 'ubereats' && extractionMode === 'premium') {
      response = await api.post('/extract-menu-premium', {
        storeUrl: extractionConfig.url,
        restaurantId: extractionConfig.restaurantId,
        restaurantName: extractionConfig.restaurantName,
        extractOptionSets: extractOptionSets,
        validateImages: validateImages,
        async: true
      });
    } else {
      response = await api.post('/extractions/start', {
        url: extractionConfig.url,
        platform: extractionConfig.platform,
        restaurantId: extractionConfig.restaurantId,
        extractionType: 'batch',
        options: {
          includeImages: true,
          generateCSV: true
        }
      });
    }

    if (response.data.success) {
      const jobId = response.data.jobId;
      const isPremium = !!response.data.statusUrl;

      // Add to active extractions (for showing loading state in Recent Menus)
      setActiveExtractions(prev => [...prev, {
        jobId,
        platform: extractionConfig.platformName,
        isPremium,
        status: 'running',
        startTime: Date.now()
      }]);

      // Show success toast
      toast({
        title: "Extraction started",
        description: (
          <div>
            <p>{isPremium ? 'Premium' : 'Standard'} extraction from {extractionConfig.platformName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Check Recent Menus for progress
            </p>
          </div>
        ),
      });

      // Close dialog - user stays on page
      setExtractionDialogOpen(false);

      // Start polling for extraction status
      startExtractionPolling(jobId, isPremium);
    }
  } catch (error) {
    console.error('Extraction error:', error);
    setError(error.response?.data?.error || error.message || 'Failed to start extraction');
    toast({
      title: "Extraction failed",
      description: error.response?.data?.error || error.message,
      variant: "destructive"
    });
  } finally {
    setIsExtracting(false);
  }
};
```

#### 3.3 Add Extraction Polling Function

Add new function after `startPlatformExtraction`:

```jsx
const startExtractionPolling = (jobId, isPremium) => {
  // Clear any existing polling
  if (extractionPolling) {
    clearInterval(extractionPolling);
  }

  const pollInterval = setInterval(async () => {
    try {
      let status;
      if (isPremium) {
        const response = await extractionAPI.getPremiumStatus(jobId);
        status = response.data.status;
      } else {
        const response = await api.get(`/extractions/${jobId}`);
        status = response.data.job?.status || response.data.job?.state;
      }

      // Update active extraction status
      setActiveExtractions(prev => prev.map(ext =>
        ext.jobId === jobId ? { ...ext, status } : ext
      ));

      // If completed or failed, stop polling and refresh restaurant data
      if (status === 'completed' || status === 'failed') {
        clearInterval(pollInterval);
        setExtractionPolling(null);

        // Remove from active extractions
        setActiveExtractions(prev => prev.filter(ext => ext.jobId !== jobId));

        // Refresh restaurant data to get new menu
        fetchRestaurant();

        toast({
          title: status === 'completed' ? "Extraction complete" : "Extraction failed",
          description: status === 'completed'
            ? "New menu has been added to Recent Menus"
            : "Check extraction details for more information",
          variant: status === 'completed' ? 'default' : 'destructive'
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 5000); // Poll every 5 seconds

  setExtractionPolling(pollInterval);
};

// Cleanup polling on unmount
useEffect(() => {
  return () => {
    if (extractionPolling) {
      clearInterval(extractionPolling);
    }
  };
}, [extractionPolling]);
```

#### 3.4 Update Recent Menus Card to Show Active Extractions

**Location:** Around line 3700

Modify the Recent Menus card to show active extractions:

```jsx
{/* Recent Menus */}
<Card>
  <CardHeader>
    <CardTitle>Recent Menus</CardTitle>
    <CardDescription>Latest menu versions for this restaurant</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Active Extractions */}
    {activeExtractions.length > 0 && (
      <div className="mb-4 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase">In Progress</Label>
        {activeExtractions.map((extraction) => (
          <div
            key={extraction.jobId}
            className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50 border-blue-200"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <div>
                <span className="text-sm font-medium">
                  {extraction.isPremium ? 'Premium' : 'Standard'} Extraction
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  from {extraction.platform}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                {extraction.status}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/extractions/${extraction.jobId}?poll=true`)}
                className="text-blue-600 hover:text-blue-700"
              >
                View Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Existing menus */}
    {restaurant?.menus && restaurant.menus.length > 0 ? (
      <div className="space-y-2">
        {/* ... existing menu rendering ... */}
      </div>
    ) : (
      activeExtractions.length === 0 && (
        <p className="text-sm text-muted-foreground">No menus found</p>
      )
    )}
  </CardContent>
</Card>
```

---

### Phase 4: Additional Enhancements (Optional)

#### 4.1 Add WebSocket Support for Real-Time Updates

Instead of polling, implement WebSocket connection for real-time extraction progress updates. This would require:
- Server-side WebSocket setup for broadcasting extraction events
- Client-side WebSocket connection in RestaurantDetail
- More responsive UI updates

#### 4.2 Extraction Queue Management

Add ability to:
- Queue multiple extractions
- Cancel in-progress extractions
- View all active extractions in a sidebar/modal

---

## Testing Checklist

### Phase 1 Tests
- [x] Retry button is hidden/commented out
- [x] No console errors on Extractions page

### Phase 2 Tests
- [ ] "View Restaurant" button navigates correctly
- [ ] "View Source Menu" opens URL in new tab
- [ ] Extraction type badge shows correctly
- [ ] Progress indicators update during extraction
- [ ] ExtractionProgressCard displays correctly

### Phase 3 Tests
- [ ] Extraction starts without navigating away from RestaurantDetail
- [ ] Toast notification shows on extraction start
- [ ] Active extraction appears in Recent Menus with loading state
- [ ] Polling correctly updates extraction status
- [ ] On completion, menu appears in Recent Menus
- [ ] On failure, appropriate error toast shows
- [ ] Multiple extractions can be tracked simultaneously
- [ ] Polling stops on component unmount

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Extractions.jsx` | Comment out retry button |
| `src/pages/ExtractionDetail.jsx` | Add navigation, badges, use ExtractionProgressCard |
| `src/pages/RestaurantDetail.jsx` | Add extraction state, modify navigation, update Recent Menus |

## Dependencies

- No new package dependencies required
- Existing `ExtractionProgressCard` component can be reused
- `extractionAPI` already has required endpoints

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Commenting retry button | Low | Clear TODO comment explains fix |
| ExtractionDetail UI updates | Low | Additive changes, no breaking changes |
| RestaurantDetail extraction flow | Medium | Requires thorough testing of polling logic |

---

## Estimated Effort

- Phase 1: 15 minutes
- Phase 2: 1-2 hours
- Phase 3: 2-3 hours
- Phase 4: 4-6 hours (if implemented)

**Total: 3-5 hours** (excluding Phase 4)
