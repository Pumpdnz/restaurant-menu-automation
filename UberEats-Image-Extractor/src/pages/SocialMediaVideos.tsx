import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useSocialMedia, VideoJob, VideoMode, VideoStatus } from '@/hooks/useSocialMedia';
import { Video, Plus, Loader2, RefreshCw, Eye, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import api from '@/services/api';

interface Restaurant {
  id: string;
  name: string;
}

export default function SocialMediaVideos() {
  const navigate = useNavigate();
  const { videos, loading, fetchVideos, deleteVideo, refreshJobStatus } = useSocialMedia();

  // Filters
  const [statusFilter, setStatusFilter] = useState<VideoStatus | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<VideoMode | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Restaurants
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

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
    loadVideos();
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [statusFilter, modeFilter, restaurantFilter]);

  // Auto-refresh for in-progress videos
  useEffect(() => {
    const hasInProgressVideos = videos.some(
      (v) => v.status === 'in_progress' || v.status === 'queued'
    );

    if (hasInProgressVideos && !pollingInterval) {
      const interval = setInterval(() => {
        loadVideos();
      }, 10000); // Poll every 10 seconds
      setPollingInterval(interval);
    } else if (!hasInProgressVideos && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [videos]);

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

      // Fetch the video as a blob
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('Failed to download video');

      const blob = await response.blob();

      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `video-${job.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      window.URL.revokeObjectURL(blobUrl);

      toast.success('Video downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Video className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Social Media Videos</h1>
          </div>
          <p className="text-muted-foreground">Manage your AI-generated video content</p>
        </div>
        <Button onClick={() => navigate('/social-media/generate')} size="lg">
          <Plus className="mr-2 w-5 h-5" />
          Generate New Video
        </Button>
      </div>

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
              <Button onClick={() => navigate('/social-media/generate')}>
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
                        <span className="text-sm capitalize">
                          {job.mode.replace(/-/g, ' ')}
                        </span>
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
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, jobId: null, mode: null })}>
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
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
