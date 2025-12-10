/**
 * Country Configuration
 *
 * Centralized configuration for country-specific settings used across
 * automation scripts. This enables support for CloudWaitress resellers
 * in different countries.
 *
 * Usage:
 *   const { COUNTRY_CONFIG, getCountryConfig } = require('./lib/country-config');
 *   const config = getCountryConfig('NZ');
 *   console.log(config.currency); // 'NZD'
 */

const COUNTRY_CONFIG = {
  NZ: {
    code: 'NZ',
    name: 'New Zealand',
    locale: 'New Zealand',
    timezone: 'Pacific/Auckland',
    timezoneDisplay: 'Auckland',
    timezones: [
      { iana: 'Pacific/Auckland', display: 'Auckland (NZST/NZDT)', city: 'Auckland' },
      { iana: 'Pacific/Chatham', display: 'Chatham Islands', city: 'Chatham' }
    ],
    currency: 'NZD',
    phonePrefix: '+64',
    phoneRegex: /^(\+64|0)[2-9]\d{7,9}$/,
    gstRate: 15,
    gstName: 'GST',
    searchCountry: 'New Zealand',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'delivereasy.co.nz',
      'meandyou.co.nz',
      'mobi2go.com',
      'nextorder.co.nz',
      'foodhub.co.nz',
      'ordermeal.co.nz'
    ]
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    locale: 'Australia',
    timezone: 'Australia/Sydney',
    timezoneDisplay: 'Sydney',
    timezones: [
      { iana: 'Australia/Sydney', display: 'Sydney (AEST/AEDT)', city: 'Sydney' },
      { iana: 'Australia/Melbourne', display: 'Melbourne (AEST/AEDT)', city: 'Melbourne' },
      { iana: 'Australia/Brisbane', display: 'Brisbane (AEST)', city: 'Brisbane' },
      { iana: 'Australia/Perth', display: 'Perth (AWST)', city: 'Perth' },
      { iana: 'Australia/Adelaide', display: 'Adelaide (ACST/ACDT)', city: 'Adelaide' },
      { iana: 'Australia/Darwin', display: 'Darwin (ACST)', city: 'Darwin' },
      { iana: 'Australia/Hobart', display: 'Hobart (AEST/AEDT)', city: 'Hobart' }
    ],
    currency: 'AUD',
    phonePrefix: '+61',
    phoneRegex: /^(\+61|0)[2-9]\d{8}$/,
    gstRate: 10,
    gstName: 'GST',
    searchCountry: 'Australia',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'menulog.com.au',
      'meandyou.com.au',
      'mobi2go.com',
      'nextorder.com.au',
      'foodhub.com.au'
    ]
  },
  US: {
    code: 'US',
    name: 'United States',
    locale: 'United States',
    timezone: 'America/New_York',
    timezoneDisplay: 'New York',
    timezones: [
      { iana: 'America/New_York', display: 'Eastern Time (ET)', city: 'New York' },
      { iana: 'America/Chicago', display: 'Central Time (CT)', city: 'Chicago' },
      { iana: 'America/Denver', display: 'Mountain Time (MT)', city: 'Denver' },
      { iana: 'America/Los_Angeles', display: 'Pacific Time (PT)', city: 'Los Angeles' },
      { iana: 'America/Phoenix', display: 'Arizona (MST)', city: 'Phoenix' },
      { iana: 'America/Anchorage', display: 'Alaska Time (AKT)', city: 'Anchorage' },
      { iana: 'Pacific/Honolulu', display: 'Hawaii Time (HST)', city: 'Honolulu' }
    ],
    currency: 'USD',
    phonePrefix: '+1',
    phoneRegex: /^(\+1)?[2-9]\d{9}$/,
    gstRate: 0, // No national sales tax in US (varies by state)
    gstName: 'Tax',
    searchCountry: 'United States',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'grubhub.com',
      'postmates.com'
    ]
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    locale: 'United Kingdom',
    timezone: 'Europe/London',
    timezoneDisplay: 'London',
    timezones: [
      { iana: 'Europe/London', display: 'London (GMT/BST)', city: 'London' }
    ],
    currency: 'GBP',
    phonePrefix: '+44',
    phoneRegex: /^(\+44|0)[1-9]\d{9,10}$/,
    gstRate: 20,
    gstName: 'VAT',
    searchCountry: 'United Kingdom',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'deliveroo.co.uk',
      'just-eat.co.uk'
    ]
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    locale: 'Canada',
    timezone: 'America/Toronto',
    timezoneDisplay: 'Toronto',
    timezones: [
      { iana: 'America/Toronto', display: 'Eastern Time (ET)', city: 'Toronto' },
      { iana: 'America/Winnipeg', display: 'Central Time (CT)', city: 'Winnipeg' },
      { iana: 'America/Edmonton', display: 'Mountain Time (MT)', city: 'Edmonton' },
      { iana: 'America/Vancouver', display: 'Pacific Time (PT)', city: 'Vancouver' },
      { iana: 'America/Halifax', display: 'Atlantic Time (AT)', city: 'Halifax' },
      { iana: 'America/St_Johns', display: 'Newfoundland (NT)', city: "St. John's" }
    ],
    currency: 'CAD',
    phonePrefix: '+1',
    phoneRegex: /^(\+1)?[2-9]\d{9}$/,
    gstRate: 5, // Federal GST only, provinces have additional
    gstName: 'GST',
    searchCountry: 'Canada',
    deliveryPlatformDomains: [
      'ubereats.com',
      'doordash.com',
      'skipthedishes.com'
    ]
  }
};

/**
 * Get country configuration by country code
 * @param {string} countryCode - ISO country code (e.g., 'NZ', 'AU')
 * @returns {object} Country configuration object
 */
function getCountryConfig(countryCode) {
  const code = (countryCode || 'NZ').toUpperCase();
  return COUNTRY_CONFIG[code] || COUNTRY_CONFIG['NZ'];
}

/**
 * Get list of supported country codes
 * @returns {string[]} Array of supported country codes
 */
function getSupportedCountries() {
  return Object.keys(COUNTRY_CONFIG);
}

/**
 * Check if a country code is supported
 * @param {string} countryCode - ISO country code
 * @returns {boolean} True if country is supported
 */
function isCountrySupported(countryCode) {
  return countryCode && COUNTRY_CONFIG.hasOwnProperty(countryCode.toUpperCase());
}

/**
 * Format phone number with country prefix
 * @param {string} phone - Phone number (may start with 0 or country code)
 * @param {string} countryCode - ISO country code
 * @returns {string} Formatted phone number with country prefix
 */
function formatPhoneNumber(phone, countryCode) {
  if (!phone) return '';

  const config = getCountryConfig(countryCode);
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Already has correct country prefix
  if (cleanPhone.startsWith(config.phonePrefix)) {
    return cleanPhone;
  }

  // Has a + prefix but wrong country - leave as is
  if (cleanPhone.startsWith('+')) {
    return cleanPhone;
  }

  // Starts with 0 - replace with country prefix
  if (cleanPhone.startsWith('0')) {
    return config.phonePrefix + cleanPhone.substring(1);
  }

  // No prefix at all - add country prefix
  return config.phonePrefix + cleanPhone;
}

/**
 * Extract hostname from admin URL for use in waitForURL patterns
 * @param {string} adminUrl - Full admin URL (e.g., 'https://admin.pumpd.co.nz')
 * @returns {string} Hostname (e.g., 'admin.pumpd.co.nz')
 */
function getAdminHostname(adminUrl) {
  try {
    return new URL(adminUrl).hostname;
  } catch (error) {
    // Fallback to default if URL parsing fails
    return 'admin.pumpd.co.nz';
  }
}

/**
 * Build login URL from admin base URL
 * @param {string} adminUrl - Base admin URL
 * @returns {string} Full login URL
 */
function buildLoginUrl(adminUrl) {
  const baseUrl = (adminUrl || 'https://admin.pumpd.co.nz').replace(/\/$/, '');
  return `${baseUrl}/login`;
}

/**
 * Build registration URL from admin base URL
 * @param {string} adminUrl - Base admin URL
 * @returns {string} Full registration URL
 */
function buildRegistrationUrl(adminUrl) {
  const baseUrl = (adminUrl || 'https://admin.pumpd.co.nz').replace(/\/$/, '');
  return `${baseUrl}/register`;
}

/**
 * Get timezones available for a country
 * @param {string} countryCode - ISO country code (e.g., 'NZ', 'AU')
 * @returns {Array<{iana: string, display: string, city: string}>} Array of timezone options
 */
function getTimezonesForCountry(countryCode) {
  const config = getCountryConfig(countryCode);
  return config.timezones || [{
    iana: config.timezone,
    display: config.timezoneDisplay,
    city: config.timezoneDisplay
  }];
}

/**
 * Get timezone display name (city) from a city name or IANA timezone
 * Used to get the search term for CloudWaitress timezone dropdown
 * @param {string} timezone - City name (e.g., 'Perth') or IANA timezone (e.g., 'Australia/Perth')
 * @param {string} countryCode - ISO country code for fallback
 * @returns {string} City name for dropdown search (e.g., 'Perth')
 */
function getTimezoneDisplayName(timezone, countryCode) {
  if (!timezone) {
    const config = getCountryConfig(countryCode);
    return config.timezoneDisplay;
  }

  const config = getCountryConfig(countryCode);

  // Check if it's an IANA timezone and find the city
  if (timezone.includes('/')) {
    const tz = config.timezones?.find(t => t.iana === timezone);
    return tz?.city || config.timezoneDisplay;
  }

  // It's already a city name, verify it exists in the country's timezones
  const tz = config.timezones?.find(t => t.city === timezone);
  return tz?.city || timezone;
}

/**
 * Validate if a timezone is valid for a country
 * @param {string} timezone - City name to validate
 * @param {string} countryCode - ISO country code
 * @returns {boolean} True if timezone is valid for the country
 */
function isValidTimezoneForCountry(timezone, countryCode) {
  if (!timezone) return true; // null/empty is valid (uses default)

  const config = getCountryConfig(countryCode);
  return config.timezones?.some(t => t.city === timezone) || false;
}

// CommonJS exports
module.exports = {
  COUNTRY_CONFIG,
  getCountryConfig,
  getSupportedCountries,
  isCountrySupported,
  formatPhoneNumber,
  getAdminHostname,
  buildLoginUrl,
  buildRegistrationUrl,
  getTimezonesForCountry,
  getTimezoneDisplayName,
  isValidTimezoneForCountry
};
