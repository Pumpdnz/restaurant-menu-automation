import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Lock } from 'lucide-react';

interface FeatureProtectedRouteProps {
  children: React.ReactNode;
  featurePath: string;
  fallbackPath?: string;
  featureName?: string;
}

/**
 * Route component that protects routes based on feature flags
 * Redirects to fallback path or shows access denied if feature is disabled
 *
 * @example
 * ```tsx
 * <Route path="/leads" element={
 *   <FeatureProtectedRoute featurePath="leadScraping" featureName="Lead Scraping">
 *     <LeadScrapes />
 *   </FeatureProtectedRoute>
 * } />
 * ```
 */
export function FeatureProtectedRoute({
  children,
  featurePath,
  fallbackPath = '/dashboard',
  featureName,
}: FeatureProtectedRouteProps) {
  const { user, loading, isFeatureEnabled, featureFlags } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth and loading feature flags
  if (loading || (user && featureFlags === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if feature is enabled
  if (!isFeatureEnabled(featurePath)) {
    // Option 1: Redirect to fallback path
    // return <Navigate to={fallbackPath} replace />;

    // Option 2: Show access denied message (more user-friendly)
    const displayName = featureName || formatFeatureName(featurePath);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Feature Not Available</h2>
          <p className="text-gray-600 mb-6">
            The <span className="font-medium">{displayName}</span> feature is not enabled for your organization.
          </p>
          <p className="text-sm text-gray-500">
            Contact your administrator or upgrade your plan to access this feature.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Format feature path into human-readable name
 * e.g., 'leadScraping' -> 'Lead Scraping'
 */
function formatFeatureName(path: string): string {
  // Get the last part of the path if it's nested
  const lastPart = path.split('.').pop() || path;

  // Convert camelCase to Title Case with spaces
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
