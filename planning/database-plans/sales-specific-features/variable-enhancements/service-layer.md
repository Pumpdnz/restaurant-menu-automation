# Service Layer Specifications

## Overview

This document details all service-layer changes required for the variable enhancement system across all 5 implementation phases.

## File: variable-replacement-service.js

**Location:** `src/services/variable-replacement-service.js`

**Current State:** 464 lines, well-structured, comprehensive

**Changes Required:**

### Phase 1: No Service Changes
- Service is already complete
- UI components just need to use `getAvailableVariables()` instead of hardcoding

### Phase 3: Add Real-time Validation Helper

**New Function:**

```javascript
/**
 * Validate variables in real-time for UI feedback
 * Lightweight version of validateVariables for use in useEffect
 * @param {string} messageContent - Message being typed
 * @returns {object} Validation status with details
 */
function validateVariablesRealtime(messageContent) {
  if (!messageContent) {
    return {
      isValid: true,
      hasVariables: false,
      unknownVariables: [],
      knownVariables: [],
      totalVariables: 0
    };
  }

  const validation = validateVariables(messageContent);

  return {
    ...validation,
    hasVariables: validation.totalVariables > 0
  };
}
```

**Usage in UI:**
```javascript
// In component
const [validation, setValidation] = useState({ isValid: true });

useEffect(() => {
  const result = validateVariablesRealtime(formData.message);
  setValidation(result);
}, [formData.message]);
```

**Export Addition:**
```javascript
module.exports = {
  extractVariables,
  replaceVariables,
  getVariableValue,
  getAvailableVariables,
  validateVariables,
  validateVariablesRealtime,  // NEW
  VARIABLE_MAPPINGS
};
```

### Phase 4: Add Dynamic Variable Support

**New Function: getExampleRestaurants**

```javascript
/**
 * Fetch example restaurants for a city
 * Used for dynamic variables {example_restaurant_1} and {example_restaurant_2}
 * @param {string} city - City name
 * @returns {Promise<Array>} Array of example restaurants (max 2)
 */
async function getExampleRestaurants(city) {
  if (!city) {
    return [];
  }

  try {
    const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

    const { data, error } = await getSupabaseClient()
      .from('city_example_customers')
      .select('*')
      .eq('organisation_id', getCurrentOrganizationId())
      .eq('city', city)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(2);

    if (error) {
      console.error('Error fetching example restaurants:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch example restaurants:', error);
    return [];
  }
}
```

**New Function: formatVariableAsLink**

```javascript
/**
 * Format variable value as link (HTML or plain text)
 * Used for dynamic variables that include URLs
 * @param {string} value - Display value (e.g., "Burger King")
 * @param {string} url - URL to link to
 * @param {string} format - 'html' or 'text'
 * @returns {string} Formatted output
 */
function formatVariableAsLink(value, url, format = 'text') {
  if (!value || !url) {
    return value || '';
  }

  if (format === 'html') {
    // Sanitize URL for HTML
    const sanitizedUrl = url
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');

    return `<a href="${sanitizedUrl}" target="_blank">${value}</a>`;
  }

  // Plain text format
  return `${value} (${url})`;
}
```

**Update VARIABLE_MAPPINGS:**

```javascript
const VARIABLE_MAPPINGS = {
  // ... existing 63 variables ...

  // NEW: Dynamic example restaurant variables
  example_restaurant_1: async (restaurant) => {
    const examples = await getExampleRestaurants(restaurant.city);
    return examples[0]?.display_name || '';
  },

  example_restaurant_2: async (restaurant) => {
    const examples = await getExampleRestaurants(restaurant.city);
    return examples[1]?.display_name || '';
  },

  example_restaurant_1_url: async (restaurant) => {
    const examples = await getExampleRestaurants(restaurant.city);
    return examples[0]?.store_url || '';
  },

  example_restaurant_2_url: async (restaurant) => {
    const examples = await getExampleRestaurants(restaurant.city);
    return examples[1]?.store_url || '';
  },
};
```

**Enhanced replaceVariables for Link Formatting:**

```javascript
/**
 * Replace variables in message with restaurant data
 * Enhanced to support link formatting for email messages
 * @param {string} messageContent - The message template with variables
 * @param {object} restaurant - The restaurant data object
 * @param {object} options - Rendering options
 * @param {string} options.format - 'html' or 'text' (default: 'text')
 * @returns {Promise<string>} The message with variables replaced
 */
async function replaceVariables(messageContent, restaurant, options = {}) {
  if (!messageContent || !restaurant) return messageContent;

  const format = options.format || 'text';
  let result = messageContent;
  const variables = extractVariables(messageContent);

  // Cache for this replacement operation
  const cache = new Map();

  for (const variable of variables) {
    // Check cache first
    if (!cache.has(variable)) {
      const value = await getVariableValue(variable, restaurant);
      cache.set(variable, value);
    }

    let value = cache.get(variable);

    // Special handling for link variables in HTML format
    if (format === 'html' && variable.startsWith('example_restaurant_')) {
      // Check if this is a name variable (not URL)
      if (!variable.endsWith('_url')) {
        const urlVariable = `${variable}_url`;
        const url = await getVariableValue(urlVariable, restaurant);

        if (url) {
          value = formatVariableAsLink(value, url, 'html');
        }
      } else {
        // Skip URL variables in HTML mode (already handled above)
        continue;
      }
    }

    const regex = new RegExp(`\\{${variable}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}
```

**Export Additions:**
```javascript
module.exports = {
  extractVariables,
  replaceVariables,
  getVariableValue,
  getAvailableVariables,
  validateVariables,
  validateVariablesRealtime,
  getExampleRestaurants,      // NEW
  formatVariableAsLink,        // NEW
  VARIABLE_MAPPINGS
};
```

**Update getAvailableVariables:**

```javascript
function getAvailableVariables() {
  return [
    // ... existing 9 categories ...

    // NEW: Dynamic Variables (Phase 4)
    {
      category: 'Dynamic Examples',
      variables: [
        { name: 'example_restaurant_1', description: 'First example customer in city', example: 'Burger King' },
        { name: 'example_restaurant_2', description: 'Second example customer in city', example: 'Pizza Hut' },
        { name: 'example_restaurant_1_url', description: 'First example customer URL', example: 'https://burgerking.pumpd.co.nz' },
        { name: 'example_restaurant_2_url', description: 'Second example customer URL', example: 'https://pizzahut.pumpd.co.nz' },
      ]
    }
  ];
}
```

### Phase 5: Performance Optimization

**Caching Layer for Bulk Operations:**

```javascript
// Module-level cache for bulk operations
let cityExamplesCache = null;
let cacheEnabled = false;

/**
 * Enable caching for bulk operations
 * Should be called before bulk sequence creation
 */
function enableExampleCache() {
  cityExamplesCache = new Map();
  cacheEnabled = true;
}

/**
 * Clear the example cache
 * Should be called after bulk operation completes
 */
function clearExampleCache() {
  cityExamplesCache = null;
  cacheEnabled = false;
}

/**
 * Get example restaurants with caching support
 * @param {string} city - City name
 * @returns {Promise<Array>} Array of examples
 */
async function getExampleRestaurantsWithCache(city) {
  if (!cacheEnabled || !cityExamplesCache) {
    return getExampleRestaurants(city);
  }

  if (!cityExamplesCache.has(city)) {
    const examples = await getExampleRestaurants(city);
    cityExamplesCache.set(city, examples);
  }

  return cityExamplesCache.get(city);
}
```

**Update VARIABLE_MAPPINGS to use cache:**

```javascript
const VARIABLE_MAPPINGS = {
  // ... existing variables ...

  example_restaurant_1: async (restaurant) => {
    const examples = await getExampleRestaurantsWithCache(restaurant.city);
    return examples[0]?.display_name || '';
  },

  example_restaurant_2: async (restaurant) => {
    const examples = await getExampleRestaurantsWithCache(restaurant.city);
    return examples[1]?.display_name || '';
  },

  // ... etc
};
```

**Export Additions:**
```javascript
module.exports = {
  extractVariables,
  replaceVariables,
  getVariableValue,
  getAvailableVariables,
  validateVariables,
  validateVariablesRealtime,
  getExampleRestaurants,
  getExampleRestaurantsWithCache,  // NEW
  formatVariableAsLink,
  enableExampleCache,              // NEW
  clearExampleCache,               // NEW
  VARIABLE_MAPPINGS
};
```

## File: sequence-instances-service.js

**Location:** `src/services/sequence-instances-service.js`

**Changes Required:**

### Phase 4: Use Caching for Bulk Operations

**Update startSequenceBulk function:**

```javascript
async function startSequenceBulk(templateId, restaurantIds, options = {}) {
  const client = getSupabaseClient();
  const orgId = getCurrentOrganizationId();

  // ... existing validation ...

  try {
    // ... fetch template ...
    // ... bulk fetch restaurants ...

    // NEW: Enable example cache for bulk operation
    const variableReplacementService = require('./variable-replacement-service');
    variableReplacementService.enableExampleCache();

    // Process each restaurant
    for (const restaurantId of restaurantIds) {
      // ... existing logic to create instance and tasks ...

      // Variable rendering already uses the cache automatically
      const messageRendered = await variableReplacementService.replaceVariables(
        message,
        restaurant,
        { format: step.type === 'email' ? 'html' : 'text' }  // NEW: Pass format
      );

      // ... create tasks ...
    }

    // ... update template usage count ...

    return results;

  } catch (error) {
    console.error('Error in startSequenceBulk:', error);
    throw error;
  } finally {
    // NEW: Always clear cache after bulk operation
    const variableReplacementService = require('./variable-replacement-service');
    variableReplacementService.clearExampleCache();
  }
}
```

**Impact:**
- Before: 100 restaurants × 2 DB queries per restaurant = 200 queries
- After: 1 query per unique city (e.g., 10 cities = 10 queries)
- Performance improvement: ~20x faster for variable resolution

### Phase 4: Support Format Option

**Update startSequence function:**

```javascript
// In startSequence, when rendering variables
if (message) {
  messageRendered = await variableReplacementService.replaceVariables(
    message,
    restaurant,
    { format: step.type === 'email' ? 'html' : 'text' }  // NEW
  );
}
```

## File: tasks-service.js

**Location:** `src/services/tasks-service.js`

**Changes Required:**

### Phase 4: Support Format Option

**Update createTask function:**

```javascript
// At line 184-187 (current message rendering)
if (taskData.message) {
  taskData.message_rendered = await variableReplacementService.replaceVariables(
    taskData.message,
    restaurant,
    { format: taskData.type === 'email' ? 'html' : 'text' }  // NEW
  );
}
```

**Update updateTask function:**

```javascript
// At line 317-320 (current message re-rendering)
if (updates.message) {
  updates.message_rendered = await variableReplacementService.replaceVariables(
    updates.message,
    task.restaurants,
    { format: task.type === 'email' ? 'html' : 'text' }  // NEW
  );
}
```

## New File: example-customers-service.js

**Location:** `src/services/example-customers-service.js`

**Purpose:** Admin CRUD operations for city_example_customers table

**Phase 4 Deliverable:**

```javascript
/**
 * Example Customers Service
 * Admin operations for managing example customer references
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

/**
 * List example customers for organization
 * @param {object} filters - Filter options
 * @param {string} filters.city - Filter by city
 * @param {boolean} filters.is_active - Filter by active status
 * @returns {Promise<Array>} Array of example customers
 */
async function listExampleCustomers(filters = {}) {
  let query = getSupabaseClient()
    .from('city_example_customers')
    .select(`
      *,
      restaurants (
        id, name, subdomain
      )
    `)
    .eq('organisation_id', getCurrentOrganizationId())
    .order('city', { ascending: true })
    .order('display_order', { ascending: true });

  if (filters.city) {
    query = query.eq('city', filters.city);
  }

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing example customers:', error);
    throw error;
  }

  return data;
}

/**
 * Get single example customer
 * @param {string} id - Example customer ID
 * @returns {Promise<object>} Example customer
 */
async function getExampleCustomer(id) {
  const { data, error } = await getSupabaseClient()
    .from('city_example_customers')
    .select(`
      *,
      restaurants (
        id, name, subdomain
      )
    `)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .single();

  if (error) {
    console.error('Error getting example customer:', error);
    throw error;
  }

  return data;
}

/**
 * Create example customer
 * @param {object} exampleData - Example customer data
 * @returns {Promise<object>} Created example customer
 */
async function createExampleCustomer(exampleData) {
  const client = getSupabaseClient();

  // If restaurant_id provided, auto-fill display_name and store_url
  if (exampleData.restaurant_id) {
    const { data: restaurant } = await client
      .from('restaurants')
      .select('name, subdomain')
      .eq('id', exampleData.restaurant_id)
      .single();

    if (restaurant) {
      exampleData.display_name = exampleData.display_name || restaurant.name;
      exampleData.store_url = exampleData.store_url ||
        `https://${restaurant.subdomain}.pumpd.co.nz`;
    }
  }

  const { data, error } = await client
    .from('city_example_customers')
    .insert({
      ...exampleData,
      organisation_id: getCurrentOrganizationId()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating example customer:', error);
    throw error;
  }

  return data;
}

/**
 * Update example customer
 * @param {string} id - Example customer ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated example customer
 */
async function updateExampleCustomer(id, updates) {
  const { data, error } = await getSupabaseClient()
    .from('city_example_customers')
    .update(updates)
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId())
    .select()
    .single();

  if (error) {
    console.error('Error updating example customer:', error);
    throw error;
  }

  return data;
}

/**
 * Delete example customer
 * @param {string} id - Example customer ID
 * @returns {Promise<void>}
 */
async function deleteExampleCustomer(id) {
  const { error } = await getSupabaseClient()
    .from('city_example_customers')
    .delete()
    .eq('id', id)
    .eq('organisation_id', getCurrentOrganizationId());

  if (error) {
    console.error('Error deleting example customer:', error);
    throw error;
  }
}

/**
 * Reorder example customers for a city
 * @param {string} city - City name
 * @param {Array<{id: string, display_order: number}>} orderUpdates - New order
 * @returns {Promise<void>}
 */
async function reorderExampleCustomers(city, orderUpdates) {
  const client = getSupabaseClient();

  // Update each in transaction
  for (const update of orderUpdates) {
    await client
      .from('city_example_customers')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
      .eq('city', city)
      .eq('organisation_id', getCurrentOrganizationId());
  }
}

/**
 * Get list of cities with example customers
 * @returns {Promise<Array<string>>} Array of city names
 */
async function getCitiesWithExamples() {
  const { data, error } = await getSupabaseClient()
    .from('city_example_customers')
    .select('city')
    .eq('organisation_id', getCurrentOrganizationId())
    .eq('is_active', true);

  if (error) {
    console.error('Error getting cities:', error);
    throw error;
  }

  // Extract unique cities
  const cities = [...new Set(data.map(row => row.city))];
  return cities.sort();
}

module.exports = {
  listExampleCustomers,
  getExampleCustomer,
  createExampleCustomer,
  updateExampleCustomer,
  deleteExampleCustomer,
  reorderExampleCustomers,
  getCitiesWithExamples
};
```

## New Routes: example-customers-routes.js

**Location:** `src/routes/example-customers-routes.js`

**Phase 4 Deliverable:**

```javascript
/**
 * Example Customers Routes
 * Admin API for managing city example customers
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const exampleCustomersService = require('../services/example-customers-service');

/**
 * GET /api/example-customers
 * List all example customers
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      city: req.query.city,
      is_active: req.query.is_active === 'true' ? true :
                 req.query.is_active === 'false' ? false : undefined
    };

    const examples = await exampleCustomersService.listExampleCustomers(filters);
    res.json({ success: true, data: examples });
  } catch (error) {
    console.error('Error listing example customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/example-customers/cities
 * Get list of cities with examples
 */
router.get('/cities', authMiddleware, async (req, res) => {
  try {
    const cities = await exampleCustomersService.getCitiesWithExamples();
    res.json({ success: true, cities });
  } catch (error) {
    console.error('Error getting cities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/example-customers/:id
 * Get single example customer
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const example = await exampleCustomersService.getExampleCustomer(req.params.id);
    res.json({ success: true, data: example });
  } catch (error) {
    console.error('Error getting example customer:', error);
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/example-customers
 * Create example customer
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (!req.body.city || !req.body.display_name || !req.body.store_url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: city, display_name, store_url'
      });
    }

    const example = await exampleCustomersService.createExampleCustomer(req.body);
    res.status(201).json({ success: true, data: example });
  } catch (error) {
    console.error('Error creating example customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/example-customers/:id
 * Update example customer
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const example = await exampleCustomersService.updateExampleCustomer(
      req.params.id,
      req.body
    );
    res.json({ success: true, data: example });
  } catch (error) {
    console.error('Error updating example customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/example-customers/:id
 * Delete example customer
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await exampleCustomersService.deleteExampleCustomer(req.params.id);
    res.json({ success: true, message: 'Example customer deleted' });
  } catch (error) {
    console.error('Error deleting example customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/example-customers/reorder
 * Reorder example customers for a city
 */
router.post('/reorder', authMiddleware, async (req, res) => {
  try {
    if (!req.body.city || !req.body.order_updates) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: city, order_updates'
      });
    }

    await exampleCustomersService.reorderExampleCustomers(
      req.body.city,
      req.body.order_updates
    );

    res.json({ success: true, message: 'Order updated' });
  } catch (error) {
    console.error('Error reordering examples:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

**Register routes in main app:**

```javascript
// In src/app.js or similar
const exampleCustomersRoutes = require('./routes/example-customers-routes');
app.use('/api/example-customers', exampleCustomersRoutes);
```

## Service Testing

### Unit Tests for variable-replacement-service.js

```javascript
describe('Variable Replacement Service - Phase 4', () => {
  describe('getExampleRestaurants', () => {
    it('should fetch examples for city', async () => {
      const examples = await getExampleRestaurants('Auckland');

      expect(examples).toHaveLength(2);
      expect(examples[0]).toHaveProperty('display_name');
      expect(examples[0]).toHaveProperty('store_url');
    });

    it('should return empty array for city with no examples', async () => {
      const examples = await getExampleRestaurants('NonExistentCity');
      expect(examples).toEqual([]);
    });
  });

  describe('formatVariableAsLink', () => {
    it('should format as HTML link', () => {
      const result = formatVariableAsLink(
        'Burger King',
        'https://burgerking.pumpd.co.nz',
        'html'
      );

      expect(result).toBe(
        '<a href="https://burgerking.pumpd.co.nz" target="_blank">Burger King</a>'
      );
    });

    it('should format as plain text', () => {
      const result = formatVariableAsLink(
        'Burger King',
        'https://burgerking.pumpd.co.nz',
        'text'
      );

      expect(result).toBe('Burger King (https://burgerking.pumpd.co.nz)');
    });
  });

  describe('replaceVariables with dynamic variables', () => {
    it('should replace example restaurant variables', async () => {
      const message = 'Check out {example_restaurant_1} and {example_restaurant_2}';
      const restaurant = { city: 'Auckland' };

      const result = await replaceVariables(message, restaurant);

      expect(result).not.toContain('{example_restaurant_1}');
      expect(result).not.toContain('{example_restaurant_2}');
    });

    it('should format as HTML links for email', async () => {
      const message = 'Visit {example_restaurant_1}';
      const restaurant = { city: 'Auckland' };

      const result = await replaceVariables(message, restaurant, { format: 'html' });

      expect(result).toContain('<a href=');
      expect(result).toContain('target="_blank"');
    });
  });

  describe('Caching', () => {
    it('should use cache for repeated city lookups', async () => {
      enableExampleCache();

      const spy = jest.spyOn(db, 'query');

      await getExampleRestaurantsWithCache('Auckland');
      await getExampleRestaurantsWithCache('Auckland');
      await getExampleRestaurantsWithCache('Auckland');

      // Only 1 DB query for 3 calls
      expect(spy).toHaveBeenCalledTimes(1);

      clearExampleCache();
    });
  });
});
```

---

**Last Updated:** 2025-01-26
**Version:** 1.0
**Status:** Ready for Implementation
