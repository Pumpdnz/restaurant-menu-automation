/**
 * Platform detection and configuration utility
 */

// Primary platform configurations
const PLATFORM_CONFIG = {
  'ubereats.com': {
    name: 'UberEats',
    type: 'delivery',
    extractionMethod: 'firecrawl-structured',
    supported: true
  },
  'doordash.com': {
    name: 'DoorDash',
    type: 'delivery',
    extractionMethod: 'firecrawl-structured',
    supported: true
  },
  'ordermeal.co.nz': {
    name: 'OrderMeal',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'nextorder.nz': {
    name: 'NextOrder',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'nextorder.co.nz': {
    name: 'NextOrder',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'foodhub.co.nz': {
    name: 'FoodHub',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'mobi2go.com': {
    name: 'Mobi2Go',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'menulog.co.nz': {
    name: 'Menulog',
    type: 'delivery',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'delivereasy.co.nz': {
    name: 'DeliverEasy',
    type: 'delivery',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'bopple.app': {
    name: 'Bopple',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'resdiary.com': {
    name: 'ResDiary',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'meandu.app': {
    name: 'Me&u',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: false,
    blockedReason: 'Complex multi-menu structure requires special handling'
  },
  'gloriafood': {
    name: 'GloriaFood',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: false,
    blockedReason: 'Menu requires dialog interaction that cannot be automated',
    note: 'Embedded in restaurant websites'
  },
  'sipocloudpos.com': {
    name: 'Sipo',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'booknorder.co.nz': {
    name: 'BookNOrder',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  // Direct restaurant website patterns - Mobi2Go
  'scopa.co.nz': {
    name: 'Mobi2Go',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  },
  'ljs.co.nz': {
    name: 'Mobi2Go',
    type: 'ordering',
    extractionMethod: 'firecrawl-generic',
    supported: true
  }
};

// FoodHub custom domains (restaurants using FoodHub on their own domain)
const FOODHUB_CUSTOM_DOMAINS = [
  'konyakebabs.co.nz',
  'larubythaionline.co.nz',
  'fusionkebab.co.nz',
  'lakepizza.co.nz'
];

// GloriaFood domains (embedded widgets)
const GLORIAFOOD_DOMAINS = [
  'noi.co.nz',
  'luckythai.co.nz'
];

/**
 * Detect platform from URL
 * @param {string} url - The URL to analyze
 * @returns {Object} Platform information with detection confidence
 */
function detectPlatform(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check for PDF files
    if (url.toLowerCase().endsWith('.pdf')) {
      return {
        name: 'PDF',
        type: 'document',
        extractionMethod: 'pdf-parse',
        supported: false,
        confidence: 'high'
      };
    }

    // Check each known platform with clear identifiers
    for (const [domain, config] of Object.entries(PLATFORM_CONFIG)) {
      if (hostname.includes(domain)) {
        return {
          ...config,
          confidence: 'high',
          requiresManualSelection: false
        };
      }
    }

    // Check for subdomain patterns
    if (hostname.endsWith('.nextorder.nz') || hostname.endsWith('.nextorder.co.nz')) {
      return {
        name: 'NextOrder',
        type: 'ordering',
        extractionMethod: 'firecrawl-generic',
        supported: true,
        confidence: 'high',
        requiresManualSelection: false
      };
    }

    if (hostname.endsWith('.booknorder.co.nz')) {
      return {
        name: 'BookNOrder',
        type: 'ordering',
        extractionMethod: 'firecrawl-generic',
        supported: true,
        confidence: 'high',
        requiresManualSelection: false
      };
    }

    // No platform detected - require manual selection
    return {
      name: 'Unknown',
      type: 'unknown',
      extractionMethod: 'firecrawl-generic',
      supported: true,
      confidence: 'none',
      requiresManualSelection: true
    };
  } catch (error) {
    console.error('Error detecting platform:', error);
    return {
      name: 'Unknown',
      type: 'unknown',
      extractionMethod: 'firecrawl-generic',
      supported: true,
      confidence: 'none',
      requiresManualSelection: true
    };
  }
}

/**
 * Extract restaurant name from URL based on platform
 * @param {string} url - The URL to analyze
 * @param {Object} platform - Platform information
 * @returns {string|null} Extracted restaurant name or null
 */
function extractRestaurantName(url, platform) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const urlParts = urlObj.pathname.split('/').filter(part => part);
    
    switch (platform.name) {
      case 'UberEats':
      case 'DoorDash':
        // Look for 'store' segment
        const storeIndex = urlParts.indexOf('store');
        if (storeIndex !== -1 && urlParts[storeIndex + 1]) {
          return urlParts[storeIndex + 1].replace(/-/g, ' ');
        }
        break;
        
      case 'DeliverEasy':
        // Pattern: /restaurant-name-location-delivery
        if (urlParts[0]) {
          return urlParts[0].replace(/-delivery$/i, '').replace(/-/g, ' ');
        }
        break;
        
      case 'OrderMeal':
      case 'NextOrder':
        // Pattern: /restaurant-name/
        if (urlParts[0]) {
          return urlParts[0].replace(/-/g, ' ');
        }
        break;
        
      case 'FoodHub':
        // Can be either domain itself or first path segment
        if (hostname.includes('kebab') || hostname.includes('pizza') || 
            hostname.includes('thai') || hostname.includes('curry')) {
          // Extract from domain: konyakebabs.co.nz -> konya kebabs
          return hostname.split('.')[0].replace(/-/g, ' ');
        } else if (urlParts[0]) {
          return urlParts[0].replace(/-/g, ' ');
        }
        break;
        
      case 'Mobi2Go':
        // Can be subdomain or in path
        if (hostname.includes('mobi2go.com')) {
          // Pattern: biggiespizza.mobi2go.com
          const subdomain = hostname.split('.')[0];
          if (subdomain !== 'www' && subdomain !== 'order') {
            return subdomain.replace(/-/g, ' ');
          }
        } else {
          // Direct domain like scopa.co.nz or ljs.co.nz
          const domainParts = hostname.split('.');
          if (domainParts[0] !== 'www') {
            return domainParts[0].replace(/-/g, ' ');
          }
        }
        break;
        
      case 'Bopple':
        // Pattern: /restaurant-name/menu
        if (urlParts[0]) {
          return urlParts[0].replace(/-/g, ' ');
        }
        break;
        
      case 'ResDiary':
        // Extract from query parameter restaurantName
        const params = new URLSearchParams(urlObj.search);
        const resName = params.get('restaurantName');
        if (resName) {
          return resName.replace(/([A-Z])/g, ' $1').trim();
        }
        break;
        
      case 'Me&u':
        // Pattern: /restaurant-name-location/pickup/menu
        if (urlParts[0]) {
          return urlParts[0].replace(/-/g, ' ');
        }
        break;
        
      case 'Sipo':
        // Pattern: /restaurant-id or /restaurant-name
        if (urlParts[0]) {
          // Check if it's a number (ID) or name
          if (!/^\d+$/.test(urlParts[0])) {
            return urlParts[0].replace(/-/g, ' ');
          }
        }
        break;
        
      case 'BookNOrder':
        // Pattern: subdomain.booknorder.co.nz
        const bookNOrderSubdomain = hostname.split('.')[0];
        if (bookNOrderSubdomain && bookNOrderSubdomain !== 'www') {
          return bookNOrderSubdomain.replace(/-/g, ' ');
        }
        break;
        
      case 'GloriaFood':
      case 'Website':
        // Try to extract from domain name
        const domainName = hostname.split('.')[0];
        if (domainName && domainName !== 'www') {
          return domainName.replace(/-/g, ' ');
        } else if (urlParts[0] && urlParts[0] !== 'menu' && urlParts[0] !== 'order' && urlParts[0] !== 'online-ordering') {
          return urlParts[0].replace(/-/g, ' ');
        } else {
          // Try to extract from full domain without www
          const cleanDomain = hostname.replace('www.', '').split('.')[0];
          if (cleanDomain) {
            return cleanDomain.replace(/-/g, ' ');
          }
        }
        break;
        
      default:
        // Try to extract from the first meaningful path segment
        if (urlParts.length > 0 && urlParts[0] !== 'menu' && urlParts[0] !== 'order') {
          return urlParts[0].replace(/-/g, ' ');
        }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting restaurant name:', error);
    return null;
  }
}

/**
 * Get extraction configuration for a platform
 * @param {Object} platform - Platform information
 * @returns {Object} Extraction configuration
 */
function getExtractionConfig(platform) {
  const baseConfig = {
    formats: ['markdown'],
    onlyMainContent: true,
    waitFor: 2000,
    maxAge: 172800000 // 48 hours cache
  };
  
  switch (platform.extractionMethod) {
    case 'firecrawl-structured':
      return {
        ...baseConfig,
        formats: [
          {
            type: 'json',
            prompt: `Extract ALL menu items with their complete information including name, description, price, category, and image URL. Ensure ALL items are captured, including Featured Items and items that appear in multiple categories.`,
            schema: {
              type: 'object',
              properties: {
                restaurantName: { type: 'string' },
                categories: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            description: { type: 'string' },
                            price: { type: 'number' },
                            imageUrl: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      };
      
    case 'firecrawl-generic':
      return {
        ...baseConfig,
        formats: [
          {
            type: 'json',
            prompt: `Extract ALL menu items from this restaurant menu page. Look for items with names, descriptions, and prices. Group them by category if categories are visible. Include any image URLs if available.`,
            schema: {
              type: 'object',
              properties: {
                restaurantName: { type: 'string' },
                categories: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            description: { type: 'string' },
                            price: { type: 'number' },
                            imageUrl: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      };
      
    default:
      return baseConfig;
  }
}

// CommonJS exports (for Node.js/server-side)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectPlatform,
    extractRestaurantName,
    getExtractionConfig,
    PLATFORM_CONFIG
  };
}

// ESM exports (for Vite/frontend)
export { detectPlatform, extractRestaurantName, getExtractionConfig, PLATFORM_CONFIG };