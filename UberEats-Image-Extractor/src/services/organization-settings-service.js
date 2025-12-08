const db = require('./database-service');

/**
 * Organization Settings Service
 * Manages organization-specific configuration settings including API credentials
 */
class OrganizationSettingsService {

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

      // Merge with existing settings
      const updatedSettings = {
        ...(existing?.settings || {}),
        cloudwaitress: {
          integrator_id: config.integratorId || null,
          secret: config.secret || null,
          api_url: config.apiUrl || 'https://api.cloudwaitress.com',
          updated_at: new Date().toISOString()
        }
      };

      // If all values are null/empty, remove the cloudwaitress key entirely
      if (!config.integratorId && !config.secret) {
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
          secretMasked: '',
          apiUrl: 'https://api.cloudwaitress.com',
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

      // Mask the secret - show only last 8 characters
      let secretMasked = '';
      if (cwSettings?.secret) {
        const lastChars = cwSettings.secret.slice(-8);
        secretMasked = '••••••••' + lastChars;
      }

      return {
        integratorId: cwSettings?.integrator_id || '',
        secretMasked,
        apiUrl: cwSettings?.api_url || 'https://api.cloudwaitress.com',
        isConfigured,
        updatedAt: cwSettings?.updated_at || null
      };
    } catch (err) {
      console.error('[OrgSettings] Failed to get masked CloudWaitress config:', err);
      return {
        integratorId: '',
        secretMasked: '',
        apiUrl: 'https://api.cloudwaitress.com',
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
}

module.exports = { OrganizationSettingsService };
