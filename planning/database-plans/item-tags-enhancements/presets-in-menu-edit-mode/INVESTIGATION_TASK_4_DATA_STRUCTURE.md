# Investigation Task 4: Data Structure Planning

## Overview

Planning the data structure for preset item tags including constants organization, TypeScript types, and backwards compatibility strategy.

---

## 1. Existing Pattern Reference

### TagItem Interface (qualification-constants.ts:159-162)
```typescript
export interface TagItem {
  type: 'predefined' | 'custom';
  value: string;
}
```

This pattern is successfully used in TagInput.tsx for qualification features.

---

## 2. Proposed Constants File Structure

**File:** `UberEats-Image-Extractor/src/lib/item-tags-constants.ts`

```typescript
/**
 * Menu Item Tag Constants
 * Preset tags organized by category for quick selection
 */

// Dietary Tags
export const DIETARY_TAGS = [
  'Vegan',
  'Vegetarian',
  'Gluten free',
  'Spicy',
  'Hot',
  'Dairy free',
  'Nut free'
] as const;

// Popular/Featured Tags
export const POPULAR_TAGS = [
  'Popular',
  'Most Liked',
  'Favourite',
  'Must Try',
  'Recommended',
  'Trending',
  'Highly Rated',
  'Specialty'
] as const;

// New/Limited Tags
export const NEW_TAGS = [
  'New',
  'Limited Time',
  'Limited Time Only',
  'Seasonal',
  'While Stock Lasts',
  'Today Only'
] as const;

// Deal/Promotion Tags
export const DEAL_TAGS = [
  'Deal',
  'Promo',
  'Promotion',
  'Special',
  'Buy 1 Get 1',
  '2 for 1',
  'Combo',
  'Free Item',
  'Free Gift',
  'Discount'
] as const;

// Category configuration for UI grouping
export const TAG_CATEGORIES = {
  dietary: {
    label: 'Dietary',
    tags: DIETARY_TAGS,
    color: '#36AB36' // Green theme
  },
  popular: {
    label: 'Popular',
    tags: POPULAR_TAGS,
    color: '#b400fa' // Purple theme
  },
  new: {
    label: 'New',
    tags: NEW_TAGS,
    color: '#3f92ff' // Blue theme
  },
  deal: {
    label: 'Deals',
    tags: DEAL_TAGS,
    color: '#4fc060' // Green theme
  }
} as const;

// Flat array of all preset tags for validation/search
export const ALL_PRESET_TAGS = [
  ...DIETARY_TAGS,
  ...POPULAR_TAGS,
  ...NEW_TAGS,
  ...DEAL_TAGS
] as const;

// Type for preset tag values
export type PresetTagValue = typeof ALL_PRESET_TAGS[number];

// Set for O(1) lookup
export const PRESET_TAG_SET = new Set<string>(ALL_PRESET_TAGS);

// Helper: Check if tag is preset
export function isPresetTag(tag: string): boolean {
  return PRESET_TAG_SET.has(tag);
}

// Helper: Get category for a tag
export function getTagCategory(tag: string): keyof typeof TAG_CATEGORIES | null {
  for (const [key, category] of Object.entries(TAG_CATEGORIES)) {
    if ((category.tags as readonly string[]).includes(tag)) {
      return key as keyof typeof TAG_CATEGORIES;
    }
  }
  return null;
}
```

---

## 3. Data Structure Recommendation

### Decision: Keep `string[]` for Simplicity

**Rationale:**

| Aspect | string[] | TagItem[] |
|--------|----------|-----------|
| Backwards Compatible | Yes | Requires migration |
| Implementation | Simple | More complex |
| Database Changes | None | Schema update |
| Analytics Tracking | Via helper function | Built-in |
| UI Distinction | Via `isPresetTag()` | Via `type` field |

**Recommendation:** Keep `string[]` in database and component state. Use helper functions to determine if a tag is preset for UI styling purposes.

### Why Not TagItem[]?

1. **No database migration required** - Current `tags` field works as-is
2. **Simpler component logic** - No conversion layer needed
3. **Existing code compatibility** - MenuDetail, ExtractionDetail unchanged
4. **Visual distinction still possible** - Use `isPresetTag()` for styling

---

## 4. TypeScript Type Definitions

```typescript
// Enhanced MenuItem interface (no change to tags field)
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  tags?: string[];  // Keep as string[]
  imageURL?: string | null;
  categoryId?: string;
  optionSets?: OptionSet[];
}

// For component props that need category info
export interface TagWithMeta {
  value: string;
  isPreset: boolean;
  category?: keyof typeof TAG_CATEGORIES;
}

// Helper to enrich tags for display
export function enrichTagsForDisplay(tags: string[]): TagWithMeta[] {
  return tags.map(tag => ({
    value: tag,
    isPreset: isPresetTag(tag),
    category: getTagCategory(tag) || undefined
  }));
}
```

---

## 5. Backwards Compatibility Strategy

### No Migration Required

Since we're keeping `string[]`:
- Existing menu items with tags work unchanged
- New preset tags are added as strings
- UI uses `isPresetTag()` to style preset vs custom differently

### Display Logic

```typescript
// In component render
{tags.map(tag => (
  <Badge
    key={tag}
    variant={isPresetTag(tag) ? 'default' : 'secondary'}
  >
    {tag}
  </Badge>
))}
```

---

## 6. Example Usage

### In EditableMenuItem

```typescript
import {
  TAG_CATEGORIES,
  ALL_PRESET_TAGS,
  isPresetTag
} from '../../lib/item-tags-constants';

// Popover content with categories
{Object.entries(TAG_CATEGORIES).map(([key, category]) => (
  <div key={key}>
    <h4>{category.label}</h4>
    {category.tags.map(tag => (
      <Checkbox
        checked={editedItem.tags?.includes(tag)}
        onChange={() => toggleTag(tag)}
      >
        {tag}
      </Checkbox>
    ))}
  </div>
))}

// Badge styling based on preset status
{(editedItem.tags || []).map(tag => (
  <Badge
    key={tag}
    variant={isPresetTag(tag) ? 'default' : 'secondary'}
  >
    {tag}
    <button onClick={() => removeTag(tag)}>
      <X />
    </button>
  </Badge>
))}
```

---

## 7. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data Storage | `string[]` | No migration, backwards compatible |
| Preset Detection | Helper function | Simple, performant O(1) lookup |
| Category Grouping | Constants object | Clean UI organization |
| Type Safety | `as const` arrays | TypeScript inference |
| Visual Distinction | Badge variants | Preset=blue, Custom=gray |
