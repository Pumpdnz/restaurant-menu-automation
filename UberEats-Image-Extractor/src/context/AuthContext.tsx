import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContextType, UserProfile, UserRole, FeatureFlags } from '../types/auth';
import { useNavigate } from 'react-router-dom';
import { InvitationService } from '../services/invitation-service';

// Create context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('AuthProvider initializing...');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const navigate = useNavigate();
  
  // Simple function to load user profile with retry logic
  const loadUserProfile = async (supabaseUser: User, retryCount = 0): Promise<void> => {
    try {
      console.log(`Loading profile for user: ${supabaseUser.id} (attempt ${retryCount + 1})`);
      
      console.log('Querying profiles table...');
      
      // Remove timeout - let the query complete naturally
      console.log('Making query to profiles table for ID:', supabaseUser.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      
      console.log('Profile fetch result:', { profile, profileError });

      if (profileError || !profile) {
        // For OAuth users, profile might be created asynchronously
        // Retry a few times with exponential backoff
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`Profile not found, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return loadUserProfile(supabaseUser, retryCount + 1);
        }
        console.error('Profile not found after retries:', profileError);
        throw new Error('Profile not found');
      }

      // Fetch organisation separately if user has one
      let organisation = null;
      if (profile.organisation_id) {
        console.log('Fetching organisation:', profile.organisation_id);
        const { data: orgData, error: orgError } = await supabase
          .from('organisations')
          .select('*, feature_flags')
          .eq('id', profile.organisation_id)
          .single();

        console.log('Organisation fetch result:', { orgData, orgError });

        if (!orgError && orgData) {
          organisation = orgData;
          // Set feature flags from organisation
          setFeatureFlags(orgData.feature_flags || {});
        } else if (orgError) {
          console.error('Failed to fetch organisation:', orgError);
          console.error('Organisation ID:', profile.organisation_id);
          console.error('User ID:', profile.id);
          // Set a fallback organization name for debugging
          organisation = {
            id: profile.organisation_id,
            name: `Organization (ID: ${profile.organisation_id})`,
            // This helps us see if the org ID is correct even if we can't fetch details
          };
          setFeatureFlags({});
        }
      }

      // Set user profile
      const userProfile: UserProfile = {
        id: profile.id,
        email: profile.email,
        name: profile.name || profile.email,
        role: profile.role,
        organisationId: profile.organisation_id,
        organisation: organisation
      };

      console.log('Setting user profile in state:', userProfile);
      setUser(userProfile);
      console.log('User profile set successfully');
    } catch (error) {
      console.error('Failed to load user profile:', error);
      throw error;
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      if (data.user) {
        await loadUserProfile(data.user);
        // Don't navigate here - let the calling component handle navigation
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to login');
    }
  };

  // Signup function
  const signup = async (email: string, password: string, name: string) => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      });
      
      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Create default organization for new user
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: `${name}'s Organization`
        })
        .select()
        .single();

      if (orgError) {
        console.error('Organization creation error:', orgError);
        throw orgError;
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          name: name,
          role: 'admin', // First user of org is admin
          organisation_id: org.id
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      // Load the profile
      await loadUserProfile(authData.user);
      // Don't navigate here - let the calling component handle navigation
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Failed to create account');
    }
  };

  // Google OAuth login
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      throw new Error(error.message || 'Failed to login with Google');
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log('Logout initiated');

      // Clear user state immediately
      setUser(null);
      setIsLoadingProfile(false);
      setFeatureFlags(null);

      // Clear organization ID from localStorage
      localStorage.removeItem('currentOrgId');

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
      }

      // Navigate to login
      navigate('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Don't throw - just log the error and navigate anyway
      navigate('/login');
    }
  };

  // Role check functions
  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'super_admin';
  };

  const isSuperAdmin = () => {
    return user?.role === 'super_admin';
  };

  const hasRole = (role: UserRole) => {
    if (!user) return false;

    // Super admin has all permissions
    if (user.role === 'super_admin') return true;

    // Admin has admin and user permissions
    if (user.role === 'admin' && (role === 'admin' || role === 'user')) return true;

    // User only has user permissions
    return user.role === role;
  };

  // Feature flag check function
  const isFeatureEnabled = useCallback((path: string): boolean => {
    if (!featureFlags) return false;

    const parts = path.split('.');
    let current: any = featureFlags;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return false;
      }
      current = current[part];
    }

    // Handle different value types
    if (typeof current === 'boolean') {
      return current;
    }

    if (typeof current === 'object' && current !== null) {
      // Check for { enabled: boolean } pattern
      if ('enabled' in current) {
        return current.enabled === true;
      }
      // If it's an object without 'enabled', consider it enabled if it exists
      return true;
    }

    return false;
  }, [featureFlags]);

  // Refetch feature flags (useful after super admin modifies them)
  const refetchFeatureFlags = useCallback(async () => {
    if (!user?.organisationId) return;

    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('feature_flags')
        .eq('id', user.organisationId)
        .single();

      if (error) {
        console.error('Error refetching feature flags:', error);
        return;
      }

      setFeatureFlags(data?.feature_flags || {});
    } catch (err) {
      console.error('Error refetching feature flags:', err);
    }
  }, [user?.organisationId]);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth in new tab/window...');
        
        // First check if there's an existing session in localStorage
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        console.log('Session check result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email
        });
        
        if (session?.user && mounted) {
          console.log('Found existing session, loading profile...');
          await loadUserProfile(session.user);
        } else {
          console.log('No existing session found');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          console.log('Auth initialization complete');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes - simplified to only handle essential events
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'Session:', !!session, 'User:', session?.user?.email);
      
      // Only handle SIGNED_OUT event from auth state changes
      // Initial session loading is handled by initializeAuth
      if (event === 'SIGNED_OUT' && mounted) {
        console.log('SIGNED_OUT event - clearing user state');
        setUser(null);
        setFeatureFlags(null);
        localStorage.removeItem('currentOrgId');

        // Navigate to login if we're not already there
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);


  // Password reset function
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw new Error(error.message || 'Failed to send reset email');
    }
  };

  // Update password (used by reset password flow)
  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
    } catch (error: any) {
      console.error('Password update error:', error);
      throw new Error(error.message || 'Failed to update password');
    }
  };

  // Invitation management functions (only available for admins)
  const inviteUser = async (email: string, role: Exclude<UserRole, 'super_admin'>): Promise<string> => {
    if (!user || !isAdmin()) {
      throw new Error('Only admins can invite users');
    }

    try {
      const token = await InvitationService.createInvitation(
        email,
        role,
        user.organisationId,
        user.id
      );
      
      // Generate the invitation URL
      const inviteUrl = InvitationService.generateInvitationUrl(token);
      
      // TODO: Send email with invitation link
      console.log('Invitation created:', { email, role, inviteUrl });
      
      return inviteUrl;
    } catch (error: any) {
      console.error('Invite user error:', error);
      throw new Error(error.message || 'Failed to invite user');
    }
  };

  const removeUser = async (userId: string): Promise<void> => {
    if (!user || !isAdmin()) {
      throw new Error('Only admins can remove users');
    }

    try {
      await InvitationService.removeUser(userId, user.organisationId);
    } catch (error: any) {
      console.error('Remove user error:', error);
      throw new Error(error.message || 'Failed to remove user');
    }
  };

  const updateUserRole = async (
    userId: string,
    role: Exclude<UserRole, 'super_admin'>
  ): Promise<void> => {
    if (!user || !isAdmin()) {
      throw new Error('Only admins can update user roles');
    }

    try {
      await InvitationService.updateUserRole(userId, role, user.organisationId);
    } catch (error: any) {
      console.error('Update user role error:', error);
      throw new Error(error.message || 'Failed to update user role');
    }
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    login,
    signup,
    signInWithGoogle,
    logout,
    resetPassword,
    updatePassword,
    isAdmin,
    isSuperAdmin,
    hasRole,
    // Feature flags
    featureFlags,
    isFeatureEnabled,
    refetchFeatureFlags,
    // Invitation functions (only for admins)
    ...(user && isAdmin() ? {
      inviteUser,
      removeUser,
      updateUserRole
    } : {})
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};