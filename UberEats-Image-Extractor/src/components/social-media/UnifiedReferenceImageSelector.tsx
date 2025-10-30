import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, Image, Sparkles, Upload, Building2 } from 'lucide-react';
import api from '@/services/api';

export interface ImageSource {
  id: string;
  sourceType: 'menu' | 'ai' | 'uploaded' | 'logo';
}

interface UnifiedReferenceImageSelectorProps {
  value: ImageSource[];
  onChange: (sources: ImageSource[]) => void;
  min?: number;
  max?: number;
}

export function UnifiedReferenceImageSelector({
  value,
  onChange,
  min = 1,
  max = 10
}: UnifiedReferenceImageSelectorProps) {
  // State for each image source type
  const [menuImages, setMenuImages] = useState<any[]>([]);
  const [aiImages, setAiImages] = useState<any[]>([]);
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [logos, setLogos] = useState<any[]>([]);

  // Loading states
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingUploaded, setLoadingUploaded] = useState(false);
  const [loadingLogos, setLoadingLogos] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<any[]>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState<'menu' | 'ai' | 'uploaded' | 'logos'>('menu');

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    fetchAllImages();
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants');
      if (response.data.success) {
        setRestaurants(response.data.restaurants);
      }
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchAllImages = async () => {
    await Promise.all([
      fetchMenuImages(),
      fetchAIImages(),
      fetchUploadedImages(),
      fetchLogos()
    ]);
  };

  const fetchMenuImages = async () => {
    setLoadingMenu(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (selectedRestaurant !== 'all') {
        params.append('restaurantId', selectedRestaurant);
      }

      const response = await api.get(`/menus/images?${params}`);
      if (response.data.success) {
        setMenuImages(response.data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch menu images:', error);
    } finally {
      setLoadingMenu(false);
    }
  };

  const fetchAIImages = async () => {
    setLoadingAI(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        status: 'completed'
      });

      if (selectedRestaurant !== 'all') {
        params.append('restaurantId', selectedRestaurant);
      }

      const response = await api.get(`/social-media/images?${params}`);
      if (response.data.success) {
        // Filter to only AI-generated (exclude uploaded)
        const aiOnly = (response.data.images || []).filter(
          (img: any) => img.mode !== 'uploaded'
        );
        setAiImages(aiOnly);
      }
    } catch (error) {
      console.error('Failed to fetch AI images:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const fetchUploadedImages = async () => {
    setLoadingUploaded(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        status: 'completed',
        mode: 'uploaded' // Filter to uploaded only
      });

      if (selectedRestaurant !== 'all') {
        params.append('restaurantId', selectedRestaurant);
      }

      const response = await api.get(`/social-media/images?${params}`);
      if (response.data.success) {
        setUploadedImages(response.data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch uploaded images:', error);
    } finally {
      setLoadingUploaded(false);
    }
  };

  const fetchLogos = async () => {
    setLoadingLogos(true);
    try {
      const response = await api.get('/restaurants/logos');
      if (response.data.success) {
        let logoList = response.data.logos || [];

        // Filter by restaurant if selected
        if (selectedRestaurant !== 'all') {
          logoList = logoList.filter((logo: any) => logo.id === selectedRestaurant);
        }

        setLogos(logoList);
      }
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setLoadingLogos(false);
    }
  };

  const toggleImage = (id: string, sourceType: 'menu' | 'ai' | 'uploaded' | 'logo') => {
    const existingIndex = value.findIndex(src => src.id === id);

    if (existingIndex !== -1) {
      // Deselect
      onChange(value.filter(src => src.id !== id));
    } else {
      // Select (if not at max)
      if (value.length < max) {
        onChange([...value, { id, sourceType }]);
      }
    }
  };

  const isSelected = (id: string) => {
    return value.some(src => src.id === id);
  };

  const getSelectionOrder = (id: string) => {
    const index = value.findIndex(src => src.id === id);
    return index !== -1 ? index + 1 : null;
  };

  const selectionCount = value.length;
  const canSelectMore = selectionCount < max;
  const hasMinimum = selectionCount >= min;

  const filterImages = (images: any[], searchField: string) => {
    if (!searchQuery) return images;

    const searchLower = searchQuery.toLowerCase();
    return images.filter(img => {
      const fieldValue = img[searchField] || '';
      return fieldValue.toLowerCase().includes(searchLower);
    });
  };

  const renderImageGrid = (
    images: any[],
    sourceType: 'menu' | 'ai' | 'uploaded' | 'logo',
    loading: boolean,
    getImageUrl: (img: any) => string,
    getImageName: (img: any) => string,
    searchField: string
  ) => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const filteredImages = filterImages(images, searchField);

    if (filteredImages.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>
            {searchQuery
              ? 'No images match your search. Try a different query.'
              : 'No images found. Try adjusting your filters.'}
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[400px] overflow-y-auto p-1">
        {filteredImages.map((image) => {
          const selected = isSelected(image.id);
          const order = getSelectionOrder(image.id);
          const imageUrl = getImageUrl(image);

          return (
            <Card
              key={image.id}
              className={`relative cursor-pointer transition-all overflow-hidden ${
                selected
                  ? 'ring-2 ring-primary ring-offset-2'
                  : canSelectMore
                  ? 'hover:ring-2 hover:ring-primary/50'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => canSelectMore || selected ? toggleImage(image.id, sourceType) : null}
            >
              <div className={`aspect-square relative ${sourceType === 'logo' ? 'bg-white' : 'bg-gray-100'}`}>
                <img
                  src={imageUrl}
                  alt={getImageName(image)}
                  className={`w-full h-full ${sourceType === 'logo' ? 'object-contain p-2' : 'object-cover'}`}
                  onError={(e) => {
                    // Fallback for broken images
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ccc" width="100" height="100"/%3E%3C/svg%3E';
                  }}
                />

                {selected && order && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center relative">
                      <Check className="w-5 h-5 text-white" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-primary text-xs font-bold rounded-full flex items-center justify-center border-2 border-primary">
                        {order}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2 bg-white border-t">
                <p className="text-xs truncate text-gray-700">
                  {getImageName(image)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Selection counter */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Select Reference Images</Label>
        <div className="text-sm">
          <span className={`font-medium ${hasMinimum ? 'text-green-600' : 'text-red-600'}`}>
            {selectionCount}
          </span>
          <span className="text-gray-500"> / {max} selected</span>
          {!hasMinimum && (
            <span className="text-xs text-red-600 ml-2">(min: {min})</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />

        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All restaurants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Restaurants</SelectItem>
            {restaurants.map((restaurant) => (
              <SelectItem key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabbed interface for image sources */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="menu" className="flex items-center gap-1">
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span> ({menuImages.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI</span> ({aiImages.length})
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="flex items-center gap-1">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Uploaded</span> ({uploadedImages.length})
          </TabsTrigger>
          <TabsTrigger value="logos" className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Logos</span> ({logos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-4">
          {renderImageGrid(
            menuImages,
            'menu',
            loadingMenu,
            (img) => img.cdn_url || img.url,
            (img) => img.menu_item_name || 'Menu item',
            'menu_item_name'
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          {renderImageGrid(
            aiImages,
            'ai',
            loadingAI,
            (img) => img.image_url,
            (img) => (img.prompt || 'AI image').substring(0, 30),
            'prompt'
          )}
        </TabsContent>

        <TabsContent value="uploaded" className="mt-4">
          {renderImageGrid(
            uploadedImages,
            'uploaded',
            loadingUploaded,
            (img) => img.image_url,
            (img) => `Uploaded ${new Date(img.created_at).toLocaleDateString()}`,
            'created_at'
          )}
        </TabsContent>

        <TabsContent value="logos" className="mt-4">
          {renderImageGrid(
            logos,
            'logo',
            loadingLogos,
            (logo) => logo.logo_url,
            (logo) => logo.name,
            'name'
          )}
        </TabsContent>
      </Tabs>

      {/* Helper text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          ✨ Select 1 or more images from any source. Gemini will generate a new image
          inspired by your selections, blending elements together.
        </p>
        <p className="text-gray-500">
          Click images to select/deselect. Selection order matters!
        </p>
      </div>
    </div>
  );
}
