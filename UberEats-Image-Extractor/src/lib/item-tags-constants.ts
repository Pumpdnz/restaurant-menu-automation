/**
 * Menu Item Tag Constants
 * Preset tags organized by category for quick selection in menu editor
 */

// ============================================
// TAG STYLING (matches ordering page CSS injection)
// ============================================

export interface TagStyle {
  gradient: string;
  borderColor: string;
  shadowColor: string;
}

/**
 * Styling for preset tags matching the ordering page appearance
 * These gradients come from the default head code injection
 */
export const TAG_STYLES: Record<string, TagStyle> = {
  // Dietary tags
  'vegan': {
    gradient: 'linear-gradient(135deg, #26c526, #166a16)',
    borderColor: '#166a16',
    shadowColor: 'rgba(38, 197, 38, 0.3)'
  },
  'vegetarian': {
    gradient: 'linear-gradient(135deg, #32CD32, #36AB36)',
    borderColor: '#36AB36',
    shadowColor: 'rgba(50, 205, 50, 0.3)'
  },
  'gluten free': {
    gradient: 'linear-gradient(135deg, #FFB347, #FF8C00)',
    borderColor: '#FF8C00',
    shadowColor: 'rgba(255, 140, 0, 0.3)'
  },
  'spicy': {
    gradient: 'linear-gradient(135deg, #FF6B6B, #FF3333)',
    borderColor: '#FF3333',
    shadowColor: 'rgba(255, 51, 51, 0.3)'
  },
  'hot': {
    gradient: 'linear-gradient(135deg, #FF6B6B, #FF3333)',
    borderColor: '#FF3333',
    shadowColor: 'rgba(255, 51, 51, 0.3)'
  },
  'dairy free': {
    gradient: 'linear-gradient(135deg, #87CEEB, #4682B4)',
    borderColor: '#4682B4',
    shadowColor: 'rgba(70, 130, 180, 0.3)'
  },
  'nut free': {
    gradient: 'linear-gradient(135deg, #DEB887, #8B7355)',
    borderColor: '#8B7355',
    shadowColor: 'rgba(139, 115, 85, 0.3)'
  },
  'halal': {
    gradient: 'linear-gradient(135deg, #019000, #B8860B)',
    borderColor: '#B8860B',
    shadowColor: 'rgba(184, 134, 11, 0.3)'
  },
  // Popular tags
  'popular': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'most liked': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'favourite': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'must try': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'recommended': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'trending': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'highly rated': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'specialty': {
    gradient: 'linear-gradient(135deg, #b400fa, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  // New tags
  'new': {
    gradient: 'linear-gradient(135deg, #ff0000, #3f92ff)',
    borderColor: '#3f92ff',
    shadowColor: 'rgba(63, 146, 255, 0.3)'
  },
  'limited time': {
    gradient: 'linear-gradient(135deg, #ff0000, #3f92ff)',
    borderColor: '#3f92ff',
    shadowColor: 'rgba(63, 146, 255, 0.3)'
  },
  'limited time only': {
    gradient: 'linear-gradient(135deg, #ff0000, #3f92ff)',
    borderColor: '#3f92ff',
    shadowColor: 'rgba(63, 146, 255, 0.3)'
  },
  'seasonal': {
    gradient: 'linear-gradient(135deg, #ff0000, #3f92ff)',
    borderColor: '#3f92ff',
    shadowColor: 'rgba(63, 146, 255, 0.3)'
  },
  'while stock lasts': {
    gradient: 'linear-gradient(135deg, #ff0000, #3f92ff)',
    borderColor: '#3f92ff',
    shadowColor: 'rgba(63, 146, 255, 0.3)'
  },
  'today only': {
    gradient: 'linear-gradient(135deg, #ff0000, #3f92ff)',
    borderColor: '#3f92ff',
    shadowColor: 'rgba(63, 146, 255, 0.3)'
  },
  // Deal tags
  'deal': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'promo': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'promotion': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'special': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'buy 1 get 1': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  '2 for 1': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'combo': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'free item': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'free gift': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  },
  'discount': {
    gradient: 'linear-gradient(135deg, #4fc060, #ff0000)',
    borderColor: '#ff0000',
    shadowColor: 'rgba(255, 0, 0, 0.3)'
  }
};

/**
 * Get the style for a tag (case-insensitive lookup)
 */
export function getTagStyle(tag: string): TagStyle | null {
  return TAG_STYLES[tag.toLowerCase()] || null;
}

// ============================================
// PRESET TAG ARRAYS BY CATEGORY
// ============================================

export const DIETARY_TAGS = [
  'Vegan',
  'Vegetarian',
  'Gluten free',
  'Dairy free',
  'Halal',
  'Nut free',
  'Spicy'
] as const;

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

export const NEW_TAGS = [
  'New',
  'Limited Time',
  'Limited Time Only',
  'Seasonal',
  'While Stock Lasts',
  'Today Only'
] as const;

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

// ============================================
// CATEGORY CONFIGURATION
// ============================================

export const TAG_CATEGORIES = {
  dietary: {
    label: 'Dietary',
    tags: DIETARY_TAGS,
    icon: 'Leaf'
  },
  popular: {
    label: 'Popular',
    tags: POPULAR_TAGS,
    icon: 'Star'
  },
  new: {
    label: 'New & Limited',
    tags: NEW_TAGS,
    icon: 'Sparkles'
  },
  deal: {
    label: 'Deals & Promos',
    tags: DEAL_TAGS,
    icon: 'Tag'
  }
} as const;

// ============================================
// FLAT ARRAY & LOOKUP SET
// ============================================

export const ALL_PRESET_TAGS = [
  ...DIETARY_TAGS,
  ...POPULAR_TAGS,
  ...NEW_TAGS,
  ...DEAL_TAGS
] as const;

export type PresetTagValue = typeof ALL_PRESET_TAGS[number];

const PRESET_TAG_SET = new Set<string>(ALL_PRESET_TAGS);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a tag is a preset tag (O(1) lookup)
 */
export function isPresetTag(tag: string): boolean {
  return PRESET_TAG_SET.has(tag);
}

/**
 * Get the category key for a preset tag
 */
export function getTagCategory(tag: string): keyof typeof TAG_CATEGORIES | null {
  for (const [key, category] of Object.entries(TAG_CATEGORIES)) {
    if ((category.tags as readonly string[]).includes(tag)) {
      return key as keyof typeof TAG_CATEGORIES;
    }
  }
  return null;
}

/**
 * Normalize tag for comparison (lowercase, trimmed)
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Check if tag already exists in array (case-insensitive)
 */
export function tagExists(tags: string[], newTag: string): boolean {
  const normalized = normalizeTag(newTag);
  return tags.some(t => normalizeTag(t) === normalized);
}
