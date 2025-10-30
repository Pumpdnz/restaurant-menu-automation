import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api';

interface ReferenceImageSelectorProps {
  value: string[]; // Array of selected image IDs
  onChange: (imageIds: string[]) => void;
  mode: 'image-reference' | 'remix'; // Different sources for different modes
  min?: number; // Minimum selections (default: 1)
  max?: number; // Maximum selections (default: 10)
}

export function ReferenceImageSelector({
  value,
  onChange,
  mode,
  min = 1,
  max = 10
}: ReferenceImageSelectorProps) {
  const [images, setImages] = useState<any[]>([]);
  const [logos, setLogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLogos, setLoadingLogos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<any[]>([]);

  useEffect(() => {
    fetchRestaurants();
    // Fetch logos for both image-reference and remix modes
    if (mode === 'image-reference' || mode === 'remix') {
      fetchLogos();
    }
  }, [mode]);

  useEffect(() => {
    fetchImages();
  }, [searchQuery, selectedRestaurant, mode]);

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants');
      if (response.data.success && response.data.restaurants) {
        setRestaurants(response.data.restaurants);
      }
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchLogos = async () => {
    setLoadingLogos(true);
    try {
      const response = await api.get('/restaurants/logos');
      if (response.data.success && response.data.logos) {
        setLogos(response.data.logos);
      }
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setLoadingLogos(false);
    }
  };

  const fetchImages = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      const params = new URLSearchParams({
        limit: '100'
      });

      if (mode === 'image-reference') {
        // Fetch menu item images
        endpoint = '/menus/images';
        if (selectedRestaurant && selectedRestaurant !== 'all') {
          params.append('restaurantId', selectedRestaurant);
        }
      } else if (mode === 'remix') {
        // Fetch AI-generated images
        endpoint = '/social-media/images';
        params.append('status', 'completed');
        if (selectedRestaurant && selectedRestaurant !== 'all') {
          params.append('restaurantId', selectedRestaurant);
        }
      }

      const response = await api.get(`${endpoint}?${params}`);

      if (response.data.success || response.data.images) {
        const imageList = response.data.images || [];
        setImages(imageList);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (imageId: string) => {
    if (value.includes(imageId)) {
      // Deselect
      onChange(value.filter(id => id !== imageId));
    } else {
      // Select (if not at max)
      if (value.length < max) {
        onChange([...value, imageId]);
      }
    }
  };

  const filteredImages = images.filter(img => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    if (mode === 'image-reference') {
      return (img.menu_item_name || '').toLowerCase().includes(searchLower);
    } else {
      return (img.prompt || '').toLowerCase().includes(searchLower);
    }
  });

  const selectionCount = value.length;
  const canSelectMore = selectionCount < max;
  const hasMinimum = selectionCount >= min;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">
          {mode === 'image-reference' ? 'Select Menu Images' : 'Select AI Images to Remix'}
        </Label>
        <div className="text-sm">
          <span className={`font-medium ${hasMinimum ? 'text-green-600' : 'text-red-600'}`}>
            {selectionCount}
          </span>
          <span className="text-gray-500"> / {max} selected</span>
          {!hasMinimum && (
            <span className="text-xs text-red-600 ml-2">
              (min: {min})
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={mode === 'image-reference' ? 'Search by item name...' : 'Search by prompt...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />

        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All restaurants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All restaurants</SelectItem>
            {restaurants.map((restaurant) => (
              <SelectItem key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logo Section - Available for image-reference and remix modes */}
      {(mode === 'image-reference' || mode === 'remix') && logos.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Restaurant Logos</Label>
          {loadingLogos ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 p-3 bg-gray-50 rounded-lg">
              {logos.map((logo) => {
                const isSelected = value.includes(logo.id);
                return (
                  <Card
                    key={logo.id}
                    className={`relative cursor-pointer transition-all overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-primary ring-offset-2'
                        : canSelectMore
                        ? 'hover:ring-2 hover:ring-primary/50'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => canSelectMore || isSelected ? toggleImage(logo.id) : null}
                  >
                    <div className="aspect-square relative bg-white p-2">
                      <img
                        src={logo.logo_url}
                        alt={logo.name}
                        className="w-full h-full object-contain"
                      />

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-primary text-xs font-bold rounded-full flex items-center justify-center border-2 border-primary">
                              {value.indexOf(logo.id) + 1}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Logo info */}
                    <div className="px-1 py-1 bg-white border-t">
                      <p className="text-xs truncate text-gray-700 text-center">
                        {logo.name}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Image Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>
            {mode === 'image-reference'
              ? 'No menu images found. Try adjusting your filters.'
              : 'No AI-generated images found. Generate some images first.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[400px] overflow-y-auto p-1">
          {filteredImages.map((image) => {
            const isSelected = value.includes(image.id);
            const imageUrl = mode === 'image-reference'
              ? (image.cdn_url || image.url)
              : image.image_url;

            return (
              <Card
                key={image.id}
                className={`relative cursor-pointer transition-all overflow-hidden ${
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2'
                    : canSelectMore
                    ? 'hover:ring-2 hover:ring-primary/50'
                    : 'opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canSelectMore || isSelected ? toggleImage(image.id) : null}
              >
                <div className="aspect-square relative">
                  <img
                    src={imageUrl}
                    alt={mode === 'image-reference' ? image.menu_item_name : 'AI image'}
                    className="w-full h-full object-cover"
                  />

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-primary text-xs font-bold rounded-full flex items-center justify-center border-2 border-primary">
                          {value.indexOf(image.id) + 1}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Image info */}
                <div className="p-2 bg-white">
                  <p className="text-xs truncate text-gray-700">
                    {mode === 'image-reference' ? image.menu_item_name : (image.prompt || 'Untitled').substring(0, 30)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Helper text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          {mode === 'image-reference'
            ? '💡 Select 1 or more images (logos or menu items) to use as reference. Gemini will generate a new image inspired by your selections.'
            : '✨ Select 1 or more AI-generated images. With one image, modify it with your prompt. With multiple, blend them into a new composition.'}
        </p>
        <p className="text-gray-500">Click images to select/deselect. Selection order matters!</p>
      </div>
    </div>
  );
}
