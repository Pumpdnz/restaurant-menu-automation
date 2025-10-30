import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';

export type VideoMode = 'image-to-video' | 'text-to-video' | 'generated-image-to-video';
export type SoraModel = 'sora-2' | 'sora-2-pro';
export type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export interface VideoConfig {
  size: string;
  seconds: number;
}

export interface VoiceConfig {
  enabled: boolean;
  script: string;
  voiceId: string;
  voiceModel: string;
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  language?: string;
}

export interface GenerateVideoRequest {
  mode: VideoMode;
  prompt: string;
  imagePrompt?: string;
  inputSource?: {
    type: 'database';
    imageId: string;
  };
  restaurantId?: string;
  menuId?: string;
  menuItemId?: string;
  soraModel: SoraModel;
  videoConfig: VideoConfig;
  geminiConfig?: {
    aspectRatio?: string;
  };
  voiceConfig?: VoiceConfig;
}

export interface VideoJob {
  id: string;
  organisation_id: string;
  restaurant_id?: string;
  menu_id?: string;
  menu_item_id?: string;
  mode: VideoMode;
  prompt: string;
  image_prompt?: string;
  source_image_id?: string;
  source_image_url?: string;
  generated_image_url?: string;
  sora_video_id?: string;
  sora_model: SoraModel;
  status: VideoStatus;
  progress: number;
  video_url?: string;
  thumbnail_url?: string;
  spritesheet_url?: string;
  voice_enabled: boolean;
  voice_script?: string;
  voice_model?: string;
  voice_id?: string;
  voice_settings?: any;
  elevenlabs_audio_id?: string;
  audio_url?: string;
  final_video_url?: string;
  video_config: VideoConfig;
  gemini_config?: any;
  error_message?: string;
  retry_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ListVideosFilters {
  restaurantId?: string;
  status?: VideoStatus;
  mode?: VideoMode;
  limit?: number;
  offset?: number;
}

export interface ListVideosResponse {
  success: boolean;
  videos: VideoJob[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export function useSocialMedia() {
  const [videos, setVideos] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  // Generate a new video
  const generateVideo = useCallback(async (config: GenerateVideoRequest): Promise<VideoJob> => {
    setIsGenerating(true);
    try {
      const response = await api.post('/social-media/generate', config);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to generate video');
      }

      toast.success('Video generation started!', {
        description: 'Your video is being generated. This may take a few minutes.',
      });

      // Navigate to videos list
      navigate('/social-media/videos');

      return response.data.job;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate video';
      toast.error('Generation failed', {
        description: errorMessage,
      });
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [navigate]);

  // Fetch list of videos
  const fetchVideos = useCallback(async (filters: ListVideosFilters = {}): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.restaurantId) params.append('restaurantId', filters.restaurantId);
      if (filters.status) params.append('status', filters.status);
      if (filters.mode) params.append('mode', filters.mode);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await api.get(`/social-media/videos?${params.toString()}`);

      if (response.data.success) {
        setVideos(response.data.videos || []);
      }
    } catch (error: any) {
      toast.error('Failed to fetch videos', {
        description: error.response?.data?.error || error.message,
      });
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get job status
  const getJobStatus = useCallback(async (jobId: string): Promise<VideoJob | null> => {
    try {
      const response = await api.get(`/social-media/videos/${jobId}/status`);

      if (response.data.success) {
        return response.data.status;
      }
      return null;
    } catch (error: any) {
      console.error('Failed to get job status:', error);
      return null;
    }
  }, []);

  // Refresh job status (manual refresh)
  const refreshJobStatus = useCallback(async (jobId: string): Promise<VideoJob | null> => {
    try {
      const response = await api.post(`/social-media/videos/${jobId}/refresh`);

      if (response.data.success) {
        toast.success('Status refreshed');
        return response.data.job;
      }
      return null;
    } catch (error: any) {
      toast.error('Failed to refresh status', {
        description: error.response?.data?.error || error.message,
      });
      return null;
    }
  }, []);

  // Delete video (confirmation handled by UI component)
  const deleteVideo = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await api.delete(`/social-media/videos/${jobId}`);

      if (response.data.success) {
        toast.success('Video deleted successfully');
        // Refresh the list
        await fetchVideos();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error('Failed to delete video', {
        description: error.response?.data?.error || error.message,
      });
      return false;
    }
  }, [fetchVideos]);

  // Get full video details
  const getVideoDetails = useCallback(async (jobId: string): Promise<VideoJob | null> => {
    try {
      const response = await api.get(`/social-media/videos/${jobId}`);

      if (response.data.success) {
        return response.data.video;
      }
      return null;
    } catch (error: any) {
      toast.error('Failed to fetch video details', {
        description: error.response?.data?.error || error.message,
      });
      return null;
    }
  }, []);

  return {
    videos,
    loading,
    isGenerating,
    generateVideo,
    fetchVideos,
    getJobStatus,
    refreshJobStatus,
    deleteVideo,
    getVideoDetails,
  };
}
