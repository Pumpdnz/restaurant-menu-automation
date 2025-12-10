const db = require('./database-service');
const { getCountryConfig, getAdminHostname, buildLoginUrl, buildRegistrationUrl, getTimezonesForCountry, getTimezoneDisplayName } = require('../../../scripts/lib/country-config.cjs');

/**
 * Organization Settings Service
 * Manages organization-specific configuration settings including API credentials,
 * CloudWaitress admin URLs, and country-specific configurations.
 */
class OrganizationSettingsService {

  /**
   * Default CloudWaitress admin URL
   */
  static DEFAULT_ADMIN_URL = 'https://admin.pumpd.co.nz';

  /**
   * Default country code
   */
  static DEFAULT_COUNTRY = 'NZ';

  /**
   * Get CloudWaitress API configuration for an organization
   * Falls back to environment variables if not configured
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{integratorId: string, secret: string, apiUrl: string}>}
   */
  static async getCloudWaitressConfig(organisationId) {
    try {
      if (!organisationId) {
        console.log('[OrgSettings] No organisation ID provided, using defaults');
        return this.getDefaultCloudWaitressConfig();
      }

      const { data, error } = await db.supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (error) {
        console.error('[OrgSettings] Error fetching organization settings:', error);
        return this.getDefaultCloudWaitressConfig();
      }

      const cwSettings = data?.settings?.cloudwaitress;

      // Check if org has configured credentials
      if (cwSettings?.integrator_id && cwSettings?.secret) {
        console.log('[OrgSettings] Using organization-specific CloudWaitress credentials for:', organisationId);
        return {
          integratorId: cwSettings.integrator_id,
          secret: cwSettings.secret,
          apiUrl: cwSettings.api_url || process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com'
        };
      }

      // Fall back to environment variables
      console.log('[OrgSettings] Organization has no custom credentials, using defaults for:', organisationId);
      return this.getDefaultCloudWaitressConfig();
    } catch (err) {
      console.error('[OrgSettings] Failed to get CloudWaitress config:', err);
      return this.getDefaultCloudWaitressConfig();
    }
  }

  /**
   * Get default CloudWaitress configuration from environment variables
   * @returns {{integratorId: string, secret: string, apiUrl: string}}
   */
  static getDefaultCloudWaitressConfig() {
    return {
      integratorId: process.env.CLOUDWAITRESS_INTEGRATOR_ID,
      secret: process.env.CLOUDWAITRESS_SECRET,
      apiUrl: process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com'
    };
  }

  /**
   * Update CloudWaitress configuration for an organization
   * @param {string} organisationId - The organization UUID
   * @param {object} config - The CloudWaitress configuration
   * @param {string} [config.integratorId] - Integrator ID (CWI_xxx)
   * @param {string} [config.secret] - Secret (CWS_xxx)
   * @param {string} [config.apiUrl] - API URL
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async updateCloudWaitressConfig(organisationId, config) {
    try {
      if (!organisationId) {
        return { success: false, error: 'Organisation ID is required' };
      }

      // First get existing settings
      const { data: existing, error: fetchError } = await db.supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (fetchError) {
        console.error('[OrgSettings] Error fetching existing settings:', fetchError);
        throw fetchError;
      }

      // Get existing cloudwaitress settings
      const existingCw = existing?.settings?.cloudwaitress || {};

      // Merge with existing settings - preserve existing values if new ones aren't provided
      const updatedSettings = {
        ...(existing?.settings || {}),
        cloudwaitress: {
          // Preserve existing values, only update if new value is explicitly provided
          integrator_id: config.integratorId !== undefined ? config.integratorId : existingCw.integrator_id,
          secret: config.secret !== undefined && config.secret !== '' ? config.secret : existingCw.secret,
          api_url: config.apiUrl !== undefined ? config.apiUrl : (existingCw.api_url || 'https://api.cloudwaitress.com'),
          admin_url: config.adminUrl !== undefined ? config.adminUrl : (existingCw.admin_url || this.DEFAULT_ADMIN_URL),
          country: config.country !== undefined ? config.country : (existingCw.country || this.DEFAULT_COUNTRY),
          timezone: config.timezone !== undefined ? config.timezone : (existingCw.timezone || null),
          updated_at: new Date().toISOString()
        }
      };

      // Only remove cloudwaitress key if explicitly clearing all credentials
      // (not just because values weren't provided in this update)
      if (config.integratorId === null && config.secret === null) {
        delete updatedSettings.cloudwaitress;
      }

      // Update the organization
      const { error: updateError } = await db.supabase
        .from('organisations')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisationId);

      if (updateError) {
        console.error('[OrgSettings] Error updating settings:', updateError);
        throw updateError;
      }

      console.log('[OrgSettings] CloudWaitress config updated for org:', organisationId);
      return { success: true };
    } catch (err) {
      console.error('[OrgSettings] Failed to update CloudWaitress config:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get CloudWaitress configuration for display (with masked secret)
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{integratorId: string, secretMasked: string, apiUrl: string, isConfigured: boolean, updatedAt: string|null}>}
   */
  static async getCloudWaitressConfigMasked(organisationId) {
    try {
      if (!organisationId) {
        return {
          integratorId: '',
          secret: '',
          apiUrl: 'https://api.cloudwaitress.com',
          adminUrl: this.DEFAULT_ADMIN_URL,
          country: this.DEFAULT_COUNTRY,
          isConfigured: false,
          updatedAt: null
        };
      }

      const { data, error } = await db.supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (error) {
        console.error('[OrgSettings] Error fetching organization for masked config:', error);
        throw error;
      }

      const cwSettings = data?.settings?.cloudwaitress;
      const isConfigured = !!(cwSettings?.integrator_id && cwSettings?.secret);

      return {
        integratorId: cwSettings?.integrator_id || '',
        secret: cwSettings?.secret || '',
        apiUrl: cwSettings?.api_url || 'https://api.cloudwaitress.com',
        adminUrl: cwSettings?.admin_url || this.DEFAULT_ADMIN_URL,
        country: cwSettings?.country || this.DEFAULT_COUNTRY,
        timezone: cwSettings?.timezone || null,
        isConfigured,
        updatedAt: cwSettings?.updated_at || null
      };
    } catch (err) {
      console.error('[OrgSettings] Failed to get CloudWaitress config:', err);
      return {
        integratorId: '',
        secret: '',
        apiUrl: 'https://api.cloudwaitress.com',
        adminUrl: this.DEFAULT_ADMIN_URL,
        country: this.DEFAULT_COUNTRY,
        timezone: null,
        isConfigured: false,
        updatedAt: null
      };
    }
  }

  /**
   * Clear CloudWaitress configuration for an organization (revert to defaults)
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async clearCloudWaitressConfig(organisationId) {
    return this.updateCloudWaitressConfig(organisationId, {
      integratorId: null,
      secret: null,
      apiUrl: null
    });
  }

  // ============================================================
  // Admin URL and Country Settings Methods
  // ============================================================

  /**
   * Get the full organization settings including admin URL and country
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{settings: object|null, error: string|null}>}
   */
  static async getOrganizationSettings(organisationId) {
    try {
      if (!organisationId) {
        return { settings: null, error: 'Organisation ID is required' };
      }

      const { data, error } = await db.supabase
        .from('organisations')
        .select('settings')
        .eq('id', organisationId)
        .single();

      if (error) {
        console.error('[OrgSettings] Error fetching organization settings:', error);
        return { settings: null, error: error.message };
      }

      return { settings: data?.settings || {}, error: null };
    } catch (err) {
      console.error('[OrgSettings] Failed to get organization settings:', err);
      return { settings: null, error: err.message };
    }
  }

  /**
   * Get CloudWaitress admin URL for an organization
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<string>} Admin URL (defaults to https://admin.pumpd.co.nz)
   */
  static async getAdminUrl(organisationId) {
    try {
      const { settings } = await this.getOrganizationSettings(organisationId);
      return settings?.cloudwaitress?.admin_url || this.DEFAULT_ADMIN_URL;
    } catch (err) {
      console.error('[OrgSettings] Failed to get admin URL:', err);
      return this.DEFAULT_ADMIN_URL;
    }
  }

  /**
   * Get CloudWaitress country for an organization
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<string>} Country code (defaults to 'NZ')
   */
  static async getCloudWaitressCountry(organisationId) {
    try {
      const { settings } = await this.getOrganizationSettings(organisationId);
      return settings?.cloudwaitress?.country || this.DEFAULT_COUNTRY;
    } catch (err) {
      console.error('[OrgSettings] Failed to get CloudWaitress country:', err);
      return this.DEFAULT_COUNTRY;
    }
  }

  /**
   * Get organization-level country setting (for system-wide features like search)
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<string>} Country code (defaults to 'NZ')
   */
  static async getOrganizationCountry(organisationId) {
    try {
      const { settings } = await this.getOrganizationSettings(organisationId);
      return settings?.country || this.DEFAULT_COUNTRY;
    } catch (err) {
      console.error('[OrgSettings] Failed to get organization country:', err);
      return this.DEFAULT_COUNTRY;
    }
  }

  /**
   * Get full script configuration for an organization
   * Returns all settings needed to run automation scripts
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<{
   *   adminUrl: string,
   *   loginUrl: string,
   *   registrationUrl: string,
   *   adminHostname: string,
   *   country: string,
   *   countryConfig: object,
   *   cloudwaitress: {integratorId: string, secret: string, apiUrl: string}
   * }>}
   */
  static async getScriptConfig(organisationId) {
    try {
      const { settings } = await this.getOrganizationSettings(organisationId);
      const cwSettings = settings?.cloudwaitress || {};

      // Get admin URL and country
      const adminUrl = cwSettings.admin_url || this.DEFAULT_ADMIN_URL;
      const country = cwSettings.country || settings?.country || this.DEFAULT_COUNTRY;

      // Get country-specific configuration
      const countryConfig = getCountryConfig(country);

      // Get timezone - use configured timezone or fall back to country default
      const timezone = cwSettings.timezone || null;
      const timezoneDisplay = getTimezoneDisplayName(timezone, country);

      // Get CloudWaitress API credentials
      const cloudwaitress = await this.getCloudWaitressConfig(organisationId);

      return {
        adminUrl,
        loginUrl: buildLoginUrl(adminUrl),
        registrationUrl: buildRegistrationUrl(adminUrl),
        adminHostname: getAdminHostname(adminUrl),
        country,
        timezone,
        timezoneDisplay,
        countryConfig,
        cloudwaitress
      };
    } catch (err) {
      console.error('[OrgSettings] Failed to get script config:', err);

      // Return defaults on error
      const defaultCountryConfig = getCountryConfig(this.DEFAULT_COUNTRY);
      return {
        adminUrl: this.DEFAULT_ADMIN_URL,
        loginUrl: buildLoginUrl(this.DEFAULT_ADMIN_URL),
        registrationUrl: buildRegistrationUrl(this.DEFAULT_ADMIN_URL),
        adminHostname: getAdminHostname(this.DEFAULT_ADMIN_URL),
        country: this.DEFAULT_COUNTRY,
        timezone: null,
        timezoneDisplay: defaultCountryConfig.timezoneDisplay,
        countryConfig: defaultCountryConfig,
        cloudwaitress: this.getDefaultCloudWaitressConfig()
      };
    }
  }

  /**
   * Get search country string for Firecrawl queries
   * Uses the organization-level country setting
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<string>} Country name for search (e.g., 'New Zealand', 'Australia')
   */
  static async getSearchCountry(organisationId) {
    try {
      const country = await this.getOrganizationCountry(organisationId);
      const countryConfig = getCountryConfig(country);
      return countryConfig.searchCountry;
    } catch (err) {
      console.error('[OrgSettings] Failed to get search country:', err);
      return 'New Zealand';
    }
  }

  /**
   * Update admin URL for an organization's CloudWaitress settings
   * @param {string} organisationId - The organization UUID
   * @param {string} adminUrl - The new admin URL
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async updateAdminUrl(organisationId, adminUrl) {
    try {
      if (!organisationId) {
        return { success: false, error: 'Organisation ID is required' };
      }

      // Validate URL format
      try {
        new URL(adminUrl);
      } catch {
        return { success: false, error: 'Invalid URL format' };
      }

      // Ensure HTTPS
      if (!adminUrl.startsWith('https://')) {
        return { success: false, error: 'Admin URL must use HTTPS' };
      }

      const { settings, error: fetchError } = await this.getOrganizationSettings(organisationId);
      if (fetchError) {
        return { success: false, error: fetchError };
      }

      const updatedSettings = {
        ...settings,
        cloudwaitress: {
          ...(settings.cloudwaitress || {}),
          admin_url: adminUrl.replace(/\/$/, ''), // Remove trailing slash
          updated_at: new Date().toISOString()
        }
      };

      const { error: updateError } = await db.supabase
        .from('organisations')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisationId);

      if (updateError) {
        console.error('[OrgSettings] Error updating admin URL:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('[OrgSettings] Admin URL updated for org:', organisationId);
      return { success: true };
    } catch (err) {
      console.error('[OrgSettings] Failed to update admin URL:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update country settings for an organization
   * @param {string} organisationId - The organization UUID
   * @param {string} country - Country code (e.g., 'NZ', 'AU')
   * @param {boolean} [updateCloudwaitress=true] - Also update cloudwaitress.country
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async updateCountry(organisationId, country, updateCloudwaitress = true) {
    try {
      if (!organisationId) {
        return { success: false, error: 'Organisation ID is required' };
      }

      // Validate country code
      const countryConfig = getCountryConfig(country);
      if (!countryConfig || countryConfig.code !== country.toUpperCase()) {
        return { success: false, error: `Unsupported country code: ${country}` };
      }

      const normalizedCountry = country.toUpperCase();
      const { settings, error: fetchError } = await this.getOrganizationSettings(organisationId);
      if (fetchError) {
        return { success: false, error: fetchError };
      }

      const updatedSettings = {
        ...settings,
        country: normalizedCountry
      };

      // Optionally also update cloudwaitress country
      if (updateCloudwaitress && settings.cloudwaitress) {
        updatedSettings.cloudwaitress = {
          ...settings.cloudwaitress,
          country: normalizedCountry,
          updated_at: new Date().toISOString()
        };
      }

      const { error: updateError } = await db.supabase
        .from('organisations')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisationId);

      if (updateError) {
        console.error('[OrgSettings] Error updating country:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('[OrgSettings] Country updated for org:', organisationId, '-> ', normalizedCountry);
      return { success: true };
    } catch (err) {
      console.error('[OrgSettings] Failed to update country:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get full settings for display in admin UI (with masked secrets)
   * @param {string} organisationId - The organization UUID
   * @returns {Promise<object>} Full settings object for display
   */
  static async getSettingsForDisplay(organisationId) {
    try {
      const { settings } = await this.getOrganizationSettings(organisationId);
      const cwSettings = settings?.cloudwaitress || {};

      // Mask the secret
      let secretMasked = '';
      if (cwSettings.secret) {
        const lastChars = cwSettings.secret.slice(-8);
        secretMasked = '••••••••' + lastChars;
      }

      return {
        country: settings?.country || this.DEFAULT_COUNTRY,
        cloudwaitress: {
          integratorId: cwSettings.integrator_id || '',
          secretMasked,
          apiUrl: cwSettings.api_url || 'https://api.cloudwaitress.com',
          adminUrl: cwSettings.admin_url || this.DEFAULT_ADMIN_URL,
          country: cwSettings.country || this.DEFAULT_COUNTRY,
          timezone: cwSettings.timezone || null,
          isConfigured: !!(cwSettings.integrator_id && cwSettings.secret),
          updatedAt: cwSettings.updated_at || null
        }
      };
    } catch (err) {
      console.error('[OrgSettings] Failed to get settings for display:', err);
      return {
        country: this.DEFAULT_COUNTRY,
        cloudwaitress: {
          integratorId: '',
          secretMasked: '',
          apiUrl: 'https://api.cloudwaitress.com',
          adminUrl: this.DEFAULT_ADMIN_URL,
          country: this.DEFAULT_COUNTRY,
          timezone: null,
          isConfigured: false,
          updatedAt: null
        }
      };
    }
  }
}

module.exports = { OrganizationSettingsService };
