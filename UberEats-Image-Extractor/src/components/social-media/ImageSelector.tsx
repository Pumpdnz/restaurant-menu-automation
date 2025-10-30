import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Image, Sparkles, Upload, Building2 } from 'lucide-react';
import api from '@/services/api';

interface ImageSelectorProps {
  value: string | null;
  onChange: (imageId: string, sourceType: ImageSource) => void;
  restaurantId?: string; // Optional restaurant filter
}

interface MenuImage {
  id: string;
  url: string;
  cdn_url?: string;
  name?: string;
  item_name?: string;
  restaurant_id?: string;
  image_url?: string;  // For AI images
  prompt?: string;  // For AI images
  logo_url?: string;  // For logos
}

type ImageSource = 'menu' | 'ai' | 'uploaded' | 'logo';

export function ImageSelector({ value, onChange, restaurantId }: ImageSelectorProps) {
  const [sourceType, setSourceType] = useState<ImageSource>('menu');
  const [images, setImages] = useState<MenuImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Counts for all source types (for tab badges)
  const [menuCount, setMenuCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [logoCount, setLogoCount] = useState(0);

  useEffect(() => {
    fetchAllCounts();
  }, [restaurantId]); // Fetch counts when restaurant filter changes

  useEffect(() => {
    fetchImages();
  }, [restaurantId, sourceType]); // Re-fetch when restaurant or source changes

  const fetchAllCounts = async () => {
    try {
      const params = new URLSearchParams();
      if (restaurantId) {
        params.append('restaurantId', restaurantId);
      }

      // Fetch menu count
      const menuResponse = await api.get(`/menus/images?${params.toString()}`);
      if (menuResponse.data.success) {
        setMenuCount((menuResponse.data.images || []).length);
      }

      // Fetch AI images count (exclude uploaded)
      const aiParams = new URLSearchParams(params);
      aiParams.append('status', 'completed');
      const aiResponse = await api.get(`/social-media/images?${aiParams.toString()}`);
      if (aiResponse.data.success) {
        // Filter out uploaded mode client-side
        const aiOnly = (aiResponse.data.images || []).filter((img: any) => img.mode !== 'uploaded');
        setAiCount(aiOnly.length);
      }

      // Fetch uploaded images count
      const uploadedParams = new URLSearchParams(params);
      uploadedParams.append('status', 'completed');
      uploadedParams.append('mode', 'uploaded');
      const uploadedResponse = await api.get(`/social-media/images?${uploadedParams.toString()}`);
      if (uploadedResponse.data.success) {
        setUploadedCount((uploadedResponse.data.images || []).length);
      }

      // Fetch logos count
      const logoResponse = await api.get('/restaurants/logos');
      if (logoResponse.data.success) {
        let logoList = logoResponse.data.logos || [];
        // Filter by restaurant if selected
        if (restaurantId) {
          logoList = logoList.filter((logo: any) => logo.id === restaurantId);
        }
        setLogoCount(logoList.length);
      }
    } catch (error) {
      console.error('Failed to fetch image counts:', error);
    }
  };

  const fetchImages = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      const params = new URLSearchParams();

      if (sourceType === 'menu') {
        // Fetch menu item images
        endpoint = '/menus/images';
        if (restaurantId) {
          params.append('restaurantId', restaurantId);
        }
      } else if (sourceType === 'ai') {
        // Fetch AI-generated images (exclude uploaded)
        endpoint = '/social-media/images';
        params.append('status', 'completed');
        if (restaurantId) {
          params.append('restaurantId', restaurantId);
        }
      } else if (sourceType === 'uploaded') {
        // Fetch uploaded images
        endpoint = '/social-media/images';
        params.append('status', 'completed');
        params.append('mode', 'uploaded');
        if (restaurantId) {
          params.append('restaurantId', restaurantId);
        }
      } else if (sourceType === 'logo') {
        // Fetch restaurant logos
        endpoint = '/restaurants/logos';
      }

      const response = await api.get(`${endpoint}?${params.toString()}`);

      if (response.data.success) {
        // Handle different response formats
        let imageList = response.data.images || response.data.logos || [];

        // For AI images, filter out uploaded mode client-side
        if (sourceType === 'ai') {
          imageList = imageList.filter((img: any) => img.mode !== 'uploaded');
        }

        setImages(imageList);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = images.filter((image) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();

    if (sourceType === 'menu') {
      return (
        image.name?.toLowerCase().includes(searchLower) ||
        image.item_name?.toLowerCase().includes(searchLower)
      );
    } else if (sourceType === 'ai' || sourceType === 'uploaded') {
      return image.prompt?.toLowerCase().includes(searchLower) || image.id.toLowerCase().includes(searchLower);
    } else if (sourceType === 'logo') {
      return image.name?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const getImageUrl = (image: MenuImage) => {
    if (sourceType === 'menu') {
      return image.cdn_url || image.url;
    } else if (sourceType === 'ai' || sourceType === 'uploaded') {
      return image.image_url || '';
    } else if (sourceType === 'logo') {
      return image.logo_url || '';
    }
    return '';
  };

  const getImageLabel = (image: MenuImage) => {
    if (sourceType === 'menu') {
      return image.name || image.item_name || 'Menu item';
    } else if (sourceType === 'ai') {
      return image.prompt ? image.prompt.substring(0, 40) + '...' : 'AI Image';
    } else if (sourceType === 'uploaded') {
      return 'Uploaded Image';
    } else if (sourceType === 'logo') {
      return image.name || 'Logo';
    }
    return '';
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Select Image</Label>

      {/* Source Type Tabs */}
      <Tabs value={sourceType} onValueChange={(value) => setSourceType(value as ImageSource)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="menu" className="flex items-center gap-1">
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span> ({menuCount})
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI</span> ({aiCount})
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="flex items-center gap-1">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Uploaded</span> ({uploadedCount})
          </TabsTrigger>
          <TabsTrigger value="logo" className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Logos</span> ({logoCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={sourceType} className="space-y-4 mt-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder={
                sourceType === 'menu'
                  ? 'Search menu images...'
                  : sourceType === 'ai'
                  ? 'Search by prompt...'
                  : sourceType === 'uploaded'
                  ? 'Search uploaded images...'
                  : 'Search logos...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Images grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
          ) : filteredImages.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'No images found matching your search'
                  : sourceType === 'ai'
                  ? 'No AI-generated images available. Generate some images first.'
                  : sourceType === 'uploaded'
                  ? 'No uploaded images available. Upload some images first.'
                  : sourceType === 'logo'
                  ? 'No restaurant logos available.'
                  : 'No images available'
                }
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto">
              {filteredImages.map((image) => (
                <Card
                  key={image.id}
                  className={`cursor-pointer transition-all hover:shadow-md overflow-hidden ${
                    value === image.id
                      ? 'border-primary border-2 ring-2 ring-primary ring-offset-2'
                      : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => onChange(image.id, sourceType)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={getImageUrl(image)}
                      alt={getImageLabel(image)}
                      className={`w-full h-full ${sourceType === 'logo' ? 'object-contain p-2' : 'object-cover'}`}
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 text-xs text-center text-muted-foreground truncate bg-muted/50">
                    {getImageLabel(image)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
