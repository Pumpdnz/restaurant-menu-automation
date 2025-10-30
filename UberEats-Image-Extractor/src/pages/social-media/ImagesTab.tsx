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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Image as ImageIcon, Plus, Loader2, RefreshCw, Eye, Trash2, Download, ArrowLeft, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import api from '@/services/api';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// Import image generation components
import { ImageModeSelector } from '@/components/social-media/ImageModeSelector';
import { ImageModelSelector } from '@/components/social-media/ImageModelSelector';
import { ImageConfigForm } from '@/components/social-media/ImageConfigForm';
import { UnifiedReferenceImageSelector, ImageSource } from '@/components/social-media/UnifiedReferenceImageSelector';
import { VideoPromptInput } from '@/components/social-media/VideoPromptInput';
import { FileUploadDropzone } from '@/components/social-media/FileUploadDropzone';

interface ImagesTabProps {
  onError?: (error: Error) => void;
}

type ViewMode = 'list' | 'create' | 'preview';
type ImageMode = 'uploaded' | 'text-to-image' | 'reference-images';
type ImageStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

interface ImageJob {
  id: string;
  mode: ImageMode;
  prompt: string | null;
  status: ImageStatus;
  progress: number;
  image_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  image_config: {
    aspectRatio: string;
  };
  reference_image_ids: string[] | null;
  created_at: string;
  width: number | null;
  height: number | null;
}

interface Restaurant {
  id: string;
  name: string;
}

const ImagesTab: React.FC<ImagesTabProps> = ({ onError }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageJob[]>([]);

  // List view - Filters
  const [statusFilter, setStatusFilter] = useState<ImageStatus | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<ImageMode | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Restaurants
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  // Create view - Form state
  const [mode, setMode] = useState<ImageMode>('text-to-image');
  const [prompt, setPrompt] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('all');
  const [imageConfig, setImageConfig] = useState<{ aspectRatio: string }>({
    aspectRatio: '16:9',
  });
  const [referenceSources, setReferenceSources] = useState<ImageSource[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Preview dialog
  const [previewJob, setPreviewJob] = useState<ImageJob | null>(null);
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

  // Fetch restaurants on mount
  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (currentView === 'list') {
      loadImages();
    }
  }, [currentView, statusFilter, modeFilter, restaurantFilter]);

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

  const loadImages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (modeFilter !== 'all') params.append('mode', modeFilter);
      if (restaurantFilter !== 'all') params.append('restaurantId', restaurantFilter);

      const response = await api.get(`/social-media/images?${params}`);

      if (response.data.success) {
        setImages(response.data.images || []);
      }
    } catch (error) {
      console.error('Failed to load images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (job: ImageJob) => {
    setDeleteConfirm({
      open: true,
      jobId: job.id,
      mode: job.mode,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.jobId) return;

    try {
      const response = await api.delete(`/social-media/images/${deleteConfirm.jobId}`);

      if (response.data.success) {
        toast.success('Image deleted successfully');
        setDeleteConfirm({ open: false, jobId: null, mode: null });
        await loadImages();
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleViewPreview = (job: ImageJob) => {
    setPreviewJob(job);
    setShowPreview(true);
  };

  const handleDownload = async (job: ImageJob) => {
    if (!job.image_url) {
      toast.error('No image available to download');
      return;
    }

    try {
      toast.info('Downloading image...');

      const response = await fetch(job.image_url);
      if (!response.ok) throw new Error('Failed to download image');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `image-${job.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);

      toast.success('Image downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download image');
    }
  };

  const handleCreateImage = () => {
    setMode('text-to-image'); // Default to text-to-image mode
    setCurrentView('create');
  };

  const handleUploadImage = () => {
    setMode('uploaded'); // Set to upload mode
    setCurrentView('create');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    // Reset form
    setPrompt('');
    setReferenceSources([]);
    setUploadedFiles([]);
    setSelectedRestaurantId('all');
    // Refetch images
    loadImages();
  };

  const handleGenerate = async () => {
    // Validation
    if (mode === 'uploaded') {
      if (uploadedFiles.length === 0) {
        toast.error('Validation error', {
          description: 'Please select at least one file to upload',
        });
        return;
      }

      // Handle multiple file uploads
      setIsGenerating(true);
      try {
        let successCount = 0;
        let errorCount = 0;

        // Upload files one by one
        for (const file of uploadedFiles) {
          try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('aspectRatio', imageConfig.aspectRatio);
            if (selectedRestaurantId !== 'all') {
              formData.append('restaurantId', selectedRestaurantId);
            }

            const response = await api.post('/social-media/images/upload', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            if (response.data.success) {
              successCount++;
            }
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            errorCount++;
          }
        }

        // Show results
        if (successCount > 0 && errorCount === 0) {
          toast.success(`Successfully uploaded ${successCount} image${successCount > 1 ? 's' : ''}!`);
          handleBackToList();
        } else if (successCount > 0 && errorCount > 0) {
          toast.warning(`Uploaded ${successCount} image${successCount > 1 ? 's' : ''}, ${errorCount} failed`);
          handleBackToList();
        } else {
          toast.error('All uploads failed', {
            description: 'Please try again',
          });
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error('Upload failed', {
          description: error.message || 'An error occurred',
        });
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Validation for AI generation modes
    if (mode === 'text-to-image' && !prompt.trim()) {
      toast.error('Validation error', {
        description: 'Please enter a prompt',
      });
      return;
    }

    if (mode === 'reference-images') {
      if (referenceSources.length === 0) {
        toast.error('Validation error', {
          description: 'Please select at least 1 reference image',
        });
        return;
      }
      if (!prompt.trim()) {
        toast.error('Validation error', {
          description: 'Please enter a prompt',
        });
        return;
      }
    }

    setIsGenerating(true);
    try {
      const requestData: any = {
        mode,
        imageConfig,
      };

      if (mode === 'text-to-image') {
        requestData.prompt = prompt;
      }

      if (mode === 'reference-images') {
        requestData.prompt = prompt;
        requestData.referenceSources = referenceSources;
      }

      if (selectedRestaurantId !== 'all') {
        requestData.restaurantId = selectedRestaurantId;
      }

      const response = await api.post('/social-media/images/generate', requestData);

      if (response.data.success) {
        toast.success('Image generated successfully!');
        handleBackToList();
      }
    } catch (error: any) {
      console.error('Failed to generate image:', error);
      toast.error('Generation failed', {
        description: error.response?.data?.error || 'An error occurred',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusBadge = (status: ImageStatus) => {
    const variants: Record<ImageStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      queued: 'secondary',
      in_progress: 'default',
      completed: 'outline',
      failed: 'destructive',
    };

    return (
      <Badge variant={variants[status]}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Render create view
  if (currentView === 'create') {
    return (
      <div className="py-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-medium">Generate New Image</h3>
            <p className="text-sm text-muted-foreground">
              Create AI-powered images using Google Gemini 2.5 Flash Image
            </p>
          </div>
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Images
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Form controls */}
          <div className="lg:col-span-2 space-y-6">
            <ImageModeSelector value={mode} onChange={setMode} />

            {/* Hide AI-specific components for upload mode */}
            {mode !== 'uploaded' && (
              <>
                <ImageModelSelector />
                <ImageConfigForm config={imageConfig} onChange={setImageConfig} />
              </>
            )}

            {/* Mode-specific inputs */}
            {mode === 'uploaded' && (
              <>
                {/* Restaurant selector for upload mode */}
                <Card className="p-6">
                  <div className="space-y-2">
                    <Label htmlFor="restaurant-select-upload">Restaurant (Optional)</Label>
                    <Select
                      value={selectedRestaurantId}
                      onValueChange={setSelectedRestaurantId}
                      disabled={loadingRestaurants}
                    >
                      <SelectTrigger id="restaurant-select-upload">
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
                      Associate this image with a specific restaurant
                    </p>
                  </div>
                </Card>

                <FileUploadDropzone
                  files={uploadedFiles}
                  onChange={setUploadedFiles}
                  multiple={true}
                  maxFiles={10}
                  accept="image/*"
                />
              </>
            )}

            {mode === 'reference-images' && (
              <Card className="p-6">
                <UnifiedReferenceImageSelector
                  value={referenceSources}
                  onChange={setReferenceSources}
                  min={1}
                  max={10}
                />
              </Card>
            )}

            {(mode === 'text-to-image' || mode === 'reference-images') && (
              <>
                {/* Restaurant selector for AI generation modes */}
                <Card className="p-6">
                  <div className="space-y-2">
                    <Label htmlFor="restaurant-select-ai">Restaurant (Optional)</Label>
                    <Select
                      value={selectedRestaurantId}
                      onValueChange={setSelectedRestaurantId}
                      disabled={loadingRestaurants}
                    >
                      <SelectTrigger id="restaurant-select-ai">
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
                      Associate this image with a specific restaurant
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <VideoPromptInput
                    label={mode === 'text-to-image' ? 'Image Prompt' : 'Generation Prompt'}
                    value={prompt}
                    onChange={setPrompt}
                    placeholder={
                      mode === 'text-to-image'
                        ? 'Describe the image... e.g., "Professional food photography of a gourmet burger with fresh ingredients on a rustic wooden board, warm lighting, shallow depth of field"'
                        : 'Describe how to blend the reference images... e.g., "Create a vibrant composition inspired by these dishes, emphasizing colors and textures"'
                    }
                    helperText={
                      mode === 'text-to-image'
                        ? 'Describe the image you want to generate'
                        : 'Describe the transformation or composition style'
                    }
                    required
                    rows={6}
                    maxLength={500}
                  />
                </Card>
              </>
            )}

            <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  {mode === 'uploaded' ? 'Uploading...' : 'Generating Image...'}
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 w-5 h-5" />
                  {mode === 'uploaded' ? 'Upload Image' : 'Generate Image'}
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
                {mode !== 'uploaded' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">For Best Prompts:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Be specific about composition</li>
                      <li>Mention photography style</li>
                      <li>Describe lighting (warm, soft, dramatic)</li>
                      <li>Include color preferences</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Generation Time:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Gemini: 10-30 seconds</li>
                    <li>Cost: ~$0.04 per image</li>
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
                  {mode === 'uploaded' &&
                    'Upload an existing image directly. No AI generation involved - perfect for importing images you already have.'}
                  {mode === 'text-to-image' &&
                    'Generate a completely new image from your text description using Google Gemini AI. Great for creating original visual content.'}
                  {mode === 'reference-images' &&
                    'Blend multiple images together or use a single image as a reference. Select from menu images, AI-generated images, uploaded images, or restaurant logos. Gemini will create a new image inspired by your selections.'}
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
          <h3 className="text-lg font-medium">AI Images</h3>
          <p className="text-sm text-muted-foreground">Manage your AI-generated and uploaded images</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUploadImage} variant="outline" className="gap-1">
            <Upload className="h-4 w-4" />
            Upload Image
          </Button>
          <Button onClick={handleCreateImage} className="gap-1">
            <Plus className="h-4 w-4" />
            Generate New Image
          </Button>
        </div>
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
                onValueChange={(value) => setStatusFilter(value as ImageStatus | 'all')}
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
                onValueChange={(value) => setModeFilter(value as ImageMode | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="text-to-image">Text to Image</SelectItem>
                  <SelectItem value="reference-images">Reference Images</SelectItem>
                  <SelectItem value="image-reference">Image Reference (Legacy)</SelectItem>
                  <SelectItem value="remix">Remix (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={loadImages} variant="outline" disabled={loading} className="w-full">
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

      {/* Images table */}
      <Card>
        <CardHeader>
          <CardTitle>Images ({images.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && images.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No images found</h3>
              <p className="text-muted-foreground mb-4">
                {statusFilter !== 'all' || modeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by generating your first image'}
              </p>
              <Button onClick={handleCreateImage}>
                <Plus className="mr-2 w-4 h-4" />
                Generate Image
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
                    <TableHead>Aspect Ratio</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {images.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        {job.thumbnail_url ? (
                          <img
                            src={job.thumbnail_url}
                            alt="Thumbnail"
                            className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-75"
                            onClick={() => handleViewPreview(job)}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{job.mode.replace(/-/g, ' ')}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-sm">{job.image_config.aspectRatio}</TableCell>
                      <TableCell className="text-sm">
                        {job.width && job.height ? `${job.width}×${job.height}` : '—'}
                      </TableCell>
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
                          {job.status === 'completed' && job.image_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(job)}
                              title="Download image"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(job)}
                            className="text-destructive hover:text-destructive"
                            title="Delete image"
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Image Details</DialogTitle>
            <DialogDescription>View and download your image</DialogDescription>
          </DialogHeader>
          {previewJob && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(previewJob.status)}
              </div>

              {previewJob.image_url && (
                <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={previewJob.image_url}
                    alt="Generated image"
                    className="w-full max-h-[60vh] object-contain"
                  />
                </div>
              )}

              {previewJob.prompt && (
                <div>
                  <p className="text-sm font-medium mb-1">Prompt:</p>
                  <p className="text-sm text-muted-foreground">{previewJob.prompt}</p>
                </div>
              )}

              {previewJob.error_message && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive">{previewJob.error_message}</p>
                </div>
              )}
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
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
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
              Delete Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImagesTab;
