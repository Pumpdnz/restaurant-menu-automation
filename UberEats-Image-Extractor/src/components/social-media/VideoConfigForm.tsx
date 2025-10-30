import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { VideoConfig } from '@/hooks/useSocialMedia';
import { Monitor, Smartphone } from 'lucide-react';

interface VideoConfigFormProps {
  config: VideoConfig;
  onChange: (config: VideoConfig) => void;
}

interface VideoSizeOption {
  value: string;
  label: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  useCase: string;
}

const videoSizes: VideoSizeOption[] = [
  // Landscape options
  {
    value: '1280x720',
    label: 'HD Landscape',
    description: '1280×720 (16:9)',
    orientation: 'landscape',
    useCase: 'YouTube, Facebook',
  },
  {
    value: '1920x1080',
    label: 'Full HD Landscape',
    description: '1920×1080 (16:9)',
    orientation: 'landscape',
    useCase: 'Professional content',
  },
  // Portrait options
  {
    value: '720x1280',
    label: 'HD Portrait',
    description: '720×1280 (9:16)',
    orientation: 'portrait',
    useCase: 'Instagram Stories, TikTok',
  },
  {
    value: '1080x1920',
    label: 'Full HD Portrait',
    description: '1080×1920 (9:16)',
    orientation: 'portrait',
    useCase: 'Instagram Reels, YouTube Shorts',
  },
];

interface DurationOption {
  value: number;
  label: string;
  description: string;
}

const durationOptions: DurationOption[] = [
  { value: 4, label: '4 seconds', description: 'Quick clips, GIF-style' },
  { value: 8, label: '8 seconds', description: 'Standard social posts' },
  { value: 12, label: '12 seconds', description: 'Longer content' },
];

export function VideoConfigForm({ config, onChange }: VideoConfigFormProps) {
  const selectedSize = videoSizes.find((s) => s.value === config.size);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    selectedSize?.orientation || 'landscape'
  );

  const handleSizeChange = (size: string) => {
    onChange({ ...config, size });
  };

  const handleOrientationChange = (newOrientation: 'landscape' | 'portrait') => {
    setOrientation(newOrientation);
    // Auto-select first size of new orientation
    const firstSize = videoSizes.find((s) => s.orientation === newOrientation);
    if (firstSize) {
      handleSizeChange(firstSize.value);
    }
  };

  const handleDurationChange = (seconds: number) => {
    onChange({ ...config, seconds });
  };

  const filteredSizes = videoSizes.filter((s) => s.orientation === orientation);
  const currentDuration = durationOptions.find((d) => d.value === config.seconds);

  return (
    <Card className="p-6 space-y-6">
      {/* Size Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Video Format</Label>

        {/* Orientation tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              orientation === 'landscape'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleOrientationChange('landscape')}
          >
            <Monitor className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Landscape</div>
            <div className="text-xs opacity-75">YouTube, Facebook</div>
          </button>
          <button
            type="button"
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              orientation === 'portrait'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleOrientationChange('portrait')}
          >
            <Smartphone className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Portrait</div>
            <div className="text-xs opacity-75">Stories, Reels, TikTok</div>
          </button>
        </div>

        {/* Size options for selected orientation */}
        <RadioGroup value={config.size} onValueChange={handleSizeChange}>
          <div className="grid grid-cols-1 gap-3">
            {filteredSizes.map((size) => (
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
                    <span className="font-semibold text-sm">{size.label}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{size.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">{size.useCase}</div>
                </div>
              </label>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Duration Selection */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">Duration</Label>
          <span className="text-sm font-medium text-primary">{config.seconds} seconds</span>
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
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
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
                  : 'text-muted-foreground'
              }`}
            >
              <span className="font-semibold">{option.label}:</span> {option.description}
            </div>
          ))}
        </div>
      </div>

      {/* Preview visualization */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Preview</Label>
        <div className="flex justify-center p-6 bg-muted rounded-lg">
          <div
            className={`border-2 border-dashed border-muted-foreground/30 bg-background flex items-center justify-center ${
              orientation === 'portrait' ? 'w-32 h-56' : 'w-56 h-32'
            }`}
          >
            <div className="text-center text-muted-foreground">
              <div className="text-xs font-medium">{selectedSize?.description}</div>
              <div className="text-xs mt-1">{config.seconds}s</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
