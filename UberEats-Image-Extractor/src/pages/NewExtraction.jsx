import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Download, AlertCircle, CheckCircle, Building2, Search, Loader2, Check, Sparkles, Info } from 'lucide-react';
import { extractionAPI, restaurantAPI } from '../services/api';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { detectPlatform, extractRestaurantName } from '../utils/platform-detector';

export default function NewExtraction() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState(null);
  const [platformConfidence, setPlatformConfidence] = useState('none');
  const [manualPlatformOverride, setManualPlatformOverride] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); // Local loading state for immediate feedback

  // Restaurant selection state
  const [restaurantMode, setRestaurantMode] = useState('auto'); // 'auto' or 'manual'
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [similarRestaurants, setSimilarRestaurants] = useState([]);

  // Premium extraction state
  const [isPremiumMode, setIsPremiumMode] = useState(false);
  const [extractOptionSets, setExtractOptionSets] = useState(true);
  const [validateImages, setValidateImages] = useState(true);

  // Available platforms for manual selection
  const availablePlatforms = [
    { value: 'ubereats', label: 'UberEats' },
    { value: 'doordash', label: 'DoorDash' },
    { value: 'ordermeal', label: 'OrderMeal' },
    { value: 'nextorder', label: 'NextOrder' },
    { value: 'foodhub', label: 'FoodHub' },
    { value: 'mobi2go', label: 'Mobi2Go' },
    { value: 'menulog', label: 'Menulog' },
    { value: 'delivereasy', label: 'DeliverEasy' },
    { value: 'bopple', label: 'Bopple' },
    { value: 'resdiary', label: 'ResDiary' },
    { value: 'meandu', label: 'Me&u' },
    { value: 'gloriafood', label: 'GloriaFood' },
    { value: 'sipo', label: 'Sipo' },
    { value: 'booknorder', label: 'BookNOrder' },
    { value: 'website', label: 'Generic Website' }
  ];

  // Get organization ID from localStorage
  const orgId = localStorage.getItem('currentOrgId');

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
    setManualPlatformOverride(false);

    if (!value) {
      setDetectedPlatform(null);
      setPlatformConfidence('none');
      setPlatform('');
      setRestaurantName('');
      return;
    }

    try {
      // Use the platform detector utility
      const platformInfo = detectPlatform(value);
      setDetectedPlatform(platformInfo);
      setPlatformConfidence(platformInfo.confidence || 'none');

      // Set platform if detected with high confidence
      if (platformInfo.confidence === 'high' && !platformInfo.requiresManualSelection) {
        setPlatform(platformInfo.name.toLowerCase());
      } else {
        // Require manual selection
        setPlatform('');
      }

      // Extract restaurant name
      const extractedName = extractRestaurantName(value, platformInfo);
      if (extractedName) {
        const formattedName = extractedName
          .split(/[\s-_]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        setRestaurantName(formattedName);

        // Check for similar restaurants
        const similar = restaurants.filter(r =>
          r.name.toLowerCase().includes(formattedName.toLowerCase()) ||
          formattedName.toLowerCase().includes(r.name.toLowerCase())
        );
        setSimilarRestaurants(similar);

        // If in manual mode, also update search query
        if (restaurantMode === 'manual') {
          setSearchQuery(formattedName);
        }
      } else {
        setRestaurantName('');
        setSimilarRestaurants([]);
        if (restaurantMode === 'manual') {
          setSearchQuery('');
        }
      }
    } catch (e) {
      setPlatform('');
      setRestaurantName('');
      if (restaurantMode === 'manual') {
        setSearchQuery('');
      }
    }
  };

  // Mutation for starting extraction
  const startExtraction = useMutation({
    mutationFn: async (data) => {
      setIsExtracting(true); // Set loading immediately
      
      // Use premium extraction if enabled and platform is UberEats
      if (isPremiumMode && data.url.includes('ubereats.com')) {
        // Premium extraction - orgId now comes from header via middleware
        const premiumData = {
          storeUrl: data.url,
          extractOptionSets,
          validateImages,
          async: true // Always use async for better UX
        };
        
        // Add restaurant information if in manual mode
        if (restaurantMode === 'manual' && selectedRestaurantId) {
          const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
          premiumData.restaurantId = selectedRestaurantId;
          premiumData.restaurantName = selectedRestaurant?.name || 'Unknown Restaurant';
        }
        
        return await extractionAPI.startPremium(premiumData);
      } else {
        // Standard extraction
        let extractionData = { ...data };
        
        if (restaurantMode === 'manual' && selectedRestaurantId) {
          // In manual mode, use the selected restaurant ID
          const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
          extractionData.restaurantId = selectedRestaurantId;
          extractionData.restaurantName = selectedRestaurant?.name || 'Unknown Restaurant';
        } else {
          // In auto mode, extract restaurant name from URL
          let restaurantName = 'Unknown Restaurant';
          
          try {
            const urlObj = new URL(data.url);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            if (data.url.includes('ubereats.com') || data.url.includes('doordash.com')) {
              const storeIndex = pathParts.indexOf('store');
              if (storeIndex !== -1 && pathParts[storeIndex + 1]) {
                restaurantName = pathParts[storeIndex + 1]
                  .replace(/-/g, ' ')
                  .replace(/_/g, ' ')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
              }
            } else if (pathParts[0]) {
              restaurantName = pathParts[0]
                .replace(/-/g, ' ')
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
          } catch (e) {
            console.error('Error parsing URL:', e);
          }
          
          extractionData.restaurantName = restaurantName;
        }
        
        return await extractionAPI.start(extractionData);
      }
    },
    onSuccess: (response) => {
      setSuccess(true);
      // Small delay to show success state before navigating
      setTimeout(() => {
        // Handle both standard and premium extraction responses
        const jobId = response.data.jobId;
        const isPremium = response.data.statusUrl ? true : false;
        navigate(`/extractions/${jobId}?poll=true${isPremium ? '&premium=true' : ''}`);
      }, 500);
    },
    onError: (error) => {
      setIsExtracting(false); // Reset loading state on error
      setError(error.response?.data?.error || error.message || 'Failed to start extraction');
    },
    onSettled: () => {
      // This runs after success or error
      // But we handle navigation in onSuccess, so just ensure state cleanup
      setTimeout(() => {
        setIsExtracting(false);
      }, 1000);
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
      setError('Please select a platform for this URL');
      return;
    }
    
    // In manual mode, require restaurant selection
    if (restaurantMode === 'manual' && !selectedRestaurantId) {
      setError('Please select a restaurant from the list');
      return;
    }
    
    // Set loading state immediately for instant feedback
    setIsExtracting(true);
    setError(null);
    
    // Start extraction with user-selected options
    startExtraction.mutate({
      url,
      platform,
      options: {}
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Menu Extraction</h1>
          <p className="mt-1 text-sm text-gray-500">
            Extract menu data from restaurant websites and delivery platforms
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
                placeholder="Enter restaurant URL..."
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                disabled={isExtracting}
              />
            </div>
            {/* Platform Detection and Selection */}
            {url && (
              <div className="mt-3 space-y-3">
                {detectedPlatform && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center space-x-2">
                      {platformConfidence === 'high' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="text-sm text-gray-700">
                        {platformConfidence === 'high' ? (
                          <>Platform detected: <span className="font-medium">{detectedPlatform.name}</span></>
                        ) : (
                          <>Platform not detected - please select manually</>
                        )}
                      </span>
                    </div>
                    {platformConfidence === 'high' && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualPlatformOverride(!manualPlatformOverride);
                          if (manualPlatformOverride) {
                            // Restore detected platform
                            setPlatform(detectedPlatform.name.toLowerCase());
                          } else {
                            // Clear for manual selection
                            setPlatform('');
                          }
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {manualPlatformOverride ? 'Use detected' : 'Override'}
                      </button>
                    )}
                  </div>
                )}

                {/* Platform selector - shown when no detection or manual override */}
                {(platformConfidence !== 'high' || manualPlatformOverride) && (
                  <div>
                    <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1">
                      Select Platform <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                      required={platformConfidence !== 'high' || manualPlatformOverride}
                    >
                      <option value="">Choose a platform...</option>
                      {availablePlatforms.map(p => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                  <span className="ml-2 text-sm text-gray-700">Create New Restaurant</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="manual"
                    checked={restaurantMode === 'manual'}
                    onChange={(e) => {
                      setRestaurantMode(e.target.value);
                      // Auto-populate search with detected restaurant name
                      if (restaurantName) {
                        setSearchQuery(restaurantName);
                      }
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
                      New restaurant will be created: <span className="font-medium">{restaurantName}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show warning if similar restaurants exist */}
            {restaurantMode === 'auto' && similarRestaurants.length > 0 && (
              <div className="mt-2 rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      {similarRestaurants.length} similar restaurant{similarRestaurants.length > 1 ? 's' : ''} found:
                    </p>
                    <ul className="mt-1 text-sm text-yellow-700">
                      {similarRestaurants.slice(0, 3).map(r => (
                        <li key={r.id} className="ml-2">• {r.name}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm text-yellow-800">
                      Consider selecting an existing restaurant instead to avoid duplicates.
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

          {/* Premium Extraction Options - Only for UberEats */}
          {platform === 'ubereats' && (
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="premium-mode" className="text-sm font-medium">
                    Premium Extraction Mode
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-sm">
                          Premium extraction captures option sets (sizes, toppings, add-ons) 
                          and validates images for better menu accuracy.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id="premium-mode"
                  checked={isPremiumMode}
                  onCheckedChange={setIsPremiumMode}
                />
              </div>

              {isPremiumMode && (
                <div className="ml-6 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="extract-option-sets"
                      checked={extractOptionSets}
                      onCheckedChange={setExtractOptionSets}
                    />
                    <Label
                      htmlFor="extract-option-sets"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Extract Option Sets
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-sm">
                            Captures customization options like sizes, toppings, and add-ons.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="validate-images"
                      checked={validateImages}
                      onCheckedChange={setValidateImages}
                    />
                    <Label
                      htmlFor="validate-images"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Validate Images
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-sm">
                            Checks and validates all menu item images for quality and availability.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700">
                      <strong>Note:</strong> Premium extraction runs asynchronously and may take 
                      longer but provides more detailed menu data.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/extractions')}
              className="px-5 py-2.5 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExtracting || !url || success}
              className={`
                inline-flex items-center justify-center px-6 py-2.5 
                border border-transparent rounded-lg shadow-md 
                text-sm font-medium transition-all duration-200 transform
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue 
                ${!url 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : isExtracting 
                    ? 'bg-gradient-to-r from-brand-blue to-brand-green text-white cursor-wait scale-105 opacity-90' 
                    : success
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                      : 'bg-gradient-to-r from-brand-blue to-brand-green text-white hover:shadow-lg hover:scale-105 active:scale-100'
                }
                disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100
              `}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  <span className="animate-pulse">Initializing Extraction...</span>
                </>
              ) : success ? (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Extraction Started
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Start Extraction
                </>
              )}
            </button>
          </div>
        </form>

        {/* Enhanced Loading Overlay */}
        {isExtracting && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 transform scale-100 animate-fadeIn">
              <div className="flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-primary-100 rounded-full animate-ping opacity-75"></div>
                  <Loader2 className="h-16 w-16 text-primary-600 animate-spin relative z-10" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Starting Extraction
                </h3>
                <div className="space-y-2 text-center">
                  <p className="text-sm text-gray-600">
                    Initializing menu extraction job...
                  </p>
                  <p className="text-xs text-gray-500">
                    You'll be automatically redirected once the job is created.
                  </p>
                </div>
                <div className="mt-4 flex space-x-1">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Tips */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900">Quick Tips</h3>
          <ul className="mt-2 text-sm text-gray-500 space-y-1">
            <li>• Make sure to use the full restaurant URL from any supported platform</li>
            <li>• The extraction will automatically detect menu categories and items</li>
            <li>• Images will be downloaded and organized by category</li>
            <li>• You can track the extraction progress in real-time</li>
          </ul>
        </div>
      </div>
    </div>
  );
}