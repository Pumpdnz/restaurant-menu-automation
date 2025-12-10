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
  const { integratorId, secret, apiUrl } = req.body;

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
      apiUrl
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

module.exports = router;
