/**
 * Qualification Service
 * Handles all qualification data operations for demo meeting tasks
 *
 * This service manages the bi-directional sync between tasks and restaurant records.
 * When a demo meeting task is created or edited, this service updates the restaurant
 * record with qualification data.
 */

const { getSupabaseClient, getCurrentOrganizationId } = require('./database-service');

/**
 * Field mapping: qualification data keys → restaurant column names
 * This ensures consistent mapping between frontend field names and database columns
 */
const FIELD_MAPPING = {
  // Contact & Business Context
  contact_role: 'contact_role',
  number_of_venues: 'number_of_venues',
  point_of_sale: 'point_of_sale',
  online_ordering_platform: 'online_ordering_platform',
  online_ordering_handles_delivery: 'online_ordering_handles_delivery',
  self_delivery: 'self_delivery',

  // UberEats Metrics
  weekly_uber_sales_volume: 'weekly_uber_sales_volume',
  uber_aov: 'uber_aov',
  uber_markup: 'uber_markup',
  uber_profitability: 'uber_profitability',
  uber_profitability_description: 'uber_profitability_description',

  // Marketing & Website
  current_marketing_description: 'current_marketing_description',
  website_type: 'website_type',

  // Sales Context (JSON Arrays)
  painpoints: 'painpoints',
  core_selling_points: 'core_selling_points',
  features_to_highlight: 'features_to_highlight',
  possible_objections: 'possible_objections',

  // Meeting Details
  details: 'details',
  meeting_link: 'meeting_link'
};

/**
 * Update restaurant with all qualification data
 * Used when creating a new demo meeting task
 *
 * @param {string} restaurantId - UUID of the restaurant
 * @param {object} qualificationData - Qualification data object
 * @returns {Promise<object>} Updated restaurant record
 * @throws {Error} If update fails
 */
async function updateRestaurantQualification(restaurantId, qualificationData) {
  const client = getSupabaseClient();
  const updates = mapQualificationToRestaurant(qualificationData);

  // If no valid fields to update, return early
  if (Object.keys(updates).length === 0) {
    console.log('No qualification fields to update');
    return null;
  }

  // Add updated_at timestamp
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await client
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .eq('organisation_id', getCurrentOrganizationId())
      .select()
      .single();

    if (error) {
      console.error('Failed to update restaurant qualification:', {
        restaurantId,
        error: error.message,
        code: error.code,
        details: error.details
      });

      // Handle specific error cases
      if (error.code === '23514') {
        throw new Error('Invalid qualification data: Check constraint violation');
      }

      if (error.code === '23503') {
        throw new Error('Restaurant not found or access denied');
      }

      if (error.code === 'PGRST116') {
        throw new Error('Restaurant not found in your organization');
      }

      throw new Error(`Failed to update restaurant: ${error.message}`);
    }

    console.log('Restaurant qualification updated successfully:', {
      restaurantId,
      fieldsUpdated: Object.keys(updates).length
    });

    return data;
  } catch (error) {
    console.error('updateRestaurantQualification failed:', error);
    throw error;
  }
}

/**
 * Update only changed fields on restaurant record
 * Used when editing an existing demo meeting task
 *
 * @param {string} restaurantId - UUID of the restaurant
 * @param {object} changedFields - Object containing only the fields that changed
 * @returns {Promise<object>} Updated restaurant record
 * @throws {Error} If update fails
 */
async function updateChangedFields(restaurantId, changedFields) {
  const client = getSupabaseClient();
  const updates = mapQualificationToRestaurant(changedFields);

  // If no valid fields to update, return early
  if (Object.keys(updates).length === 0) {
    console.log('No changed fields to update');
    return null;
  }

  // Add updated_at timestamp
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await client
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .eq('organisation_id', getCurrentOrganizationId())
      .select()
      .single();

    if (error) {
      console.error('Failed to update changed fields:', {
        restaurantId,
        error: error.message,
        code: error.code
      });

      // Handle specific error cases
      if (error.code === '23514') {
        throw new Error('Invalid qualification data: Check constraint violation');
      }

      if (error.code === '23503') {
        throw new Error('Restaurant not found or access denied');
      }

      if (error.code === 'PGRST116') {
        throw new Error('Restaurant not found in your organization');
      }

      throw new Error(`Failed to update restaurant: ${error.message}`);
    }

    console.log('Restaurant changed fields updated successfully:', {
      restaurantId,
      fieldsUpdated: Object.keys(updates).length
    });

    return data;
  } catch (error) {
    console.error('updateChangedFields failed:', error);
    throw error;
  }
}

/**
 * Map qualification data object to restaurant table columns
 * Filters out undefined/null values and maps field names to column names
 *
 * @param {object} qualificationData - Raw qualification data from frontend
 * @returns {object} Mapped data ready for database update
 */
function mapQualificationToRestaurant(qualificationData) {
  const updates = {};

  if (!qualificationData || typeof qualificationData !== 'object') {
    return updates;
  }

  // Map each field from the qualification data to restaurant columns
  Object.keys(FIELD_MAPPING).forEach(key => {
    // Only include field if it exists in the qualification data
    if (qualificationData.hasOwnProperty(key)) {
      const value = qualificationData[key];
      const column = FIELD_MAPPING[key];

      // Include the field even if it's null (allows clearing values)
      // But skip undefined values
      if (value !== undefined) {
        updates[column] = value;
      }
    }
  });

  return updates;
}

/**
 * Get qualification data from restaurant record
 * Retrieves all qualification fields for pre-filling forms
 *
 * @param {string} restaurantId - UUID of the restaurant
 * @returns {Promise<object>} Qualification data object
 * @throws {Error} If fetch fails
 */
async function getRestaurantQualification(restaurantId) {
  const client = getSupabaseClient();

  // Build select query with all qualification columns
  const selectColumns = Object.values(FIELD_MAPPING).join(', ');

  try {
    const { data, error } = await client
      .from('restaurants')
      .select(selectColumns)
      .eq('id', restaurantId)
      .eq('organisation_id', getCurrentOrganizationId())
      .single();

    if (error) {
      console.error('Failed to get restaurant qualification:', {
        restaurantId,
        error: error.message
      });

      if (error.code === 'PGRST116') {
        throw new Error('Restaurant not found in your organization');
      }

      throw new Error(`Failed to get restaurant qualification: ${error.message}`);
    }

    return data || {};
  } catch (error) {
    console.error('getRestaurantQualification failed:', error);
    throw error;
  }
}

/**
 * Validate qualification data structure
 * Ensures JSONB arrays have correct format
 *
 * @param {object} qualificationData - Qualification data to validate
 * @returns {object} Validation result { valid: boolean, errors: string[] }
 */
function validateQualificationData(qualificationData) {
  const errors = [];

  if (!qualificationData || typeof qualificationData !== 'object') {
    return { valid: true, errors: [] }; // Empty data is valid
  }

  // Validate JSONB array fields
  const arrayFields = ['painpoints', 'core_selling_points', 'features_to_highlight', 'possible_objections'];

  arrayFields.forEach(field => {
    if (qualificationData[field] !== undefined && qualificationData[field] !== null) {
      const value = qualificationData[field];

      // Must be an array
      if (!Array.isArray(value)) {
        errors.push(`${field} must be an array`);
        return;
      }

      // Each item must have correct structure
      const invalidItems = value.filter(item =>
        !item ||
        typeof item !== 'object' ||
        !['predefined', 'custom'].includes(item.type) ||
        typeof item.value !== 'string'
      );

      if (invalidItems.length > 0) {
        errors.push(`${field} contains invalid items (must be {type: 'predefined'|'custom', value: string})`);
      }
    }
  });

  // Validate numeric fields
  const numericFields = {
    number_of_venues: { min: 1, max: null },
    weekly_uber_sales_volume: { min: 0, max: null },
    uber_aov: { min: 0, max: null },
    uber_markup: { min: 0, max: 100 },
    uber_profitability: { min: -100, max: 100 }
  };

  Object.keys(numericFields).forEach(field => {
    if (qualificationData[field] !== undefined && qualificationData[field] !== null) {
      const value = qualificationData[field];
      const { min, max } = numericFields[field];

      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`${field} must be a valid number`);
        return;
      }

      if (min !== null && value < min) {
        errors.push(`${field} must be at least ${min}`);
      }

      if (max !== null && value > max) {
        errors.push(`${field} must be at most ${max}`);
      }
    }
  });

  // Validate website_type enum
  if (qualificationData.website_type !== undefined && qualificationData.website_type !== null) {
    const validTypes = ['platform_subdomain', 'custom_domain'];
    if (!validTypes.includes(qualificationData.website_type)) {
      errors.push(`website_type must be one of: ${validTypes.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  updateRestaurantQualification,
  updateChangedFields,
  mapQualificationToRestaurant,
  getRestaurantQualification,
  validateQualificationData,
  FIELD_MAPPING
};
