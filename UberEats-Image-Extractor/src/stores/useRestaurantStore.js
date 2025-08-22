import { create } from 'zustand';

export const useRestaurantStore = create((set) => ({
  selectedRestaurant: null,
  viewMode: 'grid', // 'grid' | 'table'
  searchQuery: '',
  filters: {
    platform: null,
    status: null,
  },
  
  setSelectedRestaurant: (restaurant) => set({ selectedRestaurant: restaurant }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),
  
  clearFilters: () => set({
    searchQuery: '',
    filters: {
      platform: null,
      status: null,
    }
  }),
}));