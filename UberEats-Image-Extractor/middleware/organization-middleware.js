/**
 * Organization Middleware
 * Extracts organization ID from request headers and sets it in the database service
 * Also sets up user-authenticated Supabase client for RLS
 */

const databaseService = require('../src/services/database-service');

function organizationMiddleware(req, res, next) {
  // Get organization ID from header
  const orgId = req.headers['x-organization-id'] || req.headers['X-Organization-ID'];
  
  console.log(`[Org Middleware] Request to ${req.path}, Org ID from header: ${orgId || 'NONE'}`);
  
  // Extract auth token if present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('[Org Middleware] Auth token found, setting user Supabase client');
    databaseService.setUserSupabaseClient(token);
  } else {
    console.log('[Org Middleware] No auth token, using default Supabase client');
    databaseService.setUserSupabaseClient(null);
  }
  
  if (orgId) {
    // Set the organization ID for this request
    databaseService.setCurrentOrganizationId(orgId);
    console.log(`[Org Middleware] Set organization ID: ${orgId}`);
    
    // Also attach to request object for easy access
    req.organizationId = orgId;
  } else {
    // Use default organization if not provided
    console.log('[Org Middleware] No org ID in header, using default');
    databaseService.setCurrentOrganizationId(null);
  }
  
  next();
}

module.exports = organizationMiddleware;