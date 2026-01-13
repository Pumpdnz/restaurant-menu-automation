/**
 * Common Images Service
 *
 * Provides automatic association of common product images (beverages, etc.)
 * to menu items during extraction processing.
 *
 * Two modes of operation:
 * 1. FILL MISSING: Associate images for items without images
 * 2. PRIORITY REPLACE: Replace extracted images with high-quality common images
 *
 * Uses confidence-based matching with hierarchical scoring:
 * - Exact name/alias match: baseConfidence (0.90-0.95)
 * - Keyword match: baseConfidence × 0.85
 * - Name contains: baseConfidence × 0.75
 * - Partial keyword: baseConfidence × 0.60
 *
 * Size-aware matching:
 * - Parses size from item names (e.g., "600ml", "1.5L")
 * - Maps sizes to container types: ≤375ml → can, 600ml → bottle, ≥1000ml → large-bottle
 * - Boosts confidence for exact size/container matches
 * - Reduces confidence for container type mismatches
 */

// =============================================================================
// SIZE PARSING UTILITIES
// =============================================================================

/**
 * Parse size in millilitres from an item name
 * Handles formats like: 600ml, 330 ml, 1.5L, 1.5 Litre, 1L
 *
 * @param {string} itemName - Menu item name to parse
 * @returns {number|null} - Size in ml, or null if not found
 */
function parseSize(itemName) {
  if (!itemName || typeof itemName !== 'string') return null;

  const normalized = itemName.toLowerCase();

  // Match ml format: "600ml", "330 ml", "600ML"
  const mlMatch = normalized.match(/(\d+)\s*ml/i);
  if (mlMatch) return parseInt(mlMatch[1], 10);

  // Match litre format: "1.5L", "1.5 L", "1.5 Litre", "1.5 litre", "2 Litres"
  const litreMatch = normalized.match(/(\d+\.?\d*)\s*(?:l(?:itre)?s?)\b/i);
  if (litreMatch) return Math.round(parseFloat(litreMatch[1]) * 1000);

  return null;
}

/**
 * Determine container type based on size in ml
 *
 * @param {number|null} sizeML - Size in millilitres
 * @returns {string|null} - 'can', 'bottle', or 'large-bottle', or null if unknown
 */
function getContainerType(sizeML) {
  if (!sizeML) return null;
  if (sizeML <= 375) return 'can';
  if (sizeML <= 750) return 'bottle';
  return 'large-bottle';
}

// =============================================================================
// CONFIGURATION: Common Images Library
// =============================================================================

/**
 * Common images data - copied from common-images-constants.ts for backend use
 *
 * Properties:
 * - id: Unique identifier
 * - name: Display name
 * - category: 'beverage' | 'side' | 'condiment'
 * - imageUrl: UCare CDN URL
 * - aliases: Alternative names for exact matching
 * - matchKeywords: Keywords for partial matching
 * - confidence: Base confidence score (0.0-1.0)
 * - priorityReplace: true = Always use this image, even if item already has an image
 * - containerType: 'can' | 'bottle' | 'large-bottle' | null
 * - sizeML: Size in millilitres (330, 600, 1500, etc.)
 */
const COMMON_IMAGES = [
  // ==========================================================================
  // COCA-COLA PRODUCTS
  // ==========================================================================

  // Coke Classic - Can (330ml)
  {
    id: 'coke-can',
    name: 'Coke Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e6ec07ed-0ce3-4b98-9725-7d5eb53d69b7/-/progressive/yes/coke_can.jpeg',
    aliases: ['coca cola', 'coca-cola', 'coke'],
    matchKeywords: ['coke', 'coca cola', 'coca-cola', 'coke 330ml', 'coke can', 'coke range', 'coca cola range', 'coca-cola range'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Coke Classic - 600ml Bottle
  {
    id: 'coke-bottle-600ml',
    name: 'Coke Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/6154dc93-f10e-4c9e-bdfa-6b2d3a0e5359/-/progressive/yes/coke_600ml_bottle.jpeg',
    aliases: ['coke bottle', 'coca cola bottle', 'coke 600ml'],
    matchKeywords: ['coke 600ml', 'coca cola 600ml', 'coke bottle', 'coca cola bottle', 'coke range 600ml', 'coca cola range 600ml', 'coca-cola range 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Coke Classic - 1.5L Bottle
  {
    id: 'coke-bottle-1.5l',
    name: 'Coke Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/75b5ec51-111a-43ee-a7a2-43f85aafc44e/-/progressive/yes/coke_1_5_litre.jpeg',
    aliases: ['coke 1.5l', 'coca cola 1.5l', 'coke 1.5 litre'],
    matchKeywords: ['coke 1.5l', 'coca cola 1.5l', 'coke 1.5 litre', 'coke 1500ml', 'coke range 1.5l', 'coca cola range 1.5l', 'coca-cola range 1.5l'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // Coke Zero - Can (330ml)
  {
    id: 'coke-zero-can',
    name: 'Coke Zero Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/08dc7d29-564c-45a5-9870-bb92b7062970/-/progressive/yes/coke_zero_can.jpeg',
    aliases: ['coke zero', 'coca cola zero', 'zero sugar coke', 'coke no sugar', 'coca cola no sugar', 'coca-cola no sugar', 'coke zero sugar', 'coca cola zero sugar'],
    matchKeywords: ['coke zero', 'coca cola zero', 'zero coke', 'diet coke', 'coke no sugar', 'coca cola no sugar', 'coke zero sugar', 'coca cola zero sugar', 'coke zero 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Coke Zero - 600ml Bottle
  {
    id: 'coke-zero-bottle-600ml',
    name: 'Coke Zero Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/98d37740-62f9-49b5-bb1e-1bb9bb9fd285/-/progressive/yes/coke_zero_sugar_600ml.jpeg',
    aliases: ['coke zero bottle', 'coke no sugar bottle', 'coke zero 600ml', 'coca cola no sugar 600ml', 'coca cola zero 600ml'],
    matchKeywords: ['coke zero 600ml', 'coke zero sugar 600ml', 'coke no sugar 600ml', 'coca cola no sugar 600ml', 'coke zero bottle', 'diet coke 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Coke Zero - 1.5L Bottle
  {
    id: 'coke-zero-bottle-1.5l',
    name: 'Coke Zero Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/86a855d8-0784-402d-ab7f-35201e1430ec/-/progressive/yes/coke_zero_sugar_1_5_litre.jpeg',
    aliases: ['coke zero 1.5l', 'coke no sugar 1.5l', 'coke zero 1.5 litre', 'coca cola no sugar 1.5l', 'coca cola zero 1.5l'],
    matchKeywords: ['coke zero 1.5l', 'coke zero sugar 1.5l', 'coke no sugar 1.5l', 'coca cola no sugar 1.5l', 'coke zero 1.5 litre', 'diet coke 1.5l'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // Vanilla Coke - Can
  {
    id: 'vanilla-coke-can',
    name: 'Vanilla Coke Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/40fba2e1-34cb-462f-9c99-6d85e249dc9e/-/progressive/yes/vanilla_coke.jpeg',
    aliases: ['Vanilla Coke', 'Vanilla Coke Can'],
    matchKeywords: ['vanilla coke', 'vanilla coke can', 'vanilla coca cola', 'coke vanilla'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Vanilla Coke - 600ml Bottle
  {
    id: 'vanilla-coke-bottle-600ml',
    name: 'Vanilla Coke Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/cc3b416a-1245-479e-9234-3a42e9b238ca/-/progressive/yes/vanilla_coke_600ml.jpeg',
    aliases: ['Vanilla Coke Bottle', 'Vanilla Coke Bottle', 'Vanilla Coke 600ml'],
    matchKeywords: ['vanilla coke 600ml', 'vanilla coke 600ml', 'vanilla coke 600ml', 'vanilla coke bottle', 'vanilla coke 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },

  // Vanilla Coke Zero - Can
  {
    id: 'vanilla-coke-zero-can',
    name: 'Vanilla Coke Zero Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/31652ce6-9510-4f96-bbf6-6d650fa3db96/-/progressive/yes/vanilla_coke_zero.jpeg',
    aliases: ['Vanilla Coke Zero', 'Vanilla Coke Zero Sugar', 'Vanilla Diet Coke'],
    matchKeywords: ['vanilla coke zero', 'vanilla coke zero sugar', 'vanilla diet coke', 'vanilla coke no sugar'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Vanilla Coke Zero - 600ml Bottle
  {
    id: 'vanilla-coke-zero-bottle-600ml',
    name: 'Vanilla Coke Zero Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e8f68edf-bb44-4eb6-9f5f-ff8218dfa890/-/progressive/yes/coke_vanilla_zero_sugar_600ml_bottle.jpeg',
    aliases: ['Vanilla Coke Zero Bottle', 'Vanilla Coke No Sugar Bottle', 'Vanilla Coke Zero 600ml'],
    matchKeywords: ['vanilla coke zero 600ml', 'vanilla coke zero sugar 600ml', 'vanilla coke no sugar 600ml', 'vanilla coke zero bottle', 'vanilla diet coke 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },

  // ==========================================================================
  // SPRITE PRODUCTS
  // ==========================================================================

  // Sprite - Can (330ml)
  {
    id: 'sprite-can',
    name: 'Sprite Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/44bb90eb-6dcd-478b-86bb-417afd8d2723/-/progressive/yes/sprite_new_logo_335ml_can.jpg',
    aliases: ['sprite', 'sprite lemonade'],
    matchKeywords: ['sprite', 'sprite can', 'sprite 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Sprite - 600ml Bottle
  {
    id: 'sprite-bottle-600ml',
    name: 'Sprite Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/175b18b0-f7f3-48eb-8b08-588c36f94949/-/progressive/yes/sprite_600ml_bottle.jpg',
    aliases: ['sprite bottle', 'sprite 600ml'],
    matchKeywords: ['sprite 600ml', 'sprite bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Sprite - 1.5L Bottle
  {
    id: 'sprite-bottle-1.5l',
    name: 'Sprite Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/26e314c7-45eb-478a-9945-52b63da805f4/-/progressive/yes/sprite_1_5_litre.jpeg',
    aliases: ['sprite 1.5l', 'sprite 1.5 litre'],
    matchKeywords: ['sprite 1.5l', 'sprite 1.5 litre', 'sprite 1500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // Sprite Zero - Can (330ml)
  {
    id: 'sprite-zero-can',
    name: 'Sprite Zero Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e5200937-98bb-4760-b783-e5e56467cbc8/-/progressive/yes/sprite_zero_335ml_can.jpg',
    aliases: ['sprite zero', 'sprite zero sugar', 'diet sprite', 'sprite no sugar'],
    matchKeywords: ['sprite zero', 'diet sprite', 'sprite zero sugar', 'sprite no sugar', 'sprite zero 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Sprite Zero - 600ml Bottle
  {
    id: 'sprite-zero-bottle-600ml',
    name: 'Sprite Zero Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/5e811c79-0524-4d5c-a739-e88ebe07294b/-/progressive/yes/sprite_zero_600ml_bottle.jpg',
    aliases: ['sprite zero bottle', 'sprite zero 600ml', 'sprite no sugar bottle', 'sprite no sugar 600ml'],
    matchKeywords: ['sprite zero 600ml', 'sprite no sugar 600ml', 'sprite zero bottle', 'diet sprite 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Sprite Zero - 1.5L Bottle
  {
    id: 'sprite-zero-bottle-1.5l',
    name: 'Sprite Zero Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/3a5f0640-f64d-4fd8-a1f7-cd4e6cf2baee/-/progressive/yes/sprite_zero_sugar_1_5_litre.jpeg',
    aliases: ['sprite zero 1.5l', 'sprite no sugar 1.5l', 'sprite zero 1.5 litre', 'sprite no sugar 1.5 litre'],
    matchKeywords: ['sprite zero 1.5l', 'sprite no sugar 1.5l', 'diet sprite 1.5l'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // ==========================================================================
  // FANTA PRODUCTS
  // ==========================================================================

  // Fanta Orange - Can (330ml)
  {
    id: 'fanta-can',
    name: 'Fanta Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/18a3cc12-6e9a-4931-80c2-78b672367a4c/-/progressive/yes/fanta_orange_background.webp',
    aliases: ['fanta', 'fanta orange'],
    matchKeywords: ['fanta', 'fanta orange', 'orange fanta', 'fanto', 'fanta 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Fanta - 600ml Bottle
  {
    id: 'fanta-bottle-600ml',
    name: 'Fanta Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e3b507bd-5f9f-49eb-b271-bc3d6851e3b4/-/progressive/yes/fanta_bottle_600ml.jpeg',
    aliases: ['fanta bottle', 'fanta 600ml', 'fanta orange bottle'],
    matchKeywords: ['fanta 600ml', 'fanta bottle', 'fanta orange 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Fanta - 1.5L Bottle
  {
    id: 'fanta-bottle-1.5l',
    name: 'Fanta Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/349d29f2-2cd9-4485-9539-1dbde9113a7d/-/progressive/yes/fanta_1_5_litre.jpeg',
    aliases: ['fanta 1.5l', 'fanta 1.5 litre', 'fanta orange 1.5l'],
    matchKeywords: ['fanta 1.5l', 'fanta 1.5 litre', 'fanta 1500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // ==========================================================================
  // L&P PRODUCTS
  // ==========================================================================

  // L&P - Can (330ml)
  {
    id: 'lp-can',
    name: 'L&P Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/c30c4731-b4ad-4b01-9fdf-f2300028c85b/-/progressive/yes/l_P.jpeg',
    aliases: ['l&p', 'lemon & paeroa', 'lemon and paeroa', 'l and p'],
    matchKeywords: ['l&p', 'lemon paeroa', 'l and p', 'lp', 'l & p', 'l&p 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // L&P - 600ml Bottle
  {
    id: 'lp-bottle-600ml',
    name: 'L&P Bottle 600ml',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/2bd09a50-1fd2-4e89-bac3-139d527257ba/-/progressive/yes/l_p_bottle_600ml.jpeg',
    aliases: ['l&p bottle', 'l&p 600ml', 'lemon & paeroa bottle'],
    matchKeywords: ['l&p 600ml', 'lp 600ml', 'l&p bottle', 'lemon paeroa 600ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // L&P - 1.5L Bottle
  {
    id: 'lp-bottle-1.5l',
    name: 'L&P Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/81153992-6fac-4dc9-a7b9-723c84c850a0/-/progressive/yes/L_P_1_5_litre.jpeg',
    aliases: ['l&p 1.5l', 'l&p 1.5 litre', 'lemon & paeroa 1.5l'],
    matchKeywords: ['l&p 1.5l', 'lp 1.5l', 'l&p 1.5 litre', 'lemon paeroa 1.5l'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // ==========================================================================
  // PEPSI PRODUCTS
  // ==========================================================================

  // Pepsi - Can (330ml)
  {
    id: 'pepsi-can',
    name: 'Pepsi Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/4a48c124-a56a-40fb-b056-b9b4ef23fedf/-/progressive/yes/pepsi.jpeg',
    aliases: ['pepsi', 'pepsi cola'],
    matchKeywords: ['pepsi', 'pepsi cola', 'pepsi can', 'pepsi 330ml', 'pepsi range', 'pepsi cola range'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Pepsi - 600ml Bottle (placeholder for future)
  {
    id: 'pepsi-bottle-600ml',
    name: 'Pepsi Bottle 600ml',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_pepsi_bottle_600ml',
    aliases: ['pepsi bottle', 'pepsi 600ml'],
    matchKeywords: ['pepsi 600ml', 'pepsi bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Pepsi - 1.5L Bottle (placeholder for future)
  {
    id: 'pepsi-bottle-1.5l',
    name: 'Pepsi Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_pepsi_bottle_1.5l',
    aliases: ['pepsi 1.5l', 'pepsi 1.5 litre'],
    matchKeywords: ['pepsi 1.5l', 'pepsi 1.5 litre', 'pepsi 1500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // Pepsi Max - Can (330ml)
  {
    id: 'pepsi-max-can',
    name: 'Pepsi Max Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/6808e8c9-816f-4544-918d-4290da742cde/-/progressive/yes/pepsi_max.jpeg',
    aliases: ['pepsi max', 'pepsi max cola', 'pepsi zero sugar'],
    matchKeywords: ['pepsi max', 'pepsi max can', 'pepsi max 330ml', 'pepsi zero', 'pepsi no sugar'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Pepsi Max - 600ml Bottle (placeholder for future)
  {
    id: 'pepsi-max-bottle-600ml',
    name: 'Pepsi Max Bottle 600ml',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_pepsi_max_bottle_600ml',
    aliases: ['pepsi max bottle', 'pepsi max 600ml'],
    matchKeywords: ['pepsi max 600ml', 'pepsi max bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Pepsi Max - 1.5L Bottle (placeholder for future)
  {
    id: 'pepsi-max-bottle-1.5l',
    name: 'Pepsi Max Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_pepsi_max_bottle_1.5l',
    aliases: ['pepsi max 1.5l', 'pepsi max 1.5 litre'],
    matchKeywords: ['pepsi max 1.5l', 'pepsi max 1.5 litre', 'pepsi max 1500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // Pepsi Max Raspberry - Can (330ml)
  {
    id: 'pepsi-max-raspberry-can',
    name: 'Pepsi Max Raspberry Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/51b988c6-ab9f-433f-b34a-78cdffe88992/-/progressive/yes/pepsi_max_raspberry.jpeg',
    aliases: ['pepsi max raspberry', 'pepsi raspberry'],
    matchKeywords: ['pepsi max raspberry', 'pepsi raspberry', 'pepsi max raspberry can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Pepsi Max Vanilla - Can (330ml)
  {
    id: 'pepsi-max-vanilla-can',
    name: 'Pepsi Max Vanilla Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/2dbb95b3-af2e-4ac5-80e8-190c3960ce1a/-/progressive/yes/pepsi_max_vanilla.jpeg',
    aliases: ['pepsi max vanilla', 'pepsi vanilla'],
    matchKeywords: ['pepsi max vanilla', 'pepsi vanilla', 'pepsi max vanilla can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Mountain Dew - Can (330ml)
  {
    id: 'mountain-dew-can',
    name: 'Mountain Dew Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/dbe92ec8-c8a9-402f-b035-5617f3746f68/-/progressive/yes/mountain_dew_can.jpeg',
    aliases: ['mountain dew', 'mtn dew'],
    matchKeywords: ['mountain dew', 'mtn dew', 'mountain dew can', 'mountain dew 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Mountain Dew - 600ml Bottle (placeholder for future)
  {
    id: 'mountain-dew-bottle-600ml',
    name: 'Mountain Dew Bottle 600ml',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_mountain_dew_bottle_600ml',
    aliases: ['mountain dew bottle', 'mountain dew 600ml'],
    matchKeywords: ['mountain dew 600ml', 'mtn dew 600ml', 'mountain dew bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // Mountain Dew - 1.5L Bottle (placeholder for future)
  {
    id: 'mountain-dew-bottle-1.5l',
    name: 'Mountain Dew Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_mountain_dew_bottle_1.5l',
    aliases: ['mountain dew 1.5l', 'mountain dew 1.5 litre'],
    matchKeywords: ['mountain dew 1.5l', 'mtn dew 1.5l', 'mountain dew 1500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // Mountain Dew Passionfruit - Can (330ml)
  {
    id: 'mountain-dew-passionfruit-can',
    name: 'Mountain Dew Passionfruit Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e2dc8473-968b-4317-92da-00c3681484cf/-/progressive/yes/mountain_dew_passionfruit.jpeg',
    aliases: ['mountain dew passionfruit', 'mtn dew passionfruit'],
    matchKeywords: ['mountain dew passionfruit', 'mtn dew passionfruit', 'mountain dew passionfruit can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // 7up - Can (330ml)
  {
    id: '7up-can',
    name: '7up Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/fa284141-9184-4f0e-9a10-405634b5e82d/-/progressive/yes/7_up_can.jpeg',
    aliases: ['7up', '7 up', 'seven up'],
    matchKeywords: ['7up', '7 up', 'seven up', '7up can', '7up 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // 7up Sugar Free - Can (330ml)
  {
    id: '7up-sugar-free-can',
    name: '7up Sugar Free Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/22424112-345d-4c86-a1e9-9fa10c97ee6f/-/progressive/yes/7_up_zero_sugar.jpeg',
    aliases: ['7up sugar free', '7 up sugar free', 'seven up sugar free', '7up free', '7up zero', '7 up zero', 'seven up zero'],
    matchKeywords: ['7up sugar free', '7 up sugar free', 'seven up sugar free', '7up free', '7up diet', '7up zero', '7 up zero', 'seven up zero'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // 7up - 600ml Bottle (placeholder for future)
  {
    id: '7up-bottle-600ml',
    name: '7up Bottle 600ml',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_7up_bottle_600ml',
    aliases: ['7up bottle', '7up 600ml'],
    matchKeywords: ['7up 600ml', '7 up 600ml', 'seven up 600ml', '7up bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },
  // 7up - 1.5L Bottle (placeholder for future)
  {
    id: '7up-bottle-1.5l',
    name: '7up Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_7up_bottle_1.5l',
    aliases: ['7up 1.5l', '7up 1.5 litre'],
    matchKeywords: ['7up 1.5l', '7 up 1.5l', 'seven up 1.5l', '7up 1500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // ==========================================================================
  // LIFT PRODUCTS
  // ==========================================================================

  // Lift - Can
  {
    id: 'lift-can',
    name: 'Lift Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e29f7507-cf60-44ed-99c7-d8cc71b41be7/-/progressive/yes/lift.jpeg',
    aliases: ['lift', 'lift can'],
    matchKeywords: ['lift', 'lift can', 'lift 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Lift - 1.5L Bottle
  {
    id: 'lift-bottle-1.5l',
    name: 'Lift Bottle 1.5L',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/0576b147-8f53-472d-b876-6400ede9b205/-/progressive/yes/lift_1_5_litre_2.jpeg',
    aliases: ['lift 1.5l', 'lift 1.5 litre', 'lift bottle'],
    matchKeywords: ['lift 1.5l', 'lift 1.5l', 'lift 1.5 litre', 'lift bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'large-bottle',
    sizeML: 1500
  },

  // ==========================================================================
  // OTHER SOFT DRINKS
  // ==========================================================================

  // Sparkling Duet - Orange (primary)
  {
    id: 'sparkling-duet-orange-can',
    name: 'Sparkling Duet Orange Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/4abfbc62-699e-4dec-8cf3-2c8392cede62/-/progressive/yes/sparkling_duet.jpeg',
    aliases: ['sparkling duet', 'sparkling duet orange', 'duet orange'],
    matchKeywords: ['sparkling duet', 'sparkling duet orange', 'duet orange', 'sparkling duet can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Sparkling Duet - Lemon
  {
    id: 'sparkling-duet-lemon-can',
    name: 'Sparkling Duet Lemon Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/b859bb66-4560-49de-89df-b189e047e489/-/progressive/yes/sparkling_duet_can_lemon.jpeg',
    aliases: ['sparkling duet lemon', 'duet lemon'],
    matchKeywords: ['sparkling duet lemon', 'duet lemon'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },
  // Sparkling Duet - Raspberry
  {
    id: 'sparkling-duet-raspberry-can',
    name: 'Sparkling Duet Raspberry Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e6373d05-1f16-4979-b410-639b16c7c4aa/-/progressive/yes/sparkling_duet_can_raspberry.jpeg',
    aliases: ['sparkling duet raspberry', 'duet raspberry'],
    matchKeywords: ['sparkling duet raspberry', 'duet raspberry'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // ==========================================================================
  // INTERNATIONAL BRANDS
  // ==========================================================================

  // Limca Lemonade - Can
  {
    id: 'limca-can',
    name: 'Limca Lemonade Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/3ad3908f-8f98-49a2-ab6f-af9c03000a9b/-/progressive/yes/limca.png',
    aliases: ['limca', 'limca lemonade'],
    matchKeywords: ['limca', 'limca lemonade'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Thumbs Up Cola - Can
  {
    id: 'thumbs-up-can',
    name: 'Thumbs Up Cola Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/39e6e789-ab80-4cd3-b09e-e61cfd6ec0e2/-/crop/957x1015/0,0/-/preview//-/progressive/yes/thumbs_up.jpg',
    aliases: ['thumbs up', 'thums up', 'thumbs up cola'],
    matchKeywords: ['thumbs up', 'thums up', 'thumbs up cola'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // ==========================================================================
  // KARMA COLA PRODUCTS
  // ==========================================================================

  // Karma Cola - Bottle (300ml)
  {
    id: 'karma-cola-bottle',
    name: 'Karma Cola Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/754117e6-451b-46b7-88b9-6f915ba6c488/-/progressive/yes/karma_cola.jpeg',
    aliases: ['karma cola', 'karma', 'karma drinks'],
    matchKeywords: ['karma cola', 'karma', 'karma drink', 'karma cola bottle', 'karma range', 'karma drinks', 'karma cola range'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },
  // Karma Cola - Can (placeholder for future)
  {
    id: 'karma-cola-can',
    name: 'Karma Cola Can',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_karma_cola_can',
    aliases: ['karma cola can'],
    matchKeywords: ['karma cola can', 'karma can', 'karma cola 330ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Karma Cola Sugar Free - Bottle (300ml)
  {
    id: 'karma-cola-sugar-free-bottle',
    name: 'Karma Cola Sugar Free Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e7b6c233-c175-4e75-a8e7-9e496d1220f6/-/progressive/yes/karma_cola_sugar_free.jpeg',
    aliases: ['karma cola sugar free', 'karma sugar free', 'karma zero'],
    matchKeywords: ['karma cola sugar free', 'karma sugar free', 'karma zero', 'karma no sugar', 'karma cola zero'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },
  // Karma Cola Sugar Free - Can (placeholder for future)
  {
    id: 'karma-cola-sugar-free-can',
    name: 'Karma Cola Sugar Free Can',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_karma_cola_sugar_free_can',
    aliases: ['karma cola sugar free can', 'karma sugar free can'],
    matchKeywords: ['karma cola sugar free can', 'karma sugar free can', 'karma zero can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Gingerella Ginger Beer - Bottle (300ml)
  {
    id: 'gingerella-ginger-beer-bottle',
    name: 'Gingerella Ginger Beer Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/c4aa652b-5205-4872-86a5-c8f87ecb8013/-/progressive/yes/gingerella.jpeg',
    aliases: ['gingerella', 'gingerella ginger beer', 'karma ginger beer'],
    matchKeywords: ['gingerella', 'gingerella ginger beer', 'karma ginger beer', 'gingerella bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },
  // Gingerella Ginger Beer - Can (placeholder for future)
  {
    id: 'gingerella-ginger-beer-can',
    name: 'Gingerella Ginger Beer Can',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_gingerella_ginger_beer_can',
    aliases: ['gingerella can', 'gingerella ginger beer can'],
    matchKeywords: ['gingerella can', 'gingerella ginger beer can', 'karma ginger beer can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Lemmy Lemonade - Bottle (300ml)
  {
    id: 'lemmy-lemonade-bottle',
    name: 'Lemmy Lemonade Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/d24568f4-e78b-4450-9d4b-688b22fcbbd1/-/progressive/yes/lemmy_lemonade_sugar_free.jpeg',
    aliases: ['lemmy', 'lemmy lemonade', 'karma lemonade'],
    matchKeywords: ['lemmy', 'lemmy lemonade', 'karma lemonade', 'lemmy bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },
  // Lemmy Lemonade - Can (placeholder for future)
  {
    id: 'lemmy-lemonade-can',
    name: 'Lemmy Lemonade Can',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_lemmy_lemonade_can',
    aliases: ['lemmy can', 'lemmy lemonade can'],
    matchKeywords: ['lemmy can', 'lemmy lemonade can', 'karma lemonade can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Lemmy Lemonade Sugar Free - Bottle (300ml)
  {
    id: 'lemmy-lemonade-sugar-free-bottle',
    name: 'Lemmy Lemonade Sugar Free Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/21373846-b769-4d18-9dd3-cf9f44e4dfbd/-/progressive/yes/lemmy_lemonade_sugar_free.jpeg',
    aliases: ['lemmy sugar free', 'lemmy lemonade sugar free', 'lemmy zero'],
    matchKeywords: ['lemmy sugar free', 'lemmy lemonade sugar free', 'lemmy zero', 'lemmy no sugar'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },
  // Lemmy Lemonade Sugar Free - Can (placeholder for future)
  {
    id: 'lemmy-lemonade-sugar-free-can',
    name: 'Lemmy Lemonade Sugar Free Can',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_lemmy_lemonade_sugar_free_can',
    aliases: ['lemmy sugar free can', 'lemmy lemonade sugar free can'],
    matchKeywords: ['lemmy sugar free can', 'lemmy lemonade sugar free can', 'lemmy zero can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // Razza Raspberry Lemonade - Bottle (300ml)
  {
    id: 'razza-raspberry-lemonade-bottle',
    name: 'Razza Raspberry Lemonade Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/47d98b16-b6a4-4151-8c47-e6d47d8b1397/-/progressive/yes/razza.jpeg',
    aliases: ['razza', 'razza raspberry', 'razza raspberry lemonade', 'karma raspberry'],
    matchKeywords: ['razza', 'razza raspberry', 'razza raspberry lemonade', 'karma raspberry', 'razza bottle'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },
  // Razza Raspberry Lemonade - Can (placeholder for future)
  {
    id: 'razza-raspberry-lemonade-can',
    name: 'Razza Raspberry Lemonade Can',
    category: 'beverage',
    imageUrl: 'PLACEHOLDER_URL_razza_raspberry_lemonade_can',
    aliases: ['razza can', 'razza raspberry can'],
    matchKeywords: ['razza can', 'razza raspberry can', 'razza raspberry lemonade can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 330
  },

  // ==========================================================================
  // OTHER INTERNATIONAL BRANDS
  // ==========================================================================

  // Bundaberg Ginger Beer
  {
    id: 'bundaberg-ginger-beer',
    name: 'Bundaberg Ginger Beer',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/246c901e-7476-40ff-98ed-7e1d71d76125/-/progressive/yes/ginger_beer.jpeg',
    aliases: ['bundaberg', 'bundaberg ginger beer', 'bundy ginger beer'],
    matchKeywords: ['bundaberg', 'bundaberg ginger', 'bundy ginger beer', 'bundaberg range'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 375
  },

  // ==========================================================================
  // MIXERS & PREMIUM BEVERAGES
  // ==========================================================================

  // Schweppes Ginger Beer
  {
    id: 'schweppes-ginger-beer',
    name: 'Schweppes Ginger Beer Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/adce64c4-774f-4fd9-86ce-c8ceb6779770/-/progressive/yes/ginger_beer.jpeg',
    aliases: ['schweppes ginger beer', 'ginger beer'],
    matchKeywords: ['schweppes ginger beer', 'ginger beer', 'schweppes ginger'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },

  // Schweppes Lemonade
  {
    id: 'schweppes-lemonade',
    name: 'Schweppes Lemonade Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/27805bd0-cf62-4a14-a46d-13d6abb8ae29/-/progressive/yes/lemonade.jpeg',
    aliases: ['schweppes lemonade', 'schweppes lemon'],
    matchKeywords: ['schweppes lemonade', 'schweppes lemon'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },

  // Schweppes Lemon Lime & Bitters
  {
    id: 'schweppes-llb',
    name: 'Schweppes Lemon Lime & Bitters',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/d463cb07-b890-4838-a9ca-e118133d0f82/-/progressive/yes/lemon_lime_and_bitters.jpeg',
    aliases: ['schweppes llb', 'lemon lime bitters', 'llb', 'schweppes lemon lime bitters', 'schweppes lemon, lime & bitters', 'lemon lime & bitters', 'lemon, lime & bitters'],
    matchKeywords: ['schweppes lemon lime', 'lemon lime bitters', 'llb', 'schweppes llb', 'schweppes lemon, lime', 'lemon lime & bitters'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 300
  },

  // ==========================================================================
  // WATER PRODUCTS
  // ==========================================================================

  // Pump Water Bottle (750ml)
  {
    id: 'pump-water',
    name: 'Pump Water Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/02beec57-9586-49cb-b714-e3040b273355/-/progressive/yes/pump_water_750ml_transparent_bg.png',
    aliases: ['pump water', 'pump bottle'],
    matchKeywords: ['pump water', 'pump bottle', 'pump 750ml'],
    confidence: 0.90,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 750
  },

  // Pump Mini Water Bottle (350ml)
  {
    id: 'pump-mini-water',
    name: 'Pump Mini Water Bottle',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/9e01e830-f4ff-4fc2-b456-7d6f7338950b/-/progressive/yes/beverages-70aa2a4db7f990373ca9c376323e3dea.jpeg',
    aliases: ['pump mini', 'pump mini water', 'small pump'],
    matchKeywords: ['pump mini', 'mini pump', 'small pump', 'pump small', 'pump 350ml'],
    confidence: 0.90,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // ==========================================================================
  // COFFEE/ESPRESSO PRODUCTS
  // ==========================================================================

  // Allpress Espresso Long Black
  {
    id: 'allpress-espresso-long-black',
    name: 'Allpress Espresso Long Black',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/c6d2eed7-6868-455e-b2f1-f259fe1a822f/-/progressive/yes/long_black.jpeg',
    aliases: ['allpress espresso', 'allpress espresso long black', 'allpress long black'],
    matchKeywords: ['allpress espresso', 'allpress espresso long black', 'allpress long black'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 200
  },

  // Allpress Espresso Latte
  {
    id: 'allpress-espresso-latte',
    name: 'Allpress Espresso Latte',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/ea4aeba5-f8d2-4bd4-aa34-ee9320b8d6dc/-/progressive/yes/latte.jpeg',
    aliases: ['allpress espresso latte', 'allpress latte'],
    matchKeywords: ['allpress espresso latte', 'allpress latte'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 200
  },

  // Allpress Espresso Mocha
  {
    id: 'allpress-espresso-mocha',
    name: 'Allpress Espresso Mocha',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/7441e431-9dda-4d6b-8776-f16a8d39aacf/-/progressive/yes/mocha.jpeg',
    aliases: ['allpress espresso mocha', 'allpress mocha'],
    matchKeywords: ['allpress espresso mocha', 'allpress mocha'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 200
  },

  // ==========================================================================
  // ENERGY DRINKS - RED BULL
  // ==========================================================================

  // Red Bull Original - Can
  {
    id: 'red-bull-can',
    name: 'Red Bull Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/dc3afc29-ffe2-482c-b37f-7a06b8f1cbfe/-/progressive/yes/redbull.jpeg',
    aliases: ['red bull', 'redbull', 'red bull original'],
    matchKeywords: ['red bull', 'redbull', 'red bull can', 'red bull original', 'red bull energy'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // Red Bull Sugar Free - Can
  {
    id: 'red-bull-sugar-free-can',
    name: 'Red Bull Sugar Free Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/976829a3-5f32-4e15-bc16-4954dc9bad8a/-/progressive/yes/redbull_sugar_free.jpeg',
    aliases: ['Red Bull Sugar Free'],
    matchKeywords: ['red bull sugar free', 'redbull sugar free', 'red bull diet', 'red bull sugarfree'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // Red Bull Sugar Free - Can
  {
    id: 'red-bull-zero-can',
    name: 'Red Bull Zero Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/813ac970-5ebf-4639-a5ba-dc0099aa268e/-/progressive/yes/redbull_zero.jpeg',
    aliases: ['Red Bull Zero'],
    matchKeywords: ['red bull zero'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // Red Bull Watermelon - Can
  {
    id: 'red-bull-watermelon-can',
    name: 'Red Bull Watermelon Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/086c1472-5043-4acd-a963-8471dec8f692/-/progressive/yes/redbull_watermelon.jpeg',
    aliases: ['red bull watermelon', 'redbull watermelon', 'red bull red edition'],
    matchKeywords: ['red bull watermelon', 'redbull watermelon', 'red bull red edition', 'red bull melon'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // ==========================================================================
  // ENERGY DRINKS - MONSTER
  // ==========================================================================

  // Monster Original - Can
  {
    id: 'monster-original-can',
    name: 'Monster Energy Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/1aa98c36-ae44-474d-a237-f6cef2243c27/-/progressive/yes/monster.jpeg',
    aliases: ['monster', 'monster energy', 'monster original', 'monster green'],
    matchKeywords: ['monster', 'monster energy', 'monster original', 'monster green', 'monster can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // Monster Ultra/Zero - Can
  {
    id: 'monster-ultra-can',
    name: 'Monster Ultra Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/c57230d8-27d6-492f-abf7-b376dc862676/-/progressive/yes/monster_zero_ultra.jpeg',
    aliases: ['monster ultra', 'monster zero', 'monster zero ultra', 'monster sugar free', 'monster white'],
    matchKeywords: ['monster ultra', 'monster zero', 'monster zero ultra', 'monster sugar free', 'monster white', 'monster zero sugar'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // ==========================================================================
  // ENERGY DRINKS - LIVE PLUS
  // ==========================================================================

  // Live Plus - 250ml Can
  {
    id: 'live-plus-250ml-can',
    name: 'Live Plus 250ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/4cf4e6da-0988-46f9-936c-c2ce3d74d1b8/-/progressive/yes/live_plus.jpeg',
    aliases: ['live plus', 'live+', 'liveplus'],
    matchKeywords: ['live plus', 'live+', 'liveplus', 'live plus 250ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // Live Plus - 500ml Can
  {
    id: 'live-plus-500ml-can',
    name: 'Live Plus 500ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/4cf4e6da-0988-46f9-936c-c2ce3d74d1b8/-/progressive/yes/live_plus.jpeg',
    aliases: ['live plus 500ml', 'live+ 500ml', 'liveplus 500ml'],
    matchKeywords: ['live plus 500ml', 'live+ 500ml', 'liveplus 500ml', 'live plus big'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // ==========================================================================
  // ENERGY DRINKS - V ENERGY
  // ==========================================================================

  // V Original - 250ml Can
  {
    id: 'v-energy-original-250ml-can',
    name: 'V Energy Original 250ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/f4909f5e-cd71-475e-a364-6d0caf8f82e6/-/progressive/yes/v_energy.jpeg',
    aliases: ['V Energy', 'V Green', 'V Original'],
    matchKeywords: ['v energy', 'v green', ' v green can', 'v energy drink 250ml', 'v energy 250ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // V Original - 500ml Can
  {
    id: 'v-energy-original-500ml-can',
    name: 'V Energy Original 500ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/42a5e5a6-e9b1-4a44-a001-d6796b7a067d/-/progressive/yes/v_energy_500.jpeg',
    aliases: ['V Energy 500ml', 'V Green 500ml', 'V Original 500ml'],
    matchKeywords: ['v energy 500 ml can', 'v green 500ml', ' v green 500 ml', 'v energy drink 500ml', 'v energy 500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // V Sugar Free - 250ml Can
  {
    id: 'v-energy-sugar-free-250ml-can',
    name: 'V Energy Sugar Free 250ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/12c78774-b2bf-47a3-a0b0-cb43e0d10100/-/progressive/yes/v_energy_sugar_free.jpeg',
    aliases: ['v sugar free', 'v zero', 'v energy sugar free'],
    matchKeywords: ['v sugar free', 'v zero', 'v energy sugar free', 'v sugar free 250ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // V Sugar Free - 500ml Can
  {
    id: 'v-energy-sugar-free-500ml-can',
    name: 'V Energy Sugar Free 500ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/d8309f5c-18ed-46b2-bdf1-3e9afb1b6589/-/progressive/yes/v_energy_sugar_free_500.jpeg',
    aliases: ['v sugar free 500ml', 'v zero 500ml', 'v energy sugar free 500ml'],
    matchKeywords: ['v sugar free 500ml', 'v zero 500ml', 'v energy sugar free 500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // V Blue - 250ml Can
  {
    id: 'v-energy-blue-250ml-can',
    name: 'V Blue 250ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/df5f6904-e325-4b97-a637-182dea2d7d10/-/progressive/yes/v_energy_blue.jpeg',
    aliases: ['v blue', 'v energy blue', 'v blue can'],
    matchKeywords: ['v blue', 'v energy blue', 'v blue 250ml', 'v blue can'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // V Blue - 500ml Can
  {
    id: 'v-energy-blue-500ml-can',
    name: 'V Blue 500ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/e0ab923a-c800-4813-9f45-4d61540ab570/-/progressive/yes/v_energy_blue_500.jpeg',
    aliases: ['v blue 500ml', 'v energy blue 500ml'],
    matchKeywords: ['v blue 500ml', 'v energy blue 500ml', 'v blue big'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // V Blue Sugar Free - 250ml Can
  {
    id: 'v-energy-blue-sugar-free-250ml-can',
    name: 'V Blue Sugar Free 250ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/4a3ed852-7927-4f0b-9ea2-0ed219ef72d6/-/progressive/yes/v_energy_blue_zero_sugar.jpeg',
    aliases: ['v blue sugar free', 'v blue zero', 'v energy blue sugar free'],
    matchKeywords: ['v blue sugar free', 'v blue zero', 'v energy blue sugar free', 'v blue sugar free 250ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 250
  },

  // V Blue Sugar Free - 500ml Can
  {
    id: 'v-energy-blue-sugar-free-500ml-can',
    name: 'V Blue Sugar Free 500ml Can',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/a8eb0e0b-4e5c-4dee-b6f1-519cbb030b1d/-/progressive/yes/v_energy_blue_sugar_free_500.jpeg',
    aliases: ['v blue sugar free 500ml', 'v blue zero 500ml'],
    matchKeywords: ['v blue sugar free 500ml', 'v blue zero 500ml', 'v energy blue sugar free 500ml'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'can',
    sizeML: 500
  },

  // ==========================================================================
  // JUICES - MOST ORGANIC
  // ==========================================================================

  // Most Organic - Apple, Orange and Mango
  {
    id: 'most-organic-apple-orange-mango',
    name: 'Most Organic Apple Orange Mango',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/c93f6729-4d3a-4dd3-bb93-d7c7eca2765d/-/progressive/yes/most_organic_mango.jpeg',
    aliases: ['most organic apple orange mango', 'most apple orange mango', 'most organic tropical', 'most orange mango', 'most orange & mango'],
    matchKeywords: ['most organic apple orange mango', 'most apple orange mango', 'most organic tropical', 'most juice apple orange', 'most orange mango', 'most orange & mango', 'most mango'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // Most Organic - Apple and Blackcurrant
  {
    id: 'most-organic-apple-blackcurrant',
    name: 'Most Organic Apple Blackcurrant',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/80924fee-1fa2-42e1-b8f4-dc78f2dc5fc0/-/progressive/yes/most_organic_blackcurrant_juice.jpeg',
    aliases: ['most organic apple blackcurrant', 'most apple blackcurrant', 'most organic blackcurrant', 'most blackcurrant', 'most apple & blackcurrant', 'most sparkling apple & blackcurrant', 'most sparkling blackcurrant'],
    matchKeywords: ['most organic apple blackcurrant', 'most apple blackcurrant', 'most organic blackcurrant', 'most juice blackcurrant', 'most blackcurrant', 'most sparkling blackcurrant'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // Most Organic - Apple and Peach
  {
    id: 'most-organic-apple-peach',
    name: 'Most Organic Apple Peach',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/a73f1c89-7610-42ca-b9a8-148eeaed2564/-/progressive/yes/most_organic_peach.jpeg',
    aliases: ['most organic apple peach', 'most apple peach', 'most organic peach'],
    matchKeywords: ['most organic apple peach', 'most apple peach', 'most organic peach', 'most juice peach'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // Most Organic - Apple and Guava
  {
    id: 'most-organic-apple-guava',
    name: 'Most Organic Apple Guava',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/a4121520-f81f-4cd6-807a-63e00e172a75/-/progressive/yes/most_organic_guava.jpeg',
    aliases: ['most organic apple guava', 'most apple guava', 'most organic guava'],
    matchKeywords: ['most organic apple guava', 'most apple guava', 'most organic guava', 'most juice guava'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // Most Organic - Apple and Feijoa
  {
    id: 'most-organic-apple-feijoa',
    name: 'Most Organic Apple Feijoa',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/f22ac3cc-bb1a-4e1a-a46e-2072e6ea80fd/-/progressive/yes/most_organic_feijoa.jpeg',
    aliases: ['most organic apple feijoa', 'most apple feijoa', 'most organic feijoa', 'most feijoa', 'most apple & feijoa'],
    matchKeywords: ['most organic apple feijoa', 'most apple feijoa', 'most organic feijoa', 'most juice feijoa', 'most feijoa'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // ==========================================================================
  // JUICES - KERI
  // ==========================================================================

  // Keri Apple Juice
  {
    id: 'keri-apple-juice',
    name: 'Keri Apple Juice',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/cc449ede-a633-4fba-aae2-d2a915a852e2/-/progressive/yes/keri_apple.jpeg',
    aliases: ['keri apple', 'keri apple juice'],
    matchKeywords: ['keri apple', 'keri apple juice', 'keri juice apple'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // Keri Orange Juice
  {
    id: 'keri-orange-juice',
    name: 'Keri Orange Juice',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/6ec76c85-ce6e-40b5-bdd1-04c57377fdd2/-/progressive/yes/keri_orange.jpeg',
    aliases: ['keri orange', 'keri orange juice'],
    matchKeywords: ['keri orange', 'keri orange juice', 'keri juice orange'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 350
  },

  // ==========================================================================
  // SPORTS DRINKS - POWERADE
  // ==========================================================================

  // Powerade Blue (Mountain Blast)
  {
    id: 'powerade-blue',
    name: 'Powerade Blue',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/92d8a1c7-f950-45d6-b750-9db02cabdfc3/-/progressive/yes/powerade_blue.jpeg',
    aliases: ['powerade blue', 'powerade mountain blast', 'powerade berry ice'],
    matchKeywords: ['powerade blue', 'powerade mountain blast', 'powerade berry ice', 'powerade mountain'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },

  // Powerade Red (Berry Ice)
  {
    id: 'powerade-red',
    name: 'Powerade Red',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/86b7c25a-dcfe-4bcd-bc02-003d8b1df2b8/-/progressive/yes/powerade_red.jpeg',
    aliases: ['powerade red', 'powerade berry ice', 'powerade bottle'],
    matchKeywords: ['powerade red', 'powerade berry ice', 'powerade bottle', 'powerade berry', 'powerade range'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },

  // Powerade Purple (Blackcurrant)
  {
    id: 'powerade-purple',
    name: 'Powerade Purple',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/acd9048f-9822-403f-8c28-43e96b35ff1a/-/progressive/yes/powerade_blackcurrant.jpeg',
    aliases: ['powerade purple', 'powerade blackcurrant', 'powerade bottle'],
    matchKeywords: ['powerade purple', 'powerade blackcurrant', 'powerade pink'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 750
  },

  // Powerade Green (Fever Pitch)
  {
    id: 'powerade-green',
    name: 'Powerade Green',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/c9b525c7-87a9-4735-9c20-0439f9010a19/-/progressive/yes/powerade_green.jpeg',
    aliases: ['powerade green', 'green powerade', 'powerade fever pitch'],
    matchKeywords: ['powerade green', 'powerade fever pitch', 'green powerade'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 750
  },  

  // Powerade Blue Zero/Sugar Free
  {
    id: 'powerade-blue-zero',
    name: 'Powerade Blue Zero',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/66315750-140b-4fab-8b5b-b891b4992708/-/progressive/yes/powerade_blue_zero.jpeg',
    aliases: ['powerade blue zero', 'powerade zero blue', 'powerade sugar free blue', 'powerade blue active', 'powerade mountain blast zero sugar'],
    matchKeywords: ['powerade blue zero', 'powerade zero blue', 'powerade sugar free blue', 'powerade blue no sugar', 'powerade mountain blast zero sugar', 'powerade active blue'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 600
  },

  // Powerade Red Zero/Sugar Free
  {
    id: 'powerade-red-zero',
    name: 'Powerade Red Zero',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/fbfdaf0d-5b74-489d-bb6b-3796ef8a6bf9/-/progressive/yes/powerade_red_zero.jpeg',
    aliases: ['Powerade Red Zero', 'Powerade Zero Red', 'Powerade Sugar Free Red', 'Powerade Red Active'],
    matchKeywords: ['powerade red zero', 'powerade zero sugar red', 'powerade zero sugar berry blast', 'powerade sugar free red', 'powerade red no sugar', 'powerade active red'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 750
  },

  // Powerade Purple (Blackcurrant) Zero/Sugar Free
  {
    id: 'powerade-purple-zero',
    name: 'Powerade Purple Zero',
    category: 'beverage',
    imageUrl: 'https://ucarecdn.com/a726ee7f-eb73-42c4-a9c9-b5f58d0394f8/-/progressive/yes/powerade_blackcurrant_zero.jpeg',
    aliases: ['Powerade Purple zero', 'Powerade Blackcurrant zero', 'Powerade Blackcurrant sugar free'],
    matchKeywords: ['powerade zero purple', 'powerade purple sugar free', 'powerade blackcurrant zero sugar', 'powerade pink zero sugar'],
    confidence: 0.95,
    priorityReplace: true,
    containerType: 'bottle',
    sizeML: 750
  }  
];

// =============================================================================
// MAIN PROCESSING FUNCTIONS
// =============================================================================

/**
 * Get suggested common images for a menu item name
 *
 * Uses size-aware matching to select the correct container type:
 * - Parses size from item name (e.g., "Coke 600ml", "Sprite 1.5L")
 * - Maps sizes to container types: ≤375ml → can, 600ml → bottle, ≥1000ml → large-bottle
 * - Boosts confidence for exact size/container matches
 * - Reduces confidence for container type mismatches
 *
 * @param {string} itemName - Menu item name to match
 * @param {number} minConfidence - Minimum confidence threshold (default 0.7)
 * @returns {Array<{image: object, confidence: number}>} - Matching images sorted by confidence
 */
function getSuggestedImages(itemName, minConfidence = 0.7) {
  if (!itemName || typeof itemName !== 'string') {
    return [];
  }

  const normalized = itemName.toLowerCase().trim();
  const results = [];

  // Parse size and determine expected container type from item name
  const itemSizeML = parseSize(itemName);
  const expectedContainerType = getContainerType(itemSizeML);

  for (const image of COMMON_IMAGES) {
    let confidence = 0;
    const baseConfidence = image.confidence || 0.9;

    // EXACT MATCH: Name or alias exact match (highest confidence)
    if (image.name.toLowerCase() === normalized ||
        image.aliases.some(a => a.toLowerCase() === normalized)) {
      confidence = baseConfidence;
    }
    // KEYWORD MATCH: Item name includes a keyword
    else if (image.matchKeywords.some(kw => normalized.includes(kw.toLowerCase()))) {
      confidence = baseConfidence * 0.85;
    }
    // NAME CONTAINS: Item name contains image name or alias
    else if (normalized.includes(image.name.toLowerCase()) ||
             image.aliases.some(a => normalized.includes(a.toLowerCase()))) {
      confidence = baseConfidence * 0.75;
    }
    // PARTIAL KEYWORD: Word > 3 chars in keyword matches
    else {
      for (const kw of image.matchKeywords) {
        const words = kw.toLowerCase().split(' ');
        if (words.some(word => word.length > 3 && normalized.includes(word))) {
          confidence = Math.max(confidence, baseConfidence * 0.6);
        }
      }
    }

    // Skip if no base match found
    if (confidence === 0) continue;

    // =======================================================================
    // SIZE-AWARE CONFIDENCE ADJUSTMENTS
    // =======================================================================

    // If item has a size indicator and image has container type info
    if (expectedContainerType && image.containerType) {
      if (expectedContainerType === image.containerType) {
        // BOOST: Exact container type match
        confidence = Math.min(confidence * 1.1, 1.0);

        // EXTRA BOOST: Exact size match (within 50ml tolerance)
        if (itemSizeML && image.sizeML) {
          const sizeDiff = Math.abs(itemSizeML - image.sizeML);
          if (sizeDiff <= 50) {
            confidence = Math.min(confidence * 1.05, 1.0);
          }
        }
      } else {
        // PENALTY: Container type mismatch
        // e.g., item says "600ml" (bottle) but image is a can
        confidence *= 0.5; // Significant penalty for wrong container type
      }
    }

    // Skip images with placeholder URLs (they're not ready yet)
    if (image.imageUrl.startsWith('PLACEHOLDER_')) {
      continue;
    }

    if (confidence >= minConfidence) {
      results.push({ image, confidence });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Process menu items and associate common images
 *
 * Two modes:
 * 1. FILL MISSING: Associate images for items without images
 * 2. PRIORITY REPLACE: Replace extracted images with high-quality common images
 *    when the matched image has priorityReplace: true
 *
 * @param {Array} itemRecords - Created menu items with database IDs
 * @param {Array} processedMenuItems - Original processed items with names
 * @param {Object} existingImageMap - Map of itemId -> imageUrl for items with extracted images
 * @returns {Object} - { associations, stats }
 */
function processCommonImageAssociations(itemRecords, processedMenuItems, existingImageMap) {
  const associations = {};
  let filledCount = 0;      // Items that got images (had none)
  let replacedCount = 0;    // Items with priority replacement
  let skippedCount = 0;     // Items skipped (had image, no priority replace)
  let noMatchCount = 0;     // Items with no matching common image

  itemRecords.forEach((item, index) => {
    const originalItem = processedMenuItems[index];
    if (!originalItem) {
      noMatchCount++;
      return;
    }

    const itemName = originalItem.dishName || originalItem.name || item.name;
    const hasExistingImage = !!existingImageMap[item.id];
    const suggestions = getSuggestedImages(itemName, 0.7);

    if (suggestions.length === 0) {
      noMatchCount++;
      return;
    }

    const best = suggestions[0];

    // Decision logic:
    // - If item has NO image → always associate (fill missing)
    // - If item HAS image AND best match has priorityReplace → replace
    // - If item HAS image AND best match does NOT have priorityReplace → skip
    if (hasExistingImage && !best.image.priorityReplace) {
      skippedCount++;
      return;
    }

    const action = hasExistingImage ? 'replaced' : 'filled';

    associations[item.id] = {
      url: best.image.imageUrl,
      metadata: {
        source: 'common-images',
        imageId: best.image.id,
        imageName: best.image.name,
        confidence: best.confidence,
        matchedItemName: itemName,
        action: action,
        priorityReplace: best.image.priorityReplace || false,
        associatedAt: new Date().toISOString()
      }
    };

    if (hasExistingImage) {
      replacedCount++;
    } else {
      filledCount++;
    }
  });

  const stats = {
    total: itemRecords.length,
    filled: filledCount,
    replaced: replacedCount,
    skipped: skippedCount,
    noMatch: noMatchCount
  };

  return { associations, stats };
}

/**
 * Get statistics about common image associations (for logging)
 *
 * @param {Object} result - Result from processCommonImageAssociations
 * @returns {string} - Formatted log message
 */
function getAssociationStats(result) {
  const { stats } = result;
  const parts = [
    `${stats.filled} filled`,
    `${stats.replaced} replaced (priority)`,
    `${stats.skipped} kept original`,
    `${stats.noMatch} no match`
  ];
  return `[Common Images] Processed ${stats.total} items: ${parts.join(', ')}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Main functions
  getSuggestedImages,
  processCommonImageAssociations,
  getAssociationStats,

  // Size parsing utilities (exported for testing/extension)
  parseSize,
  getContainerType,

  // Configuration (exported for testing/extension)
  COMMON_IMAGES
};
