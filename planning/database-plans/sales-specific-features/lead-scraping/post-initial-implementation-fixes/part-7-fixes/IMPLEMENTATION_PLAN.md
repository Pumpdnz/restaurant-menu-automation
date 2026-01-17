# Implementation Plan: Auto-Extraction After Lead Conversion

**Date**: 2025-12-20
**Status**: COMPLETED (2025-12-20)

---

## Executive Summary

This plan details how to automatically trigger premium menu extractions and branding extractions after leads are converted to restaurants and enrolled in sequences. The implementation leverages existing async job infrastructure for menu extraction and adds fire-and-forget capability for branding extraction.

---

## Key Findings Summary

| Area | Current State | Required Changes |
|------|---------------|------------------|
| Sequence Completion | No `onSuccess` callback | Add callback prop to modal |
| Premium Extraction | Full async support via jobs | Use existing API with `async: true` |
| Branding Extraction | Synchronous, requires field arrays | Fire without awaiting, pass all fields |
| UI Patterns | Established checkbox/toast patterns | Reuse existing components |

---

## Architecture Decision

### Approach: Fire-and-Forget with Optional Tracking

1. **Menu Extractions**: Use existing async job system - jobs persist to database and can be polled
2. **Branding Extractions**: Fire synchronous requests without awaiting - simpler, no job tracking needed
3. **User Feedback**: Toast notifications on start, optional polling for menu job progress

---

## Implementation Steps

### Phase 1: Modify BulkStartSequenceModal (15 mins)

**File:** `src/components/sequences/BulkStartSequenceModal.tsx`

#### Step 1.1: Add onSuccess Prop

```typescript
// Line ~20: Update interface
interface BulkStartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: BulkOperationResult, restaurants: Restaurant[]) => void;  // NEW
  restaurants: Restaurant[];
}

// Line ~35: Destructure new prop
export function BulkStartSequenceModal({
  open,
  onClose,
  onSuccess,  // NEW
  restaurants
}: BulkStartSequenceModalProps) {
```

#### Step 1.2: Call onSuccess After Completion

```typescript
// Line ~155 (after setOperationComplete(true))
setOperationComplete(true);

// NEW: Trigger post-sequence actions
if (onSuccess) {
  onSuccess(result, restaurants);
}
```

---

### Phase 2: Add Extraction Options Dialog (30 mins)

**File:** `src/components/leads/PendingLeadsTable.tsx`

#### Step 2.1: Add State for Extraction Options

```typescript
// Near line 100, add new state
const [showExtractionOptions, setShowExtractionOptions] = useState(false);
const [extractionOptions, setExtractionOptions] = useState<Set<string>>(
  new Set(['menu', 'images', 'optionSets', 'branding'])
);
const [isStartingExtractions, setIsStartingExtractions] = useState(false);
```

#### Step 2.2: Create Extraction Options Dialog Component

```tsx
// Add new dialog component (around line 900)
<Dialog open={showExtractionOptions} onOpenChange={setShowExtractionOptions}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Start Automatic Extractions</DialogTitle>
      <DialogDescription>
        Select which extractions to run for {convertedRestaurants.length} converted restaurants
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">
      {/* Menu Extraction Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Menu Extraction (UberEats)</h4>
        <p className="text-xs text-muted-foreground">
          {convertedRestaurants.filter(r => r.ubereats_url).length} restaurants have UberEats URLs
        </p>
        <div className="space-y-2 pl-4">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={extractionOptions.has('menu')}
              onCheckedChange={() => toggleExtractionOption('menu')}
              disabled={!convertedRestaurants.some(r => r.ubereats_url)}
            />
            <span className="text-sm">Extract Menu Items</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={extractionOptions.has('images')}
              onCheckedChange={() => toggleExtractionOption('images')}
              disabled={!extractionOptions.has('menu')}
            />
            <span className="text-sm">Validate & Download Images</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={extractionOptions.has('optionSets')}
              onCheckedChange={() => toggleExtractionOption('optionSets')}
              disabled={!extractionOptions.has('menu')}
            />
            <span className="text-sm">Extract Option Sets</span>
          </label>
        </div>
      </div>

      {/* Branding Extraction Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Branding Extraction (Website)</h4>
        <p className="text-xs text-muted-foreground">
          {convertedRestaurants.filter(r => r.website_url).length} restaurants have website URLs
        </p>
        <div className="space-y-2 pl-4">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={extractionOptions.has('branding')}
              onCheckedChange={() => toggleExtractionOption('branding')}
              disabled={!convertedRestaurants.some(r => r.website_url)}
            />
            <span className="text-sm">Extract Logo, Colors & Favicon</span>
          </label>
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowExtractionOptions(false)}>
        Skip Extractions
      </Button>
      <Button
        onClick={handleStartExtractions}
        disabled={extractionOptions.size === 0 || isStartingExtractions}
      >
        {isStartingExtractions ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting...
          </>
        ) : (
          `Start ${extractionOptions.size} Extraction${extractionOptions.size !== 1 ? 's' : ''}`
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Step 2.3: Add Toggle Function

```typescript
const toggleExtractionOption = (option: string) => {
  setExtractionOptions(prev => {
    const next = new Set(prev);
    if (next.has(option)) {
      next.delete(option);
      // If removing menu, also remove dependent options
      if (option === 'menu') {
        next.delete('images');
        next.delete('optionSets');
      }
    } else {
      next.add(option);
    }
    return next;
  });
};
```

---

### Phase 3: Implement Extraction Trigger Function (30 mins)

**File:** `src/components/leads/PendingLeadsTable.tsx`

#### Step 3.1: Add Extraction Handler

```typescript
const handleStartExtractions = async () => {
  setIsStartingExtractions(true);

  try {
    const menuJobs: string[] = [];
    const brandingResults: { success: number; failed: number } = { success: 0, failed: 0 };

    // 1. Start menu extractions (async jobs)
    if (extractionOptions.has('menu')) {
      const restaurantsWithUberEats = convertedRestaurants.filter(r => r.ubereats_url);

      for (const restaurant of restaurantsWithUberEats) {
        try {
          const response = await api.post('/api/extract-menu-premium', {
            storeUrl: restaurant.ubereats_url,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            async: true,
            extractOptionSets: extractionOptions.has('optionSets'),
            validateImages: extractionOptions.has('images'),
          });

          if (response.data.jobId) {
            menuJobs.push(response.data.jobId);
          }
        } catch (error) {
          console.error(`Menu extraction failed for ${restaurant.name}:`, error);
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 2. Start branding extractions (fire and forget)
    if (extractionOptions.has('branding')) {
      const restaurantsWithWebsite = convertedRestaurants.filter(r => r.website_url);

      for (const restaurant of restaurantsWithWebsite) {
        // Fire without awaiting - true fire and forget
        api.post('/api/website-extraction/branding', {
          restaurantId: restaurant.id,
          sourceUrl: restaurant.website_url,
          previewOnly: false,
          versionsToUpdate: [
            'logo_url', 'logo_nobg_url', 'logo_standard_url',
            'logo_thermal_url', 'logo_thermal_alt_url', 'logo_thermal_contrast_url',
            'logo_thermal_adaptive_url', 'logo_favicon_url'
          ],
          colorsToUpdate: [
            'primary_color', 'secondary_color', 'tertiary_color',
            'accent_color', 'background_color', 'theme'
          ],
          headerFieldsToUpdate: [
            'website_og_image', 'website_og_title', 'website_og_description'
          ]
        }).then(() => {
          brandingResults.success++;
        }).catch((error) => {
          console.error(`Branding extraction failed for ${restaurant.name}:`, error);
          brandingResults.failed++;
        });
      }
    }

    // 3. Show success toast
    const messages: string[] = [];
    if (menuJobs.length > 0) {
      messages.push(`${menuJobs.length} menu extraction${menuJobs.length !== 1 ? 's' : ''}`);
    }
    if (extractionOptions.has('branding')) {
      const brandingCount = convertedRestaurants.filter(r => r.website_url).length;
      messages.push(`${brandingCount} branding extraction${brandingCount !== 1 ? 's' : ''}`);
    }

    toast.success('Extractions started!', {
      description: `Started ${messages.join(' and ')} in background`,
    });

    // Close dialog
    setShowExtractionOptions(false);

  } catch (error) {
    toast.error('Failed to start extractions', {
      description: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    setIsStartingExtractions(false);
  }
};
```

---

### Phase 4: Connect Sequence Completion to Extraction Dialog (15 mins)

**File:** `src/components/leads/PendingLeadsTable.tsx`

#### Step 4.1: Add onSuccess Handler for Sequence Modal

```typescript
// Near the BulkStartSequenceModal usage (around line 888)
const handleSequenceSuccess = (result: BulkOperationResult, restaurants: Restaurant[]) => {
  // Only show extraction options if there are successful sequences
  if (result.summary.success > 0) {
    // Update converted restaurants with the ones that successfully started sequences
    const successfulRestaurantIds = new Set(result.succeeded.map(s => s.restaurant_id));
    const eligibleRestaurants = restaurants.filter(r => successfulRestaurantIds.has(r.id));

    // Check if any have extractable URLs
    const hasUberEats = eligibleRestaurants.some(r => r.ubereats_url);
    const hasWebsite = eligibleRestaurants.some(r => r.website_url);

    if (hasUberEats || hasWebsite) {
      setConvertedRestaurants(eligibleRestaurants);
      setShowExtractionOptions(true);
    }
  }
};
```

#### Step 4.2: Update BulkStartSequenceModal Usage

```tsx
<BulkStartSequenceModal
  open={isSequenceModalOpen}
  onClose={() => setIsSequenceModalOpen(false)}
  onSuccess={handleSequenceSuccess}  // NEW
  restaurants={convertedRestaurants}
/>
```

---

### Phase 5: Add Restaurant URL Data to Converted Restaurants (10 mins)

**File:** `src/components/leads/PendingLeadsTable.tsx`

#### Step 5.1: Update handleConvertSelected to Include URLs

```typescript
// In handleConvertSelected (around line 400), update the successfulConversions mapping
const successfulConversions = results
  .filter(r => r.success && r.restaurantId)
  .map(r => {
    // Find the original lead to get URLs
    const originalLead = selectedLeadsData.find(l => l.id === r.leadId);
    return {
      id: r.restaurantId!,
      name: r.restaurantName,
      lead_stage: 'uncontacted' as const,
      lead_warmth: 'frozen' as const,
      lead_status: 'inactive' as const,
      // Include URLs for extraction
      ubereats_url: originalLead?.store_link || null,
      website_url: originalLead?.website_url || null,
    };
  });
```

---

## Flow Diagram

```
User selects leads
        ↓
Click "Convert Selected"
        ↓
Conversion Dialog shows progress
        ↓
Conversion complete → Results shown
        ↓
Click "Start Sequence"
        ↓
BulkStartSequenceModal opens
        ↓
User selects sequence & starts
        ↓
Sequences created → onSuccess callback fires
        ↓
Extraction Options Dialog opens (if URLs available)
        ↓
User selects extraction options
        ↓
Click "Start Extractions"
        ↓
Menu jobs created (async) + Branding fired (no await)
        ↓
Toast: "Extractions started in background"
        ↓
User continues with other tasks
```

---

## Testing Checklist

- [ ] Convert leads without UberEats URLs - extraction dialog should not offer menu options
- [ ] Convert leads without website URLs - extraction dialog should not offer branding options
- [ ] Convert leads with both URLs - both options should be available
- [ ] Start sequence then skip extractions - should close cleanly
- [ ] Start menu extraction only - verify job created and polling works
- [ ] Start branding extraction only - verify branding applied to restaurant
- [ ] Start both extractions - verify both work in parallel
- [ ] Cancel sequence modal before completion - extraction dialog should not appear
- [ ] Error during extraction start - toast error should appear

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Modal Props | 15 mins | None |
| Phase 2: Extraction Dialog | 30 mins | Phase 1 |
| Phase 3: Extraction Handler | 30 mins | Phase 2 |
| Phase 4: Connect Flow | 15 mins | Phases 1-3 |
| Phase 5: URL Data | 10 mins | Phase 4 |
| **Total** | **~100 mins** | |

---

## Future Enhancements

1. **Progress Tracking**: Add a "Background Jobs" panel to show running extractions
2. **Batch Branding Endpoint**: Create `/api/website-extraction/branding/batch` for better error handling
3. **Extraction Queue**: Add rate-limited queue for large batches (10+ restaurants)
4. **Retry Failed**: Add button to retry failed extractions from conversion results
