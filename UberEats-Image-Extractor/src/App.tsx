import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/toaster';
import { useOrganizationSync } from './hooks/useOrganizationSync';

// Layout
import LayoutNew from './components/layout/LayoutNew';

// Protected Pages
import Dashboard from './pages/Dashboard';
import Restaurants from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import Extractions from './pages/Extractions';
import ExtractionDetail from './pages/ExtractionDetail';
import NewExtraction from './pages/NewExtraction';
import Menus from './pages/Menus';
import MenuDetail from './pages/MenuDetail';
import MenuMerge from './pages/MenuMerge';
import Analytics from './pages/Analytics';
import History from './pages/History';
import Settings from './pages/Settings';

// Super Admin Pages
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

// Auth Pages
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { ResetPasswordPage } from './pages/ResetPassword';
import { AuthCallbackPage } from './pages/AuthCallback';
import { InviteAcceptPage } from './pages/InviteAccept';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (garbage collection time)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// App content component that uses hooks
function AppContent() {
  // Sync organization ID for API calls
  useOrganizationSync();
  
  return (
    <>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LayoutNew />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="restaurants" element={<Restaurants />} />
          <Route path="restaurants/:id" element={<RestaurantDetail />} />
          <Route path="extractions" element={<Extractions />} />
          <Route path="extractions/new" element={<NewExtraction />} />
          <Route path="extractions/:jobId" element={<ExtractionDetail />} />
          <Route path="menus" element={<Menus />} />
          <Route path="menus/merge" element={<MenuMerge />} />
          <Route path="menus/:id" element={<MenuDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
          
          {/* Admin Only Routes */}
          <Route 
            path="settings/organization" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <div>Organization Settings (Coming Soon)</div>
              </ProtectedRoute>
            } 
          />
          
          {/* Super Admin Only Routes */}
          <Route 
            path="super-admin" 
            element={<SuperAdminDashboard />}
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;