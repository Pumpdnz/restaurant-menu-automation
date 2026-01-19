const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { executeWithRetry, isTransientError } = require('../src/services/database-error-handler');

// Create Supabase client with service role key for backend
const supabaseUrl = process.env.SUPABASE_URL || 'https://qgabsyggzlkcstjzugdh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use anon key as fallback for development
const supabaseKey = supabaseServiceKey || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWJzeWdnemxrY3N0anp1Z2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTI2OTQsImV4cCI6MjA3MTMyODY5NH0.4kSwUAw2hXVPddBSf9l7BstV9FQ_BwVQWfhvRXnUHC0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Internal service key for service-to-service calls (never expires)
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Simple authentication middleware
 * Verifies JWT token and loads user profile with organization
 * Also supports internal service-to-service calls via X-Service-Key header
 */
async function authMiddleware(req, res, next) {
  try {
    // Check for internal service-to-service call first
    const serviceKey = req.headers['x-service-key'];
    const orgIdHeader = req.headers['x-organisation-id'];

    if (serviceKey && serviceKey === INTERNAL_SERVICE_KEY && orgIdHeader) {
      // Internal service call - bypass JWT validation
      console.log('[Auth] Internal service call authenticated for org:', orgIdHeader);
      req.user = {
        id: 'internal-service',
        email: 'service@internal',
        role: 'super_admin', // Service calls have full access
        organisationId: orgIdHeader,
        organisation: { id: orgIdHeader },
        isServiceCall: true
      };
      req.orgFilter = () => ({ organisation_id: orgIdHeader });
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization header with Bearer token is required'
      });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase (with retry for transient network errors)
    let user;
    try {
      const authResult = await executeWithRetry(
        () => supabase.auth.getUser(token),
        'JWT verification'
      );
      // executeWithRetry returns data directly, but getUser returns { user } inside data
      user = authResult?.user;
    } catch (authError) {
      // Check if this was a transient error that exhausted retries
      if (isTransientError(authError)) {
        console.error('[Auth] Service temporarily unavailable after retries:', authError.message);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Authentication service is temporarily unavailable. Please try again.',
          retryable: true
        });
      }
      // Non-transient auth error (invalid/expired token)
      console.error('Token verification failed:', authError);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    // Get user profile with organization (with retry for transient errors)
    let profile;
    try {
      profile = await executeWithRetry(
        () => supabase
          .from('profiles')
          .select(`
            *,
            organisation:organisations(*)
          `)
          .eq('id', user.id)
          .single(),
        `Profile fetch for user ${user.id}`
      );
    } catch (profileError) {
      if (isTransientError(profileError)) {
        console.error('[Auth] Service temporarily unavailable during profile fetch:', profileError.message);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Unable to fetch user profile. Please try again.',
          retryable: true
        });
      }
      console.error('Profile fetch failed:', profileError);
      return res.status(403).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    if (!profile) {
      return res.status(403).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      organisationId: profile.organisation_id,
      organisation: profile.organisation
    };

    // Add helper function to filter by organization
    req.orgFilter = () => ({ organisation_id: req.user.organisationId });

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Final catch - check if transient
    if (isTransientError(error)) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'An error occurred during authentication. Please try again.',
        retryable: true
      });
    }
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Simple role-based access control middleware
 * @param {string} requiredRole - The role required to access the endpoint ('super_admin', 'admin', or 'user')
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'Authentication required' 
      });
    }

    const userRole = req.user.role;
    
    // Super admins can access everything
    if (userRole === 'super_admin') {
      return next();
    }

    // Admins can access admin and user endpoints
    if (userRole === 'admin' && (requiredRole === 'admin' || requiredRole === 'user')) {
      return next();
    }

    // Users can only access user endpoints
    if (userRole === 'user' && requiredRole === 'user') {
      return next();
    }

    // Otherwise, insufficient permissions
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      message: `This action requires ${requiredRole} role` 
    });
  };
}

/**
 * Check if user is super admin
 */
function requireSuperAdmin() {
  return requireRole('super_admin');
}

/**
 * Check if user can manage organization
 */
function requireOrgAdmin() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'Authentication required' 
      });
    }

    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }

    return res.status(403).json({ 
      error: 'Insufficient permissions',
      message: 'Organization admin access required' 
    });
  };
}

/**
 * Helper to add organization filter to Supabase queries
 * @param {Object} query - The Supabase query builder
 * @param {string} organisationId - The organization ID to filter by
 */
function addOrgFilter(query, organisationId) {
  return query.eq('organisation_id', organisationId);
}

/**
 * Get Supabase client for backend use
 * This uses service role key when available for admin operations
 */
function getSupabaseClient() {
  return supabase;
}

module.exports = {
  authMiddleware,
  requireRole,
  requireSuperAdmin,
  requireOrgAdmin,
  addOrgFilter,
  getSupabaseClient,
  supabase
};