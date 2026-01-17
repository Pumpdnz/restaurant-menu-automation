# Investigation Task 2: Database Schema and Data Flow for Item Tags

## Overview

This document investigates how menu item tag data is stored in the database and how to fetch menu items for building tag-to-item mappings. Unlike option sets which use a junction table (`menu_item_option_sets`), tags are stored directly in the `menu_items.tags` ARRAY column.

---

## 1. Database Schema for Tags in menu_items

### Column Definition

```sql
Column: tags
Data Type: ARRAY (text[])
UDT Name: _text
Nullable: YES
Default: null
```

The `tags` column is a PostgreSQL text array (`text[]`) that stores zero or more tag strings directly on each menu item record.

### Full menu_items Table Structure (Relevant Columns)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `menu_id` | uuid | Foreign key to menus table |
| `category_id` | uuid | Foreign key to menu_categories |
| `name` | varchar | Menu item name |
| `tags` | text[] | **Array of tag strings** |
| `dietary_info` | jsonb | Additional dietary information |
| `organisation_id` | uuid | Organization context for RLS |

### Key Difference from Option Sets

- **Option Sets**: Use junction table `menu_item_option_sets` to link items to option sets
- **Tags**: Stored directly as an array on `menu_items.tags` - no separate junction table

---

## 2. Sample Data Showing Tag Formats

### Items with Single Tags

```json
{"id": "0d605677-3a63-4abc-9ff0-f098624951b1", "name": "Spicy Jalapenos Burger", "tags": ["Spicy"]}
{"id": "d2523539-f3fc-4561-8b42-e34aaa209309", "name": "Veggie Supreme Burger (V)", "tags": ["Vegetarian"]}
{"id": "8dd8169d-ee59-4e04-b4fa-fcde0eb0ad1d", "name": "Lamb Gulauti Tacos", "tags": ["Popular"]}
```

### Items with Multiple Tags

```json
{"id": "1c13a4a6-1e12-403a-8d3f-d61e12a0d19c", "name": "Curly fries", "tags": ["Plus small", "Popular"]}
{"id": "2919f9bb-b7d2-4b22-b68f-2a8494c81b88", "name": "Veggy Cheese Pizza (V)", "tags": ["Vegetarian", "Plus small"]}
{"id": "6549fa3a-c370-4cf7-bf86-4302a3bca4c1", "name": "Losar Pork Phaley", "tags": ["Dairy Free", "Nut Free", "Popular"]}
{"id": "07a31633-3415-4bc1-9ca1-a7b75ac7968d", "name": "Aloo Tikki Chaat", "tags": ["Gluten Free", "Vegetarian", "Nut Free"]}
```

### Tag Case Sensitivity Analysis

Tags are **case-sensitive** as stored, but there are inconsistencies from extraction:

| Tag | Count | Case Variant |
|-----|-------|--------------|
| Vegetarian | 44 | Title case |
| Popular | 27 | Title case |
| Spicy | 17 | Title case |
| Gluten Free | 4 | Title case (space) |
| Gluten free | 3 | Sentence case |
| Nut Free | 4 | Title case |
| Nut free | 2 | Sentence case |
| Dairy Free | 3 | Title case |
| Dairy free | 1 | Sentence case |
| most liked | 3 | Lowercase |
| Vegan | 2 | Title case |

**Recommendation**: Use case-insensitive matching when applying tags to items.

---

## 3. Tag Quality Analysis

The database contains a mix of useful tags and noise from platform extraction:

### Useful Tags (112 total occurrences)
- Dietary: `Vegetarian` (44), `Spicy` (17), `Gluten Free` (7), `Nut Free` (6), `Dairy Free` (4), `Vegan` (2), `Contains Nuts` (2)
- Popularity: `Popular` (27), `most liked` (3)
- Promotional: `Deal` (1), `New` (1)

### Platform Noise Tags (to filter out)
- `Thumb up outline` (39) - UberEats UI element
- `Plus small` (6) - UberEats size indicator
- Percentage ratings: `100%` (23), `87%` (3), `80%` (3), etc.
- Count indicators: `(3)`, `(6)`, `(8)`, etc.

### Custom/Restaurant-Specific Tags
- `Our most popular curry`
- `Flaky`, `Layered Flat Bread`
- `Buy 1, get 1 free`
- `raita`, `papads`

---

## 4. How Tag Data Flows from Extraction to Database

### 4.1 Extraction Phase (firecrawl-service.js)

The extraction schema requests tags from platform pages:

```javascript
// Schema definition for extraction
"tags": {
  "type": "array",
  "description": "Any tags or attributes for this dish (e.g., 'Spicy', 'Vegetarian', 'Gluten-Free')",
  "items": {
    "type": "string"
  }
}
```

With explicit filtering instructions:
```javascript
"tags": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Any tags or attributes for this dish. DO NOT include tags related to 'Thumb up outline' or percentages. DO NOT include tags related to 'most liked' or 'Plus small'"
}
```

### 4.2 Transformation Phase

After extraction, tags are normalized:
```javascript
// firecrawl-service.js line 568
tags: Array.isArray(item.tags) ? item.tags : []
```

### 4.3 Database Insertion (database-service.js)

Tags are inserted directly as an array:
```javascript
// database-service.js line 458
{
  category_id: categoryId,
  name: item.dishName || item.name,
  description: cleanDescription,
  price: item.dishPrice || item.price,
  currency: item.currency || 'NZD',
  tags: item.tags || [],  // Direct array insertion
  dietary_info: item.dietaryInfo || {},
  // ...
}
```

---

## 5. Proposed Query Patterns for Building menuItemNames Mappings

### 5.1 Pattern A: Query Items by Existing Tags (Recommended)

Fetch menu items that already have specific tags from extraction, then map them for the Playwright script:

```javascript
// Fetch menu items with their tags for a specific menu
const { data: menuItems, error } = await supabase
  .from('menu_items')
  .select('id, name, tags')
  .eq('menu_id', menuId)
  .not('tags', 'is', null);

// Build tag-to-items mapping (case-insensitive)
const tagToItems = {};
const normalizeTag = (tag) => tag.trim().toLowerCase();

// Define the preset tags we care about
const PRESET_TAGS = [
  'Popular', 'New', 'Deal', 'Vegan', 'Vegetarian',
  'Gluten Free', 'Dairy Free', 'Nut Free', 'Halal', 'Spicy'
];
const presetTagsLower = new Set(PRESET_TAGS.map(t => normalizeTag(t)));

menuItems.forEach(item => {
  if (Array.isArray(item.tags)) {
    item.tags.forEach(tag => {
      const normalizedTag = normalizeTag(tag);
      // Only include tags that match our preset tags
      if (presetTagsLower.has(normalizedTag)) {
        // Find the canonical (title case) version
        const canonicalTag = PRESET_TAGS.find(p => normalizeTag(p) === normalizedTag);
        if (!tagToItems[canonicalTag]) {
          tagToItems[canonicalTag] = [];
        }
        tagToItems[canonicalTag].push(item.name);
      }
    });
  }
});

// Output format for script
// {
//   "Popular": ["Curly fries", "Lamb Gulauti Tacos", ...],
//   "Vegetarian": ["Veggie Supreme Burger (V)", "Veggy Cheese Pizza (V)", ...],
//   "Spicy": ["Spicy Jalapenos Burger", "Buffalo Chicken Tacos", ...]
// }
```

### 5.2 Pattern B: Direct SQL Query for Tag Mapping

```sql
-- Get all items with useful tags for a specific menu, grouped by tag
WITH normalized_tags AS (
  SELECT
    mi.id,
    mi.name,
    unnest(mi.tags) as tag,
    lower(trim(unnest(mi.tags))) as tag_lower
  FROM menu_items mi
  WHERE mi.menu_id = 'your-menu-id-here'
    AND mi.tags IS NOT NULL
    AND array_length(mi.tags, 1) > 0
)
SELECT
  CASE
    WHEN tag_lower = 'popular' THEN 'Popular'
    WHEN tag_lower = 'new' THEN 'New'
    WHEN tag_lower = 'deal' THEN 'Deal'
    WHEN tag_lower = 'vegan' THEN 'Vegan'
    WHEN tag_lower = 'vegetarian' THEN 'Vegetarian'
    WHEN tag_lower = 'gluten free' THEN 'Gluten Free'
    WHEN tag_lower = 'dairy free' THEN 'Dairy Free'
    WHEN tag_lower = 'nut free' THEN 'Nut Free'
    WHEN tag_lower = 'halal' THEN 'Halal'
    WHEN tag_lower = 'spicy' THEN 'Spicy'
    WHEN tag_lower = 'most liked' THEN 'Popular'  -- Map variant
    WHEN tag_lower = 'contains nuts' THEN 'Contains Nuts'
  END as canonical_tag,
  array_agg(DISTINCT name) as menu_item_names
FROM normalized_tags
WHERE tag_lower IN (
  'popular', 'new', 'deal', 'vegan', 'vegetarian',
  'gluten free', 'dairy free', 'nut free', 'halal', 'spicy',
  'most liked', 'contains nuts'
)
GROUP BY canonical_tag
ORDER BY canonical_tag;
```

### 5.3 Pattern C: Mirroring Option Sets API Pattern

Following the pattern from `registration-routes.js` lines 3083-3174:

```javascript
// Fetch menu items for the selected menu (including names and tags)
const { data: menuItems, error: menuItemsError } = await supabase
  .from('menu_items')
  .select('id, name, tags')
  .eq('menu_id', menuId);

if (menuItemsError) {
  throw new Error('Failed to fetch menu items: ' + menuItemsError.message);
}

// Create a map of menu item IDs to names for later lookup
const menuItemIdToName = new Map();
menuItems.forEach(item => {
  menuItemIdToName.set(item.id, item.name);
});

// Build tag mappings (similar to menuItemMappings for option sets)
const tagMappings = {}; // Maps tag name to array of menu item names

const PRESET_TAGS = ['Popular', 'New', 'Deal', 'Vegan', 'Vegetarian',
                     'Gluten Free', 'Dairy Free', 'Nut Free', 'Halal', 'Spicy'];

// Initialize all preset tags
PRESET_TAGS.forEach(tag => {
  tagMappings[tag] = [];
});

// Process each menu item's tags
menuItems.forEach(item => {
  if (Array.isArray(item.tags)) {
    item.tags.forEach(tag => {
      const normalizedTag = tag.trim().toLowerCase();
      // Find matching preset tag (case-insensitive)
      const presetTag = PRESET_TAGS.find(p => p.toLowerCase() === normalizedTag);
      if (presetTag) {
        tagMappings[presetTag].push(item.name);
      }
    });
  }
});

// Convert to array format for script consumption
const itemTagsArray = PRESET_TAGS
  .filter(tag => tagMappings[tag].length > 0)  // Only include tags with items
  .map(tagName => ({
    name: tagName,
    color: TAG_COLORS[tagName],  // From ITEM_TAGS constant
    menuItemNames: tagMappings[tagName]
  }));
```

---

## 6. Preset Tags Reference (from item-tags-constants.ts)

### Tag Categories

| Category | Tags |
|----------|------|
| Dietary | Vegan, Vegetarian, Gluten free, Dairy free, Halal, Nut free, Spicy |
| Popular | Popular, Most Liked, Favourite, Must Try, Recommended, Trending, Highly Rated, Specialty |
| New | New, Limited Time, Limited Time Only, Seasonal, While Stock Lasts, Today Only |
| Deal | Deal, Promo, Promotion, Special, Buy 1 Get 1, 2 for 1, Combo, Free Item, Free Gift, Discount |

### Tag Styles (for reference)

```javascript
const TAG_STYLES = {
  'vegan': { gradient: 'linear-gradient(135deg, #26c526, #166a16)', borderColor: '#166a16' },
  'vegetarian': { gradient: 'linear-gradient(135deg, #32CD32, #36AB36)', borderColor: '#36AB36' },
  'gluten free': { gradient: 'linear-gradient(135deg, #FFB347, #FF8C00)', borderColor: '#FF8C00' },
  'spicy': { gradient: 'linear-gradient(135deg, #FF6B6B, #FF3333)', borderColor: '#FF3333' },
  'popular': { gradient: 'linear-gradient(135deg, #b400fa, #ff0000)', borderColor: '#ff0000' },
  // ... etc
};
```

---

## 7. Key Findings and Recommendations

### Findings

1. **No Junction Table**: Tags use a direct array column, not a junction table like option sets
2. **Case Inconsistency**: Same tags appear with different casing (e.g., "Gluten Free" vs "Gluten free")
3. **Platform Noise**: Extraction captures UI elements as tags (percentages, thumbs up, etc.)
4. **Sparse Data**: Most items have 0-1 tags; few have 2-3 tags
5. **Pre-filtered in Extraction**: The firecrawl schema attempts to filter noise but isn't always successful

### Recommendations for add-item-tags.js Enhancement

1. **Use Case-Insensitive Matching**: Always normalize tags to lowercase before comparison
2. **Map Variants**: Map common variants (e.g., "most liked" -> "Popular")
3. **Filter Noise**: Skip numeric tags, percentages, and known platform UI elements
4. **Build menuItemNames Array**: For each tag, compile list of item names that should have it
5. **Follow Option Sets Pattern**: Mirror the structure from the option sets endpoint for consistency

### Proposed Script Input Format

```javascript
// Enhanced ITEM_TAGS structure with menuItemNames
const ITEM_TAGS = [
  {
    name: 'Popular',
    color: '#b400fa',
    menuItemNames: ['Curly fries', 'Lamb Gulauti Tacos', 'Cookie Time Chocolate']
  },
  {
    name: 'Vegetarian',
    color: '#32CD32',
    menuItemNames: ['Veggie Supreme Burger (V)', 'Paneer Punch Burger', 'Aloo Tikki Chaat']
  },
  // ... etc
];
```

---

## 8. Files Referenced

- `/UberEats-Image-Extractor/src/services/firecrawl-service.js` - Extraction schema and tag handling
- `/UberEats-Image-Extractor/src/services/database-service.js` - Database insertion logic
- `/UberEats-Image-Extractor/src/routes/registration-routes.js` - Option sets query pattern (lines 3083-3174)
- `/UberEats-Image-Extractor/src/lib/item-tags-constants.ts` - Preset tag definitions and styles
- `/scripts/restaurant-registration/add-item-tags.js` - Current Playwright script (no menuItemNames support yet)
