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
 * Formatting helper functions for variable values
 */

/**
 * Format number with commas and optional suffix
 * @param {number} value - Number to format
 * @param {string} suffix - Optional suffix (e.g., "orders")
 * @returns {string} Formatted number
 */
function formatNumber(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  const formatted = num.toLocaleString('en-NZ');
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/**
 * Format value as currency (NZD)
 * @param {number} value - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  return `$${num.toFixed(2)}`;
}

/**
 * Format value as percentage
 * @param {number} value - Percentage value to format
 * @returns {string} Formatted percentage
 */
function formatPercentage(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  return `${num.toFixed(1)}%`;
}

/**
 * Format boolean as Yes/No/Unknown
 * @param {boolean|null|undefined} value - Boolean value
 * @returns {string} "Yes", "No", or "Unknown"
 */
function formatBoolean(value) {
  if (value === null || value === undefined) return 'Unknown';
  return value ? 'Yes' : 'No';
}

/**
 * Format JSONB array as comma-separated list
 * @param {Array} value - Array of TagItem objects or strings
 * @returns {string} Comma-separated list
 */
function formatArray(value) {
  if (!value || !Array.isArray(value) || value.length === 0) return '';

  // Handle array of TagItem objects with 'value' property
  if (typeof value[0] === 'object' && value[0].value) {
    return value.map(item => item.value).join(', ');
  }

  // Handle array of strings
  return value.join(', ');
}

/**
 * Format date relative to today in natural language
 * @param {string|Date|null} date - Date to format
 * @returns {string} Relative date description
 */
function formatRelativeDate(date) {
  if (!date) return 'Never';

  const contactDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const contactDateStart = new Date(contactDate);
  contactDateStart.setHours(0, 0, 0, 0);

  const diffTime = today - contactDateStart;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) {
    // This week - return day name with "on"
    const dayName = contactDate.toLocaleDateString('en-NZ', { weekday: 'long' });
    return `on ${dayName}`;
  }
  if (diffDays < 14) {
    // Last week - return "last" + day name
    const dayName = contactDate.toLocaleDateString('en-NZ', { weekday: 'long' });
    return `last ${dayName}`;
  }
  if (diffDays < 30) {
    // Within a month
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? 'two weeks ago' : `${weeks + 1} weeks ago`;
  }
  if (contactDate.getFullYear() === today.getFullYear()) {
    // Earlier this year - return month name with "in"
    const monthName = contactDate.toLocaleDateString('en-NZ', { month: 'long' });
    return `in ${monthName}`;
  }

  // Last year or earlier
  return 'last year';
}

/**
 * Format website type enum to readable string
 * @param {string} value - website_type value
 * @returns {string} Formatted website type
 */
function formatWebsiteType(value) {
  if (!value) return '';
  const types = {
    'custom_domain': 'Custom Domain',
    'platform_subdomain': 'Platform Subdomain',
    'no_website': 'No Website'
  };
  return types[value] || value;
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
  },
  last_contacted_day: (restaurant) => {
    return formatRelativeDate(restaurant.last_contacted);
  },

  // Qualification Data (Demo Meeting Info)
  contact_role: 'contact_role',
  number_of_venues: 'number_of_venues',
  point_of_sale: 'point_of_sale',
  online_ordering_platform: 'online_ordering_platform',
  online_ordering_handles_delivery: (restaurant) => {
    return formatBoolean(restaurant.online_ordering_handles_delivery);
  },
  self_delivery: (restaurant) => {
    return formatBoolean(restaurant.self_delivery);
  },
  weekly_uber_sales_volume: (restaurant) => {
    return formatNumber(restaurant.weekly_uber_sales_volume, 'orders');
  },
  uber_aov: (restaurant) => {
    return formatCurrency(restaurant.uber_aov);
  },
  uber_markup: (restaurant) => {
    return formatPercentage(restaurant.uber_markup);
  },
  uber_profitability: (restaurant) => {
    return formatPercentage(restaurant.uber_profitability);
  },
  uber_profitability_description: 'uber_profitability_description',
  current_marketing_description: 'current_marketing_description',
  qualification_details: 'details',
  painpoints: (restaurant) => {
    return formatArray(restaurant.painpoints);
  },
  core_selling_points: (restaurant) => {
    return formatArray(restaurant.core_selling_points);
  },
  features_to_highlight: (restaurant) => {
    return formatArray(restaurant.features_to_highlight);
  },
  possible_objections: (restaurant) => {
    return formatArray(restaurant.possible_objections);
  },
  meeting_link: 'meeting_link',
  website_type: (restaurant) => {
    return formatWebsiteType(restaurant.website_type);
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
        { name: 'last_contacted_day', description: 'Last contact date (natural)', example: 'yesterday' },
      ]
    },
    // Qualification Data
    {
      category: 'Qualification Data',
      variables: [
        { name: 'contact_role', description: 'Contact person\'s role', example: 'Owner' },
        { name: 'number_of_venues', description: 'Number of venues', example: '3' },
        { name: 'point_of_sale', description: 'POS system used', example: 'Lightspeed' },
        { name: 'online_ordering_platform', description: 'Online ordering platform', example: 'ChowNow' },
        { name: 'online_ordering_handles_delivery', description: 'Online ordering handles delivery', example: 'Yes' },
        { name: 'self_delivery', description: 'Self-delivery capability', example: 'No' },
        { name: 'weekly_uber_sales_volume', description: 'Weekly UberEats order volume', example: '250 orders' },
        { name: 'uber_aov', description: 'Average order value on UberEats', example: '$32.50' },
        { name: 'uber_markup', description: 'UberEats menu markup percentage', example: '25.0%' },
        { name: 'uber_profitability', description: 'UberEats profitability percentage', example: '15.5%' },
        { name: 'uber_profitability_description', description: 'UberEats profitability notes', example: 'Profitable after commission' },
        { name: 'current_marketing_description', description: 'Current marketing activities', example: 'Social media, email campaigns' },
        { name: 'qualification_details', description: 'Additional qualification notes', example: 'Very interested in switching' },
        { name: 'painpoints', description: 'Customer pain points (comma-separated)', example: 'High commission, Slow support' },
        { name: 'core_selling_points', description: 'Core selling points (comma-separated)', example: 'Lower fees, Better margins' },
        { name: 'features_to_highlight', description: 'Features to highlight (comma-separated)', example: 'Custom domain, Analytics' },
        { name: 'possible_objections', description: 'Possible objections (comma-separated)', example: 'Migration effort, Training time' },
        { name: 'meeting_link', description: 'Meeting/demo link', example: 'https://meet.google.com/abc-defg-hij' },
        { name: 'website_type', description: 'Website type', example: 'Custom Domain' },
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
