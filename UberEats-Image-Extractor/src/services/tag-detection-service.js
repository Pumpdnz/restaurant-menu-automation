/**
 * Tag Detection Service
 *
 * Automatically detects and applies tags to menu items based on:
 * - Category names (e.g., "Vegetarian Options" → Vegetarian tag)
 * - Item name abbreviations (e.g., "(GF)" → Gluten Free tag)
 * - Keywords in names/descriptions (e.g., "spicy" → Spicy tag)
 * - Consolidated mappings (e.g., "combo" → Deal tag)
 */

// =============================================================================
// CONFIGURATION: Tag Detection Rules
// =============================================================================

/**
 * Abbreviation mappings - stripped from names and converted to tags
 * Format: { 'abbreviation': 'Tag Name' }
 */
const ABBREVIATION_MAP = {
  '(V)': 'Vegetarian',
  '(v)': 'Vegetarian',
  '(VE)': 'Vegan',
  '(Ve)': 'Vegan',
  '(ve)': 'Vegan',
  '(VG)': 'Vegan',
  '(vg)': 'Vegan',
  '(GF)': 'Gluten Free',
  '(gf)': 'Gluten Free',
  '(DF)': 'Dairy Free',
  '(df)': 'Dairy Free',
  '(NF)': 'Nut Free',
  '(nf)': 'Nut Free',
  '(H)': 'Halal',
  '(h)': 'Halal'
};

/**
 * Keyword to tag mappings - detected in names and descriptions
 * Format: { 'keyword': 'Tag Name' }
 * Keywords are matched case-insensitively
 */
const KEYWORD_TAG_MAP = {
  // Dietary tags
  'vegetarian': 'Vegetarian',
  'vegan': 'Vegan',
  'plant based': 'Vegan',
  'plant-based': 'Vegan',
  'plantbased': 'Vegan',
  'gluten free': 'Gluten Free',
  'gluten-free': 'Gluten Free',
  'dairy free': 'Dairy Free',
  'dairy-free': 'Dairy Free',
  'lactose free': 'Dairy Free',
  'nut free': 'Nut Free',
  'nut-free': 'Nut Free',
  'peanut free': 'Nut Free',
  'halal': 'Halal',

  // Spicy indicators
  'spicy': 'Spicy',
  'chilli': 'Spicy',
  'chili': 'Spicy',
  'jalapeno': 'Spicy',
  'jalapenos': 'Spicy',
  'sriracha': 'Spicy',
  'buffalo': 'Spicy',
  'hot sauce': 'Spicy'
};

/**
 * Consolidated tag mappings - multiple terms map to same tag
 * Format: { 'keyword': 'Consolidated Tag Name' }
 */
const CONSOLIDATED_TAG_MAP = {
  // Deal/Combo tags
  'combo': 'Deal',
  'deal': 'Deal',
  'special offer': 'Deal',
  'bundle': 'Deal',
  'meal deal': 'Deal',
  'value meal': 'Deal',

  // Popular tags
  'popular': 'Popular',
  'signature': 'Popular',
  'recommended': 'Popular',
  'specialty': 'Popular',
  'speciality': 'Popular',
  'must try': 'Popular',
  'must-try': 'Popular',
  'best seller': 'Popular',
  'bestseller': 'Popular',
  'favourite': 'Popular',
  'favorite': 'Popular',
  'chef\'s choice': 'Popular',
  'house special': 'Popular',

  // New tags
  'limited time': 'Limited Time',
  'seasonal': 'Seasonal'
};

/**
 * Category patterns that indicate all items should receive a tag
 * Format: { keywords: [], tag: 'Tag Name', exclude: [] }
 */
const CATEGORY_TAG_PATTERNS = [
  {
    keywords: ['vegetarian', 'veg options', 'veg dishes', 'veggie'],
    tag: 'Vegetarian',
    exclude: ['non vegetarian', 'non-vegetarian', 'non veg', 'non-veg']
  },
  {
    keywords: ['vegan'],
    tag: 'Vegan',
    exclude: ['non vegan', 'non-vegan']
  },
  {
    keywords: ['gluten free', 'gluten-free', 'gf options'],
    tag: 'Gluten Free',
    exclude: []
  },
  {
    keywords: ['spicy', 'hot & spicy', 'hot and spicy'],
    tag: 'Spicy',
    exclude: []
  }
];

// =============================================================================
// MAIN PROCESSING FUNCTIONS
// =============================================================================

/**
 * Process menu items to detect and apply tags
 *
 * @param {Array} items - Menu items from extraction
 * @param {Array} categories - Category names (strings)
 * @returns {Array} - Items with tags detected and names cleaned
 */
function processMenuItemTags(items, categories = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return items;
  }

  // Pre-compute category-based tags
  const categoryTagMap = buildCategoryTagMap(categories);

  return items.map(item => {
    try {
      return processItem(item, categoryTagMap);
    } catch (error) {
      console.warn(`[TagDetection] Error processing item "${item.dishName || item.name}":`, error.message);
      return item; // Return original item on error
    }
  });
}

/**
 * Process a single menu item
 *
 * @param {Object} item - Menu item
 * @param {Map} categoryTagMap - Pre-computed category to tags mapping
 * @returns {Object} - Processed item with tags and cleaned name
 */
function processItem(item, categoryTagMap) {
  const detectedTags = new Set();
  let itemName = item.dishName || item.name || '';
  const description = item.dishDescription || item.description || '';
  const categoryName = item.categoryName || item.category || '';
  const existingTags = item.tags || [];

  // 1. Add existing tags (preserve what Firecrawl extracted)
  existingTags.forEach(tag => {
    if (tag && typeof tag === 'string') {
      detectedTags.add(normalizeTagName(tag));
    }
  });

  // 2. Apply category-based tags
  if (categoryName && categoryTagMap.has(categoryName)) {
    categoryTagMap.get(categoryName).forEach(tag => detectedTags.add(tag));
  }

  // 3. Strip abbreviations from name and add corresponding tags
  const { cleanedName, abbreviationTags } = stripAbbreviations(itemName);
  itemName = cleanedName;
  abbreviationTags.forEach(tag => detectedTags.add(tag));

  // 4. Detect keywords in name and description
  const searchText = ` ${itemName} ${description} `.toLowerCase();

  // Keyword detection (with word boundary matching)
  for (const [keyword, tag] of Object.entries(KEYWORD_TAG_MAP)) {
    if (matchesAsWord(searchText, keyword.toLowerCase())) {
      detectedTags.add(tag);
    }
  }

  // Consolidated tag detection (with word boundary matching)
  for (const [keyword, tag] of Object.entries(CONSOLIDATED_TAG_MAP)) {
    if (matchesAsWord(searchText, keyword.toLowerCase())) {
      detectedTags.add(tag);
    }
  }

  // 5. Build result
  return {
    ...item,
    tags: Array.from(detectedTags).sort(),
    dishName: itemName.trim(),
    name: itemName.trim()
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if keyword matches as a whole word (not part of another word)
 * Prevents "deal" matching "ideal", "new" matching "renew", etc.
 *
 * @param {string} text - Text to search in (should have spaces padded at start/end)
 * @param {string} keyword - Keyword to find
 * @returns {boolean} - True if keyword found as whole word
 */
function matchesAsWord(text, keyword) {
  // Word boundary characters (spaces, punctuation, start/end)
  const boundaryPattern = `(?:^|[\\s,;:.!?()\\[\\]"'/-])${escapeRegex(keyword)}(?:[\\s,;:.!?()\\[\\]"'/-]|$)`;
  const regex = new RegExp(boundaryPattern, 'i');
  return regex.test(text);
}

/**
 * Build a map of category names to their applicable tags
 *
 * @param {Array} categories - Array of category name strings
 * @returns {Map} - Map of categoryName → Set of tags
 */
function buildCategoryTagMap(categories) {
  const categoryTagMap = new Map();

  if (!Array.isArray(categories)) {
    return categoryTagMap;
  }

  for (const categoryName of categories) {
    if (!categoryName || typeof categoryName !== 'string') {
      continue;
    }

    const lowerCategory = categoryName.toLowerCase();
    const tagsForCategory = new Set();

    for (const pattern of CATEGORY_TAG_PATTERNS) {
      // Check exclusions first
      const isExcluded = pattern.exclude.some(exc => lowerCategory.includes(exc));
      if (isExcluded) continue;

      // Check if any keyword matches
      const matches = pattern.keywords.some(kw => lowerCategory.includes(kw));
      if (matches) {
        tagsForCategory.add(pattern.tag);
      }
    }

    if (tagsForCategory.size > 0) {
      categoryTagMap.set(categoryName, tagsForCategory);
    }
  }

  return categoryTagMap;
}

/**
 * Strip abbreviations from item name and return cleaned name + tags
 *
 * @param {string} name - Original item name
 * @returns {Object} - { cleanedName, abbreviationTags }
 */
function stripAbbreviations(name) {
  if (!name || typeof name !== 'string') {
    return { cleanedName: name || '', abbreviationTags: [] };
  }

  let cleanedName = name;
  const abbreviationTags = [];

  for (const [abbrev, tag] of Object.entries(ABBREVIATION_MAP)) {
    if (cleanedName.includes(abbrev)) {
      cleanedName = cleanedName.replace(new RegExp(escapeRegex(abbrev), 'g'), '');
      if (!abbreviationTags.includes(tag)) {
        abbreviationTags.push(tag);
      }
    }
  }

  // Clean up extra spaces
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

  // Remove trailing/leading punctuation artifacts
  cleanedName = cleanedName.replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();

  return { cleanedName, abbreviationTags };
}

/**
 * Normalize tag name for consistency
 *
 * @param {string} tag - Raw tag string
 * @returns {string} - Normalized tag
 */
function normalizeTagName(tag) {
  if (!tag || typeof tag !== 'string') {
    return '';
  }

  // Title case and trim
  return tag
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Escape special regex characters
 *
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get statistics about detected tags (for logging)
 *
 * @param {Array} items - Processed items with tags
 * @returns {Object} - { itemsWithTags, uniqueTags, tags }
 */
function getTagStats(items) {
  if (!Array.isArray(items)) {
    return { itemsWithTags: 0, uniqueTags: 0, tags: [] };
  }

  const allTags = new Set();
  let itemsWithTags = 0;

  for (const item of items) {
    if (item.tags && item.tags.length > 0) {
      itemsWithTags++;
      item.tags.forEach(tag => allTags.add(tag));
    }
  }

  return {
    itemsWithTags,
    uniqueTags: allTags.size,
    tags: Array.from(allTags).sort()
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Main function
  processMenuItemTags,

  // Helper functions (exported for testing)
  processItem,
  buildCategoryTagMap,
  stripAbbreviations,
  normalizeTagName,
  getTagStats,
  matchesAsWord,

  // Configuration (exported for testing/extension)
  ABBREVIATION_MAP,
  KEYWORD_TAG_MAP,
  CONSOLIDATED_TAG_MAP,
  CATEGORY_TAG_PATTERNS
};
