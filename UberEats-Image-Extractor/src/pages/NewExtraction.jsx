import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import { extractionAPI } from '../services/api';

export default function NewExtraction() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [generateCSV, setGenerateCSV] = useState(true);

  // Auto-detect platform and restaurant name from URL
  const handleUrlChange = (value) => {
    setUrl(value);
    setError(null);
    
    // Auto-detect platform and extract restaurant name
    if (value.includes('ubereats.com')) {
      setPlatform('ubereats');
      
      // Extract restaurant name from URL
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
    } else if (value.includes('doordash.com')) {
      setPlatform('doordash');
      
      // Extract restaurant name from URL
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
    } else {
      setPlatform('');
      setRestaurantName('');
    }
  };

  // Mutation for starting extraction
  const startExtraction = useMutation({
    mutationFn: async (data) => {
      // Extract restaurant name from URL for the API
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
      
      return await extractionAPI.start({
        ...data,
        restaurantName: restaurantName
      });
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
                {restaurantName && (
                  <p className="text-sm text-gray-500">
                    Restaurant: <span className="font-medium">{restaurantName}</span>
                  </p>
                )}
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