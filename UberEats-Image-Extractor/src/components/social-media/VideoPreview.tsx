import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoJob } from '@/hooks/useSocialMedia';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VideoPreviewProps {
  job: VideoJob;
}

export function VideoPreview({ job }: VideoPreviewProps) {
  const videoUrl = job.voice_enabled && job.final_video_url ? job.final_video_url : job.video_url;
  const hasVideo = Boolean(videoUrl);
  const hasVoiceOver = job.voice_enabled && job.final_video_url;
  const [isDownloading, setIsDownloading] = useState(false);

  // Detect if video is portrait based on size
  const [width, height] = job.video_config.size.split('x').map(Number);
  const isPortrait = height > width;

  const handleDownload = async () => {
    if (!videoUrl) return;

    setIsDownloading(true);
    try {
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
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Video Preview</CardTitle>
          {hasVideo && (
            <Button onClick={handleDownload} size="sm" variant="outline" disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video player or thumbnail */}
        {hasVideo ? (
          <div className={`relative rounded-lg overflow-hidden ${isPortrait ? 'mx-auto w-fit' : 'bg-black'}`}>
            <video
              src={videoUrl}
              controls
              className={isPortrait ? 'max-h-[500px] h-auto rounded-lg' : 'w-full'}
              poster={job.thumbnail_url}
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
            {hasVoiceOver && (
              <Badge className="absolute top-2 right-2" variant="secondary">
                With Voice-Over
              </Badge>
            )}
          </div>
        ) : job.thumbnail_url ? (
          <div className={`relative rounded-lg overflow-hidden ${isPortrait ? 'mx-auto w-fit' : ''}`}>
            <img
              src={job.thumbnail_url}
              alt="Video thumbnail"
              className={isPortrait ? 'max-h-[500px] h-auto rounded-lg' : 'w-full'}
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Video preview will appear here</p>
            </div>
          </div>
        )}

        {/* Video metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Mode:</span>
            <div className="font-medium capitalize">{job.mode.replace(/-/g, ' ')}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Model:</span>
            <div className="font-medium">{job.sora_model}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Size:</span>
            <div className="font-medium">{job.video_config.size}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <div className="font-medium">{job.video_config.seconds}s</div>
          </div>
        </div>

        {/* Prompt */}
        {job.prompt && (
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Prompt:</span>
            <p className="text-sm bg-muted p-3 rounded-md">{job.prompt}</p>
          </div>
        )}

        {/* Image prompt (Mode 3) */}
        {job.image_prompt && (
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Image Prompt:</span>
            <p className="text-sm bg-muted p-3 rounded-md">{job.image_prompt}</p>
          </div>
        )}

        {/* Generated image (Mode 3) */}
        {job.generated_image_url && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Generated Image:</span>
            <img
              src={job.generated_image_url}
              alt="AI Generated"
              className="w-full max-w-md rounded-lg border"
            />
          </div>
        )}

        {/* Voice-over info */}
        {job.voice_enabled && job.voice_script && (
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Voice-Over Script:</span>
            <p className="text-sm bg-muted p-3 rounded-md">{job.voice_script}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
