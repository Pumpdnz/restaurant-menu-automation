import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Download, AlertCircle, CheckCircle, Building2, Search } from 'lucide-react';
import { extractionAPI, restaurantAPI } from '../services/api';

export default function NewExtraction() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [generateCSV, setGenerateCSV] = useState(true);
  
  // Restaurant selection state
  const [restaurantMode, setRestaurantMode] = useState('auto'); // 'auto' or 'manual'
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  // Fetch restaurants when component mounts or mode changes to manual
  useEffect(() => {
    if (restaurantMode === 'manual') {
      fetchRestaurants();
    }
  }, [restaurantMode]);

  const fetchRestaurants = async () => {
    setLoadingRestaurants(true);
    try {
      const response = await restaurantAPI.getAll();
      setRestaurants(response.data.restaurants || []);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
      setRestaurants([]);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  // Filter restaurants based on search query
  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-detect platform and restaurant name from URL
  const handleUrlChange = (value) => {
    setUrl(value);
    setError(null);
    
    // Auto-detect platform
    if (value.includes('ubereats.com')) {
      setPlatform('ubereats');
      
      // Only extract restaurant name if in auto mode
      if (restaurantMode === 'auto') {
        const match = value.match(/\/store\/([^\/\?]+)/);
        if (match) {
          const name = match[1]
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          setRestaurantName(name);
        }
      }
    } else if (value.includes('doordash.com')) {
      setPlatform('doordash');
      
      // Only extract restaurant name if in auto mode
      if (restaurantMode === 'auto') {
        const match = value.match(/\/store\/([^\/\?]+)/);
        if (match) {
          const name = match[1]
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          setRestaurantName(name);
        }
      }
    } else {
      setPlatform('');
      if (restaurantMode === 'auto') {
        setRestaurantName('');
      }
    }
  };

  // Mutation for starting extraction
  const startExtraction = useMutation({
    mutationFn: async (data) => {
      let extractionData = { ...data };
      
      if (restaurantMode === 'manual' && selectedRestaurantId) {
        // In manual mode, use the selected restaurant ID
        const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
        extractionData.restaurantId = selectedRestaurantId;
        extractionData.restaurantName = selectedRestaurant?.name || 'Unknown Restaurant';
      } else {
        // In auto mode, extract restaurant name from URL
        let restaurantName = 'Unknown Restaurant';
        
        if (data.url.includes('ubereats.com')) {
          const match = data.url.match(/\/store\/([^\/\?]+)/);
          if (match) {
            restaurantName = match[1]
              .replace(/-/g, ' ')
              .replace(/_/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        } else if (data.url.includes('doordash.com')) {
          const match = data.url.match(/\/store\/([^\/\?]+)/);
          if (match) {
            restaurantName = match[1]
              .replace(/-/g, ' ')
              .replace(/_/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        }
        
        extractionData.restaurantName = restaurantName;
      }
      
      return await extractionAPI.start(extractionData);
    },
    onSuccess: (response) => {
      setSuccess(true);
      // Navigate to extraction detail page after 2 seconds
      setTimeout(() => {
        navigate(`/extractions/${response.data.jobId}`);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || error.message || 'Failed to start extraction');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!url) {
      setError('Please enter a restaurant URL');
      return;
    }
    
    if (!platform) {
      setError('Could not detect platform. Please enter a valid UberEats or DoorDash URL');
      return;
    }
    
    // In manual mode, require restaurant selection
    if (restaurantMode === 'manual' && !selectedRestaurantId) {
      setError('Please select a restaurant from the list');
      return;
    }
    
    // Start extraction with user-selected options
    startExtraction.mutate({
      url,
      platform,
      options: {
        includeImages: includeImages,
        generateCSV: generateCSV
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Menu Extraction</h1>
          <p className="mt-1 text-sm text-gray-500">
            Extract menu data from UberEats or DoorDash restaurants
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">
              Restaurant URL
            </label>
            <div className="mt-1">
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.ubereats.com/store/..."
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                disabled={startExtraction.isLoading}
              />
            </div>
            {platform && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-500">
                  Detected platform: <span className="font-medium capitalize">{platform}</span>
                </p>
              </div>
            )}
          </div>

          {/* Restaurant Selection Mode */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Restaurant Selection
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="auto"
                    checked={restaurantMode === 'auto'}
                    onChange={(e) => {
                      setRestaurantMode(e.target.value);
                      setSelectedRestaurantId('');
                      setSearchQuery('');
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Auto-detect restaurant</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="manual"
                    checked={restaurantMode === 'manual'}
                    onChange={(e) => {
                      setRestaurantMode(e.target.value);
                      setRestaurantName('');
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Select existing restaurant</span>
                </label>
              </div>
            </div>

            {/* Show auto-detected restaurant name */}
            {restaurantMode === 'auto' && restaurantName && (
              <div className="rounded-md bg-blue-50 p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      Auto-detected: <span className="font-medium">{restaurantName}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show restaurant dropdown in manual mode */}
            {restaurantMode === 'manual' && (
              <div>
                <label htmlFor="restaurant" className="block text-sm font-medium text-gray-700">
                  Select Restaurant
                </label>
                <div className="mt-1 relative">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search restaurants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                    />
                  </div>
                  {loadingRestaurants ? (
                    <div className="mt-2 text-sm text-gray-500">Loading restaurants...</div>
                  ) : (
                    <select
                      id="restaurant"
                      value={selectedRestaurantId}
                      onChange={(e) => setSelectedRestaurantId(e.target.value)}
                      className="mt-2 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                      size={5}
                    >
                      <option value="" disabled>Select a restaurant...</option>
                      {filteredRestaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name} {restaurant.address ? `(${restaurant.address})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedRestaurantId && (
                    <p className="mt-2 text-sm text-green-600">
                      Selected: {restaurants.find(r => r.id === selectedRestaurantId)?.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    Extraction started successfully! Redirecting...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Options (collapsed by default) */}
          <details className="border border-gray-200 rounded-lg p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Advanced Options
            </summary>
            <div className="mt-4 space-y-4">
              <div className="flex items-center">
                <input
                  id="includeImages"
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="includeImages" className="ml-2 block text-sm text-gray-700">
                  Download menu images
                  <span className="block text-xs text-gray-500">
                    {includeImages ? 'Images will be downloaded and stored' : 'Only text data will be extracted (faster)'}
                  </span>
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="generateCSV"
                  type="checkbox"
                  checked={generateCSV}
                  onChange={(e) => setGenerateCSV(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="generateCSV" className="ml-2 block text-sm text-gray-700">
                  Generate CSV export
                  <span className="block text-xs text-gray-500">
                    {generateCSV ? 'CSV file will be generated for download' : 'Data stored in database only'}
                  </span>
                </label>
              </div>
            </div>
          </details>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/extractions')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={startExtraction.isLoading || !url || success}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startExtraction.isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Start Extraction
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Tips */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900">Quick Tips</h3>
          <ul className="mt-2 text-sm text-gray-500 space-y-1">
            <li>• Make sure to use the full restaurant URL from UberEats or DoorDash</li>
            <li>• The extraction will automatically detect menu categories and items</li>
            <li>• Images will be downloaded and organized by category</li>
            <li>• You can track the extraction progress in real-time</li>
          </ul>
        </div>
      </div>
    </div>
  );
}