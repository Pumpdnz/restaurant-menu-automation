import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VideoJobStatus } from '@/components/social-media/VideoJobStatus';
import { VideoPreview } from '@/components/social-media/VideoPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSocialMedia, VideoJob, VideoMode, VideoConfig, SoraModel, VideoStatus } from '@/hooks/useSocialMedia';
import { Video, Plus, Loader2, RefreshCw, Eye, Trash2, Download, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import api from '@/services/api';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ModeSelector } from '@/components/social-media/ModeSelector';
import { VideoPromptInput } from '@/components/social-media/VideoPromptInput';
import { ModelSelector } from '@/components/social-media/ModelSelector';
import { VideoConfigForm } from '@/components/social-media/VideoConfigForm';
import { ImageSelector } from '@/components/social-media/ImageSelector';

interface VideosTabProps {
  onError?: (error: Error) => void;
}

type ViewMode = 'list' | 'create' | 'preview';

interface Restaurant {
  id: string;
  name: string;
}

const VideosTab: React.FC<VideosTabProps> = ({ onError }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const { videos, loading, fetchVideos, deleteVideo, refreshJobStatus, generateVideo, isGenerating } =
    useSocialMedia();

  // List view - Filters
  const [statusFilter, setStatusFilter] = useState<VideoStatus | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<VideoMode | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Restaurants
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  // Create view - Form state
  const [mode, setMode] = useState<VideoMode>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageSourceType, setImageSourceType] = useState<'menu' | 'ai' | 'uploaded' | 'logo'>('menu');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('all'); // For assigning video to restaurant
  const [imageFilterRestaurantId, setImageFilterRestaurantId] = useState<string>('all'); // For filtering images in ImageSelector
  const [soraModel, setSoraModel] = useState<SoraModel>('sora-2');
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    size: '1280x720',
    seconds: 8,
  });

  // Handler for image selection that updates both ID and source type
  const handleImageSelect = (imageId: string, sourceType: 'menu' | 'ai' | 'uploaded' | 'logo') => {
    setSelectedImageId(imageId);
    setImageSourceType(sourceType);
  };

  // Preview dialog
  const [previewJob, setPreviewJob] = useState<VideoJob | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    jobId: string | null;
    mode: string | null;
  }>({
    open: false,
    jobId: null,
    mode: null,
  });

  // Auto-polling for in-progress jobs
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch restaurants on mount
  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (currentView === 'list') {
      loadVideos();
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [currentView, statusFilter, modeFilter, restaurantFilter]);

  // Auto-refresh for in-progress videos
  useEffect(() => {
    if (currentView !== 'list') return;

    const hasInProgressVideos = videos.some((v) => v.status === 'in_progress' || v.status === 'queued');

    if (hasInProgressVideos && !pollingInterval) {
      const interval = setInterval(() => {
        loadVideos();
      }, 10000);
      setPollingInterval(interval);
    } else if (!hasInProgressVideos && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [videos, currentView]);

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

  const loadVideos = async () => {
    await fetchVideos({
      status: statusFilter === 'all' ? undefined : statusFilter,
      mode: modeFilter === 'all' ? undefined : modeFilter,
      restaurantId: restaurantFilter === 'all' ? undefined : restaurantFilter,
      limit: 50,
    });
  };

  const handleRefresh = async (job: VideoJob) => {
    await refreshJobStatus(job.id);
    await loadVideos();
  };

  const handleDeleteClick = (job: VideoJob) => {
    setDeleteConfirm({
      open: true,
      jobId: job.id,
      mode: job.mode,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.jobId) return;

    const success = await deleteVideo(deleteConfirm.jobId);
    if (success) {
      setDeleteConfirm({ open: false, jobId: null, mode: null });
      await loadVideos();
    }
  };

  const handleViewPreview = (job: VideoJob) => {
    setPreviewJob(job);
    setShowPreview(true);
  };

  const handleDownload = async (job: VideoJob) => {
    const videoUrl = job.voice_enabled && job.final_video_url ? job.final_video_url : job.video_url;

    if (!videoUrl) {
      toast.error('No video available to download');
      return;
    }

    try {
      toast.info('Downloading video...');

      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('Failed to download video');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `video-${job.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);

      toast.success('Video downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
    }
  };

  const handleCreateVideo = () => {
    setCurrentView('create');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    // Reset form
    setPrompt('');
    setImagePrompt('');
    setSelectedImageId(null);
    setImageSourceType('menu');
    setSelectedRestaurantId('all');
    setImageFilterRestaurantId('all');
    // Refetch videos
    loadVideos();
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
                sourceType: imageSourceType,
              }
            : undefined,
        restaurantId: selectedRestaurantId !== 'all' ? selectedRestaurantId : undefined,
        soraModel,
        videoConfig,
      });

      // Success - go back to list
      handleBackToList();
    } catch (error) {
      console.error('Failed to generate video:', error);
    }
  };

  // Render create view
  if (currentView === 'create') {
    return (
      <div className="py-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-medium">Generate New Video</h3>
            <p className="text-sm text-muted-foreground">
              Create AI-powered videos from text, images, or a combination of both using OpenAI Sora 2
            </p>
          </div>
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Videos
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Form controls */}
          <div className="lg:col-span-2 space-y-6">
            <ModeSelector value={mode} onChange={setMode} />
            <ModelSelector value={soraModel} onChange={setSoraModel} />
            <VideoConfigForm config={videoConfig} onChange={setVideoConfig} />

            {mode === 'image-to-video' && (
              <Card className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Filter Images by Restaurant (Optional)</Label>
                  <Select value={imageFilterRestaurantId} onValueChange={setImageFilterRestaurantId}>
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
                  <p className="text-xs text-muted-foreground">
                    Filter available images by restaurant
                  </p>
                </div>

                <ImageSelector
                  value={selectedImageId}
                  onChange={handleImageSelect}
                  restaurantId={imageFilterRestaurantId !== 'all' ? imageFilterRestaurantId : undefined}
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

            {/* Restaurant assignment selector - visible for ALL modes */}
            <Card className="p-6">
              <div className="space-y-2">
                <Label htmlFor="restaurant-assign">Restaurant (Optional)</Label>
                <Select
                  value={selectedRestaurantId}
                  onValueChange={setSelectedRestaurantId}
                  disabled={loadingRestaurants}
                >
                  <SelectTrigger id="restaurant-assign">
                    <SelectValue placeholder="Select a restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">No specific restaurant</SelectItem>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Associate this video with a specific restaurant
                </p>
              </div>
            </Card>

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
                  mode === 'text-to-video' ? 'Describe the complete scene and camera movement' : 'Describe the motion and camera movement'
                }
                required
                rows={6}
                maxLength={500}
              />
            </Card>

            <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="w-full">
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
                    "First, an AI image is generated from your image prompt. Then, it's animated based on your video prompt. Great for creating entirely new visual content."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Videos</h3>
          <p className="text-sm text-muted-foreground">Manage your AI-generated video content</p>
        </div>
        <Button onClick={handleCreateVideo} className="gap-1">
          <Plus className="h-4 w-4" />
          Generate New Video
        </Button>
      </div>

      <Separator />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Restaurant</label>
              <Select
                value={restaurantFilter}
                onValueChange={setRestaurantFilter}
                disabled={loadingRestaurants}
              >
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as VideoStatus | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <Select
                value={modeFilter}
                onValueChange={(value) => setModeFilter(value as VideoMode | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="image-to-video">Image to Video</SelectItem>
                  <SelectItem value="text-to-video">Text to Video</SelectItem>
                  <SelectItem value="generated-image-to-video">AI Image to Video</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={loadVideos} variant="outline" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 w-4 h-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Videos table */}
      <Card>
        <CardHeader>
          <CardTitle>Videos ({videos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && videos.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No videos found</h3>
              <p className="text-muted-foreground mb-4">
                {statusFilter !== 'all' || modeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by generating your first video'}
              </p>
              <Button onClick={handleCreateVideo}>
                <Plus className="mr-2 w-4 h-4" />
                Generate Video
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        {job.thumbnail_url ? (
                          <img
                            src={job.thumbnail_url}
                            alt="Thumbnail"
                            className="w-16 h-9 object-cover rounded cursor-pointer hover:opacity-75"
                            onClick={() => handleViewPreview(job)}
                          />
                        ) : (
                          <div className="w-16 h-9 bg-muted rounded flex items-center justify-center">
                            <Video className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{job.mode.replace(/-/g, ' ')}</span>
                      </TableCell>
                      <TableCell>
                        <VideoJobStatus
                          status={job.status}
                          progress={job.progress}
                          errorMessage={job.error_message}
                          showProgress={false}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{job.sora_model}</TableCell>
                      <TableCell className="text-sm">{job.video_config.size}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPreview(job)}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {job.status === 'completed' && job.video_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(job)}
                              title="Download video"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          {(job.status === 'in_progress' || job.status === 'queued') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRefresh(job)}
                              title="Refresh status"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(job)}
                            className="text-destructive hover:text-destructive"
                            title="Delete video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader>
            <DialogTitle>Video Details</DialogTitle>
            <DialogDescription>View and download your generated video</DialogDescription>
          </DialogHeader>
          {previewJob && (
            <div className="space-y-4">
              <VideoJobStatus
                status={previewJob.status}
                progress={previewJob.progress}
                errorMessage={previewJob.error_message}
              />
              <VideoPreview job={previewJob} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, jobId: null, mode: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this video? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, jobId: null, mode: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideosTab;
