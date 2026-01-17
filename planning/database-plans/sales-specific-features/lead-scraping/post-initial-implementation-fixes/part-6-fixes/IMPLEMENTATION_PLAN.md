# Implementation Plan: Lead Conversion UX Improvements

**Date**: 2025-12-16
**Status**: PLANNING

---

## Summary

This plan adds two UX improvements to the lead-to-restaurant conversion flow:
1. **Clickable restaurant links** in the conversion confirmation dialog
2. **Sequence enrollment option** for newly converted restaurants

---

## Current State Analysis

### Conversion Dialog (PendingLeadsTable.tsx:563-628)

The current dialog shows:
- Converting state with spinner
- Results list with success/failure status
- Restaurant name (plain text)
- Close button

**Conversion Result Interface (line 126-132)**:
```typescript
interface ConversionResult {
  leadId: string;
  restaurantName: string;
  success: boolean;
  error?: string;
  restaurantId?: string;  // Already captured!
}
```

The `restaurantId` is already being captured from the API response but not utilized.

### BulkStartSequenceModal Usage

**File**: `src/components/sequences/BulkStartSequenceModal.tsx`
**Props Required**:
```typescript
interface BulkStartSequenceModalProps {
  open: boolean;
  onClose: () => void;
  restaurants: Restaurant[];  // { id, name, lead_stage?, lead_warmth?, lead_status? }
}
```

**Already used in**: `src/pages/Sequences.tsx` (line 843)

---

## Implementation Tasks

### Task 1: Add Restaurant Links to Conversion Dialog

**File**: `src/components/leads/PendingLeadsTable.tsx`

**Changes**:
1. Import `Link` from `react-router-dom`
2. Update the conversion results display (lines 586-615) to make restaurant names clickable
3. Link format: `/restaurants/${result.restaurantId}`

**Code Location**: Lines 600-605 (inside the results map)

**Current**:
```tsx
<span className="text-sm font-medium">
  {result.restaurantName}
</span>
```

**New**:
```tsx
{result.success && result.restaurantId ? (
  <Link
    to={`/restaurants/${result.restaurantId}`}
    className="text-sm font-medium text-primary hover:underline"
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

### Task 2: Add Sequence Enrollment Option

**File**: `src/components/leads/PendingLeadsTable.tsx`

**Changes**:

1. **Import BulkStartSequenceModal**:
```tsx
import { BulkStartSequenceModal } from '../sequences/BulkStartSequenceModal';
```

2. **Add state for sequence modal**:
```tsx
const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
const [convertedRestaurants, setConvertedRestaurants] = useState<Restaurant[]>([]);
```

3. **Capture converted restaurants after successful conversion**:
```tsx
// After conversion completes (in handleConvertSelected/handleConvertSingle)
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

4. **Add "Start Sequence" button to dialog footer** (after conversion):
```tsx
{!isConverting && conversionSummary.successful > 0 && (
  <DialogFooter className="flex justify-between">
    <Button
      variant="outline"
      onClick={() => {
        setIsSequenceModalOpen(true);
        setIsConversionDialogOpen(false);
      }}
    >
      Start Sequence ({conversionSummary.successful})
    </Button>
    <Button onClick={() => setIsConversionDialogOpen(false)}>
      Close
    </Button>
  </DialogFooter>
)}
```

5. **Add BulkStartSequenceModal component**:
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

## UI/UX Flow

### Current Flow
1. User selects leads → clicks "Convert to Restaurants"
2. Dialog shows converting spinner
3. Dialog shows results (success/failed list)
4. User clicks "Close"

### New Flow
1. User selects leads → clicks "Convert to Restaurants"
2. Dialog shows converting spinner
3. Dialog shows results:
   - Each restaurant name is **clickable link** to RestaurantDetail
   - Success items show link, failed items show error
4. User has two options:
   - **"Start Sequence"** button → Opens BulkStartSequenceModal with converted restaurants
   - **"Close"** button → Closes dialog
5. If sequence modal opened → User selects template, starts sequences

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/leads/PendingLeadsTable.tsx` | Add Link import, update results display, add BulkStartSequenceModal |

---

## Dependencies

- `react-router-dom` (already installed)
- `BulkStartSequenceModal` (already exists)
- `useSequenceTemplates`, `useBulkStartSequence` hooks (already exist)

---

## Testing Checklist

- [ ] Convert single lead → verify restaurant name links to correct RestaurantDetail
- [ ] Convert multiple leads → verify all successful conversions have clickable links
- [ ] Convert with some failures → verify failed items don't have links
- [ ] Click "Start Sequence" → verify BulkStartSequenceModal opens with correct restaurants
- [ ] Select sequence template → verify sequences are created for converted restaurants
- [ ] Close sequence modal → verify state is properly reset

---

## Estimated Effort

**Small** - This is a UI enhancement using existing components and patterns.

---

## Notes

- The conversion API already returns `restaurant_id` for each successful conversion
- The `BulkStartSequenceModal` is well-tested and used in Sequences.tsx
- Newly converted restaurants have sales pipeline defaults (`lead_stage: 'uncontacted'`, `lead_warmth: 'frozen'`, `lead_status: 'inactive'`) which match what sequences expect
