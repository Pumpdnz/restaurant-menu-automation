/**
 * firecrawl-service.js - Service for integrating with Firecrawl API
 * 
 * This service handles all interactions with the Firecrawl API for menu extraction.
 * It includes functions for initiating extraction, checking extraction status,
 * and retrieving extraction results.
 * 
 * Updated to use FIRE-1 agent for improved navigation and extraction
 * Added category-based extraction for handling large menus
 */

const {
  generateImageFocusedPrompt,
  generateImageOnlySchema,
  mergeImageUpdates
} = require('../utils/image-extraction-helpers');

// Platform-specific schemas and prompts

// Default extraction prompt for restaurant menu data (general)
const DEFAULT_PROMPT = `I need you to extract the complete structured menu data from this restaurant's food delivery platform. Follow these steps:

1. Scroll slowly from top to bottom to ensure all menu items and images load completely
2. Look for menu category sections and ensure they're all expanded
3. If there are menu tabs or dropdowns, click each one to view all available menus
4. For items with "View more" or similar buttons, click them to reveal full descriptions
5. If any item details are hidden or collapsed, expand them
6. For items with images, ensure they're fully loaded

Extract all menu items with their category, name, price, description, and image URLs.
Do not include frequently asked questions or promotional content.
Ensure proper formatting of prices (numerical values, not text).
For items with multiple size options, extract the default or smallest size.`;

// Default extraction schema (full menu data) - Enhanced with better property descriptions for FIRE-1
const DEFAULT_SCHEMA = {
  "type": "object",
  "properties": {
    "menuItems": {
      "type": "array",
      "description": "Complete list of all menu items from the restaurant",
      "items": {
        "type": "object",
        "properties": {
          "menuName": {
            "type": "string",
            "description": "The name of the menu section or category (e.g., 'Lunch', 'Dinner', etc.)"
          },
          "categoryName": {
            "type": "string",
            "description": "The category this dish belongs to (e.g., 'Appetizers', 'Main Courses', 'Desserts')"
          },
          "dishName": {
            "type": "string",
            "description": "The name of the dish as displayed on the menu"
          },
          "dishPrice": {
            "type": "number",
            "description": "The price of the dish as a numerical value (without currency symbols)"
          },
          "dishDescription": {
            "type": "string",
            "description": "Full description of the dish including ingredients and preparation style"
          },
          "tags": {
            "type": "array",
            "description": "Any tags or attributes for this dish (e.g., 'Spicy', 'Vegetarian', 'Gluten-Free')",
            "items": {
              "type": "string"
            }
          },
          "imageURL": {
            "type": "string",
            "description": "The URL to the highest resolution image of the dish available"
          }
        },
        "required": ["dishName", "dishPrice", "categoryName"]
      }
    }
  },
  "required": [
    "menuItems"
  ]
};

// Category Detection Schema - Used for scanning menu categories before detailed extraction
const CATEGORY_DETECTION_SCHEMA = {
  "type": "object",
  "properties": {
    "categories": {
      "type": "array",
      "description": "Complete list of all menu categories on the restaurant page",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "The exact name of the menu category as shown on the page (e.g., 'Appetizers', 'Main Courses', 'Desserts')"
          },
          "position": {
            "type": "integer",
            "description": "The approximate vertical position/order of this category on the page (1 for top category, increasing as you go down)"
          },
          "selector": {
            "type": "string",
            "description": "CSS selector that can be used to target this category section if available (e.g., '#category-appetizers', '.menu-section-3')"
          }
        },
        "required": ["name"]
      }
    }
  },
  "required": ["categories"]
};

// UberEats-specific category detection prompt
const UBEREATS_CATEGORY_PROMPT = `I need you to identify all menu categories on this UberEats restaurant page. Follow these steps:

1. Scroll through the entire page slowly to ensure all content loads
2. Look for category headers or section titles (e.g., "Appetizers", "Main Dishes", "Desserts")
3. IMPORTANT: Be sure to include "Featured Items" or "Popular Items" sections at the top of the menu
4. If there's a "View more" button for categories, click it to expand all categories
5. Check for category tabs at the top of the menu and note them all
6. For each category, note its name exactly as shown on the page
7. If possible, identify the numerical order/position of each category (1 for the first/top category, 2 for second, etc.)
8. If possible, identify any CSS selector that could be used to target each category

IMPORTANT: Focus ONLY on identifying the category names and their positions. DO NOT extract individual menu items at this stage.
IMPORTANT: Do not skip "Featured Items" or "Popular Items" categories - these must be included.`;

// DoorDash-specific category detection prompt
const DOORDASH_CATEGORY_PROMPT = `I need you to identify all menu categories on this DoorDash restaurant page. Follow these steps:

1. Look for the horizontal scrollable menu of categories at the top of the page, if present
2. Click through each category tab in the horizontal menu to see its name
3. IMPORTANT: Look for "Most Liked" or "Popular Items" sections at the top of the menu
4. Also look for category section headers throughout the vertical menu listing
5. If there are "View more" or "See all" buttons, click them to expand hidden categories
6. For each category, note its name exactly as shown on the page
7. If possible, identify the numerical order/position of each category (1 for the first/top category, 2 for second, etc.)
8. If possible, identify any CSS selector that could be used to target each category

IMPORTANT: Focus ONLY on identifying the category names and their positions. DO NOT extract individual menu items at this stage.
IMPORTANT: Do not skip "Most Liked", "Popular Items", or "Featured Items" categories - these must be included.`;

// Generic category detection prompt for unknown/general platforms
const GENERIC_CATEGORY_PROMPT = `I need you to identify all menu categories on this restaurant ordering page. This is a general-purpose prompt for various platforms. Follow these steps:

1. Scroll through the entire page slowly to ensure all content loads completely
2. Look for any menu sections, categories, or groupings of food items
3. Common category indicators to look for:
   - Section headers (h1, h2, h3 tags)
   - Tabs or navigation items for different menu sections
   - Dividers or cards that group similar items
   - Text like "Starters", "Mains", "Desserts", "Beverages", etc.
4. Check for expandable/collapsible sections and expand them
5. Look for special sections like "Popular", "Featured", "Specials", "Combos", or "Deals"
6. If the page has multiple menus (Lunch, Dinner, etc.), note each as a separate category
7. Record the exact name of each category as displayed
8. Note the order/position of categories on the page

IMPORTANT: Focus ONLY on identifying category names. DO NOT extract individual menu items.
IMPORTANT: Include ALL sections that group menu items, even if they have non-standard names.`;

// OrderMeal-specific category detection prompt
const ORDERMEAL_CATEGORY_PROMPT = `I need you to identify all menu categories on this OrderMeal restaurant page. Follow these steps:

1. Scroll through the entire page slowly to ensure all content loads
2. Look for the left sidebar menu with class="left-sidebar" or id="scrollMenuContainer"
3. Find the navigation menu inside, typically in a <nav id="scrollMenu"> element
4. Extract all category names from the navigation links. These are the section names that organize the menu items.

The categories are structured as:
- Located in <li> elements within the navigation
- Each category is an <a> tag with href="#menu[number]" or "#menupopular"
- The text content of the <a> tag is the category name
- Categories like "Most Popular", "Kebabs", "Wraps", "Drinks", "Sides", etc.

IMPORTANT: Focus ONLY on identifying the category names and their positions. DO NOT extract individual menu items at this stage.
IMPORTANT: Include "Most Popular" if present as it's often the first category.`;

// Mobi2Go-specific category detection prompt
const MOBI2GO_CATEGORY_PROMPT = `I need you to identify all menu categories on this Mobi2Go restaurant page. Follow these Mobi2Go-specific steps:

1. Mobi2Go typically displays categories as cards or tiles on the main page
2. Look for the category grid layout that's common on Mobi2Go sites
3. Each category usually has an image tile with the category name below or overlaid
4. Common Mobi2Go category patterns:
   - Image-based category cards
   - Categories may be in a horizontal scroll on mobile
   - May have "View Menu" buttons on each category
5. Click into each category if needed to confirm it contains menu items
6. Look for special categories like "Deals", "Combos", or "Family Packs"
7. Check for time-based menus (Breakfast, Lunch, Dinner)
8. Record the exact category name from each tile/card

IMPORTANT: Focus on the main category divisions, not subcategories within.
IMPORTANT: Mobi2Go may paginate categories - ensure you check all pages.`;

// NextOrder-specific category detection prompt
const NEXTORDER_CATEGORY_PROMPT = `I need you to identify all menu categories on this NextOrder restaurant page. Follow these NextOrder-specific steps:

1. NextOrder typically uses a clean, modern layout with clear category sections
2. Look for the category menu which is often:
   - A horizontal tab bar at the top of the menu area
   - A sticky navigation that follows as you scroll
   - Left sidebar navigation on desktop
3. NextOrder categories are usually clearly labeled sections
4. Common patterns on NextOrder:
   - Bold category headers
   - Sections separated by spacing or divider lines
   - May have category descriptions under the name
5. Check for "Popular Items" or "Recommended" sections at the top
6. Look for any collapsed categories that need expanding
7. NextOrder often has clear visual hierarchy - main categories are prominent
8. Record each category exactly as displayed

IMPORTANT: NextOrder may have subcategories - focus on main categories only.
IMPORTANT: Don't miss featured or promotional sections at the top of the page.`;

// DeliverEasy-specific category detection prompt
const DELIVEREASY_CATEGORY_PROMPT = `I need you to identify all menu categories on this DeliverEasy restaurant page. Follow these DeliverEasy-specific steps:

1. DeliverEasy uses a traditional layout with clear menu sections
2. Look for the main menu area which typically shows:
   - Category buttons or tabs at the top
   - Vertical list of categories in the menu section
   - May have a category dropdown selector
3. DeliverEasy category patterns:
   - Often uses ALL CAPS for category names
   - Categories may be numbered (1. STARTERS, 2. MAINS, etc.)
   - Clear section breaks between categories
4. Check for special sections:
   - "MEAL DEALS"
   - "COMBOS"
   - "SPECIALS"
5. Some restaurants have multiple menus - check for menu switcher
6. Expand any collapsed sections or "Show more" buttons
7. Categories might be in a sidebar that scrolls independently
8. Record the exact formatting of each category name

IMPORTANT: DeliverEasy may repeat popular items - record each unique category once.
IMPORTANT: Include delivery-specific categories like "Family Packs" if present.`;

// FoodHub-specific category detection prompt
const FOODHUB_CATEGORY_PROMPT = `I need you to identify all menu categories on this FoodHub restaurant page. Follow these steps:

1. Scroll through the entire page slowly to ensure all content loads
2. Look for the category sidebar menu or similar section with id="category-section"
3. Extract the category navigation labels from the left sidebar menu. These are the section names that organize the menu items (like "Entrees", "Soups", "Curries", "Desserts").
Each category name is in a <div> element with:
  - dir="auto"
  - role="link"
  - data-class="category[CategoryName]" (like categoryEntrees, categorySoups)
  - The actual text content is the category name
IMPORTANT: Focus ONLY on identifying the category names and their positions. DO NOT extract individual menu items at this stage.`;

/**
 * Generate a category-specific extraction schema
 * @param {string} categoryName - The name of the category being extracted
 * @param {boolean} includeImages - Whether to include imageURL in the schema (false for NZ platforms)
 * @returns {Object} - The category-specific schema
 */
function generateCategorySchema(categoryName, includeImages = true) {
  const itemProperties = {
    "dishName": {
      "type": "string",
      "description": "The name of the dish as displayed on the menu"
    },
    "dishPrice": {
      "type": "number",
      "description": "The price of the dish as a numerical value"
    },
    "dishDescription": {
      "type": "string",
      "description": "Full description of the dish including ingredients and preparation style. DO NOT include tags related to 'most liked' or 'Plus small'"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Any tags or attributes for this dish. DO NOT include tags related to 'Thumb up outline' or percentages. DO NOT include tags related to 'most liked' or 'Plus small'"
    }
  };

  // Only add imageURL if needed (for UberEats/DoorDash)
  if (includeImages) {
    itemProperties["imageURL"] = {
      "type": "string",
      "description": "URL to the highest resolution image of the dish available"
    };
  }

  return {
    "type": "object",
    "properties": {
      "categoryName": {
        "type": "string",
        "description": `The name of this specific menu category: "${categoryName}"`
      },
      "menuItems": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": itemProperties,
          "required": ["dishName", "dishPrice"]
        }
      }
    },
    "required": ["categoryName", "menuItems"]
  };
}

// Option Sets Schema - for extracting option sets from individual menu item pages
const OPTION_SETS_SCHEMA = {
  "type": "object",
  "properties": {
    "optionSets": {
      "type": "array",
      "description": "Complete list of all option sets available for this menu item",
      "items": {
        "type": "object",
        "properties": {
          "optionSetName": {
            "type": "string",
            "description": "The name/title of the option set (e.g., 'Choice of Sauce', 'Add Drink', 'Size Selection')"
          },
          "required": {
            "type": "boolean",
            "description": "Whether this option set is required for ordering"
          },
          "selectMultiple": {
            "type": "boolean",
            "description": "Whether multiple options can be selected from this set"
          },
          "minOptionsRequired": {
            "type": "integer",
            "description": "Minimum number of options that must be selected (0 if not required)"
          },
          "maxOptionsAllowed": {
            "type": "integer",
            "description": "Maximum number of options that can be selected (1 for single select, higher for multiple)"
          },
          "options": {
            "type": "array",
            "description": "List of individual options within this option set",
            "items": {
              "type": "object",
              "properties": {
                "optionName": {
                  "type": "string",
                  "description": "The name of the individual option"
                },
                "optionPrice": {
                  "type": "number",
                  "description": "Additional price for this option (0 if no extra charge)"
                }
              },
              "required": ["optionName", "optionPrice"]
            }
          }
        },
        "required": ["optionSetName", "required", "selectMultiple", "options"]
      }
    },
    "menuItemName": {
      "type": "string",
      "description": "The name of the menu item these option sets belong to"
    }
  },
  "required": ["optionSets", "menuItemName"]
};

// UberEats-specific prompt for extracting option sets from menu item pages
const UBEREATS_OPTION_SETS_PROMPT = `I need you to extract all option sets and customization options from this UberEats menu item page. Follow these steps:

1. Look for option set sections that appear below the item description
2. Each option set typically has a title like "Choice of Sauce", "Add Drink", "Size Selection", etc.
3. Check for requirement indicators like "Required", "Choose 1", "Choose up to 2", etc.
4. For each option set, determine:
   - The option set name/title
   - Whether it's required or optional
   - Whether single or multiple selections are allowed
   - The minimum and maximum number of selections
5. For each individual option within a set, extract:
   - The option name
   - Any additional price (look for "+$X.XX" indicators, 0 if no extra charge)
6. IMPORTANT: Look carefully at the pricing format - options may show additional costs like "+$8.50"
7. Make sure to capture all option sets on the page, not just the visible ones

Extract the complete customization structure that customers would see when ordering this item.`;

// Define schema options for UI dropdown
const SCHEMA_OPTIONS = [
  { id: 'default', name: 'Standard (Full Menu)', schema: DEFAULT_SCHEMA },
  { id: 'categories', name: 'Category Detection', schema: CATEGORY_DETECTION_SCHEMA },
  { id: 'option_sets', name: 'Option Sets', schema: OPTION_SETS_SCHEMA }
];

// Define prompt options for UI dropdown
const PROMPT_OPTIONS = [
  { id: 'default', name: 'Standard (General)', prompt: DEFAULT_PROMPT },
  { id: 'generic_categories', name: 'Generic Category Detection', prompt: GENERIC_CATEGORY_PROMPT },
  { id: 'ubereats_categories', name: 'UberEats Category Detection', prompt: UBEREATS_CATEGORY_PROMPT },
  { id: 'doordash_categories', name: 'DoorDash Category Detection', prompt: DOORDASH_CATEGORY_PROMPT },
  { id: 'ordermeal_categories', name: 'OrderMeal Category Detection', prompt: ORDERMEAL_CATEGORY_PROMPT },
  { id: 'mobi2go_categories', name: 'Mobi2Go Category Detection', prompt: MOBI2GO_CATEGORY_PROMPT },
  { id: 'nextorder_categories', name: 'NextOrder Category Detection', prompt: NEXTORDER_CATEGORY_PROMPT },
  { id: 'delivereasy_categories', name: 'DeliverEasy Category Detection', prompt: DELIVEREASY_CATEGORY_PROMPT },
  { id: 'foodhub_categories', name: 'FoodHub Category Detection', prompt: FOODHUB_CATEGORY_PROMPT },
  { id: 'ubereats_option_sets', name: 'UberEats Option Sets', prompt: UBEREATS_OPTION_SETS_PROMPT }
];

// Define extraction method options for UI dropdown
const EXTRACTION_METHOD_OPTIONS = [
  { id: 'standard', name: 'Standard (Single-Pass)', description: 'Extracts all menu items in a single pass' },
  { id: 'category-based', name: 'Category-Based (Recommended for Large Menus)', description: 'First scans for categories, then extracts each category separately' },
  { id: 'option-sets', name: 'Option Sets Extraction', description: 'Extract option sets from individual menu item pages' },
  { id: 'image-update', name: 'Update Images Only', description: 'Extract high-quality images for existing menu items' }
];

/**
 * Extract menu data using the enhanced FIRE-1 agent scrape method
 * 
 * @param {string} url - Restaurant URL (UberEats or DoorDash)
 * @param {string} customPrompt - Optional custom extraction prompt
 * @param {Object} customSchema - Optional custom extraction schema
 * @param {string} method - Extraction method ('scrape' or 'extract', defaults to 'scrape')
 * @returns {Promise<Object>} - Complete extraction data
 */
async function extractMenuData(url, customPrompt, customSchema, method = 'scrape') {
  if (!url) {
    throw new Error('URL is required');
  }
  
  try {
    // We now primarily use the 'scrape' method with FIRE-1 agent, but keep extract as fallback
    const extractMethod = method === 'extract' ? 'extract' : 'scrape';
    console.log(`Starting Firecrawl ${extractMethod} with FIRE-1 agent for URL: ${url}`);
    
    // Detect if this is UberEats or DoorDash URL for platform-specific handling
    const isUberEats = url.includes('ubereats.com');
    const isDoorDash = url.includes('doordash.com');
    
    // Select appropriate prompt and schema based on platform
    let prompt, schema;
    
    if (customPrompt) {
      // Use custom prompt if provided
      prompt = customPrompt;
    } else if (isUberEats) {
      prompt = UBEREATS_PROMPT;
      console.log('Using UberEats-specific prompt');
    } else if (isDoorDash) {
      prompt = DOORDASH_PROMPT;
      console.log('Using DoorDash-specific prompt');
    } else {
      prompt = DEFAULT_PROMPT;
    }
    
    if (customSchema) {
      // Use custom schema if provided
      schema = customSchema;
    } else if (isUberEats) {
      schema = UBEREATS_SCHEMA;
      console.log('Using UberEats-specific schema');
    } else if (isDoorDash) {
      schema = DOORDASH_SCHEMA;
      console.log('Using DoorDash-specific schema');
    } else {
      schema = DEFAULT_SCHEMA;
    }
    
    console.log('Extraction will take several minutes to complete with FIRE-1 agent navigation...');
    
    // Make API request using relative endpoint with enhanced parameters
    const response = await fetch(`/api/${extractMethod}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        prompt,
        schema
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      
      // If scrape fails and we weren't already using extract, try fallback to extract
      if (extractMethod !== 'extract') {
        console.log('Scrape failed, falling back to extract method...');
        return extractMenuData(url, customPrompt, customSchema, 'extract');
      }
      
      throw new Error(`${extractMethod} failed with status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || `Failed to ${extractMethod} data`);
    }
    
    // Log the complete response data structure for debugging
    console.log(`Complete ${extractMethod} response data structure:`, Object.keys(result));
    
    // Validate that data exists
    if (!result.data) {
      console.error('No data in response:', result);
      throw new Error(`No data found in ${extractMethod} response`);
    }
    
    // Enhanced response processing with better error handling
    
    // First check direct menuItems path
    if (result.data.menuItems && Array.isArray(result.data.menuItems)) {
      console.log(`Found ${result.data.menuItems.length} menu items in data.menuItems`);
    } 
    // Check for nested data structure (common with JSON format responses)
    else if (result.data.json && result.data.json.menuItems && Array.isArray(result.data.json.menuItems)) {
      console.log(`Found ${result.data.json.menuItems.length} menu items in data.json.menuItems`);
      // Update data structure to match expected format
      result.data = { 
        menuItems: result.data.json.menuItems,
        // Preserve any metadata if it exists
        metadata: result.data.metadata || {}
      };
    }
    // Check another common response path
    else if (result.data.data && result.data.data.menuItems && Array.isArray(result.data.data.menuItems)) {
      console.log(`Found ${result.data.data.menuItems.length} menu items in data.data.menuItems`);
      result.data = result.data.data;
    }
    // Check for various data locations that could match our schema
    else {
      console.log('Searching for menuItems in result structure...');
      
      // Try to find valid menu data in the response structure
      const findMenuItems = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        
        // Check if this object has menuItems array
        if (obj.menuItems && Array.isArray(obj.menuItems) && obj.menuItems.length > 0) {
          return { menuItems: obj.menuItems };
        }
        
        // Check if this object itself is an array of menu-like items
        if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
          const sampleItem = obj[0];
          // Check if array contains objects with common menu item properties
          if (sampleItem.dishName || sampleItem.name || 
              sampleItem.price || sampleItem.dishPrice ||
              sampleItem.categoryName || sampleItem.category) {
            
            // Transform to expected format if needed
            const transformedItems = obj.map(item => ({
              dishName: item.dishName || item.name || '',
              dishPrice: typeof item.dishPrice === 'number' ? item.dishPrice : 
                          typeof item.price === 'number' ? item.price : 
                          parseFloat(item.dishPrice || item.price || 0) || 0,
              dishDescription: item.dishDescription || item.description || '',
              categoryName: item.categoryName || item.category || 'Uncategorized',
              menuName: item.menuName || item.menu || 'Menu',
              imageURL: item.imageURL || item.image || item.img || '',
              tags: Array.isArray(item.tags) ? item.tags : []
            }));
            
            return { menuItems: transformedItems };
          }
        }
        
        // Recursively search all properties
        for (const key in obj) {
          const result = findMenuItems(obj[key]);
          if (result) return result;
        }
        
        return null;
      };
      
      // Try to find menu data in the response
      const foundData = findMenuItems(result.data);
      
      if (foundData) {
        console.log(`Found menu items in response structure through deep search`);
        result.data = foundData;
      } else {
        // If all else fails, check if we can adapt what we have
        if (typeof result.data === 'object' && !Array.isArray(result.data)) {
          // Check if the result itself looks like a single menu item
          if (result.data.dishName || result.data.name || 
              result.data.price || result.data.dishPrice) {
            console.log('Response appears to be a single menu item, converting to array');
            result.data = { 
              menuItems: [
                {
                  dishName: result.data.dishName || result.data.name || '',
                  dishPrice: typeof result.data.dishPrice === 'number' ? result.data.dishPrice : 
                            typeof result.data.price === 'number' ? result.data.price : 
                            parseFloat(result.data.dishPrice || result.data.price || 0) || 0,
                  dishDescription: result.data.dishDescription || result.data.description || '',
                  categoryName: result.data.categoryName || result.data.category || 'Uncategorized',
                  menuName: result.data.menuName || result.data.menu || 'Menu',
                  imageURL: result.data.imageURL || result.data.image || result.data.img || '',
                  tags: Array.isArray(result.data.tags) ? result.data.tags : []
                }
              ]
            };
          }
        }
      }
    }
    
    // Final validation that we have data in the expected format
    if (!result.data.menuItems || !Array.isArray(result.data.menuItems) || result.data.menuItems.length === 0) {
      console.error('Invalid or empty data structure received:', result.data);
      
      // If we've already tried extract as fallback, throw an error
      if (extractMethod === 'extract') {
        throw new Error('Results missing expected menu data structure after trying both methods');
      }
      
      // Try extract method as fallback
      console.log('Scrape returned invalid structure, falling back to extract method...');
      return extractMenuData(url, customPrompt, customSchema, 'extract');
    }
    
    // Normalize all menu items to ensure consistent format
    result.data.menuItems = result.data.menuItems.map(item => ({
      dishName: item.dishName || item.name || '',
      dishPrice: typeof item.dishPrice === 'number' ? item.dishPrice : 
                typeof item.price === 'number' ? item.price : 
                parseFloat(item.dishPrice || item.price || 0) || 0,
      dishDescription: item.dishDescription || item.description || '',
      categoryName: item.categoryName || item.category || 'Uncategorized',
      menuName: item.menuName || item.menu || 'Menu',
      imageURL: item.imageURL || item.image || item.img || '',
      tags: Array.isArray(item.tags) ? item.tags : []
    }));
    
    console.log(`${extractMethod} completed successfully with`, 
                result.data.menuItems.length, 
                'menu items extracted');
    
    return {
      success: true,
      data: result.data,
      method: extractMethod // Include the method used in the response
    };
  } catch (error) {
    console.error(`Error during menu extraction:`, error);
    throw error; // Re-throw to allow App.jsx to handle the error
  }
}

/**
 * Utility function to validate a restaurant URL
 * 
 * @param {string} url - URL to validate
 * @returns {Object} - Validation result with platform info
 */
function validateRestaurantUrl(url) {
  if (!url) {
    return {
      valid: false,
      error: 'URL is required'
    };
  }
  
  // Check if it's a valid URL format
  try {
    new URL(url);
  } catch (e) {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }
  
  // Check for supported platforms
  const isUberEats = url.includes('ubereats.com');
  const isDoorDash = url.includes('doordash.com');
  
  if (!isUberEats && !isDoorDash) {
    return {
      valid: false,
      error: 'URL must be from UberEats or DoorDash'
    };
  }
  
  return {
    valid: true,
    platform: isUberEats ? 'ubereats' : isDoorDash ? 'doordash' : 'unknown'
  };
}

/**
 * Extract menu data using the appropriate method based on options
 * 
 * @param {string} url - Restaurant URL (UberEats or DoorDash)
 * @param {string} customPrompt - Optional custom extraction prompt
 * @param {Object} customSchema - Optional custom extraction schema
 * @param {string} method - Extraction method ('standard' or 'category-based', defaults to 'standard')
 * @param {Object} targetedExtraction - Optional targeted extraction info {type: 'category', value: 'categoryName'}
 * @returns {Promise<Object>} - Complete extraction data
 */
async function extractMenuDataWithMethod(url, customPrompt, customSchema, method = 'standard', targetedExtraction = null) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  console.log(`Using extraction method: ${method}`);
  
  // Validate URL
  const validation = validateRestaurantUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  try {
    // Use the appropriate extraction method based on user selection
    if (method === 'category-based') {
      console.log('Using category-based extraction for better handling of large menus');
      return await categoryBasedExtractMenuData(url, { 
        customPrompt, 
        customSchema,
        targetedCategory: targetedExtraction?.type === 'category' ? targetedExtraction.value : null
      });
    } else if (method === 'option-sets') {
      console.log('Using option sets extraction for UberEats option sets data');
      return await extractOptionSetsData(url, { customPrompt, customSchema });
    } else if (method === 'image-update') {
      console.log('Image-update method requires existing menu items');
      throw new Error('Image-update method must be called with existing menu items');
    } else {
      // Default to standard extraction
      console.log('Using standard single-pass extraction');
      return await extractMenuData(url, customPrompt, customSchema, 'scrape');
    }
  } catch (error) {
    console.error(`Error during menu extraction with method ${method}:`, error);
    throw error;
  }
}

/**
 * Extract menu data using a category-based two-phase approach
 * First scans for categories, then extracts items from each category separately
 * 
 * @param {string} url - Restaurant URL (UberEats or DoorDash)
 * @param {Object} options - Options for extraction
 * @param {string} options.customPrompt - Custom prompt for extraction
 * @param {Object} options.customSchema - Custom schema for extraction
 * @param {string} options.targetedCategory - Optional specific category to extract (null extracts all)
 * @returns {Promise<Object>} - Complete extraction data with all menu items
 */
async function categoryBasedExtractMenuData(url, options = {}) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  // Check if this is an image-only update
  const imageUpdateMode = options.imageUpdateMode || false;
  const existingMenuItems = options.existingMenuItems || [];
  
  try {
    console.log(`Starting category-based extraction for URL: ${url}`);
    
    // If in image update mode with a targeted category, skip category scanning
    if (imageUpdateMode && options.targetedCategory && existingMenuItems.length > 0) {
      console.log('=== CATEGORY-BASED IMAGE UPDATE MODE ===');
      console.log(`Category: "${options.targetedCategory}"`);
      console.log(`Existing items: ${existingMenuItems.length}`);
      console.log('SKIPPING normal extraction - using image-only mode');
      
      // Get platform type from existing items or URL
      const platform = existingMenuItems[0]?.platform || 
                      (url.includes('ubereats.com') ? 'ubereats' : 
                       url.includes('doordash.com') ? 'doordash' : 'ubereats');
      console.log(`Detected platform: ${platform}`);
      
      // Use the image-focused extraction
      const imageResult = await extractImageUpdatesForCategory(
        url, 
        options.targetedCategory, 
        existingMenuItems,
        platform
      );
      
      console.log('Image update completed, returning early');
      return imageResult;
    }
    
    console.log('NOT in image update mode, proceeding with normal category-based extraction...');
    
    // Phase 1: Scan for menu categories
    console.log('Phase 1: Scanning for menu categories...');
    
    const scanResponse = await fetch('/api/scan-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url
      })
    });
    
    if (!scanResponse.ok) {
      const errorText = await scanResponse.text();
      console.error('Category scan error response:', errorText);
      throw new Error(`Category scan failed with status: ${scanResponse.status}`);
    }
    
    const scanResult = await scanResponse.json();
    
    if (!scanResult.success) {
      throw new Error(scanResult.error || 'Failed to scan menu categories');
    }
    
    // Validate that categories exist
    if (!scanResult.data || !scanResult.data.categories || !Array.isArray(scanResult.data.categories)) {
      console.error('Invalid category scan result:', scanResult);
      throw new Error('Category scan returned invalid data structure');
    }
    
    const categories = scanResult.data.categories;
    console.log(`Found ${categories.length} menu categories: ${categories.map(c => c.name).join(', ')}`);
    
    // Detect platform type 
    const platformType = scanResult.data.platformType || 
                         (url.includes('ubereats.com') ? 'ubereats' : 
                          url.includes('doordash.com') ? 'doordash' : 'unknown');
    
    // If targetedCategory is specified, filter to only that category
    let categoriesToExtract = categories;
    if (options.targetedCategory) {
      const targetCategory = categories.find(c => 
        c.name.toLowerCase() === options.targetedCategory.toLowerCase() ||
        c.name.includes(options.targetedCategory) ||
        options.targetedCategory.includes(c.name)
      );
      
      if (targetCategory) {
        console.log(`Targeted extraction: focusing only on category "${targetCategory.name}"`);
        categoriesToExtract = [targetCategory];
      } else {
        console.warn(`Target category "${options.targetedCategory}" not found. Available categories: ${categories.map(c => c.name).join(', ')}`);
        // Continue with all categories as fallback
      }
    }
    
    // Phase 2: Extract menu items for each category
    console.log(`Phase 2: Extracting menu items for ${categoriesToExtract.length} categories...`);
    
    const batchResponse = await fetch('/api/batch-extract-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        categories: categoriesToExtract
      })
    });
    
    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error('Batch extraction error response:', errorText);
      throw new Error(`Batch extraction failed with status: ${batchResponse.status}`);
    }
    
    const batchResult = await batchResponse.json();
    
    if (!batchResult.success) {
      throw new Error(batchResult.error || 'Failed to extract menu items by category');
    }
    
    // Validate that menu items exist
    if (!batchResult.data || !batchResult.data.menuItems || !Array.isArray(batchResult.data.menuItems)) {
      console.error('Invalid batch extraction result:', batchResult);
      throw new Error('Batch extraction returned invalid data structure');
    }
    
    const menuItems = batchResult.data.menuItems;
    console.log(`Successfully extracted ${menuItems.length} menu items across categories`);
    
    // Format any incompletely extracted categories warnings
    let warnings = [];
    if (batchResult.categories && batchResult.categories.failed && batchResult.categories.failed.length > 0) {
      warnings.push(`${batchResult.categories.failed.length} categories had extraction issues: ${batchResult.categories.failed.map(c => c.name).join(', ')}`);
    }
    
    // Normalize all menu items to ensure consistent format
    const normalizedMenuItems = menuItems.map(item => ({
      dishName: item.dishName || item.name || '',
      dishPrice: typeof item.dishPrice === 'number' ? item.dishPrice : 
                typeof item.price === 'number' ? item.price : 
                parseFloat(item.dishPrice || item.price || 0) || 0,
      dishDescription: item.dishDescription || item.description || '',
      categoryName: item.categoryName || item.category || 'Uncategorized',
      menuName: item.menuName || item.menu || 'Menu',
      imageURL: item.imageURL || item.image || item.img || '',
      tags: Array.isArray(item.tags) ? item.tags : []
    }));
    
    console.log('Category-based extraction completed successfully');
    
    return {
      success: true,
      data: {
        menuItems: normalizedMenuItems,
        restaurantInfo: {
          platform: platformType
        }
      },
      categories: batchResult.categories,
      method: 'category-based',
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    console.error(`Error during category-based menu extraction:`, error);
    
    // If category-based extraction fails, try to fall back to standard extraction
    console.log('Falling back to standard extraction method...');
    
    try {
      const fallbackResult = await extractMenuData(url, null, null, 'scrape');
      if (fallbackResult.success) {
        console.log('Successfully fell back to standard extraction method');
        return {
          ...fallbackResult,
          method: 'standard-fallback',
          warnings: ['Category-based extraction failed, fell back to standard extraction.']
        };
      } else {
        throw new Error('Fallback extraction also failed');
      }
    } catch (fallbackError) {
      console.error('Fallback extraction error:', fallbackError);
      throw error; // Throw the original error
    }
  }
}

/**
 * Extract image updates for a specific category
 * Uses specialized prompts to match images to existing menu items
 * 
 * @param {string} url - Restaurant URL
 * @param {string} categoryName - Category to extract images for
 * @param {Array} existingMenuItems - Existing menu items in the category
 * @param {string} platform - Platform type ('ubereats' or 'doordash')
 * @returns {Promise<Object>} - Updated menu items with new images
 */
async function extractImageUpdatesForCategory(url, categoryName, existingMenuItems, platform = 'ubereats') {
  if (!url || !categoryName || !existingMenuItems || existingMenuItems.length === 0) {
    throw new Error('URL, category name, and existing menu items are required');
  }

  try {
    console.log('=== IMAGE-ONLY EXTRACTION STARTED ===');
    console.log(`Category: ${categoryName}`);
    console.log(`Platform: ${platform}`);
    console.log(`Looking for images for ${existingMenuItems.length} items`);
    
    // Add a small delay to avoid rate limiting if this is called after another extraction
    console.log('Adding 2-second delay to avoid rate limits...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate specialized prompt and schema for image extraction
    const imagePrompt = generateImageFocusedPrompt(existingMenuItems, categoryName, platform);
    const imageSchema = generateImageOnlySchema();

    // Use the regular scrape endpoint with our custom prompt and schema
    console.log('Using /api/scrape endpoint with image-focused prompt and schema');
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        prompt: imagePrompt,
        schema: imageSchema
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image extraction error response:', errorText);
      throw new Error(`Image extraction failed with status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract images');
    }

    // Extract menu items from the response
    let extractedItems = [];
    if (result.data && result.data.menuItems) {
      extractedItems = result.data.menuItems;
    } else if (result.data && Array.isArray(result.data)) {
      extractedItems = result.data;
    }

    console.log(`Extracted ${extractedItems.length} items with images`);

    // Merge the extracted images with existing menu items
    const updatedItems = mergeImageUpdates(existingMenuItems, extractedItems);

    return {
      success: true,
      data: {
        menuItems: updatedItems,
        updateCount: extractedItems.length
      },
      method: 'image-update'
    };
  } catch (error) {
    console.error('Error during image extraction:', error);
    throw error;
  }
}

/**
 * Extract option sets data using a two-phase approach
 * First scans for menu item URLs, then extracts option sets from each item page
 * 
 * @param {string} url - Restaurant URL (UberEats)
 * @param {Object} options - Options for extraction
 * @returns {Promise<Object>} - Complete option sets data
 */
async function extractOptionSetsData(url, options = {}) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  try {
    console.log(`Starting option sets extraction for URL: ${url}`);
    
    // Phase 1: Scan for menu item URLs
    console.log('Phase 1: Scanning for menu item URLs...');
    
    const scanResponse = await fetch('/api/scan-menu-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url
      })
    });
    
    if (!scanResponse.ok) {
      const errorText = await scanResponse.text();
      console.error('Menu items scan error response:', errorText);
      throw new Error(`Menu items scan failed with status: ${scanResponse.status}`);
    }
    
    const scanResult = await scanResponse.json();
    
    if (!scanResult.success) {
      throw new Error(scanResult.error || 'Failed to scan menu item URLs');
    }
    
    // Validate that menu item URLs exist
    if (!scanResult.data || !scanResult.data.menuItemUrls || !Array.isArray(scanResult.data.menuItemUrls)) {
      console.error('Invalid menu items scan result:', scanResult);
      throw new Error('Menu items scan returned invalid data structure');
    }
    
    const menuItemUrls = scanResult.data.menuItemUrls;
    console.log(`Found ${menuItemUrls.length} menu item URLs`);
    
    // Phase 2: Extract option sets from each menu item URL
    console.log('Phase 2: Extracting option sets from menu item pages...');
    
    const batchResponse = await fetch('/api/batch-extract-option-sets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        menuItemUrls
      })
    });
    
    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error('Batch option sets extraction error response:', errorText);
      throw new Error(`Batch option sets extraction failed with status: ${batchResponse.status}`);
    }
    
    const batchResult = await batchResponse.json();
    
    if (!batchResult.success) {
      throw new Error(batchResult.error || 'Failed to extract option sets');
    }
    
    // Validate that option sets exist
    if (!batchResult.data || !batchResult.data.optionSets || !Array.isArray(batchResult.data.optionSets)) {
      console.error('Invalid batch option sets result:', batchResult);
      throw new Error('Batch option sets extraction returned invalid data structure');
    }
    
    const optionSets = batchResult.data.optionSets;
    console.log(`Successfully extracted option sets from ${optionSets.length} menu items`);
    
    // Consolidate duplicate option sets
    const consolidatedOptionSets = consolidateDuplicateOptionSets(optionSets);
    
    console.log('Option sets extraction completed successfully');
    
    return {
      success: true,
      data: {
        optionSets: consolidatedOptionSets,
        rawData: optionSets, // Keep raw data for reference
        stats: {
          totalMenuItems: menuItemUrls.length,
          menuItemsWithOptions: optionSets.length,
          uniqueOptionSets: consolidatedOptionSets.length
        }
      },
      method: 'option-sets'
    };
  } catch (error) {
    console.error(`Error during option sets extraction:`, error);
    throw error;
  }
}

/**
 * Consolidate duplicate option sets based on identical option names and prices
 * 
 * @param {Array} optionSets - Array of option sets from different menu items
 * @returns {Array} - Consolidated option sets with menu items references
 */
function consolidateDuplicateOptionSets(optionSets) {
  const consolidatedMap = new Map();
  
  optionSets.forEach(itemData => {
    const menuItemName = itemData.menuItemName;
    
    itemData.optionSets.forEach(optionSet => {
      // Create a unique key based on option set name and all options
      const optionsKey = optionSet.options
        .map(opt => `${opt.optionName}:${opt.optionPrice}`)
        .sort()
        .join('|');
      const setKey = `${optionSet.optionSetName}__${optionsKey}`;
      
      if (consolidatedMap.has(setKey)) {
        // Add this menu item to the existing option set
        const existing = consolidatedMap.get(setKey);
        if (!existing.menuItems.includes(menuItemName)) {
          existing.menuItems.push(menuItemName);
        }
      } else {
        // Create a new consolidated option set
        consolidatedMap.set(setKey, {
          ...optionSet,
          menuItems: [menuItemName]
        });
      }
    });
  });
  
  return Array.from(consolidatedMap.values());
}

/**
 * Generate a CSV file from extraction data
 * 
 * @param {Object} data - Extraction data
 * @param {Object} options - Options for CSV generation
 * @returns {Promise<Object>} - CSV generation result
 */
async function generateCSV(data, options = {}) {
  try {
    console.log('Generating CSV file');
    
    // Make API request to generate CSV
    const response = await fetch('/api/generate-csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        options
      })
    });
    
    if (!response.ok) {
      throw new Error(`CSV generation failed with status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate CSV');
    }
    
    return {
      success: true,
      csvData: result.csvData,
      filename: result.filename
    };
  } catch (error) {
    console.error('Error generating CSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// CommonJS exports for Node.js (backend)
module.exports = {
  // Schemas
  DEFAULT_SCHEMA,
  CATEGORY_DETECTION_SCHEMA,
  OPTION_SETS_SCHEMA,
  SCHEMA_OPTIONS,

  // Prompts
  DEFAULT_PROMPT,
  UBEREATS_CATEGORY_PROMPT,
  DOORDASH_CATEGORY_PROMPT,
  GENERIC_CATEGORY_PROMPT,
  ORDERMEAL_CATEGORY_PROMPT,
  MOBI2GO_CATEGORY_PROMPT,
  NEXTORDER_CATEGORY_PROMPT,
  DELIVEREASY_CATEGORY_PROMPT,
  FOODHUB_CATEGORY_PROMPT,
  UBEREATS_OPTION_SETS_PROMPT,
  PROMPT_OPTIONS,
  EXTRACTION_METHOD_OPTIONS,

  // Functions
  generateCategorySchema,
  extractMenuData,
  validateRestaurantUrl,
  extractMenuDataWithMethod,
  categoryBasedExtractMenuData,
  extractImageUpdatesForCategory,
  extractOptionSetsData,
  generateCSV
};