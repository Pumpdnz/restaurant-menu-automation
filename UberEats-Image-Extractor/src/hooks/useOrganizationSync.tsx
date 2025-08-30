import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// This hook syncs the current organization ID with localStorage for API middleware
export function useOrganizationSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (loading) {
      return;
    }

    if (user?.organisation?.id) {
      // Store in localStorage for API middleware to pick up
      localStorage.setItem('currentOrgId', user.organisation.id);
      console.log('Organization ID synced:', user.organisation.id);
    } else if (user?.organisationId) {
      // Fallback to user's organization ID if organization object not loaded
      localStorage.setItem('currentOrgId', user.organisationId);
      console.log('Organization ID synced from user:', user.organisationId);
    } else if (user === null) {
      // Only clear if we explicitly know there's no user (not just undefined during loading)
      localStorage.removeItem('currentOrgId');
      console.log('Organization ID cleared - user logged out');
    }
    // If user is undefined (still loading), don't clear the organization ID
    
    return () => {
      // Don't clear on unmount as it causes issues during navigation
      // The organization ID will be cleared on logout
    };
  }, [user, loading]);
}