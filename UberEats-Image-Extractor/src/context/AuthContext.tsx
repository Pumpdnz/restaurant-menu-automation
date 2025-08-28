import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContextType, UserProfile, UserRole } from '../types/auth';

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // Simple function to load user profile
  const loadUserProfile = async (supabaseUser: User) => {
    try {
      // Fetch profile with organization data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          organisation:organisations(*)
        `)
        .eq('id', supabaseUser.id)
        .single();

      if (error || !profile) {
        console.error('Profile load error:', error);
        throw new Error('Profile not found');
      }

      // Set user profile
      const userProfile: UserProfile = {
        id: profile.id,
        email: profile.email,
        name: profile.name || profile.email,
        role: profile.role,
        organisationId: profile.organisation_id,
        organisation: profile.organisation
      };

      setUser(userProfile);
      return userProfile;
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
        navigate('/');
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
      navigate('/');
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      navigate('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Failed to logout');
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

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await loadUserProfile(session.user);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await loadUserProfile(session.user);
        } catch (error) {
          console.error('Failed to load profile after sign in:', error);
          // For OAuth logins, profile might not exist yet
          if (event === 'SIGNED_IN') {
            // Create profile for OAuth user
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                name: session.user.user_metadata?.name || session.user.email!,
                role: 'user',
                organisation_id: '00000000-0000-0000-0000-000000000000' // Default org
              });

            if (!profileError) {
              await loadUserProfile(session.user);
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
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

  // Update password with token
  const updatePassword = async (token: string, newPassword: string) => {
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
    hasRole
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};