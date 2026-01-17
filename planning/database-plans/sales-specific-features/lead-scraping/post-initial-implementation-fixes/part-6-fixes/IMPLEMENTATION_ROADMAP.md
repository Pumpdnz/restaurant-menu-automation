# Implementation Roadmap: Lead Conversion UX Improvements

**Date**: 2025-12-16
**Status**: READY TO IMPLEMENT
**Target File**: `src/components/leads/PendingLeadsTable.tsx`

---

## Pre-Implementation Checklist

- [x] Verified `ConversionResult` interface has `restaurantId` field (line 131)
- [x] Verified `BulkStartSequenceModal` component exists and is functional
- [x] Verified `/restaurants/:id` route exists in the application
- [x] Verified `react-router-dom` is installed and used elsewhere

---

## Step-by-Step Implementation

### Step 1: Add Required Imports

**Location**: Top of file (lines 1-48)

Add these two imports:

```typescript
// After line 1 (with other react imports)
import { Link } from 'react-router-dom';

// After line 48 (after LeadDetailModal import)
import { BulkStartSequenceModal } from '../sequences/BulkStartSequenceModal';
```

---

### Step 2: Add State Variables

**Location**: After line 148 (after existing modal states)

Add two new state variables:

```typescript
const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
const [convertedRestaurants, setConvertedRestaurants] = useState<Array<{
  id: string;
  name: string;
  lead_stage?: string;
  lead_warmth?: string;
  lead_status?: string;
}>>([]);
```

---

### Step 3: Capture Converted Restaurants After Bulk Conversion

**Location**: Inside `handleConvertSelected` function, after line 245 (`setConversionResults(results);`)

Add logic to capture successful conversions:

```typescript
// Capture converted restaurants for sequence enrollment
const successfulConversions = results
  .filter(r => r.success && r.restaurantId)
  .map(r => ({
    id: r.restaurantId!,
    name: r.restaurantName,
    lead_stage: 'uncontacted',
    lead_warmth: 'frozen',
    lead_status: 'inactive'
  }));
setConvertedRestaurants(successfulConversions);
```

---

### Step 4: Capture Converted Restaurant After Single Conversion

**Location**: Inside `handleConvertSingle` function, after line 283 (inside the try block, after `setConversionResults`)

Add logic to capture the single successful conversion:

```typescript
// Capture converted restaurant for sequence enrollment
if (response.results?.[0]?.restaurant_id) {
  setConvertedRestaurants([{
    id: response.results[0].restaurant_id,
    name: lead.restaurant_name,
    lead_stage: 'uncontacted',
    lead_warmth: 'frozen',
    lead_status: 'inactive'
  }]);
}
```

---

### Step 5: Make Restaurant Names Clickable

**Location**: Lines 602-604 (inside the conversion results map)

Replace the plain `<span>` with conditional `<Link>`:

**Current code:**
```tsx
<span className="text-sm font-medium">
  {result.restaurantName}
</span>
```

**New code:**
```tsx
{result.success && result.restaurantId ? (
  <Link
    to={`/restaurants/${result.restaurantId}`}
    className="text-sm font-medium text-primary hover:underline"
    onClick={(e) => e.stopPropagation()}
  >
    {result.restaurantName}
  </Link>
) : (
  <span className="text-sm font-medium">
    {result.restaurantName}
  </span>
)}
```

---

### Step 6: Update Dialog Footer with Sequence Button

**Location**: Lines 620-626 (DialogFooter section)

Replace the existing DialogFooter with dual-button layout:

**Current code:**
```tsx
{!isConverting && (
  <DialogFooter>
    <Button onClick={() => setIsConversionDialogOpen(false)}>
      Close
    </Button>
  </DialogFooter>
)}
```

**New code:**
```tsx
{!isConverting && (
  <DialogFooter className="flex justify-between sm:justify-between">
    {conversionSummary.successful > 0 && (
      <Button
        variant="outline"
        onClick={() => {
          setIsSequenceModalOpen(true);
          setIsConversionDialogOpen(false);
        }}
      >
        Start Sequence ({conversionSummary.successful})
      </Button>
    )}
    <Button onClick={() => setIsConversionDialogOpen(false)}>
      Close
    </Button>
  </DialogFooter>
)}
```

---

### Step 7: Add BulkStartSequenceModal Component

**Location**: After line 628 (after the Conversion Dialog, before the closing `</div>`)

Add the sequence modal:

```tsx
{/* Sequence Enrollment Modal */}
<BulkStartSequenceModal
  open={isSequenceModalOpen}
  onClose={() => {
    setIsSequenceModalOpen(false);
    setConvertedRestaurants([]);
  }}
  restaurants={convertedRestaurants}
/>
```

---

## Post-Implementation Testing

### Test Cases

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Convert single lead successfully | Restaurant name is clickable link |
| 2 | Click restaurant link | Navigates to `/restaurants/{id}` |
| 3 | Convert multiple leads | All successful names are clickable |
| 4 | Convert with some failures | Failed items show error (no link) |
| 5 | Click "Start Sequence" button | BulkStartSequenceModal opens |
| 6 | Verify modal shows correct count | Modal title shows correct restaurant count |
| 7 | Select template and start | Sequences created for converted restaurants |
| 8 | Close sequence modal | State resets (`convertedRestaurants` cleared) |

---

## Rollback Plan

If issues arise, revert changes to `PendingLeadsTable.tsx` only. No database or API changes are required for this feature.

---

## Notes

- No API changes required - `restaurantId` already returned from conversion endpoint
- No database changes required
- Uses existing `BulkStartSequenceModal` component unchanged
- Default lead values (`uncontacted`, `frozen`, `inactive`) match newly converted restaurant defaults
