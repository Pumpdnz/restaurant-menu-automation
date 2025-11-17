/**
 * Variable Replacement Service
 * Handles variable extraction and replacement in message templates
 */

/**
 * Extract variables from message template
 * Returns array of variable names found in template
 * @param {string} messageContent - The message template content
 * @returns {string[]} Array of variable names
 */
function extractVariables(messageContent) {
  if (!messageContent) return [];

  const regex = /{([a-zA-Z_][a-zA-Z0-9_]*)}/g;
  const matches = messageContent.matchAll(regex);
  const variables = new Set();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Available variable mappings from restaurant data
 */
const VARIABLE_MAPPINGS = {
  // Restaurant basic info
  restaurant_name: 'name',
  restaurant_email: 'email',
  restaurant_phone: 'phone',
  restaurant_address: 'address',
  restaurant_website: 'website',
  city: 'city',

  // Lead contact info
  contact_name: 'contact_name',
  first_name: (restaurant) => {
    // Extract first name from contact_name
    if (!restaurant.contact_name) return '';
    const parts = restaurant.contact_name.trim().split(/\s+/);
    return parts[0] || '';
  },
  contact_email: 'contact_email',
  contact_phone: 'contact_phone',

  // Business info
  organisation_name: 'organisation_name',
  cuisine: (restaurant) => {
    if (Array.isArray(restaurant.cuisine)) {
      return restaurant.cuisine.join(', ');
    }
    return restaurant.cuisine || '';
  },

  // Opening hours
  opening_hours_text: 'opening_hours_text',

  // Sales info
  lead_stage: (restaurant) => {
    return restaurant.lead_stage?.replace(/_/g, ' ') || '';
  },
  lead_warmth: (restaurant) => {
    return restaurant.lead_warmth || '';
  },
  lead_status: (restaurant) => {
    return restaurant.lead_status || '';
  },
  icp_rating: 'icp_rating',

  // Demo store
  demo_store_url: 'demo_store_url',
  demo_store_built: (restaurant) => {
    return restaurant.demo_store_built ? 'Yes' : 'No';
  },

  // Pumpd URLs
  subdomain: 'subdomain',
  ordering_url: (restaurant) => {
    return restaurant.subdomain
      ? `https://${restaurant.subdomain}.pumpd.co.nz`
      : '';
  },
  admin_url: () => 'https://admin.pumpd.co.nz',

  // Platform URLs
  ubereats_url: 'ubereats_url',
  doordash_url: 'doordash_url',
  instagram_url: 'instagram_url',
  facebook_url: 'facebook_url',

  // Date variables
  today: () => {
    return new Date().toLocaleDateString('en-NZ');
  },
  current_date: () => {
    return new Date().toLocaleDateString('en-NZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },
  current_year: () => {
    return new Date().getFullYear().toString();
  }
};

/**
 * Get value from restaurant data using mapping
 * @param {string} variableName - The variable name to resolve
 * @param {object} restaurant - The restaurant data object
 * @returns {string} The resolved value
 */
function getVariableValue(variableName, restaurant) {
  const mapping = VARIABLE_MAPPINGS[variableName];

  if (!mapping) {
    // Return unchanged if mapping not found (keeps {variable_name} in output)
    return `{${variableName}}`;
  }

  if (typeof mapping === 'function') {
    return mapping(restaurant) || '';
  }

  return restaurant[mapping] || '';
}

/**
 * Replace variables in message with restaurant data
 * @param {string} messageContent - The message template with variables
 * @param {object} restaurant - The restaurant data object
 * @returns {Promise<string>} The message with variables replaced
 */
async function replaceVariables(messageContent, restaurant) {
  if (!messageContent || !restaurant) return messageContent;

  let result = messageContent;
  const variables = extractVariables(messageContent);

  for (const variable of variables) {
    const value = getVariableValue(variable, restaurant);
    const regex = new RegExp(`{${variable}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Get list of all available variables with descriptions
 * @returns {Array} Array of variable objects with name, description, and example
 */
function getAvailableVariables() {
  return [
    // Restaurant Information
    {
      category: 'Restaurant Information',
      variables: [
        { name: 'restaurant_name', description: 'Restaurant name', example: 'Bella Pizza' },
        { name: 'restaurant_email', description: 'Restaurant email', example: 'hello@bellapizza.co.nz' },
        { name: 'restaurant_phone', description: 'Restaurant phone', example: '09 123 4567' },
        { name: 'restaurant_address', description: 'Restaurant address', example: '123 Main St, Auckland' },
        { name: 'restaurant_website', description: 'Restaurant website', example: 'www.bellapizza.co.nz' },
        { name: 'city', description: 'Restaurant city', example: 'Auckland' },
        { name: 'cuisine', description: 'Cuisine type(s)', example: 'Italian, Pizza' },
      ]
    },
    // Contact Information
    {
      category: 'Contact Information',
      variables: [
        { name: 'contact_name', description: 'Lead contact name', example: 'John Smith' },
        { name: 'first_name', description: 'Lead contact first name', example: 'John' },
        { name: 'contact_email', description: 'Lead contact email', example: 'john@example.com' },
        { name: 'contact_phone', description: 'Lead contact phone', example: '021 123 4567' },
      ]
    },
    // Business Information
    {
      category: 'Business Information',
      variables: [
        { name: 'organisation_name', description: 'Organisation name', example: 'Bella Group Ltd' },
        { name: 'opening_hours_text', description: 'Opening hours text', example: 'Mon-Fri 11am-9pm' },
      ]
    },
    // Sales Information
    {
      category: 'Sales Information',
      variables: [
        { name: 'lead_stage', description: 'Current lead stage', example: 'demo booked' },
        { name: 'lead_warmth', description: 'Lead warmth level', example: 'warm' },
        { name: 'lead_status', description: 'Lead status', example: 'active' },
        { name: 'icp_rating', description: 'ICP fit rating (0-10)', example: '8' },
      ]
    },
    // Demo Store
    {
      category: 'Demo Store',
      variables: [
        { name: 'demo_store_url', description: 'Demo store URL', example: 'https://demo-bella.pumpd.co.nz' },
        { name: 'demo_store_built', description: 'Demo store built status', example: 'Yes' },
      ]
    },
    // Pumpd URLs
    {
      category: 'Pumpd URLs',
      variables: [
        { name: 'subdomain', description: 'Pumpd subdomain', example: 'bella-pizza' },
        { name: 'ordering_url', description: 'Pumpd ordering URL', example: 'https://bella-pizza.pumpd.co.nz' },
        { name: 'admin_url', description: 'Pumpd admin portal', example: 'https://admin.pumpd.co.nz' },
      ]
    },
    // Platform URLs
    {
      category: 'Platform URLs',
      variables: [
        { name: 'ubereats_url', description: 'UberEats URL', example: 'https://www.ubereats.com/store/...' },
        { name: 'doordash_url', description: 'DoorDash URL', example: 'https://www.doordash.com/store/...' },
        { name: 'instagram_url', description: 'Instagram profile URL', example: 'https://instagram.com/bellapizza' },
        { name: 'facebook_url', description: 'Facebook page URL', example: 'https://facebook.com/bellapizza' },
      ]
    },
    // Date Variables
    {
      category: 'Date Variables',
      variables: [
        { name: 'today', description: 'Today\'s date (short format)', example: '16/01/2025' },
        { name: 'current_date', description: 'Current date (long format)', example: 'Thursday, 16 January 2025' },
        { name: 'current_year', description: 'Current year', example: '2025' },
      ]
    }
  ];
}

/**
 * Validate that all variables in a message have corresponding mappings
 * @param {string} messageContent - The message template to validate
 * @returns {object} Validation result with isValid flag and list of unknown variables
 */
function validateVariables(messageContent) {
  const variables = extractVariables(messageContent);
  const unknownVariables = variables.filter(v => !VARIABLE_MAPPINGS[v]);

  return {
    isValid: unknownVariables.length === 0,
    unknownVariables,
    totalVariables: variables.length,
    knownVariables: variables.filter(v => VARIABLE_MAPPINGS[v])
  };
}

module.exports = {
  extractVariables,
  replaceVariables,
  getVariableValue,
  getAvailableVariables,
  validateVariables,
  VARIABLE_MAPPINGS
};
