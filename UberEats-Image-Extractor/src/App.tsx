import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/toaster';
import { useOrganizationSync } from './hooks/useOrganizationSync';
import api from './services/api';

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
import Tasks from './pages/Tasks';
import MessageTemplates from './pages/MessageTemplates';
import TaskTemplates from './pages/TaskTemplates';
import Sequences from './pages/Sequences';

// Super Admin Pages
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

// Social Media Pages
import SocialMediaDashboard from './pages/SocialMediaDashboard';

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

// ExtractionRedirect component to handle routing logic
function ExtractionRedirect() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    checkExtractionStatus();
  }, [jobId]);
  
  const checkExtractionStatus = async () => {
    try {
      // Always check the extraction status first, regardless of poll parameter
      const response = await api.get(`/extractions/${jobId}`);
      
      if (response.data.success && response.data.job) {
        const job = response.data.job;
        
        // If extraction has a menu_id, redirect to MenuDetail
        if (job.menu_id || job.menuId) {
          const menuId = job.menu_id || job.menuId;
          console.log(`[ExtractionRedirect] Redirecting to menu: ${menuId}`);
          navigate(`/menus/${menuId}`, { replace: true });
          return;
        }
        
        // If extraction is completed but no menu_id (legacy), show ExtractionDetail
        if (job.status === 'completed' || job.state === 'completed') {
          console.log('[ExtractionRedirect] Completed extraction without menu_id, showing ExtractionDetail');
          setChecking(false);
          return;
        }
        
        // If extraction is still running, show ExtractionDetail for polling
        if (job.status === 'running' || job.state === 'running' || job.status === 'pending') {
          console.log('[ExtractionRedirect] Extraction still running, showing ExtractionDetail for polling');
          setChecking(false);
          return;
        }
      }
      
      // If we get here, show ExtractionDetail as fallback
      setChecking(false);
    } catch (err) {
      console.error('[ExtractionRedirect] Error checking extraction status:', err);
      // On error, show ExtractionDetail as fallback
      setError(err.message);
      setChecking(false);
    }
  };
  
  // While checking, show loading state
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking extraction status...</p>
        </div>
      </div>
    );
  }
  
  // If not redirected and check is complete, show ExtractionDetail
  return <ExtractionDetail />;
}

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
          <Route path="extractions/:jobId" element={<ExtractionRedirect />} />
          <Route path="menus" element={<Menus />} />
          <Route path="menus/merge" element={<MenuMerge />} />
          <Route path="menus/:id" element={<MenuDetail />} />
          <Route path="tasks" element={<Tasks />} />
          {/* Redirect task-templates to tasks page templates tab */}
          <Route path="task-templates" element={<Navigate to="/tasks?tab=templates" replace />} />
          <Route path="sequences" element={<Sequences />} />
          {/* Redirect old sequence-templates route to new tab-based page */}
          <Route path="sequence-templates" element={<Navigate to="/sequences?tab=templates" replace />} />
          {/* Redirect message-templates to sequences page message templates tab */}
          <Route path="message-templates" element={<Navigate to="/sequences?tab=message-templates" replace />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />

          {/* Social Media Routes */}
          <Route path="social-media" element={<SocialMediaDashboard />} />
          {/* Legacy redirects for backward compatibility */}
          <Route path="social-media/videos" element={<Navigate to="/social-media?tab=videos" replace />} />
          <Route path="social-media/generate" element={<Navigate to="/social-media?tab=videos" replace />} />

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