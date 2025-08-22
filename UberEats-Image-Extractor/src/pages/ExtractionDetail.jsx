import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  ArrowLeftIcon,
  DocumentArrowDownIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

export default function ExtractionDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      // Get job details
      const jobResponse = await api.get(`/extractions/${jobId}`);
      setJob(jobResponse.data);

      // If completed, get the actual menu data
      if (jobResponse.data.status === 'completed') {
        const resultsResponse = await api.get(`/batch-extract-results/${jobId}`);
        if (resultsResponse.data.success && resultsResponse.data.data) {
          setMenuData(resultsResponse.data.data);
          // Set first category as selected by default
          const categories = Object.keys(resultsResponse.data.data);
          if (categories.length > 0) {
            setSelectedCategory(categories[0]);
          }
        }
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch job details:', err);
      setError('Failed to load extraction details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const csvResponse = await api.post('/generate-csv', {
        data: menuData
      });
      
      if (csvResponse.data.success && csvResponse.data.csv) {
        const blob = new Blob([csvResponse.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `menu-${jobId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download CSV:', err);
    }
  };

  const handleDownloadImages = async () => {
    try {
      // Collect all image URLs
      const imageUrls = [];
      Object.values(menuData).forEach(category => {
        category.forEach(item => {
          if (item.imageURL || item.dishImageURL) {
            imageUrls.push({
              name: item.dishName || item.name,
              url: item.imageURL || item.dishImageURL
            });
          }
        });
      });

      const response = await api.post('/download-images', {
        images: imageUrls,
        restaurantName: job.restaurant?.name || 'menu'
      });

      if (response.data.success) {
        alert(`Downloaded ${response.data.downloadedCount} images successfully!`);
      }
    } catch (err) {
      console.error('Failed to download images:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  const totalItems = menuData ? 
    Object.values(menuData).reduce((sum, category) => sum + category.length, 0) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/extractions')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Extractions
        </button>
      </div>

      {/* Job Info */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Extraction Details
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {job.restaurant?.name || 'Unknown Restaurant'}
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Job ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{jobId}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  job.status === 'completed' ? 'bg-green-100 text-green-800' :
                  job.status === 'failed' ? 'bg-red-100 text-red-800' :
                  job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {job.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Items</dt>
              <dd className="mt-1 text-sm text-gray-900">{totalItems}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Platform</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {job.platform?.name || 'Unknown'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(job.created_at).toLocaleString()}
              </dd>
            </div>
            {job.status === 'completed' && (
              <div className="sm:col-span-3">
                <div className="flex space-x-3">
                  <button
                    onClick={handleDownloadCSV}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    Download CSV
                  </button>
                  <button
                    onClick={handleDownloadImages}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <PhotoIcon className="h-4 w-4 mr-2" />
                    Download Images
                  </button>
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Menu Data */}
      {menuData && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Menu Items
            </h3>
          </div>
          <div className="border-t border-gray-200">
            <div className="flex">
              {/* Category Sidebar */}
              <div className="w-64 bg-gray-50 border-r border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {Object.keys(menuData).map((category) => (
                    <li key={category}>
                      <button
                        onClick={() => setSelectedCategory(category)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 ${
                          selectedCategory === category ? 'bg-white font-medium' : ''
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>{category}</span>
                          <span className="text-sm text-gray-500">
                            {menuData[category].length}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Items List */}
              <div className="flex-1 p-6">
                {selectedCategory && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      {selectedCategory}
                    </h4>
                    <div className="space-y-4">
                      {menuData[selectedCategory].map((item, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex">
                            {(item.imageURL || item.dishImageURL) && (
                              <img
                                src={item.imageURL || item.dishImageURL}
                                alt={item.dishName || item.name}
                                className="h-24 w-24 rounded-lg object-cover mr-4"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <h5 className="text-base font-medium text-gray-900">
                                  {item.dishName || item.name}
                                </h5>
                                <span className="text-base font-medium text-gray-900">
                                  ${(item.dishPrice || item.price || 0).toFixed(2)}
                                </span>
                              </div>
                              {(item.dishDescription || item.description) && (
                                <p className="mt-1 text-sm text-gray-500">
                                  {item.dishDescription || item.description}
                                </p>
                              )}
                              {item.tags && item.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {item.tags.map((tag, tagIndex) => (
                                    <span
                                      key={tagIndex}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}