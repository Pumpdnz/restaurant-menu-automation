import axios from 'axios';

// Import supabase to get the session
import { supabase } from '../lib/supabase';

// Shared auth interceptor for both API instances
const createAuthInterceptor = () => async (config) => {
  // Get the current session from Supabase
  const { data: { session } } = await supabase.auth.getSession();

  // Add auth token from Supabase session
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
    console.log('Sending request with auth token');
  } else {
    console.warn('No auth session found for API request');
  }

  // Add organization ID header for API filtering (as backup)
  const orgId = localStorage.getItem('currentOrgId');
  if (orgId) {
    config.headers['X-Organization-ID'] = orgId;
    console.log('Sending request with org ID:', orgId);
  }

  return config;
};

// Create axios instance with default config (goes through Netlify proxy)
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create Railway-specific API instance for long-running Playwright operations
// This bypasses Netlify's ~30s gateway timeout by calling Railway directly
const railwayApi = axios.create({
  baseURL: import.meta.env.VITE_RAILWAY_API_URL || 'http://localhost:3007',
  timeout: 1200000, // 20 minutes - for Playwright scripts that take 2-5 min
  // headers: {
  //   'Content-Type': 'application/json',
  // }, // Commented out to avoid errors passing csv files to the railway api
});

// Apply auth interceptor to both instances
api.interceptors.request.use(createAuthInterceptor(), (error) => Promise.reject(error));
railwayApi.interceptors.request.use(createAuthInterceptor(), (error) => Promise.reject(error));

// Restaurant APIs
export const restaurantAPI = {
  getAll: () => api.get('/restaurants'),
  getById: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => api.patch(`/restaurants/${id}`, data),
  getMenus: (id) => api.get(`/restaurants/${id}/menus`),
  getPriceHistory: (id, params) => api.get(`/restaurants/${id}/price-history`, { params }),
  // Minimal list for switcher dropdown (id, name, address, city, onboarding_status only)
  getSwitcherList: () => api.get('/restaurants/switcher'),
};

// Menu APIs
export const menuAPI = {
  getById: (id) => api.get(`/menus/${id}`),
  activate: (id) => api.post(`/menus/${id}/activate`),
  compare: (menu1, menu2) => api.get('/menus/compare', { params: { menu1, menu2 } }),
  comparePost: (id, compareWithId) => api.post(`/menus/${id}/compare`, { compareWithId }),
  duplicate: (id) => api.post(`/menus/${id}/duplicate`),
  delete: (id) => api.delete(`/menus/${id}`),
  export: (id, options) => api.post(`/menus/${id}/export`, options),
};

// Extraction APIs
export const extractionAPI = {
  start: (data) => api.post('/extractions/start', data),
  getAll: (params) => api.get('/extractions', { params }),
  getById: (jobId) => api.get(`/extractions/${jobId}`),
  retry: (jobId) => api.post(`/extractions/${jobId}/retry`),
  cancel: (jobId) => api.delete(`/extractions/${jobId}`),
  
  // Premium extraction endpoints
  startPremium: (data) => api.post('/extract-menu-premium', data),
  getPremiumStatus: (jobId) => api.get(`/premium-extract-status/${jobId}`),
  getPremiumResults: (jobId) => api.get(`/premium-extract-results/${jobId}`),
  
  // Legacy endpoints (for backward compatibility)
  scanCategories: (url) => api.post('/scan-categories', { url }),
  batchExtract: (data) => api.post('/batch-extract-categories', data),
  getStatus: (jobId) => api.get(`/batch-extract-status/${jobId}`),
  getResults: (jobId) => api.get(`/batch-extract-results/${jobId}`),
};

// Menu Item APIs
export const menuItemAPI = {
  update: (id, data) => api.patch(`/menu-items/${id}`, data),
  bulkUpdate: (updates) => {
    console.log('[API Service] Sending bulk update with', updates.length, 'items');
    console.log('[API Service] Updates being sent:', JSON.stringify(updates, null, 2));
    return api.post('/menu-items/bulk-update', { updates });
  },
  addToCategory: (categoryId, data) => api.post(`/categories/${categoryId}/items`, data),
};

// Search APIs
export const searchAPI = {
  searchMenus: (query, restaurantId) => 
    api.get('/search/menus', { params: { q: query, restaurantId } }),
  searchItems: (query, restaurantId) => 
    api.get('/search/items', { params: { q: query, restaurantId } }),
};

// Analytics APIs
export const analyticsAPI = {
  getExtractionStats: () => api.get('/analytics/extraction-stats'),
};

// Export APIs
export const exportAPI = {
  generateCSV: (menuId, format = 'full') => 
    api.post('/exports/csv', { menuId, format }),
  generatePDF: (menuId, template = 'default') => 
    api.post('/exports/pdf', { menuId, template }),
  getHistory: (restaurantId, limit = 50) => 
    api.get('/exports/history', { params: { restaurantId, limit } }),
  
  // Legacy CSV endpoints
  generateLegacyCSV: (data, options) => 
    api.post('/generate-csv', { data, options }),
  generateCleanCSV: (data, options) => 
    api.post('/generate-clean-csv', { data, options }),
};

// Utility function to download CSV
export const downloadCSV = (csvData, filename) => {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Export railwayApi for long-running Playwright operations (bypasses Netlify timeout)
export { railwayApi };

export default api;