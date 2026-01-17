# UI/UX Components Plan

## Overview

The UI will be built using React + TypeScript, integrating seamlessly with the existing UberEats-Image-Extractor application. Components will follow the existing design patterns and use the established component library.

## Page Structure

```
Social Media Section
├── /social-media/videos          → VideoList page (all videos)
├── /social-media/generate         → VideoGeneration page (create new)
└── /social-media/videos/:id       → VideoDetail page (view single)
```

## Navigation Integration

Add to existing navigation:

```typescript
// In App.tsx or navigation config
{
  path: '/social-media',
  label: 'Social Media',
  icon: <VideoIcon />,
  children: [
    { path: '/social-media/videos', label: 'Videos' },
    { path: '/social-media/generate', label: 'Generate Video' }
  ]
}
```

---

## Components

### 1. VideoGeneration Page

**Location**: `src/pages/VideoGeneration.tsx`

**Purpose**: Main page for creating new video generation jobs

**Features**:
- Mode selection (3 modes)
- Prompt input (always visible)
- Conditional inputs based on mode
- Model selection (sora-2 vs sora-2-pro)
- Video configuration options
- Real-time validation

**Component Structure**:
```typescript
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModeSelector } from '@/components/social-media/ModeSelector';
import { PromptInput } from '@/components/social-media/PromptInput';
import { ImageSelector } from '@/components/social-media/ImageSelector';
import { ModelSelector } from '@/components/social-media/ModelSelector';
import { VideoConfigForm } from '@/components/social-media/VideoConfigForm';
import { VoiceConfigForm } from '@/components/social-media/VoiceConfigForm';
import { useSocialMedia } from '@/hooks/useSocialMedia';

export default function VideoGeneration() {
  const [mode, setMode] = useState<VideoMode>('image-to-video');
  const [prompt, setPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [soraModel, setSoraModel] = useState<'sora-2' | 'sora-2-pro'>('sora-2');
  const [videoConfig, setVideoConfig] = useState({
    size: '1280x720',
    seconds: 8
  });
  const [voiceConfig, setVoiceConfig] = useState({
    enabled: false,
    script: '',
    voiceId: '',
    voiceModel: 'eleven_flash_v2_5',
    voiceSettings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    },
    language: 'en'
  });

  const { generateVideo, isGenerating } = useSocialMedia();

  const handleGenerate = async () => {
    await generateVideo({
      mode,
      prompt,
      imagePrompt: mode === 'generated-image-to-video' ? imagePrompt : undefined,
      inputSource: mode === 'image-to-video' ? { type: 'database', imageId: selectedImageId } : undefined,
      soraModel,
      videoConfig,
      voiceConfig: voiceConfig.enabled ? voiceConfig : undefined
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Generate Social Media Video</h1>

      <Card className="p-6 space-y-6">
        <ModeSelector value={mode} onChange={setMode} />

        {mode === 'generated-image-to-video' && (
          <PromptInput
            label="Image Generation Prompt"
            value={imagePrompt}
            onChange={setImagePrompt}
            placeholder="Describe the image to generate..."
            helperText="This will be used to generate an image with Gemini AI"
          />
        )}

        <PromptInput
          label={mode === 'generated-image-to-video' ? 'Video Motion Prompt' : 'Video Prompt'}
          value={prompt}
          onChange={setPrompt}
          placeholder={getPromptPlaceholder(mode)}
          helperText="Describe the motion, camera movement, and effects"
          required
        />

        {mode === 'image-to-video' && (
          <ImageSelector
            value={selectedImageId}
            onChange={setSelectedImageId}
          />
        )}

        <ModelSelector value={soraModel} onChange={setSoraModel} />

        <VideoConfigForm config={videoConfig} onChange={setVideoConfig} />

        <VoiceConfigForm config={voiceConfig} onChange={setVoiceConfig} />

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt || (mode === 'image-to-video' && !selectedImageId)}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Video'}
        </Button>
      </Card>
    </div>
  );
}
```

---

### 2. ModeSelector Component

**Location**: `src/components/social-media/ModeSelector.tsx`

```typescript
import React from 'react';
import { Card } from '@/components/ui/card';

type VideoMode = 'image-to-video' | 'text-to-video' | 'generated-image-to-video';

interface ModeSelectorProps {
  value: VideoMode;
  onChange: (mode: VideoMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const modes = [
    {
      id: 'image-to-video',
      title: 'Database Image → Video',
      description: 'Use an existing menu image as the first frame',
      icon: '🖼️'
    },
    {
      id: 'text-to-video',
      title: 'Text → Video',
      description: 'Generate video entirely from text description',
      icon: '✍️'
    },
    {
      id: 'generated-image-to-video',
      title: 'AI Image → Video',
      description: 'Generate an image with AI, then animate it',
      icon: '🎨'
    }
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-3">Generation Mode</label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => (
          <Card
            key={mode.id}
            className={`p-4 cursor-pointer transition-all ${
              value === mode.id
                ? 'border-primary border-2 bg-primary/5'
                : 'border-gray-200 hover:border-primary/50'
            }`}
            onClick={() => onChange(mode.id as VideoMode)}
          >
            <div className="text-3xl mb-2">{mode.icon}</div>
            <h3 className="font-semibold mb-1">{mode.title}</h3>
            <p className="text-sm text-gray-600">{mode.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### 3. PromptInput Component

**Location**: `src/components/social-media/PromptInput.tsx`

```typescript
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface PromptInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helperText?: string;
  required?: boolean;
  rows?: number;
}

export function PromptInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  required = false,
  rows = 4
}: PromptInputProps) {
  const charCount = value.length;
  const maxChars = 500;

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxChars}
        className="w-full"
      />
      <div className="flex justify-between text-sm">
        {helperText && <span className="text-gray-600">{helperText}</span>}
        <span className="text-gray-500">
          {charCount}/{maxChars}
        </span>
      </div>
    </div>
  );
}
```

---

### 4. ImageSelector Component

**Location**: `src/components/social-media/ImageSelector.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface ImageSelectorProps {
  value: string | null;
  onChange: (imageId: string) => void;
}

export function ImageSelector({ value, onChange }: ImageSelectorProps) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchImages();
  }, [searchQuery]);

  const fetchImages = async () => {
    setLoading(true);
    // Fetch menu item images from API
    // Filter by restaurant or menu if needed
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Select Image</label>

      <Input
        type="text"
        placeholder="Search images..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((image) => (
            <Card
              key={image.id}
              className={`cursor-pointer transition-all ${
                value === image.id
                  ? 'border-primary border-2'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
              onClick={() => onChange(image.id)}
            >
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-32 object-cover rounded"
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 5. ModelSelector Component

**Location**: `src/components/social-media/ModelSelector.tsx`

**Purpose**: Allow users to choose between Sora 2 models (sora-2 vs sora-2-pro)

```typescript
import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { InfoIcon } from 'lucide-react';

type SoraModel = 'sora-2' | 'sora-2-pro';

interface ModelSelectorProps {
  value: SoraModel;
  onChange: (model: SoraModel) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const models = [
    {
      id: 'sora-2',
      name: 'Sora 2',
      speed: 'Fast',
      quality: 'Good',
      cost: '$0.40-0.60 per video',
      description: 'Recommended for most use cases. Generates videos in 2-5 minutes.',
      recommended: true
    },
    {
      id: 'sora-2-pro',
      name: 'Sora 2 Pro',
      speed: 'Slow',
      quality: 'Excellent',
      cost: '$0.80-1.20 per video',
      description: 'Best quality for professional content. Takes 5-15 minutes.',
      recommended: false
    }
  ];

  return (
    <div className="space-y-3">
      <Label>AI Model</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => (
          <Card
            key={model.id}
            className={`p-4 cursor-pointer transition-all relative ${
              value === model.id
                ? 'border-primary border-2 bg-primary/5'
                : 'border-gray-200 hover:border-primary/50'
            }`}
            onClick={() => onChange(model.id as SoraModel)}
          >
            {model.recommended && (
              <div className="absolute -top-2 -right-2 bg-primary text-white text-xs px-2 py-1 rounded-full">
                Recommended
              </div>
            )}
            <h3 className="font-semibold mb-2">{model.name}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Speed:</span>
                <span className="font-medium">{model.speed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quality:</span>
                <span className="font-medium">{model.quality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cost:</span>
                <span className="font-medium text-xs">{model.cost}</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3">{model.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### 6. VideoConfigForm Component

**Location**: `src/components/social-media/VideoConfigForm.tsx`

**Purpose**: Configure video dimensions (landscape/portrait) and duration

```typescript
import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Monitor, Smartphone } from 'lucide-react';

interface VideoConfigFormProps {
  config: {
    size: string;
    seconds: number;
  };
  onChange: (config: { size: string; seconds: number }) => void;
}

export function VideoConfigForm({ config, onChange }: VideoConfigFormProps) {
  const videoSizes = [
    // Landscape options
    {
      value: '1280x720',
      label: 'HD Landscape',
      description: '1280×720 (16:9)',
      orientation: 'landscape',
      icon: Monitor,
      useCase: 'YouTube, Facebook'
    },
    {
      value: '1920x1080',
      label: 'Full HD Landscape',
      description: '1920×1080 (16:9)',
      orientation: 'landscape',
      icon: Monitor,
      useCase: 'Professional content'
    },
    // Portrait options
    {
      value: '720x1280',
      label: 'HD Portrait',
      description: '720×1280 (9:16)',
      orientation: 'portrait',
      icon: Smartphone,
      useCase: 'Instagram Stories, TikTok'
    },
    {
      value: '1080x1920',
      label: 'Full HD Portrait',
      description: '1080×1920 (9:16)',
      orientation: 'portrait',
      icon: Smartphone,
      useCase: 'Instagram Reels, YouTube Shorts'
    }
  ];

  const durationOptions = [
    { value: 4, label: '4 seconds', description: 'Quick clips, GIF-style' },
    { value: 8, label: '8 seconds', description: 'Standard social posts' },
    { value: 12, label: '12 seconds', description: 'Longer content' }
  ];

  const handleSizeChange = (size: string) => {
    onChange({ ...config, size });
  };

  const handleDurationChange = (seconds: number) => {
    onChange({ ...config, seconds });
  };

  const selectedSize = videoSizes.find(s => s.value === config.size);
  const isPortrait = selectedSize?.orientation === 'portrait';

  return (
    <Card className="p-6 space-y-6">
      {/* Size Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Video Format</Label>

        {/* Orientation tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
              !isPortrait
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleSizeChange('1280x720')}
          >
            <Monitor className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Landscape</div>
            <div className="text-xs">YouTube, Facebook</div>
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
              isPortrait
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleSizeChange('720x1280')}
          >
            <Smartphone className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Portrait</div>
            <div className="text-xs">Stories, Reels, TikTok</div>
          </button>
        </div>

        {/* Size options for selected orientation */}
        <RadioGroup value={config.size} onValueChange={handleSizeChange}>
          <div className="grid grid-cols-1 gap-3">
            {videoSizes
              .filter(size => size.orientation === selectedSize?.orientation)
              .map((size) => {
                const Icon = size.icon;
                return (
                  <label
                    key={size.value}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      config.size === size.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <RadioGroupItem value={size.value} id={size.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{size.label}</span>
                      </div>
                      <div className="text-sm text-gray-600">{size.description}</div>
                      <div className="text-xs text-gray-500 mt-1">{size.useCase}</div>
                    </div>
                  </label>
                );
              })}
          </div>
        </RadioGroup>
      </div>

      {/* Duration Selection */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">Duration</Label>
          <span className="text-sm font-medium text-primary">
            {config.seconds} seconds
          </span>
        </div>

        {/* Duration slider */}
        <div className="px-2">
          <Slider
            value={[config.seconds]}
            onValueChange={(values) => handleDurationChange(values[0])}
            min={4}
            max={12}
            step={4}
            className="w-full"
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>4s (Quick)</span>
            <span>8s (Standard)</span>
            <span>12s (Long)</span>
          </div>
        </div>

        {/* Duration descriptions */}
        <div className="space-y-2 pt-2">
          {durationOptions.map((option) => (
            <div
              key={option.value}
              className={`text-sm p-2 rounded ${
                config.seconds === option.value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-gray-600'
              }`}
            >
              <span className="font-semibold">{option.label}:</span> {option.description}
            </div>
          ))}
        </div>
      </div>

      {/* Preview visualization */}
      <div className="space-y-2">
        <Label className="text-sm text-gray-600">Preview</Label>
        <div className="flex justify-center p-6 bg-gray-50 rounded-lg">
          <div
            className={`border-2 border-dashed border-gray-300 bg-white flex items-center justify-center ${
              isPortrait ? 'w-32 h-56' : 'w-56 h-32'
            }`}
          >
            <div className="text-center text-gray-400">
              <div className="text-xs font-medium">{selectedSize?.description}</div>
              <div className="text-xs mt-1">{config.seconds}s</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

---

### 7. VideoList Page

**Location**: `src/pages/SocialMediaVideos.tsx`

**Purpose**: Display all generated videos with filtering and management options

```typescript
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VideoJobStatus } from '@/components/social-media/VideoJobStatus';
import { VideoPreview } from '@/components/social-media/VideoPreview';
import { useSocialMedia } from '@/hooks/useSocialMedia';
import { Link } from 'react-router-dom';

export default function SocialMediaVideos() {
  const { videos, loading, fetchVideos, deleteVideo } = useSocialMedia();
  const [filters, setFilters] = useState({
    status: 'all',
    mode: 'all'
  });

  useEffect(() => {
    fetchVideos(filters);
  }, [filters]);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Social Media Videos</h1>
        <Link to="/social-media/generate">
          <Button>Generate New Video</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="queued">Queued</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filters.mode}
            onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Modes</option>
            <option value="image-to-video">Image → Video</option>
            <option value="text-to-video">Text → Video</option>
            <option value="generated-image-to-video">AI Image → Video</option>
          </select>
        </div>
      </Card>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden">
            {video.status === 'completed' ? (
              <VideoPreview video={video} />
            ) : (
              <VideoJobStatus job={video} />
            )}

            <div className="p-4">
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {video.prompt}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {new Date(video.created_at).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteVideo(video.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### 8. VideoJobStatus Component

**Location**: `src/components/social-media/VideoJobStatus.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useSocialMedia } from '@/hooks/useSocialMedia';

interface VideoJobStatusProps {
  job: {
    id: string;
    status: string;
    progress: number;
    sora_video_id: string;
  };
}

export function VideoJobStatus({ job }: VideoJobStatusProps) {
  const { refreshJobStatus } = useSocialMedia();
  const [localJob, setLocalJob] = useState(job);

  useEffect(() => {
    if (localJob.status === 'queued' || localJob.status === 'in_progress') {
      const interval = setInterval(async () => {
        const updated = await refreshJobStatus(localJob.id);
        setLocalJob(updated);
      }, 10000);  // Poll every 10 seconds

      return () => clearInterval(interval);
    }
  }, [localJob.status]);

  const getStatusIcon = () => {
    switch (localJob.status) {
      case 'queued':
        return <Loader2 className="animate-spin text-blue-500" />;
      case 'in_progress':
        return <Loader2 className="animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="text-green-500" />;
      case 'failed':
        return <AlertCircle className="text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    const variants = {
      queued: 'secondary',
      in_progress: 'default',
      completed: 'success',
      failed: 'destructive'
    };

    return (
      <Badge variant={variants[localJob.status]}>
        {localJob.status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        {getStatusIcon()}
        {getStatusBadge()}
      </div>

      {(localJob.status === 'queued' || localJob.status === 'in_progress') && (
        <div className="space-y-2">
          <Progress value={localJob.progress} className="w-full" />
          <p className="text-sm text-gray-600 text-center">
            {localJob.progress}% complete
          </p>
        </div>
      )}

      {localJob.status === 'queued' && (
        <p className="text-sm text-gray-600">
          Your video is queued for processing...
        </p>
      )}

      {localJob.status === 'in_progress' && (
        <p className="text-sm text-gray-600">
          Generating your video...
        </p>
      )}
    </div>
  );
}
```

---

### 9. VideoPreview Component

**Location**: `src/components/social-media/VideoPreview.tsx`

```typescript
import React, { useState } from 'react';
import { Play, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url: string;
    prompt: string;
    voice_enabled?: boolean;
    final_video_url?: string;
  };
}

export function VideoPreview({ video }: VideoPreviewProps) {
  const [playing, setPlaying] = useState(false);

  // Use final_video_url if voice-over is enabled, otherwise use video_url
  const videoUrl = video.voice_enabled && video.final_video_url
    ? video.final_video_url
    : video.video_url;

  const handleDownload = async () => {
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-${video.id}.mp4`;
    a.click();
  };

  return (
    <div className="relative aspect-video bg-black">
      {!playing ? (
        <>
          <img
            src={video.thumbnail_url}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-all"
          >
            <Play className="w-16 h-16 text-white" fill="white" />
          </button>
        </>
      ) : (
        <video
          src={videoUrl}
          controls
          autoPlay
          className="w-full h-full"
        />
      )}

      <Button
        size="sm"
        variant="secondary"
        className="absolute top-2 right-2"
        onClick={handleDownload}
      >
        <Download className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

---

### 10. VoiceConfigForm Component (Phase 2)

**Location**: `src/components/social-media/VoiceConfigForm.tsx`

**Purpose**: Main component for configuring voice-over settings including enable toggle, script input, voice selection, model selection, and settings.

```typescript
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { VoiceSelector } from './VoiceSelector';
import { VoiceSettings } from './VoiceSettings';
import { Select } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

interface VoiceConfigFormProps {
  config: {
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
    language: string;
  };
  onChange: (config: any) => void;
}

export function VoiceConfigForm({ config, onChange }: VoiceConfigFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleToggle = (enabled: boolean) => {
    onChange({ ...config, enabled });
  };

  const handleScriptChange = (script: string) => {
    onChange({ ...config, script });
  };

  const handleVoiceSelect = (voiceId: string) => {
    onChange({ ...config, voiceId });
  };

  const handleModelChange = (voiceModel: string) => {
    onChange({ ...config, voiceModel });
  };

  const handleSettingsChange = (voiceSettings: any) => {
    onChange({ ...config, voiceSettings });
  };

  const handleLanguageChange = (language: string) => {
    onChange({ ...config, language });
  };

  const models = [
    { id: 'eleven_flash_v2_5', name: 'Flash v2.5', description: 'Fastest, good quality' },
    { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Balanced speed and quality' },
    { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Best quality, 70+ languages' }
  ];

  return (
    <Card className="p-6 space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Voice-Over (Phase 2)</Label>
          <p className="text-sm text-gray-600 mt-1">
            Add AI-generated narration to your video
          </p>
        </div>
        <Switch checked={config.enabled} onCheckedChange={handleToggle} />
      </div>

      {/* Phase 2 Notice */}
      {!config.enabled && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium">Coming in Phase 2</p>
            <p className="text-blue-700">
              Voice-over functionality will be available after core video generation is implemented and tested.
            </p>
          </div>
        </div>
      )}

      {/* Voice Configuration (shown when enabled) */}
      {config.enabled && (
        <div className="space-y-4 pt-2">
          {/* Script Input */}
          <div className="space-y-2">
            <Label>
              Narration Script
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Textarea
              value={config.script}
              onChange={(e) => handleScriptChange(e.target.value)}
              placeholder="Enter the narration script for your video..."
              rows={4}
              maxLength={1000}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600">
              <span>This text will be converted to speech and overlaid on your video</span>
              <span>{config.script.length}/1000</span>
            </div>
          </div>

          {/* Voice Model Selection */}
          <div className="space-y-2">
            <Label>Voice Model</Label>
            <Select value={config.voiceModel} onValueChange={handleModelChange}>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.description}
                </option>
              ))}
            </Select>
          </div>

          {/* Voice Selector */}
          <VoiceSelector
            selectedVoiceId={config.voiceId}
            onSelect={handleVoiceSelect}
            modelId={config.voiceModel}
          />

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Voice Settings
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <VoiceSettings
              settings={config.voiceSettings}
              onChange={handleSettingsChange}
            />
          )}
        </div>
      )}
    </Card>
  );
}
```

---

### 11. VoiceSelector Component (Phase 2)

**Location**: `src/components/social-media/VoiceSelector.tsx`

**Purpose**: Browse and preview available ElevenLabs voices with filtering and search.

```typescript
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Play, Loader2 } from 'lucide-react';

interface Voice {
  voice_id: string;
  name: string;
  labels: {
    accent?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
  preview_url: string;
  category: string;
}

interface VoiceSelectorProps {
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  modelId: string;
}

export function VoiceSelector({ selectedVoiceId, onSelect, modelId }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterAccent, setFilterAccent] = useState('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchVoices();
  }, [modelId]);

  const fetchVoices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/social-media/voices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setVoices(data.voices || []);
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const playPreview = async (voiceId: string) => {
    setPlayingVoiceId(voiceId);

    try {
      const response = await fetch(`/api/social-media/voices/${voiceId}/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'Hello! This is a preview of my voice. How does it sound for your video?'
        })
      });

      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));

      audio.onended = () => setPlayingVoiceId(null);
      audio.play();

    } catch (error) {
      console.error('Failed to play preview:', error);
      setPlayingVoiceId(null);
    }
  };

  const filteredVoices = voices.filter((voice) => {
    const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = filterGender === 'all' || voice.labels.gender === filterGender;
    const matchesAccent = filterAccent === 'all' || voice.labels.accent === filterAccent;
    return matchesSearch && matchesGender && matchesAccent;
  });

  // Get unique accents for filter
  const accents = Array.from(new Set(voices.map(v => v.labels.accent).filter(Boolean)));

  return (
    <div className="space-y-4">
      <Label>Select Voice</Label>

      {/* Search and Filters */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search voices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <select
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <select
          value={filterAccent}
          onChange={(e) => setFilterAccent(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">All Accents</option>
          {accents.map((accent) => (
            <option key={accent} value={accent}>{accent}</option>
          ))}
        </select>
      </div>

      {/* Voice Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {filteredVoices.map((voice) => (
            <Card
              key={voice.voice_id}
              className={`p-3 cursor-pointer transition-all ${
                selectedVoiceId === voice.voice_id
                  ? 'border-primary border-2 bg-primary/5'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
              onClick={() => onSelect(voice.voice_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{voice.name}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {voice.labels.gender && (
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {voice.labels.gender}
                      </span>
                    )}
                    {voice.labels.accent && (
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {voice.labels.accent}
                      </span>
                    )}
                    {voice.labels.age && (
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {voice.labels.age}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPreview(voice.voice_id);
                  }}
                  disabled={playingVoiceId === voice.voice_id}
                >
                  {playingVoiceId === voice.voice_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredVoices.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          No voices found matching your criteria
        </p>
      )}
    </div>
  );
}
```

---

### 12. VoiceSettings Component (Phase 2)

**Location**: `src/components/social-media/VoiceSettings.tsx`

**Purpose**: Advanced voice settings controls for stability, similarity, style, and speaker boost.

```typescript
import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { InfoIcon } from 'lucide-react';

interface VoiceSettingsProps {
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  onChange: (settings: any) => void;
}

export function VoiceSettings({ settings, onChange }: VoiceSettingsProps) {
  const handleStabilityChange = (value: number[]) => {
    onChange({ ...settings, stability: value[0] });
  };

  const handleSimilarityChange = (value: number[]) => {
    onChange({ ...settings, similarity_boost: value[0] });
  };

  const handleStyleChange = (value: number[]) => {
    onChange({ ...settings, style: value[0] });
  };

  const handleSpeakerBoostChange = (checked: boolean) => {
    onChange({ ...settings, use_speaker_boost: checked });
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Stability: {settings.stability.toFixed(2)}</Label>
          <InfoIcon className="w-4 h-4 text-gray-400" title="Higher values make voice more consistent but less expressive" />
        </div>
        <Slider
          value={[settings.stability]}
          onValueChange={handleStabilityChange}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
        <p className="text-xs text-gray-600">
          Low: More variable and expressive • High: More consistent and stable
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Similarity: {settings.similarity_boost.toFixed(2)}</Label>
          <InfoIcon className="w-4 h-4 text-gray-400" title="How closely to match the original voice" />
        </div>
        <Slider
          value={[settings.similarity_boost]}
          onValueChange={handleSimilarityChange}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
        <p className="text-xs text-gray-600">
          Low: More creative interpretation • High: Closer to original voice
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Style Exaggeration: {settings.style.toFixed(2)}</Label>
          <InfoIcon className="w-4 h-4 text-gray-400" title="How much to amplify the voice's style characteristics" />
        </div>
        <Slider
          value={[settings.style]}
          onValueChange={handleStyleChange}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
        <p className="text-xs text-gray-600">
          Low: Natural style • High: Exaggerated style characteristics
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label>Speaker Boost</Label>
          <InfoIcon className="w-4 h-4 text-gray-400" title="Enhance clarity and reduce background noise" />
        </div>
        <Switch
          checked={settings.use_speaker_boost}
          onCheckedChange={handleSpeakerBoostChange}
        />
      </div>
      <p className="text-xs text-gray-600">
        Recommended: Improves clarity and reduces background noise
      </p>
    </div>
  );
}
```

---

## React Hook

**Location**: `src/hooks/useSocialMedia.ts`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useSocialMedia() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const generateVideo = async (config: any) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/social-media/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      toast.success('Video generation started!');
      navigate('/social-media/videos');
      return data.job;

    } catch (error) {
      toast.error(`Failed to generate video: ${error.message}`);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchVideos = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/social-media/videos?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setVideos(data.videos);

    } catch (error) {
      toast.error('Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  const refreshJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/social-media/videos/${jobId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      return data.job;

    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  };

  const deleteVideo = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      await fetch(`/api/social-media/videos/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      toast.success('Video deleted');
      fetchVideos();

    } catch (error) {
      toast.error('Failed to delete video');
    }
  };

  return {
    videos,
    loading,
    isGenerating,
    generateVideo,
    fetchVideos,
    refreshJobStatus,
    deleteVideo
  };
}
```

---

Last Updated: 2025-10-07
