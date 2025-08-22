import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token (will be used later)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Restaurant APIs
export const restaurantAPI = {
  getAll: () => api.get('/restaurants'),
  getById: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => api.patch(`/restaurants/${id}`, data),
  getMenus: (id) => api.get(`/restaurants/${id}/menus`),
  getPriceHistory: (id, params) => api.get(`/restaurants/${id}/price-history`, { params }),
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
  
  // Legacy endpoints (for backward compatibility)
  scanCategories: (url) => api.post('/scan-categories', { url }),
  batchExtract: (data) => api.post('/batch-extract-categories', data),
  getStatus: (jobId) => api.get(`/batch-extract-status/${jobId}`),
  getResults: (jobId) => api.get(`/batch-extract-results/${jobId}`),
};

// Menu Item APIs
export const menuItemAPI = {
  update: (id, data) => api.patch(`/menu-items/${id}`, data),
  bulkUpdate: (updates) => api.post('/menu-items/bulk-update', { updates }),
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

export default api;