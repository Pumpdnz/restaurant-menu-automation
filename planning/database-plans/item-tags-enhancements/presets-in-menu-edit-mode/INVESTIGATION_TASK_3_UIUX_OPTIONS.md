# Investigation Task 3: UI/UX Options for Preset Tags

## Overview

Evaluation of UI/UX approaches for integrating preset tags into the menu item editor while maintaining existing custom tag functionality.

---

## Current Implementation (EditableMenuItem.jsx:219-254)

- Simple text input with "+" button
- Badge display with X removal
- Enter key support
- No preset tags
- Constrained space inside menu item card

---

## Option 1: Categorized Popover Dropdown (RECOMMENDED)

### Description
A popover dropdown button that opens when clicked, showing preset tags organized by category (Dietary, Popular, New, Deal) with checkboxes.

### Visual Structure
```
[Tag Input Field]  [+] [Browse Presets]

When popover opens:
┌─────────────────────────────────┐
│ DIETARY                         │
│ □ Vegan         □ Vegetarian    │
│ □ Gluten free   □ Spicy         │
│ □ Hot           □ Dairy free    │
│ □ Nut free                      │
├─────────────────────────────────┤
│ POPULAR                         │
│ □ Popular       □ Most Liked    │
│ □ Favourite     □ Must Try      │
│ ...                             │
└─────────────────────────────────┘
```

### Pros
- Leverages existing Popover component
- Organized by category for easy scanning
- Matches existing TagInput.tsx and CitySearchCombobox patterns
- Checkbox interaction is familiar
- Fits 40+ options in scrollable area
- Keeps menu card clean - no expansion
- Desktop and mobile friendly

### Cons
- One more click than inline suggestions
- Popover may cover content below on mobile

### Accessibility
- Popover `role="dialog"`
- Checkboxes with proper labels
- Keyboard: Tab through, Space to select, ESC to close
- Arrow keys for navigation

---

## Option 2: Inline Chip Suggestions Below Input

### Description
Preset tags displayed as clickable chips directly below the text input, organized by category with collapsible sections.

### Visual Structure
```
[Tag Input Field]  [+]

DIETARY
[Vegan] [Vegetarian] [Gluten free] [Spicy]
[Hot] [Dairy free] [Nut free]

POPULAR
[Popular] [Most Liked] [Favourite] [Must Try]
```

### Pros
- Always visible - no click needed
- Reduces cognitive load vs dropdown
- Good for discoverability
- Each tag directly clickable

### Cons
- Takes significant vertical space (80-120px)
- Card becomes very tall
- Problematic on mobile with limited width
- May push other fields off-screen

### Accessibility
- Simple button clicks
- Keyboard: Tab through chips, Enter to select
- Screen readers: "Add tag: [tagname]"

---

## Option 3: Split UI - Category Toggle Buttons + Input

### Description
Quick-select toggle buttons for categories above input, showing/hiding presets dynamically.

### Visual Structure
```
[Dietary] [Popular] [New] [Deal]  ← Category toggles

[Tag Input Field - filters within category]  [+]

Filtered suggestions:
[Vegan] [Vegetarian] [Gluten free] ...
```

### Pros
- Space-efficient - shows only relevant presets
- Quick category switching
- Search/filter within category
- Desktop and mobile friendly

### Cons
- More complex interaction (2 steps)
- Less discovery - categories hidden by default
- Requires state management for active category
- May confuse users

### Accessibility
- Toggle buttons with `aria-pressed` states
- Keyboard: Tab through buttons, Enter to toggle
- Clear visual indication of active category

---

## Comparison Table

| Aspect | Option 1: Popover | Option 2: Inline | Option 3: Toggle |
|--------|-------------------|------------------|------------------|
| **Space in Card** | Minimal | High (80-120px) | Medium (40-50px) |
| **Discovery** | Good (1 click) | Excellent | Good |
| **Mobile Friendly** | Yes | Poor | Good |
| **Implementation** | Medium | Low | Medium-High |
| **Codebase Alignment** | Excellent | Low | Medium |
| **Visual Cleanliness** | Excellent | Poor | Good |

---

## Recommendation: Option 1 - Categorized Popover

### Why This Approach

1. **Aligns with Existing Patterns** - TagInput.tsx already uses this pattern
2. **Space Efficiency** - Doesn't expand the menu card
3. **Scalability** - 30+ tags fit comfortably in scrollable popover
4. **Mobile Friendly** - CitySearchCombobox pattern tested in production
5. **Minimal Modifications** - Can adapt existing TagInput component

### Implementation Approach

1. Create categorized popover component similar to TagInput
2. Accept `string[]` tags for backwards compatibility
3. Group presets by category (Dietary, Popular, New, Deal)
4. Keep existing input field for custom entries
5. Add "Browse Presets" button to trigger popover

### UI Changes to EditableMenuItem

Replace lines 219-254 with:
- Input field for custom tag typing (keep existing)
- "+" button (keep existing)
- NEW: "Browse Presets" button triggering categorized popover
- Existing badge display for selected tags
