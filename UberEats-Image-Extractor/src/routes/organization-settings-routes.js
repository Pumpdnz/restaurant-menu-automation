const express = require('express');
const router = express.Router();
const { OrganizationSettingsService } = require('../services/organization-settings-service');

/**
 * Organization Settings Routes
 * Manages organization-specific settings including API credentials
 */

/**
 * GET /api/organization/settings/cloudwaitress
 * Get CloudWaitress configuration (masked for security)
 * Requires: admin role
 */
router.get('/cloudwaitress', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  // Only admins can view API credentials
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const config = await OrganizationSettingsService.getCloudWaitressConfigMasked(organisationId);

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('[Settings] Error fetching CloudWaitress config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/organization/settings/cloudwaitress
 * Update CloudWaitress configuration
 * Requires: admin role
 */
router.put('/cloudwaitress', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;
  const { integratorId, secret, apiUrl, adminUrl, country, timezone } = req.body;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  // Only admins can update API credentials
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  // Validate input format
  if (integratorId && !integratorId.startsWith('CWI_')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Integrator ID format. Must start with CWI_'
    });
  }

  if (secret && !secret.startsWith('CWS_')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Secret format. Must start with CWS_'
    });
  }

  try {
    const result = await OrganizationSettingsService.updateCloudWaitressConfig(organisationId, {
      integratorId,
      secret,
      apiUrl,
      adminUrl,
      country,
      timezone
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Log the update
    const { supabase } = require('../services/database-service');
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        action: 'cloudwaitress_config_update',
        status: 'success',
        request_data: {
          integrator_id_updated: !!integratorId,
          secret_updated: !!secret,
          api_url_updated: !!apiUrl
        },
        initiated_by: req.user?.email || 'system'
      });

    res.json({
      success: true,
      message: 'CloudWaitress configuration updated successfully'
    });
  } catch (error) {
    console.error('[Settings] Error updating CloudWaitress config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/organization/settings/cloudwaitress
 * Remove CloudWaitress configuration (revert to system defaults)
 * Requires: admin role
 */
router.delete('/cloudwaitress', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const result = await OrganizationSettingsService.clearCloudWaitressConfig(organisationId);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Log the removal
    const { supabase } = require('../services/database-service');
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        action: 'cloudwaitress_config_cleared',
        status: 'success',
        initiated_by: req.user?.email || 'system'
      });

    res.json({
      success: true,
      message: 'CloudWaitress configuration removed. Using system defaults.'
    });
  } catch (error) {
    console.error('[Settings] Error removing CloudWaitress config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Admin URL and Country Settings Endpoints
// ============================================================

/**
 * GET /api/organization/settings
 * Get full organization settings for display
 * Requires: admin role
 */
router.get('/', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const settings = await OrganizationSettingsService.getSettingsForDisplay(organisationId);

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('[Settings] Error fetching organization settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/organization/settings/script-config
 * Get script configuration (admin URL, country, credentials)
 * Used by automation scripts to get all settings needed for execution
 * Requires: admin role
 */
router.get('/script-config', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const config = await OrganizationSettingsService.getScriptConfig(organisationId);

    // Mask the secret for API response
    const maskedConfig = {
      ...config,
      cloudwaitress: {
        ...config.cloudwaitress,
        secret: config.cloudwaitress.secret ? '••••••••' + config.cloudwaitress.secret.slice(-8) : ''
      }
    };

    res.json({
      success: true,
      config: maskedConfig
    });
  } catch (error) {
    console.error('[Settings] Error fetching script config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/organization/settings/admin-url
 * Update CloudWaitress admin portal URL
 * Requires: admin role
 */
router.put('/admin-url', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;
  const { adminUrl } = req.body;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  if (!adminUrl) {
    return res.status(400).json({
      success: false,
      error: 'Admin URL is required'
    });
  }

  try {
    const result = await OrganizationSettingsService.updateAdminUrl(organisationId, adminUrl);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Log the update
    const { supabase } = require('../services/database-service');
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        action: 'admin_url_update',
        status: 'success',
        request_data: { admin_url: adminUrl },
        initiated_by: req.user?.email || 'system'
      });

    res.json({
      success: true,
      message: 'Admin URL updated successfully'
    });
  } catch (error) {
    console.error('[Settings] Error updating admin URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/organization/settings/country
 * Update organization country settings
 * Requires: admin role
 */
router.put('/country', async (req, res) => {
  const organisationId = req.user?.organisationId;
  const userRole = req.user?.role;
  const { country, updateCloudwaitress = true } = req.body;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  if (!country) {
    return res.status(400).json({
      success: false,
      error: 'Country code is required'
    });
  }

  // Validate country code format
  if (!/^[A-Z]{2}$/i.test(country)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid country code format. Use ISO 3166-1 alpha-2 (e.g., NZ, AU, US)'
    });
  }

  try {
    const result = await OrganizationSettingsService.updateCountry(
      organisationId,
      country,
      updateCloudwaitress
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Log the update
    const { supabase } = require('../services/database-service');
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        action: 'country_update',
        status: 'success',
        request_data: { country: country.toUpperCase(), updateCloudwaitress },
        initiated_by: req.user?.email || 'system'
      });

    res.json({
      success: true,
      message: 'Country settings updated successfully'
    });
  } catch (error) {
    console.error('[Settings] Error updating country:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/organization/settings/country
 * Get the organization's system-wide country code
 */
router.get('/country', async (req, res) => {
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const country = await OrganizationSettingsService.getOrganizationCountry(organisationId);

    res.json({
      success: true,
      country
    });
  } catch (error) {
    console.error('[Settings] Error fetching organization country:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/organization/settings/search-country
 * Get the search country string for Firecrawl queries
 * Returns the country name (e.g., "New Zealand", "Australia")
 */
router.get('/search-country', async (req, res) => {
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const searchCountry = await OrganizationSettingsService.getSearchCountry(organisationId);

    res.json({
      success: true,
      searchCountry
    });
  } catch (error) {
    console.error('[Settings] Error fetching search country:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/organization/settings/timezones
 * Get available timezones for the organization's country
 * Used to populate timezone dropdown in settings
 */
router.get('/timezones', async (req, res) => {
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    // Get the organization's country (from CloudWaitress settings or system-wide)
    const country = await OrganizationSettingsService.getCloudWaitressCountry(organisationId);
    const { getTimezonesForCountry } = require('../../../scripts/lib/country-config.cjs');
    const timezones = getTimezonesForCountry(country);

    res.json({
      success: true,
      country,
      timezones
    });
  } catch (error) {
    console.error('[Settings] Error fetching timezones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/organization/settings/timezones/:countryCode
 * Get available timezones for a specific country
 * Used when user changes country selection before saving
 */
router.get('/timezones/:countryCode', async (req, res) => {
  const { countryCode } = req.params;

  if (!countryCode || !/^[A-Z]{2}$/i.test(countryCode)) {
    return res.status(400).json({
      success: false,
      error: 'Valid country code required (e.g., NZ, AU, US)'
    });
  }

  try {
    const { getTimezonesForCountry, isCountrySupported } = require('../../../scripts/lib/country-config.cjs');

    if (!isCountrySupported(countryCode)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported country code: ${countryCode}`
      });
    }

    const timezones = getTimezonesForCountry(countryCode.toUpperCase());

    res.json({
      success: true,
      country: countryCode.toUpperCase(),
      timezones
    });
  } catch (error) {
    console.error('[Settings] Error fetching timezones for country:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
