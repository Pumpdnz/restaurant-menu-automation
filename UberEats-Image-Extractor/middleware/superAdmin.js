const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware to verify super admin access
 * Checks if the authenticated user has super_admin role
 */
const superAdminMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No authorization token provided',
        code: 'NO_AUTH_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if user is super admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role, organisation_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({ 
        error: 'Failed to fetch user profile',
        code: 'PROFILE_FETCH_ERROR'
      });
    }

    if (!profile || profile.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Super admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'super_admin',
        currentRole: profile?.role || 'none'
      });
    }

    // Attach user info to request for use in route handlers
    req.user = {
      id: user.id,
      email: user.email,
      name: profile.name,
      role: profile.role,
      organisationId: profile.organisation_id
    };

    // Attach Supabase client for use in routes
    req.supabase = supabase;

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper middleware to check if user is super admin without blocking
 * Useful for routes that have different behavior for super admins
 */
const checkSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.isSuperAdmin = false;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      req.isSuperAdmin = false;
      return next();
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    req.isSuperAdmin = profile?.role === 'super_admin';
    if (req.isSuperAdmin) {
      req.user = {
        id: user.id,
        email: user.email,
        role: profile.role
      };
    }

    next();
  } catch (error) {
    req.isSuperAdmin = false;
    next();
  }
};

module.exports = {
  superAdminMiddleware,
  checkSuperAdmin
};