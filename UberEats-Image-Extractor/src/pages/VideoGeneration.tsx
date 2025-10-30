import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ModeSelector } from '@/components/social-media/ModeSelector';
import { VideoPromptInput } from '@/components/social-media/VideoPromptInput';
import { ModelSelector } from '@/components/social-media/ModelSelector';
import { VideoConfigForm } from '@/components/social-media/VideoConfigForm';
import { ImageSelector } from '@/components/social-media/ImageSelector';
import { useSocialMedia, VideoMode, SoraModel, VideoConfig } from '@/hooks/useSocialMedia';
import { Loader2, Video } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

interface Restaurant {
  id: string;
  name: string;
}

export default function VideoGeneration() {
  // Form state
  const [mode, setMode] = useState<VideoMode>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('all');
  const [soraModel, setSoraModel] = useState<SoraModel>('sora-2');
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    size: '1280x720',
    seconds: 8,
  });

  // Restaurant list
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  const { generateVideo, isGenerating } = useSocialMedia();

  // Fetch restaurants on mount
  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoadingRestaurants(true);
    try {
      const response = await api.get('/restaurants');
      if (response.data.success && response.data.restaurants) {
        setRestaurants(response.data.restaurants);
      }
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const handleGenerate = async () => {
    // Validation
    if (!prompt.trim()) {
      toast.error('Validation error', {
        description: 'Please enter a video prompt',
      });
      return;
    }

    if (mode === 'image-to-video' && !selectedImageId) {
      toast.error('Validation error', {
        description: 'Please select an image',
      });
      return;
    }

    if (mode === 'generated-image-to-video' && !imagePrompt.trim()) {
      toast.error('Validation error', {
        description: 'Please enter an image prompt for AI generation',
      });
      return;
    }

    try {
      await generateVideo({
        mode,
        prompt,
        imagePrompt: mode === 'generated-image-to-video' ? imagePrompt : undefined,
        inputSource:
          mode === 'image-to-video' && selectedImageId
            ? {
                type: 'database',
                imageId: selectedImageId,
              }
            : undefined,
        restaurantId: selectedRestaurantId !== 'all' ? selectedRestaurantId : undefined,
        soraModel,
        videoConfig,
      });
    } catch (error) {
      // Error handling is done in the hook
      console.error('Failed to generate video:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Video className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Generate Social Media Video</h1>
        </div>
        <p className="text-muted-foreground">
          Create AI-powered videos from text, images, or a combination of both using OpenAI Sora 2
        </p>
      </div>

      {/* Main form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Form controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Generation Mode */}
          <ModeSelector value={mode} onChange={setMode} />

          {/* Model Selection */}
          <ModelSelector value={soraModel} onChange={setSoraModel} />

          {/* Video Configuration */}
          <VideoConfigForm config={videoConfig} onChange={setVideoConfig} />

          {/* Conditional inputs based on mode */}
          {mode === 'image-to-video' && (
            <Card className="p-6 space-y-4">
              {/* Restaurant selector for filtering images */}
              <div className="space-y-2">
                <Label>Filter by Restaurant (Optional)</Label>
                <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                  <SelectTrigger>
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

              {/* Image selector */}
              <ImageSelector
                value={selectedImageId}
                onChange={setSelectedImageId}
                restaurantId={selectedRestaurantId !== 'all' ? selectedRestaurantId : undefined}
              />
            </Card>
          )}

          {mode === 'generated-image-to-video' && (
            <Card className="p-6">
              <VideoPromptInput
                label="Image Prompt"
                value={imagePrompt}
                onChange={setImagePrompt}
                placeholder="Describe the image to generate... e.g., 'Professional food photography of a gourmet burger with fresh ingredients on a rustic wooden board'"
                helperText="Describe what image the AI should generate"
                required
                rows={4}
                maxLength={500}
              />
            </Card>
          )}

          {/* Video Prompt (always shown) */}
          <Card className="p-6">
            <VideoPromptInput
              label={mode === 'text-to-video' ? 'Video Prompt' : 'Video Animation Prompt'}
              value={prompt}
              onChange={setPrompt}
              placeholder={
                mode === 'text-to-video'
                  ? 'Describe the video to generate... e.g., "A cozy coffee shop interior with warm lighting, customers in background, camera slowly pans across the space"'
                  : 'Describe how to animate the image... e.g., "Camera slowly zooms in, steam rises from the hot food, bokeh effect in background"'
              }
              helperText={
                mode === 'text-to-video'
                  ? 'Describe the complete scene and camera movement'
                  : 'Describe the motion and camera movement'
              }
              required
              rows={6}
              maxLength={500}
            />
          </Card>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Generating Video...
              </>
            ) : (
              <>
                <Video className="mr-2 w-5 h-5" />
                Generate Video
              </>
            )}
          </Button>
        </div>

        {/* Right column - Info and tips */}
        <div className="space-y-6">
          {/* Quick tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Tips</CardTitle>
              <CardDescription>Get the best results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">For Best Prompts:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Describe camera movement (zoom, pan, orbit)</li>
                  <li>Include lighting details (warm, soft, dramatic)</li>
                  <li>Mention specific actions or effects</li>
                  <li>Keep prompts clear and concise</li>
                </ul>
              </div>

              {mode === 'generated-image-to-video' && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">AI Image Generation:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Be specific about composition</li>
                    <li>Mention photography style</li>
                    <li>Describe colors and mood</li>
                    <li>Static subjects work best</li>
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Generation Time:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Sora 2: 2-5 minutes</li>
                  <li>Sora 2 Pro: 5-15 minutes</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Mode explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About This Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {mode === 'image-to-video' &&
                  'Use an existing menu image from your database as the first frame. The AI will animate it based on your prompt.'}
                {mode === 'text-to-video' &&
                  'Generate a complete video from just a text description. Best for restaurant interiors, ambiance, and conceptual content.'}
                {mode === 'generated-image-to-video' &&
                  'First, an AI image is generated from your image prompt. Then, it\'s animated based on your video prompt. Great for creating entirely new visual content.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
