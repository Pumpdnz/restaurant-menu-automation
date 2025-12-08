/**
 * Helper utilities for image-focused extraction
 * These functions generate specialized prompts and schemas for extracting only images
 * and matching them correctly to existing menu items
 */

/**
 * Generate a prompt specifically focused on extracting images for known menu items
 * @param {Array} menuItems - Existing menu items with names (unused in current implementation)
 * @param {string} categoryName - The category being extracted
 * @param {string} platform - 'ubereats' or 'doordash'
 * @returns {string} - Specialized prompt for image extraction
 */
function generateImageFocusedPrompt(menuItems, categoryName, platform = 'ubereats') {
  const prompt = `Focus ONLY on extracting menu items from the category "${categoryName}" on this ${platform === 'ubereats' ? 'UberEats' : platform === 'doordash' ? 'DoorDash' : ''} page.
        
1. Navigate to the section for category "${categoryName}"
2. Locate the category header or section
3. Extract ONLY the menu items within this specific category
4. For each item, get the name, price, description, and image URL (if available)
5. If an item has image, click to open its details to get the high-resolution image
6. DO NOT include items from other categories
7. Ensure the categoryName field exactly matches "${categoryName}"`;

  return prompt;
}

/**
 * Generate a simplified schema for image-only extraction
 * @returns {Object} - Schema focused on name and image pairs
 */
function generateImageOnlySchema() {
  return {
    type: 'object',
    properties: {
      menuItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dishName: {
              type: 'string',
              description: 'The EXACT name of the dish as it appears in the menu'
            },
            imageURL: {
              type: 'string', 
              description: 'The highest resolution image URL for this specific dish'
            }
          },
          required: ['dishName', 'imageURL']
        }
      }
    },
    required: ['menuItems']
  };
}

/**
 * Match an extracted item to an existing menu item using fuzzy matching
 * @param {Object} extractedItem - Item with dishName and imageURL
 * @param {Array} existingItems - Array of existing menu items
 * @returns {Object|null} - Matched existing item or null
 */
function matchImageToMenuItem(extractedItem, existingItems) {
  if (!extractedItem || !extractedItem.dishName) {
    console.warn('Invalid extracted item:', extractedItem);
    return null;
  }

  const normalizedExtractedName = normalizeDishName(extractedItem.dishName);
  
  // First try exact match
  let bestMatch = existingItems.find(existing => 
    normalizeDishName(existing.dishName) === normalizedExtractedName
  );

  if (bestMatch) {
    console.log(`Exact match found for "${extractedItem.dishName}"`);
    return bestMatch;
  }

  // Try fuzzy matching
  let bestScore = 0;
  
  for (const existing of existingItems) {
    const score = calculateSimilarity(
      normalizedExtractedName, 
      normalizeDishName(existing.dishName)
    );
    
    if (score > bestScore && score > 0.8) { // 80% similarity threshold
      bestScore = score;
      bestMatch = existing;
    }
  }

  if (bestMatch) {
    console.log(`Fuzzy match found for "${extractedItem.dishName}" -> "${bestMatch.dishName}" (score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  }

  console.warn(`No match found for "${extractedItem.dishName}"`);
  return null;
}

/**
 * Normalize dish name for comparison
 * @param {string} name - Original dish name
 * @returns {string} - Normalized name
 */
function normalizeDishName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Merge updated images into existing menu items
 * @param {Array} existingItems - Current menu items
 * @param {Array} imageUpdates - Extracted items with new images
 * @returns {Array} - Menu items with updated images
 */
function mergeImageUpdates(existingItems, imageUpdates) {
  const updatedItems = [...existingItems];
  let updateCount = 0;

  for (const imageUpdate of imageUpdates) {
    const matchedItem = matchImageToMenuItem(imageUpdate, existingItems);
    
    if (matchedItem) {
      const index = updatedItems.findIndex(item => 
        item.dishName === matchedItem.dishName && 
        item.categoryName === matchedItem.categoryName
      );
      
      if (index !== -1 && imageUpdate.imageURL) {
        console.log(`Updating image for "${matchedItem.dishName}": ${imageUpdate.imageURL}`);
        updatedItems[index] = {
          ...updatedItems[index],
          imageURL: imageUpdate.imageURL
        };
        updateCount++;
      }
    }
  }

  console.log(`Successfully updated ${updateCount} images out of ${imageUpdates.length} extracted`);
  return updatedItems;
}

// CommonJS exports
module.exports = {
  generateImageFocusedPrompt,
  generateImageOnlySchema,
  matchImageToMenuItem,
  mergeImageUpdates
};
