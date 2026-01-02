/**
 * Organization Middleware
 * Extracts organization ID from request headers and sets it in the database service
 * Also sets up user-authenticated Supabase client for RLS
 */

const databaseService = require('../src/services/database-service');

function organizationMiddleware(req, res, next) {
  // Get organization ID from header (support both American and British spellings)
  const orgId = req.headers['x-organization-id'] || req.headers['X-Organization-ID'] ||
                req.headers['x-organisation-id'] || req.headers['X-Organisation-ID'];
  
  // Determine if this is a polling/status endpoint that doesn't need verbose logging
  const isStatusEndpoint = req.path.includes('/status/') || 
                          req.path.includes('/extract-status/') ||
                          req.path.includes('/premium-extract-status/');
  
  if (!isStatusEndpoint) {
    console.log(`[Org Middleware] Request to ${req.path}, Org ID from header: ${orgId || 'NONE'}`);
  }
  
  // Extract auth token if present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (!isStatusEndpoint) {
      console.log('[Org Middleware] Auth token found, setting user Supabase client');
    }
    databaseService.setUserSupabaseClient(token);
  } else {
    if (!isStatusEndpoint) {
      console.log('[Org Middleware] No auth token, using default Supabase client');
    }
    databaseService.setUserSupabaseClient(null);
  }
  
  if (orgId) {
    // Set the organization ID for this request
    databaseService.setCurrentOrganizationId(orgId);
    if (!isStatusEndpoint) {
      console.log(`[Org Middleware] Set organization ID: ${orgId}`);
    }
    
    // Also attach to request object for easy access
    req.organizationId = orgId;
  } else {
    // Use default organization if not provided
    if (!isStatusEndpoint) {
      console.log('[Org Middleware] No org ID in header, using default');
    }
    databaseService.setCurrentOrganizationId(null);
  }
  
  next();
}

module.exports = organizationMiddleware;