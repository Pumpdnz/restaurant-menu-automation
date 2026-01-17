# Opening Hours Editor - Implementation Documentation

## Overview

This document covers the complete redesign of the opening hours editing functionality in the RestaurantDetail page. The changes include extracting the hours editor into a reusable component, creating a custom time picker, and standardizing on array format for hours data.

## Date Implemented

December 2024

---

## Changes Summary

### New Components Created

| Component | Path | Purpose |
|-----------|------|---------|
| `TimePicker` | `src/components/ui/time-picker.tsx` | Custom time input with dropdown presets |
| `OpeningHoursEditor` | `src/components/OpeningHoursEditor.tsx` | Complete hours editing component |

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/RestaurantDetail.jsx` | Added import, replaced inline hours rendering with component, removed ~290 lines of dead code |

### Code Removed from RestaurantDetail.jsx

The following functions were removed as they are now handled by `OpeningHoursEditor`:

- `convertTo12Hour()` - Time format conversion
- `normalizeOpeningHours()` - Hours normalization (unused)
- `handleOpeningHoursChange()` - Hours field change handler
- `addOpeningHoursSlot()` - Add time slot for a day
- `removeOpeningHoursSlot()` - Remove specific time slot
- `deleteOpeningHours()` - Delete all hours for a day
- `renderOpeningHours()` - UI rendering function

---

## Component Documentation

### TimePicker (`src/components/ui/time-picker.tsx`)

A custom time picker component with both typing and dropdown selection.

#### Props

```typescript
interface TimePickerProps {
  value: string        // Format: "HH:MM" (24-hour)
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}
```

#### Features

- **Editable inputs**: Type directly into hour/minute fields
- **Dropdown presets**: Click chevron for quick selection
- **24-hour format**: Consistent display (e.g., 17:00)
- **15-minute increments**: Quick picks for 00, 15, 30, 45 minutes
- **Validation on blur**: Clamps hours (0-23), minutes (0-59)
- **Mobile-friendly**: Uses `inputMode="numeric"` for numeric keyboard

#### Implementation Details

The component uses local state during typing to allow incomplete values:

```typescript
// Local state for typing - allows incomplete values during editing
const [localHours, setLocalHours] = React.useState<string | null>(null)
const [localMinutes, setLocalMinutes] = React.useState<string | null>(null)

// Display values: use local state while editing, otherwise use parsed props
const displayHours = localHours !== null ? localHours : parsedHours
const displayMinutes = localMinutes !== null ? localMinutes : parsedMinutes
```

This allows typing "17" without it being auto-padded to "01" after the first keystroke.

---

### OpeningHoursEditor (`src/components/OpeningHoursEditor.tsx`)

A complete hours editing component with day-by-day management.

#### Props

```typescript
interface OpeningHoursEditorProps {
  value: OpeningHoursSlot[] | Record<string, { open: string; close: string }> | null
  onChange: (value: OpeningHoursSlot[]) => void
  isEditing?: boolean
  className?: string
}
```

#### Data Format (Standardized)

```typescript
interface OpeningHoursSlot {
  day: string           // "Monday", "Tuesday", etc.
  hours: {
    open: string        // "HH:MM" 24-hour format
    close: string       // "HH:MM" 24-hour format
  }
}
```

#### Features

- **Format normalization**: Accepts both array and object formats, always outputs array
- **"Same as..." dropdown**: Copy hours from another day
- **Multiple time slots**: Up to 3 slots per day (e.g., lunch and dinner)
- **Add/remove slots**: Per-day management
- **"Mark as Closed"**: Quick way to remove all hours for a day
- **View/Edit modes**: Different UI for viewing vs editing

#### Usage in RestaurantDetail.jsx

```jsx
<OpeningHoursEditor
  value={isEditing ? editedData.opening_hours : restaurant?.opening_hours}
  onChange={(hours) => handleFieldChange('opening_hours', hours)}
  isEditing={isEditing}
/>
```

---

## Data Format Standardization Investigation

### Background

The system historically supported two data formats for `opening_hours`:

#### 1. Object Format (Legacy)
```javascript
{
  Monday: { open: "09:00", close: "17:00" },
  Tuesday: { open: "09:00", close: "17:00" },
  // ...
}
```
- Single time slot per day only
- Day names as keys

#### 2. Array Format (Standard)
```javascript
[
  { day: "Monday", hours: { open: "09:00", close: "21:00" } },
  { day: "Monday", hours: { open: "17:00", close: "21:00" } }, // Multiple slots OK
  { day: "Tuesday", hours: { open: "09:00", close: "21:00" } },
  // ...
]
```
- Supports multiple time slots per day
- More flexible structure

### Investigation Findings

#### Database Schema
- **Column**: `opening_hours jsonb null` in `restaurants` table
- **Companion field**: `opening_hours_text text null` for human-readable format
- **No constraints**: JSONB accepts any valid JSON structure

#### Where Each Format Was Used

| Location | Format | Notes |
|----------|--------|-------|
| New restaurants (init) | Array `[]` | Correct |
| Extraction services | Array | Already standardized |
| Google search save | Array | Converts to array |
| Some existing DB records | Object | Legacy data |

#### Backend Services Analysis

| Service | File | Handling |
|---------|------|----------|
| `formatOperatingHours()` | `onboarding-service.js` | Reads both formats |
| `convertOpeningHoursFormat()` | `lead-scrape-service.js` | Converts to array |
| Registration routes | `registration-routes.js` | Expects array |

### Standardization Approach

**Decision: "Lazy Migration"**

The `OpeningHoursEditor` component handles format conversion transparently:

1. **On Input**: Normalizes any format to array
2. **On Output**: Always emits array format
3. **Existing Data**: Migrates to array when edited

This means:
- No database migration required
- No backend changes needed
- Old data converts automatically when touched
- Read operations continue to work with both formats

#### Normalization Function

```typescript
function normalizeToArrayFormat(
  input: OpeningHoursSlot[] | Record<string, { open: string; close: string }> | null
): OpeningHoursSlot[] {
  if (!input) return []

  // Already array format
  if (Array.isArray(input)) {
    return input.map(slot => ({
      day: slot.day,
      hours: {
        open: slot.hours?.open || '',
        close: slot.hours?.close || ''
      }
    }))
  }

  // Object format - convert to array
  if (typeof input === 'object') {
    const result: OpeningHoursSlot[] = []
    Object.keys(input).forEach(day => {
      if (input[day]) {
        result.push({
          day,
          hours: {
            open: input[day].open || '',
            close: input[day].close || ''
          }
        })
      }
    })
    return result
  }

  return []
}
```

---

## Optional: Proactive Database Migration

If you want to convert all existing object-format data to array format proactively:

### Find Object Format Records

```sql
-- Find restaurants with object-format opening_hours
SELECT id, name, opening_hours
FROM restaurants
WHERE opening_hours IS NOT NULL
  AND jsonb_typeof(opening_hours) = 'object'
  AND NOT (opening_hours ? '0');  -- Arrays have numeric keys
```

### Migration Script (if needed)

```javascript
// Convert object format to array format
function migrateOpeningHours(objectFormat) {
  if (!objectFormat || Array.isArray(objectFormat)) {
    return objectFormat;
  }

  const result = [];
  Object.keys(objectFormat).forEach(day => {
    if (objectFormat[day] && objectFormat[day].open) {
      result.push({
        day: day,
        hours: {
          open: objectFormat[day].open,
          close: objectFormat[day].close
        }
      });
    }
  });

  return result;
}
```

---

## UI/UX Improvements

### Before (Old Implementation)

- Native `<input type="time">` elements
- Inconsistent browser styling
- No quick duplication between days
- Complex dual-format handling in page component
- ~290 lines of hours logic in RestaurantDetail.jsx

### After (New Implementation)

- Custom time picker with dropdowns
- 24-hour format with 15-minute presets
- "Same as..." feature to copy hours between days
- Clean extracted component
- Type-to-edit capability
- Validation on blur
- Mobile-friendly numeric keyboard

---

## Testing Checklist

- [ ] Add hours to a day with no hours set
- [ ] Edit existing hours by typing
- [ ] Edit existing hours using dropdown
- [ ] Add multiple time slots to same day
- [ ] Remove a time slot
- [ ] Mark a day as closed
- [ ] Use "Same as..." to copy hours from another day
- [ ] Save changes and verify persistence
- [ ] Load a restaurant with object-format hours (legacy)
- [ ] Verify hours display correctly in view mode

---

## File Locations

```
src/
├── components/
│   ├── ui/
│   │   └── time-picker.tsx          # New - Custom time input
│   └── OpeningHoursEditor.tsx       # New - Hours editor component
└── pages/
    └── RestaurantDetail.jsx         # Modified - Uses new component
```

---

## Related Documentation

- Database schema: `supabase/migrations/20251205_add_lead_scraping_tables.sql`
- Hours formatting: `src/services/onboarding-service.js` (`formatOperatingHours`)
- Hours conversion: `src/services/lead-scrape-service.js` (`convertOpeningHoursFormat`)
