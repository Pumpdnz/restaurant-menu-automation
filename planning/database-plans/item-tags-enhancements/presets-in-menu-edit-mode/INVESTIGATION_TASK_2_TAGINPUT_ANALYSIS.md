# Investigation Task 2: TagInput Component Analysis

## Executive Summary

The `TagInput.tsx` component is a well-designed, reusable multi-select component that could be adapted for the menu item editor. However, there are significant data structure differences (`TagItem[]` vs `string[]`) requiring migration consideration.

---

## 1. TagInput Full API Documentation

### Component Location
**File:** `UberEats-Image-Extractor/src/components/demo-meeting/TagInput.tsx`

### Interface (Lines 14-21)
```typescript
interface TagInputProps {
  options: readonly string[];
  selected: TagItem[];
  onChange: (selected: TagItem[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
  maxTags?: number;
}
```

### Props Reference

| Prop | Type | Required | Default | Purpose |
|------|------|----------|---------|---------|
| `options` | `readonly string[]` | Yes | N/A | Predefined options for dropdown |
| `selected` | `TagItem[]` | Yes | N/A | Currently selected tags with type |
| `onChange` | `(selected: TagItem[]) => void` | Yes | N/A | Callback on selection change |
| `allowCustom` | `boolean` | No | `true` | Enable custom value input |
| `placeholder` | `string` | No | `'Select options...'` | Trigger button text |
| `maxTags` | `number` | No | `undefined` | Max tag limit |

### TagItem Interface (qualification-constants.ts:159-162)
```typescript
export interface TagItem {
  type: 'predefined' | 'custom';
  value: string;
}
```

---

## 2. UI Structure

### Layout Sections (Lines 112-247)

1. **Popover Trigger Button** - Shows count or placeholder
2. **Popover Content** (500px wide, 500px max height)
   - Custom Value Input section (blue tint background)
   - Predefined Options (scrollable, 250px height)
3. **Selected Tags Display** - Badges with remove buttons

### Styling
- Predefined tags: `variant="default"` (blue/primary)
- Custom tags: `variant="secondary"` (gray)
- Visual distinction helps users identify tag source

---

## 3. Current Usage

**File:** `UberEats-Image-Extractor/src/components/demo-meeting/QualificationForm.tsx`

```typescript
<TagInput
  options={PREDEFINED_PAINPOINTS}
  selected={data.painpoints || []}
  onChange={(v) => onChange('painpoints', v)}
  allowCustom={true}
  placeholder="Select or add painpoints..."
/>
```

Used for 4 qualification fields with different preset options.

---

## 4. Gap Analysis

### Data Structure Mismatch

| Aspect | Current EditableMenuItem | TagInput Requires |
|--------|-------------------------|-------------------|
| **Data Type** | `string[]` | `TagItem[]` |
| **Add Result** | `[...tags, newTag]` | `[...tags, { type, value }]` |
| **Display** | All gray badges | Color-coded by type |

### Migration Strategies

**Strategy A: Gradual Migration (Recommended)**
- Load: Convert `string[]` → `TagItem[]` with `type: 'custom'`
- Save: Store `TagItem[]` in database
- Existing tags appear as custom (gray)

**Strategy B: Keep string[] in Database**
- Convert at component boundaries
- Zero database changes
- Component handles conversion logic

**Strategy C: Dual Support**
- Detect and handle both formats
- More complex but flexible

---

## 5. Integration Changes Needed

### EditableMenuItem.jsx Updates

1. **Add Imports**
```typescript
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TagInput } from '../demo-meeting/TagInput';
import { PREDEFINED_MENU_ITEM_TAGS } from '../../lib/menu-item-constants';
```

2. **Conversion Functions**
```typescript
function convertStringsToTagItems(tags: string[]): TagItem[] {
  return tags.map(value => ({ type: 'custom', value }));
}

function convertTagItemsToStrings(tags: TagItem[]): string[] {
  return tags.map(item => item.value);
}
```

3. **Replace Tag UI** (Lines 220-253) with TagInput component

---

## 6. Styling Considerations

### Space Constraints
- TagInput popover: 500px wide (may overflow menu card)
- Need responsive width: `w-full md:w-[500px]`

### Mobile
- Fixed 500px problematic on small screens
- Suggest viewport-relative sizing

---

## 7. Recommendation

**Approach: Create MenuItemTagInput Variant**

Fork TagInput into menu-specific component with:
- Customized width for menu cards
- Same `TagItem[]` data model
- Category grouping for presets
- Maintains backwards compatibility via conversion layer

**Estimated Effort:** 4-8 hours depending on approach
